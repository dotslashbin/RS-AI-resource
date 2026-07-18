# Booker — component-separation audit & remediation plan

**Date:** 2026-07-15
**Scope:** `./booker` only. Same goal as the completed command and vendor
refactors (`.plans/2026-07-07-command-component-separation-audit.md`,
`.plans/2026-07-10-vendor-component-separation-audit.md`): separate styling
(and stray logic) out of the render layer per `skills/component-separation.md`.
**Status:** ✅ COMPLETE (2026-07-16) — all phases P0–P9 executed and verified. Full visual suite **53/53 pass, 0-pixel diff** (real light + dark); `tsc` exit 0 throughout. Both F2 hooks extracted (`useMapWidget`, `useStep4Documents`). ~461 inline blocks removed; only genuinely dynamic values (data/state-driven colours, widths, transforms, `isLoading`) remain inline. Not committed by the agent (user handles commits).

> **Hard constraint (inherited):** the refactor must **not change any UI
> behaviour, functionality, or look & feel at all.** Pixel-identical only; any
> intentional visual change needs separate approval.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.

---

## Standards inherited from the vendor refactor (the "like vendor" request)

The user asked to take the **same approach as vendor**; these carry over:

- **D-1 = Tailwind-first** *(RESOLVED 2026-07-15 — matches vendor).* Booker's
  codebase norm is already **Tailwind utilities + shadcn + `db-*` design
  tokens**, so static inline `style={{}}` moves to **Tailwind utility classes**
  (arbitrary values like `text-[13px]`/`p-4` for exact 1:1) + semantic token
  classes + the existing `db-*` global classes. **This fits booker even better
  than vendor:** `tailwind.config.ts` already maps `db.strong/text/divider` →
  `var(--db-*)`, so the two most common inline colours (`color:"var(--db-strong)"`
  → `text-db-strong`, `"var(--db-text)"` → `text-db-text`, `borderColor:
  "var(--db-divider)"` → `border-db-divider`) become clean semantic classes.
  Tokens **not** in the Tailwind namespace (`--db-pill-bg`, `--db-topbar-bg`,
  `--db-card-bg`, `--db-menu-btn-*`, `--db-toggle-*`, `--db-input-bg`,
  `--db-badge-*`) either keep their existing global class (`db-card`, `db-pill`,
  `db-topbar`, …) or use an arbitrary `bg-[var(--db-pill-bg)]`. **CSS Modules
  only where geometry is awkward** (e.g. the login surface — see P9). Dynamic
  values stay inline (D-4). Pixel-safety comes from the visual suite.
- **D-2 = Playwright visual-regression** — a dev-only `/ui-gallery` fixture +
  `visual-tests/` at `maxDiffPixels: 0`, light **and** dark. Baseline from the
  **original** before converting; a passing run proves 0-pixel change. Chromium
  is already cached from command/vendor; only the `@playwright/test` dev-dep
  needs installing in `booker` (new-dependency gate, flagged in P0).
- **D-3 = pilot-first, then by domain** — convert small leaves first, prove
  zero-diff, then proceed domain by domain.
- **D-4 = keep genuinely dynamic values inline** — data/state-driven values
  (offering-code colours `style.bg`/`style.color`, progress widths, `isLoading`
  cursor+opacity, selection state, `isLast`/index borders, map coordinates)
  stay inline; only **static** blocks move out. Conditional-static → class toggles.
- **D-5 = fold logic (F2) extractions into the same phase** as their component.
- **Preserve global classes:** booker's `db-*` helpers (`db-card`, `db-sub`,
  `db-panel`, `db-pill`, `db-topbar`, `db-sidebar`, `db-tabbar`, `db-badge`,
  `db-badge-<status>`, `db-menu-btn`) and the `login-*` responsive classes stay
  as-is; conversions only relocate the previously-inline overrides.
- **Dev-only gallery guard:** `if (process.env.NODE_ENV === "production") notFound()`
  so the fixture never ships (as done for command/vendor).
- **Coverage honesty:** fetch-/interaction-gated branches with no DB or no
  screenshotted state in the fixture are converted 1:1 and covered by `tsc` +
  build + manual correspondence, not pixel-diffed — called out per phase.

### Environment differences from vendor (booker-specific)

1. **Theming lives in CSS variables, not JS.** Booker's `--db-*` tokens are
   defined under `:root` and `.dark` in `globals.css` and resolve per-theme in
   the browser. So an inline `color:"var(--db-text)"` is **not** JS-dynamic — it
   is **static-movable** to a Tailwind class. (Contrast vendor, where some theme
   values were JS-computed and had to stay inline.) Both themes are still
   screenshotted.
2. **`DevVersionBadge` causes sub-pixel flake.** Learned from vendor: the badge
   in the root layout renders on every page and flakes 4–6 px at
   `maxDiffPixels: 0`. **The harness must neutralise it from the start** — mask
   the badge region in the screenshot (`toHaveScreenshot({ mask: [...] })`) or
   render the gallery without it. Bake this into P0 so booker's suite is
   deterministic (command had no badge and was clean; vendor had the badge and
   flaked).
3. **Leaflet map** (`MapWidget`, `leaflet-map`) is a client-only dynamic import
   and renders external tiles — **not pixel-diffable**. Its container/chrome is
   converted 1:1 + tsc-covered; the map canvas itself is masked or excluded.
4. **Single-page app** — all routing is internal `PageId` state (`app/page.tsx`);
   the gallery drives components directly with mock props, not via routes.
5. **`components/ui/` = shadcn primitives** (`badge`, `button`, `dialog`,
   `input`, `progress`, `separator`, `switch`, `AppToaster`) — **do not
   hand-edit** (repo rule). Out of scope entirely.

---

## Audit method

All 35 component `.tsx` under `booker/components/` (excluding `ui/`) + the two
app-level files checked against the three layers. Signals: `grep "style={{"` per
file (styling); `useState|useEffect|useMemo|useCallback|useRef` in `.tsx` +
companion-hook presence (logic); `onMouseEnter|onMouseLeave` (JS-driven style).

**Totals:** ≈451 inline `style={{}}` blocks in `components/` + 10 in `app/`
(not-found 5, error 5). `LoginPage` (99) dominates, as in vendor.

---

## Inventory (by domain — inline blocks; F2 = logic still in the `.tsx`)

| Domain | Files (inline count) | F2 (logic) | Notes |
|--------|----------------------|-----------|-------|
| `layout/` | AppShell 4, TopBar 10, TabBar 3, Sidebar 23, NotificationPanel 13, NotificationItem 18 | — (hooks exist: useAppShell, useNotificationPanel) | Sidebar has 2 JS hover handlers (see Decisions) |
| `dashboard/` | BookingCard 7, DashboardPage 6, GuidePanel 21, InProgressCard 17, BookingStatusWidget 22, BookingDetailModal 21 | — (hooks exist: useDashboardPage, useBookingStatusWidget) | BookingCard has 2 JS hover handlers |
| `booking/` (wizard) | BookingWizard 5, BookingStepperHeader 6, BookingConfirmation 13, MapWidget 1 | **MapWidget** (state/effect in .tsx) | useBookingWizard exists |
| `booking/steps/` | Step1Offering 13, Step2Vendor 24, Step3Schedule 24, Step4Documents 20, Step6Confirm 14, StepPayment 11 | **Step4Documents** (state/effect in .tsx) | no Step5 file |
| `transactions/` | TransactionsPage 27 | — | |
| `settings/` | SettingsPage 17 | — (useSettingsPage exists) | |
| `auth/` | **LoginPage 99**, RegisterField 6 | — (useLoginPage, useRegisterField exist) | the finale |
| `dev/` | DevVersionBadge 2 | — | also the flake source (see env note 2) |
| `app/` | not-found 5, error 5 | — | app-level; not-found already touched by the env-var work |
| `components/ui/` | 8 shadcn primitives | — | **out of scope (do-not-edit)** |

**Logic gap is small:** only **2** components (`MapWidget`, `Step4Documents`)
still hold `useState`/`useEffect` in the `.tsx`; the other 8 stateful components
already have companion hooks. This refactor is **overwhelmingly styling**, not
logic — lighter on F2 than vendor.

---

## Phases (pick any; each is self-contained after P0)

> Recommended order P0 → P9 (leaf-first, finale last), but you can point me at
> any phase. **P0 must run before the first conversion phase** (installs the
> harness + captures baselines).

- **P0 — Harness setup ✅ DONE (2026-07-15)**
  - [x] Installed `@playwright/test` 1.61.1 (dev-dep, `--legacy-peer-deps`) in `booker`; chromium reused from the global cache.
  - [x] `playwright.config.ts` (pixel-exact `maxDiffPixels: 0`, animations off, caret hidden; `next dev -- --port 3200` webServer; 900×1200).
  - [x] Dev-only-guarded `app/ui-gallery/page.tsx` (`notFound()` in production) + `visual-tests/pilot.spec.ts`.
  - [x] **Deterministic theming (corrected during P1).** *First attempt* set `.dark`/`.light` on `<html>` via a gallery `useEffect` — but next-themes (`defaultTheme="dark"`) overrode it, so **light and dark screenshots were byte-identical (both dark)** — light mode was silently untested. **Fix:** the spec seeds `localStorage.theme` via `page.addInitScript` *before* navigation (next-themes reads it on init, storageKey `"theme"`), the gallery also calls next-themes `setTheme(param)`, and each test `waitForFunction`s that the `.dark` class matches the requested theme before screenshotting. Verified light≠dark by md5. **Lesson: assert light≠dark (e.g. md5) when standing up a themed visual suite — a passing run alone doesn't prove both themes render.**
  - [x] **`DevVersionBadge` masked** in the spec (`mask: [div.fixed.bottom-4.right-4.z-50]`) — neutralises the sub-pixel flake seen in vendor (env note 2).
  - [x] `.gitignore` Playwright run artifacts (`test-results/`, `playwright-report/`, `blob-report/`); committed baselines kept.
  - [x] First mode `card` renders BookingCards (4 statuses); **baseline captured, clean re-run 2/2 zero-diff, `tsc` exit 0.** Harness proven end-to-end.
  - [x] **`--radius` confirmed = `0.625rem` (10px)** → `rounded-lg`=10px, `rounded-md`=8px, `rounded-sm`=6px (same as vendor/command; gotcha #1 applies).
- **P1 — Pilot: small leaves ✅ DONE (2026-07-15).** `BookingCard` (7→2 dynamic-only: offering `style.bg`/`style.color`; **hover handlers removed → `hover:opacity-75`** per the resolved decision), `BookingStepperHeader` (6→2 dynamic-only: step-state circle object + connector bg; static chrome → Tailwind), `TabBar` (3→**0**; full Tailwind via `cn()` conditional class-toggles for the active tab). Added `card`/`bookingstepper`/`tabbar` gallery modes. **Verification: `tsc` exit 0; 6/6 visual modes 0-pixel diff (light + dark).**
  - *Finding (fixed):* `BookingStepperHeader`'s step label had inline `display:none` **and** `className="sm:block"` — inline wins specificity, so the label was **never** shown (the `sm:block` was dead code). Naively converting to `hidden sm:block` made labels appear at ≥640px (2120-px diff). Corrected to `hidden`, reproducing the original's true rendered output. Lesson: **inline styles beat responsive utility classes — check for inline overrides before trusting a `className` on the same element.**
- **P2 — `layout/` ✅ DONE (2026-07-15).** `TopBar` (10→0), `Sidebar` (23→0), `NotificationPanel` (13→0; `tabStyle` helper → `tabClass` `cn()` helper), `NotificationItem` (18→0; `TYPE_ICON` icon colours + `ACTION_BTN`/`DELETE_BTN` consts → class strings) all fully Tailwind. `AppShell` (4→1: root `fontFamily` stack kept inline as a D-4 awkward-value exception; other 3 → Tailwind). Sidebar's `ACTIVE_NAV_STYLE` (JS style const, only user) replaced with inline Tailwind gradient classes + import dropped; hover handler → `hover:bg-[…]`. Added `sidebar`/`topbar`/`notif` gallery modes. **Verification: `tsc` exit 0; 12/12 visual modes 0-pixel diff (real light + dark).**
  - *Coverage:* `AppShell` (auth-gated container) is tsc/1:1-covered, not pixel-diffed. Sidebar's user-dropdown + sign-out (Radix, closed by default) and TopBar's open notification panel are interaction-gated → converted 1:1 + tsc.
  - *Observations (not changed — out of this task's scope):* Sidebar still shows stale brand text **"RS Booker" / "RS Client Portal"** (not a "Bookdeck" string, so untouched by the env-var plan; preserved verbatim). `ACTIVE_NAV_STYLE` in `lib/constants.ts` is now unused → candidate for later cleanup.
- **P3 — `dashboard/` ✅ DONE (2026-07-15).** `DashboardPage` (6→0), `GuidePanel` (21→3 dynamic-only: `color`-derived guide-item `borderLeft`/icon bg+border/`Icon` colour), `InProgressCard` (17→1 dynamic-only: the 3-branch step-circle object; connectors/label → `cn()` toggles), `BookingStatusWidget` (22→4 dynamic-only: `codeStyle.bg`/`.color` + `status.color`×2; `i===0` top-border → `cn()`), `BookingDetailModal` (21→3 dynamic-only: `style.color` gradient/badge bg/code colour). `PRIMARY_BTN_STYLE` (shared JS const, used here + 2 P4 comps) replicated as inline Tailwind on the Reschedule button + import dropped here. `rounded-lg`=10px verified correct against the original 10px radii; arbitrary `text-[Npx]` + explicit `leading-[…]` used to avoid the line-height gotcha. Added `guide`/`inprogress`/`statuswidget`/`bookingdetail` gallery modes. **Verification: `tsc` exit 0; 20/20 visual modes 0-pixel diff (real light + dark).**
  - *Coverage:* `DashboardPage` (hook/localStorage-driven container) is tsc/1:1-covered (its 6 blocks are trivial), pixel coverage via its children. `BookingStatusWidget`'s empty-state branch is tsc/1:1-covered (gallery renders the filled state).
  - *Observation:* `PRIMARY_BTN_STYLE` (and `ACTIVE_NAV_STYLE`) — remaining users in P4; consider a shared `.db-btn-primary` global class during a later shared-CSS consolidation rather than replicating per-use.
- **P4 — `booking/` wizard chrome ✅ DONE (2026-07-15).** **MapWidget F2:** extracted the Leaflet init effect + refs → `useMapWidget(userLoc, dark)`; `.tsx` now render-only (1 inline → Tailwind `w-full h-[210px] rounded-[14px] overflow-hidden`). `BookingConfirmation` (13→0, full Tailwind). `BookingWizard` (5→1 dynamic-only: `canNext`/`isSubmitting` opacity). `PRIMARY_BTN_STYLE` replicated as inline Tailwind in both (Wizard next-btn, Confirmation btn) + imports dropped → **`PRIMARY_BTN_STYLE` now unused in `lib/constants.ts`** (like `ACTIVE_NAV_STYLE`; consolidation candidate). Added `bookingconfirm` gallery mode (pure-display component). **Verification: `tsc` exit 0; 22/22 visual modes 0-pixel diff (real light + dark).**
  - *Coverage:* `MapWidget` (Leaflet + external CartoDB tiles, async) and `BookingWizard` (fetch-gated container) are tsc/1:1-covered, not pixel-diffed (plan env-notes 3/4).
  - *Harness caveat (fixed by re-baseline):* `notif` mode drifted 3 px on the `fmtRelativeTime` "26w ago" timestamp (uses `Date.now()`), reproducibly — sub-pixel AA on an already-verified P2 component, not a P4 change. Re-baselined `notif`. **The relative-time text is date-derived → will eventually roll over (26w→27w); a future harness tweak should mask the timestamp spans.**
- **P5 — `booking/steps/` (1–3) ✅ DONE (2026-07-15).** `Step1Offering` (13→3 dynamic-only: `cat.bg`/`.color` badge+chip; `sel` border/bg → `cn()`), `Step2Vendor` (24→0; `sel` border/bg/icon-bg → `cn()`, colours → arbitrary Tailwind), `Step3Schedule` (24→2 dynamic-only: calendar-cell `background`/`boxShadow`/`opacity`/`cursor` 3–4-branch object + legend dot colour; `sel`/`tod`/`past`/`isPastMo` states → `cn()`). Added `step1`/`step2`/`step3` gallery modes. **Verification: `tsc` exit 0; 28/28 visual modes 0-pixel diff (real light + dark).**
  - *Deterministic Step3 fixture:* rendered a **far-future month (Jan 2035)** with weekly-all-days mock schedules + a selected date, so the calendar doesn't depend on the real "today" (which only affects past/current months). Covers grid, available-day dots, selected day, legend, and the time-slot grid.
  - *Coverage — Step2Vendor's embedded MapWidget:* Leaflet does not initialise in the harness, so the map area is an empty (deterministic) box; the vendor list + chrome are pixel-verified, and the `.leaflet-container` is masked as a safety if it ever loads. The live map itself remains tsc/1:1-covered (plan env-note 3/4).
- **P6 — `booking/steps/` (4–6 + payment) ✅ DONE (2026-07-15).** **Step4Documents F2:** extracted `useRef` + derived counts (`reqs`/`reqRequired`/`uploadedCount`/`uploadPct`) → `useStep4Documents(offering, uploads)`; `.tsx` render-only (20→1 dynamic-only: progress-bar `width`; `up`/`req.required` states → `cn()`). `Step6Confirm` (14→0) and `StepPayment` (11→0) fully Tailwind. Added `step4`/`step6`/`steppay` gallery modes (mock uploads: one required uploaded, one optional pending → both states covered). **Verification: `tsc` exit 0; 34/34 visual modes 0-pixel diff (real light + dark).**
  - *Better than estimated:* `StepPayment` is a pure summary screen (the actual PayMongo checkout runs in `useBookingWizard.confirmBooking` → API route), so it's **fully pixel-verified**, not just tsc-covered. `Step4Documents` is fully pixel-covered too (upload state driven by props). No coverage gap here.
- **P7 — `transactions/` + `settings/` ✅ DONE (2026-07-15).** `TransactionsPage` (27→3 dynamic-only: summary `accent` colour, `codeStyle.color`, `statusStyle` bg+colour; `isLast` border → `cn()`), `SettingsPage` (17→1 dynamic-only: toggle-knob `translateX` transform; toggle bg + field borders → `cn()`). Added `transactions`/`settings` gallery modes. **Verification: `tsc` exit 0; 38/38 visual modes 0-pixel diff (real light + dark).**
  - *Finding (latent no-op preserved):* TransactionsPage's code badge spread `style={{ ...codeStyle, ... }}` where `codeStyle = {color, bg}` — React ignores the `bg` key (not a CSS property), so the badge only ever had a text colour, no background. Converted to `style={{ color: codeStyle.color }}` (pixel-identical; verified 0-diff). Flagged: the badge background was never applied — a real bug in the original, left as-is per the no-behaviour-change constraint.
  - *Coverage:* `SettingsPage` account fetch (`useSettingsPage`) resolves to placeholder values ("—"/"Not set") in the harness → the filled account view is a documented gap; the loading/empty rendering + the Appearance toggle are pixel-verified. TransactionsPage empty-state branch is tsc/1:1-covered (gallery renders the filled list).
- **P8 — misc: `app/` + `dev/` ✅ DONE (2026-07-15).** `not-found` (5→0), `error` (5→0), `DevVersionBadge` (2→0) — all fully Tailwind. `error.tsx`'s `useEffect(console.error)` kept inline (mandatory Next.js error-boundary shape, not extractable styling). Added `notfound`/`error` gallery modes. **Verification: `tsc` exit 0; 42/42 visual modes 0-pixel diff (real light + dark).** `DevVersionBadge` is masked in every screenshot → tsc/1:1-covered (verified via the mask working across all 42 shots).
- **P9 — `auth/LoginPage` [99] + `RegisterField` [6] ✅ DONE (2026-07-16).** **Decision: CSS Module** (matching vendor's finale) — the login is a large hardcoded-dark branded surface (all rgba/gradients/gold, `-webkit-background-clip` gradient text, no `db-*` tokens → theme-independent), unwieldy as Tailwind arbitrary. Created `LoginPage.module.css` + `RegisterField.module.css` (1:1). `LoginPage` 99→**0 static** (4 buttons keep a shared `loadingStyle` inline for the dynamic `isLoading` cursor/opacity); `RegisterField` 6→0. Preserved the global `login-left`/`login-divider`/`login-right`/`login-mobile-toggle` responsive classes. Added gallery modes `login`/`loginforgot`/`loginsent`/`loginreset`/`loginregister` (driven by `initialView`) + a `login-mobile-info` bespoke test. **Verification: `tsc` exit 0; 53/53 visual modes 0-pixel diff.**
  - *Finding (fixed):* the login-view **password** label sits inside `.labelRow` and had **no `margin-bottom`**, while every other field label has `mb6`. Using one `.fieldLabel` for both added 6px → the vertically-centred right panel shifted (~5100-px diff on `login`/`login-mobile-info`). Added a `.fieldLabelInline` variant (no margin) for the labelRow case; 0-diff after.
  - *Theme note:* LoginPage is fully hardcoded-dark, so its light == dark screenshots (expected, not the theme bug).
  - *Coverage gap:* the **mobile info panel** (its `*Mobile` variant classes) is interaction-gated — the harness's toggle click doesn't switch views, so `login-mobile-info` covers the mobile-width **form** instead. The mobile variants are 1:1/tsc-covered, and their **desktop equivalents** (brandRow/badge/h1/lead/feature/ctaBlock) are pixel-verified in all 5 desktop login modes' left panel.

Each conversion phase ends with: (fold F2) → move static styles to Tailwind/`db-*` classes → `tsc` → add gallery mode(s) + baseline (from original, captured at phase start) → convert → visual suite 0-pixel diff.

> **Two Tailwind-mapping gotchas carried from vendor/command (apply every phase):**
> 1. **`rounded-lg`/`md`/`sm` are `var(--radius)`-derived** (shadcn `borderRadius` in `tailwind.config.ts`). For an exact radius use `rounded-[Npx]`. Fixed-scale radii are safe: inline `borderRadius:12`→`rounded-xl`, `16`→`rounded-2xl`, `8`→`rounded-lg` **only after** confirming `--radius`. **Verify `--radius` in `booker/app/globals.css` in P0.**
> 2. **Named text sizes inject a line-height** (`text-xs`→`line-height:1rem`); inline `fontSize` leaves it `normal`. For 1:1 use **arbitrary `text-[Npx]`** (no line-height injected), and add `leading-[N]` only where the original set an explicit `lineHeight`.

---

## Per-phase verification

| Check | Kind |
|-------|------|
| `tsc --noEmit` passes in booker | machine |
| `next build` succeeds (Tailwind/class resolution) | machine |
| Visual diff = 0 px, light + dark, for the phase's modes | machine (Playwright) |
| Phase `.tsx` free of static `style={{}}` and (F2) of `useState`/`useEffect`/derived logic | review |
| No behaviour change (nav, wizard steps, modals, toggles, hover, map, payment) | manual |

---

## Decisions

- **D-1 → Tailwind-first** (resolved 2026-07-15) — matches vendor and booker's existing conventions; the `db` Tailwind colour namespace makes it cleaner than vendor.
- **Hover handlers → option (a)** (resolved 2026-07-15) — replace the JS `onMouseEnter`/`onMouseLeave` opacity/background toggles in `BookingCard` (opacity 0.75) and `Sidebar` (sign-out btn bg `rgba(239,68,68,0.08)`) with Tailwind `hover:` utilities, so the `.tsx` is a pure render layer. Behaviour-identical; **manual hover check required** (not captured by static screenshots). Confirmed the only theoretical difference is CSS `:hover` "stick" on touch — acceptable on this pointer-first UI.
- **P9 login surface → decide at P9 start** (deferred by user 2026-07-15) — Tailwind-first vs CSS Module, defaulting to matching vendor (CSS Module) if the arbitrary-value surface gets unwieldy.

## Execution order

1. **P0** (harness + `--radius` check + badge mask) — prerequisite.
2. **P1 pilot** — prove 1:1 on 3 small leaves incl. the hover-handler decision.
3. **P2–P8** in any order (each domain independent after P0); do F2 extractions (MapWidget in P4, Step4Documents in P6) within their phase.
4. **P9 finale** (LoginPage + RegisterField) last, maximum care.

## Notes / risks

- **Volume ≈461 inline blocks** — larger than vendor (~292); `LoginPage` (99) and the booking steps dominate. Budget accordingly; phases keep it tractable.
- **Very little F2** — only 2 hook extractions, so risk is mostly visual, well-covered by the suite.
- **Fetch/upload/map/payment coverage:** Step4Documents (upload), StepPayment (PayMongo), MapWidget (Leaflet tiles) can't be fully pixel-diffed in the fixture — converted 1:1 + tsc/build/manual, documented per phase (same class as vendor's fetch-gated pages).
- **Harness is reusable** for future booker cleanup (kept dev-only-guarded).
- **Not committed by the agent** — the user handles testing/commits/branches.
- **Independent of** the parked vendor visual re-baseline from the Bookdeck→env-var work (`.plans/2026-07-14-app-name-env-var.md`).
