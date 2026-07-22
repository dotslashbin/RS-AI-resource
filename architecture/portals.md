# Portals

Current state, feature inventory, gaps, and roadmap for each of the three portals. For the tech stack and DB they share, see `overview.md` and `schema.md`.

---

## Bookdeck Booker — Booker Portal (`./booker`)

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
- **Live status updates** — a Realtime `postgres_changes` subscription (`bookings` `UPDATE`, filtered to the booker's own `booker_id`) patches the status in place when a vendor confirms/rejects/cancels, no refresh needed. See `.plans/2026-07-18-live-updates-no-refresh.md`.
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

## Bookdeck Vendor — Vendor Portal (`./vendor`)

**Audience:** Vendor administrators  
**Portal name in DB:** `vendor`  
**Default user role:** `vendor-admin` (in `vendor_members`)

### Purpose

Allow vendor administrators to define their service catalogue, set up schedule availability, manage their staff roster, and handle incoming bookings from bookers.

### Current Features

#### Registration Flow (KYC-gated)
Vendor operators self-register via a **6-step** flow on the login screen: business details → account setup → applicant type (company/individual) → documents → identity (Valid ID + Selfie with ID via camera) → review. This is a required **KYC** stage and **no account or vendor record is created until it is submitted** — the form fields auto-save to `localStorage` and files are held in memory. The final submit sends multipart to `POST /api/auth/register`, which atomically (rollback on failure) creates and activates the user, grants vendor portal access, creates the vendor (`pending_activation`), assigns `vendor-admin`, creates the `vendor_kyc` header, uploads the documents to the private `vendor-kyc` bucket, and notifies Command. After submit the vendor logs in to the KYC status surface (under review / approved-awaiting-activation / rejected → revise & resubmit) until Command reviews and activates. See `vendor-kyc.md`.

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
- **Live updates** — a Realtime `postgres_changes` subscription (`bookings` `INSERT`+`UPDATE`, filtered to the selected vendor) brings in new bookings and status/payment changes (e.g. a booker cancellation, the PayMongo webhook's `is_paid`) without a refresh; the subscription re-scopes when switching between multiple vendors. See `.plans/2026-07-18-live-updates-no-refresh.md`.
- Approve and reject actions write to the `bookings` table; DB triggers log status changes to `booking_status_log`
- Optimistic UI: state updates immediately on approve/reject; reverts on error with a toast notification (reconciles idempotently with the live Realtime echo of the same change)
- Pending count badge on the filter tab
- Booker name fetched via `profiles` join on `bookings`

#### Wallet Page (mock)
- Balance/Transactions tab toggle
- Summary cards: Total Revenue, Total Payouts (static figures)
- Transaction list from `TXNS` constant

#### Packages Page (mock)
- List of offering packages with price, included items, and colour coding
- Driven by `PACKAGES` constant
- Add/Edit/Delete buttons are non-functional

#### Vendor Profile Page (fully wired)
- Display and edit: vendor name, address, phone, email, operating hours, year established, accreditation/license number
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
| Calendar (schedules + bookings overlay) | ❌ Mock data |
| Booking status management | ✅ Supabase-wired (approve/cancel; complete pending) |
| Booking document viewing | ❌ Not implemented |
| Wallet / transactions | ❌ Mock data |
| Packages | ❌ Mock data |

### Known Gaps

- **No schedule capacity tracking.** The `max_capacity` field exists on schedules, but there's no display of how many bookers have booked each occurrence.
- **Offering deletion is not implemented.** Offerings can only be deactivated (`is_active = false`). Hard delete is restricted (schedules RESTRICT on delete) — would need to deactivate/delete schedules first.
- **Packages page has no backing table.** If packages (bundles of offerings with a combined price) become a real feature, they need a DB schema.
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
7. Real-device PWA verification (Android/iOS install, iOS KYC camera in installed PWA)

---

## Bookdeck Command (`./command`)

**Audience:** Bookdeck internal operations team  
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
- **Refresh button** in the toolbar re-fetches the list in place (no page reload) — pairs with the live `new_user_registration`/`vendor_pending_approval` notifications, since the table itself is not Realtime-subscribed. See `.plans/2026-07-18-live-updates-no-refresh.md`.
- Create user: `POST /api/users` server route (uses `auth.admin.createUser` via service role key; `handle_new_user` trigger creates the profile row, then portals and role are inserted). The route is **caller-gated** — verifies the requester is an active command admin/root server-side before any service-role action.
- Edit user: updates `profiles`, reconciles `user_portals` and `user_roles` client-side (RLS permits command admins)
- Delete user: `DELETE /api/users?id=<uuid>` server route (uses `auth.admin.deleteUser`; cascades to profile, portals, roles). Same caller-gate; also blocks self-deletion.
- Toggle status: flips `profiles.status_id` between active and suspended

#### Vendors Page (fully wired)
- List of all vendors, fetched from `vendors` + `statuses`
- **Refresh button** in the toolbar re-fetches the list in place (no page reload) — same rationale as the Users page. See `.plans/2026-07-18-live-updates-no-refresh.md`.
- Add vendor: inserts to `vendors` with `name`, `accreditation_no`, `region`, `branches`, `phone`, `email`
- Edit vendor: updates the same fields
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

#### Notification Type Settings Page (fully wired)
- Accessible via the Sidebar's Settings button
- Table of all 7 notification types with label, description, target portal, and an on/off toggle
- Toggle updates `notification_type_settings.is_enabled` — disabling a type suppresses all future notifications of that type platform-wide (does not delete existing rows)
- Only visible/accessible to users with `admin` or `root` role

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
| KPI widgets | ⚠️ Vendor count live; bookings/revenue seeded |
| Transactions | ❌ Mock data (`ALL_TXNS` constant — wallet table not built) |

### Known Gaps

- **No vendor member management.** Command can approve vendors but cannot assign `vendor-admin` roles through the portal. Must be done via Supabase dashboard or SQL.
- **No booking oversight.** Command cannot browse all bookings platform-wide from the portal UI.
- **Transactions page blocked.** Contingent on `wallet_transactions` table being built.
- **KPI accuracy.** Booking count and revenue widgets are still seeded; only vendor count is live.
- **No password set on user creation.** New users are created with `email_confirm: true` and no password — they must use "Forgot Password" to set their own password before logging in.

### Roadmap (Approximate Priority)

1. Wire KPI widgets to live DB counts (total bookings, users, revenue)
2. Vendor member management UI: assign `vendor-admin` role to a user for a specific vendor
3. Platform-wide bookings view: list and filter all bookings across vendors
4. Transactions page: contingent on wallet table being built
5. Audit log: track who approved what and when

---

## Cross-Portal Feature Parity Notes

Some features need to be built in multiple portals to be complete end-to-end:

| Feature | Booker | Vendor | Command |
|---------|---------|---------|---------|
| Booking creation | ✅ Done | — | — |
| Booking status update | ❌ (cancel only) | ⚠️ Confirm/cancel done; complete pending | ❌ (view) |
| Document upload | ⚠️ In-memory | ❌ (view only) | — |
| Wallet / Transactions | ✅ Transactions live (from bookings) | ❌ Wallet mock | ❌ (transactions mock) |
| Notifications | ✅ Live | ✅ Live | ✅ Live + Type Settings admin |
| Map / coordinates | ⚠️ Placeholder | — | — |
| Installable PWA | ✅ Live (real-device verification pending, incl. PayMongo round-trip) | ✅ Live (real-device verification pending) | — Not planned |
