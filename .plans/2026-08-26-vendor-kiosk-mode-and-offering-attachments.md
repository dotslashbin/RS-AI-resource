# Vendor Kiosk Mode + Offering Attachments

**Date:** 2026-08-26
**App / scope:** `vendor/` (primary), `backbone/supabase/migrations/` (schema + storage).
**Cross-app read-only reference:** `booker/` — its wizard, slot service and payment
routes are the source material being adapted, not imported.
**Status:** IN PROGRESS — **B29 is fixed and verified live (2026-09-03); text documents
can now be authored and edited.** Every blocker is ✅. **Every blocker and every important item is ✅ except B22/B23**, and
their parking reasons were corrected on 2026-09-04: **B22 is ✅ done (2026-09-04)**; **B23 belongs to
the app deploy**. **B30 ✅ resolved 2026-09-04** — the local key is back to `sk_test_`, matching booker.
**Stage 9 ✅ (2026-09-04)** — B31, B32 and I17 from the first preview deploy are all
fixed and verified. **B23 is the only item not ✅**, and it closes with the deploys — now with **B33** behind
it, so a missing value fails loudly instead of redirecting a paying customer to localhost.
Confirmed 2026-09-04: values are `https://vendor.ezzy.ph` (production) and
`https://staging-vendor.ezzy.ph` (staging), scheme included, no trailing slash. No open
decisions. What remains is confirmation rather than plan work: the production **grants
re-check**, the reviewer's manual pass, and an app deploy. Schema is on local, staging and production; every blocker and
important item is ✅ apart from **B22/B23**, which are ⏸ pending PayMongo test accounts.
What is left is not plan work but confirmation: the production **grants re-check**, the
reviewer's manual kiosk pass, and an app deploy. **B28 is fixed** (2026-09-03, D24a + D25a) — the launcher no longer opens for an
incomplete account, so the two dialogs cannot stack. ⚠️ One consequence: no seeded vendor
has a payout method, so **the kiosk is unreachable in local dev** until one is added — see
DEFERRED. Schema is applied to **local AND staging** (B17a ✅);
**production is the one environment still pending** (B17b), and B7–B10 stay 🔄 only
because of it. The vendor app has **never been deployed to staging**, so B1/B2/B4/R1
have never run live. Zero open decisions.
<!-- 2026-09-02: the previous headline still read "staging and production are still
     pending", which stopped being true when B17a landed on 2026-08-29. Corrected. -->

*Historical, from the 2026-08-29 re-baseline:* Re-baselined, migrations
re-cut, and syntax + behaviour checked against local (all four applied in one transaction and rolled back;
11 behavioural assertions passed; one false claim found and corrected — F18). `backbone`
`feature/kiosk` is rebased onto `develop` (0 behind, 1 ahead); the four Stage 0
migrations are re-cut at `20260829…`, sorting after the applied `20260828…` work. They
are **written and verified but NOT applied** — the user applies and commits.
Originally re-baselined 2026-08-29 against three plans that shipped
ahead of this one. Stage 0 migrations exist on `backbone` `feature/kiosk` but are
**unapplied, mis-numbered and written against a schema that has since changed** — see
"Re-baseline" below. The user applies migrations; nothing here has touched a database.

---

**Field reports 2026-09-02 (hands-on use):** *Second pass* added **I13** (chip and slot
labels do not stack — `margin-top` on inline `<span>`s), **I14** (the mobile field lets
letters be typed at all — complements I11, does not replace it) and **I12** (gradient
ground, blocked on **D21**). *First pass:* three items from running the
kiosk, not by reading it — **B27** (render-phase navigation in `AppShell`, a real React
invariant violation on the PWA-relaunch path), **I10** (the kiosk scrims are the only
two modals in the app that do not use the established overlay treatment) and **I11**
(the kiosk mobile field accepts letters). Both are
app-layer only: no schema, no migration, no change to Stage 7's production sequence.

## ⚠️ UPSTREAM CHANGE — read before resuming
*(added 2026-08-28; extended 2026-08-29 with the two truncation plans, the branch state
and the re-verified citations. **One section, not two** — a 2026-08-29 pass began writing
a second "re-baseline" section covering the same ground and it was folded in here
instead, because two accounts of the same upstream change is how the wrong one gets
followed.)*

Three plans completed while this one was parked. All three were read and their claims
re-verified against the repo before anything below was written.

| Plan | Status | Impact here |
|---|---|---|
| `2026-08-27-overnight-schedule-windows.md` | ✅ COMPLETE, **applied to local, staging and production** | **Large** — the whole of this section |
| `2026-08-11-crossapp-unbounded-query-truncation.md` | ✅ COMPLETE | Paging is now mandatory for list queries — see "Paging" below |
| `2026-08-11-mobile-vendor-unbounded-queries.md` | ✅ COMPLETE 2026-08-27 | **None.** Expo-only; this plan touches no mobile app. Recorded so the "checked and irrelevant" conclusion is not re-derived later |

`.plans/2026-08-27-overnight-schedule-windows.md` changed the availability model this
plan builds on. That plan is COMPLETE; its migrations are applied to local, staging and
production, and both app builds are deployed.

**What changed, in one line:** a schedule's window is now a **start plus a LENGTH**
(`window_minutes`), not a start and an end. `schedules.end_time` **no longer exists**.

### What this plan must adjust

| Where | Was | Now |
|---|---|---|
| **I1** (`kiosk.service.ts`, line ~1116) | port `getSlotOccupancy`, `remainingForSlot`, `spanAvailable`, `resolveScheduleForTime` from the booker | Still the right four — but port the **current** booker versions. `getSlotOccupancy` now queries a **two-day** span and keys occupancy by epoch instants; `remainingForSlot` and `spanAvailable` take an extra `occurrenceDate` argument |
| **I1**'s "adapt to vendor's `Schedule` shape (`date`/`time`/`end`/…)" (line ~1122) | `end` was the stored window end | `end` is now **derived for display only**. Use `windowMinutes`. Doing arithmetic with `end` is the bug the refactor removed — for an overnight window it reads *earlier* than `time` |
| **I1**'s slot division | `slotsInWindow(start, end, dur)` | `deriveSlots(start, windowMinutes, dur)` and `fitsInWindow(...)` in `vendor/lib/slots.ts`. The old pair still exists and delegates, but takes an end and cannot express overnight |
| **F6** | "vendor already has the substrate" | **More true than before.** `vendor/lib/` now also has `scheduleConflicts.ts` (duplicate/overlap detection) and `scheduleWindow.ts` (`formatScheduleWhen`, `formatWindow`) — use them rather than formatting inline |
| **F1** | `bookings_no_duplicate` on `(booker_id, schedule_id, booked_date, coalesce(start_time,'00:00'))` | **Unchanged** — verified during the refactor. The walk-in finding still stands exactly as written |
| **F7** | "vendor lacks occupancy" | Still true; nothing in the refactor added occupancy to vendor |

### Two new facts the kiosk must respect

1. **`booked_date` is the date a booking STARTS, not the date its schedule's window
   opened.** They coincide for same-day windows. For a Friday 23:00–01:00 window they do
   not: the `00:00` slot is stored as **Saturday**. The occurrence is derived by
   `check_booking_placement()`. If the kiosk builds a booking row by hand, this is the rule
   to follow.
2. **A window may run past midnight, and may be exactly 24 hours.** Any kiosk slot grid
   must handle a slot list that wraps (`23:00`, `00:00`, `01:00`) rather than assuming
   ascending clock times within one day.

### Migration numbering

This plan's four migrations are `20260826*` and are **still unapplied**. The refactor's are
`20260828000001-3` and **are applied everywhere**. Renumber the kiosk ones to a later
timestamp before pushing, or they will be older than the latest applied version on every
environment.

### The duplication count changed

I1 says it creates "a **fifth** copy of the availability rule". Still accurate — but the
occurrence rule's canonical statement now lives in `vendor/lib/occurrence.ts`'s header,
which records the `booked_date` vs occurrence distinction (`lib/occurrence.ts:26-36`).
Mirror that note in `kiosk.service.ts` rather than restating it differently.

### Paging is now mandatory (added 2026-08-29)

`2026-08-11-crossapp-unbounded-query-truncation.md` closed the unbounded-select defect
class across `booker` and `command`, after the same bug was measured in `vendor` at a
**19.7% payout understatement** (`vendor/lib/pagedFetch.ts:1-19`). Every list query this
plan adds must use `pagedFetch` — specifically `getSlotOccupancy` (I1) and
`getKioskOfferings` (B3). An unbounded occupancy query silently truncates at 1000 and
**under-counts**, so the kiosk would offer slots the placement trigger then refuses.
Re-opening that defect class in new code would be the worst possible place to do it.

### Citations re-verified 2026-08-29

- **F1's conclusion holds; its citation moved.** The same-booker overlap guard was
  rewritten onto timestamps and now also spans `booked_date ± 1` (a span can cross
  midnight). It lives at **`20260828000001_schedule_window_minutes_expand.sql:384-394`**,
  not `20260803000005:156-166`. `bookings_no_duplicate` is untouched, as the table above
  says. The walk-in finding — and D1, which rests entirely on it — stands.
- **F18 — the append-only claim was too strong, and the syntax check caught it.**
  Measured on local 2026-08-29 after applying all four in a transaction:
  `booking_acknowledgements` grants come out `authenticated | SELECT` and
  **`service_role | SELECT,INSERT,UPDATE,DELETE,TRUNCATE,…`**. `20260620000001:29-30`
  revokes default privileges from `anon` and `authenticated` but **not** from
  `service_role`, and the platform's default ACL for postgres-owned tables is
  `service_role=arwdDxtm`. So the migration's `grant select, insert … to service_role`
  neither adds nor restricts anything, and B7's *"no UPDATE and no DELETE for anyone —
  withholding the privilege is the enforcement"* was **false for service_role**.
  ✅ **Closed by D17 (2026-08-29):** an explicit
  `revoke update, delete, truncate on public.booking_acknowledgements from service_role`
  now makes the claim true rather than aspirational. **A grant is additive and cannot
  take away what the default ACL already gave** — the revoke is the only thing that
  can. Re-verified by acting *as* `service_role` on local: INSERT succeeds (the kiosk
  route still works), UPDATE and DELETE both fail with `insufficient_privilege`, and
  `offering_attachments` is untouched, still fully writable — the revoke did not leak
  onto the table that is deliberately not append-only.
  ⚠️ Side observation, not acted on: this also puts `20260819000002`'s premise in doubt
  — it added a corrective grant on the belief that new tables inherit nothing for
  `service_role`. On this database they inherit everything. Harmless either way, but
  worth a look before the next table is added.
- **B10's base is still current.** `validate_booking_status_transition()` is still last
  defined in `20260801000002` on `develop`; nothing re-created it. The reproduced body
  and its two-line diff remain correct — but **re-extract from the rebased branch** and
  re-run the diff gate there, since the guarantee is "exactly two lines against the
  definition in the branch we are merging into".
- **B9's assumptions re-checked.** Booking `UPDATE`s across all four apps are still only
  `vendor/services/bookings.service.ts:154,215` plus the narrow reject write, and no new
  `BEFORE UPDATE` trigger was added to `bookings`, so `bookings_pin_origin`'s ordering
  note still holds.

---

## Scope

**In scope.** A `/kiosk` surface in the vendor app: offering selection defaulted to
today, slot selection, customer details, attachment agreement + signature, PayMongo
payment, confirmation and reset. The full offering-attachment system: schema,
storage, vendor-side management UI, kiosk-side acknowledgement capture, **and
offering photos** (D10 — same table, public bucket). **Custody-
pattern offerings**, including the kiosk return-confirmation screen and the booking-
origin marker plus transition rule that make them completable (D2, B9-B11).

**Out of scope.** Booker-app changes of any kind. The mobile apps. Refunds.
**Payout disbursement**, which stays Command-only and is not something this plan
changes — see the note directly below.
Vendor-side editing or cancellation of a kiosk booking beyond what the existing
bookings page already does. Command-side reporting on attachments.

> **Two finish lines, and only the first one is the vendor's.** Reaching `completed`
> flips `booking_transactions.payout_status` from `held` to `releasable` **by trigger**
> — that is "the vendor has earned this", and after B10 the vendor and customer reach
> it at the desk with no Command involvement, for both patterns. Moving
> `releasable → released` is `release_booking_payouts()`, which opens with *"Only Ezzy
> staff can release payouts"* (`20260801000008:28`) and is **Command-only for every
> booking on the platform**, kiosk or not. Its own comment notes it *"RECORDS the
> disbursement — it does not move money; there is no payout rail in this system."*
> This plan does not change that and does not try to: vendor-self-serve disbursement
> is a payout-rail conversation, not a kiosk one.

**Cross-app flag.** Execution touches `vendor/` and `backbone/` only. `booker/` is
read for reference and **not modified** — which matters, because AGENTS.md makes a
change touching more than one app an approval gate. The one place this is load-
bearing is B4: the existing booker webhook settles kiosk payments **without being
edited**, and that is verified below, not assumed.

---

## What the investigation established

Findings that the plan depends on. Each was read in the file cited, not recalled.

| # | Finding | Evidence |
|---|---|---|
| F1 | **A shared "walk-in" profile per vendor is structurally impossible.** Two walk-ins taking the same slot collide on a unique index; two taking overlapping spans are refused by the placement trigger. Neither is capacity-aware — a capacity-5 schedule still refuses the second walk-in. **Re-verified 2026-08-29 against `develop`: the conclusion holds, the citation moved.** The overlap guard was rewritten onto timestamps by the overnight work (it now also spans `booked_date ± 1`, because a span can cross midnight), and the unique index is untouched. | `20260803000003_booking_units.sql:80` (`bookings_no_duplicate`, unchanged); **`20260828000001_schedule_window_minutes_expand.sql:384-394`** (*"You already have a booking that overlaps this time"* — was `20260803000005:156-166`) |
| F2 | **Every booking needs a real auth identity.** `bookings.booker_id` is `not null references public.profiles(id)`, and `profiles.id` is 1:1 with `auth.users`. | `20260507000004_bookings.sql:21`; `architecture/schema.md` → `profiles` |
| F3 | **The vendor's own session cannot insert the booking.** The INSERT policy is `booker_id = auth.uid() and is_active()` — a vendor-admin inserting on a customer's behalf fails RLS. Kiosk booking creation must be service-role. | `20260507000004_bookings.sql`, policy *"bookers can insert bookings"* |
| F4 | **The PayMongo webhook already covers kiosk payments — do not duplicate it.** It is keyed purely on `metadata.booking_id`, verifies the HMAC, and writes with service role. It carries no booker-scoping and no app-scoping, so a Checkout Session created from vendor on the same PayMongo account settles correctly against the same endpoint. | `booker/app/api/payment/webhook/route.ts:31-56` |
| F5 | **Only `create-session` needs a vendor twin, and its auth check must differ.** The booker route asserts `booking.booker_id === user.id` — structurally false for a kiosk booking, where the caller is the vendor and the booker is the customer. | `booker/app/api/payment/create-session/route.ts:38` |
| F6 | **Vendor already has the availability substrate.** `lib/occurrence.ts` (with `occurrence.test.ts`) and `lib/slots.ts` are existing, deliberate ports of the booker's occurrence and slot-division rules. `Schedule` already carries `durationMinutes`, `durationUnit` and `max` (capacity). Far less porting is needed than a fresh read suggests. | `vendor/lib/occurrence.ts`; `vendor/lib/slots.ts`; `vendor/lib/types.ts:215-239` |
| F7 | **What vendor lacks is occupancy, not availability.** No equivalent of `getSlotOccupancy` / `remainingForSlot` / `spanAvailable` / `resolveScheduleForTime`. Those four are the real port. | `vendor/services/schedules.service.ts` exports CRUD + counts only; cf. `booker/services/schedules.service.ts:163-247` |
| F8 | **Custody-pattern offerings strand at a kiosk.** `in_progress → returned` is booker-or-command only, and the auto-acknowledge job *"deliberately never touches in_progress"*. A walk-in who never logs in freezes the vendor's own payout permanently — rescuable only by Command override. Drove D2's **first** answer (filter them out); now **addressed** by B9/B10 rather than avoided. | `20260801000002_booking_fulfilment_states.sql:129,136`; `20260801000006_auto_acknowledge_bookings.sql:69` |
| F9 | **`legal_acceptances.source` has a CHECK that a kiosk value would violate.** `check (source in ('booker_signup','vendor_registration'))`, and `lib/legal.ts:99` types it identically. Recording kiosk consent needs a migration *first* — the file's own comment warns about this exact trap. | `20260819000001_legal_acceptances.sql`; `vendor/lib/legal.ts:87,99` |
| F10 | **New tables inherit no `service_role` privileges.** `20260620000001`'s grant is `ON ALL TABLES`, which binds only tables existing at the time, and sets no default privileges. This gap has shipped as a live bug **twice**. Every table in B7 must grant `service_role` explicitly. | `20260819000002_legal_acceptances_service_role_grant.sql` (corrective); `20260816000002` (first occurrence) |
| F11 | **Vendor is a single-route SPA.** `app/page.tsx` renders `<AppShell/>`; navigation is `page` state over `PAGE_IDS`, with `?page=` parsed from the URL. There is no route nesting to inherit chrome from. Drives D5. | `vendor/app/page.tsx`; `vendor/lib/types.ts:45-51`; `components/layout/AppShell/AppShell.tsx` |
| F12 | **The vendor visual suite is green and safe to extend.** 157 passed / 0 failed as of 2026-08-26. New kiosk baselines land on a stable base — unlike booker, whose suite is still broken and is explicitly not touched here. | `.plans/2026-08-25-vendor-visual-baseline-instability.md` (COMPLETE) |
| F14 | **A schedule's window is a LENGTH now, not an end time.** `schedules.end_time` is dropped; `window_minutes` replaces it. `slotsInWindow(start, end, duration)` survives only as an interim shim — **`deriveSlots(start, windowMinutes, duration)` is "the one that survives"**, and it is already present in `vendor/lib/slots.ts`. This *shrinks* I1: vendor gained slot-derivation helpers while this plan was parked. | `20260828000001:…` (`window_minutes` column); `vendor/lib/slots.ts:99-141` |
| F15 | **Overnight windows are real, and `booked_date` is the date a booking STARTS.** The midnight guard this plan quoted as a standing invariant was deliberately removed. Consequence the overnight plan settles explicitly: *"the 00:00 slot of a Friday 23:00–01:00 window is stored as SATURDAY 00:00."* A kiosk that defaults to "today" and labels chips Today/Tomorrow can therefore write a booking dated tomorrow while saying Today. Drives B16. | `20260828000001:215-232` |
| F16 | **Unbounded list queries are now a closed defect class, and this plan must not re-open it.** `lib/pagedFetch.ts` exists for exactly this, with a measured 19.7% payout understatement in its header as the reason. Any kiosk query returning a list must use it. | `vendor/lib/pagedFetch.ts:1-19` |
| F17 | **`validate_booking_status_transition()` is still last defined in `20260801000002` on `develop`** — nothing re-created it. B10's reproduced body is therefore still the correct base, and its two-line diff still applies. Re-verified 2026-08-29. | `git grep` over `develop -- supabase/migrations` |
| F13 | **Precedents to copy, not invent.** Private bucket + `(storage.foldername(name))[1]::uuid` + `has_vendor_role` object policies; append-only evidence table with snapshotted columns and no INSERT policy for `authenticated`; atomic service-role create-with-rollback route. | `20260706000002_vendor_kyc_storage.sql`; `20260819000001_legal_acceptances.sql`; `vendor/app/api/auth/register/route.ts` |

### Claims checked and corrected

Per §4, these were suspected before reading and did **not** survive:

- **"The webhook must be duplicated into vendor."** *False alarm* — F4. Adding a
  second endpoint would mean two registered PayMongo webhook URLs racing on the same
  `is_paid` transition. The existing idempotent `WHERE is_paid = false` update makes
  that survivable but pointless. **Do not build it.**
- **"Booker's slot logic must be ported wholesale into vendor."** *Downgraded* — F6.
  Two of the four pieces already exist in vendor with tests. Only occupancy and span
  checking are genuinely missing (F7).
- **"Kiosk can reuse the booker's `create-session` route."** *Escalated* — F5. Not
  merely inconvenient: its ownership assertion is guaranteed to reject every kiosk
  booking, so this is a hard fork of that route, not a reuse.

---

## Regression surface — what was checked, and what it cost

Every existing feature this plan could plausibly break, checked against the code
rather than reasoned about. **Seven surfaces came back clean; three did not.**

### Verified safe — no change required

| Surface | Why it survives | Evidence |
|---|---|---|
| **Service worker / PWA** | Navigations are **network-first**, falling back to `offline.html` and *"Never serves stale app HTML from cache."* A new `/kiosk` route needs no SW change and cannot be served stale. Static assets are cache-first but Next fingerprints them. | `vendor/public/sw.js:38-42` |
| **Session middleware** | `proxy.ts` matches every non-static path and does one thing — refresh the session. It guards no routes, so `/kiosk` neither bypasses a guard nor needs adding to one, and it gets the cookie refresh it depends on. | `vendor/proxy.ts:4-31` |
| **B9's pin vs. existing writers** | A full-row UPDATE would now raise. Across all four apps, booking UPDATEs exist in **one file** and all write narrow column sets; the SQL writers and the PayMongo webhook are equally narrow; **no upserts on `bookings` anywhere**. | `vendor/services/bookings.service.ts:154,164,215`; grep across `booker/ command/ vendor/ ezzy-vendor-mobile/` |
| **Vendor's customer contact panel** | `get_booker_contacts` filters on the *caller's* vendor role and booking existence — **not** on the booker's profile status. Kiosk customers' names, emails and phones therefore render normally in the vendor portal. | `20260620000002_booker_contacts_rpc.sql:25-31` |
| **Money ledger vs. abandoned kiosk bookings** | `create_booking_transaction` fires **only on `is_paid` false→true**, so B6.3's abandoned unpaid bookings hold slot capacity but create **no** ledger row and cannot distort payouts. | `20260725000002_booking_transactions.sql:139,146` |
| **Storage policy namespace** | Existing `storage.objects` policies are named `kyc *` / `vendor admins *`. B8's are `attachments *` / `signatures *` — no collision, and policies are per-bucket so `vendor-kyc` behaviour is untouched. | `20260706000002_vendor_kyc_storage.sql` |
| **Realtime subscriptions** | `postgres_changes` payloads carry flat `bookings` columns and the handlers patch named fields onto existing state. An added `booked_via` column is ignored by every subscriber. | `architecture/booking-flow.md` → "Live status updates" |

### Found broken — fixed in this plan

- **R1 (critical) — kiosk accounts were a dead end.** `verifyBookerAccess` requires a
  `booker` portal row, a `member` role row **and** `status = 'active'`; `handle_new_user()`
  grants none of them (`status_id = 3`). The customer could not log in, could not read
  their own booking, and **could not sign up either**, because both booker's register
  route and vendor's `isEmailAvailable` treat an existing `profiles` row as "taken".
  **An earlier draft of B2 explicitly instructed leaving it that way.** Fixed: B2 now
  mirrors `booker/app/api/register/route.ts` in full.
- **R2 — B10 could silently break the payout timer platform-wide.** Reproducing
  `validate_booking_status_transition()` risks dropping `new.status_changed_at := now()`,
  which every 3-day auto-acknowledge reads. Loss would freeze fulfilment→completed for
  **all** bookings, silently, for three days before anyone noticed. Fixed: called out
  explicitly in B10 alongside the `v_third_party` reason-check block.
- **R3 — email namespace narrowing.** A kiosk profile takes the address platform-wide,
  so that person can never register a *vendor* account with it. Pre-existing behaviour
  (equally true of any booker today), but the kiosk widens who hits it and they hit it
  without choosing to sign up. Not fixable without a cross-app change; documented in B2
  and assumption 7, mitigated by explicit kiosk consent copy.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains — §7. -->
> Grouped by **topic, not number** — D8/D9 sit with D2 because they extend it, D10
> with D4. Numbers record the order questions were asked, so they are not sequential
> down the page. Nothing is missing: D1–D10 are all present.

- **D1 — Customer identity at the kiosk** → **Auto-create a customer account**
  (resolved 2026-08-26). A service-role route looks the auth user up by email and
  creates one if absent, then books against that real `booker_id`. Chosen because it
  is the only option requiring **no change to `bookings`** — F1's unique index, F2's
  FK, the placement trigger, the actor-aware status machine and `get_booker_contacts`
  all keep working untouched. Cost accepted: accounts are created for people who did
  not sign up, so email is mandatory and consent must be recorded (B2, and F9's
  migration).
- **D2 — Custody-pattern offerings** → **Supported, via a pinned origin marker plus
  a kiosk-side return confirmation** (resolved 2026-08-26, **superseding this
  decision's first answer**). ~~Session-pattern only in v1~~ — kept struck rather
  than deleted, per the status model.

  **Why it changed.** F8's deadlock is not a two-party protection being enforced; it
  is a protection whose second party **structurally cannot participate**. A kiosk
  customer can never satisfy `v_booker := auth.uid() = new.booker_id`
  (`20260801000002:103`), can never flag a dispute (same check at `:133`), and cannot
  even read the booking — the auto-created profile lands at `status_id = 3`, so
  `is_active()` is false. Filtering custody out avoided the deadlock; it did not make
  the check meaningful.

  **The chosen shape:** **(A)** a pinned `booked_via` marker on `bookings` plus a
  narrowly widened transition rule (B9, B10), and **(C)** a kiosk close-out screen
  where the customer confirms on the tablet in front of them (B11). D9 later extended
  the same treatment to session bookings.

  ⚠️ **The trade, stated plainly:** the database cannot distinguish "the customer
  tapped it" from "the vendor tapped it" — the session is the vendor's either way.
  (C) buys the *shape* of two-party attestation, not the *guarantee*. What the marker
  does buy is that the widened rule reaches **only** kiosk-originated bookings, so
  every booker-originated custody booking keeps its counterparty check exactly as it
  is today.
- **D8 — How a vendor-attested return is audited** → **A fixed, system-written note,
  not mandatory free text** (decided 2026-08-26, my call).
  ⚠️ This **differs from the recommendation I gave when D2 was chosen**, where I
  suggested requiring a typed reason. On reflection that is the wrong instrument: a
  handback at a front desk is routine and high-frequency, and a mandatory free-text
  box on a routine action degrades into "ok"/"x" within a week — noise wearing the
  costume of an audit trail. Everything an auditor needs is already structural:
  `booking_status_log` records the actor and the transition (`log_booking_status_change()`),
  and `booked_via` records the origin, so "a vendor closed a kiosk custody booking" is
  fully reconstructable without anyone typing. The return route therefore sets a fixed
  `app.status_change_note` — `'Return confirmed at kiosk'` — which the existing audit
  trigger already persists.
- **D9 — Session bookings close at the desk too** → **Widen `fulfilled → completed`
  the same way, in the same migration** (resolved 2026-08-26).
  Found by tracing the payout path after D2 was settled: the plan as first drafted was
  **lopsided**. A kiosk *rental* reached `releasable` instantly, while a kiosk
  *session* — same money, same customer standing there — waited 3 days for
  `auto_acknowledge_bookings()`, because `fulfilled → completed` is
  `v_booker or v_system or v_command` (`20260801000002:120`) and the vendor is
  deliberately not on that list. The customer who could resolve it cannot log in.
  Both patterns now take the same kiosk-gated clause, so both close at the desk with
  no wait and no Command. The auto-acknowledge timer remains as the fallback for a
  booking nobody closes.
  ⚠️ This extends D2's vendor-self-attestation trade from rentals to sessions. It is
  the same trade, not a new one, and it applies **only** to `booked_via = 'kiosk'`.
- **D3 — Where the customer pays** → **Redirect the kiosk to PayMongo**
  (resolved 2026-08-26). Matches the booker exactly, one code path. Two consequences
  accepted and mitigated, not hidden: the customer operates the vendor's tablet on an
  external site (B5), and an abandoned payment parks the kiosk off-app (B6).
- **D4 — Attachment scope** → **Build the full system** (resolved 2026-08-26).
  Tables, storage, vendor management UI, kiosk agreement + signature capture. This is
  the larger half of the plan; B7/B8/I2/I5 carry it.
- **D10 — Offering photos are in, in a PUBLIC bucket** (resolved 2026-08-26).
  Photos ride the `offering_attachments` table as `kind = 'photo'` — an image *is* a
  file attached to an offering, so it inherits `sort_order`, `is_active`, the
  vendor-admin RLS and the one management UI for nothing. But they get their **own
  public bucket**, and that half is not tidiness:
  `offering-attachments` is private and served by signed URLs, which is right for a
  waiver fetched once at booking time and **wrong** for photos, which a kiosk grid
  fetches on every load — behind signed URLs that is a round trip per tile plus URLs
  that expire, for pictures the vendor is publishing to attract customers anyway.
  Both migrations were still unapplied, so this cost a widened CHECK and one extra
  bucket rather than a corrective migration.
  ⚠️ Public means **anything uploaded there is readable by anyone holding the URL**.
  The row still governs whether the app *lists* a photo; public read governs only
  whether a known URL resolves. I2 must therefore keep the photo picker and the
  document picker as separate surfaces, so a waiver cannot be dropped into the public
  bucket by accident.
- **D16 — Stage 0 migrations are re-cut at `20260829…`** ✅ **DONE (2026-08-29)** —
  executed after the rebase; the four files now sort after `20260828000003`. (Decided
  2026-08-29, my call — it is forced, not a preference.) The four files on `feature/kiosk` are numbered
  `20260826…`, which sorts **before** the `20260828…` overnight migrations already
  applied to local, staging and production. Applying them as-numbered would insert
  history behind the current head. The SQL bodies are unaffected by the renumber; two
  of them are affected by the schema change, which is a separate matter (B16, I1).
- **D15 — kiosk work stays on `feature/kiosk` in each repo, brought up to date by
  REBASING onto `develop`** (resolved 2026-08-29; method revised from "merge" to
  "rebase" the same day, on the user's instruction — they run all git operations
  themselves). Keeps all three repos on one branch name and keeps four unapplied
  migrations off the shared `develop`. Rebase over merge gives a linear history with
  the kiosk commits sitting on top of the overnight work, which is what makes the
  `20260829…` renumbering (D16) obviously correct rather than merely chosen.
  ⚠️ **Claude does not run git commands in this repo** — commits are GPG-signed and
  signing needs the user's passphrase (a `git merge` attempt on 2026-08-29 died at
  `gpg: signing failed: Operation cancelled`). Git steps are handed over as commands.
- **D18 — the schema deploy is split: staging early, production last**
  (resolved 2026-08-29). B17a runs at **Stage 3b**, right after the attachment editor;
  B17b runs at **Stage 7**. Staging and production were one item until this was
  challenged, and treating them as one decision forfeited the only environment whose job
  is rehearsal: twelve *needs live env* rows — including **B4**, which puts F4's
  "no second webhook" under test — would all have come due after the feature was built
  on top of them.
  **Accepted cost:** the migrations stop being editable at Stage 3b rather than Stage 7
  (see B17a). Judged worth it because by then real code has exercised every table and
  constraint, so a further schema edit is unlikely, whereas an environment difference is
  exactly what F18 showed to be likely.
- **D17 — `booking_acknowledgements` is append-only structurally, not by convention**
  (resolved 2026-08-29). Adds one line to B7's migration:
  `revoke update, delete, truncate … from service_role`. Chosen over documenting the
  gap because an evidence table whose guarantee rests on "the only writer happens to
  behave" is not an evidence table. Scoped to **this table only** — an
  `alter default privileges` revoke would change every future table in the schema,
  which is a schema-wide policy call and not this migration's to make.
  Nothing legitimate loses a capability: the kiosk route only INSERTs, verified live.
- **D11 — The attachment model is two kinds and one lever** (resolved 2026-08-26).
  `kind in ('photo','document')`, and **`requires_agreement` is dropped entirely**.
  Every document must be accepted before payment — that is the product rule, not a
  per-row choice — so the column would have carried `true` forever: a constant
  pretending to be data. `kind = 'document'` **is** the agreement requirement, and
  `requires_signature` is the only per-document lever the vendor sets.
  The old `info | waiver | terms` sub-types are gone too: "Court Rules" and "Waiver"
  are distinguished by `title`, so those values were a vocabulary nothing read or
  branched on. A new CHECK replaces the old implication constraint — a **photo cannot
  demand a signature**, refused by the database rather than defended against at render
  time. Both migrations were unapplied, so this cost an edit, not a corrective.
  ⚠️ Accepted consequence: an offering cannot attach a purely **informational** leaflet
  (a map, parking directions) without forcing an acceptance tick. Adding that back is a
  migration, not a UI change.
- **D12 — The kiosk launcher is a sidebar item** (resolved 2026-08-26).
  Found by review: B3 and B5 both referred to "the vendor-facing kiosk launcher" as if
  it existed, and **no item created it** — the feature had no entry point at all.
  It goes in the sidebar, below Settings and Calendar.
  ⚠️ **This is a deliberate exception to "the sidebar is untouched", which held until
  now** — the user was shown that it changes the sidebar and chose it anyway.
  ⚠️ **It must NOT become a `PageId`.** See B13: a new `PAGE_IDS` entry would make the
  shell render `Sidebar`/`TopBar`/`TabBar` around the kiosk, which is precisely what
  D5 chose a separate route to avoid. The item is a link to `/kiosk`, not a page.
- **D13 — Offering cards show their attachment state** (resolved 2026-08-26,
  superseding the DEFERRED entry that said otherwise). Each card in the offerings list
  carries its photo, document count and a signature flag — and, when it has neither,
  the line *"None — customers go straight to payment"*. That sentence is B12's
  conditional-step rule stated where the vendor is actually making the decision, which
  is worth more than the minimalism of leaving it out.
- **D14 — `start_url` stays `"/"`; the manifest gains a shortcut** (decided
  2026-08-26, my call — B14 originally said "a `shortcuts` entry, or a dedicated
  `start_url`", and that "or" would have been implemented wrong half the time).
  Pointing `start_url` at `/kiosk` would hijack **every** vendor's installed PWA,
  including the ones who installed it to do admin work on a phone — one tablet's mode
  is not a property of the app. So `start_url` stays `"/"`, the **redirect in
  `useAppShell` does the real work** (the flag read is synchronous `localStorage`, so
  it resolves before first paint and no admin chrome flashes), and `shortcuts` adds a
  long-press "Kiosk Mode" entry as a convenience — never as the mechanism.
- **D5 — Where kiosk lives in the app** → **A dedicated `/kiosk` route segment**,
  not a new `PageId` (decided 2026-08-26, my call — recorded per §7 because it is
  structural). Per F11 the shell renders `Sidebar`/`TopBar`/`TabBar` around every
  page, so a `PageId` would mean threading a "hide all chrome" flag through the shell
  and trusting it — the admin surface would remain *mounted*, one state bug from
  visible. A sibling route under `app/kiosk/` with its own `layout.tsx` cannot import
  the shell at all, which makes the isolation structural rather than conditional. It
  also gives the tablet a real bookmarkable URL. `PAGE_IDS` is left untouched, so
  `?page=` deep-linking is unaffected.
  ⚠️ **Amended by D12:** the sidebar gains one item — a *link* to `/kiosk`, never a
  `PageId`. B13 carries the reason that distinction is load-bearing.
- **D6 — Signature capture** → **Hand-rolled `<canvas>` + Pointer Events**
  (decided 2026-08-26, my call). A signature pad is ~80 lines of pointer handling;
  a library would trip AGENTS.md's dependency approval gate and pull a bundle into a
  PWA for one screen. Pointer Events cover mouse, touch and stylus in one API.
- **D7 — Date-granular offerings at the kiosk** → **Excluded from v1**
  (decided 2026-08-26, my call — flagged prominently rather than left implicit).
  `architecture/booking-flow.md` documents the booker's date-granular arm as a **dead
  end**: the mode is detected and the range computed, but no render arm consumes it
  and `canNext` can never be satisfied. Building a second implementation of a mode the
  first app cannot complete would fork an unfinished behaviour. The kiosk therefore
  lists **time-granular, session-pattern** offerings only. See DEFERRED.
- **D19 — How heavy should the kiosk scrims be, and does the launcher change too?**
  → **(b) split by audience** (resolved 2026-09-02). Launcher takes the app's standard
  treatment; the exit dialog, which covers a *customer* surface, takes a near-opaque
  scrim in the login page's own ink with no blur.
  - **(a) Conform exactly** — both dialogs adopt the app's `rgba(0,0,0,0.5)` +
    `blur(6px)`. Cheapest, zero new visual language, and the blur alone fixes the
    legibility complaint. Risk: `0.5` is *less* opaque than today, so it rests entirely
    on the blur being enough.
  - **(b) ⭐ Recommended — split by audience.** The **launcher** is an admin modal over
    the dashboard: give it (a), matching its eight peers. The **exit dialog** guards a
    *customer* surface, so give it a near-opaque `rgba(4, 6, 14, 0.94)` — the login
    page's own ink, so it is a reuse and not an invention — and **no blur**, because at
    94% there is nothing left to blur and `backdrop-filter` is the expensive property on
    a cheap Android tablet. Answers the report directly ("like the login form") and is
    faster than (a).
  - **(c) Both near-opaque.** Consistent between the two kiosk dialogs, but makes the
    launcher — an ordinary admin modal — heavier than every other modal in the app.

- **D20 — Which phone rule applies to a kiosk *customer*?** → **The PH-only payout-grade
  rule** (`normalisePhMobile`), directed 2026-09-02. Recorded as a decision because
  `lib/payout/phMobile.ts:78-88` explicitly warns the two rules in this app are
  different **on purpose**: registration uses `isValidPhone` (7–15 digits, any country)
  for a *contact* number, and the strict PH rule exists for *payout* fields where money
  is sent. A kiosk customer's mobile is a contact number, so this deliberately applies
  the stricter of the two.
  ⚠️ **Stated consequence:** a visitor with a non-PH mobile cannot enter their number.
  Acceptable because the field is **optional** and email is the booking's identity
  (`useKioskBooking.ts:198-199`) — but it is a real narrowing, and if a kiosk is ever
  sited somewhere with foreign walk-ins, this is the line to revisit.

- **D21 — Does the kiosk's gradient ground stay theme-aware, or go dark-only?**
  → **(a) theme-aware gradient** (resolved 2026-09-02). Dark keeps login's exact ramp;
  light gets a light equivalent in the same hue. The kiosk stays theme-responsive, no
  card or text token is disturbed, and `ux-design` §6 holds. Accepted trade: on a
  light-set tablet the kiosk will not look identical to the login page.
  **Agreed shape:**
  ```css
  .root { background: linear-gradient(145deg, #f8fafc 0%, #eef2ff 55%, #e0e7ff 100%); }
  :global(.dark) .root { background: linear-gradient(145deg, #04060e 0%, #070b17 55%, #0d1b4b 100%); }
  ```
  - **(a) ⭐ Recommended — theme-aware gradient.** Dark theme gets login's exact ramp;
    light theme gets a light equivalent built from the same hue. Everything inside the
    kiosk keeps working untouched, `ux-design` §6 is satisfied, and the change stays one
    property. What it does *not* do is make the kiosk look identical to the login page on
    a light-set tablet.
  - **(b) Dark-only, exactly like login.** Truest to "like the login page", and defensible
    — a kiosk is a fixed branded installation, which is the same argument that earned the
    login page its hardcoded exception. **But the cost is not one property:** every card,
    input and slot inside still reads `--sp-card-bg` / `--sp-strong`, so a light-set
    tablet would render white cards on a near-black ground. Doing this properly means
    forcing the `dark` class over the kiosk subtree, which reaches into `next-themes` and
    is a materially bigger change than the request implies.
  - **(c) Gradient in dark only, flat `--sp-page-bg` in light.** Cheapest, and honest
    about only the dark case having been designed — but leaves light looking like the
    thing that prompted the request.

- **D22 — How are the kiosk chip/slot labels made to stack (I13)?** → **`display: block`
  on the four spans** (resolved 2026-09-02). Four properties in one file; each container's
  existing `text-align` still applies to block children and `.nextDay`'s `inline-block`
  is left alone. The flex-column alternative was declined: it restructures two components'
  layout to fix a spacing bug and would turn `.nextDay` into a flex item, changing how its
  own margin behaves. `.dateSub` also goes 2px → 4px, since 2px only ever looked adequate
  while it was inert.
- **D23 — What may be typed into the kiosk mobile field, and is a refusal explained
  (I14)?** → **digits plus `+ ( ) - . space`, with the message shown** (resolved
  2026-09-02). The character set is exactly what `normalisePhMobile` accepts, so every
  valid spelling stays typeable and a pasted formatted number keeps its shape. Stricter
  sets were declined for making the space and dash keys feel dead, and digits-only for
  making `+639…` untypeable. Silent stripping was declined under `ux-design` §4: a paste
  that loses characters with no explanation reads as a bug.

- **D24 — How should the kiosk launcher stop losing the stacking contest (B28)?**
  → **(a) port to Radix** (resolved 2026-09-02, executed 2026-09-03). ⚠️ **Correction:
  necessary but NOT sufficient** — it made the two dialogs peers, and peers still stack by
  DOM order, so the launcher is still covered. The port is kept for the focus trap,
  Escape handling and consistency it brings; the actual fix moved to **D25**. Option (b)
  remains rejected for the reason recorded below, which the port has now also demonstrated
  empirically.
  - **(a) ⭐ Recommended — port the launcher to Radix `Dialog`,** as its eight peers
    already are. Radix portals to `<body>`, so ordering becomes DOM order among equals
    rather than a z-index that cannot win, and it brings focus trapping and Escape
    handling the hand-rolled version does not have. Largest edit of the three, but it
    removes the whole class of bug instead of this instance.
  - **(b) Raise the launcher's `z-index`.** One line — and it **does not work**: the
    launcher is not in the root stacking context, which is exactly why 60 already loses to
    50. Listed so it is visibly rejected rather than tried later.
  - **(c) Suppress the completion modal while the launcher is open**, the same way
    `AppShell` already suppresses the guide modal for the completion modal. Small and
    consistent with existing precedent, but it fixes this *pair* only — the next
    full-screen dialog re-opens the bug.

- **D25 — How should the kiosk launcher and the account-completion modal be
  coordinated (B28)?** → **(a) refuse to open the launcher while the account is
  incomplete, and say why** (resolved and implemented 2026-09-03). The open caveat below
  was checked before implementing: `isAccountComplete = hasOffering && hasPayoutDetails`,
  so an incomplete account really can have **no payout destination** — the copy was not
  overstating, and (c) is correctly rejected.
  - **(a) ⭐ Recommended — refuse to open the launcher while the account is incomplete,
    and say why.** The completion modal's own copy is *"1 step left before you can take
    bookings"*. A kiosk exists to **sell bookings**, so a vendor who cannot take them must
    not be able to start one — otherwise a walk-in customer fills in their name, phone and
    email and only then hits a failure. Clicking Kiosk Mode would open the completion
    modal instead, which is the thing they actually need to finish.
    `AppShell.tsx:206` already passes an `accountIncomplete` flag around, so the state is
    to hand.
  - **(b) Suppress the launcher only while the completion modal is *open*** —
    `{kioskPrompt && !completionState.modalOpen && …}`. One line, and it mirrors the
    existing `suppressAutoOpen` precedent exactly. But clicking Kiosk Mode would then do
    nothing at all in that state, which is a worse failure than the one being fixed.
  - **(c) Close the completion modal when the launcher opens.** Lets the vendor through —
    into a kiosk that, per the app's own copy, cannot take a booking. Rejected unless
    "cannot take bookings" turns out not to be literally true.

  ✅ **That question was checked before implementing** (2026-09-03): `isAccountComplete`
  is `hasOffering && hasPayoutDetails`, computed by the `vendor_account_completion` view.
  Incomplete can mean **no active payout destination**, so the copy stands and (a) holds.

- **D26 — How far does the "Write text" fix go (B29)?** → **(a) finish the feature**
  (resolved and executed 2026-09-03). Option (c) stays recorded as rejected.
  - **(a) ⭐ Recommended — finish the feature.** "Write text" opens an inline **draft** held
    in local state; nothing is inserted until there is content, so the constraint is
    satisfied by construction rather than worked around. Existing documents become editable
    too — `updateAttachment` already accepts `body`, and a vendor must be able to fix a
    typo in a waiver they are asking customers to accept. Largest of the three, and the
    only one that makes the kiosk's agreements step usable for anything but an uploaded
    file.
  - **(b) Stop the crash only — remove or disable "Write text".** Honest and small: the
    button currently promises something the app cannot do. Uploaded-file documents keep
    working, so the kiosk's agreements step still functions. Defensible if this needs to
    ship now, but it leaves `body` as a column the customer sees and no one can populate.
  - **(c) Seed a placeholder body.** ✖ **Rejected, recorded so it is not attempted:** it
    satisfies the constraint by creating an active document row, which per B12 puts an
    agreements step in front of every kiosk customer for that offering. A silent
    customer-facing change is worse than the crash.

- **D27 — Does I20 centre only "Your details", or every constrained step?**
  → **(a) centre all three** (resolved and executed 2026-09-05). Option (c) — centring
  `.content` — stays rejected: it would also centre the offering and slot grids, which are
  full-bleed by design.
  - **(a) ⭐ Chosen — centre all three** (`.fields`, `.docs`, `.summary`). The
    confirmation step already centres, so today the flow runs left, left, left, then
    jumps. Centring the other three removes the jump instead of adding one, and it is the
    same single property on each. Wider than the words of the request, narrower than its
    intent.
  - **(b) Centre only `.fields`.** Literally what was asked, one line. But it inserts a
    sideways jump between "Your details" and "Before you book" that is not there now — the
    reported problem, relocated.
  - **(c) Centre the `.content` wrapper instead.** One rule for everything, but it would
    also centre the **offering grid and slot grid**, which are full-bleed on purpose and
    should keep filling the screen. Rejected.

- **D28 — How is the login-baseline/env mismatch resolved (I21)?** → **(b) restore the
  `.env.local` values** (resolved 2026-09-05). Verified: 16/16 login tests pass.
  ⚠️ Chosen with its limitation understood — (b) fixes the instance, not the class. (c)
  stays on the table if this recurs.
  - **(a) Re-record the 15 login baselines** against the current values. One scoped
    `--grep "login" --update-snapshots`. Fastest, and correct *if* "STAGING Ezzy Vendor" is
    what local should say — but it bakes one machine's config into a shared, committed
    artefact, so the next person with different values hits the same 15 failures.
  - **(b) Restore the previous `.env.local` values** and leave the baselines alone. Also
    fast, and it keeps the committed baselines matching whatever they matched before — but
    it is a manual step nothing enforces, and the same drift recurs the next time someone
    points local at a hosted config.
  - **(c) ⭐ Recommended — pin `APP_NAME`/`APP_DOMAIN` for the visual run.**
    `playwright.config.ts` already boots the dev server with `PW_TEST=1`; adding two fixed
    env values there makes the baselines depend on the suite rather than on whoever ran it.
    Precedent is in the same file: `pilot.spec.ts` already pins a **fixed instant** so that
    screens rendering today's date do not drift. This is the same problem with the same
    shape of answer. Slightly more work, and it ends the class rather than this instance.


---

### Branch state — ✅ resolved 2026-08-29

All three repos now sit on `feature/kiosk` on top of `develop`. `backbone` was rebased
by the user after the check below; re-verified afterwards as **0 behind, 1 ahead**
(`11b4e16 Initial kiosk migrations`), with all three `20260828…` migrations present in
the tree. The blocking untracked snippet was removed by the user.

<details><summary>The state that prompted the rebase (kept for the record)</summary>

### ~~Branch state — verified 2026-08-29, and `backbone` is the outstanding one~~

Checked per repo rather than assumed, because the rebase landed unevenly:

| Repo | `feature/kiosk` vs `develop` | State |
|---|---|---|
| `vendor` | 0 behind, 1 ahead (`466cdda`) | ✅ **rebased** — the `lib/legal.ts` widening sits on top of the overnight work |
| `command` | 0 behind, 0 ahead | ✅ in sync, nothing kiosk-specific yet |
| **`backbone`** | **4 behind**, 1 ahead (`055d185`) | ❌ **NOT rebased** — still lacks all three `20260828…` overnight migrations |

⚠️ **`backbone` is the one that matters for Stage 0**, and it is also the one blocked:
its working tree is checked out on `master`, and `git checkout feature/kiosk` **aborts**
because an untracked `supabase/snippets/Untitled query 756.sql` would be overwritten.
That file is **byte-identical** to the copy tracked on `feature/kiosk` (verified by
`diff`), so nothing is at risk — but the directory is `root:root 755`, so it cannot be
moved without `sudo`. Commands for the user are in "Git handover" below.

**No `origin/feature/kiosk` exists in any repo** — these branches are local only, so
nothing needs pushing before this can proceed.

</details>

---

## BLOCKERS

> **Numbering note (2026-09-02):** there is no **B18** and never was — the number was
> skipped when B19–B21 were added mid-execution. Recorded so the gap reads as an
> accident of numbering rather than a lost item. B17 is split into B17a/B17b.


### B1 — Kiosk booking creation must be an atomic service-role route  ✅ DONE (2026-08-29)
> `app/api/kiosk/booking/route.ts`. Guard verified live (401/403/400). Sends no
> `price_paid`, `end_time` or `fulfilment_pattern` — all trigger-derived. Sets
> `booked_via: 'kiosk'`. Uses `slotDate()` for `booked_date`, so a post-midnight slot is
> filed under the day it starts. Signature uploads **before** the acknowledgement insert,
> per the corrected order; rollback deletes the booking and sweeps the object.
> **Beyond what the item asked:** acknowledgement titles/versions/kinds are snapshotted
> from the DATABASE, not from the request body — a tampered client must not be able to
> record consent to a document that was never shown, on the one table that exists to be
> evidence. The route also refuses to proceed unless every active document is ticked.
> ⚠️ Happy path unrun — needs a signed-in session (Stage 4).
**Files (new):** `vendor/app/api/kiosk/booking/route.ts`
**Pattern to follow:** `vendor/app/api/auth/register/route.ts` (atomic create + rollback)

Per F3 the vendor's RLS-bound session cannot insert a booking whose `booker_id` is
someone else's, so this must run service-role. That removes RLS as the guard, which
makes the route's **own** caller check the only thing standing between an anonymous
POST and arbitrary booking creation.

**Fix approach.** SSR cookie client → `getUser()` → 401 if absent. Then confirm the
caller holds `vendor-admin` on the `vendor_id` being booked (service-role query
against `vendor_members` + `roles`) → 403 otherwise. Never trust a `vendorId` from
the body without that check. The route then performs, in order: resolve-or-create the
customer (B2) → insert the booking → **upload the signature (B8) → insert the
acknowledgement rows complete (B7)**. Roll back created rows and uploaded objects on any
later failure, and mirror the register route's `maxDuration` bump since this is several
round trips.

⚠️ **That order is load-bearing, and it is the REVERSE of what this item said until
2026-08-29.** It previously read *"insert acknowledgement rows → upload the signature"*,
which **cannot work** after D17: the signature path is
`{vendor_id}/{booking_id}/{ack_id}.png`, so writing it meant inserting the row, learning
its id, uploading, then **UPDATE**ing the row to set `signature_path` — and D17 revoked
UPDATE on `booking_acknowledgements` from `service_role` to make the table append-only.
The route would have failed on its last step with `permission denied`, in production,
only for offerings that require a signature.

**The fix costs nothing:** generate the acknowledgement's UUID in the route
(`crypto.randomUUID()`) *before* touching the database, upload the signature to the path
built from it, then INSERT the row **once**, complete, with `id` and `signature_path`
already set. One insert, no update, and the row is never briefly wrong.
⚠️ Rollback must now also sweep the uploaded object — an upload that succeeds before a
failed insert leaves bytes with no row pointing at them. `sweepStaging` in
`app/api/auth/register/route.ts` is the existing precedent for exactly this.

**Sets the origin marker.** The insert carries `booked_via: 'kiosk'` (B9). This is
the *only* place it is ever written — B9's pin makes every later write raise — so a
booking created by any other path is `'booker'` by default and keeps the unwidened
custody rule. Getting this wrong in one direction sells a custody booking that cannot
be completed; in the other, it hands a booker-originated booking the widened rule.

**What is deliberately NOT re-implemented.** Capacity, slot-boundary, occurrence and
price validation are **not** re-checked in the route. Service role bypasses RLS but
**not triggers**: `check_booking_consistency()` and `check_booking_placement()` still
fire, and `price_paid` is still trigger-derived (`20260803000004`). Re-deriving price
in the route would create a second source of truth for money — the exact defect
`20260803000004` closed. The route sends no `price_paid`, no `end_time`, no
`fulfilment_pattern`.

---

### B2 — Customer provisioning, and the consent record it obliges  ✅ DONE (2026-08-29)
> `lib/kioskCustomer.ts`. Mirrors `booker/app/api/register/route.ts`: profile + `active`
> status + `booker` portal + `member` role + consent, with `auth.admin.deleteUser` rollback
> at every step. Consent written LAST, so no path records consent for an account that
> does not exist. The lookup race is handled by catching the duplicate and re-running the
> lookup. ⚠️ Unrun against a live create.
**Files (new):** `vendor/lib/kioskCustomer.ts` (server-only helper, called by B1)
**Coupled to:** B7's migration (F9) — **must ship in the same batch**

D1 creates an auth account for someone who did not sign up. Two failure modes to get
right:

1. **Lookup must precede create — and the lookup is a race.** A returning customer must
   resolve to their existing `booker_id`, or F1's unique index turns a legitimate second
   visit into a spurious `23505`. Look up by email; create only on miss.
   ⚠️ **Two tablets is not hypothetical, and neither is a double-tap.** Two concurrent
   requests can both miss the lookup and both call `createUser`; the loser gets a
   duplicate-email error from GoTrue mid-booking, in front of a customer. Handle it the
   way the booking service already handles `23505`: catch the duplicate, re-run the
   lookup, proceed with the row that won. Do **not** pre-check harder — the gap between
   check and insert *is* the bug, and no amount of checking closes it.
2. **Consent is not optional.** Creating an account without recording what the person
   agreed to is exactly the gap `legal_acceptances` exists to close. Per F9 the
   table's CHECK constraint and `lib/legal.ts:99`'s union both reject a kiosk value
   **today**, so the migration in B7 must widen `source` to include `kiosk_booking`
   *before* any code writes it. Reuse `buildAcceptanceRows` — it already snapshots IP,
   user-agent and the client-reported version.

**Fix approach — provision a REAL booker account, mirroring `booker/app/api/register/route.ts`.**
`admin.auth.admin.createUser({ email, email_confirm: true })` with no password, then
the same four steps booker's own registration performs:

1. `profiles`: write `full_name`, `phone`, and **`status_id` = the `active` status id**
2. `user_portals`: insert the `booker` portal row
3. `user_roles`: insert the `member` role row
4. `legal_acceptances`: `buildAcceptanceRows(... source: 'kiosk_booking')`

⚠️ **This corrects an earlier draft of this item (2026-08-26), which said to leave the
profile at the default `status_id = 3` and explicitly warned against "fixing" it by
activating. That was wrong, and it would have shipped a dead-end account.** The
regression audit traced what `verifyBookerAccess`
(`booker/services/booker.service.ts:9-23`) actually requires — a `user_portals` row for
`booker`, a `user_roles` row for `member`, **and** `status = 'active'`. A profile left
at `3` has none of the three, which means the customer:

- cannot log in to booker (`no_access`), even after a password reset;
- cannot read their own booking, because every booking RLS policy gates on
  `is_active()`; **and**
- **cannot sign up either** — `booker/app/api/register/route.ts` and vendor's
  `isEmailAvailable` both treat an existing `profiles` row as "email taken".

They would be locked out of an account they never asked for, with no route back. Doing
all four steps instead makes the auto-created account a genuine booker account the
customer recovers with "forgot password", which is what D1 promised and what the
earlier draft did not actually deliver.

**Side benefit, and it is a real one.** A claimed kiosk account is a *full* booker: it
can acknowledge fulfilment and raise a dispute like any other. That does not remove the
need for B10 — a walk-in cannot be relied upon to claim anything — but it does mean the
"kiosk customers cannot dispute" residual is now *unclaimed-account-only* rather than
permanent. DEFERRED is updated to say so.

**⚠️ Email namespace, and the one thing this genuinely forecloses.** Once a kiosk
creates a profile for `x@y.com`, that address is taken **platform-wide**:
`vendor/lib/emailAvailability.ts` queries `profiles` with no portal filter, so the
person can no longer register a **vendor** account with it. This is **pre-existing
platform behaviour** — it is equally true today of anyone who signs up as a booker
first — but the kiosk widens who runs into it, and they run into it without having
chosen to sign up for anything. Mitigations: the kiosk consent line must say in plain
words that an account is being created for them, and `EMAIL_UNAVAILABLE_MESSAGE`
already points a blocked registrant at the right next step. Recorded in assumptions.

---

### B3 — Kiosk offering eligibility  ✅ DONE (2026-08-29)
> `lib/kioskEligibility.ts` (8 tests) + `getKioskOfferings` in `services/kiosk.service.ts`,
> paged. **Deviation, deliberate:** the rule lives in a tested pure function rather than
> only in the query, because B13's launcher must tell the vendor *how many* offerings are
> excluded and *why* — which a query that filtered them out cannot answer. One rule, so
> the grid and the launcher cannot disagree.
**Files:** `vendor/services/kiosk.service.ts` (new)

Per D7 a date-granular offering cannot be completed by the booker either, so the
kiosk must not sell one. **Custody offerings are no longer excluded** (D2) — B9/B10
give them a completable path, and B11 the surface to complete it on.

The filter must live in the **query**, not the UI — a filter applied only at render
is one refactor away from selling something the flow cannot finish.

**Fix approach.** `getKioskOfferings(vendorId)` selects active offerings joined to
active schedules, restricted to time-granular `duration_unit` (`minute`/`hour`).
**Paged via `lib/pagedFetch.ts` (F16)** — a vendor past 1000 offering/schedule rows
would otherwise get a silently short list, and the kiosk would simply not show
offerings that exist.
**Both `session` and `custody` patterns are eligible.** If the vendor has offerings
that are excluded, say so in the vendor-facing kiosk launcher — silence would read as
a bug.

---

### B4 — Vendor-side `create-session`, with a different caller check  ✅ DONE (2026-08-29)
> `app/api/kiosk/payment/create-session/route.ts`. Amount from `booking.price_paid`,
> never the body; `metadata.booking_id` set so the **existing booker webhook** settles it;
> success/cancel return to `/kiosk`. Rejects non-kiosk bookings. No webhook added here,
> per F4. Ordering defect found and fixed live — see B20.
> ⚠️ The PayMongo call itself is **unreachable and unverified** until
> `PAYMONGO_SECRET_KEY` is added to this app.
**Files (new):** `vendor/app/api/kiosk/payment/create-session/route.ts`
**Reference (do not edit):** `booker/app/api/payment/create-session/route.ts`

Per F5 the booker route's `booking.booker_id !== user.id → 403` rejects every kiosk
booking by construction. The vendor twin keeps **everything else** — deriving the
amount from `booking.price_paid`, ignoring any client-supplied amount, storing
`payment_reference` — and swaps the ownership assertion for *caller is `vendor-admin`
of `booking.vendor_id`*.

**Also required:** `PAYMONGO_SECRET_KEY` and `NEXT_PUBLIC_APP_URL` in the vendor
environment (vendor has neither today; it does have `SUPABASE_SERVICE_ROLE_KEY` via
`lib/supabase/admin.ts`). `success_url` / `cancel_url` point at
`/kiosk?payment=success|cancel&booking_id=…`.

**Explicitly NOT built:** a vendor webhook. Per F4 the booker endpoint already
settles these. `PAYMONGO_WEBHOOK_SECRET` must **not** be added to vendor — an unused
secret in a second environment is a credential with no purpose.

---

### B5 — Containment: an admin session on a customer-facing device  ✅ DONE (2026-08-29)
> `app/kiosk/layout.tsx` imports no admin component — the portal is **not mounted**, not
> merely hidden. Exit is a visible-but-understated "Staff exit" behind password re-auth,
> and the dialog states plainly that this hides the portal without locking the device,
> naming Guided Access / screen pinning. The layout pins `maximumScale: 1` so a stray
> pinch cannot leave a shared tablet broken.
**Files:** `vendor/app/kiosk/layout.tsx`, `components/kiosk/KioskExitDialog/`

The kiosk runs under a live `vendor-admin` session. A customer who types `/` in the
address bar reaches the full admin portal — bookings, staff, payouts, settings. D3
widens this: the PayMongo redirect puts the customer on an external page in the
vendor's browser, from which they can navigate anywhere.

**This cannot be fully solved in the web app, and the plan must not pretend
otherwise.** A web page cannot block URL entry. The honest split:

- **App-level (built here):** the kiosk layout imports no admin component and
  renders no link out of `/kiosk`. Exiting requires re-entering the account password
  (`signInWithPassword` against the current user's email — verification only, no
  session change).
  **The affordance is visible but understated** — a small "Staff exit" control, as
  drawn in the preview — not a hidden gesture. Revised 2026-08-26: a hidden gesture
  protects nothing (the password is the gate, not the obscurity) and costs a staff
  member who does not know it the ability to reclaim their own tablet.
- **Device-level (documented, not built):** actual lockdown is iPadOS Guided Access,
  Android screen pinning, or Chrome's `--kiosk`. The kiosk launcher must tell the
  vendor this in plain words, and it belongs in `architecture/portals.md`.

**Fix approach.** Build the app-level half; write the device-level half into the
launcher copy and the architecture doc. Do not overstate the guarantee anywhere in
the UI.

---

### B6 — Reset, abandonment, and the capacity a dead booking holds  ✅ DONE (2026-08-29)
> (1) and (2) landed in 4a. **(3) is satisfied**: `useKioskCheckout` creates the booking
> row only when the customer taps Pay, so everything before that is local state and an
> abandoned flow leaves no `pending` row holding a slot. **(4) stays documented-only and
> that is the honest outcome** — a web page cannot reclaim a browser that has navigated
> to another origin, so the mitigations are the front desk noticing and the device kiosk
> browser's own idle-return setting, both named in B17a's copy.
> **(1) PII and (2) idle reset done** in `useKioskShell`: a 90s timer bumps `resetKey`,
> and flow state lives in components keyed by it, so a reset unmounts them and the
> customer's details go with them. Nothing is written to storage, so there is nothing to
> clear. `setIdleSuspended` exists for the confirmation screen, which must not time out
> mid-read. ⏸ **(3) unpaid-pending capacity and (4) the PayMongo off-app park** belong
> with the payment step — Stage 4b.
**Files:** `components/kiosk/KioskShell/useKioskShell.ts`

Three distinct problems that a single "reset" hand-wave would miss:

1. **PII persistence.** The previous customer's name, phone and email must not
   survive to the next. Reset clears state at the hook, and the flow keeps customer
   details in hook state only — never `localStorage`, never a URL param.
2. **Mid-flow abandonment.** A customer who walks away leaves their details on
   screen. An inactivity timer (recommend 90s, any step past selection) resets to the
   offering grid. The timer must **not** run on the confirmation screen, which the
   customer may legitimately be reading or photographing.
3. **Abandoned-after-create bookings hold capacity.** The booking row is inserted
   before the PayMongo redirect, and `check_booking_placement()` counts `pending`
   rows toward capacity. A customer who abandons at the payment page leaves an
   unpaid `pending` booking occupying a slot. There is **no auto-expiry today** —
   this is a pre-existing booker behaviour that the kiosk's higher throughput makes
   material.

4. **The tablet can be parked off-app entirely.** D3 sends the browser to PayMongo's
   hosted page. (2)'s inactivity timer lives in `KioskShell`, which is **not running**
   while the browser is on `paymongo.com` — so a customer who walks away at the payment
   step leaves the tablet on a third-party page with no way back. Be honest about the
   limit: **a web page cannot reclaim a browser that has navigated to another origin.**
   There is no app-level fix. The mitigations are the front desk noticing, and the
   device-level kiosk browser's own "return to home URL after N idle minutes" setting —
   the same class of answer as B5, and it belongs in the same launcher copy.

**Fix approach.** Build (1) and (2); document (4) in the launcher and the architecture
doc. For (3), create the booking as late as possible
(immediately before requesting the session, as the booker does) and surface unpaid
kiosk `pending` bookings to the vendor so they can reject them. A real expiry sweep
is a scheduled job against a shared table and is **out of scope** — recorded in
DEFERRED with its unblock condition.

---

### B7 — Attachment schema  ✅ DONE (2026-09-03)
> Closed by **B17b** — the migration is now applied to local, staging **and**
> production. The item had no outstanding work of its own; it was 🔄 solely because
> production was pending. Marked on the user's report of the push; the production
> grants re-check listed under B17b is the one measurement still outstanding.
> ✅ Approved 2026-08-26. Migration ✅ **re-cut and APPLIED TO LOCAL 2026-08-29** as `20260829000001_offering_attachments.sql`.
> ⚠️ **Renumbered 2026-08-29 (D16).** The file on `feature/kiosk` is `20260826000001`,
> which sorts **before** the `20260828…` overnight migrations that are already applied
> to production. An unapplied migration that sorts before applied ones is a landmine:
> the CLI's ordering and the `schema_migrations` history disagree from that point on.
> Re-cut at `20260829…`; the SQL body is unaffected.
>
> Not applied — awaiting the user. Stays 🔄 until it is applied and the RLS/grant
> checks in Verification actually run.
>
> **Amended 2026-08-26 (D10)** while still unapplied: the `kind` CHECK now admits
> `'photo'`. A photo never reaches the kiosk's agreement step, because that step
> filters on `requires_agreement` — always false for a photo — and **not** on `kind`.
> Which bucket `storage_path` points at is **derived from `kind`** (`photo` → the
> public `offering-photos`, everything else → private `offering-attachments`); there
> is no bucket column, so that rule lives in exactly two places, this migration's
> comment and the service that resolves a URL.
**File:** `backbone/supabase/migrations/20260829000001_offering_attachments.sql`

Per AGENTS.md and §8 the exact change is written here and the migration file is
**not created** until the user says go. Per the repo's standing rule the user
applies migrations; this plan never runs one.

```sql
-- ── offering_attachments ─────────────────────────────────────────────────────
create table public.offering_attachments (
  id                 uuid        primary key default gen_random_uuid(),
  offering_id        uuid        not null references public.offerings(id) on delete cascade,
  kind               text        not null,
  title              text        not null,
  -- Object in the `offering-attachments` bucket. NULL for an inline text-only
  -- agreement, which is the common case for a short waiver.
  storage_path       text,
  body               text        not null default '',
  version            integer     not null default 1,
  requires_agreement boolean     not null default false,
  requires_signature boolean     not null default false,
  sort_order         integer     not null default 0,
  is_active          boolean     not null default true,
  created_by         uuid        references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint offering_attachments_kind_check
    check (kind in ('info', 'waiver', 'terms')),
  -- A signature without agreement is not a state that means anything: signing is a
  -- STRONGER assertion than agreeing, so it implies it. Enforced here rather than in
  -- the form, because the kiosk decides whether to show the signature step from
  -- these two flags and an impossible pair would produce an unreachable step.
  constraint offering_attachments_signature_implies_agreement
    check (not requires_signature or requires_agreement),
  -- Something must actually be shown to the customer.
  constraint offering_attachments_has_content
    check (storage_path is not null or body <> '')
);

create index offering_attachments_offering_id_idx
  on public.offering_attachments (offering_id) where is_active;

create trigger offering_attachments_set_updated_at
  before update on public.offering_attachments
  for each row execute function public.set_updated_at();

alter table public.offering_attachments enable row level security;

-- Vendor admins manage attachments on their own offerings.
create policy "vendor admins manage own offering attachments"
  on public.offering_attachments for all
  to authenticated
  using (
    public.is_active()
    and public.has_vendor_role(
      (select o.vendor_id from public.offerings o where o.id = offering_id),
      'vendor-admin')
  )
  with check (
    public.is_active()
    and public.has_vendor_role(
      (select o.vendor_id from public.offerings o where o.id = offering_id),
      'vendor-admin')
  );

-- Any active signed-in user may read active attachments — this is what a future
-- booker-side agreement step will read. Scoped to active offerings so a
-- deactivated offering's waiver is not browsable.
create policy "active users read active offering attachments"
  on public.offering_attachments for select
  to authenticated
  using (
    public.is_active()
    and is_active
    and exists (select 1 from public.offerings o
                where o.id = offering_id and o.is_active)
  );

create policy "command admins read all offering attachments"
  on public.offering_attachments for select
  to authenticated
  using (
    public.is_portal_member('command')
    and (public.has_role('admin') or public.has_role('root'))
  );

-- ── booking_acknowledgements ─────────────────────────────────────────────────
-- Append-only proof, modelled on legal_acceptances: one row PER DOCUMENT agreed to,
-- with the attachment's title/version/kind SNAPSHOTTED so the record stays legible
-- after the vendor edits or removes the attachment it refers to.
create table public.booking_acknowledgements (
  id                 uuid        primary key default gen_random_uuid(),
  -- cascade, matching booking_transactions (20260725000002): the booking is the
  -- subject of the evidence, so the row has no meaning without it. Bookings are
  -- delete-restricted from every app and root-deletable only.
  booking_id         uuid        not null references public.bookings(id) on delete cascade,
  -- set null, NOT cascade: deleting an attachment must not destroy the proof that a
  -- customer agreed to it. The snapshots below are what keep the row meaningful.
  attachment_id      uuid        references public.offering_attachments(id) on delete set null,
  attachment_title   text        not null,
  attachment_version integer     not null,
  attachment_kind    text        not null,
  agreed_at          timestamptz not null default now(),
  -- Object in `booking-signatures`. NULL when the attachment required agreement only.
  signature_path     text,
  signer_name        text        not null default '',
  ip_address         inet,
  user_agent         text
);

create index booking_acknowledgements_booking_id_idx
  on public.booking_acknowledgements (booking_id);

alter table public.booking_acknowledgements enable row level security;

-- Append-only by construction: SELECT policies only, no INSERT/UPDATE/DELETE policy
-- at all. Only the service-role kiosk route writes here.
create policy "vendor admins read own booking acknowledgements"
  on public.booking_acknowledgements for select
  to authenticated
  using (
    public.is_active()
    and public.has_vendor_role(
      (select b.vendor_id from public.bookings b where b.id = booking_id),
      'vendor-admin')
  );

create policy "bookers read own booking acknowledgements"
  on public.booking_acknowledgements for select
  to authenticated
  using (
    public.is_active()
    and (select b.booker_id from public.bookings b where b.id = booking_id) = (select auth.uid())
  );

create policy "command admins read all booking acknowledgements"
  on public.booking_acknowledgements for select
  to authenticated
  using (
    public.is_portal_member('command')
    and (public.has_role('admin') or public.has_role('root'))
  );

-- ── Table grants ─────────────────────────────────────────────────────────────
-- ⚠️ NOT inherited. 20260620000001's grant is ON ALL TABLES and binds only tables
-- that existed then; it sets no default privileges. This gap has shipped as a live
-- bug twice (20260816000002, 20260819000002). Explicit or broken.
grant select, insert, update, delete on public.offering_attachments   to authenticated;
grant select, insert, update, delete on public.offering_attachments   to service_role;
-- Append-only: authenticated reads, service_role writes. No UPDATE, no DELETE for
-- anyone — withholding them is what makes append-only structural.
grant select                          on public.booking_acknowledgements to authenticated;
grant select, insert                  on public.booking_acknowledgements to service_role;
-- Nothing for `anon`, deliberately — no policy on either table references it.

-- ── legal_acceptances.source — widen for kiosk consent (F9) ──────────────────
-- Without this every kiosk booking fails at the consent insert, exactly as
-- 20260819000001's own comment warns. Corrective migration, not an edit.
alter table public.legal_acceptances
  drop constraint legal_acceptances_source_check;
alter table public.legal_acceptances
  add  constraint legal_acceptances_source_check
       check (source in ('booker_signup', 'vendor_registration', 'kiosk_booking'));
```

**Blast radius.**
- **Data.** Two new empty tables — nothing to validate or rewrite. The
  `legal_acceptances` constraint swap **re-validates every existing row**; the new
  set is a strict superset of the old, so no existing row can fail. Verify with
  `select distinct source from public.legal_acceptances;` before applying.
- **Lock / performance.** New tables take no meaningful lock. The `ALTER … DROP/ADD
  CONSTRAINT` takes an `ACCESS EXCLUSIVE` lock on `legal_acceptances` and scans it to
  validate. The table has one row per document per signup — small, and the scan is
  brief. Two signups racing the apply would block momentarily, not fail.
- **Downstream.** `vendor/lib/legal.ts:99`'s `source` union must gain
  `"kiosk_booking"` in the same batch (types are hand-written in this repo — F9).
  No existing query, view or trigger reads either new table.
- **Reversibility.** `drop table public.booking_acknowledgements, public.offering_attachments;`
  and restore the two-value CHECK. Reversible as long as no kiosk consent row exists;
  once one does, the constraint cannot be narrowed without deleting it.

---

### B8 — Attachment + signature storage  ✅ DONE (2026-09-03)
> Closed by **B17b** — the migration is now applied to local, staging **and**
> production. The item had no outstanding work of its own; it was 🔄 solely because
> production was pending. Marked on the user's report of the push; the production
> grants re-check listed under B17b is the one measurement still outstanding.
> ✅ Approved 2026-08-26. Migration ✅ **re-cut and APPLIED TO LOCAL 2026-08-29** as `20260829000002_attachment_storage.sql`.
> Not applied. One addition beyond the drafted SQL: an `update` policy for vendor
> admins on `offering-attachments`, since replacing a file is an UPDATE on the
> object, not only an INSERT — the draft would have blocked re-uploads.
>
> **Amended 2026-08-26 (D10)** while still unapplied: a **third bucket**,
> `offering-photos`, `public: true`, 5 MB, images only. Public read needs no policy
> (it goes through the public object endpoint); the `select` policy that is there
> exists so the management UI can `list()` a folder, which goes through RLS even on a
> public bucket.
**File:** `backbone/supabase/migrations/20260829000002_attachment_storage.sql`
**Pattern:** `20260706000002_vendor_kyc_storage.sql` (F13)

Two buckets, not one. Vendor documents and customer signatures have different
writers, different readers and different sensitivity — a signature is customer PII
captured on the vendor's device, and must never be vendor-writable after the fact.

```sql
-- Vendor-authored documents. Path: {vendor_id}/{offering_id}/{uuid}-{filename}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('offering-attachments', 'offering-attachments', false,
        10485760,                                        -- 10 MB, as vendor-kyc
        array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

create policy "attachments vendor admin write own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'offering-attachments' and public.is_active()
    and public.has_vendor_role((storage.foldername(name))[1]::uuid, 'vendor-admin'));

create policy "attachments vendor admin delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'offering-attachments' and public.is_active()
    and public.has_vendor_role((storage.foldername(name))[1]::uuid, 'vendor-admin'));

-- Read is broader than write: the kiosk (vendor session) and a future booker-side
-- step both need it. Served via signed URLs; the bucket stays private.
create policy "attachments active users read"
  on storage.objects for select to authenticated
  using (bucket_id = 'offering-attachments' and public.is_active());

-- Customer signatures. Path: {vendor_id}/{booking_id}/{ack_id}.png
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking-signatures', 'booking-signatures', false,
        1048576,                                         -- 1 MB; a PNG signature is ~20 KB
        array['image/png'])
on conflict (id) do nothing;

-- ⚠️ NO insert policy for `authenticated`, deliberately. Signatures are written by
-- the service-role kiosk route only, alongside the acknowledgement row they belong
-- to. A vendor-writable signature object is a forgeable one.
create policy "signatures vendor admin read own"
  on storage.objects for select to authenticated
  using (bucket_id = 'booking-signatures' and public.is_active()
    and public.has_vendor_role((storage.foldername(name))[1]::uuid, 'vendor-admin'));

create policy "signatures command admin read all"
  on storage.objects for select to authenticated
  using (bucket_id = 'booking-signatures'
    and public.is_portal_member('command')
    and (public.has_role('admin') or public.has_role('root')));
```

**Blast radius.** Two new buckets and five object policies; no existing bucket or
policy is touched. `storage.objects` policies are additive and evaluated per bucket,
so `vendor-kyc` behaviour is unchanged. No data is read or rewritten. Reversible by
dropping the policies and the buckets (buckets must be emptied first).

**Retention note, unresolved by this plan.** Signatures are indefinite-retention
customer PII. `account_deletion_requests` exists for vendors; nothing sweeps a
customer's signature. Recorded in DEFERRED.

---

### B9 — `booked_via` origin marker, pinned against UPDATE  ✅ DONE (2026-09-03)
> Closed by **B17b** — the migration is now applied to local, staging **and**
> production. The item had no outstanding work of its own; it was 🔄 solely because
> production was pending. Marked on the user's report of the push; the production
> grants re-check listed under B17b is the one measurement still outstanding.
> ✅ Approved 2026-08-26. Migration ✅ **re-cut and APPLIED TO LOCAL 2026-08-29** as `20260829000003_booking_origin.sql`.
> Not applied.
**File:** `backbone/supabase/migrations/20260829000003_booking_origin.sql`
**Coupled to:** B10 — **must ship in the same batch, B9 first.**

D2(A) needs the database to know a booking came from the kiosk. **The pin is the
load-bearing half.** The `bookings` UPDATE policy lets a vendor-admin write any column
on their own bookings, so an unpinned marker could simply be flipped to `'kiosk'` on a
booker-originated booking — and B10's widened rule would then apply to it. The marker
would become a self-service switch for escaping the counterparty check it exists to
preserve.

```sql
alter table public.bookings
  add column booked_via text not null default 'booker';

alter table public.bookings
  add constraint bookings_booked_via_check
  check (booked_via in ('booker', 'kiosk'));

comment on column public.bookings.booked_via is
  'Origin of the booking. Pinned at insert: a vendor-admin may write other columns on
   their own bookings, and this one decides whether the widened in_progress -> returned
   rule applies, so it must not be editable after the fact.';

-- Pinned by its own small trigger rather than by extending check_booking_consistency().
-- That function is INSERT OR UPDATE and already pins price/span/pattern, so it is the
-- conceptual home — but changing it means `create or replace` on a money-path function
-- and reproducing its whole body to add one check. An additive trigger carries a
-- fraction of the risk for the same guarantee. Order-independent: it only ever raises,
-- and reads nothing another trigger computes.
create or replace function public.pin_booking_origin()
returns trigger
language plpgsql
set search_path = public   -- matches every other function in this schema
as $$
begin
  if new.booked_via is distinct from old.booked_via then
    raise exception 'booked_via is set at creation and cannot be changed (% -> %)',
      old.booked_via, new.booked_via;
  end if;
  return new;
end;
$$;

create trigger bookings_pin_origin
  before update on public.bookings
  for each row execute function public.pin_booking_origin();
```

**Trigger name and ordering — checked, not assumed.** This repo has a documented
history of BEFORE-ROW trigger *names* being load-bearing (see `20260803000005`'s header
on why `bookings_check_placement` had to sort after `bookings_check_consistency`).
The BEFORE UPDATE set on `bookings` sorts: `bookings_check_consistency` →
**`bookings_pin_origin`** → `bookings_set_updated_at` → `bookings_validate_status_transition`.
Ordering is **not** load-bearing here: this function reads nothing another trigger
computes and only ever raises, so it is correct at any position. Recorded because the
next person will reasonably ask.

**Blast radius.**
- **Data.** `add column … not null default 'booker'` with a non-volatile default is
  **metadata-only in PG11+** — no table rewrite regardless of how many bookings exist.
  The CHECK validates existing rows; every one is `'booker'`, so none can fail.
- **Lock / performance.** Brief `ACCESS EXCLUSIVE` on `bookings` for the DDL. The new
  trigger adds one comparison per booking UPDATE — negligible against the four
  triggers already firing there.
- **Downstream.** Vendor's hand-written `Booking` interface gains the field (types are
  hand-written in this repo). Booker, command and the mobile apps do **not** need it
  and are not touched.
  ✅ **The round-trip risk was checked, not assumed:** a full-row UPDATE would now
  raise. `grep` across `booker/`, `command/`, `vendor/` and `ezzy-vendor-mobile/`
  found booking UPDATEs in exactly one file — `vendor/services/bookings.service.ts:154,164,215`
  — all writing narrow column sets (`{status}`, `{status, rejection_reason, cancelled_by}`).
  The SQL writers (`admin_override_booking_status`, the dispute functions,
  `auto_acknowledge_bookings`) and the PayMongo webhook (`{is_paid}`) are likewise
  narrow. No caller is affected.
- **Reversibility.** `drop trigger`, `drop function`, `drop constraint`, `drop column`.
  Fully reversible; nothing reads the column until B10 lands.

---

### B10 — Let the customer close a kiosk booking at the desk  ✅ DONE (2026-09-03)
> Closed by **B17b** — the migration is now applied to local, staging **and**
> production. The item had no outstanding work of its own; it was 🔄 solely because
> production was pending. Marked on the user's report of the push; the production
> grants re-check listed under B17b is the one measurement still outstanding.
> ✅ Approved 2026-08-26. Migration ✅ **re-cut and APPLIED TO LOCAL 2026-08-29** as `20260829000004_kiosk_customer_close_out.sql`
> (named for what it does — it covers both patterns, not custody alone).
>
> **The diff gate this item demanded was run, and passed.** The function body was
> extracted from `20260801000002` programmatically and patched by anchored string
> replacement — never hand-retyped. Asserted mechanically before the file was
> written: each anchor matched **exactly once**; total line count **unchanged**
> (90 → 90); **exactly 2 lines differ** (the `fulfilled`→`completed` and
> `in_progress`→`returned` branches); and both fragments this item warns about —
> `new.status_changed_at := now();` and the `v_third_party` reason-check block —
> were asserted still present after patching. Placement confirmed by eye:
> `returned → completed` at the bottom is untouched.
>
> ✅ **Diff gate RE-RUN against the rebased tree (2026-08-29) and PASSED:** body
> re-extracted from `20260801000002` *in the rebased working tree* — not carried over
> from the pre-rebase branch — 90 lines in, 90 out, **exactly 2 lines differ**
> (`fulfilled→completed` at :46, `in_progress→returned` at :53), and both
> `new.status_changed_at := now();` and the `v_third_party` block asserted present.
>
> ⚠️ **Re-verified 2026-08-29 (F17):** `validate_booking_status_transition()` is still
> last defined in `20260801000002` on `develop` — nothing re-created it — so the
> reproduced body and its two-line diff remain correct. **Re-extract from `develop`
> rather than reusing the file on `feature/kiosk`**, and re-run the diff gate: the
> guarantee is "exactly two lines against the definition actually in the branch we are
> merging into", and that is only true if it is re-derived there.
>
> Not applied. Stays 🔄 until the live-DB checks in Verification run.
**File:** `backbone/supabase/migrations/20260829000004_kiosk_customer_close_out.sql`
**Coupled to:** B9 — the marker is meaningless without the rule, and the rule is unsafe
without the pin. **Same batch, B9 first.**

The change is **two lines** in `20260801000002_booking_fulfilment_states.sql` — one
per fulfilment pattern (D2 for custody, D9 for session). Both take the identical
kiosk-gated clause:

```sql
-- CUSTODY — in_progress branch, was line 129:
--   if new.status = 'returned' and (v_booker or v_command) then v_ok := true; end if;
   if new.status = 'returned'
      and (v_booker or v_command or (v_vendor and new.booked_via = 'kiosk'))
   then v_ok := true; end if;

-- SESSION — fulfilled branch, was line 120:
--   if new.status = 'completed' and (v_booker or v_system or v_command) then v_ok := true; end if;
   if new.status = 'completed'
      and (v_booker or v_system or v_command
           or (v_vendor and new.booked_via = 'kiosk'))
   then v_ok := true; end if;
```

**Why both, and why together.** Without the session line the plan is lopsided: a
kiosk rental reaches `releasable` the moment the customer hands the asset back, while
a kiosk session of the same value waits three days on the timer, because the only
party who could acknowledge it cannot log in. Same defect, same fix, and doing them in
one pass avoids replacing this function twice (see the transcription risk below).

⚠️ **This requires `create or replace function public.validate_booking_status_transition()`
reproducing the entire existing body**, because Postgres cannot patch one branch of a
function. **This is the riskiest single change in the plan:** that function governs
every status move for seven writers across three apps, and a transcription slip in an
*untouched* branch would surface as bookings that can no longer be confirmed,
completed or cancelled.

**Fix approach.** Copy the body verbatim out of `20260801000002`, change exactly the
two lines above, then **diff the two function bodies and confirm the diff is exactly
those two lines** before applying. Do not hand-retype it.

⚠️ **Two parts of that body are easy to drop and catastrophic to drop.** Both sit
*after* the branch table, which is why a careless copy that stops at the last `elsif`
loses them:

1. **`new.status_changed_at := now();`** (`:163`). Every 3-day auto-acknowledge reads
   this column (`auto_acknowledge_bookings()` filters
   `status_changed_at < now() - interval '3 days'`). Dropping it would silently freeze
   the timer for **every booking on the platform**, kiosk or not — bookings would sit
   in `fulfilled`/`returned` forever and no payout would ever become releasable. The
   failure is silent for three days, which is the worst possible shape.
2. **The `v_third_party` reason-check block** (`:154-161`), which forces a Command
   admin acting as neither party to supply `app.status_change_note`. Dropping it would
   quietly remove the audit requirement on administrative overrides.

Note that `v_third_party := v_command and not v_booker and not v_vendor`, so the new
kiosk clause never triggers that requirement — the vendor is acting *as* the vendor.
D8's fixed note is therefore recorded by `log_booking_status_change()` for legibility,
not demanded by the trigger.

**What is deliberately NOT widened.**
- `v_system` still gets **no** branch out of `in_progress`. The design rule — *"an
  asset that never came back must never auto-complete"* (`20260801000006:69`) — is
  untouched, so no timer will ever release a custody payout. The session branch keeps
  its existing `v_system`, so `auto_acknowledge_bookings()` remains the fallback for a
  booking nobody closes at the desk.
- `disputed` is unchanged: a kiosk customer still cannot flag. Recorded in DEFERRED
  rather than quietly widened here.
- Booker-originated custody bookings keep today's rule exactly, because the new clause
  is gated on `booked_via = 'kiosk'`.

**Blast radius.** One function replaced; no data read or written; no lock beyond the
catalogue. Reversible by re-applying `20260801000002`'s definition. The risk is
transcription, not mechanics — hence the diff requirement above.

---

### B11 — Kiosk close-out flow (D2's "C" button, both patterns)  ✅ DONE (2026-08-29)
> `app/api/kiosk/close-out/route.ts` (identifier lookup), `.../confirm/route.ts` (the
> transition), and `components/kiosk/KioskCloseOut/{tsx,hook,css}` behind the home
> screen's "Finish a booking".
> **The target status is derived from the row in BOTH places** — the hook picks the
> label, the server picks the transition — so a client that named its own target could
> not move a custody booking straight to `completed`, skipping the vendor's "Got it
> back" and releasing the payout with nobody confirming the asset came back.
> Lookup is scoped to `booked_via = 'kiosk'` and `status in (in_progress, fulfilled)`,
> matched on booking id prefix, exact email, or phone **suffix** (digits only, so
> "+63 917…" and "0917…" compare equal). A blank or <4-character identifier is refused
> rather than matching everything.
> **Verified live:** unauthenticated → **401** on both routes (auth precedes the
> identifier check — B20's lesson applied, not re-learned); missing vendor → **403**;
> `/kiosk` still **200**; zero compile failures. `tsc` 0, 341/341 tests, **0 lint
> violations** across `components/kiosk` and `app/api/kiosk`.
> ⚠️ **No booking has actually been closed** — that needs a signed-in session and a
> kiosk booking in `in_progress` or `fulfilled`.

> **Two deviations from this item as written, both recorded rather than silent:**
>
> 1. **Copy is NOT reused from `lib/bookingActionCopy.ts`.** That table holds the
>    *vendor's* labels for these same transitions ("Got it back"), is consumed by the
>    dashboard guide and the mobile app, and is scoped to vendor actions — adding
>    customer-facing keys would let kiosk wording leak into the vendor glossary. The two
>    customer strings ("I've returned it", "Yes, all done") live in the kiosk hook,
>    sourced from `architecture/booking-flow.md`'s fulfilment table.
> 2. **D8's fixed audit note is not set.** `app.status_change_note` is transaction-local
>    and supabase-js cannot issue `SET LOCAL` alongside an update; it would need a
>    SECURITY DEFINER RPC, which is a migration, and the schema locked when staging
>    received it (B17a). Only legibility is lost: `booking_status_log` still records the
>    actor and transition, and `booked_via` records the origin — which is exactly the
>    reasoning D8 used to reject a mandatory typed reason in the first place.
**Files (new):** `vendor/app/api/kiosk/close-out/route.ts`,
`components/kiosk/KioskCloseOut/{KioskCloseOut.tsx, useKioskCloseOut.ts, KioskCloseOut.module.css}`

The customer confirms, on the tablet, that their booking is finished. This is the
surface that makes B10's widened rules a *customer* action rather than a vendor one.
**One screen, two targets** — the pattern decides which, and the customer never has to
know the difference:

| Booking is | Customer confirms | Moves to | Then |
|---|---|---|---|
| `in_progress` (custody) | "I've returned it" | `returned` | vendor's existing "Got it back", or the 3-day timer, completes it |
| `fulfilled` (session) | "Yes, all done" | `completed` | **done** — `payout_status` flips to `releasable` on the spot |

Copy for both comes from `lib/bookingActionCopy.ts`, which already carries the
booker-side wording for exactly these two moves — reuse it rather than writing a
third variant, since that table exists to stop this wording drifting between apps.

⚠️ **Do not render a list of today's in-progress bookings.** That is the obvious
implementation and it puts other customers' names on a screen facing the public — a
PII leak on a shared device, and a worse one than B6's, because it needs no
abandonment to happen. The customer must **identify their own booking first**: enter
the phone number or booking reference from their confirmation, and the screen shows
only matches for that identifier, with minimal detail (offering, time) — never a
browsable roster.

**Fix approach.** `POST /api/kiosk/close-out`, same caller check as B1 (signed-in
`vendor-admin` of the vendor). Looks up bookings for that vendor with
`booked_via = 'kiosk'` in `in_progress` **or** `fulfilled`, matching the supplied
identifier, and moves the chosen one to `returned` or `completed` respectively —
**the target is derived from the booking's current status, never sent by the client**,
so a tampered request cannot jump a custody booking straight to `completed`. Sets D8's
fixed `app.status_change_note` in the same transaction so the audit line is
self-describing.

**Component separation.** `.tsx` renders the identifier field, the match list and the
confirm button; `useKioskCloseOut.ts` owns lookup state, selection, the
status-to-action mapping, submit and error handling; `.module.css` carries the
styling. Same touch-target, state-coverage and theming rules as I4.

**Where this is deliberately NOT exposed.** The vendor's normal BookingsPage gains
neither move, even though B10 now permits both for kiosk rows. Keeping them kiosk-only
preserves D2(C)'s intent — the customer is present. Per D2's warning this is a **UI
convention, not an enforcement**; the database cannot tell the difference.

---

### B12 — Step 5 and 6 gate on the FLAGS, never on "has attachments"  ✅ DONE (2026-08-29)
> `lib/kioskSteps.ts` + 16 tests. The predicate filters on `kind === "document"`, so a
> photos-only offering provably gets no agreements step — asserted directly. Signature
> can never appear without agreements before it, because both derive from the same
> filtered set. Tests cover the truth table, inactive attachments and clamping.
**Files:** `components/kiosk/KioskShell/useKioskShell.ts`, `services/kiosk.service.ts`

The two conditional steps must be computed from the attachment **flags**:

```ts
const documents      = attachments.filter(a => a.is_active && a.kind === 'document')
const needsAgreement = documents.length > 0
const needsSignature = documents.some(d => d.requires_signature)
// step order: Offering → Slot → Customer
//   → Agreements  (only when needsAgreement)
//   → Signature   (only when needsSignature)
//   → Payment
```

⚠️ **This item exists because the plan was already wrong here, and the fix is not
cosmetic.** I3 previously said the agreements step is skipped "when the offering has
no attachments". That was true when the only things in `offering_attachments` were
documents. **D10 put photos in the same table**, so an offering with two photos and no
waiver now *has attachments* — and an existence test would render an empty agreements
step for it, on the most common offering there is. Caught 2026-08-26 while reviewing
the preview; the earlier wording is replaced rather than annotated, because leaving
two phrasings in the plan is how the wrong one gets implemented.

**Consequences of the D11 model:**
- A `photo` never reaches step 5, because step 5 counts **documents**. No flag check
  and no special case — photos are simply not in the set.
- Step 6 can never appear without step 5: `needsSignature` is computed from the same
  `documents` array, so a non-empty signature set implies a non-empty document set.
  The DB backs this independently — `offering_attachments_photo_no_signature` means a
  photo cannot carry the flag at all.
- An offering with **no** attachments at all behaves identically to one with only
  photos: Details → Payment. Both are the common case and neither may show an empty step.

**Verification is a truth table, not a click-through** — see Verification.

---

### B13 — The kiosk launcher (the feature's only entry point)  ✅ DONE (2026-08-29)
> Sidebar item + `KioskLauncherDialog`. The item is a **button that opens the dialog and
> routes to `/kiosk`** — never a `PageId`, with the reason written at the call site so
> nobody later "tidies" it into `PAGE_IDS` and puts the admin chrome back around the
> kiosk. The dialog names how many offerings are sellable and why the rest are not (B3),
> carries B5's device warning, and disables Start when nothing is sellable.
**Files:** `components/layout/Sidebar/Sidebar.tsx` (modified),
`components/kiosk/KioskLauncherDialog/{KioskLauncherDialog.tsx, useKioskLauncherDialog.ts, KioskLauncherDialog.module.css}` (new)

Blocker, not polish: **without this, nothing in the vendor portal opens `/kiosk`** and
the whole feature is unreachable except by typing the URL. It went unnoticed because
B3 and B5 both *refer* to a launcher, which reads like it exists.

**Fix approach.** A "Kiosk Mode" entry in the sidebar, below Settings and Calendar
(D12). Tapping it opens a confirm dialog before handing the device over — that dialog
is where B5's honest warning lives (*hides the portal, does not lock the device; use
Guided Access or screen pinning*) and where B3's exclusions are named (*"3 of your 7
offerings can't be sold at the kiosk"*, with the reason). Confirm navigates to `/kiosk`.

⚠️ **The nav item must not be a `PageId`.** Adding `"kiosk"` to `PAGE_IDS` would route
it through `AppShell`'s switch, which renders `Sidebar`/`TopBar`/`TabBar` around every
page — reintroducing exactly the chrome D5 chose a separate route to escape, and
leaving the admin surface mounted behind the kiosk. It is a link/router push to
`/kiosk`, and `Sidebar.tsx` needs a small branch for that: today every item calls
`onNavigate(id)`. `PAGE_IDS` stays untouched, so `?page=` deep-linking is unaffected.

**Component separation.** The dialog gets the full trio; `useKioskLauncherDialog.ts`
owns the open state, the excluded-offering count (from B3's service) and the navigate
handler. The sidebar change is one item in an existing list — no new hook.

---

### B14 — Kiosk Mode must survive a reload, and a relaunch  ✅ DONE (2026-08-29)
> `lib/kioskMode.ts` (storage-error tolerant), the `AppShell` redirect read
> **synchronously in a lazy initialiser** so no admin chrome paints first, and a
> `shortcuts` entry with `start_url` left at `"/"` per D14. Only the password-confirmed
> exit clears the flag. ⚠️ Verified by code path and type-check; **the reboot/relaunch
> case needs a real device** and has not been run.
**Files:** `components/kiosk/KioskShell/useKioskShell.ts`,
`components/layout/AppShell/useAppShell.ts`, `app/manifest.ts`

**Found by review 2026-08-26, and it defeats B5.** As planned, "kiosk mode" is not a
mode at all — it is *the browser happening to be at `/kiosk`*. Nothing persists it, so:

- `app/manifest.ts:9` sets `start_url: "/"` with `display: "standalone"`. When the
  tablet reboots, or the OS kills and relaunches the installed PWA, it opens **the
  admin dashboard** — bookings, staff, payouts, settings — on a device pointed at a
  customer. Silently, and the vendor may not be watching.
- A plain refresh on `/kiosk` is fine, but any navigation that loses the URL is not.

That is the exact failure B5 exists to prevent, arriving through the front door.

**Fix approach.** Make the mode real and make **exit the only way out**:
1. On entering the kiosk, write a flag — `localStorage["ezzy.kioskMode"] = vendorId`.
2. `useAppShell` checks it on mount: if set, redirect `/` → `/kiosk` before rendering
   any admin chrome. The dashboard must never paint first.
3. Only B5's password-confirmed exit clears it.
4. Add a **`shortcuts` entry** for Kiosk Mode. **`start_url` stays `"/"`** — see D14.

⚠️ **This does not contradict B6.1's "never `localStorage`".** That rule is about
**customer PII** — names, phones, emails — which must not outlive a session. The mode
flag holds a vendor id and no customer data. Both rules stand; state them together
wherever this is implemented, because they look contradictory at a glance.

⚠️ **Not a security boundary.** A customer who clears site data drops out of kiosk
mode. This raises the floor from "a reboot exposes the admin portal" to "a deliberate
act does" — the actual boundary is still the device lockdown in B5.

---

### B15 — The kiosk requires a live vendor-admin session, always  ✅ DONE (2026-08-29)
> ## 🔗 COUPLING — `requireVendorAdmin` IS NO LONGER THIS PLAN'S ALONE (added 2026-09-03)
>
> `.plans/2026-09-03-vendor-mobile-kiosk-mode.md` **B1** changed `lib/kioskAuth.ts` to give
> the mobile app a second way in. Both plans now own the same guard, and neither referenced
> the other until this note — the gap plan-authoring §9 exists to prevent.
>
> **What changed under this item:** `requireVendorAdmin(vendorId)` became
> `requireVendorAdmin(request, vendorId)`. Identity comes from an `Authorization: Bearer`
> access token when one is sent, and from the cookie-bound SSR client otherwise. All four
> kiosk routes pass their request through. Reviewed 2026-09-03 and **sound**: a malformed
> bearer header returns 401 rather than falling through to a coincidental browser cookie,
> the token is validated by `auth.getUser(token)` rather than decoded locally, it uses the
> anon key, and the vendor-admin membership check still runs afterwards — so the boundary
> this item defines is unchanged, only the credential is new.
>
> ⚠️ **Three invariants from THIS plan now depend on code the mobile plan edits.** Anyone
> touching `kioskAuth.ts` must keep all three:
> 1. **B20** — auth must still precede the `PAYMONGO_SECRET_KEY` check on
>    `create-session`. Re-verified after the mobile change: `requireVendorAdmin` at `:49`,
>    `secretKey` at `:52`.
> 2. **B15** — `verifyVendorAdminFor(user, vendorId)` against the **pinned** vendor, never
>    `activeRows[0]`, or a multi-vendor admin silently re-points the kiosk.
> 3. **B4** — the caller names `vendorId`, so membership is checked with no database read
>    and an unauthorised caller learns nothing about whether a booking id exists.
>
> **Fixed 2026-09-03 while reviewing it:** the scheme match was case-sensitive
> (`/^Bearer …$/`), so `bearer <token>` failed **closed** — a correct-looking, unexplainable
> 401 for any client that normalises header casing. RFC 7235 §2.1 makes the scheme
> case-insensitive. Now `/i`, with tests over `Bearer|bearer|BEARER|BeArEr` and the
> malformed cases re-asserted in lower case. Suite **367 → 369**.
> `useKioskShell` checks on mount and subscribes to `onAuthStateChange`, against the
> **pinned** vendor via a new `verifyVendorAdminFor(user, vendorId)`. That function had
> to be added: `verifyVendorAccess` returns `activeRows[0]`, which for a multi-vendor
> admin is the wrong vendor — signing in as an admin of another vendor would have
> silently re-pointed the kiosk. On loss: a neutral *"Temporarily unavailable"* panel
> with a **Staff sign-in button, never an auto-rendered password field**.
> ⚠️ Not exercised live — needs a real session to revoke.
**Files:** `components/kiosk/KioskShell/useKioskShell.ts`,
`components/kiosk/KioskSignedOut/{KioskSignedOut.tsx, useKioskSignedOut.ts, KioskSignedOut.module.css}`
**Supersedes:** I9 (promoted 2026-08-26)

**The invariant:** the kiosk never operates without an authenticated `vendor-admin` of
the vendor it was launched for. It is not enough that it *usually* has one — the
session can end with nobody touching the tablet (overnight refresh failure, the vendor
signing out on another device, a password change), and `useAppShell.ts:321` already
proves the app sees `SIGNED_OUT` events.

**Fix approach.**
1. **Verify on mount and subscribe.** Check the session and the vendor-admin role when
   `/kiosk` loads, and react to `onAuthStateChange`. A session that merely *exists* is
   not enough — the role is what the booking and payment routes will demand anyway
   (B1, B4), so failing early beats failing at the pay button with a customer waiting.
2. **Halt immediately on loss.** No new booking may start, and any in-flight customer
   details are **cleared at once** — B6.1's rule applies with more force here, because
   an interrupted flow is exactly when PII would otherwise sit on screen unattended.
3. **Show a neutral panel, not a login form.** Same customer-facing surface as I8's
   offline state: *"Temporarily unavailable — please see the front desk."*
4. **Staff sign back in from there.** The panel carries a discreet **"Staff sign-in"**
   action that opens the login; the form is never the default view.
   ⚠️ **Why not just render the login form?** A password field auto-displayed on an
   unattended public tablet is two bad things at once: a customer may type *their own*
   credentials into it, and anyone walking past sees a sign-in prompt on a device
   they have no business signing into. Putting it one deliberate tap behind a
   "Staff" label costs staff nothing and removes both.
5. **Re-authentication is pinned to the same vendor.** B14's flag holds the vendor id.
   Signing in as a different user, or as someone without `vendor-admin` on that vendor,
   is **refused with an explanation** rather than silently re-pointing the kiosk at
   another vendor's offerings. On success the kiosk resumes; the mode flag is never
   cleared by a session loss — only B5's password-confirmed exit clears it.

**Component separation.** `KioskSignedOut` gets the full trio; the hook owns the
sign-in dialog state, the credential submit, the same-vendor check and the resume
handler. Its `.tsx` renders the panel and wires what the hook returns.

---

### B16 — The kiosk must handle windows that cross midnight  ✅ DONE (2026-08-29)
> Slots carry their **own** date, from `slotDate()` — never recomputed from the clock.
> A slot starting after midnight renders a day marker ("Sat 30"), the list sorts by
> real time rather than clock time (so 00:00 does not jump above the 23:00 that
> precedes it), and both the payment summary and the confirmation show the slot's own
> date, not the chip the customer tapped. The route derives `booked_date` server-side
> from the same rule, so the client cannot file a booking a day early.
> ⚠️ Verified by construction and by Stage 1's tests; **no overnight booking has been
> made**.
**Files:** `components/kiosk/KioskSlotPicker/*`, `components/kiosk/KioskOfferingGrid/*`,
`services/kiosk.service.ts`
**New 2026-08-29** — created by the overnight-schedule work (F15), which shipped after
this plan was written and is live in production.

This plan was drafted when a schedule window provably could not cross midnight, and it
quoted that as a standing invariant. **It no longer holds.** Two consequences, and the
second is a correctness bug rather than a rendering one:

1. **Slots can run past midnight.** A 23:00–01:00 window with a 1-hour offering yields
   starts at 23:00 and 00:00. The picker must render those as a legible span
   (*"11:00 PM – 12:00 AM"*, *"12:00 AM – 1:00 AM"*) rather than producing an inverted
   or empty range. `deriveSlots` already returns them correctly (I1) — this is the
   render layer keeping up.
2. **⚠️ The date label can lie.** `bookings.booked_date` is *the date the booking
   **starts***, settled explicitly at `20260828000001:215-232`: the 00:00 slot of a
   **Friday** 23:00–01:00 window is stored as **SATURDAY** 00:00. The kiosk defaults to
   today and labels its chips *Today / Tomorrow* (screen 2 of the preview). A customer
   at 23:50 on Friday who taps the 00:00 slot under a chip reading **Today** creates a
   booking dated **Saturday**. They will arrive on the wrong day, and the vendor's
   bookings list will agree with the database rather than with what the customer was
   shown.

**Fix approach.** Derive each slot's own start date rather than assuming the selected
date, and label any slot whose start date differs from the selected chip — *"12:00 AM
Sat 30"* — so the day is stated wherever it changes. The confirmation screen and the
booking summary must show the same resolved date, since that is the customer's receipt.

**Use the helpers that already exist.** `vendor/lib/scheduleWindow.ts` provides
`crossesMidnight(start, windowMinutes)` — the exact predicate this item needs — plus
`formatWindow` and `formatScheduleWhen` for the labels. The slot list itself may wrap
(`23:00`, `00:00`, `01:00`), so **do not sort slot starts as clock times** and do not
assume the list ascends within one day; `deriveSlots` already returns them in true
order. A window may also be exactly 24 hours.

**Do not "fix" this by refusing post-midnight slots.** Overnight availability is a
feature that shipped deliberately for vendors open past midnight, and a kiosk at a
24-hour venue is exactly where it matters.

---

### B17a — Push the Stage 0 schema to STAGING  ✅ DONE (2026-08-29)
> Pushed by the user. **Independently verified:** `supabase migration list --linked`
> reports `local == remote` for all four `20260829000001-4`, and for every one of the
> 72 migrations — no drift, no gaps. The user ran the grant re-check and it passed.
> Environment audit at the same time found two things — see B22.
**Files:** none — this is a deploy, not a code change
**Runs at Stage 3b**, immediately after the attachment editor (I2) — split from B17b
on 2026-08-29 (D18). Production is a separate item deliberately.
**Found 2026-08-29:** the plan tracked *authoring* the migrations and *applying them
locally*, and then simply stopped. Nothing in it carried them to the environments the
feature actually runs in. Every later stage silently assumes the schema is there.

**Deferring is safe here, and that is a property of these particular migrations, not a
general rule.** All four are **additive and backward-compatible with the app builds
currently deployed**: two new tables nothing reads yet; a new column with a default that
no existing writer names; a widened CHECK whose new value set is a strict superset; and
a function replacement that only *widens* permission, gated on `booked_via = 'kiosk'`
— and every existing row is `'booker'`, so its behaviour is byte-identical for them.
Nothing in production changes the moment these land. That is why they can wait, and why
there is no expand/contract sequencing to respect (unlike `20260828000001-2`, which had
to split precisely because it dropped a column live apps still named).

**The editability window, and where it now closes.** Because they are applied to local
only, these migrations are **still editable**: a schema flaw found in Stages 1–3 is fixed
by editing the file and replaying, not by stacking a corrective migration on a mistake.
⚠️ **That window closes when B17a runs**, not at the end — `architecture/conventions.md`'s
"never edit an applied migration" rule binds from the moment staging has them. That is
the price of the split (D18), paid knowingly: by Stage 3b the routes and the editor have
exercised every table and constraint with real code, so the odds of still needing a
schema edit are low, while the odds of an environment difference are exactly what staging
exists to measure.

⚠️ **The trap that comes with it.** Editing a migration that is *already applied to
local* and then running `npx supabase migration up --local` **does nothing** — the
version is already in `schema_migrations`, so the CLI skips it and reports success. The
edit silently never runs. After editing any `20260829…` file, replay from scratch:

```bash
cd backbone
npx supabase db reset          # migrations from empty, then seed.sql
```

This is the one case where `db reset` is the right local tool — not for applying new
migrations (that is `migration up`, which exercises backfills against real rows), but
for re-running a version the database already thinks it has.

**Fix approach.** Per `architecture/database-reset-and-deploy.md`:

```bash
cd backbone
npx supabase db push --linked --dry-run   # what would apply
npx supabase db push --linked             # apply
```

⚠️ **`db push` only — never `db reset`, never `--include-seed`** on a hosted
environment; the doc is unambiguous and reset would destroy data. Staging first, then
production.

⚠️ **Re-check the grants after each push.** F18's finding came from a *platform-provided*
default ACL, and the doc's own "why 'it worked locally' predicts nothing about hosted"
section lists four divergences that have each bitten this project. Run:

```sql
select grantee, string_agg(privilege_type, ',' order by privilege_type)
  from information_schema.role_table_grants
 where table_name = 'booking_acknowledgements' group by 1;
```

Expect `authenticated => SELECT` and `service_role => INSERT,REFERENCES,SELECT,TRIGGER`.
If `service_role` comes back with UPDATE or DELETE, D17's revoke did not take on that
environment and the append-only guarantee is absent where it matters most.

**What this unblocks — CORRECTED 2026-08-29, after checking what is actually runnable.**

⚠️ **The original claim on this item was too strong, and it was mine.** When D18 split
the deploy, I argued the staging push should come early so that **B4** — F4's
"no second webhook" under test — would be proven before Stages 4–6 were built on it.
Checking the repo rather than the plan: that is **not deliverable at this point**.

- `PAYMONGO_SECRET_KEY` and `NEXT_PUBLIC_APP_URL` are **absent from `vendor/.env.local`**
  (verified), so B4's route returns before it ever calls PayMongo.
- There is **no `/kiosk` route yet** — it is Stage 4 — so nothing can drive a booking
  through B1, which every downstream row needs to have happened first.

**Runnable the moment the schema lands on staging (schema-level, no app needed):**
- the grant re-check below — the F18 divergence, the single most valuable thing here;
- D10's bucket visibility: an `offering-photos` object resolves over the public endpoint
  without a token, an `offering-attachments` object does not;
- that all four migrations apply cleanly to a hosted database at all, which local
  cannot prove (see the doc's "why 'it worked locally' predicts nothing about hosted").

**NOT runnable until Stage 4 exists and the env vars are set** — B4's PayMongo round
trip, R1's account claim, B1's single-insert and orphan-sweep rows, B2's race. These
move to a second pass after Stage 4, tracked here rather than quietly dropped.

**The item still belongs here.** Proving the migrations apply to a hosted environment,
and that the revoke survives it, is worth doing before three more stages are built —
it just proves less than I first claimed:

- **B4** — sandbox card → `is_paid` flips true **via the booker webhook, unmodified**.
  This is F4 (*"no second webhook"*) under test. If it fails, a foundational decision was
  wrong, and every stage after this one assumed it.
- **The grant re-check** — whether D17's revoke actually took on hosted. F18 proved this
  class of thing differs by environment.
- **R1** — whether a kiosk-created customer can genuinely claim their account. That is
  D1's entire premise.
- Plus B1's two (single complete insert, orphan sweep), B2's race, and D10's bucket
  visibility checks.

**Coupling:** must land before any app build that reads the new tables is deployed to
staging.

---

### B17b — Push the Stage 0 schema to PRODUCTION  ✅ DONE (2026-09-03)
> **Pushed by the user on 2026-09-03**, after the command was corrected to
> `--project-ref pdkejyjidrfxksaczvfy` (see the correction notice below — the original
> `--linked` would have hit staging).
> User reports staging and production now hold **the same schema state**, with seed data
> deliberately present on staging only. That posture is worth keeping: these two
> environments drifted once before, when work went to prod first and staging was left
> behind.
>
> ⚠️ **Two follow-ups from this item are NOT yet done and are not implied by the push:**
> 1. **Re-run the grants query on production** — confirm `authenticated => SELECT` and
>    `service_role => INSERT,REFERENCES,SELECT,TRIGGER`. This is not ceremony: **F18** in
>    this plan was a false claim about grants that only measurement caught, and a grant
>    that silently differs shows up as `permission denied` for a real logged-in user.
> 2. **No app build has been deployed**, which is correct — the schema is inert without
>    one, and B28's fix is still uncommitted. Deploy is a separate sitting, as planned.
**Files:** none — this is a deploy, not a code change
**Runs LAST — Stage 7**, after every stage is complete and B17a's live checks have
passed on staging.

> ## ⚠️ CORRECTED 2026-09-03 — THE COMMAND BELOW WAS WRONG AND WOULD NOT HAVE REACHED PRODUCTION
>
> This item originally read *"same command"* as B17a, i.e. `npx supabase db push --linked`.
> **`--linked` is STAGING.** `backbone/supabase/.temp/project-ref` holds
> `fbxbwnfeimzhgxpshdpa`, the staging project; production is a **separate** project,
> `pdkejyjidrfxksaczvfy` (`architecture/overview.md:87-88`).
>
> Running the original command would have re-pushed **staging**, printed a perfectly
> ordinary success, and left production untouched — while the plan was ticked off as
> done. Nothing in `db push` output names the environment, which is exactly the trap
> `architecture/database-reset-and-deploy.md:418` warns about (*"Check `.temp/project-ref`
> before every command"*).
>
> Caught 2026-09-03 when the user said they were ready to push to production.

**Target production explicitly. Do NOT re-link** — a re-link silently retargets every
later command in this working copy, including future `db push`es intended for staging.

```bash
cd backbone

# 0. Say out loud which project is about to be hit. Staging = fbxbwnfeimzhgxpshdpa.
cat supabase/.temp/project-ref          # expect: fbxbwnfeimzhgxpshdpa  (STAGING)

# 1. What does production not yet have?
npx supabase migration list --project-ref pdkejyjidrfxksaczvfy

# 2. Dry run against PRODUCTION, then the real push.
npx supabase db push --project-ref pdkejyjidrfxksaczvfy --dry-run
npx supabase db push --project-ref pdkejyjidrfxksaczvfy
```

⚠️ **`20260829000003_booking_origin.sql` carries a backfill** — it revalidates every
existing booking row. The runbook requires a **baseline query before any migration
carrying a backfill** (`database-reset-and-deploy.md:421`). Local had 41 rows; production
will have more, and this is the one migration whose runtime and failure modes scale with
row count. Take the baseline first.

⚠️ **`20260829000004` replaces `validate_booking_status_transition()`** — an existing
function on the live booking path, not a new one. Two lines differ. It has been on staging
since 2026-08-29, which is the whole reason B17a came first.

⚠️ **`db push` only — never `db reset`, never `--include-seed`.** The repo doc is
unambiguous: *"Production only ever receives `db push`."*

⚠️ **Also from the runbook's Production section, and NOT yet ticked off anywhere in this
plan:** `pg_cron` must be enabled before the first push, and `platform_fee_settings.fee_percent`
arrives at 0 — until it is set the platform earns nothing on every booking. Both are
one-time production setup rather than kiosk work, but this is the sitting where they bite.

⚠️ **Do not pair this with the app deploy in one sitting.** Push the schema, re-run the
grant query, confirm it reads `authenticated => SELECT` and
`service_role => INSERT,REFERENCES,SELECT,TRIGGER`, and only then deploy the app builds.
The schema is inert without them, so there is no window where production is half-broken —
which is precisely what makes taking it in two steps free.

**Nothing should be surprising by this point.** Every live-environment row in this plan
was already run on staging at B17a. If something differs here that did not differ there,
that is a finding about the environments, not about this feature — and worth writing
down.

---

### B19 — `availabilityForDay` under-counts post-midnight slots  ✅ DONE (2026-08-29)
> Fixed in Stage 1 by counting **epoch instants** instead of clock minutes, and by
> dropping the `bookedDate === dateStr` filter entirely rather than widening it — real
> instants make a date filter unnecessary for correctness.
> **Verified the honest way:** the three new overnight tests were run against the
> *pre-fix* implementation and **failed 3/27**; against the fix they pass **27/27**.
> A new test that merely passes proves nothing, so this was checked both ways.
> Full suite 317/317, `tsc --noEmit` clean, `eslint` clean on the changed files.
**File:** `vendor/lib/slotAvailability.ts:59,69-72`
**Found 2026-08-29 during Stage 1's "locate before building" step. Pre-existing — not
introduced by this plan.** It also **falsifies F7**, which said vendor had no occupancy
logic: `lib/slotAvailability.ts` has done overlap-counted availability since the schedule
refactor, and the 2026-08-28 upstream note repeated F7's claim without re-checking it.

**The defect.** `availabilityForDay` selects the bookings it counts with:

```ts
const onDate = mine.filter(b => b.bookedDate === dateStr && b.startTime && b.endTime)
```

and then compares by minutes-from-midnight. For a window that crosses midnight this is
wrong in a specific, silent way: `deriveSlots("23:00", 120, 60)` yields starts
`23:00` **and** `00:00`, but a booking of that `00:00` slot is stored with
`booked_date` = **the next day** (`20260828000001:215-232` — `booked_date` is the date a
booking *starts*). The `=== dateStr` filter drops it, so **every post-midnight slot of an
overnight window reads as fully free**, however many bookings it holds.

This is the exact failure booker's `getSlotOccupancy` documents and defends against:
*"Querying a single date would miss exactly the post-midnight bookings, and every one of
those slots would read as free."* Vendor never got the same treatment.

**Blast radius today is narrow:** one caller,
`components/schedule/DayDetailPanel/useDayDetailPanel.ts:42`, so it misinforms the
vendor's day panel ("N left") rather than moving money. The database still refuses the
overbooking. **It is untested** — `lib/slotAvailability.test.ts` covers a 09:00/180-minute
window and a date-granular schedule, and no overnight case at all.

**Why it matters to this plan.** The kiosk asks the same question this function answers.
Two implementations of "how much of this slot is left" in one app — one correct, one
subtly wrong — would disagree on screen: the day panel showing *2 left* while the kiosk
shows *1 left* for the same slot. See the open decision.

**Fix approach.** Count by **epoch instants over a two-day window**, as booker does:
include bookings whose `bookedDate` is the date *or the day after*, build each booking's
真 start/end instants (`end_time` may be `"24:00"`, so add minutes rather than parsing),
and overlap-compare those. Keep `availabilityForDay`'s signature and its existing tests
green; add overnight cases.

> ### ⏸ Everything waiting on PayMongo test accounts — the single list
>
> Added 2026-09-02 because this work is now spread across two plans and would otherwise
> be rediscovered piecemeal. When the credentials arrive, this is the whole set:
>
> | Where | Item | What it needs the accounts for |
> |---|---|---|
> | **this plan** | **B22** `PAYMONGO_WEBHOOK_SECRET` set but unread | wiring it up and seeing an event arrive |
> | **this plan** | **B23** `NEXT_PUBLIC_APP_URL` per environment | ⚠️ must be set on staging **before** the first payment test, not after |
> | **this plan** | kiosk payment end-to-end | never exercised — the kiosk's `create-session` has only been probed for auth |
> | **booker plan** | **A2** webhook config disclosure | how a real unsigned caller is treated in a deployed environment |
> | **booker plan** | **A3** webhook replay window | a genuine signed event to replay |
> | **booker plan** | signed-in booking → checkout | the regression check on B1's reordering |
>
> Booker plan = `.plans/2026-09-02-booker-payment-route-hardening.md`.
> ⚠️ **B23 is the one with an ordering constraint** — every other row can happen in any
> order once the accounts exist; B23 has to come first or the first payment test redirects
> somewhere wrong.

### B22 — `PAYMONGO_WEBHOOK_SECRET` is set in vendor but nothing reads it  ✅ DONE (2026-09-04)
> **Removed from `vendor/.env.local`** — one line, matched on the `^PAYMONGO_WEBHOOK_SECRET=`
> prefix rather than a line number so a shifted file could not take the wrong line. 16 → 15
> lines; the other eight keys verified present afterwards, `PAYMONGO_SECRET_KEY` included.
> **Booker's copy is untouched and must stay** — it is the only consumer.
>
> **Why removal cannot break settlement, established before deleting:** vendor has **no
> webhook endpoint at all** (its ten API routes were enumerated; the only payment one is
> `kiosk/payment/create-session`). PayMongo delivers paid events to the single URL
> registered in the dashboard, which is booker's. Vendor's kiosk session sends
> `metadata: { booking_id }` (`create-session/route.ts:103`) and booker's webhook keys on
> exactly that (`webhook/route.ts:48-51`) with no app- or booker-scoping, so a kiosk
> booking is settled by booker's webhook using booker's secret. Vendor's copy was read by
> nothing and could not be read by anything.
>
> **Verified after removal:** dev server restarted so the change actually took effect (Next
> reads env at startup), no startup error mentions the key, and
> `POST /api/kiosk/payment/create-session` unauthenticated still returns
> `401 {"error":"Not signed in."}` — B20's ordering intact.
>
> ⚠️ **Still outstanding, and it is not in this repo:** remove the same variable from
> vendor's entry in the **hosting platform**, if it was added there.
>
> ⚠️ The value is recoverable from `booker/.env.local` if it is ever needed again.
> ⚠️ **UNPARKED 2026-09-04 — the parking reason was wrong, and it was mine.** This was
> filed as "waiting on PayMongo credentials" because it was swept up with B23 when the
> user deferred *payment testing*. **It is a deletion.** Removing an unused credential
> needs no credentials. Re-confirmed 2026-09-04: `PAYMONGO_WEBHOOK_SECRET` is still in
> `vendor/.env.local`, and the only occurrence of that name anywhere in vendor's source is
> the comment at `create-session/route.ts:21` saying it must not be there. **Doable now.**

Nothing is broken meanwhile: the key is unused, server-only, and in test mode. The cost
of leaving it is a credential sitting in a second place for no reason, and a future
reader inferring a vendor webhook exists when the decision on record is that it must not.
**Unblocks when** the real credentials are provisioned — remove it in the same pass that
sets the rest.
**File:** `vendor/.env.local`
**Found 2026-08-29 during the pre-Stage-4 environment audit.** B4 states plainly that
this key **must not** be added to this app, and the only occurrence of the name in
`vendor/` source is that very comment — no code reads it.

**Why it was excluded, restated:** per F4 the booker webhook already settles kiosk
sessions, because it keys on `metadata.booking_id` and carries no app-scoping. A second
registered endpoint would race the first on the same `is_paid` transition for no gain.
So there is no vendor webhook, and therefore no consumer for the secret.

**The cost of leaving it:** an unused credential in a second environment is a second
place it can leak from, with zero benefit — and a future reader will reasonably infer
from its presence that a vendor webhook exists or is intended, which is the opposite of
the decision on record.

**Fix approach.** Remove the line from `vendor/.env.local`, and from the vendor entry in
whatever hosting environment it was also added to. Keep `PAYMONGO_SECRET_KEY` — that one
is required and correctly present.

---

### B23 — `NEXT_PUBLIC_APP_URL` must be set per environment  🔄 IN PROGRESS (2026-09-04)
> **Staging half ✅ done and verified remotely (2026-09-04).** Vendor deployed to
> `https://staging-vendor.ezzy.ph`; the served HTML self-references that origin and
> contains **zero** occurrences of `localhost:3000`, so the variable is set and
> `resolveSiteUrl()` is resolving to the right environment.
> Also confirmed from the response headers on the same deploy: **B32 shipped** —
> `img-src 'self' data: blob: https://fbxbwnfeimzhgxpshdpa.supabase.co`, pointing at the
> **staging** Supabase project, alongside a matching `connect-src`.
>
> ⚠️ **See B34: production also needs `booker` deployed there before the kiosk can
> settle a payment at all.**
>
> **Production half ⬜ remaining** — the value `https://vendor.ezzy.ph` is entered in
> Vercel (as **Config**, not Secret — a `NEXT_PUBLIC_` value is inlined into the browser
> bundle regardless of the label, so "Secret" there would promise a protection it cannot
> deliver) but no production app build has been deployed yet, deliberately, per Stage 8.
> ⚠️ **PARKING REASON CORRECTED 2026-09-04.** This is **not** waiting on PayMongo
> credentials — the variable is the *vendor app's own URL* and nothing about it comes from
> PayMongo. What it actually waits on is a **deployed environment to set it on**:
>
> | Environment | Value | State (2026-09-04) |
> |---|---|---|
> | local | `http://localhost:3000` | ✅ already correct |
> | staging | the staging vendor URL | ❌ vendor has never been deployed there |
> | production | `https://vendor.ezzy.ph` (`architecture/overview.md:88`) | knowable now, unset |
>
> **So it belongs to the deploy, not to a later credentials pass.** Set it *as part of*
> each deploy and the "before the first payment test" constraint is satisfied by
> construction. Credentials only matter for *testing* the redirect, not for setting it.
⚠️ **This one has teeth, and parking it is only safe while nobody takes a real payment.**
B4 builds PayMongo's `success_url` from this variable, so on any hosted environment where
it is unset or inherited from local, a customer who pays is redirected to **localhost**
and never returns — booking paid, tablet stranded on a dead page.
**Must be set before the first payment test on staging**, not merely before production.
**File:** deployment configuration (not in the repo)
**Found 2026-08-29.** Locally it reads `http://localhost:3000`, which is right for local
and matches vendor's default dev port. But B4 builds PayMongo's `success_url` and
`cancel_url` from it, so on any hosted environment it must be that environment's own
URL. If staging inherits the local value or leaves it unset, a customer who pays is
redirected to **localhost** and never returns to the kiosk — with the booking paid and
the tablet stranded on a dead page.

⚠️ **Cannot be verified from this repo.** Hosted env vars live in the deployment
platform, not in `.env.local`. Confirm on staging (and later production) that both
`PAYMONGO_SECRET_KEY` and `NEXT_PUBLIC_APP_URL` are set, before the first payment test.

⚠️ **Local gotcha, same root cause:** run the dev server on a non-default port and the
post-payment redirect still goes to `:3000`. Either use the default port for payment
testing or set the variable to match.

---

### B26 — Two sidebar baselines accepted  ✅ DONE (2026-08-29)
> Accepted on the user's explicit instruction, after they reviewed the diff and the
> rendered result. `npx playwright test -g "sidebar" --update-snapshots` → both
> regenerated, **2 passed**.
> **Verified by checksum, not by the run's own word:** `sidebar-dark` `b7b79bd9 →
> 64d34241`, `sidebar-light` `a8658d4f → 7bccd203`, and git reports both as modified.
> The new baseline was opened and confirmed to contain the Kiosk Mode item.
> ⚠️ **A passing `--update-snapshots` run is not evidence** — it rewrites the baseline
> and then compares against what it just wrote, so it can only pass. The meaningful
> check is a plain `-g "sidebar"` re-run against the committed images.
> ✅ **That re-run was done (2026-09-02): `2 passed`, exit 0, no update flag.** The two
> baselines are genuinely green, so the whole suite now stands at **161 passed / 0
> failed** (159 were already green in the 2026-08-29 full run; these are the other two).
>
> **What this locks in:** the sidebar exactly as reviewed, including the bordered-pill
> treatment that sets Kiosk Mode apart from Settings and Calendar — deliberate, so the
> entry reads as a mode switch rather than another page. Changing that styling later
> means another baseline update.
>
> ⚠️ **The two PNGs are uncommitted.** `vendor` was clean before this, so they are the
> only change in the tree.
**Files:** `visual-tests/pilot.spec.ts-snapshots/sidebar-light-*.png`, `sidebar-dark-*.png`
**Found by running the visual suite in Stage 6.**

**Confirmed result: `2 failed, 159 passed (8.5m)` of 161.** The only two failures are
`ui-gallery sidebar-light` and `sidebar-dark`, which fail because B13 added the **Kiosk
Mode** item to the sidebar. Every other baseline is green — the kiosk work touched no
existing rendered surface apart from that one item.

⚠️ **The shell wrapper reported `exited with code 0`.** That was the exit status of the
compound command, not of Playwright — read from the wrapper it would have looked like a
clean run. This is exactly the failure the repo's own convention warns about: take the
result from the `N failed / N passed` summary line in a redirected log, never from a
pipeline's exit code. The diff was inspected rather than assumed: **exactly one change,
the new item, in its intended position below Calendar — nothing else moved.** That is a
baseline to accept, not a bug to fix.

**Deliberately not accepted by Claude.** I7's reasoning applies here too: a baseline
freezes whatever renders as "expected", and nobody has looked at the new sidebar item on
a real screen. Reviewing a diff is not the same as approving a design. The suite staying
red is the honest state until someone decides they like it.

```bash
cd vendor
npx playwright test --update-snapshots -g "sidebar"
```

⚠️ Read the result from a redirected log — piping through `tail` hides the failure count
and the exit code.

**Unrelated, and pre-existing:** the run also logs *"Hydration failed"* from
`LoginPage`'s password input (`caret-color: transparent`). Nothing to do with this plan —
that surface was never touched — but it is noise in every run and worth its own look.

---

### B25 — Phone matching failed on the local Philippine format  ✅ DONE (2026-08-29)
**File:** `lib/kioskCloseOut.ts`
**Found by a test written in Stage 6, against code shipped in Stage 5.**

The close-out lookup matched phone numbers by suffix in either direction. That is wrong
for the two ways a Philippine mobile is written: `0917 555 0142` locally and
`+63 917 555 0142` internationally. **The leading `0` replaces the `63`**, so neither
digit string is a suffix of the other even though they are the same number.

**The consequence would have been silent and infuriating:** a customer who gave one form
at booking and typed the other at the kiosk would be told their booking does not exist,
and would have to find staff — the exact errand the close-out flow removes.

**Fix:** compare the last **ten** digits when both strings have at least ten, which is
the significant part of a mobile number once trunk prefixes and country codes are
stripped; fall back to suffix matching for shorter entries, so someone typing only the
last few digits off a receipt still matches. No country is hard-coded.

**Why it was caught:** the matcher was extracted from the route into `lib/` purely so it
*could* be tested, and the first realistic fixture broke it. It would not have been
caught by type-checking, by lint, or by any smoke test that does not use two formats of
the same number.

---

### B24 — `react-hooks/refs` taints a hook's whole return object  ✅ DONE (2026-08-29)
**File:** `components/kiosk/KioskSignaturePad/KioskSignaturePad.tsx`
**Found by lint in Stage 4b, after three wrong diagnoses — recorded so the next person
does not repeat them.** Every property access on the signature hook's result
(`p.onPointerDown`, `p.clear`, `p.hasInk` …) raised *"Cannot access refs during
render"* — seven errors from one cause.

What did **not** fix it: returning a callback ref instead of the ref object; hoisting
the handlers into `useCallback` and memoising the return; removing the `useRef`
entirely. The rule was tainting **property access on the returned object**, not the ref.

**The fix is to destructure at the call site** —
`const { setCanvas, onPointerDown, … } = useKioskSignaturePad(onChange)` — which breaks
the chain the rule follows.

⚠️ **Relevant to every other hook in this plan.** `useKioskBooking`, `useKioskShell` and
the rest return objects read as `k.foo` and are **not** flagged, so the taint is
specific to hooks the rule considers ref-bearing. If a future hook here grows a ref and
starts throwing this error in bulk, destructure rather than restructuring the hook —
that is the thing that actually works.

**Kept from the wrong turns anyway:** the canvas now lives in state via a callback ref
(the sizing effect has something real to depend on), and the stroke-in-progress flag is
gone in favour of `hasPointerCapture` — one fact, one source.

---

### B21 — Attachments cannot be created before their offering exists  ✅ DONE (2026-08-29)
**File:** `components/offerings/OfferingFormModal/OfferingFormModal.tsx`
**Found while building I2.** `requirements` is a JSONB column on `offerings`, so the
form saves it atomically with everything else. Attachments are **rows in their own
table**, FK'd to `offerings(id)` — there is no id to attach them to until the offering
is saved. Buffering them in state until Save would create a second write path that can
fail *after* the offering has already been created, leaving the vendor with a saved
offering and lost attachments and no clear recovery.

**Resolved:** the editor mounts in **edit mode only**; add mode shows a one-line note.
This is the same shape as schedules, which already prompt after creation
(`SchedulePromptModal`) rather than being captured inline. Recorded rather than left
implicit because it is a visible UX consequence of a schema choice, and the obvious
"just buffer it" alternative looks reasonable until the failure path is drawn.

---

### B20 — Auth must precede the config check on payment routes  ✅ DONE (2026-08-29)
> 🔗 **Coupled to the mobile plan's B1 (2026-09-03)** — it rewrote the very helper this
> ordering depends on. Re-verified after that change: `requireVendorAdmin` at
> `create-session/route.ts:49`, `secretKey` at `:52`. See B15's coupling block.
**File:** `vendor/app/api/kiosk/payment/create-session/route.ts`
**Found by probing the running route in Stage 2, not by reading it.** The first live
request — an unauthenticated POST — came back
`500 {"error":"Payment not configured"}`, because the `PAYMONGO_SECRET_KEY` check ran
before `requireVendorAdmin`. Two problems: an anonymous caller learns the server's
configuration state, and the guard could not be demonstrated at all because the request
never reached it.

**Inherited, not invented.** `booker/app/api/payment/create-session/route.ts` tests the
key first too. The kiosk route was written as a deliberate fork of it and copied the
ordering along with everything else.

**Fixed:** authorise first, then check config, then read the booking. The caller now
names the `vendorId` rather than having it read from the booking row — membership can
then be checked with **no database read**, which also removes a booking-existence
oracle: an unauthorised caller cannot learn whether a booking id is real. The booking's
own `vendor_id` is still compared afterwards, so naming a vendor you administer does not
let you pay for someone else's booking.
**Verified live:** the same request now returns `401 {"error":"Not signed in."}`;
`{}` still returns 400.

⚠️ **Booker had the same ordering** — a different app, so outside this plan's approved
scope (AGENTS.md cross-app gate). ✅ **Now fixed under its own plan**,
`.plans/2026-09-02-booker-payment-route-hardening.md` (approved 2026-09-02), where it is
that plan's B1. Proven live there by blanking `PAYMONGO_SECRET_KEY` — the only state in
which the defect is observable.

---

### B27 — `AppShell` navigates during render; React logs an invariant error  ✅ DONE (2026-09-02)
> **Executed:** `AppShell.tsx` — `useEffect` added to the `react` import; the navigation
> moved into `useEffect(() => { if (kioskDevice) router.replace("/kiosk") }, [kioskDevice, router])`
> beside the `kioskDevice` state; the render branch reduced to `if (kioskDevice) return null`.
> The lazy initialiser at `:50` was left alone, as the item required.
>
> **Verified — machine:** `tsc --noEmit` clean; `npm test` **354/354**; `npx eslint` on the
> file → **0 errors**, 1 pre-existing `setBookings` unused-var warning, and **no
> `react-hooks/exhaustive-deps` complaint** (the dep array is complete).
>
> **Verified — live, in a real browser.** Scripted against the running dev server on
> :3000 with Playwright, reproducing the reported scenario exactly: load `/`, write
> `ezzy.kioskMode` to `localStorage`, reload `/`. Result — redirect still lands on
> `/kiosk`, **0 render-phase invariant errors, 0 console errors of any kind.** The run
> first fires a deliberate `console.error` canary and asserts it was captured, so the
> clean result is proof the collector works rather than proof it was looking the wrong
> way.
**File:** `vendor/components/layout/AppShell/AppShell.tsx:86-89`

```tsx
if (kioskDevice) {
  router.replace("/kiosk")   // ← side effect in the render phase
  return null
}
```

`router.replace` schedules a state update on the Router **while `AppShell` is
rendering**, which is the update-another-component-during-render invariant. React logs
`Cannot update a component (Router) while rendering a different component (AppShell)`
and points at line 87. Reported from a dev-server restart with the browser in kiosk
mode.

> ⚠️ **Correcting the report's framing — this is NOT restart-specific.** The reporter
> asked to be sure "that does not happen in normal circumstance". It already does. The
> branch runs on **every load of `/` by a kiosk device**, and `app/manifest.ts` sets
> `start_url: "/"` — so the **PWA relaunch after a tablet reboot**, which
> `lib/kioskMode.ts`'s own header names as the reason kiosk mode exists at all, takes
> this exact path. The restart merely made it visible. Severity is therefore blocker,
> not curiosity.

**What is NOT wrong** (checked, so the fix stays four lines):
- **No hydration mismatch.** Server renders `kioskDevice = false` (`typeof window ===
  "undefined"`) and falls to `if (isCheckingAuth || …) return null` — `isCheckingAuth`
  is `useState(true)` at `useAppShell.ts:162`. Server emits null, client's first render
  emits null. The lazy initialiser at `:50` is sound and **stays** — moving the
  `localStorage` read into an effect would cost the frame of admin chrome that B14
  exists to prevent.
- **No hook-order hazard.** Nothing after line 86 calls a hook (verified by scan), so
  the early `return null` is legal today — but the new effect must still be declared
  **above** it, and above the four other conditional returns at `:94-130`.
- **Nowhere else in the app does this.** Swept every `router.replace|push` in
  `components/`, `app/`, `lib/`, `hooks/`: `useKioskShell.ts:93` is inside a
  `useEffect`, `useKioskShell.ts:186` and `useKioskLauncherDialog.ts:56` are inside
  returned callbacks. `AppShell:87` is the only render-phase navigation.

**Fix approach:** split the effect from the render decision — navigation into a
`useEffect` beside the existing `kioskDevice` state at `:50`, the bail-out left in
render:

```tsx
useEffect(() => {
  if (kioskDevice) router.replace("/kiosk")
}, [kioskDevice, router])
...
if (kioskDevice) return null   // unchanged: still no admin frame paints
```

The no-flash property is preserved by `return null`, which was always what provided it
— `router.replace` never did. Add `useEffect` to the `react` import at `:2`.

**Component separation:** `AppShell.tsx` is a client component that already holds hooks
inline (it is the shell that owns `useAppShell`); this adds one effect adjacent to the
state it guards and introduces no new component, so `component-separation` is unchanged
by this item.

**Verification:** machine — `tsc --noEmit`, `npm test` (354), `npx eslint` on the file
(watch `react-hooks/exhaustive-deps`, and B24's `react-hooks/refs` lesson). Live —
**this one needs a browser**: set `ezzy.kioskMode` in localStorage, load `/`, confirm
the console is clean and the redirect to `/kiosk` still happens with no dashboard frame.

---

### B28 — `AccountCompletionModal` renders ON TOP of the kiosk launcher, killing every button  ✅ DONE (2026-09-03)
> **Fixed by D25(a), not by the Radix port.** Two changes, in this order:
> 1. **D24(a) — the Radix port.** Necessary and kept for the focus trap, Escape handling
>    and consistency, but it did **not** fix the bug: peers still stack by DOM order.
> 2. **D25(a) — the launcher no longer opens at all when the account is incomplete.**
>    `AppShell.tsx` gains `accountIncomplete` (reused by the TopBar prop, which previously
>    inlined the same expression) and an `openKiosk` handler that opens the **completion
>    modal** instead. Two dialogs can no longer stack, because the second one never opens.
>
> **Why (a) rather than closing the completion modal:** `isAccountComplete` is
> `hasOffering && hasPayoutDetails`, computed by the DB view. Incomplete therefore means
> either nothing to sell or — the serious one — **no active payout destination**. A kiosk
> started in that state takes a walk-in's money with nowhere for it to go. The caveat
> raised in D25 ("does the copy overstate it?") was checked and the answer is **no**.
>
> **Verified live, on the account that exhibited the bug** (`jose@`, no payout method):
> login → completion modal auto-opens → dismiss → click **Kiosk Mode** →
> **the launcher does not open**, the completion modal opens instead, and its primary
> control reads **"Add payout details"** and is hittable. Before this, the launcher opened
> and every control in it was dead.
> `tsc` clean, `npm test` 365/365, `eslint` clean (one pre-existing `setBookings` warning).
>
> ✅ **The complete-account path is now verified too (2026-09-03),** after the user added
> payout details to Citywide through the UI. Measured: login now auto-opens the **Getting
> Started guide** rather than the completion modal — exactly what `AppShell.tsx:88-94`
> predicts, since the guide's once-ever flag was left unspent while the completion modal
> had the earlier visit. Dismiss it, click **Kiosk Mode**, and the **launcher opens as the
> only dialog**, its Start button hittable and enabled, and clicking it lands on `/kiosk`.
> Both sides of D25(a) are therefore exercised: refused when incomplete, allowed when not.
>
> ⚠️ **A sibling worth knowing about, NOT a defect today:** the guide modal is also modal
> and also auto-opens, so it blocks the sidebar the same way the completion modal did.
> D25(a) does not guard against it — it does not need to, because the guide cannot appear
> *after* the launcher (it opens once, on load, before anything is clicked). If its
> auto-open ever becomes deferred or repeatable, it would re-create B28's race.
> **⚠️ ROOT CAUSE CORRECTED 2026-09-03. The diagnosis below was HALF RIGHT, and acting on
> it alone did not fix the bug.**
>
> The hand-rolled overlay was a real defect and is now gone (see the port below), but it
> was **not** what made the launcher unclickable. Measured after the Radix port, with both
> dialogs now portalled peers at `z-50`:
>
> ```
> …end of <body>…
>   DIV  fixed inset-0 z-50 bg-black/50 backdrop-…   ← launcher overlay
>   DIV#radix-_r_6_  KioskLauncherDialog_card__…     ← launcher content
>   DIV  fixed inset-0 z-50 bg-black/50 backdrop-…   ← AccountCompletionModal overlay
>   DIV#radix-_r_a_  fixed z-50 left-1/2 top-1/2 …   ← AccountCompletionModal content  ▲ ON TOP
> ```
>
> `elementFromPoint` at the button centre still returns the completion modal's content.
> With equal `z-index` in one stacking context, **DOM order decides — and the completion
> modal's portal mounts later.** Raising the launcher's z-index or re-ordering portals
> would only move the same fight somewhere else.
>
> **The actual cause is that TWO MODALS ARE OPEN AT ONCE.** Nothing coordinates them.
> `AppShell.tsx:93-94` already coordinates the *guide* modal against the completion modal
> (`suppressAutoOpen: completionState.modalOpen`) — the kiosk launcher was simply never
> added to that contest. See **D25**.

> **✅ The Radix port (D24a) is done and stays** — necessary, and worth having on its own
> merits, but **not sufficient**. `KioskLauncherDialog.tsx` now uses
> `Dialog.Root/Portal/Overlay/Content` with `Dialog.Title` and `Dialog.Description`, the
> app's standard scrim per D19(b), and Escape / overlay-click resolving to Cancel. It
> gains the focus trap, Escape handling and scroll lock the hand-rolled version never had,
> and `.overlay` is deleted from the stylesheet with a note not to reintroduce it.
> `tsc` clean, `npm test` 365/365, `eslint` clean.
> **Still open:** the coordination fix. The bug is NOT yet fixed for a user.
**Files:** `components/kiosk/KioskLauncherDialog/KioskLauncherDialog.module.css:16` (`z-index: 60`)
vs `components/onboarding/AccountCompletionModal/AccountCompletionModal.tsx:75`
(`<Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[6px]" />`).

**Found by the local end-to-end pass, 2026-09-02** — not by reading. It is why the pass
could not get past B13, and chasing it down is the only reason it was found at all.

**Measured, not inferred.** With `jose@bookdeck.com` (an account showing "1 step left
before you can take bookings"), opening Kiosk Mode from the sidebar gives **two**
`role="dialog"` elements — the launcher AND the completion modal — and
`document.elementFromPoint()` at the centre of the launcher's **Start Kiosk Mode** button
returns the completion modal's overlay, **not the button**:

```
role=dialog: 2
  • Start Kiosk ModeCitywide Sports CenterThe screen switch…
  • Complete your account1 step left before you can take bo…
full-screen fixed overlays: 1
  · class="fixed inset-0 z-50 bg-black/50 backdrop-blur-[6px]"  z=50
elementFromPoint(button centre) → DIV.fixed   (isTheButton: false)
```

**Impact:** the launcher's overlay declares `z-index: 60` and the Radix overlay only 50,
yet Radix wins — it portals to the end of `<body>`, so the launcher's 60 is confined to a
lower stacking context and never competes. The card is fully covered by `inset-0`, so
**every** control in it is dead, *including Cancel*. A vendor in this state sees the
launcher appear and simply cannot interact with it; the only way out is a reload.

⚠️ **The affected population is exactly the wrong one:** `AccountCompletionModal`
auto-opens for accounts that are not yet complete — i.e. **new vendors**, who are the
people most likely to be setting a tablet up for the first time.

> **Pre-existing, not caused by I10.** I10 changed this overlay's colour and blur only;
> `z-index: 60` is unchanged from the original. The clash has been there since B13.
> `AppShell.tsx:69-77` already reasons carefully about the guide and completion modals not
> stacking **on each other** — the gap is that the kiosk launcher was never considered as a
> third participant in that same contest.

**Fix approach (not yet chosen — see D24):** the launcher is a plain CSS-module overlay
while the rest of the app's modals are Radix dialogs, and that mismatch is the root of it.
**Verification:** the pass already has the probe — assert `elementFromPoint` at the
button's centre resolves to the button, on an account with an incomplete profile.

---

### B29 — "Write text" crashes, and a text document cannot be authored at all  ✅ DONE (2026-09-03)
> **Executed per D26(a) — the feature is finished, not just the crash stopped. 5 files:**
> - `lib/attachmentDraft.ts` **(new)** — `documentDraftValid(body)`, the rule that mirrors
>   the constraint, in `lib/` so `node --test` reaches it. Used in two places, so
>   extracting it also removes a duplicated rule.
> - `lib/attachmentDraft.test.ts` **(new)** — 2 tests. Suite **369 → 371**.
> - `useOfferingAttachmentsEditor.ts` — `addTextDocument` replaced by a `DocumentDraft`
>   held in local state, with `startNewDocument` / `editDocument` / `patchDraft` /
>   `cancelDraft` / `saveDraft`. One shape serves both a new document and an existing one;
>   the only difference is whether `id` is null.
> - `OfferingAttachmentsEditor.tsx` — the body editor that never existed: a title input, a
>   textarea, a signature toggle for new documents, and Save/Cancel. Written documents gain
>   an **Edit text** button; uploaded files do not, since they have no body.
> - `OfferingAttachmentsEditor.module.css` — `.draft`, `.draftBody`, `.draftActions`.
>
> **The constraint is satisfied by construction, not worked around.** No row exists until
> Save, so there is no window in which B12 could turn a half-written document into an
> agreements step in front of a customer. Save is disabled until there is content, with the
> reason shown as text rather than left as a failed insert to interpret — and `saveDraft`
> re-checks anyway, so the guard does not depend on the button being disabled.
>
> **Body is written ONCE on save, never per keystroke** — `run()` refetches every
> attachment after each mutation, so an onChange-driven save would issue one UPDATE and one
> full refetch per character. That is what `rename` still does (**I16**, open).
>
> **Verified — machine:** `tsc` clean, `eslint` clean, `npm test` **371/371**.
> **Verified — live, driving the exact reported flow** (Playwright, `jose@` → Offerings →
> Edit → Documents):
>
> | Step | Result |
> |---|---|
> | click **Write text** | **0 console errors** — the reported crash is gone |
> | body editor | appears |
> | Save with an empty body | **disabled** |
> | Save with text | enabled |
> | save | **0 constraint errors**; row persisted, `body` 74 chars, `storage_path` null |
> | **Edit text** on that document | offered, existing body loaded, edit saved, 0 errors |
>
> ⚠️ **Test data left behind:** the live runs created **two "Facility Waiver" documents on
> Private Coaching Session** (Citywide) in the LOCAL database. They are real rows — per B12
> that offering now shows an agreements step in the kiosk. Keeping one is genuinely useful
> (it is the first document in local data, so B12's *positive* case becomes testable for
> the first time); two is clutter. Removable from the offering form. Not deleted here
> because it is the user's dev data.
**Files:** `components/offerings/OfferingAttachmentsEditor/OfferingAttachmentsEditor.tsx:165`
(the button), `:118-150` (the row that has no body field),
`useOfferingAttachmentsEditor.ts:108-115` (`addTextDocument`).

**Reported 2026-09-03:** clicking **Write text** in the offering form's Documents section
returns

```
new row for relation "offering_attachments" violates check constraint
"offering_attachments_has_content"
```

**The immediate cause** is one line — the button inserts an empty row up front:

```tsx
onClick={() => void a.addTextDocument("New document", "", false)}
```

That is `storage_path IS NULL` **and** `body = ''`, which is exactly what
`offering_attachments_has_content` (`20260829000001`) forbids: `storage_path is not null
or body <> ''`. The constraint is correct — an attachment with no content is meaningless
— so **the constraint is not what should change.**

> ## ⚠️ THE REPORTED ERROR IS THE SMALLER HALF
>
> **There is no body editor anywhere in the offering form.** A document row renders an
> icon, a **title** input, a `"Uploaded file" | "Written text" · v{version}` sub-line, a
> signature toggle and a delete button (`:118-150`). Nothing accepts the text.
>
> So even with the crash fixed, a "written text" document could never be written. Yet
> `StepAgreements.tsx:25` **renders `d.body` to the customer**, the schema stores it, and
> `updateAttachment` already accepts it (`offeringAttachments.service.ts:202`). The
> consuming half shipped; the authoring half never existed.
>
> **I2 is marked ✅ and this path was never usable** — the item is not being reopened,
> because everything I2 claims it delivered does work; this is a gap it did not cover, and
> it is recorded here rather than by rewriting history.

**Why the one-line fix is wrong.** The tempting repair is to seed a placeholder body so
the insert satisfies the constraint. **Do not.** `is_active` defaults to `true`
(`20260829000001:54`) and B12's rule is `needsAgreement = documents.length > 0` over
active documents — so *any* document row, including a placeholder nobody filled in,
**immediately puts an agreements step in front of every kiosk customer** for that
offering. That trades a visible crash for a silent customer-facing change, which is
strictly worse. Relaxing the constraint is worse again: it needs a new migration to a
schema now live in **production**, and it would *permit* exactly those junk rows.

**Fix approach — see D26.** Whichever option is chosen, one constraint is not optional:

⚠️ **The body editor must NOT follow `rename`'s pattern.** `rename` is wired to
`onChange` (`:121`) and `run()` performs a DB write **and a full refetch**
(`useOfferingAttachmentsEditor.ts:71-78`), so typing a document title today issues **one
UPDATE and one refetch per keystroke**. A textarea holding a facility waiver built the
same way would issue hundreds. Body edits must be local state committed on an explicit
save or on blur. See **I16**, which is that pre-existing defect on its own.

**Component separation:** all new state and handlers go in
`useOfferingAttachmentsEditor.ts`; the `.tsx` stays a render layer and any new styling
goes in the existing `.module.css`.

**Verification:** machine — `tsc`, `npm test`, and a unit test that a draft with an empty
body is never sent to `createTextDocument`. Needs-live — click **Write text**, confirm no
constraint error, type a body, save, reopen the offering and confirm it persisted, then
confirm the kiosk's agreements step renders that text.

---

### B30 — `vendor/.env.local` holds a LIVE PayMongo key on a local dev machine  ✅ DONE (2026-09-04)
> **Corrected by the user the same day.** Re-verified 2026-09-04: `vendor` and `booker`
> both read `sk_test_`. The live key belongs only in the production environment variable.
> ⚠️ **If that live key was ever exposed** (shell history, screenshot, shared channel),
> rotating it in the PayMongo dashboard is still worth doing — not checkable from here.
**File:** `vendor/.env.local` — `PAYMONGO_SECRET_KEY`
**Found 2026-09-04** while verifying B22's reasoning, by comparing vendor's and booker's
keys. Not reported; found by measurement.

| App | Key mode | Supabase target |
|---|---|---|
| `vendor` | **`sk_live_`** | `http://127.0.0.1:54321` (LOCAL) |
| `booker` | `sk_test_` | `http://127.0.0.1:54321` (LOCAL) |

⚠️ **On 2026-09-02 both read `sk_test_`.** This changed between then and now. Recorded as an
observation, not an accusation — but it means any earlier statement in this plan that
"payment initiation is testable locally because both keys are test keys" is **now false**,
and that statement was mine.

**Three consequences, in order of severity:**

1. **A completed kiosk payment on localhost would be a REAL charge.** The kiosk calls
   `https://api.paymongo.com/v1/checkout_sessions` with whatever key is configured — there
   is no sandbox switch other than the key itself
   (`kiosk/payment/create-session/route.ts:86-90`). A live key plus a real card is real
   money, taken against a LOCAL database whose bookings are throwaway.
2. **Settlement cannot work in this configuration even if it were test mode.** Vendor would
   create sessions on the **live** account while booker's `PAYMONGO_WEBHOOK_SECRET` is for
   the **test** account. Webhook events from a live session cannot be verified by a test
   secret, so `is_paid` would never flip.
3. **It reopens the question B22 answered.** F4's "the booker webhook already settles kiosk
   sessions" holds only while both apps are on **one PayMongo account in one mode**. Live
   and test are effectively different accounts with different keys and separate webhook
   registrations. B22's removal of `PAYMONGO_WEBHOOK_SECRET` from vendor was correct *for
   the single-account design*; if vendor is genuinely meant to operate on a different
   account, that design — not just the variable — needs revisiting.

**Fix approach:** the user's call, and it is a configuration decision, not a code one.
Almost certainly: put `sk_test_` back in local `vendor/.env.local`, matching booker, and
reserve the live key for the production environment variable only — never a developer
machine. **Not changed here: this is a credential, and rotating or replacing one is the
user's decision, not something to do unannounced.**

⚠️ **If that live key has ever been in a shell history, a screenshot, or a commit, treat it
as exposed and rotate it in the PayMongo dashboard.** `.env.local` is gitignored — verified
— so it is not in the repository.

**Verification:** confirm `vendor/.env.local`'s key begins `sk_test_`; confirm the
production Vercel env holds the live key and local does not. Neither is checkable from this
repo beyond the local file.

---

### B31 — Two signature-required documents collide on one primary key  ✅ DONE (2026-09-04)
> **Executed — the row builder moved out of the route and became testable.**
> `lib/kioskAcknowledgements.ts` **(new)** owns `acknowledgementRows()` with `id:
> randomUUID()` unconditionally; `booking/route.ts` calls it. `ackId` keeps its only
> remaining job — naming the signature object — which is correct: **one signature file,
> shared by every row that required one**, matching B12's `.some()` semantics.
> **6 new tests** (`lib/kioskAcknowledgements.test.ts`), suite **371 → 377**, including the
> exact two-signature shape that failed and a 25-document uniqueness check.
>
> **Extracted rather than patched in place, deliberately:** the defect was invisible from
> the route because the builder was an inline `.map`, and no test could reach it. The two
> halves of the invariant — *ids unique, signature path shared* — are easy to undo by
> accident, so both are asserted.
>
> **Verified — machine:** `tsc` clean, `eslint` clean, 377/377.
> **Verified — live, against the exact failing shape.** "Foot spa" (2 documents, **both**
> requiring a signature) booked via a direct authenticated `POST /api/kiosk/booking`:
>
> ```
> HTTP 200  {"bookingId":"746bf964…","bookedDate":"2026-09-08","customerCreated":true}
> rows | distinct_ids | distinct_signature_paths
>    2 |            2 |                        1
> ```
>
> Before the fix that insert produced 2 rows with **1** id and died on `23505`. The UI walk
> was abandoned for a direct call — same route, same insert, far less to go wrong in the
> harness.
**File:** `vendor/app/api/kiosk/booking/route.ts:162` and `:182`

**This is the reported "Could not record the agreements. Please try again."**

```ts
const ackId = randomUUID()                         // :162 — generated ONCE
…
id: d.requires_signature ? ackId : randomUUID(),   // :182 — reused for EVERY signed doc
```

`booking_acknowledgements.id` is the primary key. An offering with **two or more**
documents that require a signature builds two rows carrying the **same `id`**, the batch
insert raises `23505 unique_violation`, and the route rolls the booking back and returns
that message.

**Reproduced 2026-09-04**, not inferred — the exact two-row shape was inserted against a
temp table cloned from the real one (`including all`, so the PK came with it):

```
ERROR:  duplicate key value violates unique constraint "probe_pkey"
DETAIL:  Key (id)=(1111…) already exists.
```

**Why it appeared now and not earlier:** it needs an offering with ≥2 signature-required
documents, which local data did not have until recently. It does now — **"Foot spa" has 2
documents and both require a signature**, while "Private Coaching Session" has 2 requiring
none. That is exactly the split between the offering that fails and the ones that do not.

**Consequence:** such an offering **can never be booked at the kiosk**. Every attempt dies
at the last step, after the customer has entered their details and signed.

**Fix approach:** `id: randomUUID()` unconditionally. `ackId` keeps its *other* job —
naming the signature object at `:165` — and that is correct: **one signature file, shared
by every row that required one.** This matches B12, whose `needsSignature` is `.some(...)`,
i.e. a single signature step covers all signature-demanding documents. Nothing about the
storage path or the flow changes; only the row identity.

**Verification:** machine — a unit test over the row builder asserting N documents produce
N distinct ids with a shared `signature_path`. Needs-live — book the "Foot spa" offering
end to end and confirm the acknowledgement rows land.

---

### B32 — CSP blocks every Supabase-hosted image, so uploaded photos never render  ✅ DONE (2026-09-04)
> **Executed — `next.config.ts`.** Extracted `supabaseOrigin()` so `img-src` and
> `connect-src` share ONE derivation, added `supabaseImgSrc()`, and changed the directive to
> `` `img-src 'self' data: blob:${supabaseImgSrc()}` ``. **Derived, never a wildcard**, for
> the reason the file already documents at `:37-48`.
>
> **Emitted per environment, checked before touching a browser:**
>
> | env | `img-src` |
> |---|---|
> | local | `'self' data: blob: http://127.0.0.1:54321` |
> | hosted | `'self' data: blob: https://<ref>.supabase.co` |
> | unset | `'self' data: blob: https://*.supabase.co` + a warning |
>
> The local row is the one a wildcard would have broken — the 2026-08-08 failure mode,
> avoided.
>
> **Verified — served header:** `curl -I` returns
> `img-src 'self' data: blob: http://127.0.0.1:54321`.
> **Verified — live in the kiosk offering grid:** 2 storage `<img>` elements, both with
> **`naturalWidth = 1254`** (genuinely decoded, not merely present), and
> **zero `securitypolicyviolation` events**. Before the fix these were blocked with
> `naturalWidth = 0`.
>
> ## 🔎 CROSS-APP FOLLOW-UP — CHECKED 2026-09-04, AND THERE IS NOTHING TO FIX
>
> I flagged that `command` and `booker` carry the same narrow `img-src`, and the user asked
> for both to be fixed. **Investigated first, and the change was NOT made — neither app
> renders a Supabase-hosted image, so widening its policy would loosen a security header
> for a need that does not exist.**
>
> | App | `img-src` today | Renders a storage image? | Action |
> |---|---|---|---|
> | `vendor` | now includes the Supabase origin | **Yes** — `StepOffering.tsx:45` and the attachment editor | ✅ fixed (this item) |
> | `booker` | `'self' data: ${TILE_HOST}` | **No.** Zero `<img>`, zero `<Image>`, zero `.storage` usage anywhere. Its only remote images are CARTO map tiles, already allowed | none |
> | `command` | `'self' data: blob:` | **No.** Its one storage call is `signKycUrl`, and `useKycPanel.ts:50` consumes it with `window.open(url, "_blank")` — a top-level navigation in a new tab, which `img-src` does not govern. The only `<img>` mentions in the app are a comment explaining why `BrandLogo` is inline SVG *instead* of one | none |
>
> **The directive being narrow is not the defect — rendering a blocked image is.** vendor did;
> these two do not.
>
> **What would change this answer:** booker gaining offering photos on the customer-facing
> booking flow, which is plausible and would need its `img-src` widened in the same commit
> as the feature. Adding it now, for code that does not exist, is speculative loosening.
**File:** `vendor/next.config.ts:98`

**This is the reported "uploaded photo does not show in the kiosk offering list".**

```
img-src 'self' data: blob:
```

The Supabase Storage origin is absent. `photoUrl()` returns
`<supabase-origin>/storage/v1/object/public/offering-photos/…`
(`offeringAttachments.service.ts:247-248`), which matches neither `'self'` (the page's own
origin) nor `data:` nor `blob:` — so the browser blocks it before a request is made.

> ⚠️ **NOT staging-specific**, which was the reporter's open question. The answer is no: it
> fails identically on local, preview, staging and production, because the blocked origin
> is always different from the page's. Locally it is `http://127.0.0.1:54321`; hosted it is
> `https://<ref>.supabase.co`.

⚠️ **Wider than the kiosk.** Two surfaces render storage photos, and both are broken:
- `kiosk/KioskBooking/StepOffering.tsx:45` — the customer's offering grid
- `offerings/OfferingAttachmentsEditor/OfferingAttachmentsEditor.tsx` — **the vendor's own
  photo manager.** A vendor uploads a photo and cannot see it in the very screen that
  uploaded it, which makes the photo half of offering attachments unusable.

**Fix approach:** add the Supabase origin to `img-src`, **derived** the way
`connect-src` already derives it — never a wildcard. `next.config.ts:37-48` is emphatic
about this and names the incident: a hardcoded `https://*.supabase.co` shipped on
2026-08-08 and broke both portals against local Supabase, because `127.0.0.1:54321`
matches neither the wildcard nor `'self'` — and it looked fine in production, which is how
it passed review. **`img-src` has the identical failure mode, and the same rule applies.**
Reuse the existing derivation rather than writing a second one; `img-src` needs only the
http(s) origin, not the `ws`/`wss` variant `connect-src` adds.

**Verification:** machine — assert the emitted CSP header contains the Supabase origin in
`img-src`. Needs-live — load the kiosk offering grid with a photo attached and confirm the
image renders with no `securitypolicyviolation` in the console. `visual-tests/smoke.spec.ts`
already listens for exactly that event and is the natural place to extend.

---

### B33 — Payment routes read the return URL raw, so a missing var redirects to localhost  ✅ DONE (2026-09-04)
**Files:** `vendor/app/api/kiosk/payment/create-session/route.ts` and
`booker/app/api/payment/create-session/route.ts`
**Cross-app — approved 2026-09-04.** Coupled to **B23**: this is what makes B23 safe to get
wrong.

Both routes read `process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"` directly,
bypassing `lib/siteUrl.ts`. **The silent fallback was the danger.** On a hosted deploy with
the variable unset the **build still succeeds** — `resolveSiteUrl()` protects Open Graph
metadata by falling back to `VERCEL_PROJECT_PRODUCTION_URL` — while these lines quietly
hand PayMongo a `success_url` pointing at **localhost**. A customer pays and never returns:
booking charged, tablet stranded, nothing reporting a fault. The build-time guard gave
false comfort; it protected metadata, not the money path.

**Executed:** both routes now use `resolveSiteUrl().origin`, wrapped so a failure returns a
clean 500 and logs its cause rather than throwing an unhandled error at a customer.

⚠️ **`.origin`, not the URL object** — `String(new URL("https://x"))` is `"https://x/"`, so
interpolating the object would produce `https://x//kiosk`. A useful side effect: `.origin`
**normalises a trailing slash away**, so `https://vendor.ezzy.ph/` now yields a correct
single-slash URL where the old concatenation would not have.

⚠️ **Failing the request is the right trade.** Refusing before money moves beats taking it
and stranding the payer.

**Verified — machine:** both apps `tsc` clean and `eslint` clean; vendor 377/377.
**Verified — live (vendor), the full path:** authenticated `POST` for a ₱800 booking
returned **HTTP 200** with a real `checkout.paymongo.com` URL, and no "site URL unresolved"
in the log — so auth, the config check, the amount check, the URL resolution and the
PayMongo call all ran. Unauthenticated still returns `401`, so **B20's ordering is intact**.
⚠️ **booker's change is NOT exercised live** — same shape, type-checked and lint-clean, but
it needs a signed-in booker session to prove. It joins booker's existing outstanding
regression check.

---

### B34 — Kiosk payments cannot settle in production until `booker` is deployed there  ⬜ TODO
**Files:** none — a deployment/topology gap, not code.
**Found 2026-09-04** while answering "do I need a second webhook for production?" — by
reading the deployed CSP `connect-src` of each host to see which Supabase project it
actually talks to, rather than trusting the domain name.

| Host | Supabase project | |
|---|---|---|
| `staging-vendor.ezzy.ph` | staging `fbxbwnfeimzhgxpshdpa` | |
| `staging-booker.ezzy.ph` | staging `fbxbwnfeimzhgxpshdpa` | |
| **`vendor.ezzy.ph`** | **production `pdkejyjidrfxksaczvfy`** | old build — `/kiosk` 404s |
| `booker.ezzy.ph` | **staging** | stale build; serves no CSP header at all |

**Nothing runs booker against production.** The consequence chain:
1. `is_paid` is written **only** by `booker/app/api/payment/webhook` (F4, D4, B22 — there is
   deliberately no vendor webhook).
2. A production webhook must write to the **production** `bookings` table.
3. Therefore it must reach a booker deployment connected to the production project.
4. None exists. Pointing a live webhook at `booker.ezzy.ph` would attempt to settle
   production bookings against the **staging** database, where those rows do not exist —
   so the update matches nothing and the booking stays unpaid, silently.

⚠️ **A kiosk launched in production before this is resolved takes REAL money and never
marks the booking paid.** Worse than the staging equivalent: the customer is charged.

**This is not currently blocking anything** — verified 2026-09-04 that `vendor.ezzy.ph`
still serves the pre-kiosk build (`img-src` without the Supabase origin, `/kiosk` → 404,
`/api/kiosk/booking` → 404). It becomes blocking the moment the kiosk build reaches
production, which is Stage 8's last step.

**Fix approach — two options, and the first is already the documented intent:**
- **(a) ⭐ Deploy `booker` to production** and repoint `booker.ezzy.ph` at the production
  project. `architecture/overview.md:89` already records this as the plan ("repoint at
  production when it is [launched]") **and carries an ordering dependency**: repoint booker
  **first**, confirm, *then* set `PORTAL_URL_BOOKER` in production Command — otherwise
  booker-only users get a set-password email whose token cannot validate. See
  `auth-and-roles.md`.
- **(b) Give `vendor` its own production webhook.** Reverses B22/D4/F4 and re-creates the
  two-endpoints-racing-one-transition problem those decided against. Recorded so it is
  visibly rejected rather than rediscovered as a shortcut under launch pressure.

**Verification:** needs-live — after (a), a production kiosk booking paid with a live card
must flip `is_paid`. Until then the production kiosk is not launchable.

---

### B35 — Kiosk payment fails on staging; cause not yet identified  ✅ RESOLVED (2026-09-05)
> **Cause: `PAYMONGO_SECRET_KEY` was not set on staging-vendor.** The user added it and the
> payment flow now works. That was the first of the three candidates listed below — the
> `500 {"error":"Payment not configured"}` branch — and it is one of the two that **log
> nothing server-side**, which is exactly why Vercel's function log looked clean and the
> fault took two reports to pin down.
>
> **Pattern worth naming, because it has now cost time three separate times:** a missing
> environment variable on a hosted deploy presents as a *generic application failure*, not
> as a configuration error — `PAYMONGO_WEBHOOK_SECRET` (three attempts), `NEXT_PUBLIC_APP_URL`
> (B23/B33), and now this. The check that resolves it fastest is asking **"which variables
> does this route read, and is each one set on the environment this domain actually
> serves?"** rather than reading application code.
>
> **I18 was the right fix and arrived one report too late** — the browser console now names
> the cause directly, so a fourth occurrence should cost seconds.
>
> **Verified:** the user confirms payment now works on staging.
> ⚠️ **Not confirmed by this:** whether the webhook **settles** the booking (`is_paid` →
> `true`), and **R1** (the kiosk customer signing into booker). Reaching PayMongo's checkout
> page and being marked paid are different milestones.
**Files:** none yet — a live-environment fault, not a known code defect.
**Reported 2026-09-05**, second occurrence: the booking is created, then
`/api/kiosk/payment/create-session` fails and the customer sees *"The booking was created
but payment could not start. Please see staff."*

**The booking half is working.** `/api/kiosk/booking` returned 200 — the row exists, is
findable by staff, and **no card was charged**. Only session creation failed.

**Already ruled out on staging, by probe:**
- **Auth / B20 ordering** — unauthenticated returns `401 {"error":"Not signed in."}`.
- **The site-URL branch** — `staging-vendor.ezzy.ph` self-references itself in its served
  HTML, so `resolveSiteUrl()` resolves there; B33's 500 is not firing.

**Remaining causes, and how to tell them apart:**

| Response | Meaning | Logs server-side? |
|---|---|---|
| `500 {"error":"Payment not configured"}` | `PAYMONGO_SECRET_KEY` unset on staging-vendor | **no** |
| `400 {"error":"Invalid booking amount"}` | the offering is priced **₱0** | **no** |
| `502 {"error":"Failed to create payment session"}` | **PayMongo rejected it** | **yes** — `PayMongo error:` |
| `404` / `403` | booking not found / not a kiosk booking | no |

⚠️ **Two of the three likeliest log nothing server-side**, which is why Vercel's function
log looked clean. **I18 (shipped in `48c15db`) now writes the cause to the BROWSER
console** — `[kiosk/checkout] create-session failed { status, error }`. That line is the
fastest route to the answer and did not exist when this was first reported.

**Fix approach:** diagnose before changing anything. Reproduce with DevTools open, read
that line, then act on what it names. Do **not** guess-fix.

**Verification:** needs-live — a kiosk booking on staging reaches PayMongo's hosted
checkout page.

---

## IMPORTANT
### I17 — The booking route swallows the database error behind a generic message  ✅ DONE (2026-09-04)
> **Executed — `booking/route.ts`.** A `logCause(where, cause)` helper now records the
> failure at both paths that discarded it: the acknowledgement insert and the signature
> upload. The customer-facing strings are unchanged.
>
> ⚠️ **`code` and `message` ONLY — never `details` or `hint`, and that is a PII decision,
> not an oversight.** PostgREST echoes the offending row into `details` for several error
> classes, and these rows carry `signer_name` — the walk-in's real name. B6.1 keeps
> customer PII out of anything outliving the session, and a server log outlives it.
> `message` alone was sufficient here: for B31 it reads "duplicate key value violates
> unique constraint …", which names the defect outright.
>
> **Verified — machine:** `tsc` clean, `eslint` clean, 377/377.
> ⚠️ **NOT verified firing.** The log line has never been observed emitting, because the
> failure that would trigger it is exactly what B31 fixed. It is code-complete and
> type-checked, not exercised — recorded honestly rather than claimed.
**File:** `vendor/app/api/kiosk/booking/route.ts:198-201` (and the sibling paths at
`:172-175`)

```ts
const { error: ackError } = await admin.from("booking_acknowledgements").insert(rows)
if (ackError) {
  …
  return err("Could not record the agreements. Please try again.", 500)
}
```

`ackError` is destructured and then **never read**. The customer-facing message is right —
a walk-in must not be shown a Postgres constraint name — but nothing records the cause
anywhere, so **B31 presented as an unfalsifiable "try again" with no way to learn why.**
"Please try again" is also untrue for B31: retrying could never succeed.

Found while diagnosing B31, 2026-09-04. Pre-existing.

**Fix approach:** `console.error` the underlying error server-side before returning, keeping
the customer-facing text unchanged. Vercel captures server logs, so this is the difference
between a five-minute diagnosis and an hour of guessing. Apply to the signature-upload
branch too, which discards `uploadError` the same way.

**Verification:** machine — none meaningful. Needs-live — trigger a failure and confirm the
cause appears in the server log while the client still sees the friendly message.

---

### I16 — Renaming an attachment writes to the database on every keystroke  ✅ DONE (2026-09-03)
> **Executed — 2 files.** `useOfferingAttachmentsEditor.ts` gains a single `titleEdit`
> `{ id, value }` with `editTitle` / `commitTitle`; `OfferingAttachmentsEditor.tsx` reads
> the local value, commits `onBlur`, and drops the `onChange` write.
>
> **One entry, not a map, and that is deliberate:** a title can only be typed into the
> focused input, and blur commits before another can take focus. A map would imply
> concurrent edits that cannot happen and would need reconciling against every refetch.
>
> **Two writes are now skipped that the old path always made:** an unchanged title, and a
> blank one. Blank reverts rather than persisting an untitled document — which matters
> here, because a customer is asked to accept these by name.
>
> **Also fixed, and it was mine:** B29 introduced a conflict where a document open in the
> draft editor could have its title typed in *two* places, with the draft's copy winning on
> save. The row's title input is now disabled while that document is being edited below.
>
> **Verified — machine:** `tsc` clean, `eslint` clean, `npm test` 371/371.
> **Verified — live, by counting requests rather than reasoning about them.** Playwright
> intercepted every `PATCH` to `offering_attachments` while typing a 17-character title:
>
> | | Before | After |
> |---|---|---|
> | PATCHes while typing 17 chars | 17 (+17 refetches) | **0** |
> | PATCHes on blur | — | **1** |
> | PATCHes for an unchanged title | 1 per keystroke | **0** |
>
> Title persisted correctly (`Safety Rules 2026`). The before-column is what the old
> `onChange` path did by construction, not a measurement of reverted code.
**File:** `OfferingAttachmentsEditor.tsx:121` with
`useOfferingAttachmentsEditor.ts:71-78`.

```tsx
onChange={e => void a.rename(d, e.target.value)}
```

`rename` calls `updateAttachment`, and `run()` then bumps `reloadKey`, which refetches
every attachment for the offering. So typing a 20-character title issues **20 UPDATEs and
20 refetches**, each racing the last — and `busy` flickers throughout, disabling the
sibling buttons while the vendor types.

Found while diagnosing **B29**, not reported. Pre-existing and **not caused by** the kiosk
work, but it is in the file B29 must change and it is the pattern B29 must not copy.

**Fix approach:** hold the title in local state and commit on blur (or debounce), matching
how B29's body editor will have to behave. One shared approach for both fields.

**Verification:** machine — `tsc`, lint. Needs-live — type a long title and confirm a
single write on blur rather than one per character.

---


### I1 — Port occupancy and span checking into vendor  ✅ DONE (2026-08-29)
> **Delivered as three things, not the four functions this item first named** — because
> B19 showed vendor already had the counting. `lib/slotAvailability.ts` gained
> instant-based counting (B19), `slotInstant`, `slotDate`, `SlotBooking` and
> `spanAvailable`; `services/kiosk.service.ts` is a thin paged fetch and nothing else.
> `remainingForSlot` was **not** ported — `availabilityForDay` already returns
> `remaining` per slot, and a second spelling of it is the duplication this item warns
> about. `resolveScheduleForTime` is **not needed yet**: it resolves a picked time back
> to a schedule for the booking write, which is Stage 2's job (B1) and belongs with the
> code that writes the row.
> 17 new tests (317 total, 0 fail). Verification detail under Stage 1 in Execution order.
**Files:** `vendor/services/kiosk.service.ts` (new), reusing `vendor/lib/slots.ts` + `lib/occurrence.ts`
**Reference:** `booker/services/schedules.service.ts`

**Re-scoped 2026-08-29 — this item got SMALLER.** The overnight work added
`deriveSlots`, `spanFitsWindow`, `fitsInWindow`, `windowEnd` and `windowLength` to
**both** apps' `lib/slots.ts`, so vendor already holds more of the arithmetic than when
this item was written. Per F6/F7/F14 the remaining gaps are `getSlotOccupancy`,
`remainingForSlot`, `spanAvailable` and `resolveScheduleForTime`. Adapt them to
vendor's `Schedule` shape rather than booker's `BookerSchedule` — a field-for-field
copy will not compile, and forcing booker's type into vendor would duplicate a type the
app already has.

⚠️ **Build on `deriveSlots(start, windowMinutes, duration)`, never `slotsInWindow`.**
`lib/slots.ts:112-116` says plainly which is which: `slotsInWindow` is *"the interim
`end_time`-shaped caller, kept working until the readers move over"*, and `deriveSlots`
is *"THE ONE THAT SURVIVES … because a length has no midnight to cross."* New code
written against the shim would be born deprecated **and** unable to express an
overnight window — the exact bug the overnight plan just closed.

✅ **Done — see the completion note at the head of this item.** The analysis below is
kept as the record of how the scope was reached.

⚠️ **Re-scoped again 2026-08-29 by B19.** F7 ("vendor lacks occupancy") is **false** —
`lib/slotAvailability.ts` already counts overlap per slot. What vendor lacks is (a) a
*fetching* layer, because the kiosk route has no `AppShell` bookings array to read from,
and (b) correct handling of post-midnight bookings. How much of I1 remains depends on
B19's open decision.

⚠️ **Port the CURRENT booker versions — their signatures changed.** Verified
2026-08-29 in `booker/services/schedules.service.ts`:
`remainingForSlot(slot, occupancy, occurrenceDate)` and
`spanAvailable(slot, quantity, slots, occupancy, occurrenceDate)` both take an extra
**`occurrenceDate`**, and `getSlotOccupancy` now queries a **two-day span** keyed by
epoch instants — because a slot's instant is `occurrenceDate + start_time`, and for an
overnight window that lands on the following date. Porting the pre-refactor versions
would compile and be wrong only after midnight, which is the worst failure shape.

⚠️ **`getSlotOccupancy` must page (F16).** It selects booking rows for a date range; an
unbounded select silently truncates at 1000 and would under-count occupancy, offering
slots the trigger then refuses. Use `lib/pagedFetch.ts`, the same helper the
cross-app truncation plan standardised on.

**Reuse, do not re-derive:** `vendor/lib/scheduleWindow.ts` already provides
`crossesMidnight`, `formatWindow`, `formatWindowLength` and `formatScheduleWhen`, and
`lib/scheduleConflicts.ts` covers duplicate/overlap detection. Formatting a window
inline in the kiosk would be a sixth copy of logic that now has one home.

**`spanAvailable` must check every covered slot, not just the first.** The trigger
takes the worst-case slot (`20260803000005:126-151`); a UI checking only the start
offers spans the database refuses. This is called out because it is the tempting
wrong implementation and the booker's own comments flag it.

**Duplication, stated honestly.** This makes a **fifth** copy of the availability
rule (the file header in `vendor/lib/occurrence.ts` already counts four). AGENTS.md
forbids cross-app imports and the authority is plpgsql, so sharing is unavailable.
The mitigation is the existing one: mirror the booker's fixture dates in
`kiosk.service.test.ts` so divergence fails a test rather than surfacing as a kiosk
offering slots the DB rejects.

---

### I2 — Attachment management UI in the offering form  ✅ DONE (2026-08-29)
> `components/offerings/OfferingAttachmentsEditor/{.tsx, use*.ts, .module.css}` (the
> full render/hook/style trio), `services/offeringAttachments.service.ts`,
> `lib/types.ts` (`OfferingAttachment`, `AttachmentKind`, `AttachmentSummary`), and the
> D13 badges on `OfferingCard` fed by `getAttachmentSummaries` from `useOfferingsPage`.
> Photos capped at 3 with an "N of 3 used" counter; documents carry one switch,
> **Requires signature**; the cover photo is first by `sortOrder`, reordered with the
> arrows on each tile.
> **Constraint discovered while building — recorded because it shapes the UX:**
> attachments are rows FK'd to `offerings(id)`, not a JSONB column like `requirements`,
> so they cannot exist before the offering does. The editor therefore renders in **edit
> mode only**; add mode shows *"Save the offering first, then add photos and documents
> to it."* This matches how schedules already behave (`SchedulePromptModal`), and it
> avoids a second write path that can fail after the offering has been created.
> Verified: `tsc --noEmit` **exit 0**, `eslint` **0 violations on every new file**,
> `npm test` **325/325**. ⚠️ **No browser check** — not rendered, not clicked, no upload
> performed. Storage RLS on the two buckets is unexercised.
**Files (new):** `components/offerings/OfferingAttachmentsEditor/{OfferingAttachmentsEditor.tsx, useOfferingAttachmentsEditor.ts, OfferingAttachmentsEditor.module.css}`
**Modified:** `components/offerings/OfferingFormModal/{OfferingFormModal.tsx, useOfferingForm.ts}`

Vendors add, reorder, edit and deactivate attachments per offering and upload a file
or write inline text. Sits alongside the existing `requirements` editor in the same
modal — same surface, adjacent concept, no new page. **This is the offerings section of
the existing dashboard, not the kiosk**; the kiosk only ever reads what is set here.

**The shape, per D11:**
- **Photos** — capped at **3**, with an "N of 3 used" counter and the add tile
  disabling at the cap. Enforced in the hook and defended in the kiosk read
  (`slice(0, 3)` by `sort_order`), **not** in the database: the cap is a product call
  likely to move, and a count constraint needs a trigger whose failure mode here is
  purely cosmetic. Say so rather than letting a reader assume the DB guards it.
- **Cover photo** = first by `sort_order`, controlled by drag-to-reorder. No extra
  column; the vendor picks the cover by dragging it to the front.
- **Documents** — one switch each, **Requires signature**. There is no "must agree"
  switch: every document must be accepted (D11), stated once in the section copy
  rather than repeated as a control per row.
- **Attachments are optional** and the empty state must say so, not sit blank.

**Types are hand-written in this repo — no generation step will do it for you.**
AGENTS.md makes updating the relevant interface an invariant after any schema change,
and this plan added two tables and a column. Owed: `OfferingAttachment`
(`id`, `offeringId`, `kind: 'photo' | 'document'`, `title`, `storagePath`, `body`,
`version`, `requiresSignature`, `sortOrder`, `isActive`) in `vendor/lib/types.ts`,
`BookingAcknowledgement` alongside it, and `booked_via` on vendor's `Booking` (already
noted under B9). Only `vendor` needs them — booker, command and the mobile apps read
none of this yet.

**Also modified: `components/offerings/OfferingCard/OfferingCard.tsx`** (D13) — each
card shows its cover photo, document count and a signature flag, or *"None — customers
go straight to payment"*. It reads attachments the page already loads.

**Photos are a separate section of the same editor, not a row in the same list.**
Per D10 they upload to a **public** bucket, so the affordance that writes there must
be visually and structurally distinct — a "Photos" section with an image picker,
above or beside "Documents & agreements". A single combined list with a `kind`
dropdown is the tempting shape and the wrong one: it puts one wrong dropdown
selection between a vendor and publishing a signed waiver to a public URL.

**Component separation.** `.tsx` renders the list and fields and wires handlers the
hook returns; `useOfferingAttachmentsEditor.ts` owns the draft array, file selection,
upload, ordering and validation; `.module.css` holds the row and drag-affordance
styling. No `useState` and no static inline `style={{}}` in the `.tsx`.

**Deactivate, don't delete, when acknowledgements exist.** `attachment_id` is
`on delete set null`, so deleting an attachment silently blanks the link on historical
proof rows. The editor sets `is_active = false` instead once the attachment has ever
been acknowledged.

---

### I3 — Kiosk surface and its components  ✅ DONE (2026-08-29)
> `KioskShell` (4a) plus the flow in `components/kiosk/KioskBooking/`: one stateful
> orchestrator (`useKioskBooking`), a separate `useKioskCheckout` for the two writes,
> and seven pure step renderers sharing one `.module.css`. `KioskHome` is folded into
> the shell rather than made its own component — it is two buttons and no state.
> Step order is data-driven from `lib/kioskSteps.ts`; no component decides its own
> place in the flow.
**Files (new):** `vendor/app/kiosk/{layout.tsx, page.tsx}`, `components/kiosk/…`

Per D5 a sibling route with its own layout. Components, each with the render/hook/
style split unless marked pure display:

| Component | Hook owns | Notes |
|---|---|---|
| `KioskShell` | step state, selections, reset, idle timer (B6), payment-return params | the only stateful owner; steps receive props |
| `KioskOfferingGrid` | date selection, availability per offering for that date | date defaults to **today**; large offering tiles with an image slot already in the markup so I4's photos need no re-layout |
| `KioskSlotPicker` | slot list, occupancy, quantity, span validity | consumes I1 |
| `KioskCustomerForm` | field state + validation | name + email required (D1 needs email); phone optional, matching `profiles.phone`'s `NOT NULL DEFAULT ''` |
| `KioskAgreements` | per-attachment agreement state | shown only when the offering actually requires agreement — see B12 for the exact predicate |
| `KioskSignaturePad` | stroke capture, clear, PNG export | D6; canvas sizing is the one legitimately dynamic inline value |
| `KioskConfirmation` | — | **pure display**, `.tsx` only |
| `KioskExitDialog` | password re-auth | B5 |
| `KioskHome` | which mode the kiosk is in | the entry point: **"Book something"** vs **"Finish a booking"** (B11 — covers both a rental return and a session confirmation, so the wording must not say "return") |

**Step order is data-driven, not hardcoded** — the exact predicates are B12's, and
"only if attachments exist" is **not** one of them.

---

### I4 — Responsive, touch-first kiosk design  ✅ DONE (2026-08-29)
> All controls ≥44px, `clamp()` type so one build reads correctly on a 7" tablet and a
> desk monitor, theme tokens throughout (no fixed colours), `100dvh` so browser chrome
> cannot crop the action bar, a 640px breakpoint, and `maximumScale: 1` in the kiosk
> layout so a stray pinch cannot leave a shared tablet broken. Offering tiles reserve
> the photo box whether or not a photo exists, so a mixed grid does not reflow as
> images land. ⚠️ **Not visually reviewed** — no browser, no device.
**Files:** the `.module.css` files from I3

Apply `.claude/skills/ux-design/SKILL.md` before building. Non-negotiables for a
front-desk PWA: touch targets ≥44px; a layout that works from a 7" tablet in
portrait to a desk monitor in landscape; no hover-only affordances; visible focus;
loading / empty / error / populated states for the offering grid and slot picker
(an empty grid must say *why* — no offerings today vs none eligible per B3);
light **and** dark theming via the existing tokens, since `ThemeProvider` is
`defaultTheme="system"` and a front-desk tablet may sit in either.

Offering tiles carry a **real photo** as of D10 — `kind = 'photo'` attachments in
`sort_order`, first one wins — with the placeholder frame as the empty state for an
offering whose vendor has not uploaded one. The frame must reserve its space either
way, or a grid of mixed tiles reflows as images land.

---

### I5 — Signature capture  ✅ DONE (2026-08-29)
> `KioskSignaturePad` — canvas + Pointer Events, no dependency (D6). Handles device
> pixel ratio (a blurry signature reads as a broken app), `touch-action: none` so the
> first stroke draws instead of scrolling, and `setPointerCapture` so a finger leaving
> the canvas keeps drawing.
> **Two things the linter forced, both improvements:** the canvas is held in state via a
> callback ref rather than a `useRef`, and the "is a stroke in progress" flag is gone —
> `hasPointerCapture` already answers that, so the flag was a second copy of the same
> fact that could drift. See B24.
**Files (new):** `components/kiosk/KioskSignaturePad/*`

Per D6, `<canvas>` + Pointer Events (`pointerdown`/`move`/`up`, with
`setPointerCapture`) — one API for mouse, touch and stylus. Export via
`toBlob('image/png')`, posted to B1's route, which writes it to
`booking-signatures` (B8) and records the path on the acknowledgement row.

Must handle: device pixel ratio (a signature that renders blurry reads as broken),
`touch-action: none` on the canvas so the page does not scroll mid-stroke, a clear
button, and refusing to advance while the canvas is empty.

---

### ~~I6 — Vendor notified of their own kiosk booking~~  ✖ ABORTED (2026-08-29)
**Decided against making any change, and this reverses the recommendation this item
carried.** The item said to keep `payment_confirmed` and suppress the redundant
`booking_created`, on the grounds that the vendor "just watched the booking happen".

Assessed now that the flow exists: **that premise is wrong, and it is wrong precisely
because this is a kiosk.** A kiosk is the self-service case — a customer books
unattended while the vendor is elsewhere in the building. "A booking just happened" is
then not noise, it is the only thing telling them. Suppressing it would remove the
signal exactly where it is most useful.

Also weighed: suppression would need `create or replace function
public.notify_on_new_booking()` — a migration, and the schema locked when staging
received it (B17a). Paying a corrective migration to delete a useful notification is the
wrong trade twice over.

**Revisit if** a real vendor reports the bell filling up at high kiosk volume. The fix
then is a client-side filter or a per-type preference, not a trigger change.
**Files:** `vendor/app/api/kiosk/booking/route.ts`, webhook behaviour (read-only)

A kiosk booking fires the same notification path as a booker-originated one, so the
vendor is told about a booking they just watched happen, and the `payment_confirmed`
notification names the auto-created customer. Not wrong, but noisy at front-desk
volume.

**Fix approach.** Assess after the flow works end to end — the right answer depends
on whether the notification is genuinely redundant or is the vendor's only signal
that payment landed (it is the latter, since the customer pays on the tablet and the
vendor may not be watching). Recommend **keeping `payment_confirmed`** and suppressing
only the redundant `booking_created`. Deliberately not decided before B1 exists.

---

### I7 — Tests and visual baselines  ✅ DONE (2026-09-03)
> **Baselines generated and the suite is green — 2026-09-03.** The reviewer confirmed all
> three fixtures in both themes, which is what unblocked this: registering a mode and
> accepting its baseline are the same act, so approval had to come first.
>
> **Executed (first pass):** `kioskexit`, `kiosklauncher`, `kiosksignature` added to
> `visual-tests/pilot.spec.ts:9`'s `modes` array (with a note saying why they land after
> I10/I13/I14/I15 rather than before), then **6 baselines written** — 3 modes × 2 themes.
>
> ⚠️ **The update run was SCOPED, deliberately.** `npm run test:visual:update` is
> `playwright test --update-snapshots` with **no filter**, so running it as written would
> have regenerated all 82 existing baselines and silently accepted any drift in them.
> Used `--grep "kiosk" --update-snapshots` instead. Anyone adding baselines later should
> do the same.
>
> **Verified — machine:**
> - kiosk-only re-run **twice** with no `--update`: 6 passed both times. This settles the
>   original worry that `kiosklauncher` was too network-dependent to baseline — it is
>   stable, measured rather than assumed.
> - **Full suite: 167 passed, 0 failed, exit code 0** (161 + 6). Summary read from a
>   redirected log, never through `tail`, which hides both the count and the exit code.
>
> **✅ The step fixtures were then approved and added the same day (2026-09-03).**
> `kioskoffering`, `kioskslot` and `kioskcustomer` — **12 baselines in total**, 6 modes ×
> 2 themes.
>
> **This item's original objection is answered by construction, not waived.** It said a
> flow-state fixture would be "more fiction than fixture". `kioskState()` in
> `app/ui-gallery/page.tsx` returns a **complete, uncast `KioskBookingState`** — there is
> no `as unknown as` anywhere in it, so the file stops compiling the moment the interface
> gains a field. A fixture the compiler enforces is a contract.
>
> **What earned the exception:** I13 was a pure CSS defect with no unit test possible, and
> it shipped precisely because nothing rendered these two components in CI.
>
> **What the baselines actually pin** — chosen to cover what breaks, not just to exist:
> `kioskoffering` freezes the date chips reading **`Today` over `4 Sep` on two lines**,
> which is I13's exact reported bug (`TomorrowSep 3`). `kioskslot` freezes the same fix on
> slot labels (`09:00–10:00` over `6 left`) plus **B16's next-day marker** (`Sat, Sep 5`),
> a Full slot, a selected slot, and the quantity row.
>
> ⚠️ Two deliberate constraints, both to keep pixel-exact baselines honest:
> **dates are literals**, never `new Date()`, so they cannot drift when the suite's clock
> pin changes; and **`photosFor` returns `[]`**, because a real `storagePath` would send
> `photoUrl()` at Supabase Storage mid-screenshot — a network round trip inside a
> pixel-exact comparison.
>
> **`kioskcustomer` renders THREE states in one fixture, following the `staffstates`
> pattern** — an empty form alone would pin nothing about the two items it exists for.
> Both I14 (a refused character is reported, never silently swallowed) and I11 (letters
> flagged on the keystroke, anything else only once the field is left) live entirely in
> `phoneIssue`, so the fixture drives that field directly rather than pretending to type.
> Pinned: the `0917 123 4567` placeholder and the **"Optional."** hint that makes D20's
> PH-only rule safe; I14's `0917--4567` + *"Numbers only, please."*; and I11's `12345` +
> *"Enter a Philippine mobile number, like 0917 123 4567."*
>
> **Verified:** every new fixture re-run twice with no `--update` — 4 passed both times
> for the step pair, 2 passed both times for the customer states.
> **Full suite: 173 passed, 0 failed, exit 0.** `tsc` clean throughout.
> **Tests: done.** 13 new in `lib/kioskCloseOut.test.ts`, bringing the suite to **354**.
> The identifier matcher was **extracted from the close-out route into `lib/` to make it
> testable** — and the tests immediately earned it (see B25).
> Cumulative across the plan: `kioskSteps` 16, `kioskEligibility` 8, `slotAvailability`
> +17, `kioskCloseOut` 13.
>
> **UI-gallery fixtures: done, for what can honestly be fixtured.** Three added —
> `kioskexit`, `kiosklauncher`, `kiosksignature`.
> ⚠️ **They are renderable but NOT yet tested.** `visual-tests/pilot.spec.ts:9` builds
> its cases from a `modes` array, and the three new modes are deliberately absent from
> it — registering them is what creates the tests, and that is the same act as accepting
> their baselines. Both steps belong to whoever reviews them. `KioskShell` is deliberately absent:
> it gates on the kiosk flag and a live session, so it renders null in a gallery and
> would baseline an empty page. The step components take a whole flow-state object; a
> fixture big enough to render them would be more fiction than fixture.
>
> ⏸ **Visual baselines: deliberately NOT generated, and this is the substantive call.**
> A baseline freezes whatever renders as "expected". **No human has looked at the kiosk
> yet** — generating snapshots now would lock in unreviewed output and convert any
> layout mistake from a bug into a passing test. The gallery fixtures exist precisely so
> the surfaces *can* be reviewed first.
> **Unblocks when** someone has actually looked at `/ui-gallery?mode=kioskexit`,
> `kiosklauncher` and `kiosksignature` and is happy with them; then
> `npm run test:visual:update` for those three.
> ⚠️ When that run happens: **never pipe it through `tail`** — that hides both the
> failure count and the exit code. Read the summary from a redirected log.
>
> **⚠️ Two EXISTING baselines now fail, and they are B26 — a deliberate change, not a
> regression.** Confirmed run: **2 failed, 159 passed of 161**; both failures are the
> sidebar. They must be accepted before the suite is green again.
**Files:** `vendor/lib/*.test.ts`, `vendor/visual-tests/`, `vendor/app/ui-gallery/`

Per F12 the vendor suite is green (157/0), so new baselines land on a stable base.
Add: unit tests for I1's occupancy/span helpers mirroring the booker's fixtures;
ui-gallery fixtures for the kiosk steps; visual baselines for the offering grid,
slot picker, agreements and signature pad in both themes.

⚠️ Never pipe a Playwright run through `tail` — it hides both the failure count and
the exit code. Read the summary line from a redirected log.

---

### ~~I9 — What the kiosk shows when the vendor's session dies~~  ✖ PROMOTED
**Promoted to B15 (2026-08-26)** — the user made "the kiosk is always operated by a
signed-in vendor" an invariant, and an unenforced invariant is a blocker, not a
nicety. Kept here per the status model; the specification lives at B15.

---

### I8 — Kiosk offline behaviour  ✅ DONE (2026-08-29)
> `useKioskShell` gains an `offline` gate from `navigator.onLine` plus online/offline
> listeners, and the shell renders the neutral panel with connection-specific copy.
> **Chosen over branching `offline.html`**, as this item recommended: the service worker
> only helps on a *navigation*, so a connection lost mid-flow would leave the kiosk
> looking fine until a fetch failed silently.
> Two judgement calls worth recording: `online` is initialised **optimistically**,
> because `navigator.onLine` is false-negative-prone and a kiosk that refuses to start
> on a bad reading is worse than one that tries and fails; and the **Staff sign-in**
> button becomes **Staff exit** while offline, because authenticating needs the network
> that is missing — the button could only fail. Exit stays available either way, since
> staff must always be able to reclaim the tablet.
**Files:** `vendor/public/offline.html` (existing), `components/kiosk/KioskShell/`

`public/sw.js` is network-first for navigations and falls back to `offline.html`, so a
kiosk that loses connectivity shows the **generic vendor offline page** — wording aimed
at a vendor admin, on a screen facing a customer. Nothing breaks, but it reads as a
broken kiosk.

**Fix approach.** Small: either branch the offline page's copy on the `/kiosk` path, or
have `KioskShell` detect `navigator.onLine` and show a kiosk-appropriate "Temporarily
unavailable — please see the front desk" state before the request is even attempted.
Prefer the latter; it also covers a mid-flow drop, which the service worker does not.
⚠️ Payment cannot work offline regardless — this is about telling the customer that
clearly, not about queuing bookings.

---

### I10 — The two kiosk scrims ignore the app's established overlay treatment  ✅ DONE (2026-09-02)
> **Executed per D19(b) — split by audience, 2 files, CSS only.**
> - `KioskLauncherDialog.module.css:5` — `rgba(15,23,42,0.5)` → **`rgba(0,0,0,0.5)` +
>   `blur(6px)`**, i.e. the app's standard modal scrim. It is an ordinary admin modal
>   over the dashboard and was simply the odd one out; it now matches its eight peers.
> - `KioskExitDialog.module.css:6` — `rgba(15,23,42,0.55)` → **`rgba(4,6,14,0.94)`, no
>   blur.** The login page's own ink, so a reuse rather than a new colour. Blur omitted
>   deliberately: at 94% nothing shows through for it to act on, and `backdrop-filter`
>   is the expensive property to composite on the cheap Android tablets a kiosk runs on
>   — this is heavier *and* cheaper than the standard treatment.
> - `-webkit-backdrop-filter` written by hand on the launcher, as the item required
>   (hand-authored `.module.css`, no autoprefixing, iPad Safari is a target).
>
> **Verified — machine:** `tsc --noEmit` clean, `npm test` 360/360 (CSS-only, confirming
> nothing else moved).
> **Verified — visually, by actually looking.** Rendered `/ui-gallery?mode=kioskexit`
> (light + dark) and `?mode=kiosklauncher` against a dev server and inspected the images:
> the exit scrim now erases what is behind it, and the launcher shows the blurred-but-
> present dashboard exactly like the app's other modals. The reported complaint is gone.
>
> ⚠️ **One observation, not a defect, left for the reviewer's eye:** in **dark** theme the
> exit dialog's card (`--sp-card-bg`) sits close in value to the 94% scrim, so the card
> reads flatter than it does in light — it is separated by its border and shadow, and is
> legible, but it is the one place where the heavier scrim costs something. Raise it as a
> follow-up only if it bothers you on the actual tablet.
>
> **Baselines:** still not registered — `kioskexit` / `kiosklauncher` remain absent from
> `pilot.spec.ts:9`'s `modes` array. That is I7's act, and it correctly happens *after*
> this item rather than before, or it would have frozen the scrim this item replaced.
**Files:** `vendor/components/kiosk/KioskExitDialog/KioskExitDialog.module.css:6`
(`rgba(15, 23, 42, 0.55)`) and
`vendor/components/kiosk/KioskLauncherDialog/KioskLauncherDialog.module.css:5`
(`rgba(15, 23, 42, 0.5)`) — **neither has any blur.**

Reported against the exit dialog: too much of the surface behind stays legible. On a
customer-facing tablet that surface is a booking in progress, sometimes with a name and
phone number on it, sitting behind a translucent panel while a staff member types a
password over it.

> **This is a conformance bug, not a taste call.** Eight existing modals in this app all
> use one treatment — `fixed inset-0 z-50 bg-black/50 backdrop-blur-[6px]`
> (`DeletionRequestModal`, `AccountCompletionModal`, `ScheduleFormModal`,
> `StaffFormModal`, `GuideModal`, `OfferingPerformanceModal`, `OfferingFormModal`,
> `SchedulePromptModal`), and `AppShell.tsx:167` uses the same idea for the mobile
> sidebar scrim. **The two kiosk dialogs are the only modals that invented their own,
> and the thing they dropped is the blur** — which is what actually destroys legibility
> behind a scrim. Opacity alone does not; `0.55` over white is still readable text.

**The reporter's reference point:** "something like the modal for logging in". The login
surface (`LoginPage.module.css:8-28`) is an **opaque** dark gradient page
(`#04060e → #070b17 → #0d1b4b`) with `backdrop-filter: blur(24px)` on the card. It reads
as deep and closed because the ground is opaque, not because of the blur.

**Fix approach** — see D19 for the open half. Regardless of which option is chosen:
- `-webkit-backdrop-filter` must be written alongside `backdrop-filter` **if blur is
  used**: these are hand-authored `.module.css` files, so they get no autoprefixing, and
  iPad Safari is a first-class kiosk target.
- Style-only change in `.module.css`; the `.tsx` render layers are untouched, so
  `component-separation` is satisfied by construction.

**Verification:** machine — `npm run test:visual` for `kioskexit` / `kiosklauncher`
**only after I7 registers them** (they are still absent from `pilot.spec.ts:9`'s `modes`
array), so in practice this item's baselines and I7's are the same act. Live — needs a
human eye on `/ui-gallery?mode=kioskexit` in both themes; "is enough hidden" is not
machine-checkable.

---

### I11 — The kiosk mobile field accepts anything, including letters  ✅ DONE (2026-09-02)
> **⚠️ THIS ITEM'S OWN FIX APPROACH WAS WRONG, AND THE ERROR IS INSTRUCTIVE.**
> Step 1 as written said to extend `customerValid` with **`phoneIssue === null`**, and
> explicitly argued *against* `normalisePhMobile(...) !== null` on the grounds that it
> would make the field required. The concern was right; the remedy was not.
> `mobileFieldIssue` returns null for an invalid number **that has not been blurred yet**
> — that is its entire purpose. Gating on it would therefore have passed `12345`
> straight through to payment whenever the customer never left the field, which is the
> exact value this item exists to keep out of the database. Implemented as **two
> separate predicates** instead: a timing-free gate, and a timing-aware display rule.
> Optionality is preserved by the gate's `phone === "" ||` clause, not by borrowing the
> display rule's silence.
>
> **Executed — 5 files:**
> - `lib/kioskSteps.ts` — new `customerDetailsValid()`. Placed in `lib/` rather than the
>   hook (a change from step 1) precisely *because* of the mistake above: a rule that can
>   silently flip an optional field to required needs to be reachable by `node --test`.
> - `lib/kioskSteps.test.ts` — **6 new tests**, suite **354 → 360**.
> - `useKioskBooking.ts` — `phoneTouched` state; `customerValid` now delegates to the
>   lib gate; `phoneIssue` + `markPhoneTouched` added to `KioskBookingState`.
> - `StepCustomer.tsx` — `onBlur`, `aria-invalid`, error copy, placeholder `+63…` →
>   `0917 123 4567`.
> - `KioskBooking.module.css` — `.fieldInvalid` / `.fieldError`, declared after `.field`.
>
> **One addition beyond the written item, and why:** the field now carries an
> **"Optional."** hint. D20 flagged that the PH-only rule locks out a foreign visitor;
> without saying the field may be left blank, that customer meets an input that refuses
> them and no visible way past it. The hint is what makes the strict rule safe to ship.
>
> **Verified — machine:** `tsc --noEmit` clean; `npm test` **360/360**; `npx eslint` on
> all three source files → **completely clean, 0 errors 0 warnings**. The new tests
> assert the D20 consequence rather than assuming it: `+15551234567` (foreign) and
> `0281234567` (PH landline) are both rejected, `09171234567` in six spellings passes,
> and empty/whitespace still passes.
>
> ⚠️ **NOT verified — the two-tier display timing needs a browser.** That letters flag on
> the keystroke and "invalid" only after blur is proven for `mobileFieldIssue` itself
> (`phMobile.test.ts`) and in live use by the payout card, but **the wiring in
> `StepCustomer` has not been exercised in a browser** — reaching that step needs a
> signed-in vendor session and a chosen offering and slot, and there is no ui-gallery
> fixture for it (I7 argues against one). **Outstanding check:** on the customer step,
> type a letter → message appears immediately; type `12345` → no message until the field
> is left, and Next stays disabled; clear the field → Next enables.
**File:** `vendor/components/kiosk/KioskBooking/StepCustomer.tsx:22-31` (the input),
`vendor/components/kiosk/KioskBooking/useKioskBooking.ts:197-199` (the gate).

> **Field mapping — resolving the report's wording.** The request named "the form number
> field for the payment section". `StepPayment.tsx` has **no inputs at all** — it is a
> read-only review screen (service / when / duration / name / total / methods). The only
> phone input in the entire kiosk flow is the **Mobile number** field on `StepCustomer`,
> the form that immediately precedes payment. That is the field this item changes.

Today the field is completely unvalidated. `onChange` writes `e.target.value` straight
into state, and `customerValid` at `useKioskBooking.ts:197-199` checks **fullName and
email only** — phone is absent from the predicate. `app/api/kiosk/booking/route.ts:62`
trims it and `:115` passes it through; there is no server-side check either. `qwerty`
reaches the database.

**This is already solved elsewhere in this app — do not write a new regex.**
`lib/payout/phMobile.ts` exists, is unit-tested (`phMobile.test.ts`), and exports
exactly the two-tier behaviour requested:

```ts
mobileFieldIssue(raw, touched): "letters" | "invalid" | null
//  letters  → flagged IMMEDIATELY, however little is typed
//  invalid  → flagged only once the field has been LEFT (touched)
//  empty    → never an error; requiredness is the submit path's concern
```

`normalisePhMobile` accepts `09XXXXXXXXX`, `639XXXXXXXXX`, `+639XXXXXXXXX` with
`[\s()\-.]` separators, anchored and exact-length, and returns null otherwise.
The live-wiring pattern to copy is `usePayoutDetailsCard.ts:96-108` (compute the issue
during render from `raw` + `touched`; a `handleBlur` sets touched).

**Fix approach:**
1. `useKioskBooking.ts` — add `phoneTouched` state and a `setPhoneTouched` callback;
   derive `phoneIssue = mobileFieldIssue(customer.phone, phoneTouched)`; expose both on
   `KioskBookingState`. Extend `customerValid` with **`phoneIssue === null`** — *not*
   with `normalisePhMobile(...) !== null`, which would silently make the field
   **required** and block every customer who declines to give a number.
2. `StepCustomer.tsx` — `onBlur={k.setPhoneTouched}`, an error class on the input when
   `k.phoneIssue`, and a message beneath it. Kiosk copy, not the payout wording:
   `letters` → "Numbers only, please." · `invalid` → "Enter a Philippine mobile number,
   like 0917 123 4567."
3. Placeholder `"+63…"` → `"0917 123 4567"` — the local form is what a Filipino walk-in
   recognises, and `phMobile.ts:14-17` already argues this for display.

**Assumptions** (stated rather than asked — none would invalidate the work if wrong):
- **Stays optional.** The request was about *format*, not requiredness, and empty is
  explicitly not an error in `mobileFieldIssue`'s contract.
- **Not normalised on write.** The stored value keeps whatever valid spelling was typed;
  B25's identifier matcher already compares the last 10 significant digits, so
  canonicalising would buy nothing here and would change stored data shape.
- **Client-side only.** The route stays unchanged. This is a typo guard on a supervised
  walk-in surface, not a trust boundary — the number is not used for auth or payment
  routing.

**Component separation:** all state and the derived issue live in `useKioskBooking.ts`;
`StepCustomer.tsx` stays a pure render layer receiving `phoneIssue` and a blur handler,
with the error style in `KioskBooking.module.css`. No new `style={{}}`.

**Verification:** machine — unit tests for the extended `customerValid` (letters block,
valid PH forms pass, empty still passes); `tsc --noEmit`; `npm test`. Live — needs a
browser for the two-tier timing (letters flag on keystroke, invalid only after blur).

---

### I12 — Give the kiosk the login page's gradient ground  ✅ DONE (2026-09-02)
> **Executed per D21(a) — `KioskShell.module.css` only.** `.root` takes a light ramp
> (`#f8fafc → #eef2ff → #e0e7ff`) and `:global(.dark) .root` takes login's exact dark ramp
> (`#04060e → #070b17 → #0d1b4b`). `:global(.dark)` is the selector this codebase already
> uses (`KioskBooking.module.css:98`).
> **Verified — machine:** `tsc` clean, 365/365 (CSS-only; confirms nothing else moved).
> ✅ **Light theme verified live 2026-09-03** — `/kiosk` rendered in the real app (not the
> gallery, which does not apply `.root`) shows the light ramp behind the welcome screen,
> with both choice cards reading clearly against it. Light was the case D21(a) was chosen
> specifically to protect, so this is the half that mattered.
> ✅ **Dark theme verified live 2026-09-03**, closing this item completely. Driven with
> Playwright's `colorScheme: "dark"` rather than by forcing a stored value — `layout.tsx:78`
> is `defaultTheme="system" enableSystem`, so the OS preference is what actually drives a
> tablet, and that is the path worth testing. `document.documentElement.className` came
> back `dark`, and `.root`'s computed background was login's exact ramp:
> `linear-gradient(145deg, rgb(4,6,14) 0%, rgb(7,11,23) 55%, rgb(13,27,75) 100%)` with
> `color: rgb(241,245,249)`.
>
> Inspected the render: the gradient reads from near-black to the deep blue, "Welcome" and
> both choice cards are clearly legible, and the header and Staff exit remain readable.
> One note carried over from I10's dark observation — the secondary card sits close in
> value to the ground, separated by its border rather than by contrast. Legible, but it is
> the same trade the heavier dark scrim makes.
>
> **Neither theme is covered by a baseline, and cannot be:** `app/ui-gallery/page.tsx` does
> not wrap fixtures in `KioskShell`, so `.root` — where the gradient lives — never renders
> there. This item is verified by inspection, not by the visual suite.
**File:** `vendor/components/kiosk/KioskShell/KioskShell.module.css:18` — `background: var(--sp-page-bg)`.

Requested 2026-09-02: the kiosk carries far less furniture than the dashboard, so a flat
page colour leaves it looking unfinished. Reference is
`LoginPage.module.css:12` — `linear-gradient(145deg, #04060e 0%, #070b17 55%, #0d1b4b 100%)`.

> ⚠️ **This is not a copy-paste, and `ux-design` §6 is why.** That skill says *"use CSS
> variable tokens — never hardcode colours"* and *"does this work in light AND dark".*
> The login page is allowed to break that rule because it is a **deliberate branded
> exception** — its own header calls it a "full-screen hardcoded-dark branded surface"
> admitted under D-1's awkward-surface clause. The kiosk today is **theme-responsive**:
> `.root` reads `--sp-page-bg`, and every card inside reads `--sp-card-bg`. Dropping a
> hardcoded near-black gradient underneath them without further change would put **white
> cards on a near-black ground** for any tablet set to light. That is the trap in this
> item, and D21 is where it gets decided.

**Fix approach:** background only — no layout, no component changes. **D21 resolved (a)**
on 2026-09-02; the exact two-rule shape is recorded there. `:global(.dark)` is the
selector the file's neighbours already use (`KioskBooking.module.css:98`).
**Component separation:** one property in an existing `.module.css`; no `.tsx` touched.
**Verification:** needs-live — render `/kiosk` in **both** themes and look. Contrast of
body text on the new ground must still clear `ux-design` §5's 4.5:1.

---

### I13 — Chip and slot labels do not stack: `margin-top` on an inline `<span>`  ✅ DONE (2026-09-02)
> **Executed per D22 — one file, `KioskBooking.module.css`.** `display: block` added to
> `.dateLabel`, `.dateSub`, `.slotTime`, `.slotSub`; `.dateSub` margin 2px → 4px. Each
> pair carries a comment saying the `display` is load-bearing, because deleting it looks
> like a no-op and silently restores the bug.
> **Verified — machine:** `tsc` clean, `npm test` 365/365, `eslint` clean. None of that
> touches spacing; it confirms nothing else moved.
> ⚠️ **Needs a browser** — the actual result is unverified by me. Check the chips read
> `Tomorrow` / `Sep 3` on two lines, and slots read `09:00–10:00` / `1 left` on two.
**Files:** `KioskBooking.module.css:48-49` (`.dateLabel` / `.dateSub`) and `:87-88`
(`.slotTime` / `.slotSub`).

Reported as two separate problems — "the schedule's day has the date too close to it"
(`TomorrowSep 3`, `FriSep 4`) and "the slots that say '1 left' is too close to the time".
**They are one bug with one cause.**

All four elements are `<span>`s — `StepOffering.tsx:20-21` and `StepSlot.tsx:33-34` — and
a `<span>` is a **non-replaced inline box, on which `margin-top` has no effect at all**.
The CSS was written as though they were block-level:

```css
.dateSub  { font-size: 12px; margin-top: 2px; opacity: 0.75; }   /* inert */
.slotSub  { font-size: 12px; margin-top: 5px; opacity: 0.75; }   /* inert */
```

So both pairs render on one line, butted together with no separator. It is **not** a
failed render or a load-order problem, as the report wondered — it renders exactly as
specified, and the specification is wrong.

> **The tell that proves the diagnosis:** `.nextDay` in the *same* slot button spaces
> correctly, and it is the *only* one of the five that sets `display: inline-block`
> (`:92-96`). Same margin, same parent, different display type, different outcome.

**Fix approach — D22 resolved (2026-09-02):** make the four spans block-level and let the
existing margins take effect. `display: block` on each is the surgical change — `.slot`'s `text-align: center`
and `.dateChip`'s `text-align: left` both still apply to block children, and
`.nextDay`'s `inline-block` is left alone. Nudge `.dateSub`'s `margin-top` 2px → 4px:
once genuinely stacked, 2px between a 15px label and a 12px sub is still cramped.

> **Not chosen: converting `.dateChip` / `.slot` to `flex-direction: column` + `gap`.**
> Tidier in the abstract, but it restructures two components' layout to fix a spacing bug
> and would need `align-items` re-derived to preserve each one's existing text alignment.
> `ux-design` §3 and simplicity-first both point at the four-property fix.

**Hierarchy note (`ux-design` §2):** stacking also restores the intended reading order —
`Tomorrow` (15px/600) dominant, `Sep 3` (12px/0.75 opacity) subordinate. On one line they
compete, which is why it reads as "messy" rather than merely tight.

**Component separation:** CSS-only; no `.tsx` changes.
**Verification:** machine — none meaningful for spacing. Needs-live — render the offering
and slot steps and confirm both pairs stack. Candidate for a ui-gallery fixture under I7.

---

### I14 — The mobile field lets letters be typed at all  ✅ DONE (2026-09-02)
> **Executed per D23 — 4 files.** `lib/kioskSteps.ts` gains `stripPhoneInput` (allowed
> set `[\d+()\-. ]`, i.e. precisely what `normalisePhMobile` accepts);
> `useKioskBooking.ts` gains `phoneRejected` state and a `setPhone` that filters and
> records whether it dropped anything; `phoneIssue` prefers `"letters"` while a drop just
> happened; `StepCustomer.tsx` swaps `setCustomer({phone})` for `setPhone`.
> **5 new tests**, suite **360 → 365**. The tests guard the *inverse* failure — a filter
> keen enough to eat a character `normalisePhMobile` would have accepted — plus one
> asserting a filtered value still satisfies `customerDetailsValid`.
> **Verified — machine:** `tsc` clean, 365/365, `eslint` clean on all three source files.
> ⚠️ **Needs a browser:** type `abcde` (nothing appears, message shows), paste
> `0917-ABC-4567` (→ `0917--4567`, message shows), type `+63 (917) 123-4567` (survives
> whole), then one clean keystroke (message clears).
**Files:** `StepCustomer.tsx:26-27` (the `onChange`), `useKioskBooking.ts` (`setCustomer`).

> **⚠️ NOT redundant with I11, and the submitted screenshot is I11 *working*.** The red
> border and "Numbers only, please." visible in the report are exactly what I11 shipped.
> The two items solve different halves and both are wanted:
>
> | | I11 ✅ | I14 ⬜ |
> |---|---|---|
> | Question | is what was typed *acceptable* | may this character be typed *at all* |
> | Mechanism | validate + flag + block the step | filter on input |
> | Result | `abcde` is entered, then rejected | `abcde` never appears |
>
> I11 is still load-bearing after I14: filtering cannot catch a **well-formed-looking but
> invalid** number (`12345`, a landline, a foreign number), which is most of what
> `normalisePhMobile` rejects. Remove I11 and those walk straight through.

`onChange` currently writes `e.target.value` verbatim, so any character lands in state.

**Fix approach — D23 resolved (2026-09-02):** a dedicated `setPhone` on the hook that
strips anything outside the set
`normalisePhMobile` actually accepts — digits plus `+ ( ) - . space` (its `SEPARATORS` is
`[\s()\-.]`). Anything else never enters state.

⚠️ **Silent stripping is the wrong end state (`ux-design` §4).** A customer pasting
`0917-ABC-4567` would watch it become `0917--4567` with no explanation. So `setPhone`
also records *whether it dropped anything*, and that drives the existing `"letters"`
message — the character is refused **and** the reason is shown:

```ts
const cleaned = raw.replace(/[^\d+()\-. ]/g, "")
setPhoneRejected(cleaned !== raw)
```

with `phoneIssue = phoneRejected ? "letters" : mobileFieldIssue(cleaned, phoneTouched)`.

**Consequence to record:** `mobileFieldIssue`'s own `/[a-zA-Z]/` branch becomes
unreachable, since it can no longer receive a letter. It stays as a backstop rather than
being deleted — it is shared with the payout card, which does **not** filter its input.

**Component separation:** all logic in `useKioskBooking.ts`; `StepCustomer.tsx` swaps one
handler and stays a pure render layer.
**Verification:** machine — extend `lib/kioskSteps.test.ts` if the filter is extracted, or
test the pure `replace` rule directly. Needs-live — type `abcde` (nothing appears, message
shows), paste `0917-ABC-4567` (letters dropped, message shows), type `+63 (917) 123-4567`
(every character survives).

---

### I15 — The three fixture review fixes  ✅ DONE (a, b) / ✖ DECLINED (c) — 2026-09-02
Raised from reviewing the ui-gallery fixtures; approved 2026-09-02 as "a and b, accept c".

**(a) `KioskLauncherDialog` — the zero cases were arithmetic, not English.** ✅
`KioskLauncherDialog.tsx:40` read `{eligibleCount} of your {totalCount} offering…`, which
renders **"0 of your 0 offerings can be booked here."** for a vendor opening the dialog
before creating anything — i.e. the most likely first-ever view of this screen. Plurals
were handled; zero was not. Moved the sentence into `useKioskLauncherDialog.ts` as a
derived `summary` so the `.tsx` stays a pure render layer, with three arms:
`total === 0` → "You have no offerings yet — add one under Offerings to use Kiosk Mode."
(a pointer, per `ux-design` §4's empty-state rule); `eligible === 0` → "None of your N
offerings…"; otherwise the original.
**Verified:** rendered `/ui-gallery?mode=kiosklauncher` and read it — the zero case now
reads as a sentence.

**(b) `KioskSignaturePad` — the instruction moved onto the pad.** ✅
"Sign with your finger or a stylus" was a `<p>` *below* the pad; it is an instruction for
an empty pad, so it now sits centred **on** it, absolutely positioned with
`pointer-events: none` so it neither occupies layout nor swallows the first stroke.
"Tap Clear to sign again." stays below, where it correctly reads as a footnote.

> ⚠️ **A real hazard was found and designed around.** Emptying the hint's text would let
> `.hint` collapse, shrinking `.pad` the instant the first stroke lands. `fit()`
> (`useKioskSignaturePad.ts:64-65`) re-runs **only on a `window` resize** — there is no
> `ResizeObserver` — so the canvas backing store would keep its old dimensions while its
> CSS box shrank, and the signature would visibly stretch. The hint element is therefore
> always rendered and `.hint` carries `min-height: 18px`. Both the `.tsx` and the CSS
> carry a note, because the fix looks removable and is not.

**Verified:** rendered `/ui-gallery?mode=kiosksignature` in **both** themes — placeholder
centred and legible on the empty pad in each.

**(c) Disabled-button contrast** — ✖ **declined, deliberately.** `.btn:disabled { opacity:
0.5 }` puts white-on-blue near 2.4:1, under `ux-design` §5's 4.5:1 — but WCAG exempts
disabled controls, and this is a button nobody can press. Declined as theoretical.

---

### I18 — The kiosk checkout discards the server's reason for a payment failure  ✅ DONE (2026-09-04)
> **Executed — `useKioskCheckout.ts`.** A `console.error` records the HTTP status and
> `pay.error` before the friendly message is set. The customer-facing copy is byte-for-byte
> unchanged.
>
> **Finding that sharpens the item:** the **booking** branch above already surfaces
> `booking.error` straight to the screen, and correctly so — those strings are written for
> a customer ("That time has just been taken. Please pick another."). Only the **payment**
> branch discarded its cause, and its strings are the ones no walk-in should ever read.
> The split is now explicit in the file so nobody "fixes" it by surfacing both.
>
> **Verified — machine:** `tsc` clean, `eslint` clean, `npm test` 377/377.
> ⚠️ **Not exercised** — needs a real failure. The cheapest trigger is an offering priced
> **₱0**, which returns `Invalid booking amount`; that is also a live candidate for the
> staging failure being diagnosed.
**File:** `components/kiosk/KioskBooking/useKioskCheckout.ts:72-79`

```ts
const pay = await payRes.json().catch(() => ({}))
if (!payRes.ok || !pay.checkout_url) {
  setError("The booking was created but payment could not start. Please see staff.")
```

`pay.error` carries the precise cause and is **thrown away**. Reported 2026-09-04 from
staging: a real payment failed and the only information anywhere was that sentence, which
is deliberately vague because a walk-in customer must never be shown
`Payment not configured`. The customer-facing copy is right; the problem is that the
diagnosis exists and is discarded, so identifying it needed DevTools and a round trip.

`create-session` can fail six distinguishable ways — `Payment not configured` (500, logs
nothing), `Invalid booking amount` (400, logs nothing), `Booking not found` (404),
`Not a kiosk booking.` (403), the site-URL branch (500, logs), and
`Failed to create payment session` (502, logs). **Two of the likeliest log nothing at all
server-side**, so Vercel's function log is silent and the client is the only place the
answer ever exists.

**This is I17's client-side twin.** Same reasoning, same resolution: keep the friendly
message, record the real one.

**Fix approach:** `console.error` the status and `pay.error` before `setError`. The visible
copy does not change. Apply to the booking call in the same hook if it has the same shape.

**Component separation:** hook-only; no `.tsx` or style change.
**Verification:** machine — `tsc`, lint. Needs-live — force a failure (e.g. an offering
priced ₱0 → `Invalid booking amount`) and confirm the cause appears in the browser console
while the customer still sees the friendly text.

---

### I19 — The offering form's photo previews are too small to judge  ✅ DONE (2026-09-05)
> **Executed — `OfferingAttachmentsEditor.module.css`.** `.photo` and `.addTile` both
> `92 × 68` → **`120 × 90`**, approved at that size. Both, because they share a flex row and
> a mismatch makes it ragged — the file now says so beside `.addTile`.
> **Verified — machine:** `tsc` clean, `eslint` clean, `npm test` 377/377. Wrapping was
> checked before the change rather than after: `MAX_PHOTOS = 3`, so 4 tiles × 120 + 3 × 8px
> gaps = **504px**, still one line in the modal.
> **No baseline covers this** — confirmed nothing in `app/ui-gallery/page.tsx` renders
> `OfferingAttachmentsEditor`, so there was nothing to re-record.
> ⚠️ Needs a browser to confirm the row reads better; the size is arithmetic, the judgement
> is not.
**File:** `components/offerings/OfferingAttachmentsEditor/OfferingAttachmentsEditor.module.css:45-52`
(`.photo`) and `:98-101` (`.addTile`)

Both are `92 × 68`. A vendor choosing which photo the kiosk shows as the offering's cover
is deciding from a thumbnail smaller than a postage stamp — and per `useOfferingsPage`,
the first by `sortOrder` **is** the cover, so this is a decision, not decoration.

**Fix approach:** `92 × 68` → **`120 × 90`**. A ~30% bump, and it lands on a clean 4:3 —
the current 92:68 is 1.353, an approximation of 4:3 that nothing depends on. **`.addTile`
must change with it** or the row goes ragged; it is the same size today by design.

⚠️ **Wrapping checked, not assumed:** `MAX_PHOTOS = 3`, so the row holds at most 3 photos
plus the add tile — 4 × 120 + 3 × 8px gap = **504px**, which still fits the offering modal
without wrapping. `object-fit: cover` on `.photoImg` means the aspect change crops rather
than distorts.

**Component separation:** CSS-only.
**Verification:** needs-live — open the offering form with photos attached and confirm the
row still fits on one line at the modal's width.

---

### I20 — Kiosk step content is left-aligned on a wide screen  ✅ DONE (2026-09-05)
> **Executed per D27(a) — `KioskBooking.module.css`.** `margin-inline: auto` added to
> `.fields`, `.docs` and `.summary`, matching `.done`'s existing `margin: 0 auto`. No new
> width and no new breakpoint: the `max-width`s were already there and already right.
> **Verified — machine:** the `kioskcustomer` baseline **failed first** (2 failed), which is
> what proves the rule took effect, then regenerated; full suite green afterwards —
> 161 snapshot tests with **zero** failures plus **15/15** on the responsive sweep.
> Inspected the regenerated baseline: the form now carries equal margins instead of hugging
> the left edge.
> **Scope check that shaped the fix:** only `kioskcustomer` renders `.fields`;
> `kioskoffering` and `kioskslot` use `.dates`/`.grid`/`.slots` and were confirmed
> unaffected before the change, so exactly one baseline needed re-recording.
**File:** `components/kiosk/KioskBooking/KioskBooking.module.css` — `.fields:128`,
`.docs:150`, `.summary:177`

Reported 2026-09-04: "Your details" looks right on mobile but stranded on a desktop
browser.

> ⚠️ **The cause is NOT a missing max-width, which is what the report implies.** `.fields`
> already sets `max-width: 720px`. The content is constrained; it is simply **pinned to the
> left** because nothing centres it. On a 2560px kiosk display that leaves the form hugging
> one edge with two thirds of the screen empty.

**And it is not only that step.** Three containers are constrained-but-left; a fourth is
already centred:

| Step | Container | Today |
|---|---|---|
| Your details | `.fields` `max-width: 720px` | left |
| Before you book | `.docs` `max-width: 860px` | left |
| Review and pay | `.summary` `max-width: 620px` | left |
| Confirmation | `.done` `max-width: 620px` | **`margin: 0 auto`** |

So the flow already jumps to centre at the last step. Fixing only "Your details" would add
a second jump rather than remove one. See **D27**.

**Fix approach:** `margin-inline: auto`, matching `.done`'s existing `margin: 0 auto`. No
new width, no new breakpoint — the constraint is already there and correct.

**Component separation:** CSS-only.
**Verification:** needs-live — walk the flow at a desktop width and confirm the content
block stays centred from step to step, with no sideways jump.

---

### I21 — Visual baselines encode `.env.local` values, so a config change fails 15 tests  ✅ RESOLVED (2026-09-05) via D28(b)
> **Resolved by restoring the values** — `.env.local` is back to `NEXT_PUBLIC_APP_NAME="Ezzy
> Vendor"` / `NEXT_PUBLIC_APP_DOMAIN="vendor.ezzy.ph"`. **All 16 login tests pass.**
>
> ⚠️ **The underlying fragility is NOT fixed, deliberately** — D28(b) restores this
> instance, it does not prevent the next one. The baselines still encode two env values, so
> the same 15 failures return for anyone whose `.env.local` differs, presenting as "your
> change broke login". D28(c) — pinning both values in `playwright.config.ts`'s `webServer`
> beside the existing `PW_TEST=1`, the way `pilot.spec.ts` already pins a fixed instant — is
> the durable answer and remains available. Recorded so the recurrence is recognised in
> seconds rather than re-diagnosed.
**Files:** `components/auth/LoginPage/LoginPage.tsx:90,141,173`, `lib/constants.ts:42-43`,
and the 15 `login*` baselines.

**Found 2026-09-04**, and the discovery route is the point: I19/I20 were CSS-only kiosk and
offerings changes, yet the full suite came back **15 failed / 158 passed** — every failure a
`login*` mode, none of them touched by the diff.

**Cause — environment, not code.** `vendor/.env.local` now holds
`NEXT_PUBLIC_APP_NAME="STAGING Ezzy Vendor"` and
`NEXT_PUBLIC_APP_DOMAIN="staging-vendor.ezzy.ph"` (changed while configuring the Vercel
staging deploy). `LoginPage` renders both — `Sell on {APP_NAME}` and `{APP_DOMAIN}` — so
every login baseline, recorded against the earlier values, now mismatches. The failures are
**text, not layout**: 3026 pixels, ratio 0.01, and the diff image shows the two strings
superimposed in exactly those three positions.

⚠️ **The real finding is that the suite is not environment-independent.** Any developer
whose `.env.local` differs gets 15 red tests that have nothing to do with their change —
and the failure presents as "your CSS broke login", which is the most expensive kind of
wrong signal. `lib/constants.ts` falls back to `"Josh demo app"` / `"ang.demo.app.ni.josh"`
when unset, so an unset environment produces a *third* distinct rendering.

**This did not affect the kiosk baselines**, checked: none of the six kiosk fixtures renders
`APP_NAME` or `APP_DOMAIN` — `kiosklauncher` takes its vendor name from a literal prop.

**Fix approach — see D28.** The immediate unblock is a choice between restoring the values
and re-recording the baselines; the durable fix is pinning these two values for the visual
run the way `pilot.spec.ts` already pins the clock for date-rendering screens.

**Verification:** machine — the full suite returns to 0 failures, and stays there after a
deliberate `.env.local` edit if the durable fix is taken.

---

### I22 — The kiosk exit dialog needs the blur, not a heavier scrim  ✅ DONE (2026-09-05)
> **Executed — `KioskExitDialog.module.css`.** `rgba(4,6,14,0.94)` with no blur →
> `rgba(0,0,0,0.5)` + `backdrop-filter: blur(6px)` + the `-webkit-` prefix. Identical to the
> app's eight Radix dialogs, which is the look the reporter pointed at. The comment block
> now records that D19(b) was reversed and **tells the next reader not to "restore" the
> opaque version.**
>
> **Verified — machine:** `tsc` clean. `kioskexit-light` failed against its old baseline and
> was re-recorded; re-run twice, stable. Inspected the new baseline: standard scrim, card
> reads cleanly.
>
> ⚠️ **`kioskexit-dark` did not change at all, and that is a finding about the FIXTURE, not
> the fix.** The gallery renders this dialog over an essentially empty page, so there is
> nothing behind it to blur — a blur of a flat colour is that flat colour, and against a
> near-black ground the two scrims round to the same pixels. **So this baseline cannot
> prove the fix**; it only proves nothing else broke. The actual defect — legible text
> behind the dialog — needs the real kiosk with the welcome screen behind it.
> Worth remembering before trusting a green `kioskexit` run to mean the scrim is right.
>
> ✅ **Confirmed on STAGING 2026-09-05** by the reporter, on the real kiosk with the welcome
> screen behind the dialog — the case the gallery fixture cannot reproduce. This is the
> verification that actually closes the item.
**File:** `components/kiosk/KioskExitDialog/KioskExitDialog.module.css:18-27`

> ## ⚠️ THIS REVERSES D19(b), AND THE REASONING THERE WAS MINE AND WRONG
>
> D19(b) gave this dialog `rgba(4, 6, 14, 0.94)` and **deliberately no blur**, arguing "at
> 94% there is nothing left showing through for a blur to act on". Confirmed 2026-09-05
> against a real screenshot: **that is false.** "Welcome", "What would you like to do?" and
> both choice cards are still plainly legible behind it.
>
> **Opacity and blur are not interchangeable, and I treated them as if they were.** A 94%
> wash *reduces contrast* — white text survives at 6% as a faint but readable ghost, which
> is exactly what a dark kiosk surface makes visible. A 6px blur *destroys letterforms*,
> and does so regardless of opacity.
>
> **It also means the blur serves D19's own stated concern better than the scrim did.** The
> point was that a customer's booking — name, mobile — sits behind this dialog while staff
> type a password over it. Ghosting at 6% leaves that readable; a blur does not. The
> heavier scrim was worse at the job it was chosen for.

**Fix approach:** the app's standard modal treatment, the same one the reporter pointed at
on the offering form — `rgba(0, 0, 0, 0.5)` plus `backdrop-filter: blur(6px)`, with the
`-webkit-` prefix written by hand (a hand-authored `.module.css` gets no autoprefixing, and
iPad Safari is a first-class kiosk target). This is what D19 option **(a)** proposed and
I argued against.

**Not in scope:** porting this dialog to Radix. The launcher was ported under D24(a)
because it lost a stacking contest; nothing stacks over the exit dialog — the kiosk route
mounts no other dialog — so there is no defect to fix, only consistency, and that is not
worth a rewrite here.

**Component separation:** CSS-only.
**Verification:** needs-live — open the exit dialog over the kiosk welcome screen and
confirm the text behind is a smear rather than a readable ghost. The `kioskexit` baseline
**will move** and must be re-recorded.

---

## DEFERRED / COSMETIC

- **Hydration mismatch on `/ui-gallery`, in `StatCard`** (observed 2026-09-05, **not
  caused by this plan's work**). The dev server logs `Hydration failed because the server
  rendered text didn't match the client`, rooted at `<UiGalleryPage>` and pointing at
  `StatCard.tsx:72` — the `{sub}` line, beside a `delta.pct` computation.
  **Pre-existing:** present in every visual-suite log back to 2026-09-03 (19 occurrences in
  the oldest), before I18–I21. **Intermittent** — one later run reproduced it zero times.
  **Harmless to the suite:** 173/173 pass regardless; React discards and re-renders the
  subtree.
  **Likely cause, unverified:** `pilot.spec.ts` pins a fixed instant in the *browser*, but
  the dev server rendering SSR uses the real system clock — so date-derived text differs
  across the boundary. That would make it an artefact of clock-pinning a fixture page
  rather than an app defect. ⚠️ **Worth confirming before dismissing**, because `StatCard`
  is also used by the real dashboard: if its `sub` is time-derived there too, the live
  dashboard has the same mismatch without a gallery to blame.
- **⚠️ ~~Local seed data cannot reach the kiosk any more~~ — RESOLVED 2026-09-03** by the
  user adding payout details to Citywide through Settings → Payout Details. Kept because
  the next person to reset the local database will hit it again, and it is not obvious.
  (Original note follows.) Consequence of D25a —
  `vendor_payout_methods` has **no active row for any of the three seeded vendors**, so
  every seeded account is "incomplete" and the launcher now correctly refuses to open for
  all of them. It is also why the local end-to-end pass kept hitting B28: every account
  available to it was incomplete.
  **Unblocks by** adding payout details to one vendor — through Settings → Payout Details,
  which is the real flow and exercises the completion path at the same time, or by seeding
  an active `vendor_payout_methods` row. **Not done here: it is a change to the user's dev
  data, and they were mid-test.**
- **Disabled-button contrast in the kiosk dialogs** (I15c) — `opacity: 0.5` reads near
  2.4:1. Accepted 2026-09-02: WCAG exempts disabled controls, and the affected button
  cannot be pressed. Revisit only if a disabled control ever needs to be *read*.
- **Date-granular offerings at the kiosk** (D7) — excluded because the booker's own
  date-granular arm is a documented dead end (`architecture/booking-flow.md`).
  **Unblocks when** the booker's Step 3 render arm and `canNext` are fixed, tracked
  under "Carried forward" in `.plans/2026-08-03-offering-duration-and-booking-units.md`.
- **Kiosk customers cannot raise a dispute *until they claim their account*** (D2/B10)
  — narrower than first written, because B2 now provisions a real booker account
  (portal + role + active). A customer who does "forgot password" becomes a full booker
  and can dispute, acknowledge and see their history like anyone else. An **unclaimed**
  account still cannot, since `disputed` needs `v_booker`. Acceptable: the customer is
  standing at the vendor's counter, which is a faster channel than a dispute queue.
  **Unblocks further when** a receipt link makes claiming the account one tap — option B
  from the D2 discussion.
- ~~**A custody booking whose customer never comes back is still stranded**~~ —
  **corrected 2026-08-26, this was wrong as first written.** It said the booking
  strands and implied Command would be needed. It does not. Under B10 the **vendor
  holds the key**: they can confirm the return themselves (the database cannot
  distinguish who tapped — D2's stated trade), and B11's lookup works without the
  customer present because the vendor already holds their phone number on the booking.
  The accurate residual is narrower and lives in assumption 6: a kiosk booking is only
  stuck if **the vendor chooses not to act**. You cannot have both "the vendor can
  always close it" and "the vendor can never close it unilaterally" — B10 buys the
  first and gives up the second, deliberately.
- **Expiry of unpaid `pending` kiosk bookings** (B6.3) — accepted for now because it
  is pre-existing booker behaviour, and the vendor can reject a stale pending booking
  today. **Unblocks when** it is worth a scheduled job; note it would affect
  booker-originated bookings too, making it a cross-app change.
- **Signature retention / erasure** (B8) — no sweep exists for a customer's
  signature. Acceptable at v1 volume; revisit alongside any customer-facing data
  request path.
- **Booker-side attachment agreement step** — the schema and RLS in B7 already
  permit it (`active users read active offering attachments`), but no booker UI is
  built here. Out of scope: booker is not modified by this plan.
- ~~**Offering photos**~~ — **pulled INTO scope 2026-08-26 (D10)**, and the earlier
  note here was wrong on the mechanism: it assumed photos needed an `offerings` image
  column. They do not — `offering_attachments` already had `storage_path`, `kind` and
  `sort_order`, so the whole feature was a widened CHECK plus one bucket.
- ~~**Photos on the vendor's own OfferingCard**~~ — **pulled into scope 2026-08-26
  (D13)**, now part of I2. The card also carries the document count and signature flag.
- ✖ **ABORTED — informational (non-acceptance) documents** (2026-08-26). D11 dropped
  `requires_agreement`, so every document forces an acceptance tick. Confirmed with the
  user: documents are **only waivers and rules**, and no read-only leaflet case exists.
  Not deferred — decided against. Re-adding it would be a migration.
- **Image processing** — no resizing, cropping or thumbnail generation. A vendor
  uploading a 4 MB photo ships 4 MB to every kiosk load. Acceptable at one image per
  offering behind the 5 MB cap; **unblocks when** it is worth a transform step.

---

## Execution order

Ordered by dependency and risk, not by numbering. **Cadence is one stage at a time**
per `.claude/skills/developerboss/SKILL.md` unless you say otherwise.

**Stage 0 — schema.**  ✅ **COMPLETE ON LOCAL (2026-08-29).** B7, B8, B9, B10 are
written, re-cut at `20260829000001-4` (D16), and **applied to the local database**:
`schema_migrations` carries all four, both tables and `bookings.booked_via` exist, three
buckets exist, and D17's revoke held through a real apply. Verified by 15 assertions
across two transaction runs — constraints, defaults, the pin trigger, the widened consent
CHECK, the transition function's two kiosk clauses, grants, and the revoke tested by
acting *as* `service_role`.
`vendor/lib/legal.ts`'s `source` union gained `"kiosk_booking"` (F9's coupling) and
type-checks clean.
⚠️ **Hosted environments have none of this** — that is Stage 7 (B17), deliberately last.
⚠️ **The files remain editable until Stage 7 runs.** If a later stage exposes a schema
flaw, fix the migration and `npx supabase db reset` rather than stacking a corrective
one — but see B17 for why `migration up` will silently no-op on an edited file.

**Stage 1 — occupancy and span.**  ✅ **COMPLETE (2026-08-29).**
Delivered: `lib/slotAvailability.ts` (B19 fix + `slotInstant`, `slotDate`, `SlotBooking`,
`spanAvailable`), `lib/slotAvailability.test.ts` (+17 tests), `services/kiosk.service.ts`
(paged two-day fetch). Machine-verified: `npm test` **317/317**, `npx tsc --noEmit`
**exit 0**, `npx eslint` **clean on all three files** (the repo's 35 pre-existing lint
problems are in other files and were not touched). The B19 fix was additionally proven
by reverting it and confirming the new tests fail 3/27.
⚠️ Nothing here is wired to a UI or a route — that is by design, and it means none of it
has run against a browser or a live query yet. The `getSlotBookings` query shape is
**unverified at runtime**; its first real exercise is Stage 2.

<details><summary>Original scope statement (superseded)</summary>

**Stage 1 — safe now, independent of everything above.**
I1 (occupancy/span port + its tests). Touches no schema, ships behind no UI, and is
the substrate B3 and I3 both consume. This is the whole safe prefix — the rest
depends on Stage 0.

</details>

**Stage 2 — server routes.**  ✅ **COMPLETE (2026-08-29).**
Delivered: `lib/kioskAuth.ts` (the single caller guard), `lib/kioskCustomer.ts` (B2),
`lib/kioskEligibility.ts` + tests (B3's rule, 8 tests), `services/kiosk.service.ts`
gained `getKioskOfferings` (B3), `app/api/kiosk/booking/route.ts` (B1),
`app/api/kiosk/payment/create-session/route.ts` (B4).
Machine-verified: `npm test` **325/325**, `tsc --noEmit` **exit 0**, `eslint` **exit 0**
on all new files. **Live-verified** against a dev server + local Supabase: B1
unauthenticated → **401**, no vendor → **403**, malformed body → **400**; B4
unauthenticated → **401** (after B20), missing id → **400**.
⚠️ **The happy path has NOT been run** — no booking has been created through this route,
because that needs a signed-in vendor-admin session and a kiosk UI to drive it. Stage 4
is its first real exercise. B4's PayMongo call is unreachable until `PAYMONGO_SECRET_KEY`
exists in this app (Stage 3b/7).

<details><summary>Original scope statement (superseded)</summary>

**Stage 2 — server routes.** B1 → B2 → B4, in that order (B2 is called by B1; B4
needs a booking to exist to be testable). B3's service lands with B1.

</details>

**Stage 3 — vendor-side attachment management.**  ✅ **COMPLETE (2026-08-29).**
I2 delivered — see the item for what shipped and the create-mode constraint found while
building it. Machine-verified: `tsc` exit 0, `eslint` 0 violations on all new files,
325/325 tests. ⚠️ **Entirely unexercised in a browser**: no photo uploaded, no document
created, no storage policy hit. That is Stage 3b/4's job and is the main reason the
staging push comes next.

<details><summary>Original scope statement (superseded)</summary>

**Stage 3 — vendor-side attachment management.** I2. **Moved ahead of the kiosk UI
2026-08-26, on review.** It was Stage 5 on the grounds of being independent, which is
true of the *code* and false of the *testing*: with no editor, the only way to put a
waiver or a photo on an offering is hand-written SQL, so Stage 4's conditional steps
and photo tiles would have nothing real to render. Building the producer before the
consumer costs nothing and removes a fixture-by-SQL step from every screen after it.

</details>

**Stage 3b — push the schema to STAGING (B17a).**  ✅ **COMPLETE (2026-08-29)** —
pushed and verified `local == remote` for all four; grants re-check passed. Environment
audit raised B22 and B23.
<details><summary>What the stage was</summary>
 `db push --linked`, then the two
checks that are actually runnable now: the grant re-check (F18's divergence) and D10's
bucket visibility. ⚠️ **Corrected 2026-08-29:** B4's PayMongo row and the other
app-level rows are **not** runnable here — no `/kiosk` route exists yet and the PayMongo
env vars are unset. They run in a second staging pass after Stage 4.
⚠️ The migrations lock here: from this point a schema change costs a corrective
migration, not an edit.
</details>

**Stage 4 — kiosk UI.**  ✅ **COMPLETE (2026-08-29)** — split into 4a and 4b, both done. The stage
as scoped was roughly four times any previous one, so it was split at the seam between
the safety envelope and the booking flow.
**4a ✅ done:** the kiosk exists, is reachable, contained, persistent and guarded —
B12, B5, B6(1,2), B13, B14, B15, plus the route, shell and home screen.
**4b ✅ done (2026-08-29):** the flow — offering grid, slot picker with B16's overnight
labelling and day markers, customer form, agreements, signature (I5), payment,
confirmation, and I4 polish across them. B6(3) is satisfied by creating the booking at
the last possible moment, in `useKioskCheckout`; B6(4) remains documented-only, because
no web page can reclaim a browser that has navigated to PayMongo.
Machine-verified: `npm test` **341/341**, `tsc --noEmit` **exit 0**, and whole-app
`eslint` **35 problems — identical to the pre-existing baseline**, so four stages added
zero net lint debt. Live: `/`, `/kiosk` and `/kiosk?payment=success` all **HTTP 200**
with **zero compile failures**.
⚠️ **Nothing has been driven by a human.** No booking has been made, no signature drawn,
no payment started, no photo rendered from the public bucket.

<details><summary>Original scope statement</summary>

**Stage 4 — kiosk UI.** I3 + I4 together (layout and styling are one pass), then I5.
**B16 lands with the slot picker** — overnight rendering and the start-date label are
part of building it, not a pass afterwards.
**B12 lands with I3** — it is the step machine the shell owns, and its truth table is
the first test to write, before any step component exists. B5 and B6 land here too,
with the shell that owns them, as do **B14** (the mode flag and the `/` redirect) and
**B15** (the signed-in-vendor invariant and its recovery path) — both are shell states,
not polish. **B13 closes the stage** — the launcher is what makes
everything before it reachable, and its dialog needs B3's exclusion count and B5's
warning copy to already exist.
B5 and B6 land with the shell that owns them.

**Stage 5 — close-out.**  ✅ **COMPLETE (2026-08-29)** — B11 delivered; see the item for
the two recorded deviations and what remains unverified.

<details><summary>Original scope statement</summary>

**Stage 5 — close-out.** B11 (both patterns), once Stage 4's kiosk shell exists to host it and
Stage 0's B9/B10 are applied. Verifiable end to end only when both are true: the
transition raises until the migrations land.

</details>

**Stage 6 — sweep.**  ✅ **COMPLETE (2026-08-29)**, with two items honestly short of
done: **I7 is 🔄** (tests and gallery fixtures delivered; visual baselines deliberately
not generated — see the item) and **I6 is ✖ ABORTED** after assessment reversed its own
recommendation. **B25** and **B26** were found during the sweep.
Docs updated: `architecture/schema.md` (four migration rows, `bookings.booked_via`, and
full sections for both new tables including why a grant alone did not make
`booking_acknowledgements` append-only), `architecture/booking-flow.md` (kiosk as a
second booking origin, the close-out path, overnight `booked_date`), and
`architecture/portals.md` (the kiosk surface, why it is a route rather than a page, mode
persistence, and the device-lockdown requirement).

<details><summary>Original scope statement</summary>

**Stage 6 — sweep.** I6, I7, I8, and the doc updates: `architecture/portals.md` (the
kiosk surface + B5's device-lockdown requirement), `architecture/schema.md` (both new
tables **and `bookings.booked_via`**, including that its pin trigger makes it
insert-only, and D17's revoke — a reader who sees the grant line alone would conclude
the wrong thing), `architecture/booking-flow.md` (kiosk as a second origin for bookings, and the
kiosk close-out path — its fulfilment section currently states the vendor cannot make
either the `in_progress → returned` or the `fulfilled → completed` move, which B10
makes conditionally untrue for `booked_via = 'kiosk'` rows).

</details>

**Stage 6b — field-report fixes (B27, I10).**  ✅ **COMPLETE (2026-09-02).** Both
found by using the kiosk. **App-layer only: no schema, no migration, no effect on Stage
7's sequence.** B27 first and independently — it is a correctness fix with a
machine-checkable result and no open decision. I10 is **blocked on D19** and, for its
baselines, folds into I7: registering `kioskexit` / `kiosklauncher` in
`pilot.spec.ts:9` and accepting their snapshots is one act, and doing it *before* I10
lands would freeze the scrim this item exists to change. **I11** (kiosk mobile-number validation, added 2026-09-02) is independent of both and
carries no open decision — D20 records the rule.
**Order: ~~B27~~ ✅ → ~~I11~~ ✅ → ~~I10~~ ✅ (all 2026-09-02) → I7's kiosk baselines (remaining).**

**Stage 6c — second field report (I13, I14, I12).**  ✅ **CODE COMPLETE 2026-09-02**, all
three machine-verified and all three awaiting one browser pass. Added 2026-09-02, from
a second hands-on pass. All three are vendor-app-only; no schema, no effect on Stage 7.
**I13 first** — it is a one-cause CSS defect with no decision attached and it changes what
the other two are reviewed against. **I14 next** — self-contained, and it completes the
phone field rather than replacing I11. **I12 last** — D21 answered (a) on 2026-09-02, so it is
unblocked and is now a two-rule CSS change.
⚠️ **I7's baselines move behind all three** — same reasoning as I10: snapshotting the
kiosk now would freeze the very layout these items change.

**Stage 7 — production schema (B17b).**  ✅ **COMPLETE (2026-09-03).** `db push` to
production, re-check the grants, **then** the app builds — in that order, not the same
sitting. Deliberately unsurprising: every live-environment row was already run on staging
at Stage 3b. **No app build reading the new tables may reach production until this
completes.**
⚠️ **"Deliberately last" no longer applies** — that was written when this was the final
stage. The app builds were split out and reordered on 2026-09-04; see Stage 8.
⚠️ **The production grants re-check is still outstanding** — the schema went up, the
measurement did not.

**Stage 9 — preview-deployment findings (B31, B32, I17).**  ✅ **COMPLETE (2026-09-04)** — all
three executed and verified; only I17's log line is unexercised. Added 2026-09-04,
from the first Vercel preview deploy and a real kiosk booking attempt. All three are
vendor-app-only: no schema, no migration, no effect on Stage 8's deploy order. No open
decisions — each has one obvious fix.
**Order: B31 → I17 → B32.** B31 first because it makes an offering unbookable; **I17
immediately after, because it is why B31 took a reproduction to identify** and the next
failure in this route deserves to be legible. B32 last — it is a one-line CSP change but
it is cosmetic-severity for booking, and it wants the smoke test extended with it.
⚠️ **B32 must land before the staging deploy is judged**, or photos will look broken there
and be misread as an environment problem rather than the policy it is.

**Stage 8 — deploy order, REVISED 2026-09-04 at the user's request.** Production *schema*
is already live (B17b, 2026-09-03); what remains is the **app build**, and it moves to
**last** because `ezzy-vendor-mobile` currently points only at staging, so staging must
carry the vendor app before mobile can be worked on at all.

**Revised order:** commit → **deploy vendor to STAGING** (+ set B23's staging
`NEXT_PUBLIC_APP_URL`) → verify B1/B2/B4/R1 live, which have never run outside local →
mobile work against staging → **deploy vendor to PRODUCTION last** (+ set B23's production
value, `https://vendor.ezzy.ph`).

**This is safe, and it was checked rather than assumed.** Two of the four migrations are
already active in production and neither is waiting on the app:
- `booked_via` is `not null default 'booker'` (`20260829000003:36`), so **every existing
  production booking is `'booker'`**.
- `20260829000004` widens the `completed` / `returned` transitions **only** for
  `booked_via = 'kiosk'`. With no kiosk rows in production, that widening is inert; every
  other branch of the function is unchanged.

⚠️ **THE REAL REASON THIS ORDERING MATTERS: there is no feature flag.** Nothing in
`Sidebar` or `AppShell` gates the kiosk — the "Kiosk Mode" button ships with the build. So
the kiosk goes live the moment the vendor app reaches production, and **deploy order is the
only control over when that happens.** Anyone shipping an unrelated vendor release to
production before this point ships the kiosk with it.

**Coupled batches that must not be split:** B7 + B8 + the `lib/legal.ts` union
(Stage 0). **B9 + B10** — the marker and the rule are one change in two files, and
shipping B10 without B9's pin is a security hole, not a partial feature. B1 + B2 (a
booking without its consent record is the gap B2 exists to close).

---


## Git handover (the user runs these; Claude does not)

Commits here are GPG-signed, so every git step below needs the user's passphrase.
Two things to do, in order.

### 1. Unblock the `backbone` checkout — one root-owned file

`git checkout feature/kiosk` aborts on an untracked `supabase/snippets/Untitled query
756.sql`. It is **byte-identical** to the copy tracked on the branch (verified with
`diff`), so deleting it loses nothing — the checkout restores the same bytes. It needs
`sudo` only because the directory is `root:root`.

```bash
cd ~/RS/backbone
sudo rm "supabase/snippets/Untitled query 756.sql"
# optional, stops this recurring: chown the directory back to yourself
sudo chown -R "$USER:$USER" supabase/snippets
```

### 2. Rebase `backbone`'s `feature/kiosk` onto `develop`

`vendor` is already done; `command` has nothing to rebase. Only `backbone` is behind.

```bash
cd ~/RS/backbone
git checkout feature/kiosk
git rebase develop            # replays 055d185 on top of the 20260828 migrations
git log --oneline -3          # expect: kiosk commit, then 20260828 work beneath it
```

**Expected after:** `git rev-list --left-right --count develop...feature/kiosk` prints
`0	1` — nothing behind, one kiosk commit ahead. Conflicts are unlikely: `055d185`
adds four new files and touches nothing the overnight work changed.

### 3. Then tell Claude to re-cut the migrations

Only after step 2. The re-cut deletes the four `20260826…` files and writes them as
`20260829…` (D16), and re-extracts B10's function body from the now-current tree
(F17). Claude writes the files; the user commits and applies them.

---

## Verification

| Item | Check | Kind |
|---|---|---|
| B7 | `select distinct source from legal_acceptances;` before apply; both tables' grants confirmed via `\dp` after | **needs live DB** |
| B7 | RLS actually denies: a vendor-admin of vendor A cannot read vendor B's attachments | **needs live DB** |
| B8 | Signature object write fails from an `authenticated` client and succeeds from service role | **needs live DB** |
| B1/B2 | Second booking with the same customer email reuses the `booker_id` (no `23505`) | **needs live DB** |
| B1 | Route returns 403 for a signed-in vendor-admin of a *different* vendor | **needs live DB** |
| B1 | `price_paid` on the created row equals `offering.price × quantity` and was never sent by the client | **needs live DB** |
| B3 | Query returns no date-granular offering, and **does** return custody ones — assert against seeded fixtures | **machine (test)** |
| B9 | `update bookings set booked_via='kiosk'` on a booker-originated row **raises**; a narrow `{status}` update still succeeds | **needs live DB** |
| B9 | `add column` completes without a table rewrite — confirm timing on a table with realistic row count | **needs live DB** |
| B10 | Diff of the replaced function body against `20260801000002`'s is **exactly the two lines** in B10 — the gate on applying it | **machine (diff)** |
| B10 | Vendor moves a *kiosk* custody booking `in_progress → returned` ✅ and a *kiosk* session `fulfilled → completed` ✅; both moves on *booker-originated* bookings still raise ✅; `v_system` still cannot leave `in_progress` ✅ | **needs live DB** |
| B10/D9 | A kiosk session closed at the desk lands `payout_status = 'releasable'` immediately — no 3-day wait, no Command | **needs live DB** |
| B11 | Lookup by an identifier returns only that customer's booking — no roster is reachable by empty or wildcard input | **needs live DB** |
| B11 | Target status is derived from the booking, not the request: a forged body cannot move `in_progress` straight to `completed` | **needs live DB** |
| B11 | `booking_status_log` row carries the actor and the fixed kiosk note (D8) | **needs live DB** |
| B4 | Sandbox card `4343 4343 4343 4345` → `is_paid` flips true **via the booker webhook**, unmodified. This is F4's claim under test; if it fails, the no-second-webhook decision is wrong | **needs live env + ngrok** |
| B5 | Kiosk layout imports no admin component — `grep` the import graph under `app/kiosk/` | **machine (grep)** |
| B6 | After reset, no customer field retains a value; no customer PII in `localStorage` (the B14 mode flag is the only permitted key) | **machine (test) + browser** |
| **B14** | Reload `/kiosk` → still the kiosk. Navigate to `/` while the flag is set → redirected to `/kiosk`, **with no frame of admin chrome painted first** | **browser** |
| **B14** | Kill and relaunch the installed PWA on a tablet → opens the kiosk, not the dashboard | **needs a device** |
| **B14** | Password-confirmed exit clears the flag; `/` then loads the dashboard normally | **browser** |
| **B15** | Revoke the session while the kiosk is open (sign out elsewhere) → flow halts, customer fields cleared, neutral panel shown, **never an auto-rendered login form** | **needs live env** |
| **B15** | Staff sign-in from the panel restores the kiosk; signing in as a user without `vendor-admin` on the pinned vendor is **refused** | **needs live env** |
| **B15** | A kiosk relaunched (B14) with an already-dead session lands on the panel, not on a half-working offering grid | **needs live env** |
| I1 | Unit tests mirroring booker fixtures; span refused when a later covered slot is full | **machine (`npm test`)** |
| I3/I4 | Playwright visual baselines, both themes, tablet + desktop viewports; **read the summary line from a redirected log, never `tail`** | **machine (`npm run test:visual`)** |
| I5 | Signature renders sharp at DPR 2; page does not scroll mid-stroke | **browser, tablet** |
| **R1** | A kiosk-created customer can complete "forgot password" and reach the booker dashboard — portal row, role row and `active` status all present | **needs live env** |
| **R1** | That customer can read their own kiosk booking (RLS `is_active()` passes) | **needs live DB** |
| **R2** | After B10, a `fulfilled` booking still stamps `status_changed_at`, and `auto_acknowledge_bookings()` still promotes it — test with a backdated row | **needs live DB** |
| **R2** | A Command third-party override without `app.status_change_note` still raises | **needs live DB** |
| **D10** | A `kind='photo'` row is rejected by neither CHECK, and never appears in the kiosk agreement step (which filters `requires_agreement`) | **needs live DB** |
| **B12** | Step-gating truth table, as a unit test over the predicate — no attachments → *no step 5, no step 6*; photos only → *no step 5, no step 6*; one document, no signature → *step 5 only*; one document with signature → *step 5 + step 6*; documents + photos → *step 5, and step 6 only if a document sets the flag* | **machine (test)** |
| **D11** | A `photo` row with `requires_signature = true` is **refused** by `offering_attachments_photo_no_signature` | **needs live DB** |
| **B12** | Inactive attachments are excluded: an offering whose only waiver is `is_active = false` goes Details → Payment | **machine (test)** |
| **D10** | An `offering-photos` object resolves over the public endpoint with no token; an `offering-attachments` object does **not** | **needs live DB** |
| **D10** | A vendor-admin of vendor A cannot write into vendor B's photo folder | **needs live DB** |
| **B16** | A 23:00–01:00 window with a 1-hour offering renders two slots, the second labelled with its own (next) date — not an inverted or empty range | **machine (test) + browser** |
| **B16** | Booking the 00:00 slot writes `booked_date` = the **next** day, and the confirmation screen shows that same date | **needs live DB** |
| **I1/F16** | `getSlotOccupancy` pages: seed >1000 booking rows for one date and confirm occupancy is complete, not truncated at 1000 | **needs live DB** |
| **D16** | `supabase migration list` shows the kiosk migrations ordering **after** `20260828000003`, with no gap in applied history | **needs live DB** |
| **B1** | A signature-requiring booking writes ONE acknowledgement row with `signature_path` already set — no UPDATE is attempted, and none would succeed (D17) | **needs live DB** |
| **B1** | An upload that succeeds before a failed insert leaves no orphaned object — rollback sweeps it | **needs live env** |
| **B2** | Two concurrent kiosk bookings for the same new email produce ONE profile and two bookings, not a duplicate-email error | **needs live DB** |
| **B17a/B17b** | After **each** `db push` — staging at Stage 3b, production at Stage 7 — `role_table_grants` for `booking_acknowledgements` reads `authenticated => SELECT`, `service_role => INSERT,REFERENCES,SELECT,TRIGGER`. A difference between the two environments is itself a finding | **needs live DB** |
| **regression** | Existing vendor flows unchanged end to end: booking approve/reject, fulfilment actions, offering create/edit, KYC upload, vendor registration | **browser + existing visual suite** |
| **regression** | `npm run test:visual` in `vendor/` still **157 passed / 0 failed** for pre-existing baselines, with kiosk baselines added on top | **machine** |
| **regression** | Booker and command untouched — `git status` shows no files changed outside `vendor/` and `backbone/` | **machine (git)** |
| all | `npx tsc --noEmit` and `npm run lint` clean in `vendor/` | **machine** |

**Baseline to capture before Stage 1** so regressions are attributable: current
`vendor/` type-check, lint, `npm test` and `npm run test:visual` results (F12 says
the last is 157/0 — confirm rather than assume).

---

## Assumptions

Stated per AGENTS.md; each would change the approach if wrong.

1. **The kiosk device has reliable network.** The flow has no offline mode; PayMongo
   requires connectivity. A front desk on flaky wifi wants a different design.
2. **One PayMongo account serves both apps.** F4's "no second webhook" conclusion
   depends on it. Separate merchant accounts per app would require a vendor webhook
   after all.
3. **Walk-in customers can supply an email.** D1 makes it mandatory. If a material
   share cannot, the identity model needs revisiting — a synthesised placeholder
   address would poison `get_booker_contacts` and the notification path.
4. **Vendors will apply OS-level kiosk lockdown.** B5's app-level measures are
   friction, not a boundary. Without device lockdown, an unattended tablet exposes
   the admin portal.
5. **Kiosk custody customers come back to the same desk to hand the asset back.**
   D2(C)/B11 depends on it — the return confirmation lives on the kiosk device. An
   asset returned elsewhere, after hours, or to a staff member who does not reach for
   the tablet falls back to the Command override path, which is the pre-existing
   behaviour rather than a regression.
6. **Vendors will not deliberately route bookings through the kiosk to escape the
   counterparty check.** B9's pin stops them *relabelling* an existing booking, but
   nothing stops a vendor taking a genuine booking at the kiosk and then attesting the
   return themselves. The customer's payment is real money from a real person, which
   limits the incentive — but this is the residual risk D2 accepts, and it is worth
   revisiting if custody volume grows.
7. **A walk-in customer will not later need to register a *vendor* account with the
   same email.** R3: once the kiosk creates their profile, `isEmailAvailable` blocks
   that address for vendor registration, portal-agnostically. Pre-existing behaviour,
   but the kiosk widens its reach. If this turns out to bite, the fix is a claim/upgrade
   path in the registration routes — a cross-app change, and out of scope here.
