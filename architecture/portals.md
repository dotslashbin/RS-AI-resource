# Portals

Current state, feature inventory, gaps, and roadmap for each of the three portals, followed by the **native mobile clients**. For the tech stack and DB they share, see `overview.md` and `schema.md`.

---

## Ezzy Booker — Booker Portal (`./booker`)

**Audience:** Vendor bookers  
**Portal name in DB:** `booker`  
**Default user role:** `member`

### Purpose

Allow bookers to browse vendor offerings, book a slot at a vendor of their choice, upload required documents, and track the status of their bookings.

### Current Features

#### Booking Wizard (fully wired to Supabase + PayMongo)
A 6-step guided flow:

| Step | UI | Data source |
|------|----|------------|
| 1 — Choose Service | Offering cards with category colour, price and duration | `offerings` table (active, deduped by **code + granularity**) |
| 2 — Choose Vendor | Vendor list + Leaflet map (user location dot) | `vendors` table (filtered by offering code) |
| 3 — Pick Schedule | Calendar + derived slot grid (start–end, spaces left, quantity). **Date-granular offerings get no render arm — see Known Gaps** | `schedules` ÷ the offering's duration; occupancy counted per slot |
| 4 — Upload Documents | Per-requirement file upload with progress bar | `offering.requirements` JSONB field (fetched from DB via `offerings` table) |
| 5 — Confirm | Summary review screen | Review only — no DB writes |
| 6 — Payment | Booking summary + Pay button | Writes booking to `bookings` → creates PayMongo Checkout Session → redirects to PayMongo hosted payment page |

#### Dashboard
- Booking history list (`BookingCard` components), fetched from the `bookings` table on login
- **Live status updates** — a Realtime `postgres_changes` subscription (`bookings` `UPDATE`, filtered to the booker's own `booker_id`) patches the status in place when a vendor confirms/rejects/cancels, no refresh needed.
- Click-to-open booking detail modal
- `InProgressCard` widget: reads wizard draft from `localStorage`; shows step progress and resume button if a draft is present
- **Offering Status** widget (`BookingStatusWidget`): shows the booker's completed bookings as individual cards (2-column grid). Each card has a coloured left border, an offering code badge, vendor name, date, price paid, and a Certificate button (placeholder, via `handleCertificate`). Shows up to 4 most recent completed bookings. Section is visually distinct from "Current Bookings" below it.

#### Transactions Page
- Wired to the booker's real bookings (`TransactionsPage`)
- Summary cards: Total Spent, Bookings, Pending
- Payment history list derived from the booker's bookings

#### Settings Page
- Display name, email, and phone (read-only) — name/email from the Supabase Auth session, phone from `profiles.phone` (via `useSettingsPage`)
- Appearance / dark-mode toggle. **The toggle needs a `mounted` guard** — `resolvedTheme` is `undefined` during SSR, and `ThemeProvider` sets `defaultTheme="dark"` (`app/layout.tsx`), so a first-time visitor resolved to dark on the client while the server had rendered the knob "off". That mismatched on hydration for every such visitor, in both colour schemes, until the guard was added on 2026-08-10. Theme state lives in `useSettingsPage`, not the `.tsx`.
- **Password card** (2026-08-10, `components/settings/SecurityCard/`) — change your own password; see `auth-and-roles.md` → "Changing a password while signed in"
- Logout

#### Navigation
- Bottom tab bar (Dashboard, Booking, Transactions)
- Sidebar with Settings (hamburger toggle)
- Light/dark theme toggle

#### Legal & policy links (2026-08-19)
Policy text is **not** in this repo — the apps link out to the canonical pages on
`ezzy.ph` (Terms of Use, Privacy Policy, Acceptable Use, Cookie Policy, Refund &
Cancellation, About). One copy for Legal to edit, no redeploy, no drift between
portals. URLs live in `lib/legal.ts` per app (copied, not shared). Two surfaces:
a link row at the foot of the login screen, and an "About & Legal" popover at the
bottom of the sidebar, above the account block — which is also the mobile drawer,
so the tab bar is untouched. See `.plans/2026-08-19-legal-links-and-consent.md`.

Signup additionally **gates on agreeing** to the Terms, Privacy Policy and
Acceptable Use Policy: a required checkbox in the register view, re-checked by
`app/api/register/route.ts`, which creates no account without it and records one
row per document in `legal_acceptances`. Booking checkout (Step 6) carries a
Refund & Cancellation Policy **notice**, deliberately not a second checkbox.

#### Progressive Web App (2026-07, live)
Installable to a home screen on Android and iOS. `app/manifest.ts` declares name/icons/`display: "standalone"`; the same hand-rolled service worker pattern as vendor (`public/sw.js`, no dependency) serves a self-contained `offline.html` fallback on failed navigations and cache-first for same-origin static assets, with cross-origin requests (Supabase, Realtime, PayMongo) explicitly never intercepted or cached. A dismissible "Install App" banner (`components/layout/InstallPrompt`) offers a real one-tap install on Android/Chromium, instructions-only on iOS Safari, or a "reopen in Safari" message on other iOS browsers. **Known gap specific to booker:** the Step 6 PayMongo redirect leaves the app's origin — in standalone mode, the return trip from PayMongo's hosted checkout page is not guaranteed to land back inside the installed app window (may open in a browser tab instead); the booking record and webhook `is_paid` flag remain authoritative regardless, so this is a cosmetic risk, not a data-integrity one, but it has not yet been live-tested on real devices. See `.plans/2026-07-18-booker-vendor-pwa-readiness.md`.

### What Is Live vs. Mock

| Feature | Status |
|---------|--------|
| Booking wizard (Steps 1–6) | ✅ Supabase-wired |
| Booking written to DB on confirm | ✅ Supabase-wired (Step 6) |
| PayMongo payment integration | ✅ Live — Checkout Sessions; webhook sets `is_paid` on confirmation |
| Booking history on dashboard | ✅ Supabase-wired (fetched on login); status updates **live** via Realtime (no refresh needed) when a vendor confirms/rejects/cancels |
| Offering Status widget | ✅ Live — completed bookings as individual cards |
| Booking acknowledgement ("Yes, all done" / "I've returned it") + flag | ✅ Live (2026-08) — via the `acknowledge_booking()` and `raise_booking_dispute()` RPCs, the booker's only write paths to `bookings.status`. See `booking-flow.md` |
| In-app notifications | ✅ Live — bell icon, panel (main + archive views), Realtime delivery + arrival toast, optimistic read/archive/delete |
| Installable PWA (manifest, icons, offline fallback, install banner) | ✅ Live — machine-verified (Chrome installability check, offline fallback, install-flow logic); real Android/iOS device install, and specifically the PayMongo checkout round-trip in standalone mode, still need physical-hardware verification |
| Document uploads | ⚠️ In-memory only (no Storage/DB writes) |
| Transactions page (Total Spent / Bookings / Pending + payment history) | ✅ Supabase-wired (derived from bookings) |
| User profile editing | ❌ Not implemented |
| Booking cancellation / reschedule | ❌ Not implemented |

### Known Gaps

- **A date-granular offering cannot be booked at all.** Step 3 detects the mode correctly and computes the bookable span, but `Step3Schedule.tsx` never renders it: the panel shows *"No time slots available for this date."* and `canNext` (`!!date && !!time`) can never pass, because nothing sets a time in this mode. Any offering measured in `day`/`week`/`month` is therefore a dead end for the booker, even though the database validates such bookings fine. The vendor portal can create these schedules today, so the two sides disagree. Full trace in `booking-flow.md` → "Date-granular offerings"; the existing Playwright test is green because it only asserts the absence of slots
- **Document uploads not persisted.** Files are selected and shown in the UI but not sent to Supabase Storage or written to `booking_documents`. The booking record exists but has no attached documents.
- **Vendor map has no vendor markers.** `vendors` table has no `lat`/`lng` columns. The map shows the user's location only.
- **PWA install/payment behaviour on real devices not yet confirmed.** The manifest, service worker, and install-banner logic are machine-verified (Chrome's own installability check reports zero errors), but an actual home-screen install-and-launch on real Android/iOS hardware, and specifically **the PayMongo checkout round-trip from an installed standalone app**, still need physical-device testing before this is considered fully done.

### Roadmap (Approximate Priority)

1. Add lat/lng to `vendors` table; show vendor markers on Step 2 map
2. Implement real document uploads (Supabase Storage + `booking_documents`)
3. Add booking cancellation flow (booker sets status to `cancelled` while still `pending`)
4. Wallet: `wallet_accounts` + `wallet_transactions` tables; deduct price on booking confirm
5. Display contact info (from `schedules.contact_name`) on booking confirmation and detail screens
6. ~~Push/in-app notifications when booking status changes~~ **Done** — full notifications system live
7. Real-device PWA verification — Android/iOS install-and-launch, and specifically the PayMongo checkout round-trip from an installed standalone app

---

## Ezzy Vendor — Vendor Portal (`./vendor`)

**Audience:** Vendor administrators  
**Portal name in DB:** `vendor`  
**Default user role:** `vendor-admin` (in `vendor_members`)

### Purpose

Allow vendor administrators to define their service catalogue, set up schedule availability, manage their staff roster, and handle incoming bookings from bookers.

### Current Features

#### Registration Flow (KYC-gated)
Vendor operators self-register via a **6-step** flow on the login screen: business details (including a required **division** pick — see `schema.md`'s `divisions` table) → account setup → applicant type (company/individual) → documents → identity (Valid ID + Selfie with ID via camera) → review. This is a required **KYC** stage and **no account or vendor record is created until it is submitted** — the form fields auto-save to `localStorage` and files are held in memory. The final submit sends multipart to `POST /api/auth/register`, which atomically (rollback on failure) creates and activates the user, grants vendor portal access, creates the vendor (`pending_activation`, with its chosen `division_id`), assigns `vendor-admin`, creates the `vendor_kyc` header, uploads the documents to the private `vendor-kyc` bucket, and notifies Command. After submit the vendor logs in to the KYC status surface (under review / approved-awaiting-activation / rejected → revise & resubmit) until Command reviews and activates. See `vendor-kyc.md`. The vendor's assigned division is shown read-only on the Vendor Profile page — only Command can change it.

#### Overview / Dashboard (fully wired, 2026-08)
One **Period** control at the top drives two labelled groups — **Operations** and
**Earnings** — above the pending-approvals and booking-trends panels.

**Period control** (`components/ui/DateRangeFilter`) — presets Today / Last 7 days /
This month / Last 30 days / This year, plus two date inputs. Defaults to *This month*.
The range lives in the **shell**, not the page, so it survives navigating away and
back. The dashboard passes **no `onClear`**: a range is mandatory here, because every
figure below is a period figure and an all-time count under a period heading is
meaningless. Bookings passes one, because a list with no date filter is its normal state.

> ⚠️ **One control, two clocks.** Operations counts bookings by the day they are
> booked **for** (`bookings.booked_date`); Earnings counts transactions by the day
> money was **received** (`booking_transactions.created_at`). The same dates
> therefore select different rows in each group. Each group states its own clock in
> its caption — "Bookings serviced …" and "Payments received …" — and that wording
> is what makes a single shared control honest. Remove the captions and the two
> groups silently claim to measure the same thing.

**Operations** — three cards. Only one of them follows the Period, deliberately:

- **Pending Approvals** — a *live queue*: everything awaiting a decision, whenever it
  was requested. Ignores the Period, because hiding a request that falls outside the
  selected dates would hide work the vendor still has to do. Drills into Bookings on
  the "Needs you" filter, carrying **no** date range — the count and the destination
  must agree
- **Today's Schedule** — schedules occurring on the current **Asia/Manila** day, so a
  vendor travelling abroad still sees their own business day. Today by definition, so
  also Period-independent; drills into the Calendar with no range
- **Completed** — completed bookings whose service date falls in the Period. The one
  Operations card the control drives, and so the one that carries the range into
  Bookings ("Done" filter + the same dates already applied)

**Earnings** — four cards from `getFinancialsForRange()` (`FinancialSummary`), all
drilling into Transactions with the same range:

- **Gross Income** / **Platform Fee** / **Net Income** / **Payout Released**, related
  by two identities that hold exactly: `gross = platformFee + net` and
  `net = payout + onHold` (`lib/financials.ts`, unit-tested). Read across, they are a
  decomposition rather than four unrelated numbers — which is why Platform Fee sits
  between Gross and Net
- Each shows a **% change vs the previous period** — the previous *calendar month* for
  a whole-month range, otherwise the equal-length block before it. No percentage is
  invented from a zero baseline: `percentChange()` returns null and the card says
  "no prior data"
- **Basis is stated, not assumed.** These figures exclude reversed payouts, and Payout
  counts released + releasable only — a **narrower** basis than the Transactions
  page's own headline. That is why this card says "Gross Income · All payments, incl.
  held" while Transactions says "Collected": the same word on two different numbers
  reads as a bug, two different words do not
- Shows `—` rather than `₱ 0` while loading or on error, so a vendor who earned money
  is never shown a confident zero

**Getting Started guide** — no longer a panel on this page. It is a dialog opened from
the **TopBar**, available on every page (`components/dashboard/GuideModal/`), and
auto-opens once per browser. See "Getting Started guide" below.

> Until 2026-07 this row carried **hardcoded literals**: a fixed `₱ 4,550` "Monthly
> Revenue", a `Apr 2026` caption and a `Apr 23` "Today's Schedule" pinned to a date in
> the past — identical for every vendor on every day. 2026-07 made them real and
> date-scoped; 2026-08 replaced the fixed "this month" scoping with the shared Period
> control and split the row into the two labelled groups above. The narrow
> `getPayoutForRange()` this section used to describe is **gone** — it issued one
> unbounded select and silently understated payouts past PostgREST's `max_rows`
> (measured: 19.7% low on a vendor with 1,253 transactions in range). Its replacement
> `getFinancialsForRange()` pages through `lib/pagedFetch.ts` and reports
> incompleteness rather than hiding it.

#### Offerings Page (fully wired)
- List of the vendor's offerings, grouped or filterable by category
- Add offering form: name, code, category, price **per unit**, duration as a **quantity + unit** (minute/hour/day/week/month), description, requirements. The unit decides how the offering is scheduled and booked; a `month` is stated as 30 days at the point of entry
- Edit offering
- Toggle offering active/inactive (`is_active`)
- Offering category badges (free-text category; colour from a fixed map + neutral fallback)
- Delete offering, behind an inline confirm on the card. Blocked by the database when schedules reference it (FK `23503`), surfaced as "This offering is used in one or more schedules and cannot be deleted" rather than a raw error
- **Live booking count per offering (2026-08)** — a filled badge beside the code and category chips, hidden entirely when zero. Counts **live** bookings only: `cancelled` and `refunded` are excluded, using the same predicate as the schedule page's availability, so the two surfaces cannot disagree. Grouped by `offering_id`, never `offeringCode` — the code is vendor-editable, so grouping on it would move history when a vendor renames one. Derived in-memory from the shell's bookings; no extra query
- **Assigned staff per offering (2026-08)** — a `STAFF` block on the card listing who can deliver it: up to three name chips plus "+N more", **active first**. Non-active staff render muted with their status in text ("Jon Salas · On leave"), never by colour alone, because only *active* staff can be put on a schedule. Renders **nothing** when nobody is assigned — so a slow or failed staff load degrades to silence rather than a false "nobody is assigned". Assignment itself happens from the Staff page (specialties), not here. Derived in-memory from the shell's staff via `lib/offeringStaff.ts`; **no extra query**
  - ⚠️ Matched on **`offering_id`**, via a `specIds` array carried alongside the existing `specs` (codes) on `Staff`. Code-matching is what `ScheduleFormModal` does and looks like the obvious reuse, but it breaks here: `specs` is captured at shell-fetch time while `handleSave` updates the offerings array locally without refetching staff, so **renaming a code from the Edit button inches away would make every chip vanish** until reload. An id cannot change on rename
- **Performance modal (2026-08)** — a "Performance" action on each card opens a small lifetime summary for that offering: **Gross income · Net income · Paid bookings · Avg per booking**, all on one basis (every paid, non-reversed transaction), with a caption carrying the completed count, the amount still on hold and any reversed exclusions. All time; no date control — Transactions already offers an offering filter with a range for period analysis
  - Reads `getOfferingFinancials()` (`services/transactions.service.ts`), which reaches the offering through `bookings!inner(offering_id)`. The **`!inner` is load-bearing**: without it PostgREST filters the embedded object but still returns the parent row, and every offering would show the vendor's entire ledger. Verified against a real database — the same query without it returned 35 rows/₱35,660 for an offering that has 1 row/₱810
  - Sums are delegated to `summariseFinancials()`, the same unit-tested reducer the dashboard uses — no second copy of the money rules. The "still on hold" figure in the caption is labelled **net**, because `onHold` is after-fee while the headline tile beside it is gross
  - Five render states, not three: loading, error, **empty** (no payments yet), **reversed-only** (every payment reversed — the offering *has* sold, so "No payments yet" would be false), and ready. The average is only ever computed under `ready`, which is exactly `countedRows > 0`
- **Post-save schedule prompt (2026-08)** — after an offering saves, a small dialog states *"Offering saved"* and offers the schedule as an optional next step. Shown on create **and** edit; never on a failed save, which is a property of the existing control flow rather than a guard (every failure path in `handleSave` returns before the prompt is set). Dismissing it (`Not now`, Escape, or the overlay) leaves the app in exactly the pre-feature state
  - **Three actions, not two.** An offering may have many schedules — `schedules.offering_id` has no unique constraint and the schema names no "current" one — so the button is **Set up schedule** (none), **Update schedule** (exactly one), or **View schedules (N)** (several). The label and the destination come from one call to `lib/offeringSchedules.ts`, so a button cannot promise an edit form and deliver a list. With several, the Schedule page is filtered and **no modal opens**: there is no non-arbitrary schedule to pick, and the button says so
  - "Has a schedule" means has an **active** one — the count comes from the shell's array, which is `is_active = true`. Deliberately different from `countSchedulesForOffering()`, which counts every row because it answers the duration-flip question instead. Both are right for their own caller
  - Costs **no query**: the shell already holds every active schedule, the same way the booking counts and staff chips above are derived

#### Schedules Page (fully wired)
- Calendar/list view of active schedules, **week starting Sunday** (2026-08)
- **Day markers (2026-08)** — a dot per distinct offering category on that day, plus a guaranteed dot when the day has bookings, capped at three. Each cell is a real `<button>` with an `aria-label` naming its contents ("23 — 2 schedules, 1 booking"), because a 4px dot cannot carry meaning by colour alone. Which days are marked comes from `lib/occurrence.ts`, **not** an inline filter — see the note below
- Add schedule form: title, offering picker, staff picker, and then **one of two shapes chosen by the offering's duration unit** — an hourly offering gets a date, an availability window, recurrence and days-of-week, with a **live preview of the slots that window produces** (and any unused remainder); a day/week/month offering gets a date range and no time controls at all. Switching offering mid-form clears the abandoned mode's fields rather than merely hiding them
- Changing an offering's duration **unit** is blocked while schedules reference it — the flip would leave them deriving zero slots. Narrowing a schedule's window instead *warns* with a count of bookings that fall outside it: those stay valid and must still be honoured
- Recurrence options: none / weekly / biweekly / monthly
- Filter by offering or staff
- Edit and delete schedules
- **Per-slot availability in the day panel (2026-08)** — each derived slot lists as `09:00–10:00 · 2 of 5 left`, or `Full`. Date-granular schedules show a single "This date" row. Occupancy is counted by **overlap**, matching `check_booking_placement()`: a multi-unit booking consumes every slot it covers, and a multi-day booking every date in its span
- **Arriving from an offering save (2026-08)** — the page accepts a `PageIntent.schedule` handoff (see *Shell navigation* below) and opens on the right thing: the form preselected to that offering in create mode, or in edit mode loaded with its one existing schedule. When the offering has several, the page filters to it and opens nothing
  - The handoff is applied **inside** the `getOfferings` callback, not before it. Two things depend on that ordering: the offering cannot be preselected until the array containing it exists, and `useScheduleForm`'s seeding effect re-runs whenever `offerings` changes identity — opening the modal first would let the array land mid-edit and reset fields the vendor had typed into. ⚠️ Reordering this to "open, then fetch" reintroduces both
  - The page filter is seeded **only when the offering has a category**. The offering pills render only while a category is selected, so filtering by an uncategorised offering would leave an active filter with no visible control to clear it
  - Every lookup degrades rather than throws: an offering missing from the fetch drops the whole handoff, and a `scheduleId` that no longer resolves falls through to create mode — coherent, because the offering genuinely has no active schedule left to edit

> **The occurrence rule lives in four places** — `check_booking_placement()`
> (`20260803000005`, the authority), `booker/services/schedules.service.ts`,
> `vendor/lib/occurrence.ts`, and the test that asserts the last two agree across a
> full year. Four copies is forced: `AGENTS.md` forbids cross-app imports and the
> first is plpgsql. `vendor/lib/occurrence.test.ts` is the drift alarm — if it fails,
> reconcile all four rather than patching whichever side is red.

#### Calendar Page (fully wired)
- Monthly calendar view showing schedule dots and booking indicators
- Click a day to see schedules and bookings for that day in a side panel
- Reads the shell's real `bookings` and `schedules` (`AppShell` → `<CalendarPage bookings schedules />`); day markers come from `getDayMarkers()`, which derives dot colours from the data rather than a fixed category vocabulary
- Reached from the sidebar only — absent from `MAIN_TAB_PAGES`, like Transactions and Vendor Profile

#### Staff Page (fully wired)
- List of the vendor's staff, with a stat bar counting Active / On Leave / (Inactive, only when non-zero) / Total Clients
- Add/edit staff form: name, phone, email, experience, specialties (offering codes). **No licence-number field** — an earlier revision of this document listed one; it has never existed in `StaffFormModal`
- Validation: name required. `canSave` gate on the form — disabled until it is met
- Status pill on each card **cycles** active → on-leave → inactive on tap, optimistically, reverting with a toast on failure
- **Status filter (2026-08)** — `All · Active · On Leave · Inactive` via the shared `FilterTabs`, defaulting to **All**, composing with the search box rather than replacing it. All four tabs render at every count, including Inactive at zero: the stat bar hides its Inactive *stat* at zero, which is right for a stat and wrong for a control. No badge counts are passed — `FilterTabs` renders badges in red, which in this app means *work outstanding*, and a red number beside "Active" would read as an alert
  - A card leaving the list when its status is toggled is **correct**, not a bug: it no longer matches the filter, and the stat bar above updates in the same moment as the feedback
  - `FilterTabs` gained an optional `label` here, rendering `role="group"` + `aria-label` (the pattern `DateRangeFilter` already used). Without it the tabs are an unnamed run of buttons whose labels collide with the status pill on every card — "Active" matched three controls
- **Three zero states, never one (2026-08)** — "could not load your staff" / "no staff yet" (offers Add Staff) / "no staff match this filter" (offers Clear filters). A single "no staff found" would state a **falsehood** whenever the fetch failed, which is why `getStaff()` now returns `{ data, error }` instead of swallowing the error and returning `[]`, and the shell carries a `staffError` alongside the array — the same reasoning as `bookingsStatus`. A failed *refresh* after a successful save is treated differently: it keeps the list on screen and raises a toast, because blanking a roster over a refresh failure is worse than showing slightly stale rows

#### Bookings Page (fully wired)
- Incoming booking list with **six lifecycle filter tabs**, not one tab per status. `BOOKING_FILTERS` (`lib/utils.ts`) groups the nine statuses by what the vendor has to *do*: **All**, **Needs you** (`pending`, `returned`), **Active** (`confirmed`, `fulfilled`, `in_progress`), **Done** (`completed`), **Issues** (`disputed`), **Closed** (`cancelled`, `refunded`). Badge counts on "Needs you" and "Issues"
- **Full vendor-side fulfilment (2026-08)** — hand over / mark as done / got it back / undo / flag, with `fulfilActionFor()` in `components/bookings/BookingRow/useBookingRow.ts` picking the action from `(status, fulfilmentPattern)` and every label and hint coming from the single `lib/bookingActionCopy.ts` table, so the wording that tells someone *when money moves* cannot drift between clients. (The booker keeps its own table with its own keys and audience — `booker/lib/bookingActionCopy.ts`; `ezzy-vendor-mobile` mirrors the vendor one.) Flagging goes through `raise_booking_dispute()`. See `booking-flow.md`
- **Live updates** — a Realtime `postgres_changes` subscription (`bookings` `INSERT`+`UPDATE`, filtered to the selected vendor) brings in new bookings and status/payment changes (e.g. a booker cancellation, the PayMongo webhook's `is_paid`) without a refresh; the subscription re-scopes when switching between multiple vendors.
- Approve and reject actions write to the `bookings` table; DB triggers log status changes to `booking_status_log`
- Optimistic UI: state updates immediately on approve/reject; reverts on error with a toast notification (reconciles idempotently with the live Realtime echo of the same change)
- Pending count badge on the filter tab
- Booker name fetched via `profiles` join on `bookings`

#### Transactions Page (fully wired, 2026-07)
Payment history and payout accounting for the vendor's own bookings, read from `booking_transactions` joined to `bookings`/`offerings` (booker contact via the `get_booker_contacts` RPC, since `profiles` RLS blocks a direct join for vendor-admins).

- Table: payment date (with the service date beneath), booker (name + email), offering, amount paid, platform fee (amount + the % that applied), payout, current booking status
- **Reached from the sidebar only** — deliberately *not* in the tab strip. That strip already overflows a 390px viewport at five tabs, so a sixth would sit off-screen behind a horizontal scroll with no affordance. Like Vendor Profile, the page is absent from `MAIN_TAB_PAGES` in `AppShell`, so it renders full-width with no strip
- Summary cards — **Collected / Platform Fee / Total Payout** — computed over the *currently filtered* set, so applying a date range doubles as the date-range payout summary. All three are on the **same basis** (payable rows only), so `Collected = Platform Fee + Payout` always holds, and each caption states the basis it covers ("27 of 33 transactions") **and the period it covers** ("01 Jul 2026 – 31 Jul 2026", or "all time"). Naming the dates is not decoration: without it the cards read as fixed all-time figures and the date range looks like it only filters the table
- **Payout period control (2026-07)** — an always-visible card *above* the summary cards holding presets (This month / Last month / Last 30 days / This year / All time) plus paid-from and paid-until inputs. It sits above the totals so the period and the figure it produces are visible together, and it is deliberately **not** in the collapsible Filters panel — it is the page's primary control, not a refinement. The panel keeps offering only; the date inputs must not be duplicated back into it
- **The date range is applied server-side**, in the `booking_transactions` query, using Asia/Manila day bounds (`>= from 00:00+08`, `< day-after-to 00:00+08`). Search and offering stay client-side *within* the fetched range — so search matches within the selected period, not the whole ledger. This split is deliberate: filtering the range client-side would mean narrowing it could never recover rows past the fetch ceiling, making the truncation banner's own advice impossible to follow
- Range changes are debounced and guarded by a request sequence number, so a slower earlier request can't land last and leave the table showing a period the user has moved off. While a new period loads, the totals dim and their caption keeps describing the **loaded** range, never the pending one
- Search across booker name/email/phone and offering; filter by offering and by the payout period; paginated at 10/page, newest first (no column sorting — deliberately out of scope)
- **An empty period is not an empty ledger** — "No transactions yet" is driven by the vendor's *unfiltered* transaction count, so a period matching nothing falls through to "No matching transactions" with the period control and a Clear filters button still on screen. Keying that state off the filtered rows instead would strand the user on a card with no controls to widen the range
- **Pending, cancelled and refunded transactions stay listed** (the payment really happened) but are excluded from the payout/fee totals, with the payout struck through and the card noting "Excludes N pending/cancelled/refunded". `pending` is excluded because the booker pays at booking time: counting it would credit a vendor for work they have not yet accepted. The single rule lives in `isPayable()` (`lib/utils.ts`), exhaustive over `BookingStatus` so a new status forces an explicit decision; `payoutExclusionReason()` beside it supplies the per-row tooltip, since a struck-through *pending* payout means "not yet" while cancelled/refunded means "not ever"
- **Partial data is never presented as complete** — the service pages `booking_transactions` explicitly against an exact count (PostgREST caps responses at `max_rows` and signals it with HTTP 206, which `supabase-js` does not surface as an error), and orders by `created_at, id` so ties can't shuffle rows across page boundaries. Past a 10,000-row ceiling the page shows a banner naming both counts instead of a total covering only what was fetched. A failed `get_booker_contacts` RPC likewise raises a banner rather than silently blanking the booker column
- **Print / Save PDF** — browser-native `window.print()`, no PDF dependency. Renders the data a *second* time, unpaginated, so a printed or PDF-exported report contains **every row matching the active filter** rather than just the on-screen page. The printed header carries the vendor name, the active filter description, the transaction count, a generated timestamp, and the totals
- **Warnings print too.** The truncated-fetch and failed-booker-lookup notices are rendered into the printed report as well as on screen, as bordered text rather than colour (browsers drop backgrounds). The PDF is the artifact most likely to be filed or reconciled against a bank statement, so it is the worst place to drop a warning that the totals are understated
- Dates are filtered and displayed as **Asia/Manila** calendar dates (`toPhDate`), with both range bounds inclusive of the whole local day — a raw UTC comparison would file a 07:00 PH payment under the previous day
- Fee percentages are **not** recomputed at read time; each row shows the rate snapshotted when it was paid (see `schema.md` → `booking_transactions`)

#### Getting Started guide (2026-08)
A dialog opened from the **TopBar**, so it is reachable from every page rather than
only the dashboard. Auto-opens **once per browser**, keyed on the same `localStorage`
flag the old inline panel used — a vendor who already dismissed the panel is not
onboarded a second time because the guide changed shape.

- **Seven tabs**: Dashboard · Bookings · Offerings · Staff · Schedule · Transactions ·
  Completing. Order follows the app's own navigation. Approving/rejecting is covered
  **inside Bookings**, not as its own tab, because that is where the vendor does it
- Built on **Radix Dialog + Tabs** — both packages were already dependencies, and Radix
  supplies the focus trap, Escape handling, scroll lock and arrow-key tab navigation that
  the app's old hand-rolled `ModalOverlay` lacked. This was the first modal to move; the
  rest followed on 2026-08-15, `ModalOverlay` was deleted, and **every** vendor dialog is
  now Radix — see `architecture/conventions.md` → Component Conventions for the shape they
  all share
- The tab strip **scrolls sideways** rather than wrapping, and carries a right-edge fade
  mask. At seven tabs it overflows the 560px dialog at every width, and a hard-clipped
  final tab reads as a rendering fault rather than as "there is more this way". Note
  that a `toHaveCount(7)` assertion cannot see clipping — this was caught by looking at
  the screenshot
- The **Completing** tab's glossary is derived from `lib/bookingActionCopy.ts`, filtered
  to `stage === "fulfilment"` — never retyped. That table is the single source for the
  copy telling a vendor *when they get paid*, shared with the action buttons and their
  "i" popovers. The approval actions live in the same table and must stay filtered out
  of this tab

> **This is documentation, and it is tested as such.** The version replaced in 2026-08
> had drifted badly: it described three booking statuses when there are nine in six
> filter groups, promised "track completion rates over time" (a feature that does not
> exist), and had no Dashboard or Transactions section at all. `visual-tests/pilot.spec.ts`
> now asserts specific *claims*, not just structure — the Dashboard panel's two-clocks
> explanation, the Transactions panel naming the payment-date clock, and Staff carrying
> its statuses. A stale guide otherwise fails silently in every way a test can see.
> **Change the guide in the same commit as the UI it describes.**
>
> `ezzy-vendor-mobile` keeps its **own** copy (`components/dashboard/GuideCard/guideItems.ts`)
> and has diverged from this one since the rewrite. Separate repos, different feature
> surface (no Offerings or Staff screens) — but the two now tell vendors different
> things about the same product.

> The vendor portal has **no** Wallet page. An earlier revision of this document described one (Balance/Transactions tabs, a `TXNS` constant); no such page, component, or constant exists in the codebase, and this Transactions page is the real home for what that entry described.

#### Packages Page (mock)
- List of offering packages with price, included items, and colour coding
- Driven by `PACKAGES` constant
- Add/Edit/Delete buttons are non-functional

#### Vendor Profile Page (fully wired)
- Display and edit: vendor name, address (Province/City/Barangay pickers, Address Line 1, ZIP Code), phone, email, operating hours, year established, accreditation/license number
- Save changes writes to `vendors` table

#### Settings Page
- Appearance / dark-mode toggle
- **Password card** (2026-08-10, `components/settings/SecurityCard/`) — change your own password; see `auth-and-roles.md` → "Changing a password while signed in"
- Styled with Tailwind utilities on the `sp-*` tokens; this page has no CSS module, so a new card follows the same idiom rather than introducing one

#### Layout
- Sidebar with vendor name (fetched from DB for logged-in user's vendor)
- Light/dark theme toggle
- Multi-vendor support: if a user is `vendor-admin` at multiple vendors, they can switch between them

#### Legal & policy links (2026-08-19)
Policy text is **not** in this repo — the apps link out to the canonical pages on
`ezzy.ph` (Terms of Use, Privacy Policy, Acceptable Use, Cookie Policy, Refund &
Cancellation, About). One copy for Legal to edit, no redeploy, no drift between
portals. URLs live in `lib/legal.ts` per app (copied, not shared). Two surfaces:
a link row at the foot of the login screen, and an "About & Legal" popover at the
bottom of the sidebar, above the account block — which is also the mobile drawer,
so the tab bar is untouched. See `.plans/2026-08-19-legal-links-and-consent.md`.

Registration **gates on agreeing** at step 6 ("Review & submit") — the vendor set
adds the Refund & Cancellation Policy, since vendors are the party those
obligations bind. Re-checked by `app/api/auth/register/route.ts` before the
account is created. Consent is held in `useLoginPage` state and deliberately
**never written to the KYC draft**: a registration resumed days later must not
restore a pre-ticked box.

#### Shell navigation and the page-intent handoff
**There is no router.** `app/page.tsx` is five lines; `useAppShell` holds a `page: PageId`
and `AppShell` renders one page from a `switch`. Every navigation therefore **unmounts the
old page and mounts the new one**, and several features depend on that.

- `goPage(p, intent?)` navigates and stamps an optional **`PageIntent`** with the page it
  is meant for. `intentFor(p)` returns it only to that page, so a stale arrival cannot
  leak onto a surface it was not addressed to
- The intent is **consumed once, at mount** — destination hooks seed their own state from
  it with a lazy `useState` initialiser (`useBookings`, `useTransactionsPage`) and then own
  it. It is deliberately not a shared filter store: two pages reading one mutable range
  would mean clearing a filter on Bookings silently changed Transactions
- Three carriers today: `range` and `status` (dashboard drill-downs into Bookings and
  Transactions) and `schedule` (the Offerings → Schedule handoff described above)
- ⚠️ **`range` and `status` round-trip through the URL; `schedule` deliberately does not.**
  `serialiseAppParams` writes only `page`/`from`/`to`/`status` and `parseAppParams` accepts
  only those, so a schedule handoff can be neither bookmarked nor forged — a query
  parameter that re-opens a modal would re-open it on every load of a saved link
- The URL is a **mirror of shell state**, written with `replaceState` from an effect, not a
  source of truth. Adding page keep-alive or component caching to the `switch` would
  silently break every mount-seeded arrival above

#### Progressive Web App (2026-07, live)
Installable to a home screen on Android and iOS. `app/manifest.ts` (Next's native metadata route) declares name/icons/`display: "standalone"`; a hand-rolled service worker (`public/sw.js`, no dependency) serves a self-contained `offline.html` fallback on failed navigations and cache-first for same-origin static assets — cross-origin requests (Supabase, Realtime) are explicitly never intercepted or cached, so bookings/KYC data is never shown stale. A dismissible "Install App" banner (`components/layout/InstallPrompt`) surfaces the option in-app: a real one-tap install on Android/Chromium via `beforeinstallprompt`; instructions-only on iOS Safari (`beforeinstallprompt` has no iOS equivalent — Apple has never implemented it) or a "reopen in Safari" message on other iOS browsers. Dismissal persists via `localStorage`; the banner hides automatically once installed. Booker has the identical setup (see its own Current Features above). **Command gained the same setup on 2026-08-18** (`.plans/2026-08-18-command-vendor-nav-branding-responsive.md` B5) — it was previously excluded as a desktop admin tool. See also `.plans/2026-07-18-booker-vendor-pwa-readiness.md`.

### What Is Live vs. Mock

| Feature | Status |
|---------|--------|
| Self-registration + vendor creation | ✅ Supabase-wired (KYC-gated atomic Route Handler) |
| KYC onboarding (type → docs → ID/selfie) | ✅ Supabase-wired — private `vendor-kyc` bucket; camera capture; `localStorage` draft resume |
| KYC status surface + revise & resubmit | ✅ Supabase-wired — selective-edit resubmit with Storage cleanup |
| Offerings CRUD | ✅ Supabase-wired |
| Offering → Schedule handoff (post-save prompt) | ✅ Live — client-side only, no query; verified in dev 2026-08-15 |
| Schedules CRUD | ✅ Supabase-wired |
| Staff CRUD | ✅ Supabase-wired |
| Vendor profile | ✅ Supabase-wired |
| Incoming bookings list | ✅ Supabase-wired; new bookings + status/payment changes appear **live** via Realtime (no refresh) |
| In-app notifications | ✅ Live — bell icon, panel (main + archive views), Realtime delivery + arrival toast, optimistic read/archive/delete |
| Installable PWA (manifest, icons, offline fallback, install banner) | ✅ Live — machine-verified (Chrome installability check, offline fallback, install-flow logic); real Android/iOS device install and iOS KYC-camera-from-installed-PWA still need physical-hardware verification |
| Transactions (payment history, payout totals, filters, print/PDF) | ✅ Supabase-wired — reads `booking_transactions`; browser-verified. Mobile print-to-PDF on real devices still unverified |
| **Account completion** (onboarding modal + header indicator) | ✅ Live 2026-08-15 — one authoritative rule in `lib/accountCompletion.ts`, derived from real data (offering count + payout row), never a stored flag. Modal auto-opens once per browser session per vendor while incomplete; the header indicator reopens it. Browser-verified across all six completion states |
| **Payout details** (Settings → bank / GCash / Maya) | ✅ Live 2026-08-15 — app-encrypted at rest, masked-only reads, audited changes. **On staging** since 2026-08-16; ⚠️ **not yet on production** — `backbone/.env` carries both project refs and the CLI is linked to staging |
| Calendar (schedules + bookings overlay) | ✅ Supabase-wired — reads the shell's bookings and schedules |
| Offering performance (per-offering income modal) | ✅ Supabase-wired — `getOfferingFinancials()` over `booking_transactions` |
| Assigned staff shown per offering | ✅ Derived in-memory from the shell's staff — no extra query |
| Staff status filtering (All / Active / On Leave / Inactive) | ✅ Live |
| Getting Started guide (7 tabs, TopBar dialog) | ✅ Live — content asserted in `visual-tests/pilot.spec.ts` |
| Booking status management | ✅ Supabase-wired — approve/reject **and the full vendor side of fulfilment** (hand over, mark as done, got it back, undo, flag) across all nine statuses |
| Booking document viewing | ❌ Not implemented |
| Packages | ❌ Mock data |

### Known Gaps

- ~~**No schedule capacity tracking.**~~ ~~**Duration is asked for twice and enforced neither time.**~~ **Both resolved 2026-08-04** (`.plans/2026-08-03-offering-duration-and-booking-units.md`). Duration is now a structured quantity + unit on the offering, a schedule is an availability *window*, and the bookable slots are derived by dividing one by the other — enforced in the database, previewed live in the vendor form, and shown to the booker with spaces remaining per slot. Capacity was renamed `capacity_per_slot` (default 1) and now means only "how many bookings may share this slot". See `schema.md` → `offerings` / `schedules` / `bookings`.
- ~~**Offering deletion is not implemented.**~~ **Implemented** — the card has a Delete action behind an inline confirm. It is still *restricted* at the database level: schedules RESTRICT on delete, so an offering in use cannot be removed until its schedules are, and the FK violation is surfaced as a plain-language message rather than an error code. Deactivating (`is_active = false`) remains the non-destructive option.
- **Packages page has no backing table.** If packages (bundles of offerings with a combined price) become a real feature, they need a DB schema.
- **Mobile print-to-PDF is unverified on real devices.** The Transactions page's print output is machine-verified in headless Chromium (correct dual-render, all filtered rows present, nav hidden, content paginates instead of clipping, valid PDFs at desktop and 390px widths), but an actual "Print → Save as PDF" from Android Chrome and iOS Safari has not been exercised on physical hardware — mobile print sheets vary by OS and browser version. Same class of gap as the PWA items below.
- **No payout disbursement.** The Transactions page computes and displays what each vendor is owed, but nothing moves money to them; there is no withdrawal or payout run.
- ~~**Payout destinations are collected but nobody can read them yet.**~~ **Closed 2026-08-16** — Command can now read them (`/api/vendor-payout`), so a manual transfer is possible end to end. What remains: there is still **no payout rail** (nothing moves money automatically), `ezzy-vendor-mobile` has no completion surface (C1), and a changed payout destination raises **no notification** (C3) — the change log and the view log are the compensating controls in its place.
- ⚠️ **The encryption key now exists in two apps.** `PAYOUT_ENCRYPTION_KEY` must be byte-identical in `vendor` and `command`, or Command decrypts garbage. Two copies is two places to leak it from; that is the accepted cost of there being no shared-secret path between apps.
- **Paid-then-cancelled money is unreconciled.** A booking paid via PayMongo and then cancelled by the vendor is excluded from payout totals (the vendor didn't deliver), but no refund mechanism exists either, so that amount currently belongs to neither party in the ledger. Fully traceable (a `booking_transactions` row plus a `cancelled` status and a `booking_status_log` entry naming who cancelled), but it needs resolving when refunds or payouts are built — see `.plans/2026-07-25-vendor-transactions-platform-fee.md`.
- **No photo/logo upload.** Vendor profile has no image support yet.
- **KYC approval is advisory.** Command can activate a vendor whose KYC is still `submitted`/`rejected` — no hard gate yet (deferred item 8a; see `vendor-kyc.md`).
- **No signal to the vendor on KYC review.** Approve/reject is only seen on next login — no in-app notification or email yet (deferred item 8b).
- **PWA install/camera behaviour on real devices not yet confirmed.** The manifest, service worker, and install-banner logic are machine-verified (Chrome's own installability check reports zero errors; offline fallback and install-flow logic tested via Playwright), but an actual home-screen install-and-launch on real Android/iOS hardware, and KYC camera capture (`getUserMedia`) from an *installed* iOS PWA specifically (historically quirky), still need physical-device testing.

### Roadmap (Approximate Priority)

1. ~~Schedule capacity view: show booking count vs. max_capacity per occurrence~~ **Done (2026-08-04)** — both sides now show spaces remaining per slot: the booker in Step 3's grid, the vendor in the schedule day panel (`09:00–10:00 · 2 of 5 left`). Capacity is `capacity_per_slot`, counted by overlap so a multi-unit or multi-day booking consumes every slot it covers
2. ~~Booking status: add `completed` transition~~ **Done (2026-08)** — the whole dual-acknowledgement model shipped, not just `completed`. See `booking-flow.md`
3. Booking documents: allow vendor admin to view uploaded documents
4. Vendor logo/photo upload (Supabase Storage)
5. Wire calendar page to real schedules + bookings from DB
6. ~~Notifications when a new booking arrives~~ **Done** — full notifications system live
7. Real-device PWA verification (Android/iOS install, iOS KYC camera in installed PWA) — fold in real-device print-to-PDF from the Transactions page while testing, since it needs the same hardware
8. ~~Wallet / transactions view~~ **Done (2026-07)** — Transactions page live (payment history, fee/payout split, filters, print/PDF)
9. Live-refresh the Transactions page: the shell's existing `bookings` Realtime subscription already fires on the `is_paid` flip, so re-fetching transactions in that same handler is the cheap fix — deliberately deferred, since the page is for reviewing history

---

## Ezzy Command (`./command`)

**Audience:** Ezzy internal operations team  
**Portal name in DB:** `command`  
**User roles:** `admin` or `root` (in `user_roles`)

### Purpose

Platform-wide oversight: activate user accounts, approve vendors, manage portal access, and monitor platform activity.

### Current Features

#### Branding, PWA and navigation (2026-08-18)
Command adopted vendor's approved Ezzy identity and its PWA setup on the same day; see
`.plans/2026-08-18-command-vendor-nav-branding-responsive.md`.

#### Legal & policy links (2026-08-19)
Policy text is **not** in this repo — the apps link out to the canonical pages on
`ezzy.ph` (Terms of Use, Privacy Policy, Acceptable Use, Cookie Policy, Refund &
Cancellation, About). One copy for Legal to edit, no redeploy, no drift between
portals. URLs live in `lib/legal.ts` per app (copied, not shared). Two surfaces:
a link row at the foot of the login screen, and an "About & Legal" popover at the
bottom of the sidebar, above the account block — which is also the mobile drawer,
so the tab bar is untouched. See `.plans/2026-08-19-legal-links-and-consent.md`.

**No consent gate here, by design:** Command has no self-registration — its users
are provisioned by admins — so there is no flow for a checkbox to attach to. Links
only.

- **Brand assets are copies of vendor's, not originals.** `app/favicon.ico` (previously
  still the Next.js scaffold default), `app/icon.svg`, `app/apple-icon.png`,
  `public/icons/*` and `components/ui/BrandLogo` are byte-identical to vendor's. The
  single source of truth stays `vendor/brand/*.svg` + `vendor/scripts/generate-brand-assets.mjs`;
  the generator is deliberately **not** duplicated here (it needs `playwright` + `sharp`
  to regenerate assets that change approximately never). ⚠️ Editing `BrandLogo.tsx`
  locally silently forks the brand — see `command/README.md`.
- **Installable PWA** — `app/manifest.ts`, `public/sw.js`, `public/offline.html`,
  `components/layout/InstallPrompt`, registered from `useAppShell`. Same worker as
  vendor and booker: network-first on navigations (so stale admin HTML is never
  served), cross-origin requests to Supabase never intercepted. ⚠️ **A registered
  service worker outlives the code that registered it** — reverting these files does
  not unregister it from browsers that already have it.
- **Persistent Home control** in `AppHeader`, with a chevron trail (`[home] › Section`)
  that renders only when away from Overview. Vendor has the identical control in its
  `TopBar`, where the gap was sharper: four sidebar-only pages render no tab strip at
  all, so the hamburger was the only route home.
- **Browser Back now steps back through visited pages** in both Command and vendor,
  instead of exiting the app. This closes the loss recorded at
  `.plans/2026-08-12-vendor-dashboard-range-and-drilldown.md:715`. One history entry
  per page navigation; **filter/date changes still use `replaceState` and add none**,
  which is the constraint that plan's D1 exists to protect. Command's entries are
  URL-less (`pushState({ page })`), so unlike vendor it still cannot deep-link and a
  mid-stack reload returns to Overview.
  ⚠️ Machine-checked only — the back-button behaviour has **not** been exercised in a
  signed-in session, because neither app has a harness that can reach one.

#### Overview / Dashboard
- KPI widgets: active vendor count (live from `vendors`), total bookings, platform revenue, held wallet funds (latter three are seeded)
- Booking trend and vendor trend charts (seeded)
- **Fulfilment Oversight card (2026-08, live)** — `FulfilmentOversightCard`, backed by `oversight.service.ts`. Surfaces stale `in_progress` bookings (out longer than `STALE_AFTER_DAYS = 14`), the auto-completed count, and the open-flag count, and links through to the Flag Queue. This card exists because **`in_progress` is the one status with no timer**: `auto_acknowledge_bookings()` deliberately never advances it, since an asset that never came back must never auto-complete and pay the vendor. Correct — but it means a rental whose booker vanishes sits frozen forever and nothing else would tell anyone.

#### Flag Queue (2026-08, fully wired)
`components/flags/FlagQueue`, backed by `disputes.service.ts`. Lists open `booking_disputes` oldest-first (served by the partial `booking_disputes_open_idx`), showing who raised each flag, their reason, the booking, and the current `booking_transactions.payout_status`. Resolving calls `resolve_booking_dispute()`, which closes the flag and moves the booking to `completed` / `refunded` / `cancelled` in one transaction. **Command is the only party that can resolve a flag** — there is no counterparty response and no self-service withdrawal, so a flag raised in error is resolved back to `completed` by the same action.

#### Payouts Page (2026-08, fully wired)
`components/payouts/PayoutsPage`, backed by `payouts.service.ts`. Reads `booking_transactions` grouped by `payout_status` (`held` / `releasable` / `released` / `reversed`) with vendor, offering, service date, amount, fee and payout. Bulk release calls `release_booking_payouts(uuid[])`, the Command-only definer RPC. **"Owed back" is where a post-release refund surfaces** — `released` is never downgraded, because money that has left really has left, so reversing it after the fact has to be visible rather than papered over.

> ⚠️ `payout_status = 'reversed'` means the **vendor** will not be paid. It says nothing about whether the *booker* was refunded — there is no refund mechanism in this system. Never label it "Refunded" in any UI.

#### Admin override
`admin_override_booking_status()` lets Command move a booking a third party otherwise could not, and **requires a reason**, which lands in `booking_status_log.notes`. Dispute resolution is exempt — it carries its own `resolution_notes`.

#### Users Page (fully wired)
- List of all profiles across all portals, fetched from `profiles` + `user_portals` + `user_roles`
- **Refresh button** in the toolbar re-fetches the list in place (no page reload) — pairs with the live `new_user_registration`/`vendor_pending_approval` notifications, since the table itself is not Realtime-subscribed.
- Create user: `POST /api/users` server route (uses `auth.admin.createUser` via service role key; `handle_new_user` trigger creates the profile row, then portals and role are inserted). The route is **caller-gated** — verifies the requester is an active command admin/root server-side before any service-role action.
  **Created accounts have no password and no email is sent** — `createUser` is called without one, and nothing notifies the new user. Their only way in is "Forgot Password" on whichever portal they were granted. The UI says so explicitly since 2026-08-10: a note in the create modal, and a success toast repeating it. The action was relabelled **"Add User" / "Create User"** at the same time — it previously read "Invite User", promising an email the product never sent.
  Sending that email is *not* implemented and is blocked on a real gap: the route grants any portal, but Command holds no configuration describing the vendor or booker origins, so it cannot address a set-password link to the portal a new user actually belongs to.
- Edit user: updates `profiles`, reconciles `user_portals` and `user_roles` client-side (RLS permits command admins)
- Delete user: `DELETE /api/users?id=<uuid>` server route (uses `auth.admin.deleteUser`; cascades to profile, portals, roles). Same caller-gate; also blocks self-deletion.
- Toggle status: flips `profiles.status_id` between active and suspended

#### Vendors Page (fully wired)
- List of all vendors, fetched from `vendors` + `statuses` + `divisions`, shown as a card grid with the assigned division displayed as a badge
- **Refresh button** in the toolbar re-fetches the list in place (no page reload) — same rationale as the Users page.
- Add vendor: inserts to `vendors` with `name`, `accreditation_no`, `region`, `branches`, `phone`, `email`, `division_id` (division is required on both add and edit)
- Edit vendor: updates the same fields, including reassigning the division at any time
- Toggle status: flips `vendors.status_id` between active and suspended (governed by the `prevent_vendor_status_self_update` trigger — only command admins may change status)
- Delete vendor: only available to `root` role; deletes the `vendors` row (cascades to offerings, staff, schedules)
- Vendor-list state is held in `useAppShell` and passed to both VendorsPage and OverviewPage so both see live counts
- **KYC review:** the vendor detail modal (`VendorViewModal`) has a KYC panel showing the applicant type, status, and uploaded documents (View via signed URL), with a packet-level Approve / Reject + notes action that writes to the `vendor_kyc` header. Approval is advisory — the admin still uses the activate control (see `vendor-kyc.md`)

#### Notifications Panel (fully wired)
- Bell icon in the app header with an unread count badge (hidden when 0)
- Slide-in panel with main view (unread + read) and archive view
- Per-notification actions: mark read/unread, archive, delete (with confirm)
- Bulk actions: mark all as read, archive all read
- Realtime: new notifications prepend instantly via Supabase Realtime subscription filtered to `portal = 'command'`; fan-out model (each command user gets their own row, preserving per-user read/archive state)
- Optimistic updates on all mutations; snapshot restore + toast on failure

#### Settings Page (fully wired)
Accessible via the Sidebar's Settings button; **four tabs** (`SettingsPage` owns tab state, each tab is its own component under `components/settings/<Name>/` with a `.tsx` + hook + `.module.css`). *(This line previously said "two tabs" while listing three — corrected 2026-08-10.)*

- **Notification Types tab** — table of all 7 notification types with label, description, target portal, and an on/off toggle. Toggle updates `notification_type_settings.is_enabled` — disabling a type suppresses all future notifications of that type platform-wide (does not delete existing rows).
- **Divisions tab** (2026-07) — full CRUD over the `divisions` lookup table: add a division (name → slug auto-derived, kebab-case), inline-rename, and toggle active/disabled. This is the first true add/edit/disable lookup-table admin UI in command (Notification Types only ever toggles pre-seeded rows). Disabling a division hides it from new vendor selection without touching existing vendor associations; hard delete isn't exposed in the UI (the DB FK is `ON DELETE RESTRICT` while any vendor references it).
- **Platform Fee tab** (2026-07) — sets `platform_fee_settings.fee_percent`, the global commission taken from every booking payment (0–100, 2 dp; applies to all vendors, no per-vendor rate). Shows a live money-split preview ("On a ₱1,000 booking the platform keeps ₱120 and the vendor receives ₱880") so an abstract percentage reads as money and a transposed entry is obvious before saving, plus who last changed it and when. Save is gated on a genuine change — an equivalent value (`12` vs `12.00`) does not enable it. The tab states prominently that **changes affect future payments only**: each transaction permanently records the rate in force when it was paid, so vendors' existing payout history never moves (see `schema.md` → `booking_transactions`).

- **Password tab** (2026-08-10, `components/settings/SecuritySettingsPage/`) — change your own password. Not an admin tool: it acts on the signed-in user only, never on another account. See `auth-and-roles.md` → "Changing a password while signed in".

All four tabs are reachable by anyone who reaches the command portal at all — access control is enforced at the command login gate (`admin`/`root` only) and by RLS on the underlying tables, not by a separate per-page role check.

#### Transactions Page (mock)
- Full transaction table with search, filter panel, sorting, and pagination
- Sourced from `ALL_TXNS` constant (`genTxns()`) — no `wallet_transactions` table exists yet

### What Is Live vs. Mock

| Feature | Status |
|---------|--------|
| User list | ✅ Supabase-wired |
| Create / edit / delete users | ✅ Supabase-wired (create/delete via server route; edit client-side) |
| Activate / deactivate users | ✅ Supabase-wired |
| Grant / revoke portal access | ✅ Supabase-wired |
| Vendor list | ✅ Supabase-wired |
| Add / edit / delete vendors | ✅ Supabase-wired |
| Vendor approval / suspension | ✅ Supabase-wired |
| Vendor KYC review (approve/reject packet + notes) | ✅ Supabase-wired — in `VendorViewModal`; advisory (no hard activation gate yet) |
| In-app notifications | ✅ Live — bell icon, panel (main + archive views), Realtime delivery + arrival toast, optimistic read/archive/delete |
| Notification Type Settings | ✅ Live — platform-wide enable/disable per notification type |
| Flag Queue (resolve booking disputes) | ✅ Supabase-wired — `disputes.service.ts` + `resolve_booking_dispute()` |
| Payouts (release vendor payouts) | ✅ Supabase-wired — `payouts.service.ts` + `release_booking_payouts()` |
| **Vendor payout destinations** (view + per-field copy) | ✅ Live 2026-08-16 — a payout badge on each vendor card opens `VendorPayoutModal`, which decrypts server-side via `/api/vendor-payout`, shows values **masked until revealed**, and copies each field to the clipboard for a manual bank transfer. **Every decrypt is recorded in `vendor_payout_view_log`, and a read that cannot be audited is refused.** Command's **first Radix dialog** — the app's own `ModalOverlay` has no focus trap, Escape handling or scroll lock, which is not acceptable for a dialog showing bank details |
| **Vendor account-completion badge** | ✅ Live 2026-08-16 — reads the `vendor_account_completion` view, the single definition shared with the vendor portal. `null` renders as **Unknown**, never as Incomplete |
| Fulfilment oversight (stale `in_progress`, open flags) | ✅ Supabase-wired — `oversight.service.ts` on the Overview |
| Platform Fee setting | ✅ Live — global commission %, snapshotted onto each payment; browser-verified end-to-end |
| KPI widgets | ⚠️ Vendor count live; bookings/revenue seeded |
| Transactions | ❌ Mock data (`ALL_TXNS` constant). **No longer blocked** — `booking_transactions` now exists and holds exactly the platform-wide data this page needs; wiring it up is a small, self-contained follow-up since the table/filter/pagination UI is already built |

### Known Gaps

- **No vendor member management.** Command can approve vendors but cannot assign `vendor-admin` roles through the portal. Must be done via Supabase dashboard or SQL.
- **Booking oversight is targeted, not general.** As of 2026-08 Command *does* see the bookings that need it — stale `in_progress` on the Overview, open flags in the Flag Queue, and every paid booking on the Payouts page. What is still missing is a **general platform-wide bookings browser**: there is no screen to list or filter all bookings across vendors by status, date, or vendor.
- **No payout rail.** The Payouts page marks a payout `released`, recording a transfer made somewhere else. Nothing actually moves money, and no refund mechanism exists — PayMongo's refund API is never called.
- **Transactions page still on mock data** — but no longer *blocked*: `booking_transactions` (2026-07) supplies the real platform-wide rows, and the existing `TransactionsPage`/`useTransactions`/`TransactionTable` UI only needs a service swap. Note the mock's columns don't map 1:1 (it has a `method`/payment-method column, which `booking_transactions` doesn't carry).
- **KPI accuracy.** Booking count and revenue widgets are still seeded; only vendor count is live.
- **No password set on user creation.** New users are created with `email_confirm: true` and no password — they must use "Forgot Password" to set their own password before logging in.

### Roadmap (Approximate Priority)

1. Wire KPI widgets to live DB counts (total bookings, users, revenue)
2. Vendor member management UI: assign `vendor-admin` role to a user for a specific vendor
3. Platform-wide bookings view: list and filter all bookings across vendors (the Flag Queue, Payouts page and Overview oversight card cover the *exception* cases as of 2026-08 — this is the general browser that is still absent)
4. Transactions page: wire the existing mock UI to `booking_transactions` for a platform-wide view (no longer blocked — the table exists as of 2026-07; note the mock's payment-method column has no equivalent). Overlaps the Payouts page, which already reads the same table — decide whether both pages should exist before building
5. Audit log: track who approved what and when
6. Vendor payout **disbursement**: the Payouts page (2026-08) marks payouts released and gates them on mutual completion, but nothing moves money — no rail, and no refund mechanism. Should also resolve the unreconciled paid-then-cancelled money noted under the vendor portal's Known Gaps

---

## Ezzy Vendor Mobile (`./ezzy-vendor-mobile`)

**Audience:** the same vendor administrators who use the vendor portal
**Portal name in DB:** `vendor` — the same `user_portals` row. There is no mobile-specific grant, role or access check
**Status:** Ph0–Ph6 code complete; first successful device run 2026-07-28 (Android only). **Full vendor-side booking fulfilment shipped 2026-08-02** — see the Fulfilment row below

### Purpose

A companion, not a port. It exists for the jobs that are **urgent and happen away from a desk** — a booking arrives and needs approving, a vendor wants today's numbers between appointments. Everything that is deliberate, bulk, or document-heavy stays on the web portal.

Feature parity with the vendor portal is an explicit **non-goal**. Adding a feature here because the web has it is the wrong instinct; the question is whether the job is urgent and mobile-shaped.

### Screen Inventory

| Route | Purpose |
|---|---|
| `sign-in` | Email/password. **No sign-up** — registration and KYC stay on the web, linked out to |
| `forgot-password` / `reset-password` | Recovery by deep link. `reset-password` sits outside both auth guards deliberately: the recovery link *creates* a session, so a "signed out" guard would eject the user mid-exchange, while a "signed in" guard would block the expired-link error path |
| `select-vendor` | Shown only when the user administers more than one vendor. The choice is remembered across launches |
| `blocked` | KYC-pending, suspended, or no vendor access. Real copy and a way forward for each — a blank "no access" screen is a store rejection |
| `(app)/dashboard` | Today's stats, including the monthly payout net of the platform fee, plus a **"Getting started" guide card** below them (`components/dashboard/GuideCard/`) — hideable, and the choice persists across launches |
| `(app)/bookings` + `bookings/[id]` | The core screen. List, six lifecycle filters with badges, detail, **approve/reject and the full fulfilment actions** (hand over / mark as done / got it back / undo / flag). The detail also names the **offering** (name + code) and the booking's **own span** — a time range or a multi-day date range, via `fmtBookingSpan()` / `bookingDayCount()` in `lib/format.ts` — plus an **"i" affordance** on the action bar explaining what each action does to the vendor's money |
| `(app)/transactions` | Payment history with a summary and search. **No print** — that is a desktop job |
| `(app)/notifications` | In-app notifications, Realtime delivery, unread badge |
| `(app)/settings` | Theme override, vendor switch, push toggle, sign out, account-deletion link out to the web, **app version** |

### Non-Obvious Behaviours

**Approve is a deferred commit, not an optimistic write.** The DB trigger `validate_booking_status_transition` permits `pending → confirmed` but **not** `confirmed → pending`. So an "Undo" that had already written the change could never take it back. Instead the approval is held for a 4-second undo window and only then sent; it is also flushed if the app backgrounds or unmounts first, so a vendor who approves and immediately locks their phone still gets the write. Do not "simplify" this into an optimistic update.

**The fulfilment payable rule is keyed on `payout_status`, never on booking status.** This is the mobile mirror of the web rule, and it is the defect the whole dual-acknowledgement feature exists to remove: the app previously counted a `confirmed` booking as money owed, i.e. work the vendor had not yet delivered. `lib/format.ts` now keys `isPayable` on `held | releasable | released | reversed` from the ledger row. A test asserts that **no booking-status string** can read as payable, so the old keying cannot quietly return.

**The auto-confirm countdown respects the service-date gate, not just the 3-day window.** `20260801000009` will not promote a `fulfilled` booking before its `booked_date` (Asia/Manila) — that gate is what stops a vendor marking work done weeks early and letting the unattended timer release the payout. A flat "auto-confirms in 3 days" would therefore promise something the database refuses, so `lib/autoConfirm.ts` computes `max(changedAt + 3d, serviceDayStart)`. `returned` is exempt: reaching it required the *booker* to say the item came back. `in_progress` gets no countdown at all — no timer exists for it.

**`expo-notifications` is loaded lazily, never imported at the top of a module.** On Expo Go for Android the package throws *while being evaluated*, which takes down every module that imports it — including the root layout, producing a crash with no logs. `lib/pushModule.ts` wraps it in a guarded `require()` and every consumer goes through that accessor. A plain `import * as Notifications from "expo-notifications"` anywhere in this app is a bug, even if it is guarded at the call site.

**`ScreenShell` pins only the action row — the screen title scrolls away with the content (2026-08-06).** Before this, the shell pinned the title too; stacked with each screen's own toolbar, filter strip or summary cards, that left Transactions with a list viewport barely taller than one row. The title and subtitle are now handed down through `ScreenTitleContext` and rendered by `<ScreenTitle />` **inside each screen's own scroll container** — a `FlashList` header on the list screens, a `ScrollView` child on Dashboard and Settings. The consequence is the trap: **a screen that forgets to render `<ScreenTitle />` silently has no title** — no error, no warning, because the context tolerates a `null` value by design (throwing would take the screen down in a release build, which has no error boundary). It nearly happened to `bookings/[id]`, which passes no header action and so pins nothing at all. See `conventions.md` → "Component conventions — RN variant".

**The action-info sheet quotes `bookingActionCopy.ts` verbatim, and there is one sheet per action *bar*, not per action.** The "i" opens a single sheet listing every action currently offered, with each body pulled straight from the copy table that also labels the buttons and drives the vendor web portal. That is deliberate: the wording being explained is the wording that tells someone *when they get paid*, and a hand-written explanation would drift from the button it explains. Same class of drift-guard as the payable rule above.

**Realtime diagnostics never log the payload row.** `lib/realtimeLog.ts` is the only place either realtime hook logs from, and it takes an event type and a row id — never the row. Booking and notification payloads carry booker PII, and a console line in a release build is not a safe place for it. `SUBSCRIBED`/`CLOSED` are `__DEV__`-only noise; `CHANNEL_ERROR` and `TIMED_OUT` warn in **every** build, because a vendor reporting "it went quiet" is worth a production log line. Before this, only the two failure statuses were logged at all, which made a socket that never joined and a joined channel receiving nothing look identical — both printed nothing.

### What Is Live vs. Mock

| Area | State |
|---|---|
| Auth, session persistence, password recovery | ✅ Supabase-wired. Session in the OS keystore via a chunking adapter |
| Vendor gate, multi-vendor picker, blocked states | ✅ Supabase-wired |
| Dashboard stats | ✅ Supabase-wired — all four computed correctly, unlike the web dashboard (see Known Gaps) |
| Bookings list, detail, approve/reject | ✅ Supabase-wired, with Realtime |
| **Booking fulfilment** (hand over, mark as done, got it back, undo, flag) | ✅ Supabase-wired 2026-08-02. Writes `bookings.status` and lets the actor-aware trigger judge legality; flagging goes through `raise_booking_dispute()`. Payable is driven by `booking_transactions.payout_status`, **never** by booking status |
| Transactions | ✅ Supabase-wired — summary, search, filters. No print |
| Notifications | ✅ Supabase-wired, with Realtime and an unread badge |
| Push notifications | ⚠️ Client and schema complete; **no FCM/APNs credentials**, never delivered end to end |
| Offerings, schedules, staff, vendor profile editing | ❌ Not built, and not planned — web portal only |

### Known Gaps

- **iOS has never been built or run.** Not a bug backlog item — the project holds no Apple Developer Program membership, so no iOS device build is possible. Every "done" marker in the mobile plan is Android-only.
- **Push is unproven.** Needs an FCM v1 service-account key on EAS, the Edge Function deployed, and a Vault secret set.
- **Not submitted to either store.** Blocked on a public privacy policy and a Play Console account-type decision. **Brand assets no longer block** — the real icon and splash landed 2026-07-30 (`.plans/2026-07-30-vendor-mobile-brand-assets.md`); only the store *listing* assets (screenshots, descriptions) remain outstanding. See `ezzy-vendor-mobile/STORE-SUBMISSION.md`.
- **Password reset deep links** need the mobile redirect URLs added to `backbone/supabase/config.toml` — a cross-app change, not yet made.
- **The app version now comes from `package.json`** (2026-08-02). `app.config.js` sets `expo.version` from it, and `expo.version` was **removed from `app.json`** so nothing can drift — by then the two had reached 0.7.0 and 1.0.0 respectively. Those are the *pre-fix* figures, not the current version, which is **0.4.1** and moves with every `npm version <x>` — that command now updates the OS-reported version, the store version and the Settings display together.
- ~~**Only two of the five legal booking status transitions are reachable from any UI.**~~ **Resolved 2026-08-02 — and the premise is obsolete.** This described `validate_booking_status_transition` as of `20260516000004`, a five-transition machine. `20260801000002` replaced it with the nine-status dual-acknowledgement model, and **both** the vendor web portal and this app now implement the full vendor side. The "No action needed" copy it complained about is gone: the detail screen offers the correct action per state and, where there is none, names the state properly instead of claiming nothing is needed. The plan it cited (`.plans/2026-07-31-vendor-mobile-booking-status-actions.md`) was **✖ ABORTED** — written a day before the feature landed, it proposed `confirmed → completed`, a transition the trigger now rejects. Shipped instead via `.plans/2026-08-02-vendor-mobile-fulfilment-sync.md`. The note's closing point still stands: **`refunded` is written by nothing in any app** — there is no refund flow, and that is a payments question, not a UI gap.
- **Device verification is the standing bottleneck, and it is per-plan — not one backlog.** The old blanket note here ("bugs found on the first real-device run are outstanding") was wrong by 2026-08-03: filter density, the keyboard/version fixes and the action-UI-and-guide work were all completed *and* confirmed on an Android device. What is genuinely unverified today, each traceable to its own plan:

  | Unverified work | Plan | State |
  |---|---|---|
  | Guard fallback route | `.plans/2026-07-29-vendor-mobile-guard-fallback-route.md` | IN PROGRESS — device verification outstanding |
  | Hidden action bar | `.plans/2026-08-02-vendor-mobile-hidden-action-bar.md` | IN PROGRESS — none of it seen on a device |
  | Live reload | `.plans/2026-08-02-vendor-mobile-live-reload.md` | IN PROGRESS — root cause still unknown |
  | The B1 scroll/header refactor (`ScreenShell` split) | `.plans/2026-08-05-vendor-mobile-scroll-header-and-fee.md` | IN PROGRESS — coded 2026-08-06, needs a screenshot |

  Stages 2–5 of that last plan are **not built at all**: the show-guide header icon (B2), the `platform_fee_settings` scalar accessor and its approval gate (B3a), the fee-rate summary card (B3b), and the `StaleBanner` scroll check (I2).
- **The notification swipe fix is unverified on device.** `.plans/2026-07-30-vendor-mobile-ui-fixes.md` B1 corrected an inversion where the Archive panel prompted a delete and the Delete panel archived with no confirmation at all. Code complete, never run on hardware — and the swap compiles either way, so no machine check can confirm it.

### Roadmap (Approximate Priority)

1. Clear the device-verification backlog in the Known Gaps table above — four plans are coded but unseen on hardware, and nothing below can be trusted until they are
2. Finish `.plans/2026-08-05-vendor-mobile-scroll-header-and-fee.md` stages 2–5: show-guide header icon, the `platform_fee_settings` accessor (**schema approval gate**), the fee-rate summary card, the `StaleBanner` check
3. FCM credentials + deploy the push Edge Function → prove push end to end
4. Mobile redirect URLs in `config.toml` → unblock password reset
5. Store *listing* assets, privacy policy, Play account → unblock submission (the binary's icon and splash are done)
6. iOS, if and when an Apple Developer membership is bought

---

## Ezzy Booker Mobile (`./ezzy-booker-mobile`)

Scaffold only — no app code. Its plan (`.plans/2026-07-21-ezzy-booker-mobile-buildout.md`) predates the vendor app and resolved two decisions the vendor app later went the other way on: **NativeWind** for styling (vendor uses `StyleSheet` + `Name.styles.ts`) and **AsyncStorage** for the session (vendor uses SecureStore, because it carries approval authority and payout figures). Revisit both before writing code — treat `ezzy-vendor-mobile` as the reference implementation.

---

## Cross-Portal Feature Parity Notes

Some features need to be built in multiple portals to be complete end-to-end:

| Feature | Booker | Vendor | Command |
|---------|---------|---------|---------|
| Booking creation | ✅ Done | — | — |
| Booking status update | ✅ Acknowledge + flag (via RPC) | ✅ Approve/reject + full fulfilment + flag | ✅ Resolve flags, release payouts, reasoned override |
| Document upload | ⚠️ In-memory | ❌ (view only) | — |
| Transactions / payouts | ✅ Live — booker's own spend, from bookings | ✅ Live — payout ledger + fee split + print/PDF, from `booking_transactions` | ⚠️ Fee % setting and the **Payouts** page live; the separate platform-wide *Transactions* page is still mock (unblocked) |
| Platform fee configuration | — | Read-only (shown per transaction) | ✅ Live — sets the global rate |
| Notifications | ✅ Live | ✅ Live | ✅ Live + Type Settings admin |
| Map / coordinates | ⚠️ Placeholder | — | — |
| Installable PWA | ✅ Live (real-device verification pending, incl. PayMongo round-trip) | ✅ Live (real-device verification pending) | ✅ Live since 2026-08-18 (real-device install pending) |
| Native mobile client | ❌ Scaffold only (`ezzy-booker-mobile`) | ✅ Ph0–Ph6 live on Android (`ezzy-vendor-mobile`) | — Not planned (desktop admin tool) |

**The mobile client is not a fourth column of this table.** It targets a subset of the vendor portal's jobs on purpose, so a ❌ against it usually means "deliberately out of scope", not "still to build".

Where the two vendor clients *do* overlap, they must agree on the numbers — computed from the database on the same PH-timezone day bounds, and on the same payable rule (`payout_status`, never re-derived from the booking's status). If a change makes one of them disagree with the other, that is a bug in whichever one moved.

⚠️ **They have drifted apart in shape, though not yet in arithmetic.** `getPayoutForRange()`, which this paragraph used to name as the shared approach, **no longer exists in either client**: the web dashboard replaced it with the paged `getFinancialsForRange()` + `lib/financials.ts` and now renders a Period control over two labelled groups (see "Overview / Dashboard" above), while `ezzy-vendor-mobile` keeps its own `services/transactionTotals.ts`. Two implementations of one set of money rules is a standing drift risk; the guard is that both read `payout_status` and both exclude reversed payouts. See `.plans/2026-08-14-mobile-vendor-dashboard-range-and-drilldown.md` for bringing the mobile dashboard onto the same period/drill-down model.
