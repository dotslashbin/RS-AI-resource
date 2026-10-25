# booker-banner-carousel — visual preview

**Date:** 2026-10-24 · **Plan:** [`2026-10-24-booker-banner-carousel.md`](../../2026-10-24-booker-banner-carousel.md) · **Status:** for review before execution approval. **This is not an implementation.**

> ⚠️ **Read this first: what is real here.** Only the banner block (`.pc*` in `preview.css`) is
> the proposal. The hero, the division shelf and the "Near you" stub around it are a
> **reconstruction** of Booker's Home from its module CSS as of 2026-10-24. Compare them with the
> committed baselines (`booker/visual-tests/pilot.spec.ts-snapshots/home-*.png`), not with this page.
> The artwork is an **illustrative placeholder** (the image itself says so), and every destination
> is an `example.com` placeholder. No real partner images or URLs were available.

Open [index.html](index.html) directly in a browser (no server). The **PREVIEW** bar picks a
screen and a theme. Query parameters select a state, e.g. `index.html?screen=states&theme=dark`.
Narrow the window to see the phone layout. The carousel itself has no breakpoint (plan D2), so
only the page around it changes at 640px.

**Try it:** swipe the banner on a touch device or trackpad, press ‹ ›, or Tab to the banner and
press ← →. Clicking a banner **does not navigate**: the line under the page prints the URL it
would open, in which tab, and with which `rel`.

## What it shows

| Screen | What to look at |
|---|---|
| `home` · Home: the carousel under "Browse by division" | Placement directly after the division shelf, at Home's 1080px content width and 18px section gap. Slides move. The controls row sits **under** the artwork, so ‹ › never cover it. On a phone, check that the banner (348×116 at 390px) adds less height than the division shelf. |
| `widths` · 320 → 1080 | The same component in 320 / 360 / 390 / 768 / 1080px frames. The heights are **measured live** from the rendered box. One 3:1 ratio throughout, with no height jump at any width. On a narrow window the wide frames shrink to fit, and the numbers follow. |
| `states` · zero, one, many, failed, off-ratio | **0** renders nothing. **1** is a plain linked banner with no controls. **12** turns the dots into a "1 / 12" counter. **Image failed** keeps the box and shows the alt text as a working link. **Off-ratio** artwork (4:3) is letterboxed, never cropped. **Autoplay** is a static mock of the control row if D1 goes the other way. |
| `links` · destinations | The example JSON as a table: each banner's id, accessible name, `href`, tab behaviour and `rel`. The JSON is printed with the app's own `/promos/…-v1.jpg` paths. |

## Design fit

- **Tokens:** booker's own (`_shared/booker.css` → `tokens.css`). Track `--db-sub-bg` + `--db-card-border`; controls `--db-card-bg` / `--db-strong`; active dot and focus ring `--db-toggle-on`; inactive dot 75% `--db-text` (F3).
- **Radius 10px.** Home allows exactly two radii, 18px for the hero and 10px for sections (`HomePage.module.css:4`, plan D27 of the redesign). This adds no third.
- **Indicator** copies `DivisionStrip`'s (`DivisionStrip.module.css:262–283`): the active dot widens, so position is not carried by colour alone. Dots are `aria-hidden` and a polite live region carries "Promotion 2 of 3", the same split DivisionStrip uses.
- **Scrolling** copies `DivisionStrip`'s phone scroller: native `scroll-snap`, `max-width: 100%` + `min-width: 0`, hidden scrollbar, `overscroll-behavior-x: contain`.
- **Links** use booker's existing external-link attributes, `target="_blank" rel="noopener noreferrer"` (`LegalLinks.tsx:25–31`, `VendorPage.tsx:66`).
- Every tappable control is ≥44×44, asserted by the runner and by `interaction-check.mjs`.
- Both themes render from the same markup.
- **Additional packages required: none.** No carousel library. The real build uses native scroll-snap plus one hook.

## Limits

Static fixtures only: nothing is saved, no Supabase, no app imports, no network. The
`shoot.mjs` run asserts zero non-`file://` requests and fails if one is attempted.

- **The behaviour is a plain-DOM sketch of `usePromoCarousel`**, not the React hook. It shows the intended interaction and was checked by script, but the real hook gets its own tests.
- **Touch swiping was not exercised by a script.** Headless Chromium does not emulate a native scroll-snap swipe reliably. Check it with a finger on a real phone: horizontal swipe changes slide, vertical swipe scrolls the page.
- **Image failure is rendered, not triggered.** A missing local file would log a console error and fail check 2, so the failed slide is drawn in its fallback state directly.
- **Autoplay is a static mock.** It is not recommended (plan D1), so it is not wired.
- Fonts are a fallback. The real app self-hosts Poppins through `next/font`, which cannot load offline.
- Screen-reader output was **not** checked with a real reader. The roles, names and live text are in the markup and are checked as attributes only.

## Findings

Each is also in the plan under the same number.

- **F2 · real build must resolve.** `booker/public/sw.js:29–41` serves same-origin images **cache-first, forever**. Replacing `/promos/court.jpg` under the same name would keep showing returning bookers the old artwork. Artwork filenames are versioned (`…-v1.jpg`), and a change of artwork means a new filename.
- **F3 · resolved in this design; one adjacent defect reported.** DivisionStrip's inactive dot is `--db-divider`, measured at **1.17:1** on the light page, which is nearly invisible. The carousel uses 75% `--db-text`: **3.18–3.22:1** light and **4.62–4.69:1** dark across the page gradient's three stops. DivisionStrip's own dots are out of scope and are **not** changed.
- **F4 · real build must resolve (artwork spec).** At 320px the banner is 278×93px, so 1800×600 artwork is drawn at **0.155×**. The placeholder's small caption is unreadable on a phone, which shows the problem. Authoring rule in plan D2: no essential text under 12% of the artwork height.
- **F5 · harness note.** Playwright treats `aria-disabled="true"` as not enabled and waits forever on `click()`. The end-of-list test needs `{ force: true }`. The real build's spec will hit the same thing.
- **F6 · for your decision (D2).** At desktop width the banner is **1038×346**, taller than the hero. That follows from "current content width" plus a ratio that stays legible on a phone. The plan sets out the trade-off.
- **Preview-only, fixed:** the destinations table crushed to one-character columns on a phone, so it now scrolls sideways. The off-ratio placeholder's own label overflowed inside the artwork and looked cropped, so the label was shortened.

## Regenerating

```bash
node .plans/previews/_shared/shoot.mjs booker-banner-carousel          # nine checks, no screenshots
node .plans/previews/_shared/shoot.mjs booker-banner-carousel --shoot  # + contact sheets
node .plans/previews/booker-banner-carousel/interaction-check.mjs      # widths, keyboard, buttons, states, reduced motion
```

**Last run 2026-10-24.** `shoot.mjs`: 4 screens × 2 viewports × 2 themes = 16 cells, 9 checks,
0 failures, 4 contact sheets. `interaction-check.mjs`: PASS. Details:

- No document overflow and no network request at 320 / 360 / 390 / 768 / 1280, in both themes.
- The slide box is exactly 3:1 at each width (278×93 → 1038×346).
- Controls are ≥44px.
- One tabbable banner link, and hidden slides are `aria-hidden`.
- Next / Previous move one slide, update the dot and the live text, and stop at the ends without dropping focus.
- ← → on the banner moves and carries focus. Tab from the banner reaches "Previous promotion", not a hidden banner.
- A banner click does not navigate, and the link carries `_blank` + `noopener noreferrer`.
- 0 / 1 / 12-slide and failed-image states behave as described.
- Under reduced motion, scroll-behaviour is `auto` and Next moves instantly.

**Still needs the real build:** a real swipe on a phone, real screen-reader announcements,
Poppins metrics, image decode and failure through the `<img>` `error` event, React re-render
behaviour when the slide list changes, and type checks.
