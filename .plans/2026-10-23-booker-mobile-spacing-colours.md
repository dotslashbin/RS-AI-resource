# Booker Home — division label colours, and a tighter phone layout for the hero and division widget

**Date:** 2026-10-23
**App / scope:** `booker/` web only — four CSS modules on Home (`DivisionStrip`, `HomeSection`, `HomePage`, `LocationChip`), their visual baselines, and two comments/docs. No `.tsx`, no hook, no token value, no asset. No vendor, command, backbone, Expo, API, schema, security or dependency change.
**Status:** COMPLETE (2026-10-24) — every item I1–I10 ✅; S1 and S2 executed and verified (visual suite 121/121 twice); real-phone check passed (user, 2026-10-24); committed by the user — booker `80d58f7`, root `5a36c5a`. **Not yet on staging:** the user will push it later. F3 ✅ resolved 2026-10-24 (shared preview tokens resynced).

> Make the Home screen's division labels readable and consistent with the logos they caption,
> and give a phone more of the page by trimming the hero ("What do you need today?") and the
> "Browse by division" widget — without touching desktop, content, logos or tap targets.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** I# = implementation item, F# = finding, D# = decision, S# = stage.
> Numbers are plan-local — qualify cross-plan refs by plan (e.g. "redesign D22-d", "parity C2").

**Source prompt:** `prototypes/prompts/2026-10-23-booker-mobile-spacing-colours.md`.
**Preview:** [`.plans/previews/booker-mobile-spacing-colours/`](previews/booker-mobile-spacing-colours/README.md) — open `index.html` from disk.

---

## Scope

**Asked:** five cosmetic changes on booker web Home — (1) dark-mode division labels follow the
displayed logo colour, (2) light-mode labels use one readable dark ink, (3) less space between
each logo and its label on a phone, (4) a more compact division widget on a phone, (5) a
shorter "What do you need today?" section on a phone.

**Added 2026-10-23 (follow-up request):** (6) hide the sub-line *"Pick a division below, or
search a service or vendor by name."* on a phone — I8; (7) make the "Set your location" button
smaller — I9; (8) a smaller "What do you need today?" heading on a phone — I10. ⚠️ (6) removes content on a phone, which the original prompt ruled out; this later
instruction from you overrides that, for this one line only.

**Not asked, and not done:** the logos themselves (no recolouring, no re-cropping — Drive's small
mark stays small, F5); navigation; the page gap between shelves; any other shelf; desktop
spacing; the Expo apps (see the coupling note on parity C2 under I6).

**Cross-app:** none. booker only.

### What was inspected (2026-10-23)

| Thing | Where | Finding |
|---|---|---|
| "What you need today" | `booker/components/home/HomePage/HomePage.tsx:76` | The actual wording is **"What do you need today?"** — the `<h1>` of Home's **hero** card, which also holds the sub-line, the search field and the location chip. It is a separate box from the division widget, so the two savings do not overlap (the 18px page gap between them is not touched by either). |
| Division widget | `HomeSection` (`tone="divisions"`) wrapping `DivisionStrip` — `HomePage.tsx:146–153` | Header chrome is `HomeSection`, shared with every shelf; the tiles and phone scroller are `DivisionStrip`. |
| Label colour today | `DivisionStrip.module.css:93` → `var(--division-fg)` → `--div-<slug>-label` (`globals.css:176–189` light, `306–315` dark) | Each label is a colour **sampled from its logo** (redesign D22-d, 2026-09-29), lightened for dark. |
| Logo as displayed | `DivisionStrip.tsx:57` passes `flattenInDark`; `DivisionIcon.tsx:79` adds `.db-mark`; `globals.css:495` `.dark .db-mark { filter: brightness(0) invert(1) }` | **Light: full-colour artwork. Dark: a pure white silhouette, for all 13 divisions.** So in dark the label today is orange/blue/grey text under a white logo — exactly the prompt's example. There is no multicoloured case to resolve in dark: the displayed colour is `#ffffff` for every tile. |
| Other logo + text pairs | `ShelfCard.tsx:63`, `PopularCardRow.tsx:54` | The text next to those logos is a vendor/offering name in neutral or status tokens (`--db-strong`, `--db-text`, `--st-confirmed-fg`) — not a division label. Out of scope. The Explore stylesheets that mention `--division-fg` only do so in "NOT this token" comments. |
| Phone rules | `DivisionStrip.module.css:144–188`, `HomeSection.module.css:110–127`, `HomePage.module.css:200–213`, `LocationChip.module.css:10` | All phone rules already sit in `@media (max-width: 640px)` blocks; this plan adds values inside those blocks only (one new block in `LocationChip`). |
| Real reference | `booker/visual-tests/pilot.spec.ts-snapshots/home-narrow-{light,dark}-chromium-linux.png` (390px) | Hero **257px**, division widget **280px**, read off the baseline. The preview's reconstruction measures 259 / 281. |
| Overlapping plans | `.plans/INDEX.md` | `2026-10-18-booker-ui-enhancements` (built the two-row scroller — COMPLETE), `2026-10-19-booker-circle-free-marks` (removed the disc tint, added `flattenInDark` — COMPLETE), `2026-10-20-dark-mode-lift` (brightened dark surfaces — COMPLETE). None open on these files. `2026-09-29-booker-mobile-parity-groundwork` C2 (⬜, DRAFT) plans to port the D22-d palette to RN — see I6. |

### Assumptions

- **A1** — The division strip is the only place booker shows a "logo label". Verified by grep
  above; if you meant another surface, say so and it is a new item.
- **A2** — "Mobile" means the existing `max-width: 640px` breakpoint. No new breakpoint.
- **A3** — Label colour changes at **both widths** (the prompt's default); spacing changes
  phone-only.
- **A4** — The sub-line is hidden on a phone only; desktop keeps it (as asked: "when on mobile view").
- **A5** — "Make the location button smaller" is read as phone-only too, like every other size
  change here. Confirmed by D4-A (2026-10-23).

---

## Measured before → after (390 × 844, same content, both themes identical)

Measured live in the preview (`narrow-check.mjs`); the "current" column agrees with the real
baseline to within 2px. Values in px.

| Element | Property | Current | Proposed | Saves |
|---|---|---:|---:|---:|
| **Hero** | card padding | 18 | 16 | 4 |
| | gap between rows (×2) | 15 | 12 | 6 |
| | heading size / line-height (800) — **I4 + I10** | 22px / 1.5 → 33 | 19px / 1.25 → 23.75 | 9.25 |
| | sub-line (2 lines + 6px margin) — **hidden on a phone (I8)** | 48 | 0 | 48 |
| | search field height | 52 | 48 | 4 |
| | location chip top margin (stacks on the gap) | 14 | 0 | 14 |
| | location chip, visible pill (I9) | 44 | 32 | — (tap box stays 44) |
| | **hero height** | **259** | **174** | **85** |
| **Division widget** | section body padding (top + bottom) | 14 + 14 | 10 + 10 | 8 |
| | invisible disc around the 32px logo | 58 | 44 | 14 × 2 rows |
| | tile padding (top + bottom) | 2 + 2 | 0 | 4 × 2 rows |
| | logo-box → label gap | 6 | 4 | 2 × 2 rows |
| | row gap | 14 | 10 | 4 |
| | page dots top margin | 10 | 8 | 2 |
| | **widget height** | **281** | **227** | **54** |
| Logo → label | visible ink gap | 22 | 13 | — |
| Tile | tap target (w × h) | 72 × 83 | 72 × 63 | ≥ 44 × 44 kept |
| Location chip | tap box (w × h), unset | 151 × 44 | 132 × 44 | ≥ 44 tall kept |
| **Page** | **top of the next shelf** | **596** | **456** | **139** |

**Total: 139px more page at the same viewport and content** — 85 from the hero, 54 from the
division widget, counted once each (separate boxes; the 18px gap between them is unchanged).
At 641px and 1280px both variants measure identical boxes: **desktop is unchanged.**

Tradeoff recorded: the row gap was tried at **8px** first and rejected — a label then sat almost
as close to the next row's logo as to its own. 10px keeps each label grouped with its logo.

## Proposed label colours

`.tileName { color: var(--db-strong) }` — one rule, both widths, both themes.

| Theme | Logo as displayed | Proposed label | Source | Contrast on the real surface* |
|---|---|---|---|---|
| Light | full-colour artwork | `#0f172a` | `--db-strong` (`globals.css:62`), booker's primary ink, a dark navy-slate | **17.06:1** |
| Dark | white silhouette `#ffffff` (`.db-mark`) | `#f1f5f9` | `--db-strong` (`globals.css:286`) | **13.32:1** (worst gradient stop) |
| Dark — D1 option B | same | `#ffffff` | literal logo colour | 14.59:1 |

\* The label's real background is the section body: `--db-sub-bg` over `--db-card-bg` over the
page gradient. Light composites to `#f8fafc`; dark to `#212530` / `#242837` / `#222731` at the
three stops. Script: `.plans/previews/booker-mobile-spacing-colours/contrast.py`.

**Today, for comparison** (full table in preview screen 4): light 4.83–14.86:1, all pass; **dark
3.51–8.75:1, seven of thirteen FAIL 4.5:1** — see F1. No contrast problem with the proposal.

---

## IMPLEMENTATION ITEMS

Approved 2026-10-23 with D1-A, D2-A, D3-A, D4-A.

### I1 — Division labels: one readable ink in both themes  ✅ DONE
> ✅ DONE (2026-10-23) — implemented in S1 (tsc clean, lint 18 = baseline, 304/304 tests); verified in S2 in the real app on a dev server at 320/360/390/1280 × both themes: computed values as specified, all 13 labels `rgb(15,23,42)` light / `rgb(241,245,249)` dark, tiles 72 × 63, chip box 132 × 44 with a 6px clipped band, sub-line `display: none` ≤640 and `block` at 1280, heading 19px ≤640 / 27px at 1280, zero horizontal overflow; 8 re-recorded baselines reviewed by eye; full visual suite 121/121 twice.
**File:** `booker/components/home/DivisionStrip/DivisionStrip.module.css:93` (and its comment at `:33–38`)
Today `color: var(--division-fg)` prints each division's logo-derived colour, which in dark sits
under a white logo and fails AA for seven divisions (F1).
**Change:** `color: var(--db-strong);` (or D1-B). Rewrite the `:33–38` comment to say why: the
label follows the logo *as displayed* — full colour on light, white silhouette on dark — so it
uses the page's own ink and not the brand palette. Do **not** delete `--div-*-label` or the
`[data-division]` mapping: `--division-fg` still colours `DivisionIcon`'s monogram fallback
(`DivisionIcon.module.css:92`), which a future Command-added division would reach.
**Component split:** render (`DivisionStrip.tsx`) and hook (`useDivisionStrip.ts`) untouched; style-only change in the co-located `.module.css`.
**Acceptance:** every tile label computes to `--db-strong` at 390px and ≥641px in both themes; no logo pixel changes; contrast ≥ 4.5:1 on the composited surface (17.06 / 13.32).
**Reverses:** redesign D22-d's *label* use only (logo-derived label colours). Its tile tints and `-deep` derivation are untouched.

### I2 — Phone: logo closer to its label  ✅ DONE
> ✅ DONE (2026-10-23) — implemented in S1 (tsc clean, lint 18 = baseline, 304/304 tests); verified in S2 in the real app on a dev server at 320/360/390/1280 × both themes: computed values as specified, all 13 labels `rgb(15,23,42)` light / `rgb(241,245,249)` dark, tiles 72 × 63, chip box 132 × 44 with a 6px clipped band, sub-line `display: none` ≤640 and `block` at 1280, heading 19px ≤640 / 27px at 1280, zero horizontal overflow; 8 re-recorded baselines reviewed by eye; full visual suite 121/121 twice.
**File:** `DivisionStrip.module.css:173–183` (inside the existing `@media (max-width: 640px)`)
The 32px logo is centred in a 58px invisible box (13px dead band, no tint since circle-free
B2) plus a 6px flex gap, so the visible gap is ~22px.
**Change:** `.tileDisc { width: 44px; height: 44px; }`, `.tile { gap: 4px; }`. `.tileIcon` stays
32px — **the logo is not resized.** Visible gap 22 → 13px.
**Component split:** style-only; `.tsx` and hook untouched. `useDivisionStrip`'s page count reads `scrollWidth / clientWidth`, which depends on the 72px column width — unchanged — so the dots are unaffected.
**Acceptance:** 32 × 32 logo box unchanged; tile ≥ 44 × 44 (measured 72 × 63); label not truncated (no label is today and none is in the preview at 320/360/390).

### I3 — Phone: a more compact division widget  ✅ DONE
> ✅ DONE (2026-10-23) — implemented in S1 (tsc clean, lint 18 = baseline, 304/304 tests); verified in S2 in the real app on a dev server at 320/360/390/1280 × both themes: computed values as specified, all 13 labels `rgb(15,23,42)` light / `rgb(241,245,249)` dark, tiles 72 × 63, chip box 132 × 44 with a 6px clipped band, sub-line `display: none` ≤640 and `block` at 1280, heading 19px ≤640 / 27px at 1280, zero horizontal overflow; 8 re-recorded baselines reviewed by eye; full visual suite 121/121 twice.
**Files:** `DivisionStrip.module.css:144–188`; `booker/components/home/HomeSection/HomeSection.module.css:122–127` (D2)
**Change (DivisionStrip, phone block):** `.strip { gap: 10px; }` (was `14px 10px` — column gap unchanged, row gap 14 → 10); `.tile { padding: 0; }` (was `2px 0`); `.dots { margin-top: 8px; }` (new, phone block — desktop never renders dots). Keep `padding-bottom: 4px` on the strip (room for the scroll strip's focus ring and snap).
**Change (HomeSection, phone block — D2-A):** `.section[data-tone="divisions"] .body { padding: 10px 12px; }`. Scoped to the divisions tone so every other shelf keeps its 14px.
**Component split:** `HomeSection` is a pure display component (no hook, by design) — style-only change in its `.module.css`, keyed on the existing `data-tone` attribute (booker's convention: a data attribute mapped in CSS, not a prop). `DivisionStrip` as I2.
**Acceptance:** widget 281 → 227px at 390px; still two rows, still scrolls sideways, all 13 tiles reachable by swipe, keyboard (strip is focusable) and tab order; dots still track the page; nothing overflows at 320px.

### I4 — Phone: a shorter hero ("What do you need today?")  ✅ DONE
> ✅ DONE (2026-10-23) — implemented in S1 (tsc clean, lint 18 = baseline, 304/304 tests); verified in S2 in the real app on a dev server at 320/360/390/1280 × both themes: computed values as specified, all 13 labels `rgb(15,23,42)` light / `rgb(241,245,249)` dark, tiles 72 × 63, chip box 132 × 44 with a 6px clipped band, sub-line `display: none` ≤640 and `block` at 1280, heading 19px ≤640 / 27px at 1280, zero horizontal overflow; 8 re-recorded baselines reviewed by eye; full visual suite 121/121 twice.
**File:** `booker/components/home/HomePage/HomePage.module.css:200–213`
**Change (phone block only):** `.hero { padding: 16px; gap: 12px; }`, `.heading { line-height: 1.25; }` (size stays 22px/800 — hierarchy kept), `.search { height: 48px; }`. (The sub-line rules first drafted here — 13px / 1.45 / 4px margin — are superseded by I8, which hides it.)
⚠️ Keep `.search { flex: none; width: 100%; }` — it is the I43 fix that stopped the field collapsing to 25px; the height override goes **beside** it, not instead of it.
**Component split:** `HomePage.tsx` / `useHomePage.ts` untouched; style-only.
**Acceptance:** hero 259 → 174px at 390px together with I5, I8, I9 and I10; search field 48px tall (≥ 44); the find button unchanged at 36px (F4); heading and sub-line keep their weights and colours; nothing clips at 320px.

### I5 — Phone: the location chip stops doubling the hero's gap  ✅ DONE
> ✅ DONE (2026-10-23) — implemented in S1 (tsc clean, lint 18 = baseline, 304/304 tests); verified in S2 in the real app on a dev server at 320/360/390/1280 × both themes: computed values as specified, all 13 labels `rgb(15,23,42)` light / `rgb(241,245,249)` dark, tiles 72 × 63, chip box 132 × 44 with a 6px clipped band, sub-line `display: none` ≤640 and `block` at 1280, heading 19px ≤640 / 27px at 1280, zero horizontal overflow; 8 re-recorded baselines reviewed by eye; full visual suite 121/121 twice.
**File:** `booker/components/location/LocationChip/LocationChip.module.css:10`
The chip carries `margin-top: 14px` **and** sits in a flex column with a 15px gap, so 29px
separates it from the search field — the single largest saving in the hero.
**Change:** add `@media (max-width: 640px) { .chip { margin-top: 0; } }`. Desktop keeps 14px.
**Component split:** `LocationChip.tsx` has no state (no hook); style-only. Used only by `HomePage` and the `/ui-gallery` fixture (grep 2026-10-23).
**Acceptance:** 12px between search field and chip at ≤640px; chip still `min-height: 44px`; `locationchip-*` baselines (900px) unchanged.

### I6 — Docs and cross-plan notes  ✅ DONE
> ✅ DONE (2026-10-23) — `booker/AGENTS.md` (new caption bullet; line 159 now says `--division-fg` *was* the caption colour), `globals.css` label-block comment (no value changed), dated note at parity C2. Verified by grep: no doc still calls `--division-fg` the tile caption.
**Files:** `booker/AGENTS.md` → "Division colours and icons" (the line calling `--division-fg` "the Home tile's caption colour"); `booker/app/globals.css:164–175` comment ("The tile LABEL, derived from each logo") — comment only, **no value changes**.
Say that the tile label is now `--db-strong` and `--div-*-label` survives only as the monogram
fallback's colour. **Coupling — parity C2:** `.plans/2026-09-29-booker-mobile-parity-groundwork.md`
C2 plans to port the D22-d palette (labels included) to RN. On approval, add a dated one-line
note at C2 that web labels no longer use it; whether mobile follows is that plan's decision, not
this one's. No RN file is touched.
**Acceptance:** no doc still describes the tile label as logo-coloured; parity C2 carries the note.

### I8 — Phone: hide the hero's sub-line  ✅ DONE
> ✅ DONE (2026-10-23) — implemented in S1 (tsc clean, lint 18 = baseline, 304/304 tests); verified in S2 in the real app on a dev server at 320/360/390/1280 × both themes: computed values as specified, all 13 labels `rgb(15,23,42)` light / `rgb(241,245,249)` dark, tiles 72 × 63, chip box 132 × 44 with a 6px clipped band, sub-line `display: none` ≤640 and `block` at 1280, heading 19px ≤640 / 27px at 1280, zero horizontal overflow; 8 re-recorded baselines reviewed by eye; full visual suite 121/121 twice.
**File:** `booker/components/home/HomePage/HomePage.module.css:36–40` (`.sub`), rule added to the phone block at `:200–213`
**Requested 2026-10-23.** *"Pick a division below, or search a service or vendor by name."* is
two lines plus a 6px margin on a phone — 48px, the largest single item in the hero.
**Change:** `.sub { display: none; }` inside the existing `@media (max-width: 640px)`. **CSS, not
a conditional render:** the hero is one markup for every width (same reasoning
`DivisionStrip` records for its one-set-of-tiles rule), and a JS width check would render the
line on the server and remove it after hydration — a visible jump.
**Accessibility:** `display: none` removes it for screen readers too, which is acceptable: it is
guidance, not a label. The search field keeps its own `aria-label` and placeholder ("Search a
service or vendor"), the `<h1>` is unchanged, and the divisions are labelled directly below.
**Component split:** `HomePage.tsx` keeps rendering the `<p>`; style-only.
**Acceptance:** at ≤640px the line has `display: none` and the hero is 174px at 390px (with I10); at ≥641px
it renders exactly as today.

### I9 — Phone: a smaller "Set your location" chip, same tap area  ✅ DONE
> ✅ DONE (2026-10-23) — implemented in S1 (tsc clean, lint 18 = baseline, 304/304 tests); verified in S2 in the real app on a dev server at 320/360/390/1280 × both themes: computed values as specified, all 13 labels `rgb(15,23,42)` light / `rgb(241,245,249)` dark, tiles 72 × 63, chip box 132 × 44 with a 6px clipped band, sub-line `display: none` ≤640 and `block` at 1280, heading 19px ≤640 / 27px at 1280, zero horizontal overflow; 8 re-recorded baselines reviewed by eye; full visual suite 121/121 twice.
**File:** `booker/components/location/LocationChip/LocationChip.module.css:9–31` (`.chip`, `.unset`), new phone block (shared with I5)
**Requested 2026-10-23.** Today it is a 44px-tall pill with 13px text and 15px padding — the
same visual weight as the search field above it.
⚠️ **The 44px minimum is the constraint.** `min-height: 44px` is the ux-design §5 target and the
file's own header says it is "not padding taste". The original prompt also said compact must not
mean harder to tap. So the chip gets smaller **to the eye** and keeps its **tap box** (D3-A):
**Change (phone block, D3-A):**
```css
@media (max-width: 640px) {
  .chip {
    margin-top: 0;                                   /* I5 */
    gap: 6px; padding: 0 12px; font-size: 12px;
    border-width: 6px 0; border-color: transparent;  /* box stays min-height 44px … */
    background-clip: padding-box;                    /* … but only the middle 32px is painted */
    box-shadow: inset 0 0 0 1px var(--db-menu-btn-border); /* the outline, at the pill's edge */
  }
  .unset { border-color: transparent; box-shadow: inset 0 0 0 1px var(--db-pill-border); }
  .pin { width: 13px; height: 13px; }                /* CSS beats the 15px SVG attribute */
}
```
Why this shape: an inset shadow paints at the padding edge, which is exactly the visible pill's
edge, and the existing `:hover` background follows `background-clip` with no extra rule. All three
states (unset, a city, a long barangay that truncates) use it — preview screen 6.
**Known side effect:** the browser's default focus ring wraps the 44px box, not the 32px pill —
slightly larger than what it surrounds. Visible and correct; not styled further.
**Component split:** `LocationChip.tsx` unchanged (it has no state, so no hook); `MapPin size={15}`
stays in the TSX and is overridden by `.pin` in CSS. Style-only.
**Acceptance:** visible pill 32px tall, tap box ≥ 44px tall (measured 132 × 44 unset), a tap 2px
inside the top and bottom edge still hits the chip, long names still truncate before **Change**,
desktop unchanged (`locationchip-*` baselines identical — under D4-A).

### I10 — Phone: a smaller "What do you need today?" heading  ✅ DONE
> ✅ DONE (2026-10-23) — implemented in S1 (tsc clean, lint 18 = baseline, 304/304 tests); verified in S2 in the real app on a dev server at 320/360/390/1280 × both themes: computed values as specified, all 13 labels `rgb(15,23,42)` light / `rgb(241,245,249)` dark, tiles 72 × 63, chip box 132 × 44 with a 6px clipped band, sub-line `display: none` ≤640 and `block` at 1280, heading 19px ≤640 / 27px at 1280, zero horizontal overflow; 8 re-recorded baselines reviewed by eye; full visual suite 121/121 twice.
**File:** `booker/components/home/HomePage/HomePage.module.css:201` (`.heading { font-size: 22px; }` in the phone block)
**Requested 2026-10-23.** Desktop is 27px; phones already drop to 22px.
**Change:** phone block `.heading { font-size: 19px; letter-spacing: -0.5px; }` (with I4's
`line-height: 1.25`). Weight 800 and colour unchanged. Desktop keeps 27px / −0.7px.
**Why 19px, not smaller:** the section titles below are 15px/800 on a phone (`HomeSection.module.css:126`);
19px keeps the heading clearly the page's lead. At 17px it would sit two pixels from them and the
hierarchy flattens.
**Component split:** style-only; `HomePage.tsx` unchanged.
**Acceptance:** 19px at ≤640px, 27px at ≥641px; one line at 390px; at 320px check the wrap in
Poppins (F2).

### I7 — Visual baselines  ✅ DONE
> ✅ DONE (2026-10-23) — a full run before updating failed exactly **8**: `home-{light,dark}`, `home-narrow-{light,dark}`, `homenear-{light,dark}`, `homesearching-{light,dark}`. The three 900px diffs were reviewed and show the 13 labels only; the narrow ones show the new layout. Re-recorded with `--grep "ui-gallery home" --update-snapshots`, then the full suite **121/121 twice**, exit 0. ⚠️ **Correction:** the plan predicted 10 — `divisions-*` does not render `DivisionStrip` (`app/ui-gallery/page.tsx:779` draws `DivisionIcon` on its tints), so it correctly stayed unchanged. `locationchip-*` unchanged, as D4-A requires.
**Files:** `booker/visual-tests/pilot.spec.ts-snapshots/`
**Expected to change (10):** `home-narrow-{light,dark}` (spacing + colour); `home-{light,dark}`, `homenear-{light,dark}`, `homesearching-{light,dark}`, `divisions-{light,dark}` (label colour only — the gallery shoots at 900px, above the breakpoint). **Every other baseline must stay green**, `locationchip-*` included (unless D4-B, which adds `locationchip-{light,dark}` → 12).
**How:** port 3200 must be free (your `:3000` dev server blocks Playwright's own — ask first). Re-record **scoped**: `npx playwright test --grep "home|divisions" --update-snapshots`, review each diff by eye, then the full suite twice without `--update`. Never read the run through `tail`.
**Acceptance:** exactly the files above differ; full suite green twice.

---

## FINDINGS

### F1 — Today's dark labels fail AA on the surface they actually sit on  ✅ DONE (resolved by I1, 2026-10-23)
Seven of thirteen measure **3.51–4.29:1** (Court, Care, Well, Drive, Home, Learn, Park) against
the section body in dark; 10px bold text needs 4.5:1. `--div-*-label` was tuned against the page
gradient (D22-d), the dark-mode lift (2026-10-20) then brightened the card underneath, and
`lib/palette.test.ts` has **no assertion on `-label` at all** (grep: zero hits outside comments).
I1 fixes all thirteen. *Not proposed:* adding a `-label` test — once I1 lands nothing on screen
reads those tokens as a label; if you want one anyway, it is a separate item.

### F2 — The heading probably wraps at 320px in the real font  ✅ CHECKED (2026-10-23)
> Measured on the dev server in Poppins: **two lines at 320px** ("today?" alone on the second), **one line at 360 and 390**. No clipping or overflow. Accepted as-is; F8 records an optional polish.
The preview uses Lato (Poppins cannot load offline) and shows "What do you need today?" on one
line at 320px. Poppins ExtraBold is wider; at 22px across ~246px it very likely took two.
**I10 (19px) makes one line much more likely**, and if it still wraps, I4's `line-height: 1.25`
keeps it to ~48px. Either way it must be looked at in the real build. (The sub-line's wrap no longer matters on a phone — I8 hides it.)

### F6 — The chip's `:hover` would have painted the full 44px box  ✅ DONE (fixed S1, verified S2 2026-10-23)
> Verified: hovering in the real app keeps `background-clip: padding-box` at 320/360/390 in both themes, and an element screenshot shows the fill staying inside the 32px pill.
Found while implementing I9, invisible in the preview (which has no hover rule):
`.chip:hover` and `.unset` both set the `background` **shorthand**, which resets
`background-clip` to `border-box`. On hover the fill would have spread into the transparent
6px bands and the pill would "grow" to 44px. Fixed with `.chip, .chip:hover, .unset {
background-clip: padding-box; }` in the phone block, commented in place. **S2 must hover it.**

### F7 — At 320px the "Browse by division" header wraps to two lines  — noted, pre-existing, out of scope
Seen on the 320px dev-server render (2026-10-23): title and "Open Explore" each take two lines.
`HomeSection`'s header is unchanged by this plan and shared by every shelf. Leave unless you want a
separate item.

### F8 — Optional: balance the two-line heading at 320px  ✅ DONE
> ✅ DONE (2026-10-23, at the user's request) — `text-wrap: balance` added to `.heading` in `HomePage.module.css`'s phone block. Verified on the dev server: 320px now breaks "What do you / need today?"; 360px stays one line; `ui-gallery home*` 8/8 unchanged (390px and 900px fit on one line, so no baseline moved).
`text-wrap: balance` on `.heading` would break it as "What do you / need today?" instead of leaving
"today?" alone. One declaration, no effect where it fits on one line. Not done because you did not
ask for it.

### F3 — Preview tooling: `_shared/*.css` predated the dark-mode lift  ✅ DONE (2026-10-24)
> ✅ DONE (2026-10-24, at the user's request) — wider than first recorded: all three shared
> snapshots (`booker.css` 13, `vendor.css` 15, `command.css` 13 values) still held the pre-lift
> dark surfaces; every light value already matched. Each var present in both files was set to
> its `globals.css` value, block by theme, and a second dry run found 0 differences. Each file's
> header now dates the resync. This preview's local `.dark {}` override was removed and the
> preview re-run (24 cells, 0 failures; contrast figures unchanged). ⚠️ **Older previews were
> deliberately NOT re-run** — the runner re-syncs `tokens.css` on every run, so re-running
> `booker-ui` or a `dark-lift-*` preview would change the dark palette of a design already
> reviewed. Their committed copies stay as the record of what was approved.

### F4 — The hero's find button is 36 × 36  — noted, out of scope
`HomePage.module.css:219`. Clears WCAG 2.2 AA (24px) deliberately per its own comment (redesign
I43 tier 1); not 44. Unchanged by this plan.

### F5 — Drive's mark reads small  — noted, out of scope
Its PNG fills ~57% of its box (measured in the `booker-ui` preview). Shrinking the invisible disc
does not change the 32px art box. Fixing it means editing the asset, which this task forbids.

---

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains. -->

- **D1 — which white for dark labels? → A, `var(--db-strong)`** (resolved 2026-10-23, user).
  - **A — `var(--db-strong)` (#f1f5f9). Recommended.** Existing token; flips to #0f172a in light, so
    I1 is one rule for both themes. 13.32:1. Against the #ffffff logo it differs by 1.10:1 —
    not distinguishable at 10px — and it is the same ink as the section title above it.
  - **B — exact #ffffff.** A literal match. 14.59:1. Needs a new dark-only token (booker does not
    hard-code hex in a module), so two rules and a token instead of one rule.
- **D2 — trim the division widget's body padding? → A, scoped to the divisions tone** (resolved 2026-10-23, user).
  - **A — yes, scoped to `[data-tone="divisions"]` (−8px). Recommended.** The prompt asks for
    "unnecessary surrounding widget padding"; this is the only padding owned by that widget.
    Cost: `HomeSection`'s "one rule set, five tones" gains one tone-specific spacing rule.
  - **B — no.** `HomeSection` stays untouched; the widget saves 46px instead of 54 (total 86).
- **D3 — how does the location chip get smaller? → A, 32px pill in a 44px box** (resolved 2026-10-23, user).
  - **A — 32px visible pill inside an unchanged 44px tap box. Recommended.** Looks smaller, taps
    the same; the runner's 44px check still passes. Saves no height (the box is still 44px).
  - **B — a real 36px chip.** Saves 8px more. Clears WCAG 2.2 AA (24px) like the hero's find
    button (F4), but breaks this repo's 44px rule (ux-design §5) and the prompt's "must not
    depend on making controls hard to tap" — needs your explicit exception.
- **D4 — chip smaller on a phone only, or everywhere? → A, phone only** (resolved 2026-10-23, user).
  - **A — phone only. Recommended.** Matches "when on mobile view" and every other size change
    here; desktop stays untouched.
  - **B — every width.** Moves the rules out of the media query; adds `locationchip-*` to I7.
- Sub-line on a phone → **hidden** (your instruction, 2026-10-23; I8).
- Light labels → **one dark ink, not per-logo** (given in the prompt, 2026-10-23).
- Spacing → **phone only**; labels → **both widths** (prompt default; nothing found to contradict it, 2026-10-23).
- Page gap between shelves → **not touched** (2026-10-23): it spaces every shelf, so changing it
  is other cosmetic work. Each 4px off it would save ~4px per shelf; say so if you want it.

## DEFERRED / COSMETIC

- `HomeSection` header padding on phones (12/14px) — shared by every shelf; same reasoning as the page gap.
- Retiring `--div-*-label` entirely — still feeds the monogram fallback; not worth a second change.
- The Explore stylesheets' comments describing `--division-fg` as "the Home tile's LABEL colour" (`ExplorePage.module.css:12` and five siblings) become slightly stale after I1. They are warnings *against* using it, which stay correct; left alone to keep the change surgical.

---

## Execution order

✅ Approved 2026-10-23 — plan, preview, D1-A, D2-A, D3-A, D4-A.

1. ✅ **S1 — the CSS (I1–I5, I8–I10) and docs (I6).** Done 2026-10-23. One commit's worth, booker only. Then `npx tsc --noEmit`, `npm run lint` (18 pre-existing warnings is the baseline), `npm test`.
2. ✅ **S2 — baselines and looking (I7, F2, F6 hover).** Done 2026-10-23: 8 baselines re-recorded, suite 121/121 twice, live checks at 320/360/390/1280 × both themes.

Default cadence: one stage, then stop and report.

## Verification

| Item | Machine-verifiable | Needs a live environment / human |
|---|---|---|
| I1 | grep `.tileName` → `--db-strong`; `contrast.py`; `divisions-*`/`home-*` baselines differ only in label pixels | Look at both themes on a phone: labels read as captions, not as competing colour |
| I2, I3 | computed styles at 390px in `/ui-gallery?mode=home` (`home-narrow-*`); tile box ≥ 44 × 44 | Swipe the strip on a real phone; dots track; all 13 reachable; keyboard arrows scroll the focused strip |
| I4, I5, I8, I10 | hero box height at 390px (174); heading computes 19px at ≤640 and 27px at ≥641; search 48px; `.sub` computes `display: none` at ≤640 and renders at ≥641 | **F2:** heading wrap at 320 and 360 in Poppins; hero still looks like the page's lead without its sub-line |
| I9 | chip box ≥ 44 tall, painted pill 32; hit-test 2px inside top/bottom edge; long name truncates | Tap the chip's edges on a real phone; focus ring with a keyboard; hover on a touch laptop |
| Desktop | `home-*`, `homenear-*`, `divisions-*` at 900px differ **only** in label colour; `locationchip-*` unchanged | — |
| All | `tsc`, lint, `npm test`, full visual suite ×2 | — |

**Already verified (2026-10-23, preview only — not the app; re-run after I8/I9):** design-preview
runner 6 screens × 2 viewports × 2 themes = 24 cells, 9 checks, 0 failures (last run after I10) (the chip is a real
`<button>` now, so check 5 measures its 44px box); `narrow-check.mjs` at 320/360/390/641/1280 ×
both themes — zero document overflow, zero clipped labels, zero network requests, strip scrolls at
every phone width, every chip inside the hero and hit by a tap 2px inside its top and bottom edge
(all three states), desktop boxes identical between variants (chip 151 × 44 both). Visual
inspection of all six screens in both themes at both widths.

---

## Closing (2026-10-24)

**Shipped (committed, not yet deployed):** division tile labels in `--db-strong` at every width;
on phones a compact hero (19px balanced heading, sub-line hidden, 48px field, chip as a 32px pill
in a 44px tap box) and a compact division strip. Booker `80d58f7` on
`feature/spacing_color_patch`; root `5a36c5a`.

**Verified:** tsc, lint at its 18 baseline, 304/304 unit tests, visual suite 121/121 twice after
reviewing the 8 re-recorded baselines, live dev-server checks at 320/360/390/1280 × both themes,
and the user's real-phone check (2026-10-24: swipe, chip taps, focus).

**Still with the user:** pushing to staging (and later production). The staging look is not
part of this plan's verification; if anything differs there, reopen with a new item.

**Noted, not done:** F4 (36px find button), F5 (Drive's
small mark), F7 (320px shelf header wraps) — all pre-existing and out of scope.

**Docs updated:** `booker/AGENTS.md` (in `80d58f7`), `architecture/portals.md` → Booker → Home
(2026-10-24), parity plan C2 note (in `5a36c5a`).

