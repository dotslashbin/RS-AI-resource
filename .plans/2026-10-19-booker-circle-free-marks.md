# Booker circle-free division marks, and the new EzzyRide asset

**Date:** 2026-10-19
**App / scope:** `booker/` only, plus `.plans/previews/booker-ui/`. **No vendor, command, Expo,
schema, RLS or dependency changes.**
**Status:** COMPLETE — all items ✅ (2026-10-19). Final sweep: `tsc` clean, 304 unit tests, lint unchanged at its pre-existing 18, visual **121 passed / 0 failed**.

> Drop the tinted disc behind every division mark, and draw the mark in colour in light mode
> and as a monochrome silhouette in dark. Plus: the EzzyRide asset changed shape again, so the
> self-backed treatment built for the old one has to come out.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local. Findings from
> the preview are **PF#** (`.plans/previews/booker-ui/README.md`).

---

## Context a later session will need

Predecessors: `2026-10-18-design-preview-harness.md` (COMPLETE, one open follow-up F9) and
`2026-10-18-booker-ui-enhancements.md` (COMPLETE). **Nothing from either is committed yet** —
booker currently has ~30 changed files and 26 touched baselines in the working tree.

**PF5 (circle-free) was PARKED on 2026-10-18 and is now GO** — the user chose the hybrid after
reviewing preview screen 1: *"Circle-free, as an image for the light mode and Circle-free, mask
painted for the dark mode."* **PF6-Park was parked behind PF5 and is now live** — see B3.

⚠️ **"Mobile view" here means the responsive Booker website, not the Expo apps.** Verified:
`ezzy-booker-mobile/src/components/home/DivisionGrid/DivisionGrid.tsx` renders division **text
only** (`<Text>{d.name}</Text>`), and neither Expo app ships a `division-icons` directory. No
cross-app work, so no approval gate.

---

## BLOCKERS

### B1 — The new EzzyRide asset invalidates the self-backed treatment  ✅ DONE
**Files:** `booker/app/globals.css` (the `--division-art` and self-backed blocks),
`booker/public/division-icons/ezzy-ride.png` (replaced by the user, same filename)

The old asset was a **solid disc, edge to edge, 79% ink, fill 1.000** — its circle was baked in,
which is why `2026-10-18-booker-ui-enhancements` gave it three per-slug overrides. **The
replacement is a different kind of file entirely.** Measured 2026-10-19:

| | old | new |
|---|---|---|
| canvas | 256×256 | **2000×2000** |
| file size | 35 KB | **716 KB** |
| opaque box | 256×256 (full bleed) | 1624×1742 |
| fill | **1.000** | **0.871** |
| ink coverage | 79% | **33%** |
| corner alpha | 0 (disc) | 0 |
| distinct colours | multi (white on blue) | **one colour at 99%** (`#0056fd`) |

So it is now ordinary single-colour line art on transparency, exactly like the other twelve.

**Fix approach:** delete all three overrides for `ezzy-ride` — `--division-plate: transparent`,
`--division-art-box: 100%`, `--division-mark-art: url(…)`. Leaving them in would blank a plate
that line art needs and scale the mark to 100% of its box, which is the *opposite* of correct.
Then re-apply the measured sizing: the median fill moved (0.969 → 0.961) because ride's own
fill changed, so **all three `--division-art` values shift**: drive `1.69 → 1.67`,
learn `1.14 → 1.13`, and ride gains `1.10`.

⚠️ **`--division-art-box` and `--division-mark-art` will then have no consumer at all.** They
were introduced for exactly one slug. Remove them with their comments rather than leaving two
tokens nothing reads — see I2.

**Verification:** machine — `node .plans/scripts/measure-division-marks.mjs` reproduces the
three factors; the EzzyRide mark renders as line art at parity size on every surface; baselines.

### B2 — Circle-free, with a different treatment per theme  ✅ DONE
**Files:** `components/ui/DivisionIcon/DivisionIcon.{tsx,module.css}`,
`components/home/DivisionStrip/DivisionStrip.module.css` (`.tileDisc`),
`components/home/PopularShelf/PopularShelf.module.css` (`.art`), and the five mask surfaces:
`OfferingResultCard.module.css` (`.phMark`, `.footMark`), `OfferingCover.module.css`,
`SearchingOverlay.module.css`, `ExplorePage.module.css`

Two separate changes, and they must land together or the result is illegible in one theme:

1. **Remove the plate behind the mark** — the `--division-plate` / `--division-tile` background
   on `DivisionIcon .box`, `DivisionStrip .tileDisc` and `PopularShelf .art`.
2. **Draw the mark in colour in light, monochrome in dark.** Today the five mask surfaces are
   *always* monochrome and `DivisionIcon` is *always* colour; under the new rule every surface
   switches on theme.

⚠️ **THE TINT IS NOT DECORATION AND THIS IS THE WHOLE RISK.** `app/globals.css` declares
`--div-*-tile` in `:root` **only** so it stays light in dark mode, precisely because four marks
are near-black line art. Removing it is safe in dark *only because* the mark becomes a light
silhouette there. Remove it without the per-theme switch and Food (`#000000`), Home, Care and
Learn disappear. The two halves of this item are one change.

**Fix approach:** one technique for all six surfaces rather than two — see **D2**, which is
OPEN. Whichever is chosen, the per-theme switch belongs in CSS keyed on `.dark`, not in
TypeScript, so the theme can change without a re-render (the rule `lib/divisions.ts` sets).

**Verification:** machine — every mark surface shot in both themes (I3). ⚠️ Contrast is
measured per mark against the real background, not eyeballed; see B3.

### B3 — Three marks wash out on a light background once the tint is gone  ✅ DONE (accepted)
**File:** `booker/public/division-icons/*.png` (asset property, not code)

The mirror of the dark-mode problem. **Share of each mark's opaque ink that clears 3:1 against
a white card**, measured 2026-10-19:

| mark | legible ink | verdict |
|---|---|---|
| `ezzy-law` | **0.0%** | washes out |
| `ezzy-stay` | **0.0%** | washes out |
| `ezzy-pets` | **0.2%** | washes out |
| `ezzy-work` | 39.3% | reads |
| `ezzy-park` | 40.4% | reads |
| the other eight | 99.2 – 100% | fine |

⚠️ **CORRECTION — AN EARLIER DRAFT OF THIS ITEM WAS WRONG, AND THE PREVIEW CAUGHT IT.** It
measured each mark's *dominant* colour and reported `ezzy-park` at **1.01:1**, calling it an
invisible blank tile and a hard blocker. The dominant colour is Park's baked near-white
**plate**, not its glyph — rendered on a white card the red "P" is perfectly legible (40% of
its ink clears 3:1). Share-of-legible-ink is the honest metric; dominant colour is not. The
figure, the verdict and the D1 recommendation below all changed as a result.

**Park's real problem is in DARK, not light.** Its mask includes the baked plate, so the
silhouette renders as a **filled white tile** where the other twelve are open line art — PF6
arriving, but as a cosmetic inconsistency rather than a legibility failure. Visible on preview
screen 1 in dark.

Law and Stay are the genuine ones: at 0% legible ink they are faint tan and pale grey shapes on
a white card. Pets (0.2%) is coral — low contrast but a solid, readable shape.

⚠️ **Not automatically a violation:** these marks are decorative (`aria-hidden`) with a text
label beside them, so WCAG 1.4.11's 3:1 governs *meaningful* graphics, which these arguably are
not. They are, however, visibly weaker than on their tint. That is **D1**, OPEN.

**Fix approach:** depends on D1. No code until it is answered.

**Verification:** machine — re-run the legible-ink measurement after the change.

---

## IMPORTANT

### I1 — Update the preview to show the new treatment  ✅ DONE
**Files:** `.plans/previews/booker-ui/{screens.js,preview.css,logos/ezzy-ride.png}`

The preview still carries the **old** EzzyRide disc and still presents circle-free as a
rejected option. Per `.claude/skills/design-preview/SKILL.md`, re-copy the asset, re-run
`build-division-mask-css.mjs` (the mask data URIs are generated from the logos), and re-shoot.

⚠️ **The preview's `masks.css` is generated from the committed PNGs** — a replaced asset means a
stale data URI until it is rebuilt, which would show the *old* ride logo in the mask column
while the img column shows the new one.

**Verification:** machine — `shoot.mjs booker-ui` 9 checks × 28 cells. Human — the user reviews.

### I2 — Remove the tokens this change orphans  ✅ DONE
**File:** `booker/app/globals.css`

`--division-art-box` and `--division-mark-art` exist for one slug (B1), and `--division-plate`
exists to blank a plate that B2 deletes outright. Once B1 and B2 land, **all three have no
consumer**. Leaving them is how a codebase accumulates tokens nobody dares delete.

⚠️ Check `DivisionStrip.module.css` and `PopularShelf.module.css` too — both read
`--division-plate` via `var(--division-plate, var(--division-tile))`.

**Verification:** machine — `grep -r` finds no consumer before deletion; `tsc`, lint, baselines.

### I3 — Baseline coverage for both themes on every mark surface  ✅ DONE
**File:** `visual-tests/pilot.spec.ts`, `app/ui-gallery/page.tsx`

The suite already shoots light and dark, so most of this is free — but the point of B2 is that
the two themes now render by **different techniques**, so a regression in one is invisible in
the other. ⚠️ `explorechips`, `resultcard`, `opentoday`, `divisions`, `home`, `popular`,
`nearyou` and `home-narrow` all draw marks and all need re-recording.

**Verification:** machine — full suite green after regeneration, and each diff inspected before
it is accepted rather than blanket-updated.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN line remains. -->

- **PF5 circle-free** → **GO, hybrid per theme** (resolved 2026-10-19, user) — image in light,
  mask-painted in dark, chosen from preview screen 1.
- **"Mobile view" means the responsive web layout** (resolved 2026-10-19) — verified the Expo
  apps render divisions as text and ship no logo files.
- **D1: the three marks that wash out on white** → **(c) ship as-is** (resolved 2026-10-19, user). Nothing is unreadable; a redraw of Law/Stay/Park stays available later.
- *(options kept for the record)* — D1 (B3)
  - **(a) Per-slug exception: keep a plate for just those marks.** Honest and surgical, but
    five of thirteen tiles then look different from the rest, which partly defeats circle-free.
  - **(b) Mask-paint in BOTH themes.** Guaranteed legible everywhere, one technique, simplest
    code — but **every logo loses its colour**, including in light, which is not what was asked
    for.
  - **(c) Ship as-is and accept it.** Viable: all three are solid coloured shapes with a text
    label under them, and only Law and Stay are genuinely faint.
  - **(d) Fix the assets** — a darker variant of Law and Stay (and Park redrawn without its
    baked plate, which would also fix its dark-mode filled-tile look). Correct at the source,
    but it is design work, not code.
  - **Recommendation: (c) now, (d) when convenient.** Nothing here is unreadable, so this
    should not hold the feature. If one thing is worth redrawing it is **Park** — not for
    light mode, where it reads, but because its baked plate makes its dark silhouette a filled
    tile among twelve open marks. Reach for **(a)** only if you look at Law and Stay on screen
    and dislike them.
- **D2: technique** → **(b) `<img>` + `filter: brightness(0) invert(1)` in dark** (resolved 2026-10-19, user).
- **D3 — which surfaces the hybrid applies to** → **only the three that draw a PLATE** (decided
  2026-10-19 during execution; flagged for review). ⚠️ **This narrows D2's blast radius from
  what the decision text implied**, so it is recorded rather than done quietly. "Circle-free"
  concerns marks that have a circle: `DivisionIcon .box`, `DivisionStrip .tileDisc` and
  `PopularShelf .art`. The four small inline marks — the Explore chip (17px), the result-card
  footer (22px), the offering cover and the searching overlay — **have no plate to remove** and
  are already monochrome *by deliberate design*: `booker/AGENTS.md` records that the Explore
  pill uses `currentColor` so the mark follows the chip's own selected/unselected colour, and
  swapping it for a full-colour image would fight the selected state. They keep `currentColor`
  in both themes. **Net effect: monochrome in dark everywhere, colour in light only where the
  mark is presented as a logo.** If you want colour on the chips too, that is a follow-up.
- *(options kept for the record)* — D2 (B2)
  - **(a) Mask + `currentColor`**, extending the technique the five mask surfaces already use.
    ⚠️ But `mask-image: url(...)` bypasses `next/image`, so the **raw 716 KB** EzzyRide PNG is
    fetched for a 17px chip mark. Other logos are 27–137 KB, so this is newly much worse.
  - **(b) `<img>` + `filter: brightness(0) invert(1)` in dark.** One element, no inline mask
    URLs, `next/image` keeps optimising, and it would let five components drop their mask
    machinery. **Rendered side by side, the two are visually indistinguishable** (verified
    2026-10-19 on ride / court / food).
  - **Recommendation: (b).** Same output, less machinery, and it fixes the 716 KB fetch for
    free. ⚠️ The cost is honest: it changes the technique on five working components, which is
    a wider blast radius than (a) — and `filter` yields pure white where `currentColor` yields
    `--db-strong`, a difference of about 4% luminance that no one will see but which will
    re-record every dark baseline either way.

---

## DEFERRED / COSMETIC

- **The 716 KB EzzyRide PNG itself.** `next/image` will resize it for `<img>` consumers, but it
  is still 716 KB in the repo and on any raw path. Worth re-exporting at 512px like its peers;
  not blocking, and it is the user's asset to replace.
- **`lib/palette.test.ts` does not cover mark contrast** — it asserts token *pairs*. The
  measurement in B3 is a script, not a test. Making it a test would need the canvas work to run
  under `node --test`, which this repo has no renderer for.
- **Harness F9** — the preview bar covers bottom-anchored chrome. Separate plan, still open.

---

## Execution order

1. **I1 — preview first.** It is the only non-production item, it is what D1 and D2 are decided
   *from*, and it costs nothing if a decision then changes.
2. **Resolve D1 and D2.** Hard gate: nothing below starts while either is OPEN.
3. **B1** — revert the self-backed treatment and re-apply measured sizing. Independent of the
   circle-free decision, but pointless to do twice, so it rides with B2.
4. **B2 + B3** — coupled, and must ship in one batch: the plate removal and the per-theme
   treatment are only safe together, and B3's answer may add a per-slug exception to the same
   rules.
5. **I2** — token cleanup, once B1 and B2 have removed the last consumers.
6. **I3** — fixtures and baselines last, so they record the settled state once.

---

## Verification

| Item | Check | Kind |
|---|---|---|
| B1 | `measure-division-marks.mjs` reproduces 1.67 / 1.13 / 1.10; no `ezzy-ride` overrides remain | machine |
| B2 | Every mark surface, both themes: colour in light, silhouette in dark | machine + human |
| B3 | Contrast re-measured per mark against the real background | machine |
| I1 | `shoot.mjs booker-ui` — 9 checks × 28 cells, 0 failures | machine |
| I2 | `grep -r` shows no consumer before deleting each token | machine |
| I3 | Full suite green; **each diff inspected**, not blanket-accepted | machine + human |
| all | `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run test:visual` | machine |

⚠️ **Do not pipe a Playwright run through `tail`** — it hides the failure count and the exit
code. Redirect to a file and read the summary.

⚠️ **Still owed from the predecessor plan and not re-verified here:** the shell's bottom
clearance and the safe-area inset (need a session / a device), and a real Supabase-backed cover
(needs staging).


---

## FINDINGS (execution, 2026-10-19)

### F1 — the dark flattening was applied unconditionally, and broke every mark on a tint  ✅ FIXED
`.db-mark` was put on `DivisionIcon`'s image for all five call sites at once. It is correct only
where the mark sits on the PAGE. `--division-tile` is declared in `:root` **only** and stays
light in dark mode, so on the two surfaces that still paint it — "Available today"'s fallback
cover and the photo badge — the result was a **white mark on a pale plate**, near-invisible.
Caught by reading the dark `opentoday` baseline before accepting it, which is exactly why the
plan said "each diff inspected, not blanket-accepted".

Fixed by making it **opt-in**: `flattenInDark` is passed by the three circle-free surfaces
(`DivisionStrip`, `ShelfCard`, `PopularCardRow`) and omitted by the two that keep a tint.

### F2 — the I1 badge lost the plate it depended on  ✅ FIXED
`OpenTodayCard`'s badge relied on `DivisionIcon`'s own box painting an opaque tint; circle-free
stopped that box painting anything, which would have left a bare mark on an arbitrary
photograph. The badge now paints `--division-tile` itself. **Circle-free is about the mark
presented as a logo; a stamp on someone's photo still needs something opaque behind it.**

### F3 — the measurement that called EzzyPark invisible was wrong  ✅ CORRECTED
Recorded in B3. Dominant-colour contrast measured Park's baked white plate rather than its red
glyph. Share-of-legible-ink is the honest metric. The plan, its recommendation and the preview
were all corrected before any code was written.

### F4 — the new EzzyRide is a solid-fill mark, not an outline  ⬜ NOTED, no action
Briefly misread as a stale image cache when the app drew it as a blue blob at 46px. It is not:
the raw file served matches disk and Next's image cache was empty. The asset is simply a
**solid-filled car silhouette** (like Pets' paw or Park's P) rather than the outline style of
Court or Drive, so it reads heavier than its neighbours at tile size. An asset-style
difference, not something CSS should correct.

### F5 — `next/image` is confirmed to be optimising the 716 KB PNG  ✅ VERIFIED
The D2 (b) rationale, checked rather than assumed: the rendered `src` is
`/_next/image?url=%2Fdivision-icons%2Fezzy-ride.png`, so the circle-free surfaces serve a
resized image. ⚠️ **The four inline mask marks still fetch the raw file** — they were left on
`currentColor` by D3, and `mask-image: url()` has no optimiser. Re-exporting the asset at 512px
(DEFERRED) would close that.
