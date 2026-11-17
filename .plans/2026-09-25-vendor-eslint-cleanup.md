# Vendor — clear the pre-existing ESLint errors and warnings

**Date:** 2026-09-25
**App / scope:** `vendor/` only. The **19** files with findings, all listed below. No schema, dependency or other-app change.
**Status:** IN PROGRESS — approved by the user 2026-11-15 ("lets fix the linting problems"). S1–S4 ✅ (2026-11-15/16): **`npm run lint` 0 errors, 0 warnings** (29 → 17 → 11 → 3 → 0). Left: 👤 staging smoke test (install prompt on a real phone, printing Transactions).
**Baseline refreshed 2026-10-30** by I3 of `.plans/2026-10-29-vendor-followups-batch-1.md`: the 2026-09-25
measurement had drifted. Now **26 errors, 3 warnings, 19 files**. **L7 is struck — already fixed.**
Eight line references corrected; every other L item's `file:line` was re-checked and still holds.

> Get `npm --prefix vendor run lint` to **0 errors and 0 warnings** without changing behaviour. Most
> errors are `react-hooks/set-state-in-effect`. Fixing one changes *when* state is set, so every hook
> gets a behaviour check, not just a clean lint run.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** S# = stage, L# = lint item. Numbers are plan-local. Origin: `vendor-launch-followups`
> F21 (`.plans/2026-08-25-vendor-launch-followups.md`), itself K4 of
> `.plans/2026-09-25-vendor-password-recovery-cross-browser-fix.md`.

---

## ▶ RESUME HERE (updated 2026-11-16, all four stages done)
- **Done so far:** S1–S4 ✅. `npm run lint` in `vendor/` exits **0 (0 errors, 0 warnings)**. S2 is
  committed (`1b40bf0`); **S1, S3 and S4 are uncommitted** in `vendor/`, and S1 and S4 both edit
  `components/layout/AppShell/useAppShell.ts`.
- **Next (👤 the user):** commit, deploy to staging, then the plan's two staging checks: the install
  prompt on a real phone (L17) and printing the Transactions report (L16). Then close: Docs line,
  status COMPLETE, `python3 scripts/plans-index.py`.
- **Open findings for the user:** S4-F2 (a fresh sign-in never sets `currentUser`, so notifications
  and the sidebar email stay empty until a reload — pre-existing, worth its own fix), plus the
  reported-only S1-F3, S2-F2, S3-F2 to S3-F4 and S4-F3.

---

## Baseline (re-measured 2026-10-30 — supersedes the 2026-09-25 figures)

`npx eslint .` in `vendor/`, read from the summary line: **26 errors and 3 warnings, in 19 files**
(29 problems). The 2026-09-25 baseline was **28 errors, 3 warnings, 20 files** — it went **down**
by two errors and one file, because work elsewhere incidentally fixed them.

⚠️ **Re-run this before S1 starts.** It has already drifted once; a stage that checks itself against
a stale count reports green while meaning nothing. That is the whole reason this refresh exists.

| Rule | Count | Where |
|---|---|---|
| Rule | 2026-09-25 | **2026-10-30** | Where, as measured 2026-10-30 |
|---|---|---|---|
| `react-hooks/set-state-in-effect` | 16 | **15** | 12 hooks (L8–L20, L23–L25; **L7 is gone**) |
| `@typescript-eslint/no-explicit-any` | 6 | **5** | `vendor-access.service.ts` **×4** (`:92, :96, :101, :118`), `PackagesPage.tsx:5` ×1 |
| `react/no-unescaped-entities` | 2 | 2 | `InstallPrompt.tsx:40` (cols 85, 104) |
| `@typescript-eslint/ban-ts-comment` | 1 | 1 | `PackagesPage.tsx:1` |
| `react-hooks/purity` | 1 | 1 | `useBookingActions.ts:90` |
| `react-hooks/static-components` | 1 | 1 | `app/ui-gallery/page.tsx:`**`1286`** |
| `@next/next/no-html-link-for-pages` | 1 | 1 | `app/not-found.tsx:12` |
| warnings: `no-unused-vars` ×2, `exhaustive-deps` ×1 | 3 | 3 | `AppShell.tsx:125`, `offerings.service.ts:`**`5`**, `useAppShell.ts:`**`509`** |

**The eight corrections, and nothing else changed.** Every other L item's `file:line` was re-opened
on 2026-10-30 and still holds (L1 `AppShell.tsx:125` · L3
`InstallPrompt.tsx:40` · L4 `not-found.tsx:12` · L9 `useProfilePage.ts:15` · L10
`useAddressFields.ts:75` · L11 `useCombobox.ts:25` · L12 `useStaffForm.ts:27` · L13
`useBookingActions.ts:90` · L14 `useScheduleForm.ts:43` · L15/L16 `useTransactionsPage.ts:89, :237` ·
L17 `useInstallPrompt.ts:37` · L18 `useGuideModal.ts:72` · L19/L20 `useIdentityStep.ts:21, :28` ·
L21 `PackagesPage.tsx:1, :5`):

| Item | Was | Is now |
|---|---|---|
| **L5** | `useAppShell.ts:496` | `:509` |
| **L6** | `vendor-access.service.ts:86-104`, **5** × `as any` | **4** × — `:92, :96, :101, :118` |
| **L7** | `useKycStatusPage.ts:36` | ⚠️ **STRUCK — no finding in that file at all** |
| **L8** | `useOfferingsPage.ts:77` | `:76` |
| **L22** | `app/ui-gallery/page.tsx:1195` | `:1286` (the gallery grew) |
| **L23** | `useAppShell.ts:208` | `:219` |
| **L24** | `useAppShell.ts:349` | `:362` |
| **L25** | `useAppShell.ts:456` | `:469` |

⚠️ **L2 and I1 of the batch-1 plan touch the same file.** L2 removes an unused import from
`services/offerings.service.ts`; batch-1 **I1** rewrote that file's `23503` branch
(`:108`) and extracts a message chooser. Different lines, no conflict — but whichever lands second
**re-runs the linter rather than assuming the count**.

⚠️ **Unit and visual figures below are from 2026-09-25 and were NOT re-run on 2026-10-30** — only the
linter was. Treat them as the last known state, not as this baseline's evidence. Original note:
Unit tests pass 484/484 and the visual suite 187/187 at this baseline (both run 2026-09-25 during the
recovery plan). Correction to F21: its first summary left out the two `no-unescaped-entities`.

## Fix patterns (the only ones this plan uses)

The same patterns fixed K2 in `useLoginPage.ts`. Each item below names which one it uses.

- **P1 — Lazy initialiser.** Seed state from a browser API in `useState(() => …)` instead of a mount
  effect. Safe only where the component never renders on the server. AppShell renders `null` until the
  auth check finishes, so everything inside it qualifies. Each use states why it qualifies.
- **P2 — Derive from a keyed result.** Store the last answer *with the key it answers* (e.g.
  `{ vendorId, data }`) and derive `loading`/empty from `result?.key !== key`. The effect only sets state
  in its async callback.
- **P3 — Adjust during render.** Use React's "storing information from previous renders" pattern
  (`const [prev, setPrev] = useState(x); if (x !== prev) { setPrev(x); …reset }`) to reset state when a
  prop changes.
- **P4 — Targeted disable with a reason.** `// eslint-disable-next-line react-hooks/set-state-in-effect
  -- <why>`, only for effects that genuinely synchronise with an external resource *and* have no
  correct rewrite. Needs D1.

---

## Stage S1 — Mechanical, no behaviour change  ✅ DONE (2026-11-15)

> **Verified (machine, local):** `npx eslint .` 29 → **17 problems, 0 warnings**; none of the 12
> S1 findings remain and no new rule appeared. `npx tsc --noEmit` clean; `npm test` 583/583; full
> visual suite **219/219** with no baseline changed. **Live (local, headless, seed logins approved
> by the user 2026-11-15):** the 404 page returns 404 and "Back to portal" reaches `/` with **no
> document request** (client-side `next/link`); `jose@bookdeck.com` (active) lands on
> `?page=dashboard`; `rico@bookdeck.com` (suspended profile) gets "Your account has no vendor
> access. Contact support." and stays signed out across a reload. 6/6.
> Per item: L1 ✅ · L2 ✅ · L3 ✅ · L4 ✅ · L5 ✅ · L6 ✅ (see S1-F1) · L21 ✅ (file trashed, recoverable;
> AppShell's two commented lines removed; `lib/types.ts`'s commented `"packages"` left, as D2
> names only AppShell).

- **L1** — `components/layout/AppShell/AppShell.tsx:125`: `setBookings` destructured but unused →
  remove it from the destructure (`useAppShell` still returns it).
- **L2** — `services/offerings.service.ts:5` (**was `:2`; moved 2026-10-30** when batch-1 I1 added
  three imports above it — the warning itself is untouched and pre-existing): unused
  `OfferingStatus` import → remove. ⚠️ Confirm the line before editing; `npx eslint` names it.
- **L3** — `components/layout/InstallPrompt/InstallPrompt.tsx:40`: raw `"` ×2 → `&quot;`. Same glyph,
  so no visual change (the curly `&ldquo;` would change pixels).
- **L4** — `app/not-found.tsx:12`: `<a href="/">` → `next/link` `<Link href="/">`, keeping `className`
  and `style`. The only behaviour change is client-side navigation instead of a full reload, which is
  what Next recommends. Live-check the 404 link.
- **L5** — `useAppShell.ts:509` (was `:496`) `exhaustive-deps`: the effect is keyed on `currentUser?.id` on purpose
  (no re-subscribing on object identity) but reads `currentUser.id` inside. → `const userId =
  currentUser?.id` above the effect, use `userId` inside, deps `[userId]`. Identical behaviour.
- **L6** — `services/vendor-access.service.ts`: **4** × `as any` on PostgREST embeds, at `:92`, `:96`,
  `:101`, `:118` (was "5 × at `:86-104`" — one was fixed elsewhere between 2026-09-25 and 2026-10-30).
  - → one hand-written row type per select (repo convention: hand-written interfaces). Embeds may
    come back as an object or an array, so a small `name`-reader helper handles both instead of
    `any`.
  - ⚠️ **Security-adjacent:** this is the vendor access gate. The change must be **types only**, with
    the same comparisons, in the same order, returning the same reasons.
  - Verify by re-reading the diff line-by-line plus a live login for an active and a suspended seed
    account.
- **L21** (was F21's PackagesPage) — `components/packages/PackagesPage/PackagesPage.tsx:1,5`:
  `@ts-nocheck` + `any[]`. The file is **dead**: its only import is commented out
  (`AppShell.tsx:26,186`). → **D2**.

**Verification:** eslint on the touched files; `tsc`; `npm test`; full visual suite (unchanged
baselines); live: 404 link, and login as `jose@bookdeck.com` (active) and `rico@bookdeck.com`
(suspended) for L6.

## Stage S2 — Page hooks: loading flags and prop sync  ✅ DONE (2026-11-15)

> **Verified (machine, local):** `npx eslint .` 17 → **11 problems, 0 warnings**; the six S2 files
> lint clean and no new rule appeared. `tsc` clean; `npm test` 583/583; full visual suite
> **219/219**, no baseline changed. **Live (local, headless, `jose@bookdeck.com`, approved by the
> user 2026-11-15; read-only: forms opened and cancelled, and the vendor and staff rows' `updated_at`
> confirmed unchanged afterwards):** offerings load with no "No offerings found." at any point
> (a MutationObserver watched every frame); the profile loads; its saved address reverse-resolves
> to Laguna / Pila / Bulilan Sur (Pob.); picking Bay clears the barangay text and its list never
> contains Pila's barangay; editing Miguel Torres, then Elena Ramos, then Miguel again shows each
> one's name; the registration comboboxes restore Laguna / Pila / Bulilan Sur from a saved draft
> (the K2 check). 9/9.
> Per item: L8 ✅ (P2, `loadedFor`) · L9 ✅ (P2, profile stored with its vendor id) · L10 ✅ (P2,
> barangays stored with their city) · L11 ✅ (P3) · L12 ✅ (P3) · L13 ✅ (`useState(Date.now)`;
> machine-verified only, no live check listed for it, see S2-F2).

- ~~**L7**~~ — ✖ **STRUCK 2026-10-30, already fixed.** `npx eslint .` reports **no finding at all** in
  `components/kyc/KycStatusPage/useKycStatusPage.ts`. Do not go looking for it, and do not "fix" the
  file to match the description below. S2's count drops by one accordingly. Original text:
  <!-- -->`components/kyc/KycStatusPage/useKycStatusPage.ts:36`: `setLoading(true)` before
  `getMyKyc` → **P2**, keyed on `vendorId`.
- **L8** — `components/offerings/OfferingsPage/useOfferingsPage.ts:76` (was `:77`): same shape → **P2** on
  `vendorId`. The existing `creating`/`formSession` refs are untouched.
- **L9** — `components/profile/ProfilePage/useProfilePage.ts:15`: same shape → **P2** on `vendorId`.
- **L10** — `components/address/AddressFields/useAddressFields.ts:75`: `setBarangays([])` when
  `cityCode` clears → **P2**: store `{ cityCode, list }`; `barangays = loaded?.cityCode ===
  values.cityCode ? loaded.list : []`. Check: changing city never flashes the previous city's barangays.
- **L11** — `components/ui/Combobox/useCombobox.ts:25`: `setQuery(selectedLabel)` on external change
  → **P3** on `selectedLabel`. Used by the LoginPage registration, AddressFields and
  PayoutMethodFields. Check: a parent clear empties the text, and a late options load fills the saved
  label.
- **L12** — `components/staff/StaffFormModal/useStaffForm.ts:27`: 5 setters re-seed from `editInst`
  → **P3** on `editInst`.
- **L13** — `components/bookings/BookingActions/useBookingActions.ts:90` `react-hooks/purity`:
  `Date.now()` in render → `const [now] = useState(Date.now)` (**P1**-style; the lazy initialiser is the
  sanctioned place). The countdown is in **days**, so a value fixed at mount is fine for a session.

**Verification:** eslint, `tsc`, `npm test`, full visual suite. Live, headless, `jose@bookdeck.com`:
- KYC status, offerings and profile pages load with a spinner and then data, with no empty-state flash.
- The address picker cascades province → city → barangay, and a saved record reverse-resolves.
- Edit staff A, then staff B: the form shows B.
- Registration comboboxes still restore from the draft (the K2 check).

## Stage S3 — Harder hooks and the gallery  ✅ DONE (2026-11-16)

> **Verified (machine, local):** `npx eslint .` 11 → **3 problems, 0 warnings** (only S4 left);
> `tsc` clean; `npm test` 583/583; full visual suite **219/219**, no baseline changed (so L22's
> gallery change altered no screenshot). **Live (local, headless, `jose@bookdeck.com`, approved by
> the user 2026-11-16; read-only, and the edited schedule's `updated_at` confirmed unchanged):**
> Edit Schedule opens seeded ("Court Rental — Morning"); an edited title survives parent re-renders
> (two viewport resizes); New after Edit opens empty; two quick range changes show refreshing, then
> settle on the second ("from 01 Sept 2026"); the print view carries a "Generated" stamp; on an
> emulated iPhone (Safari) the install prompt shows, and after Dismiss stays hidden across a reload;
> in the gallery, replacing the ID photo gives a new object URL that loads; the guide's deferral
> path holds (see S3-F2). 11/11.
> Per item: L14 ✅ (P3, see S3-F1) · L15 ✅ (P2) · L16 ✅ (seed moved into the commit; the effect
> only subscribes, no P4 needed) · L17 ✅ (P1) · L18 ✅ (P4) · L19 ✅ (P4) · L20 ✅ (P4) · L22 ✅
> (`{body()}`; `Body` uses no hooks).

- **L14** — `components/schedule/ScheduleFormModal/useScheduleForm.ts:43`: the hydration effect sets 9
  fields from `editSched` and resolves the offering, with a `presetDone` latch → **P3** on
  `editSched`.
  - ⚠️ **Order matters.** The latch comment (`:35-38`) says a re-run must not overwrite a title the
    vendor has since edited. P3 fires only when `editSched` changes identity, which keeps that
    guarantee, but it must be shown.
  - Check: edit a schedule, change its title, then trigger a parent re-render: the title survives.
    Also add → edit → add again.
- **L15** — `components/transactions/TransactionsPage/useTransactionsPage.ts:89`: `setRefreshing(true)`
  at the start of a debounced request with a `reqSeq` guard → **P2**: store the committed
  `{ from, to }` and derive `refreshing = committed range !== requested range`. Keep the debounce and
  the seq guard exactly as they are.
- **L16** — same file, `:237`: seeds `printedAt` when loading ends and subscribes to `beforeprint` → the
  subscription is a genuine external sync. The seed can move to where the data commits (the `.then` at
  `:96`) so the effect only subscribes. If that proves awkward → **P4** (D1).
- **L17** — `components/layout/InstallPrompt/useInstallPrompt.ts:37`: mount effect reads
  `localStorage`, `matchMedia` and the UA → **P1** for `dismissed`, `installed` and `variant`. Safe:
  it renders inside AppShell after the auth check (`AppShell.tsx:253`), so there is no server render.
  The `beforeinstallprompt` listener stays in the effect.
- **L18** — `components/dashboard/GuideModal/useGuideModal.ts:72`: once `ready` flips, it reads/writes
  `localStorage` and opens. That write is a side effect, so it cannot move into render (P3). → **P4**
  (D1). The effect already has a one-shot latch and documented reasons.
- **L19/L20** — `components/kyc/IdentityStep/useIdentityStep.ts:21,28`: `URL.createObjectURL` +
  revoke on cleanup. The alternative (`useMemo` + a revoke effect) **breaks under dev StrictMode**:
  cleanup revokes a URL the memo still returns. → **P4** ×2 (D1).
- **L22** — `app/ui-gallery/page.tsx:1286` (was `:1195`) `static-components`: `function Body()` is declared inside
  the gallery component (`:461`) and rendered as `<Body />`, so it remounts every render. → lift
  `Body` to module scope with the values it closes over passed as props. If it uses no hooks, render
  it as `{body()}` instead.
  - The gallery is dev/CI-only, but it drives **every** visual baseline, so the full suite must pass
    unchanged.

**Verification:** eslint, `tsc`, `npm test`, full visual suite. Live:
- Transactions: change the range fast twice; only the last range shows, and the refreshing indicator
  clears.
- Print preview has a stamp.
- The Getting Started guide auto-opens exactly once for a fresh `localStorage`.
- KYC identity step: pick an ID photo, replace it, and the preview updates.
- The install prompt stays hidden when dismissed (headless can't install, so this is the dismissed
  path only).

## Stage S4 — `useAppShell` (auth shell)  ✅ DONE (2026-11-16)

> **Verified (machine, local):** `npx eslint .` 3 → **0 problems**; `npm run lint` exits 0; `tsc`
> clean; `npm test` 583/583; full visual suite **219/219**, no baseline changed. **Live (local,
> headless, `jose@bookdeck.com` + `rico@bookdeck.com` + a Mailpit recovery link, approved by the
> user 2026-11-16; read-only, and jose's password hash and notification states confirmed unchanged
> afterwards):** at 1280 px the sidebar starts open and at 800 px closed; after a session restore
> both notification requests return 200 and the panel lists jose's 7; sign-out returns to the login
> screen with no vendor data left; suspended rico is refused; a recovery link still reaches "Set a
> new password" (nothing submitted). 7/7.
> Per item: L23 ✅ (P1, guarded with `typeof window` because this hook runs during the server render
> — the plan's "safe because AppShell renders nothing" was true for the markup but not for the hook)
> · L24 ✅ (P3) · L25 ✅ (P2 on `userId`) · plus the recovery line, S4-F1.

- **L23** — `components/layout/AppShell/useAppShell.ts:219` (was `:208`): `setSideOpen(true)` when
  `innerWidth >= 1024`, at the top of the auth-gate effect → **P1**: `useState(() => window.innerWidth
  >= 1024)`. Safe because AppShell renders nothing until the auth check. The rest of that effect (the
  access gate and the recovery skip) is **not touched**.
- **L24** — `:362` (was `:349`): resets staff/schedules/bookings/status when `selectedVendorId` clears → **P3** on
  `selectedVendorId`. The setters stay exported (pages mutate these lists), so P2 does not fit.
- **L25** — `:472` (was `:469`, then `:456`; moved by L5, S1-F2): `setNotifLoading(true)` before the fetch → **P2** keyed on the user id from L5.

**Verification:** eslint (whole app now: **0/0**), `tsc`, `npm test`, full visual suite. Live, headless:
- Sign in with a single-vendor account: the dashboard shows and the sidebar is open at ≥1024 px,
  closed below.
- Sign out: back at login, and lists are empty on the next sign-in.
- Recovery flow: re-run the recovery plan's B1-b/B1-c harness. The recovery gate is in this file and
  must be untouched.
- Notifications load on sign-in.
- Suspended account (`rico@bookdeck.com`): refused with the right message.

---

## Findings

- **S1-F1 — L6 done as casts to named shapes, not the "name-reader helper".** (2026-11-15) The plan
  suggested a helper that reads `name` from an object *or* an array. That would change the gate: an
  array-shaped embed reads as `undefined` today (not granted), and the helper would grant it. The
  plan's own rule for L6 is "types only, same comparisons, same order", so each `as any` became
  `as unknown as Named` (or the existing `EmbeddedVendor`), the pattern `verifyVendorAdminFor` in the
  same file already uses. Casts are erased at compile time, so runtime logic is unchanged. ✅
- **S1-F2 — L25 moved to `useAppShell.ts:472`.** L5 added a 3-line comment and `const userId` above
  the notifications effect. S4's reference is corrected. ✅ plan text only.
- **S1-F3 — Next dev does one full reload the first time it compiles a route.** The first 404 → `/`
  live run lost the "no reload" marker; a re-run on a compiled route showed no document request at
  all. Dev-only, not caused by L4. Live checks of client-side navigation should warm the route
  first. ⬜ reported only.

- **S2-F1 — L9 and L10 also close a late-answer race, by construction.** (2026-11-15) Storing each
  result with its key (P2) means an answer for the previous vendor or city can no longer show
  under the current one. Before, `getVendorProfile` had no guard, and a just-changed city showed
  the old city's barangays until the new list arrived. This is the behaviour the plan's L10 check
  asks for, not a scope addition. ✅ (live-checked for L10).
- **S2-F2 — L13's countdown has no live check.** The value is now read once at mount instead of on
  every render; the countdown is in whole days, so the difference only shows if a page stays open
  across midnight. The plan lists no live check for L13; covered by `tsc`, lint and the visual
  suite. ⬜ reported only.

- **S3-F1 — L14's P3 is keyed on all three of the effect's inputs, not on `editSched` alone.**
  (2026-11-16) The seeding effect depended on `editSched`, `offerings` and `presetOfferingId`, and
  `useSchedulePage.ts` documents that it must re-run when `offerings` changes identity (that is how
  a preset offering gets selected once the array arrives). Keying on `editSched` alone would have
  dropped that, so the render-time comparison uses the same three values and runs exactly when the
  effect did. The `presetDone` latch became state, because refs cannot be read during render. ✅
- **S3-F2 — The Getting Started guide defers for any account with the completion modal open.**
  It decides once, when completion settles; if "Complete your account" is open then, it returns
  without spending the auto-open (by design, `useGuideModal.ts`). Every seed vendor checked (jose,
  marco) shows that modal, so the "opens once on a fresh browser" path could not be shown live; the
  deferral path was (11/11 run). L18's change is a comment-only disable line. ⬜ reported only.
- **S3-F3 — L15: going back to the applied range before a fetch lands now clears "refreshing" at
  once.** Before, it stayed on until the identical-range request committed. The table already shows
  that range, so this is more accurate, not a regression. ⬜ reported only.
- **S3-F4 — Dates render as "01 Sept 2026"**, not "Sep" (en-GB in current ICU data). Matters only to
  tests that match the text. ⬜ reported only.

- **S4-F1 — A fourth targeted disable, on the recovery skip.** (2026-11-16) Removing L23's
  `setSideOpen` exposed the next synchronous setState in the same effect: `if (isRecoveryDetected())
  { setIsCheckingAuth(false); return }`. The plan forbids changing the recovery skip, and rewriting
  it risks a server/client mismatch on the recovery screen. The user chose a targeted disable,
  extending D1 to this line (2026-11-16). ✅
- **S4-F2 — A fresh form sign-in never sets `currentUser`.** `setCurrentUser` is called only on the
  session-restore path (`useAppShell.ts`), not by `handleLoginSuccess`. So right after signing in,
  notifications do not load and the sidebar shows no email, until the next reload. **Pre-existing:**
  the same A/B against the committed `useAppShell.ts` (before S1/S4) made zero notification requests
  too. Out of this plan's scope (a behaviour fix, not lint). ⬜ reported only — worth its own item.
- **S4-F3 — A reload in the instant after sign-in can land on the login screen in dev.** Seen once
  with S4's code and once with the committed code (that run straight after a file swap, during a dev
  recompile); with a 2 s settle the current code restores every time. Not tied to S4. ⬜ reported
  only.
- **S4-F4 — L25 left a latent gap on logout; fixed.** (2026-11-16, found in the user's
  behaviour review) `handleLogout` cleared `notifications` but not the new `notifLoadedFor`, so a
  same-user sign-in in the same tab would have shown "You're all caught up" instead of a spinner
  until the load landed. Unreachable today (a fresh sign-in never sets `currentUser`, S4-F2), but
  it would surface once S4-F2 is fixed. One line added at the user's request:
  `setNotifLoadedFor(null)` in `handleLogout`, which restores the old spinner behaviour exactly.
  ✅ `tsc`, lint 0/0, `npm test` 583/583, S4 live re-run 7/7 (includes sign-out).
- **Behaviour review (2026-11-16, at the user's request).** Every changed line of S1–S4 was re-read.
  No change alters what data is shown, saved or allowed. Visible differences, all small: the 404
  link navigates in-app instead of reloading (L4); Transactions dimming clears at once when the range
  is set back before a fetch lands (S3-F3); the barangay list no longer flashes the previous city's
  (L10, S2-F1); the booking countdown uses the time the screen opened (L13, S2-F2). Everything else
  is identical or the same result one frame earlier (no momentary empty states).

## Decisions

<!-- No item in this plan may execute while any OPEN: line below remains. None remain as of 2026-09-25. -->
- **D1 — Targeted disables (P4).** → **(a) targeted `eslint-disable-next-line` with a written reason, only on the listed lines** (resolved 2026-09-25 by you). L18, L19 and L20 (and L16 as a fallback) are real
  external-resource syncs, and the lint rule's suggested rewrites break them (StrictMode, side effect in
  render).
  - **(a) Recommended.** Allow `eslint-disable-next-line react-hooks/set-state-in-effect -- <reason>`
    on exactly those lines, each with a reason.
  - **Extended 2026-11-16 by the user** to one more line: the recovery skip in `useAppShell.ts`
    (S4-F1).
  - (b) Force a rewrite anyway, e.g. a `useObjectUrl` hook built on `useSyncExternalStore`. That adds
    more code than it removes.
- **D2 — Dead `PackagesPage.tsx`** (L21). → **(a) move it to the trash, plus AppShell's commented import/case lines** (resolved 2026-09-25 by you). The page was deferred and nothing renders it.
  - **(a) Recommended.** Move it to the trash. Git keeps the history, and AppShell's commented
    import/case lines go with it.
  - (b) Keep it and type it properly (remove `@ts-nocheck`, add a local interface).
  - (c) Add it to the eslint ignores (hides the problem).

## Execution order

1. **S1** — independent and behaviour-neutral. Safe first.
2. **S2** → **S3** — each stage's live checks run before the next starts.
3. **S4** — last, alone. It depends on L5 (S1) for the user-id key.

One stage at a time (developerboss cadence). Each stage ends with the full visual suite, because
baselines are committed and the gallery (L22) feeds all of them.

## Out of scope

- Adding lint to any CI gate.
- Lint in other apps.
- Any refactor beyond the flagged lines.
- The price display in `PackagesPage.tsx:24` (moot if D2 = a).

## Verification summary

| Kind | What |
|---|---|
| Machine | eslint (touched files per stage; whole app 0/0 after S4), `tsc --noEmit`, `npm test`, full Playwright suite with unchanged baselines |
| Live (local, headless) | The per-stage checks above, run against the local stack with seed accounts; test data restored through the UI |
| Needs you | Staging smoke test after deploy: the install prompt on a real phone (L17) and printing the Transactions report (L16) |
