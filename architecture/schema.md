# Database Schema

> **Deploying these migrations?** See `database-reset-and-deploy.md` — which
> command is safe in which environment, what `seed.sql` will and will not do to a
> remote project, and the ordering that matters (notably: enable `pg_cron` before
> any reset, or the chain fails half-applied).


All schema lives in `./backbone/supabase/migrations/`. Migrations are applied in filename order and must never be edited after being applied — create a new migration instead.

---

## Migration History

| File | Description |
|------|-------------|
| `20260504000001_lookup_tables.sql` | Seed data: `statuses`, `portals`, `roles` |
| `20260504000002_schema.sql` | Core tables: `profiles`, `user_portals`, `user_roles`, `vendors`, `vendor_members` + all RLS helper functions |
| `20260504000003_rls.sql` | RLS policies for core tables |
| `20260506000001_offerings.sql` | `offerings` (free-text `category`) |
| `20260507000001_staff.sql` | `staff` |
| `20260507000002_schedules.sql` | `schedules` (with recurrence model) |
| `20260507000004_bookings.sql` | `bookings`, `booking_documents` |
| `20260511000001_vendor_approval.sql` | Fields/policies supporting vendor approval flow |
| `20260513000001_vendor_profile_fields.sql` | Additional profile fields for vendor portal |
| `20260515000001_booker_vendor_read_policy.sql` | RLS: allows active bookers to read active vendors |
| `20260515000002_offerings_requirements_jsonb.sql` | Converts `offerings.requirements` from `text[]` to `jsonb` (`[{id, label, required}]`) |
| `20260515000003_profiles_phone.sql` | Adds `phone` column to `profiles` |
| `20260516000001_vendors_region_branches.sql` | Adds `region` (text) and `branches` (smallint) to `vendors` for Command portal use |
| `20260516000002_booking_capacity_trigger.sql` | `check_booking_capacity()` BEFORE INSERT trigger — blocks overbooking against `schedules.max_capacity` |
| `20260516000003_booking_unique_and_rejection.sql` | `UNIQUE (booker_id, schedule_id, booked_date)` constraint; adds `rejection_reason text` column |
| `20260516000004_booking_status_transition.sql` | `validate_booking_status_transition()` BEFORE UPDATE trigger — enforces directed state transitions |
| `20260516000005_booking_cancelled_by.sql` | Adds `cancelled_by uuid → profiles` column to `bookings` |
| `20260516000006_booking_status_log.sql` | `booking_status_log` table + AFTER UPDATE trigger + RLS; immutable audit trail of status changes |
| `20260518000001_booking_payment_reference.sql` | Adds `payment_reference text` and `is_paid boolean not null default false` to `bookings`; used by PayMongo Checkout Session flow |
| `20260525000001_notification_type_settings.sql` | `notification_type_settings` table + RLS + seed rows for all 7 notification types |
| `20260525000002_notifications.sql` | `notifications` table + RLS (SELECT/UPDATE/DELETE own rows; no INSERT policy — trigger/service-role only) + Realtime publication |
| `20260525000003_notification_triggers.sql` | `notify_on_new_booking()` AFTER INSERT + `notify_on_booking_status_change()` AFTER UPDATE triggers; both SECURITY DEFINER; guard on `is_enabled` before inserting |
| `20260620000001_api_role_grants.sql` | Table-level GRANTs for the API roles (PostgREST needs DML before RLS runs). `anon` → none; `authenticated` → exactly the operations each table's RLS policies permit (no TRUNCATE); `service_role` → full DML. Revokes the inherited `Dxtm` default (incl. TRUNCATE) from anon/authenticated and revokes their schema-`public` default privileges, so **new tables must grant explicitly** |
| `20260620000002_booker_contacts_rpc.sql` | `get_booker_contacts(uuid)` SECURITY DEFINER RPC — returns booker `full_name/email/phone` to a vendor-admin for bookers who booked their vendor (`profiles` RLS otherwise blocks the join) |
| `20260624000001_notification_email_settings.sql` | `notification_email_settings` table + RLS (authenticated read; command-admin update) + seed one row per portal. Per-portal outbound-email kill-switch |
| `20260624000002_notification_emails.sql` | `notification_emails` table + RLS (service-role only). Outbound-email delivery log; `unique(notification_id)` is the idempotency guard |
| `20260624000003_notification_email_dispatch.sql` | `dispatch_notification_email()` AFTER INSERT trigger (`notifications_dispatch_email`) on `notifications`; enables `pg_net` + `supabase_vault`; `net.http_post`s the notification id to the `send-notification-email` Edge Function. Function URL + shared secret read from Supabase Vault; no-ops if Vault secrets are absent |
| `20260706000001_vendor_kyc.sql` | Vendor KYC: `kyc_document_types` (per-type suggested-document guidance, seeded), `vendor_kyc` (per-vendor header — applicant type + whole-packet review state), `vendor_kyc_documents` (one row per uploaded file) + RLS + grants. See `vendor-kyc.md` |
| `20260706000002_vendor_kyc_storage.sql` | Private `vendor-kyc` Storage bucket (10 MB; jpeg/png/pdf) + `storage.objects` RLS policies keyed on `(storage.foldername(name))[1]::uuid` = vendor id |
| `20260716161916_remote_schema.sql` | db-diff redeclaration (existing functions re-emitted via `CREATE OR REPLACE`); the only material change is recreating the `pg_net` extension in schema `public` |
| `20260718000001_bookings_realtime.sql` | `alter publication supabase_realtime add table public.bookings` — enables Realtime on `bookings` (previously only `notifications` was published). Booker subscribes to `UPDATE` (own bookings, live status changes); vendor subscribes to `INSERT`+`UPDATE` (own vendor's bookings, live incoming bookings + status/payment changes). Delivery is scoped by the existing `bookings` RLS SELECT policies — no new policies or grants needed |
| `20260722000001_vendor_address_fields.sql` | Adds `address_line1`, `barangay`, `city`, `city_code`, `province`, `province_code`, `zip_code` to `vendors`; backfills `address_line1` from the old `address` value. No RLS/grant changes (row-scoped policy, table-level grants already cover new columns) |
| `20260722000002_vendor_barangay_strict.sql` | Corrective migration (not an edit of `20260722000001` — see `AGENTS.md`): adds `barangay_code`, since barangay was revised from free text to a strict pick-from-list needing the same code-based edit-time resolution as `city_code`/`province_code` |
| `20260724000001_kyc_document_types_grant_fix.sql` | Grants `insert, update, delete` on `kyc_document_types` to `authenticated` — closes a gap where the table's RLS policy already permitted command admin/root writes but the table-level grant only covered `select`, so writes failed with `permission denied` regardless of RLS |
| `20260724000002_vendor_members_vendor_id_index.sql` | Adds `vendor_members_vendor_id_idx` on `vendor_members(vendor_id)` — the existing `(user_id, vendor_id)` PK couldn't efficiently support the `vendor_id`-only lookup `notify_on_new_booking()` runs on every booking insert |
| `20260724000003_booking_capacity_lock.sql` | Redefines `check_booking_capacity()` to `select ... for update` the `schedules` row before counting existing bookings — closes a TOCTOU race where two concurrent inserts for the last slot could both pass the capacity check before either committed |
| `20260724000004_divisions.sql` | ⚠️ **NOT ON THIS BRANCH — see the caveat under `divisions` below.** `divisions` (Ezzy business-vertical taxonomy, seeded with 13 rows) + `vendors.division_id` FK (nullable, `ON DELETE RESTRICT`, indexed) + RLS/grants. Every vendor is associated with exactly one division. See the `divisions` table entry below |
| `20260725000001_platform_fee_settings.sql` | `platform_fee_settings` — single-row (`id smallint check (id = 1)`) global platform commission percentage + `set_updated_at()` trigger + RLS/grants. Seeded at `0` so no environment charges a fee until Command configures one |
| `20260725000002_booking_transactions.sql` | `booking_transactions` (immutable per-payment ledger: amount paid, fee %, fee amount, payout) + `create_booking_transaction()` SECURITY DEFINER trigger on `bookings` `AFTER UPDATE OF is_paid`, firing only on a false→true transition + RLS/grants. Snapshots the fee percentage at payment time so changing it never alters historical payouts |
| `20260726000001_platform_fee_settings_rls_tighten.sql` | Narrows the `platform_fee_settings` RLS policies |
| `20260728000001_device_push_tokens.sql` | `device_push_tokens` (per-install Expo push token, shared across portals, own-rows-only RLS) + `notification_push_settings` (per-portal push kill switch, mirroring `notification_email_settings`) + `dispatch_notification_push()` trigger on `notifications` `AFTER INSERT` → pg_net → `send-push-notification` Edge Function + RLS/grants. Same pg_net + Vault chokepoint as the email dispatcher, and silently no-ops when Vault is unconfigured so local dev and `seed.sql` are never blocked |
| `20260801000001_fulfilment_patterns.sql` | `fulfilment_patterns` lookup (seeded `session` / `custody`) + `offerings.fulfilment_pattern` and `bookings.fulfilment_pattern` FK columns + snapshot/pin logic folded into `check_booking_consistency()`. The pattern is a **fulfilment shape, not a business category** — business taxonomy stays in `offerings.category` and `divisions` |
| `20260801000002_booking_fulfilment_states.sql` | Widens `bookings_status_values` to nine states, adds `bookings.status_changed_at`, and rewrites `validate_booking_status_transition()` to be **actor-aware**. Also extends `log_booking_status_change()` to write `notes` |
| `20260801000003_booking_payout_status.sql` | `booking_transactions.payout_status` / `released_at` + backfill + `sync_booking_payout_status()` trigger. Gates the vendor payout on mutual completion |
| `20260801000004_booking_acknowledgement_rpc.sql` | `acknowledge_booking(uuid, boolean)` — the booker's only write path to `bookings.status` |
| `20260801000005_booking_disputes.sql` | `booking_disputes` (flag-only) + `raise_booking_dispute()` / `resolve_booking_dispute()` RPCs + RLS/grants |
| `20260801000006_auto_acknowledge_bookings.sql` | `auto_acknowledge_bookings()` + `pg_cron` hourly job. Promotes `fulfilled`/`returned` after 3 days; **never** touches `in_progress` |
| `20260801000007_fulfilment_notifications.sql` | Six new `notification_type_settings` rows + rewritten `notify_on_booking_status_change()`. Undo transitions emit nothing |
| `20260801000008_payout_release_and_override.sql` | `release_booking_payouts(uuid[])` (bulk, Command-only) + `admin_override_booking_status()` (Command-only, reason required) |
| `20260801000009_auto_acknowledge_date_gate.sql` | Replaces `auto_acknowledge_bookings()` so a `fulfilled` booking cannot auto-complete **before its `booked_date`** (Asia/Manila). Closes the hole where a vendor marks a session done weeks early and the unattended timer releases the payout for work that has not happened. **`returned` is exempt** — reaching it required the booker to state the item came back, which is direct evidence; `fulfilled` is a unilateral vendor claim. The gate is on the **timer, not the vendor's action**: early handover by agreement stays legal, and only the unattended path is closed |
| `20260803000001_offering_duration_units.sql` | Replaces free-text `offerings.duration` with `duration_minutes` (normalised) + `duration_unit` (the vendor's frame, and the **granularity discriminator**). Parses and backfills the old text — reporting any row it had to default — then drops the column. `month` is fixed at 30 days |
| `20260803000002_schedule_availability.sql` | A schedule becomes an **availability rule**: `max_capacity` → `capacity_per_slot` (default 20 → **1**), `start_time`/`end_time` nullable, `end_date` added. **Also repoints `check_booking_capacity()`** — plpgsql resolves column names at runtime, so the rename alone would have broken every booking insert |
| `20260803000003_booking_units.sql` | `bookings` gains `start_time`, `end_time`, `end_date`, `quantity` — the bookable unit that never existed. Backfills from each booking's schedule. Widens `bookings_no_duplicate` to a unique **index** including `coalesce(start_time,'00:00')`, so a booker may hold several slots on one date |
| `20260803000004_booking_derive_price_and_span.sql` | `check_booking_consistency()` now **derives** `price_paid` (`offering.price * quantity`) and the booking's span, and pins them plus `quantity` against UPDATE. Closes a hole where the client wrote `price_paid` and the PayMongo route then trusted it |
| `20260803000005_booking_slot_and_capacity.sql` | `check_booking_placement()` replaces `check_booking_capacity()`: slot-boundary legality, window fit, **recurrence validity in the DB** (previously app-layer only), per-covered-slot capacity, and same-booker overlap. Renamed so it sorts **after** `bookings_check_consistency` — BEFORE triggers fire alphabetically and this one reads the span that one computes |

---

## Entity Relationship Overview

```
auth.users
    │
    └─── profiles (1:1)
              │
              ├─── user_portals ────────► portals
              ├─── user_roles ──────────► roles
              ├─── notifications ───────► notification_type_settings
              ├─── device_push_tokens ──► portals (one row per mobile install;
              │                            push delivery addresses)
              └─── vendor_members ─────► vendors ──► statuses
                                              │
                                              ├──► divisions (business-vertical taxonomy)
                                              │
                                         offerings ◄─┐
                                              │       │
                                         schedules ──► staff
                                              │       │
                                              │   staff_specialties (staff ↔ offerings)
                                         bookings
                                              │
                                              ├──► booking_documents
                                              │
                                              ├──► booking_disputes (flag; freezes the payout
                                              │                      until Command resolves)
                                              │
                                         booking_transactions (immutable payment ledger,
                                              1:1, created on first payment)

  fulfilment_patterns (session | custody — the SHAPE of how a booking completes)
        ▲                    ▲
        │                    └── bookings.fulfilment_pattern (snapshot, pinned at insert)
        └── offerings.fulfilment_pattern

  platform_fee_settings (single row — global commission %; snapshotted onto
                         booking_transactions at payment time, never joined)

  notification_email_settings / notification_push_settings (one row per portal —
                         per-channel kill switches read by the two dispatchers)

  vendors ──► vendor_status_log (status-change audit trail)
  vendors ──► vendor_kyc (1:1 header) ──► vendor_kyc_documents
                  (kyc_type + review state)   (label + storage_path)
  kyc_document_types (per-type suggested-document guidance; no FK)
```

---

## Tables

### `statuses`
Shared lifecycle-state lookup. Seeded once; not user-editable.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `smallint` | PK, identity |
| `name` | `text` | `active` (1), `suspended` (2), `pending_activation` (3) |

Used by: `profiles.status_id`, `vendors.status_id`

---

### `portals`
Lookup of the three application portals. Seeded once; not user-editable.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `smallint` | PK, identity |
| `name` | `text` | `vendor` (1), `booker` (2), `command` (3) |

---

### `roles`
Platform-wide and vendor-scoped role types. Seeded once; not user-editable.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `smallint` | PK, identity |
| `name` | `text` | `root` (1), `admin` (2), `member` (3), `vendor-admin` (4) |

`root` and `admin` are platform-wide (used in `user_roles`). `member` is used in `user_roles` for standard portal users. `vendor-admin` is used exclusively in `vendor_members` — it is scoped to a specific vendor.

---

### `profiles`
One-to-one extension of `auth.users`. Created automatically on signup via the `handle_new_user()` trigger.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK, FK → `auth.users` ON DELETE CASCADE |
| `full_name` | `text` | |
| `email` | `text` | Kept in sync with `auth.users.email` via trigger |
| `phone` | `text NOT NULL DEFAULT ''` | Contact phone number |
| `notes` | `text` | Internal notes (Command use) |
| `status_id` | `smallint` | FK → `statuses`. Default `3` (pending_activation) |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger |

> A user is only considered active when `status_id = 1`. All RLS policies for authenticated data access check `public.is_active()` first. Only Command admins may change `status_id`.

---

### `user_portals`
Junction table: which portals a user has access to. Without a row here, a user cannot log in to that portal.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `uuid` | FK → `profiles` ON DELETE CASCADE |
| `portal_id` | `smallint` | FK → `portals` ON DELETE CASCADE |
| `granted_at` | `timestamptz` | |

PK: `(user_id, portal_id)`

---

### `user_roles`
Platform-wide role assignments. For vendor-scoped roles, see `vendor_members`.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `uuid` | FK → `profiles` ON DELETE CASCADE |
| `role_id` | `smallint` | FK → `roles` ON DELETE CASCADE |
| `granted_at` | `timestamptz` | |

PK: `(user_id, role_id)`

---

### `vendors`
Vendors (businesses) that sell bookable offerings. The central entity in the platform.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `name` | `text` | Vendor display name |
| `accreditation_no` | `text` | Optional accreditation/license number (nullable). Not all verticals are accredited |
| `year_established` | `smallint` | Optional |
| `address` | `text` | Full formatted address, recomputed by the app (`formatFullAddress()`) from the structured fields below on every write. Read-only display string for booker/command — those apps only ever read it, never write it |
| `address_line1` | `text NOT NULL DEFAULT ''` | Street / building / unit — free text |
| `barangay` | `text NOT NULL DEFAULT ''` | Barangay display name — PSGC reference data, strict pick (filtered by city). Paired with `barangay_code` |
| `barangay_code` | `text NOT NULL DEFAULT ''` | PSGC barangay code — authoritative for cascading lookups and edit-time dropdown resolution, not the display name |
| `city` | `text NOT NULL DEFAULT ''` | City / municipality display name — PSGC reference data, strict pick (filtered by province). Paired with `city_code` |
| `city_code` | `text NOT NULL DEFAULT ''` | PSGC city/municipality code — authoritative for cascading lookups and edit-time dropdown resolution |
| `province` | `text NOT NULL DEFAULT ''` | Province display name — PSGC reference data, strict pick. Paired with `province_code`. Includes 3 synthetic pseudo-provinces (`NCR`/"Metro Manila", `ISABELA-CITY`, `COTABATO-CITY`) for the 19 PSGC cities that have no real province |
| `province_code` | `text NOT NULL DEFAULT ''` | PSGC province code (or synthetic pseudo-province code) — authoritative for cascading lookups and edit-time dropdown resolution |
| `zip_code` | `text NOT NULL DEFAULT ''` | Postal/ZIP code — free text, 4 digits typical for PH addresses |
| `phone` | `text` | |
| `email` | `text` | |
| `tagline` | `text NOT NULL DEFAULT ''` | Short one-line vendor tagline (vendor portal) |
| `description` | `text NOT NULL DEFAULT ''` | Longer vendor description (vendor portal) |
| `website` | `text NOT NULL DEFAULT ''` | Vendor website URL (vendor portal) |
| `operating_hours` | `text` | Free-text, e.g. "Mon–Sat 8AM–5PM" |
| `branch` | `text` | Optional display label for a single campus, e.g. `"Main Branch"`. `NULL` means no branch distinction. |
| `region` | `text NOT NULL DEFAULT ''` | Geographic coverage area. Entered by Command admins; not collected during self-registration. |
| `branches` | `smallint NOT NULL DEFAULT 1` | Count of branches. Managed by Command portal only; defaults to `1` for self-registered vendors. |
| `division_id` | `smallint` | FK → `divisions`. `ON DELETE RESTRICT`, indexed. Nullable — `NULL` only for vendors that existed before this column shipped; required going forward at both self-registration and Command's manual vendor-creation form. Unrelated to `region`/`branches` — a business-vertical grouping, not geography |
| `status_id` | `smallint` | FK → `statuses`. Default `3` (pending_activation) |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger |

> Vendors default to `pending_activation`. Command admins activate them after review. Only active vendors are visible in the booker booking flow.

#### Two write paths to `vendors`

Two independent forms insert into this table:

| Writer | Location | Fields written |
|--------|----------|----------------|
| Vendor self-registration | `vendor/app/api/auth/register/route.ts` | `name`, `accreditation_no`, `year_established`, `address` (computed), `address_line1`, `barangay`, `barangay_code`, `city`, `city_code`, `province`, `province_code`, `zip_code`, `phone`, `email`, `operating_hours`, `division_id` |
| Command admin VendorFormModal | `command/components/vendors/VendorFormModal` | `name`, `accreditation_no`, `region`, `branches`, `phone`, `email`, `division_id` |

`region` and `branches` are not collected during self-registration — they default to `''` and `1`. They can be set or updated by Command admins at any time without affecting the vendor portal. `division_id`, by contrast, **is** collected at self-registration (required) — Command can still reassign it at any time via the same form.

#### `branch` vs `branches` — important distinction

| Column | Type | Purpose |
|--------|------|---------|
| `branch` (singular) | `text` nullable | A display label for the campus, e.g. `"Davao Branch"`. Set per-record. Not surfaced in the Command form. |
| `branches` (plural) | `smallint NOT NULL DEFAULT 1` | A count of how many branches the vendor has. Set via the Command admin form. |

If per-branch registration (individual branches each with their own name, address, and schedule) is ever needed, the right model is a dedicated `vendor_branches` table — not repurposing either of these columns.

**Future fields to consider:** `lat`, `lng` (geographic coordinates for map markers), `logo_path` (Supabase Storage path for vendor logo).

---

### `divisions`

> ✅ **Deployment status (re-verified 2026-08-02).** The earlier caveat here — that
> `20260724000004_divisions.sql` lived only on `feature/division_assoc_reg` and was absent
> from hosted — is **no longer true**. The migration is merged to `develop`, and
> `supabase migration list --linked` reports `20260724000004` as applied on the hosted
> project. Divisions ships via **migration, not `seed.sql`** (which inserts zero rows into
> this table), so every environment gets the 13 rows from `db push` alone.

Ezzy business-vertical taxonomy (EzzyDrive, EzzyCare, EzzyWell, EzzyCourt, EzzyFood, EzzyRide, EzzyHome, EzzyPets, EzzyLaw, EzzyPark, EzzyLearn, EzzyWork, EzzyStay). Seeded with these 13 rows; **full CRUD by Command admins** (add/edit/soft-disable) via the Divisions settings page — unlike most other lookup tables in this schema, which are seed-fixed. Every vendor is associated with exactly one.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `smallint` | PK, identity |
| `name` | `text` | Unique, e.g. `"EzzyDrive"` |
| `slug` | `text` | Unique, kebab-case, e.g. `"ezzy-drive"`. Derived from `name` client-side at creation; treated as immutable afterward (referenced by future filter URLs) though not DB-enforced immutable |
| `sort_order` | `smallint` | Default `0`. Display order |
| `is_active` | `boolean` | Default `true`. Soft-disable — hides from new vendor selection (app-layer filter, not RLS) without breaking existing `vendors.division_id` references |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger |

**RLS:** all authenticated users SELECT (needed by Command's assignment/CRUD UI — both active and disabled rows, since Command must be able to see and re-enable disabled ones); `admin`/`root` (command portal) manage (insert/update/delete) via a single `for all` policy, mirroring `kyc_document_types`. **`anon` has no grant** (matches every other table in this schema) — the vendor **registration** form is pre-account (no session yet), so it cannot read this table directly; it goes through `vendor/app/api/divisions/route.ts` (public GET, service-role) instead. See `conventions.md`'s Route Handlers list.

**Delete semantics:** `vendors.division_id` is `ON DELETE RESTRICT` — a division referenced by any vendor cannot be hard-deleted; Command's UI only ever offers disable (`is_active = false`), never delete, for exactly this reason.

---

### `vendor_members`
Junction table: user membership in a specific vendor with a per-vendor role.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `uuid` | FK → `profiles` ON DELETE CASCADE |
| `vendor_id` | `uuid` | FK → `vendors` ON DELETE CASCADE |
| `role_id` | `smallint` | FK → `roles`. Must be `member` (3) or `vendor-admin` (4) |
| `granted_at` | `timestamptz` | |

PK: `(user_id, vendor_id)` — one role per user per vendor. A user can be a member of multiple vendors (different `vendor_id` rows).

---

### `vendor_status_log`
Immutable audit trail of every vendor status change. Written only by the `log_vendor_status_change()` AFTER UPDATE trigger — never by application code. Read by the Command portal for approval history.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `vendor_id` | `uuid` | FK → `vendors` ON DELETE CASCADE |
| `changed_by` | `uuid` | FK → `profiles` ON DELETE SET NULL. The user (via `auth.uid()`) whose session triggered the change; preserved as NULL if the profile is later deleted |
| `from_status` | `smallint` | FK → `statuses`. Nullable — NULL on the first log entry if status was never explicitly set |
| `to_status` | `smallint` | FK → `statuses`. NOT NULL. The status after the update |
| `notes` | `text NOT NULL DEFAULT ''` | Optional reason recorded by the Command admin. Empty in all trigger-written rows |
| `changed_at` | `timestamptz` | Default `now()` |

Two BEFORE UPDATE triggers on `vendors` gate status changes before this log is written: `prevent_vendor_status_self_update()` (only Command admins/root may change `status_id`) and `validate_vendor_status_transition()` (enforces `pending → active|suspended`, `active ↔ suspended`). `log_vendor_status_change()` then writes this row AFTER UPDATE.

**RLS:**
- Command admins/root can SELECT all rows
- Vendor admins can SELECT rows for their own vendor (`has_vendor_role`)
- INSERT policy is `with check (false)` — no direct inserts; trigger-only writes (executed via `SECURITY DEFINER`). No UPDATE/DELETE policies

---

### `fulfilment_patterns`
The set of booking fulfilment **shapes** — who acknowledges what, in what order. Seeded by migration (`20260801000001`), not by `seed.sql`, because the FK defaults on `offerings`/`bookings` depend on the rows existing in every environment.

| Column | Type | Notes |
|--------|------|-------|
| `code` | `text` | PK, e.g. `session`. Referenced by `offerings.fulfilment_pattern` and `bookings.fulfilment_pattern`. Treat as immutable after creation |
| `name` | `text` | Display name, e.g. "Session" |
| `description` | `text` | Default `''` |
| `sort_order` | `smallint` | Default `0` |
| `is_active` | `boolean` | Default `true`. Soft-disable — hides from new offering selection (app-layer filter, not RLS) without breaking existing offerings. Mirrors `divisions.is_active` |

**Seeded rows:**

| Code | Flow | Fits |
|---|---|---|
| `session` | vendor marks done → booker confirms | exams, lessons, consults, treatments, callouts |
| `custody` | vendor hands over → booker returns → vendor confirms | vehicles, equipment, rooms, courts, bays |

**A shape, not a business category.** Business taxonomy lives in `offerings.category` (vendor-defined free text) and `divisions`. All 13 divisions collapse to these two shapes, because a shape is defined by which party can truthfully attest to which fact.

⚠️ **This table carries no behaviour — do not make the state machine data-driven.** The state machine that enforces each shape lives in `validate_booking_status_transition()`, so a row inserted here **without** a matching trigger branch is inert by design: the offering can be tagged, but no fulfilment transition will be permitted. Turning it into configuration would mean a bad seed row could let a vendor acknowledge in the booker's place and release their own money, and the transition test matrix could no longer be exhaustive. Step labels live in each app's TypeScript (`bookingActionCopy.ts`), not here — UI copy in the DB would force every client to fetch it and rule out localisation.

**RLS:** all authenticated users SELECT (the vendor offering form lists them; both portals resolve a booking's pattern for display); `admin`/`root` on the `command` portal manage via a single `for all` policy — deliberately narrow, since adding one without a trigger branch produces an inert pattern.

---

### `offerings`
Bookable services defined by a vendor. Each vendor defines its own offerings independently.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `vendor_id` | `uuid` | FK → `vendors` ON DELETE CASCADE |
| `category` | `text` | **Vendor-defined free text** (e.g. "Rental", "Coaching", "Class"). No lookup table — the distinct values across `offerings.category` drive the UI filters/suggestions. Default `''` |
| `name` | `text` | Display name, e.g. "1-Hour Court Rental" |
| `code` | `text` | Short badge, e.g. `RENT`. Max 6 chars, uppercase. Unique per vendor |
| `description` | `text` | |
| `price` | `numeric(10,2)` | Philippine Peso. Non-negative. **Per unit of duration**, not per booking |
| `duration_minutes` | `integer` | NOT NULL, default `60`, `check (> 0)`. Length of ONE bookable unit, normalised to minutes. The single source of truth for all slot and overlap arithmetic |
| `duration_unit` | `text` | NOT NULL, default `hour`. CHECK in (`minute`, `hour`, `day`, `week`, `month`). The vendor's chosen frame — and the granularity discriminator. See the note below |
| `requirements` | `jsonb` | Array of `{id, label, required}` objects defining documents bookers must upload. Default `[]` |
| `fulfilment_pattern` | `text` | FK → `fulfilment_patterns(code)`. NOT NULL, default `'session'`. Indexed. Which fulfilment *shape* this offering uses — not a business category |
| `is_active` | `boolean` | Default `true`. Inactive offerings hidden from bookers |
| `created_by` | `uuid` | FK → `profiles` ON DELETE SET NULL |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger |

Unique constraint: `(vendor_id, code)` — a code is unique within a vendor but the same code can exist at multiple vendors.

> **Categories are free text (no lookup table).** There is no `offering_categories` table; `offerings.category` is a plain text column. The UI derives the distinct category set client-side from loaded offerings (filters, the offering-form datalist of suggestions). Colour-coding uses a small fixed map for known values with a neutral fallback for custom ones.

> **Note on `requirements`:** A JSONB array of `{id: string, label: string, required: boolean}` objects. Vendor admins define these in the offering form; bookers see them in Step 4 of the booking wizard and upload a file per item. The `id` is a stable UUID generated when the item is created — it is used as the key in the booker's upload record even if the label is later edited. Items with `required: true` block progression past Step 4 until uploaded; optional items can be skipped.

> **Duration: one normalised number, two jobs for the unit.** `duration_minutes` is
> the single source of truth — every slot boundary, span and overlap calculation
> uses it and nothing else. `duration_unit` is the frame the vendor chose, and it
> does double duty: it drives rendering (1440 shows as "1 day", not "1440 minutes")
> **and it is the granularity discriminator**, because minutes alone cannot
> distinguish "1 day" from "24 hours" and only the vendor knows which they meant.
>
> ```
> granularity(unit) = minute | hour      -> time-granular (booker picks a time of day)
>                     day | week | month -> date-granular (booker picks whole dates)
> ```
>
> This is a **separate axis from `fulfilment_pattern`** and must not be folded into
> it: a 3-day training course is `session` + date-granular, a 2-hour court booking is
> `custody` + time-granular. All four combinations are real.
>
> **A `CHECK`, not a lookup table** — deliberately diverging from the
> `fulfilment_patterns` / `divisions` idiom. That idiom exists so a *third* value can
> be added without an `ALTER`; granularity is exhaustive by construction.
>
> **`month` = exactly 30 days (43,200 min).** A calendar month has no honest minute
> count, so representing one would make `duration_minutes` a lie. 30 keeps the
> arithmetic exact and matches how Postgres converts `interval → epoch`. The offering
> form states this at the point of entry rather than letting a booker discover it at
> the point of booking.

> **Price is per UNIT, not per booking.** `price_paid` is derived by
> `check_booking_consistency()` as `price * quantity` and pinned — clients do not
> supply it. See `bookings`.

---

### `staff`
Staff (people who deliver offerings — coaches, trainers, attendants) associated with a vendor.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `vendor_id` | `uuid` | FK → `vendors` ON DELETE CASCADE |
| `first_name` | `text` | NOT NULL |
| `last_name` | `text` | NOT NULL |
| `email` | `text` | Optional. `staff_email_format` CHECK validates shape when present |
| `phone` | `text` | Default `''` |
| `experience` | `text` | Free-text experience summary, e.g. "4 yrs". Default `''` |
| `status` | `text` | Default `active`. CHECK in (`active`, `on_leave`, `inactive`). Inactive staff are archived; on_leave are temporarily unavailable |
| `created_by` | `uuid` | FK → `profiles` ON DELETE SET NULL |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger |

Unique index: `staff_vendor_email_key on (vendor_id, email) where email is not null` — email is unique per vendor when provided.

The offerings a staff member is qualified to deliver live in the `staff_specialties` junction table (below), not on this table.

---

### `staff_specialties`
Junction table: the offerings a staff member is qualified for. Powers staff-to-offering assignment in the vendor portal.

| Column | Type | Notes |
|--------|------|-------|
| `staff_id` | `uuid` | FK → `staff` ON DELETE CASCADE |
| `offering_id` | `uuid` | FK → `offerings` ON DELETE CASCADE |

PK: `(staff_id, offering_id)`. Index on `offering_id`.

**Integrity:** A `check_staff_specialty_vendor()` BEFORE INSERT OR UPDATE trigger ensures the staff member and the offering belong to the same vendor — the cross-vendor constraint cannot be expressed as an FK (no shared `vendor_id` column).

**RLS:** Any active authenticated user can SELECT (non-sensitive; `staff` RLS filters at query time). Vendor admins can INSERT/DELETE specialties for their own staff (`has_vendor_role` on the staff's vendor). No UPDATE policy.

---

### `schedules`
Vendor-defined availability slots for a specific offering. Stores a recurrence rule; individual occurrence dates are expanded at application time, not stored.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `vendor_id` | `uuid` | FK → `vendors` ON DELETE CASCADE |
| `offering_id` | `uuid` | FK → `offerings` ON DELETE RESTRICT |
| `staff_id` | `uuid` | FK → `staff` ON DELETE SET NULL. Nullable |
| `title` | `text` | Display label for this schedule slot |
| `start_date` | `date` | First available date |
| `end_date` | `date` | Last available date, inclusive. NULL = open-ended. For date-granular offerings this and `start_date` **are** the availability; for time-granular it bounds the recurrence |
| `start_time` | `time` | Start of the daily availability **window** — not a bookable slot. **Nullable**: NULL for date-granular offerings, which have no time of day |
| `end_time` | `time` | End of the window. Nullable, same reason. Must be after `start_time` when both are present |
| `days_of_week` | `smallint[]` | 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun. Empty for one-time |
| `recurrence` | `text` | `none` / `weekly` / `biweekly` / `monthly` |
| `capacity_per_slot` | `integer` | NOT NULL, default **`1`**, `check (> 0)`. How many bookings may share ONE derived slot (time-granular) or one date (date-granular). Was `max_capacity` default `20`, which conflated "seats in a class" with "simultaneous holders of one asset" **and** was the only thing preventing a double-booking. Now it does exactly one job: sharing |
| `is_active` | `boolean` | Default `true` |
| `contact_name` | `text` | Optional pre-assigned contact for this slot |
| `contact_phone` | `text` | Optional |
| `created_by` | `uuid` | FK → `profiles` ON DELETE SET NULL |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger |

**Recurrence model** (time-granular only): `none` means a single occurrence on `start_date`. For recurring schedules, `days_of_week` specifies which days the schedule runs and `recurrence` controls the frequency (weekly, every two weeks, or the same week-of-month as `start_date`). Occurrence dates are expanded client-side for display — and, since `20260803000005`, **also validated in the database**, so a crafted insert can no longer book a date the schedule never runs on.

**Integrity:** A cross-vendor trigger ensures `offering.vendor_id` and `staff.vendor_id` both match `schedule.vendor_id`, preventing data mixing between vendors.

**A schedule is an availability RULE, not a bookable thing.** `start_time`–`end_time`
is the daily **window**; the bookable units inside it are **derived** by dividing that
window by the offering's `duration_minutes`. Nothing stores them — a 09:00–17:00 window
against a 1-hour offering yields eight slots, computed identically by
`check_booking_placement()` in the DB, `vendor/lib/slots.ts` in the schedule form's
preview, and `booker/lib/slots.ts` in Step 3. **If that rule changes, all three change
together**; a preview that disagrees with the trigger invites a vendor to publish slots
the database will refuse.

A **remainder is allowed and surfaced, not an error**: 09:00–17:30 at a 1-hour duration
is 8 slots plus 30 idle minutes, and the vendor form says so. Forcing an exact multiple
would reject a legitimate window.

**Two shapes, chosen by the offering's `duration_unit`:**

| Offering granularity | Uses | NULL / empty |
|---|---|---|
| time (`minute`/`hour`) | `start_time`, `end_time`, `recurrence`, `days_of_week` | `end_date` |
| date (`day`/`week`/`month`) | `start_date`, `end_date` | `start_time`, `end_time`; `recurrence` = `none`, `days_of_week` empty |

`check_booking_placement()` enforces those invariants, so a direct insert cannot create
a mismatched row even though the vendor form no longer offers one.

**A window may not cross midnight** (`schedules_end_after_start`). That is load-bearing
rather than cosmetic: it is what makes a booking's span arithmetic unable to wrap — see
`bookings`.

**Future:** `cancelled_at` for soft-cancellation of a series. A `bookings_count` denormalisation is **no longer the obvious next step** — capacity is now a per-slot overlap question, not a per-occurrence count, so a single counter column could not answer it.

---

### `bookings`
A booker's reservation of a specific schedule occurrence.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `booker_id` | `uuid` | FK → `profiles` ON DELETE RESTRICT |
| `schedule_id` | `uuid` | FK → `schedules` ON DELETE RESTRICT |
| `vendor_id` | `uuid` | Denormalised from schedule. FK → `vendors` ON DELETE RESTRICT |
| `offering_id` | `uuid` | Denormalised from schedule. FK → `offerings` ON DELETE RESTRICT |
| `booked_date` | `date` | The occurrence date selected — for a date-granular booking, the FIRST date. Validated against the recurrence rule by `check_booking_placement()` (was app-layer only) |
| `start_time` | `time` | Start of the booked slot. NULL for date-granular. **Snapshotted and pinned**, not read from the schedule |
| `end_time` | `time` | `start_time + duration × quantity`. NULL for date-granular. Derived server-side; clients never supply it |
| `end_date` | `date` | Last date of a date-granular booking, inclusive. NULL for time-granular |
| `quantity` | `integer` | NOT NULL, default `1`, `check (> 0)`. How many units were booked. Drives `price_paid` and the span |
| `status` | `text` | Nine values: `pending` / `confirmed` / `fulfilled` / `in_progress` / `returned` / `completed` / `disputed` / `cancelled` / `refunded`. CHECK constraint enforces allowed values; a BEFORE UPDATE trigger enforces valid, **actor-aware** transitions. Widened from five by `20260801000002` |
| `status_changed_at` | `timestamptz` | When `status` last changed. Nullable — NULL for rows that have never transitioned, which the auto-acknowledge job treats as not-due. Maintained by `validate_booking_status_transition()`, deliberately **not** `updated_at` (which any column write bumps — restarting a booker's acknowledgement window on an unrelated edit would be a money bug) |
| `fulfilment_pattern` | `text` | FK → `fulfilment_patterns(code)`. NOT NULL, default `'session'`. **Snapshot** of the offering's pattern at booking time, populated on INSERT and pinned against UPDATE by `check_booking_consistency()`. Clients never supply it |
| `price_paid` | `numeric(10,2)` | **Derived** as `offering.price × quantity` by `check_booking_consistency()` and pinned. Clients do not write it — before `20260803000004` the booker did, and the PayMongo route then charged whatever it found |
| `notes` | `text` | Optional booker/vendor notes |
| `rejection_reason` | `text NOT NULL DEFAULT ''` | Reason provided by vendor when rejecting/cancelling. Empty string if not applicable |
| `cancelled_by` | `uuid` | FK → `profiles` ON DELETE SET NULL. Records which user performed the cancellation or rejection |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger |

`booker_id` and `schedule_id` use RESTRICT on delete — booking history must be preserved even if a user is deactivated or a schedule is retired.

`vendor_id` and `offering_id` are denormalised for efficient RLS filtering. A trigger (`check_booking_consistency`) validates they match the referenced schedule on every insert/update.

**Unique index:** `(booker_id, schedule_id, booked_date, coalesce(start_time,'00:00'))` — a booker cannot hold the *same slot* twice, but may hold several slots on one date. The `coalesce` is load-bearing: NULLs compare distinct in a unique index, so date-granular rows would otherwise duplicate freely. Still raises `23505`, so the booker service's `"already_booked"` mapping is unchanged.

**The span is a snapshot, and immutable.** `start_time`/`end_time`/`end_date`/`quantity`/`price_paid` are all computed at INSERT and raise on UPDATE. Same reasoning as `fulfilment_pattern`: the schedule and the offering are mutable, and a vendor editing either must never move a booking that has already been sold. A booking therefore describes its own span with no join — which is why all three clients read these columns rather than joining `schedules`.

⚠️ **`time + interval` wraps in Postgres** (`23:00 + 2h = 01:00`), and an inverted range would make the overlap capacity test match nothing and pass everything. The guard is **ordering**: the window-fit check runs *before* the arithmetic, and since a schedule window cannot cross midnight, a booking that fits inside its window provably cannot wrap.

**Placement trigger:** `check_booking_placement()` (BEFORE INSERT, `20260803000005`) replaces `check_booking_capacity()`. It answers the whole "can this booking go here" question in one pass, since the parts share the same fetches: shape matches the offering's granularity, the start lands on a real slot boundary inside the window, `booked_date` is a genuine occurrence, capacity is free on **every** slot or date the booking covers, and the same booker holds nothing overlapping. It keeps the `select … for update` row lock from `20260724000003` — that is what closed the TOCTOU race — and the exact `'Schedule is fully booked'` wording, which `booker/services/bookings.service.ts` string-matches.

⚠️ **Capacity is checked PER COVERED SLOT, not as one overlap count.** With multi-unit bookings the naive version is wrong: at capacity 2, if A holds 09:00–10:00 and B holds 10:00–11:00, a new 09:00–11:00 booking overlaps *two* bookings and a flat count refuses it — yet slot 09:00 would hold {A, C} = 2 and slot 10:00 {B, C} = 2, both legal.

⚠️ **Trigger timing and NAME are both load-bearing.** BEFORE ROW triggers fire in **alphabetical order of trigger name**. `bookings_check_placement` sorts after `bookings_check_consistency`, which is the only reason the span it reads has already been computed — the old name `bookings_check_capacity` sorted *before* it. And placement is **INSERT only**, while consistency is **INSERT OR UPDATE** (pinning needs UPDATE): making placement match would re-validate every booking against the schedule *as it is now*, so a vendor narrowing a window would render existing bookings un-confirmable, un-completable and un-cancellable, and the hourly auto-acknowledge job would start raising.

**Status transition trigger:** `validate_booking_status_transition()` fires BEFORE UPDATE and is **actor-aware** as of `20260801000002` — it enforces *who* may make each move, not merely the direction, because "the booker acknowledges" is not expressible in RLS (RLS gates rows, not values). The actor is derived from `auth.uid()`; **NULL means the system actor** (service_role or the pg_cron job).

Nine states, two fulfilment shapes:

```
session:  pending → confirmed → fulfilled  ──(booker)──→ completed
custody:  pending → confirmed → in_progress ─(booker)→ returned ─(vendor)→ completed
```

| From | To | Who may |
|---|---|---|
| `pending` | `confirmed` / `cancelled` | vendor-admin, command |
| `confirmed` | `cancelled` | vendor-admin, command |
| `confirmed` | `fulfilled` *(session)* / `in_progress` *(custody)* | vendor-admin, command |
| `fulfilled` | `completed` | **booker**, system (3d), command |
| `in_progress` | `returned` | **booker**, command |
| `returned` | `completed` | **vendor-admin**, system (3d), command |
| `fulfilled` / `in_progress` | `confirmed` *(undo)* | vendor-admin, command |
| `returned` | `in_progress` *(undo)* | **booker**, command |
| `fulfilled`/`in_progress`/`returned`/`completed` | `disputed` | booker or vendor-admin |
| `disputed` | `completed` / `refunded` / `cancelled` | **command only** |
| `completed` | `refunded` | **command only** |

Three deliberate narrowings versus the pre-2026-08 machine:
1. `completed → refunded` was previously open to any caller passing RLS — including vendor-admins on their own bookings. Now Command-only.
2. **Cancellation is closed once fulfilment starts.** `fulfilled` / `in_progress` / `returned` have no path to `cancelled`; the route is `disputed`, which freezes the payout and puts a human in the loop.
3. A Command admin who is **neither** the booker nor a vendor-admin of the booking must supply a reason via the `app.status_change_note` transaction setting (see `admin_override_booking_status()`), which lands in `booking_status_log.notes`. Dispute resolution is exempt — it carries its own `resolution_notes`.

**`in_progress` has no timer, by design.** `auto_acknowledge_bookings()` never advances it: an asset that never came back must never auto-complete and pay the vendor. Command's Overview surfaces stale ones (`oversight.service.ts`) as the only escape.

**Audit trigger:** `log_booking_status_change()` fires AFTER UPDATE and writes a row to `booking_status_log` whenever `status` changes. As of `20260801000002` it also populates `notes` from `current_setting('app.status_change_note')`, so an administrative override is legible afterwards rather than looking identical to a decision the two parties made themselves.

**Payment columns:** `payment_reference text` stores the PayMongo Checkout Session ID; `is_paid boolean default false` is set to `true` by the webhook handler when payment is confirmed.

**Future:** `start_time` snapshot (so if a schedule's time changes, the booking still shows the original time), rating/review join.

---

### `booking_documents`
Files uploaded by the booker at booking time.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `booking_id` | `uuid` | FK → `bookings` ON DELETE CASCADE |
| `label` | `text` | Document name, e.g. "Valid Government ID" |
| `storage_path` | `text` | Supabase Storage object path |
| `is_required` | `boolean` | Whether this document was required at booking time |
| `uploaded_at` | `timestamptz` | |

Write-once semantics — to replace a document, delete + insert. Only bookers may insert documents for their own bookings (INSERT policy checks ownership + `is_active()`). The `pending`-only restriction applies to DELETE: bookers may remove documents only while the booking is still `pending`.

> **Current state:** Document uploads in the booker portal are in-memory only (file metadata stored in React state). Supabase Storage integration and `booking_documents` writes are a planned follow-up task.

---

### `booking_status_log`
Immutable audit trail of every booking status change. Written only by the `log_booking_status_change()` AFTER UPDATE trigger — never by application code directly. No INSERT RLS policy exists for authenticated users.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `booking_id` | `uuid` | FK → `bookings` ON DELETE CASCADE |
| `changed_by` | `uuid` | FK → `profiles` ON DELETE SET NULL. The user whose session triggered the change (via `auth.uid()`) |
| `from_status` | `text` | The status before the update |
| `to_status` | `text` | The status after the update |
| `notes` | `text NOT NULL DEFAULT ''` | The reason supplied via the `app.status_change_note` transaction setting, which Command overrides are **required** to set (`admin_override_booking_status()`). Empty for ordinary party-driven transitions. Went unwritten from `20260516000006` until `20260801000002` taught the logger to populate it |
| `changed_at` | `timestamptz` | Default `now()` |

**RLS:**
- Bookers can SELECT rows for their own bookings (`booker_id = auth.uid()`)
- Vendor admins can SELECT rows for bookings at their vendor
- Command admins/root can SELECT all rows
- No INSERT/UPDATE/DELETE policies for app users — trigger-only writes (executed as service role via `SECURITY DEFINER`)

---

### `booking_disputes`
A flag raised on a booking by either party. Freezes the vendor payout until a Command admin resolves it. **Flag-only by design** — there is no counterparty-response step and no self-service withdrawal; "Command resolves manually" *is* the model. A flag raised in error is resolved back to `completed`, the same single action that resolves a real one.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `booking_id` | `uuid` | FK → `bookings` ON DELETE CASCADE |
| `raised_by` | `uuid` | FK → `profiles` ON DELETE SET NULL |
| `raised_role` | `text` | CHECK in (`booker`, `vendor`). **Derived server-side** by the RPC from the caller's actual relationship to the booking — never accepted from the client |
| `reason` | `text` | CHECK `char_length` between 10 and 2000 |
| `status` | `text` | CHECK in (`open`, `resolved`). Default `open` |
| `resolution_notes` | `text NOT NULL DEFAULT ''` | Command's note on how this was resolved |
| `resolution_outcome` | `text` | CHECK in (`completed`, `refunded`, `cancelled`). Nullable until resolved |
| `resolved_by` | `uuid` | FK → `profiles` ON DELETE SET NULL |
| `resolved_at` | `timestamptz` | Nullable |
| `created_at` / `updated_at` | `timestamptz` | `updated_at` maintained by `set_updated_at()` |

**Indexes:** `booking_disputes_one_active_idx` — a **partial** unique index on `(booking_id) where status = 'open'`, so a booking has at most one live flag but may be flagged again after an earlier one is resolved. Plus `booking_disputes_booking_idx` and a partial `booking_disputes_open_idx on (created_at) where status = 'open'` powering Command's queue oldest-first.

**Write path — RPC only.** No INSERT/UPDATE/DELETE policies exist for `authenticated`, mirroring `booking_status_log` and `booking_transactions`. Both `SECURITY DEFINER` RPCs move `bookings.status` in the **same transaction** as the dispute row, so the two can never disagree about whether a booking is under dispute:

- `raise_booking_dispute(p_booking_id uuid, p_reason text) → uuid` — either party. Derives `raised_role`, refuses a Command admin who is neither party, rejects a second open flag, inserts, and moves the booking to `disputed` (which is what freezes the payout via `bookings_sync_payout_status`).
- `resolve_booking_dispute(p_dispute_id uuid, p_outcome text, p_notes text default '') → void` — **Command only**. Closes the flag and moves the booking to the chosen outcome.

⚠️ **Resolution text belongs in `resolution_notes`, never in `bookings.rejection_reason`.** `notify_on_booking_status_change()` treats any transition to `cancelled` carrying a non-empty `rejection_reason` as a vendor **rejection** and would email the booker "Booking Rejected" with these internal notes in the body. `resolve_booking_dispute()` deliberately never writes that column.

**RLS — SELECT only:** bookers read their own bookings' flags; vendor admins read their vendor's, gated `is_active() and has_vendor_role(...)` (the helper checks membership and role only, so without `is_active()` a **suspended** vendor-admin would keep reading dispute detail); Command admins/root read all.

> The fuller workflow (counterparty response, withdrawal, photo evidence) is a deferred follow-up. This table is a strict **subset** of that target shape, so reaching it is additive — nothing built here has to be undone.

---

### `platform_fee_settings`
Single-row global configuration: the commission percentage the platform takes from every booking payment. Seeded by migration at `0`; managed by Command admins via the Settings → Platform Fee tab. Applies across the board — there is no per-vendor rate.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `smallint` | PK, `default 1`, `check (id = 1)` — makes the table physically single-row, so no query has to decide which config row is current |
| `fee_percent` | `numeric(5,2)` | NOT NULL, default `0`, `check (>= 0 and <= 100)`. Percentage deducted from each payment |
| `updated_by` | `uuid` | FK → `profiles` ON DELETE SET NULL. The Command admin who last changed the rate. Written by the app layer — `set_updated_at()` only maintains `updated_at` |
| `updated_at` | `timestamptz` | Default `now()`; maintained by the `set_updated_at()` trigger |

**Seeded at `0` deliberately** — a migration must be environment-neutral and must never start charging vendors a fee on its own. Local dev sets a demonstration rate (12%) in `seed.sql`; production is configured through the Command UI.

**RLS:** all authenticated users SELECT (the trigger reads it via SECURITY DEFINER, and both the Command settings UI and the vendor Transactions page surface the rate); only `admin`/`root` on the `command` portal UPDATE. No INSERT/DELETE for authenticated — the single row is seed-fixed, mirroring `notification_email_settings`.

> **The rate is never applied live at read time.** It is snapshotted onto each `booking_transactions` row when payment is confirmed. Editing it affects future payments only — see `booking_transactions`.

---

### `booking_transactions`
Immutable ledger of confirmed payments — one row per booking, created the moment that booking is first paid. Holds the financial breakdown: what the booker paid, the platform's cut, and what the vendor is owed. Read by the vendor Transactions page.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `booking_id` | `uuid` | FK → `bookings` ON DELETE CASCADE. **`NOT NULL UNIQUE`** — enforces 1:1 and is the idempotency guard against the trigger firing twice |
| `vendor_id` | `uuid` | FK → `vendors` ON DELETE RESTRICT. Denormalised from `bookings.vendor_id` for efficient RLS filtering, same rationale as `bookings.vendor_id` itself |
| `amount_paid` | `numeric(10,2)` | NOT NULL. Copied from `bookings.price_paid` |
| `platform_fee_percent` | `numeric(5,2)` | NOT NULL. The `platform_fee_settings.fee_percent` value **in force when this payment was confirmed** — a historical record, not a live lookup |
| `platform_fee_amount` | `numeric(10,2)` | NOT NULL. `round(amount_paid * platform_fee_percent / 100, 2)` |
| `payout_amount` | `numeric(10,2)` | NOT NULL. `amount_paid - platform_fee_amount`. Computed from a single rounded fee value, so `platform_fee_amount + payout_amount = amount_paid` exactly |
| `payout_status` | `text` | NOT NULL, default `'held'`. CHECK in (`held`, `releasable`, `released`, `reversed`). The payout lifecycle — the one mutable part of this row. Moved by the `sync_booking_payout_status()` trigger or the Command-only `release_booking_payouts()` RPC, never by an `authenticated` write |
| `released_at` | `timestamptz` | When the platform recorded the payout as disbursed. Set alongside `payout_status = 'released'`; NULL otherwise |
| `created_at` | `timestamptz` | Default `now()`. **When payment was confirmed** — this is the transaction date the apps filter and summarise by, *not* `bookings.booked_date` (when the service occurs) |

Indexes: `booking_transactions_vendor_created_idx on (vendor_id, created_at desc)` — every read is "this vendor's transactions, newest first", optionally within a date range. `booking_transactions_payout_status_idx on (vendor_id, payout_status)` — Command's payout queue and the payable rule.

**`payout_status` transitions** (`20260801000003`): `held → releasable` when the booking reaches `completed`; back to `held` if it is flagged (`disputed`); `→ reversed` on `cancelled`/`refunded`. **`released` is never downgraded** — money that has left really has left, so a refund after release surfaces in Command's Payouts → Owed back rather than being papered over. Both vendor clients key their "payable" rule on this column, **never** on booking status.

**Write path — trigger only.** `bookings_create_transaction` (`create_booking_transaction()`, SECURITY DEFINER) fires `AFTER UPDATE OF is_paid on bookings`, guarded by `when (old.is_paid is distinct from new.is_paid and new.is_paid = true)`. That is exactly the write the PayMongo webhook performs (`booker/app/api/payment/webhook/route.ts` does `update bookings set is_paid = true ... where is_paid = false`), so **a failed, abandoned, or expired payment never produces a row here** — `is_paid` simply stays `false` and the trigger never fires. Anchoring to the *column* rather than the webhook means the ledger stays correct no matter which code path confirms a payment in future (e.g. a manual "mark as paid" admin action), and required no changes to the booker app.

**Why the fee is snapshotted, not recomputed:** so that changing the global percentage never retroactively moves a vendor's historical payout figures. Mirrors how `booking_status_log` and `vendor_status_log` preserve history rather than deriving it.

**Amended 2026-08-01 — the ledger is immutable in its FIGURES, not in every column.** `20260801000003` adds `payout_status` (`held → releasable → released`, or `reversed`) and `released_at`. `amount_paid`, `platform_fee_percent`, `platform_fee_amount` and `payout_amount` remain written-once and never recomputed, so changing the global fee still cannot move a vendor's historical figures. The payout lifecycle is explicitly mutable — but there is still **no `authenticated` write path**: it moves by trigger (`sync_booking_payout_status`) or by the Command-only `release_booking_payouts()` definer RPC.

⚠️ **`payout_status = 'reversed'` means the VENDOR will not be paid.** It says nothing about whether the *booker* was refunded — there is no refund mechanism in this system (PayMongo's refund API is never called). Never label it "Refunded" in any UI.

**Status is deliberately NOT stored here.** The financial figures must never drift, but booking status is live and mutable (`pending → confirmed → completed → refunded`); freezing it would show a booking as permanently "confirmed" after it was refunded. Readers join `bookings` for current status. Refunded/cancelled rows **stay in the ledger** (the payment really happened) but the apps exclude them from payout totals.

**No backfill.** Bookings already `is_paid = true` before this migration shipped have no ledger row — the trigger only fires on a fresh false→true transition. This was a deliberate decision: there is no historical fee percentage to snapshot for payments made before any fee policy existed, so inventing one would be more misleading than an admittedly-incomplete ledger.

**RLS:**
- Vendor admins SELECT their own vendor's rows — `is_active() and has_vendor_role(vendor_id, 'vendor-admin')`. The `is_active()` guard is **required**: `has_vendor_role()` checks membership and role only and does *not* consider profile status, so without it a **suspended** vendor-admin would retain access to financial data
- Command admins/root SELECT all rows
- No INSERT/UPDATE/DELETE policies for authenticated — trigger-only writes, mirroring `booking_status_log`. The ledger is append-only by construction

---

### `notification_type_settings`
Platform-wide on/off controls per notification type. Seeded in migration; managed by Command admins through the Notification Settings page. Disabling a type suppresses future inserts of that type — it does not delete existing rows.

| Column | Type | Notes |
|--------|------|-------|
| `type` | `text` | PK. One of 7 known values (see below) |
| `label` | `text` | Human-readable name, e.g. "Booking Confirmed" |
| `description` | `text` | Explains when/why this notification fires |
| `is_enabled` | `boolean` | Default `true`. Triggers and app-layer writes check this before inserting |

**Seeded types:**

| Type | Recipient portal | Trigger |
|------|-----------------|---------|
| `booking_confirmed` | booker | Vendor approves a booking |
| `booking_rejected` | booker | Vendor rejects a booking |
| `booking_cancelled` | booker | Vendor cancels a confirmed booking |
| `new_booking` | vendor | Booker creates a booking |
| `payment_confirmed` | vendor | PayMongo webhook confirms payment |
| `vendor_pending_approval` | command | Vendor self-registers |
| `new_user_registration` | command | Any user self-registers (source: `booker` or `vendor_admin` in `data`) |

**RLS:** All authenticated users can SELECT (needed by triggers and the app layer's `is_enabled` check). Only `admin` / `root` roles can UPDATE. No app-layer INSERT or DELETE.

---

### `notifications`
Persistent in-app alerts for all three portals. Written exclusively by SECURITY DEFINER triggers and the service-role app layer (register routes, webhook). Never written by client-side code.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `profiles` ON DELETE CASCADE |
| `portal` | `text` | FK → `portals(name)`. One of `booker`, `vendor`, `command`. Used in all queries and Realtime filter to prevent cross-portal contamination for dual-role users |
| `type` | `text` | FK → `notification_type_settings(type)` ON DELETE RESTRICT |
| `title` | `text` | Short headline |
| `body` | `text` | Full notification message |
| `data` | `jsonb` | Contextual payload (booking_id, vendor_name, booker_name, source, etc.) |
| `is_read` | `boolean` | Default `false`. Bidirectional — can be toggled back to unread |
| `is_archived` | `boolean` | Default `false`. Hides from main panel; visible in archive view |
| `created_at` | `timestamptz` | |

**Fan-out model:** Command notifications are written once per target user (one row per admin/root user). This preserves per-user read/archive state at the cost of N rows per event — acceptable at Ezzy Command scale (< 10 users).

**Write paths:**
- `notify_on_new_booking()` trigger: writes `new_booking` to all `vendor-admin` members of the booking's vendor
- `notify_on_booking_status_change()` trigger: writes `booking_confirmed` / `booking_rejected` / `booking_cancelled` to the booker
- `vendor/app/api/auth/register/route.ts`: writes `vendor_pending_approval` + `new_user_registration` to all command admins/root
- `booker/app/api/register/route.ts`: writes `new_user_registration` to all command admins/root
- `booker/app/api/payment/webhook/route.ts`: writes `payment_confirmed` to all vendor-admin members of the booking's vendor

**Lifecycle:** `is_read` is toggled by the user (bidirectional). `is_archived` hides from main panel; appears in archive view. Delete is permanent (user-initiated, with confirmation). Main panel shows `is_archived = false`; archive view shows `is_archived = true`.

**Realtime:** `notifications` is added to the `supabase_realtime` publication. Each portal subscribes to INSERTs filtered by `user_id=eq.<uid>,portal=eq.<portal>` — the `portal` filter prevents dual-role users from seeing another portal's notifications in the wrong app.

**RLS:** Users SELECT, UPDATE, and DELETE their own rows (`user_id = auth.uid()`). No INSERT policy — trigger-only and service-role writes only.

**Email dispatch:** An AFTER INSERT trigger `notifications_dispatch_email` (function `dispatch_notification_email()`, migration `20260624000003`) fires on every insert. It uses `pg_net` (`net.http_post`) to POST only the new `id` to the `send-notification-email` Edge Function, which re-reads the row with service role, renders a template, and sends via Resend. So one notification row = one email. The Edge Function URL + shared secret live in Supabase Vault (never in the migration); if they are absent (e.g. local dev without setup) the trigger no-ops so inserts and `db reset` seeding are never blocked. `net.http_post` is fire-and-forget and delivers after commit, so a send failure can never roll back or slow the insert. The three Next.js apps contain **no** Resend code — email is centralized in this one Edge Function (`backbone/supabase/functions/send-notification-email/`).

---

### `notification_email_settings`
Per-portal master switch for outbound notification emails. Seeded one row per portal (all enabled). Managed by Command admins. Gates **only** the email channel — the in-app notification still fires when a portal's email is disabled. (Contrast with `notification_type_settings.is_enabled`, which gates whether the notification row is created at all.)

| Column | Type | Notes |
|--------|------|-------|
| `portal` | `text` | PK. FK → `portals(name)`. One of `booker`, `vendor`, `command` |
| `is_email_enabled` | `boolean` | Default `true`. The Edge Function reads the target notification's portal and skips sending (log `skipped`) when this is `false` |

**RLS:** All authenticated users can SELECT (needed by the Command UI). Only `admin` / `root` roles can UPDATE. No INSERT or DELETE for authenticated — rows are seed-fixed, one per portal.

---

### `notification_push_settings`
Per-portal master switch for outbound **push** notifications — the exact counterpart of `notification_email_settings`, deliberately mirroring its shape so Command manages both channels the same way. Gates only the push channel; the in-app notification and the email are unaffected.

| Column | Type | Notes |
|--------|------|-------|
| `portal` | `text` | PK. FK → `portals(name)`. One of `booker`, `vendor`, `command` |
| `is_push_enabled` | `boolean` | Default `true`. Read by the `dispatch_notification_push()` trigger before it calls the Edge Function |

**A missing row counts as disabled, not enabled.** The trigger tests `is not true`, so a portal nobody has configured never starts pushing to lock screens.

**RLS:** All authenticated users can SELECT (Command UI). Only `admin` / `root` in the `command` portal can UPDATE. No INSERT or DELETE for authenticated — seed-fixed, one row per portal.

---

### `device_push_tokens`
One row per app install that has been granted notification permission. Written by the mobile clients for their own user; read for dispatch by `service_role` inside the `send-push-notification` Edge Function, **never by a client**.

**Shared across portals, not vendor-specific.** `ezzy-vendor-mobile` was the first consumer; `ezzy-booker-mobile` uses the same table with `portal = 'booker'`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | FK → `profiles(id)` ON DELETE CASCADE |
| `token` | `text` | `NOT NULL UNIQUE` — an `ExpoPushToken[...]`. Unique because reinstalling or restoring a backup can hand the same token to a different user; one row per token is what stops a notification reaching whoever held it previously |
| `platform` | `text` | CHECK in (`ios`, `android`) |
| `portal` | `text` | FK → `portals(name)`. Which app this install is |
| `device_name` | `text` | Nullable, for the user to recognise a device |
| `created_at` | `timestamptz` | Default `now()` |
| `last_seen_at` | `timestamptz` | Default `now()`. Touched after each successful send |

**Indexes:** `device_push_tokens_user_portal_idx` on `(user_id, portal)` — the dispatch lookup.

**Token hygiene:** the Expo Push API returns `DeviceNotRegistered` for uninstalled apps and revoked permissions; the Edge Function deletes those rows. Without that the table accumulates dead addresses and every send slows.

**RLS:** own rows only, in all four directions (`user_id = auth.uid()`). There is deliberately **no** cross-user SELECT policy — a push token is a delivery address, and dispatch runs under `service_role`, which bypasses RLS.

---

### `notification_emails`
Outbound-email delivery log and idempotency guard. One row per notification. Written exclusively by the `send-notification-email` Edge Function via service role.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `notification_id` | `uuid` | FK → `notifications(id)` ON DELETE CASCADE. `NOT NULL UNIQUE` — the uniqueness is the idempotency guard |
| `recipient_email` | `text` | The address the email was (or would be) sent to |
| `status` | `text` | CHECK in (`sending`, `sent`, `failed`, `skipped`). `sending` is the claim-first state inserted before the send, then updated to `sent`/`failed` |
| `provider_message_id` | `text` | Resend message id on success. Nullable |
| `error` | `text` | Error detail on failure. Nullable |
| `attempted_at` | `timestamptz` | Default `now()` |

**Idempotency:** the function inserts a `sending` row first; a concurrent retry hits the `unique(notification_id)` violation and bails, so a notification is never emailed twice.

**RLS:** Enabled with **no** authenticated policies — service-role-only operational data. `authenticated` has no grants either. (A command-admin SELECT policy can be added later to surface delivery failures.)

---

### `kyc_document_types`
Per-applicant-type list of **suggested** verification documents — guidance only (D-1 = B). Seeded; managed by Command admins. Not referenced by any FK: uploads carry a free-text label, so this table only drives the "Suggested: …" hint shown for the chosen applicant type. See `vendor-kyc.md`.

| Column | Type | Notes |
|--------|------|-------|
| `code` | `text` | PK, e.g. `business_permit` |
| `label` | `text` | Display name, e.g. "Business Permit" |
| `description` | `text` | Default `''` |
| `applies_to` | `text` | CHECK in (`company`, `individual`, `both`). Default `both`. Suggestions shown to a vendor = rows where `applies_to in (vendor kyc_type, 'both')` |
| `sort_order` | `smallint` | Default `0` |

**RLS:** all authenticated users SELECT (guidance is not sensitive); `admin`/`root` manage. Seeded rows cover both types (e.g. business permit, DTI/SEC registration → company; government ID, selfie with ID → individual; proof of address → both).

---

### `vendor_kyc`
One KYC header row per vendor. Carries the applicant type **and** the whole-packet review state (D-2/D-6 = B). Created by the atomic submit route (`vendor/app/api/auth/register/route.ts`) at submission time — there is no pre-submission server-side state (pre-submit progress lives in a browser draft).

| Column | Type | Notes |
|--------|------|-------|
| `vendor_id` | `uuid` | PK, FK → `vendors` ON DELETE CASCADE |
| `kyc_type` | `text` | CHECK in (`company`, `individual`) |
| `status` | `text` | CHECK in (`submitted`, `approved`, `rejected`). Default `submitted` |
| `review_notes` | `text` | Reviewer notes (shown to the vendor on rejection). Nullable |
| `reviewed_by` | `uuid` | FK → `profiles` ON DELETE SET NULL. The Command reviewer |
| `reviewed_at` | `timestamptz` | Nullable |
| `submitted_at` | `timestamptz` | Default `now()` |

**RLS:** vendor admins SELECT their own header and may UPDATE it to resubmit (rejected → submitted); Command admins/root SELECT all and UPDATE the review fields. Approve/reject writes here. KYC approval is currently **advisory** — it does not hard-gate `vendors` activation (deferred; see `vendor-kyc.md`).

---

### `vendor_kyc_documents`
One row per uploaded KYC file (file bytes live in the `vendor-kyc` Storage bucket; rows are metadata). Free-form label per document (D-1 = B). Mirrors `booking_documents`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `vendor_id` | `uuid` | FK → `vendor_kyc(vendor_id)` ON DELETE CASCADE |
| `label` | `text` | Vendor-provided free text, e.g. "Business Permit". The identity photos are stored as `"Valid ID"` / `"Selfie with ID"` |
| `storage_path` | `text` | Object path in `vendor-kyc`: `{vendor_id}/{uuid}-{filename}` |
| `uploaded_at` | `timestamptz` | Default `now()` |

Write-once (replace = delete + insert). **RLS:** vendor admins SELECT their own docs and may INSERT/DELETE **only while the header is `rejected`** (the resubmit window); Command admins/root SELECT all. No UPDATE. Deleting a doc during resubmit also removes its Storage object (app-level cleanup in `resubmitKyc`) — a `db reset` alone would orphan the blobs.

---

## Storage buckets

| Bucket | Public | Limits | Path convention | Access |
|--------|--------|--------|-----------------|--------|
| `vendor-kyc` | No (private) | 10 MB; `image/jpeg`, `image/png`, `application/pdf` | `{vendor_id}/{uuid}-{filename}` | `storage.objects` RLS keyed on `(storage.foldername(name))[1]::uuid` = vendor id: vendor admins read own + write while `rejected`; Command admins read all. Viewed via time-limited signed URLs only |

> Booking-document uploads (`booking_documents`) are **not** yet wired to Storage — still in-memory in the booker UI (see `portals.md`). `vendor-kyc` is the first live bucket. **`db reset` never deletes Storage blobs** — use `backbone/scripts/wipe-kyc-storage.mjs` to reclaim space (see `vendor-kyc.md`).

---

## Delete Behaviour Summary

| Relationship | On Delete |
|-------------|-----------|
| `auth.users` → `profiles` | CASCADE |
| `profiles` → `user_portals`, `user_roles`, `vendor_members` | CASCADE |
| `profiles` → `notifications` | CASCADE |
| `notifications` → `notification_emails` | CASCADE |
| `vendors` → `offerings`, `staff`, `schedules` | CASCADE |
| `vendors` → `vendor_status_log` | CASCADE |
| `vendors` → `bookings` | RESTRICT |
| `offerings` → `schedules` | RESTRICT |
| `offerings` → `staff_specialties` | CASCADE |
| `staff` → `staff_specialties` | CASCADE |
| `schedules` → `bookings` | RESTRICT |
| `bookings` → `booking_documents` | CASCADE |
| `bookings` → `booking_status_log` | CASCADE |
| `bookings` → `booking_transactions` | CASCADE |
| `bookings` → `booking_disputes` | CASCADE |
| `fulfilment_patterns` → `offerings`, `bookings` | NO ACTION (Postgres default) — a pattern in use cannot be deleted |
| `booking_disputes.raised_by` / `.resolved_by` → `profiles` | SET NULL |
| `vendors` → `booking_transactions` | RESTRICT |
| `vendors` → `vendor_kyc` | CASCADE |
| `vendor_kyc` → `vendor_kyc_documents` | CASCADE |
| Staff → schedules | SET NULL |
| Profile → offerings, schedules, staff | SET NULL (created_by) |
| `bookings.cancelled_by` → `profiles` | SET NULL |
| `booking_status_log.changed_by` → `profiles` | SET NULL |
| `vendor_status_log.changed_by` → `profiles` | SET NULL |
| `platform_fee_settings.updated_by` → `profiles` | SET NULL |

RESTRICT is used on relationships where deletion would leave orphaned financial or booking records. SET NULL preserves the record when its creator is removed.

---

## RLS Philosophy

See `auth-roles.md` for the full access control model. Schema-level summary:

- RLS is enabled on every table without exception.
- All RLS policies call one or more of the helper functions (`is_active()`, `is_portal_member()`, `has_role()`, `has_vendor_role()`, `is_vendor_member(uuid)`) defined in `20260504000002_schema.sql`. These helpers are `SECURITY DEFINER` to avoid recursion.
- **`has_vendor_role()` and `is_vendor_member()` do not check whether the caller is active.** They test membership and role only, so a **suspended** user still passes them. Every vendor-scoped policy must therefore be written as `is_active() and has_vendor_role(...)` — see `bookings`, `booking_status_log`, `booking_transactions`. Omitting `is_active()` silently leaves suspended vendor staff with read access. (Command-admin policies are gated by `is_portal_member('command') and has_role(...)` instead and do not add `is_active()`, matching the existing policies on those same tables.)
- **`get_booker_contacts(p_vendor_id uuid)` RPC** (`20260620000002_booker_contacts_rpc.sql`): a `SECURITY DEFINER` function returning `booker_id / full_name / email / phone` for bookers who have booked a given vendor. `profiles` RLS only permits self + Command-admin reads, so a vendor-admin's profile join returns null; this RPC lets vendor-admins surface booker contact details for their own bookings. Scoped two ways — the caller must be a `vendor-admin` of `p_vendor_id` (`has_vendor_role`), and only bookers who actually booked that vendor are returned. It exposes only the three contact columns, never `notes`/`status_id`. `EXECUTE` granted to `authenticated` and `service_role` (not `anon`).
- **The fulfilment write paths are `SECURITY DEFINER` RPCs, not RLS.** RLS gates *rows*, not *values*, so "only the booker may acknowledge" is not expressible as a policy. Four definer functions carry those writes, each re-checking the caller itself:

  | RPC | Caller | Effect |
  |---|---|---|
  | `acknowledge_booking(uuid, boolean)` | the booker | The booker's **only** write path to `bookings.status` (`fulfilled → completed`, `in_progress → returned`, and the `returned → in_progress` undo) |
  | `raise_booking_dispute(uuid, text)` | booker or vendor-admin | Flags a booking and freezes the payout, in one transaction |
  | `resolve_booking_dispute(uuid, text, text)` | Command admin/root | Closes the flag and moves the booking to the outcome |
  | `release_booking_payouts(uuid[])` | Command admin/root | Bulk `releasable → released`. Takes **`booking_transactions` ids**, not booking ids |
  | `admin_override_booking_status(...)` | Command admin/root | Third-party override; **reason required**, lands in `booking_status_log.notes` |

  `auto_acknowledge_bookings()` is the fifth writer — an hourly `pg_cron` job running as the system actor (`auth.uid()` NULL). It promotes `fulfilled`/`returned` after 3 days, **never** `in_progress`, and (since `20260801000009`) never promotes a `fulfilled` booking before its `booked_date` in Asia/Manila.

- Policies follow the principle of least privilege: read access is only granted to the specific roles that need it, not to `authenticated` broadly (with narrow exceptions for lookup tables and the booker-readable vendors policy).
- **Table-level GRANTs are required in addition to RLS.** PostgREST enforces table privileges *before* RLS runs, and the `public` default privileges grant the API roles no DML. Every new table must add explicit `GRANT`s (in its own migration) following `20260620000001_api_role_grants.sql`: `anon` gets none, `authenticated` gets only the operations its RLS policies permit (never `TRUNCATE`), `service_role` gets full DML. Skipping this makes the table return `permission denied` for logged-in users even with correct RLS.

---

## Future Schema Additions

The following tables are anticipated but not yet created. They should follow the same migration and RLS conventions.

| Table | Purpose | Notes |
|-------|---------|-------|
| `wallet_accounts` | Booker wallet balance | One row per booker profile |
| `wallet_transactions` | Credits, debits, booking payments | Immutable ledger rows. **Not the same thing as `booking_transactions`** (which already exists): that one records the platform-fee/payout split of a confirmed booking payment. `wallet_transactions` would be a booker-side balance ledger. Do not conflate them |
| `reviews` | Booker reviews of vendors post-booking | One review per completed booking |
| `vendor_photos` | Gallery images for vendor profiles | Supabase Storage paths |

> When adding these, consider whether they need to be visible across portals and design RLS accordingly before writing the migration — and include the table-level `GRANT`s (see the RLS Philosophy note above), or logged-in reads will fail with `permission denied`.
