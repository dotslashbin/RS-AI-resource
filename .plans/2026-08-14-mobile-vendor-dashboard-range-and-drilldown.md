# Ezzy Vendor Mobile — dashboard date filter + widget drill-down

**Date:** 2026-08-14
**App / scope:** `ezzy-vendor-mobile/` only. No backbone migration, no web apps.
**Status:** IN PROGRESS — all decisions resolved 2026-08-14 (D1–D5 plus D6, D7).
**Stage 0 code complete** (the D5 prerequisite: its live >1000-row check is still
outstanding and carried as debt on
`.plans/2026-08-11-mobile-vendor-unbounded-queries.md`). **Stages 1–3 done
2026-08-14** (1 and 2 ✅ verified; **3 🔄 code complete, machine-verified only**).
The dashboard now has a working period control on paper — **nothing has been seen
on a device**, and that debt now spans three stages. Stage 4 (press targets) next.

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
   custom from/to anywhere in the app. React Native has no `<input type="date">`, so
   the web control's zero-cost calendar does **not** transfer.
   ⚠️ **This bullet originally said no date-picker dependency exists — that was
   wrong; see F10.** `@expo/ui` is installed and ships a native `DatePicker`. D1 was
   still resolved to presets, but on the real costs, not on a phantom dependency
   gate. `@react-native-community/datetimepicker` and `date-fns` are genuinely
   absent.

6. **The stat cards are deliberately NOT pressable, by a recorded decision.**
   `StatCard.tsx:29-30` says so and names it: *"summary tiles, so there is no
   Pressable, no press state and no `button` role (plan D4-a). If they ever gain a
   destination, that is a behaviour change."* The decision is
   `.plans/2026-07-29-vendor-mobile-styling-branding.md:289-294` (→ D2).

---

## Scope guard — this work is confined to `ezzy-vendor-mobile/`

Verified 2026-08-14 by reading every file the plan touches. Nothing here requires
a change outside this app:

- **No `backbone/` change.** Both filters use columns that already exist and are
  already queried: `bookings.booked_date` (a `date`) and
  `booking_transactions.created_at` (a `timestamptz`, already handled via
  `nextDay()` at `dashboard.service.ts:83-87`). No migration, no RLS change, no
  new grant.
- **No `vendor/`, `booker/` or `command/` change.** This is a port *from* web, not
  a synchronised edit *with* it.
- **`lib/bookingFilters.ts` is NOT modified.** That file asks for web and mobile to
  be edited in the same change (`:1-11`), which would make this cross-app. The
  period control is a **separate strip** (D6), so `BOOKING_FILTERS`,
  `BADGED_FILTERS` and `statusesForFilter` are untouched and the twin-edit rule is
  never triggered.
- **Accepted divergence:** mobile's preset vocabulary (D3) is deliberately not
  web's five. Recorded here so a later reader does not "fix" it into a cross-app
  change. Mobile's revenue basis already diverges the same way (F4).

Everything this plan writes lives under `ezzy-vendor-mobile/src/`. Commits are made
from inside that folder — it is its own git repository.

---

## Findings

| # | Finding | Location |
|---|---------|----------|
| F1 | `getDashboardStats(vendorId)` takes **no range**. Three of four figures are already period-scoped internally by `phCurrentMonthRange()`; `todaysBookings` is scoped to `phToday()`. Parameterising it is a signature change plus a query-key change, not a rewrite. | `dashboard.service.ts:89-107` |
| F2 | 🔄 **RESOLVED IN STAGE 0 (2026-08-14)** — `getMonthlyRevenue` is now bounded by `TOTALS_MAX_ROWS` with `count: "exact"`, a deterministic `created_at desc` order, and a `revenueComplete` flag surfaced on the dashboard; machine-verified, live check outstanding. The reduction was also de-duplicated onto `sumTransactionTotals`, so a window change here no longer touches a second copy of the payable rule. Original finding follows. ⚠️ **`getMonthlyRevenue` is UNBOUNDED** — `.select("payout_amount, payout_status")` with no `.range()` and no ceiling, so PostgREST's 1000-row cap truncates it silently. This is already filed as **mobile B1** in `.plans/2026-08-11-mobile-vendor-unbounded-queries.md` (DRAFT, not started). **This plan makes it worse**: a "12 months" or "this year" range multiplies the row count. Hard coupling — see Couplings. | `dashboard.service.ts:62-67` |
| F3 | Mobile has **4 flat cards**, web now has **7 in two labelled groups** (Operations / Earnings). Mobile has no `DashboardSection` equivalent and no Gross/Fee/Net/Payout split — it has one "Monthly Revenue" card. A 1:1 port is therefore not possible; the scope of *how much* web dashboard to bring across is a decision (→ D4). | `DashboardView.tsx:66-108` |
| F4 | Mobile's revenue is computed on the **payable-only** basis (`isPayable`, `dashboard.service.ts:76-77`) — the same basis as the *web Transactions page*, NOT the web dashboard's non-reversed basis. So mobile's "Monthly Revenue" already agrees with a Transactions drill-down. **Web's I7 label collision does not exist here**, and must not be imported by copying web's wording. | `dashboard.service.ts:74-78` vs `vendor/lib/financials.ts:20-27` |
| F5 | Two cards carry **period-bearing names**: "Completed This Month" and "Monthly Revenue" (`sub={stats?.monthLabel}`). Web deliberately renamed these to period-neutral ("Completed") once the range became selectable, because a card whose name says "This Month" under a control set to "Today" contradicts itself. Same fix needed here. | `DashboardView.tsx:87,96` |
| F6 | `phCurrentMonthRange()` and `phToday()` are the ONLY PH range helpers in mobile (`lib/format.ts:133,139`). Web's `phDayRange`, `phWeekRange`, `phLastNDays`, `phYearRange`, `previousPeriod`, `isWholeMonth` have no mobile equivalents. `windowFor()` open-codes the 3-month and 12-month maths inline. | `lib/format.ts`; `useTransactionsQuery.ts:24-32` |
| F7 | **Tabs stay mounted.** `useBookingsQuery.ts:22-31` documents it: *"expo-router keeps tabs mounted once visited"*. Web's one-shot arrival mechanism relied on the destination REMOUNTING on every navigation — that assumption is **false on mobile**. Params pushed to an already-mounted tab must be consumed by an effect keyed on the param value, not by a `useState` initialiser. Getting this wrong means the filter applies the first time and silently does nothing thereafter. | `useBookingsQuery.ts:27`; `(app)/_layout.tsx` |
| F8 | The bookings filter strip is explicitly a **constrained resource**: *"the strip is the constrained resource. Add a secondary control within the group instead."* A date filter must NOT become a seventh chip. | `lib/bookingFilters.ts:16-20` |
| F9 | `WINDOW_PRESETS` has a documented refusal: *"No 'all time' preset: an unbounded window is exactly what D9 avoids."* Any preset set this plan introduces must stay bounded — web's "All dates" clear on Bookings cannot be ported as-is. | `useTransactionsQuery.ts:22-23` |
| F10 | **CORRECTION to D1's premise (2026-08-14).** The plan said a custom range needs a new dependency. It does not: **`@expo/ui` is already installed** (`package.json`, `~57.0.8`) and ships a native `DatePicker` — `@expo/ui/jetpack-compose` (Material 3) and `@expo/ui/swift-ui`. Real costs remain, and they are what D1 turned on: there is **no `universal` DatePicker** (`src/universal/index.ts` lists Picker but not DatePicker), so it needs `.android.tsx`/`.ios.tsx` splits; `@expo/ui` is used **nowhere in `src/` today** (`grep` returns nothing), so first use is unproven here; its components render as hosted native views that will not take `theme/tokens.ts`; and iOS is unverifiable in this workspace. The `community/datetime-picker` path is **not** available — it needs `@react-native-community/datetimepicker`, absent from `node_modules`. | `package.json`; `node_modules/@expo/ui/src/{universal,jetpack-compose}/index.ts` |
| F11 | **Two cards cannot drill down to an exactly matching list.** "Pending Approvals" counts `status = pending` alone, but the narrowest chip is "Needs you" = `pending + returned` (`bookingFilters.ts:42`) — `useBookingsQuery.ts:73-77` already documents this exact mismatch and why the dashboard passes `["pending"]` directly. "Today's Bookings" excludes cancelled (`dashboard.service.ts:100-102`); the Bookings list does not. → D7. | `dashboard.service.ts:97-102`; `bookingFilters.ts:42`; `useBookingsQuery.ts:73-77` |
| F12 | **Offline persistence matches on the FIRST key element only** — `PERSISTED_KEYS.includes(String(query.queryKey[0]))` (`queryClient.ts:60-61`). Appending a window to the key therefore persists **every window the vendor touches**, not just the default: 6 booking filters × 5 presets = up to 30 booking pages in one AsyncStorage blob under a single 1-day `maxAge`. This is the concrete form of I3. | `lib/queryClient.ts:13,56-63` |

---

## BLOCKERS

### B1 — `getDashboardStats` cannot be scoped to a period  🔄 CODE COMPLETE (2026-08-14) — device check outstanding
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

**`DashboardStats` interface** (`:14-26`, hand-written per root `AGENTS.md`):
**as it stands after Stage 0** — it now also carries `revenueComplete`, which stays
as-is and needs no rename. Then: `completedThisMonth` → `completed`,
`monthlyRevenue` → `revenue`, and `monthLabel`
→ `periodLabel` produced by `rangeLabel(window)` — `monthLabel`'s
`toLocaleDateString(… month, year)` at `:115-119` **cannot describe "Today" or
"7 days"** and must go, not merely be renamed. Rename the fields rather than
leaving month-shaped names on range-shaped data; three call sites, all in
`DashboardView.tsx`. Pairs with I1 — do both in one change or the labels and the
data disagree in between.

**Verification:** machine (type-check) + device — change the period, confirm
Completed and Revenue move while Pending and Today's do not.

**🔄 CODE COMPLETE (2026-08-14).** `getDashboardStats(vendorId, window)`; the
window reaches `completed` (`booked_date` bounds) and the revenue query only.
`pendingApprovals` and `todaysBookings` are untouched, with the reason written on
the interface as a correctness rule rather than left as a silent omission.

- **Interface renamed as planned:** `completedThisMonth` → `completed`,
  `monthlyRevenue` → `revenue`, `monthLabel` → `periodLabel` (from
  `rangeLabel(window)`). The old `toLocaleDateString` month formatter is gone — it
  could not describe "Today" or a 12-month span. `revenueComplete` from Stage 0
  carried over unchanged.
- **The private helper was renamed too:** `getMonthlyRevenue` →
  `getRevenueForWindow`, and it now takes a `DateWindow`. "Monthly" was wrong on
  four of the five presets. ⚠️ The truncation plan's B1 refers to it by the old
  name; that reference is historical.
- **`periodLabel` ships WITH the numbers** rather than being derived in the view,
  so a re-render between fetches cannot print one period's label over another
  period's figures.
- **Query key:** `["dashboard-stats", vendorId, window.from, window.to]`. ✅
  **Verified before changing it** that both invalidation sites —
  `useBookingActions.ts:123` and `useBookingsRealtime.ts:44` — use
  `invalidateQueries` on the `["dashboard-stats", vendorId]` PREFIX, so they still
  reach every cached window. No change was needed at either site.
- **`useDashboardView` holds the window** in `useState` with a lazy initialiser
  (the eager form would recompute the current month every render and discard it).

---

### B2 — There is no shared date-range control  ✅ DONE (2026-08-14) — `lib/dateWindows.ts` + `PeriodFilter` both shipped; unmounted until Stage 3
**Files:** new `src/components/common/PeriodFilter/`, new `src/lib/dateWindows.ts`;
prior art `useTransactionsQuery.ts:14-32`, `BookingFilterTabs`

The only existing period UI is Transactions' three-value preset strip, built inline
in `TransactionsView.tsx:31` off `WINDOW_PRESETS`. Nothing is reusable as-is.

**Resolved by D1(c) + D3.** Build a **preset chip strip**, but make `DateWindow`
`{ from, to }` the type every layer below the strip passes around — never a preset
name. Preset set (D3), all bounded per F9, in this order:

| key | label | window |
|---|---|---|
| `today` | Today | `phToday()` → `phToday()` |
| `last-7-days` | 7 days | today − 7d → today |
| `this-month` | This month | `phCurrentMonthRange()` — **the default everywhere** |
| `last-3-months` | 3 months | today − 3mo → today |
| `last-12-months` | 12 months | today − 12mo → today |

This is a strict superset of today's three, so Transactions keeps every preset it
has and its `"this-month"` default: **no existing screen changes behaviour.**

`lib/dateWindows.ts` owns the table, `windowFor(preset)`, `presetForWindow(window)`
(for restoring chip selection from route params), a `rangeLabel(window)` used as the
card sub-label, and `parseWindowParam` / `serialiseWindowParam`. It moves the
3/12-month arithmetic out of `useTransactionsQuery.ts:24-32` — that function becomes
a re-export or is deleted at its call sites. It imports **nothing** from
`lib/supabase/client`, so `node --test` can load it (nested `AGENTS.md`: "pure logic
that needs a test must live in its own module").

**Component separation** (mobile override — no CSS modules): `PeriodFilter.tsx`
render layer + `PeriodFilter.styles.ts` `makeStyles(tokens)`, **no hook** — it is
fully controlled (`value: DateWindow`, `onChange: (w: DateWindow) => void`), so it
holds no state, exactly like `StatCard`. Reuse `BookingFilterTabs`' chip language
rather than inventing a second one.

⚠️ **The horizontal-ScrollView trap applies** (nested `AGENTS.md`): a horizontal
strip in a `flex: 1` column needs `flexGrow: 0` on the ScrollView's **own `style`**,
not `contentContainerStyle`. `BookingFilterTabs` already pays this tax — copy it.

**Verification:** machine (`tsc`, `npm test` on `dateWindows.test.ts` covering month
boundaries, year rollover and `presetForWindow` round-tripping) + device (chip
heights are not ~400pt).

**✅ `lib/dateWindows.ts` DONE (2026-08-14)** — `tsc` clean, `expo lint` clean,
`npm test` 126/126 with 31 new cases. Nothing imports it yet, so behaviour is
unchanged by construction. Exports: `PeriodPreset`, `PERIOD_PRESETS`,
`DEFAULT_PERIOD_PRESET`, `windowFor`, `defaultWindow`, `presetForWindow`,
`rangeLabel`, `isDefaultWindowKey`, `parseWindowParam`.

Four things worth carrying forward:

1. **Every function takes an optional `today`.** Not a test seam bolted on: a strip
   that resolves "today" once and derives all five presets from it cannot mix two
   calendar days when the call straddles midnight. Production callers take the
   default.
2. **Two enabling changes outside the new module, both type/compile-only.**
   `phCurrentMonthRange(today = phToday())` gained the same optional parameter
   (`lib/format.ts`; existing callers and `format.test.ts` unaffected), and
   **`DateWindow` moved from `transactions.service.ts` to `lib/types.ts`** with
   `useTransactionsQuery` repointed. The move is forced: `lib/` cannot import
   `services/` without inverting the layer, and in practice a service import drags
   `lib/supabase/client` into `node --test`, which cannot load it.
3. **`serialiseWindow` was dropped from the planned API.** A window is already two
   strings; an identity function would be ceremony. `parseWindowParam` earns its
   place because params can arrive from a deep link — see B5.
4. **The old `WINDOW_PRESETS`/`windowFor` in `useTransactionsQuery.ts` still
   exist** and are still what Transactions uses. Two preset tables coexist until
   Stage 6 retires the old one. Expected, not drift — but do not "tidy" one of them
   away early, since the old one is live and the new one is not.

**✅ `PeriodFilter` DONE (2026-08-14)** — `components/common/PeriodFilter/` as
`.tsx` + `.styles.ts`, **no hook**: fully controlled (`value: DateWindow`,
`onChange: (next: DateWindow) => void`), no state and no effects, so
`component-separation` §4's pure-display exemption applies. Rendered nowhere yet.

- **It speaks `DateWindow` in both directions**, never a preset name —
  `presetForWindow` in, `windowFor` out. That translation is its single
  responsibility and is what keeps D1(c)'s promise: screens hold only windows, so a
  custom range later is a new chip here rather than a refactor of three screens. A
  window matching no preset highlights nothing, which is the honest rendering of a
  state the type must be able to express.
- **`today` is resolved once per render** and passed into both helpers. Letting each
  call `phToday()` independently would let a render that straddles midnight match a
  chip against one day and emit a window built from the next.
- **Accessibility:** the strip carries `accessibilityRole="tablist"` and
  `accessibilityLabel="Period"` — added because D6 stacks it directly beneath the
  status strip, and without it a screen-reader user meets eleven undifferentiated
  tabs across the two rows. Chips are `role="tab"` with `accessibilityState`,
  matching the existing strip.
- **Touch target:** the chip is sized by padding and lands under 44pt, so the
  effective target is restored by a `hitSlop` *derived* from `MIN_TOUCH_TARGET`
  (not a hardcoded number), the same construction the status chips use. Labels are
  capped at `maxFontSizeMultiplier={1.3}` for the same reason they are there.
- **The RN horizontal-ScrollView trap is paid:** `flexGrow: 0` on the ScrollView's
  own `style`, with the reason recorded in the styles file so it is not removed as
  redundant.
- **Known duplication, accepted with a trigger:** the chip metrics are copied from
  `BookingFilterTabs.styles.ts` — see **C1** under DEFERRED / COSMETIC.

**Verified (machine):** `tsc` clean, `expo lint` clean, `npm test` 126/126.
**NOT verified:** anything visual. The component renders nowhere until Stage 3, and
`expo export` would not even bundle an unreferenced module, so it proves nothing
here. Every claim about how it *looks* — chip height, the stacked-strip layout, the
gradient in both themes, the font-scale cap — is unverified until Stage 3 puts it
on screen and a device confirms it. This app has shipped four style passes that
machine checks approved and that did nothing visible.

**Behaviours pinned by the tests, so a later edit has to decide about them rather
than trip over them:** "7 days" is 7 days *including* today (−6); the month presets
are inherited verbatim and therefore cover N months *plus a day*; and JavaScript's
month overflow means 31 May − 3 months is **3 March**, not 28 February. That last
one always widens a window, never narrows it, so no money goes missing — but it is
now asserted rather than assumed.

---

### B3 — Stat cards have no press target  ⬜ TODO
**File:** `src/components/dashboard/StatCard/StatCard.tsx:29-30`

No `Pressable`, no press state, no `accessibilityRole="button"` — by decision
D4-a. **D2 approved (2026-08-14)**: D4-a's condition is met, not overturned.

**Fix approach:** optional `onPress` + `accessibilityHint` naming the destination.
When `onPress` is absent the card renders **exactly** as today — same `View`, same
`accessibilityRole="summary"`, no press state — so the decision stays reversible per
card. When supplied, the root becomes a `Pressable` with `accessibilityRole="button"`
and a pressed style drawn from `tokens` (no inline `style={{}}`; the pressed variant
lives in `StatCard.styles.ts`). **Respect the 44×44pt minimum touch target** — see
`.claude/skills/mobile-dev/SKILL.md`, which the nested `AGENTS.md` requires reading
before any mobile feature work. The card is already far taller than 44pt, so this is
satisfied by the existing padding; do not shrink it.

Update the `StatCard.tsx:24-30` comment in the same change — it currently states the
cards are non-interactive by D4-a, and leaving that in place while the props say
otherwise is how the next reader gets misled.

⚠️ Card contains no other interactive element today; keep it that way, or nested
pressables will swallow taps.

**Verification:** device — tap each card, and check TalkBack announces the
destination (Android; iOS/VoiceOver remains unverifiable here per nested `AGENTS.md`).

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
that hides out-of-range work under-reports what the vendor must do.
`countBookingsWithStatuses` (`bookings.service.ts:157-171`) feeds them, takes only
`(vendorId, statuses)`, and **must not gain a window parameter**. Verified
2026-08-14; state this in the code comment so it is not "tidied up" later.

⚠️ `getBookingsPage`'s `.range()` paging is ordered by `created_at, id` while the
date filter bounds `booked_date` — two different columns. That is correct (the list
is ordered by when the booking was made; the filter is about when the job is), but
it means the window does **not** narrow monotonically down the pages. Do not
"optimise" by stopping early on the first out-of-range row.

**Verification:** device — drill in from Completed, confirm the list matches the
widget's number (this card is one of the two exact-match cases, see D7).

---

### B5 — Route params are an untrusted surface  ✅ DONE (2026-08-14) — discovered during Stage 1
**File:** `src/lib/dateWindows.ts` `parseWindowParam`; enforced by Stages 5–6

**Not in the original plan.** Writing Stage 1's tests turned up a real defect in
the first cut of the param validator: `"2026-13-01"` matches the `YYYY-MM-DD`
pattern but parses to an **Invalid Date**, whose `toISOString()` **throws**. The
round-trip check alone therefore crashed instead of rejecting.

That matters because these params reach `useLocalSearchParams`, which means they
can also arrive **from a deep link** — from outside the app — and this app has **no
error boundary** (nested `AGENTS.md`: the `NotificationListItem` lookup crash took
out a whole screen for the same class of reason). A hostile or merely stale link
would have taken down the destination tab.

**Fixed:** `isRealDate` now guards `Number.isNaN(parsed.getTime())` before the
round-trip, with a comment marking the guard load-bearing. `parseWindowParam`
rejects a missing half, a repeated param (expo-router surfaces those as an array),
a malformed date, an impossible date, and an inverted range — seven test cases.

**Binding on later stages:** Stages 5 and 6 must take every window param through
`parseWindowParam` and fall back to the default on `null`. Reading `params.from`
directly, or casting it, reintroduces exactly this.

**Verification:** ✅ machine — `npm test`, 7 cases in `dateWindows.test.ts`; the
crash was reproduced as a failing test before the fix.

---

## IMPORTANT

### I1 — Period-bearing card names contradict a selectable period  🔄 CODE COMPLETE (2026-08-14) — device check outstanding
**File:** `src/components/dashboard/DashboardView.tsx:87,96`

"Completed This Month" and "Monthly Revenue" are fixed-period names. With a
control set to anything else they state a period the number does not cover.

**Fix approach:** rename to "Completed" and "Revenue"; the sub-label carries the
period (already does — `stats?.monthLabel`, which becomes a range label). Exactly
web's I5/I7 fix.

**🔄 CODE COMPLETE (2026-08-14).** Both cards renamed; subs now read
`stats?.periodLabel`. A third period-bearing string was found and fixed in the same
pass: Stage 0's truncation warning said *"This **month** has more payments…"*,
which is the same defect one layer down — it is now "This period". The
"unavailable" sub-label is unchanged, since it describes the ledger rather than a
period.

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

### I3 — Stale-data banner and offline persistence must follow the period  🔄 CODE COMPLETE (2026-08-14) — offline behaviour unverified
**Files:** `StaleBanner` usage `DashboardView.tsx:50-54`; `lib/queryClient.ts` `PERSISTED_KEYS`

`dataUpdatedAt` comes from the stats query. Once the key includes the window,
switching periods yields a *different* cache entry with its own `dataUpdatedAt` —
so the banner may read "updated just now" for a period never fetched, or flash
stale for one that is fine.

**Fix approach:** two parts, both settled by F12.

1. **Banner** — `dataUpdatedAt` must come from the query for the *active* window.
   `useDashboardView` already forwards it from the stats query, so this holds
   automatically once the key includes the window; confirm it rather than assume it,
   because the failure is silent.
2. **Persistence** — narrow the dehydrate predicate so **only the default window
   persists**. `queryClient.ts:60-61` matches on `queryKey[0]` alone, so without this
   every window a vendor touches is written to one AsyncStorage blob (F12: up to 30
   booking pages). The offline promise is "cold open shows your normal view", not
   "every period you browsed":

   ```ts
   // lib/queryClient.ts — replaces the queryKey[0]-only predicate
   shouldDehydrateQuery: (query: { queryKey: readonly unknown[] }) =>
     PERSISTED_KEYS.includes(String(query.queryKey[0])) &&
     isDefaultWindowKey(query.queryKey)   // from lib/dateWindows.ts
   ```

   `isDefaultWindowKey` returns `true` for keys carrying no window at all, so
   `booker-contacts` and every other persisted key keeps its current behaviour.

⚠️ The default window is **"this month", which moves on the 1st**. A cache written
in July is keyed to July's `from`/`to` and will simply miss on 1 August rather than
serve stale numbers — correct, and it means the vendor sees a normal load, not wrong
data. Note it so the miss is not later mistaken for a bug.

**Verification:** device — airplane mode, cold open, confirm the default period
restores; then browse three periods, background/foreground, and confirm the
persisted blob has not grown to hold them (dev-menu AsyncStorage inspection).

**🔄 CODE COMPLETE (2026-08-14).** Both halves:

1. **Banner** — confirmed by reading rather than assumed: `useDashboardView`
   returns `stats.dataUpdatedAt` straight from the `useQuery` whose key now carries
   the window, so each period reports its own freshness with no extra wiring. A
   comment now says so at the return site, because the correctness of this depends
   on a key two files away.
2. **Persistence** — `queryClient.ts`'s `shouldDehydrateQuery` gained the
   `isDefaultWindowKey` gate exactly as drafted. Keys with no window are unaffected
   (the helper returns `true` for them), so every pre-existing cache persists as
   before; only non-default windows are now excluded.

✅ The gate's logic is unit-tested (Stage 1, 5 cases including a bookings key with
a status element and a non-date tail). ⚠️ What is NOT verified is the *effect*: no
airplane-mode cold open has been run, and no AsyncStorage blob has been inspected.
That is a device check and it has not happened.

### I4 — Transactions must move from `WindowPreset` state to `DateWindow` state  ⬜ TODO
**Files:** `src/hooks/useTransactionsQuery.ts:14-61`;
`src/components/transactions/TransactionsView/{useTransactionsView.ts:13-16,TransactionsView.tsx:10,31}`

D1(c) requires `DateWindow` to be the currency between layers. Transactions is the
one screen that currently holds a **preset name** in state (`useState<WindowPreset>`)
and passes it into the query, where it is also the query-key element
(`:44`, `:58`). Left alone, a window carried in from a dashboard drill-down could
not be represented on this screen.

**Fix approach:** `useTransactionsView` holds `DateWindow`; `useTransactionsQuery`
takes a `DateWindow`; the keys become
`["transactions-first-page", vendorId, window.from, window.to]` and
`["transaction-totals", vendorId, window.from, window.to]`. `TransactionsView.tsx`
drops its inline `WINDOW_PRESETS.map` and renders `<PeriodFilter />`.
`WINDOW_PRESETS` / `windowFor` move to `lib/dateWindows.ts`.

⚠️ **The key change invalidates every persisted transactions entry** — the first
element `"transactions-first-page"` is in `PERSISTED_KEYS`, so existing cached pages
keyed by preset name simply miss after the update. One extra fetch on first open
after upgrade; no wrong data. Acceptable, but say so rather than discovering it.

**Verification:** machine (`tsc`) + device — the three original presets still return
what they did, and the default is still "This month".

### I5 — Drill-down mapping, including the two inexact cards  ⬜ TODO
**Files:** `useDashboardView.ts` (new callbacks); `app/(app)/bookings/index.tsx`,
`app/(app)/transactions.tsx` (param consumption, see I2)

Per **D7**, all four cards navigate; only two can match exactly (F11).

| Card | Destination | Params | Match |
|---|---|---|---|
| Pending Approvals | Bookings | `filter=needs_you`, **no window** | ⚠️ wider — includes `returned` |
| Today's Bookings | Bookings | `filter=all`, `window=today` | ⚠️ wider — includes `cancelled` |
| Completed | Bookings | `filter=done`, active window | ✅ exact |
| Revenue | Transactions | active window | ✅ exact |

**No window is sent for Pending** — B1 keeps that card unscoped, so sending the
dashboard's period would contradict the number the vendor just tapped.

**Fix approach:** `useDashboardView` gains one callback per card, each a
`router.push({ pathname, params })`, alongside the `openBooking`/`openAllBookings` it
already holds. The destination screens must show the filters they were given
(D6's second strip makes the period visible; the status chip is already visible), so
a wider list is *explained on screen* rather than looking like a wrong number.

**Verification:** device — the two exact cards match their number; the two inexact
ones land with the right chips visibly selected.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains — plan-authoring §7.
     NONE REMAIN: D1–D7 all resolved 2026-08-14. -->

- **D1 — preset chips, or a real calendar range picker?** → **(c) presets now,
  `DateWindow` everywhere** (resolved 2026-08-14). Ship a preset chip strip, but
  every layer below the strip passes `DateWindow { from, to }` — never a preset
  name — so adding a calendar later is additive UI, not a refactor. Drives B2, I4.

  *Premise corrected before deciding (F10):* the plan claimed a custom picker needs
  a new dependency. It does not — `@expo/ui` is already installed and ships a native
  `DatePicker`. The decision was taken on the **remaining** costs, which are real:
  no `universal` DatePicker so `.android.tsx`/`.ios.tsx` splits are required,
  `@expo/ui` is unused in this app today, its hosted native views ignore
  `theme/tokens.ts`, and iOS cannot be verified in this workspace. Recorded so a
  future revisit starts from the true dependency position.

- **D2 — may the stat cards become pressable, against D4-a?** → **Approved**
  (resolved 2026-08-14). D4-a
  (`2026-07-29-vendor-mobile-styling-branding.md:289-294`) forbids a pressable
  affordance *"without a press target"*; this plan supplies real targets, so its
  **condition is met, not overturned**. `onPress` stays optional and a card without
  one renders exactly as today. Drives B3. Cross-reference this resolution from the
  styling plan's D4-a when B3 ships, so the older plan does not read as still
  forbidding it.

- **D3 — which preset set?** → **A strict superset of today's three** (resolved
  2026-08-14): **Today / 7 days / This month / 3 months / 12 months**, shared by
  dashboard, Bookings and Transactions, default `this-month` everywhere. Chosen over
  web's five because that set would have **removed** 3-months and 12-months from
  Transactions — a regression for money history — whereas this one is purely
  additive: no existing screen changes behaviour. Every window bounded, honouring
  F9. Accepted cost: mobile's period vocabulary now differs from web's (see Scope
  guard). Drives B2.

- **D4 — how much of the web dashboard comes across?** → **(a) filter + drill-down
  only** (resolved 2026-08-14). The 4 flat cards stay; no Operations/Earnings
  grouping, no Gross/Fee/Net/Payout split, no `vendor/lib/financials.ts` port. F3's
  structural gap is accepted, not closed.

- **D5 — order against the mobile truncation plan?** → **Truncation fix ships
  first, as its own change** (resolved 2026-08-14).
  `.plans/2026-08-11-mobile-vendor-unbounded-queries.md` B1 (unbounded
  `getMonthlyRevenue`) must land and be verified before **any** item here starts.
  Rationale: a 12-month preset over a >1000-row ledger silently under-reports — the
  identical web query understated a real vendor's total by **19.7%** with no error
  raised. This plan widens exactly that window, so shipping first would knowingly
  enlarge a money bug. Recorded as a hard coupling on both plans.

- **D6 — where does the period control live on the Bookings screen?** → **A second
  strip below the status chips** (resolved 2026-08-14). F8 forbids a seventh chip in
  the lifecycle strip; a separate strip honours that literally, keeps
  `lib/bookingFilters.ts` untouched (Scope guard), and leaves both filters
  **visible**, which the verification list requires. Rejected: a compact
  "This month ▾" button opening a sheet — it hides the active period behind a tap on
  the one screen where a drill-down most needs to explain itself, and adds a sheet
  component this screen does not have. Accepted cost: ~44pt more vertical chrome
  above the list.

- **D7 — how do the two cards that cannot match exactly behave?** → **Navigate
  anyway, document the gap** (resolved 2026-08-14). All four cards drill down;
  Pending → Bookings/Needs you (wider by `returned`) and Today's → Bookings/All +
  Today (wider by `cancelled`). Rejected: making only the exact-match cards
  pressable (two live cards beside two dead ones is a worse rule to learn), and
  passing exact status sets through params to force a match (creates list states
  unreachable from the chip strip, pushing against F8). Drives I5; narrows B4's
  verification to the two exact cards.

---

## DEFERRED / COSMETIC

- **C1 — the chip metrics now exist twice** (added 2026-08-14, Stage 2).
  `PeriodFilter.styles.ts` copies `BookingFilterTabs.styles.ts`'s chip padding,
  radius, label size and hitSlop derivation rather than importing or extracting
  them. Acceptable because `common/` must not depend on `bookings/`, extracting
  would mean editing a working component for no behavioural gain, and the two
  strips are genuinely different components — one carries count badges and bleeds
  out of a list header, the other does neither. **Mitigation:** the two sit
  *stacked* on the bookings screen after Stage 5, so any divergence is visible side
  by side rather than silent. **Trigger to extract:** a third chip strip.

---

## Couplings

- **Hard, blocking — now an ordering prerequisite.** Mobile **B1** of
  `.plans/2026-08-11-mobile-vendor-unbounded-queries.md` (unbounded
  `getMonthlyRevenue`) **ships first**, per D5 (resolved 2026-08-14). It is Stage 0
  of the execution order and is **not** part of this plan's diff. The reciprocal
  note has been added to that plan's B1.
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
| **NEW** `common/PeriodFilter/` ✅ | The shared period control (B2). `PeriodFilter.tsx` + `PeriodFilter.styles.ts`. Shipped 2026-08-14, unmounted. | **No hook** — fully controlled (`value: DateWindow`, `onChange`), so it holds no state, effects or handlers of its own; pure display, exactly like `StatCard`. All styling in `makeStyles(tokens)`; no inline `style={{}}`. Reuses `BookingFilterTabs`' chip language. |
| **NEW** `lib/dateWindows.ts` + `.test.ts` ✅ | Preset table, `windowFor`, `defaultWindow`, `presetForWindow`, `rangeLabel`, `isDefaultWindowKey`, `parseWindowParam` (B2, B5, I3). Shipped 2026-08-14; no `serialiseWindow` — see B2. | Not a component. `lib/` because it must be unit-testable — the app already tests `transactionTotals.ts`, `bookingErrors.ts`, `vendorMapping.ts` there, and nothing in it may import `lib/supabase/client`. |
| `dashboard/StatCard/StatCard.tsx` | Optional `onPress` + `accessibilityHint`; `Pressable` root **only** when supplied (B3, D2). Update the `:24-30` comment. | Stays pure display — handler passed in, no state. Pressed style in `StatCard.styles.ts`, not inline. |
| `dashboard/DashboardView/{useDashboardView,DashboardView}.ts(x)` | Hook holds the `DateWindow` and the four navigation callbacks (I5); view renders `<PeriodFilter />`, passes `onPress` per card, renames the two period-bearing cards (I1). | Hook keeps state + navigation, as it already does for `openBooking`/`openAllBookings`. The `.tsx` gains no `useState`. |
| `services/dashboard.service.ts` | `getDashboardStats(vendorId, window)`; window applied to Completed + Revenue only (B1). | — |
| `services/bookings.service.ts`, `hooks/useBookingsQuery.ts` | Optional window on `getBookingsPage` + **query key** (B4). `countBookingsWithStatuses` **unchanged** — badges stay unfiltered. | — |
| `hooks/useTransactionsQuery.ts` | Takes a `DateWindow`, not a `WindowPreset`; keys by `from`/`to` (I4). `WINDOW_PRESETS`/`windowFor` move to `lib/dateWindows.ts`. | — |
| `transactions/TransactionsView/{useTransactionsView,TransactionsView}.ts(x)` | State becomes `DateWindow`; the inline `WINDOW_PRESETS.map` at `:31` is replaced by `<PeriodFilter />` (I4). | Existing split preserved. |
| `bookings/BookingsList/{BookingsList,useBookingsList}.ts(x)` | A **second** `<PeriodFilter />` goes into the existing `header` fragment, directly below `<BookingFilterTabs>` and above `<StaleBanner>` (D6). `useBookingsList` holds the window and consumes route params (I2). | Existing split preserved. ⚠️ `header` is an inline **element**, deliberately (`BookingsList.tsx:11-14`): keep it inline, do not memoise it into a component type, or the strip remounts and loses its scroll offset every render — a trap this app has already paid for. |
| `lib/queryClient.ts` | Dehydrate predicate also checks `isDefaultWindowKey` (I3, F12). | Not a component. |
| `app/(app)/bookings/index.tsx`, `transactions.tsx` | Read + clear params in an effect keyed on the param values (I2). | Route files stay thin, as they are now. |

---

## Execution order

All decisions are resolved. **Stage 0 is a prerequisite from another plan and must
be verified before Stage 1 starts** (D5). Cadence is one stage at a time unless a
range is requested (`.claude/skills/developerboss/SKILL.md`).

| Stage | Work | Items | Gate to leave |
|---|---|---|---|
| **0** 🔄 | Ship `.plans/2026-08-11-mobile-vendor-unbounded-queries.md` **Stage 1** (B1 + I1 + I2 — bound `getMonthlyRevenue`, surface `complete`) as its own change. **Not part of this plan's diff.** **Code complete 2026-08-14, machine-verified; the live >1000-row check has NOT been run.** | that plan's B1, I1, I2 | Its own verification; revenue reports honestly over a 12-month window |
| **1** ✅ | `lib/dateWindows.ts` + `dateWindows.test.ts` — preset table, `windowFor`, `presetForWindow`, `rangeLabel`, `isDefaultWindowKey`, param codec. Pure; nothing imports it yet. **DONE 2026-08-14** — see B2's note. | B2 (part) | ✅ `npm test` 126/126 (31 new), `tsc` clean, `expo lint` clean, **zero** behaviour change |
| **2** ✅ | `PeriodFilter` component — `.tsx` + `.styles.ts`, rendered nowhere. **DONE 2026-08-14.** | B2 (part) | ✅ `tsc`, `expo lint`, `npm test` clean; **device check deferred to Stage 3**, where it first renders |
| **3** 🔄 | Dashboard reads the window: `getDashboardStats(vendorId, window)`, query key, `<PeriodFilter />`, card renames, banner + persistence. **Code complete 2026-08-14; machine-verified incl. `expo export`. NOT device-verified.** | B1, I1, I3 | Device: Completed and Revenue move, **Pending and Today's do not** |
| **4** | Stat cards gain press targets and the four navigation callbacks. | B3, I5 | Device: taps land, TalkBack announces destinations, ≥44×44pt |
| **5** | Bookings destination: window on `getBookingsPage` + key, second strip, param consume/clear. | B4, I2, D6 | Device: Completed drill-down matches exactly; badges unchanged |
| **6** | Transactions destination: `DateWindow` state + keys, `<PeriodFilter />` replaces the inline map, param consume/clear. | I4, I2 | Device: the three original presets behave as before |
| **7** | Full device pass on Android. | — | Every line under Verification |

Stages 1–2 are the **independent safe prefix** — they add unreferenced code and
cannot change behaviour, so they can proceed the moment Stage 0 is verified.
Stages 5 and 6 both depend on I2's param mechanism; whichever runs first
establishes the pattern and the second must follow it rather than invent a variant.

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
  **visible**, not silently. Per D7, assert an **exact** count match only for
  Completed → Bookings/Done and Revenue → Transactions; for Pending and Today's,
  assert the destination arrives with the right chips selected and that the list is
  wider only by `returned` / `cancelled` respectively.
- Chip badge counts stay unfiltered with a period set (B4).
- Transactions' three original presets return what they did before (I4 regression
  check — this is the one existing screen the plan changes).
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
