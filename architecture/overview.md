# Platform Overview

## What This Is

"Ezzy" is a multi-portal platform — a general booking marketplace. It connects three distinct user groups — vendor operators, bookers, and the Ezzy internal team — through three independent web portals that share a single Supabase backend.

Since July 2026 there is a fourth kind of thing in the workspace: **native mobile clients** (Expo/React Native). These are *not* portals. They are additional clients onto the same backend and the same RLS boundaries — `ezzy-vendor-mobile` is a companion to the vendor portal, not a replacement for it. See "The Mobile Clients" below and `portals.md`.

The platform's core purpose is to let vendors sell bookable offerings (facility rentals, coaching sessions, classes, appointments — any vertical) and let bookers discover and reserve them online. Vendors manage their offerings, schedules, and staff through their own portal; and the Ezzy team controls platform access and vendor approval through an internal admin portal.

> **Note on the brand name.** The real brand is **Ezzy**. `command` and `vendor` render it live via `NEXT_PUBLIC_APP_NAME`/`NEXT_PUBLIC_APP_DOMAIN` env vars, re-exported as `APP_NAME`/`APP_DOMAIN` from each app's `lib/constants.ts`. **`booker` is not yet rebranded in code** — its `.env.local` sets the Ezzy values, but nothing in `booker`'s source reads them; the UI still hardcodes "Bookdeck" throughout (login page, not-found page, payment description, dashboard guide panel). This gap is tracked in `.plans/2026-07-14-app-name-env-var.md` (booker's swap plus `backbone/supabase/seed.sql`'s `@bookdeck.com` seed emails are the pieces still outstanding). These docs say "Ezzy" to match the intended/shipped brand — treat "Bookdeck" as stale wherever you see it in booker's own source, not as the doc being wrong. The DB portal identifiers `booker` / `vendor` / `command` are real and unaffected either way.

---

## The Three Portals

### Ezzy Booker (`./booker`)
**Audience:** Vendor bookers  
**Purpose:** Book offerings, track booking history, upload required documents  
**Domain:** `booker` portal in Supabase

A customer-facing booking application. Bookers browse available offerings from active vendors, select a vendor, pick a schedule slot, upload requirement documents, confirm a booking, and pay — all in a guided 6-step wizard. Step 6 creates a PayMongo Checkout Session and redirects the booker to a hosted payment page (Card, GCash, GrabPay, Maya, BillEase, QRPh). The portal also shows their booking history and status.

### Vendor Portal (`./vendor`)
**Audience:** Vendor administrators (vendor-admin role)  
**Purpose:** Manage the vendor's offerings, schedules, staff, and incoming bookings  
**Domain:** `vendor` portal in Supabase

An operations dashboard for vendors. Each vendor's admin can define what services they offer, set up recurring or one-time schedule slots, manage their staff, and (future) review and action incoming bookings from bookers.

### Ezzy Command (`./command`)
**Audience:** Ezzy internal operations team (admin / root roles)  
**Purpose:** Platform-wide user management, vendor approval, operational oversight  
**Domain:** `command` portal in Supabase

An internal ops portal. Command staff approve new vendors (verifying accreditation where applicable), grant or revoke portal access for users, and monitor platform-wide activity. It is the only portal with the authority to change user and vendor status.

---

## The Mobile Clients

Two Expo/React Native apps sit alongside the portals. They share the Supabase project, the schema, and every RLS policy — **a mobile app is a new client, never a new backend.**

### Ezzy Vendor Mobile (`./ezzy-vendor-mobile`)
**Audience:** the same vendor administrators who use the vendor portal
**Purpose:** approve bookings and check the day's position from a phone
**Portal identity:** `vendor` (the same `user_portals` row — there is no separate mobile grant)

A deliberately narrow companion, not a port. It covers the jobs that are urgent and time-sensitive — approving or rejecting an incoming booking, seeing today's numbers, reading notifications — and leaves offerings, schedules, staff and printing on the web, where they belong. A vendor who only ever used the phone would still need the portal.

### Ezzy Booker Mobile (`./ezzy-booker-mobile`)
Scaffold only — no app code. Its buildout plan (`.plans/2026-07-21-ezzy-booker-mobile-buildout.md`) predates the vendor app and still carries decisions the vendor app later resolved differently (notably NativeWind vs `StyleSheet`, and AsyncStorage vs SecureStore for the session). Treat the vendor app as the reference implementation and revisit that plan's decisions before starting.

### Why the mobile apps are separate repos too

The same reasoning as the portals, plus one more: an Expo app's toolchain (Metro, EAS, native build config) has nothing in common with Next.js, and mixing them creates dependency conflicts with no upside. Types and service logic are **copied and adapted** across the boundary, exactly as they are between the three portals — never imported.

---

## Why the Portals Are Separate Apps

The three portals are independent Next.js applications — not a monorepo, not micro-frontends, not a single app with route-based access control. This was a deliberate early decision:

- **Security isolation.** Each app can only access the data its users are authorised to see, enforced at the DB layer via RLS. There is no shared session or cookie between portals.
- **Deployment independence.** Each portal can be deployed, updated, or taken down without affecting the others. This is particularly important for Command, which is an internal tool that may have different release cadence.
- **UI divergence.** The three audiences have very different workflows. A booker portal optimised for mobile-first booking and an admin portal optimised for dense data tables should not share a component tree.
- **Simplicity now.** The tradeoff is duplicated utility code. This is acceptable at the current scale. A shared package or monorepo can be introduced later if the duplication cost becomes significant.

---

## Shared Backend

All three portals **and the mobile clients** connect to the same Supabase project. There is no inter-app API — all communication goes through Supabase (PostgreSQL + RLS). Key shared resources:

- **Database:** All tables, RLS policies, and helper functions are defined in `./backbone/supabase/migrations/`
- **Auth:** Supabase Auth is the only authentication mechanism across all portals. Each user has one auth identity; access to a specific portal is determined by their `user_portals` rows, not by which app they open
- **Storage:** Supabase Storage — the private `vendor-kyc` bucket is live (vendor KYC/verification documents, see `vendor-kyc.md`); booking-document uploads are not yet wired (still in-memory in the booker UI)

---

## Regional / Domain Context

The platform launches in the Philippine market but is vertical-agnostic. Notes:

- **Accreditation:** optional. Vendors may record an accreditation/license number (`accreditation_no`, nullable) if their vertical has one; many (e.g. facility rentals) won't. Command approves vendors after review.
- **Offering codes & categories:** each offering has a short vendor-defined `code` (badge, ≤6 chars) and a free-text `category` (e.g. "Rental", "Coaching", "Class"). There is no fixed category set — categories are whatever vendors type, surfaced dynamically in filters.
- **Currency:** Philippine Peso (₱). All prices are stored as `numeric(10,2)`.
- **Phone format:** `+63 9XX XXX XXXX`
- **Locale:** `en-PH` is used for date formatting.

---

## Core Constraints (Non-Negotiable)

These are architectural invariants that must not be violated regardless of how features evolve:

| Constraint | Reason |
|-----------|--------|
| RLS enabled on every table, no exceptions | All data isolation is enforced at the DB layer — app-layer filtering is not sufficient |
| No custom authentication — Supabase Auth only | Rolling custom auth introduces security surface area and maintenance burden |
| No `SUPABASE_SERVICE_ROLE_KEY` in client-side code or `NEXT_PUBLIC_` vars | Service role bypasses all RLS — exposing it to the client breaks the entire security model |
| Schema changes via migration files only | Mutations to a shared DB without a migration leave other portals in an unknown state |
| Update the hand-written TypeScript interfaces after a schema change | This repo does **not** use `supabase gen types` — types are hand-authored per service (e.g. `NotificationTypeSetting`). Stale interfaces cause silent runtime errors TypeScript can't catch |
| No shared code between apps — including the mobile ones | Until a monorepo decision is made, copy intentionally rather than import across app boundaries |
| `SUPABASE_SERVICE_ROLE_KEY` never reaches a mobile binary under any prefix | Anything under `EXPO_PUBLIC_` is readable by anyone who unpacks the app. Service-role work stays behind a web app's Route Handler, called over HTTPS |

---

## Tech Stack Summary

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 16 (App Router) | All three portals |
| Language | TypeScript 5.7 (strict) | All three portals |
| Styling | Tailwind CSS 3.4 + shadcn/ui (base-nova) | All three portals |
| Theming | next-themes (light/dark via `class`) | All three portals |
| Icons | lucide-react | All three portals |
| Notifications | sonner | All three portals |
| Maps | Leaflet (client-side, dynamic import) | Booker portal only |
| Database | Supabase (PostgreSQL) | Shared |
| Auth | Supabase Auth | Shared |
| Storage | Supabase Storage | Shared. Live for vendor KYC (private `vendor-kyc` bucket); booking-document uploads not yet wired |
| Realtime | Supabase Realtime | In-app notification delivery (all three portals) + live booking updates (booker: own booking status changes; vendor: incoming bookings + status/payment changes). `bookings` and `notifications` are the two tables published for Realtime |
| Email | Resend (integrated) | Two independent paths: (1) app notification emails — one row in `notifications` sends one email via a single `send-notification-email` Edge Function that calls the Resend **API**; (2) auth emails (password recovery) via Resend **SMTP** for Supabase Auth. Local dev uses Supabase's built-in mailer (Mailpit). |
| Hosting | Vercel | All three portals |
| PWA | Web App Manifest + hand-rolled service worker (offline-fallback page only — no app-shell or data caching) + a dismissible "Install App" banner (real one-tap install on Android/Chromium via `beforeinstallprompt`; instructions-only on iOS Safari, since no equivalent API exists there) | **Booker and vendor** (2026-07). Command not planned (desktop admin tool). See `.plans/2026-07-18-booker-vendor-pwa-readiness.md` |

### Mobile stack (the Expo apps only)

None of the web stack above applies to the mobile clients. There is no Next.js, no `@supabase/ssr`, no Tailwind, no shadcn/ui, no next-themes.

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Expo SDK 57 + React Native 0.86 | React 19.2.3 |
| Routing | `expo-router` (file-based, under `src/app/`) | On `standard-navigation`. `@react-navigation/*` is **forbidden** — removed from the SDK at 56 |
| Language | TypeScript (strict), `@/*` → that app's `./src/*` | Each app has its own `tsconfig.json` and `node_modules` |
| Styling | `StyleSheet.create` via a co-located `Name.styles.ts` | **No NativeWind.** Tokens are hand-ported from the web app's `--sp-*` CSS variables into `theme/tokens.ts` |
| Theming | Custom `AppThemeProvider` — OS scheme + a persisted override | next-themes has no RN equivalent |
| Server state | TanStack Query + `AppState` focus manager | Bounded AsyncStorage cache persistence for a useful cold offline open |
| Session storage | `expo-secure-store` behind a **chunking adapter** | The OS keystore caps values near 2 KB on iOS; a Supabase session exceeds it |
| Icons | `lucide-react-native` | Same icon set as the web, different package |
| Lists | `@shopify/flash-list` | |
| Auth flow | `flowType: "pkce"` | Deliberately diverges from the web portals' implicit flow — a mobile client cannot hold a secret |
| Push | `expo-notifications` + Expo Push API | Needs a **development or production build and a physical device** — removed from Expo Go at SDK 53. See `schema.md`'s `device_push_tokens` |
| Build / distribution | EAS Build | See `ezzy-vendor-mobile/EAS-SETUP.md` |
| Tests | `node --test` with `--experimental-strip-types` | No test framework dependency. Pure logic is extracted into importable modules so tests never load the RN runtime |

---

## Current State (July 2026)

| Portal | Status |
|--------|--------|
| Ezzy Booker (booker) | Core booking wizard fully functional and Supabase-wired (Steps 1–6). PayMongo Checkout Sessions integrated — booking creates a payment session and redirects the booker to PayMongo's hosted page; webhook sets `is_paid` on return. Dashboard shows booking history fetched from DB, with **booking status updating live** (Realtime, no refresh) when a vendor confirms/rejects/cancels. "My Results" section shows completed bookings as individual cards. In-app notifications live (bell icon, panel, Realtime delivery, arrival toast). Transactions page wired to real bookings (Total Spent / Bookings / Pending summary + payment history). Installable as a PWA (manifest, icons, offline fallback, install banner); the standalone-mode PayMongo checkout round-trip is not yet live-tested on real devices (see `.plans/2026-07-18-booker-vendor-pwa-readiness.md`). |
| Ezzy Vendor (vendor) | Offerings, schedules, staff, profile, and bookings management (approve/reject) are Supabase-wired, with **incoming bookings and status/payment changes appearing live** (Realtime, no refresh). In-app notifications live (arrival toast). Vendor onboarding runs a required **KYC stage** (applicant type → documents → ID + selfie capture) with a private Storage bucket and Command review — no account is created until KYC is submitted (see `vendor-kyc.md`). Installable as a PWA (manifest, icons, offline fallback, install banner). Wallet, packages, and calendar are still mock. |
| Ezzy Vendor Mobile (ezzy-vendor-mobile) | **Ph0–Ph6 code complete** (2026-07-28): sign-in, password recovery via deep link, session persistence in the OS keystore, vendor access gate + multi-vendor picker, blocked states, tab shell with theme override, dashboard stats, **bookings list + approve/reject with a deferred-commit undo**, transactions summary + search, in-app notifications with Realtime and an unread badge. **First successful run on a real Android device 2026-07-28** via an EAS preview build against hosted Supabase — bugs found in that session are outstanding. Push (Ph7) is client- and schema-complete but has no FCM credentials, so it is untested. Store submission (Ph8) is blocked on brand assets, a privacy policy and a Play account decision. **Nothing has ever run on iOS.** See `.plans/2026-07-27-ezzy-vendor-mobile-companion.md` |
| Ezzy Booker Mobile (ezzy-booker-mobile) | Scaffold only — no app code |
| Ezzy Command (command) | Users and vendors fully Supabase-wired (create/edit/delete), with a **manual refresh button** on each table to pull in changes made elsewhere (e.g. a new registration) without a page reload. In-app notifications live (arrival toast) with platform-wide Notification Type Settings admin page. Transactions and most KPI widgets are still seeded. |

Platform-wide since June 2026: every in-app notification also sends one email via Resend (centralized in the `send-notification-email` Edge Function — no Resend code in any app), gated by a per-portal email kill-switch in `notification_email_settings`. Password recovery is implemented end-to-end in all three portals (reset request + set-new-password), with auth emails delivered via Resend SMTP when hosted and Mailpit locally.

---

## What This Platform Is Not (Scope Limits)

To avoid scope creep, the following are explicitly out of scope for the current phase:

- **External accreditation/registry integration.** There is no API link to any external licensing/registry system. Accreditation verification, where relevant, is manual (Command admin reviews the `accreditation_no`).
- **Real-time communication.** There is no chat or messaging system, and no SMS. In-app notifications (bell icon, persistent DB-backed alerts via Supabase Realtime) are implemented as a distinct, narrower feature — not a messaging system. Every in-app notification also sends one email (via Resend, through the `send-notification-email` Edge Function), and password recovery uses Resend SMTP — but these are notification/auth emails, not a chat channel. **Mobile push is no longer out of scope** as of 2026-07: `device_push_tokens`, `notification_push_settings` and a `send-push-notification` Edge Function exist, dispatched from the same `notifications` insert that sends the email. It is *infrastructure-complete but unproven* — no FCM/APNs credentials are configured and no push has been delivered end to end. Push reaches the mobile clients only; the web portals have no push. SMS remains out of scope entirely.
- **Multi-tenancy beyond vendors.** There is no concept of regions or franchises beyond the individual vendor record. As of 2026-07, vendors *are* grouped by **division** — a fixed, Command-managed taxonomy of Ezzy business verticals (EzzyDrive, EzzyCare, EzzyWell, etc.) that every vendor is associated with exactly one of, picked at self-registration or set by Command. See `schema.md`'s `divisions` table. This is a flat one-to-many grouping (no hierarchy, no per-branch sub-grouping) — not a broader multi-tenancy model.
- **A native app replacing the portals.** The mobile track is a *companion* track, not a migration. `ezzy-vendor-mobile` covers the urgent, time-sensitive vendor jobs (approve a booking, check today's numbers, read notifications) and deliberately omits offerings, schedules, staff management and printing — those stay on the web. No portal is being retired, and feature parity is an explicit non-goal. `ezzy-booker-mobile` remains a scaffold.
- **Shipping to the stores.** Neither mobile app has been submitted to the App Store or Google Play. Distribution today is EAS internal builds only. iOS has never been built or run — it needs an Apple Developer Program membership the project does not hold. See `ezzy-vendor-mobile/STORE-SUBMISSION.md`.
