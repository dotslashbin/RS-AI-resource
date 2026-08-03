# Vendor Mobile — Live Reload for Bookings & Notifications

**Date:** 2026-08-02
**App / scope:** `ezzy-vendor-mobile` only. No changes to `vendor`, `booker`,
`command`, or `backbone` — the backbone is **read-only reference** for this plan.
**Status:** IN PROGRESS — stages 1–4 code complete (2026-08-02). **Every item is
🔄, not ✅: none of it has run on a device, and B1's root cause is still
unknown.** Stage 5 (the device pass) is the only remaining work, and it is the
work that decides whether any of this is correct.

> A new booking should land on screen without a pull-to-refresh. Optimize for
> *the list is never wrong*, not for *the socket is clever*.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "vendor web I23").

---

## 0. Two answers up front

### 0.1 — Notifications: no, you should not need to pull down

`useNotificationsRealtime` is mounted at the **tab layout**
(`src/app/(app)/_layout.tsx:37`), not on the Alerts screen, so it is live from
whichever tab you are on. On a `notifications` INSERT for your user it
invalidates the inbox list and the unread count and shows an arrival toast
(`src/hooks/useNotificationsRealtime.ts:45-53`).

Bookings realtime is mounted differently — only inside the Bookings screen hook
(`src/components/bookings/BookingsList/useBookingsList.ts:48`).

**This asymmetry is the single most useful diagnostic we have**, so please
report which of these you actually observed:

| Observation | What it means |
|---|---|
| Notifications arrive live, bookings do not | Transport is fine; the fault is bookings-specific (channel, filter, or invalidation) |
| **Neither** arrives without a pull-down | The realtime transport itself is dead for this client — one root cause, not two |

Everything in B1 below is written to distinguish these on-device rather than
guess.

### 0.2 — Booking actions: already at full parity, nothing to build

You asked for the vendor app's booking actions to be implemented on mobile.
**They already are.** Verified by reading both services side by side:

| Action | vendor web | ezzy-vendor-mobile |
|---|---|---|
| Approve | `vendor/services/bookings.service.ts:71` | `approveBooking` — `useBookingActions.ts:158` (+ 4s deferred-commit Undo) |
| Reject (with reason) | `:77` | `rejectBooking` — `useBookingActions.ts:194` (+ reason sheet) |
| Hand over / start | `:101` `startCustody` | `fulfil(booking, "start")` |
| Mark as done | `:96` `markFulfilled` | `fulfil(booking, "fulfil")` |
| Got it back | `:106` `confirmReturn` | `fulfil(booking, "confirm_return")` |
| Undo a step | `:114` `undoFulfilment` | `fulfil(booking, "undo")` |
| Flag for Ezzy | `:123` `flagBooking` | `flag` — `useBookingActions.ts:283` |

8 of 8. Mobile additionally carries the unpaid-work confirmation and the
auto-confirm countdown (`useBookingActionBar.ts`). Shipped 2026-08-02 via
`.plans/2026-08-02-vendor-mobile-fulfilment-sync.md`.

The one genuine difference is **reachability, not capability**: vendor web has no
booking detail page and puts every action inline on the expandable row
(`vendor/components/bookings/BookingsPage/BookingsPage.tsx:61`); mobile
deliberately puts them on the detail screen, one tap deeper
(`BookingListItem.tsx:10-11` records that decision). That is **D2** below — a
decision for you, not an omission to fix silently.

**Consequence for this plan: there is no "implement booking actions" stage.**
Writing one would mean rebuilding working code. If you want the inline-row
variant, that is D2 and it is a UX change, not a parity fix.

---

## BLOCKERS

### B1 — Root cause of the missing live booking is unknown  🔄 IN PROGRESS
**Files:** `src/hooks/useBookingsRealtime.ts:21-82`,
`src/hooks/useNotificationsRealtime.ts:21-82`

The subscription code is **correct by inspection**. It is a faithful port of the
vendor web implementation (`vendor/components/layout/AppShell/useAppShell.ts:180-225`),
the channel filter uses `vendors.id` which is exactly `bookings.vendor_id`, the
query-key prefix `["bookings", vendorId]` genuinely matches
`bookingsQueryKey` (`useBookingsQuery.ts:17-27`), and `invalidateQueries` on an
active query refetches regardless of `staleTime`.

So **the fault is at runtime and cannot be found by reading more code.** Writing
a fix now would be guessing. Hypotheses already checked and their verdicts:

| Hypothesis | Verdict |
|---|---|
| supabase-js never sets the realtime auth token after a cold-start session restore (`INITIAL_SESSION`), so the socket is anon and RLS drops every row | ✖ **False alarm.** v2.110.9 handles it — `dist/index.mjs:886` includes `INITIAL_SESSION` in `_handleTokenChanged` |
| `bookings` is not in the `supabase_realtime` publication | ⬜ **Unconfirmed.** The migration exists (`backbone/…/20260718000001_bookings_realtime.sql`) but "applied on the live project" is not the same claim — and the recent DB redeploy is a reason to check, not assume |
| RLS helpers can't be evaluated in the realtime context | ✖ Unlikely. `public.is_active()` / `public.has_vendor_role()` are both `security definer stable` (`20260504000002_schema.sql:206,277`) |
| `REPLICA IDENTITY` blocks the filter | ✖ Not applicable. INSERT/UPDATE carry the full new row from WAL; replica identity only governs `old_record` |
| Vendor id mismatch (mapping id vs `vendors.id`) | ✖ Ruled out. `toDbVendors` maps `r.vendors.id` (`vendorMapping.ts:38`) |
| Channel churn from `AppState` background/foreground leaving two channels on one topic | ⬜ Plausible, secondary — see B2 |

**Fix approach — instrument, then read the log. In this order:**
1. Log **every** `.subscribe()` status in both hooks, not only the two failure
   ones (`useBookingsRealtime.ts:56-60` currently swallows `SUBSCRIBED` and
   `CLOSED`). If `SUBSCRIBED` never prints, the problem is the socket/auth. If it
   prints and no payload follows, the problem is the publication or RLS.
2. Log each received payload before invalidating.
3. Have a second device/browser create a booking for the same vendor while the
   Bookings tab is open, and capture the log.
4. **Only if** step 1 shows `SUBSCRIBED` with no payload: confirm the live
   publication with `select tablename from pg_publication_tables where
   pubname = 'supabase_realtime';` — read-only, no schema change, no approval
   gate. A missing row makes this a backbone task, which is **outside this
   plan's scope** and would come back to you as a separate decision.

**Verification:** needs a live device. This item is DONE only when the log names
the cause.

🔄 **IN PROGRESS (2026-08-02)** — instrumentation shipped; the diagnosis itself
is **not** done and cannot be done from here.

- Added `src/lib/realtimeLog.ts` — `logChannelStatus` / `logChannelPayload`.
  Failure statuses warn in every build; `SUBSCRIBED`/`CLOSED` and payload lines
  are `__DEV__` only. **Logs the event type and row id only, never the payload
  row** — booking and notification payloads carry booker PII.
- Both hooks now log every status via `.subscribe((status, error) => …)` and
  every payload before invalidating. `useNotificationsRealtime` logs *before* the
  portal early-return on purpose: a booker-portal row arriving is still proof the
  channel is alive, which is the fact B1 needs.
- Machine-verified: `tsc` clean, `expo lint` clean, 89/89 tests pass.
- **Blocked on a device run.** Steps 3–4 of the fix approach need a phone and a
  second client creating a booking. Nothing further can be concluded here.

---

### B2 — Background/foreground churn can leave the channel unjoined  🔄 IN PROGRESS
**File:** `src/hooks/useBookingsRealtime.ts:64-75` (and the identical block at
`useNotificationsRealtime.ts:64-75`)

`unsubscribe()` calls `supabase.removeChannel()` and immediately drops the ref;
the next `active` event calls `supabase.channel()` with the **same topic** while
the previous channel may still be in `leaving`. realtime-js then holds two
channels on one topic and the new one can settle in a state that never
delivers. On Android this path fires on any permission dialog, notification
shade pull, or app switch — i.e. constantly.

Note this is **not** a candidate for a first-run failure. It explains "worked,
then quietly stopped", which is the harder bug to notice.

**Fix approach:** await the removal before re-subscribing, and make `subscribe()`
idempotent against a channel still tearing down. Keep the tear-down-on-background
policy — it is deliberate (battery/OS socket reaping) and TanStack's focus
refetch already covers the gap.

**Verification:** background/foreground 10× with a booking created in between;
`SUBSCRIBED` must print exactly once per foreground. Needs a device.

🔄 **CODE COMPLETE (2026-08-02), device check outstanding.**

Both hooks replaced the `channelRef` + sync `unsubscribe()` pair with a small
reconciler: `desired` records intent synchronously, `sync()` queues the
create/remove onto a single promise chain, and the remove is **awaited** before
any create can run. A rapid background→foreground now collapses to a no-op
because the queued step re-reads `desired` when it runs.

Deliberately kept inline in both files rather than extracted into a shared
`useRealtimeChannel` — see I6.

Machine-verified: `tsc` clean, `expo lint` clean, 89/89 tests pass. **No machine
check in this repo can observe channel state**, so the 10× background/foreground
run is still required before this goes ✅.

---

## IMPORTANT

### I1 — Bookings realtime is scoped to one screen  ⬜ TODO
**File:** `src/components/bookings/BookingsList/useBookingsList.ts:48`

Mounted inside the Bookings screen hook, so it is live only once that tab has
been opened. A vendor sitting on Dashboard gets no invalidation at all — the
"Pending Approvals" card and its count go stale silently.

**Fix approach:** hoist the `useBookingsRealtime(gate.selectedVendorId)` call to
`src/app/(app)/_layout.tsx`, beside the notifications one, and delete it from
`useBookingsList`. One channel for the whole authenticated app, matching how
notifications already work. No new component, so no component-separation
implications; this is a hook move only.

**Verification:** machine — `tsc`, `expo lint`. Live — create a booking while on
the Dashboard tab and watch the card update.

🔄 **CODE COMPLETE (2026-08-02), device check outstanding.** Call moved from
`useBookingsList.ts:48` to `app/(app)/_layout.tsx` beside the notifications one,
reading `gate.selectedVendorId`. A comment left at the old site records that the
screen must NOT re-subscribe — doing so would open a second channel on the same
topic. Machine-verified: `tsc`, `expo lint`, 89/89 tests, and
`expo export --platform android` (the route tree still builds — this touched a
layout, so the bundle check is not optional). `dist/` deleted.

---

### I2 — The dashboard stats query is invalidated by nothing at all  ⬜ TODO
**File:** `src/components/dashboard/DashboardView/useDashboardView.ts:22`

`["dashboard-stats", vendorId]` is grepped for in exactly two places: its own
`useQuery` and the persistence allow-list (`lib/queryClient.ts:13`). Neither
`useBookingsRealtime` nor `useBookingActions` touches it — both invalidate
`["bookings", vendorId]`. So the stat tiles are stale after **your own approve**,
not just after someone else's insert, until focus/refetch or pull-to-refresh.

**Fix approach:** add `["dashboard-stats", vendorId]` to the invalidation in the
realtime hook and to `invalidate()` in `useBookingActions.ts:110-113`.

**Verification:** machine — a unit test is not practical here (both hooks import
the Supabase client, which cannot load under `node --test`; see AGENTS Traps).
Live — approve a booking, switch to Dashboard, tile has moved.

🔄 **CODE COMPLETE (2026-08-02), device check outstanding.** `useBookingsRealtime`
now invalidates three prefixes from one list (`["bookings"|"booking"|
"dashboard-stats", vendorId]`); `useBookingActions.invalidate` gained the
`dashboard-stats` key. Executing this surfaced **I7** — `invalidate` was never
called by `approve` or `reject` at all, so the fix as planned would still have
left the tiles stale after the two commonest actions. Fixed under I7.
Machine-verified: `tsc`, `expo lint`, 89/89 tests.

---

### I3 — An open booking detail screen never live-updates  ⬜ TODO
**File:** `src/components/bookings/BookingDetail/useBookingDetail.ts:20`

The detail query key is `["booking", vendorId, id]`. Prefix invalidation on
`["bookings", …]` does **not** match it — different first element. A booking
cancelled by the booker while the vendor has it open keeps showing the old
status and the old action buttons; the vendor taps an action the DB then
refuses.

**Fix approach:** have the realtime UPDATE handler invalidate
`["booking", vendorId]` as well. Prefix-only, so it covers whichever detail
screen happens to be open without the hook knowing about routing.

**Verification:** live — open a booking on the phone, change its status from the
vendor web portal, watch the mobile screen follow.

🔄 **CODE COMPLETE (2026-08-02), device check outstanding.** `["booking",
vendorId]` added to the invalidation list. Applied to INSERT as well as UPDATE:
the prefix matches nothing when no detail screen is open, so branching on the
event type would be a special case that buys nothing.
Machine-verified: `tsc`, `expo lint`, 89/89 tests.

---

### I4 — A first-time booker's name renders blank on a live-arriving booking  ⬜ TODO
**File:** `src/hooks/useBookingsQuery.ts:35-40`

`useBookerContacts` has a 5-minute `staleTime` and is invalidated by nothing. A
new booking from a booker with no prior booking at this vendor is not in the
contacts map, so the row renders with an empty name — which reads as corrupt
data, not as loading. Today this is masked because pull-to-refresh does not
invalidate contacts either; it will become **visible** the moment B1/I1 make
rows arrive on their own.

**Coupling:** do not ship I1 without I4.

**Fix approach:** invalidate `["booker-contacts", vendorId]` alongside the
bookings keys on a realtime INSERT (INSERT only — an UPDATE cannot introduce a
new booker).

**Verification:** live — new booking from a booker who has never booked this
vendor; name is populated on arrival, not after a manual refresh.

🔄 **CODE COMPLETE (2026-08-02), device check outstanding.**

**The plan under-specified this one.** It said "invalidate contacts alongside the
bookings keys", which would NOT have worked: `useBookingsQuery` closes over
`contacts.data`, and React Query does not re-run a query when its queryFn
identity changes. Invalidating both at once races, the list refetch usually wins,
and the row still paints with the blank name — the exact defect the item exists
to prevent, shipped green.

The implementation therefore **orders** them: contacts first, list second, via
`invalidateQueries(contactsQueryKey).finally(invalidate)`. `.finally` not
`.then`, so a contacts failure cannot strand the list on stale data. INSERT only
— an UPDATE cannot introduce a new booker.

Grounding for the blank name: `bookings.service.ts:64`, `contact?.full_name ?? ""`.
Machine-verified: `tsc`, `expo lint`, 89/89 tests.

---

### I5 — No fallback when the socket is degraded  ⬜ TODO
**File:** new behaviour in the bookings query path

Realtime on a phone is best-effort: carrier NAT timeouts, captive portals, and
Doze all kill long-lived sockets without a clean `CHANNEL_ERROR`. Right now the
only recovery is app foreground or a manual pull. What you actually asked for —
"the booking should just appear" — is more reliably delivered by a modest poll
than by trusting the socket alone.

**Fix approach:** `refetchInterval` on the bookings list query, **only while the
screen is focused**, as a backstop rather than the primary mechanism. Interval
is **D1**.

**Explicitly not doing:** polling the whole app, or polling in the background.
Both cost battery for no benefit — push (Ph7) is the correct background channel.

**Verification:** live — turn airplane mode on, create a booking elsewhere, turn
it off, and confirm the list catches up without a pull. Also confirm no refetch
while backgrounded.

🔄 **CODE COMPLETE (2026-08-02), device check outstanding.**

`refetchInterval: isFocused ? POLL_MS : false` (60s per D1) on the bookings
infinite query (`useBookingsQuery.ts`) and on the filter counts
(`useBookingFilterCounts.ts`). `useIsFocused` comes from **`expo-router`
directly** — no new dependency, so no approval gate.

Two independent gates, both needed:
- **Screen** focus via `useIsFocused`. expo-router keeps a tab mounted once
  visited, so without this every visited tab would poll forever. It also means
  the whole-app cost stays at one tick: the Bookings tab and the Dashboard
  preview both call `useBookingsQuery`, but only the focused screen ticks.
- **App** focus via TanStack's own `refetchInterval` check against
  `focusManager`, already wired to AppState in `lib/queryClient.ts:73-79`.
  `refetchIntervalInBackground` is left at its default `false` deliberately.

**Counts poll too**, which the plan did not specify. Reason: a tick that
refreshed the list but not the badges would put a visible contradiction on
screen — rows under "Needs you" while its chip shows the old number. The
"badge failure is cosmetic" note in `useBookingFilterCounts` covers a *missing*
badge, not a *wrong* one. Fixed cost of one count per badged group (two today).

**Accepted cost, recorded honestly:** refetching an infinite query refetches
every loaded page, so a vendor who has paged to page 3 spends 4 requests per tick
instead of 1. Not engineered around — the list is `created_at desc` so new
bookings land on page 0, and deep paging is rare and short-lived. `maxPages` is
the lever if it ever shows up.

Machine-verified: `tsc`, `expo lint`, 89/89 tests, `expo export --platform
android`. `dist/` deleted.

---

### I7 — `approve` and `reject` reconciled no server-side aggregate  🔄 IN PROGRESS
**File:** `src/hooks/useBookingActions.ts` — `approve`'s deferred `commit`, and
`reject`

Discovered while executing I2 (2026-08-02), **pre-existing and not anticipated by
this plan.** `invalidate()` was called by `fulfil` and `flag` but by neither
`approve` nor `reject`. `fulfil` even carries a comment explaining exactly why it
is needed — "the optimistic patch cannot move a COUNT" — and the same reasoning
was never applied to the two most-used actions in the app.

Effect: after an approve or a reject, the filter-chip badges kept their old
numbers and the dashboard tiles kept theirs, until a focus refetch or a manual
pull. The row moved; every aggregate derived from it did not. I2 alone would not
have fixed this — it would have added the `dashboard-stats` key to a function
these two paths never call.

**Fix applied:** `invalidate()` after a successful `approveBooking` (inside the
deferred commit, so it lands after the undo window has closed) and after a
successful `rejectBooking`. Both `useCallback` dependency arrays updated.

**Verification:** machine — `tsc`, `expo lint`, 89/89 tests. Live — approve from
the list and confirm both the "Needs you" badge and the Dashboard tile move
without a pull. **Device check outstanding.**

### I6 — The two realtime hooks now share ~25 lines of identical lifecycle  ⏸ PARKED
**Files:** `src/hooks/useBookingsRealtime.ts:43-100`,
`src/hooks/useNotificationsRealtime.ts:36-95`

Discovered while executing B2 (2026-08-02), not anticipated by this plan. The
channel lifecycle — AppState teardown, the B2 reconciler, the status logging —
is now byte-for-byte identical in both hooks; only the topic and the `.on(...)`
handlers differ. It wants a `useRealtimeChannel(topic, build)` hook.

⏸ **PARKED (2026-08-02).** Extracting it is a structural refactor of the exact
code B1 is still diagnosing, and would invalidate the stage-1 log the moment it
lands. **Unblock condition:** B1 is ✅ and its fix has shipped. Then this is a
mechanical, well-covered extraction.

## DECISIONS
<!-- No stage may execute while an OPEN: line remains — plan-authoring §7. -->

- **D1: polling fallback interval (I5)** → **60s, only while the bookings screen
  is focused** (resolved 2026-08-02) — bounds worst-case staleness to a minute
  even with a dead socket, at one page query per minute. Never polls while
  backgrounded; push (Ph7) is the correct background channel.

- **D2: inline row actions to match vendor web (§0.2)** → **leave as-is**
  (resolved 2026-08-02) — actions stay on the detail screen. Capability parity is
  already complete; row tap targets are cramped and the fulfilment flow now has
  six action shapes plus an unpaid confirmation, more than a row can carry. Not
  part of live reload; if it is ever wanted it gets its own plan.

- **D3: stage ordering** → **stage 3 runs after diagnosis, as listed** (resolved
  2026-08-02) — hoisting the hook to the layout changes *when* the channel
  mounts, which is one of the variables B1 is investigating. Keeping the code
  still keeps the stage-1 log readable.

- **D4: if B1 proves the live `supabase_realtime` publication is missing
  `public.bookings`, what then?** → **stop and report** (resolved 2026-08-02) —
  the fix would be a backbone migration, outside this plan's scope and an
  approval gate. It becomes a separate one-line backbone plan rather than
  widening this one mid-execution.

**No OPEN decisions remain — the plan is cleared for execution approval.**

---

## DEFERRED / COSMETIC

- **Patching realtime UPDATE payloads into the cache instead of refetching.**
  Vendor web does this (`useAppShell.ts:230-250`). Mobile deliberately refetches
  because the cache is paged across several filter keys and the payload lacks the
  joined offering/schedule/contact fields (`useBookingsRealtime.ts:16-20`). Still
  correct — leave it.
- **Wiring `onlineManager` to NetInfo** (`lib/queryClient.ts:73-75`). Would make
  reconnect refetches sharper, but it is an offline-UX task with its own scope.

---

## Execution order — the stage checklist to approve

Default cadence is **one stage at a time**, stopping for your review after each.

| # | Stage | Contents | Gate |
|---|---|---|---|
| **1** | **Diagnose** | B1 — add full subscribe/payload logging, run the two-device test, read the log | **Nothing is fixed in this stage.** Ends with a named root cause. Report back before stage 2 |
| **2** | **Transport fix** | Whatever B1 names, + B2 channel-churn fix | Scope of the B1 fix is unknown until stage 1 lands; if it turns out to be D3, we stop here |
| **3** | **Coverage** | I1 (hoist to layout) + I4 (contacts) shipped **together** — coupled + I2 (dashboard stats) + I3 (detail screen) | Runs after stage 1 per D3 |
| **4** | **Fallback** | I5 polling backstop — 60s, focused only, per D1 | — |
| **5** | **Verify** | Full device pass: `tsc`, `expo lint`, `npm test`, `expo export`, then the live checks listed per item | Android only — iOS remains unverified (AGENTS: no Apple account) |

**Progress (2026-08-02):** stages 1–4 are code complete and machine-clean. Stage
5 has not run.

**The one thing that gates everything:** B1's root cause is still unknown. The
stage-1 instrumentation was built to find it and has not yet been run on a
phone. Read the log for:

| Log shows | Meaning | Next |
|---|---|---|
| no `channel SUBSCRIBED` | socket never joined — auth or transport | fix in this app |
| `SUBSCRIBED`, no `INSERT` line | joined but the server sends nothing — publication or RLS | **D4 applies: stop and report**, it becomes a backbone plan |
| `SUBSCRIBED` + `INSERT` but no visible row | delivery is fine; the fault is cache invalidation, and stage 3 has probably already fixed it | re-test, then close B1 |

Note the third row: it is entirely possible stage 3 fixed the reported symptom
outright — I1 alone would explain a booking not appearing if the Bookings tab had
not been opened when it arrived. That is a hypothesis, **not** a claim, and the
log settles it.

Stages 1 and 2 are sequential by necessity. Stage 3 is technically independent of
both, but D3 settled that it waits for the diagnosis so the stage-1 log is read
against unchanged code.

---

## Verification

**Machine-verifiable** (run at every stage boundary; all four are currently clean,
so any output is a regression):
```bash
export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH"
ezzy-vendor-mobile/node_modules/.bin/tsc --noEmit --project ezzy-vendor-mobile/tsconfig.json
npm --prefix ezzy-vendor-mobile run lint
npm --prefix ezzy-vendor-mobile test
```

**Needs a live environment** — every functional claim in this plan. No machine
check in this repo can observe a realtime payload, and AGENTS is explicit that
past style work shipped four times on green machine checks while doing nothing on
screen. Each item above names its own device check; none is marked ✅ without one.

**Not verifiable here:** iOS. Everything will be verified on Android only.
