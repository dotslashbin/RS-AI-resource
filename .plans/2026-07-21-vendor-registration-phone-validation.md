# Vendor registration — phone number format validation

**Date:** 2026-07-21
**App / scope:** `./vendor` only (single app, no cross-app touch). Optional DB-layer item (D3) is schema territory — its own separate approval gate, per `AGENTS.md`.
**Status:** DRAFT — all decisions (D1–D5) resolved 2026-07-21. Ready for execution pending your go-ahead. No code changed.

> **Goal:** the Phone field on the vendor onboarding wizard's Step 1 (Business Details) currently accepts anything, including letters. It should reject non-phone-like input (in particular alphanumeric junk) with clear, immediate feedback — not silently accept it and fail later.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.

---

## Investigation (verified against the actual code, not assumed)

**The bug is real, but only half the picture — a working check already exists, just in the wrong place.**

| Layer | Current state | File |
|---|---|---|
| Step 1 → 2 client-side gate | Checks only `vendorName` and `address` are non-empty. **Zero phone check** — letters, symbols, anything passes | `useLoginPage.ts:180-187` (`handleDetailsContinue`) |
| The `<input>` itself | `type="tel"` — this only changes the mobile keyboard layout; it does **not** block letters from being typed or pasted | `LoginPage.tsx:300` |
| Final atomic submit (server) | **Already validates correctly:** `if (phone) { const digits = phone.replace(/\D/g, ""); if (!/^[\d\s+()-]+$/.test(phone) \|\| digits.length < 7 \|\| digits.length > 15) return err(...) }` — rejects letters, requires 7–15 digits (a sensible international range, phone is treated as **optional**) | `app/api/auth/register/route.ts:43-46` |
| DB | No CHECK constraint on `vendors.phone` (unlike `staff.email`'s precedent — see D3) | `20260507000001_staff.sql:30` has `staff_email_format`; nothing equivalent exists for any phone column |

**So today's actual user experience:** a vendor can type letters into Phone at Step 1, sail through Steps 2–5 (documents, identity/camera capture, review — the most tedious steps), and only get rejected at the very last click, with everything above having to be redone. The fix isn't inventing new validation — it's **surfacing the validation that already exists on the server, earlier, on the client**, so the same character-set/length rule guards the door instead of just the final gate.

**One more real thing found, not part of the ask — flagging, not fixing silently:** the Phone field's label shows a required-asterisk (`RegisterField.tsx:21`, unconditional on every `RF` field) even though phone is actually **optional** (`if (phone)` in the route only validates when non-empty — an empty phone passes). Resolved via D4 below — rather than removing the asterisk, phone becomes genuinely required.

---

## Proposed fix (not applied — plan only)

### 1. Extract the validation logic into one shared place, not duplicate it

Right now the correct format logic exists in exactly one place (the server route). Duplicating the same regex by hand into the client hook risks the two silently drifting apart later. Extract it once, import it in both. **Kept as a pure format-checker, not conflated with "required"** — presence is a separate concern, checked by each call site the same way `vendorName`/`address` already are; this keeps the helper composable regardless of which fields treat phone as required (single responsibility: this function answers "is this shaped like a phone number", nothing else):

```ts
// vendor/lib/validation.ts (new file)
export function isValidPhone(phone: string): boolean {
  if (!phone) return true // format-only — presence is checked separately by the caller
  const digits = phone.replace(/\D/g, "")
  return /^[\d\s+()-]+$/.test(phone) && digits.length >= 7 && digits.length <= 15
}
```

- `app/api/auth/register/route.ts` → per **D4**, phone is now required. Fold it into the existing "missing required fields" check (`:38`) and drop the `if (phone)` conditional guard around the format check (`:43-46`), since presence is now guaranteed by the line above it:
  ```ts
  if (!email || !password || !vendorName || !address || !phone) return err("Missing required fields.")
  // ...
  if (!isValidPhone(phone)) return err("Please enter a valid phone number.")
  ```
- `useLoginPage.ts`'s `handleDetailsContinue` → add phone to the existing required check (matches how `vendorName`/`address` are already checked) **and** keep the format check as a second, separate gate — this is the safety-net for the "Continue" click; the day-to-day feedback is the live validation below:
  ```ts
  const handleDetailsContinue = () => {
    if (!regForm.vendorName.trim() || !regForm.address.trim() || !regForm.phone.trim()) {
      setLoginError("Business name, address, and phone are required.")
      return
    }
    if (!isValidPhone(regForm.phone.trim())) {
      setLoginError("Please enter a valid phone number.")
      return
    }
    setLoginError(null)
    setRegStep(2)
  }
  ```

### 2. Live-as-you-type validation (D1) — new plumbing, scoped to the Phone field only

The other 8 fields in this form (`vendorName`, `address`, `email`, `password`, etc.) keep their existing validate-on-continue behavior unchanged — this isn't a form-wide redesign, just Phone. That means `RF`/`useRegisterField` need a small, **opt-in** addition (a prop left `undefined` for every other field call-site = zero behavior change there):

- **`RegisterField.tsx`** — add an optional `error?: string | null` prop and an `onBlur?: () => void` passthrough on the `<input>`. When `error` is set, render a small inline message beneath the field (new `.error` class in `RegisterField.module.css`) and switch the input's border to an error style.
- **`useLoginPage.ts`** — derive the phone error live from `regForm.phone` on every render (cheap; no memoization needed for a single-field string check), and track whether the user has left the field at least once:
  ```ts
  const [phoneTouched, setPhoneTouched] = useState(false)
  const phoneCharError = /[a-zA-Z]/.test(regForm.phone) ? "Phone number can't contain letters." : null
  const phoneError =
    phoneCharError
      ?? (phoneTouched && regForm.phone.trim() && !isValidPhone(regForm.phone.trim())
          ? "Please enter a valid phone number."
          : null)
  ```
  See **D5** below for the reasoning behind splitting this into two tiers rather than showing every violation immediately.
- **`LoginPage.tsx`**'s phone `<RF>` call site gets the two new props: `error={phoneError} onBlur={() => setPhoneTouched(true)}`. The other 8 `<RF>` call sites are untouched.

---

## DECISIONS

- **D1 — When to validate** → **live, as the user types** (resolved 2026-07-21). Scoped to the Phone field only — the other 8 fields keep validate-on-continue. Needs the `RF`/`useRegisterField` plumbing above (opt-in, zero effect on other fields). See D5 for the exact live-feedback timing.
- **D2 — Validation method** → **reuse/extract the existing regex+length check** (resolved 2026-07-21). No new dependency; client and server import the same `isValidPhone`, so they can't drift apart.
- **D3 — DB-level CHECK constraint** → **skipped, per my recommendation** (resolved 2026-07-21) — not part of this execution. The app-level checks (client + server, both now enforcing required + format) cover every real write path; the DB constraint would only additionally guard a direct write that bypasses the app entirely (a script, a dashboard edit), which isn't in scope for this ask. Can be revisited later as its own small plan if that scenario becomes a real concern — the exact migration is still drafted below for reference, just not executed:
  ```sql
  -- NOT executing — reference only, per the decision above
  alter table public.vendors
    add constraint vendors_phone_format
    check (phone = '' or phone is null or phone ~ '^[0-9 +()-]+$');
  ```
- **D4 — Phone requiredness** → **made genuinely required, both client and server** (resolved 2026-07-21 — overrides the plan's original suggestion, which was to mark the asterisk as *optional* instead; the user chose the opposite direction). Server: folded into the existing "missing required fields" check. Client: folded into `handleDetailsContinue`'s existing required check alongside `vendorName`/`address`. The `RF` asterisk needs no change at all now — it was already (accidentally) showing the correct thing.

## D5 — Live-validation feedback timing → **two-tier split, per recommendation** (resolved 2026-07-21)

A naive "show every validation error on every keystroke" is a real UX trap here: a phone number starts as `+` or a single digit, which would trigger a false "too short" error the instant the user starts typing — before they've had any real chance to finish. Resolved as two genuinely different kinds of violation with different timing:

- **Character-set violation (a letter appears)** — unambiguous the moment it happens; shown **immediately**, keystroke-by-keystroke. This directly matches the actual complaint ("not alphanumeric").
- **Length/completeness ("too short")** and **required-but-empty** — normal/expected while a user is still mid-typing or hasn't reached the field yet; deferred until the field is **blurred** (left) or the user clicks Continue, not shown on every keystroke.

The code sketch in "Proposed fix" §2 above already implements this (`phoneCharError` immediate, the length/format check gated on `phoneTouched`) — no change needed to that sketch, it's confirmed as final.

---

## All decisions resolved (2026-07-21) — plan ready for execution whenever you give the go-ahead

D1–D5 are all locked in. Nothing left open. Execution order below is now the actual build sequence, not contingent on further input.

## Execution order
1. `vendor/lib/validation.ts` — new file, `isValidPhone`.
2. `app/api/auth/register/route.ts` — fold phone into required fields; drop the now-redundant `if (phone)` guard around the format check.
3. `RegisterField.tsx` / `RegisterField.module.css` / `useRegisterField.ts` (if needed) — add the opt-in `error`/`onBlur` props + error styling.
4. `useLoginPage.ts` — required check (phone added), live `phoneCharError`/`phoneError` derivation, `phoneTouched` state.
5. `LoginPage.tsx` — wire the two new props onto the Phone `<RF>` call site only.

## Verification
- Machine: `tsc --noEmit`.
- Live (needs a live environment/browser): typing a single letter anywhere in the phone field shows the character error **immediately**, before leaving the field; typing digits-only never shows an error while actively typing, even when short; leaving the field (blur) with a too-short or empty value shows the appropriate error; a valid PH-style number ("+63 917 000 0000") shows no error at any point and advances on Continue; attempting Continue with phone empty or invalid is blocked with the matching message, same as `vendorName`/`address` today; confirm the final-submit server check still independently rejects bad/missing input too (defense in depth intact — the live client check is a UX improvement, not a replacement for server enforcement).

## Notes
- No code changes made — plan only, per instruction.
- No commits by the agent — user handles commits.
- Scope stayed to what was asked (vendor's business-registration phone field); the same missing-early-validation pattern likely exists elsewhere phone is collected (vendor profile edit, Command's vendor form, staff phone) — not investigated or touched here, flagging only in case it's worth its own follow-up later.
