# Vendor Account Deletion — self-service request, Command-executed closure

**Date:** 2026-08-21
**App / scope:** `vendor` (portal UI + API routes), `command` (review queue + execution
route), `backbone` (one new table, one notification-type seed), `ezzy.ph` (one public
page), `ezzy-vendor-mobile` (one constant repoint). **This is a cross-app change and
carries that approval gate (AGENTS.md → Ask Before).**
**Status:** ✅ **COMPLETE (2026-08-25)** — all 8 blockers and all 18 IMPORTANT items done;
code committed by the user. Everything still outstanding moved to
**`.plans/2026-08-25-vendor-launch-followups.md`**; nothing is tracked only here.

### What shipped
Vendor-initiated account closure, end to end: a request table with RLS and grants
(`backbone`), a Settings card and confirmation modal (`vendor`), a review queue and the
destructive execution path (`command`), a repointed in-app link (`ezzy-vendor-mobile`), and
matching published policy text (`ezzy.ph`). Plus a "Closing" section in the dashboard guide.

### What is NOT verified, and is the reason a successor plan exists
**No route has ever been called over HTTP with a real session.** Three things have never
executed: B5 step 5's email wait, I9's `SIGNED_OUT` handling, and I4's co-admin fan-out. The
migrations are applied to **local only**. All of this is L1 and L2 in the successor plan.

### Bugs found that this plan did NOT cause
- **I5** — Command's KYC approve/reject emails have never sent. Reported, not fixed; now a
  **launch blocker** in the successor (L3).
- **I11 / I17** — Command has no visual suite; the vendor suite has 29 pre-existing failures.
  Now F2 / F3.
- **I13** — no click-opened modal had ever worked in Command's `ui-gallery`. Fixed here,
  because it blocked verifying I12.

### Three corrections worth carrying forward
1. **`schema.md` was wrong** about `vendors.phone/email/operating_hours` being nullable. They
   are `not null default ''`, and writing `null` would have half-executed a closure with the
   KYC documents already deleted. Doc corrected; **verify against the database, not the doc.**
2. **A `123 passed` tail is not a result.** The vendor visual suite was twice reported green
   when the real summary was `29 failed / 123 passed`. Read the summary line and the exit code.
3. **`WebFetch` caches 15 minutes per URL.** A page edited moments earlier will be reported
   with its old content unless the URL is cache-busted.


> One-line framing: give a vendor a real, discoverable way to close their account and
> have their personal data removed, in a system where the database makes hard-deleting a
> trading vendor impossible — so "deletion" has to mean *user account destroyed, business
> record scrubbed and retained under a disclosed legal basis*, not a euphemism for suspend.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** F# = investigation finding, B# = Blocker, I# = Important, D# =
> decision. Numbers are plan-local — qualify cross-plan refs by app and date (e.g.
> "08-21 mobile D1").

> **Predecessors this plan answers:**
> - `.plans/2026-08-21-vendor-mobile-release-gap-closure.md` **B2** (no deletion web
>   resource) and its **D1** (what shape that resource takes). This plan is the answer:
>   **D8 below resolves that plan's D1 as (a)+(c), 2026-08-21**, and its Stage B is
>   unblocked. B7 here is the same work item as its B2.
> - `.plans/2026-08-16-vendor-mobile-store-release-readiness.md` **B2**, which already
>   named "a `vendor` route that actually deletes" as the fix.

---

## Scope

**In scope.** A vendor-admin can, from the vendor portal (and via a public web page
reachable without signing in), request closure of their vendor account, optionally
including their own user login; Ezzy verifies eligibility, executes the closure, and
confirms by email.

**Explicitly out of scope** — named so they are not quietly absorbed:
- **Booker account deletion.** Same legal requirement, different portal and different
  blocking rules (`bookings.booker_id` is `ON DELETE RESTRICT`, so a booker who has ever
  booked cannot be row-deleted either). The table drafted in B1 is deliberately shaped to
  serve it later; no booker work happens here. See DEFERRED.
- **Vendor member management / administration transfer.** Does not exist in the vendor
  portal today (F9) and is not being built here. It only shapes I1.
- **Fixing `command`'s broken KYC notification path** (F3). Found while investigating,
  reported as I5, not fixed under this plan.
- **A `closed` vendor status.** Assessed and deferred — see D6 and F7.

---

## What the infrastructure forces — findings, each verified in the file

These are not preferences. They are constraints the code already imposes, and they are
why the design below looks the way it does.

### F1 — A trading vendor cannot be row-deleted. Ever.
`bookings.vendor_id` is `on delete restrict` (`backbone/supabase/migrations/20260507000004_bookings.sql:24`)
and so is `booking_transactions.vendor_id` (`20260725000002_booking_transactions.sql:48`).
One booking — of **any** status, including `cancelled` — makes `delete from vendors`
raise for the rest of that vendor's existence.

The existing Command path already concedes this: `command/hooks/mutations/vendors/useDeleteVendor.ts:7-14`
counts bookings first and refuses with *"Suspend the vendor instead to preserve booking
history."* So "delete the vendor row" is available **only** for the zero-history case
(a registration that never traded), and every other case must be scrub-and-retain.

The user's stated rule — no deletion while bookings/payouts/disputes exist — is therefore
already half-enforced by the schema. What this plan adds is the *open* subset of that
rule (open bookings, unsettled payouts, live disputes) as a **pre-condition**, and
scrub-and-retain as the outcome once it passes.

### F2 — Deleting DB rows does not delete the KYC documents. This is the actual PII risk.
`vendors → vendor_kyc → vendor_kyc_documents` is `CASCADE` (`schema.md` Delete Behaviour
Summary), but the bucket is not. `vendor-kyc` holds government IDs, permits and business
registrations at `{vendor_id}/{uuid}-{filename}` (`schema.md` Storage buckets), and
`db reset` is documented as never touching blobs (`architecture/vendor-kyc.md:289`).

**A closure that only writes SQL leaves the most sensitive personal data in the system
intact, with the DB rows that pointed at it gone** — i.e. undeletable by any later sweep
keyed on `vendor_kyc_documents`. The Storage purge is mandatory and must run *before* the
rows that name the paths are removed. Precedent for the sweep already exists:
`vendor/app/api/auth/register/route.ts:160-168` (rollback) and
`backbone/scripts/wipe-kyc-storage.mjs`.

### F3 — Nothing can email a vendor from a browser. `notifications` is service-role-only.
`20260620000001_api_role_grants.sql:66` grants `authenticated` **select, update, delete**
on `public.notifications` — no `insert` — and no INSERT policy exists
(`20260525000002_notifications.sql:52-63`). Every acknowledgement in this plan must be
written by a service-role route.

> **Pre-existing defect found here, reported not fixed (I5):**
> `command/services/kyc-admin.service.ts:145` inserts into `notifications` using the
> **browser** client (`:6 import { createClient } from "@/lib/supabase/client"`). That
> insert cannot succeed. The surrounding `try/catch` (`:152`) never fires either, because
> PostgREST returns an error *object* rather than throwing — so KYC approve/reject emails
> to vendors have been silently dropped since `20260808000001` shipped the types for them.

### F4 — Ordering trap: you cannot email a user you have already deleted.
`notifications.user_id` cascades from `profiles`, which cascades from `auth.users`.
`dispatch_notification_email` posts **only the notification id** to the Edge Function via
`pg_net` after commit — fire-and-forget (`schema.md` → `notifications` → Email dispatch) —
and `SupabaseRecipientResolver.resolve()`
(`backbone/supabase/functions/send-notification-email/lib/recipientResolver.ts:12-30`)
reads the address from `profiles`, falling back to `auth.users`.

Delete the auth user in the same route and the row is gone, the address is gone, and the
function finds nothing. **No error, no email, no trace.** The execution route must
therefore write the confirmation, wait for `notification_emails` to report `sent`/`failed`
for that notification id (that table exists precisely as the delivery log and idempotency
guard), and only then perform the auth deletion. See B5.

### F5 — The existing vendor-side authz helper refuses exactly the vendors most likely to ask.
`assertVendorAdmin()` requires the **vendor** to be active
(`vendor/lib/payout/authz.server.ts:75-81`) — correct for redirecting payouts, wrong here.
A `pending_activation` applicant whose KYC was rejected, or a `suspended` vendor, is the
single most likely person to want their ID documents deleted, and this helper would 403
them. B3 needs a sibling that keeps layers 1–3 (portal grant, active *profile*,
vendor-admin at this vendor) and drops the vendor-active requirement.

### F6 — A service-role route *can* set vendor status; a vendor *cannot*.
`prevent_vendor_status_self_update()` (`20260511000001_vendor_approval.sql:11-28`) raises
unless the caller is a Command admin — but it is guarded on `auth.uid() is not null`, and
service-role has a null `auth.uid()`. So the execution route can move the status.
`validate_vendor_status_transition()` (`:44-48`) permits only
`pending → active|suspended`, `active ↔ suspended`. There is no terminal state.

### F7 — Adding a `closed` status is a four-repo change, not a schema change.
`command/services/vendors.service.ts:20-22` maps any unrecognised status name to
**`pending_activation`**. A `closed` vendor would therefore appear in Command as *awaiting
approval*, in the pending count on `VendorStatsBar`, and under the "Pending" toolbar
filter — actively misleading. The same union is hardcoded in `command/lib/types.ts:8`,
`command/lib/constants.ts:34`, `ezzy-vendor-mobile/src/services/vendorMapping.ts:5` and
`ezzy-vendor-mobile/src/hooks/useVendorGate.ts:8`. Weighed in D6; recommended deferred.

### F8 — The schema already anticipated account deletion once, and set the pattern to copy.
`legal_acceptances.user_id` is `ON DELETE SET NULL` (not CASCADE) with an `email`
snapshot, and `schema.md` states the reason outright: *"deleting an account must not
destroy the evidence that its owner accepted the terms — that is precisely when the record
matters."* B1's table copies that shape exactly: nullable actor FKs plus email/name
snapshots, so the record of a deletion survives the deletion.

### F9 — Multi-vendor and multi-admin are representable; handover is not.
`vendor_members` PK is `(user_id, vendor_id)` — a user may administer several vendors, and
a vendor may have several admins. The portal simply takes the first *active* one
(`vendor/services/vendor-access.service.ts:76-77`). There is **no** member-management UI
in the vendor portal, so a sole vendor-admin has no way to hand the business over before
leaving. This is what makes I1 and I2 necessary rather than theoretical.

---

## What the outside world requires — and what it does not

- **Google Play.** *If* an app lets users create an account **in-app**, it needs an in-app
  deletion path **and** a web link resource. `ezzy-vendor-mobile` is **sign-in only** —
  registration is web (`vendor/app/api/auth/register`) — so the binding obligation is the
  **web resource URL** for the Data safety form. Two further rules do bind us: you may
  **not** answer a deletion request by freezing/deactivating the account, and you **may**
  retain data for security, fraud prevention or regulatory compliance **provided you
  disclose it**. ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en))
- **Apple 5.1.1(v).** In-app *initiation* required for in-app account creation; financial
  data may be retained provided the retained account carries no personal information, and
  only highly-regulated industries may push users to customer service. iOS is ⏸ PARKED for
  this product (08-16 D4), so this shapes the design but blocks nothing.
  ([Apple Developer Forums](https://developer.apple.com/forums/thread/693997))
- **PH Data Privacy Act (RA 10173).** The right to erasure is **not absolute** — a
  controller may refuse where the data is still needed for a legal obligation, or for the
  establishment/defence of legal claims, and *blocking/restriction* is an accepted
  outcome. BIR retention on books of accounts runs up to 10 years.
  ([NPC](https://privacy.gov.ph/right-to-erasure-or-blocking/) ·
  [IAPP summary](https://iapp.org/news/a/summary-philippines-data-protection-act-and-implementing-regulations))
- **⏱ There is a response deadline, and it applies whichever flow D1 picks.** NPC Advisory
  2021-01 requires a controller to act on a data subject request within **30 working days**
  (extendable by 15 for complex or numerous requests), and to provide *"a clear, simple,
  straight-forward and convenient procedure"* for exercising the right.
  ([NPC Advisory 2021-01](https://privacy.gov.ph/wp-content/uploads/2021/02/NPC-Advisory-2021-01-FINAL.pdf))
  Two consequences worth stating plainly, because they are easy to get backwards:
  - The turnaround obligation is **not created by choosing the Command-executed flow**. It
    already exists. That flow makes a human responsible for meeting it; automation meets it
    by construction. Neither option can opt out of it.
  - **Automation does not remove the human path.** A vendor blocked by open bookings,
    unsettled payouts or a live dispute is *refused*, and that refusal is itself a response
    to a data subject request — same clock, same duty to explain. Self-service shrinks the
    manual surface to the blocked cases; it does not eliminate it.
  The committed window belongs in three places you are already editing: the acknowledgement
  email copy (B2), the public page (B7), and the privacy policy (B8). Keep the number
  identical in all three.

**Net:** deleting the *user account* outright, while retaining a *scrubbed business
record* with its financial rows under a disclosed legal basis, is both the compliant
answer and the only one the schema permits (F1). What makes it compliant rather than a
dodge is B8 — the privacy policy must say so.

---

## The model

```
VENDOR PORTAL                     BACKBONE                       COMMAND
Settings → Close account
  └─ eligibility check  ─────►  open bookings? unsettled
     (GET, server-side)          payouts? live disputes?
  └─ submit request     ─────►  account_deletion_requests   ───►  Closures queue
     (POST, service role)        status = pending                  (badge + list)
           │                            │                              │
     ack email ◄────────────────  notifications (service role)         │
           │                                                           │
     may cancel while pending ────────────────────────────────────►  verify + execute
                                                                       │
                        ┌──────────────────────────────────────────────┘
                        ▼  service-role execution route, in this order:
                        1. re-check eligibility (never trust the snapshot)
                        2. purge vendor-kyc Storage blobs, then the doc rows
                        3. scrub vendor PII columns; retain business + financial rows
                        4. vendor → suspended; revoke `vendor` portal grants
                        5. write confirmation notification, AWAIT notification_emails  ← F4
                        6. delete auth users per scope
                        7. mark request completed
```

**Why request-then-execute rather than one-click self-service.** Three reasons, in order
of weight: the action is irreversible and touches money; F1 means most closures are a
*scrub*, not a delete, and a scrub is a judgement call that benefits from a human reading
the ledger once; and at launch volume the queue costs minutes per week. Play permits it —
its wording is that users must be able to *request* deletion. D1 records the alternatives.

---

## The vendor's journey — the experience this plan must produce

Added 2026-08-21 during plan review. The system flow above says what the machine does;
this says what the person sees. **Three gaps were found writing it (I8, I9, and the
strengthening of I6) — they are the reason this section exists rather than being assumed.**

### Where a vendor triggers it — three entry points, each serving a different person

| Surface | Path | Who it is for |
|---|---|---|
| **Vendor portal** | Sidebar → **Settings** → "Close account" card, last on the page | The normal case. Settings is reached from the **sidebar, not the bottom tab strip** — `AppShell.tsx:28-30` records that exclusion as deliberate, so B4 must not assume a tab entry point |
| **Mobile app** | Settings tab → **"Delete account"** row (red, already exists, `SettingsList.tsx:150-164`) → opens B7's page in an in-app browser | The Data safety URL target |
| **Public page** | `ezzy.ph/account-deletion/` direct, or via the privacy policy | Locked-out, suspended and rejected-KYC vendors — the people who **cannot reach the other two** (F5) |

### Happy path — an eligible vendor

1. **Settings → the card, on mount.** Eligibility is fetched before anything is actionable;
   the destructive button must not render enabled while the answer is unknown.
2. **"Close account"** opens the modal: scope choice (D3 — *close the business and delete my
   login* / *close the business only*), an optional reason, a plain-language summary of what
   is deleted and what is kept, and a typed confirmation.
3. **Submit.** The card flips to its **pending** state: what was requested, the execution
   date, and a **Cancel** action. The acknowledgement email arrives (B2).
4. **The 7 days.** The portal stays fully usable — the vendor must be able to change their
   mind, and Play's "no freezing instead of deleting" rule makes a soft-lock the wrong
   instinct (I6).
5. **Execution.** Confirmation email first, then the account goes (B5's ordering, F4).

### Blocked path

No button at all. The card names each blocker with its count and what clears it — *"3
bookings still open"*, *"₱4,200 in payouts not yet released"*, *"1 open dispute"* — so the
vendor knows what to do rather than being told "not allowed". The public page (B7) must
carry the same list in prose, because a locked-out vendor never sees this card.

### The other half of the journey — what Command does

The vendor's flow ends at "submitted". Somebody at Ezzy has to finish it, and that work is
B6's page plus B5's route. Written here so the two halves are legible together:

1. **They find out three ways, all reusing machinery that already exists** — the
   `account_deletion_pending_review` notification lands in the bell panel (B2), a count
   appears on Overview beside the existing `openFlagCount` (B6.2), and the **Closures** nav
   tab carries it. Three because one is not enough for something on a 30-day statutory clock.
2. **They open Closures** (top-level page, after `users`, beside Flags — D7) and read the
   row: vendor, requester, scope, reason, requested date, execution date, **days elapsed**
   against the D9 promise (B6.1), and a **live** eligibility re-check — never the
   request-time snapshot, which may be a week stale.
3. **They act.** *Reject with a reason* → the vendor is emailed why. *Execute* → a
   confirmation restating exactly what will be destroyed and what will be kept, requiring
   the vendor's name to be typed (D10), then B5's route runs.
4. **If it half-fails**, the request goes `failed` with the reason and stays visible in the
   queue with a Retry (B6.5) — a partially-executed closure must never become invisible.

**What Command does NOT have to do:** decide the rules. Eligibility, what is scrubbed, what
is retained and what is emailed are all fixed by D4/D5 and enforced by the route. The
admin's judgement is limited to *"is this request legitimate, and is it safe to run now"* —
which is precisely the judgement D1 chose to keep a human in.

### Copy the modal must carry — this is a requirement, not a suggestion

- **What is deleted:** the login and password; the vendor profile's contact details and
  address; every verification document uploaded during KYC.
- **What is kept, and why:** the business name, and the record of bookings and payments —
  *"required by BIR record-keeping rules and to resolve any dispute later"*. Bookers who
  booked in the past keep seeing that history, which is why the name is retained (D4).
- **How long:** the D9 turnaround, worded identically to B7 and B8.
- **What it is not:** closing the business account does not delete an Ezzy booker login
  held on the same email, and vice versa (D3).

---

## BLOCKERS

### B1 — There is no request record. New table `account_deletion_requests` ✅ DONE — **approval gate**
**Files:** new `backbone/supabase/migrations/20260821000001_account_deletion_requests.sql`
Nothing in the schema can represent "this vendor asked to be closed", so there is no queue
for Command, no ack to email, and no audit trail of a destructive act. Shape copies
`legal_acceptances` (F8) for actor nullability + snapshots, and `booking_disputes`
(`schema.md`) for the one-open-per-subject partial unique index.

**Exact SQL, drafted for approval. D1–D9 are resolved; this now needs only the schema
approval gate — the file is not written until the user says go.**

```sql
-- Why nullable actor FKs + snapshots: this row must SURVIVE the deletion it records.
-- Same reasoning, and same shape, as legal_acceptances.user_id (20260819000001).
create table public.account_deletion_requests (
  id               uuid        primary key default gen_random_uuid(),

  requested_by     uuid        references public.profiles(id) on delete set null,
  requester_email  text        not null,
  requester_name   text        not null default '',

  vendor_id        uuid        references public.vendors(id) on delete set null,
  vendor_name      text        not null default '',

  scope            text        not null
                     check (scope in ('vendor_and_user', 'vendor_only', 'user_only')),
  reason           text        not null default '',

  status           text        not null default 'pending'
                     check (status in ('pending','cancelled','completed','rejected','failed')),

  -- Eligibility as computed at request time. Advisory only: the execution route
  -- RE-COMPUTES it (B5 step 1). Stored so a later dispute can see what was true then.
  blockers         jsonb       not null default '{}'::jsonb,

  scheduled_for    timestamptz,                    -- created_at + 7 days (D2)
  reviewed_by      uuid        references public.profiles(id) on delete set null,
  review_notes     text        not null default '',
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.account_deletion_requests is
  'Vendor-initiated account closure requests. Append-and-resolve; rows are never deleted, '
  'and survive the deletion of both the requester and the vendor they name.';

-- At most one live request per vendor. Mirrors booking_disputes_one_active_idx.
create unique index account_deletion_requests_one_open_idx
  on public.account_deletion_requests (vendor_id) where status = 'pending';
create index account_deletion_requests_pending_idx
  on public.account_deletion_requests (created_at) where status = 'pending';

create trigger set_account_deletion_requests_updated_at
  before update on public.account_deletion_requests
  for each row execute function public.set_updated_at();

alter table public.account_deletion_requests enable row level security;

-- The requester keeps sight of their own request even after their vendor membership
-- is revoked (scope = vendor_only), which is why this policy is not vendor-scoped.
create policy "requesters read own deletion requests"
  on public.account_deletion_requests for select to authenticated
  using (requested_by = auth.uid());

-- is_active() is REQUIRED alongside has_vendor_role(): the helper checks membership and
-- role only, so a suspended vendor-admin passes it (schema.md, RLS Philosophy).
create policy "vendor admins read their vendor's deletion requests"
  on public.account_deletion_requests for select to authenticated
  using (public.is_active() and public.has_vendor_role(vendor_id, 'vendor-admin'));

create policy "command admins read all deletion requests"
  on public.account_deletion_requests for select to authenticated
  using (public.is_portal_member('command')
         and (public.has_role('admin') or public.has_role('root')));

-- No INSERT/UPDATE/DELETE policy for authenticated, deliberately. Creation snapshots an
-- email and computes eligibility server-side, and resolution is a destructive act — both
-- are service-role route work. Same reasoning as notifications and booking_transactions.
grant select on public.account_deletion_requests to authenticated;
grant select, insert, update, delete on public.account_deletion_requests to service_role;
-- anon: nothing.
```

**Blast radius.**
- *Data:* creates an empty table. No existing row is read, rewritten or validated. Nothing can fail on existing data.
- *Lock / performance:* `create table` + two indexes on an empty relation. No lock is taken on any live table. Sub-second.
- *Downstream:* a hand-written interface in the new `vendor` and `command` services (this repo does not use `supabase gen types`); a `schema.md` entry and a Delete Behaviour Summary row; nothing else reads it.
- *Reversibility:* `drop table public.account_deletion_requests;` — safe unconditionally, since no other table references it.

✅ **DONE (2026-08-21)** — `backbone/supabase/migrations/20260821000001_account_deletion_requests.sql`
written and **applied to the local database by the user**, then verified against the live
schema. Three additions beyond the approved draft, all made while writing: `(select auth.uid())`
initplan form (copied from `legal_acceptances`), plain indexes on `vendor_id`/`requested_by`,
and column comments on the two load-bearing columns.

**Structure verified by querying the catalogue, not by reading the file back:** 16 columns
with the intended nullability and defaults; 5 indexes including the partial unique; 6
constraints with both FKs `ON DELETE SET NULL`; the `set_updated_at` trigger; RLS enabled;
3 SELECT policies. **Grants land correctly — `authenticated` holds SELECT and nothing else
(no TRUNCATE), `service_role` holds full DML**, which is the gap that produced two earlier
corrective migrations.

**Behavioural RLS verified — 10 tests, all inside a transaction that rolled back (table
confirmed empty afterwards, seed user and membership intact):**

| # | Test | Result |
|---|---|---|
| T1 | Requester sees their own request | ✅ 1 row |
| T2 | Unrelated vendor-admin, no Command access, sees nothing | ✅ 0 rows |
| T3 | `authenticated` INSERT | ✅ permission denied |
| T4 | `authenticated` UPDATE | ✅ permission denied |
| T5 | **Co-admin at the same vendor** sees it though she did not request it | ✅ 1 row |
| T6 | Second `pending` request for one vendor | ✅ blocked, `23505` on the partial unique index |
| T7 | Second request allowed once the first is `cancelled` | ✅ inserted |
| T8 | `set_updated_at` resets a stale `updated_at` | ✅ fired |
| T9 | **Requester still sees the row after their vendor membership is revoked** — the I8 path | ✅ 1 row |
| T10 | Profile deleted → `requested_by` nulled, row survives with the email snapshot | ✅ 1 row, 0 non-null actors, snapshot intact |

⚠️ **T2 failed on its first run and the policy was NOT at fault** — recorded per
plan-authoring §4. The fixture user (`marco@bookdeck.com`) turned out to hold `admin` **and
the `command` portal**, so the Command policy correctly matched and returned the row. Re-run
against a vendor-admin with no Command access, it returned 0. A false alarm, but only
because the fixture was checked rather than the policy being "fixed".

T5 and T9 matter most: T5 proves a multi-admin vendor's co-administrators can see a pending
closure (which is what I4's notification then acts on), and T9 proves the `requested_by`
policy survives membership revocation — the whole basis of I8's "closed at your request"
screen.

**Outstanding:** applied to **local only**. The hosted rollout is tracked as I10.

### B2 — Nothing can be emailed about a closure. Notification types missing ✅ DONE — **approval gate**
**Files:** new `backbone/supabase/migrations/20260821000002_account_deletion_notification_types.sql`;
`backbone/supabase/functions/send-notification-email/types.ts:6-20`
`notifications.type` is FK-constrained to `notification_type_settings`
(`20260525000002_notifications.sql:23`), so no closure notification can exist until the
rows do — the exact failure mode `20260808000001` was written to fix, with its reasoning
worth re-reading before writing this one.

```sql
insert into public.notification_type_settings (type, label, description) values
  ('account_deletion_requested', 'Account Closure Requested',
   'Sent to the vendor-admin who requested closure, acknowledging the request and stating what happens next.'),
  ('account_deletion_completed', 'Account Closure Completed',
   'Sent to the requester when the closure has been executed, listing what was deleted and what was retained.'),
  ('account_deletion_rejected',  'Account Closure Not Possible',
   'Sent when Command cannot action a closure request, with the reason.'),
  ('account_deletion_pending_review', 'Account Closure Request (Command)',
   'Sent to Command admins when a vendor requests account closure.')
on conflict (type) do nothing;
```

**Fix approach:** the migration above, plus the `NotificationType` union in
`send-notification-email/types.ts`. No bespoke templates needed; the dispatcher fires on
every insert with no type filter and falls back to the generic template.
⚠️ An earlier draft of this item also required **a redeploy of the Edge Function**, citing
the 08-08 migration's header. **That was wrong** — see the correction in the completion note
below. The union has no runtime representation, so no redeploy is needed.
**Blast radius:** four seed rows into a lookup table; `on conflict do nothing`; reversible
by `is_enabled = false` (not `delete`, once any notification references them).

✅ **DONE (2026-08-21)** — `20260821000002_account_deletion_notification_types.sql` written
and **applied locally**; all four rows confirmed in `notification_type_settings` with
`is_enabled = true`. The `NotificationType` union in
`backbone/supabase/functions/send-notification-email/types.ts:20-33` carries all four and
**type-checks clean** (`tsc --noEmit --strict`, exit 0).

⚠️ **CORRECTION (2026-08-21) — this item's own "redeploy required" claim was wrong, and so is
the one it was copied from.** Recorded per plan-authoring §4 rather than quietly dropped.

The user ran `supabase functions deploy send-notification-email --no-verify-jwt` against
staging and got **"No change found in Function"**. That is correct behaviour, not a caching
artifact, and reading the code says why:

- `NotificationType` is a **pure type alias**. TypeScript types are erased at compile time,
  so the deployed bundle is byte-identical no matter how many members the union gains.
- It is **imported by nobody** — all six consumers (`notificationRepo`, `settingsGate`,
  `recipientResolver`, `emailSender`, `deliveryLog`, `handler.test`) import
  `NotificationRecord` / `Recipient` / `SendResult` / `EmailContent`. Never `NotificationType`.
- `NotificationRecord.type` is deliberately `string` (`types.ts:27`), with a comment saying
  an unknown type must fall back to generic rather than fail to compile.
- `lib/templates/registry.ts:11` — `const overrides: Record<string, TemplateRenderer> = {}`.
  **Empty.** `getRenderer()` returns `renderGeneric` for every type that exists.

**So the union is documentation, and the redeploy was never required.** The claim written
here — *"mail still sends but through the generic template, which is wrong copy rather than
no delivery"* — is false: mail goes through the generic template **either way**, because
there are no bespoke templates for *any* type. The email difference the sentence implies
does not exist.

**Provenance:** the claim was inherited verbatim from `20260808000001_vendor_lifecycle_notification_types.sql`'s
header ("⚠️ DOWNSTREAM, NOT OPTIONAL … the function must be REDEPLOYED"), which is wrong for
its own three types for exactly the same reason. That migration is applied and is **not**
edited (conventions.md). The correction lives here; anyone repeating the pattern should read
this note rather than that header.

**What actually matters when a notification type is added:** only that the
`notification_type_settings` row exists before any `notifications` row references it — the FK
at `20260525000002:23` is the real constraint. A redeploy becomes genuinely necessary only
when a bespoke renderer is registered in `overrides`, which has never yet happened.

**Outstanding:** the migration reaching staging and production — tracked as I10, same as B1.

### B3 — Vendor portal has no way to ask. Eligibility service + API route ✅ DONE
**Files:** new `vendor/lib/accountDeletion/eligibility.server.ts`,
`vendor/lib/accountDeletion/authz.server.ts`, `vendor/app/api/account-deletion/route.ts`,
`vendor/services/accountDeletion.service.ts`
**Eligibility — one server-side implementation, consumed by both the UI and the request
route.** Two implementations of "may this vendor close?" is how the button and the
enforcement drift apart. Blocking conditions, each grounded in a real column:

| Blocker | Query | Why this cut |
|---|---|---|
| Open bookings | `bookings` where `vendor_id = ?` and `status in ('pending','confirmed','fulfilled','in_progress','returned','disputed')` | The other three (`completed`, `cancelled`, `refunded`) are terminal — `schema.md` `bookings`. History does not block; live obligations do. |
| Unsettled payouts | `booking_transactions` where `vendor_id = ?` and `payout_status in ('held','releasable')` | `released` and `reversed` are settled. Both vendor clients already key "payable" on this column, never on booking status. |
| Live disputes | `booking_disputes` joined to this vendor's bookings, `status = 'open'` | `resolved` is closed; the partial unique index means at most one open per booking. |

**Authz (F5):** a sibling of `assertVendorAdmin` in a new
`vendor/lib/accountDeletion/authz.server.ts` — layers 1–3 identical, **without** the
vendor-active check, with a header comment saying why the two differ so a later reader
does not "fix" the divergence. Do not weaken the payout helper to share it.

**Route** (`GET` eligibility + current request · `POST` create · `DELETE` cancel while
`pending`). `POST`/`DELETE` are non-GET deliberately — `@supabase/ssr` cookies are
SameSite=Lax, which is the CSRF story the payout route documents
(`vendor/app/api/payout-method/route.ts:23-26`). `POST` uses `createAdminClient()` for the
insert (F3), snapshots `requester_email`/`vendor_name`, computes `blockers` server-side,
sets `scheduled_for`, and writes the ack + Command notifications.

✅ **DONE (2026-08-21).** Seven files, split so the rule is testable without a database:

| File | Role |
|---|---|
| `lib/accountDeletion/eligibility.ts` | **Pure.** Blocking status sets, `evaluateEligibility()`, `checkScope()`, `isDeletionScope()`. Imports nothing, so `node --test` loads it directly |
| `lib/accountDeletion/eligibility.test.ts` | 13 tests |
| `lib/accountDeletion/eligibility.server.ts` | The three counts + scope context. Admin client, window guard |
| `lib/accountDeletion/authz.server.ts` | `assertMayRequestClosure()` — layers 1–3, no vendor-active check (F5) |
| `lib/accountDeletion/policy.ts` | `GRACE_PERIOD_DAYS = 7`, `TURNAROUND_DAYS = 30` (D2/D9), so email and UI cannot disagree |
| `app/api/account-deletion/route.ts` | GET / POST / DELETE |
| `services/accountDeletion.service.ts` | Browser side |

**Verified — machine:** `tsc --noEmit` exit 0 · `npm test` **242/242** (13 new) · `eslint`
clean on all new paths · `npm run build` succeeds and registers `ƒ /api/account-deletion` ·
**no service-role leak** — `SUPABASE_SERVICE_ROLE_KEY`, the key's actual value, and the
server-only module marker all absent from `.next/static/` and `.next/` (the check
`conventions.md` requires for a `.server.ts` module).

**Verified — against the local database**, because two queries were guesses until run:
the `booking_disputes` → `bookings!inner(vendor_id)` filter with `head: true` returns
**1** for a vendor with an open dispute, **0** for one without, and **0** for
`status = 'resolved'` on the same vendor. The seed carries no disputes at all, so the
first `0` proved nothing — a temporary dispute row was inserted to exercise the filter and
**deleted afterwards (table confirmed back to 0)**. The nested
`profiles(statuses(name))` embed on `vendor_members` also returns the expected shape.

**Not verified:** the HTTP round-trip with a real session cookie. That needs a running dev
server and a logged-in vendor, and lands naturally with B4 — the card is its first caller.

**Three implementation decisions worth the record:**

1. **The peso amount was dropped from the `unsettled_payouts` blocker.** The preview
   showed *"₱4,200 in payouts not yet released"*; summing `payout_amount` means fetching
   every unsettled row, an unbounded read of exactly the kind
   `.plans/2026-08-11-crossapp-unbounded-query-truncation.md` exists to stop. All three
   counts now use `head: true` — a count and no rows. The count alone decides, and amounts
   are already on the vendor's Transactions page. **This changes the preview copy: B4 must
   say "3 payouts not yet released", not a peso figure.**
2. **Any vendor-admin may cancel a pending request, not only whoever raised it.**
   Cancelling is the safe direction, and a co-administrator unable to stop the closure of a
   business they run is the worse failure. The destructive verb belongs to Command.
3. **Open disputes stay a separate blocker** even though an open dispute currently implies
   `bookings.status = 'disputed'`, which the first count already catches. Relying on that
   overlap would break silently if the state machine changed, and the vendor is owed the
   specific reason.

**Eligibility is counted with the ADMIN client, deliberately** — authorisation is settled
first and separately by `assertMayRequestClosure` running as the caller. If a policy ever
narrows, an RLS-bound count would **under**-count and report a blocked vendor as eligible;
under-counting is the dangerous direction, so the count must not depend on caller
visibility.

### B4 — Settings has no closure UI ✅ DONE
**Files:** new `vendor/components/settings/AccountDeletionCard/{AccountDeletionCard.tsx,
useAccountDeletionCard.ts}` and `.../DeletionRequestModal/{DeletionRequestModal.tsx,
useDeletionRequestModal.ts}`; edit `vendor/components/settings/SettingsPage/SettingsPage.tsx:14-40`
**Component separation (`.claude/skills/component-separation/SKILL.md`), stated per file,
not assumed:**
- `AccountDeletionCard.tsx` — render only. No `useState`/`useEffect`/handlers; every one
  lives in `useAccountDeletionCard.ts` (fetch eligibility, open/close modal, cancel a
  pending request, toast).
- `DeletionRequestModal.tsx` — render only; scope choice, reason field, typed-confirmation
  state and submit all in `useDeletionRequestModal.ts`.
- **Styling:** Tailwind utilities on the existing `sp-*` tokens, **no CSS module** — this
  matches the deliberate, commented choice in `SecurityCard.tsx:8-11` for this exact page.
  A module here would be the odd one out on the page it sits on.
- Modal primitive follows `.plans/2026-08-15-vendor-form-modals-to-radix-dialog.md`.

**UX (`.claude/skills/ux-design/SKILL.md`) — all four states are required, not optional:**
*loading* (eligibility in flight — the card must not render an enabled destructive button
before it knows), *blocked* (each blocker named with its count and what clears it, e.g.
"3 bookings still open" — **counts only, no peso amounts**; see B3's note 1, which
supersedes the preview's "₱4,200 in payouts not yet released"), *eligible* (destructive styling, typed confirmation, scope
choice), *pending* (what was requested, when it executes, and a Cancel action). Placement:
**last card on the page, below `SecurityCard`** — the page's own comment
(`SettingsPage.tsx:16-21`) establishes that card order encodes priority, and a destructive
action outranking payout details would be wrong.

✅ **DONE (2026-08-21).** Five new files, three modified.

| File | Role |
|---|---|
| `components/settings/AccountDeletionCard/AccountDeletionCard.tsx` | Container — holds no state, renders no markup of its own |
| `components/settings/AccountDeletionCard/AccountDeletionCardBody.tsx` | **Pure.** Every state; no hooks, no data access |
| `components/settings/AccountDeletionCard/useAccountDeletionCard.ts` | All state and behaviour |
| `components/settings/DeletionRequestModal/DeletionRequestModal.tsx` | Render layer |
| `components/settings/DeletionRequestModal/useDeletionRequestModal.ts` | Scope, reason, confirmation, submit |
| *modified* `SettingsPage.tsx` · `app/ui-gallery/page.tsx` · `visual-tests/pilot.spec.ts` | Placement, fixtures, tests |

**The body is split out as a PURE child rather than living in the card**, which was not the
obvious shape. The card fetches, and `/ui-gallery` has no database, so through the card only
the loading state would ever have been photographable — the constraint already documented
for `PayoutDetailsCard` and answered there the same way. Without the split, five of the six
states would have shipped un-pixel-covered.

**Component separation, per file:** the two `.tsx` files contain no `useState`/`useEffect`,
no handler bodies and no data access; both hooks own all of it. Styling is Tailwind on
`sp-*` tokens with **no CSS module**, matching `SecurityCard.tsx:8-11`'s commented choice
for this page. `AccountDeletionCardBody` and the modal's `Column` are pure display
components (§4) and correctly have no companion hook.

**Verified — machine:** `tsc --noEmit` exit 0 · `npm test` 242/242 · `eslint` clean on every
new path · `npm run build` succeeds · service-role leak check still clean after adding client
components · **17 Playwright tests pass**, of which 14 are new light+dark baselines across all
six states plus the modal, and 3 are behavioural.

⚠️ **CORRECTION (2026-08-23) — the Stage 3 verification note here was wrong.**
It read *"Full visual suite re-run: `123 passed (6.9m)`, exit 0 … None moved."* That was
reported from a **tail of the output**: the real summary is **`29 failed / 123 passed`**, with
the "29 failed" header ~30 lines above the line that was read, and the exit code was never
captured at all. What looked like a normal tail was the *list of failing test names*.

So the claim "no existing baseline moved" was **not established** at the time, even though it
has since turned out to be true — see I17, which proves the 29 are pre-existing by
reproducing one on a clean checkout.

**The lesson, since this is the second reporting error of its kind in this plan:** read the
summary line and the exit code, never the tail. `123 passed` is not a result; `29 failed /
123 passed` is.

**The 3 behavioural tests are the ones that carry weight** — a first-run baseline records
whatever rendered, including a broken render, so it passes trivially:
- the modal will not submit until the business name is typed (and accepts it
  case/whitespace-insensitively — the point is deliberation, not transcription);
- blocked names each blocker **and how to clear it**, offers no destructive control at all,
  and asserts **no `₱` appears** — a regression guard on B3's decision to drop the amount;
- loading offers no destructive control.

**Baselines eyeballed, not just counted:** `closuremodal-light`, `closure-blocked-light` and
`closure-pendingchanged-dark` were opened and read. Dark mode holds — the amber "something
changed" callout stays legible on the translucent card surface.

**Three findings from this stage:**

1. **`react-hooks/set-state-in-effect` traces through a `useCallback`.** The obvious
   `useEffect(() => { void load() }, [load])` is rejected even though `load` sets nothing
   before its first `await`. The accepted shape is the fetch inline in the effect with a
   `.then` callback — which is exactly what `usePayoutDetailsCard` already does, for this
   reason. Recorded because the next hook that fetches on mount will hit it too.
2. **Gallery prefix bug, caught before it shipped:** `mode.startsWith("closure")` also
   matches `closuremodal`, which would have made that branch unreachable and silently
   photographed the wrong component. Now `"closure-"`.
3. **`app/ui-gallery/page.tsx` carries a pre-existing `react-hooks/static-components`
   error** — confirmed by linting the file at `git stash` baseline, where the identical
   error appears. Not introduced here, not fixed here (AGENTS.md: mention, don't silently
   fix).

**Route change this stage forced:** GET now always returns `vendorName`, not only when a
request exists. The eligible state names the business and the modal asks the vendor to type
it, and reading it server-side means what they are asked to type is the same value the
request is recorded against.

**Still not verified:** the live HTTP round-trip. Every state above is driven by fixture
props; nothing has yet exercised the route from a browser with a real session. That needs a
signed-in vendor against the local stack and is the first thing to do in Stage 4.

### B5 — Nothing executes a closure. Command execution route ✅ DONE
**Files:** new `command/app/api/account-deletion/route.ts` (+ `command/services/accountDeletion.service.ts`)
The destructive path, service-role, gated by `verifyCommandCaller()` (the existing pattern
at `command/app/api/users/route.ts:9-10`). **Order is load-bearing** — each step exists
because of a finding above:

1. **Re-compute eligibility.** Never trust `blockers` from request time; a booking can
   land during the grace window.
2. **Purge Storage first, rows second (F2).** `list` + `remove` under `vendor-kyc/{vendor_id}/`,
   paginating rather than assuming one page (I3), *then* delete `vendor_kyc_documents`.
   Reverse that order and the paths are unrecoverable.
3. **Scrub the vendor row** per D4 — the 16 named columns cleared; `name`, `division_id`,
   `created_at` and every financial/audit row retained.
4. **Vendor → `suspended`; revoke the `vendor` `user_portals` grant** for the departing
   admin(s). The revoke is what makes the vendor access gate answer `no_access` rather
   than the misleading "your vendor is suspended" (`vendor-access.service.ts:63`) — D6.
5. **Confirmation notification, then WAIT (F4).** Insert, then poll
   `notification_emails` for that `notification_id` until `status` is `sent`/`failed`
   (short timeout, then proceed and record it on the request). This table is already the
   delivery log and idempotency guard; nothing new is needed.
6. **Only now delete the auth users**, per scope, via `auth.admin.deleteUser` — the same
   call the register rollback uses (`vendor/app/api/auth/register/route.ts:167`).
7. **Mark the request** `completed` with `completed_at` + `reviewed_by`; on any failure
   after step 2, mark it `failed` with the reason rather than leaving it `pending`.

**There is no rollback past step 2**, exactly as the register route documents about its own
midpoint. Every step from 3 onward must therefore be individually idempotent so a retry
after a partial failure converges instead of double-faulting.

✅ **DONE (2026-08-21).** Four files.

| File | Role |
|---|---|
| `command/lib/accountDeletion/eligibility.ts` | **Ported copy** of the vendor rule (no-shared-code) |
| `command/lib/accountDeletion/eligibility.test.ts` | Ported suite — what pins the two copies together |
| `command/lib/accountDeletion/execute.server.ts` | The destructive sequence |
| `command/app/api/account-deletion/route.ts` | GET queue · POST execute · PATCH reject |

**The rule is duplicated, not imported.** `conventions.md` ("No Shared Code Between Apps")
forbids a shared package, so this follows the payout precedent. Verified the copy is
**byte-identical below the header comment** by diffing the two files — drift here is
uniquely expensive, because the vendor app uses the rule to decide whether to *offer* a
closure and Command uses it to decide whether to *execute* one; a laxer Command copy
destroys data the vendor app correctly refused to ask about.

**Verified — machine:** `tsc --noEmit` exit 0 · `npm test` **74/74** (13 ported) · `eslint`
clean · `npm run build` registers `ƒ /api/account-deletion` · service-role leak check clean.

**Verified — the destructive sequence run for real against the local database.** A throwaway
vendor was created with an active admin, a KYC header and **two real blobs in the
`vendor-kyc` bucket**, then every step was executed and asserted. 17 assertions, all passing,
no residue afterwards (probe vendor, probe users, requests and disputes all back to zero):

| Step | Asserted |
|---|---|
| 1 | Bucket prefix empty · document rows gone · **`vendor_kyc` header retained** (D5) |
| 2 | Scrub accepted · contact PII cleared · **business name retained** (D4) |
| 3 | `active → suspended` accepted via service_role · **`suspended → suspended` is a no-op** (idempotent) · **`vendor_status_log.changed_by` is NULL** |
| 4 | Membership removed · vendor portal grant revoked |
| 6 | Auth user deleted · **profile cascaded away** · re-delete returns `"User not found"`, matching the `/not.?found/i` guard · **the vendor row survives** |

Step 3's NULL `changed_by` is the empirical confirmation of what B6 and D10 assume: the
status log attributes the suspension to nobody, so `reviewed_by` really is the only
attribution that exists.

⚠️ **BUG FOUND AND FIXED — it would have half-executed a closure in production.**
`phone`, `email` and `operating_hours` are **`not null default ''`**
(`20260504000002_schema.sql:66-68`), but `architecture/schema.md` documented all three as
nullable. The scrub was written from the doc and set them to `null`, which raises a NOT NULL
violation **at step 2 — after step 1 has already deleted the vendor's government IDs**. The
outcome would have been a vendor whose KYC documents were destroyed and whose personal data
was untouched, with the request marked `failed`.

Neither `tsc`, `eslint`, nor `npm run build` could have caught it; only querying
`information_schema` did. **`schema.md` has been corrected** — the three rows now carry the
real constraint, and a dated correction note sits under the `vendors` table warning that
anything writing to it should check the migration until the whole table is re-verified.

**Two smaller corrections made while writing:**
- The Storage sweep's pagination used an `offset = -PAGE` trick that relied on the loop's
  increment to land back on 0. Replaced with an explicit pass-counted loop that always lists
  from 0 (correct, since each page is deleted before the next call) and refuses to spin
  forever if `remove` ever reports success without deleting.
- `supabase-js` infers a row type from a select() **string literal**; `REQUEST_COLUMNS` is a
  concatenation, so every field degraded to `GenericStringError`. A declared `QueueRow`
  interface with `.returns<T>()` fixes it and is the better shape anyway in a
  hand-written-interface repo.

⚠️ **NOT verified — step 5, the email wait.** The probe exercised steps 1–4 and 6; the
confirmation notification and the `notification_emails` poll were **not** exercised, because
that needs the Edge Function serving and a request row moving through the real route. This
is the step protecting against the silent no-email failure in F4, so it is the single most
important thing to watch on the first live run.

⚠️ **NOT verified — the route over HTTP.** No Command session has called it. `tsc` and the
build prove it compiles and is registered, not that it responds correctly.


### B6 — Command cannot see the queue ✅ DONE
**Files:** new `command/components/closures/ClosureQueue/{ClosureQueue.tsx,
useClosureQueue.ts, ClosureQueue.module.css}`; edit `command/lib/navigation.ts:11-20,37-45`,
`command/components/layout/AppShell/AppShell.tsx:18-24,97-101`, `command/services/oversight.service.ts:39-85`,
`command/components/vendors/VendorCard/VendorCard.tsx`
Mirrors `command/components/flags/FlagQueue/` — same three-file shape, same lazy import,
same `useFlagQueue`-style hook (load / open panel / submit / reload), same module-CSS
convention (Command *does* use CSS modules; the no-module note in B4 is page-local
reasoning about the vendor Settings page, not a repo rule). Top-level page, per D7.

**Placement is constrained, not free.** `lib/navigation.ts:16-18` records that the sidebar
splits `MAIN_TABS` **at index 3** into Reporting and Management — so the entry must sit
**after `users`**, beside `flags`. `KNOWN_PAGES` derives itself from `MAIN_TABS`, and that
file's own comment explains why (a hand-maintained list silently broke when `flags` and
`payouts` were added). So registering the page is: one `MAIN_TABS` entry, one `PAGE_TITLES`
entry, one lazy import, one render line — and nothing else.

**Six requirements found reviewing this item against the real Command app (2026-08-21).
Without them the queue satisfies the sentence above and is still not fit to run a closure:**

1. **Age, against the D9 promise.** Every row shows days elapsed since `created_at`, with
   visible escalation as it approaches the published 30 days. A request quietly ageing past
   Ezzy's own stated turnaround is a compliance breach, not a cosmetic lapse — and nothing
   else in the product would show it.
2. **A count on Overview.** `getOversight()` (`services/oversight.service.ts:39-85`) already
   returns `openFlagCount` for exactly this purpose; add `openClosureCount` beside it. One
   extra `head: true` count in a function that already runs. A page nobody navigates to is
   a queue nobody works.
3. **A badge on the Vendors page, not only in this queue.** D6 reuses `suspended`, so a
   closed vendor is **visually identical to one suspended for cause** on `VendorCard`. An
   admin scanning the vendor list cannot tell them apart, and could reactivate a vendor who
   asked to be closed. The badge must live on the vendor card too, sourced from the request
   row.
4. **Execute is disabled while a request is blocked**, with the live blocker named. B5 step
   1's re-check is the real guard, but discovering the block via a 400 *after* clicking a
   destructive button is the wrong order.
5. **`failed` is a first-class state.** B5 marks a partially-executed closure `failed` with
   the reason. If the queue filters to `pending` only, a half-executed closure — KYC blobs
   already purged, user not yet deleted — becomes invisible. Show it, with the recorded
   reason and a Retry (every step from B5.3 on is idempotent precisely so Retry is safe).
6. **The confirmation restates D4/D5 in full and requires typing the vendor name.** An
   admin must never have to remember from memory what is destroyed and what is kept — and
   see D10 for why a typed confirmation, not a single click, is the right weight here.

**⚠️ `reviewed_by` is the only record of who executed a closure — it is not decorative.**
The obvious audit trail is not available: `log_vendor_status_change()` writes `changed_by`
from `auth.uid()`, and B5 runs as **service role**, whose `auth.uid()` is NULL (F6). The
`vendor_status_log` row will therefore attribute the suspension to nobody — and `schema.md`
documents NULL there as *also* meaning "the profile was later deleted", so it is ambiguous
even as a signal. The execution route **must** write `reviewed_by` from `verifyCommandCaller()`,
and B6 must display it. Under D10 (any admin may execute) this is the entire accountability
story for the most destructive action in the product.

### B7 — No public deletion resource exists; the mobile link still points at the portal root ✅ DONE — **cross-plan**
**Files:** `ezzy.ph` (external, one page) · `ezzy-vendor-mobile/src/lib/constants.ts` and
`src/components/settings/SettingsList/useSettingsList.ts:44-49`
The mobile handler currently opens `WEB_PORTAL_URL` with a comment admitting the deletion
route does not exist. Three candidate URLs 404 (08-21 mobile plan B2).
**Fix approach:** publish the page (D8), then repoint the constant and drop the `hasPortal`
gate. **Coupled — must ship in the same batch as 08-21 mobile B1/B2/B3 (its Stage C),**
which that plan already refuses to split. Nothing in this plan's B1–B6 is blocked by it,
and it is not blocked by them: the page can describe the process before the portal flow
ships.

**Why the resource must be public, not the portal route alone.** A login-gated deletion
page fails exactly the population most likely to need it: a rejected-KYC applicant or a
suspended vendor — the people with the strongest reason to want their government ID out of
the `vendor-kyc` bucket (F5) — may be locked out or have lost the password. A public page
carrying the `admin@ezzy.ph` fallback covers them; a portal route cannot. It also spares a
Play reviewer from needing the demo credentials (08-16 B4) just to confirm the URL resolves.

**Content, kept deliberately thin** (the detail lives in B8, so the two cannot drift):
what is deleted, what is retained and why, how to start it (link to the portal flow **and**
`admin@ezzy.ph`), the blocking conditions in prose (a locked-out vendor never sees B4's
card, so this is their only sight of them), and the committed turnaround (D9).

✅ **THE PAGE EXISTS (verified 2026-08-23): `https://ezzy.ph/account-data-deletion/` → 200.**

⚠️ **The slug is `/account-data-deletion/`, NOT `/account-deletion/`.** This plan, and the
drafted copy, both assumed the latter — and `/account-deletion/`, `/delete-account/` and
`/data-deletion/` all still 404. Every earlier "no deletion resource exists" finding in this
plan and in the 08-21 mobile plan was **checking three slugs that were never the real one**.
Found by grepping the privacy policy's own `href`s rather than guessing again.

**Assessed against this item's stated requirements — it satisfies all of them:**

| Required | On the page |
|---|---|
| How to start it, in-app | Sign in → Settings → Close Account → choose type → confirm business name → submit |
| A route for a locked-out vendor | `admin@ezzy.ph` plus a postal address |
| What is deleted | Login credentials, contact details, addresses, **verification documents**, profile |
| What is retained and why | Financial, booking/order, tax-compliance, dispute records; Philippine law |
| The turnaround | "generally processed within 30 days" |
| Blockers in prose | Open bookings, pending payouts, active disputes, chargebacks, refunds, cancellations |

The in-app steps it describes **match the UI built in B4 exactly**, including the
type-the-business-name confirmation — so the page and the product already agree.

✅ **MOBILE REPOINT DONE (2026-08-23)** — and deliberately shipped as the **full Stage C**
the 08-21 mobile plan refuses to split (its B1 + B2 + B3), not just the deletion third.

**Why B1 came along:** mobile Settings had **no privacy-policy link at all**, and both
stores require a reachable privacy policy to accept a submission. Shipping a deletion link
without it would have left the app in the state that plan explicitly calls worse than
neither.

| File | Change |
|---|---|
| `src/lib/constants.ts` | **New unconditional constants** `PRIVACY_POLICY_URL` and `ACCOUNT_DELETION_URL`. `WEB_PORTAL_URL` now gates **only** the "open the web portal" row |
| `src/components/settings/SettingsList/useSettingsList.ts` | `openAccountDeletion` points at the real page; new `openPrivacyPolicy`; neither reads the env var |
| `src/components/settings/SettingsList/SettingsList.tsx` | Both rows rendered **ungated**; footnote corrected |

⚠️ **B3 is the one that mattered most.** Both links used to hang off
`EXPO_PUBLIC_VENDOR_PORTAL_URL`, so a production build made without it shipped with **no
privacy link and no deletion link** — the two things a store submission cannot proceed
without. A missing build variable can no longer remove them.

⚠️ **The slug is `/account-data-deletion/`.** `/account-deletion/`, `/delete-account/` and
`/data-deletion/` all still 404. All eight URLs the apps now reference were re-verified
**200 on 2026-08-23**.

**Footnote corrected:** *"Registration, document verification and account deletion are
handled on the web portal"* → registration and verification still are; deletion is on
ezzy.ph. The old sentence stopped being true the moment the page shipped.

**Verified:** `tsc` 0 · `expo lint` clean · `npm test` **141/141**.
⚠️ **Not verified on a device or simulator** — no build was produced, so this is
type-and-lint verification only. Per the mobile skill's §4, that is an incomplete
verification and the links need tapping on real hardware before submission.

### I14 — In-app wording contradicted the published policy ✅ DONE
**Found 2026-08-23** by diffing every user-facing string in `vendor` and `command` against
`https://ezzy.ph/legal-policies/`, `/privacy-policy/` and `/account-data-deletion/`. Four
mismatches, all now fixed; the audit is recorded because "we checked once" is not a state
anyone can verify later.

| # | Where | Was | Why it was wrong |
|---|---|---|---|
| 1 | `command/lib/accountDeletion/execute.server.ts` — **confirmation email** | *"…record of bookings and payments… **Nothing else remains.**"* | **Flatly false.** ezzy.ph retains payouts, platform fees, transaction, tax/accounting and dispute records; and this very file keeps the `vendor_kyc` header (D5) while `account_deletion_requests` keeps the requester's name and email. Overstating deletion in the *deletion confirmation* is the worst place to do it |
| 2 | `vendor/app/api/account-deletion/route.ts` — **acknowledgement email** | *"you have 7 days to change your mind"* | Understated the vendor's rights. The route cancels on `status = 'pending'` — until Command executes — and ezzy.ph publishes *"at any time before it is completed"* |
| 3 | `vendor/components/settings/AccountDeletionCard/AccountDeletionCardBody.tsx` | *"Cancel any time in the first 7"* | Same understatement, on the card. Fixed 2026-08-23; the now-unused `gracePeriodDays` prop was removed with it |
| 4 | `vendor/components/settings/DeletionRequestModal/DeletionRequestModal.tsx` — **KEPT column** | *"Required by BIR record-keeping, and to settle any later dispute"* as a list item | A **reason masquerading as a retained item**, which left payouts, platform fees and the closure record undisclosed on the one screen a vendor reads before consenting — the screen this plan itself calls legally load-bearing |

**Also corrected:** `vendor/lib/accountDeletion/policy.ts:9` pointed at
`https://ezzy.ph/account-deletion/`, a slug that has never existed.

**Checked and found consistent:** the two published numbers (7-day start, 30-day
completion) across `policy.ts`, both emails, the card, Command's queue and the Overview
card; the DELETED lists in both apps; the scope labels, which match ezzy.ph's wording
verbatim; and Command's admin-facing KEPT list, which already named the KYC header.

**Verified:** `tsc` 0 both apps · `npm test` 242/242 and 74/74 · `eslint` clean · the stale
`closure-eligible` and `closuremodal` baselines re-recorded (2026-08-23).

### I16 — The acknowledgement email promised a start date nothing enforces ✅ DONE
**Found 2026-08-23** while deriving the website corrections. `scheduled_for` is set to
`created_at + 7 days` and the acknowledgement email tells the vendor *"we'll begin on
{date}"* — but `scheduled_for` is **advisory**. Command executes manually and nothing in
`command/app/api/account-deletion/route.ts` refuses an execution before that date, so an
admin can close on day 1 and the vendor was told otherwise.

Not caught by I14's audit because that compared the app against `ezzy.ph`, and `ezzy.ph`
says nothing about a start date — the promise contradicts **the system**, not the site.

**Decision (2026-08-23): option 1 — drop the start date, publish nothing.** The alternative
(enforcing `scheduled_for` in the execution route) was available and not taken; the promise
was removed rather than made real, which keeps `scheduled_for` advisory and Command free to
execute when it can.

✅ **DONE (2026-08-23).** Applied in **three** places, not one — the same unenforced date
appeared in each, and softening only the email would have left the promise in the more
prominent place:

| Where | Change |
|---|---|
| `vendor/app/api/account-deletion/route.ts` — ack email | Dropped *"we'll begin on {date}"*. Only the 30-day completion figure is committed to now, and that one is published on ezzy.ph and really is enforced by the queue's ageing display |
| `AccountDeletionCardBody.tsx` — pending state | Removed the **"Starts"** row, which showed the same advisory `scheduled_for` to the vendor |
| same file — pending copy | *"keep using Ezzy **until then**"* → *"in the meantime"*. "Then" referred to the row just removed, so it had become a dangling reference |

`scheduled_for` is still written and still shown **to Command** in the Closures queue as
"due to start" — internally it is a schedule, and that is what the queue calls it. Only the
vendor-facing promise is gone.

**Verified:** `tsc` exit 0 · `eslint` clean · no `until then` references remain · the four
affected pixel baselines (`closure-pending`, `closure-pendingchanged`, light and dark)
re-recorded, `17 passed`.

**Consequence for the website:** W5 in
`.plans/2026-08-21-account-deletion-web-copy.md` is resolved with **no publication needed** —
the site's silence on a start date is now correct rather than merely harmless. Four website
edits remain: W1–W4.

### I17 — 29 pre-existing failures in the vendor visual suite ⬜ TODO — **pre-existing**
**Found 2026-08-23** while re-verifying after the I14/I16 copy changes. `npx playwright test`
in `vendor` reports **`29 failed / 123 passed`**, exit 1.

**Failing:** `ui-gallery sidebar` (light + dark), the entire `login-*` group (10 tests),
`login-mobile-info`, and all 12 `payout details` tests. **No closure test fails** — all 17
added by this plan pass.

**Proven pre-existing, not inferred.** With every tracked vendor change from this plan
stashed (`app/ui-gallery/page.tsx`, `visual-tests/pilot.spec.ts`,
`components/settings/SettingsPage/SettingsPage.tsx`), `-g "ui-gallery sidebar"` fails with
the **identical 260-pixel diff** (and 269 on dark). Working tree restored afterwards; stash
empty.

**Symptoms, cause not yet diagnosed:** small diffs (260/269 px, ratio 0.01 — drift, not a
broken render) plus repeated React **hydration mismatches** in the dev-server log
(*"server rendered text didn't match the client"*) on `DashboardSection`.

**Worth checking first:** `pilot.spec.ts`'s own header documents that `page.clock` patches
**only the browser, not the Next server**, and that baselines expiring as the real date
advances has already bitten this repo twice (the `dashboard`/`bookings` rollover, and the
`calendar` month). Today crossed into 2026-08-23. That makes date drift the leading
hypothesis — but it is a hypothesis, and the 260px sidebar diff is not obviously date-shaped,
so it needs diagnosing rather than assuming.

Not caused by this plan and not fixed in it. Related to I11 (`command` has no visual suite at
all): between them, the two apps' visual coverage needs its own plan.

### I15 — The legal menus are missing two policies ✅ DONE
`ezzy.ph/legal-policies/` now publishes **seven** documents; `vendor/lib/legal.ts:32-36` and
`command/lib/legal.ts:34-38` list **five**. Missing: **Account & Data Deletion** and
**Payments Policy**. Not a contradiction, but the deletion page is the one B7 wants
discoverable and the in-app legal menu does not offer it.

⚠️ **Do not add them to the consent set.** `legal_acceptances.document_key` is
`check (document_key in ('terms','privacy','acceptable','refunds','cookies'))`
(`20260819000001:48-49`). Consent is driven by `CONSENT_KEYS`, not by `LEGAL_LINKS`, so
adding display entries is safe **only** while `CONSENT_KEYS` stays at those five — adding a
sixth consent document needs a migration first.
Touches both web apps, so it carries the cross-app gate.

✅ **DONE (2026-08-23).** `deletion` and `payments` added to `LEGAL_LINKS` in **both**
`vendor/lib/legal.ts` and `command/lib/legal.ts`, with a header note on each explaining why
they must never reach `CONSENT_KEYS`.

**The constraint held and is now documented in the code**: `CONSENT_KEYS` in `vendor` is
`["terms","privacy","acceptable","refunds"]` — **four** keys, already shorter than the
display list, because Cookie Policy is disclosed rather than agreed to. The two new entries
follow `cookies` exactly. `command/lib/legal.ts` has no `CONSENT_KEYS` at all. Putting either
into the consent set without a migration would fail every registration on the CHECK.

⚠️ **Slug trap, caught by checking rather than guessing:** the payments policy is at
**`/payment-policy/`** (singular). `/payments-policy/` 404s.

**Verified:** `tsc` 0 both apps · `npm test` 248/248 and 74/74 · `eslint` clean · both builds
succeed · **all eight URLs return 200**.

⚠️ **Pixel baselines deliberately NOT re-recorded.** `LegalLinks` renders `ALL_LEGAL_LINKS`
in the login footer, so all 13 `login-*` baselines are affected — and those are **exactly
the ones already failing under I17**. Re-recording now would bake an undiagnosed drift into
the baselines alongside this deliberate change, destroying the evidence I17 needs. They must
be re-recorded **after** I17 is diagnosed, not before. (`legal` mode itself has no baseline.)

### W1–W4 — published-text corrections ✅ DONE (2026-08-25)
The four content corrections identified in I14's audit have been **made by the user on
`ezzy.ph` and verified live on 2026-08-25**. Detail and the exact copy live in
`.plans/2026-08-21-account-deletion-web-copy.md`.

| | What | Where | Verified |
|---|---|---|---|
| **W1a** | Blocker list cut from 10 conditions to the 3 the code actually checks | §15 | ✅ |
| **W1b** | Same list, second copy | §3 | ✅ |
| **W1c** | "Resolve any outstanding … refunds, or cancellations" → drops refunds and cancellations | §14 | ✅ |
| **W2a** | Third closure option "My Login Only" added | §1 | ✅ |
| **W2b** | Third outcome "My Login Only" added | §16 | ✅ |
| **W3** | Three retained categories added — verification record, closure record with requester identity, and consent record **including IP address and device information** | §2 | ✅ |
| **W4a** | Verification documents: "may be removed" → definite deletion | §9 | ✅ |
| **W4b** | ✖ **WITHDRAWN** — "Information That May Be Deleted" correctly left alone | §2 | n/a |
| **W5** | ✖ **No edit needed** — resolved by I16 removing the start-date promise from the email | — | n/a |

**Two of my own suggestions were wrong and were corrected before publication**, both caught
by re-checking against the code rather than by review:
- **W1's first bullet** originally read *"not yet completed or cancelled"* — **incomplete**,
  because `refunded` is a **third** terminal state that does not block. It would have told a
  vendor a refunded booking was holding up their closure. Final wording names all three.
- **W4b** would have renamed §2's heading to "Information We Delete". Wrong: `deletesUser`
  is false for `vendor_only`, so the login is **not** deleted in that scope. "May" is doing
  real work on that heading.

⚠️ **One process note worth keeping:** an intermediate check reported §3 as unchanged when it
had in fact already been edited — `WebFetch` caches per URL for 15 minutes and was serving
the pre-edit page. Subsequent checks used a cache-busting query string. **Any future
verification of a page edited minutes earlier must bust the cache**, or it will confidently
report stale content.

The capitalisation tidy on §16's "My Login Only" was made by the user after this check and is
reported, not independently verified.

**The published text and the code now agree.** No known contradiction remains between
`ezzy.ph`, the vendor portal, the Command queue, the acknowledgement and confirmation
emails, and the dashboard guide.

### Still worth adding to the published text (not blockers)
- **Retained requester identity.** `legal_acceptances` keeps the **email address** that
  accepted, and `account_deletion_requests` keeps the requester's **name and email** as
  snapshots. Neither is obviously covered by the live retention list, and both are personal
  data surviving a deletion.
- **KYC wording is softer than reality.** The page says documents "*may* be removed"; the
  code deletes every blob and row, keeping only the `vendor_kyc` header. Promising less than
  we do is safe, but vague for a reader.

**Third mobile edit, easy to miss:** the footnote at
`ezzy-vendor-mobile/src/components/settings/SettingsList/SettingsList.tsx:166-169` reads
*"Registration, document verification and account deletion are handled on the web portal."*
After this item deletion is handled on **ezzy.ph**, not the portal — so the sentence is
wrong, not merely stale. Three edits ship together: the URL constant, the `hasPortal` gate,
and this footnote.

### B8 — Retention is not disclosed anywhere, which is what makes the retention lawful ✅ DONE
**Files:** `ezzy.ph` privacy policy (external)

**Verified live 2026-08-21, not taken from the 08-21 mobile plan's summary.** The policy
asserts the right and nothing else:
- §7 Your Privacy Rights — *"Request deletion of your account where legally permitted."*
  *"Requests may be submitted using the contact information provided below."*
- §5 Data Retention — *"When information is no longer required, we will securely delete,
  anonymize, or dispose of it where reasonably practicable."*
- §14 Contact Us — `admin@ezzy.ph` is the only route offered.

Three gaps, and they are separate: **no procedure**, **no statement of what survives a
deletion or for how long** — "where reasonably practicable" and "where legally permitted"
are hedges, not disclosures — and **no turnaround**.

Play permits retention for regulatory compliance **only where it is disclosed**, and the
PH DPA's refusal grounds must be stated to be relied on. The section must name: user
account and login destroyed; KYC documents destroyed; business identity and transaction
records retained under BIR record-keeping and for the establishment or defence of legal
claims; `legal_acceptances` retained with the user link severed (`schema.md` already
carries that justification verbatim — reuse the wording); the retention period; and the
committed turnaround (D9), stated identically here, in B7's page and in B2's email copy.

**Without B8, B5 is a policy violation rather than a compliant closure.**

✅ **DONE (2026-08-23)** — **already live, and not by this plan's drafted copy.**
`https://ezzy.ph/privacy-policy/` now carries **§12 Data Retention** and **§13 Account &
Business Closure**, which between them disclose: both closure scopes in the same wording the
portal uses, the **30-day** processing commitment, and an enumerated retained list — BIR/tax
and accounting records, bookings, payments, transactions, payouts, and Platform Service Fee
records. That is the disclosure this item existed to obtain.

**Checked on the page the apps actually link to**, not just the combined `/legal-policies/`
hub — `vendor/lib/legal.ts:32` points at `/privacy-policy/`, so a disclosure living only on
the hub would not have counted. It is on both.

`.plans/2026-08-21-account-deletion-web-copy.md` has been **rewritten (2026-08-23)** from a
draft of replacement copy into the **list of corrections the live site needs** — W1–W5,
each traced to a file. The original draft is obsolete; the published text is better than it
was.

**Two retained categories the draft names that an earlier reading of this item missed:**
`legal_acceptances` keeps the **email address** that accepted (not just a severed link), and
`account_deletion_requests` keeps the requester's **name and email** as snapshots. Both are
personal data surviving a deletion, and both are exactly the records someone would be
surprised to find still exist — a disclosure that omitted them would be incomplete in the
way that matters.

> **B7 and B8 are different obligations and neither substitutes for the other.** B8 is the
> *disclosure* that makes retention lawful. B7 is the *resource* whose URL goes in Play's
> Data safety form — which the 08-21 mobile plan already flagged should not be a policy
> page. Doing only B8 leaves the Data safety field pointing at a policy; doing only B7
> leaves the retention undisclosed. B7 may be thin precisely because B8 carries the detail.

✅ **DONE (2026-08-21)** — built, type-clean, and **rendered in a browser and looked at**
(`vendors` light + dark, `closures`, `overview` via a throwaway Playwright spec, removed
after).

| File | Role |
|---|---|
| `components/closures/ClosureQueue/{ClosureQueue.tsx, useClosureQueue.ts, ClosureQueue.module.css}` | The queue |
| `components/overview/ClosureRequestsCard/{...tsx, use...ts, ...module.css}` | Overview surface |
| `services/accountDeletion.service.ts` | Queue read, summary read, execute, reject |
| *modified* `lib/navigation.ts` · `AppShell.tsx` · `OverviewPage.tsx` · `VendorCard.tsx` + its CSS · `lib/types.ts` · `services/vendors.service.ts` · `app/ui-gallery/page.tsx` | Registration, badge, fixtures |

**All six requirements addressed, one of them differently from the plan:**
1. **Ageing** — every row shows its age, escalating at 21 days and calling out anything past
   the published 30 as *"PAST the 30-day promise"*.
2. **Overview** — ⚠️ **not** a fourth stat on `FulfilmentOversightCard` as the plan
   suggested. That card is explicitly about bookings and rentals, and a closure is neither;
   adding it there is a category error. A **dedicated `ClosureRequestsCard`** carries the
   count *and* the age of the oldest request against the published turnaround, which is
   what earns it the space. **A nav badge was the other candidate and was rejected**: the
   sidebar and tab bar are shared by every page, so decorating them risks every screen for
   a number that belongs on the landing page anyway.
3. **Vendors badge** — `Vendor.closedOnRequest`, sourced by embedding
   `account_deletion_requests(status)` in the vendors query and counting only `completed`
   rows (a pending request has closed nothing; a cancelled one never will). Rendered as a
   slate chip *beside* `StatusBadge`, not instead of it — the lifecycle state really is
   `suspended`, and hiding that would be a second lie. Gallery fixture `v3` is now
   suspended **and** closed-on-request, so the two states sit in one screenshot.
4. **Execute disabled while blocked**, with the live blockers listed above the button.
5. **`failed` is first-class** — the queue reads `pending` *and* `failed`, shows the recorded
   failure stage, and offers "Retry closure" (safe: every step from the KYC purge on is
   idempotent).
6. **Consequences restated at the point of action**, plus the typed vendor name.

**Verified — machine:** `tsc --noEmit` exit 0 (both apps) · `npm test` 74/74 · `eslint`
clean · `npm run build` succeeds · service-role leak check clean.

⚠️ **`command` has NO visual baseline suite** — only `seo.spec.ts`. Discovered while
checking whether the new nav tab and the `VendorCard` chip would move existing snapshots:
they cannot, because there are none. Two consequences, both recorded rather than papered
over: this change was free of regression risk, and the new UI has **no pixel coverage**.
A `closures` gallery mode was added for inspection, but it reaches only the loading/error
shell — the queue fetches through a route that 403s without a Command session, the same
constraint that shaped the vendor card. Splitting a pure child (the vendor app's answer)
buys nothing here until command has a spec to feed. **Logged as I11.**

**What the screenshots actually showed:** the closed-on-request chip renders beside the red
`Suspended` badge on the fixture vendor and is plainly distinguishable from the three
`pending_activation` cards around it — requirement 3 satisfied. The Overview card sits
directly under Fulfilment oversight and reads *"Account closures"*, loading-gated in the
gallery exactly as its neighbour is. **And it exposed I12 below**, which no amount of
type-checking would have shown.

---

## IMPORTANT

### I1 — A sole vendor-admin deleting only their user orphans the business ✅ DONE
There is no handover UI (F9), so `scope = 'user_only'` from the only `vendor-admin` leaves
a vendor nobody can administer, nobody can be notified about, and whose bookings still
run. **Offer `user_only` only when another active `vendor-admin` exists at that vendor**;
otherwise the UI explains that closing the login means closing the business, and offers
`vendor_and_user`. Enforced in B3's route, not only in B4's UI.

✅ **DONE (2026-08-21)** — `checkScope()` in `vendor/lib/accountDeletion/eligibility.ts` refuses `user_only` when `otherAdminsAtVendor < 1` and suggests `vendor_and_user`. Enforced in **B3's route**, not only in B4's UI, and the route also filters `allowedScopes` so the modal never offers an option the route would refuse. **Unit-tested** (`the sole vendor-admin may not delete only their login`, and its counterpart once a co-admin exists).
### I2 — A user who administers two vendors must not be deleted by closing one ✅ DONE
`vendor_and_user` must refuse when `vendor_members` shows the requester as `vendor-admin`
at any other vendor — deleting the login would strand the second business. Downgrade the
request to `vendor_only` with an explicit message naming the other vendor.

✅ **DONE (2026-08-21)** — same function: `vendor_and_user` is refused when `otherVendorsAdministered > 0`, suggesting `vendor_only`. `fetchScopeContext()` counts only **active** `vendor-admin` rows — a suspended co-admin cannot sign in, so counting one would hand the business to somebody who cannot run it. **Unit-tested.**
### I3 — Storage purge must paginate ✅ DONE
`storage.list()` takes a `limit` and the register route passes `{ limit: 100 }`
(`route.ts:54`). Document counts are bounded by `MAX_DOC_COUNT` per packet, but a
resubmitted packet can leave more objects under the prefix than one page holds. Loop until
a short page returns; a silent truncation here leaves IDs in the bucket (F2).

✅ **DONE (2026-08-21)** — `purgeKycDocuments()` removes the recorded paths, then sweeps the whole `{vendor_id}/` prefix a page at a time, always listing from offset 0 because each page is deleted before the next call. A pass counter bounds the loop so it terminates even if `remove` ever reports success without deleting. **Exercised against the local database** with two real blobs: bucket prefix empty afterwards.
### I18 — The Getting Started guide never mentioned closing an account ✅ DONE
**Requested by the user, 2026-08-23.** The dashboard's Getting Started modal documents seven
areas of the portal and said nothing about the one destructive thing a vendor can do. A
vendor looking for how to leave had no in-app explanation at all.

**File:** `vendor/components/dashboard/GuideModal/guideItems.ts` (+ the tab-count assertion
in `visual-tests/pilot.spec.ts`).

⚠️ **That file's own header makes this stricter than it looks:** *"THIS IS DOCUMENTATION,
AND IT IS TESTED AS SUCH … when the UI changes, change this in the same commit."* It also
records that the previous version had drifted into describing features that did not exist.
So every claim in the new section is written against the shipped behaviour, not the plan:

| Guide claim | Backed by |
|---|---|
| Settings → Close account, at the bottom | `SettingsPage.tsx` renders it last, deliberately |
| Pick what to close | B4's scope radios, filtered server-side by I1/I2 |
| Confirm by typing your business name | `useDeletionRequestModal`, case/whitespace-insensitive |
| Cancel any time before it completes | The DELETE route matches `status = 'pending'` — matches ezzy.ph's wording (I14/I16) |
| Within 30 days | `TURNAROUND_DAYS` |
| Three blockers, with what clears each | `evaluateEligibility` + `BLOCKER_COPY` |
| "My login only" offered only when another admin exists | `checkScope`'s `sole_admin` rule |
| What is deleted vs kept | D4/D5, matching the modal's own two columns |

**Two constraints the file imposes, both respected:** `tabLabel` must be **one word**
("Closing") because the strip scrolls sideways and a long label pushes the others
off-screen; and the colour is **slate `#64748b`**, not red — the other seven are brand tones
and a red tab here would read as a warning about the guide rather than a calm description of
something a vendor is entitled to do.

⚠️ **`pilot.spec.ts` asserted exactly 7 tabs** and would have failed on the 8th. Updated to
8 **and left exact** rather than loosened to `toBeGreaterThan`: a loose assertion would let a
whole section be silently dropped, which is precisely the drift that file warns about.

✅ **DONE (2026-08-23).** `tsc` 0 · `npm test` 248/248 · **`-g "guide"` 3 passed**, including
the behavioural test that now asserts 8 tabs, focus containment and arrow-key navigation ·
`guide-light` / `guide-dark` baselines re-recorded (both were **passing** before this change,
unlike the `login-*` set — so re-recording them mixes in no undiagnosed drift).

The one remaining lint error under `GuideModal/` is in **`useGuideModal.ts:72`**
(`react-hooks/set-state-in-effect`) — a file this change never touched (`git status` shows
only `guideItems.ts` modified). Pre-existing, same rule already recorded in B4's findings.

### I4 — The other vendor-admins learn nothing ✅ DONE
A multi-admin vendor's co-administrators should be notified when closure is requested and
when it executes — they are being logged out of a business they run. Reuse the fan-out in
`command/services/kyc-admin.service.ts:128-140` (every `vendor-admin`, not just one), but
from a service-role route (F3).

✅ **DONE (2026-08-23).** Both moments covered, from service-role routes.

| Where | Change |
|---|---|
| `vendor/app/api/account-deletion/route.ts` | `notifyCoAdmins()` — *"{vendor} is scheduled to close"*, naming the start date and that **any** administrator can cancel it |
| `command/lib/accountDeletion/execute.server.ts` | `fetchCoAdminIds()` + `notifyCoAdminsOfCompletion()` — *"{vendor} has closed"*, with the retention link and a note that their own login is unaffected |

⚠️ **ORDERING TRAP, and it would have silently broken this.** `revokeMemberships` (step 4)
**deletes every `vendor_members` row for the vendor**. Reading co-admins after it returns an
empty list — so the one group actually losing access would have been the only group never
told. They are now captured at the very top of `executeClosure`, before the purge, and
notified after the confirmation.

**Two scoping decisions:**
- **Nothing is sent for `user_only`.** That scope deletes the requester's own login and
  leaves the business trading, so telling co-administrators "this business is closing" would
  be flatly untrue.
- **All vendor-admins, not only active ones.** `fetchScopeContext` counts only active
  co-admins because it answers a different question ("can anyone take over?"). Being told a
  business you administer has closed should not depend on your own account status, and a
  second definition of "co-admin" is how the two drift apart.

**Reuses the existing notification types** (`account_deletion_requested` /
`account_deletion_completed`) rather than adding two more: same event, different audience
and wording. New types would have meant another migration and another approval gate for no
behavioural gain.

**The completion notice is deliberately NOT waited on.** Only the requester's notification
races the auth delete (F4); a co-admin's account is not being deleted, so there is nothing
to lose by letting it settle asynchronously.

**Verified:** `tsc` 0 both apps · `npm test` 248/248 and 74/74 · `eslint` clean · both builds
succeed. ⚠️ **Not verified live** — no co-admin fixture exists, and like the rest of the
notification path this needs a running stack to prove delivery.

### I5 — `command`'s KYC vendor notifications have never sent ⬜ TODO — **pre-existing, reported not fixed**
See F3. `command/services/kyc-admin.service.ts:145` writes `notifications` with the
browser client, which has no INSERT grant, and the error is swallowed because it is
returned rather than thrown. Fix is a small service-role route mirroring
`command/app/api/users/route.ts`. **Out of this plan's scope** (AGENTS.md: mention, do not
silently fix) — but it is the same defect class B3/B5 must avoid, and it means the KYC
rejection email a closing vendor might expect has never arrived either.

### I6 — Access during the grace window, and the wasted-week problem ✅ DONE
The portal stays fully usable while a request is `pending` — the vendor must be able to
cancel, and Play's "no freezing instead of deleting" rule makes a soft-lock the wrong
instinct. New bookings taken during the window are caught by B5 step 1's re-check, which
blocks the request rather than executing a closure over live work.

**Found during the journey review (2026-08-21): that re-check, on its own, produces a bad
experience.** A booking taken on day 3 silently invalidates the closure, and the vendor
finds out on day 7 — having waited a week for a "no". They then start again from zero.

**Fix approach:** the pending-state card re-queries the **same** eligibility endpoint
(B3's `GET`) on mount and on focus, and surfaces a warning the moment a new blocker
appears — *"A new booking was made on 24 Aug. Your closure will not proceed until it is
completed or cancelled."* No new endpoint, no new query, no polling loop: it is the call
the card already makes. The acknowledgement email (B2) carries the same warning up front —
*"avoid taking new bookings during this period"* — so the vendor can prevent it rather
than only be told about it.

**Deliberately not doing:** auto-deactivating the vendor's offerings on request. It would
prevent the problem outright, but it is a silent, unrequested change to their live listings
and edges toward the freeze Play forbids. Warning is proportionate; disabling is not.

✅ **DONE (2026-08-21)** — the portal stays fully usable while a request is pending, and `useAccountDeletionCard` re-queries the **same** eligibility endpoint on window focus (no new endpoint, no poll). A new blocker surfaces immediately as *"Something changed since you asked"*, and B2's acknowledgement email carries the same warning up front. **Pixel-covered** in light and dark as `closure-pendingchanged`. Auto-deactivating offerings was considered and rejected — a silent change to live listings, edging toward the freeze Play forbids.
### I7 — One open request per vendor ✅ DONE
Enforced by B1's partial unique index, surfaced by B3's route as a clean 409 rather than a
raw `23505`. Matches how `booking_disputes` refuses a second open flag.

✅ **DONE (2026-08-21)** — enforced by `account_deletion_requests_one_open_idx` and mapped to a clean 409 in B3's route rather than a raw `23505`. **Verified on the local database**: a second `pending` request for one vendor is refused (T6), and allowed once the first is cancelled (T7).
### I8 — The end of the journey has wrong copy, and on one surface none at all ✅ DONE
**Files:** `vendor/components/auth/LoginPage/useLoginPage.ts:236`,
`vendor/components/layout/AppShell/useAppShell.ts:224-229`
**Found during the journey review (2026-08-21).** After a `vendor_only` closure the login
survives with the `vendor` portal grant revoked (D6) — and the app has **two** paths for
that state, both wrong for this cause:

- **Fresh sign-in** → `"Your account has no vendor access. Contact support."` The vendor
  closed the account themselves. Inviting a support ticket for a thing that worked exactly
  as designed generates the very contact this feature exists to avoid.
- **Session restore** (an already-open tab, refreshed) → a **silent `signOut()` with no
  message at all**. The comment there explains why the session is cleared, which is right;
  what is missing is telling the person why they were ejected.

**Fix approach:** the closure is the one case where the app *knows* the reason, because
`account_deletion_requests` retains a row readable by the requester (B1's "requesters read
own deletion requests" policy exists precisely so this survives the membership being
revoked). Both surfaces resolve that row and say so — *"This business account was closed on
24 Aug at your request. Your Ezzy login is still active."* — falling back to the existing
generic copy when no such row exists. **Do not widen the generic message to cover both
cases**; a vendor whose access was revoked for cause and one who left voluntarily must not
read the same sentence.

✅ **DONE (2026-08-23).** Both surfaces now resolve the closure row and say what happened,
falling back to the existing generic copy when there is none.

| File | Change |
|---|---|
| `lib/accountDeletion/closureNotice.ts` | **New, pure.** `closureNoticeMessage()` — one definition, so the two surfaces cannot describe the same event differently |
| `lib/accountDeletion/closureNotice.test.ts` | **New.** 6 tests |
| `services/accountDeletion.service.ts` | `getOwnClosureNotice()` — reads via RLS, re-exports the message |
| `useLoginPage.ts` | Fresh sign-in path: closure message instead of *"Contact support"* |
| `useAppShell.ts` | Session-restore path: the silent sign-out now carries a reason |
| `LoginPage.tsx` + `AppShell.tsx` | `initialError` threads the notice across the sign-out |

⚠️ **The lookup MUST happen before `signOut()`, and that shaped the design.** The row is
readable only through RLS on `requested_by = auth.uid()`; once the session is gone there is
no uid, the policy matches nothing, and the answer is silently `null`. So the login screen
cannot look it up for itself — both callers resolve it while still signed in and hand the
message across as a prop. B1's `requested_by` policy (deliberately **not** vendor-scoped)
is what makes this possible at all, and Stage 1's test **T9** already proved it survives the
membership being revoked.

**Only `vendor_only` reaches this.** For `vendor_and_user` the login is deleted, so sign-in
simply fails — no message needed, and the pure module refuses to promise a working login
for any scope but `vendor_only`.

### The test that failed for a useful reason
The first version of `closureNotice.test.ts` pinned the exact date string and **failed**:
`toLocaleDateString("en-PH", …)` is rendered from the runtime's ICU data, and **Node
produces "August 29, 2026" where the browser produces "29 August 2026"**. The vendor reads
the browser's output, so the assertion was testing something no user ever sees — and would
have broken again on a Node upgrade. Rewritten to pin what is runtime-independent and
actually matters: the correct **day number** (which is the timezone bug), the year, the
business name, the scope branch, and the absence of `Invalid Date`. Recorded in the file so
nobody re-tightens it.

### I9 — A live session outlives the deletion ✅ DONE
**Files:** `command/app/api/account-deletion/route.ts` (B5 step 6), `vendor/components/layout/AppShell/useAppShell.ts`
`auth.admin.deleteUser` invalidates refresh tokens, but an **access JWT already issued
stays valid until it expires**. A vendor with the portal open at the moment Command
executes keeps a shell that renders while every query behind it returns nothing — profile
lookups empty, RLS matching no rows. That is a broken application, not a closed account,
and it is the last impression the product leaves.
**Fix approach — CORRECTED 2026-08-23 after reading the code.** The original approach here
("teach the access re-check to treat no-profile as terminal") was **already true**:
`verifyVendorAccess` returns `pending_profile` when the profile row is gone, and the shell
signs out on it. So the refresh/restore path was never broken.

The real gap was narrower: **nothing re-checks while a tab stays open**. And the fix is
smaller and better than the one first proposed — `useAppShell` was **already subscribed** to
`onAuthStateChange` and handled only `PASSWORD_RECOVERY`.

✅ **DONE (2026-08-23).** `useAppShell.ts` now also handles **`SIGNED_OUT`**, which is what
supabase-js emits when the pre-expiry token refresh fails — exactly what
`auth.admin.deleteUser` causes, since it invalidates refresh tokens while leaving the
already-issued access JWT valid. No poll, no new subscription, one branch on an event the
app was already receiving.

⚠️ **The message here is deliberately generic** (*"Your session has ended."*). By the time
this fires the session is gone, so the closure row is unreadable. The specific
"closed at your request" copy is I8's, on the **next sign-in** — which is the right place:
a `vendor_only` survivor signs in and is told exactly what happened, and a fully deleted
account simply fails to authenticate. The two items hand off to each other rather than
duplicating the lookup.

Also closes the identical hole for **Command-initiated user deletion**, which is not part of
this feature but fails the same way.

⚠️ **NOT verified — needs a live environment.** `tsc`, lint, tests and the build all pass,
but none of them can prove a JWT refresh failure produces `SIGNED_OUT` in this app. That
needs a running stack and a genuinely deleted user, and it belongs with the live end-to-end
run alongside B5 step 5.

### I12 — A closed vendor can still be reinstated with one click ✅ DONE
**Found 2026-08-21 by looking at the rendered Vendors page**, not by reading the code.
The `closedOnRequest` chip (B6.3) makes a closure *visible*, but the card's primary action
for a suspended vendor is still **"Reinstate"**, sitting immediately below the chip that
says the owner asked to be closed.
Reinstating one is not merely undesirable, it produces something **broken**: for
`vendor_and_user` the owner's login has been deleted, so reinstatement yields a live vendor
that nobody can sign in to manage, whose contact details have been scrubbed and whose KYC
documents are gone.
**Fix approach:** either suppress the reinstate action when `closedOnRequest`, or route it
through a confirmation naming the closure and what reinstating will and will not restore.

✅ **DONE (2026-08-21).** Took the second option — **inform, do not block.** Suppressing the
action would remove Command's only way to undo a closure recorded in error, and this app's
existing precedent (`VendorActivateConfirmModal`: *"This informs; it does not block"*) is
the right one to follow.

| File | Change |
|---|---|
| `components/vendors/VendorReinstateClosedModal/VendorReinstateClosedModal.tsx` | **New.** Pure thin wrapper over `DeleteConfirmModal`, matching the other two vendor confirmations |
| `components/vendors/VendorsPage/useVendors.ts` | `reinstateConf` state, a closure branch in `toggleStatus`, `confirmReinstate` |
| `components/vendors/VendorsPage/VendorsPage.tsx` | Renders it |
| `services/vendors.service.ts` | **Second bug fixed — see below** |
| `visual-tests/closures.spec.ts` | **New.** Two behavioural regression tests |

**Why the KYC confirmation never caught this**, which is the part worth remembering:
`toggleStatus` asked for a confirmation only when the packet was *unapproved* — and a vendor
that closed had almost certainly traded, so its packet **is** approved. The branch never
fired. The closure check therefore runs **first and wins outright**; the two warnings are
not additive, because *"their packet was rejected"* is advisory while *"reinstating produces
an account nobody can log into"* is a consequence, and sequencing them would bury the second.

**A separate component, not a third branch inside `VendorActivateConfirmModal`:** the
warnings are materially different in kind, and the action word differs ("Reinstate" vs
"Activate").

⚠️ **SECOND BUG, found while writing this and caused by B6 itself.** `toClosedOnRequest`
counted any `completed` request — including **`user_only`**, which deletes the requester's
*login* and deliberately leaves the vendor trading. A completed `user_only` request would
therefore have badged a live vendor as closed **and** put this new confirmation in front of
an ordinary reinstate. Fixed by embedding `scope` alongside `status` and excluding
`user_only`. The badge shipped wrong in B6 and was wrong for about an hour.

**Verified:** `tsc` exit 0 · `npm test` 74/74 · `eslint` clean on the changed paths (the 3
`no-explicit-any` errors in `vendors.service.ts` are **pre-existing** — confirmed by linting
the file at `git stash` baseline, where the identical three appear at the pre-insertion line
numbers).

**Both behavioural tests pass** (`2 passed`) — but only after two false diagnoses that are
worth recording, because both cost real time and both were MY tests being wrong rather than
the code:

1. The tests first failed with no modal appearing at all. That was genuine — but the cause
   was the **fixture**, not this fix (see I13). The pre-existing *delete* modal failed
   identically, which is what isolated it.
2. After fixing the fixture, a probe still reported reinstate failing. That probe clicked
   immediately after `page.reload()`, so the button was not yet hydrated. Instrumenting
   `toggleStatus` showed the branch firing correctly with
   `{isActivation:true, closedOnRequest:true}` and the modal rendering.
3. The final failure was `getByText(/closed/i).toHaveCount(0)` matching the *other* vendor's
   "Closed at owner's request" chip behind the modal. A whole-page text assertion cannot
   express "this dialog does not say X" when the page legitimately says X elsewhere.
   Narrowed to the closure warning's own wording plus the absence of its button.

**Lesson, recorded because it repeated three times in one item: when a test disagrees with
the code, suspect the test first.**

The two tests are **behavioural**, because the defect was a button that worked perfectly and
did the wrong thing — a screenshot would have passed on it every time, since the chip was
already in the baseline that shipped the bug:
- reinstating the closed fixture vendor demands a confirmation that names the vendor and
  says *"nobody will be able to sign in to run it"*;
- an ordinary unapproved vendor still gets the **KYC** confirmation and no mention of
  closure — the guard against "fixing" this by routing every activation through the closure
  warning.

This is `command`'s first non-SEO spec. It is **not** the visual suite the app still lacks
(I11).

### I13 — No click-opened modal has ever worked in `command`'s ui-gallery ✅ DONE — **pre-existing**
**Found 2026-08-21 while trying to verify I12**, and it is why those tests failed.

`app/ui-gallery/page.tsx` declares `function Body()` **inside** the page component and
rendered it as `<Body />`. A function declared in a render body has a new identity on every
render, and as an element *type* that makes React unmount and remount the entire subtree —
destroying the state of everything inside it. Every modal in that fixture is opened by
setting state inside `VendorsPage`, so the state was discarded before it could render.

**Established by elimination, not inferred:** the pre-existing **delete** confirmation
(`onDelete={() => setDeleteConf(s.id)}`, untouched by any of this work) also fails to open —
`DELETE_MODAL_OPENED: false`. Three independent paths — delete, KYC-activate, and the new
reinstate — all fail identically, with **no console errors and nothing thrown**. The common
factor is the fixture.

**Consequence worth stating plainly:** every interactive behaviour in Command's gallery has
been untestable and nobody noticed, because nothing has ever tried to click one. The same
defect class is flagged by `react-hooks/static-components` in the **vendor** gallery, where
it is a standing lint error (recorded in B4's findings).

**Fix:** ✅ call it — `{Body()}` — so the tree is inlined at a stable position instead of
being a new component type each render.

**Proven, not assumed:** `DELETE_MODAL_OPENED` flipped **false → true** on the untouched,
pre-existing delete path after this one-line change. That is the whole diagnosis in a single
measurement — a modal nothing in this work touches began working because the fixture stopped
remounting its subtree.

⚠️ **The vendor app has the same pattern**, where it is a standing
`react-hooks/static-components` lint error (B4 finding 3). It has not bitten there only
because vendor's gallery renders its modals directly from the mode dispatch rather than
opening them by a click. Worth fixing there before someone writes vendor's first
interaction test — folded into I11's scope.

### I11 — `command` has no visual regression suite ⬜ TODO — **pre-existing**
**Found 2026-08-21 during B6.** `command/visual-tests/` contains only `seo.spec.ts`; there
are no snapshots and no `pilot.spec.ts`, despite the app having a `/ui-gallery` page and a
`playwright.config.ts` whose vendor counterpart claims to "mirror the command app's
harness". So every Command surface — Users, Vendors, Payouts, Flags, and now Closures — has
zero pixel coverage, and a refactor there cannot be proved pixel-neutral the way the vendor
app's can.
Not caused by this plan and not fixed in it. Sizeable on its own (the vendor suite is 123
tests), so it wants its own plan rather than being smuggled into a closure feature.

### I10 — Hosted rollout: staging, then production ⬜ TODO
**Added 2026-08-21 after Stage 1.** Both migrations are verified on **local only**. Nothing
has reached staging or production, and local proof is not deployment — the failure mode this
item exists to prevent is a feature that works on one laptop.
Two things, in order:
1. Apply `20260821000001` + `20260821000002` to **staging** (`backbone` CLI is linked to
   staging, per the environments note) and confirm with `supabase migration list --linked`.
2. Repeat for production at release time.
**No Edge Function redeploy is needed** — see B2's correction. `send-notification-email` was
deployed to staging on 2026-08-21 and the CLI correctly reported "No change found", because
the union is compile-time only. A redeploy is required only if a bespoke renderer is ever
registered in `lib/templates/registry.ts`.
Re-run T1/T2/T3 against staging after applying: the local database's seed data is not the
same shape as staging's, and the RLS helpers read real membership rows.

---

## DECISIONS

<!-- Hard gate (plan-authoring §7): no item may execute while any OPEN: line remains.
     All ten were asked and answered on 2026-08-21. The gate is clear. -->

- **D1 — Request-driven or self-service?** → **Request → Command executes** (resolved 2026-08-21).
  A human reads the ledger once before an irreversible, money-adjacent act; F1 makes most
  closures a scrub rather than a delete, which is a judgement call. Noted at the time: the
  30-working-day NPC deadline applies to every option, so it was **not** a differentiator —
  the real trade was human duty vs. running an unproven destructive path unattended in
  launch week. D1(c) (auto-execute the zero-history case) stays available as a later upgrade.

- **D2 — Grace window?** → **7 days, cancellable** (resolved 2026-08-21). `scheduled_for =
  created_at + 7 days`, advisory only — Command executes manually, so no cron. Leaves ample
  margin inside the 30-working-day statutory clock, which a 30-day window would not.

- **D3 — Which scopes?** → **`vendor_and_user` (default) + `vendor_only`; `user_only` only
  when another active vendor-admin exists** (resolved 2026-08-21). `vendor_only` earns its
  place because a dual-role user can hold both `vendor` and `booker` grants —
  `notifications.portal` exists because of them — and closing a business must not delete a
  login they still book with. The `user_only` condition is I1, enforced in B3's route and
  not merely in B4's UI.

- **D4 — What is scrubbed vs retained on the vendor row?** → **Scrub contact PII, retain
  business identity and the ledger** (resolved 2026-08-21).
  **Scrub:** `phone`, `email`, `address`, `address_line1`, `barangay`, `barangay_code`,
  `city`, `city_code`, `province`, `province_code`, `zip_code`, `website`, `description`,
  `tagline`, `operating_hours`, `accreditation_no`.
  **Retain:** `name`, `division_id`, `created_at`, and every `bookings` /
  `booking_transactions` / `booking_status_log` / `vendor_status_log` row.
  Rationale: for a sole proprietor the contact and address fields *are* personal data; the
  business name is not, and a booker's own completed-booking history is unreadable without
  it. Pseudonymising `name` was rejected for that reason.

- **D5 — KYC documents?** → **Purge blobs and rows; retain the `vendor_kyc` header**
  (resolved 2026-08-21). Delete every object under `vendor-kyc/{vendor_id}/` and every
  `vendor_kyc_documents` row; keep the `vendor_kyc` row (status, dates) as proof
  verification occurred. Government IDs have no retention justification once the
  relationship ends, and Ezzy is not a covered person under AMLA, so a retention argument
  would be harder to defend than deleting.

- **D6 — Vendor state after closure?** → **Reuse `suspended` + revoke the `vendor` portal
  grant** (resolved 2026-08-21). A `closed` status is the semantically right answer and is
  **deferred, not rejected** — F7 makes it a four-repo change whose silent failure mode is
  closed vendors surfacing in Command's pending-approval queue. The
  `account_deletion_requests` row is the authoritative record of *why* a vendor is
  suspended; B6 renders it as a badge. Revoking the portal grant is what makes the access
  gate answer `no_access` instead of the misleading "your vendor is suspended".

- **D7 — Command queue placement?** → **New top-level "Closures" page** (resolved
  2026-08-21). Mirrors `command/components/flags/FlagQueue/` — same three-file shape, same
  lazy import in `AppShell.tsx`. A queue living only inside a vendor's own card is a queue
  nobody checks.

- **D8 — Shape of the public resource (B7)?** → **Thin static
  `https://ezzy.ph/account-deletion/` page *and* the in-portal flow** (resolved 2026-08-21)
  — i.e. the 08-21 mobile plan's (a) **and** (c). **This closes that plan's D1 and
  unblocks its Stage B/C.** Thin because B8 carries the detail, so the two cannot drift.
  Public rather than portal-only because a login-gated page fails suspended and
  rejected-KYC vendors — the population most motivated to use it (see B7).

- **D9 — Published turnaround?** → **"within 30 days of the request"** (resolved
  2026-08-21). Matches the statutory ceiling without promising to beat it, and stays true on
  a bad week. **Must appear identically in all three places:** B2's `account_deletion_requested`
  email copy, B7's page, B8's policy section. Changing it later means editing all three.

- **D10 — Who may execute a closure in Command?** → **Any Command admin** (resolved
  2026-08-21). Chosen for turnaround against the 30-day clock and to avoid a single-person
  bottleneck when root is unavailable.
  **Recorded honestly: root-only was recommended and not taken.** The reasoning for the
  recommendation was that this is the product's most destructive action and that the
  codebase already tiers privileged/destructive operations to root
  (`20260807000001_command_access_grant_root_only.sql`, the privileged-account guards in
  `command/app/api/users/route.ts:186-190`), with `isRoot` already plumbed through
  `AppShell` → `UsersPage`. The decision is the user's and stands.
  **Compensating controls this makes mandatory rather than optional** — they are the reason
  the choice is safe, so they may not be dropped as polish:
  - `reviewed_by` written on every execution and shown in the queue — under this decision it
    is the *only* attribution that exists (see the warning in B6).
  - The confirmation requires **typing the vendor name**, not a single click. A destructive
    action available to every admin needs the friction that root-gating would otherwise have
    supplied.
  - B6.4 — Execute stays disabled while any blocker is live, so the widest-available
    destructive action is also the hardest to fire by accident.

---

## DEFERRED / COSMETIC

- **`closed` vendor status** — D6. Right model, wrong week; revisit after launch, as one
  coordinated change across `backbone`, `command`, `vendor` and `ezzy-vendor-mobile`.
- **Booker account deletion** — same obligation, different portal. B1's table is already
  scope-shaped for it (`vendor_id` nullable), so this is additive. Blocked on nothing but
  a decision to do it; `booker` self-registers **in-app on mobile**, which is when the
  in-app requirement starts binding for real.
- **Automated execution for zero-history vendors** — D1(c).
- **Command proof-of-consent screen** — `legal_acceptances` is written and never read
  (`schema.md`); a closure dispute is exactly when someone would want to read it.
- **Vendor member management / handover** — would turn I1 from a refusal into a workflow.

---

## Execution order

**Cadence: one stage at a time** (`developerboss` → Execution Cadence). Every stage below
reports summary + checklist + plan status before the next begins.

| Stage | What | Repo | Gate | Blocked by |
|---|---|---|---|---|
| **0** | Resolve D1–D9 | — | — | ✅ **DONE 2026-08-21** |
| **1** | B1 + B2 migrations, `schema.md` + `architecture` updates | `backbone` | **schema approval; user applies** | ✅ **DONE 2026-08-21** (local; I10 for hosted) |
| **2** | B3 — eligibility, authz sibling, `/api/account-deletion` | `vendor` | — | ✅ **DONE 2026-08-21** |
| **3** | B4 — Settings card + modal | `vendor` | — | ✅ **DONE 2026-08-21** |
| **4** | B5 — execution route (the destructive path) | `command` | — | ✅ **DONE 2026-08-21** |
| **5** | B6 — Closures queue UI | `command` | — | ✅ **DONE 2026-08-21** |
| **5b** | I8 + I9 — post-closure copy and the surviving session | `vendor` | — | Stage 1 (needs the request row to read) |
| **6** | B8 policy wording, then B7 page + mobile repoint | `ezzy.ph`, `ezzy-vendor-mobile` | — | ✅ **both live 2026-08-23**; only the mobile repoint remains |

**Stage 0 is complete** — all ten decisions are recorded above with their rationale. It
was not a formality: D4, D5 and D6 each change what B5 is allowed to do to real data, and
writing B5 first would have meant rewriting it.

**Stage 1 is the next action, and it is an approval gate.** B1 and B2's SQL is drafted
inline; per AGENTS.md the migration files are not created until the user says go, and the
user applies them (never this agent).

**Stages 1 → 4 before 2 → 3 is defensible if launch pressure demands it**: the Command
execution path plus the public page is a compliant answer on its own (a vendor emails,
Command executes), and the vendor-portal UI is what turns it into a good one. Say so
explicitly if that reordering is taken, rather than shipping B3/B4 half-done.

**B8 leads B7.** A deletion page that promises more than the policy discloses is worse
than no page — the same reasoning the mobile plan used to refuse splitting its Stage C.

**Stage 5b is not optional polish.** I8 and I9 are the last thing a departing vendor
experiences, and today both resolve to either a wrong sentence or a blank screen. A closure
that works perfectly and ends in a broken dashboard is a closure the vendor will describe as
broken. Small work — two call sites — but it belongs before launch, not after.

---

## Verification

| Item | How | Kind |
|---|---|---|
| B1 | `supabase migration list --linked`; then, as three roles: vendor-admin sees only own vendor's rows, requester sees own after membership revoked, `authenticated` INSERT is refused | **needs live environment** (staging — the `backbone` CLI is linked to staging) |
| B2 | Row present in `notification_type_settings`; `types.ts` union updated; **Edge Function redeployed**; one test notification produces a `notification_emails` row with `status = 'sent'` | needs live environment |
| B3 | Unit tests for the eligibility predicate against each blocking status set (`vendor` already runs unit tests — `conventions.md:308`, `lib/*.test.ts`); route exercised for 401 / 403 / 409-duplicate / 200 | **machine-verifiable** (unit) + live (route) |
| B4 | `tsc` clean; all four states rendered in `/ui-gallery` with a regenerated Playwright visual baseline (`conventions.md:336`) | machine-verifiable |
| B5 | `reviewed_by` is populated from `verifyCommandCaller()` on every execution — check the row, not the UI, since `vendor_status_log.changed_by` will be NULL by construction. **Then, on staging, against a seeded vendor with KYC documents:** blobs gone from `vendor-kyc/{id}/`, `vendor_kyc_documents` empty, vendor scrubbed per D4, `notification_emails` shows `sent` **before** the auth user disappears, `auth.users` row gone, request `completed`. Then the negative case: a vendor with one open booking is refused | needs live environment — **and must not be marked ✅ on a passing type-check alone** |
| B6 | `tsc` clean; queue renders empty / populated / executing / **failed**; ageing indicator escalates near 30 days; Execute disabled with the reason shown while blocked; Overview shows `openClosureCount`; `VendorCard` distinguishes closed from suspended-for-cause; `reviewed_by` displayed | machine-verifiable (states via `/ui-gallery` + visual baseline) |
| B7 | The three previously-404 URLs, plus the chosen one, return 200; mobile build with the constant set opens it; footnote copy no longer says "web portal" | needs live environment |
| I6 | With a `pending` request, create a booking and confirm the card surfaces the new blocker without a reload-from-scratch | needs live environment |
| I8 | After a `vendor_only` closure: sign in fresh **and** restore an open session — both must state the account was closed at the vendor's request, and neither may say "contact support" | needs live environment |
| I9 | Execute a closure against a signed-in browser session; the tab must sign out with I8's message, not render an empty dashboard | **needs live environment — cannot be type-checked** |
| B8 | Policy text names every retained category in D4/D5 and the retention period | human review |

**What cannot be verified before go-live:** real Play Data-safety acceptance (only a
submission answers that), and the actual email deliverability of the confirmation under
production Resend domains.
