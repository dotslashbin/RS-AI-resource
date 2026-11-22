# Vendor — the offering price label must name the whole block, not "per hour"

**Date:** 2026-11-21
**App / scope:** vendor/ web only — `lib/duration.ts` (+ new `lib/duration.test.ts`), `lib/types.ts` (comment), `components/offerings/OfferingFormModal/useOfferingForm.ts`, `components/offerings/OfferingFormFields/PriceDurationFields.tsx`, `components/offerings/OfferingFormModal/OfferingFormModal.tsx`, `components/offerings/OfferingCreateWizard/{useOfferingCreateWizard.ts,OfferingCreateWizard.tsx}`, `visual-tests/pilot.spec.ts`, `visual-tests/offering-wizard.spec.ts`. Docs: `architecture/schema.md`, `architecture/portals.md`. No schema, migration, pricing/charging logic, booker, Expo or data change.
**Status:** COMPLETE (2026-11-21) — Stage 1 done, I5 approved, staging ✅ and production ✅ (both user-checked 2026-11-21). O3 moved to follow-up plan 2026-11-21-vendor-mobile-remove-price-per-unit (D3) — release: staging ✅ · production ✅

> A display-only fix. The vendor offering form says "per hour" for a price that is actually
> charged per block of `duration_minutes` (for example 4 hours). Make the label name the
> block so a vendor reads the price the way the database charges it.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, O# = Optional, D# = Decision,
> F# = Finding, S# / P# = staging / production release step. Numbers are plan-local;
> qualify cross-plan refs by plan (e.g. "2026-10-12 B1").

---

## ▶ RESUME HERE (updated 2026-11-21, end of Stage 1)
- **Done so far:** Stage 1 is complete. B1, B2, I1–I5, O1 and O2 are ✅; the user approved I5 on 2026-11-21.
- **Live where:** local ✅ · staging ✅ · production ✅ (promoted and checked by the user, 2026-11-21)
- **Next:** nothing in this plan. O3 (vendor mobile `pricePerUnit`) stays parked until the user approves it.
- **Decisions:** D1 = A, D2 = yes, D3 = O3 parked (all 2026-11-21). No OPEN lines.
- **Local state left behind:** the six tagged I5 offerings (description `price-label plan 2026-11-21 local check`, vendor Summit Athletics Club) are still in the local DB. **The user chose on 2026-11-21 to keep them** for their own testing. Remove them with the I5 cleanup SQL only when the user asks. They are local only and never reached staging or production.
- **Watch out for:**
  - Local data has offerings whose `duration_minutes` is out of step with the unit (for example 1 minute on `day`, 2 minutes on `hour`; seen 2026-11-21 in other vendors' rows). The edit form seeds a non-whole quantity for those, so `durationLabel` is empty and the suffix stays hidden. That is existing behaviour and out of scope. Don't mistake it for an I5 failure (F6).
  - A booker can book **quantity > 1** (F1), so "per booking" is not what the database charges. Don't write "per booking" in the UI or in `schema.md`.
  - The vendor form already says "One booking = 4 hours", where "booking" means one block (F2). Keep the price wording consistent with it, but don't reuse "booking" for the price.
  - Neither `offeringform` nor `offeringwizard` has a screenshot baseline (F3). Expect no baseline regeneration. Confirm this with a full `npm run test:visual`, and don't run `test:visual:update` blindly.
  - The vendor feature branch is already `feature/bug_fix_pricing_label` (checked 2026-11-21).

---

## Scope

**In:** the two vendor-web strings (B1, B2), the helper they share (I1), the stale test expectation and new assertions (I2), and baseline review (I3).

**Optional, decided by D2/D3:** the `schema.md` wording (O1) and the dead `pricePerUnit()` in vendor web, which I1 replaces anyway (O2). Vendor mobile's copy (O3) is parked.

**Out:** schema, migrations, `check_booking_consistency()`, pricing or charging logic, booker web and booker mobile (already correct: `booker/lib/duration.ts:81` `priceSuffix()`, `ezzy-booker-mobile/src/lib/format.ts`), the vendor offering card (`OfferingCard.tsx:93,97` shows price and duration separately, which is correct), the kiosk steps, and data fixes. Production data was checked read-only on 2026-11-21. Multi-hour prices there are per-block prices as the vendor intended, so the data needs no change.

---

## Findings (from the 2026-11-21 investigation)

### F1 — A booking can span several blocks, so the price is per block, not per booking  ✅ verified 2026-11-21
The brief said "`offerings.price` is the price of ONE booking". That holds only for quantity 1. The booker wizard lets the booker pick a quantity (`booker/components/booking/steps/Step3Schedule/useStep3Schedule.ts:15,140`) and charges `offering.price * quantity` (`useBookingWizard.ts:118`). The vendor kiosk has a quantity too (`vendor/components/kiosk/KioskBooking/useKioskBooking.ts:163`). So ₱29,999 for a 4-hour offering means ₱29,999 per 4-hour block, and a 2-block booking costs ₱59,998. **Correction:** the third wording option in the brief ("per booking (4 hours)") misstates the charge whenever quantity > 1, and O1 must not say "per booking" either.

### F2 — The form already reads back the block as "One booking = …"  ✅ verified 2026-11-21
`useOfferingForm.ts:57` builds `durationLabel = formatDuration(qty × UNIT_MINUTES[unit], unit)`, for example "4 hours". It is `""` while the quantity is invalid. `PriceDurationFields.tsx:72` renders "One booking = {durationLabel}". The current price label already hides its suffix when `durationLabel` is empty (`PriceDurationFields.tsx:36`). The fix can build on this. There is nothing new to compute in the component.

### F3 — No screenshot baseline covers the price label or the wizard review  ✅ verified 2026-11-21
The `modes` list in `pilot.spec.ts` (screenshot cases, lines 35–37) does not include `offeringform` or `offeringwizard`. `offering-wizard.spec.ts` has no `toHaveScreenshot`. The `offerings-*` baseline is the card grid, and the card shows no suffix. **Expected:** no baseline changes. I3 confirms this by running the full suite.

### F4 — Minute-based offerings are wrong too  ✅ verified 2026-11-21
A 90-minute offering currently reads "per minute", which is a 90× misstatement. Booker handles this with " / 90 min" (`booker/lib/duration.ts:85`). The new helper must cover it.

### F5 — `schema.md` already says "not per booking"  ✅ verified 2026-11-21
`architecture/schema.md:545` says "**Per unit of duration**, not per booking", and `:587` says "Price is per UNIT, not per booking". "Not per booking" is right (F1). "Unit of duration" is what reads as "per hour". Booker's own comment (`booker/lib/duration.ts:67`) has the same ambiguity. That is out of scope here; it is noted only.

### F6 — Some local offerings have a duration out of step with their unit  ✅ verified 2026-11-21
The local DB has rows such as `duration_minutes = 1` on `day` and `2` on `hour`, in seed vendors other than the I5 one. `useOfferingForm.ts:19-21` seeds `durationQty(...)` as a non-whole number, so `durQtyValid` is false and the price suffix is hidden. That is today's behaviour, and the new helper's minutes fallback (I1) keeps any rendering honest. **Out of scope.** Noted so that I5 doesn't misread it, and so it can be looked at separately if wanted. Status is left to the user.

### F7 — I4 escalated: the phone edit form was already out of line before this change  ✅ verified 2026-11-21
The plan said "today's shorter 'per minute' mostly fits". That was wrong. The I5 before run measured a **16 px** gap between the price and duration inputs in **every** phone edit-form shot, including "per hour", because "Price (PHP) per hour" already wraps at 390 px (`before/edit-PL4H-light-phone.png`). The wizard's full-screen sheet is wider and was aligned. So I4 also fixes an existing misalignment.

### F8 — On sign-in the local app opens the "Complete your account" reminder and the "Getting Started" guide at unpredictable moments  ✅ verified 2026-11-21
For the local seed vendor (no payout details yet, guide not dismissed), both modals can open shortly after the page loads. While one is open, the page behind it is hidden from accessibility queries, so role-based lookups fail. That caused the I5 script's early timeouts. The script now closes any open dialog until none has shown for 2.5 s. The before run used the earlier script, so its `cards-*` shots are covered by the guide. Its edit-form and wizard shots, and the labels read from the DOM, are unaffected. This is expected app behaviour, not a bug; it's recorded for the next scripted check.

---

## BLOCKERS

### B1 — Price field label says "per {unit}"  ✅ DONE (2026-11-21)
**Done:** `PriceDurationFields.tsx` renders the new `pricePerLabel` prop, built in `useOfferingForm.ts` from `pricePer()`; both callers pass it. Verified by tsc, the rewritten pilot test (I2) and I5 (24 edit-form shots, labels asserted from the DOM).
**File:** `vendor/components/offerings/OfferingFormFields/PriceDurationFields.tsx:36`
"Price (PHP) per hour" for a 4-hour offering suggests 4× the real charge. Both the create wizard (step 2) and the edit form use this component.
**Fix approach:** render a `pricePer` string prop in place of `per {ofDurUnit}`, computed in `useOfferingForm` from I1. Show the suffix only when the prop is non-empty, as today. Both callers pass the new prop: `OfferingFormModal.tsx:84` and `OfferingCreateWizard.tsx:102`. `ofDurUnit` stays a prop, because the unit `<select>` still needs it.
**Component rules:** `PriceDurationFields` stays pure display: one more string prop, no state or logic. The string is built in `useOfferingForm` (hook) via `lib/duration.ts`. No inline styles are added.

### B2 — Wizard review step says "₱… per {unit}"  ✅ DONE (2026-11-21)
**Done:** `useOfferingCreateWizard.ts:176` now reads `` `₱${fmtOfferingPrice(price)} ${form.pricePerLabel}` ``. The prop is named `pricePerLabel` rather than the planned `pricePer`, which avoids clashing with the helper's name. Verified by the new wizard test (I2) and I5 ("₱29,999 per 4 hours" and "Free (₱0)" in all 4 theme × width combinations).
**File:** `vendor/components/offerings/OfferingCreateWizard/useOfferingCreateWizard.ts:176`
**Fix approach:** `` `₱${fmtOfferingPrice(price)} ${form.pricePer}` `` (wording per D1). Leave the free case `"Free (₱0)"` unchanged. The duration is already validated before step 4, so `pricePer` is never empty there.
**Component rules:** formatting stays in the hook. `OfferingCreateWizard.tsx:139` already renders `w.review.price` and doesn't change.

## IMPORTANT

### I1 — A vendor `pricePer()` helper in `lib/duration.ts`, with a unit test  ✅ DONE (2026-11-21)
**Done:** `pricePer(minutes, unit)` replaces `pricePerUnit`, and `lib/duration.test.ts` has 4 tests covering every bullet below. `npm test`: 604/604 (600 before).
**File:** `vendor/lib/duration.ts:64-67` (replaces the dead `pricePerUnit`, see O2). New file: `vendor/lib/duration.test.ts`.
Booker's `priceSuffix()` can't be imported: the apps are separate repositories and never import from each other (core rules; `vendor/lib/duration.ts:9-12` already says so). A vendor helper gives one tested place for the rule. Without it, two components each build the string by hand.
**Shape (under the recommended D1 wording):** `pricePer(minutes: number, unit: DurationUnit): string`
- whole single unit → `"per hour"`, `"per day"`, `"per week"`, `"per month"`
- several units → `"per 4 hours"`, `"per 2 days"`
- `unit === "minute"` → always counts: `"per 90 minutes"`, `"per 1 minute"`. Plain "per minute" is the F4 trap. 1 minute is degenerate but stays honest.
- non-integer quantity → falls back to minutes, as `formatDuration` does (`"per 90 minutes"` for 90 on `hour`)

It reuses `durationQty` and the `formatDuration` pluralisation. It is not a copy of booker's short form unless D1 picks that form. The header comment notes that booker's `priceSuffix()` is the sibling and that the two must agree on the per-block meaning.
**Test:** `node --test` file following `booker/lib/duration.test.ts`, with one case per bullet above. It is picked up by `npm test` (`lib/**/*.test.ts`).

### I2 — Update the stale assertion and assert the fix  ✅ DONE (2026-11-21)
**Done:** `pilot.spec.ts` "price label names the whole block" checks 4 hours → 4 days → 1 day → blank, asserting the whole label with `toHaveText`. `offering-wizard.spec.ts` has a new test, "the review states the price per whole block". Both pass in the full suite.
**Files:** `vendor/visual-tests/pilot.spec.ts:412-416`, `vendor/visual-tests/offering-wizard.spec.ts:80-90`
- `pilot.spec.ts:415` expects `"per day"`, which is the buggy wording. That case happens to stay correct ("per day" for 1 day), so the test would still pass and prove nothing. Change it: set qty `4` + `hour` and expect `"per 4 hours"`, then `day` and expect `"per 4 days"`, then qty `1` and expect `"per day"`. Rename the test to "price label names the whole block".
- `offering-wizard.spec.ts`: add a priced review case. Fill a price and a multi-unit duration, then expect the review to show `"₱… per 4 hours"`. The test at `:83` covers only the free case today.

### I4 — Longer label must not misalign the price and duration inputs at phone width  ✅ DONE (2026-11-21)
**Done:** `items-end` on the row in `PriceDurationFields.tsx`. Measured in I5: the price and duration inputs' bottom edges differ by **0 px** in every shot, against **16 px** in every phone edit-form shot before the change (see F7).
**File:** `vendor/components/offerings/OfferingFormFields/PriceDurationFields.tsx:33` (the `flex gap-3` row)
*Added 2026-11-21 by plan review.* Price and Duration sit side by side in two `flex-1` columns, each with its own label above the input. The modal is `w-[calc(100vw-32px)] max-w-[520px]` with `p-6` (`OfferingFormModal.tsx:62`). At 390px each column is about 150px wide, so "Price (PHP) per 90 minutes" or "per 12 months" wraps to two lines while "Duration *" stays on one. The price input then sits lower than the duration input. Today's shorter "per minute" mostly fits, so this is new with the fix.
**Fix approach:** add `items-end` to that row, so both inputs share a bottom edge whatever the label height. This is one Tailwind class in the render layer, with no inline style. It changes nothing when both labels are one line. Don't truncate the label: the block size is the whole point of the fix.
**Check:** `/ui-gallery?mode=offeringform` and `?mode=offeringwizard` at 390px and at desktop width, in both themes, with qty 90 + minute and qty 12 + month. The inputs' bottom edges line up and the label is fully readable.

### I5 — Full visual check in the real app on local, with seeded data (agent-run, before the commit)  ✅ DONE (2026-11-21): every criterion passed; **approved by the user 2026-11-21** after reviewing the screenshots and the seeded offerings in their own browser
**Result (2026-11-21, after run):** **52 screenshots**, covering 13 cases in light and dark at 1280 px and 390 px.
- **Labels and review lines:** asserted from the DOM against the table below, with **0 mismatches**: "per hour", "per 4 hours", "per 2 days", "per 90 minutes", "per 12 months", "per 4 hours" (free); blank quantity gives "Price (PHP)"; live change gives "per 4 hours" then "per 4 days"; the review reads "₱29,999 per 4 hours" and "Free (₱0)".
- **Input alignment:** 0 px in all shots (I4).
- **Console:** 0 errors.
- **Cleanup:** 0 tagged rows; Summit is back to 5 offerings.
- **Before run on the untouched branch:** reproduced the bug ("per hour" for 4 hours, "₱29,999 per hour" on the review, "per minute" for 90 minutes) and the 16 px phone misalignment.
- **Screenshots reviewed by the agent:** `after/edit-PL4H-light-phone`, `after/edit-PL12MO-dark-phone`, `after/wizard-priced-review-dark-desktop`, `after/wizard-priced-step2-dark-phone` and `after/cards-light-desktop`, against `before/edit-PL4H-light-phone`.
- **Offering cards:** the before shots are hidden behind the Getting Started pop-up (F8), so no pixel before/after comparison exists for them. The evidence that they're unchanged is that `OfferingCard` isn't in the diff, and its committed `offerings-light`/`offerings-dark` baselines pass in I3.
- **Files:** `/tmp/claude-1000/-home-joshua-RS/e65809e1-bdae-402e-b491-eb530ced7608/scratchpad/i5/before/`, `/tmp/claude-1000/-home-joshua-RS/e65809e1-bdae-402e-b491-eb530ced7608/scratchpad/i5/after/`, each with `results.json`.
- **Deviation from the plan text:** the script drives Playwright as a library (`playwright` from `vendor/node_modules`), not the test runner with the vendor config. Committed baselines are therefore out of reach entirely, which is a stronger guarantee than `--update-snapshots=none`.
*Added 2026-11-21 at the user's request.* The user asked for **every** visual check to be run by the agent this time, against the real vendor app on local, **before the commit (S1) and before the staging deploy (S2)**. The user has authorised access to the local environment, including seeding the data the check needs (2026-11-21). The staging check (S3) stays as a short confirmation and no longer carries the full matrix.

**Environment (local only; staging and production are not touched):**
- DB: the local Supabase stack (`docker exec supabase_db_fbxbwnfeimzhgxpshdpa psql …`). Confirm the container is up before starting.
- App: vendor dev server on `http://localhost:3100` started by the agent with `PW_TEST=1` (this hides the dev indicator), using `localhost`, not `127.0.0.1`. ⚠️ Next's dev lock is per project folder, so if the user's own vendor server is running (usually :3000) the agent's won't start. Then the agent **asks the user to stop it** and never stops it itself. The agent stops its own server afterwards by the PID listening on :3100 (`ss -ltnp`), not with `pkill -f`.
- Login: the local dev-seed vendor admin of **Summit Athletics Club**, which belongs to that one vendor only, so there is no vendor picker. Its credentials are in the header of `backbone/supabase/seed.sql`, which is local-only and committed. They go to the script as environment variables on the command line and are **never written into this plan, the scratch script or any committed file**.

**Seed (additive, tagged, exactly reversible):**
- Lever: `public.offerings` for Summit Athletics Club. Its only trigger is `offerings_set_updated_at` (checked 2026-11-21), so there is no audit log and no status guard. No schedules or bookings are created, so nothing hangs off the rows.
- Rows. Each `code` is ≤ 6 characters and uppercase, per the checks, and each `description` = `price-label plan 2026-11-21 local check`:

  | code | duration | price | Covers |
  |---|---|---|---|
  | `PL1H` | 60 min, `hour` | 850 | 1-unit → "per hour" |
  | `PL4H` | 240 min, `hour` | 29999 | the reported bug → "per 4 hours" |
  | `PL2D` | 2880 min, `day` | 5000 | multi-day → "per 2 days" |
  | `PL90M` | 90 min, `minute` | 1200 | F4 → "per 90 minutes" |
  | `PL12MO` | 518400 min, `month` | 90000 | longest label, wrap (I4) → "per 12 months" |
  | `PLFREE` | 240 min, `hour` | 0 | free with a multi-unit block |

- Cleanup in a `finally`, so it runs even if the check fails: `delete from public.offerings where vendor_id = <Summit> and code in (…six codes…) and description = '<tag>'`, then a count of the tag that must return 0. Wizard saves are never pressed: the wizard flow stops at the review and is closed with **discard**, so it creates no rows.

**Script:** a scratch Playwright script in the session scratchpad. It's not committed and not added to `visual-tests/`. It imports the vendor `playwright.config.ts` by absolute path, with `webServer: undefined` and `baseURL: http://localhost:3100`, and `--update-snapshots=none`, so no committed baseline can change. It signs in, opens Offerings, and screenshots each case below into the scratchpad.

**Matrix:** every surface × light and dark × desktop (1280 px) and phone (390 px):
1. **Edit form** of each seeded offering (6). Price label and inputs in shot.
2. **Edit form, quantity blanked** on `PL4H` → the suffix disappears and "Price (PHP)" stands alone.
3. **Edit form, live change** on `PL1H`: type qty 4 → "per 4 hours", switch the unit to day → "per 4 days".
4. **Add Offering wizard**, priced: basics → step 2 with ₱29,999 and 4 hours → review reads "₱29,999 per 4 hours" → close and discard.
5. **Add Offering wizard**, free: blank price, 4 hours → review reads "Free (₱0)".
6. **Offering cards** on the Offerings page, with the seeded rows visible. The cards must look exactly as they did before, because they are out of scope and unchanged.

**Before and after:** the same script runs once on the untouched branch during the Stage 1 baseline (before shots, showing today's "per hour") and again after B1–B2 and I4 (after shots). The plan records the pairs that differ, and the report shows them.

**Pass criteria, all of which must hold:**
- Every label and review line matches D1 option A, exactly as in the table above.
- At 390 px the price and duration inputs share a bottom edge and no label is cut off (I4).
- Both themes are readable with no contrast loss. The suffix keeps its existing `opacity-60` muted style in both.
- No console errors during the run.
- The offering cards are unchanged before and after.
- Cleanup leaves 0 tagged rows, and Summit Athletics Club's offering count is back to its starting value (5 on 2026-11-21).

The agent reviews every screenshot itself, records the result here with the screenshot folder path, and shows the user the key before and after pairs (the 4-hour label, the review line, the 390 px row) for sign-off before S1. **"Should look right" is not a pass:** each criterion above is checked against a screenshot or an assertion.

### I3 — Confirm baselines  ✅ DONE (2026-11-21)
**Done:** the full `npx playwright test` passed **220/220** (baseline 219 + 1 new test). No `.png` changed (`git status`), so nothing was regenerated, as F3 predicted.
Run the full `npm run test:visual` after B1/B2. Per F3, expect zero screenshot diffs. If any baseline does differ, list it, look at the diff image, and regenerate only that one with `--update-snapshots -g "<name>"`. Never run a blanket `test:visual:update`.

## OPTIONAL

### O1 — "Per unit" wording in docs and comments  ✅ DONE (2026-11-21)
**Done:** `architecture/schema.md:545,587`, `architecture/portals.md:584` and `vendor/lib/types.ts:373` reworded as described below. Checked by reading the edited lines back.
*Widened 2026-11-21 by plan review:* the same "per unit" phrasing appears in two more places that a later reader would take as "per hour":
- `architecture/portals.md:584`: "price **per unit**". Change to "price **per block** (one `duration_minutes` length)".
- `vendor/lib/types.ts:373`: comment "Price is per UNIT of duration, not per booking". Change to "Price is per block of `duration_minutes`, not per hour and not per booking (a booking of N blocks pays price × N)". Comment only, same app.

`architecture/schema.md:545,587`: replace "Per unit of duration" with "Per **block** of `duration_minutes` (for example one 4-hour block), not per hour and not per booking: a booking of N blocks pays `price × N`". At `:587` say "per block" instead of "per UNIT". Docs only. It ships with the plan and needs no release step.

### O2 — Remove vendor web `pricePerUnit()`  ✅ DONE (2026-11-21, with I1)
**Done:** replaced by `pricePer`. A grep of `vendor/` code finds `pricePerUnit` only in the new helper's history comment.
`vendor/lib/duration.ts:65` has no callers (grep, 2026-11-21). I1 replaces it in place, so the dead helper that invites the bug back is gone without a separate change. If D1 changes I1's approach, this becomes a plain deletion.

### O3 — Vendor mobile's unused `pricePerUnit()`  ⏸ PARKED (2026-11-21)
`ezzy-vendor-mobile/src/lib/duration.ts:65`, no callers. **Why parked:** removing it touches a second app, which is an approval gate ("any change that touches more than one app in the same task"). It is dead code with no user-visible effect. **Moved 2026-11-21 to its own follow-up plan:** `2026-11-21-vendor-mobile-remove-price-per-unit.md`. **Unblocks when:** the user approves that plan's open decisions (D1, D2) and its execution.

---

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains — see §7. -->

- **D1 — Wording → Option A, long form "per"** (resolved 2026-11-21, user). Typing, free and invalid-quantity behaviour as stated below. Options as presented: Each example is a 4-hour offering at ₱29,999.

  | Option | Field label (live) | Review line | 1-unit | 90-min |
  |---|---|---|---|---|
  | **A. Long form, "per" (recommended)** | Price (PHP) per 4 hours | ₱29,999 per 4 hours | per hour | per 90 minutes |
  | B. Booker's short form | Price (PHP) / 4 hr | ₱29,999 / 4 hr | / hr | / 90 min |
  | C. Long form, slash | Price (PHP) / 4 hours | ₱29,999 / 4 hours | / hour | / 90 minutes |
  | D. "per booking (…)" | Price (PHP) per booking (4 hours) | ₱29,999 per booking (4 hours) | per booking (1 hour) | per booking (90 minutes) |

  **Recommendation: A.** It changes one word in the existing pattern. It matches the long-form "One booking = 4 hours" read-back directly under it (F2), and there is room for it in a form. Booker's short form (B) suits cards with little space. A vendor typing a price is better served by words. **Rejected: D**, because it misstates the charge for quantity > 1 (F1).

  **While typing** (every option): the suffix follows the quantity and unit fields live, as today. It disappears while the quantity is blank, 0 or not a whole number (`durationLabel === ""`), leaving "Price (PHP)" alone. **Free offering:** the field label is unchanged, because the vendor may still be typing a price. The review keeps "Free (₱0)" with no suffix.

- **D2 — Do O1 (`schema.md` wording) in this plan? → Yes** (resolved 2026-11-21, user). It is docs only, and it is the source the next misreading would come from.

- **D3 — Vendor mobile `pricePerUnit()` (O3) → Leave parked** (resolved 2026-11-21, user). It is a second-app gate for dead code with no user effect.

---

## Execution order

1. ✅ **Stage 1 (build + local verification), done 2026-11-21, I5 approved by the user:** first record the baseline: `tsc`, `lint`, `npm test` and `test:visual` on the untouched branch, plus the I5 *before* screenshots, so a pre-existing failure isn't blamed on this change (any failure goes in as an F# finding). Then I1 (helper + unit test), B1 and B2 (which depend on I1), I4, I2, O1, I3, and the I5 *after* run with seed and cleanup last. Stage 1 ends with the user signing off on the I5 screenshots. ⛔ **No commit (S1) and no staging deploy (S2) until I5 passes.** Fill in the Verification section below.
2. **Stage 2: staging release** (see Release).
3. **Stage 3: production release** (always last).

Stages 2 and 3 are the user's hosted steps and are short, so they can follow Stage 1 in the same session if the user wants.

---

## Release (§12)

Vendor web only. No migration, Edge Function, secret or env var, so the release is a single Vercel deploy. The DB-first ordering and the safe-pause table don't apply.

### Staging (production untouched throughout)
| # | Who | Step | Check |
|---|---|---|---|
| S1 | 👤 | ✅ 2026-11-21: vendor commit `8649de9` on `release/version-0.62.1` (not the feature branch named here), pushed, with the 0.62.1 bump as `7c97861`. Root commit `c98922f` (this plan, `schema.md`, `portals.md`, `INDEX.md`) | branch in sync with origin; only this plan's files in the commit (draft via commit-drafting) |
| S2 | 👤 | ✅ 2026-11-21: vendor 0.62.1 deployed to staging by the user | ✅ user-checked on staging |
| S3 | 👤 | ✅ 2026-11-21, user-checked and reported working. Short confirmation on staging; the full matrix ran locally in I5: Add Offering with 4 hours to the review, then discard. Open the edit form of one multi-hour offering without saving, on desktop and on a phone | ⛔ "per 4 hours" on the label and the review; inputs aligned on the phone |

⛔ **Staging fully green before anything touches production.**

### Production (last stage)
| # | Who | Step | Check |
|---|---|---|---|
| P1 | 👤 | ✅ 2026-11-21, user: production candidate is the staging deployment from S2 | same commit / version (`7c97861`, 0.62.1) |
| P2 | 👤 | ✅ 2026-11-21, user promoted that staging deployment in Vercel | — |
| P3 | ✅ 2026-11-21, user | On a vendor account the user owns: **Add Offering**, step 2, enter qty 4 + hour and a price, step to the review, then close and **discard** at the leave prompt. Nothing is saved, and no other vendor's account or data is opened | ⛔ label reads "per 4 hours"; review reads "₱… per 4 hours" | ✅ user reports checks passed |

---

## Verification

**Stage 1 results (2026-11-21):**

| Check | Baseline (untouched) | After |
|---|---|---|
| `npx tsc --noEmit` | ✅ exit 0 | ✅ exit 0 |
| `npm run lint` | ✅ 0/0 | ✅ 0/0 |
| `npm test` | ✅ 600/600 | ✅ 604/604 |
| `npx playwright test` | ✅ 219/219 | ✅ 220/220, no `.png` changed |
| grep `per ${` / `per {ofDurUnit}` in `components/offerings/` | — | ✅ none |
| grep `pricePerUnit` in vendor code | — | ✅ only the history comment in `lib/duration.ts` |
| I5 visual matrix | ✅ 52 shots, bug reproduced | ✅ 52 shots, 0 mismatches, 0 console errors, cleanup verified |

**Machine (local, Stage 1), run from `vendor/`:**
- `npx tsc --noEmit` passes.
- `npm run lint` stays **0 errors / 0 warnings**.
- `npm test` passes, including the new `lib/duration.test.ts` (I1).
- `npm run test:visual` passes in full, with zero screenshot diffs expected (F3, I3). I2's new assertions pass. Don't pipe the run through `tail`.
- grep: no `per ${` / `per {ofDurUnit}` left in `vendor/components/offerings/`, and no `pricePerUnit` left in `vendor/`.

**Visual (agent-run, local, real app with seeded data, before the commit): I5.** The edit form and the wizard for 1-hour, 4-hour, 2-day, 90-minute, 12-month and free offerings. Includes the blank-quantity and live-change states, the offering cards, light and dark themes, and 1280 px and 390 px widths, with before and after screenshots and seed cleanup verified by count. Staging S3 is a short confirmation only.

**Can't be machine-checked:** how the wording reads to a real vendor. The user covers that at the I5 sign-off and at S3.

## Docs
**Docs:** `architecture/schema.md`, `architecture/portals.md` (O1, committed `c98922f`); `vendor/AGENTS.md` test-file count 41 → 45 (stale before this plan; it now includes `lib/duration.test.ts`; only the test and baseline counts were re-counted). Checked at close on 2026-11-21, nothing to change: `architecture/conventions.md`, `architecture/booking-flow.md` (its "not per unit" at `:145` is about schedule slots, not price), and the root `AGENTS.md`. Grep for `per unit`, `pricePerUnit` and `price per hour` across `architecture/` and the vendor docs found nothing else stale
