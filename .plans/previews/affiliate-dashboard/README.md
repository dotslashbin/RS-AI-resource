# affiliate-dashboard — visual preview

**Date:** 2026-11-04, revised 2026-11-13 · **Plan:** [`2026-11-02-affiliate-dashboard-discovery.md`](../../2026-11-02-affiliate-dashboard-discovery.md) (decisions Q1–Q50) · **Status:** revised after discovery rounds 4–7, **awaiting the user's review of the revision** — **not an implementation.**

Open [index.html](index.html) directly in a browser (no server). The **PREVIEW** bar picks a
screen and a theme; e.g. `index.html?screen=lines&theme=dark`. Narrow the window below 860px
for the tab-bar layout and below 640px for the phone layout (tables become cards).

> ⚠️ **Read this first: two numbers are samples.** Commission is 1% of Ezzy's fee *after tax*
> (Q34, Q35), and a withdrawal needs a *minimum* balance (Q45). Both the tax rate and the
> minimum are Command settings that **start unset**; this preview draws with **12% tax** and a
> **₱5.00 minimum** only so there is something to show. The 11% fee and the 1% rate are the
> real decided values. See F13 before reading anything into the amounts.

> **Approval history.** The user approved the first design on 2026-11-08 and the Settings
> screens on 2026-11-11. Changed since, and **not yet reviewed**: the rate (sample 20% → 1% of
> the after-tax fee), line references and the after-tax column (rounds 4–6), and on 2026-11-13
> the replacement of monthly payouts by **withdrawals** (round 7): the Withdraw screens, the
> overview's balance card and KPIs, and the Withdrawal column and statuses on Commission.

## What it shows

"Today" in the fixtures is Wed 4 Nov 2026. Worked example: a ₱1,600.00 booking → Ezzy's fee
₱176.00 (11%) → ₱154.88 after the sample 12% tax → the affiliate earns ₱1.55 (1%).

| Screen | What to look at |
|---|---|
| Dashboard overview | Four KPIs: **Available to withdraw**, **Earned · not yet available**, **Upcoming ≈ estimate** (Q4e), **Held** (Q4b). The balance card shows progress to the minimum and links to Withdraw. "How you earn" states the rule with a worked example. |
| Vendors list | Q12's columns: name, status, signed up, activated, plus **earned to date** (Q25), summed from the affiliate's own lines. No contact details. Code card with **Change code**. |
| Commission lines · all dates | Per line: booking date, vendor with the line's own **reference** (Q24), booking, Ezzy's fee, **after tax**, your share, **Withdrawal** (when it becomes available, or the withdrawal it was paid in), status. All eight statuses appear, with a legend. "Earned · not yet available" is an outlined green badge; "Available" is the filled one. The date filter and status chips **work**. |
| Commission · last month | "Last month" pressed (1–31 Oct): 7 lines. |
| Commission · no matches | "This month" + "Withdrawn": the empty state names both filters and offers "Clear filters". |
| Withdraw · below the minimum | 4 Nov: ₱1.16 available against the ₱5.00 minimum. The meter, how much more is needed, the **disabled Withdraw button with its reason written beside it**, the lines still inside their 7-day wait with their dates, and the receipt of the last completed withdrawal (W-1007). |
| Withdraw · ready | One week later: ₱5.85 available. States plainly that the **whole balance** is withdrawn (Q43), to which masked destination, then **Withdraw ₱5.85**. Pressing it goes to the next state. |
| Withdraw · requested | The open request W-1012: its three steps (Requested → Processing → Completed, Q44), the lines it covers, the 5-business-day promise, and **Cancel request**, which works. |
| Withdraw · processing | Ezzy has started: step two is current and **Cancel is gone**. |
| Withdraw · no payout details | Minimum reached but no destination on file (Q46): a warning, Withdraw disabled with the reason, and how to set the destination. |
| Settings · change code | The current code and share link, a "Change your code" form with **live checks** (try `nina2026`, `my admin`, `abc`, `rina01`), the reassurance that old links keep working, and the code history (Q16). |
| Settings · reserved word | `ezzy-rina` refused because it contains EZZY; Save disabled with a reason. ✖ **Dropped 2026-11-15** (discovery P7: no blocked or reserved words; any well-formed code is accepted). Not to be built in plan 3. |
| Settings · saved | After saving RINADP: confirmation, next change from 4 Dec 2026, old codes marked **Still works**. |

**No booker data anywhere** (Q12). **No sign-up** in the shell (Q10, invite only).
**Not drawn:** a **rejected** request (its reason, and the money back in the balance, Q44); a
staff affiliate, who sees a balance but no Withdraw button (Q48); the state before Command has
set a minimum (withdrawals off, Q45); and anything in Command — the withdrawals queue, Start
processing / Complete / Reject, payout-details entry, the Affiliates section, and the Settings
for the minimum and the tax rate (Q37, Q45). **Those are drawn in the companion preview,
[`affiliate-command`](../affiliate-command/README.md)** (2026-11-14).

## Design fit

- Tokens are command's `--rs-*` set via `_shared/command.css`. `affiliate/app/globals.css` copied
  that block verbatim (setup plan I3, checked by diff 2026-11-04), so the runner's `affiliate`
  entry syncs command's sheet rather than keeping a second copy.
- Shell copied in shape from command: sidebar from `command/components/layout/Sidebar/` (220px,
  pale logo tile, blue gradient active item, "Account" group label, user footer); tab bar from
  `TabBar/` below 860px; KPI numbers from `command/components/overview/KpiCard/`.
- KPI cards carry 3px coloured rules on the top and bottom edges (the two-edge treatment of
  vendor's active tab, `vendor/components/layout/TabBar/TabBar.tsx:41`), coloured from vendor's
  `StatCard` palette. The colour only decorates; each card's label carries its meaning.
- The date filter copies vendor's `components/ui/DateRangeFilter/DateRangeFilter.tsx`. Presets
  are the user's choice (2026-11-04), whole calendar months: This month · Last month · Last 3
  months (this month and the two before it).
- The money rule is computed in `screens.js` from each booking amount (fee → after tax → share),
  so no figure can disagree with another; totals are sums of the lines they name.
- Withdraw copies two existing patterns: the masked destination is the vendor payout shape
  (`{ label, masked }`, as `vendor_payout_methods.display`), and the request lifecycle is the
  vendor account-closure one (`account_deletion_requests`: pending / cancelled / completed /
  rejected, one open request at a time, a Command queue). Command hears of a request through
  the existing `notifications` fan-out (one row per admin, which also sends an email).
- The balance meter is a native `<progress>`, so its fill needs no inline style.
- Settings follows Q16a–d and Q22: old codes keep crediting and stay reserved; one self-service
  change per 30 days; reserved words refused; switching back to your own old code is allowed.
  Code format is today's (`^[A-Z0-9]{4,32}$`); the share link is Command's `buildReferralUrl`.
- Status badges carry their meaning in words as well as colour. Every tappable control is ≥44px
  (ux-design §5), asserted by the runner.
- **Additional packages required: none.**

## Limits

Static fixtures only: nothing is saved, no Supabase, no app imports, no network. The
`shoot.mjs` run asserts zero non-`file://` requests and fails if one is attempted.

- Fonts are a fallback; command and affiliate use Inter. The logo tile shows a letter "E".
- The Commission filters and the Settings code checks work; "Copy code" / "Copy link" are drawn,
  not wired. Applying a filter re-renders the list and drops keyboard focus, which the real
  build must not do. The taken and reserved code lists are a handful of invented examples.
- Date fields show the browser's locale format (mm/dd/yyyy in an en-US browser).
- No loading or error states; the only empty state is "no matches" on Commission.
- Four Withdraw states are set **one week later** (11 Nov) so the balance is over the minimum;
  each says so in a dashed preview note. The other screens stay on 4 Nov.
- Screen-reader structure is sketched (real `<table>`s, `aria-current`, labelled month strip),
  but focus movement and live announcements are **not** simulated.
- Fixture values are invented and internally consistent. They are not seeded data.

## Findings

Decided items are kept for the record; open ones are for the real build or design review.

- **F1 · A line needs a reference.** ✅ Decided Q24 (2026-11-11): each line has its own
  reference, e.g. `C-10482`. Drawn under the vendor name.
- **F2 / F9 · Which date a line carries and filters by.** ✅ Decided Q23 (2026-11-11), adapted
  by Q42 (2026-11-13): booking date stays; a **Withdrawal** column shows when a line becomes
  available, or the withdrawal it was paid in. Drawn.
- **F3 · "Earned to date" per vendor.** ✅ Decided Q25 (2026-11-11): keep.
- **F4 · The referral code and its link.** ✅ Settled by Q16 and the Settings screens.
- **F5 · "Soon" tag on Payouts.** Gone: the section is now Withdraw, a real screen.
- **F15 · A negative balance.** An adjustment larger than the available balance leaves it
  below zero (Q4-neg: carried forward). The meter clamps at empty; the wording for "you owe
  nothing, but your next commission covers ₱X first" is not drawn. *Real build.*
- **F6 · "Upcoming" is a money figure that is not money yet.** Labelled "estimate" with `≈`.
  Worth checking with a real affiliate that it is not read as owed. *Design review.*
- **F7 · Vendor's preset pills are under the 44px touch floor** (`py-1.5`, ~28px). The preview
  uses 44px; the real build should, and vendor's own filter has the same gap. *Real build.*
- **F8 · Presets.** ✅ Decided 2026-11-04: This month · Last month · Last 3 months.
- **F10 · Settings is not a fifth tab on phones**: a gear in the top bar below 860px.
  *Design review.*
- **F11 / F12 · Imported-code clock; switching back to an old code.** ✅ Decided Q22
  (2026-11-11): an imported code does not start the clock; switching back is allowed.
- **F13 · The amounts are very small, and that now decides how the minimum behaves.** At 1%
  of the after-tax fee a ₱1,600 booking earns ₱1.55; this fixture's twelve bookings earn about
  ₱12 in all. The sample ₱5.00 minimum exists only so the flow can be drawn. A minimum of
  ₱500 would take roughly ₱517,000 of bookings (some 320 bookings at ₱1,600) to reach. So the
  minimum the user sets in Command, together with the rate, decides whether affiliates ever
  see a Withdraw button. The design holds at any values. *User decision, before launch.*
- **F14 · Three money columns per line** (fee, after tax, share) make the desktop table dense;
  the reference moved under the vendor name to make room. On phones each line is a tall card.
  *Design review.*

## Regenerating

```bash
node .plans/previews/_shared/shoot.mjs affiliate-dashboard          # nine checks, no screenshots
node .plans/previews/_shared/shoot.mjs affiliate-dashboard --shoot  # + contact sheets
```

Last run 2026-11-13: 13 screens × 2 viewports × 2 themes = 52 cells, 9 checks, 0 failures.
Click-tested in headless Chromium the same day, with no console errors:
- Withdraw: the overview's button opens Withdraw; below the minimum the button is disabled;
  "Withdraw ₱5.85" leads to the requested state; "Cancel request" returns to ready; the
  processing state has no cancel.
- Commission: each status chip gave the expected count (2 upcoming, 3 earned, 1 available,
  1 held, 3 withdrawn, 1 adjustment; the twelfth line is the cancelled one).
- Totals: per-vendor earned (₱4.26 + ₱1.64 + ₱2.32 + ₱3.39 = ₱11.61) equals withdrawn (₱5.76)
  plus available and earned (₱5.85).
The Settings checks were click-tested on 2026-11-10 and have not changed since.
Still needs a real build: focus movement, live announcements, Inter, the real logo, and device
safe areas.

## Screenshots

Contact sheets, one per viewport × theme: [desktop-light](contact-desktop-light.png) ·
[desktop-dark](contact-desktop-dark.png) · [mobile-light](contact-mobile-light.png) ·
[mobile-dark](contact-mobile-dark.png). Full-size images are not committed (`flagged/` is
gitignored); add `--full <screen>` to write one.
