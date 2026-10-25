# Booker Home — promotional banner carousel under "Browse by division"

**Date:** 2026-10-24
**App / scope:** booker/ web only. Planned build: `components/home/PromoCarousel/` (new), `components/home/HomePage/HomePage.tsx`, `app/page.tsx`, `lib/promoSlides.{ts,json,test.ts}` (new), `public/promos/` (new), `app/ui-gallery/page.tsx`, `visual-tests/`. **Added 2026-10-24 (I9):** `components/home/DivisionStrip/DivisionStrip.module.css` and `components/home/HomeSection/HomeSection.module.css`, web spacing only. Docs: `booker/AGENTS.md`, `architecture/portals.md`. **No** vendor, command, backbone, Expo, API, database, auth, CSP, image-config or dependency change.
**Status:** IN PROGRESS. Approved 2026-10-24, with D1–D4 resolved to the recommendations. Build Stages 1–5 ✅ (2026-10-24). B1 ✅ (artwork accepted as-is). **I9 added 2026-10-24**; D5 = B. **Stage 6 ✅ (2026-10-24):** I9 (rows of ≤ 7, centred), I11 (2/3 + 1/3), I12 (phone 5-up) and I13 (Book again placeholder), verified together with the full suite 159/159 twice. **Local test passed: user acceptance, 2026-10-24** ("local tests done, they're good"). Commit messages drafted 2026-10-24; the user commits. Next: staging (Stage 7). I10 ✅ (closed by the user). I10 (artwork v2) is the user's, later, and non-blocking. Then staging (Stage 7). Release: staging ⬜ · production ⬜.

> A responsive, clickable image carousel placed directly after "Browse by division". It starts with
> three JSON-configured slides, each linking to its own external destination. Any number of slides
> is supported, and the data arrives as props, so a future API can feed the same shape.
> **Optimise for:** an unobtrusive block that never distorts or crops artwork, never shifts the
> page, never traps a vertical scroll, and disappears entirely when there is nothing to show.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker · I# = Important (build item) · D# = Decision · F# = Finding ·
> V# = verification check · S# / P# = staging / production release step. Numbers are plan-local:
> qualify cross-plan references by plan, e.g. "redesign D27".

Task prompt: `prototypes/prompts/2026-10-24-booker-banner-carousel.md`.
Preview: [`.plans/previews/booker-banner-carousel/`](previews/booker-banner-carousel/README.md).

---

## ▶ RESUME HERE (updated 2026-10-24, end of Stage 6 — final)

- **Done so far:** build Stages 1–6 ✅.
  - Carousel (I1–I8).
  - Web divisions in centred rows of ≤ 7 (I9, after the D5 revision).
  - Divisions 2/3 + Book again 1/3 from 1024px (I11).
  - Phone 5 columns per page (I12).
  - Book again placeholder when there is no history (I13).
  - Locally verified: 311 unit tests, `promo.spec` 13/13, `home-layout.spec` 5/5, full visual suite **159/159 twice**.
  - B1 ✅ (v1 artwork accepted as-is). I10 ✅ (closed by the user).
- **Live where:** local only. **Local test passed (user, 2026-10-24).** Commit messages drafted 2026-10-24 for booker and root, and **the user commits**. Staging and production untouched.
- **Next:** **Stage 7, staging.**
  - After committing, the user deploys booker to staging.
  - Then V6 with an agent: a real phone swipe on the carousel and on the 5-up division strip, vertical scroll not captured, new-tab links, artwork legibility, a screen reader, and the 2/3 + 1/3 pair and placeholder in the logged-in app.
- **Watch out for:**
  - The gallery pads 32px a side where the app pads 20px. Assert ratios and counts, not pixel widths (`home-layout.spec`).
  - Desktop baselines run at 900px, which is stacked. The side-by-side pair is covered by the `*-wide-*` captures.
  - A running `next dev` blocks Playwright's server.
  - Swapping in artwork means new `-vN` names and a JSON edit; no baselines change.
---

## Scope

**In:** one new Home component and its placement; a typed slide contract with a small normaliser;
a three-record JSON file; local artwork; gallery fixtures, visual baselines and an interaction spec
for the new component; doc updates.

**Out (explicitly):** any API, fetch layer, CMS, database table or admin UI for promotions; a
speculative data-adapter layer; analytics or click tracking; changes to CSP, `next.config.ts`
image settings or the service worker; a carousel dependency; DivisionStrip's own low-contrast dots
(F3, reported only); the Expo apps ("mobile" means the responsive website); vendor, command and
backbone.

**Assumptions** (any of these being wrong changes the approach):
1. Promotions are non-essential marketing content. An error or empty state should hide the block, not show an error message.
2. Destinations are external, `https://` sites. Internal Booker destinations (an offering or vendor page) are a different feature, with in-app navigation and not a link.
3. The user will supply final artwork, URLs and alt text (B1). Until then, build and local test use labelled placeholders.
4. Booker's current CSP stays as it is. Slide images are served from `booker/public/` or, in future, Supabase Storage.

---

## Investigation: what exists (verified 2026-10-24)

| Fact | Where |
|---|---|
| Home is a client component composing sections in an 18px-gap column, `max-width: 1080px`. "Browse by division" is a `HomeSection`, followed directly by `NearYouShelf`. The carousel goes between them. | `booker/components/home/HomePage/HomePage.tsx:146–174`, `HomePage.module.css:7–13` |
| AppShell's scroll container pads 20px (`p-5`), which sets the content width at every viewport. | `booker/components/layout/AppShell/AppShell.tsx:345` |
| Home allows exactly two radii, 18px for the hero and 10px for sections. | `HomePage.module.css:4`, `HomeSection.module.css:64–70` |
| Booker's only breakpoint for Home is `@media (max-width: 640px)`. | `HomeSection.module.css:110,122`, `DivisionStrip.module.css:307` |
| **A scroll-snap row with a dot indicator and a live region already exists.** DivisionStrip pairs native scroll-snap below 640px with `aria-hidden` dots and a polite status. It sets `max-width: 100%` + `min-width: 0`, hides the scrollbar, and its hook guards `setState` from scroll events. The carousel copies this pattern. | `booker/components/home/DivisionStrip/DivisionStrip.tsx:28–82`, `useDivisionStrip.ts:113–162`, `DivisionStrip.module.css:262–336` |
| **No carousel dependency is installed** (no embla, swiper, keen or slick). Radix and base-ui are present but neither has a carousel. No new package is proposed. | `booker/package.json:15–46` |
| External links use `target="_blank" rel="noopener noreferrer"`. | `booker/components/ui/LegalLinks/LegalLinks.tsx:25–31`, `components/explore/VendorPage/VendorPage.tsx:66`, `components/layout/LegalMenu/LegalMenu.tsx:44–45` |
| Covers and photos are plain `<img>` with an eslint-disable for `no-img-element`, not `next/image`. `next.config.ts` has no `images` key. | `booker/components/home/OpenTodayCard/OpenTodayCard.tsx:42–44`, `components/home/ShelfCard/ShelfCard.tsx:58–60` |
| CSP `img-src` is `'self' data: blob:` + the tile host + the Supabase origin (F1). | `booker/next.config.ts:222–226` |
| The service worker serves same-origin static assets, images included, cache-first with no expiry (F2). | `booker/public/sw.js:29–41` |
| Reduced motion is read from `matchMedia` at call time in hooks, and from a CSS media query in stylesheets. | `booker/components/layout/AppShell/useAppShell.ts:591`, `components/home/SearchingOverlay/SearchingOverlay.module.css:230` |
| `HomePage` is rendered by `app/page.tsx` and by three gallery fixtures (`homenear`, `home`, `homesearching`) with committed baselines, including `home-narrow-*` (F7). | `booker/app/page.tsx:19`, `app/ui-gallery/page.tsx:672–730`, `visual-tests/pilot.spec.ts:21–28,112–131` |
| `tsconfig` has `resolveJsonModule: true`. Unit tests are `node --test` over `lib/**/*.test.ts`. | `booker/tsconfig.json:20`, `booker/package.json:10` |
| React 18.3 / `@types/react` 18: there is no typed `inert` prop. Hidden slides use `aria-hidden` + `tabIndex={-1}` instead. | `booker/package.json:53`, `booker/AGENTS.md` stack table |
| **No overlapping plan.** `.plans/INDEX.md` lists no carousel or promotion work. The latest Home plan (`2026-10-23-booker-mobile-spacing-colours.md`) is COMPLETE, and this plan builds on its phone spacing. | `.plans/INDEX.md` |
| `architecture/portals.md` → Home lists Home's sections. A new section is a doc update, not a conflict. Nothing in `architecture/` forbids promotional content on Home. | `architecture/portals.md:40–75` |

---

## Design

### Placement and layout

A new block between `HomeSection tone="divisions"` and `NearYouShelf`. It sits in Home's existing
18px column at the full content width (1080px max, minus AppShell's 20px each side).

- **No section heading** (D4, recommended). The block is the banner plus a control row under it. The region is named "Promotions" for assistive technology.
- **Radius 10px**, `--db-card-border`, `--db-sub-bg` behind the image. This adds no third radius.
- **Controls under the artwork, never on it.** The control row is ‹, then dots or a counter, then ›, centred and 44px tall, 8px below the banner. Overlaid arrows would cover essential artwork on a 93px-tall phone banner.

### Aspect ratio and image fit (D2)

**Recommended: 3:1 at every width, `object-fit: contain`, artwork authored at 3:1.**

| Viewport | Banner (measured in preview) | + controls |
|---|---|---|
| 320 | 278 × 93 | + 52 |
| 360 | 318 × 106 | + 52 |
| 390 | 348 × 116 | + 52 |
| 768 | 726 × 242 | + 52 |
| 1280 | 1038 × 346 | + 52 |

- **One ratio means no breakpoint and no layout jump.** The box is `aspect-ratio: 3 / 1`, so its height exists before the image decodes. That is the layout-shift guarantee.
- **No cropping, ever.** Artwork authored at 3:1 fills the box exactly. Off-ratio artwork is shown **whole**, letterboxed on the track tint (preview `states` → Off-ratio). `cover` was rejected because it would silently crop text or logos from any off-ratio upload, and desktop artwork cannot be assumed safe to crop.
- **Artwork spec** (for B1): 1800×600 px (minimum 1200×400), JPG or WebP, ≤ 200 KB. **The full export spec is in `booker/AGENTS.md` → "Promotions carousel" → step 1** (expanded 2026-10-24 after F12: edge-to-edge, no drawn dots or frames, safe zone, minimum text sizes in px). That file is the one to hand a designer. **No essential text smaller than 12% of the artwork height** (F4). At 320px the banner is drawn at 0.155× scale, so a 72px headline becomes about 11px. Keep logos and text clear of the outer 4% where the border and focus ring sit.
- **Phone height is bounded.** At 390px the block is 116 + 52 = 168px, shorter than the division shelf above it.
- **F6, the trade-off:** at desktop width the banner is 346px tall, taller than the hero. A wider ratio such as 4:1 makes the phone banner 87px at 390px and 70px at 320px, too small for legible artwork. A taller one such as 2:1 makes the desktop banner 519px. 3:1 is the compromise. If desktop height is the concern, the lever is a narrower `max-width` on the block only, which departs from "current content width". It is not proposed.
- **Optional phone artwork: deferred, not built.** If phone legibility proves poor with real artwork, an optional `imageSrcMobile` field can be added later and rendered with `<picture>`. That is additive: old records still work, and the carousel's layout does not change because the ratio is fixed by CSS. It is not justified before real artwork has been seen on a phone, so it is not in the initial contract.

### Interaction and accessibility

- **Movement:** native horizontal `scroll-snap` (`x mandatory`, `scroll-snap-stop: always`).
  - Touch swipe and trackpad scroll work natively. A vertical swipe scrolls the page as normal: there are no touch handlers and no `touch-action` override.
  - A swipe never fires the link, because the browser cancels a click once a touch becomes a scroll.
  - There is no mouse-drag gesture on desktop: ‹ › and a trackpad do the moving, so a mouse click on a banner always means "open".
- **Controls:**
  - ‹ › are 44×44 `<button>`s outside the link, with `aria-controls` pointing at the track and the labels "Previous promotion" and "Next promotion".
  - At an end the control is `aria-disabled="true"`, not `disabled`, so focus stays on it (preview-checked). Clicks are ignored while it is disabled.
- **End of list (D1):** stop at the first and last slide, with no wrap. Wrapping with scroll-snap means a long rewind animation, and with no autoplay there is nothing to wrap for.
- **Indicator:** dots up to `MAX_DOTS = 5`. Above that, a "3 / 12" counter, so the row never outgrows a 320px phone. Both are `aria-hidden`; a visually hidden `role="status"` announces "Promotion 2 of 3" after a user move, and stays empty on first render. The active dot widens, so position is not shown by colour alone. Inactive dots use 75% `--db-text` (F3).
- **Keyboard:**
  - Tab reaches the **current** banner's link, then ‹ and ›.
  - Offscreen slides are `aria-hidden="true"` and their links `tabIndex={-1}`, so no hidden link is in the tab order (preview-checked).
  - ← / → while focus is on the track move one slide **and move focus to the new banner's link**.
  - The focus ring is `--db-toggle-on`, inset on the banner because the track clips, and offset 2px on the buttons.
- **Semantics:**
  - Two or more slides: `<section aria-roledescription="carousel" aria-label="Promotions">`, with each slide as `role="group" aria-roledescription="slide" aria-label="2 of 3"`.
  - One slide: a plain `<section aria-label="Promotion">` with no carousel roles and no controls.
  - The link's accessible name is the image `alt` plus visually hidden "(opens in a new tab)".
- **Reduced motion:** with `prefers-reduced-motion: reduce`, ‹ › move instantly (`behavior: "auto"`) and the dot transition is off. A swipe stays a direct, user-driven movement. CSS `scroll-behavior: smooth` applies only under `no-preference`.
- **Autoplay (D1): recommended OFF.** Bookers on Home are searching or choosing a division, and motion competes with that job. Autoplay also needs a pause control (WCAG 2.2.2) and several pause conditions, which is extra machinery for a non-essential block. **If you choose autoplay**, the spec is:
  - A Pause/Play button leads the control row (mocked in the preview).
  - 6-second interval.
  - Pause on hover, on focus within the carousel, and when `document.visibilityState` is hidden.
  - Never start under reduced motion.
  - Stop for good after any user navigation.
  - At the end, wrap to the first slide.
  - The live region goes silent while rotating.
- **Links (D3): recommended new tab**, `target="_blank" rel="noopener noreferrer"`, matching booker's other external links. A new tab keeps the booker's place on Home, and `noreferrer` sends no referrer. Partners who need attribution get it from UTM parameters in the `href` itself. Same-tab is the alternative.

### Empty, single, many, failure, loading

| Case | Behaviour |
|---|---|
| 0 slides | The component returns `null`. Home's flex gap closes, so "Browse by division" is followed directly by "Near you", with no empty block. |
| 1 slide | A linked banner. No controls, indicator or carousel roles. |
| 2–5 | Dots. |
| 6+ | Counter. No upper limit. The track is a flex row with one 100%-wide slide each. |
| Image fails | `onError` on the `<img>` adds that slide's **id** to a `failed` set in the hook. The slide renders the alt text centred in the same 3:1 box, still a working link. The id rather than the index, so a list change cannot mislabel a slide. |
| List changes or index invalid | The hook clamps during render: `index = min(index, count − 1)`, and 0 when the list is empty. An effect keyed on `count` re-pins the scroll position, so a shrinking list never shows a half slide or an out-of-range dot. |
| Width change | A `ResizeObserver` on the track re-pins `scrollLeft = index × clientWidth` (rotation, window resize). |
| Loading (future API only) | Not built now. See Extensibility. |

### Contract and JSON

```ts
// booker/lib/promoSlides.ts
/** One promotional banner. The normalised shape every source must produce. */
export interface PromoSlide {
  /** Stable identity: React key, failed-image tracking. Unique within the list. */
  id: string
  /** Same-origin path ("/promos/…-v1.jpg") or an https URL whose host is in CSP img-src (F1). */
  imageSrc: string
  /** Describes the artwork AND the destination. It is the link's accessible name. Never empty. */
  alt: string
  /** External destination. https only. */
  href: string
}

/** Drops records that do not satisfy PromoSlide, and later duplicates of an id. Pure. */
export function normalizePromoSlides(raw: unknown): PromoSlide[]

/** Why one raw record is rejected, or null. Used by the shipped-JSON test to name the rule. */
export function promoSlideProblem(raw: unknown): string | null
```

`PROMO_SLIDES` is **not** exported from this file (F9). It is built in `app/page.tsx` as
`normalizePromoSlides(promoSlidesJson)`.

The normaliser does **not** exist to claim extensibility. It is the one security boundary on this
path: `href` reaches an `<a>`, and a `javascript:` URL in a future API row would be script
execution. Its rules:
- `id`, `alt` and `href` are non-empty strings after trimming.
- `href` parses with `new URL()` and has the `https:` protocol.
- `imageSrc` is either a root-relative path (`/…`, not `//…`) or an `https:` URL.
- Unknown fields are ignored.
- A later duplicate `id` is dropped.

A unit test asserts that **the shipped JSON normalises with nothing dropped**, so a typo fails CI
instead of silently hiding a banner.

**Example `booker/lib/promoSlides.json`.** The values are placeholders until B1. The `example.com`
domains are RFC 2606 reserved, and the image files are labelled illustrative:

```json
[
  {
    "id": "court-weekend-2026-11",
    "imageSrc": "/promos/a-v1.jpg",
    "alt": "Weekend court rates from a partner venue — see the offer",
    "href": "https://example.com/promos/court-weekend?utm_source=ezzy-booker"
  },
  {
    "id": "pet-grooming-week",
    "imageSrc": "/promos/b-v1.jpg",
    "alt": "Pet grooming week — browse participating groomers",
    "href": "https://example.com/promos/pet-grooming"
  },
  {
    "id": "home-cleaning-bundle",
    "imageSrc": "/promos/c-v1.jpg",
    "alt": "Home cleaning bundle — read the seasonal offer",
    "href": "https://example.com/promos/home-cleaning"
  }
]
```

Adding a fourth banner means adding a fourth record and image. No carousel code changes.

### Extensibility: future API (documented, not built)

The render component depends only on `slides: PromoSlide[]` through props. It never imports the
JSON, so a different source is a change in the **parent** only:

```ts
// FUTURE — not part of this plan.
const { slides, loading } = usePromoSlides()    // fetch in services/, rows → normalizePromoSlides(rows)
<PromoCarousel slides={slides} loading={loading} />
```

- **Loading:** add an optional `loading?: boolean` prop at that point. It renders the same 3:1 tinted box with no controls, so nothing shifts when the data lands. The change is additive and existing callers are unaffected.
- **Error:** the parent passes `[]`, so the block hides. For marketing content, an error box would be worse than nothing.
- **Remote images:** Supabase Storage URLs already pass CSP. **Any other image host needs a CSP `img-src` change**, a security change behind the approval gate (core rules). `next/image` is not used, so no `images.remotePatterns` change is needed unless a later plan adopts it.
- A fetching source must keep F2 in mind. Cache-busting comes from the URL, so an API should serve versioned or unique image URLs.

---

## Proposed files and responsibilities (component-separation, per file)

| File | New or changed | Responsibility | Separation |
|---|---|---|---|
| `booker/lib/promoSlides.ts` | new | `PromoSlide` type, `normalizePromoSlides()`, `promoSlideProblem()`. Pure, with no React and no JSON import (F9). | n/a (lib) |
| `booker/lib/promoSlides.json` | new | The three slide records. Configuration only. | n/a |
| `booker/lib/promoSlides.test.ts` | new | Normaliser rules, plus "shipped JSON drops nothing". | n/a |
| `booker/components/home/PromoCarousel/PromoCarousel.tsx` | new | **Render only:** section and roles, track, slides (`<img>` or fallback), control row, dots or counter, live region. Wires the handlers the hook returns. No `useState`, `useEffect` or handler bodies, and no inline `style`. Calls the hook, then returns `null` for 0 slides. | render layer |
| `booker/components/home/PromoCarousel/usePromoCarousel.ts` | new | **Behaviour:** `trackRef`, clamped `index`, `count`, `indicator` (`"none" \| "dots" \| "counter"`), `atStart`, `atEnd`, `announcement`, `failed` set and `onImageError(id)`. Also `onScroll` (guarded `setState`, programmatic-scroll guard), `onPrev` / `onNext` (reduced-motion-aware `scrollTo`), `onTrackKeyDown` (← → plus focus move), the `ResizeObserver` re-pin and the re-pin on `count` change. Knows nothing about JSON or where slides come from. | hook |
| `booker/components/home/PromoCarousel/PromoCarousel.module.css` | new | All styling: track and scroll-snap, the 3:1 slide box, `contain`, the focus rings, 44px buttons, `aria-disabled` state, dots and counter, the fallback panel, visually hidden text, and a reduced-motion media query. Tokens only, and no breakpoint. | styles |
| `booker/components/home/HomePage/HomePage.tsx` | changed | New **required** prop `promoSlides: PromoSlide[]`. Renders `<PromoCarousel slides={promoSlides} />` between the division shelf and `NearYouShelf`, with a comment recording the placement decision. | unchanged split (hook untouched) |
| `booker/app/page.tsx` | changed | Imports `@/lib/promoSlides.json`, builds `PROMO_SLIDES = normalizePromoSlides(json)` at module scope and passes `promoSlides={PROMO_SLIDES}`. This is the one place the JSON source is chosen (F7, F9). | n/a |
| `booker/public/promos/*-v1.jpg` | new | Artwork: placeholders, then B1's real files. Versioned names (F2). | n/a |
| `booker/app/ui-gallery/page.tsx` | changed | Existing Home fixtures pass `promoSlides={[]}`. New modes `promo`, `promoone`, `promomany`, `promobroken` and `homepromo`, using `data:` SVG fixtures (no network, no real artwork). | n/a |
| `booker/visual-tests/pilot.spec.ts` + new `visual-tests/promo.spec.ts` | changed / new | Baselines for the new modes, light and dark, including narrow. Interaction spec per V4. | n/a |
| `booker/AGENTS.md`, `architecture/portals.md` | changed | Record the component, the contract, F1, F2, and the "no API yet" boundary. | n/a |

`next/image` is not used: the fixed 3:1 box already reserves space, the images are small and local,
and every other booker cover uses plain `<img>`. Adopting it would mean image configuration for any
future remote host. The `<img>` gets `width`/`height` (1800×600), `decoding="async"` and
`loading="lazy"`, plus the same eslint-disable comment and reason as `OpenTodayCard.tsx:42–43`.
V4 checks whether lazy offscreen slides load before they are swiped to. If they do not, slides at
`index ± 1` switch to `loading="eager"`.

**SOLID, proportionately:**
- The render component does one thing; the hook owns behaviour; the normaliser owns validation.
- `PromoCarousel` takes one prop, so callers depend on nothing they do not use.
- Data comes in through props (dependency inversion), which is what makes JSON → API a change in the parent.
- No adapter interface, provider registry or config schema is added. Each would exist only to claim extensibility.

---

## BLOCKERS

### B1 — Real artwork, destinations and alt text  ✅ DONE (2026-10-24, accepted as-is by the user)
🔄 2026-10-24: the user supplied 3 PNGs and the JSON. **Checked, and not yet accepted.** See F12.
- ✅ JSON: `npm test` 7/7 and the shipped-JSON Playwright check pass. All 3 links are `https`, the ids are unique, and every file resolves.
- ✅ **Mechanical fixes, 2026-10-24, at the user's request:**
  - Re-encoded to `promo-{kiosk,affiliate,event}-v1.jpg` at 1800px wide, shape kept and nothing cropped: 1800×675, 1800×694 and 1800×675; 220–249 KB, down from 1.73–1.83 MB. The quality step was capped so text stays sharp, which leaves them slightly over the 200 KB guide.
  - JSON paths and alt text updated so each names its destination.
  - The original PNGs, the three `Zone.Identifier` files and the placeholders `a/b/c-v1.jpg` were moved to the trash with `gio trash`, so they are recoverable from `~/.local/share/Trash/files/`.
  - Verified: `npm test` 311/311, `tsc` clean, `promo.spec.ts` 13/13 including the shipped-JSON check, and a re-render at 390 and 1280px.
- ⬜ **Still open, needing the designer or the user's acceptance:** the 8:3 and 2.59:1 shapes, so the letterbox bars remain (60–73px per side on desktop); the baked-in white margins and corners; the kiosk image's drawn dots; and the seminar's date, time and venue being unreadable on a phone. **✅ Accepted as-is by the user on 2026-10-24**, with these four deviations known and recorded in F12. A designer re-export (1800×600, no frame or dots, larger seminar details) remains possible later as an ordinary banner change using the `booker/AGENTS.md` how-to, with new `-v2` names.
Missing assets **do not block** planning, building or local testing: Stages 1–5 use the labelled
placeholders. They do block release: **staging (Stage 7) waits for B1** unless you decide, with a
date, to test on staging with placeholders. **Production must never ship placeholders.**
Needed per slide: a 1800×600 JPG or WebP (≤ 200 KB, D2 spec), the `https://` destination, and one
sentence of alt text that names both the offer and where it leads.

## IMPORTANT (build items)

### I1 — Contract, normaliser, JSON, unit test  ✅ DONE (2026-10-24)
✅ 2026-10-24, executed and machine-verified:
- Created `booker/lib/promoSlides.ts`, `promoSlides.json` (the 3 placeholder records from this plan) and `promoSlides.test.ts` (7 tests).
- `npm test`: 311/311 pass. `npx tsc --noEmit` clean. `eslint` on the 3 files clean. Repo `npm run lint` is 18 problems, the same pre-existing count recorded by the circle-free-marks plan, with none in these files.
- Negative check: setting record 2's `href` to `http://` fails the shipped-JSON test with `record 2 "pet-grooming-week": href must start with https://`. The file was restored and the test re-run green.
- Deviation, F9: `PROMO_SLIDES` moved to `app/page.tsx`.
`booker/lib/promoSlides.{ts,json,test.ts}` as specified under Contract and JSON.
**Verify:** `npm test` (new cases: valid record kept; missing or blank fields dropped; `javascript:`, `http:` and protocol-relative `href` dropped; `//host` `imageSrc` dropped; duplicate id dropped; extra fields ignored; shipped JSON drops nothing). When the shipped-JSON case fails, its message names the record (index and `id`) and the rule it broke, e.g. `record 2 "pet-grooming-week": href must start with https://`. The I8 how-to promises this. `npx tsc --noEmit`.

### I2 — `PromoCarousel.tsx` (render)  ✅ DONE (2026-10-24)
 ✅ DONE (2026-10-24): built in Stage 2 (`tsc` clean, `eslint` clean, repo lint unchanged at 18). Behaviour verified in Stage 4 by `visual-tests/promo.spec.ts` (13/13) and by the new baselines. A grep confirms no `useState`, `useEffect`, `useMemo`, `useCallback` or `style={` in the file. The hook result is destructured, because `react-hooks/refs` flags every read through an object holding a ref (F10).
Per the files table. Semantics, attributes and the 0/1/many branches as in Design.
**Verify:** tsc, lint, plus a grep that the file contains no `useState`, `useEffect` or `style={`.

### I3 — `usePromoCarousel.ts` (behaviour)  ✅ DONE (2026-10-24)
 ✅ DONE (2026-10-24): built in Stage 2 (`tsc` clean, `eslint` clean, repo lint unchanged at 18). Behaviour verified in Stage 4 by `visual-tests/promo.spec.ts` (13/13) and by the new baselines.
Per the files table. Follows `useDivisionStrip.ts`'s guarded-setter pattern. Programmatic scrolls set a pending target, so passing through intermediate slides does not announce them (preview-proven).
**Verify:** tsc, lint, V4.

### I4 — `PromoCarousel.module.css` (styles)  ✅ DONE (2026-10-24)
 ✅ DONE (2026-10-24): built in Stage 2 (`tsc` clean, `eslint` clean, repo lint unchanged at 18). Behaviour verified in Stage 4 by `visual-tests/promo.spec.ts` (13/13) and by the new baselines.
Port of the preview's `.pc*` rules (`.plans/previews/booker-banner-carousel/preview.css`), which is the approved look.
**Verify:** V3 baselines in both themes; V5 contrast spot-check.

### I5 — Place on Home  ✅ DONE (2026-10-24)
✅ 2026-10-24, Stage 3:
- `HomePage.tsx` has the required `promoSlides` prop and renders `<PromoCarousel>` directly after the divisions `HomeSection`.
- `app/page.tsx` builds `PROMO_SLIDES = normalizePromoSlides(promoSlidesJson)` (F9) and passes it in.
- All three gallery `<HomePage>` fixtures pass `promoSlides={[]}`.
- Verified: `tsc` clean; repo lint unchanged at 18; `npm test` 311/311.
- `npx playwright test --grep "ui-gallery home"`: **8 passed**, unpiped, `EXIT=0`. That covers `home`, `homesearching`, `homenear` and `home-narrow` in light and dark, with **existing baselines byte-identical**.
- ⚠️ The `app/page.tsx` → JSON path is type-checked only. The authenticated route is not rendered locally by any test; staging V6 sees it.
`HomePage.tsx` gets the required `promoSlides` prop and the render. `app/page.tsx` passes `PROMO_SLIDES`. The three existing gallery Home fixtures pass `[]`.
**Verify:** tsc. **Existing `home-*`, `homenear-*`, `homesearching-*` and `home-narrow-*` baselines pass unchanged**, which proves an empty list leaves no trace (F7).

### I6 — Artwork files  ✅ DONE for placeholders (2026-10-24); real artwork is B1
✅ 2026-10-24, Stage 3: `booker/public/promos/{a,b,c}-v1.jpg` rendered with Playwright from the preview's labelled SVGs (script in the session scratchpad, not committed). Measured from the JPEG headers: each is **1800×600 (3.0)** and 58–60 KB. Each visibly reads "ILLUSTRATIVE PLACEHOLDER", checked by eye. They must be replaced by B1's files before production. **Replaced 2026-10-24** by `promo-{kiosk,affiliate,event}-v1.jpg` (B1); the placeholders were moved to the trash.
`booker/public/promos/{a,b,c}-v1.jpg`. Placeholders until B1, each marked "PLACEHOLDER" in the image.
**Verify:** each file ≤ 200 KB and exactly 3:1 (`file`/`identify`); the I1 test passes.

### I7 — Gallery fixtures, visual baselines, interaction spec  ✅ DONE (2026-10-24)
✅ 2026-10-24, Stage 4:
- **Gallery modes** `promo`, `promoone`, `promomany` (12), `promobroken` (an undecodable `data:` PNG, so the real `onError` runs) and `homepromo`. All use shapes-only `data:` SVG, so there is no network or font dependence.
- Two extra modes that are never baselined: `promoshrink` (the list changes 3 → 2 → 1 → 0) and `promolive` (the shipped JSON and real `/promos/` files).
- **Baselines:** `pilot.spec.ts` gains the five modes in light and dark, and `homepromo` in the 390px narrow loop. That is 12 new baselines, written with a **scoped** `--grep "ui-gallery (promo|homepromo)" --update-snapshots` so no existing baseline was touched. All 12 were reviewed by eye against the approved preview.
- **`visual-tests/promo.spec.ts` (13 tests):**
  - Tab order and hidden slides. Nothing is announced on load.
  - Next / Previous and the end states (`force`, F5), with focus kept.
  - ← → moves focus, and Tab then reaches Previous.
  - A track scroll (the swipe path) updates the index and the live text.
  - Link `href`, `target` and `rel`, and the accessible name.
  - Reduced motion is instant.
  - 1 slide has no controls; 12 slides show a counter.
  - The failed image shows a fallback that is still a link and still 3:1.
  - The list changing clamps and re-pins, with no console errors.
  - The 3:1 box is reserved before decode.
  - The shipped JSON renders every slide, and the next real file loads before it is swiped to. This settles the lazy-loading question: `loading="lazy"` stays.
  - No overflow at 320px, and controls ≥44px.
- **Negative check:** pointing a JSON `imageSrc` at a missing file makes the shipped-JSON test fail (`Expected: true / Received: false`). The JSON was restored.
- **Full suite:** `npx playwright test` **146 passed, twice**, unpiped, `EXIT=0` both runs (3.9 min and 3.7 min).
- ⚠️ Still not machine-tested: a real finger swipe, a vertical swipe not being captured, and a real screen reader. All three are V6 on staging.
Modes `promo` (3), `promoone`, `promomany` (12), `promobroken` (one `data:` image that fails to decode, to exercise the real `onError`) and `homepromo` (Home with three slides). Add them to `pilot.spec.ts` with light, dark and a narrow (320) case. New `promo.spec.ts` per V4.
**Verify:** full visual suite green **twice** (per `booker/AGENTS.md` / F64 discipline). The new baselines are reviewed by eye before commit.

### I8 — Docs  ✅ DONE (2026-10-24)
✅ 2026-10-24, Stage 5:
- `booker/AGENTS.md` gains "Promotions carousel (2026-10-24)": the data-via-props rule, F9, the normaliser as security boundary, F1 CSP, F2 versioned files, the gallery-fixture rules, F5, and the **user how-to, steps 1–6, as approved**. Step 4 also runs the shipped-JSON Playwright check (F11).
- `architecture/portals.md` → Home gains a "Promotions" entry.
- **Walk-through done:** following steps 1–4, a fourth banner (`walkthrough-v1.jpg` plus a fourth JSON object) appeared with **no code change**: the unit tests passed with 4 records, and the shipped-JSON test passed rendering 4. Changing its link to `http://` failed `npm test` with `record 4 "walkthrough-test": href must start with https://`.
- Reverted: the JSON is byte-identical to before (`cmp`), and the temporary image was moved to the trash.
- Final local gate: `tsc` clean; `npm test` 311/311; `npm run lint` 18, the pre-existing count. A `prefer-const` slip in `promo.spec.ts:170` briefly made it 19, and it was fixed. After that fix, `promo.spec.ts` re-ran 13/13.
- ⚠️ The full visual suite was **not** re-run after that one-word test-file fix and the doc edits; its two 146/146 runs came just before them. No component, app or baseline file changed after those runs.
`booker/AGENTS.md`: a short "Promotions carousel" note covering the contract, F1 (CSP), F2 (versioned filenames), props-only data and the deferred API.
`architecture/portals.md` → Home: add the section to the inventory.

The `booker/AGENTS.md` note **must include this how-to, word for word or close to it**
(added 2026-10-24 at the user's request), so a promotion can be changed without reading the code:

> **Add, replace or remove a promotional banner**
>
> 1. **Prepare the image.** 1800×600 px (exactly 3:1), JPG or WebP, ≤ 200 KB. No essential text
>    smaller than 12% of the image height (about 72px on an 1800×600 canvas), and keep text and
>    logos clear of the outer 4%.
> 2. **Add the image to `booker/public/promos/` under a NEW, versioned name**, e.g.
>    `grooming-v1.jpg`. To change an existing banner's artwork, add `grooming-v2.jpg` rather
>    than overwriting `-v1`: the service worker caches images forever (`public/sw.js`), so an
>    overwritten file keeps showing returning bookers the old picture.
> 3. **Edit `booker/lib/promoSlides.json`.** It is a JSON array, and each object is one banner, shown
>    in array order:
>    ```json
>    {
>      "id": "pet-grooming-week",
>      "imageSrc": "/promos/grooming-v1.jpg",
>      "alt": "Pet grooming week — browse participating groomers",
>      "href": "https://partner.example/grooming?utm_source=ezzy-booker"
>    }
>    ```
>    - `id`: any short unique name, using lowercase letters, digits and hyphens. Do not reuse
>      another banner's id.
>    - `imageSrc`: the path from step 2, starting `/promos/`. The `public` part is left off.
>    - `alt`: one sentence saying what the offer is **and** where the link goes. A screen reader
>      reads this as the link, and it is shown as text if the image fails to load. Never leave it
>      empty.
>    - `href`: **the link the banner opens.** It must start with `https://`; `http://` and
>      anything else is dropped. To see which banner a partner's traffic came from, add UTM
>      parameters to it (e.g. `?utm_source=ezzy-booker`).
>    - **Add** a banner by adding an object, separated from its neighbours by commas. **Remove**
>      one by deleting its object. **Reorder** them by moving objects. An empty array `[]` hides the
>      carousel completely. There is no limit on the number of banners.
> 4. **Check it:** run `npm test` in `booker/`. The `promoSlides` test fails if any record would be
>    dropped (a missing field, a non-https link or a duplicate id) and names the reason. Then
>    `npm run dev` and look at Home at phone width, checking the artwork is legible.
> 5. **Ship it** through the normal release: deploy to staging, check it, then Vercel Promote to
>    production. A promotion change is an app deploy; there is no admin screen.
> 6. **Optionally, tidy up** old `-vN` images that no JSON record uses any more. Do this a release
>    later, not in the same deploy, so a booker on the previous version still loads its image.

**Verify:** read-through. Links resolve. Follow steps 1–4 once with a fourth placeholder banner on a
scratch edit, confirm it appears with no code change and that a deliberately `http://` link makes
`npm test` fail, then revert the scratch edit.

### I9 — Web: tighter "Browse by division" spacing  ✅ DONE (2026-10-24; reopened and rebuilt as wrap-and-centre, then verified)
✅ **Verified 2026-10-24 (Stage 6, together with I9, I11, I12 and I13):**
  - **Before re-recording:** the full suite **without** updates gave 139 passed and 16 failed. The 16 were exactly the predicted ones: the desktop `home`, `homenear`, `homesearching` and `homepromo`; the narrow `home` and `homepromo`; and the new `homenohistory`, all in light and dark.
    - Every other baseline passed untouched, including `bookagain-*`, `popular-*`, `opentoday-*`, `nearyou-*` and `divisions-*`. That proves `HomeSection`'s flex column is a no-op wherever a section is not stretched.
    - Those 16 were re-recorded with a scoped `--update-snapshots`.
  - **Added** 1280px **wide** captures (`homepromo-wide`, `homenohistory-wide`, light and dark). The main loop runs at 900px, below the 1024px threshold, so without these the side-by-side pair would have had no pixel coverage.
  - Reviewed by eye: `homepromo-wide-light`, `homenohistory-wide-dark`, `homenohistory-narrow-light` and `home-narrow-dark`, all matching the approved `booker-home-duo` preview.
  - **New `visual-tests/home-layout.spec.ts`, 5/5:**
    - ≥ 1024px: a 2:1 split, equal heights (< 2px apart), rows of ≤ 7 centred to within 1px.
    - 900px: stacked, with Book again directly under divisions.
    - No history: the placeholder fills the 1/3 column.
    - Failed bookings fetch: no placeholder, and divisions at full width.
    - Phone: 5 columns visible at 390, 360 and 344px (the gallery's equivalent of the app's 320px), tiles ≥ 46px, no clipped labels, no overflow.
  - **Final:** full suite **159 passed, twice**, unpiped, `EXIT=0`. `npm test` 311/311. `tsc` clean. Lint at the pre-existing 18 (the gallery's existing "Cannot create components during render" error moved from line 1062 to 1085 and is not new).
  - Docs: `architecture/portals.md` → Home records the web rows of 7, the pair, the placeholder and 5-up.
  - ⚠️ Not yet seen in the logged-in app or on a real phone: staging V6.
🔄 **Reopened 2026-10-24** after the user tested the single-row layout (D5-B): "converting the division icons to one line did not work because now I am missing the other icons. Make the others wrap around … another row … the second row will have less, so make sure the icons are aligned at the middle of the container."
- **Rebuilt** in `DivisionStrip.module.css`:
  - The web `.strip` is now `display: flex; flex-wrap: wrap; justify-content: center; gap: 12px 16px; max-width: calc(7 * 72px + 6 * 16px); margin: 0 auto`, giving rows of **at most 7** that are each **centred**. 13 divisions read 7 + 6. The count is never written down: a 14th makes 7 + 7.
  - `.tile { width: 72px }`, the same column the phone uses.
  - The phone block now states `display: grid; justify-content: normal; margin: 0`, because it previously inherited `grid` from the web rule, and centring an overflowing scroller would hide its first tiles. Its existing `max-width: 100%` undoes the 7-tile cap.
  - Unchanged from the first I9 build: the 48px box, `gap: 4px`, the 4/2 padding, and the 14px/20px divisions body.
- `tsc` clean; lint at 18.
- ⏸ **Verification waiting:** the user's `next dev` is back on :3000 (pid 602735), which blocks Playwright's :3200 server. Still to run: the measurement (rows, row centring, gap, overflow, phone unchanged), a scoped re-record of the same 8 desktop Home baselines, and the full suite twice.
- *The record of the single-row build follows, kept for history.*
🔄 2026-10-24, Stage 6:
- **Built with D5-B:**
  - `DivisionStrip.module.css`: `.strip` uses `minmax(68px, 1fr)` with `gap: 12px 8px`; `.tile` has `gap: 4px; padding: 4px 0 2px`; `.tileDisc` is 48×48.
  - `HomeSection.module.css`: the web rule `.section[data-tone="divisions"] .body { padding: 14px 20px; }` sits above the phone block.
- `tsc` clean; repo lint at 18.
- **Correction (F13):** the `divisions` gallery mode draws its own grid (`app/ui-gallery/page.tsx:856`) and does **not** render `DivisionStrip`, so its baselines must **not** change. The expected re-records are `home`, `homenear`, `homesearching` and `homepromo`, in light and dark (8 baselines).
- ✅ **Verified 2026-10-24**, after the user stopped their :3000 server:
  - **Before re-recording:** the full suite **without** `--update-snapshots` gave 138 passed and 8 failed. The 8 were exactly the predicted desktop Home baselines (`home`, `homesearching`, `homenear`, `homepromo` × light and dark). All `*-narrow-*` phone baselines and `divisions-*` passed unchanged, which proves the phone layout is untouched and confirms F13.
  - **Re-record:** scoped `--grep "ui-gallery (home|homesearching|homenear|homepromo)-(light|dark)$" --update-snapshots` wrote 8 baselines. `homepromo-light`, `homenear-dark` and `homesearching-dark` were reviewed by eye and match the approved preview.
  - **Computed values** in the real component (`homepromo` gallery mode, both themes):
    - 1280px: label **8px** under its logo; logo 46×46; box 48×48; tiles ≥ 72×76; **13 per row**; body `14px 20px`; widget 163px.
    - 900px: 10 + 3.
    - 641px: 7 + 6, tiles 70×76.
    - At all widths: 0 labels truncated and 0px horizontal overflow.
    - 390px unchanged: gap 13px, box 44×44, tiles 72×63, body `10px 12px`, widget 227px.
    - At 700px the gallery shows 7 + 6 rather than the preview's 8 + 5, because the gallery pads 32px a side against the app shell's 20px. That is a harness width, not the design.
  - **Final:** full suite **146 passed, twice**, unpiped, `EXIT=0`. `npm test` 311/311. `tsc` clean. Lint at the pre-existing 18.
  - Docs: `architecture/portals.md` → Home → "Browse by division" notes the web grid.
  - ⚠️ Not yet seen in the logged-in app or on real devices: staging V6.
Added 2026-10-24 at the user's request; **revised 2026-10-24** after the user reviewed the first version: "still a lot of space. I want the label closer to its icon, and the horizontal spaces between the icons lessened (it won't matter if the icons on the second line will be fewer)". Preview: [`.plans/previews/booker-web-division-spacing/`](previews/booker-web-division-spacing/README.md), screens `compare` and `widths`.
**Why:** above 640px each 46px logo sits centred in an invisible 84px box (`DivisionStrip.module.css:215–231`; there has been no tint since circle-free). With the 9px gap that leaves the label about 31px under its logo. Columns are at least 128px wide (`:177`), so logos are 144px apart centre to centre, only 7 fit per row, and they spread across the whole width.
**Change (web only, the base rules outside `@media (max-width: 640px)`). Common to both D5 options:**
- `DivisionStrip.module.css`:
  - `.tileDisc { width: 48px; height: 48px; }` (was 84). The box now hugs the logo. `.tileIcon` stays **46px**, so the logo is not resized.
  - `.tile { gap: 4px; padding: 4px 0 2px; }` (was `9px` and `6px 0 4px`). 4px stays above the disc for its 2px hover lift (`:243`).
  - `.strip { gap: 12px 8px; }`: rows stay 12px, and the column gap goes 12 → 8px.
- `HomeSection.module.css`: a **web** rule `.section[data-tone="divisions"] .body { padding: 14px 20px; }` (was 18px 20px). It is placed **before** the existing phone rule at `:129`, so the phone's `10px 12px` still wins below 640px, and it is scoped to the divisions tone.
- **Column width, per D5:** A = `minmax(88px, 1fr)`; B = `minmax(68px, 1fr)` (was 128px).
- **Phone untouched:** the phone block already overrides `.tileDisc`, `.tile` gap and padding, `.strip` gap and columns, and the divisions body, so none of this reaches a phone. Verified in the preview, where the 390px measurements are unchanged.
**Measured in the preview at 1280px:**

| | Current | Option A | Option B |
|---|---|---|---|
| Logo → label | 31px | 8px | 8px |
| Logo | 46×46 | 46×46 | 46×46 |
| Logo to logo, centre to centre | 144px | 101px | 77px |
| Per row | 7 + 6 | 10 + 3 | all 13 |
| Tile tap target | 132×121 | 93×76 | 69×76 |
| Widget height | 349px | 251px (−98) | 163px (−186) |

At 900px: A wraps 8 + 5 and B wraps 10 + 3. **At 700px: A wraps 6 + 6 + 1, leaving "Law" alone on a third row; B wraps 8 + 5.**
**Component split:** style-only, in both components' `.module.css`. The `.tsx` files and `useDivisionStrip` are untouched. On desktop the page count stays 1, because the grid wraps and never scrolls.
**Acceptance:**
- The computed values are as above at 1280, 900 and 700px, in both themes.
- No label is truncated. The longest label is 5 characters, so it fits a 68px column.
- Every tile is ≥ 44×44.
- No horizontal overflow at 641px.
- 390px is unchanged: logo → label 13px, tiles 72×63, widget 227px.
**Verify:**
- `tsc` and lint clean (lint stays at 18).
- **Re-record and review by eye** the desktop Home baselines (`home-*`, `homenear-*`, `homesearching-*`, `homepromo-*`, `divisions-*`) with a scoped `--update-snapshots`.
- The `*-narrow-*` baselines must pass **unchanged**.
- Full visual suite twice.

### I11 — Web: "Browse by division" at 2/3, "Book again" beside it at 1/3  ✅ DONE (2026-10-24; see the I9 evidence block)
**As built:** the `.duo` wrapper and `.duoSide:empty` in `HomePage.tsx`/`.module.css`; the flex-column `.section` and `.body { flex: 1 }` in `HomeSection.module.css`; and the again-tone `.meta` hidden from 1024px. The `.meta` rule follows the approach chosen in the text below. **Book again was removed from its old position** after "Available today".
Added 2026-10-24 at the user's request: "shorten the width of 'Browse by division' so there isn't much space at the sides … 2/3 of the horizontal space; for the remaining 1/3, move the 'Book again' section in place, since it does not need to be so wide." Preview: [`.plans/previews/booker-home-duo/`](previews/booker-home-duo/README.md), screens `desktop` and `states`.
**Files:**
- `booker/components/home/HomePage/HomePage.tsx`: divisions `HomeSection` at `:154`; `BookAgainCard` currently at `:242`, after "Available today".
- `HomePage.module.css`.
- `booker/components/home/HomeSection/HomeSection.module.css`.
**Change:**
- `HomePage.tsx`: wrap the divisions `HomeSection` and `<BookAgainCard>` in `<div className={styles.duo}><div className={styles.duoMain}>…</div><div className={styles.duoSide}>…</div></div>`, directly after the in-progress strip. **Remove** `BookAgainCard` from `:242`. Update the order comments there and at the top of the component.
- `HomePage.module.css`:
  - `.duo { display: flex; flex-direction: column; gap: 18px }` stacks the pair, with Book again right under divisions.
  - `.duoSide:empty { display: none }`: `BookAgainCard` already returns `null` without history, so divisions then takes the full width with **no empty third and no new logic**.
  - From `@media (min-width: 1024px)`: `.duo { flex-direction: row; align-items: stretch }`, `.duoMain { flex: 2 1 0; min-width: 0 }`, `.duoSide { flex: 1 1 0; min-width: 0 }`, `.duo > * > section { height: 100% }`.
- `HomeSection.module.css`:
  - `.section { display: flex; flex-direction: column }` and `.body { flex: 1 }`, so a stretched card fills with its own recessed body. Both are no-ops where a section is not stretched.
  - The 1/3 column hides "Things you have booked before". That needs a hook into the meta span without a structural selector across components. The approach: HomePage passes nothing new, and `HomeSection`'s existing `@media (max-width: 640px) .meta { display: none }` gains a `.section[data-tone="again"] .meta` rule under `@media (min-width: 1024px)`, because the again tone **only** appears in the pair from 1024px. That keeps the rule in `HomeSection`'s own stylesheet, keyed on the existing `data-tone` (booker's convention).
**Why 1024px:** the 2/3 column must hold the 7-tile row (600px plus 40px of body padding). At 1024px the column is about 650px wide. Narrower, it would drop to 6 per row with a lone tile.
**Measured in the preview:** 681 \| 341px split at 1280; equal heights 294 / 294px (3 rows) and 251 / 251px (1 row); the no-history case at full width; stacked at 900px.
**Component split:** `HomePage` stays a render layer (two wrapper `div`s, no logic). `HomeSection` stays a pure display component with a style-only change. `BookAgainCard` and its hook are untouched.
**Acceptance:**
- At ≥ 1024px the two sit side by side at 2:1 with equal heights.
- Divisions shows 7 + 6, centred.
- With no history, divisions is full width.
- Below 1024px they are stacked.
- Book again appears only once.
- No horizontal overflow at 1024, 900 or 641px.
- Other Home shelves are pixel-identical.
**Verify:**
- `tsc` and lint.
- Re-record the desktop Home baselines (`home`, `homenear`, `homesearching`, `homepromo`) and review them by eye.
- `bookagain-*`, `popular-*`, `opentoday-*` and `nearyou-*` must pass **unchanged**, which proves the `HomeSection` change is a no-op elsewhere.
- Measure the split and heights in the gallery at 1280 and 1024px.
- Full suite twice.

### I12 — Phone: five division columns per page instead of four  ✅ DONE (2026-10-24; see the I9 evidence block)
**As built, with one addition (F15):** `grid-auto-columns: max(44px, calc((100% - 4 * 6px) / 5))`, rows 10px and columns 6px, `.tile { width: auto }`, and `.tileName { max-width: 100% }`. The `max(44px, …)` guard was added after the layout spec showed that a 230px-wide strip (narrower than any app phone width) would squeeze tiles under 44px and overlap them. On such a screen it now shows a little under five instead.
Added 2026-10-24 at the user's request: "for the mobile view, squeeze 'Browse by division' more: 5 instead of 4 in a page." Preview: `booker-home-duo` → `phone`.
**File:** `booker/components/home/DivisionStrip/DivisionStrip.module.css`, phone block at `:162` (`grid-auto-columns: 72px` at `:175`; `.tileName { max-width: 72px }` at `:215`).
**Change (phone block only):**
- `.strip { grid-auto-columns: calc((100% - 4 * 6px) / 5); column-gap: 6px; }`. Rows stay 10px.
- `.tile { width: auto; }`. ⚠️ This is required (F14): I9's web rule sets `width: 72px`, which would overflow the narrower track and overlap the next tile.
- `.tileName { max-width: 100%; }`.
- The column is a fifth of the strip's own width, so it is **exactly five per page at any phone width**: 60px at 390px and 46px at 320px, still ≥ 44px. Today it is 4 at 390px and 3 at 320px.
**Unchanged:** two rows, sideways scroll and snap. The `useDivisionStrip` page count reads `scrollWidth / clientWidth`, so the dots follow automatically (2 pages for 13 tiles).
**Measured in the preview:** 5 visible per row at 390 and 320px, 0 labels clipped.
**Component split:** style-only; the `.tsx` and hook are untouched.
**Acceptance:**
- 5 columns visible per page at 320, 360 and 390px.
- Tiles ≥ 44px wide.
- No label truncated.
- Swipe and keyboard still reach all 13.
- The dots track the page.
- No horizontal overflow.
**Verify:**
- Re-record `home-narrow-*` and `homepromo-narrow-*` and review them by eye.
- Measure columns and tile widths at 320, 360 and 390px.
- Full suite twice.
- Real-phone swipe on staging (V6).

### I13 — "Book again" placeholder when there is no booking history  ✅ DONE (2026-10-24; see the I9 evidence block)
**As built:**
- `BookAgainCard` has `showPlaceholder`. `HomePage` passes `!loading && !error`.
- The placeholder is a lucide `History` glyph in a disc tinted with the shelf accent, plus two lines. The glyph uses `--db-text`, **not** the accent: `--div-*-deep` is identical in both themes and too dark on the dark body. A first draft used `:global(.dark)`, a selector no booker CSS module uses, and that was replaced by the theme-aware token.
- The gallery modes are `homenohistory` (baselined light, dark, narrow and wide) and `homebookingserror` (behaviour only).
- `BookAgainCard`'s docstring and `HomePage`'s hide-when-empty note record the reversal.
Added 2026-10-24 at the user's request: "for the 'Book again' section, if there is no data, put a placeholder like an icon or artwork that signifies past booking."
⚠️ **This reverses a documented rule:** "Book again renders nothing when there is no history" (`BookAgainCard.tsx` docstring; `HomePage.tsx`'s every-shelf-hides-itself note; `architecture/portals.md` → Home). Both texts are updated in the same change.
**Change:**
- `BookAgainCard` gains a `showPlaceholder` prop. With no rows and `showPlaceholder`, it renders the same `HomeSection` ("Book again") with a centred empty state: a lucide `History` icon (a clock with a turn-back arrow, meaning *past bookings*) in a tinted disc, the line "Nothing to book again yet", and "Services you've booked will show up here, ready to book again in one tap." There is no CTA, because the divisions sit right beside it.
- Without `showPlaceholder` it returns `null`, as before.
- `HomePage` passes `showPlaceholder={!loading && !error}`. While bookings load, or if their fetch failed, the card stays hidden: a "nothing yet" message on an error would be false, and during loading it would flash and then jump. `.duoSide:empty` still collapses those two cases to full-width divisions.
**Component split:** `BookAgainCard.tsx` stays a render layer, and the placeholder is a render-only branch. `useBookAgainCard` is unchanged. Styles go in `BookAgainCard.module.css` with tokens only.
**Acceptance:**
- No history after load: the placeholder appears in the 1/3 column at ≥ 1024px, and as a short card under divisions below that.
- Loading or error: no card.
- With history: the rows exactly as before.
- Both themes.
**Verify:**
- A new gallery mode `homenohistory` (Home with `bookings={[]}`) gets light, dark and narrow baselines.
- `bookagain-*` must not change.
- Full suite twice.

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains — plan-authoring §7. -->
- ✅ RESOLVED 2026-10-24 → **(A)**, the recommendation, approved by the user. **D1 — Autoplay and end-of-list.** (A) **No autoplay. Stop at the ends with `aria-disabled` controls.** *Recommended.* (B) Autoplay to the spec under Interaction (Pause/Play, 6s, pause on hover, focus and hidden tab, never under reduced motion, wrap at the end).
- ✅ RESOLVED 2026-10-24 → **(A)**, the recommendation, approved by the user. **D2 — Aspect ratio and fit.** (A) **3:1 at every width, `object-fit: contain`, artwork authored at 1800×600 with the 12% text rule.** *Recommended.* (B) 2:1 everywhere: a taller phone banner (175px at 390) but 519px on desktop. (C) 3:1 plus required phone artwork through `<picture>`: more assets per promotion, and premature before real artwork has been seen on a phone.
- ✅ RESOLVED 2026-10-24 → **(A)**, the recommendation, approved by the user. **D3 — Link opening.** (A) **New tab, `target="_blank" rel="noopener noreferrer"`, with "(opens in a new tab)" in the accessible name.** *Recommended:* it matches booker's external links and keeps the booker's place. (B) Same tab, `rel="noopener noreferrer"` with no `target`.
- ✅ RESOLVED 2026-10-24 → **(B), 68px columns, chosen by the user — then REVISED 2026-10-24 by the user after testing: rows of at most 7, wrapped and centred (see I9).** **D5 — Web division spacing (I9), revised 2026-10-24.** Both options put the label about 8px under its logo (box 84 → 48px, gap 9 → 4px) and keep the logos at 46px. They differ in how closely the logos pack side by side. (A) **88px columns:** 10 per row and 3 on the second at full width, logos 101px apart, widget −98px; at 700px it leaves "Law" alone on a third row. (B) **68px columns:** all 13 on one row at full width, logos 77px apart, widget −186px; wraps 10 + 3 at 900px and 8 + 5 at 700px. *Recommended: B.* It answers the request most directly, uses a single row where there is room, and avoids A's lone tile at 700px. Its 69×76 tiles are still well above 44×44. (C) Leave the web as it is.
- ✅ RESOLVED 2026-10-24 → **approved as recommended by the user: (a) 1024px, (b) Book again moves up on a phone too.** **D6 — Approve I11 and I12 as previewed (`booker-home-duo`).** Two sub-points to confirm:
  - (a) Side by side from **1024px**, stacked below that.
  - (b) Because the page has one order for every width, **Book again also moves up on a phone**, directly under divisions and above the promotions (it currently sits after "Available today"). Keeping it low on a phone would need a second render or CSS re-ordering across the wrapper. That isn't recommended.
  - *Recommended:* approve as previewed, with (a) 1024px and (b) moving up on a phone too.
- ✅ RESOLVED 2026-10-24 → **(A)**, the recommendation, approved by the user. **D4 — Visible heading.** (A) **None. The banner stands alone, and the region is named "Promotions" for screen readers.** *Recommended:* it keeps the block light and adds no sixth shelf tone. (B) A `HomeSection` titled "Promotions" with a new tone, which adds about 50px of header and a pipe and wash above the banner.

## FINDINGS

- **F1 — CSP limits image hosts.** ✅ recorded (2026-10-24) · `booker/next.config.ts:226`. `img-src` is `'self' data: blob:` + tiles + Supabase. JSON images are same-origin. A future non-Supabase host is a security-gated CSP change, which is **not** in this plan.
- **F2 — Images are cached forever.** ✅ recorded (2026-10-24) · `booker/public/sw.js:29–41`. Same-origin images are served cache-first with no expiry. **Artwork filenames must be versioned**, and replacing artwork means a new filename and a JSON edit. The real build must follow this (I6, I8).
- **F3 — DivisionStrip's inactive dots are near-invisible on light.** ⬜ reported, not fixed · `booker/components/home/DivisionStrip/DivisionStrip.module.css:270–276`. `--db-divider` measures **1.17:1** on the light page gradient. The carousel uses 75% `--db-text` (**3.18–3.22:1** light, **4.62–4.69:1** dark, computed over all three gradient stops). Fixing DivisionStrip is outside this task. It is left for you to schedule or close.
- **F4 — Phone scale shrinks artwork text.** ✅ resolved in design (D2 spec) · At 320px, 1800×600 artwork is drawn at 0.155×. The placeholder's 42px caption renders at about 6.5px and is unreadable (preview `widths`). Hence the 12% minimum text height.
- **F5 — Playwright and `aria-disabled`.** ✅ recorded · Playwright treats `aria-disabled="true"` as not enabled and waits until timeout on `click()`. The end-of-list assertion needs `{ force: true }` (found in `interaction-check.mjs`).
- **F6 — Desktop banner height.** ⬜ for your D2 decision · 1038×346 at 1280px, taller than the hero (preview `home`). This is the trade-off of a single legible ratio. See Design → Aspect ratio.
- **F7 — Fixture isolation.** ✅ resolved in design · Had `HomePage` imported the JSON directly, every artwork change would break four committed Home baselines. The source is chosen in `app/page.tsx`, and the fixtures pass `[]`.
- **F9 — No JSON import in a unit-tested lib file.** ✅ resolved (2026-10-24, Stage 1) · `npm test` runs `node --test --experimental-strip-types` (`booker/package.json:10`), which refuses a JSON import without an import attribute. So `lib/promoSlides.ts` stays pure, the test reads the JSON with `readFileSync` (same pattern as `lib/geoCentroids.test.ts:20`), and `PROMO_SLIDES` is built in `app/page.tsx`, which the plan already named as the one source-choosing place. No behaviour change.
- **F15 — A fifth of a very narrow strip falls under the tap target.** ✅ resolved (2026-10-24, Stage 6) · `home-layout.spec` found that at a 230px strip (the gallery's 320px, narrower than any app phone width) a fifth is 41px, so tiles would be squeezed under 44px and overlap. Fixed with `max(44px, …)`. The app's 320px strip (254px) still gets five 46px columns.
- **F14 — A 5-up phone grid needs `.tile { width: auto }`.** ✅ recorded (2026-10-24, preview) · I9's web rule fixes tiles at 72px. In the narrower 5-up phone track they overflowed and overlapped ("Learn" was clipped at 320px in the first preview render). I12 includes the reset.
- **F13 — The `divisions` baselines are not affected by I9.** ✅ recorded (2026-10-24, Stage 6) · The I9 text originally listed `divisions-*` among the baselines to re-record. That gallery mode builds its own grid (`app/ui-gallery/page.tsx:856`), so a change in those baselines would be a regression, not an expected re-record.
- **F11 — The shipped-JSON test catches a missing image.** ✅ recorded (2026-10-24, Stage 4) · Beyond the plan: the `promolive` test fails when a JSON `imageSrc` points at a file that does not exist, so the I8 how-to's step 4 now runs it too.
- **F12 — The supplied artwork does not meet the D2 spec.** ✅ closed (2026-10-24): size, versioned names, alt text and leftovers were fixed; the shape, frames, dots and seminar legibility were **accepted as-is by the user, 2026-10-24**. Measured by rendering the shipped JSON (`promolive`) at 390 and 1280px:
  - **Ratio:** `promo-kiosk.png` and `promo-event.png` are 2048×768 (8:3); `promo-affiliate.png` is 2020×779 (2.59:1). The design never crops, so each is letterboxed: 60px or 73px bars per side at 1280, 18px or 22px at 390. The affiliate banner is also narrower than the other two, so the visible width changes between slides.
  - **Size:** 1.73–1.83 MB each, 5.3 MB in total on Home, against a ≤ 200 KB per-image budget.
  - **Baked-in chrome:** every image has a white margin and rounded corners, which show as a white frame inside the carousel in dark mode. `promo-kiosk.png` also has three carousel dots drawn under the banner, which appear just above the real ones.
  - **Phone legibility:** the drawn scale is 0.14 at 390px. Headlines read. The event's date, time and venue ("NOVEMBER 7, 2026 · 3PM · KUSINIELA", about 35px in the artwork, so about 5px on screen) do not, and that is essential information.
  - **Names:** not versioned (F2).
  - **Alt text:** does not say where the link goes. The seminar link opens Facebook.
  - **Leftovers:** three `*.png:Zone.Identifier` files (Windows download metadata) and the unused placeholders `a/b/c-v1.jpg` are still in `public/promos/`, and would be deployed.
- **F10 — `react-hooks/refs` and returned hook objects.** ✅ recorded (2026-10-24, Stage 2) · Reading a hook's result as `s.field` when the object contains a ref makes `eslint-config-next` 16 report every field as "Cannot access refs during render" (13 errors). Destructuring the result, as `DivisionStrip.tsx:26` does, clears it. Worth knowing for any future hook that returns a ref.
- **F8 — There is no typed `inert` on React 18.** ✅ resolved in design · Hidden slides use `aria-hidden` + `tabIndex={-1}`, and the preview script verifies the tab order.

### I10 — Artwork v2: re-export the three banners to spec  ✅ DONE (2026-10-24, closed by the user: the images are being fixed in another session)
Added 2026-10-24. The user agreed to re-export the three banners to the `booker/AGENTS.md` step-1 spec: 1800 × 600, edge to edge, no frame or drawn dots, and larger seminar details. The user will test and swap them in later, as an ordinary banner change (new `-v2` names and a JSON edit, following the how-to). **It does not block staging or production:** the v1 artwork was accepted as-is (B1). When it lands, run `npm test` and the shipped-JSON check (how-to step 4). No baselines change, because they use `data:` fixtures (F7).

## DEFERRED / COSMETIC
- Optional phone artwork (`imageSrcMobile` + `<picture>`): additive, revisit only after real artwork is seen on a phone (D2).
- API source, loading prop, CMS or admin UI: documented under Extensibility. Needs its own plan, and possibly a schema, RLS and Command UI.
- Click analytics: not requested. UTM parameters in `href` cover partner attribution with no code.

---

## Execution order

0. ✅ **👤 Approval handoff:** D1–D4 resolved and plan approved, 2026-10-24.
1. ✅ **Stage 1 (🤖):** I1, contract and data (2026-10-24).
2. ✅ **Stage 2 (🤖):** I2 + I3 + I4, the component trio (2026-10-24).
3. ✅ **Stage 3 (🤖):** I5 + I6, placement and placeholder artwork (2026-10-24).
4. ✅ **Stage 4 (🤖):** I7, gallery fixtures, new baselines and the interaction spec (2026-10-24).
5. ✅ **Stage 5 (🤖):** I8, docs (2026-10-24). Then the full local gate: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run test:visual` (twice).
6. ✅ **Stage 6 (🤖):** I9 (rebuilt: wrap and centre) + **I11** (2/3 and 1/3 pair) + **I12** (phone 5-up) + **I13** (Book again placeholder). Verified 2026-10-24. All three are verified together in **one** baseline re-record and full-suite pass, so the Home baselines are re-recorded once rather than three times. Needs the user's :3000 dev server stopped. It ships in the same release as the carousel, because both change the desktop Home baselines.
7. **Stage 7 (👤 + 🤝):** staging release. B1 ✅. See Release.
8. **Stage 8 (👤):** production release, always last.

Default cadence: one stage per session (`AGENTS.md` → Execution Cadence).

## Release (plan-authoring §12)

booker app only. **No migration, Edge Function, secret or env-var change.** DB and functions are untouched, so there is no unsafe intermediate state and no safe-pause table is needed.

### Staging (production untouched throughout)
| # | Who | Step | Check |
|---|---|---|---|
| S1 | 👤 | Confirm B1's real artwork, URLs and alt text are in the JSON and `public/promos/` (or record a dated decision to stage with placeholders) | ⛔ no placeholder reaches production |
| S2 | 👤 | Deploy booker to staging | build succeeds |
| S3 | 👤 + 🤖 | Staging checks V6 | ⛔ all green |

⛔ **Staging fully green before anything touches production.**

### Production (last stage)
| # | Who | Step | Check |
|---|---|---|---|
| P1 | 👤 | Parity: production booker = staging minus this change. The JSON holds no placeholders. | ⛔ |
| P2 | 👤 | Vercel **Promote** the exact staging deployment that passed S3 | — |
| P3 | 👤 + 🤖 | Production check: Home shows the banners, and each opens its destination in a new tab | ⛔ |

---

## Verification

### Done in this planning pass (preview only, 2026-10-24)
- **V0a ✅** `node .plans/previews/_shared/shoot.mjs booker-banner-carousel --shoot`: 4 screens × 2 viewports × 2 themes = 16 cells, **9 checks, 0 failures**, 4 contact sheets. The checks cover no page errors, no console errors, zero network requests, no overflow, no control under 44px, no cropped chrome, a JS syntax check, no drift and a resolved token. Machine-verified.
- **V0b ✅** `node .plans/previews/booker-banner-carousel/interaction-check.mjs`: **PASS**. Machine-verified, against the preview's DOM sketch and not the React build:
  - No overflow or network request at 320, 360, 390, 768 and 1280 in both themes.
  - The slide box is exactly 3:1 at each width.
  - Controls are ≥44px.
  - One tabbable banner link, and hidden slides are `aria-hidden`.
  - Next / Previous update the dot and the live text, and stop at the ends with focus kept.
  - ← → moves and carries focus. Tab from the banner reaches "Previous promotion".
  - A banner click does not navigate, and the link carries `_blank` + `noopener noreferrer`.
  - 0, 1 and 12-slide and failed-image states behave as described.
  - Reduced motion gives instant movement.
- **V0c ✅** Visual inspection by the agent of all four contact sheets and the full-size `home` and `states` shots, both themes, both widths. This found and fixed two preview-only defects (README → Findings) and produced F3.
- **Not verified in the preview:** a real touch swipe, a real screen reader, Poppins metrics, the React hook itself, and image decode failure through the real `error` event.

### For the build (future, per stage)
- **V1** · machine · `npm test`: I1 normaliser cases, and shipped JSON drops nothing.
- **V2** · machine · `npx tsc --noEmit` and `npm run lint` clean (lint at or below its current baseline), after every stage.
- **V3** · machine · visual suite twice:
  - The existing Home baselines are **unchanged** (I5).
  - New `promo*` and `homepromo` baselines in light, dark and narrow 320, with no overflow at 320.
- **V4** · machine · `visual-tests/promo.spec.ts`:
  - Exactly one tabbable link. Hidden slides are `aria-hidden` and `tabIndex=-1`.
  - Next / Previous and the end states, with `force` for F5. ← → moves focus. Tab order runs link → ‹ → ›.
  - Link `target` and `rel` (or the D3 outcome).
  - Under `reducedMotion: "reduce"`, movement is instant.
  - `promobroken` shows the fallback through the real `onError`.
  - **List change:** re-render 3 → 1 slide while on slide 3. The index clamps, there are no controls, and there is no console error.
  - The neighbouring slide's `<img>` is loaded before it is scrolled to (the lazy-load question in the files table).
  - Layout stability: the banner box height is the same before and after the images decode.
- **V5** · machine · the contrast script re-run on the built CSS: inactive dot ≥3:1 in both themes, and control icon ink ≥3:1.
- **V6** · needs **staging** on a real phone and desktop · 👤 + 🤝:
  - A horizontal swipe changes the slide, and a vertical swipe scrolls the page without being captured.
  - A tap opens the destination in a new tab. A swipe never opens it.
  - The real artwork is legible at phone width (F4).
  - VoiceOver or TalkBack reads "Promotions, carousel", the slide position and the link name.
  - Keyboard pass on desktop. Both themes.
- **V7** · needs **production** · 👤 · banners are present and every link resolves.
