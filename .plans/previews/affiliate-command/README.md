# affiliate-command — visual preview

**Date:** 2026-11-14 · **Plan:** [`2026-11-02-affiliate-dashboard-discovery.md`](../../2026-11-02-affiliate-dashboard-discovery.md) (decisions Q7, Q16–Q19, Q26, Q32, Q35, Q37, Q44–Q49) · **Status:** first draft, **awaiting the user's review** — **not an implementation.**

The Command half of the affiliate feature. Its companion is
[`affiliate-dashboard`](../affiliate-dashboard/README.md), the affiliate's own screens; the two
share one fixture story (Rina Dela Paz, withdrawals W-1007 and W-1012, BDO ••7890).

Open [index.html](index.html) directly in a browser (no server). The **PREVIEW** bar picks a
screen and a theme; e.g. `index.html?screen=withdrawal&theme=dark`. Narrow the window below
860px for the tab-bar layout and below 640px for the phone layout (tables become cards).

> ⚠️ **Read this first: two numbers are samples, and only two sections are real.**
> The **12% tax** and the **₱5.00 minimum** are Command settings that start unset; they are
> drawn here only so the screens have figures. And in the sidebar only **Affiliates** and
> **Settings** open: the other items are greyed labels, because those pages exist already and
> are not part of this work.

## What it shows

"Today" in the fixtures is Wed 11 Nov 2026.

| Screen | What to look at |
|---|---|
| Affiliates · list | The new section (Q37): everyone with a code, their type, rate (with "override" when not the default), referred vendors, available balance, and **one "needs attention" badge each**. Two sub-tabs: Affiliates, Withdrawals (with the count of open requests, also on the sidebar item). The top bar shows the notification a request raises (Q49). |
| Affiliate · detail | Rina: balance broken down (in an open withdrawal, available, not yet available, held, withdrawn to date), referred vendors with the code each signed up with, masked payout details, and code history. Is this the right amount on one page? |
| Affiliate · replace payout details | Staff type the details (Q17, Q32). Save stays disabled until the account number is in **and "I confirmed this is Rina by phone" is ticked**. |
| Affiliate · change a vendor's referrer | Q18: pick the new affiliate, a required reason, and the **"from now on only"** note: commission already earned stays with the old affiliate. |
| Affiliate · credit a vendor | Q19: only vendors with no referrer; one past the 30-day window is listed but cannot be picked. Reason required; credit runs from today. |
| Staff affiliate · detail | Q48: Nina is staff, so no withdrawals: a note explains it, and payroll payments are listed as her history. |
| Staff affiliate · record payroll | Records the whole available balance as paid through payroll. No transfer, no email. |
| Withdrawals · queue | Q44: requests oldest first, with amount, masked destination and status. Requested, Processing, Completed and Rejected each appear once; the rejected one shows its reason. |
| Withdrawal · requested | The lines, four eligibility checks, and two actions: **Start processing** (locks it and re-checks the lines) and **Reject**. The full account details are *not* shown yet. |
| Withdrawal · reject | A reason is required and is written for the affiliate, who is emailed it; the money returns to their balance. |
| Withdrawal · processing, complete | The **only screen with the full account number**, with a note that viewing it was recorded. "Mark as completed" needs the transfer reference; completing emails the affiliate a receipt and cannot be undone. |
| Settings · not set yet | Q34, Q45: the new "Affiliate commission" card with the tax rate and the minimum **empty**, and a warning that commission is off and withdrawals are off. |
| Settings · set | The three values (tax, default rate, minimum) and a worked example, including how much in bookings it takes to reach the minimum. |

## Design fit

- Tokens are command's own, via `_shared/command.css`.
- Shell: `command/components/layout/Sidebar/` (Reporting / Management / System groups, "Back
  Office" under the name, user footer). **Affiliates** joins Management after Closures; like
  Flags and Closures it is a queue staff must look at (`command/lib/navigation.ts:15-24`).
- Patterns copied from Command as it is today:
  - the withdrawals queue and its Reject-with-reason from the closure queue
    (`components/closures/ClosureQueue/`);
  - "Show full details" recording the access, from
    `components/payouts/PayoutDetailModal/` (payout details are decrypted on request only);
  - the settings card sits on the Platform Fee tab under the existing fee and withholding
    cards (`components/settings/PlatformFeeSettingsPage/`).
- The `.af-*` rules in `preview.css` are a copy of the affiliate preview's, so both sides draw
  tables, badges and cards identically; the `.cm-*` rules are this preview's own.
- Every disabled primary button has its reason written beside it, not only in a tooltip.
- Every tappable control is ≥44px (ux-design §5), asserted by the runner. A checkbox is a 44px
  row whose input covers the whole row.
- **Additional packages required: none.** Command already has Radix dialogs and popovers.

## Limits

Static fixtures only: nothing is saved, no Supabase, no app imports, no network. The
`shoot.mjs` run asserts zero non-`file://` requests and fails if one is attempted.

- Navigation between screens and every Cancel / Close work. **Forms do not**: typing in a field
  does not enable its Save button, and filter chips, search, "Set rate override" and "Change
  code" are drawn only.
- The full account number on the processing screen is an invented one.
- Modals are fixed overlays: a full-page screenshot dims only the first viewport.
- Fonts are a fallback (command uses Inter); the logo tile is a letter.
- Focus trapping in modals, focus return and live announcements are not simulated.
- No loading, empty or error states (an empty queue, a failed save, a withdrawal whose amount
  changed at "Start processing").

## Findings

- **F1 · Three command-themed previews now repeat the same shell** (`dark-lift-command`,
  `affiliate-dashboard`, this one), and this one copies a stylesheet. That is the repetition
  `_shared/command.css` was waiting for before a `_shared/command.js` was written. Extracting
  it changes synced files in the other previews, so it is its own small job. *Preview tooling.*
- **F2 · What "Start processing" does when a line dropped out is not drawn.** Q44 says the
  amount is re-checked. If a line was refunded since the request, staff need to see the old
  and new amounts before sending, and if the new amount is under the minimum the request
  probably should bounce back. ✅ **Decided in plan 1 D5 (2026-11-15):** Start processing refuses an amount now below the minimum (and ₱0); staff reject it and the lines return to the balance.
- **F3 · A withdrawal for a suspended affiliate has no entry point.** They cannot sign in to
  request one, yet what they earned is owed (Q9, Q50b). Command needs an "open a withdrawal on
  their behalf" action; it is not drawn. ✅ **Decided in plan 1 D7 (2026-11-15):** Command may open one for any non-staff affiliate, active or suspended, once the balance reaches the minimum; the minimum is waived only for an account-closure final payout, with a reason. Still to draw in plan 2.
- **F4 · Rejecting while processing.** The processing screen offers "Reject instead" for a
  transfer that failed. Q44 only says staff may reject; whether that is allowed after
  processing started, or needs a separate "transfer failed" outcome, is open. ✅ **Decided in plan 1 D6 (2026-11-15):** after processing, reject only as "transfer failed", with staff confirming no money left Ezzy (recorded as `transfer_failed`).
- **F5 · The notification is drawn as a pill in the top bar**, standing in for Command's
  notification panel, which this preview does not reproduce. *Preview-only.*
- **F6 · Rate override and code change have buttons but no dialogs here.** The code change is
  Command's existing modal with its warning removed (Q16d); the rate override is one number
  field. *Real build.*
- **F7 · The amounts are tiny** (see the affiliate preview's F13): a queue of ₱5.85 and ₱8.20
  transfers, each costing Ezzy a transfer fee. The Settings example states how much in
  bookings reaches the minimum, so whoever sets it sees the consequence. *User decision.*

## Regenerating

```bash
node .plans/previews/_shared/shoot.mjs affiliate-command          # nine checks, no screenshots
node .plans/previews/_shared/shoot.mjs affiliate-command --shoot  # + contact sheets
```

Last run 2026-11-14: 13 screens × 2 viewports × 2 themes = 52 cells, 9 checks, 0 failures.
Click-tested in headless Chromium the same day, no console errors: list → detail → each of the
three dialogs and back; detail → withdrawal → reject and back → start processing → queue;
staff detail → payroll dialog; Settings from the sidebar. At 390px the queue's Open button
measures 73×44.
Still needs a real build: working forms and validation, focus handling in dialogs, Inter, and
the real notification panel.

## Screenshots

Contact sheets, one per viewport × theme: [desktop-light](contact-desktop-light.png) ·
[desktop-dark](contact-desktop-dark.png) · [mobile-light](contact-mobile-light.png) ·
[mobile-dark](contact-mobile-dark.png). Full-size images are not committed (`flagged/` is
gitignored); add `--full <screen>` to write one.
