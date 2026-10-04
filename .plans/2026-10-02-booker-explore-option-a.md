# Booker Explore — Option A: the catalogue under a pinned filter bar

**Date:** 2026-10-02
**App / scope:** `./booker` web only — `components/explore/ExplorePage/` and `app/globals.css` if a token is needed. No `backbone/`, no migration, no schema change, no `command/`, no mobile. Read-only reference: `components/layout/AppShell/AppShell.tsx` (the scroll container).
**Status:** COMPLETE — build scope, 2026-10-02. All five stages S1–S5 executed; A1, A2, A3, A3-b, A4 and A5 shipped and measured; `tsc` clean, 177 tests, lint at its 18 pre-existing baseline, `next build` compiles, visual suite **89/89 on two consecutive full runs** against two re-recorded baselines. ✅ **S5-a closed by the user on 2026-10-02** — they reviewed the two captures and committed. ⏸ F3 and F4 are carried deferrals, not gaps. **Nothing on this plan is waiting on me.**

> One-line framing: Explore becomes a single always-present catalogue under one pinned bar. Five deltas, no new mode, no change to the matcher or the filter contract.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** A# = an Option A delta, F# = finding; numbers are plan-local.

---

## Where this came from

Option A was chosen by the user on 2026-10-02 from three proposals in
`.plans/2026-10-02-booker-ui-fixes-and-explore-proposal.md` (appendix), after reviewing a runtime
preview of all three handling states. That plan is **COMPLETE (build scope)** and shipped items
B1 and I1–I9; this plan builds on what it left.

⚠️ **Most of "the Explore redesign" already shipped there.** After I2 (short labels), I3 (the
all-offerings default) and I4 (the 24-card reveal), Explore is *already* a bar over the whole
catalogue. What remains is the five deltas below and nothing else — which is the honest size of
this plan, and the reason it is short.

---

## Investigation (done 2026-10-02, by reading the code)

- **The shell scrolls an INNER container, not the window:** `AppShell.tsx:333` is
  `<div className="flex-1 p-5 overflow-y-auto">`, and `TopBar` (`sticky top-0 z-[11]`) plus
  `TabBar` sit **outside** it as earlier siblings inside `<main className="… overflow-hidden">`.
  Two consequences, both load-bearing:
  1. `position: sticky` on Explore's head resolves against **that container**, so it pins
     directly beneath the tab bar with **no z-index contest** — the top bar is in a different
     part of the layout and the two never overlap geometrically.
  2. ⚠️ **The container's own `p-5` is the trap.** At `top: 0` the head pins 20px below the
     container's edge, and page content scrolls through the 20px gap above it. The head needs to
     cancel that padding (negative inline margins plus `top: 0` with its own padding), or the
     padding has to move off the container — and moving it would touch **every** page, so it does
     not. A3's runtime preview used negative margins *in the gallery fixture*, which is not the
     real shell: this must be re-checked in the app.
- `ExplorePage.module.css` `.page` is `max-width: 980px; margin: 0 auto` — the head's negative
  margins must not break that centring.
- The division chips are text-only today (`ExplorePage.tsx`, `.chip`); `data-division` is already
  on each, so `--division-deep` is in scope for a mark with no new mapping.
- `ezzy-ride` has **no logo file** (`lib/divisionIcon.ts` `BUNDLED`), so its pill carries the
  label alone. Visible in the preview; honest until that file exists.

---

## ITEMS

### A1 — the head pins to the top of the scroll container  ✅ DONE (2026-10-02)
**File:** `booker/components/explore/ExplorePage/ExplorePage.module.css` (`.head`, `:21`)
Refining a search means scrolling back up today. `.head` becomes `position: sticky; top: 0` with
an opaque ground (`--db-page-accent`), a divider beneath it, and inline margins that cancel the
scroll container's 20px padding so nothing shows through above it.
**Verification:** scroll the real app (not the gallery) at 1280 and 390 and assert the head's
`getBoundingClientRect().top` stays pinned and nothing renders above it.
⚠️ Re-check against the real shell, not `/ui-gallery` — the fixture has no `p-5` container.

**✅ DONE (2026-10-02).** `.head` is `position: sticky; top: -20px; z-index: 5` with
`margin: -20px -20px 0` and `padding: 20px 20px 12px`, on `--db-page-accent` with a bottom divider.

**Verified against the REAL structure, rebuilt in the browser.** The gallery renders `ExplorePage`
bare, so the fixture cannot answer this question at all — `AppShell`'s
`<div class="flex-1 p-5 overflow-y-auto">` was reconstructed around it, with 1400px of striped
filler below, then scrolled. At 1100px and 390px, at rest and at `scrollTop: 400`:
`headTop − scrollportTop = 0` in all four, and `elementFromPoint` 3px below the scrollport's top
edge returns **the head itself**, not page content.

⚠️ **I was wrong about the mechanism, and the plan was right.** I argued `top: 0` would be flush
because the scrollport is the padding box. Measured, `top: 0` pins the bar **20px down** and a
result button paints in the band above it — the scroll container's padding insets the sticky
rectangle. Three candidates were measured before one was kept; the losing two are recorded in the
stylesheet so the next person does not retry them.

⚠️ **New coupling, written at the call site:** the `-20px` mirrors `AppShell.tsx:333`'s `p-5`. If
that padding changes, this breaks **silently** — the bar still pins, and a sliver of content
reappears above it. See F4.

### A2 — each division pill carries its mark  ✅ DONE (2026-10-02)
**File:** `ExplorePage.tsx` (`.chip`), `ExplorePage.module.css`
A 17px mark at the pill's leading edge, **painted through `-webkit-mask-image` + `background-color:
var(--division-deep)`**, never an `<img>`.
⚠️ **This is not a style preference.** Four of the thirteen marks are near-black line art —
`ezzy-food` mean luminance **1**, `ezzy-home` 38, `ezzy-care` 48, `ezzy-learn` 68 — and an `<img>`
of them on a dark pill is invisible. `SearchingOverlay` and `OfferingResultCard` already do this;
this is the third consumer, so **check whether the mask treatment should be extracted** rather
than written a third time (the `.db-shelf-head` lesson from the previous plan's I9).
**Component separation:** ⚠️ **this plan's own instruction was wrong and was not followed — see F1.**
The mask URL is resolved by `divisionIcon()` and set **inline**, exactly as the two existing
consumers do.

**✅ DONE (2026-10-02).** `ExplorePage.tsx` renders a masked `<span>` per pill from
`divisionIcon(d.slug, d.name)`; `.chipMark` in the module carries the static mask mechanics; the
chip became `inline-flex` with a 7px gap.
**Verified by measuring all 13 marks against the composited pill background in both themes**, plus
a look at the rendered strip: every mark is **≥ 5.63:1** (7.31 dark / 5.63 light unselected, 5.89
on the selected tint). `ezzy-ride` renders its label alone — it has no logo file, and a two-letter
monogram in a 17px box beside its own label is unreadable decoration.

### A3 — the pills become one scrolling row on a phone  ✅ DONE (2026-10-02)
**File:** `ExplorePage.module.css` (`.filters`)
Measured in the preview at 390px: thirteen pills wrap to **four rows** and, with the shortcut
cards, fill the whole first screen before a single result. Below 640px `.filters` becomes
`flex-wrap: nowrap; overflow-x: auto` with `flex: none` chips and no visible scrollbar.
⚠️ **`max-width: 100%` and a `min-width: 0` wrapper are both required** — exactly the trap that
cost a correction in the previous plan's I5, where `overflow-x: auto` alone did nothing because
the strip simply grew past its clipping parent.
**Verification:** at 390px assert `scrollWidth > clientWidth`, that the last pill is reachable
after scrolling, and that the page itself still has no horizontal overflow.

**✅ DONE (2026-10-02).** Below 640px `.filters` is `flex-wrap: nowrap; max-width: 100%;
min-width: 0; overflow-x: auto` with `flex: none` chips and no visible scrollbar, plus
`padding-bottom: 4px; margin-bottom: -4px` so a focus ring on a pill is not clipped by the new
scroll container (`overflow-x: auto` clips vertically too).
**Verified at 390, 640 and 1100:** one visual row below the breakpoint (was four at 390), the row
scrolls, it stays within its parent, the last pill is reachable, the page has no horizontal
overflow, and touch targets stay at 44px. Desktop still wraps to two rows and does not scroll.
The `max-width`/`min-width` pair was carried in from booker I5 rather than rediscovered.

**Plus one thing this item created and had to solve — see A3-b.**

### A3-b — the selected pill must stay on screen  ✅ DONE (2026-10-02)
**File:** `useExplorePage.ts` (`filtersRef` + an effect), `ExplorePage.tsx` (the ref)
**Not in the plan — a consequence of A3, found while building it.** A division tapped on Home
arrives here pre-selected (plan I11). Once the pills stop wrapping, arriving from "Law" — the
**thirteenth** — lands on an Explore whose active filter is scrolled out of sight, with nothing on
screen explaining why the results are narrowed.
**Fix:** the hook owns a ref to the row and, when `division` changes, centres the selected pill by
setting the row's `scrollLeft`.
⚠️ **`scrollLeft`, not `scrollIntoView`** — the latter walks every scrollable ancestor and would
also move the page vertically. This touches one axis of one element, and on a desktop (where the
row wraps and `scrollWidth === clientWidth`) it is a no-op.
**Verified by the case that actually matters**, since the fixture preselects the *first* pill and
proves nothing: with the row parked at `scrollLeft: 0`, selecting the thirteenth pill moved it to
**855** and the pill measured fully inside the row. Deselecting left the row at 854 — it does not
jump back and fight the user.
**Component separation:** the effect and the ref live in the hook; the `.tsx` only attaches it.

### A4 — Where and the shortcuts stop eating the first screen on a phone  ✅ DONE (2026-10-02)
**File:** `ExplorePage.tsx`, `ExplorePage.module.css`
The "Where" row and the two shortcut cards push results below the fold at 390px.

**Fix approach (D1 = inline, D2 = one pill row, both resolved 2026-10-02):**
- **Where stays inline**, below the pill row, exactly as it renders now. Nothing to build — this
  half of A4 is a decision to *not* add a sheet, recorded so it is not revisited.
- **Recent + Popular collapse to a single scrolling pill row** below 640px: one row carrying the
  recent queries first, then the popular categories, in place of the two `db-card` sections. Both
  features survive; the two cards stay as they are from 640px up.
  ⚠️ Same `overflow-x` trap as A3 — `max-width: 100%` plus a `min-width: 0` wrapper, or the row
  grows past its parent and is clipped rather than scrolled.
  ⚠️ The two sources must stay **distinguishable**: a recent query and a category look identical
  as bare pills. The recent ones keep their `Clock` glyph (they have it today), which is the
  existing signal and costs nothing.
**Component separation:** `useExplorePage` already returns `recent` and `categories` separately;
the row is markup plus CSS, no new state and no hook change.

**✅ DONE (2026-10-02).** Below 640px `.startGrid` becomes one `flex-wrap: nowrap; overflow-x: auto`
row, the two sections lose their card chrome through an explicit `.startCard` class, `.pills` stops
wrapping, and `.startTitle` goes visually hidden.
**Verified at 390 and 1100:** on a phone the two cards render as **one** scrolling row, inside its
parent, with the chrome stripped and no page overflow — and the results count line now sits at
**y=289** instead of below two stacked cards. Desktop is untouched: both sections still carry their
card chrome and both headings are visible at 440×17.
⚠️ **The headings are hidden, not removed** — `1×1` and clipped, so a screen reader still meets
"Recent searches" and "Popular categories" instead of one undifferentiated run of buttons. On
screen the `Clock` glyph on a recent query is what separates the two groups; it was already there.
⚠️ **The card chrome is overridden from the module, and that works because of CASCADE LAYERS, not
specificity:** `db-card` sits in `@layer components` and `p-5` in Tailwind's utilities layer, while
CSS-module rules are unlayered — and unlayered wins over any layer. The explicit `.startCard` class
exists so this is a deliberate override rather than a lucky one.
**Where needed no work at all** — D1 chose to keep it inline, so this half of the item was a
decision not to build a sheet.

### A5 — the prompt heading goes  ✅ DONE (2026-10-02)
**File:** `ExplorePage.tsx:43` (`<label htmlFor="explore-search">What do you want to book?</label>`)
The field's own placeholder ("Try a service, a vendor or a city") says the same thing, and the row
is worth more than the repetition — especially once the head is pinned and costs that height on
every scroll.
⚠️ **It is a `<label>` with `htmlFor`, not a heading.** Deleting it outright leaves the search
input with **no accessible name**. The label must become visually hidden (a `.srOnly` utility),
or be replaced by an `aria-label` on the input. Losing it is an accessibility regression, not a
tidy-up.
**Verification:** assert the input still has an accessible name in the a11y tree.

**✅ DONE (2026-10-02).** The label stays, with Tailwind's `sr-only`; `.heading` is deleted from
the module as now-unused.
**Verified:** Playwright's aria snapshot of `#explore-search` reports **`searchbox "What do you
want to book?"`** — the name survives. The label measures **1×1** and is clipped, and a screenshot
of the head confirms the text is off-screen.
⚠️ One check of mine was useless and is recorded so it is not reused: `document.body.innerText`
still returns visually-hidden text, so "is the heading on screen?" cannot be answered that way.
The bounding box and the screenshot are what settled it.

---

## DECISIONS

<!-- No item may execute while any OPEN: line remains. -->

- **D1 — how does "Where" reach a phone (A4)?** → **(b) keep it inline** (resolved 2026-10-02).
  A sheet for a single `<select>` is a lot of machinery while Where is the only filter, and
  (b) → a sheet is easy the day a second one lands (the parked "When" filter, redesign plan P10,
  is the obvious candidate). **No new component is built by this plan.**

- **D2 — do Recent searches and Popular categories survive on a phone (A4)?** → **(b) collapse to
  one scrolling pill row** below 640px (resolved 2026-10-02). Both features keep working on the
  device where re-running a recent search matters most; the two cards remain from 640px up.

---

## FINDINGS (discovered during execution)

### F1 — this plan told me to put the mask URL in CSS; that would have broken the icon resolver  ✖ CORRECTED (2026-10-02)
A2 as written said the per-slug mask URL "belongs in CSS keyed by `[data-division]`, **not** an
inline `style={{}}`". Checked against the two existing consumers before building: **both**
`SearchingOverlay` and `OfferingResultCard` resolve the src through `divisionIcon()` and set the
URL inline, with a comment at each call site saying why.
⚠️ Thirteen `[data-division] { mask-image: url(/division-icons/…) }` rules would have created a
**second source of truth for the icon path**, against `lib/divisionIcon.ts`'s stated rule — "ONE
resolver, so that when Command gains the ability to set a division's icon, this file changes and
nothing else does" — and `schema.md`'s note that `iconPath` exists for exactly that future.
**The plan was wrong; the existing pattern was followed.**

### F2 — `--division-deep` on an unselected pill is invisible in dark  ✅ FIXED (2026-10-02)
Built first with `background-color: var(--division-deep)`, which is what the approved runtime
preview showed. **Measured against the composited pill background, it fails badly in dark:**

| division | dark | light |
|---|---|---|
| `ezzy-home` | **1.21:1** | 14.86 |
| `ezzy-care` | **1.54:1** | 11.61 |
| `ezzy-stay` | 2.00 | 8.95 |
| `ezzy-learn` | 2.23 | 8.05 |
| `ezzy-food` | 2.26 | 7.94 |
| `ezzy-court` (selected) | 5.89 | 5.89 |

That token is the same value in both themes because it is built for white text on a coloured band
— the documented trap, hit again. ⚠️ **Light was fine everywhere (5.89-14.86), which is exactly how
this class of bug hides from a light-theme review.**
**Fix:** `background-color: currentColor`. The pill already sets `--db-text` unselected and
`--division-deep` selected, so one declaration gives both states, can never drift from the label
beside it, and reuses the proven ink-on-tint pairing. Re-measured: **≥ 5.63:1 everywhere**.
⚠️ **The runtime preview the user approved was wrong on this point.** A preview proves the shape,
not the contrast.

### F3 — the mask mechanics now exist in three places; NOT extracted, deliberately  ⏸ PARKED (2026-10-02)
`.ink` (SearchingOverlay), `.phMark`/`.footMark` (OfferingResultCard) and now `.chipMark` each
repeat the same six declarations (`mask-repeat`, `mask-position`, `mask-size`, ×2 for `-webkit-`).
The I9 precedent says extract at the third consumer — but that one was ~20 lines of gradient maths
where drift is invisible and expensive; this is six lines of boilerplate where drift is immediately
visible (the mark tiles or vanishes). Extracting now would also mean touching two shipped
components in passing, which booker's own styling rule forbids ("fix a component when you rewrite
it, not in passing"), and a utility with one consumer is the abstraction Simplicity First warns off.
**Unblocked by:** the next rewrite of any one of the three — extract then, with that component's
baselines already in play.

---

### F4 — the sticky offset hardcodes AppShell's padding  ⏸ PARKED (2026-10-02)
A1's `top: -20px` / `margin: -20px` mirror `p-5` on `AppShell.tsx:333`. Nothing enforces the pair:
change the shell's padding and Explore's bar keeps working while content creeps back into the band
above it — a silent, visual-only regression that no type check or test would catch.
**Options when it matters:** a shared `--shell-pad` custom property set where `p-5` is today and
read here, or a visual assertion in the suite. **Not done now** because the fix means replacing a
Tailwind utility on the shell with a custom property, which touches every page, and the coupling is
documented loudly at both ends. **Unblocked by** anyone changing that padding, or by a third
consumer wanting the same offset.

---

## Execution order

One stage at a time (developerboss cadence). Each stage ends with `npx tsc --noEmit`,
`npm run lint`, `npm test`, and a report.

1. **S1 — A2 + A5.** Independent of the decisions, and the two smallest. A5 carries the
   accessible-name guard.
2. **S2 — A1.** The sticky head, checked in the real shell.
3. **S3 — A3.** Needs A1 in place to judge the phone layout honestly.
4. **S4 — A4.** Needs D1 and D2.
5. **S5 — baselines.** ✅ DONE (2026-10-02).

### S5 — what was actually run  ✅ DONE (2026-10-02)
1. **Full suite first, before touching a baseline:** **2 failed, 87 passed** — and the two were
   `explorechips-light` and `explorechips-dark`, **nothing else**. Explore was the only surface
   this plan touched, and the suite agrees.
2. **The diff was reviewed before re-recording** (`test-results/` is emptied by the next run). The
   capture shows exactly the four intended deltas and no fifth: no prompt heading, marks on every
   pill, the bar on its opaque ground with a bottom divider, Where still inline. 144k–148k pixels,
   ratio 0.14 — large because the bar's ground and the removed heading move everything below.
3. **Re-recorded scoped** to those two, then **two consecutive full unscoped runs: 89/89, exit 0,
   zero failures** — the second because `.db-card` carries `backdrop-filter` in dark, which the
   config's own header records as a source of unstable screenshots.
4. **Result: 2 baselines modified**, no new ones.

⚠️ **The `explorechips` baseline is now unrepresentative of the real shell in one respect, and the
suite cannot tell.** `.head`'s negative margins are sized for `AppShell`'s `p-5` container; the
gallery renders `ExplorePage` bare, so in the capture the bar bleeds past the fixture's own padding
to the image edge. That is correct in the app and odd in the fixture. The sticky behaviour itself
has **no** visual coverage at all — a screenshot cannot scroll — and was verified by rebuilding the
shell's scroll container in the browser instead (see A1).

⚠️ **Explore's result board still has no visual coverage**, as this stage was asked to check: the
fixture ships an empty catalogue because `csp.spec.ts` asserts it makes no network call, and
seeding offerings would fire `getCoverPhotos` and break that test. A non-fetching board fixture
would need either a photo-service seam or a stubbed route, which is a larger change than this plan.
**Saying so rather than pretending**; carried as the previous plan's F3.

✅ **S5-a — the user's review (2026-10-02).** They reviewed the two captures and committed:
"S5-a passed, commit done". A passing suite only ever proved stability; this is the step that
establishes correctness, and it is theirs.

⚠️ **Port 3000 must be free for the visual suite** (previous plan's F1).

## Verification

| Item | Check | Kind |
|---|---|---|
| A1 | head stays pinned while scrolling, nothing above it, **in the app** | browser, scripted |
| A2 | every pill's mark is painted and visible in dark, incl. the four dark marks; `ezzy-ride` shows its label alone | browser + a look |
| A3 | at 390px the strip scrolls, the last pill is reachable, no page overflow | browser, scripted |
| A4 | results reachable without scrolling past two cards at 390px | browser + a look |
| A5 | the search input still has an accessible name | a11y tree assertion |
| all | `tsc`, `lint` (18 baseline), `npm test`, `next build`, visual suite | machine |
