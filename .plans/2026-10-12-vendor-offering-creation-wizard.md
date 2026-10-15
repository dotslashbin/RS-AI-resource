# Vendor: guided wizard for creating an offering

**Date:** 2026-10-12
**App / scope:** vendor/ only — `components/offerings/` (new `OfferingCreateWizard/`, `OfferingFormModal/` field extraction, `OfferingsPage/` wiring), `components/dashboard/GuideModal/guideItems.ts` copy, an appended `app/ui-gallery` fixture mode, a new scoped Playwright spec, and `architecture/portals.md`. No schema, migration, service-contract break, or dependency.
**Status:** IN PROGRESS — D1–D8 resolved; execution approved 2026-10-13 (user); all 5 stages executed 2026-10-13; B3, B4, I4 passed and F6 closed by user 2026-10-14; only I3's real-phone keyboard check remains, parked until staging

> Turn **creating** an offering into a step-by-step wizard a first-time vendor cannot get
> wrong: one job per screen, Back never loses work, Next is never a mystery, and the moment
> the offering is actually saved is named on screen rather than happening as a side effect.
> Editing stays the existing single form.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision, F# = Follow-up; numbers
> are plan-local — qualify cross-plan refs by plan (e.g. "2026-09-14 I6").

---

## Scope

**In:** the Add Offering path (the button on the Offerings page and the account-completion
modal's "Create offering" arrival, `useOfferingsPage.ts:100-107`), which today opens
`OfferingFormModal` in `mode="add"`.

**Out:** editing an offering (stays `OfferingFormModal mode="edit"`), the schedule form, the
attachments editor's internals, every `components/kiosk/**` file and `services/kiosk.service.ts`
(Codex is working there), `package.json`, existing `visual-tests/` baselines, the schema.

### Why editing stays the form (task point 1 — agreed, with a reason)
Read against the code: the edit form's job is "change one thing" — a price, a requirement, a
photo. A wizard would make that a five-screen walk, and the edit path also carries the I8
granularity-flip guard (`useOfferingsPage.ts:208-219`) and the post-save schedule prompt
logic, both of which are tuned for a single Save. No reason found to change it.

---

## What the code does today (verified 2026-10-12)

- `OfferingFormModal.tsx` (289 lines) renders every field in one scrolling Radix dialog; the
  Attachments section (`:208-227`) mounts `OfferingAttachmentsEditor` in add mode too.
- `useOfferingForm.ts` holds **all** field state and the only validation:
  - `canSave` (`:57`) = name non-blank ∧ code non-blank ∧ duration a positive integer ∧ no
    blank requirement label. A blank price is allowed and saves as 0 (`parsePrice`).
  - `uploadBlockedReason` (`:67-78`) = the same plus a **non-blank** price — used only when a
    first upload would create the offering as a side effect.
- `useOfferingsPage.createFromForm` (`:151-181`) is the one create path: de-duplicated via
  `creating`, guarded against a form closed mid-insert via `formSession`, switches the form to
  edit mode, holds `createdOffering` so the schedule prompt fires on close (`closeModal`,
  `:134-141`). Duplicate code → `createOffering` maps 23505 to "That code is already in use —
  pick a different one." (`offerings.service.ts`), shown in the form's bottom error banner.
- `handleSave` edit branch (`:190-231`) updates **and closes** the modal, then shows the prompt.
- `OfferingAttachmentsEditor` works against a real `offeringId`; with `null` it lazily creates
  through `ensureOffering`. `MAX_PHOTOS = 1` (`offeringAttachments.service.ts:30`).
- The fixture `app/ui-gallery/page.tsx:799-810` (`mode=offeringform`) renders the form in
  **add** mode; `visual-tests/pilot.spec.ts:384-416` (duration picker B1) drives it. There is
  **no screenshot baseline** of the form itself — only of the `offerings` page.

### Facts that shape the decisions
- **Cascade does not clean storage.** Deleting an offering cascades its `offering_attachments`
  rows (`20260829000001:34`) but nothing removes the storage objects; only
  `removeAttachment()` does that, best-effort. "Delete on cancel" therefore leaks public photos
  unless it removes each attachment first — and a closed tab runs no cleanup at all.
- **An active offering with no schedule is already a normal state.** Every offering is in it
  between create and its first schedule. `get_unbookable_offerings()`
  (`20261004000002`) reports it, and booker reads that set
  (`booker/services/offerings.service.ts:193`). So a wizard-created offering abandoned after
  the save is in exactly the state today's Add Offering leaves it in.
- **The KYC wizard's step chrome cannot be reused**: `KycSubmitForm.module.css` is dark-only
  (hard-coded `rgba(255,255,255,…)`), and this app defaults to `system` theme. The *pattern*
  ("Step N of M — Label", segmented bar, Back / Continue row) is borrowed; the styling uses the
  dashboard's `sp-*` tokens.
- **`ScheduleFormModal` already solved fixed header + scrolling body + fixed footer** in a
  Radix dialog (`ScheduleFormModal.tsx:98-118`, `flex flex-col overflow-hidden`). The wizard
  shell follows it rather than inventing a layout.

---

## Flow (as resolved by D1–D6, 2026-10-12)

D1 chose a **hard point of no return**, so the review moves to *before* the save: the vendor
checks everything while Back still works, and the one irreversible button sits on the review.

| # | Step | Fields (all existing) | Next enabled when (existing rule) | Back | Writes |
|---|------|-----------------------|-----------------------------------|------|--------|
| 1 | **The basics** | Name\*, Short code\*, Category, Description | name ∧ code non-blank (`canSave` parts) + code not already used (I2) | — (Cancel instead) | — |
| 2 | **Price and length** | Price, Duration qty + unit, live "One booking = …" + 30-day note | duration valid (`durQtyValid`) | ✓ | — |
| 3 | **How it works** | Fulfilment pattern, Requirements | no blank requirement (`hasBlankRequirement`) | ✓ | — |
| 4 | **Check and save** | Read-only summary with a "Change" link per section (jumps to that step); Active switch (`role="switch"`, default on) | `canSave` | ✓ | **Creates the offering** — button "Save offering" |
| 5 | **Photos and documents** | `OfferingAttachmentsEditor` against the real id | always (optional — D6); button "Finish" | **none** — replaced by "Saved. Change details later with Edit on the offering card." (D1) | Immediate, as today |

On Finish (or X/Escape on step 5) the wizard closes and the existing `SchedulePromptModal`
appears (D4). A blank price shows on step 4 as **"Free (₱0)"**, so the existing
blank-means-0 rule of `canSave` is applied visibly rather than silently — no new rule, and the
concern behind `uploadBlockedReason`'s stricter price check (a quietly free offering) is met by
showing it, because the wizard never takes the lazy-create path.

Instruction line per step (≤ 2 sentences, plain words, says what happens next). Draft copy:
1. "Name what you offer and give it a short code customers will see. Nothing is saved yet."
2. "Set what one booking costs and how long it lasts. Leave price at 0 if it's free."
3. "Tell us how a booking is completed, and anything customers must upload when they book."
4. "Check your offering. **Saving creates it** — after this you can add photos, but details are changed later with Edit."
5. "Optional. Add a photo for the kiosk — without one it shows your short code — and any documents customers must accept before paying. Each one is saved as you add it."

---

**Previews (2026-10-12):** [`previews/offering-wizard/`](previews/offering-wizard/README.md) — static
HTML + 48 screenshots of every step and state, desktop and phone, both themes. For review
before approval; not imported by the app.

## BLOCKERS

### B1 — Extract the form's field groups so wizard and edit form render the same markup  ✅ DONE (2026-10-13)
**File:** `vendor/components/offerings/OfferingFormModal/OfferingFormModal.tsx:86-262`
The wizard needs exactly the fields the form has. Copying ~180 lines of JSX would let the two
drift (a label, a placeholder, the month note) — the class of bug 2026-08-03 B1 was about.
**Fix approach:** move each group verbatim into a new pure display component under
`components/offerings/OfferingFormFields/`, and have `OfferingFormModal` render them in the
same order. Zero visual change to the edit form.
- `BasicsFields.tsx` (name, code, category + datalist, description) — props: values, setters,
  `categories`, optional `codeError`.
- `PriceDurationFields.tsx` (price, qty, unit, duration label + note).
- `PatternField.tsx` (moves `PATTERN_CHOICES` with it).
- `RequirementsField.tsx`.
- **Separation:** all four are *pure display* (component-separation §4): no state, no effects,
  handler **bodies** stay in `useOfferingForm` and arrive as props; styling is the existing
  Tailwind token classes moved unchanged — no `.module.css` because nothing non-trivial is
  added. The requirement-toggle `onClick={() => updateRequirement(id, …)}` wiring stays an
  inline arrow, as it is today (wiring, not a handler body).
- The `role="switch"` gap on the Active toggle (`:234`, a clickable `div`) is **not** fixed
  here — see F1.
**Verification:** machine — `tsc`, `lint`; the existing duration-picker spec
(`pilot.spec.ts:384-416`, run scoped with `-g "offering duration picker"`) still passes against
the unchanged `offeringform` fixture; `git diff --stat` shows `OfferingFormModal.tsx` losing
lines with no class-string changes (`grep` the moved class strings). Live — open Edit on a real
offering in both themes.
**✅ DONE (2026-10-13), machine-verified.** Four pure display components in
`components/offerings/OfferingFormFields/` (`BasicsFields`, `PriceDurationFields`,
`RequirementsField`, `PatternField`, which now holds `PATTERN_CHOICES`). `BasicsFields` and
`PriceDurationFields` return fragments, so the form's `flex-col gap` and the read-back's `-mt-2`
lay out exactly as before. `OfferingFormModal.tsx` went from 289 to 156 lines and keeps its
field order, including Pattern after Active. Checks:
`tsc` clean; `npm test` 528/528; `npm run lint` shows the same 29 problems in the same files as
the D8 baseline, and scoped `eslint` on both folders is clean. Scoped Playwright
`-g "offering duration picker"` passed 4/4. Every string literal and class string from the old
file is present in the new files. **Rendered HTML is identical:** the dialog's `outerHTML` from
the `offeringform` fixture, light and dark, initial and after edits (requirement added, unit =
month, custody selected), matched byte for byte between the original file and the new one. A
positive control (the original plus a marker) proved the swap was served. Not yet run: live Edit
on a real offering (this fixture renders add mode; the extracted groups do not depend on mode).
That check is in the Live verification list below.
`codeError` on `BasicsFields` is **not** added yet. It has no caller until I2 (Stage 4) and would
be an unused prop until then, so it lands with I2.

### B2 — A wizard-safe update path in `useOfferingsPage`  ✖ ABORTED (2026-10-12) — D1 chose a hard point of no return: nothing in the wizard edits the row after it is saved, so no update path is needed. Kept for the record.
**File:** `vendor/components/offerings/OfferingsPage/useOfferingsPage.ts:190-231`
After the save on step 3, going Back and changing a field must update the row **without**
closing the wizard. `handleSave`'s edit branch always closes and opens the schedule prompt.
**Fix approach:** split its body into `updateFromForm(item, before): Promise<boolean>` (I8
granularity guard + `updateOffering` + `setOfferings`, unchanged logic) and keep `handleSave`
as `if (await updateFromForm(...)) { close; prompt }`. The wizard calls `updateFromForm`
directly. Keeps the I8 guard on the wizard path too — a schedule cannot normally exist for an
offering created seconds ago, but a second tab can create one, and the guard is free.
**Verification:** machine — `tsc`; edit flow unchanged (live: edit + save still closes and
prompts). Wizard: Back-edit-Next writes once (live, network tab).

### B3 — `OfferingCreateWizard` component  ✅ DONE (2026-10-14)
**Files (new):** `vendor/components/offerings/OfferingCreateWizard/`
`OfferingCreateWizard.tsx`, `useOfferingCreateWizard.ts`, `OfferingCreateWizard.module.css`,
`wizardSteps.ts` (static step ids, titles, instruction copy — data, not logic).
- **Render (`.tsx`)** — Radix `Dialog` shell; header (title "Add an offering", "Step N of 5 —
  Title", segmented progress as `<ol>` with `aria-current="step"`, close X); scrolling body
  rendering the B1 field groups / attachments editor / review summary for the current step;
  footer with Back (secondary) and Next / **Save offering** / **Finish** (primary), and a one-line
  "what's missing" hint beside Next when it is disabled. No `useState`/`useEffect`; no handler
  bodies; the only inline `style` is none (progress fill is a class per state).
- **Hook (`useOfferingCreateWizard.ts`)** — composes `useOfferingForm(null, …)` for every
  field and rule (no rule re-implemented); derives per-step validity and the missing-fields
  sentence from values `useOfferingForm` now exports (`durQtyValid`, `hasBlankRequirement`,
  `buildOffering` — added to its return, no logic change); moves focus to the step heading on
  step change; maps the duplicate-code failure back to step 1 (I2). State is `step`, `savedId` (null until step 4 succeeds; non-null locks steps 1–4), `saving`,
  `saveError`, `codeError`, `confirmingDiscard`. A second press of "Save offering" while
  `saving` is a no-op (and `createFromForm` already de-duplicates).
- **Styles (`.module.css`)** — the shell's mobile-first layout (D5), sticky footer safe-area
  padding, progress segments, step heading. Colours only via existing `sp-*` CSS variables /
  `btn-primary` / `sp-input` / `sp-pill`; nothing hard-coded, so both themes come from tokens.
- **G1 (review 2026-10-12) — save with `canSave`, never with `ensureSaved`.** The form hook's
  `ensureSaved()` refuses a blank price (`uploadBlockedReason`), so wiring "Save offering" to it
  would block a vendor who left price blank — contradicting step 4's "Free (₱0)". The wizard
  passes no-ops for `useOfferingForm`'s `onSave`/`onEnsureSaved` and calls
  `onCreate(form.buildOffering())` itself, guarded by `form.canSave` — the same rule Add
  Offering uses today.
- **G2 — "touched" is defined, not guessed:** dirty = any value differs from the
  `useOfferingForm(null)` initial values (blank name/code/category/description/price, qty "1",
  unit hour, no requirements, active, session). Drives I1's discard confirm.
- Creates through the **existing** `createFromForm` (passed as the `onCreate` prop — the same
  function the form uses); the attachments step passes the real id and `blockedReason={null}`, so the
  editor's lazy-create path is simply not exercised by the wizard.
- ⚠️ `createFromForm` today switches the *form* to edit mode on success (`setOTarget`,
  `setOModal("edit")`, `:166-169`). Called from the wizard, that would mount the edit form on
  top. B4 gives it the wizard's own session branch: when the wizard is open it only records
  `createdOffering` (for the prompt on close) and returns the saved offering.
**Verification:** machine — `tsc`, `lint`, new spec (I5). Live — full run on a phone-width
viewport and desktop, both themes, keyboard-only, VoiceOver/TalkBack spot-check.

**Stage 3 (2026-10-13) — component built; how it was checked.** Files:
`OfferingCreateWizard.tsx` (render only: no hooks besides the one call, no handler bodies, no
inline `style`), `useOfferingCreateWizard.ts` (all state, the effect, every handler),
`OfferingCreateWizard.module.css` (shell layout, mobile first), `wizardSteps.ts` (titles and
instruction copy as data). `PatternField.tsx` now exports `PATTERN_CHOICES` so the review can
name the chosen pattern; that file has no other change.
Built as specified, plus these decisions made while building:
- **Props:** `vendorId`, `categories`, `onCreate(offering) → { offering, error, conflict? }`,
  `onClose`. `existingCodes` and `codeError` are **not** in yet; they belong to I2 (Stage 4).
  Until Stage 4, a server code clash shows as the ordinary step 4 save error.
- **Step 5 is not a `<form>`** (steps 1–4 are, and the footer button joins them with `form=`).
  The attachments editor has its own inputs, and Enter there must never trigger Finish.
- **Close is ignored while the insert is in flight** (the X is disabled; Escape does nothing).
  Otherwise the discard confirm would say "Nothing has been saved" when that might be false.
- **Status colours are Tailwind palette classes with `dark:` variants** (the classes the form
  uses), because `globals.css` has no status tokens. The module CSS uses only `sp-*` tokens.
  Two colours are darker than in the previews, for contrast: the amber hint is amber-700 on light
  (amber-600 was about 3.2:1), and "Change" is blue-600/blue-400 instead of blue-500.
- **Refs are destructured apart from the hook's other return values**, because
  `react-hooks/refs` flags every read from an object that holds a ref (the same pattern as
  `CameraCapture`).
- The preview's "Up to 6 letters or numbers." hint under Short code is **not** added. It would
  change the shared field, and so the edit form, and "letters or numbers" names a rule the field
  does not enforce (it only upper-cases and cuts to 6). Revisit with I2's field error if wanted.

**Verification (machine).** A temporary dev-only page (`app/wizard-scratch`, now in the trash,
along with the `.next/dev/types` it generated) rendered the wizard with a fake `onCreate`.
Playwright ran **87 checks, all passing**. They cover: the dialog's name and description; focus
on the heading at open and after every step change; `aria-current` and the live-region text; Next
disabled with the reason shown (both missing, code missing, duration 0, blank requirement); Enter
advancing a step; Back and "Change" keeping values; the review read-back (blank price → Free (₱0),
blank category → —, pattern, requirements); the `role="switch"` toggling by keyboard; Escape →
confirm with focus on Keep editing, and Escape again → keep editing; a failed save staying on step
4 with every value, then a retry; step 5 with no Back, the Saved note and the "Close — your
offering is saved" label; the payload (price 850, code upper-cased, custody, active, 60 minutes);
untouched Cancel closing at once; touched X → confirm → Discard creating nothing; outside clicks
ignored. Layout: at 360×740 a full-screen sheet with an opaque `--sp-modal-bg` in both themes; at
1280×800 the centred 520px card; no horizontal overflow on any step; every footer button at least
44px tall. Screenshots were inspected by eye. `tsc` clean; `npm test` 532/532; lint shows the same
29 problems as D8, and scoped `eslint` is clean.
**Not yet verified (live):** the real `createFromForm` path (Stage 4), the attachments editor with a
real session (in the harness it showed the expected permission error), a real phone keyboard over
the sheet (I3), and a screen-reader spot check (I4).
**✅ DONE (2026-10-14), user live check ("S3 / B3 is a pass").** Logged in locally, the user
created an offering through the wizard with the real save, and abandoned another part-way with a
discard (I1 confirmed live). They also opened an existing saved offering and edited it (B1: the edit
form still works live).
**Stage 2 seam ✅ (2026-10-13):** `useOfferingForm` now also returns `durQtyValid`,
`hasBlankRequirement` and `buildOffering`. This adds to its return value only; no logic changed.
Verified by `tsc` and the unchanged edit-form spec run in Stage 1. The component itself is still
TODO (Stage 3).

### B4 — Wire Add Offering to the wizard  ✅ DONE (2026-10-14)
**Files:** `OfferingsPage.tsx:356-358, 413-425`; `useOfferingsPage.ts:100-107, 127, 134-141, 296`
`openAdd` and the `arrival.openForm` effect open the wizard instead of `oModal="add"`. The
wizard's close/finish reuses `closeModal`'s held-create → `savedOffering` hand-off, so the
existing `SchedulePromptModal` appears (D4). Button label stays **Add Offering** so the
`offerings` page baselines are untouched.
`createFromForm` (`:151-181`) gains the wizard branch noted in B3: while the wizard is open and
its session is current, success sets `createdOffering` only — no `setOTarget`/`setOModal("edit")`
— so the edit form never mounts over the wizard. The form's own add path keeps its behaviour
(it is still reachable from the fixture, F3). `formSession` is bumped on wizard open/close
exactly as for the form, so a save that resolves after Close cannot reopen anything.
**Separation:** `OfferingsPage.tsx` stays render-only; new state (`wizardOpen`) lives in
`useOfferingsPage`.
**Verification:** machine — `tsc`; `grep` shows no remaining caller passing `mode="add"` outside
the fixture. Live — both entry points open the wizard.
**Stage 4 (2026-10-13) — what was done.** `useOfferingsPage`: new `wizardOpen` state;
`openAdd` and the arrival effect open the wizard (and bump `formSession`); `closeModal` closes
either surface and still hands a held create to the prompt. The insert and its follow-up (append
to the list, `refreshCompletion`, the stale-session message) moved into one `insertOffering` core,
which `createFromForm` (unchanged behaviour) and the new `createFromWizard` both use.
`createFromWizard` returns `{ offering, error, conflict }` and on success only sets
`createdOffering`; nothing switches into edit mode. If the session changed meanwhile it falls back
to the prompt, as the form's path does. It has no `creating` de-duplication, because the wizard
has one save button, disabled while saving. `existingCodes` = the loaded offerings' codes.
`OfferingsPage.tsx` renders the wizard and stays render-only. The plan's `OfferingsPage.tsx`
line numbers were stale; the wiring was found by name.
**Verified (machine):** `tsc` clean; `npm test` 532/532; lint shows the same 29 problems as D8
(the baseline `useOfferingsPage` setState-in-effect error moved from :77 to :80 because three
lines were added above it). `grep`: only the gallery fixture passes `mode="add"`. In a temporary
harness around the **real** `OfferingsPage` (stub completion context, no login), now trashed with
its generated `.next/dev/types`: Add Offering opens the wizard and not the old form; the
account-completion arrival opens it on load; the real insert, refused without a session
("permission denied for table offerings"), stays on step 4 with the message and "Nothing was
saved"; there is no schedule prompt after a failure or a discard; reopening starts empty.
**Not verified (needs a vendor login):** a successful save, then Finish/Close → the existing
`SchedulePromptModal`; the new offering appearing in the list; the completion badge updating.
**Live (user, 2026-10-14):** Add Offering opens the wizard and a real save creates the offering.
Not yet reported: the "Offering saved" schedule prompt after Finish, the completion badge, step 5
uploads, and the account-completion arrival opening the wizard.
**✅ DONE (2026-10-14), user live check ("S4 / B4 is also good").** The user uploaded on step 5,
closed, and the upload was saved on the offering.

## IMPORTANT

### I1 — Leaving the wizard can never silently lose work  ✅ DONE (2026-10-13)
**File:** `useOfferingCreateWizard.ts` (new)
- Before the save: X, Escape, and Cancel with **any** field touched open an in-dialog confirm
  ("Discard this offering? Nothing has been saved.") — not `window.confirm`. Untouched → closes.
  Outside-click stays prevented, as on the form (`OfferingFormModal.tsx:76`).
- After the save (step 5): the X is named "Close", closes without a confirm, and the step
  shows "Saved" so the vendor knows nothing is lost. The saved offering stays (D2).
- Back never clears values: all state lives in one `useOfferingForm` instance for the wizard's
  lifetime; steps 1–4 are views over it.
- A failed save on step 4 keeps every value and stays on step 4 (or returns to step 1 for a
  code clash, I2) — the vendor never retypes.
- Step 5 is the last step, so the attachments editor's unsaved text-document `draft` is only
  lost by Finish/Close with a document still open — exactly as closing the edit form does
  today; see F4.
**Verification:** live — type, press Escape → confirm shown; Back/Next across all steps keeps
values; write a document, press Back → blocked with hint (or survives, per the chosen approach).
**✅ DONE (2026-10-13), machine-verified in the Stage 3 harness:** untouched Cancel closes
at once; touched X or Escape → in-dialog confirm, focus on Keep editing, Escape again keeps
editing, Discard calls nothing; outside clicks are ignored; Back and Change keep every value; a
failed save keeps values and stays on step 4; after the save, Escape closes without a confirm. The
"write a document, press Back" case cannot happen, because step 5 has no Back (D1); unsaved
document drafts on Finish are F4.

### I2 — Errors shown next to their cause  ✅ DONE (2026-10-13)
**Files:** `useOfferingCreateWizard.ts`, `BasicsFields.tsx`, `useOfferingsPage.ts`
- Duplicate short code: checked on step 1's Next against the codes already loaded in
  `offerings` (same rule as `offerings_vendor_code_unique`, earlier — not a new rule), shown
  under the code field with `aria-invalid` + `aria-describedby`. The wizard receives
  `existingCodes` as a prop from `useOfferingsPage`. **G3:** on the account-completion arrival
  the wizard can open before `getOfferings` resolves, so the list may be empty and the
  pre-check pass — the server 23505 below is what makes that safe, not a nicety. The server 23505 is still the backstop: if the save on step 4 returns
  it, the wizard returns to step 1 with the message under the field. Detection uses a stable
  `conflict: "code"` flag added to `createOffering`'s result (additive; the string message is
  unchanged for the form).
- Any other save failure stays on step 4, shown above the footer; the button stays "Save offering" so retrying is the obvious move.
- Attachment errors stay where the editor already shows them.
**Verification:** machine — unit test of the code-clash helper (`lib/`, `node --test`). Live —
reuse an existing code; force an RLS failure (expired session) on step 3.
**✅ DONE (2026-10-13), Stage 4.** The duplicate check is **live as the code is typed**
(derived, no state) instead of only on Next. It is the same rule and message, and Next is
disabled with "Pick a short code you haven't used yet to continue." That is strictly earlier
feedback; no new rule. `BasicsFields` gained an optional `codeError`: `aria-invalid`,
`aria-describedby`, a red border and a `role="alert"` message under the field. Without the prop
the markup is unchanged: the edit form's `outerHTML` (light/dark, initial/edited) is still
byte-identical to the Stage 1 snapshot. On the server's `conflict: "code"` the wizard records the
refused code, goes back to step 1, shows the message under the field and keeps every other value;
editing the code clears it.
Harness, 35/35 including both themes: "rent" clashes with RENT; stored "coach" does **not** clash
with COACH (the exact rule); a server clash on DUPE returns to step 1 with focus on the heading and
no step 4 banner; changing to DUPE2 clears it, and the retry saves. The non-code failure path stays
on step 4 (checked against the real insert, above). Not yet run: a live duplicate against a logged-in
vendor's real codes, and an expired session.
**Stage 2 seams ✅ (2026-10-13):**
- `lib/offeringCode.ts` `offeringCodeTaken(code, existingCodes)` mirrors
  `unique (vendor_id, code)` (`20260506000001_offerings.sql:31`). It upper-cases the typed code
  (as `buildOffering` sends it) and then compares exactly. It does not trim and does not
  case-fold stored codes, because either would refuse codes the database accepts (a new rule).
  A blank code is never flagged, and an empty list passes (G3).
- `lib/offeringCode.test.ts`: 4 tests. A mutation check failed all three drifts (trim, case-folding
  stored codes, not upper-casing the input).
- `createOffering` returns `conflict: "code"` on 23505. This is additive: the message string and
  the `{ id, error }` shape are unchanged, and the form's caller is untouched. Checked: the code
  is the table's only unique key besides the id, and its only trigger is `updated_at`, so a 23505
  on insert is always the code.
- Machine: `tsc` clean; `npm test` 532/532 (528 + 4); lint shows the same 29 problems as the D8
  baseline, including the unchanged warning in `offerings.service.ts`; scoped `eslint` is clean.
  Not yet done: the field error, the return to step 1 and the live checks (Stages 3–4).

### I3 — Mobile-first shell (per D5)  ⏸ PARKED (2026-10-14) — built + keyboard fix machine-verified 2026-10-13; the real-phone keyboard check waits for a staging deployment
**File:** `OfferingCreateWizard.module.css`
Below `sm` (640px): full-screen sheet (`inset: 0`, `height: 100dvh`, no radius), opaque
surface, header and footer fixed in the flex column, body scrolls, footer padded by
`env(safe-area-inset-bottom)`, Back/Next ≥ 44px tall with Next taking the wider share. From
`sm` up: the existing centred card (`max-width 520px`, `max-height 90vh`, radius 20px) — the
same frame as today's form. Inputs stay ≥ 16px font on mobile to stop iOS zoom-on-focus *only
if* the existing `sp-input` text size triggers it (check, don't assume — it is 13px today, so
it does; flag rather than change shared tokens, see F2).
⚠️ `--sp-card-bg` in dark mode is `rgba(255,255,255,0.028)` — fine over a blurred overlay as a
card, wrong as a full-screen surface. Use `--sp-modal-bg` (opaque: `#ffffff` / `#0a0f1a`,
`globals.css`) for the sheet — confirmed 2026-10-12 and used in the previews.
**Verification:** live/screenshot — 360×740 and 1280×800, both themes, keyboard open on mobile
(footer stays reachable).
**Keyboard fix (2026-10-13, user: "go ahead with the wizard-only keyboard fix").** Finding:
`app/layout.tsx`'s `viewport` sets no `interactive-widget`. So iOS Safari and Android Chrome
(108+) both draw the keyboard over the page and `100dvh` does not shrink: with a field focused,
the sheet's footer (Back / Next / Save) sat behind the keyboard. Fix, in the wizard only:
`useOfferingCreateWizard` reads `window.visualViewport` through `useSyncExternalStore`
(resize/scroll events, plus the `(max-width: 639px)` media query that matches the CSS breakpoint).
Below 640px it pins the sheet to the visible area with an inline `{ top, height, bottom: auto }`.
That is a live measurement, the one dynamic style the render layer takes. A follow-up effect,
which sets no state, scrolls the focused input into view inside the body. It is off from 640px up
and while pinch-zoomed (scale ≠ 1), where the CSS full-height sheet applies. Rejected: the
app-wide `interactiveWidget: "resizes-content"`, because it works only on Android and would change
every page, the kiosk included.
Verified (machine, 16/16). Headless Chromium has no soft keyboard, so `visualViewport` was swapped
for a controllable stand-in, and both keyboard shapes were replayed: Android (height 844 → 480) and
iOS (height 480 with `offsetTop` 210). In both, the sheet's top and height match the visible area,
Cancel/Next sit above the keyboard, and the focused Description field is visible above the footer.
Closing the keyboard restores the full screen; pinch-zoom is ignored. On step 3, the third
requirement field scrolls into view above the footer. Desktop gets no inline sizing (still the
centred 520px card). With the real `visualViewport` and the keyboard closed, the sheet is still the
full 390×844. Screenshots inspected. `tsc` clean; `npm test` 532/532; lint shows the same 29
problems; the wizard spec passed 8/8 and the duration picker 4/4 (exit 0).
**Still open:** confirming it on a real phone. The user can test locally with the gallery fixture:
Android over USB with `adb reverse tcp:3000 tcp:3000`, then `http://localhost:3000/ui-gallery?mode=offeringwizard`.
iPhone/LAN needs a Windows firewall rule, because `.wslconfig` has `firewall=true`. Desktop DevTools
device mode shows no keyboard and cannot test this.
**⏸ PARKED (2026-10-14, user).** The user checked the wizard in a desktop browser and in DevTools
mobile view: it looks OK. Their phone cannot reach the local dev server, so the real-phone keyboard
check moves to staging. **Unblocks when** this branch is on a staging deployment: open Add Offering
on a phone, focus a field, and confirm Back/Next stay above the keyboard (steps in this section).

### I4 — Accessibility of the step flow  ✅ DONE (2026-10-14)
`Dialog.Title` = "Add an offering"; `Dialog.Description` = the current step's instruction (so
the existing `aria-describedby={undefined}` opt-out is not needed here). Each step is a `<form>`
so Enter submits Next where Next is enabled. Focus moves to the step heading (`tabIndex={-1}`)
on every step change; an `aria-live="polite"` region announces "Step 2 of 5, Price and length".
Disabled Next is paired with visible text naming what is missing (never colour alone).
**Verification:** live — keyboard-only run; screen-reader spot check. Machine — spec asserts
the heading receives focus and `aria-current` moves.
**✅ DONE (2026-10-14).** Machine checks from Stage 3 (87/87) and F6 (28/28) passed; the user
reported the live check as a pass on 2026-10-14 ("s3/I4 is a pass").

### I5 — Tests and fixture (scoped; nothing shared is regenerated)  ✅ DONE (2026-10-13)
**Files:** `app/ui-gallery/page.tsx` (**append** one `mode === "offeringwizard"` branch; no
existing line edited), new `visual-tests/offering-wizard.spec.ts`.
Behavioural assertions only — **no new screenshot baselines** and never
`test:visual:update`: Next disabled until valid + hint text; Back keeps values; "Change" on
step 4 jumps to the right step; "Save offering" calls the create prop exactly once on
double-click; duplicate code lands on step 1 under the field; discard confirm. The fixture
passes a stub create resolving `null` (a failed save) so the spec **never advances into
step 5** against a real Supabase (the editor would fetch); the step-5 / no-Back state is a
live check.
Run only as `npx playwright test visual-tests/offering-wizard.spec.ts` plus the B1 regression
`-g "offering duration picker"`. ⚠️ A running `next dev` on `vendor/` (Codex's or the user's)
blocks the suite — check `ss -ltnp` first and ask rather than stopping someone else's server.
**Verification:** the run itself; exit code read directly, never piped through `tail`.
**✅ DONE (2026-10-13).** `app/ui-gallery/page.tsx`: **35 lines added, 0 removed or edited**
(`git diff` shows no `-` lines). These are two imports, a module-scope `OfferingWizardFixture`
next to `StaffFormFixture`/`CameraFixture`, and an `offeringwizard` branch. The fixture's stub
create counts calls on screen and never succeeds: "DUPE" returns `conflict: "code"`, anything else
an ordinary error. The mode is **not** in the screenshot `modes` list.
`visual-tests/offering-wizard.spec.ts`: 8 behavioural tests, no `toHaveScreenshot`. They cover the
disabled Next and its reasons for all three rules; focus and `aria-current`; Back keeping values;
Change jumping to a step; a double-click calling create once, with a failure keeping values; the
duplicate code under the field; a server conflict returning to step 1; and the discard confirm,
including untouched Cancel and outside clicks.
Runs, scoped, with exit codes read directly (no dev server was running): the wizard spec passed
8/8 (exit 0) and `-g "offering duration picker"` passed 4/4 (exit 0). **Mutation check:** with only the
hook's `saving` guard removed the double-click test still passes, because the button's
`disabled={… || saving}` also blocks it. With both guards removed it fails ("Expected 1, Received
2"), so the test catches a missing guard. Both files were restored (`cmp` checked). No snapshot files
were written (`git status visual-tests` shows only the new spec).

### I6 — Copy and docs that describe the old add flow  ✅ DONE (2026-10-13)
- `components/dashboard/GuideModal/guideItems.ts:157-158` and the "Offering photos" /
  "Documents" actions (`Offerings → Add Offering or Edit → Attachments …`, "adding a photo saves
  the offering first") — rewrite for the wizard's step 4.
- `architecture/portals.md:419-420` — replace the "attachments while adding" paragraph.
**Verification:** grep for "Add Offering or Edit" and "saves the offering first" returns only
updated text.
**✅ DONE (2026-10-13).** `guideItems.ts`: the "Offering photos" and "Documents" actions now say
Edit → Attachments, or the last step of Add Offering, Photos and documents, after the save. The
photos note on saving on first upload is gone, and the source comment points at the wizard.
(The plan said "step 4"; it is step 5 since D1.) `architecture/portals.md`: the add-form line and
the 2026-09-15 "attachments while adding" paragraph were replaced with a wizard description and a
superseded note pointing at F3. Checks: `grep` for both old phrases in `vendor/components` and
`architecture` returns nothing. The **guide modal is in the screenshot suite**, so
`-g "guide-(light|dark)"` was run in compare mode: 2/2 passed against the committed baselines,
with nothing updated. That means the changed kiosk copy is not inside the baseline's visible area.

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains. -->
- D1 — What Back means after the offering is saved → **Hard point of no return** (resolved
  2026-10-12, user). Options were: save then keep editing via an update path (my
  recommendation); hard point of no return; buffer files and create at Finish. Consequences
  applied: the review moves before the save (step 4 "Check and save"), the photos step has no
  Back and says so, B2 is aborted, the Active switch moves to the pre-save review. This
  knowingly departs from the brief's "Back on every step" for step 5 only — the user's call.
- D2 — An offering saved and then abandoned on the photos step → **Leave it** (resolved
  2026-10-12, user). It has every required field and the vendor pressed "Save offering", so it
  is a complete offering in the state today's Add Offering leaves. Rejected: create inactive
  and activate on Finish; delete on cancel (orphans public photos, no help for a closed tab).
- D3 — Wizard replaces Add Offering → **Replaces it** (resolved 2026-10-12, user), including
  the account-completion "Create offering" arrival; the form remains for Edit.
- D4 — Schedule → **Stays the existing post-create `SchedulePromptModal`** (resolved
  2026-10-12, user), shown when the wizard closes after a save.
- D5 — Mobile presentation → **Full-screen sheet below 640px, today's centred card above**
  (resolved 2026-10-12, user) — I3.
- D6 — Finishing with no photo or documents → **Allowed** (resolved 2026-10-12, user). Step
  5's instruction says what the kiosk shows without a photo, and the editor's existing empty
  text says customers go straight to payment without documents. No new rule.

- D7 — Release base → **`vendor` branch `feature/offiering_wizard`, cut from the latest
  `origin/develop` (`2226517`, v0.57.0)** (resolved 2026-10-13, user). The user's branch model:
  `develop` is for integration and preview branches only. The user cuts a `release/*` branch
  from this work for staging, and what reaches production is decided at that point, not by this
  plan. The wizard does not touch the kiosk, and the kiosk only reads offerings that already exist.
  The `e7d6b9a..develop` contents below are kept as release notes for whoever cuts the release.
  Checked 2026-10-13: HEAD = `origin/develop` after a fetch, clean tree; the work is vendor-only,
  plus this plan and the I6 line in `architecture/portals.md`.
- D8 — Lint pass mark → **"No new lint problems compared with the baseline"** (resolved
  2026-10-13, user). Baseline on `2226517`: `npm run lint` already fails with **29 problems
  (26 errors, 3 warnings)**, all present before this plan. The gallery error is also present at
  `e7d6b9a`. Two of them are in files this plan touches: `useOfferingsPage.ts:77`
  (setState in an effect) and `offerings.service.ts:2` (unused `OfferingStatus` import). They
  are reported, not fixed (surgical changes). Baseline at the same time: `tsc` clean;
  `npm test` 528/528.

## DEFERRED / COSMETIC
- **F1** — The Active switch is a clickable `div` with no role, label or keyboard access
  (`OfferingFormModal.tsx:234`). The wizard's Review step uses a real `role="switch"` button;
  fixing the *edit form's* copy is out of scope (edit form untouched beyond B1) — reported, left
  for you to schedule.
  **✅ DONE (2026-10-14), at the user's request ("fix F1 now so we can mark it done").**
  In `OfferingFormModal.tsx`, the `div` is now a `<button type="button" role="switch">` with
  `aria-checked` and `aria-labelledby`/`aria-describedby` pointing at the Active label and its help
  text (ids `offering-active-label`/`-help`). The classes are the same, plus `border-none p-0`. The
  knob is a `span` with `left-0`, because a `div` is not allowed inside a button. Verified (machine):
  22/22 checks on the `offeringform` fixture in both themes. The switch is found by its role and
  name, has its description, and is reached by Tab. Space and Enter toggle it, and so does a click;
  none of them submits the form. The track is still 44×24, with the knob at 3px when off and 22px
  when on, as before. Screenshots inspected; the only visible change is the focus ring.
  `tsc` clean; `npm test` 532/532; lint shows the same 29 problems; the duration-picker and wizard
  specs passed 12/12 against the user's :3000 server (temporary config, now trashed).
- **F2** — `sp-input` text is 13px, which makes iOS Safari zoom on focus in **every** vendor
  form, not just this one. A shared-token change; reported, not fixed here.
  **Correction (2026-10-14):** this is not a shared token. `.sp-input` (`globals.css:189`) sets no
  font size; each field carries its own `text-[13px]` (20 places) or `text-[12px]` (4).
  **Fix applied 2026-10-14 (user chose option A, "fix A now"); status left for the user to close.**
  `globals.css` has one rule: `@media (max-width: 639px) { input.sp-input, select.sp-input,
  textarea.sp-input, .sp-input input { font-size: 16px } }`. Element plus class outranks a single
  size utility, and the `.sp-input input` part covers wrapper-styled fields (SearchInput, the staff
  search). Desktop is unchanged.
  Verified (machine): with the gallery at 390px, every `.sp-input` field measured 16px in
  `offeringform` (9), `offeringwizard` (4), `scheduleform` (6), `scheduleformdate` (5), `staffform` (4),
  `staffpage` (1) and `dashboard` (2). At 1280px they keep 13/14px. No horizontal overflow; no page
  errors; screenshots inspected. Cosmetic: the wizard's Category placeholder now truncates at 390px
  ("e.g. Rental, Coa…"). Full Playwright suite against the user's :3000 server, snapshots never
  written: 204 passed, 3 failed. All 3 also fail with the rule removed, so they are not F2; see F8.
  `tsc` clean; `npm test` 532/532; lint shows the same 29 problems.
  **Still open (user, needs an iPhone, so staging):** focus a field in the wizard and the schedule
  form; the page must not zoom.
- **F7 (found 2026-10-14, during F2) ⬜ TODO — fields that F2's rule does not reach still zoom on
  iPhone.** They do not use `.sp-input`; their size comes from module CSS or local class strings.
  Measured or read: settings `SecurityCard` and `PayoutMethodFields` (13px), `LoginPage`,
  `RegisterField`, `AddressFields`, `KycSubmitForm`, `KycStatusPage`, `DeletionRequestModal`,
  `Combobox`. Kiosk fields (`StepCustomer`, `KioskCloseOut`, `KioskExitDialog`) measured 17px in
  `kioskcustomer`, so they are already safe there; they are Codex's area either way. Fix
  direction: widen the rule to those components' input classes (not kiosk). That changes more
  forms on phones; reported, not done, for the user to decide.
  **Fix applied 2026-10-14 (user: "fix F7 now"); status left for the user to close.** The same
  phone-only 16px rule (`max-width: 639px`) now covers:
  - CSS modules, one commented media block each: `LoginPage.module.css` (`.input, .pwInput`; they
    were 14px), `RegisterField.module.css`, `AddressFields.module.css` and `Combobox.module.css`
    (`.input`), and `KycSubmitForm.module.css` and `KycStatusPage.module.css` (`.addInput`).
  - Class strings, by adding `max-sm:text-[16px]`: the shared `INPUT` in `SecurityCard.tsx`,
    `PayoutMethodFields.tsx` (still identical to SecurityCard's) and `DeletionRequestModal.tsx`.
  - The Offerings page search (`OfferingsPage.tsx`, inside an `sp-pill`, so F2 missed it).
  Kiosk was not touched.
  Verified (machine): every visible text field on 29 non-kiosk gallery pages at 390px is 16px (52
  fields, none smaller), including login, forgot, reset, register (10 with the address pickers),
  settings, the closure modal and every offering, schedule and staff form. At 1280px the same
  fields keep 13/14px. No horizontal overflow on any page with fields. The `schedule` and `staff`
  fixtures overflow at 390px (211 / 141px), but they contain no fields, so the change cannot touch
  them. Not rendered in the gallery, so checked by reading the CSS only: the payout fields (the
  fixture shows the load error) and the KYC add-document inputs. Screenshots inspected
  (register, settings, closure). `tsc` clean; `npm test` 532/532; lint shows the same 29 problems.
  Playwright against the user's :3000 server, snapshots never written: 61/61 passed. That covers
  every login screenshot including the 480px `login-mobile-info`, the 320px responsive sweep, the
  360px staff form, the duration picker and the wizard.
  **Still open (user, iPhone on staging):** sign-in, register, settings → password; no zoom on focus.
- **F9 (found 2026-10-14, during F7) ✅ DONE (closed by the user 2026-10-15: "close F9") — the settings fields are white in dark mode.**
  The `INPUT` strings in `SecurityCard.tsx`, `PayoutMethodFields.tsx` and `DeletionRequestModal.tsx` use
  `bg-sp-input-bg`, `border-sp-input-bdr` and `text-sp-input-color`, but `tailwind.config.ts`
  (`colors.sp`, lines 63–70) does not define `input-bg`/`input-bdr`/`input-color`. So those classes
  produce no CSS, and the fields fall back to the browser's white box with a default border. Seen in
  the dark `settings` and `closuremodal` fixtures at 390px. Fix direction: add the three entries to
  `colors.sp`, pointing at the existing `--sp-input-*` variables. That is a shared config change
  that alters the settings fields' look in both themes, so it is reported, not done.
  **🔄 Fix applied 2026-10-14 (user: "FIX f9"), not yet verified live.** `tailwind.config.ts`
  `colors.sp` gains `input-bg`, `input-bdr` and `input-color`, mapped to the `--sp-input-*`
  variables (with a comment). The Tailwind CLI, run on the real config and `globals.css`, now emits
  `.bg-sp-input-bg`, `.border-sp-input-bdr` and `.text-sp-input-color`; before, it emitted none of
  them. Also affected: the bare `border-sp-input-bdr` uses in `DeletionRequestModal.tsx:117,172` and
  `AccountDeletionCardBody.tsx:55` now get their intended border colour.
  **Blocked on a dev-server restart:** the user's running :3000 `next dev` does not reload
  `tailwind.config.ts` (touching `globals.css` did not help), so the page still serves the old CSS.
  A full suite run on that server (204 passed, the 3 F8 failures) therefore says nothing about F9.
  ⚠️ Expected after the restart: committed baselines that show these fields will differ, e.g.
  `closuremodal-*`, `closure-*` and `payoutform-*`. They are never regenerated without the user's
  approval.
  **Verified (2026-10-14, after the user restarted :3000).** Computed styles in the `settings` and
  `closuremodal` fixtures now come from the theme. Dark: background `rgba(255,255,255,0.05)`,
  border `rgba(255,255,255,0.1)`, text `#e2e8f0`. Light: `#f8fafc`, `rgba(0,0,0,0.1)`, `#0f172a`.
  Before, the background was white in both themes. This was a real bug: the old dark
  `payoutform-bank` baseline shows white fields with near-white typed text, so "Juan Dela Cruz" and
  the account number were nearly invisible. Full suite (snapshots never written): 194 passed, 13
  failed. 3 are the known F8 kiosk and :3000-artefact failures. The other **10 are this fix, as
  expected**: `payoutform-bank`, `-gcash`, `-maya` and `-bank-errors` (light and dark), and
  `closuremodal` (light and dark), with 3–4% of pixels different. The `closure-*` card baselines
  still pass. Expected and actual images were inspected. `tsc` clean; `npm test` 532/532; lint
  shows the same 29 problems. **Waiting on the user:** approve regenerating exactly those 10
  baselines, or leave them failing; nothing has been written.
  **Baselines regenerated 2026-10-15 (user: "yes").** `-g` matched exactly those 10 tests
  (checked with `--list`), run on Playwright's own :3100 server (the user's :3000 was down), the
  same setup the originals came from. `git status` shows exactly those 10 PNGs modified; a
  read-only re-run (`--update-snapshots=none`) passed 10/10. The old images are kept for comparison
  in the session scratchpad `f9-before/`. Status left for the user to close.
- **F8 (found 2026-10-14, during F2) ✅ DONE (2026-10-15) — the kiosk confirmation baseline no longer matches (not caused by F2).**
  **Resolved 2026-10-15 (user: "if F8 is only a screenshot, do that too").** Cause: committed kiosk
  commit `878155a fix(kiosk): verify persisted payment status before showing confirmation` changed
  `StepConfirmation.tsx` after the baseline was last saved (`c632cec`). No kiosk file is modified in
  the working tree. Expected vs actual inspected: the loading and read-failed tiles now say
  "Checking payment" / "We couldn't verify payment" with a warning icon (not "You're booked"), and
  the failed tile adds "Check payment status again". That is the intended change, not a fault, so
  only the screenshot was stale. Both baselines regenerated on Playwright's own :3100 server; a
  read-only re-run passed 2/2. Old images kept in the session scratchpad `f8-before/`. Kiosk code
  was not read or edited. Item (3), the `B3` :3000 artefact, needs no change.
  (1, 2) `kioskconfirmation-light/-dark`: at 900px the page is 19px shorter than the committed
  baseline (2096 vs 2115; about 5% of pixels differ). That is kiosk code, Codex's area; the baseline
  was not touched. (3) `B3 — the dashboard fixture stays offline` is an artefact of this run, not a fault: the
  test treats any request not to `localhost:3100` as leaving the page (`pilot.spec.ts:1107`), and
  this run targeted :3000. All three failed identically with the F2 rule removed.
- **F3** — After D3(a), `OfferingFormModal`'s add-mode branches (`mode` prop, `justCreated`
  banner, `uploadBlockedReason`/`ensureSaved` lazy create) are reachable only from the
  `offeringform` fixture. Removing them means editing that fixture's existing lines, which is a
  collision with Codex's work in `app/ui-gallery/page.tsx`. Left in place; remove once the
  fixture can be edited. **Grown by Stage 4 (2026-10-13):** in `useOfferingsPage`, the
  `handleSave` "add" branch, `createFromForm`'s switch into edit mode, `ensureOffering` (only
  reachable from the edit form, whose editor already has an id) and `justCreated` can no longer be
  reached from the page. Remove them with the rest of F3.
  **✅ DONE (2026-10-14), at the user's request ("clean it up now so that we can mark it done").**
  The user's go-ahead covered changing existing lines in `app/ui-gallery/page.tsx` for this.
  Removed: `OfferingFormModal`'s `mode`, `onEnsureSaved` and `justCreated` props, the add-mode
  title, button, note, banner and "Close" label; `useOfferingForm`'s `onEnsureSaved` parameter,
  `uploadBlockedReason` and `ensureSaved`. It now returns `resolveOfferingId`, which resolves the
  edited offering's id for the attachments editor. In `useOfferingsPage`: `createFromForm`, the
  `creating` ref, `ensureOffering`, `handleSave`'s add branch, `justCreated` and the `"add"` value
  of `oModal`. `OfferingsPage` renders the form only with a target. The wizard hook calls
  `useOfferingForm(null, noSave)`. The `offeringform` fixture now edits `OFFERINGS[0]` (1 hour,
  so the duration tests' starting point is unchanged); its comment was updated.
  Not changed: `OfferingAttachmentsEditor`, whose `ensureOffering`/`blockedReason` props the wizard
  still passes. Its comments still describe the form's old add mode; the user declined editor
  changes on 2026-10-14 (F4/F5).
  Verified (machine): `tsc` clean; `npm test` 532/532; lint shows the same 29 problems. With
  Playwright against the user's running :3000 server (a temporary config without `webServer`,
  now trashed; snapshots off), the 4 duration-picker tests and 8 wizard tests passed (12/12).
  14/14 checks on the fixture in both themes: the dialog is named "Edit Offering"; it has Save
  Changes and Cancel; there is no add-mode text; fields and both requirements are seeded; uploads
  are not blocked; no page errors. ⚠️ Fixture artefact: the gallery has no login, so the
  attachments panel now shows a red database error ("invalid input syntax for type uuid"; with a
  real UUID it would be "permission denied"). Add mode never fetched, so it never showed this.
  No screenshot baseline covers this fixture. Live check (user): edit an offering, then save.
- **F5 (review 2026-10-12)** — Closing the wizard (or the edit form, today) while the
  attachments editor is mid-upload unmounts the editor; the upload still completes and the row
  appears on the card, but the vendor saw no confirmation. The editor's `busy` flag is internal,
  so guarding Finish needs a change to a shared component; same behaviour as today, reported.
- **G4 (review 2026-10-12) — "Change" from step 4 walks forward again.** After jumping back to
  step 2, Next goes 2 → 3 → 4; there is no "Back to review" shortcut. Deliberate: one way through,
  and steps 3–4 re-validate on the way. Revisit only if live testing shows friction.
- **F4 + F5 — ⏸ DEFERRED by the user (2026-10-14: "no need for a fix … revisit later if we need
  to").** Both are close-too-early edge cases. The fix would add an optional prop to
  `OfferingAttachmentsEditor`, which the edit form and the wizard share, so it reports `busy`/`draft`
  to the wizard's leave confirm; the edit form would be unchanged. **Revisit if** vendors report
  lost typed documents, or doubt whether an upload finished.
- **F4** — An unsaved text document in the attachments editor is lost when its surface closes
  (edit form today; wizard Finish after this plan). Warning about it needs the editor to expose
  its draft state — a change to a shared component, left out of scope; reported.
- **F6 (found 2026-10-13, Stage 3)** — The offering field labels are `<p>`, not `<label>`, so
  every input's accessible name is its **placeholder** ("e.g. RENT", "e.g. 1-Hour Court Rental").
  A screen reader on the Name field announces "e.g. 1-Hour Court Rental, edit text". This markup
  was already in the edit form; B1 moved it unchanged and the wizard now shares it. The fix is to
  make each one a `<label htmlFor>` with the same classes (no visual change) in the four
  `OfferingFormFields` components, which also changes the edit form's markup. Reported, not fixed:
  it goes beyond B1's "zero change to the edit form", so it is yours to approve. It would sit
  well with I4.
  **Fix applied 2026-10-13 at the user's request ("go ahead with F6"); status left for the user to
  close.** In the four `OfferingFormFields` components: Name, Short Code, Category, Description,
  Price and Duration are `<label htmlFor>` with `block` added (the same classes, so the same layout)
  and fixed ids (`offering-name`, `-code`, `-category`, `-description`, `-price`, `-duration`). The
  ids are safe because the edit form and the wizard are never open together. The unit select has
  `aria-label="Duration unit"`. The same components had three more issues of the same kind, fixed
  in the same pass: each requirement input is named "Requirement"; the Required/Optional toggle has
  `aria-pressed`; and the icon-only remove button, which before announced as just "button", is named
  "Remove requirement: <label>". The pattern choices are a named `role="group"` with `aria-pressed`
  on each option, because before the selected one was shown by colour alone.
  Verified (machine): 28/28 Playwright checks on the `offeringform` **and** `offeringwizard`
  fixtures. Every field is found by its label, clicking a label focuses its input, and the names and
  pressed states are correct. The edit form looks the same: its screenshots (light/dark, after edits)
  differ from Stage 4 only in a 6-pixel column (x=404) that also changes between two runs of the
  **same** code, i.e. rendering noise. Its HTML changes on purpose (`p` → `label`, the new attributes).
  `tsc` clean; `npm test` 532/532; lint shows the same 29 problems; the wizard spec passed 8/8 and the
  duration picker 4/4 (exit 0); no snapshot written. Still to do: the I4 screen-reader spot check.
  **✅ Closed by the user (2026-10-14: "Close f6").** I4's live check passed the same day.
- No new screenshot baselines (I5) — accepted to keep the shared `visual-tests/` snapshot set
  untouched while Codex works; the wizard is covered behaviourally and by live checks.

## Release independence (review 2026-10-12)

**Frontend only — no migration.** Nothing here adds or changes a table, column, constraint,
index, RLS policy, grant, function, bucket or env var. It relies only on what already exists in
every environment the current offerings form runs against: `offerings` (incl.
`duration_unit`, `fulfilment_pattern`), `offerings_vendor_code_unique` (2026-05-06),
`offering_attachments` + its two buckets (2026-08-29). The one service change — a `conflict`
flag on `createOffering`'s result — is client-side TypeScript.

**Can ship ahead of the booker/checkout work — yes, measured on 2026-10-12:**
- vendor `master` = v0.55.11 (+ 0.55.8 release merge). `develop` = `release/version-0.57.0` =
  v0.57.0, 68 commits past the `production` branch, carrying v0.56.0 (booker's uploaded
  documents in BookingDetails), the merged `feature/payment_flow_revamp`, and 0.57.0 "booker
  booking prep".
- `git diff master develop` over **every file this plan touches or reads** (`components/offerings/`,
  both offerings services, `schedules.service.ts`, `lib/types.ts`, `lib/duration.ts`,
  `lib/price.ts`, `lib/offeringSchedules.ts`, `GuideModal/`, `ScheduleFormModal/`,
  `useAccountCompletion.ts`, `globals.css`, `AppShell/`, `visual-tests/pilot.spec.ts`):
  **only `app/ui-gallery/page.tsx` differs**, and only in the kiosk `StepConfirmation` and
  booking-details fixtures — nowhere near the appended `offeringwizard` mode. So the work can be
  built on the live base and later merged into `develop` with at most a trivial fixture merge.
- `architecture/portals.md` is in the root repo and does not deploy with vendor.
- Codex's kiosk custom checkout is in no vendor branch yet (working tree clean,
  `feature/payment_flow_revamp` fully merged), so an early release carries none of it.

⚠️ **The base must be what is live, not "master" by assumption.** The `production` branch is at
v0.52.0 (2026-09-09) — **before** the 2026-09-15 I6 lazy-create this plan builds on — while
`master` is at v0.55.11 and `v0.56.0` is tagged but **not** in `master`. If v0.56.0 is what
vendor production runs, branching from `master` would silently roll back its BookingDetails
change. → D7.

### Re-measured after the user's branch tidy (2026-10-12, later)
- `master` = `042213f` "Merge branch 'release/version-0.57.0'" — now contains v0.55.11,
  **v0.56.0 and v0.57.0**. The earlier "v0.56.0 not in master" concern is gone.
- Current checkout `feature/payment_page_revamp` = `master` + one tag-merge commit
  (`2226517`); `git diff master HEAD` is **empty**, so the two are byte-identical today.
- Everything added since v0.55.11 (21 files): kiosk payment-status confirmation
  (`StepConfirmation`, `useKioskReceipt`, `lib/kioskPaymentStatus*`, `kiosk.service.ts`),
  **customer uploaded documents in booking details** (`BookingDetails*`,
  `bookingDocuments.service.ts` — booking-related, not only payment), plus `playwright.config.ts`,
  `package.json` version, AGENTS/CLAUDE docs, two `bookingdetails` baselines and the
  `ui-gallery` fixtures for those. **None touches offerings**; of this plan's files only
  `app/ui-gallery/page.tsx` changed, in unrelated sections.
- Conclusion: the wizard applies cleanly to either branch. Which one is a release question,
  not a code one → D7.

### ⚠️ Remote check (2026-10-12, `git ls-remote origin`)
"`master` = `develop`" is true **only locally**. On GitHub: `master` = `27f7b1a` (the
0.55.4–0.55.6 patch merges), `develop` = `2226517` (0.57.0), `production` = `0ca90e0` (0.52.0).
Local `master` (`042213f`) is **31 commits ahead of `origin/master`** and unpushed. Between
`origin/master` and `develop` sit 22 non-merge commits, and they are **mostly vendor
sign-up / login / KYC**, not booker: login fix (0.55.7), sign up first + KYC after
(`app/api/auth/register` rewritten, `register/prepare` removed, new `app/api/kyc/submit`),
KYC notifications + welcome step (0.55.8–0.55.10), kiosk persisted-payment check, success
redesign (0.55.11), customer documents in BookingDetails (0.56.0), 0.57.0 prep. The KYC path
needs migrations `20260930000001`, `20260930000002`, `20261001000001` on the target DB.

So "release the wizard from `develop`" changes production by **only the wizard** if production
already runs 0.57.0, and by **all of the above plus the wizard** if production runs what GitHub
`master` holds. Which one is true is visible only in Vercel (the production deployment's commit
SHA). Either way the wizard itself is portable: across every file it touches, `origin/master`
and `develop` differ only in `AppShell/` (the KYC gate), which the plan reads but does not edit.

### Production commit confirmed (2026-10-12, user): `e7d6b9a` = v0.55.11
So the sign-up/KYC/login rewrite is **already live**. `e7d6b9a..develop` holds only:
1. `878155a` — kiosk confirmation reads the **persisted** payment status before saying "paid"
   (`StepConfirmation`, `useKioskReceipt`, `lib/kioskPaymentStatus`, `kiosk.service.ts`). A
   real, customer-visible kiosk change (safety fix); existing columns only.
2. `f7714d7`/`e010827` (0.56.0) — "Customer documents" in booking details
   (`bookingDocuments.service.ts`, `BookingDetails*`). Reads `booking_documents` (table + RLS
   since `20260507000004`). The section is **hidden when a booking has no rows**, so it is
   invisible in production until booker actually stores uploads; *opening* a file needs the
   `booking-documents` storage policies from booker plan C1's migration — only reachable once
   rows exist. Assumption to check: `select count(*) from booking_documents` on production.
3. `302dc4b` — offering "view link" fix in booking details.
4. Version bump, `playwright.config.ts`, AGENTS/CLAUDE docs, two booking-details baselines,
   ui-gallery fixtures — no runtime effect.
`git diff e7d6b9a develop` over this plan's files is **empty** — the wizard is identical on
either base.

## Execution order
Approved 2026-10-13. Every stage runs on `feature/offiering_wizard` (D7); the user handles git. Then, one stage at a time:
1. **Stage 1 — B1** field extraction (edit form behaviour-neutral; safe on its own; proves no
   regression before anything new depends on it).
2. **Stage 2 — seams, no UI:** `useOfferingForm` exports (B3) + I2's `conflict` flag on
   `createOffering` + the code-clash helper and its unit test. (B2 aborted.)
3. **Stage 3 — B3 + I1 + I3 + I4** the wizard component, built mobile-first (one batch: the
   shell, its leave-guards, layout and a11y are one component).
4. **Stage 4 — B4 + I2** wiring and error placement (coupled: the wizard becomes reachable here).
5. **Stage 5 — I5** fixture + scoped spec, then **I6** copy/docs.

## Verification
- Every stage: `npx tsc --noEmit`, `npm run lint` (no new problems compared with the D8 baseline of 29), `npm test` in `vendor/` (machine).
- Stage 1 and 5: scoped Playwright runs listed in I5 (machine, needs no other dev server on
  `vendor/`).
- Live (user, or local with a vendor login): full create on 360px and desktop, both themes;
  keyboard-only; duplicate code; step 5 shows no Back and the "Saved" note; abandon at each
  step (before save → nothing in the list; after save → the offering is listed); edit an
  existing offering — unchanged.
