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
| 1 — Choose Service | Offering cards with category colour and price | `offerings` table (all active, deduplicated by code) |
| 2 — Choose Vendor | Vendor list + Leaflet map (user location dot) | `vendors` table (filtered by offering code) |
| 3 — Pick Schedule | Calendar + time slot buttons | `schedules` table (recurrence expanded client-side) |
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
- Appearance / dark-mode toggle
- Logout

#### Navigation
- Bottom tab bar (Dashboard, Booking, Transactions)
- Sidebar with Settings (hamburger toggle)
- Light/dark theme toggle

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
| In-app notifications | ✅ Live — bell icon, panel (main + archive views), Realtime delivery + arrival toast, optimistic read/archive/delete |
| Installable PWA (manifest, icons, offline fallback, install banner) | ✅ Live — machine-verified (Chrome installability check, offline fallback, install-flow logic); real Android/iOS device install, and specifically the PayMongo checkout round-trip in standalone mode, still need physical-hardware verification |
| Document uploads | ⚠️ In-memory only (no Storage/DB writes) |
| Transactions page (Total Spent / Bookings / Pending + payment history) | ✅ Supabase-wired (derived from bookings) |
| User profile editing | ❌ Not implemented |
| Booking cancellation / reschedule | ❌ Not implemented |

### Known Gaps

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

#### Overview / Dashboard (fully wired, 2026-07)
Four KPI cards above the pending-approvals and booking-trends panels.

- **Pending Approvals** — bookings awaiting the vendor's decision, from the shell's `bookings`
- **Today's Schedule** — schedules occurring on the current **Asia/Manila** day. The PH date is used rather than the device's local date, so a vendor travelling abroad still sees their own business day
- **Completed This Month** — completed bookings whose service date falls in the current PH month. Scoped to the month it names: an all-time count under a "This Month" heading is the same defect as an all-time total under a date range
- **Monthly Payout** — the current PH month's payout, net of the platform fee, from `booking_transactions` via a narrow `getPayoutForRange()` (not the page's full ledger fetch — the dashboard is the landing page, and pulling every transaction on each login to render one number would slow the app for everyone who never opens Transactions). Uses the same `isPayable()` rule and the same PH day bounds as the Transactions page, so the two screens reconcile
- The card is named **Payout**, not Revenue, because the figure is net of the fee and counts payable rows only — matching the Transactions page's "Total Payout". Shows `—` rather than `₱ 0` while loading or on error, so a vendor who earned money is never shown a confident zero

> Until 2026-07 this row carried **hardcoded literals**: a fixed `₱ 4,550` "Monthly Revenue", a `Apr 2026` caption and a `Apr 23` "Today's Schedule" pinned to a date in the past — identical for every vendor on every day. All four cards now read real, date-scoped data.

#### Offerings Page (fully wired)
- List of the vendor's offerings, grouped or filterable by category
- Add offering form: name, code, category, price, duration, description, requirements
- Edit offering
- Toggle offering active/inactive (`is_active`)
- Offering category badges (free-text category; colour from a fixed map + neutral fallback)

#### Schedules Page (fully wired)
- Calendar/list view of active schedules
- Add schedule form: title, offering picker, staff picker, date, time range, days of week, recurrence, capacity
- Recurrence options: none / weekly / biweekly / monthly
- Filter by offering or staff
- Edit and delete schedules

#### Calendar Page (mock)
- Monthly calendar view showing schedule dots and booking indicators
- Click a day to see schedules and bookings for that day in a side panel
- Driven by local state from `BOOKINGS` and `SCHEDULES` constants — not wired to DB

#### Staff Page (fully wired)
- List of the vendor's staff
- Add/edit staff form: name, email, phone, license number, specialties (offering codes)
- Validation: name required, email format check
- `canSave` gate on form — disabled until required fields are valid

#### Bookings Page (fully wired)
- Incoming booking list with status filter tabs (all / pending / confirmed / completed / cancelled)
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

> The vendor portal has **no** Wallet page. An earlier revision of this document described one (Balance/Transactions tabs, a `TXNS` constant); no such page, component, or constant exists in the codebase, and this Transactions page is the real home for what that entry described.

#### Packages Page (mock)
- List of offering packages with price, included items, and colour coding
- Driven by `PACKAGES` constant
- Add/Edit/Delete buttons are non-functional

#### Vendor Profile Page (fully wired)
- Display and edit: vendor name, address (Province/City/Barangay pickers, Address Line 1, ZIP Code), phone, email, operating hours, year established, accreditation/license number
- Save changes writes to `vendors` table

#### Layout
- Sidebar with vendor name (fetched from DB for logged-in user's vendor)
- Light/dark theme toggle
- Multi-vendor support: if a user is `vendor-admin` at multiple vendors, they can switch between them

#### Progressive Web App (2026-07, live)
Installable to a home screen on Android and iOS. `app/manifest.ts` (Next's native metadata route) declares name/icons/`display: "standalone"`; a hand-rolled service worker (`public/sw.js`, no dependency) serves a self-contained `offline.html` fallback on failed navigations and cache-first for same-origin static assets — cross-origin requests (Supabase, Realtime) are explicitly never intercepted or cached, so bookings/KYC data is never shown stale. A dismissible "Install App" banner (`components/layout/InstallPrompt`) surfaces the option in-app: a real one-tap install on Android/Chromium via `beforeinstallprompt`; instructions-only on iOS Safari (`beforeinstallprompt` has no iOS equivalent — Apple has never implemented it) or a "reopen in Safari" message on other iOS browsers. Dismissal persists via `localStorage`; the banner hides automatically once installed. Booker has the identical setup (see its own Current Features above); Command does not have this (desktop admin tool) — see `.plans/2026-07-18-booker-vendor-pwa-readiness.md`.

### What Is Live vs. Mock

| Feature | Status |
|---------|--------|
| Self-registration + vendor creation | ✅ Supabase-wired (KYC-gated atomic Route Handler) |
| KYC onboarding (type → docs → ID/selfie) | ✅ Supabase-wired — private `vendor-kyc` bucket; camera capture; `localStorage` draft resume |
| KYC status surface + revise & resubmit | ✅ Supabase-wired — selective-edit resubmit with Storage cleanup |
| Offerings CRUD | ✅ Supabase-wired |
| Schedules CRUD | ✅ Supabase-wired |
| Staff CRUD | ✅ Supabase-wired |
| Vendor profile | ✅ Supabase-wired |
| Incoming bookings list | ✅ Supabase-wired; new bookings + status/payment changes appear **live** via Realtime (no refresh) |
| In-app notifications | ✅ Live — bell icon, panel (main + archive views), Realtime delivery + arrival toast, optimistic read/archive/delete |
| Installable PWA (manifest, icons, offline fallback, install banner) | ✅ Live — machine-verified (Chrome installability check, offline fallback, install-flow logic); real Android/iOS device install and iOS KYC-camera-from-installed-PWA still need physical-hardware verification |
| Transactions (payment history, payout totals, filters, print/PDF) | ✅ Supabase-wired — reads `booking_transactions`; browser-verified. Mobile print-to-PDF on real devices still unverified |
| Calendar (schedules + bookings overlay) | ❌ Mock data |
| Booking status management | ✅ Supabase-wired (approve/cancel; complete pending) |
| Booking document viewing | ❌ Not implemented |
| Packages | ❌ Mock data |

### Known Gaps

- **No schedule capacity tracking.** The `max_capacity` field exists on schedules, but there's no display of how many bookers have booked each occurrence.
- **Offering deletion is not implemented.** Offerings can only be deactivated (`is_active = false`). Hard delete is restricted (schedules RESTRICT on delete) — would need to deactivate/delete schedules first.
- **Packages page has no backing table.** If packages (bundles of offerings with a combined price) become a real feature, they need a DB schema.
- **Mobile print-to-PDF is unverified on real devices.** The Transactions page's print output is machine-verified in headless Chromium (correct dual-render, all filtered rows present, nav hidden, content paginates instead of clipping, valid PDFs at desktop and 390px widths), but an actual "Print → Save as PDF" from Android Chrome and iOS Safari has not been exercised on physical hardware — mobile print sheets vary by OS and browser version. Same class of gap as the PWA items below.
- **No payout disbursement.** The Transactions page computes and displays what each vendor is owed, but nothing moves money to them; there is no withdrawal or payout run.
- **Paid-then-cancelled money is unreconciled.** A booking paid via PayMongo and then cancelled by the vendor is excluded from payout totals (the vendor didn't deliver), but no refund mechanism exists either, so that amount currently belongs to neither party in the ledger. Fully traceable (a `booking_transactions` row plus a `cancelled` status and a `booking_status_log` entry naming who cancelled), but it needs resolving when refunds or payouts are built — see `.plans/2026-07-25-vendor-transactions-platform-fee.md`.
- **No photo/logo upload.** Vendor profile has no image support yet.
- **KYC approval is advisory.** Command can activate a vendor whose KYC is still `submitted`/`rejected` — no hard gate yet (deferred item 8a; see `vendor-kyc.md`).
- **No signal to the vendor on KYC review.** Approve/reject is only seen on next login — no in-app notification or email yet (deferred item 8b).
- **PWA install/camera behaviour on real devices not yet confirmed.** The manifest, service worker, and install-banner logic are machine-verified (Chrome's own installability check reports zero errors; offline fallback and install-flow logic tested via Playwright), but an actual home-screen install-and-launch on real Android/iOS hardware, and KYC camera capture (`getUserMedia`) from an *installed* iOS PWA specifically (historically quirky), still need physical-device testing.

### Roadmap (Approximate Priority)

1. Schedule capacity view: show booking count vs. max_capacity per occurrence
2. Booking status: add `completed` transition (currently approve → confirmed; complete transition not yet implemented)
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

#### Overview / Dashboard
- KPI widgets: active vendor count (live from `vendors`), total bookings, platform revenue, held wallet funds (latter three are seeded)
- Booking trend and vendor trend charts (seeded)

#### Users Page (fully wired)
- List of all profiles across all portals, fetched from `profiles` + `user_portals` + `user_roles`
- **Refresh button** in the toolbar re-fetches the list in place (no page reload) — pairs with the live `new_user_registration`/`vendor_pending_approval` notifications, since the table itself is not Realtime-subscribed.
- Create user: `POST /api/users` server route (uses `auth.admin.createUser` via service role key; `handle_new_user` trigger creates the profile row, then portals and role are inserted). The route is **caller-gated** — verifies the requester is an active command admin/root server-side before any service-role action.
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
Accessible via the Sidebar's Settings button; two tabs (`SettingsPage` owns tab state, each tab is its own component):

- **Notification Types tab** — table of all 7 notification types with label, description, target portal, and an on/off toggle. Toggle updates `notification_type_settings.is_enabled` — disabling a type suppresses all future notifications of that type platform-wide (does not delete existing rows).
- **Divisions tab** (2026-07) — full CRUD over the `divisions` lookup table: add a division (name → slug auto-derived, kebab-case), inline-rename, and toggle active/disabled. This is the first true add/edit/disable lookup-table admin UI in command (Notification Types only ever toggles pre-seeded rows). Disabling a division hides it from new vendor selection without touching existing vendor associations; hard delete isn't exposed in the UI (the DB FK is `ON DELETE RESTRICT` while any vendor references it).
- **Platform Fee tab** (2026-07) — sets `platform_fee_settings.fee_percent`, the global commission taken from every booking payment (0–100, 2 dp; applies to all vendors, no per-vendor rate). Shows a live money-split preview ("On a ₱1,000 booking the platform keeps ₱120 and the vendor receives ₱880") so an abstract percentage reads as money and a transposed entry is obvious before saving, plus who last changed it and when. Save is gated on a genuine change — an equivalent value (`12` vs `12.00`) does not enable it. The tab states prominently that **changes affect future payments only**: each transaction permanently records the rate in force when it was paid, so vendors' existing payout history never moves (see `schema.md` → `booking_transactions`).

Both tabs are reachable by anyone who reaches the command portal at all — access control is enforced at the command login gate (`admin`/`root` only) and by RLS on the underlying tables, not by a separate per-page role check.

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
| Platform Fee setting | ✅ Live — global commission %, snapshotted onto each payment; browser-verified end-to-end |
| KPI widgets | ⚠️ Vendor count live; bookings/revenue seeded |
| Transactions | ❌ Mock data (`ALL_TXNS` constant). **No longer blocked** — `booking_transactions` now exists and holds exactly the platform-wide data this page needs; wiring it up is a small, self-contained follow-up since the table/filter/pagination UI is already built |

### Known Gaps

- **No vendor member management.** Command can approve vendors but cannot assign `vendor-admin` roles through the portal. Must be done via Supabase dashboard or SQL.
- **No booking oversight.** Command cannot browse all bookings platform-wide from the portal UI.
- **Transactions page still on mock data** — but no longer *blocked*: `booking_transactions` (2026-07) supplies the real platform-wide rows, and the existing `TransactionsPage`/`useTransactions`/`TransactionTable` UI only needs a service swap. Note the mock's columns don't map 1:1 (it has a `method`/payment-method column, which `booking_transactions` doesn't carry).
- **KPI accuracy.** Booking count and revenue widgets are still seeded; only vendor count is live.
- **No password set on user creation.** New users are created with `email_confirm: true` and no password — they must use "Forgot Password" to set their own password before logging in.

### Roadmap (Approximate Priority)

1. Wire KPI widgets to live DB counts (total bookings, users, revenue)
2. Vendor member management UI: assign `vendor-admin` role to a user for a specific vendor
3. Platform-wide bookings view: list and filter all bookings across vendors
4. Transactions page: wire the existing mock UI to `booking_transactions` for a platform-wide view (no longer blocked — the table exists as of 2026-07; note the mock's payment-method column has no equivalent)
5. Audit log: track who approved what and when
6. Vendor payout runs / disbursement: `booking_transactions.payout_amount` says what each vendor is owed, but nothing pays it out yet. Should also resolve the unreconciled paid-then-cancelled money noted under the vendor portal's Known Gaps

---

## Ezzy Vendor Mobile (`./ezzy-vendor-mobile`)

**Audience:** the same vendor administrators who use the vendor portal
**Portal name in DB:** `vendor` — the same `user_portals` row. There is no mobile-specific grant, role or access check
**Status:** Ph0–Ph6 code complete; first successful device run 2026-07-28 (Android only)

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
| `(app)/dashboard` | Today's stats, including the monthly payout net of the platform fee |
| `(app)/bookings` + `bookings/[id]` | The core screen. List, filter, detail, **approve/reject** |
| `(app)/transactions` | Payment history with a summary and search. **No print** — that is a desktop job |
| `(app)/notifications` | In-app notifications, Realtime delivery, unread badge |
| `(app)/settings` | Theme override, vendor switch, push toggle, sign out, account-deletion link out to the web |

### Two Non-Obvious Behaviours

**Approve is a deferred commit, not an optimistic write.** The DB trigger `validate_booking_status_transition` permits `pending → confirmed` but **not** `confirmed → pending`. So an "Undo" that had already written the change could never take it back. Instead the approval is held for a 4-second undo window and only then sent; it is also flushed if the app backgrounds or unmounts first, so a vendor who approves and immediately locks their phone still gets the write. Do not "simplify" this into an optimistic update.

**`expo-notifications` is loaded lazily, never imported at the top of a module.** On Expo Go for Android the package throws *while being evaluated*, which takes down every module that imports it — including the root layout, producing a crash with no logs. `lib/pushModule.ts` wraps it in a guarded `require()` and every consumer goes through that accessor. A plain `import * as Notifications from "expo-notifications"` anywhere in this app is a bug, even if it is guarded at the call site.

### What Is Live vs. Mock

| Area | State |
|---|---|
| Auth, session persistence, password recovery | ✅ Supabase-wired. Session in the OS keystore via a chunking adapter |
| Vendor gate, multi-vendor picker, blocked states | ✅ Supabase-wired |
| Dashboard stats | ✅ Supabase-wired — all four computed correctly, unlike the web dashboard (see Known Gaps) |
| Bookings list, detail, approve/reject | ✅ Supabase-wired, with Realtime |
| Transactions | ✅ Supabase-wired — summary, search, filters. No print |
| Notifications | ✅ Supabase-wired, with Realtime and an unread badge |
| Push notifications | ⚠️ Client and schema complete; **no FCM/APNs credentials**, never delivered end to end |
| Offerings, schedules, staff, vendor profile editing | ❌ Not built, and not planned — web portal only |

### Known Gaps

- **iOS has never been built or run.** Not a bug backlog item — the project holds no Apple Developer Program membership, so no iOS device build is possible. Every "done" marker in the mobile plan is Android-only.
- **Push is unproven.** Needs an FCM v1 service-account key on EAS, the Edge Function deployed, and a Vault secret set.
- **Not submitted to either store.** Blocked on a public privacy policy and a Play Console account-type decision. **Brand assets no longer block** — the real icon and splash landed 2026-07-30 (`.plans/2026-07-30-vendor-mobile-brand-assets.md`); only the store *listing* assets (screenshots, descriptions) remain outstanding. See `ezzy-vendor-mobile/STORE-SUBMISSION.md`.
- **Password reset deep links** need the mobile redirect URLs added to `backbone/supabase/config.toml` — a cross-app change, not yet made.
- Bugs found on the first real-device run (2026-07-28) are outstanding.

### Roadmap (Approximate Priority)

1. Fix the bugs from first-device testing
2. FCM credentials + deploy the push Edge Function → prove push end to end
3. Mobile redirect URLs in `config.toml` → unblock password reset
4. Brand assets, privacy policy, Play account → unblock submission
5. iOS, if and when an Apple Developer membership is bought

---

## Ezzy Booker Mobile (`./ezzy-booker-mobile`)

Scaffold only — no app code. Its plan (`.plans/2026-07-21-ezzy-booker-mobile-buildout.md`) predates the vendor app and resolved two decisions the vendor app later went the other way on: **NativeWind** for styling (vendor uses `StyleSheet` + `Name.styles.ts`) and **AsyncStorage** for the session (vendor uses SecureStore, because it carries approval authority and payout figures). Revisit both before writing code — treat `ezzy-vendor-mobile` as the reference implementation.

---

## Cross-Portal Feature Parity Notes

Some features need to be built in multiple portals to be complete end-to-end:

| Feature | Booker | Vendor | Command |
|---------|---------|---------|---------|
| Booking creation | ✅ Done | — | — |
| Booking status update | ❌ (cancel only) | ⚠️ Confirm/cancel done; complete pending | ❌ (view) |
| Document upload | ⚠️ In-memory | ❌ (view only) | — |
| Transactions / payouts | ✅ Live — booker's own spend, from bookings | ✅ Live — payout ledger + fee split + print/PDF, from `booking_transactions` | ⚠️ Fee % setting live; platform-wide transactions page still mock (unblocked) |
| Platform fee configuration | — | Read-only (shown per transaction) | ✅ Live — sets the global rate |
| Notifications | ✅ Live | ✅ Live | ✅ Live + Type Settings admin |
| Map / coordinates | ⚠️ Placeholder | — | — |
| Installable PWA | ✅ Live (real-device verification pending, incl. PayMongo round-trip) | ✅ Live (real-device verification pending) | — Not planned |
| Native mobile client | ❌ Scaffold only (`ezzy-booker-mobile`) | ✅ Ph0–Ph6 live on Android (`ezzy-vendor-mobile`) | — Not planned (desktop admin tool) |

**The mobile client is not a fourth column of this table.** It targets a subset of the vendor portal's jobs on purpose, so a ❌ against it usually means "deliberately out of scope", not "still to build".

Where the two vendor clients *do* overlap, they must agree on the numbers. Both dashboards now compute the same four stats from the database, on the same PH-timezone day and month bounds, and both read the monthly payout through the narrow `getPayoutForRange()` rather than pulling the whole ledger. If a change makes one of them disagree with the other, that is a bug in whichever one moved.
