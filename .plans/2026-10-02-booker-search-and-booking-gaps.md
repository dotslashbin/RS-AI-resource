# Booker — search and booking gaps (review)

**Date:** 2026-10-02
**App / scope:** `./booker` web — Explore/search (`lib/search.ts`, `components/explore/`) and the booking path (`components/booking/`, `services/schedules.service.ts`, `services/bookings.service.ts`). Read-only: `backbone/supabase/migrations/` and `architecture/`.
**Status:** IN PROGRESS — **done: B1, S1, S3, K1, K2, K3, K5, K6, K8, K10, K11, X1, X2, C2, G1, G3, G4, G4-command, G5.** Committed 2026-10-04 across booker, command, backbone and root. booker: `tsc` clean, **210** unit tests, lint **17**, **97/97 visual on two consecutive runs**. command: `tsc` clean, **147** unit tests, lint at its 24 baseline. **Remaining, all needing the user:** K7 (product call), K9 (payment call deleted in f331560), C1 (cross-app, vendor), D5 → G2 → S2, K4, and the wrong data left on booking `0d5481dd`. History: D1–D8 resolved; G1, G3, G4, G5 applied by the user.

> One-line framing: find what is missing or wrong in booker's search and booking features, grounded in the code rather than in the docs — which turned out to disagree with the code twice.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, S# = Search, K# = Booking, X# = doc correction; numbers are plan-local.

**Explicitly out of scope** (the user's instruction): everything payment — PayMongo, `app/api/payment/*`, the Payments page, `create-session`'s missing `is_paid` guard (tracked as the redesign plan's F3/P2). One finding sits on the boundary and is flagged rather than buried: see **K4**.

---

## What was actually checked

Read, not assumed: `lib/search.ts`, `lib/divisionMatch.ts`, `components/explore/ExplorePage/*`, `components/explore/OfferingPage/*`, `services/offerings.service.ts`, `components/booking/BookingWizard/useBookingWizard.ts`, `components/booking/steps/Step3Schedule/useStep3Schedule.ts`, `components/booking/steps/Step4Documents/*`, `services/bookings.service.ts`, `services/schedules.service.ts`, `lib/bookerActions.ts`, plus the `bookings`, `vendors` and `offerings` migrations and four `architecture/` docs.

### Two things the docs claim that the code contradicts — corrected below as X1 and X2
The review was nearly written from `booking-flow.md`, which would have produced two confidently wrong items. Both are now doc bugs, not product bugs.

### One suspected gap that is NOT real — recorded so it is not re-raised
**"Explore may list offerings from unverified vendors."** Checked and false. `getCatalogue` applies no vendor-status filter itself, but `vendors!inner` drops any row RLS hides, and `20260515000001_booker_vendor_read_policy.sql` admits only vendors whose status is `active`. Since 2026-09-30, activation *requires* an approved KYC packet, enforced in the database by `enforce_vendor_activation_requires_kyc` (`architecture/vendor-kyc.md:221-228`) — not merely in Command's UI. So the chain holds end to end. The service already says so in a comment; that comment is accurate.

---

## BLOCKERS

### B1 — the wizard tells the booker their documents are uploaded; nothing is ever sent  ✅ DONE — build + **live check passed** (2026-10-03), live check outstanding

**✅ BUILT (2026-10-03).** New `lib/bookingDocuments.ts` (pure rules + `extensionFor`) with
`lib/bookingDocuments.test.ts`; new `services/bookingDocuments.service.ts` (upload + row insert);
`UploadEntry` now carries the `File`; `useBookingWizard` validates on selection and uploads right
after `createBooking()` returns an id; `Step4Documents` says **selected**, not uploaded, shows a
per-file rejection reason, and states that files are sent on confirm; the gallery fixture gained a
real `File`.
**Verified (machine):** `tsc` clean, **182 tests** (5 new), lint at its 18 pre-existing baseline.
Read-only SQL against local confirms the bucket is private at 10 MB with the three MIME types and
all four policies exist with the right commands.
⏸ **NOT verified: an actual upload.** That needs a signed-in booker and a real booking — no local
fixture can do it (the gallery is client-only with no session).
➡️ **Filed 2026-10-03 as L5 on `.plans/2026-09-29-booker-live-verification.md`**, the plan that owns
checks needing a live environment. Parked there until the staging push.
⚠️ **Design note worth keeping:** the upload cannot happen at step 2. Both the storage and table
policies resolve ownership through a `bookings` row that does not exist until step 4, so the file
is held in memory and sent on confirm. If a document fails there the booking already exists, so
failures are **named to the booker** ("Booked, but we couldn't attach X") rather than swallowed —
swallowing would recreate exactly the bug this item fixed.
⚠️ **The 5 MB limit is now real.** The UI had promised it since it was written and enforced
nothing; the bucket's 10 MB is the backstop, and a test asserts the client limit stays below it.
**Files:** `components/booking/BookingWizard/useBookingWizard.ts:115-117` · `components/booking/steps/Step4Documents/Step4Documents.tsx:26` · `components/booking/steps/Step4Documents/useStep4Documents.ts`

```ts
function handleUpload(id: string, file: File) {
  setUploads(p => ({ ...p, [id]: { name: file.name, size: file.size } }))
}
```

**The `File` is discarded at the moment of selection.** Only its name and size are kept, so there is no object left to upload even if a later step wanted to — this is not "the upload call is missing", it is "the file is gone".

⚠️ **The escalation over the known gap.** `architecture/portals.md` records this as *"Document uploads not persisted — files are selected and shown in the UI but not sent."* That undersells it: the screen renders a progress bar to 100% and the words **"N of M required uploaded"** (`Step4Documents.tsx:26`), and `allDocsUploaded` (`useBookingWizard.ts:93`) **gates the step on it**. So the booker is told, in those words, that a required document was uploaded; the vendor receives nothing; and nothing anywhere records that the document is missing. For an offering whose requirements are the point — an ID for a rental, a licence for a lesson — the booking completes against a promise the system did not keep.

**Fix direction:** either persist for real (keep the `File`, upload to the `offering-attachments` private bucket after the booking row exists, write `booking_documents`), or stop claiming it. **These are very different sizes** → **D1**.
⚠️ The storage half is not greenfield: the private bucket and its policies exist (`20260829000002_attachment_storage.sql`), and `booking_documents` is in the schema. The ordering problem is real though — documents are collected at step 2 and the booking row is not created until `confirmBooking()` at step 4, so a real upload needs either a deferred upload after insert or a temporary path keyed to the booker.

---

## SEARCH

### S1 — an offering's description is fetched, shown, and not searchable  ✅ DONE (2026-10-03)
**File:** `lib/search.ts:103`
```ts
if (terms.length && !hit([o.name, o.category, v.name, v.city, v.divisionName], terms)) continue
```
`description` is selected by `getCatalogue` (`services/offerings.service.ts:68`), stored on `CatalogueOffering`, and rendered on the Offering page — but it is not in the haystack. A booker searching a word that appears only in the description ("beginner", "wheelchair", "equipment provided") gets **no results**, on a catalogue that contains the word.
**Fix approach:** add `o.description` to the service haystack. One array element, and `lib/search.test.ts` already has the fixtures to cover it.
⚠️ **Check the cost before assuming it is free.** Matching is substring over a joined string per offering per keystroke; descriptions are the longest field in the row. Measure against the real catalogue size before shipping — if it bites, it is an argument for P6 (server-side search), not for a different client-side matcher.

**✅ DONE (2026-10-03).** `description` added to the service haystack (`search.ts`), declared
**optional** on `SearchOffering` so the structural type still fits callers that have none.
**Measured rather than assumed**, 20 searches per point, two terms:

| catalogue | without description | with |
|---|---|---|
| 500 | 0.21 ms | 0.23 ms |
| 2,000 | 0.54 ms | 0.87 ms |
| 10,000 (the `fetchAllPages` ceiling) | 2.49 ms | **4.11 ms** |

So the worst realistic case is ~4 ms per keystroke against an in-memory list — inside a frame,
and no argument for P6 yet. **Verified:** 2 new tests (a description-only match; an offering with
no description still matching and not crashing).

### S2 — Explore advertises offerings that cannot be booked  ✅ DONE — build (2026-10-04), live after G2 is applied
**Files:** `services/offerings.service.ts:60-121` · `components/explore/ExplorePage/ExplorePage.tsx` · `components/explore/OfferingPage/OfferingPage.tsx:164`
The catalogue is `offerings` joined to `vendors` and `divisions`. **Nothing in it knows whether an offering has a schedule.** An offering with no schedule rows, or whose schedules have all elapsed, is listed in Explore like any other, with its price and its division mark. The booker learns the truth only after opening it, where the Book button is replaced by a disabled **"No times available"**.
The same is true of date-granular offerings (K1), which are listed and then refused.
**"Why would there be an unbookable offering anyway?"** (the user's question, 2026-10-02) — four real causes, none of them exotic:
1. **A vendor creates the offering before publishing any schedule.** This is common enough that the vendor app has a whole plan about the handoff (`.plans/2026-08-14-vendor-offering-to-schedule-handoff.md`).
2. **Every schedule has elapsed** — a seasonal or one-off offering that was never extended.
3. **It is date-granular** (K1): listed, and blocked by booker on purpose.
4. **A vendor "pauses" by deleting schedules** rather than setting the offering inactive — the offering stays `is_active = true` with nothing to book.
⚠️ **So marking it treats a symptom whose causes are mostly vendor-side.** The durable fix is prompting the vendor (1 and 4 are both "you published something nobody can book"), and that is a vendor-app change. Marking is still worth doing — a booker should not click into a dead end — but it should not be mistaken for the cure.

**Fix direction:** there is no cheap correct answer, which is why this is a decision — see **D2**. ⚠️ **Filtering the catalogue by "has a schedule" is the tempting wrong fix**: it is one schedules query per offering, which is exactly the fan-out `useExplorePage.ts:26-29` refused for the "When" filter (parked P10), and it would hide an offering whose vendor publishes schedules weekly.

**✅ BUILT 2026-10-04** on G2's signal. `services/offerings.service.ts` gains
`getUnbookableOfferings()`; `useExplorePage` fetches it **once for the whole catalogue** (not per
visible card — the answer does not depend on the filter, and one call is the point of G2);
`OfferingResultCard` renders a **"No dates yet"** chip.

⚠️ **MARKED, NOT HIDDEN OR DIMMED.** With 25 of 35 unbookable in the seed, dimming would grey out
most of the catalogue and read as a broken page. The card stays fully interactive: the offering and
its vendor are real, and a booker may still want to see them.
⚠️ **"No dates yet", not "Unavailable"** — the usual cause is a vendor who has not published a
schedule *yet*, and it matches what the Offering page already says on arrival.
⚠️ **`null` from the lookup marks NOTHING**, exactly like an empty set. Empty means "all bookable";
`null` means the call failed. Both render the same, but only one is a fact — the F1 rule again.

⚠️ **The first chip was broken and the baseline caught it.** Placed beside the division chip in the
cover's flex row, it wrapped to **three lines** inside a blob and overflowed the 236px card. It is
now absolutely positioned at the cover's top-right with `white-space: nowrap`, clear of the
division chip. Both captures reviewed in both themes.

**Verified:** `tsc` clean, 210 unit tests, lint **17**, `next build` compiles, and the capture run
failed on exactly the two new snapshots out of 99 — nothing else moved. Then **99/99 on two
consecutive full runs**.
⏸ **Not live until the user applies `20261004000002`.** Until then `getUnbookableOfferings()`
returns `null` (the RPC does not exist) and **nothing is marked**, which is the correct degradation
rather than an error.

### S3 — a blank category produces a blank pill  ✅ DONE (2026-10-03)
**File:** `lib/search.ts:147-154`
```ts
for (const o of offerings) counts.set(o.category, (counts.get(o.category) ?? 0) + 1)
```
No empty-value guard — while `cityOptions()`, **seven lines below it**, has exactly that guard (`.filter(Boolean)`). This is not hypothetical: `offerings.category` is `text not null default ''` (`20260506000001_offerings.sql:19`), so **every offering a vendor leaves uncategorised carries `''`**, and `''` is a perfectly good Map key. With enough of them it wins a top-6 slot and Explore renders a pill with no text that, when tapped, commits an empty search.
**Fix approach:** `.filter(Boolean)` on the offerings before counting, matching its neighbour. One line, plus a `search.test.ts` case asserting a blank category never reaches the list.

**✅ DONE (2026-10-03).** `popularCategories` skips empty categories. **Verified:** a test where the
blanks **outnumber** the real category, so a missing guard would put `''` first — it asserts the
list is `["Massage"]` alone.

---

## BOOKING

### K1 — a whole bookable mode is unavailable: day/week/month offerings  ✅ DONE (2026-10-03)
**Files:** `components/explore/OfferingPage/OfferingPage.tsx:145-151` · `components/booking/steps/Step3Schedule/useStep3Schedule.ts:39,42,63,90` · `components/booking/BookingWizard/useBookingWizard.ts:101`
A vendor can create a `day`/`week`/`month` offering, the database validates such bookings (`check_booking_placement()` handles date-granular spans), and the booker **cannot book one**. The Offering page shows a disabled button reading *"Booking by date isn't available yet"*.
✅ **Honest, and contained** — this is signposted rather than a dead end, which is why it is not a blocker. See **X1**: the architecture doc still describes the trap that this guard removed.
**What is actually missing** is small and already half-built: `useStep3Schedule` detects the mode and computes `dateRange`, and nothing consumes it; `Step3Schedule.tsx` has no render arm; `canNext` requires `!!time`, which this mode never sets.
**Fix direction:** render the `dateRange` the hook already returns and widen `canNext` to accept a date-granular selection. Tracked historically in `.plans/2026-08-03-offering-duration-and-booking-units.md` and as P5.

⚠️ **STOPPED HERE 2026-10-03 — this is a design decision, not an implementation detail (D7).**
Everything else on this plan that needed no decision is done. What the investigation established,
so the question is concrete rather than abstract:
- `getDateRange()` returns the **overall span** (`{from, to}`) across the date-granular schedules —
  not per-date availability. `to` is null when any schedule is open-ended.
- `get_slot_occupancy(p_schedule_ids, p_from, p_to)` is already **date-range keyed**, so capacity
  for a date mode is obtainable through the existing RPC — no new backend work.
- `quantity` already exists and, in the time mode, spans **consecutive** slots with
  `spanAvailable()` walking every one. `check_booking_placement()` validates date-granular spans
  the same way, so multi-day is supported by the database today.
- `canNext` is `!!date && !!time`; the date mode never sets `time`.

**D7 — how does a booker pick a day/week/month?** → **(a) one date plus a quantity** (resolved 2026-10-03). Built; see this item's DONE note. The options below are kept as the record.
  (a) **One date + a quantity control**, mirroring the time mode exactly ("3 days from 14 Oct").
  Most consistent with what exists, reuses `quantity` and `spanAvailable`'s shape, and is the
  smallest change. *Recommended.*
  (b) **A start/end range picker** ("14–17 Oct"). More natural for a stay or a hire, but it is a
  second selection idiom on the same calendar, and the quantity it implies still has to be derived.
  (c) **Single date only, no multi-day for now.** Smallest of all, but it refuses something the
  database already supports, and a `week`/`month` offering would be odd with no count.

→ **(a) chosen by the user 2026-10-03.**

**✅ DONE (2026-10-03).** One date plus a quantity, sharing the time mode's control.
- `lib/slots.ts` gained `dateSpanEnd()` and `maxDateUnits()` (+ 5 tests in `slots.test.ts`).
- `useStep3Schedule` exposes `maxQuantity` (range-bounded in this mode) and `dateSpanEndsOn`.
- `Step3Schedule.tsx` gained the render arm the mode never had.
- `useBookingWizard`: `canNext` is `!!date && (dateGranular || !!time)`, and a new
  `handleSelectDate` resolves the schedule by date — without it `selectedSchedule` stayed null
  and `confirmBooking()` returned early, so the booking would have silently not happened.
- `services/schedules.service.ts` gained `resolveScheduleForDate()`.
- `OfferingPage` offers **Check dates** when a date-granular schedule exists, and an honest
  "No dates available" when the vendor has published none.

⚠️ **A real bug in my own first cut, caught by a test I wrote before believing it.** The span
maths added `durationMinutes × units × 60_000` to a timestamp. Across a DST boundary that is not
a whole number of days: 30 Oct + 3 days landed at 23:00 on **1 Nov**, so a three-day booking
reported a two-day span. Rewritten to move whole calendar days with `setDate()`.

**Verified:** 190 tests (5 new), `tsc` clean, lint back at its 18 baseline after removing an
import my change orphaned. **And the new functional test was mutation-checked** — with the render
arm disabled it fails, which is the thing the pre-existing `step3date` test could not do.

⚠️ **A SECOND gap in my own work, caught by looking at the re-recorded capture rather than
trusting a green suite.** The first cut rendered the span but **not the quantity control**: the
time mode's stepper is gated on `time &&`, which this mode never sets, so "one date plus a
quantity" was half built — and the screenshot looked perfectly fine, because what was missing was
a control, not a defect in what rendered. The comment I had written claiming the control was
"shared" was simply false. The stepper is now repeated in the date arm, and the functional test
asserts it is present, so the same half-build cannot pass again.

**Baselines:** `step3date-light/dark` re-recorded after review; **two consecutive full runs at
90/90, exit 0** (the suite gained the new functional test).
⚠️ **The existing visual test does not protect this** (`visual-tests/pilot.spec.ts`, `step3date` mode): it asserts the *absence* of time slots, which is the intended half, and never asserts the booker can proceed. It is green today and would stay green if the fix regressed.

### K2 — a booker cannot cancel a booking, by any route  ✅ DONE — build + **live check passed** (2026-10-03)
**Files:** `lib/bookerActions.ts:32-36` · `backbone/supabase/migrations/20260507000004_bookings.sql:105-144`
`bookerActionFor()` offers exactly three actions — confirm done, mark returned, undo return — plus flagging. **There is no cancel**, and no UI anywhere in booker offers one (grepped: every `cancel` hit is a dialog dismiss or the payment-return branch).
The data layer agrees: bookers hold **SELECT and INSERT** on `bookings` and **no UPDATE policy at all**. The booker actions that do exist work because they go through SECURITY DEFINER RPCs (`acknowledge_booking`, `raise_booking_dispute` — `services/bookings.service.ts:222,231`).
So a booker who books the wrong slot, or cannot attend, has **no action available**: they wait for the vendor to cancel (`booking_cancelled` notification, `schema.md:1054`) or raise a dispute, which is a complaint, not a cancellation.
**✅ BUILT (2026-10-03), after G1-style approval and application of G3.**
- `lib/bookerActions.ts` — `cancelBlockedReason()` / `canCancel()` + `CANCEL_NOTICE_HOURS`, with a
  new `lib/bookerActions.test.ts` (7 tests).
- `services/bookings.service.ts` — `cancelBooking()` returning a `CancelResult` keyed on the RPC's
  **`hint`**, not its message text, so rewording the copy cannot break the client.
- `useBookingDetailModal` — a two-step confirm, because `cancelled` has no way back for a booker.
- `BookingDetailModal` + its stylesheet — the control, hidden entirely unless the booking is
  cancellable.
- `app/ui-gallery/page.tsx` + `pilot.spec.ts` — a new **`bookingcancel`** mode.

**Verified in a browser:** the button shows on an unpaid `pending` booking; the confirm step shows
its prompt, its "cannot be undone" note and both buttons; **"Keep it" backs out without acting**;
and the `fulfilled` booking offers **no** cancel at all. 197 unit tests, `tsc` clean, lint at its
18 baseline, `next build` compiles.

⚠️ **The client rules MIRROR the RPC and must keep mirroring it.** `canCancel()` repeats all three
conditions so the button is never offered for something the database will refuse — but the RPC
re-checks under a row lock and may still say no, because a vendor can confirm, a payment can land
or the 24-hour line can pass while the modal is open. Each refusal has its own sentence; "try
again" is the wrong instruction for all three.

⚠️ **A paid booking offers nothing, deliberately.** G4 is not built, so the refusal names the real
route in words rather than showing a "Request a refund" button that does nothing — which is the B1
mistake.

⚠️ **New coverage, because there was none.** `bookingdetail` uses the **fulfilled** booking, which
can never be cancelled, so the control would have shipped unseen by every capture. That is exactly
how B1's copy reached a shipping screen. ⚠️ The two `bookingcancel` baselines were **generated from
this code** and need the user's eye before they are committed.

**Baselines:** the two new `bookingcancel` captures were written by the failing first run (the
documented missing-baseline behaviour), reviewed, then **two consecutive full runs at 92/92, exit 0**.
Nothing else in the suite moved — consistent with the browser check that a `fulfilled` booking
offers no cancel.

⏸ **NOT verified: a real cancellation.** It needs a signed-in booker with an unpaid booking — no
local fixture has a session.
➡️ **Filed 2026-10-03 as L6 on `.plans/2026-09-29-booker-live-verification.md`.** ⚠️ L6 also carries
the regression half that matters more than the button: G3 widened the **shared** status-transition
trigger, so a vendor confirm, a kiosk close-out and a dispute resolve are checked alongside it.

⚠️ **This cannot be built in booker alone.** A cancel needs a new SECURITY DEFINER RPC with its own rules — which statuses may cancel, how close to the booked date, what happens to a paid booking (refunds are payment territory and out of scope here) — and that is a **schema change behind an approval gate**. → **D3**.

### K3 — the resume card advertises a step the resume does not restore  ✅ DONE (2026-10-03) — ⚠️ RESTATED, my original description was wrong
**File:** `components/booking/BookingWizard/useBookingWizard.ts:81-90`
The draft written to `localStorage` carries `step`, `vendorId`, `offeringId` and `offeringName` — deliberately, so resuming reopens the offering (plan I15). It does **not** carry the chosen date or time, so resuming at step 2 or 3 returns the booker to a wizard whose `date`/`time` are empty while the stepper shows them past step 1.
⚠️ **MY ORIGINAL ITEM WAS WRONG, corrected 2026-10-03 by reading the resume path.** I wrote that
resuming "returns the booker to a wizard whose `date`/`time` are empty while the stepper shows them
past step 1". It does not: `useAppShell.resumeDraft()` calls `goOffering()` and reopens the
**Offering page**, and `useBookingWizard` always initialises `step` to 1. **The draft's `step` is
written and never read back.**

**The real gap, which is smaller:** `InProgressCard` rendered *"Step 3 of 4 — Review"*, promising a
continuation the app does not perform. Nothing invalid could ever be booked — that part of the
original item was right.

**✅ DONE (2026-10-03).** The line now reads *"You reached Review — pick your slot again to carry
on"*. The stepper dots above it are kept, because as a record of **how far they got** they are
true; it was only the sentence that implied the wizard would resume there.
**Verified:** `tsc` clean; the claim itself was verified by reading `useAppShell.ts:507-510` and
`useBookingWizard.ts:44`, which is what showed the original item to be wrong.

### G5 — BLOCKER: a refund request can never be closed  ✅ DONE — applied by the user + **live check passed** (2026-10-03)
**Files:** `resolve_booking_dispute()` (needs a new migration) · trigger
`validate_booking_status_transition()` line ~126 (the note gate) · depends on G4.

⚠️ **G4 ships a refund request that Command cannot resolve.** Measured, not reasoned — the whole
flow was run against the local database inside a rolled-back transaction (booking `2d06982a`,
booker `…0014`, admin `…0001`):

```
STEP 1 ok  -> dispute kind=refund_request  booking status=confirmed   (D8-c, as designed)
STEP 1     -> payout_status=held                                      (money correctly frozen)
STEP 2 *** FAILED *** Command override of confirmed -> refunded requires a reason.
                      Set app.status_change_note (…)  | SQLSTATE=P0001
```

**Root cause — D8-c collided with a gate neither of us looked at.** The trigger exempts dispute
resolution from its "Command must say why" rule with `if v_third_party and old.status <> 'disputed'`
— the exemption is keyed on the booking being **`disputed`**, on the stated grounds that a dispute
"carries its own resolution_notes". A refund request **keeps its real status** (`pending`/
`confirmed`) by decision D8-c, so it is **never exempt**, and `resolve_booking_dispute` does not set
`app.status_change_note` anywhere in its body. Every refund resolution therefore raises.

⚠️ **This is my miss, and the specific shape of it is worth recording.** For G4 I verified that the
*transition* `confirmed → refunded` was permitted, and stopped there. The transition is permitted;
a **second, independent gate** further down the same trigger then rejects the write. Checking an
arm of the `if` is not the same as checking the function.

⚠️ **IT WOULD HAVE PASSED A CASUAL LOCAL TEST.** `v_third_party := v_command and not v_booker and
not v_vendor`, so when the Command admin *is* the booker the note is never required — and this
repo's seed gives Root Admin and a booker **the same id** (`…0001`). The failure needs a booking
belonging to someone else, which is every real booking and only some seeded ones.

**Fix direction (ONE line, needs the user's approval and a new migration):** have
`resolve_booking_dispute` set the note from the reason it is already given, immediately before the
booking update —
`perform set_config('app.status_change_note', coalesce(nullif(trim(p_notes),''), 'Dispute resolution'), true);`
This satisfies the gate with the *same* justification the exemption was written for, rather than
widening the trigger (which cannot tell a resolution from any other write). Alternatives considered:
exempt `refund_request` in the trigger — rejected, the trigger cannot see the dispute; or require
non-empty notes on resolve — a product change, and still needs the `set_config`.

**✅ MIGRATION WRITTEN AND PROVEN, NOT APPLIED:**
`backbone/supabase/migrations/20261003000003_resolve_dispute_status_note.sql`. One added
`set_config` in `resolve_booking_dispute`; the trigger is untouched, because it cannot tell a
dispute resolution from any other Command write and widening it there would relax every status
change. Pattern and the transaction-local `true` match
`20260801000008_payout_release_and_override.sql:90`.

⚠️ **Based on `20260801000005` after verifying it is the live body** — diffed against
`pg_proc.prosrc`, identical but for blank lines; the function had never been replaced. Same
signature, so `create or replace` replaces rather than overloading (the G4 trap).

**Verified by loading the migration inside a transaction and rolling it back** — the function on
the database is still the old body, confirmed afterwards by `position('status_change_note' in
prosrc) = 0`:

```
CASE 1 refund request  -> PASS  booking=refunded  payout=reversed
CASE 2 empty notes     -> PASS  booking=refunded        (the '' fallback holds)
CASE 3 complaint raised -> booking=disputed
CASE 3 complaint        -> PASS  booking=completed      (regression: unchanged)
```

**Footprint after the run:** 1 open dispute (the user's own), 0 refunded bookings changed today,
no session note left set. Nothing persisted.

**✅ APPLIED BY THE USER AND VERIFIED LIVE THROUGH THE UI (2026-10-03).** Confirmed in the database
rather than taken on trust: `resolve_booking_dispute` now contains the `set_config`
(`position('status_change_note' in prosrc) > 0`), and booking `82dbdfb3` ran the full path —

| field | value |
|---|---|
| booking status | **`refunded`** |
| payout_status | **`reversed`** |
| dispute | `resolved`, outcome `refunded`, kind `refund_request` |
| resolution notes | "Testing mark refunded" |

This is the first end-to-end refund in the system: booker request → Command queue → resolution,
across two apps and three migrations.

**Test fixtures created on request (2026-10-03, local only).** Two bookings on the user's own
**Recovery Massage** offering, so the walkthrough is not done against seed rows that all share the
name "Private Coaching Session":

| id | date | purpose |
|----|------|---------|
| `82dbdfb3` | 2026-10-07 | TEST A — happy path, resolve as `refunded` |
| `0d5481dd` | 2026-10-08 | TEST B — strand, advance to `fulfilled` (K7) |

Both `pending` + `is_paid`, each with a real `booking_transactions` row (fee ₱148.08, payout
₱1,085.92, `held`) **created by the `bookings_create_transaction` trigger**, not written by hand —
flipping `is_paid` is the webhook's only write, so the ledger is genuine.
⚠️ **Two conventions bit on the way in, both worth remembering:** `schedules.days_of_week` is
**0=Mon**, not `extract(dow)`'s 0=Sun (the trigger converts via `isodow`), and
`capacity_per_slot = 1` on this schedule, so the two bookings need different dates rather than two
slots on one day. Delete both rows when finished; they are local-only test data.

**Live impact right now:** the user's own refund request `b83c9849` on booking `afadfef7`
(`confirmed`, paid, booker `…0003`, payout `held`) is open and **will hit this** on Mark refunded.

### K9 — booker cannot take payment at all: the PayMongo call is missing from the client  ✅ DONE (2026-10-04)
**File:** `components/booking/BookingWizard/useBookingWizard.ts` — the call is **absent**;
`app/api/payment/create-session/route.ts` is intact and has **no caller**.

⚠️ **Out of this plan's declared scope** (the user excluded payment) **and logged anyway**, because
it is a live defect in the money path and it has now derailed testing twice.

Nothing in `components/`, `services/`, `lib/` or `hooks/` references `/api/payment/create-session`
— verified by grep across the whole app, excluding the route itself. Pressing **"Pay ₱X"** runs
`confirmBooking()`, which creates the booking, uploads documents and renders
`BookingConfirmation`. **No checkout session, no redirect, no payment.** `is_paid` stays `false`
forever and the webhook never fires, because no session was ever created.

**When it went:** commit `f331560` ("S6: booking starts from an offering; remove the old first
steps", 2026-09-22) rewrote `useBookingWizard` and removed these lines without restoring them:

```
-    const res = await fetch("/api/payment/create-session", {
-    const { checkout_url } = await res.json() as { checkout_url?: string }
-    if (!checkout_url) {
-    window.location.href = checkout_url
```

⚠️ **`architecture/booking-flow.md:319-321` still documents the call as part of the flow**, so the
docs describe code deleted eleven days earlier. Fixing the doc without fixing the code would be
worse than leaving both.

**How it derailed testing, twice (2026-10-03):**
1. The user walked the Pay step expecting a paid booking; the booking was created `pending`/unpaid.
2. On a **Recovery Massage** booking (`21e0da8b`) they then saw **Cancel** rather than **Request a
   refund**, and nothing in Command. **Both were correct behaviour** — `is_paid = false` so D4
   routes to cancel, the controls are mutually exclusive by test, and a cancellation raises no
   dispute so the Flag Queue has nothing to show. Confirmed in the database: `is_paid = f`, **no
   `booking_transactions` row at all** (hard proof no checkout session was created), 0 disputes.

**Consequence for the remaining tests:** the refund path can only be exercised on **seeded** paid
bookings; no booking made through the UI can ever reach it.

**✅ DONE 2026-10-04**, on the user's explicit go-ahead. Restored in `confirmBooking()`; the route,
`lib/siteUrl.ts` and the webhook needed no change — they were never broken, just unreachable.

⚠️ **IT RUNS AFTER THE DOCUMENT UPLOAD.** The redirect navigates the browser away, and anything
started but not awaited before it is abandoned — the documents would have been the casualty. The
pre-`f331560` code had no documents step to order against; this one does.

⚠️ **The failure path offers CANCELLING, not retrying**, and that wording is load-bearing. If the
session cannot be created the booking already exists, and this wizard is the **only caller of
`/api/payment/create-session` in the app** — so "try again from Activity" would name a button that
does not exist. Cancelling is real: the booking is unpaid, so K2's control applies to it. A proper
"pay this booking" entry point belongs with **K4**.

⚠️ **A stale comment was removed in the same place**: `"Payment is the next step, handled by
StepPayment's redirect"`. `StepPayment` has no redirect and never did after f331560 — the comment
is the likeliest reason the deletion went unnoticed for twelve days.

**Verified:** `tsc` clean, 210 unit tests, lint 17, `next build` compiles. `PAYMONGO_SECRET_KEY` is
confirmed an **`sk_test`** key, so exercising this locally cannot move real money.
⏸ **The redirect itself is unverified** — reaching PayMongo's hosted page needs a signed-in booker
and a real click. **This is the one thing on this item that needs the user.**

### C2 — ⚠️ A flag could be resolved with NO outcome chosen, releasing a payout nobody authorised  ✅ FIXED (2026-10-04)
**Files:** `command/components/flags/FlagQueue/useFlagQueue.ts:14,28,40` · `FlagQueue.tsx` (submit button).

**This one moved real money on a real booking, so the mechanism is written out in full.**

`outcome` defaulted to `"completed"` and **"Confirm resolution" was enabled regardless**. On its own
that was survivable: before 2026-10-03 all three outcome buttons always rendered, so the default was
at least *visible* as the selected one. **G4-command's filtering removed the buttons and left the
default armed and invisible** — a booking whose status had no legal outcome rendered the orange
explanation, no buttons, and a live Confirm.

**What happened (user's own test, booking `0d5481dd`, 2026-10-04 04:03:29 UTC):**
1. A **refund request** was open on a booking the vendor had advanced to `fulfilled`.
2. `allowedOutcomes('fulfilled')` — wrong at the time, see G4-command — returned `[]`, so **no
   outcome buttons rendered**.
3. "Confirm resolution" was pressed. `outcome` still held its default `'completed'`.
4. The trigger permits `fulfilled → completed`, so it went through: dispute closed as
   **`completed`**, booking `completed`, and `booking_transactions.payout_status` → **`releasable`**.

**The customer asked for a refund and the vendor's payout was released instead, with no one having
chosen that outcome.** Timestamps confirm the ordering: resolved 04:03:29 UTC, my
`allowedOutcomes` fix landed 04:04:27 UTC — **58 seconds later**, so the bug was live.

**Fix:** `outcome` starts as `null` and stays null on open; submit returns early without one; the
button is disabled until something is chosen. A resolution moves money and cannot be undone from
that screen, so it is never implied. ⚠️ The `!outcome` guard in `submit()` is load-bearing, not a
type narrowing — the disabled button alone would be a UI-only defence.

**Verified:** `tsc` clean, 147 tests pass, lint at Command's 24 baseline, `next build` compiles.

**✅ THE CORRECTED LOGIC WAS EXERCISED LIVE 2026-10-04 by the user**, on a new offering
("Basics Intro", booking `35b45583`). `booking_status_log` gives the whole run:

```
04:16:50  pending   -> confirmed    (vendor)
04:17:52  refund request raised     (booker)
04:18:29  confirmed -> fulfilled    (vendor)
04:18:49  fulfilled -> completed    notes: "DOne"   <- resolved in Command
```

The fix landed **04:11:52 UTC, seven minutes before**, so it was live. From `fulfilled` the
corrected `allowedOutcomes` offers **only "Complete it"**, which is exactly what the trigger
permits — and that is what was chosen, with an internal note typed, resolving cleanly. Compare
`0d5481dd` an hour earlier, which went through the same transition with **no outcome chosen at
all**.

⏸ **Still unobserved specifically: the disabled "Confirm resolution" button** before a choice is
made. The run above proves a choice *was* made and honoured; it does not prove the button was
greyed out beforehand. One glance at the panel closes it.

⚠️ **DATA LEFT WRONG BY THIS, FOR THE USER TO DECIDE ON — NOT TOUCHED.** Booking `0d5481dd`
(Recovery Massage, 8 Oct) is `completed` with payout `releasable` and its refund request closed as
`completed`. `completed → refunded` is a legal Command transition, so it is correctable — but the
dispute is already resolved, so the route is the admin override RPC rather than the flag queue.
**Reported, deliberately left for the user to close.**

### K10 — BLOCKER: "Check dates" is dead — `hasDateSchedule` is never set  ✅ DONE (2026-10-04)
**File:** `components/explore/OfferingPage/useOfferingPage.ts:41`.

```ts
const [hasDateSchedule, setHasDateSchedule] = useState(false)   // <- the ONLY occurrence
```

**The setter is never called.** `grep -c setHasDateSchedule` returns **1**: the declaration. So the
flag is permanently `false`, and `OfferingPage.tsx:155` always takes the else arm — every
date-granular offering shows the disabled **"No dates available"** button and the line *"the vendor
has not published any dates yet"*, however many dates the vendor published.

⚠️ **THIS IS A BUG IN K1, MY OWN WORK.** K1 added the gate, the state and the render arm, and
wired every part except the one that makes it true. The result is that **the date mode has never
been reachable by anyone** — which also means my advice to "test Equipment Hire" was advice to walk
into this wall, and that K5's "N left" line sits behind a button nobody can press.

**It is not the recurrence.** The user's "Boat Parking" schedule stores `recurrence = 'none'` with
`start_date 2026-10-09`, `end_date 2026-10-14`, and that is **correct and bookable**: the database's
date branch states *"Recurrence does not apply: availability IS the date range"*, booker's own
`isOccurrence` short-circuits on `isDateGranular` before reading recurrence, and
`vendor/lib/occurrence.ts` does the same. All three agree. Only the unset flag disagrees.

**Fix approach:** set it from the schedules the effect already fetches, in the same place `staff`
is set — the data is in hand and no new query is needed:
```ts
setHasDateSchedule(dateGranular && schedules.length > 0)
```
⚠️ It must be set on **every** path through that effect, including the early return for
`dateGranular || schedules.length === 0`, or the flag stays stale when the booker moves between
offerings without remounting.

⚠️ **Why no test caught it.** `OfferingPage` fetches on mount and has **no gallery fixture** —
recorded in booker's own AGENTS.md as plan F12. The component that gates the entire date-granular
flow has no visual or behavioural coverage at all. **A fixture for it belongs with this fix**, or
the next regression here is equally silent.

**✅ DONE 2026-10-04.** `setHasDateSchedule(...)` is now called in the effect that already has the
schedules, **before** the early return, so it is set on every path — including to `false`, since the
hook does not remount between offerings and a stale `true` would offer dates that do not exist.

⚠️ **The gate is now a PURE, TESTED function**, `hasLiveDateSchedule()` in `lib/slots.ts` with
**5 tests**, one of which is the user's own Boat Parking range. The bug was a value that was never
computed; a pure function with a test cannot fail that way silently, which a flag set inside a hook
demonstrably can.

⚠️ **It also excludes a schedule whose range has already PASSED.** `schedules.length > 0` alone
would enable "Check dates" and then open an empty calendar — the same dead end by another route,
and exactly what "Equipment Hire" (one-time, 2026-04-01) would have done.

⚠️ **A second stale comment was corrected in the same place**, and it is probably the cause: the
code said date-granular booking was "still a dead end in the wizard (plan D11/P5)", which K1 made
untrue on 2026-10-03. The flag was never set because the comment beside it still described the old
world.

**Verified:** `tsc` clean, **210 unit tests**, lint **17** (one better than the 18 baseline),
`next build` compiles. The schedule's visibility was confirmed by querying as the booker under RLS
— 1 row, so the fix has real data to act on.
Full visual suite **97/97 on two consecutive runs** after both fixes — nothing else moved.
⏸ **Not verified live.** `OfferingPage` fetches on mount and still has **no fixture** (F12), so
this needs a human: open **Boat Parking** (Harbor Sports Complex) and expect "Check dates" enabled,
the calendar offering **9–14 October**, and K5's "N left on this date" visible at last.

---

### K11 — BLOCKER: every offering photo is blocked by booker's CSP  ✅ DONE (2026-10-04)
**File:** `next.config.ts:148`.

```
img-src 'self' data: https://*.basemaps.cartocdn.com
```

**The Supabase origin is not in `img-src`.** Storage photos are served from
`<supabase-origin>/storage/v1/object/public/…`, which is never the page's own origin, so the
browser **refuses the request before it is made**. The `<img>` element renders; nothing errors;
the picture is simply absent.

**So no offering photo has EVER displayed in booker**, on any surface — Explore result cards, the
Offering page gallery, the Vendor page, Home's "Available today", the Activity booking-detail
modal, and the wizard cover K8 just added.

⚠️ **This explains an earlier misdiagnosis of mine, and the correction matters.** On 2026-10-03
the user reported that Court Rental 1's photo did not appear. I verified the row, the object, the
RLS and the public URL (HTTP 200), found the wizard had no image element at all, and concluded that
was the whole story — logging K8. K8 was real, but it was **not** the reason the photo was
invisible. I checked everything except whether the browser was allowed to load it.

⚠️ **VENDOR ALREADY FIXED EXACTLY THIS, and booker never received it.** `vendor/next.config.ts`
carries `supabaseOrigin()` and `supabaseImgSrc()` from its plan **B32 (2026-09-04)**, whose comment
reads: *"Storage images were blocked on EVERY environment until 2026-09-04 … an uploaded offering
photo silently failed to render … Nothing errored; the browser refuses before the request."* The
three apps duplicate their CSP deliberately (conventions.md, "No Shared Code Between Apps"), and
the fix propagated to one of them.

**Fix approach — copy vendor's, do not invent one:** add `supabaseOrigin()` beside the existing
`supabaseConnectSrc()` and use it in `img-src`.
⚠️ **DERIVED from `NEXT_PUBLIC_SUPABASE_URL`, never `https://*.supabase.co`.** A wildcard matches
neither `http://127.0.0.1:54321` nor `'self'`, so it would look right in production and break
local — precisely how the 2026-08-08 incident passed review, as booker's own header warns.
⚠️ **`blob:` stays OUT.** Vendor's directive has it; booker's comment says it is deliberately
absent because nothing here creates object URLs. Copy the origin, not the whole line.
⚠️ The ws/wss variant belongs to `connect-src` only — an image is a plain GET.

⚠️ **Why no test caught it.** `csp.spec.ts` asserts that nothing is blocked by policy, but it
loads `mode=divisions`, whose marks are repo files under `/division-icons/` and therefore `'self'`.
**No fixture has ever requested a remote image.** The check that would have caught this is the one
that spec was written to perform — against a Supabase-hosted URL.

**Affects production as well as local**, since the directive has no Supabase entry in any
environment.

**✅ DONE 2026-10-04.** `next.config.ts` gains `supabaseOrigin()` and `supabaseImgSrc()`, mirroring
vendor's structure so the two files stay comparable, and `img-src` now appends the derived origin.
`blob:` deliberately stays out.

**Verified by MEASURING THE HEADER A BROWSER ACTUALLY RECEIVES**, not by reading the source — and
the three running dev servers identified themselves in the process:

| port | `img-src` | app |
|---|---|---|
| :3000 | `'self' data: blob:` | command — **no Supabase origin** (the flagged gap, still untouched) |
| :3001 | `'self' data: blob: http://127.0.0.1:54321` | vendor — has B32 |
| :3002 | `'self' data: https://*.basemaps.cartocdn.com http://127.0.0.1:54321` | **booker, with this fix live** |

Also confirmed on a fresh production build (`next start`), so it is not a dev-only artefact.
`tsc` clean, `next build` compiles.

**A regression guard was added**, in `visual-tests/csp.spec.ts`: it asserts `img-src` contains the
origin derived from `NEXT_PUBLIC_SUPABASE_URL`.
⚠️ It asserts the **derived origin**, not merely that some "supabase" string appears — a
`https://*.supabase.co` wildcard would satisfy a substring check while matching neither
`http://127.0.0.1:54321` nor `'self'`, which is exactly how the 2026-08-08 incident passed review.
⚠️ It reads `.env.local` as a fallback because **Playwright's own process does not load it** —
Next loads it for the app, not the runner — so without that the assertion would silently skip on
every local run. One key is read; only its origin is ever printed.
**✅ THE GUARD WAS RUN, AND PROVEN TO BITE.** Passing is not evidence on its own — a test written
from the same assumption as the code confirms the bug instead of catching it, which is exactly what
happened in G4-command three days earlier. So the fix was temporarily removed from `img-src` and the
spec re-run: it **failed**, with

```
Error: img-src must list http://127.0.0.1:54321 or every Supabase Storage image is
       blocked before the request is made.
```

The config was then restored and verified to still contain the fix. Full suite: **97/97 on two
consecutive runs** (exit 0, zero ✘ both) — the 97th test is this guard.

### K11-command — Command's `img-src` has the same shape, and it is CORRECT  ✅ INVESTIGATED, no change needed (2026-10-04)

Approved by the user as a cross-app item and **investigated rather than assumed**. The conclusion is
the opposite of booker's K11: **Command needs no Supabase origin in `img-src`.**

- Command renders **no Supabase-hosted image anywhere**. The only storage it touches is a KYC file.
- `useKycPanel.ts:96` opens it with `window.open(url, "_blank", "noopener")` — a **top-level
  navigation** into a document of its own, which no CSP directive of the opener governs.
- The `createSignedUrl` call that produces that URL is a **fetch**, and Command's `connect-src`
  already carries the origin, so the one governed request works.

**Adding the origin would widen a security policy for a request that is never made**, so it was not
added. The identical-looking directive is right in one app and wrong in the other, for a reason that
only shows up by reading the consumer — which is the point worth keeping.

**One real defect found: a comment that lied.** `img-src`'s note claimed `blob:` existed to cover
"signed-URL document previews opened from the KYC panel". There is no such preview. The blob URLs in
Command are **CSV downloads** (`useUsers.ts:205`, `usePayoutsPage.ts:383`) handed to an
`<a download>`, which `img-src` does not govern either. The comment is corrected; the directive is
left as-is, because removing `blob:` is a separate decision from fixing a comment.

**Verified:** `tsc` clean, 148 tests, lint at Command's 24 baseline, `next build` compiles, and the
live header on :3000 is unchanged (`'self' data: blob:`) — as intended, since only a comment moved.

### K8 — the wizard never shows what is being booked  ✅ DONE (2026-10-04)
**Files:** every step under `components/booking/` — the absence is the finding.

A booker crosses four steps and a payment commitment with **no image of the offering at any
point**. Verified by grep, not inference: `components/booking/` contains **no `<img>`, no `src=`,
no cover, and not even a `DivisionIcon`** — nothing visual identifies the thing being bought. The
Offering page the booker arrives from shows up to three photos (`OfferingPage.tsx:51`), so the
visual confirmation is present immediately before the wizard and then disappears for the rest of
the commitment.

**How it surfaced.** The user uploaded an offering photo, went through the booking flow, and asked
why it never appeared. The upload was flawless — traced end to end: row `is_active` with a path,
object present in `offering-photos`, bucket `public`, **the URL serves HTTP 200 `image/jpeg`,
42,525 bytes**, and the row is visible to a real booker under RLS (`is_active() = t`). The photo was
never the problem; the wizard simply has no place to show one.

⚠️ **Easy to misdiagnose as a broken upload, which is why this note is long.** Only **1 of 32**
active offerings has a photo, so the whole catalogue renders the division placeholder and looks
uniformly photo-less. Anyone checking this again should confirm the five surfaces that *do* read
photos — Explore result cards, the Offering page, the Vendor page, Home's "Available today" card,
and the Activity booking-detail modal — before suspecting storage.

**Fix direction:** a small offering header on the wizard — cover photo (the division placeholder
when there is none, reusing `OfferingResultCard`'s mask-painted fallback), name, vendor. One
component, consumed by all four steps; `useBookingWizard` already holds the offering, and
`getCoverPhotos` already exists. Not a redesign.

**Component separation:** a pure display component (no state, effects or handlers) — the one
exception the convention allows — so a `.tsx` plus a `.module.css`, no companion hook.

**🔄 BUILT 2026-10-04.** Narrower than the item first proposed, because the wizard's head
**already carried the name, the vendor and the city** — only the image was missing. So this adds a
cover thumbnail to the existing head rather than a new header that would have duplicated the text.

- `components/booking/OfferingCover/` — `OfferingCover.tsx` (render), `useOfferingCover.ts`
  (the fetch), `OfferingCover.module.css`.
- `BookingWizard.tsx` / `.module.css` — the head becomes a row; the text block gains
  `min-width: 0` so a long name ellipsises instead of pushing the cover out.
- `app/ui-gallery/page.tsx` + `visual-tests/pilot.spec.ts` — a `wizardhead` mode.

⚠️ **IT FETCHES, so it has a hook — it is not the pure-display exception the plan assumed.**
`AppShell` builds the wizard's `WizardStart` from the catalogue by id (`AppShell.tsx:234`), so the
Offering page's already-loaded `photos` never reach the wizard. One single-id query on a deliberate
user action beat threading a photo through shell selection state that nothing else needs. Kept out
of `useBookingWizard`, which already owns cross-step state and is the largest hook in the app.

⚠️ **The placeholder is mask-painted, not an `<img>`**, mirroring `OfferingResultCard`: four of
the twelve division marks are near-black line art (`ezzy-food`'s mean luminance is 1 over its
opaque pixels) and an `<img>` of one vanishes. The mask URL stays inline because `divisionIcon()`
is the one resolver for a mark's path.

**Verified:** `tsc` clean, lint at booker's 18 baseline, `next build` compiles, 205 unit tests, and
**96/96 on two consecutive full visual runs** (exit 0, zero ✘ both). The capture run before them
failed on exactly the two new `wizardhead` snapshots and **nothing else moved**, which is what
proves K5's and K6's changes are visually inert.

⚠️ **The fixture uses `ezzy-food`, deliberately, after first using `ezzy-court`.** The court mark
is mid-tone and would still look fine if the mask treatment regressed to an `<img>`; `ezzy-food` is
the worst case measured on 2026-10-02 — mean luminance **1**, 100% of opaque pixels under 70 — so
it is the baseline that goes blank if anyone ever changes it. Both captures were reviewed: the mark
renders in the division's deep colour on the light tile, legible in **both** themes.

⚠️ **Running the suite needed the user's booker dev server stopped** (they approved it): `next dev`
refuses a second server from the same directory, and the suite's own server wants `:3200` with
`PW_TEST=1`. **It is still stopped** — restart with `npm run dev` in `booker/`.

### K4 — boundary item, flagged not buried: an abandoned payment holds the slot  ⬜ TODO (payment-adjacent)
**File:** `components/booking/BookingWizard/useBookingWizard.ts:131-163`
`confirmBooking()` inserts the booking **before** the payment step, so capacity is consumed at step 4 and `is_paid` stays `false` if the booker never pays. The placement trigger counts that row against the slot like any other.
**Why it is here at all:** the user excluded payment, and the *fix* is payment-shaped (expiry, a sweep, or a hold). But the **symptom is a booking-capacity one** — a slot that reads full because of a checkout nobody completed — so burying it under "payments" would hide a booking gap behind a scope line.
**→ MOVED OUT OF THIS PLAN (decided 2026-10-04): it belongs to a payment workstream.** The fix is
an expiry, a sweep or a hold, all of which are tied to the PayMongo session lifecycle rather than to
booking capacity. ⚠️ **It became live again on 2026-10-04**, when K9 restored the payment call —
until then no booking could reach a checkout to abandon.
⚠️ **A sibling belongs with it:** there is still **no way to pay an existing booking**. The wizard
is the only caller of `/api/payment/create-session`, so a booking whose payment setup fails, or
whose checkout is abandoned, can only be cancelled and remade. K9's failure-path message says
exactly that, deliberately.
**Status here: ⬜ CARRIED to `.plans/2026-10-04-booker-payment-lifecycle.md`** (written 2026-10-04),
not aborted — the gap is real and unfixed. That plan is DRAFT with D1–D3 open.

⚠️ **Writing it turned up a correction to work shipped TODAY.** `bookings_no_duplicate` is
`UNIQUE (booker_id, schedule_id, booked_date, coalesce(start_time,'00:00'))` **with no status
predicate**, so a cancelled booking keeps its slot key and the same booker **cannot rebook it** —
the insert raises 23505 and the UI says "You've already booked this slot." K9's payment-failure
message says *"You can cancel it from Activity and book again"*; the cancel works, the rebooking
does not. Logged as that plan's **B4**.

⚠️ **It also found a live overlap:** `.plans/2026-09-29-vendor-kiosk-custom-checkout.md` (IN
PROGRESS) already designs this lifecycle for the kiosk and **explicitly excludes booker
reservations** from its sweep. So booker's gap is uncovered while the machinery to fix it is being
built elsewhere — which is the new plan's central decision, D1.

---

## DOC CORRECTIONS (found while investigating)

### X1 — `booking-flow.md` describes a dead end that the code now blocks  ✅ DONE (2026-10-03)
**File:** `architecture/booking-flow.md:207-241`
It states a booker "reaches a calendar that works, selects an available date, and is told there are no slots — with **Next** permanently disabled". `OfferingPage.tsx:145-151` **refuses to start the wizard** for these offerings and says so in plain words. The dead end is unreachable; the doc describes the pre-guard behaviour.
**Fix:** rewrite that block as "listed but not bookable, and signposted", keeping the (still accurate) inventory of what is half-built.

### X2 — `booking-flow.md` says the booker's occupancy count is wrong and the fix is "planned"  ✅ DONE (2026-10-03)
**File:** `architecture/booking-flow.md:182-190`
It warns that the count reads only the booker's own rows and that a counts-only RPC is *planned*. **It shipped.** `useStep3Schedule.ts:4,90,123` calls `getSlotOccupancy()`, which uses the `get_slot_occupancy` RPC (`services/schedules.service.ts:288`), and tracks `occupancyKnown` so a failed lookup renders **no badge** rather than a false "0 left".
**Fix:** replace the warning with what shipped, and keep the `occupancyKnown` rule, which is the non-obvious half.
⚠️ Both X1 and X2 are the same failure: `booking-flow.md` was not updated when the redesign plan closed. Worth one pass over the rest of that file rather than two spot fixes.

**✅ BOTH DONE (2026-10-03)**, and the recommended wider pass found a third: **the Documents
section described the pre-B1 behaviour**, which this session had just changed. Rewritten with the
forced ordering, the named-failure rule, the 5 MB promise versus the bucket's 10 MB backstop, and
the fact that nothing reads the documents yet (C1). The same staleness was corrected in
`architecture/schema.md` (the `booking_documents` "current state" note **and** the Storage-buckets
note that still called `vendor-kyc` the only live bucket) and in `architecture/portals.md`'s Known
Gaps. ⚠️ The old wording is quoted rather than deleted in `booking-flow.md`, because the lesson —
the screen was *affirmatively wrong*, not merely incomplete — is the part worth keeping.

---

## REFUND ROUTES — a review before answering D4 (2026-10-03)

Asked for by the user before deciding D4, with the idea of **refunds being *requested*, via their
own button**. Everything below was read in the code and the migrations, not taken from the docs —
which turned out to be wrong on one point.

### What exists today

1. **No money moves anywhere in this system.** PayMongo's refund API is called in **no app** —
   grepped across `booker`, `vendor` and `command` API routes and services; the only "Refund" hit
   is a policy-consent sentence. There is also no payout rail: Command's Payouts page *marks* a
   payout released, recording a transfer made elsewhere.
2. **A refund route does exist, and it is Command's.** `resolve_booking_dispute(p_outcome)` accepts
   `completed` / `refunded` / `cancelled` and writes the booking status in one transaction
   (`20260801000005:194`). So `bookings.status = 'refunded'` **is** reachable today — from the Flag
   Queue, by a Command admin.
   ⚠️ **`architecture/portals.md` said "`refunded` is written by nothing in any app". That was
   wrong and is corrected (2026-10-03.)** What is true is the stronger statement: it moves no money.
3. **The booker's only request channel is the flag**, `raise_booking_dispute`, and it is restricted
   to `fulfilled` / `in_progress` / `returned` / `completed` (`lib/bookerActions.ts:FLAGGABLE`) —
   i.e. **only once the service has happened or is happening.** A booker who paid and wants out
   *before* the date has **no route at all**, which is exactly the hole D4 is about.
4. **`booking_disputes` has no `kind` column.** A complaint and a refund request would be
   indistinguishable to Command except by reading the free-text reason.
5. **The ledger already has a known hole here:** paid-then-cancelled money "belongs to neither
   party" (`portals.md` vendor Known Gaps), and Command's Payouts carries an **"owed back"** bucket
   where a post-release refund surfaces. So the accounting side anticipates refunds; the rail does
   not exist.

### What "Request a refund" would take, smallest honest version

- **A `kind` on `booking_disputes`** (`'complaint' | 'refund_request'`), rather than a second table:
  it reuses the queue, the RLS, the notifications and the resolve path that already exist, and
  Command's outcome list already contains `refunded`.
- **Widened eligibility** so a refund can be requested before the service date — today a booker
  cannot raise anything on a `pending` or `confirmed` booking.
- ⚠️ **The UI must not claim the money is coming back.** Resolving as `refunded` marks a booking;
  a human still has to return the money in PayMongo by hand. Saying "Refunded" without that being
  true is **exactly the B1 mistake** — a screen asserting something the system did not do. The
  honest wording is "Refund requested" → "Approved — your refund is being processed".

### What this implies for D4

The user's instinct splits the problem cleanly, and it is my recommendation:

| Booking | Booker's action | Who settles it |
|---|---|---|
| **Unpaid** (`is_paid = false`) | **Cancel** — immediate, no money involved | Nobody; the slot is freed, which also relieves **K4** |
| **Paid** | **Request a refund** — a `refund_request` on the existing queue | Command, via the outcome it already has |

That makes **D4 option (a) the right answer** — self-cancel is unpaid-only — *not* because paid
cancellation is unimportant, but because it is a different thing with a different settlement path,
and conflating them would put a button in booker that cannot keep its promise.

⚠️ **Both halves are still approval gates.** The cancel is G3. The refund request is a new gate
(**G4**: a `kind` column + a widened `raise_booking_dispute` + Command's queue showing it), and it
is **cross-app** — Command needs to display and act on the new kind.

---

## DECISIONS

<!-- No item may execute while any OPEN: line remains. -->

- **D1 — B1, documents: persist them, or stop claiming they are uploaded?** → **(a) persist for real** (resolved 2026-10-02). ⚠️ **Blocked by G1** — there is no bucket a booker may write to. See the gate.
  (a) **Persist for real** — keep the `File`, upload after the booking row exists, write `booking_documents`. Honours the promise; the bucket and table already exist. Largest item in this plan, and it needs an upload-ordering decision (after insert, or a temp path keyed to the booker).
  (b) **Tell the truth now, persist later** — change the copy and the progress UI from "uploaded" to "selected", and say documents are brought to the appointment. Small, honest, and leaves the feature where it is. *Recommended as the immediate step*, because today's screen states something false and that is worth fixing in hours rather than weeks — then (a) on its own schedule.
  (c) **Remove the step for now** — cleanest screen, but discards the requirement list the vendor configured, which is real information.

- **D2 — S2, unbookable offerings in Explore: what should a booker see?** → **(b) mark them on the result card** (resolved 2026-10-02). ⚠️ **The marking is the easy half.** Option (b) needs an availability signal the catalogue does not carry, and the only honest source is (c)'s server-side view — so this resolves to **(b)'s UI on (c)'s data**, and is **blocked by G2**. The user also asked the right question — *why is there an unbookable offering at all?* — answered under S2 below.
  (a) **Leave it** — the Offering page already explains; Explore stays one cheap in-memory query.
  (b) **Mark them on the result card** ("No times published yet"), which needs availability in the catalogue — a schedules fan-out or a server-side view. *Not recommended as a client fan-out*; it is the exact cost P10 was parked for.
  (c) **A server-side "bookable offerings" view or RPC** that joins schedules once. Honest and cheap at read time, but a schema addition behind an approval gate. *Recommended if the catalogue is large enough for this to matter* — worth measuring first.

- **D3 — K2: should a booker be able to cancel at all?** → **yes, bookers can cancel** (resolved 2026-10-02). ⚠️ **Blocked by G3**, and one sub-question is still open because it is payment-shaped: see **OPEN D4**.

- **D4 — does booker cancellation apply to PAID bookings?** → **(a) unpaid only; a paid booking goes through a refund request** (resolved 2026-10-03, after the refund-route review). Relieves **K4** as a side effect. Built as K2 (cancel) and G4 (request). The options below are kept as the record.
  (a) **Unpaid only** (`is_paid = false`) — sidesteps refunds entirely, and incidentally relieves **K4** (the abandoned-checkout slot hold). *Recommended as the first cut*, because refunds are explicitly out of this plan's scope.
  (b) **Paid too, refund handled outside the app** — cancel sets the status, and someone refunds manually in PayMongo. Honest but it creates money work with no record in the system.
  (c) **Paid too, with a refund path** — out of scope here; it is a payments feature.
  (a) **No — by design** — cancellation stays a vendor action and the booker's route is the dispute flow. Record it as a decision so the gap stops being re-found. *Recommended only if that is genuinely the product intent.*
  (b) **Yes, before a cutoff** — a new SECURITY DEFINER RPC with status and timing rules, mirroring `acknowledge_booking`'s shape. **Schema change, approval gate**, and it needs a refund answer for paid bookings, which is out of this plan's scope.
  (c) **Yes, unpaid-only** — the narrow version: cancel while `is_paid = false`, which sidesteps refunds entirely and also relieves **K4**. Smaller than (b) and still a schema gate.

---


- **D8 — where does a refund-requested booking sit, and what closes it?** → **(c) it keeps its real status; Command resolves it to `refunded`** (resolved 2026-10-03). The trigger learned `pending`/`confirmed` → `refunded`, **Command only**; the booker gained nothing. ⚠️ Its cost is **K7** — a vendor advancing the booking to `fulfilled` strands the request. The options below are kept as the record.
  blocks G4)
  (a) **It becomes `disputed`, like every other flag.** Reuses the whole existing path — the payout
  freeze, Command's queue, and `disputed → refunded` which already works. Costs a second widening of
  the shared transition trigger (`pending`/`confirmed` → `disputed`, booker only), and parks a
  not-yet-delivered booking in a state the vendor's UI labels **"Issues"**, blocking them from
  confirming or fulfilling while it is open — arguably right while a refund is pending.
  (b) **It stays where it is; Command resolves it `cancelled`.** No trigger change at all — the
  smallest option — but `refunded` becomes unreachable before delivery, so "the money went back" is
  never recorded as such. The ledger's existing hole (paid-then-cancelled money belonging to
  neither party) gets wider rather than smaller.
  (c) **It stays where it is; the trigger learns `pending`/`confirmed` → `refunded`, Command only.**
  The booking keeps its real state while the request is open, and the outcome records what actually
  happened. *Recommended* — it is the only one of the three where the end state is the truth, and
  its trigger change is narrower than (a)'s because it grants nothing to the booker.
  ⚠️ Whichever is chosen, it touches that shared trigger again or accepts a permanent gap — there is
  no option here that is free.

- **D5 — what does "bookable" mean for the S2 marker?** → **(b) has a FUTURE OCCURRENCE** (resolved
  2026-10-04). (a) would mark an elapsed schedule as fine — exactly the Equipment Hire case that
  wasted a testing session — and (c) would tie a catalogue-wide read to live per-slot occupancy.
  **Unblocks G2**, which must now answer "does any schedule of this offering still have an
  occurrence ahead?" server-side; the client cannot evaluate that across 10,000 offerings.
  The options are kept as the record: (a) any published schedule · (c) future occurrence with free
  capacity.
- **D6 — is there a cutoff on booker cancellation?** → **freely while `pending`; once `confirmed`, up to 24 hours before the booked time** (resolved 2026-10-03).
  ⚠️ **How much this rule bites depends entirely on D4.** A booker pays at booking time, and nothing gates vendor confirmation on `is_paid` — so in practice a `confirmed` booking is a *paid* one, and a `confirmed` **unpaid** booking means an abandoned checkout the vendor accepted anyway. If D4 lands on unpaid-only, the 24-hour arm will almost never be reached. Recorded because it may change the D4 answer, not to re-open D6.
  ✅ **Design confirmation found while checking this:** `20260801000002:10-18` states outright that a booker's write path **must** be a `SECURITY DEFINER` RPC — an RLS UPDATE policy on `bookings` would expose `price_paid`, `is_paid` and `payment_reference`, and a column-level grant is role-wide. G3's shape is the one the schema already prescribes, not a preference.

---

## APPROVAL GATES — drafted, NOT written

All three decisions require a `backbone/` migration. None of these files exists; nothing has been applied. Per AGENTS.md these need the user's explicit go, and per `.claude/skills/plan-authoring/SKILL.md` §8 each carries its blast radius.

### G1 — a Storage bucket a booker may write to (unblocks B1 / D1)  ✅ DONE (applied by the user 2026-10-03)
**The discovery that blocks B1:** there are three buckets — `vendor-kyc`, `offering-attachments` and `offering-photos` — and **a booker can write to none of them.** `offering-attachments` insert requires `has_vendor_role(..., 'vendor-admin')` (`20260829000002_attachment_storage.sql:52-59`), which a booker never holds. So "persist for real" is not an app change with a missing call; it is a new bucket plus its policies.

✅ **The table half needs nothing.** `booking_documents` already exists with a booker INSERT policy (`20260507000004_bookings.sql:215-222`) and the matching grant (`20260620000001_api_role_grants.sql:62` — `select, insert, delete` to `authenticated`). Only Storage is missing.

**Proposed migration** (path convention `<booking_id>/<uuid>.<ext>`, so the first folder segment is the booking both policies key on — the same shape `offering-attachments` uses for its vendor id):

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking-documents', 'booking-documents', false,
        10485760,                                   -- 10 MB, matching the other two
        array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

create policy "booking docs booker write own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'booking-documents' and public.is_active()
    and (select booker_id from public.bookings
          where id = (storage.foldername(name))[1]::uuid) = auth.uid()
  );

create policy "booking docs booker read own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'booking-documents' and public.is_active()
    and (select booker_id from public.bookings
          where id = (storage.foldername(name))[1]::uuid) = auth.uid()
  );

create policy "booking docs vendor admin read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'booking-documents' and public.is_active()
    and public.has_vendor_role(
      (select vendor_id from public.bookings
        where id = (storage.foldername(name))[1]::uuid), 'vendor-admin')
  );

create policy "booking docs booker delete pending"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'booking-documents' and public.is_active()
    and exists (
      select 1 from public.bookings b
       where b.id = (storage.foldername(name))[1]::uuid
         and b.booker_id = auth.uid()
         and b.status = 'pending')
  );
```

✅ **APPROVED by the user 2026-10-02 and written to
`backbone/supabase/migrations/20261002000001_booking_documents_storage.sql`.** ⚠️ **Not applied** —
the user applies all migrations, local and hosted.

**What was checked before handing it over** (machine-verifiable only; the SQL has **not** been
executed anywhere):
- All four policy names are unique across every migration in the repo — no collision with the
  `vendor-kyc` or `offering-attachments` sets.
- `booking-documents` appears in no other migration, so the `on conflict (id) do nothing` is a
  safety net rather than a real re-run.
- Both helpers exist with signatures matching the calls: `public.is_active()` and
  `public.has_vendor_role(p_vendor_id uuid, p_role_name text)`.
- The argument types line up: `bookings.booker_id` and `bookings.vendor_id` are `uuid`,
  `bookings.status` is `text`, so the `::uuid` cast and the `= 'pending'` comparison are correct.
- The filename sorts after `20261001000001`, so it runs last.
⚠️ **What was NOT checked: that it executes.** Syntax, policy evaluation and the `storage.objects`
grants can only be proven by applying it. The first `select` or `insert` against the bucket is the
real test — see Verification.

**Blast radius.**
- **Data:** inserts one bucket row and creates four policies. **No existing row is read, validated or rewritten.** Nothing can fail on existing data.
- **Lock / performance:** negligible — one insert and four `create policy` statements. No table rewrite, no index build.
- **Downstream:** the booker app gains an upload path (B1). ⚠️ **And a coupling the plan did not anticipate — see C1: no vendor-side reader exists.**
- **Reversibility:** drop the four policies and the bucket. The bucket only drops once empty, so a rollback after real uploads means deleting objects first.
- ⚠️ `(storage.foldername(name))[1]::uuid` throws on a path whose first segment is not a UUID. That is the existing `offering-attachments` pattern, so it is consistent rather than novel — but it means the **client must never write a malformed path**, and a cast error surfaces as a storage failure, not a policy denial.
- ⚠️ **Read is scoped here, unlike `offering-attachments`.** That bucket deliberately allows any active user to read, because its contents are vendor-published material. These are a booker's identity documents, so read is restricted to the owning booker and the vendor who must check them. Command admins are **not** granted read — the table policy gives them metadata only. Say so if that is wrong for support.

### G2 — a server-side availability signal (unblocks S2 / D2)  🔄 MIGRATION WRITTEN (2026-10-04), awaiting the user applying it
"Mark it" needs to know, per offering, whether anything is bookable — and the catalogue carries no schedule data. A client-side fan-out is one schedules query per offering, which is exactly what `useExplorePage.ts:26-29` refused for the parked "When" filter.
**Proposed shape:** a read-only view or `SECURITY DEFINER` function returning `(offering_id, has_future_slot boolean)`, joined into the catalogue read in one go.
⚠️ **Deliberately not drafted in SQL yet.** The correct definition depends on what "bookable" means — a published schedule, a schedule with a future occurrence, or one with free capacity — and that is a product question, not a SQL one (**OPEN D5**).
**Blast radius (shape only):** read-only, additive, no existing object altered; reversible by dropping it. Cost is one extra join on the catalogue read, which happens once per session.

**🔄 WRITTEN 2026-10-04, NOT APPLIED:** `backbone/supabase/migrations/20261004000002_unbookable_offerings.sql`.

⚠️ **`security invoker`, NOT `security definer` — against the shape this item first sketched.**
Both tables it reads are already visible to the caller (*"active users can read active offerings"*
and *"…active schedules"*, both `is_active AND is_active()`), so definer rights would take
privilege the function has no use for. Checked in `pg_policies` rather than assumed.

⚠️ **It returns `uuid[]`, ONE array value, and the reason is the wire format.** The first draft
returned `setof uuid`; the second tried `returns table (offering_id uuid)` to make the payload
self-describing. **That does not work** — PostgreSQL collapses a single-column `returns table` back
to a scalar set, which `to_jsonb()` on a row shows plainly: it yields a bare string, not an object.
A client written for the wrong shape marks nothing, silently. One array has exactly one rendering,
verified: `["1c09bf48-…", …]`, and `[]` when empty.

⚠️ **It returns the UNBOOKABLE set, the small one**, so the payload stays tiny and an offering
simply absent from it is bookable.

**The rule, from D5(b):** a schedule counts if it is active, its window has not closed
(`end_date is null or end_date >= today`), and — if one-time — its date has not passed.
⚠️ **It errs toward "bookable" on purpose.** A recurring schedule whose remaining window contains
no matching weekday is still called bookable; being exact means generating occurrences for every
offering on every catalogue load. The asymmetry is what makes that safe: a false "bookable" costs
one click, a false "unbookable" would hide a real offering and cost a vendor a sale.
⚠️ **Date-granular offerings are NOT special-cased**, and must not be — S2's cause 3 said they were
unbookable, which stopped being true when K1 shipped.

**Measured on the local seed, in a rolled-back transaction: 25 of 35 active offerings are
unbookable — 23 with no schedule at all and 2 whose schedules have elapsed.** Those are causes 1
and 2 from S2's own list, which is the item's premise confirmed rather than assumed.

### G3 — booker cancellation: a trigger widening **and** an RPC (unblocks K2 / D3·D4·D6)  ✅ DONE (applied by the user 2026-10-03)
Bookers hold no UPDATE on `bookings`, and every booker action goes through a `SECURITY DEFINER` RPC. A cancel follows that pattern: a new function that validates ownership, checks the status is cancellable, and writes the status — the client never names a status (`schema.md` → RLS Philosophy).
⚠️ **ESCALATION, found 2026-10-03 while drafting.** I described this as "a new function". It is
not: **the transition trigger refuses a booker-initiated cancellation outright.**
`20260801000002:114,117` reads `if new.status = 'cancelled' and (v_vendor or v_command)` from both
`pending` and `confirmed` — the booker is **not** an accepted actor. So G3 is a function **plus a
change to `validate_booking_status_transition()`**, which governs every booking status write in all
three apps. That is a materially larger and more security-sensitive gate than I first said.

⚠️ There is no way around it that is honest. `auth.uid()` is preserved inside `SECURITY DEFINER`
(the migration says so explicitly), so the trigger sees the booker no matter how the RPC is
written; faking the system actor would be defeating the control rather than using it.

**Decisions this is built on:** D3 (bookers can cancel), **D4 → unpaid only, paid goes to a refund
request** (2026-10-03), **D6 → freely while `pending`; once `confirmed`, up to 24 hours before**.

✅ **APPLIED by the user 2026-10-03.** Confirmed by read-only query: `booker_cancel_booking` exists
and its EXECUTE grants are `postgres` / `authenticated` / `service_role` — **no `anon`**.

**Proposed change 1 — widen the trigger, surgically:**

```sql
-- in validate_booking_status_transition(), the `pending` and `confirmed` arms only:
--   from 'pending'   : if new.status = 'cancelled' and (v_booker or v_vendor or v_command)
--   from 'confirmed' : if new.status = 'cancelled' and (v_booker or v_vendor or v_command)
-- Every other arm is untouched. `returned`/`in_progress` keep having NO path to
-- cancelled (the route is 'disputed'), and `disputed` stays Command-only.
```

⚠️ **The trigger learns only "a booker may cancel from these two states".** The *conditions* —
unpaid, and the 24-hour window — live in the RPC, because a trigger cannot tell a booker-initiated
write from any other and would then also constrain vendor and Command cancellations. The booker has
no UPDATE grant on `bookings` at all, so the RPC is the only door; widening the trigger does not
open a second one.

**Proposed change 2 — the RPC:**

```sql
create function public.booker_cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare b record;
begin
  if not public.is_active() then
    raise exception 'booker_cancel_booking: not permitted' using errcode = '42501';
  end if;

  select id, booker_id, status, is_paid, booked_date, start_time
    into b
    from public.bookings
   where id = p_booking_id
   for update;                         -- the same row lock the placement trigger uses

  if b.id is null or b.booker_id <> auth.uid() then
    raise exception 'booker_cancel_booking: not your booking' using errcode = '42501';
  end if;

  if b.is_paid then
    -- D4: a paid booking is a refund REQUEST, not a cancellation. Distinct hint so the
    -- client can route to that flow rather than show a generic failure.
    raise exception 'Paid bookings are cancelled by requesting a refund'
      using errcode = '22023', hint = 'paid_requires_refund_request';
  end if;

  if b.status not in ('pending', 'confirmed') then
    raise exception 'This booking can no longer be cancelled'
      using errcode = '22023', hint = 'not_cancellable';
  end if;

  -- D6: free while pending; 24 hours once confirmed. A date-granular booking has no
  -- start_time, so the deadline is the start of its booked_date.
  if b.status = 'confirmed'
     and (b.booked_date + coalesce(b.start_time, '00:00'::time)) - now() < interval '24 hours' then
    raise exception 'Confirmed bookings can only be cancelled up to 24 hours before'
      using errcode = '22023', hint = 'too_late';
  end if;

  update public.bookings
     set status       = 'cancelled',
         cancelled_by = auth.uid()
   where id = p_booking_id;
  -- ⚠️ rejection_reason is deliberately NOT written — see the coupling below.
end;
$$;
```

⚠️ **`rejection_reason` must stay null.** `notify_on_booking_status_change()` treats a transition to
`cancelled` carrying a non-empty `rejection_reason` as a **vendor rejection** and emails the booker
"Booking Rejected" (`schema.md:906`). A booker cancelling their own booking would otherwise be told
they had been rejected.

⚠️ **Timezone.** `booked_date + start_time` is compared against `now()`. This project is
Manila-anchored (`lib/manila.ts`, and the Payments period presets); **the comparison must be made in
the same zone the booked time means**, or the 24-hour edge moves by the server's offset. To confirm
against the DB's `timezone` setting before this is written as a file.

✅ **APPROVED by the user 2026-10-03 and written to
`backbone/supabase/migrations/20261003000001_booker_cancel_booking.sql`.** ⚠️ **Not applied** — the
user applies all migrations.

⚠️ **A trap caught while writing it: the draft cited the WRONG SOURCE VERSION.** The trigger has
been replaced **three** times — `20260516000004`, `20260801000002`, and most recently
**`20260829000004_kiosk_customer_close_out.sql`**, which added `(v_vendor and new.booked_via =
'kiosk')` to three arms. My draft quoted line numbers from `20260801000002`. A `create or replace`
carries the whole body, so replacing that text would have **silently reverted kiosk close-out**.
The migration is based on `20260829000004` instead.

**What was checked before handing it over** (machine-verifiable only; **the SQL has not been
executed anywhere**):
- **The trigger body was diffed against the current one**: exactly **two logic lines** differ, both
  the intended `cancelled` arms, plus three comment lines. Every other line — including all three
  kiosk arms — is carried over verbatim.
- `booker_cancel_booking` collides with no existing function name.
- Columns and helper exist with the right types: `bookings.is_paid boolean` (`20260518000001`),
  `start_time time` (`20260803000003`), `booked_date date`, `status text`, `cancelled_by uuid`
  (`20260516000005`), `public.is_active()`.
- Filename sorts after `20261002000001`.
- The timezone idiom matches the repo's precedent (`20260801000009`): explicit
  `at time zone 'Asia/Manila'`, because the container's TimeZone is UTC and the deadline would
  otherwise move by eight hours.
⚠️ **What was NOT checked: that it runs, and that no existing transition broke.** Only applying it
proves either. ⚠️ **This is the one migration today that can break something it does not mention** —
the trigger governs every booking status write in booker, vendor, command and the kiosk, so a
mistake shows up as an unrelated transition failing. Worth exercising one vendor confirm, one
kiosk close-out and one dispute resolution after applying.

**Blast radius.**
- **Data:** no column added, no row rewritten. The trigger change alters *validation*, not data.
- **Lock / performance:** `create or replace function` takes a brief lock on the function; the RPC's
  `for update` locks one booking row for the length of the call.
- **Downstream:** ⚠️ **the trigger is shared by booker, vendor, command and the kiosk.** A mistake
  here does not break cancellation — it breaks *every* status transition. This wants its own
  careful read, and ideally a test that each existing transition still behaves.
- **Reversibility:** restore the previous function bodies. Any bookings cancelled meanwhile stay
  cancelled, which is correct — they really were.

### G4 — "Request a refund", on the existing dispute queue  ✅ DONE — migration applied + booker side built (2026-10-03)
From the refund review above: Command already resolves a flag to `refunded`, and the booker already
has `raise_booking_dispute`. What is missing is the ability to tell a refund request apart from a
complaint, and permission to raise one before the service has happened.

**Proposed change:**
```sql
alter table public.booking_disputes
  add column kind text not null default 'complaint'
    check (kind in ('complaint', 'refund_request'));

-- raise_booking_dispute(p_booking_id, p_reason) gains p_kind default 'complaint',
-- and its status gate widens for refund_request only, to include pending/confirmed.
```
✅ **D8 → option (c) (resolved 2026-10-03), and written to
`backbone/supabase/migrations/20261003000002_refund_requests.sql`.** ⚠️ **Not applied** — the user
applies all migrations.

⚠️ **The first draft of this gate was too thin and would have shipped a broken feature.** Three
facts found while preparing the migration:

1. **`raise_booking_dispute` does not just insert a row — it moves the booking to `disputed`**
   (`20260801000005`), in the same transaction, and that is what freezes the payout.
2. **The transition trigger forbids exactly the states a refund request would come from.**
   `pending` permits only `→ confirmed` and `→ cancelled`; `confirmed` permits only `→ cancelled`,
   `→ fulfilled`, `→ in_progress`. **Neither allows `→ disputed`.** So widening the RPC's status
   gate alone would fail at the trigger for every refund request.
3. **Avoiding that transition does not escape the problem, it moves it.** If the booking stays in
   `pending`/`confirmed`, then `resolve_booking_dispute` — which writes `p_outcome` straight onto
   the booking — cannot resolve it as **`refunded`**: the trigger allows `→ refunded` only from
   `completed` and `disputed`. Command could only resolve it as `cancelled`, which records that
   the booking ended but **not that money went back**.

⚠️ So "widen the status gate" was not a one-line change in either direction. **D8 answered the real
question** — what state a refund-requested booking occupies and what closes it — and (c) is built:
the booking **keeps its real status** while the request is open, and Command closes it by resolving
to `refunded`, which the trigger now permits **from `pending`/`confirmed`, Command only**.

**What the migration contains:**
1. `booking_disputes.kind` (`complaint` | `refund_request`, default `complaint`).
2. The transition trigger, widened by **two lines**: `pending → refunded` and `confirmed →
   refunded`, both `v_command` only. The booker gains nothing.
3. `raise_booking_dispute` **dropped and recreated** with a third defaulted argument, and a
   refund-request branch requiring booker + `is_paid` + `pending`/`confirmed`, each refusal
   carrying its own hint. **Only a complaint still moves the booking to `disputed`.**

**What was checked before handing it over** (machine-verifiable only; **the SQL has not been
executed**):
- **Both function bodies were diffed against their current versions.** The trigger differs by
  exactly **two logic lines** (the `refunded` arms); every other line, including G3's booker arms
  and the three kiosk arms, is carried over verbatim. The RPC's diff is the `kind` plumbing and the
  refund-request branch, nothing else.
- ⚠️ **`create or replace` would have been a bug here, not a shortcut.** A new argument list creates
  an **overload**, so the old two-argument form would have survived alongside a defaulted
  three-argument one — and a two-argument call, which is exactly what booker and vendor send, would
  then fail as ambiguous. The function is dropped first, and its grants restored afterwards,
  because a drop takes them with it.
- **Both existing callers use NAMED arguments** (`booker/services/bookings.service.ts:222`,
  `vendor/services/bookings.service.ts:211`), so they bind to the new signature unchanged and keep
  getting `kind = 'complaint'`.
- Filename sorts after `20261003000001`.
- ⚠️ **No payout freeze is needed and that is not an oversight:** `sync_booking_payout_status()`
  makes a transaction releasable only on `completed`, so a `pending`/`confirmed` booking has never
  been releasable. Resolving as `refunded` moves it to `reversed` through the same trigger.
⚠️ **What was NOT checked: that it runs.** And the same warning as G3 applies — this touches the
shared transition trigger, so a mistake surfaces as an unrelated transition failing.

✅ **APPLIED by the user 2026-10-03.** Confirmed by read-only query: `booking_disputes.kind` exists
defaulting to `'complaint'`, and **exactly one** `raise_booking_dispute` signature survives —
`(uuid,text,text)` — so the overload ambiguity the header warns about did not occur.

**✅ BOOKER SIDE BUILT (2026-10-03).**
- `lib/bookerActions.ts` — `refundBlockedReason()` / `canRequestRefund()`, mirroring the RPC's
  rules; + 2 tests, one of which asserts **cancel and refund are mutually exclusive** across every
  status/paid combination, so a booking can never offer both.
- `services/bookings.service.ts` — `requestRefund()` returning a `RefundRequestResult` keyed on the
  RPC's hints (and on the message only for the pre-existing "already has an open flag", which has
  none).
- `useBookingDetailModal` + `BookingDetailModal` — a **Request a refund** control, and **one reason
  box now serves both** the flag and the refund. ⚠️ Two near-identical textareas kept in sync by
  hand is the drift this codebase keeps paying for; the flag's wording and markup are unchanged, so
  its capture did not move — **proved**, see below.
- `app/ui-gallery/page.tsx` + `pilot.spec.ts` — a new **`bookingrefund`** mode, the paid mirror of
  `bookingcancel`.

**Verified in a browser:** paid+`confirmed` offers **refund only**; unpaid+`pending` offers
**cancel only**; `fulfilled` offers **neither**. The refund form shows its prompt, its "your booking
stays as it is" note and "Send request" — and the word **"refunded" appears nowhere on it**, which
is the assertion that matters: nothing here moves money.
**Visual:** 2 failures, both the **new** mode's missing baselines, and **zero pixel diffs anywhere
else** — which is the proof that unifying the reason box left the flag capture untouched. Baseline
reviewed, then **two consecutive full runs at 94/94, exit 0**.
199 unit tests, `tsc` clean, lint at its 18 baseline, `next build` compiles.

⚠️ **The feature is still incomplete without Command** — the queue must show the `kind`, or a refund
request arrives looking like a complaint. That is `command/`, a separate app and a separate
approval: **G4-command**, below, is now the blocking piece rather than a follow-on.

**Blast radius (of the `kind` column alone, unchanged).**
- **Data:** one column with a default — existing rows become `complaint`, which is what they are.
  No rewrite of meaning, no backfill needed.
- **Downstream:** **Command's Flag Queue must show the kind**, or a refund request arrives looking
  like a complaint. That is the cross-app half and needs its own approval.
- ⚠️ **The UI must not say "Refunded" anywhere.** Resolving marks a booking; **no money moves** —
  PayMongo's refund API is called nowhere. "Refund requested" → "Approved, being processed" is the
  honest ladder. Saying otherwise is the B1 mistake with money attached.
- **Reversibility:** drop the column and revert the function.
**Known couplings:** `notify_on_booking_status_change()` already treats a transition to `cancelled` carrying a non-empty `rejection_reason` as a **vendor rejection** and emails the booker "Booking Rejected" (`schema.md:906`). ⚠️ A booker-initiated cancel must therefore leave `rejection_reason` null, or the booker receives a rejection email for their own cancellation.

---

### K6 — `Booking.startTime` is `""` for a date-granular booking, not null  ✅ DONE (2026-10-04)
Found while writing K2's deadline rule. `toBooking()` maps a NULL `start_time` to an **empty
string** (`services/bookings.service.ts:114`) and `Booking.startTime` is typed `string`. So
`startTime ?? "00:00"` — the obvious way to default it — **passes `""` straight through** and
produces an unparseable timestamp. In my first cut that reached the NaN guard and reported
"too late" for a booking whose day had not begun.
⚠️ The type checker caught it only because I had written the test with `null`; nothing else in the
app would have.
**Fixed at the one call site** (`||` instead of `??`, with a regression test), but the shape stays
misleading for the next person. **Worth considering:** type it `string | null` and let consumers
handle it, which is what the DB actually says. Not done here — it ripples through every consumer
of `Booking`, which is more than this item should carry.
⚠️ Newly reachable because **K1 made date-granular bookings possible at all**; before 2026-10-03 no
such booking could exist from booker.

**✅ DONE 2026-10-04.** `Booking.startTime` and `endTime` are now `string | null` (`lib/types.ts`)
and `toBooking()` passes the database's NULL through instead of coercing it to `""`
(`bookings.service.ts`).

**The ripple was ZERO**, which is worth recording because the item predicted otherwise: `tsc` came
back clean on the first run across all **52** references. Every consumer already used a truthy
guard (`b.startTime ? …`) or `?? ""`, so nothing actually depended on the empty string — the type
was misleading without being load-bearing.

⚠️ **`lib/bookerActions.ts` keeps `||`, not `??`**, and its comment now says why: `??` would be
correct for the new `null` but still passes a `""` through, and both shapes must survive. The
regression test asserts **both**, in a loop — asserting only `null` would pass with `??` and lose
the original bug.

**Verified:** `tsc` clean, **205 unit tests** pass, lint at booker's 18 baseline.

### K5 — date-granular bookings are invisible to the occupancy map  ✅ DONE (2026-10-04) — ⚠️ with a limit a migration would remove
**File:** `services/schedules.service.ts:295` — `if (!b.start_time || !b.end_time) continue`
Found while building K1. `get_slot_occupancy` **does** return date-granular rows (its SQL has no
`start_time is not null` filter), but the client mapping drops them, and the call window is
`date → date+1`, which is wrong for a multi-day booking anyway.
**Consequence:** the date mode shows **no "N left"**, and its quantity is bounded by the
schedule's date range alone. That is deliberate and consistent with the `occupancyKnown` rule — a
number that cannot be verified is the F1 bug again — and the placement trigger still refuses an
overbooking, which `confirmBooking` already renders as "That slot just filled up".
**Unblocked by:** keying those rows by date interval instead of dropping them, plus a window
widened to the span. ⚠️ **No migration needed** — the RPC already serves it; but its window is
capped at **31 days**, so a long month-granular span needs clamping or several calls.

**✅ DONE 2026-10-04 — and the item's own claim that "no migration needed" was WRONG.**

⚠️ **THE RPC FILTERS ON THE START DATE, so a long span is structurally invisible from the
client.** `get_slot_occupancy` has `and b.booked_date between p_from and p_to`, which asks "did a
booking BEGIN in this window?", not "does one COVER this date?". Proven against the local database
in a rolled-back transaction, with a real 3-day hire on Equipment Hire starting 10 Oct:

```
booking created: end_date=2026-10-12          (inclusive: the 10th, 11th, 12th)
RPC asked for the 12th only       -> 0 rows   <- invisible, the bug
RPC asked with an 11-day lookback -> 1 rows   <- found, the fix
row the client maps: start_time=NULL end_time=NULL booked_date=2026-10-10 end_date=2026-10-12 n=1
```

**What shipped (client only, no migration):**
- `lib/slots.ts` — `dateLookbackDays()`, `spanCoversDate()`, `OCCUPANCY_WINDOW_DAYS`, plus
  `addDays`/`toISODate` exported rather than re-implemented. **6 new tests.**
- `services/schedules.service.ts` — `getDateOccupancy()` and `remainingForDate()`. A **separate**
  function, not a branch inside `getSlotOccupancy`: whole-day bookings have no instants, need a
  different query window, and answer a different question, so the proven time-slot path is
  untouched.
- `useStep3Schedule.ts` — fetches it, keyed, and derives `dateRemaining`.
- `Step3Schedule.tsx` — renders "N left on this date" / "Fully booked on this date".

⚠️ **A STALE KEY READS AS UNKNOWN, NEVER AS FREE.** The result carries its own `key` and is
derived against it, as `useHomePage`'s `photoResult` does. Two reasons: lint rejects a synchronous
`setState` in an effect ("cascading renders" — it cost a lint regression on the first cut), and the
reset form would render the PREVIOUS date's count for one frame after the date changes.

⚠️ **THE REMAINING LIMIT, AND IT NEEDS A MIGRATION TO REMOVE.** The RPC caps any window at 31
days, so the look-back covers: **all day-granular bookings** (12 units = 11 days), **week spans up
to 4 units** (27 days), and **a single month**. Beyond that `getDateOccupancy` returns
`known: false` and the UI shows **no number** — honest, and strictly better than the previous
silence, but not complete. The proper fix is an overlap predicate in the RPC, e.g.
`daterange(b.booked_date, coalesce(b.end_date, b.booked_date) + 1) && daterange(p_from, p_to + 1)`,
which would make a one-day window sufficient for every span. **That is a function change = an
approval gate, so it is NOT drafted as a migration here.**

⚠️ **`lib/slots.ts` IS NO LONGER BYTE-IDENTICAL WITH `vendor/lib/slots.ts`**, and its test header
said it was. The divergence started with K1, not here — the date-granular helpers exist in booker
only, because only booker can make such a booking. The header now states what is shared (the time
arithmetic) and what is not. **Bringing vendor into line is cross-app and needs its own approval.**

**Verified:** `tsc` clean, **205 unit tests**, lint at booker's 18 baseline, `next build` compiles,
and the RPC premise measured above.
⏸ **No visual coverage for the new line.** `dateRemaining` comes from a fetch, and the gallery's
`step3date` fixture makes no backend call, so the count is `null` there and the arm renders
nothing. The arithmetic behind it is unit-tested; the rendered line needs a human on a
date-granular offering ("Equipment Hire" is the only one with a live schedule).

⚠️ **UNPARKED 2026-10-03.** ⏸ implies "waiting on something", and this is not: it was a scope
boundary I drew while building K1, not a blocker. It needs **no decision from the user** — the fix
is client-side only, in `services/schedules.service.ts:299` and the Step 3 hook. The one
implementation choice, which is mine: beyond the RPC's 31-day window, report `known: false` and show
no badge, matching the existing `occupancyKnown` rule, rather than adding a chunking loop for a span
that long.

---

## COUPLINGS

### K7 — a vendor can strand an open refund request  ✅ DONE — decided + migration written (2026-10-04)
Raised with the user 2026-10-03 while drawing the refund flow; **not yet answered**.
Because D8(c) leaves the booking in its real status, the vendor is not blocked and may advance it.
If they take a `confirmed` booking to **`fulfilled`** while a refund request is open, Command can no
longer resolve it as `refunded` — the trigger permits `→ refunded` only from `completed`,
`disputed` and (new) `pending`/`confirmed`. The request is not lost; it simply cannot be closed the
honest way until the booking reaches `completed`, or it is closed as `cancelled` instead.
**Three options, none chosen:** leave it; add `fulfilled → refunded` (Command only) — one more line
in the same trigger; or block the vendor while a request is open, which starts recreating D8(a).
⚠️ **The cheapest moment to fold a trigger line in was the G4 migration, which is now applied** — a
fix becomes its own migration.

### G4-command — Command's Flag Queue must show the kind  ✅ DONE — build + live check (2026-10-03), ⚠️ **BUG FOUND AND FIXED 2026-10-04**
`command/components/flags/FlagQueue` lists open `booking_disputes` and resolves them. It does not
know about `kind`, so once G4 is applied a **refund request is indistinguishable from a complaint**
except by reading the free-text reason — and the resolver would offer `completed` as an outcome for
a booking that was never delivered, which the trigger will refuse.
**Smallest honest change:** show the kind on each row, and for a `refund_request` offer only the
outcomes the trigger permits from that booking's status.
**✅ LIVE CHECK PASSED 2026-10-03, by the user, on local.** Booking `ec3e226f` carries **three
required documents** — Valid Government ID, Court Rental Receipt, Signed Waiver — and the bucket
holds **5 objects with all 5 rows matched to one**, so no row points at nothing and no bytes are
orphaned. This is B1's real proof: before 2026-10-02 the `File` was discarded while the screen said
"uploaded". (⬜ **L5 on the live-verification plan is left OPEN for the user to close** — it was
written as a staging check and staging has not been exercised.)

**✅ K2 LIVE CHECK PASSED 2026-10-03, by the user.** Two bookings cancelled from the booker, both
with `cancelled_by` = the booker's id, and **both `is_paid = false`** — so **D4 held**: the paid
path was not reachable. ⚠️ The two paid `cancelled` rows in the database are **seed data** from
2026-10-02 with a null `cancelled_by`, not booker cancellations; do not read them as a D4 breach.

⚠️ **Until this lands, G4 is applied but not usable in anger.** Worth doing before, or in the same
batch as, booker's button.

**✅ BUILT (2026-10-03), cross-app approval given by the user.** `command/` only — no booker, no
vendor, no schema.
- `lib/flagOutcomes.ts` + `lib/flagOutcomes.test.ts` (new) — `allowedOutcomes()` and
  `noOutcomeReason()`, **mirroring the transition trigger**, with 4 tests.
- `services/disputes.service.ts` — selects and carries `kind`; an unrecognised value reads as
  `complaint`, which is the conservative direction (fewer outcomes, never more).
- `components/flags/FlagQueue/` — a **"Refund requested"** chip, and the outcome buttons filtered
  to what the database will accept.

⚠️ **The bug this closes was not cosmetic.** The queue offered all three outcomes on every flag, so
**"Complete it" on a refund request** — whose booking is still `pending`/`confirmed` — would have
been refused by the trigger and surfaced to an admin as a raw Postgres error on a button that
looked available.

⚠️ **It also makes K7 visible instead of fatal.** If a vendor has advanced the booking to
`fulfilled`, **no** outcome is legal; the panel now says so in words rather than offering buttons
that fail. That is the honest surface for a problem that is still unresolved.

**Verified (machine):** 4 new unit tests covering every status, `tsc` clean, `next build` compiles,
lint unchanged at Command's **24-problem baseline** — confirmed by stashing my changes and
re-running, and none of the 24 is in a file I touched.

⚠️ **BUG IN MY OWN WORK, FOUND 2026-10-04 AND FIXED.** `allowedOutcomes()` was wrong for
**three** statuses, not one: it returned an empty set for `fulfilled`, `returned` **and**
`completed`, on my assumption that a booking past delivery had no legal outcome. The live trigger
says otherwise — `fulfilled → completed`, `returned → completed` and **`completed → refunded`**
(the original refund path, older than this whole feature) are all permitted for Command. The effect
was the opposite of the bug I built the file to prevent: instead of offering an outcome the trigger
refuses, it **hid outcomes the trigger allows**, with a message telling the admin the booking "has
to reach completed first" on a booking that was already `completed`.

⚠️ **The test asserted the same wrong answers, so it confirmed the bug instead of catching it.**
Written from the same assumption as the code, it verified nothing. Rewritten from the live
`pg_proc.prosrc` body as a transcribed truth table, now **7 tests / 147 total**, including one that
asserts a reason is given *exactly* when there is no outcome.

**Found because the user advanced a real booking to `completed` while a refund request was open**,
and the queue offered no way to refund it. Fixed in `lib/flagOutcomes.ts` (+ test): `tsc` clean,
147 pass, lint at Command's 24 baseline, build compiles. No migration — pure client logic.

**✅ RENDERING VERIFIED LIVE 2026-10-03** by the user, running TEST A's checklist: the row read
**"Refund requested"**, **"Complete it" was absent**, and *Mark refunded* resolved the booking to
`refunded`. The note below describes why *I* could not verify it by machine, and still stands as
the reason there is no automated coverage.

⏸ **NOT verified BY MACHINE: the rendering.** `useFlagQueue` fetches its own data from Supabase and Command
has **no gallery fixture for the flag queue**, so there is nothing to render it against without an
admin session and real rows. Giving it one would mean refactoring the component to accept injected
flags — a bigger change than this item. **The live check is the user's**, and is the sequence they
asked for: request a refund as a booker → the row says "Refund requested" → "Complete it" is absent
→ resolve as refunded → separately flag a delivered booking and confirm that path is unchanged.

### C1 — uploaded documents have no reader  ✅ DONE (2026-10-04)
Grepped: **nothing in `vendor/` references `booking_documents`.** The table has had a vendor-admin SELECT policy since 2026-05 and no vendor UI has ever used it.
So B1 on its own moves the problem rather than solving it: the booker's document would be stored and visible to them, and the vendor — the person who required it — still would not see it. **Closing the loop needs a vendor-side change**, which is a second app and its own approval under AGENTS.md's cross-app rule.
**Recommended order:** G1 + B1 first (the booker stops being lied to and the file is really kept), then the vendor reader as a separate, explicitly-approved piece. Say if you want them batched instead.

**🔄 BUILT 2026-10-04**, cross-app approval given by the user. `vendor/` only — no booker, no
command, **no migration**.

⚠️ **NO MIGRATION WAS NEEDED, and that is the surprise worth recording.** Both halves of the
permission already existed and had never once been used:
- table — *"vendor admins can read their booking documents"* (SELECT, since 2026-05)
- bucket — *"booking docs vendor admin read"* (SELECT, shipped with the bucket in `20261002000001`)

Both resolve the vendor through `bookings` and `has_vendor_role(…, 'vendor-admin')`. Verified by
reading `pg_policies` for the table and for `storage.objects`. The service therefore does **no**
vendor filtering of its own — RLS is the boundary, and duplicating it in the query would invite the
two to drift.

**Files:**
- `services/bookingDocuments.service.ts` (new) — `getBookingDocuments()`, `bookingDocumentUrl()`.
- `components/bookings/BookingDetails/useBookingDetails.ts` — a `DocumentsView` union mirroring the
  existing `AgreementsView`, plus `viewDocument()`.
- `components/bookings/BookingDetailsModal/` — a "Customer documents" section + `.docView` style.
- `app/ui-gallery/page.tsx` — the `bookingdetails` fixture gains documents.

⚠️ **Signed ON CLICK, not on open** — unlike the kiosk signatures beside it in the same modal.
Those are images rendered inline, so they must be signed to appear at all. A document is a file
someone opens: signing every row on open would be a round trip per file for files mostly never
viewed, and a 300-second URL minted then would already have expired by the time a vendor working
through a queue clicked it.

⚠️ **`window.open` is called BEFORE the await, then redirected.** Opening it after the signed URL
resolves would be blocked as a popup, because the browser no longer attributes the call to the
click. On failure the blank tab is closed rather than left on `about:blank`.

⚠️ **Empty renders NOTHING, deliberately.** `hidden` and an empty `ready` are different claims, and
this component cannot tell them apart: the offering's `requirements` are not on the booking, so it
cannot say whether anything was *asked for*. Inventing "0 of 2 uploaded" from a list it cannot see
would be a worse lie than silence. **Showing what is MISSING needs the offering** — not built here.

**Verified:** `tsc` clean, **525** unit tests pass, lint at vendor's **29 baseline** (confirmed by
stashing and re-running — none of the 29 is in a file I touched), `next build` compiles.
**Visual: the capture run failed on exactly `bookingdetails-light` and `bookingdetails-dark` and
NOTHING else** — across vendor's 199 tests — which is what proves the new section changed only its
own pane. Both captures were reviewed before re-recording: the section renders between Payment and
Agreements, `· required` distinguishes the two rows, and the "View" pill is legible in **both**
themes. Then **199/199 on two consecutive full runs** (exit 0, zero ✘ both).

⚠️ Running the suite needed the **vendor dev server stopped** (the user approved it): `next dev`
refuses a second server for the same directory, whatever port is asked for — vendor's own AGENTS.md
warns about this. **It is still stopped** — restart with `npm run dev` in `vendor/`.

⏸ **Not verified: a real document opening.** That needs a vendor session and a booking with
uploads. Booking `ec3e226f` has three, so it is the one to open.

## BASELINES

**✅ Re-recorded 2026-10-03.** Full suite run **before** touching anything: **4 failed, 85 passed**
— `inprogress-light/dark` (K3's copy) and `step4-light/dark` (B1's copy), **and nothing else**.
Deltas 872–1680 px, ratio 0.01, consistent with text-only changes. The `step4-dark` capture was
reviewed before re-recording and shows exactly the intended change: *"1 of 1 required **selected**"*
and the new line *"Your files are sent when you confirm the booking."*
Re-recorded scoped to those four, then **two consecutive full runs: 89/89, exit 0, zero failures.**

⚠️ **One wording question left open rather than churned.** The Documents step's section heading is
still "Upload Requirements" and its file-picker button still reads "Upload", while nothing uploads
at that moment. It is no longer *false* — the counter says "selected" and a line states the files
are sent on confirm — but "Choose file" would be more exact. Left alone deliberately: it is a copy
judgement that costs two more baselines, and it is the user's call.

---

## DEFERRED / COSMETIC

- **No typo tolerance or stemming in search.** `searchCatalogue` is substring, all-terms-must-match. "massages" finds nothing that "massage" finds. Acceptable while the catalogue is small, and a fuzzy matcher is a dependency decision; the division hints already carry common plurals. Revisit with P6.
- **Recent searches are stored but never suggested while typing.** The list exists (`useExplorePage`), and is shown only in the shortcuts row. A type-ahead is a feature, not a gap.
- **`popularCategories` is a frequency count, not curation.** A vendor who names a category oddly can take a top-6 slot. Acceptable: it is derived from real data and self-corrects as the catalogue grows.

---

## Execution order

Nothing here is approved yet, and **three decisions are open**. The order below is what I would propose once they are answered.

1. **Safe now, no decision needed:** S3 (one line + a test), X1 and X2 (doc corrections), plus the wider `booking-flow.md` pass X2 recommends.
2. **S1** — add `description` to the haystack, with the cost measured on a real catalogue first.
3. **B1** — whichever branch D1 picks. If (b), it is small and should go early precisely because it stops the screen lying.
4. **K3** — resume at step 1, or carry and re-validate the slot.
5. **K1** — the date-granular render arm, with a functional test that asserts the booker can *proceed*, not just that no slots render.
6. **Behind an approval gate, if chosen:** K2 (D3), S2 (D2 option c). Both are schema changes and neither should be written until the user says go.

## Verification

| Item | Check | Kind |
|---|---|---|
| S1 | `search.test.ts` case for a description-only match; measure match time on a full catalogue | machine + a measurement |
| S3 | `search.test.ts` asserts `''` never reaches the list | machine |
| B1 (a) | a document arrives in the bucket and a `booking_documents` row exists | needs a live environment |
| B1 (b) | no screen says "uploaded" — grep plus a look | machine + human |
| K1 | a functional test that completes step 1 for a date-granular offering; ⚠️ the existing `step3date` visual test cannot catch a regression here | machine |
| K2, S2(c) | RLS and RPC behaviour under a second booker's session | needs a live environment |
| X1, X2 | the doc matches the code at the cited lines | human |
