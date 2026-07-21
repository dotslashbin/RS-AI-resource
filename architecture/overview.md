# Platform Overview

## What This Is

"Bookdeck" (the working name used throughout these docs) is a multi-portal web platform — a general booking marketplace. It connects three distinct user groups — vendor operators, bookers, and the Bookdeck internal team — through three independent portals that share a single Supabase backend.

The platform's core purpose is to let vendors sell bookable offerings (facility rentals, coaching sessions, classes, appointments — any vertical) and let bookers discover and reserve them online. Vendors manage their offerings, schedules, and staff through their own portal; and the Bookdeck team controls platform access and vendor approval through an internal admin portal.

> **Note on the brand name.** The display/brand name is configured at deploy time, not hardcoded. Each app exports `APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "<placeholder>"` and `APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "<placeholder>"` from its `lib/constants.ts` (the fallbacks are per-app placeholders). `NEXT_PUBLIC_APP_NAME` sets the product name shown across the UI and `NEXT_PUBLIC_APP_DOMAIN` the domain shown on the login screen. The code contains no hardcoded brand string. "Bookdeck" is a working placeholder used throughout these docs. The DB portal identifiers `booker` / `vendor` / `command` are real and unaffected.

---

## The Three Portals

### Bookdeck Booker (`./booker`)
**Audience:** Vendor bookers  
**Purpose:** Book offerings, track booking history, upload required documents  
**Domain:** `booker` portal in Supabase

A customer-facing booking application. Bookers browse available offerings from active vendors, select a vendor, pick a schedule slot, upload requirement documents, confirm a booking, and pay — all in a guided 6-step wizard. Step 6 creates a PayMongo Checkout Session and redirects the booker to a hosted payment page (Card, GCash, GrabPay, Maya, BillEase, QRPh). The portal also shows their booking history and status.

### Vendor Portal (`./vendor`)
**Audience:** Vendor administrators (vendor-admin role)  
**Purpose:** Manage the vendor's offerings, schedules, staff, and incoming bookings  
**Domain:** `vendor` portal in Supabase

An operations dashboard for vendors. Each vendor's admin can define what services they offer, set up recurring or one-time schedule slots, manage their staff, and (future) review and action incoming bookings from bookers.

### Bookdeck Command (`./command`)
**Audience:** Bookdeck internal operations team (admin / root roles)  
**Purpose:** Platform-wide user management, vendor approval, operational oversight  
**Domain:** `command` portal in Supabase

An internal ops portal. Command staff approve new vendors (verifying accreditation where applicable), grant or revoke portal access for users, and monitor platform-wide activity. It is the only portal with the authority to change user and vendor status.

---

## Why Three Separate Apps

The three portals are independent Next.js applications — not a monorepo, not micro-frontends, not a single app with route-based access control. This was a deliberate early decision:

- **Security isolation.** Each app can only access the data its users are authorised to see, enforced at the DB layer via RLS. There is no shared session or cookie between portals.
- **Deployment independence.** Each portal can be deployed, updated, or taken down without affecting the others. This is particularly important for Command, which is an internal tool that may have different release cadence.
- **UI divergence.** The three audiences have very different workflows. A booker portal optimised for mobile-first booking and an admin portal optimised for dense data tables should not share a component tree.
- **Simplicity now.** The tradeoff is duplicated utility code. This is acceptable at the current scale. A shared package or monorepo can be introduced later if the duplication cost becomes significant.

---

## Shared Backend

All three portals connect to the same Supabase project. There is no inter-app API — all communication goes through Supabase (PostgreSQL + RLS). Key shared resources:

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
| No shared code between the three apps | Until a monorepo decision is made, copy intentionally rather than import across app boundaries |

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
| Realtime | Supabase Realtime | Used for in-app notification delivery |
| Email | Resend (integrated) | Two independent paths: (1) app notification emails — one row in `notifications` sends one email via a single `send-notification-email` Edge Function that calls the Resend **API**; (2) auth emails (password recovery) via Resend **SMTP** for Supabase Auth. Local dev uses Supabase's built-in mailer (Mailpit). |
| Hosting | Vercel | All three portals |
| PWA | Web App Manifest + hand-rolled service worker (offline-fallback page only — no app-shell or data caching) + a dismissible "Install App" banner (real one-tap install on Android/Chromium via `beforeinstallprompt`; instructions-only on iOS Safari, since no equivalent API exists there) | **Booker and vendor** (2026-07). Command not planned (desktop admin tool). See `.plans/2026-07-18-booker-vendor-pwa-readiness.md` |

---

## Current State (July 2026)

| Portal | Status |
|--------|--------|
| Bookdeck Booker (booker) | Core booking wizard fully functional and Supabase-wired (Steps 1–6). PayMongo Checkout Sessions integrated — booking creates a payment session and redirects the booker to PayMongo's hosted page; webhook sets `is_paid` on return. Dashboard shows booking history fetched from DB. "My Results" section shows completed bookings as individual cards. In-app notifications live (bell icon, panel, Realtime delivery). Transactions page wired to real bookings (Total Spent / Bookings / Pending summary + payment history). Installable as a PWA (manifest, icons, offline fallback, install banner); the standalone-mode PayMongo checkout round-trip is not yet live-tested on real devices (see `.plans/2026-07-18-booker-vendor-pwa-readiness.md`). |
| Vendor Portal (vendor) | Offerings, schedules, staff, profile, and bookings management (approve/reject) are Supabase-wired. In-app notifications live. Vendor onboarding runs a required **KYC stage** (applicant type → documents → ID + selfie capture) with a private Storage bucket and Command review — no account is created until KYC is submitted (see `vendor-kyc.md`). Installable as a PWA (manifest, icons, offline fallback, install banner). Wallet, packages, and calendar are still mock. |
| Bookdeck Command (command) | Users and vendors fully Supabase-wired (create/edit/delete). In-app notifications live with platform-wide Notification Type Settings admin page. Transactions and most KPI widgets are still seeded. |

Platform-wide since June 2026: every in-app notification also sends one email via Resend (centralized in the `send-notification-email` Edge Function — no Resend code in any app), gated by a per-portal email kill-switch in `notification_email_settings`. Password recovery is implemented end-to-end in all three portals (reset request + set-new-password), with auth emails delivered via Resend SMTP when hosted and Mailpit locally.

---

## What This Platform Is Not (Scope Limits)

To avoid scope creep, the following are explicitly out of scope for the current phase:

- **External accreditation/registry integration.** There is no API link to any external licensing/registry system. Accreditation verification, where relevant, is manual (Command admin reviews the `accreditation_no`).
- **Real-time communication.** There is no chat, messaging, push, or SMS system. In-app notifications (bell icon, persistent DB-backed alerts via Supabase Realtime) are implemented as a distinct, narrower feature — not a messaging system. Every in-app notification now also sends one email (via Resend, through the `send-notification-email` Edge Function), and password-recovery uses Resend SMTP — but these are notification/auth emails, not a chat or messaging channel. Push and SMS remain out of scope.
- **Multi-tenancy beyond vendors.** There is no concept of regions, franchises, or vendor groups beyond the individual vendor record.
- **Mobile app.** All three portals are web applications, optimised for mobile browsers. Booker and vendor are now installable to a home screen as PWAs (standalone display, offline fallback), but this is not a native app — no App Store/Play Store distribution, no push notifications. A separate native-mobile track (Expo, targeting booker) is under consideration but not started.
