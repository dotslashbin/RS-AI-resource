# Booker UI — six fixes (search icon, account popup, division labels, Explore default, Activity density, code badge) + an Explore redesign proposal

**Date:** 2026-10-02
**App / scope:** `./booker` web only. No `backbone/`, no migration, no schema change, no `command/`, no mobile. Read-only references: `command/services/divisions.service.ts`, `backbone/supabase/migrations/20260724000004_divisions.sql`, `architecture/schema.md`.
**Status:** COMPLETE — build scope, 2026-10-02. All stages S1–S7 executed; B1 and I1–I9 shipped and measured; `tsc` clean, 177 tests, lint at its 18 pre-existing baseline, `next build` compiles; visual suite **89/89 on two consecutive full runs** against 28 re-recorded baselines. **S7-a closed by the user on 2026-10-02** — they reviewed the captures and committed. ✅ **F3 moved 2026-10-02** to `.plans/2026-09-29-booker-live-verification.md` as **L4**, where live checks belong; it is parked there until the staging push. **Nothing on this plan is waiting on me.** Option A chosen for the Explore redesign; it becomes its own plan.

> One-line framing: six self-contained UI defects in booker, each grounded in a browser measurement taken today, fixed without changing data, behaviour or canonical names — plus a **proposal only** for the larger Explore redesign, which is deliberately not an item in this plan.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, F# = finding; numbers are plan-local — qualify cross-plan refs by app (e.g. "booker I10").

---

## How these were verified before being written down

**A runtime preview of all six changes was produced on 2026-10-02 and is with the user** — the real app with the proposed CSS injected in the browser, no file edited: https://claude.ai/artifact/Jh13XfSmR4xr1yxrkdAJcP. It is what caught the I5 correction below.

Every claim below was measured in a real browser on 2026-10-02 against the user's running booker dev server on `localhost:3000` (`/ui-gallery`, the same fixture the visual suite uses), not inferred from reading CSS. That is the same workaround S7-d used in `.plans/2026-09-18-booker-home-search-redesign.md` — Playwright cannot start its own server on 3200 while a booker dev server holds 3000.

Scripts are throwaway and live outside the repo tree in `booker/node_modules/.cache/uicheck/` (gitignored, and **not** `test-results/`, which Playwright empties on every run). Screenshots are in the session scratchpad.

---

## BLOCKERS

### B1 — the sidebar account popup has NO background in either theme, and its contents overlap the controls behind it  ✅ DONE (2026-10-02)
**File:** `booker/components/layout/Sidebar/Sidebar.tsx:117`

```
className="w-52 z-50 rounded-xl p-1 bg-[var(--db-card)] border border-db-divider shadow-[…]"
```

`--db-card` **does not exist**. The token is `--db-card-bg` (`app/globals.css:52` light, `:276` dark). `background: var(--db-card)` with no fallback is an invalid value, so the element computes to `rgba(0, 0, 0, 0)`.

Measured (`[role="menu"]`, both themes, after clicking the account trigger):

| theme | computed `background-color` | result |
|---|---|---|
| light | `rgba(0, 0, 0, 0)` | fully transparent |
| dark  | `rgba(0, 0, 0, 0)` | fully transparent |

The screenshot shows the consequence exactly as reported: the red **"Sign out"** label renders on top of the **"About & Legal"** trigger text underneath it, two strings in the same 20px band, neither readable. The `z-50` and the Radix portal are both fine — **layering is not the bug, the background is.**

⚠️ **Do not "fix" this to `--db-card-bg`.** That is the F17 trap from `.plans/2026-10-01-booker-search-transition-and-topbar.md`: `--db-card-bg` is `rgba(255,255,255,0.028)` in dark — a 2.8% veil that hides nothing. A floating menu over page content needs an **opaque** surface.

**Fix approach:** move the content's styling out of the `className` string into `Sidebar.module.css` (`.accountMenu`) and use the panel tokens, which are the only opaque pair in this design system and already exist for exactly this purpose:
`background: var(--db-panel-bg)` (`#ffffff` / `#0c1220`), `border: 1px solid var(--db-panel-border)`, `box-shadow: var(--db-panel-shadow)`. The hardcoded `rgba(0,0,0,0.12)` shadow goes with it (it is invisible on the dark page; `--db-panel-shadow` is tuned per theme).
Also give the menu `min-width: 208px; max-width: calc(100vw - 32px)` so it cannot exceed a 360px viewport, and keep the email row's `--db-text` on the new opaque ground (re-measure contrast; `#5b6576` on `#ffffff` = 5.9:1, `#94a3b8` on `#0c1220` = 7.6:1 — both pass, but assert after the change rather than trusting these).

**Component separation:** `Sidebar.tsx` stays a render layer; the new rules land in the existing co-located `Sidebar.module.css`. No state, no hook change.
**✅ DONE (2026-10-02).** `Sidebar.tsx:117` now carries `styles.accountMenu` (plus `collisionPadding={12}`, so the menu cannot be pushed off a narrow viewport); the surface moved into `Sidebar.module.css` on `--db-panel-bg` / `-border` / `-shadow`.
**Verified — machine-measured in a real browser**, light and dark × 1280 and 360:
- computed `background-color` → `rgb(255,255,255)` light, `rgb(12,18,32)` dark. Was `rgba(0,0,0,0)` in both.
- contrast on the new opaque ground: email **5.89:1** light / **7.29:1** dark; "Sign out" **6.47:1** / **6.76:1**. All pass AA.
- width 208px and fully inside the viewport at 360px.
- screenshot: no overlap — "Sign out" and the "About & Legal" trigger are separate.
⏸ **Not yet verified:** the `sidebar` visual baseline, because Playwright could not start its server (see S7 and F1).

---

## IMPORTANT

### I1 — the Home search control submits with an arrow, not a search icon  ✅ DONE (2026-10-02)
**File:** `booker/components/home/HomePage/HomePage.tsx:104-106` (the `.searchGo` submit button, `<ArrowRight size={16} />`)

The field already carries a **decorative** magnifier at its left (`HomePage.tsx:87`, `.searchIcon`), so swapping the arrow for a magnifier alone would put two identical glyphs in one 52px control.

**Fix approach:** the submit button becomes the magnifier (`<Search size={16} />`, `aria-label="Find"` unchanged, `type="submit"` unchanged, `submitHeroSearch` untouched), and the decorative left icon is **removed** so the control carries exactly one search mark — the one that does something. `.searchIcon` is deleted from `HomePage.module.css`; `.search`'s left padding goes 16px → 18px to keep the caret off the border now that nothing precedes it.

⚠️ **Behaviour is unchanged**: `<form onSubmit>` still fires on Enter, `type="search"` still gives a phone keyboard its Go key, and the button still submits the same handler.
⚠️ **The top bar mirrors this control on purpose** (`TopBar.tsx:124-127`, plan I8 — "so both search entry points look alike"). Leaving one an arrow and the other a magnifier breaks that pairing → **D1**.
**✅ DONE (2026-10-02).** `HomePage.tsx` and `TopBar.tsx`: the submit glyph is `Search`, the decorative leading magnifier is gone from both, `ArrowRight` is no longer imported anywhere in booker. Hero padding 16px → 18px, top-bar field `pl-3` → `pl-3.5`, since nothing precedes the caret now.
**Verified in a browser:** each `form[role="search"]` contains **exactly one** `<svg>`, it is inside the submit button, and its shape is `circle+path` (the magnifier, not the arrow). `aria-label="Find"` and `type="submit"` unchanged. **Behaviour re-tested, not assumed**: a `submit` listener fired on Enter *and* on clicking the button.
⏸ Baselines `home`, `homesearching`, `topbarsearch` not re-recorded — F1.

### I2 — division labels read "EzzyCare", not "Care"  ✅ DONE (2026-10-02)
**Files:** `booker/lib/divisions.ts:45-59` (`DIVISIONS[].name`, hardcoded) · `booker/services/offerings.service.ts:69,101` (`divisionName` ← `divisions.name` from the DB) · consumers: `HomePage.tsx:151` (tiles), `ExplorePage.tsx:72` (chips), `OfferingResultCard.tsx:66,91`, `VendorResultCard.tsx:27`, `VendorPage.tsx:43`, `ShelfCard` via `HomePage.tsx:219`, `DivisionBadge`'s `title`.

**The Command question is answered: there is no display field to use.** `public.divisions` has `id, name, slug, sort_order, is_active, created_at, updated_at` and nothing else (`20260724000004_divisions.sql:12-20`). Command reads and writes exactly those (`command/services/divisions.service.ts:21,31,37`) and its only editable text is `name` ("New division name, e.g. EzzyBeauty"). So:

- **No `displayName` exists anywhere.** Adding one is a schema change plus a Command form change plus a read-path change — out of scope for this session and, in my judgement, not worth it for a prefix that is mechanical.
- The smallest change that would be needed if the user ever wants per-division control: `alter table public.divisions add column display_name text;` (nullable, no backfill, no constraint, no lock of consequence — it is a metadata-only `ADD COLUMN` with no default), Command's `updateDivision` and its form gain the field, and `getCatalogue` selects it with `display_name ?? name` as the fallback. **Documented, not proposed for now.**

**Fix approach (booker-only, no data touched):** one pure function beside the existing one that already solves this problem for monograms —

**a constant first, a derived fallback second** (resolved with the user 2026-10-02 — they asked which of the two it was):

```ts
export const DIVISIONS: { slug: DivisionSlug; name: string; label: string; hint: string }[] = [
  { slug: "ezzy-court", name: "EzzyCourt", label: "Court", hint: "Courts" },
  …
]

/** The display label for a division: the curated constant by slug, else the stored name with its Ezzy prefix stripped. */
export function divisionLabel(slug: string | null | undefined, name?: string | null): string
```

in `lib/divisions.ts`, with `lib/divisions.test.ts` cases for every slug, an unknown slug with an `"EzzyBeauty"` name, an unknown slug with a non-Ezzy name, a bare `"Ezzy"`, an empty string and `null`.

⚠️ **Not string manipulation alone, and the reason matters.** The 13 labels are editorial — the user can set "Health" instead of "Care" on any of them without touching a regex — and a curated label cannot be broken by a name that does not fit the pattern. The strip exists only for a division **Command adds after this build ships**, which has no entry here: without it such a division would render a raw "EzzyBeauty" beside twelve short labels. Every consumer already has `divisionSlug` in hand wherever it has `divisionName`, so the slug lookup reaches all of them, DB-sourced ones included.

⚠️ This is the same two-step shape as `divisionIcon()` (`divisionIcon.ts:43-59`): the bundled constant first, a derived monogram only when there is nothing to look up. Following that precedent rather than inventing a second idiom.

⚠️ **Explore's filter pills are in scope** — the user called them out by name on 2026-10-02. They are a `DIVISIONS` consumer (`ExplorePage.tsx:72` via `useExplorePage.ts:111`), so D2(b) already covers them; confirmed in the round-2 preview.

⚠️ **Canonical values are not altered.** `DIVISION_SLUGS`, `DIVISIONS[].name`, `divisionKey()`, `matchDivision()`'s haystacks (`divisionMatch.ts:26`) and `searchCatalogue`'s haystack (`search.ts:103,111`) keep the full `"EzzyCare"`, so typing "ezzycare", "ezzy" or "care" all still match exactly as today. The label is applied at the render layer only.
⚠️ **Scope of application is a decision** — Home's tiles only, or every division label in booker → **D2**.
**✅ DONE (2026-10-02).** `lib/divisions.ts` gained `label` on all 13 entries and `divisionLabel(slug, name)`; consumers switched: Home tiles + the city-vendor shelf subtitle, Explore's filter pills, `OfferingResultCard` (ribbon and footer), `VendorResultCard`, `VendorPage`, `DivisionBadge`'s `title`.
**Verified:** 5 new tests in `lib/divisions.test.ts` (curated label per slug, constant beats a stored name, the Command-adds-later fallback, a bare "Ezzy" kept rather than emptied, null/empty → ""). 177/177 pass. In a browser: Home tiles and Explore pills read Court…Law, result-card ribbons and feet read "Court"/"Ride"/"Other", vendor-card meta reads "Court · Makati · 3 services", badge tooltips read "Court", and `/Ezzy[A-Z]/` matches **nothing** on either page.
⚠️ **`DivisionIcon` still receives the canonical `name` on purpose** — its monogram is built from it, so `ezzy-ride` keeps reading **"ER"**, not "RI". Asserted in the same browser pass (`monogramsUnchanged: ["ER","ER","—","—"]`).
⏸ Baselines not re-recorded — F1.

### I3 — Explore shows a "start" panel instead of the catalogue when nothing is typed  ✅ DONE (2026-10-02)
**File:** `booker/components/explore/ExplorePage/ExplorePage.tsx:109-131` · `useExplorePage.ts:102,118`

`searchCatalogue()` **already returns every offering** when the query is empty and no filter is set (`search.ts:92,103` — `terms.length` is 0, so the name test is skipped). Nothing is missing from the data layer. The page simply renders a different branch: `showStart = !anyFilter` puts Recent searches + Popular categories on screen *instead of* the results.

`anyFilter = !!query.trim() || !!division || !!city` and `reset()` clears all three, so **"clearing returns to the all-offerings state" falls out of the same change** — no extra handler is needed.

**Fix approach:** delete the `showStart` branch from the render chain and render the results board whenever there is no error and no loading. The Recent / Popular pills are **kept, not dropped** (they are an existing feature), rendered above the board in the no-filter state only — exactly where they are now, with the board underneath → **D3** settles whether they stay there or move.

⚠️ **A bound on what is rendered is required, not optional** (I4). Today the start panel was also acting as an accidental cap: with it gone, the no-filter state renders one card per catalogue row and fires `getCoverPhotos()` for every one of them. `fetchAllPages` pulls up to **10,000** offerings (`lib/pagedFetch.ts:58`) and `getCoverPhotos` chunks ids 50 at a time **sequentially** (`offeringPhotos.service.ts:23,46`) — 10,000 offerings would be 200 serial round-trips on opening Explore.
⚠️ The existing truncation note (`ExplorePage.tsx:88-92`, "Showing part of the catalogue") stays and is now more load-bearing, since "everything" is what the page claims to show.
⚠️ `resultLine` already handles a query-less count ("42 results") — `lib/search.ts:164`. No copy change needed, though D3 may add a heading.
**✅ DONE (2026-10-02).** The `showStart` branch no longer replaces the board; the Recent/Popular shortcuts render **above** it in that state, and the board renders whenever there is no error and no loading.
**Verified in a browser, four states:** arriving with a division preselected → unchanged no-results panel; nothing typed/filtered → shortcuts **and** the count line; a query with no hits → the dedicated no-results panel; **after Clear → back to shortcuts + count line.** A new `search.test.ts` case locks in the premise that an empty query returns all 30 of 30 offerings (and no vendors, which is deliberate).
⏸ Baseline `explorechips` not re-recorded — F1. It sets a division, so it keeps the no-results branch and is not expected to move.

### I4 — bound the Explore result board (supports I3)  ✅ DONE — build (2026-10-02), live check tracked by F3
**File:** `booker/components/explore/ExplorePage/useExplorePage.ts:80-93` and `ExplorePage.tsx:161-176`

**Fix approach:** `useExplorePage` gains `visibleCount` state (initial 24), resets to 24 whenever `query`/`division`/`city` change, and exposes `visibleServices = results.services.slice(0, visibleCount)`, `hiddenCount` and `showMore()`. The cover-photo effect keys off `visibleServices` instead of `results.services`, so the photo fetch is bounded to at most one chunk per reveal. `ExplorePage.tsx` renders a "Show more (N remaining)" button under the grid.

This is state + a handler in the hook and markup in the `.tsx` — the render/hook split is preserved, and the button's styling goes in `ExplorePage.module.css` (`.showMore`, reusing `.stateAction`'s token set).

Applies to filtered results too, which are unbounded today — a pre-existing exposure that this item closes rather than introduces.
**🔄 BUILT, PART-VERIFIED (2026-10-02).** `useExplorePage` reveals 24 cards and `showMore()` adds 24; the cover-photo effect is keyed to the revealed slice, not every match; `ExplorePage` renders "Show more (N remaining)".
⚠️ **Changed from the plan during execution: no `useEffect`.** The first cut reset the count in an effect keyed on the filters, which `npm run lint` rejected (`Calling setState synchronously within an effect can trigger cascading renders`) — and it was right: that renders the long list, then re-renders short. It is now **derived** — the filter signature is stored beside the count, so a filter change reads as 24 in the same render. Lint back to its 18 baseline.
⏸ **What is NOT verified: the 24-cap and the photo-request bound themselves.** The only Explore fixture ships an **empty catalogue on purpose** — `csp.spec.ts` asserts the fixture makes no network call, and seeding offerings would fire `getCoverPhotos` and break it. So the cap has no local exercise. The build is ✅; **the live check is carried as F3 ⏸ and remains open.**

### I5 — the Activity bookings table is cramped, and badly so below 900px  ✅ DONE (2026-10-02)
**File:** `booker/components/activity/BookingList/BookingList.module.css:43-81,117-133`

Measured at four widths (first row of "My bookings", dark theme, frozen clock):

| viewport | row width | row height | main (name+meta) | progress | status pill |
|---|---|---|---|---|---|
| 1280 | 858px | 72px | **295px** | **325px** | 86px |
| 820  | 754px | 112px | 560px | 714px (own line) | 86px |
| 420  | 354px | 112px | **160px** | 314px | 86px |
| 360  | 294px | 112px | **100px** | 254px | 86px |

Four concrete defects, in order of how much they cost:

1. **The decoration is wider than the content.** The grid is `auto minmax(0,1fr) minmax(0,1.1fr) auto auto` (`:45`), so the progress track gets **1.1×** the name column — 325px against 295px at 1280. The booking's own name and meta line are the thing being read; they have less room than the step rail. The meta line is already at its truncation limit at 1280 (`scrollWidth` 295 = `clientWidth` 295) with a 18-character vendor name, so any longer vendor truncates on a **desktop**.
2. **At ≤900px the name column collapses to 100–160px** while the status pill keeps a fixed 86px beside it. The screenshot at 420px shows "Weekly G…", "Metro Fitnes…" — the offering name, which is the row's subject, is the first thing sacrificed.
3. **The tab strip overflows its card at 420px** — "Cancelled" is clipped to "Can…" at the card's right edge, with no scroll affordance (`.tabs`, `:11`, is a plain flex row with no wrap and no overflow handling).
4. **`.row > :global(span:first-of-type)` (`:127`) is a fragile positional selector** — it reaches into `DivisionBadge`'s DOM from a parent stylesheet and breaks silently if a `<span>` is ever added before the badge.

**Fix approach** (layout and spacing only — **every element, action and value stays**):
- ⚠️ **The column rebalance is withdrawn — it was built and measured on 2026-10-02 and it made things worse.** The proposal was `auto minmax(0, 1.4fr) minmax(0, 1fr) auto auto`. Applied at runtime at 1280, it pushed the progress rail from 325px to 255px and a **third** step label into truncation (baseline is 2 truncated, measured; 1.4fr → 3, 1.15fr → 3, no rebalance → 2). There are only 612px to share between the two columns at this page's 1080px cap, and the rail needs ~300px for five labels. The columns stay as they are. **The desktop change is the padding and the meta wrap alone**, which is what actually revealed "Payment pending" in the preview: row padding 14px → 16px, `column-gap: 14px → 16px`.
- Let the meta line breathe instead of truncating: drop `white-space: nowrap` on `.meta` and allow it two lines (`-webkit-line-clamp: 2`), keeping `.offering` single-line-with-ellipsis. Row height grows only when the text needs it.
- Add a **new** breakpoint at ≤560px where the row goes to two named areas — `"badge main" "progress progress"` with the status pill moving **under** the title inside `.main` — so the name gets the row's full remaining width (≈254px at 360 instead of 100px) and the pill no longer competes with it. Between 560 and 900 the current three-column arrangement is kept.
- `.tabs` gets `overflow-x: auto; scrollbar-width: none;` with `flex: none` triggers, so "Cancelled" is reachable at 360px.
- Replace the positional selector with an explicit class: `BookingList.tsx` wraps the badge in `<span className={styles.badgeCell}>` and the stylesheet targets that. (One wrapper element; the badge component is untouched.)

**Component separation:** all of the above is CSS in the existing co-located module plus one wrapper span; `useBookingList.ts` is unchanged; no inline styles are introduced.
**✅ DONE (2026-10-02).** Row padding 14px → 16px with a 16px column gap; `.meta` wraps to two lines (three below 560px); a new ≤560px layout puts the status pill on its own row **under** the title, in the title's column, with the badge spanning both rows; `.badgeCell` replaces the positional `:global(span:first-of-type)`; the tab strip scrolls.
**Verified by re-measuring 1280 / 820 / 420 / 360:** the name column went **100px → 198px at 360** and 160px → 258px at 420; the offering name is no longer clipped at any width; every row's meta is fully shown, including "· Payment pending"; all four tabs exist and "Cancelled" is reachable after scrolling the strip; no horizontal page overflow; all five row children still render.
⚠️ **Two defects in my own first cut, found by looking at the 360px shot and fixed:** (1) `overflow-x: auto` on `.tabs` did **nothing** — the strip simply grew past the card, which clips it with its own `overflow: hidden`, so the strip never overflowed *itself*; it needs `max-width: 100%` **and** `min-width: 0` on the Radix `Tabs.Root` wrapper (now `.tabsRoot`). (2) A two-line clamp still cut "Payment pending" at 360px; the clamp goes to three lines there.
⚠️ **Progress-step labels still truncate — 2 at 1280, unchanged from the pre-existing baseline** measured before the change. Not introduced here, and not fixed here.
⏸ Baseline `activity` not re-recorded — F1.

### I6 — a 5- or 6-character offering code overflows its tile on Activity and Payments  ✅ DONE (2026-10-02)
**File:** `booker/components/ui/DivisionBadge/DivisionBadge.module.css:40-42`

`offerings.code` is **up to 6 uppercase characters** (`20260506000001_offerings.sql:32`, `check char_length(code) <= 6`). The tile is a fixed square with **zero padding** and no overflow handling.

Measured in Poppins 800 with the badge's own computed `letter-spacing: -0.01em`, in the live page:

| size | box | font | "CRT" | "COURT" | "RENTAL" |
|---|---|---|---|---|---|
| `sm` (Payments rows) | 34×34 | 10px | 22.7px ✅ | **39.5px — 5.5px over** | **43.3px — 9.3px over** |
| `md` (Activity rows, Needs you, Book again) | 40×40 | 11px | 24.7px ✅ | **43.5px — 3.5px over** | **45.3px — 5.3px over** |
| `lg` (Up next, booking detail) | 48×48 | 12px | 27.7px ✅ | 46.5px ✅ (1.5px spare) | **50.3px — 2.3px over** |

The tile is `display: flex; justify-content: center` with no `overflow`, so an over-wide code bleeds symmetrically past both edges, over the 14px gap and into the title column. The gallery fixture only ever uses 3-letter codes (`CRT`, `CLS`, `DIV`), which is why no baseline has ever caught this. 11px/800 is also below a comfortable floor for an all-caps abbreviation.

**Fix approach:** make the tile a **fixed-height, auto-width** chip with a square minimum — the code decides the width, the row's `auto` grid column absorbs it:

```css
.badge { padding: 0 7px; border-radius: 12px; overflow: hidden; }
.md { min-width: 40px; height: 40px; font-size: 12px; }
.sm { min-width: 34px; height: 34px; font-size: 11px; }
.lg { min-width: 48px; height: 48px; font-size: 13px; }
```

A 3-letter code keeps its square (24.7px text + 14px padding = 38.7px < 40px min-width, so it stays exactly 40×40 and **nothing moves on the common path**); "RENTAL" at `md` becomes 50.3 + 14 = 64px wide and is fully legible. Rounded `min-width`/`height` keeps the shape; `width` is dropped.

⚠️ **Image behaviour is untouched** — `DivisionBadge` never renders an image, and `DivisionIcon` (which does) is a different component and is not edited.
⚠️ The exact shape is a visible design call → **D4**.
⚠️ The badge has no visual coverage for long codes → **I8**.
**✅ DONE (2026-10-02).** `width` → `min-width`, `padding: 0 5px` (4px at `sm`), `overflow: hidden`, font +1px at each size.
**Verified by measuring every size × 2/3/5/6-character codes, plus the neutral unknown chip:** nothing clips anywhere; `CT`/`CRT`/`NEW` render at exactly **34 / 40 / 48** — the old squares — and in situ every three-letter code in Activity (40px) and Payments (34px) is unchanged; `COURT` and `RENTAL` grow to 51–66px and fit.
⚠️ **The padding was corrected mid-stage, by measurement.** At the planned 7px, the +1px font pushed a plain three-letter code 2–5px past the old square: "nothing moves on the common path" was arithmetic done at the **old** font size and was false once both changes landed together. The stale claim in the stylesheet comment was rewritten rather than left to mislead.
⏸ Baselines not re-recorded — F1.

### I9 — Home's header artwork reaches the Activity and Payments grouping headings  ✅ DONE (2026-10-02)
**Files:** `booker/components/home/HomeSection/HomeSection.module.css:46-77` (the source treatment) · `booker/components/activity/BookingList/BookingList.module.css:2-9` (`.head`) · `booker/components/payments/PaymentMonthGroup/PaymentMonthGroup.module.css:2-10` (`.head`) · `booker/app/globals.css` (the shared utility)

Asked for by the user on 2026-10-02, alongside I6. Home's shelves carry a header treatment nothing else in booker uses: a 4px accent pipe at full strength, a wash of that accent at 6%/10%, and an arc-and-stroke band confined to the last 200px (D27's four alphas). "My bookings" and each Payments month bar are the same kind of heading and have none of it — `BookingList`'s head is bare and `PaymentMonthGroup`'s is a flat `--db-sub-bg`.

**Fix approach:** ⚠️ **extract, do not copy.** `HomeSection.module.css`'s own comment says why: "ONE rule set … Hand-writing five headers is how 'squared' became five edits the first time round." The pipe, wash, arcs and strokes move into a shared utility in `app/globals.css` beside the existing `.db-card` / `.db-badge` utilities — `.db-shelf-head` + `.db-shelf-pipe`, everything derived from one `--section-accent` exactly as today — and `HomeSection` becomes its first consumer with no visual change. The two new headings then set only their accent and add one `<span>` for the pipe:

- **Activity** → `--db-toggle-on` (the app blue, the same accent Home's division shelf uses).
- **Payments** → `--db-tone-money-fg`, the accent its own totals already use. ⚠️ **Not `--div-ezzy-well-deep`**, which is what Home's "popular" tone uses: that token is the same value in both themes because it is built for white text on a coloured band, and at 10–26% alpha on the dark month bar it is invisible. Measured in the preview — the first pass used it and the band could not be seen. `--db-tone-money-fg` flips per theme (`#6d28d9` / `#c4b5fd`) and reads in both.

**Component separation:** CSS only, plus one `<span className={...pipe}>` per heading in each `.tsx`. No state, no hook change, no inline styles.

⚠️ `HomeSection`'s captures (`home`, `popular`, `opentoday`, `bookagain`) must come back **pixel-identical** after the extraction — that is the proof the refactor was lossless, and it is the first thing to check in S7.
**✅ DONE (2026-10-02).** `.db-shelf-head` / `.db-shelf-pipe` extracted verbatim into `app/globals.css`; `HomeSection` is its first consumer; `BookingList` and `PaymentMonthGroup` set only an accent (`--db-toggle-on` and `--db-tone-money-fg`) and add a pipe span.
**Verified — the extraction is lossless, proved not asserted:** every Home shelf tone was screenshotted before and after and compared by **md5**; all **12** captures (5 tones × 2 themes across the `home`, `popular`, `opentoday` and `bookagain` fixtures) are **byte-identical**, and every computed `background-*`, padding, border and pipe box matches.
**The two new headings verified in both themes:** the arc gradient is present, the band is 200px, the pipe is 4×20 and vertically centred, and the accent resolves per theme (blue `rgb(37,99,235)`; money `#6d28d9` light / `#c4b5fd` dark).
⚠️ **`--db-tone-money-fg`, not Home's "popular" purple** — the first pass used `--div-ezzy-well-deep` and the band was **invisible** on the dark month bar, because that token is the same value in both themes by design. Measured, then changed.
⚠️ `align-items: baseline` → `center` on the month bar: the pipe is a block with no text baseline, so baseline alignment dropped it below the month name.
⏸ Baselines `activity`, `payments` not re-recorded — F1.

### I7 — the About & Legal popover carries the same near-transparent background in dark  ✅ DONE (2026-10-02)
**File:** `booker/components/layout/LegalMenu/LegalMenu.module.css:39-47` (`.content { background: var(--db-card-bg) }`)

Found while fixing B1, in the same sidebar block, one element away. This token is *valid*, so the popover is opaque in light (`#ffffff`) — but in dark it is `rgba(255,255,255,0.028)`, a 2.8% veil over whatever is behind it. Same F17 trap, lesser symptom: the six policy links sit over the page rather than on a surface.

**Fix approach:** the same three panel tokens as B1 (`--db-panel-bg` / `-border` / `-shadow`). One stylesheet, three lines.

Reported rather than fixed silently, per AGENTS.md "Surgical changes" — it is **not** closed by this plan unless the user approves it as part of B1's stage.
**✅ DONE (2026-10-02).** `LegalMenu.module.css` `.content` moved onto the same three panel tokens, replacing `--db-card-bg` and the fixed `rgba(0,0,0,0.12)` shadow that is invisible on the dark page.
**Verified:** computed background `rgb(12,18,32)` dark / `rgb(255,255,255)` light, at 1280 and 360.
⚠️ **`width: 208px` was deliberately kept.** The first pass changed it to `min-width`, which widened the popover to 248px — a layout change I7 never asked for, and the 208px is a documented choice (the rail is 224px wide). Reverted; only the three colour declarations changed.
⏸ **Not yet verified:** the `legal` visual baseline — same reason as B1.

### I8 — no visual coverage for either thing being fixed: popover contents and long codes  ✅ DONE (2026-10-02)
**File:** `booker/app/ui-gallery/page.tsx` · `booker/visual-tests/pilot.spec.ts:21-28`

Two gaps, both of which are why B1 and I6 reached a shipping screen:
- **Dropdown/popover contents are never screenshotted.** The gallery says so explicitly for `LegalMenu` (`page.tsx`, `legal` mode: "Radix owns that open state … the six links inside are tsc- and build-covered only"). The account menu has the same hole, and the bug lived there.
- **Every fixture code is three letters**, so the one defect in I6 is invisible to all 77 captures.

**Fix approach (smallest useful):** one new gallery mode, `codebadge`, rendering `DivisionBadge` at `sm`/`md`/`lg` × `"CT"`, `"CRT"`, `"COURT"`, `"RENTAL"` on one row each, registered in `pilot.spec.ts`'s `modes` array. That covers I6 permanently and costs two baselines.

The **open popover** is deliberately *not* given a mode: forcing it open needs a `defaultOpen` prop that no product code would pass, which the fixture already rejected once for `LegalMenu`. B1 and I7 are verified by computed-style measurement and a reviewed screenshot instead, and that limit is recorded here rather than papered over.

⚠️ Registering a mode and accepting its baseline are the same act — the new capture needs the user's eyes before it is committed.
**✅ DONE (2026-10-02).** `codebadge` added to `app/ui-gallery/page.tsx` and registered in `visual-tests/pilot.spec.ts`: three sizes × `CT` / `CRT` / `COURT` / `RENTAL`, plus an unknown slug that must stay neutral. Pure display, so the fixture still makes no network call and `csp.spec.ts` stays honest.
⚠️ The open-popover gap is deliberately **not** closed, as this item said: forcing a Radix menu open needs a `defaultOpen` no product code would pass. B1/I7 are covered by computed-style measurement instead.
⏸ **The two new baselines do not exist yet** (F1), and registering a mode and accepting its baseline are the same act — they need the user's eyes in S7.

---

## FINDINGS (discovered during execution)

### F1 — the visual suite cannot run while a booker dev server holds port 3000  ✅ RESOLVED (2026-10-02)
**Unblocked by the user, who stopped their dev server.** The suite then ran normally on 3200. Kept as the record, because the condition recurs every time a dev server is up.

⚠️ **A second trap caught in the same breath, and it is the one to remember.** The first run was launched as
`npx playwright test > log 2>&1; echo "EXIT=$?"`, and the harness reported **"completed (exit code 0)"** — which is the exit status of the trailing **`echo`**, not of Playwright. The suite had actually failed **28 of 89**. This is the `playwright-rerun-discipline` failure in a new disguise: not a pipe to `tail` this time, but a compound command whose last statement is not the one under test. **Write the status to a file (`echo "EXIT=$?" > file`) and read the `N passed` / `N failed` lines**; never trust a wrapper's exit code for a command that is not last.

### F1-original — the blocker as first recorded  ⏸ (superseded by F1 above)
Known before this plan (booker AGENTS.md, and the memory note), confirmed again in S1: `npx playwright test --grep "ui-gallery (sidebar|legal)"` fails with `[WebServer] ⨯ Another next dev server is already running` → `Process from config.webServer was not able to start`. `reuseExistingServer` does not help because the config's server is on **3200** and the running one is on 3000.
⚠️ **A hand-rolled pixel comparison against the committed baselines is not a substitute**: the config starts its server with `PW_TEST=1`, which sets `devIndicators: false` (`next.config.ts:177`), so a shot taken against the user's ordinary dev server carries Next's dev indicator and would diff for a reason that has nothing to do with the change.
**Unblocked by:** the user stopping their dev server (`ss -ltnp` → kill the LISTENING pid) before S7.
**Expectation, not verification:** neither the `sidebar` nor the `legal` capture includes popover *contents* — the fixture says so explicitly for `LegalMenu` — so neither baseline should move. That is a prediction to check in S7, not a result.

### F3 — the Explore reveal cap cannot be exercised locally  ➡️ MOVED (2026-10-02)
I4's 24-card cap and its bound on the cover-photo fetch have **no local test**, because the one Explore fixture (`explorechips`) ships an empty catalogue deliberately: `csp.spec.ts` asserts that fixture makes no network call, and seeding offerings would fire `getCoverPhotos` and break it. The branch logic and the clear-returns path were verified against the empty catalogue; the cap itself was not.
**Unblocked by:** a live check on staging with real catalogue data — count the rendered cards and the photo requests on opening Explore.
➡️ **MOVED 2026-10-02, on the user's instruction, to `.plans/2026-09-29-booker-live-verification.md` as L4**, which is the plan that owns checks needing a live environment. It is parked there with L1 and L2 until the staging push. **Tracked there now, not here** — this entry stays as the record of where it came from.

### F2 — the account menu's keyboard highlight was suspected missing; it is not  ✖ CLOSED (2026-10-02)
`.item` styles `:hover` but nothing for Radix's `data-highlighted`, so a keyboard user looked unserved. Measured instead of assumed: `ArrowDown` sets `data-highlighted`, moves `document.activeElement` to the item, and the browser draws its default focus ring (`outline: auto 1px`), which is clearly visible in both themes. **No defect, no change made.** Recorded so it is not re-opened.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains — plan-authoring §7. -->

- **D1 — does the top bar's submit button change with Home's (I1)?** → **(b) both controls** (resolved 2026-10-02) — the I8 pairing is a documented decision and splitting it would be a regression nobody asked for. Home and the top bar each get a magnifier submit button and each loses its now-redundant decorative leading magnifier. The top bar's button is a filled blue 24px tile, so its glyph is `Search size={13}`; Home's is `Search size={16}`.

- **D2 — where do the shortened division labels apply (I2)?** → **(b) every division label in booker** (resolved 2026-10-02) — Home tiles, Explore chips, offering and vendor result cards, the vendor page, and `DivisionBadge`'s `title`. One label per division across the app; two names for one division on two screens is the F65/F6 bug class in words rather than colour. Canonical `name`, `slug`, `divisionKey()`, `matchDivision()` and `searchCatalogue()`'s haystacks are untouched, so "ezzycare", "ezzy" and "care" all still match.

- **D3 — what does Explore show when nothing is typed (I3/I4)?** → **(b) pills above the board** (resolved 2026-10-02) — Recent searches and Popular categories keep their current position and markup, with the count line and the all-offerings grid below them. Reveal size confirmed: **24 cards, "Show more" adds 24**.

- **D4 — what shape is the code tile (I6)?** → **(a) auto-width chip with a square minimum** (resolved 2026-10-02) — fixed height, `padding: 0 7px`, `min-width` equal to today's square, font +1px at each size. A 3-letter code renders at exactly today's 40×40 / 34×34 / 48×48, so the common path does not move; "COURT" becomes ~58×40 and "RENTAL" ~64×40 at `md`. Option (b) was rejected on the measurement — a 48px square still clips a 6-character code at 13px, so it would not have satisfied the requirement.

- **Does I7 (About & Legal) ship with B1?** → recommended **yes**: same defect class, same file area, three lines, and leaving it means fixing the sidebar's bottom block twice. Resolved by the user's approval of B1's stage.

---

## DEFERRED / COSMETIC

- **The account trigger and the popup repeat the same email twice** (`Sidebar.tsx:107` and `:120`). Acceptable: the popup's header is the conventional confirmation of *whose* account is about to be signed out, and booker has no display name to put there (the shell only carries `userEmail`). Revisit if a profile name ever reaches the shell.
- **`divisions.display_name`** — the schema change I2 would need if per-division display control is ever wanted. Not proposed; documented in I2 with its blast radius so the option is on record.
- **Payments' narrow-screen badge is auto-placed, not assigned.** `PaymentMonthGroup.module.css:97` names a `badge` area that nothing claims, so the tile lands there only because auto-placement finds the empty cell. It renders correctly today (measured at 420 and 360). Cosmetic-but-fragile; out of scope for item 6, which is about legibility.

---

## Execution order

One stage at a time (developerboss cadence). Each stage ends with `npx tsc --noEmit`, `npm run lint` and `npm test` in `booker/`, plus the item's own check, then a report.

1. **S1 — B1 (+ I7 if approved).** Independent, highest severity, no decision beyond "does I7 come along".
2. **S2 — I1.** Needs D1.
3. **S3 — I2.** Needs D2. Pure function + tests first, then the consumers.
4. **S4 — I3 + I4 together.** Needs D3. They ship as one batch: I3 without I4 is a performance regression, and I4 without I3 has nothing to bound.
5. **S5 — I5.** Independent.
6. **S6 — I6 + I8.** Needs D4. The fixture mode lands with the fix so the first baseline shows the fixed state.
6b. **S6b — I9.** Runs after S6 so Activity and Payments are re-shot once, not twice. The `globals.css` extraction lands first and Home's captures are proved unchanged before either new heading adopts it.
7. **S7 — baselines.** ✅ DONE (2026-10-02). See below. ⚠️ **Never `npm run test:visual:update`** — it is unscoped and accepts every drift; the scoped `--grep … --update-snapshots` form was used.

### S7 — what was actually run  ✅ DONE (2026-10-02)
1. **Full suite FIRST, before touching a baseline** — so the failure list was authoritative, not predicted: **28 failed, 61 passed** of 89.
2. **Every failure maps to an intended change**, and the pixel deltas say which:
   - `activity` 78.7k px · `card` 80.2k · `payments` 69.4k — I5's row relayout, I6's chip and I9's heading together.
   - `explorechips` 23.3k · `home` 7.0k · `resultcard` 2.6k · `vendorcard` 3.3k — I2's shortened labels reflowing.
   - `homesearching` 5.4k · `topbarsearch` 0.6k — I1's icon swap.
   - `bookagain` 77 px · `bookingdetail` 49 px · `upnext` 66 px · `needsyou` 219 px — I6's +1px font on a three-letter code, nothing else.
   - `codebadge` — new mode, no baseline (fails while writing the actual, as expected).
3. **The modes NOT touched all passed**, which is the useful half of the result: `sidebar` and `legal` passed, confirming S1's prediction that popover *contents* are never captured; **`popular`, `opentoday` and `divisions` passed**, which proves the I9 `globals.css` extraction was lossless against the **committed** baselines — stronger evidence than the md5 check I ran during S6b.
4. **Diffs reviewed before re-recording** (`test-results/` is emptied by the next run): `activity-dark` shows change confined to the "My bookings" card; `home-dark` shows only the hero icon, the 13 tile labels and one code badge, with the shelf headings showing **no** diff; `payments-dark` showed the whole list shifted, which was **measured rather than waved through** — the month heading grew exactly **2px** (40 → 42) because the 20px pipe is taller than the 18px text line, so every row below moves 2px. Deliberate consequence of the pipe, not a regression.
5. **Re-recorded scoped** to the 14 affected modes, then **two consecutive full unscoped runs: 89/89, exit 0, zero failures** — the second because `.db-card` carries `backdrop-filter` in dark, which has flaked here before.
6. **Result: 26 baselines modified, 2 new** (`codebadge-light/dark`), plus `pilot.spec.ts`.

✅ **S7-a — the user's review (2026-10-02).** They checked the captures and committed: "Committed and checked, they're all good." A passing suite only ever proved *stability* — this is the step that establishes correctness, and it is theirs, not the suite's.

⚠️ **The visual suite needs port 3000 free.** Playwright starts its own server on 3200, but a booker dev server already running on 3000 makes it fail with "Another next dev server is already running". The user stops theirs (`ss -ltnp` → kill the LISTENING pid) before S7, or S7 waits.

---

## Verification

| Item | Check | Kind |
|---|---|---|
| B1, I7 | computed `background-color` of `[role="menu"]` / `[data-radix-popper-content-wrapper]` is opaque in **both** themes; screenshot shows no text overlap | measured in a browser (scripted), + human look |
| I1 | `grep ArrowRight components/home` returns nothing; form still submits on Enter and on click | grep + browser |
| I2 | `lib/divisions.test.ts` covers all 13 names, a non-Ezzy name, `"Ezzy"`, `""`, `null`; `search.test.ts` still passes unchanged (canonical haystacks untouched) | `npm test` |
| I3, I4 | with no query/filter the board renders; `reset()` returns to it; rendered card count is capped at 24 and the cover-photo request count matches | browser + node test on the slice |
| I5 | re-measure row/column widths at 1280/820/420/360; no horizontal overflow at 360; every element still present in the DOM | measured in a browser (scripted) |
| I6 | re-measure text width vs box for 2/3/5/6-character codes at all three sizes; no overflow | measured in a browser (scripted) |
| I8 | new `codebadge` baselines exist and are reviewed | `npm run test:visual` + human |
| all | `npx tsc --noEmit`, `npm run lint` (baseline is 18 pre-existing), `npm test`, `npm run build` | machine |

**What a machine cannot do here:** judge whether the re-recorded captures *look* right. That is the user's, as it was for S7-a in the redesign plan.

---

# APPENDIX — Explore redesign: three proposals (NOT items in this plan)

**✅ OPTION A CHOSEN (2026-10-02).** It becomes its own plan once this one is approved; it is still **not** an item here and nothing in it executes. Its five deltas were drawn at 1280 and 390 in the round-2 preview: the head pins on scroll, each pill carries its division's mark painted through a CSS mask, the pills become one scrolling row on a phone, Where and the shortcuts collapse into pills there, and the `What do you want to book?` heading goes. Nothing else — no new mode, no matcher change, no change to the result cards.

Per the user's instruction: proposals only. **Nothing here executes.** When an option is chosen it becomes its own plan (`.plans/2026-10-0X-booker-explore-redesign.md`) — which is also why no `OPEN:` line above covers it, so the gate on the six fixes is not held hostage to a design choice.

**What Explore is today** (`ExplorePage.tsx`, 980px max width, single column): an `<h2>` prompt, one 52px search field with an inline Clear, a wrapped row of **13 text-only division chips**, a "Where" `<select>`, then either the start panel, a no-results panel, or Vendors + Services grids (230px / 280px minimum card widths).

**Constraints every option must respect** (these are measured facts, not preferences):
- ⚠️ **Four division marks are near-black line art** — `ezzy-food` mean luminance 1, `ezzy-home` 38, `ezzy-care` 48, `ezzy-learn` 68. A mark drawn **without** its tinted disc must be painted through `-webkit-mask-image` + a token colour, never an `<img>`, or it vanishes in dark (booker AGENTS.md; `SearchingOverlay` and `OfferingResultCard` already do this).
- ⚠️ Ink on a division tint is **`--division-deep`**, never `--division-fg` (fails AA on tint for all ten, worst 2.25:1).
- ⚠️ `ezzy-ride` has **no logo file** — the monogram path is live, not defensive.
- ⚠️ 13 divisions, not 12 or 8 — read from `DIVISIONS`, never hardcoded.
- Typing never fetches; matching is the in-memory catalogue (`lib/search.ts`).
- "When" (Today / This weekend) stays parked (redesign plan P10) — it needs a schedules query per result.

---

## Option A — "Catalogue first": a sticky filter bar over a single result grid

**Shape.** The search field, the division pills and Where collapse into one sticky bar at the top of the scroll container. Below it, one continuous grid of offering cards. No modes, no panels — the page is always the catalogue, filtered.

- **Default (nothing active):** every offering, newest-feeling first (current order: by code), with "248 services" as the count line and the pills all unselected. Recent searches become a small row of ghost pills inside the bar, visible only until the first keystroke.
- **Searching:** the grid re-filters as the bar stays pinned; Vendors appear as a labelled band **above** Services only when a query is typed (today's behaviour, kept).
- **Filters:** a selected pill tints with its division (`--division-tile` + `--division-deep`, as the chips already do) and a "Clear" chip appears at the end of the pill row.
- **Empty:** the grid area holds the existing empty panel and the bar stays, so the next attempt is one tap away.
- **Mobile:** the bar keeps the field full-width on line 1; pills become a horizontally scrolling single row (snap, no wrap) on line 2; Where moves into a small "Filters" sheet so line 3 disappears. Cards go one per column below 560px.
- **Pills + icons:** 28px mark on the pill's leading edge, drawn through the CSS mask so the four dark marks survive; the pill is tinted only when selected.

**Tradeoffs.** Cheapest to build from what exists (the data path is already "filter the in-memory catalogue"), and the default state needs no invention. Sticky bars cost vertical space on short phones, and with 13 pills in a scroller the last few divisions are never seen without a swipe.

## Option B — "Browse by division": a division board that turns into results

**Shape.** With nothing active, Explore is a **board of 13 division cards** (the Home tile language, one size up, each with its mark on its tint and a count: "EzzyCourt · 18 services"). Tapping one, or typing, replaces the board with the filtered result grid plus a breadcrumb ("Courts · 18 results · Clear").

- **Default:** the board — which is *not* "all offerings" on screen at once, so **this option only satisfies item 4 if a "Show everything (248)" card or link sits on the board**. That link is load-bearing, not decoration.
- **Searching:** the board is replaced by results the moment a term is committed; the division of a sole-result set tints the breadcrumb (`soleResultDivision`, already built).
- **Filters:** selecting a division *is* the navigation; Where stays as a select in the result header.
- **Empty:** a panel with "Back to all divisions" as the primary action — the one option where the empty state has somewhere obvious to go.
- **Mobile:** the board is a 2-column grid of tiles (the Home tile already works at 128px minimum), which is the most phone-native of the three; results are one column.
- **Pills + icons:** there are no pills in the default state — the mark *is* the card. In the result state the active division shows as one tinted pill with its mark.

**Tradeoffs.** The strongest sense of place and the best mark showcase, and it reuses the division tile that was already designed, measured and contrast-tested. But it adds a mode (board ↔ results) to a page that has none, and it reads as a *detour* for someone who arrived already knowing what they want — and it satisfies "show all offerings by default" only through an extra link, which is a weaker reading of item 4 than A or C.

## Option C — "Search with a rail": persistent left filter rail, results always present

**Shape.** Two columns from `lg` up: a 200px rail of divisions as a vertical checklist (mark + name + count, multi-select), and the result grid beside it. The search field sits above both, full width.

- **Default:** every offering in the grid, nothing ticked in the rail.
- **Searching:** the grid filters; the rail's counts update to the hit counts per division, so the rail doubles as a result map ("3 in EzzyCare, 11 in EzzyCourt").
- **Filters:** multi-select becomes possible for the first time — today `division` is a single slug, so this is the one option that **changes `SearchFilters` and `searchCatalogue`** (`division: string | null` → `divisions: string[]`), with `matchDivision`'s single answer still seeding it. A real but contained change, with existing tests to extend.
- **Empty:** the rail stays, with zero-count divisions dimmed — the user can see where results *do* exist without clearing anything.
- **Mobile:** the rail collapses into a "Filters (2)" button opening a sheet; the grid takes the full width. Below `lg` this becomes Option A without the stickiness.
- **Pills + icons:** 20px masked marks in the rail rows; selected rows take the division tint.

**Tradeoffs.** The most powerful and the most informative when the catalogue is large — live counts are genuinely useful and nothing else on offer provides them. It is also the most code: a layout change, a multi-select filter contract, and a second mobile pattern. For a catalogue that today is small, that power may not be earned yet.

---

### Recommendation

**Option A.** It satisfies item 4 in its plainest reading (the page *is* the catalogue, always), it is the only one that needs no new state machine and no change to the matcher, and it leaves the division marks a clear job on the pills. Option B is the better-looking page and the easier phone experience, but it makes "show everything" a secondary action, which is what item 4 was asking to stop doing. Option C is where to go **if and when** the catalogue grows enough for per-division counts to earn their keep — its multi-select filter is the first thing to want after A ships, and A → C is an additive path, whereas B → C is a rewrite.
