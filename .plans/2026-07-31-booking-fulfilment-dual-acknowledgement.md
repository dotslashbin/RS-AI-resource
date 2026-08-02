# Booking Fulfilment — Dual Acknowledgement & Payout Gating

**Date:** 2026-07-31
**App / scope:** `backbone` (schema), `vendor`, `booker`, `command` (web). Mobile apps are Phase 6, explicitly deferred.
**Status:** **COMPLETE** (2026-08-01) — 33 of 34 items done or explicitly deferred.
I22/I23 were added by the pre-commit review and are fixed. **I24 is ⬜ open by
design** — it is a production-cutover checklist, actioned when a live project
exists, not now.
See "On completion" at the end for what shipped, what is parked, and what was
never verified.
**Revised:** 2026-07-31 — second review pass. Added B9 (undo) and I12–I14; fixed
three defects found in the plan itself (booker undo had no write path;
`fulfilment_pattern` was joined rather than snapshotted; dispute notifications needed
a second trigger). Items marked *(found on review)* inline.
**Revised:** 2026-07-31 — disputes cut from full workflow to **flag-only**;
counterparty response, self-service withdrawal and file evidence all moved into
D2 as one follow-up. B7, I7, I8 and Stage 4 reduced accordingly.
**Revised:** 2026-07-31 — Command review. Added I15–I17 (notification plumbing,
explicit admin override, fulfilment oversight) and corrected I9's sizing:
Command's transactions page is mock data, so the payout work needs a real data
path built first.
**Revised:** 2026-07-31 — flexibility pass. The discriminator became a
`fulfilment_patterns` **lookup table** with shape-based codes (`session` /
`custody`) instead of a `service`/`rental` CHECK, so new fulfilment shapes are a
seed row rather than a migration against two tables. B1 rewritten; B8 and I6
extended; renamed throughout. `custody` retained as the code (2026-07-31) —
casual alternatives (`handover`, `round_trip`) considered and declined.
**Revised:** 2026-07-31 — UX pass. Added I18 (action copy as one source of
truth), I19 ("i" info popover per action) and I20 (dashboard guide section), plus
a new Stage 0b since none of them depend on the schema.
**Revised:** 2026-07-31 — booker's popover dependency approved and installed;
I19's last OPEN decision closed. Plan has no open decisions.
**Revised:** 2026-07-31 — UI draft pass (artifact). **I3 corrected: vendor web has
no booking detail page**, so the actions go inline in `BookingRow` — the previous
wording was carried over from the mobile plan. **I5 corrected**: booker has three
booking surfaces, not one, including a detail modal with a free primary action
slot. Added **I21** (filter tabs cannot go from 5 to 10). All three verified
against the components, and the three apps rebuilt clean (`npm run build` exit 0
for booker, vendor, command).

> Establish a booking state that means *both parties agree the service or rental
> actually happened*, and gate the vendor's payout on reaching it. Optimize for:
> money never becomes releasable without two-party agreement, and no booking can
> silently strand a vendor's cash.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Deferred; numbers are
> plan-local — qualify cross-plan refs by app (e.g. "vendor-mobile I1").

---

## 0. Investigation record — why the current schema cannot do this

Read at `file:line`, not assumed. Every claim below was verified against the migration source.

### What exists

| Piece | Location |
|---|---|
| `status` CHECK — `pending\|confirmed\|completed\|cancelled\|refunded` | `backbone/supabase/migrations/20260507000004_bookings.sql:31` |
| Transition trigger — `pending→confirmed\|cancelled`, `confirmed→completed\|cancelled`, `completed→refunded` | `20260516000004_booking_status_transition.sql:29-31` |
| Audit trail — `booking_id, changed_by, from_status, to_status, changed_at` | `20260516000006_booking_status_log.sql:19-27` |
| `is_paid` / `payment_reference` | `20260518000001_booking_payment_reference.sql:3` |
| Fee-snapshot ledger, written on `is_paid` false→true | `20260725000002_booking_transactions.sql:149-151` |
| Global commission % (singleton) | `20260725000001_platform_fee_settings.sql:26-30` |
| Payout summing — counts `confirmed` as payable | `vendor/lib/utils.ts:60-72` |

### The six gaps

**G1 — `status` is single-actor.** One column, one linear machine. `completed`
carries no information about *who* declared it. There is no representable state
for "vendor says done, booker has not confirmed".

**G2 — bookers physically cannot write to `bookings`.** The UPDATE policy
(`20260507000004_bookings.sql:120-134`) covers vendor-admins and command-admins
only. Note this is *not* fixable by loosening the policy: Postgres RLS is
row-level, so a booker UPDATE policy would also expose `price_paid`, `is_paid`
and `payment_reference` to booker writes. Column-level `GRANT UPDATE (status)`
is role-wide and would simultaneously break vendor-admin writes to
`rejection_reason` / `cancelled_by`. **A `SECURITY DEFINER` RPC is the only
correct mechanism** — the pattern already exists at
`20260620000002_booker_contacts_rpc.sql`.

**G3 — nothing records an offering's fulfilment *shape*.** `offerings.category` is
vendor-defined free text (`20260506000001_offerings.sql:20`, and
`architecture/booking-flow.md:60` confirms "there is no fixed category set");
`offerings.code` is ≤6 vendor-chosen chars. `divisions` is on **`vendors`**
(`20260724000004_divisions.sql:50`), not offerings — an EzzyCourt vendor sells
court hire and coaching from the same vendor row, so it cannot discriminate. All
three describe *what the business is*, none describes *who acknowledges what*. The
pattern-branched flow has no column to branch on. See B1 for why these are two
separate axes.

**G4 — no in-progress state.** A rental hand-over ("the asset is out") has no
representation and no timestamp.

**G5 — no payout gating whatsoever.** `booking_transactions` is written at
**payment** time, not fulfilment time, and carries no payout lifecycle column.
`payout_amount` means "what the vendor is owed"; nothing records whether it was
released. Worse, `vendor/lib/utils.ts:65` marks `confirmed: true` as payable —
today a booking counts toward the vendor's payout total the moment the vendor
accepts it, *before any service is delivered*. That is the precise behaviour this
plan reverses.

**G6 — `completed` is unreachable in production.** No app writes it.
`vendor/services/bookings.service.ts:66,76` writes only `confirmed` and
`cancelled`; every other `"completed"` occurrence across the five apps is demo
fixture data (`BookingTrendsCard.tsx`, `ui-gallery/page.tsx`) or an unrelated
*transaction* status union (`command/lib/types.ts:26`). **Consequence: there is
almost certainly no production data in `completed` or `refunded`, which makes the
migration backfill low-risk** — but this must be confirmed against the live DB
before applying (see B0).

### Already handled — do not rebuild

- **Email + push fan-out is automatic.** Both dispatchers hang off `AFTER INSERT
  ON notifications` (`20260624000003:14-16` and `20260728000001:16`). Any new
  notification type gets email and push with zero dispatcher changes.
- **Email templates need no work.** `functions/send-notification-email/lib/templates/registry.ts:11-14`
  falls back to `renderGeneric` for unregistered types.
- **`isPayable` will fail the build, not silently.** `vendor/lib/utils.ts:64` is
  typed `Record<BookingStatus, boolean>` — widening the union is a compile error
  until every new status is classified. Good; rely on it.
- **`booking_status_log` already captures actor + timestamp** for every
  transition. Do not add `vendor_ack_by` / `booker_ack_at` columns to `bookings`
  — they would duplicate this and invite drift.

### Corrections made during investigation

- **Downgrade — "add ack timestamp columns to `bookings`".** Initially assumed
  necessary; the audit log already holds who/when for every hop, so the enum plus
  one derived `status_changed_at` covers it. Rejected the extra columns.
- **False alarm — "the vendor may also need to mark a rental returned".**
  Considered letting either party record the return, which requires reading the
  log inside a BEFORE trigger to identify "the other party". Dropped: booker-only
  `in_progress → returned` is simpler, matches the stated intent, and the vendor
  is already protected because **nothing auto-advances out of `in_progress`** —
  an asset that never came back can never auto-complete.
- **Escalate — `completed → refunded` is currently open to vendor-admins.** The
  existing trigger checks direction only, and the RLS UPDATE policy admits
  vendor-admins, so a vendor can today move their own booking to `refunded`. With
  payouts attached this becomes a money bug. B4 tightens it to Command-only.

### Prior art (research)

The pattern is standard. [Sharetribe](https://www.sharetribe.com/academy/marketplace-payments/)
and [Cobbleweb](https://www.cobbleweb.co.uk/seller-payout-guide-for-online-marketplaces/)
both describe: charge at booking → hold → seller marks delivered → **buyer
confirms → release minus commission**. [Solidus](https://legacy-guides.solidus.io/developers/orders/order-state-machine)
models it as an explicit state machine rather than boolean flags — which is the
approach taken here.

Reported failure modes, and how this plan answers each:

| Failure mode | Source | Answer here |
|---|---|---|
| Buyers never confirm; money strands | [lowcode.agency](https://www.lowcode.agency/blog/order-commission-management-systems) calls auto-confirm timeout "one of the most frequently underspecified rules in marketplace order management" | B6 — 3-day auto-acknowledge on `fulfilled` and `returned` |
| Disputes arrive after auto-confirm | ibid. | B7 — `completed → disputed` is a legal transition; payout re-freezes |
| Vendor cash-flow friction from holding | [Cobbleweb](https://www.cobbleweb.co.uk/seller-payout-guide-for-online-marketplaces/) | Short, visible 3-day timer with a countdown surfaced on both sides (I3, I5) |
| Escrow ≠ marketplace payout rails | [PayMongo Platforms](https://developers.paymongo.com/docs/paymongo-platforms) — sub-accounts and split payouts are a separate product with its own onboarding and per-sub-account cost | Out of scope by decision; this plan stops at `releasable` |

---

## Target state machine

```
                      ┌─────────── service ───────────┐
pending ──▶ confirmed ─┤                               ├──▶ completed ──▶ refunded
   │           │       │  fulfilled ───(booker)────────┘        │
   │           │       └───────────────────────────────┘        │
   │           │                                                │
   │           │       ┌─────────── rental ────────────┐        │
   │           │       │ in_progress ──(booker)──▶ returned ──(vendor)──┘
   │           │       └───────────────────────────────┘
   ▼           ▼
cancelled   cancelled

any of {fulfilled, in_progress, returned, completed} ──▶ disputed ──(Command)──▶ completed | refunded | cancelled
```

| From | To | Who may | Type |
|---|---|---|---|
| `pending` | `confirmed` | vendor-admin, command | both |
| `pending` | `cancelled` | vendor-admin, command | both |
| `confirmed` | `cancelled` | vendor-admin, command | both |
| `confirmed` | `fulfilled` | vendor-admin, command | session |
| `confirmed` | `in_progress` | vendor-admin, command | custody |
| `fulfilled` | `completed` | **booker**, system (3d), command | session |
| `in_progress` | `returned` | **booker**, command | custody |
| `returned` | `completed` | **vendor-admin**, system (3d), command | custody |
| `fulfilled` | `confirmed` | vendor-admin, command | session — **undo, see B9** |
| `in_progress` | `confirmed` | vendor-admin, command | custody — **undo, see B9** |
| `returned` | `in_progress` | **booker**, command | custody — **undo, see B9** |
| `fulfilled` / `in_progress` / `returned` / `completed` | `disputed` | booker or vendor-admin | both |
| `disputed` | `completed` / `refunded` / `cancelled` | **command only** | both |
| `completed` | `refunded` | **command only** (tightened, see B4) | both |

### Cancellation — what changes and what does not

**Unchanged.** `pending → cancelled` (vendor rejects, with reason) and
`confirmed → cancelled` (vendor cancels, empty reason) keep exactly their current
actors and semantics, including the `rejection_reason`-based notification split at
`20260525000003:154,178`. The existing approve/reject flow is untouched.

**Added.** `disputed → cancelled`, Command only, as a dispute outcome.

**Deliberately blocked.** `fulfilled`, `in_progress` and `returned` have **no**
path to `cancelled`. Once a rental's asset is out or a vendor has declared a
service delivered, "cancel" is the wrong verb — the correct route is `disputed`,
which freezes the payout and puts a human in the loop. B9 covers the separate
case of an honest mis-tap, which is an *undo*, not a cancellation.

**Still absent.** Booker-initiated cancellation does not exist today
(`architecture/booking-flow.md:307`) and this plan does not add it — see D4.

**Vendor-facing labels** (DB values are stable; labels are UI-only):

| DB value | Vendor label | Booker label |
|---|---|---|
| `fulfilled` | "Awaiting booker confirmation" | "Confirm completion" |
| `in_progress` | "In progress — with booker" | "Rental in progress" |
| `returned` | "Confirm return" | "Awaiting vendor confirmation" |

Vendor action buttons: **"Start rental"** (`confirmed → in_progress`), **"Mark as
complete"** (`confirmed → fulfilled`), **"Confirm return"** (`returned → completed`).

---

## BLOCKERS

### B0 — Confirm production data shape before any migration  ✅ DONE
**Files:** none — live DB query.
G6 argues no production row is in `completed`/`refunded`, but that is inference
from app code, not observation. Every downstream backfill assumption depends on it.

**Fix approach:** Before applying anything, run against production:
```sql
select status, count(*) from public.bookings group by status;
select count(*) from public.booking_transactions;
select count(*) from public.offerings;
```
Record the result in this plan. If rows exist in `completed`, B3's backfill must
also decide their `payout_status` (recommendation: `releasable`, since they were
declared complete under the old single-actor rule).

#### 🔄 Local run — 2026-07-31 (dev/seed only, **not** production)

Ran against the running local stack (`supabase_db_fbxbwnfeimzhgxpshdpa`,
`localhost:54322`):

| status | count | | metric | count |
|---|---|---|---|---|
| `confirmed` | 23 | | bookings | 41 |
| `completed` | **11** | | `booking_transactions` | 40 |
| `refunded` | **4** | | offerings | 9 |
| `cancelled` | 2 | | `is_paid = true` | 40 |
| `pending` | 1 | | | |

**This changes an inference in G6.** G6 argued that because no app writes
`completed`, production probably has none. **`seed.sql` writes them** — 11
`completed` and 4 `refunded` locally. Two consequences:

1. **The backfill is exercisable locally**, which is better than expected —
   B3's `releasable` / `reversed` backfill has 15 real rows to act on after
   `supabase db reset`, and I14 need not manufacture them.
2. **The production inference is weaker than G6 claimed.** If production was ever
   seeded, or any status set by hand, `completed` rows exist there too. The
   production check below is therefore still required, not a formality.

#### ✅ RESOLVED BY CONTEXT (2026-07-31) — there is no production yet

The user confirmed **production is not set up**, and is willing to `db reset` the
dev database. That closes B0 on its own terms: the item exists to bound the blast
radius of a migration over unknown existing rows, and there are no unknown rows.
Specifically, these B0-dependent worries all fall away:

| Worry | Why it's moot |
|---|---|
| Backfill rewrites rows that might fail | No production rows to rewrite |
| `ADD CONSTRAINT` full scan takes a long lock | Local table is 41 rows |
| B6's first tick mass-completes backdated rows | Reset leaves nothing in a new state |
| Existing `completed` rows need a `payout_status` decision | None exist outside seed |

**Reopen this item the moment a production project is provisioned** — if the
schema ships to a live DB later, the same questions return with real answers.

#### ⚠️ …but `db reset` introduces a *different* problem — see I14

A reset does not merely make the backfill safe; **it makes it unreachable**, and
that leaves the dev database internally inconsistent. Mechanism, verified in
`backbone/supabase/seed.sql`:

1. `supabase db reset` runs **all migrations first, against empty tables** — so
   B1's and B3's backfill `UPDATE`s touch **zero rows** and are never exercised.
2. `seed.sql` then **`INSERT`s bookings with their final status directly**
   (`seed.sql:621`, `:957`, `:983`) — 11 `completed`, 4 `refunded`.
3. B3's `bookings_sync_payout_status` is `AFTER UPDATE OF status`. **An INSERT
   never fires it.** So those 11 `completed` bookings keep
   `payout_status = 'held'`.
4. `status_changed_at` (set in B2's BEFORE UPDATE trigger) is likewise **NULL**
   for every seeded row.

**Net effect on a freshly reset dev DB:** completed bookings whose payout still
reads "held", and no countdown data anywhere — which will make I4, I9 and I13 look
broken when they are not.

Not dangerous (B6 is safe here: `status_changed_at < now() - interval '3 days'` is
`NULL`-false, so nothing auto-completes), but it must be handled. **Assigned to
I14.** Note also that the `is_paid` flip at `seed.sql:1001` is an `UPDATE` of
`is_paid` only, so B2's transition trigger short-circuits on
`old.status = new.status` — seed will not trip the new actor checks.

Not run: the `supabase` CLI is not installed on this machine, and reaching the
hosted DB needs credentials I have not gone looking for. **This is the user's to
run** — in this session, prefix with `!`:

```
! psql "<production connection string>" -c "select status, count(*) from public.bookings group by status order by 2 desc;" -c "select (select count(*) from public.booking_transactions) txns, (select count(*) from public.offerings) offerings, (select count(*) from public.bookings where is_paid) paid;"
```

Paste the output here and B0 becomes ✅. **Stage 1 must not start before then** —
the whole point of B0 is that the migration's blast radius is unknown until it is.

**Verification:** needs-live-environment. Local: ✅ run 2026-07-31. Production: ⬜.

---

### B1 — Fulfilment patterns (the discriminator)  ✅ DONE
**File:** new migration `backbone/supabase/migrations/20260801000001_fulfilment_patterns.sql`
Addresses **G3**. Without this, the state machine cannot branch.
Decision recorded: **lookup table + shape-based names** (2026-07-31).

**Why a lookup table and not a CHECK.** Two axes were being conflated. *Business
taxonomy* — exam, lesson, rental, stay, consult — is already infinitely flexible
via `offerings.category` (vendor-defined free text) and the 13 `divisions`, and
this plan does not touch it. *Fulfilment shape* — who can truthfully attest to
which fact, in what order — is a small bounded set that gates money. Naming the
discriminator after two businesses (`service`/`rental`) made a structural
distinction look like a taxonomic one. Against the real divisions:

| Offering | Divisions | Shape |
|---|---|---|
| Exam, lesson, consult, treatment, callout, grooming | EzzyLearn, EzzyDrive, EzzyLaw, EzzyCare, EzzyWell, EzzyHome, EzzyWork, EzzyPets | `session` |
| Vehicle, equipment, room, court, bay | EzzyRide, EzzyDrive, EzzyStay, EzzyCourt, EzzyPark | `custody` |

Thirteen divisions, two shapes. Following the `divisions` / `statuses` / `roles` /
`portals` idiom this repo already uses, the pattern set becomes a seeded lookup
table, so adding a shape later is an insert plus a trigger branch — not an `ALTER`
against a CHECK on two tables plus a backfill decision.

```sql
create table public.fulfilment_patterns (
  code        text     primary key,
  name        text     not null,
  description text     not null default '',
  sort_order  smallint not null default 0,
  is_active   boolean  not null default true
);

comment on table public.fulfilment_patterns is
  'The set of booking fulfilment shapes — who acknowledges what, in what order. A SHAPE, not a business category: business taxonomy lives in offerings.category and divisions. Seeded; the state machine that enforces each shape lives in validate_booking_status_transition(), so adding a row here is inert until that trigger gains a matching branch.';

insert into public.fulfilment_patterns (code, name, description, sort_order) values
  ('session', 'Session',
   'The vendor performs something at a scheduled time, marks it complete, and the booker confirms. Exams, lessons, consultations, treatments, callouts.', 1),
  ('custody', 'Custody',
   'The vendor releases something into the booker''s keeping which must come back. The vendor starts, the booker returns, the vendor confirms. Vehicles, equipment, rooms, courts, bays.', 2);

alter table public.fulfilment_patterns enable row level security;

create policy "authenticated can read fulfilment_patterns"
  on public.fulfilment_patterns for select to authenticated using (true);

create policy "command admin or root can manage fulfilment_patterns"
  on public.fulfilment_patterns for all to authenticated
  using      (public.is_portal_member('command') and (public.has_role('admin') or public.has_role('root')))
  with check (public.is_portal_member('command') and (public.has_role('admin') or public.has_role('root')));

-- Public default privileges grant nothing (20260620000001) — grant explicitly.
grant select                         on public.fulfilment_patterns to authenticated;
grant select, insert, update, delete on public.fulfilment_patterns to service_role;

alter table public.offerings
  add column fulfilment_pattern text not null default 'session'
    references public.fulfilment_patterns(code);

comment on column public.offerings.fulfilment_pattern is
  'Which fulfilment shape this offering uses. Defaults to ''session'' so pre-existing offerings keep the simpler flow until a vendor reclassifies.';

create index offerings_fulfilment_pattern_idx on public.offerings (fulfilment_pattern);
```

**…and snapshot it onto the booking.** *(Added on review — this fixes a real bug,
see below.)*

```sql
alter table public.bookings
  add column fulfilment_pattern text not null default 'session'
    references public.fulfilment_patterns(code);

update public.bookings b set fulfilment_pattern = o.fulfilment_pattern
from public.offerings o where o.id = b.offering_id;

comment on column public.bookings.fulfilment_pattern is
  'Snapshot of offerings.fulfilment_pattern at booking time. Same rationale as price_paid: the offering is mutable, the booking''s flow must not be. Populated and pinned by check_booking_consistency().';
```

Populate and pin it in the **existing** `check_booking_consistency()` trigger
(`20260507000004:66-96`), which already runs `BEFORE INSERT OR UPDATE` and already
validates the other denormalised columns against the schedule — extend it rather
than adding a fourth trigger to `bookings`:

```sql
  -- on INSERT: copy from the offering. on UPDATE: reject any change.
  if tg_op = 'INSERT' then
    select o.fulfilment_pattern into new.fulfilment_pattern
    from public.offerings o where o.id = new.offering_id;
  elsif new.fulfilment_pattern <> old.fulfilment_pattern then
    raise exception 'bookings.fulfilment_pattern is immutable after creation';
  end if;
```

**Why this is not gold-plating — it fixes a live bug.** Without the snapshot, a
vendor editing an offering from `session` to `custody` **strands every in-flight
booking**: B5's RPC branches on `v_pattern`, so a booking sitting in `fulfilled`
whose offering just became `custody` matches neither arm of the `case` and the
booker can never acknowledge it. The snapshot also removes a join from the hot
path of the most safety-critical trigger in the schema, and it follows the
precedent `bookings.price_paid` already sets ("Preserved if the offering price
changes later", `20260507000004:43`).

**⚠️ The state machine stays in code — do not make it data-driven.** The tempting
next step is a `fulfilment_pattern_steps` table defining each pattern's ordered
(state, actor) rows, so a new shape needs no deploy. **Reject it.** This machine
gates payouts: turning it into configuration means a bad seed row could let a
vendor acknowledge in the booker's place and release their own money, and B8 could
no longer prove the matrix exhaustively. Labels and taxonomy are data; **money
logic is code**. `fulfilment_patterns` deliberately holds no behaviour — a row
added without a matching branch in `validate_booking_status_transition()` is inert
(the offering can be tagged, but no fulfilment transition will be permitted), and
the table comment says so.

**Step labels stay TS constants**, not columns here — matching how status labels
already live in `vendor/lib/utils.ts` and `booker/.../BookingStatusWidget.tsx:15`.
UI copy in the DB would force every client to fetch it and rule out localisation.

**Likely third pattern, for naming's sake:** `self_serve` — no vendor completion
step at all (EzzyPark: you parked, you left; EzzyFood: it arrived). Not built now;
the names above leave room for it without reinterpretation.

**Blast radius:**
- *Data* — one new seeded table, plus two `not null default` column adds
  (catalogue-only, no rewrite, cannot fail) and a backfill UPDATE over `bookings`.
  Every row resolves to `'session'` on first apply since B1 has only just created
  the source column.
- *FK ordering* — `fulfilment_patterns` must be created **and seeded** before
  either `ALTER`, or the FK on the default value fails. Same migration, correct order.
- *Lock* — `ACCESS EXCLUSIVE` for the catalogue updates, sub-millisecond each;
  row locks during the backfill.
- *FK cost* — `references fulfilment_patterns(code)` adds a lookup per
  offering/booking write against a two-row table; negligible, and it buys
  referential integrity a CHECK cannot (a pattern cannot be deleted while in use).
- *Downstream* — hand-written interfaces in `vendor/services/offerings.service.ts`
  **and** `vendor/services/bookings.service.ts` / `booker/services/bookings.service.ts`
  gain the field (see I6). No `supabase gen types` in this repo.
- *Reversibility* — drop both columns, drop the table, revert
  `check_booking_consistency()` to the body in `20260507000004`. Safe while
  nothing reads them.

**Approval gate:** schema change (new table + two columns + RLS + grants).

---

### B2 — Actor-aware transition trigger + widened status set  ✅ DONE
**File:** new migration `20260801000002_booking_fulfilment_states.sql`
Addresses **G1**, **G4**. This is the heart of the feature.

The existing trigger (`20260516000004:29-31`) validates *direction only*. It must
become *actor- and type-aware*, because "the booker acknowledges" is not
expressible in RLS — RLS gates which rows you may touch, not which values you may
write.

```sql
alter table public.bookings drop constraint bookings_status_values;
alter table public.bookings add constraint bookings_status_values
  check (status in ('pending','confirmed','fulfilled','in_progress',
                    'returned','completed','disputed','cancelled','refunded'));

create or replace function public.validate_booking_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pattern       text;
  v_booker     boolean;
  v_vendor     boolean;
  v_command    boolean;
  v_system     boolean;
begin
  if old.status = new.status then return new; end if;

  -- Snapshotted on the booking (B1), NOT joined from offerings: the offering is
  -- mutable and a mid-flight edit would otherwise change a booking's legal moves.
  v_pattern := new.fulfilment_pattern;

  -- auth.uid() reads request.jwt.claims, which SECURITY DEFINER does NOT alter,
  -- so these remain the *calling user* even when invoked from a definer RPC.
  -- NULL means no JWT: service_role or the pg_cron job — i.e. the system actor.
  v_system  := auth.uid() is null;
  v_booker  := auth.uid() = new.booker_id;
  v_vendor  := public.has_vendor_role(new.vendor_id, 'vendor-admin');
  v_command := public.is_portal_member('command')
               and (public.has_role('admin') or public.has_role('root'));

  if old.status = 'pending' then
    if new.status = 'confirmed' and (v_vendor or v_command or v_system) then return new; end if;
    if new.status = 'cancelled' and (v_vendor or v_command)             then return new; end if;
  elsif old.status = 'confirmed' then
    if new.status = 'cancelled'   and (v_vendor or v_command)                        then return new; end if;
    if new.status = 'fulfilled'   and (v_vendor or v_command) and v_pattern = 'session' then return new; end if;
    if new.status = 'in_progress' and (v_vendor or v_command) and v_pattern = 'custody'  then return new; end if;
  elsif old.status = 'fulfilled' then
    if new.status = 'completed' and (v_booker or v_system or v_command) then return new; end if;
    if new.status = 'disputed'  and (v_booker or v_vendor)              then return new; end if;
    if new.status = 'confirmed' and (v_vendor or v_command)             then return new; end if;  -- B9 undo
  elsif old.status = 'in_progress' then
    -- deliberately NO system branch: an asset that never came back must never auto-complete
    if new.status = 'returned' and (v_booker or v_command) then return new; end if;
    if new.status = 'disputed' and (v_booker or v_vendor)  then return new; end if;
    if new.status = 'confirmed' and (v_vendor or v_command) then return new; end if;  -- B9 undo
  elsif old.status = 'returned' then
    if new.status = 'completed' and (v_vendor or v_system or v_command) then return new; end if;
    if new.status = 'disputed'  and (v_booker or v_vendor)              then return new; end if;
    if new.status = 'in_progress' and (v_booker or v_command)           then return new; end if;  -- B9 undo
  elsif old.status = 'completed' then
    if new.status = 'refunded' and v_command              then return new; end if;
    if new.status = 'disputed' and (v_booker or v_vendor) then return new; end if;
  elsif old.status = 'disputed' then
    if new.status in ('completed','refunded','cancelled') and v_command then return new; end if;
  end if;

  raise exception
    'Invalid booking status transition: % → % (fulfilment_pattern %, actor not permitted)',
    old.status, new.status, v_pattern;
end;
$$;
```

**Blast radius:**
- *Data* — dropping and re-adding the CHECK **does** validate every existing row.
  It is a strict widening, so validation cannot fail; but it takes `ACCESS
  EXCLUSIVE` for a full scan of `bookings`. At current table size this is
  sub-second. If `bookings` is large at apply time, use the two-step
  `ADD CONSTRAINT ... NOT VALID` / `VALIDATE CONSTRAINT` form instead.
- *Behaviour change (intentional)* — `completed → refunded` narrows from
  "anyone who passes RLS" to Command-only. See B4.
- *Command is a universal actor here* — `v_command` appears in almost every
  branch, so a Command admin can act in either party's place and push a booking to
  `completed`, releasing money without either party agreeing. Kept deliberately
  (support must be able to unstick bookings), but it must not be **silent**:
  **I16** folds a mandatory reason + `booking_status_log.notes` into this same
  trigger. Do not ship B2 without I16's trigger half.
- *Behaviour change (unintentional risk)* — `pending → confirmed` now
  additionally requires `v_vendor or v_command or v_system`. The vendor apps
  already satisfy this via the same `has_vendor_role` the RLS policy uses, so no
  regression is expected. **This is exactly what B8's test matrix must prove.**
- *Reversibility* — restore the prior function body from
  `20260516000004_booking_status_transition.sql`; re-narrow the CHECK only after
  confirming no rows sit in a new state.

**Coupling:** must ship in the same batch as **B3** (payout sync reads these
states) and **I1/I2** (the union types in `vendor/lib/types.ts:1` and
`booker/lib/types.ts:2` must widen or the apps mis-render unknown statuses).

**Approval gate:** schema change.

---

### B3 — `status_changed_at` + payout lifecycle on `booking_transactions`  ✅ DONE
**File:** same migration as B2, or `20260801000003_booking_payout_status.sql`
Addresses **G5**.

Two pieces. First, a derived timestamp — needed both by the auto-acknowledge job
(B6) and by the countdown UI (I3, I5). `bookings.updated_at` cannot serve: it is
bumped by `set_updated_at()` on *any* column change, so editing `notes` would
silently restart a booker's 3-day window.

```sql
alter table public.bookings add column status_changed_at timestamptz;

comment on column public.bookings.status_changed_at is
  'When status last changed. Maintained by log_booking_status_change(). NOT updated_at, which any column write bumps — restarting the acknowledgement window on an unrelated edit would be a money bug.';

-- extend the existing AFTER UPDATE logger to also stamp the column
-- (BEFORE trigger would be cleaner, but the log trigger already exists and
--  splitting the concern across two triggers is worse than one extra write)
```

> **Implementation note — resolve at execution time.** `log_booking_status_change()`
> is an `AFTER UPDATE` trigger and therefore cannot assign to `NEW`. Two options,
> pick at execution: (a) set `status_changed_at = now()` inside the *existing*
> `BEFORE UPDATE` transition trigger from B2, which already runs on exactly the
> status-change path — preferred, one trigger, no extra write; or (b) a separate
> `BEFORE UPDATE` trigger. **Use (a).** Backfill:
> `update public.bookings set status_changed_at = coalesce(
>    (select max(l.changed_at) from public.booking_status_log l
>     where l.booking_id = bookings.id), created_at);`

Second, the payout lifecycle:

```sql
alter table public.booking_transactions
  add column payout_status text not null default 'held'
    check (payout_status in ('held','releasable','released','reversed')),
  add column released_at timestamptz;

comment on column public.booking_transactions.payout_status is
  'Payout lifecycle. held: booking not yet mutually completed. releasable: both parties acknowledged; the vendor is owed this money. released: platform has disbursed (set by Command). reversed: refunded. Written by trigger or by Command; never by the vendor. The FINANCIAL FIGURES on this row remain immutable — only this lifecycle column moves.';

create index booking_transactions_payout_status_idx
  on public.booking_transactions(vendor_id, payout_status);
```

Backfill (subject to B0's findings):
```sql
update public.booking_transactions bt set payout_status = 'releasable'
from public.bookings b where b.id = bt.booking_id and b.status = 'completed';
update public.booking_transactions bt set payout_status = 'reversed'
from public.bookings b where b.id = bt.booking_id and b.status in ('refunded','cancelled');
```

Sync trigger:
```sql
create or replace function public.sync_booking_payout_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' then
    update public.booking_transactions
       set payout_status = 'releasable'
     where booking_id = new.id and payout_status = 'held';
  elsif new.status = 'disputed' then
    -- 'released' is deliberately NOT downgraded: money already out the door is a
    -- Command reconciliation problem, not something a trigger should paper over.
    update public.booking_transactions
       set payout_status = 'held'
     where booking_id = new.id and payout_status = 'releasable';
  elsif new.status in ('refunded','cancelled') then
    update public.booking_transactions
       set payout_status = 'reversed'
     where booking_id = new.id and payout_status <> 'released';
  end if;
  return new;
end;
$$;

create trigger bookings_sync_payout_status
  after update of status on public.bookings
  for each row when (old.status is distinct from new.status)
  execute function public.sync_booking_payout_status();
```

Grants — `authenticated` keeps `select` only; Command's "mark released" goes
through a definer RPC (I9), preserving "no authenticated write path" exactly as
`20260725000002:189-190` established.

**Architecture-doc divergence — resolved 2026-07-31.** `architecture/schema.md:507-518`
documents `booking_transactions` as append-only with "No INSERT/UPDATE/DELETE
policies for authenticated". Adding a mutable column diverges from that wording.
**Chosen: add the column, amend the doc** (see I11) to state that the *financial
figures* are immutable while the payout lifecycle is explicitly mutable and
trigger/definer-written. The guarantee that mattered — fee percentage and amounts
never drift — is fully preserved, and no `authenticated` write grant is added.

**Blast radius:**
- *Data* — two `not null default` adds (catalogue-only) plus a genuine UPDATE
  backfill over `booking_transactions`. Row count is bounded by paid bookings;
  small today. Runs inside the migration transaction.
- *Lock* — brief `ACCESS EXCLUSIVE` per `ALTER`, plus row locks during backfill.
- *Downstream* — **`vendor/lib/utils.ts:60-72` `isPayable` must be rewritten**;
  `confirmed: true` becomes `false` and the source of truth moves to
  `payout_status`. This *changes the number vendors currently see* on the
  transactions page. Flag to vendors before release (see I10).
- *Reversibility* — drop both columns and the trigger; no data loss beyond the
  lifecycle history itself.

**Coupling:** ships with **B2** and **I4**.

**Approval gate:** schema change.

---

### B4 — Tighten `completed → refunded` to Command-only  ✅ DONE
**File:** folded into B2's trigger (the `old.status = 'completed'` branch).
Today `20260516000004:31` permits `completed → refunded` on direction alone, and
the RLS UPDATE policy (`20260507000004:120-134`) admits vendor-admins — so a
vendor can mark their own booking refunded. Harmless while nothing reads it;
a money bug the moment `payout_status` derives from it.

**Fix approach:** already encoded in B2 (`if new.status = 'refunded' and v_command`).
Called out separately because it is a **deliberate removal of an existing
capability** and must be announced, not discovered.

**Verification:** machine-verifiable via B8's matrix — a vendor-admin JWT
attempting `completed → refunded` must raise.

---

### B5 — Booker write path (`SECURITY DEFINER` RPC)  ✅ DONE
**File:** new migration `20260801000004_booking_acknowledgement_rpc.sql`
Addresses **G2**. Without this the booker literally cannot acknowledge anything.

```sql
-- p_undo = false: advance (fulfilled → completed | in_progress → returned)
-- p_undo = true:  rewind  (returned → in_progress)   [B9]
create or replace function public.acknowledge_booking(
  p_booking_id uuid,
  p_undo       boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_next   text;
  v_pattern   text;
begin
  -- SECURITY DEFINER bypasses RLS, so ownership is checked explicitly here.
  -- The B2 trigger re-checks the actor independently; this is belt-and-braces,
  -- and it produces a clear error instead of a generic transition failure.
  select b.status, b.fulfilment_pattern
    into v_status, v_pattern
  from public.bookings b
  where b.id = p_booking_id and b.booker_id = auth.uid();

  if v_status is null then
    raise exception 'Booking not found or not yours';
  end if;
  if not public.is_active() then
    raise exception 'Account is not active';
  end if;

  if p_undo then
    v_next := case when v_status = 'returned' then 'in_progress' else null end;
  else
    v_next := case
      when v_status = 'fulfilled'   and v_pattern = 'session' then 'completed'
      when v_status = 'in_progress' and v_pattern = 'custody'  then 'returned'
      else null
    end;
  end if;

  if v_next is null then
    raise exception 'Booking is % — no % action available', v_status,
      case when p_undo then 'undo' else 'acknowledgement' end;
  end if;

  update public.bookings set status = v_next where id = p_booking_id;
  return v_next;
end;
$$;

revoke execute on function public.acknowledge_booking(uuid, boolean) from public, anon;
grant  execute on function public.acknowledge_booking(uuid, boolean) to authenticated, service_role;
```

**The `p_undo` arm was missing and B9 was unreachable without it.** *(Found on
review.)* B9 grants the booker `returned → in_progress`, but G2 still applies —
bookers have no UPDATE path to `bookings` at all, so the trigger permitting the
transition is necessary and **not sufficient**. Every booker-side write in this
plan must terminate in a definer RPC; the undo is no exception.

Still deliberately **one** RPC: the target state is fully determined by current
status + fulfilment type + direction, so a `p_to_status` parameter would only add
a value the server must re-derive anyway. A `boolean` for direction is the whole
of the added surface. Mirrors the single-purpose shape of `get_booker_contacts`.

`fulfilment_pattern` is read from `bookings`, not joined from `offerings` — see B1.

**Blast radius:** additive; no existing behaviour changes. Reversible by
`drop function`. Note the signature is `(uuid, boolean)` — if an earlier draft of
this migration ever shipped the `(uuid)` form, drop it explicitly rather than
relying on `create or replace`, which would leave both overloads live.

**Approval gate:** schema change (new function + grants).

---

### B6 — Auto-acknowledge after 3 days  ✅ DONE
**File:** new migration `20260801000005_auto_acknowledge_bookings.sql`
Decision recorded: **3 days** (2026-07-31).

Applies to both terminal-pending states — `fulfilled` (waiting on the booker) and
`returned` (waiting on the vendor's return check). It deliberately does **not**
apply to `in_progress`: nothing may auto-complete while an asset is still out.

```sql
create or replace function public.auto_acknowledge_bookings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  with due as (
    select id from public.bookings
    where status in ('fulfilled','returned')
      and status_changed_at < now() - interval '3 days'
    order by status_changed_at
    limit 500              -- bounded batch; the job re-runs hourly
    for update skip locked
  )
  update public.bookings b
     set status = 'completed'
    from due
   where b.id = due.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
```

`auth.uid()` is NULL under cron, so B2's `v_system` branch authorises it, and
`booking_status_log.changed_by` records NULL — which the UI must render as
"automatically confirmed", not as a missing actor (see I3).

**Scheduling — no scheduler exists in this repo today.** Verified: no `pg_cron`,
no scheduled route; the only async mechanism is `pg_net` + Vault → Edge Function
(`20260624000003`).

- **Chosen: `pg_cron`.** One extension, one `cron.schedule('auto-acknowledge-bookings',
  '0 * * * *', $$select public.auto_acknowledge_bookings()$$)`, entirely inside
  `backbone`. No new deploy target, no new secret, no new HTTP surface. Hourly
  granularity on a 3-day window is ample.
> **🔄 Availability check — 2026-07-31.** Local half confirmed:
> `select name, default_version, installed_version from pg_available_extensions`
> on the running local stack returns **`pg_cron | 1.6.4 | (not installed)`** — so
> the extension ships in the local Supabase image and `create extension pg_cron`
> will work in dev. (`pg_net 0.20.3` and `supabase_vault 0.3.1` are both already
> *installed*, as `20260624000003` requires.)
> **Hosted half deferred, not failed (2026-07-31)** — there is no production
> project yet (see B0), so there is nothing to check against. B6 is a Stage 3 item
> and dev works today, so this is not a blocker now. **Re-check when the hosted
> project is provisioned**, before B6 ships to it. The fallback below applies if
> it turns out unavailable, and the SQL function is unchanged either way.

- **Contingency, not an open decision:** if `pg_cron` proves unavailable on the
  project's Supabase plan or absent from the local CLI image, fall back to a
  `command`-app route `app/api/cron/auto-acknowledge/route.ts` that verifies a
  shared secret header and calls the RPC with the service-role client, driven by
  an external scheduler. The SQL function above is identical either way — only
  the invoker changes. Verify availability as the first step of B6.

**Blast radius:**
- *Data* — promotes rows to `completed`, which cascades into `payout_status =
  'releasable'` via B3. **This is the step that makes money releasable without a
  human**, so the batch limit, the `skip locked`, and the status filter are
  load-bearing.
- *First run hazard* — after backfilling `status_changed_at` (B3), any booking
  already sitting in a new state for >3 days would complete on the first tick. No
  such rows can exist (the states are brand new), but confirm via B0.
- *Reversibility* — `select cron.unschedule('auto-acknowledge-bookings');`

**Approval gate:** schema change + new extension.

---

### B7 — Dispute flag  ✅ DONE
**File:** new migration `20260801000006_booking_disputes.sql`
Decision **revised 2026-07-31**: **flag-only** (was: full workflow). Either party
raises a flag with a reason; the payout freezes; Command resolves. There is no
counterparty response step and no self-service withdrawal — *"Command resolves
manually"* is the whole model, and adding either would be exactly the
self-service resolution logic flag-only exists to avoid.

```sql
create table public.booking_disputes (
  id                 uuid        primary key default gen_random_uuid(),
  booking_id         uuid        not null references public.bookings(id) on delete cascade,
  raised_by          uuid                 references public.profiles(id) on delete set null,
  raised_role        text        not null check (raised_role in ('booker','vendor')),
  reason             text        not null check (char_length(reason) between 10 and 2000),
  status             text        not null default 'open'
                       check (status in ('open','resolved')),
  resolution_notes   text        not null default '',
  resolution_outcome text                 check (resolution_outcome in ('completed','refunded','cancelled')),
  resolved_by        uuid                 references public.profiles(id) on delete set null,
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- One live flag per booking. Partial unique index rather than a plain one, so a
-- booking may be flagged again after an earlier flag is resolved.
create unique index booking_disputes_one_active_idx
  on public.booking_disputes (booking_id) where status = 'open';

create index booking_disputes_booking_idx on public.booking_disputes (booking_id);
create index booking_disputes_open_idx    on public.booking_disputes (created_at)
  where status = 'open';   -- powers Command's queue
```

`raised_role` is set by the RPC from the caller's actual relationship to the
booking, never from a client argument.

**Writes are RPC-only** — no `authenticated` INSERT/UPDATE policies, exactly
mirroring `booking_status_log` and `booking_transactions`. **Two** definer RPCs,
each doing its own actor check *and* moving `bookings.status` in the same
transaction so the two can never disagree:

| RPC | Actor | Effect |
|---|---|---|
| `raise_booking_dispute(p_booking_id uuid, p_reason text)` | booker or vendor-admin of that booking | insert flag (`open`), set booking → `disputed` (which re-freezes payout via B3) |
| `resolve_booking_dispute(p_dispute_id uuid, p_outcome text, p_notes text)` | Command admin/root only | flag → `resolved`, set outcome/resolver/timestamp, move booking → `completed` \| `refunded` \| `cancelled` |

A flag raised in error is resolved by Command back to `completed` — the same one
action that resolves a real one. No separate withdrawal path.

RLS — SELECT only, three policies matching the `booking_status_log` shape
(`20260516000006:39-63`): booker of the booking; `is_active() and
has_vendor_role(...)` for the vendor (the `is_active()` half is mandatory —
`architecture/schema.md:747` documents that `has_vendor_role` alone does not
check active status); Command admin/root.

Grants: `grant select on public.booking_disputes to authenticated;` and full DML
to `service_role`, per the mandatory-explicit-grants invariant
(`20260620000001:22-23`).

`updated_at`: reuse `set_updated_at()`.

**No notification trigger on this table** — a consequence of the flag-only trim,
see I7. Both dispute notifications are `bookings.status` transitions, so the
existing trigger carries them.

**Blast radius:** new table, purely additive. The only coupling into existing
behaviour is `disputed` appearing in `bookings.status`, already handled by B2/B3.
Reversible by `drop table ... cascade` while unused.

**Forward compatibility:** the deferred fuller workflow (D2) adds columns
(`counterparty_response`, `responded_at`) and CHECK values (`responded`,
`withdrawn`) to this same table. Nothing here needs to be undone to get there —
which is why flag-only is a smaller first step rather than a different design.

**Approval gate:** schema change.

---

### B9 — Undo path for a mis-tapped fulfilment action  ✅ DONE
**File:** folded into B2's trigger (the three `-- B9 undo` lines).
Without this, a vendor who taps "Start rental" or "Mark as complete" on the wrong
booking has **no way back**. Their only escapes would be raising a dispute against
their own booker — absurd — or a Command support ticket. This will happen on the
first day of use.

**Why these three and no others.** Each of `fulfilled`, `in_progress` and
`returned` means *"actor X has acted, awaiting actor Y"*. By construction Y has
**not** yet acted — if they had, the status would already have moved on. So the
state can be safely rewound by whoever created it, with no lost information and
no other party's decision discarded:

| Undo | By | Safe because |
|---|---|---|
| `fulfilled → confirmed` | vendor-admin | booker has not confirmed |
| `in_progress → confirmed` | vendor-admin | booker has not returned |
| `returned → in_progress` | **booker** | vendor has not confirmed the return |

This is an **undo, not a cancellation** — it returns the booking to the last
mutually-agreed state rather than terminating it.

**Fix approach:** already encoded in B2. Surface it in the UI as a low-emphasis
**"Undo"** on the booking detail (I3 vendor side, I5 booker side), visible only in
those three states.

**Blast radius:**
- *Money* — none. Rewinding never touches `payout_status`: B3's sync trigger only
  reacts to `completed`, `disputed`, `refunded` and `cancelled`, none of which are
  undo targets. Verify this explicitly in B8 rather than trusting the reading.
- *Clock* — the undo resets `status_changed_at`, so redoing the action restarts
  the full 3-day acknowledgement window. Correct behaviour, but state it in the
  UI copy so a vendor is not surprised.
- *Abuse* — a vendor could bounce `fulfilled ↔ confirmed` repeatedly. No money
  moves and every hop is recorded in `booking_status_log`, so the exposure is
  notification spam. **Suppress notifications on the undo transitions in I7** —
  do not emit `booking_fulfilled` again on a re-fulfil within the same booking, or
  bookers get duplicate emails.

---

### B8 — Transition test matrix  ✅ DONE
**File:** `backbone/supabase/tests/` (create if absent) or a seeded SQL script.
B2 rewrites the single most safety-critical function in the schema and B4 removes
an existing capability. "It should work" is not acceptable here.

**Fix approach:** exercise every cell of the target-state-machine table — each
`(from, to, actor, fulfilment_pattern)` combination, asserting allow or raise. Must
explicitly cover the regression risks:
- vendor-admin `pending → confirmed` still succeeds (the existing approve flow)
- vendor-admin `completed → refunded` now **raises** (B4)
- booker `confirmed → completed` **raises** (no skipping the vendor step)
- booker `fulfilled → completed` succeeds via `acknowledge_booking`
- a `session` offering `confirmed → in_progress` **raises**; a `custody` one `confirmed → fulfilled` **raises**
- NULL-JWT (system) `in_progress → completed` **raises**
- **cancellation is closed after fulfilment starts** — `fulfilled → cancelled`,
  `in_progress → cancelled` and `returned → cancelled` all **raise**, for every actor
- **B9 undo** — vendor `fulfilled → confirmed` and `in_progress → confirmed`
  succeed; booker `returned → in_progress` succeeds; the *wrong* actor on each
  (booker undoing `fulfilled`, vendor undoing `returned`) **raises**
- **B9 leaves money alone** — after an undo, assert `payout_status` is still
  `'held'` and no `booking_transactions` row was touched
- **`fulfilment_pattern` is pinned** (B1) — flipping the *offering* from `session` to
  `custody` mid-flight must not change an existing booking's legal moves, and a
  direct UPDATE of `bookings.fulfilment_pattern` must **raise**
- **An unimplemented pattern is inert, not permissive** (B1) — insert a third row
  into `fulfilment_patterns`, tag an offering with it, book it, and assert **every**
  fulfilment transition raises. This is the guard that stops the lookup table from
  becoming a way to configure money logic.
- **A pattern in use cannot be deleted** — the FK must reject it
- **Dispute resolution sends the right email** (I7 landmine) — resolving a dispute
  to `cancelled` must **not** emit `booking_rejected`

**Verification:** machine-verifiable. This gates the whole batch.

---

## IMPORTANT

### I1 — Widen `BookingStatus` unions  ✅ DONE
**Files:** `vendor/lib/types.ts:1`, `booker/lib/types.ts:2`
Add `fulfilled | in_progress | returned | disputed`. Note `booker/lib/types.ts:2`
is **already missing `"cancelled"`** — a pre-existing bug (a cancelled booking
falls through every status map). Fix it here since the line is being edited
anyway; it is in scope by adjacency, not a drive-by refactor.

**Coupling:** widening the union breaks `vendor/lib/utils.ts:64`'s
`Record<BookingStatus, boolean>` at compile time — intended, see I4.

---

### I2 — Status badge styling for the four new states  ✅ DONE
**Files:** `vendor/lib/utils.ts:9-19` (`statusStyle`), `booker/components/dashboard/BookingStatusWidget/BookingStatusWidget.tsx:15`, `command/lib/utils.ts:48`
Apply `.claude/skills/ux-design/SKILL.md` before choosing colours — in particular
light/dark parity, and that `disputed` must read as *attention needed* without
colliding with `cancelled`'s red. Suggested: `fulfilled`/`returned` amber-ish
(awaiting action), `in_progress` violet, `disputed` orange-red distinct from
cancelled.

**Component separation:** these are pure lookup maps in existing files — no new
component, so `.claude/skills/component-separation/SKILL.md` imposes nothing new.
Add the corresponding swatches to each app's `/ui-gallery` fixture page.

---

### I3 — Vendor row actions  ✅ DONE
**Files:** `vendor/services/bookings.service.ts` (new writes), `vendor/components/bookings/BookingRow/BookingRow.tsx` + `useBookingRow.ts`

**⚠️ Corrected 2026-07-31 — there is no vendor booking detail page.** This item was
written as "booking detail actions" and described a detail screen. That was carried
over from `.plans/2026-07-31-vendor-mobile-booking-status-actions.md`, where
`BookingDetail` genuinely exists. **Vendor web has only
`BookingsPage` → `BookingRow`** — verified: `vendor/components/bookings/` contains
exactly `BookingRow/{BookingRow.tsx,useBookingRow.ts}` and
`BookingsPage/{BookingsPage.tsx,useBookings.ts}`, nothing else.

**So the actions go inline in the row — which is already the established pattern.**
`BookingRow.tsx:36-40` renders Approve/Reject in a right-aligned action slot beside
the status pill, and `:42+` expands a reason textarea *beneath* the row
(indented `ml-[50px]`) with Confirm/Cancel. Extend that slot and reuse that
expansion; do not introduce a modal or a detail route.

Note also it is **not an HTML `<table>`** — `BookingsPage.tsx:41-45` maps
`BookingRow` into a `sp-card` of flex rows. Visually a table; structurally not one.
Add the vendor actions — **Hand over**, **Mark as done**, **Got it back**,
**Something's wrong** — each shown only for the matching `(status,
fulfilment_pattern)` pair. Surface the countdown on `returned`: *"Auto-confirms in
N days"* from `status_changed_at`.

**All labels come from `vendor/lib/bookingActionCopy.ts` (I18) — do not hardcode
them here**, and each button carries an `InfoTip` (I19).

Also a low-emphasis **"Undo"** (B9) on `fulfilled` and `in_progress`; its copy
lives in I18 and already states that it restarts the acknowledgement window, so
the button needs no bespoke wording. Note there is deliberately
**no "Cancel" once fulfilment has started** — if the vendor genuinely needs to
terminate the booking at that point, the route is "Raise a dispute". The empty
state copy must say so rather than leaving the vendor hunting for a cancel button.

**Component separation (corrected).** `BookingRow/` already has its
`useBookingRow.ts` companion (29 lines), so **extend the existing pair** rather
than nesting a new component — a separate `BookingFulfilmentActions/` would have
to reach back into the row for the expansion state, which is worse than one
slightly larger hook. Styling stays Tailwind classes, matching the file (there is
no `.module.css` anywhere in this area).

Two things to generalise rather than bolt onto, both in `useBookingRow.ts`:

- **`rejecting: boolean` → `reasonFor: "reject" | "dispute" | null`.** Rejecting and
  flagging are the *same interaction* — a button that opens an inline textarea, then
  confirm/cancel. A parallel `disputing` boolean would duplicate the whole block.
- **`approving: boolean` → `busy: boolean`.** Every action needs the same
  double-submit guard, not just approve.

**Prop signature.** `BookingRow` currently takes `approveB` and `rejectB`
(`BookingRow.tsx:9-11`). Five more sibling props would make a seven-callback
component; collapse to a single
`onAction(id, action: BookingActionKey, reason?: string)`. This does modify two
existing props and their call sites in `BookingsPage.tsx:44` — a deliberate small
refactor, called out rather than done silently.

**Optional, undecided — the "your move" affordance.** The UI draft added a 3px
accent bar on the left of rows awaiting *this* user's action, so a vendor can scan
a long list without reading every pill. It reads well but puts an element on every
row. **Not currently in scope** — adopt or drop deliberately when I3 is built.

**Coupling:** supersedes the unstarted `confirmed → completed` item (I1) in
`.plans/2026-07-31-vendor-mobile-booking-status-actions.md` — that plan must be
marked ✖ ABORTED or re-pointed at this state machine before mobile work resumes.

---

### I4 — Rewrite `isPayable` around `payout_status`  ✅ DONE
**File:** `vendor/lib/utils.ts:60-72`, `vendor/services/transactions.service.ts:201`
`confirmed: true` must become `false`; payability now derives from
`booking_transactions.payout_status in ('releasable','released')`, not from
booking status at all. The comment block at `utils.ts:60-63` explains the old
rule and must be rewritten, not left contradicting the code.

**Coupling with B3** — same batch. Also with **I10**: this visibly reduces the
"Total Payout" figure vendors see today.

---

### I5 — Booker acknowledgement UI  ✅ DONE
**Files:** `booker/services/bookings.service.ts` (call `acknowledge_booking` RPC), `booker/components/dashboard/BookingStatusWidget/`
Primary action on a `fulfilled` booking: **"Yes, all done"**. On an `in_progress`
custody booking: **"I've returned it"**. Both with the *"Auto-confirms in N days"*
countdown, plus a secondary **"Something's wrong"** entry into B7, and an
**"Undo"** on `returned` (B9) for a mis-tapped return.

**All labels come from `booker/lib/bookingActionCopy.ts` (I18) — do not hardcode
them here**, and each button carries an `InfoTip` (I19). The `booker_confirm_done`
meaning must keep its "this releases their payment" clause: it is the one action
in the app where a booker's tap moves money.

The existing Realtime subscription (`useAppShell.ts`, per
`architecture/booking-flow.md:189-191`) already patches `status` in place on
UPDATE, so the booker sees the vendor's action live with **no new subscription
work** — confirm this holds for the new values rather than assuming.

**Three booker surfaces, not one** *(corrected 2026-07-31 — the item named only
the first).* Verified: booker is a single-route SPA (`booker/app/page.tsx` is the
only page), and bookings render in three places under
`booker/components/dashboard/`:

| Surface | File | What it needs |
|---|---|---|
| Dashboard widget | `BookingStatusWidget/` | Action in the **existing right-hand slot** — the same one the "Certificate" button occupies at `BookingStatusWidget.tsx:88-95` |
| Detail modal | `BookingDetailModal/BookingDetailModal.tsx:60-61` | Footer action bar; its primary slot is the **placeholder "Reschedule" button**, which is the natural home for the acknowledgement |
| Bookings card | `BookingCard/BookingCard.tsx` | Same treatment; not covered by the UI draft, do not forget it |

**⚠️ `SHOWN_STATUSES` will hide the new states.**
`useBookingStatusWidget.ts:5` is `new Set(["pending","confirmed","completed"])` and
filters the list against it — so a `fulfilled`, `in_progress` or `returned`
booking **disappears from the dashboard entirely**, which is precisely when the
booker most needs to act on it. Highest-consequence one-line miss in the plan.

**Component separation:** `BookingStatusWidget` already has its
`useBookingStatusWidget.ts` hook — extend the hook, keep the `.tsx` a render
layer. The new acknowledgement control is small enough to live inside the
existing widget; do **not** spawn a new component directory for two buttons.
`BookingDetailModal.tsx` currently has no hook and holds no state; if the footer
gains mutation state, it needs a companion `useBookingDetailModal.ts` at that
point — not before.

---

### I6 — Vendor offering form: fulfilment pattern  ✅ DONE
**Files:** `vendor/services/offerings.service.ts` (hand-written interface + read/write), `vendor/components/offerings/` (form field)
A selector populated **from `fulfilment_patterns`** (`is_active`, by `sort_order`)
rather than a hardcoded two-option control — the point of B1's lookup table is
that a third pattern needs no form change. Render `name` + `description`; the
seeded descriptions are written to be shown to a vendor as-is.

**Do not label it "Service or Rental."** The pattern is a shape, not a business
category — an exam is a `session` and a hotel room is `custody`, and vendors in
EzzyLearn or EzzyStay will bounce off retail wording. Frame it by what the vendor
actually does, e.g. *"How is this completed?"* → *"I complete it, then the customer
confirms"* / *"The customer takes something and brings it back"*. Business
category remains the separate free-text `category` field, untouched.

Per the AGENTS.md invariant, the hand-written interface is updated here — there is
no `supabase gen types` in this repo.

**Migration ordering caveat:** every existing offering defaults to `'session'`.
Vendors with `custody` offerings must reclassify **before** the new flow behaves
correctly for them. Ship I6 in the same release as I3, not after.

---

### I7 — Notification types and trigger branches  ✅ DONE
**File:** new migration `20260801000007_fulfilment_notifications.sql`
Six new rows in `notification_type_settings` (following
`20260525000001:57-64`'s shape) and matching branches appended to
`notify_on_booking_status_change()`:

| Type | To | When |
|---|---|---|
| `booking_fulfilled` | booker | `confirmed → fulfilled` |
| `booking_started` | booker | `confirmed → in_progress` |
| `booking_returned` | vendor | `in_progress → returned` |
| `booking_completed` | vendor | `→ completed` (payout now releasable) |
| `booking_disputed` | counterparty + Command | `→ disputed` |
| `dispute_resolved` | both parties | `disputed → completed \| refunded \| cancelled` |

**One trigger, not two — a dividend of the flag-only trim (2026-07-31).** The
earlier full-workflow version needed a second `AFTER UPDATE` trigger on
`booking_disputes`, because `dispute_responded` fired on a flag-status change that
never moved the booking. With the response step gone, **every** remaining dispute
notification is a `bookings.status` transition, so the existing function carries
all six. The `booking_disputes` table needs no notification trigger at all.

**⚠️ Landmine — do not write `rejection_reason` in `resolve_booking_dispute`.**
The existing rejected-branch (`20260525000003:154`) is
`elsif new.status = 'cancelled' and new.rejection_reason <> ''` — it has **no
`old.status` guard**. So if the resolve RPC stashes its resolution notes in
`rejection_reason` (the obvious-looking choice, since the column is right there),
a `disputed → cancelled` resolution silently emails the booker **"Booking
Rejected"** with the internal dispute notes in the body. Resolution text belongs
in `booking_disputes.resolution_notes` only. Add a B8 assertion for this.

**Verify before building:** `booking_disputed` is addressed to "counterparty +
Command", but `notifications.user_id` is a single profile — confirm how the
existing Command-directed types (`vendor_pending_approval`,
`new_user_registration`, `20260525000001:63-64`) fan out to all Command admins,
and reuse that mechanism rather than inventing one.

**B9 interaction:** the undo transitions (`fulfilled → confirmed`,
`in_progress → confirmed`, `returned → in_progress`) must emit **no**
notification, and a re-fulfil after an undo must not re-send `booking_fulfilled`
to the same booker. Guard on the target status, not merely on "status changed",
or an indecisive vendor spams their booker.

**Critical, easy to break:** the existing function branches on
`new.rejection_reason <> ''` to tell *reject* from *cancel*
(`20260525000003:154,178`). The rewrite must preserve those three branches
verbatim. Email and push need **no** work — both dispatchers fire on `AFTER
INSERT ON notifications`, and the template registry falls back to `renderGeneric`.

---

### I8 — Command flag queue and resolution UI  ✅ DONE
**Files:** `command/services/` (new `disputes.service.ts`), `command/components/` (new area)
List of `open` flags with booking context and the raiser's reason, plus a resolve
action calling `resolve_booking_dispute` with an outcome and notes. Without this,
B7's flags have nowhere to be resolved and every flagged booking freezes
permanently — **this is the load-bearing half of flag-only**, since Command is the
only resolution path by design.

Reduced by the flag-only trim: no response thread to render, no per-party reply
state, one outcome control instead of a conversation.

**Component separation:** new `DisputeQueue/` (`.tsx` + `useDisputeQueue.ts` +
`.module.css`) and `DisputeResolutionPanel/` (same trio). The resolution panel
holds form state and the mutation — all of it in the hook.

**Operational note:** because Command is the sole resolver, the queue needs to be
somewhere staff actually look. Confirm it gets a nav entry with an unresolved
count, not a page reachable only by URL.

---

### I9 — Command payout release action  ✅ DONE
**Files:** new migration for `release_booking_payouts(p_transaction_ids uuid[])` RPC (Command-only, `releasable → released` + `released_at`), plus `command/` UI
Closes the loop: someone must be able to record that money actually went out.
Definer RPC keeps `booking_transactions` free of any `authenticated` write grant,
preserving B3's compromise.

**⚠️ Sizing correction (2026-07-31).** This item was written as "add a control to
Command's payout screen". **There is no payout screen on real data.** Command's
transactions page reads `ALL_TXNS` from `command/lib/constants.ts:67`
(`genTxns()`) — it is **entirely mock data**
(`components/transactions/TransactionsPage/useTransactions.ts:3,23`), and
`command/services/` has no bookings or transactions service at all. So I9 is
really three jobs, not one:

1. A real `command/services/transactions.service.ts` reading `booking_transactions`
   joined to `bookings` (Command's RLS SELECT policy already permits this —
   `20260725000002:178-184`, no schema work needed).
2. Replacing the mock-backed page with it — including `command/lib/types.ts:26`'s
   `status: "completed" | "pending" | "refunded"` union, which is a *mock
   transaction* shape unrelated to either `bookings.status` or `payout_status`.
3. Then the release control itself.

Step 1–2 is the bulk of it and is a prerequisite for **I13** as well. Treat I9 as
the largest remaining app item after I3; do not schedule it as a quick add-on.

**Must support bulk release** *(found on review)* — a real payout run settles a
whole vendor's `releasable` transactions for a period at once. A one-row-at-a-time
action is unusable at the first month-end and will be worked around by hand in
SQL, which is worse. Signature:
`release_booking_payouts(p_transaction_ids uuid[])`, all-or-nothing in one
transaction, skipping any row not currently `releasable`.

**Labelling:** per D5, `reversed` renders as **"Vendor payout reversed"**, never
"Refunded" — it says nothing about whether the booker got their money back.

**Scope boundary:** this records the release. It does **not** move money —
disbursement is out of scope by decision (2026-07-31).

---

### I10 — Release communication  ✅ DONE
**Files:** none — process.
Two user-visible behaviour changes ship together and will generate support load
if unannounced: (a) vendors' "Total Payout" **drops**, because confirmed-but-not-
fulfilled bookings stop counting (I4); (b) vendors must now take an explicit
action per booking before they are owed anything. Draft vendor-facing notice
before release.

---

### I11 — Documentation  ✅ DONE
**Files:** `architecture/schema.md`, `architecture/booking-flow.md`
- `schema.md:424` — replace the three-line transition list with the full
  actor-aware matrix.
- `schema.md:507-518` — amend the `booking_transactions` immutability wording per
  B3's resolved divergence: financial figures immutable, payout lifecycle mutable
  and trigger/definer-written.
- `schema.md` migration table — add the seven new migrations, plus a
  `fulfilment_patterns` table section alongside `divisions`, documenting that it
  carries **no behaviour**: a row without a matching branch in
  `validate_booking_status_transition()` is inert by design.
- `booking-flow.md:298-312` "Known Gaps" — the `Cancellation / reschedule` row
  and the wallet/payment row both need updating.
- New section documenting the dual-acknowledgement flow end to end.

---

### I12 — Unpaid bookings run the whole machine and produce nothing  ✅ DONE
**Files:** `vendor/components/bookings/` (I3's action component), B3's trigger
*(Found on review.)* `booking_transactions` exists only where `is_paid` went
false→true (`20260725000002:149-151`). A booker who abandons PayMongo checkout
leaves a `pending`, unpaid booking (`architecture/booking-flow.md:187`) — and
nothing stops the vendor confirming, fulfilling and completing it. B3's sync
trigger then updates **zero rows, silently**, and the vendor has delivered a
service they will never be paid for.

**Fix approach:** do **not** block the transitions — a vendor may legitimately
honour a booking and chase payment separately, and blocking would strand the
booking with no exit. Instead make it *visible*: surface an unmistakable "Not
paid" marker on the vendor's booking detail beside the fulfilment actions, and
require a confirm step on `confirmed → fulfilled` / `confirmed → in_progress`
when `is_paid = false`. Cheap, and it converts a silent loss into a decision.

**Verification:** manual — fulfil an unpaid booking, assert no
`booking_transactions` row appears and the warning rendered.

> **⚠️ CORRECTION (2026-08-01) — this was marked ✅ when only half had shipped.**
> The "Not paid" chip existed and rendered; the **confirm step this item also
> required did not** — `doFulfil` fired straight through on a single click. The
> original ✅ rested on seeing the chip in the `/ui-gallery` fixture, which never
> exercised the interaction. The chip is the warning; the confirm step is the
> protection, and only the warning had been built.
>
> **Completed 2026-08-01** under
> `.plans/2026-08-01-fulfilment-premature-completion.md` **I1**: an unpaid
> `confirmed` booking now expands an inline confirmation ("no payout will ever be
> created for it — <action> anyway / Cancel") before the vendor commits work.
> **Verified:** `tsc` 0, `build` 0, and the branch simulated across 8 combinations
> — paid stays one tap, unpaid `confirmed` takes two, `returned` and `pending`
> unaffected.
>
> **Deliberate narrowing:** the confirm applies only to the two `confirmed → …`
> moves, not to `returned → completed`. By then the vendor has handed over and
> already been prompted once; a second prompt at the finish line is nagging rather
> than protective.

---

### I13 — Refunded-after-released has no clawback surface  ✅ DONE
**Files:** `command/` payout screen (I9)
*(Found on review.)* B3's sync trigger deliberately never downgrades `released`
(the comment says so, and that is the right call — a trigger must not pretend
money came back). The consequence is unhandled: a booking refunded *after* its
payout was released keeps `payout_status = 'released'` forever, and **nothing
anywhere shows Command that the platform is owed money by a vendor.**

**Fix approach:** no new state. Command's payout screen gains a filter for the
mismatch — `booking_transactions.payout_status = 'released'` joined to
`bookings.status in ('refunded','cancelled')` — as an "owed back" list. Read-only
reconciliation; recovering the money is a business process, not a schema problem.

**Coupling:** ships with **I9**; the join is the same query — and **blocked by
I9's step 1**, since there is no real transactions data path in Command today.

---

### I14 — Seed data must exercise the new states  ✅ DONE
**File:** `backbone/supabase/seed.sql`
*(Found on review — not mentioned anywhere in the original plan.)* Seed currently
cannot produce a booking in `fulfilled`, `in_progress`, `returned` or `disputed`,
so `supabase db reset` gives a local environment where none of this feature is
visible and none of the new UI can be developed against real rows.

Add at least one `custody` offering (`fulfilment_pattern = 'custody'`), bookings parked
in each new state, and one open flag. **Note the existing hazard:** seed
disables `notifications_dispatch_email` and the push trigger around Block 8
(`20260624000003` header, `20260728000001:35`) — seeded status changes will fire
the *booking* notification triggers, so either seed statuses before those triggers
matter or extend the same disable pattern.

**⚠️ Escalated 2026-07-31 — seed must also repair what INSERT-only seeding skips.**
Established while closing B0: migrations run against empty tables on
`supabase db reset`, so B1/B3 backfills are no-ops; then `seed.sql` **INSERTs**
bookings at their final status (`:621`, `:957`, `:983`) rather than transitioning
them. B3's `bookings_sync_payout_status` is `AFTER UPDATE OF status`, so an INSERT
never fires it. Consequences a reset currently produces:

| Symptom | Cause |
|---|---|
| 11 `completed` bookings with `payout_status = 'held'` | sync trigger never fired |
| `status_changed_at` NULL on every booking | set by B2's BEFORE UPDATE trigger |

Both make I4 / I9 / I13 look broken in dev when they are correct. **This is now
part of I14, not an afterthought.** Two options, decide at execution:
**(a)** have seed set `status_changed_at` and the correct `payout_status`
explicitly in Block 9 — direct, matches how seed already writes ledger state; or
**(b)** have seed INSERT bookings at `confirmed` and then `UPDATE` them into their
final statuses, letting the real triggers do the work — more faithful, but the
UPDATEs run as `postgres` where `auth.uid()` is NULL, which B2 treats as the
*system* actor, so `confirmed → completed` would be rejected and the seed would
have to walk each intermediate state. **Recommend (a).**

**Verification for this addition:** after `npx supabase db reset`, assert no booking
has `status_changed_at IS NULL`, and no `completed` booking has a transaction
still `held`.

**Sequencing — I14 cannot be written before B1/B3.** It populates
`fulfilment_pattern`, `status_changed_at` and `payout_status`, none of which exist
until those migrations land. It ships **inside the Stage 1 batch**, immediately
after B5 and before B8, not as separate preparatory work.

---

### I15 — Command notification plumbing for the six new types  ✅ DONE
**Files:** `command/lib/types.ts:86-93`, `command/components/layout/NotificationPanel/NotificationItem.tsx:10-13`, `command/components/settings/NotificationSettingsPage/NotificationSettingsPage.tsx:7-10`
*(Found on review — the plan listed Command's status colour map but missed all
three of these.)* Command is where notification types are **administered**, so
I7's six new types surface here whether or not Command receives them:

- `NotificationType` union is a closed literal union — adding rows to
  `notification_type_settings` without widening it means the Settings page renders
  types TypeScript says cannot exist.
- `NotificationItem.tsx`'s icon/colour map is keyed by type; a miss renders an
  unstyled row in Command's own notification panel (Command *does* receive
  `booking_disputed`).
- `NotificationSettingsPage.tsx:7-10` maps type → audience label ("Booker",
  "Vendor"). New types get a blank audience column — the admin toggling them
  cannot tell who they reach.

Cheap, but invisible until a Command admin opens Settings and finds six unlabelled
switches. Ships with **I7**.

---

### I16 — Make Command's override explicit, not silent impersonation  ✅ DONE
**Files:** B2's trigger, `20260516000006`'s `log_booking_status_change()`, `command/` UI
*(Found on review — the most significant Command finding.)* B2 lists `v_command`
as an alternative actor in **nearly every branch**, including `fulfilled →
completed` and `returned → completed`. A Command admin can therefore single-
handedly push a booking to `completed`, which makes money `releasable`.

**That quietly breaks the invariant this whole plan exists to establish.** Once
shipped, `bookings.status = 'completed'` means one of two very different things —
*both parties agreed* or *an admin decided* — and nothing distinguishes them.
`booking_status_log.changed_by` records *who*, but no consumer reads it, and
neither the vendor's payout view nor the booker's history shows that a third party
moved their booking.

**Fix approach — keep the capability, stop it being silent.** Support genuinely
needs to unstick bookings (a vendor abandons their account mid-rental; a booker is
unreachable and the flag queue would otherwise grow forever). So do not remove
`v_command`. Instead require a reason and make it legible:

- `booking_status_log.notes` **already exists and is never written**
  (`20260516000006:24`; the trigger at `:86-89` inserts without it). Use it.
- Command's status writes go through an override RPC that does
  `perform set_config('app.status_change_note', p_reason, true)` before the
  UPDATE; extend `log_booking_status_change()` to read
  `coalesce(current_setting('app.status_change_note', true), '')` into `notes`.
  Transaction-local (`true`), so it cannot leak between statements.
- Require a non-empty reason for any Command-actor transition that is **not**
  `disputed → *` (dispute resolution already carries `resolution_notes`).
- Surface it: vendor and booker booking detail show "Adjusted by Ezzy support —
  <reason>" wherever the log holds an override.

**Blast radius:** touches the same two triggers B2/B3 already rewrite, so no
additional migration if folded into Stage 1. `notes` is `not null default ''`, so
every existing row and every non-override write is unaffected.

**Coupling:** fold the trigger half into **B2**; the RPC and UI half can follow in
Stage 5. Add a B8 assertion that a Command transition without a reason raises.

---

### I17 — Command oversight of the fulfilment pipeline  ✅ DONE
**Files:** `command/services/` (new bookings read), `command/components/overview/`
*(Found on review.)* Command has **no bookings service and no bookings UI at all**
today — the whole area is absent from `command/services/` and `command/components/`.
That was fine when booking status was inert. It is not fine now, because two new
states have no watcher:

- **`in_progress` has no timer by design.** B6 deliberately never auto-advances it
  (an asset that never came back must not auto-complete) — correct, but the
  consequence is that a rental whose booker vanishes **sits frozen forever with the
  vendor's money held, and nothing tells anyone.** The vendor can raise a flag, but
  only if they happen to notice. This is the single state in the machine with
  neither a timer nor an escalation.
- **Auto-acknowledged completions release money with no human involved** (B6).
  Nobody can currently see how often that happens or on what value.

**Fix approach:** a read-only oversight panel, not a management surface —
- bookings in `in_progress` beyond a threshold (start at 14 days, tune later),
  ordered oldest first;
- count and value of auto-acknowledged completions over a period, from
  `booking_status_log` where `changed_by is null`;
- open flag count (shares I8's query).

Deliberately **read-only**: acting on any of it is I8 (resolve) or I16 (override),
both of which already exist. Do not build a third write path.

**Verification:** manual — backdate an `in_progress` booking and confirm it
surfaces.

---

### I18 — Action copy as one source of truth  ✅ DONE
**Files:** new `vendor/lib/bookingActionCopy.ts`, new `booker/lib/bookingActionCopy.ts`
The same wording is needed in **three** places — the button, its "i" explanation
(I19), and the dashboard guide (I20). Written three times it drifts, and the drift
is on copy that tells people **when money moves**. Define it once per app:

```ts
export interface BookingActionCopy {
  key:     BookingActionKey            // 'vendor_fulfil' | 'booker_return' | …
  label:   string                      // button text — casual
  meaning: string                      // "i" popover body — comprehensive
  pattern: FulfilmentPattern | "both"  // which shape it applies to
}
```

Proposed copy — casual label, meaning that always states the money consequence.
**Copy is not final**; this table is the thing to edit, and editing it updates all
three surfaces at once.

*Vendor (`vendor/lib/bookingActionCopy.ts`):*

| key | label | meaning |
|---|---|---|
| `vendor_fulfil` | **Mark as done** | "Tells the customer you've finished. They'll be asked to confirm — if they don't within 3 days, it confirms automatically." |
| `vendor_start` | **Hand over** | "Starts the booking. The item or space is with the customer until they return it." |
| `vendor_confirm_return` | **Got it back** | "Confirms everything came back as expected. This is the last step — your payout becomes available once you tap it." |
| `vendor_undo` | **Undo** | "Puts this back a step. You can redo it anytime, but the customer's 3-day window starts over." |
| `vendor_dispute` | **Something's wrong** | "Puts the booking on hold and asks Ezzy to step in. No payout is released until it's sorted." |

*Booker (`booker/lib/bookingActionCopy.ts`):*

| key | label | meaning |
|---|---|---|
| `booker_confirm_done` | **Yes, all done** | "Confirms the vendor finished. This releases their payment, so only tap it if everything went as expected." |
| `booker_return` | **I've returned it** | "Lets the vendor know you've brought it back. They'll check it over and confirm." |
| `booker_undo` | **Undo** | "Changes your mind about the last step. The vendor hasn't confirmed yet, so nothing is lost." |
| `booker_dispute` | **Something's wrong** | "Puts the booking on hold and asks Ezzy to look into it. The vendor won't be paid until it's sorted." |

**Two copies, not a shared package** — these are separate git repos with no shared
build tooling (root `AGENTS.md`, "They are not a monorepo"). Inventing a shared
module here would be the first cross-repo dependency in the workspace, which is
far more than this earns. The wording differs per audience anyway.

**Coupling:** **I3** and **I5** must read labels from here rather than hardcoding
the strings currently written into those items.

> **✅ DONE (2026-07-31).** Created `vendor/lib/bookingActionCopy.ts` (5 actions)
> and `booker/lib/bookingActionCopy.ts` (4 actions), each exporting
> `BookingActionKey`, `BookingActionCopy`, `BOOKING_ACTIONS` and an `actionCopy()`
> lookup. Copy is exactly the table above.
> **Deviation from the written item:** the interface references
> `FulfilmentPattern`, which did not exist — B1/I6 create the *column*, not the
> TS type. Added `export type FulfilmentPattern = "session" | "custody"` to
> `vendor/lib/types.ts:2-6` and `booker/lib/types.ts:2-6` rather than defining a
> domain type inside a copy module. `BookingStatus` was **not** touched — widening
> it is I1, in Stage 2, and the copy module deliberately does not reference status
> at all, which is what keeps Stage 0b independent of the schema.
> **Verified:** `npx tsc --noEmit` exit 0 and `npm run build` exit 0, both apps.

---

### I19 — "i" info affordance on every action  ✅ DONE
**Files:** new `vendor/components/ui/InfoTip/`, new `booker/components/ui/InfoTip/`
A small `Info` icon beside each action button; **clicking** it reveals that
action's `meaning` from I18.

**Click, not hover, is correct here** — both apps are PWAs
(`.plans/2026-07-18-booker-vendor-pwa-readiness.md`) and hover tooltips do not
open on touch at all. Radix **Popover** is the right primitive; Radix **Tooltip**
is hover/focus-driven and would silently fail on phones.

**Already available in vendor — no new dependency.** `@radix-ui/react-popover` is
already in `vendor/package.json:17` and already used directly (not via a shadcn
wrapper) at `vendor/components/ui/Combobox/Combobox.tsx:3,30-70` and
`vendor/components/layout/Sidebar/Sidebar.tsx:3,97-108`. Follow that established
pattern rather than adding a `ui/popover.tsx` scaffold.

**Booker: ✅ resolved and installed (2026-07-31).** Booker previously had only an
unused `@radix-ui/react-tooltip` and an unimported `ui/dialog.tsx` scaffold.
`@radix-ui/react-popover@1.1.23` is now in `booker/package.json:18` — approval
gate cleared, `tsc --noEmit` clean. Both apps therefore use the **same primitive**;
write booker's `InfoTip` against the vendor pattern in `Combobox.tsx`, not against
`ui/dialog.tsx`.

*Version note:* vendor's manifest says `^1.1.4` and booker's says `^1.1.23`. Both
carets resolve to the same 1.x release, so this is cosmetic — align the strings
only if a reviewer wants the two manifests to read identically.

**Component separation:** `InfoTip.tsx` is a **pure display component and needs no
companion hook** — an uncontrolled `Popover.Root` owns its own open state, so the
file has no `useState`, no `useEffect` and no handlers of ours. It falls under the
explicit exception in `.claude/skills/component-separation/SKILL.md`. Do not add a
`useInfoTip.ts` to satisfy the rule mechanically.

**Styling:** match the local idiom — both `GuidePanel.tsx` and `Combobox.tsx` use
Tailwind utility classes inline, **not** `.module.css`. AGENTS.md permits "shared
Tailwind tokens/utilities"; introducing a lone `.module.css` into a
Tailwind-classed area would be the inconsistency, not the fix.

**Accessibility** (per `.claude/skills/ux-design/SKILL.md`): `aria-label` naming
the action ("What does *Mark as done* mean?"), keyboard-reachable trigger, focus
returned on close, and a **≥24px touch target even though the glyph is ~12px**.
Light/dark parity on the popover surface.

**Density concern, flagged not fixed:** with two or three actions visible at once,
three info glyphs in a row can read as clutter. Mitigation if it looks noisy in
review — attach the "i" only to the primary action and let I20's guide carry the
rest. Decide from the built screen, not in advance.

**Coupling:** consumes **I18**; rendered inside **I3** and **I5**.

> **✅ DONE (2026-07-31).** Created `vendor/components/ui/InfoTip/` and
> `booker/components/ui/InfoTip/`, each `InfoTip.tsx` + `InfoTip.module.css`.
> Props are plain `label` / `meaning` strings, **not** a `BookingActionCopy`, so
> the component stays reusable outside the booking flow (interface segregation).
> **No companion hook** — an uncontrolled `Popover.Root` owns the open state, so
> neither file has `useState`, `useEffect` or a handler of its own.
>
> **Correction to this item's own guidance.** It said to use Tailwind classes and
> *not* a `.module.css`, reasoning from `GuidePanel`. Wrong scope: that is the
> convention in `components/dashboard/`, but inside `components/ui/` the local
> precedent is `Combobox/Combobox.module.css`. Followed the directory it lives in.
> Both apps have `.module.css` precedent (vendor 7 files, booker 2).
>
> **Accessibility:** the item specified a ≥24px target; `.claude/skills/ux-design`
> requires **44×44**. Resolved in favour of the skill — the control is 22px in
> layout with `.trigger::after { inset: -11px }` giving a true 44×44 hit area
> without widening the row. Also `aria-label` naming the action, `:focus-visible`
> ring, and `aria-hidden` on the decorative glyph.
>
> **Mounted in both `/ui-gallery` fixtures** so it is reviewable now rather than
> dead code until Stage 2: `vendor/app/ui-gallery/page.tsx` (new `InfoTip` Tile in
> the leaf-component grid) and `booker/app/ui-gallery/page.tsx` (new
> `mode=infotip`), with `"infotip"` added to `booker/visual-tests/pilot.spec.ts:12`.
> **Verified:** `tsc --noEmit` and `npm run build` exit 0 both apps.
> **Not verified — needs a browser:** that the popover actually opens on click and
> on keyboard, and reads correctly in dark mode. Build success does not prove it.

---

### I20 — Booking actions section in the dashboard guide  ✅ DONE
**Files:** `vendor/components/dashboard/GuidePanel/guideItems.ts`, `booker/components/dashboard/GuidePanel/guideItems.ts`, both `GuidePanel.tsx`
The right-hand dashboard guide panel gains a section explaining the fulfilment
actions. **Cheaper than expected** — both apps already have exactly the right
structure, and it is identical across them:

- `guideItems.ts` exports `GUIDE_ITEMS: GuideItem[]` of `{Icon, title, body, color}`
- `GuidePanel.tsx` is already a **pure render layer** mapping over it, no hook,
  mounted right-column at `vendor/…/DashboardPage.tsx:84` and
  `booker/…/DashboardPage.tsx:63`

So most of this is one new array entry per app. The one structural change: a
single prose `body` cannot clearly explain four or five distinct actions, so
extend the interface with an **optional** field and render it when present:

```ts
export interface GuideItem {
  Icon:  LucideIcon
  title: string
  body:  string
  color: string
  actions?: { label: string; meaning: string }[]   // ← new, optional
}
```

Optional means the four existing items in each app are **untouched** — no
migration of existing copy, no risk to the current panel.

The `actions` array is built from **I18's table**, not retyped — that is the whole
point of I18. Vendor's entry covers `vendor_*`; booker's covers `booker_*`.

Suggested entry — vendor: title *"Completing a Booking"*, `Icon: CheckCircle2`,
`color: "#10b981"`, body explaining that a booking is only finished when both
sides agree and that the payout follows. Booker: title *"Finishing Your Booking"*,
same icon/colour, body explaining that confirming releases the vendor's payment.

**Component separation:** `GuidePanel.tsx` stays a pure render layer with **no
hook** — rendering an optional list adds no state. Keep the Tailwind-class styling
already in the file.

**⚠️ Visual baselines.** Both apps have `playwright.config.ts` and a `/ui-gallery`
fixture, and booker mounts `GuidePanel` there directly
(`booker/app/ui-gallery/page.tsx:142`). Changing the panel **will** fail the
snapshot tests until baselines are regenerated — expected, not a defect. Vendor's
gallery does not currently mount `GuidePanel`; adding it is optional.

**Redundancy is the point:** the guide is the non-modal way to learn what the
actions mean, so I19's popover is never the *only* route to the explanation —
which is also what keeps I19's density mitigation cheap.

**Coupling:** consumes **I18**. Independent of the schema — **I20 can be built and
reviewed before Stage 1 lands**, against the existing panel.

> **✅ DONE (2026-07-31).** `GuideItem` gained the optional `actions?` field in
> both `guideItems.ts` files; the four existing items in each app are untouched.
> New entries: vendor *"Completing a Booking"*, booker *"Finishing Your Booking"*,
> both `CheckCircle2` / `#06b6d4` (a hue unused by either app's existing four).
> Each entry's `actions` is `BOOKING_ACTIONS.map(...)` — **derived from I18, not
> retyped**, which was the whole point of I18.
> Both `GuidePanel.tsx` files render the list only when present and stay pure
> render layers with no hook. Styling is Tailwind classes, matching those files.
> **Verified:** `tsc --noEmit` and `npm run build` exit 0 both apps.
> **⬜ Outstanding:** Playwright visual baselines have **not** been regenerated —
> the `guide` snapshots in both apps will fail until they are, and booker's new
> `infotip` mode has no baseline at all. Expected, not a defect; regenerate and
> review the diff rather than accepting blind.

---

### I21 — Bookings filter: 5 tabs cannot become 10  ✅ DONE
**Files:** `vendor/components/bookings/BookingsPage/BookingsPage.tsx:13`, `vendor/components/bookings/BookingsPage/useBookings.ts`, new grouping const in `vendor/lib/`
*(Found while drafting the UI, 2026-07-31 — not previously in the plan.)*

`BookingsPage.tsx:13` is
`const FILTERS = ["all","pending","confirmed","completed","cancelled"] as const`
— five tabs rendered as a fixed, non-scrolling segmented control
(`BookingsPage.tsx:22-38`). After B2 there are **nine** statuses, so one-tab-per-
status is ten controls in a bar that already fills its row at five. It will wrap or
overflow on every laptop, and most of the new tabs would show near-zero counts.

**Fix approach — group by what the vendor must do**, which is what the existing
pending-count badge (`BookingsPage.tsx:33-35`) already implies the page is for:

| Tab | States | Badge |
|---|---|---|
| All | *(everything)* | — |
| **Needs you** | `pending`, `returned` | count, styled like today's pending badge |
| Active | `confirmed`, `fulfilled`, `in_progress` | — |
| Done | `completed` | — |
| Issues | `disputed` | count when > 0 |
| Closed | `cancelled`, `refunded` | — |

Six controls where ten do not fit, and the two that carry badges are the two that
represent work.

**Honest tradeoff:** grouping removes single-status filtering. The one that could
be missed is `in_progress` — *"what is out right now"* is a real question for a
custody vendor, and it is buried under "Active". **Do not solve it by adding a
seventh tab.** If vendors ask, add a secondary control within the group; the tab
bar is the constrained resource here.

**Where the mapping lives:** one exported const beside the status maps in
`vendor/lib/` — **not** inline in `BookingsPage`. Mobile needs the same grouping
(see coupling), and a second copy would drift.

**Coupling — `ezzy-vendor-mobile`.** `src/components/bookings/BookingFilterTabs/`
has the same problem, but *not* the same constraint: mobile renders its chips in a
horizontal `ScrollView`, so it can physically hold more. It should still adopt the
same grouping for consistency. Note that
`.plans/2026-07-31-vendor-mobile-filter-density.md` (COMPLETE) has just finished
tuning those chips — its root cause was `flexGrow: 1` on the `ScrollView` base
style stretching them. **Do not re-litigate that sizing work when adding groups.**
Deferred with the rest of mobile under **D3**.

**Not a booker problem.** Booker has no booking filter tabs at all — its
equivalent is the `SHOWN_STATUSES` set handled in **I5**. Command has no bookings
UI (see I17).

**Verification:** all six tabs render without wrapping at 1280px and at 768px; each
group's count matches a direct query for its member statuses.

---

## DEFERRED / COSMETIC

- **D1 — Actual disbursement (PayMongo Platforms).** Out of scope by decision
  (2026-07-31). Acceptable because `releasable` + `released` gives a complete,
  auditable manual payout process; automating the transfer is a self-contained
  follow-up that changes no state machine.
- **D2 — Fuller dispute workflow + file evidence.** Deferred by decision
  (2026-07-31, revised same day to absorb the response step). Three things land
  together when this returns, because they are only useful together:
  1. **Photo/file evidence** — a Storage bucket with per-dispute upload policies,
     size/type limits, upload UI on both sides. The reason to build this at all:
     rental damage claims are close to unarguable without photos.
  2. **Counterparty response** — `counterparty_response` / `responded_at` columns,
     a `responded` CHECK value, a `respond_to_booking_dispute` RPC, and a second
     notification trigger on `booking_disputes` (see I7).
  3. **Self-service withdrawal** — a `withdrawn` CHECK value and a raiser-only RPC
     returning the booking to its pre-dispute status, read from
     `booking_status_log` (the row whose `to_status = 'disputed'` carries
     `from_status`) rather than a new column.

  **Acceptable for v1 because** flag-only still freezes the money correctly and
  still gives both parties a route in; only the *resolution* is manual. B7's table
  is a strict subset of the target shape, so this is additive — nothing built now
  is undone later.

  **Unblock condition:** Command's flag volume becomes large enough that manual
  resolution is the bottleneck — measure it from I8's queue before building.
- **D3 — Mobile apps** (`ezzy-booker-mobile`, `ezzy-vendor-mobile`). Deferred by
  decision (2026-07-31) to prove the state machine on one client pair first.
  **Unblock condition:** B1–B8 applied and I1–I9 shipped on web.

  **✅ Pre-check DONE (2026-07-31) — no crash risk, mobile is safe to leave behind.**
  Verified by reading the maps and every consumer:
  - `tokens.status` is typed `Record<string, {bg,fg}>`
    (`ezzy-vendor-mobile/src/theme/tokens.ts:98`) — **loosely typed, so unlike the
    web apps it will NOT raise a compile error** when new statuses appear. The
    safety comes from the consumers, not the type.
  - All three consumers already fall back:
    `BookingListItem.tsx:23` and `BookingDetail.tsx:37` and
    `TransactionListItem.tsx:19` each do
    `tokens.status[x] ?? { bg: tokens.pillBg, fg: tokens.text }`. An unknown status
    renders as a neutral pill. **No undefined access, no crash.**
  - Cosmetic only: the label is `s.charAt(0).toUpperCase() + s.slice(1)`
    (`BookingListItem.tsx:85`, `BookingDetail.tsx:47`), so `in_progress` renders as
    **"In_progress"** — underscore visible, no space. Ugly, harmless, fixed by D3.

  **Correction to this item's own earlier wording:** it warned about *"both mobile
  apps"*. **`ezzy-booker-mobile` is not affected at all** — 19 files in `src/`,
  zero occurrences of `status`, no bookings surface. It is a scaffold, exactly as
  root `AGENTS.md` describes. Only `ezzy-vendor-mobile` renders booking status.
- **D6 — ⚠️ Both apps' `npm run lint` is broken, pre-existing.** Found while
  verifying Stage 0b (2026-07-31); **not caused by it** — neither app's ESLint
  config nor lint script was touched.
  - `vendor`: `"lint": "eslint"` dies in `@eslint/eslintrc` config-schema
    validation while resolving an extended shareable config.
  - `booker`: `"lint": "next lint"` fails with *"Invalid project directory
    provided, no such directory: booker/lint"* — `next lint` was removed in
    Next 16 (both apps are on `next: ^16.2.4`), so the script is stale.

  **Consequence for this plan:** lint cannot be part of any item's verification.
  `tsc --noEmit` and `next build` both pass and are what has been used instead.
  Neither `next.config.ts` sets `eslint.ignoreDuringBuilds`, so builds are not
  silently skipping a working linter — the linter simply does not run at all.

  **Out of scope deliberately** (unrelated to fulfilment, touches build tooling in
  two apps). Worth its own small task: migrate booker to `eslint` flat config like
  vendor, then fix vendor's extends chain. `command` not checked.

- **D8 — No Command CRUD for `fulfilment_patterns`, deliberately** (decided
  2026-08-01). `20260801000001` grants Command admin/root full CRUD on the table
  at the RLS level, and there is **no UI** — that asymmetry is intentional, not an
  oversight, so do not "complete" it later without re-reading this.

  **Why:** a pattern row carries no behaviour. The state machine that enforces each
  shape lives in `validate_booking_status_transition()`. A row added through a UI
  would be taggable on offerings but every fulfilment transition on it would raise
  — an inert, broken option with no feedback explaining why. Adding a pattern is a
  deploy (seed row **plus** a trigger branch **plus** app labels), and a CRUD screen
  would advertise otherwise. Contrast `divisions`, which is pure taxonomy with no
  behaviour attached and correctly *does* have a Settings CRUD page.

  **If it ever earns a screen**, the honest slice is read-only: list the patterns
  and their descriptions, plus the `is_active` toggle so Command can retire one
  from new offerings without a deploy. Not create/delete.

  **Also note:** `offerings.category` remains **free text** (`text not null
  default ''`, unchanged since `20260506000001`), surfaced as a datalist typeahead
  in the vendor form. Category and pattern are independent axes — business label vs
  who acknowledges completion — and the seed's use of "session"/"rental" as
  category values makes them look related when they are not.

- **D4 — Booker-initiated cancellation.** Still absent
  (`architecture/booking-flow.md:307`). Untouched here — a booker can neither
  cancel a `pending` booking they regret nor a `confirmed` one they cannot attend.
  Acceptable only because it is a pre-existing gap this plan does not worsen;
  it is genuinely user-hostile and should be its own plan. **Unblock condition:**
  needs a refund policy first (see D5) — there is no point letting bookers cancel
  paid bookings while no money can travel back to them.

- **D5 — ⚠️ `reversed` does not mean the booker was refunded.** Verified: the
  entire payment surface is `booker/app/api/payment/create-session` and
  `.../webhook`. **PayMongo's refund API is never called anywhere in the
  codebase**, and `refunded` is a display-only status in all three web apps. So
  today, a paid booking that a vendor cancels leaves the booker's money with the
  platform, with nothing tracking that it is owed back.

  This plan does not create that gap, but it does make it more visible by
  introducing `payout_status = 'reversed'` on exactly those transitions. **The
  word means "the vendor will not be paid this" — it says nothing about the
  booker.** Do not let the ledger's wording imply a refund happened.

  Mitigations required *within this plan* (cheap, do not defer):
  - `comment on column ... payout_status` must state this explicitly, so nobody
    reads `reversed` as "money returned". Fold into B3.
  - Command's payout screen (I9) must label it "Vendor payout reversed", never
    "Refunded".

  **Unblock condition for the real fix:** a refund plan of its own — PayMongo
  refund API integration, a `booking_refunds` ledger, and a policy for who may
  authorise one. Materially larger than it sounds, and a prerequisite for D4.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains. -->

- Booker's click-to-open overlay for I19's "i" icon → **add
  `@radix-ui/react-popover` to booker** (resolved 2026-07-31) — one small package,
  identical primitive to vendor, correct touch and keyboard behaviour. Rejected:
  the existing `ui/dialog.tsx` (a modal is heavy for a one-line definition and
  diverges from vendor) and the already-installed `@radix-ui/react-tooltip`
  (hover/focus-driven, so it would not open on touch — defeating the request on
  the app most likely to be used on a phone).
  **✅ EXECUTED (2026-07-31)** — installed at `1.1.23`, `booker/package.json:18`.
  Verified: `npx tsc --noEmit` exit 0; `package-lock.json` gained only the 21 new
  radix packages, **no existing dependency version changed** (the lock's 56 deleted
  lines were stale `name`/`version` metadata — `RS Learner 0.9.0` → `Ezzy Booker
  0.10.1` — that npm resynced from `package.json`). This is the only part of this
  plan that has been executed.

- Scope of the money side → **Fulfilment state + payout eligibility only; no
  automated disbursement** (resolved 2026-07-31) — keeps the plan free of a
  PayMongo Platforms onboarding dependency while still gating the money.
- Rental completion symmetry → **Vendor confirms the return**
  (resolved 2026-07-31) — `confirmed → in_progress → returned → completed`;
  protects the vendor against damage or non-return before payout releases.
- Booker never acknowledges → **Auto-acknowledge after 3 days** (resolved
  2026-07-31) — applies to `fulfilled` and `returned` only; never to
  `in_progress`.
- Dispute depth → ~~Full workflow, text-only, no attachments~~ → **revised to
  flag-only** (resolved 2026-07-31, revised 2026-07-31) — either party raises a
  flag with a reason, payout freezes, Command resolves. No counterparty response,
  no self-service withdrawal. Rationale for the revision: full-workflow-without-
  evidence was incoherent — it handled service disputes well and rental damage
  claims (where disputes will actually originate) poorly, while costing the
  largest single block of app work in the plan. Flag-only + evidence-later is the
  smaller, more coherent v1; D2 now carries both the response step and
  attachments as one follow-up. **Dividend:** the second notification trigger on
  `booking_disputes` is no longer needed (see I7).
- Payout state location → **`payout_status` column on `booking_transactions`**
  (resolved 2026-07-31) — financial figures stay immutable, lifecycle is
  explicitly mutable; `architecture/schema.md` amended in I11 rather than
  silently diverged from.
- App coverage → **Backbone + web apps first, mobile as D3** (resolved
  2026-07-31).
- Fulfilment discriminator → **`fulfilment_patterns` lookup table, shape-based
  names (`session` / `custody`)** (resolved 2026-07-31) — replaces the earlier
  `fulfilment_type text check (in ('service','rental'))`. Business taxonomy
  (`offerings.category`, `divisions`) and fulfilment shape are separate axes;
  naming the discriminator after two businesses made a structural distinction look
  taxonomic. Thirteen divisions collapse to two shapes. Lookup table follows the
  `divisions`/`statuses`/`roles` idiom so a third shape is a seed row plus a
  trigger branch, not an `ALTER` against a CHECK on two tables. **The machine
  itself stays in code** — see B1's warning against a data-driven workflow engine.
- Naming for the custody start action → **`in_progress`, labelled "Start rental"**
  (resolved 2026-07-31) — industry terms are check-out/handover
  ([field service guide](https://fieldservicesoftware.io/equipment-rental-software/)),
  but "Start rental" is unambiguous to a non-specialist vendor. Service
  counterpart is `fulfilled`, labelled "Mark as complete", leaving `completed` to
  mean *both parties agreed* — matching the "completely fulfilled" framing.
- Scheduler mechanism → **`pg_cron`, with a documented Next.js-route fallback**
  (resolved 2026-07-31) — smallest correct option; no new deploy target. See B6.

---

## Execution order

Per `.claude/skills/developerboss/SKILL.md`, **one stage at a time** unless a
range is explicitly requested.

### At a glance

| Stage | Theme | Items | Gate to enter | Status |
|---|---|---|---|---|
| **0** | Verify — read-only, no writes | B0 ✅ · pg_cron check 🔄 · D3 pre-check ✅ | none — safe now | 🔄 2 / 3 |
| **0b** | Copy & guide — no schema dependency | I18 ✅ · I20 ✅ · I19 ✅ | none — safe now | ✅ 3 / 3 |
| **1** | Schema core — one coupled batch | B1 ✅ B2 ✅ B4 ✅ B9 ✅ B3 ✅ B5 ✅ B8 ✅ I14 ✅ | Stage 0 complete | ✅ 8 / 8 |
| **2** | Web apps — happy path | I1 ✅ I2 ✅ I3 ✅ I21 ✅ I6 ✅ I4 ✅ I12 ✅ I5 ✅ | B8 matrix green | ✅ 8 / 8 |
| **3** | Automation | B6 ✅ I7 ✅ I15 ✅ | Stage 2 shipped | ✅ 3 / 3 |
| **4** | Dispute flag — independently sequenceable | B7 ✅ I8 ✅ | Stage 1 only | ✅ 2 / 2 |
| **5** | Command surfaces & closing | I9 ✅ I13 ✅ I16 ✅ I17 ✅ I10 ✅ I11 ✅ | Stage 2 shipped | ✅ 6 / 6 |
| **Review** | Pre-commit review findings | I22 ✅ I23 ✅ | — | ✅ 2 / 2 |
| **Cutover** | Production readiness | I24 ⬜ | a live project exists | ⬜ 0 / 1 |

**Totals: 33 / 34 items complete** — I24 is deliberately open until cutover. Stage 0b ✅ (I18, I19, I20) and Stage 1 ✅
(B1–B5, B8, B9, I14) are done and verified; I16 is half-shipped (trigger in, RPC/UI
pending in Stage 5). Stage 0 is 2/3 — the pg_cron hosted check is deferred with B0
until a production project exists. Next: **Stage 2 — the web apps.**

> **Stage 0 blocks Stage 1 and is not finished.** Both remaining checks need the
> **hosted** project, which this machine cannot reach — the `supabase` CLI is not
> installed and the credentials are not mine to go hunting for. See B0 and B6.

### Stage detail

**Stage 0 — verify (safe now, no writes)**
- **B0** ✅ — closed by context: no production project exists yet.
- `pg_cron` availability 🔄 — local confirmed (1.6.4); hosted deferred with B0.
- **D3 pre-check** ✅ — mobile falls back safely, no crash risk.

> **Tooling note (2026-07-31).** The `supabase` CLI is **not installed** on this
> machine, but `npx supabase` resolves (fetched 2.111.0 on demand) — so
> `npx supabase db reset` / `migration up` are available from `backbone/`. No
> tooling blocker for Stage 1. `db reset` **drops the local database**, so it is
> an ask-first command under AGENTS.md, not something to run unprompted.

**Stage 0b — copy and guide (safe now, no schema dependency)**
- **I18** (copy module) → **I20** (guide section) → **I19** (InfoTip).
  None of these touch the schema, so they can be built and reviewed against the
  existing dashboard before Stage 1 lands. Fully unblocked as of 2026-07-31.

**Stage 1 — schema core (one coupled batch, must ship together)**
- **B1** (fulfilment patterns) → **B2** (states + actor trigger, includes **B4**,
  **B9**, and **I16**'s trigger half) → **B3** (`status_changed_at` + payout
  lifecycle) → **B5** (booker RPC). Order is strict: B2 reads B1's column; B3's
  backfill reads B2's states; B5 depends on both.
- **I14** (seed data) — same batch. Without it the local environment cannot reach
  any new state, so Stage 2 has nothing to develop against.
- **B8** — test matrix. Gates the batch; do not proceed on a red matrix.

**Stage 2 — web apps for the happy path (coupled with Stage 1)**
- **I1** + **I2** (types and badges) — must land with Stage 1 or the apps
  mis-render new statuses.
- **I3** (vendor row actions, incl. B9 undo) + **I21** (filter grouping) +
  **I6** (fulfilment-pattern field) — same release. I21 ships with I3 because the
  moment new statuses exist, the five-tab bar is already wrong.
- **I5** (booker acknowledgement, incl. B9 undo) — **all three surfaces**, and
  `SHOWN_STATUSES` first, or the new states are invisible on the dashboard.
- **I4** (payability rewrite) — coupled to B3. **I12** (unpaid-booking warning)
  rides along in the same component.

**Stage 3 — automation**
- **B6** (auto-acknowledge job). After Stage 2, so a booker has a UI to
  acknowledge *before* the timer starts completing things for them.
- **I7** (notifications) — could land earlier, but the copy depends on the final
  UI wording. **I15** (Command notification plumbing) ships with it.

**Stage 4 — dispute flag (independently sequenceable)**
- **B7** (table + 2 RPCs) → **I8** (Command queue) → "Report an issue" entry
  points in I3/I5. No extra notification trigger — I7 covers it.

**Stage 5 — Command surfaces + closing**
- **I9** — note the sizing correction: the real transactions data path replacing
  the `genTxns()` mock comes first and is the bulk. Then the release control, then
  **I13** (owed-back list — same query).
- **I16**'s RPC + UI half (the trigger half shipped in Stage 1), **I17**
  (fulfilment oversight panel).
- **I10** (comms), **I11** (docs).

---

## Stage 1 execution record — 2026-07-31

**Migrations written and applied** (`npx supabase migration up --local`, all four
applied clean):

| File | Covers |
|---|---|
| `20260801000001_fulfilment_patterns.sql` | B1 — lookup table, seeded; `offerings.fulfilment_pattern` + `bookings.fulfilment_pattern` FKs; snapshot + pin folded into the existing `check_booking_consistency()` |
| `20260801000002_booking_fulfilment_states.sql` | B2 + **B4** + **B9** + **I16 trigger half** — widened CHECK, `status_changed_at`, actor-aware `validate_booking_status_transition()`, and `log_booking_status_change()` now writing `notes` |
| `20260801000003_booking_payout_status.sql` | B3 — `payout_status` / `released_at`, backfill, `sync_booking_payout_status()` |
| `20260801000004_booking_acknowledgement_rpc.sql` | B5 — `acknowledge_booking(uuid, boolean)` |
| `supabase/tests/booking_transitions_test.sql` | B8 — 45-cell matrix |

**Backfill actually landed** (against the pre-existing local data, which is a
better test than a fresh reset would have been): 11 `completed` → `releasable`,
4 `refunded` + 2 `cancelled` → `reversed`, 23 `confirmed` → `held`; zero NULL
`status_changed_at` or `fulfilment_pattern` across 41 bookings.

### Deviations from the plan as written

- **`status_changed_at` moved from B3 into B2.** B2's trigger is what writes it;
  splitting column and writer across migrations would have left B2's function
  referencing a column that did not yet exist. Column and writer now ship together.
- **I16's trigger half landed early, inside B2** — as the plan required ("Do not
  ship B2 without I16's trigger half"). Command acting as a *third party* (Command
  admin who is neither the booker nor a vendor-admin of that booking) must set
  `app.status_change_note`; dispute resolution is exempt. The note is carried into
  the long-unused `booking_status_log.notes`. **I16's RPC + UI half remains ⬜**,
  Stage 5.
- **No `status_changed_at` DEFAULT added.** Considered and rejected as scope: the
  only consumer is the countdown, which only renders on states reached *by* a
  transition, so NULL is unreachable there. Un-actioned `pending` rows keep NULL;
  I17 should use `coalesce(status_changed_at, created_at)`.

### B8 caught a real defect — in the test, not the trigger

First run: **5 of 45 cells failed**, every one a vendor actor being ALLOWED where
DENY was correct (`completed → refunded`, `fulfilled → completed`,
`in_progress → returned`, `returned → in_progress`, `disputed → completed`).

Cause: seed's `00000000-…-0002` is **both** a vendor-admin **and** a Command
admin, so `v_command` was true for the "vendor" actor and every Command-permitted
branch read as a vendor capability. **The trigger was correct; the fixture was
not.** Fixed by moving to role-disjoint identities (booking `…-0003`, booker
`…-0011`, vendor-admin `…-0008`, Command admin `…-0001`) and adding the
disjointness assertions whose absence allowed it: the matrix now refuses to run if
the vendor or booker actor is also a Command admin. **Second run: 45/45, exit 0.**

Worth keeping in mind for every later actor-sensitive test — this dataset has
overlapping roles by design.

### I14 verified on a clean rebuild — 2026-07-31

The user ran `npx supabase db reset`, which re-applies every migration against
empty tables **and runs `seed.sql` automatically** (no separate seed step). Result:

| Check | Result |
|---|---|
| Latest migration | `20260801000004` |
| `COURT` offerings → `custody` (Block 4b) | 3 of 3; COACH/FIT/GROUP remain `session` |
| Bookings snapshot the right pattern | 14 `custody`, 27 `session` — matches their offerings |
| New states populated (Block 9d) | 1 `fulfilled`, 1 `in_progress`, 1 `returned` |
| `status_changed_at IS NULL` | **0** |
| `completed` with payout still `held` | **0** |
| `refunded`/`cancelled` not `reversed` | **0** |
| Rows instantly due for auto-acknowledge | **0** (backdated 1 day, inside the 3-day window) |
| B8 matrix re-run on the fresh DB | **45/45, exit 0** |

Payout distribution after reset: `completed`→`releasable` 11, `cancelled`/
`refunded`→`reversed` 6, everything else `held` 23. The inconsistency this item
existed to prevent — completed bookings reading "held" — does not occur.

**Stage 1 is complete and verified.**

---

## Stage 2 execution record — 2026-07-31

**Vendor** — `lib/types.ts` (widened `BookingStatus`, added `PayoutStatus`, three
new `Booking` fields, `Offering.fulfilmentPattern`), `lib/utils.ts` (`statusStyle`
+ new `statusLabel`, `BOOKING_FILTERS` / `bookingMatchesFilter`, `isPayable`
rewritten), `services/bookings.service.ts` (+4 fulfilment writes),
`services/offerings.service.ts`, `services/transactions.service.ts`,
`components/layout/AppShell/{useAppShell.ts,AppShell.tsx}` (`fulfilB`),
`components/bookings/BookingRow/*`, `components/bookings/BookingsPage/*`,
`components/offerings/OfferingFormModal/*`, `components/transactions/*` (2 call
sites), `app/ui-gallery/page.tsx`.

**Booker** — `lib/types.ts`, `services/bookings.service.ts` (+`acknowledgeBooking`
/ `undoAcknowledgement`), `components/dashboard/BookingStatusWidget/*`,
`components/layout/AppShell/useAppShell.ts` (realtime patch),
`components/transactions/TransactionsPage/TransactionsPage.tsx`,
`app/ui-gallery/page.tsx`.

### Deviations and findings

- **`onAction(id, action, reason?)` collapse not done.** The plan proposed
  replacing `approveB`/`rejectB` with one callback. Those two are threaded through
  `AppShell` → `DashboardPage` → `PendingApprovalsCard` as well, so collapsing
  them meant editing four unrelated components. Added a **single** `fulfilB(id,
  action)` beside them instead — `BookingRow` ends at 5 props, not 7, and nothing
  outside the bookings surface was touched. The plan's goal (no seven-callback
  component) is met; its mechanism is not.
- **`raise_booking_dispute` deliberately NOT wired.** I3's "Something's wrong"
  button calls an RPC that ships with B7 in **Stage 4**. Building the button now
  would fail at runtime, so the vendor service carries a comment where it will go.
  **I5 is 🔄 for the same reason** — its "Report an issue" entry point is Stage 4,
  and `BookingCard` / `BookingDetailModal` were not touched this stage.
- **`isPayable` now takes `PayoutStatus`, not `BookingStatus`.** Both call sites
  (`useTransactionsPage.ts:130`, `TransactionRow.tsx:16`) and the service's
  server-side sum now read `payout_status` from the DB. `confirmed` is no longer
  payable — **vendors' Total Payout will drop**, which is I10's job to announce.
- **Vendor's `/ui-gallery` fixtures use `as Booking[]`**, a cast — so missing
  fields do **not** error there. Booker's are properly typed and did error. Left
  the cast alone (out of scope) but added a comment; both fixture sets now carry
  rows in every new state plus an unpaid row for I12.
- **Realtime patch widened** (`booker/…/useAppShell.ts`): the handler patched only
  `status`, which would have frozen the "2d left" countdown at its previous value
  until a full refetch. It now carries `status_changed_at` too.
- **booker/CLAUDE.md says UI primitives come from `npx shadcn add`.** `InfoTip` is
  a composed component, not a shadcn primitive, and was built on Radix Popover
  directly to match vendor's `Combobox`. Flagged rather than assumed.

---

## Stage 4 execution record — 2026-07-31

**Migration** `20260801000005_booking_disputes.sql` — table, partial unique index
(one *open* flag per booking, re-flaggable after resolution), 3 SELECT-only RLS
policies, grants (`authenticated` = SELECT only, `anon` = none, verified), and
two SECURITY DEFINER RPCs. **Applied clean.**

**Command** — new `services/disputes.service.ts`, new
`components/flags/FlagQueue/{FlagQueue.tsx,useFlagQueue.ts,FlagQueue.module.css}`,
plus `lib/navigation.ts` and `AppShell.tsx` wiring. Command previously had **no
bookings surface at all**; this is its first.

**Vendor** — `flagBooking()` in the service; `useBookingRow` generalised
`rejecting: boolean` → `reasonFor: "reject" | "flag" | null` so the flag reuses
the existing inline reason expansion rather than adding a second idiom.

**Booker** — `flagBooking()` in the service; flag button + inline reason capture
in `BookingStatusWidget`.

### RPC behaviour, verified live (all in a rolled-back transaction)

| Case | Result |
|---|---|
| Stranger flags | DENIED — "Only the booker or the vendor can flag this booking" |
| **Command admin flags** | DENIED — they resolve, they do not raise |
| Reason under 10 chars | DENIED with a usable message |
| Booker flags | OK — `raised_role='booker'` derived server-side |
| → payout | **`releasable` → `held`** (freeze works) |
| → booking | `completed` → `disputed` |
| Second open flag | DENIED — partial unique index holds |
| Vendor resolves | DENIED — "Only Ezzy staff can resolve a flag" |
| Command resolves → completed | OK; flag `resolved`, booking `completed`, payout back to **`releasable`** |
| **`rejection_reason` after resolution** | **empty** — the I7 landmine avoided |

### Notes

- **I5 closed immediately after Stage 4** — see the I5 completion record below.
- **`raised_role` is derived, never accepted from the client**, so neither party
  can raise a flag claiming to be the other.
- **Command's queue is its first bookings surface**, and it is load-bearing: a
  flagged booking freezes a vendor's payout and nothing times out, so this queue
  is the only exit. Nav entry added under Management rather than left URL-only.

---

## I5 completion — 2026-07-31

The two remaining booker surfaces, finished after Stage 4 unblocked the flag RPC.

**`BookingDetailModal`** — gained `useBookingDetailModal.ts`. It previously held
no state and shipped as a bare `.tsx` under the pure-display exception; gaining a
mutation means it gains the companion hook, exactly as the item required. The
footer's placeholder **"Reschedule"** primary slot now carries the
acknowledgement when the booking is waiting on the booker, with "Something's
wrong" beneath it and the auto-confirm countdown above. When no action applies,
"Reschedule" is left exactly as it was.

**`BookingCard`** — label only; it is a pure display component and stays one.

### Two defects found while closing it

- **`db-badge-*` existed for only four statuses** (`confirmed`, `pending`,
  `completed`, `refunded`) in `app/globals.css:199-207`. The class name is
  *interpolated from the status*, so `fulfilled` / `in_progress` / `returned` /
  `disputed` / `cancelled` fell back to bare `.db-badge` and rendered
  **unstyled** — a silent failure no type check could catch. Added all five, in
  both light and dark.
- **Both files rendered `b.status[0].toUpperCase() + b.status.slice(1)`**, so
  `in_progress` displayed as **"In_progress"**. Added `statusLabel()` to
  `booker/lib/utils.ts`, mirroring vendor's, phrased from the booker's side
  (`fulfilled` → "Confirm completion", `returned` → "Awaiting vendor").

`onChanged` is deliberately left unwired at the `DashboardPage` call site: the
modal closes on success and the existing Realtime subscription patches the list,
which is the same reasoning as the dashboard widget. No prop-drilling added.

---

## Stage 3 execution record — 2026-07-31

**Migrations:** `20260801000006_auto_acknowledge_bookings.sql` (B6) and
`20260801000007_fulfilment_notifications.sql` (I7). Both applied clean.
**Command:** `lib/types.ts`, `NotificationItem.tsx`, `NotificationSettingsPage.tsx` (I15).

### B6 — verified against backdated rows

| Check | Result |
|---|---|
| Promoted only rows past the 3-day window | 2 of 4 candidates |
| **`in_progress` backdated 90 days** | **untouched** — the safety property |
| `fulfilled` inside the window | untouched |
| Auto-completed rows' `booking_status_log.changed_by` | **NULL** (system actor) |
| Payout released by the job | `releasable` count rose by exactly 2 |
| Second run | 0 rows — idempotent |

`pg_cron` 1.6.4 enabled; job `auto-acknowledge-bookings @ 0 * * * *` registered
and confirmed in `cron.job`. **The migration fails loudly if pg_cron is
unavailable** rather than silently shipping without the job — see its header for
the fallback.

### I7 — every branch exercised

| Transition | Emitted |
|---|---|
| `pending → confirmed` | `booking_confirmed`/booker *(unchanged)* |
| `→ cancelled` w/ reason | `booking_rejected`/booker *(unchanged)* |
| `confirmed → cancelled` no reason | `booking_cancelled`/booker *(unchanged)* |
| `confirmed → fulfilled` | `booking_fulfilled`/booker |
| `confirmed → in_progress` | `booking_started`/booker |
| `in_progress → returned` | `booking_returned`/vendor ×2 admins |
| `returned → completed` | `booking_completed`/vendor ×2 |
| auto-ack `fulfilled → completed` | `booking_completed`/vendor ×2 |
| **`fulfilled → confirmed` (undo)** | **none** |
| **`in_progress → confirmed` (undo)** | **none** |
| **`returned → in_progress` (undo)** | **none** |
| **`disputed → cancelled`** | **`dispute_resolved`, NOT `booking_rejected`** |
| `disputed → completed` | `dispute_resolved` to both sides |

**Counterparty routing verified through the real RPC**, not just a synthetic
status write: booker-raised → vendor admins + Command (never the booker);
vendor-raised → booker + Command. The routing reads
`booking_disputes.raised_role`, written in the same transaction.

The two landmines the plan called out are both closed: **undo emits nothing**, and
**dispute resolution never triggers the rejected-branch email**.

### Notes

- **No second trigger on `booking_disputes`** — the flag-only model removed the
  "responded" step, so all six notifications are `bookings.status` transitions and
  the existing trigger carries them. This is the dividend the plan predicted.
- **Command fan-out mirrors the register route** (`booker/app/api/register/route.ts:92-96`):
  anyone holding `admin` or `root`, one row each. Not `is_portal_member('command')`,
  matching the existing precedent rather than inventing a second rule.
- **`booking_disputed` has a fallback path** for a booking reaching `disputed`
  with no open dispute row — unreachable through the RPC, and it notifies the
  booker. Harmless but not ideal; noted rather than fixed.
- `notification_type_settings` now holds 13 types (7 + 6).

---

## Verification

| Item | How | Kind |
|---|---|---|
| B0 | SQL counts against production | needs-live-environment |
| B1 | `supabase db reset` applies clean; `fulfilment_patterns` seeded with both rows before the FK-bearing `ALTER`s; both columns default to `'session'`; the FK rejects an unknown code and blocks deleting a pattern in use | machine-verifiable |
| B3 | `supabase db reset` applies clean; columns present with correct defaults; backfill lands | machine-verifiable |
| B2, B4, B9 | B8's full `(from, to, actor, type)` matrix, including the blocked-cancellation and undo cases | machine-verifiable |
| B5 | RPC returns expected next state for booker; raises for non-owner | machine-verifiable |
| B6 | Unit-test the SQL function with backdated `status_changed_at`; confirm `in_progress` rows are untouched. Cron firing itself | function machine-verifiable; schedule needs-live-environment |
| B7 | Partial unique index rejects a second open flag on the same booking, but permits a new one after the first is resolved; both RPCs raise for the wrong actor; `raised_role` is derived server-side and ignores any client-supplied value | machine-verifiable |
| I1, I2, I4 | `npx tsc --noEmit` in each app — `isPayable`'s exhaustive Record makes an omission a hard error | machine-verifiable |
| I3, I5, I6, I8, I9 | Type check + build; then a manual pass of both flows end to end (service and rental, happy path and dispute) | build machine-verifiable; flows need-live-environment |
| I7 | Insert a status change locally, assert the `notifications` row; verify the three pre-existing reject/cancel branches still fire | machine-verifiable |
| I12 | Fulfil an unpaid booking; assert no `booking_transactions` row and the warning rendered | needs-live-environment |
| I13 | Release a payout, then refund the booking; assert it appears in the owed-back list | needs-live-environment |
| I14 | `supabase db reset` yields at least one booking in each new state plus an open flag | machine-verifiable |
| I15 | Open Command Settings → all six new types show a label and an audience | build machine-verifiable; render needs-live-environment |
| I16 | B8 assertion: a Command-actor transition with no reason **raises**; with a reason, `booking_status_log.notes` carries it | machine-verifiable |
| I17 | Backdate an `in_progress` booking; confirm it surfaces in the stale list | needs-live-environment |
| I18 | `npx tsc --noEmit`; grep both apps for hardcoded action label strings — there must be none outside the copy module | machine-verifiable |
| I19 | Popover opens on **tap** (not hover) on a touch device and on Enter/Space via keyboard; focus returns on close; readable in light and dark | needs-live-environment |
| I20 | Existing four guide items render unchanged (optional `actions` field); new section renders both apps. **Playwright visual baselines will fail until regenerated** — regenerate and eyeball the diff rather than accepting blind | machine-verifiable after baseline regen |
| I21 | Six tabs render without wrapping at 1280px and 768px; each group's count matches a direct query for its member statuses | needs-live-environment |
| Realtime (I5) | Vendor acts in one browser, booker's dashboard updates without refresh. **Note `booking_disputes` is not in the realtime publication** — Command's queue polls; acceptable, but confirm it is not silently expected to be live | needs-live-environment |
| Payout gating (end to end) | Book → pay → vendor fulfils → booker acknowledges → assert `payout_status = 'releasable'`; separately dispute and assert it returns to `'held'` | needs-live-environment |

---

### I24 — Production cutover: seeding, and what must never reach a live DB  ⬜ TODO
**Files:** none — process. **Do this at production setup, not before.**
*(Raised 2026-08-01 while confirming what `db reset` runs.)*

**`db reset` runs the seeders; `db push` does not.** Confirmed in
`backbone/supabase/config.toml:60-65` — `[db.seed] enabled = true`,
`sql_paths = ["./seed.sql"]`.

| Command | Migrations | `seed.sql` | Target |
|---|---|---|---|
| `supabase db reset` | re-applies all, from empty | **yes** | local only |
| `supabase db push` | applies pending only | **no** | hosted |

So the production path already excludes seed by construction. That is the default,
not a safeguard anyone configured — worth knowing which it is.

**⚠️ Why this is an auth hazard, not just a data one.** `seed.sql` writes directly
to **`auth.users`** in three places (`:53`, `:122`, `:857`), creating real login
accounts with known passwords, alongside fake vendors, profiles and 41 bookings.
Reaching production would not be a messy-data incident; it would be an
authentication one.

**`backbone/supabase/.temp/project-ref` holds a hosted project ref**
(`fbxbwnfeimzhgxpshdpa`) — this workspace has been linked to a remote project.
Check it before running anything destructive.

**✅ Verified 2026-08-01 — production-required rows all ship via migrations:**

| Table | Seeded by | `seed.sql` inserts |
|---|---|---|
| `fulfilment_patterns` | `20260801000001` | 0 |
| `notification_type_settings` | `20260525000001` + `20260801000007` | 0 |
| `platform_fee_settings` | `20260725000001` | 0 |
| `divisions` / `statuses` / `roles` / `portals` | their own migrations | 0 |

Nothing this feature needs at runtime depends on `seed.sql`. A production `db push`
yields a working schema with an empty dataset, which is correct.

**Checklist at cutover:**
- [ ] Confirm the CLI is pointed at the intended project before any destructive command
- [ ] `db push` only — never `db reset` against a hosted project
- [ ] **Set `platform_fee_settings.fee_percent`.** It seeds at **0** deliberately, so no migration ever starts charging vendors on its own. Until Command sets a rate, every payout is 100% to the vendor and the platform earns nothing
- [ ] Confirm `pg_cron` is enabled on the project — reopens the deferred half of B6. Without it, nothing auto-acknowledges and bookings wait on manual confirmation indefinitely
- [ ] Re-run B0's counts against the live DB once it has real data, before any further schema work
- [ ] Consider `[db.seed] enabled = false` in a production-facing config profile, as belt-and-braces


---

### I22 — Command's flag queue reported every booking as "Never paid"  ✅ DONE
**File:** `command/services/disputes.service.ts:34-37, 81`
*(Found in pre-commit review, 2026-08-01.)*
`booking_transactions.booking_id` is **UNIQUE**, so PostgREST embeds the relation
as a to-**one** object, not an array. The service typed it
`booking_transactions: { payout_status: string }[]` and read `[0]?.payout_status`,
which is always `undefined` on an object — so `payoutStatus` fell through to
`"none"` for **every** flag. Consequences on screen: the **"Payout frozen"** chip
never rendered, and the **"Never paid"** chip rendered on every flag including
fully paid ones — telling Command the opposite of the truth about a booking's
money while they decide how to resolve it.

**Why nothing caught it:** the type was internally consistent and wrong. `tsc`,
the build and the Playwright pixel baselines all pass either way; only a real API
response distinguishes them.

**Fix:** typed as `{ payout_status: string } | null`, read directly.
**Verified (2026-08-01):** live `booking_disputes` row queried through PostgREST
on the local stack, both access paths evaluated against the real payload —
`[0]?.…` → `"none"` (renders "Never paid"), `.payout_status` → `"releasable"`
(renders no chip, correct). Probe row deleted afterwards.

### I23 — Vendor's realtime handler froze the countdown  ✅ DONE
**File:** `vendor/components/layout/AppShell/useAppShell.ts:234-250`
*(Found in pre-commit review, 2026-08-01.)*
The `postgres_changes` handler patched `status`, `rejection_reason` and `notes`
onto the row in state, but not `status_changed_at` or `is_paid`. Both are new in
this plan and both drive UI: the first the **"auto-confirms in Nd"** countdown,
the second the **"Not paid"** warning. A vendor watching a booking move would see
the status change while the countdown stayed frozen at its previous value until a
full refetch.

**The same defect was fixed in booker during Stage 2 and missed in vendor** — the
two handlers are near-identical twins, and only one was updated. Worth checking
both whenever either changes.

**Fix:** both fields now ride along, each falling back to the existing value so a
payload without them cannot blank the row.
**Verified:** `tsc --noEmit` 0, `npm run build` 0. **Not verified — needs a
browser:** that the patched countdown visibly ticks on a live realtime event
(covered by the manual script, §2 step 12).


---

## Stage 5 execution record — 2026-08-01

**Migration** `20260801000008_payout_release_and_override.sql` —
`release_booking_payouts(uuid[])` (bulk, Command-only) and
`admin_override_booking_status(uuid, text, text)` (Command-only, reason ≥10 chars).

**Command** — new `services/payouts.service.ts`, `services/oversight.service.ts`,
`components/payouts/PayoutsPage/` (trio), `components/overview/FulfilmentOversightCard/`
(trio), plus `lib/navigation.ts`, `AppShell.tsx`, `OverviewPage.tsx`.

**Docs** — `architecture/schema.md` (migration table, the full actor-aware
transition matrix replacing the old three-line list, the amended
`booking_transactions` immutability wording) and `architecture/booking-flow.md`
(new fulfilment section). **`.plans/2026-08-01-fulfilment-release-notes.md`** is
I10's draft copy — *not sent*.

### RPCs verified live

| Case | Result |
|---|---|
| Vendor-admin calls `release_booking_payouts` | DENIED |
| Command releases | 11 rows — only the `releasable` ones |
| Second release | 0 rows — idempotent |
| Override with a short reason | DENIED |
| Override with a reason | OK, and the reason lands in `booking_status_log.notes` |

### ⚠️ Deviation from I9 as written — read this

I9's sizing note said Command's transactions page is `genTxns()` mock data and
that a real data path had to be built first. **I did not convert that page.**
Reasons, in order of weight:

1. Its mock `Transaction` has a **`method` (payment method) filter with no source
   in the schema** — `booking_transactions` does not store it, and PayMongo's is
   never persisted. Converting the page means deleting a working filter.
2. It is seven components of filtering, sorting, search and pagination built for a
   different shape. Rewriting it is a refactor of pre-existing mock UI, not part
   of dual acknowledgement.

Instead, **Payouts is its own page** on real data, which is what the item actually
needed: somewhere to see what is owed and record that it was paid. The mock
Transactions page is untouched and still mock — logged as **D7**.

### Where I16's UI landed, and why

The override needs a booking to act on, and Command has no bookings list. Rather
than build one, the control lives inside **I17's oversight card** — the stale
`in_progress` list *is* the set of bookings needing an override, so the surface
that shows the problem offers the only fix. Two outcomes are offered
(`returned` / `cancelled`); nothing is guessed at.

---

## On completion — 2026-08-01

### What shipped

A booking now reaches `completed` only when **both parties** say so, and the
vendor's payout is gated on that. Eight migrations, three web apps, 45-cell
transition matrix, hourly auto-acknowledge job, flag-and-resolve workflow, and
Command surfaces for payouts, flags and stuck bookings.

The behaviour change users will notice: **`confirmed` is no longer payable.**
Vendors' Total Payout will drop, because it previously counted work that had not
happened. I10's draft leads with that.

### Parked, with reasons

| Item | Why |
|---|---|
| **D1** Automated disbursement | Out of scope by decision. Needs PayMongo Platforms sub-accounts + onboarding |
| **D2** Fuller dispute workflow + evidence | Flag-only chosen; the table is a strict subset, so this is additive |
| **D3** Mobile apps | Deferred to prove the machine on one client pair. Pre-check confirmed no crash risk; they render raw values like "In_progress" |
| **D4** Booker-initiated cancellation | Pre-existing gap; blocked on D5 |
| **D5** ⚠️ **No refund mechanism** | PayMongo's refund API is never called. `reversed` means the vendor is not paid and says **nothing** about the booker's money |
| **D6** Both apps' `npm run lint` broken | Pre-existing, unrelated; build tooling in two apps |
| **D7** Command Transactions page is mock | Pre-existing `genTxns()`; see the Stage 5 deviation above |
| **B0 / pg_cron hosted** | No production project exists. **Reopen both when one is provisioned** |

### ⚠️ Verification that was NOT run

**Nothing in this feature has been exercised in a browser.** Every claim in this
plan rests on `tsc --noEmit`, `next build`, SQL executed against the local
database, and Playwright *pixel* baselines. Specifically unverified:

- That any button actually reaches the database from a running app
- That the `InfoTip` popover opens on click or on keyboard
- That Command's Payouts, Flags and oversight surfaces render against real rows
- That Realtime delivers the booker's own acknowledgement back to their dashboard
- The pg_cron job firing on its schedule (the function itself is tested)
- Anything on a hosted Supabase project — there isn't one

A manual pass through both flows should happen **before** I10's notices go out.
The state machine is well covered; the wiring around it is not.
