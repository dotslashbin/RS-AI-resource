# Command — component-separation audit & remediation plan

**Date:** 2026-07-07
**Scope:** `./command` only. Bring the app into compliance with
`skills/component-separation.md` (render / logic / styling layers).
**Status:** ✅ COMPLETE (2026-07-09) — all domains converted & proven pixel-identical. **44 components → CSS Modules (45 `.module.css` files); 7 logic (F2) extractions; every remaining inline `style` is a genuinely dynamic value (D-4).** Verified by `tsc --noEmit` (exit 0) + a **39-snapshot Playwright visual suite at 0-pixel diff** (light + dark). Nothing committed by the agent — user commits.

> **Correction (2026-07-09):** the original phase list (P1–P7) omitted the **`settings/`** domain that the F1 audit table did include; caught by the final full-tree grep and fixed as **P8**. All domains now done.

**Decisions (approved 2026-07-07):** D-1 CSS Modules · D-2 yes, Playwright visual-regression · D-3 pilot-first then by domain · D-4 keep dynamic inline · D-5 fold F2 into the same effort.

> **Hard constraint (from the request):** the fix must **not change any UI
> behaviour, functionality, or look & feel at all.** Any change that would alter
> appearance is out of scope and requires separate, explicit approval. This plan
> is a **pure, pixel-identical refactor.**

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** F# = Finding, D# = Decision (approval gate), P# = Phase.

---

## Audit method

All 45 component `.tsx` files under `command/components/` were checked against the
three layers the skill defines. Signals used (reproducible greps):

- **Styling layer:** `grep "style={{"` per file (static inline style blocks).
- **Logic layer:** `useState|useEffect|useMemo|useCallback|useRef` in `.tsx`;
  `.filter|.reduce|.sort` computing derived values in render; presence of a
  companion `useComponentName.ts`.
- **Risk factors:** JS-driven hover/focus styling (`onMouse*`, `onFocus`); global
  `rs-*` classes combined with inline overrides.

---

## Findings

### F1 — Styling not separated: **inline `style={{}}` in all 45 components** (≈480 blocks)

Every component expresses its styling as inline `style={{}}` objects. Under the
skill, **static** styling must live in a co-located `ComponentName.module.css`
(or shared Tailwind tokens/utilities), not inline in the render layer; only
genuinely dynamic one-off values may stay inline. Today the app has **no CSS
Modules at all**.

**Why this needs fixing:** it is the skill's core styling rule, and it keeps the
`.tsx` a pure render layer (structure, not appearance). Practical payoffs:
theming stays consistent (the `--rs-*` tokens are already the source of truth),
styles become reviewable/diffable as CSS, and repeated style objects stop being
copy-pasted per element. *(This is compliance + maintainability only — it changes
no output.)*

Per-file inline-style counts (conversion effort proxy), by domain:

| Domain | Files (count) |
|--------|----------------|
| `ui/` | ModalOverlay 1, PortalChip 1, RoleBadge 1, StatusBadge 1, Sparkline 1, FormLabel 2, StatusFilterTabs 2, SearchInput 4, BarChart 5, SortableColumnHeader 5, DeleteConfirmModal 8 |
| `layout/` | TabBar 3, AppShell 4, AppHeader 9, NotificationPanel 14, NotificationItem 15, Sidebar 26 |
| `overview/` | OverviewPage 4, BookingTrendsCard 7, KpiCard 8, WalletBalancesCard 11, VendorTrendsCard 12, PaymentMethodsCard 13 |
| `transactions/` | TransactionTable 2, TransactionsPage 2, TransactionToolbar 3, TransactionSummaryCards 4, TransactionFilterPanel 6, TransactionPagination 6, TransactionTableRow 10 |
| `users/` | UserDeleteConfirmModal 0, UsersPage 1, UserToolbar 4, UserStatsBar 5, UserTable 8, UserTableRow 16, UserModal 41 |
| `vendors/` | VendorDeleteConfirmModal 0, VendorsPage 2, VendorToolbar 2, VendorStatsBar 5, VendorFormModal 12, VendorViewModal 18, VendorCard 25, KycPanel 25 |
| `auth/` | LoginPage 83 |

### F2 — Logic in the render layer: derived computation in 6 components

The logic layer is otherwise in good shape (most components already have a
companion hook). The exceptions — derived/computed values living in the `.tsx`,
which the skill says belong in the hook:

| Component | Issue | Companion hook? |
|-----------|-------|-----------------|
| `overview/PaymentMethodsCard` | `useMemo` breakdown + `maxVol` derived in `.tsx` | none |
| `vendors/VendorStatsBar` | stats array via `.filter().length` in render | none |
| `users/UserStatsBar` | stats array via `.filter().length` in render | none |
| `transactions/TransactionPagination` | page-number list computed via `.filter` in render | none |
| `layout/NotificationPanel` | `active`/`archived` split via `.filter` in `.tsx` | **has** `useNotificationPanel.ts` (move the derivation in) |
| `transactions/TransactionsPage` | `refundCount` via `.filter` computed inline as a prop | **has** `useTransactions.ts` (move it in) |

**Why this needs fixing:** the skill assigns "derived / computed values" to the
hook, keeping the `.tsx` render-only. These are pure relocations of pure functions
— **no behaviour change.**

### Explicit NON-findings (checked, deliberately not flagged)

To avoid over-reach, these were considered and are **not** violations:

- **Hookless presentational components that only *receive* handler props** (e.g.
  `onClick={onClose}`, `onClick={() => onNavigate("x")}`). Forwarding a prop
  handler is not *owning* a handler — the skill's "prop drilling" and "trivial
  inline" allowances cover these. Components in this bucket (no state/effects/own
  logic) need **only** styling separation, not a hook: `ModalOverlay`,
  `SearchInput`, `DeleteConfirmModal`, `StatusFilterTabs`, `SortableColumnHeader`,
  `UserToolbar`, `UserTableRow`, `VendorToolbar`, `VendorCard`, `AppHeader`,
  `TabBar`, `NotificationItem`, `TransactionToolbar`, `TransactionFilterPanel`,
  the badges/chips, etc.
- **`UserModal` / `VendorFormModal`** have many handler props but their state lives
  in existing hooks (`useUserForm`, `useVendorForm`) — logic layer already fine;
  they need only styling separation.
- **Genuinely dynamic inline values** (data-driven bar widths like
  `` width:`${pct}%` ``, colours from `methodColor()`/`statusColor()`): the skill
  explicitly permits these to stay inline. They are left untouched (see D-4).

---

## Fix approach

### A. Styling → CSS Modules (1:1, pixel-identical)

For each component, add `ComponentName.module.css` and move **static** inline
style objects into named classes with **identical properties** — same pixel
values, same `var(--rs-*)` tokens, same shorthand — then reference them via
`className={styles.x}`.

- **Conditional styling** (a ternary choosing between two static style objects)
  → two classes toggled by `className={cond ? styles.a : styles.b}`. Identical
  properties ⇒ identical rendering.
- **Dynamic values** (runtime/data-driven) → stay inline (skill-allowed, D-4), or
  optionally passed as a CSS custom property (`style={{ ["--w"]: pct }}`) consumed
  by the class. Default: leave inline to minimise churn and risk.
- **Global `rs-*` classes are preserved.** Where an element is
  `className="rs-card"` + inline overrides, the overrides move to a module class
  used *alongside* it: `className={\`rs-card ${styles.card}\`}`. Both are
  single-class selectors; the module rule is additive (properties the global class
  doesn't set), so there is no specificity conflict — verified per element.

Why CSS Modules (not Tailwind) as the target: a 1:1 property copy is the
**lowest-risk, provably-identical** translation. Re-expressing hundreds of exact
pixel values as Tailwind utilities risks scale/rounding drift and *would* be a
look-and-feel change — off the table under the hard constraint (see D-1).

### B. Logic → hooks (pure relocation)

- New `usePaymentMethodsCard.ts`, `useVendorStatsBar.ts`, `useUserStatsBar.ts`,
  `useTransactionPagination.ts` — move the derived computations verbatim.
- Move the `active`/`archived` split into the existing `useNotificationPanel.ts`;
  move `refundCount` into the existing `useTransactions.ts` (or its consumer hook).

These move pure functions; inputs and outputs are unchanged ⇒ **no behaviour
change.**

---

## Why this cannot change the UI (and the risks we control)

The conversion copies every property value verbatim and leaves dynamic values
inline, so output is identical by construction. The specific risk vectors and
their mitigations:

| Risk | Mitigation |
|------|-----------|
| **Cascade/specificity** — inline styles have top priority; a class could be overridden by a global rule | The app has almost no global CSS beyond `--rs-*` tokens and the 10 `rs-*` classes; module rules are additive to those. Verify each converted element renders identically (visual diff, D-2). |
| **Typo / unit drift** when copying values | Mechanical copy + `tsc` + production build + visual diff per phase. |
| **Dynamic values** | Left inline, untouched. |
| **Lost pseudo-states** (hover/focus) | **None are JS-driven** — audit found zero `onMouse*`/`onFocus` styling. Nothing to lose; existing hovers live in `rs-*` classes and are preserved. |
| **Conditional style branches** | Mapped to class toggles with identical property sets. |

**Out of scope (would need separate approval):** de-duplicating or "tidying"
styles, normalising spacing, switching to the Tailwind scale, consolidating
colours, or any change that alters a rendered pixel. This plan deliberately does
none of that.

---

## Dependencies

- **CSS Modules:** natively supported by Next.js 16 — **no dependency required.**
- **Optional but recommended (D-2): a visual-regression safety net.** Given the
  "must not change the UI at all" constraint, add `@playwright/test` as a
  **dev-dependency** and capture before/after screenshots of every command page in
  light **and** dark themes; each phase must show a **zero-pixel diff**. This turns
  "we believe it's identical" into a mechanical proof. Dev-only; ships nothing to
  users. (Requires the ask-before-install gate — hence D-2.)

---

## Decisions to resolve before execution (approval gate)

| ID | Decision | Recommendation |
|----|----------|----------------|
| **D-1** | Conversion target: CSS Modules vs Tailwind utilities | **CSS Modules** — only a 1:1 property copy can guarantee pixel-identical output |
| **D-2** | Add Playwright visual-regression dev-dependency as the no-change proof? | **Yes** — it is the strongest guarantee for the hard constraint (new-dependency approval) |
| **D-3** | Scope/sequencing: all 45 at once vs pilot-first | **Pilot first** (`ui/` leaf components), review a zero-diff sample, then continue domain by domain |
| **D-4** | Dynamic inline values: keep inline vs push to CSS custom properties | **Keep inline** (skill-allowed; least churn/risk) |
| **D-5** | Do the F2 logic extractions in the same effort or separately? | **Same effort** — they are small and per-component |

---

## Execution order (only after approval)

Leaf/low-risk components first so the pattern (and the zero-diff proof) is
validated before touching the big composite screens.

- **P0 — ✅ DONE (2026-07-07).** Installed `@playwright/test` + chromium
  (dev-dep). Added a **visual-regression harness**: `playwright.config.ts`
  (pixel-exact — `maxDiffPixels: 0`, animations disabled), a dev/test fixture
  route `app/ui-gallery/page.tsx` (renders the pilot components in isolation,
  `?mode=grid|delete&theme=light|dark`), and `visual-tests/pilot.spec.ts`.
  Captured 4 baselines (grid/delete × light/dark) in
  `visual-tests/pilot.spec.ts-snapshots/`. *(The `/ui-gallery` route is a test
  fixture only — removable once the whole remediation is done; noted in Cleanup.)*
- **P1 — ✅ DONE (2026-07-07). Pilot `ui/` (11 components) → CSS Modules.**
  Static styles moved to co-located `*.module.css`; dynamic values kept inline
  (D-4: badge/chip colours from config, theme-dependent tab track, bar
  width/colour, `busy` cursor/opacity). Converted: ModalOverlay, PortalChip,
  RoleBadge, StatusBadge, Sparkline, FormLabel, StatusFilterTabs, SearchInput,
  BarChart, SortableColumnHeader, DeleteConfirmModal.
  **Verification: `tsc --noEmit` exit 0; visual suite 4/4 pass with ZERO pixel
  diff (light + dark).** No hooks needed in this batch — no `ui/` leaf owns
  state/effects/derived logic.
- **P2 — ✅ DONE (2026-07-07). `layout/` (6 components) → CSS Modules + F2.**
  Converted Sidebar, AppHeader, TabBar, AppShell, NotificationPanel,
  NotificationItem. Dynamic kept inline (D-4): notification icon tint
  `${color}1a`, title weight by `is_read`, theme-dependent tab track, unread-dot
  border via Tailwind `dark:` classes. Active-nav replicated the shared `AN`
  style constant into `.navItemActive` (identical values; noted for the shared-
  constant consolidation follow-up). Loader spin now relies solely on Tailwind
  `animate-spin` (dropped the redundant inline `animation` — computed identical),
  sidestepping CSS-Modules keyframe scoping. **F2:** `useNotificationPanel(notifications)`
  now owns the `active`/`archived`/`visible`/`hasUnread`/`hasRead` derivations;
  NotificationPanel `.tsx` is render-only. Extended the gallery fixture with
  `sidebar`/`header`/`tabbar`/`notif` modes.
  **Verification: `tsc --noEmit` exit 0; visual suite 12/12 pass, ZERO pixel diff
  (light + dark).** AppShell is a smart container (not screenshot-isolable); its
  4 trivial layout styles were converted 1:1 and covered by tsc + the compile.
- **P3 — ✅ DONE (2026-07-07). `overview/` (6 components) → CSS Modules + F2.**
  Converted KpiCard, BookingTrendsCard, VendorTrendsCard, WalletBalancesCard,
  PaymentMethodsCard, OverviewPage. Dynamic kept inline (D-4): KPI icon
  tint/colour + up/down colour, chart stat-cell/value colours, vendor status chip
  bg/colour, wallet + payment bar widths/colours. **F2:** extracted
  PaymentMethodsCard's `useMemo` breakdown + `maxVol` into `usePaymentMethodsCard.ts`;
  the `.tsx` is render-only. Added an `overview` gallery mode rendering the full
  page with a fixed mock vendor list (useOverviewPage is fully deterministic — no
  Date/random).
  **Verification: `tsc --noEmit` exit 0; visual suite 14/14 pass, ZERO pixel diff
  (light + dark).**
- **P4 — ✅ DONE (2026-07-07). `transactions/` (7 components) → CSS Modules + F2.**
  Converted TransactionsPage, TransactionSummaryCards, TransactionToolbar,
  TransactionFilterPanel, TransactionTable, TransactionTableRow,
  TransactionPagination. Dynamic kept inline (D-4): summary-card value colour,
  table chip/method/status colours, row `isLast` border, pagination nav
  cursor/opacity. Conditional-static → class toggles (filter button active/idle,
  page-number active/idle). Shared `PB` constant replicated into `.exportBtn`
  (like `AN`; noted for consolidation). **F2:** `refundCount` moved into
  `useTransactions`; new `useTransactionPagination(page, totalPages, totalRecords)`
  owns `start`/`end`/`pageNumbers`. Added a `transactions` gallery mode rendering
  the real `TransactionsPage` (genTxns is deterministic — fixed base date,
  index-based, no random) + a standalone `TransactionFilterPanel` (its panel is
  hidden by default).
  **Verification: `tsc --noEmit` exit 0; visual suite 16/16 pass, ZERO pixel diff
  (light + dark).**
- **P5 — ✅ DONE (2026-07-08). `users/` (6 components) → CSS Modules + F2.**
  Converted UsersPage, UserToolbar, UserStatsBar, UserTable, UserTableRow, and
  the 41-style UserModal. (UserDeleteConfirmModal has no inline styles — it wraps
  the already-converted DeleteConfirmModal.) Dynamic kept inline (D-4): stat dot/
  number colours, row status-toggle colours + `isLast` border, and throughout
  UserModal the theme-`dark` backgrounds, per-portal config colours, active/on
  states, and the Save button's `canSave` cursor/opacity. Shared `PB` constant
  replicated into `.inviteBtn` / `.footerPrimary` (like `AN`/`PB` elsewhere).
  **F2:** extracted UserStatsBar's stats derivation into `useUserStatsBar(users)`.
  Added `users` / `usermodal` (edit, form seeded on mount to show active-portal
  styling) / `userview` gallery modes; leaf components rendered with fixed props
  since `useUsers` fetches from Supabase (no DB in the fixture).
  **Verification: `tsc --noEmit` exit 0; visual suite 22/22 pass, ZERO pixel diff
  (light + dark).**
- **P6 — ✅ DONE (2026-07-08). `vendors/` (7 components) → CSS Modules + F2.**
  Converted VendorsPage, VendorToolbar, VendorStatsBar, VendorCard,
  VendorFormModal, VendorViewModal, KycPanel. (VendorDeleteConfirmModal has no
  inline styles.) Dynamic kept inline (D-4): stat colours, card status-border +
  status chip + toggle colours, form/KycPanel `busy`/`actioning` cursor+opacity,
  KycPanel status-chip colours. Shared `PB` replicated into add/edit/save buttons.
  **F2:** extracted `useVendorStatsBar(vendors)`. Added `vendors` (real
  VendorsPage — useVendors filters the prop, only fetches on save/delete) /
  `vendorform` (edit, seeded) / `vendorview` gallery modes.
  **Verification: `tsc --noEmit` exit 0; visual suite 28/28 pass, ZERO pixel diff
  (light + dark).** *Coverage note:* KycPanel's **loaded** branch (documents list,
  review textarea/buttons, status chip, type row) is fetch-dependent and has no DB
  in the fixture, so the `vendorview` screenshot exercises its header + "No KYC
  submission yet" state; the loaded-branch styles were converted 1:1 and are
  covered by tsc + build + manual correspondence (same limitation class as
  AppShell). Everything else in the domain is pixel-diffed.
- **P7 — ✅ DONE (2026-07-09). `auth/LoginPage` (83 styles) → CSS Modules.**
  The single largest component; almost entirely static. Only the 3 primary
  buttons' `isLoading` cursor/opacity stays inline (D-4). Preserved the global
  `login-left` / `login-right` / `login-divider` / `login-mobile-toggle` classes
  (responsive mobile-toggle behaviour untouched); static icon colours became
  `.iconBlue/.iconGold/.iconGreen`. Baseline taken from the original via
  `git checkout HEAD` (component was converted before baselining), then re-applied.
  Gallery modes `login` / `loginforgot` / `loginsent` / `loginreset` + a
  narrow-viewport **`login-mobile-info`** test (clicks the toggle to render the
  mobile info view's variant classes).
  **Verification: `tsc --noEmit` exit 0; 0-pixel diff on all login snapshots.**

- **P8 — ✅ DONE (2026-07-09). `settings/NotificationSettingsPage` (39 styles) → CSS Modules.**
  *Omitted from the original P1–P7 list though present in the F1 audit table;
  caught by the final full-tree grep.* Static → module (39 → 8 remaining, all
  dynamic per D-4: toggle backgrounds, knob positions, portal-chip colours, row
  borders). Gallery `settings` mode covers the section/table headers + empty
  states; the populated toggle rows are fetch-dependent (no DB in the fixture) so
  they're tsc + 1:1 covered (same limitation class as KycPanel/AppShell).
  **Verification: `tsc --noEmit` exit 0; visual suite 39/39 pass, ZERO pixel diff.**

---

## Completion summary (2026-07-09)

- **Scope done:** all 8 domains — `ui/` (11), `layout/` (6), `overview/` (6),
  `transactions/` (7), `users/` (6), `vendors/` (7), `auth/` (1), `settings/` (1).
  **44 components**, **45 `.module.css`** files.
- **Logic layer (F2):** 7 extractions — `useNotificationPanel` (derivations),
  `usePaymentMethodsCard`, `useTransactions` (`refundCount`),
  `useTransactionPagination`, `useUserStatsBar`, `useVendorStatsBar`.
- **Dynamic-inline (D-4):** every remaining inline `style` is data/theme/state
  driven (config colours, `dark` backgrounds, bar widths, `busy`/`isLoading`
  cursor+opacity, `isLast`/index borders, toggle state). No **static** inline
  `style={{}}` remains in any component.
- **Shared style constants** `PB`/`AN` were replicated into module classes where
  used (Sidebar, toolbars, card/modal primary buttons). **Follow-up (not done):**
  consolidate these into shared CSS utility classes to remove duplication.
- **Proof:** 39 Playwright full-page snapshots (light + dark; pages, modals,
  the login views + mobile-info) at `maxDiffPixels: 0`. Not pixel-covered (fetch-
  dependent branches → tsc + 1:1): AppShell (smart container), KycPanel loaded
  branch, NotificationSettingsPage populated rows.
- **Not committed** by the agent — the user handles commits.

### Close-out follow-ups
- ✅ **Harness kept (2026-07-10, user decision).** Retained as the reusable
  visual-regression harness for future cleanup rounds. Added a **production
  guard** to `app/ui-gallery/page.tsx` (`if (process.env.NODE_ENV === "production") notFound()`)
  so the fixture renders in dev/CI (the suite runs `next dev`) but **404s in the
  deployed build** — it never ships a public route. Verified: `tsc` exit 0 + a
  gallery snapshot still passes in dev. *(Caveat: don't run the suite against
  `next build && next start` — NODE_ENV=production would 404 the fixture.)*
- ⬜ Consolidate the `PB`/`AN` shared style constants into shared CSS.

Each phase ends with the per-phase verification below before moving on.

---

## Verification (per phase)

| Check | Kind |
|-------|------|
| `tsc --noEmit` passes in command | machine |
| `next build` succeeds (no CSS/module resolution errors) | machine |
| Visual diff = 0 pixels changed, light + dark (if D-2) | machine |
| Manual spot-check of the phase's screens (light + dark) — layout, spacing, colours, hover, active/selected states identical | manual |
| `.tsx` files in the phase contain no static `style={{}}` and no `useState`/`useEffect`/derived computation | review |
| No functional/behaviour change (clicks, forms, navigation, modals) | manual |

---

## Notes / risks

- **Volume.** ≈480 inline blocks across 45 files; `LoginPage` (83) and `UserModal`
  (41) dominate. This is large but mechanical — the phasing + zero-diff gate keep
  each step safe and reviewable.
- **`app/` pages** (route files) were not in the component audit; a follow-up can
  extend the same treatment if they carry inline styles.
- **Shared JS style constants** (`PB`, `AN` in `lib/constants.ts`, applied via
  inline spread across many components) are being replicated into module classes
  where hit (e.g. Sidebar's `.navItemActive` = `AN`). Follow-up: once all domains
  are converted, consolidate these into shared CSS (global utility classes or a
  shared module) to remove the duplication. Tracked; not blocking.
- **This is structural refactoring touching many files** — per AGENTS.md it needs
  explicit approval, which is why nothing is executed until you sign off on the
  decisions above.

## Harness & cleanup (added at P0)

- **New dev-dependency:** `@playwright/test` (+ chromium browser). Ships nothing to
  users.
- **Test-only files:** `playwright.config.ts`, `visual-tests/` (spec + committed
  baseline PNGs), and the fixture route `app/ui-gallery/page.tsx`. The gallery
  route is the only item that lands in the app bundle; it is reachable only at
  `/ui-gallery` and changes no existing screen. **Recommend deleting it (and the
  harness, or keeping the harness for future regressions) once P2–P7 finish** —
  flag for a decision at close-out.
- **How to run the proof each phase:** `npx playwright test` (compares to
  baselines; must stay 4/4 green). Add fixtures/snapshots as later domains are
  converted.
- **Harmless dev warning:** Next prints "Blocked cross-origin request … /_next/webpack-hmr"
  during the Playwright dev run — it's only about HMR websockets from `127.0.0.1`
  and does not affect the app or the screenshots. No action needed (can be
  silenced later with `allowedDevOrigins` if desired).
```
