# Vendor account completion — onboarding checklist + payout details

**Date:** 2026-08-15
**App / scope:** `vendor/` (web portal) + `backbone/supabase/migrations/` (two new tables)
**Status:** ✅ **COMPLETE (2026-08-16)** — Phase 1 (stages 1–7), Phase 2 (stages 7.5–10)
and the follow-ups (G17, G24, I12) all executed and verified on local. Migrations applied
by the user and the app tested by hand. **Not yet pushed to hosted** — the user is doing
that separately, and until then none of this exists anywhere but local.
Deferred/parked work moved to `.plans/2026-08-16-payout-deferred-followups.md`.
⏸ **Not on hosted:** `supabase db push` is deliberately held by the user until they have
tested the feature end to end. Until it runs, none of this works anywhere but local.
⏸ Three couplings remain out of scope by decision — **C2 is the one that matters**: Ezzy
staff still cannot read a payout destination, so nothing is payable yet.

> A newly registered vendor should be able to see, at a glance, what still stands
> between them and a working, payable account. Two requirements, one authoritative
> calculation, and a payout store that is safe to hold real money destinations in.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "command I1").

---

## Scope

**In:** the vendor web portal (`vendor/`), plus the shared Supabase schema it needs.

**Out, deliberately:**
- `ezzy-vendor-mobile` — no completion modal, no payout settings. See **C1**.
- `command/` — Ezzy staff cannot yet *see* a vendor's payout destination. See **C2**.
- `booker/` — untouched.
- Actually moving money. There is no payout rail (see "The payout mechanism, actually" below) and this plan does not build one.

---

## The payout mechanism, actually — read this before the data model

The brief asked to verify the payout integration before designing around it. The
answer is unambiguous and it changes several requirements.

**There is no payout rail in this system.** Grounded in:

- `booker/app/api/payment/create-session/route.ts:51` — the only PayMongo call in
  the entire workspace is `POST /v1/checkout_sessions`. That is **collection**.
  `payment_method_types` there (`card, gcash, grab_pay, paymaya, billease, qrph`)
  are how a *booker pays in*, and must not be mistaken for disbursement rails.
- `booker/app/api/payment/webhook/route.ts` — sets `bookings.is_paid`. Also inbound.
- `20260801000008_payout_release_and_override.sql:49` — `release_booking_payouts()`
  "**RECORDS the disbursement — it does not move money; there is no payout rail in
  this system.**"
- `architecture/portals.md:493` — "**No payout rail.** The Payouts page marks a
  payout `released`, recording a transfer made somewhere else."
- `architecture/schema.md:703` — PayMongo's refund API is never called either.

### Consequences for this plan

| Brief's assumption | Reality here |
|---|---|
| A payout provider dictates required recipient fields | No provider. The consumer InstaPay/PESONet field set (institution + account name + account number) **is** the correct requirement, because a human at Ezzy is the one making the transfer |
| Provider beneficiary IDs / tokenization may be available | **Not available.** Nothing to tokenize against. Raw details must be stored — which is precisely why B2's encryption design matters more here, not less |
| Extra fields (institution code, address, KYC) may be required | None are. KYC is already collected separately (`vendor_kyc`, see `architecture/vendor-kyc.md`) and must not be duplicated here |
| Maya needs its own field set | It does not. A Maya Wallet transfer over InstaPay uses "Maya Philippines, Inc." as the institution and the **11-digit Maya-registered mobile number as the account number** — structurally identical to GCash. Both are modelled as `{ accountName, mobileNumber }` |

**Schema versioning (`schema_version`) earns its place because of this**, not despite
it: when a disbursement provider *is* adopted, its required fields land as `version: 2`
of an existing method type without a destructive migration.

⚠️ **Nothing in this plan makes a vendor payable.** It makes them *collectable-from-safely*.
The payout destination is stored encrypted and **no one can read it yet** — see **C2**.

---

## Gap review (2026-08-15)

Second pass over the draft, verifying claims against the code rather than re-reading
the prose. Findings are folded into the items below; recorded here so the reasoning
survives.

| # | Class | Finding |
|---|---|---|
| **G1** | 🔴 **Escalate** | **Authorisation hole in the draft's B4.** `20260504000003_rls.sql:187-190` — `"users can read their own vendor memberships" using (auth.uid() = user_id)` carries **no `is_active()`**. Permissive policies are OR'd, so a **suspended** profile can still read its own `vendor_members` row. The draft's route inferred authorisation from row visibility, which would therefore have let a suspended vendor-admin change a payout destination. Fixed in **B4** — all three documented access layers are now checked explicitly |
| **G2** | Real gap | `display` was `jsonb` with no shape constraint — violating both the brief's "do not use arbitrary, unvalidated JSON" and supabase-exp §6. CHECK constraint added in **B1** |
| **G3** | Real gap | Reading `PAYOUT_ENCRYPTION_KEY` at module scope fails `next build` on any machine without it set. **B2** now reads it lazily inside the call and validates it decodes to exactly 32 bytes |
| **G4** | Real gap | `upsert` cannot conditionally set `created_by` on insert only. **B4** now branches insert/update on the existing-row read it already performs for the audit log |
| **G5** | Real gap | `DELETE` with a request body is awkward and inconsistently supported. **B4** takes `?vendorId=` instead |
| **G6** | Real gap | The completion provider must sit **after** `AppShell`'s early returns (`AppShell.tsx:42-81`), or it fetches on the login, KYC-pending and vendor-select screens where there is no vendor. Pinned in **B6** |
| **G7** | Real gap | `/ui-gallery` renders components against hand-built props with **no DB** (`ui-gallery/page.tsx:3-7`). A fetching `PayoutDetailsCard` can only ever show its loading state there — the `kycstatus` precedent (`ui-gallery/page.tsx:484-487`). **B8** now splits two pure presentational children the gallery renders directly. This is a design improvement, not a test accommodation |
| **G8** | Real gap | Decrypt must reject an unrecognised version prefix, and reads must check `schema_version`. Added to **B2**/**I4** |
| **G9** | Real gap | CSRF was not addressed. A money-adjacent cookie-authenticated write needs it stated. `lib/supabase/server.ts` passes no cookie options, so `@supabase/ssr` defaults apply — `SameSite=Lax`, which does not send cookies on cross-site `PUT`/`DELETE`. **Reasoned, not observed** — added as a browser-verified check in **B4** |
| **G10** | ✅ **False alarm** | I suspected adding a card to `SettingsPage` would break a committed visual baseline. **It does not.** `visual-tests/pilot.spec.ts-snapshots/` has no `settings-*.png`, and `grep -n "settings" visual-tests/pilot.spec.ts` returns nothing — the `mode=settings` fixture is wired up but never driven. Dropped |
| **G11** | ✅ Verified, not a gap | I was unsure whether `npm test`'s `"lib/**/*.test.ts"` glob picks up **nested** files, since every existing test is flat in `lib/`. **Probed it live**: a throwaway `lib/__globprobe/sub/probe.test.ts` moved the count 145 → 146 and printed. `lib/payout/*.test.ts` will run. Confirmed by execution, not assumed |
| **G12** | ✅ Verified, not a gap | The draft hedged on whether `components/ui/Combobox` fits the bank picker. `useCombobox.ts:16,25` resolves `value → label` through the options list and re-syncs on change, and `strict` discards unmatched typed text on blur (`:44`). Exact fit. Hedge removed from **B8** |
| **G13** | Noted, deliberate | The **B1** read policy uses `is_active() and has_vendor_role(...)` but does **not** require the *vendor* to be active, while **B4**'s write path does. Asymmetric on purpose: a suspended vendor reading their own already-masked destination is harmless; a suspended vendor *changing* where money goes is not |
| **D7** | New decision | The "Create offering" CTA landing on a mostly-blank Offerings page is a weak reading of "reuse the existing Offering workflow". Resolved in **DECISIONS** |
| **G24** | ✅ **FIXED 2026-08-16** — corrective migration `20260816000002_completion_view_service_role_grant.sql` written and rollback-probed 4/4 (gap confirmed present, grant applies, `anon` still has nothing, no write privileges added, clean rollback). ⚠️ **Awaiting the user's apply.** Original finding: | `20260816000001` granted `SELECT` on `vendor_account_completion` to `authenticated` but **not to `service_role`**, which holds only the inherited `TRUNCATE/REFERENCES/TRIGGER`. Every comparable table grants service_role SELECT. **Not a live bug** — every reader of the view is `authenticated` — but the first server-side reader will hit `permission denied for view`. Needs a one-line follow-up migration: `grant select on public.vendor_account_completion to service_role;` |
| **G25** | 🔴 **Real defect, found by Strict Mode (2026-08-16)** | Opening the payout modal wrote **two** `vendor_payout_view_log` rows for one click. The fetch has a **server-side side effect** (decrypt + audit row) and was not idempotent; React Strict Mode's double-invoke surfaced it. Production would not double-invoke, but relying on that leaves the log double-counting on any genuine remount — and an audit log that reads "this admin opened vendor X twice in one second" is misleading for exactly the review it exists to support. Fixed with a `requestedFor` ref. ⚠️ **The first fix introduced a second bug:** combined with the existing `cancelled` flag it deadlocked — the cleanup discarded the first response and the guard blocked the second request, so the modal loaded forever. The flag was solving the same problem as the guard, so it was removed. Both states observed, not theorised |
| **G23** | ✅ **Duplication avoided mid-execution (2026-08-16)** | Command's three-layer caller check lived as a private `verifyCaller` inside `app/api/users/route.ts`, and B10 needed the same check. Extracted verbatim to `lib/commandAuth.server.ts` rather than copied — a duplicated security check is one that drifts, and it would be found to have drifted at the worst possible moment. `PRIVILEGED_ROLES` moved with it, since `users/route.ts` uses it for a different question that must still name the same set. No behaviour change; that file's lint errors went 8 → 5 |
| **G19** | 🔴 **Escalated on review (2026-08-16)** | I had flagged the completion view as merely "caller-relative — document it". It is worse: `20260515000001` lets any **booker** read every **active** vendor, so a bare `security_invoker` view would have handed bookers a row per vendor reading `is_account_complete = false` — a **wrong** answer, not a hidden one. Fixed in the view itself with an explicit authorisation `where` clause, so it returns a correct answer or **no row**. Proven by a probe showing a booker reads the `vendors` row but gets nothing from the view |
| **G20** | ✅ **Planned duplication avoided — VERIFIED against the applied migration (2026-08-16)** | Phase 2's draft had Command duplicating `PH_BANKS` to resolve `bankCode` → bank name. Unnecessary: `display.label` already holds the resolved name, snapshotted at write time (`schema.ts:257`), in the row Command already reads. **No `ph_banks` lookup table is needed, and none should be added.** Proven as a real Command-admin session against the now-applied `20260816000001`: the admin reads the row, `display->>'label'` returns `BDO Unibank` with no join, the mask is readable, and vendors can even be **grouped by institution** via `display->>'label'` should ops ever want to batch transfers by bank. ⚠️ Note for the future: `bankCode` lives **inside the ciphertext**, so SQL can never filter on it — `display.label` is the only queryable bank identity, which is sufficient because a bank *name* is not sensitive |
| **G21** | ⚠️ **Undocumented convention (2026-08-16)** | Nothing said how to rotate `PAYOUT_ENCRYPTION_KEY`. The `v1.` prefix already supports it — a rotation mints a new version and keeps a branch for un-rotated rows — but that was only in my head, and Phase 2 puts the key in a second app. Written down as part of **B14** — ✅ now in `crypto.server.ts`'s `VERSION` doc comment: the prefix covers format *and* key generation, so rotating means minting the next version and keeping a decrypt branch until no un-rotated rows remain. No schema change is involved |
| **G22** | ✅ **Checked, not a gap (2026-08-16)** | Suspected `vendor_payout_methods` might be broadcasting ciphertext over Realtime — a default-all publication would have been a quiet leak. It is **not in `supabase_realtime`**. Verified against `pg_publication_tables`, not assumed |
| **G18** | 🔴 **Real a11y defect, caught by a test in stage 7 (2026-08-15)** | **The bank field's label was orphaned.** `PayoutMethodFields` rendered `<label htmlFor="payout-bank">` but `components/ui/Combobox` had no `id` prop, so nothing carried that id — clicking the label focused nothing and assistive tech never associated the two. Found because the Playwright assertion used `getByLabel("Bank")`, which is close to how a screen reader resolves a field; a `locator("#…")` assertion would have passed and hidden it. Fixed in the **shared component**, not the caller: `Combobox` now forwards optional `id` and `aria-label` to its inner input. Additive and optional, so existing callers render byte-identically — confirmed by the full 112-test visual suite |
| **G17** | ✅ **FIXED 2026-08-16** (owned by radix-dialog I8, done there) | The three `ui-gallery calendar-*` visual tests fail on ~75 pixels (one cell). **This is the same defect as `.plans/2026-08-15-vendor-form-modals-to-radix-dialog.md` → I8**, found independently there first. Two plans recording one defect and both disclaiming it ("not this plan's bug" / "not caused by this work") is how a defect ends up with no owner — so **this plan defers to that one**, which also carries the deeper diagnosis. ⚠️ **Do not restate or re-fix it here.** Their root cause, verified 2026-08-16: `pilot.spec.ts:36,41` freezes the clock at 2026-08-08 with `page.clock.setFixedTime`, but `useCalendarPage.ts:18-19` reads the date in `useState(() => phToday())` — a lazy initialiser that runs on first render, which in Next is **on the server**, where `page.clock` has no effect. The freeze added to fix exactly this class of failure structurally cannot reach the calendar. Fix belongs there: an SSR-visible clock, or dating the fixture via a `?today=` param the way `?theme=` is already forced |
| **G15** | 🔴 **Real defect in the plan's own rule, caught in stage 3 (2026-08-15)** | **The audit-log dedupe rule as written would have suppressed real changes.** B4's draft said to skip the log row "when `to_type` and `to_display` both equal the previous row's". But `display` is *masked*: account numbers `001234567890` and `999934567890` at the same bank both mask to `••••••••7890`. A vendor redirecting their payouts to a different account at the same bank would therefore have compared equal and **gone unlogged** — silently defeating the one control that makes a fraudulent change reviewable, which is the entire reason the log exists (and the compensating control D6 leans on for having no re-auth gate). Fixed: the comparison now decrypts the stored blob and compares the real details via `detailsEqual`, and returns *false* when the blob cannot be read, so an unreadable row logs rather than skips. e2e assertion 3 covers it explicitly |
| **G16** | ✅ Fixture bug, not a defect | The first e2e run 403'd. Cause was my test harness granting `portal_id: 2` (**booker**) instead of `1` (**vendor**) — the route was right to refuse. Incidentally a free proof that layer 1 of `assertVendorAdmin` (portal grant) genuinely denies on its own, which is the layer `verifyVendorAccess` exists to stop being skipped |
| **G14** | 🔴 **Real defect, caught pre-apply (2026-08-15)** | **The `display` CHECK as drafted did not reject a missing key.** `display -> 'masked'` on an ABSENT key returns SQL NULL; `jsonb_typeof(NULL)` is NULL; `NULL = 'string'` is NULL — and **a CHECK constraint passes when its expression is NULL**, because only FALSE fails. So `{"label":"BDO Unibank"}` with no masked value at all was accepted, and a vendor's saved destination would have rendered as a bank name with nothing identifying the account. Found by a rolled-back probe before the migration was applied. Fixed by adding explicit `jsonb_exists()` clauses on both tables, with a ⚠️ comment in the file so the lines are not "simplified" away later. Re-probed: 19/19 pass |

---

## BLOCKERS

### B1 — `vendor_payout_methods` + `vendor_payout_method_log` (schema) ✅ DONE (2026-08-15, local only)

> ✅ **Applied to LOCAL via the user's `supabase db reset` and verified there.**
> `supabase_migrations.schema_migrations` contains `20260815000001`. Both tables exist
> with `rowsecurity = true`, both SELECT-only policies present for `authenticated`,
> grants are `SELECT` for `authenticated` / full DML for `service_role` / **nothing for
> `anon`**, and all five CHECK constraints are attached.
>
> **RLS verified under real `authenticated` sessions — 14/14 probes pass** (JWT `sub`
> set via `request.jwt.claims`, `SET LOCAL ROLE authenticated`, all inside a
> rolled-back transaction; 0 rows of residue afterwards):
> - R1–R4 an active vendor-admin sees exactly their own payout row and their own log
>   rows; **a SUSPENDED vendor-admin sees nothing** — the G1 regression, now covered
> - R5–R6 vendor A cannot read vendor B's row by naming its id, nor reach B's
>   `details_enc` by any predicate
> - W1–W6 `authenticated` is denied INSERT, UPDATE and DELETE on **both** tables,
>   confirming there is no authenticated write path and the log is append-only
> - A1–A2 `anon` is denied even SELECT on both
>
> ⏸ **NOT pushed to hosted/staging.** The user is holding `db push` until the feature
> is tested end-to-end. Until then the hosted schema lacks these tables, so nothing in
> stages 3–7 works anywhere but local.
>
> Earlier state, kept as the record: written 2026-08-15 and first checked by a
> rolled-back probe (19/19 constraint probes) before any apply — which is what caught
> **G14**.
> `backbone/supabase/migrations/20260815000001_vendor_payout_methods.sql` exists and
> matches the SQL below. Timestamp verified monotonic (latest prior migration is
> `20260808000001`); backbone repo was clean before the write.
> `architecture/schema.md` updated in the same breath — migration-history row, two
> full table sections, and three Delete Behaviour rows.
>
> **Verified by a rolled-back probe against the local DB (2026-08-15), with the user's
> explicit go-ahead for a `BEGIN … ROLLBACK` syntax check only.** The migration parses
> and builds; RLS is enabled on both tables; the two policies are SELECT-only for
> `authenticated`; `anon` receives no privileges; `authenticated` receives `SELECT`
> alone on both. **19/19 constraint probes pass** — including the two `display` shape
> CHECKs against extra keys, missing keys, JSON nulls, non-string values and an array;
> `method_type = 'paymaya'` rejected; the log's both-sides-NULL guard; removal and
> first-set log rows accepted; a withdrawn method type still writable to the log; a
> second destination for one vendor rejected by the PK; and `set_updated_at` firing.
> **Confirmed nothing persisted: 0 `vendor_payout*` tables after rollback.**
>
> ⚠️ **Still not `✅ DONE`.** The migration has never been *applied*, so
> `schema_migrations` does not know about it and no real RLS behaviour has been
> exercised — the probe ran as superuser, which bypasses RLS entirely. The policies
> are syntactically valid and correctly scoped; whether they admit and deny the right
> *sessions* is still unverified. Remaining: apply it, then run B1's live RLS checks
> from the Verification table.
>
> **Three deviations from the draft below, all deliberate:**
> 1. **The log's `to_type` / `to_display` are NULLABLE**, not `not null` with a `'none'`
>    sentinel. NULL on either side is symmetric and self-describing — `from_*` NULL is
>    the first destination, `to_*` NULL is a removal. A magic `'none'` string sitting in
>    a column that otherwise holds method types is exactly what gets misread as a real
>    method type later. Guarded by a new CHECK: at least one side must be non-NULL, so a
>    row that records nothing cannot be written.
> 2. **The log's `display` columns carry the same masked-shape CHECK** as the live
>    table (NULL permitted). The draft constrained only the live table, which would
>    have left the audit log — the copy most likely to be exported — free to hold
>    arbitrary JSON, undermining the guarantee it sits next to.
> 3. **No index on `created_by` / `updated_by`**, against the usual index-every-FK
>    rule. Stated in the file with its reason: at most one row per vendor, and those
>    columns are only ever read for a row already located by its PK.

**Files:** `backbone/supabase/migrations/20260815000001_vendor_payout_methods.sql`
**Approval gate:** ✅ writing approved 2026-08-15. 🚧 **applying is still gated** — the user runs migrations.

One row per vendor (`vendor_id` is the PK), because the UI is singular — "Choose
your payout method". Switching Bank → GCash → Maya **replaces** the row, which is
what makes every switching case in §12 of the brief fall out for free rather than
needing a "which one is current?" rule.

> ⚠️ **The SQL below is the pre-write DRAFT, kept as the record of what was approved.
> `backbone/supabase/migrations/20260815000001_vendor_payout_methods.sql` is now
> AUTHORITATIVE** and differs from it in three places: the log's nullable `to_*`
> columns and their new CHECK (deviations 1–2 above), and the `jsonb_exists()` clauses
> that close **G14**. Read the file, not this block.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Vendor payout destinations
--
-- Where a vendor is paid. There is NO payout rail in this system
-- (20260801000008 — release_booking_payouts RECORDS a disbursement made
-- elsewhere), so these details are read by a human at Ezzy making a manual
-- InstaPay/PESONet transfer. That is why there is no provider recipient token
-- here: there is no provider to hold one.
--
-- WHY details_enc IS OPAQUE TO POSTGRES
--   The sensitive half of the row (account number / mobile number / account
--   name) is AES-256-GCM ciphertext produced by the vendor app's Route Handler
--   with a server-only key that never enters this database. A dump of this
--   table yields nothing usable. `display` carries ONLY masked, already-safe
--   values, which is what every read path actually renders.
--
-- WHY THERE IS NO authenticated WRITE PATH
--   Encryption happens server-side; a browser cannot produce a valid
--   details_enc. Writes go exclusively through the service-role route
--   vendor/app/api/payout-method/route.ts, mirroring how booking_transactions
--   and notifications are written (20260725000002, 20260525000002).
--
-- Must run after: 20260504000002 (vendors, profiles, RLS helpers)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.vendor_payout_methods (
  vendor_id      uuid        primary key references public.vendors(id) on delete cascade,
  method_type    text        not null check (method_type in ('bank','gcash','maya')),
  schema_version smallint    not null default 1,
  status         text        not null default 'active' check (status in ('active','disabled')),
  details_enc    text        not null,
  display        jsonb       not null,
  created_by     uuid        references public.profiles(id) on delete set null,
  updated_by     uuid        references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- G2: `display` is not free-form JSON. Exactly two string keys, no more.
  -- `display - 'label' - 'masked' = '{}'` is the extra-key check: subtracting the
  -- two allowed keys must leave nothing. jsonb_object_keys() cannot be used in a
  -- CHECK (it is set-returning), so this is the immutable-expression equivalent.
  -- The app-layer allowlist (B3) already guarantees this; the constraint is the
  -- backstop that makes "an unmasked value ended up in display" unrepresentable
  -- rather than merely unlikely.
  constraint vendor_payout_methods_display_shape check (
    jsonb_typeof(display) = 'object'
    and jsonb_typeof(display -> 'label')  = 'string'
    and jsonb_typeof(display -> 'masked') = 'string'
    and display - 'label' - 'masked' = '{}'::jsonb
  )
);

comment on table public.vendor_payout_methods is
  'Where a vendor receives payouts. One row per vendor — switching method replaces it. No payout rail exists; a human at Ezzy reads these to make a manual transfer.';
comment on column public.vendor_payout_methods.method_type is
  'bank | gcash | maya. Adding a method means adding a value here and a validation schema in vendor/lib/payout/schema.ts — never a new column.';
comment on column public.vendor_payout_methods.schema_version is
  'Version of the details shape for this method_type. Bumped when a field set changes (e.g. if a disbursement provider is adopted and demands more) so old rows stay readable.';
comment on column public.vendor_payout_methods.status is
  'active = usable for payout and counts toward account completion. disabled = retained but not usable (e.g. a method Ezzy withdraws support for). Never delete history silently.';
comment on column public.vendor_payout_methods.details_enc is
  'AES-256-GCM ciphertext, "v1.<iv>.<tag>.<ciphertext>" base64. Key is PAYOUT_ENCRYPTION_KEY, server-only, NOT in this database. Postgres cannot read this and neither can any RLS-bound client.';
comment on column public.vendor_payout_methods.display is
  'Masked, already-safe values ONLY — { label, masked }. Computed server-side from the plaintext at write time. This is the only payout data any browser ever receives. Never put an unmasked account number or mobile number here.';

create trigger set_vendor_payout_methods_updated_at
  before update on public.vendor_payout_methods
  for each row execute function public.set_updated_at();

alter table public.vendor_payout_methods enable row level security;

-- Vendor admins read their own row. They receive the ciphertext too, which is
-- harmless (opaque) and avoids a column-level-security workaround RLS does not
-- have. Nothing renders it.
create policy "vendor admins read own payout method"
  on public.vendor_payout_methods for select
  to authenticated
  using (public.is_active() and public.has_vendor_role(vendor_id, 'vendor-admin'));

-- No INSERT/UPDATE/DELETE policy for authenticated, deliberately: see the header.
-- No Command read policy either — that is a separate, approved piece of work
-- (this plan's C2). An unused policy is surface for no benefit.

grant select                         on public.vendor_payout_methods to authenticated;
grant select, insert, update, delete on public.vendor_payout_methods to service_role;


-- ── Change audit ──────────────────────────────────────────────────────────────
-- Mirrors vendor_status_log (20260511000001). Logs ONLY the masked display —
-- never ciphertext, never plaintext. A second copy of the secret defeats the
-- point of encrypting the first one.
create table public.vendor_payout_method_log (
  id           uuid        primary key default gen_random_uuid(),
  vendor_id    uuid        not null references public.vendors(id) on delete cascade,
  changed_by   uuid        references public.profiles(id) on delete set null,
  from_type    text,
  from_display jsonb,
  to_type      text        not null,
  to_display   jsonb       not null,
  changed_at   timestamptz not null default now()
);

comment on table public.vendor_payout_method_log is
  'Immutable record of every payout-destination change. Masked values only. A changed payout destination is the highest-value fraud target in the system; this is what makes such a change reviewable after the fact.';
comment on column public.vendor_payout_method_log.from_type is
  'NULL on the first entry — there was no previous destination.';

create index vendor_payout_method_log_vendor_idx
  on public.vendor_payout_method_log (vendor_id, changed_at desc);

alter table public.vendor_payout_method_log enable row level security;

create policy "vendor admins read own payout method log"
  on public.vendor_payout_method_log for select
  to authenticated
  using (public.is_active() and public.has_vendor_role(vendor_id, 'vendor-admin'));

-- Insert-only, and only by the service-role route. No authenticated write path.
grant select                         on public.vendor_payout_method_log to authenticated;
grant select, insert                 on public.vendor_payout_method_log to service_role;
```

**FK delete behaviour (supabase-exp §6 — a real decision, not a default):**
`on delete cascade` from `vendors` on **both** tables, matching `vendor_status_log`
(`20260511000001:63`). It does destroy audit rows when a vendor is hard-deleted —
accepted because the only path that hard-deletes a vendor is the registration
rollback in `vendor/app/api/auth/register/route.ts`, which runs before any payout
row can exist. `changed_by`/`created_by`/`updated_by` are `on delete set null`, so
deleting a *person* preserves the record of the change — same reasoning as
`vendor_status_log.changed_by`.

**Blast radius:**
- *Data* — creates two empty tables. Rewrites nothing, validates no existing rows, cannot fail on existing data. The `display` CHECK has nothing to validate against.
- *Lock* — `ACCESS EXCLUSIVE` on the two new (empty) tables only. The FKs to `vendors`/`profiles` take a brief `SHARE ROW EXCLUSIVE` on those parents; sub-millisecond at this data volume.
- *Downstream* — new hand-written interfaces in `vendor/services/payout.service.ts` (this repo does not use `supabase gen types`); `architecture/schema.md` needs both tables added (**I6**).
- *Reversibility* — `drop table public.vendor_payout_method_log; drop table public.vendor_payout_methods;`. Nothing else references them.

**Note on `details_enc text` rather than `bytea`:** base64 in `text` round-trips
cleanly through PostgREST and `supabase-js` with no encoding ceremony, and the
value never reaches a browser as anything but an ignored field. `bytea` would buy
~25% storage on a table with one row per vendor.

**Deliberately NOT built:**
- A `ph_banks` lookup table — decision **D2**. The bank list is a constant in `vendor/lib/payout/banks.ts`.
- Per-vendor multiple payout methods. One destination, replaced on change.

---

### B2 — Encryption module (`payoutCrypto`) ✅ DONE (2026-08-15)

> ✅ **Executed in stage 3.** `vendor/lib/payout/crypto.server.ts` + `crypto.server.test.ts`.
> AES-256-GCM via `node:crypto`, no new dependency. `PAYOUT_ENCRYPTION_KEY` generated
> and written to `vendor/.env.local` (confirmed gitignored via `git check-ignore`;
> decodes to exactly 32 bytes; one occurrence).
>
> **Verified machine-side:** `npm test` 205 → **221 passing, 0 failing**; `tsc --noEmit`
> exit 0; `eslint` exit 0; `npm run build` succeeds.
> **Leak checks, all machine-verified against the real build output:**
> `PAYOUT_ENCRYPTION_KEY`, `details_enc` and `createDecipheriv` are all **absent from
> `.next/static/`**, and the actual key value appears **nowhere in `.next/` at all**.
> `crypto.server.ts` and `authz.server.ts` have exactly **one importer** — the Route
> Handler — confirmed by grep across `app/ components/ hooks/ services/ lib/`.
>
> **One addition the plan did not specify: `detailsEqual(a, b)`.** Needed by **B4** —
> see **G15**. Compares canonical JSON of two decrypted detail objects with
> `timingSafeEqual`; a byte comparison of two blobs answers the wrong question because
> a fresh IV per write makes identical details produce different ciphertext.

**File:** `vendor/lib/payout/crypto.server.ts` + `crypto.server.test.ts`

AES-256-GCM via Node's built-in `node:crypto`. **No new dependency.**

```
format:  v1.<base64 iv>.<base64 authTag>.<base64 ciphertext>
key:     PAYOUT_ENCRYPTION_KEY — 32 random bytes, base64-encoded, server-only
iv:      12 random bytes, fresh per write (randomBytes)
```

- `encryptDetails(details: PayoutDetails): string`
- `decryptDetails(blob: string): PayoutDetails` — throws on a bad auth tag (tamper), a malformed blob, or **an unrecognised version prefix** (G8). Failing loudly on an unknown prefix is the point of having one: silently attempting a v1 decrypt on a v2 blob would produce garbage, not an error.

The `v1.` prefix exists so a key rotation or an algorithm change is representable
without a data migration that has to guess what it is looking at.

**The key is read lazily, inside the call — never at module scope (G3).** A
module-level `process.env.PAYOUT_ENCRYPTION_KEY!` is evaluated at import time,
which means `next build` fails on any machine or CI runner without the variable
set, long before any request exists. Read it inside `encryptDetails`/`decryptDetails`,
and **validate that it base64-decodes to exactly 32 bytes**, throwing a message that
names the variable — a 31-byte key otherwise surfaces as an opaque `createCipheriv`
error at the first save.

**Keeping it off the client — three layers, no new dependency:**
1. Filename convention `*.server.ts`, new to this repo, documented in `conventions.md` (**I6**).
2. A module-top guard: `if (typeof window !== "undefined") throw new Error("payout crypto is server-only")`. A bundling mistake becomes a loud failure, not a silent key leak.
3. It reads `process.env.PAYOUT_ENCRYPTION_KEY`, which is not `NEXT_PUBLIC_` and is therefore not inlined into the client bundle by Next.

> The `server-only` npm package would be the idiomatic layer-1, but adding a
> dependency is an AGENTS.md approval gate and the guard above is equivalent for
> this one module. Raise it if we ever have a second such module.

**Deployment prerequisite — must be flagged at ship time:** `PAYOUT_ENCRYPTION_KEY`
must exist in the vendor app's environment (local `.env.local` *and* Vercel) before
this route is deployed, or every save returns 500. Generate with
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
⚠️ **Losing this key makes every stored payout destination permanently unreadable.**
There is no recovery path — vendors would have to re-enter their details. Back it up
wherever the project's other server secrets live.

---

### B3 — Typed validation schemas + PH mobile normalisation ✅ DONE (2026-08-15)

> ✅ **Executed in stage 1.** Created `vendor/lib/payout/banks.ts` (47 institutions),
> `vendor/lib/payout/phMobile.ts`, `vendor/lib/payout/schema.ts`, plus
> `phMobile.test.ts` and `schema.test.ts`.
> **Verified machine-side:** `npm test` 145 → 205 passing, 0 failing, with all 14 new
> suites confirmed present in the output (not silently skipped); `npx tsc --noEmit`
> exit 0; `npx eslint` on the new paths exit 0; `npm run build` succeeds.
>
> **Two deviations from the draft, both deliberate:**
> 1. **`normalisePhMobile` got its own module** (`lib/payout/phMobile.ts`) rather than
>    living inside `schema.ts`. The plan already listed a separate `phMobile.test.ts`,
>    which would have meant a test file importing from a module it is not named after.
>    It is also the piece with the most edge cases and two callers (GCash + Maya), so
>    it earns the separation on its own.
> 2. **Account-number masking gained a cap the draft did not specify:** the revealed
>    tail is `min(4, floor(length / 2))`, so a short account number cannot end up
>    mostly visible. Bullets stay fixed at 8 regardless of length, which is what keeps
>    the mask from disclosing how long the number is. Stage 5's saved view and any
>    Command-side display (C2) must not "fix" this by matching bullets to length.

**Files:** `vendor/lib/payout/schema.ts`, `vendor/lib/payout/banks.ts`, `vendor/lib/payout/phMobile.ts`, `vendor/lib/payout/schema.test.ts`, `vendor/lib/payout/phMobile.test.ts`

Pure, dependency-free, `node --test`-loadable. Per `conventions.md` → "Unit tests in
the web apps": **relative imports only, `.ts` extension on value imports, no `@/` alias.**

```ts
export const PAYOUT_SCHEMA_VERSION = 1
export type PayoutMethodType = "bank" | "gcash" | "maya"

export interface BankPayoutDetails  { bankCode: string; accountName: string; accountNumber: string }
export interface GCashPayoutDetails { accountName: string; mobileNumber: string }
export interface MayaPayoutDetails  { accountName: string; mobileNumber: string }
export type PayoutDetails = BankPayoutDetails | GCashPayoutDetails | MayaPayoutDetails

export interface PayoutDisplay { label: string; masked: string }

export type ParseResult<T> =
  | { ok: true;  value: T }
  | { ok: false; errors: Record<string, string> }   // field -> message

export function parsePayoutDetails(type: PayoutMethodType, raw: unknown): ParseResult<PayoutDetails>
export function maskedDisplayFor(type: PayoutMethodType, d: PayoutDetails): PayoutDisplay
export function normalisePhMobile(input: string): string | null
```

**The property allowlist is structural, not a check.** Each per-method parser
*constructs a new object* containing only its own known keys. An unknown property
in the request body is not rejected with an error — it is simply never copied, so
it cannot reach `details_enc` or `display`. This is the brief's §9 "explicit
property allowlists for JSON/JSONB" requirement, satisfied by construction rather
than by a rule someone has to remember.

**Field rules:**

| Field | Rule | Why |
|---|---|---|
| `accountName` | trim; 2–100 chars; non-empty | The name a bank teller/app matches against |
| `bankCode` | must be a `code` present in `PH_BANKS` | Rejects free text, keeps the stored value stable |
| `accountNumber` | strip spaces/dashes; **4–20 digits**, digits only | Deliberately permissive. PH account numbers run 10–16 and vary by institution; the brief explicitly says not to assume a universal length. Rejecting a valid account is worse than accepting one that a transfer later bounces |
| `mobileNumber` | `normalisePhMobile` must return non-null | Canonicalised before storage — see below |

**`normalisePhMobile` — canonical form is E.164 `+639XXXXXXXXX`.**
Accepts, after stripping spaces/dashes/parens: `09XXXXXXXXX`, `639XXXXXXXXX`,
`+639XXXXXXXXX`. Rejects everything else (including `08…`, landlines, and any
length but 10 significant digits after the `9`). One canonical representation in
`details_enc` means a future provider integration never has to guess a format.
The masked `display` is rendered back in the **local** `09XXXXXXXXX` shape, because
that is how a Filipino vendor recognises their own number.

**Masking (server-side only, computed once at write time):**

| Method | `label` | `masked` |
|---|---|---|
| bank | the bank's display name, e.g. `BDO Unibank` | `••••••••1234` — last 4 of the account number |
| gcash | `GCash` | `09•••••••42` — local form, first 2 + last 2 |
| maya | `Maya Wallet` | `09•••••••42` |

**`banks.ts`** — `PH_BANKS: readonly { code: string; name: string }[]`, ~35 major PH
institutions, plus `bankName(code): string | null`. Codes are **our own stable
identifiers**, not BIC/SWIFT — documented in a header comment so nobody later
assumes they are interchangeable with a provider's institution codes.

---

### B4 — Payout write API (`PUT` / `DELETE`) ✅ DONE (2026-08-15)

> ✅ **Executed in stage 3.** `vendor/app/api/payout-method/route.ts` +
> `vendor/lib/payout/authz.server.ts`.
>
> **Verified live against the local Supabase — 39/39 e2e assertions pass**, driving the
> real HTTP route with a real `@supabase/ssr` session cookie, asserting on what
> actually landed in the database, then deleting the fixture (**0 payout rows, 0 log
> rows left behind**). Covered: create/replace/switch/delete; masked-only responses;
> plaintext absent from both the response and the stored row; `created_by` preserved
> across updates; per-field 400s; `methodType: "paymaya"` rejected; non-PH mobile
> rejected; **injected junk properties dropped and unable to reach the row**; the audit
> log holding no account number, no full mobile number and no ciphertext; DELETE
> idempotent. Authorisation: **403 for a cross-tenant write, 403 for a suspended
> profile (the G1 case), 403 for an admin of a suspended vendor**, with nothing written
> in any of those cases.
> Unauthenticated gates verified by curl: `PUT`/`DELETE` → 401, missing `vendorId` →
> 400, malformed JSON → 400, `GET` → 405 (no handler, as designed).
>
> **Leak rule audited by grep**: all 7 `console.*` calls in the route carry only
> `{ vendorId, methodType, stage }` or `{ vendorId, reason }` — never the body, the
> details, the plaintext or the ciphertext.
>
> ✅ **CSRF (G9) is now OBSERVED, not reasoned (stage 5).** A real Chromium session
> was inspected: every `sb-*` auth cookie carries **`SameSite=Lax`**, so a cross-site
> `PUT`/`DELETE` cannot ride the session. No origin check is needed. Asserted in the
> browser e2e so a future cookie-config change breaks a test rather than passing
> silently.

**File:** `vendor/app/api/payout-method/route.ts`, `vendor/lib/payout/authz.server.ts`

There is **no `GET`**. The vendor reads their own row directly through RLS
(`payout.service.ts`), so a read route would be a second code path guarding the
same data. Only writes need the server, because only the server has the key.

#### 🔴 G1 — the authorisation check the draft got wrong

The first draft verified the caller by asking whether a `vendor_members` row for
`vendorId` was **visible** to them. That is unsound here:

```
20260504000003_rls.sql:187-190
  create policy "users can read their own vendor memberships"
    on public.vendor_members for select
    to authenticated
    using (auth.uid() = user_id);          -- ← no is_active()
```

Permissive policies are **OR'd**, so this one grants a suspended profile sight of
its own membership rows regardless of the narrower `is_active()`-carrying policy
beside it. A vendor-admin suspended by Command would therefore still have passed
the check and been able to **change where their money is sent** — the single worst
write in this feature.

**Row visibility is not authorisation.** The route checks all three layers from
`architecture/auth-and-roles.md` explicitly, mirroring `verifyVendorAccess`
(`services/vendor-access.service.ts:52-87`), via the **RLS-bound SSR client**:

```ts
const [{ data: profile }, { data: portals }, { data: membership }] = await Promise.all([
  ssr.from("profiles").select("statuses(name)").eq("id", user.id).single(),
  ssr.from("user_portals").select("portals(name)").eq("user_id", user.id),
  ssr.from("vendor_members")
     .select("roles(name), vendors(statuses(name))")
     .eq("user_id", user.id).eq("vendor_id", vendorId).maybeSingle(),
])
// require ALL of:
//   portals include 'vendor'                       (layer 1 — portal grant)
//   profile.statuses.name === 'active'             (layer 2 — the user)
//   membership.roles.name === 'vendor-admin'       (layer 3 — role at this vendor)
//   membership.vendors.statuses.name === 'active'  (the vendor itself)
```

> **Why not just call `verifyVendorAccess`?** It answers a different question —
> *"which vendor should this user land on?"* — uses the browser client, and returns
> a routing verdict. This asks *"may this caller write to this specific vendor?"*.
> Two questions, two functions. It lives in `vendor/lib/payout/authz.server.ts` as
> `assertVendorAdmin(ssr, userId, vendorId)` so the intent is named, and so this is
> not mistaken for accidental duplication later.

#### `PUT` — create or replace

Body `{ vendorId, methodType, details }`.

1. Authenticate with the SSR client (`lib/supabase/server.ts` → `auth.getUser()`) → **401**.
2. `assertVendorAdmin(...)` above → **403**. `vendorId` arrives in the body because this portal is genuinely multi-vendor (`useAppShell.ts:237-246`) — but it is *verified against the caller*, never trusted. `conventions.md` → Route Handlers, "never trust ids from the request body".
3. `parsePayoutDetails(methodType, details)` → **400** with `{ errors: { field: message } }`. Server-side validation is the authority; the client mirrors it purely for UX.
4. `encryptDetails` + `maskedDisplayFor`.
5. Read the existing row (service role) — this supplies both `from_type`/`from_display` for the log **and** the insert-vs-update branch below.
6. **Branch, do not `upsert` (G4).** `upsert` cannot set `created_by` on insert only — it would either overwrite the original creator on every edit or omit it entirely. So: no existing row → `insert` with `created_by = updated_by = user.id`; existing row → `update` setting `updated_by = user.id` and leaving `created_by` alone. Both set `schema_version = PAYOUT_SCHEMA_VERSION` and `status = 'active'`.
7. Service-role insert into `vendor_payout_method_log` — **skipped** when `to_type` and `to_display` both equal the previous row's, so a double-submit does not pollute the audit trail.
8. Respond `{ methodType, display }` — masked only. Neither the ciphertext nor the plaintext appears in a response body.

#### `DELETE` — remove the destination

Takes **`?vendorId=` as a query parameter, not a body (G5)** — `DELETE` with a
request body is inconsistently supported across runtimes and proxies, and there is
one scalar to carry. Same steps 1–2, then delete the row and log the removal
(`to_type = 'none'`, `from_*` recording the prior destination). Removing the
destination flips the account back to incomplete — §12's "Vendor removes payout
details" case.

#### CSRF (G9)

These are cookie-authenticated, state-changing, money-adjacent writes, so the
question has to be answered rather than assumed. `lib/supabase/server.ts:11-17`
passes no cookie options, so `@supabase/ssr`'s defaults apply — **`SameSite=Lax`**,
which browsers do not send on a cross-site `PUT`/`DELETE`. That is the mitigation,
and it is why both write verbs are non-`GET`.

⚠️ **Reasoned from the library default, not observed.** Verify in the browser
(DevTools → Application → Cookies → check `SameSite` on the `sb-*` cookies) during
stage 3. If it is anything other than `Lax` or `Strict`, this needs an origin check
in the route before it ships.

**Leak prevention — explicit rules for this file:**
- No `console.*` call in this route may receive the request body, `details`, the plaintext, or `details_enc`. Log only `{ vendorId, methodType, stage }`.
- Error responses carry a fixed message plus per-field validation messages that name the field, **never echo the submitted value**.
- No analytics/telemetry call in this route at all.

**Concurrency (§11).** Last-write-wins on a single-row PK. Two vendor-admins racing
to set a payout destination is vanishingly rare, both attempts land in the log, and
optimistic concurrency here would cost a version column and a conflict UI to protect
against something that does not happen. **Stated, not defended against** — if it ever
matters, the log makes it visible.

---

### B5 — One authoritative completion calculation ✅ DONE (2026-08-15) · ⚠️ PARTLY SUPERSEDED by B13 (2026-08-16)

> ⚠️ **Decision D10 (2026-08-16) moved this rule into the database.** `deriveCompletion()`
> and its 20 unit assertions are retired by **B13**; the service is simplified to a single
> read of `vendor_account_completion`; the hook is unaffected. Kept here, not deleted,
> because the record of what was built and verified is what makes the change legible.

> ✅ **Pure half in stage 1**, ✅ **service in stage 4.**
> `lib/accountCompletion.ts` + `.test.ts` (four-quadrant matrix, `disabled` status,
> unrecognised statuses fail closed, degenerate counts read as "no offerings").
> `services/accountCompletion.service.ts` issues the two reads — `offerings` with
> `head: true` + exact count and **no status filter** (decision D3), and
> `vendor_payout_methods` selecting `status, display` but **never `details_enc`** —
> then hands both to `deriveCompletion`. The service decides nothing.
>
> **Verified live under real RLS — 11/11 e2e assertions**, run as a signed-in
> vendor-admin on the anon key (not service_role), fixture cleaned up afterwards:
> both queries succeed with no `permission denied`; **an INACTIVE offering still
> counts** (pinning D3 against the database, not just the unit test); offering-only
> stays incomplete; both present → complete with the masked display readable;
> **`status = 'disabled'` flips it back to incomplete**; removing the payout row and
> deleting the only offering both degrade correctly; and **another vendor's offerings
> do not count toward mine**.

**Files:** `vendor/lib/accountCompletion.ts` + `.test.ts`, `vendor/services/accountCompletion.service.ts`

The pure function is the single definition the brief demands. Nothing else in the
app may re-derive completion.

```ts
export interface AccountCompletion {
  hasOffering:       boolean
  hasPayoutDetails:  boolean
  isAccountComplete: boolean
}

export function deriveCompletion(input: {
  offeringCount: number
  payoutMethod:  { status: string } | null
}): AccountCompletion
```

- `hasOffering = offeringCount > 0` — **any** offering, active or inactive (decision **D3**).
- `hasPayoutDetails = payoutMethod !== null && payoutMethod.status === "active"` — the `status` column is what covers §12's "a payout method becomes disabled".
- `isAccountComplete = hasOffering && hasPayoutDetails`.

**Service — `getAccountCompletion(vendorId)`** returns
`{ data: AccountCompletion | null; display: PayoutDisplay | null; error: string | null }`,
from two queries in one `Promise.all`:

- offerings: `.select("id", { count: "exact", head: true }).eq("vendor_id", vendorId)` — the `head: true` count pattern already used by `countSchedulesForOffering` (`services/schedules.service.ts:152`). No rows transferred; bounded by construction, so this cannot hit the truncation class of bug that `.plans/2026-08-11-crossapp-unbounded-query-truncation.md` deals with.
- payout: `.select("method_type, status, display").eq("vendor_id", vendorId).maybeSingle()` — note `details_enc` is **not** selected. Nothing renders it, so nothing fetches it.

**Failure returns `data: null`, and null means *unknown*, never *incomplete*.**
This is the brief's "completion API failure" edge case, and getting it backwards is
the expensive mistake: a transient network blip would otherwise pop an onboarding
modal at a vendor who finished onboarding months ago, every time. On `null`: no
modal, no header indicator, no error surfaced (there is nothing the vendor can do,
and the shell already has `DataNotice` for load failures that actually matter).

---

### B6 — Shell wiring: `useAccountCompletion` + context ✅ DONE (2026-08-15)

> ✅ **Executed in stage 4.** `hooks/useAccountCompletion.ts` (hook + context +
> `clearAccountCompletionSeen`), provider mounted in `AppShell.tsx` around the
> signed-in tree only, `useGuideModal` given `{ ready, suppressAutoOpen }`, and
> `handleLogout` in `useAppShell.ts` clearing the session flags.
>
> **Two changes to the plan's design, both forced by real problems:**
>
> 1. **Added `settled` to the state.** `ready` for the guide could not be
>    `completion !== null`: a **failed** completion load leaves `completion` null
>    forever, so the guide's deferred auto-open would have waited forever and the
>    Getting Started guide would have been silently disabled for any vendor whose
>    completion fetch errored. `settled` means "the question has been asked and
>    answered", whatever the answer.
> 2. **State is tagged with its vendor id rather than cleared by an effect.** The
>    first cut cleared `completion`/`display`/`modalOpen` in an effect when `vendorId`
>    went null — which tripped `react-hooks/set-state-in-effect`, and the lint rule
>    was right: an effect whose only job is to undo the previous effect leaves a
>    window where vendor A's answer renders under vendor B's name. Now `loaded`
>    carries `{ vendorId, completion, display }` and every exposed value is derived
>    from whether that tag matches the current vendor. **No clearing effect exists.**
>    The monotonic `requestId` guard is kept as well: the tag stops a stale response
>    being *displayed*, the guard stops it being *stored*.
>
> **Verified machine-side:** `tsc --noEmit` 0; `npm test` 221 passing; build clean.
> **Lint measured against a true HEAD baseline** (HEAD file contents linted in place):
> `useAppShell.ts` 4 → 4 errors, `useGuideModal.ts` 1 → 1, `AppShell.tsx` 0, and every
> file created by this plan 0 — **net new lint errors: zero**. The remaining errors in
> those two files are pre-existing and documented at `useAppShell.ts:441`.
>
> ⬜ Behaviour still needing a browser: the modal actually auto-opening once per
> session, surviving reload, and re-showing after logout→login. Stage 6.

**Files:** `vendor/hooks/useAccountCompletion.ts`, `vendor/components/layout/AppShell/AppShell.tsx`, `vendor/components/layout/AppShell/useAppShell.ts`, `vendor/components/dashboard/GuideModal/useGuideModal.ts`

**Where it lives, and why not in `useAppShell`.** Its own hook, provided to the tree
as a context from `AppShell` — exactly the shape `useGuideModal` uses and for the
stated reason recorded at `useGuideModal.ts:12-15`: `useAppShell` already carries
auth, vendor selection, bookings, schedules, staff and notifications, and completion
shares state with none of them. The context mirrors `hooks/useTheme.ts`, the
existing precedent for a shell-level context in this app.

```ts
export interface AccountCompletionState {
  completion:  AccountCompletion | null   // null = not yet known / load failed
  display:     PayoutDisplay | null       // the saved payout destination, masked
  modalOpen:   boolean
  setModalOpen:(open: boolean) => void
  openModal:   () => void                 // the header indicator's handler
  refresh:     () => Promise<void>        // after an offering or payout change
}
```

**Why a context rather than prop-drilling `refresh`:** the two things that change
completion live on different pages (`OfferingsPage`, `SettingsPage`), and threading
a callback from `AppShell` through both would add a prop to two page components that
otherwise have no reason to change. The context is the Dependency-Inversion seam —
those pages depend on "something I can call to say completion may have changed", not
on the shell.

**Where the provider goes — after the early returns (G6).** `AppShell` has four
early-return branches before the app proper: `isCheckingAuth` → `null`, `recoveryMode`,
`pendingKycVendorId`, `!loggedIn`, and `!selectedVendorId` (`AppShell.tsx:42-81`).
The `AccountCompletionContext.Provider` wraps **only** the final `sp-page` tree
(`AppShell.tsx:100`). Wrapping the whole component — the obvious-looking placement —
would mount the hook on the login screen, the password-recovery screen, the
KYC-pending screen and the vendor-select screen, all of which have no vendor to
query for.

**Race and lifecycle handling (§1 of the brief):**
- No fetch until `loggedIn && selectedVendorId` — guaranteed structurally by the placement above, not by a condition inside the hook.
- **Stale-response guard:** each fetch captures its `vendorId` and a monotonic request id in a ref; a response whose id is no longer current is discarded. Necessary, not theoretical — multi-vendor switching is a live path in this app (`useAppShell.ts:237-246`), and without this a slow response for vendor A can overwrite vendor B's completion.
- Refetch on `selectedVendorId` change; reset to `null` when it clears.
- Modal auto-opens **only** when `completion !== null && !isAccountComplete && !seenThisSession`. Never during loading, never on `null`.

**Modal re-show cadence — `sessionStorage`, key `sp-account-completion-seen:<vendorId>`** (decision **D5**):
- survives navigation and page reloads within the tab → satisfies "do not repeatedly reopen during ordinary navigation";
- dies with the browser session → shows again on a genuinely new visit;
- per-vendor, so switching vendors is evaluated independently;
- written **at open time**, not at close — same deliberate choice as `useGuideModal.ts:23-25`, so closing the tab immediately still counts as shown;
- **`handleLogout` in `useAppShell` clears it**, so logout → login in the same tab re-shows. That is what "a future login" means in an app that restores sessions from storage.

**⚠️ Two-modal collision — a real defect this plan must not ship.** `useGuideModal`
auto-opens once ever on first visit (`useGuideModal.ts:26-30`). A brand-new vendor's
very first login is *exactly* when the completion modal also wants to auto-open, so
without intervention both mount stacked. Resolution: `useGuideModal` takes
`{ suppressAutoOpen?: boolean }`, and its auto-open effect additionally waits for a
`ready` flag so the decision is made *after* completion resolves rather than racing
it. Because that hook writes its localStorage key at open time, suppressing it once
simply defers the guide to the next visit — which is the better order anyway:
finish setting up, then read the tour.

---

### B7 — `AccountCompletionModal` ✅ DONE (2026-08-15)

> ✅ **Executed in stage 6.** `components/onboarding/AccountCompletionModal/AccountCompletionModal.tsx`
> — a **pure display component with no companion hook**, which is §4's exception met
> properly rather than skipped: no state, no effects, no data access, no handler
> bodies. Radix Dialog with a constant `open` and the parent conditionally rendering
> it; no `onInteractOutside` guard (nothing to lose); icon **and** words for each
> step's state, never colour alone.
>
> **Verified in a real browser (see I1 for the full 25/25 run):** auto-opens for a
> brand-new vendor with both steps Incomplete and both CTAs; shows "1 step left" with
> **no button on the completed step** when one requirement is met; Escape dismisses;
> **no modal at all for a complete account**.
**File:** new `vendor/components/onboarding/AccountCompletionModal/AccountCompletionModal.tsx`

**Component separation:** a **pure display component** — component-separation §4's
one exception, and it qualifies genuinely: no `useState`, no `useEffect`, no handler
bodies, no data access. It receives `completion`, `open`, and three callbacks, and
renders. All state lives in `useAccountCompletion` (**B6**). **No companion hook, and
that is the correct outcome, not an omission.** Styling is Tailwind on `sp-*` tokens
matching `SchedulePromptModal` — **no `.module.css`, no inline `style={{}}`**.

Radix Dialog, per `conventions.md` → "Modals use Radix Dialog — always (vendor)":
- `Dialog.Root` with a constant `open`, **the parent conditionally renders it** (not an always-mounted `<Dialog.Root open={flag}>`).
- `Dialog.Title` "Complete your account"; `Dialog.Description` "Two steps left before you can start taking bookings and get paid."
- **No** `onInteractOutside={e => e.preventDefault()}` — that guard is for forms, and this holds no work to lose. Escape and backdrop both dismiss.
- Keeps the `sp-card` shell.

Layout — one row per requirement:

```
✓  Offering                                  Complete
   ─────────────────────────────────────────────────
○  Payout details                          Incomplete
   Add a payout method so we know where to send your earnings.
                                    [ Add payout details ]
```

- **Icon *and* words, never colour alone** (ux-design §5): `CheckCircle2` emerald + the literal word "Complete"; `Circle` muted + "Incomplete". Colour-blind and screenshot-in-greyscale safe.
- The CTA renders **only** on an incomplete row.
- A complete row shows no explanatory copy — done is done.
- Footer restates the overall verdict in one line, so the modal answers "am I done?" without the reader having to AND two rows together themselves.
- Buttons `min-h-[44px]` (ux-design §5 touch targets), matching `SchedulePromptModal`.
- Works in both themes by construction — every colour is an `sp-*` token or a Tailwind emerald/amber utility already used elsewhere in the app.

**States (ux-design §4):** loading and error are handled by *not rendering* — `AppShell`
only mounts this once `completion !== null`, so there is no blank void and no
spinner-inside-a-dialog. Populated is the only state this component has.

**CTAs route to the existing flows — no duplicated forms** (the brief's hard constraint):
- **Create offering** → `goPage("offerings", { offerings: { openForm: true } })`, closing the modal first. Opens the **existing** `OfferingFormModal` (decision **D7**) — reused, never reimplemented.
- **Add payout details** → `goPage("settings")`.

> **No `PageIntent.settings` deep-link parameter**, deliberately asymmetric with the
> offerings CTA above. `SettingsPage` is three cards in a `max-w-[460px]` column and
> **I2** puts Payout Details at the top, so the vendor already lands looking straight
> at the target — a focus/scroll intent would be machinery solving a problem the
> layout solves. The Offerings page has no such property: landing there with an empty
> list means a near-blank screen and one more button to find.

---

### B8 — `PayoutDetailsCard` (Settings) ✅ DONE (2026-08-15)

> ✅ **Executed in stage 5.** Four files as planned: `PayoutDetailsCard.tsx` (pure
> render), `usePayoutDetailsCard.ts` (all state and handlers), `PayoutMethodFields.tsx`
> and `PayoutSavedView.tsx` (both pure display, §4 exception). Styling is Tailwind on
> `sp-*` tokens reusing `SecurityCard`'s `INPUT` constant verbatim — **no CSS module,
> no inline `style={{}}` anywhere.**
>
> **Verified in a real browser — 22/22 assertions**, driving the actual login form,
> the actual Settings page and the actual API route, then asserting on the database
> and cleaning up:
> - Card is the **first** card, above Appearance (I2's hierarchy claim, checked in the DOM)
> - Client-side per-field validation fires before any request
> - Bank save → 200; browser receives **only** the masked display
> - Saved view shows bank name + mask + "Change payout details"
> - **The full account number appears nowhere in the DOM**, and no plaintext in the row
> - **The change form opens EMPTY** — §11's re-entry decision, verified rather than asserted — and says why
> - Maya radio carries "Formerly PayMaya"; switching to Maya → 200, shows "Maya Wallet" + `09•••••••67`
> - **The full mobile number appears nowhere in the DOM**
> - Exactly **one row** after switching (replace, not append); **both changes audited** (`null→bank`, `bank→maya`)
> - **Zero console errors** across the whole flow
>
> `tsc --noEmit` 0 · `npm test` 221 passing · build clean · **net new lint errors: zero**
> (`ui-gallery/page.tsx` 1 → 1, pre-existing "components created during render").
>
> **One thing the plan did not anticipate:** `SettingsPage` had to take a `vendorId`
> prop, and the `/ui-gallery` `mode=settings` fixture then mounted a consumer of the
> completion context outside any provider — which throws by design. The fixture now
> wraps it in an inert `GALLERY_COMPLETION` stub (`settled: false`, no-op handlers), so
> every consumer renders its "not yet known" branch, the only honest state without a
> backend. Verified: `/ui-gallery?mode=settings` returns 200 with the card present and
> no error markers.
**Files:** new `vendor/components/settings/PayoutDetailsCard/` — `PayoutDetailsCard.tsx`, `usePayoutDetailsCard.ts`, `PayoutMethodFields.tsx`, `PayoutSavedView.tsx`

**Component separation, stated per component:**

| File | Role | Satisfies |
|---|---|---|
| `PayoutDetailsCard.tsx` | Pure render layer + composition. JSX, conditional rendering, wires handlers the hook returns. No `useState`/`useEffect`, no handler bodies, no inline `style={{}}` | §1 |
| `usePayoutDetailsCard.ts` | All state: selected method, per-field values, per-field errors, saving, saved `display`, edit-vs-view mode. Owns `handleSave`, `handleChangeMethod`, `handleStartEdit`, `handleCancelEdit`, `handleRemove` | §2 |
| `PayoutMethodFields.tsx` | Pure display. Switches on `methodType` and renders that method's labelled inputs from props | §4 exception — no state, no effects, no handlers of its own |
| `PayoutSavedView.tsx` | Pure display. `{ label, masked, onChange, onRemove }` → the saved-destination panel | §4 exception |
| styling | Tailwind on `sp-*` tokens, reusing `SecurityCard`'s shared `INPUT` class constant (`SecurityCard.tsx:8-10`) verbatim | §3 |

**Why the two presentational children are split out (G7).** The `/ui-gallery`
fixture renders components against hand-built props with **no database**
(`ui-gallery/page.tsx:3-7`). A `PayoutDetailsCard` that fetches can therefore only
ever be photographed in its loading state there — the same constraint already
documented for `KycStatusPage` (`ui-gallery/page.tsx:484-487`). Splitting the two
pure children lets the gallery render every populated state directly.

This is not a test accommodation talking a component into a shape it does not want:
"render the fields for method X" and "render a saved destination" are genuinely
separate reasons to change from "own the form's state", and the split is what
component-separation §5 asks for anyway. The testability is the symptom, not the
motive.

**Two view modes in one card.**

*Saved view* (a method exists and the vendor is not editing) — §11 of the brief:

```
Payout details
──────────────────────────────
Bank account
BDO Unibank
••••••••1234

[ Change payout details ]   [ Remove ]
```

*Edit view* (no method yet, or "Change" was pressed):

```
Choose where you'd like to receive your payouts.

( ) Bank account   ( ) GCash   ( ) Maya  ·  Formerly PayMaya

<method-specific fields>

[ Save payout details ]
```

**Changing a destination requires full re-entry — this answers §11's open question, and it is a consequence of B1's design rather than a policy bolted on.** Decrypted
values are never returned to any browser, so there is nothing to prefill. The edit
form always starts empty. A vendor correcting one typo re-types three fields; in
exchange, a stolen session cannot read out a payout destination, only overwrite one
— and overwriting is logged (**B1**) while reading would not be.

**Method-specific fields:**

| Method | Fields |
|---|---|
| Bank account | **Bank** — `components/ui/Combobox` with `strict={true}`, `options = PH_BANKS.map(b => ({ value: b.code, label: b.name }))`, `value = bankCode`. Verified fit (G12): `useCombobox.ts:16` resolves value→label through the options list, `:25` re-syncs on external change, `:44` reverts unmatched typed text on blur — so a free-typed bank name can never be committed. **Account name**. **Account number** — `inputMode="numeric"`, `autoComplete="off"` |
| GCash | **GCash account name**. **GCash mobile number** — `inputMode="tel"`, placeholder `09XXXXXXXXX` |
| Maya | **Maya account name**. **Maya-registered mobile number** — same input treatment. Radio label reads **Maya** with helper text *Formerly PayMaya* |

Labels via the existing `components/ui/FormLabel`. Field errors render beneath each
input in `text-red-500 text-xs`, matching `SecurityCard`.

**States (ux-design §4):** loading → a skeleton row in place of the saved value, never
a blank card; empty (no method yet) → the edit view *is* the empty state, with the
explanatory line as its CTA; error → the failure message stays inline under the Save
button *and* raises a `toast.error`, matching `useSecurityCard.ts:31-36`'s explicit
reasoning that a toast disappears and a failed save is exactly what a user needs to
still see; populated → the saved view.

**On save success:** clear the form, switch to the saved view, `toast.success`, and
call `refresh()` from the completion context — so the header indicator and the modal's
step 2 update in the same interaction, satisfying the brief's §9 "immediate response
to completion changes".

**Save failure (§11):** the row is untouched (the upsert is a single statement), the
form keeps the entered values so nothing is retyped, and the completion state is not
optimistically flipped. Nothing to roll back.

---

## IMPORTANT

### I1 — Header incomplete-account indicator ✅ DONE (2026-08-15)

> ✅ **Executed in stage 6.** `TopBar` gained `accountIncomplete` + `onCompletionOpen`;
> `AppShell` computes the first as `completion !== null && !isAccountComplete`, so
> "not yet known" and "complete" both render nothing. Amber `ShieldAlert` + dot,
> matching the pending-count pill's existing amber language, with a Radix tooltip and
> an explicit `aria-label` carrying the meaning in words.
>
> **Verified in a real browser — 25/25 assertions across six scenarios** (fresh vendor
> each time, all cleaned up):
> - **A (neither):** modal auto-opens, 2 steps left, both CTAs; **the Getting Started
>   guide did NOT also open**; Escape dismisses; indicator remains and **reopens the
>   same modal**; ordinary navigation does not re-open it; **a reload in the same tab
>   does not re-open it** and the indicator survives; zero page errors
> - **B (offering only):** partial state correct, completed step has no button,
>   "Add payout details" lands on Settings → Payout details and closes the modal
> - **C (payout only):** "Create offering" **opens the existing OfferingFormModal** (I3a)
> - **D (complete):** no modal, no indicator, and **the guide DOES auto-open** — the
>   other half of the suppression fix, so B6's change is proven in both directions
> - **E (live change):** indicator present, then **disappears in the same interaction**
>   after saving payout details — I3/B8's `refresh()` seam working end to end
> - **F (re-login):** logout → login in one tab **re-shows the modal**
**Files:** edit `vendor/components/layout/TopBar/TopBar.tsx`, `vendor/components/layout/AppShell/AppShell.tsx`

Two new props on `TopBar`: `accountIncomplete: boolean`, `onCompletionOpen: () => void`.

Placed in the right-hand control cluster (`TopBar.tsx:51`), **before** the Compass
guide button, so it sits beside the Getting Started and theme controls exactly as the
brief asks. Same `size-[34px] rounded-[10px]` shell as its two neighbours, with an
amber `AlertCircle` and an amber dot, echoing the existing pending-count pill's amber
language (`TopBar.tsx:52-57`) — this app already means "needs your attention" by amber.

- `aria-label="Account setup incomplete — open the checklist"` and a Radix Tooltip (`@radix-ui/react-tooltip` is already a dependency; `components/ui/InfoTip` is the in-repo pattern). Words carry the meaning, colour decorates.
- Rendered **only** when `completion !== null && !isAccountComplete`. Complete → gone. Unknown → gone.
- Click → `openModal()`, the same state the auto-open sets. One modal, one calculation.

**`AppShell` reads the context and passes props down**, rather than `TopBar` calling
`useAccountCompletionContext()` itself. `TopBar` is documented as a pure render layer
and already stretches that by calling `useThemeContext()`; adding a second context read
would compound an existing wrinkle instead of leaving it where it is.

---

### I2 — Mount the card in Settings ✅ DONE (2026-08-15)

> ✅ **Executed in stage 5.** `<PayoutDetailsCard vendorId={...} />` is the first card in
> `SettingsPage`, above Appearance; `AppShell` passes `selectedVendorId`. The hierarchy
> claim was **checked in the DOM** by the browser e2e, not just asserted in prose.
> `SettingsPage` stays a pure render layer with no hook.
**File:** edit `vendor/components/settings/SettingsPage/SettingsPage.tsx`

Insert `<PayoutDetailsCard />` as the **first** card, above Appearance.

Hierarchy, not preference (ux-design §2): Payout Details is where the onboarding
modal sends people and is the only thing on this page tied to getting paid. A
dark-mode toggle outranking it is the wrong visual weight, and it would put the
deep-link target below the fold on a phone — which is the whole reason **B7** can
skip a scroll-to-anchor intent.

`SettingsPage` stays a pure render layer with no hook, unchanged. ✔

---

### I3a — `PageIntent.offerings` — open the form on arrival ✅ DONE (2026-08-15)

> ✅ **Executed in stage 6.** `OfferingsArrival` added to `lib/types.ts` with the same
> never-URL-serialised note as `ScheduleArrival`; `AppShell` passes
> `intentFor("offerings")?.offerings`; `useOfferingsPage` opens the **existing**
> form on a mount-only effect. Verified by browser scenario C.
**Files:** edit `vendor/lib/types.ts`, `vendor/components/layout/AppShell/AppShell.tsx:93`, `vendor/components/offerings/OfferingsPage/OfferingsPage.tsx`, `useOfferingsPage.ts`

Implements decision **D7**. Follows the existing `ScheduleArrival` precedent
(`lib/types.ts:80-99`) exactly, including its rule that this shape is **never
URL-serialised** — `serialiseAppParams` writes only `page`/`from`/`to`/`status`, and
a query parameter that reopens a modal is a trap on every load of a bookmarked link.

```ts
/** Offerings only; ignored by every other page. Never URL-serialised — see ScheduleArrival. */
export interface OfferingsArrival { openForm: boolean }
// PageIntent gains:  offerings?: OfferingsArrival
```

`AppShell` passes `arrival={intentFor("offerings")}` — the same prop `BookingsPage`,
`SchedulePage` and `TransactionsPage` already take. `useOfferingsPage` calls
`openAdd()` once on mount when `arrival?.openForm`. One-shot by construction:
`intentFor` returns null for any navigation that carried no intent
(`useAppShell.ts:485-486`), so reaching Offerings from the sidebar never re-opens it.

---

### I3 — Refresh completion after an offering changes ✅ DONE (2026-08-15)

> ✅ **Executed in stage 6.** `refreshCompletion()` on the success paths of
> `handleSave` and `handleDelete` only — every failure path already returns early, so
> "no refresh on a failed save" stays a property of the control flow. Deliberately NOT
> called from `handleToggleStatus`: under D3 an inactive offering still counts, so a
> toggle cannot change completion and the query could never change the answer.
> The equivalent payout-side seam is verified live by browser scenario E.
**File:** edit `vendor/components/offerings/OfferingsPage/useOfferingsPage.ts`

Call `refresh()` from the completion context after a successful `handleSave` (create
path) and after a successful `handleDelete`.

Not after `handleToggleStatus` — under **D3** an inactive offering still counts, so
toggling cannot change completion, and calling `refresh()` there would be a query that
can never change the answer.

Placed on the **success** paths only. Every failure path in `handleSave` already
returns early (`useOfferingsPage.ts:85-91, 117-118`), so "no refresh on a failed save"
is a property of the existing control flow rather than a new guard that could be
forgotten — the same reasoning already recorded there for `savedOffering`.

---

### I4 — Payout read service ✅ DONE (2026-08-15)

> ✅ **Executed in stage 3.** `vendor/services/payout.service.ts` — `getPayoutMethod`
> (direct RLS read, selecting `method_type, status, schema_version, display` and
> **never `details_enc`**), `savePayoutMethod` and `removePayoutMethod` (both through
> the route). Private `DbRow` + `toSavedPayoutMethod` mapper per `conventions.md`.
> `readOnly` is derived from `schema_version > PAYOUT_SCHEMA_VERSION` (G8), so a row
> written by a newer build is displayed but not editable.
> Verified by `tsc --noEmit`, `eslint`, `npm run build`, and exercised end-to-end by
> the 39-assertion e2e run above.

**File:** `vendor/services/payout.service.ts`

Per `conventions.md` → Service Layer: async functions only, a private `interface DbRow`
mapped through a private `toX()`, typed returns with safe fallbacks, no throwing, no
React.

- `getPayoutMethod(vendorId)` → `{ data: { methodType, status, schemaVersion, display } | null; error }`. Selects `method_type, status, schema_version, display` — **never `details_enc`**. A row whose `schema_version` exceeds `PAYOUT_SCHEMA_VERSION` is surfaced as read-only with its stored `display` rather than parsed (G8): a client older than the row must not pretend to understand it.

  Note `display.label` is a **snapshot taken at write time**, which is why removing a bank from `PH_BANKS` later cannot blank out an existing vendor's saved view — the stored label survives independently of the constant.
- `savePayoutMethod(vendorId, methodType, details)` → `fetch("PUT /api/payout-method")`, returning `{ display, errors, error }`.
- `removePayoutMethod(vendorId)` → `fetch("DELETE /api/payout-method")`.

The hand-written `DbRow` interface must match B1's columns exactly, including
nullability — this repo does not run `supabase gen types`.

---

### I5 — Tests ✅ DONE (2026-08-15)

> ✅ **`node --test`: all four suites, 145 → 221 passing, 0 failing.**
> ✅ **Playwright: 6 new gallery modes, 11 new baselines (light + dark), 4 behavioural
> tests.** Fixtures render the **pure children** directly — `AccountCompletionModal`,
> `PayoutMethodFields`, `PayoutSavedView` — which is what G7's component split was for.
> Behavioural assertions cover: the modal's three states with the *word* Complete /
> Incomplete rather than colour; a finished step offering **no** CTA; `aria-hidden` via
> `hideOthers()` and explicitly **not** `aria-modal` (per conventions.md); each method
> asking for its own named fields; `aria-invalid` + `aria-describedby` on errors; and a
> regression guard that **no run of 5+ digits reaches the saved view's DOM**.
> Full suite after the shared-`Combobox` change: **112 passed**, 3 pre-existing calendar
> failures (**G17**, not caused by this work).

> ✅ **All four `node --test` suites now landed** — `schema.test.ts`,
> `phMobile.test.ts`, `accountCompletion.test.ts` (stage 1) and `crypto.server.test.ts`
> (stage 3). Suite total 145 → **221 passing, 0 failing**.
> ⬜ Playwright modes and baselines still wait on stages 5–6.

**`node --test` (`npm test` in `vendor/`) — pure logic:**

| File | Covers |
|---|---|
| `lib/payout/schema.test.ts` | Per method: a valid case; empty/1-char/over-long account name; bank rejects an unknown `bankCode`; account number rejects non-digits, <4 and >20 digits, accepts spaced and dashed input; **unknown properties in the input are absent from the parsed value** (the allowlist assertion); mask output per method |
| `lib/payout/phMobile.test.ts` | `09XXXXXXXXX` / `639…` / `+639…` / spaced / dashed all normalise to the same `+639…`; `08…`, wrong lengths, letters, and empty all return `null` |
| `lib/accountCompletion.test.ts` | The full matrix — neither / offering-only / payout-only / both; plus `status: "disabled"` ⇒ not complete; plus `payoutMethod: null` ⇒ not complete |
| `lib/payout/crypto.server.test.ts` | Round-trip encrypt→decrypt; a tampered auth tag throws; an **unknown version prefix** throws (G8); a key that is not 32 bytes throws naming the variable (G3); two encryptions of the same input differ (fresh IV). The test sets `process.env.PAYOUT_ENCRYPTION_KEY` itself — which only works because **B2** reads it lazily |

> **Nested test files do run — verified, not assumed (G11).** Every existing test
> sits flat in `lib/`, so `"lib/**/*.test.ts"` had never been exercised on a nested
> path. Probed live on 2026-08-15 with a throwaway `lib/__globprobe/sub/probe.test.ts`:
> the count moved 145 → 146 and the test printed. `lib/payout/*.test.ts` is safe.

**Playwright / `/ui-gallery`** (`vendor/app/ui-gallery/page.tsx` + `visual-tests/pilot.spec.ts`), new modes:

- `completionmodal` (×3: neither done / offering only / payout only) — renders `AccountCompletionModal` directly; it is pure display, so this is trivial
- `payoutform` (×3: bank / gcash / maya) — renders **`PayoutMethodFields`** directly with hand-built values/errors, per G7
- `payoutsaved` — renders **`PayoutSavedView`** directly
- `topbarincomplete`

All with light + dark baselines.

> **No existing baseline is invalidated by this work (G10).** I expected adding a
> card to `SettingsPage` to break its committed screenshots. It cannot:
> `visual-tests/pilot.spec.ts-snapshots/` contains **no `settings-*.png`**, and
> `grep -n "settings" visual-tests/pilot.spec.ts` returns nothing — the `mode=settings`
> fixture is wired up but never driven. Every baseline this plan touches is a new one.

DOM assertions alongside the screenshots:
- The dialog marks its siblings `aria-hidden` — **assert on that, never on `aria-modal`**; this Radix version does not emit it (`conventions.md`, and the note at `GuideModal.tsx:18-21`).
- CTA labels are exactly "Create offering" / "Add payout details".
- The saved view contains **no** run of 5+ consecutive digits — a regression guard that an unmasked account number cannot reach the DOM.
- The header indicator is absent when `accountIncomplete` is false.

Baselines are exact (`maxDiffPixels: 0`) — regenerate deliberately with
`--update-snapshots` and read the diff.

---

### I6 — Documentation ✅ DONE (2026-08-15)

- ✅ **`architecture/schema.md`** (2026-08-15) — migration-history row added; full `vendor_payout_methods` and `vendor_payout_method_log` sections added before `fulfilment_patterns`, covering the no-authenticated-write-path rule, `details_enc` being opaque to Postgres, the deliberate absence of a Command policy and its consequence, and the read/write active-vendor asymmetry; three rows added to Delete Behaviour Summary. Nothing removed from "Future Schema Additions" — neither table was listed there. *Verified by reading the diff; the described schema is not yet applied.*
- **`architecture/portals.md`** — vendor portal: add Account completion + Payout Details to the feature table. Amend the **"No payout disbursement"** known gap (`portals.md:376`) to say destinations are now *collected* but still not readable by Command (**C2**) and still not paid.
- ✅ **`architecture/conventions.md`** (2026-08-15) — `PAYOUT_ENCRYPTION_KEY` added to the Environment Variables table (server-only, with the lazy-read requirement and the unrecoverable-loss warning), plus a new `*.server.ts` section recording the three-layer convention and the greps that verify it.
- ✅ **`architecture/portals.md`** (2026-08-15) — two rows added to the vendor feature table (Account completion, Payout details, the latter flagged **local only**), and the Known Gaps amended: destinations are now collected but **nobody can read them**, with C1/C2/C3 named.
- ✅ **`vendor/README.md`** (2026-08-15) — an Environment section with the key-generation command and the back-it-up warning.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. There are none. -->

- **D1 — How payout details are stored** → **Encrypted blob + masked `display` column** (resolved 2026-08-15). Sensitive values are AES-256-GCM ciphertext with a server-only key; the browser only ever receives already-masked `display` values, so "safe API responses" and "masking" are structural rather than a discipline the API has to remember. Cost accepted: a new env var, a key that must be backed up, and Command needing the same key later (**C2**).
- **D2 — Bank list source** → **Hardcoded `PH_BANKS` constant in `vendor/lib/payout/banks.ts`** (resolved 2026-08-15). No new lookup table, no schema gate, ships faster. ⚠️ Accepted consequence: when **C2** builds Command's view, Command cannot resolve a stored `bankCode` to a name without duplicating the list — this repo has no shared-code path between apps. Recorded in **C2** so it is priced in there rather than discovered.
- **D3 — Which offerings count** → **Any offering, active or inactive** (resolved 2026-08-15). Creating one satisfies step 1. Avoids re-opening the modal at a vendor who deactivates something seasonal. Accepted consequence: an account can read "complete" while nothing is currently bookable. `hasOffering` is therefore a plain `count > 0` with no status filter.
- **D4 — Cross-app work** → **Vendor app only** (resolved 2026-08-15). Both couplings recorded as **C1**/**C2**.
- **D5 — Modal re-show cadence** → **`sessionStorage`, per vendor, cleared on logout** (my call; say so if you want it different). Reload-safe, navigation-safe, re-shows on a genuinely new session or after a logout. The alternative considered was a `localStorage` timestamp with a cooldown, which adds a tunable nobody has asked for.
- **D7 — What "Create offering" does** → **Opens the existing `OfferingFormModal` via a new `PageIntent.offerings`** (resolved 2026-08-15, my call — say so if you'd rather it just landed on the page). Landing on a near-empty Offerings page and asking the vendor to find "+ New offering" is a weak reading of "reuse the existing Offering workflow". The mechanism already exists and is used for exactly this (`ScheduleArrival`, `lib/types.ts:80-99`), costs ~10 lines across four files, and reuses the form rather than duplicating it — the brief's hard constraint is untouched. Implemented as **I3a**.
- **D6 — Re-authentication before changing a payout destination** → **Not in v1** (my call). This portal has no re-auth pattern anywhere to reuse, and building one for a single control is disproportionate. The compensating controls are real and are in this plan: full re-entry rather than prefill (**B8**), an immutable audit log (**B1**), and Command-side review once **C2** lands. ⚠️ The genuinely missing control is **notifying the vendor when their destination changes** — that is a backbone change and is out of scope by **D4**; it is listed as **C3** and is the item I would do first after this plan.

---

## COUPLINGS — flagged, out of scope

### C1 — `ezzy-vendor-mobile` has no completion surface
The mobile vendor app ships a dashboard and a Getting Started guide but will have
neither this modal nor payout settings. `architecture/portals.md:620` states the two
vendor clients must agree where they overlap. They will not overlap here — mobile
simply lacks the feature, which is a gap rather than a disagreement, but a vendor who
onboards on mobile gets no prompt at all. Needs its own plan.

### C2 — Ezzy staff cannot read a payout destination → **PROMOTED to Phase 2** (2026-08-16)
Was: the blocker on this feature being useful. The user requested it on 2026-08-16, so
it is no longer a flagged coupling — it is **Phase 2** below (B9–B12, I7–I10, stages
8–10). ⚠️ It touches a **second app**, which is an AGENTS.md approval gate; the request
is that approval, recorded here.

### C3 — No notification when a payout destination changes
A changed payout destination is the highest-value fraud target in the system, and the
vendor currently learns of a change only by looking. The pipeline to reuse exists
(`architecture/email-notifications-guide.md`); the precedent for seeding a type is
`20260808000001_vendor_lifecycle_notification_types.sql`. Backbone change, so out of
scope by **D4**. Recommended as the first follow-up.

---

## Edge cases — where each is handled

| Case | Handling | Where |
|---|---|---|
| Neither requirement met | Both rows incomplete, both CTAs, modal auto-opens | B5, B7 |
| Offering only | Step 1 ✓ with no CTA; step 2 incomplete with CTA | B7 |
| Payout only | Mirror image | B7 |
| Fully complete | No modal, no header indicator, nothing auto-opens | B6, I1 |
| Only offering deleted | `refresh()` on delete success re-counts → incomplete | I3 |
| Only offering deactivated | **No change** — inactive still counts under D3 | B5, D3 |
| Offering archived | N/A — offerings have no archive state; `deleteOffering` is a hard delete and status is just `is_active` | verified `offerings.service.ts:101` |
| Payout removed | `DELETE` route + `refresh()` → incomplete | B4, B8 |
| Payout method disabled | `status <> 'active'` ⇒ `hasPayoutDetails` false | B1, B5 |
| Invalid bank / GCash / Maya details | Rejected server-side with per-field errors; nothing written | B3, B4 |
| Switching bank → GCash → Maya → bank | Upsert replaces the single row; each switch logged | B1, B4 |
| Duplicate submission | Upsert is idempotent on the PK; the log entry is skipped when nothing changed | B4 |
| Concurrent updates | Last-write-wins; both attempts visible in the log. Stated, not defended against | B4 |
| Login loading state | `AppShell` renders `null` while `isCheckingAuth`; the hook does not fetch until `loggedIn && selectedVendorId` | B6 |
| Vendor switched mid-flight | Stale-response guard discards the superseded fetch | B6 |
| Completion API failure | `null` = **unknown**, not incomplete → no modal, no indicator | B5 |
| Payout save failure | Row untouched, form keeps its values, inline error + toast, completion not flipped | B8 |
| Modal dismissed | Indicator stays, reopens the same modal, returns next session | B6, I1 |
| Guide modal also auto-opening | Guide's auto-open suppressed for that visit; defers to the next | B6 |
| A future payout method | New `method_type` value + a parser in `schema.ts` + a fields branch. **No new column** | B1, B3 |
| A provider changing required fields | `schema_version` bump; old rows stay readable | B1 |

---

## Execution order

**Cadence: one stage at a time, then stop and report** (developerboss → Execution
Cadence). Say "stages 1–3" or "run the whole plan" to override. An override never
waives an approval gate.

Ordered by risk and dependency, not by item number. 🚧 marks a gate that stops
regardless of any override.

| # | Stage | Items | Depends on | Gate |
|---|---|---|---|---|
| **1** ✅ | **Pure logic — the safe prefix** — **DONE 2026-08-15** | **B3** (validation schemas, `PH_BANKS`, PH mobile normalisation, masking) + **B5**'s pure `deriveCompletion` + their `npm test` suites from **I5** | nothing | — |
| **2** ✅ | **Schema** — applied to **local** 2026-08-15, RLS verified | **B1** (both tables, RLS, grants, CHECK, audit log) + the `schema.md` half of **I6** | 1 (the shapes are settled first) | ✅ done locally · ⏸ **`db push` to hosted deliberately held by the user until end-to-end testing** |
| **3** ✅ | **Crypto + write API** — **DONE 2026-08-15**, 39/39 e2e | **B2** (`crypto.server.ts`) → **B4** (`PUT`/`DELETE`, `authz.server.ts`) → **I4** (`payout.service.ts`) | 1, 2 | ✅ `PAYOUT_ENCRYPTION_KEY` generated and set in `vendor/.env.local` |
| **4** ✅ | **Completion plumbing** — **DONE 2026-08-15**, 11/11 e2e | **B5**'s service → **B6** (hook, context, provider placement, `useGuideModal` suppression, `handleLogout` cleanup) | 2, 3 | — |
| **5** ✅ | **Payout UI** — **DONE 2026-08-15**, 22/22 browser e2e | **B8** (card + hook + the two pure children) + **I2** (mount in Settings) | 3, 4 | — |
| **6** ✅ | **Onboarding UI** — **DONE 2026-08-15**, 25/25 browser e2e | **B7** (modal) + **I1** (header indicator) + **I3a** (`PageIntent.offerings`) + **I3** (refresh on offering change) | 4, 5 | — |
| **7** ✅ | **Visual tests + docs** — **DONE 2026-08-15** | **I5**'s Playwright modes and new baselines + the rest of **I6** | 5, 6 | — |

**Why stage 1 comes before the schema.** The migration's `display` CHECK and the
`method_type` CHECK both encode decisions that **B3** is the authority on. Settling
the field shapes in pure, testable code first means the migration is written against
something proven rather than something intended — and a migration is the one artefact
here that cannot be edited after it is applied.

**Stage 1 is the safe prefix.** No schema, no key, no environment, no approval beyond
this plan. Fully verified by `npm test`. Work can start there immediately.

**Stages 5 and 6 are separable but not independent** — 6's modal CTAs land on 5's
card. Shipping 6 without 5 gives a vendor a button that leads to a Settings page with
no payout section.

---

## Verification

| Item | How | Kind |
|---|---|---|
| B1 | `supabase db reset` locally applies cleanly; `\dp` shows the grants match the policies; both tables report `rowsecurity = true` | **needs live environment** |
| B1 RLS | Vendor A cannot select vendor B's row; an `authenticated` INSERT is refused | **needs live environment** |
| B2 | `npm test` — round-trip, tamper rejection, fresh IV | machine-verifiable |
| B3 | `npm test` — the full validation and normalisation matrix, including the allowlist assertion | machine-verifiable |
| B4 | 401 without a session; 403 for a vendor id the caller does not admin; **403 for a suspended profile, and for an active profile at a suspended vendor** (the G1 regression); 400 with field errors; 200 returning masked-only | **needs live environment** |
| B4 leak rule | `grep -n "console\." vendor/app/api/payout-method/route.ts` and read every hit | machine-verifiable |
| B4 CSRF (G9) | DevTools → Application → Cookies → `sb-*` show `SameSite=Lax` or `Strict`. If not, add an origin check before shipping | **needs live environment** |
| B1 `display` CHECK (G2) | A service-role insert with an extra key, or a non-string `masked`, is rejected by the constraint | **needs live environment** |
| I3a | Modal → "Create offering" opens `OfferingFormModal`; reaching Offerings from the sidebar afterwards does not | **needs live environment** |
| B5 | `npm test` — the four-quadrant matrix | machine-verifiable |
| B6 | Modal opens once, survives navigation, reappears after logout→login; guide does not stack | **needs live environment** |
| B7/B8/I1 | Playwright baselines, light + dark; the "no 5 consecutive digits in the saved view" assertion | machine-verifiable |
| I3 | Create an offering with no payout set → step 1 flips and the header dot stays | **needs live environment** |
| All | `npm run build` and `npx tsc --noEmit` in `vendor/` | machine-verifiable |
| Key leak | `npm run build` then `grep -r "PAYOUT_ENCRYPTION_KEY" vendor/.next/static/` returns nothing | machine-verifiable |

---

## DEFERRED / COSMETIC

- **No "Other bank" option.** `PH_BANKS` covers the major institutions; a vendor at a small rural bank or co-op cannot complete setup. Acceptable for now because the vendor base is not yet at that scale, and the fix (an `OTHER` code plus a required free-text institution name, which then needs its own validation and a Command-side display rule) is more machinery than the current evidence justifies. **Revisit on the first support request** — this is the deferral most likely to bite.
- **No payout-destination verification.** Nothing confirms the account exists or that the name matches. No provider to ask, and a penny-drop test needs the rail this system does not have.
- **No `status = 'disabled'` writer.** The column and the completion rule are in place; nothing sets it yet. It exists so that withdrawing support for a method later is a data change rather than a migration.
- **Vendor cannot view their own change log.** The table and the read policy exist (**B1**); no UI reads them. Cheap to add later; not asked for.


---

# PHASE 2 — Command: read payout destinations, and see who is set up

**Added 2026-08-16 at the user's request.** Phase 1 (stages 1–7) is complete on local.
This phase makes the collected destinations *usable*: Ezzy staff can see who has one,
open it, and copy each field into a bank transfer — plus an at-a-glance signal for
whether a vendor's account is complete at all.

> **App / scope:** `command/` + one migration in `backbone/`. `vendor/` is untouched.
> **Cross-app gate:** ✅ approved by the request itself (2026-08-16).

## What Phase 2 is for

Payouts are made **manually, by a human, via bank transfer**. So the job this phase
serves is: *"I am about to send money to this vendor — show me exactly where, in a form
I can paste into my banking app without transcribing digits by hand."* Every design
choice below follows from that, especially the copy buttons: a mistyped account number
sends real money to a stranger, and re-typing is where that happens.

## The one thing that makes this different from Phase 1

Phase 1's guarantee was **"no decrypted payout value ever reaches a browser."** Phase 2
deliberately breaks that guarantee — because a human cannot type an account number they
cannot see. That is not a regression to wave through; it is the central risk of this
phase, and B9–B11 exist to bound it:

- decryption happens **only** in a Command-only, caller-gated Route Handler;
- it happens **once per deliberate modal open**, never for a list of cards;
- the list itself needs **no plaintext at all** — "configured or not" comes from a
  column the database can answer without the key;
- values render **masked by default** with an explicit Reveal, so opening the modal to
  check *which* method a vendor uses does not put an account number on screen;
- and every access is recorded, if **D9** is taken.

---

## BLOCKERS (Phase 2)

### B9 — Command read policy on `vendor_payout_methods` ✅ DONE (2026-08-16)

> ✅ **Shipped in `20260816000001_command_payout_access.sql`, applied by the user.**
> **Verified against the applied schema, 4/4** as a real Command-admin session: the
> admin reads a payout row; `display->>'label'` returns the bank name with no join;
> the mask is readable; and vendors can be grouped by institution. Rolled back, 0 residue.
**File:** new `backbone/supabase/migrations/2026081600000X_command_payout_read.sql`
🚧 **Approval gate — a new migration. Nothing in Phase 2 works until it is applied.**

`20260815000001` deliberately created **no Command policy**, with a comment saying why
(no key, so a policy would grant sight of ciphertext and nothing else). That reason
expires the moment Command gets the key, which is B10.

Exact change, following the `vendor_kyc` precedent (`20260706000001`):

```sql
create policy "command admins read all payout methods"
  on public.vendor_payout_methods for select
  to authenticated
  using (public.is_portal_member('command') and (public.has_role('admin') or public.has_role('root')));

create policy "command admins read all payout method logs"
  on public.vendor_payout_method_log for select
  to authenticated
  using (public.is_portal_member('command') and (public.has_role('admin') or public.has_role('root')));
```

**No new grants needed** — `authenticated` already holds `SELECT` on both tables from
`20260815000001`; grants are per-table, not per-policy. **No write policy for Command**:
staff must not be able to edit a vendor's payout destination, and nothing in this phase
asks to.

**Blast radius:** additive policies only. No table is rewritten, no existing row is
touched, no lock beyond a brief `ACCESS EXCLUSIVE` on the two tables while the policy is
added. Reversible with `drop policy`. ⚠️ It **widens** who can read these rows — that is
the point, and it is why B10's route is caller-gated rather than relying on RLS alone.

### B10 — Command decrypt route + its own crypto module ✅ DONE (2026-08-16)

> ✅ **Executed in stage 9.** `command/lib/payout/crypto.server.ts` (ported verbatim,
> minus `detailsEqual` which has no consumer there), `command/lib/payout/schema.ts`
> (types + `toLocalMobile` only — **no `PH_BANKS`**, per G20),
> `command/lib/commandAuth.server.ts`, `command/app/api/vendor-payout/route.ts`.
>
> **Verified live — 21/21 cross-app**, saving through the vendor route and reading
> through Command's, fixture cleaned (0 rows, 0 view-log rows):
> the account number and name **decrypt across apps**; the bank name resolves from
> `display.label` with no bank list in Command; fields come back ordered for a transfer
> form; Maya round-trips with the mobile rendered **locally** for transcription; the
> read writes exactly one audit row naming the admin; a command **member**, a vendor
> user and an unauthenticated caller are all refused **and none of them decrypted or
> logged**; a vendor with no destination gives 404; a **moved blob is refused** with
> "do not send a payment" and writes **no** audit row; and no refusal body leaks a value.
>
> **Two decisions taken during execution, both stated in the file:**
> 1. **403 for every unauthorised case**, not 401-then-403. Matches
>    `app/api/users/route.ts`, and declines to tell an unauthorised caller whether their
>    session is valid. Deviates from this plan's draft wording, deliberately.
> 2. **The audit row is written BEFORE the plaintext is returned, and a failed write
>    fails the request (503).** An audit control that a failing insert can skip is not a
>    control. This is the opposite of the vendor app's best-effort change-log, and the
>    difference is principled: there the write had already committed so failing would
>    misreport it; here nothing has been disclosed yet, so failing closed costs a retry.
>
> **Found and fixed en route (G23):** `verifyCaller` was private to `users/route.ts`.
> Rather than duplicate a security check, it was **extracted verbatim** to
> `lib/commandAuth.server.ts` and both routes now import it, along with
> `PRIVILEGED_ROLES` — which `users/route.ts` uses for a *different* question (is the
> caller granting privilege) that must nevertheless name the same set. Lint on that file
> went **8 → 5 errors**; the extraction removed three pre-existing `any`s with it.
**Files:** new `command/lib/payout/crypto.server.ts`, `command/lib/payout/schema.ts`,
`command/lib/payout/banks.ts`, `command/app/api/vendor-payout/route.ts`

⚠️ **This is a second copy of the encryption key.** `PAYOUT_ENCRYPTION_KEY` must be set
in Command's environment, identical to vendor's. Two copies is two places to leak it
from, and it is unavoidable: there is no shared-code or shared-secret path between apps
in this repo.

⚠️ **Two modules are duplicated from `vendor/lib/payout/`** — the crypto and the detail
types. The blob format must stay byte-compatible across apps or Command decrypts
garbage. **Guarded by I9's ported tests**, not by hope.

✅ **`PH_BANKS` is NOT duplicated (G20, 2026-08-16).** The draft assumed Command would
need the bank list to turn `bankCode` into "BDO Unibank". It does not:
`display.label` **already holds the resolved bank name**, snapshotted at write time
(`vendor/lib/payout/schema.ts:257`), in the same row Command is already reading. One
fewer copy, one fewer drift surface, and the snapshot is the more correct value anyway
— it is the name the vendor actually selected, not what the list says today.

`GET /api/vendor-payout?vendorId=…`:
1. authenticate with the SSR client → **401**
2. verify **command portal membership + admin|root**, server-side, before touching the
   admin client → **403**. Mirrors `command/app/api/users/route.ts`, and follows
   `conventions.md`'s rule that the service-role key means the route is the only place
   this check can live
3. service-role read of `details_enc` + `method_type` + `schema_version`
4. **refuse an unknown `schema_version`** rather than guessing — return a 409 telling
   staff the record was written by a newer build
5. `decryptDetails`, resolve `bankCode` → bank name, return the plaintext fields
6. record the access, if **D9** is taken

**Leak rules, same as vendor's route and non-negotiable:** no `console.*` may receive
the decrypted details; no telemetry; the response is the only place plaintext appears.

### B11 — `VendorPayoutModal` — the details, with per-field copy ✅ DONE (2026-08-16)

> ✅ Four files as planned: `VendorPayoutModal.tsx` (pure render), `useVendorPayoutModal.ts`
> (all state), `CopyField.tsx` (pure display, `copied` as a prop so two fields cannot both
> claim it), `VendorPayoutModal.module.css` — **a CSS Module, matching command's
> CSS-Modules-first convention** rather than vendor's Tailwind. Command's **first Radix
> dialog**, with `Dialog.Title` + real `Dialog.Description`.
> Verified in a browser as part of I7's 22/22 run.
**Files:** new `command/components/vendors/VendorPayoutModal/` — `VendorPayoutModal.tsx`,
`useVendorPayoutModal.ts`, `VendorPayoutModal.module.css`, `CopyField.tsx`

**Component separation, per component:**

| File | Role | Satisfies |
|---|---|---|
| `VendorPayoutModal.tsx` | Pure render layer. No state, no effects, no handler bodies | §1 |
| `useVendorPayoutModal.ts` | Fetch + decrypt call, loading/error state, reveal toggle, per-field copy state and its reset timer | §2 |
| `CopyField.tsx` | Pure display: one labelled value + its copy button. Receives `copied` as a prop | §4 exception |
| `VendorPayoutModal.module.css` | **CSS Module — command is CSS-Modules-first** (`conventions.md`), unlike vendor's Tailwind-first cards | §3 |

⚠️ **Must satisfy the accessible-name convention on day one** — see **I11**.
`Dialog.Title` supplies the name; use `aria-describedby={undefined}` (Radix's documented
opt-out) rather than inventing subtitle copy to silence a warning. This is not optional
polish: `.plans/2026-08-15-vendor-form-modals-to-radix-dialog.md` → **I6** is still ⬜ TODO
with three vendor modals lacking it, and shipping B11 without it makes this the fourth.

**Built on Radix Dialog, deliberately deviating from command's local pattern.** Command
still uses `components/ui/ModalOverlay`, which is a **bare backdrop with no focus trap,
no Escape handling, no scroll lock and no `role="dialog"`** — the exact gaps that got
vendor's equivalent deleted on 2026-08-15. `@radix-ui/react-dialog` is **already a
dependency in command and currently unused**, so this adds nothing to install. For a
dialog displaying decrypted bank details, keyboard containment and a reliable Escape are
worth the small inconsistency. ⚠️ This makes it **command's first Radix dialog** — a
convention decision worth knowing about, not a silent one.

**Behaviour:**
- Opens → fetches and decrypts **once**. Not on card render, not per list item.
- Values render **masked by default**, with one **Reveal** toggle. Checking *which*
  method a vendor uses should not put an account number on a shared screen.
- **Every field gets its own copy button** (the request): bank name, account name,
  account number; or account name + mobile number for a wallet. Copy uses the **true**
  value whether or not it is revealed, so the common path is one click and no reading.
- Copy feedback is per field (tick + "Copied", reverting after ~2s) so it is obvious
  *which* field is on the clipboard — a single shared "Copied!" is how the wrong value
  gets pasted.
- Also shows the method name and, for a bank, the resolved institution — the things a
  transfer form asks for.

**States (ux-design §4):** loading → skeleton rows, never a blank dialog; error →
what failed and what to do (a decrypt failure means a key mismatch, which staff cannot
fix — say so plainly and name the vendor id for the bug report); empty → the modal is
not reachable when nothing is configured (see I7); populated → the fields.

⚠️ **Clipboard caveat, to be stated in the plan rather than discovered:**
`navigator.clipboard.writeText` needs a secure context (fine — HTTPS in production,
localhost in dev), and the copied value **stays in the OS clipboard** until overwritten,
readable by any other app. That is inherent to "paste it into a banking app" and is not
worth engineering around, but it means a shared workstation is a real exposure.

### B12 — `vendor_payout_view_log` — who read a payout destination ✅ DONE (2026-08-16)

> ✅ **Shipped in the same migration.** **Verified against the applied schema, 6/6**
> under real sessions: a Command admin reads it; a **vendor-admin sees nothing**
> (deliberate — no vendor policy); `authenticated` is denied INSERT, UPDATE **and**
> DELETE, so append-only holds against the role that could otherwise rewrite history;
> `anon` is denied SELECT. Rolled back, 0 residue.
>
> ⬜ **Nothing writes to it yet** — B10's decrypt route is its only writer. Until stage
> 9 lands, the table is correct but empty by construction.
**Ships inside stage 8's single migration** (D9, resolved 2026-08-16).

Phase 1 logs **changes**. Nothing logs **reads**, and once Command can decrypt, a read
is the more sensitive event: it is the one an insider needs, and the one that leaves no
other trace.

```sql
create table public.vendor_payout_view_log (
  id         uuid        primary key default gen_random_uuid(),
  vendor_id  uuid        not null references public.vendors(id) on delete cascade,
  viewed_by  uuid        references public.profiles(id) on delete set null,
  viewed_at  timestamptz not null default now()
);

comment on table public.vendor_payout_view_log is
  'Every decrypt of a vendor payout destination by Command staff. Append-only. Records WHO looked and WHEN — never what they saw, which is already in vendor_payout_methods.';

create index vendor_payout_view_log_vendor_idx on public.vendor_payout_view_log (vendor_id, viewed_at desc);
create index vendor_payout_view_log_viewer_idx on public.vendor_payout_view_log (viewed_by, viewed_at desc);

alter table public.vendor_payout_view_log enable row level security;

create policy "command admins read payout view log"
  on public.vendor_payout_view_log for select to authenticated
  using (public.is_portal_member('command') and (public.has_role('admin') or public.has_role('root')));

grant select         on public.vendor_payout_view_log to authenticated;
grant select, insert on public.vendor_payout_view_log to service_role;
```

⚠️ **It stores no payout data at all** — not even the mask. What was seen is already
recorded in `vendor_payout_methods`; duplicating it here would make the audit trail
itself a second place to leak from. Two indexes because this table answers two
questions: "who touched vendor X" and "what has this admin been looking at" — the
second is the insider-risk query and is useless without its own index.

⚠️ **Deliberately no vendor-side read policy.** A vendor seeing which staff member
opened their record is a different feature with its own privacy questions.

### B13 — `vendor_account_completion` view — one definition, in the database ✅ DONE (2026-08-16) *(schema half)*

> ✅ **Shipped in the same migration.** **Verified 7/7 pre-apply and 2/2 post-apply:**
> `security_invoker` reads back as `on`; a vendor-admin sees only their own row with an
> **inactive offering still counting** (D3); a Command admin sees the same answer; a
> **booker gets no row while still being able to read the `vendors` row** — which is
> what proves the guard excluded them rather than the test being vacuous; `anon` is
> denied entirely; adding an active payout flips `has_payout_details` and disabling it
> flips back.
>
> ✅ **Vendor-side rework done in stage 9 (2026-08-16).** `deriveCompletion()` is
> retired — `lib/accountCompletion.ts` now exports only the `AccountCompletion` type,
> with a header explaining where the rule went and why. `accountCompletion.service.ts`
> reads the view instead of deriving. `lib/accountCompletion.test.ts` is **deleted**:
> its subject no longer exists, and a test file outliving the function it tests is
> exactly the kind of stale reassurance this plan keeps trying to avoid.
> **The rule now exists in exactly one place.**
>
> **Cost, stated honestly:** vendor's suite went **226 → 214** — 12 unit assertions
> retired. The four-quadrant matrix is still covered, but by the rolled-back probe
> against the real view (7/7 in stage 8) rather than by `npm test`. Fewer tests,
> testing the actual authority, but they now need a database.
>
> ✅ **REGRESSION-VERIFIED IN THE BROWSER (2026-08-16), 13/13.** ⚠️ This was initially
> signed off on `tsc` + `npm test` + `eslint` alone — which, after the very unit tests
> that covered this rule were deleted, said **nothing** about whether completion still
> worked. Caught and closed rather than left standing. Re-run through the real UI on the
> reworked service, fixture cleaned:
> - modal still auto-opens; both steps read Incomplete; header indicator present; **no
>   page errors from the new service**
> - **an INACTIVE offering still counts** — decision D3 survived the move from TypeScript
>   into SQL, which is the single assertion most likely to have been lost in translation
> - **`status = 'disabled'` still reads as incomplete** — the other retired unit test,
>   re-pinned against the real view
> - payout-only and offering-only both read "1 step left"; a complete account shows
>   neither modal nor indicator
> - **`refresh()` through the new service still clears the indicator live** after saving
>   a payout destination — the seam most at risk from swapping the service out
>
> ⚠️ One behaviour change worth knowing: a **missing** view row is now treated as
> *unknown*, not incomplete. The view returns nothing to a caller not entitled to an
> answer, and "you may not ask" is not "the answer is no".
**Ships inside stage 8's single migration** (D10, resolved 2026-08-16).
⚠️ **This supersedes part of Phase 1's B5.**

```sql
create view public.vendor_account_completion
with (security_invoker = on) as
select v.id as vendor_id,
       exists (select 1 from public.offerings o where o.vendor_id = v.id)              as has_offering,
       exists (select 1 from public.vendor_payout_methods pm
                where pm.vendor_id = v.id and pm.status = 'active')                    as has_payout_details,
       exists (select 1 from public.offerings o where o.vendor_id = v.id)
         and exists (select 1 from public.vendor_payout_methods pm
                      where pm.vendor_id = v.id and pm.status = 'active')              as is_account_complete
  from public.vendors v;

comment on view public.vendor_account_completion is
  'THE definition of a complete vendor account: at least one offering (any status) AND an active payout method. Both the vendor portal and Command read this — do not re-derive it in application code.';

grant select on public.vendor_account_completion to authenticated;
```

⚠️ **`security_invoker = on` is load-bearing** — without it the view runs as its OWNER
and silently bypasses RLS on `offerings` and `vendor_payout_methods`, letting any
authenticated user learn which vendors have payout configured.

⚠️ **The `where` clause is ALSO load-bearing, and is not a duplicate of RLS (G19).**
`security_invoker` alone is not enough. `20260515000001_booker_vendor_read_policy.sql`
lets any **booker** read every **active** vendor row — so without the guard a booker
querying this view would get one row per active vendor reading
`has_payout_details = false`, because they cannot see the payout rows rather than
because none exist. That is a **wrong** answer, not a hidden one, and
"is this account complete" reads like an objective fact. The clause makes the view
return **a correct answer or no row, never a false one**.

**Verified on the local database 2026-08-16 (rolled-back probe, 7/7):** PG 17.6,
`security_invoker` reads back as `on`; a vendor-admin sees only their own row with an
**inactive** offering still counting (D3); a Command admin sees the same row with the
same answer; a **booker gets no row at all — while still being able to read the
`vendors` row**, which is what proves the guard did the excluding rather than the test
being vacuous; adding an active payout flips `has_payout_details`, and disabling it
flips back.

`exists` rather than `count(*) > 0`: it stops at the first row, and "any offering,
regardless of status" (decision **D3**) is expressed directly rather than as a count
that a later reader might be tempted to filter.

**What this reopens in Phase 1 — stated plainly rather than discovered later:**

| Phase 1 artefact | Fate |
|---|---|
| `vendor/lib/accountCompletion.ts` → `deriveCompletion()` | **Retired.** The file keeps only the `AccountCompletion` interface — a type, not logic |
| `vendor/lib/accountCompletion.test.ts` (20 assertions) | **Retired with it.** Its subject no longer exists |
| `vendor/services/accountCompletion.service.ts` | **Simplified** from two queries + a derivation to a single `select` from the view |
| `vendor/hooks/useAccountCompletion.ts` | Unchanged — it consumes the service's shape, which is the seam holding |
| The four-quadrant matrix | **Re-pinned as an e2e test against the real view.** Arguably stronger: it now tests the actual authority rather than a copy of its rule |

**Net:** ~20 unit assertions traded for ~6 e2e assertions against the thing that
actually decides. Fewer tests, testing something truer. The honest cost is that they
need a database to run, so they no longer fail fast in `npm test`.

### B14 — Bind payout ciphertext to its row (AAD) ✅ DONE (2026-08-16) — vendor-side, no migration

> ✅ **Executed as stage 7.5.** `lib/payout/crypto.server.ts` (+ `.test.ts`),
> `app/api/payout-method/route.ts:133` and `sameDetails`. Version `v1 → v2`, with **no
> legacy branch** — a `v1` blob is not row-bound, which is the defect v2 exists to fix,
> so accepting one would reintroduce it. Confirmed **0 rows existed** beforehand, so
> nothing needed re-entering.
>
> **Verified machine-side:** `npm test` 221 → **226 passing, 0 failing**; `tsc` 0;
> `eslint` 0; build clean.
>
> **Verified live — 16/16 against the real route and real stored bytes**, fixture
> cleaned up (0 rows left):
> - *Regression:* PUT still 200 and masked-only · stored blob is `v2` · no plaintext in
>   the row · **an unchanged re-save still dedupes**, which is what proves
>   decrypt-under-AAD works on the real path · a genuine switch is still audited ·
>   DELETE still works
> - *The attack:* vendor A's ciphertext copied byte-identically onto vendor B's row by a
>   simulated keyless DB writer. **A's blob cannot be decrypted under B's id**, while it
>   still decrypts under A's. B's owner re-submitting identical details is **not**
>   silently treated as unchanged — the change is audited and the row is rebound to B.
>   Both directions asserted, so the test cannot pass by simply breaking decryption.
>
> **Two slips of mine, both caught by the checks and neither a product bug:** an
> `assert.throws(fn, undefined, msg)` that `tsc` rejects (same as stage 3), and a `v1.`
> assertion my global find/replace ran past before the targeted one could match.
**Files:** `vendor/lib/payout/crypto.server.ts` (+ `.test.ts`), `vendor/app/api/payout-method/route.ts:133`, `:272`

**The gap.** `encryptDetails` uses AES-256-GCM but sets **no AAD** (`grep setAAD` →
nothing). The ciphertext is not bound to the vendor it belongs to, so a blob is
portable between rows.

**Why Phase 2 turns this from theoretical into real.** Consider an attacker with
database write access but **no key** — precisely what a leaked
`SUPABASE_SERVICE_ROLE_KEY` gives. They cannot forge a `details_enc`; they do not have
the key. Garbage fails decryption loudly. Deleting is visible to the vendor. The
**only** silent, useful move available to them is to **copy vendor A's blob into vendor
B's row** and adjust `display` to look plausible.

- **Before Phase 2:** nobody could decrypt it, so the swap accomplished nothing.
- **After Phase 2:** Command staff open vendor B, see A's bank details, and wire B's
  earnings to A. The view log (B12) records a perfectly legitimate-looking read.

So this is not generic hardening — it closes **the one attack a keyless database writer
has**, and the consequence it prevents is money reaching the wrong account, which is the
highest-severity outcome the system has.

**Fix.** `cipher.setAAD(Buffer.from(vendorId))` on encrypt, the same on decrypt. A moved
row fails the GCM auth tag and throws, which B10's route already surfaces as an error.
Silent misdirection becomes a loud failure.

```
encryptDetails(details, vendorId)   // setAAD before update()
decryptDetails(blob, vendorId)      // setAAD before final()
```

Both call sites already have `vendorId` in scope — `route.ts:133` (PUT) and `:272`
(`sameDetails`, which needs the id threaded one level).

**Version prefix goes `v1` → `v2`.** A v1 blob and a v2 blob are structurally identical
but decrypt differently, so the prefix is what keeps them distinguishable.
`decryptDetails` already throws `unsupported version "v1" — this build understands v2`,
which is the correct behaviour: **no legacy branch is added**, because there are no
legacy rows worth one.

**Blast radius — this is why it happens NOW.** Verified 2026-08-16:
`vendor_payout_methods` holds **0 rows** locally and the table **does not exist on
hosted** (`db push` has not run). So the change costs one edit today. Later it would
mean decrypting every row under the old scheme and re-encrypting under the new one,
through a migration that has to hold plaintext in flight. Any local test row created
before this lands will fail to decrypt with a clear message — re-enter it through
Settings → Change payout details.

**Also documents the key-rotation convention (G21):** the version prefix covers *how to
interpret this blob*, which includes **which key generation encrypted it**. Rotating the
key means minting `v3` and keeping a `v2` branch for as long as un-rotated rows exist.
Nothing in the schema needs to change for that — but it was not written down anywhere,
and with two apps now holding the key it needs to be.

**Tests:** the existing `crypto.server.test.ts` round-trips gain a `vendorId`; add
**"a blob encrypted for vendor A fails to decrypt as vendor B"**, which is the whole
point of the change and the assertion that would catch a regression.

---

## IMPORTANT (Phase 2)

### I7 — Payout-configured icon on the vendor card ✅ DONE (2026-08-16)

> ✅ `VendorPayoutBadges` (+ `.module.css`) on the card, fed by the **existing** paged
> `getVendors()` query — `vendor_payout_methods(...)` embeds as a 1:1 object exactly like
> `vendor_kyc`, so the list costs **no extra round trip** and **no decryption**. Only
> `display` is selected; `details_enc` never leaves the server.
>
> **Verified in a real browser — 22/22**, fixture cleaned (0 payout rows, 0 view-log rows):
> masked destination on the card; an absent one reads **"No payout"** and is
> **non-interactive**; the modal opens, shows the bank name, and is **masked before
> Reveal**; **each field has its own Copy button**; **Copy puts the TRUE value on the
> clipboard without revealing** and the screen stays masked; feedback **names the field**
> and moves when another is copied; Reveal/Hide work; **Escape closes it** (Radix, not the
> bare `ModalOverlay`); it states the access was recorded and when the destination last
> changed; **exactly one audit row per open, naming the admin**; and **zero Radix
> accessible-name warnings** (I11).
**Files:** edit `command/services/vendors.service.ts`, `command/lib/types.ts`,
`command/components/vendors/VendorCard/VendorCard.tsx` (+ its `.module.css`),
`command/components/vendors/VendorsPage/VendorsPage.tsx`

**No new query, and no plaintext in the list.** `getVendors()` already fetches every
vendor in one paged call with `vendor_kyc(status)` embedded — the anti-N+1 pattern
recorded at `vendors.service.ts:52-56`. `vendor_payout_methods.vendor_id` is that
table's **PRIMARY KEY**, exactly like `vendor_kyc`, so PostgREST returns a 1:1 **object**
(not an array). **Verified against the local database on 2026-08-16**, both embeds in
one select:

```
vendors?select=id,name,vendor_kyc(status),offerings(count),vendor_payout_methods(method_type,status,display)
→ {"vendor_kyc":null,"offerings":[{"count":4}],"vendor_payout_methods":null}
```

So `Vendor` gains `payoutMethod: { methodType, status, display } | null` and the card
renders from data it already has.

**The icon renders in both states, not just when configured** — muted and
non-interactive when there is none. Mirrors `KycBadge`, which renders an explicit
"none" rather than disappearing, and for the same reason: an absent icon is
indistinguishable from "I forgot to look", while a muted one says *asked and answered*.
Clicking the configured state opens **B11**.

⚠️ The card shows only the **masked** `display` — already safe, straight from the
column. No decryption happens anywhere in the list.

### I8 — "Account complete" icon on the vendor card ✅ DONE (2026-08-16)

> ✅ Reads `vendor_account_completion` — **no rule is written in Command at all**, which
> is what D10 bought. One extra **bulk** query per page, paged through `fetchAllPages`.
>
> ⚠️ **The embed was tested and is NOT possible** (the plan left this open): PostgREST
> infers embeds from foreign keys and a view has none — *"Could not find a relationship
> between 'vendors' and 'vendor_account_completion'"*. The planned bulk fallback is
> therefore the implementation, and the list stays **2 queries** regardless of card count.
>
> Renders Complete / Incomplete / **Unknown** as words, with a tooltip naming which
> requirement is missing. `null` renders as **Unknown**, never Incomplete — a failed
> fetch must not accuse a fully set-up vendor.
**Files:** edit `command/services/vendors.service.ts`, `command/lib/types.ts`, `VendorCard.tsx`

Reads **`vendor_account_completion`** (B13). No rule is written in Command at all — the
duplication D10 was asked about does not happen, because there is nothing to duplicate.

**Query shape:** one extra **bulk** call per page, not per card —
`from("vendor_account_completion").select("vendor_id, has_offering, has_payout_details, is_account_complete").in("vendor_id", ids)`
— joined to the vendor rows in memory. Two queries for the whole list.

⚠️ **Whether PostgREST can *embed* the view directly in the existing `vendors` select
(making it one query) is UNVERIFIED** — embedding needs an inferable relationship, and
the view does not exist yet so it could not be tested on 2026-08-16. Try the embed at
execution time; **fall back to the bulk query above**, which is known to work and is
still not N+1.

Renders as a small check/incomplete marker beside the payout icon, **with a tooltip
naming which requirement is missing** — "incomplete" alone tells staff nothing they can
act on, whereas "no payout details" is something they can chase.

### I9 — A test runner for `command`, and the payout-format drift guard ✅ DONE (2026-08-16)

> ✅ **Executed in stage 9.** `command/package.json` gains the same zero-dependency
> runner vendor uses; `tsconfig.json` gains `allowImportingTsExtensions`;
> `command/lib/payout/crypto.server.test.ts` is vendor's suite ported verbatim.
> **`npm test` in command: 17 passing, 0 failing — command's first unit tests.**
>
> ⚠️ **Narrowed twice from the draft, and the file says so:** D10 moved the completion
> rule into the database and G20 removed the `PH_BANKS` copy, so the only duplicated
> thing left is the crypto blob format. The ported tests prove each app is
> *self*-consistent; the thing that proves the two **agree** is B10's cross-app run, and
> the test header points at it rather than letting the unit tests imply more than they
> show.
**Files:** edit `command/package.json`, `command/tsconfig.json`, new `command/lib/payout/schema.test.ts`

**Narrowed twice.** D10 put the completion rule in the database, and G20 removed the
`PH_BANKS` copy. What remains duplicated by B10 is the payout **format** alone: the
crypto blob layout and the detail shapes. Those must stay byte-compatible across the two
apps or Command decrypts garbage, and nothing currently notices if they diverge.

Command has **no unit tests at all** today (`conventions.md`: "booker and command have
none yet"). Add the same zero-dependency runner vendor uses — `node --test
--experimental-strip-types` plus `allowImportingTsExtensions` — and port vendor's
payout-schema and `PH_BANKS` tests **verbatim**.

Verbatim is the mechanism, not laziness: two copies of a format with two different test
suites drift silently; two copies pinned by identical assertions do not.

### I11 — Radix dialog accessible names: comply, and prove it ✅ DONE (2026-08-16) *(this plan's dialogs)*

> ✅ `VendorPayoutModal` ships with `Dialog.Title` and real `Dialog.Description`, so no
> `aria-describedby` opt-out is needed. **Proven, not assumed:** the browser run captures
> `console` **warnings** as well as errors — the gap that made stage 6's `pageerror`-only
> listener incapable of catching this — and asserts **zero** Radix accessible-name
> warnings.
>
> ⏸ The three **pre-existing** vendor form modals remain
> `.plans/2026-08-15-vendor-form-modals-to-radix-dialog.md` → **I6**'s to fix. Not poached.
**Files:** `command/components/vendors/VendorPayoutModal/VendorPayoutModal.tsx` (B11),
`vendor/visual-tests/pilot.spec.ts`

**Cross-plan:** `.plans/2026-08-15-vendor-form-modals-to-radix-dialog.md` → **I6** owns
fixing the three **pre-existing** vendor form modals (`OfferingFormModal`,
`ScheduleFormModal`, `StaffFormModal`), which still head themselves with a plain `<p>`
and make Radix warn on open. **That stays theirs — this item does not fix them.**

What this item owns is the dialogs *this* plan introduces:

1. **B11 ships compliant** — `Dialog.Title` for the accessible name, and an explicit
   `aria-describedby={undefined}` opt-out unless there is real subtitle copy.
2. **Prove `AccountCompletionModal` is already compliant rather than assuming it.**
   It was written with both `Dialog.Title` and `Dialog.Description`, so it *should* emit
   no Radix warning — but ⚠️ **that was never verified.** Stage 6's e2e listened for
   `pageerror` only, and Radix warnings are `console.warn`, so the existing "no console
   errors" assertion could not have caught one. An unverified claim is exactly what the
   status model exists to stop.
3. **Add the assertion that closes the gap**: drive the `completionmodal` gallery mode
   with a `console` listener capturing `warning` as well as `error`, and assert **zero
   Radix warnings**. That turns a convention into something a regression breaks, and it
   is the mechanism I6 will want too.

**Verification:** live browser console via Playwright — machine-verifiable once written,
but it needs the dev server, so it is not a `npm test` check.

### I12 — Live validation on the payout mobile field ✅ DONE (2026-08-16)
**Files:** `vendor/lib/payout/phMobile.ts` (+ `.test.ts`), `usePayoutDetailsCard.ts`, `PayoutMethodFields.tsx`, `PayoutDetailsCard.tsx`

Requested after the plan was otherwise complete: the mobile field only reported problems
on submit, so a vendor learned their number was wrong after pressing Save.

⚠️ **Matches registration's UX PATTERN, deliberately NOT its rule.** Registration
validates with `isValidPhone` — 7–15 digits, any country — because it collects a
business contact number. Reusing that here would accept `+1 555 123 4567` client-side
and have the **server reject it on save**: the form saying "fine" and the save saying
"no" is worse than no client validation at all. The payout field keeps
`normalisePhMobile`'s strict PH-mobile rule; only the *feedback behaviour* is borrowed.

The borrowed pattern is registration's two tiers (`useLoginPage.ts:62-70`): **letters
flagged instantly** (unambiguous, no point waiting), **anything else only once the field
is left** (a half-typed number is not an error yet). Implemented as a pure
`mobileFieldIssue(raw, touched)` in `lib/payout/phMobile.ts`, so the logic is
unit-testable rather than trapped in a hook.

> **Found while wiring it — a bug I introduced and then caught by tracing the merge:**
> the live check returning `null` for an untouched field would **wipe the submit error**
> that `parsePayoutDetails` had just set, so typing a short number and pressing Save
> showed *nothing*. Fixed by treating a save attempt as leaving the field — which is
> exactly what registration does ("or tries to continue"). Asserted explicitly in the
> browser run.

**Verified:** `npm test` 214 → **220 passing** (6 new, including one asserting the rule
stays **stricter** than `isValidPhone` so nobody later "aligns" them); `tsc` 0;
`eslint` 0; the payout/completion visual suite **23/23** unaffected.
**Browser, 11/11**, fixture cleaned: letters flagged instantly without blurring · a
half-typed number stays silent · flagged on blur with `aria-invalid` set · clears the
moment it becomes valid · **accepts registration's `+63 917 123 4567` spacing** ·
**refuses a non-PH number the old rule would have passed** · **saving without blurring
still shows the error and saves nothing** · correcting it then saves and shows the mask.

### I10 — Documentation (Phase 2) ✅ DONE (2026-08-16)

> ✅ `architecture/schema.md` — the `20260816000001` migration row, plus full sections for
> `vendor_payout_view_log` and the `vendor_account_completion` **view** (including both
> load-bearing guards and the G24 grant gap).
> ✅ `architecture/portals.md` — two Command feature rows; the vendor Known Gap
> *"nobody can read them"* struck through as **closed**, replaced with what is still true
> (no rail, no notification) plus the two-copies-of-the-key warning.
> ✅ `architecture/conventions.md` — `command` now has a test runner, and **why** it
> exists (the duplicated payout format).
- **`architecture/portals.md`** — Command feature table gains the payout viewer and the
  completion indicator; the vendor Known Gap "nobody can read them" is **removed** once
  B9–B11 land, and replaced with what is still true (no rail, no notification).
- **`architecture/schema.md`** — record the Command read policies on both tables and
  that Command holds a second copy of the key.
- **`architecture/conventions.md`** — note that `command` now has a test runner, and
  that command's first Radix dialog exists alongside the older `ModalOverlay`.
- **`command/README.md`** — `PAYOUT_ENCRYPTION_KEY` setup, and the warning that it must
  be **byte-identical to vendor's** or every decrypt fails.

---

## DECISIONS (Phase 2)

<!-- No Phase 2 item may execute while any OPEN: line below remains. -->

- **D11 — dialog primitive for the new Command modal** → **Radix Dialog** (resolved 2026-08-16, my call). Already a dependency and unused; `ModalOverlay` has no focus trap, no Escape, no scroll lock, no `role="dialog"`, which is not acceptable for a dialog showing bank details. Deviates from command's local pattern deliberately and says so.
- **D12 — does the card icon render when no payout is configured?** → **Yes, muted and non-interactive** (resolved 2026-08-16, my call). Follows `KycBadge`'s explicit "none" state; an absent icon cannot be distinguished from an unasked question.
- **D13 — masked-by-default with a Reveal, or plaintext on open?** → **Masked by default** (resolved 2026-08-16, my call). Copy still uses the true value, so the primary job stays one click, while opening the modal to check the *method* does not expose an account number on a shared screen.
- **D9 — audit payout *views*, not just changes?** → **New `vendor_payout_view_log` table** (resolved 2026-08-16). Once staff can read bank details, "who looked" is the question an insider-risk review asks, and the only signal that would catch quiet enumeration of vendor bank accounts. Written by B10's route on every decrypt; append-only; command admin/root read only. Folded into stage 8's single migration so it costs no extra stop.
- **D10 — how is the duplicated completion rule kept honest?** → **Move the rule into the database** (resolved 2026-08-16). A `vendor_account_completion` view becomes the single definition both apps read; the rule is then impossible to duplicate, rather than duplicated-and-guarded. ⚠️ **This reopens verified Phase 1 work** — see **B13** for exactly what changes and what coverage is lost and gained. Accepted knowingly.

---

## Execution order (Phase 2)

| # | Stage | Items | Depends on | Gate |
|---|---|---|---|---|
| **7.5** ✅ | **Row-binding** — **DONE 2026-08-16**, 16/16 live — **B14**. Independent of everything below and cheapest today; do it before any Phase 2 code so Command is only ever written against the v2 format | **B14** | Phase 1 | — |
| **8** ✅ | **Command read access + the completion view** — **DONE 2026-08-16**, migration applied and verified (4/4 + 6/6 + 2/2) | **B9** (policies) + **B12** (`vendor_payout_view_log`) + **B13** (`vendor_account_completion` view) — **all three in ONE migration file**, so this stops for you once, not three times | Phase 1 applied | 🚧 **new migration — stops for the user** |
| **9** ✅ | **Decrypt path + Phase 1 rework** — **DONE 2026-08-16**, 21/21 cross-app | **B10** (crypto + schema + banks + route) → **I9** (test runner + format drift guard) → **B13's vendor-side rework** (retire `deriveCompletion`, simplify the service, re-pin the matrix as e2e) | 8 | 🚧 `PAYOUT_ENCRYPTION_KEY` into Command's env, byte-identical to vendor's |
| **10** ✅ | **Card icons + modal** — **DONE 2026-08-16**, 22/22 browser | **I7** → **I8** → **B11** → **I11** (dialog names + the warning assertion) → **I10** | 9 | — |

**Two safe prefixes, both runnable before stage 8's migration:**
- **B14 (stage 7.5)** — vendor-side only, no migration, no schema change, and it gets
  strictly more expensive every day it waits.
- **I9's test runner** — adding `node --test` to command and porting the payout-format
  tests needs no migration, no key and no policy.

## Verification (Phase 2)

| Item | How | Kind |
|---|---|---|
| B9 | A command admin session reads a payout row; a **vendor-admin still cannot read another vendor's**; a non-admin command user cannot read any | **needs live environment** |
| B10 | 401 unauthenticated · 403 for a command member without admin/root · 403 for a *vendor* user · 200 returning plaintext for admin · 409 on an unknown `schema_version` | **needs live environment** |
| B10 round-trip | A destination saved in **vendor** decrypts correctly in **command** — the real cross-app check, and the one that catches a key or format mismatch | **needs live environment** |
| B10 leak rule | `grep -n "console\." command/app/api/vendor-payout/route.ts` and read every hit | machine-verifiable |
| I7/I8 | One query for the whole list — assert no per-card request in the network log; masked-only in the list DOM | **needs live environment** |
| I8 rule | `npm test` in command — the same four-quadrant matrix as vendor | machine-verifiable |
| I9 drift | The ported `PH_BANKS`/schema tests pass in **both** apps | machine-verifiable |
| B11 | Copy writes the true value; per-field feedback names the right field; masked until Reveal; **no long digit run in the DOM before Reveal** | **needs live environment** |
| B12 | A decrypt writes exactly one view-log row naming the right admin; a vendor-admin **cannot** read the view log at all | **needs live environment** |
| B13 RLS | ⚠️ **The `security_invoker` check.** A vendor-admin sees **only their own row** in `vendor_account_completion`; a command admin sees all; **a booker-portal user sees none**. Without `security_invoker = on` the first and third of these silently fail open | **needs live environment** |
| B13 matrix | The four quadrants asserted against the real view — neither / offering only / payout only / both — plus `status='disabled'` reading as incomplete | **needs live environment** |
| B13 rework | Vendor portal still shows the right completion state after the service is repointed at the view; `npm test` in vendor drops the retired suite and still passes | mixed |
| All | `npm run build` + `npx tsc --noEmit` in `command` | machine-verifiable |
