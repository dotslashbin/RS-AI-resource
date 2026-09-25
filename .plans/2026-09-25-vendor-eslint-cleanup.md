# Vendor — clear the pre-existing ESLint errors and warnings

**Date:** 2026-09-25
**App / scope:** `vendor/` only. The 20 files with findings, all listed below. No schema, dependency or other-app change.
**Status:** DRAFT — decisions D1 and D2 resolved 2026-09-25; awaiting your approval to execute (S1 first).

> Get `npm --prefix vendor run lint` to **0 errors and 0 warnings** without changing behaviour. Most
> errors are `react-hooks/set-state-in-effect`. Fixing one changes *when* state is set, so every hook
> gets a behaviour check, not just a clean lint run.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** S# = stage, L# = lint item. Numbers are plan-local. Origin: `vendor-launch-followups`
> F21 (`.plans/2026-08-25-vendor-launch-followups.md`), itself K4 of
> `.plans/2026-09-25-vendor-password-recovery-cross-browser-fix.md`.

---

## Baseline (re-run 2026-09-25)

`npx eslint .` in `vendor/`: **28 errors and 3 warnings, in 20 files**.

| Rule | Count | Where |
|---|---|---|
| `react-hooks/set-state-in-effect` | 16 | 11 hooks (L7–L20) |
| `@typescript-eslint/no-explicit-any` | 6 | `vendor-access.service.ts` ×5, `PackagesPage.tsx` ×1 |
| `react/no-unescaped-entities` | 2 | `InstallPrompt.tsx:40` |
| `@typescript-eslint/ban-ts-comment` | 1 | `PackagesPage.tsx:1` |
| `react-hooks/purity` | 1 | `useBookingActions.ts:90` |
| `react-hooks/static-components` | 1 | `app/ui-gallery/page.tsx:1195` |
| `@next/next/no-html-link-for-pages` | 1 | `app/not-found.tsx:12` |
| warnings: `no-unused-vars` ×2, `exhaustive-deps` ×1 | 3 | `AppShell.tsx:125`, `offerings.service.ts:2`, `useAppShell.ts:480` |

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

## Stage S1 — Mechanical, no behaviour change  ⬜ TODO

- **L1** — `components/layout/AppShell/AppShell.tsx:125`: `setBookings` destructured but unused →
  remove it from the destructure (`useAppShell` still returns it).
- **L2** — `services/offerings.service.ts:2`: unused `OfferingStatus` import → remove.
- **L3** — `components/layout/InstallPrompt/InstallPrompt.tsx:40`: raw `"` ×2 → `&quot;`. Same glyph,
  so no visual change (the curly `&ldquo;` would change pixels).
- **L4** — `app/not-found.tsx:12`: `<a href="/">` → `next/link` `<Link href="/">`, keeping `className`
  and `style`. The only behaviour change is client-side navigation instead of a full reload, which is
  what Next recommends. Live-check the 404 link.
- **L5** — `useAppShell.ts:480` `exhaustive-deps`: the effect is keyed on `currentUser?.id` on purpose
  (no re-subscribing on object identity) but reads `currentUser.id` inside. → `const userId =
  currentUser?.id` above the effect, use `userId` inside, deps `[userId]`. Identical behaviour.
- **L6** — `services/vendor-access.service.ts:64-82`: 5 × `as any` on PostgREST embeds.
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

## Stage S2 — Page hooks: loading flags and prop sync  ⬜ TODO

- **L7** — `components/kyc/KycStatusPage/useKycStatusPage.ts:36`: `setLoading(true)` before
  `getMyKyc` → **P2**, keyed on `vendorId`.
- **L8** — `components/offerings/OfferingsPage/useOfferingsPage.ts:77`: same shape → **P2** on
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

## Stage S3 — Harder hooks and the gallery  ⬜ TODO

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
- **L22** — `app/ui-gallery/page.tsx:1195` `static-components`: `function Body()` is declared inside
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

## Stage S4 — `useAppShell` (auth shell)  ⬜ TODO — highest risk, last

- **L23** — `components/layout/AppShell/useAppShell.ts:205`: `setSideOpen(true)` when
  `innerWidth >= 1024`, at the top of the auth-gate effect → **P1**: `useState(() => window.innerWidth
  >= 1024)`. Safe because AppShell renders nothing until the auth check. The rest of that effect (the
  access gate and the recovery skip) is **not touched**.
- **L24** — `:333`: resets staff/schedules/bookings/status when `selectedVendorId` clears → **P3** on
  `selectedVendorId`. The setters stay exported (pages mutate these lists), so P2 does not fit.
- **L25** — `:440`: `setNotifLoading(true)` before the fetch → **P2** keyed on the user id from L5.

**Verification:** eslint (whole app now: **0/0**), `tsc`, `npm test`, full visual suite. Live, headless:
- Sign in with a single-vendor account: the dashboard shows and the sidebar is open at ≥1024 px,
  closed below.
- Sign out: back at login, and lists are empty on the next sign-in.
- Recovery flow: re-run the recovery plan's B1-b/B1-c harness. The recovery gate is in this file and
  must be untouched.
- Notifications load on sign-in.
- Suspended account (`rico@bookdeck.com`): refused with the right message.

---

## Decisions

<!-- No item in this plan may execute while any OPEN: line below remains. None remain as of 2026-09-25. -->
- **D1 — Targeted disables (P4).** → **(a) targeted `eslint-disable-next-line` with a written reason, only on the listed lines** (resolved 2026-09-25 by you). L18, L19 and L20 (and L16 as a fallback) are real
  external-resource syncs, and the lint rule's suggested rewrites break them (StrictMode, side effect in
  render).
  - **(a) Recommended.** Allow `eslint-disable-next-line react-hooks/set-state-in-effect -- <reason>`
    on exactly those lines, each with a reason.
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
