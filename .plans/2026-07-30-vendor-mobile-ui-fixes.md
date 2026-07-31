# Ezzy Vendor Mobile — booking filter sizing + notification swipe inversion

**Date:** 2026-07-30
**App / scope:** `./ezzy-vendor-mobile` only — two component fixes.
**No backbone, no schema, no other app, no new dependency.**
**Status:** IN PROGRESS — approved 2026-07-30 and **both stages executed the same day**.
**B1 and I1 are code complete and machine-checked**, and both sit at 🔄 rather than ✅
because **neither fix is machine-provable**: B1's swap compiles either way, and I1's
sizing and tap area are visual. One device pass closes both.

Not a blocked plan — nothing further to write. The only outstanding work is
verification, and it needs hardware.

> One-line framing: shrink the bookings status filters to vendor's proportions, and
> fix a swipe-action inversion on notifications that currently pairs the wrong label
> with the wrong destructive action — optimizing for correctness first, cosmetics
> second.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision; numbers are
> plan-local — qualify cross-plan refs by app.

**Out of scope:** any data-layer change; the notification list's non-swipe paths
(tap-to-toggle-read, long-press-to-delete) which are correct and stay untouched; the
other plans' outstanding device verification.

---

## 0. Investigation record

Read the real code and the installed library source. One of the two reports turned out
to be **worse than described**, and it changed the severity tier.

### The swipe bug is real, and I found the mechanism

`ReanimatedSwipeable`'s `onSwipeableOpen(direction)` does **not** name the panel that
opened — it names the **direction the row moved**. From the installed source,
`node_modules/react-native-gesture-handler/src/components/ReanimatedSwipeable/ReanimatedSwipeable.tsx:190-193`:

```js
if (onSwipeableOpen && toValue !== 0) {
  runOnJS(onSwipeableOpen)(
    toValue > 0 ? SwipeDirection.RIGHT : SwipeDirection.LEFT
  );
}
```

`toValue` is the row's translation. Opening the **left** panel translates the row
**right** (positive) → reports `RIGHT`. Opening the **right** panel translates left
→ reports `LEFT`. Enum values confirmed as the plain strings `'left'` / `'right'`
(`ReanimatedSwipeableProps.ts:7-10`).

The prop's own doc comment — *"Called when action panel gets open (either right or
left)"* — is ambiguous enough to invite exactly this mistake, which is presumably how
it happened.

### The user's report understated it: **both** halves are wrong

`NotificationListItem.tsx:100-103` maps `direction` as if it named the panel:

```ts
if (direction === "left" && !archived) onArchive(notification)
if (direction === "right") confirmDelete()
```

Given the semantics above, what actually happens:

| Gesture | Panel revealed (the label the user sees) | Action that fires |
|---|---|---|
| Swipe **right** | **Archive** (`renderLeftActions`, blue) | **Delete prompt** ← reported |
| Swipe **left** | **Delete** (`renderRightActions`, red) | **Archives immediately, no confirmation** |

The second row is the more dangerous one and was not in the report. A user swipes on a
row showing a red **Delete** icon, the row disappears from the list — and it was
*archived*, not deleted. The visible label contradicts the action, and unlike the
delete path there is **no confirmation dialog** to catch it.

### A third consequence, inferred from the same inversion

On the **Archived** tab (`archived = true`), `renderLeftActions` returns `null`
(`:78-79`), so the left panel cannot open and `direction === "right"` never fires —
no delete prompt. Meanwhile the right panel (Delete) does open, reports `"left"`, and
hits the `&& !archived` guard — so nothing happens either.

**Net: on archived rows, no swipe action works at all.** This follows from the code but
is **inference, not observation** — I have no device. Flagged for the verification pass
rather than asserted.

**Mitigation that limits severity:** delete is still reachable by **long-press** on the
row (`:108`, with an `accessibilityHint` that says so), and archive by the 44pt Archive
button inside the row (`:112`). The swipe is documented as a shortcut, never the only
path (`:20-22`) — that convention is what stops this being a total loss of function.

### The filter chips are oversized, not stretched

Ruled out the obvious suspect: the chips are **not** being stretched by the horizontal
`ScrollView`'s default `alignItems: "stretch"`. The `ScrollView` has no flex and sits
in a column parent, so it takes content height; the height comes entirely from the
chip's own `minHeight`.

Measured, `BookingFilterTabs.styles.ts:12-20`:

| | Mobile now | Vendor web |
|---|---|---|
| Vertical | `minHeight: MIN_TOUCH_TARGET - 8` = **36** + 1px border ×2 = **38px** | `py-[7px]` + 12px/16px text = **30px** |
| Horizontal padding | `spacing.lg` = **16** | `px-[13px]` = **13** |
| Radius | `radii.pill` (999) | `rounded-[9px]` |
| Border | 1px per chip | none per chip; one border on the group track |

Source: `vendor/components/bookings/BookingsPage/BookingsPage.tsx:22-37`.

So the chip carries ~20px of vertical slack around a 12px label. The user's read is
correct.

### Architecture cross-check

`architecture/conventions.md`'s Mobile section and the render/hook/style split are
respected — both fixes are confined to existing `.tsx` + `.styles.ts` pairs, and
neither component gains state. Nothing here diverges from a documented decision except
the touch-target question, which is **D1** below rather than a silent override.

---

## BLOCKERS

### B1 — Notification swipe actions are inverted  🔄 CODE COMPLETE (2026-07-30) — needs device confirmation
**File:** `src/components/notifications/NotificationListItem/NotificationListItem.tsx:100-103`

The mapping treats `onSwipeableOpen`'s `direction` as the panel side; it is the swipe
direction. Full mechanism and the three consequences are in §0. Tiered **BLOCKER**
rather than cosmetic because one half performs an **unconfirmed state change that
contradicts the label the user is looking at** — the kind of defect that erodes trust
in every other swipe in the app.

**Fix approach — swap the two branches:**

```ts
onSwipeableOpen={(direction) => {
  // `direction` is the direction the ROW moved, not the panel that opened:
  // the left panel (Archive) opens by swiping right, and vice versa.
  if (direction === "right" && !archived) onArchive(notification)
  if (direction === "left") confirmDelete()
}}
```

Two lines. **The comment is not optional** — it is the whole reason this was wrong, and
without it the "obvious" reading will invert it again on the next edit.

**Deliberately NOT changing:** which icon sits on which side. Swipe-right-to-archive /
swipe-left-to-delete is the platform-conventional arrangement (destructive on the left
pull), and it is what the current icons already promise. The bug is the wiring, not the
layout — moving the icons instead would make the *labels* match while leaving the
gesture directions non-standard.

**Also fixes the archived-tab dead zone** as a side effect: with the branches swapped,
`!archived` correctly guards the archive path and the delete path becomes reachable on
archived rows.

**Component separation:** `NotificationListItem` is documented pure display, every
handler passed in (`:20-22`). The change is inside an existing inline callback; no
state, no hook, no style change. Stays pure display.

**🔄 CODE COMPLETE (2026-07-30).** Branches swapped exactly as specified; +8/−2 in one
file, all of it the callback and the explanatory comment. The comment records the
`toValue > 0 ? RIGHT : LEFT` mechanism *and* what the inverted reading caused, so the
next person to touch it has the reason rather than just the rule. Icon sides
unchanged, per the plan.

**Verified (machine):** `tsc --noEmit` exit 0 · `expo lint` clean · `npm test` 40/40.
**That proves nothing about the fix** — as the plan predicted, both spellings compile
and type-check. This is a regression baseline only.

**Still needed — the actual verification, on a device:** swipe right → archives with no
dialog; swipe left → delete confirmation; archived tab → swipe left now reaches the
confirmation (the §0 inference that most needs confirming); long-press and the in-row
Archive button unregressed. **Android only** — iOS blocked on companion **B9**.

---

## IMPORTANT

### I1 — Booking status filter chips are ~27% taller than vendor's  🔄 CODE COMPLETE (2026-07-30) — needs device confirmation
**File:** `src/components/bookings/BookingFilterTabs/BookingFilterTabs.styles.ts:12-20`
(`chip`), `:33-40` (`gradient`)
**Web reference:** `vendor/components/bookings/BookingsPage/BookingsPage.tsx:26-31`

38px rendered against vendor's 30px, around a 12px label — see §0 for the measurements.

**Fix approach — let padding drive the height, as vendor does:**

| Property | From | To |
|---|---|---|
| `minHeight` | `MIN_TOUCH_TARGET - 8` (36) | **removed** — the fixed floor is what creates the slack |
| `paddingVertical` | — | `spacing.sm` (8) → ~31px rendered |
| `paddingHorizontal` | `spacing.lg` (16) | `spacing.md` (12) — vendor's 13 |
| `hitSlop` on the `Pressable` | — | `{ top: 7, bottom: 7 }` — see **D1** |

`spacing.sm`/`spacing.md` rather than vendor's literal 7/13 keeps the values on the
token scale; the 1–2px difference is invisible and the scale stays honest.

**Radius stays `radii.pill`** — see **D2**.

**Component separation:** `BookingFilterTabs` is pure display, fully controlled by the
screen hook (`:17-18`). All dimensional changes land in the existing `.styles.ts`. The
one `.tsx` change is the `hitSlop` prop, which is a prop not a style — no inline
`style={{}}` is introduced.

**Watch item during execution:** `styles.gradient` (`:33-40`) is an absolutely
positioned fill carrying its own `borderRadius: radii.pill`. If D2 is ever revisited
and the chip radius changes, **the gradient's radius must change with it** or the
active chip's fill will bleed past its border. Unchanged in this plan; noted so it is
not missed later.

**🔄 CODE COMPLETE (2026-07-30).** `minHeight` removed; height now comes from
`paddingVertical: spacing.sm`, horizontal padding tightened `lg` → `md`. Two files,
`.styles.ts` + `.tsx` (the latter only gains the `hitSlop` prop — no inline style
introduced).

**One improvement over the plan, prompted by a lint warning.** Dropping `minHeight`
left `MIN_TOUCH_TARGET` imported-but-unused. Rather than delete the import, the hitSlop
is now **derived from it**:

```ts
const CHIP_HEIGHT = spacing.sm * 2 + LABEL_LINE_BOX + 2
const CHIP_SLOP = Math.max(0, Math.ceil((MIN_TOUCH_TARGET - CHIP_HEIGHT) / 2))
```

Better than the planned literal `7`: raising `MIN_TOUCH_TARGET` now widens the slop
automatically instead of silently leaving this chip short, and the 44pt rule is encoded
rather than described in a comment. `LABEL_LINE_BOX` is an acknowledged estimate of the
rendered 12pt label — erring low only ever makes the target larger, never smaller.

**Verified (machine):** computed chip height **34pt**, slop **5pt**, effective target
**44pt — meets the rule exactly**. `tsc --noEmit` exit 0 · `expo lint` clean (the
warning above resolved) · `npm test` 40/40 · `expo export --platform android`
succeeded.

**Still needed, on a device:** that the chips actually read smaller against vendor's
row; that they remain comfortably tappable (the hitSlop claim — a screenshot cannot
show it); the active chip's gradient still fills to the border; and **the largest OS
font size**, which is the case removing `minHeight` most affects, since height now
follows the text. **Android only** — companion **B9**.

---

#### I1 revision — 2026-07-30, second pass. **The first pass was too timid.**

User reported the strip still too tall. Correct: measuring the whole band rather than
just the chip showed the first pass moved it **46pt → 42pt**, a 4pt change that is
imperceptible. Two causes, only one of which was the chip:

| | Original | 1st pass | 2nd pass |
|---|---|---|---|
| Chip height | 38pt | 34pt | **30pt** — vendor's exact button height |
| `scroll.paddingBottom` | 8 | 8 | **4** |
| **Strip band** | **46pt** | 42pt | **34pt** |

Changes: `paddingVertical` `spacing.sm` (8) → **`CHIP_PADDING_V = 6`**, a named literal
because 6 is what lands on vendor's 30pt and no spacing token does; and
`scroll.paddingBottom` `spacing.sm` → `spacing.xs`, since the list below already opens
with `spacing.xl` of its own top padding, so 8 was padding against padding.

**A real bug in the first pass, found and fixed here.** Its
`LABEL_LINE_BOX = 16` was an *over*-estimate of the rendered 12pt label, while the
comment claimed erring low was safe. Over-estimating the chip height **under**-estimates
the slop: at a real 15pt label the effective target computed to 43pt — **under the 44pt
rule the constant exists to enforce**, and silently so. Now `LABEL_LINE_BOX = 14`, a
deliberate under-estimate, with the comment corrected to say why the direction matters.
`CHIP_HEIGHT` also now derives from `CHIP_PADDING_V` instead of restating
`spacing.sm * 2`, which would have desynced from the style the moment the padding
changed — as it just did.

**Verified (machine):** effective target checked across the plausible label range —
14pt→44, 15pt→45, 16pt→46, **all ≥ 44**. `tsc` exit 0 · `expo lint` clean ·
`npm test` 40/40 · `expo export --platform android` succeeded.

**Note for the device pass:** the chip is now 30pt against a 44pt touch area, so the
gap between what is seen and what is tappable is wider than before. Tapping just above
and below a chip should still register — that is the one thing this revision makes more
important to check, not less.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains. None remain as of 2026-07-30. -->

- **D1 — the shrink pushes the chip under the project's 44pt touch-target rule. How is
  that reconciled?** → **shrink visually, restore the target with `hitSlop`**
  (resolved 2026-07-30).
  `tokens.ts:245` sets `MIN_TOUCH_TARGET = 44` and `mobile-dev` §2 requires
  "touch targets ≥ 44×44pt". The chip is *already* under it at 36; going to ~31 widens
  the gap. Rather than silently override a documented rule or refuse the user's
  request, `hitSlop: { top: 7, bottom: 7 }` makes the **effective** target ~45pt while
  the **visual** chip matches vendor. Both constraints are then genuinely satisfied,
  which is why this is not presented as a trade-off. Recorded as a decision because it
  touches a documented convention (plan-authoring §7).
- **D2 — adopt vendor's 9px radius and segmented track, or keep the pill strip?** →
  **keep the pill strip; shrink only** (resolved 2026-07-30).
  Vendor groups its filters in a bordered, 3px-padded track with 9px-radius buttons.
  That is a *desktop* affordance: five filters ("Pending Confirmed Completed Cancelled
  All") measure ~310px at 12px type, against 312dp of usable width on a 360dp phone —
  it fits with nothing to spare, and not at all at larger OS font sizes. The horizontal
  scroll strip is the correct mobile form, and a scrolling segmented track is an
  awkward hybrid. The user's phrasing — *"just smaller buttons"* — reads as the
  minimal change, and this is the reversible half.
  **If you want fuller vendor parity, say so at approval** and D2 flips; it is a
  ~10-line change to the same style file, listed under Deferred.

---

## DEFERRED / COSMETIC

- **Vendor's segmented-track look** (bordered group, 9px radius, no per-chip border) —
  the D2 alternative. Acceptable to skip: it is a desktop-density pattern that does not
  survive a 360dp viewport with five filters, and the current strip already reads as a
  filter row. Revisit only if the filter set shrinks.
- **The `Alert.alert` delete confirmation is iOS/Android-native and unstyled**, so it
  ignores the app's brand palette entirely. Out of scope — restyling it means a custom
  modal, which is a component, not a fix. Worth its own item if the branded look
  matters later.
- **`accessibilityHint` on the row says "Long press to delete"** but says nothing about
  the swipe actions. Correct as-is per the swipe-is-a-shortcut convention, but if the
  swipe mapping is ever surfaced to screen readers it should be added there, not in the
  hint.

---

## Execution order

Two independent items, no coupling — they touch different components and share no
tokens. **One stage each**, with a report after each per
`.claude/skills/developerboss/SKILL.md`.

1. **Stage 1 — B1, the swipe inversion.** 🔄 **EXECUTED 2026-07-30.** First because it
   is the correctness bug and the smallest diff. Landed alone, so it stays trivially
   reviewable and revertable.
2. **Stage 2 — I1, the chip sizing.** 🔄 **EXECUTED 2026-07-30.** Cosmetic, deferred
   behind the correctness fix as planned. Surfaced one improvement over the plan (the
   derived hitSlop) — recorded at I1.

---

## Verification

### Machine-verifiable
- `tsc --noEmit` exit 0 · `expo lint` clean · `npm test` 40/40 — a regression baseline
  only; **neither fix is provable this way.**
- `expo export --platform android` succeeds.
- **B1 specifically has no machine check.** The swap is two string literals; both
  spellings compile and both type-check. Nothing in the toolchain can tell a correct
  mapping from an inverted one — which is precisely how the bug survived to a device.

### Needs a live environment — the actual verification
**B1**, on a device, on the Alerts tab:
- Swipe **right** (Archive icon visible) → row **archives**, no dialog.
- Swipe **left** (Delete icon visible) → **delete confirmation** appears; Cancel leaves
  the row intact; Delete removes it.
- On the **Archived** tab: swipe **left** → delete confirmation appears. This is the
  §0 inference that most needs confirming — if archived rows are still dead, the
  `renderLeftActions` null-return needs revisiting rather than the mapping.
- Long-press still deletes and the in-row Archive button still archives — the two
  non-swipe paths must not regress.

**I1**, on a device, on the Bookings tab:
- Chips visibly shorter, comparable to vendor's filter row side by side.
- **Still comfortably tappable** — this is the `hitSlop` claim (D1) and the one thing a
  screenshot cannot confirm. Tap near the top and bottom edges of a chip.
- Active chip's gradient still fills to the border with no bleed.
- Both themes, and the **largest OS font size** — the case that removing `minHeight`
  most affects, since the height now follows the text.

**Platform limit, unchanged:** Android only. iOS cannot be built or run — companion
plan **B9**. Every ✅ this plan produces means *verified on Android*.
