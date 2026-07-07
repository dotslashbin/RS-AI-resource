# Vendor KYC — document storage, upload & review

**Date:** 2026-07-03
**Scope:** `backbone/supabase` (Storage bucket + migrations), `vendor` (upload UI), `command` (review UI). First real Supabase Storage implementation in the project.
**Status:** DRAFT — for review; resolve decisions, then approve schema before execution.

> One-line framing: let vendors upload KYC/verification documents to a **private** Supabase Storage bucket, and let Command admins review (approve/reject) them as part of the existing vendor-approval flow. Optimize for: security (private files, strict RLS), and reusing the vendor status/approval model already in place.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** D# = Decision, S# = Schema change (approval gate). Numbers are plan-local.

---

## Goal & scope

**In scope**
- A **private** Storage bucket for vendor KYC files (never public).
- **Two applicant types — `company` and `individual`** — each with its **own suggested document list** (guidance); the vendor's chosen type determines which suggestions are shown. Uploads are **free-form** (vendor labels each document); submit requires **at least one document** (D-1).
- Vendors upload KYC documents from the vendor app; after submission they see the **overall KYC status** (+ reviewer notes on rejection).
- Command admins view each file (signed URLs) and **approve/reject the KYC submission as a whole** with notes, inside the existing vendor review flow (D-2).
- Strict access control: a vendor sees only its own docs; Command admins see all; nobody else.
- **Vendor app only.** KYC is a **required onboarding stage that runs after the sign-up forms** — the vendor must complete it (pick a type + submit at least one document) before onboarding is considered complete.
- **Resumable:** if the vendor is interrupted mid-KYC, they resume where they left off on next login — progress is persisted server-side, nothing is lost.

**Out of scope (this phase)**
- Automated/third-party identity verification (OCR, government API checks) — review is manual.
- Hard-gating vendor activation on KYC (advisory this phase — see D-3).
- Wiring booker **booking-document** upload (shares the same storage foundation — noted as a fast follow, not built here).
- Document expiry/renewal reminders.

---

## Open decisions (resolve before execution)

### D-1 — Document set: fixed lookup vs free-form  ✅ RESOLVED (2026-07-06) → **B, free-form + guidance**
- ~~A: fixed set, one upload slot per required type, enforceable completeness.~~
- **B (chosen): free-form label per upload** — the vendor adds any number of documents and names each one. The per-type document list (`kyc_document_types` with `applies_to`) is kept but demoted to **guidance only** ("Suggested: …" shown for the chosen applicant type). Completeness is **not** enforced per document — **submit requires at least one uploaded document**.
- Consequence: `vendor_kyc_documents.doc_type` FK is replaced by a free-text **`label`**; the "required set" language elsewhere in this plan reads as "suggested list". *(User confirmed via the UI-mockup question, aware that per-doc enforcement is lost.)*

### D-2 — Review granularity  ✅ RESOLVED (2026-07-06) → **B, per-vendor (whole packet)**
- ~~A: per-document status + notes.~~
- **B (chosen): one KYC status for the whole submission** — Command approves/rejects the packet with notes; on rejection the vendor revises (re-upload/add/remove docs) and **resubmits the whole packet**.
- Consequence: the review fields (`status`, `review_notes`, `reviewed_by`, `reviewed_at`) live on the **`vendor_kyc` header** (D-6 = B), not on each document row — pairs naturally with D-1 = B (free-form docs have no fixed identity to review individually).

### D-3 — Does KYC gate vendor activation?  ✅ RESOLVED (2026-07-06) → A (advisory)
> Note: KYC **submission** is now a firm onboarding requirement — the vendor must submit all required docs to finish onboarding (see "Onboarding flow & gating"). **D-3 is only about whether Command _approval_ additionally _hard-gates activation_** (`status_id`→active), which is separate from the submission requirement.
- **A (recommended now): advisory.** Command reviews KYC docs in the vendor view, then uses the **existing** activate control (`vendors.status_id` pending→active) at their discretion. No new hard gate.
- **B: hard gate.** A vendor can't be activated until the KYC packet is `approved` (`vendor_kyc.status`, enforced by a trigger on `vendors` status transition).

**Recommendation: A now, B later.** A ships value without changing the approval trigger; B is a clean follow-up once the doc set is settled.

### D-4 — Upload mechanism  ✅ RESOLVED (2026-07-06) → B (server-mediated route)  *(forced by D-7 — no vendor session during onboarding)*
- **A (recommended): client-side upload + Storage RLS.** Vendor app calls `supabase.storage.from('vendor-kyc').upload(path, file)` as the authenticated vendor-admin; Storage RLS enforces that the path's `vendor_id` belongs to them. Then insert a `vendor_kyc_documents` row.
- **B: server-side route (service role).** An API route validates + uploads with the service key. More control, more code, and bypasses RLS (must re-check auth in the route).

**Recommendation: A** — standard Supabase pattern; RLS is the enforcement, no extra server surface.

### D-5 — Bucket provisioning  ✅ RESOLVED (2026-07-06) → A (migration)
- **A (recommended): migration** — `insert into storage.buckets …` + `storage.objects` RLS policies in a migration. Reproducible (applies via `db reset` locally and the GitHub integration / `db push` on hosted), matches "schema via migrations."
- **B: dashboard / `config.toml`** — click-ops; drifts from migrations.

**Recommendation: A.**

### D-6 — Company vs individual: where the applicant type lives  ✅ RESOLVED (2026-07-06) → **B, `vendor_kyc` header row**
KYC is split into **company** and **individual**, each with its own **suggested** doc list (`kyc_document_types.applies_to`).
- ~~A: `kyc_type` column on `vendors`.~~
- **B (chosen): a `vendor_kyc` header row** — `vendor_id` PK, `kyc_type`, `status` (`submitted`/`approved`/`rejected`), review fields (per D-2 = B: `review_notes`, `reviewed_by`, `reviewed_at`), `submitted_at`. Home for the type **and** the whole-packet review state; keeps `vendors` clean. `vendor_kyc_documents` rows hang off it.
- Note: with D-7 = D (no account until completion), the header row is **created at submission time** by the atomic submit route — there's no server-side `not_started`/`in_progress` state (pre-submission progress lives in the browser draft).

> The vendor **picks their type once** (company/individual) when starting KYC; the app then shows that type's **suggested** documents. Command sees the type + the suggestions alongside what was actually uploaded.

### D-7 — When is the vendor account created? (no account until KYC complete)  ✅ RESOLVED (2026-07-06) → D (client draft + files-last + atomic submit)
**Requirement:** no vendor auth account / vendor record until KYC is completed. This conflicts with **resumability** and with the client-side upload design (upload needs an authed `vendor_id`). Options:
- **A — Atomic at the end (low complexity):** sign-up data + type + files held **client-side**; the final **Submit** creates account + vendor and uploads all files server-side (service role) in one shot. *No account until complete ✅; not resumable across leaving the app ✖.*
- **B — Pre-account draft (satisfies both; high complexity):** persist a **registration draft** (form + `kyc_type` + temp-uploaded file refs) under a token — **no account/vendor yet**; files upload via a **server route / signed upload URL** into a temp area; on completion a server step **promotes** the draft → creates account + vendor + attaches docs. *No account until complete ✅; resumable via email + resume link ✅.*
- **C — Provisional account + auto-cleanup:** create the account immediately, flag incomplete, delete abandoned ones later. *Resumable ✅ but **creates an account** → fails the requirement.*
- **D — Client draft (localStorage) + files-last + atomic submit (RECOMMENDED — the sweet spot):** persist only the **form fields** (NOT files, **NOT the password**) to **browser localStorage** as the vendor progresses, so the *form* resumes on return. Make **document upload the final step**, done immediately before submission — so nothing file-related needs persisting (interrupted earlier → resume at the pre-upload step from localStorage; interrupted at upload → just re-select). The **final Submit** posts form + files to **one server route (service role)** that atomically creates account + vendor + uploads files + inserts KYC rows (with **rollback** on failure), then clears the draft. *No account until complete ✅; practical resume ✅; no held files ✅; far less machinery than B.*
  - Caveats: resume is **device/browser-bound** (not cross-device like B); **never store the password/PII** in localStorage; atomic submit needs **rollback** (delete created user/vendor on later failure — the existing register route already does this); uploads are **server-side at submit** (multipart route).

**Recommendation: D** — meets "no account until complete" + practical resume with the least machinery. Choose **B** only if you need **cross-device / cross-browser** resume; **A** is D without the localStorage draft; **C** is out.
**Couples to D-4:** in D (and A/B), there's no vendor session during KYC, so uploads are **server-mediated** (D-4 = B / a server route), not client-side RLS.

---

## Architecture

- **Bucket:** `vendor-kyc`, **private** (`public = false`). Object path convention: **`{vendor_id}/{kyc_doc_id}-{filename}`** so the first path segment is the vendor id — Storage RLS keys off it.
- **Tables:** `vendor_kyc` (header — applicant type + whole-packet review state, D-2/D-6 = B) and `vendor_kyc_documents` (one row per uploaded file: free-text `label` + `storage_path`; mirrors the existing `booking_documents` pattern). Files live in Storage; rows are metadata.
- **Access:** all enforced by RLS at two layers — the **table** (`vendor_kyc_documents`) and **Storage** (`storage.objects`), using the existing helpers `has_vendor_role(vendor_id,'vendor-admin')`, `is_portal_member('command')` + `has_role('admin'|'root')`, `is_active()`.
- **Viewing:** Command reads via **signed URLs** (`createSignedUrl`, time-limited) — never public URLs.
- **Flow:** vendor submits (docs + header `submitted`) → Command reviews the packet in `VendorViewModal` → approve/reject + notes on the header → vendor sees the outcome; on rejection, revises documents and resubmits the packet.

---

## Onboarding flow & gating (vendor app)

**Hard requirement:** the vendor **account is NOT created unless KYC is completed** — abandoning KYC leaves **no** auth account / vendor record behind. KYC is a mandatory stage **after** the sign-up forms and must be **resumable** if interrupted. *(These goals conflict with each other and with the upload design — see **D-7** for the reconciliation and chosen approach.)*

**As-is today (for contrast — this changes):** `/api/auth/register` creates **everything up-front** on form submit (auth user, active profile, vendor-portal access, pending vendor row, vendor-admin link, + Command notifications), then shows a "registration submitted" screen; the vendor is locked out until a Command admin activates. **Target:** move account/vendor creation to **after KYC completion**.

**Target flow (D-7 = D leaning):**
1. **Sign-up forms** — vendor fills the multi-step form (business name, accreditation, address, contact, email, password). Fields (minus the **password**) auto-save to **browser localStorage** so the flow resumes; *no account yet*.
2. **KYC (required)** — pick applicant type (D-6). The applicant type + form entries stay in the localStorage draft. **Document upload is the FINAL sub-step**, done right before submit — nothing file-related is persisted between sessions.
3. **Complete** — the final **Submit** posts form + files to **one server route (service role)** that atomically **creates the account + vendor, uploads the files, inserts the KYC rows** (rollback on failure), clears the localStorage draft, fires the Command notifications (`vendor_pending_approval` / `new_user_registration` — moved here from the old register route), and shows **"pending review."**

**Gating.** Accounts exist only post-completion, so the logged-in vendor gate handles just **pending + submitted → "pending review"** and **active → full app**. The forms + KYC run in the **pre-account onboarding surface** (no session), not the logged-in app. *(Verify current `registerVendor` + pending-gate behaviour at execution.)*

**Resumability** — form fields restore from **localStorage** (device/browser-bound: cleared cache or a different device = start over). Files aren't persisted; because upload is the last step, an interrupted vendor resumes at the pre-upload step and re-selects. No account exists until the final submit. *(See D-7 for the full option comparison.)*

---

## Schema changes (drafts — approval gate; do not create migrations until approved)

> New tables MUST include explicit API-role grants (see `20260620000001_api_role_grants.sql`). Proposed file: `backbone/supabase/migrations/2026XXXX000001_vendor_kyc.sql` (+ a storage-policies migration if kept separate).

### S1 — `kyc_document_types` **guidance** list (D-1 = B: suggestions only, not enforced)  ⬜ TODO
```sql
create table public.kyc_document_types (
  code        text primary key,          -- e.g. 'business_permit'
  label       text not null,
  description text not null default '',
  applies_to  text not null default 'both' check (applies_to in ('company','individual','both')),  -- company/individual split
  sort_order  smallint not null default 0
);
alter table public.kyc_document_types enable row level security;
create policy "authenticated read kyc_document_types" on public.kyc_document_types
  for select to authenticated using (true);
-- command admins manage the suggestions
create policy "command admins write kyc_document_types" on public.kyc_document_types
  for all to authenticated
  using      (public.is_portal_member('command') and (public.has_role('admin') or public.has_role('root')))
  with check (public.is_portal_member('command') and (public.has_role('admin') or public.has_role('root')));
grant select on public.kyc_document_types to authenticated;
grant select, insert, update, delete on public.kyc_document_types to service_role;
-- Illustrative seed (tune at execution). Suggestions shown per vendor = applies_to in (vendor kyc_type, 'both').
-- NOTE (D-1 = B): guidance only — vendor_kyc_documents does NOT reference this table; uploads carry a free-text label.
insert into public.kyc_document_types (code, label, applies_to, sort_order) values
  ('business_permit', 'Business Permit',              'company',    1),
  ('registration',    'DTI / SEC Registration',       'company',    2),
  ('authorized_rep_id','Authorized Representative ID', 'company',    3),
  ('government_id',    'Government-issued ID',          'individual', 1),
  ('selfie_with_id',  'Selfie with ID',                'individual', 2),
  ('proof_of_address','Proof of Address',              'both',       4);
```

### S1b — `vendor_kyc` header (D-6 = B; carries the whole-packet review state per D-2 = B)  ⬜ TODO
```sql
create table public.vendor_kyc (
  vendor_id    uuid primary key references public.vendors(id) on delete cascade,
  kyc_type     text not null check (kyc_type in ('company','individual')),
  status       text not null default 'submitted' check (status in ('submitted','approved','rejected')),
  review_notes text,
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  submitted_at timestamptz not null default now()
);
-- Created BY THE ATOMIC SUBMIT ROUTE (D-7 = D) — no pre-submission server state exists.
-- RLS: vendor-admins read own header (see status/notes) + resubmit; command admins read all + update review fields.
-- Grants per api_role_grants pattern. (Full RLS drafted at the backend step.)
```

### S2 — `vendor_kyc_documents` (file metadata only — review state lives on the header, D-2 = B)  ⬜ TODO
```sql
create table public.vendor_kyc_documents (
  id           uuid        primary key default gen_random_uuid(),
  vendor_id    uuid        not null references public.vendor_kyc(vendor_id) on delete cascade,
  label        text        not null,   -- free-form, vendor-provided (D-1 = B)
  storage_path text        not null,
  uploaded_at  timestamptz not null default now()
);
create index vendor_kyc_documents_vendor_id_idx on public.vendor_kyc_documents (vendor_id);

alter table public.vendor_kyc_documents enable row level security;

-- Vendor admins: read their own vendor's docs; add/remove docs when revising a rejected packet.
create policy "vendor admins read own kyc docs" on public.vendor_kyc_documents for select
  to authenticated using (public.is_active() and public.has_vendor_role(vendor_id,'vendor-admin'));
create policy "vendor admins insert own kyc docs" on public.vendor_kyc_documents for insert
  to authenticated with check (public.is_active() and public.has_vendor_role(vendor_id,'vendor-admin'));
create policy "vendor admins delete own kyc docs" on public.vendor_kyc_documents for delete
  to authenticated using (public.is_active() and public.has_vendor_role(vendor_id,'vendor-admin'));

-- Command admins: read all (review actions happen on the vendor_kyc header, not here).
create policy "command admins read all kyc docs" on public.vendor_kyc_documents for select
  to authenticated using (public.is_portal_member('command') and (public.has_role('admin') or public.has_role('root')));

grant select, insert, delete on public.vendor_kyc_documents to authenticated;  -- no UPDATE: rows are write-once (replace = delete + insert), matching booking_documents
grant select, insert, update, delete on public.vendor_kyc_documents to service_role;
```
> **Review notes for the backend step:** (1) initial insert happens via the **service-role atomic submit route** (D-7 = D), so the authenticated INSERT/DELETE policies matter for the **revise-after-rejection** flow (the vendor is logged in then); consider restricting them to when the header `status = 'rejected'`. (2) Confirm whether deleting a row should also delete the Storage object (app-level cleanup).

### S3 — Storage bucket + `storage.objects` policies (D-5 = A)  ⬜ TODO
```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vendor-kyc','vendor-kyc', false, 10485760,
        array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

-- Path = '{vendor_id}/...' → (storage.foldername(name))[1] is the vendor_id.
create policy "kyc vendor admin upload" on storage.objects for insert to authenticated
  with check (bucket_id='vendor-kyc' and public.is_active()
             and public.has_vendor_role((storage.foldername(name))[1]::uuid,'vendor-admin'));
create policy "kyc vendor admin read" on storage.objects for select to authenticated
  using (bucket_id='vendor-kyc' and public.has_vendor_role((storage.foldername(name))[1]::uuid,'vendor-admin'));
create policy "kyc vendor admin delete" on storage.objects for delete to authenticated
  using (bucket_id='vendor-kyc' and public.has_vendor_role((storage.foldername(name))[1]::uuid,'vendor-admin'));
create policy "kyc command admin read" on storage.objects for select to authenticated
  using (bucket_id='vendor-kyc' and public.is_portal_member('command')
         and (public.has_role('admin') or public.has_role('root')));
```
**Blast radius:** new bucket + table(s), no existing data touched. `storage.objects` policies are additive (scoped to `bucket_id='vendor-kyc'`), won't affect other buckets. **Verify at execution:** creating `storage.objects` policies requires owner rights — fine in a migration; confirm it applies cleanly on hosted via the GitHub integration.

### S4 — (Optional, D-3 = B) hard-gate activation  ⏸ deferred
A trigger on `vendors` status pending→active that rejects unless `vendor_kyc.status = 'approved'`. Deferred to a follow-up.

### S5 — Types  ✖ N/A
Hand-write `KycDocumentType` / `VendorKycDocument` interfaces in the vendor + command services (this repo doesn't use generated types).

---

## App changes

### Vendor app — onboarding + KYC UI (D-1 = B free-form; D-7 = D client draft)
- KYC lives in the **pre-account onboarding surface** (extends the registration flow), not the logged-in app.
- **Step: pick applicant type** — `company` or `individual` (held in the localStorage draft until submit). The UI then shows that type's **suggested** documents (`applies_to in (type,'both')`) as guidance text.
- **Documents step (final, free-form):** "＋ Add document" rows — each row = a vendor-typed **label** + file picker (client-side mime/size validation). **Submit enables at ≥ 1 document.** Files are held in memory only (files-last, D-7 = D).
- **Submit** posts form + type + files to the atomic server route; then shows **"pending review."** After rejection (logged in): show `review_notes`, allow add/remove/re-upload, **Resubmit**.
- `vendor/services/kyc.service.ts` (real impl at backend step; mocked first): `getKycSuggestions(type)`, `submitKyc(form, type, files)` → the atomic route; post-account: `getMyKyc(vendorId)`, `resubmitKyc(vendorId, changes)`.
- Component/hook separation: `.tsx` pure render + `useKycSection.ts`; localStorage draft util (fields minus password).
- **Onboarding wiring (see "Onboarding flow & gating"):** registration no longer creates the account — the sign-up form flows into KYC; the vendor auth gate routes **pending + submitted → "pending review"**, **rejected → revise view**, **active → full app**. Touches `useLoginPage` (register handoff) + `useAppShell`/`AppShell` (gating).

### Command app — review UI (D-2 = B whole-packet)
- Extend `command/components/vendors/VendorViewModal` with a **KYC** panel: the vendor's **applicant type**, the suggested list for that type (context), the **uploaded documents** (label + **View** via signed URL), and **one packet-level action**: **Approve** / **Reject** with notes (writes to the `vendor_kyc` header).
- New `command/services/kyc-admin.service.ts`: `getVendorKyc(vendorId)` (header + docs), `reviewKyc(vendorId, status, notes)` (sets header `status`, `review_notes`, `reviewed_by`, `reviewed_at`), `signKycUrl(storagePath)`.
- Optional: a KYC status badge (`submitted`/`approved`/`rejected`) on `VendorCard` / in the modal to guide the existing activate decision (D-3 = A).

### Notifications (reuse existing system)
- Optional: emit notifications on review (e.g. `kyc_approved` / `kyc_rejected` to vendor admins) via the existing notification pipeline — a **follow-up**, not required for v1. If added, it's new notification types + app-layer writes (same pattern as the email work).

---

## Free-tier / cost note
Files go to **Supabase Storage** (private bucket), not Vercel. Free tier ≈ **1 GB** storage / ~5 GB egress and **auto-pauses when idle** — fine to build & pilot KYC (docs are a few MB each); move to **Pro** before real launch (mainly for no-auto-pause + egress). See `architecture/email-notifications-guide.md` note on free-tier limits.

---

## Execution order — FRONTEND FIRST
> **Decision: build the KYC frontend before the backend.** Implement the KYC pages/flow in the vendor app (and the command review UI) against a **mock/stub data layer** first — validate the UX and the onboarding sequence — *then* build the backend (storage, schema, RLS, account-creation/promotion). This lets the backend architecture decisions (esp. D-7) be settled after we've seen the flow, without blocking UI work.

1. ✅ UI-driving decisions resolved (2026-07-06): **D-1 = B** (free-form + guidance), **D-2 = B** (whole-packet review), **D-6 = B** (`vendor_kyc` header). Backend ones (**D-3, D-4, D-5, D-7** — D-7 leaning D) lock at step 4.
2. 🔄 **Frontend — vendor onboarding + KYC pages** (against mock data, D-7 = D):
   - **2a ✅ DONE (2026-07-06) — pre-account onboarding flow, `tsc` clean.** Registration extended to **5 steps in the same modal** (left info panel + mobile toggle untouched): 1 business details → 2 account setup (validates only — **no account created**) → 3 applicant-type picker (company/individual cards) → 4 free-form documents (label + attach, JPG/PNG/PDF ≤10 MB, suggestions line per type, continue at ≥1) → 5 review & **Submit** (mock `submitKyc`) → updated "pending review" success screen. **localStorage draft** (`lib/kycDraft.ts`): auto-saves fields + type (never password/files), restores on mount, resume lands at first incomplete step (cross-session → step 2, password re-entry). Mock service `services/kyc.service.ts` (suggestions, limits, `submitKyc`). Old direct `registerVendor` call removed from the flow (account creation moves to the atomic route at the backend step). ⬜ awaiting user UX review.
   - **2b ✅ DONE (2026-07-06, mock, `tsc` clean):** new `components/kyc/KycStatusPage/` (+hook) — full-screen pre-activation surface for a **signed-in pending vendor**: `submitted` → "under review", `approved` → "awaiting activation", `rejected` → reviewer notes + free-form doc editor + **Resubmit** (mock, flips back to submitted); Sign Out always available. Gate wiring: `useLoginPage.handleLogin` pending path now hands off via `onPendingVendor` (stays signed in — previously error + signOut); `useAppShell` session-restore routes pending vendors to the surface (`pendingKycVendorId`), signOut only when no vendor at all; `AppShell` renders it between recovery and login branches. Mock status via `MOCK_MY_KYC_STATUS` in `kyc.service.ts` (default `rejected`; flip to preview states). ⬜ awaiting user UX review.
3. ✅ **Frontend — command review panel DONE (2026-07-06, mock data, `tsc` clean):** new `KycPanel.tsx` + `useKycPanel.ts` in `VendorViewModal/` (pure render + hook), rendered inside the existing modal; shows applicant type + status pill (submitted/approved/rejected), document list with View (mock: toast until storage lands), suggestions context, notes textarea, packet **Approve/Reject** (reject requires a note). Mock `services/kyc-admin.service.ts`: in-memory store, deterministic packet per vendor (alternates company/individual), review persists until refresh. ⬜ awaiting user UX review. *(2a also user-verified working, 2026-07-06.)*
4. ✅ **UX reviewed + backend decisions locked (2026-07-06):** D-3 = A (advisory), D-4 = B (server route), D-5 = A (migration), D-7 = D (client draft + files-last + atomic submit).
5. 🔄 **Backend (approval gate):**
   - ✅ 5.1 KYC tables migration `20260706000001_vendor_kyc.sql` (kyc_document_types + vendor_kyc header + vendor_kyc_documents + RLS + grants + seed)
   - ✅ 5.2 Storage migration `20260706000002_vendor_kyc_storage.sql` (private `vendor-kyc` bucket + storage.objects policies)
   - 🔄 5.3 apply locally (`supabase db reset`) — user
   - ✅ 5.4 atomic submit route `vendor/app/api/auth/register/route.ts` (multipart; account+vendor+header+files+docs; accreditation enforce; rollback; notifications) — tsc clean
   - ✅ 5.5 real `vendor/services/kyc.service.ts` (submit→route; getMyKyc + resubmit via RLS); deleted dead `registration.service.ts` — tsc clean
   - ✅ 5.6 real `command/services/kyc-admin.service.ts` (getVendorKyc; reviewKyc; signKycUrl) — tsc clean
   - ✅ 5.7 tsc clean (vendor + command)
6. 🔄 **IN TESTING (user, 2026-07-06):** local E2E — register → submit (account+vendor+header+docs+objects) → command view (signed URL) / reject → vendor revise & resubmit; abandon-before-submit leaves nothing; RLS isolation (vendor A can't see vendor B). Prereqs: both apps' env → local Supabase; `SUPABASE_SERVICE_ROLE_KEY` in `vendor/.env.local` (atomic route uses admin client); use `localhost`.
7. ⬜ Hosted: migrations via GitHub integration; confirm bucket + policies; smoke test.
8. ⬜ **(Later / deferred) — mostly migrations, small code.** Both additive; each goes through the schema-approval gate then deploys like item 7. *(Note: accreditation backend enforcement is NOT here — already done in the 5.4 atomic route.)*

   **8a — Hard-gate activation (D-3 = B).** Migration-only (mirrors `validate_vendor_status_transition`):
   - ⬜ Trigger on `vendors` status change that **rejects `pending → active` unless `vendor_kyc.status = 'approved'`** (see draft S4).
   - ⬜ *(Optional, command code)* friendlier "KYC not approved yet" message when activation is blocked, instead of surfacing the raw DB error.

   **8b — KYC review → notification emails.** Reuses the **live** notification + email pipeline (one `notifications` row auto-emails via the existing dispatch trigger + Resend — **no new email/Edge-Function code**):
   - ⬜ **Migration:** seed two `notification_type_settings` rows (`kyc_approved`, `kyc_rejected`) so they appear in Command's toggles and the pipeline recognizes them.
   - ⬜ **Migration:** SECURITY-DEFINER trigger on `vendor_kyc` status change (like the booking-notification triggers) that inserts a `notifications` row (portal `vendor`) for the vendor's admins on approve/reject. *(Alternative: an app-layer write in `reviewKyc` — a small code change; the trigger is tidier and matches the existing pattern, so prefer the trigger.)*

   **8c — Resubmit hardening (rejected → revise).  ✅ BUILT (2026-07-06, `tsc` clean; awaiting live E2E).** Found reviewing the built flow; all `vendor` code (no migration, no command change — RLS already permits vendor delete/insert while `rejected`). Fixed three gaps in the revise-after-rejection path per **D-8 = B** (selective edit).

   - ✅ **8c-1 — Identity capture on resubmit (gap #1).** `IdentityStep` footer (`onBack`/`onContinue`) made **optional** so it embeds without the stepper chrome; `KycStatusPage` now renders an **Identity (optional — re-capture if flagged)** section reusing `IdentityStep`/`CameraCapture`. Captured ID/selfie ride `resubmitKyc`'s new-docs array as `"Valid ID"`/`"Selfie with ID"`. Optional on resubmit (the prior photos live as existing docs; re-capture only if flagged).
   - ✅ **8c-2 — Selective edit + cleanup (gap #2, D-8 = B).** `resubmitKyc(vendorId, newDocuments, removedDocs)` now: (1) deletes removed docs — **row first (RLS-gated), then Storage object** (row-first → worst case a harmless orphan, never a dangling row); (2) uploads+inserts new docs (rolls back uploaded objects on insert failure); (3) flips header `rejected → submitted` **last** (RLS allows delete/insert only while `rejected`). Revise UI lists **"Already submitted"** docs with **View** + a remove/keep toggle (strikethrough when marked). Onboarding `removeKycDoc` needs no Storage cleanup — pre-account files are in-memory only, never uploaded until the atomic submit. Closes the S2 line-~190 note for the post-account path.
   - ✅ **8c-3 — `getMyKyc` returns the submitted documents (gap #3).** Now reads `vendor_kyc_documents` (id/label/storage_path) alongside the header; added `signMyKycDocUrl(path)` (60 s signed URL) for the **View** action. `MyVendorKyc` gained `documents: MyKycDoc[]`.

   **D-8 — resubmit doc semantics  ✅ RESOLVED (2026-07-06) → B (selective edit)**
   - ~~A: full replace — resubmit clears the entire prior packet (rows + objects) and stores the freshly-provided set.~~
   - **B (chosen): selective edit.** The revise UI **shows existing uploaded docs**; the vendor keeps/removes each individually and adds new ones; **only removed docs' rows + Storage objects are deleted**. Matches reality (a rejection usually flags one doc, not all) and naturally delivers the "see/remove prior uploads" surface (8c-3).
   - Consequence for 8c-2: needs **per-object delete** plumbing (delete a single doc row **and** its Storage object) + the revise UI listing current docs with a remove control — not a blanket wipe. `resubmitKyc` becomes add-new + delete-selected + flip header, rather than append-only.

## Verification
| Check | Kind |
|-------|------|
| Migrations apply on clean `db reset` (bucket, tables, storage policies) | machine + live |
| RLS: vendor A cannot read/list/download vendor B's KYC objects or rows | needs live env |
| RLS: non-command users cannot read others' KYC; command admins can read all | needs live env |
| Atomic submit: creates account + vendor + `vendor_kyc` header + doc rows + objects under `{vendor_id}/…`; abandoning before submit leaves **nothing** server-side | needs live env |
| localStorage draft: leave mid-form → return → fields restored (password NOT persisted) | needs live env |
| Command packet approve/reject sets header status + notes + reviewer; vendor sees it; rejected → revise → resubmit works | needs live env |
| Signed URL opens the file; no public URL works | needs live env |
| `tsc --noEmit` passes in vendor + command | machine |

## Related / follow-ups
- **ID + selfie-with-ID camera capture** — `.plans/2026-07-06-kyc-id-selfie-capture.md`. Adds an "Identity Verification" step (camera + alignment overlay) after documents; **frontend-only** — the two photos ride the existing submit pipeline as labelled docs (no backend change).
- **Accreditation/License No. → company-only** — `.plans/2026-07-06-accreditation-company-only.md`. Frontend rides this plan's step-3 UI; its backend enforcement (**company → accreditation required**) must land inside this plan's **atomic submit route** when built.
- Wire booker **booking-document** upload on the same foundation (bucket/RLS/upload pattern) — currently UI-only.
- KYC hard-gate on activation (S4 / D-3 B) — **item 8a**.
- KYC review → notification emails (reuse the notification pipeline) — **item 8b**.
- **Resubmit hardening** (item 8c — ✅ built 2026-07-06, D-8 = B): camera/identity capture on resubmit; selective edit + cleanup (delete removed rows **and** Storage objects, no orphans); `getMyKyc` returns submitted docs so the vendor sees/keeps/removes what they sent. Awaiting live E2E.
