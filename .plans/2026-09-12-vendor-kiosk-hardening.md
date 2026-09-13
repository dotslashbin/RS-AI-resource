# Vendor & kiosk hardening — free kiosk bookings, availability-first offering grid, action fixes, search label, signatures, hydration

**Date:** 2026-09-12
**App / scope:** `vendor/` only. Read-only references: `booker/` (webhook, notification builder), `backbone/` (email template, triggers).
**Status:** COMPLETE (2026-09-12) — every item ✅; live checks passed (user). Remaining related work lives in `.plans/2026-08-25-vendor-launch-followups.md` (F6, F8, F12–F16).

> Close the vendor/kiosk items left over from `.plans/2026-09-12-vendor-bookings-details-search-and-kiosk-guide.md`. The headline item makes **free (₱0) offerings bookable at the kiosk, skipping payment** — today they fail at the payment step after the customer has entered their details and signed. The rest are small correctness, accessibility and diagnostic fixes. Theme: **server truth decides the flow, and shared code stays single-sourced.**

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** H# = hardening item, D# = decision; numbers are plan-local. Items carried from `.plans/2026-08-25-vendor-launch-followups.md` keep their origin id ("launch F5").

**In scope:** **kiosk offering grid grouped by availability** (user request 2026-09-12, Stage 6), **hiding kiosk times that have already started** (found while planning it), launch **F5** (free kiosk bookings), **F7** (Approve stuck disabled), **C3** (refetch after flag), **F9** (search box label), **F11** (signature ink), **C2** (kiosk cards at phone width), **F10** (hydration error — diagnosis).
**Out of scope:** launch **F6** (document version — user: leave parked, 2026-09-12), F8 (mobile parity), F12–F14 (user decisions), L1–L3, and **the booker app's own ₱0 failure** (`booker/app/api/payment/create-session/route.ts:55-56` refuses amount ≤ 0 the same way) → recorded as new launch follow-up **F15**. No schema change, no migration, no new dependency, no `backbone/` change (D1).

---

## Investigation summary (verified against code 2026-09-12)

| Question | What the code does |
|---|---|
| Why does a ₱0 kiosk booking fail? | Nothing excludes it from the kiosk (`lib/kioskEligibility.ts:47-75`). The flow always ends at **Pay** (`KioskBooking.tsx:118-126` → `useKioskCheckout.payNow`), which creates the booking (`app/api/kiosk/booking/route.ts:143-160`, `status: "pending"`) and then calls `create-session`, which refuses `amount ≤ 0` (`app/api/kiosk/payment/create-session/route.ts:80-81`). The customer sees "The booking was created but payment could not start" (`useKioskCheckout.ts:95`), and an unpaid `pending` booking plus its acknowledgements are left behind. |
| What does "paid" drive? | `bookings.is_paid` is set **only** by the PayMongo webhook (`booker/app/api/payment/webhook/route.ts:102`). Its false → true **UPDATE** fires `create_booking_transaction()` (`20260725000002:149-151`, `after update of is_paid … when new.is_paid = true`), which writes the ledger row. In the vendor app, `!isPaid` drives the **"Not paid"** chip and the unpaid-confirmation prompt before Mark as done / Hand over (`useBookingActions.ts`, `unpaidWarning` / `needsUnpaidConfirm`). |
| Can the kiosk route set `is_paid` on insert? | Yes. It writes with the service role; no trigger reads or pins `is_paid` on INSERT (grep of every migration). **An INSERT with `is_paid = true` does not fire the ledger trigger** (UPDATE only), so a free booking produces **no ₱0 ledger row**, nothing in Transactions and nothing in Command's payout buckets. |
| Who sends the kiosk customer's confirmation email? | The webhook, on payment (`webhook/route.ts:175-240`, via `booker/lib/kioskBookingNotification.ts` `buildKioskBookingNotification`). A free booking never reaches the webhook, so **it would send nothing** unless the kiosk route writes the notification itself. The email template (`backbone/…/templates/kioskBookingConfirmed.ts:107-128`) always renders a **Paid** row from `data.price_paid`. |
| How does the confirmation screen get its data? | Only through the payment return URL `/kiosk?payment=success&booking_id=…` (`KioskBooking.tsx:44-50`, `useKioskShell.ts` lazy `view` initialiser). The receipt re-reads the booking (`services/kiosk.service.ts:220-235`), and `StepConfirmation.tsx:63-65` renders **"Paid ₱{pricePaid}"**. |
| F7 — why does Approve stay grey? | `approve` sets `approving = true` and nothing resets it (`useBookingActions.ts`). On failure `approveB` rolls the status back to `pending` and toasts (`useAppShell.ts:660-667`), so the button reappears still disabled. |
| C3 — refetch after a flag | `BookingRow` / `useBookingActions` accept `onFlagged`, but `BookingsPage` never passes one and the details modal doesn't either. Status currently arrives only via the Realtime UPDATE. `getBooking(vendorId, id)` already exists for single-row refreshes (`bookings.service.ts`, used by realtime). |
| F9 — search label | `components/ui/SearchInput/SearchInput.tsx:10-21` has no `aria-label`; callers are `BookingsPage.tsx:51` and `TransactionsPage.tsx:137` only. |
| F11 — signature ink | `useKioskSignaturePad.ts:54-55` strokes in the canvas's computed theme colour on a transparent canvas and exports that PNG as-is (`toDataURL` on pointer-up). On a dark kiosk the stored signature is near-white ink. |
| C2 — narrow cards | `KioskBooking.module.css` `.docHead` does not wrap, so a long title slides under `.sigTag` below ~450px; `.agree` has no `text-align`, so the button's default centring wraps the label oddly. |
| F10 — hydration | `pilot.spec.ts:69-73` freezes the **browser** clock (`FIXED_NOW` = 2026-08-08) but the gallery is **server-rendered with the real date**. `autoAckDaysLeft` (`useBookingActions.ts`, `Date.now()` in render) differs between server and client for fixtures with `statusChangedAt`, a likely mismatch. Same class of bug the calendar had on 2026-08-16 (`pilot.spec.ts:55-66`). **Unconfirmed.** |

---

## STAGE 1 — Free kiosk bookings (launch F5)

H1a–H1d are **one coupled batch**: the route's response shape and the client flow change together, and a free booking without H1b would send no email.

### H1a — The kiosk booking route settles a ₱0 booking at creation  ✅ DONE (2026-09-12)
**File:** `vendor/app/api/kiosk/booking/route.ts:96-160` (schedule read, insert), `:225-230` (response)
**Approach (D2):**
- Read the offering's `price` server-side alongside the schedule (never from the request). Insert with `is_paid: price === 0`.
- **The database stays the authority on the amount:** change the insert's `.select("id")` to `.select("id, price_paid, is_paid")`. `price_paid` is trigger-derived (`price × quantity`, `20260803000004`), so it — not the earlier read — decides whether the booking is free.
- **Race guard (vendor edits the price between the read and the insert):**
  - inserted `is_paid = true` but `price_paid > 0` → immediately `update({ is_paid: false })`. true → false never fires the ledger trigger. Treat it as a paid booking.
  - inserted `is_paid = false` but `price_paid = 0` → leave it unpaid and return `free: false`. The payment step then fails with the existing "please see staff" message, which is no worse than today. Do **not** flip it to true, because that UPDATE would write a ₱0 ledger row.
  - Both are a same-second price edit; log them with `console.error` and a stable tag so they can be found.
- Response gains `free: boolean` (`true` only when the stored row has `price_paid = 0` and `is_paid = true`).
- The pure decision goes in a small unit-tested module, `vendor/lib/kioskFreeBooking.ts`: `settleOnInsert(price)` → boolean, and `resolveInserted({ is_paid, price_paid })` → `{ free, correctToUnpaid }`. It has no imports beyond types (`node --test` constraint).
**Why not a DB rule:** D2. **Why no ledger row:** a ₱0 row would add noise to Transactions and to Command's "Ready to pay" with nothing to pay.
**Verify:** `lib/kioskFreeBooking.test.ts` covers free, paid, and both race branches (machine). Live: a free kiosk booking has `is_paid = true`, `price_paid = 0`, and **no** `booking_transactions` row (psql read, needs Docker up).

### H1b — The route sends the kiosk confirmation for a free booking  ✅ DONE (2026-09-12)
**Files:** new `vendor/lib/kioskBookingNotification.ts` + `.test.ts`; `app/api/kiosk/booking/route.ts` (after acknowledgements succeed)
- The webhook never runs for a free booking, so the route writes the `kiosk_booking_confirmed` notification itself, gated on `notification_type_settings.is_enabled` exactly as the webhook is (`webhook/route.ts:175-178`, `maybeSingle` so a missing type reads as off).
- **The builder is a copy of `booker/lib/kioskBookingNotification.ts`** (apps share no code — AGENTS.md). Copy it verbatim, add a header naming the original, and keep the same `data` keys the template reads (`booking_id`, `offering_name`, `booked_date`, `start_time`, `price_paid`). The **only** difference: when `pricePaid` is 0 the body says **"No payment needed."** instead of "Paid ₱0.00." Port booker's tests and add the free case.
- **Email wording accepted as is (D1):** the template's table row will read **"Paid ₱0.00"**; the body sentence carries "No payment needed." No `backbone/` change.
- A failed notification insert must not fail the booking (same guarantee as the webhook): wrap it and log.
- Only free bookings are notified here. Paid bookings keep the webhook path, or a paid customer would get two emails.
**Verify:** unit tests for the builder: the free body, the paid body unchanged from booker's, and the `data` keys (machine). Live: a free kiosk booking produces one `notifications` row of type `kiosk_booking_confirmed` and the email arrives (live, local Resend setup per `architecture/email-local-run-quickstart.md`).

### H1c — Kiosk flow: "Confirm booking" instead of "Pay", and a free receipt  ✅ DONE (2026-09-12)
**Files:** `components/kiosk/KioskBooking/useKioskCheckout.ts:32-110`, `KioskBooking.tsx:110-134`, `StepPayment.tsx`, `StepOffering.tsx:54`, `StepConfirmation.tsx:59-65`, `KioskBooking.module.css` (only if a style is needed)
- **Free is decided from `k.total === 0` for display only**, never for the write: the server's `free` flag (H1a) decides where the flow goes.
- `useKioskCheckout`: rename `payNow` → `submit` (it no longer always pays). After a successful booking:
  - `free: true` → `router.replace("/kiosk?payment=success&booking_id=<id>")`. **This reuses the existing return contract (D3)**, so the receipt re-read, the idle suspension and `clearPaymentReturn()` all work unchanged. A comment records that `payment=success` also means "confirmed, nothing to pay".
  - `free: false` → current `create-session` path, unchanged.
- **Review step when free** (`StepPayment`): no payment methods and no PayMongo sentence. The total row reads **Free**. The footer (`KioskBooking.tsx`) shows **"Total: Free"** and a CTA **"Confirm booking"** ("Confirming…" while submitting). Paid offerings are unchanged.
- **Offering tile**: `₱0` → **Free** (`StepOffering.tsx:54`).
- **Receipt**: `StepConfirmation` shows **"Total: Free"** when the re-read `pricePaid === 0`. It reads the database value, never `k.total` — this screen was already bitten by "Paid ₱0" (B40). Unknown still renders the em dash.
- Step id stays `payment` (`lib/kioskSteps.ts`), so no step logic or position counts change.
- **Component separation:** `StepPayment`, `StepOffering`, `StepConfirmation` stay pure display (the free branch is a conditional render on props). Any inline `style={{}}` touched in `StepPayment`/`KioskBooking` moves to `KioskBooking.module.css` as part of the edit.
**Verify:** kiosk visual subset (`-g kiosk`). **`kioskoffering` and `kioskconfirmation` baselines must be unchanged** because their fixtures are priced; if they move, stop and explain. Throwaway browser check on a TEMP gallery mode: a free offering shows Free on the tile, the review step and the receipt, the CTA reads Confirm booking, and a paid offering is unchanged. Live: book a free offering end to end → confirmation screen with the reference, no PayMongo redirect.

### H1d — Vendor surfaces: a free booking reads as free, not paid  ✅ DONE (2026-09-12)
**Files:** `components/bookings/BookingDetailsModal/BookingDetailsModal.tsx` (payment section), `components/bookings/BookingDetails/useBookingDetails.ts` (only if a derived flag is cleaner there)
- `is_paid = true` already removes the "Not paid" chip and the unpaid confirmation (no change in `useBookingActions`).
- Modal payment section when `pricePaid === 0`: Amount **Free**, Status **No payment needed**; the ledger lookup returns none, which reads **"Free booking — nothing to pay"** instead of "No payment recorded".
- `bookingdetails` fixture is priced (₱1,700), so its baseline must stay unchanged.
**Verify:** `bookingdetails-light/-dark` unchanged (machine); throwaway check with a ₱0 fixture (browser).

### H1e — Guide, docs and parity notes  ✅ DONE (2026-09-12)
**Files:** `components/dashboard/GuideModal/guideItems.ts` (Kiosk item, "Before you start" and "What customers see"), `visual-tests/pilot.spec.ts` (the `"above ₱0"` assertion), `architecture/portals.md` (Kiosk section — the ₱0 bullet), `architecture/booking-flow.md` (Kiosk Mode — the "What is the same" payment row), `.plans/2026-09-03-vendor-mobile-kiosk-mode.md` (parity note), `.plans/2026-08-25-vendor-launch-followups.md` (F5 → here; new F15 booker ₱0)
- The guide replaces "give kiosk offerings a price above ₱0" with "free offerings skip payment — the customer confirms and gets the same reference and email". The spec asserts the new sentence.
- `booking-flow.md` states the rule plainly: **a free kiosk booking is created settled (`is_paid = true`), never touches PayMongo, writes no ledger row, and is confirmed by the kiosk route rather than the webhook.**
**Verify:** guide behaviour test passes; `guide-*` screenshots unchanged (default tab is Dashboard) (machine).
<!-- ✅ 2026-09-12 — LIVE CHECKS PASSED, reported by the user ("live checks all passed"): a free kiosk booking on a real database (stored settled at ₱0, no ledger row, confirmation email received) and a paid kiosk booking still going through PayMongo on staging. The agent did not observe these runs; the machine and browser evidence below is the agent's own. -->
<!-- 🔄 2026-09-12 — Stage 1 code complete; LIVE checks outstanding (see below). Files: new `lib/kioskFreeBooking.ts` (+ test, 7 cases) and `lib/kioskBookingNotification.ts` (vendor copy of booker's builder + ported test with the free-price change and 3 new cases); `app/api/kiosk/booking/route.ts` (reads offering price+name server-side, INSERT `is_paid: settleOnInsert(price)`, selects `price_paid, is_paid`, race correction/deletion + tagged logs, free-booking `kiosk_booking_confirmed` notification gated like the webhook, response `free`); `useKioskCheckout.ts` (`payNow` → `submit`; `free: true` → `router.replace('/kiosk?payment=success&booking_id=…')`); `useKioskBooking.ts` (`isFree`, display only); `KioskBooking.tsx` (free heading "Review and confirm", footer "Total · Free", CTA "Confirm booking"; inline footer size → `.totalValBar`); `StepPayment.tsx` (free: no methods/PayMongo copy; inline styles → `.totalKey/.methodsHead/.methodsTitle/.payHint`); `StepOffering.tsx` (tile "Free"); `StepConfirmation.tsx` ("Total · Free" from the re-read price only); `BookingDetailsModal.tsx` (Free / No payment needed / "Free booking — nothing to pay."); `guideItems.ts` + `pilot.spec.ts` ("skips payment", asserts "above ₱0" gone); docs `architecture/portals.md`, `architecture/booking-flow.md` (new "Free kiosk bookings" section); `.plans/2026-09-03-vendor-mobile-kiosk-mode.md` parity bullet; gallery `kioskState` gains `isFree: false`.
Verified (machine): tsc 0; `npm test` 431/431 (was 404); lint 35, same files; Playwright `-g "kiosk|bookingdetails|getting started guide modal|ui-gallery guide-"` 19/19 with NO baseline changes. Browser (TEMP gallery modes + Playwright interception of Supabase REST and the two kiosk API routes; removed at the end of the run), 21/21: free tile "Free"; free review "Review and confirm", no payment methods/PayMongo, footer "Total · Free", CTA "Confirm booking"; free submit navigates to `/kiosk?payment=success&booking_id=…` with **0** create-session calls; paid path unchanged ("Pay ₱850", methods, create-session called once, redirect to checkout_url); **route `free:false` on a ₱0 offering still takes the payment path** (server truth); receipt "Total · Free", never "Paid ₱0"; vendor modal Free / No payment needed, no "Not paid".
NOT verified — needs a live stack (local Supabase was unreachable; Docker down): the route against a real DB (a free booking stored `is_paid = true`, `price_paid = 0`, NO `booking_transactions` row; the notification row + email), the race branches against real triggers, and the paid kiosk path through PayMongo on staging. -->

---

## STAGE 2 — Shared booking actions (launch F7, C3)

### H2 — A failed Approve re-enables the button  ✅ DONE (2026-09-12)
**File:** `components/bookings/BookingActions/useBookingActions.ts` (`approving` state, `approve`)
**Approach:** reset `approving` whenever the booking's status changes, using React's "adjust state when a prop changes" pattern: keep `prevStatus` in state and compare **during render**. Success moves status away from `pending`, so the button leaves. Failure moves it `pending → confirmed → pending`; each change resets the flag, so Approve comes back enabled. No effect (the `set-state-in-effect` lint rule), and no change to `approveB`'s signature (the dashboard's `PendingApprovalsCard` also uses it).
**Verify:** the Stage 3 (previous plan) parity script still records identical states except that, after a forced failure, Approve is **enabled** (browser, TEMP harness whose `approveB` flips to confirmed and back). `bookings-*` baselines unchanged (machine).

### H3 — Refetch the booking after "Something's wrong"  ✅ DONE (2026-09-12)
**Files:** `components/layout/AppShell/useAppShell.ts` (new `refreshBooking(id)` using the existing `getBooking` + `setBookings` patch, as the realtime handler already does), `AppShell.tsx:181`, `BookingsPage.tsx` (prop → `BookingRow onFlagged`, → `BookingDetails`), `BookingRow.tsx` / `useBookingRow.ts` (`onFlagged` receives the id), `BookingDetails/useBookingDetails.ts` (passes `onFlagged` to `useBookingActions`)
**Approach:** `onFlagged` becomes `(id: string) => void`, matching `onOpen`. Realtime remains the primary path; this makes the status correct even if the Realtime event is missed.
**Component separation:** no render-layer logic added; the handler is wired from the hooks.
**Verify:** tsc; TEMP harness where `flagBooking` is stubbed and `refreshBooking` flips status to `disputed`: row and modal both show **On hold** (browser). `bookings-*` unchanged (machine).
<!-- ✅ DONE (2026-09-12, H2 + H3) — `useBookingActions.ts`: `statusSeen` state compared during render resets `approving` on any status change; `onFlagged(id)`. `useBookingRow.ts` / `BookingRow.tsx` / `BookingDetails.tsx` / `useBookingDetails.ts`: `onFlagged` typed `(id: string) => void` and threaded to the shared hook. `BookingsPage.tsx`: new `onBookingFlagged` prop to rows and the modal. `useAppShell.ts`: `refreshBooking(id)` (existing `getBooking` + patch), exported on `AppShellState`; `AppShell.tsx:181` passes it. Verified (machine): tsc 0; lint 35, same files (the new render-time state adjustment raised no rule); `bookings-*` and `bookingdetails-*` 4/4 unchanged. Browser (TEMP harness: `approveB` confirms then rolls back after 300ms like a failed write; `onBookingFlagged` sets `disputed`; the dispute RPC intercepted), 7/7: after a failed approve the button is back AND enabled in the row and in the modal; "Something's wrong" calls the RPC once per flag and the status becomes On hold in the row and in place inside the modal. Not exercised: `refreshBooking` against a real database (it reuses `getBooking`, already used by the Realtime handlers). Deviation: the previous plan's parity script could not be re-run (its scratchpad was cleared); the screenshot gate and the targeted harness cover the changed behaviour instead. -->

---

## STAGE 3 — Search label (launch F9)

### H4 — `SearchInput` gets an accessible name  ✅ DONE (2026-09-12)
**Files:** `components/ui/SearchInput/SearchInput.tsx` (optional `ariaLabel`, defaulting to the placeholder text so no caller silently loses a name), `BookingsPage.tsx` (`"Search bookings"`), `TransactionsPage.tsx` (`"Search transactions"`)
**Verify:** tsc; throwaway DOM check that `getByRole("textbox", { name: "Search bookings" })` resolves (browser); no screenshot changes, since an attribute is not a pixel (machine: full suite).
<!-- ✅ DONE (2026-09-12) — `SearchInput.tsx`: optional `ariaLabel`, rendered as `aria-label={ariaLabel ?? placeholder}`; `BookingsPage.tsx` passes "Search bookings", `TransactionsPage.tsx` "Search transactions". Verified: tsc 0 (machine); browser DOM check on the TEMP bookings harness — `getByRole("textbox", { name: "Search bookings" })` resolves, and still resolves after typing, when the placeholder is gone (2/2). Transactions is not in the gallery: its label is confirmed by type-check and code only. Pixel-neutrality confirmed by the full suite at the end of this run. -->

---

## STAGE 4 — Kiosk signature and narrow cards (launch F11, C2)

### H5 — Store every signature as dark ink on white  ✅ DONE (2026-09-12)
**File:** `components/kiosk/KioskSignaturePad/useKioskSignaturePad.ts` (`onPointerUp` export), new pure helper if the pixel logic warrants it
**Approach (D4 — normalise on export):** the customer-facing pad is unchanged; it still strokes in the theme colour. At export, draw onto an offscreen canvas the size of the backing store:
1. copy the strokes;
2. recolour them to `#0f172a` with `globalCompositeOperation = "source-in"`;
3. paint white underneath with `destination-over`.

Export that as the PNG. Opaque, dark-on-white, independent of kiosk theme. The server route and bucket are unchanged (PNG, well under 1 MB).
- Existing stored signatures stay transparent. The booking details modal keeps its mid-slate ground, which works for old and new alike.
**Verify:** `kiosksignature-*` baselines unchanged (the pad itself is untouched) (machine). Throwaway browser check in the **dark** theme: draw on the pad, then decode the exported data URL and assert the background pixels are white and the stroke pixels are dark (browser, machine-readable pixels). Live: sign on a dark-themed kiosk, then open the booking in the vendor modal and see dark ink on white.

### H6 — Kiosk document cards at phone width  ✅ DONE (2026-09-12)
**File:** `components/kiosk/KioskBooking/KioskBooking.module.css` (`.docHead`, `.docTitle`, `.sigTag`, `.agree`)
**Approach:** let `.docHead` wrap with the tag moving under the title at narrow widths (`flex-wrap: wrap`, tag `margin-left: 34px` to align with the text); `.docTitle` `overflow-wrap: anywhere`; `.agree` `text-align: left`. Tablet layout must look identical.
**Verify:** kiosk visual subset unchanged (no agreements baseline exists; the other kiosk modes must not move) (machine). Throwaway screenshots at 400 / 768 / 1000px: no overlap at 400, identical to today at 768+ (browser).
<!-- ✅ DONE (2026-09-12, H5 + H6) — `useKioskSignaturePad.ts`: new `exportDarkOnWhite()` (offscreen canvas, `source-in` recolour to #0f172a, `destination-over` white), used by `onPointerUp`; the visible pad is untouched. `KioskBooking.module.css`: `.docTitle` `overflow-wrap: anywhere`; `.agree` `text-align: left`; `@media (max-width: 520px)` wraps `.docHead`, `.docMain` basis `calc(100% - 34px)`, `.sigTag` `margin-left: 34px`. Verified (machine): tsc 0; lint 35; kiosk Playwright subset 14/14 unchanged (incl. `kiosksignature-*`). Browser (TEMP modes capturing the exported data URL and a narrow agreements fixture), 15/15: in BOTH kiosk themes the stored PNG has 0 transparent pixels, 99.6% white background and dark ink; in the dark theme the live pad still strokes #f1f5f9 (what the customer sees is unchanged); at 400px the title and tag don't overlap, the tag wraps below and there's no overflow; at 768px the tag stays beside the title (tablet unchanged); the agree button is left-aligned. Not verified: a signature from a real dark-themed tablet viewed in the vendor modal (live). Existing transparent signatures still show on the modal's mid-slate ground. -->

---

## STAGE 5 — Hydration error diagnosis (launch F10)

### H7 — Confirm the cause before fixing anything  ✅ DONE (diagnosis, 2026-09-12)
**Scope: diagnosis only.** A fix is chosen **after** the cause is known and brought back to the user.
**Hypothesis:** the gallery server renders `autoAckDaysLeft` with the real date while `page.clock` gives the browser `FIXED_NOW`, so rows with `statusChangedAt` render different day counts ("auto-confirms in Nd").
**Steps:**
1. Reproduce: run `-g "ui-gallery bookings-"` and capture React's hydration diff text from the browser console (the full message names the differing text).
2. Control: run the same page **without** `page.clock` (throwaway script). The mismatch should disappear if the hypothesis holds.
3. Rule out production: vendor pages render behind a client-side auth gate (`AppShell` returns null until auth resolves), so rows are not server-rendered in the real app. Confirm by reading `AppShell.tsx`, and record whether any real page can hit it.
**Likely fix options to bring back (not decided):** (a) the fixture pins time the way the calendar does (an optional `now` injected into the row/actions); (b) compute the countdown only after mount; (c) accept it as a test-only artefact and silence nothing, just document. Option (a) or (b) would also clear the pre-existing `Cannot call impure function during render` lint error on the same line.
**Verify:** a written diagnosis with the console evidence, added to this plan as an execution note (machine/browser).
<!-- ✅ DONE (2026-09-12) — DIAGNOSIS CONFIRMED, test-only. Throwaway Playwright run against `ui-gallery?mode=bookings`, twice:
  • WITH `page.clock.setFixedTime(2026-08-08T04:00Z)` (exactly as pilot.spec): 1 hydration error; React's diff sits under `<BookingRow booking={{id:"b5", …}}>` and reads `+ auto-confirms in 3071d` (client, frozen clock) / `- auto-confirms in 3035d` (server, real clock).
  • WITHOUT the clock freeze (control): 0 hydration errors, both renders "3035d".
Cause: `autoAckDaysLeft` (`useBookingActions.ts`, `Date.now()` during render) for fixtures with `statusChangedAt`, evaluated on the server with the real date and in the browser with `FIXED_NOW`. Same class as the calendar's 2026-08-16 fix.
Production exposure: none found. `app/page.tsx` renders `AppShell`, which returns `null` while `isCheckingAuth` (initial `true`) is set (`AppShell.tsx:134`), so booking rows are never server-rendered in the real app; the modal is client-only too. Pixel impact: none — the baseline captures the regenerated client render, and with both `FIXED_NOW` and the fixture's `statusChangedAt` fixed, that text is constant.
**Fix options brought to the user (not decided):** (a) accept and document — no code change; (b) inject time: `useBookingActions` takes an optional `now` (as `CalendarPage` takes `today`), the gallery fixture passes one consistent with `FIXED_NOW`, and the default becomes a lazy `useState(() => Date.now())` — removes the console noise and likely the pre-existing `Cannot call impure function during render` lint error, at the cost of touching the shared hook; (c) drop `statusChangedAt` from the fixture rows — removes the noise but also removes countdown coverage from the baseline. -->

---

## STAGE 6 — Kiosk "Choose what to book": grouped by when it's free (user request, 2026-09-12)

**Preview for approval (D7):** https://claude.ai/code/artifact/76523f48-5426-4f45-9133-55cb2788d519. It is a static mockup in the kiosk's own tokens, light and dark, with example data for Saturday 12 Sep 2026.

**What exists today (verified):** `StepOffering.tsx:12-24` renders seven **date chips** (`DAYS_AHEAD = 7`, `useKioskBooking.ts:191-205`) above **one flat grid** of every eligible offering (`:30-58`). The grid says nothing about availability. The chosen date carries into the time step, and only there does the customer learn a date has no times (`StepSlot.tsx:16`, "No times left on this day. Try another date."). Availability is computed **only for the selected offering and date** (`useKioskBooking.ts:122-170`: `isOccurrence` → `getSlotBookings(scheduleIds, date)` → `availabilityForDay`).

### H8 — Group the offering grid by next available day  ✅ DONE (2026-09-12)
**Behaviour (as previewed):**
- **Available today** (first, highlighted): offerings with at least one free place today at a time that has **not started yet**. Emerald availability chip "Today · next 15:00" and "N times left today". Emerald is a status colour, kept apart from the kiosk blue that already means *selected*.
- **Later this week**: the next day with a free place within the 7-day window. The label is **"Available tomorrow"** for the next day, and **"Available on Wednesday"** (full weekday) for days 2–6. Detail line: the date ("Wednesday 16 Sep"), or **"Fully booked today"** when today had sessions but no free places.
- **Not available this week**: offerings with no free place in the window, shown as muted text rows, **not tappable**.
- Order: today by earliest next start; later by earliest day then earliest start; ties keep the current order (`getKioskOfferings` returns creation order).
- Tapping a card sets the flow's date to that offering's **first available day**.
- **"Available" = bookable**, i.e. `remaining > 0` on a slot whose start instant is after now. A scheduled session alone does not count.

**Files and approach:**
- **New pure `vendor/lib/kioskAvailability.ts` + `.test.ts`:** `offeringAvailability({ schedules, bookings, dates, now })` → per offering `{ firstDate, nextStart, remainingToday, bookedOutToday }`, and `availabilityLabel(firstDate, today)` → `"today" | "tomorrow" | weekday | null`.
  - Built **only** from the existing tested primitives (`isOccurrence`, `availabilityForDay`, `slotDate`, `slotInstant`), so the grid and the time step cannot disagree (the kiosk's "no second opinion" rule, `useKioskBooking.ts:14-21`). Relative imports with `.ts` extensions (`node --test`).
  - Tests: overnight window (00:00 slot stored under the next date), past slots excluded today, full today → next day, nothing in window → null, date-granular schedules ignored (the kiosk sells time-based offerings only), weekday labels and the tomorrow boundary.
- **`vendor/services/kiosk.service.ts` `getSlotBookings`:** accept an inclusive date range, `(scheduleIds, fromDate, toDate)`. Today's single-date callers pass `from = to`, so existing behaviour holds: it still queries through `to + 1` for post-midnight slots and still pages. One query covers all eligible schedules over the 7-day window instead of one per offering per day. Incompleteness stays surfaced, never read as "free" (`kiosk.service.ts` `complete`).
- **`useKioskBooking.ts`:** load window bookings once alongside offerings, compute availability per offering, and expose `offeringGroups` (`today` / `later` / `none`). `chooseOffering` also sets `date` to the offering's first available day. The per-selected-date fetch for the time step stays, and so do slot rules. The component already remounts on every reset (`KioskShell.tsx` `key={k.resetKey}`), so availability is re-counted for each customer.
- **`StepOffering.tsx`:** render the three groups (pure display); **the date chips move out**.
- **`StepSlot.tsx`:** gains the day chips, with days that have no free time for **this** offering shown dimmed ("No times"), opening on the first available day. Pure display.
- **`KioskBooking.module.css`:** group headings, `.tileToday`, availability chips, muted rows. Tokens only, light and dark, 44px targets. Existing inline `style={{…}}` in `StepOffering` (`:48-52`) moves into the module as part of the edit.
- **Coupling with H1c (Stage 1):** same `StepOffering` tile. The **Free** price label lands first; Stage 6 builds on it.
- **Component separation:** `StepOffering` / `StepSlot` stay pure display fed by `KioskBookingState`; all state and derivation live in `useKioskBooking` and `lib/kioskAvailability.ts`; styles in the module.
**Verify:**
- `kioskAvailability.test.ts` (machine).
- **`kioskoffering` and `kioskslot` baselines WILL change.** Update the gallery fixture (`app/ui-gallery/page.tsx` `kioskState`) with availability data mirroring the preview, show the user the real screenshots, and re-record **only those two modes** with `--grep` after approval (registering = accepting). Re-run twice to prove stability.
- Throwaway browser check: tapping a "Later" card opens the time step on its day; "Not available" rows are inert.
- Live: a tablet at a real venue, where an offering fully booked today shows under Later with "Fully booked today".

### H9 — Never offer, or accept, a time that has already started  ✅ DONE (2026-09-12)
**Found 2026-09-12 while investigating H8:** `availabilityForDay` (`lib/slotAvailability.ts:113-172`) returns every slot of the day regardless of the clock, `StepSlot` shows them all, and neither the kiosk route nor `check_booking_placement()` (`20260828000001`) refuses a start in the past. At 15:00 a walk-in can book 09:00 today.
**Approach:**
- **Kiosk client:** the time step omits slots whose start instant (`slotInstant(date, windowStart, start)`) is at or before `now`. `now` lives in `useKioskBooking` and is refreshed every 60s by an interval (state set in the timer callback, not synchronously in an effect), so a slot passing while the customer is looking disappears.
- **Kiosk route (server truth):** `app/api/kiosk/booking/route.ts` refuses a slot whose start is not in the future: "That time has already started. Please pick another." (409). Compare real instants with the slot's date and the Asia/Manila offset, never the server's local clock. The pure comparison goes in `lib/kioskAvailability.ts` so it is tested with H8.
- **Not done here:** a database-level refusal for **all** apps, and whether the booker app filters past slots, are a schema change and a cross-app question → launch follow-up **F16** (recorded 2026-09-12).
**Verify:** unit tests for past-slot filtering and the server comparison around midnight and the PH offset (machine). Throwaway check: a fixture at 15:00 hides morning slots (browser). The route refuses a past start (machine, via a request against the dev server with a TEMP harness, or live).
**Independent of D7:** H9 is a correctness fix and can ship before Stage 6's design is approved.
<!-- 🔄 2026-09-12 — Stage 6 (H8 + H9) built.
Files: new `lib/kioskAvailability.ts` + `.test.ts` (21 tests: `hasStarted` with a fixed +08:00 anchor incl. a UTC-midnight case, `freeSlotsOn` incl. overnight window and date-based schedules, `offeringAvailability` today / started-today → tomorrow / full-today → `bookedOutToday` / none / weekday, labels, grouping order and stable ties); `services/kiosk.service.ts` `getSlotBookings(ids, from, to = from)`; `useKioskBooking.ts` (7-day `windowBookings` read in parallel with attachments, null on error/incomplete → plain grid; `now` state advanced every 60s; started slots filtered; `availability` / `offeringGroups` / `dateChoices.hasTimes`; `chooseOffering` opens on the first free day; new types `KioskOfferingCard`, `KioskOfferingGroups`, `KioskDateChoice`); `StepOffering.tsx` (three groups + `Tile`; date chips removed; plain-list fallback); `StepSlot.tsx` (day chips with dimmed "No times"); `KioskBooking.tsx` headings; `KioskBooking.module.css` (group/tile/availability/none/chip-empty classes; the tile's inline `display:block` moved to `.tileName/.tileMeta`); `app/api/kiosk/booking/route.ts` refuses a started time (409); gallery `KIOSK_DATE_CHOICES.hasTimes`, `KIOSK_GRID_EXTRA`, `KIOSK_OFFERING_GROUPS`, `kioskState.offeringGroups`; guide "What customers see"; docs `architecture/portals.md`, `architecture/booking-flow.md`; mobile kiosk plan parity bullet.
Verified (machine): tsc 0; `npm test` 452/452; lint 35, same files; kiosk Playwright subset: 10 unchanged, **exactly the 4 expected changed** (`kioskoffering-light/-dark`, `kioskslot-light/-dark`) — NOT re-recorded (awaiting user review; actual images saved for review).
Browser (TEMP flow harness with intercepted Supabase reads; browser clock frozen at Sat 12 Sep 2026 15:30 Asia/Manila), 17/17: today group holds only the offering with a future free slot ("Today · next 16:00", "8 times left today" — nothing at or before 15:00); later order Open Play → Ball Machine → Coaching; an offering whose times all passed today reads "Available tomorrow" + date, NOT "Fully booked"; a full-today offering reads "Available tomorrow" + "Fully booked today"; a Wednesday-only offering reads "Available on Wednesday"; the out-of-window offering sits in "Not available this week" with no button; no day chips on the offering step; Coaching opens the time step on Wed 16 with Today dimmed "No times"; Court Rental's first offered slot today is 16:00; a failed availability read shows the plain grid with no availability claims; no page errors. Light/dark screenshots reviewed.
Full suite after all six stages (unpiped, `node_modules/.cache/hardening/full2.log`): **EXIT=1 — 173 passed, 4 failed**, the 4 being exactly `kioskoffering-light/-dark` and `kioskslot-light/-dark` (expected design change, baselines untouched, sent to the user for review). A first full run was killed by the OS for low memory before any test ran; the retry is the result above. TEMP gallery modes removed; `git diff` of `app/ui-gallery/page.tsx` shows only the committed fixture changes.
<!-- ✅ H9 DONE (2026-09-12) — LIVE CHECK PASSED, reported by the user: the kiosk refused a time that had already started. Together with the unit tests and the 17/17 browser run this closes H9. Also reported passed: a dark-themed tablet signature viewed in the vendor modal (H5 live check). -->
<!-- ✅ H8 DONE (2026-09-12) — the user approved the four new screenshots; re-recorded ONLY `kioskoffering-light/-dark` and `kioskslot-light/-dark` with `--grep "ui-gallery (kioskoffering|kioskslot)-" --update-snapshots` (4/4); then 4/4 passed on each of two further runs without update (stable); each new baseline PNG is byte-identical (md5) to the image the user approved; `git status` shows only those four snapshot files changed. -->
NOT verified: the route's 409 for a started time over HTTP (the route authenticates a vendor-admin before reaching it; covered by `hasStarted` unit tests and code review only) — live check; real tablets with real bookings. -->

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. -->
- **D1 — Free booking email wording** → **accept the template's "Paid ₱0.00" row**; the notification body says "No payment needed." (user, 2026-09-12). Keeps this plan vendor-only; no `backbone/` redeploy.
- **D2 — How a free booking counts as settled** → **settled at creation by the kiosk route** (`is_paid = true` on insert, no ledger row, no DB rule) (user, 2026-09-12). A database-wide rule was declined for now; the booker app's ₱0 path stays separate (launch F15).
- **D3 — Confirmation routing for free bookings** → reuse the existing `?payment=success&booking_id=` return contract (resolved in planning, 2026-09-12). Engineering choice with no user-visible difference: one contract already handles receipt re-read, idle suspension and URL clearing. A second param would duplicate all three.
- **D4 — Signature fix** → **normalise when saving**; the pad looks the same to customers (user, 2026-09-12).
- **D5 — Scope** → F5, F7, C3, F9, F11, C2, F10; **F6 stays parked** (user, 2026-09-12).
- **D6 — F5 behaviour** → **free offerings stay bookable and skip the payment step** (user, 2026-09-12). This supersedes launch F5's "exclude from the kiosk" option (a).
- **H7 fix** — deliberately **not** decided here. It is chosen after diagnosis and asked then. H7 is diagnosis-only, so nothing executes against an open decision.

- **D7 — Approve the kiosk availability design** → **approved as previewed, (a)–(f) unchanged** (user, 2026-09-12: "Approved!"). (preview linked in Stage 6). Approving it accepts:
  (a) three groups — Available today / Later this week / Not available this week;
  (b) emerald for "today", distinct from the selection blue;
  (c) labels "Available tomorrow" / "Available on <weekday>" / "Fully booked today";
  (d) not-available offerings as muted, non-tappable rows;
  (e) date chips move from the offering step to the time step, opening on the offering's first free day, with empty days dimmed;
  (f) "available" means a free place at a time that hasn't started.

  Any change to (a)–(f) goes back into the preview before H8 executes. *(Before approval, this blocked the whole plan per the plan rule.)*

- **D8 — H7 hydration error fix** → **(a) accept and document** (user, 2026-09-12). The error is test-only (frozen browser clock vs real server clock) and production cannot hit it; documented beside `FIXED_NOW` in `vendor/visual-tests/pilot.spec.ts`. Options (b) inject time and (c) drop the fixture's `statusChangedAt` were declined.

_No OPEN decisions remain._

## Risks and couplings
- **H1a ↔ H1c ↔ H1b ship together.** Route-only: a free booking would still go to the payment call and fail. Client-only: it would misread the response. Without the notification: no email.
- **Paid path regression is the main risk** in Stage 1. The paid branch of `submit` must stay byte-for-byte the old `payNow` path; verify a paid kiosk booking still reaches PayMongo (live, staging test card per `booking-flow.md`).
- **H2/H3 touch shared booking actions**: re-run the previous plan's parity recording, and `bookings-*` / `bookingdetails-*` baselines must stay unchanged.
- **Mobile kiosk parity:** `.plans/2026-09-03-vendor-mobile-kiosk-mode.md` gets a note (H1e) that free offerings skip payment and are settled at creation by the server route, so the mobile flow must branch on the route's `free` flag too.

## Execution order
One stage at a time by default.

| Stage | Items | Depends on | Gate to mark ✅ |
|---|---|---|---|
| 1 | H1a → H1b → H1c → H1d → H1e (**coupled**) | — | unit tests (free decision, notification builder); tsc/lint no new problems; kiosk + bookingdetails baselines unchanged; guide test; **live**: a free booking end to end (settled, no ledger row, email) **and** a paid booking still reaches PayMongo |
| 2 | H2, H3 | — | parity recording; bookings baselines unchanged; harness checks for failed approve and flag refresh |
| 3 | H4 | — | tsc; DOM name check; full suite unchanged |
| 4 | H5, H6 | — | kiosk baselines unchanged; exported-PNG pixel check in dark theme; 400/768/1000 screenshots |
| 5 | H7 | — | written diagnosis with evidence; fix decision brought to the user |
| 6a | H9 | — | past-slot unit tests; route refuses a past start; time step hides started slots |
| 6b | H8 | **D7 approved**; after Stage 1 (shared `StepOffering` tile) | `kioskAvailability.test.ts`; user reviews the real `kioskoffering`/`kioskslot` screenshots, then scoped re-record and 2 stable re-runs; card → time step opens on first free day |

Stages 2–5 are independent of Stage 1 and of each other. **H9 is independent of everything.** **H8 waits for D7** and should follow Stage 1, which edits the same offering tile.

## Verification
- **Machine:** `npx tsc --noEmit`; `npm test` (new `kioskFreeBooking.test.ts`, `kioskBookingNotification.test.ts`); `npm run lint` against the 35-problem baseline; Playwright subsets per stage and a full suite before calling the plan complete (**never piped through `tail`**; stop only dev servers the agent started, by PID; ask the user to stop their `:3000` server first).
- **Stage 6 baselines:** `kioskoffering` and `kioskslot` are expected to change; they are re-recorded only after the user has seen them, scoped with `--grep`.
- **Browser (throwaway, TEMP gallery modes removed afterwards):** free flow screens; failed approve; flag refresh; search names; signature export pixels; narrow cards.
- **Live (user or local stack):** free kiosk booking end to end, including the email and DB state; paid kiosk booking regression through PayMongo (staging); a dark-kiosk signature viewed in the vendor modal.

## Completion summary (2026-09-12)
- **Shipped (uncommitted at time of writing; the user commits):**
  - free (₱0) kiosk bookings skip payment and are settled at creation, with the confirmation sent by the route (H1);
  - Approve re-enables after a failed write (H2), and a booking refreshes after "Something's wrong" (H3);
  - the search boxes have accessible names (H4);
  - signatures are stored dark-on-white (H5), and kiosk document cards work at phone width (H6);
  - the gallery hydration error was diagnosed as test-only and accepted, documented beside `FIXED_NOW` (H7/D8);
  - the kiosk offering grid is grouped by availability, with day chips on the time step (H8, design approved, baselines approved);
  - the kiosk never offers or accepts a started time (H9).
- **Verification:**
  - Machine: tsc 0; `npm test` **452/452**; lint 35, unchanged; full Playwright **173 passed + the 4 approved re-recorded kiosk baselines**, confirmed stable on two re-runs and byte-identical to the approved images.
  - Browser (throwaway, removed): 21 + 7 + 2 + 15 + 17 checks.
  - Live, by the user: free and paid kiosk bookings, started-time refusal, dark-tablet signature.
- **Not done, and why:** F6 (document version, user: stay parked), F8 (mobile parity), F12–F14 (user decisions), F15 (booker ₱0, cross-app), F16 (database-level refusal of started times, schema change). All tracked in `.plans/2026-08-25-vendor-launch-followups.md`. Mobile kiosk parity notes are in `.plans/2026-09-03-vendor-mobile-kiosk-mode.md`.

