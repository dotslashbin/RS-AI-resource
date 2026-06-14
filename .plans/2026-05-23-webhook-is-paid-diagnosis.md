# Webhook Diagnosis: `is_paid` Not Updating After PayMongo Payment

## Status

Parked — to be executed later.

---

## Findings

### App code — no issues
- No `middleware.ts` → `/api/payment/webhook` is fully public (unprotected)
- `next.config.ts` is vanilla — no rewrites or restrictions on API routes
- Route file exists and is correctly structured at `learner/app/api/payment/webhook/route.ts`
- `metadata: { booking_id: bookingId }` is correctly sent in `create-session/route.ts` line 28
- `PAYMONGO_WEBHOOK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are present in `.env.local`

### Root cause: PayMongo cannot reach localhost

`NEXT_PUBLIC_APP_URL=http://localhost:3000`. PayMongo is an **external service** — it cannot call `localhost:3000`. Unless **ngrok** is running and its tunnel URL is registered as a webhook in the PayMongo dashboard, PayMongo never sends the POST. `is_paid` stays `false` not because the handler is broken, but because it is never called.

### Secondary issue: silent failures

The webhook returns `{ received: true }` regardless of outcome. No logging exists, so there is no way to see from server output whether the webhook is received, the signature passes, or the DB update succeeds.

---

## Fix Plan

### 1. Add logging to the webhook route

File: `learner/app/api/payment/webhook/route.ts`

Add `console.log` / `console.error` at:
- Signature failure: log the rejection reason
- After parsing: log the event type and extracted `booking_id`
- After `supabase.update()`: log error if it fails
- Unhandled event types: log so they are visible in console

### 2. ngrok setup (no code change — operational steps)

Already documented in `architecture/booking-flow.md` → "Webhook Local Testing":

1. `ngrok http 3000` in a separate terminal
2. Copy the HTTPS URL (e.g. `https://abc123.ngrok-free.app`)
3. PayMongo Dashboard → Developers → Webhooks → add `https://<ngrok-url>/api/payment/webhook`
4. Copy the generated signing secret → `PAYMONGO_WEBHOOK_SECRET` in `learner/.env.local`
5. Restart dev server so the new env var is loaded

**Important:** `PAYMONGO_WEBHOOK_SECRET` must match the secret shown in PayMongo for that specific webhook entry. The current value in `.env.local` (`whsk_qdZeZPPvjSXShP8MR9Py6Run`) was from a previous registration — if that entry no longer exists or points to a stale URL, the secret needs to be refreshed.

---

## File to Change

| File | Change |
|------|--------|
| `learner/app/api/payment/webhook/route.ts` | Add logging at: signature fail, parsed event type + booking_id, supabase update result |

---

## Verification

1. `npm run dev` in `./learner`
2. `ngrok http 3000` → copy HTTPS URL
3. Register in PayMongo dashboard; copy signing secret → `.env.local`; restart dev server
4. Complete a test payment with card `4343 4343 4343 4345`
5. Watch Next.js console — log lines from webhook handler should appear
6. Check `bookings` table — `is_paid` should flip to `true`
