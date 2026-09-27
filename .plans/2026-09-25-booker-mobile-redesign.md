# Ezzy Booker Mobile — build the pinned Home/Activity redesign

**Date:** 2026-09-25
**App / scope:** `./ezzy-booker-mobile`. **Nothing else.** No `booker/`, no `backbone/`, no migrations.
**Status:** DRAFT — **no decision open**; awaiting your approval to execute. **Ordering:** runs before the real-data plan (D4). **Depends on web:** R2 needs web S10; the Popular shelf needs web D26-gate.

> Carry the pinned booker redesign onto the phone app: Home becomes a storefront, a new **Activity** tab takes
> the dashboard, and the division tiles carry the icon system. Optimise for **not rewriting what already works** —
> this app is built, committed and green, and the redesign is a re-home plus new chrome, not a rebuild.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** F# = finding, D# = decision, M# = implementation item, R# = stage. Numbers are plan-local —
> qualify cross-plan refs by app (e.g. "web D21", "mobile-app P2").

**The design, pinned 2026-09-25:** https://claude.ai/artifact/TZ2nDFNudFffaDDrRXCvP9
Its phone boards — `MobileHome` (dark), `MobileHomeLight`, `MobileActivity` (dark), `MobileActivityLight` — are the target.
The web boards are context, not a spec for this app.

**Predecessors (checked in `.plans/INDEX.md` before writing this):**
- `2026-09-21-booker-mobile-app.md` — **COMPLETE 2026-09-22** for build scope M1–M9. It built the screens this plan
  changes. Its **§4 "Web → native differences"** remains the allowed-divergence list and **§4b/§4b-2** the parity
  contract. That plan stays COMPLETE as the record of the build; the redesign lives here.
- `2026-09-22-booker-mobile-real-data.md` — DRAFT, decisions open. **Independent of this plan**: it swaps mock data
  for Supabase, this one changes screens. They collide in exactly one place — see D4.
- `2026-09-18-booker-home-search-redesign.md` (web) — owns the design and the decisions this plan follows.

---

## Dependency on the web plan

This plan **follows**, it does not lead. Web owns the design decisions (its D21–D30) and the shared rules; this app
copies them. Two hard dependencies:

1. **Web S10 must land first** for the five new division colour pairs (web I33) and the normalised 512×512 logo
   assets (web I35). Both are copied here, not re-derived. → F4, M2.
2. **Web D26-gate** (`get_popular_offerings`) is a backbone migration. Until the user approves and applies it,
   **the Popular shelf is not built on either client** (web I37, here M6).

Starting R1 before web S10 is allowed — R1 touches navigation only — but R2 onward needs the colours and assets.

---

## Scope

**In:** the four tabs' structure, Home rebuilt as a storefront, a new Activity screen that receives today's Home
widgets and today's Bookings list, the division tile and icon resolver, the five colour pairs, the section chrome,
the stat strip, and the display typeface decision.

**Out:**
- Anything in `booker/`, `backbone/`, `vendor/`, `command/`.
- **Real data.** This app still runs on mocks; that is the real-data plan's job.
- **The collapsible sidebar (web D30)** — this app has no sidebar. Its drawer became the Account screen
  (mobile-app §4, D4). Nothing to port. Recorded so a parity sweep does not flag it.
- **The sidebar motif artwork (web D27)** — web-only for the same reason.
- **Proximity / distance.** Parked on web as P11 for reasons that apply identically here (no coordinates anywhere).

---

## Findings (F1–F7, verified 2026-09-25 by reading the app and running its suite)

- **F1: the app is committed and green.** `git log` shows `5ee3c46 patch 1.0.1: kiosk UI enhancement` with a **clean
  working tree** — the "272 uncommitted files" noted in the web plan's 2026-09-22 briefing is **no longer true**.
  `npm --prefix ezzy-booker-mobile test` → **111 tests, 111 pass, 0 fail**. That is the baseline to hold.
- **F2: every widget the redesign re-homes already exists.** `src/components/home/` holds `NeedsYouCard`,
  `UpNextCard`, `OpenSlotsCard`, `ResumeDraftCard`, `BookAgainRail`, `DivisionGrid`, `GuideCard`, `SearchPill`,
  `FlagReasonSheet`, `HomeView`. `src/components/bookings/` holds the unlimited list. **Re-homing is a move plus
  import changes** — the hooks and their tests travel unchanged (web D21).
- **F3: `HomeView.tsx:26-54` is exactly the dashboard the redesign empties.** Its order today is SearchPill →
  NeedsYou → BookAgainRail → OpenSlots → **DivisionGrid** → ResumeDraft. After the redesign the divisions move to
  the top and everything personal except the in-progress strip leaves for Activity.
- **F4: the five grey divisions are still provisional here.** `src/theme/divisionPalette.ts:42-46,59-61` maps
  `ezzy-law`, `ezzy-park`, `ezzy-learn`, `ezzy-work`, `ezzy-stay` to `NONE_LIGHT` / `NONE_DARK`, with a comment at
  line 10 saying the canvas never drew them. Web I33 gives them real pairs; this app **re-copies rather than
  invents** (mobile-app §4b already commits to that).
- **F5: `DivisionGrid` already renders all 13 from the shared list** (`DivisionGrid.tsx:5,20` — `DIVISIONS.map`), so
  the variable-length rule is already satisfied. What it lacks is the **icon**: there is no `require()` of any
  logo, no `assets/division-icons/`, only `assets/brand`.
- **F6: the tab bar is four tabs with a known label constraint.** `AppTabs.tsx:32-45` declares Home, Explore,
  **Bookings**, Payments, and the comment at line 22 records that "Payments" was clipped to "Paymen…" in M8 and the
  label sizing was tuned for it. **"Activity" is one character shorter than "Payments"**, so the rename is safe —
  but the M8 clipping check must be re-run, not assumed.
- **F7: there is no font loading at all.** No `useFonts`, no `@expo-google-fonts/*` in `package.json`; `tokens.ts:201`
  documents the deliberate system-stack choice (mobile-app D9). Web D22's display typeface would **reverse** that.
  → D3.

---

## DECISIONS

<!-- No stage may execute while an OPEN: line remains. **None remain as of 2026-09-25.** -->

- **D1: follow web D21–D30 as given; this plan does not re-decide the design** (resolved 2026-09-25). Where a phone
  genuinely differs, it goes in mobile-app §4's divergence table with a reason — not silently here.
- **D2: the tab renames, the screen is new** (resolved 2026-09-25). `app/(tabs)/bookings.tsx` → `activity.tsx`, and
  today's bookings list becomes Activity's **Bookings segment**. Four tabs stay four (web D21).
- **D3: no display typeface on mobile → A** (resolved 2026-09-25). The phone app keeps the **system stack**; web keeps
  the display face it chose in web D22.
  - **mobile-app D9's reasoning still holds**: a font asset in the bundle, a `useFonts` gate on first paint, a
    fallback, and a re-test of M8's label clipping (F6) — for headings only.
  - ⚠️ **This is a real divergence and it is recorded, not hidden.** The two clients will differ in *type only*;
    tiles, colour, chrome, spacing and copy stay identical. It goes in mobile-app **§4**, and web D22 is annotated so
    nobody later "fixes" the gap by reversing D9 without re-deciding it. → M10.
  - Reversible: if the face is wanted later it is one asset, one gate and the M8 re-check — nothing else depends on it.
- **D4: redesign first, on mocks → A** (resolved 2026-09-25). This plan runs to completion before
  `2026-09-22-booker-mobile-real-data.md` starts.
  - Screens settle while the data is predictable — mock data cannot fail, so a layout bug is never a query bug.
  - ⚠️ **Consequence for the real-data plan:** its W-items name screens that this plan moves or renames (the Bookings
    tab becomes Activity; Home loses its widgets). It **must be re-read against the new structure before it is
    approved**, not merged blind. A note to that effect is added to that plan.
  - The two plans never run in the same session.

---

## Implementation items

Every component states its render/hook/style split. **React Native has no CSS modules** — this app's `AGENTS.md`
overrides that bullet: styles live in `StyleSheet` objects created from the theme tokens, and the render/hook split
and the no-inline-styles rule still apply (mobile-app §3).

### M1: Tab + navigation change  ⬜ TODO (D2)
- `src/app/(tabs)/bookings.tsx` → **`activity.tsx`**; `AppTabs.tsx:40-42` renames the route and title to **Activity**
  with an activity icon.
- Any `router.push("/(tabs)/bookings")` call site follows. ⚠️ **Grep for the route string**, and note the web plan's
  F32 lesson in the other direction: here the risk is a *route* string, not a table name.
- **Re-run the M8 label check at 360 and 390 with the largest supported text size** (F6) — "Activity" is shorter than
  "Payments", so this should pass, but M8 exists because it did not once.

### M2: Division icons  ⬜ TODO (web D23, depends on web S10)
- `src/lib/divisionIcon.ts` — the **same resolution order as web** (`icon_path` → bundled → monogram), copied like
  S0's modules were, with its test. Keyed on `divisions.slug`.
- ⚠️ **Asset resolution differs and that is an allowed divergence** (§4): web reads `/division-icons/<slug>.png`;
  RN cannot build a `require()` path at runtime, so this app needs a **static map** of `slug → require(...)`. The
  monogram fallback covers `ezzy-ride`, which has no logo (web F25), and any division added later.
- `assets/division-icons/` receives the 512×512 files **produced by web I35** (F5).
- `src/components/common/DivisionIcon/` — pure display: tint box, `resizeMode="contain"`, monogram branch.

### M3: Division colours  ⬜ TODO (web D24/I33, depends on web S10)
- Re-copy the five pairs into `divisionPalette.ts:42-46,59-61`, replacing `NONE_LIGHT`/`NONE_DARK` (F4), plus the
  **deep band shade** web D22's tile needs.
- `divisions.test.ts` extends to assert the new pairs and the white-on-band contrast, matching web's guard.

### M4: `Section` — the shelf chrome  ⬜ TODO (web D27)
- `src/components/common/Section/` — pure display + its `StyleSheet`. The 4px pipe, the title row, the flat header
  wash in the section's colour, the hairline, the recessed body, 10px radius, no shadow.
- ⚠️ **RN has no `repeating-linear-gradient` or `repeating-radial-gradient`**, so web's arc-and-stroke band is not
  directly portable. Either one small tintable asset per section, or **drop the band and keep the flat wash** —
  which is an acceptable mobile result, but the header must not be left plain. Decide at build time and record it
  in §4.

### M5: Home becomes the storefront  ⬜ TODO (web D21/I30)
- `HomeView.tsx` is rebuilt to: search pill → **division grid, 4 across, all divisions** → Available today →
  Popular (M6) → Book again → vendors in your city → the in-progress strip only when a booking is today or running.
- `DivisionGrid` keeps its data source (F5) and gains the tile treatment; `BookAgainRail`, `OpenSlotsCard` and
  `SearchPill` are reused. `NeedsYouCard`, `UpNextCard`, `ResumeDraftCard` and `GuideCard` **leave** for M7.
- Sections render through M4. The grid is the one section that always has content, so Home is never blank.

### M6: Available today + Popular  ⬜ TODO (web D25/I41, D26/I37)
- "Available today": up to 3 offerings with an opening left today, soonest first, over a **capped** candidate set —
  the cap is the design (web F29), asserted in a test as on web.
- "Popular": **not built until web D26-gate is approved and applied.** If it is refused, this shelf is dropped on
  both clients together.

### M7: The Activity screen  ⬜ TODO (web D21/I31)
- `src/components/activity/ActivityView/` — `.tsx` + `useActivityView.ts` + its `StyleSheet`.
- Segments **Updates | Bookings**. Updates holds NeedsYou, the status feed, Up next, the draft card and the month
  summary stacked (no right rail — §4's one-column rule). Bookings is today's list, unlimited, four filters.
- **Moves, does not rewrite** (F2): every widget keeps its hook and tests.

### M8: The stat strip  ⬜ TODO (web D29)
- `src/components/activity/StatStrip/` — three cards (Upcoming, Needs you, Paid in Sep), each with a **3px rule top
  and bottom** in its status colour. ⚠️ RN needs `borderTopWidth`/`borderTopColor` per side, not a shorthand.
- **Only the strip is banded.** Widgets below keep plain card chrome (web D29's narrowing).

### M9: Colour per booking  ⬜ TODO (web D28)
- Booking rows take a ~7% wash of **their division's** colour; the status pill keeps the status palette. No
  per-booking or per-status row colours.

### M10: Parity + docs  ⬜ TODO
- Update mobile-app **§4** with every divergence this plan creates — icon asset resolution, the header band if it is
  dropped, and **the typeface (D3-A, already added)** — and **§4b-2** to point here.
- `architecture/portals.md`'s mobile section, if it names the tabs. ⚠️ That file is in the **root repo**, the one
  cross-repo write this plan makes — same handling as the web plan's S8.

---

## Execution order

One stage per turn by default. Each ends with `npm --prefix ezzy-booker-mobile test`, `tsc`, lint and a report.

- **R1: Tab + navigation.** M1. Independent of web; runnable now. Smallest possible first step, and it proves the
  rename before anything is rebuilt.
- **R2: Foundations.** M2, M3, M4. **Needs web S10** for the colours and the resized assets.
- **R3: Activity.** M7, M8, M9. The widgets move; Home is briefly thin, exactly as on web.
- **R4: Home.** M5, then M6 as far as the gates allow.
- **R5: Polish + parity.** Screenshots in both themes at 360 and 390, the M8 label re-check, M10.

---

## Verification

| Item | Machine-verifiable | Needs a device or emulator |
|---|---|---|
| M1 | `tsc`; grep that no `/(tabs)/bookings` route string survives | Tab bar at 360 and 390 at the largest text size (F6) |
| M2 | `npm test`: every slug resolves, `ezzy-ride` falls back, unknown goes neutral | The 12 tiles in both themes — three logos are near-black art |
| M3 | `npm test`: `divisions.test.ts` covers the five new pairs and the band contrast | Thirteen tiles side by side |
| M4, M5, M7–M9 | `tsc`, lint | Both themes, 360 and 390: sections read as sections, the strip as a strip, nothing clipped |
| M6 | `npm test`: the candidate cap holds for a large catalogue | — |

**Weak-implementation traps:**
- (a) a widget "moved" by being rewritten, losing its hook and tests (F2);
- (b) the icon `require()` map hardcoding 12 or 13 entries instead of falling back for anything missing;
- (c) the five colour pairs re-derived here instead of copied from web, so the clients drift (F4);
- (d) the stat-strip band applied to widgets below the strip (web D29);
- (e) "Available today" shipped without the cap (web F29);
- (f) the header left plain because the band would not port (M4);
- (g) the M8 label clipping assumed rather than re-checked (F6).

---

## Big table

| Done | ID | What | Who | Status | Why / reason |
|:-:|---|---|---|---|---|
| [x] | Base | Baseline measured: clean tree, 111/111 tests | Me | ✅ DONE 2026-09-25 | `5ee3c46`; the web plan's "272 uncommitted files" note is stale |
| [x] | F1–F7 | Read the app against the pinned design | Me | ✅ DONE 2026-09-25 | Widgets exist, greys still provisional, no fonts, tab label constraint found |
| [x] | D1, D2 | Follow web's decisions; Bookings tab becomes Activity | Me | ✅ DONE 2026-09-25 | — |
| [x] | D3 | **No display typeface on mobile** — system stack kept | You | ✅ DONE 2026-09-25 | D9's reasoning holds. A recorded divergence: the clients differ in type only |
| [x] | D4 | **Redesign first, on mocks**; real data after | You | ✅ DONE 2026-09-25 | Layout settles on data that cannot fail. The real-data plan must be re-read afterwards |
| [ ] | Approve | Approve this plan for execution | You | ⬜ TODO | No decision open — R1 is runnable the moment you say go |
| [ ] | R1 | Tab + navigation (M1) | Me | ⬜ TODO | Runnable now, independent of web |
| [ ] | R2 | Foundations: icons, colours, section chrome (M2–M4) | Me | ⬜ TODO | **Waits on web S10** for colours + resized assets |
| [ ] | R3 | Activity screen, stat strip, colour per booking (M7–M9) | Me | ⬜ TODO | Widgets move unchanged |
| [ ] | R4 | Storefront Home (M5, M6) | Me | ⬜ TODO | Popular waits on web D26-gate |
| [ ] | R5 | Polish, screenshots, parity + docs (M10) | Me | ⬜ TODO | Both themes, 360 and 390 |
| [ ] | Device | Emulator/device check of each stage | You | ⬜ TODO | Screenshots are not acceptance |
| [ ] | Git | Commit per stage (app repo + root repo for plans) | You | ⬜ TODO | You handle git |
| [ ] | P1 | Real data | — | ⏸ PARKED | `2026-09-22-booker-mobile-real-data.md` owns it; D4 sets the order |
| [ ] | P2 | Proximity / distance | — | ⏸ PARKED | Web P11/F37: no coordinates anywhere. Unblocked by the PSGC-centroid work recorded there |
| [ ] | X1 | Porting web D30's collapsible sidebar | — | ✖ ABORTED 2026-09-25 | This app has no sidebar; its drawer became the Account screen (mobile-app D4) |
| [ ] | X2 | Porting the sidebar motif artwork | — | ✖ ABORTED 2026-09-25 | Same reason — nothing to put it on |
