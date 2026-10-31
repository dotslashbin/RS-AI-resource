# offering-photo-square — visual preview

**Date:** 2026-10-30 (rescoped the same day: Explore cards only) · **Plan:** [`2026-10-30-booker-offering-photo-square.md`](../../2026-10-30-booker-offering-photo-square.md) · **Status:** for review before execution approval. **This is not an implementation.**

Open [index.html](index.html) directly in a browser (no server needed). The **PREVIEW** bar picks a
screen and a theme. Query parameters select a state, e.g. `index.html?screen=square-2up&theme=dark`.
Narrow the window below 640px to see the phone layout. That is where options A, B and C differ.

> ⚠️ **Read this first: what changes and what does not.** Only `OfferingResultCard` changes: the
> service card in Explore's results, which the Vendor page's service grid also uses. The offering
> page, the Home cards and the booking modal keep their current photo shapes.
>
> The "photos" are drawings, and they are drawn to be cropped badly. Each SVG in `./photos/` puts
> its subject near an edge on purpose, so a crop is obvious. Read screen 5 as the worst case.

## What it shows

| Screen | What to look at |
|---|---|
| 1 · Today | Explore's results grid as it ships: a 118px band on every card. Desktop fits three cards of about 306px, so each cover is cropped to roughly 2.6:1. On a phone it is about 3:1. |
| 2 · Option A: square, one column on a phone | Square cover. On desktop each cover becomes about 306×306, so cards are about 190px taller. On a phone each card is a full-width 358px square plus its text, so about 1.3 cards fit on the first screen. |
| 3 · Option B: square, two columns on a phone | Desktop is the same as A. On a phone there are two cards per row with about 171px squares. The name/price line stacks, and the vendor line truncates. |
| 4 · Option C: square thumbnail row on a phone | Desktop is the same as A. On a phone each card becomes a row: a 112px square on the left and the text on the right. Five or six results fit on the first screen. |
| 5 · Cover vs contain | Three upload shapes (3:2, 4:5, 1:1) in a square card. Top row: `cover` (crop, as today). Bottom row: `contain` (the whole photo on the division tint). |

All four layouts include the no-photo placeholder (Drive, Other) and the "No dates yet" chip
(Van rental), so you can check those states in each one.

## Design fit

- Card metrics, colours and structure are copied from `OfferingResultCard.module.css`. The grid
  is Explore's `.serviceGrid` (`ExplorePage.module.css:246`, `auto-fill, minmax(230px, 1fr)`) in a
  980px page.
- The square uses CSS `aspect-ratio: 1 / 1` on `.cover`. No JavaScript measuring and no new component.
- Options B and C need phone-only CSS rules for the card. Option C also changes the card's
  direction to a row, which is a larger CSS change than A or B.
- Every tappable control is at least 44px (ux-design §5), which the runner asserts.
- Both themes render from the same markup.
- **Additional packages required: none.**

## Limits

Static fixtures only: nothing is saved, no Supabase, no app imports, no network. The
`shoot.mjs` run asserts zero non-`file://` requests and fails if one is attempted.

- The division marks are monograms (EC, EP, …), and the Ezzy mark is a blue "E" tile. The real
  card paints the logo files through a CSS mask. The size and position match, but the artwork does not.
- Fonts are a fallback. The real app self-hosts its font family through `next/font`.
- Focus movement and live announcements are **not** simulated.
- Fixture values are invented. They are not seeded data.

## Findings

- **F1: on a phone, a full-width square makes each card about 3× taller than today.** Real build
  must resolve. This is a design decision (plan D1): the options are A, B and C.
- **F2: a square crops the edges of non-square uploads.** This is a design decision (plan D2). The
  vendor upload editor gives no framing hint, which is a vendor-side follow-up out of scope here.
- **F3: the no-photo placeholder grows with the cover.** In a square, the centred Ezzy mark and
  division mark sit in a lot of empty tint (Drive and Other on screens 2–3). It is acceptable, but
  the marks could be larger (plan D3).
- **F4: the division pill on the cover nearly disappears over a photo in dark mode.** This is an
  existing problem in the shipped code, made more visible by a bigger photo. `.division` uses
  `--db-card-bg`, which is `rgba(255,255,255,0.055)` in dark mode (`OfferingResultCard.module.css:50–57`).
  Fixed in this plan (D4, decided 2026-10-30): the square screens draw the pill on the division tile, and screen 1 keeps the shipped pill for comparison.
- **F5: the cover pill repeats the division footer.** Both show the division name. With a square
  cover, the card is tall enough that the duplication is noticeable. Recorded only.

## Regenerating

```bash
node .plans/previews/_shared/shoot.mjs offering-photo-square          # nine checks, no screenshots
node .plans/previews/_shared/shoot.mjs offering-photo-square --shoot  # + contact sheets
```

Last run on 2026-10-30 after the rescope: 5 screens × 2 viewports × 2 themes = 20 cells, all nine
checks, 0 failures. Contact sheets are committed next to this file. The real build still needs to
check real fonts, real vendor photos, and the `resultcard` / `resultcardunbookable` ui-gallery baselines.
