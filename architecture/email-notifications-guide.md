# Email Notifications — complete setup, run & test guide

**Master reference** for the email system across **local** and **live** environments. Captures how it works, exactly how it was set up in each environment, how to run it locally, and how to test both. For deep dives see: `email-sending-domain.md` (change the sending domain), `email-secrets-setup.md` (secret-by-secret), `email-setup-local-and-remote.md` / `email-local-run-quickstart.md` (runbooks), `.plans/2026-06-26-email-hosted-cutover.md` (the executed cutover).

> **No secrets in this file.** All keys/passwords are placeholders — the real values live in gitignored `.env` files (local) and `supabase secrets` / Vault (hosted).

---

## 1. How it works

Two **independent** email paths, both sending via **Resend**, sharing one verified domain (`ezzy.ph`) and one Resend account:

| Path | Trigger | Delivery |
|------|---------|----------|
| **Notification emails** (the 7 in-app notification types) | Every row inserted into `public.notifications` | AFTER-INSERT DB trigger → `pg_net` → **Edge Function** `send-notification-email` → **Resend API** |
| **Auth emails** (password recovery) | Supabase GoTrue (`resetPasswordForEmail`) | **Resend SMTP** (hosted) / **local mailbox** (local, `http://127.0.0.1:54324`) |

> **Local mail UI naming:** the config key in `config.toml` is `[inbucket]`, though the UI at `http://127.0.0.1:54324` may present as **Mailpit** — same service, same port.

**Notification path detail:** one `notifications` row = one email. The trigger (`notifications_dispatch_email`, migration `20260624000003`) posts only the notification `id`; the function re-reads the row, checks the per-portal switch, resolves the recipient, renders a template, sends via Resend, and logs to `notification_emails`. **No Resend code lives in the three apps** — it's centralized in the one function.

**Controls (Command → Notification Settings):**
- Per-**type** switch (`notification_type_settings.is_enabled`) — gates whether the notification is created at all (in-app **and** email).
- Per-**portal** email switch (`notification_email_settings.is_email_enabled`) — gates only the email channel; in-app still fires.

---

## 2. Where config lives (local vs hosted)

**They are fully separate. `supabase secrets` only ever touches hosted; the `.env` file only ever touches local.**

| Config | Local (Docker) | Hosted |
|--------|----------------|--------|
| Run the function | `supabase functions serve … --env-file … --no-verify-jwt` (terminal open) | deployed (GitHub integration / `supabase functions deploy`) |
| Function secrets (`RESEND_API_KEY`, `NOTIFICATION_EMAIL_FROM`, `NOTIFICATION_EMAIL_SECRET`, `NOTIFICATION_EMAIL_OVERRIDE_TO`) | `backbone/supabase/functions/send-notification-email/.env` | `supabase secrets set` |
| Vault secrets (`edge_function_base_url`, `notification_email_secret`) | SQL on local DB; URL = `http://host.docker.internal:54321`; **wiped by `db reset`** | SQL on hosted; URL = `https://<ref>.supabase.co`; persists |
| Auth (recovery) email delivery | **Mailpit** (`http://127.0.0.1:54324`) — automatic | Resend **SMTP** (dashboard → Auth → SMTP) |
| Project ref | n/a | `backbone/.env` → `SUPABASE_PROJECT_ID` (gitignored) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | auto-injected by CLI — **never set by hand** | auto-injected by platform |

---

## 3. LOCAL — setup

Prereqs: Docker + Supabase CLI; a Resend account with a domain verified (a temp domain is fine for dev).

1. **Function secrets file** `backbone/supabase/functions/send-notification-email/.env` (copy from `.env.example`), set:
   - `RESEND_API_KEY` — a valid Resend key (ideally a separate **dev** key).
   - `NOTIFICATION_EMAIL_FROM` — e.g. `Ezzy <no-reply@ezzy.ph>` (any domain verified in that Resend account).
   - `NOTIFICATION_EMAIL_SECRET` — any long random string (`openssl rand -hex 32`).
   - `NOTIFICATION_EMAIL_OVERRIDE_TO` — your inbox (keeps local from mailing real users).
   - Do **not** set `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
2. **Schema** — `cd backbone && supabase start && supabase db reset` (applies migrations + seed; seed disables the dispatch trigger around Block 8 so a reset never emails).
3. **Local Vault secrets** (for the full trigger→email chain) — SQL editor (`http://127.0.0.1:54323`) or psql:
   ```sql
   select vault.create_secret('http://host.docker.internal:54321', 'edge_function_base_url', 'local');
   select vault.create_secret('<same as NOTIFICATION_EMAIL_SECRET>', 'notification_email_secret', 'local');
   ```
   ⚠️ **`supabase db reset` wipes these** — keep them in a gitignored `backbone/supabase/_local-vault.sql` and re-run after each reset.

---

## 4. LOCAL — how to run

Keep this terminal open while developing:
```bash
cd backbone
supabase functions serve send-notification-email \
  --env-file supabase/functions/send-notification-email/.env \
  --no-verify-jwt
```
(Auth/recovery emails need nothing extra locally — GoTrue routes them to Mailpit automatically.)

---

## 5. LOCAL — how to test

**A) Notification email — function only (fastest, no trigger/Vault):**
```bash
curl -i -X POST http://127.0.0.1:54321/functions/v1/send-notification-email \
  -H "x-webhook-secret: <NOTIFICATION_EMAIL_SECRET from .env>" \
  -H "Content-Type: application/json" \
  -d '{"notification_id":"40000000-0000-0000-0000-000000000004"}'   # a seeded id
```
Expect `{"ok":true,"outcome":"sent"}`, an email in the override inbox, a `notification_emails` row. Re-POST same id → `"idempotent"` (no second send).

**B) Notification email — full chain (needs local Vault secrets from §3):** insert a real notification; the trigger fires:
```sql
insert into public.notifications (user_id, portal, type, title, body)
values ('00000000-0000-0000-0000-000000000003','booker','booking_confirmed','Local test','Full chain.');
```
Check the override inbox + `select recipient_email,status,error from notification_emails order by attempted_at desc limit 3;` and, to debug the trigger's HTTP call, `select status_code,error_msg from net._http_response order by created desc limit 3;`.

**C) Password recovery:** run an app on **`http://localhost:3000`** (use `localhost`, not `127.0.0.1` — WSL2's Next HMR doesn't bind on 127.0.0.1) → "Forgot?" → a registered account's email → open the email in **Mailpit** (`http://127.0.0.1:54324`) → click the link → "Set a new password" → submit.

---

## 6. LIVE (hosted) — setup (what we did)

Executed via the cutover checklist `.plans/2026-06-26-email-hosted-cutover.md`:

1. **Domain** — verified **`ezzy.ph`** in Resend; DNS records added in **Hostinger**. From = `Ezzy <no-reply@ezzy.ph>`.
2. **Link CLI** — `cd backbone && set -a; source .env; set +a && supabase link --project-ref "$SUPABASE_PROJECT_ID"` (ref lives in `backbone/.env`).
3. **Migrations** — applied automatically by the **Supabase↔GitHub integration** on merge to master (verify with `supabase migration list`; manual `supabase db push` not needed going forward).
4. **Function** — deployed by the same integration (verify `supabase functions list`). **Verify-JWT must be OFF** (dashboard toggle or `--no-verify-jwt`) or the trigger call gets 401.
5. **Function secrets** — `supabase secrets set RESEND_API_KEY=… NOTIFICATION_EMAIL_FROM="Ezzy <no-reply@ezzy.ph>" NOTIFICATION_EMAIL_SECRET=… NOTIFICATION_EMAIL_OVERRIDE_TO=<inbox>` (keep override on until verified).
6. **Vault secrets** — SQL editor on the hosted project:
   ```sql
   select vault.create_secret('https://<PROJECT_REF>.supabase.co','edge_function_base_url','prod');   -- bare URL, from Settings→API
   select vault.create_secret('<same as NOTIFICATION_EMAIL_SECRET>','notification_email_secret','prod');
   ```
7. **Auth (recovery) SMTP** — dashboard → Project Settings → Auth → SMTP: host `smtp.resend.com`, port `587`, user `resend`, password = Resend API key, sender `no-reply@ezzy.ph`, name `Ezzy`. Raise the auth-email rate limit if needed.
8. **URL config** (for recovery redirects) — dashboard → Auth → URL Configuration: Site URL + add each deployed app URL to the redirect allow-list. *(Pending real app URLs — the deployed apps must also point `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` at this project.)*

---

## 7. LIVE — how to test

**Notification email:** ensure at least one user exists (seed data or a dashboard-created user), then insert a notification in the hosted SQL editor:
```sql
insert into public.notifications (user_id, portal, type, title, body)
values ('<a real user id>','booker','booking_confirmed','Live test','Hosted pipeline.');
select recipient_email,status,provider_message_id,error from notification_emails order by attempted_at desc limit 3;
```
Success = email in the override inbox (From `no-reply@ezzy.ph`), `status='sent'` + a `provider_message_id`. `recipient_email` shows the *real* intended recipient while the override sends the actual mail to your inbox. Or, realistically, flip a seeded booking's status to fire the booking trigger.

**Password recovery (live):** once the apps are deployed against this project and their URLs are in the redirect allow-list — request a reset in a deployed app → a real recovery email arrives via Resend SMTP → link → set new password.

**Go fully live:** when confident, remove the override so real recipients get mail:
```bash
supabase secrets unset NOTIFICATION_EMAIL_OVERRIDE_TO
```

---

## 8. Troubleshooting (issues we actually hit)

| Symptom | Cause / fix |
|--------|-------------|
| `notification_emails.error` = **"API key is invalid"** | Wrong/revoked/typo'd `RESEND_API_KEY`, or a key from a different Resend account than the verified domain. Re-set it (local: `.env` + restart serve; hosted: `supabase secrets set RESEND_API_KEY=…`). Use a separate key per environment. |
| `net._http_response.status_code` = **401** | `notification_email_secret` (Vault) ≠ function's `NOTIFICATION_EMAIL_SECRET`, **or** verify-JWT is on. |
| **No `net._http_response` row** after an insert | Trigger didn't call out → Vault secrets missing/misnamed, or the dispatch trigger is disabled (`select tgenabled from pg_trigger where tgname='notifications_dispatch_email';` should be `O`; re-enable with `alter table public.notifications enable trigger notifications_dispatch_email;`). |
| `status = 'skipped'` | `no_recipient_email` (user has no profile email) or `portal_email_disabled` (that portal's email toggle is off). |
| Recovery link → **black page** on `127.0.0.1:3000` | WSL2: Next's HMR websocket doesn't bind on 127.0.0.1. Use **`localhost`**; Supabase `site_url`/redirect allow-list use `localhost` locally. |
| Recovery link → **"invalid code"** / dashboard instead of reset form | PKCE mismatch — fixed by `flowType: "implicit"` + module-load `PASSWORD_RECOVERY` listener (already in each app's `client.ts`/`useAppShell.ts`). |
| Reset form → **"Auth session missing!"** | The portal access gate signed the recovery session out — fixed by skipping the gate during recovery (`if (isRecoveryDetected()) return`, already in each app). |
| Unsure whether `supabase secrets` hit local or live | It's **always** the linked remote project. Confirm the link: linked ref (`backbone/supabase/.temp/project-ref`) should equal `SUPABASE_PROJECT_ID` in `backbone/.env`. Local uses the `.env` file, never `supabase secrets`. |

---

## 9. Maintenance

- **Recreating the Supabase project** (new ref): update `SUPABASE_PROJECT_ID` in `backbone/.env`, `supabase link` again, ensure migrations applied (integration or `db push`), re-set function secrets, re-create Vault secrets (new base URL), redo Auth SMTP + URL config. The Resend domain/DNS is unaffected. Full list in the cutover checklist's "If you recreate the project" section.
- **Changing the sending domain** (e.g. subdomain later): config-only — see `email-sending-domain.md` (verify new domain, update `NOTIFICATION_EMAIL_FROM` + Auth SMTP sender; no code/migration).
- **Separate Resend keys per environment** is recommended (a dev key locally, prod key hosted) so revoking one never breaks the other.
- **After every local `supabase db reset`:** re-add the two local Vault secrets (§3).
