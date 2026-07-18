# Changing the email sending domain (runbook)

**Purpose:** how to switch the domain Bookdeck/Ezzy sends notification + password-recovery emails from — e.g. moving from a temporary/test domain to the real one (`ezzy.ph` or `info.ezzy.ph`) once it's purchased.

**TL;DR:** the sending domain is **configuration, not code**. The From address lives in a secret (`NOTIFICATION_EMAIL_FROM`) and the SMTP sender lives in Supabase Auth settings. Changing domains means: verify the new domain in Resend (DNS), update those config values, redeploy/restart so they take effect, then retire the old domain. No migrations, no app rebuild — unless you also rebrand the in-email display name (see §4).

> Related: `.plans/2026-06-23-email-notifications-resend.md` (the email feature plan; D-4 = sending domain).

---

## Why it's config-only (the design that makes this cheap)
- **Notification emails** read the From from the Edge Function secret `NOTIFICATION_EMAIL_FROM` at send time. Nothing about the domain is hardcoded in the function, the migrations, or the three apps.
- **The dispatch trigger** (`20260624000003_notification_email_dispatch.sql`) stores only the *function URL + shared secret* in Vault — **not** the email domain. So a domain change never touches the database.
- **Password-recovery / auth emails** read the sender from Supabase Auth's SMTP settings (dashboard for hosted) — also config. Locally there's no sender to set: `[auth.email.smtp]` is commented out in `config.toml` and mail goes to Inbucket.

So the domain appears in a small, known set of config places (the checklist below), and nowhere in versioned application logic.

---

## Step-by-step: switch to a new domain

Assume `OLD` = current (temporary) domain, `NEW` = the real domain (e.g. `info.ezzy.ph`).

1. **Buy the domain** (if not already) and make sure you can manage its DNS.
2. **Add `NEW` in Resend** → Domains → Add Domain → enter `NEW` (a sending subdomain like `info.ezzy.ph` is recommended).
3. **Add the DNS records Resend shows** (MX + SPF TXT + DKIM TXT, optional DMARC) at `NEW`'s DNS host — exactly as displayed. Wait for Resend to show **Verified**. (See the plan's Setup section / the DreamHost notes if DNS is there.)
4. **Update the notification From** — set the Edge Function secret:
   ```bash
   supabase secrets set NOTIFICATION_EMAIL_FROM="Ezzy <no-reply@NEW>"
   ```
   Also update the local `backbone/supabase/functions/.env` copy if you run the function locally.
5. **Redeploy the function** so the new secret is picked up:
   ```bash
   supabase functions deploy send-notification-email
   ```
   (Secrets apply to new invocations after deploy.)
6. **Update password-recovery SMTP sender** (only if recovery email is configured):
   - Hosted: Supabase Dashboard → Project Settings → Auth → SMTP → change the **sender email** to `no-reply@NEW` (host/user/pass stay the same — still `smtp.resend.com` / `resend` / your Resend API key).
   - Local: nothing to change. `[auth.email.smtp]` is **commented out** in `backbone/supabase/config.toml`; local recovery mail is served by the enabled `[inbucket]` block (port 54324), so **all** local mail lands in the Inbucket/local mailbox regardless of sender or domain. The local sender/domain can't be changed this way.
7. **Send a test** — trigger one notification (and one password reset, if configured) and confirm it arrives from `NEW` and isn't flagged as spam.
8. **Retire `OLD`** in Resend once you've confirmed `NEW` works (and remove `OLD`'s DNS records if you no longer want it sending).

---

## Checklist — every place the domain/From appears

| Where | What to change | Hosted vs local |
|-------|----------------|-----------------|
| **Resend → Domains** | Add + verify `NEW`; retire `OLD` | n/a (Resend dashboard) |
| **DNS host for `NEW`** | Add Resend's MX/SPF/DKIM records | n/a (registrar/DNS) |
| **`NOTIFICATION_EMAIL_FROM` secret** | `Ezzy <no-reply@NEW>` | `supabase secrets set` (hosted) + `functions/.env` (local) |
| **Edge Function deploy** | Redeploy to pick up the secret | `supabase functions deploy …` |
| **Auth SMTP sender** | sender email → `no-reply@NEW` | Dashboard → Auth → SMTP (hosted only) — local uses Inbucket, no sender/domain to change |
| **In-email display name** (optional) | only if rebranding the name, not the domain — see §4 | `base.ts` in the function (code) |
| **Plan/docs** (optional) | update `info.ezzy.com` references for accuracy | `.plans/2026-06-23-email-notifications-resend.md`, this file |

> The `RESEND_API_KEY` does **not** change when you change domains (it's account-scoped, and the same key is the SMTP password). Only re-issue it if it's compromised.

---

## §4 — Display name vs email address (don't confuse them)
- **Email address domain** (`@info.ezzy.com` → `@info.ezzy.ph`): pure config — the steps above.
- **Display name** (the `Ezzy` in `Ezzy <no-reply@…>`): part of `NOTIFICATION_EMAIL_FROM`, so also config for the From header.
- **In-body brand text** (header/footer chrome inside the email): lives in the Edge Function template (`templates/base.ts`). Only needs a code edit if you rebrand the *name* (e.g. "Ezzy" → "EzzyBook" during the deferred rename) — a domain-only change needs nothing here.

---

## Notes
- **Nothing in the database changes** for a domain switch — no migration.
- **Verify before cutover.** Until `NEW` shows Verified in Resend, sends from it will fail or be limited; keep `OLD` active until `NEW` is confirmed working.
- **Current value of record:** whatever domain is presently verified in Resend should match `NOTIFICATION_EMAIL_FROM`. If you used a temporary domain now, set `NOTIFICATION_EMAIL_FROM` to that temp domain until you run this runbook for `ezzy.ph`.
- **One SPF record per name.** When adding records at the new DNS host, ensure the sending subdomain has a single SPF TXT (Resend's) — don't merge it with unrelated root-domain SPF entries.
