# Ezzy Vendor Mobile — booking and transaction filter toolbar redesign

**Date:** 2026-08-26
**App / scope:** `ezzy-vendor-mobile` only. Target screens are Bookings and
Transactions. Dashboard is documented as a coupling because it also uses
`PeriodFilter`, but is not in scope unless explicitly approved.
**Status:** COMPLETE (2026-09-24) — the user confirmed the final filter-header spacing (I3) on an Android device. Last recorded: IN PROGRESS (2026-09-02) — Stage 3 Android verification is confirmed; a
final Stage 2 spacing correction is required before closeout.

> One-line framing: make mobile filtering readable and discoverable without stacking
> horizontal chip strips or relying on hidden swipe behaviour.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision; numbers are
> plan-local.

---

## Findings

### F1 — Bookings currently stacks two horizontal filter strips
**File:** `ezzy-vendor-mobile/src/components/bookings/BookingsList/BookingsList.tsx:19`

The Bookings header renders `BookingFilterTabs` for lifecycle status and then
`PeriodFilter` directly below it (`:19-30`). This is the exact UX shape the user
called out: two horizontally scrolling menus stacked in the same header.

### F2 — The horizontal strips intentionally hide native scroll indicators
**Files:** `src/components/bookings/BookingFilterTabs/BookingFilterTabs.tsx:34`,
`src/components/common/PeriodFilter/PeriodFilter.tsx:63`

Both controls set `showsHorizontalScrollIndicator={false}`. The code has strong
historical reasons for keeping the strips compact, but the result gives no obvious
affordance that more options may be off-screen.

### F3 — Transactions uses the same period strip
**File:** `ezzy-vendor-mobile/src/components/transactions/TransactionsView/TransactionsView.tsx:29`

Transactions renders `PeriodFilter` above Search (`:29-40`). It is only one strip,
but it shares the same hidden-scroll affordance problem as Bookings.

### F4 — Dashboard is coupled through `PeriodFilter`, but is outside this request
**File:** `ezzy-vendor-mobile/src/components/dashboard/DashboardView/DashboardView.tsx:58`

Dashboard also renders `PeriodFilter`. Reworking the shared component directly would
change Dashboard too. This plan therefore avoids modifying `PeriodFilter` as a first
move and replaces the Bookings/Transactions call sites with new toolbar components.

### F5 — Business semantics must not change
**Source:** `architecture/portals.md:249`

Bookings must keep the six lifecycle groups: `All`, `Needs you`, `Active`, `Done`,
`Issues`, `Closed`, with badges only where they represent work. Transactions must keep
bounded date windows; no "all time" / unbounded range is added to the mobile money
query.

### F6 — The guide copy will become stale if the filter UI changes
**File:** `ezzy-vendor-mobile/src/components/dashboard/GuideModal/guideItems.ts:65`

The guide currently says Bookings has "two rows of chips". Any filter redesign must
update this copy in the same change, or the Getting Started guide becomes wrong.

### F7 — The settings action is pinned by `ScreenShell`, not by the gear button
**Files:** `ezzy-vendor-mobile/src/components/common/ScreenShell/ScreenShell.tsx:45`,
`ezzy-vendor-mobile/src/app/(app)/dashboard.tsx:24`,
`ezzy-vendor-mobile/src/app/(app)/bookings/index.tsx:13`,
`ezzy-vendor-mobile/src/app/(app)/transactions.tsx:13`,
`ezzy-vendor-mobile/src/app/(app)/notifications.tsx:13`

The gear "staying on top" is caused by `ScreenShell` pinning the whole action row.
Dashboard has two actions (`GuideAction` and `SettingsAction`), while Bookings,
Transactions and Notifications have the settings action. Hiding only the gear would
leave inconsistent header chrome; the better unit is the action row.

---

## BLOCKERS

### B1 — Bookings must not show two stacked horizontal menus ✅ DONE (2026-08-26)
**Files:** `src/components/bookings/BookingsList/BookingsList.tsx:18`,
`src/components/bookings/BookingsFilterToolbar/BookingsFilterToolbar.tsx:11`,
`src/components/bookings/BookingsFilterToolbar/useBookingsFilterToolbar.ts:24`

**Gap:** The current header asks the user to parse two similar rows of chips: lifecycle
and date. On a phone, that makes the controls look like dense settings rather than a
quick answer to "what am I looking at?"

**Recommended fix approach:** replace the two strips at this call site with a
`BookingsFilterToolbar` that shows two large, labelled buttons:
`Status: Needs you` and `Dates: All dates` / the active period. Each opens a bottom
sheet with radio-list options. This removes horizontal scrolling from the Bookings
filter header while keeping the same filter values and query state.

**Component convention:** `BookingsFilterToolbar.tsx` is render-only,
`useBookingsFilterToolbar.ts` owns active-sheet state and option handlers,
`BookingsFilterToolbar.styles.ts` owns static styling. It consumes `BOOKING_FILTERS`,
`PERIOD_PRESETS`, current filter/window values, counts, and callbacks supplied by
`useBookingsList`.

**Verification:** machine: TypeScript, lint, tests, Android export. Device: Bookings
filter buttons open/close, selecting each status/date updates the list, badges read
correctly, hardware back closes the sheet, large font remains usable.

**Executed 2026-08-26:** replaced the Bookings header's two horizontal filter strips
with `BookingsFilterToolbar`, using labelled `Status` and `Dates` buttons that open
bottom-sheet radio option lists. Removed the now-unused `BookingFilterTabs` component
and cleaned stale comments that referenced it. **Verified (machine):** `tsc --noEmit`,
`expo lint`, `npm test`, Android `expo export`, `git diff --check`, and static search
for stale `BookingFilterTabs` / "two rows of chips" references. **Verified (device,
user-confirmed 2026-08-26):** Bookings shows the new filter controls as intended.

### B2 — Transactions period filtering needs the same clearer pattern ✅ DONE (2026-08-26)
**Files:** `src/components/transactions/TransactionsView/TransactionsView.tsx:28`,
`src/components/transactions/TransactionsFilterToolbar/TransactionsFilterToolbar.tsx:16`,
`src/components/transactions/TransactionsFilterToolbar/useTransactionsFilterToolbar.ts:18`

**Gap:** Transactions has only one period strip, but it still hides the horizontal
scroll indicator and does not clearly communicate that all range choices are available.

**Recommended fix approach:** replace the Transactions `PeriodFilter` call site with a
`TransactionsFilterToolbar`: one `Date` filter button plus the existing Search field.
The Date button opens the same bottom-sheet option pattern, but without `All dates`
because transaction totals must remain bounded.

**Component convention:** `TransactionsFilterToolbar.tsx` is render-only,
`useTransactionsFilterToolbar.ts` owns active-sheet state and date option handlers,
`TransactionsFilterToolbar.styles.ts` owns layout. `SearchField` stays a child so
its existing focus/remount protection remains intact.

**Verification:** machine: TypeScript, lint, tests, Android export. Device:
Transactions date selection updates totals/list, SearchField keeps focus while typing,
large font and keyboard layout remain usable.

**Executed 2026-08-26:** replaced the Transactions `PeriodFilter` strip with
`TransactionsFilterToolbar`, a labelled `Date` button plus the existing debounced
`SearchField`. The date button opens the shared bottom-sheet radio list and does not
offer `All dates`, preserving bounded transaction totals. **Verified (machine):**
`tsc --noEmit`, `expo lint`, `npm test`, Android `expo export`, `git diff --check`,
and static search confirming Bookings/Transactions no longer render `PeriodFilter`.
**Verified (device, user-confirmed 2026-08-26):** Transactions date filter and search
behaviour checked on Android.

### I3 — Filter headers need a visible boundary before the first result  🔄 IN PROGRESS (2026-09-02)
**Files:** `src/components/common/RefreshableList/RefreshableList.tsx`,
`src/components/common/RefreshableList/RefreshableList.styles.ts`,
`src/components/bookings/BookingsList/BookingsList.tsx`,
`src/components/transactions/TransactionsView/TransactionsView.tsx`

**Gap:** FlashList's row separator only renders between data rows. It creates no space
between a `ListHeaderComponent` and the first result, leaving the first booking or
transaction visually attached to the filter header.

**Fix approach:** add a static, opt-in header-to-row boundary in `RefreshableList` and
enable it on the Bookings and Transactions list headers. The spacing applies after the
entire header, preserving the grouping of a filter with a visible stale banner or
transaction summary cards.

**Component convention:** `RefreshableList.tsx` remains the render/layout boundary;
the static `headerSeparated` rule stays in `RefreshableList.styles.ts`. No state,
service, schema, or component ownership changes are required.

**Verification:** machine: TypeScript, lint, tests, Android export, diff check. Device:
on Android, the first row is visibly separated from the full header in Bookings and
Transactions, in light/dark themes and with a visible stale banner.

**Executed 2026-09-02:** added the `separateHeaderFromRows` opt-in to
`RefreshableList`, backed by the static `headerSeparated` style, and enabled it for
Bookings and Transactions. It uses `spacing.md` after the complete header in populated,
loading, and error states. **Verified (machine):** `tsc --noEmit`, `expo lint`,
`npm test` (10/10 files), Android `expo export`, and both app/root `git diff --check`
passed. ⬜ **Still required:** Android visual confirmation of the gap before I3 and
Stage 4 can be marked done.

### B3 — Guide text must match the new Bookings filter UI ✅ DONE (2026-08-26)
**File:** `src/components/dashboard/GuideModal/guideItems.ts:65`

**Gap:** The guide says "two rows of chips", which will be false after B1.

**Fix approach:** update the Bookings guide item to describe a compact filter toolbar:
status controls what work group is shown, date controls when the booking is for, and
badge counts still mark work waiting on the vendor.

**Verification:** machine: TypeScript/lint. Device: read the guide modal at normal and
large font sizes after B1.

**Executed 2026-08-26:** updated the Bookings guide copy from "two rows of chips" to
the new `Status` / `Dates` filter buttons. **Verified (machine):** `tsc --noEmit`,
`expo lint`, and static search for stale guide wording. **Verified (device,
user-confirmed 2026-08-26):** the Stage 1 Bookings changes render correctly on Android.

### B4 — Header actions should hide while the user scrolls down ✅ DONE (2026-08-26)
**Files:** `src/components/common/ScreenShell/ScreenShell.tsx:45`,
`src/components/common/RefreshableList/RefreshableList.tsx:130`,
`src/components/dashboard/DashboardView/DashboardView.tsx:29`,
`src/components/settings/SettingsList/SettingsList.tsx:36`

**Gap:** The pinned action row keeps the settings gear visible while the user scrolls
content. That keeps a control on-screen, but it also creates the feeling that the gear
is floating over the page instead of belonging to the screen header.

**Recommended fix approach:** add scroll-aware header chrome to `ScreenShell`: action row
visible at the top, hide on downward scroll after a small threshold, re-show when the
user scrolls upward or returns near the top. Hide the entire action row, not just
`SettingsAction`, so Dashboard's guide/settings pair behaves as one header group.

**Component convention:** `ScreenShell.tsx` gains a companion `useScreenShell.ts` for
visibility state and scroll-direction logic; static collapsed/visible styles stay in
`ScreenShell.styles.ts`. Scrollable children consume a small context/hook from
`ScreenShell` rather than duplicating thresholds. `RefreshableList` forwards the same
scroll handler to FlashList and its loading/error `ScrollView` branches; Dashboard and
Settings pass it to their plain `ScrollView`s.

**Verification:** machine: TypeScript, lint, tests, Android export. Device: action row is
visible at top, hides only while scrolling down, returns when scrolling up, hardware back
and filter sheets still work, no title/filter content jumps under the safe area.

**Executed 2026-08-26:** added `ScreenChromeContext` and `useScreenShell` scroll-direction
logic. `ScreenShell` now hides/collapses the whole action row after downward scroll and
shows it again near the top or on upward scroll. `RefreshableList`, Dashboard and Settings
report scroll events through the shared context. **Verified (machine):** `tsc --noEmit`,
`expo lint`, `npm test`, Android `expo export`, and `git diff --check`. **Verified
(device, user-confirmed 2026-09-02):** Dashboard, Bookings, Transactions and Notifications
action-row hide/show behaviour checked on Android.

---

## IMPORTANT

### I1 — Build one reusable filter option sheet primitive ✅ DONE (2026-08-26)
**Files:** new `src/components/common/FilterOptionSheet/*`

**Gap:** Bookings needs two option sheets and Transactions needs one. Copying three
modal implementations would create unnecessary drift in dismissal, radio selection,
large-text behaviour and TalkBack labelling.

**Fix approach:** add a controlled `FilterOptionSheet` primitive that renders a modal
bottom sheet with title, optional subtitle, radio-list options, optional badge/count,
selected state, and close handling. It does not know booking or transaction semantics.

**Component convention:** `FilterOptionSheet.tsx` is render-only,
`FilterOptionSheet.styles.ts` owns static styling. No hook is needed if visibility and
handlers are controlled by the screen-specific toolbar hooks.

**Verification:** machine: TypeScript/lint. Device: modal presentation, backdrop/close
button, Android hardware back, TalkBack selected state, light/dark.

**Executed 2026-08-26:** added controlled `FilterOptionSheet` with bottom-sheet
presentation, explicit close action, radio selected state, optional meta text and
badges, and bottom safe-area padding for modal presentation. **Verified (machine):**
`tsc --noEmit`, `expo lint`, `npm test`, and Android `expo export`. **Verified
(device, user-confirmed 2026-08-26):** the Bookings filter sheet interaction renders
and behaves correctly on Android.

### I2 — If any targeted horizontal menu remains, it needs a visible swipe cue ✅ DONE (2026-08-26)
**Files:** depends on D1

**Gap:** The user explicitly said horizontal sliding menus must indicate they can be
swiped.

**Recommended fix approach:** choose D1-A, which removes horizontal menus from the two
targeted screens and makes this item unnecessary for Bookings/Transactions. If D1-B is
chosen instead, add a right-edge fade/peek affordance and accessibility label to the
remaining horizontal strip.

**Verification:** device screenshot at 390px-width Android viewport; check that a
partially visible next option or fade cue is visible before interaction.

**Executed 2026-08-26:** D1-A removed horizontal filter menus from the targeted screens
instead of retaining them with swipe affordances. **Verified (machine):** static search
confirms Bookings and Transactions no longer render `PeriodFilter` or `BookingFilterTabs`;
Dashboard's remaining `PeriodFilter` is intentionally out of this plan's scope.

---

## DECISIONS

- **D1 — Filter pattern for Bookings/Transactions:** **Option A selected**
  (resolved 2026-08-26). Use labelled filter buttons plus bottom-sheet radio lists.
  This removes horizontal menus from the targeted screens instead of trying to teach
  users that hidden chip overflow can be swiped.

- **D2 — Dashboard scope:** Dashboard remains out of scope for this plan unless the
  user asks for full app-wide filter parity. It uses `PeriodFilter` at
  `DashboardView.tsx:58`, so changing the shared component directly is avoided.

- **D3 — Header action hiding scope:** **Option A selected** (resolved 2026-08-26).
  Apply hide/show to every screen using `ScreenShell.action`: Dashboard, Bookings,
  Transactions and Notifications. This makes the action row behaviour consistent and
  avoids special-casing the gear.

---

## DEFERRED / OUT OF SCOPE

- Custom date ranges. Existing presets stay: `Today`, `7 days`, `This month`,
  `3 months`, `12 months`, plus `All dates` only where Bookings already allows no
  date filter.
- Backend/query changes. Existing booking status grouping and transaction date-window
  semantics remain unchanged.
- Dashboard filter redesign, unless explicitly added to scope.
- iOS device verification. As with the rest of this app, Android is the practical
  device target right now.

---

## Execution Order

| Stage | Items | Main files | Gate | Verification |
|---|---|---|---|---|
| **0** | ✅ Resolve D3 after preview review | plan only | User approval received 2026-08-26 | No OPEN decision remains before code starts |
| **1** | ✅ I1 + B1 + B3 — common sheet, Bookings toolbar, guide copy | `FilterOptionSheet/*`, `BookingsFilterToolbar/*`, `BookingsList.tsx`, `guideItems.ts` | D1 resolved | Machine checks pass; Android Bookings visual/interaction user-confirmed |
| **2** | 🔄 B2 + I3 — Transactions toolbar and header-to-row spacing | `TransactionsFilterToolbar/*`, `TransactionsView.tsx`, `RefreshableList/*`, `BookingsList.tsx` | Stage 1 patterns accepted | Transactions filter/search Android-verified; spacing correction needs machine checks and Android confirmation |
| **3** | ✅ B4 — scroll-aware header action row | `ScreenShell/*`, `RefreshableList.tsx`, scroll views | D3 resolved | Machine checks pass; Android scroll behaviour user-confirmed |
| **4** | ⬜ Final polish and plan closeout | all touched files | Stage 2 spacing confirmation required | Machine checks plus final Android confirmation |

---

## Preview

Static preview artifact prepared for D1-A:

`/tmp/ezzy-vendor-mobile-filter-redesign-preview.html`

Static preview artifact prepared for B4:

`/tmp/ezzy-vendor-mobile-header-scroll-preview.html`

This is not a runtime screenshot. It is a design preview generated from current app
tokens, labels and screen structure so the direction can be reviewed before app code
changes.

---

## Verification Plan

- Machine: `ezzy-vendor-mobile/node_modules/.bin/tsc --noEmit --project ezzy-vendor-mobile/tsconfig.json`
- Machine: `npm --prefix ezzy-vendor-mobile run lint`
- Machine: `npm --prefix ezzy-vendor-mobile test`
- Machine: `npx expo export --platform android`
- Static search: no `PeriodFilter` call remains in Bookings or Transactions after
  replacement; Dashboard call remains if D2 stays out of scope.
- Device: physical Android preview build, normal and largest font sizes.
- Device: light and dark theme screenshots for Bookings and Transactions.
- Device: TalkBack spot-check for filter buttons, radio options, selected state and
  sheet dismissal.
- Device: Android hardware back closes an open filter sheet before navigating away.

**Machine verification run 2026-08-26, Stage 1:** `tsc --noEmit` clean; `expo lint`
clean; `npm test` passed 10/10 test files; `npx expo export --platform android
--output-dir /tmp/ezzy-vendor-mobile-filter-stage1-export` succeeded; `git diff
--check` clean; static search found no stale source references to `BookingFilterTabs`
or the old guide wording.

**Machine verification run 2026-08-26, Stages 2-4:** `tsc --noEmit` clean; `expo lint`
clean; `npm test` passed 10/10 test files; `npx expo export --platform android
--output-dir /tmp/ezzy-vendor-mobile-filter-complete-export` succeeded; `git diff
--check` clean; static search confirms no `PeriodFilter`/`BookingFilterTabs` remain in
the targeted Bookings/Transactions filter surfaces.

**Device verification 2026-09-02:** user confirmed Transactions filtering/search and
scroll-aware header action behaviour. The first-row spacing issue was found during that
pass and is tracked as I3; final Android verification remains after its correction.
