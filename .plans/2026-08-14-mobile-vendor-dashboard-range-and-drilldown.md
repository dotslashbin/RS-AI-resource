# Ezzy Vendor Mobile — dashboard date filter + widget drill-down

**Date:** 2026-08-14
**App / scope:** `ezzy-vendor-mobile/` only. No backbone migration, no web apps.
**Status:** DRAFT — investigation done, **5 decisions OPEN**. Not executable until they are resolved (§7 gate).

> Bring the vendor web dashboard's period filter and clickable widgets to mobile.
> Optimise for **the mobile app's own idioms** — React Query, expo-router params,
> server-side counts — rather than transliterating a web design that solved
> different problems.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision; numbers are
> plan-local — qualify cross-plan refs by app (e.g. "vendor I7").

---

## Read this first (written for a cold session)

The web plan this ports from is
`.plans/2026-08-12-vendor-dashboard-range-and-drilldown.md` (**COMPLETE**, all 8
stages). Read its "Read this first" for the *product* intent. Do **not** copy its
implementation: six facts make mobile a different problem, and four of them make
it easier.

1. **Mobile has a REAL ROUTER.** `expo-router` with a `Tabs` layout
   (`src/app/(app)/_layout.tsx:52-104`), and `useLocalSearchParams` is already
   used in two places (`useBookingDetail.ts:14`, `useResetPasswordForm.ts:18`).
   The web plan's entire "shell state + URL mirror" apparatus (its D1, its
   `PageIntent`, its one-shot `arrival`) **exists to work around having no
   router**. Mobile does not need any of it — a drill-down is
   `router.push({ pathname, params })` and the destination reads
   `useLocalSearchParams`. Do not port `PageIntent`.

2. **Mobile uses TanStack Query, not hand-rolled state.** Every fetch goes
   through `useQuery`/`useInfiniteQuery` with persisted keys
   (`lib/queryClient.ts` `PERSISTED_KEYS`). **A date range must therefore become
   part of the query key**, or a cached page from one period is served for
   another. This is the single most likely way to get this wrong.

3. **Dashboard counts are already server-side aggregates.**
   `dashboard.service.ts:28-42` uses `.select("id", { count: "exact", head: true })`
   — no rows are transferred. Adding a date range is cheap and correct here, quite
   unlike web, where the shell holds every booking in memory and the web plan was
   forced into client-side filtering (its D4).

4. **Bookings are already server-side paginated AND status-filtered.**
   `bookings.service.ts:110-133` — `.range(from, to)`, `.in("status", statuses)`,
   via `useInfiniteQuery`. A date range is a query change here, **not** a
   client-side filter. The opposite of the web decision, and correct for the same
   reason: mobile never holds the whole set.

5. **Transactions ALREADY has a date-window control — but it is PRESET-ONLY.**
   `useTransactionsQuery.ts:14-32`: `WindowPreset = "this-month" | "last-3-months"
   | "last-12-months"`, converted to a `DateWindow` by `windowFor()`. There is no
   custom from/to anywhere in the app, and **no date-picker dependency exists**
   (checked `package.json` — no `@react-native-community/datetimepicker`, no
   `date-fns`, no calendar library). React Native has no `<input type="date">`, so
   the web control's zero-cost calendar does **not** transfer (→ D1).

6. **The stat cards are deliberately NOT pressable, by a recorded decision.**
   `StatCard.tsx:29-30` says so and names it: *"summary tiles, so there is no
   Pressable, no press state and no `button` role (plan D4-a). If they ever gain a
   destination, that is a behaviour change."* The decision is
   `.plans/2026-07-29-vendor-mobile-styling-branding.md:289-294` (→ D2).

---

## Findings

| # | Finding | Location |
|---|---------|----------|
| F1 | `getDashboardStats(vendorId)` takes **no range**. Three of four figures are already period-scoped internally by `phCurrentMonthRange()`; `todaysBookings` is scoped to `phToday()`. Parameterising it is a signature change plus a query-key change, not a rewrite. | `dashboard.service.ts:89-107` |
| F2 | ⚠️ **`getMonthlyRevenue` is UNBOUNDED** — `.select("payout_amount, payout_status")` with no `.range()` and no ceiling, so PostgREST's 1000-row cap truncates it silently. This is already filed as **mobile B1** in `.plans/2026-08-11-mobile-vendor-unbounded-queries.md` (DRAFT, not started). **This plan makes it worse**: a "12 months" or "this year" range multiplies the row count. Hard coupling — see Couplings. | `dashboard.service.ts:62-67` |
| F3 | Mobile has **4 flat cards**, web now has **7 in two labelled groups** (Operations / Earnings). Mobile has no `DashboardSection` equivalent and no Gross/Fee/Net/Payout split — it has one "Monthly Revenue" card. A 1:1 port is therefore not possible; the scope of *how much* web dashboard to bring across is a decision (→ D4). | `DashboardView.tsx:66-108` |
| F4 | Mobile's revenue is computed on the **payable-only** basis (`isPayable`, `dashboard.service.ts:76-77`) — the same basis as the *web Transactions page*, NOT the web dashboard's non-reversed basis. So mobile's "Monthly Revenue" already agrees with a Transactions drill-down. **Web's I7 label collision does not exist here**, and must not be imported by copying web's wording. | `dashboard.service.ts:74-78` vs `vendor/lib/financials.ts:20-27` |
| F5 | Two cards carry **period-bearing names**: "Completed This Month" and "Monthly Revenue" (`sub={stats?.monthLabel}`). Web deliberately renamed these to period-neutral ("Completed") once the range became selectable, because a card whose name says "This Month" under a control set to "Today" contradicts itself. Same fix needed here. | `DashboardView.tsx:87,96` |
| F6 | `phCurrentMonthRange()` and `phToday()` are the ONLY PH range helpers in mobile (`lib/format.ts:133,139`). Web's `phDayRange`, `phWeekRange`, `phLastNDays`, `phYearRange`, `previousPeriod`, `isWholeMonth` have no mobile equivalents. `windowFor()` open-codes the 3-month and 12-month maths inline. | `lib/format.ts`; `useTransactionsQuery.ts:24-32` |
| F7 | **Tabs stay mounted.** `useBookingsQuery.ts:22-31` documents it: *"expo-router keeps tabs mounted once visited"*. Web's one-shot arrival mechanism relied on the destination REMOUNTING on every navigation — that assumption is **false on mobile**. Params pushed to an already-mounted tab must be consumed by an effect keyed on the param value, not by a `useState` initialiser. Getting this wrong means the filter applies the first time and silently does nothing thereafter. | `useBookingsQuery.ts:27`; `(app)/_layout.tsx` |
| F8 | The bookings filter strip is explicitly a **constrained resource**: *"the strip is the constrained resource. Add a secondary control within the group instead."* A date filter must NOT become a seventh chip. | `lib/bookingFilters.ts:16-20` |
| F9 | `WINDOW_PRESETS` has a documented refusal: *"No 'all time' preset: an unbounded window is exactly what D9 avoids."* Any preset set this plan introduces must stay bounded — web's "All dates" clear on Bookings cannot be ported as-is. | `useTransactionsQuery.ts:22-23` |

---

## BLOCKERS

### B1 — `getDashboardStats` cannot be scoped to a period  ⬜ TODO
**File:** `src/services/dashboard.service.ts:89-107`

Takes only `vendorId`; the month is resolved *inside* via `phCurrentMonthRange()`.
Nothing can select a different period.

**Fix approach:** `getDashboardStats(vendorId, window: DateWindow)`. Apply the
window to `completedThisMonth` (already `booked_date` bounded) and to
`getMonthlyRevenue` (already takes from/to). **Leave `pendingApprovals` and
`todaysBookings` unscoped** — the same correctness rule as web's I3: pending is a
live queue and hiding out-of-range work is a bug, and "today" is today by
definition. Return the window in the payload so labels cannot drift from the data.

**Query key:** `["dashboard-stats", vendorId, window.from, window.to]` — see F-note
in "Read this first" §2. Omitting this serves a cached month's numbers for a
different period.

**Verification:** machine (type-check) + device — change the period, confirm
Completed and Revenue move while Pending and Today's do not.

---

### B2 — There is no date-range control, and no picker to build one from  ⬜ TODO
**Files:** none yet; nearest prior art `useTransactionsQuery.ts:14-32`

React Native has no native date input, mobile has **no** date-picker dependency,
and the only existing period UI is a three-value preset. Whatever D1 resolves to,
this is the largest single piece of work in the plan.

**Fix approach:** blocked on **D1**. If presets-only, this is a shared chip strip
component reusing the `BookingFilterTabs` visual language. If custom ranges, it is
that **plus** a picker dependency (approval gate) **plus** the two-field
from/to UI **plus** migrating `useTransactionsQuery` off `WindowPreset` state onto
`DateWindow` state.

**Component separation** (mobile override — no CSS modules): a `.tsx` render
layer, a `makeStyles(tokens)` `.styles.ts`, and a companion hook **only if** it
holds state. A fully controlled chip strip is a pure display component and ships
as `.tsx` + `.styles.ts` only, matching `StatCard`.

---

### B3 — Stat cards have no press target  ⬜ TODO
**File:** `src/components/dashboard/StatCard/StatCard.tsx:29-30`

No `Pressable`, no press state, no `accessibilityRole="button"` — by decision
D4-a. Blocked on **D2**.

**Fix approach (if D2 approves):** optional `onPress` + `accessibilityHint` naming
the destination. When absent the card renders exactly as today. Use `Pressable`
with a pressed style from `tokens`, and **respect the 44×44pt minimum touch
target** — see `.claude/skills/mobile-dev/SKILL.md`, which the nested `AGENTS.md`
requires reading before any mobile feature work.

⚠️ Card contains no other interactive element today; keep it that way, or nested
pressables will swallow taps.

**Verification:** device — tap each card, and check TalkBack/VoiceOver announces
the destination.

---

### B4 — Bookings cannot be filtered by date  ⬜ TODO
**Files:** `src/services/bookings.service.ts:110-133`;
`src/hooks/useBookingsQuery.ts:40-50` (key), `:79+` (hook)

The list filters by status server-side and pages with `.range()`, but has no date
bounds — so a drill-down from "Completed" cannot narrow to the period the widget
counted.

**Fix approach:** add an optional `DateWindow` to `getBookingsPage`, applied as
`.gte("booked_date", from).lte("booked_date", to)`. `booked_date` is a `date`
column, so no timestamptz boundary problem — unlike the transactions path, which
needs `nextDay()` (`dashboard.service.ts:83-87`). **Extend `bookingsQueryKey` with
the window**; the key currently joins only statuses (`:40-50`) and the invalidation
prefix `["bookings", vendorId]` must stay intact.

⚠️ The chip-strip **badge counts must stay unfiltered** (web B4's rule) — a badge
that hides out-of-range work under-reports what the vendor must do. Check whether
`countBookingsWithStatuses` (`bookings.service.ts:157-171`) feeds them and leave
it unscoped.

**Verification:** device — drill in from Completed, confirm the list matches the
widget's number.

---

## IMPORTANT

### I1 — Period-bearing card names contradict a selectable period  ⬜ TODO
**File:** `src/components/dashboard/DashboardView.tsx:87,96`

"Completed This Month" and "Monthly Revenue" are fixed-period names. With a
control set to anything else they state a period the number does not cover.

**Fix approach:** rename to "Completed" and "Revenue"; the sub-label carries the
period (already does — `stats?.monthLabel`, which becomes a range label). Exactly
web's I5/I7 fix.

### I2 — Consuming params on an already-mounted tab  ⬜ TODO
**Files:** destination screens; `(app)/_layout.tsx`

Per F7, tabs stay mounted, so a `useState` initialiser reading params runs **once
ever**. Web could use one because its shell remounts pages; mobile cannot.

**Fix approach:** consume params in an effect keyed on the param values, and clear
them (`router.setParams({...: undefined })`) after applying, so returning to the
tab by its own icon does not silently re-apply a stale filter. This is the mobile
equivalent of web's one-shot rule and is the item most likely to be implemented
subtly wrong.

**Verification:** device — drill in, change the filter on the destination, switch
tabs away and back, confirm the changed filter survives and the old one does not
return.

### I3 — Stale-data banner and offline persistence must follow the period  ⬜ TODO
**Files:** `StaleBanner` usage `DashboardView.tsx:50-54`; `lib/queryClient.ts` `PERSISTED_KEYS`

`dataUpdatedAt` comes from the stats query. Once the key includes the window,
switching periods yields a *different* cache entry with its own `dataUpdatedAt` —
so the banner may read "updated just now" for a period never fetched, or flash
stale for one that is fine.

**Fix approach:** confirm the banner reads the *active* query's metadata after the
key change, and decide whether every period should persist offline or only the
default (persisting twelve windows bloats AsyncStorage). Small, but it is the kind
of thing that looks fine in the simulator and is wrong on a plane.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains — plan-authoring §7. -->

- **OPEN: D1 — preset chips, or a real calendar range picker?** The headline
  decision; B2 and most of the scope hang off it.
  - **(a) Presets only** ⭐ **Recommended for the first pass.** Extend the existing
    `WindowPreset` model to the dashboard and Bookings. No new dependency, matches
    the one period idiom the app already has (F5), and keeps every window bounded
    per F9. Cost: no arbitrary from/to, so it is **not** feature-parity with web's
    calendar control — which is what was literally asked for.
  - **(b) Custom range with a picker.** True parity. Requires
    `@react-native-community/datetimepicker` (**approval gate — new dependency**,
    installed via `npx expo install`), a two-field UI, and migrating
    `useTransactionsQuery` from `WindowPreset` state to `DateWindow` state so a
    carried custom range can even be represented on the destination. Roughly
    double the work of (a).
  - **(c) Presets now, custom later** — ship (a), keep `DateWindow` as the type
    everything passes around (never `WindowPreset`), so (b) becomes an additive
    UI change rather than a refactor.

  Recommendation: **(c)** — it is (a)'s cost with (b)'s escape hatch, and it is
  the only option that does not force a decision about the picker today.

- **OPEN: D2 — may the stat cards become pressable, against D4-a?**
  D4-a (`2026-07-29-vendor-mobile-styling-branding.md:289-294`) forbids a pressable
  affordance **"without a press target"** — calling it "the affordance-lie
  `ux-design` prohibits". This plan supplies a real target, which removes the
  premise rather than contradicting the rule. Recommendation: **approve**, and
  record it as D4-a's condition being met, not overturned. If declined, the
  drill-down needs a different affordance (an explicit "View all →" link per card,
  as the pending section already uses at `DashboardView.tsx:118-127`).

- **OPEN: D3 — which preset set?** Web uses five (Today / Last 7 days / This month
  / Last 30 days / This year); mobile's transactions use three (This month /
  3 months / 12 months) and are documented as bounded-on-purpose (F9).
  Recommendation: **one shared set across mobile's dashboard, Bookings and
  Transactions** — divergent period vocabularies across three screens of one app
  is worse than either set. Exact membership to be agreed; note that changing
  Transactions' set changes an existing screen's behaviour.

- **OPEN: D4 — how much of the web dashboard comes across?** Mobile has 4 flat
  cards; web has 7 in two labelled groups with a Gross/Fee/Net/Payout split (F3).
  - **(a) Filter + drill-down only** ⭐ **Recommended.** Keep the 4 cards, add the
    period control and press targets. Matches the literal request.
  - **(b) Also port the Operations/Earnings grouping and the 4-way money split.**
    Much larger, needs the financials basis work (`vendor/lib/financials.ts`)
    ported, and would change what the app's main screen *is*.

- **OPEN: D5 — order against the mobile truncation plan.** F2: `getMonthlyRevenue`
  is unbounded and this plan lets a vendor select a 12-month window over it.
  Recommendation: **fix `.plans/2026-08-11-mobile-vendor-unbounded-queries.md` B1
  FIRST**, as its own change, then start here. Shipping this first knowingly
  widens a silent-truncation bug — the exact failure family this workspace has
  now fixed four times.

---

## Couplings

- **Hard, blocking:** mobile **B1** of
  `.plans/2026-08-11-mobile-vendor-unbounded-queries.md` (unbounded
  `getMonthlyRevenue`). Wider windows make it worse. See D5. Record the coupling on
  that plan's B1 too when this one is approved.
- **Soft, informational:** `vendor` is now the reference implementation. The two
  apps are **separate git repos with no shared build** — every helper is copied,
  never imported (`lib/bookingFilters.ts:1-11` says so explicitly and asks that
  web and mobile be edited in the same change). Expect divergence and prefer
  mobile idioms where they conflict; do not import web's `PageIntent` or its URL
  mirror.

---

## Component inventory

Mobile overrides the web component rules: **no CSS modules** — styling lives in a
co-located `makeStyles(tokens)` `.styles.ts`. The render/hook split and the
no-inline-styles rule still apply.

| Component | Change | Separation |
|-----------|--------|------------|
| **NEW** `common/PeriodFilter/` | The shared period control. `.tsx` + `.styles.ts`; **no hook** if fully controlled (state lives in each screen's hook), matching `StatCard`. | Pure display. Reuse `BookingFilterTabs`' chip language rather than inventing a second one. |
| **NEW** `lib/dateWindows.ts` + `.test.ts` | Preset table, `windowFor`, range labels, param parse/serialise. | Not a component. `lib/` because it must be unit-testable — the app already tests `transactionTotals.ts`, `bookingErrors.ts`, `vendorMapping.ts` there. |
| `dashboard/StatCard/StatCard.tsx` | Optional `onPress` + `accessibilityHint`; `Pressable` root when supplied (B3, D2). | Stays pure display — handler passed in. Pressed state via tokens, not inline. |
| `dashboard/DashboardView/{useDashboardView,DashboardView}.ts(x)` | Hold the window; pass it to the query; wire press targets; rename the two period-bearing cards (I1). | Hook keeps state + navigation callbacks, as it already does for `openBooking`. |
| `services/dashboard.service.ts` | `getDashboardStats(vendorId, window)` (B1). | — |
| `services/bookings.service.ts`, `hooks/useBookingsQuery.ts` | Optional window + **query key** (B4). | — |
| `hooks/useTransactionsQuery.ts` | Accept a `DateWindow` rather than a `WindowPreset` (D1c), so a carried window is representable. | — |
| `app/(app)/bookings/index.tsx`, `transactions.tsx` | Read + clear params (I2). | Route files stay thin, as they are now. |

---

## Execution order

Nothing may start until D1–D5 are resolved, and D5 likely puts the truncation fix
first. Provisional order:

1. **`lib/dateWindows.ts` + tests** — pure, no UI, no behaviour change.
2. **`PeriodFilter` component** — rendered nowhere yet.
3. **Dashboard reads the window** — B1 + I1 + I3 (service, query key, labels).
4. **Stat cards gain press targets** — B3, pending D2.
5. **Bookings destination** — B4 + I2.
6. **Transactions destination** — D1(c) type change + I2.
7. **Device pass** — see Verification.

---

## Verification

**Machine-verifiable:** `npx tsc --noEmit`; `npm test` for `lib/dateWindows.test.ts`;
lint on changed files only (do not widen any existing backlog).

**Needs a device — and this app has no visual-regression suite**, unlike web. There
is no `/ui-gallery` and no Playwright baseline here, so *everything* visual is a
human check. Per the nested `AGENTS.md`, Android is the verifiable target and iOS
has historically been unverifiable in this workspace.

- Period control changes Completed and Revenue; **Pending and Today's do not move**
  (the B1 correctness rule).
- Each card's drill-down lands on the right screen with the period applied and
  **visible**, not silently.
- Chip badge counts stay unfiltered with a period set (B4).
- Switch tabs away and back: the destination keeps the filter *it* has, and the
  dashboard's period is not re-applied (I2 — the failure this plan is most likely
  to ship).
- Touch targets ≥ 44×44pt; screen reader announces each card's destination.
- Offline cold open still restores the default period (I3).
- A vendor with >1000 transactions in a 12-month window still reports honestly
  (blocked on the D5 coupling).

---

## Context / provenance

- Ports `.plans/2026-08-12-vendor-dashboard-range-and-drilldown.md` (vendor,
  COMPLETE 2026-08-14). Read it for product intent; ignore its D1/`PageIntent`
  machinery, which exists only because web has no router.
- The divergence this closes was recorded in advance as **C4** of
  `.plans/2026-08-11-mobile-vendor-unbounded-queries.md`.
- Web's **I7** (a label collision between two money bases) **does not apply here** —
  mobile already uses the payable-only basis on both surfaces (F4). Do not import
  the fix for a problem this app does not have.
