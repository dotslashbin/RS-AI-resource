# Ezzy Vendor Mobile — styling, branding and layout parity

**Date:** 2026-07-29
**App / scope:** `./ezzy-vendor-mobile` only. Branch `feature/style_logo_upgrades`
(already checked out). **No backbone, no web-app, no schema changes** — this is a
cosmetics-and-assets branch.
**Status:** COMPLETE (2026-07-30) — all nine items delivered (I1–I9), machine-verified,
and **confirmed on a physical Android device**. All decisions resolved (D1–D5); no
OPEN items. One item parked (**I10**, iOS-only, blocked on companion B9).

**Device verification — the gate every ✅ below was waiting on.**
User-run pass on 2026-07-30 against a build of `40defdf`: **I1, I2, I3, I5, I6, I7,
I8, I9 all passed.** That single walk was what these items needed, because each
depended on something no local check can reach — a rendered glyph, a wrapped grid at
a real device width, status-bar contrast under a light-mode OS setting.

Specifically now closed, having previously been called out as unreachable here:
- the `CircleCheckBig` / `CircleCheck` crossover on "Completed This Month" (**I8**),
  which compiles either way and so had **no compiler backstop** (C4-corrected);
- the 2×2 stat grid at narrow width (**I2**), the case that was broken before;
- status-bar glyph legibility on a **light-mode** device (**I6**) — the failing case
  that could not be reproduced from here.

**Platform limit, unchanged and still real: Android only.** Nothing in this branch has
run on iOS and nothing can, absent an Apple Developer membership (companion **B9**).
Every ✅ below means *verified on Android*, not *verified*.

**B1 and I4 both closed 2026-07-30.** The artwork arrived on the third attempt, and
the icon + splash work was **delivered under
`.plans/2026-07-30-vendor-mobile-brand-assets.md`** — a separate plan because the job
grew past a cosmetics item (rasterization pipeline, checked-in generator, store
assertions, doc updates). Marked ✅ here because the outcome this plan asked for was
delivered; that plan is where the execution record and verification live.

Still outstanding, none of it code and none of it blocking this plan: **I10** iOS
shadow clipping (pre-existing, parked on companion **B9**).

Uncommitted at the time of writing: 15 modified files and 2 new ones in
`ezzy-vendor-mobile` — since committed as `40defdf`. Commits for
that app must be made from inside its folder.

> One-line framing: bring the mobile client's chrome in line with the vendor web
> portal (card accent, login palette, **icon set**), replace the Expo template brand
> assets with the real logo, and fix two layout defects the user hit on device —
> optimizing for visual parity with `vendor/` and for store-review readiness, not
> for new features.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision; numbers are
> plan-local — qualify cross-plan refs by app (e.g. "vendor-mobile-companion B5").

**Relationship to the build-out plan:** this plan closes the *icon/splash half* of
`.plans/2026-07-27-ezzy-vendor-mobile-companion.md` **B5** ("No brand assets exist
— do not invent a logo"). B5's remaining half — store screenshots, short + full
descriptions — stays in that plan and is **out of scope here** (§Deferred).

**Out of scope:** any behaviour change; new screens; the web app (`vendor/`) —
including the user's noted "we'll get to that later" for the web splash/logo;
privacy policy (companion **B6**); Play account type (companion **B7**); iOS
device verification (companion **B9**).

---

## 0. Investigation record and corrections

Read the real code in both apps before writing this. Three claims in the request
did not survive contact with it — recorded here so the reasoning is not lost.

**C1 — "top *and bottom* border" → vendor has a TOP accent only.**
The user confirmed (2026-07-29) they mean the *Pending Approvals* card on the
vendor dashboard. That is `vendor/components/ui/StatCard/StatCard.tsx:17-19`: a
3px `linear-gradient(90deg,#f59e0b,#f97316)` bar absolutely positioned at
`top-0 left-0 right-0` inside a `.sp-card` with `overflow-hidden`, so the radius
clips it. **There is no bottom accent.** The only place in `vendor/` with both
edges coloured is the *desktop nav tab strip*
(`vendor/components/layout/TabBar/TabBar.tsx:41`, `border-t-[3px]` +
`border-b-[3px]` in `blue-600`), which the user did not pick. **I1 therefore
implements top-only** — faithful to vendor. Adding a bottom bar would be inventing
a treatment the web app does not have.

**C2 — there is no background image to copy.**
`vendor/components/auth/LoginPage/LoginPage.module.css:12` is
`linear-gradient(145deg,#04060e 0%,#070b17 55%,#0d1b4b 100%)`, plus two
`radial-gradient` blob `<div>`s (`.blob1` `rgba(26,58,143,0.35)`, `.blob2`
`rgba(255,194,0,0.08)`). No raster asset exists anywhere in `vendor/public/`.
So I3 **rebuilds** the surface rather than copying a file. No new dependency is
needed: `expo-linear-gradient` is installed, and `react-native-svg` 15.15.4 is
already a direct dependency and can render the two radial blobs.

**C3 — "bookings items too close" is not a spacing *value* problem; ESCALATED to
three screens.** `RefreshableList.styles.ts:105` already sets `gap: spacing.md`
(12) — the value is right, but it is **inert**. Verified in the installed package:
`node_modules/@shopify/flash-list/dist/recyclerview/ViewHolder.js:44` renders every
cell with `position: "absolute"`, so cells are out of flow and flex `gap` on the
content container can never apply. `ItemSeparatorComponent` *is* supported
(destructured at `dist/recyclerview/RecyclerView.js:34`). This affects **bookings,
transactions and notifications** — every screen using `RefreshableList` — not just
bookings. It also explains the asymmetry the user saw: the dashboard's pending
preview is a plain `<View>` with `gap` (`DashboardView.styles.ts:37-39`), which
works, so gaps appear there and nowhere else.

**C4 — the two apps are on different lucide majors; five of the names vendor uses
are legacy aliases on mobile and the canonical spellings differ.**
Verified from the installed packages, not from memory:
`vendor/package.json` → `lucide-react@^0.468.0`; `ezzy-vendor-mobile/package.json`
→ `lucide-react-native@^1.27.0` (installed 1.27.0).

> **⚠ C4 CORRECTED 2026-07-29.** This item first claimed lucide v1 had *removed*
> the pre-v1 aliases, so "a naive port fails to compile". **That was wrong** — the
> first check only grepped canonical `declare const` lines and missed the alias
> re-exports. `lucide-react-native@1.27.0` re-exports all five legacy names
> (`CircleAlert as AlertCircle`, `CircleCheckBig as CheckCircle`,
> `CircleCheck as CheckCircle2`, `CircleX as XCircle`, `House as Home`), so
> vendor's spellings **do** compile on mobile.
> **This makes the crossover risk below worse, not better: there is no compiler
> backstop of any kind on icon names.** The mapping table stands as the
> canonical-name guide — use the v1 names because the aliases are legacy and will
> eventually be dropped — but do not expect `tsc` to catch a wrong one.

Checked each name against
`ezzy-vendor-mobile/node_modules/lucide-react-native/dist/types/lucide-react-native.d.ts`:

| Vendor (`lucide-react` 0.468) | Mobile canonical (`lucide-react-native` 1.27) | Status |
|---|---|---|
| `Home` | **`House`** | vendor name survives as a legacy alias |
| `AlertCircle` | **`CircleAlert`** | vendor name survives as a legacy alias |
| `CheckCircle` | **`CircleCheckBig`** | vendor name survives as a legacy alias |
| `CheckCircle2` | **`CircleCheck`** | vendor name survives as a legacy alias |
| `XCircle` | **`CircleX`** | vendor name survives as a legacy alias |
| `ClipboardList` `Receipt` `Percent` `CalendarCheck` `TrendingUp` `CalendarPlus` `CreditCard` `Wallet` `Bell` `Settings` `Layers` `Users` `Calendar` `Info` `Store` `LayoutDashboard` | unchanged | all 16 confirmed present |

Note the two `CheckCircle*` rows **cross over** — v0's `CheckCircle2` maps to v1's
`CircleCheck`, and v0's `CheckCircle` maps to `CircleCheckBig`. Transcribing them
in the obvious order silently swaps two glyphs and still compiles. Per the
correction above, **nothing in the toolchain catches this** — it is visual-check
only. I8 and I9 must use this table, not the vendor import lines.

**Architecture cross-check.** `architecture/conventions.md`'s rule that types and
styles are copied, never shared, across repos is respected — `theme/tokens.ts`
already documents itself as a verbatim copy of the web's `--sp-*` variables, and
I1/I3 extend that same copy. Nothing here diverges from a documented decision.

---

## BLOCKERS

### B1 — The source logo artwork has not been received  ✅ RESOLVED (2026-07-30)
**Files:** `ezzy-vendor-mobile/assets/images/*`, `assets/expo.icon/`

The request attached a logo (`[Image #1]`), but **no image arrived with the
message and nothing new is on disk** (checked the workspace and the session
scratchpad, 2026-07-29). Every current brand asset is still an Expo template
artifact — `assets/images/icon.png` is the Expo chevron-on-blue mark (verified by
opening it), `splash-icon.png` is the Expo logo, and `assets/expo.icon/` is the
template Icon Composer bundle referencing `expo-symbol 2.svg`.

**Blast radius:** blocks **I4 only**. I1, I2, I3, I5 and I6 are all independent of
it and can execute first (see Execution order).

**Unblock condition:** the user re-sends the logo file. Needed for a clean
derivation: a **vector (SVG/PDF) or a ≥1024×1024 raster with transparency**. A
small or pre-cropped raster cannot produce a compliant iOS 1024² icon or an
Android monochrome layer without visible resampling.

**Fix approach:** on receipt, execute I4's asset matrix. Per companion-plan B5,
**do not invent or approximate a logo** in the meantime.

**UPDATE 2026-07-29 — artwork located but UNUSABLE; B1 stays open.** The user
supplied `/mnt/c/Users/joshu/Downloads/site logo.png`: a blue "ZZ" wordmark with a
swoosh. Read and analysed successfully. Two independent disqualifiers:

1. **64×64 px.** I4 needs 1024×1024 — a 16× upscale, which is not shippable
   (`mobile-dev` §3.4: template/poor artwork is a brand *and* review failure).
2. **The mark is edge-flush.** Visible bounding box is x 1→63 on a 0→63 canvas —
   zero right padding. Even at 1024 it would need re-padding and centring: iOS masks
   to a rounded rect and Android crops to the safe circle, so an edge-flush mark is
   clipped on both. Content is 63×52, i.e. **wide, not square**, so it cannot simply
   be scaled to fill a square canvas.

Salvaged from it and reusable whatever arrives next:
- **Brand blue `#034BFC`** (dominant colour by a wide margin).
- Alpha is correct — 2092 of 4096 px transparent, a genuine cut-out.

Searched for a better source; none exists in reach. `~/Downloads` holds no vector
or larger copy; `website/rs-logo.jpeg` is *different* branding (an "RS" wordmark
with a road); `vendor/public/icons/icon-512.png` is a plain blue **"V"** placeholder.

**Unblock condition unchanged:** a vector (SVG/AI/PDF) or a ≥1024×1024 transparent
PNG. A 64px PNG named "site logo" is almost certainly a downscaled favicon export,
so a larger original probably exists wherever the website assets live.

**✅ RESOLVED 2026-07-30 — and this item now lives elsewhere.** The user supplied
`Ezzy-logo.svg` on the third attempt: genuine vector, two paths, no embedded raster,
square 1024 viewBox. The second file (`EZZY_Logo_Transparent_Exact.svg`) had also been
rejected in between — an SVG *wrapper* around a 200×62 base64 PNG, zero paths.

**All work moved to `.plans/2026-07-30-vendor-mobile-brand-assets.md`**, which
supersedes both this item and **I4** below. Icon and splash shipped there on
2026-07-30. Nothing further is owed here.
<!-- on completion: ✅ DONE (YYYY-MM-DD) — artwork received, format + dimensions -->

---

## IMPORTANT

### I1 — `StatCard` has no urgent top accent bar  ✅ DONE (2026-07-30)
**Files:** `src/components/dashboard/StatCard/StatCard.tsx`,
`StatCard.styles.ts:7-17`, `src/components/dashboard/DashboardView/DashboardView.tsx:47-52`,
`src/theme/tokens.ts`
**Web reference:** `vendor/components/ui/StatCard/StatCard.tsx:17-19`;
condition at `vendor/components/dashboard/DashboardPage/DashboardPage.tsx:45` is
`urgent={pendingCount > 0}`.

Mobile's `StatCard` matches the web on radius (`radii.card` 18 = `.sp-card`'s
`border-radius: 18px`) and border, but has no equivalent of the amber→orange
urgency bar. See **C1**: top edge only.

**Fix approach:**
1. `tokens.ts` — add `accentUrgent: Gradient` alongside the existing
   theme-independent constants (`BTN_PRIMARY`, `NAV_ACTIVE`, `STATUS`, lines
   90-119), following that established precedent:
   `{ colors: ["#f59e0b", "#f97316"], start: {x:0,y:0}, end: {x:1,y:0} }` —
   `end.x: 1, end.y: 0` reproduces CSS `90deg` (horizontal), *not* the `DIAGONAL`
   constant used by the other gradients.
2. `StatCard.styles.ts` — add `overflow: "hidden"` to `card` (mirrors the web's
   `overflow-hidden`, and is what clips the bar to the 18px radius), plus an
   `accentBar` style: `position: "absolute", top: 0, left: 0, right: 0, height: 3`.
   Use longhand edges, not `StyleSheet.absoluteFillObject` — RN 0.86 no longer
   exposes it in its types (same reason as `TabBarBackground.styles.ts:7`).
3. `StatCard.tsx` — add `urgent?: boolean`; when true, render a
   `<LinearGradient>` with `tokens.accentUrgent` as the first child.
4. `DashboardView.tsx` — pass `urgent={(stats?.pendingApprovals ?? 0) > 0}` on the
   **Pending Approvals card only**, matching the web condition exactly.

**Component separation:** `StatCard` today is a pure display component (no state,
no effects, no handlers). Adding a boolean prop and a gradient child **keeps it
pure display**, so per `.claude/skills/component-separation/SKILL.md` it correctly
has **no** `useStatCard.ts` — none is added. All new styling goes in the existing
co-located `StatCard.styles.ts`; no inline `style={{}}` is introduced. `DashboardView`
already has its `useDashboardView.ts`; the new prop is derived from data the hook
already returns, so **no hook change is needed**.

**Accessibility (`ux-design` §state handling):** the bar is a colour-only signal.
Meaning is *not* colour-dependent here — the card already reads "Pending
Approvals / <n> / Waiting on you" as text, and `accessibilityRole="summary"`
(`StatCard.tsx:24`) is unchanged. Do **not** add the bar as the sole carrier of any
new information.

**🔄 CODE COMPLETE (2026-07-29) — machine-verified, device check outstanding.**
Executed as written: `accentUrgent: Gradient` added to `Tokens` beside the other
theme-independent constants, with `end: {x:1,y:0}` (horizontal, per CSS `90deg`) and
a comment saying why it is not the shared `DIAGONAL`; assigned in both
`lightTokens` and `darkTokens`. `accentBar` uses longhand edges. The bar is the
card's first child and absolutely positioned, so it overlays the top edge without
displacing the header row I8 added. `DashboardView` passes
`urgent={(stats?.pendingApprovals ?? 0) > 0}` on Pending Approvals only, matching
`DashboardPage.tsx:45`.

`overflow: "hidden"` on the card is required — computed the alternative: with an 18
radius the card's boundary sits at x=18 when y=0, so an unclipped full-width 3px bar
would protrude as square tabs up to 18dp wide at both top corners. That clipping
raises an iOS-only shadow question, which turned out to be pre-existing and app-wide
rather than introduced here — see **I10**.

**✅ Device-verified 2026-07-30 (Android).** Confirmed in the user's on-device pass over a build of `40defdf` — see the device-verification block at the top of this plan. iOS remains unverified and unverifiable (companion **B9**).
### I2 — Dashboard stat grid collapses to a 1-up column on narrow phones  ✅ DONE (2026-07-30)
**Files:** `src/components/dashboard/StatCard/StatCard.styles.ts:8-9`,
`src/components/dashboard/DashboardView/DashboardView.styles.ts:12-16`

This is the "main menus … appeared too vertically long" report (user-confirmed
2026-07-29). Root cause: `card` sets `flex: 1` **and** `minWidth: 150` inside a
`flexDirection: "row", flexWrap: "wrap"` container with `gap: spacing.md` (12).

Arithmetic, with `ScreenShell` content padding `spacing.xl` (24) per side:
- 390dp device → 342dp container → two-up needs 165 each ✓ fits
- 360dp device → 312dp container → 150 each exactly ✓ fits (zero margin)
- 320dp device → 272dp container → 130 each < 150 ✗ **wraps to one per row**

Below ~360dp — and at 360dp the moment a large OS font setting nudges anything —
all four cards go full-width, producing the tall stack of blocks the user saw.

**Fix approach:** in `StatCard.styles.ts`, replace `minWidth: 150` with
`flexBasis: "47%"` + `minWidth: 0`, keeping `flex: 1`'s grow behaviour
(`flexGrow: 1`). At 47%, two cards plus the 12dp gap fit at 272dp
(128×2+12 = 268 ≤ 272) and still fill the row at 342dp. This locks the 2×2 grid at
every supported width instead of leaving it width-dependent. `DashboardView.styles.ts`'s
`grid` keeps `flexWrap: "wrap"` — it is what forms the second row.

**Deliberately NOT doing (settled by D4-a, 2026-07-29):** making the cards *look*
like buttons. They are non-interactive summary tiles; giving them a pressable
affordance without a press target is the affordance-lie `ux-design` prohibits. So:
no `Pressable`, no press state, no `accessibilityRole="button"`, and padding stays
`spacing.lg`. The "too vertically long" complaint is answered by the grid fix above;
the "didn't look like buttons" half is answered by *not* doing it, on purpose.

**🔄 CODE COMPLETE (2026-07-29) — machine-verified, device check outstanding.**
`minWidth: 150` replaced with `flexGrow: 1` + `flexBasis: "47%"` + `minWidth: 0`
(the implicit `flex: 1` shorthand was written out, since only the grow half was
wanted). Arithmetic re-checked after the change: 320dp device → 272dp container →
47% = 127.8 each, ×2 + 12dp gap = 267.7 ≤ 272, so two per row, then `flexGrow`
fills to 130 each; 390dp → 342dp container → grows to 165 each. Two-up now holds
from 320dp up instead of failing below ~360dp.

D4-a honoured: no `Pressable`, no press state, `accessibilityRole` still
`"summary"`, padding still `spacing.lg`.
<!-- on completion: ✅ DONE (YYYY-MM-DD) — verify at 320dp and 390dp, both themes -->

**✅ Device-verified 2026-07-30 (Android).** Confirmed in the user's on-device pass over a build of `40defdf` — see the device-verification block at the top of this plan. iOS remains unverified and unverifiable (companion **B9**).
### I3 — Auth surfaces do not use the vendor web login palette  ✅ DONE (2026-07-30)
**Files:** `src/components/common/AuthScreen/AuthScreen.tsx` + `.styles.ts`,
new `src/components/common/AuthScreen/useAuthScreen.ts`,
new `src/theme/brandTokens.ts`, `src/theme/tokens.ts`,
`src/components/common/PrimaryButton/PrimaryButton.tsx:77` + `.styles.ts:104-108`,
`src/components/auth/SignInForm/SignInForm.styles.ts:39`
**Web reference:** `vendor/components/auth/LoginPage/LoginPage.module.css:1-29,
41-61, 108-115, 185, 206-218`

`AuthScreen.styles.ts` currently paints `tokens.pageBg` — the *themed* page
gradient — so on a light-mode device the sign-in screen is pale lavender with a
blue button, while vendor web's login is a hardcoded-dark navy surface with gold
`#FFC200` accents. **D3 (resolved 2026-07-29): force dark with gold accents**,
matching web and `command` exactly, regardless of device theme.

**Fix approach — reuse the existing theming seam rather than adding a parallel one.**
Every styled component in this app already resolves colours through
`useAppTheme()` → `makeStyles(tokens)`. So:

1. **`theme/brandTokens.ts`** — export `brandTokens: Tokens`, satisfying the
   **existing `Tokens` interface** with the web login's values (page gradient
   `["#04060e","#070b17","#0d1b4b"]`; `strong: "#ffffff"`;
   `text: "rgba(255,255,255,0.45)"`; `inputBg: "rgba(255,255,255,0.05)"`;
   `inputBdr: "rgba(255,255,255,0.1)"`; `cardBg: "rgba(255,255,255,0.025)"`;
   `cardBdr: "rgba(255,255,255,0.07)"`; gold `btnPrimary`
   `["#FFC200","#e6a800"]`). Header comment must state it is a verbatim copy of
   `LoginPage.module.css`, same discipline as `tokens.ts:1-11`.
2. **`AuthScreen`** overrides `AppThemeContext` for its subtree with
   `{ tokens: brandTokens, isDark: true, preference, setPreference }`.
   **Why this and not per-component variants:** `SignInForm`, `ForgotPasswordForm`,
   `ResetPasswordForm`, `FormField`, `PrimaryButton` and `VendorPicker` all already
   read the context, so they re-style with **zero edits** to any of them. A
   `variant="brand"` prop would have to be threaded through six components and
   every style file — more code, more drift, no benefit.
3. **Two token additions** (the only places a hardcoded colour blocks step 2):
   - `btnPrimaryFg: string` — `"#ffffff"` in both themes, `"#04060e"` in brand;
     replaces the hardcoded white at `PrimaryButton.styles.ts:105`. Gold-on-white
     is unreadable, so this is required, not cosmetic.
   - `accent: string` — `"#2563eb"` in both themes, `"#FFC200"` in brand; replaces
     the hardcoded `#2563eb` at `SignInForm.styles.ts:39`.
   **Leave the other four hardcoded `#2563eb` sites alone** — `DashboardView.styles.ts:33`,
   `(app)/_layout.tsx:35`, `NotificationListItem.styles.ts:26`,
   `NotificationsList.styles.ts:48` are all in-app surfaces that must stay blue.
   Changing them is out of scope for this branch (Surgical Changes).
4. **`AuthScreen.styles.ts`** — dark 3-stop gradient; a `shell` card mirroring
   `LoginPage.module.css:17-29`: `borderRadius: 28`, `borderTopWidth: 3`,
   `borderTopColor: "#FFC200"`, `overflow: "hidden"`. Note the web's `.shell`
   `border-radius: 28px` is deliberately **not** `radii.card` (18) — this is the
   login shell, not a content card, so it does not use the card token.
5. **Blobs** — two `react-native-svg` `<RadialGradient>` circles positioned as in
   `.blob1`/`.blob2`. `pointerEvents: "none"` equivalent so they cannot eat taps.

**Component separation:** composing the context value is logic, not render, so
`AuthScreen` gains a **`useAuthScreen.ts`** returning the memoised context value.
The `.tsx` stays a pure render layer and keeps its existing
`useMemo(() => makeStyles(tokens), [tokens])`. No inline `style={{}}` added.

**Blast radius — all six pre-app routes go dark-gold, not just sign-in.** Every one
uses `AuthScreen`: `sign-in.tsx:8`, `forgot-password.tsx:15`,
`reset-password.tsx:11`, `select-vendor.tsx:9`, `blocked.tsx:10`, `index.tsx:25`.
This is **correct and matches web**, where the same shell serves login, vendor
select and KYC status (`vendor/components/kyc/KycStatusPage/KycStatusPage.module.css:20`
carries the identical `border-top: 3px solid #FFC200`). Two consequences to verify:
- `blocked.tsx` is a store-review-visible state (`mobile-dev` §3.1, "blocked and
  empty states") — confirm its copy is still legible on the dark surface.
- `SnackbarProvider` mounts **above** `AuthScreen` (`_layout.tsx:114`), so toasts
  raised from an auth screen keep *themed* colours. Acceptable (a transient
  overlay), but check contrast on the dark surface rather than assuming.

**Couples with I6** — must ship in the same batch. See I6.

**🔄 CODE COMPLETE (2026-07-29) — machine-verified, device check outstanding.**
Executed as designed, and the context-override approach paid off exactly as
predicted: **`FormField`, `VendorPicker`, `BlockedNotice`, `ForgotPasswordForm` and
`ResetPasswordForm` were not edited at all** and still restyle, because they already
resolve every colour through `useAppTheme()`.

Built: `theme/brandTokens.ts` (a full `Tokens` value plus a small `BRAND_SHELL`
constant for the 28px radius and gold top edge), `AuthScreen/useAuthScreen.ts`
(memoised context value; `preference`/`setPreference` passed through from the real
provider so nothing in the subtree loses the user's actual setting), and a rewritten
`AuthScreen` that provides the context, paints the 3-stop navy gradient, renders the
shell card and the two `react-native-svg` radial blobs.

Two token additions as planned (`btnPrimaryFg`, `accent`), and the four in-app
`#2563eb` sites were left alone as specified.

Three things found while implementing that the plan had not called out:
- **`PrimaryButton`'s loading spinner was also hardcoded white**
  (`PrimaryButton.tsx:75`), not just the label. White on gold is nearly invisible,
  so the `ActivityIndicator` now takes `tokens.btnPrimaryFg` too. The plan named
  only the label.
- **The shell deliberately has no `overflow: "hidden"`.** The web's `.shell` uses it
  to clip blobs that live *inside* its marketing panel; mobile has no such panel, so
  the blobs sit on the page instead and nothing needs clipping. That also avoids
  adding a fourth instance of the iOS shadow conflict in **I10** — the shell keeps a
  visible shadow on both platforms.
- **A gold `brandSub` ("Vendor Portal") was added** under the app name, mirroring
  the web's `.brandSub`, since the brand block otherwise read as a bare word on a
  large empty card.

Verified: `tsc --noEmit` exit 0 · `expo lint` clean · `npm test` 40/40 ·
`expo export --platform android` succeeded.
**Still needed:** the device pass this item most depends on — gold-button contrast,
legibility of all six routes (especially `blocked.tsx`), and toast contrast over the
navy. **Android only when run — iOS blocked by companion B9.**

**✅ Device-verified 2026-07-30 (Android).** Confirmed in the user's on-device pass over a build of `40defdf` — see the device-verification block at the top of this plan. iOS remains unverified and unverifiable (companion **B9**).
### I4 — App icon, adaptive icon and splash are Expo template artifacts  ✅ DONE (2026-07-30)

> **Delivered — executed under a separate plan.** Executed in full under
> `.plans/2026-07-30-vendor-mobile-brand-assets.md` on 2026-07-30, once B1's artwork
> arrived. That plan carries the corrected safe-zone figure (**~626px**, not the 708px
> written below), drops the `dark` splash variant as unnecessary (the auth surface is
> forced dark, so both appearances want the same splash), and adds a checked-in
> generator plus store assertions. The specification below is left intact as the
> record of what was originally scoped.
**Files:** `app.json:7` (`icon`), `:11` (`ios.icon`), `:36-41` (`adaptiveIcon`),
`:50-56` (`expo-splash-screen` plugin); `assets/images/`, `assets/expo.icon/`
**Closes:** companion-plan **B5**'s icon/splash half (that plan's §12.3).

Current state, verified: `icon.png` is the Expo chevron mark;
`adaptiveIcon.backgroundColor` is `#E6F4FE` and splash `backgroundColor` is
`#208AEF` — both Expo template blues, neither a brand colour; `splash-icon.png` is
the Expo logo at `imageWidth: 76`; `ios.icon` points at the template Icon Composer
bundle `assets/expo.icon/`. `mobile-dev` §3.4: shipping template artwork is a
brand *and* review failure.

**Fix approach — asset matrix.** Derive all of these from B1's artwork:

| Target | Spec | Config key |
|---|---|---|
| iOS app icon | 1024×1024 PNG, **no alpha**, **square** — do not pre-round; Apple applies the mask | `ios.icon` (replace the `.icon` dir reference with the PNG path) |
| Cross-platform fallback | 1024×1024 PNG | `icon` |
| Android foreground | 1024×1024, transparent; mark must sit inside the **central safe circle** — 66dp of the 108dp layer, i.e. a **~626px** diameter circle on a 1024px canvas — or launchers crop it. Anything past the 72dp masked viewport (**~683px**) is definitely cropped | `android.adaptiveIcon.foregroundImage` |
| Android background | 1024×1024, opaque brand fill | `android.adaptiveIcon.backgroundImage` + `backgroundColor` → brand navy, replacing `#E6F4FE` |
| Android monochrome | 1024×1024 single-colour silhouette on transparent (themed icons, Android 13+) | `android.adaptiveIcon.monochromeImage` |
| Splash | brand mark; `backgroundColor` → `#04060e` (replacing `#208AEF`), `imageWidth` 76 → ~180 | `expo-splash-screen` plugin |
| Splash (dark) | add a `dark: { image, backgroundColor }` block so a light-mode device does not flash the wrong colour before first paint | same plugin |

Also delete the now-unused template `assets/expo.icon/` bundle once `ios.icon`
points at the PNG — leaving it would keep the Expo symbol in the repo and in
`expo prebuild` output.

**Verification is build-time, not reloadable.** Icons and splash are baked into the
binary: a Metro reload will *not* show them. Needs `npx expo prebuild` to inspect
the generated native asset catalogues, then an EAS `preview` build on a physical
Android device. **iOS cannot be verified here** (companion **B9** — no paid Apple
account); state that explicitly when marking this item done.
<!-- if deferred: ⏸ PARKED (YYYY-MM-DD) — awaiting B1 artwork -->

### I5 — List items render flush: FlashList ignores `contentContainerStyle.gap`  ✅ DONE (2026-07-30)
**File:** `src/components/common/RefreshableList/RefreshableList.styles.ts:105`
(the inert `gap: spacing.md`), `RefreshableList.tsx:68-94`
**Affects:** bookings, transactions **and** notifications — see **C3** for the
verification that proves the mechanism and the escalation from one screen to three.

**Fix approach:** remove the inert `gap` from `content` (keep its `padding`, which
FlashList *does* honour) and pass an `ItemSeparatorComponent` rendering a
`spacing.md`-high spacer view, styled in `RefreshableList.styles.ts`. Default it in
`RefreshableList` so all three screens are fixed at the source and no caller has to
remember; allow a caller override by letting an explicitly-passed
`ItemSeparatorComponent` win.

**Why a separator and not `marginBottom` on the item:** a bottom margin on
`BookingListItem` would (a) add a trailing gap above the `ListFooterComponent`
spinner and below the last row, stacking with the container's 24dp padding, and
(b) leak list-layout concern into a component the dashboard also renders inside a
plain gapped `<View>`, where it would double the spacing. The separator keeps the
concern in the list.

**No change to `DashboardView.styles.ts:37-39`** — that preview list is a real
flex container and its `gap` already works.

**Component separation:** `RefreshableList` keeps its existing
`useRefreshableList.ts`; the separator is a pure display element defined from the
style file, adding no state. `BookingListItem` is untouched.

**🔄 CODE COMPLETE (2026-07-29) — machine-verified, device check outstanding.**
Executed as planned: removed the inert `gap` from `content` in
`RefreshableList.styles.ts` (keeping `padding`, with a comment recording why `gap`
cannot work), added a `separator` style, and defaulted `ItemSeparatorComponent` in
`RefreshableList.tsx`.

One implementation detail the plan did not anticipate, found by reading the
package: `ViewHolder.js:75` includes `ItemSeparatorComponent` in the cell's memo
comparison, so an inline component would bust that memo and remount every
separator on each render. The default is therefore built with `useMemo` keyed on
`[ItemSeparatorComponent, styles]` — `styles` is itself memoised on `tokens`, so
identity changes only when the theme does. A caller-supplied
`ItemSeparatorComponent` still wins.

Also confirmed against the package rather than assumed: `ViewHolder.js:32` renders
a separator only when `trailingItem !== undefined`, so there is **no** trailing
separator after the last row — the concern the plan raised against the
`marginBottom` alternative does not apply to this approach.

Verified: `tsc --noEmit` exit 0 · `expo lint` clean · `npm test` 40/40 ·
`expo export --platform android` succeeded (7.1MB bundle, `dist/` deleted).
**Still needed:** on-device check that the three list screens show 12dp gaps and no
trailing gap above the load-more spinner. **Android only when run — iOS is blocked
by companion B9.**

**✅ Device-verified 2026-07-30 (Android).** Confirmed in the user's on-device pass over a build of `40defdf` — see the device-verification block at the top of this plan. iOS remains unverified and unverifiable (companion **B9**).
### I6 — No `StatusBar` style control anywhere; forcing dark makes glyphs invisible  ✅ DONE (2026-07-30)
**Files:** `src/components/common/AuthScreen/AuthScreen.tsx`, `src/app/_layout.tsx`

Verified: `StatusBar` appears **nowhere** in `src/`, and `app.json` declares
`"userInterfaceStyle": "automatic"`. Today that is survivable because every screen
follows the device theme. **I3 breaks it:** a light-mode device draws dark
status-bar glyphs, and I3 puts a near-black surface underneath them — the clock and
battery become invisible on the sign-in screen.

**Fix approach:** render `<StatusBar style="light" />` from `expo-status-bar`
(already a dependency, `~57.0.1` — no install, no approval gate) inside
`AuthScreen`, so it applies to all six pre-app routes. Separately, set
`<StatusBar style={isDark ? "light" : "dark"} />` for the in-app tree so the
in-app case stops relying on the OS default matching the app's own theme override
— a user who forces light theme on a dark-scheme device has the same invisible-glyph
bug today.

**Coupling:** I6 and I3 **must ship in the same commit**. I3 alone regresses the
status bar on every light-mode device; I6 alone is a no-op improvement. Neither
half is independently correct.

**🔄 CODE COMPLETE (2026-07-29) — machine-verified, device check outstanding.**
Shipped in the same working tree as I3, as required. `<StatusBar style="light" />`
in `AuthScreen` covers all six pre-app routes; `<StatusBar style={isDark ? "light" : "dark"} />`
in `(app)/_layout.tsx`'s `AppTabs` covers the in-app tree, which needed a fragment
around the existing `<Tabs>` (hence the re-indent in that file's diff).

Placement reasoning: `expo-status-bar` resolves to the most recently mounted entry,
so the in-app value applies while tabs are mounted and `AuthScreen`'s `light` wins
whenever a pre-app route is on top. `AppTabs` was chosen over the root layout because
it already calls `useAppTheme()` — the root `RootLayout` cannot, being the component
that renders the provider.

`expo-status-bar` was already a dependency (`~57.0.1`), so no install and no
approval gate, as planned.

Verified: `tsc --noEmit` exit 0 · `expo lint` clean · `npm test` 40/40 ·
`expo export --platform android` succeeded.
**Still needed — and unusually, the failing case is the one that cannot be checked
here:** status-bar glyph legibility on a **light-mode** device, plus the in-app
theme-override case (app forced light on a dark-scheme device). Both are runtime-only.

**✅ Device-verified 2026-07-30 (Android).** Confirmed in the user's on-device pass over a build of `40defdf` — see the device-verification block at the top of this plan. iOS remains unverified and unverifiable (companion **B9**).
### I7 — Tab-bar icons diverge from vendor's nav, and two collide with vendor's own meanings  ✅ DONE (2026-07-30)
**File:** `src/app/(app)/_layout.tsx:2` (imports), `:50-52`, `:59-61`, `:68`, `:75`
**Web reference:** `vendor/components/layout/Sidebar/Sidebar.tsx:10-23` (the
authoritative nav map — it carries every section, unlike `TabBar.tsx:15-21` which
omits Transactions and Settings by design)

Mobile's four tabs plus the Settings header action use five glyphs; **three do not
match vendor**, and two of the three are worse than arbitrary — they reuse a glyph
vendor has already assigned to a *different* meaning:

| Section | Mobile now | Vendor | Action |
|---|---|---|---|
| Dashboard | `LayoutDashboard` | `Home` | → **`House`** (renamed, C4) |
| Bookings | `CalendarCheck` | `ClipboardList` | → **`ClipboardList`**. `CalendarCheck` is vendor's **Calendar** glyph (`Sidebar.tsx:22`) — mobile is currently showing the calendar icon for bookings |
| Transactions | `Wallet` | `Receipt` | → **`Receipt`**. `Wallet` is vendor's **Total Payout** metric glyph (`TransactionSummaryCards.tsx:67`) — and **I8 puts that very icon on a card inside this tab**, so leaving it makes the tab and one of its own metrics share a glyph |
| Alerts | `Bell` | `Bell` (`TopBar.tsx:2`) | ✓ already matches — no change |
| Settings | `Settings` (`SettingsAction.tsx:2`) | `Settings` (`Sidebar.tsx:21`) | ✓ already matches — no change |

**Fix approach:** swap the three imports and their `tabBarIcon` render props.
`tabBarIcon` already receives `{ color, size }` from `screenOptions`, so no styling
changes and no token work. Five lines.

**Coupling:** the Transactions swap is only *fully* correct alongside **I8** — fixing
one and not the other leaves either a duplicate `Wallet` (I8 without I7) or an
unexplained `Receipt`/`Wallet` split (I7 without I8). Both are small; ship together.

**Component separation:** `(app)/_layout.tsx` is a route layout with no styling and
no new state — icons are passed as render props exactly as they are today. No hook
or style file is added or needed.

**Sections with no mobile counterpart — nothing to do:** vendor's `Info` (Vendor
Profile), `Layers` (Offerings), `Calendar` (Schedule Maker), `Users` (Staff),
`CalendarCheck` (Calendar) and `Store` all belong to screens this companion app
deliberately does not have (companion plan's four-jobs scope). Do **not** add tabs
to create matches.

**🔄 CODE COMPLETE (2026-07-29) — machine-verified, device check outstanding.**
One file, `src/app/(app)/_layout.tsx`: the import line and three `tabBarIcon`
render props. `LayoutDashboard` → `House`, `CalendarCheck` → `ClipboardList`,
`Wallet` → `Receipt`. `Bell` (Alerts) and `Settings` (header action) were already
correct and were left untouched, as planned. The comment above the layout now
records *why* the two collisions were not free choices, so a later reader does not
"simplify" back to `Wallet`.

No styling or token work was needed — `tabBarIcon` already receives `{ color, size }`
from `screenOptions`, so the active/inactive tint path is unchanged.

Verified: `tsc --noEmit` exit 0 · `expo lint` clean · `npm test` 40/40 ·
`expo export --platform android` succeeded. **Still needed:** eyes on the four
glyphs at tab-bar size against vendor's sidebar — per C4-corrected there is no
compiler backstop on icon names, so `tsc` passing proves nothing about which glyph
rendered. **Android only when run — iOS blocked by companion B9.**

**✅ Device-verified 2026-07-30 (Android).** Confirmed in the user's on-device pass over a build of `40defdf` — see the device-verification block at the top of this plan. iOS remains unverified and unverifiable (companion **B9**).
### I8 — `StatCard` has no icon at all; vendor's carries a tinted icon chip  ✅ DONE (2026-07-30)
**Files:** `src/components/dashboard/StatCard/StatCard.tsx:23-42`,
`StatCard.styles.ts`, `src/components/dashboard/DashboardView/DashboardView.tsx:47-75`,
`src/components/transactions/TransactionSummaryCards/TransactionSummaryCards.tsx:27-53`
**Web reference:** `vendor/components/ui/StatCard/StatCard.tsx:20-25` — a
`size-[30px] rounded-[10px]` box holding a `size={14}` icon, with per-card `color`
and tinted `bg`, in a `flex items-center justify-between mb-3` row with the label

Mobile's `StatCard` renders label / value / sub only — verified, no icon prop
exists. Because `TransactionSummaryCards` deliberately reuses `StatCard`
(`TransactionSummaryCards.tsx:10-11`), **one component change fixes both screens**:
four dashboard cards and four transaction cards.

**Fix approach:**
1. `StatCard.tsx` — add `icon: LucideIcon`, `iconColor: string`, `iconBg: string`
   props (type-only import of `LucideIcon` from `lucide-react-native`; type-only
   imports are safe per `AGENTS.md`'s native-module trap). Restructure the body to
   vendor's shape: a header row (label + icon chip), then value, then sub.
2. `StatCard.styles.ts` — add `headerRow` (`flexDirection: "row"`,
   `alignItems: "center"`, `justifyContent: "space-between"`, `gap: spacing.sm`)
   and `iconChip` (`width: 30, height: 30, borderRadius: radii.md`,
   centred). `radii.md` is 12, not vendor's 10 — **use `radii.md`**; inventing a
   `radii` entry for a 2px delta is not worth a token, and the existing scale is
   the pattern.
   `iconColor`/`iconBg` arrive as props and are applied as the *only* permitted
   inline values (genuinely dynamic per card), consistent with the RN convention.
3. Callers pass vendor's exact glyph + colour pairs, **translated through C4**:

| Card | Vendor icon | Mobile icon | `color` | `bg` |
|---|---|---|---|---|
| Pending Approvals | `AlertCircle` | `CircleAlert` | `#f59e0b` | `rgba(245,158,11,0.12)` |
| Today's Bookings | `CalendarCheck` | `CalendarCheck` | `#3b82f6` | `rgba(59,130,246,0.12)` |
| Completed This Month | `CheckCircle` | `CircleCheckBig` | `#10b981` | `rgba(16,185,129,0.12)` |
| Monthly Revenue | `TrendingUp` | `TrendingUp` | `#6366f1` | `rgba(99,102,241,0.12)` |
| Collected | `Receipt` | `Receipt` | `#3b82f6` | `rgba(59,130,246,0.12)` |
| Platform fees | `Percent` | `Percent` | `#f59e0b` | `rgba(245,158,11,0.12)` |
| Your payout | `Wallet` | `Wallet` | `#10b981` | `rgba(16,185,129,0.12)` |
| Transactions (count) | *no vendor counterpart* | `ClipboardList` (**D5**) | `#64748b` | `rgba(100,116,139,0.12)` |

Source lines: dashboard four at
`vendor/components/dashboard/DashboardPage/DashboardPage.tsx:45-58`; transactions
three at `vendor/components/transactions/TransactionSummaryCards/TransactionSummaryCards.tsx:44-69`.

**Couples with I1 — same file, same render tree, must ship in one commit.** I1 adds
the absolute 3px accent bar and `overflow: "hidden"`; I8 restructures the body into
a header row. The accent bar must remain the **first child** and stay absolutely
positioned so the header row is unaffected by it. Doing these as two commits means
rewriting the same JSX twice.

**Couples with I2 — verify, do not assume.** I8 adds a 30dp chip to a card that I2
sizes at `flexBasis: "47%"`. At a 320dp device that is a ~128dp card, ~96dp inside
padding, leaving ~58dp for the label beside the chip — "Completed This Month" and
"Pending Approvals" **will wrap to two or three lines**. That is acceptable (vendor
wraps too at `text-[11px]` in its 2-column mobile grid) but it is not free: give the
label `numberOfLines={2}` so a third line cannot appear, and confirm rows still read
as a grid. Within a wrapped flex row RN stretches items to the tallest, so cards
align per row; rows may differ in height from each other, which matches the web.

**Component separation:** `StatCard` remains a **pure display component** — three
new props, no state, no effects, no handlers — so per
`.claude/skills/component-separation/SKILL.md` it still correctly has **no**
`useStatCard.ts`, and none is added. All static styling lands in the existing
`StatCard.styles.ts`; the only inline values are the per-card `color`/`bg`, which
the convention explicitly permits as genuinely dynamic.

**Accessibility:** the chip is decorative — the label already names the metric. Give
the icon no accessibility label and leave the card's existing
`accessibilityRole="summary"` (`StatCard.tsx:24`) intact, so a screen reader reads
one summary rather than a stray icon node.

**🔄 CODE COMPLETE (2026-07-29) — machine-verified, device check outstanding.**
`icon: LucideIcon` (type-only import), `iconColor`, `iconBg` and `urgent` added;
`headerRow` + `iconChip` in the style file; all **eight** call sites updated across
`DashboardView` and `TransactionSummaryCards` — confirmed eight is the complete set
(`grep -c "<StatCard"`), and making the three props required means `tsc` would have
caught any missed one.

Three details settled during execution:
- **Icon size 16, not vendor's 14** — same reasoning as I9, and `mobile-dev`
  §Pre-flight's rule that desktop densities are not ported verbatim. Still
  proportionate inside the 30dp chip.
- **`headerRow` gets `marginBottom: spacing.sm`** on top of the card's existing
  `gap: spacing.xs`, totalling 12dp header→value to match the web's `mb-3`, while
  value→sub keeps the tighter 4dp. The uniform 4dp gap alone would have lost the
  web's header separation.
- **`label` gets `flex: 1` and `numberOfLines={2}`** — the I2 coupling, as
  predicted. Confirmed the squeeze is real at 320dp: ~96dp inside the card's
  padding, minus the 30dp chip and 8dp gap, leaves ~58dp for the label.

Colour/glyph pairs were kept inline at the call sites rather than centralised —
that is what the web does, and a shared table for eight one-use pairs would be an
abstraction nothing else needs.
<!-- verification note: glyph correctness is visual-only — see C4-corrected -->

**✅ Device-verified 2026-07-30 (Android).** Confirmed in the user's on-device pass over a build of `40defdf` — see the device-verification block at the top of this plan. iOS remains unverified and unverifiable (companion **B9**).
### I9 — Notification rows have no per-type icon  ✅ DONE (2026-07-30)
**Files:** `src/components/notifications/NotificationListItem/NotificationListItem.tsx:1,
62-` (row body), `NotificationListItem.styles.ts`
**Web reference:** `vendor/components/layout/NotificationPanel/NotificationItem.tsx:6-13`
(`TYPE_ICON` map), rendered at `:39`

Mobile imports only `Archive` and `Trash2` — the swipe-action glyphs
(`NotificationListItem.tsx:1`). Every row's *content* is icon-less, so the seven
notification kinds are visually identical and distinguishable only by reading the
title. Vendor gives each type a glyph and a colour.

**The type enums are identical**, which makes this a clean port with no mapping
judgement: `src/lib/types.ts:58-65` declares exactly the same seven members as
vendor's `TYPE_ICON` keys — `booking_confirmed`, `booking_rejected`,
`booking_cancelled`, `new_booking`, `payment_confirmed`, `vendor_pending_approval`,
`new_user_registration`.

**Fix approach:** add a module-scope `TYPE_ICON: Record<NotificationType, {icon: LucideIcon; color: string}>`
in `NotificationListItem.tsx`, mirroring vendor's map and translated through **C4**:

| Type | Vendor icon | Mobile icon | Colour |
|---|---|---|---|
| `new_booking` | `CalendarPlus` | `CalendarPlus` | `#3b82f6` (blue-500) |
| `payment_confirmed` | `CreditCard` | `CreditCard` | `#10b981` (emerald-500) |
| `booking_confirmed` | `CheckCircle2` | **`CircleCheck`** | `#10b981` |
| `booking_rejected` | `XCircle` | **`CircleX`** | `#ef4444` (red-500) |
| `booking_cancelled` | `AlertCircle` | **`CircleAlert`** | `#f59e0b` (amber-500) |
| `vendor_pending_approval` | `CheckCircle2` | **`CircleCheck`** | `#3b82f6` |
| `new_user_registration` | `CheckCircle2` | **`CircleCheck`** | `#3b82f6` |

Vendor renders at `size={14}`; use **16** on mobile — 14 is a desktop-density value
and `mobile-dev` §Pre-flight is explicit that web sizings are not ported verbatim.
The icon is decorative (title text carries the meaning), so no accessibility label.

**Why a `Record`, not a `switch`:** an exhaustive `Record<NotificationType, …>` makes
the compiler reject an unhandled type the moment `NotificationType` gains a member —
the same reason vendor used one. A `switch` with a `default` would silently swallow
a new type.

**Component separation:** `NotificationListItem` is documented as pure display
(`:20-22`, every handler passed in) and stays that way — the map is a module-scope
constant, not state. Colours are per-type data, so they live in the map beside the
icon rather than in `.styles.ts`; the chip/layout styling goes in the style file.

**🔄 CODE COMPLETE (2026-07-29) — machine-verified, device check outstanding.**
Added the exhaustive `TYPE_ICON: Record<NotificationType, {icon: LucideIcon; color: string}>`
at module scope with all seven types, using the **canonical** v1 names per C4
(`CircleCheck`, `CircleX`, `CircleAlert`, plus the unchanged `CalendarPlus` and
`CreditCard`). `LucideIcon` is imported type-only, which is safe per the
native-module trap in `AGENTS.md`.

Placement follows the web row (`NotificationItem.tsx:38-42`): the glyph leads the
title. Mobile's row had no title row to put it in, so `body` gained a `titleRow`
wrapper (`flexDirection: "row"`, `alignItems: "flex-start"`, `gap: spacing.sm`) and
`title` gained `flex: 1` so it still wraps. The icon sits in a `typeIcon` view with
`marginTop: 2`, reproducing the web's `mt-0.5` baseline nudge — a wrapper rather
than a style on the icon itself, so it does not depend on lucide passing `style`
through to its `Svg`. Rendered at `size={16}`, not the web's 14, per plan. No
accessibility label: the surrounding `Pressable` already labels the row.

Verified: `tsc --noEmit` exit 0 · `expo lint` clean · `npm test` 40/40 ·
`expo export --platform android` succeeded.
**Still needed, and it is the important one:** a visual pass over all seven types
against the running vendor web app. Per C4-corrected, **nothing in the toolchain
can catch a wrong or crossed-over glyph** — `tsc` proves only that the map is
exhaustive, not that `booking_confirmed` got `CircleCheck` rather than
`CircleCheckBig`. **Android only when run — iOS blocked by companion B9.**

**✅ Device-verified 2026-07-30 (Android).** Confirmed in the user's on-device pass over a build of `40defdf` — see the device-verification block at the top of this plan. iOS remains unverified and unverifiable (companion **B9**).
### I10 — iOS may clip card shadows wherever `overflow: "hidden"` shares a view  ⏸ PARKED
**Files:** `src/components/common/PrimaryButton/PrimaryButton.styles.ts:10-11`,
`src/components/settings/SettingsList/SettingsList.styles.ts:26-27`,
`src/components/dashboard/StatCard/StatCard.styles.ts:22-24`
**Discovered:** 2026-07-29, while executing batch A.

On iOS, `overflow: "hidden"` sets `clipsToBounds` (`layer.masksToBounds`), and a
layer's own shadow is drawn *outside* its bounds — so the two are mutually
exclusive on a single view. CSS has no such conflict, which is why the web's
`.sp-card` combines `overflow-hidden` and `box-shadow` freely.

**This is pre-existing, not introduced by batch A.** Two components already pair
them on the same style object: `PrimaryButton`'s `pressable` (clip + `btnPrimaryShadow`,
needed so the gradient respects the radius) and `SettingsList`'s `card` (clip +
`cardShadow`, needed so row dividers don't escape the radius). `StatCard` now makes
three, for the same structural reason — the accent bar must be clipped to the 18px
radius or it protrudes as square tabs up to 18dp wide at the top corners
(geometry: with an 18 radius the card's left boundary is at x=18 when y=0).

**Deliberately NOT fixed here.** The fix is a two-view sandwich — outer view owns
the shadow and background, inner owns the radius, border, clip and padding. Applying
that to `StatCard` alone would make it the only component in the app structured that
way while leaving the same latent issue in the other two, which is worse than a
consistent known risk. `AGENTS.md` Surgical Changes also puts a three-component
restructure outside a cosmetics batch.

**Unblock condition:** an iOS device or simulator — i.e. companion-plan **B9** (paid
Apple Developer account). Then check whether the shadow is actually absent on all
three; if it is, fix all three together in one pass. Android is unaffected
(`elevation` draws from the view outline, not clipped by overflow), which is why
nothing shows up in the Android verification below.
<!-- unblocks on B9; fix all three components together or none -->

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains — see
     plan-authoring §7. All of D1–D5 are resolved as of 2026-07-29 — no OPEN line
     remains and the gate is clear. Do not add an item with an unresolved decision
     without re-opening this gate. -->

- **D1 — Which vendor edge-accent treatment?** → **the `StatCard` urgent top bar**
  (Pending Approvals card) (resolved 2026-07-29) — user confirmed against the
  vendor dashboard. Implemented top-only per **C1**; vendor has no bottom accent
  on that card, and the top+bottom treatment (desktop nav tab strip) was not the
  target.
- **D2 — Which surface is "the main menus"?** → **the dashboard stat cards**
  (resolved 2026-07-29) — diagnosed to `StatCard.styles.ts:9`'s `minWidth: 150`
  wrapping the grid to 1-up on narrow phones (**I2**).
- **D3 — How far does the login palette copy go?** → **force dark with gold
  accents** (resolved 2026-07-29) — auth screens always render the navy gradient
  and gold primary button regardless of device theme, matching `vendor` and
  `command` exactly. Drives **I3**, and forces **I6**.
- **D4 — the stat cards "did not look like buttons". How is that half answered?** →
  **(a) accept them as non-interactive tiles** (resolved 2026-07-29) — fix the grid
  (I2) and add the urgent accent (I1) and icon chip (I8); give them **no** pressable
  affordance. Styling a non-interactive element to look pressable is an affordance
  lie that `ux-design` prohibits, and making them genuinely tappable would be a
  behaviour change on a cosmetics branch. **Consequences now binding on execution:**
  no `Pressable`, no press/ripple state, no `accessibilityRole="button"` on
  `StatCard` — it keeps `accessibilityRole="summary"`; card padding stays
  `spacing.lg` (option (c)'s tightening is rejected, preserving parity with the
  web's `p-5`); and `StatCard` therefore stays a pure display component with no
  `useStatCard.ts`. Option (b) — tappable cards routing to a filtered list — is
  **not** dropped, just out of scope; it belongs in its own plan if wanted.
- **D5 — which icon for the mobile-only "Transactions" count card?** →
  **(a) `ClipboardList`, neutral slate** (resolved 2026-07-29) — `#64748b` on
  `rgba(100,116,139,0.12)`. Reads as "a list of records" rather than a money metric,
  and the neutral tint distinguishes a count from the three coloured currency
  amounts beside it. Noted deliberately: I7 also assigns `ClipboardList` to the
  **Bookings tab** — a different surface, so no on-screen collision, but the reuse
  is intentional and recorded rather than accidental.

---

## DEFERRED / COSMETIC

- **Companion-plan B5's remaining half** — store screenshots (iPhone + Android
  phone only, per that plan's D12-A), 512×512 Play store icon, 1024×500 Play
  feature graphic, short + full descriptions. Acceptable to defer: these are
  *listing* assets, not binary assets, and are gated on submission timing, not on
  this branch. I4 unblocks them by producing the master artwork.
- **Dead Expo template assets** under `assets/images/`: `react-logo.png`,
  `react-logo@2x/@3x.png`, `expo-badge.png`, `expo-badge-white.png`,
  `expo-logo.png`, `tutorial-web.png`, `logo-glow.png`, `favicon.png`, and the
  whole `tabIcons/` directory. Verified unreferenced — `grep -rn "assets/" src/`
  returns **nothing**, and none appears in `app.json`. `favicon.png` is web-only
  and `app.json:44-47` declares `platforms: ["ios","android"]`. Acceptable to
  defer: they are inert bytes, and deleting files the current task does not touch
  is outside Surgical Changes. Flagged per AGENTS.md ("mention them instead of
  fixing them silently") — say the word and they go in I4's commit, where they are
  at least topically adjacent.
- **Radial blobs may be dropped if they cost more than they return.** If the
  `react-native-svg` blobs in I3 prove fiddly to position across aspect ratios,
  the linear gradient alone already carries the palette; the blobs are the last
  ~5% of fidelity. Ship the gradient, note the gap, move on.
- **The web app's own logo/splash** — the user explicitly said "I know this isn't
  in vendor but we'll get to that later." Not in scope.
- **Vendor's settings rows have no icons either — nothing to match.** Checked
  `vendor/components/settings/SettingsPage/SettingsPage.tsx`: it imports no lucide
  icons at all, and mobile's `SettingsList` rows are likewise text-only. Already
  consistent; **no work item**. Recorded so a later pass does not "fix" a
  non-divergence by inventing row icons the web app does not have.
- **Stat-card label and metric divergences found while matching icons — flagged,
  NOT fixed here.** These are semantic, not cosmetic, so they do not belong on a
  styling branch (AGENTS.md: mention discovered problems rather than fixing them
  silently). Worth their own item:
  - Mobile card 4 is **"Monthly Revenue"**
    (`DashboardView.tsx:66`); vendor renamed its equivalent to **"Monthly Payout"**
    with an explicit code comment that it is *net of the platform fee* and "must
    carry the same name as the Transactions page's Total Payout — the two screens
    have to reconcile" (`DashboardPage.tsx:48-50`). If mobile's
    `dashboard.service` returns gross, the mobile dashboard and the mobile
    transactions screen currently disagree with each other, and both disagree with
    web. **Needs a data check, not a rename.**
  - Mobile card 2 is **"Today's Bookings"**; vendor's is **"Today's Schedule"** and
    counts *schedules*, not bookings. Different metric, same `CalendarCheck` glyph —
    the icon is still right, the label parity is not.

---

## Execution order

Ordered by risk and dependency, not by item number.

**Safe prefix — ✅ EXECUTED 2026-07-29, machine-verified; device-verified on Android 2026-07-30:**

1. **I5** — FlashList separator. ✔ code complete — see the note on I5.
2. **I9** — notification type icons. ✔ code complete — see the note on I9.

Four files changed, all in `ezzy-vendor-mobile`; **not yet committed** (commits for
that app must be made from inside its folder). `tsc`, `expo lint`, `npm test` and
`expo export` all clean afterwards.

**Coupled batch A — ✅ EXECUTED 2026-07-29, machine-verified; device-verified on Android 2026-07-30.**
Five files changed (`theme/tokens.ts`, `StatCard.tsx`, `StatCard.styles.ts`,
`DashboardView.tsx`, `TransactionSummaryCards.tsx`). `tsc` exit 0 · `expo lint`
clean · `npm test` 40/40 · `expo export --platform android` succeeded. Surfaced one
new parked item, **I10**. Original plan text follows:

3. **I1 + I8 + I2** — all three edit `StatCard.tsx` / `StatCard.styles.ts` and
   interact: I8 restructures the body into a header row, I1 adds the absolute accent
   bar that must stay its first child, and I2's `flexBasis: "47%"` is what makes I8's
   icon chip a tight fit at 320dp. Splitting them means rewriting the same JSX up to
   three times and verifying the narrow-width case twice.
   **No longer gated — D4-a and D5-a resolved 2026-07-29.** Order within the batch:
   `tokens.ts` (`accentUrgent`) → `StatCard.styles.ts` → `StatCard.tsx` →
   `DashboardView` and `TransactionSummaryCards` callers.
4. **I7** — tab-bar icons. ✅ **EXECUTED 2026-07-29**, device-verified on Android
   2026-07-30; ran immediately after batch A as
   required, machine-verified. One file. Its Transactions→`Receipt` swap exists
   precisely so the tab stops sharing `Wallet` with the payout card I8 introduces.

**Coupled batch B — ✅ EXECUTED 2026-07-29, machine-verified; device-verified on Android 2026-07-30.**
Six files changed plus two new (`theme/brandTokens.ts`,
`AuthScreen/useAuthScreen.ts`); five components picked up the brand palette with no
edits of their own. `tsc` exit 0 · `expo lint` clean · `npm test` 40/40 ·
`expo export --platform android` succeeded. Original plan text follows:

5. **I3 + I6** — brand tokens + forced-dark auth + status-bar style, in one commit.
   Largest item; do it after the batches above so a bisect over the cosmetics is not
   tangled with it. Order within the batch: `tokens.ts` additions →
   `brandTokens.ts` → `useAuthScreen.ts` → `AuthScreen` + styles → `PrimaryButton`
   / `SignInForm` colour de-hardcoding → `StatusBar`.

**Blocked on B1 (external — needs the artwork file):**

6. **I4** — app icon, adaptive icon, splash. Independent of every item above, so B1's
   delay must not hold them; run it whenever the artwork lands.

---

## Verification

**Node is not on `PATH`** in this shell — every command needs it first
(`ezzy-vendor-mobile/AGENTS.md`, Commands):

```bash
export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH"
```

`tsc`, `expo lint` and the test suite are all clean today — **treat any output as
a regression introduced by this branch.**

| Item | Machine-verifiable | Needs a live environment |
|---|---|---|
| I1 | `tsc --noEmit`; `expo lint` | Amber bar visible on Pending Approvals **only** when count > 0; bar clipped by the 18px radius (proves `overflow: "hidden"`); both themes |
| I2 | `tsc`; `expo lint` | 2×2 grid holds at **320dp and 390dp** widths and at the **largest OS font setting** — the case that broke it |
| I3 | `tsc`; `expo lint`; `npm test`; `npx expo export --platform android` (route tree still builds; delete `dist/` after) | All **six** pre-app routes dark-gold: sign-in, forgot-password, reset-password, select-vendor, **blocked**, index. Gold button text legible. Contrast checked. Toast contrast on the dark shell |
| I4 | `npx expo-doctor` stays green; config keys resolve | `npx expo prebuild` → inspect generated asset catalogues; EAS `preview` build on a **physical Android device**; home-screen icon, themed (monochrome) icon, splash in both device themes |
| I5 | `tsc`; `expo lint` | 12dp gaps on **bookings, transactions and notifications**; **no** trailing gap above the load-more spinner or below the last row |
| I6 | `tsc`; `expo lint` | Status-bar glyphs legible on a **light-mode** device (the failing case) *and* a dark-mode one, on every auth route |
| I7 | `tsc`; `expo lint`. **No compiler backstop on icon names** — legacy aliases compile fine (C4, corrected), so a wrong glyph is visual-only | Four tab glyphs read correctly at tab-bar size, checked against vendor's sidebar; active/inactive tint still applies |
| I8 | `tsc`; `expo lint` | All **eight** cards (4 dashboard + 4 transactions) show the right glyph and tint; chip is 30dp; **at 320dp** labels wrap to at most 2 lines and the 2×2 grid still reads as a grid; both themes |
| I9 | `tsc`; `expo lint` — the exhaustive `Record<NotificationType, …>` makes a missing type a compile error | All **7** types render a distinct glyph/colour. Seed or trigger one notification per type; do not verify by reading the map |

**Cross-cutting, per `mobile-dev` §4 — every item above:** both themes, largest OS
font size, and a screen-reader pass (TalkBack) on any auth flow I3 touches.

**One icon failure mode `tsc` cannot catch.** C4's `CheckCircle` /
`CheckCircle2` → `CircleCheckBig` / `CircleCheck` crossover produces **valid code
either way** — swapping them compiles clean and only shows up as the wrong glyph on
screen. For I8's "Completed This Month" and I9's three `CircleCheck` rows,
verification must be a visual side-by-side against the running vendor web app, not a
type check and not a re-read of the table above.

**Platform gap to state on every ✅:** Android only. **Nothing on this branch can be
verified on iOS** — App Store Expo Go cannot open an SDK 57 project, so iOS needs a
paid Apple Developer account (companion-plan **B9**, procedure in
`ezzy-vendor-mobile/IOS-BUILD.md`). An Android-only verification is **not** a
completed one; say so rather than implying parity.

**Store acceptance re-check before this branch merges** (`mobile-dev` §3):
- §3.4 **app identity** — I4 is the item that clears "shipping template artwork is
  a brand and review failure". Confirm no Expo mark survives in the built binary,
  not just in `app.json`.
- §3.1 **blocked and empty states** — I3 restyles `blocked.tsx`, a screen a
  reviewer on a fresh account can land in. It must still read as real copy with a
  way forward, not a dark void.
- §3.1 **permission minimalism** — this branch adds **no** dependency and **no**
  permission. Re-confirm the merged manifest gained nothing after any
  `expo prebuild` run in I4.
- **No commit** to `ezzy-vendor-mobile` may be made from the workspace root — that
  repo's history lives in its own folder (root `AGENTS.md`).
