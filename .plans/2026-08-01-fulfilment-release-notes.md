# Fulfilment release — what to tell vendors and bookers

**Date:** 2026-08-01
**Status:** DRAFT — copy for review, not yet sent
**Companion to:** `.plans/2026-07-31-booking-fulfilment-dual-acknowledgement.md` (item I10)

> Two user-visible changes ship together and will generate support load if they
> arrive unannounced. This is the draft notice. **Nothing here has been sent.**

---

## The one that will cause complaints

**A vendor's "Total Payout" figure will drop the first time this ships.**

Before: a booking counted toward the payout total the moment the vendor
**accepted** it — before the service happened, before the rental was handed over,
before anything was delivered.

After: it counts once the booking is **complete**, meaning both the vendor and the
customer have confirmed it (or the 3-day timer confirmed it for them).

The old number was overstated. No money has been lost and nothing has been taken
away — the figure now means what its label always claimed. But a vendor who
looks at that number weekly will see it fall, and will assume something broke.
**Say this before they see it, not after.**

---

## Draft — vendor notice

> **You now confirm when a booking is finished**
>
> We've changed how bookings are completed, so it's clear to both you and your
> customer when a job is actually done — and so your payout is tied to it.
>
> **For services** (exams, lessons, consultations, callouts): when you've
> finished, tap **Mark as done**. Your customer is asked to confirm. If they
> don't respond within 3 days, it confirms automatically.
>
> **For rentals** (vehicles, equipment, courts, rooms): tap **Hand over** when the
> customer takes it. They tell us when they've brought it back, and you tap
> **Got it back** to confirm. Again, 3 days and it confirms itself.
>
> **What changed about your payout:** it's now released when a booking is
> complete, rather than when you accept it. Your Total Payout may look lower than
> you're used to — that's because it previously counted bookings that hadn't
> happened yet. Nothing has been removed from your account.
>
> **If something goes wrong** — the item comes back damaged, or the customer
> disputes the work — tap **Something's wrong**. The payout pauses and Ezzy takes
> a look.
>
> Tapped the wrong button? **Undo** puts it back, as long as your customer hasn't
> responded yet.

**Before sending, vendors must have set each offering's type.** Every existing
offering defaults to **service**. A vendor with rentals who hasn't reclassified
them will see "Mark as done" where they expect "Hand over". Either prompt them to
check their offerings first, or reclassify the obvious ones centrally.

---

## Draft — booker notice

> **You'll be asked to confirm when a booking is done**
>
> When a vendor marks your booking complete, you'll see a **Yes, all done** button
> on your dashboard. Tapping it confirms the booking and releases the vendor's
> payment — so only tap it if everything went as expected.
>
> If you've rented something, tell us when you've returned it with **I've returned
> it**, and the vendor confirms it on their side.
>
> You have **3 days** to respond. After that it confirms automatically, so the
> vendor isn't left waiting.
>
> If something wasn't right, tap **Something's wrong** instead. The booking goes
> on hold and Ezzy will look into it.

---

## What NOT to say

- **Do not describe a reversed payout as a refund.** `reversed` means the vendor
  won't be paid. It says nothing about the customer's money — there is no refund
  mechanism in the platform, and implying one creates an expectation nobody can
  meet. Same applies to Command's UI copy.
- **Do not promise automatic payouts.** "Mark as paid" in Command records a
  transfer made by hand. There is no payout rail.

---

## Sequencing

1. Reclassify or prompt for rental offerings *(before release)*
2. Vendor notice — lead with the payout change, not the buttons
3. Booker notice — can follow, lower urgency
4. Brief support on: the payout drop, the 3-day timer, and that a stuck rental
   needs Ezzy to override it (Command → Overview → Fulfilment oversight)
