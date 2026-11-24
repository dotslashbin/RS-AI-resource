# Affiliate dashboard — discovery notes and decision log

**Date:** 2026-11-02 (discovery started 2026-10-30)
**App / scope:** Discovery only — no code, no migration, no implementation plan. Future scope spans `backbone/` (portal row, read access, commission ledger, code history, withdrawals, settings, email function), `command/` (Affiliates section, withdrawals queue, payout details, settings), the **`affiliate/` app** (the screens) and one change in `vendor/` (the referral-code lookup).
**Status:** IN PROGRESS — discovery closed 2026-11-14 (Q1–Q50, P5–P7); both previews approved. Plan 1 (data layer) is on staging, production parked (2026-11-24). Next: plan 2 (Command), then 3 (affiliate app).

> A record of the facts established, the decisions the user has made and the questions
> still open for the affiliate dashboard. This is **not** an implementation plan: it has no
> stages and authorises no work. When discovery closes, an implementation plan is written
> under `.plans/` per `.claude/skills/plan-authoring/SKILL.md` and links back here.

> **Status legend:** ✅ agreed · ⏳ open · ⏸ deferred by the user · 📝 reference note.
> **Numbering legend:** Q# = discovery question (numbered in the order asked), P# = a fact
> or policy the user supplied, F# = repository finding. Numbers are local to this file.

---

## ▶ RESUME HERE (updated 2026-11-24)

- **Where we are:** all seven discovery rounds are answered (Q1–Q50). **No open questions.**
  The app-setup plan is COMPLETE (2026-11-03); `affiliate/` exists, committed and pushed.
- **The model in one paragraph:** affiliates earn 1% (overridable) of Ezzy's fee after a
  fixed, Command-configurable tax, on completed bookings at vendors they referred (Q34, Q35).
  Commission becomes withdrawable 7 days after completion; the affiliate requests a
  withdrawal of the whole available balance once it reaches a Command-configurable minimum;
  Command admins are notified, Ezzy transfers by hand and marks it complete (Q42–Q50).
  Payout details are entered by staff, encrypted, shown masked (Q17, Q26, Q32). Affiliates
  can change their own referral code; old codes keep working (Q16, Q22).
- **Superseded, kept for the record:** monthly month-end payouts, the 7-day cut-off, monthly
  statements, "no minimum" (P1, P3, Q4f, Q4-cut, Q28, Q29, Q31, Q33).
- **Design preview:** `.plans/previews/affiliate-dashboard/`. First design approved
  2026-11-08, Settings approved 2026-11-11. Revised 2026-11-13 for the 1% after-tax rule, then
  for withdrawals. ⏳ **The revised screens await the user's review** (see its README for
  what changed and for F13, the small amounts).
- **Scope of the implementation plan:** `backbone/` (portal row, affiliate read access,
  commission ledger, code history, withdrawals, two settings), `command/` (Affiliates
  section, withdrawals queue, payout details entry, Settings for the minimum and the tax
  rate, attribution changes), `affiliate/` (the screens). Cross-app: flag it at the top.
- **Plans (P5, 2026-11-14): three, in order** — data layer (`backbone/` + email function +
  the `vendor/` lookup), then `command/`, then `affiliate/`.
- **Command preview (P6):** `.plans/previews/affiliate-command/`, drawn 2026-11-14.
  ✅ **Accepted by the user 2026-11-14** ("I'll accept that for now"; its sidebar styling is a
  stand-in, not the real Command shell).
- **Affiliate preview:** ✅ **revised version approved by the user 2026-11-14** (rate, after-tax
  column, line references, withdrawals).
- **Discovery is closed.** The two items once left open for plan 2 (Command preview F2, F4) were
  decided in plan 1 (D5, D6, 2026-11-15).
- **Plan 1 (data layer):** [`2026-11-14-affiliate-data-layer.md`](2026-11-14-affiliate-data-layer.md)
  — built, verified locally and **released to staging 2026-11-24**; production parked until plans
  2 and 3 are tested on staging. It settled command F2–F4 as its D5–D7 (refuse below the minimum
  at processing; reject after processing only as "transfer failed"; waive the minimum only on
  account closure), so they are **no longer open for plan 2**. Later decisions: P7 (no blocked
  words) and option B for local fixtures (its F23).
- **Next:** write **plan 2 (`command/`)** in a new session, per
  `.claude/skills/plan-authoring/SKILL.md`, starting from plan 1's RESUME HERE and function table.
- **Method used here:** `.claude/skills/grilling/SKILL.md`: rounds of numbered questions,
  each with a recommended answer; facts are looked up, decisions are the user's.

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

- **F10 — A code change today kills every link shared under the old code, and frees the
  code for anyone** (verified 2026-11-10). Command's `PATCH /api/affiliates` overwrites
  `affiliates.referral_code` in place (`command/app/api/affiliates/route.ts:203-208`, which
  warns about it); nothing records the old code, so another affiliate can be given it and
  inherit its traffic. Past signups are safe: `vendor_referrals.referral_code` is a snapshot
  and attribution is keyed on `affiliate_user_id`.
- **F11 — The vendor lookup resolves the CURRENT code only**
  (`vendor/lib/referralLookup.ts:64`, `.eq("referral_code", code)`), failing soft (D2), so an
  old code is ignored in silence. Keeping old codes working (Q16a) changes this lookup.
- **F12 — Affiliates have no write path to their own row.** `affiliates` grants
  `authenticated` SELECT only, by design
  (`backbone/supabase/migrations/20260917000001_affiliates_and_vendor_referrals.sql:87-90`),
  and the affiliate app may not hold the service-role key (`affiliate/AGENTS.md:76`). A
  self-service change therefore needs a database function that enforces Q16a–c itself, not
  a new UPDATE grant.
---

## Decision log

| # | Decision | Date |
|---|---|---|
| Q1 | Affiliates are a **mix**: external partners, staff, vendors and bookers | 2026-10-31 |
| Q2 | Commission is a **% of Ezzy's platform fee** (true revenue share), so it can never exceed Ezzy's take | 2026-10-31 |
| Q3 | Affiliates get a **self-service dashboard from day one** | 2026-10-31 |
| Q4a | A refund **after** the affiliate was paid is **written off** — recorded, not deducted ⚠️ **Reworded 2026-11-14 for the withdrawal model:** read "paid" as "withdrawn". | 2026-11-02 |
| Q4b | A flagged (disputed) booking **freezes** its commission line; it follows Command's resolution (completed → restored; refunded/cancelled → cancelled) | 2026-11-02 |
| Q4c | A fee correction produces a **± adjustment line** linked to the correction record; past lines are never rewritten | 2026-11-02 |
| Q4e | The dashboard shows **"upcoming"** estimates (paid, not yet completed bookings), labelled as estimates | 2026-11-02 |
| Q4f | Commission is paid in the **same month it is earned** (option ii) ⚠️ **Superseded 2026-11-13 by the withdrawal model (Q42–Q50).** | 2026-11-02 |
| Q4-cut | **7-day cut-off:** a month-end payout includes only lines completed at least 7 days before month-end (October: completed by 24 Oct); later lines roll to the next month. This also covers "new sign-ups are paid next month" ⚠️ **Superseded 2026-11-13 by the withdrawal model (Q42–Q50).** | 2026-11-02 |
| Q4-neg | Refund after payout → **written off**. Fee correction after payout → **deducted** from the next payout, carried forward if negative. Negative balance at account closure → written off ⚠️ **Reworded 2026-11-14 for the withdrawal model:** "after payout" means after the line was withdrawn; a negative adjustment comes off the available balance, which may go below zero and is carried. | 2026-11-02 |
| Q2-fact | Production platform fee is **11%** today, configured from Command | 2026-11-02 |
| Q7 | **Default rate, overridable per affiliate**; the rate is snapshotted onto each line at completion, so a change affects future completions only | 2026-11-02 |
| Q8 | Staff affiliates: the **database blocks** them from acting on their own referrals and commissions (at minimum fee corrections and commission payout); policy + audit for the rest. Staff commissions are paid **through payroll** and only recorded here ⚠️ **Reworded 2026-11-14 for the withdrawal model:** the blocked action is completing or rejecting their own withdrawal (and fee corrections on their own lines); see Q48. | 2026-11-02 |
| Q9 | Suspended or departing affiliate: commission **stops building from the suspension date**; anything already earned is still paid. On account closure, earned commission is paid in one final payout (Claude's recommendation, adopted with (b) — revisit if the user meant otherwise) ⚠️ **Reworded 2026-11-14 for the withdrawal model:** the "final payout" is a final withdrawal Command may complete regardless of the minimum (Q50b). | 2026-11-02 |
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
| P1 | Affiliates are paid **monthly, at month-end** ⚠️ **Superseded 2026-11-13 by the withdrawal model (Q42–Q50).** | 2026-10-31 |
| P3 | **No minimum payout** (briefly superseded 2026-11-11, restored by Q29 on 2026-11-13) ⚠️ **Superseded 2026-11-13 by the withdrawal model (Q42–Q50).** | 2026-11-02 |
| P4 | A **negative balance carries forward** (where negatives come from: Q4-neg) | 2026-11-02 |
| Q16 | Affiliates can **customise their own referral code** in an **Affiliate settings** section. Codes are imported in bulk (CSV or direct DB entries) before launch; affiliates then change them themselves | 2026-11-10 |
| Q16a | An old code **keeps crediting its affiliate and stays reserved to them forever**: shared links never break, and nobody else can take over a code's traffic (fixes F10/F11) | 2026-11-10 |
| Q16b | An affiliate may change their own code **once per 30 days**; Command may change it any time | 2026-11-10 |
| Q16c | A change applies **immediately**; the database refuses **reserved and blocked words** (EZZY, ADMIN, SUPPORT, offensive terms…), and every change goes to an **append-only history** Command can read | 2026-11-10 |
| Q16d | **One rule for everyone:** Command's existing code change follows Q16a too, so its "old links stop" warning goes away | 2026-11-10 |
| Q17 | **Payouts are in v1, minimal:** Command staff enter an affiliate's bank/e-wallet details, encrypted with the key Command already holds (vendor pattern); the affiliate sees only a masked destination; Command gets a monthly affiliate **Mark Paid** like vendors'. Affiliate self-entry (needs a server route + key in the affiliate app) is a later version ⚠️ **Reworded 2026-11-14 for the withdrawal model:** Command gets a **withdrawals queue** (Q44), not a monthly Mark Paid. | 2026-11-11 |
| Q18 | Changing a vendor's referrer: **Command admins only, reason required, logged; forward-only** — lines already earned stay with the old affiliate | 2026-11-11 |
| Q19 | Crediting a vendor with no referral (Command-created, or forgot the code): **Command only, with a reason, within 30 days of the vendor's sign-up**; credit runs from the date attached | 2026-11-11 |
| Q20 | Ledger integrity (Claude's proposal, adopted): one earned line per paid booking (UNIQUE); lines never updated or deleted, status only via functions with an append-only status log; adjustments UNIQUE on their correction record; write-offs linked to their refund; append-only enforced even for `service_role` (`revoke all` before the grant) | 2026-11-11 |
| Q21 | Abuse controls for v1: **nothing beyond Q2, Q8, Q9, Q11, Q16**, plus Command reviewing each payout before Mark Paid. A flag-only "unusual patterns" report soon after v1; no automatic holds ⚠️ **Reworded 2026-11-14 for the withdrawal model:** Command reviews each **withdrawal** before completing it. | 2026-11-11 |
| Q22 | Settings leftovers: (a) an **imported code does not start the 30-day clock**; (b) an affiliate **may switch back to their own old code**; (c) the reserved/blocked list **lives in a migration** (new migration to change it), matched **anywhere in the code**; Command cannot edit it in v1 | 2026-11-11 |
| Q23 | Commission list keeps the **booking date** and adds a **"Payout" column** (the month a line is or will be paid in). Resolves preview F2/F9 ⚠️ **Adapted 2026-11-13:** with withdrawals the column shows when a line becomes available, or the withdrawal it was paid in. | 2026-11-11 |
| Q24 | Each commission line gets its **own short reference** (e.g. `C-10482`) for support; never a booking reference. Resolves preview F1 | 2026-11-11 |
| Q25 | **Keep "earned to date" per vendor** on the Vendors list (derived from the affiliate's own lines). Resolves preview F3 | 2026-11-11 |
| Q26 | Affiliate payout details live in a **new `affiliate_payout_methods` table mirroring the vendor design** (bank / GCash / Maya, app-encrypted, written only through Command's server route, masked display for the affiliate). `vendor_payout_methods` is not touched | 2026-11-11 |
| Q27 | **No tax withholding in the affiliate system** (revised by the user 2026-11-13; replaces the 2026-11-11 deferral). Nothing is withheld from an affiliate payout and the statement carries no withholding line. Instead **commission is calculated on Ezzy's fee AFTER TAX**, and affiliates are told so plainly (see Q34, Q35) | 2026-11-13 |
| Q28 | **Monthly statement, vendor pattern:** one per affiliate per month, recorded at Mark Paid, emailed, shown on the affiliate's Payouts screen: lines with their references, earned, adjustments, negative carried in, amount sent (no tax line, Q27) ⚠️ **Superseded 2026-11-13 by the withdrawal model (Q42–Q50).** | 2026-11-11 |
| Q29 | **Ezzy pays all transfer fees; nothing is deducted from the affiliate; every balance is sent each month, no minimum** (revised by the user 2026-11-13; the ₱100 carry-forward floor chosen 2026-11-11 is dropped, so P3 "no minimum payout" stands again) ⚠️ **Superseded 2026-11-13 by the withdrawal model (Q42–Q50).** | 2026-11-13 |
| Q30 | **Staff affiliates:** their month appears in affiliate Mark Paid as "paid through payroll": no transfer, no payout details, statement still issued, no affiliate withholding (payroll applies its own) ⚠️ **Adapted 2026-11-13 by Q48:** recorded as a completed withdrawal marked "paid through payroll". | 2026-11-11 |
| Q31 | An affiliate with **no payout details at month-end is left out of the run**; the balance carries forward and their Payouts screen says "Waiting for your payout details". The run is not blocked (unlike vendors') ⚠️ **Superseded 2026-11-13 by the withdrawal model (Q42–Q50).** | 2026-11-11 |
| Q32 | Affiliates give payout details by **contacting Ezzy support; staff confirm identity and enter them** in Command, by phone or another confirmed channel, not plain email. Self-entry is a later version | 2026-11-11 |
| Q33 | **No PESONet bulk-transfer file for affiliates in v1**; staff transfer one by one ⚠️ **Superseded 2026-11-13 by the withdrawal model (Q42–Q50).** | 2026-11-11 |
| Q34 | **"After tax" is a fixed tax rate, configurable from Command** (revised by the user 2026-11-13; replaces the same-day "worked out by hand monthly" answer, and withdraws Q40). One setting, "tax taken off Ezzy's fee before commission (%)", beside the platform fee; **snapshotted onto each commission line** so a later change never re-prices history. Share = fee × (1 − tax %) × rate, final when the booking completes: no month-end estimate. **The user pre-approved a migration for the setting (2026-11-13)**; it is still drafted in the implementation plan before it is written. **Scope split:** the Command screen for editing the rate is the user's own separate session, not this plan; this plan delivers the column, the snapshot and the maths. ⏳ Q41: the rate's starting value | 2026-11-13 |
| Q35 | **The rate is a percentage of Ezzy's fee after tax; the default is 1%.** Confirmed by the user with a worked example: on a ₱1,600 booking the 11% fee is ₱176 and the affiliate earns about ₱1.55 (1% of what is left after tax), not 1% of the booking. Stays overridable per affiliate (Q7). (The preview was redone at this rate on 2026-11-13.) | 2026-11-13 |
| Q36 | Commission counts **from a go-live date forward only**; no backfill of bookings completed since referral tracking began (2026-09-19). A promise made to a particular affiliate is honoured with a one-off manual adjustment line | 2026-11-13 |
| Q37 | Command gets a new **Affiliates section** (rates, payout details, code history, attribution changes, monthly Mark Paid). Creating an affiliate stays on the Users page ⚠️ **Reworded 2026-11-14 for the withdrawal model:** the section holds the **withdrawals queue** in place of a monthly Mark Paid, plus payout-details entry. | 2026-11-13 |
| Q38 | Emails to affiliates in v1: **the monthly statement** (Q28) and a **"your referral code was changed"** notice. Nothing per line or per vendor ⚠️ **Reworded 2026-11-14 for the withdrawal model:** the statement email is replaced by the three withdrawal emails in Q49; the code-change email stands. | 2026-11-13 |
| Q39 | Pre-launch import: one row per affiliate (**name, email, code, optional rate override**); a **dry-run report** of bad rows first; **invitations are sent separately**, when the user chooses; **safe to re-run** (already-imported rows are skipped) | 2026-11-13 |
| Q41 | The tax rate (Q34) **starts empty and no commission is calculated until someone sets it**. The plan must make go-live (Q36) depend on it being set, so no completed booking falls into the gap | 2026-11-13 |
| Q42 | **Payouts become WITHDRAWALS** (the user, 2026-11-13): nothing is transferred until the affiliate asks. Earned commission becomes **withdrawable 7 days after the booking completes**; until then it shows as earned, not yet available. Held lines are never withdrawable. Replaces the month-end payout and its cut-off | 2026-11-13 |
| Q43 | A withdrawal takes **the whole available balance**, and covers a specific set of lines, so every peso traces back to bookings. No typed amounts | 2026-11-13 |
| Q44 | Request lifecycle: **Requested → Processing → Completed**; the affiliate may **cancel** while Requested; staff may **reject** with a reason (the money returns to the balance). "Start processing" locks the request against cancellation and re-checks the amount. **One open request at a time**; new earnings build for the next | 2026-11-13 |
| Q45 | The **minimum withdrawal is a Command setting that starts unset; withdrawals are off until it is set**. This plan now includes the Command Settings screens for **both the minimum and the tax rate** (Q34), beside the platform fee — the tax-rate screen is no longer a separate session | 2026-11-13 |
| Q46 | **Payout details must be on file before a withdrawal can be requested** (staff-entered, Q17/Q26/Q32 stand). Without them the Withdraw button is disabled and says why | 2026-11-13 |
| Q47 | **Ezzy still pays the transfer fee; nothing is deducted.** The minimum is what protects against tiny transfers | 2026-11-13 |
| Q48 | **Staff affiliates see their balance but have no Withdraw button**; Command records each payroll payment as a completed withdrawal marked "paid through payroll" | 2026-11-13 |
| Q49 | Emails to the affiliate: **request received, completed (with the receipt), rejected (with the reason)**. These replace the monthly statement email; the code-change email (Q38) stays. Command admins get the existing in-app notification + email per admin when a request is made | 2026-11-13 |
| Q50 | (a) An unwithdrawn balance **never expires**. (b) On account closure Command may pay out the balance **regardless of the minimum** (Q9). (c) Affiliates are told withdrawals are **processed within 5 business days** | 2026-11-13 |
| P5 | **Three implementation plans, in this order:** (1) data layer — `backbone/`, the email function and the `vendor/` lookup change; (2) `command/`; (3) `affiliate/`. Each has its own staging → production release. Plan 1 is safe to release alone: the tax rate starts unset (Q41), so nothing is calculated until Command's Settings screen exists | 2026-11-14 |
| P6 | **Command gets a design preview before the plans are written** (`.plans/previews/affiliate-command/`) | 2026-11-14 |
| P7 | **No blocked or reserved words in referral codes** — any code in the `^[A-Z0-9]{4,32}$` format is accepted (the user, while reviewing plan 1's D4). ⚠️ **Supersedes the blocked-word half of Q16c and all of Q22c**; the affiliate preview's "Settings · reserved word" screen is dropped. Q16a (old codes reserved forever) and Q16b (30-day limit) stand | 2026-11-15 |

### Referral-code customisation (Q16, 2026-11-10) — notes for the implementation plan

Not authorised work: the shape the implementation plan should start from, and what it must
settle. Previewed in `.plans/previews/affiliate-dashboard/` (screens `settings`,
`settings-error`, `settings-saved`).

- **Codes keep today's rule:** `^[A-Z0-9]{4,32}$`, stored upper-cased; input is normalised
  as `vendor/lib/referralCode.ts` does ("rina-dp" → RINADP). The share link stays
  Command's `buildReferralUrl`: vendor origin + `/?ref=CODE`.
- **Likely shape:** a code-history table (one row per code ever held: code UNIQUE across all
  time, affiliate, set by, set at, source = import / affiliate / command).
  `affiliates.referral_code` stays the current code; the vendor lookup (F11) resolves any
  historical code to its affiliate. Uniqueness across history is what makes Q16a's
  "reserved forever" real. Append-only, so it needs the explicit `revoke all … from
  service_role` before its grant (core rules, the four audit logs fixed in `20260911000003`).
- **The change itself** goes through one SECURITY DEFINER function (F12) that checks, in
  the database: format, blocked words, uniqueness across history, the 30-day limit for
  self-service (Q16b), active affiliate + `affiliate` portal; and writes the history row in
  the same transaction. Command's PATCH uses the same rule (Q16d).
- **Import before launch:** the CSV / DB import must run through the same rules (format,
  blocked words, uniqueness) and record each code with source = import. Bad rows are
  reported, not silently skipped. Recommendation: an imported code does not start the
  30-day clock, so an affiliate can replace it on day one (the preview assumes this).
- **Settled since by Q22** (2026-11-11): the blocked list lives in a migration and matches
  anywhere in the code; switching back to your own old code is allowed.
  **Still for the plan:** what Command shows of the history; per-code attribution reporting (which code a
  vendor actually used is already snapshotted in `vendor_referrals.referral_code`).

### Commission line and withdrawal lifecycle (as agreed)

```
upcoming (paid, not completed: an estimate only)
earned (booking completed)
  ├─ flagged ──► held ──► earned (resolved completed) / cancelled (refunded or cancelled)
  ├─ refunded before withdrawal ──► cancelled
  └─ 7 days after completion ──► available
        └─ included in a withdrawal ──► withdrawn   (when Command completes it)
refund after withdrawal ──► written off (recorded, never taken back)
fee correction ──► ± adjustment line on the balance (carried if it goes negative)

withdrawal request:  requested ──► processing ──► completed
                        ├─ cancelled by the affiliate (only while requested)
                        └─ rejected by Command, with a reason (lines return to available)
```
Rewritten 2026-11-14 for the withdrawal model (Q42–Q44).

### 📝 Reference note — P2, the 7-day refund rule (⏸ deferred by the user, 2026-11-02)

The business intends to honour refunds only within **7 days of a completed booking**. This
is a **policy only**: today the system allows `completed → disputed` and Command's
`→ refunded` at any time (F4), and card chargebacks follow card-network deadlines regardless.
**Do not change the refund process for this** — the user will return to it. If it is ever
enforced, those two transitions are where it goes.

---

## Open questions

**None for the user from rounds 1–7** (Q1–Q50 answered; Q40 withdrawn).

**For the implementation plan to establish** (facts and engineering choices, not user
decisions unless the investigation turns one up):

- Which database event is "the booking completed" (Q5, Q42), and how it relates to
  `booking_transactions.payout_status`; where the 7-day availability clock reads from.
- How the go-live date (Q36) and the unset tax rate (Q41) gate the first commission line.
- From the Command preview's README (F2–F4): what staff see when "Start processing" drops a
  line and the amount changes; whether a request can be rejected after processing started,
  or needs a "transfer failed" outcome. **These two are user decisions for the Command plan.**
- A **suspended** affiliate cannot sign in (the gate needs an active profile), yet what they
  earned is still owed (Q9): Command must be able to open and complete a withdrawal for them.
  If that needs a rule beyond Q50b, ask the user.
- The contents of the reserved/blocked word list (Q22c).
- New notification types for the withdrawal emails mean the `send-notification-email` Edge
  Function is redeployed (`backbone/supabase/functions/`), and the affiliate portal needs a
  row in whatever `notifications.portal` references.
- The vendor app's lookup (`vendor/lib/referralLookup.ts:64`) must resolve old codes (F11):
  a **vendor** change, shipped with the code-history migration.

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
