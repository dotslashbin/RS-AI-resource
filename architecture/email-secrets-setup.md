# Email secrets & Vault setup (guide)

**Purpose:** what each secret in the notification-email system is, **where it's stored**, **where you get its value**, and **how to set it**. Covers the two Supabase **Vault** secrets the DB dispatch trigger reads, plus the Edge Function secrets.

Related: `.plans/2026-06-23-email-notifications-resend.md`, `architecture/email-sending-domain.md`.

---

## The big picture: two separate secret stores

| Store | What it is | Who reads it |
|-------|-----------|--------------|
| **Supabase Vault** | Encrypted secrets living **inside your Postgres database** (`vault.secrets`, read decrypted via the `vault.decrypted_secrets` view). | The DB **dispatch trigger** (`dispatch_notification_email()`) — it needs the function URL + a shared secret at INSERT time. |
| **Edge Function secrets** | Env vars available only to the deployed Edge Function. | The **function** itself (Resend key, From, the matching shared secret). |

Why Vault at all? The dispatch trigger is defined in a **migration** (source-controlled), so it can't contain the URL or secret. Vault gives the `SECURITY DEFINER` trigger a way to read that config at runtime without hard-coding it.

---

## The full secret inventory

| Name | Store | Where the value comes from | Notes |
|------|-------|---------------------------|-------|
| `edge_function_base_url` | **Vault** | **Look it up:** your project URL `https://<project-ref>.supabase.co` | The trigger appends `/functions/v1/send-notification-email`. So store the bare project URL — **no** trailing slash, **no** `/functions/v1`. |
| `notification_email_secret` | **Vault** | **You invent it:** a long random string you generate | Shared secret for the trigger→function handshake. **Must equal** the function's `NOTIFICATION_EMAIL_SECRET`. |
| `NOTIFICATION_EMAIL_SECRET` | Edge Function | **Same value** as `notification_email_secret` above | The function compares the incoming `x-webhook-secret` header to this. |
| `RESEND_API_KEY` | Edge Function | Resend dashboard → API Keys | Already created. Doubles as the SMTP password for password recovery. |
| `NOTIFICATION_EMAIL_FROM` | Edge Function | Your decision: `Ezzy <no-reply@info.ezzy.com>` | Domain must be Verified in Resend. |
| `NOTIFICATION_EMAIL_OVERRIDE_TO` | Edge Function | A test inbox you own | **Non-prod only** — redirects every email here. Leave unset in prod. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Edge Function | Auto-injected by the platform | You don't set these on hosted. |

> Key insight: **`edge_function_base_url` you look up; `notification_email_secret` you make up.** The made-up one goes in **two** places (Vault + function) and the two copies must match.

---

## Step 1 — Find / generate the values

**`edge_function_base_url`:** Supabase Dashboard → your project → **Project Settings → API → Project URL**. It looks like `https://abcdefghijklmno.supabase.co`. That whole URL is the value.

**`notification_email_secret`:** generate a random string locally — keep it somewhere safe:
```bash
openssl rand -hex 32
```

---

## Step 2 — Store the two Vault secrets (hosted project)

**Option A — SQL editor (reliable, version-proof).** Supabase Dashboard → **SQL Editor**, run:
```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co',   -- the value
  'edge_function_base_url',              -- the name (the trigger looks this up)
  'Base URL the notification-email trigger calls'
);

select vault.create_secret(
  '<the random string from step 1>',
  'notification_email_secret',
  'Shared secret for the notification-email webhook handshake'
);
```
Verify (shows decrypted values — only privileged roles can):
```sql
select name, decrypted_secret from vault.decrypted_secrets
where name in ('edge_function_base_url','notification_email_secret');
```
To change one later:
```sql
-- find the id, then:
select vault.update_secret('<secret-uuid>', '<new value>');
```

**Option B — Dashboard UI.** Supabase Dashboard → **Integrations → Vault** (some versions: Project Settings → Vault) → **Add secret** → enter the Name and Value for each of the two. Same names as above.

---

## Step 3 — Set the matching Edge Function secrets

These are NOT in Vault — they're function env. Set them with the CLI (hosted):
```bash
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  NOTIFICATION_EMAIL_FROM="Ezzy <no-reply@info.ezzy.com>" \
  NOTIFICATION_EMAIL_SECRET="<the SAME random string you put in Vault>"
# non-prod only:
supabase secrets set NOTIFICATION_EMAIL_OVERRIDE_TO="you@example.com"
```
`NOTIFICATION_EMAIL_SECRET` here **must equal** the Vault `notification_email_secret`, or the function will reject the trigger's call with 401.

---

## What "email sending is available" actually requires

Adding the Vault secrets is **necessary but not sufficient**. Every one of these must be true before any email goes out (local or hosted):

1. The **Edge Function is running/deployed** (`supabase functions serve` locally, or `supabase functions deploy` hosted).
2. The function has its **own secrets** (`RESEND_API_KEY`, `NOTIFICATION_EMAIL_FROM`, `NOTIFICATION_EMAIL_SECRET`).
3. The **Vault secrets exist** so the trigger actually calls the function (`edge_function_base_url`, `notification_email_secret`).
4. The DB can **reach** the function URL (trivial on hosted; the catch locally — see below).
5. The **From domain is Verified** in Resend (or use `onboarding@resend.dev` to your own Resend-account email, or `NOTIFICATION_EMAIL_OVERRIDE_TO`, for the first test).

**Does creating a booking trigger an email?** Yes — that's the real end-to-end path: booking → `new_booking` notification row (for the vendor's admins) → dispatch trigger → function → Resend. If all five conditions above hold, booking a slot sends an email to the vendor admin(s).

## How to test (two levels)

### Level 1 — the function in isolation (easiest; do this first)
Proves the function + Resend + templates + logging work, with **no trigger and no Vault**:
```bash
supabase functions serve send-notification-email \
  --env-file supabase/functions/send-notification-email/.env

curl -i -X POST http://127.0.0.1:54321/functions/v1/send-notification-email \
  -H "x-webhook-secret: <NOTIFICATION_EMAIL_SECRET from your .env>" \
  -H "Content-Type: application/json" \
  -d '{"notification_id":"<an existing notifications.id>"}'
```
Expect: an email (to your override/verified address) and a `notification_emails` row. POST the same id twice → second is idempotent (no second send).

### Level 2 — the full chain (booking → email)
This needs the DB to reach the function. **The local catch:** the dispatch trigger runs via `pg_net` *inside the Postgres container*, so `edge_function_base_url` **cannot be `http://127.0.0.1:54321`** — from inside that container `127.0.0.1` is the container itself, not your machine. You'd have to point it at a container-reachable address (e.g. the Docker host such as `host.docker.internal`, which on WSL2 may need extra Docker config), and routing local Kong/edge-runtime adds version-dependent friction.

**Recommendation:** do the Level-2 end-to-end test on a **deployed/staging project**, where `edge_function_base_url = https://<ref>.supabase.co`, `pg_net` reaches it over normal HTTPS, and `verify_jwt=false` lets the call through. There, create a booking and watch the email arrive + a `notification_emails` row appear. Locally, rely on Level 1.

> If you *do* want Level 2 locally, tell me your setup (Docker Desktop vs native, WSL2) and I'll work out the exact reachable URL — but Level 1 + a staging end-to-end is the lower-friction path.

---

## Quick sanity checklist
- [ ] `edge_function_base_url` in Vault = bare `https://<ref>.supabase.co` (no `/functions/v1`).
- [ ] `notification_email_secret` (Vault) === `NOTIFICATION_EMAIL_SECRET` (function) — identical strings.
- [ ] `RESEND_API_KEY`, `NOTIFICATION_EMAIL_FROM` set as function secrets.
- [ ] Non-prod: `NOTIFICATION_EMAIL_OVERRIDE_TO` set; prod: unset.
- [ ] Sending domain Verified in Resend (see `email-sending-domain.md`).
