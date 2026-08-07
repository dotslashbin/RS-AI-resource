# Booking Flow

The booking wizard is the core user-facing feature of the Ezzy (booker) portal. It is a 6-step guided flow that takes a booker from choosing a service through payment to a confirmed booking in Supabase.

---

## Flow Overview

```
Step 1: Choose Offering
    ↓ sets offering (DbOffering)
Step 2: Choose Vendor
    ↓ sets vendor (BookerVendor), branch (address string)
Step 3: Pick Schedule
    ↓ sets date (YYYY-MM-DD), time (HH:MM), selectedSchedule (BookerSchedule)
Step 4: Upload Documents
    ↓ sets uploads (Record<id, {name, size}>)
Step 5: Confirm & Book
    ↓ review screen — no DB writes yet
Step 6: Payment
    ↓ writes booking to Supabase → creates PayMongo Checkout Session → redirects to PayMongo
    ↓ on return: /?payment=success → toast + dashboard; /?payment=cancel → toast (booking stays pending)
```

---

## State Management

All wizard state lives in `useBookingWizard.ts` (a custom hook in `./booker/components/booking/BookingWizard/`). The hook owns all state, fetching, and side effects. `BookingWizard.tsx` is a pure render layer that calls the hook and passes state down to step components as props.

**Key state fields:**

| Field | Type | Set at |
|-------|------|--------|
| `step` | `number` | Navigation buttons |
| `offering` | `DbOffering \| null` | Step 1 selection |
| `vendor` | `BookerVendor \| null` | Step 2 selection |
| `branch` | `string \| null` | Step 2 (set to `vendor.address`) |
| `date` | `string` | Step 3 calendar pick (format: `YYYY-MM-DD`) |
| `time` | `string` | Step 3 time slot pick (format: `HH:MM`) |
| `selectedSchedule` | `BookerSchedule \| null` | Resolved when time is picked |
| `uploads` | `Record<string, UploadEntry>` | Step 4 file picks |
| `offerings` | `DbOffering[]` | Fetched on mount |
| `vendors` | `BookerVendor[]` | Fetched when `offering` changes |
| `schedules` | `BookerSchedule[]` | Fetched when `vendor` + `offering` change |

**Why `selectedSchedule` is separate from `time`:** `time` is a display/filter string. `selectedSchedule` holds the actual `BookerSchedule` record including its UUID — needed to write `schedule_id` to the `bookings` table. It is resolved by `resolveScheduleForTime(schedules, date, time)` when the booker picks a time slot.

---

## Step 1 — Choose Offering

**Component:** `Step1Offering/Step1Offering.tsx`  
**Service:** `services/offerings.service.ts` → `getActiveOfferings()`

Fetches all `is_active = true` offerings from Supabase, reading the free-text `category` column. Deduplicated by `code` client-side — if multiple vendors offer the same code, Step 1 shows it once with the lowest available price shown as "from ₱X".

**Deduplication:** `dedupeByCode()` in the hook returns both the deduplicated list and a `multiPriceCodes: Set<string>` — codes where more than one price exists. `Step1Offering` uses this set to decide whether to prefix the price with "from".

**Category styling:** `category` is vendor-defined free text. The UI applies a small fixed colour map for a few known values with a neutral fallback for anything custom — there is no fixed category set.

**`canNext`:** `!!offering`

---

## Step 2 — Choose Vendor

**Component:** `Step2Vendor/Step2Vendor.tsx`  
**Service:** `services/vendors.service.ts` → `getVendorsForOffering(offeringCode)`

Fetches vendors that have an active offering matching the selected `code`. Uses a PostgREST `!inner` join through the `offerings` table to filter, then deduplicates by vendor `id` and filters to only `status = 'active'` vendors. Each result is a `BookerVendor` (id, name, address, branch, phone).

**Map:** A Leaflet tile map is shown as a location placeholder. It displays the user's geolocation dot if the browser grants location permission. The map does not show vendor markers — vendor coordinates (`lat`, `lng`) do not yet exist in the DB schema. This is deferred.

**RLS dependency:** A migration (`20260515000001_booker_vendor_read_policy.sql`) grants active bookers read access to active vendors. Without this, the query returns zero rows.

**Selecting a vendor** sets both `vendor` (the full `BookerVendor` object) and `branch` (set to `vendor.address` as a display string). This also triggers the schedules fetch.

**`canNext`:** `!!vendor && !!branch`

**Future:** Once `lat`/`lng` columns are added to `vendors`, vendor markers can be placed on the map and used for proximity sorting.

---

## Step 3 — Pick Schedule

**Component:** `Step3Schedule/Step3Schedule.tsx`  
**Service:** `services/schedules.service.ts` → `getSchedulesForVendor(vendorId, offeringCode)`

Fetches all active schedules for the selected vendor that belong to an offering with the matching code. Returns `BookerSchedule[]` with: `id`, `startDate`, `endDate`, `startTime`/`endTime` (HH:MM, **nullable** — NULL for date-granular offerings), `daysOfWeek` (DB encoding: 0=Mon..6=Sun), `recurrence`, `capacityPerSlot`, and `durationMinutes`/`durationUnit` **per schedule** (see I10 under Step 3).

### Calendar

The calendar shows the current month and allows navigation forward/backward. The
week **starts on Sunday** (2026-08), matching the vendor portal — `WDAYS` carries
`{label, dbDow}` so display order and the DB's `0=Mon..6=Sun` encoding stay
independent. See `conventions.md` → "Display order is never database data".

⚠️ **`getMondayOfWeek` must stay Monday-based regardless of what the header shows.**
It computes the reference week for **biweekly parity**, not display — changing it to
follow the Sunday-first header would shift which weeks a biweekly schedule runs on.
Its name invites exactly that mistake. For each day, it calls `getAvailableDaysInMonth(schedules, year, month)` to determine which days have schedule occurrences. Available days show a green dot.

### Recurrence Expansion

Occurrence dates are computed client-side from each schedule's recurrence rule:

| Recurrence | Expansion logic |
|-----------|----------------|
| `none` | Single occurrence on `start_date` only |
| `weekly` | Every week on the days in `days_of_week`, from `start_date` onwards |
| `biweekly` | Every other week, using the Monday of `start_date`'s week as the reference. A candidate date is an occurrence if its week is an even number of weeks from the reference week |
| `monthly` | The same day-of-week in the same week-of-month as `start_date` (e.g., if `start_date` is the 2nd Tuesday of the month, occurrences are the 2nd Tuesday of every subsequent month) |

**Day-of-week encoding difference:** DB stores 0=Mon..6=Sun. JavaScript `Date.getDay()` returns 0=Sun..6=Sat. The helper `dbDowToJs(d) = (d + 1) % 7` converts between them.

### Time Slots — derived, not stored (2026-08)

`getSlotsForDate(schedules, dateStr)` divides each occurring schedule's **window** by
that schedule's own `duration_minutes` and returns every resulting unit.

> **This is the change that made the booker show reality.** It previously returned the
> distinct `start_time` values of the *schedules* on that date — one entry per schedule,
> not per unit — so a single 09:00–17:00 schedule offered exactly **one** button no
> matter how long the offering was.

Each slot renders as **start–end with a per-slot "N left"**. `endTime` and capacity were
fetched and discarded before this; nothing showed a booker how long a booking was or
whether it was nearly full.

**Quantity.** Once more than one unit fits, a quantity control appears and the booking
spans consecutive slots. A start slot is selectable only if **every** slot the quantity
would cover has room — `spanAvailable()` walks them all. Checking only the first slot is
the tempting wrong implementation: the database checks the worst-case slot, so the UI
would offer a span that is refused at the final step.

**Occupancy** comes from a count query keyed by overlap, not equality — an existing
2-unit booking occupies its second slot too. It is fetched asynchronously, and until it
lands every slot reads as available: the DB refuses an overbooking regardless, whereas
greying out a free slot on a slow network would block a legitimate booking.

**Duration is read per schedule, not from the Step 1 card.** `getSchedulesForVendor()`
selects `duration_minutes`/`duration_unit` through the `!inner` join it already had. Two
vendors can share an offering code with *different* durations, and the deduped card
keeps only the cheapest — deriving the grid from it would draw boundaries the trigger
then rejects.

### Date-granular offerings

An offering measured in `day`/`week`/`month` has no time of day at all. `isOccurrence()`
short-circuits for these — recurrence and days-of-week do not apply, their availability
**is** the `start_date`–`end_date` range — and Step 3 shows a date range with no slot
grid. `getDateRange()` exposes the bookable span.

The two modes are chosen by `duration_unit`, never asked. Step 1 cards are deduped by
`(code, granularity)` so an hourly and a day-based `COURT` are separate cards and the
wizard can never open in the wrong mode.

**`canNext`:** `!!date && !!time`

~~**Future:** Capacity tracking~~ **Done (2026-08)** — each slot shows spaces remaining, counted by overlap per slot.

---

## Step 4 — Upload Documents

**Component:** `Step4Documents/Step4Documents.tsx`

Document requirements come directly from `offering.requirements` — the `RequirementItem[]` array fetched from the `offerings` table (JSONB column). Each item has an `id`, `label`, and `required` flag. Vendor admins define these in the offering form; different vendors or offerings can have different requirements for the same offering code.

Files are stored in React state as `{ name: string, size: number }` — no actual file content is stored or uploaded. The progress bar and "X of N required uploaded" counter are purely client-side.

**`canNext`:** All required documents (those with `required: true`) have an upload entry. Optional documents do not block progression. If an offering has no requirements, `canNext` is immediately true.

**Current limitation:** Nothing is written to Supabase Storage or the `booking_documents` table. Real uploads are a planned follow-up.

**Planned flow for real uploads:**
1. The booking is created first (Step 5 writes to `bookings`)
2. Files are uploaded to Supabase Storage under a path like `bookings/{booking_id}/{doc_id}`
3. `booking_documents` rows are written linking back to the booking
4. The booker portal needs a Storage policy allowing authenticated uploads under their booking's path

---

## Step 5 — Confirm & Book

**Component:** `Step6Confirm/Step6Confirm.tsx` (file name retained from original 6-step design)

Shows a summary of all selections: service name, vendor, branch/address, date and time (displayed in 12-hour format), uploaded document list, and total price. Review-only — no DB writes happen here.

**`canNext`:** Always `true`.

---

## Step 6 — Payment

**Component:** `StepPayment/StepPayment.tsx` (props: `{offering, vendor, date, time}`)

In-app this step is a summary screen only: it displays the booking summary (Service / Vendor / Date & Time / Total) and a "Secured by PayMongo" line — there is **no** in-app payment-method selector. Payment method is chosen later on PayMongo's hosted checkout page (see `confirmBooking()` below). The accepted methods (card, gcash, grab_pay, paymaya, billease, qrph) are server config, passed as `payment_method_types` when the Checkout Session is created in `app/api/payment/create-session/route.ts` — not an in-app choice.

**`canNext`:** `step === 6` (always true — nothing to select on this screen).

### `confirmBooking()`

The hook's `confirmBooking` is `async`. It:

1. Guards against missing state
2. Calls `createBooking()` → inserts into `public.bookings`:
   - `booker_id`: from auth session
   - `schedule_id`: from `selectedSchedule.id`
   - `vendor_id`: from `vendor.id`
   - `offering_id`: from `selectedSchedule.offeringId` (the vendor's offering UUID — must match the schedule's own `offering_id` to satisfy the DB consistency trigger)
   - `booked_date`: from `date` (YYYY-MM-DD)
   - `start_time`: the chosen slot, or `null` for a date-granular offering
   - `quantity`: how many units
   - `status`: `"pending"`
   - **`price_paid` is NOT sent.** The DB derives it as `offering.price × quantity`
     and pins it (`20260803000004`)
3. On `"already_booked"` / `"full"` / `"error"` — shows toast, aborts
4. Calls `POST /api/payment/create-session` with `{ bookingId }` (the client also sends legacy `amountCentavos`/`description`, but the **server ignores them**)
5. The route **authenticates the caller** (SSR cookie client → 401 if no session), fetches the booking with the service-role client (404 if missing), verifies `booking.booker_id === auth user` (403 otherwise), and **derives the amount from `booking.price_paid`** — never from the request body. It then creates the PayMongo Checkout Session, stores the session ID as `bookings.payment_reference`, and returns `checkout_url`. The line-item description is built server-side from the offering (`CODE — Name`).
6. Browser redirects to `checkout_url` (PayMongo's hosted payment page)

> **Security note:** the amount is authoritative from the DB, so a tampered client request cannot underpay; the route is not callable without an authenticated session that owns the booking. (Hardened 2026-06-12 — prod-readiness booker B1.)
>
> ⚠️ **That was only half true until 2026-08.** The *route* refused the request body, but
> the *row it trusted* was written by the client: `createBooking` sent `price_paid`
> straight from wizard state, and the `bookings` INSERT policy checks only
> `booker_id = auth.uid() and is_active()` — no column guard. A booker could insert
> `price_paid: 1` and pay ₱1 for an ₱850 booking, with `booking_transactions` recording
> ₱1 as the vendor's revenue. `20260803000004` makes `price_paid` trigger-derived, which
> closes it; the route needed no change, because the value it reads is now trustworthy.

### Payment return

PayMongo redirects to `/?payment=success&booking_id=xxx` or `/?payment=cancel&booking_id=xxx`. `useAppShell` reads these params on mount (after auth) and clears the URL with `history.replaceState`. On `success`, it **verifies the `booking_id` belongs to the current user** (RLS-scoped select) before showing the success toast — a spoofed/foreign id stays silent. The bookings list is reloaded from DB so the new booking appears on the dashboard.

Cancelled bookings remain in the DB as `status = "pending"` with no `payment_reference`.

### Live status updates after booking (2026-07)

Once a booking exists, its status keeps updating on the booker's dashboard **without a refresh** — a Realtime `postgres_changes` subscription on `bookings` (`event: "UPDATE"`, `filter: booker_id=eq.<uid>`) patches the status in place whenever the vendor confirms/rejects/cancels it. The payload carries only the flat `bookings` columns (no joins), so the handler patches the mutable `status` field onto the row already in state rather than re-mapping a full `Booking`; if the row isn't in local state (e.g. booked on another device after login) it falls back to a full `getBookings()` refetch. This shares the same realtime channel as in-app notifications (`useAppShell.ts`). The equivalent exists on the vendor side for incoming bookings + status/payment changes.

### Webhook

`POST /api/payment/webhook` — verifies PayMongo HMAC-SHA256 signature, handles `checkout_session.payment.paid`, sets `is_paid = true` on the booking via service role. This is the authoritative payment confirmation (independent of the browser redirect).

The `is_paid` write is **idempotent**: it updates `WHERE is_paid = false` and returns early if nothing transitioned, so a PayMongo retry/replay neither re-fires nor duplicates the `payment_confirmed` notification. A paid-type event arriving with no `booking_id` is logged (`console.warn`) rather than silently dropped.

**Env vars required:**
```
PAYMONGO_SECRET_KEY=sk_test_...        # server-only
PAYMONGO_WEBHOOK_SECRET=whsk_...       # server-only
NEXT_PUBLIC_APP_URL=https://...        # used for success/cancel redirect URLs
```

---

## Data Flow Diagram

```
Mount
  └─ getActiveOfferings() → offerings[]

Step 1: offering selected
  └─ getVendorsForOffering(offering.code) → vendors[]

Step 2: vendor selected
  └─ getSchedulesForVendor(vendor.id, offering.code) → schedules[]

Step 3: date selected
  └─ getAvailableDaysInMonth(schedules, year, month) → Set<number>
     date picked → getSlotsForDate(schedules, date) → SlotOption[]  (window ÷ duration)
                 → getSlotOccupancy(scheduleIds, date) → spaces left per slot
     time picked → resolveScheduleForTime(schedules, date, time) → selectedSchedule

Step 4: uploads[] managed in state (no DB writes)

Step 5: review only (no DB writes)

Step 6: confirmBooking()
  └─ createBooking({scheduleId, vendorId, offeringId, bookedDate, pricePaid})
       └─ INSERT INTO bookings → returns UUID
  └─ POST /api/payment/create-session → PayMongo Checkout Session
       └─ UPDATE bookings SET payment_reference = sessionId
  └─ window.location.href = checkout_url (leaves app)

On return (/?payment=success):
  └─ useAppShell reads params → toast → getBookings() reloads

Webhook (async, authoritative):
  └─ POST /api/payment/webhook
       └─ verify HMAC-SHA256 signature
       └─ UPDATE bookings SET is_paid = true WHERE id = booking_id
```

---

## Services Reference

| Service | Function | Returns |
|---------|----------|---------|
| `offerings.service.ts` | `getActiveOfferings()` | `DbOffering[]` |
| `vendors.service.ts` | `getVendorsForOffering(code)` | `BookerVendor[]` |
| `schedules.service.ts` | `getSchedulesForVendor(vendorId, code)` | `BookerSchedule[]` |
| `schedules.service.ts` | `getAvailableDaysInMonth(schedules, year, month)` | `Set<number>` |
| `schedules.service.ts` | `getSlotsForDate(schedules, dateStr)` | `SlotOption[]` — derived units, not one per schedule |
| `schedules.service.ts` | `getSlotOccupancy(scheduleIds, dateStr)` | `Map<string, number>` — overlap-keyed |
| `schedules.service.ts` | `remainingForSlot` / `spanAvailable` | spaces left; whether N units fit **in every covered slot** |
| `schedules.service.ts` | `getDateRange(schedules)` | `{from, to}` for date-granular offerings |
| `schedules.service.ts` | `resolveScheduleForTime(schedules, dateStr, time)` | `BookerSchedule \| null` |
| `bookings.service.ts` | `createBooking(params)` | `{ id: string \| null; result: CreateBookingResult }` — takes `startTime` + `quantity`; **no** `pricePaid` |
| `bookings.service.ts` | `getBookings()` | `Booking[]` (booker's own history, RLS-scoped) |
| `app/api/payment/create-session` | `POST` (server route) | Authenticates caller + verifies booking ownership; derives amount from `booking.price_paid`; creates PayMongo Checkout Session; stores `payment_reference` |
| `app/api/payment/webhook` | `POST` (server route) | Verifies signature; sets `is_paid = true` on payment confirmation |

---

## PayMongo Sandbox Testing

### Test Cards

All expiry dates must be in the future. Any 3-digit CVC works.

| Card Number | Network | Outcome |
|---|---|---|
| `4343 4343 4343 4345` | Visa | ✅ Success — no 3DS |
| `4571 7360 0000 0075` | Visa | ✅ Success — no 3DS |
| `5123 0000 0000 0002` | Mastercard | ✅ Success — no 3DS |
| `4120 0000 0000 0007` | Visa | ✅ Success — 3DS required (select "Authorize" on PayMongo's test page) |
| `5123 0000 0000 0001` | Mastercard | ✅ Success — 3DS optional |
| `4200 0000 0000 0018` | Visa | ❌ Decline — expired card |
| `4300 0000 0000 0017` | Visa | ❌ Decline — invalid CVC |
| `5100 0000 0000 0198` | Mastercard | ❌ Decline — insufficient funds |
| `4111 1111 1111 1111` | Visa | ❌ Generic decline |

### E-wallets (GCash, Maya, GrabPay, ShopeePay)

No real wallet account needed. PayMongo redirects to their own test page — click **"Authorize"** to succeed or **"Fail"** to decline.

### QR Ph

Do **not** scan the generated QR code in test mode — it processes real transactions. Use the `test_url` from the API response instead.

### Webhook Local Testing

1. Run `ngrok http 3000` and copy the HTTPS URL
2. Register the webhook in the PayMongo dashboard (Developers → Webhooks) pointing to `https://<ngrok-url>/api/payment/webhook`
3. Copy the generated signing secret into `PAYMONGO_WEBHOOK_SECRET` in `.env.local`

---

## Known Gaps and Future Work

| Area | Current state | Future |
|------|--------------|--------|
| Document uploads | In-memory only (no Storage writes) | Supabase Storage + `booking_documents` writes |
| Capacity display | No slot count shown to booker | Query booking counts per (schedule, date); show "Limited" warning |
| Vendor map | Tile + user dot only | Add `lat`/`lng` to `vendors`; show vendor markers |
| `confirmBooking` result handling | Only `id` used; `"already_booked"` / `"full"` show success screen | Check `result` in wizard and display appropriate error toast |
| Wallet / payment | Static info text | Wallet accounts table, deduction on confirm |
| Cancellation / reschedule | Dashboard "Reschedule" button is placeholder | Write cancellation flow, status updates |
| Contact info on confirmation | Not shown | Could surface from `schedules.contact_name` on the confirmation screen |
| ~~Duplicate booking check~~ | ~~None~~ | **Done** — DB `UNIQUE (booker_id, schedule_id, booked_date)` + service maps `23505` to `"already_booked"` |
| ~~Booking history from DB~~ | ~~Dashboard shows seed data~~ | **Done** — `getBookings()` fetches real rows; loaded on login |
| ~~Capacity overbooking~~ | ~~No DB enforcement~~ | **Done** — `check_booking_capacity()` BEFORE INSERT trigger, row-locked via `FOR UPDATE` on the schedule as of 2026-07-24 (closes a prior TOCTOU race under concurrent bookings for the last slot) |

---

## Fulfilment — establishing a completely fulfilled booking (2026-08-01)

Payment is not the end of a booking. A vendor is owed their payout only once
**both parties** agree the booking actually happened. Until 2026-08, `completed`
was unreachable — no app wrote it — and the vendor's payout total counted a
booking the moment they *accepted* it, before anything was delivered.

### Two shapes, not two businesses

`offerings.fulfilment_pattern` records **how a booking gets completed**, which is
a different axis from *what the business is*. Business taxonomy remains
`offerings.category` (vendor-defined free text) and the 13 `divisions`.

| Pattern | Flow | Fits |
|---|---|---|
| `session` | vendor marks done → booker confirms | exams, lessons, consults, treatments, callouts |
| `custody` | vendor hands over → booker returns → vendor confirms | vehicles, equipment, rooms, courts, bays |

Thirteen divisions collapse to two shapes, because a shape is defined by which
party can truthfully attest to which fact. The set is a **lookup table**
(`fulfilment_patterns`) so a third shape is a seed row plus a trigger branch —
but the state machine itself stays in code. Making it data-driven would let a bad
seed row release a vendor's own payout.

The pattern is **snapshotted onto `bookings`** at creation. Without that, a vendor
editing an offering mid-flight would strand every in-progress booking.

### What each party sees

| DB status | Vendor | Booker |
|---|---|---|
| `fulfilled` | "Awaiting customer" | **"Yes, all done"** |
| `in_progress` | "With customer" | **"I've returned it"** |
| `returned` | **"Got it back"** | "Awaiting vendor" |
| `disputed` | "On hold" | "On hold — Ezzy is reviewing" |

Labels come from `bookingActionCopy.ts` in each app — one table feeding the
button, its "i" popover, and the dashboard guide, so the wording that tells
someone *when money moves* cannot drift between the three.

### The money

`booking_transactions.payout_status` moves `held → releasable` only when a booking
reaches `completed`, and back to `held` if it is flagged. `released` is never
downgraded — money that has left really has left, so a refund after release
surfaces in Command's **Payouts → Owed back** rather than being papered over.

### Timers and escapes

- `fulfilled` and `returned` **auto-confirm after 3 days** (`auto_acknowledge_bookings()`,
  hourly via pg_cron). Without this, one unresponsive person freezes a vendor's
  money indefinitely.
- `in_progress` has **no timer** — see `schema.md`. Command's Overview lists stale
  ones and offers `admin_override_booking_status()`, which requires a reason.
- Either party can **flag** a booking (`raise_booking_dispute`). The payout freezes
  and only Command can resolve it (`resolve_booking_dispute`). There is no
  counterparty-response step and no self-service withdrawal — resolving back to
  `completed` covers a flag raised in error.

### Still missing

- **No refund mechanism.** PayMongo's refund API is never called. A cancelled or
  refunded booking stops the vendor being paid; returning the booker's money is
  entirely manual and untracked.
- **No payout rail.** "Mark as paid" records a transfer made elsewhere.
- **`ezzy-booker-mobile`** does not implement any of this. It is a scaffold with no
  app code, so a booker acknowledges on the web.

### Client coverage (updated 2026-08-02)

| Client | Fulfilment support |
|---|---|
| `vendor` (web) | ✅ Full — actions, undo, flag, payout gating |
| `booker` (web) | ✅ Full — acknowledgement, "I've returned it", flag |
| `command` (web) | ✅ Full — flag queue, payout release, admin override |
| **`ezzy-vendor-mobile`** | ✅ **Full vendor side** — hand over / mark as done / got it back / undo / flag, the payout-status-driven payable rule, all nine statuses, six lifecycle filters, and an auto-confirm countdown that respects the service-date gate. Shipped 2026-08-02 (`.plans/2026-08-02-vendor-mobile-fulfilment-sync.md`) |
| `ezzy-booker-mobile` | ❌ None — scaffold only |

> A previous note here said *"Mobile apps do not implement any of this yet; their
> status maps fall back safely but will show raw values like 'In_progress'."* That
> was true until 2026-08-02 and is now wrong for `ezzy-vendor-mobile` — and the
> "fall back safely" half was **never** true of its notifications screen, where an
> unknown type threw and took the whole screen down. Both are fixed.
