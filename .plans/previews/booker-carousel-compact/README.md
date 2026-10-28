# booker-carousel-compact — visual preview

**Date:** 2026-10-28 · **Plan:** [`2026-10-28-booker-carousel-compact-autoplay.md`](../../2026-10-28-booker-carousel-compact-autoplay.md) · **Status:** for review before execution approval — **not an implementation.**

Open [index.html](index.html) directly in a browser (no server). The **PREVIEW** bar picks a
screen and a theme; query parameters select a state, e.g. `index.html?screen=overlay&theme=dark`.
Narrow the window below 640px for the phone layout.

> ⚠️ **Read this first: autoplay runs only when you open the file.** Each screen advances one
> banner every 2 seconds (the plan's `autoplaySeconds: 2`, D4), wrapping from the last to the first.
> Hovering the carousel, focusing a control, or pressing pause stops it; pressing ‹ or › stops it
> for good. The contact sheets are shot with autoplay off, so they always show banner 1.

## What it shows

| Screen | What to look at |
|---|---|
| `current` | Today, for reference: two 44px round buttons and the dots in a row **under** the banner — 52px of page height (44px row + 8px gap). |
| `overlay` (A) | **0px added.** ‹ › sit on the artwork's side edges (desktop only); pause and the dots share a small pill, bottom centre, on the art. |
| `slim` (B) | **≈14px added.** Only the dots stay under the banner. ‹ › on the side edges (desktop only), pause alone in the top-right corner. |
| `corner` (C) | **0px added.** ‹, dots, pause and › in one pill in the bottom-right corner of the art, at every width. |

## Design fit

- Tokens are booker's own (`_shared/booker.css`). The banner box, radius, scroll-snap track and
  dots copy `booker/components/home/PromoCarousel/PromoCarousel.module.css` as of 2026-10-28.
- Icons are lucide's `chevron-left/right`, `pause`, `play` — the set booker already ships.
- Every control keeps a **44×44 hit area** (ux-design §5, asserted by the runner); only its visible
  face shrinks to 30px. That is how A–C save space without shrinking the touch target.
- On-art controls use a dark translucent scrim with white ink in **both** themes — they sit on
  artwork, not on the page, and the artwork does not change with the theme.
- **Additional packages required: none.**

## Limits

Static fixtures only: nothing is saved, no Supabase, no app imports, no network. The
`shoot.mjs` run asserts zero non-`file://` requests and fails if one is attempted.

- Fonts are a fallback, not self-hosted Poppins.
- The pause button and live text are sketched; focus movement and screen-reader output get
  checked in the real build (`visual-tests/promo.spec.ts`).
- Artwork is placeholder SVG; check real banners for text under the controls (F1).

## Findings

- **F1 — on-art controls cover artwork (A, C; B's pause only).** The banner spec's safe zone is
  72px/24px of the **canvas** — about 16px/5px on screen at 390px wide — so a 44px-tall pill on a
  206px-tall phone banner covers real artwork. A and C put it bottom-centre / bottom-right, where
  banners usually carry dates and venues. The real build must either update the banner spec in
  `booker/AGENTS.md` (a bigger safe zone where the controls sit) or pick B. *Real build.*
- **F2 — phones lose ‹ › in A and B.** They would sit over the artwork's headline; swipe,
  autoplay and the dots replace them. C keeps them at every width. *Design decision (plan D1).*
- **F3 — pause is required, not decoration.** Content that moves on its own for more than five
  seconds needs a way to pause it (WCAG 2.2.2), so every variant carries one. *Real build.*
- **F4 — autoplay must not announce.** A polite live region firing every second is noise; only a
  booker's own move is announced. *Real build (plan I3).*

## Regenerating

```bash
node .plans/previews/_shared/shoot.mjs booker-carousel-compact          # nine checks, no screenshots
node .plans/previews/_shared/shoot.mjs booker-carousel-compact --shoot  # + contact sheets
```

Last run 2026-10-28: 4 screens × 2 viewports × 2 themes = 16 cells, 9 checks, 0 failures.
