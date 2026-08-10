# Vendor — Ezzy logo rollout (app icons, login, dashboard shell)

**Date:** 2026-08-10
**App / scope:** `vendor/` only
**Status:** ✅ **COMPLETE (2026-08-10).** All six items shipped and verified.
No schema change, no declared dependency added, no approval gate hit.

> Put the real Ezzy mark and wordmark into the vendor portal: replace the app
> icons, and replace the two `lucide-react` placeholder glyphs with brand assets on
> the login page and in the signed-in shell. Optimise for **consistency with what
> already ships on mobile** over inventing a web-only treatment.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important. Numbers are plan-local.

---

## Scope

**In scope:** `vendor/` — app icon set, the four `Building2` placeholders in
`LoginPage.tsx`, the sidebar header, `manifest.ts`'s `theme_color`, and checking the
three supplied SVGs into the repo.

**Out of scope, deliberately:**
- `command` and `booker` — same treatment will be wanted there, but this is a
  single-app change and cross-app work needs its own coordination.
- **Retinting the UI.** ~40 usages of `#2563eb` stay exactly as they are. Only the
  manifest's `theme_color` moves to the brand blue. An icon swap is not a licence
  to restyle the app.
- `ProfilePage.tsx:27` — the fifth `Building2`, but it is a *vendor's* avatar
  placeholder, not Ezzy branding. Leaving it is correct, not an oversight.
- The `Store` glyph elsewhere, favicon for other apps, email templates, mobile.

---

## What the investigation changed

Three findings that moved this plan away from the design-1 preview. Recorded
because the preview you approved is **not** what B1 now proposes.

### ⚠️ Correction — the icon treatment in design-1 was wrong

design-1 showed **blue mark on white**. That contradicts what already ships.

`logo.svg` is **byte-identical** to `ezzy-vendor-mobile/assets/brand/ezzy-mark-source.svg`
(verified: `diff` after whitespace strip). The mobile app has shipped since
2026-07-30 with the icon as a **white mark knocked out of solid `#034BFC`** —
`.plans/2026-07-30-vendor-mobile-brand-assets.md` D1, resolved by you at the time.
Its stated reason was to match *"the house pattern already set by
`vendor/public/icons/icon-512.png` (white V on blue)"*.

So blue-on-white would have made the web icon disagree with both the mobile icon
**and** the vendor icon it replaces. **B1 uses white-on-blue.** This is a reversal
of the preview, and the only part of design-1 that changes.

### The mark has a stray white path — use the cleaned source

`logo.svg` carries two paths: the blue mark and a stray `#ffffff` path (visible as
a speck on dark in the source render). The mobile pipeline already solved this —
`assets/brand/ezzy-mark.svg` is the cleaned **single-path** version. Copy that,
not the raw download.

### There is an existing generator to follow, not reinvent

`ezzy-vendor-mobile/scripts/generate-brand-assets.js` derives every icon from the
vector with documented geometry, and explains why ad-hoc commands were rejected:
*"Six PNGs produced by unrepeatable ad-hoc commands rot immediately."* B1 follows
that pattern rather than inventing one.

---

## BLOCKERS

### B1 — App icons still show the old placeholder set  ✅ DONE (2026-08-10)
<!-- ✅ brand/ezzy-mark.svg + brand/ezzy-lockup.svg checked in with blues normalised
     to #034bfc; scripts/generate-brand-assets.mjs written; all six outputs
     regenerated white-on-blue; manifest theme_color → #034bfc.
     Verified: dimensions correct (192/512/512/180, ICO 16+32+48); apple-icon has
     NO alpha channel at all (stronger than "opaque"); running the generator twice
     produced byte-identical output (md5 534c16d295bac7a0 both times).
     NOT verified: the launcher circle crop and the iOS home-screen composite —
     both need a real device. -->

> **Deviation from the plan.** The intermediate master PNG was dropped — every size
> rasterises straight from the vector via Playwright, so no output is a resample of
> a resample. `favicon.ico` is assembled by a ~30-line PNG-in-ICO container writer
> rather than an encoder dependency.
>
> 🐛 **A build failure I caused and fixed mid-stage, worth recording.** I first
> removed `sharp` entirely, and the Playwright PNGs came out **RGB with no alpha
> channel** — which I noted approvingly as "stronger than opaque". It is exactly
> what broke the build: Next's ICO decoder rejects RGB with
> `Format error decoding Ico: The PNG is not in RGBA format!`. `omitBackground: true`
> does **not** fix it (tried — Chromium still encodes RGB when every pixel is
> opaque). So `sharp` is back, used for **one** thing: `ensureAlpha()` on the three
> ICO payloads, behind a guarded dynamic import with the mobile script's precedent
> cited. The standalone PNGs stay RGB, which is still the strongest form of the iOS
> opaque requirement.
**Files:** `vendor/public/icons/{icon-192,icon-512,icon-maskable-512}.png`;
`vendor/app/apple-icon.png`; `vendor/app/favicon.ico`; `vendor/app/manifest.ts:13-17`

Six icon assets predate the brand and are unrelated to it.

**Fix approach — one generator, following the mobile precedent.**

1. **Check the vectors in** at **`vendor/brand/`** — deliberately *not* `public/`. Nothing here is fetched at
   runtime: the icons are pre-generated PNGs and B4 inlines the vectors into the
   bundle, so serving these would expose files nothing requests.

   - `ezzy-mark.svg` — cleaned single-path, copied from the mobile brand dir.
   - `ezzy-lockup.svg` — **one** lockup, not two. Taken from `logo-white.svg` with
     its ink path set to `currentColor`; B4 proved the recolour renders identically
     to the native white-ink file, so the second variant is redundant.

   ⚠️ **Normalise the blue while copying.** The three supplied files carry *three*
   different blues — `#034bfc` (mark), `#004bfc` (lockup on dark), `#004afb`
   (lockup on light). Almost certainly export noise. All become **`#034bfc`**, the
   value the mobile generator already treats as canonical
   (`generate-brand-assets.js`: `BRAND_BLUE = 0x034bfcff`). Leaving three blues
   would put two of them on screen side by side in the sidebar.
2. **`app/icon.svg`** — a served copy of the mark, for the scalable favicon. This
   is the one vector Next does fetch.
3. **`vendor/scripts/generate-brand-assets.mjs`** — each size rasterised straight
   from the vector by Playwright (already a devDependency). `sharp` is used for one
   step only: forcing an alpha channel on the ICO payloads, which Next's decoder
   requires. ⚠️ **`sharp` is a *transitive* dependency** (via Next), not declared —
   deliberate, following the mobile script's reasoning that declaring a tool run
   twice a year would trip AGENTS.md's dependency approval gate. The import is
   **guarded**, printing what to do if a future Next bump drops it.
4. **Outputs — white mark on `#034BFC`**, per the correction above:

   | Output | Size | Mark width | Why |
   |---|---|---|---|
   | `public/icons/icon-192.png` | 192 | 62% | matches iOS framing on mobile |
   | `public/icons/icon-512.png` | 512 | 62% | |
   | `public/icons/icon-maskable-512.png` | 512 | **47%** | must sit inside the 66/108 safe circle or launchers crop it |
   | `app/apple-icon.png` | 180 | 62% | **must be opaque** — iOS composites transparency onto black |
   | `app/icon.svg` | — | — | scalable favicon; Next serves it automatically |
   | `app/favicon.ico` | 16+32+48 | 62% | legacy fallback, kept. Payloads must be **RGBA** |

5. **`manifest.ts:14`** — `theme_color` `#205cfc` → `#034bfc`. `background_color`
   stays `#eef2ff`. Nothing else in the manifest changes.

**Why not reuse the mobile PNGs directly:** the sizes differ (mobile needs 1024 and
adaptive layers; web needs 192/512/180) and the maskable safe zone is a different
fraction. Sharing the *source and the maths* is the reuse that matters.

<!-- verification: file sizes/dimensions machine-checkable; the maskable crop and the
     iOS composite need a real device or an emulator -->

### B2 — Login page shows a generic `Building2` in four places  ✅ DONE (2026-08-10)
**File:** `vendor/components/auth/LoginPage/LoginPage.tsx:71,127,167,263`

Approved treatment: **A's wordmark header + B's bare form icon** (login-page-1).

| Line | Site | Now | Becomes |
|---|---|---|---|
| 71 | desktop brand row, `.logoBox` 38px | tile + "Ezzy Vendor" + "VENDOR PORTAL" | **wordmark** (30px tall) + hairline + gold "VENDOR PORTAL" |
| 127 | mobile brand row, `.logoBoxMobile` | same, smaller | same, wordmark ~24px |
| 167 | login form head, `.formIconBox` 52px | blue gradient tile + glyph | **bare mark**, ~46px, no tile |
| 263 | select-vendor form head, `.formIconBox` | same | same bare mark |

The login page is **always dark** (`.page` gradient `#04060e → #0d1b4b`) and does
not respond to the theme toggle, so the ink is simply fixed:
`<BrandLogo variant="lockup" className="h-[30px] text-white" />`. No `dark:`
variant here — that is B3's problem alone.

**Naming:** `logoBox` / `logoBoxMobile` in `LoginPage.module.css:66,76` become dead
once 71 and 127 stop using them — **delete them**, do not leave them orphaned.
`.formIconBox` stays; it is still used by the forgot/sent/reset views with their own
`Mail`/`Lock` glyphs, which are **not** in scope.

**Component separation:** `LoginPage.tsx` is already a pure render layer with
`useLoginPage.ts` as its controller. This adds markup only — no state, no effects,
no handlers. New sizing/spacing goes in `LoginPage.module.css`, **not** inline
`style={{}}`. See B4 for the shared component the images go through.

### B3 — The signed-in app carries no Ezzy branding at all  ✅ DONE (2026-08-10)
**File:** `vendor/components/layout/Sidebar/Sidebar.tsx:46-54`

Today the sidebar header is a `Store` glyph in a blue gradient tile beside the
*vendor's* name. Nothing identifies the product once you are signed in.

**Approved treatment: dashboard-1 option 1 — brand row above workspace row**
(resolved 2026-08-10).

```
┌──────────────────────────────┐
│  ezzy            VENDOR      │  ← product identity
├──────────────────────────────┤  ← hairline, border-sp-divider
│  [mark]  Citywide Sports     │  ← workspace identity
│          Your workspace      │
└──────────────────────────────┘
```

- Wordmark ~22px tall; small caps "VENDOR" in `text-sp-text`.
- Vendor row keeps a 26px tile with the **mark**, so the vendor's own name still
  has an anchor. Sub-label "Vendor Portal" → **"Your workspace"**, because the row
  above now says which product this is.
- Costs ~26px of sidebar height. The sidebar is `w-56` (224px) with `px-4`, leaving
  192px — the wordmark at 22px tall is ~54px wide, so there is ample room.

**Theming — the ink follows `currentColor`; the sidebar just sets a text colour.**
`--sp-sidebar-bg` is `#ffffff` in light and `#05080f` in dark
(`globals.css:101,136`), so the lockup's letters must change ink. With the
`BrandLogo` component in B4 that is a one-class job and needs no theme logic here:

```tsx
<BrandLogo variant="lockup" className="h-[22px] text-[#1e1e1e] dark:text-white" />
```

> ⚠️ **Do NOT read the theme in JS to pick an asset.** `AppShell.tsx:29-30` does
> `resolvedTheme === "dark"`, and `resolvedTheme` is `undefined` on the server and
> on the first client render — so a JS-driven choice renders the *light* ink for a
> frame regardless of the real theme. On a `#05080f` sidebar that is near-invisible
> text, then a pop.
>
> **Honest note:** today that flash would probably not be *observable*, because
> `AppShell.tsx:36` (`if (isCheckingAuth) return null`) holds the whole shell back
> behind an async auth round trip, by which time next-themes has resolved. That is
> an accident of timing, not a guarantee — if the auth check ever becomes
> synchronous or session-cached, the flash returns as a visual bug nobody will
> connect to a caching change. `currentColor` does not depend on that timing at all.
>
> ⚠️ Nothing in `components/` uses a `dark:` variant yet (grep: zero hits) — this
> is the **first**. Confirm it compiles under this Tailwind setup before B3 builds
> on it. `darkMode: ["class"]` is set (`tailwind.config.ts:5`) and
> `ThemeProvider attribute="class"` is confirmed (`layout.tsx:31`), so `.dark`
> lands on `<html>` before first paint via next-themes' injected script.

**Component separation:** the header is markup-only inside an existing component —
no state added, so no companion hook. `Sidebar.tsx` uses Tailwind utilities
throughout and this follows that, not a new CSS module.

### B4 — One `BrandLogo` component, inline SVG, ink via `currentColor`  ✅ DONE (2026-08-10)
**Files:** new `vendor/components/ui/BrandLogo/BrandLogo.tsx`

B2 and B3 place brand art at five sites across two components. Five hand-rolled
copies means five chances to disagree on geometry, colour and theme handling — and
B3's theming is exactly the kind of rule that gets copied wrong.

**Fix approach: inline SVG, not `<img>`.** Each lockup is exactly two paths — one
blue, one ink (verified: `logo-white.svg` = blue `#004afb` 3199 chars + ink
`#1e1e1e` 2978 chars). So the ink path becomes `fill="currentColor"` and the caller
sets the colour with a Tailwind text class:

```tsx
export function BrandLogo({ variant, className }: {
  variant: "mark" | "lockup"
  className?: string
}) {
  if (variant === "mark") return (
    <svg viewBox="0 0 1024 1024" className={className} aria-hidden focusable="false">
      <path d="…" fill={BRAND_BLUE} />
    </svg>
  )
  return (
    <svg viewBox="0 0 1722 697" className={className} aria-hidden focusable="false">
      <path d="…" fill={BRAND_BLUE} />        {/* zz + smile — always blue */}
      <path d="…" fill="currentColor" />       {/* the e and y — follows text colour */}
    </svg>
  )
}
```

Call sites: `className="… text-[#1e1e1e] dark:text-white"` on light-or-dark
surfaces, `className="… text-white"` where the surface is always dark (the login
page).

**Why inline beats two `<img>` and a `dark:hidden` toggle** — the approach this
item previously specified, now superseded:

| | two `<img>` | inline SVG |
|---|---|---|
| Assets to keep in sync | 2 lockups | **1** |
| Network requests | 2 (one hidden) | **0** — it is in the bundle |
| Duplicate DOM | yes, a hidden copy | no |
| Resolves before paint | yes | yes |
| Risk of the hidden copy leaking to print/AT | real | none |

**Proven, not assumed:** recolouring `logo-white.svg`'s ink to `#ffffff` and
rendering it on dark is visually identical to the native `logo-black.svg` — the
"e" counter cuts out correctly, nothing fills in. Tested before this was written.
That is what makes one source viable; had the counters broken, the two-`<img>`
approach would still be the answer.

**Getting the path data in:** hand-write the `.tsx` with the two `d` strings
inlined from the normalised source vector. **Do not add SVGR or any svg-loader** —
that is a new dependency and an AGENTS.md approval gate for something two paths
solve. ~3.2 KB of path data in a component file is unremarkable for an icon.

**Accessibility:** `aria-hidden` + `focusable="false"`, not `alt`. The mark is
decorative at all five sites — adjacent text already says "VENDOR PORTAL" or the
vendor's name, so announcing the brand again is noise. Inline SVG also needs
`focusable="false"` or older Edge puts it in the tab order.

⚠️ **`variant="mark"` must not use `currentColor`.** The mark is single-ink brand
blue and stays blue on every surface — it reads correctly on both the white and the
`#05080f` sidebar. Wiring it to `currentColor` would make it disappear into the
text colour.

**Component separation:** pure display — no state, no effects, no handlers — so
**no companion hook**, which the convention explicitly permits. No `.module.css`
either: the only styling is the caller's `className`, and the component hardcodes
no dimensions.

---

## IMPORTANT

### I1 — Visual baselines will change and must be regenerated  ✅ DONE (2026-08-10)
**Files:** `vendor/visual-tests/pilot.spec.ts-snapshots/`

`login`, `loginforgot`, `loginsent`, `loginreset`, `loginregister`, `loginselect`,
`loginregsent` (light and dark) all render `LoginPage`, and `sidebar` renders the
shell — so B2 and B3 change **~16 baselines**. That is expected, not a regression.

⚠️ **Regenerate only after B2 and B3 are both complete**, or the second one
invalidates the first regeneration. Then run the suite twice — the harness has a
history of intermittent failures, all resolved
(`.plans/2026-08-08-csp-blocks-supabase-connections.md` I3), and two clean runs is
what proved that fix.

### I2 — `/ui-gallery` should cover the new brand surfaces  ✅ DONE (2026-08-10)
**File:** `vendor/app/ui-gallery/page.tsx`

The gallery has no `sidebar` case that exercises the *new* two-row header, and the
`BrandLogo` component itself is uncovered. Add the component to the grid so both
lockup inks are pixel-covered — otherwise the theme swap in B3, the riskiest part
of this plan, has no automated check at all.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains. There are none. -->

- **Login treatment** → **A's wordmark header + B's bare form icon** (resolved
  2026-08-10, from `login-page-1`). B's watermark and C's texture rejected: the
  watermark was too faint at 5% to earn its place, the texture read as noise.
- **Dashboard placement** → **option 1, brand row above workspace row** (resolved
  2026-08-10, from `dashboard-1`). Gets the wordmark into the app without
  displacing the vendor's name; option 3 was better-looking but moved workspace
  context out of the sidebar, a behaviour change riding on a branding change.
- **Icon treatment** → **white mark on `#034BFC`**, *reversing design-1's
  blue-on-white* (resolved 2026-08-10 during investigation) — matches the shipped
  mobile icon, which is generated from the identical vector, and the `icon-512.png`
  house pattern it replaces. Consistency across the two apps beats a web-only look.
- ~~**Theme swap mechanism** → CSS `dark:` variants, both images rendered~~
  **superseded 2026-08-10 — see below.** Kept for the record; it was safe, just
  beaten.
- **Theme mechanism** → **one inline SVG, ink on `currentColor`** (resolved
  2026-08-10, at the user's request after they questioned the flash) — one asset
  instead of two, zero network requests, no hidden duplicate DOM, and still
  resolved before first paint. Verified feasible first: recolouring
  `logo-white.svg`'s ink renders identically to the native white-ink file. A JS
  theme read stays rejected — `resolvedTheme` is `undefined` on first render
  (`AppShell.tsx:29-30`).
  ⚠️ **`<picture>` + `prefers-color-scheme` was considered and rejected**, and it is
  a trap worth naming: it reads the *OS* preference and ignores this app's manual
  toggle, so a user whose OS is dark but who picks light in Settings gets the wrong
  ink **permanently**, not for a frame. Worse than the problem it solves.
- **Blue normalisation** → **everything becomes `#034bfc`** (resolved 2026-08-10) —
  the three supplied files carry three near-identical blues; the mobile generator
  already treats `#034bfc` as canonical.
- **Colour scope** → **manifest `theme_color` only** (resolved 2026-08-10) — the
  ~40 `#2563eb` UI usages stay. Retinting is a separate job.
- **Asset location** → `vendor/brand/` (not `public/` — nothing is fetched at runtime), renamed by *role* not by background
  (resolved 2026-08-10) — `logo-black`/`logo-white` name the intended backdrop and
  read backwards beside a fill colour.

---

## DEFERRED / COSMETIC

- **`command` and `booker` get no branding here.** Same work will be wanted, but
  cross-app changes need their own coordination and `booker` is not deploying.
- **`ProfilePage.tsx:27`'s `Building2` stays** — it stands for *a vendor*, not for
  Ezzy. Replacing it with the Ezzy mark would be actively wrong.
- **No splash / offline-page branding.** `public/offline.html` is unbranded; low
  value and outside an icon-and-header change.
- **The mobile generator is not refactored into something shared.** Two scripts in
  two repos with the same reasoning is the correct amount of duplication here —
  AGENTS.md forbids cross-app imports, and the geometry genuinely differs.

---

## Execution order

Two stages. **Stage 1 is fully independent** and can ship on its own.

**Stage 1 — assets and icons (no UI risk)**
1. **B1** — check in the vectors, write the generator, produce the icon set, bump
   `theme_color`. Nothing user-facing in the app changes; only browser/PWA chrome.

**Stage 2 — the UI, in dependency order**
2. **B4 first.** `BrandLogo` is what B2 and B3 both consume — building it first is
   what stops the theme rule being copied wrong twice.
   ⚠️ Confirm the `dark:` variant compiles here *before* B3 depends on it.
3. **B2** (login) then **B3** (sidebar). Independent of each other; login first
   because it needs only one lockup and so proves `BrandLogo` on the simpler case.
4. **I2** — gallery coverage for `BrandLogo`, both inks.
5. **I1 last** — regenerate baselines only once B2, B3 and I2 have all landed, then
   two consecutive clean runs.

---

## Verification

| Item | How | Kind |
|---|---|---|
| B1 | `file public/icons/*.png app/apple-icon.png` → expected dimensions; assert apple-icon has **no alpha**; visually confirm the mark sits inside the maskable safe circle | machine-verifiable, except the launcher crop |
| B1 | Re-running the generator twice produces byte-identical output — proves it is reproducible, which is the whole reason it is a script | machine-verifiable |
| B1 | Installed PWA icon on a real Android launcher and iOS home screen | **needs a device** |
| B2 | ⚠️ **Corrected during execution:** `Building2` → 0 is WRONG as an assertion — `LoginPage.tsx:348` legitimately uses it for the *company* applicant-type card, which means "a business", not Ezzy. The real check is **no `Building2` in a branding position** (verified: 0), plus `grep -c "logoBox\|brandName" LoginPage.module.css` → **0** (dead classes removed) | machine-verifiable |
| B2 | Login, forgot, sent, reset, register, select-vendor all render with no broken image | browser |
| B3 | Toggle the theme and confirm the ink flips both ways. Then **hard-refresh in dark mode and watch the first paint** — no invisible or wrong-ink logo, even for a frame. This is the specific failure `currentColor` exists to prevent | **browser, must be watched live** |
| B3 | Sidebar header does not overflow at `w-56` with a long vendor name | browser |
| B4 | Assert the rendered lockup has **exactly two** `<path>`s and that the ink one is `fill="currentColor"` — the whole approach rests on that, and a build step or a careless edit could silently bake in a literal colour | machine-verifiable |
| B4 | Assert `variant="mark"` does **not** use `currentColor` — if it does it will vanish into the surrounding text colour | machine-verifiable |
| B4 | `grep -rn "logo-black\|logo-white\|lockup-dark\|lockup-light" vendor/` → **0** — proves no second lockup crept back in | machine-verifiable |
| B4 | `tsc --noEmit` 0; `BrandLogo` renders in `/ui-gallery` in both themes | machine-verifiable |
| B1/B4 | `grep -rn "#004bfc\|#004afb" vendor/` → **0** — the blue was normalised, not just partly | machine-verifiable |
| I1 | `npx playwright test` — **two consecutive clean runs** | machine-verifiable |
| all | `npm run build` 0 in `vendor` | machine-verifiable |

**Baseline before starting:** `tsc` 0, `npm test` 39/39, Playwright 61/61 — all
confirmed green on 2026-08-10.
