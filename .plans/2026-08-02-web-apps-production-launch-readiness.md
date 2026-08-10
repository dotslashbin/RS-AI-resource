# Web apps — production launch readiness (vendor first)

**Date:** 2026-08-02
**App / scope:** `vendor/`, `booker/`, `command/`, `backbone/` (config + migrations)
**Status:** DRAFT — investigation complete; all 4 decisions closed; second review
done. **📌 PINNED / not scheduled (2026-08-03).** No code is to be written from
this plan until the user unpins it. Pinned in a *ready* state, not a blocked one:
nothing is outstanding on the plan's side.

> **Why pinned.** The user is taking a separate session to fix something else
> first, then returning here with that fix in hand. Pinned deliberately so a later
> session does not read "awaiting approval" as "start executing".

> **Unpin checklist — do this before Stage 1, not after:**
> 1. **Re-verify the `file:line` citations.** Every item in this plan is anchored
>    to a specific line. If the intervening fix touched `vendor/`, `booker/`,
>    `command/` or `backbone/`, some anchors will have moved and a few findings may
>    already be resolved. Treat citations as **stale until re-opened** — the same
>    scepticism this plan's own second review applied to its first pass.
> 2. **Re-check the baseline.** `npx tsc --noEmit` in all three apps exited 0 on
>    2026-08-02; confirm that still holds.
> 3. **Fold the intervening fix in.** If it resolved anything here, mark the item
>    ✅ with the date and how it was verified — do not delete it. If it added new
>    work, number it into the right tier rather than leaving it in chat.
> 4. **Confirm the four decisions still stand.** D1 (booker gated) especially — it
>    is what keeps B8/B9/I8 parked and the launch gate at nine blockers.
**Revised:** 2026-08-03 (seeder + Command-CRUD review) — added a standing
**"Seeders"** section (production needs **no** lookup seeder; migrations already
do it — building one was declined as harmful), **B12** (no way to create the first
Command user on a fresh project — the real gap behind the seeder question), and
**I13** (user edits delete roles/portals before re-inserting, non-atomically, with
no last-root guard). Command's user CRUD verified in full — see B12/I13.
**Revised:** 2026-08-03 (second review) — see "Second review" below. Added **B11**
(no privacy notice or consent at KYC collection), **I11** (vendor deletion orphans
ID photos in Storage), **I12** (activation ignores KYC state). Corrected **two
gaps in this plan's own fix approaches**: B2's signed-URL path was unreadable under
the bucket's RLS, and B10's middleware would have black-holed the PayMongo
webhook. B3 escalated — three cards have no hook at all. Dropped two false alarms.
File manifest added as **Appendix C**.
**Revised:** 2026-08-03 — D1–D4 resolved. Added **B10** (booker must be gated in
production, from D1). **B3 resized** from "remove the fabricated cards" to "wire
them to real data" (D3 chose the larger option over the recommendation) — it now
carries a schema approval gate of its own and moves later in the order. B8/B9/I8
confirmed out of the launch gate.

> Second-pass production audit ahead of a **vendor-first** launch. Optimise for:
> nobody gets locked out of an account, nobody makes an operational decision on a
> fabricated number, and no money moves — or fails to move — silently.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision. Numbers are
> plan-local — qualify cross-plan refs by app (e.g. "command I1").

---

## Scope

**In scope:** the operational flow *between* the three web portals — registration
→ KYC → Command approval → vendor operations → booking → payment → fulfilment →
payout — plus the code, schema and deploy configuration that flow depends on.

**Out of scope, explicitly:**
- Both Expo apps. `ezzy-vendor-mobile` is audited separately, later, at the
  user's instruction. It *is* cited below where its implementation is the
  correct reference the web apps diverged from (I1).
- The marketing site in `website/`.
- Crawler visibility — already owned by
  `.plans/2026-08-02-web-apps-search-engine-exposure.md` (IN PROGRESS, B1+B2 done).
- The production cutover checklist for the fulfilment migrations — already owned
  by **I24** in `.plans/2026-07-31-booking-fulfilment-dual-acknowledgement.md`.
  This plan **extends** that checklist (see B1, B7) rather than restating it.

**Cross-app:** this plan touches all three portals and `backbone`. Per AGENTS.md
that is an approval gate in itself, on top of the schema/security gates called
out per item.

---

## What the investigation found — and what it corrected

Read, not assumed. Baseline established first:

- **All three apps type-check clean.** `npx tsc --noEmit` exits 0 in `vendor`,
  `booker` and `command` (2026-08-02). Nothing below is a compile error.
- **The fulfilment subsystem is sound.** `20260801000002`–`20260801000009` were
  read end to end. The actor-aware trigger, the payout-status gating, the
  service-date gate on the timer and the grants on every new table are correct
  and well-reasoned. **No blocker was found in the database layer.** The defects
  are at the edges: deploy configuration, the public routes, and three web
  clients that disagree with the database they read from.

Corrections to what the architecture docs claim:

| Doc claim | Reality | Action |
|---|---|---|
| `portals.md:130` — vendor Calendar page is mock, driven by `BOOKINGS`/`SCHEDULES` constants | **Wrong.** `AppShell.tsx:84` passes real `bookings` and `schedules` props; no such constants exist in `vendor/` | I9 — doc fix, no code |
| `portals.md:204` — Packages page is mock and reachable | **Already handled.** Commented out of `PageId` (`vendor/lib/types.ts:25`), `Sidebar.tsx:23` and `AppShell.tsx:85`. Not reachable | dropped |
| `overview.md:158` — Command KPIs "still seeded" | **Escalated.** Not merely seeded — `useOverviewPage.ts:14-16` hardcodes a six-element wallet array, and `revenue` is hard `0` (`command/services/vendors.service.ts:27`), so the revenue KPI is a confident zero, not a stale number | B3 |
| `booker/CLAUDE.md` — "Next.js 15", "No environment variables required" | **Wrong on both.** `next` `^16.2.4`; the app needs 8 env vars including two PayMongo secrets | I9 |

---

## Second review (2026-08-03) — corrections to this plan

Re-read at the cited lines rather than trusting the first pass. Four claims were
checked and cleared, three items were added, and **two gaps were found in this
plan's own recommendations** — both of the kind where a poor implementation could
still satisfy the wording.

**Dropped — false alarms:**
- **`/ui-gallery` is not exposed in production.** All three call `notFound()` when
  `NODE_ENV === "production"` (`vendor:211`, `booker:256`, `command:231`). Checked
  because it is a fixture route on a public deploy; it is correctly gated.
- **`vendor/app/robots.ts` exists.** Booker and command have theirs too — the
  search-engine plan's B2 really is done in all three. No gap.

**Already handled elsewhere — do not rebuild:**
- The mobile app's account-deletion link does **not** 404 today: it deliberately
  opens the portal root until the web route exists
  (`ezzy-vendor-mobile/.../useSettingsList.ts:42-47`), and tracks the missing
  route as its own B6. The web-side obligation is real (folded into **B11**), but
  nothing is broken right now and mobile needs no change from this plan.

**Escalated:**
- **B3 is larger than "swap the data source".** `WalletBalancesCard`,
  `VendorTrendsCard` and `BookingTrendsCard` have **no companion hook at all** —
  the `use*.ts` files simply do not exist, and logic sits in the `.tsx`
  (`WalletBalancesCard.tsx:14,24-25`). B3 must create three hooks, not just
  re-point three imports. Detail folded into B3.

**Gaps found in this plan's own fix approaches** — both now written into their
items:
- **B2's signed-URL approach had a hole.** The `vendor-kyc` bucket's RLS keys on
  `(storage.foldername(name))[1]::uuid = vendor_id` (`20260706000002`), but at
  registration time **no vendor row exists yet**, so there is no valid final path
  to sign. An implementation could follow the plan as written, upload to an
  arbitrary path, and produce documents neither the vendor nor Command can ever
  read. Corrected in B2 with a staging prefix + service-role move.
- **B10's middleware would have black-holed the PayMongo webhook.** "Serve a
  gate response for every path" includes `/api/payment/webhook`. A dropped
  webhook is unrecoverable today (that is exactly I6), so the matcher must
  exclude it. Corrected in B10.

---

## Seeders — what production actually needs (answered 2026-08-03)

Asked directly: *does this plan touch the seeders, and should there be a
production seeder for the lookup tables plus one root user?* Verified rather than
assumed, and the answer splits in two.

**The lookup tables need no seeder. They are already seeded by migrations.**
Counted `insert into` per table across `seed.sql` and the migrations:

| Table | rows from `seed.sql` | seeded by |
|---|---|---|
| `statuses`, `portals`, `roles` | **0** | `20260504000001_lookup_tables.sql` |
| `divisions` (13 rows) | **0** | `20260724000004_divisions.sql` |
| `fulfilment_patterns` | **0** | `20260801000001` |
| `notification_type_settings` (13 types) | **0** | `20260525000001` + `20260801000007` |
| `notification_email_settings` / `notification_push_settings` | **0** | `20260624000001` / `20260728000001` |
| `platform_fee_settings` | **0** | `20260725000001` (at `0` — set via Command) |
| `kyc_document_types` | **0** | `20260706000001` |

`seed.sql` inserts **zero rows into every one of them**. A production `db push`
already yields every lookup row the platform needs. This confirms I24's finding in
`.plans/2026-07-31-booking-fulfilment-dual-acknowledgement.md` — re-verified here
by counting, not by trusting the note.

**So building a production lookup seeder would be actively harmful**, not merely
redundant: it would create a second source of truth that drifts from the
migrations, and it would put an `--include-seed` habit near a production project
whose `seed.sql` writes real login accounts with known passwords
(`seed.sql:53,122,857`). Declined, deliberately — recorded here so the question
does not get re-asked and answered differently later.

**What `seed.sql` really contains** is fixture data — fake vendors, offerings,
schedules, 41 bookings, and three `auth.users` blocks. None of it belongs in
production and none of it goes there, because `db push` does not run seeds
(`database-reset-and-deploy.md:17-19`). Nothing needs to change about it.

**The genuine gap the question exposed is the root user** — and it is a launch
blocker, now **B12**. It also cannot be a seed file at all: seeds only run on
`db reset`, which is local-only, so a "production seeder" would never execute in
production. B12 specifies a script instead.

**Belt-and-braces, already suggested by I24 and endorsed here:** set
`[db.seed] enabled = false` in a production-facing config profile so an
accidental `--include-seed` cannot fire.

---

## BLOCKERS

### B1 — Password recovery is unreachable in production until the hosted redirect allow-list is set  ⬜ TODO
> 🔀 **MOVED (2026-08-08) → `.plans/2026-08-07-vendor-signup-production-preparations.md` as A-B4.** Copied there in full for the vendor sign-up launch so this plan could stay 📌 pinned. **Do not execute from here** — the live version is the other plan. Kept for the record per the status model.

**Files:** `backbone/supabase/config.toml:154,160`;
`vendor/components/auth/LoginPage/useLoginPage.ts:181`;
`command/services/auth.service.ts:16`; `booker/services/auth.service.ts:32`

All three portals request recovery with `redirectTo = window.location.origin`
(`useLoginPage.ts:181`). GoTrue validates that value against `SITE_URL` +
`URI_ALLOW_LIST` and **silently falls back to `site_url`** when it does not
match. The repo's config still declares only localhost:

```toml
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000", "http://localhost:3001",
                            "http://localhost:3002", "http://127.0.0.1:3000"]
```

**Why this is a blocker and not hygiene.** Command creates users with
`auth.admin.createUser` and **no password** (`command/app/api/users/route.ts:37-41`)
— "Forgot Password" is the *only* way a Command-created user ever logs in for the
first time. If the allow-list is wrong, every account Command creates after
launch is dead on arrival, and every vendor who forgets a password is locked out
permanently, with no Command-side path to fix it (see I10).

**Fix approach:** on the production project, set `site_url` to the vendor origin
and add all three portal origins to the redirect allow-list; mirror in
`config.toml` so the repo stops describing localhost as the truth. Then verify by
running a real recovery on each portal. Add to the I24 cutover checklist.
Deep-link URLs for `ezzy-vendor-mobile` are a **separate, later** entry — noted so
this is not "fixed" twice.

<!-- verification: needs a live environment — a real recovery email per portal, end to end -->

---

### B2 — Vendor KYC registration will 413 on Vercel: the whole packet posts through one Route Handler  ⬜ TODO
> 🔀 **MOVED (2026-08-08) → `.plans/2026-08-07-vendor-signup-production-preparations.md` as A-B1.** Copied there in full for the vendor sign-up launch so this plan could stay 📌 pinned. **Do not execute from here** — the live version is the other plan. Kept for the record per the status model.

**Files:** `vendor/app/api/auth/register/route.ts:13,71-77,144-154`;
`vendor/components/auth/LoginPage/useLoginPage.ts:292`

The registration submit sends *every* KYC file as one multipart POST to the Route
Handler. Per-file the cap is 10 MB, client- and server-side. There is **no cap on
the number of files** (`files.getAll("files")`, loop at `:146`) and **no cap on
total payload**.

Vercel Serverless Functions cap the request body at **4.5 MB**. A realistic
packet — a scanned business permit PDF plus DTI registration plus the two camera
captures — passes both existing checks and is rejected by the platform before the
handler ever runs. The client shows a generic failure, and because the flow is
atomic-by-design, the vendor cannot get past registration at all.

Two aggravating facts found while verifying:
- The camera captures are *not* the problem — `vendor/lib/captureImage.ts:4-8`
  emits 1280px JPEG at q0.9, ≈200–400 KB each. The uploaded documents are.
- The **resubmit** path does not have this problem: `resubmitKyc` uploads
  straight to Storage with the vendor's own session, subject only to the bucket's
  10 MB limit. So registration and resubmit already behave differently for the
  same file — which is also why the fix should move registration toward resubmit,
  not the other way.
- No `export const maxDuration` on the route. Several MB plus N sequential
  Storage uploads can exceed the default function timeout independently of size.

**Fix approach (per D2 — signed upload URLs), in the order the steps must happen:**

⚠️ **The obvious implementation is wrong, and would pass a casual review.** The
bucket's `storage.objects` policies key on
`(storage.foldername(name))[1]::uuid = vendor id` (`20260706000002`). At
registration time **the vendor row does not exist**, so there is no valid final
path to sign. Uploading to `{anything}/…` yields documents that neither the
vendor (resubmit view) nor Command (review panel) can ever read — the failure
surfaces days later, at review, not at upload.

So:

1. **`POST /api/auth/register/prepare`** — validates *every* field exactly as the
   current route does (before creating anything, as today), then mints one
   `createSignedUploadUrl` per file under a **staging prefix**
   `pending/{submissionId}/{uuid}-{safeName}`, where `submissionId` is a
   server-generated UUID. Returns the URLs + `submissionId`. Creates nothing.
2. **Browser uploads directly to Storage** with those tokens. Signed upload
   tokens bypass RLS by design, so the staging prefix needs no policy.
3. **`POST /api/auth/register`** — receives `{ submissionId, labels, fields }`
   (JSON, kilobytes, no body-limit exposure). Performs the existing atomic
   create, and once `vendorId` exists, **`storage.move()`s each object** from
   `pending/{submissionId}/…` to `{vendorId}/…` under service role before
   inserting the `vendor_kyc_documents` rows with the final paths.
4. **Rollback extends to the staging objects.** The existing `rollback()` already
   removes uploaded paths; it must now also clear the staging prefix, including
   on the paths that failed to move. An abandoned prepare leaves only staging
   objects — sweep `pending/` older than 24h (small script or a cron job; note it,
   do not gold-plate it).

**Still required alongside this** — the signed-URL route removes the *body* limit,
not the abuse surface:
- document-count cap and total-bytes cap, enforced in `prepare` **and** client-side
- `export const maxDuration` on both routes
- `prepare` is a public unauthenticated endpoint that mints Storage write tokens,
  so it inherits **B6**'s rate limiting — this is a coupling, not a nice-to-have.

**Atomicity is preserved in the sense that matters:** no auth user, vendor,
`vendor_kyc` header or document row exists until step 3 succeeds. What can now
exist on failure is orphaned bytes under `pending/`, which is why step 4 exists.
`auth-and-roles.md:52-56` (D-7 = D) should be amended to say exactly this rather
than left implying files and rows land together.

<!-- verification: machine-verifiable for the caps; the 4.5 MB behaviour needs a deployed preview -->

---

### B3 — Command's Overview and Transactions present fabricated figures as operational fact  ⬜ TODO
> **Resolved D3 (2026-08-03): wire to real data, not remove.** This was the larger
> of the two options and it delays launch by days rather than hours — recorded here
> so the cost is visible at the item, not just in the decision log. It also pulls a
> schema approval gate (Appendix B) into the critical path.
**Files:** `command/components/overview/OverviewPage/useOverviewPage.ts:2,7-16`;
`command/components/overview/PaymentMethodsCard/usePaymentMethodsCard.ts:3,12-13`;
`command/components/transactions/TransactionsPage/useTransactions.ts:3,23`;
`command/services/vendors.service.ts:27`

Command is the ops portal that runs from day one. On its landing page today:

| Surface | Source | What an operator sees |
|---|---|---|
| Total bookings, % change, booking sparkline | `BOOKING_TREND` constant | invented history |
| Wallet balances + total | `[18350, 14200, 9800, 6450, 2100, 5500]` hardcoded at `:14` | invented money |
| Platform revenue | `vendors.reduce(… + sc.revenue)`, and `revenue` is hard-coded `0` at `vendors.service.ts:27` | a confident ₱ 0 |
| Payment-methods breakdown | `ALL_TXNS` constant | invented |
| Transactions page (search, filter, sort, paginate) | `ALL_TXNS` constant | a fully interactive fake ledger |
| Active vendors | `vendors` table | ✅ the only real number on the page |

`booking_transactions` already holds the real platform-wide data these need, and
the vendor portal's `transactions.service.ts` is a working reference for reading
it correctly (exact count, stable sort, truncation banner).

**Fix approach (per D3):** wire each surface to real data, and delete the one that
has none.

| Surface | Real source | Note |
|---|---|---|
| Total bookings + % change | `count` on `bookings`, PH-month bounds | use `head: true` + exact count, never fetch rows to count them |
| Platform revenue | `sum(platform_fee_amount)` on `booking_transactions` | the platform's cut, not `amount_paid` — name the card accordingly |
| Held funds | `sum(payout_amount)` where `payout_status in ('held','releasable')` | this is what the invented wallet array was pretending to be |
| Booking / vendor trend sparklines | monthly `bookings` and `vendors` counts | replaces `BOOKING_TREND` / `VENDOR_TREND` |
| `WalletBalancesCard` | per-vendor held+releasable payout sums | rename — "wallet" describes a table that does not exist (`schema.md:805`) |
| `PaymentMethodsCard` | **none** | `booking_transactions` has no payment-method column. **Delete the component, its hook and its CSS module.** Do not substitute a proxy metric |
| `TransactionsPage` | `booking_transactions` joined to `bookings`/`vendors`/`offerings` | new `command/services/transactions.service.ts` |

**The aggregates must not be computed client-side.** `max_rows = 1000` and
PostgREST's silent 206 (see I2) mean a client-side `reduce` over "all
transactions" would render a confident, wrong number — the precise failure this
item exists to remove, reintroduced in a new place. Two rules for this stage:
- KPI figures come from a `SECURITY DEFINER` aggregate RPC, Command-only. Draft
  SQL and blast radius in **Appendix B** — ⚠️ **approval gate, not written yet.**
- The Transactions *table* uses the paged-with-exact-count pattern already proven
  in `command/services/payouts.service.ts:117-152`, including its truncation
  reporting. Copy it; do not re-derive it.

**Component-separation note — three hooks must be *created*, not just edited.**
Found on second review: `WalletBalancesCard`, `VendorTrendsCard` and
`BookingTrendsCard` have **no `use*.ts` file at all**, and compute in the render
layer (`WalletBalancesCard.tsx:14` `Math.max(...)`, `:24-25` index-pairing). Each
needs a companion hook created alongside the wiring, per
`.claude/skills/component-separation/SKILL.md`. Note also that `walletBalances[i]`
pairs the *n*th vendor with the *n*th arbitrary number — a latent bug that
disappears only if the replacement keys on `vendor_id`, never on array position.

Beyond those three, every edit lands in an existing
`Component/` + `useComponent.ts` pair. Wired cards keep all fetching, aggregation
and formatting in the hook, with the `.tsx` a pure render layer and no inline
`style={{}}`. `PaymentMethodsCard` is deleted whole — component, hook and
`.module.css` — along with its import in `OverviewPage.tsx:46`. Each wired card
needs all four states handled per `ux-design`: loading, empty, error, populated —
and, following the vendor dashboard's rule (`portals.md:112`), a figure that
failed to load renders `—`, never a confident `₱ 0`.

---

### B4 — The vendor portal has no access verification: a suspended user is shown "awaiting activation"  ⬜ TODO
> 🔀 **MOVED (2026-08-08) → `.plans/2026-08-07-vendor-signup-production-preparations.md` as B-I2.** Copied there in full for the vendor sign-up launch so this plan could stay 📌 pinned. **Do not execute from here** — the live version is the other plan. Kept for the record per the status model.

**Files:** `vendor/components/layout/AppShell/useAppShell.ts:130-174`;
`vendor/services/vendor.service.ts:22-44`;
`vendor/components/auth/LoginPage/useLoginPage.ts:144-176`;
`vendor/components/kyc/KycStatusPage/useKycStatusPage.ts:35-41`

`auth-and-roles.md:5-11` documents three independent access layers: **active
status**, **portal membership**, **role**. `booker` implements all three
(`booker/services/booker.service.ts:9-22`) and `command` implements all three
(`command/app/api/users/route.ts:14-27`). **`vendor` implements one** — vendor
membership — and has no `verifyVendorAccess()` at all. `user_portals` is never
read anywhere in the vendor app (grep: zero hits).

Two concrete consequences:

1. **Revoking the `vendor` portal row does nothing.** Command's only lever that
   still works is suspending the profile, and that works by accident: the
   `vendors` SELECT policy carries `is_active()`
   (`20260504000003_rls.sql:132-138`), so the embedded vendor row comes back null
   and the user falls through to `signOut()` with "Your account has no vendor
   access. Contact support." — correct outcome, wrong reason, and it would break
   the moment that policy changed.
2. **A suspended *vendor* is routed to the KYC status surface.**
   `useAppShell.ts:141-147` sends any non-active vendor to `KycStatusPage`, which
   keys purely on `vendor_kyc.status` (`useKycStatusPage.ts:35-41`). A vendor
   suspended by Command with an approved packet is told **"approved — awaiting
   activation"**. Suspension is indistinguishable from pending activation, in the
   exact place a vendor goes looking for an explanation.
   `all[0]` at `:143` also picks an arbitrary vendor for a multi-vendor user.

**Fix approach:** add `vendor/services/vendor-access.service.ts` mirroring
`booker.service.ts` — check `profiles.status`, `user_portals('vendor')` and
`vendor_members` role, returning a discriminated reason
(`no_access | suspended | pending_kyc | vendor_suspended`). Route each reason to
its own copy, as the mobile app's `blocked` screen already does. Blocked states
need real copy and a way forward — a blank or wrong "no access" screen is the
failure this item exists to remove.

**Component-separation note:** new service file + branch in the existing
`useAppShell` hook; `KycStatusPage.tsx` gains a `vendor_suspended` branch fed by
its hook. No new component, no logic in a `.tsx`.

---

### B5 — Command approving or rejecting KYC notifies nobody: the onboarding funnel dead-ends  ⬜ TODO
> 🔀 **MOVED (2026-08-08) → `.plans/2026-08-07-vendor-signup-production-preparations.md` as B-I1.** Copied there in full for the vendor sign-up launch so this plan could stay 📌 pinned. **Do not execute from here** — the live version is the other plan. Kept for the record per the status model.

**Files:** `backbone/supabase/migrations/20260525000001_notification_type_settings.sql`
(7 seeded types); `20260801000007_fulfilment_notifications.sql` (6 more);
`command/services/kyc-admin.service.ts`

Verified by enumerating every seeded notification type. Thirteen exist. **None of
them fires on a KYC review or a vendor activation.** The vendor submits a packet,
Command approves it and flips the vendor active, and the vendor learns this only
by logging in again on a hunch. On rejection they are never told to revise —
even though the revise-and-resubmit flow is fully built and waiting.

`portals.md:216` records this as deferred item 8b. For a **vendor-first launch**,
where the entire funnel is register → wait → get activated, it is not deferrable:
it is the step where vendors are lost, and every lost vendor becomes a support
ticket.

**Fix approach:** two new `notification_type_settings` rows —
`vendor_kyc_reviewed` and `vendor_activated`, portal `vendor` — inserted by a new
migration, plus writes from Command's KYC review and vendor-activation paths.
Both channels (in-app + email) then come free: the existing
`notifications_dispatch_email` trigger fires on any insert.

⚠️ **Approval gate — schema change.** Exact SQL and blast radius are drafted in
**Appendix A**; not written until approved.

**Coupling:** requires B6's email deliverability (Resend SMTP + the Edge Function
+ Vault secrets) to actually be live on the production project, or the rows exist
and nothing is delivered.

---

### B6 — The two public registration routes are unauthenticated, unthrottled, and never verify the email  ⬜ TODO
> 🔀 **MOVED (2026-08-08) → `.plans/2026-08-07-vendor-signup-production-preparations.md` as A-B2.** Copied there in full for the vendor sign-up launch so this plan could stay 📌 pinned. **Do not execute from here** — the live version is the other plan. Kept for the record per the status model.

**Files:** `vendor/app/api/auth/register/route.ts:20-190`;
`booker/app/api/register/route.ts:8-60`; `vendor/app/api/divisions/route.ts:10`

Three separate problems on the same surface:

1. **No rate limiting or bot control anywhere.** Both register routes run the
   service-role client on unauthenticated input. The vendor one additionally
   writes N files of up to 10 MB each into the private `vendor-kyc` bucket
   (`:146-154`) before anything else validates. A script can mint auth users and
   fill Storage. `/api/divisions` is also public service-role with no caching.
2. **`email_confirm: true` on both routes** (`vendor:99`, `booker:45`) — nobody
   ever proves they own the address. A typo at registration produces a permanently
   inaccessible account, an orphan `vendors` row in `pending_activation`, and KYC
   documents sitting in Storage. Command cannot repair it: editing
   `profiles.email` does not touch `auth.users.email` (the sync trigger runs
   auth → profiles only). See I10.
3. **Server-side password strength is weaker than the UI implies.** The client
   requires 8 characters (`useLoginPage.ts:132`, `:195`); the route forwards
   whatever it is given (`:30`) and GoTrue's floor is
   `minimum_password_length = 6` (`config.toml:179`). A direct POST sets a 6-char
   password on a vendor account holding payout figures.

**Fix approach:** rate-limit keyed on IP + email. **In-memory will not work** —
serverless instances are per-request and share nothing, so a module-level `Map`
gives the appearance of a limiter and none of the behaviour. Two viable stores,
and the choice carries a gate I failed to flag on the first pass:

- **Vercel WAF / firewall rate-limit rules** — no code, no schema, configured per
  project. Preferred if the plan is available on the account.
- **A `rate_limit_hits` table** (`key text, window_start timestamptz, count int`)
  written by the routes under service role. Works anywhere. ⚠️ **This is a schema
  approval gate** — if this option is taken, its SQL and blast radius must be
  drafted here first, exactly as Appendices A and B were.

Confirm which before Stage 6 starts. Alongside it: enforce 8 characters and a
total-packet cap server-side;
raise `minimum_password_length` to 8 and enable leaked-password protection on the
hosted project. Email verification is a **D2-adjacent** decision — recorded as
I10 rather than forced here, because turning on confirmations changes the
"account is live immediately" property both flows are built around.

---

### B7 — No security headers on any of the three apps  ⬜ TODO · ⚠️ **booker arm REACTIVATED (2026-08-10)**

> **The "booker is not deploying" assumption below is now false.** `booker.ezzy.ph` is
> live and serving `HTTP 200`. Measured headers on 2026-08-10 — the complete set:
>
> ```
> strict-transport-security: max-age=63072000
> ```
>
> That is Vercel's own default. **No CSP, no `X-Frame-Options`, no
> `X-Content-Type-Options`, no `Referrer-Policy`, no `X-Robots-Tag`.** `vendor` and
> `command` each carry a full header set; the customer-facing app carries none.
>
> The migration note directly below states its own reactivation condition — *"if booker
> later launches, the booker column of the CSP table below is the part still owed"* —
> and that condition has been met. The booker column is owed now.
>
> Two couplings when it is picked up:
> - `connect-src` must be **derived** from `NEXT_PUBLIC_SUPABASE_URL`, never copied as a
>   wildcard — see `.plans/2026-08-08-csp-blocks-supabase-connections.md` I2 and B1.
>   Copying is what broke sign-in on the other two portals.
> - booker additionally needs the Leaflet tile host and `api.paymongo.com`; it is the
>   only app with maps or a payment provider in the browser.
>
> **Update, later on 2026-08-10 — the SEO half is now live, the header half is not.**
> booker was released (deployed **v0.15.1**, up from a stale v0.7.0 that predated the SEO
> guards entirely). It now serves `robots.txt` → `Disallow: /` and
> `X-Robots-Tag: noindex, nofollow, noarchive`.
>
> Re-measured after that release — still **absent**: `Content-Security-Policy`,
> `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
> `booker/next.config.ts` sets `X-Robots-Tag` and nothing else, so no deploy can fix this;
> **the booker column of the CSP table below is unwritten code and remains owed.**
>
> **Its Supabase pointing is now deliberate, not a mistake.** booker stays on staging
> `fbxbwnfeimzhgxpshdpa` until it launches; the other five domains are mapped in
> `architecture/overview.md` → "Environments". Repointing it at production is what turns
> this item back into a launch blocker.
> 🔀 **MOVED (2026-08-08) → `.plans/2026-08-07-vendor-signup-production-preparations.md` as A-B7.** Migrated **narrowed to `vendor` + `command` only** — `booker` is not deploying, so its Leaflet and PayMongo CSP directives were dropped. **If booker later launches, the booker column of the CSP table below is the part still owed.** Do not execute from here.

**Files:** `vendor/next.config.ts:14-24`; `booker/next.config.ts:14-24`;
`command/next.config.ts:9-19`

Every app's `headers()` emits exactly one header, `X-Robots-Tag`, and only when
`ALLOW_INDEXING !== "1"`. There is no `Content-Security-Policy`,
`Strict-Transport-Security`, `X-Frame-Options`/`frame-ancestors`,
`X-Content-Type-Options`, `Referrer-Policy` or `Permissions-Policy`, and no
`middleware.ts` in any app to add them.

Command is the portal that approves vendors and releases payouts, and it is
framable by any origin. Vendor holds government ID images behind signed URLs. The
cost of fixing this is a few lines per app.

**Fix approach:** extend each `headers()` with `Strict-Transport-Security`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
a minimal `Permissions-Policy`, and a CSP carrying `frame-ancestors 'none'`.

**The CSP is not byte-identical across the three apps** — this is the part a
copy-paste implementation gets wrong, so the per-app directives are named here:

| Directive | vendor | booker | command |
|---|---|---|---|
| `connect-src` | Supabase HTTPS + **WSS** (Realtime) | same, **plus** `api.paymongo.com` | same as vendor |
| `img-src` | `'self' data: blob:` (camera captures + signed URLs) | `'self' data: blob:` **+ the Leaflet tile host** | `'self' data: blob:` |
| `media-src` | `blob:` — `getUserMedia` preview in KYC capture | not needed | not needed |
| `frame-src` | none | PayMongo, **only if** checkout is ever embedded rather than redirected (today it is a full redirect, so: none) | none |
| `form-action` | `'self'` | `'self'` | `'self'` |

`script-src` needs `'unsafe-inline'` unless nonces are wired through — Next
injects inline bootstrap scripts and `next-themes` injects an inline
no-flash script into `<head>`. Nonces are the correct answer and are **out of
scope here**; say so in the header comment rather than leaving a future reader to
assume the CSP is stricter than it is.

**Ship `Content-Security-Policy-Report-Only` first** in all three, exercise every
flow (KYC camera capture, Realtime, print/PDF, the booker wizard behind the B10
gate), confirm zero violations, then switch to enforcing. Everything except the
CSP *is* byte-identical and duplicated deliberately (`conventions.md:42`), same as
the robots work.

---

### B10 — `booker` must be genuinely unreachable in production, not just hidden  ⬜ TODO
*(Added 2026-08-03 by D1 — "vendor + command only, booker gated behind a flag".)*
**Files:** `booker/` (new `middleware.ts`); `booker/app/api/register/route.ts`;
`booker/app/api/payment/create-session/route.ts`; `booker/app/page.tsx`

A `NEXT_PUBLIC_` flag is **not** a gate. The booking wizard writes to `bookings`
directly from the browser via the Supabase client — hiding the UI leaves the write
path fully open to anyone holding the anon key and a booker session. The gate has
to be server-side, and it has to close the account-creation path, because that is
what makes the write path unreachable:

1. **`middleware.ts`** in `booker` (the app has none today — none of the three
   do): when `BOOKER_ENABLED !== "1"` (a **server-only** var, no `NEXT_PUBLIC_`
   prefix), serve a static "coming soon" response.
   ⚠️ **The matcher must exclude `/api/payment/webhook`** (found on second
   review). Gating every path would black-hole PayMongo deliveries, and a dropped
   webhook is unrecoverable in this system — that is exactly I6. Any in-flight or
   test payment would leave a booker charged with `is_paid` permanently false.
   The webhook verifies its own HMAC signature and is safe to leave reachable.
2. **`POST /api/register` returns 503** under the same flag. This is the real
   lock: it is the only way a `booker` account is ever created, so with it closed
   nobody new can obtain the portal row + `member` role that every booker-side RLS
   policy requires. Booking becomes unreachable at the *database* layer, not just
   the UI.
3. **`POST /api/payment/create-session` returns 503** too — defence in depth for
   any account that already exists.
4. **Pre-existing booker accounts.** Any test booker created before launch keeps
   its portal row and can still book. Before cutover, enumerate
   `user_portals` for the `booker` portal on the production project and suspend or
   delete what is there. A gate that leaves five live test accounts behind is not a
   gate.

**Fix approach:** as above. The flag is the switch that flips on booker launch
day, at which point B8, B9 and I8 become blockers — record that dependency on
whichever plan carries the booker launch.

**Verification:** `curl` every booker route and both API routes with the flag
unset — all must return the gate response or 503; then set the flag locally and
confirm the full wizard still works, so the gate has not become a permanent
one-way door.

---

### B12 — There is no way to create the first Command user on a production project  ⬜ TODO
> 🔀 **MOVED (2026-08-08) → `.plans/2026-08-07-vendor-signup-production-preparations.md` as B-B4.** Copied there in full for the vendor sign-up launch so this plan could stay 📌 pinned. **Do not execute from here** — the live version is the other plan. Kept for the record per the status model.

*(Raised 2026-08-03 from the seeder question. The bootstrap gap is the real
finding; the lookup-table half of the ask turned out to need nothing — see
"Seeders" below.)*
**Files:** `command/app/api/users/route.ts:9-32`; `backbone/supabase/seed.sql:53-75`;
`backbone/scripts/`

`POST /api/users` is the only user-creation path, and `verifyCaller()` requires
the caller to **already be an active command admin/root** (`:14-27`). On a fresh
production project nobody satisfies that, so no Command user can ever be created
through the product. The only existing root is
`root@bookdeck.com` with the hardcoded password `Bookdeck@root1`
(`seed.sql:53-67`) — a **local-only** fixture that must never reach production,
and which `db push` correctly does not carry.

Result today: a production `db push` yields a complete, correct schema that
**nobody can log into**, and the platform cannot be administered at all.

**Fix approach — a script, not a seed file.** This distinction is the whole point:
`[db.seed]` runs on `db reset`, which is local-only and forbidden in production
(`database-reset-and-deploy.md:19`). A "production seeder" placed in `seed.sql`
would therefore **never execute in production** — it would look done and do
nothing.

New `backbone/scripts/bootstrap-root.mjs`, beside the existing
`wipe-kyc-storage.mjs`, using the service-role key from the environment:

1. Refuse to run if **any** `root` already exists — this mints a platform
   superuser and must never be a routine command.
2. `auth.admin.createUser({ email, email_confirm: true })` with **no password**,
   exactly as `command/app/api/users/route.ts:37-41` already does. No secret is
   read, written, or logged anywhere — satisfying AGENTS.md's red line directly
   rather than by convention.
3. Promote the trigger-created profile to `active`, insert
   `user_portals(command)` and `user_roles(root)`.
4. Print what it did and stop.

The operator then sets their own password via **Forgot Password** — the same flow
every Command-created user already uses (`portals.md:312`).

⚠️ **Hard dependency on B1.** With no password set, password recovery is the
*only* way in. If the redirect allow-list is wrong, this script produces an
account nobody can access and there is no second path. **B1 must be verified
working before B12 runs**, not merely scheduled ahead of it.

**Why not SQL.** Hand-writing `auth.users` needs a bcrypt hash — i.e. a password
in a file — and `seed.sql` was already bitten on hosted by exactly this:
`gen_salt`/`crypt` resolve differently there, needing all 16 call sites
schema-qualified (`database-reset-and-deploy.md:265-280`). Re-deriving that for
production, for one row, to gain nothing, is the wrong trade.

**Coupling:** with **I13** — if the last root's role is stripped, this script is
the only recovery, so it must stay runnable after launch, not be a one-shot.

---

### B11 — Government IDs are collected with no privacy notice and no consent anywhere  ⬜ TODO
> 🔀 **MOVED (2026-08-08) → `.plans/2026-08-07-vendor-signup-production-preparations.md` as A-B3 (⏸ parked there).** Copied there in full for the vendor sign-up launch so this plan could stay 📌 pinned. **Do not execute from here** — the live version is the other plan. Kept for the record per the status model.

*(Found on second review, 2026-08-03.)*
**Files:** `vendor/components/auth/LoginPage/` (the 6-step registration);
`booker/components/auth/LoginPage/`; `vendor/app/` (no `privacy` route)

Grepped `privacy`, `terms`, `consent`, `data protection`, `agree to` across both
registration flows: **zero hits.** The vendor KYC flow collects a photograph of a
government-issued ID, a selfie holding that ID, business permits, a full address
and a phone number — and presents no privacy notice, no consent checkbox, no
terms link, and no statement of what is retained or for how long. There is no
`/privacy` route in any of the three apps.

Under the Philippine Data Privacy Act 2012 an ID image plus a selfie is sensitive
personal information, and notice and consent are required **at the point of
collection**. The vendor-first launch *is* this flow — it is the first thing a
real vendor touches.

This is also the web half of what `ezzy-vendor-mobile` is already waiting on: its
own B6 tracks the missing privacy-policy and account-deletion routes, and its
Settings screen deliberately points at the portal root instead of a 404 until they
exist.

**Fix approach:**
1. A `/privacy` route in `vendor` (static page, no auth) — the same content the
   mobile store listing will need, so it is not duplicated later.
2. A consent checkbox on the KYC applicant-type step, gating Continue, naming what
   is collected, why, who reviews it, and the retention period. Record consent
   with the submission — a checkbox that leaves no trace proves nothing.
3. An account-deletion request route, which closes mobile's B6 and is a Google
   Play requirement.

⚠️ **This item needs a decision from you on content, not engineering** — the
retention period and the deletion process are business/legal choices this plan
cannot make. The engineering is small; the copy is the long pole. **Raise it now,
not at Stage 7**, because it may need external review.

**Coupling:** the retention period stated here must match what **I11** actually
implements, or the notice describes a deletion that never happens.

---

## IMPORTANT

### I1 — Three web surfaces show an auto-confirm countdown the database will not honour  ⬜ TODO
**Files:** `vendor/components/bookings/BookingRow/useBookingRow.ts:26-28,62-68`;
`booker/components/dashboard/BookingStatusWidget/useBookingStatusWidget.ts:19,54-58`;
`booker/components/dashboard/BookingDetailModal/useBookingDetailModal.ts:8,38`
**Reference implementation:** `ezzy-vendor-mobile/src/lib/autoConfirm.ts`

All three compute `3 - floor((now - statusChangedAt) / 86_400_000)`. None applies
the service-date gate that `20260801000009` added: a `fulfilled` booking is not
promoted until `booked_date <= today` in Asia/Manila.

So a vendor who marks a session done three weeks early sees "auto-confirms in 3
days", watches it hit zero, and nothing happens — next to their money. The mobile
app already models this correctly, including a `waitingForServiceDate` flag for
exactly this case. `portals.md:420` states the rule: where the two vendor clients
overlap they must agree, and a divergence is a bug in whichever one moved. The
web is the one that moved.

**Fix approach:** port `autoConfirmInfo()` into `vendor/lib/autoConfirm.ts` and
`booker/lib/autoConfirm.ts` — **copied, not imported** (`overview.md:104`) — and
replace all three inline computations. One helper per app kills the duplication
inside `booker` as a side effect. Each app gets a `node --test` case asserting a
future `booked_date` yields no countdown.

<!-- verification: machine-verifiable — unit test per app + type-check -->

### I2 — `getBookings()` is unbounded against a 1000-row PostgREST ceiling  ⬜ TODO
**Files:** `vendor/services/bookings.service.ts:47-68`;
`booker/services/bookings.service.ts:59-70`; `backbone/supabase/config.toml:18`

`max_rows = 1000`. PostgREST truncates and signals HTTP 206, which `supabase-js`
does not surface as an error — the same trap `transactions.service.ts` and
`command/services/payouts.service.ts` already defend against with an exact count
and explicit paging. Neither bookings service does.

Consequence at scale: the vendor's dashboard KPIs, pending-approval badge and
every filter tab silently describe the newest 1000 bookings while looking
authoritative. Not a launch-week problem; it is a problem that arrives without
any error.

**Fix approach:** copy the paged-with-exact-count pattern from
`transactions.service.ts` into both bookings services, with the same truncation
banner. Consider it a prerequisite for any vendor with real volume.

### I3 — The vendor is not told a booking is unpaid at the moment they approve it  ⬜ TODO
**File:** `vendor/components/bookings/BookingRow/useBookingRow.ts:74,80`

`unpaidWarning` deliberately excludes `pending`, so the warning appears only from
`confirmed` onward, and `needsUnpaidConfirm` gates the two `confirmed → …` moves.
The reasoning is sound *for committing work*. But approving is itself a
commitment: it consumes a capacity slot (`check_booking_capacity()` counts
`pending + confirmed`) that a paying booker could have taken.

**Fix approach:** surface a non-blocking "not paid yet" chip on `pending` rows.
Do **not** add a second confirm dialog — the existing one is correctly placed;
this is information at the decision point, not another gate.

### I4 — Hosted auth settings are weaker than the apps assume  ⬜ TODO
> 🔀 **MOVED (2026-08-08) → `.plans/2026-08-07-vendor-signup-production-preparations.md` as A-B5.** Copied there in full for the vendor sign-up launch so this plan could stay 📌 pinned. **Do not execute from here** — the live version is the other plan. Kept for the record per the status model.

**File:** `backbone/supabase/config.toml:173,179,182,196,218`

Four values to confirm and correct on the **hosted** project (the repo file is
the local stack's config and may or may not match):

| Setting | Current in repo | Risk | Recommend |
|---|---|---|---|
| `minimum_password_length` | `6` | weaker than the UI's 8 | `8` |
| `password_requirements` | `""` | none | keep, plus enable leaked-password protection (HIBP) in the dashboard |
| `enable_signup` | `true` (`:173`, `:218`) | anyone holding the public anon key can call `auth.signUp()` and create `auth.users` + `profiles` rows outside both registration routes | see I5 |
| `[auth.rate_limit] email_sent` | `2` (`:196`) | if mirrored on hosted, **two** auth emails per hour project-wide — password resets would be throttled to uselessness on day one | raise with custom SMTP configured |

### I5 — `enable_signup = true` leaves an unmanaged account-creation path open  ⬜ TODO
> 🔀 **MOVED (2026-08-08) → `.plans/2026-08-07-vendor-signup-production-preparations.md` as A-B5 (merged with I4).** Copied there in full for the vendor sign-up launch so this plan could stay 📌 pinned. **Do not execute from here** — the live version is the other plan. Kept for the record per the status model.

**File:** `backbone/supabase/config.toml:173,218`

Both registration flows go through service-role Route Handlers that use
`auth.admin.createUser`, which is **unaffected by `enable_signup`**. Nothing in
any app calls `auth.signUp()` (verified by grep). Turning the flag off therefore
closes a public write path into `auth.users` at zero cost to the product.

**Fix approach:** set `enable_signup = false` on the hosted project; verify both
registration routes and the Command create-user route still work. Bundle with I4.

### I6 — Payment confirmation has no fallback if a webhook delivery is lost  ⬜ TODO
**File:** `booker/app/api/payment/webhook/route.ts:5-14,40-56`

Two findings, of different weight:

1. **No reconciliation path.** `is_paid` is set *only* by this webhook, and
   `booking_transactions` exists *only* because of the `is_paid` false→true
   transition. If a delivery is lost — misconfigured endpoint, an outage
   outlasting PayMongo's retries, a secret rotated without redeploy — the booker
   has paid, the booking sits `pending`, and no ledger row is ever created. There
   is no sweep and no manual "mark as paid". Nothing surfaces the discrepancy.
2. **Non-constant-time signature comparison** at `:13` (`expected === envelope`).
   Low practical severity for an HMAC over an attacker-unknown body; cheap to fix
   with `crypto.timingSafeEqual` on equal-length buffers, so fix it.

**Fix approach:** add a Command-side reconciliation surface listing bookings with
a `payment_reference` but `is_paid = false` older than N minutes, and a
service-role "confirm payment" action that re-queries PayMongo by session id.
That single action also gives Command the manual lever the ledger's design note
anticipates (`schema.md:548` — anchoring the trigger to the *column* rather than
the webhook was done precisely so a manual mark-as-paid would work).

### I7 — `POST /api/users` has no rollback and no target-role restriction  ⬜ TODO
**File:** `command/app/api/users/route.ts:30-70`

The caller gate at `:9-28` is correct and well-built. Two gaps behind it:

- **No rollback.** Unlike both register routes, a failure after
  `createUser` (`:46-67`) leaves an auth user with no portal and no role. The
  booker route's `admin.deleteUser` rollback is the pattern to copy.
- **No target-role restriction.** Any `admin` can mint a `root`. This is already
  investigated in full in
  `.plans/2026-07-18-command-user-admin-privilege-tiering.md` — **DRAFT, PINNED,
  4 open decisions**. Not re-litigated here.

**Fix approach:** add the rollback now (small, self-contained, no decisions). Leave
privilege tiering pinned unless launch changes the risk appetite — see D4.

### I8 — Offering requirements are a no-op from end to end  ⏸ PARKED (2026-08-03)
*(Parked with the booker batch — same unblock condition as B8/B9. Left in the
IMPORTANT section because the broken half is a **vendor**-facing promise.)*
**Files:** `booker/components/booking/BookingWizard/Step4Documents/`;
`schema.md:475-489` (`booking_documents`); `portals.md:203` (vendor: not implemented)

A vendor defines required documents on an offering. The booker is shown them,
picks files, sees a progress bar, and is gated from continuing until "all
required" are uploaded. **Nothing is written.** No Storage object, no
`booking_documents` row, and no vendor-side viewer exists to read them if there
were.

The vendor believes they collected a driver's licence. Nobody collected anything.
This is the largest *unfulfilled promise* between the two apps, and it is
squarely in the booker-launch batch rather than the vendor one.

**Fix approach:** implement per the flow already drafted in `booking-flow.md:137-141`
(booking first, then upload to `bookings/{booking_id}/{doc_id}`, then rows), plus a
Storage policy and a vendor-side viewer. Sized as its own plan, not an item here.

### I9 — Architecture documents disagree with the code in four places  ⬜ TODO
**Files:** `architecture/portals.md:130,204`; `architecture/overview.md:158`;
`booker/CLAUDE.md`

Corrections are tabulated under "What the investigation found" above. `booker/CLAUDE.md`
is the worst of them: it describes Next.js 15 and states "No environment variables
required for the current feature set" for an app that cannot take a payment
without `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET`.

**Fix approach:** documentation only. Fold into whichever stage touches each area
so the doc and the code move together.

### I10 — A wrong email at registration is unrecoverable  ⬜ TODO
> 🔀 **MOVED (2026-08-08) → `.plans/2026-08-07-vendor-signup-production-preparations.md` as A-I8.** Copied there in full for the vendor sign-up launch so this plan could stay 📌 pinned. **Do not execute from here** — the live version is the other plan. Kept for the record per the status model.

**Files:** `vendor/app/api/auth/register/route.ts:98-101`;
`command/components/users/UserModal/`; `auth-and-roles.md:30`

`handle_user_email_update` syncs `auth.users` → `profiles`. There is no reverse
path, and Command's user editor writes `profiles`. So a mistyped registration
email cannot be corrected by anyone through any UI, and recovery mail goes to an
address the vendor does not own. Combined with B1 this is how an account becomes
permanently dead.

**Fix approach:** add an admin action to `POST /api/users` (or a sibling route)
calling `auth.admin.updateUserById({ email })` behind the existing `verifyCaller`
gate. Enabling email confirmations at signup would prevent the class entirely but
changes the "live immediately" property of both registration flows — deliberately
left as a follow-on, not bundled here.

### I11 — Deleting a vendor orphans their ID photos in Storage permanently  ⬜ TODO
*(Found on second review, 2026-08-03.)*
**File:** `command/hooks/mutations/vendors/useDeleteVendor.ts:15`

`deleteVendor` guards against destroying booking history (`:7-13`, good) and then
deletes the `vendors` row. The FK cascade removes `vendor_kyc` and
`vendor_kyc_documents` **rows**, but nothing touches the `vendor-kyc` bucket: the
government ID and selfie images stay in Storage forever, now with no row pointing
at them and no vendor to ask. `schema.md:750` already records that Storage blobs
survive everything and points at a manual script (`wipe-kyc-storage.mjs`) that
nobody has a reason to run.

Same class of leak on the resubmit path is **already handled** — `resubmitKyc`
removes the Storage object when a document is dropped
(`vendor/services/kyc.service.ts:159`). Deletion is the one path that forgets.

**Fix approach:** delete the vendor's Storage prefix as part of the same action.
It needs service role (the vendor's own session is gone), so this becomes a
`DELETE /api/vendors` Route Handler behind `verifyCaller()` — the pattern
`command/app/api/users/route.ts:9-28` already establishes. Storage first, row
second: an orphaned row is recoverable, an orphaned blob is not findable.

**Coupling:** the retention period **B11**'s privacy notice states must match what
this implements. Ship the copy and the code aware of each other.

### I12 — Command can activate a vendor whose KYC was rejected  ⬜ TODO
*(Raised on second review; the gap itself is documented as deferred item 8a in
`vendor-kyc.md` / `portals.md:215`.)*
**Files:** `command/hooks/mutations/vendors/useUpdateVendor.ts:15`;
`command/services/kyc-admin.service.ts:77-95`

KYC approval is advisory: `reviewKyc` writes `vendor_kyc.status`, and the activate
control writes `vendors.status_id`, with **nothing connecting them**. An admin can
activate a vendor whose packet is still `submitted`, or one they just rejected —
and an active vendor is immediately visible to bookers.

For a launch whose entire vendor-onboarding story is "we verify identity before
you trade", that is the control failing open. It is listed as deferred in the KYC
docs, which was reasonable while nothing was live.

**Fix approach:** the light version is a confirmation in the activate flow when
`vendor_kyc.status <> 'approved'`, naming the actual state — this is a UI guard
and needs no schema change. A hard DB gate is the deferred 8a item and stays
deferred; do not upgrade it silently here. **Recommend the light version for
launch** — it keeps the admin's discretion (there are legitimate reasons to
activate ahead of a packet) while making the exception deliberate rather than
invisible.

### I13 — Editing a user deletes their roles and portals before re-inserting, with no transaction  ⬜ TODO
*(Found 2026-08-03 while verifying Command's user CRUD.)*
**File:** `command/hooks/mutations/users/useUpdateUser.ts:22-35`

`updateUser` runs, as four separate un-wrapped client calls:

```ts
await supabase.from("user_portals").delete().eq("user_id", id)   // :22
… insert                                                          // :25-27
await supabase.from("user_roles").delete().eq("user_id", id)      // :31
… insert                                                          // :33-34
```

Any failure between a delete and its insert — a dropped connection, a mid-edit
tab close, an RLS refusal — leaves the user with **no portals and/or no role**.
They are silently locked out of every portal, and the UI reports only the second
error, if it is still on screen to report it.

Two aggravating properties:
- **The last `root` is not protected.** `verifyCaller()` blocks self-*deletion*
  (`command/app/api/users/route.ts:78`) but nothing blocks demoting or stripping
  the only root — via this path or by simply choosing a different role in the
  form. Every role in `ALL_ROLES` is offered unconditionally
  (`lib/constants.ts:35`, `UserModal.tsx:107-108`).
- **There is no recovery.** Until **B12** exists, a platform with no root cannot
  mint one, and Command becomes permanently unadministrable. This is the coupling
  that turns an edge case into an outage.

**Fix approach:** move the reconciliation server-side into the existing
`/api/users` route as a `PATCH`, behind the same `verifyCaller()` gate, and make
it **additive-then-subtractive** — insert the new rows, delete only the ones no
longer wanted — so no window exists in which the user holds nothing. Add a
last-root guard alongside the existing self-delete guard: refuse to remove `root`
from the final holder of it.

Postgres has no multi-statement transaction over PostgREST, so "wrap it in a
transaction" is not available from the client — which is exactly why this belongs
in a route handler where the ordering can be controlled, or in a definer RPC if
true atomicity is later wanted. Do **not** paper over it with client-side retry.

**Coupling:** with **B12** (the only recovery path) and with the pinned
privilege-tiering plan, which owns the separate question of *who* may edit
privileged users.

---

## Booker-launch batch — ⏸ PARKED (2026-08-03)

**Parked by D1:** booker is not launching with vendor and will sit behind the B10
gate, so with no reachable bookers there are no bookings and none of these can
fire in production. **Unblock condition: the day B10's `BOOKER_ENABLED` flag is
turned on.** All three are blockers *at that moment*, not "nice to have then" —
B9 in particular means the platform would be taking consumer money with no refund
mechanism anywhere in the codebase.

### B8 — An unpaid booking is a permanent dead end that consumes a vendor's slot  ⏸ PARKED (2026-08-03)
**Files:** `booker/components/booking/BookingWizard/useBookingWizard.ts:134-186`;
`booker/services/bookings.service.ts:24-42`;
`backbone/supabase/migrations/20260801000002_booking_fulfilment_states.sql:112-114`

The booking row is inserted *before* payment (`:134`), then the browser leaves for
PayMongo (`:186`). If the booker abandons checkout, or `create-session` fails
(`:172-176`), the row stays `pending` forever. Then:

- **They cannot pay it.** `create-session` is called from exactly one place — the
  wizard's `confirmBooking` (verified by grep). No surface offers payment for an
  existing booking.
- **They cannot re-book.** `UNIQUE (booker_id, schedule_id, booked_date)` returns
  `23505` → `"already_booked"` → the toast *"You already have a booking for this
  slot."* (`:141-145`), which is true and useless.
- **They cannot cancel.** The booker has no write path to `bookings.status` at
  all; `acknowledge_booking` covers only the fulfilment moves.
- **The vendor's slot stays consumed.** `check_booking_capacity()` counts
  `pending + confirmed`, so an abandoned checkout blocks a paying booker.

Three exits are needed and only one of them is new work of any size. Note the
trigger currently permits `pending → cancelled` for **vendor-admin and command
only** — `v_system` is absent (`20260801000002:114`), so a cron-driven expiry
sweep would be rejected by the database as written. See **D3**.

**Fix approach:** (a) a "Complete payment" action on any `pending`,
`is_paid = false` booking that POSTs the existing `bookingId` to
`/api/payment/create-session` — the route already authenticates the caller and
verifies ownership, so this needs **no API change at all**; (b) a booker-side
cancel of an own `pending` booking, via an RPC alongside `acknowledge_booking`;
(c) the expiry sweep, gated on D3.

### B9 — Money can be taken and never returned, by design, with no tooling  ⏸ PARKED (2026-08-03)
**Files:** `booking-flow.md:374-381`; `portals.md:213`;
`20260801000003_booking_payout_status.sql:31`

A booking paid through PayMongo and then cancelled by the vendor sets
`payout_status = 'reversed'` — the vendor is not paid — but **PayMongo's refund
API is never called anywhere in this codebase**. The booker's money is retained
by the platform, and nothing in any portal says so or tracks it. The schema is
explicit and correct about this (`:31` — never label `reversed` as "Refunded"),
which makes it a known, deliberate hole rather than a bug.

Launching a consumer payment flow in this state is a commercial and regulatory
exposure, not just a feature gap.

**Fix approach:** at minimum, before bookers can pay: a Command surface listing
paid-then-cancelled/refunded bookings with the amount owed back to the booker,
and a written manual refund runbook. A real PayMongo refund integration is its own
plan. `getOwedBack()` in `command/services/payouts.service.ts:98-104` already
covers the *platform-out-of-pocket* direction — this is the mirror case
(booker-out-of-pocket) and has no equivalent.

---

## DECISIONS

<!-- All four closed 2026-08-03. No OPEN lines remain — the execution gate is clear. -->

- **D1 — Is `booker` launching with `vendor`?** → **Vendor + Command only; booker
  gated behind a flag** (resolved 2026-08-03). Adds **B10** (the gate must be
  server-side and must close the registration route, not merely hide the UI).
  B8, B9 and I8 move to ⏸ PARKED with "the day the flag flips" as their unblock
  condition. Launch gate is **B1–B7 + B10**.

- **D2 — How should KYC documents reach Storage? (B2)** → **Signed upload URLs**
  (resolved 2026-08-03, matches the recommendation). The route mints per-file
  `createSignedUploadUrl`s, the browser uploads straight to Storage, then posts
  the paths back for the atomic create. Fixes the cause rather than the symptom,
  preserves the documented "no account until submit succeeds" guarantee
  (`auth-and-roles.md:52-56`, D-7 = D) and service-role control of every path, and
  matches how the resubmit path already behaves. Rejected: capping the packet
  (symptom-only, refuses legitimate 5 MB permits), two-phase (overturns D-7).
  **Still required alongside it:** document-count and total-bytes caps, and an
  explicit `maxDuration` — the signed-URL route removes the *body* limit, not the
  abuse surface B6 describes.

- **D3 — Command's fabricated Overview/Transactions: remove or wire?** → **Wire to
  `booking_transactions` now** (resolved 2026-08-03). Chosen over the
  recommendation to remove-then-wire. Consequence recorded honestly at B3: this is
  the days-not-hours option and it puts a schema approval gate (Appendix B) on the
  critical path to launch. `PaymentMethodsCard` is deleted either way — no payment
  method is recorded anywhere in the schema.

- **D4 — Expiry sweep for unpaid `pending` bookings? (B8c)** → **Yes, in the booker
  batch, after B8(a) ships** (resolved 2026-08-03, matches the recommendation).
  Needs a `v_system` branch on `pending → cancelled` in
  `validate_booking_status_transition` (⚠️ schema approval gate) plus a `pg_cron`
  job. Parked with the rest of the booker batch; ordering within it is fixed —
  "Complete payment" first, sweep second, because a sweep without a payment path
  cancels bookings the booker had no way to finish.

---

## DEFERRED / COSMETIC

- **Command privilege tiering** (any `admin` can mint a `root`). Real, already
  fully investigated in `.plans/2026-07-18-command-user-admin-privilege-tiering.md`
  (PINNED, 4 open decisions). Acceptable at launch: Command is a small, fully
  trusted internal team. Revisit before the first non-founder admin is added.
- **Vendor Packages page** — already disabled in `PageId`, `Sidebar` and
  `AppShell`. No action.
- **Vendor map markers** — booker-only, needs `lat`/`lng` on `vendors`. Not on the
  vendor-launch path.
- **Command platform-wide bookings view** — an oversight convenience, not a gate.
  `FulfilmentOversightCard` already covers the case that freezes money.
- **Vendor Transactions live-refresh** — deliberately deferred in `portals.md:229`;
  the page is for reviewing history. Unchanged.
- **`vendor/.env.local.example`** is matched by `.gitignore`'s `.env*`, so it is
  not actually committed, and `booker`/`command` have no example at all. Worth a
  `env.example` (no dot) per app at some point; not a launch gate.

---

## Execution order

Stages are ordered by risk and dependency, not by numbering. **One stage at a
time by default** (`developerboss` cadence) — say so explicitly to run a range.

**Stage 0 — ✅ DONE (2026-08-03).** D1–D4 closed. Launch gate is **B1–B7 + B10 +
B11** (B11 added by the second review).

**Stage 0b — start B11's copy now, in parallel with everything else.** The
engineering in B11 is a static route and a checkbox; the *content* — retention
period, deletion process, what Command reviewers may see — is a business and
possibly legal decision with an external turnaround this plan cannot compress.
It is the only launch blocker whose long pole is not code, so it must not wait
for Stage 7. Its retention answer also feeds **I11**.

**Stage 1 — configuration + bootstrap (safe now, highest value).** In this order,
because the order is a dependency and not a preference:
1. **B1** (redirect allow-list) — and *verify a real reset arrives and works*.
2. **I4 + I5** (password floor, leaked-password protection, `enable_signup`,
   email rate limit).
3. **B12** (`bootstrap-root.mjs`) — **only after B1 is proven**, since the account
   it creates has no password and recovery is the sole way in.

All on the hosted project; the only repo artefact is one script in `backbone` plus
the `config.toml` alignment. Extends I24's checklist in the fulfilment plan.
Nothing here touches the three app repos.

**Stage 2 — B10.** Gate `booker` before anything else is deployed publicly. Ahead
of the remaining code stages deliberately: every later stage means more deploys,
and an ungated booker reachable during any of them is the exposure this stage
exists to close.

**Stage 3 — independent code fixes, no gates.** B7 (security headers, report-only
first), I1 (auto-confirm countdown ×3), I3 (unpaid chip), I7 (rollback), **I13**
(non-atomic role/portal rewrite + last-root guard), plus I9's doc corrections for
the areas touched. Safe to run in one pass — no schema, no decisions, all
machine-verifiable. I13 sits here rather than later because until it lands, every
user edit in Command carries a lockout risk whose only cure is B12.

**Stage 4 — B4 + I12.** Vendor access verification and the blocked-state copy,
plus the activate-without-approved-KYC guard. Grouped because both are the same
question — "what state is this vendor actually in, and does the UI say so" — and
both touch the vendor/Command boundary.

**Stage 5 — B2 (per D2) + B11's engineering.** Signed upload URLs with the staging
prefix and service-role move, packet caps, `maxDuration`; and the `/privacy` route
plus the consent checkbox, which lands in the same registration flow. One pass
over `LoginPage` rather than two. Needs Stage 0b's copy to exist by now.

**Stage 6 — B5 + B6 (coupled, ⚠️ schema gate).** The KYC/activation notifications
need working email delivery, and the rate limiting lands on the same routes those
notifications fire from — including B2's new `prepare` route. **Ship together.**
Appendix A must be approved first, plus B6's rate-limit store decision (and its
own SQL draft, if the table option is chosen).

**Stage 7 — B3 (per D3, ⚠️ schema gate).** Command's Overview and Transactions.
Last of the launch blockers because it is the largest and the only one whose scope
grew at decision time; Appendix B must be approved first. If launch timing
tightens, this is the stage to reconsider against D3's rejected option — say so
early rather than shipping half-wired cards.

**Stage 8 — I2, I6, I11.** Paging ceilings, payment reconciliation, and Storage
cleanup on vendor deletion. "Correct now, wrong later" rather than launch gates —
but I6 becomes urgent the moment the booker flag flips (it is the only safety net
under a lost webhook), and I11 must not ship *later* than whatever retention
period B11's notice commits to in writing.

**Booker batch — ⏸ PARKED until the B10 flag flips.** B8(a) "Complete payment" →
B8(b) booker cancel → D4's expiry sweep → B9 → I8. Order is fixed, not
preference: the sweep must not precede the payment path.

---

## Verification

| Item | How | Kind |
|---|---|---|
| B1 | Real password-reset round trip on each portal origin | **live environment** |
| B2 | Caps: unit test + type-check. 4.5 MB behaviour: deployed preview upload | mixed |
| B3 | Type-check; grep asserts no `BOOKING_TREND` / `VENDOR_TREND` / `ALL_TXNS` import remains under `command/components/`; each KPI cross-checked against a hand-run SQL aggregate on the same data; truncation banner exercised past the row ceiling | machine + **live environment** |
| B10 | `curl` every booker route and both API routes with `BOOKER_ENABLED` unset — gate response or 503, no exceptions; then set it and confirm the wizard still completes; plus an enumeration of existing `booker` `user_portals` rows on the production project | machine + **live environment** |
| B4 | Playwright: suspended user, suspended vendor, pending vendor, revoked portal — four distinct screens | **live environment** (needs seeded DB states) |
| B5 | Migration applies; approve a KYC packet locally and assert one `notifications` row + one `notification_emails` row per vendor-admin | **live environment** |
| B6 | Unit test the caps and the 8-char floor; rate limiter tested with a scripted burst | machine |
| B7 | `curl -I` each app for the header set; CSP report-only with zero violations before enforcing | machine |
| I1 | `node --test` per app: future `booked_date` ⇒ no countdown; `returned` exempt | machine |
| I2 | Seed >1000 bookings for one vendor; assert the truncation banner and an exact count | **live environment** |
| B12 | Run against a fresh project: script refuses when a root exists; on success the account can complete a real password reset and reach Command. Assert `db push` alone produces every lookup row (count `divisions` = 13, `notification_type_settings` = 13, `fulfilment_patterns` = 2) with no seed run | **live environment** |
| I13 | Force an insert failure mid-edit (revoke a grant, or a scripted call) and assert the user still holds a role and portals; attempt to demote the only root — must be refused | machine + **live environment** |
| B11 | `/privacy` reachable unauthenticated; Continue blocked without consent; consent recorded against the submission and readable afterwards | machine + browser |
| I11 | Delete a test vendor, then list the bucket prefix — must be empty; assert the booking-history guard still refuses deletion | **live environment** |
| I12 | Attempt activation with `vendor_kyc.status` `submitted` and `rejected` — confirmation names the real state both times | browser |
| I3, I7, I9 | Type-check + read-back | machine |
| I4, I5 | Attempt a 7-char password and a raw `auth.signUp()`; both must fail | **live environment** |
| I6 | Replay a webhook with a tampered signature (must 400); drop one delivery and confirm the reconciliation surface lists it | **live environment** |

Nothing in this plan is marked ✅ on the strength of a clean build. Every item
above that says **live environment** stays 🔄 until it has actually been run
there.

---

## Appendix A — B5 schema change (draft, NOT applied)

⚠️ **Approval gate.** Written here for review; the migration file is not created
until the user says go.

```sql
-- 202608XXXXXXXX_vendor_kyc_notifications.sql
insert into public.notification_type_settings (type, label, description, is_enabled)
values
  ('vendor_kyc_reviewed', 'KYC Reviewed',
   'Ezzy has approved or rejected a vendor''s KYC packet. Sent to the vendor.', true),
  ('vendor_activated',    'Vendor Activated',
   'Ezzy has activated a vendor account. Sent to the vendor''s admins.', true)
on conflict (type) do nothing;
```

**Blast radius:**
- **Data** — two inserts into a seed-fixed lookup table. No existing row is read,
  rewritten or revalidated. Nothing can fail validation.
- **Lock / performance** — row-level insert on a table with 13 rows. Negligible.
- **Downstream** — `notifications.type` is `FK → notification_type_settings(type)
  ON DELETE RESTRICT`, so these rows must exist *before* any code writes a
  notification of either type: **migration ships in the same batch as, and ahead
  of, the app code**. Both new types are covered by
  `notifications_dispatch_email` automatically, which means the
  `send-notification-email` Edge Function needs a template branch for each, or
  they fall through to its default. Check that before shipping. No grants needed
  — the table's grants already exist (`20260620000001`). No hand-written
  TypeScript interface changes: the apps read `type` as `text`.
- **Reversibility** — `delete from public.notification_type_settings where type in
  (...)`, safe only while no `notifications` row references either type
  (RESTRICT will refuse otherwise, which is the correct behaviour).

**Not included, deliberately (A):** the trigger. Both events originate in Command's
app layer (a reviewer clicking approve, an admin flipping the vendor active), not
from a database state change with a single unambiguous meaning — so the write
belongs in `command/services/kyc-admin.service.ts` and the vendor-activation
path, alongside how `vendor_pending_approval` is already written from
`vendor/app/api/auth/register/route.ts:160-184`.

---

## Appendix B — B3 platform aggregates RPC (draft, NOT applied)

⚠️ **Approval gate**, pulled onto the launch critical path by D3. Written here for
review; the migration file is not created until the user says go.

Command's four KPI figures must not be computed by fetching rows into the
browser — `max_rows = 1000` plus PostgREST's silent 206 would make them
confidently wrong (I2). One definer RPC returns all four in a single round trip:

```sql
-- 202608XXXXXXXX_platform_overview_stats.sql
create or replace function public.get_platform_overview_stats()
returns table (
  total_bookings    bigint,
  bookings_this_month bigint,
  bookings_prev_month bigint,
  platform_revenue  numeric,
  funds_held        numeric,
  active_vendors    bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.bookings),
    (select count(*) from public.bookings
      where booked_date >= date_trunc('month', (now() at time zone 'Asia/Manila'))::date),
    (select count(*) from public.bookings
      where booked_date >= (date_trunc('month', (now() at time zone 'Asia/Manila')) - interval '1 month')::date
        and booked_date <  date_trunc('month', (now() at time zone 'Asia/Manila'))::date),
    (select coalesce(sum(platform_fee_amount), 0) from public.booking_transactions),
    (select coalesce(sum(payout_amount), 0) from public.booking_transactions
      where payout_status in ('held', 'releasable')),
    (select count(*) from public.vendors v
       join public.statuses s on s.id = v.status_id where s.name = 'active')
  where public.is_portal_member('command')
    and (public.has_role('admin') or public.has_role('root'));
$$;

grant execute on function public.get_platform_overview_stats() to authenticated, service_role;
```

**The `where` clause is the access control, and it is load-bearing.** A
`SECURITY DEFINER` function bypasses RLS, so without it any authenticated user —
every booker, every vendor-admin — could read platform-wide revenue. Failing the
check returns **zero rows**, which the hook must render as `—` (unavailable), never
as `₱ 0`. That distinction is the same one the vendor dashboard already makes
(`portals.md:112`), and getting it wrong here would show a booker a confident zero
instead of nothing.

**Blast radius:**
- **Data** — read-only. Creates no table, alters no row, holds no lock beyond the
  read. Nothing to roll back and nothing that can fail validation.
- **Lock / performance** — six aggregates per call, on the Command landing page.
  `bookings` needs a `booked_date` index if one is absent — **check before
  shipping**; the counts are otherwise sequential scans that will degrade quietly
  as volume grows. `booking_transactions` is already indexed on
  `(vendor_id, payout_status)` (`20260801000003:38`), which does not serve an
  unfiltered platform-wide sum — measure with `explain analyze` on realistic
  volume rather than assuming.
- **Downstream** — one new hand-written TypeScript interface in
  `command/services/` (this repo does not use `supabase gen types` —
  `overview.md:103`). No app currently reads these figures from anywhere real, so
  nothing existing changes behaviour.
- **Reversibility** — `drop function public.get_platform_overview_stats();`. Safe
  at any time; only Command's Overview calls it.

**Deliberately excluded:** the per-vendor breakdown behind `WalletBalancesCard` and
the Transactions table itself. Both are row-level reads that RLS already scopes
correctly for a Command admin, so they go through normal paged queries — a definer
RPC there would bypass RLS for no benefit and widen the blast radius of a mistake.

---

## Appendix C — File manifest (for branch prep)

Grouped by stage. **N** = new file, **M** = modified, **D** = deleted.
Paths are workspace-root-relative; remember each app is its own git repo, so
commits happen **inside** the app folder (AGENTS.md).

### Stage 1 — hosted configuration + root bootstrap (B1, I4, I5, B12)
| | Path | Note |
|---|---|---|
| M | `backbone/supabase/config.toml` | `site_url`, `additional_redirect_urls`, `minimum_password_length` → 8, `enable_signup` → false, `[db.seed] enabled` → false in the prod profile |
| N | `backbone/scripts/bootstrap-root.mjs` | B12 — service role from env, no password, refuses if a root exists |
| M | `backbone/scripts/README.md` | document when to run it and the B1 prerequisite |
| M | `backbone/package.json` | add the script entry (`@supabase/supabase-js` is already a dependency — no install) |
| M | `architecture/database-reset-and-deploy.md` | Production section: bootstrap step + "lookup tables come from migrations, never seed" |
| M | `.plans/2026-07-31-booking-fulfilment-dual-acknowledgement.md` | extend the **I24** cutover checklist; do not duplicate it |
| — | `backbone/supabase/seed.sql` | **unchanged, deliberately** — it is a local fixture and stays one |

> Most of this stage is Supabase dashboard configuration, not code. Only
> `backbone` gains files. **The three app repos are untouched — no app branch
> needed.**

### Stage 2 — booker gate (B10) · repo: `booker`
| | Path |
|---|---|
| N | `booker/middleware.ts` |
| N | `booker/app/coming-soon/page.tsx` *(or an inline middleware response — implementer's call)* |
| M | `booker/app/api/register/route.ts` |
| M | `booker/app/api/payment/create-session/route.ts` |
| — | `booker/app/api/payment/webhook/route.ts` — **must stay reachable**, excluded from the matcher |

### Stage 3 — independent fixes (B7, I1, I3, I7, I9)
| | Path | Item |
|---|---|---|
| M | `vendor/next.config.ts` · `booker/next.config.ts` · `command/next.config.ts` | B7 |
| N | `vendor/lib/autoConfirm.ts` · `booker/lib/autoConfirm.ts` | I1 — copied, not imported |
| N | `vendor/lib/autoConfirm.test.ts` · `booker/lib/autoConfirm.test.ts` | I1 |
| M | `vendor/components/bookings/BookingRow/useBookingRow.ts` | I1 (`:26-28,62-68`), I3 (`:74,80`) |
| M | `vendor/components/bookings/BookingRow/BookingRow.tsx` | I1 render (`:52-54`), I3 chip |
| M | `booker/components/dashboard/BookingStatusWidget/useBookingStatusWidget.ts` | I1 (`:19,54-58`) |
| M | `booker/components/dashboard/BookingDetailModal/useBookingDetailModal.ts` | I1 (`:8,38`) |
| M | `command/app/api/users/route.ts` | I7 rollback (`:30-70`); I13 new `PATCH` + last-root guard |
| M | `command/hooks/mutations/users/useUpdateUser.ts` | I13 (`:22-35`) — call the route instead of four bare client writes |
| M | `architecture/portals.md` · `architecture/overview.md` · `booker/CLAUDE.md` | I9 |

### Stage 4 — vendor access + KYC gate (B4, I12)
| | Path |
|---|---|
| N | `vendor/services/vendor-access.service.ts` |
| M | `vendor/components/layout/AppShell/useAppShell.ts` *(`:130-174`)* |
| M | `vendor/components/auth/LoginPage/useLoginPage.ts` *(`:144-176`)* |
| M | `vendor/components/kyc/KycStatusPage/useKycStatusPage.ts` · `KycStatusPage.tsx` · `.module.css` |
| M | `command/hooks/mutations/vendors/useUpdateVendor.ts` *(I12, `:15`)* |
| M | `command/components/vendors/VendorViewModal/` *(I12 confirmation)* |
| M | `architecture/auth-and-roles.md` |

### Stage 5 — KYC uploads + privacy (B2, B11)
| | Path |
|---|---|
| N | `vendor/app/api/auth/register/prepare/route.ts` |
| M | `vendor/app/api/auth/register/route.ts` *(JSON body; `storage.move()`; rollback extended)* |
| M | `vendor/services/kyc.service.ts` *(submit path → two-phase)* |
| M | `vendor/components/auth/LoginPage/useLoginPage.ts` *(`:292` caps, `:349-388` submit, consent gate)* |
| M | `vendor/components/auth/LoginPage/LoginPage.tsx` *(consent checkbox)* |
| M | `vendor/lib/constants.ts` *(doc-count + total-bytes caps)* |
| N | `vendor/app/privacy/page.tsx` · `vendor/app/privacy/page.module.css` |
| N | `vendor/app/account-deletion/page.tsx` *(closes mobile's B6)* |
| N | `backbone/scripts/sweep-pending-kyc.mjs` *(staging-prefix cleanup)* |
| M | `architecture/vendor-kyc.md` · `architecture/auth-and-roles.md` *(D-7 wording)* |

### Stage 6 — notifications + abuse controls (B5, B6) ⚠️ schema gate
| | Path |
|---|---|
| N | `backbone/supabase/migrations/<ts>_vendor_kyc_notifications.sql` *(Appendix A)* |
| N | `backbone/supabase/migrations/<ts>_rate_limit_hits.sql` *(only if the table option wins — needs its own draft first)* |
| M | `backbone/supabase/functions/send-notification-email/` *(template branch per new type)* |
| M | `command/services/kyc-admin.service.ts` *(`:77-95` — notify on review)* |
| M | `command/hooks/mutations/vendors/useUpdateVendor.ts` *(notify on activation)* |
| N | `vendor/lib/rateLimit.ts` · `booker/lib/rateLimit.ts` |
| M | `vendor/app/api/auth/register/route.ts` · `.../prepare/route.ts` · `vendor/app/api/divisions/route.ts` |
| M | `booker/app/api/register/route.ts` |
| M | `architecture/schema.md` *(notification types table)* |

### Stage 7 — Command real data (B3) ⚠️ schema gate
| | Path |
|---|---|
| N | `backbone/supabase/migrations/<ts>_platform_overview_stats.sql` *(Appendix B)* |
| N | `command/services/transactions.service.ts` |
| N | `command/services/overview.service.ts` |
| M | `command/components/overview/OverviewPage/useOverviewPage.ts` *(`:2,7-16`)* · `OverviewPage.tsx` *(`:46`)* |
| N | `command/components/overview/WalletBalancesCard/useWalletBalancesCard.ts` | 
| N | `command/components/overview/VendorTrendsCard/useVendorTrendsCard.ts` |
| N | `command/components/overview/BookingTrendsCard/useBookingTrendsCard.ts` |
| M | the three cards' `.tsx` *(logic out of the render layer)* |
| D | `command/components/overview/PaymentMethodsCard/` *(all three files — no data source exists)* |
| M | `command/components/transactions/TransactionsPage/useTransactions.ts` *(`:3,23`)* + the table/row/summary/filter components for the new column set |
| M | `command/lib/constants.ts` *(drop `ALL_TXNS`, `genTxns`, `BOOKING_TREND`, `VENDOR_TREND`, `PAYMENT_METHODS`)* |
| M | `command/lib/types.ts` *(drop the dead `revenue` field)* |
| M | `command/services/vendors.service.ts` *(`:27`)* |
| M | `architecture/portals.md` *(Command live-vs-mock table)* |

### Stage 8 — post-launch correctness (I2, I6, I11)
| | Path |
|---|---|
| M | `vendor/services/bookings.service.ts` *(`:47-68`)* · `booker/services/bookings.service.ts` *(`:59-70`)* |
| M | `booker/app/api/payment/webhook/route.ts` *(`:5-14` timing-safe compare)* |
| N | `command/app/api/payments/reconcile/route.ts` + a Command surface for it |
| N | `command/app/api/vendors/route.ts` *(I11 — service-role DELETE behind `verifyCaller`)* |
| M | `command/hooks/mutations/vendors/useDeleteVendor.ts` *(`:15`)* |

### Branch suggestion
One branch per stage per repo, since the repos are independent and the stages
are already ordered by dependency:

```
backbone   feat/prod-launch-stage6-notifications, feat/prod-launch-stage7-stats
vendor     feat/prod-launch-stage3-fixes, -stage4-access, -stage5-kyc-privacy, -stage6-abuse
booker     feat/prod-launch-stage2-gate, -stage3-fixes, -stage6-abuse, -stage8-payments
command    feat/prod-launch-stage3-fixes, -stage4-kyc-gate, -stage6-notify, -stage7-realdata, -stage8-cleanup
```

Stage 1 needs no branch. Stage 3 touches all four repos — the AGENTS.md
cross-app approval gate applies to it, to Stage 6 and to Stage 7.
