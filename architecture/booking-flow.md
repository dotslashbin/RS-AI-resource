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

Fetches all active schedules for the selected vendor that belong to an offering with the matching code. Returns `BookerSchedule[]` with: `id`, `startDate`, `endDate`, `startTime` and `windowMinutes` (**nullable** — NULL for date-granular offerings), `daysOfWeek` (DB encoding: 0=Mon..6=Sun), `recurrence`, `capacityPerSlot`, and `durationMinutes`/`durationUnit` **per schedule** (see I10 under Step 3).

⚠️ **`windowMinutes` is the stored value; `endTime` is DERIVED for display** (`20260828000002`). Never do arithmetic with `endTime`: for a window running past midnight it reads *earlier* than `startTime`, which is precisely the inverted-range bug the length model removed. Use `windowMinutes` with `lib/slots.ts`.

### Calendar

The calendar shows the current month and allows navigation forward/backward. The
week **starts on Sunday** (2026-08), matching the vendor portal — `WDAYS` carries
`{label, dbDow}` so display order and the DB's `0=Mon..6=Sun` encoding stay
independent. See `conventions.md` → "Display order is never database data".

For each day it calls `getAvailableDaysInMonth(schedules, year, month)` to determine
which days have schedule occurrences. Available days show a green dot.

⚠️ **`getMondayOfWeek` must stay Monday-based regardless of what the header shows.**
It computes the reference week for **biweekly parity**, not display — changing it to
follow the Sunday-first header would shift which weeks a biweekly schedule runs on.
Its name invites exactly that mistake.

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
that schedule's own `duration_minutes` and returns every resulting unit. Since
`20260828000002` the window is a start plus a **length**, so it may run past midnight:
`23:00` for 120 minutes yields slots at `23:00` and `00:00`, and the second is physically
the following day.

> **This is the change that made the booker show reality.** It previously returned the
> distinct `start_time` values of the *schedules* on that date — one entry per schedule,
> not per unit — so a single 09:00–17:00 schedule offered exactly **one** button no
> matter how long the offering was.

Each slot renders as **start–end with a per-slot "N left"**. `endTime` and capacity were
fetched and discarded before this; nothing showed a booker how long a booking was or
whether it was nearly full.

#### Overnight windows — three consequences for this step (2026-08-28)

**1. A booking's `booked_date` is the date it STARTS, not the date its schedule's window
opened.** For a same-day window those coincide. For a Friday 23:00–01:00 window they do
not: the `00:00` slot is stored as **Saturday** 00:00. The *occurrence* is still Friday,
and `check_booking_placement()` derives it back — a start earlier in the clock than the
window opens can only belong to the previous day's window. Booked date is the primitive
because a booking must describe its own span with no join; filing it under the occurrence
would make `booked_date + start_time` resolve twenty-four hours early.

**2. The customer reaches that `00:00` slot through FRIDAY's date cell**, not Saturday's.
The calendar marks the day a window *opens*. A schedule running Fridays 23:00–01:00 marks
Fridays only.

**3. Therefore the past-day cutoff is span-aware, not date-based.**
`earliestSelectableDate(schedules, now)` returns yesterday while any of its slots are still
in the future, and it is the **single** cutoff used by `getAvailableDaysInMonth`, `isPast`
and `isPastMo`. Cutting the calendar off at today's midnight would make a slot fifty
minutes away unreachable at 00:10, because it lives under a day that has just become
"past". `isPastMo` matters as much as the others: at 00:10 on the 1st, the live slot
belongs to the last day of the *previous month*.

Slots whose start has already passed are filtered out of `slotViews`, against a `now` held
in state and ticked each minute — a `Date.now()` read during render never recomputes, so an
expiring slot would otherwise stay on offer.

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
**is** the `start_date`–`end_date` range.

The two modes are chosen by `duration_unit`, never asked. Step 1 cards are deduped by
`(code, granularity)` so an hourly and a day-based `COURT` are separate cards and the
wizard can never open in the wrong mode.

> **⚠️ Step 3 has no date-granular render arm — the mode is a dead end.**
>
> **Detection shipped; the UI for it did not.** Everything upstream of the render layer
> is correct, which is what makes this easy to mistake for working. All paths below are
> under `booker/components/booking/`:
>
> | | |
> |---|---|
> | The mode is detected | `useStep3Schedule.ts:39` — `dateGranular` is true when every schedule's unit is date-granular |
> | The span is computed and returned | `useStep3Schedule.ts:63,90` — `dateRange` via `getDateRange()` |
> | …and consumed by nothing | `Step3Schedule.tsx:26` destructures only `{ dateGranular, unitLabel, availableDays, slotViews, maxQuantity }` |
> | `slotViews` is empty in this mode | `useStep3Schedule.ts:42` short-circuits on `dateGranular` |
> | So the panel renders the wrong copy | `Step3Schedule.tsx:101-102` — *"No time slots available for this date."* |
> | And the step can never be passed | `useBookingWizard.ts:116` — `step === 3 && !!date && !!time`, and nothing sets `time` in this mode |
>
> A booker who picks a day/week/month offering therefore reaches a calendar that works,
> selects an available date, and is told there are no slots — with **Next** permanently
> disabled. The database side is complete (`check_booking_placement()` validates
> date-granular spans); only the booker's render arm and `canNext` are missing.
>
> **`booker/visual-tests/pilot.spec.ts:78` does not catch this.** It asserts the *absence*
> of time slots, which is the intended half of the behaviour, and never asserts that the
> booker can proceed. It is green today.
>
> Fixing it means rendering the `dateRange` the hook already returns and widening
> `canNext` to accept a date-granular selection. Tracked under "Carried forward" in
> `.plans/2026-08-03-offering-duration-and-booking-units.md`.

**`canNext`:** `!!date && !!time` — see the warning above; this is why the date-granular
mode cannot be completed.

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

#### ⚠️ The event envelope — read `data.attributes.type`, never `data.type`

PayMongo wraps the event in a resource envelope. The shape is:

```
data.type                                              "event"   ← ALWAYS this literal
data.attributes.type          "checkout_session.payment.paid"    ← the actual event name
data.attributes.data                        the checkout_session resource
data.attributes.data.attributes.metadata.booking_id     ← our booking id
```

**This cost months.** The route originally tested `data.type`, which is the constant string
`"event"` and never a payment type — so the paid check was **always false**, and the
webhook had never settled a payment in *any* environment. The metadata was present and
correct the whole time; the routing simply never reached it. Nothing surfaced it: PayMongo's
delivery log showed green because the endpoint returned `200`, and the app's own logs said
nothing because ignoring an unrecognised event is normal behaviour.

Two lessons that outlive this provider:

- **A `200` from a webhook endpoint proves delivery, not settlement.** The only evidence
  that a payment was *processed* is the database row — `is_paid = true`. Reaching the
  provider's checkout page and being marked paid are different milestones, and a dashboard
  showing money received does not prove the write happened.
- **Log the ignored branch with the value that caused it.** The route now emits
  `[webhook] ignoring event { type }` on every non-paid event. Had that line existed, the
  literal `"event"` would have been visible in the first log anyone read.

The `is_paid` write is **idempotent**: it updates `WHERE is_paid = false` and returns early
if nothing transitioned, so a provider retry/replay neither re-fires nor duplicates the
`payment_confirmed` notification. The failure branches are deliberately distinguishable in
the logs — a failed write, a `booking_id` that matches no row *in this database* (which
means the wrong environment is wired up), and an already-paid replay each say so
differently. A paid event with no `booking_id` is logged rather than silently dropped.

The `is_paid` write is **idempotent**: it updates `WHERE is_paid = false` and returns early if nothing transitioned, so a PayMongo retry/replay neither re-fires nor duplicates the `payment_confirmed` notification. A paid-type event arriving with no `booking_id` is logged (`console.warn`) rather than silently dropped.

**Env vars required:**
```
PAYMONGO_SECRET_KEY=sk_test_...        # server-only
PAYMONGO_WEBHOOK_SECRET=whsk_...       # server-only
NEXT_PUBLIC_APP_URL=https://...        # used for success/cancel redirect URLs
```

---

## The payment-provider surface — what a migration touches (2026-09-07)

Written for a provider swap. PayMongo is named in ~20 files, but **only three actually
talk to it**; the rest are comments, type names, and copy. Anyone changing providers should
work this list rather than grepping the name.

### The three real integration points

| File | What it does | Provider-specific |
|---|---|---|
| `booker/app/api/payment/create-session/route.ts` | creates a Checkout Session for a booker-originated booking; asserts `booker_id = user.id` | API host, auth header, request/response shape, `metadata.booking_id` |
| `vendor/app/api/kiosk/payment/create-session/route.ts` | the same for a kiosk booking; asserts the caller is a **vendor-admin of `booking.vendor_id`** | as above |
| `booker/app/api/payment/webhook/route.ts` | verifies the signature, settles `is_paid` via service role | **HMAC scheme, header name, and the event envelope** |

**There is deliberately one webhook, not two.** It keys purely on `metadata.booking_id` and
writes with service role, carrying no app-scoping, so it settles kiosk and booker payments
identically. Two registered endpoints would race on the same `is_paid` transition for no
gain. A provider swap does not change this.

### The exact contract in use today

Both create-session routes send the same payload. A migration's real work is mapping this
table, not renaming files.

```
POST https://api.paymongo.com/v1/checkout_sessions
Authorization: Basic base64(`${PAYMONGO_SECRET_KEY}:`)     ← note the trailing colon
```

| Field sent | Value | Notes for a swap |
|---|---|---|
| `line_items[0].amount` | `Math.round(price_paid * 100)` | **Centavos, integer.** Derived from the DB row, **never** from the client — `20260803000004` pins `price_paid` precisely so this cannot be steered |
| `line_items[0].currency` | `"PHP"` | |
| `line_items[0].name` / `description` | `"<offering.code> — <offering.name>"` | falls back to `"<APP_NAME> booking"` |
| `payment_method_types` | `["card","gcash","grab_pay","paymaya","billease","qrph"]` | ⚠️ see below |
| `success_url` | `<origin>/?payment=success&booking_id=<uuid>` | origin from `resolveSiteUrl().origin` — **derived, never a raw env read** |
| `cancel_url` | `<origin>/?payment=cancel&booking_id=<uuid>` | |
| `metadata.booking_id` | the booking uuid | **the entire contract** — the only link back to a row |

| Field consumed | Used for |
|---|---|
| `data.id` | written to `bookings.payment_reference` (service role) |
| `data.attributes.checkout_url` | the customer is sent here by top-level navigation |

> ⚠️ **`resolveSiteUrl()` throws rather than guessing.** This line was once
> `process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"`. On a hosted deploy with the
> variable unset, the build succeeded and the route quietly sent a `success_url` pointing at
> localhost — the customer pays, is charged, and lands on a dead page, with nothing anywhere
> reporting a fault. Refusing before money moves beats taking it and stranding the payer.
> Any replacement must keep that property.

### ⚠️ "Maya" is already a payment method here

`payment_method_types` includes **`"paymaya"`** today, so a customer can already pay with
Maya — PayMongo is merely the acquirer processing it. That makes "move to PayMaya" two
quite different projects, and a plan must say which one it means:

- **Maya as a payment *method*** — already done. No work.
- **Maya as the *acquirer*** (Maya Business / Maya Checkout replacing PayMongo end to end) —
  a real migration: new API, new signature scheme, new envelope, new dashboard, new
  credentials, and a re-verification of every settlement path.

The second is the only one worth planning, and its justification should be commercial (fees,
settlement terms, merchant onboarding) rather than technical, because the customer-visible
payment options barely change.

### What is NOT provider-specific, and must keep working

- **`metadata.booking_id` is the entire contract.** It is the only thing that ties a
  payment back to a row. Whatever the new provider calls its metadata bag, that id must
  survive the round trip, and the webhook must read it from wherever the new envelope puts
  it — see the envelope trap above.
- **Idempotency.** `WHERE is_paid = false`, returning early if nothing transitioned. Every
  provider retries.
- **The `booking_transactions` ledger needs no changes.** Its trigger fires on
  `bookings.is_paid` false→true — anchored to the *column*, deliberately not to the webhook
  — so it stays correct no matter what confirms the payment (`schema.md`).
- **The return URL contract**, `?payment=success|cancel&booking_id=<uuid>` — consumed
  differently by the two origins (booker soft-navigates, the kiosk cold-starts; see *The
  payment return at the kiosk*).
- **`NEXT_PUBLIC_APP_URL`** builds those return URLs (`booker/lib/siteUrl.ts`).

### Two traps worth carrying forward

- **No browser-side origin is needed in CSP.** The secret-key call is server-side, and the
  customer reaches checkout by top-level navigation (`window.location.href = checkout_url`),
  which is governed by neither `connect-src` nor `form-action`. `api.paymongo.com` is
  deliberately absent from `booker/next.config.ts`, and `conventions.md` records the same.
  A new provider needs an entry **only** if it ships a browser SDK.
- **Test-mode and live-mode credentials are separate scopes.** A webhook registered in test
  mode never fires for a live payment, and the secret key and webhook secret must come from
  the *same* account and mode. `production-env-checklist.md` carries the full matrix of
  which app holds which variable — `PAYMONGO_WEBHOOK_SECRET` is **booker-only**.

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

### Webhook Setup on a Hosted Environment (added 2026-09-04)

**⚠️ ONE webhook serves BOTH portals. Do not register a second one for `vendor`.**
This is the single most important thing on this page. A kiosk Checkout Session is created
by `vendor`, but it carries `metadata.booking_id` and PayMongo emits the event on the
*account*, not the app. `booker/app/api/payment/webhook` keys purely on that id and writes
with service role — no app-scoping, no booker-scoping — so it settles kiosk bookings
unchanged. A second registered endpoint would race the first on the same `is_paid`
transition for no gain, which is also why `PAYMONGO_WEBHOOK_SECRET` must **never** be added
to `vendor` (kiosk plan B22).

**Order matters — deploy first, register second.** PayMongo validates the endpoint when you
create it, so registering before booker is reachable at that URL fails.

1. **Deploy `booker`** to the environment and confirm `/api/payment/webhook` answers. An
   unsigned POST must return `400 {"error":"Invalid signature"}` — that is the endpoint
   working, not failing:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<booker-host>/api/payment/webhook
   ```
2. **Register** in the PayMongo dashboard → **Developers → Webhooks**, URL
   `https://<booker-host>/api/payment/webhook`, subscribing to
   **`checkout_session.payment.paid`**. The handler also accepts `payment.paid`
   (`webhook/route.ts:53`); either alone is sufficient.
3. **Copy the signing secret immediately.** It is shown **once**, at creation. Set it as
   `PAYMONGO_WEBHOOK_SECRET` on **booker only**, as a genuine **secret** — unlike the
   `NEXT_PUBLIC_*` values, this one must never be public config.
4. **Redeploy booker** so the new variable is picked up.

**⚠️ Test and live are separate registrations.** A webhook created under a `sk_test_` key
receives only test events. The signature header reflects this — `parts["te"]` carries the
test HMAC and `parts["li"]` the live one, and `verifySignature` accepts either
(`webhook/route.ts:10`). Staging (test keys) and production (live keys) therefore need
**two** webhooks with **two different secrets**. Do not copy one environment's secret into
the other; verification will fail with a correct-looking `400`.

**Verify end to end** — the only proof that matters:
1. Book through the kiosk on that environment and pay with `4343 4343 4343 4345`.
2. `select is_paid from bookings where id = '<booking>'` → must be `true`.

If the redirect returns but `is_paid` stays false, the session was created but the event
never arrived: check the webhook's delivery log in the dashboard, then that the secret on
booker matches *that* webhook, then that the URL points at the environment you just paid on.

**Booker's own env on a hosted environment** — the same list as vendor, minus the payout
key, plus the webhook secret:

| Variable | Type |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | config |
| `NEXT_PUBLIC_APP_URL` | config — **booker's own origin**, not vendor's |
| `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_DOMAIN` | config |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔒 secret |
| `PAYMONGO_SECRET_KEY` | 🔒 secret — mode must match the webhook's |
| `PAYMONGO_WEBHOOK_SECRET` | 🔒 secret — from step 3 |

⚠️ `NEXT_PUBLIC_APP_URL` must be **booker's** host with the scheme and no trailing slash.
It builds booker's own payment redirect; vendor's kiosk uses vendor's value for its own.

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

## Kiosk Mode — a second origin for bookings (2026-08-29)

Until now every booking came from the booker portal. **Kiosk Mode** (`vendor/app/kiosk`)
adds a second origin: a walk-in books and pays for themselves on a tablet at the
vendor's front desk. `bookings.booked_via` records which (`booker` | `kiosk`).

**What is the same.** The slot rules, `check_booking_placement()`, the trigger-derived
`price_paid`, the PayMongo Checkout Session, and — importantly — **the webhook**.
`booker/app/api/payment/webhook` keys purely on `metadata.booking_id` and writes with
service role, carrying no app-scoping, so it settles kiosk payments unmodified. There is
deliberately **no second webhook**: two registered endpoints would race on the same
`is_paid` transition for no gain.

**What differs, and why.**

| | Booker | Kiosk |
|---|---|---|
| Who is signed in | the booker | the **vendor** |
| Booking insert | client, under RLS (`booker_id = auth.uid()`) | **service-role route**, because the row's booker is not the caller |
| Payment route | `booker/api/payment/create-session`, asserts `booker_id = user.id` | `vendor/api/kiosk/payment/create-session`, asserts caller is a **vendor-admin of `booking.vendor_id`** |
| The customer's account | they signed up | **created for them** — profile, `booker` portal, `member` role, active status, and a `legal_acceptances` row with `source = 'kiosk_booking'` |

> **Why the customer gets a real account rather than a shared "walk-in" profile.** Two
> walk-ins on one profile is not merely untidy, it is impossible: `bookings_no_duplicate`
> and the placement trigger's same-booker overlap test would refuse the second one on the
> same slot however much capacity remained. And the account must be *complete* —
> `verifyBookerAccess` needs a portal row, a role row **and** active status, so a profile
> left at the `handle_new_user` default of `status_id = 3` could neither log in, read its
> own booking, nor be signed up for later, since both registration paths treat an
> existing `profiles` row as "email taken".

### Free kiosk bookings (2026-09-12)

A ₱0 kiosk offering has nothing to pay, so it cannot follow the payment path at all:
`create-session` refuses an amount that is not greater than zero, and the webhook — which sets
`is_paid`, triggers the ledger row and sends the kiosk confirmation — never runs. So:

- **The kiosk booking route creates it settled.** It reads the offering's list price
  server-side and INSERTs with `is_paid = true` when that price is 0. An INSERT does not fire
  `create_booking_transaction()` (AFTER **UPDATE** of `is_paid`), so a free booking writes **no
  ₱0 ledger row** — nothing in Transactions, nothing in Command's payout buckets.
- **The derived `price_paid` stays the authority.** If the vendor edits the price during the
  request, the inserted row and the list price disagree: a settled row with a price is set back
  to unpaid (true → false fires nothing) and continues to payment; an unpaid row at ₱0 is left
  as is, because flipping it would be an UPDATE that writes a ₱0 ledger row
  (`vendor/lib/kioskFreeBooking.ts`).
- **The route sends the confirmation** (`kiosk_booking_confirmed`), gated like the webhook, with
  the body "No payment needed." — a vendor copy of the booker's builder
  (`vendor/lib/kioskBookingNotification.ts`). The email template still shows a "Paid ₱0.00" row
  by decision.
- **The kiosk skips payment on the route's `free` flag**, never on its own total, and reuses
  the payment return URL to reach the receipt, which reads **Free**.

The booker app has no equivalent yet (`booker/app/api/payment/create-session` refuses ₱0 the
same way).

### Availability at the kiosk, and times that have started (2026-09-12)

- **"Available" means bookable now**: a free place (overlap-counted, as `check_booking_placement()`
  counts) at a slot whose start has not passed. The offering step groups offerings by the first
  such day in the next 7 days, from one bookings read across every eligible schedule;
  `lib/kioskAvailability.ts` composes it from `isOccurrence`, `availabilityForDay` and `slotDate`,
  so the grid and the time step cannot disagree. An incomplete read falls back to the plain list.
- **A started time is refused twice**: the time step never lists it, and the kiosk booking route
  returns 409 for it. Both compare a fixed **+08:00** instant built from the date the booking is
  *stored under* (the next day for a post-midnight slot), never the machine's timezone.
- ⚠️ `check_booking_placement()` itself does **not** refuse a past start, so other clients are not
  protected by this (launch follow-up F16).

### Closing a kiosk booking

A kiosk customer never logs in, so `v_booker` (`auth.uid() = booker_id`) is unsatisfiable
for their bookings — and **both** booker-reserved transitions deadlocked:
`in_progress → returned` (custody) and `fulfilled → completed` (session). Custody
deadlocked hard, because `in_progress` has no timer by design; session deadlocked softly,
completing after three days on the auto-acknowledge.

`20260829000004` widens both to accept a **vendor-admin where `booked_via = 'kiosk'`**.
The customer confirms on the tablet in front of them, at `/kiosk` → *Finish a booking*,
identifying their own booking by phone or reference — never from a list, which on a
public screen would show every other customer's name.

> ⚠️ **The trade, stated plainly.** The database cannot distinguish "the customer tapped
> it" from "the vendor tapped it" — the session is the vendor's either way. This buys the
> *shape* of two-party attestation, not the guarantee. What the marker buys is that the
> widening reaches **only** kiosk-originated bookings; every booker-originated custody
> booking keeps its counterparty check exactly as it was.

### The payment return at the kiosk (2026-09-07)

The booker's return is a soft one: `useAppShell` reads the params, clears them with
`history.replaceState`, and the SPA carries on with its state intact. **The kiosk's is
not.** Paying leaves the app entirely, so the redirect back to
`/kiosk?payment=success&booking_id=<uuid>` is a **full page load** — every piece of flow
state is gone, and `useKioskBooking` is back at its initial values.

Three failures followed from not treating that as a cold start, and the fixes are the
contract any future provider must satisfy:

| What broke | Why | The rule it establishes |
|---|---|---|
| The customer landed on the kiosk **Welcome** screen, not the confirmation | `KioskShell` initialised `view` to `"home"`, so the return params were parsed by a component that was never rendered | **The URL is the only state that survives the redirect.** `view` initialises *from* it (a lazy `useState` initialiser, matching the `kioskDevice` pattern) rather than being corrected afterwards |
| The receipt showed a blank service and **"Paid ₱0"** | `StepConfirmation` rendered `k.offering?.name` and `k.total` from destroyed memory; `total` defaults to `0` | **No field may fall back to something that looks like data.** The receipt now re-reads the booking (`getKioskReceipt`), and an unknown value renders an em dash — a `0` appears only when the read returned 0 |
| Starting a new booking jumped straight back to the confirmation | `?payment=success` was still in the URL, so the next customer inherited the previous one's return | **The params must be cleared on every exit**, both the *Done* button and the idle timeout (`clearPaymentReturn()`) |

> ⚠️ **"Paid ₱0" is worse than a blank field.** A blank row reads as unfinished; a wrong
> number reads as fact — and this is the screen the copy tells the customer to show at the
> front desk.

The re-read goes through the kiosk's **existing vendor-admin session**, not a service-role
route: the RLS policy *"vendor admins can read their bookings"* already permits it, so the
receipt is accurate without storing anything. That matters because the kiosk's standing
rule is that **nothing about a customer outlives the session** — stashing a summary in
`sessionStorage` to survive the redirect would have been the cheap fix and the wrong one.

### Documents and the idle reset at the kiosk (2026-09-12)

The agreements step is where a customer accepts an offering's documents, so it is also
the step where they need to *read* one. Two rules now hold there:

- **An uploaded document is openable, and the link exists before the tap.** Documents live
  in the private `offering-attachments` bucket and are read through a signed URL under the
  kiosk's vendor-admin session. The URL is minted when the step mounts and re-signed every
  240s, and the control is a plain `<a target="_blank" rel="noopener noreferrer">` — a
  `window.open` issued after awaiting the signature runs outside the tap and Safari blocks
  it. Ticking "I have read and agree" is still the agreement; it is not gated on opening.
- **Reading must not cost the customer their progress, and walking away must not leave it on
  screen.** Opening a document hides the kiosk page, and the 90s idle reset counts only
  interaction on that page. So the reset **pauses while the page is hidden** and, on return,
  restarts — unless the page was hidden for more than 10 minutes, in which case the kiosk
  starts over at once (`lib/kioskIdle.ts`). The payment confirmation's suspension still wins.

What was agreed is then visible to the vendor: `booking_acknowledgements` and the signature
are shown, read-only, in the vendor portal's booking details modal (`portals.md` →
Bookings Page).

> ⚠️ **A stored signature's ink colour is not fixed.** The signature pad strokes in the
> kiosk's computed theme colour on a transparent canvas, so a signature taken on a
> dark-themed kiosk is near-white ink. Anything displaying one must pick a ground that works
> for both (the modal uses mid-slate). Recorded as a follow-up.

---

### Overnight windows at the kiosk

`booked_date` is the date a booking **starts**, so the `00:00` slot of a Friday
23:00–01:00 window is stored under **Saturday**. The kiosk therefore labels any slot
whose own date differs from the chip the customer tapped, and the booking route derives
`booked_date` server-side from the schedule's window start rather than trusting a date
from the client. Without that, a customer tapping `00:00` under a chip reading *Today*
books tomorrow and arrives on the wrong day.

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
