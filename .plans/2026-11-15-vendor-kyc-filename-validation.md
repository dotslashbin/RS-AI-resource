# Vendor KYC — accept file names with consecutive dots, keep the traversal guard, say "file name" in the error; rename the DTI slot to DTI/SEC

**Date:** 2026-11-15
**App / scope:** `vendor/` only — `lib/kycSubmission.ts`, `lib/kycSubmission.test.ts`, one comment in `lib/registration.ts`; for B3, `app/api/auth/register/route.ts` + a pure helper in `lib/registration.ts` (+ test); for I2, `lib/registration.ts` + `components/auth/LoginPage/useLoginPage.ts` + `components/settings/SecurityCard/useSecurityCard.ts`; for I1, `lib/kycDocumentSlots.ts` (+ test), `visual-tests/kyc-document-slots.spec.ts`, `components/kyc/KycWelcomeStep/KycWelcomeStep.tsx` (D4) and vendor screenshot baselines. No migration, nothing in `backbone/`, no Command / booker / mobile change.
**Status:** COMPLETE (2026-11-15) — release: staging ✅ · production ✅ (vendor 0.60.1, Vercel Promote by the user; S1–S6 and P1–P4 green by the user)

> A vendor's first KYC submission fails when a file name contains `..` (e.g. `scan..pdf`).
> Swap the over-broad substring blocklist for an allowlist of the name shape the client
> already produces, and make the error say plainly that the file name is the problem.
> Separately (I1), the company "DTI Document" slot is renamed to "DTI/SEC Document".
> And (B3) signup stops blaming the email when Supabase actually rejected the **password**,
> and (I2) every password form rejects anything over Supabase's 72-byte limit with a clear message.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision, F# = Finding,
> S# / P# = staging / production release step. Numbers are plan-local — qualify
> cross-plan refs by app (e.g. "vendor B2 of 2026-09-30").

---

## ▶ RESUME HERE (updated 2026-11-15, plan COMPLETE)
- **Shipped:** B1, B2, B3, I1, I2 in vendor 0.60.1 (`67f7525` + `c8cb86a`), live on staging
  and production. Docs updated (see Docs).
- **Nothing left to execute.** Still open, reported only and left for the user: F2 (resubmit
  path has no 80-character cap), F4 (local Auth enforces no password policy), F7 (vendor
  lint was already failing in untouched files).
- **Not done here, by scope:** Command still prints raw label codes, so reviewers see
  `dti-document` or `dti-sec-document` depending on the packet's age (D3). Booker and Command
  have no 72-byte password cap yet (noted in `architecture/auth-and-roles.md`).
- **Local test data:** vendors `Stage2 KYC 1794764302654` and `Stage2 KYC 1794764383094`
  remain in the local DB; `supabase db reset` clears them.

---

## Background (verified 2026-11-15)

- **Where the rule lives:** `vendor/lib/kycSubmission.ts:65`:
  `objectName.includes("/") || objectName.includes("\\") || objectName.includes("..")` →
  `"Invalid document reference."`. Its only caller is `vendor/app/api/kyc/submit/route.ts:55`
  (first submission). Nothing in Command, booker or the mobile apps calls the route.
- **Why legit files hit it:** the client names each upload with `stagedObjectName`
  (`vendor/lib/registration.ts:174`): `{uuid}-{name}`, with the name cleaned to `[\w.\-]`
  and cut to 80 chars. Dots survive, so `scan..pdf` → `{uuid}-scan..pdf` → rejected.
- **No migration:** the bucket policies only look at the folder,
  `(storage.foldername(name))[1]` (`backbone/supabase/migrations/20260706000002_vendor_kyc_storage.sql`).
  `vendor_kyc_documents.storage_path` is plain `text` with no check.
- **The real guard is somewhere else:** the route lists `{vendorId}/` and refuses any name it
  did not find (`route.ts`, the `byName` lookup). `/` and `\` are refused too. Storage keys are
  literal strings, so `..` inside a key is not "parent folder". So the `..` substring check is
  belt-and-braces that blocks harmless names.
- **Where it came from:** `.plans/2026-09-30-vendor-signup-before-kyc.md` B2 (lines 119, 866)
  listed `..` among the "traversal" inputs. No decision was ever recorded about names that
  merely *contain* two dots.
- **Resubmission is not affected:** `resubmitKyc` (`vendor/services/kyc.service.ts:255`) uploads
  and inserts directly under RLS and never calls this validator, so dotted names already
  work there.
- **How the error reaches the vendor:** route 400 `{ error }` → `submitFirstKyc` returns
  `json.error` as-is (`kyc.service.ts:168-170`) → `useKycSubmitForm.ts:190` `setError` →
  `KycSubmitForm.tsx` `<p className={styles.error}>`. React renders it as text, so echoing a
  file name cannot inject markup.

---

## BLOCKERS

### B1 — Replace the `..` substring blocklist with an allowlist of the object-name shape  ✅ DONE (2026-11-15)
> **Verified (machine, local):** fixtures switched to `{uuid}-name.pdf` first and the suite run green under the **old** rule (572/572), so no rejection test relies on the shape check by accident. Then `OBJECT_NAME` replaced the `includes` test, the coupling line went into the `stagedObjectName` comment, and every listed reject/accept case plus the `stagedObjectName("my scan..final.pdf")` round-trip was added; each reject also asserts the error says `file name`. `npm test` green.
**File:** `vendor/lib/kycSubmission.ts:63-67` (+ coupling comment at `vendor/lib/registration.ts:165-176`)

The substring check blocks valid names and doesn't say what is allowed. Best practice for
path traversal is to allow a known-good shape rather than block bad substrings.

**Fix approach:**
- Add, next to the existing `UUID` const:
  ```ts
  // Exactly what stagedObjectName (registration.ts) produces: `{uuid}-{name}`, the name
  // cleaned to [\w.\-] and at most 80 chars. Dots anywhere are fine (`scan..pdf`); no
  // separators can appear, so the object cannot leave `{vendorId}/`, and the uuid prefix
  // means the whole name can never be `.` or `..`.
  const OBJECT_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[\w.\-]{1,80}$/i
  ```
- Replace the three-way `includes` test with `if (!OBJECT_NAME.test(objectName)) return bad(<B2 message>)`.
- Add one line to the `stagedObjectName` doc comment: *"⚠️ `OBJECT_NAME` in kycSubmission.ts
  mirrors this shape — change both together."*
- Keep the duplicate check, label check, and every route-side check unchanged.

**Compatibility:** `stagedObjectName` has produced this exact shape since `04965e2`, so a
stale browser bundle still passes. The only client is vendor web.

**Tests (`vendor/lib/kycSubmission.test.ts`):**
- **Fix fixtures first.** `doc()` defaults to `"a1b2-permit.pdf"`, and the label and
  duplicate tests use `"a.pdf"`. Both fail the new shape, so those tests would pass for the
  wrong reason. Switch them to a real `{uuid}-name.pdf`, using a second uuid where a
  distinct name is needed.
- **Rejects:** `""`, `"."`, `".."`, `"../x.pdf"`, `"a/b.pdf"`, `"a\\b.pdf"`, `"permit.pdf"`
  (no prefix), `"{uuid}-"` (empty name), `"{uuid}-a/b.pdf"`, `"{uuid}-a\\b.pdf"`,
  `"{uuid}-my scan.pdf"` (space), `"{uuid}-" + "x".repeat(81)`.
- **Accepts (new):** `"{uuid}-scan..pdf"`, `"{uuid}-x..y"`, `"{uuid}-...pdf"`,
  `"{uuid}-" + "x".repeat(80)`.
- **Round-trip:** `stagedObjectName("my scan..final.pdf")` passes `validateKycSubmission`.
  This pins the coupling so the two can't drift apart unnoticed.

### B2 — Make the error say the file name is the problem, in casual but clear words  ✅ DONE (2026-11-15)
> **Verified (machine, local):** private `fileNameError()` in `kycSubmission.ts` returns the D2 (D1 = B) wording with the name after the uuid prefix, cut to 80, and the D1 = A wording when that is empty. Tests: `{uuid}-a b.pdf` shows `a b.pdf` and not the uuid; `""` and `{uuid}-` get the generic wording with no `""`; a 200-character name shows exactly 80. **Unit tests only:** a legitimate client never sends a bad name, so the message can't be triggered from the UI (see Verification).
**File:** `vendor/lib/kycSubmission.ts:66` (message), `vendor/lib/kycSubmission.test.ts`

`"Invalid document reference."` is a dead end. The vendor can't tell which file is at fault
or what to change. The UX rule (`ux-design` §4) is: say what failed and what to do next.

**Fix approach:** return the D2 wording (D1 = B, name the file).
- **Display name:** if `objectName` starts with `{uuid}-`, show the part after it; otherwise
  show `objectName` as-is. Cut it to 80 characters either way.
- **Empty fallback:** if the display name is empty (e.g. `""` or `"{uuid}-"`), use the D1 = A
  wording instead, so the message never reads `the file name ""`.
- Tests: the rejection's `error` contains `file name`; `"{uuid}-a b.pdf"` shows `a b.pdf`;
  `""` gets the D1 = A wording; a 200-character name is cut to 80.

**Audit of the other errors on this path** (all checked 2026-11-15; only one is about file names):

| Message | Where | About the file name? | Change |
|---|---|---|---|
| `Invalid document reference.` | `kycSubmission.ts:66` | **Yes** | → D2 wording |
| `Invalid document list.` (duplicate / non-object entry) | `kycSubmission.ts:59,70` | No — malformed request, a legitimate client can't send it | none |
| `Invalid document label.` | `kycSubmission.ts:63` | No — the slot label | none |
| `Some documents did not finish uploading…` | `route.ts` (`byName` miss) | No — upload missing | none |
| `A document failed to upload…` | `kyc.service.ts:153` | No — names are cleaned before upload, so Storage won't refuse them | none |
| resubmit `Failed to upload documents…` | `kyc.service.ts:285` | No — same reason | none |

No client-side check at file-pick time is needed: the client cleans every name itself, so a
legitimate pick can't fail on its name. B2's message is for a stale or tampered request.

### B3 — Signup says "This email can't be used…" when Supabase rejected the password  ✅ DONE (2026-11-15, code + unit tests; live check is staging S5)
> **Verified (machine, local):** `createUserFailure()` plus the D5 constants (`PASSWORD_LEAKED_MESSAGE`, `PASSWORD_WEAK_MESSAGE`) and `CREATE_USER_FAILED_MESSAGE` in `registration.ts`; the route passes `createUserError?.code` and, via `isAuthWeakPasswordError`, its `reasons`, and logs the code. Tests cover every table row: pwned (alone and with `length`), `length`, `characters`, empty and missing reasons, `email_exists`, `user_already_exists`, unknown and missing codes (500, never the email message). **Not verified end to end:** local Auth enforces no password policy (F4), so the route mapping has not run against a real weak-password refusal. Staging S5 is the real check.
**File:** `vendor/app/api/auth/register/route.ts:124-130`
```ts
if (createUserError || !created.user) {
  console.error("[vendor/register] createUser failed:", createUserError?.message)
  return err(EMAIL_UNAVAILABLE_MESSAGE)
}
```
Reported 2026-11-15 on staging: step 2, `PeterJohnes@fakemail.com`, 8-character password →
"This email can't be used for a new application. Sign in or reset your password instead."

**✅ Confirmed 2026-11-15 by a local test (the user used `pass1234` and a made-up email on staging):**
- **The route hides `createUser` failures (machine-verified, local):** a full `POST /api/auth/register`
  on the vendor dev server (:3100, local Supabase), with a brand-new, unused email and an
  80-character password (local Auth's one refusable case, see F4), returned **HTTP 400
  "This email can't be used for a new application…"**. The server log read
  `[vendor/register] createUser failed: Internal Server Error`. Nothing was created
  (0 probe users, 0 probe vendors, checked in the local DB afterwards).
- **Staging refuses `pass1234` (machine-verified):** HaveIBeenPwned's range API (only the
  5-character SHA-1 prefix `789B4` was sent) lists `pass1234` **854,341** times. Staging has
  leaked-password protection on, and it's enforced by `createUser` (booker plan B2-e).
- So on staging `pass1234` → `createUser` refuses it as weak → the route shows the email
  message. Root cause confirmed; the Vercel log check in F3 is no longer needed.
- Local Auth could not reproduce the leaked check itself (F4). Turning it on locally would
  mean editing `config.toml` and restarting local Auth, which I didn't do.

**Diagnosis (code-verified 2026-11-15):**
1. **It isn't the email pre-check.** When `checkEmailAvailable` says taken, the hook sets
   `emailCheck.taken` (`useLoginPage.ts:552-555`), which also puts the message **under the
   email field** (`LoginPage.tsx:348`). The screenshot shows it only at the bottom, so the
   pre-check passed: no `profiles` row has that email. The route's own re-check
   (`route.ts:101-102`) runs the same query seconds later, so it passes too.
2. **So it's the `createUser` backstop.** The route maps **every** `createUser` failure to the
   email message on purpose (A-I1, to avoid account enumeration). But "email taken" is only
   one of the ways `createUser` can fail.
3. **What changed:** on 2026-10-28 staging Auth got minimum length 8 and
   **leaked-password protection on** (`.plans/2026-10-27-booker-v1-pre-release.md` B2-b).
   That plan verified that `auth.admin.createUser` **enforces** the policy (B2-e), and that
   `password123` is refused as "known to be weak". Booker shows that rejection verbatim;
   vendor turns it into "this email can't be used". Production has the same policy
   (leaked on; length 8 since 2026-10-29, P1 of that plan), so **production vendor signup
   is affected too**.
4. **Likeliest trigger:** a common 8-character password (`password`, `12345678`,
   `Password1`…), which passes the vendor form's own 8-character check and then fails the
   leaked-password check on the server.

**Is it a bug?** Yes. The vendor is told to sign in or reset a password for an account that
doesn't exist, and nothing tells them to change the password, which is the only thing that
would work.

**Fix approach:** branch on the auth error code instead of mapping everything to one
message. Put the mapping in a pure helper in `lib/registration.ts` so it's unit-tested
(`registration.ts` already holds signup's input rules and imports no Supabase code):
`export function createUserFailure(code: string | undefined, reasons: readonly string[] | undefined): { status: 400 | 500; message: string }`.
The route passes `createUserError?.code` and, when `isAuthWeakPasswordError(createUserError)`
(exported by supabase-js), `createUserError.reasons`. supabase-js 2.105.4 gives weak
passwords `code: "weak_password"` and `reasons: ("length" | "characters" | "pwned")[]`.
Import `EMAIL_UNAVAILABLE_MESSAGE` into `registration.ts` as `./emailAvailability.ts`: relative,
with the extension, because `npm test` resolves no `@/` alias. `emailAvailability.ts` has only
a type import, which `--experimental-strip-types` erases.

| `createUser` error | Response |
|---|---|
| `weak_password`, reasons include `pwned` | 400, D5 leaked-password message |
| `weak_password`, any other reason | 400, D5 requirements message |
| `email_exists` / `user_already_exists` | 400, `EMAIL_UNAVAILABLE_MESSAGE` (unchanged) |
| anything else, or no user returned | 500, *"We couldn't create your account just now. Please try again in a minute."* |

- Keep the `console.error`, and add the error `code` to it so the next diagnosis is one log line.
- **No new enumeration oracle.** A password message says nothing about the email. And
  whether an email is free is already answered by `/api/auth/check-email`, which A-I1
  accepted with its constraints.
- Nothing has been created when `createUser` fails, so there's nothing to roll back. That
  matches today's behaviour.
- Client: no change. `signUpVendor` already shows `json.error` (`kyc.service.ts:107-108`),
  and a password error leaves the email field without its inline "taken" error, which is
  correct.

**Tests (`vendor/lib/registration.test.ts`):** one case per table row, including
`weak_password` with an empty `reasons` list (→ requirements message) and an unknown code
(→ the generic message, never the email one).

---

## IMPORTANT

### I1 — Rename the company "DTI Document" slot to "DTI/SEC Document"  ✅ DONE (2026-11-15, code + machine checks; browser check is stage 2)
> **Verified (machine, local):** value, title, const name, `KycSlotValue`, header comments and the round-5 note changed; `dti-document` added to `RETIRED_LABEL_TITLES`; D4 welcome copy changed. Before the tests were updated, 7 slot tests failed and `tsc` flagged the two stale `dti-document` keys, which confirms they ran. After the update: unit tests green, retired title asserted, and all 10 `kyc-document-slots.spec.ts` tests pass with the new labels. Screenshot review: only `kycstatus-welcome-light` and `-dark` differed, and both diffs were confined to the first "need" chip (new text, chip slightly wider). Those two were regenerated with `npm run test:visual:update -- -g "kycstatus-welcome"` (exactly 2 PNGs written). No `kycsubmit-*` or other `kycstatus-*` baseline changed. Full suite then 219/219.
**File:** `vendor/lib/kycDocumentSlots.ts:34`
`const DTI_DOCUMENT: KycDocumentSlot = { value: "dti-document", title: "DTI Document" }`

Each slot has two fields (verified 2026-11-15):
- **`title`** is what the vendor reads: the slot heading, the "Attach / Replace / Remove …"
  button labels, the review list, the "Attach your … to continue." line, and "Already
  submitted" in the resubmit view (via `titleForLabel`, `KycStatusPage.tsx:84`).
- **`value`** (`dti-document`) is stored verbatim in `vendor_kyc_documents.label`. The file
  header calls it "a contract, not copy". **Command prints that raw value** to reviewers
  (`command/components/vendors/VendorViewModal/KycPanel.tsx:64`, `{doc.label}`), so reviewers
  see `dti-document` today and would keep seeing it after a title-only change.

**Fix approach (D3 = B, resolved 2026-11-15):** change both the title and the stored value,
with no migration:
- `kycDocumentSlots.ts:21`: `KycSlotValue` = `"dti-sec-document" | "mayors-permit"`.
- `kycDocumentSlots.ts:34`: `{ value: "dti-sec-document", title: "DTI/SEC Document" }`. The
  value keeps D1's shape of the 2026-10-19 plan (lowercase, hyphenated). Rename the const
  to `DTI_SEC_DOCUMENT`.
- `RETIRED_LABEL_TITLES`: add `"dti-document": "DTI Document"`. This is **required, not
  tidy-up**: without it, packets submitted before the change would show the raw
  `dti-document` in the resubmit view. It keeps the title those vendors were asked for,
  the same way the other retired entries do.
- Update the header comment (lines 8–9 and the round-4 note) to say this is round 5
  (2026-11-15): DTI became DTI/SEC, the value is now `dti-sec-document`, and old rows keep
  `dti-document`.
- **No migration** (D3): existing rows are not renamed.
- Every use of the old value is inside vendor (grep 2026-11-15: `kycDocumentSlots.ts` and
  its test only). Command never matches on it, and the slot files live in memory only
  (`kycDraft.ts` stores no KYC fields), so no saved draft carries the old key.
- If D4 = A: `components/kyc/KycWelcomeStep/KycWelcomeStep.tsx:17`
  `"DTI document and mayors permit (companies)"` → `"DTI/SEC document and mayors permit (companies)"`.
  This is a module-level string constant in a pure display component, so render/hook/style
  separation is unaffected.
- Leave `KycSubmitForm.tsx:48` alone. "Registered business (DTI / SEC)" already names both.

**Tests to update** (they pin the old title, so they would fail, which is how we confirm they ran):
- `vendor/lib/kycDocumentSlots.test.ts:25, 77, 81, 110`: `"DTI Document"` → `"DTI/SEC Document"`
  (line 110 becomes `"DTI/SEC Document and Mayors permit"`); lines 24, 43, 82, 86, 125, 128,
  146: `"dti-document"` → `"dti-sec-document"`. Line 54 becomes two assertions:
  `titleForLabel("dti-sec-document") === "DTI/SEC Document"` and the retired
  `titleForLabel("dti-document") === "DTI Document"`.
- `vendor/visual-tests/kyc-document-slots.spec.ts:51, 54, 56, 78, 108, 120, 147`: text and
  `getByLabel("Attach DTI Document")` → `"Attach DTI/SEC Document"`. Line 9 is a comment;
  update it too.
- **Screenshot baselines:** `visual-tests/pilot.spec.ts-snapshots/kycsubmit-*`,
  `kycstatus-*` and, if D4 = A, `kycstatus-welcome-*` may show the old text. Run the visual
  suite, **look at each diff**, and regenerate only the KYC baselines whose sole change is
  this text (`npm --prefix vendor run test:visual:update -- -g <name>`). Do not
  blanket-regenerate.

**Independent of B1/B2:** a different file and no shared tests, so it can ship in the same
release or on its own.

### I2 — Maximum password length (F5): reject over 72 bytes with a clear message  ✅ DONE (2026-11-15, code + unit tests; browser check is stage 2)
> **Verified (machine, local):** `MAX_PASSWORD_BYTES`, `PASSWORD_TOO_LONG_MESSAGE` and `isPasswordTooLong()` (TextEncoder) in `registration.ts`; checked in `validateFields`, `handleCreateAccount`, `handleResetPassword` (after the minimum check in each) and `useSecurityCard.handleSave` (after `canSave`). Tests: false at 72 ASCII and 24 × `€`, true at 73 ASCII and 25 × `€`; `validateFields` returns the message at 73 and accepts 72. The three hook paths are type-checked and linted but not yet exercised in a browser (stage 2).
**Files:** `vendor/lib/registration.ts:48, :128` · `vendor/components/auth/LoginPage/useLoginPage.ts:428` (reset password), `:532` (create account) · `vendor/components/settings/SecurityCard/useSecurityCard.ts:24-28` (change password in Settings, added by the gap review, F6) · `vendor/lib/registration.test.ts`

**Measured limit (local probe 2026-11-15, all probe users deleted, 0 remain):** Supabase Auth
refuses passwords over **72 bytes**, not 72 characters. 72 ASCII characters work and 73 fail;
24 × `€` (72 bytes) works, but 25 × `€` (25 characters, 75 bytes) fails. A refused password
comes back as `500 unexpected_failure`, the same path B3 maps to its generic message. Today
the vendor app sets no maximum anywhere, so a long passphrase gets the misleading email
message at signup and a raw "Internal Server Error"-style message on password reset
(`handleResetPassword` shows `error.message`).

**Best practice applied** (chosen by me; the user delegated the choice 2026-11-15):
- NIST SP 800-63B: allow long passwords (at least 64 characters), don't truncate silently,
  and reject what can't be stored, with a clear reason. The backend hash (bcrypt) can't use
  more than 72 bytes, so the right maximum is **exactly the backend limit, counted in bytes**.
  A lower number would be arbitrary; a higher one would let users reach the server error.
- **Same rule on client and server.** Client checks give instant feedback; the server check
  is the real guard.

**Fix approach:**
- `registration.ts`: add `export const MAX_PASSWORD_BYTES = 72` next to `MIN_PASSWORD_LENGTH`,
  plus a pure helper
  `export function isPasswordTooLong(pw: string) { return new TextEncoder().encode(pw).length > MAX_PASSWORD_BYTES }`.
  `TextEncoder` is built into both Node and browsers, so no dependency.
  `registration.ts` imports no Supabase or browser-only code, so the hook can import it.
- `validateFields` (`registration.ts:128`): right after the minimum check,
  `if (isPasswordTooLong(f.password)) return bad(PASSWORD_TOO_LONG_MESSAGE)`.
- `useLoginPage.ts:532` (`handleCreateAccount`) and `:428` (`handleResetPassword`): the same
  check after the existing minimum check, `setLoginError(PASSWORD_TOO_LONG_MESSAGE)`. This is
  a hook file, so render/hook separation is untouched.
- `useSecurityCard.ts` `handleSave`, after `if (!canSave) return`:
  `if (isPasswordTooLong(newPassword)) { setError(PASSWORD_TOO_LONG_MESSAGE); return }`. The
  card already renders `error` (`SecurityCard.tsx:81`), so there's no `.tsx` change.
  Today this form shows Supabase's raw error for an over-limit password.
- Message (`PASSWORD_TOO_LONG_MESSAGE`, exported from `registration.ts`, same tone as D2/D5):
  **"That password's a bit too long. Keep it under 72 characters (some symbols and emoji count as more than one)."**
- Out of scope: the "Min. 8 characters" placeholder stays as it is.

**Tests (`registration.test.ts`):** `isPasswordTooLong` false at 72 ASCII and 24 × `€`, true at
73 ASCII and 25 × `€`. `validateFields` returns the too-long message for 73 characters and
accepts 72.

**Couples with B3:** after both ship, the signup route can only reach Auth's over-72 error
through a tampered request, and B3's generic message covers that.

---

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains — see §7. -->
- **D1 → B, D2 → the D1 = B wording below, and go-ahead on the validation change**
  (all resolved 2026-11-15, the user: "Good, I approve that").
- **D1 — Name the file in the message?**
  - **A** — generic: *"one of your file names"*.
  - **B (recommended)** — name it: show the part after the uuid prefix (or the raw value if
    there is no prefix), cut to 80 chars. A specific error is easier to act on, and React
    renders it as plain text. Caveat: it's the **cleaned** name, so `My scan..pdf` would show
    as `My_scan..pdf`. That's still recognisable.
- **D2 — Exact wording** (casual but clear, Canadian English). Approved 2026-11-15: the D1 = B line.
  - with D1 = B: **"Hmm, we couldn't use the file name "{name}". Try renaming it with just letters, numbers, dashes, dots or underscores, then upload it again."**
  - with D1 = A: **"Hmm, one of your file names didn't work for us. Try renaming the file with just letters, numbers, dashes, dots or underscores, then upload it again."**
- **D3 — Title only, or the stored value too?** → **B: change the value too, with no
  migration** (resolved 2026-11-15, the user: "if no migration then yes"). New packets store
  `dti-sec-document`; existing rows keep `dti-document`. Command shows reviewers whichever
  raw value a packet carries, so old and new packets will show different codes.
  - **A (recommended)** — title only (`"DTI/SEC Document"`). Vendor-only, no data contract
    change, old and new packets look the same. Cost: Command reviewers keep seeing the raw
    `dti-document`.
  - **B** — also change `value` to e.g. `dti-sec-document`, and add `dti-document` to
    `RETIRED_LABEL_TITLES`. New packets show `dti-sec-document` in Command, still a raw slug,
    and old packets keep `dti-document`, so reviewers see two labels for one document. Gains
    little.
  - **Migration? (checked 2026-11-15):** not for B itself. `vendor_kyc_documents.label` is
    plain `text not null` with no check constraint and no FK
    (`20260706000001_vendor_kyc.sql:102`), and no later migration alters it, so new rows
    take any value. Only renaming the **existing** `dti-document` rows would need one: a
    data-only `UPDATE` migration, behind the approval gate, written as a file and applied by
    the user. That rename is optional, because `RETIRED_LABEL_TITLES` keeps old rows readable
    in vendor.
  - Reviewers seeing a readable "DTI/SEC Document" in Command needs Command to map labels to
    titles. That's a cross-app change and out of this plan's vendor-only scope; it would
    need its own plan.
- **D4 — Also update the welcome step's checklist?** (`KycWelcomeStep.tsx:17`) →
  **A: yes, "DTI/SEC document and mayors permit (companies)"** (resolved 2026-11-15, the
  user). The vendor reads the same name before and inside the form. Adds the
  `kycstatus-welcome-*` baseline pair to I1's screenshot review.
- **D5 — B3 password messages** → **approved as proposed** (resolved 2026-11-15, the user:
  "ok on those"). B3 was added to the plan after the local test confirmed the cause, as the
  user asked. Wording:
  - leaked: **"That password's turned up in a known data leak, so it isn't safe to use. Try a different one, ideally something you don't use anywhere else."**
  - other weak reasons: **"That password's a bit too weak. Try a longer one with a mix of letters, numbers and symbols."**
- **Approval gate (security-related changes):** B1/B2 approved 2026-11-15 ("Good, I approve
  that"). B3 and I2 were added at the user's request (B3 "include that fix into the plan",
  I2 "yes add a max length check"), and the user asked for a new-session handover prompt
  that states stage 1 is approved (2026-11-15). Executing stage 1 from that prompt counts as
  the go-ahead.

## FINDINGS
- **F1** — The only file-name error on the KYC path is the one B2 changes (table under B2). ✅ checked 2026-11-15 by reading each message site.
- **F2** — `resubmitKyc` cleans names inline (`kyc.service.ts:280`) instead of calling
  `stagedObjectName`, and so has **no 80-char cap**. Harmless today: there's no server
  validator on that path and Storage keys allow 1024 chars. ⬜ reported only — out of scope
  here; leave for the user to schedule.

- **F3** — B3's staging root cause. ✅ Confirmed 2026-11-15 by the local route test plus
  the leaked-list lookup (see B3). An orphan `auth.users` row was the other possible cause;
  it's ruled out for this report because the user typed a random new email and the
  password is on the leaked list. The Vercel staging log line `[vendor/register]
  createUser failed: …` would still show the exact GoTrue message if wanted.
- **F4** — **Local Auth enforces no password policy through the admin API.** A probe on
  2026-11-15 created users locally with `pass1234` and with a 5-character password, even
  though `config.toml` sets a minimum of 6. Both users were deleted straight away; 0 remain.
  Staging *does* enforce its policy there (booker plan B2-e). Consequence: **B3 can't be
  reproduced end to end locally.** Its mapping is covered by unit tests, and the real
  check is staging S5. ⬜ reported only.
- **F5** — **A password over 72 characters gets the same misleading email message today.**
  The vendor form and `validateFields` set no maximum, and GoTrue refuses anything over 72
  with a `500 unexpected_failure` (local probe 2026-11-15). After B3 that becomes the
  generic "We couldn't create your account just now…", which isn't misleading but doesn't
  tell the user what to fix. A one-line maximum check in `validateFields`
  (`registration.ts:128`) would fix it properly. ⬜ reported only, not in scope unless the
  user adds it. → **Promoted to I2** (2026-11-15, the user: "yes add a max length check,
  just pick a best practice").

- **F6** — Gap review before handover (2026-11-15). Found and fixed in the plan:
  (a) Settings → change password (`useSecurityCard.ts`) also needed I2's limit, so it was
  added to I2; (b) B2 needed a fallback when there is no name to show; (c) B3's helper
  signature and import path were pinned; (d) the release ranges, Verification and stage-1
  check commands had gone stale after B3/I2 and were corrected; (e) the approval line was
  updated. Also checked: the kiosk's `createUser` (`lib/kioskCustomer.ts:63`) sets **no
  password**, so neither B3 nor I2 applies to it. ✅ plan text only.
- **F7** — **`npm run lint` exits 1 on vendor before and after this plan** (found 2026-11-15,
  stage 1): 29 problems (26 errors, 3 warnings), all in files this plan doesn't touch
  (`services/vendor-access.service.ts`, `app/ui-gallery/page.tsx`, several `use*.ts` hooks
  among others). `npx eslint` over the 11 changed files exits 0. Likely the territory of
  `.plans/2026-09-25-vendor-eslint-cleanup.md`. ⬜ reported only — not fixed here, left for
  the user to schedule.
- **F8** — **Stage 2, Claude's half: scripted browser run, 14/14** (2026-11-15). A headless
  Playwright script (scratchpad, not in the repo) against `next dev` on :3000 and local
  Supabase: signup with 73 ASCII and with 25 × `€` showed the I2 message and sent **0**
  requests to `/api/auth/register`; 72 ASCII created the account (HTTP 200) and landed on the
  welcome step, which reads "DTI/SEC document and mayors permit (companies)" (D4). The real
  request replayed with a 73-character password got **400** with the I2 message and created
  no user (server guard). KYC: the company documents step and the review list read
  "DTI/SEC Document"; a packet with `scan..pdf` in that slot got `/api/kyc/submit` **200**.
  DB afterwards: row `label = dti-sec-document`, `storage_path = {vendorId}/{uuid}-scan..pdf`,
  and that object exists in `storage.objects` (B1 + I1/D3 confirmed end to end). Reset: the
  recovery email arrived in Mailpit; on "Set a new password" 73 characters showed the message
  with **0** password PUTs, and 72 got HTTP 200 from Auth. **Not covered:** Settings → change
  password (needs an active vendor) and the Command panel view; both are with the user.
  Also on 2026-11-15, at the user's request: a stray root `supabase/snippets/` (empty, made
  by a `supabase start` run from the workspace root) was trashed, and the tracked
  `supabase/.temp/cli-latest` that run had rewritten was put back to `v2.117.0`.
  ✅ machine-verified (the two remaining checks were done in F9).
- **F9** — **Stage 2, the two checks the user delegated: 9/9** (2026-11-15). The user asked
  Claude to run them and approved using the local seed logins from `backbone/supabase/seed.sql`
  (read inside the script, never printed). Command (`next dev` :3300, seed admin `jun@…`):
  the test vendor's KYC panel shows the label `dti-sec-document` and the `scan..pdf` file;
  **View** signs `vendor-kyc/{vendorId}/{uuid}-scan..pdf` and the signed URL returns 200
  with the uploaded bytes. Vendor Settings (active seed vendor admin `marco@…`): 73 ASCII
  shows the I2 message with **0** password PUTs; 72 ASCII saved (HTTP 200, "Password
  updated."). Marco's seed password was then set back through the same form (200), a fresh
  sign-in with it worked, and the DB hash check confirms it. Script fixes along the way (not
  app bugs): Command opens the file with `noopener`, so the signed URL was taken from the
  Storage sign response; the seed vendor's onboarding modals had to be closed before
  Settings could be clicked. No Command code was touched. ✅ machine-verified.

## DEFERRED / COSMETIC
- Any upload flow other than KYC (booking documents, offering attachments, payouts): none of
  them has a `..` rule. Out of scope.

## Execution order
1. **Stage 1 (🤖, local), in this order:** ✅ DONE 2026-11-15 (see each item's verification note).
   1. B1 + B2 together (same lines and test file): fixtures first, then the validator, then
      the new tests.
   2. B3 (independent; shares only `registration.ts`, where B1 adds a comment).
   3. I2, after B3 (both add to `registration.ts`).
   4. I1 (independent).

   **Checks (from `vendor/`, per vendor `AGENTS.md`):** `npm test`, `npx tsc --noEmit`,
   `npm run lint`, then `npm run test:visual` with per-diff baseline review for I1. Stop any
   vendor `next dev` first.
2. **Stage 2 (👤 + 🤖, local runtime):** ✅ DONE 2026-11-15 — both halves run by Claude at the user's request (F8, F9).
   - A company's first KYC submission with `scan..pdf` in the "DTI/SEC Document" slot: it's
     accepted, the slot and review list read "DTI/SEC Document", and Command's KYC panel
     shows `dti-sec-document` (D3 = B).
   - I2 in the browser: a 73-character password on signup, reset and Settings shows the
     too-long message, and 72 characters goes through.
   - B3 can't be shown locally (F4); that's staging S5.

   Needs local Supabase and the vendor dev server.
3. Staging release (S1–S6). ✅ 2026-11-15 — all green, reported by the user.
4. Production release (P1–P4), always last. ✅ 2026-11-15 — all green, reported by the user.
5. Close: docs (below), `**Docs:**` line, status → COMPLETE, `python3 scripts/plans-index.py`. ✅ 2026-11-15.

## Release (§12)
No migration, no Edge Function, no env var. Vendor app only.

### Staging (production untouched throughout)
| # | Who | Step | Check |
|---|---|---|---|
| S1 | 👤 | Deploy vendor to staging | build green |
| S2 | 👤 | First KYC submission with a `..` file name (a fresh signup) | ⛔ accepted; doc opens in Command |
| S3 | 👤 | Normal first KYC submission (plain names) | ⛔ still accepted |
| S4 | 👤 | Company documents step, review list and welcome step (D4) | ⛔ reads "DTI/SEC Document" |
| S5 | 👤 | Register a new business with a leaked password (`password123`), then with a strong one | ⛔ first: the D5 leaked message, and **no** inline email error; second: account created |
| S6 | 👤 | Signup, password reset and Settings → change password with a 73-character password | ⛔ the I2 "too long" message appears before anything is sent; 72 characters still works |

⛔ **Staging fully green before anything touches production.**

> **Result:** S1–S6 ✅ 2026-11-15 — all green, checked on staging by the user (vendor 0.60.1, `c8cb86a`). S5 is the first live confirmation of B3; not re-checked by Claude.

### Production (last stage)
| # | Who | Step | Check |
|---|---|---|---|
| P1 | 👤 | Parity: the staging deployment being promoted is the one tested in S1–S6 | ⛔ same commit |
| P2 | 👤 | Vercel **Promote** that staging deployment | — |
| P3 | 👤 | Smoke: the vendor KYC page loads for a signed-in vendor with no submission yet | ⛔ green |
| P4 | 👤 | Signup with `password123` on production (no account is created when it's refused) | ⛔ the D5 leaked message, not the email one |

> **Result:** P1–P4 ✅ 2026-11-15 — all green, checked on production by the user after the Vercel Promote of the tested staging deployment.

## Verification
- **Machine:** unit tests (B1 shape cases, the round-trip, B2 message, B3 error mapping, I2 byte limit, I1 titles), type-check,
  eslint, the Playwright KYC slot spec, and screenshot baselines (I1, each diff reviewed).
- **Local runtime:** stage 2 (B1, I1, I2).
- **Staging:** S2–S6. Two things are covered by unit tests only, and the report must say so:
  the B2 message (a legitimate client never sends a bad name) and, locally, B3 (local Auth
  enforces no policy, F4). B3's real check is S5.

## Component separation / UX
- No component is created. B1/B2 change only `lib/` and a message string;
  `KycSubmitForm.tsx` already renders `error` as text. I1 changes a `lib/` string and, if
  D4 = A, one module-level string constant in the pure display component `KycWelcomeStep.tsx`.
  B3 changes a route and a `lib/` helper. I2 changes `lib/` plus two hook files
  (`useLoginPage.ts`, `useSecurityCard.ts`), with no `.tsx` change. Render/hook/style
  separation is untouched throughout.
- UX: error state now says what failed (the file name) and what to do (rename, re-upload).

## Docs
**Docs:** `architecture/vendor-kyc.md` (documents step and slot table → "DTI/SEC Document" / `dti-sec-document` with the round-5 note; Storage section: the route's `{uuid}-{name}` shape check; signup: the password-error mapping and the 72-byte cap), `architecture/portals.md` (vendor signup paragraph: DTI/SEC slot and label), `architecture/auth-and-roles.md` (password forms: vendor's 72-byte cap, booker/command without one), `.plans/2026-09-30-vendor-signup-before-kyc.md` (B2: pointer saying the `..` rule was superseded). `vendor/AGENTS.md` and `README.md` checked: nothing there describes these rules, so no change.
