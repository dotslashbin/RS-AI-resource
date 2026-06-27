# Vendor Bookings — Show Booker Name, Email & Contact

**Date:** 2026-06-20
**App / scope:** `backbone` (RLS migration) + `vendor` (service, types, UI) — user has branched both
**Status:** ✅ IMPLEMENTED (2026-06-20) — B1 + I1–I3 executed and verified (RPC allow/deny test + vendor build green). **User action remaining:** `supabase db reset` to apply the migration locally.

> Make the vendor portal's bookings show *who* booked: the booker's full name, email, and phone. Today the name renders blank and there is no contact info, because RLS blocks a vendor-admin from reading booker profiles and the query/UI don't fetch or display email/phone.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local.

---

## Scope

**In:** vendor bookings list shows booker `full_name`, `email`, `phone`. Requires one backbone RLS migration + vendor service/type/UI changes.
**Out:** brand rename (EzzyBook — deferred); booker & command portals; wallet/packages; any new data capture (booker phone is already collected at registration — see Findings).

**Touches two repos** (backbone + vendor) — expected for a DB-backed feature; both already branched. No change to `booker` or `command`.

---

## Findings (verified in code, 2026-06-20)

- **The name is already wired but blocked by RLS.** `vendor/services/bookings.service.ts` already selects `profiles!booker_id(full_name)` and maps `bookerName`; `BookingRow.tsx:32` already renders `b.bookerName`. It shows blank because **`profiles` RLS has only two SELECT policies** (`users can read own profile`, `command admins can read all profiles` — `rls.sql:44,49`). A vendor-admin matches neither, so the embedded `profiles` join returns `null` → `bookerName = ""`.
- **Email & phone are never fetched.** The select lists only `full_name`; the `Booking` type (`vendor/lib/types.ts:12`) has `bookerName` but no `bookerEmail`/`bookerPhone`.
- **The data exists.** `profiles` has `full_name`, `email`, and `phone` (`phone` added in `20260515000003_profiles_phone.sql`). Bookers supply a validated phone at registration (`booker/app/api/register/route.ts:68` writes `profiles.phone`), so these fields are populated for real bookers.
- **Table grant is already in place.** `authenticated` has `SELECT` on `profiles` (from `20260620000001_api_role_grants.sql`), so this is purely an RLS row-visibility gap, not a privilege gap.
- **`profiles.email` stays in sync** with auth via `handle_user_email_update()` — the email shown will be current.

---

## Risk surface (engineering-start §4)

- **PII exposure.** This intentionally exposes a booker's email + phone to vendor-admins. That is the point (a vendor must be able to contact its customer), but the RLS policy must be **tightly scoped**: a vendor-admin may read a profile **only if that booker has a booking with a vendor the admin administers** — never arbitrary profiles. The plan's verification explicitly tests the *deny* path (an unrelated vendor-admin must not read the profile).
- **No secrets/credentials involved.** No service-role usage; all reads go through the authenticated client under RLS.
- **Worst case if the policy is too broad:** any vendor-admin could read every user's contact info. Mitigated by scoping the policy through `bookings` + `vendor_members` and RLS-testing both allow and deny.

---

## BLOCKERS

### B1 — Vendor-admins cannot read their bookers' contact info  ✅ DONE (2026-06-20)
<!-- ✅ DONE (2026-06-20) — wrote 20260620000002_booker_contacts_rpc.sql. Verified in a rolled-back txn against the live DB: marco (Citywide admin) → Liza; dante (Summit admin) → Sofia; cross-vendor calls (marco→Summit, dante→Citywide) → 0 rows. Returns only name/email/phone. Needs `supabase db reset` to apply locally. -->

**Design (finalized per D4 = scoped accessor):** instead of a whole-row `profiles` SELECT policy, add a `SECURITY DEFINER` RPC that returns **only** `full_name/email/phone` for bookers of a given vendor, callable only by that vendor's admins. No `profiles` policy is added, so internal `notes`/`status_id` are never exposed.
**File:** **new migration** `backbone/supabase/migrations/20260620000002_booker_contacts_rpc.sql`
**Gap it closes:** today `profiles` RLS (`rls.sql:44,49`) only allows self + command-admin reads, so a vendor-admin's `profiles` join returns null → `bookerName` blank, and email/phone aren't fetchable at all.

**Exact change (to write at execution — not before user review):**
```sql
-- 20260620000002_booker_contacts_rpc.sql
-- Returns name/email/phone of bookers who booked a given vendor, only to that
-- vendor's admins. SECURITY DEFINER (bypasses RLS); authorization enforced by
-- has_vendor_role on the caller. Only 3 columns — never notes/status.
create or replace function public.get_booker_contacts(p_vendor_id uuid)
returns table (booker_id uuid, full_name text, email text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email, p.phone
  from public.profiles p
  where public.has_vendor_role(p_vendor_id, 'vendor-admin')   -- caller must admin this vendor
    and exists (
      select 1 from public.bookings b
      where b.booker_id = p.id and b.vendor_id = p_vendor_id
    );
$$;

-- Tighten execute: not anon.
revoke all on function public.get_booker_contacts(uuid) from public;
grant execute on function public.get_booker_contacts(uuid) to authenticated, service_role;
```

**Why this shape (D4 = b):** `auth.uid()` inside a `SECURITY DEFINER` function still resolves to the *caller*, so `has_vendor_role(p_vendor_id,'vendor-admin')` is the authorization gate — pass a vendor you don't administer and it returns 0 rows. Returns a fixed 3-column shape, so `notes`/`status_id` can never leak even though the function reads `profiles`.

**Blast radius:**
- **Data:** none — adds one function; no rows touched.
- **Scope (✅ reviewed 2026-06-20):** an admin can only retrieve contacts for **(a)** a vendor they are `vendor-admin` of, and **(b)** bookers who actually booked that vendor. Other vendors' bookers, non-bookers, and plain `member`s → 0 rows. No enumeration of arbitrary profiles. Column-limited to name/email/phone (resolves the earlier notes/status concern).
- **Lock/perf:** function creation is instant. At call time: one `EXISTS` over `bookings` by `(booker_id, vendor_id)` — covered by the `UNIQUE (booker_id, schedule_id, booked_date)` index prefix; fine at MVP scale.
- **Downstream:** **no `gen types` needed** (a function doesn't change generated table types; the RPC is called untyped/cast in the service). Enables I1–I3.
- **Reversibility:** `drop function public.get_booker_contacts(uuid);` in a follow-up migration.

---

## IMPORTANT

### I1 — Fetch booker contacts via the RPC and merge onto bookings  ✅ DONE (2026-06-20)
<!-- ✅ DONE (2026-06-20) — bookings.service.ts: dropped the profiles embed; parallel bookings query + get_booker_contacts RPC; merge by booker_id. Vendor build green. -->

**File:** `vendor/services/bookings.service.ts` (`getBookings`, `BookingRow` type, `toBooking`)
**Gap:** select currently embeds `profiles!booker_id(full_name)`, which returns null under RLS (B1 closes this) and never had email/phone.
**Fix approach (per D4 = accessor):** **drop the `profiles!booker_id(...)` embed.** Run the bookings query and `supabase.rpc("get_booker_contacts", { p_vendor_id: vendorId })` in parallel; build a `Map<booker_id, {full_name,email,phone}>`; in `toBooking`, set `bookerName/bookerEmail/bookerPhone` from the map (fallback to `""`). Remove `profiles` from the `BookingRow` type. (Depends on B1.)

### I2 — Add `bookerEmail` / `bookerPhone` to the `Booking` type  ✅ DONE (2026-06-20)
<!-- ✅ DONE (2026-06-20) — added both fields to interface Booking in vendor/lib/types.ts. -->

**File:** `vendor/lib/types.ts:12-15`
**Fix approach:** add `bookerEmail: string` and `bookerPhone: string` to `interface Booking` (alongside `bookerName`).

### I3 — Display name + email + phone in the bookings UI  ✅ DONE (2026-06-20)
<!-- ✅ DONE (2026-06-20) — BookingRow.tsx: muted "email · phone" line under the name, rendered only when at least one is non-empty (omit-empty). Build green. Live browser check pending db reset. -->

**File:** `vendor/components/bookings/BookingRow/BookingRow.tsx` (renders `b.bookerName` at line 32)
**Fix approach (per D2 inline + D3 omit-empty):** under the booker name line, render a muted line joining the non-empty contacts — `[b.bookerEmail, b.bookerPhone].filter(Boolean).join(" · ")` — and render nothing if both are empty. Existing avatar/initials now populate (the name resolves via I1's RPC merge).
**Note (no code yet):** `bookerName` is also consumed by `dashboard/PendingApprovalsCard` and `calendar/CalendarPage`. Those read the same `bookings` array from `useAppShell` → once I1 populates `bookerName` via the RPC merge, the blank name is fixed there automatically. Adding email/phone there is **out of scope** unless requested.

---

## DECISIONS — all resolved 2026-06-20

- **D1 — expose booker email + phone to vendor-admins?** → **Yes: name + email + phone**, scoped to the admin's own bookers.
- **D2 — how to display contact?** → **Inline under the name** (muted `email · phone` line beneath the name).
- **D3 — render empty fields?** → **Omit a field when empty** (no dangling separators).
- **D4 — column exposure (whole-row policy vs. scoped accessor)?** → **(b) Scoped accessor** — `get_booker_contacts(vendor_id)` `SECURITY DEFINER` RPC returning only `full_name/email/phone`; **no `profiles` SELECT policy**. Reshaped B1 and I1 accordingly. Never exposes `notes`/`status_id`.

---

## DEFERRED / COSMETIC

- **Index tuning for the policy `EXISTS`** — acceptable to defer; current indexes cover the lookups at MVP scale. Revisit if `profiles` reads by vendors become hot.
- **Email/phone on dashboard PendingApprovals & Calendar** — deferred; the request is the bookings list. B1 already restores the *name* there.
- **Brand rename (EzzyBook)** — deferred to the coordinated code/DB pass.

---

## Execution order

1. **B1** backbone migration (approval gate) → user runs `supabase db reset` to apply locally. No `gen types`.
2. **Coupled batch (ship together):** I2 (type) → I1 (service) → I3 (UI). These are inert without B1 (name stays blank, no contact), so they land in the same change as B1.
3. Verify (below).

---

## Verification

- **B1 (machine-verifiable via psql RLS simulation):**
  - *Allow:* as a Citywide vendor-admin (`marco`/`jose`/`maria`), SELECT the profile of `liza` (who booked Citywide) → returns the row.
  - *Deny:* as a Summit-only vendor-admin (`dante`), SELECT `liza`'s profile → **0 rows** (liza didn't book Summit); and as any vendor-admin, SELECT an unrelated non-booker profile → **0 rows**.
  - Confirm the two existing profiles policies still behave (self-read; command admin read-all).
- **I1/I2 (machine-verifiable):** `npm run build` / `tsc --noEmit` green in vendor.
- **I3 + end-to-end (needs live environment):** after `db reset`, log into vendor as a Citywide admin, open Bookings → liza's row shows name, email, phone; a vendor with no related bookings shows none of another vendor's bookers.

---

## Open items
- ✅ D1–D4 resolved; ✅ B1 + I1–I3 implemented and verified (2026-06-20).
- ⬜ **User:** run `supabase db reset` to apply `20260620000002` locally, then browser-check the vendor Bookings page (name + email show; phone shows for real registered bookers — blank for seeded ones).
