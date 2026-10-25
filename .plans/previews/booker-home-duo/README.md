# booker-home-duo — visual preview

**Date:** 2026-10-24 · **Plan:** [`2026-10-24-booker-banner-carousel.md`](../../2026-10-24-booker-banner-carousel.md) → I11, I12 · **Status:** for review before approval. **This is not an implementation.**

> ⚠️ **Read this first: these are reconstructions.** "Now" copies booker's module CSS as of
> 2026-10-24, **including the rebuilt I9** (centred rows of at most seven 72px tiles), which is in
> the code but not yet re-verified against baselines. "Proposed" differs only by the
> `PROPOSED` block in `preview.css`. Booking rows are invented. The banner is a labelled
> placeholder.

Open [index.html](index.html) directly in a browser, with no server. The PREVIEW bar switches
screen and theme. The grey line above each proposed frame is **measured live**.

## What it shows

| Screen | What to look at |
|---|---|
| `desktop` · now vs proposed | **I11:** from 1024px, "Browse by division" takes 2/3 of the row and "Book again" moves up beside it in the remaining 1/3. Both cards are the same height, and the 2/3 column still fits the centred 7 + 6. **Measured:** 681 \| 341px split, 294 / 294px heights. |
| `states` · 1 row, no history, 900px | One Book again row: the cards are still the same height (251 / 251px). No history: divisions takes the full width, with no empty third. 900px: the two stack, with Book again directly under divisions. |
| `phone` · 4 vs 5 per page | **I12:** five columns per page instead of four (three at 320px today). **Measured:** 60px tiles at 390px and 46px at 320px, 5 visible at both, 0 labels clipped. Book again also moves up under divisions on a phone. |

## Design fit

- **I11:**
  - **Wrapper:** a `.duo` wrapper in `HomePage`, laid out with flex. Stacked by default, side by side from 1024px, with `.duoSide:empty { display: none }`. The empty case needs no new logic: `BookAgainCard` already returns `null` without history.
  - **Equal heights:** two lines in `HomeSection.module.css`, a flex-column `.section` and `.body { flex: 1 }`. They do nothing wherever a section is not stretched.
  - **Header:** the "Things you have booked before" line is hidden in the 1/3 column, where it would crowd the title.
- **I12:**
  - **Columns:** `grid-auto-columns: calc((100% - 4 * 6px) / 5)` with a 6px column gap. That gives exactly five per page at any phone width, and tiles stay at least 44px at 320px.
  - **Tile width:** the phone rule must set `.tile { width: auto }` to undo I9's fixed 72px (F1).
- **Tokens:** no new tokens. Every tile and row stays at least 44px.
- **Additional packages required: none.**

## Limits

Static fixtures only: nothing is saved, no Supabase, no app imports, no network. The
`shoot.mjs` run asserts zero non-`file://` requests and fails if one is attempted.

- Fonts are a fallback, not Poppins. Label and row widths differ slightly from the real app.
- The division badge in Book again is approximated as a code chip.
- Sideways scrolling on the phone strip is not exercised. The frames show the first page only.

## Findings

- **F1 · real build must resolve.** I9's web rule gives each tile a fixed `width: 72px`. In the 5-up phone grid that would overflow the narrower column and overlap the next tile ("Learn" was clipped at 320px in the first render of this preview). The phone block needs `.tile { width: auto }`.
- **F2 · decision.** With one page order for every width, Book again also moves up on a **phone**, from after "Available today" to directly under divisions, above the promotions. The plan raises this as part of D6.
- **F3 · real build must handle it.** Baselines that will change: the desktop Home ones (`home`, `homenear`, `homesearching`, `homepromo`) and the phone `home-narrow` / `homepromo-narrow`. `bookagain-*` should not change, because `HomeSection`'s flex column is a no-op when it isn't stretched.

## Regenerating

```bash
node .plans/previews/_shared/shoot.mjs booker-home-duo          # nine checks
node .plans/previews/_shared/shoot.mjs booker-home-duo --shoot  # + contact sheets
```

**Last run 2026-10-24:** 3 screens × 2 viewports × 2 themes = 12 cells, 9 checks, 0 failures, 4
contact sheets. Inspected by eye in both themes. **Still needs the real build:** Poppins metrics,
phone scrolling and snap with 5-up columns, and the baseline re-record in F3.
