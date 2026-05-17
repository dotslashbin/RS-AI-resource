# Plan: command — Component Breakdown

**Date:** 2026-05-07  
**Scope:** `./command` only — break `app/page.tsx` into granular components following SOLID principles and Next.js best practices. No shared code with `learner` or `academy`.

---

## CSS Advice (read before execution)

### Current situation
All styles are inline `style={{}}` with hardcoded hex/rgba values. Theme is a `useTheme(dark)` hook returning a `T` object that is passed via closure or prop. Tailwind is installed (v3) but only used for sidebar responsive layout (`lg:hidden`, `lg:sticky`).

### Why not Styled Components?
- Adds a CSS-in-JS runtime on top of an already-installed Tailwind — overlapping tools
- Next.js App Router requires extra server-rendering setup for CSS-in-JS
- Styled Components and Tailwind fight over the same responsibilities (layout, spacing, colours)
- Cognitive overhead with no prior usage in the project
- **Verdict: avoid**

### Recommended approach — CSS Variables + Tailwind + CSS Modules (where needed)

**Step 1 — Migrate theme tokens to CSS custom properties in `globals.css`**  
Define `:root` (light) and `.dark` variants. The `useTheme` hook is then replaced by switching a `dark` class on `<html>` and consuming variables.

```css
:root {
  --page-bg: linear-gradient(145deg,#eef2ff 0%,#f0f4ff 55%,#f5f3ff 100%);
  --sidebar-bg: #ffffff;
  --card-bg: #ffffff;
  --card-border: rgba(0,0,0,0.07);
  --card-shadow: 0 2px 12px rgba(0,0,0,0.06),0 1px 3px rgba(0,0,0,0.04);
  --input-bg: #f8fafc;
  --input-border: rgba(0,0,0,0.1);
  --sub-bg: #f8fafc;
  --pill-bg: #f8fafc;
  --topbar-bg: rgba(255,255,255,0.85);
  --tabbar-bg: rgba(248,250,252,0.9);
  --divider: rgba(0,0,0,0.07);
  --color-strong: #0f172a;
  --color-text: #64748b;
}
.dark {
  --page-bg: linear-gradient(145deg,#04060e 0%,#070b17 55%,#05080f 100%);
  --sidebar-bg: #05080f;
  --card-bg: rgba(255,255,255,0.028);
  --card-border: rgba(255,255,255,0.07);
  --card-shadow: 0 8px 32px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.05);
  /* … etc. */
}
```

**Step 2 — Extend `tailwind.config.ts` to reference CSS variables**  
```ts
theme: {
  extend: {
    colors: {
      strong:  'var(--color-strong)',
      muted:   'var(--color-text)',
      divider: 'var(--color-divider)',
    },
    backgroundColor: {
      card:  'var(--card-bg)',
      input: 'var(--input-bg)',
      pill:  'var(--pill-bg)',
      sub:   'var(--sub-bg)',
    }
  }
}
```

**Step 3 — Use Tailwind for layout/spacing/typography; CSS Modules for complex per-component visual styles**  
Complex styles that don't map cleanly to Tailwind (multi-stop gradients, glassmorphism `backdrop-filter`, card border-radius combos) go in a co-located `.module.css` file per component. These are the exception, not the rule.

**Step 4 — Inline styles: move with components now, migrate in a follow-up task**  
Per the instructions: inline styles travel with their components during this breakdown. The CSS variable migration above is a separate follow-up task after the structural breakdown is complete.

---

## What exists in `page.tsx`

### Constants & config (module-level)
| Symbol | What it is |
|---|---|
| `BOOKING_TREND`, `SCHOOL_TREND` | Static chart data arrays |
| `PAYMENT_METHODS`, `SCHOOL_NAMES`, `EXAM_TYPES` | Static string arrays |
| `ALL_TXNS` / `genTxns()` | 42 generated transaction objects |
| `SCHOOLS_INIT` | 6 seed school objects |
| `USERS_INIT` | 10 seed user objects |
| `ALL_PORTALS`, `ALL_STATUSES`, `ALL_ROLES` | Enum-like string arrays |
| `STATUS_CFG`, `ROLE_CFG`, `PORTAL_CFG` | Badge/chip config maps |

### Functions / hooks (module-level)
| Symbol | What it is |
|---|---|
| `useTheme(dark)` | Returns `T` theme token object |
| `genTxns()` | Transaction generator (pure) |
| `methodColor(m)`, `methodBg(m)`, `statusSty(s)` | Pure style-helper functions |

### Shared primitive components (module-level)
| Component | What it renders |
|---|---|
| `BarChart` | Mini grouped bar chart (SVG-free, div heights) |
| `Sparkline` | SVG polyline sparkline |
| `StatusBadge` | Coloured pill for user/school status |
| `RoleBadge` | Coloured pill for platform role |
| `PortalChip` | Small coloured chip for portal name |

### Components defined inside `BackofficeDashboard` (need to be lifted)
| Component | What it renders |
|---|---|
| `SLabel` | Form section label with optional tag |
| `SortIcon` | Sortable column chevron icon |
| `Overview` | Full Overview page |
| `Transactions` | Full Transactions page |
| `Schools` | Full Schools page |
| `UserModal` | View / add / edit user modal (mode-driven) |
| `UsrDeleteConfirm` | User delete confirmation dialog |
| `UserManagement` | Full Users page |

### State (in `BackofficeDashboard`)
| State group | Variables |
|---|---|
| App shell | `dark`, `page`, `sideOpen`, `loggedIn` |
| Transactions | `txnSearch`, `txnMethod`, `txnStatus`, `txnExam`, `txnDateFrom`, `txnDateTo`, `txnAmtMin`, `txnAmtMax`, `sortCol`, `sortDir`, `txnPage`, `showFilters` + derived `filteredTxns`, `pagedTxns`, `totalVolume`, `totalFees` |
| Schools | `schools`, `schSearch`, `schStatus`, `schModal`, `schTarget`, `deleteConf`, form fields `_fName` … `_fStatus` |
| Users | `users`, `usrSearch`, `usrStatus`, `usrRole`, `usrPortal`, `usrModal`, `usrTarget`, `usrDelConf`, form fields `uName` … `uRole` |

---

## Target folder structure

```
command/
  app/
    page.tsx                              ← shell only: AppShell + login guard
    globals.css                           ← add CSS variable tokens here (follow-up task)

  components/
    layout/
      AppShell/
        AppShell.tsx                      ← composes sidebar + header + tabbar + main content
        useAppShell.ts                    ← dark, page, sideOpen state; goPage(); useEffect desktop-open
      Sidebar/
        Sidebar.tsx                       ← aside element, nav groups, user footer
        useSidebar.ts                     ← open/close state, close-on-mobile handler
      AppHeader/
        AppHeader.tsx                     ← topbar: hamburger, page title, theme toggle, bell
      TabBar/
        TabBar.tsx                        ← horizontal tab navigation bar

    auth/
      LoginScreen/
        LoginScreen.tsx                   ← full-page login form
        useLoginScreen.ts                 ← loggedIn state, onSignIn handler

    ui/
      BarChart/
        BarChart.tsx
      Sparkline/
        Sparkline.tsx
      StatusBadge/
        StatusBadge.tsx
      RoleBadge/
        RoleBadge.tsx
      PortalChip/
        PortalChip.tsx
      FormLabel/
        FormLabel.tsx                     ← was `SLabel` — generic form section label
      SearchInput/
        SearchInput.tsx                   ← search bar with clear button (used in txn/schools/users)
      StatusFilterTabs/
        StatusFilterTabs.tsx              ← pill-style segmented status filter (schools + users)
      ModalOverlay/
        ModalOverlay.tsx                  ← backdrop + centred card wrapper; accepts children
      DeleteConfirmModal/
        DeleteConfirmModal.tsx            ← generic delete confirmation dialog (accepts message + onConfirm)
      SortableColumnHeader/
        SortableColumnHeader.tsx         ← was `SortIcon` — th content with sort chevron

    overview/
      OverviewPage/
        OverviewPage.tsx                  ← composes all overview sub-components
        useOverviewPage.ts                ← derived KPI calculations from schools + BOOKING_TREND
      KpiCard/
        KpiCard.tsx                       ← single stat card with sparkline + trend indicator
      BookingTrendsCard/
        BookingTrendsCard.tsx             ← card: BarChart + exam type breakdown grid
      SchoolTrendsCard/
        SchoolTrendsCard.tsx              ← card: BarChart + top-4 school list
      WalletBalancesCard/
        WalletBalancesCard.tsx            ← card: per-school balance progress bars
      PaymentMethodsCard/
        PaymentMethodsCard.tsx            ← card: payment method volume breakdown

    transactions/
      TransactionsPage/
        TransactionsPage.tsx              ← composes all transactions sub-components
        useTransactions.ts                ← all filter/sort/pagination state + derived filteredTxns/pagedTxns
      TransactionSummaryCards/
        TransactionSummaryCards.tsx       ← 4 stat cards at top of page
      TransactionToolbar/
        TransactionToolbar.tsx            ← search bar + filter toggle button + export CSV button
      TransactionFilterPanel/
        TransactionFilterPanel.tsx        ← expandable filter panel (method/status/exam/dates/amounts)
      TransactionTable/
        TransactionTable.tsx              ← sortable table with thead + tbody
      TransactionTableRow/
        TransactionTableRow.tsx           ← single transaction row
      TransactionPagination/
        TransactionPagination.tsx         ← prev/next + page number buttons

    schools/
      SchoolsPage/
        SchoolsPage.tsx                   ← composes all schools sub-components
        useSchools.ts                     ← schools list state + CRUD handlers (add/edit/delete/toggleStatus)
      SchoolToolbar/
        SchoolToolbar.tsx                 ← search + status filter tabs + Add School button
      SchoolStatsBar/
        SchoolStatsBar.tsx                ← Total / Active / Suspended stat mini-cards
      SchoolCard/
        SchoolCard.tsx                    ← single school card with actions
      SchoolViewModal/
        SchoolViewModal.tsx               ← read-only school detail modal
      SchoolFormModal/
        SchoolFormModal.tsx               ← add/edit form modal
        useSchoolForm.ts                  ← form field state + reset/populate helpers
      SchoolDeleteConfirmModal/
        SchoolDeleteConfirmModal.tsx      ← wraps generic DeleteConfirmModal with school-specific message

    users/
      UsersPage/
        UsersPage.tsx                     ← composes all users sub-components
        useUsers.ts                       ← users list state + CRUD handlers
      UserToolbar/
        UserToolbar.tsx                   ← search + status tabs + role select + portal select + Invite
      UserStatsBar/
        UserStatsBar.tsx                  ← Total / Active / Suspended / Pending stat mini-cards
      UserTable/
        UserTable.tsx                     ← user table with thead + tbody
      UserTableRow/
        UserTableRow.tsx                  ← single user row with avatar + badges + action buttons
      UserModal/
        UserModal.tsx                     ← view/add/edit modal driven by mode prop ("view"|"add"|"edit")
        useUserForm.ts                    ← form field state + reset/populate helpers
      UserDeleteConfirmModal/
        UserDeleteConfirmModal.tsx        ← wraps generic DeleteConfirmModal with user-specific message

  hooks/
    useTheme.ts                           ← extracted from inline function; returns T token object

  hooks/mutations/                        ← placeholder folder for future Supabase mutation hooks
    schools/
      useCreateSchool.ts                  ← (stub) will wrap Supabase insert
      useUpdateSchool.ts
      useDeleteSchool.ts
    users/
      useCreateUser.ts                    ← (stub) will wrap Supabase insert / auth.admin.createUser
      useUpdateUser.ts
      useDeleteUser.ts

  lib/
    constants.ts                          ← all static data + config maps (STATUS_CFG, ROLE_CFG, etc.)
    types.ts                              ← TypeScript interfaces: School, User, Transaction, Portal, etc.
    utils.ts                              ← cn() + methodColor/methodBg/statusSty/formatCurrency helpers
```

---

## SOLID application notes

| Principle | How it applies here |
|---|---|
| **S — Single responsibility** | Each component renders exactly one thing; each hook manages exactly one concern |
| **O — Open/Closed** | `STATUS_CFG`, `ROLE_CFG`, `PORTAL_CFG` in `constants.ts` are extended by adding entries, not by modifying badge components |
| **I — Interface segregation** | Components receive only the props they need — e.g. `KpiCard` takes `label/value/sub/spark/color`, not the whole `schools` array |
| **D — Dependency inversion** | Page components depend on hook abstractions (`useSchools`, `useTransactions`) not on concrete state wiring; makes swapping state source (local → Supabase) a hook-only change |

---

## Key decisions to confirm before execution

1. **`useTheme` placement** — `hooks/useTheme.ts` vs staying inline in `AppShell`. Since it's pure logic shared by every component via prop-drilling today, lifting it to a React Context (provided in `AppShell`) eliminates prop-drilling entirely and is the SOLID-correct move. **Proposed: create a `ThemeContext` in `AppShell.tsx` and consume via a `useThemeContext()` hook in `hooks/useTheme.ts`.** Confirm?

2. **Mutation stubs** — For now these are thin wrappers around the existing local `useState` mutations. They will have the right shape to swap for Supabase calls later. No real API calls in this task. Confirm?

3. **`page.tsx` after extraction** — Becomes a minimal shell: renders `<LoginScreen>` or `<AppShell>`. The `// @ts-nocheck` + `"use client"` convention stays in `page.tsx`; individual component files will use proper TypeScript (no `// @ts-nocheck`) since they'll be clean new files. Confirm?

4. **`SortIcon` / `SortableColumnHeader`** — Currently a closure over `sortCol`/`sortDir`/`T` from the parent scope. As a component it needs those passed as props. Clean but slightly more verbose. Confirm this is desired over just inlining the icon in `TransactionTable`?

---

## Execution order (once confirmed)

1. Create `lib/types.ts`, `lib/constants.ts`, extend `lib/utils.ts`
2. Create `hooks/useTheme.ts` (+ ThemeContext if confirmed above)
3. Create `ui/` primitives (BarChart, Sparkline, StatusBadge, RoleBadge, PortalChip, FormLabel, SearchInput, StatusFilterTabs, ModalOverlay, DeleteConfirmModal, SortableColumnHeader)
4. Create `layout/` components (AppShell, Sidebar, AppHeader, TabBar)
5. Create `auth/LoginScreen`
6. Create `overview/` components
7. Create `transactions/` components
8. Create `schools/` components
9. Create `users/` components
10. Create `hooks/mutations/` stubs
11. Rewrite `app/page.tsx` as thin shell
12. Run `npx tsc --noEmit` and verify no regressions

---

## Completion checklist

- [ ] `lib/types.ts` created
- [ ] `lib/constants.ts` created
- [ ] `lib/utils.ts` extended
- [ ] `hooks/useTheme.ts` extracted
- [ ] All `ui/` primitives created
- [ ] `layout/` shell created
- [ ] `auth/LoginScreen` created
- [ ] `overview/` components created
- [ ] `transactions/` components created
- [ ] `schools/` components created
- [ ] `users/` components created
- [ ] `hooks/mutations/` stubs created
- [ ] `app/page.tsx` reduced to shell
- [ ] `npx tsc --noEmit` passes
