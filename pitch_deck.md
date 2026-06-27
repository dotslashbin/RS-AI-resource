# EzzyBook — Pitch Deck Content

> **How to use this document:** This is a structured, slide-by-slide content brief for building a EzzyBook pitch deck. Each `##` heading is a slide; bullets are the talking points. It focuses on the *purpose and product*, not technical architecture. Items marked **[FILL IN]** need real numbers, names, or decisions from you (the deck tool can't invent these honestly). Everything else reflects what EzzyBook actually is and does today.

---

## Slide 1 — Title

**EzzyBook**
*The booking platform for any service, any vendor, one checkout.*

- A general booking marketplace connecting service vendors with customers.
- Launching in the Philippines. Built to work for any bookable vertical.
- [FILL IN: tagline preference, logo, presenter name/role, date]

---

## Slide 2 — The Problem

Booking a service in most markets is still broken on both sides:

- **For customers:** discovering vendors, checking real availability, submitting requirements, and paying usually happens across phone calls, chat threads, paper forms, and manual bank transfers. No single trusted place to book.
- **For vendors:** small and mid-size service operators (rentals, coaching, studios, clinics, classes) run scheduling on notebooks, spreadsheets, and messaging apps. They lose bookings to no-shows, double-bookings, and payment friction.
- **For the market:** existing tools are either vertical-locked (only gyms, only salons) or are generic calendars that don't handle requirements, approvals, payments, and multi-staff scheduling together.

**The gap:** there's no flexible, vertical-agnostic platform that handles the *whole* booking lifecycle — discovery → requirements → scheduling → payment → confirmation — for everyday service businesses.

---

## Slide 3 — The Solution

**EzzyBook is a multi-sided booking marketplace.**

Vendors list bookable offerings (facility rentals, coaching sessions, classes, appointments — any vertical). Customers discover, reserve, and pay online in a single guided flow. A dedicated internal team approves vendors and keeps the platform trustworthy.

Three purpose-built portals, one shared backbone:

- **Booker** — where customers book.
- **Vendor** — where businesses manage their offerings, schedules, staff, and bookings.
- **Command** — where the EzzyBook team approves vendors and oversees the platform.

One identity, one payment rail, one source of truth — but each side gets an experience designed for how *they* actually work.

---

## Slide 4 — How It Works (the customer journey)

A guided **6-step booking wizard** takes a customer from intent to paid in one flow:

1. **Choose an offering** — browse what a vendor provides.
2. **Choose a vendor** — pick who delivers it.
3. **Pick a schedule slot** — real availability, recurring or one-time.
4. **Provide details** — booking specifics.
5. **Upload requirements** — any documents the offering needs (e.g. ID, waiver, membership proof).
6. **Pay & confirm** — secure hosted checkout, booking confirmed.

Behind the scenes the booking is recorded, the vendor is notified in real time, and the customer can track status and history.

---

## Slide 5 — The Product: Three Portals

### 🧑‍💻 EzzyBook Booker (customers)
The customer-facing booking app — discover offerings, book in the 6-step wizard, pay online, upload documents, and track booking history and results.

### 🏢 EzzyBook Vendor (businesses)
The operator dashboard — define offerings, build recurring/one-time schedules, manage staff, set requirements, and review and action incoming bookings.

### 🛡️ EzzyBook Command (internal team)
The trust-and-safety + operations console — approve new vendors, manage user and portal access, control platform-wide settings, and monitor activity. The only side with authority to change vendor and user status.

*Why three apps: each audience has a fundamentally different workflow, and keeping them separate gives security isolation and independent release cadence — important when an internal tool and a consumer app evolve at different speeds.*

---

## Slide 6 — Key Features (Available Today)

**Customer (Booker)**
- Full 6-step booking wizard, live and working end-to-end.
- Online payments via hosted checkout — Card, GCash, GrabPay, Maya, BillEase, QRPh (PayMongo).
- Document upload for offering requirements.
- Booking history + completed-booking results view.
- Real-time in-app notifications (booking confirmed/rejected/cancelled).

**Vendor**
- Self-registration and vendor onboarding (pending Command approval).
- Offerings management (create/edit, pricing, duration, requirements).
- Schedule management — recurring and one-time slots with capacity limits.
- Staff management and per-offering specialties.
- Incoming bookings with approve/reject; automatic overbooking protection.
- Real-time notifications when a new booking arrives.

**Command (internal)**
- Vendor approval workflow (with optional accreditation/license review).
- User and portal-access management (create/edit/activate/suspend).
- Platform-wide notification controls.
- Real-time operational notifications and activity oversight.

**Platform-wide**
- Secure authentication and database-level access control (each side sees only what it should).
- Real-time notification delivery across all three portals.
- Vertical-agnostic: categories and offering types are vendor-defined free text — no fixed catalogue.

---

## Slide 7 — On the Roadmap (What We Want Next)

- **In-app wallet** — stored balance, credits, and pay-from-wallet (currently UI only).
- **Map-based discovery** — find vendors near you on the booker map.
- **Vendor packages & bundles** — sell grouped offerings.
- **Calendar view** for vendors (visual schedule management).
- **Reviews & ratings** — booker reviews of vendors post-booking, building marketplace trust.
- **Vendor profile galleries** — photos and richer storefronts.
- **Transactional email** — confirmations, reminders, receipts.
- **Live financial reporting** in Command (real transaction and revenue dashboards).
- **Booking lifecycle depth** — completion, refunds, rescheduling.

---

## Slide 8 — Why Now / Market

- **Digitization of SMB services** is accelerating, especially in Southeast Asia, with mobile-first customers expecting to book and pay online.
- **Local payment rails matured.** Wallets (GCash, Maya) and QRPh make online payment normal for everyday transactions — EzzyBook rides this.
- **Vertical-locked tools leave a gap.** Most booking software targets one niche; everyday service businesses across many verticals are underserved by a flexible platform.
- **Philippines first, model exportable.** Launching in PH where the payment and SMB-digitization tailwinds are strong, with a product that isn't tied to any single vertical or country.
- [FILL IN: target vertical(s) for launch]

---

## Slide 9 — Why EzzyBook Wins (Differentiators)

- **Vertical-agnostic by design.** Offerings, codes, and categories are vendor-defined — the same platform serves a court rental, a coaching studio, and a clinic without rebuilding.
- **Whole-lifecycle, not just a calendar.** Requirements, document upload, multi-staff scheduling, approvals, payment, and notifications are integrated — not bolted on.
- **Trust built in.** A dedicated approval/oversight layer (Command) vets vendors before they transact — important for a marketplace where customers pay upfront.
- **Real payments, real money, day one.** Hosted checkout with all major local methods is already live, not a "coming soon."
- **Purpose-built sides.** Customers get a fast mobile booking flow; vendors get a dense operations dashboard; the team gets controls — instead of one compromised UI for everyone.

---

## Slide 10 — Monetization

**EzzyBook earns a commission on every booking made through the platform.**

- A percentage is taken from each booking — captured automatically at the point of payment, since EzzyBook already processes payments end-to-end.
- Aligned incentives: EzzyBook only earns when a vendor gets a booking.
- Free to list — vendors join at no upfront cost and pay only per successful booking.

*(Commission rate and other commercial details are intentionally left out of this product-focused deck.)*

---

## Slide 11 — Traction / Current Status

- **Working MVP across all three portals**, built on production-grade foundations (Next.js, Supabase, Vercel).
- **Live, end-to-end paid bookings** — the core loop (discover → book → pay → confirm → notify) functions today.
- **Vendor onboarding and admin approval** flows are operational.
- **Real-time notifications** across customer, vendor, and internal sides.
- [FILL IN: pilot vendors signed, bookings processed, waitlist sign-ups, design-partner names]

---

## Slide 12 — Vision

Start as the booking layer for service vendors in the Philippines; become the default way any service business gets booked and paid — across verticals and across markets. Every offering bookable, every requirement handled, every payment settled, in one trusted place.

---

## Slide 13 — The Team

- [FILL IN: founders, roles, relevant background, advisors]

---

## Appendix — Fast Facts (for Q&A)

- **What it is:** vertical-agnostic booking marketplace, three portals (Booker / Vendor / Command), shared backend.
- **Payments:** PayMongo hosted checkout — Card, GCash, GrabPay, Maya, BillEase, QRPh. Currency ₱ (PHP).
- **Booking flow:** 6-step wizard (offering → vendor → slot → details → requirements → pay).
- **Trust model:** vendors are approved by an internal team before they can transact.
- **Monetization:** commission on every booking; free for vendors to list.
- **Stack (one line):** Next.js + Supabase + Vercel; secure by database-level access control; real-time notifications.
- **Market:** launching Philippines, model built to be vertical- and country-agnostic.
- **Stage:** working MVP with live paid bookings.

---

*Notes for whoever generates the deck: keep slides visual and sparse — one idea per slide, the bullets above are speaker content, not on-slide text. Replace every **[FILL IN]** before presenting. Don't invent metrics, market sizes, or traction numbers; leave them blank if unknown.*
