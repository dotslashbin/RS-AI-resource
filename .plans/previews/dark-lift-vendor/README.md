# dark-lift-vendor — visual preview

**Date:** 2026-10-20 · **Plan:** [`2026-10-20-dark-mode-lift.md`](../../2026-10-20-dark-mode-lift.md) · **Status:** for review before execution approval — **not an implementation.**

Open [index.html](index.html) directly in a browser (no server). The **PREVIEW** bar picks a
screen and a theme; e.g. `index.html?screen=b&theme=dark`. Narrow the window below 640px for
the phone layout. Siblings: [`dark-lift-booker`](../dark-lift-booker/README.md) ·
[`dark-lift-vendor`](../dark-lift-vendor/README.md) · [`dark-lift-command`](../dark-lift-command/README.md).

> ⚠️ **Read this first: switch the theme to Dark.** Every screen renders the same markup and
> the options differ **only in dark mode**. In light, the four screens are identical on
> purpose — that is the proposal's "light mode unchanged" claim, shown rather than stated.
> The dashed box at the top of each screen is a preview annotation, not part of the design.

## What it shows

One screen, the vendor Dashboard — four stat cards, the Upcoming bookings table with status badges, the Walk-in booking form (inputs + `.sp-sub` summary) and a Notifications `.sp-panel`, under four dark palettes:

| Screen | What to look at |
|---|---|
| `current` · as shipped | Cards at 2.8% white: 1.05:1 against the page. Containers are borders only. |
| `a` · brighter base | Whole UI one step lighter, cards still translucent (1.08:1). Less black, barely more separation. |
| `b` · lifted containers — **recommended** | Page unchanged; sidebar, cards, panels opaque and lighter (1.13:1, panels 1.25:1). Do the cards now read as surfaces? |
| `c` · brighter base + lifted — **chosen 2026-10-21** | Slightly lighter page; cards are 5.5% see-through white (1.13:1, panels 1.29:1), so a card inside a card stays lighter than its parent (plan B1). |

## Design fit

- Tokens are vendor's own --sp-* set from `vendor/app/globals.css` via `tokens.css`; the options are
  `.dark [data-opt="…"]` override blocks in `preview.css` — **those blocks are the proposed
  values**, identical across the three previews except for the prefix.
- Components copied: `.sp-card`, `.sp-sub`, `.sp-input`, `.sp-panel`, `.sp-pill` and the `PVA.shell` sidebar/topbar from `_shared/vendor.js`. Badge colours are booker's `--st-*` pairs.
- Every tappable control is ≥44px (ux-design §5), asserted by the runner.
- **Additional packages required: none.** Token values only, plus removing a blur.

## Limits

Static fixtures only: nothing is saved, no Supabase, no app imports, no network. The
`shoot.mjs` run asserts zero non-`file://` requests and fails if one is attempted.

- Fonts are a fallback — vendor uses Inter. Letter shapes and spacing differ slightly.
- Near-black steps of 0.02–0.08 contrast render differently on OLED, LCD and in screenshots.
  Judge B vs C on a real display.
- Focus movement and live announcements are not simulated. Fixtures are invented.

## Findings

- **F1 — containers are invisible in dark today (real build).** Card/page 1.05:1, sidebar/page
  1.02:1, panel/page 1.05:1 — measured by `.plans/scripts/dark-lift-contrast.mjs`.
- **F2 — the three apps share one dark palette (real build).** Same values, three prefixes;
  any option is the same edit three times, which is why the plan treats it as one cross-app change.
- **F3 — mobile drift (real build).** `ezzy-vendor-mobile/src/theme/tokens.ts` ports these `--sp-*` values verbatim. Shipping this on web alone makes the two vendor clients differ in dark; plan DEFERRED.
- **F4 — `--sp-modal-bg` and `--sp-badge-bdr` move with the option (real build).** The modal is opaque on purpose; under B/C it becomes `#141c2e` / `#182136` so a sheet still reads above a lifted card. The badge ring tracks the card colour.
- **F-pv — `.pvb` outranks `.btn-primary` (preview-only, pre-existing in `_shared/chrome.css`).**
  Primary buttons rendered without their fill; restored locally in `preview.css`. Fixing it in
  `_shared/` would touch every preview, so it is recorded here instead.

## Regenerating

```bash
node .plans/previews/_shared/shoot.mjs dark-lift-vendor          # nine checks, no screenshots
node .plans/previews/_shared/shoot.mjs dark-lift-vendor --shoot  # + contact sheets
node .plans/scripts/dark-lift-contrast.mjs                     # the ratios quoted above
```

Last run 2026-10-21: 4 screens × 2 viewports × 2 themes = 16 cells, 9 checks, 0 failures.
Still needs a real build: real fonts, real data density, the `/ui-gallery` dark baselines.
