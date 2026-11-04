# Affiliate dashboard — discovery notes and decision log

**Date:** 2026-11-02 (discovery started 2026-10-30)
**App / scope:** Discovery only — no code, no migration, no implementation plan. Future scope spans `backbone/` (commission ledger, affiliate portal row, RLS), `command/` (affiliate administration) and a **new `affiliate/` app**.
**Status:** IN PROGRESS — discovery (grill-me) under way. Rounds 1–3 answered; next is the standalone app-setup plan, then the later rounds. The implementation plan is written only after the user says they are satisfied with the design.

> A record of the facts established, the decisions the user has made and the questions
> still open for the affiliate dashboard. This is **not** an implementation plan: it has no
> stages and authorises no work. When discovery closes, an implementation plan is written
> under `.plans/` per `.claude/skills/plan-authoring/SKILL.md` and links back here.

> **Status legend:** ✅ agreed · ⏳ open · ⏸ deferred by the user · 📝 reference note.
> **Numbering legend:** Q# = discovery question (numbered in the order asked), P# = a fact
> or policy the user supplied, F# = repository finding. Numbers are local to this file.

---

## ▶ RESUME HERE (updated 2026-11-02)

- **Where we are:** rounds 1–3 fully answered (2026-11-02). Nothing open from them.
  The app-setup plan is drafted: `.plans/2026-11-02-affiliate-app-setup.md` (DRAFT, D1–D4 open).
- **Agreed next order:** finish open items → a small standalone **app-setup plan** (copy
  vendor skeleton, `npm ci`, build/lint/type-check, root `.gitignore`) → the user runs
  `git init` + first commit → remaining discovery rounds → design previews → user confirms
  the design → feature implementation plan.
- **Next rounds after that:** affiliate payouts (bank details, transfer rail, withholding,
  statements) · attribution changes and manual referrals · duplicate prevention and audit
  trail (Claude to propose) · abuse controls · smallest useful v1.
- **Method:** `/grill-me` → `.claude/skills/grilling/SKILL.md` — rounds of numbered
  questions, each with a recommended answer; facts are looked up, decisions are the user's.

---

## The intended feature (as briefed, 2026-10-30)

- Affiliates have their own referral codes.
- Vendors can use those codes when signing up.
- The referring affiliate receives credit for the vendor.
- The affiliate earns a percentage of bookings from that vendor.
- Where the dashboard lives was to be decided, not assumed (now decided — Q6).

---

## Repository findings (verified 2026-10-30 – 2026-11-02)

- **F1 — Attribution already exists and is live in production** (since 2026-09-19,
  `.plans/2026-09-17-affiliate-referral-codes-interim.md`).
  - `affiliates` (one row per user; admin-typed `referral_code`, `^[A-Z0-9]{4,32}$`) and
    `vendor_referrals` (PK `vendor_id` = at most one referrer; snapshotted `referral_code`;
    `affiliate_user_id` ON DELETE SET NULL) —
    `backbone/supabase/migrations/20260917000001_affiliates_and_vendor_referrals.sql`.
  - Capture: `?ref=CODE` → `vendor/lib/referralDeepLink.ts`; server-side resolution in
    `vendor/lib/referralLookup.ts` (active affiliates only; invalid codes ignored silently, D2).
  - The ezzy.ph WordPress plugin already appends `ref=`
    (`.plans/2026-09-17-wordpress-partner-routing-referral-code.md`).
  - Command: Users page create/assign/change/remove (`command/app/api/affiliates/route.ts`,
    `components/users/AffiliateModal`, `AffiliatePanel`), activated-vendor count
    (`lib/affiliateReferrals.ts`), per-affiliate CSV (`lib/affiliateCsv.ts`,
    `services/affiliates.service.ts`).
  - Affiliate is a **capability, not a role** (D11, `architecture/auth-and-roles.md` →
    Affiliates).
- **F2 — Gaps in what exists:** no commission, earnings or affiliate payouts; affiliates
  cannot sign in; no eligibility rules; Command-created vendors cannot carry a referral;
  attribution changes only by manual SQL, with no audit log; `vendor_referrals` is
  service-role editable, not append-only.
- **F3 — The money model commission will hang off:** `booking_transactions` — one row per
  paid booking, trigger-written on `is_paid` false→true, `booking_id UNIQUE` as the
  idempotency guard, fee snapshotted at payment, `payout_status`
  `held → releasable → released` / `reversed`, `released` never downgraded. Corrections only
  via `correct_booking_transaction()` with an append-only log. **One global fee**
  (`platform_fee_settings.fee_percent`), no per-vendor rate. See `architecture/schema.md`.
- **F4 — Refunds:** bookers can *request* a refund; only Command grants one. A completed
  booking can move to `disputed` (booker or vendor) or `refunded` (Command) **with no time
  limit** (`20261003000001_booker_refunds_and_cancellation.sql`). No app calls PayMongo's
  refund API; money is returned by hand. There is no payout rail — "Mark Paid" records a
  manual transfer.
- **F5 — Free (₱0) kiosk bookings** write no ledger row, so they can never produce a
  commission.
- **F6 — Checkout S2** (`.plans/2026-10-15-checkout-s2-consolidated-brief.md`) is redesigning
  how a payment becomes "settled". Commission must hang off `booking_transactions`, not off
  the webhook.
- **F7 — Command is staff-only by construction:** a single client-gated SPA
  (`command/app/page.tsx` → `AppShell`); `verifyCommandAccess` requires admin/root; granting
  the `command` portal is root-only (`20260807000001`); all 99 RLS conditions that mention the
  `command` portal also require admin/root; a service worker once cached sensitive responses
  (interim plan K15).
- **F8 — The three web apps are on identical installed versions** (2026-11-02): Next 16.2.4,
  React 18.3.1, supabase-js 2.105.4, `@supabase/ssr` 0.10.3, Tailwind 3.4, TypeScript 5.7,
  ESLint 9, Playwright 1.61. Only `sharp`, `unrs-resolver` and `fsevents` (macOS) run install
  scripts in vendor. pnpm 11.10.0 is available locally through Corepack.
- **F9 — The root repo ignores each app folder** (`.gitignore` lists `vendor/`, `booker/`,
  `command/`, `backbone/`). A new `affiliate/` folder needs the same line, or the root repo
  will show it as untracked.

---

## Decision log

| # | Decision | Date |
|---|---|---|
| Q1 | Affiliates are a **mix**: external partners, staff, vendors and bookers | 2026-10-31 |
| Q2 | Commission is a **% of Ezzy's platform fee** (true revenue share), so it can never exceed Ezzy's take | 2026-10-31 |
| Q3 | Affiliates get a **self-service dashboard from day one** | 2026-10-31 |
| Q4a | A refund **after** the affiliate was paid is **written off** — recorded, not deducted | 2026-11-02 |
| Q4b | A flagged (disputed) booking **freezes** its commission line; it follows Command's resolution (completed → restored; refunded/cancelled → cancelled) | 2026-11-02 |
| Q4c | A fee correction produces a **± adjustment line** linked to the correction record; past lines are never rewritten | 2026-11-02 |
| Q4e | The dashboard shows **"upcoming"** estimates (paid, not yet completed bookings), labelled as estimates | 2026-11-02 |
| Q4f | Commission is paid in the **same month it is earned** (option ii) | 2026-11-02 |
| Q4-cut | **7-day cut-off:** a month-end payout includes only lines completed at least 7 days before month-end (October: completed by 24 Oct); later lines roll to the next month. This also covers "new sign-ups are paid next month" | 2026-11-02 |
| Q4-neg | Refund after payout → **written off**. Fee correction after payout → **deducted** from the next payout, carried forward if negative. Negative balance at account closure → written off | 2026-11-02 |
| Q2-fact | Production platform fee is **11%** today, configured from Command | 2026-11-02 |
| Q7 | **Default rate, overridable per affiliate**; the rate is snapshotted onto each line at completion, so a change affects future completions only | 2026-11-02 |
| Q8 | Staff affiliates: the **database blocks** them from acting on their own referrals and commissions (at minimum fee corrections and commission payout); policy + audit for the rest. Staff commissions are paid **through payroll** and only recorded here | 2026-11-02 |
| Q9 | Suspended or departing affiliate: commission **stops building from the suspension date**; anything already earned is still paid. On account closure, earned commission is paid in one final payout (Claude's recommendation, adopted with (b) — revisit if the user meant otherwise) | 2026-11-02 |
| Q10 | **Command-invited only** for v1: admin grants the `affiliate` portal; the existing set-password email goes out | 2026-11-02 |
| Q11 | **No commission** while the affiliate is a member of the referred vendor — checked on every booking, not only at signup | 2026-11-02 |
| Q12 | Affiliates see vendor **name, status, signup and activation dates**, and their **own commission lines** (booking date, booking amount, Ezzy's fee, their share, status). No vendor contact details; **never** booker data | 2026-11-02 |
| Q13 | App folder: **`affiliate/`** | 2026-11-02 |
| Q14 | App name (`NEXT_PUBLIC_APP_NAME`): **"Ezzy Affiliate"** | 2026-11-02 |
| Q15 | Dev server on the **default port** (3000, or next free); **Playwright config fixed at 3400**, because Playwright waits on one URL and reuses whatever server answers there (`vendor/playwright.config.ts:109-110`) | 2026-11-02 |
| Q5 | Commission for the **vendor's lifetime**, from **completed bookings only** — so nothing is earned before KYC and activation | 2026-10-31 |
| Q6 | A **separate affiliate portal** (new Next.js app, new `affiliate` portal row, shared Supabase backend). Attribution and commission logic live in the **database**; **Command** keeps administration (affiliates, rates, payouts) | 2026-11-02 |
| Q6.1 | Build it by **copying the vendor app's skeleton**, not a fresh `create-next-app` | 2026-11-02 |
| Q6.2 | Use **npm**, copying vendor's `package-lock.json`. pnpm is an optional, separate experiment later, on an existing app, never bundled with this feature | 2026-11-02 |
| P1 | Affiliates are paid **monthly, at month-end** | 2026-10-31 |
| P3 | **No minimum payout** (revisit transfer fees with the payout method) | 2026-11-02 |
| P4 | A **negative balance carries forward** (where negatives come from: Q4-neg) | 2026-11-02 |

### Commission line lifecycle (as agreed so far)

```
earned (booking completed)
  ├─ flagged ──► held ──► earned (resolved completed) / cancelled (refunded or cancelled)
  ├─ refunded before payout ──► cancelled
  └─ month-end payout ──► paid
refund after payout ──► write-off line (not deducted)
fee correction ──► ± adjustment line (deducted if after payout; carried forward if negative)
```

### 📝 Reference note — P2, the 7-day refund rule (⏸ deferred by the user, 2026-11-02)

The business intends to honour refunds only within **7 days of a completed booking**. This
is a **policy only**: today the system allows `completed → disputed` and Command's
`→ refunded` at any time (F4), and card chargebacks follow card-network deadlines regardless.
**Do not change the refund process for this** — the user will return to it. If it is ever
enforced, those two transitions are where it goes.

---

## Open questions

| # | Question | Recommendation |
|---|---|---|
None from rounds 1–3. The remaining work is the later rounds listed below.

**Later rounds:** affiliate payouts (bank details — reuse the encrypted
`vendor_payout_methods` pattern? transfer rail, tax withholding by affiliate type,
statements) · changing attribution and crediting Command-created vendors · idempotency and
audit trail for the commission ledger · abuse controls · smallest useful v1 · portal domain
and app name (`affiliate.ezzy.ph`?).

---

## Abuse example that shaped Q2

With a 12% fee and ₱1,000 bookings: if the affiliate earned 10% of the **gross**, a colluding
vendor and affiliate would get back ₱880 + ₱100 per fake booking, losing only ₱20 each. At a
rate of 12% or more of gross they would break even or profit. Taking commission as a % of
Ezzy's **fee** (Q2) makes a fake booking always cost the colluders more than it pays.

---

## Sources (researched 2026-10-30 – 2026-11-02)

- Supabase — [Custom claims & RBAC](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac), [Custom access token hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook), [JWTs](https://supabase.com/docs/guides/auth/jwts). Not needed here: the repo authorises with `is_portal_member` / `has_role`.
- Next.js — [Multi-zones](https://nextjs.org/docs/app/guides/multi-zones). Not needed: portals use subdomains.
- PayMongo — [Refund resource](https://docs.paymongo.com/reference/refund-resource), [Webhooks](https://developers.paymongo.com/docs/webhooks).
- OWASP — [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [Multi-tenant security](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html).
- Package managers (Q6.2) — [Vercel package managers](https://vercel.com/docs/package-managers), [pnpm import](https://pnpm.io/cli/import), [pnpm 11.0](https://pnpm.io/blog/releases/11.0), [Expo monorepos](https://docs.expo.dev/guides/monorepos/).
