# Booker visual suite — overlay fixed, 29 genuine diffs remain

**Date:** 2026-08-26
**App / scope:** `booker/` only
**Status:** 🔄 **IN PROGRESS — paused deliberately at a clean checkpoint.**
Infrastructure fixes are done and verified; the 29 remaining failures are real UI
drift and have **not** been touched. Picked up when the user returns to booker.

> Sibling to `.plans/2026-08-25-vendor-visual-baseline-instability.md`, which fixed the
> same class of problem in `vendor`. Read that one first — the diagnoses transfer, and
> its corrections (especially the missing-baseline mechanics) are not repeated here.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.

---

## Measured state

| Point | Result |
|---|---|
| Before any change | **55 failed / 6 passed** — i.e. *every* screenshot test; the 6 passes are the non-screenshot specs (`csp`, `seo`) |
| After the overlay fix | **29 failed / 32 passed** |
| Remaining | 29, all genuine UI drift |

The 26 tests that went green did so with **no baseline change** — proof they were pure
dev-overlay artifacts, not drift.

---

## ✅ DONE — infrastructure (2026-08-26)

### A1 — Next dev overlay was failing all 55  ✅ DONE
**Root cause, measured:** every diff was a small artifact in the bottom-**left** corner
— `<nextjs-portal>`. Booker's specs already mask the version badge at bottom-**right**
(`div.fixed.bottom-4.right-4.z-50`), so that corner was covered and this one never was.
Pixel counts repeated exactly across unrelated screens (46 dark / 1019 light on
`bookingconfirm`, `bookingstepper`, `card`), all ratio 0.01, all diffs, zero timeouts —
the signature of one shared element.

**Fix (ported from vendor):** new `booker/playwright-screenshot.css` hiding
`nextjs-portal`; `stylePath` wired into `expect.toHaveScreenshot`; `PW_TEST=1` added to
the `webServer` command; `devIndicators: false` under `PW_TEST` in `next.config.ts`.
**Verified:** 55 → 29 failures, tsc 0.

### A2 — Baselines were gitignored  ✅ DONE
`.gitignore`'s two PNG rules removed, same as vendor (D2). 55 baselines are now
trackable and were staged by the user. Comment rewritten with the corrected
missing-baseline mechanics.

### A3 — No test scripts at all  ✅ DONE
`booker/package.json` had only `dev`/`build`/`start`/`lint`. Added `test:visual` and
`test:visual:update`, matching vendor.

### A4 — 5s stability budget  ✅ DONE
`expect.timeout: 15_000` added pre-emptively. Booker has 4 `backdrop-blur` components
including `components/ui/dialog.tsx` — the shared overlay behind every modal — so it
carries vendor's B3 fragility. Not yet observed here (no timeouts in the last run), so
this is prevention, not a fix for something measured.

### A5 — B1 did **not** apply  ✅ verified, no change needed
Both `toHaveScreenshot` call sites already mask the version badge. Unlike vendor, no
call site had drifted.

---

## 🔄 REMAINING — the 29 genuine diffs

**⚠️ Deliberately NOT re-baselined.** Vendor's lesson: read the diff images first.
Larger pixel counts were visible under the overlay noise (`error-light` 3936 vs
`card-light` 1019), which is what a real change looks like.

The failures cluster, which suggests a small number of shared causes rather than 29:

| Cluster | Tests | Hypothesis |
|---|---|---|
| `login*` — `login`, `loginforgot`, `loginreset`, `loginsent`, `loginregister`, `login-mobile-info` | 11 | **Very likely the same legal-footer change as vendor** (2026-08-19 legalities work added a row of legal links, growing a vertically-centred card so everything shifts ~53px) |
| Chrome — `sidebar`, `topbar-dark`, `notif`, `statuswidget`, `settings` | 7 | Shared layout/chrome change; unknown |
| Booking flow — `step1`, `step2-dark`, `step3`, `step6`, `bookingdetail` | 11 | Unknown |

**Next steps, in order:**
1. Read one diff per cluster before anything else — three images, not 29.
2. Confirm each cluster's diff is confined to an explainable, intended change.
3. Re-baseline **per cluster**, with `--list` first to confirm scope, exactly as vendor's
   B2 did. Never a blanket `--update-snapshots`.
4. Re-run the full suite unpiped and read the summary line.

⚠️ **Do not `--update-snapshots` across the whole suite.** It would silently absorb any
unintended regression hiding among the intended ones — the single most damaging move
available here.

---

## Verification

- **Machine-verified:** tsc 0; `npm run test:visual` 55→29 failures; the 26 newly-green
  tests passed against **unchanged** baselines, which is what proves A1's diagnosis.
- **Not yet done:** the 29 diffs have not been read, and nothing has been re-baselined.
- **Not verifiable here:** whether booker's baselines reproduce on any machine other
  than this one — they are `*-chromium-linux.png` and platform-locked.
