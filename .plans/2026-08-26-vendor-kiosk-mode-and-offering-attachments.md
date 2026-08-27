# Vendor Kiosk Mode + Offering Attachments

**Date:** 2026-08-26
**App / scope:** `vendor/` (primary), `backbone/supabase/migrations/` (schema + storage).
**Cross-app read-only reference:** `booker/` — its wizard, slot service and payment
routes are the source material being adapted, not imported.
**Status:** IN PROGRESS — Stage 0 migrations **written, not applied** (2026-08-26). The user applies migrations; nothing in this plan has touched a database.

> A customer-facing kiosk surface inside the vendor portal that lets a walk-in book
> and pay for themselves at a front desk, plus the offering-attachment system
> (documents, waivers, agreements, signatures) the kiosk gates on before payment.
> Theme to optimise: **reuse the existing booking rules rather than re-deriving
> them** — every place this plan duplicates logic, it says so and says why.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision; numbers are
> plan-local — qualify cross-plan refs by app (e.g. "booker I1").

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
| F1 | **A shared "walk-in" profile per vendor is structurally impossible.** Two walk-ins taking the same slot collide on a unique index; two taking overlapping spans are refused by the placement trigger. Neither is capacity-aware — a capacity-5 schedule still refuses the second walk-in. | `20260803000003_booking_units.sql:80` (`bookings_no_duplicate` on `(booker_id, schedule_id, booked_date, coalesce(start_time,'00:00'))`); `20260803000005_booking_slot_and_capacity.sql:156-166` and `:191-199` (*"You already have a booking that overlaps this time"*) |
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

---

## BLOCKERS

### B1 — Kiosk booking creation must be an atomic service-role route  ⬜ TODO
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
customer (B2) → insert the booking → insert acknowledgement rows (B7) → upload the
signature (B8). Roll back created rows on any later failure, and mirror the register
route's `maxDuration` bump since this is several round trips.

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

### B2 — Customer provisioning, and the consent record it obliges  ⬜ TODO
**Files (new):** `vendor/lib/kioskCustomer.ts` (server-only helper, called by B1)
**Coupled to:** B7's migration (F9) — **must ship in the same batch**

D1 creates an auth account for someone who did not sign up. Two failure modes to get
right:

1. **Lookup must precede create.** A returning customer must resolve to their
   existing `booker_id`, or F1's unique index turns a legitimate second visit into a
   spurious `23505`. Look up by email; create only on miss.
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

### B3 — Kiosk offering eligibility  ⬜ TODO
**Files:** `vendor/services/kiosk.service.ts` (new)

Per D7 a date-granular offering cannot be completed by the booker either, so the
kiosk must not sell one. **Custody offerings are no longer excluded** (D2) — B9/B10
give them a completable path, and B11 the surface to complete it on.

The filter must live in the **query**, not the UI — a filter applied only at render
is one refactor away from selling something the flow cannot finish.

**Fix approach.** `getKioskOfferings(vendorId)` selects active offerings joined to
active schedules, restricted to time-granular `duration_unit` (`minute`/`hour`).
**Both `session` and `custody` patterns are eligible.** If the vendor has offerings
that are excluded, say so in the vendor-facing kiosk launcher — silence would read as
a bug.

---

### B4 — Vendor-side `create-session`, with a different caller check  ⬜ TODO
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

### B5 — Containment: an admin session on a customer-facing device  ⬜ TODO
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

### B6 — Reset, abandonment, and the capacity a dead booking holds  ⬜ TODO
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

### B7 — Attachment schema  🔄 IN PROGRESS
> ✅ Approved 2026-08-26. Migration **written**: `20260826000001_offering_attachments.sql`.
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
**File:** `backbone/supabase/migrations/20260826000001_offering_attachments.sql`

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

### B8 — Attachment + signature storage  🔄 IN PROGRESS
> ✅ Approved 2026-08-26. Migration **written**: `20260826000002_attachment_storage.sql`.
> Not applied. One addition beyond the drafted SQL: an `update` policy for vendor
> admins on `offering-attachments`, since replacing a file is an UPDATE on the
> object, not only an INSERT — the draft would have blocked re-uploads.
>
> **Amended 2026-08-26 (D10)** while still unapplied: a **third bucket**,
> `offering-photos`, `public: true`, 5 MB, images only. Public read needs no policy
> (it goes through the public object endpoint); the `select` policy that is there
> exists so the management UI can `list()` a folder, which goes through RLS even on a
> public bucket.
**File:** `backbone/supabase/migrations/20260826000002_attachment_storage.sql`
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

### B9 — `booked_via` origin marker, pinned against UPDATE  🔄 IN PROGRESS
> ✅ Approved 2026-08-26. Migration **written**: `20260826000003_booking_origin.sql`.
> Not applied.
**File:** `backbone/supabase/migrations/20260826000003_booking_origin.sql`
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

### B10 — Let the customer close a kiosk booking at the desk  🔄 IN PROGRESS
> ✅ Approved 2026-08-26. Migration **written**: `20260826000004_kiosk_customer_close_out.sql`
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
> Not applied. Stays 🔄 until the live-DB checks in Verification run.
**File:** `backbone/supabase/migrations/20260826000004_kiosk_customer_close_out.sql`
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

### B11 — Kiosk close-out flow (D2's "C" button, both patterns)  ⬜ TODO
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

### B12 — Step 5 and 6 gate on the FLAGS, never on "has attachments"  ⬜ TODO
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

### B13 — The kiosk launcher (the feature's only entry point)  ⬜ TODO
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

### B14 — Kiosk Mode must survive a reload, and a relaunch  ⬜ TODO
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

### B15 — The kiosk requires a live vendor-admin session, always  ⬜ TODO
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

## IMPORTANT

### I1 — Port occupancy and span checking into vendor  ⬜ TODO
**Files:** `vendor/services/kiosk.service.ts` (new), reusing `vendor/lib/slots.ts` + `lib/occurrence.ts`
**Reference:** `booker/services/schedules.service.ts:163-247`

Per F6/F7, occurrence and slot division already exist in vendor; the four missing
pieces are `getSlotOccupancy`, `remainingForSlot`, `spanAvailable`,
`resolveScheduleForTime`. Adapt them to vendor's `Schedule` shape (`date`/`time`/
`end`/`days`/`repeat`/`max`) rather than booker's `BookerSchedule` — a
field-for-field copy will not compile, and forcing booker's type into vendor would
duplicate a type the app already has.

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

### I2 — Attachment management UI in the offering form  ⬜ TODO
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

### I3 — Kiosk surface and its components  ⬜ TODO
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

### I4 — Responsive, touch-first kiosk design  ⬜ TODO
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

### I5 — Signature capture  ⬜ TODO
**Files (new):** `components/kiosk/KioskSignaturePad/*`

Per D6, `<canvas>` + Pointer Events (`pointerdown`/`move`/`up`, with
`setPointerCapture`) — one API for mouse, touch and stylus. Export via
`toBlob('image/png')`, posted to B1's route, which writes it to
`booking-signatures` (B8) and records the path on the acknowledgement row.

Must handle: device pixel ratio (a signature that renders blurry reads as broken),
`touch-action: none` on the canvas so the page does not scroll mid-stroke, a clear
button, and refusing to advance while the canvas is empty.

---

### I6 — Vendor notified of their own kiosk booking  ⬜ TODO
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

### I7 — Tests and visual baselines  ⬜ TODO
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

### I8 — Kiosk offline behaviour  ⬜ TODO
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

---

## DEFERRED / COSMETIC

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

**Stage 0 — approval gate (nothing else can start).**  🔄 **Migrations written
2026-08-26; not applied. Remaining in this stage: the `vendor/lib/legal.ts` `source`
union must gain `"kiosk_booking"` — B2 fails at runtime without it.**
B7 and B8 (attachment schema + storage) **and B9 + B10** (booking-origin marker + the
widened custody rule). On approval I write the four migration files; **you apply
them**. `lib/legal.ts`'s `source` union widens in the same batch (F9's coupling — B2
fails at runtime without it).
⚠️ B9 and B10 ship together, **B9 first**: the marker without the rule does nothing,
and the rule without the pin is a hole. B10 is the riskiest change in this plan — see
its one-line-diff requirement before applying.

**Stage 1 — safe now, independent of everything above.**
I1 (occupancy/span port + its tests). Touches no schema, ships behind no UI, and is
the substrate B3 and I3 both consume. This is the whole safe prefix — the rest
depends on Stage 0.

**Stage 2 — server routes.** B1 → B2 → B4, in that order (B2 is called by B1; B4
needs a booking to exist to be testable). B3's service lands with B1.

**Stage 3 — vendor-side attachment management.** I2. **Moved ahead of the kiosk UI
2026-08-26, on review.** It was Stage 5 on the grounds of being independent, which is
true of the *code* and false of the *testing*: with no editor, the only way to put a
waiver or a photo on an offering is hand-written SQL, so Stage 4's conditional steps
and photo tiles would have nothing real to render. Building the producer before the
consumer costs nothing and removes a fixture-by-SQL step from every screen after it.

**Stage 4 — kiosk UI.** I3 + I4 together (layout and styling are one pass), then I5.
**B12 lands with I3** — it is the step machine the shell owns, and its truth table is
the first test to write, before any step component exists. B5 and B6 land here too,
with the shell that owns them, as do **B14** (the mode flag and the `/` redirect) and
**B15** (the signed-in-vendor invariant and its recovery path) — both are shell states,
not polish. **B13 closes the stage** — the launcher is what makes
everything before it reachable, and its dialog needs B3's exclusion count and B5's
warning copy to already exist.
B5 and B6 land with the shell that owns them.

**Stage 5 — close-out.** B11 (both patterns), once Stage 4's kiosk shell exists to host it and
Stage 0's B9/B10 are applied. Verifiable end to end only when both are true: the
transition raises until the migrations land.

**Stage 6 — sweep.** I6, I7, I8, and the doc updates: `architecture/portals.md` (the
kiosk surface + B5's device-lockdown requirement), `architecture/schema.md` (both new
tables), `architecture/booking-flow.md` (kiosk as a second origin for bookings, and the
kiosk close-out path — its fulfilment section currently states the vendor cannot make
either the `in_progress → returned` or the `fulfilled → completed` move, which B10
makes conditionally untrue for `booked_via = 'kiosk'` rows).

**Coupled batches that must not be split:** B7 + B8 + the `lib/legal.ts` union
(Stage 0). **B9 + B10** — the marker and the rule are one change in two files, and
shipping B10 without B9's pin is a security hole, not a partial feature. B1 + B2 (a
booking without its consent record is the gap B2 exists to close).

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
