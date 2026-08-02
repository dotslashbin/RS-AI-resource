# Ezzy Vendor Mobile — fulfilment sync and booking action buttons

**Date:** 2026-08-02
**App / scope:** `ezzy-vendor-mobile` only — `src/lib/`, `src/services/`, `src/components/bookings/`, `src/theme/tokens.ts`, `src/hooks/`
**Status:** DRAFT — all 4 decisions resolved (2026-08-02); awaiting execution approval

> Bring the companion app in line with the dual-acknowledgement feature shipped
> 2026-08-01. Two halves: **stop misreporting money**, then **give the vendor the
> fulfilment actions they will use most**. Optimise for a vendor standing in front
> of a customer with one hand free.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "vendor web I12").

---

## Scope

**In:** the vendor-facing half of the fulfilment model — the payable rule, the
nine booking statuses, and the vendor's own actions (hand over, mark as done, got
it back, undo, flag).

**Out, deliberately:**
- `ezzy-booker-mobile` — the booker's acknowledgement side is its own plan.
- `backbone` — **no schema change is needed.** Every table, column, RPC and
  trigger this plan depends on already exists and is already deployed to staging
  (verified 2026-08-02: 50/50 migrations applied). This plan is a *client* catching
  up to a backend that shipped without it.
- The web apps — untouched.
- Refunds — there is still no refund mechanism anywhere (`booking-flow.md`
  "Still missing"). Nothing here creates one.

**Cross-app coupling:** none at the write layer. This is single-app work.

---

## What the investigation actually found

Verified by reading the code, not inferred. `architecture/booking-flow.md:380`
already documents the headline: *"Mobile apps do not implement any of this yet;
their status maps fall back safely but will show raw values like 'In_progress'."*
That is accurate but understates the money bug below.

---

## BLOCKERS

### B1 — The payable rule counts undelivered work as payable  ⬜ TODO

**File:** `src/lib/format.ts:24-34`

```ts
const PAYABLE_BY_STATUS: Record<BookingStatus, boolean> = {
  pending: false,
  confirmed: true,      // ← the bug
  completed: true,
  ...
}
```

This is the exact rule the entire dual-acknowledgement feature was built to
reverse. The vendor web portal replaced it (`vendor/lib/utils.ts:124-133`) with a
rule driven by `booking_transactions.payout_status`, carrying an explicit warning:

> *"Do not re-derive this from BookingStatus. The DB is authoritative, and it knows
> things the status alone does not — e.g. a payout already released before a later
> refund stays `released`, because the money genuinely left."*

Mobile still derives from status, so a vendor's phone shows money owed for work
they have not delivered, and disagrees with both the web portal and the database.

**Three consumers, all wrong today:**
| File | Use |
|---|---|
| `src/services/dashboard.service.ts:74` | dashboard payout stat |
| `src/services/transactionTotals.ts:35` | transactions page total |
| `src/components/transactions/TransactionListItem/TransactionListItem.tsx:17-18` | per-row strikethrough + reason |

**A second, compounding defect** at `src/services/dashboard.service.ts:71`:
```ts
const status = (row.bookings?.status ?? "confirmed") as BookingStatus
```
A missing embed defaults to `confirmed` — which under the current table means
*payable*. The safe default is the opposite.

**Fix approach:** port `vendor/lib/utils.ts:124-146` verbatim in intent — a
`PAYABLE_BY_PAYOUT: Record<PayoutStatus, boolean>` keyed on `held | releasable |
released | reversed`, with `payoutExclusionReason()` beside it. Note this makes the
queries *simpler*: `payout_status` is a column **on `booking_transactions` itself**,
so `dashboard.service.ts:62` and the totals query at `transactions.service.ts:148`
can drop their `bookings(status)` embed entirely.

**Coupled to B2** — do not land one without the other.

---

### B2 — `BookingStatus` is missing four of the nine statuses  ⬜ TODO

**File:** `src/lib/types.ts:11-17`

```
mobile:   pending confirmed completed cancelled refunded
database: + fulfilled  in_progress  returned  disputed
```

`tsc` is clean because `PAYABLE_BY_STATUS` is exhaustive over the *old* union. The
comment at `format.ts:17` claims "adding a status forces a decision here" — true,
and it is the reason B2 must land **with** B1: widening the union turns that
`Record` into a compile error, which is the mechanism that guarantees B1 is not
forgotten. Sequencing them apart discards the only automatic safeguard.

**Runtime effect today:** a `fulfilled` booking falls through `?? false` and renders
*"Not counted — this booking was fulfilled"*. So mobile currently **overstates**
`confirmed` and **understates** `fulfilled`/`returned`.

**Fix approach:** widen the union to all nine; add `PayoutStatus`
(`held|releasable|released|reversed`) and `FulfilmentPattern` (`session|custody`).

---

### B3 — The bookings query does not fetch the fields every action depends on  ⬜ TODO

**File:** `src/services/bookings.service.ts:21-31` (`BookingRow`), `:86-99`, `:119-130`

Three columns are absent, and each one gates a feature below:

| Column | Needed for |
|---|---|
| `bookings.fulfilment_pattern` | choosing **Hand over** vs **Mark as done** (I2) |
| `bookings.is_paid` | the unpaid warning + confirm gate (I5) |
| `bookings.status_changed_at` | the 3-day auto-confirm countdown (I6) |

**Fix approach:** add all three to the `select()` in `getBookingsPage` and
`getBookingById`, to `BookingRow`, to `Booking`, and to `toBooking()`.

`fulfilment_pattern` is snapshotted onto the booking at creation, so read it from
`bookings`, **never** from `offerings` — a vendor editing an offering mid-flight
must not change an in-flight booking's shape (`booking-flow.md:339`).

---

## IMPORTANT

### I1 — Port the action copy table  ⬜ TODO

**New file:** `src/lib/bookingActionCopy.ts`, adapted from `vendor/lib/bookingActionCopy.ts`

Types and copy are **copied and adapted across repos, never imported**
(`mobile-dev` §1). The five vendor keys and their wording carry over unchanged —
this is copy that tells a vendor when they get paid, and it must not drift from web:

| Key | Label | Pattern |
|---|---|---|
| `vendor_start` | "Hand over" | custody |
| `vendor_fulfil` | "Mark as done" | session |
| `vendor_confirm_return` | "Got it back" | custody |
| `vendor_undo` | "Undo" | both |
| `vendor_dispute` | "Something's wrong" | both |

**Component separation:** pure data module, no React. No hook, no styles.

---

### I2 — Decide-and-render the fulfilment action  ⬜ TODO

**File:** `src/components/bookings/ApproveRejectBar/` → renamed `BookingActionBar/`

The current bar (`ApproveRejectBar.tsx:23-34`) returns *"This booking is
{status}. No action needed."* for **every** non-pending status. That sentence is now
false for `confirmed`, `in_progress` and `returned` — exactly the states where the
vendor has work to do.

Port the decision table from `vendor/.../useBookingRow.ts:15-20`:

```
confirmed + session  → vendor_fulfil          ("Mark as done")
confirmed + custody  → vendor_start           ("Hand over")
returned             → vendor_confirm_return  ("Got it back")
otherwise            → no fulfilment action
```

**Component separation:** `BookingActionBar.tsx` stays a pure render layer;
`useBookingActionBar.ts` owns the decision, the sheet state and the handlers;
`BookingActionBar.styles.ts` exports `makeStyles(tokens)` memoised by the render
layer. Touch targets ≥ 44×44pt (`mobile-dev` §2).

**Rename rationale:** the component no longer only approves and rejects. Leaving
the old name would mislead the next reader; it is a two-file rename with one import
site (`BookingDetail.tsx:4`).

---

### I3 — Undo  ⬜ TODO

**Files:** `src/hooks/useBookingActions.ts`, `BookingActionBar`

Offered from `fulfilled` and `in_progress` only — where the vendor acted last and
the customer has not yet responded. **Never from `returned`**: there the customer
*has* acted, and letting the vendor rewind that erases someone else's input
(`vendor/.../useBookingRow.ts:22-24`).

**Important divergence from `approve`:** `useBookingActions.ts:15-30` documents that
approve must *defer* its write because `confirmed → pending` is illegal in the DB.
That reasoning **does not apply here** — `fulfilled → confirmed` and `in_progress →
confirmed` are legal transitions. Undo is therefore a plain forward write, not a
deferred commit. Do not copy the timer machinery; it would add a second cache-patch
path for no benefit.

---

### I4 — The "i" explanation, in a mobile idiom  ⬜ TODO

Web pairs each button with a Radix popover carrying `meaning` from I1. `mobile-dev`
§1 is explicit: port the *service* logic, not desktop affordances. A hover popover
has no mobile equivalent.

**Resolved (D1):** a **bottom sheet**, modelled on `RejectReasonSheet`. New component
`src/components/bookings/ActionInfoSheet/` — `.tsx` render layer,
`useActionInfoSheet.ts` for visibility state, `.styles.ts` exporting
`makeStyles(tokens)`.

The sheet body is the `meaning` string from I1 **verbatim** — that is the whole point
of the shared copy table. Reachable by tapping the "i" control; swipe-to-dismiss may
be added but never as the only path (`mobile-dev` §2).

---

### I5 — Unpaid warning and confirm gate  ⬜ TODO

**Depends on:** B3 (`is_paid`)

A booking can run the whole fulfilment flow unpaid — the booker abandoned PayMongo
checkout — so the vendor is about to deliver work no ledger row will ever pay for.
Port `vendor/.../useBookingRow.ts:70-79`:

- **Warn** whenever `!isPaid && status ∉ {cancelled, pending}`. Surfaced, never
  blocked: blocking strands the booking with no exit.
- **Confirm** only on the two `confirmed → …` moves, where work is about to be
  committed. **Not** on `returned → completed` — by then they have handed over and
  been warned once, and a second prompt at the finish line is nagging.

---

### I6 — Auto-confirm countdown  ⬜ TODO

**Depends on:** B3 (`status_changed_at`)

`fulfilled` and `returned` auto-confirm after 3 days (`auto_acknowledge_bookings()`,
hourly). Show the days remaining so the vendor knows the money is not stuck.
`in_progress` has **no timer** — show no countdown there, or the app promises
something the database will never do.

**Trap from the web build (vendor web I23):** the realtime handler must patch
`status_changed_at` alongside `status`, or the countdown freezes at its first value.
This bug shipped in booker, was fixed, and was then missed in vendor web because the
two files are near-identical twins. `src/hooks/useBookingsRealtime.ts` is the third
twin — check it explicitly.

---

### I7 — Status labels and colours for the four new states  ⬜ TODO

**Files:** `src/theme/tokens.ts:130-137`, plus a new label map

`tokens.status` is `Record<string, …>` and every consumer uses `?? fallback`
(`BookingListItem.tsx:23`, `TransactionListItem.tsx:19`, `BookingDetail.tsx:37`), so
new statuses degrade to a grey pill rather than crashing — the "fall back safely"
the architecture doc describes. But there is **no human label**, so the raw value
renders (`"in_progress"`).

Vendor-side labels are already specified in `architecture/booking-flow.md:345-349`
and must match:

| Status | Vendor sees |
|---|---|
| `fulfilled` | "Awaiting customer" |
| `in_progress` | "With customer" |
| `returned` | "Got it back" |
| `disputed` | "On hold" |

---

### I8 — Filter tabs omit every new state  ⬜ TODO

**File:** `src/components/bookings/BookingFilterTabs/BookingFilterTabs.tsx:9-15`

Five filters (`pending, confirmed, completed, cancelled, all`). A booking in
`fulfilled`, `in_progress`, `returned` or `disputed` is reachable only under "All".

Do **not** add four more chips — nine chips in a horizontal strip is a scroll bar,
not a filter. Web solved this with lifecycle groups ("Needs you", "Active", "Done",
"Issues"); the same grouping applies here and keeps the strip at five.

**Trap:** `BookingFilterTabs` is the component that already cost a build cycle to
the horizontal-`ScrollView` `flexGrow` bug (app `AGENTS.md`, Traps). Any change here
needs a device screenshot, not a type-check.

---

### I9 — Flag ("Something's wrong")  ⬜ TODO

Calls `raise_booking_dispute()`; freezes the payout until Command resolves it.
Offered from `fulfilled`, `in_progress`, `returned`, `completed` — before fulfilment
starts, reject/cancel are cleaner exits (`vendor/.../useBookingRow.ts:32-34`).

The DB enforces a **10-character minimum** on the reason; validate client-side so the
vendor gets a sentence instead of a raw Postgres error.

**Resolved (D2): ships in this plan.** `RejectReasonSheet` is the natural host — it
already collects a free-text reason behind a confirm step. Generalise it to take a
title, placeholder and minimum length rather than cloning it; the reject path passes
its existing values so that behaviour is unchanged.

`disputed` is terminal for the vendor: there is no self-service withdrawal, and only
Command can resolve it (`resolve_booking_dispute`). The screen must say so rather
than offering a dead control.

---

## DECISIONS

<!-- All resolved 2026-08-02. No OPEN lines remain — the plan is clear to execute
     once the user approves. -->

- **D1 — How does the "i" explanation render on mobile? (I4)** →
  **(a) Bottom sheet, reusing the `RejectReasonSheet` idiom** (resolved 2026-08-02)
  — the app already owns the pattern, it is tap-reachable and comfortably ≥44pt, and
  it has room for the full `meaning` sentence. Rejected: an inline expanding caption
  (reflows the action bar at the screen bottom, where reflow is most disorienting),
  and dropping the explanation (this is the copy that tells a vendor *when they get
  paid* — the one thing web deliberately surfaced in three places).

- **D2 — Does the flag action (I9) ship in this plan?** → **(a) Yes**
  (resolved 2026-08-02) — it is the only escape when a handover goes wrong. Without
  it the app can *start* a custody booking but cannot report that the item came back
  damaged, leaving a laptop as the vendor's only recourse. The RPC and the sheet
  pattern both already exist, so the marginal cost is small.

- **D3 — Where do the action buttons live?** → **(a) Detail screen only**
  (resolved 2026-08-02) — matches the current architecture (`BookingDetail.tsx:80`),
  keeps list rows tappable rather than cluttered, and gives the unpaid warning and
  the "i" affordance room to exist. Costs one extra tap per action, accepted.
  Rejected: a primary action on the list row, because a row cannot host the unpaid
  confirm gate or the explanation — the same action would then behave differently in
  two places, which is worse than the extra tap.

- **D4 — Does the dashboard get a fulfilment guide section?** → **(a) No, not in
  this plan** (resolved 2026-08-02) — the D1 bottom sheet already carries the same
  sentences at the point of use, which on a small screen beats a panel the vendor
  must scroll to find. Revisit only if it proves confusing on device.

---

## DEFERRED / COSMETIC

- **Booker-side acknowledgement in `ezzy-booker-mobile`** — separate app, separate
  plan. Until it ships, bookers acknowledge on the web.
- **Refunds** — no mechanism exists anywhere; out of scope by definition.
- **Command-style payout release** — a Command function, never a vendor one.
- **`.plans/2026-07-31-vendor-mobile-booking-status-actions.md`** — supersede and
  mark ✖ ABORTED. It predates dual-acknowledgement by one day: its D1 proposes
  shipping `confirmed → completed`, a transition the trigger now **rejects**, and its
  D4 asks whether it is acceptable for mobile to *lead* web when mobile now lags.
  Aborting it is part of this plan's execution, not a side note.

---

## Execution order

Ordered by dependency and risk, not by numbering.

1. **B2 + B1 together** — widen the union, which breaks the build, which forces the
   payable rewrite. Landing B2 alone leaves `tsc` red; landing B1 alone discards the
   safeguard. One batch.
2. **B3** — add the three columns. Nothing below works without them.
3. **I1** — copy table. Pure data, no dependencies.
4. **I7 + I8** — labels, colours, filter groups. Makes the new states *visible*
   before anything can act on them.
5. **I2 + I3** — the action bar and undo. The core of the request.
6. **I5 + I6** — unpaid gate and countdown. Both depend on B3 and on I2 existing.
7. **I4** — the `ActionInfoSheet` bottom sheet (D1).
8. **I9** — flag, on a generalised `RejectReasonSheet` (D2).
9. Mark the superseded plan ✖ ABORTED.

Steps 1–2 are the safe prefix: they fix the money bug and are independent of every
open decision. **They could start immediately if you want the defect closed before
the UI work is settled.**

---

## Verification

**Machine-verifiable:**
- `ezzy-vendor-mobile/node_modules/.bin/tsc --noEmit --project ezzy-vendor-mobile/tsconfig.json` — must be 0. Use the binary directly; `npm exec tsc` hangs (app `AGENTS.md`).
- `npm --prefix ezzy-vendor-mobile run lint` — 0.
- `npm --prefix ezzy-vendor-mobile test` — `node --test`. **B1's rule is pure logic and belongs in its own module** so the existing `format.test.ts` can cover it without importing `lib/supabase/client` (app `AGENTS.md`, Traps). Update `format.test.ts:22` and `:38`, which currently assert `isPayable("confirmed") === true` — the assertion encoding the bug.
- `npx expo export --platform android` — proves the route tree builds; delete `dist/`.

**Needs a live environment — cannot be machine-checked:**
- That the actor-aware trigger accepts these writes **from a mobile session**. The
  trigger branches on who the caller is; web is proven, mobile is not. Requires a
  real booking on staging.
- Every visual item (I2, I4, I7, I8). The app's `AGENTS.md` is emphatic: four style
  passes across two plans shipped changes that `tsc`, lint, tests and export all
  approved and that did **nothing on screen**. **I8 in particular** touches the
  component that already cost a build cycle to the `ScrollView` `flexGrow` trap.
  Screenshot required before any of these is marked ✅.
- iOS remains entirely unverified for this app (needs a paid Apple account, plan
  **B9**). Mark work Android-verified and say so.

**Explicitly not verifiable here:** that a payout actually reaches a vendor. There is
no payout rail; Command's "Mark as paid" records a transfer made elsewhere.
