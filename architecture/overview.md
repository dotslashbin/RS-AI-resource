# Platform Overview

## What This Is

RS (Road Safety) is a multi-portal web platform for the Philippine LTO (Land Transportation Office) driving school ecosystem. It connects three distinct user groups — driving school operators, learners, and the RS internal team — through three independent portals that share a single Supabase backend.

The platform's core purpose is to replace paper-based and informal booking processes at LTO-accredited driving schools. Learners book driving courses (TDC, PDC, MDC, and others) online; schools manage their offerings, schedules, and instructors through their own portal; and the RS team controls platform access and academy approval through an internal admin portal.

---

## The Three Portals

### RS Learner (`./learner`)
**Audience:** Driving school learners  
**Purpose:** Book driving courses, track booking history, upload required documents  
**Domain:** `learner` portal in Supabase

A student-facing booking application. Learners browse available service offerings from accredited academies, select a school, pick a schedule slot, upload requirement documents, and confirm a booking — all in a guided 5-step wizard. The portal also shows their booking history and status.

### School Portal (`./academy`)
**Audience:** Driving school administrators (academy-admin role)  
**Purpose:** Manage the school's offerings, schedules, instructors, and incoming bookings  
**Domain:** `academy` portal in Supabase

An operations dashboard for driving schools. Each academy's admin can define what services they offer, set up recurring or one-time schedule slots, manage their instructors, and (future) review and action incoming bookings from learners.

### RS Command (`./command`)
**Audience:** RS internal operations team (admin / root roles)  
**Purpose:** Platform-wide user management, academy approval, operational oversight  
**Domain:** `command` portal in Supabase

An internal ops portal. Command staff approve new academies (verifying LTO accreditation), grant or revoke portal access for users, and monitor platform-wide activity. It is the only portal with the authority to change user and academy status.

---

## Why Three Separate Apps

The three portals are independent Next.js applications — not a monorepo, not micro-frontends, not a single app with route-based access control. This was a deliberate early decision:

- **Security isolation.** Each app can only access the data its users are authorised to see, enforced at the DB layer via RLS. There is no shared session or cookie between portals.
- **Deployment independence.** Each portal can be deployed, updated, or taken down without affecting the others. This is particularly important for Command, which is an internal tool that may have different release cadence.
- **UI divergence.** The three audiences have very different workflows. A learner portal optimised for mobile-first booking and an admin portal optimised for dense data tables should not share a component tree.
- **Simplicity now.** The tradeoff is duplicated utility code. This is acceptable at the current scale. A shared package or monorepo can be introduced later if the duplication cost becomes significant.

---

## Shared Backend

All three portals connect to the same Supabase project. There is no inter-app API — all communication goes through Supabase (PostgreSQL + RLS). Key shared resources:

- **Database:** All tables, RLS policies, and helper functions are defined in `./backbone/supabase/migrations/`
- **Auth:** Supabase Auth is the only authentication mechanism across all portals. Each user has one auth identity; access to a specific portal is determined by their `user_portals` rows, not by which app they open
- **Storage:** Supabase Storage (used for booking documents; bucket setup is a future task)

---

## Philippine Context

The platform is built for the Philippine LTO ecosystem. This shapes several decisions:

- **Accreditation:** Academies must hold a valid LTO accreditation number (`lto_accred_no`). Command approves academies after verifying this.
- **Offering codes:** TDC (Theoretical Driving Course), PDC (Practical Driving Course), MDC (Motorcycle Driving Course) are the canonical LTO-defined course types. The `code` field on offerings captures these. The platform is not limited to these three — `offering_categories` allows `exam`, `lesson`, and `other` types.
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
| Regenerate types after every schema change (`supabase gen types typescript`) | Stale types cause silent runtime errors that TypeScript cannot catch |
| No shared code between the three apps | Until a monorepo decision is made, copy intentionally rather than import across app boundaries |

---

## Tech Stack Summary

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 15 (App Router) | All three portals |
| Language | TypeScript 5.7 (strict) | All three portals |
| Styling | Tailwind CSS 3.4 + shadcn/ui (base-nova) | All three portals |
| Theming | next-themes (light/dark via `class`) | All three portals |
| Icons | lucide-react | All three portals |
| Notifications | sonner | All three portals |
| Maps | Leaflet (client-side, dynamic import) | Learner portal only |
| Database | Supabase (PostgreSQL) | Shared |
| Auth | Supabase Auth | Shared |
| Storage | Supabase Storage | Shared (not fully wired yet) |
| Realtime | Supabase Realtime | Available, not yet used |
| Hosting | Vercel | All three portals |

---

## Current State (May 2026)

| Portal | Status |
|--------|--------|
| RS Learner (learner) | Core booking wizard fully functional and Supabase-wired (Steps 1–5). Dashboard shows booking history fetched from DB. Wallet is UI-only. |
| School Portal (academy) | Offerings, schedules, instructors, profile, and bookings management (approve/reject) are Supabase-wired. Wallet, packages, and calendar are still mock. |
| RS Command (command) | Users and schools fully Supabase-wired (create/edit/delete). Transactions and most KPI widgets are still seeded. |

---

## What This Platform Is Not (Scope Limits)

To avoid scope creep, the following are explicitly out of scope for the current phase:

- **Payment processing.** The platform does not handle money. Pricing is informational; collection happens at the school. A wallet balance display exists in the learner portal as a UX placeholder — there is no payment gateway integration.
- **LTO system integration.** There is no direct API link to LTO's systems. Accreditation verification is manual (Command admin reviews the `lto_accred_no`).
- **Real-time communication.** There is no chat, messaging, or push notification system. Email and SMS are not sent from the platform.
- **Multi-tenancy beyond academies.** There is no concept of regions, franchises, or academy groups beyond the individual academy record.
- **Mobile app.** All three portals are web applications, optimised for mobile browsers but not packaged as native apps.
