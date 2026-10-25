# booker-web-division-spacing — visual preview

**Date:** 2026-10-24 · **Plan:** [`2026-10-24-booker-banner-carousel.md`](../../2026-10-24-booker-banner-carousel.md) → I9 · **Status:** for review before approval. **This is not an implementation.**

> ⚠️ **Read this first: both columns are reconstructions.** "Current" copies
> `booker/components/home/DivisionStrip/DivisionStrip.module.css` and
> `HomeSection.module.css` as they stood on 2026-10-24. "Proposed" differs **only** by the
> `[data-variant="proposed"]` block in `preview.css`, so that block is exactly the change the plan
> proposes. The real screen is the committed baseline
> `booker/visual-tests/pilot.spec.ts-snapshots/home-light-chromium-linux.png`. The banner under the
> widget is the carousel preview's labelled placeholder, shown for context only.

Open [index.html](index.html) directly in a browser, with no server. The PREVIEW bar switches
screen and theme. The figures in the table are measured from the rendered frames.

## What it shows

**Revised 2026-10-24** after review: "still a lot of space", meaning the label should be closer and the icons closer side by side, and fewer on the second row is fine. The first version (56px box, 128px columns) is superseded. Two tighter options are shown instead.

| Screen | What to look at |
|---|---|
| `compare` · current, A, B | The widget three times at full web width, with a measurement table on top. In both options the label sits right under its logo, and the logos are unchanged at 46px. **A** has 88px columns (10 per row, 3 on the second). **B** has 68px columns (all 13 on one row). At phone width all three are identical, which proves the phone layout is untouched. |
| `widths` · A and B at 700 and 900px | How each option wraps just above the 640px breakpoint. At 700px, A leaves "Law" alone on a third row, while B wraps 8 + 5. |

**Measured at 1280px (both themes):**

| | Current | A | B |
|---|---|---|---|
| Logo → label | 31px | 8px | 8px |
| Logo | 46×46 | 46×46 | 46×46 |
| Logo to logo | 144px | 101px | 77px |
| Per row | 7 + 6 | 10 + 3 | 13 |
| Tile tap target | 132×121 | 93×76 | 69×76 |
| Widget height | 349px | 251px | 163px |

## Design fit

- **This takes the phone change of 2026-10-23 further:**
  - The invisible box around each logo is shrunk to hug it (84 → 48px).
  - The gap under the logo goes 9 → 4px.
  - The divisions body padding is tightened for the divisions tone only.
  - The column minimum is narrowed (128 → 88px or 68px), and the column gap goes 12 → 8px.
  - The logo is never resized.
- **No new tokens.** It is a CSS-only change to `DivisionStrip` and `HomeSection`, with the render, hook and style split unchanged. Every tile stays ≥ 44×44.
- **Additional packages required: none.**

## Limits

Static fixtures only: nothing is saved, no Supabase, no app imports, no network. The
`shoot.mjs` run asserts zero non-`file://` requests and fails if one is attempted.

- Fonts are a fallback, not Poppins, so label metrics differ slightly from the real app. The visible gap is measured to the label's text and allows for line spacing.
- The hover lift (2px) is not simulated. 4px of top padding is kept to make room for it.
- On a phone the "tiles per row" row counts the tiles in the scrolling row, not the ones visible on screen.

## Findings

- **F1 · option A only.** At 700px, A wraps 6 + 6 + 1, leaving "Law" alone on a third row. Today's layout leaves a lone tile at that width too (4 + 4 + 4 + 1). B wraps 8 + 5 there, which is one reason it is recommended.
- **F2 · real build must handle it.** Every desktop Home baseline (`home-*`, `homenear-*`, `homesearching-*`, `homepromo-*`, `divisions-*`) will change and needs re-recording and review. The `*-narrow-*` phone baselines must **not** change, which is the build's proof that the phone layout is untouched.

## Regenerating

```bash
node .plans/previews/_shared/shoot.mjs booker-web-division-spacing          # nine checks
node .plans/previews/_shared/shoot.mjs booker-web-division-spacing --shoot  # + contact sheets
```

**Last run 2026-10-24:** 2 screens × 2 viewports × 2 themes = 8 cells, 9 checks, 0 failures, 4
contact sheets. Inspected by eye in both themes at both widths. **Still needs the real build:**
Poppins metrics, the hover lift, and the baseline re-record described in F2.
