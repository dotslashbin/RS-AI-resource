# Vendor mobile — full-page scrolling, header actions, and the platform fee rate

**Date:** 2026-08-05
**App / scope:** `ezzy-vendor-mobile` — plus **one new `backbone` migration** (approval gate, B3a) and documentation updates
**Status:** IN PROGRESS — approved 2026-08-06; stage 1 of 5 coded, awaiting device
verification. Stage 3 (B3a, the migration) still needs its own explicit go.

> Stop pinning half the screen: everything except a slim action row scrolls. Move
> Show-guide into that row as an icon, and put the configured platform fee
> percentage on the Platform fees card without lying about which money it produced.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "command I1").

---

## 0. Scope

**In scope**

- The pinned/scrolling split on all five tab screens (B1).
- Show-guide as a header icon on every tab screen, which forces the guide's
  shown/hidden state out of one component and into a provider (B2).
- The configured platform fee percentage on the Transactions summary card, via a
  new `SECURITY DEFINER` accessor (B3a + B3b).
- Percentage formatting shared between the card and the list rows (I1).
- Documentation (I3) — explicitly requested, and one item of it is *forced*: see
  the stale-comment coupling in B3a.

**Out of scope**

- `vendor`, `booker`, `command`, `ezzy-booker-mobile`. No web app changes.
- Any change to how the fee is *calculated* or snapshotted. The trigger, the
  ledger and the payout arithmetic are untouched — this plan reads one number and
  displays it.
- `platform_fee_settings` RLS policies. B3a deliberately does **not** touch them;
  see the design note there for why a function beats a policy here.

**Cross-app flag.** B3a is a `backbone` migration and therefore an approval gate
under root `AGENTS.md` ("Any schema change… new function"). The exact SQL is
written out inline below and **will not be created until you say go**.

---

## 0.1 How D2 and D3 were reconciled — read this before B3

You answered these from two different framings and they pull against each other:

- **D2** — the percentage comes from the **live global setting**, not from the
  per-transaction snapshot.
- **D3** — show the rate **only when the rows in the range are unambiguous**.

D3's options were written assuming the snapshot source, so "unambiguous" meant
"all snapshots agree with each other". With D2's live-global source there is only
ever one number, so read literally D3 has nothing left to gate.

**It still has a job, and it is the important one.** The Platform fees card shows
a *money* value — the sum of `platform_fee_amount` across the range — and that sum
was computed from whatever rate applied at each payment. Printing the current
global rate beside it unconditionally attaches a percentage to money that
percentage may not have produced. So the two answers combine into one rule:

> Show `{global rate}% of each booking` **iff** every payable row in the range was
> charged exactly that rate. Otherwise show no sub-label.

Three consequences, stated plainly rather than discovered later:

| Situation | Card shows |
|---|---|
| Rate unchanged across the range (the normal case) | `12% of each booking` |
| Rate changed mid-range | no sub-label — the money came from two rates |
| Rate changed, but no payments since | no sub-label, even though the configured rate is knowable |

The third is conservative on purpose. The alternative is printing a rate that
produced **none** of the money on the card, which is worse than printing nothing.

---

## BLOCKERS

### B1 — Everything above the list is pinned; only the list scrolls  🔄 IN PROGRESS (coded 2026-08-06, needs a screenshot)

> **Executed 2026-08-06, stage 1.** `ScreenShell` now pins only an `actionRow`;
> title and subtitle travel through the new `ScreenTitleContext` and are rendered
> by `<ScreenTitle />` inside each screen's own scroll container.
> `RefreshableList` gained `header?: ReactElement`, rendered in all four states.
> Seven surfaces updated: Dashboard, Bookings, Booking detail, Transactions,
> Notifications, Settings, and `RefreshableList` itself.
>
> **The inset strategy was inverted mid-implementation, and this is the part worth
> reading.** The plan implied bleeding the whole header out of the content
> container's `spacing.xl`. That was written before checking `StaleBanner`, which
> **returns `null` when the data is fresh** — the common case. A bleed wrapper
> around a component that renders nothing is still a flex child, so it would
> consume the dashboard's `content` `gap` and leave a permanent ~16pt hole at the
> top of the screen. Inverted to: each piece that moved into a header **drops** its
> now-redundant `spacing.xl` (`StaleBanner`, `PushPermissionCard`,
> `TransactionsView` toolbar + note, `TransactionSummaryCards` wrapper,
> `NotificationsList` toolbar), and only `BookingFilterTabs` — a horizontally
> scrolling strip that genuinely wants full width — bleeds back out with a
> negative margin of its own.
>
> **Confirmed against the library, not assumed:** FlashList v2 never reads
> `contentContainerStyle` anywhere in its dist — it is absent from the prop list
> `RecyclerView` destructures, so it falls through to the underlying ScrollView
> whose content container wraps the header along with the cells. That is why the
> header is inside the padding at all.
>
> **`ListHeaderComponent` takes the element directly.** Its type is
> `ComponentType | ReactElement`, and the element form is the safe one: React
> reconciles by `type`, so an inline `header={<Toolbar />}` is stable across
> renders. The remount hazard is the *component* form — a new function identity
> each render — which is what the prop's doc comment now warns against.
>
> **Found and fixed while wiring it:** `bookings/[id]` passes no header action, so
> `ScreenShell` pins nothing there — its "Booking" title would have disappeared
> entirely. `BookingDetail` now renders `<ScreenTitle />` at the top of its scroll
> content. Not in the plan; the plan listed five screens and there are six.
>
> **`contentPaddingTop` removed from `BookingsList`** per Trap 3 — the filter strip
> that justified it is now *inside* the scroll content, so the premise inverted.
>
> **Verified (machine only):** `tsc` clean · `expo lint` clean · 95/95 tests ·
> `expo export --platform android` builds, `dist/` removed.
> **Not verified:** all of it. Every claim above is about layout.

**Files:**
- `src/components/common/ScreenShell/ScreenShell.tsx:32-45` — `header` is a sibling of `body`, so it never scrolls
- `src/components/common/ScreenShell/ScreenShell.styles.ts:13-21`, `:35-37`
- `src/components/transactions/TransactionsView/TransactionsView.tsx:22-64` — toolbar, presets, search, `StaleBanner`, four summary cards **and** the scope note all sit *outside* the list
- `src/components/bookings/BookingsList/BookingsList.tsx:12-20` — filter tabs + `StaleBanner` outside the list
- `src/components/common/RefreshableList/RefreshableList.tsx:83-107` — the loading and error branches `return` before the `FlashList`
- `src/app/(app)/dashboard.tsx`, `transactions.tsx`, `notifications.tsx`, `settings.tsx`, `bookings/index.tsx`

Transactions is the worst case: on a phone the pinned block is the header, a
preset row, a search field, a 2×2 card grid and a note — the list gets what's
left. This is the "top portion stays, only the bottom scrolls" you saw.

**Fix approach (D1: only a slim icon row stays pinned)**

- `ScreenShell` splits its header in two. The **action row** (icons only) stays
  pinned inside the `SafeAreaView`. The **title group** (title + subtitle) becomes
  something the screen renders *inside* its own scroll container.
- `ScreenShell` gains a `scrollHeader` concept rather than each screen
  reinventing it: it passes the rendered title group down, so five screens cannot
  drift on typography or spacing.
- `RefreshableList` gains `header?: ReactElement`, rendered in **all four states**.
- Dashboard and Settings use a plain `ScrollView`, not `RefreshableList` — their
  title group goes in as the first child of the content container. **Different
  mechanism, same outcome; both must be done or the app is inconsistent
  screen-to-screen.**

**Trap 1 — `ListHeaderComponent` identity.** FlashList compares it by reference,
exactly as it does `ItemSeparatorComponent` — which this repo already learned the
hard way and documented at `RefreshableList.tsx:52-62` and in
`ezzy-vendor-mobile/AGENTS.md`. An inline `ListHeaderComponent={() => <Toolbar/>}`
remounts the whole header on every render, and the header on Transactions
**contains the search field**: the input would unmount mid-keystroke, dropping
focus and closing the keyboard on every character typed. `RefreshableList` must
therefore take an **element** and memoise the wrapper component itself, so no
screen can get this wrong from the outside.

**Trap 2 — the four-state contract.** `RefreshableList.tsx:83-107` returns early
for loading-and-empty and error-and-empty, *before* the `FlashList` exists. Put
the header only in `ListHeaderComponent` and the vendor loses the date presets
and filter chips in precisely those two states — when the thing they most need is
the control that would change the failing or empty query. The file's own comment
says it "owns the four states every data surface must have (plan §5.1) so no
screen can quietly ship only the populated one"; a header that vanishes in two of
four states breaks that contract. **The `header` element renders above the
centred view in those branches too.**

**Trap 3 — `contentPaddingTop`.** `BookingsList.tsx:24` passes
`contentPaddingTop={spacing.sm}` because the filter strip above the list already
provided separation. Once that strip moves *into* the header, the reasoning
inverts and the value has to be re-derived, not carried over. Its comment cites
`.plans/2026-07-31-vendor-mobile-filter-density.md` I0 and must be updated with
it.

**Verification:** device screenshots per screen. Machine checks cannot see any of
this — and Trap 1 in particular type-checks, lints and bundles perfectly while
making the search field unusable.

---

### B2 — Show-guide is a text button in the dashboard body; move it to the header as an icon  ✅ DONE via another plan (2026-08-15) · **D4 ✖ ABORTED — dashboard-only chosen instead**

**Files:**
- `src/components/dashboard/GuideCard/GuideCard.tsx:36-49` — the current in-body "Show guide" pressable
- `src/components/dashboard/GuideCard/useGuideCard.ts` — `hidden` state, local to this component
- `src/components/layout/SettingsAction/SettingsAction.tsx` — the pattern to follow
- All five tab screens, which each pass `action={<SettingsAction />}`

**Fix approach (D4: the icon appears on every tab screen)**

D4 has a consequence worth naming, because it is the whole design cost of this
item: **the guide's state can no longer live in `useGuideCard`.** A toggle in the
Transactions header and a card on the Dashboard are two components on two
different screens that must agree. Two `useGuideCard` instances would each hold
their own `hidden` and disagree the moment either is tapped.

So: lift it to `GuideProvider`, mounted in `src/app/(app)/_layout.tsx` alongside
`PushProvider`. That is this app's established pattern for cross-screen state —
`SessionGateProvider`, `SnackbarProvider` and `PushProvider` are all exactly this,
and inventing a second mechanism for the fourth case would be the wrong instinct.
`useGuideCard` becomes a thin consumer; the AsyncStorage read/write and the
`hidden: boolean | null` no-flash guard move into the provider **unchanged** —
that guard is load-bearing and is not to be "simplified" during the move.

- The header renders a `GuideAction` icon beside `SettingsAction`, on all five tab
  screens.
- Tapping it from a non-Dashboard tab must **navigate to Dashboard and show the
  card** — otherwise the control does nothing visible where it was tapped. This is
  the tradeoff D4's option named, and it needs a `router.navigate("/dashboard")`
  in the show path only (hiding from another tab needs no navigation, but is also
  unreachable, since the icon reflects state).
- Icon: lucide `Compass`, matching the guide card's own header glyph and the web
  portal's Show-guide button. Not a new glyph — the vendor should recognise it.
- The card keeps its in-card **Hide** button. Two ways to hide, one obvious way to
  bring it back.

**Accessibility:** 44pt target like `SettingsAction`; `accessibilityRole="button"`;
label "Show the getting-started guide" / "Hide the getting-started guide" tracking
state; `accessibilityState={{ expanded }}`. The icon must never be the sole
indicator — the label carries it.

**Verification:** device. Toggle from Transactions, confirm it lands on Dashboard
with the card open; toggle from Dashboard, confirm no navigation.

---

> ⚠️ **BUILT ON 2026-08-15 UNDER ANOTHER PLAN, TO A DIFFERENT DESIGN.**
>
> `.plans/2026-08-15-vendor-mobile-dashboard-parity-guide-and-insets.md` Stage 2
> (its I3/I5) implemented this feature. **This item was not consulted while that
> plan was written** — it should have been, and the miss is recorded here rather
> than quietly reconciled.
>
> **What matches this item exactly:** `Compass` glyph, 44pt target,
> `accessibilityRole="button"`, labels tracking state, `accessibilityState={{
> expanded }}`, the in-body "Show guide" row removed, the card keeping its own
> Hide.
>
> **What CONTRADICTS this item's D4:**
>
> | This item (D4, approved 2026-08-06) | What was built (2026-08-15 D5) |
> |---|---|
> | Icon on **all five tab screens** | **Dashboard only** |
> | State in a **`GuideProvider`** mounted in `(app)/_layout.tsx` | State in the **dashboard route file** |
> | Tapping from another tab navigates to Dashboard and shows the card | No cross-tab behaviour — unreachable by construction |
>
> Neither design is wrong; they answer "how far does the guide reach" differently,
> and **the 2026-08-15 plan resolved it without knowing this decision existed.**
> The route-level state is sufficient for dashboard-only and insufficient for the
> five-tab version — the provider is genuinely required there, exactly as this item
> argues.
>
> **✅ RESOLVED (2026-08-15) — the user chose to KEEP DASHBOARD-ONLY.**
>
> So **this item is DONE** as far as it will be taken, and **its D4 is ✖ ABORTED**:
> the icon does NOT go on all five tabs, the state does NOT move to a
> `GuideProvider`, and the navigate-to-Dashboard show path is not built. The
> 2026-08-15 D5 stands as the live decision.
>
> What that costs, stated so it is not rediscovered as a bug: a vendor sitting on
> Bookings or Transactions has no guide affordance in the header. They reach it by
> going to Dashboard, which is also where the guide's content is aimed. The
> five-tab version remains a strict superset if it is ever wanted — the built
> pieces (`GuideAction`, the removed in-body row, the lifted state) all survive
> that change.

---

### B3a — `platform_fee_settings` is unreadable from this app — add a scalar accessor  ⬜ TODO · **APPROVAL GATE**

**Files:** new `backbone/supabase/migrations/20260805000001_current_platform_fee_percent.sql`

**The finding (§4 — this corrects the literal reading of the request).**
`20260726000001_platform_fee_settings_rls_tighten.sql:32-45` narrowed SELECT on
that table to Command admins/root. It is a *corrective* migration whose header
says, in terms:

> "The vendor Transactions page does NOT read this table. It displays the per-row
> snapshot `booking_transactions.platform_fee_percent`, which is the whole point of
> the snapshot design."

So the mobile app cannot read the configured rate today, by deliberate design.
You chose the live global setting as the source anyway (D2) — recorded, and this
plan implements it.

**Design: a function, not a policy.** The obvious implementation — add a SELECT
policy for vendor users — is the wrong one, for two grounded reasons:

1. **The table is not just a number.** It also carries `updated_by` (the Command
   admin who last changed platform commission policy) and `updated_at`
   (`20260725000001:30-35`). A SELECT policy hands vendors both, plus any column
   added later. Vendors have no reason to know which Command staffer changed the
   platform's money policy or when.
2. **There is an established precedent for exactly this shape.**
   `get_booker_contacts` (`20260620000002`) exists because vendor-admins cannot
   select `profiles`; rather than widening `profiles` RLS, it is a `SECURITY
   DEFINER` function returning **only** the three permitted columns. Its header
   states the principle: "least-privilege… It returns ONLY full_name/email/phone,
   so internal profiles columns are never exposed. No profiles RLS policy is
   added." The same answer applies here, one column instead of three.

**Exact change (do not create until approved):**

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration — Current platform fee percentage accessor
--
-- Lets any authenticated client read the CONFIGURED global commission rate
-- without gaining access to platform_fee_settings itself. 20260726000001
-- narrowed SELECT on that table to Command admins/root, and that stays: the row
-- also carries updated_by/updated_at — which Command admin last changed platform
-- money policy, and when — which no vendor has a reason to see.
--
-- Least-privilege via SECURITY DEFINER, the same shape as get_booker_contacts
-- (20260620000002): expose the one value the caller legitimately needs, add no
-- RLS policy to the underlying table.
--
-- NOTE — corrects a now-stale comment. 20260726000001 says "the vendor portal
-- reads booking_transactions.platform_fee_percent instead, so no other role needs
-- access". That remains true of the vendor WEB portal and of every historical
-- figure in either client. It is no longer the whole picture: ezzy-vendor-mobile
-- shows the configured rate on its Transactions summary card, gated on agreeing
-- with the snapshots in view. Applied migrations are never edited (AGENTS.md), so
-- the correction lives here and in architecture/schema.md.
--
-- Must run after: 20260725000001 (platform_fee_settings)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.current_platform_fee_percent()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select fee_percent from public.platform_fee_settings where id = 1;
$$;

comment on function public.current_platform_fee_percent() is
  'The configured global commission percentage. Reads platform_fee_settings without exposing the row (updated_by/updated_at stay Command-only). Historical figures always come from the booking_transactions snapshot — this is the CURRENT setting, not the rate any past payment was charged.';

revoke all on function public.current_platform_fee_percent() from public;
grant execute on function public.current_platform_fee_percent() to authenticated, service_role;
```

**Blast radius:**

- **Data** — none. `stable`, read-only, no DDL against any table, no rows touched
  or validated. Nothing can fail on existing data.
- **Lock / performance** — `create or replace function` takes a brief lock on the
  function's catalog entry only; no table lock. The function itself is a
  primary-key lookup on a table that physically cannot hold more than one row
  (`id smallint check (id = 1)`).
- **Downstream** — new symbol, so nothing existing calls it. Types are
  hand-written in this repo, so no regeneration. Adds one round trip to the
  Transactions screen (B3b), issued in parallel with the totals query.
- **Reversibility** — `drop function public.current_platform_fee_percent();`. No
  data to restore.
- **Security** — `security definer` + `set search_path = public` (matching every
  other definer function here). Returns one scalar, takes no arguments, so there
  is no injection surface and nothing caller-supplied to scope. `revoke … from
  public` keeps `anon` out: an unauthenticated visitor cannot read the platform's
  commission rate.

**Verification:** apply locally, then `select public.current_platform_fee_percent();`
as an authenticated vendor user (expect the number) and as `anon` (expect
permission denied). Needs a live database — no machine check covers it.

---

### B3b — The Platform fees card shows an amount with no rate  ⬜ TODO

**Files:**
- `src/components/transactions/TransactionSummaryCards/TransactionSummaryCards.tsx:52-59` — the only card of the four with no `sub`
- `src/services/transactions.service.ts:149-158` — the totals query does **not** select `platform_fee_percent`
- `src/services/transactionTotals.ts:14-54` — the pure, unit-tested reduction
- `src/services/transactionTotals.test.ts`
- `src/hooks/useTransactionsQuery.ts` / `useTransactionsView.ts` — where the new query is wired

**Fix approach (implements the rule from §0.1)**

1. Add `platform_fee_percent` to the totals `select` at `:151`. It is currently
   absent — the list query selects it (`:47`) but the totals query does not, so
   there is nothing to compare against today.
2. `TotalsRow` gains `platform_fee_percent: number`; `sumTransactionTotals` tracks
   `feePercentMin` / `feePercentMax` across **payable rows only** — the same
   denominator as every other figure it returns, or the card's rate and its money
   would describe different row sets. `Number(...)` on the way in, as the existing
   reducer already does for the money columns (`numeric` can arrive as a string).
3. A new query for `current_platform_fee_percent()`, fired alongside the totals.
   Its own cache key; a failure must **not** break the card — the money is the
   point and the rate is an annotation, so an error yields no sub-label rather
   than an error state.
4. Sub-label shown iff `feePercentMin === feePercentMax === configuredRate` and
   `payableCount > 0`. Copy: `` `${fmtPercent(rate)} of each booking` ``.

**Under-specification guard.** "Show the percentage" would be satisfied by
printing the global rate unconditionally — that passes every check in this
document and is wrong for the reason in §0.1. The gate is the item, not the
label.

**Component separation:** `TransactionSummaryCards` stays a pure display
component (it has no state and no hook today, and gains neither); the new value
arrives as a prop from `useTransactionsView`. All comparison logic lives in
`transactionTotals.ts`, which has no React import and is unit-testable.

**Verification:** `npm test` for the reducer (equal rates, mixed rates, zero
payable rows, string-typed numerics). The card itself needs a device, and the
mixed-rate branch needs seeded data at two different rates to see at all.

---

## IMPORTANT

### I1 — `numeric(5,2)` may render as "12.00%"  ⬜ TODO

**File:** `src/components/transactions/TransactionListItem/TransactionListItem.tsx:68`

```tsx
Fee ({transaction.platformFeePercent}%)
```

Raw interpolation. `platform_fee_percent` is `numeric(5,2)`, and PostgREST can
return `numeric` as a JSON string — in which case this already renders
`Fee (12.00%)` today. **Unverified either way**, and the honest position is that I
have not seen the running value; asserting it would be guessing.

It matters now because B3b puts a second percentage on the *same screen*. If the
card says `12%` and the rows say `12.00%`, one screen formats one value two ways.

**Fix approach:** add `fmtPercent` to `lib/format.ts` — `Number()`, strip trailing
zeros, append `%` — and use it in both places. `lib/format.ts` already has unit
tests (`format.test.ts`), so this arrives covered.

**Verification:** unit test; then a device screenshot to confirm which of the two
renderings was happening before.

### I2 — `StaleBanner` will scroll out of view  ⬜ TODO

**Files:** `TransactionsView.tsx:50-54`, `BookingsList.tsx:16-19`

`StaleBanner` warns that data on screen is old. B1 moves it into the scrolling
header, so it can be scrolled away.

**Judgement — keep it scrolling, and this is deliberate.** Pinning it would
rebuild exactly the fixed block B1 exists to remove, and it is an *annotation on
the data below it*, not an error requiring action — it belongs adjacent to what it
describes. Recorded as an item rather than left silent so that if it reads wrong on
device, the reasoning is here to argue with.

**Verification:** device, with the app backgrounded long enough to trigger it.

### I3 — Documentation  🔄 IN PROGRESS

Requested explicitly, and one part of it is **forced** by B3a rather than optional.

Partly executed 2026-08-07 during a workspace-wide documentation audit — the rows that
document **shipped** behaviour are done; the rows that document B2/B3a/B3b cannot be
written until those are built.

| Doc | Change | State |
|---|---|---|
| `architecture/schema.md:54-56`, `:659` | Add `20260805000001` to the migration table. In the `platform_fee_settings` section, record that the configured rate is now reachable by any authenticated client through `current_platform_fee_percent()` while the table itself stays Command-only — **the section currently implies the value is Command-only, which stops being true** | ⬜ TODO — **blocked on B3a**; that migration does not exist yet, so there is nothing to document |
| `architecture/portals.md` mobile section | Mobile Screen Inventory + behaviours: the pinned-action-row scroll model, Show-guide as a header action on every tab, and the fee rate on the Transactions card with its agreement gate | 🔄 **Scroll model done (2026-08-07)** — added as a non-obvious behaviour, with the "a screen that omits `<ScreenTitle />` silently loses its title" trap; the Screen Inventory now also carries the guide card, the booking span and the action-info sheet. Show-guide-as-header-action and the fee rate are **not** documented because they are **not built** (B2, B3b) |
| `ezzy-vendor-mobile/AGENTS.md` → Traps | Add the `ListHeaderComponent` identity trap (B1 Trap 1). It belongs beside the existing `ItemSeparatorComponent` and `gap`-is-inert entries — same library, same class of bug, and this one silently breaks a text input | ✅ **DONE (2026-08-07)** — added, together with the `TAB_BAR_HEIGHT` rationale and the `<ScreenTitle />` rule. Verified by `grep -n "ListHeaderComponent" AGENTS.md`. The same three also landed in `architecture/conventions.md` → "Layout traps" and "Component conventions — RN variant", which had none of them |
| `ezzy-vendor-mobile/AGENTS.md` → Current state | Note this plan alongside the other post-build-out polish plans | ✅ **DONE (2026-08-07)** — recorded with its real status (B1 coded and unverified; B2/B3a/B3b/I2 not started) rather than as complete |

**Why the schema.md entry is not optional:** `20260726000001`'s comment asserts
"no other role needs access". Applied migrations are never edited (an Invariant),
so the correction has to live somewhere a reader will find it. B3a's header
carries it; `schema.md` is where someone actually looks.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. -->

- **D1 — What stays pinned.** → **Only a slim icon row** (resolved 2026-08-05) —
  title, subtitle, toolbar, filter chips and summary cards all scroll; Settings and
  Show-guide stay. Maximum content, and it is the literal reading of "everything
  except the top menus".
- **D2 — Source of the fee percentage.** → **The live global setting**
  (resolved 2026-08-05). I recommended the per-transaction snapshot on the grounds
  that it needs no schema change and is what the vendor was actually charged; you
  chose the configured value and that is what this plan builds. B3a keeps the cost
  to a single read-only scalar function rather than the RLS widening the option
  described — same outcome, far smaller surface.
- **D3 — Mixed rates in a range.** → **Show the rate only when unambiguous**
  (resolved 2026-08-05) — reconciled with D2 in §0.1; the gate became "every
  payable row agrees with the configured rate" rather than "rows agree with each
  other".
- **D4 — Where the Show-guide icon appears.** → **Every tab screen**
  (resolved 2026-08-05) — consistent header across tabs; the cost is that guide
  state moves to a provider (B2) and that showing from another tab navigates to
  Dashboard.

No open decisions.

---

## DEFERRED / COSMETIC

- **A collapsing/animated header.** Reanimated could shrink the title on scroll
  instead of scrolling it away. Rejected for now: it needs a scroll-position
  driver on five screens with two different scroll containers, to buy an effect
  nobody asked for. The static split satisfies the request.
- **Removing the guide card's in-card Hide button** now that the header toggles it.
  Kept — hiding is more discoverable in-place, and the header icon is the way back.
- **Showing the fee rate on the Dashboard's payout tile.** Same rule would apply,
  but the tile shows one month of net payout and the rate is not what a vendor
  reads it for. Out of scope for the request.

---

## Execution order

Five stages. **One stage at a time by default** (`developerboss`) — say so if you
want a range in one pass.

1. 🔄 **B1** — the scroll model. Largest visual change, touches ~~all five screens~~
   **six** screens and `RefreshableList`, depends on nothing. Device-verify before
   anything is built on top of the new header shape. *(Coded 2026-08-06; the sixth
   is `bookings/[id]` — see B1.)*
2. **B2** — Show-guide icon and the `GuideProvider` lift. Depends on B1: it renders
   into the pinned action row B1 creates.
3. **B3a** — the migration. **Approval gate — nothing is written until you say go.**
   Independent of stages 1–2, so it can move in parallel if you approve it early.
4. **B3b + I1** — the fee rate on the card and the shared percentage formatter.
   Depends on B3a for the RPC. I1 is grouped here because it is the same screen and
   the same screenshot.
5. **I2 + I3** — the `StaleBanner` judgement call confirmed on device, then the
   documentation. Docs last, deliberately: they should describe what shipped, not
   what was planned.

---

## Verification

**Machine-verifiable** (after every stage; all clean today, so any output is a
regression from this work):

- `ezzy-vendor-mobile/node_modules/.bin/tsc --noEmit --project ezzy-vendor-mobile/tsconfig.json`
- `npm --prefix ezzy-vendor-mobile run lint`
- `npm --prefix ezzy-vendor-mobile test` — covers B3b's reducer and I1's formatter
- `npx expo export --platform android`, then delete `dist/`

**Needs a live environment:**

| Item | Check |
|---|---|
| B1 | Every tab screen scrolled — title scrolls away, icon row stays. **Type in the Transactions search field**: if the keyboard closes after one character, Trap 1 was not avoided |
| B1 | Force an error and an empty state on Bookings and Transactions — the filter chips and date presets must still be there |
| B2 | Toggle from Transactions → lands on Dashboard with the card shown; toggle from Dashboard → no navigation |
| B3a | Apply locally; `select public.current_platform_fee_percent()` as a vendor user (number) and as `anon` (denied) |
| B3b | Card shows `12% of each booking`; then seed two payments at different rates and confirm the sub-label **disappears** |
| I1 | Card and list rows format the percentage identically |
| I2 | Background the app long enough for `StaleBanner`, then judge whether scrolling it away reads wrong |

**Platform caveat, unchanged:** verification will be **Android only**. Nothing in
this app has ever been verified on iOS (no paid Apple Developer account —
`IOS-BUILD.md`, plan B9). Say Android when marking anything done.

---

## Component separation compliance

Required by the plan-authoring flow (step 4), per component:

| Component | Render layer | Hook | Styles |
|---|---|---|---|
| `ScreenShell` | stays pure display — the split into pinned row + scrollable title group is structural, adds no state | none, still | `.styles.ts` — `header` splits into `actionRow` and `titleGroup` |
| `RefreshableList` | pure render; the new `header` element is memoised **inside** it so callers cannot break identity | `useRefreshableList` unchanged | `.styles.ts` unchanged |
| `GuideAction` (new) | pure display — `onPress` + `expanded` in, icon out | none; state comes from `GuideProvider`, matching `SettingsAction` which also has no hook | `GuideAction.styles.ts` with `makeStyles(tokens)` |
| `GuideProvider` (new) | provider module, not a component with UI — mirrors `PushProvider` | owns the AsyncStorage read/write and `hidden: boolean \| null` moved intact from `useGuideCard` | none |
| `GuideCard` | unchanged except that `useGuideCard` now consumes the provider | `useGuideCard.ts` becomes a thin consumer | unchanged |
| `TransactionSummaryCards` | stays pure display; the rate arrives as a prop | none, still | unchanged |
| `TransactionsView` / `BookingsList` | render layers only — the header element is assembled here from existing pieces | existing hooks gain the fee query wiring | unchanged |
| `transactionTotals.ts` | pure module, no React — where the agreement gate lives so it can be unit-tested | — | — |
