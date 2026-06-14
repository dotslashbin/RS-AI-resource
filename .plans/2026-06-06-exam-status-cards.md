# Exam Status Cards Redesign

**Date:** 2026-06-06  
**Scope:** `learner` only — `BookingStatusWidget` component

---

## Problem

The "Exam Status" section and "Current Bookings" below it share identical visual treatment (`.db-card` + list rows). Users can't distinguish them at a glance. The exam section needs to feel like a dedicated results/documents area, not another list.

---

## Design Decision

Individual elevated cards per exam, in a 2-column grid (1-col on mobile). Each card carries:

- **4px left border** in status colour (amber/green/blue) — the primary at-a-glance differentiator
- **Large exam code badge** (48×48) using existing `EXAM_CODE_STYLE` tokens
- **Status pill** (icon + label) — colour is never the only signal
- **Price paid** inline on the body row (uses existing `pricePaid` field)
- **Action footer** — conditional on status

Outer `.db-card` wrapper removed. Section header becomes a standalone row. Cards are the visual structure.

---

## Data Model Gaps (honest)

| Requested feature | Decision |
|---|---|
| Receipt link | Not in `Booking` type — show `₱X,XXX` price instead. Receipt download needs schema work first. |
| Instructor details | Not in `Booking` type — omitted. Requires schema change + query join. |

---

## Actions per status

| Status | Actions |
|---|---|
| `pending` | None — just status info |
| `confirmed` | "View Details" (toast placeholder) |
| `completed` | "Certificate" (existing toast placeholder) |

---

## Files changed

| File | Change |
|---|---|
| `BookingStatusWidget.tsx` | Full render redesign |
| `useBookingStatusWidget.ts` | Add `handleDetails` handler |

---

## Status

- [x] Plan written
- [x] Executed
