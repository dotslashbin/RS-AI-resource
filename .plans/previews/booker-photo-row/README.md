# booker-photo-row — visual preview

**Date:** 2026-10-30 · **Plan:** [`2026-10-30-booker-home-square-sidebar-carousel.md`](../../2026-10-30-booker-home-square-sidebar-carousel.md) (I5–I7, D5–D6) · **Status:** for review before execution. **This is not an implementation.**

Open [index.html](index.html) directly in a browser (no server needed). Narrow the window below
640px for the phone layout, which is where options A and B differ. Query parameters select a state,
e.g. `index.html?screen=fill&theme=dark`.

> ⚠️ **Read this first:** the photos are hand-drawn SVGs, and the cards are copies of booker's
> `OfferingResultCard` (Explore) and `OpenTodayCard` (Home "Available today"). Real fonts, real
> logos and real photos differ. The division logos are monograms (EC, EW, …).

## What it shows

| Screen | What to look at |
|---|---|
| 1 · Today | As shipped in 0.30.x. Phone: a 112px square sits at the **top** of a card about 150px tall, leaving an empty strip under the photo (the user's screenshot). Photos carry a division logo badge (Home) or the division pill and "No dates yet" (Explore). |
| 2 · Option A: fill | Phone: a **136px square fills the left side top to bottom**, and the card is that tall. Text rows are one line each, ellipsised when long. **Nothing on photos.** "No dates yet" moves beside the division label in the text. Cards **without** a photo keep the logo and pill. |
| 3 · Option B: stretch | Phone: the photo stays 112px wide and stretches to the card's height, so it fills the side but is a tall rectangle (112×130–136 here, taller when a name wraps). The text wraps as today. Desktop as option A. |

Desktop is the same in A and B: square covers as today, with the overlays removed from photos.

## Design fit

- Tokens are booker's own, via `_shared/booker.css`. The card metrics are copied from the two shipped `.module.css` files.
- A is CSS only: a fixed 136px first column, a 136px square cover, `white-space: nowrap` plus ellipsis on the text rows. B is CSS only: `aspect-ratio: auto` with stretch.
- Removing the overlays is a render change: the pill, badge and chip are drawn only when there is no photo, and "No dates yet" moves into the body.
- **Additional packages required: none.**

## Limits

Static fixtures only: nothing is saved, no Supabase, no app imports, no network. The
`shoot.mjs` run asserts zero non-`file://` requests and fails if one is attempted.

- Fonts are a fallback. The real 136px fit must be re-measured in the real build (Poppins).
- The slot line uses a calendar icon where booker uses a clock.

## Findings

- **F-a: A fits at 136px with these fixtures.** Measured at 390px: all 7 cards are 136px plus
  the border, and no text column overflows. The real build must re-measure with Poppins and long
  names. The plan item says how.
- **F-b: B is nearly square anyway** for one-line names (112×130 on Explore, 112×136 on Home).
  It only becomes a tall rectangle when a name wraps. A guarantees a square. B guarantees no truncation.
- **F-d (real build, 2026-10-30): F-a did not hold with Poppins.** In the real gallery the Explore text was
  140px and a wrapped Home slot line made 151px, so the strip came back. At 320px the Book button was
  pushed off. Resolved by plan D7 (trims on phones only): one-line slot, "No dates yet" in the category
  line's place, Book stepping aside through a container query, and a 124px photo at ≤360px. **This
  preview was not updated to those trims.** The plan items I5–I6 are the reference for what shipped.
- **F-c: Popular and Near you need nothing.** Neither draws anything on its photo, and Popular's
  96px square already fills its row (plan I2).

## Regenerating

```bash
node .plans/previews/_shared/shoot.mjs booker-photo-row          # nine checks, no screenshots
node .plans/previews/_shared/shoot.mjs booker-photo-row --shoot  # + contact sheets
```

Last run on 2026-10-30: 3 screens × 2 viewports × 2 themes = 12 cells, all nine checks, 0 failures.
