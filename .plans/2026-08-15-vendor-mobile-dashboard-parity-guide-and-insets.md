# Ezzy Vendor Mobile — dashboard parity, guide in the header, Android inset overlap

**Date:** 2026-08-15
**App / scope:** `ezzy-vendor-mobile/` only. No web app change, no `backbone` change, no migration.
**Status:** IN PROGRESS — all 7 decisions resolved; **every code stage (1–5)
complete 2026-08-15, MACHINE-VERIFIED ONLY**. Stage 0's device pass was parked at
the user's request and its checks now sit on top of five stages of unseen work.
**Nothing in this plan has been run on a device.** The remaining scope is entirely
verification.

> Three unrelated-looking requests that share one theme: the mobile app has drifted
> from the vendor portal in *structure* (dashboard grouping), in *discoverability*
> (the guide), and from the platform in *layout* (Android edge-to-edge). Optimise
> for **mobile idioms that preserve web's information hierarchy** — not for a
> desktop transliteration.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, C# = Cosmetic/deferred,
> D# = Decision, F# = Finding. Numbers are plan-local — qualify cross-plan refs by
> app and date (e.g. "mobile 2026-08-14 D4").

---

## Scope guard — this work is confined to `ezzy-vendor-mobile/`

Verified 2026-08-15 by reading every file named below.

- **The web vendor app is a REFERENCE ONLY.** Nothing in `vendor/` is modified. Its
  dashboard is read to establish the target structure, its `lib/financials.ts` to
  establish the money basis, and its `TopBar` to establish the guide affordance.
- **No `backbone` change.** Every figure this plan adds is already selected by an
  existing query — see F7. No migration, no RLS change, no new grant.
- **`lib/bookingFilters.ts` stays untouched**, so the "edit web and mobile in the
  same change" rule attached to that file is never triggered.
- ⚠️ **One deliberate divergence is proposed, not assumed** — mobile has no
  Calendar and no `schedules` data, so web's "Today's Schedule" card cannot be
  ported as-is (F4, → D3).

---

## Read this first (written for a cold session)

**The baseline shipped on 2026-08-15 as commit `d52dea2` ("Widgets drill down and
style corrections").** That commit is
`.plans/2026-08-14-mobile-vendor-dashboard-range-and-drilldown.md` stages 0–6 plus
the guide-copy fix and the splash-mask fix. The working tree is clean.

Two things about that baseline shape this plan:

1. **It is still UNVERIFIED ON DEVICE.** Every stage from 3 onward was
   machine-verified only. This plan rewrites the same dashboard files. If the
   period control or the drill-down turns out to be broken on device, the fix lands
   in code this plan is also editing. **→ Stage 0 below is a device pass on what
   already shipped, before anything new is built on it.**
2. **This request takes up a deferred option.** That plan's **D4** asked *"how much
   of the web dashboard comes across?"*, chose "(a) filter + drill-down only", and
   deferred "(b) also port the Operations/Earnings grouping and the 4-way money
   split" as *"much larger… would change what the app's main screen is."* Task 1
   here **is option (b)**.

   ⚠️ **"Reversal" overstates it, and the first draft of this plan said so — the
   framing is corrected here.** D4 was a SCOPE decision, not a design constraint,
   and nothing chosen under (a) is undone. Everything shipped in `d52dea2` — the
   period chips, the drill-down, the three Operations cards, the offline
   persistence — survives untouched. The work is **additive**, with exactly one
   substitution: the single `Revenue` card becomes four Earnings cards, one of
   which (`Payout Released`) is the same number under a new name (F3). Recorded as
   D4 being taken up rather than overturned (→ D1).

---

## §1 — Dashboard current-state comparison

### 1a. Vendor web reference — what actually exists

Read from `vendor/components/dashboard/DashboardPage/DashboardPage.tsx`.

| Order | Element | Detail | File |
|---|---|---|---|
| 1 | `DateRangeFilter` | One period control for the whole page. No "clear" — resetting means picking "This month", the default. | `DashboardPage.tsx:47` |
| 2 | **Section: "Operations"** | Heading + caption `"Bookings serviced <range>"`. Caption names the CLOCK. | `:49`, `useDashboardPage.ts:43-46` |
| 2a | Pending Approvals | sub `"Live queue"`, `urgent` stripe when > 0. **Ignores the period.** → Bookings/`needs_you`, **no range passed**. | `:62-67` |
| 2b | Today's Schedule | sub = today's date. **Ignores the period.** → Calendar, **no range**. Counts SCHEDULES, not bookings. | `:75-79`, `useDashboardPage.ts:58-61` |
| 2c | Completed | sub = `rangeLabel(range)`. **The one Operations card the period drives.** → Bookings/`done` **with range**. | `:84-88` |
| 3 | **Section: "Earnings"** | Heading + caption naming the other clock: `"Payments received <range>"`, plus the basis and any exclusions. | `:92`, `useFinancialSummary.ts:118-131` |
| 3a | Gross Income | `"All payments, incl. held · <period>"`, delta vs previous period. | `FinancialSummary.tsx:62` |
| 3b | Platform Fee | `"Commission deducted · <period>"`. **No delta, deliberately** — it only restates Gross. | `:75` |
| 3c | Net Income | `"After platform fee · <period>"`, delta. | `:85` |
| 3d | Payout Released | `"<₱X> still on hold"` when held > 0, else `"Released & releasable"`, delta. | `:99` |
| 4 | `PendingApprovalsCard` | A list of pending bookings with inline approve/reject + "view all". | `:107` |
| 5 | `BookingTrendsCard` | Category breakdown + weekly volume charts. | `:108` |

**Grouping mechanism:** `DashboardSection` — a small uppercase `<h2>` + optional
caption, separation by spacing alone, *"no extra card chrome or dividers, which
would add clutter without adding meaning"* (`DashboardSection.tsx:13-24`).

**Why the captions are load-bearing, not decoration.** One control drives two
groups that count on **two different clocks**: Operations filters
`booking.bookedDate` (the day a session is booked FOR), Earnings filters
`booking_transactions.created_at` (the day money was PAID). The same dates select
different rows. `useDashboardPage.ts:14-24` states that the equivalence is *"denied
in words rather than by having two controls"* — **so porting the groups without
porting the captions reintroduces a defect web deliberately closed.**

**The money basis** (`vendor/lib/financials.ts:9-27`): everything except `payout` is
computed over transactions whose payout is **not reversed**; two identities hold
exactly and are unit-tested — `gross = platformFee + net` and `net = payout +
onHold`. The file carries an explicit warning that this **differs from the
Transactions page**, which uses payable-only rows, and that *"any surface rendering
these totals MUST state its basis, or the two screens look like they disagree."*

### 1b. `ezzy-vendor-mobile` — what exists today

Read from `src/components/dashboard/DashboardView/DashboardView.tsx` (post-`d52dea2`).

| Order | Element | Notes |
|---|---|---|
| 1 | `<ScreenTitle />` | Scrolls with content. |
| 2 | `<PeriodFilter />` | 5 presets, shared with Bookings and Transactions. |
| 3 | `<StaleBanner />` | |
| 4 | **Flat 2×2 grid, no headings** | Pending Approvals · Today's Bookings · Completed · Revenue |
| 5 | Truncation warning | Shown when the revenue figure is partial. |
| 6 | `<GuideCard />` | Inline card with its own Hide/Show. |
| 7 | "Waiting for approval" + preview list | Mobile's equivalent of `PendingApprovalsCard`. |

### 1c. Delta — every difference, verified

| # | Difference | Evidence |
|---|---|---|
| F1 | **No section headings and no captions.** Mobile has one flat grid; web has two named groups. The captions that keep two clocks honest do not exist here at all. | `DashboardView.tsx:66-109` vs `DashboardPage.tsx:49,92` |
| F2 | **Mobile has ONE money card ("Revenue"); web has FOUR.** No Gross/Fee/Net/Payout decomposition, so "earned" and "released" cannot be told apart. | `DashboardView.tsx:95` vs `FinancialSummary.tsx:53-113` |
| F3 | **The bases differ — but NOT for the figure the vendor already sees.** ⚠️ **Corrected 2026-08-15 after the first draft of this plan overstated it.** Read line by line: mobile's `Revenue` is `sumTransactionTotals(...).payout` = sum of `payout_amount` over **payable** rows (`transactionTotals.ts:43-50`); web's `Payout Released` is `payoutC += payout_amount if isPayable(...)` (`financials.ts:104`). **Same rows, same column, same number.** So the existing card survives the port as "Payout Released" and its VALUE DOES NOT CHANGE. The non-reversed basis applies only to the three cards being **added** (Gross, Platform Fee, Net), which are wider on purpose — separating "earned" from "released" is what one card cannot express. The real consequence is narrower than first written: **Gross will exceed Transactions' "Collected" for the same period whenever anything is held**, so the Earnings caption must state its basis. | `transactionTotals.ts:30-54` vs `vendor/lib/financials.ts:87-118` |
| F4 | **"Today's Schedule" cannot be ported.** It counts `schedules` via `getSchedsForDay` and opens the Calendar. Mobile has **no schedules data and no calendar screen** (`AGENTS.md` tech-stack table: "Maps: none"; route list has no calendar). Mobile's "Today's Bookings" is the honest local equivalent. | `useDashboardPage.ts:58-61`; `src/app/(app)/` route list |
| F5 | **`BookingTrendsCard` has no mobile counterpart** and no charting library is installed (`package.json` — no victory, no d3, no chart-kit). Porting it is a dependency approval gate. | `DashboardPage.tsx:108`; `package.json` |
| F6 | **Deltas (vs previous period) do not exist on mobile.** Web computes them from a SECOND fetch of the prior period (`useFinancialSummary.ts:73-76`), plus `percentChange`, `previousPeriod` and `vsLabelFor` — none of which mobile has. | `vendor/lib/financials.ts:128`, `vendor/lib/dashboardRange.ts:105` |
| F7 | ✅ **The data is ALREADY THERE — no service round-trip is added for the four figures.** `getRevenueForWindow` already selects `amount_paid, platform_fee_amount, payout_amount, payout_status` over the window, bounded by `TOTALS_MAX_ROWS` with an honest `complete` flag. Only the *reduction* is missing. This is the single biggest reason the port is cheaper than the 2026-08-14 D4 estimate assumed. | `src/services/dashboard.service.ts` |
| F8 | **Mobile's pending preview ≈ web's `PendingApprovalsCard`, minus inline approve/reject.** Mobile navigates to the detail screen to act. Not a gap worth closing — the detail screen is where the action bar and its confirmation live. | `DashboardView.tsx:118-143` |

### 1d. Recommended target structure for mobile

```
Dashboard
  <ScreenTitle />
  [ period chips ]                       ← unchanged
  [ stale banner ]                       ← unchanged

  OPERATIONS                             ← new heading
  Bookings serviced 1–31 Aug             ← new caption (the clock)
  ┌────────────┬────────────┐
  │ Pending    │ Today's    │            2-up, unchanged cards
  │ Approvals  │ Bookings   │            both ignore the period
  ├────────────┴────────────┤
  │ Completed               │            full width OR 2-up with a spacer
  └─────────────────────────┘            follows the period

  EARNINGS                               ← new heading
  Payments received 1–31 Aug ·           ← new caption (the other clock
  excludes reversed payouts                + the basis)
  ┌────────────┬────────────┐
  │ Gross      │ Platform   │            2-up × 2 rows
  │ Income     │ Fee        │            all four follow the period
  ├────────────┼────────────┤            all four → Transactions
  │ Net Income │ Payout     │
  │            │ Released   │
  └────────────┴────────────┘
  [ partial-figures warning if any ]

  [ getting-started guide ]              ← relocated trigger (§3)
  Waiting for approval + preview         ← unchanged
```

**Layout rationale, against the user's list:**
- **2-up, not 1-up.** `StatCard` already locks a 2×2 grid from 320dp
  (`flexBasis: "47%"`, `.plans/2026-07-29-…:289-294`), and its value type is
  `type.stat.size` — a peso figure at `fmtPeso(n, 0)` fits. Going 1-up would push
  seven cards to seven screenfuls.
- **No horizontal scrolling.** Web's `sm:grid-cols-3` / `sm:grid-cols-4` are desktop
  breakpoints and are explicitly not ported.
- **Card heights** already even out per row via `flexGrow: 1` + a two-line label cap.
  ⚠️ Earnings sub-labels are longer than Operations' — a device check, not a
  machine one (→ Verification).
- **Consistent spacing** comes from the existing `grid` gap; sections get
  `spacing.lg` between them, matching `content.gap`.

---

## BLOCKERS

### B1 — Bottom-anchored sheets have no safe-area inset  🔄 CODE COMPLETE (2026-08-15) — device check outstanding
**Files:** `src/components/bookings/RejectReasonSheet/RejectReasonSheet.styles.ts:7-20`;
`src/components/bookings/ActionInfoSheet/ActionInfoSheet.styles.ts:9-29`

**This is the reported Android overlap.** Both sheets render inside a
`Modal`, with `backdrop: { flex: 1, justifyContent: "flex-end" }` and a `sheet`
carrying `padding: spacing.xl` and nothing else. There is **no `insets.bottom`
anywhere in either file** (confirmed by grep across `src/`: the only inset readers
are `useBookingDetail`, `useRefreshableList`, `useDashboardView` and `Snackbar`).

So the sheet's own bottom padding is 24pt of *design* spacing sitting directly on
the physical screen edge — and on Android that edge is **behind the gesture bar or
the three-button navigation bar** (see §4). The affected controls are exactly the
ones the user described: **Reject/Cancel** and **Confirm** in `RejectReasonSheet`,
and **"Got it"** in `ActionInfoSheet`.

**Fix approach:** add the bottom inset to the sheet container —
`paddingBottom: spacing.xl + insets.bottom` — applied inline from each sheet's
companion hook (the value is dynamic, which is the one case the render layer may
carry an inline style). ⚠️ **Whether `useSafeAreaInsets()` reports correctly inside
an Android `Modal` must be established on device before this is called fixed** —
RN renders a Modal in its own window, and the provider's context values come from
the host window. → **D6** picks the mechanism.

**Verification:** device, both navigation modes. Machine checks cannot see this.

**🔄 CODE COMPLETE (2026-08-15).** Both sheets take `useBottomInset({ tabBar: false })`
and apply it as an inline `paddingBottom` on the sheet container.
`RejectReasonSheet` reads it in its existing hook; `ActionInfoSheet` had no hook
file, so `useActionInfoSheet.ts` was added rather than putting `useSafeAreaInsets`
in the render layer.

⚠️ **On `ActionInfoSheet` the padding goes on `sheet`, NOT on `sheetWrap`.** That
wrap carries `maxHeight: "70%"`, and its stylesheet records that the bound has to
live there or the inner ScrollView never scrolls. Padding the wrap would let the
sheet exceed 70% of the screen by the height of the inset; padding the sheet keeps
the measured box the same.

⚠️ **D6's Modal caveat is NOT closed by this.** Whether `useSafeAreaInsets()`
reports the right value inside an Android `Modal` — which renders in its own window
— is exactly what a device has to settle. If it reports 0, the fallback is
`<SafeAreaView edges={["bottom"]}>` inside the Modal, and the hook stays as the
source of the number either way.

---

### B2 — `SettingsList` never clears the tab bar  🔄 CODE COMPLETE (2026-08-15) — device check outstanding
**File:** `src/components/settings/SettingsList/SettingsList.styles.ts:7-10`

`content: { padding: spacing.xl, gap: spacing.xl }` — a plain `ScrollView` content
container with no tab-bar clearance and no bottom inset, where every other scroll
surface in the app composes `TAB_BAR_HEIGHT + insets.bottom + spacing.xl`
(`useRefreshableList.ts:24`, `useDashboardView.ts:127`).

⚠️ **Settings IS inside the tab navigator** — `<Tabs.Screen name="settings"
options={{ href: null }} />` (`(app)/_layout.tsx:103`) only hides it *from the bar*;
the bar still renders over the screen, and `tabBarStyle: { position: "absolute" }`
(`:59`) means it occupies no layout space. So the last rows of Settings — which
include the sign-out row — sit under the floating bar plus the system nav.

**Fix approach:** the same composition every other scroll surface uses. This is
where a shared helper starts to pay for itself (→ D7).

**Verification:** device — scroll Settings to the end on three-button navigation
and confirm the final row is fully tappable.

**🔄 CODE COMPLETE (2026-08-15).** `useSettingsList` returns
`useBottomInset({ tabBar: true })`; `SettingsList.tsx` applies it as an inline
`paddingBottom` on the ScrollView's `contentContainerStyle`, overriding the
shorthand `padding` beneath it. The stylesheet now says so, so the static value is
not "restored" later.

---

### B3 — The Android keyboard branch in `RejectReasonSheet` is the documented no-op  🔄 CODE COMPLETE (2026-08-15) — device check outstanding
**File:** `src/components/bookings/RejectReasonSheet/RejectReasonSheet.tsx:66-68`

```tsx
<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
```

`behavior={undefined}` on Android is **the exact defect this repo already paid for
once** — the nested `AGENTS.md` records it under Traps: *"`KeyboardAvoidingView`
with `behavior={undefined}` does NOTHING … the keyboard drew straight over the
password field,"* fixed in `AuthScreen` by giving Android `behavior="height"`.
This sheet still carries the broken form, and it is the one sheet with a
`TextInput` — the reject/flag reason.

**Mitigating fact, stated so this is not over-claimed:** `app.json` sets
`"softwareKeyboardLayoutMode": "resize"`, so the window itself resizes and the sheet
may well be pushed up in practice. That is precisely the condition under which
`undefined` is "correct by accident". → **D6** said observe before changing.

**✅ THE OBSERVATION ALREADY EXISTS — the mitigation is disproven (2026-08-15).**
`.plans/2026-08-02-vendor-mobile-keyboard-and-version.md` B1 ran this exact
experiment on `AuthScreen` and was **confirmed on a device by the user**. Two facts
from it settle this without a new device pass:

1. `softwareKeyboardLayoutMode: "resize"` was **already the default** — that plan
   declared it explicitly and recorded that doing so *"changes no behaviour"*.
2. With `resize` in force, the keyboard **still drew over the password field**.
   `behavior="height"` is what fixed it, and it *"works whether or not the window
   itself resizes."*

So the resizing window does **not** rescue `behavior={undefined}` in this app. This
sheet carries the identical pre-fix form, and it is the only sheet with a
`TextInput`.

**🔄 CODE COMPLETE (2026-08-15).** Android → `behavior="height"`. **iOS keeps
`"padding"`** rather than copying `AuthScreen`'s
`automaticallyAdjustKeyboardInsets`: that prop belongs to a ScrollView, and this
sheet has none. One mechanism per platform, as the trap requires.

⚠️ **Still device-outstanding, and for a reason the earlier plan could not cover:**
`AuthScreen` is a plain screen; this is inside a `Modal` with its own window. The
direction of the fix is right — `undefined` does nothing anywhere — but whether
`"height"` composes correctly with a Modal-hosted sheet is unproven here.

**Verification:** device — open the reject sheet, focus the field, confirm the
Confirm button is reachable with the keyboard up, on both navigation modes.

---

### B4 — Earnings adds three figures on a wider basis, and renames one  🔄 CODE COMPLETE (2026-08-15) — device check outstanding
**Files:** `src/services/dashboard.service.ts`; `src/services/transactionTotals.ts:30-54`;
new `src/lib/financials.ts`

⚠️ **DOWNGRADED 2026-08-15.** The first draft of this item claimed the port
"changes the number under the vendor's eyes". **That was wrong** and is corrected in
F3: mobile's `Revenue` and web's `Payout Released` are the same sum over the same
rows, so the figure the vendor sees today **survives unchanged**, under a new name.

What is actually true, and still enough to keep this as a blocker:

1. **Three NEW figures arrive on a WIDER basis** — Gross, Platform Fee and Net are
   computed over non-reversed rows, where the surviving Payout figure is
   payable-only. That is the intended decomposition (`net = payout + onHold`), not
   a discrepancy — but it means **Gross will exceed the Transactions screen's
   "Collected" for the same period** whenever money is held. Two screens showing
   different totals for one month is a support ticket unless the caption says why
   (I2 is therefore not optional).
2. **"Revenue" disappears as a label.** Anything naming it needs updating — see the
   guide-copy coupling below.

**Coupling — the guide says this out loud.** `GuideCard/guideItems.ts` was reworded
on 2026-08-14 to read *"Your payout matches the dashboard's Revenue whenever both
are set to the same range."* That sentence stays TRUE in substance (the number is
unchanged) but WRONG in wording once the card is called "Payout Released". **Update
it in the same change** — that file carries web's rule that documentation changes
with the UI, and this plan is the second time in two days it would otherwise drift.

**Fix approach:** port `summariseFinancials` into a new mobile `src/lib/financials.ts`
(pure, no `supabase` import, so `node --test` can load it — the rule that put
`transactionTotals.ts` where it is), with its own `.test.ts` asserting the two
identities in centavos exactly as web does. Then either replace or supplement the
existing payable figure — → **D1**, **D2**.

⚠️ `transactionTotals.ts` stays as-is: the Transactions screen's own basis is
correct for that screen and must not be changed to match.

**Verification:** machine (`npm test` on the identities) + device (the four figures
add up on screen, and Payout still matches Transactions' "Your payout" for the same
period).

**✅ REDUCER DONE (2026-08-15) — Stage 3.** `src/services/financials.ts` +
`financials.test.ts`, 10 cases, all green. Nothing imports it yet, so behaviour is
unchanged by construction.

⚠️ **Placed in `services/`, not `lib/` as §7 said.** Deviation made on this app's
own precedent: `transactionTotals.ts`, `bookingErrors.ts` and `vendorMapping.ts`
are all pure, unit-tested reducers living in `services/` because they operate on
raw DB rows, while `lib/` holds app-wide helpers. The placement also lets it reuse
`TotalsRow` from `transactionTotals.ts` rather than declaring a second identical
four-field shape — which a `lib/` module could not do without importing
`services/` and inverting the layer, the same trap that moved `DateWindow` into
`lib/types.ts` on the previous plan.

**Two things the tests pinned that reading alone would not have caught:**

1. ⚠️ **The identities hold in CENTAVOS, not in float pesos** — and the first
   version of the test failed proving it. For rows like `10.1 / 20.2 / 30.3` the
   reducer returns an exact `gross` of 61.3, but adding its *own returned pesos*
   (`platformFee + net`) yields 61.300000000000004. The reducer is exact; a
   **consumer that re-adds the peso figures can still drift**. Recorded in the test
   as a caveat for any future surface: display these figures, do not re-derive one
   from the others. Nothing does today (`fmtPeso(n, 0)` renders whole pesos), but a
   "check my sums" panel would.
2. ✅ **The rename promise is now enforced by a test.**
   `summariseFinancials(rows).payout === sumTransactionTotals(rows).payout` is
   asserted directly, so the claim that "Revenue" becomes "Payout Released" without
   changing value cannot silently rot. A companion test pins that `gross` is
   **wider** than the Transactions screen's `collected` — not a discrepancy, the
   documented consequence of the two bases, asserted so the Earnings caption
   explaining it cannot be dropped as redundant.

**Deliberately NOT ported:** `percentChange`. D2 declined deltas, and porting an
unused function would be dead code arriving with its own test burden.

**🔄 SERVICE + CARDS DONE (2026-08-15) — Stage 5.**

- `getRevenueForWindow` → **`getEarningsForWindow`**, returning
  `{ totals: FinancialTotals | null, complete }`. ✅ **The query is byte-for-byte
  unchanged** — it already selected all four money columns for the payable
  reducer, so the Earnings group costs **zero extra network work**. Only the
  reduction changed, which is what made D1(a) cheap enough to be worth doing.
- `DashboardStats` now carries `earnings: FinancialTotals | null` +
  `earningsComplete`, replacing `revenue` / `revenueAvailable` / `revenueComplete`.
  **Nullable object rather than flat fields with a flag**: a flag can be ignored by
  a caller, a null cannot, and the rule here is "—, never a confident ₱ 0".
- Four cards, sharing **one** destination — they count the same ledger over the
  same period, so per-card callbacks would be four ways to say one thing.
- **The Earnings caption gained its basis clause** now that it is true, plus a
  reversed-payout count when there is one. A vendor whose figures look light is
  owed the reason rather than left to infer it.
- ⚠️ **Earnings sub-lines do NOT repeat the period, but Completed's does.** Not an
  inconsistency: all four Earnings cards follow the control uniformly, so the
  caption carries the period once, while Completed sits between two cards that
  deliberately ignore the period and must say that it does not.

**Guide copy updated in the same change, as this item required.** Three places:
the "Payout Released" rename, the Operations/Earnings grouping in "This screen",
and — newly needed — a sentence saying Gross Income is **deliberately bigger** than
the Transactions screen's Collected because it counts money still held. That last
one is the F3 consequence reaching the user-facing copy.

---

## IMPORTANT

### I1 — Dashboard has no section grouping  🔄 CODE COMPLETE (2026-08-15) — device check outstanding
**File:** `src/components/dashboard/DashboardView/DashboardView.tsx:66-109`

Flat 2×2 grid, no headings, no captions (F1).

**Fix approach:** a new `components/dashboard/DashboardSection/` — heading + optional
caption + children, mirroring web's small-uppercase treatment via existing tokens
(`type.caption.size`, `t.text`), separation by spacing alone.

**Component separation** (RN variant, stated not assumed): pure display — no state,
no effects, no handlers — so `.tsx` + `.styles.ts` with **no hook**, exactly like
`StatCard`. Styling via `makeStyles(tokens)`; no inline styles.

**🔄 CODE COMPLETE (2026-08-15).** `components/dashboard/DashboardSection/` as
specified — `.tsx` + `.styles.ts`, no hook. Small uppercase heading matching the
"Waiting for approval" treatment already on this screen rather than a third
heading style; separation by spacing and the label alone, no card chrome or
dividers, following the web section's own reasoning. The heading carries
`accessibilityRole="header"` so the screen has a structure a screen reader can
navigate instead of seven undifferentiated cards.

**Earnings holds one card for now.** The four-way split is Stage 5; grouping first
means the caption that makes the split honest is already in place when the cards
arrive, rather than being retrofitted.

### ⚠️ V1 — Operations is THREE cards in a two-up grid, so one card goes full width
**Found 2026-08-15 by reviewing the diff, before any device pass. Not a bug —
a design consequence that needs eyes.**

`StatCard` carries `flexGrow: 1` + `flexBasis: "47%"` in a `flexWrap: "wrap"` row
(`StatCard.styles.ts:13-14`). With four cards that produced the tidy 2×2 this app
shipped. **Grouping changed the counts to 3 and 4**, so Operations now lays out as
two cards then **Completed alone on row two, stretched to full width** by
`flexGrow`. Earnings, at four, stays a clean 2×2.

This was foreseeable, and the web portal hit it first: *"three cards in two columns
… leave a ragged half-empty row"* (`DashboardPage.tsx:50-52`). Web's fix was
`sm:grid-cols-3`, **which mobile cannot use** — three columns at 320dp leaves ~85dp
per card, well under what a peso figure needs.

So the ragged row is unavoidable; only its treatment is a choice:

- **(a) Leave it — Completed spans the width.** Current behaviour, zero work. But it
  makes the *least* urgent Operations card the visually dominant one, above a
  Pending Approvals card that carries the urgency stripe.
- **(b) Stop the stretch** — `flexGrow: 0` for that one card, leaving a half-empty
  row. Honest to the 2-up grid, but the gap looks like a missing card.
- **(c) Reorder so the full-width slot lands on Pending Approvals**, making the
  emphasis deliberate rather than incidental.

**Recommendation: look at it on a device before choosing.** All three are cheap, and
this is precisely the class of judgment that reading the stylesheet cannot settle.

### I2 — The captions that keep two clocks honest are missing  🔄 CODE COMPLETE (2026-08-15) — device check outstanding
**Files:** `useDashboardView.ts`; new section component

Without them, one period control silently claims Operations and Earnings measure the
same thing (§1a). Web's own note says removing the captions *"returns the
objection."*

**Fix approach:** derive both captions in `useDashboardView` (not in the `.tsx`),
reusing `rangeLabel(window)` from `lib/dateWindows.ts`. Earnings' caption must also
carry the **basis** and, when applicable, the partial-figures and reversed-count
notes — the existing truncation warning folds into it rather than sitting separately.

**🔄 CODE COMPLETE (2026-08-15).** Both captions derived in `useDashboardView`:
*"Bookings serviced 01–31 Aug 2026"* and *"Payments received 01–31 Aug 2026"*.

- ⚠️ **`rangeLabel` was the wrong formatter and a new one was added.** It compacts
  a whole month to "Aug 2026" — correct for a card's sub-line, but a caption
  directly above that card would then repeat its words and add nothing. New
  `rangeDatesLabel(window)` always spells the span out ("01–31 Aug 2026"), with 5
  tests pinning the difference. The two granularities are the reason both earn
  their place, which is also how the web portal separates them.
- **The standalone truncation warning is gone**, folded into the Earnings caption
  as planned, and its now-dead `warning` style was removed from
  `DashboardView.styles.ts`. Two places telling a vendor the same period is
  incomplete is worse than one, and the caption sits directly over the money it
  qualifies.
- ⚠️ **The Earnings caption does NOT yet claim to exclude reversed payouts**, and
  that omission is deliberate: the figure below it is still the payable-only
  `Revenue` card. That clause becomes true — and gets added — with the four-card
  split in Stage 5. Writing it now would be a caption describing code that does not
  exist yet.

### I3 — Guide is discoverable only by scrolling the dashboard  🔄 CODE COMPLETE (2026-08-15) — device check outstanding
**Files:** `src/components/dashboard/GuideCard/GuideCard.tsx:36-52`;
`src/app/(app)/dashboard.tsx`; `src/components/common/ScreenShell/ScreenShell.tsx:50-53`

See §3. The "Show guide" affordance only exists *inside* the collapsed card, which
itself sits below the stats — so once hidden, the way back is a scroll to a row that
looks like nothing.

**🔄 CODE COMPLETE (2026-08-15).** New `components/layout/GuideAction/` — icon-only
`Compass`, matching the vendor portal's own header button, at the same 44pt size as
`SettingsAction`. It is a **toggle** with `accessibilityState={{ expanded }}` and a
label that follows the state ("Show…" / "Hide…"), because it is now the guide's only
way in. The card's inline **"Show guide"** row is gone, along with its now-dead
`showRow` style; the card's own **Hide** stays — one way in, two ways out, the
normal shape for a dismissible panel.

⚠️ **The guide's state had to move, and this was the substantive part of the
stage.** `useGuideCard` lived inside `GuideCard`, but the new trigger is rendered
through `ScreenShell`'s `action` slot from the ROUTE — which is not an ancestor of
the card. Two separate `useGuideCard()` calls would have meant two independent
copies of the same AsyncStorage-backed state, so a header tap would flip one and
nothing on screen would move. The hook now lives in `app/(app)/dashboard.tsx`, the
only common ancestor, and `GuideCard` became **controlled** (`hidden`, `onHide`).
`useGuideCard` gained `toggle`, which treats the not-yet-read `null` as "showing"
so the first tap acts on what is actually on screen.

### I5 — Showing the guide from the header may do nothing visible  🔄 CODE COMPLETE (2026-08-15) — device check outstanding
**Files:** `src/components/dashboard/DashboardView/DashboardView.tsx`;
new `GuideAction`

**A consequence of D4(a), recorded rather than discovered later.** The guide card
renders **below** the stat grid — and after D1 that grid grows from four cards to
seven plus two section headings. So a vendor who has scrolled down, or who is on a
small device, can tap the header's guide button and see **nothing happen**: the card
appears, correctly, off-screen above or below them.

That is the classic "did my tap work" failure, and it undercuts the entire point of
moving the trigger somewhere findable.

**Fix approach:** when the guide is shown *from the header*, scroll it into view —
a `ref` on the dashboard `ScrollView` plus the guide's `onLayout` y-position, driven
from `useDashboardView` so the render layer stays pure. Not needed when it is shown
by any other route, because there is no other route.

**Also settled here:** the header button is a **toggle** (show ⇄ hide) with
`accessibilityState={{ expanded }}` and a label that follows the state. The card
keeps its own "Hide" button — that is in-context dismissal, not a duplicate entry
point, and the inline **"Show guide"** row is removed exactly as the request
requires.

**Verification:** device — scroll to the bottom of the dashboard, tap the guide
button, confirm the card is brought into view rather than silently toggled.

**🔄 CODE COMPLETE (2026-08-15).** A `ScrollView` ref plus the guide wrapper's
`onLayout` y, with the scroll fired from an effect in `useDashboardView`.

⚠️ **Fires only on a TRUE → FALSE transition**, guarded by a ref. `hidden` also
goes `null → false` on every cold start for the majority of vendors, who have never
hidden the guide — scrolling on that would yank the dashboard down each time the
app opens. That guard is the whole item; without it this "fix" would be a new bug
on the most common path.

⚠️ **The React Compiler forced the shape of this.** `reactCompiler` is enabled in
`app.json`, and returning a ref from a hook — **or even a callback ref** — makes its
lint treat *every* property read on that hook's result as a ref access during
render: **52 errors across `DashboardView`, none of which named the ref.** The
`ScrollView` handle is therefore created in the render layer and passed INTO the
hook. The render layer still holds no logic — an inert handle, with the effect that
uses it in the hook — and both files say why, because the obvious "tidy-up" is to
move it back.

### I4 — `BookingDetail`'s inset fix has never been seen on a device  ⬜ TODO
**File:** `src/components/bookings/BookingDetail/useBookingDetail.ts:96`

`bottomInset: insets.bottom + TAB_BAR_HEIGHT` is **correct in principle** and is the
composition the rest of the app uses. But `AGENTS.md` records this exact item as
*"B1 coded 2026-08-06 and unverified on device"*
(`.plans/2026-08-05-vendor-mobile-scroll-header-and-fee.md`).

**This plan must not assume it works.** If the user's report is about the booking
*detail* screen rather than the sheets, this is the item — not B1. Both get checked
in the same device pass, which is why the pass comes first (Stage 0).

---

## §2 — Dashboard implementation approach

**Components that change:** `DashboardView.tsx` (grouping + the new cards),
`useDashboardView.ts` (captions, the earnings figures, four more navigation
callbacks), `dashboard.service.ts` (return the full totals, not one number).

**Reused as-is, no new abstractions:**
- `StatCard` — already takes `label / value / sub / icon / iconColor / iconBg /
  loading / unavailable / onPress / accessibilityHint`. **Every Earnings card is
  expressible with the props that already exist.** Web's `delta` prop is the only
  gap → D2.
- `PeriodFilter`, `rangeLabel`, `windowFor` — shipped in `d52dea2`.
- `fmtPeso(n, 0)` — the existing summary-card formatting.
- The drill-down mechanism (`router.push` + `parseWindowParam`) — all four Earnings
  cards share **one** destination and one window, as web does.

**Data:** no new query. F7 — the existing revenue query already selects all four
money columns over the window with a bound and a `complete` flag. The service
returns `{ total }` today; it would return the full `FinancialTotals` instead.
Deltas are the **only** thing that would add a second network request (→ D2).

**Loading / error / empty**, following what the app already does:
- **Loading** — `StatCard`'s existing skeletons; the caption reads "Updating…" as
  web's does.
- **Error** — `revenueAvailable === false` already renders "—" rather than a
  confident ₱ 0, and that rule extends to all four cards unchanged. A vendor who
  earned money must never be shown zero because a fetch failed.
- **Partial** — `revenueComplete === false` already exists from the truncation fix;
  it moves into the Earnings caption.
- **Empty** — a real ₱ 0 renders as ₱ 0. Zero is a fact; "—" is an absence.

---

## §3 — Guide button

| Question | Answer, from the code |
|---|---|
| Where does "Show guide" live now? | Inside `GuideCard` itself: when hidden it renders a `showRow` with a Compass + "Show guide" (`GuideCard.tsx:44-52`); when visible, a "Hide" button (`:71-81`). |
| What holds the state? | `useGuideCard.ts` — `hidden: boolean \| null`, persisted at `AsyncStorage["ezzy.vendor.guideHidden"]`. `null` = "not read yet", which is why nothing flashes on cold start. |
| Which header holds Settings? | `ScreenShell`'s pinned `action` slot (`ScreenShell.tsx:50-53`), passed per route: `(app)/dashboard.tsx` renders `<SettingsAction />`. The row is already `flexDirection: "row"` with `gap: spacing.sm` and right-aligned (`ScreenShell.styles.ts:22-31`) — **a second action needs no layout change**. |
| Web's equivalent | `TopBar.tsx:60-67` — icon-only `Compass`, `aria-label="Open the Getting Started guide"`, sized 34px beside the other header controls. |

**Recommended affordance:** a new `components/layout/GuideAction/` mirroring
`SettingsAction` exactly — `Pressable` + `Compass` at `size={20}` + `tokens.strong`,
same `styles.button` / `styles.pressed` shape, `accessibilityRole="button"`,
`accessibilityLabel="Getting started guide"`. Icon-only matches both the existing
Settings control and web's own header. `SettingsAction.styles.ts` already meets the
44pt target; the new control inherits it by construction.

**What happens to the card** is a real fork, not a detail → **D4**. The user's
constraint — *"do not create a second Guide implementation"*, *"reuse the existing
guide behavior/modal"* — is satisfiable both ways, because `GUIDE_ITEMS` and
`useGuideCard` are already separate from the rendering.

**Duplicate-control rule:** whichever option D4 picks, the inline **"Show guide"**
row must go. Two entry points to the same guide is exactly the confusion the request
calls out. The **"Hide"** button's fate depends on D4.

---

## §4 — Android overlap: the actual root cause

**Root cause: Android is edge-to-edge, and three surfaces never opted into the
inset.**

Established, not assumed:

1. **Edge-to-edge is on and is not configurable here.** `app.json` contains **no**
   `edgeToEdgeEnabled` key and **no** `androidNavigationBar` block, and
   `react-native-edge-to-edge` is not a dependency. This is Expo **SDK 57**, where
   edge-to-edge is the platform default — so the app draws **behind** the gesture
   bar / navigation bar, and `insets.bottom` is the only thing standing between a
   control and the system UI.
2. **The tab bar compounds it.** `tabBarStyle: { position: "absolute" }`
   (`(app)/_layout.tsx:59`) takes the bar **out of layout flow**, so it floats over
   content and occupies no space. Any screen inside `(app)` must therefore clear
   `TAB_BAR_HEIGHT + insets.bottom` itself — a rule `tokens.ts:290-306` states
   explicitly.
3. **Four surfaces do this correctly** — `useRefreshableList.ts:24`,
   `useDashboardView.ts:127`, `useBookingDetail.ts:96`, `Snackbar.tsx:35`.
4. **Three do not** — both `Modal` sheets (B1) and `SettingsList` (B2).

**What it is NOT** — ruled out by reading, so the fix is not aimed at the wrong thing:
- ✖ Not a missing `SafeAreaProvider`: mounted at `app/_layout.tsx:99`.
- ✖ Not absolute positioning in the booking screen: `BookingDetail` uses a flex
  column with `justifyContent: "space-between"`, and the bar is a normal sibling.
- ✖ Not a hardcoded offset anywhere: no `marginBottom: 50`-style constant exists.
  `TAB_BAR_HEIGHT = 49` is a *documented* constant standing in for an unreachable
  API, and it is always **added to** the real inset, never substituted for it.
- ✖ Not `ScreenShell`: its `edges={["top"]}` is correct — claiming "bottom" there
  would double-pad every tab screen (`ScreenShell.tsx:22-24`).

**Therefore the shape of the bug is:** *the app's inset discipline is correct where
it was applied and simply absent in a `Modal` and one `ScrollView`* — not a
systemic layout failure. The fix is to apply the existing composition in three more
places, and (→ D7) to make the composition hard to forget next time.

---

## §5 — Recommended action pattern for the booking screen

Four candidates, judged against the user's priority list:

| Pattern | Verdict |
|---|---|
| **(a) Keep the sticky footer, make its inset correct** | **RECOMMENDED.** It is what `BookingDetail` already does, the composition is already right (`useBookingDetail.ts:96`), and the actions stay reachable without scrolling on a screen whose content can exceed one viewport (notes are free text). |
| (b) Move actions inline, under the booking card | Rejected. On a long booking the primary action falls below the fold, and the vendor must scroll to act on the thing they just read. It also throws away a working implementation to fix a bug that is not in it. |
| (c) A new shared bottom-action container | Rejected as premature — one screen uses this pattern. That is not two, and an abstraction for one call site is exactly what the simplicity rule forbids. |
| (d) Actions in the pinned header | Rejected. Destructive and primary actions belong in thumb reach, not next to Settings. |

**So: no redesign of the booking screen is proposed.** The honest reading of the
evidence is that the booking screen's pattern is already correct and *unverified*,
while the sheets that open **from** it are genuinely wrong. Redesigning the screen
would be fixing the wrong thing loudly.

⚠️ **If the device pass (Stage 0) shows the booking action bar overlapping**, then
`useBookingDetail.ts:96` is wrong in a way reading cannot reveal — most likely
`TAB_BAR_HEIGHT` disagreeing with the real bar height on that device. The plan
gains an item then; it does not get one pre-emptively.

---

## §6 — Shared impact audit

Every surface with a bottom-anchored control, from a full `src/` grep:

| Surface | Status | In scope? |
|---|---|---|
| `RejectReasonSheet` (reject + flag) | ❌ no inset | **Yes — B1** |
| `ActionInfoSheet` | ❌ no inset | **Yes — B1** |
| `SettingsList` | ❌ no clearance | **Yes — B2** |
| `BookingDetail` + `BookingActionBar` | ✅ composed, unverified | **Verify only — I4** |
| `RefreshableList` (bookings / transactions / notifications) | ✅ | No |
| `DashboardView` | ✅ | No |
| `Snackbar` | ✅ | No |
| `AuthScreen` (6 pre-app routes) | ✅ `edges={["top","bottom"]}` | No |

**Screens the user listed that DO NOT EXIST in this app** — recorded so the audit
reads as complete rather than partial: **booking create/edit** (bookers create
bookings, not vendors), **offering forms**, **schedule forms**. The vendor mobile app
has no create/edit forms at all. Its only text-input surfaces are the auth forms and
the reject/flag reason sheet.

**Shared-component leverage:** B1 and B2 are three call sites of one missing idea.
D7 decides whether to fix them individually or introduce the one small hook that
makes the composition impossible to forget.

---

## §7 — Files affected

**Modify — dashboard**
- `src/components/dashboard/DashboardView/DashboardView.tsx` — grouping, cards
- `src/components/dashboard/DashboardView/useDashboardView.ts` — captions, totals, callbacks
- `src/services/dashboard.service.ts` — return full totals

**Modify — guide**
- `src/components/dashboard/GuideCard/GuideCard.tsx` — remove the inline "Show guide" row
- `src/app/(app)/dashboard.tsx` — pass both header actions
- possibly `src/components/dashboard/GuideCard/useGuideCard.ts` (D4)

**Modify — insets**
- `src/components/bookings/RejectReasonSheet/{RejectReasonSheet.tsx,.styles.ts,useRejectReasonSheet.ts}`
- `src/components/bookings/ActionInfoSheet/{ActionInfoSheet.tsx,.styles.ts}` (gains a hook only if D6 requires one)
- `src/components/settings/SettingsList/{SettingsList.tsx,.styles.ts}`

**New**
- `src/components/dashboard/DashboardSection/{DashboardSection.tsx,.styles.ts}` — pure display, no hook
- `src/components/layout/GuideAction/{GuideAction.tsx,.styles.ts}` — mirrors `SettingsAction`
- `src/lib/financials.ts` + `src/lib/financials.test.ts` — ported reduction (B4)
- `src/hooks/useBottomInset.ts` — **only if D7 says so**

**Explicitly NOT touched:** `lib/bookingFilters.ts`, `transactionTotals.ts`,
`ScreenShell`, `tokens.ts`, anything in `vendor/`.

---

## §8 — Edge cases

| Case | Handling / risk |
|---|---|
| Android three-button nav | Largest `insets.bottom` (~48dp). The failure mode B1 and B2 are about. |
| Android gesture nav | ~24dp inset. Overlap is subtler and easier to miss — check both. |
| Varying nav-bar heights | Never assumed: the inset is read, `TAB_BAR_HEIGHT` is only ever **added**. |
| iPhone with / without home indicator | Same composition; `insets.bottom` is 0 on older devices. Unverifiable here (no Apple account, `AGENTS.md`). |
| Small screens (320dp) | `StatCard`'s `flexBasis: 47%` holds a 2-up grid at 320dp by prior arithmetic. Seven cards make the dashboard taller — acceptable, it scrolls. |
| Large screens / tablets | `ios.supportsTablet: false`. Android tablets get a wide 2-up grid; no new breakpoint proposed. |
| Landscape | `orientation: "portrait"` in `app.json` — locked, so out of scope. |
| Keyboard open | B3. The only keyboard surface at risk is the reason sheet. |
| Long forms needing scroll | `ActionInfoSheet` already bounds itself at `maxHeight: 70%` with an internal ScrollView; its inset must not break that bound. |
| Font scaling | `StatCard`'s label caps at two lines; **Earnings sub-labels are the longest strings on the screen** ("Released & releasable · 1–31 Aug"). Highest-risk item for a large-font device check. |
| Light / dark | Every new style goes through `makeStyles(tokens)`; the section heading uses `t.text`, not a literal. |
| Dashboard loading | Existing skeletons; caption says "Updating…". |
| Dashboard API error | "—" per card, never ₱ 0 (§2). |
| Very large numbers | `fmtPeso(n, 0)` + locale grouping. ₱ 12,345,678 at `type.stat.size` in a 47%-wide card is the wrap risk — **device check**. |
| Localisation | **None exists.** No i18n library, all strings inline. Not a risk today; noted so the assumption is on record. |

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains — plan-authoring §7.
     NONE REMAIN: D1–D7 all resolved 2026-08-15. -->

- **D1 — how much of Earnings comes across?** → **(a) full port: four cards**
  (resolved 2026-08-15). Gross Income · Platform Fee · Net Income · Payout Released,
  on web's non-reversed basis, with `payout` staying payable-only inside it. Takes
  up 2026-08-14 D4's deferred option (b); **nothing chosen under (a) is undone** —
  see "Read this first" §2. Rejected: headings-only (not the requested parity), and
  four cards on a payable-only basis (Net and Payout collapse into the same number,
  making three of the four redundant — `vendor/lib/financials.ts:20-27`).

- **D2 — port the vs-previous-period deltas?** → **(a) No, not this pass** (resolved
  2026-08-15). Deltas need a **second query per period change**, plus
  `previousPeriod` / `vsLabelFor` / `percentChange` and a new `delta` prop on
  `StatCard`, with per-metric "no prior data" handling because the metrics fail
  independently. That doubles the dashboard's money traffic on a phone for a
  comparison nobody asked for. The port stays additive if it is wanted later — the
  four figures are already computed.

- **D3 — what happens to "Today's Bookings"?** → **(a) keep it** (resolved
  2026-08-15, settled from the code rather than asked). Web's slot is "Today's
  Schedule" → Calendar; mobile has neither `schedules` data nor a calendar screen
  (F4). The mobile card answers the same question — *what is happening today* —
  with data this app actually has. Dropping it for card-for-card parity would remove
  a working card to match a screen that does not exist here.

- **D4 — inline card or modal?** → **(a) keep the inline card** (resolved
  2026-08-15). The header button drives the existing `useGuideCard`; content, hook
  and persisted preference are untouched, so there is no second guide
  implementation. Rejected: converting to a modal like web's `GuideModal` — larger,
  and it would revisit `.plans/2026-07-29-…` D3, which chose hide/show deliberately.
  ⚠️ Carries a discoverability cost that must be handled, not assumed away → **I5**.

- ⚠️ **D5 CONFLICTS WITH AN EARLIER APPROVED DECISION — reopened 2026-08-15.**
  `.plans/2026-08-05-vendor-mobile-scroll-header-and-fee.md` **B2** already
  specified this feature, and its **D4, approved 2026-08-06**, chose the icon on
  **all five tab screens** with state in a `GuideProvider` at the tab layout and a
  navigate-to-Dashboard show path. **That item was not found during this plan's
  investigation** — a §2 failure, since it sits in the same `.plans/` directory and
  is referenced from the app's own `AGENTS.md`. D5 was taken and executed as though
  the question were open. Every other detail of the two designs agrees; only the
  reach and the state location differ, and the built work is a strict subset of the
  larger one. **✅ Resolved 2026-08-15: the user chose to KEEP DASHBOARD-ONLY**, so
  D5 below stands and that plan's B2/D4 is ✖ ABORTED with the reason recorded
  there. Original resolution follows.

- **D5 — which headers get the button?** → **(a) dashboard only** (resolved
  2026-08-15). One route file changes. Web puts it on every page because the guide
  documents the whole portal; mobile's guide is dashboard-led, and adding a control
  to three other headers is wider than the request.

- **D6 — mechanism for the sheet insets and the Android keyboard.** → **(a)
  `useSafeAreaInsets()` read in each sheet's hook** (resolved 2026-08-15, settled
  from the code), consistent with the four surfaces that already do this. ⚠️ **Held
  to a device confirmation in Stage 0**: a RN `Modal` renders in its own window, so
  if the reported inset is wrong there, the fallback is `<SafeAreaView
  edges={["bottom"]}>` *inside* the Modal. **B3's keyboard branch is observed before
  it is touched** — `softwareKeyboardLayoutMode: "resize"` may already be doing the
  work, and stacking a second mechanism on a resizing window is a recorded trap.

- **D7 — shared hook or local fixes?** → **(a) extract `useBottomInset()`** (resolved
  2026-08-15, settled from the code). Four call sites compose this by hand today and
  B1/B2 add three more; `tokens.ts:303-305` records that the constant exists
  *because two hand-written copies had already disagreed*, which is the same failure
  arriving again. ⚠️ The hook must take "does the tab bar apply here" as a
  **parameter, not an assumption** — a `Modal` covers the tab bar, so a sheet needs
  `insets.bottom` alone while a tab screen needs `TAB_BAR_HEIGHT + insets.bottom`.
  Getting that backwards is a 49pt gap in the wrong direction, which is precisely
  why it is worth writing once.

---

## DEFERRED / COSMETIC

- **C1 — `BookingTrendsCard` is not ported** (F5). Needs a charting dependency
  (approval gate) and is the least useful web widget on a phone screen. Revisit only
  if asked.
- **C2 — inline approve/reject on the dashboard preview** (F8). Mobile routes to the
  detail screen, where the action bar and its confirmation sheets already live.
- **C3 — `Snackbar` still composes its own bottom offset** (added 2026-08-15, Stage
  1). It is the one surface not migrated to `useBottomInset`, and that is a choice
  rather than an oversight: it receives `tabBarInset` as a **prop** from
  `SnackbarProvider.tsx:87`, so converting it changes a provider's public shape —
  wider than this stage, and for no behavioural gain. Its `extra` is also 12 rather
  than `spacing.xl`. **Consequence, stated honestly: D7's "one spelling" is six of
  seven, not seven of seven.** Fold it in whenever `SnackbarProvider` is next opened
  for another reason.
- **C4 — the header button's styles are a copy of `SettingsAction`'s** (added
  2026-08-15, Stage 2). Twelve lines of geometry duplicated rather than extracted
  into a shared `HeaderAction`, which was considered and rejected: extracting means
  rewriting a working component for no behavioural gain. The cost is bounded by the
  arrangement — the two render side by side in one row, so any divergence in size,
  radius or press state is immediately visible rather than silent. **Trigger to
  extract: a third header action.** Two is a pair; three is a pattern.

---

## Execution order

Nothing starts until D1–D7 are resolved.

| Stage | Work | Items | Gate to leave |
|---|---|---|---|
| **0** ⏸ | **Device pass on what already shipped (`d52dea2`)** — period control, drill-down, the booking action bar, both sheets. **No code.** | I4 confirm/deny | ⏸ **PARKED (2026-08-15) — the user chose to start at Stage 1.** Not abandoned: its checks are now folded into Stage 1's device pass, and I4 remains unverified. |
| **1** 🔄 | Insets: sheets + settings | B1, B2, B3, D6, D7 | **Code complete 2026-08-15, machine-verified only.** Device, both nav modes, keyboard up and down |
| **2** 🔄 | `GuideAction` + relocate the trigger + scroll-into-view. **Code complete 2026-08-15, machine-verified only.** | I3, I5, D4, D5 | Device, both themes; no duplicate entry point; tapping from the bottom of the page visibly reveals the guide |
| **3** ✅ | `services/financials.ts` + tests — pure, nothing imports it yet. **DONE 2026-08-15** (placed in `services/`, not `lib/` — see B4). | B4 (part) | ✅ `npm test` 136/136 (10 new), `tsc` + `expo lint` clean, **zero** behaviour change |
| **4** 🔄 | `DashboardSection` + Operations/Earnings grouping + captions. **Code complete 2026-08-15, machine-verified incl. `expo export`.** Added `rangeDatesLabel` + 5 tests. | I1, I2 | Device: headings read correctly, captions name both clocks |
| **5** 🔄 | Earnings cards + service returning full totals. **Code complete 2026-08-15, machine-verified incl. `expo export`.** | B4, D1, D2 | Device: four figures add up; Payout agrees with Transactions for the same period |

Stage 0 first is not ceremony: **Stages 4–5 rewrite the files whose current
behaviour has never been observed**, and Stage 1 fixes bugs whose severity is
currently inferred from source rather than seen.

---

## Verification

**Machine-verifiable:** `tsc --noEmit`; `npm test` (new `financials.test.ts`
identities in centavos); `expo lint`; `npx expo export --platform android`.

**Needs a device — and this app has no visual-regression suite**, so everything
below is a human check on **Android** (iOS remains unverifiable here):

- Reject sheet and Action-info sheet: buttons fully clear of the system nav, on
  **both** gesture and three-button navigation.
- Reject sheet with the keyboard open: the Confirm button is reachable, and the
  sheet is neither double-lifted nor covered.
- Settings: the final row is fully tappable with the tab bar floating over it.
- Booking detail: the action bar clears the tab bar (I4 — the check that was never
  run).
- Dashboard: two headings, two captions, seven cards; card heights even per row.
- Earnings figures satisfy `gross = fee + net` and `net = payout + onHold` on screen.
- Payout Released matches Transactions' "Your payout" for the same period — the
  cross-screen agreement F3 puts at risk.
- Largest OS font: Earnings sub-labels do not truncate mid-word.
- Very large peso values do not wrap the card.
- Light and dark for every new surface.
- Guide: one entry point only; opens from the header; state persists across a
  cold start.

### Findings from the pre-device diff review (2026-08-15)

Three things were checked by reading, since no device pass has happened. One is a
real design question, two are cleared.

- ⚠️ **V1 — Operations' third card stretches full width.** See I1 above; needs an
  eyes-on decision between three cheap options.
- ⚠️ **V2 — the Earnings caption is long.** At its fullest it reads *"Payments
  received 01–31 Aug 2026 · Excludes reversed payouts · Payout is released &
  releasable only · 2 reversed payouts excluded"* — roughly 130 characters, so two
  to three lines at default type and more at large font. It deliberately has **no**
  `numberOfLines`, because a truncated statement of basis is worse than none. If it
  reads as a wall of text on device, the fix is to shorten the clauses, **not** to
  clamp the lines.
- ✅ **CLEARED — the guide's measured position is not stale.** The scroll target
  comes from an `onLayout` on a wrapper that renders whether or not the card is
  visible. Its `y` is set by the content ABOVE it, which does not change when the
  card appears — only the wrapper's height does. So the value read in the effect is
  correct even though `onLayout` for the newly-tall wrapper fires after it.
