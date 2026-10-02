# Booker — the Home → Explore search transition, and a top-bar search that knows where it is

**Date:** 2026-10-01
**App / scope:** `./booker` web only. No `backbone/`, no migration, no schema change, no other app.
**Status:** COMPLETE — build scope, 2026-10-02. **Accepted by the user** after reviewing both rounds (*"the review went fine. Everything is working."*). Round 1 (I1–I11, F1–F15) and round 2 (I12–I14, F17) all ✅. Final verification: `tsc` clean · **171/171** · lint **18, all pre-existing** · `next build` passes · visual **87/87 twice, exit 0**, 81 baselines. ⚠️ **Two things carried, neither blocking:** **F16** — `OfferingPage` has no visual coverage and cannot get a gallery pane without service injection (its own decision); and the **root repo is uncommitted**, which includes this plan file itself — `booker/` and `backbone/` are clean.

> Two UI fixes from the 2026-10-01 preview (`claude.ai/artifact/25RcA6xr38KBHgPnsbipxt`, variant **C**,
> **1600ms**, one-colour ink): stop showing a second search field on the two pages that already own
> one, and make searching from Home a deliberate transition into Explore instead of an instant jump.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** I# = implementation item, D# = decision, F# = finding. Numbers are
> plan-local — qualify cross-plan refs by app.

---

## Scope

**In:** the top-bar search's visibility rule; a real search input in Home's hero; a loading overlay
in the hero showing division marks travelling right to left; the handoff into Explore carrying the
query and, conditionally, the matched division.

**Out:** Explore's own search behaviour (unchanged), the matcher in `lib/search.ts` (unchanged),
anything on the React Native app (that is
`.plans/2026-09-29-booker-mobile-parity-groundwork.md` — ⚠️ **this adds a sixth web/native
divergence**, see F3), and the live checks in
`.plans/2026-09-29-booker-live-verification.md`.

---

## FINDINGS — what the investigation changed about the request

### F1 — Home has no search field today, so "searching from Home" could not happen  ✅ ADDRESSED by I2
`components/home/HomePage/HomePage.tsx:62` is a `<button>` whose only job is to call `onSearch()`
and navigate. There is nothing to type into, so a loading state would have had no query to show
and Explore would have arrived empty. The preview showed a real input in the hero and that is what
was approved, so **I2 adds one**. This was a scope addition, not an implementation detail.

### F2 — ⚠️ correction: the delay is almost entirely artificial, and my earlier rationale was wrong
In the preview I said the delay should be "a floor, not a fake", because `goExplore()` calls
`loadCatalogue()` and a cold open has real work to cover. **That is mostly false here.**
`components/layout/AppShell/useAppShell.ts:313` already runs
`if (loggedIn && page === "home") void loadCatalogue()` — the F58 fix from the redesign plan — and
`loadCatalogue` returns immediately when `loaded` (`:317-319`). So by the time anyone searches from
Home the catalogue is normally **already in memory**, and 1600ms is a deliberate pause, not covered
work.

**It is still implemented as `max(floor, catalogue settled)`** (I5), because that is one condition
and it is genuinely correct on a slow or cold open where Home's own fetch is still in flight. But
the plan should not pretend the floor is doing work it usually is not. `ExplorePage`'s own docstring
says searching "never shows a spinner (plan review trap e)" — this adds one on purpose, at the
user's explicit request, on the *navigation*, not on the matching.

### F3 — this creates a new web ↔ native divergence  ✅ DONE (2026-10-02)
`.plans/2026-09-29-booker-mobile-parity-groundwork.md` holds the parity contract, under which
anything that differs between clients must be listed in mobile's `§4 Web → native differences`
with a reason. The hero search input, the overlay and the transition are all new web behaviour.
**Action:** add a **C7** row to that plan's carry-over ledger. Not built here; this plan is web-only.

### F4 — `useExplorePage` reads its entry values ONCE, which this feature now depends on
`components/explore/ExplorePage/useExplorePage.ts:43-44` is
`useState(initialQuery)` / `useState(initialDivision)`. They are **initial state**, so a changed
prop does not update them. This works today only because leaving Home unmounts `ExplorePage`
(`AppShell.tsx:197` renders it only while `page === "explore"`), so arriving always remounts it.
⚠️ **Write this down rather than rely on it:** if anyone later keeps Explore mounted across
navigation, or adds a `key`-less re-entry path, the seeded query silently stops arriving. I6 adds
the comment at the call site.

---

### F5 — the only top-bar pane tests the HIDDEN case, so the shown case has no coverage  ⬜ TODO
Found while verifying I1. `app/ui-gallery/page.tsx:234` renders the one `topbar` pane with
`page="home"` — which is now precisely the case where the search is absent. After I1 the suite
asserts the field is **gone** and nothing asserts it is ever **present**: a later change that hid
it on every page would stay green.
**Fix:** I7 adds a second pane with `page="activity"`. Folded into I7's scope rather than widening
a finished stage.

### F6 — ⚠️ Explore's cards were on a DIFFERENT division palette from Home  ✅ CLOSED by I10 (2026-10-02)
Found 2026-10-02 while scoping I9 (the division mark on a result card).

**Two palettes, same divisions.** D22-d derived `--div-*-tile`, `-deep` and `-label` from the
logos. It never touched the older `--div-*-bg` / `-fg` **badge** pair — and every Explore surface
still uses the badge pair. So `ezzy-court` is **green** on a result card
(`--div-ezzy-court-bg: #e3f6ec`, fg `#047857`, `globals.css:83-84`) and **blue** on a Home tile
(`-tile: #e1ebff`, `-deep: #024cd3`, `:130`, `:172`).

**This is the F65 bug class from the redesign plan**, which was "a green pill on a blue panel" —
caught on one card and fixed by deriving `-deep`. The badge set was left behind.

**It is also a six-file convention violation.** `booker/AGENTS.md:101`: a division's colours come
from `data-division` plus the two custom properties, "mapped **once** in `app/globals.css`. Do not
add another `[data-division]` block to a component stylesheet." Counted:

| File | `[data-division]` blocks |
|---|---|
| `components/explore/OfferingResultCard/OfferingResultCard.module.css` | 13 |
| `components/explore/VendorResultCard/VendorResultCard.module.css` | 13 |
| `components/explore/VendorPage/VendorPage.module.css` | 13 |
| `components/explore/ExplorePage/ExplorePage.module.css` (`.chipOn`) | 13 |
| `components/ui/DivisionBadge/DivisionBadge.module.css` | 13 |
| `components/explore/OfferingPage/OfferingPage.module.css` | 8 |
| **Total** | **73** |

⚠️ **Why this blocks I9 rather than being a footnote:** putting a division mark in *derived*
colours onto a card whose cover is a *badge* colour puts both palettes on one card — the exact
mistake F65 was about. I9 cannot be built correctly until **D7** says which palette wins.

### F7 — `loadCatalogue()` returned early on an IN-FLIGHT fetch  ✅ DONE (2026-10-02)
`useAppShell.ts:317-319` guards on `catalogue.loading` **and** `catalogue.loaded`, so
`await loadCatalogue()` resolves immediately while a fetch is already running rather than
awaiting it. `beginSearch`'s `max(floor, catalogue)` therefore covers "not started" but not
"in flight". The 1600ms floor exceeds the fetch in every run observed here, so it is not a live
bug — but the `max` is weaker than it reads.
✅ **FIXED 2026-10-02.** `loadCatalogue` now holds the in-flight promise in a **ref** and hands
that same promise back, so every caller resolves together and an `await` means "the catalogue is
ready" rather than "a fetch is happening". `useAppShell.ts:332-352`.

⚠️ **The ref, not `catalogue.loading`, is the guard — and that fixes a second race the old code
only half-caught.** State does not update within a tick, so two calls in the same tick both saw
`loading: false`; the old guard caught only the slower races. The ref is set synchronously.
⚠️ Cleared in a `finally`, or one failed fetch would wedge every later call.
The five callers are unaffected: four are fire-and-forget `void loadCatalogue()`, and `goVendor`
already awaited it. `beginSearch`'s stale caveat comment was replaced.

### F8 — two components borrowed a division token as a generic accent  ✅ DONE (2026-10-02)
`PopularShelf.module.css:127` and `StatStrip.module.css:34` both read `var(--div-ezzy-well-fg)`,
so a shelf's decoration and a money stat depended on a DIVISION's palette.

⚠️ **Two corrections to how I first described this.**
1. I called it a **green** accent. It is **purple** — `#6d28d9` light, `#c4b5fd` dark. I had not
   looked the value up.
2. I called it "two stragglers". The pattern is **systemic**: `HomeSection.module.css:37-40`
   points all four shelf tones at `--div-*-deep` (`well`, `court`, `work`, `ride`). Division
   tokens doubling as a decorative palette is established here, not an accident.

**So the fix is narrower than "stop borrowing division tokens".** Only the two reading the
**badge** pair matter, because that pair is what I10 left unused and what could then be retired.
`HomeSection`'s `-deep` references are deliberately **left alone**: `-deep` is derived,
contrast-guarded and actively maintained, and those accents are *meant* to echo the division
palette. Borrowing a live token is not the hazard; borrowing a dead one is.

✅ **FIXED 2026-10-02.** Added `--db-tone-popular-fg` and `--db-tone-money-fg` to both themes in
`globals.css` with the identical values, and repointed both call sites. Two tokens rather than one
because they are two roles that merely happen to share a hue today.
**Verified:** read off the running dev server — light `#6d28d9`, dark `#c4b5fd`, and
`--stat-accent` on the money card resolves to the new token. Identical to what the division token
gave, so **nothing on screen moved**. PopularShelf's measured-contrast note (7.1:1 / 10.13:1, and
why `-deep`'s 2.08:1 was rejected) was preserved and now explains the token it points at.
⚠️ **No component reads the badge pair any more** (grepped). Retiring `--div-*-bg`/`-fg` is now
possible — but it is a separate decision and the tokens are left defined.

### F9 — ⚠️ `.chipOn` lost its entire selected state during I10, and I put it back  ✅ FIXED (2026-10-02)
Deleting ExplorePage's thirteen `[data-division]` blocks removed **all** of the selected
division chip's styling: the base `.chipOn` rule was `font-weight: 700` and nothing else, so for
a moment a selected chip was indistinguishable from an unselected one. Restored as
`background: --division-tile`, `color: --division-deep`, `border-color: --division-deep`.
**The lesson for the record:** five of the six files had a base rule to repoint, so the deletion
was safe there. This one had the colour *only* in the deleted blocks. A bulk delete across six
files needed a per-file check of what the base rule was left holding, and a count of removed
lines would not have caught it.

## IMPLEMENTATION

### I1 — The top-bar search hides on Home and Explore  ✅ DONE (2026-10-01)
**File:** `components/layout/TopBar/TopBar.tsx:86-99`
Both the `md+` field and the sub-`md` icon button render unconditionally today. `TopBar` already
receives `page` (it uses it for `TITLES`, `:8-17`), so no new prop is needed.
**Fix:** derive one boolean and wrap both controls.
```ts
/* Home's hero and Explore's own input each own a search field; a second one in the bar is
   redundant there, and in the wizard it invites abandoning a flow with a held slot (D5). */
const showSearch = page !== "home" && page !== "explore" && page !== "booking"
```
**Component separation:** `TopBar.tsx` is an existing render-only component with no hook; this adds
a derived constant, not state, so the split is unchanged.
**Verification:** machine — `tsc`, and the `/ui-gallery` panes for each page. Visual baselines
cover `sidebar`/`topbar` panes; a changed pane must be re-recorded deliberately.

✅ **DONE 2026-10-01.** `showSearch` added at `TopBar.tsx:72`, both controls wrapped at `:95`.
Verified: `tsc` clean · **154/154** tests · lint **18, unchanged** · visual suite **77/77** after
re-recording exactly the two panes that legitimately changed (`topbar-light` 845px,
`topbar-dark` 7050px diff), then re-run clean. ⚠️ Exposed **F5**.

### I2 — Home's hero gets a real search input  ✅ DONE (2026-10-02)
**File:** `components/home/HomePage/HomePage.tsx:62-65`, `HomePage.module.css` (`.search`)
Replace the navigate-only `<button>` with a `<form>` wrapping an `<input type="search">` and a
submit button. The existing `.search` class already sizes a 52px control, including the
`flex: none` phone fix from I43 tier 1 — ⚠️ **keep that**: `.search` carries `flex: 1`, whose
`flex-basis: 0%` governs the vertical axis once `.heroActions` becomes a column, which is what
collapsed the control to 25px on every phone.
**Fix:** a `<form onSubmit>` so Enter works and the browser gives the field its own semantics;
the input is controlled from `useHomePage` (I5).
**Component separation:** the input's value and submit handler live in `useHomePage.ts`;
`HomePage.tsx` stays a render layer. No inline `style={{}}`.
**Verification:** machine — `tsc`, lint; the `home` visual baselines change and must be re-recorded.

### I3 — `matchDivision()`: which division does a query name?  ✅ DONE (2026-10-02)
**File:** new `lib/divisionMatch.ts` + `lib/divisionMatch.test.ts`
Nothing maps a query to a division today — `lib/search.ts` filters *by* a slug but never derives
one, and `searchCatalogue` has no division-matching step (`search.ts:87`). `DIVISIONS` in
`lib/divisions.ts:45-58` carries `{ slug, name, hint }`.
**Fix:** one pure function, reusing `searchTerms()` from `lib/search.ts` so tokenising matches the
rest of the app rather than inventing a second rule.
```ts
/** The division a query names, or null. Matches the division's own name or hint only —
 *  NOT its offerings, because selecting a division FILTERS Explore (D6). */
export function matchDivision(query: string): DivisionSlug | null
```
Rules: case-insensitive; every term must appear in `name + hint`; `"ezzy"` alone matches nothing
(it is in all thirteen); the first match in `DIVISIONS` order wins; empty query → null.
**Verification:** machine — `npm test`.

✅ **DONE 2026-10-02.** `lib/divisionMatch.ts` + `lib/divisionMatch.test.ts`. **164/164** tests
(10 new), `tsc` clean, lint **18 unchanged** with nothing from the new files.

⚠️ **Two corrections to this item as written.**
1. I predicted `"courts"` → **null**, "no stemming". **Wrong** — `ezzy-court`'s hint is literally
   `"Courts"` (`divisions.ts:46`), so the plural resolves with no stemmer at all. The hints carry
   the common plurals (`Courts`, `Spas`, `Rentals`), which is better than the stemmer I was about
   to justify not writing. The test asserts the real behaviour.
2. The `"ezzy"` guard needed designing, not just stating. Matching on the full name alone would
   have made the bare term `"ezzy"` match **all thirteen** and return whichever sits first in
   `DIVISIONS` — EzzyCourt — lighting up a division for a query that named none. The haystack is
   therefore `name + name-without-"ezzy" + hint`, and the bare `"ezzy"` token is dropped before
   matching, so `"EzzyWell"` (one word) and `"ezzy court"` (two) both still resolve.

Also covered: a loop asserting **every** division is reachable by its own name, so a future slug
that no query can name fails the suite; and `"services"` → `ezzy-home` pinned down, since that
hint is generic enough that a reorder should be noticed.

### I4 — `SearchingOverlay`: the loading state  ✅ DONE (2026-10-02)
**Files:** new `components/home/SearchingOverlay/SearchingOverlay.tsx` + `.module.css`
Variant **C** from the preview: every division mark at ~20% opacity travelling right to left, the
matched one at full strength and slightly larger, over a 1600ms progress hairline. Rendered as an
overlay inside `.hero` (`position: absolute; inset: 0`) so the rest of Home does not reflow.
**Marks are painted via CSS mask, not `<img>`.** ⚠️ This is not a style preference. Measured over
the opaque pixels of each PNG: `ezzy-food` mean luminance **1** (100% of pixels under 70),
`ezzy-home` 38 (98%), `ezzy-care` 48 (89%), `ezzy-learn` 68 (74%). The tinted disc is what makes
those readable, and `booker/AGENTS.md` records that as the reason the tile tint stays light in dark
mode. With the disc removed (the user's instruction), an `<img>` would make four marks invisible on
the dark hero card. So: `mask-image: url(...)` + `background-color: var(--db-strong)`, one ink in
both themes.
⚠️ **The matched mark cannot use `--division-deep` in dark mode** — several deeps are near-black
(`ezzy-home` is `#1b252e`), so "lights up" would mean "goes dark". It takes `--division-tile` (all
light pastels) under both dark selectors.
⚠️ `ezzy-ride` ships **no PNG** (12 files for 13 divisions); it falls back to a monogram, as
`lib/divisionIcon.ts` already does elsewhere.
**Component separation:** pure display — no state, no effects, no handlers. Ships **without** a
hook, the one case the convention allows. All styling in the co-located `.module.css`; the only
dynamic value is the matched slug, carried by `data-division` so the existing `globals.css` colour
map supplies the tokens (⚠️ **do not add a second `[data-division]` block** — `booker/AGENTS.md`
forbids it).
**Reduced motion:** `@media (prefers-reduced-motion: reduce)` stops the marquee and fills the bar.
**Verification:** machine — `tsc`, lint, plus new `/ui-gallery` panes (I7).

### I5 — `useAppShell` owns the delay and the handoff  ✅ DONE (2026-10-02)
**File:** `components/layout/AppShell/useAppShell.ts` (⚠️ **not** `useHomePage.ts` — see below)

⚠️ **Re-scoped 2026-10-02 by I8.** This item originally put the transition state in
`useHomePage`, because Home's hero was the only entry point. I8 makes the top-bar field a real
search, which fires from **Activity, Payments, Offering, Vendor and Settings** — none of which has
a hero to render an overlay inside. State in `useHomePage` would be unreachable from all of them.

So the state lives in `useAppShell` beside `page` and `exploreQuery`, and `AppShell` renders the
overlay. **Caught before I5 was built**, so this is a plan edit, not a rewrite.

**Presentation differs by origin, the state does not:**
- from Home → the overlay is **inset into the hero** (the user's instruction: "show this loading
  screen in that big rectangle"), so `HomePage` receives it as a prop and positions it;
- from the top bar → the overlay covers the **page body**, since there is no hero.

**Fix:** add the floor and the handoff.
```ts
export const SEARCH_TRANSITION_MS = 1600   // D2
```
Sequence: submit → set `searching: { query, matched }` → wait **`max(1600ms, catalogue settled)`**
→ call `onSearch(query, matched)`, which navigates (F2 explains why the second half of that `max`
is usually already true). The component unmounts on navigation, so there is no state to reset.
⚠️ **Do not clear the pending state in an effect.** A synchronous `setState` inside an effect is
the `react-hooks/set-state-in-effect` error that F42 and the I48 photo work both hit; the keyed
pattern in this same file (`photoResult`/`photoKey`) is the precedent to follow if state must
settle.
⚠️ **Reduced motion skips the delay entirely** — read `matchMedia("(prefers-reduced-motion:
reduce)")` inside the handler, at event time, never during render (that would be a hydration
mismatch, plan F43).
⚠️ The timer must be cleared on unmount, or a navigation mid-transition fires `onSearch` against a
dead component.
**Component separation:** state and the handler live here; `HomePage.tsx` only renders.
**Verification:** machine — `tsc`, lint. The timing itself needs a browser.

### I6 — Explore arrives with the query, and the division only when the query names one  ✅ DONE (2026-10-02)
**Files:** `components/layout/AppShell/useAppShell.ts:332-337`, `AppShell.tsx` (the Home render args)
`goExplore({ division, query })` already exists and already does everything needed — this is
wiring, not new machinery. Home's `onSearch` currently takes no arguments.
**Fix:** widen Home's `onSearch` to `(query?: string, division?: string | null)` and pass both
through to `goExplore`. Add the F4 comment at the `goExplore` call site.
**Verification:** machine — `tsc` forces every call site; grep that no other caller passes nothing
where a query is required.

### I8 — The top-bar search becomes a real field  ✅ DONE (2026-10-02)
**File:** `components/layout/TopBar/TopBar.tsx:86-113` (post-I1)
Today both controls are `<button onClick={onSearch}>` — they navigate to Explore and nothing more.
The comment at `:82-85` even says so: "Explore owns the query and the results; this is only the way
in… this never holds a value of its own."
**Fix:** replace the `md+` button with a `<form>` wrapping an `<input type="search">` and a submit
button carrying the find icon, so **Enter and the icon both work**. Sub-`md` keeps a single icon
button that opens Explore without a field — ⚠️ a 236px field does not fit a 360px bar beside the
menu, title, theme and bell controls, and I43 tier 1 already fixed one control that collapsed on a
phone. Submitting runs the same transition as Home (I5), then lands on Explore.
**Component separation:** `TopBar.tsx` has no hook today and holds no state. A controlled input
means state, so this adds **`components/layout/TopBar/useTopBar.ts`** for the field value and
submit handler — the convention requires it rather than a `useState` in the render file.
**Verification:** machine — `tsc`, lint, the new `topbar` panes from I7. Needs a browser: Enter and
the icon both fire; the field does not overflow at 360px.

### I9 — The division mark at the bottom of a result card, and a real no-photo placeholder  ✅ DONE (2026-10-02)
**Files:** `components/explore/OfferingResultCard/OfferingResultCard.tsx:21-48` + its `.module.css`
Two changes to the same card:
1. **A footer pill** under the body carrying the division's mark and name in the division's own
   colours. The card already sets `data-division` on `.cover` (`:22`); the footer reuses it.
2. **The no-photo cover becomes the Ezzy mark beside the division's mark.** Today it is a flat
   tint with a name pill (`.cover` + `.division`, CSS `:20-52`) — no artwork at all.
   The Ezzy mark is `BrandLogo` `variant="mark"` (`components/ui/BrandLogo/BrandLogo.tsx:46-47`),
   the same path as `app/icon.svg`, so the favicon and this placeholder cannot drift.
   ⚠️ `BRAND_BLUE` is hardcoded `#034bfc` and deliberately **not** `currentColor` (`:36`) — it will
   not take a division colour, which is correct here: the Ezzy mark stays Ezzy blue and the
   division mark beside it carries the division colour.
   ⚠️ The division mark must be **mask-painted**, not an `<img>`, for the same measured reason as
   I4: `ezzy-food` (mean luminance 1), `ezzy-home` (38), `ezzy-care` (48), `ezzy-learn` (68).
   ⚠️ `ezzy-ride` has no PNG — monogram fallback, as `lib/divisionIcon.ts` already handles.
**Component separation:** the card is pure display and stays so — no hook. All styling in the
co-located `.module.css`.
✅ **Unblocked 2026-10-02:** D7 chose the derived palette, and **I10 runs first** so the cover and the footer are the same palette by the time this lands.
**Verification:** machine — `tsc`, lint, new gallery panes. Needs a browser: the placeholder in
dark mode, where the near-black marks are the whole risk.

### I10 — Migrate the `[data-division]` blocks to the derived palette  ✅ DONE (2026-10-02)
**Files:** the six stylesheets listed in **F6**, plus the `[data-division]` map in
`app/globals.css:377+`
✅ **D7 chose option 1 on 2026-10-02, which approves this gate.** **Blast radius, as presented:**
- **Visual:** every Explore surface changes colour — result cards, vendor cards, the vendor and
  offering placeholders, the selected division chip, and `DivisionBadge` wherever it appears.
  `ezzy-court` goes green → blue, and so on for twelve others.
- **Baselines:** most `explore-*`, `offering-*`, `vendor-*` and chip panes re-record. ⚠️ With
  `threshold: 0.02` these are now real comparisons; the diffs must be *looked at*, not accepted.
- **Contrast:** `lib/palette.test.ts` asserts every badge/muted pair ≥ 4.5:1. The derived
  `-deep` set clears 7:1 white-on-deep, but **text-on-tile pairs must be re-measured** — the old
  `-fg` values were chosen against `-bg`, not against `-tile`.
- **Reversibility:** a CSS-only change, revertible in one commit; no data, no schema.
- **Not included:** `--div-*-bg` / `-fg` would become unused. ⚠️ **Leave them defined** and say so
  — deleting tokens is a separate decision, and `DivisionBadge` may want a badge-weight pair.
**Structural refactor across six components → an approval gate (AGENTS.md "Large rewrites").**
**Verification:** machine — `tsc`, `npm test` (contrast), the suite twice. Needs a person: judging
thirteen divisions on five surfaces in both themes.

### I11 — A catalogue seed with searchable offerings across all 13 divisions  ✅ DONE (2026-10-02)
**File:** `backbone/supabase/seed.sql` (local-only) — ⚠️ **`backbone/` is a separate repo, and you
apply every seed and migration; I only write the file.**

**Why `seed.sql` and not the demo pair:** `booker-demo-seed.sql` is additive-and-attaching by
design, which is the whole reason it is safe on a hosted project. Making it invent vendors and
offerings would destroy that property. `seed.sql` already creates vendors and offerings and is
explicitly local-only ("give me a whole world from empty"), so extending it needs no new safety
argument.

**Scope to write:** one vendor per division for the eleven with none, each with 2–3 offerings whose
names are what someone would actually type — so that both halves of D6 get exercised:
- names that **do not** contain a division word, so the query arrives unfiltered
  (`Deep Tissue Massage`, `Dental Cleaning`, `Scooter Day Rental`, `Document Notarisation`);
- at least one name that **does** collide with another division's word, to confirm the documented
  N8b behaviour is still wanted — e.g. a `Court-side Cabana` under EzzyStay, which "court" will
  also return.

⚠️ **Three traps already known from this repo, to carry into the item rather than rediscover:**
1. A vendor needs an `auth.users` row + `profiles` + a `division_id`; the demo-seed precedent uses
   an unusable password hash and `@example.invalid` so they can never sign in.
2. **"Available today" needs schedules**, and `check_booking_placement` rejected the first run of
   `booker-demo-seed.sql` until its schedules started `v_today - 120` (that plan's F59). Offerings
   alone will populate Explore and Popular but leave "Available today" empty.
3. `booking_transactions` snapshots `platform_fee_percent` at payment time, so the fee must be set
   **before** any paid rows are written — un-repairable afterwards without a teardown.

**OPEN — D9:** does this stay **local-only** (extend `seed.sql`), or does staging need searchable
data too (which means a **third** `demo/` pair that creates rather than attaches, tagged with its
own prefix and carrying its own hosted-safety argument)?
**Recommendation: local-only for now.** It unblocks the review, which is what is actually blocked.
Staging data is a bigger question and `.plans/2026-09-29-booker-live-verification.md` already parks
every staging check at your request.

**Verification:** machine — row counts after a reset; `matchDivision` already has unit coverage.
Needs a person: that searching a real service word returns the right things.

✅ **WRITTEN AND APPLIED 2026-10-02** — the user ran it. `backbone/supabase/seed.sql` gained **Block 4c** (286 lines,
inserted before Block 5 so vendor and offering creation stays adjacent to Block 3/4). ⚠️ **You
apply it** — `backbone/` is a separate repo and seeds are yours. It is one `do $$ … end $$;`, so a
failure rolls the whole block back and leaves the rest of the seed intact.

**What it creates:** 11 vendors, one per division that had none, each activated through the only
order the C1 trigger allows (insert **pending** → `vendor_members` → approved `vendor_kyc` →
`update` to active), plus **22 offerings** across them. All 13 division slugs are now referenced
by the seed; before this it was 2.

✅ **Confirmed applied (read-only query against local, 2026-10-02):** 14 vendors · 32 offerings ·
**13 distinct division slugs with a vendor** (was 2). The block is one `do $$`, so a partial apply
was not possible — these counts mean it committed.

**Static validation run before it was applied:**
- Every PSGC code checked against `vendor/public/ph-address/*.json` — city code resolves to the
  named city, the city's own `provinceCode` matches the row's province code, and each barangay
  code resolves to the named barangay within that city. ⚠️ **This caught a real error**: I had put
  Antipolo's *province* code `045800000` in the city slot. That one vendor's profile-edit
  dropdowns would not have resolved — the exact failure Block 3's comment warns about. Fixed to
  `045802000`; all 14 rows (3 original + 11 new) now validate.
- 1 balanced `do $$` block · 11 vendors declared, 11 KYC rows, 11 member rows, 11 activated ·
  22 offerings across all 11 (no vendor left without one) · every `code` ≤ 6 chars and unique per
  vendor (`offerings_vendor_code_unique`) · every `duration_unit` within the migration's
  `('minute','hour','day','week','month')` check.
- Grepped for later blocks that assume three vendors: **none.** No count assertions on vendors or
  offerings, and Block 9e's per-offering window runs over *bookings*, which these offerings have
  none of.

⚠️ **Two consequences to expect rather than report as bugs:**
1. **"Popular this month" will not show the new offerings.** Popular means most-booked
   (`get_popular_offerings`) and these have no bookings. Correct behaviour, not a gap.
2. **"Available today" stays as sparse as it was**, because this block deliberately creates no
   schedules — see the exclusions above.

### I7 — Visual baselines for the new states  ✅ DONE (2026-10-02)
**Files:** `app/ui-gallery/page.tsx`, `visual-tests/pilot.spec.ts`
Three new panes: the hero with the input at rest, the overlay mid-transition with a matched
division, and — per **F5** — a `topbar` pane with `page="activity"` so something asserts the
search field is still *shown* where it should be. ⚠️ The overlay animates, so the pane must render it **paused at a fixed frame** —
`animations: "disabled"` in `playwright.config.ts` handles CSS animations, but the pane should pin
the progress bar deterministically rather than depend on timing.
⚠️ **`home-light`/`home-dark` and the top-bar panes will change** and must be re-recorded.
Re-record deliberately and look at the diffs: `threshold: 0.02` now makes the suite load-bearing
for colour (redesign plan F64/F66), and the last re-record needed a human pass that was initially
given unverifiable input.
**Verification:** machine — the suite must pass twice consecutively, as the I51 fix established.

✅ **DONE 2026-10-02**, once the user stopped the dev server. **83/83 twice consecutively**;
`tsc` clean, 165/165, lint 18 unchanged.

**Three panes added**, not two: `topbarsearch` (F5), `homesearching`, and **`resultcard`** — see
F12 for why the third was necessary. **16 existing panes re-recorded**: `card`, `home`,
`activity`, `bookagain`, `needsyou`, `upnext`, `bookingdetail`, `payments`, light and dark.

⚠️ **The 16 were NOT the panes I predicted.** I expected the Explore surfaces to move. They are
not in the gallery at all (F12); what moved was every widget that renders `DivisionBadge` —
Activity, Payments and five booking widgets. I10's blast radius note said "DivisionBadge wherever
it appears" and that turned out to mean six panes beyond Explore.

**What the baselines were checked to actually contain** (md5 and pixel probes, not a green tick —
the I51 lesson is that green proves stability, not correctness):
- `topbarsearch` vs `topbar`: different md5, **11,217 px** differing in the top-bar band
  (`y 46-79`, `x 102-647`), 749 of them at high delta — the blue find button. The field really
  renders in one and really is absent in the other, so **F5's gap is closed by evidence**.
- `resultcard-light`: three distinct division tints, one per card and correctly placed —
  `#e1ebff` (EzzyCourt) at x 33-266, `#e7f4fb` (EzzyRide) at x 285-518, `#f1f5f9` (neutral, the
  division-less vendor) at x 537-770. Ezzy brand blue `#034bfc` present in all three placeholders
  (y 106-135). EzzyCourt's `-deep` on its mark and footer. **I9 and I10 are visually confirmed.**
- `homesearching` vs `home`: **49,906 px** differ in light and **145,352 px** in dark, confined to
  exactly `y 33-211` — the hero. The overlay renders, in the right place, in both themes.

⚠️ **What I could not verify from a PNG** — whether the matched mark is at full strength while the
rest are faded, variant C's entire point. Every tolerance probe was confounded: the progress bar
`#2563eb` falls within ±40 of EzzyCourt's `-deep` `#024cd3`, and in dark `--db-strong` `#f1f5f9`
falls within ±40 of the court tile `#e1ebff`.

✅ **RESOLVED by the user on 2026-10-02, not by a measurement.** They searched in a browser and
reported the highlighted mark matched the query — `"drive"` lit EzzyDrive, which is what
`matchDivision("drive")` should return. **Variant C works.** Recording who verified it and how,
because the plan should not later read as though a probe settled it.

---

### F12 — four of the six components I10 migrated had NO visual coverage  ✅ DONE (2026-10-02) — residue split to F16
Found while running I7. `OfferingResultCard`, `VendorResultCard`, `OfferingPage` and
`ExplorePage` appear **nowhere** in `app/ui-gallery/page.tsx` — zero occurrences. So four of the
six stylesheets I10 recoloured, including the card I9 rebuilt, were shipping with no baseline at
all. The 16 panes that did move were all indirect `DivisionBadge` consumers.

This is the same shape as the redesign plan's **F57** ("the new shelf would have had no visual
baseline"), and it is why I10's own blast-radius note — "most `explore-*`, `offering-*`,
`vendor-*` panes re-record" — was wrong: **there are no such panes.**

**Partly fixed:** added a `resultcard` pane with three states that exercise different branches —
a division with a logo and no photo (the Ezzy + division placeholder), `ezzy-ride` (no logo file →
monogram), and a vendor with no division (neutral tint, "Other"). The photo branch is deliberately
left out: covers are Supabase URLs and `csp.spec.ts` asserts this fixture reaches no network.

**Second pass, 2026-10-02 — two more panes added, one genuinely cannot be:**
- ✅ **`vendorcard`** — `VendorResultCard` is pure display, no hook, no fetch. Four cards: three
  divisions plus one with none, so the neutral fallback is covered too.
- ✅ **`explorechips`** — `ExplorePage` with an **empty catalogue**, which is what makes it
  coverable: `useExplorePage`'s photo effect returns early when nothing is on screen
  (`if (ids.length === 0) return`), so there is no network call for `csp.spec.ts` to catch, while
  the division chips come from the `DIVISIONS` constant and render anyway. That covers `.chipOn`,
  the one thing I10 recoloured there — and the one F9 broke.
- ⚠️ **`OfferingPage` cannot be a gallery pane.** `useOfferingPage` fetches **unconditionally on
  mount** — `getPhotos`, `getAgreements`, then `getSchedulesForOffering` — with no guard to
  exploit. Rendering it means either real network calls (which `csp.spec.ts` forbids and which
  would make the baseline timing-dependent) or mocking three services, which changes production
  code paths for a test. **Left uncovered deliberately.** What that leaves at risk is one rule:
  `.placeholder`'s tint and ink. Covering it properly needs service injection — a separate
  decision, not a tail on this.

✅ **BASELINES RECORDED 2026-10-02**, once the user stopped the dev server. **87/87 twice
consecutively**; 81 baselines (was 77). Probed for content rather than accepted on a green tick:
- `vendorcard-light`: four 44×44 initials squares, each at its own grid position with the right
  tint — `#e1ebff` EzzyCourt (y47-90 x49-92), `#e7f4fb` EzzyRide (x363-406), `#f1f5f9` the
  **division-less** vendor (y135-178 x49-92), `#eef2f1` EzzyWell — plus `#024cd3` and `#075985`
  as the initials ink.
- `explorechips-light`: **exactly one** tinted chip (`#e1ebff`, 2382px ≈ 95×31) with its ink
  `#024cd3`; the other twelve on `--db-sub-bg` `#f8fafc`. So `.chipOn` works and F9's fix holds.

⚠️ **The run independently confirmed F8's "nothing moved".** All 83 pre-existing panes passed
**before** the new baselines were written, so F7, F8 and F15 changed not one pixel of anything
already covered — which is exactly what identical token values and a logic-only change should do.

**Earlier live verification** (the user's dev server was up for their review, so the suite could
not run): read the panes off `localhost:3000` and checked computed styles. `vendorcard` → `ezzy-court` `#e1ebff`/`#024cd3`,
`ezzy-ride` `#e7f4fb`/`#075985`, `none` `#f1f5f9`/`#475569`, `ezzy-well` `#eef2f1`/`#4a5b58`.
`explorechips` → 13 chips, only the selected one tinted, the other 12 on `--db-sub-bg`.
**No console errors and no failed requests**, which confirms the empty-catalogue reasoning.

### F13 — ⚠️ only 2 of 13 divisions have any catalogue locally, so search cannot be judged  ⬜ TODO → I11
Raised by the user 2026-10-02 ("we probably need to seed more data"), then quantified:
`backbone/supabase/seed.sql` references **exactly two** division slugs — `ezzy-well` and
`ezzy-court` — across 6 vendors and ~5 offerings (`Court Rental`, `Private Coaching Session`,
`Beginner Group Class`, `Fitness Assessment`).

**What that does to this feature specifically:**
- **A correct search and a broken one look identical for 11 of 13 divisions.** `matchDivision("pets")`
  correctly returns `ezzy-pets`, Explore filters to it, and shows nothing — because there are no
  EzzyPets vendors, not because anything failed. The reviewer cannot tell those apart.
- ⚠️ **It makes D6 look like the wrong decision when it is not.** D6 has a matched division
  *filter* Explore, which is right when the division has a catalogue and produces an empty page
  when it does not. With 11 empty divisions, most division-name searches land on nothing. **The
  data is the problem, not the rule** — but with this data the rule is indistinguishable from a bug.
- Service-word searches (`massage`, `dental`, `scooter`, `notary`) match nothing at all, so the
  "returns null → plain unfiltered query" half of D6 is also unexercised.
- `booker-demo-seed.sql` **cannot** fix this: it "creates no user, no vendor, no offering and no
  staff — it attaches to rows that already exist" (its header, and it raises at line 133 if no
  active vendor with active offerings exists). Attaching is exactly what makes it hosted-safe.

→ **I11.**

## What the review needs — six checks (2026-10-02)

✅ **The seed is applied** (2026-10-02 — 14 vendors, 32 offerings, 13/13 divisions), so checks 2
and 3 are now meaningful. Before it, only EzzyWell and EzzyCourt had any catalogue (**F13**). ⚠️ Two things that will still look empty afterwards and are **not** bugs: **Popular** (these
offerings have no bookings) and **Available today** (Block 4c creates no schedules, by design).

| # | Check | What a pass looks like | What would be a real failure |
|---|---|---|---|
| 1 | ✅ **Matched mark** — search a division word from Home | The matched mark at full strength, the rest faded | Nothing lights up, or the wrong division does. **Already confirmed by you: `"drive"` lit EzzyDrive** |
| 2 | **A service word that names no division** — use **`scooter`**, `notarisation`, `aircon` or `guitar`. ⚠️ **Not `massage`** — I used that example before checking, and nothing in the seed is a massage, so it returns nothing and proves nothing | The matching offering by **name**, with **no** chip selected | A chip lights up anyway — that would mean `matchDivision` is reading offering text, which D6 forbids |
| 3 | **A division word** — `pets`, or `grooming` (which matches via EzzyPets' *hint*) | Results **and** that division's chip selected | Results from other divisions leaking in, or the chip not selected |
| 3b | **`court` from Home, then `court` typed into Explore's own field** | They differ **by design** — F14, accepted 2026-10-02. From Home it filters to EzzyCourt; inside Explore it does not, so the EzzyStay "Court-side Cabana" appears. Worth seeing once so the difference is familiar | Not a failure either way — this row is informational now |
| 4 | **The 1600ms pause itself** — from Home's hero, then from the top bar on Activity | Inset in the hero card on Home; covering the page body on Activity. Reads as deliberate, not broken | It feels like a hang. ⚠️ **It is a pure pause** (F2) — if it reads as slow, lower `SEARCH_TRANSITION_MS`; that is one constant |
| 5 | **The overlay in dark mode** | All 13 marks visible, the matched one legible | A mark missing or near-invisible — that is the near-black-logo problem the mask exists to solve, and dark is where it shows |
| 6 | **The new Explore palette** — a result card, a vendor card, the offering page, a selected chip, and a `DivisionBadge` on Activity/Payments | One division reads as one colour everywhere, matching its Home tile | EzzyCourt green anywhere — that is the old badge palette surviving. ⚠️ **13 divisions × 5 surfaces changed**; contrast is measured and asserted, appearance is not |

Two things **not** worth your time: contrast ratios (measured, and `palette.test.ts` now asserts
deep-on-tile ≥4.5 for all 14, worst 5.89) and whether the suite is stable (83/83 twice).

### F14 — the same query returns different results depending on where it is typed  ✅ ACCEPTED AS DESIGNED (2026-10-02)
Found 2026-10-02 by running the seeded names through the real `searchCatalogue` and
`matchDivision`, not by reading the code.

**D6 makes a matched division filter Explore. Explore's own input does not run `matchDivision`.**
So:

| Where `court` is typed | Division set? | Result (measured against the real seeded catalogue) |
|---|---|---|
| Home's hero, or the top bar | **Yes**, `ezzy-court` | The EzzyCourt offerings. **"Court-side Cabana" is hidden** |
| Explore's own field | No | The EzzyCourt offerings **and** the EzzyStay "Court-side Cabana" |

⚠️ **This also corrects something I wrote in the seed.** Block 4c's comment claimed the cabana row
"proves N8b is still true across divisions". It does not — not for a query of "court", because D6
filters it out. The seed comment is fixed; the row still earns its place because it surfaces on
"cabana", "court-side" and "overnight".

**Is it a bug?** Not obviously. It is defensible that searching *into* Explore is a navigation
with intent ("take me to courts") while typing *within* Explore is free-text refinement. And D6
exists because the user asked for the matched division to be **highlighted on arrival**, and in
Explore a highlighted chip *is* its selection.

**Options:**
**(1) Keep it.** Entering from outside filters; refining inside does not. ⚠️ Same query, two
answers, which someone will eventually report as a bug.
**(2) Stop setting the division from a search** — highlight it during the overlay only, leave
Explore unfiltered. Consistent everywhere, but the arrival no longer has the chip lit, which is
part of what was asked for.
**(3) Make Explore's own field run `matchDivision` too.** Consistent, but it would narrow results
mid-typing and fight the user.
→ **(1) KEEP IT** (resolved 2026-10-02, the user's decision). No code change: option 1 is the
behaviour already shipped.

**Why this is recorded rather than just closed.** Nothing in the code expresses the difference —
`useExplorePage` simply never calls `matchDivision`, and the fact that *not calling it* is now a
deliberate product choice is invisible at the call site. Two consequences to carry:
- ⚠️ A future change that "fixes the inconsistency" by wiring `matchDivision` into Explore's own
  input would be **undoing a decision**, not fixing a bug. The comment added to
  `useExplorePage` records that.
- The behaviour is: **entering Explore from outside filters by the named division; typing inside
  Explore does not.** If this is ever reported as a bug, it is F14 and the answer is "intended".

### F15 — the overlay highlighted nothing when the query matched an OFFERING rather than a division  ✅ DONE (2026-10-02)
Reported by the user during review 2026-10-02: *"I could not see the highlighted icon that matches
an offering result."* Confirmed, mechanism understood, and **not a regression from F7/F8/F12** —
those three changed nothing on this path.

**Why:** the overlay's highlight and Explore's filter are **the same value**. `beginSearch` calls
`matchDivision(query)` once and uses the result for both. `matchDivision` matches a division's own
name or hint only (D6), so an offering-name query returns `null` — and with `matched = null` no
mark gets `data-match`, so all thirteen sit at 20% and nothing lights up. `"drive"` worked for the
user because it is a division word; `"scooter"` does not because it is an offering name.

⚠️ **This is weak feedback rather than a wrong behaviour.** The overlay never claims "no results";
it just fails to point at anything while the search is, in fact, about to return hits. But what
the user originally asked for was *"highlighting the division that matched"*, and for `"scooter"`
the division that matched — in any sense they would mean — is EzzyRide.

**The fix is clean because the two values do not have to be the same.** The filter must stay
restricted to division-name matches or results get wrongly narrowed (that is D6, and F14 settled
it). The **highlight is purely decorative** — it lives only in the overlay — so it can be derived
from the results instead. The catalogue is already in memory, so `searchCatalogue` can run inside
`beginSearch` with no fetch.

**Measured against the seeded catalogue (2026-10-02), highlight-from-results vs today:**

| query | highlights today | would highlight | results' divisions |
|---|---|---|---|
| `scooter` | **nothing** | `ezzy-ride` | ezzy-ride |
| `notarisation` | **nothing** | `ezzy-law` | ezzy-law |
| `aircon` | **nothing** | `ezzy-home` | ezzy-home |
| `guitar` | **nothing** | `ezzy-learn` | ezzy-learn |
| `dental` | **nothing** | `ezzy-care` | ezzy-care |
| `hot desk` | **nothing** | `ezzy-work` | ezzy-work |
| `overnight` | **nothing** | ⚠️ ambiguous — 1 of 2 | ezzy-stay **and** ezzy-park |
| `grooming` | `ezzy-pets` | `ezzy-pets` | unchanged |
| `court` | `ezzy-court` | `ezzy-court` | unchanged |

Six of nine queries gain a correct highlight; two are unchanged; **one is ambiguous** —
`"overnight"` hits EzzyStay and EzzyPark equally, and picking "the most common" would be arbitrary.

**Options:**
**(1) Highlight only when every hit shares one division**, else highlight nothing. Honest: the mark
means "all of these are EzzyRide", and ambiguity shows as no highlight rather than a coin toss.
Fixes six of the nine above; `"overnight"` stays unhighlighted, correctly.
**(2) Highlight the most common division.** Fixes all nine, but `"overnight"` would point at
EzzyStay while half the results are EzzyPark — a confident wrong signal, which is the failure mode
F61 and I49 were both about.
**(3) Leave it.** The highlight means strictly "your query named this division". Defensible, and
it is what shipped — but it reads as broken, which is how the user found it.
→ **(1) chosen** (resolved 2026-10-02) and **shipped the same day.**

**What changed.** `lib/divisionMatch.ts` gained `soleResultDivision(offerings, vendors, query)` —
the division every service hit shares, or null. `useAppShell.beginSearch` now derives **two**
values where it derived one:
```ts
const matched   = matchDivision(query)                  // FILTERS Explore — D6, unchanged
const highlight = matched ?? soleResultDivision(…)      // only tints a mark in the overlay
```
`searching` carries `highlight` instead of `matched`, and `SearchingOverlay`'s `matched` prop is
re-documented: it is "the division to light", not "the division the query named".

⚠️ **Why they must stay separate.** A wrong `matched` hides real results, so it stays conservative.
A wrong `highlight` only mis-tints a decorative mark, so it can ask the more useful question.
Collapsing them again is what caused this finding.

**Measured end-to-end against the seeded catalogue (2026-10-02):**

| query | filters by | highlights |
|---|---|---|
| `scooter` · `notarisation` · `aircon` · `guitar` · `dental` · `hot desk` | — nothing | ✅ `ezzy-ride` · `ezzy-law` · `ezzy-home` · `ezzy-learn` · `ezzy-care` · `ezzy-work` |
| `overnight` | — nothing | — nothing. ✅ **Correct**: EzzyStay and EzzyPark both hit, so it refuses to guess |
| `grooming` · `court` · `rental` | `ezzy-pets` · `ezzy-court` · `ezzy-ride` | unchanged |

**Six new unit tests** (171/171 total), including one for a vendor-name query and one for a null
`divisionSlug`.

⚠️ **A test of mine was wrong before the code was.** I expected `"rental"` to highlight EzzyRide
through its two EzzyRide hits. It returns null in the unit fixture, because `searchCatalogue`
matches a service on its **category** as well as its name — so "rental" also reaches the EzzyStay
room and the EzzyPark slot. The function was right; the expectation was not. Kept as its own test,
since a category word looks like a service word and silently reaches further.

⚠️ **Cold-open limit, accepted:** if the catalogue is still empty when `beginSearch` runs, there is
nothing to derive from and no mark lights. Not chased — Home loads the catalogue on mount, so it is
in memory before anyone can type, and the overlay is gone before a late recompute could show.

### F16 — `OfferingPage` has no visual coverage and cannot get one without service injection  ⬜ TODO
Split out of **F12** on 2026-10-02 so closing that finding does not hide this.

`useOfferingPage` fetches **unconditionally on mount** — `getPhotos`, `getAgreements`, then
`getSchedulesForOffering` — with no `if (…) return` guard to exploit the way `useExplorePage`'s
photo effect has one. So a `/ui-gallery` pane would either make real network calls (which
`csp.spec.ts` forbids, and which would make the baseline timing-dependent) or need those three
services mocked, which means changing production code paths for a test.

**What is actually at risk:** one rule, `.placeholder`'s tint and ink, recoloured by I10 and
verified only by reading the CSS. Small, but it is the no-photo state of the page a booking starts
from, so it is on screen whenever a vendor has uploaded nothing.

**Options when this is worth doing:** inject the three services as props with defaults (testable,
but widens a component's interface for a test), or give the gallery a fetch stub at the service
module boundary (one place, but a new test seam this repo does not have yet). Neither is a tail on
another item — it wants its own decision.

### F17 — the overlay was nearly TRANSPARENT in dark mode, and my own measurement said so  ✅ CLOSED by I12 (2026-10-02)
Reported by the user 2026-10-02: the scrolling icons "cover the search field" on Home, and from
the top bar they "hover in the middle of the screen". One root cause behind both.

`SearchingOverlay.module.css:19` is `background: var(--db-card-bg)`. That token is **`#ffffff` in
light** but **`rgba(255,255,255,0.028)` in dark** (`globals.css:52` and `:276`) — a 2.8% white
veil. So the overlay hides the hero in light and hides essentially nothing in dark. Dark is
`defaultTheme`, which is why it is what the user saw.

⚠️ **I had the evidence and misread it.** When I accepted the `homesearching-dark` baseline I
measured its diff against `home-dark` as 145,352 px with **135,560 of them at delta 1–8**. I wrote
that up as "the overlay's opaque card background over a translucent hero". A 2.8% veil over every
pixel is exactly what a delta-1–8 histogram looks like; an opaque repaint would have been dominated
by large deltas. The number was telling me the overlay was see-through and I read it as the
opposite.

→ **I12**, which fixes it by not needing a background at all.

## GAP REVIEW (2026-10-02, after executing every item I own)

Checked my own output against the plan, the conventions and the measurements. Clean on:
component separation (neither new component has state, so both correctly ship without a hook),
no inline `style={{}}` except the per-division mask URL, no hardcoded hex in the new CSS, every
migrated element verified to carry `data-division`, `tsc`/tests/lint/build all green.

Two real gaps found in my own work and fixed:

### F10 — `.shot` is not a division surface, and the migration recoloured it in dark mode  ✅ FIXED (2026-10-02)
`components/explore/OfferingPage/OfferingPage.module.css` `.shot` is a **photo frame** and
carries no `data-division` (`OfferingPage.tsx:47`), so the migrated `var(--division-tile, …)`
resolved to the `none` fallback — and `--div-none-tile` is **light in both themes** by design,
whereas `--div-none-bg` is `rgba(148,163,184,0.14)` in dark. In dark mode a translucent grey
photo backdrop became a pale grey box.
**Fixed:** `.shot` reverted to `var(--div-none-bg)`, the theme-aware neutral, with the reason at
the line. ⚠️ **The lesson:** a bulk token swap is only safe on elements that actually carry the
attribute. I checked all six files for *that*, which is how this surfaced — but only after the
swap was already written.

### F11 — the hero form shipped with no visible submit control  ✅ FIXED (2026-10-02)
The first cut of I2 was `<form>` + `<input>` and nothing else. Enter submitted, and
`type="search"` gives a phone keyboard its Go key, but **nothing on screen said the field did
anything**. The preview had read as "input + Search button" because its CTA was labelled
*Search*; the real hero's CTA is **Book something** and belongs to `onNewBooking`, so there was
no submit affordance at all.
**Fixed:** a 36px find button inside the field, mirroring the top bar's, so both entry points
look and behave alike. 36px rather than 24px because I43 tier 1 exists.

### Gaps left open deliberately
- **F7** — `loadCatalogue()` early-returns on an in-flight fetch, so the floor's `max` is weaker
  than it reads. Not a live bug; fixing it changes the contract for five callers.
- **F8** — `PopularShelf:127` and `StatStrip:34` borrow `--div-ezzy-well-fg` as a money accent.
  Not division surfaces, so out of I10's scope — but they are now the only consumers of the badge
  palette, which blocks ever deleting it.
- **I7 / F5** — baselines, blocked on the dev server. ⚠️ **This is the one that matters**: every
  visual claim in this report is `tsc`, a unit test or a measurement. **Nothing here has been
  seen rendered.** 13 divisions × 5 surfaces changed colour and no screenshot has confirmed any
  of it.

---

## ROUND 2 — from the user's review, 2026-10-02

### I12 — the overlay REPLACES content instead of covering it  ✅ DONE (2026-10-02)
**Files:** `components/layout/AppShell/AppShell.tsx` (the page branch and `searchOverlay`),
`components/home/HomePage/HomePage.tsx`, `components/home/SearchingOverlay/SearchingOverlay.module.css`

**F17** is the cause; this is the fix, and it is a simplification rather than a patch. The user's
words are the spec: *"the search bar and buttons disappear, only the scrolling icons are seen"* and
*"the only thing you'd see in the middle of the page are the scrolling icons"*. So the overlay
should not be an overlay.

**Fix approach:**
- **Home:** when `searchOverlay` is present, the hero renders it **instead of** its heading, sub
  and actions — not on top of them.
- **Other pages:** `AppShell` renders the overlay **instead of** `pageContent`, not over it. The
  TopBar, Sidebar and TabBar sit outside that container and stay, which is what "in the middle of
  the page" means.
- `.overlay` then drops `position: absolute`, `inset: 0`, `z-index` and `background` entirely.
  ⚠️ **Not "set an opaque colour instead"** — there is no opaque card token, and inventing one to
  paint over content we are about to discard is the wrong shape. Replacing is why this needs no
  colour decision in either theme.

⚠️ **Watch the height.** With `position: absolute` gone the hero is sized by whichever content is
showing, so a shorter overlay makes the card shrink mid-transition. The hero-placement overlay
needs a `min-height` matching the hero's natural height so nothing jumps; the page placement keeps
the wrapper's `min-h-full`.
**Component separation:** `SearchingOverlay` stays pure display with no hook. `HomePage` gains a
conditional in the render layer only — the state is still the shell's.
**Verification:** machine — `tsc`, lint, and `homesearching-*` re-records. ⚠️ **Needs a browser in
DARK**, which is where the bug lives and where a light-only check would have missed it.

✅ **DONE 2026-10-02.** `.overlay` dropped `position`, `inset`, `z-index` and `background`;
`HomePage` renders `searchOverlay ?? (…hero content…)`; `AppShell` renders the overlay **instead
of** `pageContent`, and `.hero` no longer needs `position: relative`.

**Verified in a browser, both themes** (read off the running dev server — the suite could not run,
see below): overlay present, **hero input gone, "+ Book something" gone, old heading gone — in
dark AND light identically.** That sameness is the fix: before, light hid the hero and dark hid
nothing.

⚠️ **The hero's height took THREE attempts, and the plan should say so.**
1. `min-height: 182px` **plus** `padding: 22px 0` — stacked on the hero's own 22px padding and
   made the card **228px** mid-search. A 47px grow-and-shrink on every search.
2. `min-height: 137px`, from 181 − 44 — **183px**. I called the 2px "below perceptual threshold
   and accepted". **That was the wrong call**: a baseline diff then showed the whole page
   differing (`y 63-977`, not just the hero band), because the 2px pushes every shelf below the
   hero down for the length of the search. It was a page-wide shift, not a card resize.
3. `min-height: 135px` — **181px searching, 181px at rest, both themes. Zero shift.**

The number I kept missing is the hero's **1px border**: content = 181 − 44 padding − **2 border**
= 135. The lesson is in the CSS comment: read the at-rest content box off the element rather than
subtracting from the card height. The overlay's `gap` also went 16 → 15px in the same pass.

### I13 — remove the "+ Book something" button  ✅ DONE (2026-10-02)
**File:** `components/home/HomePage/HomePage.tsx:99`
The user's call: it is irrelevant now that the hero carries a real search field.
⚠️ **It is the only consumer of `onNewBooking` in `HomePage`** (grepped: `:21`, `:50`, `:99` and
nowhere else), so the prop goes with it — otherwise the change leaves a dead prop threaded through
`HomePageProps` and `HomeRenderArgs`.
⚠️ **The shell's `onNewBooking` stays.** `ActivityPage` and `BookingList` use it independently
(`BookingList.tsx:81`, `ActivityPage.tsx:94` and `:108`) for their empty-state "Find something"
action. Removing it from the shell would break those.
**Fix:** delete the button, the `.cta` rule, `onNewBooking` from `HomePageProps`, the `homeArgs`
entry in `AppShell.tsx`, and the prop from the gallery's HomePage pane. `tsc` forces the rest.
**Verification:** machine — `tsc` (it finds every call site), lint, `home-*` re-records.

✅ **DONE 2026-10-02.** Button, `.cta` rule (and its phone override), the `Plus` import,
`onNewBooking` from `HomePageProps` and from `HomeRenderArgs`/`homeArgs` — all gone.
⚠️ **`tsc` found the two gallery panes**, exactly as this item predicted it would; `onNewBooking={noop}`
went 4 → 2. The two that remain are `BookingList` (`:240`) and `ActivityPage` (`:468`), which is
correct — they use it for their own empty-state action and the shell's prop stays for them.
Confirmed in the browser: "+ Book something" absent from the hero at rest.

### I14 — the delay is a MINIMUM, so the progress must not claim a finish  ✅ DONE (2026-10-02)
**File:** `components/home/SearchingOverlay/SearchingOverlay.module.css` (`.fill`, `@keyframes fill`)
`.fill` animates `width: 0 → 100%` over a hardcoded `1600ms` with `forwards`. The wait is
`max(1600ms, catalogue)`, so whenever the catalogue is slow the bar reaches 100% and then **sits
full while the transition continues** — it reads as finished-but-stuck, and it is a determinate
claim about a duration the component cannot know.

The marquee is already right: `animation: slide 11s linear infinite` keeps going for any duration.
**Fix:** make the bar **indeterminate** — a short segment sweeping left to right on an infinite
loop, so it communicates "working" for as long as the overlay is up and never asserts a percentage.
⚠️ This also removes the duplicated `1600ms`: the CSS currently hardcodes the same number as
`SEARCH_TRANSITION_MS`, with a comment admitting they must be edited together. An indeterminate
bar has no duration to keep in sync.
**Verification:** machine — `tsc`, lint, baselines. ⚠️ A static baseline cannot prove a loop.

✅ **DONE 2026-10-02.** `.fill` is a 40%-wide segment on `animation: sweep 1.15s … infinite`,
translated from `-110%` to `260%` of its own width (260% × 40% ≈ 104% of the track, so it clears
the right edge instead of snapping back mid-track). Reduced motion falls back to a static full bar.

✅ **Baselines re-recorded 2026-10-02** (see Baselines-R2) — the `homesearching-*` pair twice,
once for the content swap and again after the height correction.

✅ **The loop was proven in a browser, not assumed.** Computed style: `animation-name: sweep`,
`iteration-count: infinite`, segment 292px. Sampling the transform across 3.4 seconds —
`x=705 → -222 → 312 → 736 → -163 → 414` — shows it still moving **well past the 1600ms floor**,
which is precisely the behaviour the old `forwards` rule got wrong.

⚠️ **`lib/constants.ts`'s comment was stale too** and is corrected: it called the value a "FLOOR …
cheap to revisit" without mentioning that CSS mirrored the same number. It now says the duplication
is gone, so changing the constant needs no matching CSS edit.

## DECISIONS

<!-- plan-authoring §7 hard gate: no item executes while an OPEN: line remains. **None does — D7 was resolved 2026-10-02.** -->

- Which loading treatment? → **C, "match lights up"** (resolved 2026-10-01) — all marks faded,
  the matched division at full strength.
- How long is the delay? → **1600ms** (resolved 2026-10-01) — the user's explicit choice after
  comparing 400–1600ms live. ⚠️ Long for a UI pause, and F2 records that it is a deliberate one
  rather than covered work; `SEARCH_TRANSITION_MS` is one constant, so it is cheap to revisit.
- Ink for the marks? → **one theme-aware colour** (resolved 2026-10-01) — the preview default the
  user approved, and the only option that keeps four near-black marks visible once the discs are
  removed (see I4's measurements).
- Does Home's hero get a real text input? → **Yes** (resolved 2026-10-01) — the approved preview
  showed one, and without it there is no query to transition with (F1).
- Should the top-bar search show during the booking wizard? → **No, hidden** (resolved 2026-10-01)
  — ⚠️ **recorded from my recommendation being accepted in "the rest look good", not from an
  explicit instruction.** The literal rule the user gave was "any page except home or explore",
  which would show it. I hid it because the wizard holds a slot and a search field there invites
  abandoning a booking mid-flow. **One line in I1 reverses this** if that reading is wrong.
- **D9 — does the searchable catalogue seed (I11) stay local-only?** → **(a) local only**
  (resolved 2026-10-02) — you took the recommendation. `seed.sql` is explicitly local-only and
  already creates vendors and offerings, so extending it needs no new hosted-safety argument;
  `booker-demo-seed.sql` was left untouched because attaching rather than inventing is precisely
  what makes it safe on a hosted project. Staging data stays unaddressed, and the staging checks
  are parked anyway in `.plans/2026-09-29-booker-live-verification.md`.
<!-- superseded, kept for the record:
  **(a)** Extend `backbone/supabase/seed.sql`, local only. **(b)** Also add a third `demo/` pair
  that *creates* vendors and offerings for staging, which needs its own hosted-safety argument
  because the existing pair is safe precisely by *attaching* and never inventing.
  **Recommendation: (a).** It unblocks the review, which is the thing actually blocked. -->
- **D7 — which division palette do Explore's surfaces use?** → **Option 1: migrate all six to the
  derived palette** (resolved 2026-10-02) — the user took the recommendation. One palette app-wide,
  `AGENTS.md:101` satisfied, Explore matches Home. **This also approves I10's gate**, which was
  presented as a six-file structural refactor with broad baseline re-records and a contrast
  re-measure. Rationale on record: the conflict is already shipped and keeps producing F65-shaped
  bugs; option 3 would have made it permanent and option 2 would have moved the seam rather than
  closing it. Evidence in **F6**; seen in the preview's section 3.
- Does the top-bar field show at phone width? → **No, the icon button stays below `md`**
  (resolved 2026-10-02, my call — recorded for reversal) — a 236px field cannot share a 360px bar
  with the menu, title, theme and bell controls, and I43 tier 1 already fixed one control that
  collapsed on a phone. Tapping the icon opens Explore, where the full field lives.
- Who owns the transition state? → **`useAppShell`, not `useHomePage`** (resolved 2026-10-02) —
  forced by I8: the top-bar field fires from five pages with no hero. See I5.
- Does the matched division also FILTER Explore, or only highlight? → **Filter, but only when the
  query names a division** (resolved 2026-10-01, my call — recorded for reversal) — in Explore a
  highlighted division chip *is* its selection, so highlight and filter cannot be separated without
  inventing a third state. Passing a division always would narrow results: `"massage"` could match
  an EzzyWell service and an EzzyStay spa, and forcing EzzyWell would hide the second. So
  `matchDivision()` (I3) matches a division's **own name or hint** only; anything else arrives as a
  plain query with nothing highlighted. The overlay still lights up a match when there is one.

---

## Execution order

Dependency-ordered, not numbered-ordered. **One stage at a time** (developerboss cadence).

1. **I1** — independent, smallest, touches nothing else. Lands the redundancy fix on its own.
2. **I3** — pure function + test, no UI. Everything after it consumes it.
3. **I2 + I5 + I6 together** — ⚠️ **one batch, not three stages.** The input (I2) is inert without
   the handler (I5), and the handler cannot navigate with a query until `onSearch` is widened (I6).
   Splitting them leaves the build green with a dead control, which is exactly the state F58 hid a
   bug in for two stages.
4. **I4** — the overlay, once there is state to drive it.
5. **I8** — the top-bar field, once the transition exists to reuse (I5 built it).
6. **D7** — ⚠️ **answer before I9.** Nothing after this point is safe to build without it.
7. **I10** — only if D7 picks option 1. Its own stage, behind its own approval.
8. **I9** — the card footer and the Ezzy+division placeholder, in whichever palette D7 chose.
9. **I7** — baselines last, after every visual change has landed.
10. **F3** — add the C7 parity row to the groundwork plan.

⚠️ **I3, I2+I5+I6 and I4 do not touch the Explore cards**, so they are unaffected by D7 and can
run while it is open. The hard gate in `plan-authoring` §7 means D7 blocks the plan formally;
flagged to the user 2026-10-02 so they can either answer it or say "carry on with the stages that
do not depend on it".

---

## Verification

| Item | Machine-verifiable | Needs a browser or a person |
|---|---|---|
| I1 | `tsc`; the gallery pane per page | — |
| I2 | `tsc`, lint | The 52px control at 360/390 in both themes — ⚠️ the I43 `flex: none` fix must survive |
| I3 | `npm test` — the eight cases above | — |
| I4 | `tsc`, lint; new gallery panes | ⚠️ **Dark mode especially** — four marks are near-black and the whole mask decision exists for them |
| I5 | `tsc`, lint | The 1600ms pause, and that reduced-motion skips it |
| I6 | `tsc` forces every call site | Arriving on Explore with results and the right chip lit |
| I7 | The suite passing **twice** consecutively | Judging whether the re-recorded panes look right |

**Baseline before starting (measured 2026-10-01, booker `bb2ec84`):** `tsc` clean · `npm test`
**154/154** · `npm run lint` **18 problems, all pre-existing** · `npx playwright test visual-tests/`
**77/77**. Any new failure is this plan's.

---

## Big table

| Done | ID | What | Who | Status | Why / reason |
|:-:|---|---|---|---|---|
| [x] | Preview | Three treatments drawn against the real tokens and art | Me | ✅ DONE 2026-10-01 | `claude.ai/artifact/25RcA6xr38KBHgPnsbipxt`. Surfaced F1 (Home has no input) and the near-black mark problem |
| [x] | D1–D6 | Variant C · 1600ms · one-colour ink · Home input · wizard hidden · conditional filter | 🤝 | ✅ DONE 2026-10-01 | Two were my calls, recorded for reversal: the wizard and the filter condition |
| [x] | I1 | Top-bar search hides on Home, Explore and the wizard | Me | ✅ DONE 2026-10-01 | `TopBar.tsx:72` + `:95`. `tsc` clean, 154/154, lint 18, visual **77/77** after re-recording the 2 panes that changed. Exposed **F5** |
| [x] | F5 | The only top-bar pane tests the hidden case | Me | ✅ DONE 2026-10-02 | `topbarsearch` pane added with `page="activity"`. Proven by diff: **11,217 px** differ from `topbar`, including the find button |
| [x] | I3 | `matchDivision()` + test | Me | ✅ DONE 2026-10-02 | `lib/divisionMatch.ts` + test. **164/164** (10 new), `tsc` clean, lint 18 unchanged. ⚠️ Two plan predictions were wrong — `"courts"` resolves via the hint, and the `"ezzy"` guard needed real design |
| [x] | I2+I5+I6+I4 | Hero input · the 1600ms floor in `useAppShell` · the query handoff · the overlay | Me | ✅ DONE 2026-10-02 | ⚠️ **I4 was pulled into this batch** — shipping the floor without the overlay would have been a 1600ms blank pause, worse than before. `tsc` clean, 165/165, lint 18, build passes |
| [x] | I4 | `SearchingOverlay`, variant C, mask-painted marks | Me | ✅ DONE 2026-10-02 | Shipped inside the batch above. ⚠️ Corrected two guesses: `divisionIcon` returns `{src, mono}` not `{kind, text}`, and `--db-accent` **does not exist** — my fallback would have hardcoded the light accent into dark |
| [x] | I8 | Top-bar search becomes a real field (Enter + find icon) | Me | ✅ DONE 2026-10-02 | New `useTopBar.ts` for the field state; `<form>` so Enter and the icon share one path. Icon-only below `md` (D8) |
| [x] | **D7** | **Which division palette do Explore's surfaces use?** | You | ✅ **DECIDED 2026-10-02 — option 1** | Migrate all six to the derived palette. **Also approves I10's gate.** ⚠️ **F6**: `ezzy-court` was green on a card, blue on a Home tile |
| [x] | I10 | Migrate the `[data-division]` blocks to the derived palette | Me | ✅ DONE 2026-10-02 | **67 blocks removed** across six files (not 73 — 6 of the counted matches were in prose). ⚠️ Found **F9**: `.chipOn` lost its whole selected state. ⚠️ The contrast re-measure caught my own bug — see the row below |
| [x] | I9 | Division mark on the card footer + Ezzy/division placeholder | Me | ✅ DONE 2026-10-02 | ⚠️ `data-division` had to move from `.cover` to the card root — the footer is a sibling and its tokens would not have resolved |
| [x] | I7 | Three panes added; 16 baselines re-recorded | Me | ✅ DONE 2026-10-02 | **83/83 twice.** Panes probed for content, not just accepted: `topbarsearch` differs from `topbar` by 11,217px; `resultcard` carries three correct division tints + the Ezzy mark; the overlay is confined to `y 33-211`. ⚠️ The 16 that moved were `DivisionBadge` consumers, **not** the Explore panes I predicted — see **F12** |
| [x] | F3 | Add a **C7** parity row to the groundwork plan | Me | ✅ DONE 2026-10-02 | Written as **C7** with four pieces. ⚠️ Flags that a straight copy is wrong (web's floor is deliberate, RN's would cover real network) and that it **changes C2** — mobile must take `-tile`+`-deep` |
| [x] | F9 | `.chipOn` lost its selected state during I10 | Me | ✅ FIXED 2026-10-02 | Found and fixed in-stage. 5 of 6 files had a base rule to repoint; this one held colour **only** in the deleted blocks |
| [x] | F12 | 4 of 6 migrated components had no visual coverage | Me | ✅ **DONE 2026-10-02** | `resultcard` + `vendorcard` + `explorechips`. **87/87 twice**, 81 baselines. Probed for content: four correct tints on `vendorcard`, exactly one tinted chip on `explorechips`. ⚠️ All 83 pre-existing panes passed first, confirming F7/F8/F15 moved **no** pixels. Residue → **F16** |
| [x] | **I12** | The overlay replaces content instead of covering it | Me | ✅ DONE 2026-10-02 | Verified in a browser **in both themes** — input, CTA and heading all gone, identically. ⚠️ The height took **three** attempts (228px, then 183px, then **181 = 181, zero shift**); the number I kept missing was the hero's 1px border. My "2px is imperceptible" call was wrong — it shifted the whole page |
| [x] | **I13** | Remove "+ Book something" | Me | ✅ DONE 2026-10-02 | Button, `.cta`, `Plus` import and `onNewBooking` from `HomePage`/`HomeRenderArgs`. `tsc` found both gallery panes as predicted (4 → 2). The shell's prop stays for `BookingList` and `ActivityPage` |
| [x] | **I14** | Indeterminate progress — the delay is a minimum | Me | ✅ DONE 2026-10-02 | Sweeping segment, `infinite`. **Loop proven in a browser**: transform `705→-222→312→736→-163→414` across 3.4s, still moving past the floor. Removes the 1600ms duplicated in CSS; `constants.ts` comment corrected |
| [x] | F17 | The overlay was near-transparent in dark | Me | ✅ CLOSED by I12 2026-10-02 | ⚠️ **My own baseline measurement said so and I misread it** — 135,560 px at delta 1–8 is a 2.8% veil, not an opaque repaint |
| [x] | Baselines-R2 | Re-record `home-*` and `homesearching-*` after I12–I14 | Me | ✅ DONE 2026-10-02 | Exactly 4 panes failed, as predicted. ⚠️ **The diff asymmetry confirmed F17**: `homesearching-dark` moved **193,735px** against light's 63,602 — dark is where the veil was. The delta histogram also flipped from 93% at delta 1–8 (a veil) to 16% at **129+** (a real replacement). **87/87 twice, exit 0** |
| [ ] | Git-root | Commit the **root** repo | You | ⬜ **TODO — ⚠️ this plan file is UNTRACKED** | `booker/` and `backbone/` are clean, but the root repo has 14 uncommitted paths **including this plan**, `INDEX.md`, and `architecture/database-reset-and-deploy.md` (the seed rule from L3-c). The record of all 17 findings exists only in the working tree |
| [ ] | F16 | `OfferingPage` still has no visual coverage | Me | ⬜ TODO | Split from F12 so it is not hidden. It fetches 3 services unconditionally on mount, so a pane needs service injection or a fetch stub — its own decision. Risk: one rule, `.placeholder` |
| [x] | **I11** | Seed searchable offerings across all 13 divisions | 🤝 | ✅ **DONE 2026-10-02 — you applied it** | `seed.sql` **Block 4c**: 11 vendors + 22 offerings, all 13 slugs now covered (was 2). Confirmed applied: **14 vendors · 32 offerings · 13/13 divisions** (was 2). PSGC validation caught a wrong city code that would have broken one vendor's profile dropdowns. No schedules by design — so "Available today" stays sparse and Popular stays empty for these |
| [x] | **D9** | Does the catalogue seed stay local-only? | You | ✅ **DECIDED 2026-10-02 — (a) local only** | `seed.sql` extended; `booker-demo-seed.sql` untouched, since attaching rather than inventing is what makes it hosted-safe |
| [x] | F13 | Only **2 of 13** divisions have any catalogue locally | 🤖 Mine | ✅ ADDRESSED by I11 (2026-10-02) | `seed.sql` references only `ezzy-well` and `ezzy-court`. ⚠️ A correct search and a broken one look identical for the other 11, and it makes **D6** look wrong when it is not |
| [x] | **F14** | The same query gives different results from Home vs inside Explore | You | ✅ **ACCEPTED AS DESIGNED 2026-10-02** | Option 1, your decision — no code change, this is what shipped. Measured, not inferred: `court` from Home filters to EzzyCourt and hides the EzzyStay cabana; typed in Explore it does not. ⚠️ A later change wiring `matchDivision` into Explore's input would **undo** this, not fix it — comment added at the call site |
| [x] | F7 | `loadCatalogue()` returned early on an in-flight fetch | Me | ✅ DONE 2026-10-02 | In-flight promise held in a **ref** and handed back, so an `await` now means "ready". ⚠️ Also closes a same-tick race the old state guard only half-caught. Cleared in `finally` so a failed fetch cannot wedge later calls |
| [x] | F8 | Two components borrowed `--div-ezzy-well-fg` | Me | ✅ DONE 2026-10-02 | New `--db-tone-popular-fg` / `--db-tone-money-fg`, identical values — verified live, **nothing moved**. ⚠️ Corrected my own note twice: it is **purple** not green, and `HomeSection` borrows `-deep` four times by design (left alone). No component reads the badge pair now |
| [x] | **F15** | The overlay highlighted nothing for an offering-name query | 🤝 | ✅ **DONE 2026-10-02** | Your review finding. New `soleResultDivision()`; highlight and filter are now **separate values** — the filter stays conservative (D6/F14), the highlight follows the results. 6 queries gain a correct mark, `overnight` correctly stays dark. +6 tests (**171/171**). ⚠️ One of my test expectations was wrong before the code was — category is searchable |
| [x] | Review | Six specific checks, then round 2 re-checked | You | ✅ **DONE 2026-10-02** | **Your acceptance**, not a machine check: highlight confirmed (F15), then round 2 — *"the review went fine. Everything is working."* |
| [ ] | Git | Commit | You | ⬜ TODO | I draft the message and the file list |
