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

**Status:** IN PROGRESS — **S1–S6 executed 2026-10-19** on `vendor/` branch `feature/KYC_flow_revamp`.
All of B1–B7, I1–I3 and I6–I8 are ✅; machine verification is green (tsc clean · 547 unit tests, 0
failing · lint unchanged at its pre-existing 29 · 214 Playwright tests, 0 failing, no baseline
changed). Every executable item is now done, including S6 / I5 (the `architecture/` update, allowed by you
on 2026-10-19). Still open and all yours: **I2's wording** to accept, **I4** (the resubmit
follow-up, yours to close), the live checks listed under Verification, and the commits. Reviewed 2026-10-19 before execution (see *Review pass*):
five gaps folded in, one of which would have made S1 fail on the first `npm test`.

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

### I2 — Copy that separates the ID *document* from the ID *photo*  ✅ DONE (2026-10-19) — wording still yours to accept
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

### I3 — `KYC_SUGGESTIONS` stays exported; only this form stops using it  ✅ DONE (2026-10-19)
**File:** `KycSubmitForm.tsx:3` (remove the import), `services/kyc.service.ts:26-29` (keep)

The resubmit editor still renders it (`KycStatusPage.tsx:3, 73-76`) under D2, so the export stays.
Command keeps its own independent copy (`command/services/kyc-admin.service.ts:34`) — untouched, and
out of scope. Only the now-unused import in this file is removed.
**Verification:** `npm run lint` (an unused import is an error here), grep for remaining callers.

✅ **DONE (2026-10-19)** — the import is gone from `KycSubmitForm.tsx`; the export stays and
`KycStatusPage.tsx` still renders it. Command's independent copy untouched. Lint unchanged at 29.

### I4 — Follow-up, left open for you: the resubmit editor is still free-text  ⬜ TODO
**File:** `components/kyc/KycStatusPage/KycStatusPage.tsx:118-128`, `useKycStatusPage.ts:95-112`

Under D2 a vendor sees fixed slots on the first submission and a free-text "Add a document" box after
a rejection. Recorded, deliberately not changed, and **not to be closed by this plan** — closing it
means deciding whether a kept historical document whose label differs (e.g. `Business Permit` vs
`business-permit`) satisfies a slot, which is the ambiguous mapping the prompt asked to report rather
than guess.

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

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. None are open. -->

- **D1 — What the two slots store in `vendor_kyc_documents.label`** → **the prompt's literals:
  `business-permit` and `government-issued-id`** (resolved 2026-10-19, user). Accepted by the server
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
- **The client-side 25 MB packet total is now near-dead, and never covered the identity photos**
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
