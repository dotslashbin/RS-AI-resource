# Vendor Mobile — Booking Action Bar Hidden Behind the Floating Tab Bar

**Date:** 2026-08-02
**App / scope:** `ezzy-vendor-mobile` only. No other app, no schema, no backbone.
**Status:** IN PROGRESS — B1, I1, I2, I3 code complete (2026-08-02). **Every item
is 🔄, not ✅: none of it has been seen on a device, and this plan exists
precisely because machine checks cannot see this bug.** I4 is ⬜, blocked on that
device pass.

> The approve/reject buttons exist, are wired correctly, and render — they are
> drawn underneath the floating tab bar. Optimize for *never ship a bottom-pinned
> control without the tab-bar inset again*, not just for this one screen.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "command I1").

---

## 0. Answering the question: was it an oversight?

**Yes — but a device-verification oversight, not a missing feature.**

Nothing is unimplemented. Tracing the whole path for a `pending` booking:

| Layer | State |
|---|---|
| Service | `approveBooking` / `rejectBooking` — `bookings.service.ts:71,77` ✅ |
| Action hook | `approve` with the 4s deferred commit, `reject` with the reason sheet — `useBookingActions.ts:158,194` ✅ |
| Screen hook | `approve: approveBookingFromBar`, `reject` both returned — `useBookingDetail.ts:84-92` ✅ |
| Bar hook | `useBookingActionBar` wires both ✅ |
| **Render** | `BookingActionBar.tsx:47-92` — `if (booking.status === "pending")` returns an **Approve** and a **Reject** `Pressable` ✅ |
| **Layout** | ❌ **the bug** |

You reached the screen from the Dashboard's "Waiting for approval" section
(`DashboardView.tsx:102`), which is fed by `useBookingsQuery(vendorId,
PENDING_ONLY)` — strictly `status = 'pending'`. So the status is right and the
`pending` branch above *is* the one rendering. The buttons are on screen; they
are just underneath something.

**Where my earlier "full parity" claim was wrong.** I verified parity at the
service and hook layers, and later read the render layer's branching. I never
checked **layout**, and I stated the actions were reachable without ever having
seen the screen. AGENTS is explicit that this exact class of bug passes `tsc`,
`expo lint`, `npm test` and `expo export` — and it did. The claim should have
carried the device caveat every other claim in this session carried.

---

## BLOCKERS

### B1 — The action bar renders beneath the absolutely-positioned tab bar  🔄 IN PROGRESS

**Files:**
- `src/components/bookings/BookingDetail/BookingDetail.styles.ts:8-11` —
  `wrapper: { flex: 1, justifyContent: "space-between" }`, **no bottom padding**
- `src/components/bookings/BookingDetail/BookingDetail.tsx:81-87` — the bar is a
  sibling of the `ScrollView`, so `space-between` pins it to the bottom edge
- `src/app/(app)/_layout.tsx` — `tabBarStyle: { position: "absolute", … }`
- `src/components/common/ScreenShell/ScreenShell.tsx:19-21` — `edges={["top"]}`,
  with the comment *"the tab bar owns that inset"* — true for a **normal** tab
  bar, false for an absolute one, which owns no layout space at all

An absolutely-positioned tab bar is removed from flow and floats **over** the
screen. The detail body therefore extends to the physical bottom of the display,
and the bar pinned there is drawn under the tab bar and its blur.

**The arithmetic, which is why it is invisible rather than merely tight:**

| Piece | Height |
|---|---|
| Tab bar | 49 (the value `SnackbarProvider.tsx:85` already hardcodes) |
| Bottom safe-area inset | ~24 gesture nav · ~48 three-button nav |
| **Covered** | **~73–97** |
| `BookingActionBar.bar` = `padding: spacing.lg`×2 + button | 16 + ~48 + 16 ≈ **80** |

So on a gesture-nav device almost all of it is hidden and on three-button nav
**all** of it is. This matches your report exactly.

**Corroboration that the overlap is real and already known in this codebase:**
- `SnackbarProvider.tsx:85` passes `tabBarInset={49}`, and `Snackbar.tsx:35`
  adds `insets.bottom + tabBarInset + 12` — i.e. the snackbar already lifts
  itself clear of the tab bar.
- `DashboardView.styles.ts:10` pads `spacing.xxl * 2` = **64** at the bottom of
  its scroll content, for the same reason, as a bare magic number.

Two screens compensated ad hoc; this one never did.

**Fix approach:** give the detail wrapper a bottom inset of
`insets.bottom + TAB_BAR_HEIGHT`. Exact mechanism is **D1**.

**Component separation** (required by the flow's step 4): the inset is a
*dynamic* value, so it may be applied inline — but `useSafeAreaInsets()` will be
called in **`useBookingDetail.ts`**, not in the `.tsx`, and returned as a plain
number. `BookingDetail.tsx` stays a pure render layer applying
`style={[styles.wrapper, { paddingBottom: s.bottomInset }]}`. Static values stay
in `BookingDetail.styles.ts`. No new component, so no new hook/style trio.

*(Note the existing inconsistency this follows rather than fixes: `Snackbar.tsx`
is labelled "Pure display" yet calls `useSafeAreaInsets` in the render layer.
Not touching that here — see I2.)*

**Verification:** **device, and only device.** No machine check in this repo can
see a control hidden behind a floating bar — that is the whole point of this
plan. Screenshot of a `pending` booking's detail screen with Approve and Reject
fully visible and tappable, plus one settled booking (e.g. `completed`) to prove
the other three render branches also clear the tab bar.

🔄 **CODE COMPLETE (2026-08-02), device check outstanding.**

`useBookingDetail.ts` now reads `useSafeAreaInsets()` and returns
`bottomInset: insets.bottom + TAB_BAR_HEIGHT`; `BookingDetail.tsx` applies it as
`style={[styles.wrapper, { paddingBottom: s.bottomInset }]}`. Render layer stays
pure — it receives a number, which is allowed inline because it is dynamic. A
comment on `wrapper` in the styles file warns against adding a static
`paddingBottom` later.

**Approach note:** the bar is lifted clear of the tab bar, leaving the page
gradient visible in the gap beneath it. The alternative — extending the bar's
background under the translucent tab bar and padding only its contents — would
look more deliberate, but it means threading the inset into all four of
`BookingActionBar`'s return branches. Not done; recorded as cosmetic below.

Machine-verified: `tsc`, `expo lint`, 89/89 tests, `expo export --platform
android`. **None of which can see this bug** — they all passed while it was live.

---

## IMPORTANT

### I1 — The same overlap affects every list's last row  🔄 IN PROGRESS
**File:** `src/components/common/RefreshableList/RefreshableList.styles.ts:7-13`
— `content: { padding: spacing.xl }` = 24, against the same ~73–97 of overlap.

The bookings, notifications and transactions lists all render through
`RefreshableList`. Scrolled to the bottom, the final row sits under the tab bar.
Less severe than B1 — a list scrolls, so the row is reachable, and 24pt of
padding means part of it is visible — but it is the same defect and the same
fix.

`DashboardView` is **not** affected: it already pads 64 (`DashboardView.styles.ts:10`).

**Fix approach:** add the same bottom inset to `RefreshableList`'s
`contentContainerStyle`. ⚠️ `padding` is honoured by FlashList v2 but `gap` is
**not** (AGENTS Traps) — this is a padding change, so it is safe.

**Severity is provisional.** I have not seen these screens; the 24pt of existing
padding may make this cosmetic rather than important. Downgrade it after the
device check rather than assuming.

**Coupling:** shares the `TAB_BAR_HEIGHT` constant with B1 — if D1 picks the
shared-constant option, land both together so the constant has both callers.

**Verification:** device — scroll each list to the bottom, last row fully clear.

🔄 **CODE COMPLETE (2026-08-02), device check outstanding.**

`useRefreshableList` gained `contentBottomPadding = TAB_BAR_HEIGHT +
insets.bottom + spacing.xl`, composed so each term is accountable: the bar body,
the safe-area strip beneath it, and the list's existing 24 of breathing room —
preserved *above* the bar rather than being eaten by it.

`RefreshableList.tsx` appends it to `contentStyle` **last and unconditionally**,
including when a caller passes its own `contentContainerStyle`. Clearing the tab
bar should not be something a screen can opt out of by accident — and one caller
does pass its own container style, so an `??` would have silently skipped it.

Covers bookings, notifications and transactions in one change (all three render
through this component). Safe against the FlashList v2 trap: `padding` is
honoured, only `gap` is inert.

**Severity stands at IMPORTANT, still provisionally** — I have not seen these
screens. Downgrade to cosmetic after the device check if the pre-existing 24pt
made it merely tight rather than broken.

Machine-verified: `tsc`, `expo lint`, 89/89 tests, `expo export`.

### I2 — `TAB_BAR_HEIGHT` would be a third copy of the same magic number  🔄 IN PROGRESS
**Files:** `src/providers/SnackbarProvider.tsx:85` (`tabBarInset={49}`),
`src/components/dashboard/DashboardView/DashboardView.styles.ts:10` (`spacing.xxl * 2` = 64)

Two hardcoded compensations already exist and disagree with each other (49 vs
64). B1 and I1 would add a third and fourth. If the tab bar's height ever
changes, they drift silently and the failure is invisible to every machine check.

**Fix approach:** export `TAB_BAR_HEIGHT = 49` from `src/theme/tokens.ts`
alongside `MIN_TOUCH_TARGET`, which is the existing home for exactly this kind of
layout constant. Point B1, I1 and `SnackbarProvider` at it.

**Scope caution:** repointing `SnackbarProvider` and `DashboardView` is a change
to working code that is not the reported bug. It is two lines and removes the
drift, but it is **D2**, not an assumption.

**Verification:** machine — `grep -rn "49\|xxl \* 2"` shows no remaining
tab-bar magic numbers. Device — snackbar and dashboard still sit where they did.

🔄 **CODE COMPLETE (2026-08-02), device check outstanding.**

`TAB_BAR_HEIGHT = 49` exported from `theme/tokens.ts` beside `MIN_TOUCH_TARGET`,
carrying the full reasoning: why it is hardcoded, why `useBottomTabBarHeight` is
unreachable, and why installing `@react-navigation/bottom-tabs` would be a fix
that looks clean and silently returns nothing.

Repointed: `SnackbarProvider.tsx` (was a bare `49`) and
`DashboardView.styles.ts` (was `spacing.xxl * 2` = 64 → `TAB_BAR_HEIGHT +
spacing.lg` = 65). **The 1pt change is deliberate** — it keeps the dashboard
visually identical while making the number say what it means. Grep confirms no
tab-bar magic numbers remain in code.

Executing this surfaced **I3** (below): the dashboard's padding is static and so
omits `insets.bottom` entirely. Left as found, per D2's scope.

---

### I3 — The dashboard's bottom padding is static, so it omits `insets.bottom`  🔄 IN PROGRESS
**File:** `src/components/dashboard/DashboardView/DashboardView.styles.ts:10-21`

Discovered while executing I2 (2026-08-02), **pre-existing and not anticipated by
this plan.** The dashboard's scroll content pads a fixed 65 for a tab bar that
actually occupies `49 + insets.bottom` — so it is short by the inset: ~24 on
gesture navigation, ~48 on three-button. The tail of the dashboard sits under the
bar on every device with a bottom inset.

Milder than B1 because a ScrollView scrolls — the content is reachable, it just
cannot rest clear of the bar. Same defect, same fix, different container: this is
a plain `ScrollView` in `DashboardView.tsx`, **not** a `RefreshableList`, so I1's
fix does not reach it.

**Fix approach:** mirror B1 exactly — return the inset from `useDashboardView`,
apply inline on the `ScrollView`'s `contentContainerStyle`.

**Verification:** device — scroll the dashboard to the end on a device with a
bottom inset; the last card clears the tab bar.

🔄 **CODE COMPLETE (2026-08-02), device check outstanding.** Scope extended by
the user after the first three items landed.

`useDashboardView` returns `contentBottomPadding = TAB_BAR_HEIGHT +
insets.bottom + spacing.xl` — **the same composition as `useRefreshableList`**,
so every scroll surface in the app now clears the bar by the same 24 instead of
each guessing. `DashboardView.tsx` applies it inline; the render layer stays pure.

The static `paddingBottom` was **removed** from `DashboardView.styles.ts` rather
than left as a fallback — two sources of truth for the same value is how the
original 49-vs-64 drift happened. A comment there warns against reinstating it,
and `TAB_BAR_HEIGHT` is no longer imported by that file.

**Value change is intentional and larger than I2's was:** 65 → 97 on gesture
navigation (49 + 24 inset + 24 breathing room). The old 65 was `bar + 16`; the new
figure clears the inset it was missing and matches the lists. This is extra
*scrolled* space at the very end of the dashboard, visible only at full scroll.

Machine-verified: `tsc`, `expo lint`, 89/89 tests, `expo export --platform
android`. As with every item here, **none of those can see the defect** — the
device pass is what decides it.

## Rejected approaches (§4 — verified, not guessed)

- ✖ **`useBottomTabBarHeight()`, the "correct" react-navigation API.** It exists
  at `node_modules/expo-router/build/react-navigation/bottom-tabs/utils/useBottomTabBarHeight.d.ts`
  but is **not on a public path**: `expo-router/react-navigation` re-exports only
  `./native` and `./elements`
  (`build/react-navigation/index.d.ts`), not `bottom-tabs`. Reaching it means
  importing through `build/`, which is private and breaks on any SDK bump.
- ✖ **Installing `@react-navigation/bottom-tabs` directly** to get that hook.
  Actively wrong, not merely a dependency gate: expo-router **vendors** its own
  copy, so a second install would carry a *different* `BottomTabBarHeightContext`
  instance. The hook would read a context the tab navigator never populated and
  return nothing useful. This would look like a clean fix and silently not work.

---

## DECISIONS
<!-- No item may execute while an OPEN: line remains — §7. -->

- **D1: how the detail screen clears the tab bar** → **bottom inset from a shared
  `TAB_BAR_HEIGHT` + `insets.bottom`** (resolved 2026-08-02) — matches what
  `Snackbar` already does, no new dependency, no private import, and the same fix
  covers I1. Hiding the tab bar on the detail route was considered and not
  chosen: it changes navigation behaviour and does nothing for the lists. Making
  the tab bar non-absolute was rejected outright — the blurred `TabBarBackground`
  is a deliberate design.

- **D2: scope** → **B1 + I1 + I2** (resolved 2026-08-02) — fix the detail screen,
  the lists, and extract the constant so all four call sites stop drifting.
  `SnackbarProvider` and `DashboardView` get repointed at it.

**No OPEN decisions remain — cleared for execution approval.**

---

### I4 — Three call sites now compute `TAB_BAR_HEIGHT + insets.bottom`  ⬜ TODO
**Files:** `useBookingDetail.ts` (+ nothing), `useRefreshableList.ts` (+
`spacing.xl`), `useDashboardView.ts` (+ `spacing.xl`)

Discovered while executing I3 (2026-08-02). I2 removed a two-way drift between
hardcoded literals; this plan has since created a three-way duplication of the
*expression* instead. Milder — the constant is shared, so only the composition
repeats, and two of the three are identical — but it is the same failure shape.

⬜ **Not done, and deliberately not bundled into I3.** A `useTabBarInset()` hook
returning the base would be a genuine three-use abstraction, not a speculative
one. But it would re-touch all three files while every one of them is still
🔄 awaiting its first device check, and a refactor landing on top of unverified
code makes a failed screenshot ambiguous: bug, or refactor?

**Unblock condition:** B1, I1 and I3 verified ✅ on device. Then it is a
mechanical extraction.

## DEFERRED / COSMETIC

- **The action bar's background does not extend under the tab bar.** B1 lifts the
  whole bar clear, so the page gradient shows in the gap beneath it. Running the
  bar's surface under the translucent tab bar and padding only its contents would
  read as more deliberate, but it means threading the inset through all four of
  `BookingActionBar`'s return branches. Acceptable as-is: the buttons are visible
  and tappable, which is the actual defect.

## Execution order

1. ✅ **I2** — the constant, so B1 and I1 have something to import rather than
   each inventing a literal. Dependency order, not severity order.
2. ✅ **B1** — the reported bug.
3. ✅ **I1** — same fix, wider surface. Coupled to I2's constant.
4. ✅ **I3** — added to scope after the first three landed; the dashboard's own
   scroll container, which I1's fix does not reach.
5. 🔄 **Device pass** — B1, I1 and I3 are *only* verifiable there. **Not run.**
6. ⬜ **I4** — blocked on step 5.

*(The ticks above mean the code landed and every machine check passed. They do
**not** mean the items are ✅ — see each item's own status.)*

---

## Verification

**Machine-verifiable** (necessary, nowhere near sufficient here):
```bash
export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH"
ezzy-vendor-mobile/node_modules/.bin/tsc --noEmit --project ezzy-vendor-mobile/tsconfig.json
npm --prefix ezzy-vendor-mobile run lint
npm --prefix ezzy-vendor-mobile test
```

**Needs a device — the entire substance of this plan.** Every machine check
above passed while this bug was live, which is the single most important fact in
this document. Nothing here goes ✅ without a screenshot. Android only; iOS
remains unverified (no Apple Developer account — AGENTS).

---

## Relationship to the live-reload plan

Independent of `.plans/2026-08-02-vendor-mobile-live-reload.md` — no shared
files, no ordering constraint. One useful data point flows the other way though:
you can now see bookings arriving, which is evidence for that plan's B1 and
should be recorded there once you confirm whether a pull-to-refresh was still
needed.
