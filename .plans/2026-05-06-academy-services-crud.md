# Academy — Services CRUD

**Date:** 2026-05-06  
**App:** `./academy`  
**Status:** Planning

---

## Problem

The academy has no way to manage what it actually offers. Bookings, schedules, and packages all reference service types (TDC, PDC, MDC, driving lessons) as hardcoded strings. There is no admin-owned catalog of what services the academy provides, at what price, for how long, or with what requirements.

---

## Naming Decision

**"Offerings"** — confirmed by user.

---

## What a Service Is

A Service is a single bookable offering the academy provides. It is the atomic unit that packages bundle and schedules are built around.

| Field | Type | Notes |
|---|---|---|
| `id` | number | local ID |
| `name` | string | e.g. "Theoretical Driving Certificate" |
| `code` | string | short label, e.g. "TDC" — shown as a badge |
| `category` | `"exam" \| "lesson" \| "other"` | used for filtering and colour coding |
| `description` | string | shown on the card |
| `price` | number | in PHP |
| `duration` | string | e.g. "2 hours", "90 minutes" |
| `requirements` | string[] | list of required documents, e.g. "Valid Gov ID" |
| `status` | `"active" \| "inactive"` | inactive services are still shown here, just flagged |
| `color` | string | accent hex for card display — auto-assigned by category if not set |

### Seed data (matches learner's exam types)

| Code | Name | Category | Price | Duration |
|---|---|---|---|---|
| TDC | Theoretical Driving Certificate | exam | ₱850 | 2 hours |
| PDC | Practical Driving Certificate | exam | ₱1,200 | 3 hours |
| MDC | Medical Driving Certificate | exam | ₱650 | 1 hour |
| BDL | Beginner Driving Lesson | lesson | ₱500 | 1 hour |

---

## Scope

### In scope
- Services CRUD page in `./academy/app/page.tsx`
- New sidebar nav item: **Services** (between Bookings and Schedule Maker)
- State is local (`useState`) — no Supabase yet, consistent with everything else in this prototype

### Out of scope
- Wiring services to bookings, schedules, or packages (separate task — those pages hardcode their types today, that's a known debt)
- Supabase schema for services
- Learner-side changes

---

## UI Design

### Sidebar nav item
- Icon: `Layers` (lucide) — represents a catalog of items
- Label: `Services`
- Position: after `Bookings`, before `Schedule Maker`

### Page layout
- Header row: "Services" title + "Add Service" button (primary style)
- Filter bar: search input + category filter tabs (All / Exams / Lessons / Other) + status toggle (Active only)
- Card grid: 2 columns on desktop, 1 on mobile

### Service card
```
┌─────────────────────────────────────────┐
│ [TDC] badge    [exam] tag    [active] ▸ │  ← status toggle inline
│                                         │
│ Theoretical Driving Certificate         │
│ Theory exam required by LTO for new     │
│ licence applicants.                     │
│                                         │
│ ₱850          2 hours                   │
│                                         │
│ Requirements: Valid Gov ID, 2x2 Photo,  │
│ Medical Certificate                     │
│                                 [Edit] [Delete] │
└─────────────────────────────────────────┘
```

### Add / Edit modal
Fields (in order):
1. Service Name (text)
2. Code / Short Label (text, max 6 chars — auto-uppercased)
3. Category (select: Exam / Lesson / Other)
4. Description (textarea)
5. Price — PHP (number)
6. Duration (text, e.g. "2 hours")
7. Requirements (dynamic list — add/remove text inputs)
8. Status (toggle: Active / Inactive)

### Delete
- Inline confirmation under the card (not a separate modal) — "Are you sure? This cannot be undone." with Cancel / Delete buttons. Same pattern as the school delete in `command`.

---

## Execution Plan

- [ ] **1. Add seed data** — `SERVICES_INIT` constant with the 4 seed services above
- [ ] **2. Add state** — `services`, `svcModal` (null | "add" | "edit"), `svcTarget`, form fields
- [ ] **3. Add nav item** — insert Services into the `NAV` array with `Layers` icon, after `bookings`
- [ ] **4. Build `ServicesPage` component** — filter bar + card grid
- [ ] **5. Build Add/Edit modal** — form with all fields, requirements list
- [ ] **6. Wire delete confirmation** — inline under card
- [ ] **7. Wire page router** — add `case "services"` to the page switch
- [ ] **8. Verify** — check render, dark mode, mobile layout

---

## Resolved Decisions

1. **Name** — "Offerings" ✓
2. **Requirements field** — comma-separated text input with example note in the label ✓
3. **Color per service** — auto-assigned by category: exam=blue (#3b82f6), lesson=green (#10b981), other=indigo (#6366f1) ✓
4. **Theme** — all UI uses T.* tokens for backgrounds/text/borders; only category accent colors use fixed hex, consistent with existing page patterns ✓
