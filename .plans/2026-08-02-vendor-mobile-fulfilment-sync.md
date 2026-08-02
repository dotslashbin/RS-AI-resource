# Ezzy Vendor Mobile — fulfilment sync and booking action buttons

**Date:** 2026-08-02
**App / scope:** `ezzy-vendor-mobile` (primary) + a single approved change in
`vendor` for D6 — see Scope.
**Status:** IN PROGRESS (2026-08-02) — stages 1–11 done (B4 ✅ · B2+B1 ✅ ·
B3 ✅ · I1 ✅ · I7 ✅ · I8 ✅ · I2+I3 ✅ · I5+I6 ✅ · I4 ✅ · I9 ✅). All 5 decisions resolved.
**The vendor can hand over, mark as done, confirm a return and undo — with an
honest payout countdown, an unpaid warning, and a tap-to-explain sheet.**
**Every item is executed and machine-verified.** The plan is deliberately NOT
marked COMPLETE: seven items carry visual or runtime behaviour that no machine
check in this repo can see, and none of it has run on a phone. See
**"What remains"** at the foot of this document. Revised 2026-08-02 after a review that found one live crash (B4), one
error in B1, three coupled changes hidden inside I8, and a misread of web's filter
groups in D5.

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
- ~~The web apps — untouched.~~ **Amended 2026-08-02:** the user explicitly
  approved widening scope to include `vendor` in order to close D6 ("lets address
  D6 and include vendor this time"). That is the cross-app approval gate under
  root `AGENTS.md`, granted for this one item. `booker` and `command` remain
  untouched.
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

### B1 — The payable rule counts undelivered work as payable  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — Executed as stage 2, batched with B2.
> **Changed:** `lib/format.ts` (`PAYABLE_BY_PAYOUT` replaces `PAYABLE_BY_STATUS`;
> both exported functions now take `PayoutStatus`) · `services/transactionTotals.ts`
> (`TotalsRow.payout_status` replaces the `bookings` embed; default inverted to
> `held`) · `services/transactions.service.ts` (`payout_status` added to `DbRow`,
> `SELECT_COLS` and `toTransaction`; the **totals** query drops `bookings(status)`,
> the **list** query keeps it) · `services/dashboard.service.ts` (same swap; the
> `?? "confirmed"` default at the old `:71` is gone) ·
> `components/transactions/TransactionListItem.tsx` (payability from
> `transaction.payoutStatus`, pill still from `transaction.status`).
> **Verified (machine):** `tsc` exit 0 · `npm test` **43/43** · `expo lint` exit 0 ·
> `expo export --platform android` exit 0. Grep confirms no `isPayable(...status)`
> call sites remain and the only surviving `bookings(...)` embed is the list query's.
> **Tests rewritten:** `format.test.ts` and `transactionTotals.test.ts` asserted the
> old rule — `isPayable("confirmed") === true` was the defect written down as a
> passing test. Added a **regression test** asserting every booking-status string
> is unpayable, and one asserting `reversed` is never described as a refund (the DB
> column comment forbids it — there is no refund mechanism in this system).
> **NOT verified:** real figures against staging. The arithmetic is unit-tested, but
> that the vendor's dashboard total now *matches the web portal* needs a live check.

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
released | reversed`, with `payoutExclusionReason()` beside it.

**⚠️ Correction (2026-08-02 review).** An earlier draft of this item said all
queries "can drop their `bookings(status)` embed entirely". **That is wrong and
would have broken the transactions list.** Only the two *aggregate* queries fetch
booking status solely to decide payability:

| Query | `bookings(status)` | Why |
|---|---|---|
| `dashboard.service.ts:62` | **drop** | used only for `isPayable` |
| `transactions.service.ts:148` (totals) | **drop** | used only for `isPayable` |
| `transactions.service.ts:45` (`SELECT_COLS`) | **KEEP** | `TransactionListItem.tsx:19` renders a status **pill** from `tokens.status[transaction.status]`; the embed also carries `booker_id`, `booked_date` and `offerings(...)` |

So `Transaction.status` stays on the type and stays fetched — what changes is that
`isPayable` no longer *consumes* it. Add `payoutStatus` alongside it rather than
replacing it.

**Also fix** `dashboard.service.ts:71`, which defaults a missing embed to
`"confirmed"` — payable under the old rule. Under the new rule the safe default is
`held`.

**Coupled to B2** — do not land one without the other.

---

### B2 — `BookingStatus` is missing four of the nine statuses  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — Executed as stage 2, batched with B1.
> **Changed:** `lib/types.ts` — `BookingStatus` widened to all nine; `PayoutStatus`
> and `FulfilmentPattern` added; `Transaction` gained `payoutStatus` alongside the
> existing `status` (both are needed — see B1) ·
> `components/bookings/BookingsList/useBookingsList.ts` (see below).
> **The safeguard worked as designed.** Widening the union broke the build at a
> consumer this plan had *not* enumerated:
> `useBookingsList.ts:9`, an exhaustive `Record<BookingFilter, …>` of empty-state
> copy. Because `BookingFilter` is an alias of `BookingStatus | "all"` (the coupling
> recorded in I8), it went incomplete the moment the union grew. Fixed with four
> plain entries, explicitly marked as scaffolding: **I8 re-keys this map to the six
> lifecycle groups**, at which point the status-keyed entries collapse. Left
> deliberately plain rather than polished, so it is not mistaken for final copy.
> **Verified (machine):** `tsc` exit 0 (after the fix) · `npm test` 43/43 ·
> `expo lint` exit 0 · `expo export` exit 0.

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

### B3 — The bookings query does not fetch the fields every action depends on  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — Executed as stage 3.
> **Changed:** `lib/types.ts` (`Booking` gained `fulfilmentPattern`, `isPaid`,
> `statusChangedAt`) · `services/bookings.service.ts` (`BookingRow` + `toBooking`
> mapping + a new shared `BOOKING_SELECT_COLS`).
> **Refactor, justified not incidental:** the list and detail queries held
> **byte-identical** duplicated select strings. Rather than adding three columns to
> each, they now share one `BOOKING_SELECT_COLS` constant — the pattern the sibling
> `transactions.service.ts` already uses. Two copies of a column list that just grew
> is a drift waiting to happen.
> **`statusChangedAt` is `string | null`** — the column is nullable
> (`20260801000002` added and backfilled it, but did not add `not null`). I6 must
> treat null as "no countdown", never as a date.
> **Verified (machine):** `tsc` exit 0 · `npm test` 43/43 · `expo lint` exit 0 ·
> `expo export` exit 0.
> **Verified (live, local DB):** ran the exact column list as SQL — resolves, and
> the data is real: **15 `custody` / 27 `session`**, one unpaid booking (which will
> exercise I5), and **zero** null `status_changed_at`. So both I2 branches and the
> I5 unpaid path have fixtures to test against without inventing data.

> **⚠️ Correction to I6's realtime trap (2026-08-02).** I6 says to check
> `useBookingsRealtime.ts` for the `status_changed_at` patching bug that hit booker
> and then vendor web (vendor web I23). **It does not apply.** That hook
> **invalidates** on both INSERT and UPDATE rather than patching
> (`useBookingsRealtime.ts:16-20` explains why: the cache is paged across several
> query keys and the payload lacks the joined fields), so a refetch pulls every
> column including the new three. Nothing to keep in sync there.
>
> **The trap does apply somewhere else, though:** `useBookingActions.ts`
> `patchCache()` writes optimistic partial updates — today `{ status, rejectionReason }`.
> When I2/I3 add fulfilment actions, patching `status` **without** `statusChangedAt`
> would freeze the countdown at its previous value, which is the same defect in a
> different file. **I2/I3 must patch both.**

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

### B4 — Notifications screen crashes on the new notification types  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — Executed as stage 1.
> **Changed:** `src/lib/types.ts` (union widened by the four vendor-portal types,
> with a note on why `booking_fulfilled`/`booking_started` are excluded);
> `NotificationListItem.tsx` (four `TYPE_ICON` entries + `UNKNOWN_TYPE` fallback at
> the destructure).
> **Verified (machine):** `tsc --noEmit` exit 0 · `npm test` 40/40 pass · `expo lint`
> exit 0 · `expo export --platform android` exit 0 (7.1 MB bundle, `dist/` removed).
> Icon names were checked against `node_modules/lucide-react-native/dist/esm/icons/`
> before use — `lucide-react-native` is on ^1.27, where the pre-v1 spellings the web
> app still uses do not exist.
> **NOT verified:** that the screen no longer crashes in the hand. That needs a real
> vendor-portal notification of one of these types on a device. The fallback is
> verified by construction and by type-check only.
> **Not extracted for unit testing:** the fallback is a single `??` inside a
> component that imports `react-native` and `lucide-react-native`, so it cannot load
> under `node --test`. Pulling the icon table into its own module purely to assert
> `??` would be an abstraction with one consumer — rejected on simplicity grounds.

**Found by the 2026-08-02 plan review — not in the original draft.**
**Files:** `src/lib/types.ts:58-65`, `src/components/notifications/NotificationListItem/NotificationListItem.tsx:30,61`

`20260801000007` added six notification types. **Four are inserted with
`portal = 'vendor'`** and therefore land in this app:

| Type | Migration line | Fires when |
|---|---|---|
| `booking_returned` | `:143` | the booker says they returned it |
| `booking_completed` | `:160` | both parties confirmed; payout available |
| `booking_disputed` | `:181` | either side flags the booking |
| `dispute_resolved` | `:224` | Command resolves a flag |

Mobile's `NotificationType` union knows **none** of them. The fetch does not filter
by type — `notifications.service.ts:29` is `select("*")` scoped only by `portal` and
`is_archived`, and `:38` blind-casts to `AppNotification[]`, so `tsc` sees nothing.
Then:

```ts
// NotificationListItem.tsx:61 — no fallback
const { icon: TypeIcon, color: typeColor } = TYPE_ICON[notification.type]
```

`TYPE_ICON[unknown]` is `undefined`, and destructuring it throws
`TypeError: Cannot destructure property 'icon' of undefined`. **There is no error
boundary in the app** (the only match is `lib/pushModule.ts`, an unrelated lazy
accessor), so this takes the Notifications screen down.

**This is already live.** It does not require any of this plan to trigger — the
vendor **web** portal can drive a booking to `returned`/`completed`/`disputed`
today, which inserts a vendor-portal row. The next time that vendor opens the
mobile Notifications tab, it crashes. Shipping this plan's action buttons makes it
reachable from the phone as well, but the defect exists now.

**Fix approach — two parts, both needed:**
1. Add the four vendor-facing types to `NotificationType` and give each an entry in
   `TYPE_ICON`. Do **not** add `booking_fulfilled` / `booking_started`: those are
   booker-portal only and this app filters on `portal = 'vendor'`, so entries for
   them would be dead code implying a row that can never arrive.
2. **Give line 61 a fallback.** The exhaustive `Record` is a good *compile-time*
   guard, but the database can always emit a type newer than the installed binary —
   a shipped app cannot be recompiled by a migration. A generic bell glyph for an
   unrecognised type is correct behaviour; a crash is not. This is the durable fix;
   part 1 alone would leave the same trap for the next notification type added.

**Belongs in the safe prefix** — it depends on none of the decisions and fixes a
live crash.

---

## IMPORTANT

### I1 — Port the action copy table  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — Executed as stage 4.
> **Added:** `src/lib/bookingActionCopy.ts` (pure data + `actionCopy()` lookup; no
> React import) and `src/lib/bookingActionCopy.test.ts` (7 cases).
> **Verified (machine):** `tsc` exit 0 · `npm test` **50/50** (was 43) ·
> `expo lint` exit 0.
> **Verified (cross-repo):** wrote a throwaway comparison against
> `vendor/lib/bookingActionCopy.ts` normalising for line-wrapping — **all 5 keys,
> labels, meanings and patterns are identical**. The "word-for-word" claim in the
> file header is measured, not asserted.
> **Tested beyond the plan's ask,** deliberately: `actionCopy()` *throws* on an
> unknown key, so a table/type drift would surface as a crashed action bar rather
> than a failed build. The round-trip test turns that into a test failure. Also
> pinned two wording invariants that carry real meaning — that `vendor_fulfil` and
> `vendor_undo` still name the **3-day** window (a vendor reading them is asking
> "when does my money move"), and that `vendor_dispute` still says no payout is
> released. Those sentences can be reworded; they cannot be silently emptied.
> **Not included, by design:** which action applies to a given booking. That is
> derived from status + pattern and belongs with the component (I2), matching web.

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

### I2 — Decide-and-render the fulfilment action  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — Executed as stage 7, batched with I3.
> **Renamed:** `ApproveRejectBar/` -> `BookingActionBar/` (3 files, via `git mv` so
> history follows). One import site updated (`BookingDetail.tsx:4`).
> **Added:** `lib/bookingActionRules.ts` + tests (see below) ·
> `services/bookings.service.ts` gained `setStatus` + `markFulfilled` /
> `startCustody` / `confirmReturn` / `undoFulfilment` ·
> `hooks/useBookingActions.ts` gained `FulfilAction` and the `fulfil()` mutation.
> **Approve/reject preserved verbatim** — the `pending` branch, the
> `RejectReasonSheet` wiring and the 4-second deferred commit are untouched.
> **The terminal message no longer lies.** It used to read "This booking is
> {status}. No action needed." for every non-pending state. It now runs
> `statusLabel()` (so never "in_progress") and `disputed` gets its own sentence,
> since "no action needed" is wrong there — nobody but Command *can* act.
> **Verified (machine):** `tsc` exit 0 · `npm test` **70/70** (was 62) ·
> `expo lint` exit 0 · `expo export` exit 0 · grep confirms no inline `style={{}}`
> in the render layer and no stale `ApproveRejectBar` references.
> **⚠️ NOT verified:** that the actor-aware trigger accepts these writes from a
> mobile session. Web is proven; mobile is not. Needs a real booking on staging.

> **Extraction beyond the plan's letter, justified:** `fulfilActionFor` and the
> undo rule were pulled out of the component hook into `lib/bookingActionRules.ts`.
> Web keeps them inline in `useBookingRow`, but this app's `AGENTS.md` states that
> pure logic needing a test must live in its own module — `node --test` cannot load
> anything importing React. This is the map between what the UI offers and what
> `validate_booking_status_transition` will accept, so a wrong entry means a button
> guaranteed to fail. 12 of the 70 tests now cover it, including one asserting that
> **every** state the vendor cannot move offers no button at all.

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

**Approve and Reject are preserved exactly as they are.** This item *adds* a branch
for the fulfilment states; it must not touch the `pending` branch, the
`RejectReasonSheet` wiring, or the deferred-commit undo in `useBookingActions.ts`.
That deferral exists because `confirmed → pending` is illegal in the DB
(`useBookingActions.ts:15-30`) — regressing it would break approve's undo. The
existing `resolved` fallback text also stays, but only for states with genuinely no
action (`completed`, `cancelled`, `refunded`, `pending`-less terminals).

**Rename rationale:** the component no longer only approves and rejects. Leaving
the old name would mislead the next reader; it is a two-file rename with one import
site (`BookingDetail.tsx:4`).

---

### I3 — Undo  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — Executed as stage 7, batched with I2.
> Offered from `fulfilled` and `in_progress` only; **never from `returned`**, where
> the customer acted last — a test asserts that specifically.
> **Implemented as a plain forward write, as the plan required** — not the
> deferred-commit machinery `approve` uses. That machinery exists only because
> `confirmed -> pending` is illegal; every transition here is legal, so copying the
> timer would have added a second cache-patch path for nothing.
> **The B3 finding was applied.** `patchCache` writes `statusChangedAt` alongside
> `status` on both the optimistic patch and the revert — patching status alone
> would leave the countdown running from the *previous* transition, which is the
> defect that shipped in booker and then in vendor web (vendor web I23). The revert
> restores the **original** timestamp, captured before the patch, rather than null.
> **Double-tap guard:** a `working` flag disables both buttons in flight. Without
> it the second write would be rejected by the DB and the vendor would see an error
> for an action that actually succeeded.

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

### I4 — The "i" explanation, in a mobile idiom  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — Executed as stage 9.
> **Added:** `components/bookings/ActionInfoSheet/` — `ActionInfoSheet.tsx` +
> `ActionInfoSheet.styles.ts`.
> **Changed:** `useBookingActionBar.ts` (`infoFor` / `showInfo` / `hideInfo`) ·
> `BookingActionBar.tsx` (the "i" trigger + the sheet) ·
> `BookingActionBar.styles.ts` (`infoGlyph`).
> **Body is `copy.meaning` VERBATIM** — the whole reason the I1 table exists.
> Verified by grep: the sheet renders `{copy.meaning}` with no interpolation.
> **No companion hook, deliberately.** `ActionInfoSheet` holds no state — its
> visibility is owned by `useBookingActionBar` — so it is one of the pure display
> components the component-separation convention explicitly exempts. Adding an
> empty `useActionInfoSheet.ts` would satisfy the rule's letter and nothing else.
> **Styles mirror `RejectReasonSheet` exactly** (backdrop, sheet, grabber). Two
> sheets differing by a few points read as an inconsistency, not a distinction.
> **Accessibility:** the trigger is a full `MIN_TOUCH_TARGET` square, not an
> icon-sized tap area, and is labelled *"What does &lt;label&gt; mean?"* rather
> than "i". Dismissal is a tap on **"Got it"**, on the backdrop, or Android back —
> never gesture-only (`mobile-dev` §2).
> **State shape:** the hook holds the `BookingActionCopy` rather than a boolean, so
> one sheet serves every action instead of a flag per action plus a second lookup
> in the render layer.
> **Verified (machine):** `tsc` exit 0 · `npm test` 81/81 · `expo lint` exit 0 ·
> `expo export` exit 0 · no non-null assertions left in the bar.
> **⚠️ NOT device-verified.**

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

### I5 — Unpaid warning and confirm gate  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — Executed as stage 8, batched with I6.
> **Changed:** `useBookingActionBar.ts` (`unpaidWarning`, `needsUnpaidConfirm`,
> `confirmUnpaid` state) · `BookingActionBar.tsx` (amber warning line + a confirm
> panel) · `BookingActionBar.styles.ts` (`unpaid`, `confirm*`, `stack`, `barInStack`).
> **Warned, never blocked** — as specified. The warning shows on every fulfilment
> state; only the two `confirmed -> …` moves prompt. Verified by grep:
> `needsUnpaidConfirm = unpaidWarning && booking.status === "confirmed"`, so
> `returned -> completed` is untouched.
> **The confirm REPLACES the bar** rather than stacking above it, so exactly one
> question is on screen and the original button cannot be tapped while it is being
> asked about.
> **Verified (machine):** `tsc` exit 0 · `npm test` **81/81** · `expo lint` exit 0 ·
> `expo export` exit 0 · no inline `style={{}}` in the render layer.

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

### I6 — Auto-confirm countdown  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — Executed as stage 8, batched with I5.
> **Added:** `lib/autoConfirm.ts` + `lib/autoConfirm.test.ts` (11 cases).
> **Changed:** `useBookingActionBar.ts` · `BookingActionBar.tsx` · styles.
> **Verified (machine):** `tsc` exit 0 · `npm test` **81/81** (was 70) ·
> `expo lint` exit 0 · `expo export` exit 0.
> **⚠️ NOT device-verified.**

> **⚠️ The plan under-specified this one, and a literal reading would have shipped
> a lie (2026-08-02).** I6 said "`fulfilled` and `returned` auto-confirm after 3
> days". True of `20260801000006`, but **`20260801000009` added a service-date
> gate** that the plan never mentioned. The live rule is:
>
> ```sql
> status in ('fulfilled','returned')
>   and status_changed_at < now() - interval '3 days'
>   and (status = 'returned' or booked_date <= (now() at time zone 'Asia/Manila')::date)
> ```
>
> So a session booking marked done three weeks early will **not** auto-confirm for
> three weeks — the gate closes the exploit where a vendor marks work done early
> and lets the unattended timer release the payout. A flat "auto-confirms in 3
> days" there tells the vendor something the database will refuse to do, and when
> it silently doesn't happen they conclude the payout is stuck.
>
> `autoConfirmInfo()` implements the real rule: `due = max(changedAt + 3d,
> serviceDayStart)` for `fulfilled`, plain `changedAt + 3d` for `returned` (exempt,
> because reaching it required the *booker* to say the item came back — direct
> evidence, unlike a unilateral vendor claim). It returns a
> `waitingForServiceDate` flag so the copy can say *why* the wait is long rather
> than just printing a big number.
>
> Three further details the tests pin: `in_progress` gets **no** countdown (no
> timer exists); a null `status_changed_at` is **never** due, matching SQL's
> `null < …` semantics; and the service-date boundary is **00:00 Asia/Manila**, not
> UTC — 8 hours out otherwise, wrong only near midnight, which is the worst kind to
> debug. Days remaining are **ceiled**, so the counter never reads 0 while the
> booking is still waiting.

**Depends on:** B3 (`status_changed_at`)

`fulfilled` and `returned` auto-confirm after 3 days (`auto_acknowledge_bookings()`,
hourly). Show the days remaining so the vendor knows the money is not stuck.
`in_progress` has **no timer** — show no countdown there, or the app promises
something the database will never do.

**Trap from the web build (vendor web I23) — relocated by the B3 review.**
`useBookingsRealtime.ts` is **not** affected: it invalidates rather than patches, so
a refetch pulls `status_changed_at` with everything else. The equivalent risk lives
in `useBookingActions.ts` `patchCache()`, which writes optimistic partial updates —
patching `status` without `statusChangedAt` there freezes the countdown at its
previous value. See the correction recorded under B3.

---

### I7 — Status labels and colours for the four new states  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — Executed as stage 5.
> **Changed:** `lib/format.ts` (new `STATUS_LABEL` + `statusLabel()`) ·
> `theme/tokens.ts` (`STATUS` grew from 5 to 9 entries) ·
> `BookingListItem.tsx`, `BookingDetail.tsx`, `TransactionListItem.tsx` (all three
> now call `statusLabel()`) · `lib/format.test.ts` (+4 cases).
> **The bug was worse than "no label".** Three surfaces were capitalising the raw
> column — `BookingListItem.tsx:70`, `BookingDetail.tsx:47`,
> `TransactionListItem.tsx:48` — so the new statuses rendered as **"In_progress"**.
> A fourth site, `BookingListItem.tsx:36`, fed the raw value to
> `accessibilityLabel`, so a screen reader announced it too. All four fixed.
> **Removed:** the now-dead local `capitalise()` helper in `BookingListItem.tsx`.
> **Verified (machine):** `tsc` exit 0 · `npm test` **54/54** (was 50) ·
> `expo lint` exit 0 · `expo export` exit 0.
> **Verified (cross-repo, measured):** compared both maps against
> `vendor/lib/utils.ts` — **all nine colours (bg + fg) identical**, and **all nine
> labels identical**.
> **⚠️ NOT device-verified.** This is the first stage that changes what a vendor
> sees. Screenshot required before it can be called finished — machine checks
> cannot see a pill that is unreadable on one theme.

> **⚠️ Correction — the mockup's proposed colours were wrong (2026-08-02).**
> The review artifact proposed `#14b8a6` fulfilled · `#0ea5e9` in_progress ·
> `#f97316` returned · `#e11d48` disputed. **None of those four matched web**,
> which already had all nine statuses in `statusStyle()`. Web's values shipped
> instead, because parity is the point and its hue system is documented and
> coherent (`vendor/lib/utils.ts:9-11`): *amber = waiting on the vendor,
> cyan/violet = waiting on the booker, blue = settled, orange = needs attention,
> red/indigo = ended.* Actual values now in both clients:
> `fulfilled #06b6d4` · `in_progress #8b5cf6` · `returned #14b8a6` ·
> `disputed #f97316`.
>
> **The label for `returned` also differs from the plan.** I7 originally said
> "Got it back", taken from `architecture/booking-flow.md:345-349` — but that table
> lists **the action each party takes**, not the pill text. Web's `STATUS_LABEL`
> says **"Confirm return"**, and that is correct: the pill states where the booking
> is, the button states what tapping it does. Putting a call to action inside a
> read-only badge would be a real UX defect. A test now pins the distinction.

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

### I8 — Filter tabs omit every new state  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — Executed as stage 6.
> **Added:** `lib/bookingFilters.ts` (port of web's `BOOKING_FILTERS` +
> `statusesForFilter` + `bookingMatchesFilter`) and `lib/bookingFilters.test.ts`
> (8 cases).
> **Changed:** `hooks/useBookingsQuery.ts` · `services/bookings.service.ts` ·
> `BookingFilterTabs.tsx` · `BookingsList/useBookingsList.ts` ·
> `DashboardView/useDashboardView.ts`.
> **All three coupled changes landed** — the ones the original wording would have
> let an implementer skip:
> 1. `BookingFilter` is no longer an alias of `BookingStatus | "all"`; it is
>    `BookingFilterKey`.
> 2. The service filters with **`.in()`**, guarded by `statuses.length > 0` —
>    `status=in.()` matches zero rows, so an unguarded empty array would have
>    rendered "All" as an empty list.
> 3. The query key changed shape, deliberately preserving the
>    `["bookings", vendorId]` **prefix** — `useBookingsRealtime` and
>    `useBookingActions` both invalidate on it, so every cached status combination
>    still refreshes together.
> **Verified (machine):** `tsc` exit 0 · `npm test` **62/62** (was 54) ·
> `expo lint` exit 0 · `expo export` exit 0.
> **Verified (cross-repo, measured):** all six keys, labels and status sets are
> **identical** to `vendor/lib/utils.ts`.
> **`flexGrow` trap — not re-opened.** The fix is already in
> `BookingFilterTabs.styles.ts:52` with a comment saying not to remove it, and this
> stage did not touch the styles file. Six chips scroll where five did.
> **⚠️ NOT device-verified.** Screenshot needed, and this is the component with the
> build-cycle-costing trap on record.

> **⚠️ Design decision forced mid-stage: the dashboard must NOT use a group
> (2026-08-02).** Widening the filter broke two call sites that defaulted to
> `"pending"`, which is no longer a filter key. `useBookingsList` maps cleanly to
> `needs_you`. The dashboard preview does **not**:
> its card is labelled **"Pending Approvals"**, its count is
> `countBookings(... .eq("status","pending"))` (`dashboard.service.ts:97`), and its
> empty state reads *"Nothing needs your approval right now."* The `needs_you`
> group also contains `returned`, so using it there would have listed
> return-confirmations under an approvals heading **and** made the list disagree
> with the number printed directly above it.
>
> Resolved by making `useBookingsQuery` take an explicit `BookingStatus[]` instead
> of a filter key. The grouping stays a UI concern in `useBookingsList`; the
> dashboard passes a module-level `PENDING_ONLY` constant (module-level so it is
> not a fresh array — and therefore a fresh query key — on every render).
>
> **Consequence to note:** the old comment claiming the dashboard and Bookings tab
> "can never show a different pending list" no longer holds, because the tab has no
> pending-only filter any more. They now share a cache *prefix*, not a query. The
> comment was rewritten rather than left to mislead.

**File:** `src/components/bookings/BookingFilterTabs/BookingFilterTabs.tsx:9-15`

Five filters (`pending, confirmed, completed, cancelled, all`). A booking in
`fulfilled`, `in_progress`, `returned` or `disputed` is reachable only under "All".

Do **not** add four more chips — nine chips in a horizontal strip is a scroll bar,
not a filter. **Resolved (D5): port web's six lifecycle groups verbatim** into a new
pure module `src/lib/bookingFilters.ts` (`BookingFilterKey`, `BOOKING_FILTERS`,
`bookingMatchesFilter`). Exact mapping and rationale are recorded at D5.

**⚠️ The 2026-08-02 review found this item hid three coupled changes.** The original
wording ("use lifecycle groups") could have been satisfied by editing the chip
labels alone, which would silently break filtering. All three are required:

1. **`BookingFilter` is currently `BookingStatus | "all"`**
   (`useBookingsQuery.ts:11`) — the filter type *is* the status type. Two
   consequences: widening `BookingStatus` in **B2 silently widens `BookingFilter`
   too**, and a group is not a status, so `BookingFilter` must become its own type
   with an explicit group → `BookingStatus[]` map.
2. **The service filters with `.eq()`** — `bookings.service.ts:100` is
   `query.eq("status", status)`. A group needs `.in("status", statuses)`. Missing
   this yields a filter that matches nothing.
3. **The filter is part of the persisted query key.** `bookingsQueryKey()`
   (`:13-17`) returns `["bookings", vendorId, filter]`, and `"bookings"` is in
   `PERSISTED_KEYS` so the list survives a cold start (D11). Renaming filter keys
   orphans the cache entries written under the old names — not a crash, but the
   first launch after upgrade refetches instead of restoring. Acceptable; note it
   so it is not mistaken for a bug.

**Trap:** `BookingFilterTabs` is the component that already cost a build cycle to
the horizontal-`ScrollView` `flexGrow` bug (app `AGENTS.md`, Traps). Any change here
needs a device screenshot, not a type-check.

---

### I9 — Flag ("Something's wrong")  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — Executed as stage 10, the last functional stage.
> **Changed:** `services/bookings.service.ts` (`raiseDispute`) ·
> `lib/bookingActionRules.ts` (`canFlag`, `MIN_DISPUTE_REASON`) + tests ·
> `hooks/useBookingActions.ts` (`flag`) · `RejectReasonSheet` **generalised**
> (both files) · `useBookingActionBar.ts` · `BookingActionBar.tsx` + styles ·
> `BookingDetail` (both files).
> **Verified (machine):** `tsc` exit 0 · `npm test` **85/85** (was 81) ·
> `expo lint` exit 0 · `expo export` exit 0.
> **⚠️ NOT device-verified**, and the RPC has never been called from mobile.

> **Verified against the trigger, not against the plan.** I9 said flagging is
> offered from `fulfilled`, `in_progress`, `returned`, `completed`. Rather than
> trust that, I read `validate_booking_status_transition` (`20260801000002:120-140`)
> and confirmed those are **exactly** the four `old.status` branches permitting
> `-> disputed` for a vendor. A test now pins the set, so a future edit that adds
> `confirmed` gets a failure instead of a button that always errors.

> **⚠️ `completed` needed a structural change the plan did not anticipate.** It is
> flaggable, but it fell into the dead-end "no action needed" branch — so a vendor
> whose customer returned a damaged item after the booking closed had **no recourse
> on their phone**. The action branch's condition now includes `flagCopy`, and when
> there is nothing to advance it renders "This booking is completed. Flag it if
> something went wrong." instead of the old "No action needed", which was false.

> **`RejectReasonSheet` was generalised, not cloned.** It gained optional
> `title` / `body` / `placeholder` / `confirmLabel` / `cancelLabel` /
> `confirmHint` / `minLength` props, **every one defaulting to the reject wording**,
> so the original call site is untouched. The flag path passes
> `minLength = MIN_DISPUTE_REASON` (10), matching the server: the RPC raises
> *"Please describe the problem in at least 10 characters"*, and validating
> client-side turns that raw Postgres exception into a disabled button.

> **Flag is deliberately NOT optimistic**, unlike the other mutations. The RPC can
> refuse for reasons the client cannot predict — an open flag already exists, the
> account is inactive — and showing "On hold" before the server agrees would tell a
> vendor their payout is frozen when it is not. On failure it surfaces the RPC's
> own message, which is written for humans, rather than a generic retry line.

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

<!-- D1–D4 resolved 2026-08-02. D5 was raised by the 2026-08-02 plan review and
     resolved the same day. No OPEN lines remain — the plan is clear to execute
     once the user approves. -->

- **D5 — Which filter chips? (I8)** → **(a) Exact web parity, all six groups**
  (resolved 2026-08-02).

  **Correction from the review:** an earlier draft of this decision proposed five
  groups and folded `cancelled`/`refunded` into `Issues`. That misread the web
  source. `vendor/lib/utils.ts:60-69` defines **six** keys, and `issues` is
  `["disputed"]` **alone**:

  ```ts
  export type BookingFilterKey = "all" | "needs_you" | "active" | "done" | "issues" | "closed"

  export const BOOKING_FILTERS: { key: BookingFilterKey; label: string; statuses: BookingStatus[] }[] = [
    { key: "all",       label: "All",       statuses: [] },  // empty = no filter
    { key: "needs_you", label: "Needs you", statuses: ["pending", "returned"] },
    { key: "active",    label: "Active",    statuses: ["confirmed", "fulfilled", "in_progress"] },
    { key: "done",      label: "Done",      statuses: ["completed"] },
    { key: "issues",    label: "Issues",    statuses: ["disputed"] },
    { key: "closed",    label: "Closed",    statuses: ["cancelled", "refunded"] },
  ]
  ```

  **The decisive evidence** is the comment directly above it (`:58-59`):

  > *"Exported (not inlined in BookingsPage) because ezzy-vendor-mobile's
  > `BookingFilterTabs` needs the same grouping and a second copy would drift."*

  The web portal was written in anticipation of exactly this port. Diverging is the
  outcome that comment exists to prevent.

  **Copy, do not import** — separate repos with no shared build tooling; types and
  tables are copied and adapted across repos (`mobile-dev` §1, root `AGENTS.md`).
  Port `BookingFilterKey`, `BOOKING_FILTERS` and `bookingMatchesFilter()` into
  `src/lib/bookingFilters.ts` as a pure module (no React import), so it is unit
  testable under `node --test` like `vendorMapping.ts`.

  **Accepted cost:** six chips means the strip scrolls horizontally on narrow
  phones. That is the component with the `flexGrow` trap on record — a device
  screenshot is mandatory here, not a type-check.

  **`Needs you` carries the badge** — `pending` + `returned` are the two states
  where the vendor is the blocker. Web badges `needs_you` and `issues`; mirror that.

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

- **I10 — filter chips carry no badge.** ✅ DONE (2026-08-02, stage 11)
  > **Added:** `hooks/useBookingFilterCounts.ts` ·
  > `services/bookings.service.ts` `countBookingsWithStatuses()` ·
  > `lib/bookingFilters.ts` `BADGED_FILTERS` + 4 tests.
  > **Changed:** `BookingFilterTabs` (+ styles) · `BookingsList` (both files) ·
  > `useBookingActions.ts` (see the staleness note below).
  > **Verified (machine):** `tsc` exit 0 · `npm test` **89/89** (was 85) ·
  > `expo lint` exit 0 · `expo export` exit 0.
  > **Verified (live, local DB):** ran the two count queries as SQL — `needs_you`
  > = 1, `issues` = 2, of 42 bookings. Both badges have non-zero fixtures.
  > **Counted server-side**, one `head: true` request per badged chip, for the
  > reason recorded when this item was raised: the list is paged, so counting the
  > loaded pages would under-report work waiting on the vendor.
  > **Only `needs_you` and `issues` badge**, matching web. "Done" and "Closed" are
  > history; a number there is not actionable. Zero is never rendered — "0 need
  > you" is worse than nothing.
  > **Staleness fixed, not ignored:** the optimistic `patchCache` moves a row but
  > cannot move a COUNT, so the badges would have kept showing the pre-action
  > number until something else refetched. `fulfil` now calls `invalidate()` on
  > success — the patch gives instant feedback, the invalidate reconciles
  > everything derived from the set. The counts query shares the
  > `["bookings", vendorId]` prefix so realtime and the action hook refresh it
  > without knowing it exists.
  > **`chip` gained `flexDirection: "row"`.** Checked first that the active
  > gradient is `position: "absolute"` and therefore out of flow, so this cannot
  > disturb the sizing that `CHIP_HEIGHT` and the ScrollView's `flexGrow: 0`
  > depend on — this being the component with the build-cycle trap on record.
  > **⚠️ NOT device-verified.**

  <!-- original finding, kept for the record -->
  D5 recorded that "Needs you" should badge, mirroring web, which badges
  `needs_you` and `issues`. **It was not implemented, because mobile cannot
  compute it the way web does.** Web fetches every booking and counts in memory;
  this app fetches **one page at a time** for infinite scroll, so the client never
  holds the full set and a count taken from the loaded pages would be wrong — and
  wrong in the worst direction, silently under-reporting work waiting on the
  vendor.
  **Fix approach:** two `head: true, count: "exact"` queries with `.in("status", …)`,
  following the existing `countBookings()` helper in `dashboard.service.ts:95-97`.
  Cheap, but it is a new fetch on a screen that currently makes one, so it belongs
  in its own item rather than smuggled into I8.

- **D6 — `vendor` web has the same `NotificationType` gap.** ✅ DONE (2026-08-02)
  > **Unparked with explicit user approval** to widen scope to `vendor` — the
  > cross-app gate this item was parked behind.
  > **Changed:** `vendor/lib/types.ts` (union widened by the same four
  > vendor-portal types) · `vendor/components/layout/NotificationPanel/NotificationItem.tsx`
  > (four `TYPE_ICON` entries + an `UNKNOWN_TYPE` fallback).
  > **Verified (machine):** `tsc --noEmit` exit 0 · `npm run build` exit 0.
  > **Verified (cross-repo, measured):** the four new entries are **identical** on
  > both clients — same icon component and same colour
  > (`PackageCheck` #f97316 · `CircleDollarSign` #3b82f6 · `TriangleAlert` #e11d48
  > · `ShieldCheck` #10b981), and the two `NotificationType` unions now match
  > exactly. The Tailwind classes were chosen because they resolve to those precise
  > hexes, not by eye.
  > **Icon names checked against `lucide-react` 0.468 before use.** That version
  > predates the v1 rename, which is why the file's existing imports are legacy
  > aliases (`CheckCircle2`, `AlertCircle`) — but it exports the canonical v1 names
  > too, so all four new icons resolve under the same names mobile uses.
  > **Fallback added, cosmetic here rather than load-bearing.** On mobile the
  > equivalent lookup was destructured and an unknown type threw, taking the screen
  > down. React renders `undefined` as nothing, so web only lost a glyph. Added
  > anyway: a migration can add a type before this app is redeployed, and a row
  > with no icon reads as a rendering bug rather than a new kind of event.
  > **No visual baselines affected** — checked: `/ui-gallery` does not render the
  > notification panel and `visual-tests/` has no notification coverage, so no
  > regeneration is needed.
  > **⚠️ NOT verified in a browser.** No notification of these types has been
  > rendered by this app.

  <!-- original finding, kept for the record -->
  Found while executing B4. `vendor/lib/types.ts:112-119` is missing the same four
  fulfilment types, and `NotificationPanel/NotificationItem.tsx:39` looks them up in
  its own `TYPE_ICON`. **It does not crash there** — that lookup is rendered as
  `{TYPE_ICON[n.type]}` inside a `<span>`, and React renders `undefined` as nothing.
  So web silently drops the glyph while mobile threw. Cosmetic, not a defect of
  correctness.
  **Why parked:** this plan is scoped to `ezzy-vendor-mobile` only, and touching
  `vendor` would make it a cross-app change (an approval gate under root
  `AGENTS.md`). **Unblock:** fix in its own small change — add the four union
  members and four `TYPE_ICON` entries, mirroring the glyphs and colours now in
  mobile so the two clients keep showing the same signal.

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

1. **B4** — the notification crash. Independent of everything else and fixes a
   defect that is live right now. First.
2. **B2 + B1 together** — widen the union, which breaks the build, which forces the
   payable rewrite. Landing B2 alone leaves `tsc` red; landing B1 alone discards the
   safeguard. One batch.
3. **B3** — add the three columns. Nothing below works without them.
4. **I1** — copy table. Pure data, no dependencies.
5. **I7** — labels and colours. Makes the new states legible.
6. **I8** — filter grouping, six groups ported from web (D5).
7. **I2 + I3** — the action bar and undo. The core of the request.
8. **I5 + I6** — unpaid gate and countdown. Both depend on B3 and on I2 existing.
9. **I4** — the `ActionInfoSheet` bottom sheet (D1).
10. **I9** — flag, on a generalised `RejectReasonSheet` (D2).
11. Mark the superseded plan ✖ ABORTED.

Steps 1–5 are the safe prefix: they fix a live crash and the money bug, and depend
on no open decision. **They could start immediately** while D5 is settled.

---

## Verification

**Machine-verifiable:**
- `ezzy-vendor-mobile/node_modules/.bin/tsc --noEmit --project ezzy-vendor-mobile/tsconfig.json` — must be 0. Use the binary directly; `npm exec tsc` hangs (app `AGENTS.md`).
- `npm --prefix ezzy-vendor-mobile run lint` — 0.
- `npm --prefix ezzy-vendor-mobile test` — `node --test`. **B1's rule is pure logic and belongs in its own module** so the existing `format.test.ts` can cover it without importing `lib/supabase/client` (app `AGENTS.md`, Traps). Update `format.test.ts:22` and `:38`, which currently assert `isPayable("confirmed") === true` — the assertion encoding the bug.
- `npx expo export --platform android` — proves the route tree builds; delete `dist/`.

**Regression checks — what must still work afterwards.** This plan touches shared
types and a shared component, so verify the untouched features explicitly:
- **Approve / Reject** still work from `pending`, including the 4-second deferred
  undo and the reason sheet (I2 must not alter that branch).
- **Transactions list** still renders its booking-status pill and its
  strikethrough-with-reason for non-payable rows (B1's embed correction).
- **Notifications** still render every pre-existing type, with the new four added
  and an unknown type degrading rather than crashing (B4).
- **Cold-start restore** of the bookings list still works after the filter keys
  change (I8) — expect one refetch on first launch, not a persistent failure.

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

---

## What remains (2026-08-02)

All 11 stages executed. `tsc`, `expo lint`, `npm test` (**89 passing**) and
`expo export --platform android` are clean after every stage, and parity with the
web portal was **measured** rather than asserted for the action copy, the status
labels, the status colours and the filter groups.

**Not verified, and not verifiable from here:**

| # | What | Why it needs a person |
|---|---|---|
| 1 | The actor-aware trigger accepts these writes **from a mobile session** | Web is proven; this client has never written a fulfilment status. `validate_booking_status_transition` branches on who the caller is. |
| 2 | `raise_booking_dispute` succeeds from this client | The RPC has never been called from mobile. It can refuse for reasons the client cannot predict. |
| 3 | I7 — status pills legible in both themes | One shared colour map serves light and dark. |
| 4 | I8 — six chips in a strip that previously cost a build cycle to the `flexGrow` trap | `chip` gained `flexDirection: "row"` in I10. |
| 5 | I2/I3/I5/I6 — the action bar, banners and the doubled-divider fix | `barInStack` exists precisely because nesting doubled a hairline. Machine checks cannot see that. |
| 6 | I4 — the info sheet | New component. |
| 7 | I10 — the badge inside the chip | New inline element in the trap component. |

The app's own `AGENTS.md` is explicit that four style passes across two earlier
plans shipped changes which `tsc`, lint, tests and export all approved and which
**did nothing on screen**. Treat this list as the real remaining work, not as
paperwork.

**Suggested order on device:** a confirmed *custody* booking (Hand over → Undo →
Hand over), then a *session* one (Mark as done, and check the countdown wording),
then a `returned` booking (Got it back), then flag something. The local database
has **15 custody / 27 session** bookings, one unpaid, so every branch has a
fixture.

**D6 is now closed** (2026-08-02) — vendor web's matching `NotificationType` gap
was fixed with explicit approval to widen scope to that app. `tsc` and
`npm run build` are clean there, and the four new entries were verified identical
across both clients by measurement. Not yet seen in a browser.

**Nothing is parked or aborted with work outstanding.** The only items not marked
✅ are the two aborted/superseded plans, which carry their reasons.
