# Fulfilment testing — bug fixes

**Date:** 2026-08-01
**App / scope:** `command` (AppShell routing), `booker` + `vendor` (schedule discoverability)
**Status:** COMPLETE (2026-08-01) — B1 and I3 fixed and verified; I1 closed as not-a-defect; I2 parked.

> Two defects reported after the first manual test pass of
> `.plans/2026-07-31-booking-fulfilment-dual-acknowledgement.md`. One is confirmed
> and worse than reported; the other could not be reproduced, and this plan says
> so rather than shipping a speculative fix.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local.

---

## BLOCKERS

### B1 — Command renders TWO pages at once on Flags and Payouts  ✅ DONE
**File:** `command/components/layout/AppShell/AppShell.tsx:86`

**Reported as:** "the payouts table needs the same vertical spacing as the rest,
it looks too close to the widgets below."

**Escalated — it is not a spacing problem.** The "widgets below" are the *entire
Overview page* rendering underneath Payouts. The line is a catch-all fallback:

```tsx
{page !== "overview" && page !== "transactions" && page !== "vendors"
  && page !== "users" && page !== "settings" && <OverviewPage vendors={vendors} onNavigate={goPage} />}
```

A **negative** list of known pages. `flags` and `payouts` were added to the
routing above it (`:81-84`) but never to this exclusion list, so both satisfy the
condition and `OverviewPage` mounts alongside them. Confirmed against the
screenshot: the KPI grid (Total Bookings / Active Vendors / Platform Revenue /
Held Wallet Funds) and the Fulfilment oversight card below the payouts table are
`OverviewPage`, not stray margins.

**Consequences beyond the visual:**
- Two pages mounted simultaneously on **Flags** and **Payouts**.
- `OverviewPage` fetches on mount, and `FulfilmentOversightCard` issues **three
  more queries** — so every visit to Payouts or Flags silently runs Overview's
  entire data load as well.
- Any future page added to nav without editing this line inherits the same bug.
  This is a **defect factory**, not a one-off typo.

**Fix approach — replace the negative list with a positive one, derived.**
`lib/navigation.ts` already holds the page ids. Make the fallback the genuine
"unknown page" case it was meant to be:

```tsx
// lib/navigation.ts
export const KNOWN_PAGES = new Set<string>([...MAIN_TABS.map(t => t.id), "settings"])

// AppShell.tsx — replaces the hand-maintained negative list
{!KNOWN_PAGES.has(page) && <OverviewPage vendors={vendors} onNavigate={goPage} />}
```

Adding a nav tab then registers it automatically. **Do not** simply append
`page !== "flags" && page !== "payouts"` — that fixes today's symptom and leaves
the trap armed for the next page.

**Blast radius:** render-path only, no data or schema change. Every current page
keeps its behaviour; the fallback still catches a genuinely unknown `page` value.
Reversible by reverting one file pair.

**Verification:** machine — `tsc`, `npm run build`. Live — visit each of the six
nav entries and confirm exactly one page renders; Payouts and Flags must no longer
show the KPI grid or the oversight card.

> **✅ DONE (2026-08-01).** `lib/navigation.ts` gained `KNOWN_PAGES`, derived from
> `MAIN_TABS` plus `settings`; `AppShell.tsx:90` now reads
> `{!KNOWN_PAGES.has(page) && <OverviewPage … />}`. The hand-maintained negative
> list is gone, so a new tab registers itself.
> **Verified:** `tsc --noEmit` 0, `npm run build` 0, and the render conditions
> exhaustively simulated over all seven routed ids plus an unknown id and an empty
> string — **every case yields exactly one page**, and unknown ids still fall back
> to Overview.
> **Not verified — needs a browser:** that Payouts and Flags visually no longer
> show the KPI grid beneath them.

---

## IMPORTANT

### I1 — Booker could not find a vendor-created schedule  ✖ ABORTED — not a defect
**Files:** `booker/services/schedules.service.ts`, `booker/components/booking/BookingWizard/useBookingWizard.ts`

**Reported:** a schedule created in vendor (Citywide Sports Center, offering
*Court Rental*, titled `<Myu court rental`, week of Aug 4, 10:00–11:00) was not
findable in booker as `ben@bookdeck.com`.

#### Investigation record — every layer returns the schedule

Traced end to end on the live local stack, **as Ben**, with a JWT signed by the
local `JWT_SECRET` so RLS and PostgREST behaved exactly as they do in the browser.

| Layer | Checked | Result |
|---|---|---|
| DB row | `schedules` | Correct: `start_date 2026-08-04`, `start_time 10:00`, `end_time 11:00`, `days_of_week {0,1,2,3,4,5}`, `weekly`, `is_active`, `max_capacity 20`, offering `COURT` active, vendor Citywide |
| RLS | policy `active users can read active schedules` = `is_active AND is_active()` | Ben is `active` — permitted |
| Step 1 | `GET /offerings?is_active=eq.true` as Ben | 9 rows, **COURT present** (3 of them) |
| Step 1 dedupe | `dedupeByCode()` (`useBookingWizard.ts:12-25`) | Survives — result is `COACH, FIT, GROUP, COURT` |
| Step 2 | `getVendorsForOffering("COURT")` | All 3 vendors, Citywide `status = active` |
| Step 3 | the real `offerings!inner(code)` embed query | **Returns all 3 Citywide COURT schedules, including `<Myu court rental`** |
| Client expansion | `isOccurrence()` simulated with the real row values | **Aug 4 = available**; whole month expands 4,5,6,7,8,10,… |
| Calendar month | `useBookingWizard.ts:45-46` | Initialises to the current month — August 2026 |
| Fetch effects | `useBookingWizard.ts:48-73` | Dependencies `[offering]` and `[vendor, offering]` are correct |
| Draft restore | `useBookingWizard.ts:83-96` | Self-healing — a stale `examId` clears the draft rather than sticking |

**The `!inner` embed was tested specifically**, because an embedded-filter
assumption caused a real bug earlier the same day (dual-acknowledgement I22). It
is not the cause here.

**Verdict: no data or logic failure found.** Recording that rather than inventing
a fix — a speculative change here would be unverifiable and could mask the real
cause.

#### Two genuine findings that fall out of the investigation

**(a) The booker never displays schedule identity — by design, undocumented.**
`getSchedulesForVendor` (`schedules.service.ts:33-42`) does not select `title`,
and `BookerSchedule` (`booker/lib/types.ts:97+`) has no `title` field. The wizard
surfaces only *offering → vendor → date → time*. A vendor searching booker for the
name they typed (`<Myu court rental`) will find nothing, ever. **This is the
single most likely explanation of the report.**

**(b) "The entire week of Aug 4" is not what got created.** Aug 4 2026 is a
**Tuesday**, and `isOccurrence` requires `date >= start_date`
(`schedules.service.ts:64`). With `days_of_week = {0,1,2,3,4,5}` (DB encoding
0=Mon…6=Sun, so **Mon–Sat, no Sunday**):

| Day | In that week | Why |
|---|---|---|
| Mon Aug 3 | ❌ | before `start_date` |
| Tue Aug 4 – Sat Aug 8 | ✅ | |
| Sun Aug 9 | ❌ | dow 6 not selected |

So the first week yields Tue–Sat, and every later week Mon–Sat. Defensible
behaviour, but it does not match "the entire week of Aug 4" — and nothing in the
vendor form explains the `start_date` gate.

#### ✖ Closed 2026-08-01 — not a defect

The reporter retested with a fresh offering ("Phone Rental", weekly 14:00–16:00
from Aug 17) and **it appeared in booker correctly**, then withdrew the report.
That matches the investigation above: no layer was ever failing.

**Additional check made before closing** — "I can see this as a service" raised the
possibility that the offering form was not persisting `fulfilment_pattern`, which
*would* have been a real bug in dual-acknowledgement I6. It is not:

```
Phone Rental | PHRENT | category 'rental' | fulfilment_pattern = custody | Citywide
```

The form saved `custody` correctly. Booker's Step 1 lists every bookable item as an
"offering" regardless of pattern — the pattern only takes effect once a booking
reaches fulfilment — so seeing it in that list is expected behaviour, not a
mis-classification.

**Nothing was changed for this item.** The investigation record is kept because it
documents the booker data path end to end, which is reusable the next time
something is reported missing.

---

### I2 — Vendor schedule form does not explain start date vs repeat days  ⏸ PARKED
**File:** `vendor/components/schedule/` (form), pending exact line
Independent of I1's outcome — finding (b) above is real either way.

A vendor picking "repeat weekly" and ticking Mon–Sat reasonably expects those days
from that week onward. They get them **from `start_date` onward**, so days earlier
in the first week are silently missing, and the day-of-week set is easy to
mis-tick (there is no "select all" and Sunday sits at the end).

**Fix approach:** a single line of helper text under the repeat control stating
that occurrences begin on the start date, plus an inline preview of the first two
or three resulting dates. **Do not** change `isOccurrence` — the behaviour is
correct, the explanation is missing.

**⏸ PARKED (2026-08-01) — the report that surfaced it was withdrawn.** The finding
itself is real and verified (a weekly schedule starting mid-week silently omits the
earlier days of its first week), but no one has actually been confused by it in
anger, and adding UI copy nobody asked for is scope this plan should not take.
**Unblock condition:** a vendor reports unexpected missing dates, or the schedule
form is being worked on for another reason.

**Verification when unparked:** live — create a weekly schedule starting mid-week
and confirm the preview matches what booker shows.

---

### I3 — "Booking failed" is shown when the user is simply signed out  ✅ DONE
**File:** `booker/services/bookings.service.ts:16-17`, surfaced at `booker/components/booking/BookingWizard/useBookingWizard.ts:152-156`

**Reported:** the booking wizard ends with *"Booking failed. Please try again."*
instead of redirecting to the PayMongo sandbox. Suspected cause: PayMongo.

#### ✖ Not PayMongo — proved from the code path, not inferred

`confirmBooking()` maps four outcomes to four distinct toasts
(`useBookingWizard.ts:142-176`):

| Outcome | Toast |
|---|---|
| `already_booked` | "You already have a booking for this slot." |
| `full` | "This slot is now fully booked…" |
| **`error` / no id** | **"Booking failed. Please try again."** |
| PayMongo session fails | *"Payment setup failed. Please try again."* |

The observed toast is the **third**. PayMongo is only contacted *after* a booking
id exists (`:160-164`), so a PayMongo or sandbox outage produces the **fourth**
message. **The PayMongo API was never called.** Whether the sandbox still works is
irrelevant to this symptom.

#### The insert never reached the server

| Evidence | Finding |
|---|---|
| Postgres log, **entire history** | Exactly **one** booking-related error — one this investigation caused deliberately, to first prove `log_min_error_statement = error` actually records them |
| Kong gateway log, **entire history** | Exactly **one** `POST /rest/v1/bookings` — from `curl`, this investigation. **Zero from the browser** |
| Auth log | Ben's session `token_refreshed` → 200 at 19:28; healthy *now* |
| Auth log, just after the reset | `401` on `user_portals` for Ben at 18:16:12 from `localhost:3002`, then `refresh_token_not_found` 400s at 18:17:28 |

So the request was never made. In `createBooking` exactly one path returns
`"error"` without touching the database:

```ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { id: null, result: "error" }
```

**Root cause (high confidence): a dead session after `supabase db reset`.** The
reset wipes and reseeds `auth.users` / `auth.refresh_tokens`, so a browser holding
a pre-reset session has a refresh token the server no longer knows — exactly the
`refresh_token_not_found` seen at 18:17. A signature-valid access token keeps
serving reads until it expires, which is why the wizard's earlier steps loaded
normally while `getUser()` returned nothing.

**Not reproducible now:** the same insert succeeds as Ben through PostgREST with a
freshly signed token (201, `fulfilment_pattern` correctly snapshotted to `custody`).

#### The real defect, and it is worth fixing

**Being signed out is reported as "Booking failed. Please try again."** — a message
that is both wrong about the cause and useless as instruction: retrying will never
work, because the session is gone. The user is left believing the booking system is
broken. This is pre-existing, not introduced by the fulfilment work, but it is what
turned a routine expired session into a bug report.

**Fix approach:** distinguish the two. Add `"not_signed_in"` to
`CreateBookingResult`, return it from that guard, and give it its own toast —
*"Your session expired. Please sign in again."* Ideally the wizard also preserves
the draft (it already persists one) so the booking is not lost on re-login.

**Blast radius:** one new union member, one new branch. No schema, no DB, no other
caller — `createBooking` has a single call site.

**Verification:** machine — `tsc`, `build`. Live — sign in, clear the auth entry
from localStorage (or `db reset` in another terminal), then complete the wizard:
the toast must say the session expired, not that the booking failed.

> **✅ DONE (2026-08-01).** `CreateBookingResult` gained `"not_signed_in"`
> (`bookings.service.ts:18`); the auth guard returns it (`:23`); the wizard
> branches on it before the generic failure (`useBookingWizard.ts:152-160`) with
> *"Your session has expired. Please sign in again to finish this booking."*
> **Draft preservation confirmed by inspection:** `WIZARD_DRAFT_KEY` is only
> removed on the success path (`:187`) and in `reset()` (`:193`), both after the
> new early return — so the in-progress booking survives re-login and the wizard
> restores it.
> **Verified:** `tsc --noEmit` 0, `npm run build` 0.
> **Not verified — needs a browser:** the toast text on a genuinely expired
> session. The condition is hard to force without invalidating a live session.


---

## DECISIONS

<!-- No item may execute while an OPEN: line remains. B1 is unaffected and safe to run. -->

- I1: what was actually missing on screen? → **Nothing — report withdrawn**
  (resolved 2026-08-01). The reporter retested with a new offering and it appeared
  correctly. The offering form was additionally confirmed to persist
  `fulfilment_pattern` (`Phone Rental` → `custody`), ruling out the one real bug
  that "it shows as a service" could have indicated. Original options, kept for
  the record:
  - **(a) You were looking for the schedule's name.** Then I1 becomes a scope
    question — should bookers ever see schedule titles? *My read: this is the most
    likely explanation.* Recommendation: **no**, the title is vendor-internal
    scheduling metadata, and exposing it leaks naming like `<Myu court rental` to
    customers. Instead close it with I2 so vendors understand what bookers see.
  - **(b) Aug 4 showed no slot in Step 3** with Citywide + Court Rental selected
    and the calendar on August. Then there is a real client-side bug I have not
    reproduced, and I need the browser console plus the network response.
  - **(c) Citywide or Court Rental never appeared** in Steps 1–2. Both queries
    return correctly as Ben, so this would point at stale client state — worth
    retrying in a private window first.
  - **(d) Only Sunday/Monday were missing.** Then it is finding (b) above, not a
    bug: I2 alone covers it.

---

## DEFERRED / COSMETIC

- **The literal spacing between the payouts card and what follows** — not worth a
  separate item. Once B1 stops Overview mounting underneath, there is nothing
  below the table to crowd. Re-check after B1 and only then decide whether any
  margin change is warranted.

---

## Execution order — as executed

1. **B1** ✅ — done 2026-08-01.
2. **I1** ✖ — closed without work; not a defect.
3. **I2** ⏸ — parked; real but unrequested.
4. **I3** ✅ — done 2026-08-01.

---

## Verification

| Item | How | Kind |
|---|---|---|
| B1 | `tsc` + `build`; then visit all six nav entries and confirm exactly one page renders | build machine-verifiable; render needs-live-environment |
| B1 (regression) | Confirm Overview itself still renders, and an unknown `page` value still falls back | needs-live-environment |
| I2 | Create a weekly schedule starting mid-week; the form preview must match the dates booker offers | needs-live-environment |
| I3 | `tsc` + `build`; draft-preservation confirmed by inspection of the removal sites | machine-verifiable; toast text needs-live-environment |
| I1 | Closed without change — reporter retested and it worked; offering form confirmed to persist `fulfilment_pattern` | needs-live-environment (done by reporter) |
