# Email Notifications via Resend

**Date:** 2026-06-23
**App / scope:** Cross-cutting — `backbone/supabase` (new Edge Function + migrations), `command` (admin UI). Notification-email path needs **no** booker/vendor app code (see Q1). The added password-recovery work (D-6 = A) touches **all three apps** (redirect + update-password page).
**Status:** IN PROGRESS — all decisions resolved + **schema drafts S1–S3 APPROVED (2026-06-24)**. Ready to execute Phase 1. (Resend/Vault setup intentionally deferred by the user; the dispatch trigger no-ops until Vault is configured, so Phase 1 is safe to build first.)

> One-line framing: deliver an email for every in-app notification through **one** centralized Supabase Edge Function that calls Resend, hooked off the `notifications` table — with a per-portal email kill-switch managed in Command. Optimize for: not duplicating logic across three apps, one secret location, and SOLID code.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** D# = Decision, S# = Schema change (approval gate), P# = Phase/step. Numbers are plan-local; cross-plan refs are qualified by app.

---

## Goal & scope

**In scope**
- Every notification that lands in `public.notifications` also triggers exactly one email to the recipient.
- A per-portal (per-app) switch to disable email sending for `booker`, `vendor`, or `command`, managed by Command admins.
- Resend integration, sending domain setup instructions, and secret handling.
- Email delivery logging for idempotency and observability.
- **Password-recovery email via Resend SMTP** (Supabase Auth) + completing the app-side reset flow — see the dedicated section and D-6.

**Out of scope (this phase)**
- New notification *types* or new in-app events — we reuse the existing 7-type taxonomy verbatim.
- Per-*user* email preferences (user-level opt-out) — only platform/per-portal controls.
- SMS / push.
- Auth flows beyond password recovery (magic-link sign-in, email OTP). Enabling SMTP does route any other GoTrue mail (email-change, invite) through Resend, but those flows aren't being built here.
- Rich HTML design polish beyond a clean, shared base template.

---

## The two questions, answered

### Q1 — Do we need to configure all 3 apps with Resend access?

**No — not with the recommended design.** Because **every** notification (whether written by a DB trigger or by an app-layer route) becomes a row in `public.notifications`, we attach email delivery to that single table rather than to each app. One **Supabase Edge Function** (`send-notification-email`) owns all Resend calls. The Resend API key lives **only** as an Edge Function secret — it never enters `booker`, `vendor`, or `command`, and never becomes a `NEXT_PUBLIC_` var. The three Next.js apps keep doing exactly what they do today (write a `notifications` row); they gain nothing Resend-related.

Why this beats the alternative of calling Resend from each app:
- **Coverage.** The booking emails (`booking_confirmed`, `booking_rejected`, `booking_cancelled`, `new_booking`) are written by **Postgres triggers**, which have no app-layer hook. An app-layer Resend call could not cover them without rewriting those triggers. The table-level hook covers trigger-written *and* route-written notifications uniformly — satisfying "ALL notifications must come with an email."
- **DRY / SOLID.** One copy of the email logic, one secret, one place to change a template — versus three divergent copies across independent apps that (by project rule) share no code.
- **Security.** One secret location to protect and rotate.

### Q2 — How is per-app disabling of email achieved?

A new **`notification_email_settings`** table keyed by `portal` (`booker` / `vendor` / `command`) with an `is_email_enabled` boolean (default `true`). The Edge Function reads the row's `portal` and skips sending if that portal's email is disabled — the in-app notification still appears as normal. Command admins toggle these on the existing Notification Settings page. (Decision **D-2** below offers an optional finer-grained per-type switch on top of this; the per-portal switch is the literal "for each app" requirement and the recommended baseline.)

---

## Architecture (recommended)

```
                       ┌─────────────────────────────────────────┐
  booking events ─────▶│ Postgres triggers (existing)            │
  (booker/vendor)      │  notify_on_new_booking / _status_change │──┐
                       └─────────────────────────────────────────┘  │
                                                                     ├──▶ INSERT INTO public.notifications
  register / webhook ─▶ app-layer service-role inserts (existing) ───┘        (one row per recipient — fan-out
  (booker/vendor)                                                              already happens here)
                                                                                      │
                                                                                      ▼
                                                          AFTER INSERT trigger on notifications
                                                          → net.http_post(...) to Edge Function
                                                                                      │
                                                                                      ▼
                                   ┌──────────────────────────────────────────────────────────┐
                                   │ Edge Function: send-notification-email                     │
                                   │  1. verify shared secret header                            │
                                   │  2. settingsGate: is email enabled for record.portal?      │
                                   │  3. emailLog: already sent for this notification id? (idem) │
                                   │  4. recipientResolver: user_id → email + name              │
                                   │  5. templates[record.type] → {subject, html, text}         │
                                   │  6. emailSender (Resend) → send                            │
                                   │  7. write notification_emails log row (sent | failed)      │
                                   └──────────────────────────────────────────────────────────┘
                                                                                      │
                                                                                      ▼
                                                                                  Resend API
```

Nothing about the existing in-app pipeline changes. We add: one trigger, one Edge Function, two tables, and a Command UI section.

---

## Open decisions (resolve before execution)

**All resolved 2026-06-24:**

| ID | Decision | Resolution |
|----|----------|------------|
| D-1 | How a `notifications` INSERT reaches the function | ✅ A — pg_net + Vault trigger |
| D-2 | Email switch granularity | ✅ A — per-portal only |
| D-3 | Delivery logging / idempotency | ✅ A — separate `notification_emails` table + claim-first |
| D-4 | Sending domain + From identity | ✅ Domain `info.ezzy.com`; From `Ezzy <no-reply@info.ezzy.com>` |
| D-5 | Template strategy | ✅ A — one generic template, override later |
| D-6 | Password-recovery scope | ✅ A — complete the flow in all 3 apps |

> Still pending (manual steps only you can perform, then the schema approval gate): verify `info.ezzy.com` + DNS in Resend, store the secrets, set hosted SMTP + redirect URLs, confirm Resend plan limits (Setup §1–§7).

### D-1 — How does a `notifications` INSERT reach the Edge Function?  ✅ RESOLVED (2026-06-24) → Option A
Two ways to fire the HTTP call on insert:

- **Option A (recommended): migration-defined trigger using `pg_net` (`net.http_post`).** Reproducible — the wiring lives in a migration (honours the project invariant "schema changes via migrations only"). Requires enabling the `pg_net` extension and storing the function URL + shared secret in **Supabase Vault** (`vault.secrets`) so no secret sits in the migration file. Trigger reads them via `vault.decrypted_secrets`.
- **Option B: Supabase Dashboard "Database Webhooks."** Faster to set up (point-and-click), but the config lives outside migrations — it must be documented and re-created per environment by hand, which drifts from our migrations-as-source-of-truth rule.

**Recommendation: A.** Note the trade-off: A is more setup now (Vault + pg_net) but stays reproducible across local/staging/prod.

### D-2 — Granularity of the email switch  ✅ RESOLVED (2026-06-24) → Option A (per-portal)
- **Option A (recommended baseline): per-portal only** — `notification_email_settings(portal, is_email_enabled)`. Exactly matches "for each app." Three toggles.
- **Option B: per-portal + per-type** — also add `email_enabled boolean default true` to `notification_type_settings`. The function requires *both* the portal switch AND the type's email flag to be on. More control (e.g. "emails for everything in vendor except `payment_confirmed`"), slightly more UI.

**Recommendation: A now, B later if needed.** A fully satisfies the stated requirement; B is a clean additive extension (the function's gate just ANDs one more boolean).

### D-3 — Email delivery tracking & idempotency  ✅ RESOLVED (2026-06-24) → Option A + claim-first
`pg_net` / webhooks can retry, so the function must be idempotent (don't email twice for one notification).

- **Option A (recommended): separate `notification_emails` log table** (`notification_id` FK unique, `status`, `provider_message_id`, `error`, `attempted_at`). Keeps `notifications` focused on in-app concerns (single-responsibility), and gives an audit trail of every send/failure. The function checks for an existing `sent` row before sending.
- **Option B: columns on `notifications`** (`email_status`, `email_sent_at`). Fewer objects, but mixes delivery state into the in-app table and offers no per-attempt history.

**Recommendation: A.**

**Concurrency — claim first, don't check-then-send (item #4).** A naive `has()` → send → `record()` flow lets two near-simultaneous invocations both pass the existence check and double-send. Instead the function **inserts the log row as `status='sending'` first**, relying on `unique(notification_id)` to make the second concurrent attempt fail fast (it catches the unique violation and returns without sending). It then sends and **updates** the row to `sent`/`failed`. Risk is modest under D-1 Option A (pg_net does not auto-retry), but real under Option B (Dashboard webhooks **do** retry) — so this couples to D-1.

### D-5 — Template strategy: one generic vs per-type  ✅ RESOLVED (2026-06-24) → Option A (generic-first)
- **Option A (recommended): one generic template.** Renders any type from the row's existing `title`/`body` + shared `base.ts`. Covers all 7 immediately; zero per-type files. Add a per-type override later only where it earns its keep.
- **Option B: a bespoke template per type** (up to 7), each pulling from the `data` payload for tailored copy/CTA (e.g. a "View booking" button on `booking_confirmed`).

**Recommendation: A, then selectively B.** The registry pattern makes this non-binding — start generic, override individual types with no change to the handler (OCP). See the template table under "Email templates" for the full list either way. Note: templates are authored **in code**, not in the Resend dashboard.

### D-4 — From identity / sending domain  ✅ RESOLVED (2026-06-24)
**Intended sending domain: `info.ezzy.com` (→ `info.ezzy.ph` once purchased). From: `Ezzy <no-reply@…>`.** A **temporary domain is in use for now**; the live value is whatever is currently verified in Resend, and `NOTIFICATION_EMAIL_FROM` must match it. Switching to the real domain later is config-only — see the runbook `architecture/email-sending-domain.md`. The same domain/From is reused for password-recovery SMTP (D-6). (Until the domain is verified, Resend only allows `onboarding@resend.dev` to your own account email — usable for the first smoke test only.)

> Note on brand: the rest of the product/code still says "Bookdeck" (the "EzzyBook" rename is decided-but-deferred). Email leads with **"Ezzy"** to match the `info.ezzy.com` domain (chosen to be rename-agnostic and avoid a display-name/domain mismatch). Template header/footer copy uses "Ezzy" accordingly; notification `title`/`body` text is unchanged (it carries vendor/booking names, not the platform brand).

### D-6 — Password-recovery scope: config-only vs complete the flow  ✅ RESOLVED (2026-06-24) → Option A (complete)
- **Option A (recommended): complete the flow.** Configure Resend SMTP **and** add a `redirectTo` + an update-password page in all three apps, so password recovery works end-to-end.
- **Option B: SMTP config only.** Wire Resend SMTP so the mail sends, but defer the missing update-password page — the recovery link delivers but dead-ends with nowhere to set a new password.

**Recommendation: A.** Option B ships a broken UX. This is surfaced for your nod (not auto-tightened) because A widens scope to **all three apps' code** — an AGENTS "touches >1 app" gate. See the "Supabase Auth emails — password recovery" section for specifics.

---

## Schema changes (drafts — approval gate before any migration is written)

> **Approval gate CLEARED — S1, S2, S3 approved 2026-06-24.** Decisions on review: S2 stuck-`'sending'` rows left to the future retry sweep (not building timed re-claim now); pg_net + Vault confirmed as new backbone dependencies. New tables MUST include explicit API-role `GRANT`s (the `public` default grants nothing — see `20260620000001_api_role_grants.sql`).

### S1 — `notification_email_settings` (per-portal email switch)  ✅ APPROVED (2026-06-24) — not yet written
**File (proposed):** `backbone/supabase/migrations/20260623000001_notification_email_settings.sql`

```sql
create table public.notification_email_settings (
  portal           text    primary key references public.portals(name),
  is_email_enabled boolean not null default true
);

comment on table public.notification_email_settings is
  'Per-portal master switch for outbound notification emails. Managed by Command admins. Email on by default.';

alter table public.notification_email_settings enable row level security;

-- All authenticated users can read (Edge Function uses service_role; this is for the Command UI).
create policy "authenticated read notification_email_settings"
  on public.notification_email_settings for select
  to authenticated using (true);

-- Only command admins can toggle (mirrors notification_type_settings policy).
create policy "command admins update notification_email_settings"
  on public.notification_email_settings for update
  to authenticated
  using      (public.is_portal_member('command') and (public.has_role('admin') or public.has_role('root')))
  with check (public.is_portal_member('command') and (public.has_role('admin') or public.has_role('root')));

-- Seed one row per portal (all enabled). portals.name is the canonical set.
insert into public.notification_email_settings (portal)
  select name from public.portals;

-- Explicit API-role grants (default privileges grant nothing).
grant select, update on public.notification_email_settings to authenticated;
grant select, insert, update, delete on public.notification_email_settings to service_role;
```

**Blast radius:** new table only; no existing data touched. Reversible via `drop table`. Type regen required afterwards. UPDATE-only for authenticated (no insert/delete from app — rows are seed-fixed per portal).

### S2 — `notification_emails` (delivery log / idempotency)  ✅ APPROVED (2026-06-24) — not yet written
**File (proposed):** `backbone/supabase/migrations/20260623000002_notification_emails.sql`

```sql
create table public.notification_emails (
  id                  uuid        primary key default gen_random_uuid(),
  notification_id     uuid        not null unique references public.notifications(id) on delete cascade,
  recipient_email     text        not null,
  status              text        not null check (status in ('sending','sent','failed','skipped')),
  provider_message_id text,
  error               text,
  attempted_at        timestamptz not null default now()
);
-- 'sending' is the claim-first state (item #4): inserted before the send, then updated to
-- 'sent'/'failed'. A row stuck at 'sending' (function crashed mid-send) blocks re-claim and
-- never emails — acceptable in v1 (pg_net has no auto-retry); the future retry sweep clears stale
-- 'sending' rows older than N minutes. 'skipped' = settings-off / no-email / no-renderer.

comment on table public.notification_emails is
  'Outbound notification-email delivery log. One row per notification (unique). Written only by the send-notification-email Edge Function via service_role.';

alter table public.notification_emails enable row level security;
-- No authenticated policies: this is service-role-only operational data. (Optional later:
-- a command-admin SELECT policy if we surface a delivery dashboard.)

grant select, insert, update, delete on public.notification_emails to service_role;
-- No grants to authenticated (no RLS policy references it).
```

**Blast radius:** new table; `on delete cascade` keeps it consistent when a notification is deleted. The `unique(notification_id)` is the idempotency guard. Reversible via `drop table`.

### S3 — INSERT trigger that calls the Edge Function  ✅ APPROVED (2026-06-24) — not yet written
**File (proposed):** `backbone/supabase/migrations/20260623000003_notification_email_dispatch.sql`

**WRITTEN** as `20260624000003_notification_email_dispatch.sql`. Two corrections applied vs the original sketch: (a) `pg_net` is created **without** a schema clause — its functions live in the `net` schema per Supabase's documented usage (`with schema extensions` would be wrong); (b) `supabase_vault` is created so `vault.decrypted_secrets` exists at function-create time (it also pulls in `pgsodium`; both are standard Supabase extensions, pre-enabled on hosted).

```sql
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- Reads function base URL + shared secret from Vault so no secret lives in the migration.
create or replace function public.dispatch_notification_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text;
  v_secret   text;
begin
  select decrypted_secret into v_base_url from vault.decrypted_secrets where name = 'edge_function_base_url';
  select decrypted_secret into v_secret   from vault.decrypted_secrets where name = 'notification_email_secret';
  if v_base_url is null or v_secret is null then
    return new;  -- not configured (e.g. local without Vault) — skip silently, never block the insert
  end if;

  perform net.http_post(
    url     := v_base_url || '/functions/v1/send-notification-email',
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret', v_secret),
    body    := jsonb_build_object('notification_id', new.id)  -- function re-reads the row authoritatively
  );
  return new;
end;
$$;

create trigger notifications_dispatch_email
  after insert on public.notifications
  for each row execute function public.dispatch_notification_email();
```

**Design choices baked in:**
- The HTTP body carries only `notification_id`; the function re-reads the row with service_role (don't trust/duplicate payload, and `data` may be large).
- **Post-commit delivery is load-bearing (item #7).** Re-reading the row by `id` inside the function is only safe because `pg_net` delivers the HTTP call **after** the inserting transaction commits — the row is guaranteed visible by then. Do **not** "optimize" this into a synchronous in-trigger HTTP call: that would fire mid-transaction and the function would 404 on a not-yet-committed row.
- `net.http_post` is fire-and-forget — a Resend/network failure can never roll back or slow the notification insert (satisfies the existing "notifications are secondary" principle).
- If Vault secrets are absent (local dev without setup), the trigger no-ops — local notification creation is unaffected.

**Seed / `db reset` interaction (item #1 — must handle).** `seed.sql` Block 8 (`backbone/supabase/seed.sql:645`) inserts notification rows directly. This trigger fires on those inserts too, so every `db reset` would attempt ~12 sends. Locally it's saved only by the no-Vault no-op above, but any environment with Vault configured (e.g. a staging re-seed) would email real recipients. **Fix:** wrap Block 8's inserts with
`alter table public.notifications disable trigger notifications_dispatch_email;` … `enable trigger …` (the trigger already exists at seed time — migrations run before seed). Add this when S3 lands.

**Blast radius:** adds an extension + a trigger on the hot `notifications` insert path. `net.http_post` is async (queued by pg_net), so insert latency stays negligible. Reversible by dropping trigger/function. **Verify pg_net is available** on the target Supabase plan during execution.

### S4 — Types  ✖ NOT APPLICABLE (verified 2026-06-24)
AGENTS.md lists `supabase gen types typescript` as an invariant, but **this codebase never adopted generated types**: there is no generated types file, the Supabase clients are created untyped (no `<Database>` generic), and services use hand-written interfaces + casts (e.g. `command/services/notifications-admin.service.ts` → `data as NotificationTypeSetting[]`). So no type regen is needed. Instead, **hand-write** the `NotificationEmailSetting` interface in the Command service in Phase 4, matching the existing pattern. The Edge Function is Deno with its own types.

---

## Edge Function design (SOLID)

**Location:** `backbone/supabase/functions/send-notification-email/`

```
send-notification-email/
  index.ts                 # HTTP entry only: verify secret, parse body, build deps, call handler
  handler.ts               # orchestration; depends on INTERFACES, not concretions (DIP)
  deps.ts                  # pinned external imports (resend, supabase-js) — one place to manage versions
  types.ts                 # NotificationRecord, EmailContent, Result types
  lib/
    emailSender.ts         # interface EmailSender + ResendEmailSender impl (transport — SRP)
    recipientResolver.ts   # interface RecipientResolver + SupabaseRecipientResolver (user_id → {email,name})
    settingsGate.ts        # interface SettingsGate + SupabaseSettingsGate (portal email on/off; +type flag if D-2=B)
    deliveryLog.ts         # interface DeliveryLog + SupabaseDeliveryLog (claim row + complete with result — see #4)
    templates/
      base.ts              # shared HTML layout (brand header/footer, button) → DRY for every email
      registry.ts          # maps notification type → renderer; generic fallback covers all (OCP)
      generic.ts           # default renderer: subject = title, body = body (covers all 7 types day one)
      # per-type overrides are OPTIONAL — add a file here only when a type needs bespoke copy/CTA:
      # bookingConfirmed.ts / paymentConfirmed.ts / … (see D-5 and the template table below)
```

**How SOLID maps here:**
- **SRP** — transport (`emailSender`), recipient lookup, settings gate, logging, and templating are each isolated modules; `handler` only orchestrates.
- **OCP** — adding a new notification type = add a renderer + a `registry` entry; no edits to handler/sender/gate. A missing-type lookup logs and skips rather than crashing.
- **LSP / ISP** — small focused interfaces (`EmailSender.send(content)`, `RecipientResolver.resolve(userId)`, `SettingsGate.isEnabled(record)`, `DeliveryLog.claim(id)/complete(id, result)`); no fat interfaces.
- **DIP** — `handler(deps)` receives interfaces; `index.ts` injects the Supabase/Resend implementations. Tests can inject fakes with no network.

**Handler flow (pseudocode):**
```
1. read NotificationRecord by id (service_role)            → 404-skip if gone
2. if !settingsGate.isEnabled(record) → log 'skipped', return
3. recipient = recipientResolver.resolve(record.user_id)   → if no email, log 'skipped', return
4. content = templates[record.type](record, recipient)     → if no renderer, log 'skipped', return
5. CLAIM: insert deliveryLog row status='sending'          → on unique violation, return (idempotent, #4)
6. apply non-prod override: to = OVERRIDE_TO ?? recipient.email   (#5)
7. result = emailSender.send(from, to, content)            (template HTML-escapes all dynamic values — #3)
8. deliveryLog.update(record.id, result)                   → 'sent' (+provider id) | 'failed' (+error)
9. return 200 always (so pg_net/webhook doesn't hammer retries on a permanent skip)
```
> The CLAIM insert (step 5) replaces a check-then-send `has()` and is the real idempotency guard under concurrency.

**Recipient email source:** `profiles.email` (kept in sync with `auth.users.email` per `schema.md`). Resolver fallback: if `profiles.email` is empty, call `auth.admin.getUserById` as a backstop. **Verify** the sync trigger actually populates `profiles.email` during execution (P2 check).

**Secrets used by the function (Edge Function secrets, never in apps):**
- `RESEND_API_KEY`
- `NOTIFICATION_EMAIL_FROM` = `Ezzy <no-reply@info.ezzy.com>`
- `NOTIFICATION_EMAIL_SECRET` (shared with the DB trigger header check)
- `NOTIFICATION_EMAIL_OVERRIDE_TO` (item #5 — **non-prod only**: if set, every email is redirected to this single inbox instead of the real recipient, so a staging reset or a test booking never emails real bookers/vendors. Unset in production.)
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (auto-injected in the Supabase Edge runtime)

**Function must skip JWT verification (item #2).** The dispatch call authenticates with `x-webhook-secret`, not a user JWT, so Supabase's gateway would reject it with **401** under the default. Add to `backbone/supabase/config.toml`:
```toml
[functions.send-notification-email]
verify_jwt = false
```
and deploy with `--no-verify-jwt`. The shared secret (checked in `index.ts`) is the real auth gate — without `verify_jwt = false`, Phase 3 wiring fails with 401.

---

## Email templates — where they live, and the full list

### Where the email format is authored
**In code, inside the Edge Function** (`backbone/supabase/functions/send-notification-email/templates/`) — **not** in the Resend dashboard. This is deliberate:

- Resend's **transactional** API (what we use) just takes `from`, `to`, `subject`, and `html`/`text` strings — you do **not** pre-create templates in Resend for it. (Resend's dashboard template editor is for *Broadcasts* — marketing blasts — which is a different product surface and not what notifications use.)
- Authoring in code means templates are version-controlled, reviewed, type-checked against the notification `data` shape, and testable with no network — and they ride the future EzzyBook rename with the rest of the codebase.
- Authoring options inside the function: plain HTML template strings (simplest in Deno) or the **React Email** library (Resend's recommended authoring tool) if we want components. Recommendation: start with template strings + one shared `base.ts` layout; reach for React Email only if the markup grows.

So the answer to "where do I create the format": you (we) build it as code modules here, and Resend only needs your **verified domain + API key** (Setup §1–§4). Nothing to create in the Resend UI.

> **Hard rule — escape all dynamic values (item #3 / security).** Unlike the in-app panel (rendered by React, auto-escaped), email templates build **raw HTML strings**, and the interpolated values are user-controlled — `full_name` (registration), `rejection_reason` (free text), vendor/offering names. Every dynamic value injected into HTML **must be HTML-escaped** by the template layer (a single `escapeHtml()` helper in `base.ts`, applied to all interpolations). Otherwise a name/reason containing markup yields HTML injection / content spoofing in the email. The plain-text alternative carries the raw text safely.

### Do you need one email per notification? — No (recommended), but you *can*
Every `notifications` row already carries a fully-composed human-readable `title` and `body` (written by the triggers/routes). So **one generic template** can render all seven types on day one: `subject = title`, heading = `title`, paragraph = `body`, wrapped in the shared branded `base.ts`. You only add a per-type template when a specific email deserves bespoke copy, layout, or a call-to-action button. This is decision **D-5** below.

### The notification set (7 types) — your template list
If you go per-type (D-5 Option B), these are the templates to author. If you go generic-first (recommended), this is just the matrix the **one** generic template must read correctly. Source: `notification_type_settings` seed + the trigger/route bodies.

| Type | Recipient (portal) | Fires when | Suggested subject | `data` fields available for a richer template |
|------|--------------------|-----------|-------------------|----------------------------------------------|
| `booking_confirmed` | Booker | Vendor approves a pending booking | "Your booking is confirmed" | `booking_id, vendor_name, offering_name, booked_date` |
| `booking_rejected` | Booker | Vendor rejects a booking (with reason) | "Update on your booking" | `booking_id, vendor_name, offering_name, booked_date` (reason is in `body`) |
| `booking_cancelled` | Booker | Vendor cancels a confirmed booking | "Your booking was cancelled" | `booking_id, vendor_name, offering_name, booked_date` |
| `new_booking` | Vendor admin(s) | Booker completes a booking | "New booking received" | `booking_id, booker_name, offering_code, booked_date` |
| `payment_confirmed` | Vendor admin(s) | PayMongo webhook sets `is_paid` | "Payment confirmed" | `booking_id, booker_name, offering_code, booked_date` |
| `vendor_pending_approval` | Command admin(s) | A vendor self-registers | "New vendor awaiting approval" | `vendor_id, vendor_name, accreditation_no` |
| `new_user_registration` | Command admin(s) | Any user self-registers | "New user sign-up" | `user_id, full_name, email, source` (`booker`/`vendor_admin`) |

> Note: a single event can fan out to several recipients (e.g. all vendor admins) — but that's **one row per recipient already**, so it's still one email per row. The template count is driven by *types* (max 7), not by recipients.

---

## Command UI changes

**File area:** existing Notification Settings page (the one driven by `command/services/notifications-admin.service.ts`).

- Add an **"Email Delivery"** section above/below the existing per-type toggles.
- Three toggles — Booker, Vendor, Command — bound to `notification_email_settings.is_email_enabled`.
- Extend `notifications-admin.service.ts` with `getEmailSettings()` / `updateEmailSetting(portal, enabled)`, mirroring the existing `getNotificationTypeSettings` / `updateNotificationTypeSetting` shape.
- Follow the component/hook separation rule: the toggle section gets a `useEmailSettings.ts` hook; the `.tsx` stays a pure render layer (`./skills/component-hook-separation.md`).
- Visible to `admin`/`root` only (same gate the page already applies).
- (If D-2 = B, the per-type rows gain a second "Email" toggle column alongside the existing enable toggle.)

---

## Supabase Auth emails — password recovery (Resend SMTP)

> Added per request. This is a **separate mechanism** from notification emails — it does **not** go through the Edge Function. It shares only the Resend account and the verified domain (D-4).

**Two email systems, one provider:**

| | Notification emails | Auth emails (password recovery, email-change, invite) |
|---|---|---|
| Path | `notifications` row → pg_net trigger → Edge Function → Resend **API** | Supabase GoTrue → **SMTP** → user |
| Templates | code in the Edge Function | Supabase auth templates (`config.toml` / dashboard) |
| Config | Edge Function secrets | `[auth.email.smtp]` + dashboard SMTP |

**Current state (verified):**
- App-side trigger **already exists** — all three apps call `resetPasswordForEmail` from their LoginPage "Reset password" UI (`booker/services/auth.service.ts:32`, plus vendor/command equivalents).
- **Delivery is not configured** — `[auth.email.smtp]` in `config.toml` is commented out, so reset mails go to Supabase's dev-only Inbucket mailer; nothing reaches a real inbox in any deployed environment.
- **The flow dead-ends** — `resetPasswordForEmail` is called with **no `redirectTo`**, and there is **no update-password landing page** in any app. Even once SMTP delivers the email, the recovery link has nowhere to set a new password.

**What this section adds:**

1. **Configure Resend SMTP for Supabase Auth (the email the request is about).**
   - Local — enable `[auth.email.smtp]` in `backbone/supabase/config.toml`:
     ```toml
     [auth.email.smtp]
     enabled = true
     host = "smtp.resend.com"
     port = 587
     user = "resend"
     pass = "env(RESEND_API_KEY)"
     admin_email = "no-reply@info.ezzy.com"
     sender_name = "Ezzy"
     ```
   - Hosted (prod) — set the same under Supabase Dashboard → Project Settings → Auth → SMTP. (`config.toml` governs local; the dashboard governs the hosted project — both are needed.)
   - Enabling custom SMTP routes **all** GoTrue emails through Resend (recovery, email-change, invite; signup-confirm is currently off — `enable_confirmations = false`). Mind GoTrue `max_frequency` (`1s`) and Supabase auth-email rate limits.

2. **(Optional) Brand the recovery template** via `[auth.email.template.recovery]` (`subject` + `content_path` to an HTML file under `backbone/supabase/templates/`). Default GoTrue copy works; brand to "Ezzy" to match the From.

3. **Complete the app-side recovery flow (coupled requirement — D-6 = A).** Without this the email links nowhere:
   - Pass `redirectTo` (e.g. `<app-url>/reset-password`) to `resetPasswordForEmail` in each app's `auth.service.ts`.
   - Add an update-password landing page per app that handles the `PASSWORD_RECOVERY` auth event and calls `updateUser({ password })` (follow component/hook separation).
   - Add each app's `<app-url>/reset-password` to Supabase Auth **Redirect URLs** allow-list (dashboard) or it will be rejected.
   - This is what makes the work touch all three apps.

**Reuses, does not duplicate, the Resend setup:** the SMTP password is the **same `RESEND_API_KEY`**, and the From rides the **same verified domain** as D-4 — no extra provider config.

---

## Setup — what to do next (your actions, before/at execution)

> **Full bring-up runbook (local Docker + hosted), step-by-step:** `architecture/email-setup-local-and-remote.md`. The list below is the high-level version.
> Do these in order. Items marked **(you)** are manual steps in Resend / DNS / Supabase; the rest are code we build.

1. **(you) Verify a sending domain in Resend.** Pick the domain you'll send from (decision D-4), add it in Resend → Domains, then add the DNS records Resend gives you at your DNS provider: an **SPF** TXT record, the **DKIM** records, and (recommended) a **DMARC** TXT record. Wait for Resend to show the domain **Verified**.
   - Until verified, you can only send from `onboarding@resend.dev` to the email on your Resend account — fine for the very first smoke test, not for real sends.
2. **(you) `From` identity is set:** `Ezzy <no-reply@info.ezzy.com>` (D-4) → this becomes `NOTIFICATION_EMAIL_FROM`. Verify the domain in step 1 is `info.ezzy.com`.
3. **(you) Generate a shared webhook secret** (any long random string) for the trigger↔function handshake → `NOTIFICATION_EMAIL_SECRET`.
4. **(you) Check your Resend plan limits (item #6).** Confirm the daily send cap and per-second rate limit on your tier (the free tier has a low daily cap). A fan-out event (many vendor/command admins, a busy day) sends one email per recipient row — make sure that volume fits the plan before go-live.
5. **(you) Store secrets in Supabase** (not in any app, not in git):
   - `supabase secrets set RESEND_API_KEY=re_xxx NOTIFICATION_EMAIL_FROM="Ezzy <no-reply@info.ezzy.com>" NOTIFICATION_EMAIL_SECRET=…`
   - **Non-prod only:** also set `NOTIFICATION_EMAIL_OVERRIDE_TO=you@example.com` in dev/staging (item #5) so nothing reaches real users there. Leave it **unset in production**.
   - For D-1 Option A, also add Vault secrets `edge_function_base_url` (your `https://<ref>.supabase.co`) and `notification_email_secret` (the trigger reads these). **Full step-by-step in `architecture/email-secrets-setup.md`** — incl. where each value comes from and that `notification_email_secret` must equal the function's `NOTIFICATION_EMAIL_SECRET`.
   - For **local** dev: put the same keys in `backbone/supabase/functions/.env` and run `supabase functions serve send-notification-email --env-file …` (this file must be gitignored).
6. **Set `verify_jwt = false`** for the function in `config.toml` (item #2) — see the Edge Function design section. Without it the dispatch call is rejected with 401.
7. **(you) Password recovery (if D-6):** set the Resend SMTP settings in the hosted Supabase dashboard (Auth → SMTP), and add each app's `/reset-password` URL to Auth → URL Configuration → Redirect URLs. The SMTP password is the same `RESEND_API_KEY`; the From rides the same verified domain. See the password-recovery section.
8. The rest (tables, trigger, function, Command UI, app reset flow) is built per the Execution order below.

---

## Execution order (step-by-step checklist)

> Resolve **D-1…D-4** first — they change S2/S3 and the function's gate. Then proceed. Each phase ends with a verification check.

### Phase 0 — Decisions & setup prerequisites
- [ ] ⬜ Resolve D-1 (dispatch mechanism)
- [ ] ⬜ Resolve D-2 (switch granularity)
- [ ] ⬜ Resolve D-3 (logging/idempotency)
- [ ] ⬜ Resolve D-4 (From identity / domain) — unblocks Setup §1–§2
- [ ] ⬜ Resolve D-5 (generic vs per-type templates)
- [ ] ⬜ Resolve D-6 (password-recovery scope — your nod, expands to app code)
- [ ] ⬜ **(you)** Resend domain verified (Setup §1)
- [ ] ⬜ **(you)** Secrets generated & stored, incl. non-prod `NOTIFICATION_EMAIL_OVERRIDE_TO` (Setup §5, #5)
- [ ] ⬜ **(you)** Confirm Resend plan daily cap / rate limit fits expected volume (Setup §4, #6)
- [ ] ⬜ Confirm `pg_net` is available on the Supabase plan (if D-1 = A)

### Phase 1 — Schema (approval gate)
- [x] ✅ Approve S1–S3 SQL drafts (2026-06-24)
- [x] ✅ Create migration S1 `notification_email_settings` (+ grants, seed) — `20260624000001` (2026-06-24)
- [x] ✅ Create migration S2 `notification_emails` (+ grants) — `20260624000002` (2026-06-24)
- [x] ✅ Create migration S3 dispatch trigger — `20260624000003` (2026-06-24)
- [x] ✅ **#1**: `seed.sql` Block 8 wrapped with `disable trigger user` / `enable trigger user` so `db reset` doesn't fire sends (2026-06-24)
- [ ] ⬜ `supabase db reset` locally; confirm migrations apply cleanly **and no email is attempted during seed** — *(you, needs local stack)*
- [x] ✖ S4: type regen — N/A (this codebase uses hand-written interfaces, not generated types; verified 2026-06-24)

### Phase 2 — Edge Function  🔄 mostly DONE (2026-06-24) — code written, runtime verification pending
- [x] ✅ Scaffold `send-notification-email/` with the SOLID module layout
- [x] ✅ Add `[functions.send-notification-email] verify_jwt = false` to `config.toml` (**#2**)
- [x] ✅ Implement `emailSender` (Resend), `recipientResolver`, `settingsGate`, `deliveryLog` (claim/complete — **#4**)
- [x] ✅ Build `base.ts` (incl. `escapeHtml()` — **#3**) + generic renderer + registry (per D-5); per-type overrides only if D-5 = B
- [x] ✅ `index.ts` secret verification + `handler` orchestration; apply `NOTIFICATION_EMAIL_OVERRIDE_TO` (**#5**)
- [x] ✅ Unit tests (**#11**) written: `handler.test.ts` (not_found / no-recipient / disabled / idempotent / sent / failed + escaping). ⚠️ not yet executed — Deno not installed in the dev sandbox; run `deno test` (or via Supabase CLI).
- [ ] ⬜ Also added: `README.md`, `.env.example`; backbone `.gitignore` now ignores `.env`
- [x] ✅ Verify `profiles.email` resolver — seeded recipient resolved correctly in the live local test (2026-06-26)
- [x] ✅ `supabase functions serve` + curl smoke test → `{"outcome":"sent"}`, email delivered to override inbox, `notification_emails` row written (A4, 2026-06-26)
- [x] ✅ **Full local chain verified (A5, 2026-06-26):** Vault secrets set (`edge_function_base_url=http://host.docker.internal:54321`), a real `notifications` INSERT fired the trigger → pg_net → function → email delivered. Confirms trigger→function→Resend. *(Remote/hosted equivalent = Phase 3, still pending.)*

### Phase 3 — Wire it end-to-end
- [ ] ⬜ Deploy function: `supabase functions deploy send-notification-email`
- [ ] ⬜ Set Vault `edge_function_base_url` + secret to the deployed URL
- [ ] ⬜ Trigger a real notification (book a slot in booker) → vendor admin receives `new_booking` email
- [ ] ⬜ Toggle vendor email OFF in Command → next `new_booking` writes in-app only, **no email**, log row `skipped`
- [ ] ⬜ Toggle back ON → email resumes

### Phase 4 — Command UI
- [ ] ⬜ Extend `notifications-admin.service.ts` with email-settings read/update
- [ ] ⬜ Add "Email Delivery" section + `useEmailSettings.ts` hook (pure-render `.tsx`)
- [ ] ⬜ `npx tsc --noEmit` passes in `command`
- [ ] ⬜ Toggle each of the 3 portals from the UI; verify persisted + reflected in send behaviour

### Phase 4b — Password recovery (Resend SMTP + app flow) *(if D-6 = A)*
- [ ] ⬜ Enable `[auth.email.smtp]` (Resend) in `config.toml`; set SMTP in hosted dashboard
- [ ] ⬜ (Optional) brand the `recovery` auth template
- [ ] ⬜ Add `redirectTo` to `resetPasswordForEmail` in each app's `auth.service.ts`
- [ ] ⬜ Add an update-password page (handles `PASSWORD_RECOVERY` → `updateUser({password})`) in booker, vendor, command
- [ ] ⬜ Add each `/reset-password` URL to Supabase Auth redirect allow-list
- [ ] ⬜ E2E: request reset → email arrives via Resend → link opens update-password page → new password works
- [ ] ⬜ `npx tsc --noEmit` passes in all three apps

### Phase 5 — Close-out
- [ ] ⬜ Update `architecture/overview.md` tech-stack row: Resend "planned" → live (app notification emails)
- [ ] ⬜ Note email layer in `architecture/` notifications/schema docs as needed
- [ ] ⬜ Update this plan's statuses + record verification

---

## Verification

| Check | Kind |
|-------|------|
| Migrations apply on a clean `supabase db reset` **with no email attempted during seed** (#1) | machine + live |
| `npx tsc --noEmit` passes in `command` (hand-written interfaces; no type regen) | machine |
| Edge Function unit tests pass: skip/claim/idempotency paths + HTML-escaping (#3, #4, #11) | machine |
| Local function smoke test: fake `notification_id` → one email (to override inbox, #5), one `sent` log row | needs live env (Resend + function serve) |
| Idempotency: two concurrent POSTs for one id → exactly one send (claim rejects the loser, #4) | needs live env |
| HTML-injection: a notification whose name/reason contains `<b>`/`<script>` renders escaped, not active (#3) | needs live env |
| Dispatch call without/with wrong `x-webhook-secret` is rejected; `verify_jwt=false` lets the valid call through (#2) | needs live env |
| Password recovery (D-6): request reset → email via Resend SMTP → link → update-password page → new password logs in | needs live env |
| `npx tsc --noEmit` passes in booker + vendor after the reset-flow changes (D-6) | machine |
| E2E: booker books → vendor admin gets `new_booking` email in real time | needs live env |
| Per-portal switch: disable vendor → in-app still fires, email `skipped` | needs live env |
| Failure isolation: invalid Resend key → notification insert still succeeds, log row `failed` | needs live env |
| Each of the 7 types renders a correct subject/body from a real notification | needs live env |

---

## Risks & notes
- **pg_net availability / latency** — confirm the extension exists on the plan; `net.http_post` is async so insert latency is unaffected, but failed dispatches are only visible via the `notification_emails` log (no `sent` row appears). Acceptable for this phase; a retry sweep is future work.
- **Dispatch gap** — if the function is down when a notification inserts, that email is lost (no automatic retry in v1). The in-app notification is unaffected. Document; revisit with a retry/cron sweep if it matters.
- **Resend rate / volume limits (item #6)** — fan-out events emit one email per recipient row; bursts can hit per-second or daily caps (esp. free tier). Confirm the plan fits expected volume (Setup §4) before go-live.
- **Domain not verified** — sends silently fail/limited until DNS propagates; Setup §1 is a hard prerequisite for real sends.
- **Backfill is intentionally none** — the dispatch trigger is INSERT-only, so notifications that already exist when the feature ships are never emailed. This is desired, not a bug — state it so it isn't mistaken for one.
- **Brand naming** — email leads with **"Ezzy"** (From + template chrome), matching the `info.ezzy.com` domain; the rest of the product still says "Bookdeck" until the deferred EzzyBook rename. Notification `title`/`body` carry vendor/booking names, not the platform brand, so they're unaffected. When the rename sweep happens, confirm whether email should become "EzzyBook".

## Future enhancements (recorded, not in scope)
- **Bounce & complaint handling** — subscribe to Resend's `bounced`/`complained` webhooks; stop re-sending to hard-bounced addresses to protect domain reputation. (Pairs with the stored `provider_message_id`.)
- **Surface failures to Command** — `notification_emails.status = 'failed'` rows are invisible today; add a failure count/list to the settings page (needs the optional command-admin SELECT policy noted on S2) to close the loop.
- **Deliverability niceties** — send from a subdomain (already in the `From` example), set a `Reply-To` (e.g. support), and add a `List-Unsubscribe` header even though per-user opt-out is deferred.
- **Retry sweep** — a cron/`pgmq` job to retry `failed`/missing sends, addressing the dispatch-gap risk above.

---

## Appendix A — Supabase Auth SMTP (now in scope — see the password-recovery section)
Password recovery via Resend SMTP was promoted from optional into this plan — see "Supabase Auth emails — password recovery" and D-6. Enabling `[auth.email.smtp]` also routes any *other* GoTrue mail (email-change, invite) through Resend, but those flows aren't being built here.

---

## Appendix B — Future "live updates" — how this design accommodates it (reference only, not scope)

> Forward-looking note captured for reasoning, **not** a commitment. A different approach may be chosen when this is actually tackled — this only records why the email design does not box that future in.

**What already exists (so half of "live updates" is done):**
- `public.notifications` is the only table in the `supabase_realtime` publication (`20260525000002_notifications.sql:73`).
- All three apps already subscribe to it on INSERT, keyed by `user_id`, in `…/AppShell/useAppShell.ts` (booker, vendor, command). In-app notification live-updates are live today.
- Booking-status live updates are **not** yet wired — `bookings` is not in the publication. That would be net-new (a one-line `alter publication … add table public.bookings` + a subscription) and is **orthogonal** to email.

**Why email doesn't constrain it — email and Realtime are independent consumers of the same INSERT:**
- Realtime reads the WAL (logical replication); it uses no triggers.
- Email is an `AFTER INSERT` trigger → Edge Function.
- Neither blocks or alters the other. One status change already fans out to a live in-app notification (today) **and** an email (this plan) from the same row, with no coordination.

**Three properties that make this a clean foundation for more delivery channels later:**
1. **Table-level chokepoint + per-recipient fan-out** is exactly the shape a multi-channel "deliver this event to the user" system wants. Adding push/SMS later = add **another consumer** off the same `notifications` insert; email and in-app are untouched (open/closed).
2. **INSERT-only scoping is deliberate.** Email fires on `INSERT`, never `UPDATE`. So future in-place live mutations of a notification row (mark-read, archive, live content edits) will **not** trigger spurious emails — that boundary is already correct.
3. **Booking-status live updates compose**, not collide: status change → existing trigger → `notifications` insert → live update (today) + email (this plan). A future direct Realtime subscription on `bookings` is simply an additional parallel signal.

**Scaling path (only if volume grows — not now):** if many synchronous delivery channels eventually hang off one trigger, evolve to a queue (e.g. `pgmq`) or a single dispatcher fanning out to channels, rather than N triggers. `pg_net` is already async/queued, so this is a later concern, noted only so the direction is on record.

**Deliberately not built now:** no multi-channel abstraction is introduced in this plan (that would be speculative generality, against "Simplicity First"). The structure simply extends cleanly when the live-updates feature is specced.
