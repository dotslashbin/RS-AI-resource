# Vendor — component-separation audit & remediation plan

**Date:** 2026-07-10
**Scope:** `./vendor` only. Same goal as the completed command refactor
(`.plans/2026-07-07-command-component-separation-audit.md`): separate styling
(and stray logic) out of the render layer per `skills/component-separation.md`.
**Status:** ✅ DONE (2026-07-14) — all phases P0–P9 executed and verified pixel-identical (full visual suite **34/34 pass, 0-pixel diff, light + dark**; `tsc` exit 0). No behaviour or look-and-feel change. Not committed by the agent (user handles commits).

> **Hard constraint (inherited):** the refactor must **not change any UI
> behaviour, functionality, or look & feel at all.** Pixel-identical only; any
> intentional visual change needs separate approval.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.

---

## Standards inherited from the command refactor (no re-decision needed)

The user asked to take the **same approach**; these are locked, matching command:

- **D-1 = Tailwind-first** *(RESOLVED 2026-07-10 — differs from command).* Vendor's codebase norm is **Tailwind utilities + `sp-*` tokens** (many components are already clean this way), so static inline `style={{}}` moves to **Tailwind utility classes** (arbitrary values like `text-[13px]`/`px-[14px]` for exact 1:1) + the shared `sp-*`/`btn-primary`/`nav-active` classes — matching the existing components. **CSS Modules only where geometry is awkward** (e.g. the camera overlay, already done). Dynamic values stay inline (D-4). Pixel-safety comes from the visual suite, not the mechanism. *(Command used CSS Modules only because it had no Tailwind-in-components; vendor is the opposite.)*
- **D-2 = Playwright visual-regression** — a dev-only `/ui-gallery` fixture + `visual-tests/` at `maxDiffPixels: 0`, light **and** dark. Baseline from the **original** before converting; a passing run proves 0-pixel change. (Chromium is already cached from the command work; only the `@playwright/test` dev-dep needs installing in `vendor` — new-dependency gate, flagged in P0.)
- **D-3 = pilot-first, then by domain** — convert `ui/` leaves first, prove zero-diff, then proceed domain by domain.
- **D-4 = keep genuinely dynamic values inline** — data/theme/state-driven values (config colours, `dark` backgrounds, widths, `busy`/`isLoading` cursor+opacity, `isLast`/index borders, toggle state) stay inline; only **static** blocks move out. Conditional-static → class toggles.
- **D-5 = fold logic (F2) extractions into the same phase** as their component.
- **Preserve global classes:** vendor's `sp-*` helpers (`sp-card`, `sp-input`, `sp-page`, `sp-panel`, `sp-pill`, `sp-sidebar`, `sp-sub`, `sp-tabbar`, `sp-topbar`), `.btn-primary`, `.nav-active`, and the `login-*` responsive classes stay as-is; module classes carry only the previously-inline overrides.
- **Dev-only gallery guard:** `if (process.env.NODE_ENV === "production") notFound()` so the fixture never ships (as done for command).
- **Coverage honesty:** fetch-dependent branches with no DB in the fixture (smart containers, loaded states) are converted 1:1 and covered by `tsc` + build + manual correspondence, not pixel-diffed — called out per phase.

**One environment difference from command:** vendor actively uses **light/dark theming** (`next-themes` + `.dark`, `useThemeContext`), and `SettingsPage` reads `dark`. Theme-dependent values are treated as dynamic (kept inline) unless already tokenised; both themes are screenshotted.

---

## Audit method

All 40 component `.tsx` under `vendor/components/` checked against the three
layers. Signals: `grep "style={{"` per file (styling); `useState|useEffect|
useMemo|useCallback|useRef` in `.tsx` + companion-hook presence (logic).

---

## Findings

### F1 — Styling not separated: **≈292 inline `style={{}}` across 24 components**

Two components already comply (from the KYC camera work): `CameraCapture` and
`IdentityStep` have `.module.css` — **skip**. Counts by domain:

| Domain | Files (inline-style count) |
|--------|-----------------------------|
| `auth/` | **LoginPage 166**, RegisterField 6 |
| `kyc/` | **KycStatusPage 47** · CameraCapture ✅done · IdentityStep ✅done |
| `dashboard/` | GuidePanel 21, BookingTrendsCard 4, PendingApprovalsCard 2, DashboardPage 1 |
| `ui/` | StatCard 4, StatusBadge 1 · (FilterTabs/FormLabel/ModalOverlay/SearchInput = 0) |
| `schedule/` | ScheduleFormModal 4, SchedulePage 3, DayDetailPanel 3, ScheduleCalendar 2 |
| `staff/` | StaffFormModal 3, StaffCard 3, StaffStatBar 1 · (StaffPage = 0) |
| `offerings/` | OfferingCard 3, OfferingFormModal 1 · (OfferingsPage = 0) |
| `bookings/` | BookingRow 4 · (BookingsPage = 0) |
| `calendar/` | CalendarPage 5 |
| `packages/` | PackagesPage 4 |
| `profile/` | ProfilePage 1 |
| `settings/` | SettingsPage 1 |

**Why:** the skill's core styling rule; keeps the `.tsx` a pure render layer.
`LoginPage` (166 — the multi-step KYC registration flow) is ~2× command's login
and by far the largest single file.

### F2 — Logic in the render layer: **5 components own state/effects with no companion hook** (more than command)

| Component | `.tsx` hook-calls | Also has inline styles? | Fix |
|-----------|-------------------|-------------------------|-----|
| `offerings/OfferingsPage` | 11 | no | new `useOfferingsPage.ts` |
| `schedule/SchedulePage` | 7 | yes (3) | new `useSchedulePage.ts` |
| `staff/StaffPage` | 5 | no | new `useStaffPage.ts` |
| `calendar/CalendarPage` | 4 | yes (5) | new `useCalendarPage.ts` |
| `bookings/BookingRow` | 4 | yes (4) | new `useBookingRow.ts` (or confirm trivial) |

Plus a **minor**: `CameraCapture.tsx` keeps one auto-start `useEffect` (it already
delegates to `useCamera`); optional tidy to move it into the hook.

**Why:** the skill assigns state/effects/derived values to the hook; these are the
container pages that currently hold filtering/CRUD/calendar state inline.

### Non-findings (checked, not violations)
- `AppShell`, `TopBar`, `TabBar`, `NotificationPanel`, `BookingsPage`,
  `OfferingFormModal`, etc. already delegate state to hooks and/or are pure — only
  styling separation applies where they carry inline styles.
- Hookless components that merely receive handler props are fine.
- Genuinely dynamic inline values remain inline (D-4).

---

## Fix approach (identical to command)

**A. Styling → CSS Modules (1:1, pixel-identical).** Per component add
`ComponentName.module.css`; move static inline objects to named classes with
identical properties; conditional-static → two toggled classes; dynamic values
stay inline (D-4). Preserve `sp-*` / `login-*` / `btn-primary` / `nav-active`
global classes alongside the new module classes.

**B. Logic → hooks (pure relocation).** Extract the F2 pages' state/effects/derived
values into `useComponentName.ts`; the `.tsx` becomes render-only. Inputs/outputs
unchanged ⇒ no behaviour change.

**Proof each phase:** `tsc --noEmit` (exit 0) + `next build`-safe + the Playwright
suite at 0-pixel diff (light + dark) for that phase's gallery modes.

---

## Phases (pick any; each is self-contained after P0)

> Recommended order is P0 → P1 → … → P9 (leaf-first, finale last), but you can
> point me at any phase. **P0 must run before the first conversion phase** (it
> installs the harness + captures baselines).

- **P0 — Harness setup ✅ DONE (2026-07-10)**
  - [x] Installed `@playwright/test` (dev-dep) in `vendor` (chromium reused from command's global cache)
  - [x] `playwright.config.ts` (pixel-exact `maxDiffPixels: 0`, animations off; `next dev --port 3100` webServer; 900×1200)
  - [x] Dev-only-guarded `app/ui-gallery/page.tsx` (`notFound()` in production) + `visual-tests/pilot.spec.ts`. **Theme is forced onto `<html>` via a `useEffect`** (overrides next-themes/system) so light/dark are deterministic.
  - [x] First mode `grid` renders the `ui/` leaf components; **baseline captured (grid light+dark), deterministic compare run 2/2 zero-diff, `tsc` exit 0.** Harness proven end-to-end.
  - [x] `vendor/.gitignore` already carries the Playwright run-artifact block (done earlier).
  - Mock data + fixed-props-for-fetching-containers will be added per phase as modes grow.

- **P1 — Pilot: `ui/` ✅ DONE (2026-07-10).** Only `StatusBadge` (badge chrome → `text-[11px] font-semibold px-[9px] py-[3px] rounded-[99px]`; `bg`/`color` stay inline) and `StatCard` (urgent bar → `bg-[linear-gradient(90deg,#f59e0b,#f97316)]`; value size → conditional `text-[18px]`/`text-[26px]`; icon `bg`/`color` stay inline) had static inline styles. `FilterTabs`/`FormLabel`/`SearchInput`/`ModalOverlay` were already Tailwind-clean — untouched. **Verification: `tsc` exit 0; `grid` light+dark 0-pixel diff** (baseline from P0).
- **P2 — `layout/` ✅ DONE (2026-07-10).** Only `Sidebar` had inline styles — its 2 brand gradients → `bg-[linear-gradient(135deg,#2563eb,#4f46e5)]` (+ `shadow-[0_4px_12px_rgba(37,99,235,0.4)]` on the logo). `AppShell`, `TopBar`, `TabBar`, `NotificationPanel`, `NotificationItem` all already Tailwind-clean (0 inline) — untouched. Added a `sidebar` gallery mode. **Verification: `tsc` exit 0; `sidebar` light+dark 0-pixel diff** (baseline from the original).
- **P3 — `dashboard/` ✅ DONE (2026-07-11).** `GuidePanel` (21 → full Tailwind; per-item colours stay inline), `DashboardPage` show-guide button, `BookingTrendsCard` svg `overflow-visible`, `PendingApprovalsCard` initials static props. Dynamic kept inline (item colours, TC/TB chart colours, avatar bg). Added `dashboard` gallery mode (real DashboardPage w/ mock bookings; guide visible). **Verification: `tsc` exit 0; `dashboard` light+dark 0-pixel diff.**
- **P4 — `offerings/` ✅ DONE (2026-07-11).** `OfferingCard` static font props → `text-[12px]`/`text-[16px]` (category colours stay inline). `OfferingFormModal` already compliant (its 1 inline is the dynamic toggle transform). **F2:** extracted `OfferingsPage` state/fetch/CRUD into `useOfferingsPage(vendorId)` — `.tsx` now render-only. Added `offerings` gallery mode (OfferingCards incl. delete-confirm branch). **Verification: `tsc` exit 0; `offerings` light+dark 0-pixel diff.**

> **Two Tailwind-mapping gotchas the visual suite caught (both fixed) — apply to remaining phases:**
> 1. **`rounded-lg` ≠ 8px here** — shadcn config maps it to `var(--radius)` = **10px** (`rounded-md` = 8px, `rounded-sm` = 6px). Use `rounded-[Npx]` for exact radii.
> 2. **Named text sizes inject a line-height** (`text-xs` → `line-height: 1rem`), but inline `fontSize` leaves it `normal`. For 1:1, use **arbitrary `text-[Npx]`** (no line-height injected) or pair the named size with the matching `leading-*`.
- **P5 — `schedule/` + `calendar/` ✅ DONE (2026-07-11).** `DayDetailPanel` chip + `CalendarPage` event-dot/status-chip static props → arbitrary Tailwind. `ScheduleCalendar`/`ScheduleFormModal` already compliant (all inline is selection-dynamic). **F2:** `useSchedulePage` (composes existing `useSchedule` + page state/CRUD) and `useCalendarPage` (month/day state + derived selected-day items). Gallery `schedule` (ScheduleCalendar + DayDetailPanel, day 23 selected) + `calendar` modes, plus a `calendar-day` test that clicks day 23 to reveal the detail section. **Verification: `tsc` exit 0; 0-pixel diff.**
- **P6 — `staff/` + `bookings/` ✅ DONE (2026-07-11).** `StaffCard` avatar → Tailwind `bg-[linear-gradient…] shadow-[…]`, spec-chip + stat-value static props split. `BookingRow` initials/code-chip/status-chip static props split. `StaffFormModal`/`StaffStatBar`/`BookingsPage` already compliant. **F2:** `useStaffPage`, `useBookingRow`. Gallery `staff` (StatBar + cards incl. delete-confirm) + `bookings` (rows incl. pending/actions) modes. **Verification: `tsc` exit 0; 0-pixel diff.**
- **P7 — misc pages ✅ DONE (2026-07-11).** Only `ProfilePage`'s hero avatar (static gradient+shadow) needed converting → Tailwind `bg-[linear-gradient…] shadow-[…]` (same pattern already pixel-verified on Sidebar/StaffCard; ProfilePage is fetch-gated → covered by tsc + precedent). `PackagesPage` (`@ts-nocheck`, empty deferred list — its inline styles are dynamic **and** unreachable), `SettingsPage` (only inline is the dynamic toggle transform), and `ProfilePage.helpers` were already compliant. **Verification: `tsc` exit 0.**
- **P8 — `kyc/KycStatusPage` [47] ✅ DONE (2026-07-11).** Full-screen hardcoded-dark branded surface → **CSS Module** (`KycStatusPage.module.css`, 1:1 copy) per D-1's awkward-surface exception (matches command's LoginPage; safer + inspection-verifiable than blind Tailwind arbitrary for a fetch-gated component). 47 → 6 dynamic-only inline (removed opacity/strike, resubmit button state, status-icon bg/border/colour). Added a `kycstatus` gallery mode; it's fetch-gated so it renders the **loading shell** (page/card/loader/sign-out) — pixel-covered against the original baseline. The rejected/approved/review branches are CSS 1:1 + tsc-covered (coverage gap, same class as command's KycStatusPage). CameraCapture/IdentityStep already compliant (own modules from the KYC camera work). **Verification: `tsc` exit 0; visual suite 19/19 pass, ZERO pixel diff.**
- **P9 — `auth/LoginPage` [166] + `RegisterField` [6] ✅ DONE (2026-07-14).** The finale. Both converted to **CSS Modules** (`LoginPage.module.css`, `RegisterField.module.css`) per D-1's awkward-surface exception (a large hardcoded-dark branded surface, same call as command's LoginPage + vendor's KycStatusPage — safer and inspection-verifiable vs. blind Tailwind arbitrary across ~170 blocks). `LoginPage` 166 → 6 dynamic-only inline (progress-seg bg, KYC type-card bg/border ×2, step-6 back/submit `isLoading` cursor+opacity); `RegisterField` 6 → 0. Preserved the global `login-left`/`login-divider`/`login-right`/`login-mobile-toggle` responsive classes untouched. Added gallery modes for every reachable view: `login`, `loginforgot`, `loginsent`, `loginreset`, `loginregister` (register step 1), `loginselect`, `loginregsent`, plus the bespoke `login-mobile-info` test (narrow viewport → toggle). **Coverage gap:** register **steps 2–6** are reachable only by interaction (no query-param drive) so they're CSS-1:1 + `tsc`-covered, not pixel-diffed — same class as command's multi-step finale. **Verification: `tsc` exit 0; full visual suite 34/34 pass, ZERO pixel diff, light + dark.**
  - *Bug caught by the suite (fixed):* `.stepContinueFull` (the full-width step-1 "Continue" button) was referenced in the JSX but missing from the module, so the button rendered unstyled — 16 520-px diff on `loginregister` only. Root-caused by measuring element geometry (identical → not a layout shift → a color/fill diff) then reading the actual screenshot (button had no gold fill). Added the class 1:1 from the original inline style; suite went green.

Each conversion phase ends with: create `.module.css` files → move static styles → (fold F2) → `tsc` → add gallery mode(s) + baseline (from original, captured at phase start) → convert → visual suite 0-pixel diff.

---

## Per-phase verification

| Check | Kind |
|-------|------|
| `tsc --noEmit` passes in vendor | machine |
| `next build` succeeds (CSS module resolution) | machine |
| Visual diff = 0 px, light + dark, for the phase's modes | machine (Playwright) |
| Phase `.tsx` files free of static `style={{}}` and (F2) of `useState`/`useEffect`/derived logic | review |
| No behaviour change (nav, forms, modals, toggles, camera) | manual |

---

## Notes / risks

- **Volume:** ≈292 inline blocks; `LoginPage` (166) and `KycStatusPage` (47)
  dominate — save LoginPage for last (P9), like command's finale.
- **More F2 than command** — 5 container pages need hooks; these are pure
  relocations but touch page-level state, so verify flows still work.
- **Theming:** both light + dark are screenshotted since vendor uses `.dark`
  actively; theme-conditional values stay inline.
- **Fetch-dependent coverage:** container pages (Offerings/Schedule/Staff/Bookings)
  fetch from Supabase; in the fixture they'll show empty/loading, so leaf
  components are rendered with fixed props and the container branches are
  tsc/build/1:1-covered (documented per phase, as with command's AppShell/KycPanel).
- **Shared style constants:** if vendor has JS style-constant equivalents of
  command's `PB`/`AN`, they'll be replicated into module classes and flagged for a
  later shared-CSS consolidation.
- **Harness is reusable** for future vendor cleanup rounds (kept dev-only-guarded).
- **Not committed by the agent** — the user handles testing/commits/branches.
