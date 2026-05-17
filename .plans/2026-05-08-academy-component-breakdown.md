# Plan: academy — Component Breakdown

**Date:** 2026-05-08  
**Scope:** `./academy` only — break the 1,674-line `app/page.tsx` monolith into granular components following SOLID principles and Next.js best practices. No shared code with `learner` or `command`.

---

## CSS Advice (read before execution)

### Current situation
All styles are inline `style={{}}` with hardcoded hex/rgba values. Theme is a `T` object built from a `dark` boolean (identical pattern to learner and command before their CSS migrations). Tailwind is installed (v3) but used only for responsive grid/flex utilities.

### Why not Styled Components?
Identical reasoning to command and learner — adds CSS-in-JS runtime on top of Tailwind, App Router requires extra setup, overlapping tool responsibilities. **Avoid.**

### Recommended approach — CSS Variables + Tailwind (follow-up task)
Same approach as learner's completed CSS migration:
- `:root` / `.dark` custom properties in `globals.css`
- `@layer components` utility classes (`sp-card`, `sp-pill`, `sp-input`, `sp-sub`, etc.)
- `next-themes` `ThemeProvider` in `layout.tsx`, `useTheme()` in components that need runtime dark state

**Inline styles travel with their components during this breakdown. The CSS variable migration is a separate follow-up task after the structural breakdown is complete.**

---

## What exists in `page.tsx`

### Constants & config (module-level)
| Symbol | What it is |
|---|---|
| `BOOKINGS` | 8 seed booking objects |
| `INSTRUCTORS_INIT` | 4 seed instructor objects |
| `SCHED_INIT` | 4 seed schedule objects |
| `TXNS` | 6 seed transaction objects |
| `NOTIFS` | 4 seed notification objects |
| `PACKAGES` | 3 seed package objects |
| `OFFERINGS_INIT` | 4 seed offering objects |
| `SCHOOL_PROFILE_INIT` | School profile object with branches + certificates arrays |
| `MOCK_USER_ACADEMIES` | 3 multi-academy picker objects |
| `MULTI_ACADEMY_ENABLED` | Boolean flag for academy-select flow |
| `MONTHS`, `WD_SHORT` | Calendar display arrays |
| `TC`, `TB` | Exam type colour / background maps |

### Functions / helpers (module-level or inline)
| Symbol | What it is |
|---|---|
| `T` | Theme token object built from `dark` boolean |
| `PB`, `AN` | Primary button / active nav inline style shortcuts |
| `goPage(p)` | Navigate + close sidebar |
| `approveB(id)`, `rejectB(id)` | Booking status mutations |
| `getSchedsForDay(day)`, `getBkgsForDay(day)`, `getDots(day)` | Calendar helpers (depend on `schedules` + `bookings`) |
| `resetSF()`, `saveSched()` | Schedule form submit/reset |
| `openAddInst()`, `openEditInst(inst)`, `saveInst()` | Instructor CRUD helpers |
| `catColor(cat)`, `catBg(cat)` | Offering category colour helpers |
| `openOAdd()`, `openOEdit(o)`, `saveOffering()`, `deleteOffering(id)`, `toggleOStatus(id)` | Offerings CRUD |
| `statusStyle(s)` | Booking status → `{bg,c}` colour map |
| `filtBkgs`, `filtInst`, `pendingCount` | Derived values |

### Shared primitive components (inline, need to be lifted)
| Component | What it renders |
|---|---|
| `SLabel` | Form section label (uppercase, letter-spaced) — used in schedule form, instructor form |
| `RF` | Register form field input (closure inside login `register` view) |
| `SectionCard` | Profile page card wrapper |
| `SectionTitle` | Profile page section heading with icon |
| `Field` | Profile page editable field (text/textarea with view/edit mode) |

### Page components (defined inside the monolith)
| Component | Route key | Key sub-features |
|---|---|---|
| `Dashboard` | `dashboard` | 4 stat cards, pending approvals list, booking summary, notifications |
| `Bookings` | `bookings` | Filter tabs, sortable booking list, approve/reject actions |
| `ScheduleMaker` | `schedule` | Calendar grid + day detail panel + schedule form modal |
| `Instructors` | `instructors` | Search, 3 stat cards, instructor cards, add/edit form modal |
| `WalletPage` | `wallet` | Tab switcher: balance card + transaction list |
| `SettingsPage` | `settings` | School info, notification toggles, dark mode toggle |
| `CalendarPage` | `calendar` | Standalone full-page calendar with booking + schedule dots + day detail |
| `PackagesPage` | `packages` | Package cards with edit/active toggle |
| `ProfilePage` | `profile` | School header, editable info sections, branches, certificates |
| `OfferingsPage` | `offerings` | Search/filter, offering cards with inline delete confirm, add/edit modal |

### State (47 variables)
| Group | Variables |
|---|---|
| App shell | `dark`, `page`, `sideOpen`, `loggedIn` |
| Login | `loginView`, `regStep`, `regForm` |
| Shared cross-page data | `bookings`, `schedules`, `instructors` |
| Bookings page | `bFilter` |
| Calendar / Schedule | `calMonth`, `calYear`, `selDay` |
| Schedule form | `showSF`, `sfType`, `sfTitle`, `sfDate`, `sfTime`, `sfEnd`, `sfDays`, `sfRep`, `sfInst`, `sfMax` |
| Instructor search/form | `showIF`, `editInst`, `instSearch`, `ifName`, `ifPhone`, `ifEmail`, `ifSpecs`, `ifExp` |
| Wallet | `walletTab` |
| Profile | `profileData`, `profileEditing`, `profileDraft` |
| Offerings filter | `oCatFilter`, `oSearch` |
| Offerings modal | `oModal`, `oTarget`, `oDeleteConf` |
| Offering form fields | `ofName`, `ofCode`, `ofCat`, `ofDesc`, `ofPrice`, `ofDuration`, `ofReqs`, `ofStatus` |

---

## Target folder structure

```
academy/
  app/
    page.tsx                              ← shell only: AppShell + login guard
    globals.css                           ← add CSS variable tokens here (follow-up task)

  components/
    layout/
      AppShell/
        AppShell.tsx                      ← sidebar + topbar + tabbar + main content
        useAppShell.ts                    ← dark, page, sideOpen, loggedIn + shared data state (bookings/schedules/instructors)
      Sidebar/
        Sidebar.tsx                       ← aside: two nav groups ("School Menu" / "More"), user footer
      TopBar/
        TopBar.tsx                        ← sticky header: hamburger, page title, pending alert, dark toggle, bell
      TabBar/
        TabBar.tsx                        ← horizontal tabs for main pages only (dashboard → wallet)

    auth/
      LoginPage/
        LoginPage.tsx                     ← full-page login with 6 views (login/forgot/sent/select_academy/register/reg_sent)
        useLoginPage.ts                   ← loginView, regStep, regForm state + transition handlers

    ui/
      StatCard/
        StatCard.tsx                      ← single KPI card (icon, value, label, sub, optional urgency bar)
      StatusBadge/
        StatusBadge.tsx                   ← coloured pill: pending/confirmed/completed/cancelled
      FormLabel/
        FormLabel.tsx                     ← was `SLabel` — uppercase label with letter-spacing
      SearchInput/
        SearchInput.tsx                   ← search bar with icon + clear (used in instructors + offerings)
      FilterTabs/
        FilterTabs.tsx                    ← pill-style segmented filter (bookings, offerings, wallet)
      ModalOverlay/
        ModalOverlay.tsx                  ← backdrop + centred card wrapper; accepts children

    dashboard/
      DashboardPage/
        DashboardPage.tsx                 ← composes all dashboard sub-components
      PendingApprovalsCard/
        PendingApprovalsCard.tsx          ← card: up to 3 pending bookings with approve/reject
      BookingSummaryCard/
        BookingSummaryCard.tsx            ← card: TDC/PDC/MDC counts + pass rate bar
      NotificationsCard/
        NotificationsCard.tsx             ← card: notification list with unread dot + warn icon

    bookings/
      BookingsPage/
        BookingsPage.tsx                  ← composes filter bar + booking list
        useBookings.ts                    ← bFilter state + filtBkgs derivation + approveB/rejectB callbacks
      BookingRow/
        BookingRow.tsx                    ← single booking row (avatar, student, type badge, status, actions)

    schedule/
      SchedulePage/
        SchedulePage.tsx                  ← composes calendar + day detail + form modal
        useSchedule.ts                    ← calMonth, calYear, selDay, showSF + calendar helpers + saveSched
      ScheduleCalendar/
        ScheduleCalendar.tsx              ← 7-col calendar grid with dot indicators
      DayDetailPanel/
        DayDetailPanel.tsx                ← day detail: schedule list or empty state + "+ New" button
      ScheduleFormModal/
        ScheduleFormModal.tsx             ← add schedule modal (type/title/date/times/days/repeat/instructor/max)
        useScheduleForm.ts                ← sfType…sfMax field state + resetSF

    instructors/
      InstructorsPage/
        InstructorsPage.tsx               ← composes search bar + stat bar + instructor grid + form modal
        useInstructors.ts                 ← instructors list + instSearch + CRUD handlers
      InstructorStatBar/
        InstructorStatBar.tsx             ← 3 mini-cards: Active / On Leave / Total Students
      InstructorCard/
        InstructorCard.tsx                ← single instructor card (avatar, name, status, specs, stats, contact, actions)
      InstructorFormModal/
        InstructorFormModal.tsx           ← add/edit instructor modal
        useInstructorForm.ts              ← ifName…ifExp form fields + editInst target

    wallet/
      WalletPage/
        WalletPage.tsx                    ← tab switcher: balance card + transaction list
        useWallet.ts                      ← walletTab state

    settings/
      SettingsPage/
        SettingsPage.tsx                  ← school info section, notification toggles, dark mode toggle

    calendar/
      CalendarPage/
        CalendarPage.tsx                  ← standalone full-page calendar (owns its own calMonth/calYear/selDay)

    packages/
      PackagesPage/
        PackagesPage.tsx                  ← package cards list with edit/active toggle

    profile/
      ProfilePage/
        ProfilePage.tsx                   ← header + editable sections + branches + certificates
        useProfilePage.ts                 ← profileData, profileEditing, profileDraft + startEdit/cancelEdit/saveEdit/removeCert

    offerings/
      OfferingsPage/
        OfferingsPage.tsx                 ← composes search bar + filter tabs + offering grid + modal
        useOfferings.ts                   ← offerings list + filter/search state + CRUD handlers
      OfferingCard/
        OfferingCard.tsx                  ← single offering card (code badge, name, desc, price, requirements, actions)
      OfferingFormModal/
        OfferingFormModal.tsx             ← add/edit offering modal (name/code/category/desc/price/duration/reqs/status)
        useOfferingForm.ts                ← ofName…ofStatus field state + oModal/oTarget

  hooks/
    useTheme.ts                           ← extracts T token construction from inline definition; returns T from dark boolean

  lib/
    constants.ts                          ← all seed data + config maps (TC, TB, MONTHS, WD_SHORT, PACKAGES, etc.)
    types.ts                              ← TypeScript interfaces: Booking, Instructor, Schedule, Transaction, Notification, Offering, SchoolProfile, Branch, Certificate, Academy
    utils.ts                              ← cn() already exists; add statusStyle, catColor, catBg helpers
```

---

## SOLID application notes

| Principle | How it applies here |
|---|---|
| **S — Single responsibility** | Each component renders one thing; each hook manages one concern. `ScheduleCalendar` only renders the grid — it does not own `calMonth` state or know about forms |
| **O — Open/Closed** | `TC`/`TB` colour maps and `statusStyle` in `constants.ts`/`utils.ts` are extended by adding entries, not by modifying badge components |
| **I — Interface segregation** | `StatCard` receives `label/value/sub/icon/color/urgent`, not the whole `bookings` array. `BookingRow` receives a single `Booking` + callbacks, not the full list |
| **D — Dependency inversion** | Page components depend on hook abstractions (`useBookings`, `useOfferings`) not on concrete state wiring. Swapping local state for Supabase is a hook-only change |

---

## Key architectural decision: shared cross-page data

`bookings` and `schedules` are read by multiple pages (Dashboard, Bookings, SchedulePage, CalendarPage all need them). `instructors` is read by InstructorsPage and used as a dropdown in ScheduleFormModal.

**Proposed approach:** `useAppShell.ts` owns `bookings`/`setBookings`, `schedules`/`setSchedules`, `instructors`/`setInstructors` alongside shell state (`dark`, `page`, `sideOpen`, `loggedIn`). AppShell passes them to pages as props. This mirrors what the monolith already does — no hidden complexity.

`CalendarPage` owns its own independent `calMonth`/`calYear`/`selDay` — it does not share state with `SchedulePage`. Both pages are never visible simultaneously.

---

## Key decisions to confirm before execution

1. **`useTheme` + ThemeContext** — Extract `T` construction to `hooks/useTheme.ts`; provide it via a `ThemeContext` in `AppShell.tsx`; consume via `useThemeContext()` in components. Eliminates prop-drilling `T` to every component. Confirm?

2. **Shared data in `useAppShell`** — `bookings`, `schedules`, `instructors` live in `useAppShell` and are passed as props to pages. No separate shared context for this breakdown pass. Confirm?

3. **`CalendarPage` has its own calendar state** — Independent of `SchedulePage`'s state. Each manages `calMonth`/`calYear`/`selDay` locally. Confirm?

4. **`ProfilePage`-specific sub-components stay inside `profile/`** — `SectionCard`, `SectionTitle`, and `Field` are only used in ProfilePage and are not promoted to `ui/`. Confirm?

5. **Mutation stubs** — Thin wrappers around existing `useState` mutations with the right shape to swap for Supabase later. No real API calls in this task. Confirm?

6. **`page.tsx` after extraction** — Shell only: renders `<LoginPage>` or `<AppShell>`. The `// @ts-nocheck` is removed from `page.tsx`; new component files use proper TypeScript. Confirm?

---

## Execution order (once confirmed)

1. Create `lib/types.ts`, `lib/constants.ts`, extend `lib/utils.ts`
2. Create `hooks/useTheme.ts`
3. Create `ui/` primitives: `StatCard`, `StatusBadge`, `FormLabel`, `SearchInput`, `FilterTabs`, `ModalOverlay`
4. Create `layout/` shell: `useAppShell`, `AppShell`, `Sidebar`, `TopBar`, `TabBar`
5. Create `auth/LoginPage` + `useLoginPage`
6. Create `dashboard/` components
7. Create `bookings/` components
8. Create `schedule/` components
9. Create `instructors/` components
10. Create `wallet/` components
11. Create `settings/`, `calendar/`, `packages/` (simpler pages — single file each)
12. Create `profile/` components
13. Create `offerings/` components
14. Rewrite `app/page.tsx` as thin shell
15. Run `npx tsc --noEmit` — verify 0 errors

---

## Completion checklist

- [ ] `lib/types.ts` created
- [ ] `lib/constants.ts` created
- [ ] `lib/utils.ts` extended
- [ ] `hooks/useTheme.ts` extracted
- [ ] All `ui/` primitives created
- [ ] `layout/` shell created
- [ ] `auth/LoginPage` created
- [ ] `dashboard/` components created
- [ ] `bookings/` components created
- [ ] `schedule/` components created
- [ ] `instructors/` components created
- [ ] `wallet/` components created
- [ ] `settings/SettingsPage` created
- [ ] `calendar/CalendarPage` created
- [ ] `packages/PackagesPage` created
- [ ] `profile/` components created
- [ ] `offerings/` components created
- [ ] `app/page.tsx` reduced to shell
- [ ] `npx tsc --noEmit` passes
