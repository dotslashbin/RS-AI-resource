# Notifications — Platform Taxonomy & Implementation Plan

---

## Context

The RS platform has three portals (learner, academy, command) sharing one Supabase backend. Currently, the only in-app feedback mechanism is Sonner toast messages — all transient, all same-session. There is no way for a user to be alerted about something that happened in another portal, or to catch up on events they missed while logged out.

The `notifications` table is already listed in `schema.md` as a planned future table. This plan defines the taxonomy (what is a notification vs. a toast), the schema, lifecycle management (read/unread, archive, delete), notification type controls managed by Command, and how each portal surfaces it.

---

## Open Decisions (Must Resolve Before Execution)

These are unresolved questions where the answer changes the schema, component structure, or implementation approach. Do not begin execution until each has a decision recorded here.

### OD-1 — Portal context on notifications ✅ Resolved

**Decision: Add `portal` column.**

`portal text NOT NULL REFERENCES portals(name)` added to the `notifications` table. Each notification targets exactly one portal. Each app's `getNotifications()` and Realtime subscription filter to their own portal name. Dual-role users see only relevant notifications per portal.

Impact: schema updated below; trigger functions must specify target portal on insert; app-layer writes must specify portal; Realtime filter includes portal; seed Block 8 includes portal per row.

---

### OD-2 — Deep linking on notification click ✅ Resolved

**Decision: Mark as read only — no deep linking this phase.**

Clicking a notification marks it as read and closes the panel. No navigation. Deep linking is explicitly deferred to a later phase.

---

### OD-3 — Notification panel UI shape ✅ Resolved

**Decision: Dropdown panel.**

Anchored to the bell icon, scrollable with max-height. All three portals use the same pattern. No portal/overlay rendering required.

---

## The Core Distinction

| Type | When to use | Persists? | Cross-user? |
|------|------------|-----------|-------------|
| **Toast** | You just did something — feedback on your own action | No | No |
| **Notification** | Something happened elsewhere that changes your state | Yes (DB) | Yes |

**Toast rule:** If the action that triggered the message was taken by the same user in the same session, it's a toast.

**Notification rule:** If the trigger was another user, another portal, or an async system (webhook, DB trigger), it's a notification.

---

## Toast-Only (No Change)

These stay as toasts. They are direct feedback on the user's own immediate action and have no value outside the current session.

### Learner
| Toast | Trigger |
|-------|---------|
| "You already have a booking for this slot." | `already_booked` result from `createBooking()` |
| "This slot is now fully booked." | `full` result from `createBooking()` |
| "Booking failed. Please try again." | `error` result from `createBooking()` |
| "Payment setup failed. Please try again." | `/api/payment/create-session` returns non-OK |
| "Payment successful! Your booking is pending confirmation." | `?payment=success` on return from PayMongo |
| "Payment cancelled. Your booking is saved as pending." | `?payment=cancel` on return from PayMongo |

### Academy
| Toast | Trigger |
|-------|---------|
| Instructor create/update/delete/status errors | CRUD failure on own action |
| Schedule create/update/delete errors | CRUD failure on own action |
| Profile update error | Save failure on own action |
| "Failed to approve booking." | Optimistic approve reverted — own action |
| "Failed to reject booking." | Optimistic reject reverted — own action |

### Command
No toasts currently exist. When CRUD actions are added, their success/failure feedback should follow the same toast pattern as academy — toast only, no notifications.

---

## Notification Events (Persistent, Stored in DB)

These involve one portal acting on data that another portal cares about. The recipient may not be online when the event fires. Each type can be enabled or disabled by Command (all enabled by default — see Type Controls section).

### Learner receives
| Event | Type key | Trigger | Who writes |
|-------|----------|---------|------------|
| **Booking confirmed** | `booking_confirmed` | Academy approves a pending booking | DB trigger on `bookings` status → `confirmed` |
| **Booking rejected** | `booking_rejected` | Academy rejects a booking | DB trigger on `bookings` status → `cancelled` with `rejection_reason` |
| **Booking cancelled** | `booking_cancelled` | Academy cancels a confirmed booking | DB trigger on `bookings` status → `cancelled` |

### Academy receives
| Event | Type key | Trigger | Who writes |
|-------|----------|---------|------------|
| **New booking received** | `new_booking` | Learner completes booking wizard | DB trigger on `bookings` INSERT |
| **Payment confirmed** | `payment_confirmed` | PayMongo webhook sets `is_paid = true` | App layer (webhook route, service role) |

### Command receives
| Event | Type key | Trigger | Who writes |
|-------|----------|---------|------------|
| **New academy pending approval** | `academy_pending_approval` | Academy self-registers | App layer (academy register route, service role) |
| **New user sign-up (learner)** | `new_user_registration` | Learner self-registers | App layer (learner register route, service role) |
| **New user sign-up (academy admin)** | `new_user_registration` | Academy admin self-registers | App layer (academy register route, service role) |

> The academy register route writes **two** notifications: `academy_pending_approval` (the academy record needs approval) and `new_user_registration` (a new user account was created). Both are written in the same route handler after a successful registration.

---

## Who Receives Notifications

- **Learner notifications:** recipient is `bookings.learner_id` (the specific learner)
- **Academy notifications:** all users who are `academy-admin` in `academy_members` for that `academy_id`
- **Command notifications:** all users with `admin` or `root` role in `user_roles`

---

## Notification Lifecycle

Every notification has three independent state fields:

| Field | Default | Meaning |
|-------|---------|---------|
| `is_read` | `false` | Toggled by the user — bidirectional (can mark unread again) |
| `is_archived` | `false` | Hides from the main list; preserved in DB |
| (deletion) | — | Hard delete via DELETE RLS policy; permanent |

**Main panel** shows: `is_archived = false`, all read states, newest first.
**Archive view** shows: `is_archived = true` only.
**Deletion** is permanent — no recovery. Confirm before delete.

Per-notification actions available in the UI:
- Mark as read / Mark as unread (toggle)
- Archive (moves to archive view)
- Delete (with confirmation prompt)

Bulk actions:
- Mark all as read
- Archive all read notifications

---

## Proposed Schema

### `notifications` table

```sql
CREATE TABLE notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portal      text        NOT NULL REFERENCES portals(name),
  type        text        NOT NULL REFERENCES notification_type_settings(type) ON DELETE RESTRICT,
  title       text        NOT NULL,
  body        text        NOT NULL,
  data        jsonb       NOT NULL DEFAULT '{}',
  is_read     boolean     NOT NULL DEFAULT false,
  is_archived boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- portals.name has UNIQUE constraint (confirmed in 20260504000001_lookup_tables.sql) — FK is valid
-- Indexes include portal so per-app queries and realtime filters can be satisfied efficiently
CREATE INDEX notifications_user_portal_idx
  ON notifications (user_id, portal, created_at DESC);
CREATE INDEX notifications_user_portal_unread_idx
  ON notifications (user_id, portal, is_archived, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users read/update/delete their own notifications only
-- INSERT has no RLS policy — written exclusively by SECURITY DEFINER triggers and service-role app layer
CREATE POLICY "users select own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING    (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
```

**`data` payload examples:**
```json
// booking_confirmed / booking_rejected / booking_cancelled
{ "booking_id": "uuid", "academy_name": "...", "offering_name": "...", "booked_date": "YYYY-MM-DD" }

// new_booking / payment_confirmed
{ "booking_id": "uuid", "learner_name": "...", "offering_code": "TDC", "booked_date": "YYYY-MM-DD" }

// academy_pending_approval
{ "academy_id": "uuid", "academy_name": "...", "lto_accred_no": "..." }

// new_user_registration
{ "user_id": "uuid", "full_name": "...", "email": "...", "source": "learner" | "academy_admin" }
```

---

### `notification_type_settings` table

Command admins control which notification types are active platform-wide. Disabling a type suppresses creation of new notifications of that type — it does not delete existing ones.

```sql
CREATE TABLE notification_type_settings (
  type        text    PRIMARY KEY,
  label       text    NOT NULL,
  description text    NOT NULL DEFAULT '',
  is_enabled  boolean NOT NULL DEFAULT true
);

ALTER TABLE notification_type_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed by triggers and app layer before inserting)
-- INSERT and DELETE are migration-only — no app-layer policies are defined intentionally
CREATE POLICY "authenticated read notification_type_settings"
  ON notification_type_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only command portal admins can update (matches the pattern used across the rest of the codebase)
CREATE POLICY "command admins update notification_type_settings"
  ON notification_type_settings FOR UPDATE
  TO authenticated
  USING (
    public.is_portal_member('command')
    AND (public.has_role('admin') OR public.has_role('root'))
  )
  WITH CHECK (
    public.is_portal_member('command')
    AND (public.has_role('admin') OR public.has_role('root'))
  );
```

**Seed data (inserted in migration):**

| type | label | description |
|------|-------|-------------|
| `booking_confirmed` | Booking Confirmed | Sent to learner when academy approves their booking |
| `booking_rejected` | Booking Rejected | Sent to learner when academy rejects their booking |
| `booking_cancelled` | Booking Cancelled | Sent to learner when a confirmed booking is cancelled |
| `new_booking` | New Booking Received | Sent to academy when a learner books a slot |
| `payment_confirmed` | Payment Confirmed | Sent to academy when PayMongo confirms payment |
| `academy_pending_approval` | New Academy Registration | Sent to Command when an academy self-registers |
| `new_user_registration` | New User Sign-Up | Sent to Command when any user self-registers (learner or academy admin) |

---

## Write Strategy

**Before writing any notification, check `notification_type_settings.is_enabled` for that type.** If disabled, skip the insert entirely. DB triggers do this with an `IF EXISTS (SELECT 1 FROM notification_type_settings WHERE type = '...' AND is_enabled)` guard. App-layer writes do the same check via a helper query before inserting.

**DB triggers** (preferred for booking events — fire regardless of which portal made the change):

> **All trigger functions must be `SECURITY DEFINER` with `set search_path = public`.**  
> The `notifications` table has no INSERT RLS policy for authenticated users — inserts are allowed only via `SECURITY DEFINER` triggers and the service-role app layer. Without `SECURITY DEFINER`, a learner-triggered insert (booking creation) would fail to write notifications for academy admins, and an academy-triggered update would fail to write notifications for the learner. `set search_path = public` is required alongside `SECURITY DEFINER` (matches all existing trigger functions in the codebase) to prevent search path injection.

- Function `notify_on_new_booking()` — trigger name `bookings_notify_new`, `AFTER INSERT ON public.bookings`
  - Guard: `new_booking` type is enabled
  - Write `new_booking` notification with **`portal = 'academy'`** to all `academy-admin` members of `bookings.academy_id`
  - **Query uses `role_id` join:** `academy_members` stores `role_id` (smallint FK to `roles`); filter with `JOIN roles r ON r.id = am.role_id WHERE r.name = 'academy-admin'`
- Function `notify_on_booking_status_change()` — trigger name `bookings_notify_status_change`, `AFTER UPDATE OF status ON public.bookings` (using `OF status` so the trigger only fires when the status column actually changes — not on every booking update; fires after `bookings_log_status_change` alphabetically — correct order)
  - Function body must open with `IF OLD.status = NEW.status THEN RETURN NEW; END IF;` as a belt-and-suspenders guard, matching the pattern in `log_booking_status_change()`
  - `pending → confirmed` → write `booking_confirmed` with **`portal = 'learner'`** to `learner_id` (guard: type enabled)
  - `→ cancelled`, `rejection_reason != ''` → write `booking_rejected` with **`portal = 'learner'`** to `learner_id` (guard: type enabled)
  - `confirmed → cancelled`, `rejection_reason = ''` → write `booking_cancelled` with **`portal = 'learner'`** to `learner_id` (guard: type enabled)
  - **`rejection_reason` is `NOT NULL DEFAULT ''`** — no NULL check needed; `!= ''` is sufficient and correct
  - **Known gap:** `pending → cancelled` with empty `rejection_reason` (academy cancels without giving a reason) produces no notification. Acceptable for this phase — the app currently requires a reason when rejecting.
  - **`user_roles` query for command admins** uses: `JOIN roles r ON r.id = ur.role_id WHERE r.name IN ('admin', 'root')`

**App layer** (for events with no suitable DB trigger anchor):
- `academy/app/api/auth/register/route.ts` — after successful registration, write **two** notifications with **`portal = 'command'`** to all `admin`/`root` users:
  1. `academy_pending_approval` (the new academy record needs review) — guard: type enabled
  2. `new_user_registration` with `source: "academy_admin"` (a new user account was created) — guard: type enabled
- `learner/app/api/register/route.ts` — after learner registration succeeds, write `new_user_registration` with **`portal = 'command'`** and `source: "learner"` to all `admin`/`root` users (guard: type enabled)
- `learner/app/api/payment/webhook/route.ts` — after `is_paid = true` update, write `payment_confirmed` with **`portal = 'academy'`** to all `academy-admin` members (guard: type enabled)

**App-layer write failure handling:**
Notification writes are secondary to the primary operation. A failed notification insert must **never** roll back or fail the parent request (registration, webhook). The pattern in each route is:
1. Complete the primary operation (create user, update `is_paid`, etc.)
2. Attempt notification insert(s) in a try/catch
3. On error: log the failure (console.error or server-side logger), continue — return the primary success response regardless

Do not wrap the primary operation and the notification insert in the same database transaction.

---

## Delivery to UI (Supabase Realtime)

Each portal subscribes to `notifications` on INSERT filtered by both `user_id` and `portal`. Each app knows its own portal name as a constant (`'learner'`, `'academy'`, `'command'`). The dual filter ensures dual-role users are not cross-contaminated across portals. Pattern reused from `.plans/2026-05-24-realtime-bookings.md`.

```typescript
const channel = supabase
  .channel(`notifications-${user.id}`)
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "notifications",
    filter: `user_id=eq.${user.id},portal=eq.${PORTAL_NAME}`,
  }, payload => {
    // prepend to local notifications list + increment unread badge
  })
  .subscribe()
```

**Subscription cleanup on logout:**
The channel must be removed when the user logs out or the session ends. In `useAppShell.ts`, store the channel reference and call `supabase.removeChannel(channel)` in the logout handler and in the cleanup return of the subscription effect. Without this, a user who logs out and back in as a different user retains the old subscription keyed to the previous `user.id`.

**Subscription gap on login:**
There is a small window between when the initial `getNotifications()` fetch completes and when the Realtime subscription is fully established. A notification arriving in that window will not appear until the next login. This is an accepted trade-off at this scale — no mitigation required for this phase. Document this behaviour so it is not mistaken for a bug.

Realtime must be enabled on the `notifications` table:
```sql
alter publication supabase_realtime add table public.notifications;
```

---

## UI Surface

### All three apps — Notification Panel

**Panel shape:** Dropdown anchored to the bell icon, scrollable with max-height. All three portals use this pattern.

**Bell icon:** Unread count badge visible when count > 0; hidden (not just zeroed) when count is 0. Clicking the bell opens the panel.

**Panel content states — all must be handled:**

| State | Trigger | UI treatment |
|-------|---------|-------------|
| Loading | Initial fetch in progress | Skeleton rows or spinner |
| Empty (main) | No notifications, or all archived | Placeholder: "You're all caught up" |
| Empty (archive) | Nothing archived yet | Placeholder: "Nothing archived" |
| Populated | Notifications present | Full list, newest first |

**Notification list (`is_archived = false`, newest first):**
- Each item: type icon · title · body · relative timestamp · bold text when unread
- Per-item action menu (⋯): Mark as read / Mark as unread · Archive · Delete (with confirm)
- Header actions: "Mark all as read" · "Archive all read"
- Tab or link to **Archive view** — same panel, filtered to `is_archived = true`

**On notification click:** Marks as read only. No navigation. Deep linking is deferred to a later phase.

**Optimistic updates:** Mark as read, archive, and delete should all be optimistic — update local state immediately, revert and show a toast on error. This matches the pattern used in the academy bookings page and avoids perceptible lag on common actions.

### Command — Notification Type Settings
- New section in Command settings or a dedicated page: **Notification Settings**
- Table listing all notification types: label, description, enabled toggle
- Toggle calls `updateNotificationTypeSetting(type, isEnabled)` which updates `notification_type_settings`
- Changes take effect immediately for all future notifications — no restart needed
- Only visible to `admin` and `root` roles

---

## Service Functions (each app)

```typescript
// notifications.service.ts
// All queries filter by user_id (via RLS) AND portal (hardcoded per app — each app only sees its own portal's notifications)
getNotifications(options?: { archived?: boolean, limit?: number, offset?: number })
setReadStatus(id: string, isRead: boolean)          // bidirectional toggle
markAllAsRead()
archiveNotification(id: string)
archiveAllRead()
deleteNotification(id: string)
```

**Portal filtering:** Each app's `getNotifications()` adds `.eq('portal', PORTAL_NAME)` to every query. RLS already restricts to `user_id = auth.uid()`; the portal filter is applied on top at the query level. This ensures dual-role users only see the relevant portal's notifications regardless of which app they're using.

**Pagination:** `getNotifications()` must not fetch unbounded rows. Apply a default limit (suggested: 50) and support `offset` for loading more. The panel should show a "Load more" control if the returned count equals the limit. Without this, a heavy user or busy academy admin could trigger a very large fetch on every login.

> **`getUnreadCount()` is not a separate service call.** After the initial `getNotifications()` load, unread count is derived from local state: `notifications.filter(n => !n.is_read && !n.is_archived).length`. When a Realtime INSERT arrives, increment locally. When `markAllAsRead()` completes, reset to 0 locally. The initial count on page load is derived from the same `getNotifications()` fetch — no separate DB call is needed at any point.

**State ownership:** Notification state (list + unread count) lives in `useAppShell.ts` and is passed down to the topbar (for the badge) and the notification panel component. Do not fetch or subscribe at the component level — a single subscription per session, established once on login. This prevents duplicate subscriptions from re-renders.

Command-only (in a separate admin service):
```typescript
getNotificationTypeSettings()
updateNotificationTypeSetting(type: string, isEnabled: boolean)
```

---

## Out of Scope (This Phase)

- Email or SMS notifications
- Push notifications (PWA / native)
- Per-user notification preferences (user-level opt-out per type)
- Scheduled/reminder notifications (e.g., "your booking is tomorrow")
- Admin broadcasting platform-wide alerts
- Notification expiry / auto-archive after N days

---

## Development Seed Data

### `notification_type_settings` (migration-level, not seed.sql)

The 7 type rows are inserted inside `20260525000001_notification_type_settings.sql` (the first notification migration). This is reference data required for the feature to function in any environment — not dev-only — so it belongs in the migration, not `seed.sql`. It will always exist before `seed.sql` runs because migrations execute first on `supabase db reset`.

### `notifications` (Block 8 in `seed.sql`)

After a `supabase db reset`, the notification panel would be empty with no way to test UI states without manually triggering booking events. Block 8 inserts realistic notification rows directly — bypassing triggers and RLS, which is safe because `seed.sql` runs as the postgres/service role.

All UUIDs below reference existing seeded entities from seed.sql Blocks 1–7.

**Learner — Liza** (`00000000-0000-0000-0000-000000000003`, portal: `learner`)

| # | Type | Title | Body | State |
|---|------|-------|------|-------|
| 1 | `booking_confirmed` | Booking Confirmed | Your TDC booking at Alpha Laguna Driving Academy on April 27 has been confirmed. | **unread**, active |
| 2 | `booking_rejected` | Booking Rejected | Your PDC booking at Alpha Laguna Driving Academy on April 30 was rejected. Reason: Slot no longer available — please rebook. | read, active |
| 3 | `booking_cancelled` | Booking Cancelled | Your TDC booking at Alpha Laguna Driving Academy on March 15 has been cancelled by the academy. | read, **archived** |

`data` payloads:
- #1: `{ "booking_id": "30000000-0000-0000-0000-000000000001", "academy_name": "Alpha Laguna Driving Academy", "offering_name": "Theoretical Driving Certificate", "booked_date": "2026-04-27" }`
- #2: `{ "booking_id": "30000000-0000-0000-0000-000000000002", "academy_name": "Alpha Laguna Driving Academy", "offering_name": "Practical Driving Certificate", "booked_date": "2026-04-30" }`
- #3: `{ "booking_id": "30000000-0000-0000-0000-000000000099", "academy_name": "Alpha Laguna Driving Academy", "offering_name": "Theoretical Driving Certificate", "booked_date": "2026-03-15" }` (fictional past booking — data only, no FK)

**Academy — Marco** (`00000000-0000-0000-0000-000000000002`, portal: `academy`)

| # | Type | Title | Body | State |
|---|------|-------|------|-------|
| 4 | `new_booking` | New Booking Received | Liza Cruz has booked a TDC slot on April 27. | **unread**, active |
| 5 | `payment_confirmed` | Payment Confirmed | Payment for Liza Cruz's TDC booking (April 27) has been confirmed. | read, **archived** |

**Academy — Jose** (`00000000-0000-0000-0000-000000000012`, portal: `academy`)

| # | Type | Title | Body | State |
|---|------|-------|------|-------|
| 6 | `new_booking` | New Booking Received | Liza Cruz has booked a TDC slot on April 27. | **unread**, active |

> #4 and #6 represent the same booking event delivered to two different admins of the same academy — verifies multi-recipient fan-out from the trigger.

**Academy — Maria** (`00000000-0000-0000-0000-000000000013`, portal: `academy`)

| # | Type | Title | Body | State |
|---|------|-------|------|-------|
| 7 | `new_booking` | New Booking Received | Liza Cruz has booked a TDC slot on April 27. | read, active |
| 8 | `new_booking` | New Booking Received | Sofia Bautista has booked a TDC slot on April 27. | **unread**, active |

**Academy — Dante** (`00000000-0000-0000-0000-000000000008`, portal: `academy`)

| # | Type | Title | Body | State |
|---|------|-------|------|-------|
| 9 | `new_booking` | New Booking Received | Sofia Bautista has booked a TDC slot on April 27. | **unread**, active |

> #8 and #9 represent the same booking event (Sofia's TDC at Right) delivered to two different admins — second fan-out verification.

**Command — Jun** (`00000000-0000-0000-0000-000000000004`, portal: `command`)

| # | Type | Title | Body | State |
|---|------|-------|------|-------|
| 10 | `new_user_registration` | New User Sign-Up | Liza Cruz (liza@roadsafety.ph) created a learner account. | **unread**, active |
| 11 | `academy_pending_approval` | New Academy Registration | Alpha Laguna Driving Academy (LTO-DS-2004-LA-001) has registered and is awaiting approval. | read, **archived** |

**Command — Clara** (`00000000-0000-0000-0000-000000000007`, portal: `command`)

| # | Type | Title | Body | State |
|---|------|-------|------|-------|
| 12 | `new_user_registration` | New User Sign-Up | Liza Cruz (liza@roadsafety.ph) created a learner account. | **unread**, active |

> #10 and #12 represent the same registration event delivered to two different command admins — verifies command fan-out.
> Note: Marco (`00000000-0000-0000-0000-000000000002`) is also a command admin, but his seed notifications are `portal = 'academy'` — verifying that his command portal session does not show them.

`data` payloads for command notifications:
- `new_user_registration`: `{ "user_id": "00000000-0000-0000-0000-000000000003", "full_name": "Liza Cruz", "email": "liza@roadsafety.ph", "source": "learner" }`
- `academy_pending_approval`: `{ "academy_id": "10000000-0000-0000-0000-000000000001", "academy_name": "Alpha Laguna Driving Academy", "lto_accred_no": "LTO-DS-2004-LA-001" }`

**`new_booking` `data` payload** (shared for #4, #6, #7):
`{ "booking_id": "30000000-0000-0000-0000-000000000001", "learner_name": "Liza Cruz", "offering_code": "TDC", "booked_date": "2026-04-27" }`

**`new_booking` `data` payload** (#8, #9 — Sofia's TDC at Right):
`{ "booking_id": "30000000-0000-0000-0000-000000000003", "learner_name": "Sofia Bautista", "offering_code": "TDC", "booked_date": "2026-04-27" }`

**`payment_confirmed` `data` payload** (#5):
`{ "booking_id": "30000000-0000-0000-0000-000000000001", "learner_name": "Liza Cruz", "offering_code": "TDC", "booked_date": "2026-04-27" }`

### Panel states covered after reset

| Portal | User | Unread | Read (active) | Archived |
|--------|------|--------|---------------|----------|
| Learner | Liza | 1 | 1 | 1 |
| Academy | Marco | 1 | 0 | 1 |
| Academy | Jose | 1 | 0 | 0 |
| Academy | Maria | 1 | 1 | 0 |
| Academy | Dante | 1 | 0 | 0 |
| Command | Jun | 1 | 0 | 1 |
| Command | Clara | 1 | 0 | 0 |

Every meaningful UI state (unread badge, read item, archive view, empty archive) is testable immediately after reset without any manual triggering.

### Notification row UUIDs (fixed, for reproducibility)

Use the `40000000-0000-0000-0000-00000000000X` range:

| UUID | Notification |
|------|-------------|
| `40000000-0000-0000-0000-000000000001` | Liza — booking_confirmed (unread) |
| `40000000-0000-0000-0000-000000000002` | Liza — booking_rejected (read) |
| `40000000-0000-0000-0000-000000000003` | Liza — booking_cancelled (archived) |
| `40000000-0000-0000-0000-000000000004` | Marco — new_booking (unread) |
| `40000000-0000-0000-0000-000000000005` | Marco — payment_confirmed (archived) |
| `40000000-0000-0000-0000-000000000006` | Jose — new_booking (unread) |
| `40000000-0000-0000-0000-000000000007` | Maria — new_booking/Liza (read) |
| `40000000-0000-0000-0000-000000000008` | Maria — new_booking/Sofia (unread) |
| `40000000-0000-0000-0000-000000000009` | Dante — new_booking (unread) |
| `40000000-0000-0000-0000-000000000010` | Jun — new_user_registration (unread) |
| `40000000-0000-0000-0000-000000000011` | Jun — academy_pending_approval (archived) |
| `40000000-0000-0000-0000-000000000012` | Clara — new_user_registration (unread) |

`created_at` values should be staggered (e.g., `now() - interval 'X hours'`) so the panel shows realistic ordering, with the most recent unread notifications at the top.

---

## Migration Files Required

| File | Purpose |
|------|---------|
| `20260525000001_notification_type_settings.sql` | `notification_type_settings` table + RLS + seed rows |
| `20260525000002_notifications.sql` | `notifications` table + RLS (SELECT/UPDATE/DELETE) + Realtime publication |
| `20260525000003_notification_triggers.sql` | `notify_on_new_booking()` (trigger: `bookings_notify_new`) + `notify_on_booking_status_change()` (trigger: `bookings_notify_status_change`) — both `SECURITY DEFINER`, AFTER triggers with type-enabled guards; academy recipient query joins `roles` table on `role_id` |

App-layer writes (register routes, webhook) use the existing service role client — no additional migration needed.

---

## Files to Change (Implementation Phase)

| File | Change |
|------|--------|
| `backbone/supabase/migrations/` | 3 new migration files |
| `backbone/supabase/seed.sql` | Add Block 8 — 12 notification rows covering all UI states for all seeded users |
| `learner/…/useAppShell.ts` | Fetch notifications + unread count on login; Realtime subscription |
| `academy/…/useAppShell.ts` | Same |
| `command/…/useAppShell.ts` | Same + fetch/expose `notification_type_settings` |
| `learner/app/api/register/route.ts` | Write `new_user_registration` to command admins on success |
| `academy/app/api/auth/register/route.ts` | Write `academy_pending_approval` + `new_user_registration` (source: academy_admin) to command admins on success |
| `learner/app/api/payment/webhook/route.ts` | Write `payment_confirmed` to academy admins after `is_paid = true` |
| Topbar (all 3 apps) | Add bell icon + unread badge |
| New `NotificationPanel` component (each app) | Panel with main + archive view; per-item actions; bulk actions |
| New `notifications.service.ts` (each app) | Full service with all lifecycle functions |
| New Command settings page/section | Notification type enable/disable controls |

---

## Verification

**Before running any verification, regenerate types in all three apps:**
```bash
supabase gen types typescript --project-id <ref> > backbone/types/supabase.ts
# then copy/link into each app as per current project setup
```
Without this step, `npx tsc --noEmit` will fail for reasons unrelated to the notification code.

1. Learner books a slot → academy sees "New booking received" in real-time (no refresh)
2. Academy approves → learner sees "Booking confirmed" in real-time
3. Academy rejects → learner sees "Booking rejected" with reason in body
4. Learner self-registers → command admins see "New user sign-up" (source: learner)
5. Academy self-registers → command admins see **two** notifications: "New academy pending approval" + "New user sign-up" (source: academy_admin)
6. Payment webhook fires → academy admins see "Payment confirmed"
7. Bell badge increments with each new notification; resets on "Mark all as read"
8. Marking a read notification as unread re-bolds it and increments the badge
9. Archiving removes from main list; appears in archive view
10. Deleting is permanent; confirmation required
11. Command disables `new_booking` type → new bookings no longer generate notifications (existing ones unchanged)
12. Log out and back in — unread notifications and badge count persist from DB
13. Panel shows loading state while initial fetch is in progress
14. Empty state shown when user has no active notifications; archive empty state shown when archive is empty
15. Log out → log back in as a different user → no notifications from the previous user's session appear; old Realtime channel is gone
16. `npx tsc --noEmit` passes in all three apps
