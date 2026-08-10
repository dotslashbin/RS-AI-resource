# Vendor sign-up — division deep-link, and the missing applicant email

**Date:** 2026-08-10
**App / scope:** `vendor/`, plus one `backbone/` migration and Edge Function edit
**Status:** 🔄 **IN PROGRESS (2026-08-10).** Stage 2 (division deep-link) is
✅ complete and browser-verified. Stage 1 (applicant email) is code-complete but
🔄 **not done** — the migration and the Edge Function redeploy are the user's to
run, and no acknowledgement email has been observed yet.

> **Verified this run:** `tsc` 0 · `npm run build` 0 · `npm test` **43/43** (was 39)
> · Playwright **61/61 unchanged**, as predicted — the gallery renders `LoginPage`
> with no query string, so the deep-link effect never fires there.

> Two unrelated things, kept in one plan at the user's request (2026-08-10):
> 1. `/?division=ezzy-well` opens registration with EzzyWell already chosen.
> 2. **B3** — the applicant currently receives no email on sign-up, while the
>    screen tells them one was sent. Admins get theirs; the vendor gets nothing.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important. Numbers are plan-local.

---

## Scope

**In scope:** reading one query parameter on first mount, resolving it to a
division, seeding the registration form with it, and opening the register view.

**Out of scope:**
- Any other prefillable field. Only `division`.
- `command` / `booker` — single-app change.
- Changing how divisions are selected, stored, or validated once chosen.
- Analytics or attribution on the link. Not asked for, and it would need its own
  decisions about what is recorded.

---

## What the investigation found

### This was designed for, three months ago

`divisions.slug` already carries the comment
(`20260724000004_divisions.sql:22`):

> *"Kebab-case identifier, derived from name at creation. Stable — **referenced by
> future filter URLs**; treat as immutable after creation…"*

So the slug is the intended URL handle and this plan is using it as designed. No
architecture conflict; if anything the schema was waiting for this.

### ⚠️ Your example slug does not exist as written

The seeded slugs are kebab-case — `ezzy-drive`, `ezzy-care`, `ezzy-well`,
`ezzy-court`… — so `?division=ezzywell` matches nothing on a strict comparison.
Resolved by **D1: normalised matching**, which makes both forms work.

### The Combobox already handles a value arriving before its options

Worth recording because it removes an implementation worry, not because it needs
work. `useCombobox.ts:20-24` re-syncs the displayed label whenever `selectedLabel`
changes, and its comment names this exact case:

> *"reverse-resolution (an existing record's saved code resolves to a label once
> the options list finishes loading)"*

So setting `divisionId` at any point is safe — the label appears when the
divisions fetch lands. **No sequencing workaround is needed**, and none should be
added.

### `Division` does not carry the slug yet

`lib/types.ts:20-23` is `{ id, name }`, and `app/api/divisions/route.ts:14` selects
`"id, name"`. The slug has to come through before anything can match on it. This is
the only data-shape change in the plan.

### Nothing in the app path reads the query string today

Grep for `useSearchParams|window.location.search|URLSearchParams` across
`components/`, `lib/`, `app/` returns nothing outside `ui-gallery`. This is the
first, which is why B2 spells out the mechanism rather than following a precedent.

---

## BLOCKERS

### B1 — The division slug never reaches the client  ✅ DONE (2026-08-10)
<!-- ✅ `slug: string` added to Division (lib/types.ts) with a comment stating it is
     a lookup key only; route select → "id, name, slug". Verified: tsc 0, build 0. -->
**Files:** `vendor/lib/types.ts:20-23`; `vendor/app/api/divisions/route.ts:14`;
`vendor/services/divisions.service.ts:12-20`

`Division` is `{ id, name }` and the route selects only those two columns, so
there is nothing to match a URL slug against.

**Fix approach:** add `slug: string` to the `Division` interface and `slug` to the
route's `.select(...)`. The service passes the shape straight through, so it needs
no change beyond the type flowing.

⚠️ **Do not swap the Combobox to key on slug.** `divisionOptions`
(`useLoginPage.ts:73`) maps `value: String(d.id)`, the form stores an id, and
`register/route.ts` validates an id against `divisions.id`. The slug is a *lookup
key for the URL only* — it resolves to an id once, and the id remains the value
that is stored and submitted. Changing the stored value would touch the API
contract and the server validation for no benefit.

### B2 — Read the parameter and seed the form  ✅ DONE (2026-08-10)
<!-- ✅ Resolved inside the divisions effect via window.location.search, as planned.
     Browser-verified across all six cases — see the Verification table. -->
**File:** `vendor/components/auth/LoginPage/useLoginPage.ts` — the divisions
effect (`:84-89`) and the draft-restore effect (`:108-131`)

**Fix approach.** Resolve inside the existing divisions effect, because that is the
first moment both halves exist — the fetched list and the parameter:

```ts
useEffect(() => {
  getActiveDivisions().then(({ divisions: rows, error }) => {
    setDivisions(rows)
    setDivisionsError(error)

    const wanted = normaliseSlug(new URLSearchParams(window.location.search).get("division") ?? "")
    if (!wanted) return
    const match = rows.find(d => normaliseSlug(d.slug) === wanted)
    if (!match) return                       // unknown slug → today's behaviour
    setRegForm(f => ({ ...f, divisionId: String(match.id) }))
    setLoginView("register")                 // D2
    setRegStep(1)
  })
}, [])
```

with, in `lib/` beside the other small helpers:

```ts
/** Lowercase, strip everything non-alphanumeric. `ezzy-well`, `EzzyWell` and
 *  `ezzywell` all collapse to the same key (D1). */
export const normaliseSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
```

**Why `window.location.search` and not `useSearchParams()`.** This is a deliberate
choice, not an oversight:

- `useSearchParams()` in a client component opts the route into dynamic rendering
  unless wrapped in `<Suspense>`. `app/page.tsx` is currently a clean server
  component rendering `<AppShell />`; adding a boundary there is real cost.
- This app has **no router navigation** — every view is React state, the URL never
  changes after load. So `useSearchParams`'s one advantage, reacting to param
  changes, is worth nothing here.
- The read happens inside an effect, so it is client-only and cannot cause a
  hydration mismatch.

⚠️ **Ordering against the draft (D3).** The draft-restore effect
(`:108-131`) also writes `divisionId`, and both effects run on mount. The draft's
is **synchronous**; this one resolves after a network round trip, so the parameter
naturally lands last and wins. **That ordering is load-bearing but incidental** —
it holds because of the fetch, not because anything enforces it. Do not "tidy" the
draft restore into an async path without re-checking this.

The functional update (`f => ({ ...f, divisionId })`) is what keeps the rest of the
draft intact — D3 overrides the division only.

**Component separation:** all of this is in `useLoginPage.ts`, which is already the
controller for the registration form. `LoginPage.tsx` is untouched — no new markup,
no new props, nothing added to the render layer.

---

### B3 — The applicant gets no email, and the app says one was sent  🔄 IN PROGRESS (2026-08-10)
<!-- 🔄 Code side complete: migration file 20260808000001 recreated (additive only,
     `on conflict do nothing`, no destructive statements); Edge Function
     NotificationType union restored with the three types. register/route.ts
     deliberately untouched — it was already correct.
     ⚠️ NOT ✅ AND MUST NOT BE until an acknowledgement email is seen in an inbox.
     Two steps are the user's and neither has happened:
       cd backbone && npx supabase migration up --local
       npx supabase functions deploy send-notification-email
     Marking this DONE on "code written" is the exact mistake made on 2026-08-08. -->
**Files:** `backbone/supabase/migrations/` (file missing);
`backbone/supabase/functions/send-notification-email/types.ts:6-13`;
`vendor/components/auth/LoginPage/LoginPage.tsx:482` (the false promise)

> ⚠️ **Corrected framing — this is NOT "not implemented".** The application code is
> written, correct, and shipped. It is *inert*, and one missing row is why.

**Traced end to end against the running stack:**

1. `vendor/app/api/auth/register/route.ts:265-272` **does** write a vendor-addressed
   `vendor_registration_received` notification. That code is present and right.
2. It is guarded by `typeAck?.is_enabled`, read via `.maybeSingle()` at `:256`.
3. **`vendor_registration_received` does not exist in `notification_type_settings`.**
   Confirmed by querying the live DB — 12 types are present, that one is not.
4. So `typeAck` is `undefined`, the guard is false, **no row is inserted**, and with
   no row there is nothing for the dispatch trigger to email.
5. Admins are unaffected: `vendor_pending_approval` and `new_user_registration` are
   both seeded, which is exactly why Resend shows their mail and not the vendor's.

**Root cause:** the migration that creates the type,
`20260808000001_vendor_lifecycle_notification_types.sql`, was written on 2026-08-08,
**never applied**, and has since been **deleted from the working tree**. The last
applied migration is `20260807000001`. The Edge Function's `NotificationType` union
lost its three entries in the same revert.

> 🔴 **Why this is a blocker and not an IMPORTANT.** `LoginPage.tsx:482` currently
> reads *"We've received your application and **sent a confirmation to your
> email**."* That is false today. Worse, it is copy **I wrote** in the previous
> plan's A-I3, on the assumption A-B6 would land — so the app actively lies to
> every applicant. Either the email starts working or that sentence comes out;
> shipping the current pair is not an option.

**The guard is good design and should stay.** `.maybeSingle()` plus the
`is_enabled` check is why a missing type degrades to "no email" instead of a failed
registration — the FK on `notifications.type` would otherwise have thrown mid-flow.
Do not "simplify" it away. **See I3** for making the silence audible.

**Fix approach — three parts, no app-logic change:**

1. **Recreate the migration.** ⚠️ **Approval gate — draft only, do not apply.**
   Exact SQL and blast radius in **Appendix A** below.
2. **Restore the Edge Function union** — add `vendor_registration_received`,
   `kyc_approved`, `kyc_rejected` to `types.ts:6-13`.
   ⚠️ **The function must be REDEPLOYED**, or the union change does nothing. Without
   it the mail still sends via the generic template, so the failure is wrong copy
   rather than no delivery.
3. **No change to `register/route.ts`.** It is already correct. Resist the urge to
   touch it — the bug is entirely upstream of the code.

**Coupling:** B3 and the `LoginPage.tsx:482` copy are two ends of one promise.
If B3 is deferred, the copy **must** change in the same breath. They cannot ship
apart.

---

## IMPORTANT

### I1 — `normaliseSlug` needs a unit test  ✅ DONE (2026-08-10)
<!-- ✅ lib/slug.ts + lib/slug.test.ts, no @/ imports so node --test can load it.
     4 cases incl. a collision guard across all 12 seeded slugs. 43/43 pass (was 39). -->
**File:** new `vendor/lib/slug.test.ts`

The matching rule *is* the feature, and it is pure logic with no dependencies —
exactly what this repo's `node --test` runner exists for
(`conventions.md` → "Unit tests in the web apps").

Cases: `ezzy-well` / `ezzywell` / `EzzyWell` / `ezzy_well` all equal; `ezzy-care`
does **not** equal `ezzy-well`; empty string stays empty.

⚠️ Put `normaliseSlug` in its own `lib/slug.ts` with **no `@/` alias imports** —
`node --test` has no bundler and cannot resolve the alias. Same trap
`conventions.md` already records for `lib/occurrence.ts`.

### I2 — The gallery has no fixture for the preselected state  ✖ ABORTED (2026-08-10)
<!-- ✖ Skipped exactly as this item allowed for. The gallery fixture cannot exercise
     the effect — it needs the /api/divisions round trip AND a query string, neither
     of which the harness provides — so any "coverage" would assert a hand-set prop
     rather than the feature. The real logic is covered by I1's unit tests and the
     six browser cases in Verification. Recorded as a decision, not an omission. -->
**File:** `vendor/app/ui-gallery/page.tsx`

`loginregister` renders the register view with an empty division. There is no
pixel coverage of the preselected state, so a regression that silently stopped
prefilling would not be caught.

**Deliberately kept cheap:** the gallery fixture cannot exercise the real effect
(it needs the API and a query string), so this is not worth a new mode. **Skip it
if it costs more than a few lines** — I1's unit test covers the actual logic, and
the browser check in Verification covers the wiring. Recorded so the gap is a
decision rather than an omission.

---

### I3 — A missing notification type fails silently  ✅ DONE (2026-08-10)
<!-- ✅ console.warn in the else branch naming the type and the migration.
     Warns, never throws — registration still succeeds. Verified: tsc 0, build 0.
     NOT exercised at runtime: needs the type disabled to trigger. -->
**File:** `vendor/app/api/auth/register/route.ts:265`

The `typeAck?.is_enabled` guard is correct — it is what stops a missing type
breaking registration. But it is also why **B3 went unnoticed until a human
noticed no email arrived.** A skipped notification currently produces no log line,
no warning, nothing.

**Fix approach:** one `console.warn` in the `else` branch naming the missing type.
Cheap, and it converts a silent no-op into something greppable in the server log.

```ts
if (typeAck?.is_enabled) { /* … existing insert … */ }
else console.warn("[vendor/register] vendor_registration_received is missing or disabled — the applicant will get no acknowledgement email")
```

⚠️ **Warn, do not throw.** Registration must still succeed — a notification is a
consequence of the submission, never a precondition of it. The whole block is
already `try`/`catch` for that reason (`:252`).

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains. There are none. -->

- **Slug matching** → **normalised on both sides** (resolved 2026-08-10) —
  lowercase, strip non-alphanumerics. Makes `ezzywell`, `ezzy-well`, `EzzyWell`
  and `ezzy_well` equivalent. One line, and it means the example link in the
  request actually works.
- **Does the parameter open the register view?** → **yes, deep-link to
  registration** (resolved 2026-08-10) — otherwise the preselect is invisible until
  the visitor independently clicks "Register Your Business", which makes a campaign
  link close to useless. Slightly beyond the literal request, chosen knowingly.
- **Draft vs parameter** → **parameter wins, division only** (resolved 2026-08-10)
  — an explicit current link beats a stale abandoned draft, but every other saved
  field is preserved.
- **Unknown or empty slug** → **silently fall back to today's behaviour** (decided
  from the request itself: *"If there is no parameter, the default behavior should
  be as what it is now"*). No error, no toast. An unmatched slug is
  indistinguishable from no parameter.

---

## Appendix A — approval gate: the notification-type migration (B3)

**Do not write this file until approved. Do not apply it — the user runs
migrations.**

`notifications.type` is FK-constrained to `notification_type_settings`
(`20260525000002_notifications.sql:23`), so no vendor-facing notification can exist
until these rows do.

```sql
-- backbone/supabase/migrations/20260808000001_vendor_lifecycle_notification_types.sql
--
-- Vendor-facing lifecycle notification types.
--
-- WHY: the register route already writes a `vendor_registration_received` row
-- (vendor/app/api/auth/register/route.ts), but guards it on this type existing.
-- Without these rows the guard is false, no row is written, and the applicant
-- receives nothing while Command admins receive their two — the exact symptom
-- reported on 2026-08-10.
--
-- kyc_approved / kyc_rejected are seeded here too so the review-notification work
-- needs no second migration and no second approval gate.
insert into public.notification_type_settings (type, label, description) values
  ('vendor_registration_received', 'Registration Received',
   'Sent to the applying vendor when their registration and KYC packet is received.'),
  ('kyc_approved',                 'KYC Approved',
   'Sent to the vendor when Command approves their KYC packet.'),
  ('kyc_rejected',                 'KYC Rejected',
   'Sent to the vendor when Command rejects their KYC packet, with the review notes.')
on conflict (type) do nothing;
```

⚠️ **`label` is `text not null` with no default** (`20260525000001:22`). An earlier
draft of this migration omitted it and would have failed outright — the column
order is `(type, label, description, is_enabled)`. `is_enabled` is left out
deliberately: it defaults to `true`, matching that table's "all types enabled by
default" contract.

**Blast radius:**

| Dimension | Assessment |
|---|---|
| **Data** | Three inserts into a 12-row lookup table. Rewrites nothing, validates nothing existing. `on conflict do nothing` makes it re-runnable |
| **Lock / performance** | Row-level insert on a tiny table. Negligible — no scan, no rewrite |
| **Downstream** | The Edge Function's `NotificationType` union must gain all three **and the function must be redeployed**. Command's notification panel filters may want them too |
| **Reversibility** | `delete from public.notification_type_settings where type in (…)` — safe **only** while no `notifications` row references them, because of the FK. After go-live, disable with `is_enabled = false` instead |

**Apply with** `cd backbone && npx supabase migration up --local` (keeps existing
data), then `npx supabase functions deploy send-notification-email`.
**Never `db reset`** — `architecture/database-reset-and-deploy.md:19` marks that
❌ never on production, and locally it would wipe the test data.

---

## Security / risk surface

Small, but worth stating rather than assuming:

- **The parameter cannot inject an arbitrary division.** It is matched against the
  *already-fetched list of active divisions* and resolved to that row's id, so it
  can only ever produce a valid, active id. A hostile value matches nothing.
- **The server still validates independently.** `register/route.ts` re-checks the
  division is real and `is_active` before creating anything. This change does not
  weaken that, and must not be treated as a reason to relax it.
- **No new data is exposed.** `slug` is already public information — the divisions
  route is unauthenticated by design and already returns `name`.
- **Nothing is persisted from the URL** beyond the resolved id, which is a value
  the user could have picked from the dropdown anyway.

---

## DEFERRED / COSMETIC

- **No `?step=` or other deep-link parameters.** Only `division` was asked for and
  a general prefill mechanism would be speculative.
- **No attribution/analytics on the link.** Knowing which campaign produced a
  signup is a reasonable future want, but needs its own decisions about what gets
  stored and where.
- **The parameter is not reflected back or cleaned from the URL.** It stays in the
  address bar after the view switches. Harmless, and stripping it would mean
  introducing router navigation this app otherwise has none of.
- **`command` and `booker` get nothing.** Neither has a division picker.

---

## Execution order

**Two independent stages.** They share no files and can ship in either order — but
B3 is the one with a live user-facing lie attached, so it goes first.

**Stage 1 — the applicant email (B3, I3)**
1. **Appendix A** → approval gate → recreate the migration file. **👤 The user
   applies it**, then redeploys the Edge Function.
2. Restore the three entries in the Edge Function's `NotificationType` union.
3. **I3** — the `console.warn`, so the next silent skip is greppable.
4. ⚠️ **Do not touch `register/route.ts`'s insert.** It is already correct.

**Stage 2 — the division deep-link (B1, B2, I1, I2)**
5. **B1** — get `slug` onto the client. Nothing can match without it.
6. **I1** — `lib/slug.ts` + its test. Writing the rule before the caller keeps the
   matching honest rather than shaped around whatever the effect happens to do.
7. **B2** — wire it into the divisions effect.
8. **I2** — only if it is genuinely a few lines; otherwise record it as skipped.
9. Regenerate visual baselines **only if** the register-view snapshots actually
   move. They should **not**: the gallery renders `LoginPage` with no query string,
   so the preselect never fires there. **If a baseline does change, stop and find
   out why** — it would mean the effect is running when it should not.

⚠️ **Stage 1 cannot be fully verified without the user.** Steps 1's apply and
redeploy are theirs; until both happen, B3 stays 🔄, not ✅ — the code being
written is not the same as the email arriving.

---

## Verification

| Item | How | Kind |
|---|---|---|
| B1 | `curl /api/divisions` returns `slug` on every row; `tsc` 0 | machine-verifiable |
| I1 | `npm test` — the new cases pass, and the existing 39 still do | machine-verifiable |
| B2 | Load `/?division=ezzy-well` → lands on register step 1 with **EzzyWell** shown in the dropdown | browser |
| B2 | Load `/?division=ezzywell` (the un-hyphenated form) → same result. This is the case D1 exists for | browser |
| B2 | Load `/?division=nonsense` and `/` with no parameter → login view, empty division, unchanged | browser |
| B2 | With a saved draft holding a *different* division, load `?division=ezzy-well` → division is EzzyWell **and** the draft's address/phone are still populated. This is D3, and the part most likely to be got wrong | browser |
| B2 | Submit a registration started from a link and confirm the vendor row carries the right `division_id` | browser + DB |
| B3 | After the migration is applied: `select type from notification_type_settings where type = 'vendor_registration_received'` returns a row | machine-verifiable (DB) |
| B3 | Register a fresh vendor, then assert a `notifications` row exists with `portal = 'vendor'` and that `user_id` — **the row is the thing this item fixes**; the email is downstream of it | machine-verifiable (DB) |
| B3 | **The actual symptom:** the applicant's address receives the acknowledgement in Resend/Mailpit, alongside the two admin mails | **needs live environment** |
| B3 | Copy at `LoginPage.tsx:482` is true again — either the email arrives, or the sentence changed. **Check both, not one** | browser + inbox |
| I3 | Temporarily disable the type (`is_enabled = false`), register, and confirm the warning appears **and registration still succeeds** | machine-verifiable (server log) |
| all | `tsc` 0, `npm run build` 0, Playwright **61/61 unchanged** | machine-verifiable |

**Baseline:** `tsc` 0, `npm test` 39/39, Playwright 61/61 — green as of the brand
rollout completing on 2026-08-10.
