# PayMongo Payment Integration — RS Learner

**Date:** 2026-05-16
**Scope:** `./learner` (primary) · `./backbone` (one migration — needs approval gate)
**Status:** Plan only — not yet executed

---

## Research Summary

### PayMongo API Basics

| Item | Detail |
|------|--------|
| Base URL | `https://api.paymongo.com/v1/` |
| Auth | HTTP Basic Auth — Base64-encode the key as the username, empty password |
| Public key | `pk_test_...` — safe for client-side |
| Secret key | `sk_test_...` — server-side only, never in `NEXT_PUBLIC_` |
| Currency | PHP only; amounts in **centavos** (₱850 → `85000`) |
| Sandbox | Uses `_test_` keys; no real money moves |

### Recommended Approach: Checkout Sessions

PayMongo offers three payment workflows. **Checkout Sessions** is the right choice for this app:

| Workflow | Best for | UI required |
|----------|---------|-------------|
| Payment Intent + Method | Cards only, custom card form | Build your own card fields |
| Sources | GCash/GrabPay legacy | Popup window, polling |
| **Checkout Session** | **All methods, hosted page** | **None — PayMongo hosts it** |

Checkout Session supports: **Card, GCash, GrabPay, Maya, BillEase, QRPh, online banking** — in one hosted page with no payment UI to build.

### Checkout Session Flow

```
1. User clicks "Pay Now" in Step 5
2. Server: POST /v1/checkout_sessions
        → { checkout_url, session_id }
3. Browser redirects to checkout_url (PayMongo-hosted page)
4. User picks payment method, completes payment
5. PayMongo redirects to success_url or cancel_url
6. App reads query params on return, shows result
7. Webhook fires payment.paid (server-side, authoritative)
```

### Webhook Events

| Event | Meaning |
|-------|---------|
| `payment.paid` | Payment successful — authoritative source of truth |
| `payment.failed` | Payment declined |
| `checkout_session.payment.paid` | Checkout session payment succeeded |

Webhook endpoint must be a publicly reachable URL. For local dev, use **ngrok** to expose `localhost:3000`.

---

## Architecture Decisions

### Booking Status Flow (Revised)

Current triggers allow: `pending → confirmed|cancelled`. The payment integration does **not** change this — the academy still controls `confirmed`. Instead, we track payment separately:

- Booking is created with `status = "pending"` **before** redirect to PayMongo
- A `payment_reference` column stores the Checkout Session ID
- On `payment.paid` webhook: mark the booking's `payment_reference` as verified (or add a boolean `is_paid`)
- Academy sees bookings as before; they confirm after seeing payment status

This avoids changing the status state machine.

### SPA Return URL Handling

The learner app uses internal page routing (no real subdirectory routes). After PayMongo redirects back, the page is a fresh load at `/`. We handle this in `app/page.tsx` by reading URL query params and passing them into the AppShell to show the appropriate state.

---

## Schema Change (Needs Approval Before Execution)

**File:** `backbone/supabase/migrations/20260516000007_booking_payment_reference.sql`

```sql
alter table public.bookings
  add column payment_reference text,        -- PayMongo checkout_session id
  add column is_paid            boolean not null default false;
```

`payment_reference` is nullable (no payment for cash-on-site bookings in future). `is_paid` is the authoritative payment flag, set by the webhook handler via service role.

RLS: no change needed — existing policies cover the new columns.

---

## Environment Variables

Add to `learner/.env.local` (never commit):

```
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=pk_test_...
PAYMONGO_SECRET_KEY=sk_test_...
PAYMONGO_WEBHOOK_SECRET=whsk_...
```

The webhook secret is generated when you register the webhook endpoint via the PayMongo dashboard or API.

---

## Files to Create / Modify

### New Files

| File | Purpose |
|------|---------|
| `learner/app/api/payment/create-session/route.ts` | Server route — creates PayMongo Checkout Session |
| `learner/app/api/payment/webhook/route.ts` | Webhook handler — verifies signature, marks `is_paid = true` |
| `backbone/supabase/migrations/20260516000007_booking_payment_reference.sql` | Adds `payment_reference`, `is_paid` to `bookings` |

### Modified Files

| File | Change |
|------|--------|
| `learner/components/booking/BookingWizard/useBookingWizard.ts` | `confirmBooking` — create booking, call create-session, redirect |
| `learner/components/booking/BookingWizard/Step6Confirm/Step6Confirm.tsx` | Button label "Pay Now"; loading state during redirect |
| `learner/app/page.tsx` | Read `?payment=success&booking_id=` on load, pass to AppShell |
| `learner/components/layout/AppShell/useAppShell.ts` | Accept and handle payment return params |
| `learner/lib/types.ts` | Add `isPaymentPaid?: boolean` to `Booking` if surfaced in UI |

---

## Detailed Implementation

### `app/api/payment/create-session/route.ts`

```ts
// POST body: { bookingId, amountCentavos, description }
// Uses PAYMONGO_SECRET_KEY (server-only)
// Calls POST https://api.paymongo.com/v1/checkout_sessions
// success_url: process.env.NEXT_PUBLIC_APP_URL + "/?payment=success&booking_id=" + bookingId
// cancel_url:  process.env.NEXT_PUBLIC_APP_URL + "/?payment=cancel&booking_id=" + bookingId
// payment_method_types: ["card","gcash","grab_pay","paymaya","billease","qrph"]
// Returns: { checkout_url, session_id }
// Also updates bookings.payment_reference = session_id via service role client
```

### `app/api/payment/webhook/route.ts`

```ts
// Receives POST from PayMongo
// Verifies signature using PAYMONGO_WEBHOOK_SECRET
// Handles event type: "payment.paid" or "checkout_session.payment.paid"
// Extracts booking_id from metadata or payment description
// Updates bookings SET is_paid = true WHERE id = booking_id (service role)
// Returns 200 OK
```

### `useBookingWizard.ts` — `confirmBooking` (revised)

```ts
async function confirmBooking() {
  // 1. Guard check (existing)
  // 2. Create booking in DB → get dbId
  if (result !== "ok") { toast.error(...); return }
  // 3. Call /api/payment/create-session
  const res = await fetch("/api/payment/create-session", {
    method: "POST",
    body: JSON.stringify({
      bookingId: dbId,
      amountCentavos: Math.round(exam.price * 100),
      description: `RS Learner — ${exam.name} at ${school.name}`,
    })
  })
  const { checkout_url } = await res.json()
  // 4. Redirect to PayMongo
  window.location.href = checkout_url
  // Note: onBookingConfirmed is NOT called here — called on payment return
}
```

### `app/page.tsx` — payment return handling

On mount, read `?payment` and `?booking_id` from `window.location.search`. Pass to AppShell. AppShell shows a "Payment confirmed" or "Payment cancelled" state instead of the normal booking wizard post-confirm screen.

---

## Sandbox Testing

PayMongo sandbox test cards:
- Success: `4343 4343 4343 4345` — any future expiry, any CVV
- Decline: `4571 7360 1000 0309`
- GCash: Use sandbox GCash test flow (auto-approves in sandbox)

Webhook local testing:
1. `ngrok http 3000` → copy HTTPS URL
2. Register webhook: `POST https://api.paymongo.com/v1/webhooks` with `{ url: "https://xxx.ngrok.io/api/payment/webhook", events: ["payment.paid","payment.failed"] }`
3. Save the returned `secret_key` as `PAYMONGO_WEBHOOK_SECRET`

---

## Verification Checklist

- [ ] Checkout Session created with correct amount (centavos)
- [ ] Redirect to PayMongo checkout page works
- [ ] Sandbox card payment completes → redirects to `/?payment=success`
- [ ] `is_paid = true` set on booking after success
- [ ] `payment_reference` column populated with session ID
- [ ] Webhook fires and updates DB independently of browser redirect
- [ ] GCash sandbox flow works
- [ ] Cancel flow: redirects to `/?payment=cancel`, booking cleaned up or left pending
- [ ] `PAYMONGO_SECRET_KEY` never appears in client bundle (`NEXT_PUBLIC_`)
- [ ] `tsc --noEmit` passes in `./learner`

---

## Open Questions / Deferred

| Item | Note |
|------|------|
| Cancel behaviour | Currently bookings created before redirect stay `pending` if user cancels. Options: delete them, or leave as pending and let the learner retry. Decision needed. |
| `NEXT_PUBLIC_APP_URL` | Needs to be set in `.env.local` for success/cancel URL construction |
| Webhook in production | Must register with deployed URL; each environment needs its own webhook |
| `is_paid` surfaced in academy UI | Academy currently sees only `status`. May want to show a payment badge — deferred |
