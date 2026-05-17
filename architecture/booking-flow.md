# Booking Flow

The booking wizard is the core user-facing feature of the DriveBook (learner) portal. It is a 5-step guided flow that takes a learner from choosing a service to submitting a confirmed booking to Supabase.

---

## Flow Overview

```
Step 1: Choose Service
    ↓ sets exam (DbOffering)
Step 2: Choose School
    ↓ sets school (LearnerAcademy), branch (address string)
Step 3: Pick Schedule
    ↓ sets date (YYYY-MM-DD), time (HH:MM), selectedSchedule (LearnerSchedule)
Step 4: Upload Documents
    ↓ sets uploads (Record<id, {name, size}>)
Step 5: Confirm & Book
    ↓ writes booking to Supabase → BookingConfirmation screen
```

---

## State Management

All wizard state lives in `useBookingWizard.ts` (a custom hook in `./learner/components/booking/BookingWizard/`). The hook owns all state, fetching, and side effects. `BookingWizard.tsx` is a pure render layer that calls the hook and passes state down to step components as props.

**Key state fields:**

| Field | Type | Set at |
|-------|------|--------|
| `step` | `number` | Navigation buttons |
| `exam` | `DbOffering \| null` | Step 1 selection |
| `school` | `LearnerAcademy \| null` | Step 2 selection |
| `branch` | `string \| null` | Step 2 (set to `school.address`) |
| `date` | `string` | Step 3 calendar pick (format: `YYYY-MM-DD`) |
| `time` | `string` | Step 3 time slot pick (format: `HH:MM`) |
| `selectedSchedule` | `LearnerSchedule \| null` | Resolved when time is picked |
| `uploads` | `Record<string, UploadEntry>` | Step 4 file picks |
| `offerings` | `DbOffering[]` | Fetched on mount |
| `academies` | `LearnerAcademy[]` | Fetched when `exam` changes |
| `schedules` | `LearnerSchedule[]` | Fetched when `school` + `exam` change |

**Why `selectedSchedule` is separate from `time`:** `time` is a display/filter string. `selectedSchedule` holds the actual `LearnerSchedule` record including its UUID — needed to write `schedule_id` to the `bookings` table. It is resolved by `resolveScheduleForTime(schedules, date, time)` when the learner picks a time slot.

---

## Step 1 — Choose Service

**Component:** `Step1Offering/Step1Offering.tsx`  
**Service:** `services/offerings.service.ts` → `getActiveOfferings()`

Fetches all `is_active = true` offerings from Supabase, joining `offering_categories` for the category name. Deduplicated by `code` client-side — if multiple academies offer TDC, Step 1 shows TDC once with the lowest available price shown as "from ₱X".

**Deduplication:** `dedupeByCode()` in the hook returns both the deduplicated list and a `multiPriceCodes: Set<string>` — codes where more than one price exists. `Step1Offering` uses this set to decide whether to prefix the price with "from".

**Category colour coding:**
- `exam` → blue (`#3b82f6`)
- `lesson` → green (`#10b981`)
- `other` → amber (`#f59e0b`)

**`canNext`:** `!!exam`

---

## Step 2 — Choose School

**Component:** `Step2School/Step2School.tsx`  
**Service:** `services/academies.service.ts` → `getAcademiesForOffering(offeringCode)`

Fetches academies that have an active offering matching the selected `code`. Uses a PostgREST `!inner` join through the `offerings` table to filter, then deduplicates by academy `id` and filters to only `status = 'active'` academies. Each result is a `LearnerAcademy` (id, name, address, branch, phone).

**Map:** A Leaflet tile map is shown as a location placeholder. It displays the user's geolocation dot if the browser grants location permission. The map does not show academy markers — academy coordinates (`lat`, `lng`) do not yet exist in the DB schema. This is deferred.

**RLS dependency:** A migration (`20260515000001_learner_academy_read_policy.sql`) grants active learners read access to active academies. Without this, the query returns zero rows.

**Selecting a school** sets both `school` (the full `LearnerAcademy` object) and `branch` (set to `school.address` as a display string). This also triggers the schedules fetch.

**`canNext`:** `!!school && !!branch`

**Future:** Once `lat`/`lng` columns are added to `academies`, academy markers can be placed on the map and used for proximity sorting.

---

## Step 3 — Pick Schedule

**Component:** `Step3Schedule/Step3Schedule.tsx`  
**Service:** `services/schedules.service.ts` → `getSchedulesForAcademy(academyId, offeringCode)`

Fetches all active schedules for the selected academy that belong to an offering with the matching code. Returns `LearnerSchedule[]` with: `id`, `startDate`, `startTime` (HH:MM), `endTime`, `daysOfWeek` (DB encoding: 0=Mon..6=Sun), `recurrence`, `maxCapacity`.

### Calendar

The calendar shows the current month and allows navigation forward/backward. For each day, it calls `getAvailableDaysInMonth(schedules, year, month)` to determine which days have schedule occurrences. Available days show a green dot.

### Recurrence Expansion

Occurrence dates are computed client-side from each schedule's recurrence rule:

| Recurrence | Expansion logic |
|-----------|----------------|
| `none` | Single occurrence on `start_date` only |
| `weekly` | Every week on the days in `days_of_week`, from `start_date` onwards |
| `biweekly` | Every other week, using the Monday of `start_date`'s week as the reference. A candidate date is an occurrence if its week is an even number of weeks from the reference week |
| `monthly` | The same day-of-week in the same week-of-month as `start_date` (e.g., if `start_date` is the 2nd Tuesday of the month, occurrences are the 2nd Tuesday of every subsequent month) |

**Day-of-week encoding difference:** DB stores 0=Mon..6=Sun. JavaScript `Date.getDay()` returns 0=Sun..6=Sat. The helper `dbDowToJs(d) = (d + 1) % 7` converts between them.

### Time Slots

When the learner picks a date, `getTimesForDate(schedules, dateStr)` finds all schedules that have an occurrence on that date and collects their `startTime` values, deduplicated and sorted. These are displayed as buttons in 12-hour format (e.g., "8:00 AM").

### `handleSelectTime(t)`

The hook exposes `handleSelectTime` instead of raw `setTime`. It sets `time` and simultaneously resolves `selectedSchedule` via `resolveScheduleForTime(schedules, date, t)` — finding the first schedule that has an occurrence on `date` at `startTime = t`.

When the learner changes their date selection, `handleSelectTime("")` is called to clear both `time` and `selectedSchedule`.

**`canNext`:** `!!date && !!time`

**Future:** Capacity tracking — showing "Limited" slots when a date/time has near-full bookings — requires counting existing `bookings` rows per (schedule, booked_date). This would need either a DB view or an additional query.

---

## Step 4 — Upload Documents

**Component:** `Step4Documents/Step4Documents.tsx`

Document requirements come directly from `exam.requirements` — the `RequirementItem[]` array fetched from the `offerings` table (JSONB column). Each item has an `id`, `label`, and `required` flag. Academy admins define these in the offering form; different academies or offerings can have different requirements for the same exam code.

Files are stored in React state as `{ name: string, size: number }` — no actual file content is stored or uploaded. The progress bar and "X of N required uploaded" counter are purely client-side.

**`canNext`:** All required documents (those with `required: true`) have an upload entry. Optional documents do not block progression. If an offering has no requirements, `canNext` is immediately true.

**Current limitation:** Nothing is written to Supabase Storage or the `booking_documents` table. Real uploads are a planned follow-up.

**Planned flow for real uploads:**
1. The booking is created first (Step 5 writes to `bookings`)
2. Files are uploaded to Supabase Storage under a path like `bookings/{booking_id}/{doc_id}`
3. `booking_documents` rows are written linking back to the booking
4. The learner portal needs a Storage policy allowing authenticated uploads under their booking's path

---

## Step 5 — Confirm & Book

**Component:** `Step6Confirm/Step6Confirm.tsx` (file name retained from original 6-step design)

Shows a summary of all selections: service name, school, branch/address, date and time (displayed in 12-hour format), uploaded document list, and total price. A note informs the learner that payment is collected at the school on the day.

**`canNext`:** Always `true` (the Confirm step is a review screen — Next writes the booking).

### `confirmBooking()`

The hook's `confirmBooking` is `async`. It:

1. Guards against missing state: `if (!exam || !school || !branch || !selectedSchedule || !date) return`
2. Calls `createBooking()` in `services/bookings.service.ts`
3. `createBooking` calls `supabase.auth.getUser()` to get `learner_id`, then inserts into `public.bookings`:
   - `learner_id`: from auth session
   - `schedule_id`: from `selectedSchedule.id`
   - `academy_id`: from `school.id`
   - `offering_id`: from `exam.id`
   - `booked_date`: from `date` (YYYY-MM-DD)
   - `price_paid`: from `exam.price`
   - `status`: `"pending"`
4. Returns the new booking's UUID (or `null` on error)
5. Constructs a local `Booking` object for the dashboard state (includes `dbId` if the insert succeeded)
6. Calls `onBookingConfirmed(newBooking)` and sets `done = true`

**`createBooking` result:** Returns `{ id, result }` where `result` is `"ok" | "already_booked" | "full" | "error"`. Postgres error `23505` (unique constraint) maps to `"already_booked"`; an exception message containing "fully booked" maps to `"full"`.

**Current limitation:** `confirmBooking()` in the hook only uses the `id` field; the `result` value is not yet checked. A learner who hits a `"full"` or `"already_booked"` case still sees the success screen. This is a known gap — see below.

**After confirmation:** `BookingConfirmation.tsx` is shown — a success screen with booking summary and a "Back to Dashboard" button that calls `reset()` and `onDone()`.

---

## Data Flow Diagram

```
Mount
  └─ getActiveOfferings() → offerings[]

Step 1: exam selected
  └─ getAcademiesForOffering(exam.code) → academies[]

Step 2: school selected
  └─ getSchedulesForAcademy(school.id, exam.code) → schedules[]

Step 3: date selected
  └─ getAvailableDaysInMonth(schedules, year, month) → Set<number>
     date picked → getTimesForDate(schedules, date) → string[]
     time picked → resolveScheduleForTime(schedules, date, time) → selectedSchedule

Step 4: uploads[] managed in state (no DB writes)

Step 5: confirmBooking()
  └─ createBooking({scheduleId, academyId, offeringId, bookedDate, pricePaid})
       └─ INSERT INTO bookings → returns UUID
```

---

## Services Reference

| Service | Function | Returns |
|---------|----------|---------|
| `offerings.service.ts` | `getActiveOfferings()` | `DbOffering[]` |
| `academies.service.ts` | `getAcademiesForOffering(code)` | `LearnerAcademy[]` |
| `schedules.service.ts` | `getSchedulesForAcademy(academyId, code)` | `LearnerSchedule[]` |
| `schedules.service.ts` | `getAvailableDaysInMonth(schedules, year, month)` | `Set<number>` |
| `schedules.service.ts` | `getTimesForDate(schedules, dateStr)` | `string[]` |
| `schedules.service.ts` | `resolveScheduleForTime(schedules, dateStr, time)` | `LearnerSchedule \| null` |
| `bookings.service.ts` | `createBooking(params)` | `{ id: string \| null; result: CreateBookingResult }` |
| `bookings.service.ts` | `getBookings()` | `Booking[]` (learner's own history, RLS-scoped) |

---

## Known Gaps and Future Work

| Area | Current state | Future |
|------|--------------|--------|
| Document uploads | In-memory only (no Storage writes) | Supabase Storage + `booking_documents` writes |
| Capacity display | No slot count shown to learner | Query booking counts per (schedule, date); show "Limited" warning |
| Academy map | Tile + user dot only | Add `lat`/`lng` to `academies`; show academy markers |
| `confirmBooking` result handling | Only `id` used; `"already_booked"` / `"full"` show success screen | Check `result` in wizard and display appropriate error toast |
| Wallet / payment | Static info text | Wallet accounts table, deduction on confirm |
| Cancellation / reschedule | Dashboard "Reschedule" button is placeholder | Write cancellation flow, status updates |
| Examiner info on confirmation | Not shown | Could surface from `schedules.examiner_name` on the confirmation screen |
| ~~Duplicate booking check~~ | ~~None~~ | **Done** — DB `UNIQUE (learner_id, schedule_id, booked_date)` + service maps `23505` to `"already_booked"` |
| ~~Booking history from DB~~ | ~~Dashboard shows seed data~~ | **Done** — `getBookings()` fetches real rows; loaded on login |
| ~~Capacity overbooking~~ | ~~No DB enforcement~~ | **Done** — `check_booking_capacity()` BEFORE INSERT trigger |
