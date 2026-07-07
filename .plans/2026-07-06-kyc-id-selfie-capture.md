# KYC — ID + selfie-with-ID camera capture

**Date:** 2026-07-06
**Scope:** `vendor` app only — a new identity-verification step in the KYC onboarding flow. **Frontend-only** (no migration, no backend change — see below).
**Status:** ✅ BUILT (2026-07-06) — code complete + `tsc` clean; item 6 = manual/device testing (user to run).

> One-line framing: after the document-upload step, require the vendor to capture (1) a **valid ID** and (2) a **selfie holding the ID**, using the device camera with an on-screen alignment overlay and clear instructions. The two photos become regular KYC documents that flow through the existing submit pipeline.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** D# = Decision. Couples to `.plans/2026-07-03-vendor-kyc-storage.md` (the KYC flow this extends).

---

## Why this is frontend-only (no backend work)

The captured photos are just **two more labelled documents** (`"Valid ID"`, `"Selfie with ID"`) appended to the existing `documents: { label, file }[]` that `submitKyc` already sends. The atomic route, `vendor-kyc` bucket, `vendor_kyc_documents` table, and Command's review panel already handle arbitrary labelled files — so **no migration, no route change, no command change**. The only new work is the vendor-side capture UX + wiring the two required Files into the flow.

---

## Goal & scope

**In scope**
- A new **"Identity Verification"** sub-step in the vendor KYC flow, **after** the document-upload step.
- **Two required captures:** a valid ID, and a selfie of the person **holding** the ID.
- A **camera-icon button** that opens a live camera view.
- An **alignment overlay** on the live view (a card outline for the ID; a face oval + card outline for the selfie) so the shot is framed/clear, with **clear on-screen instructions**.
- Capture → preview → **Retake / Use photo**; the accepted photo becomes a KYC document File.
- **Separated styling** (per the new go-forward rule — see D-2): styles live outside the render component.
- Proper camera lifecycle (stop tracks on close/unmount), permission handling, secure-context awareness.

**Out of scope (this phase)**
- **Automated face/ID detection or liveness** (the overlay is a *visual guide*, not validation). Real detection = a much larger effort (MediaPipe / face-api / server-side) — separate feature.
- OCR / data extraction from the ID.
- Any backend/schema change (none needed).
- Retrofitting camera capture into booker booking-documents.

---

## Open decisions (resolve before execution)

### D-1 — Dependency for camera capture  ⬜ TODO
- **A (recommended): none — native `getUserMedia` + `<canvas>`.** Fully covers live preview + frame capture → `Blob`/`File`. No install; fewest moving parts; smallest bundle. The camera lifecycle lives in a `useCamera` hook.
- **B: `react-webcam`** (small, maintained wrapper). Slightly less lifecycle code, but a new dep for something the platform does natively.

**Recommendation: A.** (So "install dependencies" is likely a **no-op** — I'll only install if you pick B or we add detection later.) *Face-detection libraries are intentionally excluded — see Out of scope.*

### D-2 — Styling-separation method for the new components  ⬜ TODO
You asked to **separate styling from the render component starting here**. Two mechanisms are in play in this repo:
- **A (recommended for this widget): CSS Modules** (`CameraCapture.module.css`). Next-native, literally a separate file, and the cleanest way to express the overlay geometry (masked cut-out, oval/rect, any pulse animation). `.tsx` references `styles.x`.
- **B: Tailwind utilities + `cn()`** (the direction in `.plans/2026-07-06-loginpage-destyle-refactor.md`). Keeps one system, but the overlay mask/geometry is awkward in arbitrary values.

**Recommendation: A (CSS Modules) for the camera widget**, since it's a self-contained visual with non-trivial geometry; keep Tailwind as the general go-forward for form chrome. *(Either way, no inline `style={{}}` objects in the new components.)*

### D-3 — Step placement in the flow  ⬜ TODO
- **A (recommended): a new dedicated step** — insert **"Identity Verification"** between the current documents step (4) and review (5), making the flow 6 steps. Clear, focused, easy back/next.
- **B: fold into the documents step** (4) as a required sub-section. Fewer steps, but a busier screen.

**Recommendation: A.**

### D-4 — Required-ness + fallback when camera is unavailable  ⬜ TODO
- **A (recommended): required, with a file-upload fallback.** Both captures are mandatory to proceed. If the camera is denied/absent (permissions, no hardware, unsupported browser), show a **"choose a file instead"** fallback for that item so users aren't hard-blocked.
- **B: camera-only, hard-required.** Cleaner intent, but blocks anyone without a working camera.

**Recommendation: A** — required for completeness, but never trap a legitimate user.

---

## Architecture (SOLID)

New components in `vendor/components/kyc/` (component + hook + styles per file, per the hook/render-separation rule):

```
IdentityStep/
  IdentityStep.tsx          # the step: two capture slots (ID, selfie) + instructions + validation
  useIdentityStep.ts        # step state: which captures done, exposes the two Files
  IdentityStep.module.css   # step styling
CameraCapture/
  CameraCapture.tsx         # presentational: live <video> + overlay + capture/retake/use controls
  useCamera.ts              # camera lifecycle: start/stop stream, capture frame → File (SRP)
  CameraCapture.module.css  # video + overlay geometry (mask, oval/rect, instructions)
lib/
  captureImage.ts           # pure helper: <video> frame → canvas → JPEG File (testable, no React)
```

**Design principles applied**
- **SRP:** `useCamera` owns only the stream lifecycle + capture; `captureImage` is a pure canvas→File function (unit-testable, no DOM-React coupling); `CameraCapture` is pure render; `useIdentityStep` owns step state.
- **OCP / DRY:** one `CameraCapture` reused for both captures — the **overlay shape + instructions + `facingMode` are props/config** (an `OverlayGuide` = `'id'` | `'face-and-id'`), not duplicated components.
- **DIP:** the step depends on `CameraCapture`'s interface (`onCapture(file)`), not on camera internals.
- **Lifecycle safety:** `useCamera` **stops all tracks** on close and on unmount (no dangling camera light); handles the permission-denied and no-device cases explicitly.

**Camera details**
- **Secure context:** `getUserMedia` requires HTTPS or `localhost` — fine locally (`localhost`) and hosted (HTTPS). Note in the UI if unavailable.
- **Facing mode:** ID capture requests the **rear** camera (`facingMode: 'environment'`), selfie requests the **front** (`facingMode: 'user'`) — best-effort, falls back to default.
- **Overlay:** a semi-transparent mask with a cut-out — a **card rectangle** for the ID; a **face oval + smaller card rectangle** for the selfie-with-ID — plus concise instructions ("Fit your ID inside the frame", "Center your face and hold your ID beside it; ensure both are readable").
- **Capture:** draw the current `<video>` frame to a `<canvas>`, export **JPEG (~0.9, capped resolution)** → `File` named e.g. `valid-id.jpg` / `selfie-with-id.jpg` (well under the 10 MB bucket limit).
- **Preview/Retake/Use:** show the captured still; "Use photo" hands the `File` up; "Retake" restarts the stream.

**Integration (the only wiring into existing code)**
- `IdentityStep` produces two `File`s → added to the KYC documents list with fixed labels `"Valid ID"` and `"Selfie with ID"` (append to the same `kycDocs` the flow already submits).
- Flow control: `useLoginPage` gains the new step (D-3 = A) between documents and review; **cannot proceed until both captures exist**; the review step lists them like other docs.
- **No change** to `submitKyc`, the atomic route, tables, bucket, or Command — the two photos travel as ordinary labelled documents.

---

## Files to add / change
| File | Change |
|------|--------|
| `vendor/components/kyc/CameraCapture/*` | New: `CameraCapture.tsx` + `useCamera.ts` + `.module.css` |
| `vendor/components/kyc/IdentityStep/*` | New: `IdentityStep.tsx` + `useIdentityStep.ts` + `.module.css` |
| `vendor/lib/captureImage.ts` | New: pure video-frame→JPEG-File helper |
| `vendor/components/auth/LoginPage/useLoginPage.ts` | Add the identity step to the flow; hold the two capture Files; gate progression; include them in the submitted documents |
| `vendor/components/auth/LoginPage/LoginPage.tsx` | Render the new step (step 5; review becomes 6); step labels/progress bar → 6 steps |
| *(D-4 = A)* fallback file input inside `IdentityStep` | Reuse the existing accepted-MIME / size validation from `kyc.service.ts` |

## Dependencies
- **D-1 = A → none to install.** (Native APIs; TS types already in `lib.dom`.)
- **D-1 = B → `npm i react-webcam` in `vendor`** (needs your approval — new-dependency gate).
- No face-detection/liveness library (out of scope).
> Per the ask-before-install rule, **nothing is installed until you approve** the D-1 choice.

## Execution outline (when approved)
1. ✅ Decisions resolved (2026-07-06): **D-1 = A** (native, no install), **D-2 = A** (CSS Modules), **D-3 = A** (new dedicated step), **D-4 = A** (required + file-upload fallback).
2. ✅ `lib/captureImage.ts` (pure video-frame→JPEG-File helper).
3. ✅ `CameraCapture` (+ `useCamera`, `.module.css`) — configurable overlay (`guide` = `id` | `face-and-id`) + `facingMode`; permission/no-device/insecure handling; track + object-URL cleanup on unmount.
4. ✅ `IdentityStep` (+ `useIdentityStep`, `.module.css`) — two slots (ID rear-cam, selfie front-cam), instructions, required validation, D-4 file-upload fallback (reuses `KYC_ACCEPTED_MIME`/`KYC_MAX_FILE_BYTES`), object-URL-managed thumbnails.
5. ✅ Wired into `useLoginPage` / `LoginPage`: new **step 5 = identity** (review → step 6); `idPhoto`/`selfiePhoto` state, `captureIdentity`/`removeIdentity`, `handleDocsContinue` (4→5), `handleIdentityContinue` (5→6, both required); the two Files ride into `submitKyc` as `"Valid ID"`/`"Selfie with ID"`; 6-segment progress bar + labels; review summary shows both.
6. 🔄 `tsc --noEmit` clean (exit 0, verified 2026-07-06). Manual/device test pending (user to run): grant/deny camera, capture both, retake, submit → files land in bucket with the fixed labels; Command sees "Valid ID"/"Selfie with ID".

## Verification
| Check | Kind |
|-------|------|
| Camera button opens live preview with the correct overlay (card for ID, face+card for selfie) | manual |
| Instructions are clear and visible over the video | manual |
| Capture → preview → Retake/Use; camera light turns OFF on close/unmount | manual |
| Cannot advance past the step until both ID + selfie are captured | manual |
| Permission-denied / no-camera → graceful message + file-upload fallback (D-4 = A) | manual |
| Front camera for selfie, rear for ID (mobile) | manual (device) |
| Submitted photos appear as `Valid ID` / `Selfie with ID` docs in the bucket + Command review | manual |
| No inline `style={{}}` in the new components (styling separated) | review |
| `tsc --noEmit` passes in vendor | machine |

## Notes / risks
- **Visual guide, not verification** — the overlay helps framing; it does not confirm a real face/ID. If you later want liveness/match, that's a separate feature (adds a detection dep and likely server-side checks).
- **Desktop with no rear camera** — `facingMode` is best-effort; it just uses the available camera.
- **iOS Safari** — `getUserMedia` needs a user gesture (the camera button provides it) and HTTPS/localhost; `<video playsInline>` required to avoid fullscreen takeover.
