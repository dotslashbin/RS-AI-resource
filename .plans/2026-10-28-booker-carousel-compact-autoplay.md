# Booker Home — compact carousel controls and autoplay

**Date:** 2026-10-28
**App / scope:** `booker/` web only — `components/home/PromoCarousel/*`, `lib/promoSlides.ts` + `.json` + test, `app/page.tsx`, `components/home/HomePage/HomePage.tsx`, `app/ui-gallery/page.tsx`, `visual-tests/promo.spec.ts`, `booker/AGENTS.md`. **Out of scope:** vendor, command, `ezzy-booker-mobile`, banner artwork, any schema/Supabase change.
**Status:** IN PROGRESS — build stages 1–4 ✅ — release: staging ⬜ · production ⬜ (production checks ⏸ by user decision D5)

> A cosmetic patch: the carousel's control row takes too much page height, so swap it for a
> smaller treatment, and make the carousel advance on its own (two seconds per slide, D4),
> with the interval set in `promoSlides.json`.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** I# = Important (build item), D# = Decision, F# = Finding (F7+ found during execution),
> S# / P# = staging / production release step. Numbers are plan-local — qualify cross-plan refs
> by plan (e.g. "banner-carousel I3").

---

## ▶ RESUME HERE (updated 2026-10-28, end of stage 4)
- **Done so far:** approved 2026-10-28 ("execute stage 1-4"). Stage 1: on `feature/carousel_patch`
  (user-made, D2 amended). Stage 2: JSON config. Stage 3: autoplay + slim-strip controls. Stage 4: docs + local gate.
- **Live where:** local only, uncommitted on `feature/carousel_patch` · staging unchanged · production unchanged.
- **Next:** the user commits (draft in the stage-4 report), then S1: deploy `feature/carousel_patch` to staging, then S2 checks.
- **Watch out for:** `promo.spec.ts` autoplay tests must step `page.clock` in 100ms steps (F7);
  the wrap jumps with `behavior: "instant"`, never `"auto"` (F8). Two sidebar baselines fail for an
  unrelated, pre-existing reason (F10) — do not mistake them for this change.

---

## FINDINGS (investigation, 2026-10-28)

### F1 — Today's controls cost 52px under every banner  ✅ recorded
`PromoCarousel.module.css:111–130`: a 44px row of two 44×44 round buttons with the dots between,
plus the `.carousel` 8px gap (`:14–19`). On a 390px phone the banner itself is ~206px tall, so the
controls add a quarter of its height again.

### F2 — The hook has no notion of time; `goTo` clamps, it never wraps  ✅ recorded
`usePromoCarousel.ts:66–83`. Autoplay needs "after the last, the first", which `goTo` refuses by
design (`:69`, `:72`). Manual ‹ › must keep stopping at the ends (`promo.spec.ts:63`), so wrapping
belongs to autoplay only.

### F3 — The scroll guard's 700ms release is close to a 1s interval  ✅ recorded
`usePromoCarousel.ts:75`. A smooth scroll of one slide plus a 700ms guard leaves ~300ms before the
next tick. Not a bug, but the autoplay test must assert the index *and* that no intermediate slide
is announced, and the tick must not fire while `pendingRef` is set.

### F4 — The JSON is read in four places, not one  ✅ recorded
`app/page.tsx:5,12` (the source), `app/ui-gallery/page.tsx:49,758` (`promolive`),
`lib/promoSlides.test.ts:59–61` (asserts it **is an array**), and `booker/AGENTS.md` "Promotions
carousel" step 3 (documents the array shape for whoever edits banners).

### F5 — A pause control is required once it moves on its own  ✅ recorded
Content that starts moving automatically and lasts more than five seconds needs a pause (WCAG
2.2.2). Three banners at 1s loop forever, so it applies. Every preview variant carries one.

### F6 — Booker's git state  ✅ recorded
`booker/` is on `feature/pre-release-prep`, working tree **clean**, at `ff7a01b` (tag `v0.29.5`) —
the **same commit as `develop`**, so the branch holds nothing of its own. git-flow is configured
(`feature/`, `hotfix/`, `release/`). `master` is at `e27569e` (0.29.4) and does **not** have
0.29.5's branding clean-up.

### F7 — A big `page.clock.runFor` fakes a swipe  ✅ fixed in the test (2026-10-28)
Found running stage 3. One `runFor(2000)` fires the tick **and** the 700ms scroll guard
(`usePromoCarousel.ts`, `pendingTimerRef`) in the same instant, before the browser has scrolled;
the next real scroll event then reads as a swipe and stops autoplay. Proven with a temporary log
(effect re-ran with `playing=false` right after tick 2). Real time cannot do this: a one-slide smooth
scroll measured ~450ms. Fix: `promo.spec.ts`'s `tick()` steps the clock 100ms at a time until the
slide changes. No app change.

### F8 — The wrap must jump, and `"auto"` is not a jump  ✅ fixed (2026-10-28)
A smooth rewind from the last slide to the first crosses every slide (11 on a 12-banner list) and can
outlast the 700ms guard. The wrap now scrolls with `behavior: "instant"`. ⚠️ `"auto"` defers to the
track's CSS `scroll-behavior: smooth`, so it still animated; the first attempt used it and failed.

### F9 — Pre-existing lint errors elsewhere in booker  ✅ recorded, not fixed
`npm run lint` reports 14 errors / 4 warnings, all in files this plan does not touch (`not-found.tsx`,
`useAppShell.ts`, `booker.service.ts`, …) plus `ui-gallery/page.tsx`'s existing `Body()` component
(`react-hooks/static-components`). The files this plan changed lint clean. Left alone (surgical-changes rule).

### F10 — Sidebar baselines stale since 0.29.5  ⬜ OPEN (for the user)
`pilot.spec.ts` `sidebar-light` / `sidebar-dark` fail (866 px, ratio 0.01). The diff is only the
brand name + descriptor: commit `6bdd9f1` ("Replace stale RS branding…") changed `Sidebar.tsx`
without regenerating these two baselines. Not touched by this plan. Fix when wanted:
`npx playwright test visual-tests/pilot.spec.ts --grep "sidebar" --update-snapshots`, eyeball, commit
with that branding work.

---

## IMPORTANT (build items)

### I0 — Switch booker to the proper branch  ✅ DONE (2026-10-28)
✅ The user had already created **`feature/carousel_patch`** from `develop` (`ff7a01b`, clean tree) before
execution; used as-is instead of creating a second branch. Verified: `git branch --show-current`,
`git log -1` = `ff7a01b`, `git status` clean before any edit.
**Where:** `booker/` git. Per D2: `git flow feature start carousel-compact-autoplay` → `feature/carousel-compact-autoplay` off `develop`. Working tree is clean (F6), so nothing needs stashing; re-check
`git status` first and stop if that has changed. Git commands are run by the user or with
`git-assist` approval; no commits by the agent (core rules).
**Check:** `git branch --show-current` names the D2 branch; `git log -1` = `ff7a01b` or a descendant.

### I1 — Compact controls  ✅ DONE (2026-10-28)
✅ `PromoCarousel.tsx` (stage wrapper; ‹ › and pause/play on the banner; dots/counter in `.strip`),
`PromoCarousel.module.css` (`.stage`, `.control`, `.face`, `.edge*`, `.toggle`, `.strip`; ‹ › hidden ≤640px).
Verified: `promo.spec.ts` 24/24 incl. new "44 × 44 targets on the banner; ≤16px under it" and
"arrows hidden at 320px"; 12 `promo*`/`homepromo*` baselines regenerated (scoped `--grep promo`) and
eyeballed (desktop dark, phone light, 12-slide counter).
**Files:** `PromoCarousel.tsx:109–144` (controls block), `PromoCarousel.module.css:110–180`.
Implement **variant B (slim strip)** per D1 from `.plans/previews/booker-carousel-compact/`. Keep: 44×44 hit
areas (visible face 30px), `aria-disabled` not `disabled` (`:139`), `aria-controls`, the dots →
counter switch above `MAX_DOTS` (the counter must fit the chosen layout at 320px), one slide = no
controls, reduced motion. On-art controls use a fixed dark scrim + white ink in both themes.
**Separation:** `.tsx` stays render-only (new pause button is markup bound to hook values);
state stays in `usePromoCarousel.ts`; all styling in the module CSS, no inline style.
**Check:** `promo.spec.ts` (updated), gallery `promo*` baselines regenerated and eyeballed in both
themes at 320/390/1280.

### I2 — `autoplaySeconds` in `promoSlides.json`  ✅ DONE (2026-10-28)
✅ `normalizePromoConfig` + `autoplayProblem` in `lib/promoSlides.ts`; JSON wrapped as
`{ "autoplaySeconds": 2, "slides": [...] }`; `page.tsx` → `HomePage` (`promoAutoplayMs?`, optional so
gallery Home fixtures stay still) → `PromoCarousel` (`autoplayMs?`). Gallery `promolive` reads
`.slides`; `promo.spec.ts` shipped-JSON test reads `.default.slides`. Verified: `npm test` 317/317
(3 new config tests; shipped-JSON test now also checks `autoplaySeconds`), `tsc` clean.
**Files:** `lib/promoSlides.json`, `lib/promoSlides.ts`, `lib/promoSlides.test.ts:59–61`,
`app/page.tsx:12`, `app/ui-gallery/page.tsx:758`, `HomePage.tsx:42,166`.
Root becomes an object: `{ "autoplaySeconds": 2, "slides": [ … ] }`. Add
`normalizePromoConfig(raw): { slides: PromoSlide[]; autoplayMs: number }` beside
`normalizePromoSlides` (which stays, unchanged, for the slide array). Rule per D4: a finite number ≥ 0; `0` = off; missing/invalid = off (and the shipped-JSON test fails). `page.tsx`
passes `autoplayMs` through `HomePage` to `PromoCarousel` as a prop — the carousel still never
imports the JSON (AGENTS.md rule; F9 of the banner-carousel plan).
**Check:** unit tests: valid config; `0` → off; missing/invalid → off; the shipped JSON drops
nothing **and** its interval is valid (the test names the reason, as it does for slides).

### I3 — Autoplay in `usePromoCarousel`  ✅ DONE (2026-10-28)
✅ `choice` state (`auto`/`playing`/`paused`) + reduced motion via `useSyncExternalStore`; interval
skips on hover (track only), focus (except the toggle), hidden tab, pending scroll; wrap jumps (F8);
manual ‹ › / ← → / swipe set `paused`; live region `off` while playing. New gallery mode `promoauto`
(2000ms, never baselined). Verified: 7 new autoplay cases in `promo.spec.ts` (advance + wrap + silent;
hover/focus hold; pause/play; Next / arrow key / swipe each stop it; reduced motion starts paused) —
24/24 pass. Needs staging: real-finger swipe and how 2s feels (S2).
**File:** `usePromoCarousel.ts`. New input `autoplayMs`. Behaviour:
- Off when `autoplayMs` is 0, fewer than 2 slides, or `prefers-reduced-motion: reduce`.
- Each tick advances one slide; after the last it goes to the first (autoplay-only wrap, F2).
  Skip a tick while a programmatic scroll is pending (F3).
- **Paused while** the pointer is over the carousel, focus is inside it, or the tab is hidden
  (`visibilitychange`); resumes when that ends.
- **Pause/play button** (`aria-pressed`, label "Pause promotions"/"Play promotions") — F5.
- A booker's own move (‹ ›, ← →, swipe) **stops autoplay until reload** (D3); the play button restarts it.
- Autoplay moves **do not** announce; the live region is `aria-live="off"` while rotating and
  `"polite"` otherwise (WAI carousel pattern). Manual moves announce as today.
- Timers cleared on unmount and when `autoplayMs`/`count` changes.
**Check:** new Playwright cases in `promo.spec.ts` (Playwright `page.clock` to advance time):
advances and wraps; hover/focus pause; pause button; a manual move stops it and play restarts it; reduced motion never
starts; no announcement on an autoplay tick. Gallery fixtures pass `autoplayMs={0}` so baselines
stay still.

### I4 — Docs + local gate  ✅ DONE (2026-10-28)
✅ `booker/AGENTS.md` "Promotions carousel": controls bullet, autoplay bullet (incl. the F7 test
trap), `normalizePromoConfig` data flow, new "Control zones" row in the banner spec, step 3's new
JSON shape + `autoplaySeconds`, step 4's check. Gate: `tsc` clean · `npm test` 317/317 · lint clean
on changed files (F9) · `npm run build` compiled · full `npx playwright test` **172 passed, 2 failed** —
both `sidebar-light/dark`, pre-existing and unrelated (F10).
`booker/AGENTS.md` → "Promotions carousel": new JSON shape, `autoplaySeconds` (what 0 means), the
pause rule, and the banner-spec safe zone: keep the top-right corner (pause) and, on desktop, the side edges (‹ ›) clear of text (preview F1).
**Check:** read-through; the step-3 example parses as the new shape.

---

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains — see §7. -->
- **D1 — compact style** → **B · slim strip** (resolved 2026-10-28, user): dots under the banner (~14px), ‹ › on the side edges on desktop only, pause in the top-right corner. Least artwork covered (preview F1).
- **D2 — branch** → **new feature branch from `develop`** (resolved 2026-10-28, user). Amended at execution: the user had already made `feature/carousel_patch` off `develop` (`ff7a01b`); that is the branch.
- **D3 — manual move** → **stops autoplay until reload** (resolved 2026-10-28, user); the play button restarts it.
- **D4 — interval** → **2 seconds** (`autoplaySeconds: 2`; resolved 2026-10-28, user, over the 1s first asked for — banners carry dates/venues). Missing/invalid → off and the unit test fails.
- **D5 — skip production verification** → **production checks ⏸ PARKED** (resolved 2026-10-28,
  user instruction): staging is the last verified environment; production gets the Promote only.

## DEFERRED / COSMETIC
- Real banner artwork may need re-laying for the new control position (preview F1) — content, not code.

## Execution order
1. **Stage 1 — I0** branch switch. Stop and report.
2. **Stage 2 — I2** JSON config + normaliser + tests (independent of the UI).
3. **Stage 3 — I3 + I1** autoplay and compact controls together (the pause button lives in both).
4. **Stage 4 — I4** docs; full local gate: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run test:visual`.
5. Staging release (S1–S3).
6. Production release (P1; P2 parked per D5) — last.

## Release (§12)
No migrations, Edge Functions, secrets or env vars — app deploy only.

### Staging (production untouched throughout)
| # | Who | Step | Check |
|---|---|---|---|
| S1 | 👤 | Commit on `feature/carousel_patch`, deploy it to staging (Vercel) | ⛔ build green |
| S2 | 👤 + 🤖 | Staging checks: Home at 390 and 1280, both themes — controls per D1, advances every 2s, wraps, hover/focus/pause stop it, swipe works on a phone | ⛔ all green |
| S3 | 👤 | Note the tested deployment's URL/ID for P1 | — |

⛔ **Staging fully green before anything touches production.**

### Production (last stage)
| # | Who | Step | Check |
|---|---|---|---|
| P1 | 👤 | Vercel **Promote** the exact staging deployment from S3 | ⛔ same deployment ID |
| P2 | — | Production checks | ⏸ PARKED (2026-10-28, D5: user chose to skip production verification). Unblock: user asks for it. |

## Verification
- I0: `git branch --show-current` — machine.
- I1, I3: `promo.spec.ts` + gallery baselines — machine; real-device swipe + feel of the interval — staging, human.
- I2: `npm test` — machine.
- I4: read-through — human.
- Whole: `tsc`, `lint`, `npm test`, `test:visual` — machine; S2 — staging.
