# Delete-failure message placement, and removing the kiosk payment-method list

**Date:** 2026-09-15
**App / scope:** `vendor/` only — Offerings page delete failure (`components/offerings/`), kiosk review step (`components/kiosk/KioskBooking/StepPayment.tsx`)
**Status:** COMPLETE (2026-09-15) — I1 and I2 both done and machine-verified; full vendor Playwright suite 179 passed, 0 failed. Left with the user: committing, and the live confirmation that folds into the 2026-09-14 plan's Stage 5. F2 stays open as a separate suggestion.

> Two small, unrelated fixes. (1) When a delete is refused because the offering is used by a
> schedule or a booking, the explanation renders at the **bottom of the Offerings page**, so the
> vendor has to scroll to find out why nothing happened. (2) The kiosk's review step lists the
> payment methods, which PayMongo's own page already shows.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** I# = Important, D# = Decision, F# = Finding. Numbers are plan-local.

**Out of scope:** `booker`, `command`, `ezzy-vendor-mobile`; any schema, storage or dependency
change; the offering form modal's own error (see F1); and the previous plan
(`.plans/2026-09-14-vendor-offering-photo-limit-and-kiosk-offering-cards.md`), whose only open item
is the user's Stage 5 live check.

---

## Findings (investigation 2026-09-15, from the code)

- **The message is not a toast today.** `OfferingsPage.tsx:95-99` renders a plain red banner
  *after* the offerings grid — so its position depends on how many offerings the vendor has. With a
  full page of cards it lands below the fold, which is exactly the report.
- **The text is correct and deliberate.** `offerings.service.ts:101-109` maps Postgres `23503`
  (foreign key) to "This offering is used in one or more schedules and cannot be deleted." A
  booking reference produces the same `23503`, so the wording says "schedules" for a booking-linked
  offering too (see F2).
- **The confirmation stays open on failure.** `useOfferingsPage.ts:275-279` returns early on error,
  so `oDeleteConf` keeps its id and the card keeps showing **Delete this offering?**
  (`OfferingCard.tsx:173-186`). The card is therefore still on screen, next to where the vendor
  just tapped — the natural place for the message.
- **The app already has toasts, and Offerings is the exception.** `sonner` is mounted in
  `app/layout.tsx:80` (`<Toaster position="bottom-right" richColors />`) and `toast.error(...)` is
  the pattern in Staff (`useStaffPage.ts:73`), Schedule (`useSchedulePage.ts:158`), Profile
  (`useProfilePage.ts:28`) and the shell (`useAppShell.ts:667`). `command` mounts the same
  bottom-right toaster; `booker` wraps its own `AppToaster`.
- **Only two places use this inline red banner**: the offerings page (the problem) and the offering
  form modal (`OfferingFormModal.tsx:273`), where it sits directly above Save inside the dialog and
  is fine as it is (F1).
- **The kiosk methods list lives in one place**: `StepPayment.tsx:7` `METHODS` and `:55-65`, with
  `.methodsHead` / `.methodsTitle` / `.methods` / `.method` in `KioskBooking.module.css:317-326`.
  Nothing else in `vendor/`, `architecture/` or the guide names those methods, so removing them
  contradicts no documented decision. The free path already hides the whole block (kiosk hardening
  H1c) and must stay exactly as it is.
- **No screenshot covers the review step** — `pilot.spec.ts` has no `kioskpayment` mode, so no
  baseline changes. The kiosk hardening plan's browser check did assert "methods" on the paid path;
  that check is superseded by this plan, not silently broken (F3).

### What the research says (2026-09-15)

Current guidance is consistent, and it points away from a toast for this case:
- Put the error **next to the thing that caused it**; a message in a far corner hides where the
  problem is ([Smashing Magazine](https://www.smashingmagazine.com/2022/08/error-messages-ux-design/)).
- **Toast for success, inline for failure** is the sane default; toasts suit short, non-critical,
  in-the-moment messages ([21st.dev](https://21st.dev/blog/react-toast-notification-components),
  [Adobe Spectrum](https://spectrum.adobe.com/page/toast/)).
- Anything the user must **read and act on** should not auto-dismiss; a timed toast is hostile to
  screen-reader users, who need time to hear it, understand it and return to the control
  ([a11ysolutions](https://dev.to/a11ysolutions/accessible-error-messages-the-patterns-that-work-across-jaws-nvda-and-voiceover-1b5n),
  [Sara Soueidan](https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/)).
- Destructive confirmations belong inline with the action rather than behind a disappearing window
  ([UX Movement](https://uxmovement.substack.com/p/why-toasts-arent-the-best-for-button)).

This message is a refusal the vendor must act on (remove the schedule, or keep the offering), it is
attached to one specific card, and that card is still on screen. So: **inline, in the card, and it
stays until dismissed** — not a toast.

---

## IMPORTANT

### I1 — The delete refusal renders at the bottom of the page  ✅ DONE (2026-09-15)
<!-- ✅ DONE 2026-09-15 (D1 = A). Executed: OfferingCard gained `deleteError?: string | null`,
rendered under the question inside the confirm block as a `role="alert"` box in the card's existing
red treatment (the confirm block became a fragment to hold both). OfferingsPage passes it only to
the card whose id is `oDeleteConf` and no longer renders the page-bottom banner; the existing
handlers already cleared the error on open/cancel, so no hook change was needed.
Verified (machine): tsc 0; eslint on components/offerings reports only the pre-existing
set-state-in-effect error in useOfferingsPage.ts; 452/452 unit tests. Throwaway script s6-delete.cjs
(real Offerings page, DELETE forced to 23503), at 8 and 20 offerings, viewport 1280×800:
  exactly 1 message, inside the card acted on, fully in the viewport, page scrollTop 0, no loose
  copy anywhere else on the page, confirm row still open; Cancel clears it; opening another card's
  confirm shows no message. Screenshot s6-delete-20-offerings.png.
Full vendor suite after both items: 179 passed, 0 failed (exit 0), no baseline changes.
Needs live: a real FK refusal on staging (folds into the other plan's Stage 5). -->
**Files:** `components/offerings/OfferingsPage/OfferingsPage.tsx:95-99` (remove the banner);
`components/offerings/OfferingCard/OfferingCard.tsx:31-45` (props) and `:173-186` (confirm row);
`components/offerings/OfferingsPage/useOfferingsPage.ts:47, 268-282` (state, clearing)
A vendor deletes an offering used by a schedule, the card does not disappear, and the explanation
is metres below the fold. On a 20-offering page nothing visible changes at all.

**Fix approach (D1 = A recommended, "in the card"):**
- `OfferingCard` takes one new optional prop, `deleteError?: string | null`, rendered **inside the
  confirm block, under the question**, in the card's existing red treatment, with
  `role="alert"` so it is announced. It shows only while that card is the one confirming, so a card
  cannot display another card's failure.
- `OfferingsPage` passes `deleteError` to the card whose id is `oDeleteConf`, and nothing to the
  rest. The page-bottom banner is deleted.
- The confirm row **stays open** (already the behaviour) and its buttons stay usable: **Cancel**
  closes and clears the error, **Delete** can be retried (a schedule may have been removed in
  another tab). Clearing on Cancel and on a new `onDeleteRequest` prevents a stale refusal
  reappearing on the next attempt.
- The message must not auto-dismiss, per the research above.
**Component separation:** `OfferingCard` stays a pure render layer (one more prop, no state);
clearing stays in `useOfferingsPage`; styling reuses the card's existing Tailwind tokens, so no new
CSS. No new component.
**Verify:** script with a mocked `23503` delete: the message is inside the card, fully in the
viewport without scrolling, the confirm row is still there, Cancel clears it, and no banner exists
at the page bottom. Plus a long list (20 offerings) with the card near the top.

### I2 — Remove "How you can pay" from the kiosk review step  ✅ DONE (2026-09-15)
<!-- ✅ DONE 2026-09-15. Executed: StepPayment.tsx lost the METHODS array, the heading block, the
chips, the PayMongo sentence (D3) and the now-unused CreditCard import; the paid branch is now just
the summary + total, and `k.isFree &&` renders the unchanged free line. KioskBooking.module.css lost
.methodsHead/.methodsTitle/.methods/.method; `.payHint` stays (the free line still uses it).
architecture/booking-flow.md gained a paragraph in the Kiosk Mode section stating the rule.
Verified (machine): tsc 0; eslint clean on components/kiosk; lint 34 problems, same files; 452/452
unit tests; grep shows no method/PayMongo text in the rendered component (only in the explanatory
comment). Throwaway script s5-review.cjs walked the REAL kiosk to the review step on next dev:
  paid → heading "Review and pay", "How you can pay" absent, 0 of the 6 method names present,
    no PayMongo sentence, total row present, CTA "Pay ₱200" (screenshot s5-review-paid.png);
  free → heading "Review and confirm", "Nothing to pay — confirm and you're booked." present,
    CTA "Confirm booking" — unchanged by this item. -->
**Files:** `components/kiosk/KioskBooking/StepPayment.tsx:2, 7, 55-65`;
`components/kiosk/KioskBooking/KioskBooking.module.css:317-326`
The list duplicates what PayMongo's own checkout page shows, and it can silently go stale if the
PayMongo account's enabled methods change — a promise the kiosk cannot keep.
**Fix approach (D3 = delete the sentence too):** delete the `METHODS` array, the heading block, the
chips **and** the "You'll be taken to PayMongo's secure page…" line, plus the now-unused
`CreditCard` import and the CSS that nothing else uses (`.methodsHead`, `.methodsTitle`, `.methods`,
`.method`, and `.payHint` if the free branch is its only remaining user — check before removing).
The paid review step then ends at the total. The **free** branch is untouched and keeps its own
"Nothing to pay — confirm and you're booked." line.
**Component separation:** deletion only; `StepPayment` remains pure display.
**Verify:** script through the real kiosk to the review step: no "How you can pay", none of the six
method names, **no** PayMongo sentence, total unchanged, **Pay ₱x** still starts checkout; a free
offering still shows "Nothing to pay — confirm and you're booked." and "Confirm booking". `tsc`,
lint, unit tests, and the kiosk Playwright tests (no baseline covers this step).

---

## DECISIONS
<!-- No item may execute while an OPEN: line remains. -->
- **D1 — where the delete refusal appears** → **A: in the card, under "Delete this offering?"**
  (resolved 2026-09-15, user, after reviewing the preview). Beside the action, stays until
  dismissed, no global change, matches the research. Options not taken: ·
  **B — sonner toast.** Consistent with Staff/Schedule/Profile and never below the fold, but it
  auto-dismisses a message the vendor must act on, and at bottom-right it is far from the card. ·
  **C — banner pinned under the page title.** Always visible, but it names a card that may be
  anywhere on screen, and it is a third error pattern to maintain.
- **D2 — global toast position** → **keep `bottom-right`** (resolved 2026-09-15, user).
  `app/layout.tsx:80` is not touched by this plan. Rationale as recommended: — the existing toasts are mostly success/non-critical, the
  scroll problem is solved by D1 = A, and `command` uses the same position, so moving only `vendor`
  splits the convention. · **Move to `top-center`** if you want every vendor toast at the top; this
  changes every toast in the app (booking arrivals, save failures), so it is a separate visual pass.
- **D3 — keep the PayMongo sentence when the methods go?** → **No, delete it too** (resolved
  2026-09-15, user: "you don't need to put … simply delete it"). My earlier "keep it" recommendation
  is overruled: the paid review step ends at the total, and the **Pay ₱x** button already says what
  happens next. ⚠️ The **free** branch keeps its own line, "Nothing to pay — confirm and you're
  booked." (kiosk hardening H1c) — that one is not about PayMongo and is unaffected.

## FINDINGS (no action)
- **F1 — the form modal's inline error is fine.** `OfferingFormModal.tsx:273` sits directly above
  the Save button inside the dialog. Same treatment, right place. Not changed.
- **F2 — the refusal says "schedules" even when a booking is the blocker.** `offerings.service.ts:105`
  maps every `23503` to the schedule wording. A vendor whose offering has bookings but no schedules
  is told something false. ⬜ Not in scope here; worth its own item if you want the message to name
  the real blocker (which needs a count query, or splitting the FK check).
- **F3 — a superseded check.** `.plans/2026-09-12-vendor-kiosk-hardening.md` records a browser check
  asserting the methods chips on the paid path. I2 deliberately removes them; that plan's line stays
  as history and this plan is the reason it no longer holds.

## Execution order
1. **I2** (kiosk methods) — independent of D1/D2 and safe to run as soon as the plan is approved.
2. **I1** — after D1 (and D2 if it changes anything).
3. Re-run the full vendor Playwright suite once at the end.

## Verification
**Machine-verifiable:** `tsc`, lint (no new problems versus the current baseline: 34 problems,
31 errors), `npm test`, the kiosk + offerings Playwright tests, then the full suite; a throwaway
script for both items as described in I1 and I2.
**Needs a live environment:** a real refused delete on staging (a real FK), and a real kiosk
payment reaching PayMongo — both fold into the other plan's Stage 5 live check.
