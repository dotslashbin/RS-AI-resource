# booker-mobile-spacing-colours — visual preview

**Date:** 2026-10-23 · **Plan:** [`2026-10-23-booker-mobile-spacing-colours.md`](../../2026-10-23-booker-mobile-spacing-colours.md) · **Status:** for review before execution approval — **not an implementation.** No booker file has been changed.

Open [index.html](index.html) directly in a browser (no server). The **PREVIEW** bar picks a
screen and a theme; query parameters select a state, e.g. `index.html?screen=compare&theme=dark`.
Screens 2 and 3 follow the window width: narrow it below 640px for the phone layout.

> ⚠️ **Read this first: the "Current" frames are reconstructions, not screenshots.** They are
> rebuilt from today's stylesheet values (listed in `preview.css`) so that current and proposed
> come from one markup and differ only by the plan's rules. The real screens are the committed
> baselines `booker/visual-tests/pilot.spec.ts-snapshots/home-narrow-{light,dark}-chromium-linux.png`.
> Against those, the reconstruction measures **259px vs 257px** for the hero and **281px vs
> 280px** for the division widget. Close enough to compare; the 1–2px is the fallback font (see Limits).

## What it shows

| Screen | What to look at |
|---|---|
| 1 · Phone: current vs proposed (390px) | The two columns side by side, with a table measured **live** from them. Check the hero still reads as the page's lead, each label is closer to its own logo than to the next row, the heading is smaller, the sub-line is gone, the location chip is a smaller pill, and the next shelf rises by ~139px. |
| 2 · Current (reconstruction) | Today's values at the window's width. At 1280px it is the desktop grid. |
| 3 · Proposed | Same, proposed. **At desktop width only the label colour differs from screen 2.** Measured identical box sizes at 641px and 1280px. |
| 4 · Label colours and contrast | Each logo as it is actually displayed in the current theme, today's label colour and its ratio, the proposed label and its ratio. Dark is where today's labels fail (red ✗). Decision D1 at the bottom. |
| 5 · Narrow phone (320px) | Wrapping, truncation and the strip still scrolling rather than overflowing. Three columns visible instead of four; every division is still one swipe away. |
| 6 · Location chip, all three states (390px) | Added 2026-10-23. Unset, a city, and a long barangay + city. Proposed: a 32px pill with 12px text inside a 44px tap box (D3-A); the long name still truncates before **Change**. |

## Design fit

- **Label colour:** `var(--db-strong)` in both themes — booker's existing primary ink, `#0f172a`
  light / `#f1f5f9` dark. Light is a dark navy-slate, not any logo's colour. Dark follows the
  **displayed** logo, which is a **white silhouette** in every case: `DivisionStrip` passes
  `flattenInDark`, and `.dark .db-mark` is `brightness(0) invert(1)` (`booker/app/globals.css:495`).
  So there is no multicoloured artwork to pick a representative from in dark — the answer is
  white for all thirteen, unambiguously. The division brand colours (`--div-*-label`) stop being
  used for the label; the logos themselves are untouched.
- **Spacing:** every proposed rule sits inside the existing `max-width: 640px` blocks of the
  same three stylesheets, plus one `LocationChip` rule — no new breakpoint, no new component, no
  new token. In the preview those blocks are `@container` instead of `@media`, so a 390px frame
  can sit beside another on a desktop screen; same threshold, same values.
- **Heading 22px → 19px on a phone (plan I10):** still above the 15px section titles; desktop keeps 27px.
- **Sub-line hidden on a phone (plan I8):** `display: none` inside the 640px block; desktop keeps it.
- **Smaller location chip (plan I9, D3-A):** 6px transparent top/bottom border with
  `background-clip: padding-box` paints a 32px pill inside a box that stays `min-height: 44px`;
  the outline is an inset shadow at the pill's edge. Phone only (D4-A).
- Every tappable control in the preview is ≥44×44 (ux-design §5), asserted by the runner. The
  proposed tile measures **72 × 63**; the proposed chip **132 × 44** (unset).
- Both themes render from the same markup.
- **Additional packages required: none.**

## Limits

Static fixtures only: nothing is saved, no Supabase, no app imports, no network. The
`shoot.mjs` run asserts zero non-`file://` requests and fails if one is attempted.

- **Fonts are a fallback (Lato)** — the real app self-hosts Poppins through `next/font`, which
  cannot load offline. Poppins ExtraBold is wider: at 320px the real "What do you need today?"
  very likely wraps to two lines where the preview shows one, and the sub-line may break at a
  different word. Vertical metrics are driven by `font-size × line-height`, which the preview
  sets explicitly, so the measured savings carry over; the wrap points do not.
- **Only the hero, the division widget and the next shelf's header are drawn.** The shell (top
  bar, bottom tab bar), the in-progress strip and every shelf below are unchanged by the plan
  and left out.
- The search field, its find button and "Open Explore" are drawn as non-interactive spans, so
  the runner's 44px check speaks to the tiles and the location chip (a real `<button>`). ⚠️ The real find
  button is **36×36** — it already clears WCAG 2.2 AA's 24px minimum on purpose
  (`HomePage.module.css:215`), but not 44. Unchanged by this plan; recorded as finding P3.
- Hover lift, keyboard focus ring on the strip, the page-indicator live region and real touch
  scrolling are **not** simulated — checked in the real build (plan, Verification).
- Logos are 128px downscaled copies of `booker/public/division-icons/*.png` (originals untouched).

## Findings

- **P1 — preview tooling: `_shared/booker.css` predates the dark-mode lift.** Its dark surfaces
  are card 0.028 / sub 0.04 / page `#04060e…`; `booker/app/globals.css` has 0.055 / 0.05 /
  `#080c18…` since `.plans/2026-10-20-dark-mode-lift.md`. Any booker preview built today shows
  dark mode darker than the app. Worked around here with one scoped `.dark {}` block in
  `preview.css`; the shared file is **not** edited (out of scope for this task). *Preview-only;
  the real build is unaffected.* Left for the user to decide whether to resync.
- **P2 — today's dark labels fail AA on their real surface (plan F1).** Seven of thirteen
  measure **3.51–4.29:1** against the section body they sit on (10px bold text needs 4.5:1).
  `--div-*-label` was tuned against the page gradient, and the dark-mode lift then brightened
  the card under it; no test asserts the `-label` tokens at all. The proposed colour fixes all
  thirteen as a side effect (13.32:1). *The real build must resolve — this plan does.*
- **P3 — the hero's find button is 36×36** (see Limits). Pre-existing, deliberate per its own
  comment, out of scope. *Real app; not touched.*
- **P4 — Drive's mark reads small** next to its neighbours: its PNG fills only ~57% of its box
  (measured in `booker-ui`). Shrinking the invisible disc does not change it — the 32px art box
  is untouched. *Pre-existing; out of scope.*

## Regenerating

```bash
node .plans/previews/_shared/shoot.mjs booker-mobile-spacing-colours          # nine checks, no screenshots
node .plans/previews/_shared/shoot.mjs booker-mobile-spacing-colours --shoot  # + contact sheets
node .plans/previews/_shared/shoot.mjs booker-mobile-spacing-colours --shoot --full compare,chips,narrow,proposed,current,labels
node .plans/previews/booker-mobile-spacing-colours/narrow-check.mjs           # 320/360/390/641/1280 × both themes
python3 .plans/previews/booker-mobile-spacing-colours/contrast.py             # label contrast on the real surface
```

Last run 2026-10-23 (after I8–I10): **6 screens × 2 viewports × 2 themes = 24 cells, 9 checks,
0 failures**; `narrow-check.mjs` 30 cells, zero document overflow, zero clipped labels, zero
network requests, strip scrolls at every phone width, every chip inside the hero and hit by a tap
2px inside its top and bottom edge, desktop box sizes identical between variants.

The logo copies were made with booker's own `sharp` (no new dependency):
`sharp(src).resize(128,128,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}})` over
`booker/public/division-icons/*.png`.

What still needs the real build: Poppins wrap points, the chip's focus ring (it wraps the 44px box, not the 32px pill), the strip's hover lift and focus ring,
real touch scrolling, and the visual-suite baselines (plan, Verification).

See [screenshots.md](screenshots.md) for the contact sheets.
