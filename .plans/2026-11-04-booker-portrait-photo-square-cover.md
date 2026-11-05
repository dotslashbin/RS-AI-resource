# Booker — a portrait photo must not stretch the offering card's square cover

**Date:** 2026-11-04
**App / scope:** booker/ web only. `components/home/OpenTodayCard/OpenTodayCard.module.css`, `components/explore/OfferingPage/OfferingPage.module.css` (I2, added 2026-11-05), plus a regression fixture in `app/ui-gallery/page.tsx` and one behavioural spec in `visual-tests/`. No vendor, command, Expo, schema, RLS, env or dependency change. One `.tsx` change: `OfferingPage.tsx` (I4's backdrop element).
**Status:** COMPLETE (2026-11-05) — release: staging ✅ · production ✅ (0.30.7, Vercel Promote by the user, 2026-11-05)

> The user reported this on 2026-11-04 with a screenshot of Home's "Available today": the middle card's cover
> is a portrait upload, and its "square" box grows into a tall rectangle. That also stretches the
> other cards in the row. Goal: every offering-card cover stays square whatever the upload's shape,
> on every surface, not only "Available today".

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision, F# = Finding, R# = read-only
> repro, S# / P# = staging / production release step. Numbers are plan-local. "home-square plan" =
> `2026-10-30-booker-home-square-sidebar-carousel.md`; "photo-square plan" =
> `2026-10-30-booker-offering-photo-square.md`.

---

## ▶ RESUME HERE (updated 2026-11-05, plan COMPLETE)
- **Done:** every stage. B1/I1 shipped in 0.30.6, I2–I4 in 0.30.7. Staging and production checked by the user on 2026-11-05.
  Release branch finished (booker master `10e7882`, `version-0.30.3` tag; back on `develop`).
- **Live where:** local ✅ · staging ✅ · production ✅.
- **Left open, elsewhere:** booker lint (18 problems) is `2026-11-04-booker-followups.md` F1. The Expo `PhotoGallery` (D4) is out of
  scope and has no plan yet. The two untracked Codex S2 files in booker belong to the checkout workstream.

---

## Investigation (2026-11-04)

### Every booker surface that draws an offering photo
| Surface | Component / rule | Box | Holds its shape with a portrait upload? |
|---|---|---|---|
| Home "Available today" | `OpenTodayCard.module.css:29–42` `.panel` / `.photo` | `aspect-ratio: 1/1`, **`overflow` visible, `<img>` in flow** | ❌ **No: the bug (F1)** |
| Explore results + vendor page offerings | `OfferingResultCard.module.css:40–51` `.cover` / `.photo` | `aspect-ratio: 1/1`, `<img>` `position: absolute; inset: 0` | ✅ by construction |
| Home "Popular this month" | `PopularShelf.module.css:33–56` `.art` | 96px, `aspect-ratio: 1/1`, `overflow: hidden` | ✅ by construction (`overflow: hidden` zeroes the automatic minimum height) |
| Home "Near you" | `ShelfCard.module.css` `.thumb` | fixed 44×44, `overflow: hidden` | ✅ fixed size |
| Wizard thumbnail | `OfferingCover.module.css:10–23` | fixed 64×64, absolute `<img>` | ✅ fixed size |
| Offering page gallery | `OfferingPage.module.css:38–54` `.gallery` / `.shot` | fixed grid rows (96px), **not square by design** | ✅ does not grow. Out of scope: it is a gallery, not a card |
| Booking detail modal | `BookingDetailModal.module.css:47–53` | fixed 84px tall | ✅ fixed size. Not a card |

### R1 — Repro (headless Chromium, the card's CSS copied verbatim, 330px columns)
| Variant | Landscape 16:9 | **Portrait 9:16** | Square |
|---|---|---|---|
| Current `OpenTodayCard` | 328×328 | **328×583** ❌ | 328×328 |
| `+ overflow: hidden` on `.panel` | 328×328 | 328×328 | 328×328 |
| `.photo` absolute (`inset: 0`), Explore's rule | 328×328 | 328×328 | 328×328 |
| Phone row (≤640px, 136px column), current | 136×136 | 136×136 | — |

The phone row is not affected: its 136px column gives `.panel` a definite width, and the grid row
stretches the panel rather than the other way round. The bug is desktop/tablet only, which matches
the screenshot.

### F1 — Root cause  (finding)
`aspect-ratio` only gives a *preferred* height. With `overflow: visible`, the box's automatic
minimum height is its content's height. The `<img>` is in flow at `width: 100%`, so a 9:16 photo's
own height at that width (≈583px) becomes the minimum, and the panel grows to fit it. `object-fit: cover`
never gets the chance to crop. Explore's card avoids this because its `<img>` is absolutely
positioned, so it contributes no content height. The photo-square plan's I1 built Explore that way;
the home-square plan's I1 copied the `aspect-ratio` to Home but not the absolute `<img>`.

### F2 — Why no test caught it  (finding)
Every gallery fixture's cover is `demoCover()` (`app/ui-gallery/page.tsx:258–261`), a **320×200
landscape** SVG. No test has ever rendered a portrait upload, on any surface. A landscape image
in flow is *shorter* than the square, so it fit and the baselines looked right.

---

## BLOCKERS

### B1 — "Available today" cover grows with a portrait photo  ✅ DONE (2026-11-04)
**File:** `booker/components/home/OpenTodayCard/OpenTodayCard.module.css:38–42` (`.photo`).
**Gap:** F1. A portrait cover makes the card ~255px taller on desktop, and the grid row stretches
every other card in that row to match (the empty bodies in the user's screenshot).
**Fix approach (D1 = A, recommended):** `.photo` gets `position: absolute; inset: 0;`, the
exact rule `OfferingResultCard` and `OfferingCover` already use. `.panel` already has
`position: relative`. The no-photo `.mark` and the desktop `.badge` (already absolute,
`bottom/right: 10px`) are unaffected. The badge was drawn after the `<img>` in source order, so it still paints on top.
Update the `.panel` comment so it says why the `<img>` is absolute.
**Component separation:** CSS only. `OpenTodayCard.tsx` is unchanged and stays a pure display component.
**Verification:** machine — I1's spec fails before the fix and passes after. The existing
`opentoday-*` and `opentoday-narrow-*` baselines must pass **unchanged** (`maxDiffPixels: 0`),
which proves the landscape look did not move. Live — staging, Home "Available today" with the
user's real portrait offering (S3).
✅ **Executed 2026-11-04.** `.photo` has `position: absolute; inset: 0`, and the `.panel` comment says why.
**Verified (machine):** `photo-aspect.spec.ts` was red before the fix (only `opentoday @1280px`, portrait 290×516)
and is 8/8 green after. The `opentoday-*` and `opentoday-narrow-*` baselines passed **without regeneration**, so the
landscape look is pixel-identical. Live check still to do on staging (S3).

## IMPORTANT

### I1 — Regression guard: a portrait (and an extra-wide) cover on every offering card  ✅ DONE (2026-11-04)
**Files:** `booker/app/ui-gallery/page.tsx` (new mode), new `booker/visual-tests/photo-aspect.spec.ts`.
**Gap:** F2. Without this, the next card that copies `aspect-ratio` without the absolute `<img>`
repeats the bug.
**Fix approach (D2 = A, recommended):**
- `demoCover()` gains optional `width`/`height` (default 320×200, so every existing fixture and
  baseline is unchanged).
- New gallery mode `photoaspect`: one row each of `OpenTodayCard`, `OfferingResultCard`,
  `PopularCardRow` and `ShelfCard`, each drawn three times with a 9:16 portrait, a 16:9 landscape
  and a 4:1 extra-wide cover, in the real grids used by Home and Explore.
- `photo-aspect.spec.ts` is **behavioural, not a screenshot**: at 1280px and 390px it measures each
  cover `<img>`'s **parent element** (the cover box in all four components, so no component gets a test hook).
  It asserts `|width − height| ≤ 1`, and that the cards in one grid row are the same height. It is not added to `pilot.spec.ts`'s `modes`,
  so no new baseline is accepted.
**Component separation:** fixture and test only. No component changes.
**Verification:** run the spec against the unfixed CSS first and record that it fails on
`OpenTodayCard` portrait only (the red step). Then after B1: all green.
✅ **Executed 2026-11-04.** `demoCover()` takes optional `width`/`height` (default 320×200). New gallery mode `photoaspect`.
New `visual-tests/photo-aspect.spec.ts`: 4 cards × 1280/390px = 8 tests. Not added to `pilot.spec.ts`, so no new baseline.
**Found while building:** at 390px the first draft timed out waiting on every `<img>`, because the desktop-only division
badge is `display: none` at ≤640px and its icon never loads. The wait now covers only the `data:` covers.
**Verified:** red (1 failed: `opentoday @1280px`, portrait 290×516; 7 passed), then green (8/8) after B1. That matches F1 and R1 exactly.

### I2 — Offering page: photos are squares too  ✅ DONE (2026-11-05)
*Added 2026-11-05 at the user's request: "When you look into an offering to see its details, the image shown is in that
rectangular orientation … follow the square approach for both web and mobile."*
**File:** `booker/components/explore/OfferingPage/OfferingPage.module.css` (`.gallery`, `.shot`, `.shot img`, the ≤640px block).
**Gap:** the gallery was a `2fr 1fr` grid with fixed 96px rows (main photo ≈595×200, two ≈297×96 beside it), and at ≤640px
the first photo alone as a 150px band. Every photo was a wide rectangle, unlike every offering card.
**Fix (D3, D4):** `.gallery` is `repeat(3, minmax(0, 1fr))`. `.shot` gets `position: relative; aspect-ratio: 1 / 1`, and
its `<img>` is `position: absolute; inset: 0` (B1's lesson: in flow, a portrait photo would stretch the square). At ≤640px
the first photo alone, full width, square. With one or two photos each keeps a third of the row (D3's preview).
**Also changed, by consequence:** `.shot` lost `display: flex; align-items: flex-end; padding: 10px`. With nothing else in the
frame, that padding only inset the photo 10px inside a `--div-none-bg` border. The photo now runs edge to edge, like the cards.
**Not changed:** the no-photo `.placeholder` (a 168px tinted band saying "No photos yet"). It is not a photo; it stays as is.
**Component separation:** CSS only; `OfferingPage.tsx` unchanged.
**Test:** new gallery mode `offeringphotos` renders the real `OfferingPage`. ⚠️ It fetches on mount (booker AGENTS F12), so
`photo-aspect.spec.ts` answers **every** Supabase read with `page.route`: `count` portrait/landscape/wide photos from
`offering_attachments` (`kind=eq.photo`), `[]` for everything else, an SVG for each public photo URL. Not baselined, not in
`pilot.spec.ts`. 4 tests: 1, 2 and 3 photos at 1280px (equal squares, one row, the image fills its frame), and 3 photos at 390px
(only the first visible, square, wider than 300px).
✅ **Executed 2026-11-05.** **Red first:** all 4 failed on the old CSS (desktop photo 1 594.7×200; phone 326×150), which also
proved the routed photos render. **Green after:** spec 12/12. **Seen by eye** (throwaway spec, screenshots outside the repo, file
deleted): 3 photos dark 1280, 1 photo light 1280, 3 photos dark 390. Squares, portrait centre-cropped, no frame, no overflow.
**Not verifiable locally:** the real app needs a signed-in session (blank without one), and credentials were not used. The
real-data check is S3 on staging.

### I3 — Offering page: photos centred; a single photo bigger  ✅ DONE (2026-11-05) · single-photo part superseded by I4 the same day
*Added 2026-11-05 at the user's request: "since vendors only have one image for now, lets make this display auto-aligned. If
there's only one, it should be in the middle and bigger (on web, the mobile looks fine)."*
**File:** `booker/components/explore/OfferingPage/OfferingPage.module.css`.
**Fix (D5):** `.gallery` is `display: flex; justify-content: center` (was a 3-column grid that left-aligned one or two photos).
`.shot` is `flex: 0 1 calc((100% − 16px) / 3)`, so three photos are unchanged, and two keep a third each, centred as a pair.
`.shot:only-child { flex-basis: 400px }` makes a vendor's only photo a 400px square in the middle. It shrinks below that if
the page is narrower. At ≤640px `.gallery > :first-child { flex-basis: 100% }` keeps the phone exactly as I2 left it.
CSS only, using `:only-child`, so `OfferingPage.tsx` is unchanged.
**Test:** `photo-aspect.spec.ts`: the 1-, 2- and 3-photo desktop tests also assert the group is centred in the row (±1px), and
a new test asserts a single photo is more than 50px wider than one of three.
✅ **Executed 2026-11-05.** **Red first:** 3 failed (one photo 302.7px left of centre, two 151.3px, single 294.7 = one of three).
**Green after:** spec 13/13 (phone test unchanged and passing). **Seen by eye:** one photo dark 1280 (400px, centred), two light
1280 (centred pair), one light 720 (400px, centred).

### I4 — Offering page, one photo on web: a full-width banner showing the whole photo  ✅ DONE (2026-11-05)
*Added 2026-11-05 (user): "When there is only one image, it does not look aesthetically pleasing … Maybe we only use the square
for mobile and a bigger rectangular dimension for web, when there is only one image. Lets try that."*
**Why I3's single square failed (ux-design §2):** a 400px square floating in the 900px column, unaligned with the content
below it. It had no relationship to the page's edges, so the hero looked like an accident.
**Fix (D6):** at >640px a single photo is a **full-width 21:9 banner** (900×386 at 1280px). The photo is shown **whole**
(`object-fit: contain`) over a **blurred, dimmed copy of itself** (`.backdrop`: `blur(24px) brightness(0.7)`, `inset: -24px`
so the blur's soft edge falls outside the rounded frame). Vendors upload any shape, often a portrait poster with text to its
edges (the user's own "Consultation" example); a wide `cover` crop would cut most of that away. This is the
contain-over-blurred-fill pattern app stores and marketplaces use for unknown-shape media. Two or three photos and phones are
unchanged. At ≤640px a single photo is still the square `cover` crop, and `.backdrop` is `display: none`.
**Files:** `OfferingPage.module.css` (`.shot:only-child`, `.backdrop`, ≤640px block); `OfferingPage.tsx`: one
`<span aria-hidden className={styles.backdrop}>`, rendered **only when `photos.length === 1`**, with
`style={{ backgroundImage: url(<JSON-quoted photo URL>) }}`, the one genuinely dynamic value, as the existing `maskImage`
pattern does in four components. `OfferingPage.tsx` stays a pure render layer: no state, condition on hook data only.
CSP: `style-src` already allows inline, and `img-src` the Supabase origin; `csp.spec.ts` passed.
**Test:** `photo-aspect.spec.ts`: the single-photo desktop test now asserts full row width, w/h = 21/9 (±0.02), `object-fit:
contain`, image fills the frame, and a visible backdrop carrying the photo URL. A new phone test asserts one photo stays a
square with `cover` and no visible backdrop.
✅ **Executed 2026-11-05.** **Red:** 1 failed (banner 400px vs row 900px). **Green:** 13/13. **Seen by eye** (throwaway spec,
deleted): portrait poster dark + light 1280, landscape dark 1280, 4:1 wide light 1280, portrait dark 800, portrait dark 390
(square crop, unchanged).
**Observed, not changed:** a 9:16 poster in a 21:9 banner is ~216px wide, so fine print on it is small. A taller banner
(e.g. 16:9, 506px) shows it at ~285px at the cost of pushing the title down. That's a tuning knob for the user (D6). On phones the
square crop cuts a portrait poster's top and bottom, as accepted.

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains — see §7. -->
- **D1 — how to stop the growth** → **A: absolute `<img>` (`inset: 0`), Explore's existing rule**
  (resolved 2026-11-04, the user). One pattern across all square covers, and R1 shows it holds. Rejected B:
  `overflow: hidden` on `.panel` (Popular's rule) also works, but leaves two patterns in use.
- **D2 — regression guard** → **A: add I1** (fixture + behavioural spec, no new baselines)
  (resolved 2026-11-04, the user). F2 is how this shipped. Rejected B: CSS fix only.
- **D3 — Offering page layout on desktop** → **row of up to three equal squares** (resolved 2026-11-05, the user). Rejected: a
  320px square with two 156px squares stacked beside it, and the first photo alone as one 320px square.
- **D4 — "both web and mobile" means booker web at desktop and phone width** (resolved 2026-11-05, the user). The Expo
  `ezzy-booker-mobile` app's `PhotoGallery` (full width × 220px, `PhotoGallery.styles.ts`) is **out of scope**: another repo
  (unreleased mock-data build), and a cross-app change. At phone width the existing rule of first photo only is kept, now square.
- ~~**D5 — a single photo's size** → **400px, centred**~~ superseded by D6 (2026-11-05). Was: (2026-11-05, the agent's choice within the user's "in the middle and
  bigger"; the user can name another size). One of three is ≈295px at full width. 400px is clearly bigger and still leaves the
  title above the fold at 1280×900. Two photos are centred too, at a third each.
- **D6 — a single photo on web** → **full-width 21:9 banner, whole photo over a blurred copy of itself; square crop kept on
  phones** (2026-11-05: direction from the user, "a bigger rectangular dimension for web … lets try that"; the 21:9 ratio and
  the contain-over-blur treatment are the agent's design within it; **accepted by the user on 2026-11-05** with the staging
  check (S3), 21:9 kept). Alternatives: plain `cover` crop
  (rejected: cuts posters), 16:9 (bigger poster, title lower).

## FINDINGS DURING EXECUTION
### F3 — `npm run lint` already fails on `release/version-0.30.3`  ➜ MOVED (2026-11-04)
Not part of this change. **Moved by the user's decision on 2026-11-04 to `2026-11-04-booker-followups.md` F1**, where it is
tracked; its status lives there. This plan's own check stands: HEAD's `page.tsx` linted from `git show` carries the same error
(at :1126, now :1163 after this plan's 37 added lines) and the same `OFFERINGS` warning, so this plan adds no lint problem.

## DEFERRED / COSMETIC
- ~~Offering page gallery (`.shot`) is not square, by design.~~ Superseded 2026-11-05 by I2 at the user's request.
- Expo `ezzy-booker-mobile` `PhotoGallery` stays a 220px band (D4). If wanted, it is its own change in that repo.
- A portrait poster like the user's (text all over) loses its top and bottom to the square crop.
  That is the accepted behaviour from the photo-square plan's D2 (crop, never letterbox). Changing it
  is a product decision, not this patch.

## Execution order
1. **Stage 1 (local):** I1's fixture and spec first, run red; then B1; then green. Then the full gates:
   `npx tsc --noEmit`, `npm run lint`, `npm test`, and the full `npm run test:visual` with no
   baseline updates expected (log to a file; read the summary line, not `tail`). Bump
   `package.json` to 0.30.6 if the user wants it in this patch (their call, as with 0.30.3–0.30.5).
   Hand over a commit draft per the commit-drafting skill, naming paths explicitly and excluding the two Codex files.
2. **Stage 2:** staging release (below).
3. **Stage 3:** production release, always last.

## Release (§12)
DB-first does not apply: there is no migration, Edge Function, secret or env var. One app deploy.

### Staging (production untouched throughout)
| # | Who | Step | Check |
|---|---|---|---|
| S1 ✅ | 👤 | Commit on `release/version-0.30.3` and push | ✅ 2026-11-05: `4abaf28`, `a263399` (0.30.6), `103e462`, `a31b74f` (0.30.7); branch in sync with origin (checked by `git status -sb`); only the two Codex files untracked |
| S2 ✅ | 👤 | Deploy booker to staging (Vercel) | ✅ 2026-11-05, 0.30.7, per the user |
| S3 ✅ | 👤 + 🤖 | Home "Available today" at desktop width with the portrait offering (the user's "Consultation" card), then at 390px; Explore with the same offering; **open that offering's page** at desktop and 390px | ✅ 2026-11-05, user-checked on staging. ⛔ cover square, the row's cards all the same height; offering page: one photo is the 21:9 banner on desktop (I4) and a square on a phone; two or three photos are centred squares |

⛔ **Staging fully green before anything touches production.**

### Production (last stage)
| # | Who | Step | Check |
|---|---|---|---|
| P1 ✅ | 👤 | Parity: the production candidate is the exact staging deployment from S2 | same commit |
| P2 ✅ | 👤 | Vercel **Promote** that staging deployment | — |
| P3 ✅ | 👤 | Home "Available today" and the portrait offering's page on production at desktop width | ⛔ same as S3 |
| P4 ✅ | 👤 | Finish the release branch (git flow), as the user normally does | ✅ 2026-11-05: merged to master `10e7882`, tag `version-0.30.3`, on `develop`; the two Codex files still untracked (checked by `git status`) |

## Docs (closing step, 2026-11-05)
✅ Updated after COMPLETE, at the user's request: `architecture/portals.md` (booker Explore: how offering photos are shaped;
the Known Gaps line saying `OfferingPage` has no fixture now notes the `offeringphotos` mode) and `booker/AGENTS.md` (Styling: a
square photo box needs an absolute `<img>`, plus `photo-aspect.spec.ts`; the stale "OfferingPage still cannot get a gallery pane"
line corrected). `.plans/INDEX.md` regenerated: no change, 188 plans and 188 rows. `booker/AGENTS.md` is in the booker repo, so it needs
its own commit on `develop`.

## Verification
**Stage 3, 2026-11-05 (live, user):** P1–P3: the user promoted the tested staging deployment and checked production, as they
reported. P4 was verified read-only by the agent: booker master `10e7882` "Merge branch 'release/version-0.30.3'", tags `v0.30.6`,
`v0.30.7`, `version-0.30.3`, the local release branch gone, the current branch `develop`, and only the two Codex files untracked.
**Stage 2, 2026-11-05 (live, user):** staging deploy of 0.30.7 and S3 passed, as reported by the user. The optional full
screenshot re-run after I3/I4 is also reported done by the user. The agent ran neither, so their output isn't recorded here.
**Stage 1, run 2026-11-04 (machine):** `npx tsc --noEmit` exit 0 · `npm test` 323/323 · `npm run test:visual` **192 passed,
0 failed** (full suite, no baseline updated) · `npm run lint` exit 1, already failing before this plan (F3, now booker-followups F1) · this plan's two files linted clean
apart from that inherited `page.tsx` error.
**Stage 1b, run 2026-11-05 (machine):** `tsc` exit 0 · `npm test` 323/323 · `npm run test:visual` **196 passed, 0 failed**
(no baseline updated; 192 + I2's 4) · lint unchanged at the pre-existing 18 (booker-followups F1).
**Stage 1c (I3), run 2026-11-05 against the user's own dev server on :3000** (it was running, and Playwright cannot start its
own for the same folder; a temporary config pointed `baseURL` at :3000 and was deleted after): `tsc` 0 · `npm test` 323/323 ·
lint 18 (a 19th warning was the temp config itself, gone with it) · `photo-aspect`, `csp`, `home-layout`, `seo` and `promo`
specs: **52 passed, 3 failed**. All 3 failures are `promo.spec.ts:123/340/360`, which open their own context hardcoded to
`localhost:3200` and got `ERR_CONNECTION_REFUSED`. That's an artefact of where the run went, not the code, and the carousel is untouched.
⚠️ **The full screenshot suite (`pilot.spec.ts`) was NOT re-run for I3.** It needs Playwright's own server on :3200 (`PW_TEST=1`
hides Next's dev badge, which would show in every screenshot from :3000). Low risk: the change is in `OfferingPage.module.css`
(a CSS module, scoped) and no baseline renders `OfferingPage`. It passed 196/196 for I2 on 2026-11-05. Re-run with :3000 stopped
before staging if wanted.
**Stage 1d (I4), run 2026-11-05 against the user's :3000 server (temp config, deleted):** `photo-aspect` + `csp` + `home-layout`
+ `seo` **29/29** · `tsc` 0 · `npm test` 323/323 · lint 18 (pre-existing; none in the changed files). `pilot.spec.ts` screenshots
and `promo.spec.ts` (hardcoded :3200) not re-run while :3000 is up; no baseline renders `OfferingPage`.
- I4: machine (red → green, 13/13), CSP spec, screenshots read by eye. **Design acceptance is the user's** (D6).
- I3: machine (spec red → green, 13/13) plus screenshots read by eye.
- I2: machine (4 routed tests, red → green) plus screenshots read by eye. Live on staging (S3) with a real uploaded photo.
- B1: machine (I1 spec red → green; the existing `opentoday-*` baselines unchanged). Live on staging (S3) and production (P3).
- I1: machine (the spec itself; red before B1, which proves it can catch F1).
- Not verifiable locally: real staging uploads. The local seed may have no portrait photo and no openings
  today (the home-square plan's I1 hit the same gap), so the real-data check is S3.
