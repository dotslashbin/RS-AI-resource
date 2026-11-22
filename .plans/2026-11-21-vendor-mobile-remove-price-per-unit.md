# Vendor mobile — remove the unused `pricePerUnit()` helper

**Date:** 2026-11-21
**App / scope:** `ezzy-vendor-mobile/` only — `src/lib/duration.ts` (lines 64–67). Follow-up to `2026-11-21-vendor-offering-price-label.md` (its O3, moved here on 2026-11-21).
**Status:** DRAFT — release: none decided (see D2)

> Delete a dead helper in the vendor mobile app that still says "per {unit}", so nobody picks it up later and reintroduces the bug the web fix removed. No user-visible change.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** I# = Important, F# = Finding, D# = Decision, O# = Optional. Numbers are plan-local; cross-plan refs qualified by plan (e.g. "2026-11-21 O3").

---

## ▶ RESUME HERE (updated 2026-11-21, plan written)
- **Done so far:** investigation only. No code changed.
- **Live where:** local ⬜ · staging ⬜ · production ⬜ (mobile has no staging/production release as defined in §12 yet, see D2)
- **Next:** D1 and D2 need your answers, then I1 (one-line removal and a grep check).
- **Watch out for:** the `ezzy-vendor-mobile` folder is its own git repository (commit inside it). Its `src/lib/duration.ts` header says it is a deliberate copy of `vendor/lib/duration.ts` and must be kept in step with it, so the same comment appears in both.

---

## Scope

**In:** deleting `pricePerUnit()` from `ezzy-vendor-mobile/src/lib/duration.ts`, and checking that nothing else in the mobile app depends on it.

**Out:** any change to vendor web (already done in the parent plan), booker mobile, the mobile kiosk's price display, and any new helper. The kiosk price string is already correct (see F1), so no replacement is needed here.

---

## Findings

### F1 — The mobile kiosk price label is already correct  ✅ verified 2026-11-21
`src/components/kiosk/KioskCatalogue/useKioskCatalogue.ts:98` builds `` `${fmtPeso(o.price)} / ${formatDuration(o.durationMinutes, o.durationUnit)}` ``, which reads "₱29,999 / 4 hours". It does not use `pricePerUnit`, so the bug never reached the mobile screens. The parent plan's I5 check did not cover mobile.

### F2 — `pricePerUnit()` has no callers  ✅ verified 2026-11-21
`grep -rn pricePerUnit src app` returns only its own definition at `src/lib/duration.ts:65`. The file's `formatDuration` is used by `useKioskCatalogue.ts` and `src/services/kiosk.service.ts`; neither uses `pricePerUnit`.

### F3 — The mobile copy has no test for the helpers it keeps  ✅ verified 2026-11-21
`src/lib/` has `format.test.ts` but no `duration.test.ts`, so deleting the function removes nothing under test. Test command: `npm test` runs `src/**/*.test.ts` with `node --experimental-strip-types`.

---

## IMPORTANT

### I1 — Delete `pricePerUnit()` and its doc comment  ⬜ TODO
**File:** `ezzy-vendor-mobile/src/lib/duration.ts:64-67` (the `/** The per-unit price suffix … */` comment and the function).
**Fix approach:** delete those four lines. Leave `formatDuration`, `durationQty` and the rest of the file untouched. Also check the header comment of `duration.ts` for any mention of `pricePerUnit` and keep it accurate.
**Component rules:** no component changes. The file is a pure lib module, not a component.

---

## OPTIONAL

### O1 — Mirror the web plan's per-block wording in the mobile header comment  ⬜ TODO (only if D1 = yes)
Keep the two `duration.ts` copies saying the same thing about the price being per block. Pure comment change.

---

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains — see §7. -->

- OPEN: **D1 — Include O1 (comment mirror)?** Options: (a) yes, keep the header comment in step with web; (b) no, delete only the function. Recommendation: **(b)**, because the change is one deletion and the comment already says the copies must match, which is still true.
- OPEN: **D2 — How does this ship?** The mobile app has no release path written into this workspace's plans yet. Options: (a) bundle it into the next vendor mobile release, which the user runs; (b) its own short release using the mobile release process, defined in a separate plan. Recommendation: **(a)**, because the change is dead code, so nothing needs to ship sooner.

---

## Execution order

1. Resolve D1 and D2 with the user.
2. **I1:** delete the function. Verify with a grep (below) and `npm run lint` and `npm test` in `ezzy-vendor-mobile/`.
3. Commit inside `ezzy-vendor-mobile/` (the user commits; draft via `commit-drafting`).
4. Release per D2.

---

## Release (§12)

Mobile does not follow the web Vercel path, so the staging/production stages in §12 do not apply as written. Per D2 the release is the user's; no staging or production stage is defined here until D2 is answered.

---

## Verification

**Machine (`ezzy-vendor-mobile/`):**
- `grep -rn "pricePerUnit" src app` returns nothing after I1.
- `npx tsc --noEmit` passes (run it; the mobile app's toolchain may differ, so confirm the command in its `package.json` first).
- `npm test` passes, with the same count as before I1 (no test references `pricePerUnit`).
- `npm run lint` passes, with the same result as before I1.

**Needs a live environment:** none. Nothing user-visible changes, so there is no device check unless D2 bundles this into a release that is checked anyway.

---

## Docs
**Docs:** none needed — no architecture document mentions `pricePerUnit`; the parent plan's docs were already updated (see `2026-11-21-vendor-offering-price-label.md`).
