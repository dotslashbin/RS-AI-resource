# Production environment variables — a checklist written from real failures

**Date:** 2026-09-05
**Applies to:** `vendor`, `booker`, `command` on Vercel, per environment.

> Every warning here corresponds to a fault that actually happened during the kiosk
> rollout (`.plans/2026-08-26-vendor-kiosk-mode-and-offering-attachments.md`). None is
> hypothetical. The variables are read from source, not remembered.

---

## The pattern that caused most of the pain

**A missing or wrong environment variable on a hosted deploy presents as a generic
application failure, never as a configuration error.** It happened five times:

| Variable | How it presented |
|---|---|
| `PAYMONGO_SECRET_KEY` (unset on staging-vendor) | "booking made but payment could not start" |
| `PAYMONGO_WEBHOOK_SECRET` (empty / mis-scoped / cached build) | `500 {"error":"Webhook not configured"}` |
| `NEXT_PUBLIC_APP_URL` | would have redirected a paying customer to `localhost` |
| PayMongo keys differing between apps | webhook never fired at all |
| Webhook registered in **live** mode | webhook never fired at all |

⚠️ **The diagnostic that works is not reading application code.** It is:
*"Which variables does this route read, and is each one set — with the right value — on the
environment this domain actually serves?"*

---

## Who needs what

| Variable | vendor | booker | command | Type |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ | config |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ | config |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ✅ | 🔒 **secret** |
| `NEXT_PUBLIC_APP_URL` | ✅ | ✅ | ✅ | config |
| `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_APP_DOMAIN` | ✅ | ✅ | ✅ | config |
| `PAYOUT_ENCRYPTION_KEY` | ✅ | — | ✅ | 🔒 **secret** |
| `PAYMONGO_SECRET_KEY` | ✅ | ✅ | — | 🔒 **secret** |
| `PAYMONGO_WEBHOOK_SECRET` | ❌ **never** | ✅ | — | 🔒 **secret** |
| `PORTAL_URL_VENDOR` / `_BOOKER` / `_COMMAND` | — | — | ✅ | config |

Optional, decide deliberately: `ALLOW_INDEXING` (`"1"` allows robots — **leave unset on
staging**), `CSP_REPORT_ONLY`, `NEXT_SHOW_VERSION`, `NEXT_PUBLIC_APP_VERSION`.
Vercel supplies `VERCEL`, `VERCEL_PROJECT_PRODUCTION_URL`, `NODE_ENV`. `PW_TEST` is
Playwright-only.

---

## Per-variable warnings, each from a real failure

### `SUPABASE_SERVICE_ROLE_KEY` — not the publishable key
Supabase shows both under "API keys". **Publishable/anon** is public and RLS-bound;
**service_role / Secret key** bypasses RLS and is what server writes need. Using the
publishable one gives `42501 permission denied for table bookings` — and booker's webhook
would answer `200` regardless, leaving a **paid booking silently unpaid**.
Sanity check: a service-role JWT decodes with `"role":"service_role"`.

### `PAYMONGO_SECRET_KEY` — same account on BOTH apps
`vendor` and `booker` each create Checkout Sessions. **PayMongo scopes webhooks to the
account**, so a session created with vendor's key emits on vendor's account. If the two
apps hold keys from *different* accounts, the webhook listens where nothing fires — no
delivery, no log, no retry, payment still taken. Compare the two values, not just the
`sk_test_` / `sk_live_` prefix: a same-mode, different-account split looks identical to a
correct setup.

### `PAYMONGO_WEBHOOK_SECRET` — booker only, and from the right mode
Vendor has no webhook endpoint; adding it there is a credential with no consumer (B22).
**Test and live are separate registrations with separate secrets.** A live-mode webhook
never fires for `sk_test_` payments.
⚠️ `!secret` is true for an **empty string** too, so a blank value, a mis-scoped Vercel
environment, and a redeploy that reused a cached build all present identically. Verify by
probe, not by looking at the dashboard:
```bash
curl -s -X POST https://<booker-host>/api/payment/webhook
# want {"error":"Invalid signature"} (400) — 500 means the secret has not landed
```

### `NEXT_PUBLIC_APP_URL` — scheme, no trailing slash, Config not Secret
Builds PayMongo's `success_url`/`cancel_url`. A bare hostname (`vendor.ezzy.ph`) fails:
`new URL()` throws and the payment URL is not absolute. Use `https://vendor.ezzy.ph`.
**Config, not Secret** — a `NEXT_PUBLIC_` value is inlined into the browser bundle whatever
Vercel labels it, so "Secret" promises a protection it cannot deliver.
Each app gets **its own** origin — booker's is booker's, not vendor's.

### `PAYOUT_ENCRYPTION_KEY` — identical across vendor AND command
One key per Supabase project, **byte-identical** in both apps; local/staging/production each
get their own. Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
⚠️ **Losing it is unrecoverable** — every stored payout destination becomes permanently
unreadable. Set it in Vercel, **never** in Supabase: storing it there hands a database dump
both the ciphertext and the means to read it.

---

## Verify after every deploy, by probe

Configuration is only real once measured on the deployed host.

```bash
H=https://<host>

# App URL landed (should print the host, and never localhost)
curl -s $H/ | grep -oE 'https://[a-z0-9.-]+\.ezzy\.ph' | sort -u
curl -s $H/ | grep -c localhost:3000        # want 0

# CSP points at the right Supabase project
curl -sI $H/ | grep -io "connect-src[^;]*"

# Payment route authenticates before anything else
curl -s -o /dev/null -w '%{http_code}\n' -X POST $H/api/kiosk/payment/create-session   # 401

# booker only — webhook secret landed
curl -s -X POST $H/api/payment/webhook       # {"error":"Invalid signature"}
```

**Then the only test that counts:** book, pay, and confirm `is_paid` became `true`. Reaching
PayMongo's checkout page and being *marked paid* are different milestones — the second one
failed silently for months.

---

## Production order (also `.plans/…kiosk…` B34)

1. Deploy **booker** → production; repoint `booker.ezzy.ph` at the production project
2. Confirm, **then** set `PORTAL_URL_BOOKER` in production Command — *this order*, or
   booker-only users get a set-password email whose token cannot validate
   (`auth-and-roles.md`)
3. Register the **live-mode** webhook → `https://booker.ezzy.ph/api/payment/webhook`,
   event `checkout_session.payment.paid`
4. Copy its secret **immediately** (shown once) → `PAYMONGO_WEBHOOK_SECRET` on booker
   production → **redeploy**
5. Set the live `PAYMONGO_SECRET_KEY` on **both** vendor and booker — same account
6. **Then** deploy the vendor kiosk build

⚠️ **There is no feature flag.** The kiosk goes live the moment the vendor build reaches
production, so this order is the only control over launch timing.
⚠️ **Delete any stale webhook registrations.** A test-mode webhook left pointing at a
staging host becomes a live endpoint the day you switch keys.
