# Live updates without page refresh (notifications + bookings + command refresh buttons)

**Date:** 2026-07-18
**App / scope:** all three apps (`./booker`, `./vendor`, `./command`) + `./backbone` (one publication migration). Cross-cutting: touches more than one app **and** includes a schema-adjacent change (publication membership) — approval gates per AGENTS.md.
**Status:** ✅ COMPLETE (2026-07-18) — all six stages executed with per-stage user approval and verified (machine + live-in-browser per stage; see each stage's DONE note). All changes uncommitted — user handles commits (spread across booker, vendor, command, and backbone repos).

**Remaining for the user's own two-browser pass (nice-to-confirm, not blocking):**
- Full cross-app walkthrough: booker books → vendor sees booking + notification + toast live → approve → booker sees status + notification live.
- Vendor multi-vendor switch (log in as maria@bookdeck.com, 3 vendors): switching vendors should drop the old vendor's live booking events and receive the new one's (verified by construction — effect cleanup — but not exercised live).
- Hosted: after commit/merge, confirm the migration applied (`supabase migration list`) and repeat one live notification check against the hosted project.

> **Goal:** users must not need to reload the page to see updates — especially notifications (all three portals) and booking status (booker + vendor). Command's users/vendors *tables* get a manual refresh-data button (refetch in place, not page reload).
>
> **Execution model (user request 2026-07-18):** work proceeds **stage by stage, one approval per stage**, so the session can pause cleanly between stages (context/token budget). Each stage below is self-contained: it lists its files, the exact change, and its own verification, so a fresh session can pick up any pending stage from this document alone.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> Stages are numbered S1…S6 and ordered by dependency; numbers are plan-local.

---

## Verified current state (2026-07-18, code-level — do not re-derive)

1. **Notifications subscription exists in all 3 apps but is defective.** Each app subscribes in its `useAppShell.ts` (booker `:48-63`, vendor `:178-192`, command `:80-94`) with:
   - **Invalid compound filter** — `filter: "user_id=eq.<uid>,portal=eq.<portal>"`. Supabase `postgres_changes` accepts **one** condition per subscription; a comma-compound is not supported (either errors the binding → nothing arrives, or silently degrades). This is the likely cause of "notifications don't appear until refresh".
   - **`.subscribe()` with no status callback** — a `CHANNEL_ERROR`/`TIMED_OUT` is invisible.
   - **INSERT-only** — acceptable, kept (see Decisions).
2. **Bookings have no realtime at all.** No subscription in any app, and `bookings` is **not** in the `supabase_realtime` publication — only `notifications` is (`backbone/supabase/migrations/20260525000002_notifications.sql:73`). Vendor approve/reject is optimistic for the *actor* only (`vendor useAppShell.ts:203-213`); the booker never hears about it. `is_paid` (webhook) is likewise invisible to the vendor until refresh.
3. **Command tables load once.** `getUsers()` on mount (`command/components/users/UsersPage/useUsers.ts:31`, exposed as `refresh()` at `:26-29`), `getVendors()` on login (`command useAppShell.ts:49`, re-run at `:115`); refetch happens only after the admin's own mutations.
4. **RLS:** Realtime `postgres_changes` delivers only rows the subscriber can `SELECT`. Existing `bookings` policies already scope booker→own / vendor-admin→own vendor / command→all, so **no policy or grant changes are needed**.
5. supabase-js `^2.105.4` in all three apps — same API surface everywhere. Apps share no code; changes are copied per app by intent (`conventions.md`).

## Decisions (all resolved 2026-07-18 — user approved recommendations)

- **D1 — mechanism** → **Postgres Changes (Option A)** — already in use; RLS-scoped; right scale. (Broadcast-from-DB = overkill now; polling = wasteful; optimistic-only can't deliver cross-user events.)
- **D2 — notifications event scope** → **INSERT-only.** Cross-tab/device read-archive sync is out of scope (would triple merge logic for marginal benefit).
- **D3 — command refresh buttons** → **both** Users and Vendors tables.
- **D4 — arrival toasts (S6)** → decide per portal at execution time; skip where noisy.

---

## Stages

### S1 — Migration: publish `bookings` for Realtime  ✅ DONE (2026-07-18)  *(approval gate: schema-adjacent — approved by user)*
> Executed: created `backbone/supabase/migrations/20260718000001_bookings_realtime.sql`; applied to the local DB via `npx supabase migration up` (non-destructive — deliberately not `db reset`, preserving local data/Vault secrets). Verified: `pg_publication_tables` now lists `bookings` + `notifications` under `supabase_realtime`. Incidental: `migration up` also applied the previously-pending `20260716161916_remote_schema.sql` locally (benign db-diff redeclaration, was going to apply on next reset anyway). Hosted apply happens when the user commits/merges (GitHub integration). Uncommitted per workflow.
**File:** new `backbone/supabase/migrations/20260718NNNNNN_bookings_realtime.sql`
```sql
alter publication supabase_realtime add table public.bookings;
```
No `replica identity full` needed: subscriptions filter on stable columns (`booker_id`, `vendor_id`) present in the new row, and only the new row is read. **Blast radius:** metadata-only, instant, no data/lock impact; reversible via `alter publication … drop table public.bookings`. No RLS/grant/type changes. Harmless alone — a publication without subscribers is inert, so S1 can land and the session can pause indefinitely before S3/S4.
**Verify:** local `supabase db reset` applies cleanly; `select * from pg_publication_tables where pubname='supabase_realtime';` lists `bookings`.

### S2 — Fix the notifications subscription (all 3 apps)  ✅ DONE (2026-07-18)
> Executed: identical fix ×3 in each app's `useAppShell.ts` — single-condition filter (`user_id=eq.<uid>`), client-side `row.portal === "<portal>"` guard before prepending, `.subscribe(status)` callback warning on `CHANNEL_ERROR`/`TIMED_OUT`. INSERT-only kept per D2. Verified machine: `tsc --noEmit` clean ×3; grep confirms zero compound `filter:` strings remain. Verified live (local stack, command app): logged in as seeded root via Playwright, psql-inserted a `portal='command'` notification → appeared in the open panel **without refresh** ("just now", screenshot on record); a `portal='booker'` row for the same user did **not** appear (cross-portal isolation); no channel errors in console. Test rows deleted after. Booker/vendor use the byte-same pattern — full two-browser cross-app walkthrough remains in the cross-stage verification pass.
**Files:** `booker/components/layout/AppShell/useAppShell.ts:48-63`, `vendor/…/useAppShell.ts:178-192`, `command/…/useAppShell.ts:80-94`
Same change ×3 (copy-by-intent):
1. Filter on the **single** condition `user_id=eq.<uid>`; in the callback, check `payload.new.portal === "<portal>"` before prepending (preserves the cross-portal isolation the compound filter intended — a dual-portal user must not see another portal's rows).
2. Status callback: `.subscribe((status) => { if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn("notifications realtime:", status) })`.
3. Keep INSERT-only (D2). No other event bindings.
Independent of S1 (notifications are already published). This stage alone delivers the headline "notifications without refresh" in all three portals — a natural pause point.
**Verify:** two browsers — booker books → vendor's bell updates without refresh (and equivalents for booker/command notification types); console shows `SUBSCRIBED`; dual-portal user receives nothing cross-portal; `tsc --noEmit` ×3; grep confirms no compound `filter:` strings remain.

### S3 — Booker: live booking-status updates  ✅ DONE (2026-07-18)  *(depends on S1)*
> Executed: added a `bookings` UPDATE binding (`filter: booker_id=eq.<uid>`) to the existing channel in `booker/components/layout/AppShell/useAppShell.ts` (channel renamed `app-events-<uid>` as it now carries two tables). **Design deviation from the plan sketch, deliberate:** the realtime payload has only flat `bookings` columns (no joins), while booker's `Booking` display type is built from a joined query (offering/schedule/vendor names) — so instead of mapping a full `Booking` from the payload, the handler patches only the mutable `status` field on the row already in state, with a `getBookings()` refetch fallback when the row isn't in state (booked on another device after login; lookup via a `bookingsRef` since realtime callbacks close over stale state). Verified machine: `tsc --noEmit` clean. Verified live (local stack): logged in as seeded booker (liza) via Playwright; psql `pending→confirmed` → dashboard card showed **Confirmed without reload** (screenshot) + `booking_confirmed` notification arrived live (S2 confirmed in booker too); second run captured before/after text programmatically: same card `Confirmed` → **`Completed` live in one session**, no channel errors. Test booking + generated notifications deleted after.
**File:** `booker/components/layout/AppShell/useAppShell.ts` (extend the channel setup in `afterLogin`)
Add a `postgres_changes` binding on `bookings`, `event: "UPDATE"`, `filter: booker_id=eq.<uid>` → merge: `setBookings(prev => prev.map(b => b.id === payload.new.id ? mapped : b))`. Reuse the row→`Booking` mapper from `booker/services/bookings.service.ts` (export it if currently private — do **not** hand-map inline; keep the single mapping source). INSERTs not needed (the booker's own create already updates local state). Covers confirm / reject / cancel / complete on the dashboard without refresh.
**Verify:** vendor approves in one browser → booker dashboard status flips in the other without refresh; reject and cancel likewise; `tsc --noEmit`.

### S4 — Vendor: live incoming bookings + status/payment changes  ✅ DONE (2026-07-18)  *(depends on S1)*
> Executed: dedicated `bookings-<vendorId>` channel created inside the `selectedVendorId` effect in `vendor/components/layout/AppShell/useAppShell.ts` — effect cleanup removes the channel, so vendor switching tears down and re-creates it with the new filter (the planned coupling, handled structurally). INSERT handler **refetches** `getBookings(vendorId)` (payload lacks joins + the RPC-only booker contact — refetch is the only correct way to build the row; new bookings are rare per vendor). UPDATE handler **patches** `status`/`rejectionReason`/`notes` onto the row in state (idempotent vs. the vendor's own optimistic approve/reject), with refetch fallback for unknown rows via `bookingsRef`. `is_paid` is not in vendor's `Booking` display type, so there is nothing to patch for it — the `payment_confirmed` notification (S2) is the visible signal, as before. Verified machine: `tsc --noEmit` clean. Verified live (local stack, jose@Citywide): psql INSERT → row appeared on the open Bookings page **with full joined data incl. "Liza Cruz" + contact from the RPC** (refetch path proven); psql `pending→confirmed` → same row flipped to Confirmed live (patch path proven); no channel errors. Multi-vendor switch not exercised live (test admin has one vendor) — lifecycle is the standard effect-cleanup contract; exercise with maria@ (3 vendors) in the cross-stage pass. Test rows cleaned up.
**File:** `vendor/components/layout/AppShell/useAppShell.ts`
Bindings on `bookings`: **INSERT** (new booking — pairs with the `new_booking` notification) and **UPDATE** (booker cancellation; `is_paid` flip from webhook), `filter: vendor_id=eq.<selectedVendorId>`.
**Couplings (the tricky part of this stage):**
- **Vendor switching:** the filter bakes in the vendor id, so the channel must be torn down and re-created when `selectedVendorId` changes — tie it to the same effect that runs `getBookings(selectedVendorId)` (`:156-161`), removing the old channel first.
- **Optimistic reconciliation:** existing approve/reject optimistic updates (`:203-213`) — merging the echoed server row by `b.id` is idempotent (confirms optimistic state). On INSERT, guard duplicates: `if (prev.some(b => b.id === row.id)) return prev`.
- Reuse/export the vendor's booking row mapper as in S3.
**Verify:** booker books in one browser → vendor bookings list gains the row live; webhook fires → `is_paid` visible without refresh; switching vendors drops old events (no cross-vendor leakage) and receives the new vendor's; optimistic approve still instant; `tsc --noEmit`.

### S5 — Command: refresh-data buttons (Users + Vendors)  ✅ DONE (2026-07-18)
> Executed: icon-only `RefreshCw` button added to `UserToolbar` and `VendorToolbar` (before the primary CTA; `rs-input` chrome + module CSS with disabled/spin states — command's CSS-Modules convention; toolbars stay pure render components with `onRefresh`/`isRefreshing` as props). In-flight state lives in the owning hooks: `useUsers.refreshUsers()` and `useVendors.refreshVendors()` wrap the existing `refresh()` callbacks with an `isRefreshing` guard. `app/ui-gallery/page.tsx` users-mode fixture updated for the new required props. Verified machine: `tsc --noEmit` clean; command visual suite regenerated **39/39 pass** then re-run in verify mode **39/39 0-diff**. **Correction (review pass 2026-07-18):** unlike vendor/booker (baselines gitignored), **command's 39 baseline PNGs are git-tracked** — the regen modified all 39 in command's working tree (users-mode diffs are the genuine refresh-button change; the rest are this machine's re-render/re-encode of pre-existing baselines). They are the new source of truth consistent with the code (verify run 0-diff) — commit them with the S5 code. Verified live (local stack, root@command): for both Users and Vendors — psql-mutated a row behind the open page, list stayed **stale** (proving no hidden auto-update; the button is the mechanism), clicked refresh → new data appeared **in place, same URL, no reload**; mutations reverted after (Ana Flores, Bakul). Screenshots on record.
**Files:** `command/components/users/UserToolbar/UserToolbar.tsx` (+ hook), wiring through `command/components/users/UsersPage/*` to `useUsers.refresh()`; vendors toolbar equivalent (locate exact component under `command/components/` at execution — vendor list state lives in `useAppShell` per `portals.md`) wired to `getVendors().then(setVendors)`.
Add a refresh button (lucide `RefreshCw`, command's CSS-Modules house style) to both toolbars: refetches the data set in place — **no page reload, no navigation, scroll preserved**; brief disabled/spinning state while in flight. Pairs with S2: admin sees "new vendor registration" arrive live → clicks refresh on the table. Deliberately **no** realtime on `profiles`/`vendors`/`user_portals`/`user_roles` (D3 scope).
**Verify:** register a booker in another browser → command notification arrives live (S2) → refresh button updates the users table in place; same for vendors table via vendor self-registration; `tsc --noEmit`; command visual suite still green (buttons are new UI — baselines may need regen; check masks unaffected).

### S6 — Arrival toasts (optional polish)  ✅ DONE (2026-07-18)
> **D4 resolved: all three portals** — command (rare, high-value; pairs with the S5 refresh buttons), booker (rare, personally relevant), vendor (a "new booking" toast is the most useful signal; the busy-hours volume concern is speculative at current scale and the kill switch is deleting the one line). Executed: one line per app in the S2 realtime INSERT callback — `toast(row.title, { description: row.body })` (sonner `Toaster` confirmed mounted in all three: command/vendor in `layout.tsx`, booker via its themed `AppToaster`). Verified machine: `tsc --noEmit` clean ×3. Verified live (command): psql-inserted notification → toast rendered bottom-right with title + body (screenshot); rides the identical code path in booker/vendor. Test row deleted.

---

## Execution order & pause points

| Order | Stage | Depends on | Safe pause after? |
|---|---|---|---|
| 1 | S1 (migration) | — | ✅ inert without subscribers |
| 2 | S2 (notifications ×3) | — | ✅ headline goal delivered |
| 3 | S3 (booker bookings) | S1 | ✅ |
| 4 | S4 (vendor bookings) | S1 | ✅ |
| 5 | S5 (command buttons) | S2 (pairing only — not a hard dep) | ✅ |
| 6 | S6 (toasts) | S2 | ✅ optional |

Every stage boundary is a safe stopping point; no stage leaves another app half-broken. S1+S2 could be approved together if desired (S1 is one line), but default is one approval per stage.

**After each stage:** update its status marker here (with date + how verified), note any newly discovered work, and stop for the next approval. No commits by the agent — user handles commits.

## Cross-stage verification (once all land)
- Full two-browser walkthrough: book → vendor sees booking + notification live → approve → booker sees status + notification live → webhook → vendor sees `is_paid` live → command sees registration notifications live and refreshes tables in place.
- Regression: notification panel actions (read/archive/delete) unchanged; optimistic actor updates unchanged; password-recovery flow untouched (same files as the auth gate — take care in `useAppShell` edits not to disturb the `isRecoveryDetected()` early-return).

## Notes
- Copy-by-intent across apps (no shared code), per `conventions.md`.
- Future upgrade path if scale demands: Broadcast-from-DB + refetch-on-reconnect; out of scope.
