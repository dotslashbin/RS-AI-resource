# Portals

Current state, feature inventory, gaps, and roadmap for each of the three portals. For the tech stack and DB they share, see `overview.md` and `schema.md`.

---

## RS Learner — Learner Portal (`./learner`)

**Audience:** Driving school learners  
**Portal name in DB:** `learner`  
**Default user role:** `member`

### Purpose

Allow learners to browse driving school offerings, book a slot at a school of their choice, upload required documents, and track the status of their bookings.

### Current Features

#### Booking Wizard (fully wired to Supabase + PayMongo)
A 6-step guided flow:

| Step | UI | Data source |
|------|----|------------|
| 1 — Choose Service | Offering cards with category colour and price | `offerings` table (all active, deduplicated by code) |
| 2 — Choose School | Academy list + Leaflet map (user location dot) | `academies` table (filtered by offering code) |
| 3 — Pick Schedule | Calendar + time slot buttons | `schedules` table (recurrence expanded client-side) |
| 4 — Upload Documents | Per-requirement file upload with progress bar | `exam.requirements` JSONB field (fetched from DB via `offerings` table) |
| 5 — Confirm | Summary review screen | Review only — no DB writes |
| 6 — Payment | Booking summary + Pay button | Writes booking to `bookings` → creates PayMongo Checkout Session → redirects to PayMongo hosted payment page |

#### Dashboard
- Booking history list (`BookingCard` components), fetched from the `bookings` table on login
- Click-to-open booking detail modal
- `InProgressCard` widget: reads wizard draft from `localStorage`; shows step progress and resume button if a draft is present
- **My Results** widget: shows the learner's completed bookings as individual cards (2-column grid). Each card has a coloured left border, an offering code badge, academy name, date, price paid, a Certificate button (placeholder), and a per-offering SVG watermark (steering wheel for TDC, road perspective for PDC, motorcycle wheels for MDC, open book for lessons/other). Shows up to 4 most recent completed bookings. Section is visually distinct from "Current Bookings" below it.

#### Wallet Page
- Balance display (static ₱0.00 placeholder)
- Transaction list (empty)
- Add funds button (non-functional)

#### Settings Page
- Display name, email, and phone (read-only) — name/email from the Supabase Auth session, phone from `profiles.phone` (via `useSettingsPage`)
- Appearance / dark-mode toggle
- Logout

#### Navigation
- Bottom tab bar (Dashboard, Booking)
- Sidebar with Settings (hamburger toggle)
- Light/dark theme toggle

### What Is Live vs. Mock

| Feature | Status |
|---------|--------|
| Booking wizard (Steps 1–6) | ✅ Supabase-wired |
| Booking written to DB on confirm | ✅ Supabase-wired (Step 6) |
| PayMongo payment integration | ✅ Live — Checkout Sessions; webhook sets `is_paid` on confirmation |
| Booking history on dashboard | ✅ Supabase-wired (fetched on login) |
| My Results widget | ✅ Live — completed bookings as individual cards with SVG watermarks |
| In-app notifications | ✅ Live — bell icon, panel (main + archive views), Realtime delivery, optimistic read/archive/delete |
| Document uploads | ⚠️ In-memory only (no Storage/DB writes) |
| Wallet balance | ❌ Static placeholder |
| Wallet transactions | ❌ No data |
| User profile editing | ❌ Not implemented |
| Booking cancellation / reschedule | ❌ Not implemented |

### Known Gaps

- **Document uploads not persisted.** Files are selected and shown in the UI but not sent to Supabase Storage or written to `booking_documents`. The booking record exists but has no attached documents.
- **Academy map has no school markers.** `academies` table has no `lat`/`lng` columns. The map shows the user's location only.

### Roadmap (Approximate Priority)

1. Add lat/lng to `academies` table; show academy markers on Step 2 map
2. Implement real document uploads (Supabase Storage + `booking_documents`)
3. Add booking cancellation flow (learner sets status to `cancelled` while still `pending`)
4. Wallet: `wallet_accounts` + `wallet_transactions` tables; deduct price on booking confirm
5. Display examiner info (from `schedules.examiner_name`) on booking confirmation and detail screens
6. ~~Push/in-app notifications when booking status changes~~ **Done** — full notifications system live

---

## School Portal — Academy Portal (`./academy`)

**Audience:** Driving school administrators  
**Portal name in DB:** `academy`  
**Default user role:** `academy-admin` (in `academy_members`)

### Purpose

Allow academy administrators to define their service catalogue, set up schedule availability, manage their instructor roster, and handle incoming bookings from learners.

### Current Features

#### Registration Flow
Academy operators self-register via a form on the login screen. The form sends to the server-side Route Handler `POST /api/auth/register`, which uses the service-role admin client to: create and immediately activate the user, grant academy portal access, create the academy record (status `pending_activation`), and assign the `academy-admin` role. The user can log in immediately; the academy awaits Command approval before appearing to learners.

#### Offerings Page (fully wired)
- List of the academy's offerings, grouped or filterable by category
- Add offering form: name, code, category, price, duration, description, requirements
- Edit offering
- Toggle offering active/inactive (`is_active`)
- Offering category badges (exam/lesson/other colour coding)

#### Schedules Page (fully wired)
- Calendar/list view of active schedules
- Add schedule form: title, offering picker, instructor picker, date, time range, days of week, recurrence, capacity
- Recurrence options: none / weekly / biweekly / monthly
- Filter by offering or instructor
- Edit and delete schedules

#### Calendar Page (mock)
- Monthly calendar view showing schedule dots and booking indicators
- Click a day to see schedules and bookings for that day in a side panel
- Driven by local state from `BOOKINGS` and `SCHEDULES` constants — not wired to DB

#### Instructors Page (fully wired)
- List of the academy's instructors
- Add/edit instructor form: name, email, phone, license number, specialties (offering codes)
- Validation: name required, email format check
- `canSave` gate on form — disabled until required fields are valid

#### Bookings Page (fully wired)
- Incoming booking list with status filter tabs (all / pending / confirmed / completed / cancelled)
- Approve and reject actions write to the `bookings` table; DB triggers log status changes to `booking_status_log`
- Optimistic UI: state updates immediately on approve/reject; reverts on error with a toast notification
- Pending count badge on the filter tab
- Learner name fetched via `profiles` join on `bookings`

#### Wallet Page (mock)
- Balance/Transactions tab toggle
- Summary cards: Total Revenue, Total Payouts (static figures)
- Transaction list from `TXNS` constant

#### Packages Page (mock)
- List of driving course packages with price, included items, and colour coding
- Driven by `PACKAGES` constant
- Add/Edit/Delete buttons are non-functional

#### School Profile Page (fully wired)
- Display and edit: academy name, address, phone, email, operating hours, year established, LTO accreditation number
- Save changes writes to `academies` table

#### Layout
- Sidebar with academy name (fetched from DB for logged-in user's academy)
- Light/dark theme toggle
- Multi-academy support: if a user is `academy-admin` at multiple academies, they can switch between them

### What Is Live vs. Mock

| Feature | Status |
|---------|--------|
| Self-registration + academy creation | ✅ Supabase-wired (via server Route Handler) |
| Offerings CRUD | ✅ Supabase-wired |
| Schedules CRUD | ✅ Supabase-wired |
| Instructors CRUD | ✅ Supabase-wired |
| School profile | ✅ Supabase-wired |
| Incoming bookings list | ✅ Supabase-wired |
| In-app notifications | ✅ Live — bell icon, panel (main + archive views), Realtime delivery, optimistic read/archive/delete |
| Calendar (schedules + bookings overlay) | ❌ Mock data |
| Booking status management | ✅ Supabase-wired (approve/cancel; complete pending) |
| Booking document viewing | ❌ Not implemented |
| Wallet / transactions | ❌ Mock data |
| Packages | ❌ Mock data |

### Known Gaps

- **No schedule capacity tracking.** The `max_capacity` field exists on schedules, but there's no display of how many learners have booked each occurrence.
- **Offering deletion is not implemented.** Offerings can only be deactivated (`is_active = false`). Hard delete is restricted (schedules RESTRICT on delete) — would need to deactivate/delete schedules first.
- **Packages page has no backing table.** If packages (bundles of offerings with a combined price) become a real feature, they need a DB schema.
- **No photo/logo upload.** Academy profile has no image support yet.

### Roadmap (Approximate Priority)

1. Schedule capacity view: show booking count vs. max_capacity per occurrence
2. Booking status: add `completed` transition (currently approve → confirmed; complete transition not yet implemented)
3. Booking documents: allow academy admin to view uploaded documents
4. Academy logo/photo upload (Supabase Storage)
5. Wire calendar page to real schedules + bookings from DB
6. ~~Notifications when a new booking arrives~~ **Done** — full notifications system live

---

## RS Command (`./command`)

**Audience:** RS internal operations team  
**Portal name in DB:** `command`  
**User roles:** `admin` or `root` (in `user_roles`)

### Purpose

Platform-wide oversight: activate user accounts, approve academies, manage portal access, and monitor platform activity.

### Current Features

#### Overview / Dashboard
- KPI widgets: active school count (live from `academies`), total bookings, platform revenue, held wallet funds (latter three are seeded)
- Booking trend and school trend charts (seeded)

#### Users Page (fully wired)
- List of all profiles across all portals, fetched from `profiles` + `user_portals` + `user_roles`
- Create user: `POST /api/users` server route (uses `auth.admin.createUser` via service role key; `handle_new_user` trigger creates the profile row, then portals and role are inserted). The route is **caller-gated** — verifies the requester is an active command admin/root server-side before any service-role action.
- Edit user: updates `profiles`, reconciles `user_portals` and `user_roles` client-side (RLS permits command admins)
- Delete user: `DELETE /api/users?id=<uuid>` server route (uses `auth.admin.deleteUser`; cascades to profile, portals, roles). Same caller-gate; also blocks self-deletion.
- Toggle status: flips `profiles.status_id` between active and suspended

#### Schools (Academies) Page (fully wired)
- List of all academies, fetched from `academies` + `statuses`
- Add school: inserts to `academies` with `name`, `lto_accred_no`, `region`, `branches`, `phone`, `email`
- Edit school: updates the same fields
- Toggle status: flips `academies.status_id` between active and suspended (governed by the `prevent_academy_status_self_update` trigger — only command admins may change status)
- Delete school: only available to `root` role; deletes the `academies` row (cascades to offerings, instructors, schedules)
- Schools state is held in `useAppShell` and passed to both SchoolsPage and OverviewPage so both see live counts

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
| Academy list | ✅ Supabase-wired |
| Add / edit / delete academies | ✅ Supabase-wired |
| Academy approval / suspension | ✅ Supabase-wired |
| In-app notifications | ✅ Live — bell icon, panel (main + archive views), Realtime delivery, optimistic read/archive/delete |
| Notification Type Settings | ✅ Live — platform-wide enable/disable per notification type |
| KPI widgets | ⚠️ School count live; bookings/revenue seeded |
| Transactions | ❌ Mock data (`ALL_TXNS` constant — wallet table not built) |

### Known Gaps

- **No academy member management.** Command can approve academies but cannot assign `academy-admin` roles through the portal. Must be done via Supabase dashboard or SQL.
- **No booking oversight.** Command cannot browse all bookings platform-wide from the portal UI.
- **Transactions page blocked.** Contingent on `wallet_transactions` table being built.
- **KPI accuracy.** Booking count and revenue widgets are still seeded; only school count is live.
- **No password set on user creation.** New users are created with `email_confirm: true` and no password — they must use "Forgot Password" to set their own password before logging in.

### Roadmap (Approximate Priority)

1. Wire KPI widgets to live DB counts (total bookings, users, revenue)
2. Academy member management UI: assign `academy-admin` role to a user for a specific academy
3. Platform-wide bookings view: list and filter all bookings across academies
4. Transactions page: contingent on wallet table being built
5. Audit log: track who approved what and when

---

## Cross-Portal Feature Parity Notes

Some features need to be built in multiple portals to be complete end-to-end:

| Feature | Learner | Academy | Command |
|---------|---------|---------|---------|
| Booking creation | ✅ Done | — | — |
| Booking status update | ❌ (cancel only) | ⚠️ Confirm/cancel done; complete pending | ❌ (view) |
| Document upload | ⚠️ In-memory | ❌ (view only) | — |
| Wallet | ❌ Placeholder | — | ❌ (transactions) |
| Notifications | ✅ Live | ✅ Live | ✅ Live + Type Settings admin |
| Map / coordinates | ⚠️ Placeholder | — | — |
