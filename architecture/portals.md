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
- **Offering Status** widget (`BookingStatusWidget`): up to 4 bookings in any status from `pending` to `completed` (plus `disputed`), unfinished ones first. Each row shows the offering code, vendor, status, date and a "Payment pending" note, plus the booker's acknowledgement action ("Yes, all done" / "I've returned it" / Undo) with its auto-confirm countdown, "Something's wrong" with an inline reason, and a Certificate button on completed rows (a placeholder toast). *Corrected 2026-09-21 — this line previously described a 2-column grid of completed bookings only.*

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
- Tab bar under the top bar (Dashboard, Booking, Transactions) — *corrected 2026-09-21: it is not a bottom bar*
- Sidebar: persistent from `lg` up; below `lg` a drawer opened by the TopBar hamburger. Holds the main tabs, Settings, About & Legal and the account menu with Sign out
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
Installable to a home screen on Android and iOS. `app/manifest.ts` declares name/icons/`display: "standalone"`; the same hand-rolled service worker pattern as vendor (`public/sw.js`, no dependency) serves a self-contained `offline.html` fallback on failed navigations and cache-first for same-origin static assets (⚠️ in practice **every** same-origin GET, including RSC payloads and `/api` GETs. Vendor's copy was narrowed to `/_next/static/` on 2026-09-14 and booker's was not; see the TODO in `.plans/2026-07-18-booker-vendor-pwa-readiness.md` Notes), with cross-origin requests (Supabase, Realtime, PayMongo) explicitly never intercepted or cached. A dismissible "Install App" banner (`components/layout/InstallPrompt`) offers a real one-tap install on Android/Chromium, instructions-only on iOS Safari, or a "reopen in Safari" message on other iOS browsers. **Known gap specific to booker:** the Step 6 PayMongo redirect leaves the app's origin — in standalone mode, the return trip from PayMongo's hosted checkout page is not guaranteed to land back inside the installed app window (may open in a browser tab instead); the booking record and webhook `is_paid` flag remain authoritative regardless, so this is a cosmetic risk, not a data-integrity one, but it has not yet been live-tested on real devices. See `.plans/2026-07-18-booker-vendor-pwa-readiness.md`.

### What Is Live vs. Mock

| Feature | Status |
|---------|--------|
| Booking wizard (Steps 1–6) | ✅ Supabase-wired |
| Booking written to DB on confirm | ✅ Supabase-wired (Step 6) |
| PayMongo payment integration | ✅ Live — Checkout Sessions; webhook sets `is_paid` on confirmation |
| Booking history on dashboard | ✅ Supabase-wired (fetched on login); status updates **live** via Realtime (no refresh needed) when a vendor confirms/rejects/cancels |
| Offering Status widget | ✅ Live — up to 4 bookings with acknowledgement / flag actions |
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

- **Found 2026-09-18/20 while planning the redesign, not yet fixed** (details and fixes in `.plans/2026-09-18-booker-home-search-redesign.md`):
  - **Step 3's "spaces left" ignores other bookers.** `getSlotOccupancy()` reads `bookings`, but a booker can only read their own rows, so every slot looks nearly free until the insert is refused (plan F1).
  - **The auto-confirm countdown ignores the service-date gate** — it shows a flat 3 days, while the DB never auto-confirms before the booked date (plan F2).
  - **`/api/payment/create-session` does not check `is_paid` or status**, so two checkouts for one booking could both be paid (plan F3). Nothing in the UI retries payment today, which keeps this latent.
  - **Transactions' "Total Spent" counts unpaid and cancelled bookings** (plan F14).
  - **`getBookings()` is unpaged**, so a booker past 1000 bookings would get a silently short list (plan F17).

### In flight
`.plans/2026-09-18-booker-home-search-redesign.md` — approved 2026-09-21, not yet executed. Replaces the dashboard with a widget Home, adds Explore/search and a vendor-specific Offering page (booking starts there, at the Schedule step), renames Transactions to **Payments** with filters/CSV/paging, and removes the map. Update this section as its stages ship (its S8).

### Roadmap (Approximate Priority)

1. ~~Add lat/lng to `vendors` table; show vendor markers on Step 2 map~~ **Superseded 2026-09-21** by the redesign plan's D4: the map is removed; directions become a Maps link and location a city filter. "Near me" is parked there (P1)
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

**Division deep link (campaign URLs).** `https://<vendor-host>/?division=<slug>` opens the registration flow with that division already selected on step 1. The parameter takes the **division slug** (`ezzy-drive`, `ezzy-care`, `ezzy-well`, … — see `schema.md`'s `divisions` table), never an id or a display name, and matching is forgiving: `ezzy-well`, `ezzywell`, `EzzyWell` and `ezzy_well` all resolve, because the hyphen is the first thing to go missing in a hand-written campaign link. An unknown or absent slug does nothing at all — the plain login screen, indistinguishable from passing no parameter. The slug resolves to a numeric `division_id` once; that id is what the form holds and what the server validates, so the slug is a **lookup key only** and is never stored. ⚠️ The parameter does **not** survive in the address bar — the shell rewrites the query string on load, so it is captured at module load before React renders (`lib/divisionDeepLink.ts`, and see conventions.md "The shell owns the query string"). It is also **one-shot**: it applies to the first registration surface of a page load and not to later remounts. Only the plain sign-in surface honours it — a password-recovery or vendor-picker session carrying the parameter is left alone.

**Referral deep link (affiliate links, 2026-09-18).** `https://<vendor-host>/?ref=<CODE>` opens the registration flow and carries an affiliate's referral code through to submission, so the new vendor is credited to that affiliate. It combines with the division link (`?division=ezzy-drive&ref=NINA2026`) — which is exactly what the `ezzy.ph` WordPress partner-routing plugin emits (`.plans/2026-09-17-wordpress-partner-routing-referral-code.md`). Four properties matter:
- **Invisible.** No field appears on any step (plan D4). The code sits in form state, in the saved draft, and in a hidden `data-testid="referral-code"` input that exists only so tests and support can see it.
- **Forgiving and never refused.** The code is normalised (`nina-2026` → `NINA2026`), and a code that is malformed, unknown or belongs to a suspended affiliate is **ignored in silence** — the vendor registers normally and nothing is credited (plan D2). A referral is a credit owed to someone else, so it must never block a signup. The register route logs a warning when a supplied code did not resolve; that log line and the affiliate's panel in Command are the only places a wrong link ever shows up (the panel counts activated vendors only, and says when signups are still waiting — see Command's Users page below).
- **Captured at module load**, like `?division=` (`lib/referralDeepLink.ts`), one-shot, and honoured only on the plain sign-in surface. The URL's code beats one restored from a saved draft; a draft's code is used when the URL has none, so a vendor who resumes tomorrow without the link is still credited.
- **Decided on the server.** `vendor/lib/referralLookup.ts` resolves the code at submit time and `POST /api/auth/register` writes the `vendor_referrals` row inside the same rollback-safe request that creates the vendor. `prepare` deliberately does nothing with it.

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
- **Attachments while adding (2026-09-15).** The Attachments section (photo + documents) is available in the add form too. **Add Offering** saves and keeps the form open as an edit form, and so does the first photo/document added to a new offering: it saves the offering first through the same create. That needs a name, short code, duration and a non-blank price (`0` is allowed); until then the buttons are disabled with a note saying what is missing. The "add a schedule?" prompt appears when the form is closed. No draft rows and nothing is uploaded ahead of the offering existing (plan `2026-09-14-vendor-offering-photo-limit-and-kiosk-offering-cards.md` I6)
- Edit offering
- Toggle offering active/inactive (`is_active`)
- Offering category badges (free-text category; colour from a fixed map + neutral fallback)
- Delete offering, behind an inline confirm on the card. Blocked by the database when schedules reference it (FK `23503`), surfaced as "This offering is used in one or more schedules and cannot be deleted" rather than a raw error. **The refusal renders inside that card's confirmation, under the question** (2026-09-15) — it used to render after the whole grid, which put it below the fold on a full page. It does not auto-dismiss; Cancel clears it. ⚠️ A **booking** reference raises the same `23503`, so the wording says "schedules" either way
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
- **Full vendor-side fulfilment (2026-08)** — hand over / mark as done / got it back / undo / flag, with `fulfilActionFor()` in `components/bookings/BookingActions/useBookingActions.ts` (moved from `useBookingRow.ts` 2026-09-12) picking the action from `(status, fulfilmentPattern)` and every label and hint coming from the single `lib/bookingActionCopy.ts` table, so the wording that tells someone *when money moves* cannot drift between clients. (The booker keeps its own table with its own keys and audience — `booker/lib/bookingActionCopy.ts`; `ezzy-vendor-mobile` mirrors the vendor one.) Flagging goes through `raise_booking_dispute()`. See `booking-flow.md`
- **Live updates** — a Realtime `postgres_changes` subscription (`bookings` `INSERT`+`UPDATE`, filtered to the selected vendor) brings in new bookings and status/payment changes (e.g. a booker cancellation, the PayMongo webhook's `is_paid`) without a refresh; the subscription re-scopes when switching between multiple vendors.
- Approve and reject actions write to the `bookings` table; DB triggers log status changes to `booking_status_log`
- Optimistic UI: state updates immediately on approve/reject; reverts on error with a toast notification (reconciles idempotently with the live Realtime echo of the same change)
- Pending count badge on the filter tab. **Badges count the unfiltered list** — no date range, short code or search ever shrinks them, so they cannot understate outstanding work
- Booker name/email/phone come from the `get_booker_contacts` RPC, not a `profiles` join (profiles RLS does not let a vendor-admin read booker profiles). *Corrected 2026-09-12 — this line previously said "profiles join"*
- **Service-date range, sort, search and short-code filter (2026-08 / 2026-09-12)** — all client-side over the fully-paged `bookings` array the shell already holds, so they cover the vendor's whole history with no extra query. Pipeline: status tab → service date → short code → search → sort.
  - **Sort** defaults to **Date — latest first** (by `bookedDate + startTime`, the day the session is booked FOR); soonest-first, customer A–Z and offering A–Z remain in the select
  - **Search** (`lib/bookingSearch.ts`, unit-tested) matches a substring of customer name/email/phone and offering name/code. Two stricter rules exist because the loose versions return noise: the **booking reference matches by PREFIX, ≥4 characters** (an id is hex, so a substring match would hit most bookings), and **digits-only phone matching applies only to a phone-shaped query** with ≥4 digits, including `0917…` ↔ `+63 917…` via `samePhone()` shared with kiosk close-out
  - **Short code** filters on the offering's `code` (unique per vendor). The selected code stays in the options even if no booking carries it any more, so the select never renders blank
  - A filter that matches nothing shows *No matching bookings* with **Clear filters** (search, code, dates — never the status tab); an empty status group keeps *No bookings found.*
- **Booking details modal (2026-09-12)** — clicking a row (or Enter on the customer's name, which is a real `<button>`) opens `BookingDetailsModal` on the **live** row, so an optimistic approve or a Realtime update changes it in place. Clicks on a row's own controls, inside a portalled InfoTip, or with a text selection do not open it.
  - Shows status, source (**App** / **Kiosk**, from `bookings.booked_via`), the **booking reference** (the booking UUID — the same label and value as the kiosk receipt and confirmation email) with Copy, service, when, quantity, booked-on, notes, rejection reason, customer contact, and payment: amount, paid, and — from `booking_transactions` on open — platform fee, payout and the same `payoutExclusionReason()` wording Transactions uses
  - **Agreements**: the document acknowledgements (`booking_acknowledgements`) and the customer's signature from the private `booking-signatures` bucket via a short-lived signed URL, one image per distinct signature. Read-only; both reads were already permitted by RLS/storage policy. The signature sits on a mid-slate ground because the kiosk strokes in its own theme colour
  - **Actions are the row's actions, not a copy**: `useBookingActions` is shared by the row and the modal (`BookingActionButtons` / `BookingActionPrompt`), so permissions, confirmations and service calls cannot drift between the two
  - Split as a container (`BookingDetails` + `useBookingDetails`, which fetches) and a pure modal, so `/ui-gallery?mode=bookingdetails` renders it populated for the visual suite

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

- **Nine tabs** (was seven; **Closing** added 2026-08-23, **Kiosk** added 2026-09-12):
  Dashboard · Bookings · Offerings · Staff · Schedule · Transactions · Completing · Kiosk ·
  Closing. Order follows the app's own navigation, with Kiosk after the pages because
  Kiosk Mode is the sidebar's last entry. Approving/rejecting is covered **inside
  Bookings**, not as its own tab, because that is where the vendor does it
- **Kiosk** (2026-09-12) documents activation and eligibility, what customers see (including
  the idle reset and its pause while a document is open), finishing a booking, staff exit,
  offering photos (cover only), written and uploaded documents, and signatures (found under
  Agreements in the booking details modal). Its item in `guideItems.ts` carries a comment
  citing the code behind each claim, and deliberately makes **no** claim that editing a
  document changes its version — it does not
- Built on **Radix Dialog + Tabs** — both packages were already dependencies, and Radix
  supplies the focus trap, Escape handling, scroll lock and arrow-key tab navigation that
  the app's old hand-rolled `ModalOverlay` lacked. This was the first modal to move; the
  rest followed on 2026-08-15, `ModalOverlay` was deleted, and **every** vendor dialog is
  now Radix — see `architecture/conventions.md` → Component Conventions for the shape they
  all share
- The tab strip **scrolls sideways** rather than wrapping, and carries a right-edge fade
  mask. From seven tabs on it overflows the 560px dialog at every width, and a hard-clipped
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
> its statuses — and since 2026-09-12 the Bookings panel's reference-prefix search rule
> and the Kiosk panel's device-lock, cover-photo, Open document, Agreements, Needs you and
> ₱0 claims. A stale guide otherwise fails silently in every way a test can see.
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
Installable to a home screen on Android and iOS. `app/manifest.ts` (Next's native metadata route) declares name/icons/`display: "standalone"`; a hand-rolled service worker (`public/sw.js`, no dependency) serves a self-contained `offline.html` fallback on failed navigations and cache-first for fingerprinted build output (`/_next/static/`) **only**. Cross-origin requests (Supabase, Realtime) are never intercepted or cached, and neither are same-origin Next RSC payloads (`?_rsc=`) or `/api` GETs, so bookings, KYC and account-deletion data are never shown stale. Before 2026-09-14 (`offline-v1`) the handler cached every same-origin GET: a cached RSC payload stopped client navigations from committing, and `/api/account-deletion` eligibility was served stale. `offline-v2` limits caching to `/_next/static/` and evicts the old cache (`.plans/2026-09-14-vendor-kiosk-next-customer-reset.md` I3). A dismissible "Install App" banner (`components/layout/InstallPrompt`) surfaces the option in-app: a real one-tap install on Android/Chromium via `beforeinstallprompt`; instructions-only on iOS Safari (`beforeinstallprompt` has no iOS equivalent — Apple has never implemented it) or a "reopen in Safari" message on other iOS browsers. Dismissal persists via `localStorage`; the banner hides automatically once installed. Booker has the identical setup (see its own Current Features above). **Command gained the same setup on 2026-08-18** (`.plans/2026-08-18-command-vendor-nav-branding-responsive.md` B5) — it was previously excluded as a desktop admin tool. See also `.plans/2026-07-18-booker-vendor-pwa-readiness.md`.

#### Kiosk Mode (`/kiosk`) — added 2026-08-29

A customer-facing surface inside the vendor app, for a tablet at the front desk: a
walk-in picks an offering, a time, gives their details, accepts any documents (signing
where required) and pays, without staff involvement. Started from the sidebar's **Kiosk
Mode** item.

**It is a separate route, not a page of the shell, and that is structural.** `AppShell`
renders Sidebar/TopBar/TabBar around every `PageId`, so a kiosk expressed as a page would
keep the admin surface *mounted* behind it, one state bug from visible. `app/kiosk/` is a
sibling route that imports no admin component at all. The sidebar entry is a **link**, not
a `PageId` — `PAGE_IDS` is deliberately untouched.

**Kiosk Mode persists.** A flag in `localStorage` survives reloads, and `AppShell`
redirects `/` → `/kiosk` while it is set, reading it synchronously so no admin chrome
paints first. Without that, `manifest.ts`'s `start_url: "/"` means a tablet reboot or a
PWA relaunch opens the **vendor dashboard** on a device pointed at a customer. Only a
password-confirmed exit clears the flag; a session ending does not.

> ⚠️ **The kiosk hides the portal; it does not lock the device.** A web page cannot stop
> someone typing a URL, and the PayMongo step sends the browser to another origin anyway.
> **Vendors must enable iPadOS Guided Access, Android screen pinning, or Chrome's
> `--kiosk`** — the launcher and the exit dialog both say so, and no wording anywhere
> should imply the app is a boundary.

Related limits worth knowing: a customer who abandons at PayMongo leaves the tablet on a
third-party page that no app-level timer can reclaim (the device kiosk browser's own
idle-return setting is the answer); and a kiosk customer cannot raise a dispute until
they claim the account created for them, since `disputed` requires `v_booker`.

**Documents, idle behaviour and the vendor's view (2026-09-12).**
- **Uploaded documents can be opened** from the agreements step — before, an uploaded PDF or
  image showed only its title beside "I have read and agree". The link is a plain
  `<a target="_blank" rel="noopener noreferrer">` to a signed URL minted **before** the tap
  (Safari's pop-up blocker swallows `window.open` after an await) and re-signed every 240s
  while the step is open; a failed refresh keeps the last good link. Accepting is not gated
  on opening. Written-text documents still show inline. Verified by the user on tablets,
  local and staging
- **The 90s idle reset pauses while the page is hidden** — a document open in another tab or
  in-app browser, or the screen off — and resets immediately on return after more than 10
  minutes away (`lib/kioskIdle.ts`, unit-tested). The payment confirmation still never resets
- **The vendor sees what was agreed**: kiosk bookings arrive `pending`, badged **Kiosk**, and
  the booking details modal lists the acknowledged documents and shows the signature (see
  Bookings Page above)
- **Fixed-height frame (2026-09-15).** `/kiosk` is exactly one viewport tall
  (`KioskShell.module.css` `.root { height: 100dvh }`): brand bar, step header, action bar and
  Staff exit stay on screen and **only the step content scrolls**. The action bar sits in normal
  flow below the content (never over it) and names the chosen offering beside the total. The
  signature step fills the frame instead of scrolling. ⚠️ Do not turn `.root` back into
  `min-height`. The whole document then scrolls and Continue ends up below the offering list
- Photos: **one per offering, optional** (since 2026-09-15; `MAX_PHOTOS` in
  `offeringAttachments.service.ts`, planned to return to 3). The editor hides **Add photo** once
  the limit is reached, and shows reorder arrows and the COVER tag only when an offering holds 2+
  photos (offerings uploaded under the old limit keep theirs). The kiosk shows **only the first
  (cover)**, **whole** (`object-fit: contain`, centred, over a blurred copy of the same image;
  2026-09-15). A tile with no photo, or whose photo fails to load, shows the offering's **short
  code** as a blue monogram, sized to the tile and stepped down for 5–6 characters. The editor
  thumbnail also uses `contain`. This was a recorded follow-up in `.plans/2026-08-25-vendor-launch-followups.md` (F14). Plan:
  `.plans/2026-09-14-vendor-offering-photo-limit-and-kiosk-offering-cards.md`
- **The offering step groups by availability (2026-09-12).** "Available today" first (emerald,
  with the next start time and how many times are left), then "Later this week" ("Available
  tomorrow" / "Available on Wednesday", or "Fully booked today"), then "Not available this week"
  as non-tappable rows. "Available" means a free place at a time that has not started. It is
  counted once per customer from one 7-day bookings read (`lib/kioskAvailability.ts`, built on
  the same slot helpers as the time step); if that read fails or is incomplete the plain grid is
  shown instead. The day chips moved to the time step, which opens on the offering's first free
  day and dims days with nothing bookable
- **Times that have already started are never offered or accepted (2026-09-12).** The time step
  filters them against a Manila instant refreshed every minute, and the kiosk booking route
  refuses them (409). The database does not enforce this for other clients yet (launch
  follow-up F16)
- **Free (₱0) offerings skip payment (2026-09-12).** The kiosk booking route creates the
  booking already settled (`is_paid = true` on INSERT, so no ₱0 ledger row), sends the
  customer's confirmation itself because the payment webhook never runs, and returns
  `free: true`; the kiosk then shows **Confirm booking** instead of **Pay** and a receipt
  reading **Free**. The booking reads "Free / No payment needed" in the vendor's booking
  details. The booker app still cannot book a ₱0 offering (launch follow-up F15)

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
| Getting Started guide (9 tabs, TopBar dialog) | ✅ Live — content asserted in `visual-tests/pilot.spec.ts` |
| Booking search, short-code filter, latest-first sort | ✅ Live (2026-09-12) — client-side over the shell's paged bookings; rules unit-tested in `lib/bookingSearch.test.ts` |
| Booking details modal (contact, reference, payment/payout, agreements + signature, actions) | ✅ Live (2026-09-12) — `bookingdetails` visual baseline |
| Kiosk Mode (self-service booking, attachments, signatures, close-out) | ✅ Live (2026-08-29) — uploaded documents openable and idle pause while reading added 2026-09-12. See `booking-flow.md` → Kiosk Mode |
| Booking status management | ✅ Supabase-wired — approve/reject **and the full vendor side of fulfilment** (hand over, mark as done, got it back, undo, flag) across all nine statuses |
| Booking document viewing (booker uploads, `booking_documents`) | ❌ Not implemented — booker uploads are still in-memory only. *Kiosk agreements and signatures ARE viewable, in the booking details modal* |
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

1. ~~Schedule capacity view: show booking count vs. max_capacity per occurrence~~ **Done (2026-08-04)** — both sides now show spaces remaining per slot (⚠️ **the booker's count is wrong** — it only sees the booker's own bookings under RLS; see booker Known Gaps, 2026-09-21): the booker in Step 3's grid, the vendor in the schedule day panel (`09:00–10:00 · 2 of 5 left`). Capacity is `capacity_per_slot`, counted by overlap so a multi-unit or multi-day booking consumes every slot it covers
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
  ⛔ **Until 2026-09-19 Command's worker cached every same-origin GET, not just static
  assets** — its comment said otherwise. That included `/api/vendor-payout`, which returns
  **decrypted bank details (full account number)**: they stayed in Cache Storage past
  sign-out, and re-views were served without reaching the server, so they were **never
  written to `vendor_payout_view_log`**. It also froze `/api/affiliates`,
  `/api/account-deletion` and `/api/notification-health` at first-seen values. Fixed in
  `offline-v2` with vendor's exact rule — cache-first for `/_next/static/` only — and the
  cache-name bump makes `activate` delete `offline-v1` from every admin's device.
  **Any new same-origin GET route is safe by default now; do not widen that guard.** See
  `.plans/2026-09-17-affiliate-referral-codes-interim.md` K15.
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

#### Payouts Page (2026-08, redesigned 2026-09-10, fully wired)
`components/payouts/`, backed by `payouts.service.ts`. Reads `booking_transactions` with vendor, offering, service date, amount, fee and payout. **Marking payouts paid** — one payout, one vendor's worth, or a hand-picked selection — opens the **Mark Paid review** and, on confirmation, calls `release_payouts_with_statements()` (2026-09-13, see below). Until then it called `release_booking_payouts(uuid[])`, which silently skipped ids no longer releasable; that RPC is retired for API callers once the new Command is live in production (plan `2026-09-13-command-mark-paid-invoice-and-pesonet-template.md`, Phase D).

**Five buckets, and they are disjoint.** `held` / `releasable` / `released` / `reversed` plus the derived `owed_back`. Two things changed in the 2026-09 pass and both were correctness fixes, not cosmetics:

- **`reversed` used to appear on no tab at all** — it was a real `payout_status` that Command could not see. It now has its own bucket.
- **"Paid" used to double-count.** Owed-back rows are `released`, so they showed on both. Harmless while the tabs displayed no money; a silent double count of pesos the moment they did. `released` now excludes them, so each payout sits in exactly one bucket and the five totals can be added together.

**"Owed back" is where a post-release refund surfaces** — `released` is never downgraded, because money that has left really has left, so reversing it after the fact has to be visible rather than papered over.

**Bucket counts and totals come from `command_payout_bucket_totals()`** (`20260910000001`), a read-only Command-only definer RPC returning count + payout sum per bucket in one round trip. It exists because the page fetches one bucket at a time and PostgREST cannot aggregate. **Its `CASE` is the single definition of bucket membership** — `payouts.service.ts` applies the same rule to the row lists, and if one moves without the other, a card and the list beneath it will disagree about money. The RPC's counts stay exact past the 10,000-row fetch ceiling, so the cards are never understated by truncation even when the list below them is; the truncation banner says exactly that.

**Ready to pay is grouped by vendor; the other four are a sortable table.** A payout run is one bank transfer per vendor, not one per booking, so the release surface shows a vendor's total with a single `Mark N paid`. The audit buckets deliberately carry no checkboxes and no row actions — nothing is paid from them, and a disabled action column would imply otherwise. Every column is sortable in both layouts: `SortableColumnHeader` on the table, `PayoutGroupColumns` above the grouped rows (which have no `<thead>` to hang headers on).

**Recording a payout goes through the Mark Paid review** (2026-09-13, `MarkPaidModal`). The row's "Mark paid", a vendor group's "Mark N paid" and the selection bar all open the same modal; nothing is recorded until the admin confirms inside it. It replaced an inline "Record as paid?" prompt that overflowed its column, and gave the selection bar — which had no confirmation at all — the same gate. There is still no un-release RPC, so the review is the last word.

- **One payout statement per vendor**, exactly as that vendor will be emailed: offering, service date, customer paid, Ezzy fee, withholding tax, payout, and totals — each vendor's section with its reference (`EZP-…`), masked destination, and who will be notified. A run over 500 payouts is refused.
- **Command computes and formats nothing in it.** Every row, figure and total is a display string from `preview_payout_statements()` (see `schema.md` → `payout_statements`). The vendor's email prints the same strings from the same stored statement, so the modal and the email cannot disagree.
- **What is confirmed is what was reviewed.** Confirming sends the reviewed payouts with each statement's fingerprint; the database locks the rows, rebuilds, and refuses — writing nothing — if any figure changed (a correction, a payout put on hold) or any payout is no longer ready. The modal then offers **Review again**. Two admins confirming the same payouts get one statement and one refusal.
- **One blocked vendor blocks the run** (no destination, destination disabled, a newer payout-details format, no vendor-admin with an email). Its section says why, with **Leave this vendor out**, which rebuilds the review without it — never a silent skip. Payouts that stopped being ready are listed, by name, as left out.
- **Duplicates.** Each review carries a request id, so a retried confirmation returns the original result instead of recording twice; a payout can be on only one statement (unique in the database).
- **Notification switches still apply.** If the `payout_statement` type or vendor-portal email is switched off, the modal says so before confirming; the statement is still recorded.

**Payout statement emails** (2026-09-13). Confirming inserts one `payout_statement` notification per vendor-admin of each vendor, carrying that vendor's stored statement; the normal notification → Edge Function chain emails it through the bespoke `payoutStatement.ts` template (branded, reference + totals above the rows). Vendors see it in the bell as "Payout initiated · EZP-…". The name is **payout statement**, not invoice: Ezzy is not billing the vendor, and "invoice" is a BIR-regulated term.

**PESONet payout file** (2026-09-13). The review's footer states the order of work — **download the PESONet file → submit it in PayMongo → Mark paid** — and **Download PESONet file** fills PayMongo's own template (`command/lib/payout/pesonet_template.xlsx`, checked in unchanged) server-side via `POST /api/payout-template`:

- One row per vendor statement: PayMongo's exact bank name (`lib/payout/pesonetBanks.ts`), account name and number, **Amount = the statement's own net total**, **Remarks = its reference**. Same figure as the modal and the email.
- **GCash vendors** (since 2026-09-14) go in as bank `G-Xchange, Inc. (GCash)` with the **GCash mobile number as the account number**, written `09XXXXXXXXX` (stored `+639…` by the vendor app). ⚠️ PayMongo's own docs disagree on whether GCash receives PESONet (listed under "Pesonet Provider" on *List of available banks & e-wallets*; "PESONet Receiver: N" on *List of Banks*), so the first PayMongo test upload must include a GCash row. **Maya wallet vendors are still refused** (`PESONET_WALLETS_ENABLED`).
- The route rebuilds the review with the caller's own session and refuses (409) unless it still matches the reviewed fingerprints. Only those vendors' destinations are decrypted, and **every vendor in the file is recorded in `vendor_payout_view_log` before the file is returned** — the deliberate, bounded exception to `/api/vendor-payout`'s one-vendor-per-request rule.
- **All or nothing.** A vendor that can't be put in correctly — a Maya wallet, a bank not on PayMongo's PESONet list, a GCash number that isn't a valid PH mobile number, missing details, a ₱0 amount — stops the whole file, named, rather than producing a file quietly missing a vendor. Maya vendors are flagged in the review up front, with Leave this vendor out.
- ⚠️ exceljs 4.4.0 duplicates the template's bank dropdown on write; `pesonetWorkbook.server.ts` restores the single validation and refuses a template it doesn't recognise. `next.config.ts` lists the template under `outputFileTracingIncludes` or the deployed route would not contain it.
- InstaPay is out of scope (₱50,000 per-transaction cap; different bank list).

**Search and filters are client-side, within the fetched bucket** — vendor, paid-from / paid-until (Asia/Manila day bounds; a raw UTC compare files a 07:00 PH payment under the previous day), and min/max payout, with removable chips. The stated limit: past the fetch ceiling, narrowing cannot recover rows that were never fetched — which is survivable only because the bucket totals are exact regardless.

**Print / Save PDF** — browser-native `window.print()`, no PDF dependency. `PayoutPrintView` is a **second render of the full filtered set**, and has to be: `window.print()` serialises the DOM as it stands and does not re-render, so printing the on-screen tree would drop every collapsed vendor group from a document that gets reconciled against a bank statement. The sheet carries the bucket, a description of every active filter, the sort, "N of M rows", an Asia/Manila timestamp, per-vendor subtotals on Ready to pay, and a grand total. **Warnings print too** — truncation and load failure, as bordered text rather than colour, because browsers drop backgrounds and a filed PDF is the worst place to lose "these totals are short".

> ⚠️ `payout_status = 'reversed'` means the **vendor** will not be paid. It says nothing about whether the *booker* was refunded — there is no refund mechanism in this system. Never label it "Refunded" in any UI.

**Withholding tax, and what "to transfer" means** (2026-09-11). Ezzy withholds tax from what it sends a vendor: `withholding_rate_percent` of `withholding_base_percent` of the vendor payout, 1% of 50% by default. It is **computed and stored by the database at payment** (`20260911000001`), never by Command, and snapshotted like the commission — so editing the rule in Settings changes future payments only.

That splits the money into two figures the page never conflates:

- **Vendor payout** — what the ledger says the vendor is owed, before withholding. The bucket cards and the list header show this.
- **To transfer** — `net_payout_amount`, the payout minus withholding. **Every figure labelled "transfer" is this one**: the selection bar, each vendor group's header, and the printed per-vendor subtotal. Before this change all three showed the full payout, i.e. the wrong amount to type into a bank.

A vendor group therefore reads "₱3,152.16 to transfer" above "2 payouts · ₱3,168.00 less ₱15.84 withholding", so the rows beneath visibly add up. Reversed payouts show "—" for withholding and net: nothing is ever transferred, so nothing is withheld.

**The printed ledger is landscape** since it gained Withholding tax and Net payout columns — nine columns overflowed A4 portrait into the margin.

**Payout details modal** (2026-09-11). Clicking any row opens it. It renders the **same field list the printed sheet renders as columns** (`lib/payout/details.ts`), so the modal and the filed report cannot disagree. Clicks on the row's own checkbox and its "Mark paid" control do not open it; the booking name is a real button, so the row is reachable from the keyboard, and focus returns to it on close. Below the figures it shows **where the vendor is paid, masked** — and only masked, until someone presses "Show full details", which decrypts server-side and records the access. **Opening a payout costs no audit row**; that is what keeps `vendor_payout_view_log` meaningful.

**Corrections** (2026-09-11). Staff can fix a payout whose saved commission or withholding rule was wrong, from that modal.

- **Rates only.** Amounts are never typed: the database recomputes them with the same functions it used at payment.
- **Review, then save.** The review shows figures returned by `preview_booking_transaction_correction()`, so what is approved is exactly what is written. Editing a field discards the review.
- **A reason of at least 10 characters is required**, and every correction is written to `booking_transaction_corrections` in the same transaction as the change — a corrected figure without a log entry is impossible.
- **Any bucket, paid ones included.** The log records the payout's status at the time, and the form warns that correcting a paid payout changes the record, not the money that was sent.
- ⚠️ **Commission corrections are visible to vendors.** They change `platform_fee_percent` / `platform_fee_amount` / `payout_amount`, which the vendor web and mobile apps display — with no notification and no explanation. Withholding is not shown to vendors at all. Telling them is an open follow-up.

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
- **Affiliates (2026-09-18).** Any user can hold a referral code — it is a capability, not a role, so their role and portals are untouched (see `auth-and-roles.md`). Managed entirely from this page:
  - **Create with a code:** Add User has an optional *Referral code* field. `POST /api/users` validates it (format + uniqueness) **before** creating the account, and deletes the account again if the `affiliates` insert then fails — the one place that route rolls back.
  - **Assign / change / remove** for an existing user: the detail view's footer button (*Make affiliate* / *Affiliate*) opens `AffiliateModal`, backed by `/api/affiliates` (GET / POST / PATCH / DELETE, admin or root). Changing a code warns first that links already shared under the old one stop being credited; removing is refused while the affiliate has referred vendors.
  - **The list** has an *Affiliate* column (the code) and an *Affiliates only* toggle — a toggle rather than a role option, because it is not a role.
  - **The detail view** shows an Affiliate badge and an Affiliate section: code, a copyable share link, and **"Referred vendors (activated)"** — the count and list of referred vendors Ezzy has **activated** (plan D15, 2026-09-19). A vendor still pending review is not counted or listed; when none are activated but some signed up, the empty state says how many are waiting instead of implying the link is broken. This is a display rule only (`lib/affiliateReferrals.ts`): the referral is recorded at signup, `GET /api/affiliates` returns every referral with its vendor's status, and the Remove guard and the CSV (`vendors_referred` / `vendors_now_active`) still see all of them. The share link is built server-side from `PORTAL_URL_VENDOR` (which stays server-only) and returned by `GET /api/affiliates`.
  - **Export all affiliates (CSV):** one row per affiliate with vendors referred, vendors now active and last signup — including affiliates with zero. The per-vendor detail export stays a SQL query (see `schema.md`, `vendor_referrals`).
  - ⚠️ The users query embeds `affiliates!affiliates_user_id_fkey(...)` with the FK **named**. `affiliates` has two FKs to `profiles` (`user_id`, `created_by`), and the bare embed makes PostgREST refuse the whole list with PGRST201.

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
- **Platform Fee tab** (2026-07; withholding added 2026-09-11) — two rules, both applied to every booking payment and both snapshotted at payment time.
  - **Commission** — `platform_fee_settings.fee_percent`, the global cut (0–100, 2 dp; no per-vendor rate). A live money-split preview ("On a ₱1,000 booking the platform keeps ₱120 and the vendor receives ₱880") makes an abstract percentage read as money, so a transposed entry is obvious before saving. Save is gated on a genuine change — `12` vs `12.00` does not enable it.
  - **Withholding tax** — `withholding_rate_percent` **of** `withholding_base_percent` of the *vendor payout* (default 1% of 50%). Both halves save together: half a rule snapshotted onto payments is a rule nobody chose. The preview continues the same ₱1,000 example ("vendor payout ₱880.00 · withheld ₱4.40 · transferred ₱875.60"), and **saving is gated on a confirmation naming the old rule and the new one** — the rate is invisible on every future payment until a payout is read back, so a typo is expensive and late to surface.
  - One "last changed" line serves both, because they share one settings row.
  - The tab states that **changes affect future payments only**. Since 2026-09-11 it also says what is now true: a saved payout changes afterwards **only** if staff correct it from Payouts, and every correction is logged (see `schema.md` → `booking_transaction_corrections`).

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
| Payouts (release vendor payouts) | ✅ Supabase-wired — `payouts.service.ts`; redesigned 2026-09-10 (five disjoint buckets, search + filters, vendor-grouped release, filter-aware print/PDF). Bucket counts and totals come from `command_payout_bucket_totals()` |
| **Mark Paid review + payout statements** | ✅ Live locally 2026-09-13 (staging/production per the plan's rollout) — `MarkPaidModal` over `preview_payout_statements()` / `release_payouts_with_statements()`: one statement per vendor, fingerprint-verified confirmation, one blocked vendor blocks the run, each vendor-admin emailed the stored statement |
| **PESONet payout file** | ✅ Live locally 2026-09-13 — `POST /api/payout-template` fills PayMongo's template server-side from the reviewed statements; every vendor in the file is audited before it is returned. PayMongo acceptance is confirmed on the first staging upload |
| **Vendor payout destinations** (view + per-field copy) | ✅ Live 2026-08-16 — a payout badge on each vendor card opens `VendorPayoutModal`, which decrypts server-side via `/api/vendor-payout`, shows values **masked until revealed**, and copies each field to the clipboard for a manual bank transfer. **Every decrypt is recorded in `vendor_payout_view_log`, and a read that cannot be audited is refused.** Command's **first Radix dialog** — the app's own `ModalOverlay` has no focus trap, Escape handling or scroll lock, which is not acceptable for a dialog showing bank details |
| **Vendor account-completion badge** | ✅ Live 2026-08-16 — reads the `vendor_account_completion` view, the single definition shared with the vendor portal. `null` renders as **Unknown**, never as Incomplete |
| Fulfilment oversight (stale `in_progress`, open flags) | ✅ Supabase-wired — `oversight.service.ts` on the Overview |
| Platform Fee setting | ✅ Live — global commission %, snapshotted onto each payment; browser-verified end-to-end |
| **Withholding tax setting** | ✅ Live 2026-09-11 — rate % of base % (default 1% of 50%), saved as a pair, gated on a confirmation naming both rules. Computed and stored by the database at payment, never by Command |
| **Payout details modal** | ✅ Live 2026-09-11 — row click opens the printed sheet's own field list plus the masked destination; "Show full details" is the only path that decrypts, and it is audited |
| **Payout corrections** | ✅ Live 2026-09-11 — Command-only, rates only, server-computed review, reason required, logged to `booking_transaction_corrections`. ⚠️ Commission corrections change figures vendors can see, with no notice |
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

A mock-data prototype is in progress (`.plans/2026-09-21-booker-mobile-app.md`): no auth or real Supabase calls yet. Styling follows `ezzy-vendor-mobile` (`StyleSheet` + `Name.styles.ts`); look and behaviour follow the web booker redesign. Session storage (AsyncStorage vs SecureStore with vendor's chunking adapter) is still open for the real-data plan. The earlier buildout plan was deleted 2026-09-21.

---

## Cross-Portal Feature Parity Notes

Some features need to be built in multiple portals to be complete end-to-end:

| Feature | Booker | Vendor | Command |
|---------|---------|---------|---------|
| Booking creation | ✅ Done | — | — |
| Booking status update | ✅ Acknowledge + flag (via RPC) | ✅ Approve/reject + full fulfilment + flag | ✅ Resolve flags, release payouts, reasoned override |
| Document upload | ⚠️ In-memory | ❌ (view only) | — |
| Transactions / payouts | ✅ Live — booker's own spend, from bookings (⚠️ total overstated, see booker Known Gaps; becomes **Payments** in the redesign plan) | ✅ Live — payout ledger + fee split + print/PDF, from `booking_transactions` | ⚠️ Fee % setting and the **Payouts** page live; the separate platform-wide *Transactions* page is still mock (unblocked) |
| Platform fee configuration | — | Read-only (shown per transaction) | ✅ Live — sets the global rate |
| Notifications | ✅ Live | ✅ Live | ✅ Live + Type Settings admin |
| Map / coordinates | ⚠️ Placeholder | — | — |
| Installable PWA | ✅ Live (real-device verification pending, incl. PayMongo round-trip) | ✅ Live (real-device verification pending) | ✅ Live since 2026-08-18 (real-device install pending) |
| Native mobile client | ❌ Scaffold only (`ezzy-booker-mobile`) | ✅ Ph0–Ph6 live on Android (`ezzy-vendor-mobile`) | — Not planned (desktop admin tool) |

**The mobile client is not a fourth column of this table.** It targets a subset of the vendor portal's jobs on purpose, so a ❌ against it usually means "deliberately out of scope", not "still to build".

Where the two vendor clients *do* overlap, they must agree on the numbers — computed from the database on the same PH-timezone day bounds, and on the same payable rule (`payout_status`, never re-derived from the booking's status). If a change makes one of them disagree with the other, that is a bug in whichever one moved.

⚠️ **They have drifted apart in shape, though not yet in arithmetic.** `getPayoutForRange()`, which this paragraph used to name as the shared approach, **no longer exists in either client**: the web dashboard replaced it with the paged `getFinancialsForRange()` + `lib/financials.ts` and now renders a Period control over two labelled groups (see "Overview / Dashboard" above), while `ezzy-vendor-mobile` keeps its own `services/transactionTotals.ts`. Two implementations of one set of money rules is a standing drift risk; the guard is that both read `payout_status` and both exclude reversed payouts. See `.plans/2026-08-14-mobile-vendor-dashboard-range-and-drilldown.md` for bringing the mobile dashboard onto the same period/drill-down model.
