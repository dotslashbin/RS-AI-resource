# Booker — Poppins as the base font

**Date:** 2026-09-29
**App / scope:** `booker/` web only — the base (body) type family and everything that inherits it. `vendor/`, `command/`, `ezzy-booker-mobile/` and `ezzy-vendor-mobile/` are explicitly **out of scope** and unchanged by this plan.
**Status:** **COMPLETE — build scope, 2026-09-29.** Reopened briefly on 2026-09-29 at the user's request to fix **F6, F7 and F8**, all now ✅; booker's Poppins commit is `ae85bd1`, and the F6–F8 fixes are a **second, uncommitted** change (5 files). **F8's fix corrected a wrong diagnosis in this plan and found a real 320px overflow in three product shelves — see F8.** Approved 2026-09-29 with D1–D4 resolved; S1–S5 all ✅; every B and I item ✅. Machine-verified: `tsc` 0 · `npm test` **154/154** · `npm run build` 0 · `npm run lint` 18 (its pre-existing baseline) · `npm run test:visual` **77 passed, exit 0, twice consecutively** after re-recording 69 of 71 baselines.

⚠️ **"Complete" means built and measured, not seen.** Whether booker *looks* right in Poppins is **L0-a** in `.plans/2026-09-29-booker-live-verification.md`, amended by I5 to cover this change; it has not happened, and it is the user's. Also outstanding and the user's: the commit (7 source files + 69 PNGs).

**F6, F7 and F8 were reported and left open, then fixed on 2026-09-29 when the user asked for them.** Nothing else is outstanding in this plan. **Nothing here touches `vendor`, `command` or either Expo app**; the mobile Poppins work continues under its own plan.

> Put the brand face on booker's body text, from one place, without changing a single word of copy, any colour token, or any behaviour — and measure the three things a font swap silently breaks here: the peso sign, the amount columns, and 71 committed screenshots.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = decision, S# = execution stage. Numbers are plan-local — qualify cross-plan refs by app (e.g. "booker-redesign I34", "vendor-mobile B2").

---

## Baseline — what booker's type actually is today (read 2026-09-29)

- **There is no base font.** `booker/tailwind.config.ts:12` extends `colors` and `borderRadius` only — no `fontFamily`. Tailwind 3.4.19's preflight sets `html { font-family: theme('fontFamily.sans', …) }` (`node_modules/tailwindcss/src/css/preflight.css:36`), so the body renders in Tailwind's **default system stack**: `ui-sans-serif, system-ui, sans-serif, …`. Nothing in the app overrides it.
- **One webfont is already loaded, for headings only.** `app/layout.tsx:25-31` declares `Bricolage_Grotesque` (`subsets: ["latin"]`, `display: "swap"`, weights 600/700/800) as `--db-font-display`; `app/layout.tsx:95` puts the variable on `<html>`; `app/globals.css:475-476` applies it to `h1, h2` and nothing else. That is booker-redesign D22/I34, and its comment states the rule deliberately: *"Everything else — body, labels, controls, numbers in tables — stays on the system stack, so this is one font file, not two."* This plan changes that sentence, which is why D1 exists.
- **The cascade is already clean, so one declaration is enough.** All 36 `components/**/*.module.css` files reach the base family by inheritance; the 40-odd explicit `font-family` declarations in them are `font-family: inherit` on buttons and inputs (resetting the UA default), e.g. `components/home/HomePage.module.css:56`, `components/explore/ExplorePage/ExplorePage.module.css:31`. **No component names a family of its own.** A base-family change therefore propagates everywhere without touching a component file.
- **Exactly three places opt out of the base family**, and all three are deliberate: `components/payments/PaymentReceipt/PaymentReceipt.module.css:90` (`ui-monospace, SFMono-Regular, Menlo, monospace` for the payment reference), `components/dev/DevVersionBadge.tsx:5` (`font-mono`, dev-only badge), `app/ui-gallery/page.tsx:482` (inline `fontFamily: "monospace"`, test fixture only). → D3.
- **Weights in use:** CSS modules — 700 ×65, 600 ×48, 800 ×38, 500 ×3, 900 ×2. Tailwind classes — `font-bold` ×34, `font-semibold` ×28, `font-extrabold` ×13, `font-medium` ×9, `font-normal` ×3. The only 900s are `components/auth/LoginPage/LoginPage.module.css:37-38`. → D2.
- **Italic is used twice:** `components/explore/VendorPage/VendorPage.module.css:53` and `components/explore/VendorResultCard/VendorResultCard.module.css:53` (vendor tagline). Poppins ships true italics, so this is a loaded-face question, not a synthesis-only one. → D2.
- **Smallest type is 10px** (5 declarations) and **11px** (29), including `.db-badge` at `app/globals.css:434` (11px/600, `white-space: nowrap`). Poppins is a geometric sans with wider advances than `system-ui` at the same px. → B4.
- **CSP already permits it and already tests it.** `next.config.ts:149` sends `font-src 'self' data:`; `next/font` self-hosts to `/_next/static/media/`, and `visual-tests/csp.spec.ts:91-92` asserts at least one woff2 was actually fetched. No CSP change is needed, and that assertion keeps passing.
- **Poppins is SIL OFL 1.1** and is served through `next/font/google`, which downloads and self-hosts it at build time — no runtime request to Google, no new dependency, no `package.json` change, so **no approval gate for installing anything.**
- **71 committed screenshot baselines** live in `visual-tests/pilot.spec.ts-snapshots/`. Every one contains text. → B3.

### Cross-plan state that constrains this plan

- `.plans/2026-09-29-ezzy-vendor-mobile-poppins-typography.md` is **IN PROGRESS** and is the sibling of this plan on the mobile side (its B1 🔄, B2 ✅). Its I2 records that the Vendor **web** portal is deliberately excluded. Nothing in this plan changes that: this is booker web, that is vendor mobile, and they share only the choice of family.
- `.plans/2026-09-29-booker-mobile-parity-groundwork.md:280` holds the web↔RN contract row **"Font | the system stack; Inter's name dropped (N3, mobile D9) | web I16; mobile M1 ✅"**, and `:305` holds **"Display typeface | `next/font`, headings only | an Expo font asset gated on `useFonts` | ⚠️ This reverses mobile's D9"**. Making Poppins booker's base font puts the two clients **out of contract on the row that is currently marked agreed.** That is a documented decision this plan would contradict, so per plan-authoring §7 it is D4, not a silent edit.
- `.plans/2026-09-18-booker-home-search-redesign.md` is COMPLETE for build scope, and its **F64/F66** is the reason B3 below is worded the way it is: a global CSS change *passed* against stale baselines on 2026-09-29 because `threshold` was left at its 0.2 default. `playwright.config.ts:47-58` now pins `threshold: 0.02`.
- `.plans/2026-09-29-booker-live-verification.md` gates every staging/production check behind **L0**, the user's local acceptance pass, which has **not happened yet**. A base-font change lands before that pass, so L0 will be judging the redesign *and* Poppins together. → I5.
- `.plans/2026-08-26-booker-visual-baseline-remediation.md` reads IN PROGRESS but was overtaken: booker-redesign S7/I51 re-recorded all baselines on 2026-09-29. This plan works from the current committed set, not that plan's 29-diff snapshot.

---

## BLOCKERS

### B1 — Declare Poppins once, through the Tailwind theme, not as a stray CSS rule  ✅ DONE (2026-09-29)
**Files:** `booker/app/layout.tsx:25-31,95`; `booker/tailwind.config.ts:12`; reference only: `node_modules/tailwindcss/src/css/preflight.css:36`.

The base family is decided by `theme('fontFamily.sans')`, which booker never sets. Two wrong shapes are available and both must be avoided: adding `body { font-family: Poppins }` to `globals.css` leaves Tailwind's own `font-sans` utility and preflight still resolving to the system stack (two sources of truth, disagreeing); and adding the family to `<body>`'s className leaves `<html>` on the old stack, which is what `line-height` and `-webkit-text-size-adjust` inherit from.

**Fix approach:** In `app/layout.tsx`, declare `Poppins` from `next/font/google` beside the existing display constant — `subsets: ["latin"]`, `display: "swap"`, weights per D2, `variable: "--db-font-sans"`. Add it to the `<html>` className alongside `display.variable` (`layout.tsx:95`). Then in `tailwind.config.ts`, add to `theme.extend`:

```ts
fontFamily: {
  sans: ["var(--db-font-sans)", "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
},
```

One declaration; preflight's `html`, the `font-sans` utility, and all 40 `font-family: inherit` resets then resolve to the same place. Keep `display: "swap"` — it is what the existing display face uses, and `next/font/google` defaults `adjustFontFallback: true`, which synthesizes a metric-matched fallback so the swap does not reflow the page. Do **not** add `@font-face`, a `<link>` to `fonts.googleapis.com`, or a `fonts.gstatic.com` CSP token: `next/font` self-hosts at build time, which is the whole reason `font-src 'self'` suffices.

**Component separation:** no component is created or modified. `app/layout.tsx` stays a composition-only server component; the font object is a module-scope constant next to the one already there, and no `useState`, effect, handler or inline `style={{}}` is introduced. The family lives in the Tailwind theme and one CSS variable — not in a `.tsx`.

**Approval gate:** none. `next/font` ships with Next 16.2; `package.json` and `package-lock.json` are untouched. If any step in this plan appears to need `npm install`, stop — the approach is wrong.

**Verification:** machine — `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test` (154+ unit tests, none type-related but they are the regression floor); `npm run test:visual` for `csp.spec.ts`, which must still find a woff2 under `/_next/static/media/` and report zero `securitypolicyviolation`. Browser probe: `getComputedStyle(document.body).fontFamily` names the Poppins variable's resolved family, and `document.fonts.check("16px <family>", "Ab")` is true. Needs a human: whether it looks right — that is L0-a in the live-verification plan (I5).

**✅ Executed and verified (2026-09-29).** `app/layout.tsx` — `Bricolage_Grotesque` → `Poppins`, `variable: "--db-font-sans"`, const renamed `display` → `bodyFont`, and the comment block rewritten to say where the wiring actually lives. `tailwind.config.ts` — `theme.extend.fontFamily.sans` added ahead of `colors`. Machine-verified: `npx tsc --noEmit` exit 0; `npm test` **154/154 pass, 0 fail**; `npm run lint` **18 problems (13 errors, 5 warnings)** — its existing baseline, and `grep` confirms **none** of them is in a file this stage touched. Served-CSS assertion (after F4's restart): the preflight rule is `font-family: var(--db-font-sans), …`. Browser probe against `/ui-gallery?mode=payments`: `html`, `body`, `h1`, `h2` **and** `button` all resolve to `Poppins, "Poppins Fallback", ui-sans-serif, …`; `document.fonts.check("16px Poppins", "Ab")` → `true`. `npm run build` ✅ **run at the end of S4 — exit 0**, three times across the F9 iteration, with the dev server stopped first (they contend for `.next`). Final state re-verified after the last build: **`tsc` exit 0, `npm test` 154/154, `npm run lint` 18 problems (its baseline), `npm run test:visual` 77 passed twice with exit 0.**

### B2 — The peso sign is not in Google's `latin` subset  ✅ DONE (2026-09-29) — **premise corrected**
**Files:** `booker/lib/utils.ts:88-93`; `booker/components/booking/steps/StepPayment/StepPayment.tsx:27`; `booker/components/payments/PaymentMonthGroup/PaymentMonthGroup.module.css:56`.

`fmtPeso()` at `lib/utils.ts:93` returns `` `₱ ${…}` `` — U+20B1 — and it is the single source of every money string in the app. Google Fonts' `latin` subset unicode-range includes U+20AC (€) and U+2122 (™) but **not U+20B1**. With `subsets: ["latin"]` the peso sign is therefore served by no Poppins file, and the browser falls back **per character**: every amount would render its symbol in the fallback face and its digits in Poppins. Nothing shows this today because the entire app is already on the system stack — this risk is *created* by B1, which is why it is a blocker and not a note.

**Fix approach:** Measure before deciding anything. With the B1 change in place, probe in the browser: `document.fonts.check("16px <family>", "₱")` and, independently, compare `ctx.measureText("₱")` under Poppins versus the fallback, since `check()` answers about the loaded faces and not about per-glyph coverage in the file that was actually downloaded. Then:
- If the glyph is present and used — nothing to do; record the measurement.
- If it is absent — **accept the fallback symbol and record the decision.** A currency sign drawn from the fallback stack beside Poppins digits is a far smaller defect than the alternatives, and the two alternatives are both worse than the problem: hand-rolling a `unicode-range` `@font-face` re-introduces the second source of truth B1 exists to remove, and swapping `fmtPeso` to `PHP`/`₱`-free output is a copy change this plan has no mandate for.
- Do **not** add the `devanagari` subset speculatively to chase the glyph; check whether it even carries U+20B1 before spending the bytes.

**Verification:** machine — a one-off Playwright probe against `/ui-gallery`, kept in the plan record rather than committed as a test. Needs a human: the amount rows on Payments, the wizard total at `StepPayment.tsx:27`, and the receipt.

**✅ Measured, and the premise was half wrong (2026-09-29).** The claim about Google's `latin` subset is **correct** — the generated `@font-face` block confirms its range is `U+0000-00FF, …, U+20AC, U+2122, …`, which covers € but **not** U+20B1. The conclusion drawn from it was **wrong**, for a reason worth recording: `subsets: ["latin"]` controls **preloading only, not which faces are declared.** `next/font` emitted all three Poppins subsets, and the **latin-ext** range is `U+0100-02BA, …, U+20A0-20AB, U+20AD-20C0, …` — and `U+20AD-20C0` contains **U+20B1**.

So ₱ is served by Poppins, not by the fallback. Two independent confirmations: `document.fonts.check("400 16px Poppins", "₱")` and the same at 800 both return `true`; and ₱ measures **10.00px** under Poppins against **10.1796875px** under the fallback stack — a *different* advance, which a per-character fallback could not produce (for contrast, "A" is 11.00 vs 10.9453125). **No mitigation is needed and none was applied.** The `unicode-range` @font-face was rightly not hand-rolled, and `fmtPeso` was not touched.

### B3 — Re-record all 71 baselines deliberately, and read the summary line  ✅ DONE (2026-09-29)
**Files:** `booker/visual-tests/pilot.spec.ts-snapshots/` (71 PNGs); `booker/playwright.config.ts:47-58`.

Every baseline contains text, and at `maxDiffPixels: 0` with `threshold: 0.02` a base-family change fails all of them. Two specific traps apply here, both learned in this repo:
1. **A stale baseline can pass.** booker-redesign F64/F66 proved a global CSS change going green against stale PNGs. So "the suite is red" is the *expected* state after B1, and "the suite is green" immediately after B1 without re-recording would mean the font did not load.
2. **A missing baseline fails while writing the file** (`architecture/conventions.md:379-386`), so a second run in the same workspace passes against a baseline generated from itself.

**Fix approach:** In order — (a) run `npm run test:visual` **before** touching anything, to record the honest pre-change count as the baseline-of-the-baseline; (b) apply B1/D2; (c) run the suite again and record how many failed (expect ≈71, and investigate any *pass*, because a passing text pane means Poppins did not reach it); (d) `npm run test:visual:update`; (e) two consecutive full runs must both report `71 passed`, exit 0. Never pipe a run through `tail` — it hides both the failure count and the exit code.

**Verification:** machine, entirely — the two consecutive green runs and exit 0 are the check. The PNGs themselves then need the human pass in I5; a green suite after re-recording proves stability, not that the new type is correct.

**B3(a) ✅ DONE (2026-09-29)** — pre-change baseline, against the dev server on `:3200`: **`77 passed (1.9m)`, exit 0.** 71 committed PNGs, all matching. See F2 for why the number is 77 and not 71. This is the honest "before", so any deviation in S4 is attributable to the font and nothing else.

**B3(b–e) ✅ DONE (2026-09-29).** The expected-red run came back **69 failed / 8 passed, exit 1**. 69, not the predicted 71 — and the two screenshot panes that passed were checked rather than waved through, because F2 says a passing text pane means the font did not reach it. They are `infotip-light` and `infotip-dark`, and they pass **legitimately**: `components/ui/InfoTip/InfoTip.tsx` renders only a 13px lucide `Info` icon, with its label and body inside a `Popover.Content` that is **closed** by default, so that pane contains no text at all. 71 screenshots − 2 text-free panes = 69.

Then `npm run test:visual:update` (77 passed, exit 0), and two consecutive verification runs at **77 passed, exit 0** each. After the F9 change, two *more* consecutive runs at **77 passed, exit 0**. Cross-check on the re-record: `git status` reports exactly **69** modified PNGs — the same 69 that failed, which also proves the two infotip baselines came back byte-identical rather than being silently rewritten. md5 of `home-light` confirmed changed (`84957124…` → `acd15836…`). No run was piped through `tail`; every count above is off the summary line.

### B4 — Re-measure the layouts the new advances will break  ✅ DONE (2026-09-29) — no product regression
**Files:** `booker/app/globals.css:434` (`.db-badge`, 11px/600, `nowrap`); `booker/visual-tests/a11y-audit.mjs:15-17,41-45`; the 34 declarations at 10–11px across `components/**/*.module.css`.

Poppins' advance widths and its ascender/descender metrics differ from `system-ui`, and booker has three places where that is load-bearing: `nowrap` badges that can overflow their pill rather than wrap, the 10–11px labels where a geometric sans loses legibility fastest, and every control whose width is content-driven. Separately, `a11y-audit.mjs:15-17` already documents that some box readings are taken before the web font swaps, and its `document.fonts.ready` wait at `:41-45` was added for exactly this class of bug — with **body** text on a webfont, every measurement that audit takes becomes font-dependent, and booker-redesign **I43 tier 2** (get every touch target to ≥32px, deferred to the mobile plan) was sized against the system stack.

**Fix approach:** After B1 and B3, re-run `a11y-audit.mjs` and diff its measurements against the pre-change run captured in B3(a). Treat as a defect to fix here: any clipped or overflowing control, any badge whose text escapes its pill, any label that wraps where it did not. Adjust **only** the spacing, `line-height` or `letter-spacing` that the new metrics require — no new sizes, no new scale, no colour, no copy. Record the new touch-target numbers so I43 tier 2 is re-sized against reality rather than against the old stack. Check 360px width explicitly: booker-redesign F50 was a Payments header silently clipped at exactly that width.

**Verification:** machine — the a11y audit's before/after diff, plus the 900×1200 and 360px-wide screenshot panes. Needs a human: the badge row, the Payments month groups, and the wizard stepper at phone width.

**Pre-change measurement ✅ DONE (2026-09-29)** — `AUDIT_BASE=http://localhost:3200 node visual-tests/a11y-audit.mjs`, exit 0, across 10 panes × 3 widths (360/390/1280) × light+dark:

| Category | Before | Detail |
|---|---|---|
| Horizontal overflow | **2** | `divisions @360` scrolls **27px**, in light *and* dark — identical in both, so it is a layout width, not a theme artefact |
| Touch targets under 44px | **92** | the I43-tier-2 population, e.g. `home` "Open Explore" 98×26 at both 390 and 1280; `activity` "Updates"/"Bookings" 92×34 @360 |
| No visible focus change | **4** | `activity` "Booking groups"; `payments` "Service, vendor or reference", "Previous", "Next" |

These three numbers are the comparison set for the post-change run. **A rise in any of them is a regression this stage owns**; the 92 and the 4 are pre-existing and are *not* this plan's to fix (I43 tier 2 and a separate focus-style gap), but they must not get worse, and the 27px overflow is the one most likely to move, because it is a width.

**Post-change measurement ✅ DONE (2026-09-29).** Touch targets **92 → 92**. Focus **4 → 4**. Neither moved. Overflow **2 → 4**, and the whole of that delta was chased down rather than assumed:

| Reading | Before | After | Verdict |
|---|---|---|---|
| `divisions @360` (light+dark) | 27px | **32px** | Fixture, not product — see F7 |
| `divisions @390` (light+dark) | — | **2px** (new) | Fixture, not product — see F7 |
| `home @360/390/1280` | none | none | The **real** division grid is clean |

Then three checks the overflow number cannot see on its own:
1. **The real division grid** (`HomePage.module.css:123` `repeat(auto-fill, minmax(128px, 1fr))`, and `repeat(4, minmax(0, 1fr))` on a phone — `minmax(0, …)` cannot overflow). All 13 tile names measured at 360/390/1280: **one line each, zero clipped**, in both the 10px phone and 12px desktop treatments.
2. **A clipping sweep across 27 panes × 3 widths × both themes**, looking for any element with `overflow: hidden` whose content exceeds its box. Every hit but one was a `.sr-only` node (`clientWidth: 1` by design — a false positive, not a defect). The one real hit was `opentoday @360`, 10px, both themes → **F8, pre-existing**.
3. **Attribution, not assumption**, for that hit: the same node was re-measured with the pre-change stack forced back on via `addStyleTag`, everything else identical. **10px under Poppins, 10px under the old stack** — byte-for-byte the same overflow, so it is not this plan's.

**Conclusion: nothing to correct.** No spacing, `line-height` or `letter-spacing` was touched, because the measurements gave no reason to touch any — which is the outcome this stage was hoping for rather than the one it assumed.

---

## IMPORTANT

### I1 — Bundle the weights the code actually uses, and no more  ✅ DONE (2026-09-29)
**Files:** `booker/app/layout.tsx:25-31`; `booker/components/auth/LoginPage/LoginPage.module.css:37-38`; `booker/components/explore/VendorPage/VendorPage.module.css:53`; `booker/components/explore/VendorResultCard/VendorResultCard.module.css:53`.

Poppins has no variable version on Google Fonts, so every weight and every style is a separate file — unlike the variable faces where the weight list is nearly free. The inventory in the Baseline section is the whole demand: 400, 500, 600, 700, 800, plus 900 in two declarations and italic in two. Naming a weight that no style requests wastes a download on every first visit; omitting one that is requested hands that text to the browser's synthesizer, which fakes the weight by smearing the 400 outline.

**Fix approach:** per **D2**: the `weight` array is `["400","500","600","700","800"]` with `style: ["normal","italic"]` limited to 400 italic — six files. Change `font-weight: 900` → `800` at `LoginPage.module.css:37-38` and **nothing else in that file**. The rule that keeps this honest: the array and the set of weights the CSS requests must be **equal**, grep-verifiable in both directions.

**Component separation:** style-only edits inside existing co-located `.module.css` files. No `.tsx` gains a style, no component gains state.

**Verification:** machine — for each weight in the array, at least one `font-weight`/`font-*` request exists; for each weight requested, it is in the array. In the browser, `document.fonts` lists exactly the intended faces and no more, and the Network panel count matches.

**✅ Executed and verified (2026-09-29).** Array is `["400","500","600","700","800"]` with `style: ["normal","italic"]`. `LoginPage.module.css:37-38` changed `font-weight: 900` → `800` on `.h1` and `.h2`; nothing else in that file touched. Machine-verified: `grep -rn "font-weight: *900\|font-black"` across `components` and `app` returns **no hits**, so no style now asks for a weight the array omits. In the browser, `document.fonts` on the Payments pane lists **4** loaded faces (400/600/700/800 normal) against 5 woff2 responses — lazily fetched per used face, see F3. The declaration count is larger than the download count; F3 explains why that is correct rather than wasteful.

### I2 — Remove the Bricolage Grotesque display face  ✅ DONE (2026-09-29)
**Files:** `booker/app/layout.tsx:25-31,95`; `booker/app/globals.css:475-476`.

`h1, h2` take `--db-font-display` and its comment justifies the arrangement as *"one font file, not two."* After B1 that sentence is false either way — the question is whether booker ships one brand family or two families with a deliberate pairing. Keeping both also means two `next/font` downloads on first paint, and Bricolage's three weights (600/700/800) are three more files on top of D2's set.

**Fix approach:** per **D1(a)** — delete the `Bricolage_Grotesque` import and constant (`layout.tsx:25-31`), drop `display.variable` from the `<html>` className (`layout.tsx:95`), and delete the `h1, h2` rule and its comment block at `globals.css:470-477`. Headings then inherit Poppins from the base family and keep their existing `font-weight`, which D2 bundles. Rewrite the `layout.tsx:16-24` comment so it describes Poppins as the single family — including its ⚠️ about the phone app, which still stands: `ezzy-booker-mobile` keeps the system stack until its own plan runs (I6).

⚠️ `visual-tests/csp.spec.ts:22-26` still passes — it asserts *a* webfont was fetched from `/_next/static/media/`, and Poppins satisfies that — but its comment names "the self-hosted **display face** from `next/font` (plan I34)" and its failure message says "the display face may not be loading at all". Update both strings, or the next person debugging a CSP failure is told to look for a font that no longer exists.

**Verification:** machine — `grep -rn "db-font-display\|Bricolage"` across `app`, `components` and `visual-tests` returns **nothing**; `tsc`, lint, build clean; `csp.spec.ts` green. Needs a human: headings at one weight rather than two families is a design judgement, in the same pass as I5.

**✅ Executed and verified (2026-09-29).** Removed: the `Bricolage_Grotesque` import and constant, `display.variable` on `<html>` (now `bodyFont.variable`), and the `h1, h2` rule at `app/globals.css:475-476` with its comment — replaced by a comment recording that headings now inherit the single family deliberately. `visual-tests/csp.spec.ts` had both of its stale strings corrected: the header comment now says "body face … Poppins, the app's single family", and the failure message now reads "…which would leave the entire app on the fallback stack" instead of naming a display face that no longer exists. Machine-verified: `grep -rn "db-font-display"` → **no hits**; `Bricolage` survives only in two comments that describe it as removed (`layout.tsx:16`, `globals.css:470`), which is the intended record. The browser probe confirms `h1` and `h2` resolve to Poppins via inheritance, not via a rule of their own.

### I3 — `tabular-nums` may stop working, and the amount columns depend on it  ✅ DONE (2026-09-29) — **it did stop working; the column survives anyway**
**Files:** `booker/components/payments/PaymentMonthGroup/PaymentMonthGroup.module.css:56`; `booker/components/ui/progress.tsx:68`.

Both use `font-variant-numeric: tabular-nums` / Tailwind `tabular-nums` to keep digits on a fixed advance so stacked amounts line up. That property does nothing unless the font ships the `tnum` OpenType feature. The system stack does. Poppins, as published on Google Fonts, **may not** — and when it does not, the property fails **silently**: no warning, no error, just a column of amounts that no longer aligns. A right-aligned column hides some of this; `PaymentMonthGroup` is where it will show.

**Fix approach:** Measure it. In the browser with Poppins loaded, compare `measureText("1111")` against `measureText("0000")`, and again with `font-variant-numeric` forced off — equal widths under `tnum` and differing widths without it is the discriminator. If `tnum` is absent, the honest options are to leave the declarations in place (harmless, and correct again the day the font gains the feature) and accept proportional digits, or to put **only** the amount figures on a `font-variant-numeric`-capable fallback. Recommend the first unless the measured misalignment is visible at 14px: a second family for digits is precisely the "numbers in tables" split that `globals.css:470` chose against.

**Verification:** machine — the `measureText` probe, recorded here. Needs a human: one Payments month group with mixed-length amounts.

**✅ Measured (2026-09-29). Poppins ships no `tnum`, confirmed, and its digits are strongly proportional:**

| digit | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | fallback (any digit) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| width @16px | 10 | **5** | 9 | 9 | 11 | 10 | 10 | 10 | 10 | 9 | 10.1875 |

`font-variant-numeric: tabular-nums` changes **not one of those numbers** — measured in layout and on canvas, with the property forced on and off. `1` is *half* the width of `0`. In the abstract that is severe: `1,111.11` is 36px against `8,888.88`'s 66px, a 30px spread for two amounts with identical digit counts.

**But the rendered column is fine, and the reason is worth keeping.** Measured on the real Payments pane (clock frozen to the fixture's 2026-04-10, as `pilot.spec.ts` does — without that the period filter empties the list and the probe reads `₱ 0.00`): six amount rows, widths spread **11px**, decimal points spread **0.00px**, every dot at x=663.98. Two things hold it together: `.amountCell` is `text-align: right`, so the right edge aligns whatever the width; and `fmtPeso` always emits exactly two decimals, so the dot's offset from that edge is two digits wide, not a variable count.

**Chosen: option (a)** — keep the declaration, accept proportional figures, and make the code say so. The comment above `.amount` previously promised *"Tabular figures so amounts line up column-wise down the list"*, which is now false about the mechanism even though the outcome is right; it has been replaced with the measurement, the two reasons the column still aligns, and the warning that removing **either** (a left-aligned amount, or a variable decimal count) puts the dot ragged by up to ~10px. A second font family for the figures was **not** introduced: the most-looked-at number on the page in a different typeface is a worse defect than a spread that measures zero.

### I4 — Say what the three monospace holdouts do  ✅ DONE (2026-09-29)
**Files:** `booker/components/payments/PaymentReceipt/PaymentReceipt.module.css:90`; `booker/components/dev/DevVersionBadge.tsx:5`; `booker/app/ui-gallery/page.tsx:482`.

The vendor-mobile Poppins plan (its B2) removed its monospace receipt reference and its Georgia callout, on a decision that global meant global. Booker's equivalents are a payment reference on a receipt — where monospace is doing real work, since a reference is read and re-typed character by character — plus two developer-only surfaces that no customer sees.

**Fix approach:** per **D3** — all three keep their current family. Add one comment line at `PaymentReceipt.module.css:90` recording that monospace here is a deliberate exception to the Poppins base, and why (a reference is read back character by character), so the next global sweep does not "fix" it. `DevVersionBadge.tsx:5` and `ui-gallery/page.tsx:482` need no comment: one is a dev badge, the other is inside a fixture behind `notFound()` in any production build.

**Verification:** machine — `grep -rn "monospace\|font-mono" components app` matches exactly those three declarations and no others, and `PaymentReceipt.module.css` carries the new comment.

**✅ Executed and verified (2026-09-29).** All three keep their family, per D3. `PaymentReceipt.module.css:89` gained a comment naming `.ref` the one deliberate exception, why (a reference is transcribed character by character; `0`/`O` and `1`/`l` in a geometric sans is where that fails), and an explicit instruction not to unify it in a future sweep, noting the vendor mobile app dropped its equivalent on purpose. `grep` confirms exactly three matches and no others.

### I5 — Fold Poppins into the pending local acceptance pass, don't open a second one  ✅ DONE (2026-09-29)
**Files:** `.plans/2026-09-29-booker-live-verification.md` (its L0-a) — reference; do not edit without the user's go-ahead.

booker's redesign is built but **its human "does this look right" pass has not happened** — it is L0-a in the live-verification plan, and that plan gates everything else behind it. A font change landing now means L0-a judges the redesign and Poppins in one sitting. That is the cheaper order, but only if it is deliberate: if Poppins ships *after* L0-a, the pass has to be repeated, because a base-family change touches every screen it just approved.

**Fix approach:** Land B1–B4 and I1–I4 before L0-a runs, and add one line to the live-verification plan's L0-a noting that the pass now covers Poppins as well as the redesign palette. Do not create a parallel verification plan, and do not mark L0-a done here — closing it is the user's call.

**Verification:** needs the user. Nothing machine-checkable.

**✅ Executed (2026-09-29).** `.plans/2026-09-29-booker-live-verification.md` amended in two places — the L0-a item and its row in that plan's table. Both now record that L0-a's scope grew from **19 baselines to 69** and that the pass judges the redesign palette **and** the new typeface together, with the reason stated (passing L0-a on the old font would have forced the whole pass to be repeated). The amendment also separates what is already machine-verified from what still needs the user's eye: the 10–11px label tier, the badge pills, the Payments amount columns, and the note that the vendor taglines are covered by **no** baseline on either client.

**Not done, deliberately:** L0-a is **not** marked done and no new verification plan was created. Closing it is the user's call.

### I6 — Amend the web↔RN contract row rather than silently diverging  ✅ DONE (2026-09-29)
**Files:** `.plans/2026-09-29-booker-mobile-parity-groundwork.md:280,305`.

Its §4 table records **Font → "the system stack"** as an *agreed* row across booker web and `ezzy-booker-mobile`, and its Display-typeface row already carries a ⚠️ that adopting a webfont "reverses mobile's D9", which uninstalled `@expo-google-fonts/inter` on purpose. Booker web taking Poppins as its base font breaks that row. The user's stated plan is to bring the mobile apps across later, so the divergence is intentional and temporary — but an unamended contract row is how two clients drift without anyone noticing.

**Fix approach:** per **D4(a)**. Amend the row to name Poppins as web's base family, with the date, and mark mobile as **out of contract on this row pending its own plan** — the same shape the plan already uses for D22-c/D22-d/I48/F63 at its `:107-109`. Do not add font loading to `ezzy-booker-mobile`, do not reverse mobile's D9, and do not mark anything in that plan done.

**Verification:** the amended row reads correctly and names this plan. Needs the user's approval to edit another plan's contract.

**✅ Executed (2026-09-29)**, under D4(a). Both rows in `.plans/2026-09-29-booker-mobile-parity-groundwork.md` amended in place, dated, naming this plan:
- **Font row** — now states web = Poppins (single family, body and headings, with the preload split) and mobile = still the system stack, and marks the two clients **out of contract on purpose**, in the same shape the plan already uses for D22-c/D22-d/I48/F63.
- **Display-typeface row** — now records that there *is* no separate display face on web any more, so that row and the Font row are one decision rather than two, superseding redesign D22/I34. Its ⚠️ about reversing mobile's D9 is kept and corrected: what a future mobile adoption would add is **Poppins**, not Inter or Bricolage.

**Not done, deliberately:** no React Native file was touched, mobile's D9 is not reversed, and nothing in that plan was marked complete — closing its items is the user's, per the root `AGENTS.md`.

---

### I7 — the plan had no documentation item, and three of its findings are traps worth writing down  ✅ DONE (2026-09-29)
**Files:** `booker/AGENTS.md:11,72`; `architecture/conventions.md:377`.

Found by a gap check after S5, not by the plan: nothing in B1–B4 or I1–I6 updated the docs, yet the root `AGENTS.md` asks for the relevant `architecture/` document and the nested `AGENTS.md` to be updated when they can be meaningfully improved — and this change created exactly the kind of invariant that is expensive to rediscover.

**Executed:**
- `booker/AGENTS.md` — a **Typography** row in Stack at a Glance, and a Typography section under Styling carrying the three traps: the family lives in `tailwind.config.ts` and not in a CSS rule; `next dev` must be restarted after touching that file because it fails silently (F4); and `style: ["italic"]` must not go in the main weight array because `next/font` preloads every crossed face (F9). Plus the two deliberate non-behaviours — `tabular-nums` is a no-op (I3) and the receipt reference stays monospace (D3).
- `architecture/conventions.md:377` — the committed-baselines note said the PNGs "only reproduce on this OS and font stack". That sentence now means **different things in the two apps**: booker self-hosts its whole family, so a booker baseline diff can no longer be explained away as a differently-installed font, while `vendor` is still on the system stack. Amended in place, dated, with both cases named.

**Not changed:** `architecture/conventions.md:501`, which says `csp.spec.ts` "asserts the division PNGs and the self-hosted font actually load" — still accurate, and it never named a display face, so there was nothing stale to fix.

---

## FINDINGS (discovered during execution)

### F1 — S1 cannot run while the user's `:3000` dev server is up  ✅ CLEARED (2026-09-29)
**Evidence:** `ss -ltnp` shows `next-server` PID 67726 listening on `:3000` from `/home/joshua/RS/booker`. Launching `PW_TEST=1 npm run dev -- --port 3200` starts, prints `✓ Ready in 337ms`, then dies with **"Another next dev server is already running. Local: http://localhost:3000, PID: 67726"**. Next 16.2 keys that lock on the project directory, not the port, so `--port 3200` does not avoid it. Port 3200 is free; the launcher exited on its own and left nothing behind.

**Why this blocks S1 and not just inconveniences it:** `visual-tests/a11y-audit.mjs:7-11` measures against a dev server that is already up, and `playwright.config.ts`'s `webServer` starts its own on 3200. Both are dev-only surfaces — `/ui-gallery` calls `notFound()` in any production build (`visual-tests/csp.spec.ts:28-30`), so `next build && next start` is not a substitute.

**Why nothing else was started instead:** S1's entire purpose is the *pre-change* measurement (`B3(a)`, `B4`). Running S2's edits first would forfeit it, and recovering it afterwards means stashing the change — which is the exact shape of the 2026-09-12 incident recorded in the session memory (a state-restoring step chained around a process kill). S5's plan edits were also left alone: amending the parity contract to say "web = Poppins" before the code says so would make that ledger wrong in the opposite direction.

**Unblock condition:** the user stops the `:3000` server. This plan does not stop a server it did not start (root `AGENTS.md` → Never: *"Never restart, shutdown, or reload any service unless explicitly authorized"*).

**Cleared (2026-09-29):** the user stopped PID 67726. A dev server was then started on `:3200` (PID 69343, `PW_TEST=1 npm run dev -- --port 3200`) and both S1 measurements ran against it. ⚠️ **That server is one this plan started, so this plan stops it** — by its listening PID from `ss -ltnp`, never `pkill -f`, and never chained with a state-restoring step.

---

### F2 — the suite is 77 tests, of which 71 are screenshots — not "71/71"  ✅ RECORDED (2026-09-29)
**Evidence:** `npm run test:visual` reports `Running 77 tests`. The breakdown, read off the run's own numbered list rather than inferred:

| Tests | File | Kind | Affected by a font change? |
|---|---|---|---|
| 2–72 (**71**) | `pilot.spec.ts:35`, `:71` | `toHaveScreenshot` — one PNG each, matching the 71 committed baselines exactly | **Yes, all of them** |
| 1 | `csp.spec.ts:39` | policy violations + a woff2 was fetched | Only if the font fails to load |
| 73–74 | `pilot.spec.ts:93`, `:120` | slot derivation, no screenshot | No |
| 75–77 | `seo.spec.ts:53`, `:83` | robots.txt and `X-Robots-Tag` on 2 paths | No |

**Consequence for B3:** the target is **77 passed**, and the expected post-change failure count is **71** — not 71-of-71. A post-change run that fails *fewer* than 71 screenshot tests means Poppins did not reach every pane, which is the F64 trap in its other direction. The plan's earlier "71/71" wording conflated the PNG count with the test count; corrected here rather than left to be discovered mid-S4.

### F3 — `next/font` crosses `weight` × `style`  ✅ RESOLVED (2026-09-29) — ⚠️ **but its conclusion was wrong; see F9**
**Evidence:** with `weight: ["400","500","600","700","800"]` and `style: ["normal","italic"]`, the generated `layout.css` contains **31 `@font-face` rules** — 10 weight/style pairs × **3 `unicode-range` chunks** (latin, latin-ext, devanagari) plus one `Poppins Fallback`. `next/font` offers no per-weight style selection, so 400-italic-only is not expressible: asking for italic at all asks for it at every declared weight.

**Why it is not the cost it looks like:** every rule carries a `unicode-range`, and the browser fetches per *used* face. Measured on the Payments pane: `document.fonts` reports **4** loaded faces (400/600/700/800 normal — 500 is not used on that pane) and **5** woff2 responses. The four italic weights nothing renders are never fetched. `subsets: ["latin"]` governs *preloading*, not which faces are declared, which is why latin-ext and devanagari appear in the CSS at all.

**Resolution as first written — and ⚠️ it was wrong:** *"keep the array as written; the extra faces are declared but never downloaded."* That held for the **dev** measurement it was based on, and dev emits no `<link rel="preload">` at all. A production build preloads **one file per declared face**, so the four unused italics were being fetched eagerly on every first visit — 43 kB of the 82.5 kB preloaded. **Corrected by F9**, which split italic into a second `preload: false` instance; the main array no longer carries `style`. What survives from this finding is the mechanism (the cross-product, and the per-used-face lazy fetch **after** preloading); what does not survive is the conclusion that it was free. **Lesson: a claim about first-paint cost cannot be settled against `next dev`.**

### F4 — a `tailwind.config.ts` change needs a dev-server restart, and fails **silently** without one  ✅ FIXED (2026-09-29)
**Evidence:** after adding `theme.extend.fontFamily.sans`, the running `next dev --webpack` served a `layout.css` whose preflight rule was still `font-family: ui-sans-serif, system-ui, sans-serif, …` — the default stack — with **zero** occurrences of `var(--db-font-sans)`. Poppins was loaded and the variable was defined, but nothing consumed it. After restarting the server on the same port, the same rule reads `font-family: var(--db-font-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` and the default stack is gone.

**Why it matters beyond this stage:** this is the F64 failure shape again. The app *looked* changed — Poppins was fetched, headings were on it via their own rule — while the **body was still on the system stack**. Had S4 re-recorded baselines in that state, 71 PNGs would have been committed as the new truth with the base font half-applied, and the suite would then have been green against them.

**How it was caught:** by reading the generated CSS for `var(--db-font-sans)` rather than by looking at a page. **Rule for the rest of this plan and any repeat of it in `vendor`/`command`: after touching `tailwind.config.ts`, restart the dev server and re-assert the preflight rule in the served CSS before trusting any screenshot.**

### F5 — the ₱ chunk is fetched on demand, not preloaded  ✅ RESOLVED (2026-09-29) — leave it
**Evidence:** `subsets: ["latin"]` preloads only the latin chunk, and ₱ lives in **latin-ext** (see B2). Every money screen therefore triggers an extra per-weight request for the latin-ext file when the first ₱ paints, and until it lands that one character shows in the fallback face while the digits beside it are already Poppins.

**Why it is parked rather than fixed:** the fix is one word — adding `"latin-ext"` to `subsets` — but it changes what is **preloaded for every declared face**, and F3 established there are 10 of them (including four italics nothing renders). That could trade one lazy request for a set of eager ones on first paint. The measurement that settles it is the **preload-link count in a production build**, which `next dev` does not emit; it belongs with the `npm run build` at the end of S4, not to a guess now.

**Unblock condition:** read the `<link rel="preload" as="font">` count out of the production build's HTML, with and without `"latin-ext"`. If adding it preloads only the faces actually used, add it; if it preloads all ten, leave it and accept a one-character swap on first paint.

**✅ Resolved by that measurement (2026-09-29): leave `subsets: ["latin"]` alone.** The production build preloads **one file per declared face**, so adding `"latin-ext"` would have doubled the preload set — and the same measurement showed the set was already carrying 43 kB of unused italic, which became **F9**. Preloading a second subset for a single character, on top of that, is the wrong trade: ₱ swaps in on first paint and is correct from then on. `subsets` is unchanged.

### F6 — `components/ui/progress.tsx` is dead code, and one of its lines is why it was inspected  ✅ FIXED (2026-09-29)
**Evidence:** `progress.tsx:68` carries `tabular-nums`, which is why I3 named it as a second site to check. It is **never imported**: `grep -rn 'from "@/components/ui/progress"'` and `grep -rn '<Progress'` across `app` and `components` return nothing outside the primitive itself.

**Consequence:** its `tabular-nums` is a no-op on a component that never renders, so I3's finding has no user-visible effect there. **Left untouched initially** — booker's `AGENTS.md` says primitives in `components/ui/` are not modified except for a shadcn-specific bug, and the root `AGENTS.md` says discovered dead code is reported, not silently removed.

**✅ Removed 2026-09-29, on the user's explicit instruction.** `components/ui/progress.tsx` (83 lines) deleted. Checked first that this orphans no dependency: it imports `@base-ui/react/progress`, and `@base-ui/react` is still used by six other primitives (`separator`, `dialog`, `input`, `button`, `switch`, `badge`), so `package.json` is untouched and no approval gate applies. A grep for `ui/progress`, `<Progress` and `ProgressValue` across `app`, `components` and `visual-tests` returns nothing — every other "progress" hit is unrelated (`BookingProgress`, the `in_progress` status, `StatTone: "progress"`, the `inprogress` gallery pane). Recoverable two ways: it is in git history at `HEAD:components/ui/progress.tsx`, and a copy was set aside before deletion (`trash` is not installed on this machine, so the copy stands in for it). Verified: `tsc` 0, 154/154 tests, `build` 0, visual 77 passed twice with **zero** baseline changes — it never rendered, so nothing could move.

### F7 — the a11y audit's `divisions` pane measures a fixture, so its overflow is not a product signal  ✅ FIXED (2026-09-29)
**Evidence:** `app/ui-gallery/page.tsx:356-370` renders that pane as a hand-written `gridTemplateColumns: "repeat(5, 1fr)"` at `maxWidth: 620` with 60px icons and 11px labels — a deliberate "every division at once, where a colour collision is obvious" fixture. It is **not** `HomePage`'s division grid, which is `repeat(auto-fill, minmax(128px, 1fr))` and `repeat(4, minmax(0, 1fr))` on a phone.

**Consequence:** forcing five fixed columns into a 360px viewport overflows by construction, at any typeface. Poppins widened it 27px → 32px and tipped 390 over by 2px, and **both numbers are about the fixture**. The product grid measures zero overflow at every width, before and after. Nothing was changed: `.plans/…-poppins-base-font.md` B4 permits only spacing the new metrics require, and re-laying-out a dev fixture would rewrite its baseline for no user-visible gain.

**✅ Fixed 2026-09-29, on the user's instruction.** `visual-tests/a11y-audit.mjs`: `divisions` removed from `PANES` and **`opentoday` added in its place**, with a comment explaining both halves — the fixture that was being measured, and the real grid inside `home` that is measured instead. Removing it costs nothing else: the fixture pane has no interactive elements, so it contributed no touch-target, focus or tab-order rows either. `opentoday` was chosen because its absence is precisely how F8 stayed hidden. The gallery pane itself is untouched; it still exists for reviewing division colours, which is its actual job.

### F8 — `opentoday @360` overflows its section by 10px, and it is pre-existing  ✅ FIXED (2026-09-29) — ⚠️ **and the first diagnosis was wrong**
**Evidence:** on the `opentoday` pane at 360px, in both themes, `HomeSection`'s box reports `scrollWidth 304` against `clientWidth 294`. The overflowing children are `OpenTodayCard`'s own card/panel/body at 288–290px. `HomePage.module.css:216-217` gives that shelf `repeat(auto-fill, minmax(290px, 1fr))` — a 290px floor inside a 294px section, before padding.

**Attribution (the part that matters):** re-measured with the pre-change font stack forced back on and nothing else altered — **10px either way**. Poppins did not cause it and does not worsen it. The document itself does not scroll sideways (`docOver: 0`), so it is contained.

**Why it was parked:** a pre-existing layout floor unrelated to typography, and the root `AGENTS.md` is explicit that discovered problems are reported rather than silently fixed. It also escaped notice because `a11y-audit.mjs` did not list `opentoday` among its panes.

**✅ Fixed 2026-09-29 on the user's instruction — after the first attempt failed and exposed two bigger problems.**

⚠️ **The diagnosis quoted above is wrong.** It blamed `HomePage.module.css`'s `.todayCards`. That grid *does* have the defect, but it is **not what the measurement was reading**: the `opentoday` gallery pane carries its **own inline copy** of the grid at `app/ui-gallery/page.tsx:294`, and there are **three** such hardcoded copies in the fixture (290px, 260px, 268px) mirroring three product grids by duplicating their values. Fixing only the stylesheet left the measured overflow at exactly 10px, which is how the mistake surfaced — the fix was verified rather than assumed.

**The mechanism, stated correctly:** `auto-fill` collapses the column *count* to one, but it will not shrink that last column below its own minimum. So `minmax(290px, 1fr)` keeps a 290px track inside a 294px content box and pushes 10px out. The comment above `.todayCards` claimed the grid "still collapses on a phone" — true of the count, false of the floor. The fix is `minmax(min(290px, 100%), 1fr)`, a no-op at every width where the grid already fitted.

**What 320px then revealed — a real user-facing bug, not a fixture artefact.** Probing a width nothing had tested (320px is still in use: iPhone SE 1st gen, small Android) found overflow in **three** shelves, 20–50px, because all three carried a bare floor wider than the content box at that width: `.todayCards` (290), `HomePage .cards` (260) and `PopularShelf .cards` (268). On real Home these shelves render whenever they have data, so this was reachable in the product, not only in the fixture. **All five places fixed** — three product grids and the three fixture copies (two of which are the same numbers).

**Prevention, not just repair:** `a11y-audit.mjs` now measures **320** as well as 360/390/1280, so a bare grid floor cannot hide under the narrowest tested width again.

**Verified:** overflow across `opentoday`, `home`, `bookagain` and `popular` at 320/360/390/1280 → **zero**, where before it was 10px at 360 and 20–50px at 320. Full audit: **`HORIZONTAL OVERFLOW: none`** across 10 panes × 4 widths × both themes, down from 2 readings before Poppins and 4 after. Touch targets **92 → 113** and focus **4 → 4**; the rise is arithmetically accounted for — `113 − 21` (the new `@320` rows) `= 92`, the previous count exactly, and `opentoday` contributes **zero** touch-target failures — so no new failure was introduced, only a new width measured. ⚠️ **Counts from runs before 2026-09-29 are not comparable**, which is noted in the file itself. `tsc` 0, 154/154, `build` 0, lint 18 (baseline), visual **77 passed twice, zero baseline changes** — the min() guard is a no-op at the 900×1200 capture width, which is why no PNG moved.

### F9 — the italic faces were preloading 43 kB that nothing renders  ✅ FIXED (2026-09-29)
**Evidence, from a production build** (`next dev` emits no preload links, which is why F5 waited for this): the page preloaded **10** woff2 files totalling **82,524 B** — one per declared weight × style. Broken down: 39,296 B normal, **43,228 B italic**. The only italic text in the app is two 14px vendor taglines, on the Vendor page and the vendor search card — neither on first paint of any entry route. So **52% of the preloaded font payload was for text no first visit renders**, which is exactly what I1 says not to do and what D2's "six files" was meant to prevent. F3 had judged the cross-product harmless on the strength of a *dev* measurement of lazy fetches; the production preload set is the measurement that mattered, and it says otherwise.

**Fix applied:** `app/layout.tsx` now declares italic as a **second `Poppins()` instance** — `weight: ["400"], style: ["italic"], preload: false` — and the main instance drops `style` entirely. Measured after the change: **5 preloaded files, 39,296 B — 43,228 B (52%) saved**, with true italic still available, self-hosted, fetched when a tagline actually renders.

**And a redundancy it exposed, which was then removed.** The first attempt also added `font-family: var(--db-font-sans-italic)` to both tagline rules, on the assumption that a separate `next/font` instance means a separate CSS family. **It does not:** both instances resolve to the same family name, `Poppins, "Poppins Fallback"`, so their `@font-face` sets merge and `font-style: italic` alone selects the italic face. Both stylesheets were reverted to their original text (`git status` clean for `components/explore/`), and the comment that had asserted the opposite was rewritten — a wrong comment being worse than the redundancy it justified.

**How "true italic, not a sheared fake" was verified,** since it is invisible by eye at 14px: the tagline string measures **172px** under `font-style: italic` against **175px** upright. Synthesis shears the upright outline without changing its advances, so a fake would have measured 175. 172 ≠ 175, and `document.fonts` lists a loaded 400-italic entry. ⚠️ **No visual baseline covers this** — the gallery never renders either tagline component and its fixture sets `tagline: ""` — so this measurement is the only regression guard the italic has.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN line below remains — plan-authoring §7. -->

- Font delivery → **`next/font/google`, self-hosted at build time** (resolved 2026-09-29) — it is the pattern `app/layout.tsx:25` already uses for the display face, needs no dependency and no `package.json` change, adds no runtime request to Google, and is already covered by `font-src 'self'` and asserted by `csp.spec.ts:91`.
- Licensing → **no action needed** (resolved 2026-09-29) — Poppins is SIL OFL 1.1; self-hosting through `next/font` is ordinary embedding, and the licence travels with the downloaded asset.
- Scope → **`booker/` only** (resolved 2026-09-29) — per the user's instruction. `vendor/`, `command/` and both Expo apps come later, each as its own plan; the vendor **mobile** app's Poppins work is already separately in progress and is not touched here.

- **D1: the display face → Poppins everywhere; Bricolage Grotesque is dropped** (resolved 2026-09-29) — one brand family across `h1, h2` and the body, one webfont on first paint, and `globals.css:470`'s "one font file, not two" becomes true again rather than merely rewritten. This supersedes booker-redesign **D22/I34**'s heading treatment, deliberately and on the record. → I2.
- **D2: weights → 400 / 500 / 600 / 700 / 800 plus 400 italic (6 files), with the two 900s remapped to 800** (resolved 2026-09-29) — removes a whole font file for a two-line edit at `LoginPage.module.css:37-38`; every other weight stays exactly as the design requests, and nothing is left to the browser's weight synthesizer. Headings under D1 take 700/800, both already in this set. → I1.
- **D3: the receipt reference stays monospace** (resolved 2026-09-29) — a payment reference is transcribed character by character, and `0`/`O`, `1`/`l` in a geometric sans is exactly where that fails. `PaymentReceipt.module.css:90` keeps its family and gains a comment naming it a deliberate exception; `DevVersionBadge.tsx:5` and `ui-gallery/page.tsx:482` are dev-only and untouched. This diverges from vendor-mobile's B2 on purpose. → I4.
- **D4: amend the web↔RN contract rows now** (resolved 2026-09-29) — `.plans/2026-09-29-booker-mobile-parity-groundwork.md:280,305` get web named as Poppins, dated and referencing this plan, with mobile marked out of contract on those rows pending its own plan. Mobile's D9 is **not** reversed and no React Native code is touched. → I6.

---

## DEFERRED / COSMETIC

- **A typographic scale.** This plan changes the family and nothing else — no new sizes, no revised line-height system, no letter-spacing pass beyond what B4 measures as necessary. Poppins will make a review of the 10–11px tier worth having; that is a design task, not this one.
- **`components/auth/LoginPage/LoginPage.module.css:9`** — a comment explaining that `font-family: Inter` was once named there and never loaded. Harmless and now historical; leave it unless D1(a) rewrites that stylesheet's neighbourhood anyway.
- **`next.config.ts:153`'s dead `geolocation=(self)` grant** and the dead `img-src` tile host, both recorded in `architecture/conventions.md:506-513`. Unrelated to fonts; noted, not touched.
- **`.plans/2026-08-26-booker-visual-baseline-remediation.md`'s IN PROGRESS status** looks stale after booker-redesign S7/I51 re-recorded every baseline. Not this plan's to close — flagged for the user.
- **Variable-font Poppins.** Not published on Google Fonts; static faces are the only option, which is why D2 is about counting files.

---

## Execution order

Each stage stops for the summary + checklist + plan-status report, and the next stage waits for you. One stage at a time by default.

1. **S0 — decisions.** ✅ **DONE (2026-09-29)** — D1–D4 answered and recorded in the DECISIONS block. The hard gate is clear; what remains is your approval to start S1.
2. **S1 — measure the ground first.** ✅ **DONE (2026-09-29)** — `77 passed`, exit 0; a11y audit at 2 overflow / 92 touch / 4 focusless. No source file was touched. Recorded at B3(a) and B4, with the count corrected by F2.
3. **S2 — B1 + I1 + I2.** ✅ **DONE (2026-09-29)** — all three items executed and machine-verified; `tsc` 0, 154/154 tests, lint at its 18 baseline. `build` deferred to the end of S4 (it contends with the dev server for `.next`). Found F3 and F4.
4. **S3 — B2 + I3 + I4.** ✅ **DONE (2026-09-29)** — ₱ confirmed drawn by Poppins from the latin-ext range (B2's premise corrected); `tnum` confirmed absent but the column measures a 0.00px decimal spread; the two comments rewritten to match the measurements. Found F5 (parked to the S4 build) and F6.
5. **S4 — B3(b–e) + B4.** ✅ **DONE (2026-09-29)** — 69 red (explained), 69 re-recorded, 77 passed twice; a11y unchanged on touch targets and focus, and every overflow delta attributed to a fixture (F7) or to a pre-existing floor (F8) by re-measuring with the old stack forced back on. No spacing change was needed. Found and fixed F9 along the way; F5 resolved.
6. **S5 — I6 + I5.** Amend the parity contract row per D4, then add the one L0-a line to the live-verification plan. Both are plan edits, not code.
7. **Not in this plan:** `vendor/`, `command/`, `ezzy-booker-mobile/`, `ezzy-vendor-mobile/`. The last of those is already running its own Poppins plan.

## Verification

**Machine-verifiable**
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test` — all clean; lint at its 18-warning baseline, not worse.
- `visual-tests/csp.spec.ts` — zero policy violations, ≥1 woff2 fetched from `/_next/static/media/`.
- `npm run test:visual` — **71/71, exit 0, twice consecutively**, after `test:visual:update`. Read the summary line; never pipe through `tail`.
- Grep symmetry — every weight in `layout.tsx`'s array is requested by some style, and every requested weight is in the array (`font-weight: 900` returns **zero** hits after I1). `grep -rn "monospace\|font-mono"` matches exactly the three declarations D3 keeps. `grep -rn "db-font-display\|Bricolage"` returns **nothing**.
- Browser probes, results recorded in this file: `getComputedStyle(document.body).fontFamily`; `document.fonts.check(…, "₱")` plus a `measureText` A/B; the `tnum` `measureText("1111")` vs `("0000")` comparison; `a11y-audit.mjs` before/after.

**Needs a human, not a terminal**
- Whether booker looks right in Poppins, in light and dark, at 900px and at 360px — this is **L0-a** in `.plans/2026-09-29-booker-live-verification.md`, not a separate pass (I5).
- The peso sign beside Poppins digits on Payments, the wizard total and the receipt (B2).
- Amount-column alignment in one `PaymentMonthGroup` with mixed-length amounts (I3).
- Badge pills, the 10–11px label tier, and the wizard stepper at phone width (B4).

**Gap check after S5 (2026-09-29)** — four things the stage reports had left unproven, closed:
- **Does the italic face survive the F9 revert?** ✅ The built CSS carries **3** `@font-face` chunks at `400 italic` and **no** italic at any other weight — F9's intent exactly. (First attempt at this check globbed only `.next/static/css` and reported zero faces; the font CSS also lives under `.next/static/chunks`. The check was wrong, not the code.)
- **Did F9 move any layout?** ✅ No. `a11y-audit.mjs` re-run after it and `diff`ed against the post-S4 run: **byte-identical output**. This mattered because the visual suite only shoots at 900×1200, so 360/390 were not otherwise re-covered after F9.
- **Do form controls inherit it?** ✅ Probed across three panes: `input`, `select`, `textarea`, `button`, `a`, `label`, `h1`, `h2`, `p`, `span` — **all** resolve to Poppins. A sweep for any text element *not* on Poppins returns exactly **one** hit per pane: `DevVersionBadge`'s `v0.22.0` on `font-mono`, which D3 keeps.
- **Is `--db-font-sans-italic` read by anything?** ⚠️ **No** — `grep` finds it only at its own declaration in `app/layout.tsx:81`. It is applied to `<html>` so `next/font` emits the italic `@font-face`, and the taglines reach that face through the shared family name rather than through the variable. Harmless, and left in place rather than experimented on, but a reader looking for its consumer will not find one.

**Explicitly not verified by this plan**
- Anything on staging or production. Booker is not serving users yet (confirmed 2026-09-28), and every deployed check lives behind L0 in the live-verification plan.
- Any other app. The four remaining portals/apps keep their current type until each gets its own plan.
