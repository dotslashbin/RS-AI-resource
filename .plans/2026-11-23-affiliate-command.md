# Affiliate feature — plan 2 of 3: Command

**Date:** 2026-11-23
**App / scope:** `command/` (new Affiliates section, Settings card, Users-page changes, two
payout-detail routes, an import route) — plus **one corrective migration and one SQL test
fixture line in `backbone/`** (D1 = a, 2026-11-24). `vendor/` is not touched (D20). ⚠️ **Cross-app** only through
that migration (B1); everything else is Command.
**Status:** IN PROGRESS — approved by the user 2026-11-25; stage 1 ✅ (2026-11-25, local); stage 2 code ✅ machine-verified (2026-11-25, local), its live local checks ⬜ with the user; stage 3 next — release: staging ⬜ · production ⏸ PARKED (plans 1–3 go to production together, after the affiliate side is tested on staging)

> Command's half of the affiliate feature: the screens and routes that run the programme on
> top of plan 1's database functions. Theme to optimise: **Command draws, the database
> decides.** Every money rule already lives in plan 1's SECURITY DEFINER functions; this
> plan calls them with the admin's own session, maps their refusals to sentences, and adds
> no second copy of any rule.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = blocker · I# = important · M# = migration (approval gate,
> drafted inline, not written) · D# = decision · F# = finding (verified fact) · R# =
> read-only pre-check the user runs · S# / P# = staging / production release step.
> Q#, P5–P7 = the **discovery log** (`2026-11-02-affiliate-dashboard-discovery.md`);
> "plan 1 D5", "plan 1 F15" = `2026-11-14-affiliate-data-layer.md`; "preview F3" = the
> Command preview's README (`.plans/previews/affiliate-command/README.md`). All other
> numbers are local to this plan.

Predecessors: plan 1 `2026-11-14-affiliate-data-layer.md` (IN PROGRESS; staging ✅, production
⏸), the discovery log (closed 2026-11-14), the Command preview (accepted 2026-11-14; its
sidebar is a stand-in), `2026-09-17-affiliate-referral-codes-interim.md` (the existing
Users-page affiliate pieces). Successor: plan 3 (`affiliate/`), not yet written.

---

## ▶ RESUME HERE (updated 2026-11-25, stage 2 code ✅ — start stage 3 in a new session)

- **Done so far:** investigation, reviews, D1–D20, R1, R2, approval (2026-11-23 → 25). **Stage 1 ✅**
  (B8, `Portal` type, M1 on local). **Stage 2 code ✅ (2026-11-25, local), machine-verified:** B3, B7,
  B2, I1 (PATCH part), I9, I10, I8. Machine: `npm test` 220/220 (42 new), `tsc` 0, `build` 0, lint
  19 / 5 = F24 unchanged, Playwright: new `settings-affiliate-commission.spec.ts` 5/5, full suite 94
  pass + 7 expected/flake (F26, F27). **Not yet run:** the stage's live local checks (list in the
  stage-2 report and under each item's "Live local"), owned by the user.
- **Live where:** local — M1 applied; stage 2 code in the working tree, uncommitted · staging —
  nothing of this plan · production — nothing.
- **Approved:** ✅ by the user, 2026-11-25 (flow step 7).
- **Next:** (1) the user runs stage 2's live local checks (D11: `PORTAL_URL_AFFILIATE=http://localhost:3002`
  in `command/.env.local`, affiliate app on 3002 with booker stopped — or "not configured" if plan 3's
  app is not runnable yet) and commits; (2) **stage 3** in a new session: B4, I2, I3, I5 — and
  **F25: I1's code-history component moves into B4** (it needs the detail page to live on). Still ⬜
  from B1: the `crypto.server.ts` note and the A-vs-B test (with B6, stage 4).
- **Decisions that shape the build (read them in DECISIONS):** D1 exact `^v2\.`; D2 per-row
  balance calls; D3 import as a Command screen; D6 portal ⇔ affiliates row; D15 route refuses
  self; **D19 closure blocked while owed money** (net > 0 or an open withdrawal; a new
  `affiliate_balance` closure blocker in Command only, D20); D18 tax rate set on staging in S4.
- **Watch out for:**
  - **Tax wording (D18):** Q27 excludes **withholding**; the after-tax **rate** (Q34) stays and
    is the go-live switch. Don't add a withholding line, and don't drop the rate.
  - **Setting the tax rate is one-way** (plan 1 D1). Locally it also breaks plan 1's T1
    (`affiliate_data_layer_test.sql:230`) until the next `db reset` (plan 1 F23). B3's card now
    makes this a two-step action (retype), but it still works on local: **don't** switch it on there
    unless you accept T1 failing until `db reset`.
  - The Platform Fee page now selects plan 1's four affiliate columns (B3): a Command build on a
    database **without** plan 1's migrations cannot load the page (F18). Plan 1's production
    P-table runs before this plan's production Promote.
  - `affiliate_withdrawals` has **five** FKs to `profiles` and `affiliate_referral_code_changes`
    two: every `profiles(...)` embed must name its FK (PGRST201, F7).
  - B4's nav entry changes the committed `pilot` sidebar baselines (F22): regenerate only those,
    deliberately. Stage 2 already regenerated the six user-modal baselines (F27).
  - Command's `lib/accountDeletion/eligibility.ts` now deliberately differs from vendor's copy
    (the `affiliate_balance` blocker, D20; header says so). Don't "re-sync" it from vendor.
  - `npx supabase` fetched CLI **3.4.0** on 2026-11-24 (plan text says 3.2.0); flags used here
    (`--remote`, `--read-only`) worked unchanged. Re-check `--help` before S1.
  - The user applies every migration and runs every hosted step. No agent database writes.

---

## Scope

**In (Command only, plus M1):**
- A new **Affiliates** section (Q37) in Management: the list, the affiliate detail, the rate
  override and staff flag (`set_affiliate_terms`), the code change through
  `change_referral_code` with the stale "old links stop" warning removed (Q16d, plan 1 F4), the
  code history.
- The **withdrawals queue and lifecycle** (Q44): Start processing, Complete (transfer
  reference), Reject (reason; after processing only as "transfer failed", plan 1 D6); open a
  withdrawal on an affiliate's behalf (plan 1 D7, the closure waiver); payroll for staff
  affiliates (Q48); the one-off manual adjustment (Q36).
- **Payout details entry** (Q17, Q26, Q32): a server route that encrypts with
  `PAYOUT_ENCRYPTION_KEY` and calls `set_affiliate_payout_method` **with the admin's own
  session** (plan 1 D9), and a "show full details" route that writes
  `affiliate_payout_view_log` before returning plaintext (vendor pattern).
- **Settings:** the "Affiliate commission" card on the Platform Fee tab (tax rate, default rate,
  minimum; Q34, Q35, Q45), with the one-way warning before the first tax-rate save (plan 1 D1).
- **Attribution dialogs:** credit a vendor within 30 days (Q19), change a vendor's referrer
  (Q18), via plan 1's M5 functions.
- **Users page:** the `affiliate` portal chip (granting it is how affiliates sign in, Q10), the
  set-password invite aimed at `PORTAL_URL_AFFILIATE`, and the deletion guards the new money
  makes necessary (B2).
- **Pre-launch import** (Q39): dry run, re-runnable, invitations sent separately.
- **Database errors → sentences**, and hand-written TypeScript interfaces for every new table and
  function Command touches (repo rule: no generated types).

**Out:** every affiliate-app screen, its recovery/set-password landing, its port and its
redirect allowlist entry (**plan 3**); plan 1's production release (plan 1's own P-table);
switching commission on in production (a business decision, D16); the "unusual patterns"
report (Q21); affiliate self-entry of payout details (Q17); the preview tooling's shared
Command shell (preview F1); a rate-change audit log (plan 1 deferred list).

## Assumptions (stated, not confirmed)

1. **Affiliates number in the tens, not thousands, at launch** (plan 1 Assumption 1: "a
   handful"). D2's per-row balance call depends on it. If wrong, D2 (b) instead.
2. **`affiliate_payout_methods` is empty on local and staging.** ✅ Confirmed by R1 (2026-11-24). No app writes it yet and
   plan 1 S1 found no withdrawals. R1 confirms; if a row exists, M1's re-validation fails and
   the row's owner must be told before it is replaced.
3. **The affiliate app is not deployed to staging when this plan's staging stage starts.** So
   the invite's click-through and the affiliate-raised `affiliate_withdrawal_requested`
   notification are checked in plan 3; this plan's staging checks drive every withdrawal from
   Command (manual line → open on behalf, D7). If plan 3 is already on staging, S4 runs those
   too.
4. **Command admins who are also affiliates exist or will** (the preview's Nina is staff).
   Q8 is enforced in the database; the UI only has to stop offering what will be refused.

---

## Findings (verified 2026-11-23, by reading the files named)

### F1 — Plan 1's payout CHECK and Command's crypto module disagree on the format  ⚠️ → B1, D1
`backbone/supabase/migrations/20261118000003_affiliate_payout_methods.sql:29` constrains
`details_enc ~ '^v1\.'`. Command's `lib/payout/crypto.server.ts:81` writes `VERSION = "v2"`
(AES-256-GCM with the row's id as AAD, `:133-135`, `:151-167`), and `decryptDetails` throws on
anything but `v2` (`:182-200`) — deliberately: its header records `v1` as the un-bound format
whose defect `v2` fixed (a blob copied between rows decrypts on the wrong record). So a
Command-encrypted blob is refused by the CHECK (23514), and a blob that passes the CHECK cannot be
read by Command. Plan 1's T1 fixture writes the literal `'v1.AAAA.BBBB.CCCC'`
(`backbone/supabase/tests/affiliate_data_layer_test.sql:452`), which is why T1 passed. Not a
leak; a hard stop for Q17/Q46.

### F2 — The two "remove" paths guard only referrals, not money  ⚠️ → B2
`command/app/api/affiliates/route.ts:261-272` (DELETE: remove affiliate status) and
`command/app/api/users/route.ts:287-296` (DELETE: the account) refuse only while
`vendor_referrals` rows exist. Since plan 1 an affiliate can be owed money with **no** referral:
a manual line (`command_add_commission_adjustment`, M4 `:1615-1664`) or lines from a vendor that
was later moved to someone else (M5 is forward-only). Removing the `affiliates` row then
cascades the payout destination (M3 `:25`) and leaves lines whose owner is no longer an
affiliate, so `affiliate_balance` and `command_open_withdrawal` both raise "This user is not an
affiliate" (M4 `:865`, `:1189`): the money is unreachable. Deleting the account sets
the lines' `affiliate_user_id` to NULL (M4 `:119`). Unreachable until commission is switched on
(plan 2's Settings card), so plan 2 is what makes it live.

### F3 — Command's code change bypasses Q8 and records no actor
`command/app/api/affiliates/route.ts:208-241` (PATCH) updates `affiliates.referral_code` with the
service-role client. The M2 guard still refuses a reserved code (`23505`, M2 `:158-163`), so
Q16a holds, but: (1) `change_referral_code`'s self-refusal (M2, via
`affiliate_assert_command_actor`, M1 `:128-136`) never runs, so an admin can change their **own**
code; (2) the history row's `changed_by` is `auth.uid()` = NULL under the service role (M2
`:189`); (3) its comment (`:203-206`) and the modal (`AffiliateModal.tsx:80-89`) still say old
links stop working. → I1.

### F4 — Platform fee settings are readable by Command admins only
`20260726000001_platform_fee_settings_rls_tighten.sql:36-42` narrowed SELECT to Command
admin/root. Plan 1's function table says "the settings stay readable by every authenticated
user, as today" — inaccurate, but harmless: the affiliate reads the minimum through
`affiliate_balance()` (definer). For plan 3's notes, not a plan 2 change.

### F5 — Two preview controls have no column or function behind them  → D7, D8
(1) The change-referrer dialog's "No one (remove the referral)" (`screens.js`, referrerModal):
M5 has `change_vendor_referrer` and `credit_vendor_referral` only — nothing removes a referral.
(2) The complete form's "Sent by" and "Date sent": `affiliate_withdrawals` stores only
`transfer_reference` and `completed_at` (M4 `:53-57`).

### F6 — `affiliate_balance` for an admin's own account takes the affiliate branch
M4 `:854-858`: when `p_user_id = auth.uid()` it asserts an **affiliate** caller (active +
`affiliate` portal + affiliates row), else the Command actor. An admin opening their own
affiliate record therefore gets `42501` unless they also hold the `affiliate` portal. The list
and detail must treat "this is me" before calling it (B4).

### F7 — Embeds that must name their FK
`affiliate_withdrawals` → `profiles` five times (M4 `:38-58`); `affiliate_referral_code_changes`
→ `profiles` twice (M2 `:61-69`); `affiliates` → `profiles` twice (already named in
`services/users.service.ts:14` and `services/affiliates.service.ts:24-27`). `affiliate_commissions`
→ `vendors` once (bare embed is safe).

### F8 — No sidebar count pattern exists
`components/layout/Sidebar/useSidebar.ts` holds open/close only; `lib/navigation.ts:4-8` has no
count field. The preview's sidebar badge would be new plumbing → DEFERRED.

### F9 — Command notifications are not links
`NotificationItem.tsx` renders title/body/time only, no navigation; `TYPE_ICON` (`:7-23`) is an
exhaustive `Record<NotificationType, …>`, so adding a type to `lib/types.ts:220-239` without an
icon fails type-check. Good: the type-checker enforces I8.

### F10 — The "make affiliate" pre-checks consult current codes only
`app/api/users/route.ts:62-66` and `app/api/affiliates/route.ts:66-69` look for a clash in
`affiliates` only. A code reserved to someone else (an old code, Q16a) passes the pre-check, the
account is created (`users/route.ts:68-72`), the insert is refused by the M2 guard, and the
route deletes the account again (`:136`). Correct outcome, wasteful path; the pre-check should
also read `affiliate_referral_codes` (service role has SELECT, M2 `:120-123`). → I9.

### F11 — "Remove affiliate" copy is stale
`useAffiliateModal.ts:98-99` says removing frees the code for reuse. Since M2 a code stays
reserved to its holder forever (FK to `profiles`, not `affiliates`, M2 `:44-47`); removing only
stops it crediting (`resolve_referral_code` joins `affiliates`, M2 `:251-262`). → I10.

### F12 — Command can already grant the portal; admins cannot grant it to themselves
`user_portals` insert policy (`20260807000001_command_access_grant_root_only.sql:81-94`): root
anything; admin only to a non-privileged user and never `command`. The `affiliate` portal needs
no migration to be grantable, and an admin cannot give it to themselves (they are privileged).

### F13 — No bulk balance function
`affiliate_balance(p_user_id)` is per affiliate (M4 `:825`). The list's "Available" column and
KPIs need every affiliate's figure. → D2.

### F14 — Local invite target
`backbone/supabase/config.toml:160` allow-lists `localhost:3000–3002` only; the affiliate app's
`npm run dev` serves on 3000 (`affiliate/README.md:11`), which collides with
`PORTAL_URL_COMMAND=http://localhost:3000` (`command/README.md:170`). → D11.

### F15 — `change_vendor_referrer` accepts the current referrer as the new one
M5 `:73-130` does not refuse `p_user_id = current affiliate`; it writes a no-op change row. The
dialog excludes the current referrer from its picker (I3).

### F16 — The preview's "Every change is recorded with your name" overstates it
`platform_fee_settings` keeps `updated_by` / `updated_at` for the **last** change only
(`services/platformFeeSettings.service.ts:42-55`); plan 1 deferred a rate-change log. The card
copy says "The last change shows who made it" instead (B3).

### F17 — The notification settings page has no affiliate entries
`NotificationSettingsPage.tsx:7-24` (type → portal label), `:26-31` (colours), `:34-41`
(per-portal email rows): plan 1 added five types and an `affiliate` email row, which render with
fallbacks ("All", raw `affiliate`). → I8.

### F18 — The settings page fails whole if a selected column is missing
`getPlatformFeeSettings()` (`platformFeeSettings.service.ts:21-27`) returns an error for the
whole row on any unknown column, and `usePlatformFeeSettingsPage.ts:19-28` then shows
nothing. Adding the four affiliate columns to that select ties the existing fee and withholding
cards to plan 1's M1 being applied. Fine on local/staging (applied); decides the production
order (Release → safe-pause).

### F19 — Existing patterns this plan reuses (located, not rebuilt)
- Queue with one open panel, reason ≥ 10, reload after submit: `ClosureQueue/useClosureQueue.ts:19-119`.
- Decrypt on deliberate click, log **before** returning plaintext, leak rules:
  `app/api/vendor-payout/route.ts:1-30, 115-127, 172-181`; one-way reveal and focus restore:
  `PayoutDetailModal/usePayoutDetailModal.ts:31, 48-56`.
- Child settings card owned by the page hook: `WithholdingTaxSettings` +
  `usePlatformFeeSettingsPage.ts:79-98`.
- Human-written DB messages surfaced verbatim: `services/payouts.service.ts:360-385`.
- Caller check for every route: `lib/commandAuth.server.ts:50-69`.
- Paging past PostgREST's 1000-row cap: `lib/pagedFetch.ts`.
- Pure, `node --test`-able helpers with no `@/` imports: `lib/referralCode.ts`, `lib/affiliateCsv.ts`.
- Browser reads of affiliate data under the admin's RLS: `services/affiliates.service.ts:4-11`.

### F20 — Corrections of an affiliate's own booking now fail with a new message
M4 `:717-745` refuses a fee correction by the booking's referrer (`42501`, hint
`affiliate_self_action`, message "You cannot correct the fee on a booking you referred").
`correctPayout` already surfaces messages verbatim (`payouts.service.ts:378-385`), so it reads
correctly with no change. Checked here so nobody "fixes" it.

### F21 — Account closure deletes the user with no affiliate check  ⚠️ → B2, D19 (second review, 2026-11-24)
`command/lib/accountDeletion/execute.server.ts:425` deletes the auth user as closure's last step,
and nothing in `lib/accountDeletion/` mentions affiliates (grep). A vendor-admin who is also an
affiliate and closes their account loses the `affiliates` row and payout details (cascade) and
leaves their lines with `affiliate_user_id` NULL: the same unreachable money as F2, by a third
path B2 did not list. Q9 and Q50b say earned commission is paid out on closure, so the closure
flow must see the balance first.

### F22 — The new nav item changes committed visual baselines  (second review, 2026-11-24)
`visual-tests/pilot.spec.ts:44` captures `sidebar` and `tabbar` panes; the committed baselines
`pilot.spec.ts-snapshots/sidebar-{light,dark}-chromium-linux.png` render
`components/layout/Sidebar` from `app/ui-gallery/page.tsx:555-558`, and `TabBar` builds from
`MAIN_TABS` in the same `lib/navigation.ts`. B4's "Affiliates" entry will fail those baselines
until they are regenerated deliberately and the new images reviewed (memory: baselines are
committed; never pass a run by raising tolerances). → B4 verification.

### F23 — Plan 1 does not yet record its own payout-format defect  (second review, 2026-11-24)
F1 is plan 1's M3 bug, found here. Plan 1 now records it as its F24, pointing to this plan's M1
(to avoid confusion with plan 1's own M1, call this one "plan 2 M1"). Plan 1's staging checks
(S4) covered referrals only; no withdrawal was ever attempted on staging, so this plan's S4 is the
first live test of payout details and withdrawals. Plan 1's settings note (F4 here) is corrected
in plan 1 and in `architecture/schema.md` at the same time.

### F24 — Command's `npm run lint` already fails, before this plan  (stage 1, 2026-11-25)  ⬜ TODO (reported, not fixed)
`npm --prefix command run lint` exits 1 with **19 errors, 5 warnings**, every one in a file this
plan has not touched (`app/api/users/route.ts`, `services/users.service.ts`,
`services/vendors.service.ts`, `services/command.service.ts`, `lib/constants.ts`,
`app/not-found.tsx`, `ClosureQueue.tsx`, `useAppShell.ts`, `useUpdateUser.ts`,
`useCreateVendor.ts`, `useUpdateVendor.ts`): 18 `no-explicit-any` plus unused-import warnings — the
class `2026-08-07-command-root-only-command-access.md:534` already called endemic. Stage 1's
files lint clean on their own (`npx eslint <files>`, exit 0). So "lint green" in this plan's gates
means **no new problems, the count stays at 19 / 5**, until someone fixes the backlog. Several of
those files (`app/api/users/route.ts`, `useUpdateUser.ts`) are edited in stage 2: leave their
existing `any`s unless the edit touches the line (surgical changes).
*Stage 2 (2026-11-25):* still 19 / 5 after stage 2, the same 11 files; every stage-2 file lints clean.

### F25 — I1's code-history component has no screen until B4  (stage 2, 2026-11-25)  ⏸ PARKED → stage 3
I1 lists `components/affiliates/ReferralCodeHistory/` among its files, but the only place the plan
mounts it is the Affiliates detail (B4, stage 3). Built in stage 2 it would be unmounted and
unverifiable, so it moves to stage 3 with B4. I1's security half (F3: the PATCH through
`change_referral_code`, the admin recorded as `changed_by`, own account refused) is done in stage 2,
and `changed_by` can already be confirmed by read-only SQL. Unblocks: B4's detail page exists.

### F26 — `pilot` `overview-light` flaked once under full-suite load  (stage 2, 2026-11-25)  ⬜ TODO (reported, not fixed)
In the full Playwright run, `overview-light` failed with a different pixel count on each retry frame
(1,356 / 3,222 / 1,866, ratio 0.01); it passed alone straight after. Stage 2 touches nothing that
screen renders. Same class as the backdrop-blur / load note in `playwright.config.ts` and memory
(Playwright stalls under load). Not fixed here; re-run alone before treating it as a regression.

### F27 — Adding Affiliate to `ALL_PORTALS` changed six committed user-modal baselines  (stage 2, 2026-11-25)  ✅ regenerated
`usermodal`, `useraddmodal`, `userview` × light/dark failed (13–22 % of pixels) because the Affiliate
chip now renders and wraps to a second row. The actual images were opened and checked: the chip is
the only difference. Only those six were regenerated (`-g "usermodal|useraddmodal|userview"
--update-snapshots`), then re-run green (6/6). Committed baselines: they go in the command commit.

### F28 — The affiliate chip colour is pink, not violet  (stage 2, 2026-11-25)  ✅ (note)
`PORTAL_CFG` colours are mirrored on the notification settings page, where violet already means
"Both". Affiliate is `#ec4899` in both places so the two pages agree.

### F29 — Two small knock-ons fixed in passing  (stage 2, 2026-11-25)  ✅
(1) `command/README.md`'s "The `PORTAL_URL_*` trio" heading became "The four `PORTAL_URL_*`
variables"; `architecture/auth-and-roles.md:190` cites it by name and was updated to match. (2) The
Command email row on Settings → Notifications said "new registrations and vendor approvals"; since
plan 1 it also emails `affiliate_withdrawal_requested` (generic template), so it now says so (I8).

---

## How Command calls plan 1 (the contract this plan builds on)

Read from the SQL (`20261118000001`–`06`, `20261121000001`). "Browser" = the existing service
pattern (`lib/supabase/client.ts`, admin's session, RLS). "Route" = a Route Handler that verifies
the caller (`verifyCommandCaller`) and then uses the **cookie-bound** server client
(`lib/supabase/server.ts`), so `auth.uid()` is the admin, unless marked "service role".

| Action | Call | From | Returns | Refusals Command must word (code · hint) |
|---|---|---|---|---|
| Balance | `affiliate_balance(p_user_id)` | browser | `available, not_yet_available, held, in_withdrawal, withdrawn_to_date, minimum, withdraw_blocker` | 42501 (self, F6) · "not an affiliate" |
| Terms | `set_affiliate_terms(p_user_id, p_rate_percent, p_is_staff)` — **sets both** | browser | void | 42501 `affiliate_self_action` · 22023 `affiliate_open_request` · 23514 `affiliates_commission_rate_range` |
| Code change | `change_referral_code(p_user_id, p_code)` | route (I1; needs the share link) | void | 23505 `affiliate_referral_codes_referral_code_pkey` · 22023 "already this affiliate's" / format |
| Payout details | `set_affiliate_payout_method(p_user_id, p_method_type, p_schema_version smallint, p_details_enc, p_display, p_identity_confirmation)` | route (encrypts) | void | 22023 `affiliate_withdrawal_processing` · 23514 display shape / `details_enc` (B1) · identity < 5 chars |
| Open on behalf | `command_open_withdrawal(p_user_id, p_reason, p_waive_minimum)` | browser | uuid | `affiliate_staff`, `affiliate_withdrawals_off`, `affiliate_open_request`, `affiliate_no_payout_details`, `affiliate_below_minimum`, "nothing available", reason < 10 |
| Start processing | `command_start_withdrawal_processing(p_withdrawal_id)` | browser | `requested_amount, amount, lines_removed` | `affiliate_below_minimum` (D5) · `affiliate_no_payout_details` · "Only a requested…" · "No available lines…" · P0002 |
| Complete | `command_complete_withdrawal(p_withdrawal_id, p_transfer_reference)` | browser | void | "Only a withdrawal that is processing…" · reference < 3 |
| Reject | `command_reject_withdrawal(p_withdrawal_id, p_reason, p_transfer_failed)` | browser | void | `affiliate_processing_reject` (D6) · reason < 10 · "Only an open…" |
| Payroll | `command_record_payroll_payment(p_user_id, p_reference, p_paid_on)` | browser | uuid | "Only staff…" · "nothing available to pay" · reference < 3 · date |
| Adjustment | `command_add_commission_adjustment(p_user_id, p_amount, p_reason)` | browser | uuid | amount 0 · reason < 10 |
| Change referrer | `change_vendor_referrer(p_vendor_id, p_user_id, p_reason)` | browser | void | `affiliate_self_action` · `affiliate_inactive_referrer` · "no referrer to change" |
| Credit vendor | `credit_vendor_referral(p_vendor_id, p_user_id, p_reason)` | browser | void | `affiliate_already_referred` · `affiliate_credit_window_closed` · `affiliate_inactive_referrer` · P0002 |
| Settings | `update platform_fee_settings set affiliate_* , updated_by` (id = 1) | browser | — | 23514 `platform_fee_settings_affiliate_live_needs_tax` / `_tax_range` / `_rate_range` / `_min_positive` |
| Decrypt | read `affiliate_payout_methods` + insert `affiliate_payout_view_log` | route, **service role** (M3 `:170-176` grants exactly this) | fields | — |
| Make affiliate / import | insert `affiliates` | route, **service role** (no function exists; `authenticated` has no write grant) | — | 23505 (F10) |

Reads (browser, RLS "command admin or root", SELECT only): `affiliates`, `affiliate_referral_codes`,
`affiliate_referral_code_changes`, `affiliate_payout_methods` (masked `display` only — never select
`details_enc` from the browser), `affiliate_payout_method_log`, `affiliate_payout_view_log`,
`affiliate_commissions`, `affiliate_commission_status_log`, `affiliate_withdrawals`,
`vendor_referral_changes`, plus the existing `vendor_referrals`, `vendors`, `profiles`,
`vendor_members`.

Many refusals share `22023` with no hint. Plan 1 wrote them for a human, and Command's convention
is to show such messages verbatim (F19), so B8 maps **by hint or constraint where one exists**
and passes the message through otherwise — never by matching message text.

---

## MIGRATIONS (each an approval gate — drafted, not written)

### M1 — Let `affiliate_payout_methods` hold Command's row-bound `v2` blobs  ✅ DONE on local (2026-11-25) · staging ⬜ (S1) · production ⏸ — D1 = a, approved 2026-11-24; file and T1 fixture line written exactly as drafted; applied locally by the user; verified (machine, local): newest local version `20261123000001`, constraint reads `CHECK ((details_enc ~ '^v2\.'::text))` (read-only psql), T1 exit 0 "all 105 cases passed" (the one plpgsql_check warning is plan 1's known F21), `npx supabase db lint` "No schema errors found"
**Why:** F1. **File (when approved):** `backbone/supabase/migrations/20261123000001_affiliate_payout_details_v2.sql`
(sorts after every environment's newest version, `20261121000001`; re-check with
`migration list` on each before applying, as plan 1 F18 did).

```sql
-- Plan: .plans/2026-11-23-affiliate-command.md (M1; F1, D1)
-- Command encrypts affiliate payout details with lib/payout/crypto.server.ts, format v2:
-- AES-256-GCM with the affiliate's user_id as additional authenticated data, so a blob
-- copied to another row fails to decrypt. M3 required the older v1 prefix, which
-- Command neither writes nor reads.
-- Must run after: 20261118000003 (the table), 20261121000001 (latest applied).

alter table public.affiliate_payout_methods
  drop constraint affiliate_payout_methods_details_enc_check,   -- name confirmed by R1
  add  constraint affiliate_payout_methods_details_enc_check
       check (details_enc ~ '^v2\.');

comment on column public.affiliate_payout_methods.details_enc is
  'AES-256-GCM ciphertext, "v2.<iv>.<tag>.<ciphertext>" base64, bound to user_id as additional authenticated data. The key is server-only (Command) and is NOT stored in this database. Losing the key makes every row permanently unreadable.';
```

Plus the one test-fixture line: `backbone/supabase/tests/affiliate_data_layer_test.sql:452`
`'v1.AAAA.BBBB.CCCC'` → `'v2.AAAA.BBBB.CCCC'` (T1 never decrypts, so any `v2.` string works).

**Blast radius:**
- **Data:** the new CHECK validates existing rows. Expected zero rows everywhere (R1); a `v1.`
  row would fail the migration, which is the right outcome (Command could not read it anyway).
- **Lock:** `ACCESS EXCLUSIVE` on `affiliate_payout_methods` for the validation scan of an
  empty table — milliseconds. No other table touched.
- **Downstream:** no grant, policy or function changes; `set_affiliate_payout_method` passes the
  string through. T1 fixture as above. `schema.md` row for the column.
- **Reversibility:** a reverse migration restoring `^v1\.` (only while no `v2.` row exists).
- **Alternative shape:** `'^v[0-9]+\.'` would let a future key rotation (v3) ship without a
  migration, as the vendor table (no CHECK at all) does. Recommended against: an exact prefix
  catches a wrong writer; a rotation is a rare, planned change that can carry a one-line
  migration. The user may prefer the looser form (D1).
- ⚠️ Cross-app (backbone + command): approval gate; ships in this plan's staging stage, first.

**Verification:** T1 re-run locally after the user applies M1 (machine, local; expect 105/105);
`db lint`; then a real Command save on local (B6) and on staging (S4).

---

## BLOCKERS (the Command side is not safe or not usable without these)

### B1 — Payout-details format (F1)  🔄 IN PROGRESS — M1 part in stage 1 (see M1); the `crypto.server.ts` header/parameter note and the A-vs-B test case are still ⬜, done with B6 in stage 4
**Files:** M1 (above) · `command/lib/payout/crypto.server.ts:13-16` (header: "Command never writes
a payout destination" becomes false), `:151` (`encryptDetails(details, vendorId)` — the AAD
parameter is any row id; rename the parameter to `rowId` or add a comment, nothing else changes).
**Fix approach:** per D1. Recommended: M1, and Command encrypts with `encryptDetails(details,
userId)` and decrypts with `decryptDetails(blob, row.user_id)` — the id of the row **read**, never
a request value (the vendor rule, `crypto.server.ts:178-180`). The tests beside the module
(`crypto.server.test.ts`) gain one case: a blob sealed for user A fails for user B.
**Verification:** `npm test` (machine); B6's live save + reveal (local, then staging).

### B2 — Guard the "remove" paths and account closure with money, not only referrals (F2, F21)  🔄 IN PROGRESS — code ✅ machine-verified (2026-11-25); live local ⬜ (user)
**Done (stage 2, 2026-11-25):** new pure `lib/affiliateRemoval.ts` (wording + `hasAffiliateMoneyRecord`,
`removeAffiliateRefusal`: referrals → money → portal, D6) + 9 tests; new server-only
`lib/affiliateRecords.server.ts` (`readAffiliateMoneyRecord`: any `affiliate_commissions` or
`affiliate_withdrawals` row, `null` on a failed read). `DELETE /api/affiliates` and `DELETE /api/users`
refuse on money (and Remove on the portal, D6), **fail closed** on a failed read (500, nothing
deleted). `GET /api/affiliates` returns `hasCommission` (true when unknown); `useAffiliateModal`
uses the same `removeAffiliateRefusal` for the button's tooltip. Closure: `eligibility.ts` gains
`affiliate_balance`, `affiliateOwed` (centavo sum, NaN/non-finite → owed), `OWED_COMMISSION_STATUSES`,
`OPEN_WITHDRAWAL_STATUSES`, `scopeDeletesUser` (also used by `execute.server.ts` now, one definition);
`app/api/account-deletion/route.ts` computes it for `requested_by` only when the scope deletes the
login, paged past 1000 rows, failing closed on an error or incomplete read; GET (queue) and POST
(pre-execute) both use it, including rows with no vendor attached. `ClosureQueue` labels it with the
next action. The header of `eligibility.ts` records the deliberate divergence from vendor's copy (D20).
**Verified (machine):** `eligibility.test.ts` +9 cases (net > 0 blocks; net ≤ 0 and a float-drift sum do not; withdrawn lines are never read — the owed-status list is pinned; open withdrawal blocks; bad input blocks; scopes); `affiliateRemoval.test.ts` 9;
tsc, build, lint (no new problems). **Live local waits partly on stage 3:** a money record needs I5's manual line (or B6/B5), so the Remove/Delete/closure live checks run after I5.
**Files:** `command/app/api/affiliates/route.ts:252-288`, `command/app/api/users/route.ts:283-296`,
`components/users/AffiliateModal/useAffiliateModal.ts:40-61` (the button's own pre-check).
**Fix approach:** before deleting, also count `affiliate_commissions` (any status) and
`affiliate_withdrawals` for the user (service role has SELECT). Refuse if either is non-zero,
with the next action spelled out: "This affiliate has commission on record, so their affiliate
status can't be removed. Suspend the user instead; to pay a final balance first, open a
withdrawal from Affiliates (account-closure waiver)." The modal's `GET /api/affiliates` response
gains `hasCommission` so Remove explains itself before the click (same reasoning as its
`referralCount`). Per D6, Remove is also refused while the user still holds the `affiliate` portal ("Remove the Affiliate portal first").
**Third path (F21, D19 = a, 2026-11-24):** account closure. Command computes eligibility live per vendor in `app/api/account-deletion/route.ts:84-105` (`fetchEligibility`), shows it in the queue (GET `:134`) and re-checks it immediately before executing (POST `:171`); the user deleted is `request.requested_by`, and only when the scope deletes the user (`lib/accountDeletion/execute.server.ts:165-168`). Add a fourth `BlockerCode` `affiliate_balance` to `lib/accountDeletion/eligibility.ts:57-63` (counts gain `affiliateOwed`), computed for `requested_by` **only when the scope deletes that user**: blocks while the user has an `affiliate_withdrawals` row in `requested` / `processing`, or the **net sum** of their `affiliate_commissions.amount` in `earned`, `held` or `in_withdrawal` is > 0 (service-role read, the route's existing client; not `affiliate_balance`, which refuses a service-role caller). A net ≤ 0 does not block: Q4-neg writes off a negative balance at closure. Lines not yet available (7-day clock) and held lines (open dispute) still block, so a closure may have to wait for them. Lines `withdrawn`, `written_off` or `cancelled` do not block. Next action shown with the blocker: "This person is still owed affiliate commission. Open a final withdrawal from Affiliates (account-closure waiver), complete it, then close the account." `eligibility.test.ts` gains the new code's cases. Vendor app side: per D20.
**Verification:** a unit-testable predicate in `lib/` (`node --test`, machine), plus `lib/accountDeletion/eligibility.test.ts` cases for `affiliate_balance` (net > 0 blocks; net ≤ 0 and withdrawn-only do not; open withdrawal blocks). Live on local: add a manual line to a test affiliate (B4/I5), then try Remove and Delete → both refused; a closure request by a vendor-admin affiliate with a positive balance shows the blocker and refuses to execute; after a waived final withdrawal is completed, the blocker clears.

### B3 — Settings: the "Affiliate commission" card (Q34, Q35, Q45; plan 1 D1)  🔄 IN PROGRESS — code ✅ machine-verified (2026-11-25); live local ⬜ (user)
**Done (stage 2, 2026-11-25):** as listed below. `PlatformFeeSettings` + 4 fields; the service reads
them and gains `updateAffiliateCommissionSettings` (never sends `affiliate_commission_live_from`);
`usePlatformFeeSettingsPage.saveAffiliateCommission` (refusals worded by `affiliateErrorMessage`,
re-read after save). New `components/settings/AffiliateCommissionSettings/` (render / hook / CSS):
"switched off" status, three fields with the CHECK ranges, live-since line (Manila), D12 inline
confirmation that enables only when the retyped rate equals the one being saved, D14 warning when
the minimum is cleared (counts open withdrawals via new `countOpenWithdrawals()`; falls back to a
general sentence if the count fails), worked example from new pure `lib/affiliateMath.ts`
(integer-centavo, half-away-from-zero, matching `round(numeric, 2)`), F16 footer. `/ui-gallery?mode=affiliatecommission`
(`&live=1`) fixture.
**Verified (machine):** `affiliateMath.test.ts` 6 (plan 1's ₱176.00 → ₱154.88 → ₱1.55; ₱5,165 to a
₱5 minimum; the 1.005 half-centavo case); `visual-tests/settings-affiliate-commission.spec.ts` 5/5
(unset + retype gate + cancel; minimum-only save skips the gate; live: can't clear tax, example
figures, live change needs no gate; invalid values; clearing the minimum warns);
`settings-withholding.spec.ts` still green; tsc, build, lint clean.
**Files:**
- `command/lib/types.ts:15-22` `PlatformFeeSettings` gains `affiliateTaxPercent: number | null`,
  `affiliateDefaultRatePercent: number`, `affiliateMinWithdrawal: number | null`,
  `affiliateCommissionLiveFrom: string | null` (nullability exactly as M1 `:36-46`).
- `command/services/platformFeeSettings.service.ts:9-40` (DbRow, select, mapping) and a new
  `updateAffiliateCommissionSettings(tax, rate, min)` beside `updateWithholdingSettings`
  (`:64-82`): one UPDATE of the three columns + `updated_by`. It **never sends**
  `affiliate_commission_live_from` (the trigger ignores it anyway, M1 `:62-80`).
- New `components/settings/AffiliateCommissionSettings/` — `AffiliateCommissionSettings.tsx`
  (render only), `useAffiliateCommissionSettings.ts` (form strings, validation, dirty state,
  the first-tax confirmation step), `AffiliateCommissionSettings.module.css` (tokens only, light
  and dark). Mounted in `PlatformFeeSettingsPage.tsx` under `WithholdingTaxSettings` (`:86`);
  saving goes through a `saveAffiliateCommission` handler on `usePlatformFeeSettingsPage.ts`,
  which stays the only owner of the row (the `:72-98` pattern: re-read after save, toast).
**Behaviour (matches the preview's two Settings screens):**
- Fields: tax (0 ≤ x < 100, 2 dp, "Not set" allowed **only while not live**), default rate
  (0 < x ≤ 100), minimum (> 0, ₱, may be cleared: clearing turns withdrawals off — when open
  withdrawals exist, the warning says they cannot start processing until a minimum is set, M4
  `:1321`).
- **Not live yet:** a status note "Affiliate commission is switched off…" (preview). On the
  first save that sets the tax rate, a confirmation step states: "Saving a tax rate switches
  affiliate commission on from this moment. It cannot be switched off or cleared afterwards;
  the rate itself can still be changed." It requires typing the rate again (D12) before Save
  enables.
- **Live:** shows "Commission live since <date, Manila time>", read-only; the tax field cannot
  be emptied (the UI blocks it; the CHECK is the backstop).
- Worked example as the preview (₱1,600 booking → fee → after tax → share; bookings needed to
  reach the minimum), computed with the **same two-step rounding** as M4's
  `affiliate_after_tax_amount` / `affiliate_share_amount` (plan 1 F11), in a pure
  `lib/affiliateMath.ts` with tests against plan 1's worked figures (₱176.00 → ₱154.88 → ₱1.55).
  Display only; the database computes the real lines.
- Footer copy: "A change applies to bookings completed from then on… The last change shows who
  made it." (F16), using the page's existing shared "Settings last changed … by …" line.
**Separation:** render/hook/CSS as listed; the card owns its form only, never a second copy of
the row (same contract as `WithholdingTaxSettings`).
**Verification:** `npm test` (`affiliateMath`), `npm run lint`, `npx tsc --noEmit` (machine). A
`/ui-gallery` mode + behavioural Playwright spec beside `visual-tests/settings-withholding.spec.ts`
for: unset state, confirmation gate, live state, invalid inputs (machine, port 3300). Live
local: save the minimum only; save the default rate; **do not set the tax rate locally unless the
user accepts that T1 then fails until `db reset`** (Watch out). Staging: S4.

### B4 — The Affiliates section: list and detail (Q37)  ⬜ TODO
**Files:**
- `command/lib/navigation.ts:10-25` add `{ id: "affiliates", label: "Affiliates", icon: HandCoins }`
  (lucide, already a dependency) **after `closures`** (Management, per the `:15-24` comments);
  `PAGE_TITLES` (`:44-53`) `affiliates: "Affiliates"`. `KNOWN_PAGES` derives itself (`:39-42`).
- `command/components/layout/AppShell/AppShell.tsx:23-25, 101-103` lazy-load and render
  `AffiliatesPage`, passing the caller's id (`currentUser`, `:30`) for self-detection.
- New `components/affiliates/`:
  - `AffiliatesPage/` (`.tsx`, `useAffiliatesPage.ts`, `.module.css`) — the two sub-tabs
    (Affiliates · Withdrawals, with the open count from the queue fetch) and which view is open
    (list / one affiliate / one withdrawal). In-page state, like every Command page: Back from a
    detail is the "← All affiliates" button; browser Back leaves the page (existing shell
    behaviour, `useAppShell.ts:190-208`).
  - `AffiliateList/` (`.tsx`, `useAffiliateList.ts`, `.module.css`) — KPIs (affiliates, active /
    suspended; open withdrawals and amount; available not requested; no payout details), search
    by name / email / code (client-side over the loaded set, Assumption 1), the table and the
    "needs attention" badge — one per row, first that applies: open withdrawal (requested /
    processing) → no payout details (non-staff) → suspended → staff "paid through payroll".
    Type column (plan 1 D12): Staff if `is_staff`; Vendor if a `vendor_members` row; Booker if
    the `booker` portal; else Partner. Empty state: "No affiliates yet. Make someone an affiliate
    from the Users page." Loading and error states as `ClosureQueue`.
  - `AffiliateDetail/` (`.tsx`, `useAffiliateDetail.ts`, `.module.css`) — balance card (the
    five buckets from `affiliate_balance`; rate line "1% … (default)" or "(override)"); referred
    vendors (vendor, status, signed up, code used, Change referrer per row, I3); "Credit a vendor"
    (I3); payout card (`AffiliatePayoutCard`, B6); code history (I1); recent lines (100 newest,
    "Show more" pages through `pagedFetch`) and withdrawals for this affiliate; profile card
    (email, type, account status, affiliate since). Staff variant (Q48, preview "Staff affiliate ·
    detail"): the payroll note, "Record payroll payment" (I4), payroll history instead of
    withdrawals, "Payout details: Not needed". Action buttons are disabled with their reason
    written beside them (preview rule).
- **Self (Q8, F6):** when the affiliate is the caller, the detail shows "This is your own
  affiliate account. Another admin must make any change to it." and renders no actions, and
  **does not call** `affiliate_balance` (it would raise, F6); the list shows "—" in that row's
  Available.
- **Data:** `services/affiliates.service.ts` (one file for the domain; the existing CSV summary
  stays) gains `listAffiliates()`, `getAffiliateDetail(userId)`, `getAffiliateBalance(userId)`,
  `getCodeHistory(userId)`, `listCreditableVendors()`, and the write wrappers I1–I3, I5 call.
  The list's balances come from `affiliate_balance` per row (D2 a) with `Promise.all`; a failed
  row shows "—" with the error in a tooltip-free note, not a blank.
**Baselines (F22):** the nav entry changes the committed `pilot` `sidebar` (and, if `MAIN_TABS` gains it, `tabbar`) baselines. Regenerate only those, deliberately, review the new images in the stage report, and confirm every other baseline is unchanged.
**Verification:** `npx tsc --noEmit`, lint (machine). `/ui-gallery` fixtures for list (populated,
empty, error) and detail (partner, staff, self) with a behavioural spec (machine). Live local with
seeded `NINA2026` / `LIZA2026` (plan 1 F16) and one test affiliate created through Users
(staging S4 repeats it).

### B5 — Withdrawals queue and lifecycle (Q44; plan 1 D5, D6)  ⬜ TODO
**Files:** new `services/affiliateWithdrawals.service.ts` (queue, one withdrawal with its lines
and status log, and the start / complete / reject / open / payroll calls); new
`components/affiliates/WithdrawalQueue/` (`.tsx`, `useWithdrawalQueue.ts`, `.module.css`) and
`components/affiliates/WithdrawalDetail/` (`.tsx`, `useWithdrawalDetail.ts`, `.module.css`), the
reject form inside the detail (one open panel at a time, the `useClosureQueue` rule).
**Behaviour:**
- Queue: filter chips Open (default) · Completed · Rejected · All; oldest first for Open, newest
  first otherwise; columns as the preview (ref, affiliate snapshot name, amount, masked
  destination, requested, status). Requested rows show the **current** sum of their
  `in_withdrawal` lines; when it differs from `requested_amount`, "₱X (was ₱Y)". History pages
  50 at a time. Empty Open state: "No withdrawals waiting."
- Requested: lines table (ref, booking date, vendor, share), the checks panel (payout details on
  file, at/above minimum, affiliate account status, not staff — display only; the database
  re-checks), **Start processing** and **Reject**. No full account details here.
- Start processing → the RPC returns `requested_amount, amount, lines_removed`; if
  `lines_removed > 0` the processing screen says "N line(s) left this withdrawal since it was
  requested; send ₱amount, not ₱requested". Refusal `affiliate_below_minimum` → the reject panel
  opens with the reason prefilled for editing ("Some bookings in this withdrawal were refunded or
  disputed, so it fell below the minimum. The rest is back in your balance.") — plan 1 D5.
- Processing: "Send exactly ₱amount"; **Show full details** (B6 reveal; not automatic);
  "Mark as completed" needs the transfer reference (≥ 3 chars, "the affiliate sees it on the
  receipt"); "Reject instead" opens the reject panel with a **required** checkbox "I confirmed no
  money left Ezzy for this withdrawal" that sets `p_transfer_failed` (D6). Completion is final
  and says so.
- Rejected / completed / cancelled: read-only record (who, when, reason or reference, waiver,
  transfer-failed flag, payroll flag).
- A concurrency refusal ("Only a requested withdrawal…") reloads the withdrawal and says
  "Another admin changed this withdrawal. It has been reloaded."
- Self: withdrawals of the caller's own account render read-only (database refuses anyway).
**Verification:** tsc, lint, `/ui-gallery` states (requested, requested-with-dropped-lines,
processing, completed, rejected, transfer-failed) + behavioural spec (machine). The full
lifecycle live on local and staging through I6 (open on behalf), since no affiliate app exists
yet (Assumption 3).

### B6 — Payout details: entry and "show full details" (Q17, Q26, Q32; plan 1 D9)  ⬜ TODO
**Files:**
- Ports from vendor, verbatim, each with the `crypto.server.ts`-style "keep byte-compatible"
  header and its tests copied beside it: `vendor/lib/payout/banks.ts` → `command/lib/payout/banks.ts`;
  `vendor/lib/payout/phMobile.ts` → `command/lib/payout/phMobile.ts`; `parsePayoutDetails`
  (`vendor/lib/payout/schema.ts:190`) and `maskedDisplayFor` (`:251`) into
  `command/lib/payout/schema.ts`, whose header (`:9-13`, "Command never writes") is rewritten.
  `pesonetBanks.ts` keeps its own keys (it already mirrors PH_BANKS codes).
- New `command/app/api/affiliate-payout/route.ts`:
  - **PUT** — `verifyCommandCaller()`; body `{ userId, methodType, details, identityConfirmation }`;
    `parsePayoutDetails` (allow-list) → `maskedDisplayFor` → `encryptDetails(details, userId)` →
    `rpc("set_affiliate_payout_method", …)` on the **cookie-bound** client (`lib/supabase/server.ts`),
    so the database sees the admin and refuses self-entry (Q8) and a change while processing.
    Never the admin client (M3 gives `service_role` no write grant, by D9).
  - **GET** — the vendor route's shape exactly (`app/api/vendor-payout/route.ts:60-139`):
    caller check, one affiliate per request, service-role read of the row, schema-version guard,
    `decryptDetails(row.details_enc, userId-of-the-row)`, **insert into
    `affiliate_payout_view_log` before returning** (fail closed, 503), labelled fields in
    transfer order. The four leak rules copied into its header.
- New `components/affiliates/PayoutDetailsModal/` (`.tsx`, `usePayoutDetailsModal.ts`,
  `.module.css`) — method (bank / GCash / Maya), bank picker, account name, number / mobile, the
  identity confirmation (D17), Save disabled with its reason until complete (preview). Focus
  return as `usePayoutDetailModal.ts:48-56`.
- New `components/affiliates/AffiliatePayoutCard/` (`.tsx`, `useAffiliatePayoutCard.ts`,
  `.module.css`) — masked destination, "Entered by … on …, identity confirmed by …" from the
  latest `affiliate_payout_method_log` row, **Show full details** (one-way reveal, the
  `usePayoutDetailModal.ts:31` rule: remount per affiliate, no "hide"), **Replace details**.
  Used on the affiliate detail and the processing screen.
**Risk surface:** the plaintext exists only in the GET response and the revealed card; no
`console.*` of details, ciphertext or display (vendor leak rule 1); the browser never selects
`details_enc`. `PAYOUT_ENCRYPTION_KEY` is already set in Command's environments (the vendor
reveal uses it), so no new secret.
**Verification:** `npm test` for the ported parse/mask/banks/phone tests and the crypto AAD case
(machine). Live local (after M1): save details for a test affiliate, reveal, and confirm by
read-only SQL one `affiliate_payout_method_log` row and one `affiliate_payout_view_log` row;
try saving on your own account → refused. Staging: S4.

### B7 — Users page: the `affiliate` portal and the invite (Q10)  🔄 IN PROGRESS — code ✅ machine-verified (stage 1 + 2, 2026-11-25); live local ⬜ (user, D11)
**Done (stage 2, 2026-11-25):** `ALL_PORTALS` + `affiliate`; `PORTAL_CFG.affiliate` (pink, F28);
`portalOrigins.server.ts`: `isPortal` accepts it, `PRIORITY` = command > vendor > affiliate > booker
(D5), the "unreachable" comment removed. D6 as one pure rule, `affiliateAccessError(portals, code)` in
`lib/userAccess.ts` (same shape as `commandAccessError`), used by: `POST /api/users` (before
`createUser`), `useUpdateUser` (before any write, judged only on portals being **added**, so
`toggleStatus` and unrelated edits of an existing holder are never refused), and `UserModal` (Add:
the code label reads "required for the Affiliate portal" and Save waits for it; Edit: the chip is
shown but disabled for a non-affiliate, with "Make them an affiliate first", and stays removable for
someone who already holds it). `UserToolbar` lists Affiliate automatically. README: env table row,
"The four `PORTAL_URL_*` variables" (priority, no fall-through, the booker rule restated for
affiliate, the shared local 3002 per D11).
**Verified (machine):** `portalOrigins.server.test.ts` +7 (affiliate-only, > booker, booker blank
still links, < vendor, < command, blank affiliate → not_configured with no fall-through, malformed →
misconfigured); `userAccess.test.ts` +5 (D6); tsc, build, lint; six user-modal baselines regenerated
after review (F27).
**Stage 1 note:** adding `"affiliate"` to `Portal` made `ORIGIN_ENV: Record<Portal, string>` in
`lib/portalOrigins.server.ts` fail type-check, so it gained `affiliate: "PORTAL_URL_AFFILIATE"` now,
with a comment that it is unreachable: `isPortal` and `PRIORITY` still ignore `affiliate`, so
origin resolution is unchanged until stage 2 adds both (D5). `ALL_PORTALS` / `PORTAL_CFG` are
deliberately untouched: adding the chip before D6's code requirement would let it be granted bare.
**Files:**
- `command/lib/types.ts:1` `Portal` adds `"affiliate"`; `lib/constants.ts:33` `ALL_PORTALS`;
  `:101-105` `PORTAL_CFG` gains an affiliate colour (tokens, both themes).
- `command/lib/portalOrigins.server.ts:26-30` `PORTAL_URL_AFFILIATE`; `:37` priority per D5
  (recommended `command` > `vendor` > `affiliate` > `booker`); `:57-59` `isPortal`; tests in
  `portalOrigins.server.test.ts` for the new order and the blank/misconfigured cases.
- `components/users/UserModal/UserModal.tsx:44, 109-125, 187-203` + `useUserForm.ts` — the chip
  appears for admin and root (F12 already limits who can receive it); per D6: in **Add User**,
  choosing the Affiliate chip makes the Referral code field required; in **Edit User**, the chip
  is offered only to a user who already has a code ("Make them an affiliate first"), and
  `POST /api/users` refuses `affiliate` without a code (route is the boundary).
- `components/users/UserToolbar/UserToolbar.tsx:46` — the portal filter lists Affiliate
  automatically from `ALL_PORTALS`.
- The invite needs no new route: `POST /api/users` (`:176-182`) and
  `/api/users/send-set-password-link` already resolve the origin from the granted portals; with
  D5 they aim an affiliate at `PORTAL_URL_AFFILIATE`.
- `command/README.md` → "Environment variables" table and "The `PORTAL_URL_*` trio" become four,
  with the booker rule restated for affiliate: **set the variable on an environment only after
  that environment's affiliate app is confirmed to use the same Supabase project**
  (`architecture/auth-and-roles.md:193` is the precedent).
**Verification:** `npm test` (origins), tsc, lint (machine). Live local per D11. Staging: S2/S4.

### B8 — Foundations: interfaces, services, error wording  ✅ DONE (2026-11-25)
**Done:** `services/affiliates.service.ts` (appended: `WithdrawBlocker`, `AffiliateBalance`,
`AffiliateListRow`, `AffiliateDetail`, `CommissionLine` + kind/status unions,
`CommissionStatusLogEntry`, `ReferralCodeChange` + source union, `AffiliatePayoutSummary`,
`PayoutMethodLogEntry`, `VendorReferralChange`, each table row with a private `…DbRow` and an
exported `to…` mapper); new `services/affiliateWithdrawals.service.ts` (`AffiliateWithdrawal`,
`WithdrawalStatus`, mapper); new `lib/affiliateErrors.ts` + `lib/affiliateErrors.test.ts`.
Nullability read from the `create table` statements (`20260917000001`, `20261118000001`–`05`). No
fetchers yet (they arrive with their screens). `affiliateErrorMessage(error, context?)` takes an
optional `"start_processing"` context because `affiliate_below_minimum` needs the D5 reject
prompt there and a different sentence at open-on-behalf. The 23514/23505 constraint name is read
from the quoted identifier in Postgres's standard `violates … constraint "<name>"` message
(PostgREST sends no constraint field); 23505 is `REFERRAL_CODE_TAKEN` except `affiliates_pkey`
("already an affiliate"), since the M2 guard's raise carries no constraint name in its message.
`lib/types.ts`'s `NotificationType` (I8) and `PlatformFeeSettings` (B3) changes stay with those items.
**Verified (machine, 2026-11-25):** `npm --prefix command test` 178/178 pass (30 new, one per mapped
hint/constraint plus pass-through and generic cases); `npx tsc --noEmit` exit 0; `npm run build`
exit 0; `npx eslint` on the stage's files exit 0 (repo-wide lint: F24).
**Files:**
- Hand-written interfaces (repo rule; nullability checked against the `create table`
  statements, not plan text): `DbRow` types private to `services/affiliates.service.ts` and
  `services/affiliateWithdrawals.service.ts`, exported app types for the components —
  `AffiliateListRow`, `AffiliateDetail`, `AffiliateBalance` (the seven columns; `withdraw_blocker`
  as the union `'staff' | 'withdrawals_off' | 'open_request' | 'below_minimum' |
  'no_payout_details' | null`), `CommissionLine` (kind, status unions from M4 `:116, 132-133`),
  `CommissionStatusLogEntry`, `AffiliateWithdrawal` (status union from M4 `:41-42`, every
  nullable column optional-null as declared), `ReferralCodeChange` (source union M2 `:66`),
  `AffiliatePayoutSummary` (`display` only), `PayoutMethodLogEntry`, `VendorReferralChange`.
  `lib/types.ts` gains only `Portal`, `NotificationType` (I8) and `PlatformFeeSettings` (B3)
  changes.
- New pure `lib/affiliateErrors.ts` (no `@/` imports, `node --test`): `(error: { code?, hint?,
  message?, details? }) → string`. Maps the hints and constraint names in the contract table to
  sentences with the next action (e.g. `affiliate_no_payout_details` → "Add payout details for
  this affiliate first."; `affiliate_below_minimum` at start → the D5 reject prompt;
  `affiliate_self_action` → "You can't act on your own affiliate account — ask another admin.";
  `23505` on the registry → `REFERRAL_CODE_TAKEN`; 23514 by constraint name; `42501` without a
  hint → "You don't have permission to do this."), else returns the database message verbatim
  (F19), else a generic sentence. One table, tested case by case.
**Verification:** `npm test` (machine): one case per mapped hint/constraint plus pass-through.

---

## IMPORTANT

### I1 — Code change through `change_referral_code`; code history (Q16d; F3)  🔄 IN PROGRESS — PATCH + note ✅ machine-verified (2026-11-25); history ⏸ → B4 (F25); live local ⬜ (user)
**Done (stage 2, 2026-11-25):** `PATCH /api/affiliates` keeps URL and response but calls
`rpc("change_referral_code")` on the cookie-bound client (`lib/supabase/server.ts`); refusals
(42501 / 23505 / 22023 / P0001) → 400 with `affiliateErrorMessage`, anything else → 500 + log.
`validateCode` is format-only and synchronous. `AffiliateModal`'s red warning is replaced by the
one-line blue note ("Links using the old code keep crediting this affiliate. Old codes are never given
to anyone else."); the now-unused `.warning*` CSS removed. **Not done:** `ReferralCodeHistory` — moved
to B4 (F25).
**Files:** `command/app/api/affiliates/route.ts:200-241` (PATCH), `:56-72` (`validateCode` keeps
format checks only), `components/users/AffiliateModal/AffiliateModal.tsx:80-89`,
new `components/affiliates/ReferralCodeHistory/ReferralCodeHistory.tsx` (pure display: props in,
list out — the one-file exception, no state, styled with an existing module or tokens only).
**Fix approach:** PATCH keeps its URL and response (it still returns the share link built from
the server-only `PORTAL_URL_VENDOR`) but replaces the service-role UPDATE with
`rpc("change_referral_code", { p_user_id, p_code })` on the cookie-bound client: the database then
records the admin as `changed_by`, refuses their own account, and applies one rule for everyone.
The warning block is replaced by a one-line note: "Links using the old code keep crediting this
affiliate. Old codes are never given to anyone else." The Affiliates detail's "Change code" opens
the same `AffiliateModal` (it already takes a `User`; the detail builds one) — no second modal.
History: every row of `affiliate_referral_code_changes` (named FK embed for `changed_by`, F7) with
"Current" / "Still works" badges from `affiliate_referral_codes`; source labels: `affiliate` →
"Changed by the affiliate", `command` → "Changed by Ezzy" (+ name when `changed_by` is set),
`backfill` → "Recorded at launch", `import` → "Imported" (kept for completeness; per D4 = a nothing writes `import` yet, so imported codes read "Changed by Ezzy").
**Verification:** tsc, lint, `npm test` (error map) (machine). Live local: change a test
affiliate's code → history row carries your name; change your own → refused. Staging: S4.

### I2 — Rate override and staff flag (Q7, Q48)  ⬜ TODO
**Files:** new `components/affiliates/AffiliateTermsModal/` (`.tsx`, `useAffiliateTermsModal.ts`,
`.module.css`).
**Fix approach:** one dialog with "Use the default rate (n%)" / "Override: __ %" (0–100, 2 dp;
0 allowed and explained: "earns nothing on new bookings") and a "Staff affiliate — paid through
payroll" switch. `set_affiliate_terms` sets **both** values, so the hook re-reads the affiliate
row immediately before saving and sends the unchanged one as read (no clobbering a colleague's
edit with stale state). Copy: "Applies to bookings completed from now on; earned lines keep the
rate they were earned at" (Q7). Refusal `affiliate_open_request` explains the staff flag waits for
the open withdrawal.
**Verification:** tsc, lint; behavioural spec on a fixture (machine); live local + S4.

### I3 — Attribution dialogs: credit a vendor, change referrer (Q18, Q19; plan 1 D8)  ⬜ TODO
**Files:** new `components/affiliates/CreditVendorModal/` and
`components/affiliates/ChangeReferrerModal/` (each `.tsx`, `use….ts`, `.module.css`).
**Fix approach:** Credit — list vendors with **no** `vendor_referrals` row signed up in the last
60 days (PostgREST anti-join on the embed, `.is("vendor_referrals", null)`, bounded by date),
those past 30 days shown but not selectable ("Past 30 days"), reason ≥ 10, "Credit runs from today,
not from the sign-up date" (preview). Change referrer — picker of **active** affiliates excluding
the current referrer (F15) and the caller (Q8), reason ≥ 10, the "From now on only" note; **no
"remove the referral" option** (D7). Both buttons are disabled when the affiliate on the page is
not active, with the reason, because the database requires an active referrer (plan 1 F15 c, D10).
**Verification:** tsc, lint, fixture spec (machine); live local: credit a seeded vendor with no
referral, move it back, read `vendor_referral_changes` (read-only SQL). Staging: S4.

### I4 — Payroll for staff affiliates (Q30, Q48)  ⬜ TODO
**Files:** new `components/affiliates/PayrollModal/` (`.tsx`, `usePayrollModal.ts`, `.module.css`).
**Fix approach:** shows the whole available balance and line count (from `affiliate_balance` and
the lines), payroll date (`type=date`, default today Manila), reference ≥ 3; "No transfer is made
from here and no email is sent" (preview; M4 `:1535-1612` sends none). Refusals verbatim.
**Verification:** tsc, lint, fixture spec; live local + S4 (needs a staff affiliate with a manual
line).

### I5 — Manual adjustment (Q36)  ⬜ TODO
**Files:** new `components/affiliates/AdjustmentModal/` (`.tsx`, `useAdjustmentModal.ts`,
`.module.css`).
**Fix approach:** signed amount (₱, 2 dp, ≠ 0; a negative takes money back), reason ≥ 10 marked
"shown to the affiliate" (M4 comment `:1661`), and a confirm step restating "Add ₱X to <name>'s
available balance now" (the line is available immediately, M4 `:1644-1647`). Not available on
your own account.
**Verification:** tsc, lint, fixture spec; live local (this is also how S4 creates money to
withdraw).

### I6 — Open a withdrawal on an affiliate's behalf (preview F3; plan 1 D7)  ⬜ TODO
**Files:** new `components/affiliates/OpenWithdrawalModal/` (`.tsx`, `useOpenWithdrawalModal.ts`,
`.module.css`), launched from the affiliate detail when `withdraw_blocker` is null **or** is
`below_minimum` (for the waiver) and the affiliate is non-staff.
**Fix approach:** reason ≥ 10 ("why Ezzy is opening this"); an "Account-closure final payout —
waive the minimum" checkbox shown only when the balance is below the minimum, with "Use this only
when the account is being closed" (D7: the database cannot verify it; the reason is the record).
States plainly that the affiliate is emailed "Withdrawal received" (plan 1 F15 b, D9).
**Verification:** tsc, lint, fixture spec; live local + S4.

### I7 — Pre-launch import (Q39)  ⬜ TODO (shape per D3, D4, D13)
**Files (D3 = a):** new `components/affiliates/AffiliateImport/` (`.tsx`, `useAffiliateImport.ts`,
`.module.css`) as a third sub-tab, root and admin; new pure `lib/affiliateImport.ts` (RFC 4180
parse — no new dependency — header check `name,email,code,rate`, per-row validation with the
existing `normaliseReferralCode` / `isWellFormedReferralCode`, duplicate emails or codes inside the
file) with `node --test` tests; new `app/api/affiliates/import/route.ts`.
**Fix approach:**
1. **Dry run** (`POST …/import { rows, dryRun: true }`): the route re-validates every row and
   classifies it against the database: *new account* · *existing user → will be made an
   affiliate* · *already imported* (affiliate with this exact code — skipped, so re-runs are safe)
   · *refused* (code reserved to someone else per `affiliate_referral_codes`; email is an affiliate
   with a different code; email belongs to a privileged user). Nothing is written.
2. **Apply** (`dryRun: false`, only rows the dry run accepted, re-checked): per row, sequentially —
   create the account the way `POST /api/users` does (member role, active, **affiliate portal**,
   no password, **no email**), insert `affiliates` (service role, `created_by` = caller), then
   the rate override if given through `set_affiliate_terms` on the cookie-bound client. A row that
   fails is rolled back as `POST /api/users` rolls back an affiliate (`:131-145`) and reported;
   other rows continue. Batch cap: 200 rows per request.
3. **Invitations, separately:** the result lists imported rows with "Send invitation" and "Send to
   all listed", which call the existing `/api/users/send-set-password-link` one user at a time,
   paced (one per second) with per-row outcome — Supabase Auth's mail rate limit applies.
   Invitations are only meaningful once `PORTAL_URL_AFFILIATE` is set on that environment.
To keep one definition of "create an account", the account-creation steps of `POST /api/users`
(`:68-120`) move into a server-only `lib/users/createAccount.server.ts` used by both routes. ⚠️ That
touches a security-relevant route: it is an extraction with no behaviour change, verified by the
existing Users flows before and after (live local), and called out for review.
**Verification:** `npm test` (`affiliateImport`), tsc, lint (machine). Live local: dry run of a
sample file with one of each class; apply; re-run → all "already imported"; invite one. Staging:
S4 with two or three throwaway rows (staging email override delivers every invite to
`cto@ezzy.ph`, memory).

### I8 — Notifications: the new types and the affiliate email row (F9, F17)  🔄 IN PROGRESS — code ✅ machine-verified (2026-11-25); visual check ⬜ (user, local)
**Done (stage 2, 2026-11-25):** five types in `NotificationType`; icons in `NotificationItem`
(HandCoins / CheckCircle / XCircle / Link2); settings labels (requested → "Command", the four →
"Affiliate"), an "Affiliate" colour, the `affiliate` email-row description as written below, and the
Command row's description now names withdrawal requests (F29). **Verified (machine):** tsc (the
exhaustive map compiles), build, lint.
**Files:** `lib/types.ts:220-239` add the five affiliate types (Command receives only
`affiliate_withdrawal_requested`, administers all five); `NotificationItem.tsx:7-23` icons (the
exhaustive map forces this); `NotificationSettingsPage.tsx:7-41` labels ("Command" for
requested, "Affiliate" for the other four), an Affiliate colour and the `affiliate` email-row
description ("Withdrawal updates, receipts and code-change notices emailed to affiliates").
**Verification:** tsc (the exhaustive map), lint (machine); visual check of the Settings →
Notifications page (local).

### I9 — Make-affiliate routes: registry-aware pre-check, no self-assignment (F10, D15)  🔄 IN PROGRESS — code ✅ machine-verified (2026-11-25); live local ⬜ (user)
**Done (stage 2, 2026-11-25):** pure `isReferralCodeReservedToOther(owner, userId)` in
`lib/referralCode.ts` (own old code allowed; a NULL owner retired for everyone; a new account owns
nothing) + 5 tests; `isReferralCodeTaken` in `lib/affiliateRecords.server.ts` reads `affiliates`
**and** `affiliate_referral_codes`; used by `POST /api/users` (before `createUser`) and
`POST /api/affiliates`. `POST /api/affiliates` refuses `userId === caller` ("Another admin must make
you an affiliate.") before anything else (D15). The inserts still handle 23505 (race).
**Files:** `app/api/users/route.ts:62-66`, `app/api/affiliates/route.ts:56-72, 162-176`.
**Fix approach:** the pre-check also reads `affiliate_referral_codes` (code held by someone else →
`REFERRAL_CODE_TAKEN` before any account exists). Per D15, `POST /api/affiliates` refuses
`userId === caller.user.id` ("Another admin must make you an affiliate") — the database cannot,
because the insert is a service-role write.
**Verification:** `npm test` for any extracted predicate, live local (reserved old code refused
before creation; self refused).

### I10 — Stale copy on the Users page (F11)  ✅ DONE (2026-11-25)
**Done:** `useAffiliateModal` comment, the Remove button's tooltip ("Stops this code crediting
anyone. The code stays reserved to this person…"), the `DELETE` and `PATCH` doc comments in
`app/api/affiliates/route.ts`, and `useAffiliate`'s two comments. **Verified (machine, 2026-11-25):**
`grep -rn "freed\|stop being credited\|stops being credited\|stop working\|stops working"` over
`command/` app, components, hooks, lib, services, README returns only the two comments that describe
the removed claim (`AffiliateModal.tsx:81`, `AffiliateModal.module.css:5`) — nothing stale.
**Files:** `useAffiliateModal.ts:96-100` (comment), `AffiliateModal.tsx:99-107` (Remove title
text), `app/api/affiliates/route.ts:200-207, 243-251` (comments).
**Fix approach:** removing affiliate status stops the code crediting; the code stays reserved to
this person and is never given to anyone else. Wording only.
**Verification:** grep for "freed", "stop being credited" in `command/` returns nothing stale
(machine).

---

## DECISIONS
<!-- Hard gate (plan-authoring §7): no item executes while any OPEN line remains. -->

- **D1 — How Command stores affiliate payout details (F1, B1).** → **(a) M1 with the exact `^v2\.` CHECK** (resolved 2026-11-24) — keeps Command's row-bound v2 crypto unchanged; an exact prefix catches a wrong writer, and a key rotation can carry its own one-line migration. Options were: (a) M1
  (exact `^v2\.` CHECK) and Command's existing `v2` crypto, AAD = the affiliate's `user_id`.
  (a′) M1 with the looser `^v[0-9]+\.`, so a key rotation needs no migration. (b) No migration:
  Command writes `v1`-prefixed blobs with its own affiliate-only decrypt branch — rejected: it
  reuses the prefix that means "not row-bound, refuse" in the vendor format, a trap for the next
  reader. (c) No migration: drop the AAD and write true `v1` — rejected: reintroduces the
  row-swap attack `v2` exists to stop.
- **D2 — Balances on the list (F13).** → **(a) one `affiliate_balance` call per affiliate, in parallel** (resolved 2026-11-24) — no migration and one definition of the buckets; revisit with (b) past ~100 affiliates. Options were: (a) one `affiliate_balance` call per
  affiliate, in parallel (tens of rows, Assumption 1; one definition of the buckets). (b) A
  migration adding a Command-only `command_affiliate_balances()` returning every affiliate's
  buckets — the right answer past ~100 affiliates. (c) Sum lines in the browser — rejected: a
  second definition of "available".
- **D3 — Where the import lives (Q39).** → **(a) a Command screen + server route** (resolved 2026-11-24) — the service-role key never leaves Vercel, and it can be re-run from any environment's Command. Options were: (a) a Command screen + server route
  (admin session, the service-role key never leaves Vercel, re-runnable from any environment's
  Command). (b) A Node script the user runs with an environment's service-role key on their own
  machine — puts that key on disk per run (core rules: secrets). (c) SQL by hand — cannot create
  Auth users properly and is raw SQL outside migrations.
- **D4 — The history label for imported codes.** → **(a) no migration** (resolved 2026-11-24) — verified the label is the only difference: imports are INSERTs, so they send no notification (`20261118000002:193`), and the 30-day clock counts self-service changes only (`:273`, `:303`). Options were: (a) no migration; the M2
  guard records `command` (the setting `app.referral_code_source` cannot be set through
  PostgREST), so imported codes read "Changed by Ezzy" with no name. (b) A small migration adding
  a `service_role`-only definer function that sets the source to `import` and inserts the
  affiliate (plan 1's deferred list foresaw it) — exact "Imported" label, one more function.
- **D5 — Set-password link priority with the affiliate portal.** → **(a) `command` > `vendor` > `affiliate` > `booker`** (resolved 2026-11-24) — resolution takes the first granted portal with no fall-through (`portalOrigins.server.ts:102-103`), so affiliate must rank above the sometimes-blank booker. Options were: (a)
  `command` > `vendor` > `affiliate` > `booker` — affiliate above booker matters because
  production's booker variable has been blank before and a booker-who-becomes-affiliate must
  still get a link; vendor above affiliate because a vendor's password works in both and vendor
  is their main tool. (b) `command` > `affiliate` > `vendor` > `booker`.
- **D6 — Tie the `affiliate` portal to an affiliates row.** → **(a) tie them** (resolved 2026-11-24) — avoids accounts that can sign in to an app that refuses everything. Options were: (a) the portal
  can be granted only to someone with a referral code (Add User requires the code when the chip is
  on; Edit User offers the chip only to existing affiliates; `POST /api/users` refuses it without
  a code), and Remove affiliate is refused while the user still holds the portal ("Remove the
  Affiliate portal first"). Otherwise a person can sign in to an app that refuses everything
  (affiliate caller = portal **and** row, M1 `:155-156`). (b) Leave them independent; the
  affiliate app explains the empty state (plan 3).
- **D7 — The preview's "No one (remove the referral)" (F5).** → **(a) drop it from v1** (resolved 2026-11-24) — Q18 decided moving, not removing; no migration. Options were: (a) drop it
  from v1; Q18 decided moving a referrer, not removing one. (b) Keep it: needs a new M5-style
  function (migration) with its own reason and log kind.
- **D8 — The preview's "Sent by" and "Date sent" (F5).** → **(a) drop both** (resolved 2026-11-24) — `completed_at` is the date and the reference is what the receipt shows (columns checked, M4 `:53-57`); no migration. Options were: (a) drop both; the
  date is `completed_at`, and the transfer reference is what the affiliate's receipt shows.
  (b) Fold them into the reference text ("InstaPay · 1234567") — no migration, but the receipt
  then prints it. (c) A migration adding two columns.
- **D9 — Plan 1 F15 (b): Command-opened withdrawals email** → **(a) keep the email** (resolved 2026-11-24) — the wording (M4 `:1256`) is true for Command-opened ones; I6's dialog says it goes. Was: Command-opened withdrawals email the affiliate "Withdrawal
  received… processed within 5 business days".** (a) **Recommended:** keep it; it is true and
  tells a suspended or departing affiliate the money is coming. Command's dialog says the email
  goes. (b) Change the wording for Command-opened ones — a migration replacing
  `command_open_withdrawal`.
- **D10 — Plan 1 F15 (c): crediting a vendor requires an active referrer.** → **(a) keep active-only** (resolved 2026-11-24) — same rule as moving one; a suspended affiliate earns nothing new (Q9). Options were: (a)
  **Recommended:** keep it (same rule as moving one; a suspended affiliate earns nothing new
  anyway, Q9). The dialogs are disabled for a non-active affiliate with the reason. (b) Allow it
  for suspended affiliates — a migration, and the credit would earn nothing until reactivation.
- **D11 — Checking the invite locally (F14).** → **(a) no config change** (resolved 2026-11-24) — 3002 is already allow-listed (`config.toml:160`); plan 3 owns the affiliate app's port. Options were: (a) no config change in this
  plan: locally set `PORTAL_URL_AFFILIATE=http://localhost:3002` (already allow-listed) and run the
  affiliate app on 3002 for the click-through, with booker stopped; plan 3 decides the affiliate's
  real local port and its allowlist entry. (b) Add a port (e.g. 3003) to `config.toml` now —
  a backbone change and a local Supabase restart (needs the user's go-ahead).
- **D12 — Who may set the tax rate the first time.** → **(a) admin or root, with the rate retyped to confirm** (resolved 2026-11-24) — matches the UPDATE policy (`20260725000001:69-79`, checked); retyping is the closure-queue precedent. Options were: (a) admin or root (what
  RLS already allows, `20260725000001:69-79`), with the rate typed a second time to confirm — the
  closure queue's "typing replaces root-gating" precedent (`useClosureQueue.ts:66-77`). (b) Root
  only in the UI (the database would still let an admin through a direct call).
- **D13 — Import: an email that already has an account.** → **(a) make that account an affiliate** (resolved 2026-11-24) — labelled in the dry run; refused for admin/root. Options were: (a) make that
  account an affiliate (code + portal), no new account — the dry run labels it so the user sees it
  first. Refuse it if the account is admin/root (privileged). (b) Refuse every existing email.
- **D14 — Clearing the minimum while withdrawals are open.** → **(a) allow it, with B3's warning** (resolved 2026-11-24) — keeps the Q45 off switch usable at any time. Options were: (a) allow it
  with the warning in B3 (it is the "withdrawals off" switch, Q45). (b) Refuse while any withdrawal
  is open.
- **D15 — An admin making themselves an affiliate.** → **(a) refuse in the route** (resolved 2026-11-24) — the route inserts with the service role for any body `userId` (`app/api/affiliates/route.ts:166-176`, checked), so only the route can refuse; Q8's intent. Options were: (a) refuse in
  `POST /api/affiliates` and `POST /api/users` cannot (it creates a new account, never the
  caller); another admin creates staff affiliates (Q8's intent: no one sets up their own
  earnings). (b) Allow it; Q8's database checks still stop every later action on it.
- **D16 — Switching commission on in production.** → **(a) not a release step** (resolved 2026-11-24) — the user sets it on a chosen date after plans 1–3 are live; recorded here then. Options were: (a) not a release step of
  any plan; after plans 1–3 are live in production, the user sets the tax rate and minimum on
  production Command on a date they choose, recorded in this plan as a dated decision. (b) Make
  it P5 of this plan.
- **D17 — What the identity confirmation records (Q32; the column needs ≥ 5 characters).** → **(a) required method + optional note, stored as one sentence** (resolved 2026-11-24) — records how identity was checked.
  (a) **Recommended:** a required "How you confirmed it's them" choice (Phone call to the number on
  file · Video call · In person) plus an optional note, stored as one sentence, e.g. "Phone call
  to the number on file — spoke to Rina 14 Oct". (b) A checkbox only, storing a fixed sentence (the
  preview) — records less.
- **D19 — Account closure of an affiliate who is still owed money (F21; Q9, Q50b).** → **(a) closure is blocked until the balance is paid out** (resolved 2026-11-24) — keeps discovery Q9/Q50b. The user first chose (b) write-off; on being told it reverses Q9 and that plan 1's schema cannot mark an unpaid balance `written_off` without a withdrawal (`20261118000004:144`, so a write-off would need a new function), the user chose (a). Options were: (a)
  **Recommended:** closure is not eligible until the balance is paid out: Command opens a final
  withdrawal with the closure waiver (I6), completes it, then executes the closure. Nothing is
  lost and the record is clean. (b) Allow closure and write the balance off, with the amount
  recorded in the closure's review notes. Simpler, but the affiliate loses money Q9 says is owed.
- **D20 — Should the vendor app's closure-request check also know the affiliate blocker (from D19)?** → **(a) Command only** (resolved 2026-11-24) — keeps plan 2 single-app apart from M1; Command's live eligibility and pre-execute re-check (`app/api/account-deletion/route.ts:134, 171`) enforce D19. Accepted cost: the vendor-admin is not told at request time why closure waits. (b) was: also add it to `vendor/lib/accountDeletion/eligibility.server.ts` — cross-app.
- **D18 — Setting the tax rate on staging (plan 1 Assumption 4).** → **(a) yes, during S4** (resolved 2026-11-24) — the only way to see real commission lines before production. The user first asked whether tax had been excluded; clarified that Q27 excludes **withholding** (plan 2 adds none) while Q34's after-tax rate (fee × (1 − tax %) × rate) stands, and the user confirmed keeping it. Options were: (a) yes,
  during S4, accepting that staging's go-live is stamped permanently — the only way to see real
  commission lines before production. (b) No: S4 uses manual lines only, and the commission
  trigger is first exercised in production.

## DEFERRED / COSMETIC
- **Sidebar count of open withdrawals** (preview; F8) — new shell plumbing for a number the
  sub-tab and the admins' notification already show. Add if staff miss requests.
- **A link from the Users-page `AffiliatePanel` to the Affiliates detail** — convenience; both
  read the same data.
- **Bulk balance function** — only if D2 (a) and the list grows (D2 b).
- **Rate-change audit log** (plan 1 deferred) — per-line snapshots keep history right; F16's copy
  avoids overstating.
- **Disabling a payout method** (plan 1 deferred) — no screen needs it.
- **Command RLS policies on the affiliate tables check portal + role but not `is_active()`**
  (M2 `:84-89` and siblings) — pre-existing house style (`platform_fee_settings` is the same);
  the app gate refuses suspended staff. Not changed here.
- **Preview F1** (shared Command preview shell) — preview tooling, its own job.

---

## Read-only pre-checks (the user runs them; nothing is changed)

### R1 — The payout CHECK's name and the table's contents  ✅ DONE (2026-11-24)
**Result (agent-run, read-only):** local (psql with `default_transaction_read_only=on`, confirmed `on`) and staging (`npx supabase db query --remote --read-only`, target `backbone-staging (fbxbwnfeimzhgxpshdpa)`) both show `affiliate_payout_methods_details_enc_check` = `CHECK ((details_enc ~ '^v1\.'::text))`, **0 rows**, 0 not-v2. M1's constraint name is confirmed; its re-validation will scan an empty table. Production not checked (plan 1 is not there; see R2).
Local and staging (`npx supabase db query --remote --read-only` for staging, as plan 1 S1):
```sql
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.affiliate_payout_methods'::regclass and contype = 'c';
select count(*) as rows, count(*) filter (where details_enc !~ '^v2\.') as not_v2
  from public.affiliate_payout_methods;
```
Expected: `affiliate_payout_methods_details_enc_check` = `^v1\.`, 0 rows. Any row → stop and
decide before M1.

### R2 — Newest applied migration everywhere  ✅ DONE (2026-11-25)
**Result:** newest applied version is `20261121000001` on **local** (read-only psql) and **staging**
(read-only `db query`, 2026-11-24). **Production** (`npx supabase migration list
--remote=pdkejyjidrfxksaczvfy`, run by the agent with the user's explicit permission, 2026-11-25):
newest applied is `20261117000001`; plan 1's seven (`20261118000001`–`06`, `20261121000001`) are
local-only there, as expected while plan 1's production is parked; no remote-only versions. So
`20261123000001` sorts last on every environment and M1's file name is final.

`npx supabase migration list` (local), `--remote` (staging), `--remote=<prod-ref>` (production,
CLI 3.2.0): newest must be ≤ `20261121000001` for M1's file name to sort last; otherwise rename M1
to a later version before writing it.

---

## Execution order

0. **Now:** ✅ D1–D20 resolved (2026-11-24); ✅ R1; ✅ R2 (local, staging, production); ✅ approval (user, 2026-11-25).
**Environment rule (user, 2026-11-25):** stages 1–5 run against **local only** (code, local DB, local
dev servers). Nothing is pushed, deployed or tested on staging before stage 6, and nothing touches
production — no migration, env var, deploy, data fix or test — before stage 7, which stays last.
The only production contact so far is R2's read-only `migration list` (2026-11-25).

1. **Stage 1 — foundations (local).** B8 (interfaces, service skeletons, `affiliateErrors`), the
   `Portal` type change (B7 part), B1/M1: 🤖 write M1 + the T1 fixture line once approved; 👤 apply
   locally; 🤖 re-run T1 + `db lint`. Gate: T1 105/105; `npm test`, lint, `tsc` green.
2. **Stage 2 — Settings and Users page (local).** 🔄 code ✅ 2026-11-25 (machine), live local ⬜ (user). B3, B7, B2, I1, I9, I10, I8. These are
   independent of the Affiliates section and make the programme switchable and grantable.
3. **Stage 3 — Affiliates section, read and terms (local).** B4 (+ I1's `ReferralCodeHistory`, F25), I2, I3, I5.
4. **Stage 4 — Money out (local).** B6 (needs M1 applied locally), B5, I6, I4. Live local run of the
   full lifecycle: manual line → open on behalf → start → reveal → complete; a second one rejected;
   a third rejected after processing as transfer-failed.
5. **Stage 5 — Import (local).** I7.
6. **Stage 6 — Staging release** (below). Stops for the user's "staging is green".
7. **Stage 7 — Production release, always last** — ⏸ parked until plans 1–3 are tested on
   staging; then plan 1's P-table first, this plan's next, plan 3's after.

Couplings: B6 needs M1 on the same environment; B5's lifecycle needs B6 (payout details are
required) and I5 or real lines (money to withdraw); B7's invite click-through needs plan 3's app on
that environment; I1's PATCH change ships with I10's copy. Stages 2 and 3 can swap; 4 cannot move
before 1.

## Big table (updated 2026-11-25, after stage 2 code)

| ✓ | Status | Stage | Item | What | Who | Why / notes |
|---|---|---|---|---|---|---|
| [x] | ✅ 2026-11-25 | 1 | B8 | Interfaces, mappers, `affiliateErrors` | Me | Foundation every screen uses; 30 tests |
| [x] | ✅ local 2026-11-25 | 1 | M1 | Payout CHECK → `^v2\.` | You (apply) / Me (write) | F1: Command's v2 blobs were refused; T1 105/105 |
| [ ] | 🔄 | 1→4 | B1 | crypto note + A-vs-B test | Me | M1 part done; rest with B6 (stage 4) |
| [ ] | 🔄 code ✅ | 2 | B3 | Settings: affiliate commission card | Me → You (live) | Makes the programme switchable; spec 5/5, math 6 tests |
| [ ] | 🔄 code ✅ | 2 | B7 | Affiliate portal chip, D5 origin, D6 rule, README | Me → You (live, D11) | How affiliates sign in; +12 tests; 6 baselines (F27) |
| [ ] | 🔄 code ✅ | 2 | B2 | Remove/Delete/closure guarded by money | Me → You (live after I5) | F2/F21: stops stranding owed money; +18 tests |
| [ ] | 🔄 code ✅ | 2 | I1 | Code change via `change_referral_code` | Me → You (live) | F3: records the admin, refuses self; history → B4 (F25) |
| [ ] | 🔄 code ✅ | 2 | I9 | Registry-aware pre-check; refuse self (D15) | Me → You (live) | F10: no wasted account on a reserved code; +5 tests |
| [x] | ✅ 2026-11-25 | 2 | I10 | Stale "code is freed" copy | Me | F11: grep clean |
| [ ] | 🔄 code ✅ | 2 | I8 | Notification types, icons, affiliate email row | Me → You (visual) | F9/F17; tsc enforces the map |
| [ ] | ⬜ | 2 | L2 | Stage 2 live local checks | You | Listed in the stage-2 report; not run by the agent |
| [ ] | ⬜ | 2 | C2 | Commit stage 2 (command + root) | You | Drafts in the stage-2 report |
| [ ] | ⬜ | 3 | B4 | Affiliates list + detail (+ I1 history, F25) | Me | The section the money screens hang off |
| [ ] | ⬜ | 3 | I2 | Rate override + staff flag | Me | Q7, Q48 |
| [ ] | ⬜ | 3 | I3 | Credit vendor / change referrer | Me | Q18, Q19 |
| [ ] | ⬜ | 3 | I5 | Manual adjustment | Me | Q36; also unlocks B2's live checks |
| [ ] | ⬜ | 4 | B6 | Payout details entry + reveal | Me | Needs M1 (done locally) |
| [ ] | ⬜ | 4 | B5 | Withdrawals queue + lifecycle | Me | Needs B6 + money |
| [ ] | ⬜ | 4 | I6 | Open a withdrawal on behalf | Me | D7 closure waiver |
| [ ] | ⬜ | 4 | I4 | Payroll for staff | Me | Q48 |
| [ ] | ⬜ | 5 | I7 | Pre-launch import | Me | D3, D4, D13 |
| [ ] | ⬜ | — | F24 | Command lint backlog 19 / 5 | You (decide) | Pre-existing; reported, not fixed |
| [ ] | ⏸ | 3 | F25 | `ReferralCodeHistory` | Me | Parked: no screen until B4; unblocks with B4 |
| [ ] | ⬜ | — | F26 | `overview-light` load flake | You (decide) | Passed alone; not a stage-2 change |
| [x] | ✅ 2026-11-25 | 2 | F27 | Six user-modal baselines regenerated | Me | Reviewed: only the new chip |
| [ ] | ⬜ | 6 | S1–S4 | Staging release | You + Me | After stages 3–5 |
| [ ] | ⏸ | 7 | P1–P5 | Production release | You | Parked: plans 1–3 together after plan 3's staging is green |

## Release (§12)

**Order within each environment, and why:** M1 first (additive, inert until Command writes), then
Command's env var, then the Command deploy. Command's new build reads plan 1's columns and tables,
so on any environment plan 1's migrations must already be there (F18).

**Safe-pause table**

| State | Safe? | Why / recovery |
|---|---|---|
| New Command, plan 1's migrations **not** applied | ⛔ | The Platform Fee page cannot load at all (F18) and the Affiliates section errors. Recover: roll the Command deploy back, or apply plan 1 first. Production order is therefore plan 1 → plan 2. |
| New Command, plan 1 applied, **M1 not** applied | ⚠️ | Everything works except saving payout details: the CHECK refuses it loudly (23514), nothing is stored. Recover: apply M1. |
| M1 applied, old Command | ✅ | Nothing writes the table. |
| `PORTAL_URL_AFFILIATE` blank | ✅ | Invites report "not configured" (the booker behaviour); grants still work. |
| `PORTAL_URL_AFFILIATE` set before that environment's affiliate app uses the same Supabase project | ⛔ | Set-password links validate nowhere. Recover: blank it, then set it after the app is confirmed (the booker rule). |
| Tax rate set | ⚠️ one-way | Stamps go-live permanently on that environment. Staging per D18; production per D16, never as a release step. |

### Staging (production untouched throughout)

| # | Who | Step | Check |
|---|---|---|---|
| S1 | 👤 | `cd backbone && npx supabase migration list --remote` → `npx supabase db push --remote --dry-run` → `npx supabase db push --remote` (CLI 3.2.0; plain `db push` targets local) | ⛔ only M1 pending; afterwards R1's query shows `^v2\.` |
| S2 | 👤 | Staging Command env: `PORTAL_URL_AFFILIATE` = the staging affiliate origin **only if plan 3's app is on staging and uses the staging project**, else leave blank; add that origin to the staging project's Auth redirect allowlist at the same time | ⛔ value is scheme + host only; allowlist entry exact |
| S3 | 👤 | Deploy `command` to staging (the user's usual Vercel staging deploy) | build green; note the deployment id for P4 |
| S4 | 👤 + 🤖 | Staging checks (Verification → staging) | ⛔ all green |

⛔ **Staging fully green before anything touches production.** A parked staging check needs a dated
user decision here before P1.

### Production (last stage) — ⏸ PARKED (2026-11-23): plans 1–3 go to production together, after the affiliate side (plan 3) is tested on staging. Unblocks when plan 3's staging checks are green and the user says go. Plan 1's P-table runs first.

| # | Who | Step | Check |
|---|---|---|---|
| P1 | 👤 | Parity: `npx supabase migration list --remote=<prod-ref>` and `--remote` | ⛔ production = staging minus plan 1's M1–M7 (if plan 1's P2 not yet run) and this M1; Command version = the tested staging deployment |
| P2 | 👤 | After plan 1's P2: `npx supabase db push --remote=<prod-ref> --dry-run` → `db push --remote=<prod-ref>` | ⛔ M1 listed remote |
| P3 | 👤 | Production Command env: `PORTAL_URL_AFFILIATE` **only after** the production affiliate app is confirmed on the production project (plan 3); allowlist entry in the production project | ⛔ as S2 |
| P4 | 👤 | Vercel **Promote** the exact `command` staging deployment tested in S4 | — |
| P5 | 👤 + 🤖 | Production checks (Verification → production) — **read-only; the tax rate stays unset** (D16) | ⛔ all green |

---

## Verification

**Machine (local), every stage:** `npm --prefix command test`, `npm --prefix command run lint`,
`npx --prefix command tsc --noEmit` (or `cd command && npx tsc --noEmit`), `npm --prefix command run
build`; Playwright behavioural specs on port 3300 (stop any dev server first; never read a run
through `tail`, memory). Stage 1 also: T1 and `npx supabase db lint` after the user applies M1.
`python3 scripts/plans-index.py --check` after plan edits.

**Live, local** (user applies M1; a local Command admin; seeded affiliates `NINA2026` / `LIZA2026`
and test users made through Users): each item's "live local" line above. Read-only SQL to confirm
log rows (`affiliate_payout_method_log`, `affiliate_payout_view_log`,
`affiliate_referral_code_changes.changed_by`, `vendor_referral_changes`,
`affiliate_commission_status_log`). Emails land in the local mail catcher. Not run locally unless
the user accepts T1 breaking until `db reset`: setting the tax rate.

**Live, staging (S4)** — with two staging accounts besides the tester (Q8): a partner affiliate and
a staff affiliate.
1. Settings: card loads unset; save a minimum; save a default rate; per D18, set the tax rate
   through the confirmation step → "live since" shows; clearing it is blocked. Platform fee and
   withholding still save (regression).
2. Users: grant the Affiliate chip (with a code); Add User with Affiliate requires a code (D6);
   send a set-password link → arrives at the staging override inbox aimed at
   `PORTAL_URL_AFFILIATE`, or "not configured" if S2 left it blank (expected).
3. Affiliates list and detail render for both test affiliates; your own account (if you are one)
   shows read-only.
4. Payout details: save for the partner (identity confirmation recorded); reveal → plaintext
   matches; one view-log row per reveal (read-only query).
5. Rate override and staff flag; code change → old code still credits (plan 1 S4 already proved
   the lookup) and the history row carries your name.
6. Money: manual line ₱(≥ minimum) on the partner → open on behalf → received email → start →
   reveal on the processing screen → complete with a reference → receipt email (override inbox) →
   balance shows withdrawn. Second withdrawal: reject before processing. Third: start, then reject
   as transfer-failed (the checkbox is required).
7. If D18 = (a): complete a booking at a referred staging vendor → an earned line appears (not yet
   available for 7 days); dispute it → held.
8. Staff: manual line → payroll payment recorded, no email.
9. Attribution: credit a vendor signed up < 30 days ago with no referrer; move it to the other test
   affiliate; both logged.
10. Deletion guards: Remove affiliate and Delete user both refused for the partner (has lines). Closure (D19): only if a staging vendor-admin test account is also an affiliate with a balance, its closure request shows the affiliate blocker; else covered locally and noted.
11. Import: dry run of a three-row file (new, existing, refused), apply, re-run (all skipped), send
    one invitation.
12. Notifications settings page shows the affiliate rows correctly.
Plan 3 checks, not here: the affiliate-raised request and its `affiliate_withdrawal_requested`
notification to admins; the invite click-through into the affiliate app.
Staging test data from S4 is listed in the stage report for the user to clean up.

**Live, production (P5) — read-only:** Platform Fee tab loads with the affiliate card **unset**;
the Affiliates section loads (empty or the real affiliates); a Users-page grant of the Affiliate
chip to a real affiliate only if plan 3's production app is live. Nothing is switched on (D16).

**Cannot be verified in this plan:** the affiliate's own screens, their request flow and the
admins' request notification (plan 3); a real commission line in production before go-live (D16).

## Docs
**Docs:** to update when the plan closes — `architecture/portals.md` (Command → Affiliates section;
Users-page affiliate bullets: the stale-warning note at `:1100` resolved, the portal chip and
invite), `architecture/auth-and-roles.md` (the priority line at `:189` gains affiliate; the
affiliate section: Command grants the portal), `architecture/schema.md` (M1 row and the
`details_enc` format), `architecture/production-env-checklist.md` (`PORTAL_URL_AFFILIATE`),
`command/README.md` (env table, `PORTAL_URL_*` section, Pages), plan 1's function table note
(F4 here).
