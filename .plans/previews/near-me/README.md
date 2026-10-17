# "Near me" discovery — visual previews

**Date:** 2026-10-14 · **Plan:** [`2026-10-14-booker-near-me-discovery.md`](../../2026-10-14-booker-near-me-discovery.md) · **Status:** for review before execution approval (G1) — **not an implementation.**

Open [index.html](index.html) directly in a browser (no server). The **PREVIEW** bar (bottom right) picks a screen and a theme; the location chip, the map toggle and the picker rows also walk between screens. Query parameters select a state, e.g. `index.html?screen=map&theme=dark`. Narrow the window below 640px for the phone layout.

---

## ⚠️ Read this first: what the map is

**The map does not show a pin for each vendor, and it cannot.** This platform stores no coordinates for any vendor — only a structured address whose finest geographic level is the city/municipality (plan V1, V2). Everything the map can place is therefore a **city**, not a business.

So a marker is **one city, labelled with how many vendors are in it** — `Makati City · 4 vendors`. Tapping it filters the results to that city. It is placed at the city's centre point, the zoom is capped so a marker always covers a whole city, and **no distance is shown anywhere**.

A per-vendor pin would be a statement about where a business is, and with only city-centre data behind it that statement would be wrong by roughly 5–15km — every vendor in Makati would sit on the same dot. That is plan **B5**, and per-vendor pins stay out of scope until Stage 4 (plan **P2**), which needs street-level geocoding and a database migration.

---

## What it shows

| Screen | What to look at |
|---|---|
| **Home · no location set** | Today's Home plus one new line under the search: `📍 Set your location`. No "Near you" shelf — an empty shelf on a discovery screen is worse than one fewer shelf. |
| **Home · Near you (same city)** | The new shelf, placed above "Browse by division". Three same-city offerings, `In Makati City` as the subtitle. |
| **Home · Near you (tier groups)** | The thin-catalogue case: `In Pila` → `Also in Laguna` → `Elsewhere in CALABARZON`. Each group is **labelled**; a card from another city is never silently mixed in. |
| **Home · nothing nearby** | Nothing in the city, the province or the region. An honest empty state, not a filled-in substitute. |
| **Picker · choose a city** | All 1,634 PSGC municipalities (plan D2). Cities with vendors come first and carry a count; the rest are still selectable. `Anywhere` is always one tap away. |
| **Picker · six "Burgos"** | The defect this fixes (plan **B1**): six real municipalities share that name, and today's filter lists one and matches all six. The province line is what tells them apart. |
| **Explore · filter + sort + groups** | The two controls side by side — `Where` **removes** results, `Sort` **reorders** them — plus the labelled result groups. |
| **Explore · Near me unavailable** | No location set, so the sort is disabled **with a reason**, and the list keeps today's order with no group headers. |
| **Explore · no results in that city** | The empty state offers "Show nearby cities instead" as an action. Expansion is never silent. |
| **Explore · map open** | The city-marker map. See the warning above. |
| **Explore · map tiles failed** | A blocked tile renders as a blank grey square with no error, so the panel says "Map unavailable" and lists the cities instead. |

## Design fit

- Colours are booker's own `--db-*` tokens plus the four `--div-*-deep` shelf accents, copied from `booker/app/globals.css`. The shelf header's wash/arc/stroke recipe is copied from `.db-shelf-head` (globals.css:459-494), and the `Near you` shelf reuses the existing `HomeSection` chrome with the Court accent.
- Every tappable control is ≥44px (ux-design §5; plan I43's tier-1 rule).
- Both themes render from the same markup — switch with the PREVIEW bar.
- **No new dependency is implied by any screen except the map**, which needs one (plan gate **G5**; Leaflet + CARTO recommended, because booker's CSP already allows that tile host).

## Findings this preview produced

- **F1 — an active control is invisible in dark mode.** The first cut styled the chosen `Where` / `Sort` / `Map` state with `--db-menu-btn-*`, which is a blue tint in light but a **neutral white-alpha in dark** — active and inactive looked identical, defeating the filter-vs-sort distinction the screen exists to make. The preview now fills the active control with `--db-toggle-on` (#2563eb, identical in both themes, white on it measures 4.6:1).
  ⚠️ **The real `.select` in `ExplorePage.module.css:168` has no active variant at all today** — a chosen city looks the same as "Anywhere". The build has to resolve this; it is not a preview-only concern.
- **F2 — the preview's own cascade bug, worth noting because the real components share the shape.** Hiding variants with `[data-only] { display: none }` lost to `.select { display: flex }` on equal specificity, so *both* copies of every control rendered. Fixed with `:not(.is-on)` + `!important`. A component that toggles between two variants by class needs the same care.

## Limits

Static fixtures only: nothing is saved, no Supabase, no app imports, **no network at all** — the capture run asserts zero non-`file://` requests and fails if one is attempted.

- **The basemap is a stand-in**, drawn as an abstract landmass in SVG. It is not the Philippines and the marker positions are schematic, not projected coordinates. It exists to show *what a marker is*, not where anything is. The real panel would render CARTO tiles.
- **Fonts:** the app uses Poppins, self-hosted by `next/font`. It is a build artefact and cannot be loaded offline, so this preview falls back to Lato. Letter shapes and spacing will differ slightly from the real screens.
- Fixture counts are invented but internally consistent: 17 vendors across 9 cities for the map, 28 offerings across three tiers for Explore. They are not seeded data.
- Screen-reader structure (dialog labelling, `aria-expanded` on the map toggle, the group headers as landmarks) is sketched in the markup but focus movement and live announcements are **not** simulated — those get checked in the real build.
- The six "Burgos" entries and their provinces are **real**, taken from `vendor/public/ph-address/cities.json`: PSGC codes 012806000 (Ilocos Norte), 012904000 (Ilocos Sur), 013308000 (La Union), 015516000 (Pangasinan), 023105000 (Isabela), 166704000 (Surigao Del Norte).

## Regenerating the screenshots

Playwright lives in the booker app, and `.plans/` has no `node_modules`, so run it from there:

```bash
cd booker && node ../.plans/previews/near-me/capture.mjs
```

44 files: 11 screens × desktop (1280×800) and phone (390×844 @2×) × light and dark. The run fails if any non-`file://` request is attempted.

## Screenshots

| Screen | Desktop | Phone |
|---|---|---|
| Home · no location set | [light](home-unset-desktop-light.png) · [dark](home-unset-desktop-dark.png) | [light](home-unset-mobile-light.png) · [dark](home-unset-mobile-dark.png) |
| Home · Near you (same city) | [light](home-city-desktop-light.png) · [dark](home-city-desktop-dark.png) | [light](home-city-mobile-light.png) · [dark](home-city-mobile-dark.png) |
| Home · Near you (tier groups) | [light](home-thin-desktop-light.png) · [dark](home-thin-desktop-dark.png) | [light](home-thin-mobile-light.png) · [dark](home-thin-mobile-dark.png) |
| Home · nothing nearby | [light](home-empty-desktop-light.png) · [dark](home-empty-desktop-dark.png) | [light](home-empty-mobile-light.png) · [dark](home-empty-mobile-dark.png) |
| Picker · choose a city | [light](picker-desktop-light.png) · [dark](picker-desktop-dark.png) | [light](picker-mobile-light.png) · [dark](picker-mobile-dark.png) |
| Picker · six "Burgos" | [light](picker-dupe-desktop-light.png) · [dark](picker-dupe-desktop-dark.png) | [light](picker-dupe-mobile-light.png) · [dark](picker-dupe-mobile-dark.png) |
| Explore · filter + sort + groups | [light](explore-desktop-light.png) · [dark](explore-desktop-dark.png) | [light](explore-mobile-light.png) · [dark](explore-mobile-dark.png) |
| Explore · Near me unavailable | [light](explore-nosort-desktop-light.png) · [dark](explore-nosort-desktop-dark.png) | [light](explore-nosort-mobile-light.png) · [dark](explore-nosort-mobile-dark.png) |
| Explore · no results in that city | [light](explore-empty-desktop-light.png) · [dark](explore-empty-desktop-dark.png) | [light](explore-empty-mobile-light.png) · [dark](explore-empty-mobile-dark.png) |
| **Explore · map open (city markers)** | [light](map-desktop-light.png) · [dark](map-desktop-dark.png) | [light](map-mobile-light.png) · [dark](map-mobile-dark.png) |
| Explore · map tiles failed | [light](map-fail-desktop-light.png) · [dark](map-fail-desktop-dark.png) | [light](map-fail-mobile-light.png) · [dark](map-fail-mobile-dark.png) |
