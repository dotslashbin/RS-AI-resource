# Vendor KYC — verification onboarding, storage & review

The vendor portal's identity/verification (KYC) subsystem: a required onboarding
stage where a new vendor picks an applicant type, uploads verification documents,
and captures a valid ID + a selfie holding it — after which Command reviews the
packet and activates the vendor. This is the platform's first real Supabase
Storage implementation.

Plans of record: `.plans/2026-07-03-vendor-kyc-storage.md` (main),
`.plans/2026-07-06-kyc-id-selfie-capture.md` (camera step).

---

## The one-paragraph model

A prospective vendor completes a multi-step registration form, then a KYC stage
(applicant type → documents → ID + selfie). **No account or vendor record exists
until the whole thing is submitted** — the form fields live in browser
`localStorage` and the files are held in memory, and a single server route
atomically creates everything at the end. Command admins then review the document
packet (approve/reject with notes) inside the existing vendor view; a rejected
vendor revises and resubmits. Files live in a **private** `vendor-kyc` Storage
bucket; access is enforced by RLS at both the table and Storage layers.

---

## Why no account until KYC completes (D-7 = D)

The requirement was: abandoning KYC must leave **no** auth user or vendor row
behind, while still being resumable if interrupted. These conflict with the
usual "create the account, then upload" pattern (uploads need an authenticated
`vendor_id`). The chosen reconciliation:

- **Form fields** (never the password, never files) auto-save to browser
  `localStorage` as the vendor progresses, so the form resumes on return.
- **Document upload + ID/selfie capture are the final steps**, done immediately
  before submit — nothing file-related is persisted between sessions.
- The final **Submit** posts the form + files to **one server route**
  (`vendor/app/api/auth/register/route.ts`, service role) that atomically
  creates the account + vendor + KYC header, uploads the files, and inserts the
  document rows — with **rollback** on any failure — then clears the draft.

Trade-off: resume is device/browser-bound (a different device or cleared cache =
start over). Cross-device resume was explicitly not worth the extra machinery.

---

## Onboarding flow (vendor portal)

Registration is a **6-step** flow in the vendor `LoginPage` (the same modal as
sign-in; the left info panel / mobile toggle behaviour is unchanged):

| Step | Screen | Notes |
|------|--------|-------|
| 1 | Business details | name, year established, address, phone, operating hours |
| 2 | Account setup | email + password — **validated only, no account created** |
| 3 | Applicant type | `company` or `individual` (see below); company also enters accreditation/license no. |
| 4 | Documents | free-form: label + file per document; suggestions shown per type; ≥1 required |
| 5 | Identity | capture a **Valid ID** (rear camera) and a **Selfie with ID** (front camera) |
| 6 | Review & submit | summary → atomic submit → "pending review" |

- **Applicant types.** `company` (registered business — DTI/SEC) vs `individual`
  (sole proprietor / freelancer). The type drives the **suggested** document
  list (guidance only — uploads are free-form) and whether the
  **accreditation/license no.** field is asked (**company-only**; see
  `.plans/2026-07-06-accreditation-company-only.md`, enforced in the atomic
  route: company → accreditation required).
- **Identity step.** The two photos are captured with the device camera
  (`getUserMedia` + `<canvas>`, native — no dependency) behind an alignment
  overlay (an ID-card frame; a face oval + card frame for the selfie), with a
  file-upload fallback if the camera is denied/absent. They ride the submit as
  two ordinary labelled documents, `"Valid ID"` and `"Selfie with ID"` — **no
  backend special-casing.**
- **Resume.** Form fields restore from `localStorage`; because upload/capture are
  last, an interrupted vendor resumes at the pre-upload step and re-selects files
  (a cross-session resume lands at step 2 to re-enter the password, which is
  never persisted).

### What the atomic submit route does

`POST /api/auth/register` (multipart: fields + `kycType` + `docLabels` JSON +
files) runs, in order, with rollback on any failure:

1. create a confirmed auth user → `profiles` row set **active**
2. grant `vendor` portal access (`user_portals`)
3. create the `vendors` row (**pending_activation**)
4. link the user as `vendor-admin` (`vendor_members`)
5. create the `vendor_kyc` header (**submitted**)
6. upload each file to `vendor-kyc/{vendor_id}/…` and insert a
   `vendor_kyc_documents` row per file
7. fire Command notifications (`vendor_pending_approval` + `new_user_registration`)

Rollback removes uploaded objects, deletes the vendor (cascades), and deletes the
auth user — so a failure leaves nothing behind. (This replaced the old
pre-KYC register route, which created everything up-front on the form submit.)

---

## Pending-vendor surface (post-submit)

A logged-in vendor whose vendor is still pending sees `KycStatusPage` instead of
the app (routed by `useAppShell` via `pendingKycVendorId`):

- **submitted** → "Application under review"
- **approved** → "Documents verified — awaiting activation" (Command still flips
  the vendor active; KYC approval is advisory, not a hard gate — see Deferred)
- **rejected** → reviewer notes + a **revise & resubmit** editor

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
to the `vendor_kyc` header. Command then uses the existing activate control at its
discretion.

---

## Data model

Three tables (migration `20260706000001_vendor_kyc.sql`) + one bucket (migration
`20260706000002_vendor_kyc_storage.sql`). Full column detail lives in
`schema.md`; the shape:

- **`kyc_document_types`** — per-type **suggested** document list (guidance only;
  `applies_to` = company / individual / both). Seeded; not referenced by a FK
  (uploads carry a free-text label).
- **`vendor_kyc`** — one header row per vendor (PK `vendor_id`): `kyc_type`,
  `status` (submitted/approved/rejected), review fields, `submitted_at`. Created
  by the atomic route at submission time — there is **no** pre-submission
  server-side state.
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
| `vendor/services/kyc.service.ts` | `submitKyc` (→ atomic route), `getMyKyc` (header + docs), `signMyKycDocUrl`, `resubmitKyc` (selective edit); plus `KYC_SUGGESTIONS`, `KYC_ACCEPTED_MIME`, `KYC_MAX_FILE_BYTES` |
| `command/services/kyc-admin.service.ts` | `getVendorKyc` (header + docs), `reviewKyc` (approve/reject + notes), `signKycUrl` (signed view URL) |
| `vendor/lib/kycDraft.ts` | `localStorage` draft (save/load/clear) — fields only, never password/files |
| `vendor/lib/captureImage.ts` | pure `<video>`-frame → JPEG `File` helper (no React) |

Types are hand-written interfaces (this repo does not use `supabase gen types`).

---

## Component conventions introduced here

- **Camera widget uses CSS Modules** (`CameraCapture.module.css`,
  `IdentityStep.module.css`) — the first CSS-Modules use in the repo, chosen for
  the overlay geometry (masked cut-out, oval/card frames) which is awkward as
  inline styles or Tailwind arbitrary values. The `.tsx` files reference
  `styles.x` and hold no inline `style={{}}`.
- **Hook/render separation** throughout: `useCamera` owns the MediaStream
  lifecycle (starts/stops tracks, captures a frame, always cleans up on unmount);
  `useIdentityStep` owns step state + object-URL lifecycle; `CameraCapture` /
  `IdentityStep` are pure render. `IdentityStep`'s footer is optional so it embeds
  in both the stepper (onboarding) and the resubmit surface.
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

## Deferred (known future work)

Both are intentionally parked, not accidental gaps:

- **Hard-gate activation (D-3 = B).** Today KYC approval is *advisory* — Command
  can activate a vendor whose KYC is still `submitted`/`rejected`. A migration
  trigger on `vendors` status (rejecting `pending → active` unless
  `vendor_kyc.status = 'approved'`) is deferred. Plan item **8a**.
- **KYC review → notification/email to the vendor.** A vendor learns of
  approve/reject only on next login — no in-app notification or email. Deferred:
  seed `kyc_approved`/`kyc_rejected` types + a trigger on `vendor_kyc` status that
  inserts a `notifications` row (which then rides the existing email pipeline
  automatically — see `email-notifications-guide.md`). Plan item **8b**.

---

## Related docs

- `schema.md` — full column definitions for the three KYC tables + the bucket.
- `auth-and-roles.md` — the vendor self-registration lifecycle (now KYC-gated).
- `email-notifications-guide.md` — the pipeline 8b would reuse.
- `backbone/scripts/README.md` — the Storage wipe script.
