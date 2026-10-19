# Booker UI enhancements — bottom nav, division scroller, offering photos

**Date:** 2026-10-18
**App / scope:** `booker/` only. **No vendor, command, Expo, schema, RLS or dependency changes.**
Driven by `prototypes/prompts/2026-10-18-booker-ui-preview.md`; the approved design is
`.plans/previews/booker-ui/` (F2 and F7 screens).
**Status:** COMPLETE — S1–S4 executed 2026-10-18. All four items ✅. ⚠️ Three checks could not be run here and are listed under Verification: the shell's bottom clearance and the safe-area inset (both need a session / a device), and a real Supabase-backed cover (needs staging).

> Build the three enhancements the user approved from the preview, without disturbing the
> branding work already shipped or the two items still parked.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local. Preview findings
> are referenced as **PF#** (`.plans/previews/booker-ui/README.md`) to avoid colliding with
> this plan's own numbers.

---

## Context a later session will need

**Already shipped (2026-10-18), do not redo:** PF4 ink-based mark sizing (`--division-art`),
PF1 `ezzy-ride` wired into `BUNDLED`, PF6-Ride self-backed disc (`--division-plate`,
`--division-art-box`, `--division-mark-art`). 14 files + 18 regenerated baselines, unstaged.

**Parked, out of scope here:** PF5 (circle-free marks) and PF6-Park (EzzyPark's baked plate,
blocked by PF5). **Nothing in this plan may remove a division tint** — that is PF5's decision.

**Open harness follow-up:** F9 in `.plans/2026-10-18-design-preview-harness.md` — the preview
bar covers a bottom-anchored design. It cost a review round on this very feature. Not fixed.

---

## BLOCKERS

### B1 — Four tabs move to the bottom below 640px  ✅ DONE
**Files:** `components/layout/TabBar/TabBar.tsx`, `TabBar.module.css`,
`components/layout/AppShell/AppShell.tsx` (+ `.module.css`) for bottom clearance

Today `TabBar` is `sticky top-[57px]` (`TabBar.tsx:23`) — a strip under the top bar at every
width. Below 640px it already switches to icon-over-label because four labelled tabs measure
~440px and truncate on a 390px phone (`TabBar.module.css:36`, plan G4). That comment is the
argument for this change: the same width where the strip stops fitting is where it should move.

**Fix approach:** keep **one** `MAIN_TABS` render and let CSS decide placement — `position:
fixed; bottom: 0` below 640px, today's sticky strip above it. ⚠️ **Not two components and not
a second `MAIN_TABS.map`:** two visible menus is an explicit requirement failure, and one
render makes it impossible rather than merely unlikely.

⚠️ **Bottom clearance is part of this item, not a follow-up.** A fixed bar covers the end of
the scroll container, so `AppShell`'s scrollport owes it the bar's height **plus**
`env(safe-area-inset-bottom)` or the last card is unreachable.
⚠️ **`AppShell`'s `p-5` is load-bearing elsewhere** — `booker/AGENTS.md` records that Explore's
pinned filter bar mirrors it with `top: -20px` and negative margins, and that changing the
shell's padding breaks that silently. Add bottom padding; do not alter the existing `p-5`.

**Verification:** machine — visual baselines at 390px show the bar pinned and the last card
clear of it; `getBoundingClientRect().bottom === innerHeight` after scrolling to the end.
Needs-device: `env(safe-area-inset-bottom)` resolves to 0 in a desktop viewport, so the inset
itself is **unverifiable here**.

✅ **DONE (2026-10-18).** `TabBar.tsx` now carries no positioning utilities; `.bar` owns
`sticky/top/z-index` so a media query can flip it to `fixed; bottom: 0` below 640px, with
`top: auto`, the divider moved to `border-top`, and `padding-bottom: env(safe-area-inset-bottom)`.
The active underline moves to the tab's top edge so it is not lost in the device's gesture area.
New `AppShell.module.css` adds bottom padding to the scrollport **only** (`p-5` untouched).

Measured live against a dev server at two widths:

| viewport | `position` | bar bottom | nav elements | tabs |
|---|---|---|---|---|
| 390×844 | `fixed` | **844 = innerHeight** | **1** | 4 |
| 900×1200 | `sticky` | unchanged | **1** | 4 |

⚠️ **Two things are NOT verified and must not be read as done:**
1. **The scrollport clearance.** `/` renders the auth screen without a session, so `AppShell`
   never mounts locally — the padding rule is written but **never exercised**. Needs staging.
2. **The safe-area inset**, as predicted — `env()` is 0 in a desktop viewport.

**Found while verifying — `DevVersionBadge` sat on top of the bar.** It is `fixed bottom-4
right-4` in `app/layout.tsx`, so moving the nav to the bottom put it over the "Payments" label.
`pointer-events-none` meant it never blocked a tap, only covered the word. Lifted with
`max-[640px]:bottom-20`. **Caused by this change, so fixed here rather than reported.**

⚠️ **PROCESS ERROR, recorded because it nearly cost a wasted fixture.** I added a `tabbar`
gallery fixture believing TabBar had no visual coverage — **it already had one**
(`ui-gallery/page.tsx:343`, captured in `MODES`, with committed light/dark baselines). My block
was unreachable dead code and has been removed. The real gap is narrower than I claimed: the
fixture exists but is only ever shot at the default **900×1200**, so only the *desktop*
placement is covered. **I2 therefore needs a narrow capture of the existing fixture, not a new
one.** Skipping "locate before building" is what produced this.

### B2 — "Browse by division" becomes two rows that scroll sideways  ✅ DONE
**Files:** `components/home/HomePage/HomePage.module.css:289` (the `repeat(4, …)` phone rule),
`HomePage.tsx:153–176` (the grid), new `components/home/DivisionStrip/` (component + hook + css)

`HomePage.module.css:289` currently sets four across below 640px with the comment *"Four across
on a phone, so every division is still visible without scrolling the grid"* — 13 divisions, 4
rows, nothing hidden. **This item reverses that deliberately** (decision D2 below).

**Fix approach:** a new `DivisionStrip` component owning the scroller, its dot indicator and
the live region; `HomePage` renders it below 640px and keeps today's `auto-fill` grid above.
The indicator needs `scrollLeft`, which is state — so `useDivisionStrip.ts` holds it and the
`.tsx` stays a pure render layer (component-separation).

⚠️ **A horizontally scrolling row needs `max-width: 100%` AND `min-width: 0`**, not just
`overflow-x: auto`, or it grows past its clipping parent and never overflows itself.
`booker/AGENTS.md` records this costing a correction twice (Activity's tab strip, Explore's
pill row). Written in rather than rediscovered.

⚠️ **Every division stays reachable:** the strip is one focusable group, each tile a real
`<button>` in tab order, and the live region announces "page n of m".

**Verification:** machine — all 13 tiles in the DOM; `scrollWidth > clientWidth`; the active
dot index changes with `scrollLeft`; baseline at 390px. Human: it feels right to flick.

✅ **DONE (2026-10-18).** New `components/home/DivisionStrip/` (component + hook + stylesheet).
The grid markup and its rules **moved** out of `HomePage` unchanged in substance — the section
gained scroll state, so by the render/hook/style convention it owns its own files.

⚠️ **ONE SET OF TILES, TWO LAYOUTS, SWITCHED BY A MEDIA QUERY** — not a second render hidden
with `display: none`. The same `<div>` is a wrapping grid above 640px and a two-row
`grid-auto-flow: column` scroller below. A duplicate would have put 13 more buttons in the DOM
and a second set of tab stops, which is the same reasoning as B1/D3.

Measured live against a dev server:

| viewport | `grid-auto-flow` | rows | `overflow-x` | scrollable | dots | live region |
|---|---|---|---|---|---|---|
| 390×844 | `column` | 2 | `auto` | **yes** | 2 | "page 1 of 2" → **"page 2 of 2"** after scrolling |
| 900×1200 | `row` | 3 | `visible` | no | **0** | empty |

13 tiles at both widths.

⚠️ **`grid-template-columns: none` in the narrow block is load-bearing**, not tidying: the base
rule sets explicit columns and `grid-auto-flow: column` governs only *implicit* tracks, so
without it the tiles fill the explicit columns and the two-row flow never happens.

**Regression evidence for S1 *and* S2 together:** the full visual suite runs at 900×1200, and
**116 of 117 baselines are byte-identical**. The single failure is `login-mobile-info` (the
480px case) and its diff shows **only** the `DevVersionBadge` in its old and new positions —
the intended B1 move. Nothing above the breakpoint was disturbed by either stage, which is the
central claim both stages rest on.

**Obsolete imports removed** from `HomePage.tsx` (`DivisionIcon`, `DIVISIONS`) — lint back to
its pre-existing 18 problems, all in files this plan has not touched.

### B3 — Offering cards use the uploaded photo, division mark only as fallback  ✅ DONE
**Files:** new `hooks/useCoverPhotos.ts`; `components/home/ShelfCard/ShelfCard.tsx` (+ css);
`components/home/PopularShelf/PopularCardRow.tsx`, `PopularShelf.tsx`, `usePopularShelf.ts`;
`components/home/NearYouShelf/NearYouShelf.tsx`, `useNearYouShelf.ts`

⚠️ **This is not a fallback bug and the fix is not a rule change.** `PopularCardRow.tsx:12–16`
takes `{ card, rank, onOpen }` — **no photo prop** — and `usePopularShelf` never calls
`getCoverPhotos`. `ShelfCard.tsx:9–20` is the same. So the mark is not winning a race against a
missing image; **the photo is never requested.** Only `OpenTodayCard` (via `useHomePage:135`)
and `OfferingResultCard` (via `useExplorePage:252`) fetch covers today.

**Fix approach:** extract the keyed-fetch shape into `hooks/useCoverPhotos.ts` and use it in
the two shelves that lack it. ⚠️ **Keyed state, not a bare `Map`** — `useHomePage:122–139`
records why: clearing a bare Map when the id set changes means a synchronous `setState` inside
an effect, a cascading render the lint rule rejects. Storing the result **with** the key it
belongs to makes a stale response unreadable by construction.

⚠️ **Do not refactor `useHomePage` or `useExplorePage` onto the new hook in this plan.** They
work; changing them is unrelated risk. Note it as a later tidy-up (see DEFERRED).

⚠️ **A failed fetch costs an image, never a shelf** — it must fall back to the division mark,
which is the behaviour both existing consumers already have.

**Verification:** machine — a fixture with and without a photo renders photo vs mark; unit test
on the hook's keying; baselines. ⚠️ **The real data path is NOT verifiable locally** — the
`/ui-gallery` fixtures must make no network call (`csp.spec.ts` asserts it), so a true
Supabase-backed cover can only be confirmed on staging.

✅ **DONE (2026-10-18).** New `hooks/useCoverPhotos.ts`; `PopularCardRow` and `ShelfCard` gain
an optional `photo`; `usePopularShelf` and `NearYouShelf` fetch for the rows they actually
draw. `useHomePage` / `useExplorePage` deliberately **not** refactored onto the hook.

⚠️ **THE HOOK'S KEYING HAS NO UNIT TEST, AND THAT IS NOT AN OVERSIGHT.** This repo's tests are
pure-logic (`lib/**/*.test.ts`, `node --test`) with no React renderer, so a hook cannot be
exercised there without introducing a testing dependency — an approval gate, for three lines of
keying. Verified through the rendered surfaces instead.

⚠️ **ShelfCard takes the photo in the MARK'S SLOT, not in a new image area.** The approved
preview drew "Near you" as 16:10 image cards; the real `ShelfCard` is a compact 44px row shared
with "Vendors in your city". The preview and the component disagree about this shelf's shape —
the photo-over-logo rule is implemented as the request states it, but **nobody has approved
turning that row into an image card**, and doing so would also restyle the vendors shelf.

**I1's badge therefore lands on `OpenTodayCard` only.** It is the one in-scope surface with a
real image area (110px panel); `PopularShelf`'s is 78px and `ShelfCard`'s 44px, where a 30px
badge would be a third of the tile. The preview badged only its large image cards too, so this
matches what was approved rather than contradicting it. The result card's named footer is
untouched, as the prompt requires.

⚠️ **The badge REPLACED a text pill that printed `vendor.divisionName`** — the canonical
"EzzyCare" where every other surface prints "Care" via `divisionLabel()`. Removing the text
removes that inconsistency; `title` now carries the label so the division is not conveyed by
artwork alone.

**Found and fixed mid-stage — a fetching fixture.** Adding the fetch to `NearYouShelf` took the
`nearyou` gallery fixture from **0 to 2 off-origin requests**, measured. A gallery fixture that
reaches the network is exactly what `explorechips` was engineered to avoid. `NearYouShelf` now
accepts an optional `photos` map; supplying it hands the hook an empty id list so the effect
returns before touching the service. Re-measured: **0 requests** on `nearyou`, `popular` and
`opentoday`.

⚠️ **NO FIXTURE IN THIS APP HAD EVER PASSED A `photo` PROP.** The photo branch of
`OpenTodayCard` and `OfferingResultCard` — both shipped long ago — has never been in a
baseline. Fixed with an offline `data:` URI cover helper (`img-src` already allows `data:`), so
three branches now have coverage for the first time: `ShelfCard` with a cover, `OpenTodayCard`
with a cover **and** the I1 badge, and `PopularCardRow` with a cover.

---

## IMPORTANT

### I1 — The division badge inside the offering image  ✅ DONE
**Files:** `ShelfCard.module.css`, `PopularShelf.module.css`, `OpenTodayCard.module.css`

The approved design puts a small division mark bottom-right **inside the rounded image area,
with no division-name text**. ⚠️ **The name belongs to the search result's footer
(`OfferingResultCard.tsx:100–112`) and that surface is explicitly out of scope** — the prompt
offers it as a reference, not as permission to change it.

⚠️ **The badge needs an opaque plate.** It sits on an arbitrary photograph and four marks are
near-black line art; the preview tested it over light, dark and busy images and the plate is
what makes one treatment work on all three.
⚠️ **No badge on the fallback state** — stamping the mark onto an image that *is* the mark
draws it twice.

**Verification:** machine — baselines over all three demo image types. Human: legibility.

### I2 — Fixture coverage for every new branch  ✅ DONE
⚠️ **Scope correction (2026-10-18):** `tabbar` already has a fixture and baselines — what is
missing is a **narrow (≤640px) capture** of it, not a new fixture. `pilot.spec.ts:96–98` already
shows the pattern (`setViewportSize({ width: 480 })`) for a width-dependent case.
**File:** `app/ui-gallery/page.tsx`

⚠️ **This is not optional bookkeeping — the suite has already passed over a live bug once in
this work.** `POPULAR` held four line-art divisions and no `ezzy-ride` row, so 117 visual tests
went green while an EzzyRide bullseye was on screen in `PopularShelf`. Every branch added here
(photo present, photo absent, bottom nav at 390px, the scroller) needs a fixture or it is
untested by construction.

**Verification:** machine — each new branch appears in a committed baseline.

✅ **DONE (2026-10-18).** Four new baselines, `tabbar-narrow` and `home-narrow` in both themes,
at **390×844**.

⚠️ **THE WHOLE SUITE RAN AT 900×1200 — ABOVE THE BREAKPOINT — SO IT COULD NOT SEE EITHER
LAYOUT CHANGE.** `tabbar` and `home` already had baselines and both stayed green through all of
S1 and S2. A passing suite said nothing about the thing being built. Same hazard as the
`POPULAR`/`ezzy-ride` row one level up: there the fixture omitted the division that exercised
the branch, here the viewport omitted the width.

Plus three photo branches covered for the first time in S3 (`ShelfCard`, `OpenTodayCard` with
the badge, `PopularCardRow`), via an offline `data:` cover helper.

**`login-mobile-info` was not a regression.** That test already masks the dev version badge;
moving the badge moved the *mask rectangle*, so the diff was two pink boxes and nothing else.
Regenerated.

---

## DECISIONS

- **D1 — Does "Vendors in your city" get photos?** → **No** (resolved 2026-10-18). Its rows are
  **vendors**, not offerings (`HomePage.tsx:253–271`), so there is no offering cover to fetch.
  It keeps the division mark. `ShelfCard` therefore takes `photo` as **optional**.
- **D2 — Does the scroller replace the grid at every width?** → **No, ≤640px only** (resolved
  2026-10-18, user). The request says preserve the wider-screen layout, and the preview's note
  says the same. This knowingly reverses `HomePage.module.css:289`'s "nothing hidden" comment;
  the user approved that trade after seeing it.
- **D3 — One tab render or two?** → **One** (resolved 2026-10-18). CSS decides placement. Two
  renders would make "no duplicate visible menus" a thing to remember rather than a fact.
- **D4 — Dots or a progress bar for the scroll indicator?** → **Dots** (resolved 2026-10-18).
  ⚠️ Worth knowing *why* the preview used dots: a continuously-positioned thumb needs its width
  written from JS, which the preview's CSP forbids. **That constraint does not exist in the
  app** — a bar is buildable here. Dots are chosen because they are what the user approved on
  screen, not because of the limitation.

---

## DEFERRED / COSMETIC

- **`useHomePage` / `useExplorePage` adopting `useCoverPhotos`** — they already work; folding
  them in is a refactor of proven code for tidiness, not a requirement of this change.
- **PF5 / PF6-Park** — parked upstream; see Context.
- **Harness F9** — the preview bar covering bottom-anchored chrome. Separate plan.

---

## Execution order

1. **S1 — B1** (bottom nav + clearance). Self-contained, no data layer, immediate visual payoff.
2. **S2 — B2** (division scroller). Touches only Home; independent of S1 beyond sharing 640px.
3. **S3 — B3 + I1** (photo plumbing and the badge). Coupled: the badge sits on the photo area
   the plumbing introduces, so they land together or the badge has nothing to sit on.
4. **S4 — I2 + baselines** (fixtures, regenerate, full verification sweep). ✅ Done
   2026-10-18: 4 new narrow baselines, 22 regenerated, final sweep **121 passed / 0 failed**,
   `tsc` clean, 304 unit tests, lint unchanged at its pre-existing 18.

⚠️ S1 and S2 both change what renders at 390px, so **baselines are regenerated once, in S4** —
regenerating per stage would bake in an intermediate state twice. As of S2 the suite is
**116 passed / 1 failed**, the failure being `login-mobile-info` awaiting that regeneration.

---

## Verification

| Item | Check | Kind |
|---|---|---|
| B1 | Bar pinned at `innerHeight`; top strip `display: none`; last card clears the bar | machine |
| B1 | `env(safe-area-inset-bottom)` honoured on a notched device | **needs device** |
| B2 | 13 tiles present; `scrollWidth > clientWidth`; active dot tracks `scrollLeft`; keyboard reaches every tile | machine |
| B3 | Photo renders when present, mark when absent; failed fetch → mark, never a broken shelf | machine |
| B3 | A real Supabase cover end to end | **needs staging** — fixtures may make no network call |
| I1 | Badge legible over light, dark and busy images; absent on the fallback | machine + human |
| I2 | Every new branch in a committed baseline | machine |
| all | `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run test:visual` | machine |

⚠️ **Do not pipe a Playwright run through `tail`** — it hides the failure count *and* the exit
code. Redirect to a file and read the summary.
