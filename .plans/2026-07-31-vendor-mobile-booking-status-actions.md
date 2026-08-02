# Ezzy Vendor Mobile — booking status actions on the detail screen

**Date:** 2026-07-31
**App / scope:** `ezzy-vendor-mobile` — `src/components/bookings/`, `src/hooks/useBookingActions.ts`, `src/services/bookings.service.ts`
**Status:** ✖ **ABORTED (2026-08-02)** — superseded by
`.plans/2026-08-02-vendor-mobile-fulfilment-sync.md`, which shipped this scope
correctly. Never executed; no code was written from it.

> **Why it was aborted.** This plan was written on 2026-07-31, **one day before**
> the dual-acknowledgement feature landed (2026-08-01). It is not merely
> incomplete — its central proposal is now *illegal*, so executing it would have
> produced buttons that fail against the database:
>
> - **D1 offers `confirmed → completed`.** That transition no longer exists.
>   `validate_booking_status_transition` (`20260801000002`) routes `confirmed` to
>   `fulfilled` (session) or `in_progress` (custody), and `completed` is reachable
>   only by mutual acknowledgement or the 3-day timer. A vendor cannot write
>   `completed` directly from `confirmed` at all.
> - **D4 asks whether it is acceptable for mobile to LEAD the web portal.** The
>   premise inverted: vendor web shipped the full fulfilment actions on
>   2026-08-01, so mobile *lagged*. The question it wanted answered was moot.
> - **D3's recommendation rested on a constraint that had changed.** It argued
>   against storing a cancellation note because `booking_status_log.notes` was
>   written by the trigger from `NEW.rejection_reason`; `20260801000002` rewrote
>   `log_booking_status_change()` to write `notes` directly.
>
> **D2 was the one part that survived** — it argued, correctly and strongly, that
> `completed → refunded` must not ship as a status-only button because no refund
> mechanism exists. That is still true, and the superseding plan keeps refunds
> explicitly out of scope for the same reason.
>
> Kept rather than deleted, per the status model: the reasoning above is the record
> of *why* a plan that looked ready was not.

> Add the missing booking status transitions to the detail screen. **Approve and
> Reject already exist and are wired** — the real gap is every other transition the
> database allows.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app and plan.

**Scope:** vendor-initiated booking status changes from the mobile detail screen.
**Out of scope:** the bookings *list* (no inline actions), the booker app, the vendor
web portal, and anything that moves money.

---

## 0. Investigation record

### Approve / Reject is already built, wired, and rendering

This is the "already handled" category from plan-authoring §4 — do not rebuild it.

| Piece | Location |
|---|---|
| Buttons + reason sheet | `ApproveRejectBar/ApproveRejectBar.tsx:38-70` |
| Sheet open/close state | `ApproveRejectBar/useApproveRejectBar.ts` |
| Reason capture | `RejectReasonSheet/` (full trio) |
| Mounted on the detail screen | `BookingDetail/BookingDetail.tsx:80` |
| Mutations, undo, cache patching, haptics | `hooks/useBookingActions.ts` |
| Writes | `services/bookings.service.ts:144-168` |
| Row is tappable → pushes the detail route | `BookingListItem.tsx:33-34`, `useBookingsList.ts:44-50` |

So the literal request — *"buttons to either approve it or not"* — is **already
implemented** for `pending` bookings. **B1 establishes whether it is actually visible on
device before anything is built**, because the plausible readings lead to completely
different work.

### What the database actually allows

`backbone/supabase/migrations/20260516000004_booking_status_transition.sql:29-31`:

```sql
if old.status = 'pending'   and new.status in ('confirmed', 'cancelled') then return new; end if;
if old.status = 'confirmed' and new.status in ('completed', 'cancelled') then return new; end if;
if old.status = 'completed' and new.status = 'refunded'                  then return new; end if;
```

Against what mobile implements:

| Transition | DB | Mobile today | Gap |
|---|---|---|---|
| `pending → confirmed` (Approve) | ✅ | ✅ built | — |
| `pending → cancelled` (Reject, with reason) | ✅ | ✅ built | — |
| `confirmed → completed` | ✅ | ❌ | **I1** |
| `confirmed → cancelled` (vendor cancels) | ✅ | ❌ | **I2** |
| `completed → refunded` | ✅ | ❌ | **D2 — recommend deferring** |

**This is the real gap.** For any non-pending booking the bar currently renders
*"This booking is `confirmed`. No action needed."* (`ApproveRejectBar.tsx:28-32`) — which
is **factually wrong**: two actions are available. That copy is almost certainly what
prompted this request.

### The notification trigger makes "cancel" and "reject" different writes — non-obvious

`20260525000003_notification_triggers.sql:131-181` branches on the **rejection reason**,
not on the source status:

| Condition | Booker notification |
|---|---|
| `pending → confirmed` | `booking_confirmed` |
| `→ cancelled` **and `rejection_reason <> ''`** | `booking_rejected` |
| `confirmed → cancelled` **and `rejection_reason = ''`** | `booking_cancelled` |

**Consequence:** cancelling a confirmed booking must write an **empty**
`rejection_reason`. Reusing `rejectBooking()` (`bookings.service.ts:152`, which always
writes a non-empty reason) would tell the booker their booking was *rejected* when the
vendor merely *cancelled* it. I2 needs its own service function, not a parameter tweak.

`completed` and `refunded` have **no notification branch at all** — those transitions are
silent to the booker by design.

### Undo is not free — the DB forbids the compensating write

`useBookingActions.ts:15-27` documents why Approve **defers** its write for 4s rather
than writing then reversing: `confirmed → pending` is not a legal transition, so a
compensating update would be rejected and the UI would claim an undo that never
happened. The same applies to both new actions:

| New action | Reverse | Legal? | Therefore |
|---|---|---|---|
| `confirmed → completed` | `completed → confirmed` | ❌ | must defer, exactly like Approve |
| `confirmed → cancelled` | `cancelled → confirmed` | ❌ | must defer **or** confirm up front |

Reject sidesteps this because its reason sheet is already a deliberate confirmation step
(`useBookingActions.ts:25-26`). Cancel has no sheet, so it needs one or the other — **D3**.

### Already handled, needs no work

- **Audit trail.** `booking_status_log` is written by an AFTER UPDATE trigger
  (`20260516000006_booking_status_log.sql`), insert is trigger-only. New transitions are
  logged automatically — no client work.
- **RLS.** `20260507000004_bookings.sql:141-152` lets a `vendor-admin` update any booking
  for their vendor, with no per-status restriction. **No policy or grant change is
  needed**, so this plan has **no schema change and no approval gate** under AGENTS.md.
- **Cache + offline + haptics + snackbar.** `useBookingActions.ts` already patches every
  cached page and the detail cache, flushes deferred writes on background/unmount, and
  classifies `StaleBookingError`. New actions reuse it.

### Cross-check against the rest of the ecosystem

- **`cancelled_by`** (`20260516000005`) must be set on any cancellation.
  `rejectBooking()` does it; a new cancel path must too or the audit trail loses the actor.
- **Vendor web has none of these actions either.** `vendor/components/bookings/BookingRow/BookingRow.tsx:36`
  gates its only actions on `b.status === "pending"`. Shipping I1/I2 puts **mobile ahead
  of the web portal** — a deliberate divergence, so it is **D4**, not a silent choice.
- **Nothing in any app ever writes `refunded`.** A `grep` for "refund" across `vendor/`,
  `booker/`, `backbone/` and this app finds only *display* code (transaction summaries,
  formatters, the status colour map). There is no refund initiation flow anywhere —
  which is the core argument for **D2**.
- `architecture/booking-flow.md` documents the booker-side wizard through payment; it
  does not specify vendor-side post-confirmation transitions, so this plan does not
  contradict it. It should gain a short section — **I5**.

---

## BLOCKERS

### B1 — Confirm what the detail screen actually shows today  ⬜ TODO

**Files:** none — one observation, before any code.

The request says the buttons are missing; the code says they are mounted at
`BookingDetail.tsx:80`. Both can be true, and the readings need different work:

1. **You opened a `confirmed`/`completed` booking** → you saw *"No action needed."* The
   plan as written (I1–I3) is exactly right.
2. **You opened the `pending` booking from the screenshot and saw no buttons** → there is
   a *rendering* defect and I1–I3 would build on broken ground. Fix that first.
3. **Tapping the row did nothing** → a navigation defect; nothing in this plan applies.

**Why this is a blocker and not an assumption:** the filter-strip work immediately
preceding this plan spent three passes on a wrong root cause because a layout claim was
reasoned rather than observed. `BookingDetail.styles.ts:7-10` (`wrapper: { flex: 1,
justifyContent: "space-between" }`) plus a vertical `ScrollView` **looks** correct — the
`flexGrow: 1` trap that broke `BookingFilterTabs` applies to horizontal scrollers and
this one is vertical — but "looks correct" is precisely the reasoning that just failed.

**How to settle it:** open a **pending** booking and a **confirmed** one, and say what
each shows. A photo settles it faster than any amount of code reading.

---

## IMPORTANT

### I1 — `confirmed → completed` has no action  ⬜ TODO

**Files:** `ApproveRejectBar.tsx:28-32`, `useBookingActions.ts`, `bookings.service.ts:144`

A vendor cannot mark a delivered booking complete from mobile, though the DB allows it
and completion is what unlocks `completed → refunded` later.

**Fix approach:** `completeBooking(id)` in the service (a plain status update — no
reason, no `cancelled_by`); a `complete` action in `useBookingActions` reusing the
**deferred-write + Undo** pattern from `approve` (`useBookingActions.ts:120-160`), since
`completed → confirmed` is illegal; a "Mark completed" button surfaced by the action map
in I3.

**Verification:** machine — `tsc`, lint, `expo export`. Live — approve a booking, mark it
completed, confirm the row moves to the Completed filter and Undo inside 4s puts it back.

### I2 — `confirmed → cancelled` has no action, and must not reuse `rejectBooking`  ⬜ TODO

**Files:** `bookings.service.ts:152-168`, `useBookingActions.ts:162-176`

A vendor who needs to cancel a booking they already confirmed has no way to do it.

**The trap, restated because it is the whole item:** `rejectBooking()` always writes a
non-empty `rejection_reason`, which makes the trigger emit `booking_rejected`. A vendor
cancellation must emit `booking_cancelled`, which requires `rejection_reason = ''`
(`20260525000003_notification_triggers.sql:156,180`).

**Fix approach:** a separate `cancelBooking(id)` that writes
`{ status: 'cancelled', rejection_reason: '', cancelled_by: user.id }`. It must set
`cancelled_by` — same reason `rejectBooking` does. Whether the vendor is asked for a
reason is **D3**, and the answer is constrained: any reason captured here **must not** be
written to `rejection_reason`, or the booker gets the wrong notification.

**Coupled to D3.** Do not implement before D3 resolves.

**Verification:** machine — `tsc`, lint, unit test on the action map (I3). Live — cancel
a confirmed booking and verify the **booker** receives `booking_cancelled`, not
`booking_rejected`. This is the one check that cannot be done from the vendor app alone
and is the item's real acceptance criterion.

### I3 — Replace the status branch with an explicit transition map, and fix the false copy  ⬜ TODO

**File:** `ApproveRejectBar.tsx:26-36`

Today the component hard-codes "pending ⇒ two buttons, everything else ⇒ *no action
needed*". With two more transitions that becomes a nest of conditionals, and the copy is
already wrong for `confirmed`.

**Fix approach:** a module-level
`Record<BookingStatus, BookingAction[]>` mirroring the trigger's table — one place where
client and database agree on what is legal, so a future transition is a one-line edit
rather than another branch. `Record` (not a partial map or a switch) so adding a member
to `BookingStatus` is a compile error, matching the existing pattern in
`NotificationListItem.tsx:30` and `useBookingsList.ts:9`.

Terminal statuses (`cancelled`, `refunded`) keep a resolved message — but the current
copy must stop claiming "No action needed" for statuses that *do* have actions.

**Component separation** (`.claude/skills/component-separation/SKILL.md`): the trio
already exists. The map is static data → module scope in the `.tsx`, alongside
`TYPE_ICON`'s precedent. Button styling → `.styles.ts` (`approve`/`reject` styles exist;
add neutral + destructive variants). Any new state → `useApproveRejectBar.ts`. **No new
component**, so no new hook file. Renaming the component is **D5**.

**Verification:** machine — the map is pure data and belongs in a `node --test` unit test
(`services/`-style, per AGENTS.md's "pure logic that needs a test must live in its own
module"), asserting it matches the DB's five legal transitions exactly.

### I4 — Destructive actions need a confirmation step  ⬜ TODO — gated on D3

**File:** `ApproveRejectBar.tsx`

Per `.claude/skills/ux-design/SKILL.md`, cancelling a confirmed booking is destructive
and irreversible at the database level. Approve's 4s Undo is the existing pattern for
"reversible-feeling"; Reject's sheet is the pattern for "confirm first".

**Fix approach:** follows from D3. Whichever is chosen, "Mark completed" and "Cancel
booking" must not sit adjacent as identical-weight buttons — a mis-tap between them is
unrecoverable.

### I5 — Document the vendor-side transitions  ⬜ TODO

**File:** `architecture/booking-flow.md`

The doc covers the booker wizard through payment and stops. The vendor-side lifecycle
(who may move a booking where, and which notification each transition emits) is currently
only discoverable by reading three migrations.

**Fix approach:** a short "Vendor-side status transitions" section with the transition
table and the notification mapping, cross-referencing the two migrations. Also note in
`ezzy-vendor-mobile/AGENTS.md` that mobile leads web here (D4).

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains — §7. -->

### OPEN: D1 — Which transitions ship?

- **(a) `confirmed → completed` and `confirmed → cancelled`** *(recommended)* — the two
  the vendor plainly needs, both legal, neither touching money.
- **(b) Only `confirmed → cancelled`** — smallest change if completion should be
  automatic rather than manual (see D6).
- **(c) All three, including `completed → refunded`** — see D2 before choosing this.

### OPEN: D2 — Does `completed → refunded` ship?

- **(a) No — defer it** *(strongly recommended)* — a refund is a **money movement**, and
  nothing in any app writes `refunded` today. A button that flips the status without
  moving funds creates a booking the system believes is refunded while the booker has
  been paid nothing. That is a financial-integrity bug, not a UI gap, and it needs a
  payment-provider path (`booking_transactions`, PayMongo) designed first.
- **(b) Yes, status-only, with explicit copy that no money moves** — only if you have an
  out-of-band refund process today and need the record to reflect it. Say so and I will
  scope it properly rather than bolt it on.

### OPEN: D3 — Does cancelling a confirmed booking ask for a reason?

Constrained by the trigger: whatever is collected **cannot** go in `rejection_reason`
without turning the booker's notification into `booking_rejected`.

- **(a) Confirm-only dialog, no reason** *(recommended)* — an `Alert` "Cancel this
  booking?", writing `rejection_reason = ''`. Matches the DB's evident intent — the
  `= ''` branch exists precisely to represent a vendor cancellation — and needs no
  schema change.
- **(b) Reuse `RejectReasonSheet`, store the reason in the audit log's `notes`** —
  better record, but `booking_status_log.notes` is written by the trigger from
  `NEW.rejection_reason`, so plumbing a separate note through is a **schema/trigger
  change** and an approval gate. Recommend not now.
- **(c) 4s deferred Undo, no dialog** — consistent with Approve, but a silent
  irreversible cancellation of a *confirmed* booking is a worse default than one tap of
  confirmation.

### OPEN: D4 — Mobile would lead the vendor web portal. Acceptable?

`BookingRow.tsx:36` gates web's actions on `pending` only, so after this plan a vendor
can complete/cancel on their phone but not in the browser.

- **(a) Accept the divergence, note it in the docs** *(recommended)* — mobile is the
  on-site tool; marking a booking complete belongs where the vendor is standing. I5
  records it so it reads as a decision, not drift.
- **(b) Hold mobile until web catches up** — consistent, but blocks this work on a
  separate app; AGENTS.md treats multi-app changes as their own approval gate.

### OPEN: D5 — `ApproveRejectBar` would no longer only approve and reject. Rename?

- **(a) Rename to `BookingActionBar`** *(recommended)* — the name becomes inaccurate
  otherwise. Only one importer (`BookingDetail.tsx:80`), so this is a directory rename
  plus one import line.
- **(b) Keep the name** — zero churn, permanently misleading.

### OPEN: D6 — Should "completed" be manual at all?

Worth asking once before building a button: completion could be derived from the booked
date passing, rather than a vendor tapping.

- **(a) Manual button** *(recommended for now)* — no scheduled job exists in this project,
  and "the date passed" is not the same as "the service happened" (no-shows exist).
- **(b) Automatic** — needs a scheduled function in `backbone/`; a much larger piece of
  work and out of this plan's scope.

---

## DEFERRED / COSMETIC

- **Inline actions on the bookings list.** Web has none either; the detail screen is the
  deliberate place for a decision that changes money and notifies a customer.
- **`refunded` filter chip.** `useBookingsList.ts:22` already carries the empty-state copy
  for it, with a comment saying no chip offers it yet. Adding one is orthogonal and
  pointless until D2 resolves.
- **Bulk actions.** Not requested; a vendor triaging on a phone acts on one booking at a
  time.

---

## Execution order

**The plan is gated — D1 through D6 are all OPEN.** Nothing below may start.

1. **B1** — one observation. If it returns reading 2 or 3, stop and fix that first;
   everything here assumes the bar renders.
2. **Resolve D1–D6.**
3. **I3** — the transition map and the copy fix. Everything else hangs off it, and it is
   the only item with a machine-checkable unit test.
4. **I1** — `completed`, reusing the deferred-write pattern.
5. **I2** — `cancelled`, with its own service function. **Coupled to D3** and the one item
   whose acceptance criterion is verified from the *booker* side.
6. **I4** — the confirmation step, following D3.
7. **I5** — docs.
8. **D5's rename**, if chosen — last, so it is one clean commit that touches no logic.

No schema change, no migration, no approval gate. The one candidate — D3(b) — is
recommended against for exactly that reason.

## Verification

### Machine-verifiable
- `tsc --noEmit`, `expo lint`, `npm test`, `expo export --platform android`.
- **I3's transition map gets a real unit test** against the five transitions in
  `20260516000004_booking_status_transition.sql:29-31`. This is the only part of the
  feature a machine can actually prove, and it exists because the map is deliberately
  extracted as pure data.

### Needs a live environment
- Each new transition performed end-to-end, with the row moving between filter tabs.
- Undo inside the 4s window for I1; the confirmation step for I2.
- **The booker receives `booking_cancelled`, not `booking_rejected`** (I2). Requires the
  booker app or a direct look at `notifications`. Nothing in the vendor app can show this,
  and it is the highest-value check in the plan.
- Backgrounding the app mid-undo-window still flushes the write
  (`useBookingActions.ts:104-112`).
