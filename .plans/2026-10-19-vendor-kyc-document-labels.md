# Vendor KYC — fixed document slots instead of free-text labels

**Date:** 2026-10-19
**App / scope:** `vendor/` web frontend only — `components/kyc/KycSubmitForm/` (render + hook + module CSS),
one new `lib/kycDocumentSlots.ts` (+ its test), and one unused import in `services/kyc.service.ts`'s
consumers. One documentation item (I5) touches the **root** repo's `architecture/`.

**Out of scope, deliberately:** `backbone/` (no migration, no schema, no storage policy, no RLS),
`command/`, `booker/`, every API route including `app/api/kyc/submit/route.ts`, `lib/kycSubmission.ts`
(the server validator), auth, dependencies, **the identity capture flow** (`components/kyc/IdentityStep/`,
`components/kyc/CameraCapture/`), and **the rejected-application resubmit editor**
(`components/kyc/KycStatusPage/`) — see D2.

**Status:** ✅ **COMPLETE — for its executable scope (closed 2026-10-21 at the user's call).**
Five rounds over three days. Every item is resolved: B1–B26 and I1–I3, I5–I16 done; I2 ✖ superseded
by round 2; **I4 ✖ closed by decision (D9)** — resubmission stays free-text with no required set,
with its reopen conditions recorded at the item; F1 and F2 recorded.

**Final shape.** Company: a documents step with two fixed slots — DTI Document, then Mayors permit
(`dti-document`, `mayors-permit`) — and **no accreditation number**. Individual: **no documents
step at all** (three steps; the packet is the two identity photos). No free-text document naming on
a first submission; the resubmit editor after a rejection still has one, deliberately. The vendor
app no longer names anything `lto`.

**Verification.** Machine: tsc clean · 560 unit tests, 0 failing · lint unchanged at its
pre-existing 29 · 217 Playwright tests, 0 failing (10 of them a new behaviour spec for this step);
the only baselines ever regenerated were `kycstatus-welcome-light/dark`, scoped, for copy changes.
Live: rounds 1–3 were deployed and **staging-tested by the user (2026-10-21, as reported — the
hosted environment was never queried from here)**.

⚠️ **What this status does NOT claim.** **Rounds 4 and 5 are machine-verified but had not been
committed or staging-tested when this plan was closed** — the user took the commit drafts to push
to staging for testing. If that testing finds something, this plan is the record to reopen, not a
new one. Also still outside it: the registration dropdown's dark-mode defect, investigated here but
owned by `.plans/2026-10-20-dark-mode-lift.md` **I9**, briefed in
`.plans/2026-10-21-combobox-portal-dark-handoff.md`.

> One-line framing: an applicant should be told exactly which documents to upload, so replace the
> free-text "name it, then attach it" control with the two (company) or one (individual) fixed,
> required slots, and move the company accreditation number next to them. Optimize for: the smallest
> surgical frontend change that leaves the submit contract, the identity capture and every historical
> packet untouched.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision; numbers are plan-local —
> qualify cross-plan references by app (e.g. "vendor I1").

**Task prompt of record:** `prototypes/prompts/2026-10-18-vendor-kyc-document-labels.md`.
**Predecessors:** `.plans/2026-07-03-vendor-kyc-storage.md` (the KYC subsystem; this plan reverses
its **D-1 = B** "free-form + guidance" decision **in the vendor UI only**),
`.plans/2026-07-06-kyc-id-selfie-capture.md` (the identity step this plan must not touch),
`.plans/2026-09-30-vendor-signup-before-kyc.md` (B5 — the form being edited, and where the
accreditation number moved from).

---

## Review pass (2026-10-19)

A second read of the real files, after the plan was written, against the question "where could a
poor implementation still satisfy what this says?". Five gaps; each is now an item or a constraint.

| # | Gap | Where it was wrong | Now |
|---|---|---|---|
| 1 | **B1 as written would have failed `npm test`.** The test script is `node --test --experimental-strip-types "lib/**/*.test.ts"` (`package.json:10`) — Node's type stripping resolves no `@/` alias, and **no tested `lib/` module imports one** (checked all 39). The obvious `import type { KycType } from "@/services/kyc.service"` breaks the run, and importing that module at all pulls `@/lib/supabase/client` into a Node test | B1 named the module but not its import rules | Hard constraint written into B1 |
| 2 | **The Attach control is not keyboard-reachable.** `.hidden { display: none }` (`KycSubmitForm.module.css:48`) on the file input removes it from the tab order; the wrapping `<label>` has no `htmlFor` and is not focusable. Clicking works, tabbing does not. Pre-existing — but B2 rewrites exactly this markup, so it would have been reproduced | Not mentioned at all | **I6**, with the fix already used elsewhere in this app (`sr-only`) |
| 3 | **The new UI would have had no automated coverage.** The verification section leaned on the visual suite, but `/ui-gallery` only renders this form at **step 1** — the four baselines prove the *old* step is unchanged and say nothing about the slots. Meanwhile `visual-tests/offering-wizard.spec.ts` is an exact precedent for covering a wizard's gating by behaviour, no baselines | Verification overstated what the visual suite proves | **I7**, plus an honest re-write of Verification |
| 4 | **The accreditation error would have been detached from its field.** `RF` already accepts `error?: string \| null` and styles the input with it (`RegisterField.tsx:14, 31`); today's call site passes nothing, so the message lands only in the global line at the bottom of the step. Moving the field next to the uploads makes that distance worse | B5 said "same wiring", which would have preserved the weaker behaviour | Refinement written into B5 |
| 5 | **The packet-total check is near-dead, and never covered the identity photos.** `useIdentityStep.ts:37-41` validates MIME and 10 MB per file but nothing counts the two captures toward the 25 MB packet total; the client sums only the document list (`useKycSubmitForm.ts:93-97`). With fixed slots the client-side total can reach at most 2 × 10 MB, so it can no longer fire at all, while 2 slots + 2 uploaded identity files can still reach ~40 MB and be refused **by the server, after every upload** | Plan said "keep the total check", implying it still protects something | Kept (cheap, and it keeps the code honest if slots ever grow) with the real limitation recorded under DEFERRED |

Nothing in the original item set was a false alarm, and nothing was downgraded. B6 — the stale slot
file on a type switch — was confirmed against `selectKycType` (`useKycSubmitForm.ts:54-60`) and is
real; I7 now gives it a machine check rather than a live one.

---

## What the code does today (investigated 2026-10-19, not from memory)

| Concern | Where | Today |
|---|---|---|
| Applicant type + accreditation no. | `components/kyc/KycSubmitForm/KycSubmitForm.tsx:48-67` | Step 1. `RF label="Accreditation / License No."` renders only for `company` (`:65-67`) |
| Step-1 gate | `components/kyc/KycSubmitForm/useKycSubmitForm.ts:62-69` | Refuses to continue when a company has no `ltoNo` |
| Suggested-document copy | `KycSubmitForm.tsx:76-82` ← `services/kyc.service.ts:26-29` | A `KYC_SUGGESTIONS[type].join(", ")` line at the top of step 2 |
| Document entry | `KycSubmitForm.tsx:99-109` | Free-text label input + "Attach" file input, appended to a list |
| Entry validation | `useKycSubmitForm.ts:72-101` | Label required (`:74-77`), MIME (`:78-81`), 10 MB per file (`:82-85`), 12-doc count (`:89-92`), 25 MB packet total (`:93-97`) |
| Step-2 gate | `useKycSubmitForm.ts:105-111`, `KycSubmitForm.tsx:115` | "At least one document" |
| Payload | `useKycSubmitForm.ts:146-155` | `documents: [...kycDocs, {label:"Valid ID"}, {label:"Selfie with ID"}]` → `submitFirstKyc` |
| Review step | `KycSubmitForm.tsx:133-151` | Accreditation row (`:137`), `Documents ({kycDocs.length + 2})` (`:145`), one line per label |
| Server validation | `lib/kycSubmission.ts:68` | `label` must be non-empty and ≤ `MAX_LABEL_LENGTH` = **120** (`lib/registration.ts:46`). No charset rule |
| Storage of the label | `app/api/kyc/submit/route.ts:130` | Inserted verbatim into `vendor_kyc_documents.label` |
| The column | `backbone/supabase/migrations/20260706000001_vendor_kyc.sql:104` | `label text not null` — "free-form, vendor-provided (D-1 = B)". No CHECK, no FK |
| Who reads the label back | `command/.../VendorViewModal/KycPanel.tsx:64`; `KycStatusPage.tsx:87` | Both print it verbatim. **Nothing matches on it** |
| The dormant catalogue | same migration, `:46-52` | `kyc_document_types` is seeded (`business_permit`, `government_id`, …) and **queried by no app** — vendor and command each hardcode their own suggestion array |

**Backend compatibility — the question the prompt asked to answer first: compatible, no modification
needed.** `business-permit` (15 chars) and `government-issued-id` (20) are non-empty and far under the
120-char cap, the validator applies no charset rule, the route inserts the string as given, and the
column is unconstrained free text. The two identity labels (`Valid ID`, `Selfie with ID`) are unchanged,
so `vendor_kyc_documents` keeps taking exactly the shape it takes today.

---

## BLOCKERS

### B1 — Single-source the slot definitions in a unit-testable module  ✅ DONE (2026-10-19)
**File:** new `vendor/lib/kycDocumentSlots.ts` + `vendor/lib/kycDocumentSlots.test.ts`

The two label literals, the per-type required set and the payload order are the whole substance of this
change, and `npm test` runs `node --test` over `lib/**/*.test.ts` only — nothing under `components/`
is machine-verifiable in this app. Putting the rule in `lib/` is therefore the only way "company
requires both, individual requires one" and "the fixed label reaches the payload" become checks rather
than assertions, and it stops the stored label from drifting from the visible one.

**Fix approach** — one pure module, no JSX, no React:
```ts
export type KycSlotValue = "business-permit" | "government-issued-id"
export interface KycDocumentSlot { value: KycSlotValue; title: string; hint?: string }
export const KYC_DOCUMENT_SLOTS: Record<KycType, readonly KycDocumentSlot[]>
export function slotsFor(kycType: KycType): readonly KycDocumentSlot[]
export function missingSlotTitles(kycType: KycType, filled: Iterable<string>): string[]
export function submissionDocuments(
  kycType: KycType, slotFiles: Partial<Record<KycSlotValue, File>>, idPhoto: File, selfiePhoto: File,
): { label: string; file: File }[]
```
`company` → `business-permit` ("Business permit"), `government-issued-id` ("Government-issued ID");
`individual` → `government-issued-id` only. `submissionDocuments` returns the slots in declaration order
followed by `Valid ID` and `Selfie with ID`, exactly the order the form builds today.

⚠️ **Import constraint — this is what makes it testable, and it is not optional.** `npm test` is
`node --test --experimental-strip-types "lib/**/*.test.ts"` (`package.json:10`). Node's type
stripping does **not** resolve the `@/*` tsconfig alias, and not one of the 39 tested `lib/` modules
uses it — `lib/kycSubmission.ts:1` imports `"./registration.ts"`, with the extension. So:
- imports in `kycDocumentSlots.ts` and its test are **relative with an explicit `.ts`**, never `@/`;
- it must **not** import `services/kyc.service.ts`, which pulls `@/lib/supabase/client` (a browser
  client) into a Node test run;
- `KycType` comes from `./kycSubmission.ts`, which already exports exactly that union. The hook keeps
  importing its own `KycType` from the service as it does today — the two are structurally identical,
  so no call site changes.

**Separation:** a pure `lib/` module — the render/hook/style convention does not apply; no component.
**Verification:** `npm test` — the new test asserts both required sets, that `missingSlotTitles`
names what is absent, and that `submissionDocuments` emits the two literal label strings plus the two
unchanged identity labels in order (machine-verifiable).

✅ **DONE (2026-10-19)** — `lib/kycDocumentSlots.ts` + `lib/kycDocumentSlots.test.ts` written.
`npm test`: **547 tests, 0 failing** (baseline 532, so +15 new). `npx tsc --noEmit` clean.
`grep -c 'from "@/'` returns 0 in both files, and `KycType` comes from `./kycSubmission.ts` — the
import constraint holds. `submissionDocuments` is generic over the file payload so the module carries
no DOM type, matching `lib/registration.ts`, which takes `File.type` as a plain string rather than a
`File`; the test uses string stand-ins. Also exported `IDENTITY_ID_LABEL` / `IDENTITY_SELFIE_LABEL`
(unchanged values) so the payload's identity labels live beside the slot ones instead of as literals
in the hook. ⚠️ The run prints `MODULE_TYPELESS_PACKAGE_JSON` for the new test — pre-existing and
unrelated: it fires **45** times, once per test file, because `package.json` sets no `"type"`.

### B2 — Step 2 renders fixed slots; the free-text add control goes  ✅ DONE (2026-10-19)
**File:** `components/kyc/KycSubmitForm/KycSubmitForm.tsx:76-119`, `KycSubmitForm.module.css`

Replace the suggestions line (`:76-82`), the appended staged list (`:83-98`) and the label-input +
Attach row (`:99-109`) with one row per slot from `slotsFor(kycType)`: the fixed title as plain text
(never an input), the attached file name when present, an "Attach"/"Replace" file input, and a remove
button. No unrestricted "add document" control remains on this step.

**Preserve exactly:** `accept=".jpg,.jpeg,.png,.pdf"`, the `e.target.value = ""` reset after a pick
(`:105`) so re-picking the same file fires `change`, the single error paragraph (`:110`), and the
Back/Continue row (`:111-118`). **Do not carry over `.hidden` on the file input — see I6.**

**Separation:** `.tsx` stays a pure render layer — no `useState`, no `useEffect`; the inline
`onChange` only forwards the picked `File` to the hook's `attachSlotDoc`, which is how the existing
file input is written. New classes (`slotRow`, `slotTitle`, `slotFileName`, `slotEmptyHint`, …) go in
the co-located `KycSubmitForm.module.css`, reusing `docRow` / `docInfo` / `docLabel` / `docFileName` /
`attachLabel` / `hint` / `sectionLabel` where they already fit; no new `style={{}}` block.
**Verification:** `npx tsc --noEmit`, `npm run lint`, and the two `/ui-gallery` panes that render this
form (see Verification).

✅ **DONE (2026-10-19)** — the slot rows replace the suggestions line, the staged list and the
label-input row in `KycSubmitForm.tsx`. A filled slot shows `CheckCircle` + the file name + Remove and
its button reads "Replace"; an empty one shows a dim `FileText` + the hint and reads "Attach". CSS:
added `.docIconEmpty` and `.slotHint` (wraps, unlike `.docFileName`) and a `:focus-within` outline on
`.attachLabel`; removed `.suggest`, `.suggestVal`, `.addWrap`, `.addRow`, `.addInput`, `.hidden` and
the phone media query that existed only for `.addInput` — RF carries its own 16px phone rule
(`RegisterField.module.css:52-54`), so the accreditation field is unaffected. `tsc` clean, lint
unchanged at 29 problems, `grep` finds no text input and no `styles.hidden` left in the component.

### B3 — Hook: slot-keyed files replace the labelled list  ✅ DONE (2026-10-19)
**File:** `components/kyc/KycSubmitForm/useKycSubmitForm.ts:42-43, 72-103`

Replace `kycDocs: KycDocEntry[]` and `newDocLabel` with `slotFiles: Partial<Record<KycSlotValue, File>>`,
and `addKycDoc(file)` / `removeKycDoc(id)` with `attachSlotDoc(slot, file)` / `removeSlotDoc(slot)`.

**Keep every file check, drop only what the change makes obsolete:**
- keep `isAcceptedMime` (`:78-81`) and the 10 MB per-file cap (`:82-85`) with their exact copy;
- keep the 25 MB packet total (`:93-97`), summing the slot files as it sums `kycDocs` today;
- **drop** the "Name the document first" error (`:74-77`) — the input it guarded no longer exists
  (this is the prompt's "remove frontend validation for user-entered document names");
- **drop** the 12-document count check (`:89-92`) — with at most two slots plus the two identity
  photos the packet cannot exceed four, so the branch is unreachable; the server still enforces
  `MAX_DOC_COUNT` (`lib/kycSubmission.ts:59`);
- attaching to a filled slot **replaces** that slot's file, so two rows can never point at one slot.

**Separation:** all state and handlers stay in the hook; the `.tsx` receives them as props.
**Verification:** `npx tsc --noEmit`; the removed-branch claim by grep over the final file.

✅ **DONE (2026-10-19)** — `slotFiles: Partial<Record<KycSlotValue, File>>` with `attachSlotDoc` /
`removeSlotDoc`. MIME and 10 MB checks kept verbatim; the packet total kept and corrected for replace
semantics (the slot being replaced is excluded from the sum); the "name it first" and
`KYC_MAX_DOC_COUNT` branches removed, with the reason written into the comment. `KYC_MAX_DOC_COUNT`
and `KycDocEntry` dropped from the hook's imports (both still exported for the resubmit path).
`removeSlotDoc` copies and `delete`s rather than destructuring, to stay clear of the unused-var rule.
`tsc` clean, lint unchanged.

### B4 — Step 2 gates on every required slot *and* the accreditation number  ✅ DONE (2026-10-19)
**File:** `useKycSubmitForm.ts:62-69` and `:105-111`; `KycSubmitForm.tsx:115`

`handleTypeContinue` drops the `ltoNo` check — step 1 now only needs a type (`disabled={!kycType}`,
already the case at `:70`). `handleDocsContinue` gains both checks, in this order: company with an
empty `ltoNo` → the **unchanged** string `"Accreditation / License No. is required for companies."`;
then any missing slot → an error naming it from `missingSlotTitles` (e.g. "Attach your Business permit
and Government-issued ID."). Continue is disabled until the type's slots are all filled (and, for a
company, the accreditation number is non-empty), replacing `disabled={kycDocs.length === 0}`.

**Risk if missed:** moving the field without moving its validation lets a company reach step 3 with no
accreditation number; the submit guard and the server (`lib/kycSubmission.ts:51`) would then reject
them *after* the camera captures — the worst place to fail.
**Verification:** `npx tsc --noEmit`; the per-type rule itself is covered by B1's test; the button
state needs a browser (live check).

✅ **DONE (2026-10-19)** — `handleTypeContinue` now only needs a type; `handleDocsContinue` checks
the accreditation number first (into `ltoError`, so it lands on the field) then the slots, erroring
`Attach your <missing>.` built from `missingSlotTitles`. A derived `docsComplete` drives the Continue
button's `disabled` and class. Verified by `tsc`, by B1's unit tests for the rule itself, and by the
S4 spec in the browser.

### B5 — The accreditation field moves into step 2, above the slots  ✅ DONE (2026-10-19)
**File:** `KycSubmitForm.tsx:65-67` → the top of the step-2 block

Same `RF` component, same label, same `placeholder="e.g. BN-2024-0001"`, same `value={ltoNo}
onChange={setLtoNo}`, still rendered only when `kycType === "company"`. Its submission mapping is
untouched: `ltoNo` → `submitFirstKyc` (`useKycSubmitForm.ts:149`) → the route's `accreditation_no`
update (`app/api/kyc/submit/route.ts:142-150`).

**Refinement from the review (gap 4):** pass the accreditation error to `RF`'s existing `error` prop
(`RegisterField.tsx:14`), which already draws `styles.inputError` on the input. Today's call site
passes nothing, so the message appears only in the global error line — and once the field sits above
two upload rows, that line is further from the field that caused it. Same validation rule, same
string, attached to the right control. The error state is owned by the hook, so the `.tsx` stays a
render layer.

**Value retention across steps** is already structural, and this item must not break it: `ltoNo` lives
in `useState` at `useKycSubmitForm.ts:41`, in the hook that stays mounted for the whole wizard, while
only the step markup unmounts. Stepping 2 → 1 → 2 therefore re-renders the field from the hook's value.
**Verification:** read-level (the state's owner is unchanged) plus a live step-back/forward check.

✅ **DONE (2026-10-19)** — the `RF` block moved verbatim to the top of step 2, now passing
`error={ltoError}`. `ltoNo` still lives in the hook (`useState`, mounted for the whole wizard), so
nothing about retention changed; the hook also clears `ltoError` on each keystroke via `updateLtoNo`.
The step 2 → 1 → 2 round trip is confirmed by the S4 spec; its appearance is still a live check.

### B6 — Switching applicant type must discard a slot that no longer applies  ✅ DONE (2026-10-19)
**File:** `useKycSubmitForm.ts:54-60` (`selectKycType`)

A vendor who picks **company**, attaches a business permit, goes back and switches to **individual**
leaves that file staged against a slot the individual flow never renders — and today's payload builder
would submit it, labelled `business-permit`, for an individual. `selectKycType` already clears `ltoNo`
for exactly this reason (`:57-58`); extend it to drop any `slotFiles` key not in `slotsFor(newType)`.

**Fix approach:** one filter in `selectKycType`, silent (it mirrors the existing `ltoNo` clear, and the
file was never submitted).
**Verification:** `npx tsc --noEmit`; a live company → individual → submit check that the packet holds
one document plus the two identity photos.

✅ **DONE (2026-10-19)** — `selectKycType` filters `slotFiles` down to the new type's slots, beside
the `ltoNo` clear that was already there. Belt and braces: `submissionDocuments` only ever emits the
type's own slots, so a leak would need both to fail. Covered by a unit test (B1) **and** by the S4
spec in a real browser — the one item the review promoted from live-only to machine-checked.

### B7 — The payload carries the fixed label values  ✅ DONE (2026-10-19)
**File:** `useKycSubmitForm.ts:135-155`

`handleSubmit` builds `documents` from `submissionDocuments(kycType, slotFiles, idPhoto, selfiePhoto)`
(B1) — the slot values as labels, then `Valid ID` and `Selfie with ID` unchanged at the end. Its
pre-flight guard (`:136-143`) becomes the same rule as B4 (all required slots, then both identity
photos), not `kycDocs.length === 0`. `submitFirstKyc`, the upload loop, the rollback-on-failure path
and the route are all untouched.

**Verification:** B1's test proves the labels and their order; `npx tsc --noEmit`; the write itself
needs staging (live).

✅ **DONE (2026-10-19)** — `handleSubmit` calls `submissionDocuments(kycType, slotFiles, idPhoto,
selfiePhoto)`; the hand-built array and its `"Valid ID"` / `"Selfie with ID"` literals are gone from
the hook. Its guard is now `!docsComplete`. The labels and order are proven by B1's tests; the actual
write still needs staging.

---

## IMPORTANT

### I1 — The review step reflects the slots, readably  ✅ DONE (2026-10-19)
**File:** `KycSubmitForm.tsx:144-151`

`Documents ({kycDocs.length + 2})` becomes the slot count for the chosen type plus 2, and each line
lists the slot **title** ("Business permit"), not the stored slug — the review screen is the applicant's
last look at what they are sending, and `business-permit` reads like a system value there. The
accreditation row (`:137`) is unchanged.
**Verification:** `npx tsc --noEmit`; appearance is a live check.

✅ **DONE (2026-10-19)** — the review step counts `slots.length + 2` and lists each slot's **title**,
so the applicant reads "Business permit", not `business-permit`, while the payload still carries the
slug. `tsc` clean.

### I2 — Copy that separates the ID *document* from the ID *photo*  ✅ DONE, then ✖ SUPERSEDED (2026-10-19, round 2)
**File:** the `government-issued-id` slot's `hint` in `lib/kycDocumentSlots.ts` (B1), rendered by B2

An applicant who uploads "Government-issued ID" and is then asked at step 3 to photograph an ID and a
selfie holding it will reasonably think they are doing the same thing twice, and the prompt is explicit
that the upload does **not** replace either capture. Proposed hint, for your wording approval at
review: *"A scan or photo of your ID. You'll also take a live photo of it in the next step."*
The identity step itself is not touched.
**Verification:** read-level; wording is yours to accept.

✅ **DONE (2026-10-19)** — shipped as written in the plan: *"A scan or photo of your ID. You'll also
take a live photo of it in the next step."* It renders under the Government-issued ID slot while that
slot is empty, and gives way to the file name once attached. ⚠️ Still **yours to accept or rewrite** —
the string lives in one place (`lib/kycDocumentSlots.ts`), and a test asserts only that it mentions
the next step, so changing the wording is a one-line edit.

✖ **SUPERSEDED the same day (round 2, B11).** You read the duplication as the defect, not the
missing explanation — so the slot went, and the hint with it. The item is kept because it records
the trade this plan originally made: explaining a redundancy instead of removing it. Hint support
is gone from the interface, the render and the CSS; no slot carries one now.

### I3 — `KYC_SUGGESTIONS` stays exported; only this form stops using it  ✅ DONE (2026-10-19)
**File:** `KycSubmitForm.tsx:3` (remove the import), `services/kyc.service.ts:26-29` (keep)

The resubmit editor still renders it (`KycStatusPage.tsx:3, 73-76`) under D2, so the export stays.
Command keeps its own independent copy (`command/services/kyc-admin.service.ts:34`) — untouched, and
out of scope. Only the now-unused import in this file is removed.
**Verification:** `npm run lint` (an unused import is an error here), grep for remaining callers.

✅ **DONE (2026-10-19)** — the import is gone from `KycSubmitForm.tsx`; the export stays and
`KycStatusPage.tsx` still renders it. Command's independent copy untouched. Lint unchanged at 29.

### I4 — Follow-up: the resubmit editor is still free-text  ✖ CLOSED by decision (2026-10-21)
**File:** `components/kyc/KycStatusPage/KycStatusPage.tsx:118-128`, `useKycStatusPage.ts:95-112`

Under D2 a vendor sees fixed slots on the first submission and a free-text "Add a document" box after
a rejection. Recorded, deliberately not changed, and **not to be closed by this plan** — closing it
means deciding whether a kept historical document whose label differs (e.g. `Business Permit` vs
`business-permit`) satisfies a slot, which is the ambiguous mapping the prompt asked to report rather
than guess.

**Three things this now puts on screen (found 2026-10-21 while answering how to test it).** Recorded
here so the next session does not rediscover them; none are changed:
1. **The suggestions line is stale.** `services/kyc.service.ts:26-29` still drives it, so a rejected
   company reads "Suggested for companies: Business Permit, DTI / SEC Registration, Authorized
   Representative ID, Proof of Address" and a rejected **individual** reads "Government-issued ID,
   Selfie with ID, Proof of Address" — documents the first submission no longer asks anyone for.
   I3 kept the export for this screen; round 3 made its content wrong.
2. **The vendor is shown the raw slug.** "Already submitted" prints the stored label
   (`KycStatusPage.tsx:87`), so a new company packet lists `business-permit` beside `Valid ID` and
   `Selfie with ID`. D1 accepted slugs in Command's reviewer view; this is the vendor-facing instance
   of the same trade.
3. **No required set on resubmit.** The button needs one document in total across kept + newly added
   + re-captured identity photos (`useKycStatusPage.ts:77, 128`), so a company can resubmit with no
   business permit at all.

**Cheapest honest step if you want one:** fix (1) alone — the copy that now contradicts the first
submission — and leave the slot question until rejections are common enough to matter.

✖ **CLOSED 2026-10-21 — the user chose to leave it (D9), on my recommendation.** Findings (1) and
(2) were fixed in round 4 (B23, B22), so what is being declined is specifically **enforcing a
required document set on a resubmission**: resubmission stays free-text, and one document in total
is still enough.

**Why that is a reasonable place to stop, and what would reopen it.** Enforcing the set needs an
answer to a question the data model cannot give: a packet may already hold `business-permit`
(round 3), `Business Permit` (free-typed), `government-issued-id` or `bir-registration` (rounds
1–2), and nothing records *which slot* a row was meant to be — the slot identity lives in a text
label. Ruling "history counts" risks passing a packet that is genuinely missing a document; ruling
"it does not" makes a vendor re-upload files you already hold. Today rejections are hand-reviewed
by a command admin who sees every document, so the enforcement would be belt to an existing
braces.

**Reopen this if any of:** rejections become frequent enough that admins stop reading packets
individually; someone wants resubmission to be self-service without review; or
`vendor_kyc_documents` gains a real slot identity (an FK to `kyc_document_types`, or a
`slot` column), which would make the mapping question disappear rather than need an answer. The
first of those is the likely trigger, and it is a product signal, not a code one.

### I5 — Documentation line for the new model  ✅ DONE (2026-10-19)
**File (root repo, not `vendor/`):** `architecture/vendor-kyc.md`, `architecture/portals.md:443-444`

Both describe the document step as free-text uploads with suggestions. One sentence each: the first
submission now has fixed required slots per applicant type with the labels `business-permit` /
`government-issued-id`, the resubmit editor is still free-text (I4), and `kyc_document_types` remains
dormant. Flagged because it is **outside the `vendor/` scope you set** — root documentation, no app
code — so say the word if you would rather it waited.
**Verification:** read-level.

✅ **DONE (2026-10-19)** — you allowed it explicitly. `architecture/vendor-kyc.md`: the step-2 table
row and the applicant-types bullet rewritten, a slot table added (type → slots → stored label), the
resubmit section marked as still free-text **with the reason**, `kyc_document_types` marked dormant,
`vendor_kyc_documents` noted as free text in the column but fixed values on a first submission, and
this plan added to Plans of record. `architecture/portals.md`: the Registration Flow paragraph and
both KYC rows in the feature table. **One file beyond the two named above:**
`architecture/schema.md`'s `kyc_document_types` entry claimed the table "only drives the
'Suggested: …' hint" — untrue before this change (both apps hardcode those arrays) and more so now,
so the sentence was corrected rather than left standing as a false statement about the very table
this work makes a decision about.

### I6 — The Attach control must be reachable by keyboard  ✅ DONE (2026-10-19)
**File:** `KycSubmitForm.module.css:48` (`.hidden { display: none; }`), used by `KycSubmitForm.tsx:105`

A `display: none` input is removed from the tab order, and the wrapping `<label>` (`:103-106`) has no
`htmlFor` and is not focusable — so **today the only way to attach a document is a mouse or a tap**.
Pre-existing, and the same pattern sits in `KycStatusPage.module.css:238` and
`IdentityStep.module.css:73`. It becomes this plan's problem because B2 rewrites this exact markup:
copying `.hidden` forward would bake the defect into the new slots.

**Fix approach:** on the new slot inputs use Tailwind's `sr-only` — already the app's own pattern
(`OfferingCreateWizard.tsx:71, 75`, `StatCard.tsx:102`, `AccountDeletionCardBody.tsx:105`) — which
hides the input visually while leaving it focusable, and add a `:focus-within` outline on the slot's
label in the module CSS so the focus is visible. Scope stays on the two new slot inputs; the resubmit
editor's and the identity step's copies of `.hidden` are **not** touched here — recorded in DEFERRED.
**Verification:** I7's spec tabs to the control and attaches a file through it (machine-verifiable);
visible focus styling is a live check.

✅ **DONE (2026-10-19)** — the slot inputs use `sr-only` (focusable) instead of `.hidden`
(`display: none`, not focusable), each with an `aria-label` naming its slot ("Attach Business
permit"), and `.attachLabel:focus-within` draws the focus ring. The S4 spec tabs to the control and
asserts it takes focus. The two other `display: none` inputs — the resubmit editor's and the identity
step's — are untouched and still have the gap, as recorded under DEFERRED.

### I7 — A behaviour spec for the slot gating (the new UI's only automated cover)  ✅ DONE (2026-10-19)
**File:** new `vendor/visual-tests/kyc-document-slots.spec.ts`

`/ui-gallery` renders this form only at **step 1** (`app/ui-gallery/page.tsx:1180-1184`), so the four
committed KYC baselines prove nothing about the slots. `visual-tests/offering-wizard.spec.ts` is the
precedent for exactly this situation — a wizard covered by **behaviour, with no screenshot
baselines**, driven through `/ui-gallery?mode=…` — and Playwright's `setInputFiles` can attach a
buffer to a file input without a real file dialog.

**Fix approach:** a spec in that file's shape, against `?mode=kycsubmit`, asserting:
- company → Continue disabled, the reason named, still disabled with only one slot filled or with the
  accreditation number empty, enabled once both slots and the number are there (B4);
- individual → one slot, Continue enabled on it alone (B4);
- company → attach the business permit → Back → switch to individual → the business-permit file is
  gone (B6, the one defect that would otherwise ship a wrongly-labelled document);
- no text input for a document name exists on the step (B2's "no free-text" claim, as a check).

It stops at step 2 — the gallery's `vendorId="gallery"` means a submit would hit the network, and the
identity step needs a camera. **No new baselines, no new gallery mode**, so the committed 112 are
untouched.
**Verification:** `npx playwright test visual-tests/kyc-document-slots.spec.ts` — machine-verifiable,
and it converts four of this plan's live-only checks into automated ones.

✅ **DONE (2026-10-19)** — `visual-tests/kyc-document-slots.spec.ts`, **7 tests, all passing**
(13.5s), and all 214 tests in the suite pass with it. Covers: the company gate with its reason copy;
the individual's single slot; "no document-name input" asserted as *zero* text inputs for an
individual and *exactly one* (the accreditation field) for a company; B6's discard, including
switching back to company and finding the slot empty; replace-then-remove; B5's value surviving
step 2 → 1 → 2; and I6's input taking focus. No new baselines, no new gallery mode.
⚠️ Text assertions on slot titles must be `{ exact: true }` — the blocked-reason line (I8) repeats
the titles, and a loose `getByText` matches both. Two runs failed that way before the fix.

### I8 — Found during S4: a disabled Continue that said nothing  ✅ DONE (2026-10-19)
**File:** `useKycSubmitForm.ts` (`docsBlockedReason`), `KycSubmitForm.tsx` (the line above the buttons)

Writing I7's spec exposed a hole in B4 as executed. B4 promised an error naming the missing slots,
but `docsComplete` **disables** Continue — so `handleDocsContinue`'s error branch was unreachable
from the UI and the applicant saw a dead button with no reason. The old step had the same shape, but
it only ever had one rule ("add a document"); with three ways to be blocked, silence is worse.

**Fix as executed:** the hook derives `docsBlockedReason` — "Choose an applicant type to continue.",
"Add your accreditation number to continue.", or "Attach your <missing> to continue." — the render
shows it under the file-type hint while it is non-null, and `handleDocsContinue` reuses the same
string for its (still-guarded) refusal path. One source for the copy, which is also why the test
needed exact-text matching. This mirrors `OfferingCreateWizard`, whose own spec asserts "Next stays
disabled until the step is valid, **and says why**".
**Verification:** asserted in three places by I7's spec; `tsc` clean; lint unchanged.

---

## Round 2 — the real document set (2026-10-19, after your review of round 1)

You tested the shipped slots and found the document set wrong, not the mechanism: the
**Government-issued ID** slot asks for the same thing the identity step photographs one screen
later. Round 2 replaces the set. Still frontend-only, still no backend change — the labels are
free text in the column and the validator applies no charset rule, so new values need nothing
server-side (the compatibility note at the top of this plan holds unchanged).

**The set, as requested:**

| Applicant type | Slot title | Stored `label` | Change |
|---|---|---|---|
| `company` | Business permit | `business-permit` | unchanged |
| `company` | LGU Permits | `lgu-permits` | **replaces** Government-issued ID |
| `company` | DTI Certificate / Business registration | `dti-certificate` | **new** |
| `company` | BIR Registration documents | `bir-registration` | **new** |
| `individual` | BIR Registration documents | `bir-registration` | **replaces** Government-issued ID |

### B9 — Redefine the slot set and its tests  ✅ DONE (2026-10-19)
**File:** `vendor/lib/kycDocumentSlots.ts`, `vendor/lib/kycDocumentSlots.test.ts`

Company goes from two slots to four, individual's single slot changes identity. `KycSlotValue`
gains `lgu-permits`, `dti-certificate` and `bir-registration` and loses `government-issued-id`.
The BIR slot is **one definition shared by both types**, as `government-issued-id` was — the two
titles you wrote differ only in plurality, so the shared title is "BIR Registration documents".
**Fix approach:** the slot constants and the `KYC_DOCUMENT_SLOTS` map; the tests' expected sets,
the label-contract test, and the B6 discard test (whose stale-file case becomes a company-only
slot like `lgu-permits`).
**Verification:** `npm test` (machine).

✅ **DONE (2026-10-19)** — company: `business-permit`, `lgu-permits`, `dti-certificate`,
`bir-registration`; individual: `bir-registration` alone, sharing the company's BIR definition.
`npm test` **550 passing, 0 failing**. The tests now also assert that **no slot title mentions an
ID or selfie** — the redundancy that caused round 2 cannot creep back without failing a test.

### B10 — A four-item "what's missing" sentence  ✅ DONE (2026-10-19)
**File:** `vendor/lib/kycDocumentSlots.ts` (new `listAnd`), `useKycSubmitForm.ts` (`docsBlockedReason`)

I8's reason line joins missing titles with `" and "`. With one missing slot that reads fine; with
four it becomes "Attach your Business permit and LGU Permits and DTI Certificate / Business
registration and BIR Registration documents to continue." — which is now the **first** thing a
company sees on the step.
**Fix approach:** a `listAnd(items)` helper in the slot module (comma-separated, final "and"),
unit-tested there, used by `docsBlockedReason`. In `lib/` rather than the hook because it is the
only way the repo can machine-check the copy, and the sentence is now four items long.
**Verification:** `npm test` for the helper; the Playwright spec asserts the rendered sentence.

✅ **DONE (2026-10-19)** — `listAnd` in the slot module, unit-tested for 0–4 items. A company with
nothing attached now reads "Attach your Business permit, LGU Permits, DTI Certificate / Business
registration and BIR Registration documents to continue.", and the spec asserts that string plus the
two- and one-item forms as slots fill.

### B11 — Drop hint support, now that nothing uses it  ✅ DONE (2026-10-19)
**File:** `kycDocumentSlots.ts` (`hint`), `KycSubmitForm.tsx` (the hint branch), `KycSubmitForm.module.css` (`.slotHint`)

I2's hint existed only to explain why a Government-issued ID upload sat one screen before an ID
photo. That slot is gone, so the redundancy it apologised for is gone with it. Keeping an optional
field no slot sets is speculative generality.
**Fix approach:** remove the field, its render branch, its CSS and the test that asserted it. An
empty slot row then shows its title and an Attach button, which is also less to read down four rows.
**Verification:** `tsc`, `npm run lint`, the visual suite.

✅ **DONE (2026-10-19)** — `hint` removed from the interface, the render branch, `.slotHint` and the
test. An empty slot row is now its title plus Attach. I2's hint text is gone with the slot it
explained; the item stays in this plan as the record of why it existed.

### B12 — Update the behaviour spec for the new set  ✅ DONE (2026-10-19)
**File:** `vendor/visual-tests/kyc-document-slots.spec.ts`

Every assertion naming Government-issued ID, and the company gate (now four attachments before
Continue enables).
**Verification:** `npx playwright test visual-tests/kyc-document-slots.spec.ts` (machine).

✅ **DONE (2026-10-19)** — **9 tests, all passing** (was 7). Two are new: a company sees four slots
and **no** Government-issued ID anywhere, and a document shared by both types (BIR) **survives** a
type switch, where a company-only one is discarded. That second case is the edge round 2 created —
B6 must drop `lgu-permits` but keep `bir-registration`, and nothing else would have caught it.

### I9 — Re-correct the three architecture docs  ✅ DONE (2026-10-19)
**File:** `architecture/vendor-kyc.md` (the slot table), `architecture/portals.md` (registration paragraph), `architecture/schema.md` (the slug example in the `kyc_document_types` note)

S6 wrote the round-1 set into all three this morning; leaving them is worse than never having
written them.
**Verification:** read-level.

✅ **DONE (2026-10-19)** — `vendor-kyc.md`'s slot table rewritten with all five rows plus a note on
why the ID slot went; `portals.md`'s registration paragraph; `schema.md`'s slug example. Also fixed
the slot module's own header comment, which still named the round-1 values. A grep for
`government-issued-id` now returns only deliberate historical notes and the spec's negative assertion.

### F1 — Finding: the 25 MB packet total is reachable again  ✅ RECORDED (2026-10-19)
Round 1's DEFERRED note said the client-side total "can never fire" because two slots cap out at
2 × 10 MB. **Four slots cap out at 40 MB**, so the check is live again and a company with large
scans can now hit it in the browser instead of after uploading. The note below is corrected rather
than left standing. `MAX_DOC_COUNT` is still unreachable (4 + 2 identity = 6, cap is 12).

### ⚠️ Raised, not decided: "Business permit" and "LGU Permits" may be the same document
A mayor's/business permit is issued by the LGU, so a company may read these two rows as one
document asked for twice — the exact complaint that started round 2. Built as you specified; the
titles live in one file and are a one-line change if you want them merged or reworded. Also noted:
the four titles mix sentence case and Title Case ("Business permit" vs "LGU Permits" vs "BIR
Registration documents"), kept as you typed them rather than silently normalised.

---

## Round 3 — one document for companies, none for individuals (2026-10-20)

Your feedback after reviewing round 2: a company only needs the **Business permit** and the
**Accreditation / License No.** — LGU, DTI and BIR come off. An individual needs **no documents at
all**, so the documents step must not appear for them: step 1 goes straight to the ID and selfie.

⚠️ **This is the first round that changes the wizard's shape, not its data.** Steps 1–4 are
currently hardcoded (`useKycSubmitForm.ts:40-46`) and the header, progress bar and both Back
buttons count on all four existing (`KycSubmitForm.tsx:30, 34, 132`). An individual now has three
screens, and every one of those places has to agree about that.

**The set after this round:**

| Applicant type | Documents step | Slots | Stored `label` |
|---|---|---|---|
| `company` | yes — accreditation no. + one upload | Business permit | `business-permit` |
| `individual` | **skipped entirely** | none | — (only the two identity photos) |

**Backend, re-checked rather than assumed — still no change needed.** An individual's packet is the
two identity photos and nothing else; `lib/kycSubmission.ts:58` requires `documents.length >= 1`,
which two satisfies, and `ltoNo` is already `null` for individuals (`:55`). No route, validator,
schema or policy is touched.

### B13 — Company keeps one slot; individual has none  ✅ DONE (2026-10-20)
**File:** `vendor/lib/kycDocumentSlots.ts`, `vendor/lib/kycDocumentSlots.test.ts`

`KycSlotValue` collapses to `"business-permit"`; `KYC_DOCUMENT_SLOTS` becomes
`{ company: [BUSINESS_PERMIT], individual: [] }`. `submissionDocuments` already skips absent slots
and appends the identity pair, so an individual's payload falls out correctly with no branch —
worth a test that says so explicitly.
**Verification:** `npm test` (machine).

✅ **DONE (2026-10-20)** — `KycSlotValue` is now the single literal `"business-permit"`; `individual`
is an empty list. A test states the individual case outright: their payload is the two identity
photos and nothing else, which still satisfies the server's "at least one document".

### B14 — A step model per applicant type  ✅ DONE (2026-10-20)
**File:** new `vendor/lib/kycWizardSteps.ts` + `vendor/lib/kycWizardSteps.test.ts`

The weak implementation this plan must forbid: sprinkling `kycType === "individual" ? 3 : 2`
through the hook and the render. There are four places that would each need it
(`useKycSubmitForm.ts:93`, `:144`, `KycSubmitForm.tsx:132`, `:166`) and the first one missed is a
vendor staring at a documents step that should not exist.

**Fix approach:** follow `lib/kioskSteps.ts`, which solves exactly this for the kiosk — a pure,
own-module step list with a conditional step removed, unit-tested, and documented as "a rule whose
failure is invisible until a customer is standing in front of a step that should not exist".
Here: `stepsFor(kycType)` → `[1, 2, 3, 4]` for a company and `[1, 3, 4]` for an individual, plus
`nextStep(steps, current)` / `prevStep(steps, current)` so navigation is a walk along that list
rather than arithmetic. Step **ids stay stable** (1 type · 2 documents · 3 identity · 4 review) so
`KYC_STEP_LABELS` and every `step === n` branch keep working; only the *list* is type-dependent.
**Separation:** a pure `lib/` module, no JSX, relative `.ts` imports and no `services/` import, for
the same `node --test` reason as B1.
**Verification:** `npm test` (machine) — both lists, and that next/prev skip the missing step in
both directions.

✅ **DONE (2026-10-20)** — `lib/kycWizardSteps.ts` + test: `stepsFor`, `nextStep`, `prevStep`,
`stepPosition`. 16 assertions, including both ends of each list, and that a step the list does not
contain is not a destination. `npm test` **556 passing** (was 550).

### B15 — The hook navigates by the model  ✅ DONE (2026-10-20)
**File:** `useKycSubmitForm.ts:40-46, 91-93, 144, 203`

`KYC_STEPS` stops being a constant and becomes `steps = stepsFor(kycType)` (with the full list
before a type is chosen, so step 1's chrome is unchanged). `handleTypeContinue` and
`handleDocsContinue` advance with `nextStep`; a new `goBack()` uses `prevStep`. The hook exposes
`steps`, `stepPosition` (1-based index in that list) and `stepCount`.
**Verification:** `tsc`; the spec drives it end to end.

✅ **DONE (2026-10-20)** — `KYC_STEPS` is gone; the hook derives `steps`, `stepPosition` and
`stepCount`, and exposes `goBack()`. `handleTypeContinue` and `handleDocsContinue` advance via
`nextStep`. `goToStep` left the hook's public surface — nothing outside it needed it once the three
Back buttons became `goBack`.

### B16 — The render reads position from the model  ✅ DONE (2026-10-20)
**File:** `KycSubmitForm.tsx:5, 30, 34, 132, 166`

Header becomes `Step {stepPosition} of {stepCount} — {KYC_STEP_LABELS[step]}`, so an individual
reads "Step 2 of 3 — Identity". The progress bar maps `steps`, so it shows three segments. The
identity step's `onBack` and the review step's Back both call `goBack()` instead of
`goToStep(2)` / `goToStep(3)`.
**Separation:** `.tsx` stays pure render; the model and the handlers come from the hook.
**Verification:** `tsc`, the spec, the visual suite.

✅ **DONE (2026-10-20)** — header, progress bar and all three Back buttons now read from the model.
An individual sees "Step 2 of 3 — Identity" and a three-segment bar, both asserted in the spec.

### B17 — Remove `listAnd`, obsolete at one slot  ✅ DONE (2026-10-20)
**File:** `lib/kycDocumentSlots.ts`, its test, `useKycSubmitForm.ts` (`docsBlockedReason`)

Round 2 added it because a company could be missing four documents at once. A company can now be
missing exactly one, so every branch except the single-item case is dead. Removed rather than kept
"in case"; it is one `git show` away in the round-2 commit if the set grows again.
**Verification:** `npm test`, `npm run lint`.

✅ **DONE (2026-10-20)** — helper and its test removed; `docsBlockedReason` names the single missing
title directly. Recoverable from the round-2 commit if the set ever grows again.

### I10 — The welcome step's copy is now wrong on two counts  ✅ DONE (2026-10-20), accepted by the user (2026-10-21)
**File:** `components/kyc/KycWelcomeStep/KycWelcomeStep.tsx:13-14`

`NEED` promises "Business permit or DTI / SEC" — DTI is no longer collected from anyone — and
`STEPS` lists four steps including "Business documents", which an individual will not see. The
screen appears **before** the applicant type is chosen, so it cannot be exact for both routes.
**Fix approach:** the smallest honest wording — drop the DTI clause, and mark the documents step as
company-only. ⚠️ **Proposed, not settled: this is screen copy and yours to reword** — it is two
array literals in one file.
**Verification:** read-level + the visual suite (this screen has committed baselines).

✅ **DONE (2026-10-20)** — "Business permit or DTI / SEC" → "Business permit (companies)", and the
steps list marks "Business documents" as company-only. ⚠️ **This changed two committed baselines**
(`kycstatus-welcome-light`, `kycstatus-welcome-dark`); both were regenerated **scoped to those two
panes**, not by a blanket update, and the full suite then passed at 217. If you reword the copy, the
same two regenerate with one command.

✅ **CLOSED by the user 2026-10-21** — *"I10 looks good here. It looks right, you can cross that
off."* Judged on the staging screen, which is the only way copy can be settled.

⚠️ **One correction to the record.** When this was raised on 2026-10-21 it was described as the
screen contradicting itself — "three numbered steps under a heading claiming four". **That was
wrong**, and the mistake was not reading the render before describing it: `STEPS` has four entries
and `KycWelcomeStep.tsx:59-61` maps all four for **every** applicant, because the screen is shown
*before* the applicant type is chosen. So the heading's "4 short steps" (`:56`) and the list agree
with each other. What remains is milder and is what the user accepted: an individual is told "4
short steps" here and then walks three, mitigated by the "(companies)" qualifier on the documents
line. No self-contradiction, no code owed.

### I11 — Spec for the skipped step  ✅ DONE (2026-10-20)
**File:** `vendor/visual-tests/kyc-document-slots.spec.ts`

The round-2 assertions all assume an individual has a documents step. New shape: a company sees one
slot and reaches identity after it; **an individual goes from step 1 straight to the identity
step**, reads "Step 2 of 3", and Back from there returns to the applicant type rather than to a
documents step that no longer exists. That Back path is the one most likely to be got wrong and the
least likely to be noticed.
**Verification:** `npx playwright test visual-tests/kyc-document-slots.spec.ts` (machine).

✅ **DONE (2026-10-20)** — rewritten into two groups, **10 tests, all passing**. Company: the permit
gate and its copy, the round-2 documents all absent, the identity hop with Back returning to the
documents, replace/remove, keyboard focus. Individual: step 1 goes straight to identity, the header
reads "Step 2 of 3", the bar has three segments, **Back returns to the applicant type**, switching
back to company restores the step, and a permit attached as a company does not follow them over.

### I12 — Architecture docs, third pass  ✅ DONE (2026-10-20)
**File:** `architecture/vendor-kyc.md` (step table + slot table), `architecture/portals.md`, `architecture/schema.md` (slug list)

All three name the round-2 set, and `vendor-kyc.md`'s onboarding table still says every applicant
has four steps.
**Verification:** read-level.

✅ **DONE (2026-10-20)** — `vendor-kyc.md` (onboarding table now states the per-type step counts,
slot table down to one row, individual noted as skipping the step), `portals.md`, `schema.md`.

### D5 — How an individual's steps are numbered  → **ids stay 1–4, display is derived** (recorded 2026-10-20)
The alternative was renumbering individual's steps to 1-2-3 internally, which would make every
`step === 3` branch mean different screens for different applicants — the kind of thing that reads
fine and breaks a year later. Ids stay stable; only the displayed position and the progress bar are
derived from `stepsFor`.

---

## Round 4 — no accreditation number, DTI + Mayors permit, and I4's display fixes (2026-10-21)

Two things in one round: the company document set changes again, and the two **I4-lite** display
fixes you approved. The set after this round:

| Applicant type | Documents step | Slots, in order | Stored `label` |
|---|---|---|---|
| `company` | yes — uploads only, **no accreditation field** | DTI Document · Mayors permit | `dti-document` · `mayors-permit` |
| `individual` | skipped entirely | none | — |

⚠️ **This round is NOT frontend-only, and that is the gap the review found.** `vendors.accreditation_no`
is nullable (`20260504000002_schema.sql:63`) and signup already writes `null`, so **no migration is
needed** — but `lib/kycSubmission.ts:51` *rejects* a company submission with an empty `ltoNo`, and
`app/api/kyc/submit/route.ts:142-150` writes the value and 500s + rolls back if the write misses.
Deleting the field from the UI alone would fail every company submission. **D6** resolves it.

### B18 — The server stops requiring an accreditation number  ✅ DONE (2026-10-21)
**File:** `vendor/lib/kycSubmission.ts:50-55, 81`, `vendor/lib/kycSubmission.test.ts:36`

**Fix approach:** drop the "required for companies" branch; keep parsing and length-capping `ltoNo`
so a stray body field is still rejected if absurd, and keep returning it so the type is unchanged.
⚠️ `kycSubmission.test.ts:36` asserts the **old** rule ("a blank one is refused") — that test is
inverted, not deleted, so the new contract is pinned rather than merely un-tested.
**Verification:** `npm test` (machine).

✅ **DONE (2026-10-21)** — the required-for-companies branch is gone; `ltoNo` is still parsed and
length-capped, because the body is attacker-shaped input and an absurd value should be refused
rather than ignored. The old assertion was inverted into two: a blank value is accepted and stored
as `null`, and a body omitting the key entirely — what the form now posts — is accepted the same
way. `npm test` 560 passing.

### B19 — The route stops writing, and stops announcing, the accreditation number  ✅ DONE (2026-10-21)
**File:** `vendor/app/api/kyc/submit/route.ts:138-150, 190`

Writing `null` would **wipe** a value Command had set, so the update is skipped entirely rather
than made conditional on `kycType`. The Command notification's `data.accreditation_no` becomes
always-null and goes with it — checked first: Command reads the number from the `vendors` table
(`command/services/vendors.service.ts:152, 189`), never from the notification payload.
**Verification:** `tsc`; `grep` for remaining readers (machine). The write path itself needs
staging (live).

✅ **DONE (2026-10-21)** — the `vendors` update is **removed outright**, not guarded: with no field
there is no value, and an unreachable branch would only invite someone to "fix" it later by writing
the null. `data.accreditation_no` dropped from the Command notification (verified first that Command
reads the number from `vendors`, `command/services/vendors.service.ts:152, 189`, never from the
payload). The route now touches only `vendor_kyc` and `vendor_kyc_documents`.

### B20 — The client stops sending it, and the form stops asking  ✅ DONE (2026-10-21)
**File:** `vendor/services/kyc.service.ts:127, 172`, `useKycSubmitForm.ts` (`ltoNo`, `ltoError`, `updateLtoNo`, `LTO_REQUIRED`, the `docsBlockedReason` branch, the `handleSubmit` argument), `KycSubmitForm.tsx` (the `RF` block, the review row, the `RF` import if it falls unused)

**Fix approach:** remove `ltoNo` from `SubmitFirstKycParams` and the POST body, then delete the
field and every piece of state behind it. `docsBlockedReason` loses its accreditation branch and
keeps only "choose a type" and "attach your …".
**Separation:** the `.tsx` loses markup only; all removed state was already in the hook.
**Verification:** `tsc`, `npm run lint`, `grep` for `ltoNo` (machine); the spec drops its
accreditation assertions.

✅ **DONE (2026-10-21)** — `ltoNo` gone from `SubmitFirstKycParams`, the POST body, and every piece
of hook state (`ltoNo`, `ltoError`, `updateLtoNo`, `LTO_REQUIRED`, the `docsBlockedReason` branch).
The `RF` field and the review row are gone, and the `RF` import with them. The documents step now
has **no text input at all**, which the spec asserts. ⚠️ Two unused-variable warnings appeared on
the way (`route.ts` destructuring `ltoNo`, a throwaway in the test) and were fixed — lint is back
at its pre-existing **29**, not 31.

### B21 — DTI Document above Mayors permit  ✅ DONE (2026-10-21)
**File:** `vendor/lib/kycDocumentSlots.ts`, its test

`business-permit` → **`mayors-permit`** ("Mayors permit"), and a new **`dti-document`** ("DTI
Document") **first** in the company list. Individual stays empty.
⚠️ **Historical rows keep their old labels** — `business-permit` from rounds 1–3, and
`government-issued-id` / `lgu-permits` / `dti-certificate` / `bir-registration` from the earlier
rounds. Nothing is renamed in the database; B22 is what stops those reading as raw slugs.
**Verification:** `npm test` (machine).

✅ **DONE (2026-10-21)** — `dti-document` ("DTI Document") first, then `mayors-permit` ("Mayors
permit"). Individual stays empty.

### B22 — `titleForLabel`, so stored slugs read as words  ✅ DONE (2026-10-21)  *(I4 finding 2)*
**File:** `vendor/lib/kycDocumentSlots.ts` + test, used by `KycStatusPage.tsx:87`

A vendor whose packet is rejected currently reads `mayors-permit` in "Already submitted". A lookup
maps every label this product has ever stored — current slots **and** the retired
`business-permit`, `government-issued-id`, `lgu-permits`, `dti-certificate`, `bir-registration` —
to a readable title, falling back to the raw string so free-typed historical labels pass through
untouched. Display only: nothing stored changes, and Command is a different app, out of scope.
**Verification:** `npm test` for the map and the fallback (machine).

✅ **DONE (2026-10-21)** — `titleForLabel` maps the two current slots plus all five retired labels
(`business-permit`, `government-issued-id`, `lgu-permits`, `dti-certificate`, `bir-registration`)
and falls back to the raw string, so free-typed labels from the resubmit editor pass through. Used
at `KycStatusPage.tsx:84`. Tested for all three paths.

### B23 — Delete the stale suggestions line from the resubmit editor  ✅ DONE (2026-10-21)  *(I4 finding 1)*
**File:** `vendor/components/kyc/KycStatusPage/KycStatusPage.tsx:3, 73-76`, `vendor/services/kyc.service.ts:26-29`

It tells a rejected company to consider "DTI / SEC Registration, Authorized Representative ID,
Proof of Address" and a rejected individual "Government-issued ID, Selfie with ID, Proof of
Address" — none of which the first submission asks for. Deleted rather than rewritten: after a
rejection the instruction is the reviewer's note, which sits directly above it.
`KYC_SUGGESTIONS` then has **no vendor-side consumer** (verified) and goes too; Command keeps its
own copy in `command/services/kyc-admin.service.ts`, untouched.
**Verification:** `grep`, `npm run lint`, the visual suite (machine).

✅ **DONE (2026-10-21)** — the line is gone, `KYC_SUGGESTIONS` is deleted from
`vendor/services/kyc.service.ts` (no vendor-side consumer remained; Command's own copy untouched),
and the orphaned `.suggest` / `.suggestVal` rules were removed from the module CSS.

### I13 — The welcome chip names a document that no longer exists  ✅ DONE (2026-10-21)
**File:** `vendor/components/kyc/KycWelcomeStep/KycWelcomeStep.tsx:14`

You accepted this copy on 2026-10-21, and the rename invalidates one chip: "Business permit
(companies)". Smallest honest edit is naming the two documents a company now brings.
⚠️ **This regenerates the two `kycstatus-welcome` baselines again** — say the word if you would
rather leave the chip and keep the baselines still.
**Verification:** the visual suite (machine); wording is yours.

✅ **DONE (2026-10-21)** — the chip reads "DTI document and mayors permit (companies)".
The browser suite was blocked for part of this round by a `next dev` on :3000 (the user stopped it);
once free, `kycstatus-welcome-light/dark` were the **only** two baselines that differed, exactly as
predicted, and both were regenerated scoped to those panes. Full suite then **217 passing**.

### I14 — Architecture docs, fourth pass  ✅ DONE (2026-10-21)
**File:** `architecture/vendor-kyc.md`, `architecture/portals.md`, `architecture/schema.md`

The step table still says a company "enters the accreditation/license no. here", and all three name
`business-permit`. `vendor-kyc.md` also documents the submit route's accreditation write.
**Verification:** read-level.

✅ **DONE (2026-10-21)** — `vendor-kyc.md` (step table, a new bullet stating no accreditation number
is collected and that Command is now the only place it is set, the submit-route summary, the slot
table with the four-round history and the `titleForLabel` note, and the resubmit section's two
2026-10-21 fixes), `portals.md`, `schema.md`.

### F2 — Finding: removing `listAnd` in round 3 broke round 4's message  ✅ FIXED (2026-10-21)
**File:** `lib/kycDocumentSlots.ts`, `useKycSubmitForm.ts` (`docsBlockedReason`)

B17 deleted `listAnd` on the stated grounds that "a company can now be missing exactly one
document, so every branch except the single-item case is dead", and `docsBlockedReason` was changed
to name `missingSlotTitles(...)[0]`. Round 4 gave companies two slots again, so the step told a
company with nothing attached to "Attach your **DTI Document** to continue." and silently omitted
the mayor's permit. **The Playwright spec caught it on the first run** — no human saw a wrong
screen.

Helper and its test restored, with the history in the comment: it stays regardless of set size,
because this set has now changed four times in three days. The honest lesson is that B17's
reasoning was sound about the code and wrong about the product — "the set cannot grow" was never
a safe assumption here, and the cost of keeping eight lines was lower than the cost of being wrong.
**Verification:** `npm test` (563 passing, the helper's own cases plus one asserting both company
titles), and the spec assertion that failed now passes.

### D6 — How the accreditation requirement comes out  → **relax the validator and skip the write** (resolved 2026-10-21, user)
The alternative offered was keeping the field and making it optional, which is not what was asked.
Chosen: `ltoNo` becomes optional server-side and the `vendors.accreditation_no` write is skipped so
a Command-set value survives. No migration, no RLS, no auth change; the column and Command's own
add/edit field stay exactly as they are.

---

## Round 5 — retire the "lto" naming (2026-10-21)

A vendor is not a driving school. `lto` is the Land Transportation Office, the agency that
accredited driving schools in the **pre-pivot DriveBook** product; the pivot renamed the column to
`vendors.accreditation_no` but left the name behind in the vendor app's own variables. Round 4
removed the field from KYC, which makes this the moment to finish the job.

**Scope: `vendor/` only.** Out of scope and verified so: `command/` already calls it `accred`
(`VendorFormModal.tsx:24`, `useVendorForm.ts:25`) with no lto naming and no required validation —
nothing to change there; `booker/`, `backbone/` and both Expo apps contain no `lto` reference for a
vendor at all (the one hit in `backbone/supabase/seed.sql:680` is prose inside a seeded offering
description — "an LTO-accredited instructor" — which is sample content for a driving lesson, not a
vendor property).

**The accreditation number itself stays.** It remains an optional field in two places, both already
built and both already optional: Command's add/edit vendor form, and the vendor's own business
profile. Only the *names in code* change.

### B24 — `ltoAccredNo` → `accreditationNo` on the vendor profile  ✅ DONE (2026-10-21)
**File:** `vendor/lib/types.ts:413`, `vendor/services/profile.service.ts:42, 83`, `vendor/components/profile/ProfilePage/ProfilePage.tsx:59`

The vendor's own profile carries the column under the lto name. The label on screen is already
"Accreditation / License No." — only the identifier is wrong.
**Why this is safe to rename mechanically (checked, not assumed):** the edit draft is in-memory
React state (`useProfilePage.ts:10, 22`), **not** localStorage, so no stored draft is stranded; and
`Field`'s prop is typed `field: keyof VendorProfile` (`ProfilePage.helpers.tsx:21`), so every call
site is compiler-enforced — a missed rename is a type error, not a silent runtime miss.
**Separation:** a rename only; no state moves between hook and render.
**Verification:** `tsc`, `npm run lint`, `grep` (machine); the profile's visual baselines must be
unchanged, since nothing rendered changes.

✅ **DONE (2026-10-21)** — renamed in all four places. The on-screen label was already
"Accreditation / License No." and is untouched, so nothing rendered changes. `tsc` clean, lint
unchanged at 29.

### B25 — Remove `ltoNo` from the KYC submission contract  ✅ DONE (2026-10-21)
**File:** `vendor/lib/kycSubmission.ts:29, 36, 50-56, 81`, `vendor/lib/kycSubmission.test.ts`

Per **D7**: the field, its parsing, `MAX_LTO_LENGTH` and its tests come out. Nothing sends it and
nothing writes it, so parsing it protects nothing; an unknown body key is ignored by the validator,
so a stale browser bundle still posting `ltoNo` is harmless — the value was already optional.
⚠️ The route destructures `valid.value`; `ltoNo` is already not destructured there (round 4), so
removing it from the type is the last step rather than the first.
**Verification:** `npm test`, `tsc` (machine).

✅ **DONE (2026-10-21)** — the field, its parsing, `MAX_LTO_LENGTH` and the accreditation test cases
are gone; `KycSubmission` is now `{ vendorId, kycType, documents }`. Two cases replaced them: a
well-formed company submission, and one asserting a body still carrying the old key is accepted
with the key **ignored** — the stale-bundle path, pinned rather than assumed. 560 tests passing.
⚠️ A regex pass over the test file left a stale case and an orphaned comment behind; both were
caught by `tsc` and repaired before the run.

### B26 — Remove `"ltoNo"` from `RegisterField`'s union  ✅ DONE (2026-10-21)
**File:** `vendor/components/auth/LoginPage/RegisterField.tsx:9`

Orphaned since round 4 — verified that no component passes `field="ltoNo"` any more.
**Verification:** `tsc`, `grep` (machine).

✅ **DONE (2026-10-21)** — removed from the union; `tsc` confirms no call site passed it.

### I15 — The last lto mentions: a fixture and two comments  ✅ DONE (2026-10-21)
**File:** `vendor/visual-tests/referral-deeplink.spec.ts:53`, `vendor/lib/kycDraft.ts:49`, `vendor/services/kyc.service.ts:163`, `vendor/app/api/kyc/submit/route.ts:57, 140`

The spec seeds a **v4 signup draft** containing `ltoNo: ""`; `kycDraft.ts:49` is the comment
explaining that v4 drafts carried `kycType` and `ltoNo` and are read without a version bump.
⚠️ **The fixture's key is deliberate and must not simply be renamed** — it reproduces a draft as it
was written on a real device before 2026-09-30, and renaming it would make the test assert a shape
that never existed. It stays, with a comment saying why. The historical comment in `kycDraft.ts`
stays for the same reason. The two round-4 comments in the service and the route are reworded to
say "accreditation number" rather than `ltoNo`.
**Verification:** `npm run test:visual` for the fixture (machine); the rest is read-level.

✅ **DONE (2026-10-21)** — the two round-4 comments now say "accreditation number"; the fixture
keeps `ltoNo` and gained the ⚠️ comment explaining why renaming it would be wrong. Every surviving
mention in `vendor/` is now one of three deliberate kinds: a test asserting the old key is **not**
carried (`kycSubmission.test.ts`, `registration.test.ts`), the v4-draft history comment
(`kycDraft.ts:49`), or that fixture. **No vendor property is named `lto` any more.**

### I16 — Docs: name the rename  ✅ DONE (2026-10-21) — smaller than planned, see note
**File:** `architecture/vendor-kyc.md`, `architecture/conventions.md` if it names the field

One line: the vendor app no longer uses `lto` for a vendor property; the column is
`vendors.accreditation_no`, the profile type field is `accreditationNo`, and KYC does not carry it.
**Verification:** read-level.

✅ **DONE (2026-10-21)** — ⚠️ **downgraded on inspection:** the architecture docs never used
`ltoNo` or `ltoAccredNo` at all, so there was nothing to correct — `grep` over `architecture/*.md`
returns none. What was added instead is the note that prevents a reintroduction: `vendor-kyc.md`
now records where the name came from (pre-pivot DriveBook), that no vendor property carries it,
what each layer calls the field, and why the one fixture keeps the old key. The same bullet now
also says the number stays optional in **both** Command's form and the vendor's own profile.

### D9 — Enforce a required document set on resubmission?  → **no, leave it free-text** (resolved 2026-10-21, user)
Three options were put: leave it; require the set and treat historical documents as not counting;
or require the set with an explicit alias map the user would supply. Chosen: **leave it**, on the
recommendation that nothing today suggests rejections are frequent enough to need it, and that the
alias map would be guesswork dressed as a rule. Recorded at I4 with its reopen conditions.

### D7 — What happens to `ltoNo` in the KYC submission contract  → **removed entirely** (resolved 2026-10-21, user)
The alternative was renaming it to `accreditationNo` and keeping it parsed. Removed instead: no
caller sends it, nothing writes it, and an unknown key is ignored, so the only thing a retained
field would buy is a door that is cheaper to re-open than to hold.

### D8 — Does the profile's accreditation field stay visible to individuals  → **yes, shown to everyone** (resolved 2026-10-21, user)
Company-only would need the profile to read `vendor_kyc.kyc_type`, which it does not query today —
a second read and a loading state, for a field that is optional and simply blank for an individual.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. None are open. -->

- **D4 — The new slots' stored labels (round 2)** → **derived from D1's convention**: lowercase,
  hyphenated, from the title — `lgu-permits`, `dti-certificate`, `bir-registration` (recorded
  2026-10-19). Not asked separately: D1 already fixed the shape, the server accepts any non-empty
  label, and all four live in one file, so a different slug is a one-line change. `government-issued-id`
  is retired from the UI; rows already stored under it are untouched.
- **D1 — What the two slots store in `vendor_kyc_documents.label`** → **the prompt's literals:
  `business-permit` and `government-issued-id`** (resolved 2026-10-19, user; `government-issued-id`
  **superseded by round 2 / D4** the same day — the slot was redundant with the identity step). Accepted by the server
  unchanged (see the compatibility note above). Known cost, accepted: Command's review panel prints
  the label verbatim (`KycPanel.tsx:64`), so a reviewer sees `business-permit` beside historical rows
  reading `Business Permit`, and the vendor's own "Already submitted" list does the same
  (`KycStatusPage.tsx:87`). The rejected alternatives were the dormant catalogue's codes
  (`business_permit`, `government_id`) and the human-readable titles.
- **D2 — Does the rejected-application resubmit editor get the same slots?** → **No: left exactly as
  it is** (resolved 2026-10-19, user). Historical documents are not renamed, deleted, or required to
  be replaced, and no historical-label mapping is invented. Recorded as I4.
- **D3 — Recorded, no action: this reverses `2026-07-03-vendor-kyc-storage.md` D-1 = B
  ("free-form + guidance") in the vendor UI only.** The column stays free text, `kyc_document_types`
  stays dormant and unreferenced, and Command's free-text assumptions are untouched — so the reversal
  is a UI constraint, not a data-model change. Noted here because a plan that silently diverges from
  a documented decision is a bug in the plan; I5 writes it down where the docs can be read.

---

## DEFERRED / COSMETIC

- **A stale plan reference in a code comment.** `useKycSubmitForm.ts:53` cites
  `.plans/2026-07-06-accreditation-company-only.md`, which does not exist in `.plans/`. Reported,
  not fixed — it is outside this change's lines and renaming it is someone's decision, not a side
  effect of this work.
- **`kyc_document_types` remains unread by every app.** This plan hardcodes the slots in the frontend
  rather than querying it, because the scope is frontend-only and a network read would add a failure
  mode to a step that currently has none. Acceptable now; the table is the natural home if slots ever
  become vendor- or division-specific.
- **`KYC_MAX_DOC_COUNT` / `KYC_MAX_TOTAL_BYTES` client re-exports stay** (`services/kyc.service.ts:38-40`)
  even though B3 drops the count branch — the total is still used, and the resubmit path imports from
  the same module.
- ~~**The client-side 25 MB packet total is now near-dead**~~ — **corrected 2026-10-19 by round 2
  (F1): four company slots cap out at 40 MB, so the check is live again.** The second half of the
  note below still stands: it has never covered the identity photos.
- **The client-side 25 MB packet total never covered the identity photos**
  (review gap 5). `useIdentityStep.ts:37-41` checks MIME and 10 MB per file but nothing adds the two
  captures to a packet total, and the form sums only the document list (`useKycSubmitForm.ts:93-97`).
  After this change the client total can reach at most 2 × 10 MB and so can never fire, while two
  slots plus two *uploaded* identity files can still reach ~40 MB — refused by the route
  (`app/api/kyc/submit/route.ts:108`) **after** every file has been uploaded. Pre-existing, untouched
  here because fixing it means changing identity-step handling, which this plan must not do. The
  check is kept rather than deleted: it costs nothing and stays correct if slots ever grow.
- **Two other `display: none` file inputs are left alone** — `KycStatusPage.module.css:238` (the
  resubmit editor, out of scope under D2) and `IdentityStep.module.css:73` (the identity step, which
  this plan must not touch). I6 fixes only the inputs it creates, so the keyboard gap survives in
  those two places; reported, not silently widened into them.

---

## Execution order

Ordered by dependency, and so no intermediate stage leaves the form broken.

1. ✅ **S1 — B1** (2026-10-19). The lib module and its test, alone. Nothing imports it yet; `npm test` goes green or
   the rule is wrong before any UI moves.
2. ✅ **S2 — B3, B6, B4, B7** (2026-10-19). The hook, in that order: state and handlers first, then the type-switch
   reset, then the gates, then the payload. `tsc` is the check at each step; the form's `.tsx` still
   compiles against the old prop names only once B2 lands, so S2 and S3 ship together in one commit.
3. ✅ **S3 — B2, B5, I1, I2, I3, I6** (2026-10-19), plus I8, found while writing S4's spec. Render and CSS: slots replace the add row (with focusable
   inputs, I6), the accreditation field moves in, the review step and the hint copy follow, the dead
   import goes.
4. ✅ **S4 — I7** (2026-10-19). The behaviour spec, written against the finished UI. It goes after S3 on purpose: it
   is the check for B4 and B6, and a spec written before the markup exists would be written to match
   the plan rather than the product.
5. ✅ **S5 — the verification sweep** (2026-10-19; results recorded under Verification) below, with the baseline numbers captured *before* S1.
6. ✅ **S6 — I5** (2026-10-19), the root-repo documentation line, if you want it in this round.

Per `AGENTS.md` → Execution Cadence, the default is **one stage, then a report**. S2 and S3 are one
stage for the reason given above — the hook's exports and the render's props must change together.

---

## Verification

**Machine-verifiable — all run 2026-10-19, after S4. Baselines were captured before S1:**

| Check | Before S1 | After S4 |
|---|---|---|
| `npx tsc --noEmit` | clean | **clean** |
| `npm test` | 532 passing, 0 failing | **547 passing, 0 failing** (+15 from B1's test) |
| `npm run lint` | 29 problems (26 errors, 3 warnings) | **29 problems (26 errors, 3 warnings)** — no new findings |
| `npx playwright test visual-tests/kyc-document-slots.spec.ts` | did not exist | **7 passing** |
| `npm run test:visual` (whole suite) | — | **214 passing, 0 failing, 5.5m; no baseline changed**, so the four KYC panes are byte-identical as predicted |
| `grep` | — | no `newDocLabel` / `kycDocs` / `styles.hidden` / document-name input left in the component; 0 `@/` imports in `lib/kycDocumentSlots*.ts` |

The original per-check intent is kept below for the record.


- `npx tsc --noEmit` — clean.
- `npm run lint` — unchanged from the baseline captured before S1. ⚠️ This app has pre-existing ESLint
  findings (`.plans/2026-09-25-vendor-eslint-cleanup.md`, 20 files); the claim is "no new findings",
  measured against a before-count, never "lint is clean".
- `npm test` — the existing `lib/**/*.test.ts` suite (44 files) plus B1's new one. Covers: company
  requires both slots, individual requires one, `missingSlotTitles` names what is absent, and
  `submissionDocuments` emits `business-permit` / `government-issued-id` followed by the unchanged
  `Valid ID` and `Selfie with ID`.
- `npx playwright test visual-tests/kyc-document-slots.spec.ts` (I7) — company needs both slots and
  the accreditation number, individual needs one, a type switch discards the stale slot file, and no
  document-name text input remains. This is the new UI's only automated cover.
- `npm run test:visual` — ⚠️ **it proves less than it looks like it proves.** `/ui-gallery` renders
  this form in two modes (`kycsubmit`, `kycstatus-none-suspended`; `app/ui-gallery/page.tsx:1180-1184`),
  i.e. four committed baselines, and **both render step 1 with no applicant type selected** — where
  the accreditation field is not shown today either. So the four shots are a regression check on the
  step B5 moves a field *out of*, and they photograph none of the new slot UI, which is why I7
  exists. All four are *expected* to be unchanged; the suite decides, not this sentence. A `next dev`
  running on the `vendor/` folder blocks the suite entirely whatever port is passed, and no baseline
  is regenerated without telling you which panes changed and why.
- `grep` — no `newDocLabel`, no free-text document input and no "add document" control left in
  `KycSubmitForm`; no `@/` import in `lib/kycDocumentSlots.ts` or its test (B1's constraint).

**Needs a live environment (cannot be verified here):**
- Attaching real JPG/PNG/PDF files from a device, the replace-a-filled-slot interaction, and both
  error paths (wrong MIME, >10 MB) — I7 covers the happy path with synthetic files, not a real
  picker on a phone.
- Visible keyboard focus on the slot controls (I6 — the spec proves reachability, not appearance),
  and the accreditation value surviving step 2 → 1 → 2 (B5's live half).
- A real submit against staging — it writes a packet, uploads to the private bucket and sends the
  `kyc_submitted` notice, so it is yours to run, not mine.
- How `business-permit` / `government-issued-id` read in Command's KYC panel (D1's accepted cost).
- That the identity capture and selfie steps behave exactly as before — unchanged by this plan, but
  the prompt asks for it to be confirmed, and only a device/browser can confirm it.

**Explicitly not claimed:** nothing in this plan is "verified" on the strength of a type-check. Items
whose only check is live stay 🔄 until you have run them.
