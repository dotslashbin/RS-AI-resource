# Ezzy Booker — live verification: local acceptance, then staging, then production

**Date:** 2026-09-29
**App / scope:** `booker/` **as deployed** — the checks that cannot be run from a terminal. No code changes belong to this plan; a failure here opens an item on the plan that owns the code.
**Status:** IN PROGRESS — **L0 is COMPLETE (2026-10-01): L0-a, L0-b, L0-c and L0-d all passed by the user.** **L3-c decided** — the booker demo seed is staging-only, never production, now recorded in `architecture/database-reset-and-deploy.md`. ⏸ **L1, L2, L3-a and L3-b are PARKED at the user's request** — booker is not on staging yet and local testing continues; they unblock on the staging push, in that order. One finding logged for the user to close: **F1**, the booker demo seed has no double-run guard. **L5 and L6 added 2026-10-03** — the booking-document upload (B1) and booker cancellation (K2), both built on 2026-10-03 behind gates the user applied; neither is exercisable without a real session. **L4 added 2026-10-02** — Explore's reveal cap, moved here from the 2026-10-02 UI plan because no local fixture can exercise it; parked with L1/L2 until the staging push. **Nothing here is waiting on me.**

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

## L1 — [S3b-5] Staging: a second booker's booking lowers "N left"  ⏸ PARKED 2026-10-01

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

## L2 — [S6-b] Staging: Explore → Offering → Schedule → Pay  ⏸ PARKED 2026-10-01

**What:** one full booking against PayMongo **test mode** on staging.

Covers the redesign plan's live rows for **I15** (the wizard now starts at Schedule from the
offering page; Steps 1–2 and the map are gone) and the money path.

**Watch for:**
- The return URL resolving. `lib/siteUrl.ts` throws on a Vercel build with no usable site URL —
  see the comment in `app/api/payment/create-session/route.ts`.
- `is_paid` flipping on the booking after the webhook, **without a reload** (realtime, trap (i)).
- ⚠️ **Do not retry a failed payment.** Retry is parked as **P2** precisely because
  `create-session` could charge twice today (F3). One attempt per booking.

**Verification type:** needs staging keys and a browser. Not simulable here.

---

## L4 — [plan 2026-10-02 F3] Staging: Explore's reveal cap and its photo fetch  ⏸ PARKED 2026-10-02

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

## L5 — [plan 2026-10-02 B1] Staging: a booking document really arrives  ⏸ PARKED 2026-10-03

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

## L6 — [plan 2026-10-02 K2] Staging: a booker cancellation, and the three refusals  ⏸ PARKED 2026-10-03

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
| [ ] | L1 | [S3b-5] Staging: a second booker's booking lowers "N left" | You | ⏸ **PARKED 2026-10-01** | Your call — booker is not on staging yet and you are still testing locally. **Unblocks** the moment booker is pushed to staging. Still needs two real accounts; a dead RPC shows **no badge**, not a wrong number (I49) |
| [ ] | L2 | [S6-b] Staging: Explore → Offering → Schedule → Pay, PayMongo test mode | You | ⏸ **PARKED 2026-10-01** | Your call, same reason as L1. **Unblocks** on the staging push. ⚠️ When it runs: one attempt per booking — retry could double-charge (F3, parked P2) |
| [ ] | L3-a | Re-run the occupancy check on **production** | You | ⏸ **PARKED 2026-10-01** | Your call — still local-only. **Unblocks** after L1 passes on staging. ⚠️ Both RPCs reached prod *before* the numbers were confirmed anywhere, so this is still owed |
| [ ] | L3-b | Walk `production-env-checklist.md` | You | ⏸ **PARKED 2026-10-01** | Your call. **Unblocks** when a production deploy is actually planned. Not re-verified since the redesign landed |
| [x] | L3-c | Decide: may the demo seed ever run on a hosted environment? | You | ✅ **DECIDED 2026-10-01 — staging only, never production** | You agreed with the recommendation. ⚠️ Now **written down**, in `architecture/database-reset-and-deploy.md` → "The hosted-safe alternative", where someone looking for the rule will find it. Reason recorded as the real one: fabricated bookings in a production database are a trust problem even though the teardown is clean |
| [ ] | L4 | Staging: Explore renders **24** cards with nothing typed, and the photo fetch is bounded | You | ⏸ **PARKED 2026-10-02** | Moved here from `2026-10-02-booker-ui-fixes-and-explore-proposal.md` F3 on your instruction. **Unblocks** on the staging push, like L1/L2. ⚠️ Cannot be tested locally at all: the only Explore fixture ships an empty catalogue because `csp.spec.ts` asserts it makes no network call. ⚠️ Proves nothing if staging has fewer than 24 active offerings |
| [ ] | L5 | Staging: a booking document really reaches the bucket **and** the table | You | ⏸ **PARKED 2026-10-03** | Added from `2026-10-02-booker-search-and-booking-gaps.md` B1. **Unblocks** on the staging push. ⚠️ Matters more than a smoke test: this screen used to claim "uploaded" while discarding the file. ⚠️ The vendor seeing nothing is expected — that is C1, not a bug |
| [ ] | L6 | Staging: booker cancellation, its three refusals, **and the trigger regression** | You | ⏸ **PARKED 2026-10-03** | Added from the same plan (K2). **Unblocks** on the staging push. ⚠️ The risk is not the button — G3 widened the shared status-transition trigger, so also exercise a vendor confirm, a kiosk close-out and a dispute resolve. ⚠️ Confirm **no "Booking Rejected" email** follows a booker cancellation |
| [ ] | F1 | `booker-demo-seed.sql` has **no double-run guard** | You to close | ⬜ TODO (found 2026-10-01) | Found while writing L3-c's rule. `demo-seed.sql` aborts with "Demo data is already present"; the booker pair does not, so a second run duplicates ~14 bookings. The teardown matches the whole `de400000-` prefix so it does clean up both sets. Logged, not fixed — your call whether it is worth a guard |
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
