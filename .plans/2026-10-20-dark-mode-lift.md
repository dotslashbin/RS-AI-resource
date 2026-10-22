# Dark mode lift — brighter surfaces for booker, vendor and command

**Date:** 2026-10-20
**App / scope:** `booker/app/globals.css`, `vendor/app/globals.css`, `command/app/globals.css` (dark blocks only) — **cross-app, needs approval**.
⚠️ Widened 2026-10-21 by **I9**, which is not a globals.css change: it touches
`vendor/components/ui/Combobox/` and two of its callers. vendor-only, and the only non-CSS item here.
**Status:** COMPLETE — option C executed 2026-10-21; **S1–S5 and I10-a all ✅**, all suites green.
Shipped 2026-10-22: booker **0.29.0**, vendor **0.60.0**, command **0.34.0**, all merged to
`develop`; the plan record is committed in the root repo. **Verified on staging by the user,
2026-10-22** — see Verification.

> Make dark mode's containers read as surfaces, not outlines, without changing light mode
> and without dropping any text below 4.5:1.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local.

**Previews:** [`dark-lift-booker`](previews/dark-lift-booker/README.md) ·
[`dark-lift-vendor`](previews/dark-lift-vendor/README.md) ·
[`dark-lift-command`](previews/dark-lift-command/README.md) ·
measurements: `node .plans/scripts/dark-lift-contrast.mjs`

---

## What is wrong today

All three apps ship **the same dark palette** under different prefixes (`--db-*`, `--sp-*`, `--rs-*`):

| Surface | Value | Source |
|---|---|---|
| Page | `linear-gradient(#04060e → #070b17 → #05080f)` | `booker/app/globals.css:271`, `vendor/app/globals.css:135`, `command/app/globals.css:72` |
| Sidebar | `#05080f` — the page's own colour | booker :272, vendor :136, command :73 |
| Card | `rgba(255,255,255,0.028)` + blur | booker :276, vendor :142, command :79 |
| Panel / popover | `#0c1220` | booker :299, vendor :160, command :91 |

Measured (`dark-lift-contrast.mjs`): card against page **1.05:1**, sidebar against page
**1.02:1**, panel against page **1.05:1**. A card is distinguishable only by its 7%-white
border, so in dark mode every page reads as one flat black field with outlines drawn on it.

## The three options (all dark-only — light mode is untouched)

| | Page | Sidebar | Card | Panel | Card/page | Text regressions |
|---|---|---|---|---|---|---|
| Current | `#04060e→#070b17` | `#05080f` | 2.8% white | `#0c1220` | 1.05 | — |
| **A** brighter base | `#0a0e1b→#0d1323` | `#0b101d` | 3.5% white | `#141b2d` | 1.08 | **5 booker tile labels < 4.5:1** |
| **B** lifted containers | unchanged | `#0b101e` | `#121a2b` opaque | `#1a2337` | **1.13** | **none** |
| **C** both — **chosen** | `#080c18→#0b1020` | `#0f1526` | 5.5% white (see-through) | `#1e283d` | 1.13 | 5 booker tile labels + 2 badge reds retuned (I3, I7) |
| C-solid (rejected, B1) | same as C | `#0f1526` | `#161e31` opaque | `#1e283d` | 1.14 | nested cards invert |

B and C also share: card border 7% → 8%, input border 10% → 12%, pill/sub/input fills
+1%. B removes the card blur (an opaque card has nothing behind it to blur); the chosen C
keeps it, because its cards are still see-through.

Every text and badge colour stays ≥5.2:1 on every surface in all options; the only pairs at
risk are booker's derived division **tile labels**, which sit on the page and were derived to
clear 4.5:1 against today's page with ~0.03 of headroom (`booker/app/globals.css:163–166`, dark values at :306–315).

**Recommendation: B.** It gives almost all of C's separation (1.13 vs 1.14 card/page), keeps
the page — and so every page-level contrast measurement, the PWA `theme-color`, the
manifest colour and booker's tile labels — exactly as they are. C is the option if you also
want the page itself to feel less black; its extra cost is I3–I5.

---

## BLOCKERS

### B1 — Opaque cards break card-inside-card nesting (found 2026-10-21)  ✅ DONE (2026-10-21) — resolved in the design
**Files:** `booker/components/home/HomeSection/HomeSection.module.css:20–24` (`.section` uses
`--db-card-bg`), `:57–60` (`.body` uses `--db-sub-bg`, "recessed, so the cards inside read as
sitting *in* the shelf"); `booker/components/home/PopularShelf/PopularShelf.module.css:21–31`
(`.card` uses `--db-card-bg` again).
The real Home shelf is a **card containing cards**: the outer section is a card, its body is
a `--db-sub-bg` well, and each offering is another `--db-card-bg` card inside it. The previews
did not draw that outer container (see P1), so this was missed. Today every layer is
translucent white, so each one stacks lighter than the one under it. With C's **opaque**
`#161e31` card the inner offering cards would render **darker than the well they sit in**
(inner vs body −1.15:1): the nesting looks inverted.
Card tokens are read in ~50 files per app (booker 54, vendor 49, command 54), so auditing every
nesting site by hand is not a small job.
**Fix approach:** make C's cards **translucent white at a higher alpha** instead of opaque.
White-over stacking keeps every nesting correct with no audit:

| C variant | Card | Shelf body | Inner card | Card/page | Inner vs body | Body text on inner |
|---|---|---|---|---|---|---|
| opaque (as previewed) | `#161e31` | `#22293b` | `#161e31` | 1.14 | **−1.15** (inverted) | 6.48 |
| white 5% | `#171c2b` | `#202533` | `#2b303d` | 1.12 | +1.16 | 5.14 |
| white 5.5% | `#181d2c` | `#212634` | `#2d323f` | 1.13 | +1.18 | 5.00 |

The translucent variant keeps the card blur, so I2 is dropped if it is chosen. It also loses a
little of the opaque version's blue tint. It must be re-previewed before approval (P1).

✅ **Resolved 2026-10-21:** user chose see-through cards at **5.5% white** (`rgba(255,255,255,0.055)`).
Re-previewed (P1), and `dark-lift-contrast.mjs` now measures nesting directly: C inner card vs
its well **+1.18** (lighter, correct); C-solid **−1.15** (inverted). Verified by measurement and
by the screenshots `c` vs `c-solid` in `dark-lift-booker`. Note that **B would also have
inverted** (−1.14), so this would have bitten either solid-card option.
⚠️ The deeper four-layer check also surfaced I7.

## IMPORTANT

### P1 — Make the booker preview draw the real shelf container  ✅ DONE (2026-10-21)
**File:** `.plans/previews/dark-lift-booker/screens.js` (uses `PVA.shelf`, which renders only
the `.db-shelf-head` band and puts the offering cards straight on the page).
The real `HomeSection` wraps the heading **and** the cards in one card with a recessed body.
The preview also uses `--db-tone-popular-fg` for the accent, while the app's Popular shelf uses
`--div-ezzy-well-deep` (`HomeSection.module.css:28`). Rebuild the shelf to match, and show the
opaque and translucent variants of C side by side so B1 can be decided by looking.
✅ Done 2026-10-21: `dark-lift-booker/screens.js` now draws `HomeSection` + `PopularCardRow`
(section card, recessed well, cards inside, the `--div-ezzy-well-deep` accent, See all). Added the
`c-solid` screen as the record. vendor and command previews switched to see-through C too.
Verified: `shoot.mjs` 9 checks, 0 failures in all three (booker 20 cells, others 16); screenshots
inspected.

### I1 — Swap the dark surface tokens in all three apps  ✅ DONE (2026-10-21) — booker, vendor, command
**Files:** `booker/app/globals.css:271–301`, `vendor/app/globals.css:135–162`, `command/app/globals.css:72–93`
Paste the chosen option's values from the preview's `preview.css` (`.dark [data-opt="…"]`
blocks — the same numbers in each app, only the prefix differs). vendor also gets
`--sp-modal-bg` and `--sp-badge-bdr`; booker `--db-page-accent`.
Chosen values (C, see-through): page `linear-gradient(145deg,#080c18 0%,#0b1020 55%,#090e1a 100%)`;
sidebar `#0f1526`; topbar `rgba(15,21,38,0.85)`; tabbar `rgba(15,21,38,0.8)`; card
`rgba(255,255,255,0.055)`; card border `rgba(255,255,255,0.08)`; card shadow
`0 8px 32px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.04)`; divider 8%; pill 5%;
input 6% / border 12%; sub 5%; panel `#1e283d`; vendor modal `#182136`; vendor badge ring
`#181d2c`; booker page-accent `#0f1526`. The preview `preview.css` files hold exactly these.
**Fix approach:** tokens only; no component changes. Light `:root` blocks must not change —
check with `git diff` that only lines inside `.dark { }` moved.

### I2 — Drop the dark card blur where cards become opaque (B/C only)  ✖ ABORTED (2026-10-21) — the chosen C keeps see-through cards, so the blur still has something to blur; nothing to change
**Files:** `booker/app/globals.css:499` (`.dark .db-card { backdrop-filter: blur(16px) }`),
`command/app/globals.css:147` (`.rs-card` — blur hard-coded for both themes),
`vendor/app/globals.css:145` (`--sp-card-blur` token → `none`).
A blur behind an opaque fill renders nothing and still costs a compositing layer per card.
⚠️ command's blur is in the rule itself, not a token — removing it also removes it in light,
where the card is opaque `#ffffff` anyway. Confirm no visual diff in light.

### I3 — Retune five booker tile labels (A/C only)  ✅ DONE (2026-10-21)
**File:** `booker/app/globals.css` `.dark` `--div-*-label` (:306–315)
On option C's page: court `#2571fc→#2c75fc`, care `#6379b1→#667cb3`, drive `#0c77ec→#137bed`,
learn `#478579→#4b877c`, home `#747a80→#787e84` (smallest lift to ≥4.55:1). Option A's page is
lighter still and would need its own values. Verified by `booker/lib/palette.test.ts`.

### I4 — Update theme-color and manifest colour (A/C only)  ✅ DONE (2026-10-21) — booker, vendor, command
**Files:** `booker/app/layout.tsx:139`, `booker/app/manifest.ts:11`, `vendor/app/layout.tsx:68`,
`command/app/layout.tsx:75`. These hard-code today's page colour so the browser/OS chrome
matches the page. Under B they stay correct.

### I5 — Hard-coded `#05080f` badge ring in command's header  ✅ DONE (2026-10-21)
**File:** `command/components/layout/AppHeader/AppHeader.tsx:92` (`dark:border-[#05080f]`)
A ring meant to match the bar behind it; under B or C the bar is `#0b101e` / `#0f1526` and the
ring would show as a dark halo. vendor solved the same thing with a token (`--sp-badge-bdr`);
command should get `--rs-badge-bdr` rather than a second hex. Pre-existing hard-code, surfaced
by this work.

### I6 — Regenerate the dark visual baselines in all three apps  ✅ DONE (2026-10-21) — booker 55, vendor 56, command **has none** (see S3 F11)
Every dark `/ui-gallery` `toHaveScreenshot` baseline changes. Light baselines must **not** —
a light diff means I1 leaked outside `.dark`. Run the suites before and after, and report the
counts per theme.

---

### I7 — Lift booker's dark cancelled/refunded badge red  ✅ DONE (2026-10-21)
**File:** `booker/app/globals.css:359,361` (`--st-cancelled-fg`, `--st-refunded-fg`, dark `#f87171`)
On C's deepest surface (a card inside a card's well) `#f87171` measures **4.48:1**. The smallest
fix is **`#f87474`** (4.57:1), visually the same red. CSS only. Verified by
`booker/lib/palette.test.ts` and `dark-lift-contrast.mjs`. Found 2026-10-21 by the four-layer check.

### I8 — Measure the one hard-coded red outside the tokens  ✅ DONE (2026-10-21) — measured 5.11:1, no change needed
**File:** `booker/components/booking/steps/Step4Documents/Step4Documents.tsx:53` (`text-[#f87171]`,
an upload error line). It does not follow I7 because it is a hex in a class string. In the real
build, check what surface it sits on. If it measures under 4.5:1, swap the value to `#f87474`: one
string, no behaviour change. The other `#f87171` uses are on the login and KYC screens, which keep
their own fixed backgrounds, so they are unaffected.

✅ **Measured 2026-10-21 — no change made, and that is the result, not a skip.** The row this
error sits in is `bg-[var(--db-input-bg)]` (`Step4Documents.tsx:41`), i.e. 6% white over the
`.db-card` the wizard draws (`BookingWizard.tsx:71`), over the new page: `#262b39`. `#f87171`
measures **5.11:1** there — comfortably clear, because the row is two translucent layers
*lighter* than the deepest surface I7 was computed against, not darker. Left as-is: changing it
would be an unexplainable line in the diff.

### I9 — Registration's dropdown panel ignores the forced-dark wrapper  ✅ DONE (2026-10-21)
**File:** `vendor/components/ui/Combobox/Combobox.tsx:62` (`<Popover.Portal>`), callers at
`vendor/components/auth/LoginPage/LoginPage.tsx:313, 316` and `vendor/components/address/AddressFields/AddressFields.tsx:22, 34, 47`

Added 2026-10-21 at the user's request, after a tester saw the registration dropdowns render
**white on staging** while they were dark locally. Investigated; it is neither a browser quirk nor
a stale deploy:

1. The registration surface is **hard-coded dark** — `LoginPage.module.css` contains **zero**
   `--sp-*` tokens (`#04060e`, `rgba(255,255,255,0.025)`, …), so it looks the same in any theme.
2. Its dropdowns are the shared, **token-based** `Combobox` (province, city, barangay, division —
   there is no native `<select>` on the screen), which is why the callers wrap them in
   `<div className="dark">` to force the dark tokens. Those wrappers date from 2026-07-22.
3. ⚠️ **`Combobox` renders its panel through `<Popover.Portal>`, which Radix mounts on
   `document.body`** — outside that wrapper. The input stays inside and is dark; the open list
   does not.
4. So the panel takes `--sp-panel-bg` from the **root** theme, and the provider is
   `defaultTheme="system"` (`vendor/app/layout.tsx:78`): light root → `#ffffff`, dark root →
   `#0c1220`. The tester's machine was in light mode and the developer's in dark.

**Why it belongs in this plan:** C changes `--sp-panel-bg`, so the dark half of this bug changes
value with it, and the light half stays white regardless — the fix and the retune should land
together rather than one making the other look deliberate.

**Fix approach — two options, recommend the first:**
- **Pass the scope to the portal:** an optional `panelClassName` (or `forceDark`) prop on
  `Combobox`, set by the registration callers and drilled one level through `AddressFields`.
  Explicit, no layout risk, touches only the callers that force dark.
- **Give the portal a container:** `<Popover.Portal container={wrapRef.current}>` so the panel
  renders inside the Combobox's own subtree and inherits whatever scope applies, with no new prop.
  Conceptually cleaner, but it moves the panel into the login card's stacking and overflow context,
  so it needs a clipping check first.

The real root cause is a dark-only screen built from theme-aware components; either fix is a patch
over that, and a theme-aware login surface would retire the `<div className="dark">` wrappers
altogether. Out of scope here.

📄 **Full briefing: `.plans/2026-10-21-combobox-portal-dark-handoff.md`** — the mechanism link by
link, the scope checks already done (so they are not redone), both options with their costs, what
*not* to do, and how to verify at both root themes.

⚠️ **vendor only — checked.** `booker` and `command` have no forced-dark subtree (their `dark:`
hits are Tailwind variants keyed off the root, which behave correctly); `InfoTip` shares the portal
pattern but is not used on registration.
**Verified independently 2026-10-21** (this session, every claim re-opened at its line):
`Combobox.tsx:62` is a bare `<Popover.Portal>` with no `container` ✓; `.panel` reads
`--sp-panel-bg` (`Combobox.module.css:34`) ✓; `layout.tsx:78` is `defaultTheme="system"` ✓;
the two wrappers are at `LoginPage.tsx:313,316` ✓; `LoginPage.module.css` contains **zero**
`--sp-*` tokens ✓. Scope re-checked, not taken on trust: vendor has exactly **two** forced-dark
subtrees, both in `LoginPage`; `Combobox` is the only portal-based token component reachable from
them; `kyc/` imports nothing from `components/ui/`; the other `Portal` grep hits are the words
"Vendor Portal", not React portals.

**One addition the briefing did not state:** `AddressFields` has a **second caller** —
`ProfilePage.tsx:83`, inside the normally-themed app. So the new prop must be **optional** and
left unset there, or Profile's dropdowns would be forced dark against a light page. This is
the detail that makes "changes behaviour only where a caller asks" true rather than assumed.

**Decision — option A, with `panelClassName` (resolved 2026-10-21; the user delegated this).**
Not just for the stated "no layout risk": option B's risk is **concrete, not hypothetical**.
`LoginPage.module.css:17–29` `.shell` carries `backdrop-filter: blur(24px)` **and**
`overflow: hidden`. A `backdrop-filter` makes that element the containing block for
`position: fixed` descendants, so under option B Radix's panel would be both contained **and
clipped** by the login card — the Division dropdown sits low in a long registration step, and its
panel would be cut at the card's rounded edge. That is a regression traded for a bug fix, so B is
rejected on evidence rather than deferred for a check.
`panelClassName` over `forceDark`: a generic `ui/` component should not learn what "dark" means
(it just forwards a class to the panel it renders), and the escape hatch composes as
`cn(styles.panel, panelClassName)`. Callers pass `"dark"`.

**Separation:** a prop and its wiring; no state moves between hook and render. `useCombobox.ts`
is untouched — the prop never reaches it.
**Verification:** needs a browser at **both** root themes — open registration with the OS/browser
in light mode and confirm the open panel is dark. Not machine-verifiable from a baseline, since the
suite screenshots closed controls.

### I10 — Explore's filter bar now reads as a grey slab; make it a card like "Browse by division"  ✅ DONE (2026-10-21)
**Files:** `booker/components/explore/ExplorePage/ExplorePage.module.css:48–59` (`.head`),
`booker/components/explore/ExplorePage/ExplorePage.tsx:49` (the wrapper), and the shared heading
chrome at `booker/app/globals.css` (`.db-shelf-head`, `.db-shelf-pipe`).
Raised by the user from a dark-mode screenshot of Explore, 2026-10-21.

⚠️ **This is partly a consequence of S1, not a pre-existing design flaw — check that before
redesigning anything.** `.head` paints `background: var(--db-page-accent)`
(`ExplorePage.module.css:57`), and S1 changed that token (`globals.css:298`) from `#05080f` to
`#0f1526`:

| | page (worst stop) | `--db-page-accent` | ratio | reads as |
|---|---|---|---|---|
| before S1 | `#070b17` | `#05080f` | 1.020 | **darker** than the page — nearly invisible |
| after S1 | `#0b1020` | `#0f1526` | 1.042 | **lighter** than the page — a distinct slab |

So the bar did not change shape; it stopped hiding. ⚠️ `--db-page-accent` has **exactly one**
consumer in the app — this `.head` — so retuning the token is a safe alternative to restyling
(the only other match is a comment in `SearchingOverlay.module.css:71`).

**Fix direction — follow the documented shared pattern, do not import `HomeSection`.**
"Browse by division" is `HomeSection tone="divisions"` (`HomePage.tsx:146–153`): a rounded
bordered card, a header band, and a recessed `--db-sub-bg` body. But `HomeSection` lives in
`components/home/`, and the repo's own rule is that the band is **one rule set with three
consumers** — `HomeSection`, Activity's "My bookings", Payments' month bars — each setting only
`--section-accent` (booker `AGENTS.md`, Styling). Explore should become the **fourth consumer of
`.db-shelf-head` / `.db-shelf-pipe`**, not a cross-feature import of a Home component.
Accent: `--db-toggle-on`, which is what `tone="divisions"` resolves to, so the look matches by
construction and inherits an accent already proven in both themes.

**⚠️ Two traps, both of which make this larger than "add a border-radius":**

1. **`.head` is `position: sticky` and deliberately full-bleed.** `top: -20px` and
   `margin: -20px -20px 0` mirror `AppShell.tsx`'s `p-5` on the scroll container — booker's
   `AGENTS.md` records that `top: 0` leaves a band where content shows above the bar, and that
   this **breaks silently** if the shell's padding changes. `HomeSection` is neither sticky nor
   full-bleed. A rounded card cannot keep the negative margins without its corners being clipped
   off-screen, so this is a real behavioural choice, not styling. → **decision below.**
2. **A titled header band would reverse plan A5.** Explore's visible heading was removed on
   purpose; what remains is an `sr-only` `<label htmlFor="explore-search">`
   (`ExplorePage.tsx:51–55`), because the field's placeholder already says the same thing on
   screen. The division card's look is *defined* by its titled band, so "follow that look"
   either reintroduces a visible title — reversing A5 — or produces a card with no header.
   → **decision below.**

**Separation:** CSS in `ExplorePage.module.css` plus the shared `globals.css` classes; the
`.tsx` change is wrapper markup only; `useExplorePage.ts` is untouched. No new component, and no
new `[data-division]` block (booker's rule: consumers read `--division-*`).

**Decisions applied (all resolved 2026-10-21, see DECISIONS):** stays **sticky**; **gets a
visible title**; the one-token alternative was rejected in favour of building the card.

⚠️ **The accessibility consequence of the title decision is not optional.** A5 left an `sr-only`
`<label htmlFor="explore-search">` behind precisely so the field keeps an accessible name. The new
title is a **heading** (`<h2>`, as `HomeSection` renders it), not a label — a heading does not name
a form control. So the `sr-only` label **stays exactly where it is** and the title is added
*beside* it. Deleting the label because "the title says it now" silently strips the search field's
accessible name, which is the bug A5's comment was written to prevent.
Suggested wording, easily changed: title "Find what you need", meta "Search, filter and sort".

⚠️ **The hard part is sticky + rounded + a padded scroll container.** `.head` currently uses
`top: -20px` with `margin: -20px -20px 0` to sit flush and full-bleed against the scrollport,
mirroring `AppShell`'s `p-5`. A rounded card needs its horizontal negative margins dropped, or its
corners are clipped off-screen. Then `top` has to be chosen:
- `top: -20px` — the pinned card sits flush to the very top; its top corners meet the viewport edge
  and the radius is wasted while pinned.
- `top: 0` — leaves the shell's 20px padding band above the card, and **page content scrolls
  visibly through that gap**, which is the exact failure booker's `AGENTS.md` warns about.
Neither is free. Resolve it while looking at the running app, not from the plan — and re-read the
`AGENTS.md` note first, because it records that this breaks *silently* when the shell's padding
changes.

**Verification:** needs the browser — `tsc`, unit tests and lint cannot see this. Expect the
`explore*` visual baselines to change in **both** themes (a structural change, unlike S1–S3), so
the "light diffs must be zero" rule from the earlier stages does **not** apply to this item.

## DECISIONS
- Which option: A, B or C → **C** (resolved 2026-10-21, user's choice). Brings in I3, I4 and I5
  on top of I1/I2/I6.
- No functionality changes at this time → **confirmed constraint** (2026-10-21). Every item is
  a colour value; nothing changes behaviour, data, routing or markup structure.
- C with opaque or see-through cards → **see-through, 5.5% white** (resolved 2026-10-21, user agreed
  to the recommendation). Nesting stays correct everywhere with no per-component audit.
- Strictly CSS-only? → **No: include the colour-value TS edits I4, I5 (and I8 if needed)**
  (resolved 2026-10-21, user agreed). Still no functionality change. Background: I1, I3 and I7 are CSS (`globals.css` only). I4 and I5 change a colour
  *value* in TypeScript: `theme-color` in three `layout.tsx` files, booker's `manifest.ts`, and the
  `dark:border-[#05080f]` class string in command's `AppHeader.tsx:92`. None of those changes
  behaviour. Options: (a) include them, still no functionality change (recommended); (b) defer
  I4 + I5. Then the mobile browser bar stays `#070b17` against a `#0b1020` page (barely
  visible), and command's badge ring shows a faint dark halo.
- Values exactly as previewed → **yes** (resolved 2026-10-21, with the decisions above).
- I10 sticky? → **keep it pinned** (resolved 2026-10-21, user's choice). The filter card stays
  `position: sticky`; see I10's "pinned card" note for the one hard part.
- I10 visible title? → **yes, add one** (resolved 2026-10-21, user's choice). ⚠️ **This reverses
  plan A5**, which removed Explore's visible heading on the grounds that the placeholder says the
  same thing. Recorded as an override, not an oversight: the card's titled band is what makes it
  read as its own section, and that is the point of the change. See I10 for the accessibility
  consequence, which is NOT optional.
- I10 token-only alternative? → **rejected** (resolved 2026-10-21, user's choice): build the card.
  Retuning `--db-page-accent` would have removed the slab but not made the block a section.
- I9's fix approach → **option A, an optional `panelClassName` prop** (resolved 2026-10-21; the
  user delegated the choice). Rationale and the evidence against option B are at I9.
- ⚠️ **I9 is the one item that is not a colour value.** The "no functionality changes" constraint
  above was set before I9 arrived. I9 adds an optional prop and passes `"dark"` from two
  registration call sites: it changes no behaviour a user can trigger, no data, no routing — but
  it is a code change, not a token swap, so it is called out rather than folded in silently.
  It ships in its own stage for that reason.

## DEFERRED / COSMETIC
- **ezzy-vendor-mobile** ports `--sp-*` verbatim "so the two clients stay visually identical"
  (`ezzy-vendor-mobile/src/theme/tokens.ts:1–5`). Changing vendor web makes mobile drift.
  Out of this plan's scope (web apps only) — needs its own follow-up, which is a cheap token
  swap there too since B/C remove effects RN cannot render anyway (blur).
- Login, KYC-status, kiosk and camera screens use their own always-dark brand gradients
  (`#04060e → #0d1b4b`) — deliberately not part of the dashboard palette; untouched.
- The shadcn `--card` / `--popover` oklch tokens (`--card: oklch(0.205 0 0)`) are a separate,
  neutral-grey set. Not touched here; worth an audit of where they still render.

## Execution order
Stages 1–3 are colour values only: no markup, behaviour, data or routing change. Stage 4 is the
one code change (DECISIONS).
1. **Stage 1 — booker:** I1, I3, I7 (`globals.css`); I4 (`layout.tsx`, `manifest.ts`); I8 check.
   Verify with `palette.test.ts`, the type-check, and the dark/light visual suite (I6).
2. **Stage 2 — vendor:** I1; I4 (`layout.tsx`). Same verification.
3. **Stage 3 — command:** I1; I4 (`layout.tsx`); I5 (`AppHeader.tsx` + a new `--rs-badge-bdr` token).
   Same verification.
4. **Stage 4 — vendor I9** (`Combobox.tsx`, `AddressFields.tsx`, `LoginPage.tsx`). Last, and
   separate: it is the only non-CSS item, and it is **coupled to stage 2** — I9's panel renders
   `--sp-panel-bg`, which stage 2 retunes to `#1e283d`, so the fix should be seen against the new
   value. Doing I9 before stage 2 would mean checking the panel twice.
Execution needs the user's explicit go (cross-app change), and runs one stage at a time unless told otherwise.

## Verification
- Machine: `node .plans/scripts/dark-lift-contrast.mjs` (done for the previews);
  `palette.test.ts` in booker; type-check in each app; Playwright visual suites (dark diffs
  expected, light diffs must be zero).
- ✅ **Checked on staging by the user, 2026-10-22 — all good.** That covers the three things no
  machine check here could reach: dark mode on a real display, Explore scrolled with a real
  result list, and the vendor registration dropdown with the OS in light mode (the condition the
  original bug was reported under). This is **user acceptance**, not a machine result.
- ~~⚠️ **I10's one unverified detail:**~~ *(closed by the staging check above.)* The card is
  pinned and rounded, so while stuck its top
  corners meet the scrollport edge and results *may* show through the two small corner notches.
  The only ExplorePage fixture (`explorechips`) renders **no results** on purpose — `csp.spec.ts`
  asserts it makes no network call — so there is nothing to scroll and no way to capture the
  pinned state locally. **Needs a look in the running app with a real result list.** The
  alternative (`top: 0`) was rejected: it parks the card 20px down and content scrolls through
  the band above it, which is the failure booker's `AGENTS.md` documents.
- ~~⚠️ **Still outstanding after S1–S4: nothing is committed**~~ *(all four commits landed
  2026-10-22.)* (three separate app repos), and
  **no screen has been looked at on a real display**. Every claim above is a machine check.
- Human: look at a real dashboard in dark on a real display — previews use fallback fonts and
  invented fixtures, and an LCD/OLED renders these near-black steps differently.
- ⚠️ **I9 cannot be verified by the visual suite, and a green run is not evidence.** No baseline
  screenshots an **open** dropdown panel, so `test:visual` should show **no diff at all** for I9 —
  if it does, something else moved. The real check needs a browser at **both** root themes:
  `test.use({ colorScheme: "light" })`, open a registration dropdown, and assert the panel's
  computed `background-color`. That assertion does not exist yet; adding it is a genuine
  addition to the suite and the only machine-checkable form of this item.
- I9's other check is a type-check: an optional prop added to `Combobox` and `AddressFields`,
  unset at `ProfilePage.tsx:83`, must not break either caller.

### S1 — booker, executed 2026-10-21
Files: `app/globals.css` (20 token lines, **all inside `.dark`**, verified by brace-matching the
block and checking every changed line number against it), `app/layout.tsx:139`, `app/manifest.ts:11`.
- `npx tsc --noEmit` clean · `npm test` **304/304** · `lib/palette.test.ts` **10/10**, which
  resolves the real `globals.css` variables, so the dark surfaces and the retuned labels are
  contrast-checked against the shipped values, not the plan's.
- `npm run lint`: **18 problems (14 errors, 4 warnings) — booker's documented pre-existing count**,
  unchanged; all in `services/`, none in a file this stage touched.
- Visual suite run **before** regenerating: **55 failed, 66 passed, and every one of the 55
  failures was a `-dark` snapshot. Zero light failures** — the independent check that I1 did not
  leak out of `.dark`. After `--update-snapshots`: **121/121 pass**, 55 baselines modified, no
  `-light` baseline touched.
- ⚠️ `infotip-dark` failed once during the update run at 32.4s (others 1–4s) and passed on retry
  and in the clean full run — a flake, not a regression. Recorded because a green suite that
  needed a retry should say so.

### S2 — vendor, executed 2026-10-21
Files: `app/globals.css` (15 token lines, **all inside `.dark`**, verified the same way as S1),
`app/layout.tsx:68`. No `manifest.ts` in this app.
- `npx tsc --noEmit` clean · `npm test` **560/560** · lint **29 problems (26 errors, 3 warnings),
  all pre-existing in `services/` and hooks — none in a file this stage touched**.
- Visual: **56 failed / 161 passed** before regenerating, **217/217 after**, and the re-run from
  clean is green.

#### ⚠️ F10 — one LIGHT baseline changed, and it is correct
`loginregister-light` moved. The rule "a light diff means the edit leaked out of `.dark`" does
**not** hold on this one screen, and the reason is the subject of I9: registration mounts
`<div className="dark">` wrappers (`LoginPage.tsx:313,316`), so a light-theme render contains a
forced-dark subtree that legitimately picks up the new `--sp-input-bg` / `--sp-input-bdr`.

Confirmed by reading the diff image, not by reasoning: the changed pixels are **only** Province,
Address Line 1, Zip and Division — the fields inside those wrappers. Business Name, Year
Established, Phone and Operating Hours sit outside them, use `LoginPage.module.css`'s own
hard-coded colours, and did **not** move. That contrast is the control.

⚠️ It also confirms the I9 mechanism from the other direction: the wrapper **does** reach the
Combobox's input — which is why the input changed here — while the portal'd panel escapes it.
A future stage must not "fix" this baseline back.

### S3 — command, executed 2026-10-21
Files: `app/globals.css` (15 dark lines + **one new `:root` line**), `app/layout.tsx:75`,
`components/layout/AppHeader/AppHeader.module.css`, `components/layout/AppHeader/AppHeader.tsx`.
- The single light-block change is the new `--rs-badge-bdr: #f0f4ff` — **the exact hex the
  className already hard-coded**, so light rendering is unchanged by construction.
- I5: the ring colour moved out of the render layer. `AppHeader.tsx:92` was
  `` `dark:border-[#05080f] border-[#f0f4ff] ${styles.dot}` `` → `{styles.dot}`, with
  `border-color: var(--rs-badge-bdr)` joining the `border-width`/`border-style` already in
  `.dot`. This also settles the repo rule against hex literals in a `className`.
  Dark value **#1a2030**, computed rather than guessed: `--rs-topbar-bg` over the new page, then
  the bell button's `bg-white/5` — the surface the dot actually overlaps.
- `npx tsc --noEmit` clean · `npm test` **148/148** · lint **24 problems (19 errors, 5 warnings),
  all pre-existing, none in `AppHeader`** · Playwright **43/43**.

#### F11 — command has no screenshot baselines, so I6 was a no-op here  ✅ CLOSED (2026-10-22) — accepted, not fixed
`visual-tests/` holds five **functional** specs (closures, flags, payouts, seo,
settings-withholding) and **zero `toHaveScreenshot` calls**. The plan assumed all three apps had
dark baselines to regenerate; command has none. Its 43 tests passing says the header still works,
**not** that the new colours look right — command is the one app of the three with no visual
regression net at all. Worth its own follow-up; not opened here.

✅ **Closed 2026-10-22 at the user's call**: they elected not to open a follow-up. ⚠️ Recorded as
**accepted, not fixed** — command still has no visual regression net, so a future colour or
layout change there will not be caught by any baseline. The gap is unchanged; only the decision
to live with it is new.

#### F12 — command's dark `theme-color` used a different gradient stop from the others
It was `#04060e`, the **first** stop, while booker and vendor used `#070b17`, the **middle** one.
Kept command's own semantic (→ `#080c18`) rather than silently aligning the three, since that is a
pre-existing inconsistency and not this plan's to decide. Flagged, not fixed.

### S4 — vendor Combobox (I9), executed 2026-10-21
Files: `components/ui/Combobox/Combobox.tsx` (optional `panelClassName`, applied as
`cn(styles.panel, panelClassName)`), `components/address/AddressFields/AddressFields.tsx`
(optional prop forwarded to its three Comboboxes), `components/auth/LoginPage/LoginPage.tsx`
(both registration call sites pass `"dark"`), new `visual-tests/combobox-portal-theme.spec.ts`.
- `useCombobox.ts` is **untouched** — the prop never reaches the hook, so the render/hook split
  holds. `ProfilePage.tsx:83` deliberately passes nothing and is unchanged.
- `tsc` clean · `npm test` **560/560** · lint **29, unchanged and none in a touched `.tsx`**
  (the two Combobox/AddressFields lint hits are in their `use*.ts` hooks, which this stage did
  not edit) · Playwright **219/219** (217 + the 2 new).
- **S4 changed no baseline** — still the 56 from S2 — exactly as predicted, because no baseline
  captures an open panel. That is the point of the new spec.

#### The new test, and the proof it works
`combobox-portal-theme.spec.ts` drives the real thing: root theme forced to **light**, open the
Province dropdown, and assert the panel's computed `background-color` equals what
`--sp-panel-bg` resolves to **inside** the forced-dark wrapper — resolved through a probe element
rather than pinned to a hex, so a future token change does not make the test lie. It also asserts
the light-root value **differs** from the dark one, so the check cannot pass for the wrong reason.

⚠️ **Verified by removing the fix and watching it fail**, not by watching it pass:
`Expected "rgb(30, 40, 61)" · Received "rgb(255, 255, 255)"` — the white panel the tester
reported, reproduced on demand. The `root dark` case passed with and without the fix, which is
what makes it a control rather than noise.

### S5 — I10, Explore's filter section, executed 2026-10-21
Files: `components/explore/ExplorePage/ExplorePage.module.css` (`.head` rewritten; new
`.headBand`, `.headTitle`, `.headMeta`, `.headBody`), `components/explore/ExplorePage/ExplorePage.tsx`
(band markup + a `.headBody` wrapper; the existing controls re-indented one level, which is most
of the diff).
- Built as the **fourth consumer of `.db-shelf-head` / `.db-shelf-pipe`**, setting only
  `--section-accent: var(--db-toggle-on)` — the value `tone="divisions"` resolves to, so it
  matches "Browse by division" by construction. `HomeSection` was **not** imported.
- `useExplorePage.ts` untouched; no new component; no inline styles added.
- ⚠️ **One deliberate deviation from the copied section: the card uses `--db-panel-bg`, not
  `--db-card-bg`.** The card token is `rgba(255,255,255,0.055)` in dark, and this surface is
  **pinned** — results would scroll visibly through a translucent one. The panel token is opaque
  in both themes and the two land within a hair of each other in dark (#181d2c vs #1e283d), so
  the section still reads as the same material. Asserted in a probe: computed background is
  `rgb(30, 40, 61)` with no alpha.
- Sticky contract confirmed unchanged by computed style: `position: sticky`, `top: -20px`,
  `z-index: 5`, now with `border-radius: 10px`, `overflow: hidden` and `margin-left: 0`
  (the horizontal negative margins had to go, or the corners clip off-screen).
- `tsc` clean · `npm test` **304/304** · lint **18, booker's pre-existing count**, none in
  `ExplorePage` · visual: **exactly the two `explorechips` baselines failed, light and dark**,
  nothing else — then **121/121** after regenerating them.
- Accessibility: the `sr-only` `<label htmlFor="explore-search">` is still present, now with a
  comment saying why the new `<h2>` does not replace it.

#### I10-a — spacing above the card (follow-up, 2026-10-21)  ✅ DONE (2026-10-21)
The user reported the card looking cramped against the tab strip. Cause: `.head` still carried
the old full-bleed bar's `margin: -20px -20px 0`, whose **top** component pulled it up into
`AppShell`'s `p-5`. Correct for a slab meant to sit flush; wrong for a card. The whole margin
declaration is gone — the card now rests on the shell's own 20px padding. `top: -20px` is
untouched, so it still pins flush with no band of content above it when scrolled.

Also corrected a **stale comment** left by I10: the block above `.head` still described "the
negative side margins make the bar 40px wider than `.page`'s column" — margins I10 had already
removed. Consolidated into one accurate block that keeps the measured facts (what `top: 0`
really does; the silent coupling to `AppShell`'s `p-5`).

Verified: `tsc` clean · `npm test` **304/304** · lint **18, pre-existing**.
**Design accepted by the user on sight, 2026-10-21** — the spacing is right.

✅ **Closed 2026-10-21.** The user stopped the dev server that was holding the booker folder;
`explorechips-light` and `explorechips-dark` were regenerated and the full suite re-run from
clean: **121/121, exit 0**. booker is no longer knowingly red.

#### F13 — the gallery renders nothing until mounted, and `networkidle` does not catch it
Not a defect — a trap I walked into while screenshotting. `app/ui-gallery/page.tsx:977–985` is
client-only and gates on `data-gallery-ready="true"`; an ad-hoc Playwright shot that waited on
`networkidle` captured an **empty page** for *every* mode, which briefly looked like this change
had broken the fixture. The fixture's own comment says exactly this. Any future ad-hoc capture
must wait on `[data-gallery-ready="true"]`, as `pilot.spec.ts` does.
- ✅ Three previews built and checked: `shoot.mjs` 9/9 checks, 0 failures, 16 cells each.
