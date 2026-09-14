# Command → Payouts: Mark Paid modal, vendor payout invoice email, PayMongo PESONet XLSX

**Date:** 2026-09-13
**App / scope:** `command/` (Payouts page, one new API route), `backbone/` (one migration, `send-notification-email` template). Verify-only: `vendor/` and `ezzy-vendor-mobile` (the bell shows the new notification type). Branch: command `feature/payout_modal_invoice_summary`.
**Status:** IN PROGRESS — staging B1–B7 ✅, B8 ⏸ parked (moved to C8 by user decision) 2026-09-14; production Phase C next; every build item done: B1 ✅ (local), B2–B6 ✅, I1 ✅, I2 ✅; GCash enabled in the PESONet file 2026-09-14 (A10b; PayMongo acceptance open as F14). Remaining: user commits the A10b change, then rollout Phases B–D. Nothing applied to or deployed on any hosted project.

> Replace the inline "Record as paid?" confirmation with a modal that previews **one vendor invoice per vendor**. The same stored invoice then drives the vendor's email and the PayMongo PESONet XLSX. Optimise for **one builder, one stored snapshot**: nothing downstream of the builder recalculates or reformats money.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = must ship for the feature to be correct, I# = important, D# = decision, F# = finding. Numbers are local to this plan. When referring to another plan, name its app (e.g. "command-payouts-redesign I5").

**Out of scope:** automated disbursement through the PayMongo API (this plan only fills in the file for their manual upload); BIR Form 2307; an "un-mark paid" action; resending an invoice; showing invoice history in Command or the vendor portal (see DEFERRED); `booker`.

---

## Investigation summary (verified against code 2026-09-13)

| Question | What the code actually does |
|---|---|
| The overlap in the screenshot | `PayoutRow.tsx:56-66` swaps the button for an inline `Record as paid? Yes No` span. The action column is a fixed `124px` track (`PayoutRow.module.css:6`) and `.confirm` is `white-space: nowrap`, so it overflows into the gutter. The vendor group (`PayoutVendorGroup.tsx:67-77`) has the same inline pattern. The selection bar (`PayoutSelectionBar.tsx:26`) has **no** confirmation at all. |
| "The existing Mark Paid operation" | `releasePayouts(ids)` → `release_booking_payouts(uuid[])` (`20260801000008:19-46`). A single `UPDATE … WHERE payout_status = 'releasable'`. It **silently skips** ids that aren't ready and returns **only a count**, not which ids moved. The UI toasts "N of M marked" (`usePayoutsPage.ts:116-141`). |
| Where the money comes from | `booking_transactions` stores `amount_paid`, `platform_fee_amount`, `payout_amount`, `withholding_amount`, and a **generated** `net_payout_amount`, all computed **by the database** at payment (`20260911000001`). Command only adds up stored values, in centavos (`lib/payout/transfer.ts`). "Final payout" = `net_payout_amount`, already labelled "to transfer" everywhere (`portals.md` → Payouts). |
| Can a paid payout's figures change later? | **Yes.** `correct_booking_transaction()` works on *any* bucket, paid ones included (`portals.md:621-626`). ⇒ An invoice **cannot be re-derived** from the ledger later; it has to be a **stored snapshot**. |
| Grouping today | `groupByVendor` groups by **`vendorName`** (`PayoutsPage.tsx:21-29`), so two vendors with the same name would merge. The invoice must group by `vendor_id`. |
| Email path | Every email is a `notifications` row → trigger → `pg_net` → Edge Function `send-notification-email`, **one email per row**, sent once only (`notification_emails` unique claim, `lib/deliveryLog.ts`). A bespoke template renders from `record.data` (precedent: `kioskBookingConfirmed.ts`), wrapped in the shared branded `layout()` (`templates/base.ts`). Each type needs a `notification_type_settings` row, because `notifications.type` is a foreign key to it (precedent `20260908000001`). |
| Who "the vendor" is for email | A notification targets a **user**. The existing vendor-facing senders notify **every vendor-admin** (`kyc-admin.service.ts:127-150`, booker kiosk webhook `route.ts:196-210`). `vendors.email` exists (`20260504000002:67`, default `''`), but the notification pipeline cannot send to an address that isn't a user. → **D2** |
| pg_net and rollback | The trigger's `net.http_post` is queued in the same transaction, so a rolled-back release sends no email. This is what lets release, invoice and notifications be **atomic**. |
| Resend limit | A known, unfixed defect: Resend allows 10 requests/s, a `429` is recorded as `failed`, and nothing retries (`.plans/2026-08-12-notification-email-rate-limit.md`, status DRAFT). A bulk run to many vendor-admins can hit it. → **D6** |
| Decrypted bank details | Only `/api/vendor-payout` decrypts, and its header **guarantees "one vendor per request — never a list, never a bulk export"** (`route.ts:10-11`). Every decrypt is logged **before** the plaintext is returned. A multi-vendor XLSX contradicts that guarantee. → **D8** |
| Bank identity | The decrypted blob holds `bankCode` (vendor `lib/payout/banks.ts`, 44 codes, our own identifiers). Masked `display.label` holds our own bank *name*, not PayMongo's. Command deliberately keeps no bank list (`command/lib/payout/schema.ts:10-14`). |
| XLSX tooling | Command has `papaparse` only. No xlsx library. → dependency approval gate (**D7**) |
| Tests that exist | `command/visual-tests/payouts.spec.ts:14-58` asserts the **inline** confirmations (these will be rewritten). Node tests: `lib/**/*.test.ts`. DB tests: `backbone/supabase/tests/*.sql` (e.g. `withholding_and_corrections_test.sql`). Edge Function: `deno test`. |

### The PayMongo template (`pesonet_template.xlsx`, inspected 2026-09-13)

- **3 sheets:**
  - `REMINDERS` (instructions);
  - `Details` (the data);
  - `Banks`, which is **hidden** and holds 124 institution names in `A1:A124`.
- **`Details` row 1 headers:** `A Bank Name` · `B Bank Account Name` · `C Bank Account Number` · `D Amount` · `E Remarks`.
- **Validation:** column A (`A2:A999`) has a **list validation** against `Banks!$A$1:$A$127`, so the bank name must match that list **exactly**.
- **Cell formats:** B, C and D are formatted as **text (`@`)**, *including Amount*; A and E are General.
- **Rows:** row 2 is empty, and rows 3–999 of column A are pre-filled with the placeholder `Select Bank…`.
- **Rules in `REMINDERS`:** your PayMongo balance must cover the total; it's PESONet (3 PM cut-off, banking days only); PayMongo isn't liable for wrong account details.
- It's a Google-Sheets export. The three drawing parts are empty, so a library round-trip loses nothing visible.

---

## The design in one picture

```
selected transaction ids
  └─► SQL  _payout_invoice_groups(ids)        ← THE builder (one definition)
        groups by vendor_id, orders rows, sums in exact numeric,
        formats every peso/date ONCE into *_display strings,
        fingerprints each group (md5 of its canonical jsonb)
          ├─► preview_payout_invoices(ids)  → Mark Paid modal (renders *_display verbatim)
          ├─► /api/payout-template          → XLSX: amount = group totals.net_payout, remarks = reference
          └─► release_payouts_with_invoices(ids, fingerprints, request_id)   [one transaction]
                lock rows → all releasable? → rebuild → fingerprints equal? → release
                → insert payout_invoices (snapshot = the group jsonb, verbatim)
                → insert notifications (data.invoice = the same jsonb) → email renders *_display verbatim
```

**Why this guarantees "modal = email = XLSX":**
1. **One builder.** The modal, the XLSX and the stored invoice all come from `_payout_invoice_groups`. Command and the Edge Function never add or format money themselves.
2. **Formatted once.** The modal (Next.js) and the email (Deno) can't share code: there's no shared package, and they're different runtimes. So the builder emits the display strings (`"₱ 10,000.00"`, `"01 Sep 2026"`), and both render those strings as-is. That makes currency formatting identical by construction, not by keeping two formatters in step.
3. **Fingerprint gate.** Confirm sends back the fingerprints the admin *saw*. The RPC locks the rows, rebuilds, and refuses if any fingerprint differs, e.g. a correction landed or a payout went on hold while the modal was open. What gets stored and emailed is therefore byte-for-byte the jsonb whose fingerprint the admin approved.
4. **Stored snapshot.** A later correction to a paid payout doesn't rewrite an invoice that was already sent.

This follows the precedent `preview_booking_transaction_correction()` already set: *"the figures staff review must be the figures that get written, so they are computed by the same database functions"* (`payouts.service.ts:311-316`).

---

## BACKEND (backbone)

### B1 — Migration: statement tables, builder, preview and release RPCs, notification type  ✅ DONE locally (2026-09-13); hosted = big-table Phases B–D — ⚠️ APPROVAL GATE (schema + security): approved 2026-09-13 ("go ahead with stage 2")
<!-- 🔄 2026-09-13 — Written, NOT applied (user applies migrations).
Files: `backbone/supabase/migrations/20260913000001_payout_statements.sql`, `backbone/supabase/rollback/20260913000001_payout_statements.full-revert.sql` (hand-run; keeps the statement tables if they hold rows), `backbone/supabase/tests/payout_statements_test.sql` (rolled-back transaction, ~70 assertions across 12 sections).
Verified (machine): nothing yet. There's no Postgres server in the agent's shell and Docker isn't running, so neither the migration nor the tests have been executed or parsed. Self-review fixed two test bugs (a `->`/`-` operator-precedence error; `vendors.vendor_id` → `vendors.id`).
Remaining before ✅: user applies the migration locally → run the test file (command in its header) → all cases pass, including the plpgsql_check static pass. -->
<!-- ✅ DONE (2026-09-13, local). The user applied 20260913000001 locally (big-table A2). Read-only check before testing: it's the latest row in schema_migrations; both tables exist; release_booking_payouts is still granted to authenticated (expand only); the payout_statement type row is present.
Verified (machine, local DB):
- payout_statements_test.sql: 97/97, EXIT=0, zero plpgsql_check findings at any level; the pending contract migration was applied inline and rolled back.
- Afterwards: 0 statement rows, and the old function still granted, so the rollback left nothing behind.
- Regression: withholding_and_corrections_test 63/63, booking_transitions_test 45/45, auto_acknowledge_test 8/8, all EXIT=0 (same counts as their last recorded runs).
One test-only bug fixed on the first run: `= any((select ids from t_run))` was read as ANY(subquery), i.e. uuid = uuid[]; cast to `::uuid[]` in 4 places. No migration change.
NOT verified here: the demo-teardown change (G3; check in A12); hosted application (big table B2/C3); the concurrent two-session case (I2). -->
**Execution notes (2026-09-13). These supersede the sketch below where they differ:**
- **Split (gap review 2, G1–G2):** `20260913000001` is additive only. The revoke lives in `backbone/supabase/pending/retire_release_booking_payouts.sql` (revert: `rollback/retire_release_booking_payouts.revert.sql`) and becomes a migration in runbook Phase D. `demo/demo-teardown.sql` now clears demo payouts from statements first (G3).
- **Names (D10(i)):** `payout_statements`, `payout_statement_items` (FK column `statement_id`), `payout_statement_groups()` (internal builder), `preview_payout_statements()`, `release_payouts_with_statements()`, notification type `payout_statement`. Formatting helpers `payout_statement_peso()` / `payout_statement_amount()` hold the ONE money format; the SQL test pins `₱ 0.00`, `₱ 4.40`, `₱ 1,000.00`, `₱ 1,234,567.89`, and `1234567.89` for the file.
- **Notification `data`:** `{ statement_id, reference, statement: <snapshot> }` (not `data.invoice`). Title `Payout initiated · EZP-…`; body names the net total and vendor. **Stage 3's template reads `data.statement`.**
- **Preview output** as B1 describes, plus `version: 1`; groups carry `fingerprint, reference, recipient_count, problems, snapshot`. The snapshot includes `issued_on_display` (Asia/Manila, excluded from the fingerprint).
- **Release result:** `{ run_id, released, replayed, statements: [{ statement_id, vendor_id, reference, recipients }] }`. A replay recounts recipients from `notifications`, so its answer matches the original.
- **Grants:** the builder is revoked from `anon`, `authenticated` **and `service_role`** (only the definer RPCs call it). Preview/release are granted to `authenticated, service_role`, matching the correction RPCs; both still refuse a caller who isn't a Command admin.
- **Extra guards not in the sketch:**
  - `fingerprint` CHECK (32 hex);
  - `snapshot` CHECK (object, version 1);
  - index on `created_by` (FK, skill §6);
  - empty/null id arrays, missing fingerprints and a missing request id each raise with a human message.
- **Accepted:** the replay path counts recipients with a scan of `notifications` by `data->>'statement_id'`. It only runs on a retried request, so no index is added.

**File (new):** `backbone/supabase/migrations/2026091X000001_payout_invoices.sql`, dated at execution. **Written, never applied by the agent** (user runs migrations).

**Tables (exact DDL):**
```sql
create table public.payout_invoices (
  id           uuid        primary key default gen_random_uuid(),
  reference    text        not null unique,          -- 'EZP-' || upper(left(fingerprint, 12)); see D10(ii)
  vendor_id    uuid        not null references public.vendors(id) on delete restrict,  -- mirrors booking_transactions.vendor_id
  run_id       uuid        not null,                 -- one confirmation; groups a bulk run's invoices
  request_id   uuid        not null,                 -- client idempotency key (one per modal review)
  fingerprint  text        not null,
  snapshot     jsonb       not null,                 -- the exact group the admin approved; copied verbatim into notifications.data
  created_by   uuid        references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (request_id, vendor_id)
);

create table public.payout_invoice_items (
  invoice_id     uuid     not null references public.payout_invoices(id) on delete restrict,
  transaction_id uuid     not null unique references public.booking_transactions(id) on delete restrict,
  position       smallint not null,
  primary key (invoice_id, position)
);
```
- `payout_invoice_items.transaction_id unique` is the **database backstop for "a payout is never invoiced twice"**.
- The figures live only in `snapshot`, not in duplicated columns (one copy).
- **RLS on both.** One `select` policy for Command admin/root (the `is_portal_member('command') and (has_role('admin') or has_role('root'))` helper pair used by `release_booking_payouts`). No insert/update/delete policies; writes go through the definer RPC only.
- **Grants (AGENTS.md ⚠️ append-only rule):**
  - `revoke all … from anon, authenticated, service_role;`
  - `grant select … to authenticated;`
  - `grant select … to service_role;`
  - The RPC owner writes. Follow `20260911000003`.
- `booking_transactions.booking_id` is `on delete cascade` from bookings. With `restrict` here, deleting a booking that has an invoice fails, which is the right outcome for a financial record. There is no hard booking-delete path today (grep at execution to confirm).

**Snapshot shape (versioned; the contract between SQL, Command and the Edge Function):**
```json
{ "version": 1, "currency": "PHP", "reference": "EZP-3F9A1C07B24D",
  "vendor": { "id": "…", "name": "Acme Dive" },
  "items": [ { "transaction_id": "…", "booking_id": "…", "offering_name": "Discovery Dive",
               "service_date": "2026-09-01", "service_date_display": "01 Sep 2026",
               "amount_paid": "1000.00",  "amount_paid_display": "₱ 1,000.00",
               "platform_fee": "120.00",  "platform_fee_display": "₱ 120.00",
               "withholding": "4.40",     "withholding_display": "₱ 4.40",
               "net_payout": "875.60",    "net_payout_display": "₱ 875.60" } ],
  "totals": { "amount_paid": "…", "amount_paid_display": "…", "platform_fee": "…", "platform_fee_display": "…",
              "withholding": "…", "withholding_display": "…", "net_payout": "…", "net_payout_display": "…" } }
```
- Raw amounts are **2-decimal strings** (exact numeric, never floats), for the XLSX. The `*_display` strings are for people.
- `"₱ "` + `to_char(n, 'FM999,999,999,990.00')` reproduces Command's `fmtPeso` (`command/lib/utils.ts:56`), so the modal looks like the rest of the page.
- Dates use `to_char(d, 'DD Mon YYYY')` → `01 Sep 2026`, on the stored **date** (no timezone conversion). Checked 2026-09-13: this is exactly what `fmtPhDate` renders (`en-GB`, `2-digit` day, `short` month; `command/lib/utils.ts:64-69`). `Mon` without the `TM` prefix is never localised.
- **Row order:** `service_date, offering_name, transaction_id`. **Group order:** `vendor name, vendor_id`. Both are deterministic, so ordering is part of what the fingerprint covers.
- `fingerprint` = `md5((snapshot minus reference)::text)`. jsonb text output sorts keys, so the same data always gives the same hash.

**Functions:**
- `_payout_invoice_groups(p_ids uuid[]) returns jsonb`: `stable`, **no grant** (internal). It returns `{ groups: [ {snapshot, fingerprint, problems[]} ], unavailable: [ids not found or not releasable] }`. A group's `problems` are codes plus the affected transaction ids (B1 feeds I-level validation, see B5):
  - `no_payout_method`: no `vendor_payout_methods` row;
  - `payout_method_disabled`: `status <> 'active'`;
  - `payout_method_unsupported`: `schema_version > 1`;
  - `no_recipient`: no vendor-admin whose `profiles.email` is non-empty.
  - Bank-name mapping is **not** checked here: it needs the decrypted `bankCode` (see B6).
  - The top level also carries `email: { type_enabled, vendor_portal_email_enabled }`. It's a warning, not a problem (D5), and never part of the fingerprint.
- `preview_payout_invoices(p_ids uuid[]) returns jsonb`: definer, `stable`. It checks the Command admin/root role, then returns the builder output. `grant execute to authenticated`.
- `release_payouts_with_invoices(p_ids uuid[], p_fingerprints text[], p_request_id uuid) returns jsonb`: definer, volatile. **One transaction:**
  1. Role check (same message style as `release_booking_payouts`).
  2. `select … from booking_transactions where id = any(p_ids) order by id for update`. The deterministic lock order avoids deadlocks between two admins.
  3. **Replay, checked AFTER the lock** (review 2026-09-13): if `payout_invoices` rows exist for `p_request_id`, check they cover exactly `p_ids` and return the original result. If they cover different ids, raise. Checking before the lock would let two concurrent copies of the same request both miss the replay; the second would then fail step 4 with "no longer ready" instead of getting the original answer. `unique (request_id, vendor_id)` is the backstop.
  4. **All or nothing:** any id not found or not `releasable` → `raise` naming how many and which vendor. Nothing is written.
  5. Rebuild with `_payout_invoice_groups`. Any group with `problems` → `raise` (behaviour per **D1**).
  6. Sorted rebuilt fingerprints must equal sorted `p_fingerprints`. If not: `raise 'These figures changed after you reviewed them. Review the payouts again.'`
  7. `update booking_transactions set payout_status='released', released_at=now() where id = any(p_ids) and payout_status='releasable'`. Assert `row_count = cardinality(p_ids)`.
  8. Per group: insert `payout_invoices` (`created_by = auth.uid()`; `snapshot` = the rebuilt group + `reference` + `issued_on_display` = `to_char(now() at time zone 'Asia/Manila', 'DD Mon YYYY')`; the last two are outside the fingerprint) and its items. Insert one `notifications` row **per vendor-admin with an email** (per **D2**): `portal 'vendor'`, `type 'payout_invoice'`, a short title/body carrying the reference and `net_payout_display`, and `data = {"invoice": <snapshot>}`. The per-type toggle follows **D5**.
  9. Return `{ run_id, released, invoices: [{ vendor_id, reference, recipients }] }`.
- **The old path, per D9:** `revoke execute on function public.release_booking_payouts(uuid[]) from authenticated;`. The function is kept, not dropped, and a comment points to its replacement. Otherwise "every mark paid sends an invoice" isn't true.
- Seed: `insert into notification_type_settings (type, label, description) values ('payout_invoice', 'Payout Invoice', 'Sent to vendor-admins when Ezzy records a payout as paid, with the payout invoice.') on conflict do nothing;`

**Blast radius:**
- **Data:** new tables only. No existing rows are rewritten.
- **Locks:** `create table` plus a `revoke`; instant.
- **Downstream:**
  - Command's current build calls `release_booking_payouts` → **permission denied once this is applied, until B3–B5 deploy**. Deploy command right after the migration, or apply D9's revoke in a follow-up migration after the command deploy.
  - Hand-written types in `command/lib/payout/invoice.ts` (B3).
  - Edge Function template (B2) must be deployed **before** the first invoice, otherwise emails fall back to the generic renderer (the kiosk-type lesson, `types.ts` comment).
- **Reversible:** the tables can be dropped while empty. Once they hold rows they're financial records: don't. Re-grant the old RPC to roll back the revoke.

**Verify:** new `backbone/supabase/tests/payout_invoices_test.sql`:
- grouping, ordering and totals;
- display strings for 0, sub-peso, ≥ ₱1,000,000;
- identical fingerprint on rebuild;
- fingerprint changes after `correct_booking_transaction`;
- all-or-nothing when one id is held;
- confirm twice → second raises, exactly one invoice and one notification set;
- same `request_id` replay → same result, no new rows;
- non-Command caller refused;
- `authenticated` can't execute the old RPC;
- `service_role` can't update or delete invoices.

All machine-checkable, against the local DB.

### B2 — Edge Function template `payout_statement`  ✅ DONE (2026-09-13, machine + rendered); live inbox render → big-table A12
<!-- ✅ DONE (2026-09-13).
Files:
- new `backbone/supabase/functions/send-notification-email/lib/templates/payoutStatement.ts`: `parseStatement` + `renderPayoutStatement`;
- `lib/templates/registry.ts`: `payout_statement` entry;
- `types.ts`: union entry + REDEPLOY comment;
- `handler.test.ts`: 11 new tests + corrected run comment;
- `README.md`: test command fixed (F6).

Verified (machine):
- `deno test --node-modules-dir=none` **31/31** (baseline 20 + 11 new);
- `deno check` on `index.ts` and `handler.test.ts` EXIT 0;
- `deno lint` 1 problem, identical at HEAD (the pre-existing `jsr:` import in `handler.test.ts`).

The fixture is a REAL snapshot from `preview_payout_statements()` on the local DB (read-only transaction), so the tests use the SQL builder's exact shape.

Rendered (throwaway scripts in the agent scratchpad; nothing added to the repo): the real fixture plus a worst case (seven-digit amounts, 60-character offering name) in headless Chromium at 640px and 360px. **No horizontal overflow at either width.** Screenshots reviewed.

NOT verified: delivery through the real chain and rendering in Gmail/Outlook (A12 local override inbox, B7 staging). -->
**Execution notes (2026-09-13). These supersede the sketch below where they differ:**
- **Layout deviation, found by rendering.** The planned six-column email table (then a four-column money table) collided at 360px ("Ezzy feeWithholding tax", totals running together) and overflowed. Final layout:
  - summary block (Reference, Date, Bookings, Payout) above the rows (R10);
  - each booking = offering · service date, then a **2×2 grid of stacked label/value** figures;
  - totals as full-width label/value rows.
  - Values, order and labels are unchanged. **Command's modal keeps the table (B4)**; only the email reflows. Labels must stay identical: `Customer paid`, `Ezzy fee`, `Withholding tax`, `Payout`.
- **Peso sign deviation.** The HTML part renders `₱` as `&#8369;` (same glyph), following base.ts's and the kiosk receipt's charset belt-and-braces; the text part keeps the literal sign. Everything else is printed verbatim.
- **Dropped the PESONet timing sentence** planned for the footer. Wallet vendors are paid by hand (D3), so "arrives within the banking day" isn't always true. The footer says to keep the statement and quote the reference.
- **The intro's amount is `nowrap`**, so the peso sign never lands on a different line from its number.
- A `backbone/deno.lock` created by the Deno runs was moved to the trash (not part of the change).
**Files:** new `backbone/supabase/functions/send-notification-email/lib/templates/payoutInvoice.ts`; `templates/registry.ts` (one entry); `types.ts` (union entry plus the "has a bespoke template, REDEPLOY" comment); a test beside `handler.test.ts`.
- `renderPayoutInvoice(record)` reads `record.data.invoice`, parses strictly (`version === 1`, arrays, string fields) and renders, inside `layout()`:
  - intro "Ezzy has initiated a payout to {vendor}" plus the reference;
  - a table of Offering · Service date · Customer paid · Ezzy fee · Withholding tax · Payout, one row per item **in snapshot order**;
  - a totals row;
  - a "PESONet transfers arrive within the banking day if sent before 3 PM" note (wording in review).
- It prints `*_display` values **verbatim**, escaped (`escapeHtml`, base.ts rule #3: offering names are vendor-authored). The peso sign is already inside the string, so it goes out as UTF-8 (the charset is declared in base.ts) and is **not** replaced with an entity. That keeps HTML and text parts equal to what the modal shows.
- A plain-text part carries the same rows.
- **A malformed snapshot never produces a partial table.** It falls back to `renderGeneric` (title/body, which carry reference + total) and logs `{notification_id, stage}` only.
- Email tables: `role="presentation"`, inline styles, and on narrow screens the rows stack as "label: value" (plan the markup against Gmail/Outlook the way `kioskBookingConfirmed.ts` does).
**Verify:** `deno test`:
- every item's and total's display string appears in the HTML and text, in order;
- the `<script>` in an offering name is escaped;
- a malformed snapshot → generic;
- the registry resolves `payout_invoice`.

(machine) Real render in the local override inbox (live).

---

## COMMAND

### B3 — Statement types, parser and service  ✅ DONE (2026-09-13, machine)
<!-- ✅ DONE (2026-09-13). New `command/lib/payout/statement.ts`:
- types (`PayoutStatement`, `StatementGroup`, `StatementPreview`, `MarkPaidResult`);
- strict `parsePreview` / `parseMarkPaidResult` (throw on an unknown version or any missing/mistyped field);
- `problemText` (an unknown problem code still BLOCKS, with generic copy);
- `previewTransactionIds`, `hasProblems`, `runTransferTotal` (centavos, via `sumPesos`), `idsWithoutVendor`, `MAX_MARK_PAID = 500`.

Also new: `lib/payout/statement.test.ts` (10 tests, fixture = the real DB preview) and `services/payoutStatements.service.ts` (`previewPayoutStatements`, `markPaidWithStatements`; RPC messages verbatim, a shape error gets a human message). `releasePayouts` was removed from `services/payouts.service.ts` (D9); grep shows no remaining caller. Verified: `npm test` 89/89 (79 + 10), tsc 0. -->
**Files:** new `command/lib/payout/invoice.ts` + `invoice.test.ts` (no `@/` imports: node `--test`); new `command/services/payoutInvoices.service.ts`.
- `interface PayoutInvoice` (snapshot v1, camel-cased), `interface InvoicePreview { groups: {invoice, fingerprint, problems}[]; unavailableIds: string[] }`, `parsePreview(json)`. The parser is strict and **throws on an unknown version**, so a newer DB can't be half-rendered (same stance as `PAYOUT_SCHEMA_VERSION`).
- `previewPayoutInvoices(ids)` → `rpc("preview_payout_invoices")`.
- `markPaidWithInvoices(ids, fingerprints, requestId)` → `rpc("release_payouts_with_invoices")`. RPC messages are shown to the user verbatim (the existing `correctPayout` convention).
- `releasePayouts` is **removed** from `payouts.service.ts:478-488` (D9).
**Verify:** `npm --prefix command test`: the parser accepts the fixture, rejects version 2 and missing totals (machine).

### B4 — `MarkPaidModal` + `PayoutStatementTable`  ✅ DONE (2026-09-13): machine-verified, and fixture screenshots approved by the user (A8)
<!-- 🔄 2026-09-13.
Files:
- `components/payouts/PayoutStatementTable/{PayoutStatementTable.tsx, .module.css}`: pure display; below 640px rows stack into labelled cards via CSS `data-label`; screen-reader caption;
- `components/payouts/MarkPaidModal/{MarkPaidModal.tsx, useMarkPaidModal.ts, MarkPaidModal.module.css}`: Radix Dialog. The body scrolls while header and footer stay put. Close is blocked while recording. Focus returns to the trigger.

States: loading, load error + Try again, ready, unavailable list, email-off warning, confirm error + Review again (stale), per-vendor problem + "Leave this vendor out", empty.

Separation: both `.tsx` are pure render. All derived copy and counts (title, summary, destination/recipient text, problem note, canConfirm) live in `useMarkPaidModal`. Service calls and review state live in the page hook. All styling is module CSS with theme tokens.

Gallery: new `?mode=markpaid&variant=ready|problem|unavailable|emailoff|stale|loading|error`, fed RAW database-shaped JSON through the real `parsePreview`.

Verified (machine): tsc 0; lint 25 = baseline count, none in touched files; Playwright `payouts.spec.ts` 24/24 EXIT 0.

Rendered via a throwaway script (dev server on :3300 started and stopped by PID by the agent):
- ready light/dark at 1100px and at 400px, problem, unavailable, stale (dark), error;
- no page or modal horizontal overflow in any;
- screenshots reviewed.

Remaining for ✅: user review of the fixture screenshots (A8). -->
<!-- ✅ DONE (2026-09-13). The user reviewed the 8 screenshots (ready light/dark/400px, problem, unavailable, stale dark, error, payouts list) and replied "A8 approved". -->
**Execution notes (2026-09-13):**
- **No screenshot baseline, by design.** Command's suite is behavioural only (no `pilot.spec` modes, no PNG baselines, see the repo-app-ports memory). So A8 is a review of screenshots, not a baseline registration, and the plan's "register the mode + baselines" wording doesn't apply to Command.
- **Wallet "not in the PESONet file" note (G10) moves to Stage 5 (B6),** alongside the Download button it refers to.
- **Found by rendering:** the problem note read "all 1of this vendor's payouts" (JSX text-node join) and was awkward for one payout. It's now one hook-built sentence ("This affects this vendor's payout below." / "…all N of this vendor's payouts below.").
- **Found by rendering:** a vendor with no recipients would have read "Emailed to 0 vendor-admins". It's now "Nobody to notify".
- **Gallery limitation, pre-existing:** `theme=dark` puts `.dark` on a wrapper div, so portalled dialogs (this one and `PayoutDetailModal`) render light in the gallery. The real app toggles `.dark` on `<html>` (`useAppShell.ts:185`), so it's correct in the app. The dark screenshots add the class to `<html>`. → F7
**Files (new):**
- `components/payouts/MarkPaidModal/MarkPaidModal.tsx`: Radix `Dialog`, pure render;
- `useMarkPaidModal.ts`: local UI state only (a second-step "Are you sure" is **not** added: the modal *is* the confirmation), focus handling, download-in-progress;
- `MarkPaidModal.module.css`;
- `components/payouts/PayoutInvoiceTable/PayoutInvoiceTable.tsx` + `.module.css`: pure display of **one** `PayoutInvoice`.

**Layout:**
1. **Header:** "Mark N payouts as paid" · "K vendors · ₱X to transfer". The run total is the sum of the groups' `totals.net_payout` **as returned by preview**, added up in `sumPesos` (centavos), the same helper the page uses.
2. **Unavailable banner** (if `unavailableIds`): "2 selected payouts are no longer ready to pay and were left out". They're listed by offering and vendor from the page's rows. ⚠️ The modal previews **only** the ids that are releasable, and confirm sends exactly those, so nothing is silently different from what's on screen.
3. **One section per vendor group**, in builder order:
   - vendor name;
   - the reference that will be assigned (D10);
   - masked destination from `row.payoutMethod.display`;
   - recipients line ("Emailed to 2 vendor-admins");
   - `PayoutInvoiceTable` with columns **Offering · Service date · Customer paid · Ezzy fee · Withholding tax · Payout** (D4), each cell a `*_display` string, plus a totals row;
   - `problems` rendered as an alert **inside that vendor's section**, naming the problem and the affected offerings (B5).
4. **Footer:**
   - the "records a transfer made elsewhere" warning (kept from `PayoutsPage.tsx:83-90`);
   - **Download PESONet file** (B6);
   - Cancel;
   - **Mark paid**, disabled while `saving`, while any problem remains (D1), or while preview is loading or failed.

**States:** loading (skeleton table), preview error (message + Try again), problems (blocked), confirming ("Recording…", both buttons disabled, Escape/overlay close prevented while saving), and an RPC failure (verbatim message; figures-changed → an explicit "Review again" button that re-previews).
**Responsive:** at ≤ 780px, `PayoutInvoiceTable` becomes stacked cards (label/value), the same breakpoint as `PayoutRow.module.css`. The dialog body scrolls; header and footer stay put. 44px targets.
**Separation:** `.tsx` files are pure render. Service calls stay in `usePayoutsPage` (the Command precedent that keeps modals mountable in `/ui-gallery`, `usePayoutsPage.ts:147-152`). `useMarkPaidModal.ts` holds only view state. Styling uses theme tokens in the module CSS, light and dark.
**Verify:** tsc, lint no worse than baseline, new gallery mode `markpaid` (two vendors, one with a `no_recipient` problem, one unavailable id), Playwright light/dark baseline, **registered only after the user reviews it** (repo rule).

### B5 — Wire all three entry points to the modal; remove inline confirmations  ✅ DONE (2026-09-13, machine)
<!-- ✅ DONE (2026-09-13). Files:
- `PayoutRow.tsx` (`onRelease` → `onMarkPaid`; the inline Record-as-paid prompt is removed), `usePayoutRow.ts` (row-click only), `PayoutRow.module.css` (dead `.confirm/.confirmLabel/.yes/.no` removed);
- `PayoutVendorGroup.tsx` + `usePayoutVendorGroup.ts` (confirm state removed, collapse only) + CSS (dead rules removed);
- `PayoutSelectionBar.tsx` (`onMarkPaid`; over 500 → button disabled + "Mark at most 500 at a time", G9) + CSS;
- `PayoutsPage.tsx` (mounts `MarkPaidModal`);
- `usePayoutsPage.ts`: `release()` replaced by the review. `openMarkPaid` (rejects >500 with a toast), `loadReview` (a new `requestId` per id set, sequence-guarded against late responses), `reviewAgain`, `leaveVendorOut`, `closeMarkPaid` (blocked while saving), `confirmMarkPaid` (sends the PREVIEWED ids + fingerprints + requestId; stale-message detection → Review again; success toast with references and whether vendors were notified; clears those ids from the selection; reloads rows + totals), plus `destinations` and `unavailableRows`;
- `NotificationSettingsPage.tsx` (`payout_statement: "Vendor"`, G7); `lib/types.ts` (`"payout_statement"` in `NotificationType`, G7); `components/layout/NotificationPanel/NotificationItem.tsx` (icon entry, required by that exhaustive map once the union changed).

Spec `visual-tests/payouts.spec.ts`:
- the 3 inline-confirmation tests became 3 entry-point tests (row → t3; group → t1,t2; bar → the selection in list order);
- 8 review tests: statement per vendor with exact strings and totals; Cancel/Escape record nothing; a double click confirms ONCE against an unguarded fixture handler; recording can't be dismissed; a problem blocks + explicit leave-out; unavailable named; email-off warns but doesn't block; stale → Review again; loading/error;
- the details-modal test no longer expects the inline prompt.

Verified: full Command Playwright suite **32/32 EXIT 0** (baseline 24 − 3 replaced + 11 new; unpiped, `node_modules/.cache/stage4/full.log`); `payouts.spec.ts` alone 24/24 (the first run found 2 failures: a wrong expected order in the test, and the real "1of" copy bug above; both fixed).

Not verifiable in the gallery: the real RPC round trip (A12). -->
**Files:** `PayoutRow.tsx` + `usePayoutRow.ts` + `.module.css` (drop `confirming/ask/cancel/confirm`, `.confirm/.yes/.no`); `PayoutVendorGroup.tsx` + `usePayoutVendorGroup.ts` (drop the confirm state, keep `open`); `PayoutSelectionBar.tsx` (unchanged markup, handler renamed); `PayoutsPage.tsx`; `usePayoutsPage.ts`.
- `release(ids)` is replaced by `openMarkPaid(ids)`:
  - set `markPaid = { ids, requestId: crypto.randomUUID() }`, then `previewPayoutInvoices(ids)`;
  - a **new `requestId` whenever the id set changes** (re-review, vendor removed per D1);
  - the same `requestId` for retries of the same review.
- `confirmMarkPaid()`:
  - guard `if (saving) return` (double click);
  - send `ids` = the ids inside the previewed groups (not the original selection) + fingerprints + requestId;
  - on success, toast "Marked N payouts paid · invoices sent to K vendors" with references, clear selection, close, reload rows and totals (the existing `Promise.all([load(bucket), loadTotals()])`);
  - on failure, keep the modal open with the message.
- Row → `openMarkPaid([row.id])`; group → `openMarkPaid(ids)`; selection bar → `openMarkPaid(selectedRows.map(r => r.id))`. The selection bar gains the confirmation it never had.
- `groupByVendor` on the page keeps grouping by name for *display* (unchanged). The invoice grouping is the builder's, by `vendor_id`. The mismatch is recorded as F1, not fixed here.
**Verify:** Playwright rewrites `payouts.spec.ts:14-58`:
- row, group and bar each open the modal with the right ids;
- Cancel records nothing;
- Mark paid calls the handler **once** even on a double click;
- a problem disables Mark paid;
- an unavailable id is listed and excluded.

Full suite unpiped (memory: playwright-rerun-discipline).

### B6 — PESONet XLSX route  ✅ DONE (2026-09-13, machine + rendered); live download and PayMongo acceptance → big-table A12, B8 — approval gates cleared (D7 install approved at A9; D8 approved 2026-09-13)
<!-- ✅ DONE (2026-09-13). Files (command):
- `lib/payout/pesonet_template.xlsx`: PayMongo's file, unchanged (sha256 8081a794…9aef8);
- `lib/payout/pesonetBanks.ts`: all 44 vendor codes; 39 mapped to PayMongo's exact names, 5 null; wallet names; `WALLETS_CONFIRMED = false`;
- `lib/payout/pesonet.ts`: pure `buildPesonetRows`; one row per statement, amount = `totals.netPayout` verbatim, remarks = reference; ALL-OR-NOTHING with per-vendor reasons (no details, wallet, unlisted/unknown bank, ₱0 or malformed amount, incomplete details);
- `lib/payout/pesonetWorkbook.server.ts`: loads the template, checks headers, applies the F11 validation collapse (refuses a template it doesn't recognise), writes values only, keeps styles;
- `app/api/payout-template/route.ts`: POST. Caller check → body validation (1–500 UUIDs, 32-hex fingerprints) → preview rebuilt with the CALLER's session → 409 if anything is unavailable, has problems, or the fingerprints don't match → service-role read of those vendors' destinations only → schema_version check → decrypt under the row's own vendor id → rows or 422 with vendor names → **view-log rows for every vendor BEFORE returning (503 if not recorded)** → xlsx with `no-store` and an Asia/Manila timestamped filename. Logs carry `{vendorId, stage}` only;
- `services/payoutTemplate.service.ts`: fetch → blob/filename, or error/problems/stale;
- `usePayoutsPage.ts`: `downloadPesonet()` + `saveBlob`; `MarkPaidReview` gains `downloading/downloadError/downloadProblems`; confirm is blocked while downloading;
- `useMarkPaidModal.ts` / `MarkPaidModal.tsx` / `.module.css`: numbered steps (Download → Submit in PayMongo → Mark paid), Download button, the audit note ("records the access against your account"), per-vendor GCash/Maya note (G10, from the MASKED method; the download is disabled with a hint, Mark paid is not), and a download error naming each vendor;
- `next.config.ts`: `outputFileTracingIncludes` for the template (G6);
- gallery variants `wallet` and `downloaderror`; `payouts.spec.ts` +3 tests.

Verified (machine):
- `npm test` **103/103** (89 + 14 new: bank map against the checked-in template's Banks sheet, rows, workbook round-trip, collapse refusal);
- tsc 0; lint 25 = baseline, same 12 untouched files;
- full Playwright **35/35 EXIT 0**, both before and after the final CSS fix (unpiped, `node_modules/.cache/stage4/full5b.log`);
- `npm run build` EXIT 0: the route's `.nft.json` includes `lib/payout/pesonet_template.xlsx`; exceljs is bundled into a server chunk; **0 hits** for exceljs/decrypt/workbook code in `.next/static` (never in the browser);
- independent check of a generated file: raw XML has exactly one `<dataValidation sqref="A2:A999">`; openpyxl confirms sheets/order, hidden Banks, text format on B–D, widths and REMINDERS identical to the template.

Rendered: ready light/dark/400px, wallet, downloaderror; no overflow. Found and fixed: the step list ran together ("…file2. Submit…", outside list markers in a flex row) and the phone footer was too tall.

NOT verified (needs a live session / third party):
- the route end to end (a real decrypt, view-log rows, the browser download) → A12;
- PayMongo accepting the file, and the three identity-matched banks (SeaBank → MariBank, HSBC, Malayan) → B8;
- the template file present in the Vercel deployment → B7. -->
**Files (new):**
- `command/app/api/payout-template/route.ts`;
- `command/lib/payout/pesonet.ts` + `pesonet.test.ts` (pure row mapping);
- `command/lib/payout/pesonetBanks.ts` + test;
- `command/lib/payout/pesonetWorkbook.server.ts` (fills in the template);
- `command/lib/payout/pesonet_template.xlsx`, the user's file checked in unchanged.

**Route `POST { transactionIds, fingerprints }`:**
1. `verifyCommandCaller()` → 403 otherwise.
2. Call `preview_payout_invoices` **with the caller's session client** (`lib/supabase/server.ts`), so the role check stays in SQL. Refuse on `unavailableIds`, on any group `problems`, or on fingerprints that don't match the modal's → 409 "Review again". The file can never differ from what the modal shows.
3. Service-role read of `vendor_payout_methods` for the group vendors only. Per vendor: `schema_version` check → `decryptDetails(details_enc, vendor_id)` → map (below). **Any vendor that fails → 422 naming the vendor and the reason; no file.** Per D1, the modal can also exclude that vendor.
4. **Log one `vendor_payout_view_log` row per vendor before building the file; fail closed** (the same rule as `/api/vendor-payout:120-129`).
5. Fill the template and return it with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="ezzy-pesonet-YYYYMMDD-HHmm.xlsx"` (Asia/Manila), and `Cache-Control: no-store`.
6. **Leak rules copied from `/api/vendor-payout`:** no plaintext in logs or errors. Plaintext exists only inside the file, never in JSON.

**One row per vendor group, in builder order:**

| Column | Value | Source |
|---|---|---|
| A Bank Name | `PESONET_BANK_BY_CODE[bankCode]`; wallet types → `"G-Xchange, Inc. (GCash)"` / `"MAYA PHILIPPINES, INC."` (**D3**: wallets refused until PayMongo confirms) | decrypted `bankCode` / `method_type` |
| B Bank Account Name | `accountName` | decrypted |
| C Bank Account Number | bank: `accountNumber` (digits). Wallet (once D3(i) is confirmed): `toLocalMobile(mobileNumber)` = `09XXXXXXXXX` | decrypted |
| D Amount | group `totals.net_payout`, the builder's 2-decimal string written **as text** to match the template's `@` format (**D3**) | snapshot, never recomputed |
| E Remarks | the statement reference, 16 chars (**D10(ii)**) | snapshot |

- **Rows:** data from row 2. Clear the `Select Bank…` placeholders in the rows used; unused rows keep the template as shipped (**D3**, confirm with a real upload).
- **Structure preserved:** sheet names and order, hidden `Banks`, the A-column list validation, column widths, header styles and the text formats.
- **`pesonetBanks.ts`:** our code → PayMongo name for all 44 vendor codes, with `null` for institutions not on PayMongo's list. **Found unmapped on 2026-09-13:** CARD Bank, Katipunan Bank, Legazpi Savings Bank, Luzon Development Bank, OFBank. Needs confirming: SeaBank → `MARIBANK PHILIPPINES, INC. (A RURAL BANK)`, and HSBC → `HK AND SHANGHAI BANKING CORP.`. ⚠️ Drift note in the header: the vendor list is `vendor/lib/payout/banks.ts`, so a new vendor bank code needs a mapping here, the same arrangement as `crypto.server.ts`. An unknown code → 422, never a guess.
**Verify (machine):**
- `pesonet.test.ts`: amount taken verbatim from the snapshot; wallet number in local form; `null`/unknown bank → error naming the vendor.
- `pesonetBanks.test.ts`: every non-null mapped name exists in the template's `Banks` sheet (read from the checked-in file).
- workbook round-trip test: three sheets, `Banks` hidden, headers unchanged, validation present, B–D text-formatted, values written.
- An independent re-read with Python `openpyxl` during execution (a local check only, not a dependency).

**Verify (live, user):** upload a generated file to PayMongo with a real ₱1 test run, or at least to the validation step, **before first real use**. That's the only proof of the D3 answers.

### I1 — Architecture docs  ✅ DONE (2026-09-14)
<!-- ✅ DONE (2026-09-14). Updated:
- `architecture/portals.md`, Payouts Page: the intro now describes Mark Paid through the review, with `release_booking_payouts` marked superseded and retired in Phase D. The inline-confirmation paragraph is replaced by the review (statement per vendor, nothing computed in Command, fingerprint gate, one blocked vendor blocks the run + Leave out, request-id replay and the unique backstop, notification switches). New "Payout statement emails" and "PESONet payout file" sections (route bounds, all-or-nothing, the exceljs note, tracing, InstaPay out of scope). Live-vs-mock table: the Payouts row corrected, and two new rows added.
- `architecture/schema.md`: migration-history row for `20260913000001`; new `payout_statements` / `payout_statement_items` sections (columns, why a snapshot, RESTRICT + demo-teardown note, RLS and append-only grants); `booking_transactions.payout_status` mover updated; RPC table (old release marked superseded, new release row) plus a preview/builder paragraph; `vendor_payout_view_log` now names both writers (a PESONet download = one row per vendor).
- `architecture/email-notifications-guide.md`: "Bespoke templates" note (kiosk + payout_statement need a REDEPLOY first; the Deno 2 test flag).
- `architecture/database-reset-and-deploy.md`: demo-teardown row mentions statement cleanup.
- `command/app/api/vendor-payout/route.ts` header: "the ONLY place that decrypts" → one of two, with rule 2 scoped to that route and a pointer to `/api/payout-template`'s bounds (D8). Comment only; tsc 0.

Verified: grep finds no remaining stale "inline confirmation"/"Record as paid" payout references (the other hits are the offering-delete confirm, unrelated); the new schema tables are well-formed. Not verified: a human read for tone. -->
- `architecture/portals.md` → Payouts Page: replace "inline confirmation" (`:600`) and the release-RPC sentences (`:587`, `:694`) with the modal, invoice and XLSX.
- `architecture/schema.md`: the new tables, RPCs and grants, and that `release_booking_payouts` is no longer granted.
- `architecture/email-notifications-guide.md`: `payout_invoice` is a bespoke template, so REDEPLOY.
- The header comment in `/api/vendor-payout`: amend "never a bulk export" to point at `/api/payout-template` and its bounds (D8).
**Verify:** read-through (human).

### I2 — Live end-to-end pass (local DB + override inbox)  ✅ DONE (2026-09-14): see big-table A12 for the three rounds and the G3 check. Part B skipped by user decision (reason there). The overlapping-runs case was proven live (two tabs).
Local, with seeded releasable payouts for 3 vendors (one vendor-admin missing an email):
- The modal blocks the broken vendor.
- Excluding it (D1) → the modal shows 2 groups → the XLSX has 2 rows whose amounts equal the modal totals.
- Mark paid → 2 `payout_invoices`, notifications per vendor-admin, emails in the override inbox whose tables match the modal **character for character**.
- Double-click and a replayed request → no duplicates.
- A second admin tab confirming the same payouts → refused, nothing written.
- Light/dark; 400px.
(live, needs local Supabase + `functions serve`.)

---

## REVIEW PASS (2026-09-13): tightened wording and best-practice checks

Where the plan as first written allowed a weak implementation, and what now pins it down. Each item is folded into the B-item it names; this list is the record.

- **R1 — Replay race.** Replay was checked before the lock. Moved after it (B1 step 3).
- **R2 — Reference collisions.** 10 hex chars was too short for a permanent key. Now 12 (D10(ii)).
- **R3 — Date shape.** The plan guessed `1 Sep 2026`; `fmtPhDate` actually renders `01 Sep 2026`. The builder now uses `DD Mon YYYY` (B1).
- **R4 — Preview must not leak recipient emails.** `no_recipient` and the modal's "Emailed to N vendor-admins" need a **count**. `preview_payout_invoices` returns `recipient_count` per group, never addresses (B1, B4).
- **R5 — Downloaded, then refused.** An admin can download the file, submit it in PayMongo, then have Mark paid refused because a figure changed. The "review again" state (B4) must say: *"If you already submitted a PESONet file for these payouts, check that submission in PayMongo before downloading a new one — its amounts may be out of date."*
- **R6 — Order of steps.** B4's footer shows the sequence as numbered text: **1 Download the PESONet file · 2 Upload and submit it in PayMongo · 3 Mark paid**. That keeps the page's existing rule "send the transfer first, then record it" (`PayoutsPage.tsx:83-90`).
- **R7 — Two admins, one run.** Nothing stops two admins downloading and both submitting the same file to PayMongo (a double payment outside our system); the database only stops a double *record*. Accepted as a business-process risk and stated in I1's docs. ⏸ Logging downloads per payout is DEFERRED.
- **R8 — Route input bounds.** `/api/payout-template` validates `transactionIds` as 1–500 UUIDs and `fingerprints` as matching 32-hex strings, else 400. The RPCs raise on arrays over 500 too (B1, B6), so one request can't lock the whole ledger.
- **R9 — What `useMarkPaidModal` actually holds** (component-separation):
  - `handleOpenChange(open)`, which ignores a close while `saving` or `downloading`;
  - the "Review again" / "Leave this vendor out" click wiring.
  - Service calls, the blob download (`URL.createObjectURL` → anchor → `revokeObjectURL`) and the preview/confirm state live in `usePayoutsPage` + a new `services/payoutTemplate.service.ts` (`fetch` → `Blob`), so the modal mounts in `/ui-gallery` with fixture props. `PayoutInvoiceTable` is pure display (no hook). `usePayoutRow` keeps only `openFromRow`; `usePayoutVendorGroup` keeps only `open/toggleOpen`.
- **R10 — Email length.** A very large vendor statement (~200+ rows) can pass Gmail's 102 KB clip, which hides the totals row. Mitigation in B2: **totals render above the item table as well as below it**, and the plain-text part is complete. Accepted beyond that.
- **R11 — Vendor apps show a type they've never seen.** `payout_statement` lands in the vendor web bell and `ezzy-vendor-mobile`. I2 adds a check that both render it as a plain title/body and that tapping it doesn't route to a broken screen. If either breaks, stop and report: fixing it touches another app (approval gate).
- **R12 — Best-practice checks, passed:**
  - RLS enabled on both new tables, with explicit grants and an append-only `service_role` (AGENTS.md ⚠️);
  - definer RPCs `set search_path = public`, role check first, `revoke execute from public, anon`;
  - no raw SQL in app code;
  - service-role key only in the route, which is server-only;
  - decrypt module stays `.server.ts`;
  - money is exact `numeric` in SQL and centavos in TS;
  - vendor-authored text escaped in email;
  - no `NEXT_PUBLIC_` changes.

## GAP REVIEW 2 (2026-09-13, before anything was applied): deployment safety and loose ends

Asked for by the user before running the migration. The ones marked *fixed* changed files that hadn't been applied yet; the rest changed the plan and the runbook.

- **G1 — The revoke would have broken Mark Paid mid-deploy.** It shipped in `20260913000001`, so any environment would lose Mark Paid between the push and the Command deploy. *Fixed:* split into expand (`20260913000001`, additive) and contract (`pending/retire_release_booking_payouts.sql` + `rollback/retire_release_booking_payouts.revert.sql`).
- **G2 — `db push` can't push one migration at a time.** A contract migration sitting in `migrations/` would ride along with the production expand push. *Fixed:* held in `supabase/pending/` and promoted with a fresh timestamp in Phase D. The SQL test applies it inline (`\ir`), so the revoke is still tested now.
- **G3 — Demo teardown would break on hosted projects.** `demo/demo-teardown.sql` deletes demo bookings. `payout_statement_items` RESTRICTs deleting a ledger row that's on a statement, so the teardown would fail (and roll back) once a demo payout was marked paid. *Fixed:*
  - it removes demo items first, and a statement plus its notifications only when no real payout remains on it (demo data lives on a real vendor);
  - it skips the step on databases without the tables.
  - ✅ Verified 2026-09-13 in A12 (rolled-back transaction against a real statemented booking; see the big table).
- **G4 — Email function before Command.** Otherwise the first statements go out on the generic template with no table (runbook rule 2, B5/C5).
- **G5 — Email override.** Staging should have `NOTIFICATION_EMAIL_OVERRIDE_TO` (B4); production must not (C2).
- **G6 — The XLSX template must be bundled on Vercel.** A file read at runtime can be missing from the serverless bundle. B6 reads it via `new URL('./pesonet_template.xlsx', import.meta.url)`, so Next's file tracing includes it. It's proven on staging (B7), not just locally.
- **G7 — Command's Notification Settings would label the new type "All".** `NotificationSettingsPage.tsx:7-23` maps types to portals. Add `payout_statement: "Vendor"` there and `"payout_statement"` to `command/lib/types.ts:167` `NotificationType`. → Stage 4 (B5).
- **G8 — Vendor web and mobile need no change.** Verified: unknown types fall back to a default icon (`vendor/.../NotificationItem.tsx:62`, `ezzy-vendor-mobile/.../NotificationListItem.tsx:90`), and tapping a notification doesn't route anywhere. A dedicated icon is DEFERRED (it touches two more apps). B7 checks both bells on staging.
- **G9 — Selections over 500.** The selection bar disables Mark paid above 500 with "Mark at most 500 at a time". The RPCs refuse it too. → B5.
- **G10 — Vendors the PESONet file can't include.**
  - **Wallet vendors (D3):** flagged in the modal up front from the masked `payoutMethod.methodType` ("Not in the PESONet file yet — pay this vendor by hand"), with no decrypt.
  - **A bank not on PayMongo's list:** only detectable after decrypting. The download refuses the **whole file**, naming the vendor(s); the admin uses "Leave this vendor out" and pays them separately. That's consistent with D1, and no half-file is ever produced.
  - → B4, B6.
- **G11 — Deploys pick up whatever is in the checkout.**
  - `functions deploy` uploads the whole function folder from the working tree, so deploy from a checkout whose function diff is only this plan's (B5).
  - Check whether Supabase's GitHub integration auto-applies migrations (A14).
- **G12 — `deno` isn't installed in my shell.** Stage 3's tests need your call (A4).
- **G13 — The first production Mark Paid emails a real vendor.** There's no dry run in production, so do it with one vendor you can contact (C7).
- **G14 — Rollback ladder written down.** Its order depends on whether Phase D has run (runbook → Rolling back).
- **G15 — Regression check.** Re-run the three existing SQL tests after applying `20260913000001` (A3).
- **G16 — Deactivated vendor-admins still receive statements.** That's consistent with the KYC and kiosk notifications, which don't filter on status either. Accepted; revisit if Command gains a "deactivated member" concept that should silence email.

## FINDINGS

- **F1 — The page groups vendor sections by name, not id** (`PayoutsPage.tsx:21-29`). Two vendors with the same name share one "to transfer" header today. The invoice path (B1) groups by `vendor_id`, so invoices are correct. The page's display grouping stays as is. ⏸ PARKED (2026-09-13): outside the brief. **Unblocks when** the user wants the page fixed (a one-line key change).
- **F2 — The selection-bar bulk path has no confirmation at all** (`PayoutSelectionBar.tsx:26`). Closed by B5.
- **F3 — The existing release RPC silently skips non-releasable ids.** Fine for a record, wrong for an invoice that must equal the preview. B1 replaces it with all-or-nothing plus an up-front "unavailable" list in the modal.
- **F4 — A PESONet transfer can fail after it's recorded** (wrong account, cut-off). There's no un-release, and the invoice email has already gone. Pre-existing (no un-release RPC); the email makes it visible to the vendor. ⏸ PARKED: **unblocks when** the business wants a "payout failed / reversed after release" flow; that needs its own plan.
- **F5 — The PayMongo → Maya research plan (`2026-09-07`) has D0 open.** This XLSX assumes disbursing from a PayMongo balance. If collections move to Maya, that balance goes away and this template goes with it. Not a blocker; noted so it isn't a surprise.

---

- **F16 — Staging: Citywide's saved payout destination could not be decrypted by staging Command.** Found 2026-09-14 in B7: **Download PESONet file** for a Citywide payout returned the route's fail-closed 500 ("A vendor's payout details could not be decrypted…"). Nothing was recorded, and no view-log row was written (the route stops before logging). Diagnosis: the blob was well-formed (`v2`, 4 parts), so not the refused v1 format. The user re-saved Citywide's GCash details in the staging vendor app, and the download then worked. ⇒ Staging Command's key DOES match staging vendor's; the old blob had been sealed with a different key or for a different vendor row (most likely data carried over from another environment). ✅ RESOLVED for Citywide on staging. Not a code defect: it's the designed refusal, the same `decryptDetails` as "Show full details". **Carry-forward:** any other destination written outside that environment's own vendor app will fail the same way (Summit on staging is unverified until its own download). **Production pre-check added to C7:** before relying on the file, confirm "Show full details" works for the vendors in the first run.
- **F15 — A literal `₱` in a SQL file can be mangled when pasted into the Supabase SQL Editor from Windows.** Found 2026-09-14 at B3: check #36's expected text arrived as `Γé▒ 1,234,567.89` (UTF-8 bytes read as an OEM code page), so the check failed on its own query text while the database output was correct. Migrations are unaffected (`db push` reads the files as UTF-8, and staging's formatter returned the right sign). ✅ FIXED 2026-09-14: both check files are pure ASCII (`U&'\20B1'` for the peso sign; comment punctuation replaced), re-run locally with #36 ok. **Lesson for any hand-pasted SQL:** keep it ASCII-only.
- **F14 — PayMongo's docs contradict each other on GCash (and Maya wallet) via PESONet.** *List of available banks & e-wallets* (2026-06-29): `G-Xchange, Inc. (GCash)` and `MAYA PHILIPPINES, INC.` under "Pesonet Provider". *List of Banks* (2026-07-08): "GCash" and "PayMaya" both PESONet Receiver **N**, InstaPay Y. The PESONet template the user downloaded in September 2026 includes G-Xchange. No PayMongo page gives an e-wallet account-number format. Found 2026-09-14. ⏸ OPEN WITH PAYMONGO: **unblocks when** the B8 test upload (with a GCash row) is accepted or rejected, or PayMongo support answers. If rejected: set `PESONET_WALLETS_ENABLED.gcash = false`, restore the Maya-style note for GCash, and update portals.md.
- **F13 — The GCash/Maya note told the admin to leave the vendor out, but offered no way to.** Found 2026-09-13 while preparing A12: "Leave this vendor out" only rendered inside the blocking-problem box. ✅ FIXED 2026-09-13: the wallet note in `MarkPaidModal.tsx` has its own "Leave this vendor out" (`.linkBtn` in the module CSS), and the `wallet` Playwright test now clicks it. Verified: tsc 0, lint 25 (baseline), unit 103/103, **full Playwright 35/35 EXIT 0** (run once the user's dev servers were stopped; `node_modules/.cache/stage4/full6.log`).
- **F12 — Local Vault webhook secret out of step with the function's `.env`.** Found 2026-09-13 at A11: Vault held a 9-character value while `.env` held 64, so every local notification email would have been rejected (401) by the Edge Function, silently from the app's side. Fixed locally by the user. ✅ Not a code issue. Worth re-checking after every `db reset` (the guide already says Vault secrets are wiped by a reset; a stale re-run of an old snippet is the likely cause).
- **F11 — exceljs 4.4.0 duplicates the Banks validation on write.** It expands `A2:A999` into 998 cells, then sorts those addresses as TEXT ("A10" < "A2"), and its range merger (`lib/xlsx/xform/sheet/data-validations-xform.js` `optimiseDataValidations`) never skips already-covered cells. Output: overlapping `A10:A999` + `A2:A999`, which Excel may call corrupt. **Workaround proven 2026-09-13:** after reading, check that every cell carries the identical rule, then set `ws.dataValidations.model = { "A2:A999": rule }`. The output then has exactly the template's single validation (verified in the XML and with openpyxl). If the rules aren't all identical, the builder must REFUSE rather than guess. → B6 implements it, with a test asserting exactly one `A2:A999` validation.
- **F10 — Command's pre-existing dependency advisories.** `npm audit` BEFORE this plan's install: 1 critical, 6 high, 1 moderate, 1 low. The critical is `next@16.2.4` (range 9.3.4-canary.0 – 16.3.2, fix available). Its advisories include middleware/proxy bypasses (GHSA-26hh-7cqf-hhc6, GHSA-492v-c6pp-mqqv), and Command's auth gate is `proxy.ts`; also SSRF via WebSocket upgrades (GHSA-c4j6-fc7j-m34r) and DoS. Also high: brace-expansion, browserslist, js-yaml, nanoid, postcss, sharp. Found 2026-09-13 at A9. Not caused by this plan. ⏸ PARKED: a Next upgrade is its own approval gate and likely spans all three web apps. **Unblocks when** the user schedules a dependency-security pass (recommended soon: the proxy bypass class touches Command's auth).
- **F9 — PESONet vs InstaPay.** On 2026-09-13 only `instapay_template.xlsx` turned up in Downloads. It has the same five columns, but a **₱50,000 per-transaction cap**, a 91-name bank list spelled differently from PESONet's 124, and GCash as `G-Xchange, Inc.`. User decision 2026-09-13: **PESONet only** (no cap, so one row per vendor always equals their statement total). InstaPay ✖ not in scope; it would need its own mapping and a cap rule.
- **F8 — The PayMongo template file isn't in the repo yet, and its original location is gone.** Found 2026-09-13 at A9: `pesonet_template.xlsx` was moved or deleted from Downloads, and the agent's scratchpad copy had been cleared. B6 needs it checked in unchanged at `command/lib/payout/pesonet_template.xlsx`. ✅ 2026-09-13: the user re-downloaded it to Downloads; its sha256 matches the morning's inspection. Checked into Command in B6.
- **F7 — Gallery dark mode doesn't reach portalled dialogs.** `app/ui-gallery/page.tsx` applies `.dark` to a wrapper div; Radix portals render under `<body>`, so any dialog fixture (MarkPaidModal, PayoutDetailModal) shows light in `theme=dark`. The real app is unaffected (`.dark` on `<html>`). Found 2026-09-13 in Stage 4. ⏸ PARKED: pre-existing, gallery-only. **Unblocks when** someone wants dialog fixtures to be dark-checkable without a script (toggle the class on `document.documentElement` in the gallery).
- **F6 — The email function's documented test command fails on Deno 2.** `send-notification-email/README.md` says `deno test supabase/functions/send-notification-email`. Under Deno 2.9.6 that errors with `Could not find a matching package for 'npm:resend@4' in the node_modules directory`: `backbone/package.json` makes Deno expect packages in `node_modules`. `--node-modules-dir=none` (global cache) runs all 20 tests. Found 2026-09-13 while recording the baseline. ✅ DONE (2026-09-13, Stage 3): README (and the run comment in `handler.test.ts`) now use `--node-modules-dir=none`, and the tests pass with it.

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains. -->
- **D1 — Bulk run with a misconfigured vendor.** → **Block the whole run.** The vendor's section names the problem and the affected payouts, with an explicit **"Leave this vendor out"** button that re-previews without them (resolved 2026-09-13, user). Nothing is skipped silently; the admin's last approval is exactly what runs. → B1 step 5, B4 §3, B5 (new `requestId` when the id set changes), B6 step 3.
- **D2 — Who receives the invoice?** → **Every vendor-admin**, each through their own notification (resolved 2026-09-13, user). This is the existing KYC/kiosk pattern, needs no new email path, and adds an in-app bell entry. A vendor with no vendor-admin email is a blocking `no_recipient` problem (D1). → B1 step 8.
- **D3 — PESONet file details only PayMongo can confirm.** → **Recommendation taken** (resolved 2026-09-13, user): build as in B6, prove it with one PayMongo test upload before first real use, and **refuse GCash/Maya vendors in the file** until (i) is confirmed. A refused wallet vendor is a **download error naming the vendor** (422). It does not block Mark Paid, because the admin can transfer to a wallet by hand. `pesonet.ts` keeps the wallet mapping behind one `WALLETS_CONFIRMED = false` constant, so enabling it later is a one-line reviewed change plus a test flip. Original question: (i) GCash/Maya wallet payouts: is the account number the `09…` mobile number, and are wallets allowed through this PESONet file at all? (ii) Amount as text `10000.00` (template format) vs a number. (iii) Data starting at row 2, and whether leftover `Select Bank…` rows are ignored. (iv) Remarks length limit. **Recommendation:** implement as in B6 and prove it with one test upload before first real use; wallet vendors are refused in the file until (i) is confirmed.
  - **Amended 2026-09-14 (user): GCash ON, Maya OFF.** The user questioned the GCash refusal. Agent research the same day:
    - The refusal was the D3 safety switch, not a name mismatch.
    - PayMongo's *List of available banks & e-wallets* (updated 2026-06-29) lists `G-Xchange, Inc. (GCash)`, BIC `GXCHPHM2XXX`, under **Pesonet Provider**, matching the template exactly.
    - PayMongo's *List of Banks* (updated 2026-07-08) says GCash **PESONet Receiver: N** (→ F14).
    - No PayMongo page states an e-wallet account-number format.
    - GCash's help centre says bank transfers to GCash use the **GCash mobile number** (from the search result; the page blocked a direct fetch).
    - Decision: GCash → bank `G-Xchange, Inc. (GCash)`, account number = mobile in local 11-digit `09XXXXXXXXX` form. Maya stays refused. B8's test upload must include a GCash row; if PayMongo rejects it, GCash goes back to refused (one line in `pesonetBanks.ts`).
- **D4 — Statement columns.** → **Offering · Service date · Customer paid · Ezzy fee · Withholding tax · Payout** (resolved 2026-09-13, user, recommendation taken). Original question: The brief lists five. **Recommend adding Service date**: two bookings of the same offering are otherwise indistinguishable rows on a vendor's invoice. Booking reference is left out to keep the email table narrow (the vendor sees it in their dashboard).
- **D5 — Do the notification switches apply to statements?** → **Respect both switches, and warn in the modal** (resolved 2026-09-13, user). No hidden exceptions.
  - The builder's preview output gains `email: { type_enabled, vendor_portal_email_enabled }` (read from `notification_type_settings` / `notification_email_settings`).
  - The modal shows "Payout statement emails are switched off in Notification Settings — vendors won't be emailed" (type off: no bell entry either) or "…email is off for the vendor portal — vendors get an in-app notification only".
  - It's a **warning, not a blocking problem**: marking paid still records the statement.
  - → B1 (`_payout_invoice_groups` output + step 8 respects `is_enabled`, the KYC precedent), B4 §1.
- **D6 — The Resend 429 defect.** → **Ship without the fix** (resolved 2026-09-13, user). Accepted risk, stated plainly: a bulk run whose notifications exceed Resend's 10 requests/s records the surplus as `failed` in `notification_emails`, with no retry. The statement row, the bell notification and the release are unaffected. Failures show only in the delivery-health panel (`command/app/api/notification-health`). Stage 1 is removed. I2's live pass **records** whether a 3-vendor run hits it, as evidence for `2026-08-12-notification-email-rate-limit.md`. That plan stays where it is. **Revisit when** a real run shows failed statement emails.
- **D7 — XLSX library.** → **`exceljs`** (resolved 2026-09-13, user). It loads the checked-in template and writes cells. ⚠️ **The install is still an approval gate**, confirmed at the start of Stage 5 with the exact version (`npm --prefix command install exceljs@<pinned>`) after checking the package's current advisories.
- **D8 — Decrypting several vendors' bank details in one request.** → **One file, bounded, in the new route only** (resolved 2026-09-13, user). Bounds, none optional: Command admin; only vendors inside a fingerprint-verified releasable preview; one `vendor_payout_view_log` row per vendor written before the file is built, refusing if it can't be logged; plaintext only inside the file, never JSON; `no-store`. `/api/vendor-payout`'s "never a bulk export" header gets amended to point here (I1). Still a security-change approval gate at Stage 5 (AGENTS.md). → B6.
- **D9 — Retire the old path?** → **Revoke `release_booking_payouts` from `authenticated`** (resolved 2026-09-13, user). **Amended by gap review 2 (G1/G2):** it ships as a separate contract migration in runbook Phase D, not inside `20260913000001`. Mark Paid can't happen without a statement. The only caller is `command/services/payouts.service.ts` (grep 2026-09-13). ⚠️ Coupling: once the migration is applied, an older command build's Mark Paid fails with permission denied, so **deploy command immediately after the migration in each environment** (see Deploy order).
- **D10(i) — What the document is called.** → **"Payout statement"** everywhere a person reads it: modal, email subject and heading, bell notification, toasts and docs (resolved 2026-09-13, user). "Invoice" is a BIR-regulated term, and Ezzy isn't billing the vendor. ⚠️ Execution follow-through: rename the plan's internal names to match so code and UI don't disagree: tables `payout_statements` / `payout_statement_items`, notification type `payout_statement`, RPCs `preview_payout_statements` / `release_payouts_with_statements`, and components `PayoutStatementTable` and `pesonet…` (unchanged). This plan's B-items still say "invoice"; read them as "statement".
- **D10(ii) — Reference format.** → **`EZP-` + 12 hex chars of the fingerprint** (resolved 2026-09-13, user, recommendation taken; widened from 10 to 12 in review: 10 hex chars has a ~0.5% chance of some collision by 100k statements, 12 is ~0.002%). A collision can't be retried away, because the same content hashes the same. It raises a unique violation, which the RPC reports as a support case. Original rationale: It's known at preview (so it appears in the modal *and* the XLSX Remarks before confirm), deterministic, and unique in the DB. **Recommended.** The alternative is a sequential number assigned at confirm, which then can't be in the XLSX downloaded before confirming.

## DEFERRED / COSMETIC
- Showing invoice history in Command (per payout "Invoiced in EZP-…") or on the vendor Transactions page: the data will exist (`payout_invoice_items`), but the brief doesn't ask for it.
- Resending a failed invoice email: needs a new notification row and a rule about duplicates. Until then, `notification_emails` records the failure (visible in the delivery-health panel).
- A PDF attachment of the invoice: not requested; the HTML email is the invoice.

## ▶ ORDER OF EXECUTION — the one sequence to follow

**This is the single source of truth for order** (rebuilt in gap review 2, 2026-09-13). Stages run one at a time; I report after each and wait for your go.

**Legend:** 🤖 = I do it · 👤 = you do it · ⛔ = **stop point**: don't go further until it holds.

### The five rules that keep staging and production working
1. **Expand, then contract.** `20260913000001` only *adds* things, so it's safe in any environment before the new Command arrives. Retiring the old release function (plan D9) is a **separate, later** migration, and it only ships once the new Command is live in **production**.
2. **Per environment, the order is always:** database migration → email function → Command. A new Command against a database without `20260913000001` can't open the Mark Paid modal. A new Command before the email function sends statement emails without the table.
3. **`db push` applies every pending migration in `migrations/`.** That's why the contract migration waits in `supabase/pending/` until Phase D and gets a fresh timestamp then.
4. **Local → staging → production. Never skip one.**
5. **Hosted databases only get `db push`**, after `migration list` shows exactly what's expected. Never `db reset` (`architecture/database-reset-and-deploy.md`).

### Phase A — Build and prove it locally
| # | Who | Step | Detail |
|---|---|---|---|
| A1 | 🤖 | **Stage 2 files:** migration `20260913000001`, SQL test, rollback, contract migration held in `pending/` with its revert, demo-teardown fix. ✅ *Written 2026-09-13; gap review 2 applied the same day* | B1, G1–G3 |
| A2 | 👤 | Start Docker + local Supabase. `npx supabase migration up --local` (applies `20260913000001` only). ✅ *Done 2026-09-13 (user); confirmed read-only* | — |
| A3 | 👤 or 🤖 | From `backbone/`: run `supabase/tests/payout_statements_test.sql`, then the three existing tests (`withholding_and_corrections_test.sql`, `booking_transitions_test.sql`, `auto_acknowledge_test.sql`) for regressions. ⛔ **All pass**. ✅ *2026-09-13: 97/97 new; 63/63, 45/45, 8/8 existing; all EXIT=0* | B1, G15 |
| A4 | 👤 | Decide how Stage 3's `deno test` runs: approve installing `deno` in my shell, or run it yourself. ✅ *2026-09-13: user approved; deno 2.9.6 installed to `~/.deno` (official script, `--no-modify-path`, no shell profile edited)* | G12, F6 |
| A5 | 🤖 | **Stage 3:** email template + tests. ✅ *2026-09-13: 31/31 deno tests, type check clean; rendered at 640/360px with no overflow. The real-inbox check moves to A12* | B2, F6 |
| A6 | 👤 | Stop your `:3000` Command dev server before Playwright runs (restart it after). ✅ *Done 2026-09-13 (user)* | memory |
| A7 | 🤖 | **Stage 4:** service, modal, wiring, spec rewrite, Settings label. ✅ *2026-09-13: tsc 0; unit 89/89; lint 25 (baseline); Playwright 32/32; review rendered light/dark/400px. The G10 wallet note moves to Stage 5* | B3–B5, G7, G9 |
| A8 | 👤 | Review the `markpaid` gallery fixture (light/dark/400px). ⛔ **Approve**. ✅ *Approved 2026-09-13 (user). Command has no screenshot baselines, so there's nothing to record* | B4 |
| A9 | 👤 | Approve installing `exceljs` at the version I show you. ✅ *2026-09-13: user approved `exceljs@4.4.0`; installed with `--save-exact` after a round-trip proof on the real PESONet template (sha256 `8081a794…9aef8`, identical to the file inspected that morning). Audit 9 → 11 (+2 moderate, both the unreachable `uuid` advisory). tsc 0, unit 89/89 after install. Found an exceljs validation bug and proved a workaround (F11). Pre-existing audit findings → F10* | D7, F8–F11 |
| A10 | 🤖 | **Stage 5:** PESONet XLSX route, bank map, workbook + tests. ✅ *2026-09-13: unit 103/103; Playwright 35/35; build trace includes the template; no server-only code in client bundles; generated file independently verified. Live route → A12; PayMongo → B8* | B6, G6, G10, F11 |
| A10b | 🤖 | **GCash into the PESONet file (D3 amended 2026-09-14): GCash ON, Maya OFF.** ✅ *2026-09-14. Changed:*
- *`pesonetBanks.ts`: `WALLETS_CONFIRMED` replaced by `PESONET_WALLETS_ENABLED = { gcash: true, maya: false }`, with the research and the F14 warning in the header.*
- *`pesonet.ts`: GCash → `G-Xchange, Inc. (GCash)` + `toLocalMobile` → `09XXXXXXXXX`, refused unless it matches `^09\d{9}$`; Maya still refused by name.*
- *`useMarkPaidModal.ts`: the note, download block and hint now apply to Maya only.*
- *Gallery: `wallet` variant = Maya, new `gcash` variant.*
- *`payouts.spec.ts`: Maya test renamed, plus a new GCash-not-flagged test.*
- *Unit tests: 1 wallet test → 4 (GCash row, local form kept, invalid numbers refused, Maya refused); `pesonetBanks.test.ts` asserts the enable map.*
- *Docs: `architecture/portals.md`.*

*Verified (machine): tsc 0; unit **106/106**; lint 25 (baseline); Playwright **36/36 EXIT 0**. End-to-end with REAL local data: Citywide's actual `preview_payout_statements` (2 payouts, net 1794.98, `EZP-95ADC89E9912`) → `buildPesonetRows` with a synthetic GCash destination in the stored `+63` shape → `buildPesonetWorkbook`; checked independently: bank `G-Xchange, Inc. (GCash)` is in the template's dropdown list, account `09171234567` stored as text (`@`, leading zero kept), amount/reference verbatim, exactly one `A2:A999` validation.*

*NOT verified: a real decrypt of a vendor's stored GCash number through `/api/payout-template` (optional local check: download Citywide's file), and PayMongo accepting a GCash row (B8, F14).* | D3, F14 |
| A11 | 👤 | Local email chain up: `supabase functions serve` + local Vault secrets (`email-notifications-guide.md` §3–4), with `NOTIFICATION_EMAIL_OVERRIDE_TO` set to your inbox. ✅ *2026-09-13: the agent found local Vault `notification_email_secret` (9 chars) ≠ the function `.env` (64 chars), which would 401 every dispatch. The user re-set it from `.env` (no secret shown); verified matching by md5. Function served (bad secret → 401), Command :3000 and vendor :3001 running (user's), Summit given a BDO test destination via the vendor app. Baseline: 0 statements, 0 statement notifications, 3 emails logged, 0 view-log rows* | I2, F12 |
| A12 | 👤 + 🤖 | **Live local pass:** single and bulk Mark Paid, a blocked vendor, "Leave this vendor out", double-click, the XLSX opens in Excel/Sheets, the email matches the modal. ⛔ **All green** | I2 | ✅ *Round 1 ✅ 2026-09-13 (user drove the UI; agent checked the DB/file): bulk review of Summit + Citywide → GCash note on Citywide, download disabled → Leave this vendor out → Summit only → real download `ezzy-pesonet-20260914-1006.xlsx`. File row = BANCO DE ORO UNIBANK, INC. / Dante Boots / 123456789 / 744.26 / EZP-90300F101FFF, equal to `preview_payout_statements` for that payout; raw XML has exactly one `A2:A999` validation; exactly 1 view-log row (Summit, root); 0 statements and 0 released (downloading records nothing)* · *Round 2 ✅ 2026-09-13: the user marked both Summit payouts paid in two separate runs (10:11:34 `EZP-90300F101FFF`, 10:13:09 `EZP-EF6B4169DECA`). Toast seen. The Gmail screenshot shows the branded statement with the same ₱850.00/102.00/3.74/744.26, the reference equal to the Round 1 file's Remarks. The vendor bell (dante, :3001) shows both, default icon, no crash. DB: 2 statements × 1 item each, both payouts released on exactly one statement, 0 duplicate items, 4 notifications each carrying the stored snapshot verbatim, 4 `notification_emails` sent with 0 errors, Citywide untouched (8), view log still 1 (marking paid decrypts nothing)* · *G3 ✅ 2026-09-13 (agent, rolled-back transaction): the teardown's statement block aimed at a real statemented booking. Without it the booking delete is blocked by the FK; with it the item, the now-empty statement and its notifications are removed, the booking delete succeeds, and the other statement is untouched; after rollback everything was restored* · *Round 3 ✅ 2026-09-14: Part A, the same Citywide payout confirmed in two tabs. Tab A recorded `EZP-1AF9D4FD6D81` (1 item, ₱1,050.72); tab B showed "no longer ready" and wrote nothing. DB: 3 statements total, 0 duplicate items, 0 payouts released without a statement, 7 notifications / 7 emails sent / 0 failed, Citywide 8 → 7. Part B (a correction mid-review) was not run: ✖ skipped by user decision 2026-09-14, because the DB refusal is proven by `payout_statements_test.sql`, the stale UI by the Playwright stale test, and the live message detection by Part A (same detection path). **A12 ✅ DONE 2026-09-14.***
| A13 | 🤖 | **Stage 6:** architecture docs. ✅ *2026-09-14: portals.md, schema.md, email-notifications-guide.md, database-reset-and-deploy.md, `/api/vendor-payout` header (see I1)* | I1 |
| A14 | 👤 | Commit and push `backbone` and `command` feature branches. ⚠️ Check first that Supabase's GitHub integration isn't set to **auto-apply** migrations on merge. If it is, a merge = a push, and Phases B/C must be sequenced by merges | G11 | 🔄 *2026-09-14: the user reports everything is committed, including the A10b GCash change. Not yet confirmed: pushed, and the Supabase GitHub-integration auto-apply check*

### Phase B — Staging (production untouched throughout)
| # | Who | Step | Detail |
|---|---|---|---|
| B1 | 👤 | `npx supabase migration list --linked` (linked = **staging**). ⛔ **Only `20260913000001` is pending** | rule 5 | ✅ *2026-09-14 (user)*
| B2 | 👤 | `npx supabase db push` | — | ✅ *2026-09-14 (user)*
| B3 | 👤 | Run the verification queries I give you: both tables exist with RLS, grants append-only, `payout_statement` type row present, **old `release_booking_payouts` still granted**. ⛔ **All match** | B1 | ✅ *2026-09-14. Staging, `supabase/checks/20260913_post_deploy_verification.sql`: 38 of 39 rows ok; #2 = 0 (contract not pushed); #38 = 0 statements; 29 released payouts before the rollout. The one false, #36, was the check's OWN expected literal mangled in the SQL Editor paste ("Γé▒"); the database returned the correct `₱ 1,234,567.89` (→ F15, file made ASCII-only and re-verified locally). Dry run `20260913_payout_statements_dry_run.sql`: Citywide Sports Center 26 payouts ₱19,457.98, 3 vendor-admins, ready; Summit Athletics Club 2 payouts ₱1,794.98, 2 vendor-admins, ready*
| B4 | 👤 | `npx supabase secrets list`: confirm `NOTIFICATION_EMAIL_OVERRIDE_TO` is set on staging (or deliberately unset) | G5 | ✅ *2026-09-14 (user): `NOTIFICATION_EMAIL_OVERRIDE_TO` is set on staging*
| B5 | 👤 | Deploy the email function to staging: `npx supabase functions deploy send-notification-email`. Deploy it from a checkout whose `supabase/functions/` differs from production only by this plan (check with `git diff production -- supabase/functions`). ⛔ **The dashboard shows a new version** | G4, G11 | ✅ *2026-09-14 (user), after a first attempt from `~/RS` failed at bundling (nothing uploaded). Pre-checks by the agent: link `fbxbwnfeimzhgxpshdpa`; the functions/ diff vs `production` is exactly this plan's 5 files; `deno test` 31/31. Deployed with `--project-ref fbxbwnfeimzhgxpshdpa --no-verify-jwt`: version 17 → 18; a bad-secret smoke test returned `{"error":"unauthorized"}`, so the function is up with JWT verification off. The new template itself is proven by B7's first statement email*
| B6 | 👤 | Deploy the Command feature branch to **staging only** | rule 2 | ✅ *2026-09-14 (user): Command deployed to staging. B7/B8 are being run by the user*
| B7 | 👤 | Staging checks: one single and one bulk Mark Paid; the email (override inbox) matches the modal; **Download PESONet file works on Vercel** (template bundled); vendor web + mobile bell show the notification. ⛔ **All green** | G6, G8 | 🔄 *2026-09-14: Citywide download first failed to decrypt (F16); fixed by re-saving the destination in the staging vendor app, and the download now works. Remaining B7 checks with the user* · ✅ *2026-09-14: user reports B7 complete, "everything works": single + bulk Mark Paid, the statement email with the full table in the override inbox, XLSX downloads (after the F16 re-save), vendor bells. Agent did not observe these directly; the optional DB check query was not run*
| B8 | 👤 | **PayMongo test upload** of a staging-generated file (a ₱1 or validation-only run). **Include one GCash row** (a GCash number you control) as well as a bank row. ⛔ **PayMongo accepts both**, which closes D3 and F14; also confirm the SeaBank/HSBC/Malayan names if any of those vendors exist. If the GCash row is rejected, turn GCash back off (F14) | D3, F14 | · ⏸ *PARKED 2026-09-14 (user): PayMongo testing can't be done right now. Why it matters: B8 is the only evidence for D3 (file format accepted) and F14 (GCash via PESONet). **Unblocks when** the user can run a PayMongo upload. Decision 2026-09-14 (user): proceed to Phase C anyway; the FIRST real production PayMongo upload is the B8 test (see C8)*

⛔ **Staging fully green before anything touches production.** *Amended 2026-09-14 (user decision): B8 is parked; production proceeds with the PayMongo test moved to C8.*

### Phase C — Production
| # | Who | Step | Detail |
|---|---|---|---|
| C1 | 👤 | Parity: `npx supabase migration list --project-ref <prod-ref>`. ⛔ **Production equals staging, apart from `20260913000001`** | rule 5 |
| C2 | 👤 | `npx supabase secrets list --project-ref <prod-ref>`. ⛔ **No `NOTIFICATION_EMAIL_OVERRIDE_TO`** | G5 |
| C3 | 👤 | At a quiet time: `db push` to production (the same way you normally push production) | — |
| C4 | 👤 | Same verification queries as B3. ⛔ **All match** | — |
| C5 | 👤 | Deploy `send-notification-email` to production (same checkout as B5). ⛔ **New version visible** | G4 |
| C6 | 👤 | **Only now** deploy Command to production | rule 2 |
| C7 | 👤 | **First real run:** mark one payout paid for a vendor you can contact. Confirm the email arrived and matches the modal. ⛔ **Confirmed** | G13 | · *Pre-check (F16): in production Command, "Show full details" works for each vendor in this run before downloading the PESONet file*
| C8 | 👤 | **The first production PayMongo upload IS the parked B8 test** (decision 2026-09-14). 1) Run the downloaded file through PayMongo's upload/validation and read any errors before submitting. 2) Submit bank rows first. 3) Only after a small test transfer to a GCash number you control succeeds, include GCash rows. ⛔ If PayMongo rejects the format: stop using the file (Mark Paid still works) and report the exact error. If only GCash is rejected: set `PESONET_WALLETS_ENABLED.gcash = false` (F14) and redeploy Command. Closes D3 and F14 when accepted | B8, D3, F14 |

### Phase D — Contract: retire the old release function (after C7)
| # | Who | Step | Detail |
|---|---|---|---|
| D1 | 🤖 | Copy `pending/retire_release_booking_payouts.sql` into `migrations/` with a **fresh timestamp**, and name the revert file to match | G1, G2 |
| D2 | 👤 | Apply locally; re-run `payout_statements_test.sql`. ⛔ **Pass** | — |
| D3 | 👤 | Commit and push. Staging: `migration list` (⛔ only the contract migration pending) → `db push` → Mark Paid on staging still works ⛔ | — |
| D4 | 👤 | Production: `migration list` (⛔ only the contract migration pending) → `db push` → Mark Paid on production still works ⛔ | — |

### Safe and unsafe states: where you can pause, and what breaks
| State | Safe to pause? | Why |
|---|---|---|
| `20260913000001` applied; email function and Command **not** deployed | ✅ Yes | Additive only. The current Command keeps using the old release function; nothing on screen changes |
| Email function deployed; Command not | ✅ Yes | The new template only runs for `payout_statement`, which nothing writes yet |
| **New Command deployed, `20260913000001` missing** | ❌ No | The Mark Paid modal can't load its preview, so nobody can mark payouts paid. Fix: push the migration or roll back the Command deploy |
| **New Command deployed, email function NOT redeployed** | ❌ No | Statements are recorded, but emails fall back to the generic renderer (title/body only, no table). Fix: deploy the function; emails already sent can't be re-rendered |
| Contract migration applied, **old** Command running | ❌ No | Old Command's "Mark paid" → permission denied. Fix: `rollback/retire_release_booking_payouts.revert.sql` |
| Contract migration pushed together with `20260913000001` | ❌ No | Same as above, in production. Prevented by rule 3 |
| Production pushed before staging proven | ❌ No | A problem reaches real vendors first |

### Rolling back
- **Command misbehaves (before Phase D):** roll back the Command deploy. The old build works against `20260913000001`; statements already recorded stay.
- **Command misbehaves (after Phase D):** run `rollback/retire_release_booking_payouts.revert.sql` first, then roll back Command.
- **Remove the feature entirely:** Command rollback → contract revert (if applied) → `rollback/20260913000001_payout_statements.full-revert.sql` (keeps the tables if they hold rows). The email function needs no rollback: its new template only affects the new type.

## Verification
- **Baseline recorded 2026-09-13 (command `feature/payout_modal_invoice_summary`, before any change):** `tsc --noEmit` exit 0 · `npm test` **79/79** · `npm run lint` exit 1 with **25 pre-existing problems (20 errors, 5 warnings)**. The lint gate is **no new problems**.
  - **Edge Function baseline (2026-09-13, deno 2.9.6):** `~/.deno/bin/deno test --node-modules-dir=none supabase/functions/send-notification-email` from `backbone/` → **20 passed, 0 failed**. The flag is required, see F6.
  - **Command Playwright baseline (2026-09-13, start of Stage 4, before any edit):** full suite **24 passed, EXIT=0** (`node_modules/.cache/stage4/baseline.log`).
- **Machine:**
  - SQL tests (B1);
  - `deno test` (B2);
  - `npx --prefix command tsc --noEmit`, `npm --prefix command test`, `npm --prefix command run lint`, `npm --prefix command run test:visual` (B3–B5);
  - XLSX tests + openpyxl re-read (B6).
- **Live (local):** I2.
- **Live (user / third-party):**
  - PayMongo accepts the generated file (D3);
  - a real vendor inbox renders the table in Gmail and Outlook;
  - staging run with the override inbox before production.
