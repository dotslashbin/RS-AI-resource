# Booker payment lifecycle — abandoned checkout, paying an existing booking, and verified settlement

**Date:** 2026-10-04
**App / scope:** `booker/` primarily; `backbone/` for any lifecycle change (approval-gated). **Not** the vendor kiosk — see the coupling note.
**Status:** ✅ **COMPLETE for its executable scope (2026-10-05)** — B2, B3, B4, I1, I2 all done. ⏸ **B1 is PARKED, not done**, and handed to `.plans/2026-09-29-vendor-kiosk-custom-checkout.md`: **booker still holds a slot for every abandoned checkout.** Decisions D1–D3 resolved. ⏸ Also unverified locally: booker's own `create-session` + redirect, and B3's success branch — both need staging.
PARKED, not done**, and handed to `.plans/2026-09-29-vendor-kiosk-custom-checkout.md`: booker still
holds a slot for every abandoned checkout. Decisions D1–D3 resolved.

> Carved out of `.plans/2026-10-02-booker-search-and-booking-gaps.md` item **K4** on the user's
> decision (2026-10-04): the symptom is booking-capacity, but every fix is payment-shaped, so it
> belongs in a payment workstream rather than a booking-gaps one.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision; numbers are plan-local —
> qualify cross-plan references by app and plan (e.g. "kiosk-checkout B4").

---

## ⚠️ Coupling — read this before planning any expiry mechanism

`.plans/2026-09-29-vendor-kiosk-custom-checkout.md` (**IN PROGRESS**) already designs this exact
lifecycle for the kiosk. Its **B4** names the same root cause as K4, cites the same migration lines
(`20260828000001:369`, `:415` — pending bookings count toward capacity whether paid or not), and
specifies a server-run expiry with a guarded release RPC.

⚠️ **It explicitly EXCLUDES booker:** *"never blanket-cancel old pending rows, paid/free bookings,
confirmed bookings **or booker/mobile reservations**."* So booker's gap is genuinely uncovered —
but the **machinery** to fix it (a release RPC, a transition rule that admits a system actor, a
duplicate-index decision) is being designed there.

**Therefore the central question of this plan is D1: reuse that machinery or build a second one.**
Building a booker-only expiry in parallel would give the platform two different answers to "when
does an unpaid reservation die", which is the kind of divergence that is cheap to create and
expensive to reconcile. The honest default is to **wait and reuse**.

That plan's **B2** ("confirmation claims payment without verifying it") also has a booker twin —
recorded here as **B3**, because the code is booker's own.

---

## BLOCKERS

### B1 — an abandoned checkout holds the slot forever  ⏸ PARKED (2026-10-04) — handed to the kiosk plan by D1
**Files:** `booker/components/booking/BookingWizard/useBookingWizard.ts` (`confirmBooking`) ·
`backbone/supabase/migrations/20260828000001_schedule_window_minutes_expand.sql:369`, `:415`.

`confirmBooking()` inserts the booking **before** the checkout session exists, so capacity is
consumed the moment the booker presses "Pay". If they never pay, the row stays `pending` and
`is_paid = false` for ever, and the placement trigger counts it against the slot like any other.
**Nothing expires it.** No sweeper, no hold, no TTL — confirmed by searching the migrations.

⚠️ **This went dormant and is now live again.** Between `f331560` (2026-09-22) and K9's restore
(2026-10-04) booker could not reach a checkout at all, so there was nothing to abandon. Restoring
payment restored this.

⚠️ **A server-side sweeper is BLOCKED BY THE TRANSITION TRIGGER, not merely unwritten.** Read from
the live function: `pending → cancelled` is permitted for `v_booker or v_vendor or v_command` —
**there is no system actor**. A service-role worker is refused. So any expiry needs either a
trigger change or an RPC, both approval-gated, and both exactly what kiosk-checkout B4 is
designing.

**⏸ PARKED by D1(a), 2026-10-04 — reason and unblock condition:** the fix is a shared lifecycle,
and `.plans/2026-09-29-vendor-kiosk-custom-checkout.md` **B4** is already designing it. Building a
second expiry here would give the platform two answers to the same question.
**Unblocks when** that plan's B4 reaches its schema gate **and** its exclusion of "booker/mobile
reservations" is widened to admit booker under the same guarded release. At that point this item is
"extend the kiosk's release path to booker reservations, with D2's 30-minute window", not a new
mechanism.
⚠️ **Parked is not fixed.** Until then booker leaks a slot per abandoned checkout, and **B2 is the
mitigation** — it keeps the slot payable instead of merely held.

**Verify:** a booking left unpaid past the window releases its slot; a payment landing during the
sweep wins; a confirmed booking is never touched; concurrent release and placement cannot double
sell. Needs a live environment.

### B2 — a booking that failed or abandoned checkout can never be paid  ✅ DONE (2026-10-04)
**Files:** `booker/components/booking/BookingWizard/useBookingWizard.ts` (the only caller of
`/api/payment/create-session`) · `booker/components/activity/BookingDetailModal/`.

The wizard is the **only** place in booker that creates a checkout session — verified by grep. So a
booking whose payment setup failed, or whose checkout was abandoned, has **no route to payment at
all**. The booker's only option is to cancel and rebook.

⚠️ **And rebooking the same slot does not work — see B4.** The two together mean an abandoned
checkout currently has *no* recovery path that ends in a paid booking for that slot.

⚠️ **The app already tells the booker the booking survives.** `useAppShell.ts:246` greets the
cancel return with *"Payment cancelled. Your booking is saved as pending."* — true, and it implies
a way to pay later that does not exist.

**Fix approach:** a "Pay now" action on an unpaid `pending` booking in Activity, calling the
existing route with the existing booking id. The route already authenticates, verifies ownership
and derives the amount server-side, so no new server surface is needed.
⚠️ **It must refuse a booking that is already paid or no longer `pending`**, and must tolerate an
existing `payment_reference` from the abandoned attempt — kiosk-checkout **B3** ("payment attempts
can multiply or become untraceable") is the same hazard and its conclusion should be reused.

**Component separation:** as planned — the control is in `BookingDetailModal`, the state and call
in `useBookingDetailModal`, no new component, no new stylesheet.

**✅ DONE 2026-10-04.**
- `lib/bookerActions.ts` — `payBlockedReason()` / `canPay()`, **5 new tests**.
- `services/bookings.service.ts` — `payForBooking()`, reusing the wizard's route unchanged.
- `useBookingDetailModal` / `BookingDetailModal` — a **"Pay now"** primary button.

⚠️ **`pending` ONLY, deliberately narrower than the refund rule**, which also allows `confirmed`. A
vendor confirming an unpaid booking is them choosing to honour it; taking money for it afterwards is
a different transaction, and the payout ledger is written from `is_paid` at creation. A test walks
every status to hold that line.
⚠️ **`setBusy(true)` is never undone on success** — the browser is navigating away, and re-enabling
the button on a page that is leaving invites a second checkout session.
⚠️ **An existing `payment_reference` from the abandoned attempt is not an error.** The route
overwrites it; treating a retry as a conflict would strand exactly the booking this rescues.
⚠️ **The provider lives entirely behind `/api/payment/create-session`**, so a change of payment
provider does not reach this function — relevant given the user's planned PayMongo rework.

⚠️ **A redundant fixture was added and removed the same day.** A dedicated `bookingpay` gallery mode
selected the same unpaid `pending` booking as `bookingcancel` and produced a **byte-identical**
screenshot (confirmed by md5). It was two more baselines to maintain for no signal, so it was
dropped and `bookingcancel`'s comment now records that the pane covers both controls.

**Verified:** `tsc` clean, **219 unit tests**, lint **17** (booker's baseline), `next build`
compiles, and the capture run failed on exactly `bookingcancel` ×2 — the expected gain of a button —
then **99/99 on two consecutive full runs**.
⏸ **The redirect itself is unverified** — it needs a live payment, which the user has deferred
pending their PayMongo rework.

### B3 — success is claimed on the redirect, not on settlement  ✅ DONE (2026-10-04)
**File:** `booker/components/layout/AppShell/useAppShell.ts:230-243`.

Returning with `?payment=success` shows *"Payment successful!"* after checking only that the
booking **belongs to the caller** — it selects `id` and never reads `is_paid`. The redirect is a
browser navigation the customer controls; the webhook is the authority, and it may lag or fail.

So a booker can be told their payment succeeded while `is_paid` is still false — and the ownership
check, which is good, can be mistaken for a settlement check, which it is not.

⚠️ **This is kiosk-checkout B2 in booker's own code**, and the two should agree on what counts as
proof of payment.

**✅ DONE 2026-10-04.** `useAppShell.ts` now selects `id, is_paid` in the same query and the wording
comes from **`lib/paymentReturn.ts`**, a pure function with **4 tests**.

- owned + paid → success, as before
- **owned + NOT paid → `info`: "We're confirming your payment — your booking will update
  shortly."** This is the case that previously announced success.
- not owned → silence, unchanged

⚠️ **The not-yet-paid message must not alarm and must not say "try again".** The ordinary cause is a
webhook in flight, which resolves in seconds; telling someone to pay again invites a double charge.
A test asserts the text matches neither `/success/i` nor `/again|retry|failed/i`.
⚠️ **Ownership was always checked and still is** — it answers "is this yours?", never "is it paid?".
The two were easy to conflate because one query happened to serve both.

**Verified:** 4 unit tests, `tsc`, lint 17, build.

⚠️ **AND LOCALLY, THE "SLOW" BRANCH IS THE ONLY ONE A REAL PAYMENT CAN PRODUCE** — which makes this
item easier to test than expected, and easier to misread as broken. PayMongo posts the webhook from
their servers and cannot reach `localhost`, so a local test payment leaves `payment_reference` set
and **`is_paid = false` permanently**. Observed 2026-10-04 on two bookings made through "Pay now".
So "We're confirming your payment" is the correct local outcome, every time.

The other two branches are reachable by visiting the return URL directly, since the toast reads
only ownership and `is_paid`:
`/?payment=success&booking_id=<paid booking of the signed-in booker>` → success;
`<any id not theirs>` → silence.

**✅ THE LOCAL BRANCHES WERE SEEN BY THE USER (2026-10-04)** and read correctly.

⏸ **A genuinely settled payment still needs a deployed environment** — locally it is unreachable by
construction, not by configuration.

⚠️ **BUT THE HARD HALF IS ALREADY PROVEN ON STAGING, through a different front door.** The user
reports kiosk payments settling there, and **`vendor` has no webhook route at all** — verified:
`vendor/app/api/kiosk/payment/` contains only `create-session`. Settlement for every surface runs
through **`booker/app/api/payment/webhook`**, the sole endpoint (`booking-flow.md:471`). So a kiosk
payment settling on staging demonstrates that booker's endpoint is deployed and reachable, its HMAC
verification passes, and its service-role `is_paid` write lands.

**What that leaves genuinely unverified is narrower than "a settled payment":**
1. **booker's own `create-session`** producing a working `checkout_url` — a different file from the
   kiosk's route.
2. **The restored client call (gaps plan K9)**, which has never run anywhere but locally.
3. **B3's `success` branch** — the "Payment successful!" wording on a payment that really did
   settle. The `info` branch is exercised locally every time; the success branch is not.

Recorded in `architecture/booking-flow.md` under the webhook section so it is not rediscovered.

### B4 — cancelling does not free the slot for the same booker  ✅ DONE (2026-10-04)
**Index:** `bookings_no_duplicate` — `UNIQUE (booker_id, schedule_id, booked_date, coalesce(start_time,'00:00'))`,
read from `pg_indexes` on 2026-10-04. **It has no status predicate.**

A cancelled booking keeps occupying the unique key, so the same booker **cannot rebook the same
slot**: the insert raises `23505`, which `createBooking` maps to `already_booked` and the UI reports
as *"You've already booked this slot."* — true of a cancelled row, and useless as guidance.

⚠️ **This invalidates advice shipped on 2026-10-04.** K9's payment-failure message says *"You can
cancel it from Activity and book again."* The cancel works; the "book again" does not, for the same
slot. **The message must change or this index must.** Recorded as a correction, not discovered
later.

⚠️ kiosk-checkout **B4** reaches the same index from the kiosk side and ties relaxing it to a
verified managed release (its D5). A unilateral change here would pre-empt that.

**✅ DONE 2026-10-04.** The message in `useBookingWizard.ts` now reads *"Your booking is saved but
not paid. Cancel it from Activity if you no longer want it — to try again, book a different time."*
The index is untouched, pending kiosk-checkout D5.

**Both halves measured** against the live database in a rolled-back transaction, rather than
asserted:
```
created an unpaid pending booking (an abandoned checkout)
booker cancelled it            -> status=cancelled
rebooked the SAME slot         -> REFUSED 23505   (B4 confirmed)
booked a DIFFERENT time        -> ALLOWED         (what the new message says to do)
```
⚠️ **B2 supersedes this wording** — now that a booking can be paid from Activity, cancelling is no
longer the only route. Left as-is deliberately: this message fires when payment *setup* failed, so
"pay it from Activity" would send the booker to a button whose own call just failed.

**✅ THE PREMISE WAS CONFIRMED LIVE (2026-10-05), by accident.** While trying to reach this message,
the user re-booked a slot they had cancelled earlier and got **"You've already booked this slot."**
That is `bookings_no_duplicate` refusing the retry — the exact wall this wording exists to warn
about, previously demonstrated only in a rolled-back SQL transaction.

⏸ **The rendered toast itself is still unobserved**, and two attempts to reach it failed earlier in
the chain:
1. **Stopping Supabase** fails booking *creation*, not payment setup — `getUser()` cannot complete,
   so `createBooking` returns `not_signed_in` and the wizard aborts before the payment call. That
   attempt produced item **I2**.
2. **Blocking `*create-session*` in DevTools** is the right lever, but the booking must succeed
   first — a duplicate slot aborts before the request is ever made (DevTools showed "0 affected").

**To reach it:** block `*create-session*`, then book a slot the booker does not already hold —
**Boat Parking** had no bookings at all. ⚠️ **Lowest-risk item outstanding**: the string is in the
file, type-checked and built; only its rendering is unseen.

---

## IMPORTANT

### I2 — "Your session expired" is shown when Supabase is merely unreachable  ✅ DONE (2026-10-05)
**Files:** `services/bookings.service.ts:24` · `components/booking/BookingWizard/useBookingWizard.ts:182`.

With the database down, pressing "Pay" reports **"Your session expired. Please sign in again."** The
session is usually fine; the server is simply unreachable. `createBooking` calls
`supabase.auth.getUser()`, gets no user because the call cannot complete, and returns
`not_signed_in` — which the wizard renders as an expired session.

⚠️ **The message is not careless — it was chosen for a real case**, and its comment says so: a
session can outlive its refresh token (e.g. after a local `db reset`) while a still-valid access
token keeps serving reads, so the wizard loads normally right up to the booking write. That case
deserves exactly this wording. **The defect is that one symptom now carries two causes**, and the
instruction it gives — sign in again — cannot work during an outage, and will itself fail.

**Found while trying to test B4**: stopping Supabase was expected to fail the *payment* call, but it
fails booking *creation* first, so execution never reaches B4's message at all.

**Fix direction:** distinguish "no user" from "could not ask". `getUser()` returns an error object;
a transport failure is not an absent session. Something like *"We can't reach the server right now.
Please try again in a moment."* for the error case, keeping the current wording for a genuinely
absent user.
⚠️ **Not urgent and not a blocker** — it misdiagnoses an outage, it does not lose a booking. Logged
because it is a real wrong answer given to a customer, and because it is two lines.

**✅ DONE 2026-10-05.** `CreateBookingResult` and `PayResult` gain **`unreachable`**, distinguished
with **`isAuthRetryableFetchError`** — which is how supabase-js itself tells the two apart, and is
already exported from the client in use, so no new dependency. Checked **before** `!user`, because a
failed call also has no user and would otherwise fall through to the old message.

The new wording: *"We can't reach the server right now. Please try again in a moment."* — which,
unlike "sign in again", is an instruction that can actually succeed.

⚠️ **TWO call sites, not one.** `payForBooking` (B2, written the day before) had the identical flaw
and is fixed in the same breath.

**The discrimination was measured, not assumed:**
```
network failure (AuthRetryableFetchError) -> true
no session      (AuthSessionMissingError) -> false
null (no error)                           -> false
```
So a genuinely dead session still gets "Your session expired", which is the case that wording was
chosen for and which its original comment defends.

**Verified:** `tsc` clean, 219 unit tests, lint 17, `next build` compiles, plus the helper check
above. ⏸ The outage path itself needs the database stopped — the user has already seen the *old*
message that way, so the route is known to be reachable.

### I1 — `booking-flow.md` is accurate again, with two small drifts  ✅ DONE (2026-10-04) — ⚠️ there were FIVE
**File:** `architecture/booking-flow.md:319-321`.

The documented call exists again after K9, so the serious drift is closed. Two details remain:
step 4 still says the client sends "legacy `amountCentavos`/`description`" — the restored code
sends **only** `{ bookingId }` — and the sequence does not mention that **documents upload before
the payment call**, which is a deliberate ordering (the redirect abandons anything not awaited).

**✅ DONE 2026-10-04 — and the item under-counted its own scope.** It predicted two drifts; reading
the whole payment section found **five**, because B2 and B3 changed behaviour the same pages
describe and the plan was written before either existed.

1. **The flow diagram** (line ~31) omitted the document upload and promised an unconditional
   success toast.
2. **The ordered steps** omitted the upload entirely, and did not say the ordering is load-bearing.
3. **Step 4's "legacy `amountCentavos`/`description`"** — no longer sent. ⚠️ Also recorded there:
   the call was **missing entirely from 2026-09-22 to 2026-10-04**, which the document never
   acknowledged.
4. **"Returning from PayMongo"** claimed a success toast on ownership alone; it now carries the
   three-row table of what `is_paid` produces.
5. **"Pay now" was undocumented** — a new section, since the wizard is no longer the only caller of
   `create-session`.

**Verified:** re-read against the code at each cited point. Documentation only — no code, no tests,
no baselines.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. -->

- **D1 — does booker reuse the kiosk's lifecycle, or get its own?** → **(a) WAIT AND REUSE**
  (resolved 2026-10-04). One definition of "an unpaid reservation has died", one RPC, one audit
  trail. **B1 therefore does not execute in this plan**: it ships as an extension of
  kiosk-checkout **B4**'s release path, after that plan's schema gate, and this plan records the
  handoff.
  ⚠️ **The accepted cost, stated plainly: booker keeps leaking slots until that plan moves.** B2
  is what makes that tolerable — a held slot that can still be paid is a much smaller problem than
  one that cannot — which is why B2 is not gated on this.
  ⚠️ **Someone must widen kiosk-checkout B4's scope**, which today says "never … booker/mobile
  reservations". That sentence was written to stop a blanket sweep, not to exclude booker for ever,
  but it is the line that currently makes this handoff a no-op. Raise it on that plan.
  Options rejected: (b) a booker-only expiry now — faster, but a second mechanism to reconcile and
  its own approval gate anyway; (c) accept the hold permanently.

- **D2 — how long is booker's hold?** → **30 MINUTES from the checkout session being created,
  capped by the booked start time, measured by server time** (resolved 2026-10-04).
  ⚠️ **A number, not "longer than the kiosk's"** — my own recommendation was vague, and a hold
  window that is never written down is inherited by accident. 30 minutes is long enough for a card
  or GCash payment including a retry, and short enough to free a slot the same day.
  ⚠️ **It is deliberately NOT the kiosk's five minutes.** That window exists because a walk-in is
  standing at a tablet with a queue behind them; a booker at home is not, and five minutes would
  cancel people who are still paying.
  ⚠️ **Provisional until B1 actually executes.** Under D1(a) the mechanism is the kiosk plan's, so
  this number must be agreed against its D3 rather than set unilaterally here.

- **D3 — should a cancelled booking free its slot for the same booker (B4)?** → **(b) LEAVE THE
  INDEX, CHANGE THE WORDS** (resolved 2026-10-04), with (a) considered alongside the kiosk plan
  rather than decided here.
  **So B4 becomes a one-string fix**: K9's payment-failure message must stop promising a rebooking
  that the unique index refuses. No schema change, no migration.
  Option (a) — a partial index `WHERE status NOT IN ('cancelled','refunded')` — stays on the table,
  but it pre-empts kiosk-checkout **D5**, which ties relaxing this to a verified managed release.

---

## DEFERRED / COSMETIC

- **Nothing is deferred yet.** When D1 resolves, whichever options it rejects move here with the
  reason, rather than disappearing.

---

## Execution order

1. **I1** — documentation only, no dependency, safe now.
2. **B3** — booker-local, no schema, no cross-plan coupling. The honest-success fix stands alone.
3. **B2** — "Pay now". Depends on nothing in this plan; it is the single largest reduction in harm
   from B1, because a held slot that can still be paid is a much smaller problem than one that
   cannot.
4. **B4** — wording under D3(b) ships with B2; any index change waits for the kiosk plan.
5. **B1** — last, and gated on **D1**. If D1 says reuse, this item moves to the kiosk plan's batch
   and this plan records the handoff rather than the work.

⚠️ **The order is deliberately not B1-first.** B1 is the headline bug, but it is the one coupled to
another in-progress plan and to an approval-gated schema change. B2 and B3 are independent, and
B2 removes most of B1's user-visible harm without touching the lifecycle at all.

---

## Verification

| Item | Machine-verifiable | Needs a live environment |
|---|---|---|
| B1 | the release predicate as a pure function; SQL rehearsed in a rolled-back transaction | expiry timing, concurrent payment-vs-release, the sweep itself |
| B2 | a "payable" predicate unit-tested beside `canCancel`/`canRequestRefund`; `tsc`, lint, build, visual baseline for the new control | the redirect reaching PayMongo test checkout |
| B3 | the message as a pure function of `(owned, isPaid)` | real webhook timing, including a delayed one |
| B4 | the index definition; a rolled-back insert proving the 23505 | — |
| I1 | re-read against the code | — |

⚠️ **A live payment needs an `sk_test` key, which `booker/.env.local` has** (confirmed 2026-10-04),
so this can be exercised without moving real money.
