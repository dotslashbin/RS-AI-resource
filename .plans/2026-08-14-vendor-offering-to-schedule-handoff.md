# Vendor — Offering → Schedule handoff

**Date:** 2026-08-14
**App / scope:** `vendor/` only (Next.js web). No backbone, booker, command or mobile changes.
**Status:** COMPLETE (2026-08-15) — all items shipped and verified live by the user in the
dev server. One re-check outstanding, stated plainly under B10: `SchedulePromptModal` was
converted to Radix Dialog *after* that verification pass, so the prompt itself has not been
clicked in its final form.
**Baseline (2026-08-14):** `npx tsc --noEmit` exits 0; `npm test` 139/139 pass. Any
failure after this point is ours.
**After execution (2026-08-15):** `tsc --noEmit` exit 0; `npm test` **145/145** pass;
`npm run build` succeeds; ESLint adds **zero** new findings (the 3 on touched files are
pre-existing lines — `useOfferingsPage.ts:51`, `useScheduleForm.ts:36`, `AppShell.tsx:40`).

> After an Offering saves successfully, offer the vendor a one-click continuation
> into the Schedule modal for that offering — preselected, and in edit mode when
> the offering has exactly one schedule. Optimise for *continuity without a new
> obligation*: the save path for vendors who ignore the prompt must be unchanged.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker (core to the feature), I# = Important;
> numbers are plan-local — qualify cross-plan refs by app (e.g. "command I1").

---

## What was found before planning

Every claim below was read in the code, not recalled.

### Navigation — there is no router
`vendor` is a single-route app (`app/page.tsx` is 5 lines). `useAppShell` holds
`page: PageId` and swaps components in a `switch` (`AppShell.tsx:83-97`). Cross-page
handoff already exists and is the pattern to follow:

- `goPage(p, intent?)` sets the page and stamps a **one-shot** `PageIntent` with the
  page it is meant for (`useAppShell.ts:478-486`).
- The destination consumes it **once, at mount**, via a lazy `useState` initialiser —
  `useBookings.ts:56,63` and `useTransactionsPage.ts:67-68`.
- `DashboardPage` already receives `onNavigate: (page: PageId, intent?: PageIntent) => void`
  (`DashboardPage.tsx:27`) and `StaffPage` already navigates to Schedule
  (`AppShell.tsx:88`). Both are direct precedents for what Offerings needs.
- The URL mirror (`useAppShell.ts:463-476`) serialises **only** `page` + the dashboard
  range. `PageIntent` is never written to the URL, and `parseAppParams` only ever
  reconstructs `range`/`status` (`dashboardRange.ts:179-186`). A schedule arrival
  therefore cannot survive a refresh or be forged from a link — which is correct: a
  modal that re-opens on every reload of a bookmarked URL is a trap.

**No new navigation mechanism is needed, and none should be invented.**

### Data model — Offering → Schedule is one-to-**many**
`schedules.offering_id` is a plain FK with `ON DELETE RESTRICT` and **no unique
constraint** (`architecture/schema.md:450-470`). The existing
`countSchedulesForOffering()` (`schedules.service.ts:152`) exists precisely because a
count > 1 is normal. There is **no** "active/current schedule" concept in the schema —
`is_active` is a per-row soft-delete flag, not a "this is the one" marker. Any design
that assumes 1:1 is wrong against this schema. See **D2**.

### Detection is free — no new query
`useAppShell` already loads every active schedule for the vendor
(`useAppShell.ts:278`, `getSchedules` filters `is_active = true`,
`schedules.service.ts:72`) and passes the array to `SchedulePage`
(`AppShell.tsx:87`). Matching `s.offeringId === id` needs **zero** new network calls.
This mirrors `bookingCounts.ts` and `offeringStaff.ts`, which already derive
per-offering facts from shell-held arrays.

### The save response already identifies the offering
`createOffering` returns `{ id }` (`offerings.service.ts:46`), and
`useOfferingsPage.handleSave` already has it in hand on the add path
(`useOfferingsPage.ts:61-69`); the edit path has `item.id`. Nothing extra is needed
to know which offering was just saved.

### The Schedule modal already does most of the work
`ScheduleFormModal` takes `editSched: Schedule | null` and `offerings: Offering[]`, and
`useScheduleForm` resolves the offering from the array on edit
(`useScheduleForm.ts:23-40`). What it lacks is a way to **preselect an offering in
create mode** — that is the only gap. `getOfferings` does not filter by `is_active`
(`offerings.service.ts:35-44`), so an inactive offering is still findable in the picker.

---

## Gap review (2026-08-14, before approval)

The draft was re-read against the code looking for wording that a *poor* implementation
could still satisfy. Four real gaps, two false alarms. Each correction is folded into the
item it affects; recorded here so the reasoning survives.

**G1 — The prompt had two labels for three states. (Real — fixed in B3/B4.)**
The draft passed `hasSchedule: boolean`, collapsing D2's three branches into two. For the
"many" branch that produces a button reading **"Update schedule"** (singular) which then
opens **no modal at all** — the vendor clicks expecting a form and gets a filtered
calendar. That is a broken-feeling flow that the draft's own wording permitted. Fixed by
making the action three-way (`create` / `edit` / `browse`), so the "many" button says
"View schedules (3)" and the page it lands on is exactly what was promised.

**G2 — No feedback on the "many" branch. (Real — resolved by G1, no toast added.)**
The draft navigated, filtered, and said nothing, so an unexplained landing was the likely
outcome. The first instinct was an informational `toast()` on arrival. Rejected: G1 removes
the need entirely, because the button now states the destination. Adding a toast on top
would be explaining a surprise that no longer exists.

**G3 — `import type` in the new helper is load-bearing, not stylistic. (Real — B2.)**
Found by running the baseline, not by reading. `lib/types.ts:1-2` imports `./duration` and
`./utils` **without file extensions**, which `node --test --experimental-strip-types`
cannot resolve. The existing `lib/*.test.ts` suite only passes because every importer of
`types.ts` uses `import type`, which is erased before runtime. A future implementer
"tidying" the new helper into a plain value import would break all 139 tests, and the
draft's bare mention of "type-only" did not say why.

**G4 — Unspecified ordering around navigation. (Real — B4.)**
The draft listed `onNavigate(...)` and `setSavedOffering(null)` without fixing their order.
Clearing after navigating is a setState on a component the same commit unmounts. Harmless
in React 18, but it is sloppiness the plan should not license: clear first, then navigate.

**G5 — False alarm: stale shell `schedules` making the label wrong.**
Checked whether creating a schedule and then editing its offering would still read as
"no schedule". It does not: `useSchedulePage.refresh()` (`useSchedulePage.ts:44,76`) writes
back through the shell's `setSchedules`, so the array every surface reads stays current.
No cache-busting needed.

**~~G6 — False alarm: the new modal needs Escape-to-close.~~ ✖ WRONG — superseded by B10
(2026-08-15).**
The original reasoning was: `ModalOverlay` closes on backdrop click only, no modal in this
app handles Escape, so matching that is consistency rather than a new regression. That
checked the surrounding code and stopped there. `architecture/portals.md` had already
decided the opposite — `ModalOverlay` is being retired and a **new** modal must not adopt
it — and two modals (`GuideModal`, `OfferingPerformanceModal`) already followed that. The
"consistency" this cited was consistency with the thing the docs are moving away from.
Kept rather than deleted, because the failure mode is worth remembering: **a convention
can live in `architecture/*.md` and nowhere in the code you are reading.** Now also
recorded in `architecture/conventions.md` under Component Conventions, so the code-only
route reaches it too.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line remains — plan-authoring §7. -->

- **D1 — Prompt shape** → **Small follow-up modal** (resolved 2026-08-14). Offering form
  closes on success, then a compact dialog states the offering is saved and offers the
  continuation. Chosen over a sonner toast-with-action (missable; toasts are error/notification-only
  in this app today — only use is `useAppShell.ts:400`) and over dual footer buttons
  (would commit the vendor before the save result is known, contradicting the "only after
  success" requirement).
- **D2 — Offering with multiple schedules** → **1 schedule → edit it; >1 → filter, no modal**
  (resolved 2026-08-14). Zero schedules opens the create modal preselected; exactly one opens
  that schedule in edit mode; more than one navigates to Schedule with the offering's filter
  applied and **no** modal, so the vendor chooses which of their own schedules to edit.
  Rationale: the schema supports many and names no "current" one, so auto-picking would
  silently open the wrong schedule for editing.
- **D3 — Wording** → **"Not now" / "Set up schedule" | "Update schedule"** (resolved 2026-08-14).
  "Save only" reads wrong on a prompt that appears *after* the save has already committed.
  Matches the existing voice: "New schedule" / "Create a schedule for your offering"
  (`DayDetailPanel.tsx:65-68`).
- **D4 — Seeding the Schedule page's own filter bar** → **only when the offering has a
  non-empty category** (resolved 2026-08-14). The offering-pill row renders only while a
  category is selected (`SchedulePage.tsx:52`), so filtering by an uncategorised offering
  would leave the vendor with an active filter and no visible control to clear it.
  `category` is vendor-defined free text and may be `""` (`useOfferingsPage.ts:45` filters
  falsy ones out of the chip list), so this case is real, not theoretical.

No open decisions remain.

---

## BLOCKERS

### B1 — `PageIntent` gains a schedule arrival  ✅ DONE (2026-08-15)
<!-- Added ScheduleArrival + PageIntent.schedule to lib/types.ts:71-101.
     Verified machine: npx tsc --noEmit exit 0. -->

**File:** `vendor/lib/types.ts:71-75`

`PageIntent` today carries only `range` and `status`. The Schedule page needs four
facts on arrival: which offering, whether to open the modal, whether that is create or
edit, and which schedule to edit.

**Fix approach:** add one optional field, and a small interface beside it:

```ts
/**
 * Handoff from the Offerings page into the Schedule page's own modal.
 *
 * NEVER URL-serialised — serialiseAppParams writes only page/from/to/status, and
 * parseAppParams reconstructs only those. That is deliberate: a query parameter
 * that re-opens a modal would re-open it on every reload of a bookmarked link.
 */
export interface ScheduleArrival {
  offeringId: string
  /** The single schedule to edit, when the offering has exactly one. Absent = create mode. */
  scheduleId?: string
  /** False when the offering has several schedules — filter only, no modal (D2). */
  openModal: boolean
}

export interface PageIntent {
  range?:  PhDateRange
  /** Bookings only; ignored by every other page. */
  status?: BookingFilterKey
  /** Schedule only; ignored by every other page. */
  schedule?: ScheduleArrival
}
```

`openModal` is carried explicitly rather than derived at the destination so the D2 rule
lives in exactly one place (B2) — the Schedule page does not re-implement it.

**Verification:** `npx tsc --noEmit` (machine-verifiable).

---

### B2 — `scheduleLinkFor()` — the D2 rule as one pure, tested function  ✅ DONE (2026-08-15)
<!-- Created lib/offeringSchedules.ts + offeringSchedules.test.ts (6 cases: empty,
     all-other-offerings, exactly one, many, count-only-matching, no-mutation).
     Verified machine: npm test 145/145 pass (139 baseline + 6 new); tsc exit 0.
     The G3 import-type constraint is documented in the file itself. -->

**New file:** `vendor/lib/offeringSchedules.ts` (+ `offeringSchedules.test.ts`)

Both ends need the same fact: Offerings needs it for the button label, and the intent
needs it for `openModal`/`scheduleId`. Putting it in `lib/` follows the established
pattern for derived-from-shell-array facts — `lib/bookingCounts.ts` and
`lib/offeringStaff.ts` exist for exactly this reason, and `bookingCounts.ts:16-18`
records why (`node --test` has no bundler and cannot resolve the `@/` alias, so a
unit-tested helper must not sit beside a `@/lib/supabase/client` import).

**Fix approach:**

```ts
import type { Schedule } from "./types.ts"   // ⚠️ `import type` — see below

export type ScheduleLink =
  | { kind: "none" }
  | { kind: "one";  scheduleId: string }
  | { kind: "many"; count: number }

export function scheduleLinkFor(schedules: Schedule[], offeringId: string): ScheduleLink
```

⚠️ **`import type` is load-bearing here, not a style choice (G3).** `lib/types.ts:1-2`
imports `./duration` and `./utils` **without file extensions**, which
`node --test --experimental-strip-types` cannot resolve. The existing suite passes only
because type-only imports are erased before runtime. Importing any *value* from
`types.ts` — or dropping the `type` keyword — breaks all 139 tests, and the failure will
look nothing like its cause. The comment in the file must say so.

The three-way return is what B3/B4 need to label the prompt correctly; a boolean
"has a schedule" cannot express the "many" branch (G1).

⚠️ **What "has a schedule" means here.** The input is the shell's array, which is
`is_active = true` only (`schedules.service.ts:72`). An offering whose only schedule is
inactive therefore reads as `none` and gets the create flow. That is the correct answer,
not a bug: the Schedule page shows only active schedules, so offering to "update" one the
vendor cannot see would be incoherent. This deliberately differs from
`countSchedulesForOffering()` (`schedules.service.ts:152`), which counts **all** rows
because it answers a different question (would a granularity flip strand a stored row).
Both behaviours are correct for their own caller; the comment must say so.

**Verification:** `npm --prefix vendor test` — cases: none, one, many, empty array,
unrelated offering ids, inactive-only (i.e. absent from the input) (machine-verifiable).

---

### B3 — `SchedulePromptModal` — the post-save prompt  ✅ DONE (2026-08-15)
<!-- Created components/offerings/SchedulePromptModal/SchedulePromptModal.tsx.
     Three-way action + PROMPT_COPY table; ships as .tsx alone (pure display).
     Verified machine: tsc exit 0, eslint clean. Copy/theme/44px = live check (Stage 4). -->

**New files:** `vendor/components/offerings/SchedulePromptModal/SchedulePromptModal.tsx`

Placed under `offerings/` rather than `schedule/`: it is part of the Offering save flow
and is owned by `OfferingsPage`. It does not schedule anything itself — **no second
schedule-editing UI is introduced**; it only routes into the existing one.

**Fix approach:** reuse `ModalOverlay` (`components/ui/ModalOverlay/ModalOverlay.tsx`) and
the `sp-card` / `btn-primary` / `sp-pill` token classes the two existing modals use.

```
┌──────────────────────────────┐
│  ✓ Offering saved            │
│  Set up when "<name>" is     │
│  available?                  │
│      [ Not now ] [ Set up    │
│                   schedule ] │
└──────────────────────────────┘
```

Props: `offeringName: string`, `action: "create" | "edit" | "browse"`, `count: number`,
`onDismiss: () => void`, `onContinue: () => void`.

**Three actions, not a boolean (G1).** Each D2 branch gets copy that matches what actually
happens on the other side, so the button never promises a modal the vendor will not get:

| `action` | When | Primary button | Body |
|---|---|---|---|
| `create` | no active schedule | **Set up schedule** | Set up when "<name>" is available? |
| `edit` | exactly one | **Update schedule** | Update when "<name>" is available? |
| `browse` | two or more | **View schedules ({count})** | "<name>" has {count} schedules — pick the one to update. |

The copy table is a module-level constant in the `.tsx`, following the existing
`PATTERN_CHOICES` precedent (`OfferingFormModal.tsx:22-33`) — static copy beside the markup
that renders it, while the *choice* of which row applies stays in the hook (B4).

**Component separation** (`component-separation` §4 — stated, not assumed): this is a
**pure display component** and correctly ships as a `.tsx` alone. It has no `useState`,
no `useEffect`, no data access, and defines **no handler bodies** — it wires two callbacks
supplied by `useOfferingsPage` (B4) onto `onClick`. All styling is Tailwind token classes;
there is no static inline `style={{}}`. If it ever gains state it gains a
`useSchedulePromptModal.ts` at the same time.

**Verification:** rendered in both themes and at 360px width; see I3 (needs live browser).

---

### B4 — `useOfferingsPage`: hold the saved offering, decide the handoff  ✅ DONE (2026-08-15)
<!-- savedOffering state + promptLink/promptAction/promptCount + dismissPrompt +
     continueToSchedule (clears before navigating, G4). Both success paths converge on
     one setSavedOffering; every failure path still returns early.
     Verified machine: tsc exit 0, eslint clean. Failure-path behaviour = live check. -->

**File:** `vendor/components/offerings/OfferingsPage/useOfferingsPage.ts:58-98`

`handleSave` currently ends at `setOModal(null)` (line 97) on **both** the add and edit
success paths, and returns early on every failure path (lines 63-68, 88, 94). That early-return
structure is what makes "never prompt on failure" a one-line property rather than a new
guard: the prompt is set **only** on the line that already means "the save committed".

**Fix approach:**

1. New state `const [savedOffering, setSavedOffering] = useState<Offering | null>(null)` —
   the prompt's target and its own open/closed condition (one fact, not two). Deliberately
   **not** folded into `oModal`, for the reason already recorded at lines 24-27 for
   `perfTarget`: overloading that discriminator lets two modals open at once.
2. Add path: after `setOfferings(p => [...p, { ...item, id }])`, capture `{ ...item, id }`
   — the real database id, not `""`.
3. Edit path: capture `item` after the successful `updateOffering`.
4. At line 97, alongside `setOModal(null)`, `setSavedOffering(saved)`.
5. New handlers:
   - `dismissPrompt = () => setSavedOffering(null)` — closes the prompt and nothing else.
     **This is the "save only" path and it must remain byte-for-byte the current
     behaviour**: the offerings array was already updated, the form already closed.
   - `continueToSchedule = () => { … }` — computes `scheduleLinkFor(schedules, saved.id)`
     (B2), builds the `ScheduleArrival`, **clears `savedOffering` first, then calls
     `onNavigate("schedule", { schedule })`** — that order, not the reverse (G4): navigating
     unmounts this page in the same commit, so clearing afterwards is a setState on a dead
     component. Harmless in React 18, but not something the plan should license.
6. Derived `promptLink = savedOffering ? scheduleLinkFor(schedules, savedOffering.id) : null`,
   mapped to the `action`/`count` props B3 takes (`none`→`create`, `one`→`edit`,
   `many`→`browse`). The label and the destination are computed from **one** call to the
   same helper, so they cannot disagree — a button reading "Update schedule" that lands on
   a page with no modal is precisely the failure G1 caught.
7. Hook signature gains `schedules: Schedule[]` and
   `onNavigate: (page: PageId, intent?: PageIntent) => void`.

**Component separation:** all of the above is hook-side; `OfferingsPage.tsx` gains no logic.

**Verification:** type-check; manual — save an offering with 0 / 1 / 2+ schedules and
confirm the label and destination; force a save failure (duplicate code, or offline) and
confirm **no** prompt appears (needs live environment).

---

### B5 — `OfferingsPage.tsx`: render the prompt, accept the new props  ✅ DONE (2026-08-15)
<!-- schedules + onNavigate props threaded to the hook; prompt rendered after the form
     modal block. Render layer still free of state/handlers/inline styles.
     Verified machine: tsc exit 0, eslint clean. -->

**File:** `vendor/components/offerings/OfferingsPage/OfferingsPage.tsx:11-17,102-111`

**Fix approach:** add `schedules: Schedule[]` and `onNavigate` to `OfferingsPageProps`,
pass both through to `useOfferingsPage`, and render below the existing
`{oModal && <OfferingFormModal … />}` block:

```tsx
{savedOffering && promptLink && (
  <SchedulePromptModal
    offeringName={savedOffering.name}
    action={promptAction}
    count={promptCount}
    onDismiss={dismissPrompt}
    onContinue={continueToSchedule}
  />
)}
```

Mutually exclusive with the form modal by construction — `setOModal(null)` and
`setSavedOffering(saved)` happen in the same commit, so the form is gone before the
prompt renders.

**Component separation:** the `.tsx` stays a pure render layer — no new hooks, no handler
bodies, no inline styles.

**Verification:** type-check; visual check in both themes (needs live environment).

---

### B6 — `AppShell`: Offerings-side wiring  ✅ DONE (2026-08-15)
<!-- AppShell.tsx:93 now passes schedules={schedules} onNavigate={goPage}. No new
     shell state, no new fetch. Verified machine: tsc exit 0. -->

**File:** `vendor/components/layout/AppShell/AppShell.tsx:93`

**Fix approach:** one line —

```tsx
case "offerings": return <OfferingsPage vendorId={selectedVendorId ?? ""} bookings={bookings} staff={staff} schedules={schedules} onNavigate={goPage} />
```

`schedules` and `goPage` are already destructured in the same component (line 40) and
already handed to other pages (`schedules` → `SchedulePage`/`DashboardPage`/`CalendarPage`;
`goPage` → `DashboardPage` as `onNavigate`). No shell state, no new fetch.

**Verification:** type-check; the prompt navigates to the Schedule page (which ignores the
intent until B7/B9 land — an intentional, harmless intermediate state).

---

### B7 — `useSchedulePage`: consume the arrival, once, after offerings resolve  ✅ DONE (2026-08-15)
<!-- arrivalRef + schedulesRef + presetOfferingId; handoff applied inside the
     getOfferings callback exactly as specified. Verified machine: tsc 0, eslint clean,
     next build passes. Three-branch behaviour = live check, still outstanding.
     Two deviations from the written plan, both additive — see B7a/B7b below. -->

#### B7a — `setShowSF` added to the effect deps  ✅ DONE (2026-08-15)
Not in the written plan; surfaced by ESLint. The new effect calls `setShowSF`, which
arrives from `useSchedule()` rather than a local `useState`, so `react-hooks/exhaustive-deps`
cannot prove it is stable and flagged it. Listed in the deps rather than silenced with a
disable comment — it is referentially stable so the effect's behaviour is unchanged, and
the rule stays useful for the next person. Verified: warning gone, `tsc` 0.

#### B7b — `handleSave` also clears `presetOfferingId`  ✅ DONE (2026-08-15)
Not in the written plan. `handleSave` closes the form by setting `editSched`/`showSF`
directly rather than calling `closeForm`, so the preset would have survived a save.
Harmless today — every path that re-opens the form (`openAdd`, `openEdit`) clears it
first — but it left stale state one refactor away from seeding a form nobody asked to be
seeded. One line, added for the same reason `closeForm` clears it.

**File:** `vendor/components/schedule/SchedulePage/useSchedulePage.ts:12-48`

The page mounts fresh on navigation, so a mount-time seed is the right shape — but
`offerings` is fetched asynchronously (lines 24-27) while `schedules` arrives
synchronously as a prop. The arrival needs the **offering** (for its category, and for the
modal's preselect), so it cannot be a lazy `useState` initialiser.

**Fix approach:** hook signature gains `arrival?: PageIntent | null`. Consume it inside the
existing offerings fetch, guarded one-shot by a ref:

```ts
const arrivalRef = useRef<ScheduleArrival | null>(arrival?.schedule ?? null)
const [presetOfferingId, setPresetOfferingId] = useState<string | null>(null)

useEffect(() => {
  if (!vendorId) return
  getOfferings(vendorId).then(({ data }) => {
    setOfferings(data)

    // One-shot. Cleared before use, so a vendor switch (which re-runs this effect)
    // cannot replay a handoff the vendor completed minutes ago — the same
    // consumed-once contract PageIntent already documents (types.ts).
    const a = arrivalRef.current
    if (!a) return
    arrivalRef.current = null

    const offering = data.find(o => o.id === a.offeringId)
    if (!offering) return                                    // I2

    if (offering.category) {                                 // D4
      setFilterCat(offering.category)
      setFilterOffering(offering.id)
    }
    if (!a.openModal) return                                 // D2 "many" branch

    setPresetOfferingId(offering.id)
    setEditSched(a.scheduleId ? schedulesRef.current.find(s => s.id === a.scheduleId) ?? null : null)
    setShowSF(true)
  })
}, [vendorId])
```

⚠️ **Two load-bearing assumptions, stated so they are not broken by accident.**

1. **The Schedule page mounts fresh on every navigation.** `AppShell.tsx:83-97` renders a
   single page from a `switch`, so arriving unmounts Offerings and mounts Schedule. That is
   what makes mount-time, one-shot seeding correct — and it is the same assumption
   `PageIntent` already documents (`types.ts:53-76`). If page keep-alive or component
   caching is ever introduced, this seeding silently stops firing.
2. **The modal opens only after `offerings` resolves** — not incidental, see I1. `schedulesRef` mirrors the `schedules` prop so the async callback does not close
over a stale array (the same technique `useAppShell.ts:171-172` uses for `bookingsRef`).

`closeForm` (line 48) must also clear `presetOfferingId`, so re-opening the form manually
afterwards starts blank.

**Accepted cost:** one network round-trip between the click and the modal appearing. The
page is not blank while it waits — the calendar renders immediately from the shell's
schedules, and (when categorised) with the filter already applied, so the vendor sees the
right context first and the modal a moment later. Ruled acceptable over the alternative
(hoisting `offerings` to the shell), which is a cross-page refactor — see DEFERRED.

**Component separation:** all logic stays in the hook; `SchedulePage.tsx` only forwards a
prop (B9).

**Verification:** type-check; manual for all three D2 branches (needs live environment).

---

### B8 — `ScheduleFormModal` / `useScheduleForm`: preselect an offering in create mode  ✅ DONE (2026-08-15)
<!-- Optional presetOfferingId on both; create branch added after an early `return` in
     the existing effect, latched by presetDone. Existing manual call site untouched.
     Verified machine: tsc 0, eslint clean (the one error in this file is the
     pre-existing setSfDate at :36). Form-shape behaviour = live check. -->

**Files:** `vendor/components/schedule/ScheduleFormModal/useScheduleForm.ts:7-40`,
`ScheduleFormModal.tsx:11-47`

The hook resolves the offering only on the edit path (`useScheduleForm.ts:38`). Create mode
has no way to start with one selected.

**Fix approach:** optional third parameter `presetOfferingId?: string`, threaded from an
optional `presetOfferingId?: string` prop on `ScheduleFormModal`. Both optional, so the
existing manual-open call site (`SchedulePage.tsx:119-130`) is unaffected — Open/Closed,
and no existing behaviour is modified.

```ts
const presetDone = useRef(false)

useEffect(() => {
  if (editSched) { /* …existing block, unchanged… */ return }
  if (!presetOfferingId || presetDone.current) return
  const o = offerings.find(x => x.id === presetOfferingId)
  if (!o) return                                  // I2 — offerings not in yet, or gone
  presetDone.current = true
  setSfOffering(o)
  setSfTitle(o.name)
}, [editSched, offerings, presetOfferingId])
```

`setSfOffering` + `setSfTitle` rather than calling `selectOffering(o)` — **verified
equivalent from a null start** against `useScheduleForm.ts:47-69`: `prevDateGranular` is
`null` so the granularity-clearing branch is skipped, `!sfTitle` is true so it sets the
same title, and `setSfInst("")` is a no-op on an already-empty field. Calling
`selectOffering` from an effect would additionally mean reading `sfOffering` state that is
not in the dependency array.

The `presetDone` ref is what stops a re-run from overwriting a title the vendor has since
edited. Everything downstream — `dateGranular`, the form's two shapes, `saveBlocker`,
`slots` — is already derived from `sfOffering`, so preselecting is all that is required
for the correct half of the form to render (`useScheduleForm.ts:45`).

**Per the brief §2:** no other field is pre-populated in create mode. `sfDate` stays empty,
so `saveBlocker` reads "Pick a date." (`useScheduleForm.ts:98`) — the normal, existing
create-mode state.

**Component separation:** hook owns the state and the effect; the `.tsx` only forwards the
new prop.

**Verification:** type-check; manual — the picker shows the right offering selected, the
correct (time vs date) half of the form renders, and the title defaults to the offering
name (needs live environment).

---

### B9 — `SchedulePage` + `AppShell`: Schedule-side wiring  ✅ DONE (2026-08-15)
<!-- arrival prop forwarded to the hook, presetOfferingId to the modal, and
     AppShell.tsx:87 now passes arrival={intentFor("schedule")}.
     Verified machine: tsc 0, next build passes. -->

**Files:** `vendor/components/schedule/SchedulePage/SchedulePage.tsx:11-28,119-130`,
`vendor/components/layout/AppShell/AppShell.tsx:87`

**Fix approach:**
- `SchedulePageProps` gains `arrival?: PageIntent | null`, forwarded to `useSchedulePage`.
  This mirrors `BookingsPage.tsx:15` and `TransactionsPage.tsx:17` exactly.
- Pass `presetOfferingId={presetOfferingId}` to `ScheduleFormModal`.
- `AppShell.tsx:87` gains `arrival={intentFor("schedule")}` — `intentFor` already scopes
  the intent to the destination page, so a stale arrival cannot leak onto Schedule from a
  different navigation (`useAppShell.ts:485-486`).

**Verification:** type-check; end-to-end walk of the whole flow (needs live environment).

---

## IMPORTANT

### I1 — Pre-existing: `useScheduleForm`'s reset effect fires on every `offerings` change  ✅ DONE (2026-08-15) — confirmed avoided, deliberately not fixed
**File:** `vendor/components/schedule/ScheduleFormModal/useScheduleForm.ts:23-40`

The edit-seeding effect depends on `[editSched, offerings]` and re-seeds **every** field
whenever `offerings` changes identity. Today this is unreachable: the Schedule page fetches
offerings once on mount and the modal is only ever opened by a later user click, so the
array is already stable before the modal exists.

**This feature is the first thing that could open that modal while the fetch is still in
flight** — and if it did, the array landing would wipe anything the vendor had typed in the
intervening moments.

**Decision: avoid it, do not fix it.** B7 opens the modal from *inside* the fetch callback,
so `offerings` is settled before the modal mounts and the effect's re-run is impossible on
this path too. Rewriting that effect's dependency contract is a behaviour change to a
working shared component, outside the "surgical changes" this task calls for. Recorded here
so the ordering in B7 is understood as **load-bearing** by whoever next edits it — reordering
it to "open the modal, then fetch" would reintroduce the hazard.

---

### I2 — The offering or schedule can vanish between the two pages  ✅ DONE (2026-08-15) — implemented; live confirmation outstanding
<!-- Three fallbacks in code: offering absent from the fetch -> whole handoff dropped
     (useSchedulePage); scheduleId absent from schedules -> `?? null` -> create mode;
     preset offering absent in useScheduleForm -> `return`, form stays on defaults.
     Verified machine: tsc 0, all three are total (no throw path). Reproducing the race
     itself needs two browser sessions — see Verification. -->

**Files:** `useSchedulePage.ts` (B7), `useScheduleForm.ts` (B8)

Two real races, both handled by fallbacks rather than errors:

1. **Offering not in the fetched list** — deleted in another tab, or the fetch failed
   (`getOfferings` returns `{ data: [], error }` and the current call site discards the
   error, `useSchedulePage.ts:26`). → Ignore the arrival entirely: no filter, no modal. The
   vendor lands on a working Schedule page. A modal preselected to nothing would be worse.
2. **`scheduleId` no longer in `schedules`** — deleted, or deactivated, between the prompt
   and the arrival. → `?? null` falls through to **create mode, preselected**. Coherent:
   the offering genuinely has no active schedule any more, which is exactly what create mode
   is for.

Neither case throws, and neither leaves a half-opened modal.

**Verification:** unit-testable at the helper level (B2); the fallbacks themselves need a
live environment or a deliberate stub.

---

### I3 — Accessibility and theming of the new prompt  ✅ DONE (2026-08-15)
<!-- Static checks below, plus the user's live pass in the dev server. The focus-trap /
     Escape / scroll-lock half was closed by B10's Radix conversion, not by this item. -->

<!-- Statically verified by grep/read: both buttons carry min-h-[44px]; no hardcoded
     hex and no inline style={{}} in the file; primary/subordinate split is
     btn-primary vs sp-pill; both controls are real <button>s; the tick is decoration
     beside the words "Offering saved", never the only signal. text-emerald-500 matches
     the seven existing success usages (e.g. PendingApprovalsCard.tsx:44).
     ⏳ NOT verified: rendered contrast, light/dark appearance, 360px layout. Needs a
     browser with a signed-in vendor — see the honest-gap note in Verification. -->

**File:** `SchedulePromptModal.tsx` (B3)

Against `ux-design` §5-§6, and matching what `DayDetailPanel.tsx:53-70` already had to fix
(a 28px primary action was called out as failing the 44px minimum):

- Both buttons ≥ 44px tall.
- "Set up schedule" is `btn-primary`; "Not now" is the subordinate bordered/`sp-pill`
  variant — one clear primary action, and dismissal never disguised as the primary.
- Colour tokens only (`text-sp-strong`, `text-sp-text`, `sp-card`, `--sp-divider`); no
  hardcoded hex. Verify in light **and** dark.
- The confirmation is carried by the words "Offering saved", not by a green tick alone.
- Both buttons are real `<button>`s, so keyboard reach and Enter/Space come free.
- `ModalOverlay` closes on backdrop click (`ModalOverlay.tsx:11-14`); that maps to
  "Not now", which is the safe default — nothing is lost, the offering is already saved.

**Verification:** needs a live browser at 360px and desktop, both themes.

---

### I4 — Copy must not imply the save is conditional  ✅ DONE (2026-08-15)
<!-- Heading is "Offering saved" (completed fact). Grep confirms the word "Save"
     appears nowhere on a control — its only occurrence in the file is inside the
     block comment explaining why. Buttons: "Not now" + one of "Set up schedule" /
     "Update schedule" / "View schedules (n)". Verified machine (grep) + read. -->

**File:** `SchedulePromptModal.tsx` (B3)

The brief's §4 requirement, and the reason D3 rejected "Save only": by the time this modal
renders, `createOffering`/`updateOffering` has already committed and the offerings list has
already been updated. The heading states the completed fact ("Offering saved"); the question
below is unmistakably about a separate, optional next step; and neither button uses the word
"Save".

**Verification:** copy review (human).

---

### B10 — `SchedulePromptModal` built on the wrong modal primitive  ✅ DONE (2026-08-15) — needs one re-click
**File:** `components/offerings/SchedulePromptModal/SchedulePromptModal.tsx`

**Found after the feature was already verified working**, while cross-checking the docs.
`architecture/portals.md` records that `ModalOverlay` lacks a focus trap, Escape handling
and scroll lock, that the three form modals using it are *pending conversion*, and that a
**new** modal must not adopt the weaker primitive to match them. `GuideModal` and
`OfferingPerformanceModal` — the latter a sibling in this very folder — both follow that.
This modal shipped on `ModalOverlay` anyway.

**How it was missed, recorded so the next plan does better.** The gap review looked at the
surrounding *code* (`ModalOverlay` is still the majority) and concluded "consistent". It
did not check `architecture/*.md`, where the decision explicitly says the majority is the
thing being retired. Plan-authoring §2 requires that cross-check precisely here, and item
**G6** of the gap review reached the wrong conclusion as a direct result — it dismissed the
missing Escape key as acceptable consistency. G6 is wrong; this item supersedes it.

**Fix applied (2026-08-15):** rebuilt on `@radix-ui/react-dialog` (already a dependency),
mirroring `OfferingPerformanceModal` — `Dialog.Root`/`Portal`/`Overlay`/`Content`, with
`Dialog.Title` and `Dialog.Description` supplying the accessible name, and "Not now" as a
`Dialog.Close` so Escape, the overlay and the button all resolve to the same safe
dismissal. The `sp-card` shell is unchanged, so it stays visually identical.

**Verified machine:** `tsc --noEmit` exit 0, ESLint clean, `npm run build` compiles.
⏳ **Not re-verified live:** the user's dev-server pass predates this change. Worth one
click of the prompt — specifically that after **Set up schedule** the Schedule page is
fully interactive, since Radix manages scroll-lock/`pointer-events` on the body and this
modal unmounts while open rather than closing first.

> **Update (2026-08-15) — this re-check is now BROADER than written above.** When it was
> written, `OfferingFormModal` was still hand-rolled, so the handover was one hand-rolled
> modal → one Radix modal. Both ends are now Radix
> (`.plans/2026-08-15-vendor-form-modals-to-radix-dialog.md` B1), and `ScheduleFormModal`
> — which the arrival auto-opens — is Radix too. So the whole flow is a Radix→Radix→Radix
> chain in which body scroll-lock and `pointer-events` are refcounted across three
> dialogs. Do not treat the older single-click note as sufficient; the check lives in that
> plan's **stage 7** and covers the full chain.

**Follow-up this raises:** the three form modals are still on `ModalOverlay` and still
pending conversion. Out of scope here — now planned separately in
`.plans/2026-08-15-vendor-form-modals-to-radix-dialog.md`, which also picks up this item's
outstanding re-check (the Radix→Radix handover from the offering form into this prompt).

---

## DEFERRED / COSMETIC

- **`offerings` is fetched twice** — once by `useOfferingsPage.ts:32` and again by
  `useSchedulePage.ts:26`, for the same vendor. Hoisting it to `useAppShell` beside
  `schedules`/`staff` would remove the duplicate *and* the B7 round-trip. Deferred: it
  touches every offerings consumer and is a refactor, not this feature. Acceptable for now
  because the extra fetch already happens today on every visit to the Schedule page.
- **The "many schedules" branch does not auto-open a modal** (D2). Accepted: with several
  schedules there is no non-arbitrary choice, and the filter still removes all the manual
  searching, which is the actual complaint being solved.
- **The handoff does not survive a page reload.** Deliberate (B1) — a URL parameter that
  re-opens a modal would fire on every reload of a bookmarked link.
- **`ezzy-vendor-mobile` gets no equivalent flow.** Out of scope by instruction (vendor web
  only). Worth a follow-up plan if the flow proves useful.
- **No prompt on the Offerings card's inline status toggle** (`useOfferingsPage.ts:108`).
  That is a one-click activate/deactivate, not a save flow; a modal there would be noise.

---

## Execution order

Ordered by dependency, each stage independently type-checkable. Per
`developerboss`, **one stage at a time by default** — say if you want a range or the lot.

1. **Stage 1 — data model + rule.** B1, B2. No UI. Ends machine-verified
   (`tsc --noEmit` + `npm test`).
2. **Stage 2 — the prompt appears.** B3, B4, B5, B6. Ends with the prompt showing after a
   successful save and navigating to the Schedule page; the intent is not yet consumed
   there (harmless — the vendor simply lands on Schedule).
3. **Stage 3 — the modal opens preselected.** B7, B8, B9. Ends with the full flow working
   for all three D2 branches.
4. **Stage 4 — polish and verification pass.** I2 fallbacks confirmed, I3 a11y/theme check,
   I4 copy review. I1 requires no code — confirm B7's ordering is intact and commented.

No approval gates are crossed: no schema change, no migration, no new dependency, no RLS or
auth surface, no service-role key, and no second app. Every file touched is under `vendor/`.

---

## Verification

| Item | Check | Kind |
|---|---|---|
| B1 | `npx tsc --noEmit` in `vendor/` — still exit 0 | machine |
| B2 | `npm --prefix vendor test` — still **139 + new**, 0 fail. New cases: none / one / many / empty array / unrelated offering ids | machine |
| B2 | the suite still runs at all — a value import from `types.ts` breaks every test (G3) | machine |
| B3, B5 | type-check; all three `action` variants render the right copy (G1); both themes at 360px and desktop | machine + live |
| B4 | prompt appears **only** after a successful save; forced failure shows the existing error and **no** prompt | live |
| B4 | "Not now" leaves the app in exactly the pre-feature state (form closed, list updated, no navigation) | live |
| B6, B9 | type-check; `intentFor("schedule")` delivers only to Schedule | machine + live |
| B7 | 0 schedules → create modal, offering preselected; 1 → edit modal with that schedule's values; 2+ → filtered page, no modal — **and the button said "View schedules" beforehand** (G1) | live |
| B7 | uncategorised offering → filters stay "all", modal still preselected (D4) | live |
| B7 | arrival is one-shot: navigate away and back manually → no modal | live |
| B8 | correct half of the form renders (time vs date) for a date-granular offering | live |
| I2 | delete the offering/schedule in a second tab mid-flow → no crash, sensible fallback | live |
| I3 | 44px targets, contrast, keyboard, both themes | live |

**Regression surface to re-check by hand** (all pre-existing behaviour that must be
unchanged): the manual "New schedule" button (`DayDetailPanel.tsx:61`), manual schedule
edit, the I8 granularity-flip block (`useOfferingsPage.ts:81-92`), and the I12
stranded-bookings warning (`useSchedulePage.ts:57-69`) — none of these paths are modified,
but B8 and B7 touch files they live in.

`vendor/visual-tests/` snapshots are unaffected: the new modal is not on `/ui-gallery` and
appears only after an interactive save.

### Live verification (2026-08-15)

**Run by the user in the dev server: the feature works.** That covers the rows this
session could not reach — the prompt appearing only on success, the three D2 branches
landing where the button promised, the offering preselected in the modal, the form's
correct half rendering, the D4 filter seeding, and the one-shot holding.

**One re-check outstanding:** `SchedulePromptModal` was converted to Radix Dialog (B10)
*after* that pass, so the prompt has not been clicked in its final form. Everything around
it is untouched. See B10 for the specific thing worth watching.

**Optional follow-up, not done:** adding `SchedulePromptModal` to `/ui-gallery` would give
its three variants snapshot coverage and a theme check without a login — the cheapest way
to keep I3 honest as the component changes. Out of the approved scope.
