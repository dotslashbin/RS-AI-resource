# Ezzy Vendor Mobile — brand assets: app icon + splash screen

**Date:** 2026-07-30
**App / scope:** `./ezzy-vendor-mobile` only. Asset generation + `app.json` config +
documentation. **No app code, no backbone, no schema, no other app.**
**Status:** COMPLETE (2026-07-30) — all five stages executed; **I1–I8 ✅ DONE**, one
item parked (**I9**). All decisions resolved (D1–D5); no OPEN items.

**What "complete" means here, precisely.** Every asset is generated, wired, and
verified as far as this environment allows — including through a real `expo prebuild`,
confirming the artwork reaching an Android build is ours and no Expo template artifact
survives. It does **not** mean seen on hardware:

- **Android:** never run on a device this session. Home-screen rendering at real
  density, the themed (monochrome) icon, and the cold-start splash transition all
  still need a look. Requires a **fresh EAS build** — icons and splash are baked in at
  build time and never appear on a Metro reload.
- **iOS:** nothing has been seen at all, and cannot be. No Apple Developer membership
  exists (companion **B9**), so the iOS icon is *asserted* correct — 1024², PNG colour
  type 2, no alpha — but has never been rendered. The first iOS build will also be the
  first look at it.

**Parked:** **I9** — `expo-doctor` 19/20 from pre-existing package patch drift,
unrelated to this work, needing its own maintenance pass.

**Still open elsewhere, deliberately not closed by this plan:** companion **B5**'s
store *listing* assets (screenshots, descriptions), **B6** privacy policy, **B7** Play
account type.

> One-line framing: turn the supplied `Ezzy-logo.svg` into a complete, store-compliant
> icon and splash set for **both Android and iOS**, replacing every Expo template
> artifact — optimizing for correctness against each platform's hard rules (alpha,
> safe zones) and for reproducibility, not for speed.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** G# = gap-check finding, C# = correction, I# = work item,
> D# = decision. Numbers are plan-local — qualify cross-plan refs by app.

**Supersedes / closes:**
- `.plans/2026-07-29-vendor-mobile-styling-branding.md` **B1** (artwork not received)
  and **I4** (icons/splash). Both move here; that plan's copies get marked superseded
  in Stage 5.
- The **icon/splash half** of `.plans/2026-07-27-ezzy-vendor-mobile-companion.md`
  **B5**. B5's remaining half — store screenshots, short + full descriptions — stays
  there and is **out of scope**.

**Explicitly out of scope:** the full **EZZY wordmark** anywhere in the app UI (the
user's "maybe later, I'll add the full logo for other parts of the app");
`ezzy-booker-mobile` icons; the three web apps; store screenshots; privacy policy
(companion **B6**); Play account type (companion **B7**).

---

## 0. Gap check — done before writing this plan (requested)

Everything below was **verified by running it**, not assumed. This section exists
because the gap check changed the plan materially twice.

### G1 — The source SVG is genuine vector ✔
`/mnt/c/Users/joshu/Downloads/Ezzy-logo.svg`, 3,949 bytes. Parsed: exactly two
elements, `svg` + `path` ×2, **no `<image>`, no base64**. `viewBox="0 0 1024 1024"`
(already square). Fills `#034bfc` and `#ffffff`.

This is the **third** file supplied and the first usable one. The prior two were
rejected on evidence, recorded here so the reasoning survives:
- `site logo.png` — 64×64. 16× too small.
- `EZZY_Logo_Transparent_Exact.svg` — an SVG *wrapper* around a 200×62 base64 PNG;
  zero paths. Not vector despite the name and the word "Exact".

### G2 — The SVG carries a stray artifact that must be stripped ⚠
`path[1]`: `fill="#ffffff"`, a 5×56 sliver pinned to the left canvas edge
(`M0.16 325.44 … 380.61Z`). It is a trace remnant, not part of the design.

**Measured impact, not guessed:** rendered as-is, the visible bounding box starts at
**x=0**; with the path removed it starts at **x=72** (at 2048²). Left in, it both
skews every centring calculation and paints a white nick on the icon's left edge.
**Stripping it is a prerequisite, not a nicety** — I1.

### G3 — A rasterizer exists after all; **no dependency install is needed** ✔
Initially reported to the user as an approval gate. **That was wrong — see C3.**
Verified working, end to end, writing directly into the workspace:

```
"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless --disable-gpu --force-device-scale-factor=2 \
  --window-size=1024,1024 --default-background-color=00000000 \
  --screenshot='\\wsl.localhost\Ubuntu\<abs-path>\out.png' \
  '\\wsl.localhost\Ubuntu\<abs-path>\in.svg'
```

Produced a 2048×2048 RGBA PNG, **59.8 % transparent**, all four corners
`rgba(0,0,0,0)`. Chrome *and* Edge are both present on the Windows side. The
`\\wsl.localhost\Ubuntu\…` UNC form is what lets a Windows binary write back into
the WSL workspace — so nothing is written outside the repo.

### G4 — `jimp-compact` is already available and does everything else ✔
Present transitively via `@expo/image-utils@0.11.4` → `jimp-compact@0.16.1`.
Verified by running: reads PNG, `resize`, `composite`, new 1024² canvas with alpha,
opaque fill, `writeAsync`. Decoders are jpeg/png/bmp/tiff/gif — **no SVG**, which is
exactly why G3 is needed for the first hop and nothing more.

### G5 — Framing maths, from the real render ✔
Artifact-free bounding box at 2048²: **1904 × 1571**, aspect **1.2120 : 1**.
Inscribed in Android's 626 px safe circle → **483 × 398**. That figure is computed,
not eyeballed, and drives I4.

### G6 — Expo config schema verified against the installed packages ✔
Read from `node_modules`, not recalled:
- `ios.icon?: string | IOSIcons` where `IOSIcons = { light?, dark?, tinted? }`; a
  `.icon` directory is also accepted. Doc string: *"Use a 1024x1024 icon…"*.
- `android.adaptiveIcon` = `{ foregroundImage?, monochromeImage?, backgroundImage?,
  backgroundColor? }`. `backgroundImage` **must match `foregroundImage`'s
  dimensions** and overrides `backgroundColor`.
- `expo-splash-screen` `Props` = `{ backgroundColor?, image?, imageWidth?,
  resizeMode?, dark?: {image?, backgroundColor?}, android?: …, ios?: … }` — so a
  dark variant *is* supported, per-platform blocks too.

---

## Corrections

**C1 — brand blue is `#034BFC`, not `#004BFC`.** I told the user the opposite last
session. The vector is authoritative and says `#034bfc`; `#004BFC` came from the
compressed 200×62 raster. Every value in this plan uses `#034BFC`.

**C2 — Android safe zone is ~626 px on a 1024 canvas, not ~708 px.** The styling
plan's I4 table carried 708; corrected there on 2026-07-30. Derivation: the layer is
108 dp, the masked viewport 72 dp (~683 px), the guaranteed-visible circle 66 dp →
66/108 × 1024 = **625.8 px**.

**C3 — "a rasterizer install is required" was a false alarm.** Told to the user as an
approval gate. G3/G4 disprove it: headless Chrome (already installed, Windows side) +
`jimp-compact` (already in `node_modules`) covers the whole pipeline. **No approval
gate applies to this plan.**

**C4 — the splash does not need a `dark` variant.** The styling plan's I4 called for
one. It is unnecessary *now* because D3-A (that plan) forces every pre-app route to
the dark auth surface, and D2 below puts the splash on the same navy — so both
system appearances want the identical splash. Adding a `dark` block would be two
files describing one design.

---

## IMPORTANT — the work

### I1 — Vendor the source SVG and strip the stray artifact  ✅ DONE (2026-07-30)
**Files:** `assets/brand/ezzy-mark-source.svg` (already copied in during the gap
check — the one thing currently on disk), new `assets/brand/ezzy-mark.svg`

Copy is the untouched supplier file and stays that way as provenance. Generate
`ezzy-mark.svg` from it by removing `path[1]` (G2). Keep **both** — the diff between
them is the record of what was removed and why.

**Fix approach:** strip inside the generator script (I2) so it is reproducible rather
than a hand-edit nobody can re-derive. Assert afterwards that exactly one `<path>`
remains and that no `base64` substring exists.

**✅ DONE (2026-07-30)** — `assets/brand/ezzy-mark.svg` generated from the untouched
supplier file by `node scripts/generate-brand-assets.js --svg-only`. Both files are
kept, so the diff *is* the record of what was removed.

The artifact is matched by **fill colour, not by path index** — the design is a single
blue mark, so "every white path" identifies it without hardcoding `path[1]`, and the
assertions fail loudly if that ever stops being true.

**Verified (machine):** cleaned SVG has exactly **1 `<path>`** (from 2), **no
`base64`**, fills `["#034bfc"]` only, `viewBox` still `0 0 1024 1024`, 3,618 bytes
(from 3,949). A `diff` of source vs cleaned shows **only** the artifact path removed —
no other bytes touched.

### I2 — A checked-in generator script  ✅ DONE (2026-07-30)
**File:** new `scripts/generate-brand-assets.js` (alongside the existing
`scripts/reset-project.js`, which is the precedent for this folder)

> **Deviation from the plan, 2026-07-30:** written as `.js` (CommonJS), **not** the
> `.mjs` this plan originally specified. `package.json` has no `"type": "module"` and
> `scripts/reset-project.js` is CJS, so `.mjs` would have been the only ESM file in
> the app *and* would have needed `createRequire` gymnastics to load the CJS
> `jimp-compact`. Matching the existing convention won (AGENTS.md, Surgical Changes).

**Why a script and not one-off commands:** the assets will be regenerated — for the
wordmark work the user has already flagged as "later", for `ezzy-booker-mobile`, and
any time the framing changes. Six PNGs with exact geometry produced by unrepeatable
ad-hoc commands is the kind of thing that rots. ~80 lines, no framework, no CLI
parsing.

**Structure — portable core, environment-specific edge:**
- **Hop 1 (environment-specific):** SVG → 2048² master PNG via headless Chrome/Edge.
  Auto-detect both Windows paths from G3; if neither is found, **fail with a message
  telling the operator to supply `assets/brand/_master.png` by hand** rather than
  dying obscurely. This is the only non-portable step and it is isolated.
- **Hop 2 (portable):** master PNG → all six outputs via `jimp-compact`.

**Dependency honesty:** `jimp-compact` is a *transitive* dependency of
`@expo/image-utils`, not declared in `package.json`. That is deliberate — declaring
it would trip the AGENTS.md dependency approval gate for a dev-only tool run twice a
year. The risk is that a future Expo bump drops it. Mitigation: `require` it behind a
try/catch that prints *"install jimp-compact as a devDependency"* rather than a bare
module-not-found. **Do not** add it to `package.json` in this plan.

**✅ DONE (2026-07-30)** — ~270 lines including the assertion suite. Structure is as
designed: `cleanSvg()` → `rasterize()` (browser auto-detect across three Chrome/Edge
paths, falling back to an existing `_master.png`, then to a clear instruction) →
`derive()` → `assertOutputs()`. `--svg-only` stops after the first step, which is what
Stage 1 ran.

**One capability verified before writing, not assumed:** `jimp-compact` exposes
`.colorType(2)`, confirmed by writing a test PNG and reading byte 25 of its IHDR — so
the iOS icon can be emitted **genuinely alpha-free**, rather than merely fully opaque.
Without that the whole D1-A approach would have needed rethinking, since App Store
Connect rejects an alpha channel even when every pixel is opaque.

The store assertions (§Verification) are built into the script rather than run
separately, so a future regeneration cannot silently break them.

**Verified (machine):** `tsc --noEmit` exit 0 · `expo lint` clean · `npm test` 40/40 —
i.e. the new file introduces no regression. The script's own full path is **not** yet
exercised; only `--svg-only` has run. Rasterization and derivation get their first real
run in Stage 2.

### I3 — iOS app icon  ✅ DONE (2026-07-30)
**Output:** `assets/brand/icon-ios.png` — **1024×1024, NO alpha channel**

D1-A: mark knocked out in **`#FFFFFF`** on a solid **`#034BFC`** tile.

| Property | Value | Why |
|---|---|---|
| Canvas | 1024×1024 | G6 — Apple's required size |
| Alpha | **none** (RGB, PNG colour type 2) | App Store Connect rejects any alpha channel. **Machine-assertable** — see Verification |
| Corners | square, un-rounded | iOS applies its own mask; pre-rounding double-rounds |
| Mark width | **635 px** (62 % of canvas) → 635×524 at 1.2120:1 | Leaves clearance from the ~22 % corner radius |
| Position | centred | — |

**✅ DONE (2026-07-30)** — 28 KB. **Verified (machine):** 1024×1024; PNG IHDR colour
type **2**, i.e. genuinely no alpha channel, not merely opaque — the App Store's hard
rule. **Verified (visual):** white mark on the `#034BFC` tile, well clear of the
corner radius.

### I4 — Android adaptive icon layers  ✅ DONE (2026-07-30)
**Outputs:** `assets/brand/icon-android-foreground.png`,
`assets/brand/icon-android-monochrome.png` — both **1024×1024, transparent**

| Layer | Content | Framing |
|---|---|---|
| foreground | white mark, transparent elsewhere | **483×398 centred** (G5 — inside the 626 px safe circle) |
| monochrome | same silhouette, solid fill; Android tints via the alpha channel | identical framing, so themed and normal icons register exactly |
| background | **none — use `backgroundColor: "#034BFC"`** | A `backgroundImage` must match the foreground's dimensions (G6) and buys nothing over a flat colour. Fewer files, one less thing to desync |

The foreground mark is deliberately **smaller relative to canvas than iOS's** (483 vs
635) — that is the safe zone doing its job, not an inconsistency.

**✅ DONE (2026-07-30)** — 18 KB each. **Verified (machine):** both 1024×1024 with an
alpha channel (colour type 6); mark bbox **483×399**, centred to within 1 px
(L271/R270, T313/B312 — sub-pixel rounding); **furthest visible pixel 297.1 px from
centre against the 313 px safe radius**, a ~5 % margin, asserted by the script rather
than eyeballed.

**Verified (visual, by simulation):** the raw foreground looks blank in any viewer —
it is a *white* mark on transparency, so it composites white-on-white. That is
expected, not a defect. Confirmed instead by compositing it over the `#034BFC`
background and clipping to Android's 72 dp circular mask: the mark sits comfortably
inside with clear margin.

**Note — the two layers are byte-identical (both 18,579 bytes), and that is correct.**
Android tints the monochrome layer using its alpha channel, so the same silhouette at
the same framing is what keeps themed and normal icons in register. They stay separate
files because they answer different config keys and may diverge later (a themed icon
sometimes wants a simplified silhouette).

### I5 — Splash screen  ✅ DONE (2026-07-30)
**Output:** `assets/brand/splash-mark.png` — 1024 px wide, transparent, mark in
**`#034BFC`**

D2-A: background **`#04060E`**, matching the top stop of the auth-screen gradient so
splash → sign-in has no colour jump. Today it is `#208AEF` (Expo template blue)
against a navy auth screen — a visible flash on every cold start.

`imageWidth: 180` (dp), up from the template's `76`. Source supplied at 1024 px wide
so every generated density bucket downsamples rather than upsamples. **No `dark`
block** — C4.

**✅ DONE — asset 2026-07-30 (below); config landed via I6; closed at Stage 4, where
prebuild confirmed `splashscreen_background` = `#04060E` and a generated
`splashscreen_logo.png` carrying our mark.**
`splash-mark.png` is **1024×845** — tight-cropped to the mark, deliberately *not* a
padded square, so `imageWidth: 180` will mean the mark's own width rather than the
width of a canvas that is mostly nothing.

**Verified (machine):** 1024×845, alpha present, first fully-opaque pixel sampled as
**`#034BFC`** — confirming the recolour applied and the brand blue survived.
**Verified (visual, by simulation):** rendered at 540 px (≈180 dp @3×) on the
`#04060E` background; contrast reads cleanly.

### I6 — Rewire `app.json` and delete the template artwork  ✅ DONE (2026-07-30)
**File:** `app.json:7, 11, 36-41, 50-56`

| Key | From | To |
|---|---|---|
| `icon` | `./assets/images/icon.png` (Expo chevron) | `./assets/brand/icon-ios.png` |
| `ios.icon` | `./assets/expo.icon` (template Icon Composer bundle) | `./assets/brand/icon-ios.png` |
| `android.adaptiveIcon.foregroundImage` | template | `./assets/brand/icon-android-foreground.png` |
| `android.adaptiveIcon.monochromeImage` | template | `./assets/brand/icon-android-monochrome.png` |
| `android.adaptiveIcon.backgroundImage` | template | **removed** (I4) |
| `android.adaptiveIcon.backgroundColor` | `#E6F4FE` | `#034BFC` |
| splash `image` | `./assets/images/splash-icon.png` (Expo logo) | `./assets/brand/splash-mark.png` |
| splash `backgroundColor` | `#208AEF` | `#04060E` |
| splash `imageWidth` | `76` | `180` |

**Then delete**, once nothing references them: `assets/expo.icon/` (whole directory,
incl. `expo-symbol 2.svg`), `assets/images/icon.png`, `splash-icon.png`,
`android-icon-{foreground,background,monochrome}.png`.

**Deliberately keeping `ios.icon` as a plain PNG string** rather than the
`{light, dark, tinted}` object or a `.icon` bundle: the object form is an iOS-18+
appearance nicety and the `.icon` bundle needs Xcode 26's Icon Composer, which this
environment does not have and cannot verify. A single 1024² PNG is fully supported
(G6) and is the only form verifiable here.

**✅ DONE (2026-07-30)** — all nine config changes applied exactly as tabled; six
template paths removed (`assets/expo.icon/` entire directory, plus five PNGs) via
`gio trash`, honouring AGENTS.md's recoverable-over-permanent preference. All were
git-tracked, so `git checkout` is a second recovery path.

**Verified (machine):** every one of the five configured asset paths resolves on disk
(scripted `fs.existsSync` over the parsed `app.json`, not eyeballed);
`adaptiveIcon.backgroundImage` is genuinely absent, not blanked;
`backgroundColor` `#034BFC`; splash `#04060E` / `imageWidth` 180;
`expo export --platform android` succeeds, proving the config resolves through a real
build. `expo-doctor` 19/20 — see **I9** for the one failure and why it is not this
plan's.

**Found while checking references:** `IOS-BUILD.md:87` also documents the old
`assets/expo.icon` template icon. Added to I8's doc list — it would otherwise have
been left describing artwork that no longer exists.

### I9 — `expo-doctor` fails on 11 patch-version mismatches  ⏸ PARKED (2026-07-30)
**Discovered:** Stage 3, while running this plan's own verification.

`npx expo-doctor` reports **19/20 passed, 1 failed**. The failure is *"Check that
packages match versions required by installed Expo SDK"* — 11 **patch**-level
mismatches: `expo` 57.0.8 vs 57.0.9, `react-native` 0.86.0 vs 0.86.2,
`react-native-reanimated` 4.5.0 vs 4.5.1, `expo-router` 57.0.8 vs 57.0.9, and seven
more.

**Not attributable to this plan.** Stage 3 changed `app.json` and deleted PNGs;
`package.json` is untouched (`git status` confirms). No icon, splash or config check
failed — this is upstream SDK patch drift accumulated since the companion plan
recorded "expo-doctor 20/20".

**Consequence for this plan's Verification section:** the stated criterion
*"`npx expo-doctor` stays green"* is **not met**, and cannot honestly be marked met.
What it actually verified is narrower and still useful: **19/20, with every
asset-related check passing.** Recorded rather than quietly restated.

**Why parked, not fixed:** bumping 11 packages is a dependency change — an AGENTS.md
approval gate — and a React Native patch bump is a rebuild-and-retest event, not
cosmetics. Wildly out of scope for a brand-assets plan.

**Unblock condition:** a deliberate maintenance pass. `npx expo install --check`
lists and applies the set. Worth doing before the next release build, not during
this plan.
<!-- parked: dependency approval gate + out of scope; needs its own maintenance pass -->

### I7 — Verification pass  ✅ DONE (2026-07-30)
See the Verification section. Called out as its own item because it is the stage most
likely to be skipped once the icons "look right".

**✅ DONE (2026-07-30) — Android and machine only.**

`npx expo prebuild --clean --platform android` generated the native project; the
artwork *reaching the binary* was then inspected directly, which is the check that
distinguishes "`app.json` looks right" from "the build contains our icon":

| Generated resource | Result |
|---|---|
| `values/colors.xml` | `splashscreen_background` **#04060E**, `iconBackground` **#034BFC** — both ours |
| `mipmap-anydpi-v26/ic_launcher.xml` | `<background @color/iconBackground>` + `<foreground>` + `<monochrome>` — confirms D4's colour-not-image choice landed |
| `mipmap-xxxhdpi/ic_launcher.webp` | **Visually confirmed**: white ZZ mark on the brand-blue tile |
| `ic_launcher_foreground.webp` / `ic_launcher_monochrome.webp` | **Identical md5 and byte size** — matching the two byte-identical sources, so both layers derive from ours |
| `drawable-xxxhdpi/splashscreen_logo.png` | **Visually confirmed**: blue ZZ mark |
| Template sweep | No `expo-symbol`, `react-logo` or `expo-badge` anywhere in the generated tree |

The generated `android/` was deleted afterwards — this project stays managed (CNG).

**Two things worth recording.**

*Prebuild has a side effect.* It rewrote `package.json`'s `android`/`ios` scripts from
`expo start --android` to `expo run:android` — correct for a bare project, wrong for
this one. **Reverted** (`git checkout package.json`, confirmed clean). Anyone running
prebuild here must revert it too, or `npm run android` silently changes meaning.

*A verification attempt that failed and was discarded.* I wrote a WebP header parser
to assert the generated mipmap dimensions; it returned nonsense (`fourcc "IHDR"`,
`0x4608`). Rather than report bad numbers, the dimension claim was **dropped** and
replaced with the md5-identity and visual checks above. No dimension assertion is
made for the generated mipmaps.

**Generator idempotency confirmed:** re-ran `generate-brand-assets.js` end to end
after the prebuild cycle — same output, all assertions passed.

**Final machine state:** `tsc` exit 0 · `expo lint` clean · `npm test` 40/40 ·
`expo export --platform android` succeeded (Stage 3) · `expo-doctor` 19/20 (**I9**).

### I8 — Documentation  ✅ DONE (2026-07-30) — **requested explicitly**
**Files, each with the specific edit:**

| Doc | Edit |
|---|---|
| `architecture/portals.md:374` | "Not submitted… **Blocked on brand assets**, a public privacy policy, and a Play Console account-type decision" → brand assets no longer block; privacy policy + account type still do |
| `architecture/conventions.md` (Mobile Expo Conventions, ~line 327+) | New short subsection: brand source lives in `assets/brand/`, assets are **generated not hand-drawn**, regenerate with `scripts/generate-brand-assets.mjs`, and the iOS-no-alpha / Android-safe-zone constraints that make them non-obvious |
| `ezzy-vendor-mobile/STORE-SUBMISSION.md:23` | "Icons / splash \| Expo template placeholders \| **BLOCKED — B5**" → done, with the date |
| `ezzy-vendor-mobile/STORE-SUBMISSION.md:17` | **Drift found during the gap check:** the row reads "Display name \| Bookdeck Vendor \| provisional — B5", but `app.json` says **"Ezzy Vendor"** and the companion plan resolved that name on 2026-07-28. Fix the stale row |
| `ezzy-vendor-mobile/STORE-SUBMISSION.md` §6 B5 | Close the icon/splash half; leave screenshots + descriptions open |
| `ezzy-vendor-mobile/AGENTS.md` (Ph8 row) | Drop **B5** from the blocking list for brand assets |
| `.plans/2026-07-27-…companion.md` **B5** | Mark the icon/splash half done, pointing here |
| `.plans/2026-07-29-…styling.md` **B1 / I4** | Mark superseded by this plan |
| `ezzy-vendor-mobile/IOS-BUILD.md:87` | **Found in Stage 3:** still describes `assets/expo.icon` as "Expo's template icon… fine for development". That path no longer exists — rewrite for the real icon |

**✅ DONE (2026-07-30)** — all nine edited. Two were substantive rather than
status-flipping:

- **`architecture/conventions.md`** gained a *Brand assets are generated, not
  hand-drawn* subsection under Mobile (Expo) Conventions. It documents the regeneration
  command, the file roles, and the **three constraints that make these assets
  non-obvious**: the iOS no-alpha rule, the 66dp/626px Android safe circle, and the
  fact that the Android foreground *looks blank* in a viewer because it is white on
  transparency. That last one would otherwise be re-diagnosed as a bug by the next
  person to open the file.
- **`ezzy-vendor-mobile/IOS-BUILD.md`** was rewritten rather than flipped: the old text
  said B5 "blocks public App Store release, not builds". Now it states the icon is
  asserted-but-never-seen, and why `ios.icon` is deliberately a plain PNG (D5).

**Scope correction applied across all docs.** B5 was consistently described as "brand
assets" blocking submission. That is now imprecise: the *binary* assets are done, the
*listing* assets (screenshots, descriptions) are not. Every touched doc now
distinguishes the two, because "brand assets done" would otherwise read as "ready to
submit", which is false — **B6** (privacy policy) and **B7** (Play account type) still
block, as do the screenshots.

**Drift fixed while here:** `STORE-SUBMISSION.md` still listed the display name as
"Bookdeck Vendor — provisional", two days after the companion plan resolved it to
"Ezzy Vendor" and `app.json` was changed. Corrected.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains. None remain as of 2026-07-30. -->

- **D1 — icon treatment?** → **white mark on brand blue `#034BFC`** (resolved
  2026-07-30, user). Matches the house pattern already set by
  `vendor/public/icons/icon-512.png` (white "V" on blue) and stays legible at 48 dp
  on any wallpaper. Requires recolouring the mark to white — a standard knockout,
  trivial on vector, and it is what makes the opaque-iOS requirement a non-issue.
- **D2 — splash background?** → **navy `#04060E`, mark in brand blue** (resolved
  2026-07-30, user). Identical to the auth gradient's top stop, removing the
  template-blue flash on cold start.
- **D3 — rasterization approach?** → **headless Chrome + `jimp-compact`, no installs**
  (resolved 2026-07-30 by the G3/G4 gap check, superseding the approval gate I had
  flagged). See C3.
- **D4 — Android background layer: image or colour?** → **flat `backgroundColor`**
  (resolved 2026-07-30). A background *image* must match the foreground's dimensions
  and adds a file that can silently desync; the design is a flat tile.
- **D5 — `ios.icon` as PNG, object, or `.icon` bundle?** → **plain 1024² PNG**
  (resolved 2026-07-30). The alternatives need iOS-18+ appearance assets or Xcode 26
  Icon Composer; neither is verifiable in this environment, and the PNG form is fully
  supported (G6). Revisit if iOS builds ever become possible (companion **B9**).

---

## DEFERRED / COSMETIC

- **`expo-notifications` plugin `color: "#2563eb"`** (`app.json:63`) is the app's UI
  blue, not brand blue `#034BFC`. Arguably now inconsistent. Left alone: it tints the
  Android notification accent, which is adjacent to push behaviour rather than brand
  assets, and push is still unproven (companion **Ph7**). Flagged, not changed.
- **No custom Android notification icon** is configured, so Android silhouettes the
  app icon. The I4 monochrome layer would suit it. Out of scope for the same reason.
- **`assets/images/favicon.png`** is web-only and `app.json` declares
  `platforms: ["ios","android"]`. Dead, but unrelated to this plan's changes —
  belongs with the other dead template assets already listed in the styling plan.
- **Play Store listing icon (512×512) and feature graphic (1024×500)** are *listing*
  assets, not binary assets. Trivially derivable from the same master once the
  listing is being filled in — companion **B5**'s remaining half.

---

## Execution order

Five stages. **A report follows every stage** — summary by file, checklist with the
verification actually run, and the plan's updated status (per
`.claude/skills/developerboss/SKILL.md`). Default cadence is **one stage, then stop**.

1. **Stage 1 — Source prep + generator.** I1, I2. ✅ **DONE 2026-07-30.** Produced
   `assets/brand/ezzy-mark.svg` and `scripts/generate-brand-assets.js`; two untracked
   paths, `app.json` untouched, `tsc`/lint/tests clean. One deviation (`.js` not
   `.mjs`) recorded at I2.
2. **Stage 2 — Generate and inspect the asset set.** I3, I4, I5. ✅ **DONE
   2026-07-30.** Four output PNGs plus the `_master.png` intermediate into
   `assets/brand/`; all script assertions passed; `app.json` still untouched.
   Master content re-measured at **1904×1571, 1.2120:1** — identical to the gap
   check, so the pipeline is reproducible.
3. **Stage 3 — Wire `app.json`, delete template artwork.** I6. ✅ **DONE 2026-07-30.**
   Nine config changes; six template paths trashed. `expo export` succeeds,
   `expo-doctor` 19/20 with the one failure pre-existing and unrelated (**I9**).
   Surfaced one extra doc for Stage 5 (`IOS-BUILD.md:87`).
4. **Stage 4 — Verify.** I7. ✅ **DONE 2026-07-30.** Prebuild inspection confirmed the
   generated colours, adaptive-icon XML, launcher artwork and splash logo are all
   ours, with no template remnants. `android/` deleted; prebuild's `package.json`
   side effect reverted. Closed I5.
5. **Stage 5 — Documentation.** I8. ✅ **DONE 2026-07-30.** All nine docs updated,
   including both predecessor plans (companion **B5** narrowed to listing assets;
   styling **B1** resolved and **I4** marked ✖ superseded with its spec left intact
   as the record).

Stages 1→3 are strictly sequential (each consumes the previous output). 4 depends on
3. 5 depends on 4 having passed — documenting "done" before verification is the exact
failure the status model exists to prevent.

---

## Verification

### Machine-verifiable — assert, don't eyeball
Run as part of Stage 4, with the generator emitting the first four as assertions so a
future regeneration cannot quietly break them:

| Check | Why it matters |
|---|---|
| `icon-ios.png` is **1024×1024** and **PNG colour type 2** (no alpha) | Hard App Store rejection criterion. Fully machine-checkable, so there is no excuse for finding out at submission |
| Android foreground + monochrome are **1024×1024** with an alpha channel | Adaptive icons require transparency |
| Every visible pixel of the Android foreground lies within the **626 px centred circle** | The safe zone — measurable per-pixel, and the single most common adaptive-icon defect |
| `ezzy-mark.svg` has exactly **one `<path>`** and no `base64` | Proves G2's artifact is gone and no raster crept back in |
| `npx expo-doctor` stays green | Catches malformed `app.json` and missing asset paths |
| `npx expo export --platform android` succeeds | Proves the config resolves |
| `npx expo prebuild --clean --platform android`, then grep generated `res/mipmap-*/` | Confirms the artwork *actually reaching the binary* is ours, not that `app.json` merely looks right. Delete `android/` afterwards |

### Needs a live environment — cannot be claimed from here
- Home-screen icon at real density, on a real launcher, against a light and a dark
  wallpaper.
- **Themed (monochrome) icon** with "Themed icons" enabled, Android 13+.
- Splash on **cold start**, confirming the navy→auth transition has no flash (the
  whole point of D2).
- **iOS: nothing.** No Apple Developer membership, so no iOS build exists — companion
  **B9**. Every ✅ this plan produces is **Android-only or machine-only**, and must
  say so. The iOS icon will be *asserted correct* (size, no alpha) but **never seen
  rendered** until B9 clears. That is a real limitation, not a formality.

### Rebuild required — expectation to set
Icons and splash are **baked into the binary at build time**. They will not appear on
a Metro reload, and a preview build will not show them until it is rebuilt. Any
device verification above needs a fresh EAS build first
(`ezzy-vendor-mobile/EAS-SETUP.md` §5).
