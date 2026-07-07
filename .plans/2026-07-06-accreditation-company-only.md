# Accreditation / License No. — require only for "company" vendors

**Date:** 2026-07-06
**Scope:** `vendor` (onboarding UI), the future atomic submit route (backbone — via the KYC plan). No DB migration.
**Status:** IN PROGRESS — decision resolved (A) + frontend DONE (2026-07-06); backend enforcement pending, rides the KYC atomic route.

> One-line framing: the "Accreditation / License No." field currently sits in registration step 1 for everyone; with the KYC applicant-type split, it only makes sense for **company** vendors — move it so it is asked of (and required for) companies only, and drop it for individuals.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> Couples to: `.plans/2026-07-03-vendor-kyc-storage.md` (the KYC flow this rides on).

---

## Current state (verified 2026-07-06)

| Where | State |
|-------|-------|
| Vendor onboarding UI (step 1) | `RF "Accreditation / License No."` with placeholder "(optional)" — shown to everyone |
| Vendor register route `vendor/app/api/auth/register/route.ts:15` | **`ltoNo` IS required** server-side — contradicts the UI's "(optional)" *(pre-existing inconsistency)* |
| DB `vendors.accreditation_no` (`20260504000002_schema.sql:63`) | **nullable**, comment: "Optional… not all vendor types are accredited" — ✅ no migration needed |
| Command `VendorFormModal` | Has the field, no required marker (admin-entered vendors) — confirm at execution, likely leave as optional free entry |
| Booker | Does not surface accreditation anywhere |

**Timing note:** the applicant type (company/individual) is only known at **KYC step 3**, *after* step 1 where the field currently sits — so "conditional on type" requires moving the field, not just toggling validation.

---

## Decision — where does the field live?  ✅ RESOLVED (2026-07-06) → **A, inline on step 3**

- **A (recommended): inline on step 3 (applicant type).** Remove from step 1. When the vendor selects the **Company** card, an "Accreditation / License No." field appears beneath the cards; **required to continue** for company. Selecting Individual hides it (value cleared / submitted empty). One natural moment: "you're a company → give us your registration number."
- **B: on step 4 (documents).** Groups it with verification material, but mixes a text field into the free-form document list.
- **C: keep on step 1, optional for all, validate at review.** No relocation, but asks individuals an irrelevant question and defers the error far from the input.

**Recommendation: A.**

---

## Changes

### Frontend (now — mock phase of the KYC plan)  ✅ DONE (2026-07-06)
1. ✅ Removed the `ltoNo` RF from **step 1**; `ltoNo` stays in `RegForm` + the localStorage draft.
2. ✅ **Step 3:** Accreditation/License `RF` renders when `kycType === "company"`; selecting Individual clears `ltoNo`.
3. ✅ Step-3 continue via new `handleTypeContinue`: company → `ltoNo` required (inline error); individual → not asked.
4. ✅ `computeResumeStep`: company + missing `ltoNo` now resumes at step 3.
5. ✅ Review step (5): "Accreditation No." row shown only for company.
6. ✅ `tsc` exit 0. ⬜ manual click-through both types — user.

### Backend (rides the KYC plan's atomic submit route — not built now)
7. ⬜ Atomic route validation: `kycType === 'company'` → `accreditation_no` required (non-empty); `individual` → stored NULL/empty.
8. ⬜ **Legacy route** `vendor/app/api/auth/register/route.ts`: no change — it is retired by the atomic route at the KYC backend cutover. ⏸ If it must live on for any reason, drop `ltoNo` from its `required` set then (it has no type context to enforce conditionally).

### Out of scope
- Command `VendorFormModal` (admin entry stays free-form/optional; confirm no required validation at execution).
- Any DB change (`accreditation_no` already nullable).
- Renaming the field per vertical (e.g. "LTO No.") — cosmetic, later.

---

## Execution order
1. Approve the **Decision** above (A recommended).
2. Frontend items 1–6 (can ship with the current mock-phase KYC UI — same files, `LoginPage.tsx` + `useLoginPage.ts`).
3. Backend item 7 lands **inside** the KYC plan's atomic-route work (add it to that plan's backend step when built).

## Verification
| Check | Kind |
|-------|------|
| Step 1 no longer shows the field; step 3 shows it for Company only | manual UI |
| Company + empty accreditation → cannot continue past step 3; Individual → never asked | manual UI |
| Review step shows the accreditation row only for company; draft restores it | manual UI |
| `tsc --noEmit` passes in vendor | machine |
| (Backend, later) atomic route rejects company submissions without accreditation; stores NULL for individuals | live env |
