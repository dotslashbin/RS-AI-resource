# Fulfilment — manual test script

**Date:** 2026-08-01
**Status:** READY TO RUN — nothing here has been executed
**Covers:** `.plans/2026-07-31-booking-fulfilment-dual-acknowledgement.md`

> Everything in that plan was verified by type-check, build, and SQL against the
> local database. **None of it has been exercised in a browser.** This script
> covers exactly that gap. Work top to bottom; each section says what to look for
> and what would count as a failure.

---

## 0. Setup

```bash
cd backbone && npx supabase db reset      # rebuilds schema + seed from scratch
```

Then, in three terminals (ports matter — see `.claude` notes):

```bash
npm --prefix vendor  run dev -- --port 3100
npm --prefix booker  run dev -- --port 3200
npm --prefix command run dev -- --port 3101
```

Use **`http://localhost:<port>`, not `127.0.0.1`** — on this WSL2 machine
next-themes and other client effects silently fail on the loopback IP.

Seed leaves you with: 1 booking in `fulfilled`, 1 in `in_progress`, 1 in
`returned`, 11 `completed`, 20 `confirmed`, plus 3 `custody` offerings (all
COURT / "Court Rental") and 6 `session` offerings.

---

## 1. Vendor — session flow (the common case)

1. Sign in to **vendor**, go to **Bookings**.
2. **Filter tabs:** confirm there are **six** — All · Needs you · Active · Done ·
   Issues · Closed — and that they do **not wrap** at a normal window width.
   *Fail:* ten tabs, or a wrapped/overflowing row.
3. "Needs you" should carry a red count badge. "Issues" should too when a flag
   exists.
4. Find a `confirmed` booking on a **non-COURT** offering. It should show
   **"Mark as done"** and a small **ⓘ**.
5. **Click the ⓘ.** A popover should open on *click* (not hover) saying the
   customer will be asked to confirm and that it auto-confirms after 3 days.
   *Fail:* nothing happens, or it only opens on hover.
   Press **Escape** — it should close. **Tab** to it and press **Enter** — it
   should open. *Fail:* not keyboard reachable.
6. Click **Mark as done**. The row should move to "Awaiting customer" with an
   **"auto-confirms in 3d"** countdown and an **Undo** button.
7. Click **Undo**. It should return to `Confirmed`.
8. **Mark as done** again.

## 2. Booker — acknowledging

9. Sign in to **booker** as the customer on that booking.
10. On the dashboard, that booking must be **visible** and read *"Vendor marked
    this done"* with a **"Yes, all done"** button and `2d left` / `3d left`.
    *Fail — most important check on this page:* the booking is **missing**. That
    would mean `SHOWN_STATUSES` is filtering it out at exactly the moment the
    customer is being asked to act.
11. Open its **detail modal**. The footer's primary button should be
    **"Yes, all done"** (not the old "Reschedule" placeholder), with
    **"Something's wrong"** beneath and the auto-confirm sentence above.
12. Click **Yes, all done**. Modal closes; the row should become `Completed`
    **without a manual refresh** — that is Realtime working.
    *Fail:* status only updates after F5.

## 3. Vendor — the money moved

13. Back in **vendor** → **Transactions**. That booking's payout should now count
    toward the total.
14. **Sanity-check the headline number.** It should be *lower* than you remember
    if you knew the old figure — `confirmed` bookings no longer count. That is
    the intended change, not a bug.
15. A `confirmed`-but-not-fulfilled booking's row should render struck through
    with *"Not counted yet — released once you and the customer both confirm…"*.

## 4. Custody flow (rentals)

16. Vendor → a `confirmed` booking on a **COURT** offering. It should show
    **"Hand over"**, *not* "Mark as done". *Fail:* wrong verb ⇒ the
    `fulfilment_pattern` snapshot is wrong.
17. **Hand over** → status "With customer".
18. Booker side: that booking should offer **"I've returned it"**.
19. Click it → booker sees "Awaiting vendor"; vendor sees **"Got it back"** with a
    countdown.
20. Vendor clicks **Got it back** → `Completed`, payout releases.

## 5. Flags (either side)

21. On a `completed` booking, booker clicks **"Something's wrong"**.
22. Type **fewer than 10 characters** → expect an inline message, no submit.
    *Fail:* a raw Postgres error, or it submits.
23. Type a real reason → **Send to Ezzy**. Booking becomes "On hold".
24. Vendor side: the same booking shows **"On hold"** with **no action buttons**.
25. **command** → **Flags**. The flag should be listed with the reason, who raised
    it, booking context, and a **"Payout frozen"** chip.
    *Fail:* a **"Never paid"** chip on a booking that was paid — that was a real
    bug (fixed 2026-08-01); if it reappears the to-one embed regressed.
26. Click **Resolve** → choose **Complete it** → add a note → confirm.
27. Booking returns to `Completed`; the payout unfreezes.
28. **Check the customer's email/notification** — it must say the flag was
    *resolved*, **never "Booking Rejected"**. *Fail:* a rejection email. That is
    the landmine the plan guarded against three times.

## 6. Command — payouts

29. **command** → **Payouts**. Four tabs: Ready to pay · On hold · Paid · Owed back.
30. "Ready to pay" should list the completed bookings with vendor, fee, and payout
    columns, and a total.
31. Select two, click **Mark N as paid**. They should move to **Paid** with a
    release date.
32. Re-select nothing and confirm the button is disabled.
33. Read the amber warning at the top — it must say this **records** a transfer
    and does not move money.

## 7. Command — oversight and override

34. **command** → **Overview**. The **Fulfilment oversight** card should show
    three numbers: rentals out >14 days, open flags, timer-confirmed bookings.
35. To force a stale rental:
    ```sql
    update public.bookings set status_changed_at = now() - interval '30 days'
     where status = 'in_progress';
    ```
    Reload — it should appear in the list with "out 30 days".
36. Click **Override** → pick an outcome → enter **fewer than 10 characters** →
    expect a refusal. Then a real reason → confirm.
37. Verify the reason was recorded:
    ```sql
    select from_status, to_status, notes, changed_by
      from public.booking_status_log order by changed_at desc limit 1;
    ```
    `notes` must contain your reason. *Fail:* empty notes ⇒ an admin override is
    indistinguishable from a decision the two parties made.

## 8. Notification settings

38. **command** → **Settings** → notification types. All **13** types should be
    listed, each with a label **and** an audience (Booker / Vendor / Command /
    Both). *Fail:* blank audience cells on the six new rows.

## 9. Auto-acknowledge (the timer)

39. Force a due booking:
    ```sql
    update public.bookings set status = 'fulfilled',
           status_changed_at = now() - interval '5 days'
     where id = '<some confirmed session booking>';
    select public.auto_acknowledge_bookings();     -- returns rows promoted
    ```
40. It should return ≥1 and the booking should be `completed` with its payout
    `releasable`.
41. **Critical negative test** — an out rental must *never* auto-complete:
    ```sql
    update public.bookings set status = 'in_progress',
           status_changed_at = now() - interval '90 days' where id = '<a custody booking>';
    select public.auto_acknowledge_bookings();
    select status from public.bookings where id = '<that booking>';
    ```
    Must still be `in_progress`. *Fail:* anything else — that would mean the
    platform pays a vendor for an asset that never came back.

---

## Known-and-accepted during testing

- **Mobile apps** show raw values like "In_progress" — deferred (D3), not a bug.
- **Command → Transactions** is still mock data (D7). **Payouts** is the real one.
- **"Reschedule"** still appears in the booker's modal when no acknowledgement is
  due — that placeholder predates this work and was left alone.
- **No refunds exist anywhere** (D5). A reversed payout means the *vendor* is not
  paid; the customer's money is not returned by any code path.
- `npm run lint` is broken in vendor and booker (D6, pre-existing).

## If you find something

Note the step number and what happened. Anything in §2 step 10, §5 step 28, or
§9 step 41 is a **stop-and-fix** — those three are the load-bearing guarantees.
