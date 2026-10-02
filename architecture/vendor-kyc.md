# Vendor KYC — verification onboarding, storage & review

The vendor portal's identity/verification (KYC) subsystem: a required onboarding
stage where a new vendor picks an applicant type, uploads verification documents,
and captures a valid ID + a selfie holding it — after which Command reviews the
packet and activates the vendor. This is the platform's first real Supabase
Storage implementation.

Plans of record: `.plans/2026-07-03-vendor-kyc-storage.md` (main),
`.plans/2026-07-06-kyc-id-selfie-capture.md` (camera step),
`.plans/2026-09-30-vendor-signup-before-kyc.md` (sign up first, KYC after; activation
requires an approved packet — **supersedes the "no account until KYC" model below**).

---

## The one-paragraph model

A prospective vendor **signs up first** — business details, then account + policy
consent — which creates the account and a `pending_activation` vendor with **no KYC**.
They are signed in straight away and land on the **KYC form** (applicant type →
documents → ID + selfie → review), which they submit as the signed-in vendor. Command
admins review the packet (approve/reject with notes) inside the vendor view; a rejected
vendor revises and resubmits. The vendor portal (web and mobile) opens only when the
vendor is **active AND its KYC is approved**, and Command can activate a vendor only
once its packet is approved — enforced in the database. Files live in a **private**
`vendor-kyc` Storage bucket; access is enforced by RLS at both the table and Storage
layers.

(2026-09-30 — until then no account existed until the whole packet was submitted, and
KYC approval was advisory to activation. See the superseded section below and
`.plans/2026-09-30-vendor-signup-before-kyc.md`.)

---

## ~~Why no account until KYC completes (D-7 = D)~~ — SUPERSEDED 2026-09-30

> **Reversed** by `.plans/2026-09-30-vendor-signup-before-kyc.md` (D2): signup now
> creates the account first and KYC is submitted afterwards, signed in. The rationale
> below is kept as the record of what was traded away — an abandoned signup now leaves
> an account and a pending vendor behind (accepted), and the resume is no longer
> device-bound (the vendor simply signs in and lands on the form). The three-hop submit
> it describes was retired with the `prepare` route and the `pending/` staging prefix.

The requirement was: abandoning KYC must leave **no** auth user or vendor row
behind, while still being resumable if interrupted. These conflict with the
usual "create the account, then upload" pattern (uploads need an authenticated
`vendor_id`). The chosen reconciliation:

- **Form fields** (never the password, never files) auto-save to browser
  `localStorage` as the vendor progresses, so the form resumes on return.
- **Document upload + ID/selfie capture are the final steps**, done immediately
  before submit — nothing file-related is persisted between sessions.
- The final **Submit** is **three hops** (2026-08-08; it used to be one multipart
  POST, which Vercel's 4.5 MB request-body cap made unusable in production):
  1. `POST /api/auth/register/prepare` — validates everything, mints a signed
     upload URL per file under `pending/{submissionId}/`. Creates nothing.
  2. the browser uploads **directly to Storage** with those tokens.
  3. `POST /api/auth/register` (service role) — a few KB of JSON; atomically
     creates the account + vendor + KYC header, **moves** the staged objects to
     `{vendorId}/`, and inserts the document rows — with **rollback** on any
     failure — then the client clears the draft.

  Shared validation lives in `vendor/lib/registration.ts`; both routes call it, so
  they cannot drift. Step 3 re-validates in full — a caller can skip step 1.

Trade-off: resume is device/browser-bound (a different device or cleared cache =
start over). Cross-device resume was explicitly not worth the extra machinery.

---

## Onboarding flow (vendor portal)

**Signup** is a **2-step** flow in the vendor `LoginPage` (the same modal as sign-in):

| Step | Screen | Notes |
|------|--------|-------|
| 1 | Business details | name, year established, address (Province/City/Barangay pickers, Address Line 1, ZIP Code), division, phone, operating hours |
| 2 | Account setup | contact name, email + password, **policy consent** → **Create account** |

`POST /api/auth/register` creates the auth user (confirmed), active profile, vendor
portal grant, `pending_activation` vendor, vendor-admin membership, referral and
consent rows — **no KYC header**. The client then signs in and routes through the same
access verdict as any login, which lands the new vendor on the KYC surface. **Right
after Create account only**, that surface opens on a one-time **welcome step**
(`components/kyc/KycWelcomeStep`: "You're signed up! / Welcome to Ezzy", **Do it
later** (signs out), or **Start verification →**, which opens the form). It is carried
in React state (`useLoginPage` → `useAppShell` → `KycStatusPage`), never stored, so a
reload or a later sign-in goes straight to the form (2026-10-01,
`.plans/2026-10-01-vendor-post-signup-welcome.md`). A draft of
steps 1–2 (never the password) resumes from `localStorage`.

**KYC** is `components/kyc/KycSubmitForm`, shown by `KycStatusPage` whenever the vendor
has no packet (the former registration steps 3–6, moved unchanged in behaviour):

| Step | Screen | Notes |
|------|--------|-------|
| 1 | Applicant type | `company` or `individual`; company also enters accreditation/license no. |
| 2 | Documents | free-form: label + file per document; suggestions shown per type; ≥1 required |
| 3 | Identity | capture a **Valid ID** (rear camera) and a **Selfie with ID** (front camera) |
| 4 | Review & submit | summary → `POST /api/kyc/submit` → re-read from the DB → "under review" |

- **Applicant types.** `company` (registered business — DTI/SEC) vs `individual`
  (sole proprietor / freelancer). The type drives the **suggested** document list
  (guidance only — uploads are free-form) and whether the accreditation/license no.
  is asked (**company-only**) — enforced server-side by `vendor/lib/kycSubmission.ts`.
- **Identity step.** The two photos are captured with the device camera
  (`getUserMedia` + `<canvas>`, native — no dependency) behind an alignment
  overlay (an ID-card frame; for the selfie, a card frame plus a small
  white centre dot and two edge ticks marking where the face goes — both the dot
  and the card frame sit on the same vertical axis so every selfie lands
  face-over-card centred, which is what makes the packet quick to verify in
  Command). The overlay is a **visual guide only**: it is not burned into the
  stored image, since `captureImage` draws the raw video frame, and there is no
  face/ID detection or liveness behind it. A file-upload fallback covers a denied
  or absent camera. The photos ride the submit as two ordinary labelled
  documents, `"Valid ID"` and `"Selfie with ID"` — **no backend special-casing**
  (and no server-side check that both are present — plan S2-F3).
- **Resume.** Nothing KYC-related is persisted — files cannot be, and the two
  choices before them take seconds. A vendor who leaves simply signs in again and
  lands back on the form.

### Policy consent at signup (2026-08-19; moved to signup step 2 on 2026-09-30)

Signup step 2 (it was step 6 of the old combined flow) carries a required agreement checkbox covering the Terms of Use, Privacy
Policy, Acceptable Use Policy and Refund & Cancellation Policy — the last of these
because the vendor is the party a cancellation obligation binds.

Three things about it are load-bearing:

- **The server re-checks it.** `app/api/auth/register/route.ts` rejects a missing or
  false flag before `createUser`. The checkbox only disables a button; it stops
  nobody posting to the route directly.
- **It is never persisted to the signup draft.** Consent lives in `useLoginPage` state
  alongside the password, for the same reason: a draft resumed days later that
  restores a pre-ticked box is not consent.
- **It is recorded, not just enforced.** Four rows land in `legal_acceptances` (one
  per document), written **last** in the route — after every step that could still
  roll back. See `schema.md` for why the ordering matters.

Neither the **first KYC submission** (`KycSubmitForm` → `submitFirstKyc`) nor the
**resubmit** path (`KycStatusPage` → `resubmitKyc`) asks again: the vendor already has
an account and accepted at signup (plan D6).

### The two server routes

**`POST /api/auth/register`** (signup; service role; rollback on any failure):

1. create a confirmed auth user → `profiles` row set **active**
2. grant `vendor` portal access (`user_portals`)
3. create the `vendors` row (**pending_activation**, `accreditation_no` null)
4. link the user as `vendor-admin` (`vendor_members`)
5. referral row (if any), then the consent rows **last**
6. notify: `vendor_registration_received` to the vendor, `new_user_registration` to Command

Rollback deletes the vendor (cascades membership + referral) and the auth user.

**`POST /api/kyc/submit`** (first KYC submission; the browser has already uploaded the
files to `{vendorId}/…` with the vendor's own session):

1. verify the caller from the cookie session — portal grant, active profile,
   vendor-admin of this vendor (`assertVendorAdmin`, `requireActiveVendor: false`)
2. 409 if a `vendor_kyc` header exists (also caught as a PK race at insert)
3. verify each named object exists under `{vendorId}/`, and total the **real** sizes
4. insert the header (**submitted**) → document rows → `accreditation_no` (company),
   rolling back (delete header → cascades docs) on failure
5. notify Command (`vendor_pending_approval`)

On failure the client removes the files it uploaded, as `resubmitKyc` does.

---

## The KYC surface (vendor not yet usable)

The vendor portal opens only for a vendor that is **active AND KYC-approved**
(`vendor/lib/vendorGate.ts`, used by sign-in, session restore, the kiosk and the
vendor picker; the mobile app mirrors it). Anyone else signed in sees `KycStatusPage`
(routed by `useAppShell` via `pendingKycVendorId`), whose view is decided by
`vendor/lib/kycView.ts`:

- **no packet** → the KYC form (`KycSubmitForm`), or the welcome step first when the
  vendor has just signed up

The frame's bottom exit follows `kycExitFor` (`vendor/lib/kycView.ts`): **Do it later**
(soft blue) wherever a task is pending (no packet, rejected), **Sign Out** elsewhere,
and none on the welcome step, which has its own Do it later. Both exits sign out.
- **submitted** → "Application under review"
- **rejected** → reviewer notes + a **revise & resubmit** editor
- **approved** (not yet active) → "Documents verified — awaiting activation"
- a failed read → a retry screen — **never** the form (a read error must not look
  like "not submitted")
- **suspended** → a suspended notice; shown **above** the form or resubmit editor when
  the packet is missing or rejected (the vendor's only way back — a suspended vendor
  can submit and resubmit), and on its own otherwise

### Resubmit is a selective edit (D-8 = B)

The revise editor shows the docs already submitted; the vendor keeps or removes
each individually, adds new documents, and can re-capture the ID/selfie
(optional — the prior photos persist as existing docs). On resubmit,
`resubmitKyc`:

1. deletes removed docs — **row first (RLS-gated), then the Storage object** (so a
   mid-failure leaves at worst a harmless orphan, never a dangling row),
2. uploads + inserts the new docs (rolls back uploaded objects on insert
   failure),
3. flips the header `rejected → submitted` **last** — RLS only permits the
   deletes/inserts while the header is `rejected`.

---

## Command review (whole-packet, D-2 = B)

Command reviews inside `command/components/vendors/VendorViewModal` via a **KYC
panel** (`KycPanel.tsx` + `useKycPanel.ts`): the applicant type, the per-type
suggestions for context, the uploaded documents (each with **View** via a
short-lived signed URL), and **one packet-level action** — Approve / Reject with
notes. The action writes `status`, `review_notes`, `reviewed_by`, `reviewed_at`
to the `vendor_kyc` header; the vendor is notified **by a database trigger**, not by
Command (see *Vendor notifications* below).

**Activation requires an approved packet** (since 2026-09-30; it was advisory before):

- The vendor card's **Activate / Reinstate** is disabled, with the reason written on
  the card, until the packet is approved (`command/lib/vendorActivation.ts`); the
  create form starts vendors `pending`, and the edit form locks "Active" likewise.
- The database enforces it regardless: trigger `enforce_vendor_activation_requires_kyc`
  (`20260930000001`) refuses any move into `active` — or insert as active — without an
  approved packet, raising hint `kyc_not_approved`, which Command maps to its own
  message.
- **Rejecting the packet of an ACTIVE vendor** opens a prompt to suspend it too
  (the rejection is already saved). Not automatic — the admin may keep it active.

---

### Vendor notifications (all from the database, 2026-10-01)

Every message to the vendor about verification or account state is written by a
SECURITY DEFINER trigger or a service-role route, never by a browser. Each is a
`notifications` row that the email pipeline sends through the generic template (no
email-function redeploy needed), skipped when its type is switched off in Command:

| When | Type | Written by |
|------|------|------------|
| First KYC submission succeeds | `kyc_submitted` | `vendor/app/api/kyc/submit/route.ts`, after the whole submit succeeds (a trigger on the header INSERT would confirm rolled-back submissions) |
| Resubmission (rejected → submitted) | `kyc_submitted` | trigger `notify_vendor_kyc_review` (`20261001000001`) |
| Packet approved / rejected | `kyc_approved` / `kyc_rejected` (with the reason) | same trigger |
| Activated / reinstated | `vendor_activated` | trigger on `vendors` (`20260930000002`) |
| Suspended | `vendor_suspended` | same trigger; **not** sent while a vendor-closure request is pending (closure suspends first and sends its own messages) |

## Data model

Three tables (migration `20260706000001_vendor_kyc.sql`) + one bucket (migration
`20260706000002_vendor_kyc_storage.sql`). Full column detail lives in
`schema.md`; the shape:

- **`kyc_document_types`** — per-type **suggested** document list (guidance only;
  `applies_to` = company / individual / both). Seeded; not referenced by a FK
  (uploads carry a free-text label).
- **`vendor_kyc`** — one header row per vendor (PK `vendor_id`): `kyc_type`,
  `status` (submitted/approved/rejected), review fields, `submitted_at`. Created
  by `POST /api/kyc/submit` when the signed-in vendor submits — **no header** means
  "not submitted yet" (the vendor exists from signup; since 2026-09-30).
- **`vendor_kyc_documents`** — one row per uploaded file: free-text `label` +
  `storage_path`. Write-once (replace = delete + insert), mirroring
  `booking_documents`.

### Storage: the `vendor-kyc` bucket

- **Private** (`public = false`), 10 MB limit, `image/jpeg` / `image/png` /
  `application/pdf`.
- Path convention: **`{vendor_id}/{uuid}-{filename}`** — the first path segment
  is the vendor id, which the Storage RLS policies key on via
  `(storage.foldername(name))[1]::uuid`.
- Viewing is always through **time-limited signed URLs** (`createSignedUrl`,
  ~60 s) — never public URLs.

### Access control (RLS at two layers)

Enforced on both the tables and `storage.objects`, using the existing helpers
(`has_vendor_role(vendor_id,'vendor-admin')`, `is_portal_member('command')` +
`has_role('admin'|'root')`, `is_active()`):

- **Vendor admins** — read their own header + docs + objects; **add/remove docs
  and objects only while the header is `rejected`** (the resubmit window). This
  is why `resubmitKyc` flips the header last.
- **Command admins/root** — read all headers, docs, and objects; update the
  review fields on the header.
- Nobody else sees anything.

---

## Services

| File | Functions |
|------|-----------|
| `vendor/services/kyc.service.ts` | `signUpVendor` (→ `/api/auth/register`), `submitFirstKyc` (upload → `/api/kyc/submit`), `getMyKyc` (found / none / error), `signMyKycDocUrl`, `resubmitKyc` (selective edit); plus `KYC_SUGGESTIONS`, `KYC_ACCEPTED_MIME`, `KYC_MAX_FILE_BYTES` |
| `vendor/lib/kycSubmission.ts` · `vendor/lib/registration.ts` | pure input rules for the KYC route and for signup (unit-tested) |
| `vendor/lib/vendorGate.ts` · `vendor/lib/kycView.ts` | the dashboard rule (active AND approved) and the KYC surface's view precedence (unit-tested) |
| `command/lib/vendorActivation.ts` | why a vendor cannot be activated yet; the trigger's hint (unit-tested) |
| `command/services/kyc-admin.service.ts` | `getVendorKyc` (header + docs), `reviewKyc` (approve/reject + notes), `signKycUrl` (signed view URL) |
| `vendor/lib/kycDraft.ts` | `localStorage` **signup** draft (save/load/clear) — fields only, never password; no KYC fields since 2026-09-30 |
| `vendor/lib/captureImage.ts` | pure `<video>`-frame → JPEG `File` helper (no React) |

Types are hand-written interfaces (this repo does not use `supabase gen types`).

---

## Component conventions introduced here

- **Camera widget uses CSS Modules** (`CameraCapture.module.css`,
  `IdentityStep.module.css`) — the first CSS-Modules use in the repo, chosen for
  the overlay geometry (masked cut-out, card frames, face dot) which is awkward as
  inline styles or Tailwind arbitrary values. The `.tsx` files reference
  `styles.x` and hold no inline `style={{}}`.
- **Hook/render separation** throughout: `useCamera` owns the MediaStream
  lifecycle (opens the camera on mount, stops tracks, captures a frame, releases
  everything on teardown); `useIdentityStep` owns step state + object-URL
  lifecycle; `CameraCapture` / `IdentityStep` are pure render.
  `IdentityStep`'s footer is optional so it embeds in both the stepper
  (onboarding) and the resubmit surface.
  - ⚠️ Both halves of that sentence were **aspirational until 2026-08-15** — the
    doc described the intent, not the code. `CameraCapture` held a `useEffect`
    calling `start()`, so it was not a pure render layer, and `useCamera` could
    not always clean up (see below). Both were corrected in
    `.plans/2026-08-15-vendor-form-modals-to-radix-dialog.md` (I10, B5). Kept as a
    note because a convention doc asserting something the code does not do is
    worse than no note at all.
- **The camera is released by a run token, not just by a ref** (2026-08-15, B5).
  `start()` awaits `getUserMedia`, and the stream it returns is only stored if the
  run that requested it is still the current one. A stream that arrives after a
  teardown — or after a later `start()` superseded it — **stops itself on arrival**,
  because nothing else holds a reference to it and a `MediaStream` is not released
  by garbage collection. Before this, such a stream stayed live until the page
  reloaded, which a vendor sees as the camera indicator staying on after they
  finish KYC. `start` and `stop` are one effect for the same reason: two effects
  would let a `facingMode` change start a second camera without stopping the first.
  Regression tests: `visual-tests/pilot.spec.ts` → "KYC camera stream lifecycle".
- **`CameraCapture` is a Radix Dialog** (2026-08-15, B6), not the hand-rolled
  `<div role="dialog" aria-modal="true">` it used to be — it gains the focus trap,
  Escape handling and scroll lock that a hand-rolled dialog lacks, in line with
  `conventions.md` → Component Conventions. It keeps its CSS-Module full-bleed
  `.overlay` and needs no `Dialog.Overlay` (already opaque and full-screen) and no
  outside-click guard (nothing is outside it). ⚠️ Do not add `forceMount` or an
  open/close animation that remounts the content: the `<video>` holds a live
  `srcObject`, and remounting silently drops the stream.
- **One reusable `CameraCapture`** for both captures — overlay guide
  (`id` | `face-and-id`) and `facingMode` (`environment` | `user`) are props
  (OCP/DRY), not duplicated components.

---

## Operations

### Free tier

Files go to Supabase Storage (not Vercel). Free tier ≈ **1 GB** storage /
~5 GB egress, and projects **auto-pause after ~1 week idle** (a paused project
can't serve/sign files — just resume it). KYC docs are a few MB each, so testing
is well within limits; move to Pro before real launch.

### Wiping test files — `db reset` does NOT free Storage

`supabase db reset` and DB cascades only touch Postgres — they never delete
Storage **file blobs**. Deleting KYC rows (or a hosted reset) leaves the uploaded
files orphaned, still counting against the quota. To reclaim space, empty the
bucket explicitly:

- **Dashboard** → Storage → `vendor-kyc` → delete objects, or
- **`backbone/scripts/wipe-kyc-storage.mjs`** — empties the bucket (blobs + rows)
  via the Storage API; reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from
  env, supports `--dry-run`. See `backbone/scripts/README.md`.

Pair the script with a `db reset` (which clears the rows) so both sides end up
empty. For a fully clean **local** slate including Storage:
`supabase stop --no-backup` then `supabase start`.

---

## Deferred / done

- ~~**Hard-gate activation (D-3 = B, plan item 8a).**~~ **Done 2026-09-30** — trigger
  `enforce_vendor_activation_requires_kyc` (`20260930000001`) plus Command's UI
  (`.plans/2026-09-30-vendor-signup-before-kyc.md` C1/C2).
- ~~**KYC review → notification/email to the vendor (8b).**~~ **Done 2026-10-01** —
  trigger `notify_vendor_kyc_review` (`20261001000001`). ⚠️ Before that, Command wrote
  `kyc_approved` / `kyc_rejected` from the admin's browser, which RLS refused every time
  (`authenticated` has no INSERT on `notifications`), so **no review email was ever
  sent**; the browser insert was removed. Not back-filled.
- **Still open:** no automatic deactivation when an active vendor's packet is
  re-rejected (Command prompts instead — by decision); no cleanup of stale signups
  that never submitted KYC; signup does not verify the email address
  (`email_confirm: true`); orphaned objects if a vendor uploads and never completes the
  POST. See the plan's DEFERRED list.

---

## Related docs

- `schema.md` — full column definitions for the three KYC tables + the bucket.
- `auth-and-roles.md` — the vendor self-registration lifecycle (now KYC-gated).
- `email-notifications-guide.md` — the pipeline 8b would reuse.
- `backbone/scripts/README.md` — the Storage wipe script.
