# booker-ui — design preview

A static preview of the Booker UI changes requested in
`prototypes/prompts/2026-10-18-booker-ui-preview.md`: division-mark sizing, circle-free marks,
the new EzzyRide asset, offering-card photos with a logo-only badge, and the narrow-screen
bottom nav and two-row division scroller.

**Nothing here is implemented in the app.** This is a mock for approval, built ahead of any
code change.

## Open it

```bash
# just open the file — no server, no build
xdg-open .plans/previews/booker-ui/index.html      # or double-click it
```

Use the **PREVIEW** bar at the bottom to switch screen and theme. Both are also in the URL, so
any one state can be linked:

```
index.html?screen=cards&theme=dark
index.html?screen=divisions&theme=light&chrome=off   # chrome=off hides the preview bar
```

⚠️ **Resize the window across 640px.** Three of the requests only exist on one side of that
line, and a screenshot cannot show the transition.

⚠️ **This preview tracks the SHIPPED app as of 2026-10-18.** F4 (ink-based mark sizing), F1
(EzzyRide wired) and the EzzyRide half of F6 (its self-backed disc) are in the app, so screens
1, 3, 6 and 7 render them as they now ship, and screens 2 and 3 carry explicitly-labelled
**Before** columns as the record of what changed. **F5 is parked and is NOT reflected** — every
other division still draws its tint, exactly as the app does. F2 and F7 remain proposals.

## What it shows

| # | Screen | What to look at |
|---|--------|-----------------|
| 1 | `marks` | All thirteen marks in three treatments: on today's tinted disc, circle-free as an image, circle-free mask-painted. **Switch to dark** — the middle column is where four marks disappear. The last block shows the ink choice that fails and why. |
| 2 | `size` | Why EzzyDrive looks smaller, measured, and the fix. Drive and Learn beside three normal-sized peers, before and after. |
| 3 | `ride` | The new EzzyRide asset in each surface, and the three different problems its baked-in circle causes. |
| 4 | `cards` | Offering cards: photo, fallback, and failed image; the proposed badge over a light, a dark and a busy image; the search-result footer shown unchanged as the reference. |
| 5 | `popular` | "Popular this month" today vs proposed, and the plumbing finding behind the report. |
| 6 | `divisions` | The two-row sideways scroller with its centred dot indicator. **Interactive** — drag, flick, or tab in and use the arrow keys. |
| 7 | `home` | Everything in place on one Home screen, with the responsive tab placement. |

## Design fit

| Piece | Comes from |
|-------|-----------|
| Colour tokens | `booker/app/globals.css` — `--db-*` (`:47–94`, `:271–301`), `--div-*-tile` (`:149–162`), `--div-*-fg` (`:102–128`), `--div-*-deep` (`:191–205`). Copied into `_shared/booker.css`, not imported. |
| The tinted disc | `components/home/HomePage/HomePage.module.css:161` — `border-radius: 999px` + `--division-tile`. |
| Mark sizing | `components/ui/DivisionIcon/DivisionIcon.module.css` — `.art` at a flat 66%, which is the rule screen 2 proposes changing. |
| Mask painting | `components/explore/OfferingResultCard/OfferingResultCard.tsx` — `.phMark` / `.footMark` already paint a mark through a CSS mask for exactly this reason. |
| The 640px breakpoint | booker's own: `TabBar.module.css:36`, plus `HomeSection`, `PopularShelf`, `BookAgainCard`, `HomePage`, `OpenTodayCard`. |
| Division order and labels | `lib/divisions.ts` → `DIVISIONS`; labels are what `divisionLabel()` prints ("Care", not "EzzyCare"). |
| Tab set | `lib/constants.ts` → `MAIN_TABS`. |

**No new dependency is implied by anything previewed here.** Every treatment is CSS the app
can already express, and the mask technique is in production today.

## Limits

- **The "photos" are CSS gradients, not photographs.** No real offering image is shipped, and
  nothing here is evidence that live photo data renders. They exist to test whether one badge
  treatment stays legible over a light, a dark and a busy image.
- **Fixtures are invented.** Every vendor, offering, price, city and booking count is made up.
  No real vendor or customer row is used.
- **Static fixtures only: nothing is saved, no Supabase, no app imports, no network.** The
  `shoot.mjs` run asserts zero non-`file://` requests and fails if one is attempted.
- **The broken-image state is drawn, not simulated.** A CSP-safe preview has no `onerror`
  hook, so screen 4's "broken" card is the rendered *result* of a failed photo, hand-drawn.
- **`position: fixed` and full-page screenshots disagree.** In `contact-*.png` the bottom bar
  appears partway down the page. That is a screenshot artifact — verified in a real 390×844
  viewport, the bar is pinned to the bottom (`getBoundingClientRect().bottom === 844` after
  scrolling to the end) with 82px of page padding clearing its 57px height.
- **The sticky top bar is translucent and content shows through it.** That is faithful:
  `--db-topbar-bg` is `rgba(255,255,255,0.85)` with `backdrop-filter: blur(24px)` in the app.
- **Not checked here:** real fonts (Poppins is not loaded — the mock uses the system stack),
  focus movement through a real page, live-region announcement timing, and actual device
  safe-area insets. `env(safe-area-inset-bottom)` resolves to 0 in a desktop Chromium viewport,
  so the bottom bar's inset handling is present in the CSS but is *not* exercised by any check.

## Findings

Numbered for reference in discussion. **F1–F3 are code findings that no amount of design work
fixes**; F4–F6 are design consequences the preview surfaced.

### F1 — the EzzyRide asset is on disk but the app cannot use it
`booker/public/division-icons/ezzy-ride.png` exists (256×256, added 2026-10-18). But
`lib/divisionIcon.ts` resolves a bundled mark from a hardcoded `BUNDLED` set of twelve slugs
and `ezzy-ride` is not in it — the file's own comment still reads "`ezzy-ride` is absent".
**Dropping the PNG in changes nothing on screen.** One line, but a code change, not an asset one.

### F2 — "Popular this month" is not a fallback bug; the photo is never requested
`PopularCardRow.tsx` takes `{ card, rank, onOpen }` and has **no photo prop at all**;
`usePopularShelf` never calls `getCoverPhotos`. The division mark is not losing a race with a
missing image — the component cannot render a photo under any data. The same is true of
`ShelfCard`, which draws **"Near you"** and **"Vendors in your city"**.

Only two surfaces fetch covers today: `OpenTodayCard` ("Available today", via `useHomePage`)
and `OfferingResultCard` (Explore results, via `useExplorePage`). The CSP is **not** the cause —
`img-src` carries the derived Supabase origin (`next.config.ts`), and the historical bug where
it did not is fixed.

So the requested rule needs photo plumbing added to three surfaces. **"Vendors in your city" is
the odd one out**: its rows are vendors, not offerings, so there is no offering photo to fetch
and it would keep the mark.

### F3 — a stray asset marker suggests a Drive logo that never landed
`booker/public/division-icons/` contains `EzzyDrive_site_Logo.png:Zone.Identifier` — a 25-byte
Windows download marker — but **no `EzzyDrive_site_Logo.png`**. If a replacement Drive logo was
meant to be added, the file did not arrive, and the scaling fix in screen 2 may be solving a
problem a better source file would remove. **Worth deciding before the sizing change is built.**

### F4 — Drive is 59% the size of its neighbours, and equal dimensions cannot fix it
Measured from each PNG's opaque bounding box (Chromium canvas, alpha > 10):

| slug | canvas | opaque box | box/canvas |
|---|---|---|---|
| `ezzy-drive` | 512×512 | 290×294 | **0.574** |
| `ezzy-learn` | 512×512 | 417×435 | **0.850** |
| `ezzy-ride` | 256×256 | 256×256 | **1.000** (full bleed) |
| the other ten | — | — | 0.949 – 0.990 |

Every mark is drawn at a flat 66% of its box, so Drive's *ink* lands at 0.66 × 0.574 = **38%**
while its neighbours land near 64%. The fix is to size by ink rather than canvas:
`--art = 0.62 / fill`. **Learn is a second outlier the request did not name** and the same rule
catches it.

### F5 — the circle is CSS, but removing it costs either dark mode or colour
No circle is baked into twelve of the thirteen files — the disc is `border-radius: 999px` plus
`--division-tile`, so removing it edits no asset. But the tint is what keeps four near-black
marks visible (measured mean luminance over opaque pixels: Food **1**, Home **37**, Care **47**,
Learn **67**). Circle-free therefore forces a choice:

- **as an image** — keeps each logo's colours, and Food, Home, Care and Learn disappear in dark;
- **mask-painted** — survives both themes, and flattens every multi-colour logo to one ink.

⚠️ **And the obvious ink is wrong.** `--division-deep` is identical in both themes, so mask
painting with it reproduces a failure booker already measured on an Explore pill (2026-10-02):
Home **1.21:1**, Care **1.54:1**. The app's own answer is `currentColor`; screen 1 shows both.

### F6 — two assets are not shaped like the other eleven
⚠️ **CORRECTED 2026-10-18 — neither is a visible defect in the app today.** The original wording
said EzzyPark "draws a white tile where the other twelve draw nothing"; checked against the
app's own dark baseline (`divisions-dark-chromium-linux.png`), it does not. Both are **latent
properties of the files that constrain other decisions** — not bugs on screen now.

Eleven of the thirteen marks are **line art on transparency**: the drawing only, with the pale
circle behind it generated in CSS (`--division-tile`). Two files carry their own background:

- **EzzyRide** — a solid blue disc, edge to edge, 79% ink. The circle is *in the file*.
  **Latent because nothing draws it:** `ezzy-ride` is absent from `BUNDLED`, so the app renders
  the "ER" monogram instead. **F1 is what would make it visible**, as a blue disc inside the
  pale disc.
- **EzzyPark** — an opaque near-white rounded plate behind the red P. **Latent because the tint
  never goes dark:** `--division-tile` is declared in `:root` only and stays light in dark mode,
  so the plate blends into the tile it sits on. **F5 is what would make it visible**, since
  removing the circle removes the pale tile the plate is hiding against.

So F6 is not independent work. It is a **constraint on F1 and F5**: whichever of those is done
first inherits the corresponding asset problem.

✅ **The EzzyRide half was resolved with F1 (2026-10-18)** — and the earlier claim that it
"cannot be fixed in CSS" was **wrong**. It took a per-slug exception expressed as three tokens,
no asset edit and no `.tsx` change:

| Surface | Broke as | Fixed by |
|---|---|---|
| Home tile (84px circle plate) | bullseye — pale ring around a solid disc | `--division-plate: transparent` + `--division-art-box: 100%`, so the file's own disc takes the plate's footprint |
| `DivisionIcon` box (rounded square) | disc inside a rounded square | same two tokens; the mark now reads as a circle among squircles, which looks deliberate |
| 4 mask-painted surfaces (chip, footer, cover, overlay) | featureless dot — the mask IS a filled disc, so the car vanished | `--division-mark-art`: paint the real image as a background, clipped by the element's own mask of the same file → the artwork in full colour |

⚠️ **`--division-plate` is deliberately NOT `--division-tile`.** The tint also backs large card
covers (`OpenTodayCard .panel` at 110px, the result-card and vendor-page covers); blanking or
recolouring it there would wreck them. The new token covers only the small plate drawn
immediately behind a mark.

⚠️ **A SIXTH SURFACE WAS MISSED ON THE FIRST PASS AND THE SUITE DID NOT CATCH IT
(found by review, 2026-10-18).** `PopularShelf` draws a mark on a 78px tinted panel — the same
plate-behind-mark shape as the Home tile — and was left on `--division-tile`, so the EzzyRide
bullseye was still live there after F1 was reported green. **117 visual tests passed over it**,
because the `POPULAR` fixture held four line-art divisions and no `ezzy-ride` row. Fixed, and
the fixture now carries a ride row with a comment saying why it must not be dropped.

**The lesson is about the suite, not the CSS:** a passing visual run proves only that the
fixtures render as before. Any surface whose fixture omits the one division that exercises a
branch is untested by construction — the same gap `codebadge` was added for.

**The EzzyPark half is still open** and still held: its plate is invisible on its own light
tint, so it only matters if F5 removes the tints.

### F7 — the two-row scroller reverses a decision the code records
`HomePage.module.css:289` sets `repeat(4, …)` below 640px with the comment *"Four across on a
phone, so every division is still visible without scrolling the grid"* — thirteen divisions in
four rows, nothing hidden. The scroller trades that for a shorter page, at the cost of putting
roughly half the divisions behind a gesture. **Not a blocker — but worth confirming the trade
is wanted**, since the current arrangement was a deliberate choice.

## Decisions

- **Division icons / branding — ⏸ HELD (2026-10-18, user).** *"Let's hold off on changes on the
  icons, but keep them in the plan."* Covers the whole Branding group: the Drive ink-sizing fix
  (F4), circle removal (F5), wiring the EzzyRide asset (F1), and the two oddly-shaped assets
  (F6). **Not abandoned — carried into the implementation plan as parked items with their
  measurements intact**, so nothing has to be re-derived. F3 (the Drive logo that never landed)
  stays open as a question for the user, since a replacement source file could remove the need
  for F4 entirely.
- **F5 (circle-free marks) — ⏸ PARKED (2026-10-18, user).** Not aborted: the user's words were
  *"I do not think we will be doing that at all"*, which is a lean, not a decision, so the
  measurements stay on file rather than being struck. **Nothing is implemented** — all twelve
  line-art divisions still draw `--division-tile` exactly as before; the only slug that blanks
  its plate is `ezzy-ride`, and only because its circle is baked into the PNG.
  **Unblocks on:** a decision to accept one of the two costs — losing dark-mode legibility for
  four near-black marks (as an `<img>`), or flattening every multi-colour logo to one ink (mask
  with `currentColor`). Screen 1 of the preview shows both side by side.
- **F6 (EzzyPark half) — ⏸ PARKED, blocked by F5.** Park's opaque white plate is invisible
  against its own light tint and becomes visible only if the tints are removed. It cannot be
  worked on before F5 is decided, and is moot if F5 is ever aborted.
- **Offering-card photos (F2) and the responsive work (F7, bottom nav)** are unaffected by that
  hold and remain the live part of the proposal, pending approval of the visual direction.
- **F4, F1 and F3 approved for implementation (2026-10-18, user)** — the icon hold above is
  narrowed to F5 and F6 only.
- **F4 — ✅ SHIPPED (2026-10-18).** `--division-art` added to the one `[data-division]` map in
  `booker/app/globals.css` (drive 1.69, learn 1.14, default 1) and consumed by all five
  mark-drawing surfaces. Verified: `tsc` clean, 303 unit tests pass, visual suite **117 passed
  / 0 failed** after regenerating 12 baselines, and the pre-regeneration diff showed **only**
  EzzyDrive and EzzyLearn changing. Numbers are re-derivable with
  `node .plans/scripts/measure-division-marks.mjs`. **F1 was not done**, so EzzyRide still
  renders its "ER" monogram.
- **F3 — CLOSED, no action (2026-10-18).** The stray `EzzyDrive_site_Logo.png:Zone.Identifier`
  led to the real file in `/mnt/c/Users/joshu/Downloads/`, which is **byte-identical** to
  `ezzy-ride.png` (md5 `efbd70ed…`). The user confirms the download was misnamed and the
  car-and-pin mark **is** EzzyRide. **There is no replacement Drive logo**, so the earlier
  caveat — that a better source file might remove the need for F4 — is retired. Drive keeps
  the steering wheel at fill 0.574 and F4 is required.

- **F1 — ✅ SHIPPED (2026-10-18), together with the EzzyRide half of F6**, which it could not
  ship without. `ezzy-ride` added to `BUNDLED` in `lib/divisionIcon.ts`; the disc problem fixed
  with three new tokens on one map line (`--division-plate`, `--division-art-box`,
  `--division-mark-art`). Verified: `tsc` clean, 304 unit tests, visual suite **117 passed /
  0 failed** after regenerating 18 baselines, and all three broken surfaces read correctly by
  eye. **The EzzyPark half of F6 is still held** and was deliberately not touched.

~~⚠️ **F1 CANNOT SHIP ALONE — it makes F6's EzzyRide problem live.**~~ **(resolved — both
shipped together, 2026-10-18.)** Kept for the reasoning: Today `ezzy-ride` resolves to
the "ER" monogram, so its baked-in blue disc is never drawn. Wiring it into `BUNDLED` renders a
solid blue disc inside the pale `--division-tile` disc on every surface — the disc-on-disc that
preview screen 3 flags as reading like a mistake. F6 is HELD, so **the Ride half of F6 must be
decided with F1** (either an `--division-art` value that lets the mark fill the disc, or a
`--division-tile: transparent` override for that one slug). Written on both items deliberately.

⚠️ **Both F1 and F4 break committed visual baselines.**
`booker/visual-tests/pilot.spec.ts-snapshots/` holds 107 PNGs including `divisions-light/dark`
and `home-light/dark`, all of which render division marks. They must be regenerated and
committed in the same change. ⚠️ A dev server on :3000 blocks the Playwright run, and the run
must not be piped through `tail` — that hides both the failure count and the exit code.

⚠️ **No implementation plan exists yet, deliberately.** The task prompt
(`prototypes/prompts/2026-10-18-booker-ui-preview.md`) ends this pass at previews and requires
approval of the visual direction before a dated plan is written under `.plans/`.

## Regenerating

```bash
node .plans/previews/_shared/shoot.mjs booker-ui            # nine checks, no screenshots
node .plans/previews/_shared/shoot.mjs booker-ui --shoot    # + contact sheets
node .plans/previews/_shared/shoot.mjs booker-ui --shoot --full cards,marks   # + full size
```

The run asserts: no page error, no console error, **zero non-`file://` requests**, no horizontal
overflow, no interactive control under 44×44, no fixed chrome cropped out of the viewport,
`node --check` on the JS, no drift in a synced file, and that a known token actually resolved —
over 7 screens × 2 viewports × 2 themes = **28 cells**. Last run: **0 failures**.

`masks.css` is **generated** — the thirteen marks as `data:` URIs, needed because Chromium
treats one `file://` URL as cross-origin to another and a CSS `mask-image` is a CORS-checked
fetch, while a plain `<img>` of the same file is not. Rebuild it with
`node .plans/scripts/build-division-mask-css.mjs`; it changes only when a logo does.

**What still needs a real build:** Poppins metrics, focus order through a live page, live-region
announcement timing, and device safe-area insets.
