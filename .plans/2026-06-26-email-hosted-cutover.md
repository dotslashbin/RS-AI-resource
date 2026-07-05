# Email — hosted (live Resend) cutover checklist

**Date:** 2026-06-26
**Scope:** Take the notification-email + password-recovery features live on the hosted Supabase project, sending real mail via Resend from `ezzy.ph`.
**Status:** DRAFT — ready to execute once `ezzy.ph` is verified in Resend.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE.
> Detail lives in the runbooks — this is the execution checklist. See:
> `architecture/email-setup-local-and-remote.md` (Part B), `architecture/email-secrets-setup.md`, `architecture/email-sending-domain.md`.

---

## Locked-in values
| | Value |
|---|---|
| Sending domain (verify in Resend) | **`ezzy.ph`** (subdomain — isolates reputation) |
| From identity | **`Ezzy <no-reply@ezzy.ph>`** |
| DNS host for `ezzy.ph` | **Hostinger** (you control it) |
| Hosted Supabase project ref | **`<PROJECT_REF>`** — currently `yohbcehqstkhecdbxilm`; **may change if the project is recreated** (see last section) |
| Deployed app URLs (redirect allow-list) | `<BOOKER_URL>`, `<VENDOR_URL>`, `<COMMAND_URL>` (the Vercel domains) |

Two email paths go live together and share the domain + API key:
- **Notification emails** — `notifications` INSERT → trigger → Edge Function → Resend API.
- **Auth/recovery emails** — Supabase GoTrue → Resend SMTP.

Free-tier note: Edge Functions, `pg_net`, `supabase_vault`, and custom Auth SMTP all work on the free tier. Free projects **pause after ~1 week idle** — a paused project won't send; just resume it.

---

## Phase A — Verify the sending domain (do first; DNS is the slow part)  ✅ DONE (2026-07-03)
- [x] ✅ Resend → Domains → Add Domain → **`ezzy.ph`** (root domain verified in Resend; DNS on Hostinger).
- [ ] ⬜ In **Hostinger** DNS for `ezzy.ph`, add the records Resend shows (MX + SPF TXT + DKIM TXT, optional DMARC) **exactly** — for a `mail` subdomain the host names are like `send.mail` / `resend._domainkey.mail` (use whatever Resend displays; Hostinger appends `.ezzy.ph`).
- [ ] ⬜ Wait for Resend to show **Verified**. (Until then, real sends fail/limited.)
- [ ] ⬜ Confirm your Resend API key has **Sending** access (reused as the SMTP password in Phase C).

## Phase B — Notification emails on hosted  ✅ DONE (2026-07-03)
- [x] ✅ CLI linked to the prod project (`supabase link`; ref in `backbone/.env`)
- [x] ✅ Schema applied — via the **Supabase↔GitHub integration** on merge to master (manual `db push` not needed)
- [x] ✅ Function deployed — via the same integration; **verify-JWT confirmed OFF**
- [x] ✅ Function secrets set (`supabase secrets set …`) — incl. `NOTIFICATION_EMAIL_FROM="Ezzy <no-reply@ezzy.ph>"`
- [x] ✅ Override kept ON (`NOTIFICATION_EMAIL_OVERRIDE_TO=<test inbox>`)
- [x] ✅ Vault secrets set (`edge_function_base_url`, `notification_email_secret`)

## Phase C — Auth / password-recovery emails on hosted  🔄 C1 done; C2 pending app deploy
- [x] ✅ **C1** Auth → SMTP configured (`smtp.resend.com`, `587`, user `resend`, sender `no-reply@ezzy.ph`)
- [ ] ⬜ **C2** Auth → URL Configuration: Site URL + redirect allow-list with the deployed app URLs *(blocked on deploying the apps)*
- [ ] ⬜ (Optional) brand the recovery email template.

## Phase D — Verify, then go fully live  🔄 notification verified; rest pending
- [x] ✅ **Notification test** — inserted a notification on hosted → email delivered to the override inbox, `notification_emails` row `sent` + `provider_message_id` (2026-07-03)
- [ ] ⬜ **Recovery test** — request a reset in each deployed app → real email → reset *(blocked on app deploy + C2)*
- [x] ✅ Used `net._http_response` for diagnosis (caught the "API key invalid" → fixed the Resend key)
- [ ] ⬜ **Flip off the override so real recipients get mail:** `supabase secrets unset NOTIFICATION_EMAIL_OVERRIDE_TO` *(prod only; keep ON for staging)*
- [ ] ⬜ Confirm the per-portal kill-switch on hosted (toggle a portal off in Command UI, or `update notification_email_settings set is_email_enabled=false where portal='vendor'`).

---

## If you recreate the Supabase project (free-trial → new project)
The **code and migrations don't change** — only hosted config, keyed to the new ref. Redo:
1. `supabase link --project-ref <NEW_REF>`
2. `supabase db push` (all migrations apply fresh on the new project)
3. `supabase functions deploy send-notification-email --no-verify-jwt`
4. `supabase secrets set …` (same function secrets)
5. Vault: `edge_function_base_url = https://<NEW_REF>.supabase.co` (+ `notification_email_secret`)
6. Auth → SMTP + URL config again (Phase C)
7. Re-run Phase D tests
> Resend domain (`ezzy.ph`) and its DNS **do not** change — they're account/domain-scoped, not tied to the Supabase project.
