# Ezzy Booker — live verification: local acceptance, then staging, then production

**Date:** 2026-09-29
**App / scope:** `booker/` **as deployed** — the checks that cannot be run from a terminal. No code changes belong to this plan; a failure here opens an item on the plan that owns the code.
**Status:** ✅ **COMPLETE for its staging scope (2026-10-14).** Every staging check passed: ✅ **L0** (2026-10-01), ✅ **L6**, ✅ **L5** (2026-10-13), ✅ **L1**, ✅ **L4**, ✅ **L2** (2026-10-14) — all performed by the user in the real UI, with read-only database verification alongside. ⏸ **L3-a and L3-b remain PARKED** — production posture is deliberately deferred as a pre-production gate, and is the only reason this plan is not closed outright. ⚠️ The run **found and fixed a defect** (F3, closed 2026-10-14): no confirmed booking carrying a clock time had ever been cancellable from booker's UI, in any environment. It also **withdrew a false finding** (F2) that had been written from an unverified assumption. **L3-c decided** — the booker demo seed is staging-only, never production (`architecture/database-reset-and-deploy.md`). ⬜ **F1** remains open and documented: `booker-demo-seed.sql` has no double-run guard. ⚠️ One presentational detail unconfirmed — **I15**, the wizard opening at Schedule; see L2.

> Split out of `.plans/2026-09-18-booker-home-search-redesign.md` on 2026-09-29 on the user's
> instruction: *"All the stages that involve live testing (staging or prod), put them in a
> separate plan for later. I will need to run tests on the booker locally before I move to push
> it to staging."* That sequence is the plan — **L0 local, then L1–L2 staging, then L3 production.**

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** L# = a live-verification stage. Numbers are plan-local. Items keep their
> original redesign-plan IDs in brackets so existing references still resolve.

---

## Why this plan exists separately

Every item here shares one property: **a machine in this repo cannot settle it.** They need a
real browser, a second real account, PayMongo's test mode, or a hosted database. Mixing them into
the build plan made that plan look incomplete when it was in fact finished and waiting on a
person.

⚠️ **The whole set is gated on L0.** Pushing to staging before the local pass means debugging two
environments at once.

---

## Environment facts (verified, carry these into every stage)

| Fact | Detail |
|---|---|
| Staging project | `fbxbwnfeimzhgxpshdpa` |
| `backbone/` CLI link | **Staging, not production.** No `supabase` command run from this repo reports on prod |
| Migrations applied | `20260922000001_slot_occupancy_rpc.sql` and `20260927000001_popular_offerings_rpc.sql` are on **local, staging and production** (2026-09-27) |
| EXECUTE grants | Verified by the user on **both** hosted environments 2026-09-28 — `anon` has none on either function |
| Booker production | **Not serving users** (confirmed 2026-09-28). Nothing here is customer-facing yet, which is why L3 is posture rather than urgency |
| Local dev | `localhost`, not `127.0.0.1` (WSL2). Playwright wants :3200 and cannot start while a dev server holds it |

---

## L0 — Local acceptance gate  ✅ COMPLETE 2026-10-01 — passed by the user

What you asked for: run booker locally and satisfy yourself before staging. Nothing below leaves
your machine.

**Machine checks green as of 2026-10-01**, re-verified against booker `bb2ec84` (mine, re-run
any time): `npx tsc --noEmit` clean · `npm test` **154/154** · `npm run lint` **18 problems, all
pre-existing** · `npx playwright test visual-tests/` **77/77**.

⚠️ **The earlier 2026-09-29 figures were stale.** Poppins landed after them (`ae85bd1`,
`bb2ec84`) and a global typeface change moves nearly every baseline, so that run said nothing
about the code as it stands. `threshold: 0.02` survived the font work — checked at
`playwright.config.ts:47` — so the suite is still load-bearing for colour rather than back to
counting zero pixels.

**What only you can judge:**

- ⚠️ **AMENDED 2026-09-29 — L0-a now covers a second change, and its scope grew from 19 baselines
  to 69.** `.plans/2026-09-29-booker-poppins-base-font.md` made **Poppins** booker's single type
  family (body *and* headings; Bricolage Grotesque removed), which re-recorded **69 of the 71**
  baselines — every pane with text. The two untouched are `infotip-light`/`dark`, which contain no
  text. So this pass is now judging **the redesign palette and the new typeface together**, which is
  deliberate: the alternative was passing L0-a on the old font and then repeating the whole pass.
  Machine checks that are already done and are *not* what L0-a is for: 154/154 tests, `tsc`, `build`,
  visual **77 passed twice at exit 0**, touch targets and focus counts unchanged, tile labels
  unclipped at 360/390/1280. What still needs **your eye**: whether Poppins reads well at the 10–11px
  label tier, the badge pills, and the amount columns on Payments (`tabular-nums` is a no-op under
  Poppins — the column still aligns, measured at a 0.00px decimal spread, but you should confirm it
  looks right). ⚠️ The vendor **taglines** are the one thing no baseline covers at all, on either
  client — the gallery never renders them; their italic was verified by measurement only.
- **L0-a — re-review the re-recorded baselines**  ✅ **DONE (2026-09-30) — passed by the user.**
  The user reviewed booker after the Poppins change and accepted it (*"I've taken a look … that's
  good"*), then instructed on 2026-09-30 that this item be marked done. Recorded as **their**
  acceptance, not a machine result — no automated check can stand in for it, and the machine
  evidence listed in the amendment above proves stability and colour, not that it reads well.
  ⚠️ **What this does and does not unblock:** it clears L0-a's gate on L1–L3. **L0-b, L0-c and
  L0-d are still ⬜ and still the user's** — the seeded-shelf check, both themes at 360/390/1280,
  and the wizard end to end were not part of this pass and are not marked by it.
  (19 named below from the redesign; **69 in total** after the Poppins change — see the
  amendment above).** ⚠️ **This is not a repeat of a check you
  already passed.** Your earlier acceptance ("the baselines are all good") happened while the
  suite was still colour-blind — `threshold` defaulted to 0.2, so the palette you were shown was
  not necessarily the one on disk (redesign plan F64/F66). The 19 in question: `home`,
  `divisions`, `popular`, `opentoday`, `bookagain`, `bookingconfirm`, `step4`, `steppay`,
  `notfound`, `error` (light + dark, minus `divisions-light`). In
  `booker/visual-tests/pilot.spec.ts-snapshots/` — **booker-relative**, not workspace-root.
  ⚠️ Five of those — `bookingconfirm`, `step4`, `steppay`, `notfound`, `error` — I never edited.
  I verified their drift is text anti-aliasing only (every delta ≤24/255, narrow text bands, top
  colours identical) but **nobody has looked at them since 2026-08-31**.
- **L0-b — the storefront Home against seeded data.** `backbone/supabase/demo/booker-demo-seed.sql`
  is applied locally. All five shelves must render: Popular, Available today, Book again, Vendors
  in your city, and the in-progress strip. ⚠️ **Every shelf hides itself when empty**, which is
  exactly how three of them stayed dead for two stages without anything failing (F58). An absent
  shelf is not proof of a bug, and not proof of health either — check each deliberately.
- **L0-c — both themes at 360, 390 and 1280.** Default theme is **dark** (`defaultTheme="dark"`),
  so dark is the first impression, not the variant.
- **L0-d — the wizard end to end on local**, as far as the payment step. The payment itself is L2.

**Exit condition:** you say local is good. Then L1.

---

## L1 — [S3b-5] Staging: a second booker's booking lowers "N left"  ✅ COMPLETE (2026-10-14)

**Verified on staging 2026-10-14** with two real accounts, clean before/after.

**Subject:** schedule `de300000-0000-4000-8000-000000000301` — Demo Court Hire, Citywide Sports
Center, window 08:00 + 720 min, 60-minute slots, **capacity 30**. Slot **2026-10-16 10:00**, chosen
because it held zero bookings.

| Step | Who | Observed |
|---|---|---|
| before | liza@bookdeck.com | badge **30 left** |
| book | ben@bookdeck.com | booking `2df74e47`, `pending`, unpaid |
| ground truth | read-only query | `bookings_now = 1`, `badge_should_say = 29` |
| after | liza@bookdeck.com | badge **29 left** |

⚠️ **Why the drop is the proof and the number alone is not.** Ben's row is invisible to liza under
RLS. A booker counting client-side sees only their own bookings and would therefore still have read
**30** — which is exactly what F61 was, and the wizard rendered a confident number either way. Liza
reading 29 is only possible if `get_slot_occupancy` ran `SECURITY DEFINER` and counted across
bookers.

The badge also never had to be distinguished from a failure: I49 made Step 3 track `occupancyKnown`
and render **no badge** when the lookup fails, rather than `0` (which reads as Full). A number
appeared, so the RPC answered.

**Ground truth was computed WITHOUT the RPC** — a direct aggregate over `bookings` with the same
`status not in ('cancelled','refunded')` filter — so a broken RPC could not have supplied both sides
of the comparison.

**What:** with two real booker accounts on staging, book a slot as A and confirm the remaining
count drops for B.

⚠️ **Why "the number looks sensible" is not the test.** `get_slot_occupancy` is `SECURITY DEFINER`
because RLS hides other bookers' rows; a booker computing counts client-side sees only their own
bookings and so sees full capacity. **A correct count and a dead RPC used to look identical** —
that was F61, and the wizard rendered a confident "20 left" either way.

✅ **I49 (2026-09-28) changed the failure mode, which makes this easier to judge:** Step 3 now
tracks `occupancyKnown` and renders **no badge at all** when the lookup fails, never `0` (which
would mean Full). So on staging:

| What you see | What it means |
|---|---|
| A number that **drops** after A books | ✅ The function works and RLS is being bypassed correctly |
| A number that **does not drop** | ❌ The count is wrong — reopen against `services/schedules.service.ts` |
| **No badge** | ❌ The RPC is failing or ungranted on staging — not a UI bug |

**Verification type:** needs a live environment; two accounts are the irreducible requirement.
**Related:** the same check covers the redesign plan's `I14` live row.

---

## L2 — [S6-b] Staging: Explore → Offering → Schedule → Pay  ✅ COMPLETE (2026-10-14)

**Completed on staging 2026-10-14** by the user, booking `12f830a5` — Demo Equipment Hire,
Citywide Sports Center, ₱250, PayMongo **test mode**.

**Route taken:** the wizard run was abandoned at the PayMongo page (the user refreshed it), leaving
a `pending`, unpaid booking with a session reference. Payment was then completed from **Activity →
Pay**, so this run also exercises **B2** — paying a booking whose checkout was abandoned. Before B2
that booking could only have been cancelled, and not even rebooked for the same slot, because
`bookings_no_duplicate` holds a cancelled row's slot.

⚠️ **The earlier "one attempt per booking" caution was wrong and is withdrawn.** The webhook matches
on `booking_id` in the session metadata, not on `payment_reference`, so a second checkout session
settles the same booking correctly. Only traceability is affected.

**Settlement — the decisive evidence:**

| | |
|---|---|
| Booking created | 23:35:39 UTC |
| **Ledger row written** | **23:46:08 UTC** |
| `is_paid` | **true** |

`bookings_create_transaction` fires `AFTER UPDATE OF is_paid`, **never on insert** — so a ledger row
ten minutes after creation can only mean the webhook arrived and flipped it. Totals moved 140 → 141
for both paid bookings and ledger rows. **This is PayMongo settlement working end to end, the one
thing never demonstrated in any environment before 2026-10-13** (the webhook cannot reach localhost).

**Money path, computed by the trigger:** `amount_paid` 250.00 · platform fee 11% = 27.50 ·
`payout_amount` 222.50 · `net_payout_amount` 221.39 after withholding · `payout_status` **held**.

**B3 verified — the point of the item.** The user saw *"Payment successful! Your booking is pending
confirmation."*, the `is_paid = true` branch of `paymentReturnMessage`. That means the webhook landed
**before** the redirect returned, and — critically — the toast was chosen by **reading `is_paid`**,
not by trusting `?payment=success`. Until 2026-10-04 the code read ownership alone and announced
success regardless, so a booker could be told their money had gone through while `is_paid` was false.

**Notifications:** `new_booking` ×3 and `payment_confirmed` ×3, all portal `vendor` — Citywide has
exactly 3 vendor-admins, so that is one each, not duplication. No booker-facing row, which is correct:
`payment_confirmed` is seeded "Sent to vendor when PayMongo confirms" and the webhook's fan-out is
vendor-only by design.

⚠️ **Not explicitly confirmed: I15** — that the wizard opens at **Schedule** when entered from the
offering page. The user walked the wizard to the PayMongo page on the first attempt but did not
report which step it opened on, and the second attempt bypassed the wizard via Activity → Pay. The
money path is fully verified; this one presentational detail is not.

## L4 — [plan 2026-10-02 F3] Staging: Explore's reveal cap and its photo fetch  ✅ COMPLETE (2026-10-14)

**Verified on staging 2026-10-14**, signed in as ben@bookdeck.com, Explore with nothing typed.

**Catalogue measured read-only first, so the check could actually fail:** **32** active offerings,
all with a vendor row (the `vendors!inner` join drops none). Above 24, so the cap is falsifiable —
below it the test would have proved nothing.

| Half | Observed | Verdict |
|---|---|---|
| Reveal cap | "32" total shown, **24 cards rendered**, "**8 remaining**" revealed on Show more | ✅ the slice is applied |
| Bounded photo fetch | the `offering_attachments` request payload carried **exactly 24 ids**, not 32 | ✅ keyed to `visibleIds`, not the full result set |

⚠️ **Counting requests would NOT have worked, and the first instruction given was wrong.**
`getCoverPhotos` batches 50 ids per request, so at 32 offerings both the bounded (24) and unbounded
(32) cases produce exactly **one** request. Only the **id count inside the payload** discriminates.
At 10,000 offerings — what `fetchAllPages` can return — the unbounded form becomes up to **200
serial round-trips**, which is what the cap exists to prevent and what no local fixture can show.

**Bonus, verified incidentally and significant:** several cards rendered **real photographs**. Until
K11 (2026-10-05) `img-src` omitted the Supabase origin, so **no offering photo had ever rendered in
booker in any environment** — this is the first time that fix has been exercised anywhere. 12 of the
32 active offerings carry photos (15 rows, all 15 with real objects, zero orphans), so placeholder
marks on the remainder are correct rather than a failure.

**What:** open Explore on staging against a real catalogue, with nothing typed, and confirm two
things: **24** service cards render (not the whole catalogue), and the cover-photo requests are
bounded to what is on screen.

**Why it is here and not on the plan that built it.** `.plans/2026-10-02-booker-ui-fixes-and-explore-proposal.md`
item I4 is code-complete and its branch logic is verified, but the cap itself has **no local
exercise**: the only Explore fixture (`explorechips`) ships an **empty catalogue on purpose**,
because `csp.spec.ts` asserts that fixture makes no network call. Seeding offerings into it would
fire `getCoverPhotos` and break that test, so the one thing that would prove the cap is the one
thing the fixture may not do.

⚠️ **What the cap is protecting against, in numbers.** `fetchAllPages` pulls up to **10,000**
offerings (`lib/pagedFetch.ts`) and `getCoverPhotos` chunks ids **50 at a time, sequentially**
(`services/offeringPhotos.service.ts`). Unbounded, opening Explore on a large catalogue would fire
up to **200 serial round-trips**. On a small staging catalogue the bug is invisible — which is
exactly why this needs a real one, or a deliberate check of the request count rather than a glance
at the page.

**How to judge it:**

| What you see | What it means |
|---|---|
| 24 cards, then "Show more (N remaining)" | ✅ The cap holds |
| Every offering rendered at once | ❌ The slice is not being applied — reopen against `useExplorePage.ts` |
| One `offering_attachments` request per 50 **visible** ids | ✅ The photo fetch is bounded |
| Requests continuing past the visible cards | ❌ The effect is keyed to the wrong list |

⚠️ If staging's catalogue has **fewer than 24 active offerings**, this check cannot fail and
therefore proves nothing. Say so rather than passing it.

**Verification type:** needs a live environment with real catalogue data. Not simulable here.
**Related:** the plan that owns the code is `2026-10-02-booker-ui-fixes-and-explore-proposal.md` (I4).

---

## L3 — Production posture  ⏸ PARKED 2026-10-01 (L3-c ✅ decided)

Booker production is **not serving users**, so this is a pre-launch checklist, not an incident
queue.

- **L3-a — re-run L1's occupancy check on production.** ⚠️ Both RPCs reached production on
  2026-09-27 **before** L1 confirmed the numbers were right on staging. If the counts are wrong,
  production is where it shows, and no command in this repo reports on prod (the CLI is linked to
  staging).
- **L3-b — `architecture/production-env-checklist.md`**: per-variable Vercel requirements and the
  post-deploy probes. Not re-verified since this redesign landed.
- **L3-c — may the demo seed run on a hosted environment?** ✅ **DECIDED 2026-10-01 — staging
  only, never production.** You agreed with the recommendation, and it is now **written down** in
  `architecture/database-reset-and-deploy.md` → "The hosted-safe alternative", which is the doc
  that answers "which seed is safe in which environment".
  **The reason recorded is the honest one.** `booker-demo-seed.sql`'s mechanics are sound — I
  checked rather than assumed: additive, tagged `de400000-`, one transaction (`begin;` line 57 …
  `commit;` line 250), it raises and rolls back if the booker or vendor is missing (lines 115, 132,
  147), and it disables `bookings_notify_new`, `bookings_notify_status_change` and the
  `notifications` user trigger for the duration (61–63, restored 246–248) so ~14 bookings cannot
  send real email to a real vendor's admins. The rule is not about mechanics; it is that
  fabricated bookings and payments in a production database are a trust problem even when they can
  be removed cleanly.
  ⚠️ **Found while checking: no double-run guard** → logged as **F1** below, for you to close.
---

## L5 — [plan 2026-10-02 B1] Staging: a booking document really arrives  ✅ COMPLETE (2026-10-13)

**Verified on staging 2026-10-13**, booking `d60a0ebb-6297-4e0a-a106-949c6fb5776b`, by the user in
the real booker UI with `.plans` queries run against staging.

**Happy path — both halves landed.** `booking_documents` row `label='Valid Government ID'`,
`is_required=true`, and the object genuinely present: **276,888 bytes, `image/jpeg`**, at
`d60a0ebb…/cda254a9….jpg`. `path_convention_ok` true — the first segment is the booking id, so the
`(storage.foldername(name))[1]::uuid` cast every policy depends on parses rather than raising. The
orphan query returned **no rows**: no bytes without metadata.

**Client-side rejection — verified both rules.** A `.docx` produced *"That file type isn't accepted
— use a JPG, PNG or PDF."*; a JPEG over 5 MB produced *"That file is over 5 MB…"*. ⚠️ **The counter
stayed at "0 of 1" in both cases** — which is the actual assertion under test, since until
2026-10-03 this screen reported files as uploaded while discarding them on selection.

⚠️ **The server-side failure message was NOT tested, and cannot be reached through the UI.**
`lib/bookingDocuments.ts` accepts JPEG/PNG/PDF under **5 MB** while the bucket accepts the same
types under **10 MB** — the client's rules are a strict SUBSET of the bucket's, deliberately
(`"5 MB, deliberately BELOW the bucket's 10 MB"`). So nothing the client accepts can the bucket
refuse, and *"Booked, but we couldn't attach X"* is reserved for genuine infrastructure failures.
This is good design, not a gap — but **if anyone later widens the client limits to match the
bucket's, that path becomes reachable and would then be untested.**

**Not a bug, per the owning plan:** the vendor sees nothing. `booking_documents` has had a
vendor-admin SELECT policy since 2026-05 and no vendor UI has ever read it — that is **C1** on
`.plans/2026-10-02-booker-search-and-booking-gaps.md`, not a finding here.

**What:** make a booking for an offering that requires a document, attach a file, pay or abandon,
then confirm **both halves landed**: an object in the private `booking-documents` bucket under
`{booking_id}/…`, and a matching `booking_documents` row.

**Why it cannot be done from here.** The upload runs as the signed-in booker — both the storage
policy and the table policy resolve ownership through `bookings.booker_id` — and no local fixture
has a session. `/ui-gallery` is client-only with no auth, by design.

⚠️ **Why this one matters more than a normal smoke test.** Until 2026-10-03 this screen told the
booker *"N of M required uploaded"* while **discarding the file on selection** — it asserted
something that had not happened. The fix is only worth as much as the proof that bytes now arrive.

**How to judge it:**

| What you see | What it means |
|---|---|
| A file at `booking-documents/{booking_id}/…` **and** a `booking_documents` row | ✅ Both halves |
| A row but no object | ❌ Should be impossible — the service removes the object only when the row fails, never the reverse. Reopen against `bookingDocuments.service.ts` |
| An object but no row | ❌ The cleanup path failed; the object is orphaned |
| "Booked, but we couldn't attach X" | The honest failure path working. Worth triggering deliberately once, with the bucket's MIME list violated |

⚠️ **Also check what the vendor sees: nothing.** That is expected today and is **C1** on the owning
plan — `booking_documents` has had a vendor-admin SELECT policy since 2026-05 and no vendor UI has
ever read it. Do not record this as a bug here.

**Verification type:** needs a live environment and a signed-in booker.
**Owning plan:** `.plans/2026-10-02-booker-search-and-booking-gaps.md` (B1, gate G1 applied
2026-10-03).

---

## L6 — [plan 2026-10-02 K2] Staging: a booker cancellation, and the three refusals  ✅ COMPLETE (2026-10-13)

**Run 2026-10-13 against staging, booker `00000000-…-0014`.** Vendor confirmations were
performed as a real vendor-admin by simulating `request.jwt.claims` in a transaction, since
the user holds no credentials for that vendor — so the trigger's **vendor branch** was
exercised, but not the vendor **UI**.

| Case | Subject | Result |
|---|---|---|
| 1 — unpaid `pending` → Cancel | Car Detailing `5af30974` | ✅ **PASS** — succeeded 48 minutes before start, proving the `pending` exemption from the 24h rule. `status=cancelled`, `cancelled_by` = booker, `rejection_reason` empty |
| 2 — unpaid `confirmed`, >24h | Consultation `c9144643` | ✅ **PASS (2026-10-13, after the F3 fix was deployed)** — Cancel appeared on the same booking that had offered no control an hour earlier, and succeeded. `status=cancelled`, `cancelled_by` = booker, `rejection_reason` empty, `cancel_log_rows=1`, notifications `new_booking, booking_confirmed, booking_cancelled`, **`rejected_emails=0`** |
| 3 — unpaid `confirmed`, <24h | Consultation `3776d4ab` | ✅ **PASS** — RPC refused with `Confirmed bookings can only be cancelled up to 24 hours before the booked time [22023]`; row untouched (`still_confirmed`, `never_cancelled`, `reason_untouched`, 0 log rows, 0 notifications) |
| 4 — paid, any status | 4 paid confirmed bookings | ✅ **PASS** — no Cancel control; "Request a refund" offered instead. ⚠️ The RPC's paid refusal is a **backstop only**: `cancelBlockedReason` is unpaid-only, so the UI never reaches it |
| 5 — non-cancellable status | Court Rental `bcfd4e13` (`in_progress`, unpaid) | ✅ **PASS** — no Cancel control. Chosen unpaid deliberately, to isolate the *status* refusal from the *paid* one |
| 6 — no "Booking Rejected" email | cases 1, 2 and 3 | ✅ **PASS across all three outcomes of one RPC.** `pending → cancelled` produced **no** notification (that branch requires `old.status='confirmed'`); `confirmed → cancelled` produced **`booking_cancelled`**; a refused cancellation produced nothing. **`booking_rejected` never appeared.** The only other row was `new_booking`, written by `notify_on_new_booking` at insert time to the vendor |
| 7 — regression trio | vendor confirm ×2; both dispute kinds; kiosk close-out | ✅ **COMPLETE (2026-10-13).** **Vendor confirm** — `pending → confirmed` twice through the real trigger with a genuine vendor-admin actor. **Complaint** — booker flagged `bcfd4e13`, booking → `disputed`; Command resolved to `completed` (`in_progress→disputed`, then `disputed→completed` with notes). **Refund request** — booker raised one on paid confirmed `092593c8`; Command resolved to `refunded`. Log shows **`confirmed→refunded` with NO `disputed` hop**, and the notes carried through — so `app.status_change_note` reached the trigger on the one transition that requires it. **Migration `20261003000003` verified.** **Kiosk close-out** — tested as a PAIR, because a positive alone proves nothing: (A) vendor-admin `…0012` moved kiosk booking `82f7befa` `in_progress→returned` — **allowed**; (B) clean vendor-admin `…0008` attempted the same on booker-origin `30000000-…-0003` — **refused**, `Invalid booking status transition … actor not permitted` at `validate_booking_status_transition()` line 84. The only difference between them is `booked_via`, so the kiosk condition is proven enforced. Both rolled back. ⚠️ Actors for the vendor and kiosk halves were **simulated via `request.jwt.claims`** — the trigger's branches are verified, the vendor and kiosk **UIs** are not, as no credentials exist for those vendors |

⚠️ **Case 6 is stronger than a single check:** one RPC produced three different notification
outcomes — none from `pending`, `booking_cancelled` from `confirmed` (pending case 2's retest),
and **never** `booking_rejected` from either.

**Limits of this run, stated rather than glossed:** the vendor confirm and kiosk close-out were
exercised at the **trigger** level with simulated actors, not through the vendor or kiosk UIs,
because no credentials exist for those vendors. Every booker-facing case was performed in the
real UI by the user. ⚠️ L6 also **found and fixed a defect** — see F3 — which is why cases 1–5
span two days: case 2 was impossible until booker 0.26.1 shipped.

**What:** cancel an **unpaid** booking as the booker, and confirm the three refusals behave.

**Why it cannot be done from here.** `booker_cancel_booking` resolves ownership from `auth.uid()`
and the trigger it depends on is actor-aware; neither is exercisable without a real session.

⚠️ **The riskiest part is not the button.** G3 also widened
`validate_booking_status_transition()`, which governs **every** booking status write in booker,
vendor, command and the kiosk. A mistake there does not break cancellation — it breaks something
else entirely. **Exercise one vendor confirm, one kiosk close-out and one dispute resolution** as
part of this check, not just the new path.

**How to judge it:**

| Case | Expected |
|---|---|
| Unpaid `pending` → Cancel | ✅ status `cancelled`, `cancelled_by` = the booker |
| Unpaid `confirmed`, > 24h before | ✅ cancelled |
| Unpaid `confirmed`, < 24h before | ❌ refused — "up to 24 hours before" |
| **Paid**, any status | ❌ refused — names the refund route (G4 is not built) |
| `fulfilled` / `returned` / etc. | No Cancel control offered at all |
| **After any cancellation** | ⚠️ the booker must **not** receive a "Booking Rejected" email. That email fires on a `cancelled` transition carrying a `rejection_reason`, which this RPC deliberately never writes — this is the check that proves it |
| Vendor confirm, kiosk close-out, dispute resolve | ✅ all still work — the trigger widening touched nothing else |

⚠️ **The 24-hour boundary is the one worth testing near the edge**, in Manila time. The client and
the RPC each compute it independently (`lib/bookerActions.ts` mirrors the SQL), so a timezone slip
shows up as the button being offered for something the server then refuses.

**Verification type:** needs a live environment, a signed-in booker, and a vendor account for the
regression half.
**Owning plan:** `.plans/2026-10-02-booker-search-and-booking-gaps.md` (K2, gate G3 applied
2026-10-03).

---

## Not in scope

- **Any code change.** A failure here opens an item on the plan owning that code, usually
  `.plans/2026-09-18-booker-home-search-redesign.md`.
- **React Native.** `.plans/2026-09-29-booker-mobile-parity-groundwork.md`.
- **Applying migrations.** The user applies all migrations; none is outstanding for booker.

---

## Big table

| Done | ID | What | Who | Status | Why / reason |
|:-:|---|---|---|---|---|
| [x] | L0-a | Re-review the re-recorded visual baselines — **69**, not 19 (amended 2026-09-29) | You | ✅ **DONE 2026-09-30** — passed by you; no longer blocks L1–L3. ⚠️ L0-b/c/d are unaffected and still open | ⚠️ Not a repeat: your earlier pass was shown a palette the suite could not verify (F64/F66). 5 of the original 19 are panes nobody has looked at since 2026-08-31. ⚠️ **Now also covers Poppins as the base font** (`2026-09-29-booker-poppins-base-font.md`), which re-recorded 69 of 71 baselines — judge palette **and** typeface in one pass |
| [x] | L0-b | Storefront Home against the local demo seed — all five shelves | You | ✅ DONE 2026-10-01 | **Your acceptance.** Checked against the local `de400000-` seed |
| [x] | L0-c | Both themes at 360 / 390 / 1280 | You | ✅ DONE 2026-10-01 | **Your acceptance**, covering the Poppins face as shipped |
| [x] | L0-d | Wizard end to end locally, up to the payment step | You | ✅ DONE 2026-10-01 | **Your acceptance.** The payment round trip itself stays L2 |
| [x] | L1 | [S3b-5] Staging: a second booker's booking lowers "N left" | You | ✅ **COMPLETE 2026-10-14** — liza saw 30, ben booked, liza saw 29. Ground truth computed independently of the RPC; the drop proves the `SECURITY DEFINER` cross-booker count | Booker is now on staging and the migrations are applied, so the old "not on staging yet" reason is gone. Still needs two real accounts; a dead RPC shows **no badge**, not a wrong number (I49) |
| [x] | L2 | [S6-b] Staging: Explore → Offering → Schedule → Pay, PayMongo test mode | You | ✅ **COMPLETE 2026-10-14** — settled via the webhook (ledger row 10 min after creation), money path correct, B3's `is_paid`-checked toast shown. I15 not explicitly confirmed | Staging push done. ⚠️ Coordinate with `.plans/2026-10-11-checkout-provider-verification.md`, which is also driving PayMongo test mode. ⚠️ When it runs: one attempt per booking — retry could double-charge (F3, parked P2) |
| [ ] | L3-a | Re-run the occupancy check on **production** | You | ⏸ **PARKED 2026-10-01** | Your call — still local-only. **Unblocks** after L1 passes on staging. ⚠️ Both RPCs reached prod *before* the numbers were confirmed anywhere, so this is still owed |
| [ ] | L3-b | Walk `production-env-checklist.md` | You | ⏸ **PARKED 2026-10-01** | Your call. **Unblocks** when a production deploy is actually planned. Not re-verified since the redesign landed |
| [x] | L3-c | Decide: may the demo seed ever run on a hosted environment? | You | ✅ **DECIDED 2026-10-01 — staging only, never production** | You agreed with the recommendation. ⚠️ Now **written down**, in `architecture/database-reset-and-deploy.md` → "The hosted-safe alternative", where someone looking for the rule will find it. Reason recorded as the real one: fabricated bookings in a production database are a trust problem even though the teardown is clean |
| [x] | L4 | Staging: Explore renders **24** cards with nothing typed, and the photo fetch is bounded | You | ✅ **COMPLETE 2026-10-14** — 32 catalogue / 24 rendered / 8 remaining, and the photo request payload carried exactly 24 ids. Also the first time an offering photo has ever rendered in booker, anywhere (K11) | Moved here from `2026-10-02-booker-ui-fixes-and-explore-proposal.md` F3 on your instruction. ✅ **Both halves runnable.** Staging holds 32 catalogue entries (so the 24 cap is falsifiable) and 12 active offerings carry photos, so cover-photo requests do occur and can be counted. The earlier claim that no offering had a photo was wrong — see F2. Was unblocked on the staging push, like L1/L2. ⚠️ Cannot be tested locally at all: the only Explore fixture ships an empty catalogue because `csp.spec.ts` asserts it makes no network call. ⚠️ Proves nothing if staging has fewer than 24 active offerings |
| [x] | L5 | Staging: a booking document really reaches the bucket **and** the table | You | ✅ **COMPLETE 2026-10-13** — row + 276,888 bytes + path convention + no orphans; both client rejections verified with the counter holding at 0 of 1. Server-side failure path unreachable by construction, stated in the L5 section | Added from `2026-10-02-booker-search-and-booking-gaps.md` B1. `20261002000001_booking_documents_storage` is now applied to staging and all four policies verified present, so the bucket half is finally reachable. ⚠️ Matters more than a smoke test: this screen used to claim "uploaded" while discarding the file. ⚠️ The vendor seeing nothing is expected — that is C1, not a bug |
| [x] | L6 | Staging: booker cancellation, its three refusals, **and the trigger regression** | You | ✅ **COMPLETE 2026-10-13** | All 5 cases, the no-rejection-email check across all three RPC outcomes, and the full regression trio. Found and fixed **F3** on the way — confirmed bookings had never been cancellable from the UI in any environment. Vendor/kiosk halves verified at trigger level only; see the L6 section. ⚠️ The risk is not the button — G3 widened the shared status-transition trigger, so also exercise a vendor confirm, a kiosk close-out and a dispute resolve. ⚠️ Confirm **no "Booking Rejected" email** follows a booker cancellation |
| [ ] | F1 | `booker-demo-seed.sql` has **no double-run guard** | You to close | ⬜ TODO (found 2026-10-01) | Found while writing L3-c's rule. `demo-seed.sql` aborts with "Demo data is already present"; the booker pair does not, so a second run duplicates ~14 bookings. The teardown matches the whole `de400000-` prefix so it does clean up both sets. Logged, not fixed — your call whether it is worth a guard |
| [ ] | F2 | ~~No offering on staging has a photo, so L4's bounded-photo-fetch half cannot be observed~~ | — | ✖ **WITHDRAWN 2026-10-14 — THE CLAIM WAS FALSE.** Measured against staging: **15 active `kind='photo'` rows across 12 active offerings, and all 15 have real objects in `offering-photos` (zero orphans)**. The original entry was written on 2026-10-12 from an assumption that was never checked against the database, and it then sat in this plan as if it were a measurement — the exact failure the status model exists to prevent. **L4's bounded-photo-fetch half is runnable** and L4 is not half-blocked. ⚠️ Retained rather than deleted so the mistake stays visible. The one true part: `getPublicUrl(storage_path)` means a row without an object renders a broken `<img>` — which is why the orphan count was worth measuring, and it is zero |
| | F2-original | **No offering on staging has a photo, so L4's bounded-photo-fetch half cannot be observed** | You to close | ✖ superseded by the row above — kept verbatim as the original wording | Found while unparking L4. `offering_attachments` rows with `kind='photo'` resolve through `getPublicUrl(storage_path)` (`booker/services/offeringPhotos.service.ts:37`), so a row without a real object in the public `offering-photos` bucket renders a broken `<img>`, and no rows at all means **zero** cover-photo requests — the assertion "the photo fetch is bounded" then passes while testing nothing. ⚠️ Note this would be the **first** offering photo ever rendered in booker in any environment: `img-src` omitted the Supabase origin until K11 fixed it. Seeding needs an upload to the bucket plus the row, in that order — a SQL-only seeder cannot work. Logged, not fixed; the user set this aside deliberately on 2026-10-12. L4's 24-card half is unaffected and runnable now
| [x] | F3 | **No `confirmed` booking with a clock time could be cancelled from booker's UI, in any environment** | You | ✅ **CLOSED 2026-10-14 by the user** | Found by L6 case 2. `services/bookings.service.ts:132` passed `row.start_time` through raw while the type claimed `"HH:MM"`; PostgREST serialises a `time` column as `"HH:MM:SS"`, so `cancelBlockedReason` built `…T10:00:00:00+08:00` → `Date.parse` NaN → the fail-safe guard returned `too_late` → **the control was never rendered**. Failed SAFE, so nothing looked broken. `pending` was unaffected (the parse sits inside the `confirmed` branch), which is why case 1 passed and why plan K2 shipped green. ⚠️ **Every unit fixture used `"09:00"` and the ui-gallery fixtures bypass `toBooking()` entirely** — so neither the 219 unit tests nor the visual suite could have caught it. Fixed on booker `feature/cancel_booking_fix`: mapper now slices `startTime` **and** `endTime`, the parse slices defensively, and a regression test asserts both shapes (proven to fail without the fix: 219/220). ⚠️ Side effect: `PaymentReceipt.tsx:60` renders `startTime` **raw**, so real users saw `"10:00:00"` and will now see `"10:00"` — still not 12-hour like every other surface, which is a separate cosmetic inconsistency left untouched. **Fix deployed as booker 0.26.1 (`702ffe1`) and retested: the same booking that offered no Cancel control now cancels correctly (case 2 ✅). Left open for the user to close**
| [x] | Grants | EXECUTE-grant query on staging **and** production | You | ✅ DONE 2026-09-28 | Both hosted environments match local; no `anon` on either function |
| [x] | Apply | `20260922000001` + `20260927000001` on local, staging, production | You | ✅ DONE 2026-09-27 | All three environments level |
| [x] | Machine | `tsc`, tests, lint, visual suite — local | Me | ✅ **RE-VERIFIED 2026-10-01** against booker `bb2ec84` | ⚠️ The 2026-09-29 run was **stale**: Poppins landed after it (`ae85bd1`, `bb2ec84`), and a global typeface change moves nearly every baseline. Re-run on current HEAD: `tsc` clean · **154/154** · lint **18, all pre-existing** · visual **77/77** (the whole `visual-tests/` dir). `threshold: 0.02` survived the font work, so the suite is still load-bearing for colour. ⚠️ Still proves stability, not that it looks right |

---

## Verification — and its limits

| Stage | Machine-verifiable | Needs a live environment or a person |
|---|---|---|
| L0 | `tsc`, `npm test`, lint, the Playwright suite — all green | **Everything that matters here:** whether it looks right, and whether all five shelves appear |
| L1 | Nothing. The RPC's existence and grants are already proven | Two real booker accounts on staging |
| L2 | Nothing | Staging keys, PayMongo test mode, a browser |
| L3 | Nothing from this repo — the CLI is linked to staging | A production session |

⚠️ **The honest limit:** the visual suite became load-bearing for colour only on 2026-09-29. Every
"visual NN/NN" dated earlier in the redesign plan proved the baselines were *stable*, never that
they matched the code. L0-a is the first check that can catch a wrong palette.
