# Vendor launch — outstanding follow-ups

**Date:** 2026-08-25
**App / scope:** `vendor`, `command`, `backbone`, Play Console, `ezzy.ph`
**Status:** DRAFT — nothing started. Successor to
`.plans/2026-08-21-vendor-account-deletion.md`, which is COMPLETE.

> One-line framing: everything left over once vendor account deletion shipped — one live
> verification that has never run, one pre-existing bug that silently affects vendors today,
> and the test-coverage debt that made both harder to find than they should have been.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** L# = launch blocker, F# = follow-up, C# = cosmetic. Numbers are
> plan-local. Items carried from another plan keep a reference to their origin.

---

## Where this came from

`.plans/2026-08-21-vendor-account-deletion.md` shipped account closure across `backbone`,
`vendor`, `command`, `ezzy-vendor-mobile` and `ezzy.ph` between 2026-08-21 and 2026-08-25.
Everything in that plan is done and committed.

Three categories were deliberately left out of it, and are gathered here so the reasoning
survives:

1. **Verification that needs a running stack** — the plan could type-check, unit-test and
   database-verify, but never exercised a route over HTTP with a real session.
2. **Pre-existing defects found while working** — reported at the time, not fixed, because
   fixing them inside a feature plan is how scope quietly doubles.
3. **Test-coverage debt** — two apps, two different gaps, and it is why (2) went unnoticed.

⚠️ **The user owns L1 and L2** and has said so explicitly. Everything else is unassigned.

---

## LAUNCH BLOCKERS

### L1 — No route has ever run over HTTP with a session ⬜ TODO — **user-owned**
**Owner:** the user, who is running this during testing.

Every route in the closure feature is type-checked, unit-tested, and — for the destructive
sequence — verified step by step against the local database. **None has been called from a
browser with a real session.** Three things in particular have never executed:

| Never run | Why it matters |
|---|---|
| **B5 step 5 — the email wait** | `execute.server.ts` writes the confirmation, then polls `notification_emails` for `sent`/`failed` before deleting the auth user. If that ordering is wrong the email silently never sends: `notifications` cascades from `profiles`, and the Edge Function resolves the recipient from `profiles`/`auth.users`. **No error is raised in the failure case** — that is the whole reason the wait exists |
| **I9 — `SIGNED_OUT`** | `auth.admin.deleteUser` invalidates refresh tokens but leaves the issued access JWT valid. supabase-js should emit `SIGNED_OUT` when the pre-expiry refresh fails; nothing offline can prove it does in this app |
| **I4 — the co-admin fan-out** | Needs a vendor with two administrators. No fixture has one |

**What a full pass looks like:** sign in as a vendor-admin → Settings → Close account →
submit → confirm the acknowledgement email arrives → check Command's Closures queue shows it
→ execute → confirm the completion email arrives **before** the account disappears → confirm
the co-admin was notified → for `vendor_only`, sign in again and confirm the "closed at your
request" message (I8) rather than "contact support".

**Verification:** live environment only, by definition.

### L2 — Migrations are on local only ⬜ TODO — **user-owned**
**Owner:** the user. Migrations are never applied by the agent in this repo.

`20260821000001_account_deletion_requests.sql` and
`20260821000002_account_deletion_notification_types.sql` exist and are verified on the local
database (10 behavioural RLS tests). **Neither has reached staging or production.**

```bash
cd backbone
supabase db push
supabase migration list --linked   # confirm both 20260821* applied
```

⚠️ The `backbone` CLI is linked to **staging**, not production. Production is a second pass.
Re-run the RLS checks against staging after applying — the local seed is not staging's shape,
and the helpers read real membership rows.

**Carried from:** account-deletion plan I10.

### L3 — Command's KYC emails to vendors have never sent ⬜ TODO — **pre-existing bug**
**File:** `command/services/kyc-admin.service.ts:145` (client import at `:6`)

`notifyVendorOfReview()` inserts into `notifications` using the **browser** client.
`20260620000001_api_role_grants.sql:66` grants `authenticated` **select, update, delete** —
no insert — and no INSERT policy exists. The insert cannot succeed.

The surrounding `try/catch` never fires either: PostgREST returns an error *object* rather
than throwing, so the failure is discarded silently.

**Consequence, today:** every vendor whose KYC packet Command approves or rejects is told
nothing. The `kyc_approved` / `kyc_rejected` notification types have existed since
`20260808000001`; nothing has ever used them successfully.

**Why this is a launch blocker and not a follow-up:** vendor onboarding is the flow being
launched, and this is the message that tells an applicant whether they got in.

**Fix approach:** a small service-role route, mirroring
`command/app/api/users/route.ts`'s shape. The notification bodies already exist and are
correct — only the write path is wrong. Roughly one route file plus a service change.

**Verification:** machine-verifiable that the route exists and type-checks; **needs a live
environment** to prove an email actually arrives. Fold into L1's pass if the timing works.

**Carried from:** account-deletion plan I5 (reported there, deliberately not fixed).

---

## FOLLOW-UPS

### F1 — Put the deletion URL in Play Console ⬜ TODO
Data safety form → account-deletion field → **`https://ezzy.ph/account-data-deletion/`**.

⚠️ **Not `/legal-policies/`.** That page carries the same text, but it is a single scrolling
document with all seven policies inline, the deletion section is **sixth**, and the section
anchors are auto-generated hashes (`id="05ca377"`) that change when the page is re-edited —
so there is nothing stable to link to. A reviewer opening it lands on the Privacy Policy.

The form is editable independently of the app binary; changes are reviewed with the next
Data safety submission. Deferred by the user, 2026-08-23.

### F2 — `command` has no visual regression suite ⬜ TODO — **pre-existing**
`command/visual-tests/` contains `seo.spec.ts` and (since 2026-08-23) `closures.spec.ts`.
There is **no `pilot.spec.ts` and there are no snapshots**, so every Command surface — Users,
Vendors, Payouts, Flags, Closures — has zero pixel coverage.

⚠️ **`.plans/2026-08-16-payout-deferred-followups.md` D4 describes this and is now STALE.**
It says the config *"uses port 3100, colliding with vendor, and still points at 127.0.0.1"*.
Both were fixed on 2026-08-21 — it is port 3300 and `localhost` now. **Correct D4 or point it
here**, or the next reader will go fix something already fixed.

What remains of D4's ask: port the throwaway script into a real `pilot.spec.ts`.

**Carried from:** account-deletion plan I11 + payout plan D4.

### F3 — 29 pre-existing failures in the vendor visual suite ⬜ TODO — **pre-existing**
`npx playwright test` in `vendor` reports **`29 failed / 123 passed`**, exit 1.

**Failing:** `ui-gallery sidebar` (light + dark), the whole `login-*` group (10),
`login-mobile-info`, and all 12 `payout details` tests.

**Proven pre-existing, not inferred:** with every tracked vendor change of the account-deletion
plan stashed, `-g "ui-gallery sidebar"` fails with the **identical 260-pixel diff** (269 dark).

**Symptoms:** small diffs (ratio 0.01 — drift, not a broken render) plus repeated React
**hydration mismatches** in the dev-server log on `DashboardSection`.

**Leading hypothesis, unconfirmed:** `pilot.spec.ts`'s own header documents that `page.clock`
patches **only the browser, not the Next server**, and that baselines expiring as the real
date advances has bitten this repo twice before. But the 260px sidebar diff is not obviously
date-shaped — diagnose rather than assume.

⚠️ **Blocks a related task:** the 13 `login-*` baselines are also affected by I15's legal-menu
addition (two new links render in the login footer). They were deliberately **not**
re-recorded, because doing so would bake this undiagnosed drift into the baselines alongside
a known-good change. **Diagnose F3 first, then re-record.**

**Carried from:** account-deletion plan I17.

### F4 — Vendor's completion matrix no longer fails fast ⏸ PARKED
Unchanged from `.plans/2026-08-16-payout-deferred-followups.md` **D5** — listed here only so
the test-coverage picture is in one place. **That plan remains its owner**; do not duplicate
the item, and unpark it there.

---

## COSMETIC

### C1 — Closure option ordering on `ezzy.ph` ⬜ TODO
`/account-data-deletion/` §1 lists: *The Business and My Login → My Login Only → The Business
Only*. Reading better: the two common choices adjacent, the conditional one last —
*The Business and My Login → The Business Only → My Login Only*. Nothing is wrong as it
stands.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains. There are none. -->

- **One plan rather than two** (user, 2026-08-25). A split was suggested — feature follow-ups
  separate from test-coverage — because F2/F3 span two source plans and neither owns them.
  The user chose a single document; the sections above keep the separation legible.
- **L3 is a launch blocker, not a follow-up** (2026-08-25). It is a live defect in the
  onboarding flow being launched, not a deferred improvement.

---

## Execution order

1. **L2** — migrations to staging. Everything else that touches a live environment needs this.
2. **L1** — the full closure pass. Highest information value per minute spent.
3. **L3** — fix and, if possible, verify inside the same live session as L1.
4. **F3** — diagnose before touching any baseline.
5. **F3 follow-through** — re-record the `login-*` baselines once the drift is understood.
6. **F1** — whenever the Play submission is next touched.
7. **F2** — its own piece of work; the vendor suite is 123 tests, so this is not small.
8. **C1** — any time.

**F2 and F3 are independent of L1–L3** and can start whenever; they need no live environment
beyond a dev server.

---

## Verification

| Item | How | Kind |
|---|---|---|
| L1 | The full pass described above, on a running stack | **live only** |
| L2 | `supabase migration list --linked`; re-run the RLS role checks against staging | live only |
| L3 | `tsc` + the route exists (machine); an email actually arriving (live) | both |
| F1 | The URL resolves 200 and is saved in the Data safety form | manual |
| F2 | A `pilot.spec.ts` exists and passes; snapshots committed | machine |
| F3 | `npx playwright test` in `vendor` exits 0 — **read the summary line and the exit code, never the tail** | machine |
| C1 | Visual check of §1 | manual |

⚠️ **The F3 verification note is not pedantry.** During the account-deletion plan this suite
was twice reported as green from a tail of the output that read `123 passed`, while the real
summary was `29 failed / 123 passed` thirty lines above. Both reports were wrong.
