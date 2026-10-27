# booker-home-divisions-layout — visual preview

**Date:** 2026-10-25 · **Plan:** [`2026-10-25-booker-home-divisions-layout.md`](../../2026-10-25-booker-home-divisions-layout.md) · **Status:** for review before execution approval. **This is not an implementation.**

> ⚠️ **Read this first: what is real here.**
> - The **current** screen and every "current" frame are a **reconstruction** of Booker's Home,
>   rebuilt from its module CSS as of 2026-10-25. The real screens are the committed baselines
>   `booker/visual-tests/pilot.spec.ts-snapshots/homepromo-*.png`.
> - The **promotional carousel is the shipped `PromoCarousel`**, drawn static here with the
>   banner-carousel preview's labelled placeholder artwork. Nothing about it changes except where it sits.
> - **Fonts are a fallback** (the preview CSP has no `font-src`, so Poppins cannot load). Pixel gaps
>   measured here are therefore calibrated against the real baselines. See "Spacing" under Findings.
> - "Near you" and "Available today" are empty stubs. They are there only to show the order.

Open [index.html](index.html) directly in a browser (no server needed). The **PREVIEW** bar picks a
screen and a theme. Narrow the window below 640px to get the phone rules. Query parameters
select a state, e.g. `index.html?screen=divisions&theme=dark`.

**Try it:** on the phone layout, swipe the division row, or Tab into it and use ← →. Tab walks
all 13 tiles and scrolls each one into view. Tiles don't navigate in the preview: the line at the
bottom prints what the app would do.

## What it shows

| Screen | What to look at |
|---|---|
| `current` · Current Home (reconstruction) | Today's order: search → In progress → **divisions** (+ Book again) → **promotions** → the rest. Light shows the marks in their own colours with `--db-strong` labels. |
| `proposed` · Proposed Home | The new order, marked by numbered notes: **search → promotions → divisions** → the rest, with one carousel. Light shows every mark and label in **#034afc**. Dark keeps today's colours. On a phone the divisions are **one row**: the sixth tile is cut at the edge, and the page dots stay. |
| _(phone frames, all screens)_ · scroll hint | **Preview-only callout, added 2026-10-25:** a dashed bracket over the half-cut tile, plus a "Preview note" under the dots. Neither ships. The design's hint is just the half tile and the dots (plan D6-A). |
| `divisions` · Close-up | Desktop current vs proposed: the same 7 + 6 centred wrap, with only the colour changed. Three 390px phone frames: current (two rows), proposed at the start, and proposed **scrolled to the end**, where **Law** (the 13th) is fully visible. |
| `widths` · 320 / 360 / 390 / 640 / 768 | The top of the proposed Home in each frame, with live measurements (rows, narrowest tile, scrolls or fits). Frames ≤640px are one row. The 768px frame keeps the wrapping rows, with Book again stacked under the divisions. |
| `again` · Book again header | Added 2026-10-25 at your request. It shows today's brown header accent next to three yellows: **A Amber**, **B Gold**, **C Honey**, then three greens (**A Emerald**, **B Leaf**, **C Soft forest**), and from 2026-10-26 three lighter blues (**D Sky**, **E Cornflower**, **F Powder**). The amber and gold rows were later removed. Compare the blues against the divisions header beside them, which is already blue. Each one has a separate light and a dark value. Only the pipe, wash and arcs change; the title text stays the page ink. The pipe's contrast against the card is printed live under each option. |
| `icons3d` · 3D icon sheet | **Exploration, added 2026-10-26.** One matte, soft-3D object icon per division, Uber-style, with no gloss. **Mono** is blue `#034afc` on the light page and the lighter blue `#93b4ff` on the dark one (white until 2026-10-26), so switch the theme to see both. **Brand** uses each division's logo colour. Generated stand-ins, not production art (plan I8). |
| `icons3d-strip` · 3D icons in place | The same set in "Browse by division" at 46px (desktop) and 32px (phone), for both colourways. Check what survives at 32px. |
| `d9` · D9 choices | Added 2026-10-26. Four options, each showing "Browse by division" plus sample "Near you" shop cards (a schematic ShelfCard with its 44px mark): **A** 3D everywhere in blue (dark `#93b4ff`), **A** 3D everywhere in brand colours, **B** today's PNG logos, **C** 3D in the strip only. Switch the theme for dark. |
| `darkblue` · Logo blues, light and dark | Added 2026-10-26 (D14); lighter shades added the same day. The approved plan (light `#034afc`, dark white) next to **A** `#034afc`, **B** `#4f7dff`, **C** `#7aa2ff`, **D** `#93b4ff` and **E** `#b3cbff`. Each option uses one blue in both themes, shown on desktop and phone. Labels stay black in light and white in dark. The logo's contrast prints live for both themes. |
| `fullpage` · Full Home, D14-F | Added 2026-10-26. The whole proposed Home with no preview notes. Light: logos `#034afc`, labels black. Dark: logos in a lighter blue, labels white. Buttons above the page switch the dark blue between **C** `#7aa2ff`, **D** `#93b4ff` (default) and **E** `#b3cbff`. The Book again header is powder blue (D7b). |
| `fullpage-3d-brand` / `fullpage-3d-mono` · Full Home with 3D icons | Added 2026-10-26. The same clean full page as `fullpage`, with the strip's marks swapped for the 3D set, **30% bigger**: 60px desktop (was 46) and 42px phone (was 32). A further +5% was tried and reverted. The tile disc grows to match. Brand colours first, then blue, which is `#93b4ff` in dark. The shop cards are stubs here (screen `d9` shows marks on cards). |
| `fullpage-3d-phones` · Full Home on a phone | Added 2026-10-26. Both 3D colourways as full pages in 390px phone frames, side by side. The icons are 42px. Switch the theme for light and dark. **Sharpened 2026-10-26:** outline and detail strokes are set in screen pixels (`vector-effect: non-scaling-stroke`; 0.75 / 1.25 / 1.5px) instead of viewBox units, which came out at 0.6–0.9px. The Care cross arms are thicker, and on all three 3D full-page screens the label sits 2px closer (tile gap 2 → 0). |
| `court` · Court icon, pick a look | Added 2026-10-26; reworked the same day after the user said the redrawn basketball (v2) was "not there yet". Four alternatives in the same matte style: **A** tennis ball (one wrapping seam), **B** pickleball (13 holes, fewer than a real ball, so they survive 42px), **C** shuttlecock, **D** a small court slab with lines and a ball. Each is shown at blue 84/60/42px and brand 60/42px, then in the phone strip. **A was chosen on 2026-10-26, then replaced the same day by E, a pickleball paddle** (a tilted rounded face with a visible thickness, a wrapped grip, and a small holed ball so it reads as pickleball, not table tennis). E is now the Court icon on every 3D screen. **2026-10-27:** the paddle face was lightened (the light tone) and its outline made one colour, the main blue, at the user's request ("a bit too dark"). The grip and ball are unchanged. This screen keeps A–D and v2 for the record. |
| `colour` · #034afc | The swatch, the computed contrast and all 13 marks (shipped vs proposed). Switch to dark to see that the proposal leaves dark unchanged. **Park is flagged (F3).** |

## Design fit

- **Tokens:** booker's own (`tokens.css`). The new value is one literal, `#034afc`, scoped to the
  division strip in light mode. It is not a theme token, and nothing else on Home changes colour.
- **Recolouring technique (plan D1): an SVG filter on the existing `<img>`.** One hidden
  `<svg><filter id="division-strip-ink" color-interpolation-filters="sRGB"><feFlood/><feComposite in2="SourceAlpha" operator="in"/></filter></svg>`
  per strip, plus `filter: url(#division-strip-ink)` on the strip's marks in light mode. `feFlood`
  paints the colour, and compositing with `SourceAlpha` keeps each mark's own alpha. Shapes,
  holes and transparent padding are all preserved, and opaque pixels come out exactly #034afc.
  `flood-color` is set from CSS, so the hex stays in the stylesheet. This is the same idea as
  `.dark .db-mark { filter: brightness(0) invert(1) }`, which `globals.css` chose **over** a CSS
  mask because a mask bypasses `next/image` and downloads the raw PNGs (`ezzy-ride.png` is 716 KB).
  The filter runs on the already-optimised image. **CSS `color` does not recolour an `<img>`;** the
  preview does not rely on it.
- **Dark:** untouched. It keeps `.db-mark`'s white silhouette and `--db-strong` labels, and
  `measure.mjs` asserts the computed styles match the current tile.
- **Phone strip:** the existing `DivisionStrip` grid with `grid-template-rows: auto` (one row) and
  `5.5` tiles per page instead of 5. The half tile at the edge is the affordance. The existing dots and
  live region come from the unchanged `useDivisionStrip` hook. It is native `overflow-x` with no
  `touch-action` override, so a vertical swipe still scrolls the page. It does not rotate on its own.
- **Order:** `HomePage.tsx` moves `<PromoCarousel>` above the divisions/Book-again pair. The same
  component and the same props, so there is still only one carousel.
- **Additional packages required: none.**

## Limits

Static fixtures only: nothing is saved, no Supabase, no app imports, no network. The
`shoot.mjs` run asserts zero non-`file://` requests and fails if one is attempted.

- The page is a reconstruction. `next/image`, the real hook and the real carousel are not running.
- **Fallback fonts:** gap figures are offset by about 1px from the app (see Findings F1).
- The logos are 128px copies made by `build-logos.mjs` from `booker/public/division-icons/`. The
  originals are only read.
- **Not verified here:** Safari/iOS rendering of a CSS `filter: url(#…)` on an `<img>`, real touch
  swiping, and screen-reader output. Each one is a staging check in the plan.

## Findings

Each finding is also in the plan, under the same number.

- **F1 · Spacing: desktop is already at target, the phone is not (real build must re-measure).**
  Measured from **pixels** (lowest ink row of the mark to the first ink row of the label) on the
  committed baselines: desktop **9–11px, median 10**. Phone **14–15px**. The same method on this
  preview reads desktop median 11 and phone median 13, so the preview runs about +1px on desktop
  and −1px on the phone because of the fallback font. The proposal therefore **leaves desktop
  geometry alone** and changes the phone only: the disc keeps its 44px width (the tap target) and
  its height drops from 44 to **36px**, removing 4px of empty box under every 32px mark. The preview
  measures phone median **9px** with that change, which is about **10px** in the app after
  calibration. The plan's build stage re-measures this on gallery screenshots and tunes the height ±2px.
- **F2 · Work is an outlier because of its asset.** `ezzy-work.png` is 14.5% transparent below its
  ink. It is a wide mark letterboxed in a square, so it reads **15px** on desktop and about 13px on
  the phone, whatever the CSS gap is. Law (7.8% transparent below the ink) reads 13px on desktop.
  These are accepted in the preview. The plan's D4 offers a per-mark nudge instead.
- **F3 · Park gains a visible frame in light.** 59% of `ezzy-park.png`'s opaque pixels are
  near-white: a white rounded square behind the red P. It is invisible on today's light page, so the
  label looked 19px away. Any single-colour recolour, including this one, draws that square in blue.
  The mark becomes **a blue framed P**, which is exactly what dark mode already shows in white.
  Shape is preserved, but the light-mode look changes. Flagged for your decision. The original asset is not touched.
- **F4 · Contrast:** #034afc measures **5.92:1** on the light section body (`#f8fafc`) and **6.20:1**
  on white, which passes WCAG AA for the 10–12px labels. The requested blue is used as is.
- **F5 · Exact colour:** of the blue-dominant mark pixels at 2×, **59.7% are exactly (3, 74, 252)**.
  A further 20% are within ±2: near-opaque pixels, which the 128px → 64px resampling leaves
  slightly translucent. The rest are antialiased edges blended with the background. Labels compute
  to exactly `rgb(3, 74, 252)`.
- **F6 · Preview tooling, not fixed here:** `_shared/booker.css:107` still sets `Lato` as booker's
  family. Booker moved to Poppins (plan 2026-09-29). Shared tooling is out of scope for this task.
- **F7 · "Book again" accent: today's brown fails in dark, and yellow needs a separate value per theme.**
  The brown, `--div-ezzy-work-deep` `#8e4301`, is a single value for both themes. Its pipe measures **7.11:1 on light but 2.36:1
  on dark**, below the 3:1 a visible marker should have. The yellow options, pipe contrast against the card (light / dark):
  **A Amber** `#d97706` / `#fbbf24`: 3.19 / 10.06 · **B Gold** `#ca8a04` / `#facc15`: **2.94** / 10.96 (under 3:1 in light) ·
  **C Honey** `#b7791f` / `#f2c14e`: 3.64 / 10.00. Pure yellow is too pale to show on a white card, so the light values are
  deliberately deeper. Note that booker already uses amber `#f59e0b` for the *pending* booking status (dark
  `--st-pending-fg`). These options sit close to it, but a header pipe is unlikely to be read as a status.
  **Chosen 2026-10-25: C Honey** (plan D7), then **replaced the same day by a request for green** (plan D7b, open).
  The greens' pipe contrast against the card, light / dark: **A Emerald** `#047857` / `#10b981` (booker's own
  `--st-confirmed-fg`), 5.48 / 6.62 · **B Leaf** `#15803d` / `#4ade80`, 5.02 / 9.63 · **C Soft forest** `#3f7d3a` / `#86c97f`,
  4.99 / 8.53. All three clear 3:1 in both themes. The `proposed` and `widths` screens draw A, the recommendation;
  Honey stays on the `again` screen for comparison.
- **F8 · Amendments 2026-10-26 (plan I7):** desktop rows are left-aligned, with both rows starting at x = 161 at 1280px. Labels are **black in light** (`rgb(0, 0, 0)`, 19.6:1) and unchanged in dark. The gap is tighter: preview medians are desktop **8px** (was 11) and phone **6px** (was 9), which is about 7px at both widths in the app (F1 offset).
- **F9 · 3D brand colourway in dark:** Food (black), Home (`#1b252e`), Care (`#0b2d85`) and Learn (`#025847`) sink into the dark card at their true brand colour, so the preview lifts them to mid tones in dark. A production set would need the same per-theme treatment. Mono avoids the problem entirely.
- **F10 · 3D icons are generated, not drawn.** `icons3d.js` builds each icon from isometric boxes, cylinders and discs with flat tone classes. That keeps the 13 consistent and lets each colourway be pure CSS, but the forms are blockier than hand-drawn art. Judge the direction (objects, matte, colourways, 32px legibility), not the exact shapes.
- **Heading check:** the search heading is **"What do you need today?"** and the section is
  **"Browse by division"**. Neither is renamed.

## Regenerating

```bash
node .plans/previews/booker-home-divisions-layout/build-logos.mjs          # re-copy the 13 marks (reads booker/public only)
node .plans/previews/_shared/shoot.mjs booker-home-divisions-layout          # nine checks
node .plans/previews/_shared/shoot.mjs booker-home-divisions-layout --shoot  # + contact sheets
node .plans/previews/booker-home-divisions-layout/measure.mjs                # gaps, colour, dark parity, strip, order, widths, row alignment
```

**Last run 2026-10-26.** `shoot.mjs`: 8 screens × 2 viewports × 2 themes = 32 cells, 9 checks, 0
failures, 4 contact sheets. `measure.mjs`: all assertions passed:

- **A, gap (px), re-run 2026-10-26:** desktop current 9–19 (median 11) → proposed 6–12 (median **8**). Phone current 13–20 (median 13) → proposed 6–10 (median **6**). Both themes. In the app these are about 7px at both widths (F1 offset).
- **G, rows:** desktop 7 + 6, with both rows starting at the same x, in both themes.
- **B, light:** the label is `rgb(0, 0, 0)` (black, since 2026-10-26) and the mark filter is `url("#division-strip-ink")`. Mark pixels are as in F5.
- **C, dark:** proposed = current: `rgb(241, 245, 249)` with `brightness(0) invert(1)`.
- **D, phone:** 13 tiles in 1 row, and the strip scrolls. Law is fully visible at the end. The cut tile at the edge is Food. The page does not overflow. ArrowRight on the focused strip scrolls it, and Tab reaches 13/13 tiles, each scrolled into view.
- **E, order:** at 1280 and 390 the proposed order is search → In progress → promos → divisions → rest, with exactly one carousel.
- **F, widths:** at 320 / 360 / 390 / 640 there is 1 row, with the narrowest tile 44 / 48 / 53.5 / 98.9px. At 768 the tiles wrap into rows. In both themes no tile is under 44×44, no label is truncated, and the page does not overflow.

**Still needs the real build:** Poppins metrics, `next/image` output, Safari/iOS filter rendering,
real touch scrolling, focus rings on a real device, and screen-reader output.
