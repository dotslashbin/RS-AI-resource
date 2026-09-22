# Ezzy Booker Mobile — build to the web redesign

**Date:** 2026-09-21
**App / scope:** `./ezzy-booker-mobile` only. Every other folder is read-only reference. Web changes are requested through **Sync notes (N#)**, never made from here.
**Status:** COMPLETE 2026-09-22 for the build scope (M1–M9). **Approved 2026-09-21** with the order M1 → … → M8, M9 added 2026-09-21 at the user's request. Every stage ✅ (M8 on the user's acceptance after their emulator checks). **Carried forward, not done:** G1–G6 (including device storage for the draft, I7) → the real-data plan (§12); N1–N9 with the user for the web session; commits with the user. Next: the real-data plan, written 2026-09-22 → `.plans/2026-09-22-booker-mobile-real-data.md` (DRAFT; decisions D1–D7 open). It carries G1–G6 as dependencies W1–W6.
**Replaces:** `2026-09-18-booker-mobile-prototype.md`, deleted 2026-09-21 at the user's request. That plan had absorbed three design directions and contradicted itself. Everything still true is here. What it built, M0 and the first Payments screen, is recorded under *What exists today*.

> **Goal:** the booker mobile app **looks and behaves like the approved web booker redesign** (`2026-09-18-booker-home-search-redesign.md`) in light and dark, on mock data that can be swapped for real Supabase calls. Where native differs from web, the difference is deliberate and listed with its reason.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** M# = build stage · P# = screen/feature · D# = decision · G# = backend gap · N# = sync note for the web session · I# = issue found during execution · T# = weak-implementation trap. All plan-local. "web D3", "web I17" etc. are the **web plan's** items.

---

## 1. Scope

**In:** every screen in the web plan, as it will look on a phone (P1–P8), in light and dark:
- Home
- Bookings and booking detail
- Explore
- the vendor offering page and the booking steps
- Payments
- plus two native-only screens: Account (the web drawer's contents) and Notifications

All on mock data.

**Out:**
- Real Supabase wiring, login, and real payment. These come in a later real-data plan; see §12 for what it inherits.
- Push, EAS builds, and store submission.
- Any change to `booker`, `backbone`, `vendor` or `command`.

---

## 2. Sources of truth, in order

1. **The web plan**, `.plans/2026-09-18-booker-home-search-redesign.md`, approved 2026-09-21. It **wins on look and behaviour**, and its decisions D1–D16 apply to mobile unless this plan says otherwise.
2. **The design canvas**, https://claude.ai/artifact/DZyasjx3GN8d6EQeAsw9Aj, version `1790044633-3de8` (checked 2026-09-22 at M8: board files unchanged in size; previously `1790018466-ea3c`, re-read 2026-09-21 at M1 start; the bump from `…9c9f` changed only the design tool's own files — all six boards and `canvas.json` are byte-identical). It is used for **layout and content order**, exactly as the web plan treats it. Its prototype fonts and surfaces are not used (web D3). The canvas has six boards:

| Board | Size | Mobile uses it for |
|---|---|---|
| `MobileHome` | 390, dark | **Exact** Home order and card content (P2) |
| `MobilePayments` | 390, dark | **Exact** Payments content (P6). ⚠️ It draws the *web* app at phone width (hamburger + top tabs), so mobile keeps its own chrome and takes the content only |
| `Main` | 1280, light | The extra Home widgets + the booking detail content (P3) |
| `Search` | 1280, light | Explore content (P4); phone layout adapted |
| `Offering` | 1280, light | Offering page content (P5); phone layout adapted |
| `Payments` | 1280, light | Receipt, sort and vendor filter details (P6) |

**This session reads both sources and edits neither.**

### Sync protocol (every stage)
1. Re-read the web plan and the canvas's `project/canvas.json`. If either changed since the version above, update this plan **before** building, and bump the version here.
2. For layout, where a phone board exists, match it. Where only a desktop board exists, adapt it with §4's rules and label the screen **"adapted"** in the preview.
3. For rules (progress steps, auto-confirm, money states, search), port **from the same source web uses**. Never re-invent them. When web's file lands, diff against it.
4. Anything web should settle goes into §10 (N#) for the user to carry across.

---

## 3. The look (web D3, applied to native)

Booker's look, not the prototype's: `--db-*` surfaces, booker's primary blue, and **only the division colours** from the prototype. **Every surface in light and dark** (web D3).

| Element | Source | Where on mobile |
|---|---|---|
| Surfaces, text, borders, inputs | booker `app/globals.css` `--db-*`, `:root` and `.dark` | `src/theme/tokens.ts`. **Already ported in M0**, verbatim except one contrast fix (below) |
| Page background | `--db-page-bg` gradient | `expo-linear-gradient` (installed) |
| Primary button | `linear-gradient(135deg,#2563eb,#1d4ed8)` + blue shadow (`booker/lib/constants.ts` `PRIMARY_BTN_STYLE`) | `PrimaryButton` (M0) |
| Link / active accent | `#2563eb` light · `#60a5fa` dark | `tokens.accent` (M0) |
| Booking status colours | `.db-badge-*`, per theme | `tokens.status` (M0) |
| **Division colours** | web I3: `--div-<slug>-fg/-bg`, **13 slugs** + `none`, light and dark | slug-keyed map in `tokens.ts` (M1). Until web I3 lands, provisional values (see M1) |
| Dark muted text | web `--db-text` `#64748b` (~4.1:1 on the dark page, under 4.5:1) | `#94a3b8`, which the approved `MobilePayments` board **also uses** for muted text. This matches the design, not a divergence from it |
| Font | **System font** (D9): San Francisco on iOS, Roboto on Android | `src/theme/tokens.ts` `font` → platform default; `@expo-google-fonts/inter` uninstalled in M1 |

**Font — verified 2026-09-21 by reading the code:**
- Booker web *names* Inter (`booker/components/layout/AppShell/AppShell.tsx:62`: `fontFamily: "'Inter',system-ui,sans-serif"`; also `components/auth/LoginPage/LoginPage.module.css`).
- It **never loads Inter**: there's no `@font-face`, no Google Fonts link and no `next/font` anywhere in `booker/app`, `components` or `public`. So most visitors see their **system font**.
- The approved phone boards draw the system stack too (`MobilePayments`: `ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto`).
- Mobile loaded Inter in M0. **D9 (2026-09-21): switch to the system font**, matching the phone boards and what web users actually see.

---

## 4. Web → native differences (deliberate)

| Area | Web | Mobile | Why |
|---|---|---|---|
| Menu | Sidebar, a hamburger drawer on phones (web I16): main pages, Settings, About & Legal, account, Sign out | **Avatar → Account screen** with the same contents + Delete account (P7) | Bottom tabs already carry the main pages; a drawer would duplicate them and needs `@react-navigation/drawer` |
| Main nav | Top tab strip: Home · Explore · Bookings · **Payments** (web D5, D13) | **Bottom** tab bar, same four, same order, same names | Native convention, thumb reach |
| Theme switch | Sun/moon in the TopBar | Account → Appearance: Light / Dark / System | No persistent top bar; "System" follows the OS |
| Search entry | TopBar search field | Home search pill + the Explore tab | No persistent top bar |
| Layout | Two columns on desktop | One column, in `MobileHome` order | Width |
| Booking detail | Modal (web I10) | Pushed screen `booking/[id]` | Native back gesture; long content scrolls better on a screen than in a modal |
| `<select>` (city, when, vendor, sort) | Native `<select>` | Bottom-sheet pickers; Payments puts them in a **Filters** sheet with a count badge, as `MobilePayments` draws | No `<select>` on native |
| Payments date range | Presets + custom from/to (web I19) | **Presets only**: Last 3 months · This month · This year · All (the `MobilePayments` order) | A date picker needs a new package; the phone board shows presets only |
| Pagination | 10 per page, Previous / Next (web D15) | **"Load N more"**, 10 at a time | The phone board draws "Load 3 more" |
| CSV export | Blob download (web D14) | **Share sheet** (`expo-file-system` + `expo-sharing`, D10) | No browser downloads on native |
| Receipt print | `window.print()` (web D16) | **`expo-print`** (D10) | No `window.print()` on native |
| Receipt | Dialog | Bottom sheet | Native pattern |
| Offering booking rail | Right-hand card | Sticky bottom bar: price · slot · **Book this slot** | Width |
| Directions | Google Maps search URL | `Linking` to Apple Maps / Google Maps by address | Native; no permission, no key |
| Keyboard hints, hover | `/` shortcut, hover rows | None | No hardware keyboard or hover |
| **Mobile-only additions** | — | Call vendor + offering photos and description on booking detail | → N1, N2 (proposed to web) |

---

## 5. Screens and features (P#) — every one must exist on mobile

Data key: ✅ supported by schema + RLS today · ⚠️ gap, see §9 · 🧪 mock only in this plan.

### P1 Shell
- Bottom tabs **Home · Explore · Bookings · Payments**. The pushed Offering and booking-step screens keep **Explore** highlighted (web G3).
- Header on each tab: title, **bell** with unread dot (→ P8), **avatar** (→ P7).
- Every tab screen has pull-to-refresh, and data is refreshed when the app returns to the foreground (mobile-dev §2), once real data exists. For now it's mock.

### P2 Home — `MobileHome` order, web I10–I12 behaviour
1. Date + "Hi, ‹name›"; search pill → Explore.
2. **Needs you**: only rows where the next step is the booker's. It's hidden when empty.
   - `fulfilled` → "Yes, all done" + "Something's wrong" (with a reason sheet) + the auto-confirm date. The date uses the **service-date gate**, per web I2: `max(changedAt + 3 d, service day start)`, Manila.
   - `in_progress` → "I've returned it".
   - Unpaid → **"Payment not received yet" as information only**, with no button (web D10). Retry is parked (G1).
   - After acting: a done state + **Undo**. All copy comes from booker's `lib/bookingActionCopy.ts`, copied.
3. **Up next**: the next `confirmed`/`pending` booking on or after today (Manila).
   - Offering, vendor, date/time, area, **"with ‹staff name›"** when assigned (web D7/D8, names only).
   - **Requirements as information** (web F4). No document progress and no upload button.
   - Get directions · View booking.
4. **My bookings**: tabs Upcoming / In progress / Past / Cancelled, **5 rows** on Home.
   - Each row: division-coloured code tile, **progress tracker**, and status as text as well as colour.
   - The tracker covers **all nine statuses** (web I1). Cancelled and refunded are terminal tracks; disputed reads "On hold — Ezzy is reviewing".
5. **Book again**: completed bookings grouped by **offering id** (never code), newest 3 (web I11).
6. **Open this weekend**: at most 4 past vendor/offering pairs, showing "N left". Honest counts need web's occupancy RPC (G2). 🧪
7. **Explore by division**: 13 divisions → Explore, pre-filtered.
8. **Resume draft**, compact: progress bar + Resume / Discard. 🧪 (Persisting it needs AsyncStorage, which the real-data plan will bring.)
9. **Getting started guide**, only while the booker has **zero** bookings (web D6). No Certificate button, no spending widget.

Every widget has four states — loading, empty (hidden or a CTA), error, populated — and an error must never read as "no bookings" (web I10, T7).

### P3 Bookings tab + booking detail
- The Bookings tab is the P2 list with no limit.
- `booking/[id]` pushed screen (content from the `Main` drawer, web I10):
  - code tile, offering, vendor, staff
  - status banner with a plain-language explanation
  - **timeline with real timestamps** from `booking_status_log` (web F12/I6) ✅
  - When / Paid / Where
  - Get directions · **Call vendor** (`vendors.phone` ✅; mobile-only, N1)
  - offering photos + description (mobile-only, N2)
- The screen loads its booking by **id** each time it opens, never from a copy handed over by the list, so it can't show a stale status (web G8). See I4 for the mock-data limit.

### P4 Explore (web I13, `Search` board)
- Labelled search field; division chips (13, toggle); **Where** (city, from the catalogue's distinct cities); **When** (Any / Today / This weekend), applied **only to visible results** (T3).
- Empty-query state: recent searches (in-memory now 🧪), popular categories.
- Results line; **Vendors** group (initials, name, division · city · service count, tagline ✅ `vendors.tagline`); **Services** group (cover photo or division placeholder, price per unit, vendor · city, next open time); no-results state with "Clear search and filters".
- Vendor result → that vendor's offerings. Service result → P5.
- The matcher follows web I4: lower-cased, every token must match; grouped; no fuzzy library. The catalogue is loaded once and cached (T5).

### P5 Offering page + booking steps (web I13, I15, `Offering` board)
- Back to results; photo gallery ✅ (`offering_attachments` photos, public bucket); category + granularity chips; name, vendor · area, description.
- "You'll need to upload" (requirements) and "You'll be asked to agree to" (active `document` attachments) ✅.
- Vendor block: address, opening hours ✅, Get directions, "All N services".
- **"Who you'll see"**: the distinct assigned staff. Each slot shows "with ‹name›" (web D7).
- Next open slots with "N left" (G2 🧪) → a sticky bottom bar: price · selected slot · **Book this slot**.
- **Date-granular offerings** (day/week/month) are shown, but Book reads "Booking by date isn't available yet" (web D11).
- Booking steps as a modal stack: **Schedule → Documents → Review → Pay** (web I15), with the offering, vendor and optional slot preselected. Documents are in-memory (G3); Pay is mock (G1). Slot logic is copied from `booker/lib/slots.ts` + `services/schedules.service.ts`, keyed on **offering id** (web I9, T2).

### P6 Payments (web D13–D16, I17–I21, `MobilePayments` board)
In `MobilePayments` order:
1. **Period chips**: Last 3 months (default) · This month · This year · All, plus the line "Showing ‹from› – ‹to›" in Manila dates.
2. **Two totals cards**:
   - **Paid** (₱, "N payments")
   - **Awaiting** (₱, "N booking(s)")
   - Paid counts **only** `paid` (web F14/I17, T8).
3. **Search** over service, vendor and **payment reference**.
4. A **Filters** button with a count badge. It opens a sheet with:
   - status chips **All · Paid · Unpaid · Cancelled · Refunded**, with counts
   - a **vendor** picker
5. A **sort** button ("Newest"), and the **CSV** button → share sheet (D10).
6. **Month groups**, each with its **paid** subtotal ("paid ₱ 4,400.00"). Each row shows:
   - a division-coloured code tile
   - service, date · vendor
   - the amount
   - a state as dot + label (Paid / Unpaid / Cancelled / Refunded)
   - cancelled and refunded amounts are **struck through**
7. The note "N cancelled booking(s) shown but not counted in Paid."
8. **Load 10 more**.
9. Tap a row → **receipt** sheet: amount, paid-on, service date, booking status, reference, and the state's plain note, with **Print / Share** (`expo-print`, D10).

Rules:
- `refunded` copy is ***"Marked refunded — Ezzy can confirm the amount"***, never money returned (web F18, T9).
- Unpaid cancellations **are listed** (struck through). Web shows them, so mobile must stop dropping them (M2).
- Manila date boundaries throughout (web I19). `lib/transactionFilters.ts` already has `manilaDay`.
- The reference is a PayMongo session id, not a receipt number (web P7); no payment method is shown (web P8).
- States: loading, no payments yet, no matches (with Clear), error (distinct from empty).

### P7 Account (native home for the web drawer's contents; web I16/G1)
Opens from the avatar and holds:
- Name and email.
- **Appearance**: Light / Dark / System.
- **About & Legal**: Terms of Use, Privacy Policy, Acceptable Use Policy, Cookie Policy, Refund & Cancellation Policy, then About Ezzy after a divider. Copied from `booker/lib/legal.ts` with the URLs verbatim, **trailing slashes included** (its header warns they are load-bearing). They open with `expo-web-browser`, which is installed.
- **Sign out** 🧪.
- **Delete account** ⚠️ G4: required by Apple 5.1.1(v), because booker signs people up in-app.
- App version.

### P8 Notifications
Bell → list with read/unread; tapping a notification opens its booking. ✅ `notifications` table. There is no board, so it's adapted.

---

## 6. What exists today (built 2026-09-18 → 09-20, uncommitted)

- **M0 foundation ✅ DONE 2026-09-18.**
  - `theme/` (`tokens.ts` = booker `--db-*`, `AppThemeProvider` with Light/Dark/System in memory, `useAppTheme`).
  - `lib/types.ts`, `lib/bookingStatus.ts`.
  - Mock layer: `mocks/` + `services/` (only services import mocks, all `{ data, error }`, with artificial latency).
  - Primitives: `ScreenShell`, `Card`, `StatusBadge`, `PrimaryButton`, `StagePlaceholder`, `SettingsView`, `dev/DesignKit`.
  - `RootNavigator` (stack + a React Navigation theme built from the tokens) and `AppTabs` (4 tabs; the last one is still labelled **Transactions**).
  - Installed: `expo-linear-gradient`, `@expo-google-fonts/inter`, `react-native-svg`, `lucide-react-native`.
  - Verified: `tsc` clean; web screenshots light/dark reviewed; no console errors.
- **First Payments screen ✅ code DONE 2026-09-20 — must be reworked to P6 (M2).**
  - `lib/transactionFilters.ts` + 10 tests (Manila dates, period presets, paid-only totals, month groups).
  - `lib/format.ts`.
  - `components/common/{SearchField,FilterChip}`.
  - `components/transactions/*`.
  - `package.json` `test` script; `tsconfig.json` `allowImportingTsExtensions` + `types: ["node"]` (copied from vendor-mobile).
  - Verified: `tsc`, `npm test` 10/10, filters driven in the real web build, no console errors. **Visually checked 2026-09-21** in light and dark once I2 cleared: it renders correctly. It also confirms the month subtotal counts unpaid amounts (September ₱12,100 includes the unpaid ₱1,200), whereas the approved design subtotals **paid only**. That's fixed in M2.
  - Differs from P6: chips, totals labels, no vendor filter, sort, reference search, receipt, CSV or Load more, and unpaid cancellations are dropped.
- Preview artifact: https://claude.ai/artifact/PbimGic8VSUJhnGAiuBZBX — **refreshed 2026-09-21 (version 2)** with the current build: Payments (default, filtered, no-match), the Home design kit, the placeholders and Settings, light and dark.

---

## 7. Build stages (M#) — one per turn by default

**Rules for every stage:**
- Every stateful component is `Name.tsx` (render only) + `useName.ts` (state, effects, handlers) + `Name.styles.ts` (`makeStyles(tokens)`). Pure display components have no hook. No static inline `style={{}}` (`.claude/skills/component-separation/SKILL.md`, RN variant).
- 44pt touch targets; type scales with the OS setting; icon-only buttons get `accessibilityLabel`; state is never shown by colour alone.
- Four states on every data surface.
- **Runtime fallbacks on every exhaustive lookup** (`?? fallback`): a status newer than the installed app must not crash a screen (the vendor-mobile lesson).
- Pure rules live in their own `lib/*.ts` with `node --test` tests, and never import `services/` or Supabase.
- Only `services/` imports `mocks/`.

### M1 Foundation sync  ✅ DONE (2026-09-21)
- `tokens.ts`:
  - a **13-slug division map** + `none`, light and dark. Values are provisional until web I3 writes `--div-*`; then copy them verbatim.
  - Provisional light values: the canvas's 8 pairs, plus neutral for Law, Park, Learn, Work and Stay. Dark: ~14% alpha tints of each `fg`.
  - Check 4.5:1 contrast against `cardBg` in both themes.
- **System font (D9):** remove the Inter loading from `app/_layout.tsx` and the `font` families from `tokens.ts` (weights via `fontWeight`, which works with the system font on both platforms). **Uninstall `@expo-google-fonts/inter`** — approved with D9 on 2026-09-21. Re-check tab labels, whose line height was tuned for Inter (the M0 clipping fix).
- `lib/divisions.ts` (slug normaliser, unknown → `none`) + test.
- `lib/bookingProgress.ts` + test: web I1's spec, exhaustive over nine statuses with a `never` check.
- `lib/autoConfirm.ts` + test: copied from `ezzy-vendor-mobile/src/lib/autoConfirm.ts` (the same source as web I2).
- `lib/payments.ts` + test: web I17's rules.
  - `paymentState` → paid / due / cancelled / refunded, exhaustive.
  - `paidTotal`, `dueTotal`, month grouping with paid subtotals, `matchesPaymentSearch` (including reference), `fmtPeso` (two decimals, as web).
  - The refund copy rule, with a test.
  - Supersedes the totals/state parts of `lib/transactionFilters.ts`; its Manila date helpers stay.
- **Sample data re-based on the canvas's** (Maria, Rizal Park Sports Hub, Luna Wellness Spa, SmileCare, Manila Drive Academy, Paws & Suds, …), with:
  - division slugs, staff names, taglines, requirements, agreement titles and status-log timestamps
  - a payment reference per paid booking
  - at least one of each money state: paid, unpaid, cancelled-unpaid, refunded
- Tab rename **Transactions → Payments** (route `payments`).
- **Account screen P7** replaces `settings`, with `lib/legal.ts` copied from booker.
- Bell in `ScreenShell`.
- `DesignKit` re-shown once with division tiles + progress tracks, then removed in M3.
- **Components:**
  - `DivisionTile`, `ProgressTrack` (display + styles)
  - `AccountView` (render + hook + styles)
  - `ScreenShell` (render + hook + styles; gains `openNotifications`)

**Executed 2026-09-21:**
- **Pure rules, each with `node --test` tests:**
  - `lib/autoConfirm.ts` + test, copied verbatim from vendor-mobile (11 tests).
  - `lib/bookingProgress.ts` + test: nine statuses × two patterns, terminal cancelled/refunded, the disputed note, an unknown-status fallback.
  - `lib/payments.ts` + test: `paymentState` (exhaustive), `paidTotal`/`dueTotal`/`countByState`, `groupByMonth` with paid subtotals, `matchesPaymentSearch` (including the reference), `fmtPeso`, and the refund-wording guard.
  - `lib/divisions.ts` + test (slug normaliser; all 13 present; **4.5:1 contrast for every pair in both themes**, with dark tints composited over the card).
  - `lib/manila.ts`: the Manila date helpers, moved out of `transactionFilters.ts`.
  - Pure modules import siblings with an explicit `.ts`, as vendor-mobile does, because `node --test` won't guess extensions.
- **Theme:**
  - `theme/divisionPalette.ts`: 13 slugs + `none`, light and dark, provisional until web I3.
  - `tokens.ts` gains `division` and `trackEmpty`.
  - **System font:** `font` is now weight-only, applied as `...font.x` in every style file; the Inter loading was removed from `app/_layout.tsx`; `@expo-google-fonts/inter` was uninstalled (approved with D9).
- **Types:**
  - `Vendor` + `divisionSlug`, `tagline`, `hours`.
  - `Booking` + `divisionSlug`, `staffName`, `vendorAddress`, `vendorCity`, `vendorPhone`, `requirements`, `paymentReference`.
  - New `StatusLogEntry`.
- **Sample data re-based on the canvas:**
  - 7 vendors and 12 vendor-specific offerings.
  - 12 bookings: the canvas's six, plus an unpaid cancellation, a refund and history. They cover paid, unpaid, cancelled-unpaid and refunded, hourly and date-granular, and session and custody.
  - Derived status-log rows and payment references.
  - `services/bookings.service.ts` gains `getBookingStatusLog`; new `services/notifications.service.ts` + `mocks/notifications.ts` for the bell.
- **Shell:**
  - Tab **Transactions → Payments** (`app/(tabs)/payments.tsx`, credit-card icon).
  - `ScreenShell` gains the **bell** with an unread dot (and a spoken count) → `/notifications` (a placeholder until M7); the avatar → `/account`.
  - **Account screen** (`components/account/AccountView`, render + hook + styles) with `lib/legal.ts` copied from booker, verbatim URLs.
  - New shared display components: `PushedScreen`, `DivisionTile`, `ProgressTrack`. `DesignKit` shows the tiles and tracks for this review.
- **Removed**, moved to the session scratchpad because they were never committed: `components/settings/SettingsView`, `app/settings.tsx`, `app/(tabs)/transactions.tsx`.

**Found and fixed during M1:**
- **The canvas's Pets colour fails contrast.** `#b45309` on `#fdf0dc` is **4.47:1**, under 4.5:1; the new contrast test caught it. Mobile uses amber-800 `#92400e`. → **N6** for the web session.
- **Empty progress segments were invisible in light mode** (`subBg` `#f8fafc` on a white card; seen in the screenshot). There's a new `trackEmpty` token: `#e2e8f0` light, `#26314a` dark (the phone board's colour).

**Verification:**
- Machine: `tsc --noEmit` exit 0; `npm test` **39/39**; the mock-boundary grep is clean.
- Behaviour: Playwright on the real web build, **no console errors** across Home, Explore, Bookings, Account, Notifications and Payments (including filter clicks), both themes.
- Visual: screenshots reviewed in light and dark (division tiles, tracks, Account, bell, Payments tab, tab labels not clipped with the system font); preview artifact **version 3**.
- ⚠️ In headless Linux the system font renders as DejaVu Sans. SF/Roboto on phones and Segoe UI on Windows haven't been seen yet; that needs a device or your browser.
- **Not run:** Android device; iOS (F8); lint (I1).

### M2 Payments to `MobilePayments`  ✅ DONE (2026-09-21)
- Rework the first Payments screen into P6.
- **Components** (the `transactions/` folder is renamed `payments/`, as web I20 does):
  - `PaymentsView` (render + hook + styles; owns period, search, status, vendor, sort, visible count, receipt selection)
  - `PeriodChips`, `PaymentTotals`, `PaymentMonthGroup`, `PaymentRow` (display + styles)
  - `PaymentFiltersSheet` (render + hook + styles)
  - `ReceiptSheet` (display + styles; share/print handlers come from `PaymentsView`'s hook per D10)
- **Installs approved with D10 (2026-09-21):** `npx expo install expo-file-system expo-sharing expo-print`, run from inside the app folder at the start of M2. Re-read the merged Android manifest / `Info.plist` afterwards for added permissions (mobile-dev §3.1).
- **CSV** via the share sheet: `lib/paymentsCsv.ts` + test, the same shape as web I18 (RFC 4180, CRLF, UTF-8 BOM, plain-number amounts, the filtered set, never the visible slice — T10).


**Executed 2026-09-21:**
- **Installs (approved with D10):** `expo-file-system ~57.0.7`, `expo-sharing ~57.0.21`, `expo-print ~57.0.2`, via `npx expo install`.
  - The install added `"expo-sharing"` to `app.json` plugins. That plugin is a **share-*into*-this-app extension**, but both halves default **off** (`ios.enabled` / `android.enabled` = `false`, `node_modules/expo-sharing/plugin/build/withShareExtension.js:19-20`), so it adds no extension target, intent filter or app group.
  - The merged `AndroidManifest.xml` / `Info.plist` can't be read until an EAS prebuild → check at M8.
- **Pure rules + tests:**
  - `lib/paymentsFilter.ts` + test: periods, period labels, filters, chip counts, the sheet badge count, sort, paging, vendor options.
  - `lib/paymentsCsv.ts` + test: web I18's shape, BOM, CRLF, RFC 4180 quoting, filename carries the period.
  - `lib/receiptHtml.ts` + test: **every value escaped**; a hostile vendor name can't inject markup into the print view.
  - `payments.ts` receipt notes now use the board's approved wording for paid, unpaid and cancelled. Refunded keeps the web F18 wording.
- **`services/exports.service.ts`:** the only code that touches files, the share sheet or the print dialog.
  - SDK 57 file API: `new File(Paths.cache, name)` + `create()` / `write()`.
  - Every call returns `{ ok, message }`, so an unavailable share sheet (desktop web) is reported, not silent.
- **Components:**
  - `payments/PaymentsView` (render + hook + styles; the hook owns all state)
  - display + styles: `PeriodChips`, `PaymentTotals`, `PaymentsToolbar`, `PaymentRow`, `PaymentMonthGroup`, `PaymentFiltersSheet`, `ReceiptSheet`
  - shared: `common/BottomSheet` (render + hook + styles; closes from the header, the backdrop and Android back), `common/OptionList` (display + styles); `payments/paymentStateStyle.ts` maps states to colours with a fallback
  - `SearchField` and `FilterChip` are reused
- **Removed** (untracked, moved to the scratchpad):
  - the first Payments screen `components/transactions/*`, `lib/transactionFilters.ts` + test, `services/transactions.service.ts`, the `Transaction` type, and `peso()` in `lib/format.ts` (replaced by `fmtPeso`)
  - `lib/format.ts` gains `longDay()`

**Decisions made while building (all follow the design):**
- **"Last 3 months" = the same day, three months back** (`Payments.dc.html`: "20 June – 20 September"), clamped to the month's end. This replaces Pay-v1's calendar-month start.
- **Sorted by amount → one group** ("Highest amount first"), because month groups would scramble the order the booker asked for.
- **Receipt "View booking" is omitted until M4** creates the booking detail screen. There's nowhere true to send it yet. *(Added in M4.)*
- **"Paid on" reads "Not paid"** for unpaid, cancelled-unpaid and refunded rows, rather than showing a booking date labelled as a payment date.

**Verification:**
- Machine: `tsc --noEmit` exit 0; `npm test` **44/44** (the old `transactionFilters` tests left with their module; Manila month cases now live in `payments.test`); the mock-boundary grep is clean; no static `style={{}}`.
- Behaviour, Playwright on the web build in both themes:
  - default: Paid ₱6,250.00 / 8, Awaiting ₱1,200.00 / 1
  - Load more: 1 → gone
  - Filters → Unpaid: Paid ₱0.00; badge "1"
  - sort sheet → by amount
  - tap a row → receipt
  - CSV → "Sharing isn't available on this device" (expected on desktop web)
  - search "kayak" → the no-match state
  - **no console errors**
- Visual: all states reviewed; the dark default matches the `MobilePayments` board's content order and styling; preview artifact **version 4**.
- **Needs a phone:** the CSV share sheet, printing, share-as-PDF, bottom-sheet gestures and Android back. **iOS: unverified.**

### M3 Home  ✅ DONE (2026-09-21)
- P2 in `MobileHome` order; widgets below "Book again" are **adapted**.
- **Components:**
  - `HomeView`, `NeedsYouCard`, `UpNextCard`, `BookingList`, `OpenSlotsCard`, `ResumeDraftCard`, `FlagReasonSheet` (render + hook + styles)
  - `BookAgainRail`, `DivisionGrid`, `GuideCard` (display + styles)
- Removes `DesignKit` and `StagePlaceholder` from Home.


**Executed 2026-09-21:**
- **Pure rules + tests:**
  - `lib/homeRules.ts`: `needsYou` (exhaustive; confirm → return → payment-info), `upNext`, `daysUntil`/`countdownLabel`, `groupOf`/`groupBookings` (four groups, every status in exactly one), `bookAgain` (by offering id, newest 3), `showGuide`.
  - `lib/directions.ts`: Apple Maps / `geo:` / Google Maps by address.
  - `lib/format.ts`: `weekdayDay`, `time12`, `timeRange`, `bookingWhen`.
  - `lib/bookingActionCopy.ts`: **copied verbatim** from booker, the single source of the action wording.
- **Mock services:**
  - `services/availability.service.ts` (next open times, this weekend's slots) + `mocks/availability.ts`
  - `services/drafts.service.ts` + `mocks/draft.ts`
  - `bookings.service` gains `acknowledgeBooking` / `undoAcknowledgement` / `flagBooking`, mirroring the `acknowledge_booking()` / `raise_booking_dispute()` RPCs
- **Components under `components/home/`:**
  - render + hook + styles: `HomeView`, `NeedsYouCard`, `BookingList`, `FlagReasonSheet`
  - display + styles: `UpNextCard`, `BookAgainRail`, `OpenSlotsCard`, `DivisionGrid`, `ResumeDraftCard`, `GuideCard`, `SearchPill`
  - new shared `common/SecondaryButton` (display + styles)
  - `PrimaryButton` gains a layout-only `style` prop, and side padding goes 24 → 16 to match the board's buttons
- `app/(tabs)/index.tsx` renders `HomeView`. `dev/DesignKit` removed (to the scratchpad; never committed).

**Found and fixed during M3:**
- **Metro missed newly created folders.** It returned HTTP 500 "Unable to resolve ../DivisionGrid/DivisionGrid" although `tsc` resolved it and the file existed. This is a WSL file-watching gap when many directories are created at once. Fixed by restarting Metro with `--clear` (stopped by its listening PID). **If a new folder "doesn't exist" to Metro, restart it with `--clear` before debugging the code.**
- **The screenshots used a wider fallback font than a phone.** Headless Linux has no SF/Roboto, so "system font" rendered as DejaVu Sans, about 20% wider, which wrapped "Yes, all done". The capture scripts now load **Roboto** (Android's font, already in React Native Web's system stack) into the headless browser; that changes screenshots only, not the app. In Roboto the row fits on one line, as the board draws it. All previews were re-shot in Roboto.
- **Division grid truncated the name instead of the hint** ("EzzyHo…"). The name now keeps its space.

**Verification:**
- Machine: `tsc --noEmit` exit 0; `npm test` **55/55**; the mock-boundary grep is clean; no static `style={{}}`.
- Behaviour, Playwright on the web build in both themes:
  - Needs you shows 3 (confirm with the auto-confirm date, return, and "+1 more · Payment not received yet")
  - "Yes, all done" → "Confirmed — payment released" + Undo, and the count drops to 2
  - Undo restores the row
  - "Something's wrong" → a reason → "On hold — Ezzy is looking into it"
  - Up next = tomorrow's Pickleball booking, with the staff name and requirements as information
  - **No console errors**
- Visual: every section reviewed in both themes; matches the `MobileHome` order and cards; preview artifact **version 5**.
- **Not run:** Android device (gestures, sheets, "Get directions" opening Maps); iOS; lint.

### M4 Bookings + booking detail  ✅ DONE (2026-09-21)
- P3.
- **Components:** `BookingsView`, `BookingDetail`, `PhotoGallery` (render + hook + styles); `StatusBanner`, `Timeline` (display + styles).

**Executed 2026-09-21:**
- **Pure rules + tests** (`lib/bookingDetail.test.ts`, 5 tests; `format.test` +1):
  - `lib/statusExplain.ts`: a plain explanation for **all nine** statuses (T1), with a `?? fallback`.
  - `lib/bookingTimeline.ts`: the P2 progress steps, each with its **real time from the status log** where one exists; later steps have none; cancelled/refunded/disputed get a short terminal track.
  - `lib/format.ts` gains `dateTime()` ("Thu 10 Sep, 10:15 AM", Manila).
- **Components under `components/bookings/`:**
  - render + hook + styles: `BookingsView` (loading / error / empty / list), `BookingDetail` (loading / error / missing / ready), `PhotoGallery` (paging, dots, "Photo 2 of 3" label)
  - display + styles: `StatusBanner`, `Timeline`
  - `BookingList` **moved here from `home/`**; Home imports it from `bookings/`.
- **Routes:** `app/booking/[id].tsx` (pushed, title "Booking"); `app/(tabs)/bookings.tsx` renders `BookingsView` (no limit).
- **Links:** Home's "View booking" and rows, the Bookings rows, and the receipt's new **"View booking"** (closes the sheet, then pushes) all open `booking/[id]`. I3's M4 half done.
- **Detail content:** photos, code tile / offering / vendor / staff, status banner, timeline, When (full width), Paid, Where; Get directions, **Call vendor** (`tel:`, N1); "About this service" (N2).

**Decisions made while building:**
- **Pending explanation avoids "You have not been charged".** The design's line may be untrue: bookers pay first and there's no refund mechanism (T9 spirit). Mobile says "Waiting for the vendor to accept your booking." → **N7**.
- **Cancelled / refunded amounts are struck through** on the detail, as on the receipt, so they don't read as money spent (T8).

**Verification:**
- Machine: `tsc --noEmit` exit 0; `npm test` **61/61**; mock-boundary grep clean; no static `style={{}}`.
- Behaviour, Playwright on the web build in both themes:
  - Bookings tab lists all four groups, no limit
  - detail for b-1 (confirmed), b-3 (done), b-4 (item with you), b-7 (cancelled): banner, timeline times, struck amount on b-7
  - gallery swipe → "Photo 2 of 3"
  - every route in: Home "View booking" → `/booking/b-1`; Bookings row → `/booking/b-2`; receipt "View booking" → `/booking/b-1`
  - **no console errors**
- Visual: reviewed in both themes; preview artifact **version 6**.
- **Not run:** Android device (gallery swipe, `tel:` and Maps hand-off, back gesture); iOS; lint.

### M5 Explore  ✅ DONE (2026-09-21)
- P4, plus the vendor's offering list.
- `lib/search.ts` + test (web I4).
- **Components:** `ExploreView`, `ExploreFiltersSheet`, `VendorView` (render + hook + styles); `VendorResult`, `ServiceResultCard` (display + styles). Reuses `SearchField` and `FilterChip`.

**Sync check (2026-09-21):** the canvas is still `1790018466-ea3c`; the web plan's I4/I13/G11 are unchanged. Web hasn't written `booker/lib/search.ts` yet, so the matcher follows the I4 spec. **Diff against web's file when it lands.**

**Executed 2026-09-21:**
- **Pure rules + tests** (`lib/search.test.ts`, 8 tests):
  - `lib/search.ts`: `searchCatalogue` (every token must match; services on name + category + vendor + city + division; vendors on name + tagline + city + division, only for a typed query and only with something to book; orphaned offerings dropped), `applyWhen`, `sortBySoonest`, `cityOptions`, `popularCategories`, `pushRecent`, `resultLine`.
  - `lib/availability.ts`: `openLabel` ("Available now" / "Open today 6 PM" / "Open Sat 10 AM" / "Last spot Sat") and `opensToday`, on **Manila** days (T6).
  - `lib/format.ts` gains `priceSuffix` (" / hr", " / 60 min", " / wk").
  - `lib/divisions.ts` now holds the 13-division list; Home's `DivisionGrid` imports it from there.
- **Mock services:**
  - `availability.service` `getNextOpen` now covers **all 12** services, returning `at`, `today` and `weekend` too. The mock stores timestamps relative to today, and the label is **computed** by `openLabel`, so Home's "Book again" and Explore always agree. Home's labels are unchanged (driven: "Open Sun 7 AM", "Open Sat 10 AM", "Last spot Sat").
  - new `searchHistory.service` (in memory) + `mocks/recentSearches.ts`.
- **Components under `components/explore/`:**
  - render + hook + styles: `ExploreView`, `VendorView`
  - display + styles: `DivisionChips`, `PickerButton`, `ExploreStart`, `VendorResult`, `ServiceResultCard`
  - `SearchField` gains an optional `onSubmit` (the keyboard's search key saves a recent search).
- **Routes:** `app/(tabs)/explore.tsx` renders `ExploreView` and reads `?division=` from Home's grid; new pushed `app/vendor/[id].tsx` (title "Vendor").

**Decisions made while building:**
- **No `ExploreFiltersSheet`.** Where and When are two picker buttons, each opening a `BottomSheet` + `OptionList` (as Payments' sort does). It's one tap less than a combined sheet, and the board draws them as two separate selects. Division chips stay on screen as the board draws them.
- **The When filter looks only at matched services** (T3), fetched 300 ms after typing settles (web G11), and cached per offering. While a Today/Weekend filter waits for times, the screen shows a loading state rather than a half-filtered list.
- **Services open the vendor page for now** (I3). The vendor page lists them unpressable until M6.
- **Home → Explore by division**: the `division` param is applied, then cleared, so picking the same division again later still works (driven twice).
- **Vendor rows get one spoken label**, name first. Without it a screen reader (and Playwright) read the initials badge first ("BC, BGC Court Club…").

**Verification:**
- Machine: `tsc --noEmit` exit 0; `npm test` **69/69**; the mock-boundary grep is clean; no static `style={{}}`.
- Behaviour, Playwright on the web build in both themes:
  - "court" → 8 results (2 vendors + 6 services, soonest first)
  - + Where Taguig → 4; + When Today → 2 (Tennis Court + the vendor)
  - "kayak" → "Nothing matches “kayak” with these filters" → Clear → the start state
  - EzzyWell chip → 2 services
  - search key on "massage" → recent searches become "massage, pickleball, …"; tapping a recent search runs it
  - vendor tap → `/vendor/v-bgc-court`; service tap → `/vendor/v-luna-spa`
  - Home's EzzyPets tile → `/explore` pre-filtered, twice in a row
  - **no console errors**
- Visual: every state reviewed in both themes; preview artifact **version 7**.
- **Not run:** Android device (keyboard search key, sheets, horizontal chip scroll, back gesture); iOS; lint. Web only: the browser draws a focus ring on the search input — native doesn't.

### M6 Offering + booking steps  ✅ DONE (2026-09-21)
- P5.
- `lib/slots.ts` copied from booker, + test.
- **Components:**
  - `OfferingView`, `SlotPicker`, `ScheduleStep`, `DocumentsStep`, `PayStep` (render + hook + styles)
  - `BookingBar`, `ReviewStep`, `BookingDone` (display + styles)

**Sync check (2026-09-21):** canvas still `1790018466-ea3c`; `Offering.dc.html` read in full. The board has no "Who you'll see" block; it comes from P5 / web D7.

**Executed 2026-09-21:**
- **Rules + tests** (97/97):
  - `lib/slots.ts` + `lib/slots.test.ts` **copied byte-for-byte** from booker (`diff` clean; 19 of booker's tests now run here). Keep them identical, as booker and vendor do.
  - `lib/slotPicker.ts` + test (7 tests): occurrences (DB weekday encoding), `slotsForDate`, `remaining` (**overlap** count, booker's rule), `spanAvailable` (every covered block free + fits the window), `upcomingSlots`, `nextOpening`, `leftLabel` / `isLow`, `thisWeekend`, `staffNames`. ⚠️ Occurrences use a **simplified weekly rule** → I6.
  - `lib/format.ts`: `granularityLabel`, `lengthLabel`, `listPrice`, `relativeDay`.
  - `Schedule`, `SlotTaken`, `SchedulesAndTaken` types.
- **One source for every opening time.** New `mocks/schedules.ts` (14 weekly windows with capacity and staff, plus places taken) and `services/schedules.service.ts`. `availability.service` now **derives** `getNextOpen` and `getOpenThisWeekend` from it, so Home, Explore, the service page and the booking steps can't disagree. As a result Home's "Book again" labels now follow the schedules ("Open today 9 AM") rather than the board's fixed text ("Open Sun 7 AM"); "Open this weekend" still reads as the board (2 of 3 left / Last spot / 4 of 6 left / Last spot).
- **`bookings.service.createBooking`** (mock): stores the booking in memory as `pending` + paid, adds its status-log row and takes its places. Real version noted in the code (RLS insert + placement trigger + PayMongo via `create-session`, G1).
- **Components:**
  - `components/offering/`: `OfferingView` (render + hook + styles), `SlotGrid`, `BookingBar` (display + styles). `PushedScreen` gains a pinned `footer`.
  - `components/booking/`: `BookingFlow` (render + hook + styles), `ScheduleStep` (render + hook + styles), `DocumentsStep`, `ReviewStep`, `PayStep`, `BookingDone`, `StepIndicator` (display + styles).
  - Plan names changed while building: `SlotPicker` → `SlotGrid` (display; the flow and the step own the state); `DocumentsStep` and `PayStep` are display (their state is the flow's).
- **Routes:** `app/offering/[id].tsx` (pushed, "Service"); `app/book/[id].tsx` (**modal**, "Book", optional `date`/`start`).
- **I3 finished:** Home "Book again" and "Resume" → service page; Home's weekend slots → the booking steps with that slot chosen; Explore service results and vendor-page cards → service page.

**Decisions made while building:**
- **Documents are skipped** when the offering asks for none (3 steps instead of 4).
- **Every document must be accepted before Pay** (the `offering_attachments` product rule); `requires_signature` asks for a **typed full name**. Nothing is recorded yet → G6.
- **Uploads are simulated**: "Add" attaches a named sample file. A real picker needs a package (approval gate) and storage (G3). The step says so on screen.
- **Pay is simulated** and says so ("Sample app: no payment is taken"). The done screen says "Booking sent … waiting for ‹vendor› to accept", never "confirmed", and promises nothing about declines (N7).
- **Android back** steps back through the flow before leaving it (`BackHandler`).
- **Starts that a longer booking wouldn't fit are shown struck out**, not hidden, with a spoken reason. It's the same placement rule the DB trigger enforces.

**Verification:**
- Machine: `tsc --noEmit` exit 0; `npm test` **97/97**; the mock-boundary grep is clean; no static `style={{}}`.
- Behaviour, Playwright on the web build in both themes (the machine clock read Tue 22 Sep, 08:33 Manila):
  - Pickleball service page: chips, requirements, agreements (sheet opens), "Paolo Reyes", 4 slots, vendor block
  - Book this slot → `/book/o-pkl-rizal?date=2026-09-22&start=10:00`
  - Longer → "2 hrs · Ends 12:00 PM"
  - Documents: Continue disabled with the reason → add 2 files + tick 2 agreements → enabled
  - Review: ₱ 700.00 → Pay → "Booking sent … Paid ₱ 700.00" → View booking → `/booking/b-new-1`, "Awaiting confirmation"
  - Dentist: the signature gates Continue until a name is typed
  - Bike rental (by the day): "Not yet" disabled, "Booking by date isn't available yet"
  - Links: Book again → `/offering/o-msg-luna`; Explore result → `/offering/o-msg-luna`; vendor card → `/offering/o-dtm-luna`
  - **no console errors**
- Visual: every step reviewed in both themes; preview artifact **version 8**.
- **Not run:** Android device (modal presentation, back button inside the flow, keyboard over the signature field, sticky bar above the gesture area); iOS; lint.

### M7 Notifications  ✅ DONE (2026-09-21)
- P8.
- **Components:** `NotificationsView` (render + hook + styles), `NotificationRow` (display + styles).

**Executed 2026-09-21:**
- **Rules + tests** (`lib/notifications.test.ts`, 2 tests; 99/99 overall): `notificationTone` (type → icon tone, **unknown types fall back** to "info", T11) and `relativeTime` (booker's `fmtRelativeTime`, copied).
- **`AppNotification` type** (mapped; `type` kept as a string so types the DB adds later still render).
- **Mock re-written to the real triggers' wording** (20260801000007): "Please Confirm", "Booking Started", "Booking Confirmed", "Booking Rejected … Reason: …", "Booking Cancelled", with `FMMonth FMDD, YYYY` dates, tied to the sample bookings. The old sample "Payment received" was **wrong for this app**: `payment_confirmed` goes to **vendors** (webhook route + the settings row "Sent to vendor…"), so it was removed.
- **`notifications.service`**: `getNotifications(archived)`, `getUnreadCount`, `setReadStatus`, `markAllAsRead`, `archiveNotification` (and back), `archiveAllRead`, `deleteNotification` — booker's service, in memory.
- **Components** under `components/notifications/`; `app/notifications.tsx` renders `NotificationsView`. `StagePlaceholder` had no users left and moved to the scratchpad (it was never committed).
- **The bell now refreshes on focus** (`useScreenShell` → `useFocusEffect`). Tab screens stay mounted, so a count read once at mount kept its dot after everything was read.

**Decisions made while building:**
- **Inbox / Archived** as two chips; bulk "Mark all read" and "Archive read" in the inbox (booker's `markAllAsRead` / `archiveAllRead`).
- **Per-row actions in a sheet** from a "More" button, not swipe gestures: every action stays reachable without a gesture (ux-design), and no gesture library is needed.
- **Delete only from Archived, behind a confirmation**, as booker's panel has it.
- Tapping a notification marks it read and opens `booking/[id]`.

**Verification:**
- Machine: `tsc --noEmit` exit 0; `npm test` **99/99**; mock-boundary grep clean; no static `style={{}}`.
- Behaviour, Playwright on the web build in both themes:
  - Home bell "Notifications, 2 unread" → `/notifications`, 4 in the inbox, 2 unread
  - tap "Please Confirm" → `/booking/b-3`; back → it now reads as read
  - ⋯ → Mark as read → "Mark all read" disappears; Archive read → "You're all caught up"
  - Archived → 5 → ⋯ → Delete… → Delete permanently → 4; ⋯ → Move to inbox → back in the inbox
  - Mark all read → back to Home **without reloading** → the bell reads "Notifications" (no dot); the Explore tab too
  - **no console errors**
- Visual: reviewed in both themes; preview artifact **version 9**.
- **Not run:** Android device (sheet, back from a booking); iOS; lint. Push notifications are out of scope (§1).

### M8 Polish  ✅ DONE (2026-09-22)
- Light + dark pass on every screen at 360 and 390 wide; division-pair contrast; the OS largest-font setting; 44pt targets.
- An **Android device pass** via Expo Go (back gesture, sheets, safe areas, keyboard).
- A side-by-side comparison with `MobileHome` and `MobilePayments` in the preview artifact.
- iOS remains unverifiable from this machine.
**Executed 2026-09-22 (my half):**
- **Sync check:** the canvas moved to version `1790044633-3de8`. `canvas.json` is byte-identical, and every board is exactly the size it was at `…ea3c` (MobilePayments 14,908 bytes, Payments 26,620, Search 18,174, Offering 8,109; MobileHome 13,737 read in full). Treated as a design-tool-only update, as the previous bump was. `Main.dc.html` wasn't diffed byte for byte.
- **Regression after the I8 package update:** all seven stage scripts (Payments, Home, Bookings, Explore, booking steps, Notifications, division hand-off) re-run in both themes. Same behaviour, **no console errors**; only time-of-day text differed ("Tomorrow" after 11 PM Manila).
- **Layout at 360 and 390pt, light and dark, 13 screens:** automated check for anything past the screen edge (none) and for text cut short.
  - Fixed: Home's division hints ("Cou…") now sit under the name.
  - Fixed: "Open this weekend" names, booking-list lines (which hid "unpaid"), payment names, vendor taglines, notification titles and slot staff names wrap to 2 lines instead of cutting off.
  - Re-sweep: nothing overflows, nothing is truncated.
- **Contrast (I9 below):** every text/surface pair measured. Dark passed everywhere. Light failed: status colours as text 2.9–3.8:1 (they're web's `.db-badge-*` -600 shades), muted grey 4.26:1 on the page and the unread tint, red 4.39:1 on the page.
  - Fix: status colours moved to a pure `theme/statusPalette.ts`; light shades one step darker (-700; amber and orange -800); muted light text → the canvas boards' own `#5b6576`.
  - New `lib/statusPalette.test.ts` checks every status colour (as text on every surface and on its own badge) and the muted text, both themes, with shared `lib/contrast.ts`. → **N9** for web.
- **44pt touch targets:** measured every tappable element. ~40 were drawn 32–36pt (the boards' chips and text links, the 32×32 search clear). New `hitSlopFor()` in `theme/tokens.ts` extends each to 44pt without changing its look, applied in 11 components. The browser measures drawn size, not `hitSlop`, so the effect needs a finger on a device.
- **I5 ✅:**
  - Home's search pill opens Explore with the cursor in the search box (`?focus=1`, cleared after use; other links into Explore don't take focus).
  - A division picked on Home scrolls its chip into view: new `useDivisionChips` hook, which scrolls only when the chip is off-screen. Verified EzzyPets and EzzyLaw (13th) land on screen; tapping a visible chip doesn't move the row.
- **Largest OS text size (2×), on the emulator** (font scale set to 2.0; captured 15 screens):
  - Found: Needs you "Yes, all done" squeezed to a word per line; "still with you" squeezed beside its button; Up next's fixed-height band cut its title; tab label "Paymen…"; step labels "Schedu.."; day chip "Toda/y"; Where/When "Any…".
  - Fixed: rows wrap instead of squeezing (flex-wrap with measured thresholds, so at normal size at 360 and 390 they still share a row, verified); the Up next band uses `minHeight`; tab and step labels capped at 1.3× (as platform tab bars do); day chips grow; pickers size to their content.
  - **Not yet re-captured on the emulator** (it was closed before the re-check) → part of the device checklist below.
- **Side by side** with `MobileHome` and `MobilePayments` (both dark, 390pt): same order, cards, chips, totals and states. Differences are the recorded ones (Up next's what-to-bring instead of uploads, web F4; the Payments board draws web's chrome). Preview artifact **version 10**.
- Machine: `tsc --noEmit` exit 0; `npm test` **102/102**; mock-boundary grep clean; no static `style={{}}`.

**Closed 2026-09-22:** the user ran the app on the emulator and accepted M8 ("looks like M8 is good"). That's user acceptance, not an itemised pass: individual results for the checklist below weren't reported, and the 2× text screens were **not** re-captured after the fixes (checked at normal size only). If something from the list turns up later, log it as a new I#.

**Checklist as it stood:**
- ✅ **Emulator font scale reset to 1.0** (2026-09-22, at the user's request; `settings get system font_scale` → 1.0).
- Re-capture the 2× screens after the fixes (emulator).
- The user's device checklist: back button inside Book, sheets, keyboard over search and signature, CSV share + print, dialler / Maps, gesture-bar clearance, gallery swipe, TalkBack on chips and slots, and the 44pt touch areas by finger.

- **How to run it on the emulator (found 2026-09-21):** start `Basic_Android_Phone` on Windows, then `./scripts/start-windows-android-emulator.sh` from `ezzy-booker-mobile` (a byte-identical copy of vendor-mobile's; it applies unchanged). **Plain `npx expo start --android` fails** with Expo Go's "Something went wrong": it hands the emulator `exp://192.168.40.4:8081` (the LAN address), which the emulator can't reach through Windows' firewall for mirrored WSL (logcat: `UpdateFailedToLoad` at `connectSocket`). The script's `adb reverse tcp:8081 tcp:8081` + `expo start --localhost` gives `exp://127.0.0.1:8081`, which Windows forwards to WSL (verified: Windows `127.0.0.1:8081/status` → `packager-status:running`; `localhost` alone times out). Manual equivalent: `adb reverse tcp:8081 tcp:8081 && npx expo start --localhost --android`.
- **First look on the emulator, 2026-09-22 (user):** the app opened on the Home screen after I8, and the user clicked through a few features with no problems. It was slow to first load (the `--clear` rebuild, ~30 s). **This is a smoke test, not the M8 device pass**: the checklist items (back button in the booking steps, sheets, keyboard, share/print, dialler/Maps, safe areas, gallery swipe) are still to be confirmed one by one.
- **Watch for a stale app.** When Expo Go can't reach Metro it may reopen the last cached project for the same URL. On 2026-09-21 that was **vendor-mobile's kiosk** ("Citywide Sports Center … Cannot connect to Expo CLI"). If you see the vendor app, the connection failed; it isn't booker.

### M9 Brand assets from ezzy-vendor-mobile  ✅ DONE (2026-09-22; added 2026-09-21 at the user's request)
- **Goal:** booker-mobile uses the Ezzy app icon and logo that vendor-mobile already has, in place of the Expo template's.
- **Today:** `app.json` still points at the template:
  - `icon` → `./assets/images/icon.png`
  - iOS `icon` → `./assets/expo.icon`
  - Android `adaptiveIcon` on `#E6F4FE` with a template foreground/background
  - splash `./assets/images/splash-icon.png` on `#208AEF`
  - web favicon `./assets/images/favicon.png`
- **Source (read-only):** `ezzy-vendor-mobile/assets/brand/`: `icon-ios.png` (1024², no alpha), `icon-android-foreground.png`, `icon-android-monochrome.png`, `splash-mark.png`, `mark-white.png` (in-app logo), `ezzy-mark.svg` / `ezzy-mark-source.svg`. It was generated and checked by `.plans/2026-07-30-vendor-mobile-brand-assets.md`, which records why each file exists (e.g. the splash mark is padded for Android 12's circular mask; `mark-white.png` is the tight mark for UI).
- **Steps:**
  1. Copy `assets/brand/` into `ezzy-booker-mobile/assets/brand/`. It's a copy, never a link: no cross-app imports.
  2. `app.json`: `icon` and `ios.icon` → `./assets/brand/icon-ios.png`. `android.adaptiveIcon` → vendor's foreground + monochrome on `#034BFC`, dropping the template `backgroundImage`. `expo-splash-screen` → `splash-mark.png`. Web favicon from the brand set.
  3. **In-app logo:** copy vendor's `components/common/BrandMark` (display + styles; it documents the mark's measured proportions) and place it where booker shows its name. Candidates: the Account screen header, and the empty Home/guide state. **Placement to confirm at execution.** Web booker has no in-app logo on these screens.
  4. Remove the template assets made obsolete: `assets/expo.icon`, `assets/images/*` once nothing references them. Move them to the scratchpad; never delete.
  5. Update booker-mobile's README with where the brand assets came from.
- **Points to settle at execution (not blocking M8):**
  - **Same icon as vendor.** On a phone that has both apps (staff who also book), two identical icons are easy to confuse. The labels differ ("Ezzy Booker" / "Ezzy Vendor"). Options: identical (what was asked), or a variant (e.g. a different background colour). **Recommendation: start identical, as asked, and revisit before store submission.**
  - The splash background: vendor's is its dark navy `#04060E`. Booker follows the device theme, so a navy splash in light mode is a visible jump. Check it on the emulator.
**Executed 2026-09-22:**
- **Assets:** `ezzy-vendor-mobile/assets/brand/` → `ezzy-booker-mobile/assets/brand/`: `icon-ios.png`, `icon-android-foreground.png`, `icon-android-monochrome.png`, `splash-mark.png`, `mark-white.png`, `ezzy-mark.svg`, `ezzy-mark-source.svg`. All **byte-identical** (`cmp`). `_master.png` wasn't copied: it only feeds vendor's generator script.
- **`app.json`:**
  - `icon`, `ios.icon` and the web favicon → `icon-ios.png`
  - `android.adaptiveIcon` → vendor's foreground and monochrome on `#034BFC` (template `backgroundImage` dropped)
  - `expo-splash-screen` → `splash-mark.png` at 288, background **`#FFFFFF` in light, `#04060E` in dark** (the plugin's `dark` option).
- **Splash decision, settled by the asset:** the mark is Ezzy blue on transparent, so light mode gets it on white and dark on vendor's navy. That removes the "navy splash in light mode" jump flagged at planning.
- **Icon decision:** identical to vendor, as asked. The concern that staff with both apps could confuse them stays open for the store-submission pass.
- **In-app logo:** `components/common/BrandMark` (display + styles), copied from vendor with one change: it's tinted by a new `brandMark` token (`#034BFC` light, `#ffffff` dark), because booker follows the device theme and vendor's white mark would vanish on light. Placed in the **Account footer** above "Ezzy Booker {version}", the one place the app names itself. Decorative (hidden from screen readers), as vendor's.
- **Template assets retired:** `assets/images/` and `assets/expo.icon/` moved to the scratchpad (`m9-removed`); nothing referenced them. They show as deletions in git.
- **README:** a "Brand assets" section (source, file-by-file use, how to regenerate).

**Verification:**
- Machine: `tsc` clean; `npm test` **102/102**; mock-boundary grep clean; no static `style={{}}`.
- `npx expo config` resolves every new path, and no template path remains.
- `npx expo export --platform android` (into the scratchpad, not the repo) builds, and `mark-white.png` is in the bundle.
- **`expo prebuild` on a scratch copy** (the repo untouched: no `android/`, `ios/` or `dist/`):
  - `ic_launcher.xml` = `iconBackground` `#034BFC` + foreground + monochrome
  - the generated `ic_launcher.webp` **is the Ezzy mark**
  - `values/colors.xml` splash `#FFFFFF`; `values-night/colors.xml` splash `#04060E`
  - `splashscreen_logo.png` exists for both day and night
- Visual: the Account screen in both themes (blue mark on light, white on dark); no console errors; preview artifact **version 11**.
- **Not run:** a real build on a device, so the home-screen icon, themed icon and cold-start splash are **unseen on hardware**. Expo Go always shows its own icon and splash. iOS unverifiable.

- **Verification (as planned):**
  - `tsc`, tests, `npx expo config` shows the new paths and no template ones remain.
  - **Icons and the splash only appear in a build** (EAS or `expo prebuild` + run), **never in Expo Go**, which always shows its own icon. The in-app logo can be checked in Expo Go and in screenshots. A real Android icon check waits for the first booker-mobile build (out of this plan's scope, §1). iOS is unverifiable (no Apple Developer membership).

---

## 8. Decisions

<!-- No stage may execute while any OPEN: line below remains. -->

**Still in force (carried from the deleted plan, renumbered):**
- **D1: Styling mechanism** → co-located `Name.styles.ts` with a `makeStyles(tokens)` factory, `theme/tokens.ts`, `AppThemeProvider`; no NativeWind. Same as vendor-mobile (its D1-A). Resolved 2026-09-18.
- **D2: Look** → booker's, per web D3: `--db-*` + booker's primary blue + division colours only. The prototype's own fonts and surfaces are not used. Resolved 2026-09-18.
- **D3: No login in this plan**: a mock signed-in booker. Resolved 2026-09-18.
- **D4: Navigation** → 4 bottom tabs, avatar → Account screen for the drawer's contents, booking detail and offering as pushed screens, booking steps as a modal stack. Resolved 2026-09-18.
- **D5: Maps** → no map. Directions go to the native maps app by address, and the location filter is **city only**. "Near me" is parked (web P1). Resolved 2026-09-18.
- **D6: Screens without a phone board** → adapted from the desktop board and labelled "adapted". Resolved 2026-09-18.
- **D7: Backend gaps** → built with mock data now and listed in §9. Features web dropped are dropped here too. Resolved 2026-09-18.
- **D8: Previews** → screenshots of the real Expo web build, published to the preview artifact. `npm --prefix ezzy-booker-mobile run web` stays available. Resolved 2026-09-18. *I2 resolved 2026-09-21.*

**Superseded by the web design, not carried over:**
- the old "no sort" Transactions filter decision (web's Payments has sort)
- "Transactions" as the tab name (web D13: Payments)
- the prototype's Plus Jakarta Sans (web D3)
- a Payments range picker (presets only on phone)

**Open:**
- **D9: Font → A, system font; uninstall `@expo-google-fonts/inter`** (resolved and approved 2026-09-21). Web *names* Inter but never loads it, so its users mostly see the system font, and the approved phone boards draw the system stack (§3).
  - **A (rec.):** the **system font** (San Francisco on iOS, Roboto on Android); uninstall `@expo-google-fonts/inter`. This is what the approved phone designs show and what web users actually see. Uninstalling is an approval gate.
  - **B:** keep Inter, which is what web's code *intends*. It looks the same on both phone platforms, but differs from the phone boards.
  - Either way, N3 asks web to decide whether it should load Inter or drop the name.
- **D10: CSV and receipt printing → A, receipt sheet + CSV via share sheet + `expo-print`; three installs approved** (resolved 2026-09-21). Both need packages that aren't installed.
  - **A (rec.):** receipt sheet now; **CSV via the share sheet** (`expo-file-system` + `expo-sharing`); **print the receipt** with `expo-print`. Three `npx expo install`s, each an approval gate. This gives full parity with web D14/D16.
  - **B:** receipt sheet + CSV (two packages); park printing, since the share sheet can already send a CSV or screenshot.
  - **C:** receipt sheet only; hide the CSV button until real data exists.

---

## 9. Backend gaps (G#) — fine with mocks, needed for real data

- **G1 Finish payment for an unpaid booking.** ⏸ PARKED with web P2. `create-session` doesn't check `is_paid`/`status` first, so it could double-charge (web F3). Mobile also needs a **Bearer-token path** on that route, because it only reads the SSR cookie (`booker/app/api/payment/create-session/route.ts:31-33`).
- **G2 Honest "N left" counts.** Booker RLS shows a booker only their own bookings, so client-side counts are wrong (web F1). Needs web's occupancy RPC (web I14, a backbone approval gate); mobile then calls the same RPC.
- **G3 Document uploads aren't persisted** anywhere (web F4). Mobile also needs picker packages once they are.
- **G4 Account deletion for bookers.** `account_deletion_requests` supports `scope = 'user_only'` (`backbone/supabase/migrations/20260821000001_account_deletion_requests.sql:87-88`), but only a service-role route creates requests (`:36-41`), and booker has none. It needs a booker API route that mobile calls over HTTPS. **Blocks App Store submission, not this plan.**
- **G5 Truncated booking list.** `getBookings()` has no paging, and PostgREST caps at 1000 rows (web F17). The real-data plan must page it, as web I5 does.
- **G6 Document agreements aren't recorded.** `booking_acknowledgements` (20260829000001) holds one row per document agreed, with the version snapshotted. Only Vendor Kiosk Mode writes it; the booker web wizard doesn't collect agreements at all. Mobile collects them (and typed signatures) in memory. Needs a booker write path, likely alongside web.
- Parked with web: receipt number (web P7), payment method (web P8), "near me" (web P1), date-granular booking (web P5).

## 10. Sync notes for the web session (N#) — for the user to carry; not actioned here
- **N1** Mobile has **Call vendor** on booking detail; web doesn't. Should web add it?
- **N2** Mobile shows **offering photos + description** on booking detail (your original mobile brief); web's detail modal doesn't.
- **N3** Web **names Inter but never loads it** (`AppShell.tsx:62`; no `@font-face`, Google Fonts or `next/font`). Either load it or drop the name. D9 depends on the answer staying consistent.
- **N4** Booker has **no Delete account** (G4). The Privacy Policy expects one on web too.
- **N6** The canvas's **Pets** division colour (`#b45309` on `#fdf0dc`) is **4.47:1**, under the 4.5:1 floor web I3 must check. Mobile uses `#92400e`; web should match.
- **N7** The design's pending explanation, "You have not been charged for a booking they decline", may be **false**: bookers pay before the vendor accepts, and there's no refund mechanism yet. Mobile says "Waiting for the vendor to accept your booking." Web should confirm the true wording.
- **N8** Two search details for web to settle: (a) the board prints some prices with no unit ("₱ 1,200" dental, "₱ 950" grooming), but `offerings.price` is per booked block, so mobile always names the block ("/ hr", "/ 2 hr"). Web should pick one rule for both. (b) Per web I4 the division **name** is searchable, so "court" also finds everything at an EzzyCourt vendor (e.g. "Paddle Set Rental"). The board does the same; confirm that's wanted.
- **N9** Web's **light** badge colours (`.db-badge-*`: -600 shades, e.g. `#059669`, `#d97706`) are **2.9–3.8:1** as text: under 4.5:1 on their own tint and on white. Mobile uses one shade darker (-700; amber and orange -800), see `theme/statusPalette.ts`. Web's light `--db-text` `#64748b` is 4.26:1 on the page gradient; mobile uses the canvas's own `#5b6576`. Web should match.
- **N10** Booker's `getSlotsForDate` sorts slots by clock text, so a window running past midnight lists "00:00" before "23:00". Mobile sorts by instant (plan I6). Worth fixing in booker.
- **N5** Web's dark muted text (`#64748b`, ~4.1:1) is under the 4.5:1 floor. The approved phone boards already use `#94a3b8`; web's `--db-text` should match.

---

## 11. Issues found during execution (I#)

- **I3 — interim link targets on Home**  ✅ DONE 2026-09-21 (M4: booking links; M6: offering links, driven in Playwright)
  - ✅ "View booking" and the booking rows now open `booking/[id]` (M4; verified by Playwright).
  - "Book again", "Open this weekend" and "Resume" open **Explore** until M6 builds the offering page.
  - **Explore's service results open the vendor page** (M5), and the vendor page's service cards aren't pressable. M6 points both at `offering/[id]` (`useExploreView.openService`, `VendorView`).
  - These are deliberate stand-ins, not dead buttons. They're marked in `components/home/HomeView/useHomeView.ts`, and M4/M6 must retarget them (M4: `openBooking`; M6: `openOffering`).
- **I4 — mock actions aren't stored**  ✅ DONE 2026-09-22 (at the user's request, ahead of the real-data plan)
  - **Was:** Home's "Yes, all done" / "I've returned it" / "Something's wrong" changed status in Home's own state only, so the booking detail, the Bookings tab and Payments showed the old status.
  - **Fix, mock layer (`services/bookings.service.ts`):** `acknowledgeBooking`, `flagBooking` and `undoAcknowledgement` now **store** the change, as the real RPCs' triggers would:
    - they replace the booking in `MOCK_BOOKINGS` (new `status` and `statusChangedAt`) and append a `booking_status_log` row;
    - Undo restores the previous status and drops that row, and now takes the booking id (`undoAcknowledgement(id, previous)`; Home's one caller updated);
    - the booking is replaced, never edited in place, and `getBookings` returns a copy of the list, so Home's loaded list keeps the acted-on row in Needs you with Undo.
  - **Fix, screens:** Home, Bookings and Payments load on **every focus** (`useFocusEffect`), not just their first mount. Tab screens stay mounted, so otherwise they'd miss a change made elsewhere; this is part of P1's refresh-on-return. Since I10 a refresh sets state only in the fetch callbacks, so it never flashes the loading state.
  - **Behaviour to know:** once you leave Home after acting, the acted-on row leaves Needs you on return (its new status no longer needs you), so Undo is only available until you navigate away. Real data behaves the same way.
  - **Verified (Playwright, in-app navigation only; a page reload resets the mock):**
    - Confirm on Home → Bookings tab "Completed"; the detail says "Completed", with the Completed step timestamped now; Home's Needs you 3 → 2.
    - Confirm then Undo → "Confirm completion" in Bookings and on the detail.
    - Flag → Bookings "On hold — Ezzy is reviewing"; the detail "On hold".
    - Book a massage → back on Home, Upcoming 2 → 3; Bookings lists it "Awaiting confirmation"; Payments Paid ₱6,250 → ₱7,100 (9 payments).
    - Home, Payments and Bookings scripts re-run in both themes, no console errors; `tsc`, 102/102, lint clean.
  - **Not tested by unit test:** services import mocks through the `@/` alias, which `node --test` can't resolve; covered by the browser runs above.
- **I5 — Explore polish, for M8**  ✅ DONE 2026-09-22 (search focus + chip reveal, driven in Playwright; TalkBack still in the device checklist)
  - A division pre-selected from Home can sit off-screen in the chip row (EzzyPets is 5th of 13). Scroll the selected chip into view.
  - Web focuses the search field when it opens Explore (web I16); mobile's Home search pill just switches tab.
  - The division chips' selected state is set through `accessibilityState` like `FilterChip`'s. The web build doesn't expose it as `aria-selected`, so check it with TalkBack on the device pass.
- **I6 — simplified occurrence rule**  ✅ DONE 2026-09-22
  - **Was:** `slotPicker.isOccurrence` handled weekly windows only.
  - **Now:** new `lib/occurrence.ts`, ported from `booker/services/schedules.service.ts` (`isOccurrence`), the **fifth** copy of a rule whose authority is `check_booking_placement()` (20260803000005). It handles `none` / `weekly` / `biweekly` / `monthly`, the start/end date bounds, and date-granular schedules (the range IS the availability — recurrence and weekdays don't apply). `Schedule` gains `recurrence`; the sample windows are all weekly.
  - **Deliberate difference from the web copies:** dates are Manila calendar days compared at UTC midnight, not the device's local midnight (a phone can be in any zone, T6). For calendar-date inputs both give the same answer — asserted below.
  - **Also ported: counting by instant.** `remaining` compared clock times within one date; booker counts by real instants because a window running past midnight puts its later slots on the **next** day (the `booked_date`), while the occurrence stays the opening day. New `slotBookedDate`, `slotInstant(slot)`, and `slotsForDate` now sorts by instant — booker sorts by clock text, so its list would read "00:00" before "23:00" for such a window (worth raising there → N10).
  - **Still for the real-data plan:** booker's `getSlotOccupancy` queries **two** dates for exactly this reason; mobile's mock takes the places it already knows. Port the two-date query with the real RPC (G2).
  - **Verified:** `lib/occurrence.test.ts` — vendor-mobile's fixture cases (weekly, several weekdays, biweekly, monthly, none, date-granular in/out of range) **plus a year-long cross-check against a verbatim copy of booker's function**, for all four recurrences and both granularities. New overnight tests: the 00:00 slot is booked under the next day, its occurrence stays the opening day, and a place taken after midnight counts against the right slot. 111/111; `tsc` and lint clean; the service page, booking steps, Explore "When" and Home "Book again" re-run in the browser unchanged, no console errors.
- **I7 — leaving the booking steps doesn't save a draft**  ✅ DONE 2026-09-22 (in memory; device storage still to come)
  - **User's choice 2026-09-22:** keep the draft **in memory** for now rather than install AsyncStorage. It survives leaving the steps and moving around the app, and is lost on an app restart. Only `services/drafts.service.ts` changes when device storage lands (real-data plan).
  - **Saved as they go, not on the way out.** The first attempt saved on unmount; leaving unmounts the steps while Home is already reloading, so Home read the draft before it was written. Now `useBookingFlow` writes the draft whenever the chosen slot, length or step changes — the shape web's `localStorage` draft has (web I11).
  - **Nothing is kept until there's something to resume:** a slot chosen, or a step taken. Backing straight out of the steps leaves no draft.
  - **Resume** reopens the steps with the slot and the length restored (`/book/[id]?date&start&qty`), at the **first** step: documents aren't kept (G3), so resuming further in would let a booking through without them. Home's card still shows which step they reached.
  - **Booking clears it**, so there's nothing stale to resume.
  - `services/drafts.service.ts` gains `saveDraft` and a real `Draft` type (was `typeof MOCK_DRAFT`); the seed draft carries the new fields.
  - **Verified (Playwright, in-app navigation):** seed draft shows; start a booking, set the length to 2 blocks, reach Documents, leave → Home shows "Swedish Massage · stopped at Documents"; Resume → `?date=2026-09-23&start=10:00&qty=2`, "120 min · Ends 12:00 PM", Continue enabled; finish the booking → the card is gone. `tsc`, lint, 111/111; Home and the booking steps re-run in both themes, no console errors.
  - **Noticed, for the device pass:** the selected slot's state is set through `accessibilityState.checked`, which React Native Web doesn't expose as `aria-checked`, so it can't be confirmed in a browser. TalkBack on the device pass (already listed under I5) covers it.
- **I8 — the app crashes natively in Expo Go on Android**  ✅ DONE 2026-09-22
  - **Symptom (2026-09-21, emulator):** stuck on the loading screen, then Expo Go closes. The bundle loads (`Running "main"` from `exp://127.0.0.1:8081`, manifest "Ezzy Booker"), then **0.3 s later: `SIGSEGV` on the JS thread in `libworklets.so` → `libhermesvm.so`** (tombstone in logcat).
  - **Cause:** the project's packages are older SDK-57 patch versions than Expo Go 57.0.9's built-in native code. `npx expo install --check` lists 16. The crash site is `react-native-worklets` **0.10.0** (expected 0.10.1), with `react-native-reanimated` 4.5.0 → 4.5.1 and `react-native` 0.86.0 → 0.86.3. vendor-mobile, on the expected versions (expo 57.0.24, worklets 0.10.1), runs in the same Expo Go.
  - **Why the web previews never showed it:** the web build doesn't load the native worklets library.
  - **Fix:** `npx expo install --fix` in `ezzy-booker-mobile` (SDK-57-compatible patch updates only; an approval gate), then restart Metro with `--clear` and re-run tsc, tests and the Playwright passes.
  - **Executed 2026-09-21 (user-approved):** 16 packages moved to SDK 57's expected patch versions (expo 57.0.24, react-native 0.86.3, react-native-worklets 0.10.1, react-native-reanimated 4.5.1, expo-router 57.0.22, …). `expo install --check` now reports "Dependencies are up to date". `app.json` gained the `expo-image` plugin entry (Expo's own addition). The previous `package.json`/`package-lock.json` are kept in the session scratchpad. `npm audit` reports 21 advisories, which were **not** touched (no `audit fix`: beyond the approved change).
  - **Verified 2026-09-22:** `tsc` clean, 99/99 tests. On the emulator after `adb reverse` + `expo start --localhost --android --clear`: `Running "main"` at 10:04:15, **no `SIGSEGV`**, gesture handler up at 10:04:47, and the screen shows Home ("Hi, Maria", Needs you 3, Up next). The first `--clear` load takes ~30 s. The Playwright web passes were **not** re-run after the update; that's the first job of M8.
- **I9 — light-theme text below 4.5:1**  ✅ DONE 2026-09-22 (see M8). Status colours one shade darker in light mode; muted text `#5b6576`; a test now guards both themes. → N9.
- **I1 — no lint setup**  ✅ DONE 2026-09-22 (install approved by the user: "continue with I1")
  - **Installed (dev only):** `eslint` ^9.39.5 and `eslint-config-expo` ~57.0.2, the versions `npx expo install` resolved for SDK 57 (vendor-mobile: ^9.0.0 / ~57.0.2). Expo put `eslint-config-expo` under runtime `dependencies`; it was moved to `devDependencies` to match vendor, and `npm install` re-synced the lockfile (no other packages changed). The previous `package.json`/lockfile are in the scratchpad (`pre-i1`).
  - **Config:** `eslint.config.js` copied **byte-identical** from vendor-mobile (flat config: `eslint-config-expo/flat`, ignores `dist/*`). `npm run lint` (`expo lint`) was already the script.
  - **First run: 14 errors, all in code from this build** → I10 (fixed). `npm run lint` now exits 0 with no output.
  - Outside `npm run lint`: a bare `eslint .` also reports a generated `.expo/types` directive and `__dirname` in the unused `scripts/generate-brand-assets.js` (copied from vendor by the user; not part of this app). Not changed.
- **I10 — React 19 hooks-rule violations found by the first lint**  ✅ DONE 2026-09-22
  - **`react-hooks/set-state-in-effect`, 10:** eight data hooks (`useHomeView`, `useBookingsView`, `useBookingDetail`, `usePaymentsView`, `useExploreView`, `useVendorView`, `useOfferingView`, `useBookingFlow`) set `"loading"` / `"missing"` synchronously inside the loading effect. Fix (the shape `useNotificationsView` already had): the effect only starts the fetch; `"missing"` is the initial state when there's no id; a new `retry` sets `"loading"` then fetches. Also Explore's `?division=` hand-off and the flag sheet's reset-on-open now use React's "adjust state when a prop changes" pattern during render instead of an effect.
  - **`react-hooks/refs`, 4:** `DivisionChips` read handlers off a hook result that also carried a ref. Now destructured, and the chip `onLayout` is an event callback.
  - **Verified:** lint exit 0; `tsc` clean; 102/102; every Playwright script re-run (Home actions and flag, Explore incl. the division hand-off twice, Bookings, Payments, the full booking, Notifications, search focus): same results, no console errors. Flag sheet: type a reason, close, reopen → the field is empty.
  - **Not exercised:** the "Try again" path. The mock services never return an error, so there's no way to trigger it without editing a mock.
- **I2 — Playwright screenshots stopped working (2026-09-20)**  ✅ DONE 2026-09-21
  - **Symptom (2026-09-20):** every `page.screenshot()` timed out, even on a blank page, with both bundled browsers; `page.click()` hung on its stability wait; one CDP call reported the renderer closed.
  - **Resolution:** it cleared on its own. On 2026-09-21 a blank-page screenshot succeeded first time, with **nothing reinstalled or reconfigured** (Chromium 149.0.7827.55, the same build). The likely cause is resource contention: load average was **4+** during the failures and **0.2** when it worked. That's an inference, not proven, since the failure no longer reproduces.
  - **Verified:** 14 screenshots of the real app (5 routes plus 2 Payments interactions × light/dark), captured with **normal, unforced clicks**, with **no console errors**, and published to the preview artifact (version 2).
  - **If it recurs:** check `uptime` first. With a high load average, wait or stop other heavy work, then retry before reinstalling anything. `npx playwright install chromium` is the next step after that.
  - The capture scripts live in the session scratchpad, which is cleared between sessions; recreate them from this description if needed.

---

## 12. For the later real-data plan (carried from the deleted buildout plan)
- **A guarded `<Stack>` must set `initialRouteName` from the first commit.** When a `Stack.Protected` guard empties the stack, expo-router falls back to the first *declared* screen. In vendor-mobile that was `reset-password`, so every sign-in landed on a reset error. `unstable_settings.anchor` doesn't cover this. See `.plans/2026-07-29-vendor-mobile-guard-fallback-route.md` §2.
- "Back to sign in" must `replace('/')`, not go to `/sign-in`: that route sits behind a `!signedIn` guard, so the navigation is silently dropped while a session exists.
- **Session storage is open.** `expo-secure-store` caps iOS Keychain values at around 2 KB; vendor-mobile removes the cap with a chunking adapter, which is the tested reference.
- PKCE auth with `detectSessionInUrl: false`; the `AppState` start/stop of auto-refresh; `react-native-url-polyfill`. All as vendor-mobile does.
- TanStack Query for refetch-on-foreground was proposed and never installed; weigh it then.
- Biometric unlock was deferred (`expo-local-authentication`).
- G1, G2, G4, G5 above.

---

## 13. Execution order
1. ✅ D9, D10 resolved 2026-09-21.
2. **M1** foundation sync → stop, report, preview.
3. **M2** Payments → stop. It comes before Home because a screen already exists to rework, and it has an exact phone board.
4. **M3** Home → **M4** → **M5** → **M6** → **M7**, one per turn.
5. **M8** polish.
5a. **M9** brand assets from ezzy-vendor-mobile (added 2026-09-21).
6. Then write the real-data plan (§12) — written 2026-09-22: `.plans/2026-09-22-booker-mobile-real-data.md`.

I2 is resolved (2026-09-21), so every stage can now be verified visually as well as by machine.

## 14. Verification
- **Every stage, machine checks:**
  - `ezzy-booker-mobile/node_modules/.bin/tsc --noEmit --project ezzy-booker-mobile/tsconfig.json`
  - `npm --prefix ezzy-booker-mobile test`
  - a grep showing that nothing outside `src/services/` imports `src/mocks/`
  - `npm run lint` (I1, since 2026-09-22)
- **Every stage, behaviour:** Playwright drives the real web build. The console must be free of errors.
- **Visual:** light + dark screenshots at 390×844 in the preview artifact, each labelled with its board or "adapted".
- **Needs a device:** gestures, sheets, safe areas and keyboard on Android (Expo Go). **iOS: unverified.**

### Weak-implementation traps (T#) — check at every review
- **T1** A progress or payment-state map that forgets `cancelled` / `refunded` / `disputed`.
- **T2** Grouping or joining on `offerings.code` instead of `id`.
- **T3** The Explore "When" filter computing schedules for the whole catalogue.
- **T4** The auto-confirm date reverting to a flat +3 days.
- **T5** The catalogue refetched on every keystroke.
- **T6** Device-local dates instead of Manila (already bit S5 once).
- **T7** An error state rendering as "no bookings" / "no payments".
- **T8** Paid totals including unpaid or cancelled bookings.
- **T9** "Refunded" worded as money returned.
- **T10** CSV exporting the visible slice instead of the filtered set.
- **T11** A static inline style, or a missing `?? fallback` on a status lookup.

---

## 15. Big table

**Who:** Me = Claude, You = the user. Git is always yours; I draft the commit message and file list.

| Done | ID | What | Who | Status | Why / notes |
|:-:|---|---|---|---|---|
| [x] | M0 | Foundation: theme, tabs, mock layer, primitives | Me | ✅ DONE 2026-09-18 | tsc clean; screenshots reviewed then |
| [x] | Pay-v1 | First Payments screen (filters, months, Manila dates) | Me | ✅ DONE 2026-09-20; visual check 2026-09-21 | 10/10 tests; renders in both themes. Subtotal counts unpaid → M2 |
| [x] | Plan | This clean plan; old plan deleted; four docs repointed | Me | ✅ DONE 2026-09-21 | One source of truth |
| [x] | D9 | Font → system font | You | ✅ DONE 2026-09-21 | Matches phone boards and what web users see; Inter uninstalled in M1 |
| [x] | D10 | CSV via share sheet + receipt print | You | ✅ DONE 2026-09-21 | 3 installs approved; run in M2 |
| [x] | Approve | Plan approved; order M1 → M2 → M3 | You | ✅ DONE 2026-09-21 | Stages run one per turn |
| [x] | I2 | Fix screenshot tooling | Me | ✅ DONE 2026-09-21 | Cleared without reinstalling; 14 shots, normal clicks, preview v2 published |
| [x] | M1 | Foundation sync: 13 division colours, progress, auto-confirm, money rules, canvas sample data, Payments tab, Account, bell, system font | Me | ✅ DONE 2026-09-21 | tsc clean, 39/39 tests, no console errors, screenshots reviewed (preview v3). Found N6 (Pets contrast) |
| [x] | M2 | Payments to `MobilePayments` (+ receipt, CSV, print) | Me | ✅ DONE 2026-09-21 | tsc clean, 44/44 tests, every state driven, no console errors, preview v4. CSV/print need a phone to try |
| [x] | M3 | Home to `MobileHome` + web widgets | Me | ✅ DONE 2026-09-21 | tsc clean, 55/55, all actions driven, no console errors, preview v5 (Roboto). Interim link targets → I3 |
| [x] | M4 | Bookings + booking detail | Me | ✅ DONE 2026-09-21 | tsc clean, 61/61, all routes in driven, no console errors, preview v6. Found N7, I4 |
| [x] | M5 | Explore + vendor offerings | Me | ✅ DONE 2026-09-21 | tsc clean, 69/69, every filter and link driven, no console errors, preview v7. Found I5, N8 |
| [x] | M6 | Offering page + booking steps | Me | ✅ DONE 2026-09-21 | tsc clean, 97/97, full booking driven to a new booking, no console errors, preview v8. Found I6, I7, G6 |
| [x] | M7 | Notifications | Me | ✅ DONE 2026-09-21 | tsc clean, 99/99, every action driven, bell dot clears without reload, no console errors, preview v9 |
| [x] | M8 | Polish + Android device pass | Me/You | ✅ DONE 2026-09-22 | My half ✅ 2026-09-22 (regression, 360/390 sweep, contrast, 44pt, I5, 2× text fixes, side by side; preview v10). Closed on the user's acceptance after emulator checks; 2× not re-captured after fixes | Device steps need you. Run on the emulator via `scripts/start-windows-android-emulator.sh` (plain `expo start --android` can't connect) |
| [x] | M9 | Brand assets: vendor-mobile's app icon, splash and in-app logo | Me | ✅ DONE 2026-09-22 | Byte-identical copy; prebuild on a scratch copy shows the Ezzy launcher icon + white/navy splash; logo in Account; preview v11. Unseen on a real build |
| [x] | I3 | Retarget interim links | Me | ✅ DONE 2026-09-21 | Booking links (M4), offering links (M6), all driven |
| [x] | I5 | Explore polish (chip scroll, search focus) | Me | ✅ DONE 2026-09-22 | Driven; TalkBack in the device checklist |
| [x] | I9 | Light-theme text contrast | Me | ✅ DONE 2026-09-22 | Status + muted colours darkened; test guards both themes; N9 for web |
| [x] | I6 | Port booker's full occurrence rule (+ counting by instant) | Me | ✅ DONE 2026-09-22 | New `lib/occurrence.ts`; cross-checked against booker across a year; 111/111 |
| [x] | I7 | Draft kept when leaving the booking steps | Me | ✅ DONE 2026-09-22 | In memory (your choice); Resume restores slot + length; booking clears it |
| [x] | I4 | Mock actions stored; Home/Bookings/Payments refresh on focus | Me | ✅ DONE 2026-09-22 | Confirm, Undo, flag and a new booking all reach the other screens (Playwright) |
| [x] | I8 | Native crash in Expo Go: align 16 packages to SDK 57's expected patch versions | You→Me | ✅ DONE 2026-09-22 | Approved + run; Home renders on the emulator, no crash |
| [x] | I1 | Lint setup | You→Me | ✅ DONE 2026-09-22 | eslint + eslint-config-expo (dev), vendor's config; `npm run lint` clean |
| [x] | I10 | Hooks-rule fixes from the first lint (14) | Me | ✅ DONE 2026-09-22 | 10 set-state-in-effect + 4 refs; all browser checks re-run clean |
| [ ] | N1–N10 | Sync notes to the web session | You | ⬜ TODO | I can't edit web's plan |
| [ ] | Git | Commit per stage (app repo + root repo for plans) | You | ⬜ TODO | |
| [ ] | G1–G6 | Backend gaps | — | ⏸ PARKED | Real-data plan; G4 blocks App Store submission |
