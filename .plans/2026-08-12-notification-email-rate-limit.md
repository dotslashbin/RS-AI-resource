# Notification email — Resend rate limit drops sends

**Date:** 2026-08-12
**App / scope:** `backbone/` — the notification-email dispatch path only.
**Status:** DRAFT — not started. Investigation is done; the fix approach is an open decision.

> One vendor registration fires 11 emails at once. Resend accepts 10 per second,
> so the eleventh is refused and thrown away. Nothing retries it. Optimise for
> **losing no email**, without changing which notifications exist.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local.

---

## Read this first (written for a cold session)

You will not need to re-derive any of this. The chain, in order:

1. Something inserts a row into `public.notifications`.
2. **Trigger** `dispatch_notification_email()` fires **AFTER INSERT, per row**.
   Defined in `backbone/supabase/migrations/20260624000003_notification_email_dispatch.sql`.
   It reads `edge_function_base_url` + `notification_email_secret` from Vault and
   calls `net.http_post(...)` — **fire-and-forget, one HTTP request per
   notification, no batching and no coordination between them.**
3. **Edge Function** `backbone/supabase/functions/send-notification-email/`
   receives `{ notification_id }`, authenticates on the `x-webhook-secret` header
   (`index.ts:23-26`; `verify_jwt = false` in `config.toml:387`), then runs
   `handler.ts`.
4. `handler.ts:48-58` — **claim-first idempotency**, then
   `lib/emailSender.ts` sends via **Resend** (`deps.ts:5` → `npm:resend@4`).
5. The outcome is written to `public.notification_emails`.

**Where it breaks:** step 2 fires N requests simultaneously; Resend caps at 10/sec;
the surplus comes back `429` and step 5 records `failed`. Nothing retries.

**Nothing is wrong with the code that exists** — this is a missing behaviour, not a
defect in what is written.

---

## The evidence (measured 2026-08-12)

A real vendor registration was driven end-to-end while verifying B3 of
`.plans/2026-08-10-vendor-division-url-param.md`. It produced **11** emails:

```
 status | type                         | recipient
 sent   | vendor_registration_received | (the applicant)
 sent   | new_user_registration        | marco@bookdeck.com
 sent   | new_user_registration        | gab@bookdeck.com
 sent   | vendor_pending_approval      | marco@bookdeck.com
 sent   | vendor_pending_approval      | clara@bookdeck.com
 sent   | new_user_registration        | clara@bookdeck.com
 sent   | vendor_pending_approval      | jun@bookdeck.com
 sent   | new_user_registration        | root@bookdeck.com
 sent   | vendor_pending_approval      | root@bookdeck.com
 sent   | vendor_pending_approval      | gab@bookdeck.com
 failed | new_user_registration        | jun@bookdeck.com
        |   "Too many requests. You can only make 10 requests per second."
```

**The fan-out is `(command admins × 2) + 1`.** There are currently **5** command
admins, giving 11 — already one over the cap. Each admin added costs two more.

---

## Findings

| # | Finding | Location |
|---|---|---|
| F1 | The dispatch is **per-row and fire-and-forget**. `net.http_post` is called once per notification with no scheduling, so N notifications inserted in one transaction become N near-simultaneous HTTP requests. | `dispatch_notification_email()`; migration `20260624000003` |
| F2 | **Only the EMAIL is lost — the in-app notification is unaffected.** Verified directly: `jun@bookdeck.com` holds BOTH notification rows, unread, while only one of the two emails is `failed`. The `notifications` row is written by the app; the email is a separate downstream attempt. **No feature stops working; an admin misses one email nudge.** | measured 2026-08-12 |
| F3 | ⚠️ **A failed email CANNOT be retried by re-invoking the function.** `handler.ts:48-51` claims first: it inserts a `notification_emails` row (status `sending`) guarded by `unique(notification_id)` *before* sending. A second invocation loses that race and returns `"idempotent"` without sending. **Any retry must therefore happen INSIDE the original invocation**, between the claim and `log.complete` — or the idempotency design has to change too. This is the single most important constraint on the fix. | `handler.ts:48-58`, `lib/deliveryLog.ts:5,21,45` |
| F4 | The sender does not inspect the failure. `ResendEmailSender.send()` maps any error straight to `{ status: "failed" }` — a `429` (retryable, the provider is asking us to slow down) is treated identically to a permanent rejection like an invalid address. | `lib/emailSender.ts:13-24` |
| F5 | `resend@4` exposes a **batch send** API (`resend.batch.send([...])`), which would collapse many messages into one request. But the Edge Function is invoked with **one** `notification_id` and never sees the batch, so using it requires changing the dispatch strategy, not just the sender. | `deps.ts:5`; `index.ts` |
| F6 | Which message is dropped is **arbitrary** — ordering is not guaranteed. On this run it was `new_user_registration`; on another it could be the applicant's acknowledgement, recreating the symptom of that plan's B3 through a different route. | F1 |
| F7 | The loss is **silent**. There is no alert, retry queue, or dashboard — only a `failed` row in `notification_emails` that nothing reads. The 10 pre-existing `failed` rows from an invalid API key sat unnoticed from 2026-08-09 to 2026-08-12. | `notification_emails` |

---

## BLOCKERS

### B1 — A 429 is treated as a permanent failure  ⬜ TODO
**File:** `backbone/supabase/functions/send-notification-email/lib/emailSender.ts:13-24`

Resend replies `429` with "you can only make 10 requests per second" — an explicit
instruction to wait and retry. The sender discards that and records `failed`,
which is terminal (F3: nothing can re-invoke).

**Fix direction:** distinguish retryable from permanent inside `send()`, and retry
with backoff **within the same invocation**. Resend's 429 carries rate-limit
headers (`ratelimit-reset` / `retry-after`) worth honouring rather than guessing a
delay.

⚠️ Retrying *must* stay inside the invocation — see F3.

**Verification:** live; see Verification below.

---

## IMPORTANT

### I1 — Nothing surfaces a failed send  ⬜ TODO
**File:** `public.notification_emails`

Even with B1 fixed, some sends will fail permanently (bad address, provider
outage). Today that is invisible: a row is written and never read. F7 shows the
cost — ten failures went unnoticed for three days, and only surfaced because
someone went looking for an unrelated reason.

**Fix direction:** not designed. The cheapest useful thing is probably a Command
surface (a count of recent failures) rather than alerting infrastructure. Keep it
proportionate — this is an ops visibility gap, not an outage.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains. -->

- **OPEN: which fix shape for B1?** Three options, in increasing size:
  - **(a) Retry on 429 inside the sender** — smallest, respects F3 naturally, no
    change to dispatch or idempotency. Each invocation waits out its own 429.
    Risk: 11 concurrent invocations all retrying need jitter, or they collide
    again on the same second. **Recommended starting point.**
  - **(b) Throttle at dispatch** — pace the `net.http_post` calls. Hard: pg_net is
    fire-and-forget and the trigger is per-row, so there is nowhere natural to
    hold a queue without adding one.
  - **(c) Batch via `resend.batch.send`** — one request for many messages, which
    removes the problem rather than absorbing it. Requires collecting notifications
    before dispatch (queue table + cron, or a statement-level trigger), plus
    rethinking the per-notification claim in F3. Biggest change, best endpoint.

  Recommendation: **(a)** now, and record (c) as the direction if the fan-out grows
  much beyond a few dozen. Do not do (b).

---

## Verification

**Reproduce the failure first** — do not fix what you have not seen:

1. Ensure ≥5 command admins exist (currently 5 — the fan-out is `admins × 2 + 1`).
2. Start the local Edge Function with a working Resend key:
   ```
   cd backbone
   npx supabase functions serve send-notification-email \
     --env-file supabase/functions/send-notification-email/.env
   ```
3. Register a vendor through the real flow (`prepare` → signed upload → `register`).
   A working script for this was written on 2026-08-12; the payload contract is in
   `vendor/services/kyc.service.ts:126-183`.
4. Read the result:
   ```sql
   select ne.status, n.type, ne.recipient_email, ne.error
   from public.notification_emails ne
   join public.notifications n on n.id = ne.notification_id
   where ne.attempted_at > now() - interval '10 minutes'
   order by ne.attempted_at;
   ```
   Expect at least one `failed` with the 429 message.

**After the fix:** the same run produces **zero** `failed` rows, and every admin
receives both emails.

**Gotchas that will otherwise waste time:**
- `NOTIFICATION_EMAIL_OVERRIDE_TO` in the function's `.env` redirects **all** mail
  to one inbox. `notification_emails.recipient_email` still logs the *intended*
  recipient, so the table reads correctly even though delivery went elsewhere.
- `NOTIFICATION_EMAIL_SECRET` in that `.env` must match the Vault secret
  `notification_email_secret`, or every dispatch 401s and looks like a different bug.
- Remember to delete the test vendor and auth user afterwards.

---

## Context / provenance

- Discovered while closing **B3** of
  `.plans/2026-08-10-vendor-division-url-param.md` on 2026-08-12 — that plan is
  now COMPLETE and this was recorded there as **N1** before being split out here.
- The same session established that PostgREST's own 1000-row cap silently
  truncates queries across all apps (three plans, all complete). **Same family of
  bug: a limit the platform enforces, that the client neither honours nor
  reports.** Worth keeping in mind — it is the second time this codebase has lost
  data to an unread response from a service that said "too much".
