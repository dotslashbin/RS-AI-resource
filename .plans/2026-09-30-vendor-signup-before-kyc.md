# Vendor — sign up first, KYC after (gate until approval + activation)

**Date:** 2026-09-30
**App / scope:** cross-app (approved by the user 2026-09-30 under D8):
- `vendor/`: registration UI, `app/api/auth/register`, one new API route, KYC surface, access gate.
- `ezzy-vendor-mobile/`: access gate and blocked screen only.
- `command/`: the activation and create-vendor UX only.
- `backbone/`: **one migration** (a trigger) and `seed.sql`.
- `architecture/`: docs.

No `booker/` changes.
**Status:** COMPLETE (2026-10-01): **live in production.** The user deployed and tested staging, then released to production in the order Command → `db push` (C1 `20260930000001`, N1 `20260930000002`, N2 `20261001000001`) → vendor web. The production state is as reported by the user; the hosted DB was not queried from here.
- **Still open (not closed by this status):**
  - ⏸ M1's mobile device check: its unblock condition, the web release being live, is now met;
  - the M1 code, uncommitted on `ezzy-vendor-mobile` `feature/submission-prep`;
  - the open notes S7-F1, S1-F2, S2-F2, S2-F3, M-F1, M-F2, and I1 (record only).

> Split today's single "register + KYC" submission into (1) an account signup and (2) a KYC submission by the signed-in vendor. A vendor reaches the dashboard only when Command has **activated** it **and** its KYC is **approved**. The vendor apps route everyone else to the right KYC state. A database trigger makes "active" impossible without approved KYC from now on, so booker can never list an unverified vendor.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B#/I# = vendor web items, M# = mobile, C# = Command + backbone, G# = gaps found in review, D# = decisions. All numbers are plan-local; qualify cross-plan refs by plan or app (e.g. "command D6", "vendor-kyc 8a").

---

## 0. Headline findings (read first)

1. **The existing "submission process" *is* account creation.** `POST /api/auth/register` creates the auth user, profile, portal grant, vendor, membership, referral, KYC header, document rows and consent in one rolled-back sequence (`vendor/app/api/auth/register/route.ts:193-337`). This is D-7 = D in `architecture/vendor-kyc.md` ("no account until KYC completes"). The requested flow **reverses D-7** (accepted, D2). The submit must be split in two.
2. **The first KYC submission cannot be client-only.** `authenticated` has `select, update` only on `vendor_kyc` (`backbone/supabase/migrations/20260706000001_vendor_kyc.sql:96`), and document rows can only be inserted while the header is `rejected` (`:122`). A service-role route in the vendor app handles it (B2, D5). That route needs no migration.
3. **The login and reload gate already re-reads the DB every time** (`vendor/services/vendor-access.service.ts:59-110`, called from `useAppShell.ts:227` and `useLoginPage.ts:366`). It keys on `vendors.status` only. D1 adds "KYC approved" to it (B6). The "no KYC header" state spins forever today (`KycStatusPage.tsx:34`).
4. **The signup email already exists.** `vendor_registration_received` (`20260808000001_vendor_lifecycle_notification_types.sql`) is written by the register route (`route.ts:358-364`) and emailed through the generic dispatch path. Only its copy is wrong for the new flow (`route.ts:362`, "…and your documents"), and that copy is vendor-app code.
5. **Activation was deliberately advisory until now.** Command warns before activating a vendor without approved KYC but lets the admin proceed (`command/components/vendors/VendorsPage/useVendors.ts:103-131`, `VendorActivateConfirmModal.tsx:15-19`: "there are legitimate reasons to activate ahead of a packet", command D6/D8). This plan **reverses that decision** (D8). Command can also **create vendors directly, defaulting to `active`** (`command/hooks/mutations/vendors/useCreateVendor.ts:8-18`, `VendorFormModal/useVendorForm.ts:13`). The trigger must cover that path too (G1).

---

## 1. Current flow map

| Stage | Where | Status values involved |
|---|---|---|
| Register, steps 1–6 (details → account → applicant type → documents → ID/selfie → review + consent) | `vendor/components/auth/LoginPage/LoginPage.tsx:287-490`; state in `useLoginPage.ts` | none yet; draft in `localStorage` (`lib/kycDraft.ts`, `useLoginPage.ts:281`) |
| Submit: prepare → upload to `pending/{submissionId}/` → atomic create | `services/kyc.service.ts:113-200` → `app/api/auth/register/prepare/route.ts` → `app/api/auth/register/route.ts` | profile `active`, vendor `pending_activation`, `vendor_kyc.status = 'submitted'` (`route.ts:229, 247, 285`) |
| Emails at submit (best-effort) | `route.ts:344-400` | vendor: `vendor_registration_received`; Command: `vendor_pending_approval`, `new_user_registration` |
| Post-submit screen | `LoginPage.tsx:492-505` (`reg_sent`); the vendor is **not** signed in | — |
| Web login and reload gate | `useLoginPage.ts:317-409`, `useAppShell.ts:215-294` → `verifyVendorAccess`; the kiosk uses `verifyVendorAdminFor` (`useKioskShell.ts:132`) | allowed iff vendor `active`; otherwise `pending_kyc` / `vendor_suspended` / `unavailable` / `no_access` / `suspended` / `pending_profile` |
| Pending surface | `components/kyc/KycStatusPage/` via `AppShell.tsx:149-152` | `submitted` → under review; `rejected` → resubmit editor; `approved` → "awaiting activation"; **no header → infinite spinner** |
| Resubmit | `services/kyc.service.ts:260-305` (client, RLS-gated, uploads directly to `{vendorId}/…`) | `rejected → submitted` |
| Mobile gate | `ezzy-vendor-mobile/src/hooks/useVendorGate.ts:61-80` over `src/services/vendor.service.ts:26`; mobile kiosk `src/services/kioskAccess.service.ts:21-27` | `ready` iff vendor `active`; otherwise `blocked` (`pending_activation` / `suspended` / `no_access`), shown by `src/app/blocked.tsx` |
| Command KYC review | `command/services/kyc-admin.service.ts:78-100` (can set `approved`/`rejected` at any time, including after activation) and emails `kyc_approved`/`kyc_rejected` | `vendor_kyc.status` |
| Command activation / reinstate | `useVendors.ts:107-131` → `useSetVendorStatus`; action config in `VendorCard/vendorCardConfig.ts:44-53` (Activate and Reinstate both `isActivation`) | `pending_activation → active`, `suspended → active` (guarded by `validate_vendor_status_transition`, `20260511000001_vendor_approval.sql:31-58`) |
| Command create vendor | `useCreateVendor.ts:8-18`; the form's status select defaults to `active` (`useVendorForm.ts:13`, `VendorFormModal.tsx:55`) | any status, **no KYC** |

---

## 2. Target flow

| State | What the vendor sees (web; mobile in brackets) | Authoritative source |
|---|---|---|
| **First signup** | Steps 1 Business details → 2 Account + policy consent → **Create account**. The server creates user, profile (`active`), portal, vendor (`pending_activation`), membership, referral and consent, **with no KYC header**, and emails `vendor_registration_received` (new copy). The client signs in and lands on the KYC form. | signup response, then `verifyVendorAccess` |
| **No KYC yet** (pending **or** active) | KYC form: type → documents → ID/selfie → review → submit (B5). [Mobile: blocked, "Finish verifying your business on the web portal" (M1).] | `vendors.status` + `vendor_kyc` row, fresh from the DB on each load |
| **Submitted** | "Application under review" [blocked, under review] | `vendor_kyc.status = 'submitted'` |
| **Rejected** | Reviewer notes + resubmit editor [blocked, action needed on web] | `vendor_kyc.status = 'rejected'` |
| **Approved, not activated** | Existing "Documents verified — awaiting activation" [existing pending copy] | `approved` + `pending_activation` |
| **Active + approved** | **Dashboard** [ready] | `active` + `approved` |
| **Suspended** | Existing suspended copy on top. The KYC form or resubmit editor sits below it if KYC is missing or rejected (I4, G11) [mobile: blocked, suspended copy] | verdict `vendor_suspended` + header |
| **Active + not approved** | Same as the matching KYC row above, never the dashboard. After C1 this can only arise from legacy data (D9) or a re-review to `rejected` after activation (G4). | as above |

---

## A. Vendor web — BLOCKERS

### B1 — Split the register route: signup no longer takes KYC  ✅ DONE (2026-09-30, Stage 2; live check pending)
**File:** `vendor/app/api/auth/register/route.ts:97-176, 284-309, 342-397`; `vendor/lib/registration.ts:114, 123, 144-145, 174`
**Fix approach:**
- Drop the `submissionId`/documents parsing, the staged-object verification, the header insert, the document move and insert, and the staging sweep.
- Keep everything else, in the same order and with the same rollback: email → division → referral → createUser → profile → portal → vendor → membership → referral row → consent **last**.
- Insert `accreditation_no` as `null` at signup. It is nullable (`20260504000002_schema.sql:63`), and B2 sets it.
- In `lib/registration.ts`, move the `kycType`/`ltoNo` checks out of `validateFields` into a KYC validator that B2 uses.
- Notifications at signup: `vendor_registration_received` (copy per I2) and `new_user_registration`. **`vendor_pending_approval` moves to B2**, because its copy ("submitted KYC — awaiting approval") is only true then.
- Return `{ vendorId }`.
**Coupling:** ships with B2, B4 and B5 (Stage 3).
✅ **Done 2026-09-30.**
- `app/api/auth/register/route.ts` no longer reads `kycType`, `ltoNo`, `submissionId` or documents.
- The staged-object verification, header insert, document move and insert, and `sweepStaging` (now dead in this file) are removed.
- Rollback is now just "delete the vendor (which cascades membership and referral), then delete the user". The membership cascade was confirmed in `20260504000002_schema.sql`.
- `accreditation_no` is inserted as `null`.
- Consent is still written last.
- `vendor_pending_approval` was removed here; `new_user_registration` is kept. It still returns `{ vendorId }`.
- `lib/registration.ts`: `kycType`/`ltoNo` were removed from `RegistrationFields`, `readFields` and `ValidatedFields`, and their checks from `validateFields`.
- **Verified (machine):** `tsc` clean; eslint clean; `next build` OK; the new `lib/registration.test.ts` (6 tests) passes; `npm test` 510/510; a smoke test against `next start` got a 400 for missing fields.
- **Not verified:** a real signup writing rows and sending the email (verification scenario 1, which needs Stage 3's UI).
- ⚠️ **Do not deploy Stage 2 without Stage 3.** Until B4 lands, the current register UI still calls the old `submitKyc`. That would now create an account with **no** KYC, orphan the staged uploads, and then show "Application submitted".

### B2 — New authenticated route for the first KYC submission  ✅ DONE (2026-09-30, Stage 2; live check pending)
**File (new):** `vendor/app/api/kyc/submit/route.ts`; client wrapper `submitFirstKyc` in `vendor/services/kyc.service.ts`, which replaces the account-creating `submitKyc` at `:113-200`
**Fix approach:**
1. The client uploads to `vendor-kyc/{vendorId}/{uuid}-{name}`, as `resubmitKyc` does (`kyc.service.ts:280-288`). `"kyc vendor admin upload own"` already allows this (`20260706000002_vendor_kyc_storage.sql:30-37`). There is no staging and no `prepare`, and the route body is JSON only, so Vercel's 4.5 MB cap does not apply.
2. The client POSTs `{ vendorId, kycType, ltoNo, documents: [{label, objectName}] }`.
3. The route checks the caller through the **cookie-bound server client** (`getUser()`, never the body) and requires:
   - the caller is vendor-admin of `vendorId`;
   - **any** vendor status (`pending_activation`, `active` or `suspended`). A suspended vendor with no KYC must be able to submit, or it could never be reinstated under C1 (G11). Submitting activates nothing, so Command still decides.
   - **no `vendor_kyc` row exists** (409 otherwise);
   - the fields pass the B1 validator;
   - every object exists under `{vendorId}/` with a listed total ≤ `MAX_TOTAL_BYTES`, reusing `route.ts:151-176`.
4. With the service role it inserts the header (`submitted`), sets `vendors.accreditation_no` for `company`, and inserts the document rows. On failure it deletes the header, which cascades to the documents. It then writes `vendor_pending_approval` to Command (best-effort).
5. On failure the client removes what it uploaded, as `resubmitKyc` does.
**Risk surface:** an IDOR on `vendorId` (closed by the membership check); a double submit (closed by the 409); orphaned objects if the tab dies between upload and POST (accepted, DEFERRED).
⚠️ `vendors.accreditation_no` is written by the service role. The vendor-status triggers fire only on `status_id` changes, so this update is unaffected by C1.
✅ **Done 2026-09-30.**
- **The route** is `app/api/kyc/submit/route.ts`:
  - it validates with `lib/kycSubmission.ts` (pure);
  - the caller comes from the cookie session (401 without one);
  - authorisation is the three-layer `assertVendorAdmin(..., { requireActiveVendor: false })`, with a flat 403 and the reason logged only;
  - an existing header gets 409 up front, **and** a PK `23505` race at insert also gets 409 without rolling back the other request's header;
  - the objects are verified by a listing of `{vendorId}/` and the real sizes are totalled against `MAX_TOTAL_BYTES`;
  - then header → document rows → `accreditation_no` (company only, last, `.select().single()`), with rollback = delete the header (cascades the docs, FK confirmed);
  - then `vendor_pending_approval` to Command, best-effort.
- **Client:** `services/kyc.service.ts` gains `signUpVendor` and `submitFirstKyc`. The latter uploads directly to `{vendorId}/{uuid}-{name}` (reusing `stagedObjectName`) and removes its own uploads on any failure, including 409.
- **Verified (machine):**
  - `tsc` and eslint clean; `next build` lists `ƒ /api/kyc/submit`;
  - `lib/kycSubmission.test.ts` (11 tests) passes: UUID, type, company number, count, label, traversal (`/`, `\`, `..`), duplicates;
  - smoke test against `next start`: bad JSON 400, non-UUID vendor 400, `../` object 400, valid body without a session 401.
- **Not verified (needs a live env and a signed-in vendor):** 403 for another vendor's id, 409 on the second submit, refusal of un-uploaded objects, a successful create, and rollback (verification scenarios 3–4). These run in Stage 3 once the UI exists.

### B3 — `getMyKyc`: tell "no header" apart from "read failed"  ✅ DONE (2026-09-30, Stage 1)
**File:** `vendor/services/kyc.service.ts:224-232`; `components/kyc/KycStatusPage/useKycStatusPage.ts:36-41`
`if (error || !data) return null` treats a failed read as "no KYC". Under the new flow that would show the form to a vendor who already submitted.
**Fix approach:** return a discriminated result (`kyc` / `none` / `error`). `error` shows a retry, never the form. This is the same rule as the gate's `unavailable`.
✅ **Done 2026-09-30.**
- `getMyKyc` now returns `MyKycResult` (`found` / `none` / `error`). A failed **documents** read also counts as `error`: it previously returned an empty doc list, which the resubmit editor would show as "nothing submitted".
- `useKycStatusPage` tracks `loadFailed` and exposes `retry`. The page shows "We couldn't load your verification status" with **Try again**.
- The load effect is cancellable and no longer sets state synchronously. That fixed a pre-existing `react-hooks/set-state-in-effect` lint error, which HEAD also fails.
- The `none` branch shows **interim** copy ("Verification documents needed… contact support") until B5 replaces it with the form in Stage 3.
- **Verified (machine):** `tsc --noEmit` clean; eslint clean on the changed files; `npm test` 493/493 pass. The Playwright gallery render showed the error screen for a failed read (see S1-F1).
- **Not verified (needs a live env):** the retry against a real transient failure, and a real no-header vendor (verification scenarios 5 and 8).

### B4 — Register UI: two steps + consent, then sign in and hand off  ✅ DONE (2026-09-30, Stage 3)
**File:** `vendor/components/auth/LoginPage/LoginPage.tsx:287-505`, `useLoginPage.ts:258-308, 549-705`, `REG_STEP_LABELS`, `lib/kycDraft.ts`
**Fix approach:**
- Step 2 gets the existing `<LegalConsent>` and a **Create account** button.
- The hook runs signup (B1) → `signIn(email, password)` → `onPendingVendor(vendorId)`. That is the existing prop (`AppShell.tsx:160`), so `AppShell` needs no change.
- If sign-in fails after the account was created, show "Your account was created — please sign in to continue".
- Remove steps 3–6 (moved in B5) and `reg_sent` (D3).
- `kycDraft` drops `kycType`. Old drafts that contain it are harmless because the field is ignored (`kycDraft.ts:35,46`).
- Resume logic (`useLoginPage.ts:300-308`) covers steps 1–2 only.
**Component separation:** `LoginPage.tsx` stays pure render and the logic stays in `useLoginPage.ts`. The only CSS change is removing classes that move to B5.
✅ **Done 2026-09-30.**
- Register is 2 steps. Step 2 carries `<LegalConsent>` and **Create account**, plus a one-line "next, you'll verify your business" hint.
- `handleCreateAccount` does: validate → email re-check → `signUpVendor` → clear the draft and the form → `signIn` → `routeSignedInUser`.
  - `routeSignedInUser` is the post-sign-in body of `handleLogin`, extracted so **signup and login route through the same DB verdict**.
  - If the automatic sign-in fails, the vendor goes to Sign In with the email filled in and a neutral `loginNotice` ("Your account has been created. Please sign in to continue."), styled `.notice`, not as an error.
- Removed: steps 3–6, `reg_sent`/`goRegSent` and all KYC state.
- `kycDraft` no longer has `kycType`/`ltoNo` (no version bump, documented in `lib/kycDraft.ts`).
- The gallery's `loginregsent` mode was removed from `app/ui-gallery/page.tsx` and `visual-tests/pilot.spec.ts` (S3-F1).
- **Verified:**
  - machine: `tsc`, `next build`, eslint (no new errors vs HEAD);
  - Live check (2026-09-30, `next start` + local Supabase, throwaway vendor removed afterwards; 24/24 pass): register shows "Step 2 of 2" and resumes at step 2; Create account signs in and lands on the KYC form; the rows are profile `active`, vendor `pending_activation` with `accreditation_no` null, a vendor-admin membership, 4 consent rows and **no** `vendor_kyc`; `vendor_registration_received` has the new title; `new_user_registration` was written and `vendor_pending_approval` was **not**; the draft is cleared.
- **Not verified:** the "created but sign-in failed" notice path, which needs fault injection (scenario 11). Email **delivery** is not verified either: local `notification_emails` is empty, so the local email pipeline is not running. The rows are verified.

### B5 — KYC form for a signed-in vendor with no header  ✅ DONE (2026-09-30, Stage 3)
**File (new):** `vendor/components/kyc/KycSubmitForm/{KycSubmitForm.tsx, useKycSubmitForm.ts, KycSubmitForm.module.css}`; `components/kyc/KycStatusPage/*`
**Fix approach (D4):**
- **Move** the step 3–6 JSX (`LoginPage.tsx:362-490`) and its handlers (`useLoginPage.ts:549-705`) unchanged. Two copy lines become false and must change: step 6's "We'll create your account once submitted", and the step-3 intro if it mentions registering.
- `KycStatusPage` renders the form when the hook reports `none`.
- On success, the hook **re-reads** `getMyKyc` rather than patching local state.
**Component separation:**
- The `.tsx` is pure render. Step, file and submit state live in `useKycSubmitForm.ts`.
- CSS classes move from `LoginPage.module.css` to `KycSubmitForm.module.css`.
- The existing dynamic selected-card `style={{}}` values are carried over as-is. Nothing new goes inline.
- `KycStatusPage.tsx` gains one branch, and the decision lives in its hook.
- Apply `.claude/skills/ux-design/SKILL.md` to the new branch's loading, error and empty states.
✅ **Done 2026-09-30.**
- `components/kyc/KycSubmitForm/{KycSubmitForm.tsx, useKycSubmitForm.ts, KycSubmitForm.module.css}` holds the step 3–6 markup and handlers, moved as 4 steps: type → documents → identity → review.
- CSS: 30 step-only classes were **moved** out of `LoginPage.module.css`; the step chrome (header, progress, buttons, error) was **copied**, because LoginPage still uses it. Two static inline styles from the old markup became classes (`.typeText`, `.typeCheck`).
- There is no consent box. The step-6 "we'll create your account" copy was replaced.
- `KycStatusPage` renders the form for `view === "none"`, and `onSubmitted` = `retry`, so the next view is **re-read from the DB**.
- The Stage 1 interim "none" copy and its two CSS classes are removed.
- A gallery-only `kycsubmit` mode was added for review; it is **not** registered in `pilot.spec.ts` (I6).
- **Verified:** Live check (2026-09-30, `next start` + local Supabase, throwaway vendor removed afterwards; 24/24 pass):
  - the form rendered in the real card (screenshots checked);
  - 403 for another vendor's id, and 400 for never-uploaded objects with no header left behind;
  - a full submit through the UI (Individual, permit PDF, ID + selfie by file fallback) gave review "Documents (3)", then "Application under review";
  - the header is `submitted`/`individual`, the three document rows are labelled correctly, and `vendor_pending_approval` was written;
  - a second POST got 409, reload stays on "under review", and an unauthenticated POST got 401.

### B6 — Web gate: dashboard only when the vendor is active AND KYC is approved  ✅ DONE (2026-09-30, Stage 3; fully live-verified after the user's reset)
**File:** `vendor/services/vendor-access.service.ts:70-74, 98-109` (`verifyVendorAccess`) and `:135-140, 181-184` (`verifyVendorAdminFor`, kiosk); `services/vendor.service.ts:22-42` (`getUserVendors`, `DbVendor`); `useAppShell.ts:272-273`; `useLoginPage.ts:79-81`
**Fix approach:**
- Add `vendor_kyc(status)` inside the existing `vendors(...)` embed. It is 1:1 (PK `vendor_id`), so PostgREST returns an **object, not an array**, the same trap noted in `command/services/vendors.service.ts`. It is readable through `"vendor admins read own kyc"` (`20260706000001_vendor_kyc.sql:72`).
- "Usable" becomes `active && kyc?.status === 'approved'`. Suspended still wins first. Every other vendor-admin row maps to `pending_kyc` with that vendor's id. **No new reason value**, because `KycStatusPage` already chooses its view from the header.
- `verifyVendorAdminFor` gets the same rule; its own comment requires the two to agree.
- `getUserVendors` embeds `vendor_kyc(status)` and `DbVendor` gains `kycStatus` (hand-written type). The two post-verdict `active` filters become "active and approved", so a multi-vendor admin's picker cannot offer an unapproved vendor.
- **Deliberately unchanged:** `lib/payout/authz.server.ts` is write authorisation, not routing (see its header).
**Why it is still needed after C1:** C1 stops new "active without approval" states. It cannot touch legacy rows (D9) or a re-review to `rejected` after activation (G4).
✅ **Done 2026-09-30.**
- The rule lives once in the pure `vendor/lib/vendorGate.ts` (`isVendorUsable`, `kycStatusOf`), with 9 tests in `lib/vendorGate.test.ts`. `kycStatusOf` reads the documented 1:1 **object** shape and also accepts an array, because a shape surprise would lock every vendor out.
- It is used by `verifyVendorAccess`, `verifyVendorAdminFor` (kiosk), `getUserVendors` (`DbVendor.kycStatus` added), and the two post-verdict pickers (`useAppShell.ts`, `useLoginPage.ts`).
- The one `as any` this added was replaced by a narrow type. `vendor-access.service.ts` now has 4 lint errors against HEAD's 5.
- **Verified:** Live check (2026-09-30, `next start` + local Supabase, throwaway vendor removed afterwards; 24/24 pass): seed vendor admin `jose` (whose vendor is `active` with **no** KYC in the local DB) signs in and gets the **KYC form, not the dashboard**. Unit tests cover every status combination.
- ~~Not verified live: active + approved → dashboard, the multi-vendor picker, the kiosk.~~ **Verified 2026-09-30, after the user's local `db reset`** (live check part 2, 8/8 pass):
  - `jose` (Citywide: active + approved) opens the **dashboard** and stays there on reload;
  - a kiosk pinned to Citywide runs;
  - `maria`'s picker offers all 3 approved vendors;
  - with Harbor's packet flipped to `submitted` (the one lever; `vendor_kyc` has no triggers, and it was restored to `approved` in `finally` and re-checked), `maria`'s picker **hides Harbor**, `marco` (Citywide + Harbor) goes **straight to the dashboard** because only one usable vendor remains, and a kiosk pinned to Harbor is **refused** ("Temporarily unavailable").
- Part 1 (signup + KYC, 23 checks) was re-run on the reset DB: 23/23 pass, cleaned up.
- Test note: the dashboard wait must target the `<h1>`, not the heading role. After a reload the existing "Getting Started" guide opens as a modal and hides the page from the accessibility tree. This is not a defect.

## A. Vendor web — IMPORTANT

### I1 — Do not widen RLS instead of B2  ⬜ TODO (record only)
New `insert` policies on `vendor_kyc` or its documents would need a migration and a security review, and they risk letting a vendor edit a packet that is under review. B2 avoids all of that (D5).

### I2 — Signup email copy  ✅ DONE (2026-09-30, Stage 2; delivery check pending)
**File:** `vendor/app/api/auth/register/route.ts:360-363`
Change the title and body only, e.g. "Your Ezzy vendor account is ready — next, verify your business: sign in and submit your documents. Our team reviews each business by hand…". Confirm the type renders through the generic template (`email-notifications-guide.md:20` lists only two bespoke types), in which case no function redeploy is needed.
✅ **Done 2026-09-30.**
- New title: "Your vendor account is ready — next, verify your business".
- The new body says the account exists, that the next step is to sign in and submit documents, and that the dashboard opens once the business is verified and activated.
- **Confirmed:** `backbone/supabase/functions/send-notification-email/lib/templates/registry.ts` maps only `kiosk_booking_confirmed` and `payout_statement`, so this type renders through `generic.ts` and **no function redeploy is needed**.
- **Not verified:** actual delivery (scenario 1).

### I3 — Multi-vendor verdict  ✅ DONE (verified live 2026-09-30, see B6)
`pending_kyc` returns the first non-usable vendor-admin row (`vendor-access.service.ts:109`). This is pre-existing. Self-registered vendors have exactly one membership.

### I4 — Suspended wins over "no header"  ✅ DONE (2026-09-30, Stage 1)
**File:** `KycStatusPage.tsx:34-38, 138`
The view is resolved in the hook in this order: error → then the KYC state (none → form, rejected → resubmit editor, submitted → under review, approved → awaiting activation). **Suspended is a notice shown ABOVE the KYC state, not a replacement for it** (revised 2026-09-30, G11). A suspended vendor sees "Your account is suspended". If their KYC is missing or rejected, they also get the form or resubmit editor below it, because that is their only way back under C1. A suspended vendor with approved KYC sees only the suspended copy, as today.
✅ **Done 2026-09-30.**
- The precedence was extracted to the pure `vendor/lib/kycView.ts` (`resolveKycView`, `showsSuspendedNotice`) and tested in `lib/kycView.test.ts`: 9 cases covering every loading / error / header-status × suspended combination.
- The hook calls it, and the render switches on `view`.
- A suspended notice (`role="status"`) now sits above the `none` and `rejected` views. Its copy is deliberately silent on the reason.
- **Correction to the plan's premise:** `rejected` already rendered before `suspended` in the old code (`KycStatusPage.tsx:38` vs `:138`), so a suspended + rejected vendor already reached the resubmit editor. It just had no suspended notice. The only broken suspended case was **suspended + no header** (endless spinner).
- **Verified (machine):** as B3. **Not verified:** a live suspended vendor (scenario 10).

### I5 — Retire the staging path B1/B2 make obsolete  ✅ DONE (2026-09-30, Stage 7)
**File:** `app/api/auth/register/prepare/route.ts`; `lib/registration.ts` (`STAGING_PREFIX`, `validateManifest`, `stagedObjectName` if unused); `sweepStaging` (`route.ts:50-61`)
Confirm with `grep` that nothing calls these, then remove them. Report, but do not delete, any leftover `pending/` objects in the hosted buckets.
✅ **Done 2026-09-30.**
- `grep` confirmed there were no callers outside the files themselves and the docs.
- Removed:
  - `app/api/auth/register/prepare/route.ts` (moved to the session scratchpad; it is in git history);
  - from `lib/registration.ts`: `STAGING_PREFIX`, `DocumentManifestEntry`, `validateManifest`;
  - from `services/kyc.service.ts`: the transitional `submitKyc` and `SubmitKycParams`. `SignUpVendorParams.form` is now spelled out.
- `stagedObjectName` is **kept**, because `submitFirstKyc` names uploads with it; its comment says the name is historical. The module header was rewritten as the current design plus the history.
- **Verified:** `next build`. The dev route types were regenerated by a brief `next dev` on a spare port, because the stale `.next/dev/types` still listed `prepare`. `tsc` clean; eslint clean on the changed files; `npm test` 517/517.
- **Reported, not done:** any leftover `pending/` objects in the **hosted** `vendor-kyc` buckets (staging, production) are orphans of the retired path. Check with the Storage dashboard or `backbone/scripts/wipe-kyc-storage.mjs --dry-run`, and remove them if you want to; that is your call.

### I6 — Visual baselines  ✅ DONE (2026-09-30, Stage 7)
The `/ui-gallery?mode=loginregister`, register and KYC screenshots change. Regenerate them deliberately and review the diffs.
⏸ **Parked 2026-09-30, pending three user decisions** (the stage halted here as the user asked):
1. `kycstatus` is timing-dependent (S1-F1): choose (a) deterministic gallery states, or (b) make the spec wait for the error screen.
2. The orphaned `loginregsent-{light,dark}` baselines: delete them, or keep them?
3. The `kycsubmit` gallery mode (added in Stage 3, not registered): register it in `pilot.spec.ts`, which means reviewing its baselines, or leave it unregistered?

`loginregister` was already regenerated and is stable (S3-F1). **Unblock:** the user's answers.

**Decisions (user, 2026-09-30):** 1 → **(a)** deterministic gallery states; 2 → **delete**; 3 → **register**.
🔄 **Executed 2026-09-30:**
- **(1a)** The stateless parts of `KycStatusPage` were split into three **pure** components in `components/kyc/KycStatusPage/`:
  - `KycStatusCard` (frame + Sign Out);
  - `KycStatusMessage` (loading / error / suspended / review, with the moved JSX unchanged except that the suspended screen's static inline colours became the existing `.statusIconError` / `.iconRed` classes);
  - `KycSuspendedNotice`.

  `KycStatusPage` composes them; the resubmit editor stays in the page because it is all hook handlers. The gallery gets one mode per state: `kycstatus` (now deterministic loading), `kycstatus-error`, `-review`, `-approved`, `-suspended`, `-none-suspended` (notice + form), and `kycsubmit`, now in the real frame instead of a hand-styled div. The resubmit editor (rejected) is still not pixel-covered.
- **(2)** `loginregsent-{light,dark}` were removed (moved to the session scratchpad; they are in git).
- **(3)** The 7 KYC modes were registered in `pilot.spec.ts`. The 12 new baselines were generated with a scoped `--grep "kycstatus|kycsubmit" --update-snapshots` and reviewed (none-suspended dark, approved light, suspended light, and others). The original `kycstatus` baseline was unchanged: the deterministic loading state matches the old spinner shot.
- **Verified:** `tsc`; eslint (only the gallery's pre-existing `Body` error). The KYC modes were re-run **twice without update: 14/14 both times** (stable). **Full vendor visual suite: 197/197 pass.**

### S7-F1 — The suspended screen says "This is not about your verification documents"  ⬜ TODO (copy; found in Stage 7, 2026-09-30)
**File:** `vendor/components/kyc/KycStatusPage/KycStatusMessage.tsx` (the `suspended` view)
That line predates C4. A vendor suspended through C4's prompt (packet rejected), who then resubmits, has a `submitted` packet and is still suspended, so they see the full suspended screen saying it is **not** about their documents, which is false for them. A neutral line would fit both kinds of suspension (e.g. drop the sentence, or "If you recently resubmitted documents, our team will review them before reinstating your account"). This is a copy decision for the user, like S3-F2.

### S1-F1 — `kycstatus` gallery baseline is now timing-dependent  ✅ DONE (2026-09-30, option (a) via I6)
**File:** `vendor/app/ui-gallery/page.tsx:1101-1106`; `visual-tests/pilot.spec.ts:9` (mode `kycstatus`); the committed `kycstatus-{light,dark}.png`
The fixture renders `<KycStatusPage vendorId="gallery">` with no DB, relying on the read never resolving. Its comment says "the hook stays in its loading state". Before B3 a failed read also rendered the spinner, so the shot was stable either way. Now a failed read renders the **error** screen, so the shot depends on whether it is taken before or after the failed request returns. Run of 2026-09-30:
- **dark:** failed, 6164 px different. The actual image shows the new error screen, and it rendered correctly.
- **light:** passed, still the spinner.

**Not regenerated**: accepting a baseline over a race would bake in a flaky shot, and baselines are the user's review (memory: repo-app-ports).
**Options:**
- (a, recommended) Give the gallery deterministic states. Add a gallery-only way to render each `view` (e.g. `?mode=kycstatus&state=error|none|suspended-none`) by lifting the page body into a pure child that takes `view`. This is the pattern the gallery comment at `:986` already describes for other pages. The new states then get pixel coverage, and the user reviews the new baselines.
- (b) Make the spec wait for the error screen before shooting `kycstatus`. That is smaller, but it covers only the error state.

The choice belongs with I6 (baselines) in Stage 7, or earlier if a failing `kycstatus` blocks CI.

### S1-F2 — The page uses hard-coded dark colours, not theme tokens  ⬜ TODO (noted, pre-existing)
**File:** `vendor/components/kyc/KycStatusPage/KycStatusPage.module.css`
The whole page is dark-only (`rgba(255,255,255,…)` on a dark card) and has no light variant. The Stage 1 additions match the file, as AGENTS.md requires, rather than introducing tokens into one corner of it. `ux-design` §6 prefers tokens. This is reported and not changed: retheming this page is outside this plan.

### S2-F1 — `lib/registration.ts` now imports `./validation.ts` relatively  ✅ DONE (2026-09-30, Stage 2; unplanned)
Its `@/lib/validation` import made the module unloadable by `npm test` (plain Node: `ERR_MODULE_NOT_FOUND '@/lib'`), so the signup rules had **no** unit tests, and the new KYC validator (which reuses its limits) could not have any either. The import was switched to the relative, extension-ful form that its `./referralCode.ts` import already uses; `validation.ts` has no imports of its own. `tsc` and `next build` are clean.

### S2-F2 — The KYC route reuses `assertVendorAdmin` from `lib/payout/`  ⬜ TODO (noted, low)
**File:** `vendor/lib/payout/authz.server.ts`
It is the only server-side three-layer vendor-admin check in the app, so B2 reuses it through a new optional `{ requireActiveVendor }` (default `true`). The payout route's call is unchanged and exactly as strict. The module's **location** now misleads, because it serves KYC too. Moving it to e.g. `lib/vendorAuthz.server.ts` is a small refactor, and it is left for the user to schedule rather than done unasked.

### S2-F3 — The server does not require the "Valid ID" and "Selfie with ID" documents  ⬜ TODO (noted; parity with before)
The UI requires both photos before submit, but neither the old register route nor the new KYC route checks the labels server-side. A direct API caller could submit a packet without them. This is unchanged behaviour. Command's review is where a missing ID is caught. Enforcing it would mean relying on free-text labels (D-1 = B), so it is reported, not changed.

### S3-F1 — Register baselines changed; `loginregsent` baselines orphaned  ✅ DONE (2026-09-30 — loginregister regenerated; loginregsent removed via I6)
- Full visual suite 2026-09-30: **183 passed, 2 failed**. Both failures are `loginregister-{light,dark}`, and the diff is **only** "Step 1 of **2**" and the 2-segment progress bar (diff image checked), which is intended.
- `kycstatus` passed both themes on this run, consistent with S1-F1's race.
- The `loginregsent` mode was removed with its view, so `visual-tests/pilot.spec.ts-snapshots/loginregsent-*.png` are now unreferenced.
- **Not regenerated and not deleted:** baselines are the user's review.
- **2026-09-30 (user asked, for reference, after committing Stage 3):** `loginregister-{light,dark}` were regenerated with a scoped `--grep loginregister --update-snapshots`, then re-run without update: 2/2 pass. Only those two PNGs changed, and they are left for the user to commit. The `loginregsent-*` orphans are still untouched (I6).

### S3-F2 — KYC form intro reads oddly for long-standing active vendors  ✅ DONE (2026-09-30, via E2's neutral wording)
**File:** `vendor/components/kyc/KycSubmitForm/KycSubmitForm.tsx` (step 1 intro)
"Your account is set up. Before you can take bookings…" is right for a new signup. It is also shown to an **existing active** vendor with no approved packet (legacy, D9), for whom "set up" is odd and "before you can take bookings" is not literally true: booker still lists them until suspended (D8/G4). A neutral line would fit both, e.g. "To use your dashboard, our team needs to verify your business…". This is left for the user's copy call.

### S3-F3 — Live test note: text waits must be exact  ✅ DONE (process note, 2026-09-30)
The live script's first runs mis-reported because Playwright's `getByText("Verify your business")` is a case-insensitive **substring** match and hit the step-2 hint ("…you'll verify your business…"). Exact matching fixed it. Two aborted runs left one test vendor and 5 notifications behind; all were removed and re-checked at zero. This is recorded so the next live script starts exact.

### E1 — The signup email asks the vendor to act, but has no link  ✅ DONE (option (a), user 2026-09-30)
**File:** `vendor/app/api/auth/register/route.ts` (the `vendor_registration_received` body, I2); `backbone/supabase/functions/send-notification-email/lib/templates/generic.ts`
I2 changed this email from a plain acknowledgement ("we've received your application") to an **instruction** ("sign in and submit your verification documents"). The generic template renders only `title` + `body`, with no button or URL (`generic.ts`: "Add a per-type override … only when a type earns bespoke copy or a call-to-action"). So the email now tells the vendor to do something without telling them **where**. "No link" was deliberate for the old acknowledgement (A-B6/D9: "nothing to click"), but that reason no longer holds. The same gap exists, pre-existing, in Command's `kyc_rejected` email ("Sign in to review the notes…").
**Options:**
- **(a, recommended now)** Put the vendor portal URL in the body text. The register route composes the body and can resolve the app's own origin (`vendor/lib/siteUrl.ts`). Most mail clients auto-link a bare URL. It is a vendor-app-only change, with no email-function change or redeploy, and it ships with this release.
- **(b)** A bespoke `vendor_registration_received` template with a proper "Verify your business" button. That is an edge-function change, a backbone change and a function **redeploy** (`email-notifications-guide.md`: bespoke types need the function redeployed before first use). It is nicer, but a separate step.
- **(c)** Leave it. The vendor finds the portal themselves, and support questions are likely.

The `kyc_rejected` link (Command) is a separate, pre-existing gap. It could take the same approach later and is out of this plan unless the user adds it.

✅ **Done 2026-09-30, option (a)** (user's decision).
- The copy moved into the pure `vendor/lib/registrationEmail.ts` (`registrationAckBody`, `REGISTRATION_ACK_TITLE`), with 3 tests. The body now says "…sign in at <portal URL> and submit your verification documents…".
- The register route resolves the URL with `resolveSiteUrl().origin` (this deployment's own origin: `NEXT_PUBLIC_APP_URL`, else `VERCEL_PROJECT_PRODUCTION_URL`). If that throws on a misconfigured deploy, the email uses the link-less wording, logs a warning, and **never fails the signup**.
- **Verified:** `tsc`; eslint; `npm test` 520/520; `next build`. **Live:** a throwaway signup stored the body with "sign in at http://localhost:3000" (local `NEXT_PUBLIC_APP_URL`), and was removed.
- **Not verified:** that staging and production resolve their own vendor URL. Check it in the staging smoke-test email; if `NEXT_PUBLIC_APP_URL` is unset there, Vercel's production domain is used.
**Also outstanding (not new):** email **delivery** of every email in this flow has never been observed, because local email is not running (I2 / B4 "not verified"). The staging smoke test is the first real check: the signup email, Command's `vendor_pending_approval`, and `kyc_approved` / `kyc_rejected`.

### N1 — The vendor is never told when its account is ACTIVATED  ✅ DONE (2026-10-01) — applied locally by the user; live-verified within N2's lifecycle check
**Checked 2026-09-30 (user asked):**

| Event | Vendor notified? | Where |
|---|---|---|
| KYC approved | ✅ in-app + email (`kyc_approved`) | `command/services/kyc-admin.service.ts` `notifyVendorOfReview` |
| KYC rejected | ✅ in-app + email (`kyc_rejected`, with the reason) | same |
| **Vendor activated** (pending → active) | ❌ **nothing** | No notification type exists; Command's `setVendorStatus` and `log_vendor_status_change` write no notification |
| **Vendor reinstated** (suspended → active) | ❌ nothing | same |

The gap was already there, but this plan makes it bite. Activation is now the **last** step before the dashboard opens (D1), and two places **promise** it:
- the `kyc_approved` email: "Your account will be activated shortly — we'll be in touch";
- the vendor's "Documents verified" screen: "we'll email you the moment it's done" (`KycStatusMessage.tsx`).

Neither promise is kept, so an approved vendor has no way to learn they can start, short of signing in on a hunch.

**Options (writer):**
- **(A, recommended)** A **DB trigger** on `vendors` (AFTER UPDATE OF `status_id`, transition INTO `active`) inserts one `vendor_activated` notification per vendor-admin. It fires for **every** path (Command, scripts, future tools), mirrors how booking notifications are made, and the email follows through the existing dispatch trigger.
- **(B)** Command writes it after a successful Activate/Reinstate, as `notifyVendorOfReview` does. It needs no new trigger, but it misses any other path. **Either way a new notification type row is needed, so a migration is unavoidable.**

**Draft migration for (A)** (not written; needs the user's approval of this exact SQL):
```sql
-- 2026MMDD000001_vendor_activated_notification.sql
insert into public.notification_type_settings (type, label, description) values
  ('vendor_activated', 'Vendor Activated',
   'Sent to a vendor''s admins when Command activates or reinstates the vendor.')
on conflict (type) do nothing;

-- Writes notifications, which `authenticated` cannot insert for other users, so it is
-- a definer; search_path pinned. Fires AFTER the guards (C1, transition, permission),
-- so it only ever sees a move that was allowed.
create or replace function public.notify_vendor_activated()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_active     smallint;
  v_suspended  smallint;
  v_enabled    boolean;
  v_reinstated boolean;
begin
  select id into v_active    from public.statuses where name = 'active';
  select id into v_suspended from public.statuses where name = 'suspended';
  if new.status_id is distinct from v_active or old.status_id = v_active then return new; end if;

  select is_enabled into v_enabled from public.notification_type_settings where type = 'vendor_activated';
  if not coalesce(v_enabled, false) then return new; end if;

  v_reinstated := old.status_id = v_suspended;
  insert into public.notifications (user_id, portal, type, title, body, data)
  select vm.user_id, 'vendor', 'vendor_activated',
         case when v_reinstated then 'Your vendor account has been reinstated'
              else 'Your vendor account is active' end,
         case when v_reinstated
              then format('%s is active again. Sign in to the vendor portal to pick up where you left off.', new.name)
              else format('%s has been verified and activated. Sign in to the vendor portal to add your offerings and start taking bookings.', new.name) end,
         jsonb_build_object('vendor_id', new.id, 'vendor_name', new.name, 'reinstated', v_reinstated)
  from public.vendor_members vm
  join public.roles r on r.id = vm.role_id
  where vm.vendor_id = new.id and r.name = 'vendor-admin';
  return new;
end;
$$;

create trigger notify_vendor_activated
  after update of status_id on public.vendors
  for each row execute function public.notify_vendor_activated();
```
**Blast radius:**
- **Data:** no rows are rewritten; it only acts on future activations.
- **Lock:** brief, at `create trigger`.
- **Downstream:**
  - add `vendor_activated` to the `NotificationType` union in `send-notification-email/types.ts`. A redeploy is optional: the generic template already renders title + body.
  - **The seed's activation UPDATE (I8) will create a notification for each seeded vendor-admin on `db reset`** (about 6 rows locally). Harmless, but visible in the seeded admins' bells; it can be suppressed by disabling the type around the seed update if wanted.
  - The body has **no URL**, because the DB does not know the vendor portal's origin. Its "Sign in to the vendor portal" is adequate for an account the vendor has already used. Option (B) could add a link.
- **Reversal:** `drop trigger notify_vendor_activated on public.vendors; drop function public.notify_vendor_activated();`, plus deleting the type row if no notifications reference it.

**Coupling:** once N1 ships, the two promises above become true. Until then, consider softening their copy.

**Related, not asked:** suspension (`active → suspended`) also notifies nobody. Under C4 a vendor suspended after a rejected packet is told the KYC was rejected (`kyc_rejected`) but not that it was suspended. This could be the same trigger with a second branch; it is left out unless the user wants it.

**Decision needed:**
1. (A) trigger or (B) Command-side.
2. Approve the exact SQL (for A).
3. Include suspension notices, yes or no.
4. Ship with this release, or as a follow-up. If it follows, the release goes out with the two unkept "we'll email you" promises unless their copy is softened.

**Decisions (user, 2026-09-30):** (A) trigger · SQL approved · **include suspension** · **this release**.
🔄 **Executed 2026-09-30:**
- **Written:** `backbone/supabase/migrations/20260930000002_vendor_status_notifications.sql`. It is the approved draft, extended as asked:
  - **two types**: `vendor_activated` (activated, or "reinstated" when coming from suspended) and `vendor_suspended`, each switchable on its own;
  - one function/trigger, `notify_vendor_status_change` (AFTER UPDATE OF `status_id`, SECURITY DEFINER, `search_path` pinned).
  - ⚠️ **Closure guard, found while extending:** account closure reuses `suspended` and suspends **before** removing memberships, with the request still `pending` (`command/lib/accountDeletion/execute.server.ts` steps 3→4). So a suspension is **not** announced while the vendor has a pending vendor-closure request; closure sends its own messages.
- `send-notification-email/types.ts`: the two types were added to the union. **No redeploy needed:** `getRenderer` falls back to the generic template for any type (checked `handler.ts`/`registry.ts`). There is no type allow-list.
- **Dry-run (not applied; one transaction, rolled back, 0 objects left):** 7/7 pass:
  1. activate → 1 "is active" notice;
  2. a non-status edit adds nothing;
  3. suspend → 1 notice;
  4. reinstate → "reinstated";
  5. a suspension during a pending closure is silent;
  6. a disabled type writes nothing;
  7. an activation refused by C1 notifies nobody.
- **Remaining:**
  - the user applies it: local `migration up` / `db reset`, staging `db push`, production `db push`. On reset the seed's activation UPDATE now leaves one "is active" notice per seeded vendor-admin, as expected.
  - live check: Command Activate → notification row + email (email on staging).
- The two "we'll email you" promises are now backed (`kyc_approved` email; `KycStatusMessage` "approved" view).
### E2 — "Review can take up to 24 hours" in the email and the vendor's KYC messages  ✅ DONE (2026-09-30)
User: "include that KYC may take 24 hours to process … short but precise." The wording counts from **submission**, because review cannot start before the documents exist:
- **Signup email** (`lib/registrationEmail.ts`): "…Next, verify your business: sign in at <url> and submit your verification documents. **Once submitted, review can take up to 24 hours.** You can use your dashboard once your business is verified and activated." The test asserts the sentence.
- **KYC form, step 1** (`KycSubmitForm.tsx`): "To use your dashboard, verify your business: tell us how you're registering, then add your documents. **Once submitted, review can take up to 24 hours.**" This is neutral for existing vendors too, so it **also resolves S3-F2**.
- **KYC form, review step:** "Submitting sends your documents to our team. **Review can take up to 24 hours** — we'll email you the result."
- **"Application under review"** (`KycStatusMessage.tsx`): "Our team is reviewing your documents. **This can take up to 24 hours** — we'll email you the result."
- **Verified:** `tsc`; eslint; `npm test` 520/520; no "isn't instant" copy left in the vendor app.
- ⏳ **Baselines `kycsubmit`, `kycstatus-review`, `kycstatus-none-suspended` (×2 themes) not yet regenerated.** The scoped run could not start because the user's own vendor dev servers were running (`:3000` and a second instance on `:3001`; Next refuses a second dev server for the same folder), and stopping a user's server needs their say. **Unblock:** the user stops them, or asks me to.
- ✅ **Baselines done 2026-09-30** (after the user stopped their dev servers): `kycsubmit`, `kycstatus-review` and `kycstatus-none-suspended` (light and dark, 6 PNGs) were regenerated with a scoped `--update-snapshots` and reviewed (the 24-hour copy renders). **Full vendor visual suite: 197/197.**
- **Not changed (outside "the vendor"):** the mobile app's `verification_in_review` copy still says "this isn't instant". Align it on request. Command's `kyc_approved` / `kyc_rejected` email copy has no review-time claim and needs none.

### N2 — `kyc_approved` / `kyc_rejected` have NEVER been sent: Command's browser insert is refused  ✅ DONE (2026-10-01) — applied locally by the user; live-verified 11/11
**Symptom (user, staging, 2026-09-30):** no `kyc_approved` email in Resend. Query: `notifications_written = 0` for type `kyc_approved`, **ever**.
**Root cause, reproduced locally 2026-09-30 in a rolled-back transaction as `jun` (Command admin, role `authenticated`):**
- `command/services/kyc-admin.service.ts:147` (`notifyVendorOfReview`, added in B-I1) inserts the notification **from the admin's browser** with the browser Supabase client.
- It can read the vendor's admins (`"command admins can read all vendor members"`, 4 rows visible), but `public.notifications` grants `authenticated` only **SELECT, UPDATE, DELETE**, and has **no INSERT policy**. Notifications are written only by SECURITY DEFINER triggers and service-role routes, by design. The insert gets `ERROR: permission denied for table notifications`.
- The `try/catch` around it logs only to the browser console (`[command/reviewKyc] failed to notify vendor of KYC review`). The review itself saves, so Approve and Reject look successful and nobody sees the failure.
- **Consequence:** no vendor has ever received a KYC-approved or KYC-rejected notification or email, in-app or by email, on any environment. It is the **only** browser-side `notifications` insert in command/vendor; the other `notifications.service.ts` calls are reads and updates on one's own rows.
- **Correction to this plan:** G4/C4 said a vendor suspended after a rejection "is told the KYC was rejected (`kyc_rejected`)". That was never true. Stage 6's live C4 check asserted the rejection **saved** but did not assert a `kyc_rejected` row. The live checks missed this because no test looked for the notification row.

**Options:**
- **(A, recommended)** **A DB trigger** on `vendor_kyc` (AFTER UPDATE OF `status`, into `approved` / `rejected`) writes the notifications, the same pattern as N1's `notify_vendor_status_change`.
  - It fires for every review path, and it works without any RLS change.
  - **Command:** remove `notifyVendorOfReview` (the broken client insert); `reviewKyc` only updates the header.
  - It does not fire on INSERT, so a header **created** as approved (the seed, or `/api/kyc/submit` creating `submitted`) notifies nobody. Neither does the vendor's own resubmit (`rejected → submitted`).
- **(B)** Move the notify into a **Command API route** with the service-role client. There is no migration, but it is more code, the browser has to call a second endpoint after the review, and any other review path is still missed.
- **(C)** Grant `insert` on `notifications` to `authenticated` with a Command-admin policy. ✖ Not recommended: it lets any Command admin's browser forge a notification, and so an email, to **any** user. That is a security widening, against the table's design.

**Draft migration for (A)** (not written; needs the user's approval of this exact SQL):
```sql
-- 2026MMDD000001_vendor_kyc_review_notifications.sql
-- Writes notifications for other users, which `authenticated` cannot do, so it is a
-- definer; search_path pinned. Reads the type switch and the vendor's admins; writes
-- only notification rows. Fires on a REVIEW (status change into approved/rejected),
-- never on INSERT, and never on the vendor's own resubmit (→ submitted).
create or replace function public.notify_vendor_kyc_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type    text;
  v_title   text;
  v_body    text;
  v_enabled boolean;
begin
  if new.status is not distinct from old.status then return new; end if;

  if new.status = 'approved' then
    v_type  := 'kyc_approved';
    v_title := 'Your documents were approved';
    v_body  := 'We''ve verified the documents you submitted. Activation is the last step — we''ll email you as soon as your account is active.';
  elsif new.status = 'rejected' then
    v_type  := 'kyc_rejected';
    v_title := 'Your documents need another look';
    v_body  := 'We couldn''t verify the documents you submitted.'
               || coalesce(' Reason: ' || nullif(btrim(new.review_notes), '') || '.', '')
               || ' Sign in to the vendor portal to see the notes and send updated documents.';
  else
    return new;
  end if;

  select is_enabled into v_enabled from public.notification_type_settings where type = v_type;
  if not coalesce(v_enabled, false) then return new; end if;

  insert into public.notifications (user_id, portal, type, title, body, data)
  select vm.user_id, 'vendor', v_type, v_title, v_body,
         jsonb_build_object('vendor_id', new.vendor_id)
  from public.vendor_members vm
  join public.roles r on r.id = vm.role_id
  where vm.vendor_id = new.vendor_id and r.name = 'vendor-admin';

  return new;
end;
$$;

comment on function public.notify_vendor_kyc_review() is
  'Notifies a vendor''s admins when Command approves or rejects its KYC packet. Replaces the browser-side insert that RLS always refused. Plan 2026-09-30 N2.';

create trigger notify_vendor_kyc_review
  after update of status on public.vendor_kyc
  for each row execute function public.notify_vendor_kyc_review();
```
**Command change (ships with it):** delete `notifyVendorOfReview` and its call in `reviewKyc` (`kyc-admin.service.ts:78-150`), and replace its comment with a pointer to the trigger. `useKycPanel` is unchanged; its success toasts stay. **Order:** the migration first, then Command. Otherwise there is a window where neither writes the row. The reverse order only means the broken insert is attempted harmlessly once more.
**Copy:** the approved body now says "we'll email you as soon as your account is active", which is true because of N1. The rejected body keeps the reason. Both go through the generic template.
**Blast radius:**
- **Data:** none. Past reviews are not back-filled: vendors already reviewed on staging and production get nothing retroactively, which the user may want to handle by hand.
- **Lock:** brief, at `create trigger`.
- **Downstream:** the Command edit above. No email-function change: the types already exist in `types.ts`, and generic rendering applies. Unit tests: none cover `notifyVendorOfReview`.
- **Reversal:** `drop trigger notify_vendor_kyc_review on public.vendor_kyc; drop function public.notify_vendor_kyc_review();`. Restoring the Command code would bring back the broken insert, so reversal means no notifications at all.

**Verification plan:**
- a rolled-back dry run: approve → 1 `kyc_approved` per admin; reject → `kyc_rejected` with the reason; the vendor's resubmit → nothing; an INSERT as approved → nothing; a disabled type → nothing; a re-review approved → rejected → `kyc_rejected`;
- then live: Command Approve/Reject → rows → emails (staging, Resend);
- **add a notification-row assertion to the live scripts**, so this class of silent failure is caught next time.

**Related open question:** a `kyc_submitted` confirmation email to the vendor (D7 = none; the user is weighing it) would be a third branch of the **same** trigger, firing on INSERT of a `submitted` header and on `rejected → submitted`, plus one new type row. If wanted, it goes in this migration.

**Decision needed:**
1. (A) trigger, (B) Command route, or (C, not recommended) grant.
2. Approve the exact SQL (for A).
3. Include `kyc_submitted` in the same migration, yes or no.
4. Back-fill: notify vendors already approved on staging and production by hand, or leave them.

**Decisions (user, 2026-10-01):** (A) trigger · SQL approved · **include `kyc_submitted`** · **no back-fill** (existing vendors left as they are).
🔄 **Executed 2026-10-01:**
- **Migration** `backbone/supabase/migrations/20261001000001_vendor_kyc_review_notifications.sql`: the approved trigger, plus the `kyc_submitted` type row and a third branch, **rejected → submitted** (the vendor's resubmit, which `resubmitKyc` flips **last**, after its documents are saved).
  - ⚠️ **Design point found while adding `kyc_submitted`:** the **first** submission's confirmation is **not** a trigger on the header INSERT. `/api/kyc/submit` inserts the header **before** the documents and deletes it if a later step fails, so an INSERT trigger would confirm submissions that were rolled back.
  - So the route writes `kyc_submitted` itself, **after** every step succeeded (`vendor/app/api/kyc/submit/route.ts`; copy in the pure `vendor/lib/kycEmail.ts`, 2 tests). This also means a header created as `approved` (the seed) notifies nobody.
- **Command:** `notifyVendorOfReview` and its call were **removed** from `services/kyc-admin.service.ts`. A comment points to the trigger and warns against bringing back a browser-side insert. `reviewKyc` now only updates the header. This also drops the file's one pre-existing lint error (an `as any` in the removed code).
- **Email function:** `kyc_submitted` was added to the `types.ts` union. No redeploy is needed (generic fallback).
- **Verified (machine):** `tsc` in vendor and Command; eslint; `npm test` vendor 522/522, Command 140/140.
- **Dry-run (not applied; rolled back, 0 objects left):** 8/8 pass:
  1. approved → submitted (an admin re-open) notifies nobody;
  2. → approved: 3 `kyc_approved` rows (one per Citywide admin);
  3. → rejected: the reason is included;
  4. rejected → submitted: 3 `kyc_submitted`;
  5. a notes-only update adds nothing;
  6. a rejection without notes omits "Reason:";
  7. a disabled type writes nothing;
  8. a header INSERTED as approved notifies nobody.
- **Remaining:**
  - the user applies the migration (local, staging, production). **Order is flexible**, because Command's old insert always failed (no duplicates are possible) and the route's `kyc_submitted` read is `maybeSingle()` (it skips if the type row is not there yet). Recommended order: migration → vendor web → Command.
  - **live check with notification-row assertions** (approve / reject / first submit / resubmit → rows + `notification_emails`), then emails in staging Resend. The live scripts gain these row assertions, so this class of silent failure is caught next time.
✅ **Live-verified 2026-10-01** (after the user applied `20261001000001` locally). Full lifecycle through the **real** vendor and Command screens, with one throwaway vendor removed afterwards (0 rows, 0 files, audit rows included). After **each** step the script asserts the exact vendor notification sequence. **11/11 pass:**
1. signup → `[vendor_registration_received]`, with the portal link and the 24-hour line;
2. first KYC submit (UI) → `+kyc_submitted` (route; "up to 24 hours"), plus Command's `vendor_pending_approval`;
3. Command **Approve** → `+kyc_approved` (the trigger; previously always refused);
4. **Activate** → `+vendor_activated` "is active";
5. reject the active vendor (with notes) → C4 prompt → Suspend → `+kyc_rejected` (reason included) `+vendor_suspended`;
6. the vendor resubmits from the suspended + resubmit editor → `+kyc_submitted` "updated documents" (trigger);
7. Approve + **Reinstate** → `+kyc_approved` `+vendor_activated` "reinstated".

Final sequence: `vendor_registration_received, kyc_submitted, kyc_approved, vendor_activated, kyc_rejected, vendor_suspended, kyc_submitted, kyc_approved, vendor_activated`.

**Email delivery is not locally verifiable:** local Supabase has **no** `edge_function_base_url` / `notification_email_secret` vault secrets, so the dispatch trigger has no URL to call and `notification_emails` stays empty (0 of 9). This is local setup (`architecture/email-setup-local-and-remote.md` Part A), not a fault. Delivery is checked on staging (Resend; mind `NOTIFICATION_EMAIL_OVERRIDE_TO`). Script: session scratchpad `n2-live.mjs`, which asserts notification rows per step and is the check whose absence let N2 ship.

---

## B. Mobile — `ezzy-vendor-mobile`

### M1 — Mirror the D1 gate; blocked copy points to the web  ✅ DONE — code (2026-09-30, Stage 4) · ⏸ device check PARKED (unblocked 2026-10-01: web live in production; code still uncommitted)
**File:** `src/services/vendor.service.ts:26` (add `vendor_kyc(status)` to the embed and `kycStatus` to the mapped type); `src/hooks/useVendorGate.ts:61-80`; `src/app/blocked.tsx` / `BlockedNotice`; `src/services/kioskAccess.service.ts:21-27` (the mobile kiosk gate: same rule)
**Fix approach:**
- `ready` requires `active && kycStatus === 'approved'`.
- There is one new blocked reason, e.g. `verification_required`, used for any active or pending vendor whose KYC is missing, submitted or rejected. Its copy says what to do and where: "Finish verifying your business at <vendor web URL>" (or "Your documents are under review").
- There is **no KYC form on mobile**. That is out of scope and not needed for the gate.
- Existing `pending_activation` copy stays for approved-but-not-active.
**Constraints:**
- Apply `ezzy-vendor-mobile/AGENTS.md` and `.claude/skills/mobile-dev/SKILL.md`. Pointing to a website for account verification is not a purchase flow, so there is no store-payments concern. Check the skill's rules on external links anyway.
- Render, hook and style separation is per the RN variant of `component-separation`. The blocked screen's logic stays in the hook.
- Update the unit tests (e.g. `vendorMapping.test.ts`) for the new field.
**Coupling:** independent of the web stages. It may ship before or after them, but **before or with C1 in production** is preferable.
✅ **Code done 2026-09-30** (committed by the user).
- `src/services/vendorMapping.ts` gains `kycStatus` on `DbVendor`, `kycStatusOf` (copied from vendor web's `lib/vendorGate.ts`; object or array), `isVendorUsable`, and `blockedReasonFor`, which gives `verification_required` for no packet or a rejected one, `verification_in_review` for a submitted one, `pending_activation` for approved but not active, then `suspended` and `no_access`. With several vendors the actionable reason wins and the old "pending over suspended" order is kept.
- `vendor.service.ts` embeds `vendor_kyc(status)`. `useVendorGate.ts` makes `usable` = active + approved.
- `BlockedNotice.tsx` has copy and icons for the two new reasons, and `pending_activation`'s copy is revised ("Your business is verified… activation is a separate step"). The existing "Open the web portal" action is the path to the KYC form.
- The mobile kiosk (`lib/kioskAccess.ts`, `kioskAccess.service.ts`) applies the same rule.
- **Verified (machine):** `tsc` clean; `expo lint` clean; `npm test` 291/291, including 6 new mapping tests and 3 new kiosk cases.
- ⏸ **Device verification PARKED (2026-09-30, user decision):** the web launch comes first, and the mobile gate only matters once the web signup and KYC flow is live. Screenshots are not possible headlessly: the app excludes the `web` platform, and no emulator was running.
  - **Unblock:** the web release is live. Then start the Android emulator, point Expo at local Supabase with env-only overrides plus `adb reverse tcp:8081`/`tcp:54321`, and screenshot the three states (verification required, in review, verified awaiting activation) in light and dark, using the same reversible levers as the vendor live checks. iOS is still unverified app-wide.

### M-F1 — Mobile vendor query reads a failed request as "no vendors"  ⬜ TODO (pre-existing; noted, Stage 4)
**File:** `ezzy-vendor-mobile/src/services/vendor.service.ts` (`if (error || !Array.isArray(data)) return []`)
A network failure shows the "No vendor access" blocked copy instead of a retry. Vendor web fixed the same class of bug on 2026-09-28 (the `unavailable` verdict). This is outside M1's scope, so it is reported and not changed.

### M-F2 — `lib/kioskAccess.ts` imports from `services/vendorMapping.ts`  ⬜ TODO (noted, low)
The pure rule lives in `services/` (with the mapping that builds `DbVendor`), so `lib/` now depends on `services/`. It is harmless because both are pure, but it inverts the usual direction. Moving the rule into `lib/` would be a small follow-up.

---

## C. Command + backbone (activation requires approved KYC)

### C1 — Migration: activation requires approved KYC  ✅ DONE (2026-09-30) — applied locally by the user; verified live
**File (new, not yet written):** `backbone/supabase/migrations/2026MMDD000001_vendor_activation_requires_kyc.sql`
**Exact change (draft for review):**
```sql
-- Activation requires an approved KYC packet (plan 2026-09-30-vendor-signup-before-kyc C1).
-- Reverses command D6/D8 ("KYC is advisory to activation"). Guards EVERY route into
-- `active`: pending→active, suspended→active (Reinstate), and INSERT as active
-- (Command's create-vendor form). A new vendor can never have a vendor_kyc row at
-- INSERT time (FK), so inserting as active is always refused.
-- No exemption for service_role / auth.uid() is null — deliberately. Seed data
-- activates vendors via UPDATE after inserting an approved header (see seed.sql).
create or replace function public.enforce_vendor_activation_requires_kyc()
returns trigger
language plpgsql
security definer                       -- read vendor_kyc regardless of the caller's RLS
set search_path = public
as $$
declare
  v_active smallint;
begin
  select id into v_active from public.statuses where name = 'active';

  if new.status_id = v_active
     and (tg_op = 'INSERT' or old.status_id is distinct from v_active)
     and not exists (
       select 1 from public.vendor_kyc k
       where k.vendor_id = new.id and k.status = 'approved'
     )
  then
    raise exception 'A vendor can only be activated after its KYC is approved.'
      using hint = 'kyc_not_approved';
  end if;

  return new;
end;
$$;

comment on function public.enforce_vendor_activation_requires_kyc() is
  'Refuses any transition into active (or insert as active) unless vendor_kyc.status = approved.';

create trigger enforce_vendor_activation_requires_kyc
  before insert or update of status_id on public.vendors
  for each row execute function public.enforce_vendor_activation_requires_kyc();
```
**Blast radius:**
- **Data:** it rewrites and validates no existing rows. Legacy active vendors without approval stay active (D9). It fires only when a statement sets `status_id`, and raises only on a transition **into** `active`, so vendor profile edits (vendor portal, Command's edit form) that leave status unchanged are unaffected.
- **Lock / performance:** `create trigger` takes a brief `SHARE ROW EXCLUSIVE` on `vendors`, which is milliseconds on this table. At runtime it costs one PK lookup on `vendor_kyc`, and only on activation.
- **Trigger order:** Postgres runs BEFORE triggers alphabetically, so this one runs before `enforce_vendor_status_transition` and `enforce_vendor_status_update_permission`. All three only raise, so the order changes which message appears, not the outcome. A non-admin still gets refused either way.
- **Downstream:** no table, column or type changes, so there are no hand-written interface updates. Command must translate the error (C2). `seed.sql` must change or `db reset` fails (I8, same batch). No app inserts vendors as `active` except Command's create form (G1) and the seed. This was checked with grep across all apps on 2026-09-30.
- **Grants:** none needed, because trigger functions are not exposed via PostgREST. There is no new table, so the `20260620000001` grant rules do not apply.
- **Reversibility:** `drop trigger enforce_vendor_activation_requires_kyc on public.vendors; drop function public.enforce_vendor_activation_requires_kyc();`, as a new migration. The applied file is never edited.
**Verification:** local `db reset` (the user runs it) succeeds with the I8 seed, plus the SQL checks listed under Verification (C1 block).
🔄 **2026-09-30.**
- **Written:** `backbone/supabase/migrations/20260930000001_vendor_activation_requires_kyc.sql`. The SQL is exactly as approved, with a header added (why, what it guards and does not, trigger order, client coupling, reversal). `backbone` is on branch `feature/kyc_revamp`. `20260922000001`/`20260927000001` exist only on `feature/booker-groundwork`, and `20260930…` sorts after both, so there is no ordering conflict on merge.
- **Dry-run (not applied):** the file was loaded with `\i` inside one transaction on local Postgres, then **rolled back**. All 9 checks passed:
  1. pending + no header → refused, `hint=kyc_not_approved`, with the exact message;
  2. pending + submitted → refused;
  3. pending + approved → activates;
  4. an active vendor's edit, or a same-status write, is not blocked, even with the packet re-rejected (G4);
  5. suspend is allowed with a rejected packet;
  6. suspended + rejected → reinstate refused;
  7. suspended + approved → reinstate allowed;
  8. insert as active → refused;
  9. a seeded vendor's edit is unaffected.
  After the rollback: 0 triggers, 0 functions, 0 test rows, and no `schema_migrations` row.
- **Applied 2026-09-30 by the user** (`supabase migration up`, then `db reset`). The migration is recorded as `20260930000001`, and the trigger is present alongside the three existing vendor triggers.
- **The seed through the trigger:** after the reset, all 3 seeded vendors are `active` + `approved`, with 3 status-log rows. The pending → approve → activate order works for real (I8).
- **Live, Command against the trigger** (11/11; throwaway vendor, and the audited rows cascaded away with it, 0 left):
  - an approved packet enables Activate;
  - a **stale card** (the packet changed to `submitted` underneath) → Activate → **the trigger refuses** → Command shows "This vendor's KYC must be approved…" and the vendor stays `pending_activation`;
  - approved → Activate succeeds through the trigger;
  - C4 below.
- **Regression with the trigger in place:** vendor web signup + KYC 23/23; dashboard, picker and kiosk 8/8.
- **Not done here:** applying C1 on **staging and production**. That is the user's, **after** Command (Stage 5) is deployed there, per the coupling.

### C2 — Command UX: block, not warn  ✅ DONE (2026-09-30, Stage 5)
**File:** `command/components/vendors/VendorsPage/useVendors.ts:103-131` (`toggleStatus`, `confirmActivate`, `commitStatus:92-98`); `components/vendors/VendorActivateConfirmModal/*`; `components/vendors/VendorCard/*` (Activate/Reinstate control); `components/vendors/VendorFormModal/{useVendorForm.ts:13, VendorFormModal.tsx:55}`; `hooks/mutations/vendors/useCreateVendor.ts`
**Fix approach:**
- **Activate / Reinstate** when `kycStatus !== 'approved'`: disable the control, with a reason tooltip ("KYC not approved" / "No KYC submitted"). The "activate anyway" confirm modal is **removed**, because it offered a choice that no longer exists. Keep the closed-on-request reinstate modal, which is a separate concern (`useVendors.ts:113-126`). A Reinstate of a closed vendor whose KYC is approved still works.
- **Create vendor:** the status select offers only `pending_activation` and defaults to it. A new vendor has no KYC yet, so `active` would always be refused.
- **Edit vendor:** if the form can change status, the same rule applies. Map the error rather than hiding the select.
- **Error mapping:** in `commitStatus` and in create/edit, a `kyc_not_approved` hint shows "This vendor's KYC must be approved before it can be activated." instead of the generic toast. This backstops races, such as the KYC being re-rejected in another tab.
**Component separation:** logic stays in `useVendors.ts` and `useVendorForm.ts`, and the card and modal stay render-only. If `VendorActivateConfirmModal` becomes unused, delete it (confirm with grep).
**Coupling:** deploy C2 **before or with** C1 on each environment. Otherwise admins see the generic "Failed to update vendor status" with no reason.
✅ **Done 2026-09-30.**
- The rule is in the pure `command/lib/vendorActivation.ts` (`activationBlockReason`, `isKycNotApprovedError`, `KYC_NOT_APPROVED_HINT`), with 4 tests.
- The card disables Activate / Reinstate for an unapproved packet. The reason is in the control's `title` **and** written below it, linked by `aria-describedby`, because a tooltip on a disabled button is unreliable and invisible on touch.
- `useVendors`:
  - `toggleStatus` blocks with the KYC check first, then gives the closure warning; the order comment was rewritten.
  - `commitStatus` and `saveVendor` map the `kyc_not_approved` hint to a specific message. The three vendor mutations now also return `hint`.
  - New `applyStatus` / `applyKycStatus` patch both the list and the open modal's snapshot.
- `VendorActivateConfirmModal` was removed: its choice no longer exists. It was moved to the session scratchpad and is recoverable from git.
- The form: **add** starts `pending_activation` with Active and Suspended locked; **edit** locks "Active", with its reason, while the packet is not approved (S5-F1).
- `visual-tests/closures.spec.ts` was revised: the old "KYC confirmation still fires" test now asserts the **block**, and a third test covers each unapproved state's reason and that approved vendors are not blocked.
- **Verified:**
  - machine: `tsc`; eslint (no new errors vs HEAD in any touched file); `next build`; `npm test` 140/140; Playwright 37/37;
  - gallery screenshots checked in light and dark;
  - **live, non-audited**, against local Supabase with a throwaway vendor and all rows removed (10/10): a submitted packet disables Activate with its reason; the edit form locks Active; approving in the panel re-enables Activate **without a reload** and removes the reason line; the edit form then unlocks Active; the add form starts pending with Active and Suspended locked; no status changed and no audit rows were written.

### C4 — Rejecting the KYC of an ACTIVE vendor prompts to suspend it (closes G4)  ✅ DONE (code 2026-09-30, Stage 5; live-verified after C1, Stage 6)
**File:** `command/components/vendors/VendorViewModal/{useKycPanel.ts:26-40, KycPanel.tsx, VendorViewModal.tsx:59}`; `hooks/mutations/vendors/useSetVendorStatus.ts`; `VendorsPage/useVendors.ts` (`refreshVendors`)
**Why:** C1 keeps "active ⇒ approved" true when a vendor enters `active`. A later rejection breaks it, and the vendor stays live in booker while unverified. This closes the hole at the one action that creates it.
**Fix approach:**
- `VendorViewModal` passes the vendor's current status, plus an `onStatusChanged` callback that reuses `refreshVendors`, to `KycPanel`.
- In `useKycPanel.handleReview`, **after** a successful reject of a vendor whose status is `active`, open a confirm: **"Also suspend <vendor>? It is live and bookable, and its documents are no longer verified."** The buttons are **Suspend** (primary) and **Keep active**. Suspend calls `setVendorStatus(id, "suspended")`, which the existing `active → suspended` transition allows. Any status written this way is recorded in `vendor_status_log` by the existing trigger.
- The rejection itself is never rolled back or blocked by this step, following the existing rule that the review is the operation and consequences are best-effort (`kyc-admin.service.ts:94-97`). If the suspend fails, show a toast saying the KYC was rejected but the vendor is **still active**. Do not report a generic failure.
- A prompt, not automatic: suspension is a consequential, visible action, and the admin may be mid-conversation with the vendor. The prompt defaults to Suspend so the safe path is one click.
- There is no prompt for pending vendors (they are not live) or for approvals.
**Component separation:** the confirm reuses the existing `DeleteConfirmModal` shape, as `VendorActivateConfirmModal` does, and stays render-only. The decision and the calls live in `useKycPanel.ts`. `KycPanel.tsx` only receives the props.
**Coupling:** needs I4/G11 in the vendor web app. Otherwise a vendor suspended here sees only "suspended" and cannot resubmit. Ship C4 with or after Stage 3.
✅ **Code done 2026-09-30.**
- `useKycPanel(vendor, onKycReviewed, onSuspended)`: after a successful **reject** of an **active** vendor it opens the prompt.
- `confirmSuspend` calls `setVendorStatus(…, "suspended")`. On failure it says "KYC rejected, but <name> is still active. Suspend it from the vendor card."
- `KycPanel` renders it with `DeleteConfirmModal` ("Also suspend <name>?", **Suspend vendor**; Cancel keeps it active). `VendorViewModal` and `VendorsPage` wire `onKycReviewed` / `onSuspended` to `applyKycStatus` / `applyStatus`.
- Gallery `vendorview` props were updated.
- **Verified:** machine (as C2); the approve half of `onKycReviewed` was verified live (see C2).
- **Not yet verified live:** reject an active vendor → prompt → Suspend. That changes vendor status, which writes `vendor_status_log` rows. For a throwaway vendor those rows cascade away when it is deleted (`vendor_status_log` has no triggers; FK `on delete cascade`, checked), but the standing rule is to ask before audited test changes (memory: test-db-mutations). **Decision (user, 2026-09-30): option B.** Run it as part of Stage 6, after C1 is applied and the local `db reset` that follows. That also exercises the suspend against the trigger, and the reset clears local data anyway.
✅ **Live-verified 2026-09-30 (Stage 6):**
- rejecting an **active** vendor's packet opens "Also suspend <name>?", and the rejection is already saved;
- **Suspend vendor** → `suspended` in the DB, with both moves in `vendor_status_log`;
- the card immediately shows **Reinstate disabled** with "Can't reinstate: KYC rejected", with no reload;
- rejecting a **non-active** vendor opens no prompt.
- Screenshot checked. Throwaway data was removed, including its audit rows (cascade).

### C3 — Command copy that states the old rule  ✅ DONE (2026-09-30, Stage 5)
**File:** `command/services/kyc-admin.service.ts:109-111` (comment: "advisory… stay independent (D6)"), `components/ui/KycBadge/KycBadge.tsx:16`, `VendorActivateConfirmModal.tsx:15-19`
Correct comments that would now mislead. Keep the history, e.g. "was advisory until 2026-09-30 (vendor-signup-before-kyc C1)". The `kyc_approved` email body ("Your account will be activated shortly") stays true.
✅ **Done 2026-09-30.** Updated, keeping the history:
- `services/kyc-admin.service.ts` (the review is no longer advisory; points to C1/C2/C4);
- `components/ui/KycBadge/KycBadge.tsx`;
- `VendorReinstateClosedModal.tsx`, which referenced the removed modal;
- `useVendors.ts` (the removed D8 confirm and the toggleStatus ordering).

`lib/constants.ts:82` ("approving a packet does not activate anyone") is still true and was left as it is.

### I8 — Seed: seeded vendors need an approved header, activated by UPDATE  ✅ DONE — file edited (2026-09-30, Stage 3); takes effect on the user's next `db reset`
**File:** `backbone/supabase/seed.sql:268` onward
Locally, 3 active vendors have no `vendor_kyc` row (read-only check, 2026-09-30: `active|<none>|3`). Under B6 they would land on the KYC form. Under C1 the seed's **insert-as-active fails outright**. Change it as follows:
1. Insert the vendors as `pending_activation`.
2. Insert an `approved` `vendor_kyc` row (with `kyc_type`) for each.
3. `update … set status_id = active`.

Step 3 passes all the status triggers (the permission guard exempts `auth.uid() is null`; C1's trigger sees the approved header), and it writes a `vendor_status_log` row per vendor with `changed_by = null`, which is harmless for seed data. **Confirmed through the C1 trigger by the user's reset on 2026-09-30.** Seeded document rows are **not** needed; the header alone satisfies the gates.
**Coupling:** same batch as C1. Also needed for B6 locally, even before C1.
✅ **Done 2026-09-30.**
- `backbone/supabase/seed.sql` Block 3 now inserts the three vendors as `v_pending`, inserts approved `vendor_kyc` headers (Citywide and Summit as `company`; Harbor, which has no accreditation no., as `individual`), then `update … set status_id = v_active`.
- **Verified:** the rewritten block was run against local Postgres **inside a transaction that was rolled back**, with the three vendor ids swapped for throwaway ones. All three ended `active` + `approved`, 3 `vendor_status_log` rows were written, and 0 rows persisted.
- **Applied 2026-09-30 by the user's local `supabase db reset`.** Result: all 3 seeded vendors are `active` + `approved` (`company`/`individual`/`company`), with 3 `vendor_status_log` rows. It has not yet been validated against C1's trigger (Stage 6), and the next reset after C1 is applied is that check.

### I7 — Documentation  ✅ DONE (2026-09-30, Stage 7)
- `architecture/vendor-kyc.md`:
  - the one-paragraph model;
  - "Why no account until KYC completes": mark superseded and keep the rationale;
  - onboarding table and "What the atomic submit route does";
  - pending-vendor surface;
  - Deferred **8a → done by C1**.
- `architecture/auth-and-roles.md:203-209` (self-registration path) and the vendor access-layer description.
- `architecture/schema.md` (migration history and the new trigger alongside the vendor status guards).
- `architecture/portals.md`: the register flow and the mobile blocked reasons.
- `ezzy-vendor-mobile` docs, if they list gate states.

✅ **Done 2026-09-30.**
- `architecture/vendor-kyc.md`: new one-paragraph model; D-7 section marked **SUPERSEDED** with the rationale kept; 2-step signup + 4-step KYC tables; the two server routes; the KYC surface (gate + view precedence + suspended notice); Command review with activation now required and the C4 prompt; services table; Deferred / done (8a and 8b closed).
- `architecture/auth-and-roles.md`: the self-registration section rewritten (signup route, first KYC submission route, who gets the dashboard, diagram).
- `architecture/schema.md`: a migration-history row for `20260930000001`; the `vendors` note; the `vendor_kyc` "created by" and RLS notes.
- `architecture/portals.md`: vendor registration flow, live-vs-mock rows, closed gaps and the new accepted ones; Command add/toggle/KYC-review bullets and table row; mobile `blocked` screen reasons.
- `ezzy-vendor-mobile`'s own docs were **not** edited: its boundary rule requires approval, and `portals.md` covers the gate states.

### S5-F1 — The Edit Vendor form was a second route to activation  ✅ DONE (found and fixed in Stage 5, 2026-09-30)
**File:** `command/components/vendors/VendorFormModal/*`, `hooks/mutations/vendors/useUpdateVendor.ts`
`updateVendor` writes `status_id` on every save, and the form's status select offered "Active" to a pending vendor. That skipped the card's KYC check entirely, and it was not listed in the plan's G1 (which covered **create**). It is now locked in the hook (`activeLock`), with the reason shown in the option text. C1 refuses it at the database regardless, and `saveVendor` maps that refusal to the KYC message.

### S5-F2 — The card's KYC status went stale after a review in the panel  ✅ DONE (found and fixed in Stage 5, 2026-09-30)
Before, approving a packet in the view modal updated only the panel's own state; the card's `kycStatus` stayed stale until a reload. That was cosmetic under the advisory rule, but under C2 it would have kept Activate **disabled** right after an approval. It is fixed by `onKycReviewed` → `applyKycStatus`, which was verified live.

### S5-F3 — Checked: closure keeps the KYC header, so Reinstate of a closed vendor still works  ✅ (no change)
`command/lib/accountDeletion/execute.server.ts:257` keeps the `vendor_kyc` header (D5). A closed vendor with an approved packet therefore passes C1/C2, and the reinstate warning is still the only thing in the way, as intended.

---

## G. Gap review (2026-09-30) — findings folded into the items above

- **G1 — Command creates vendors defaulting to `active` with no KYC** (`useCreateVendor.ts`, `useVendorForm.ts:13`). An UPDATE-only trigger would have missed this. **Fixed by:** C1 guards INSERT; C2 restricts the create form.
- **G2 — Command D6/D8 deliberately allowed "activate ahead of a packet".** This plan reverses a documented product decision, so it is recorded, not silently overridden. **Fixed by:** D8 (resolved), C2, C3, I7.
- **G3 — The seed inserts vendors as `active`,** so `db reset` would fail under C1. **Fixed by:** I8 reshaped.
- ⚠️ **Correction (2026-09-30, N2):** the "vendor is told the KYC was rejected" premise below was false. `kyc_rejected` was never written (RLS refused Command's browser insert); see N2.
- **G4 — Command can re-review a packet to `rejected` after activation** (`kyc-admin.service.ts:78-100` has no status precondition). The vendor stays `active` and bookable. **Fixed by C4** (user, 2026-09-30): the reject prompts the admin to suspend, defaulting to Suspend. There is still no automatic deactivation, so an admin who picks "Keep active" is making a deliberate, visible choice.
- **G5 — Reinstate (`suspended → active`) is also guarded.** A legacy suspended vendor without approved KYC cannot be reinstated until KYC is approved. This follows from D1 (such a vendor could not use the dashboard anyway). Surfaced for awareness in D9.
- **G6 — Error opacity.** Command's generic toast would hide the trigger's reason. **Fixed by:** C2 error mapping.
- **G7 — Mobile kiosk has its own gate** (`kioskAccess.service.ts`). **Fixed by:** included in M1.
- **G8 — The first draft allowed B2 only for `pending_activation`,** which would strand active-no-KYC vendors on a form that cannot submit. **Fixed by:** B2 accepts `pending_activation` or `active`.
- **G9 — Deployment order hazards.**
  - C1 without C2 gives opaque errors.
  - C1 without I8 breaks `db reset`.
  - B6 without B5 sends active-no-KYC vendors to a form that does not exist yet (today's infinite spinner).
  - B1 without B2/B5 strands new signups.
  - **Fixed by:** the batches in Execution order.
- **G11 — Suspended vendors could be stuck with no way to reach approval** (found while designing C4). A suspended vendor sees only the suspended copy today (`KycStatusPage.tsx:138`), and B2 as first drafted refused suspended vendors. Combined with C1 blocking Reinstate without approval, a suspended vendor with missing or rejected KYC could never get back. **Fixed by:** I4 (suspended is a notice above the KYC state) and B2 (accepts any status). Resubmit is already RLS-permitted for a suspended vendor: the policies check the *profile* (`is_active()`) and membership, not the vendor's status (`20260706000001_vendor_kyc.sql:78-83, 122`).
- **G10 — Plan wording that could permit a weak implementation, tightened:**
  - B6 now names the object-not-array embed trap.
  - B3 forbids showing the form on a read error.
  - C1 forbids a service-role exemption (it names the seed workaround instead).
  - C2 requires the reason on the disabled control, not just a disabled button.
- **Not a gap — checked:**
  - `vendors.accreditation_no` is nullable (B1).
  - Vendor profile edits do not fire C1 (`update of status_id`, transition-only).
  - No booker change is needed, because booker keys on `active`, which C1 now guarantees implies approved for all new activations.

---

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains. -->
- D1 — What unlocks the dashboard? → **Both: vendor activated by Command AND `vendor_kyc.status = 'approved'`** (resolved 2026-09-30, user). Active without approved KYC → the KYC surface (the form if there is no header). Approved but not active → the existing "awaiting activation" copy. *Plan reading:* active + `submitted` → under review; active + `rejected` → resubmit editor.
- D2 — Accept reversing D-7 (abandoned signups leave a real, unconfirmed account)? → **Accept; cleanup deferred** (resolved 2026-09-30, user).
- D3 — Post-signup landing → **straight to the KYC form, signed in; remove `reg_sent`** (resolved 2026-09-30, user).
- D4 — Which KYC form → **move register steps 3–6 as-is into `KycSubmitForm`** (resolved 2026-09-30, user).
- D5 — First KYC write path → **service-role vendor API route (B2); no RLS change** (resolved 2026-09-30, user).
- D6 — Policy consent → **at signup; not asked again at KYC** (resolved 2026-09-30, user).
- D7 — Email on first KYC submission → **none** (resolved 2026-09-30, user).
- D8 — Enforce D1 beyond the web dashboard? → **Yes: gate both vendor apps (B6, M1) AND add the activation trigger (C1) with Command UX (C2/C3). When an active vendor's KYC is rejected, prompt the admin to suspend it (C4, added 2026-09-30); no automatic deactivation** (resolved 2026-09-30, user). This reverses command D6/D8 ("KYC advisory to activation"). **The C1 SQL is approved as drafted (user, 2026-09-30).** The file is written in Stage 6 and applied by the user.
- D9 — Existing active or suspended vendors without an approved KYC → **production: no action (0 affected); staging: option A, strict, with the two adjustments below** (resolved 2026-09-30, user confirmed). Counts were run by the user on 2026-09-30 (query 1, read-only):
  - **Production: 0 affected.** 2 are `active` + `approved`, and 8 are `pending_activation` + `submitted`. The 8 pending vendors are unaffected: they already sit outside the dashboard and already have packets, so under C1 Command approves each KYC and then activates it. **No action for production.**
  - **Staging: 13 affected.** 3 are `active` + no KYC (most likely the seeded vendors, handled by I8 on the next reset), 9 are `active` + `submitted`, and 1 is `suspended` + `submitted`. 4 are `active` + `approved` and unaffected.
  - **Query 2 detail (2026-09-30):** production returned 0 rows, which confirms query 1. On staging:
    - The 3 `active` + no-KYC vendors are the seed vendors (ids `10000000-…-0001/2/3`, seed placeholder emails).
    - The other 10 were **self-registered through the real flow** between 2026-08-07 and 2026-09-18. Every one has a submitted packet and none was ever reviewed; they were activated under the old advisory rule. Several use personal email addresses, so they are real people (team members or testers), not fixtures. Emails are deliberately not copied into this plan.
  - **Proposed for staging: option A (strict), no backfill, with two adjustments:**
    1. **Before B6 or M1 reaches staging,** the user decides which of the 10 are still in active use and approves those packets in Command's KYC panel. That is the real path, and each packet exists to review. ⚠️ Each approval writes `kyc_approved`, which **emails that address** if staging email is live. The rest stay as fixtures for scenarios 8–10 (e.g. the suspended "Referred Vendor 1" for scenario 10's "suspended + submitted" case).
    2. **The 3 seed vendors** get approved headers only if staging is re-seeded (I8), which follows `architecture/database-reset-and-deploy.md` and is the user's call. Otherwise they are the "active + no KYC" fixtures for scenario 8, submitting through the new form.
  - Rejected: B (backfill approvals) and C (grandfathering), for the reasons recorded earlier.
---

## DEFERRED / COSMETIC
- **Orphaned Storage objects:** an upload without the B2 POST, and leftover `pending/` objects from the retired staging path. This is the same accepted class as today (`route.ts:29-30`).
- **Stale no-KYC signups** (D2): no automatic cleanup.
- **Unverified email at signup:** `email_confirm: true` (`route.ts:200`) is pre-existing. It matters more now that accounts persist without KYC. It is a candidate for a separate plan.
- **Automatic deactivation on re-rejection** (G4): not built, by decision. C4 prompts instead.

---

## Execution order
One stage at a time unless the user asks for a range. Stages are batches that must reach an environment together.
1. **Stage 1 — vendor web, safe now:** B3 + I4. This also fixes today's infinite spinner. ✅ **DONE 2026-09-30.** Findings S1-F1 and S1-F2 were raised.
2. **Stage 2 — vendor web server:** B1 + B2 (with the validator split) + I2. It can merge, but **not deploy**, without Stage 3. ✅ **DONE 2026-09-30** (machine-verified; live checks run with Stage 3). Findings S2-F1 to S2-F3.
3. **Stage 3 — vendor web UI + gate:** B4 + B5 + B6, together with the local part of I8 (the seed), so local testing works. **Stages 2 and 3 deploy together.** B6 needs D9 settled before it deploys to a hosted environment. ✅ **DONE 2026-09-30.** 24/24 live checks pass. Findings S3-F1 to S3-F3. Before a **staging** deploy, approve the staging packets you want kept usable (D9); the 3 staging seed vendors hit the KYC form unless staging is re-seeded.
4. **Stage 4 — mobile:** M1. It is independent of Stages 2–3; deploy it before or with Stage 6 in production. D9 applies here too. ✅ **Code DONE 2026-09-30.** ⏸ Device check parked until the web release is live. Findings M-F1 and M-F2.
5. **Stage 5 — Command:** C2 + C3 + C4. C2/C3 are safe to deploy ahead of C1, because they just disable controls the trigger would refuse anyway. C4 must not deploy before Stage 3 (the vendor web I4/G11), or a suspended vendor cannot resubmit. ✅ **DONE 2026-09-30** (C4's suspend path awaits an audited live check). Findings S5-F1 to S5-F3.
6. **Stage 6 — migration:** C1 (after the SQL is approved; written by me, **applied by the user**) + the rest of I8. The order on each environment is C2 deployed → C1 applied. ✅ **DONE 2026-09-30 (local):** applied and reset by the user; seed confirmed through the trigger; live checks 11/11 (Command) + 23/23 + 8/8 (vendor regressions). Staging and production apply remain with the user.
7. **Stage 7 — cleanup and docs:** I5, I6, I7. ✅ **DONE 2026-09-30.** I5, I6 and I7 are all done; full vendor visual suite 197/197. Finding S7-F1 (copy).

---

## Verification

**Machine-verifiable**
- `vendor`, `command`: build, `tsc --noEmit`, lint, and the existing unit tests.
- `ezzy-vendor-mobile`: `tsc`, lint, and the unit tests (`vendorMapping.test.ts` and gate tests).
- New unit tests:
  - the KYC validator;
  - B2 input rejection (foreign `vendorId`, `objectName` with `/` or `..`, empty docs, over-total, existing header);
  - the verdict mapping for every `vendors.status × vendor_kyc.status` combination (web and mobile);
  - Command's `toggleStatus` disabled or refused path.
- `grep` finds no remaining callers of `prepare`, `STAGING_PREFIX`, `reg_sent` or `VendorActivateConfirmModal`.

**C1 SQL checks** (local, after the user applies it; each in a transaction that is rolled back)
- pending + no header → `update … set status_id = active` raises `kyc_not_approved`.
- pending + `submitted` → raises. pending + `approved` → succeeds.
- suspended + `rejected` → Reinstate raises.
- `insert` with `status_id = active` → raises.
- Active vendor: update name/phone → succeeds (the trigger does not fire). Update `status_id` to the same active value → succeeds.
- `db reset` with the new seed succeeds, and the seeded vendors are active + approved.

**Needs a live environment** (local Supabase; email via `architecture/email-local-run-quickstart.md`)
1. **Signup** (steps 1–2):
   - rows: user, profile `active`, portal, vendor `pending_activation`, membership, 4 consent rows;
   - **no** `vendor_kyc`;
   - `vendor_registration_received` is emailed with the new copy and `new_user_registration` is written, but **not** `vendor_pending_approval`;
   - the browser lands on the KYC form, signed in.
2. **Reload and re-login before KYC:** the KYC form each time.
3. **First KYC submit:** the header is `submitted`, the docs and objects are under `{vendorId}/`, `accreditation_no` is set for a company, and `vendor_pending_approval` is written. The view shows "under review", read from the DB, and stays there after a reload.
4. **Tampering:** a second POST gets 409, another vendor's id is refused, un-uploaded objects are refused, and an unauthenticated POST gets 401.
5. **Read failure** on `vendor_kyc`: a retry message, not the form.
6. **Rejected → resubmit:** unchanged.
7. **Approved, not activated:** "awaiting activation". **Command activation:** disabled until approved, then allowed. The next login and a reload open the dashboard.
8. **Active + no header** (a legacy-style vendor made via SQL before C1, or the old seed): the web shows the KYC form, and submit works (G8). Mobile shows blocked with the web link. The mobile kiosk refuses.
9. **Active + re-rejected** (G4 / C4):
   - Command shows the suspend prompt.
   - **Suspend** → vendor `suspended`, a `vendor_status_log` row is written, the vendor is gone from booker, and the web shows the suspended notice **plus** the resubmit editor. After a resubmit, Command approves and Reinstate is allowed by C1 → the dashboard opens.
   - **Keep active** → the web shows the resubmit editor and mobile is blocked.
   - Simulated suspend failure → the toast says the vendor is still active.
10. **Suspended, no header:** web shows the suspended notice plus the KYC form, and submit works (B2 accepts suspended). Mobile shows the suspended copy. **Suspended + approved:** suspended copy only.
11. **Sign-in failure after signup** (simulated): the "account created — please sign in" message, then a normal sign-in reaches the KYC form.
12. **Referral deep-link signup:** the `vendor_referrals` row is still written (`visual-tests/referral-deeplink.spec.ts`).
13. **Command create vendor:** only "Pending" is offered. Forcing `active` through the API is refused by C1.

⚠️ Status flips are guarded and audited (memory: test-db-mutations). Use throwaway vendors through Command's real controls, or do SQL checks inside a rolled-back transaction. Ask before any other mutation.

---

## Release record

- **2026-10-01, production:** released by the user after staging was deployed and tested. Order:
  1. Command, so the activation controls were already blocked before the trigger landed;
  2. `db push` of `20260930000001`, `20260930000002`, `20261001000001`;
  3. vendor web, which also carried the welcome step (`.plans/2026-10-01-vendor-post-signup-welcome.md`).
- **Docs brought up to date the same day:**
  - `architecture/vendor-kyc.md`: welcome step, `kycExitFor`, and a new *Vendor notifications* table;
  - `portals.md`: registration flow, KYC review email source, gaps list;
  - `schema.md`: migration rows for N1 and N2;
  - `conventions.md`: the version badge is hidden, not masked.
- **Not part of this release:** the `ezzy-vendor-mobile` M1 build.
