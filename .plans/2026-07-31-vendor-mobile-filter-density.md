# Ezzy Vendor Mobile — why the booking filter chips did not visibly shrink

**Date:** 2026-07-31
**App / scope:** `ezzy-vendor-mobile` — `src/components/bookings/BookingFilterTabs/`
**Status:** COMPLETE (2026-07-31) — **device-confirmed by the user** ("that's done now")
against commit `477d347` *Fixed styling problems of filter buttons*. B0 was the fix;
I0, I1 and I3 shipped with it; I2 aborted; B1 superseded by the device photo.

> **2026-07-31, second update — ROOT CAUSE FOUND, see §0.9.** A device photo showed the
> chips at ~400pt tall. RN's horizontal `ScrollView` carries `flexGrow: 1` in its base
> style and was stretching them; no padding or `minHeight` value ever reached the
> rendered height. **§0 and §0.5 below are superseded** — kept as the record of a wrong
> track. B1, I0 and I1 remain useful but were never the fix.

> Root-cause follow-up to `2026-07-30-vendor-mobile-ui-fixes.md` **I1**, which was
> executed twice and still reads as unchanged on device. This plan stops tuning
> pixels and establishes *why* first.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app and plan (e.g. "ui-fixes I1").

---

## 0. Investigation record

### The code change is real and correctly wired — ruled out

| Check | Result |
|---|---|
| Is there a second filter component? | No. `BookingFilterTabs` has exactly one call site, `BookingsList.tsx:13` |
| Is the diff actually in the working tree? | Yes — `git diff` confirms `minHeight` removed, `paddingVertical: 6`, `paddingHorizontal` 16→12, `paddingBottom` 8→4 |
| Stale native project or prebuilt bundle? | No. `android/` and `ios/` do not exist (`.gitignore:43-44`); no `*.bundle` anywhere outside `node_modules` |
| Height forced by a parent? | No. `ScreenShell.styles.ts` `body: { flex: 1 }`, the `ScrollView` has no flex, so the strip takes content height |

So the failure is **not** a miswired change.

### CORRECTION — my earlier claim that "EAS builds from git" was wrong

`eas.json` has no `cli.requireCommit`, so it defaults to **false**. Per
`expo.fyi/eas-build-archive`, the default packager uploads *"all files starting from
the root of the git repository with the exception of `.git`, `node_modules`, and all
files matched by rules from `.gitignore`"* and **"allows you to build with a dirty git
working tree."** `requireCommit: true` is what switches EAS to `git clone --depth 1`
and drops uncommitted work.

I previously told you to commit before building on the strength of the opposite claim.
That advice was not harmful — committing is still worth doing — but it was not
*required*, and it means **your build almost certainly did contain the change.** That
removes the easy explanation and is what forced the analysis below.

### CORRECTION — the original chip was 36pt, not the 38pt I recorded

ui-fixes I1 measured the old chip as `minHeight: 36` *plus* 2px of border. Wrong: RN is
border-box, so `borderWidth` sits **inside** `minHeight`. The old chip was exactly
**36pt**. Small, but it shifts every delta in that plan's tables by 2 and it matters for
the crossover point below.

### THE FINDING — at an enlarged OS font size, the change is a no-op, then a regression

`tokens.ts:272-275` documents the app's deliberate policy:

> *"`size` is the base value; RN scales it with the OS font setting by default, which is
> the behaviour we want … Caps go on individual `<Text>` via `maxFontSizeMultiplier`
> only where truncation would break meaning."*

`grep` confirms **no `maxFontSizeMultiplier` or `allowFontScaling` appears anywhere in
`src/`** — the chip label scales without limit. That interacts badly with the specific
edit that was made:

- **Old geometry:** `minHeight: 36`, **zero** vertical padding → box = `max(36, label + 2)`
- **New geometry:** no `minHeight`, `paddingVertical: 6` → box = `label + 14`

The old `minHeight` was a *floor* that absorbed scaled text for free. The new padding is
*additive* and cannot. Taking Inter's ~1.25 line box on a 12pt label:

| OS font scale | label ≈ | old chip | new chip | change |
|---|---|---|---|---|
| 1.0 (default) | 15 | 36 | **29** | −7 ✅ |
| 1.15 (Large) | 17 | 36 | 31 | −5 |
| 1.3 (Larger) | 20 | 36 | 34 | −2 — barely perceptible |
| **~1.47** | 22 | 36 | 36 | **0 — literally no change** |
| 1.8 | 27 | 36 | 41 | **+5 — taller than before** |
| 2.0 | 30 | 36 | 44 | **+8 — taller than before** |

**At any font scale at or above roughly 1.5×, the second pass changed the chip height by
nothing or made it worse.** Only the `paddingBottom` 8→4 survives, a 4pt band change —
which is exactly the magnitude you already told me was imperceptible after the *first*
pass.

This hypothesis fits all three of your reports in sequence, which no other candidate
does: "vertically too long" (scaled text, not slack padding), "still too long" (4pt),
"did not even change" (0pt).

It is a **hypothesis**, not a proven fact — it depends on your device's font setting,
which I cannot read from here. B1 settles it at zero cost.

## 0.5 The font-scale theory is demoted — the real answer is simpler

User's device: **Android, font size at the 3rd dot of 8.** On every mainstream Android
skin the default sits at the 2nd or 3rd dot, with the larger options to the right, which
puts this at roughly **1.0–1.15×** — nowhere near the ~1.5× the crossover needs.

Recomputed at the scales that actually apply:

| scale | old chip | new chip | old band | new band | **delta** |
|---|---|---|---|---|---|
| 1.00 | 36 | 29 | 44 | 33 | **−11** |
| 1.15 | 36 | 31 | 44 | 35 | **−9** |
| 1.30 | 36 | 34 | 44 | 38 | −6 |

So the change **did** work — it took 9–11pt off the band. The problem is that 9–11pt on
a ~2400px-tall phone screen, with no before/after side by side, is simply below the
threshold at which a person notices. "Did not even change" is an accurate description of
the *experience* even though the geometry moved.

**Leading explanation, revised:** the change landed and is real, but the chip was never
where the space was. §0's surround table already showed it — the strip is 33 of ~65pt
between the header and the first card. **Two more passes at the chip cannot win, because
the chip is not the problem.** The remaining 32pt is padding.

That reframes the whole task: stop shaving the control, reclaim the surround.

The stale-build possibility is not fully excluded, and B1.1 still settles it for free.

## 0.9 ROOT CAUSE — found 2026-07-31 from a device photo. Everything above it is wrong.

A photo of the running app settled it in one look: the chips render at roughly **400pt
tall**, filling about 45% of the screen. Not 29pt, not 36pt. **They were being
stretched.**

**Mechanism, verified in the installed source.** RN puts `flexGrow: 1` in the base style
of every horizontal `ScrollView`:

```js
// react-native/Libraries/Components/ScrollView/ScrollView.js:1887-1892
baseHorizontal: { flexGrow: 1, flexShrink: 1, flexDirection: 'row', overflow: 'scroll' },
```

applied unconditionally at `:1763` (`const baseStyle = horizontal ? styles.baseHorizontal
: styles.baseVertical`). In `ScreenShell`'s `body: { flex: 1 }` column that makes the
strip expand to fill every remaining point of vertical space; the content container's
default `alignItems: "stretch"` then stretches each chip to that height.

**Consequence: `minHeight`, `paddingVertical` and `CHIP_PADDING_V` never had any effect
on the rendered chip height.** All three tuning passes — 2026-07-30 first, 2026-07-30
second, and this plan's I0/I1 — changed values the layout engine was overriding. "Did
not even change" was a literally accurate report every single time.

**Fix:** `flexGrow: 0` on the ScrollView's own `style` (a `container` style, added — the
component previously passed only `contentContainerStyle`), plus `alignItems: "center"`
on the content container as a second line of defence. Only then does the padding-based
sizing take effect and produce the intended ~29pt chip.

**How this was missed for three passes — worth recording.** The 2026-07-30 plan named
this exact suspect and dismissed it in writing: *"the chips are **not** being stretched
by the horizontal ScrollView's default `alignItems: stretch`. The ScrollView has no flex
and sits in a column parent."* The claim was reasoned, not checked. The same plan
correctly diagnosed FlashList's inert `gap` and `ReanimatedSwipeable`'s direction
semantics **by reading the installed package source** — the one technique that would have
caught this in a minute was applied to two of the three problems and skipped on the
third, on the one where the conclusion felt obvious.

Everything in §0 and §0.5 above — the font-scale crossover table, the 9–11pt deltas, the
"chip is already shorter than vendor's" finding — is arithmetic on a height that was
never being used. It is left in place as the record of a wrong track, not as analysis to
rely on.

**Scope check:** `grep` for `ScrollView` across `src/` finds five call sites;
`BookingFilterTabs` is the **only horizontal one**. The rest (`DashboardView`,
`SettingsList`, `BookingDetail`, `AuthScreen`) are vertical scrollers where `flexGrow: 1`
is the wanted behaviour. No other component is affected.

### The strip is already shorter than vendor's at default font size

Vendor web, `vendor/components/bookings/BookingsPage/BookingsPage.tsx:22-24`, is not a
bare button row — the buttons sit in a **track**: `p-[3px] rounded-xl bg-sp-overlay-subtle
border`. So vendor's real band is `30 + 6 + 2 =` **38px**, against mobile's current
**33pt** (29 chip + 4 padding) at default scale. If you are at default font size, mobile
is *already* 5pt shorter than the thing it was asked to match — which would mean the
brief has been met and the perceived problem is something else on the screen.

### What actually surrounds the strip

At default scale, between the header text and the first booking card:

| Contributor | File | Height |
|---|---|---|
| Header bottom padding | `ScreenShell.styles.ts` `header.paddingBottom` | 8 |
| **Filter strip** | `BookingFilterTabs.styles.ts` | **33** |
| `StaleBanner` | only when stale | 0 or ~28 |
| List top padding | `RefreshableList.styles.ts` `content.padding: spacing.xl` | 24 |

The chips are **33 of ~65pt** — roughly half the gap is padding around them, not the
control itself. Any further attack on the chip alone has a low ceiling.

### Architecture cross-check

Capping font scale on the chip label extends `tokens.ts:275`'s stated policy, which
scopes caps to *"where truncation would break meaning."* This would be a **layout**
cap, not a truncation cap. Per plan-authoring §7 that is a documented-convention
divergence, so it is **D1** below rather than a silent reinterpretation.

---

## BLOCKERS

### B0 — Horizontal ScrollView stretches the chips to full column height  ✅ DONE (2026-07-31)

**Verified on device** by the user against commit `477d347`; the chips now render as
short pills. This was the actual fix — I0 and I1 were secondary and would not have been
visible without it.

**File:** `BookingFilterTabs.styles.ts` (new `container` style),
`BookingFilterTabs.tsx:30-37` (the ScrollView now receives `style` as well as
`contentContainerStyle`)

The real defect, mechanism in §0.9. RN's `baseHorizontal: { flexGrow: 1 }`
(`ScrollView.js:1887-1892`) expanded the strip to fill `ScreenShell`'s `body: { flex: 1 }`
column; the content container stretched each chip to that height.

**Fix applied:** `container: { flexGrow: 0 }` on the ScrollView's own style, and
`alignItems: "center"` on the content container as a second line of defence. The chip's
existing `paddingVertical: CHIP_PADDING_V` sizing now actually applies.

**Verification:** machine — `tsc` exit 0, `expo lint` exit 0, `npm test` 40/40, `expo
export --platform android`. **None of these can see the bug** — the stretched build
passed all four every time. Live: the chips must render as short pills, roughly the
height of the "Pending" text plus a little padding.

### B1 — Establish the cause before touching the styles again  ✅ DONE (2026-07-31)

Superseded by the device photo, which produced the answer directly and faster than the
discriminators below would have. Recorded finding: **ask for a screenshot first.** Three
passes of remote geometry reasoning were beaten by one photo.

**Files:** none — this is two observations on the build you already have.

Three passes have now been spent tuning a number without knowing whether the number is
what you are looking at. Do not make a fourth blind change.

**Two discriminators, both free, no rebuild:**

1. **Did the code ship?** `paddingHorizontal` went `spacing.lg` (16) → `spacing.md` (12),
   so every pill should be **8pt narrower** than before. Compare pill widths against an
   older screenshot. Identical widths ⇒ the build predates the change and the whole
   analysis above is moot. Narrower pills ⇒ the code shipped, and B1.2 applies.
2. **What is the device font setting?** Android *Settings → Display → Font size* (also
   check **Display size**, which scales density and cannot be fixed in JS), or iOS
   *Settings → Display & Brightness → Text Size* / *Accessibility → Larger Text*.
   Anything above default and the table above explains the result outright.

A confirming test if you want certainty: set the font size to the **smallest** value and
reopen Bookings. If the strip visibly collapses, font scale is the mechanism — proven,
not inferred.

**Fix approach:** none. This item produces the evidence that selects between I1, I2 and
D2. It is a blocker because every downstream item branches on its answer.

---

## IMPORTANT

### I0 — Reclaim the padding around the strip  ✅ DONE (2026-07-31) — shipped in `477d347`

> **Title corrected.** This was originally headed "this is the actual fix". It was not —
> B0 was. Kept because the reclaimed 16pt is real and worth having, but it was never the
> reason the strip looked wrong.

**Files:** `RefreshableList/RefreshableList.styles.ts:7-12` and `RefreshableList.tsx`;
consumed at `BookingsList.tsx:16-31`

The block between the header text and the first booking card is **~65pt at default font
scale**, and the filter strip is only 33 of it:

| Contributor | Current | Proposed |
|---|---|---|
| `ScreenShell` `header.paddingBottom` | 8 | 8 — leave it, it is shared by every screen |
| Filter strip (chip 29 + `paddingBottom` 4) | 33 | 33 — already below vendor's 38 |
| `RefreshableList` `content.padding` top | **24** | **8** |
| **Total** | **65** | **49** |

**16pt from one line** — more than the two previous passes achieved *combined* (11pt),
and it comes from padding that is doing no work: the filter strip already separates the
header from the list, so 24pt on top of it is padding against padding. Horizontal and
bottom padding stay at `spacing.xl` so the cards keep their existing inset.

**Fix approach:** `content.padding: spacing.xl` is shared by every list in the app, so it
cannot simply be lowered. Add one optional prop — `contentPaddingTop?: number` — merged
over `styles.content` in `RefreshableList.tsx`, and pass `spacing.sm` from
`BookingsList.tsx` only. Additive, one consumer, no other screen changes behaviour.

Per `.claude/skills/component-separation/SKILL.md`: `RefreshableList` stays a pure render
layer — this is a prop threaded into an existing `contentContainerStyle`, no new state,
effects, or handlers, and no inline `style={{}}`; the merge is a `useMemo`'d array in the
existing render path. No new component, so no new hook file is required.

**Verification:** machine — `tsc`, lint, tests, `expo export`. Live — the gap above the
first card should be visibly tighter; this is the one change in this plan large enough
to be obvious without an A/B comparison.

**✅ Executed 2026-07-31.** `RefreshableList.tsx` gained an optional
`contentPaddingTop?: number`, merged over the existing content style in a `useMemo`
(memoised because FlashList re-measures its content container when the style identity
changes). `BookingsList.tsx` passes `spacing.sm`. FlashList v2 extends `ScrollViewProps`
(`FlashListProps.d.ts:31`), so `contentContainerStyle` is a plain `StyleProp<ViewStyle>`
and the array merge is type-safe — worth checking, because v1 used a narrowed
`ContentStyle` that rejected arrays.

Measured result at the user's ~1.0–1.15× font scale:

| Contributor | Before this plan | After |
|---|---|---|
| `ScreenShell` `header.paddingBottom` | 8 | 8 |
| Filter strip | 33 | 33 |
| List top padding | 24 | **8** |
| **Header → first card** | **65** | **49** |

**Machine-verified:** `tsc --noEmit` exit 0 · `expo lint` exit 0 · `npm test` 40/40 ·
`expo export --platform android` exit 0 (`dist/` removed).

### I1 — Chip label scales without limit  ✅ DONE (2026-07-31) — shipped in `477d347`

**File:** `BookingFilterTabs.tsx:54-56` (the `<Text>`), `BookingFilterTabs.styles.ts:63-67`

The label has no `maxFontSizeMultiplier`, so chip height is label-driven above ~1.5×
and the padding-based sizing loses control of it entirely.

**Fix approach:** add `maxFontSizeMultiplier={N}` to the chip `<Text>`; N is **D1**.
Be aware of the ceiling — this bounds the damage, it does not deliver a 30pt chip at
large font sizes:

| cap | label ≈ | chip | vs old 36 |
|---|---|---|---|
| 1.2 | 18 | 32 | −4 |
| 1.3 | 20 | 34 | −2 |
| 1.4 | 21 | 35 | −1 |

**Coupled to I2** — the cap alone is not enough to reach vendor parity at large scale.

**Verification:** machine — `tsc`, lint, tests. Live — set the device to its largest
font size and confirm the strip stops growing and no label clips (the row scrolls
horizontally, so clipping is unlikely but must be seen).

**✅ Executed 2026-07-31.** `maxFontSizeMultiplier={1.3}` on the chip `<Text>`
(`BookingFilterTabs.tsx:54-63`). **Deliberately invisible at the user's font scale** —
this closes a regression, it is not the fix. Same machine checks as I0.

### I2 — Restore a height *ceiling*, not just a floor  ✖ ABORTED (2026-07-31)

Existed only to serve D1(b) (hard 30pt + `numberOfLines={1}`), which was rejected: it
buys nothing at default font scale — where the chip is already 29pt — and has the
weakest accessibility story of the three options. I1's cap bounds the height adequately.

**File:** `BookingFilterTabs.styles.ts:51-59`

The edit swapped a floor (`minHeight`) for additive padding and left the chip with no
upper bound at all. If D1 chooses a fixed-height strip, the correct shape is a
`height`/`maxHeight` on the chip plus `numberOfLines={1}` on the label, so the chip
stays put and the *text* is what gets constrained.

**Fix approach:** replace `paddingVertical` with an explicit `height: 30` +
`numberOfLines={1}`, keeping `CHIP_HIT_SLOP` for the 44pt target. This deliberately
subordinates OS font scaling to a fixed control height — **only** if D1 says so.

**Verification:** live, at both the smallest and largest OS font sizes.

### I3 — The same uncapped-scaling exposure exists on other compact controls  ✅ DONE (2026-07-31)

**Files:** every `minHeight: MIN_TOUCH_TARGET ± n` site — `NotificationsList.styles.ts:24`,
`TransactionsView.styles.ts:21`, `SettingsList.styles.ts:63`, `SearchField.styles.ts:19`,
`DashboardView.styles.ts:29`, `ApproveRejectBar.styles.ts:19`, `PrimaryButton.styles.ts:8`

Those are all floors, so they degrade gracefully — they grow with text rather than
clipping. That is the *correct* behaviour and I am **not** proposing to change them.
This item exists so the decision in D1 is applied consciously to one component rather
than leaking into the rest of the app by copy-paste.

**Fix approach:** documentation only — if D1 caps the chip, record the reasoning at
`tokens.ts:272-275` so the next component does not inherit the cap without the argument.

**Executed 2026-07-31.** `tokens.ts:272-280` now states the discriminator explicitly: a
`minHeight` floor absorbs scaled text for free and should stay uncapped; a control sized
by additive padding cannot, and is the only case that earns a cap. Names
`BookingFilterTabs` as the sole instance and says plainly not to copy the cap onto
floor-sized controls. Verified by reading the file back — documentation only, no
behaviour change.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line remains — plan-authoring §7. -->

### RESOLVED: D1 — Fixed control height vs. OS font scaling

**→ (a) Cap at 1.3×** (resolved 2026-07-31). Now scoped as **insurance, not the fix** —
at the user's ~1.0–1.15× it changes nothing on their screen. It closes a regression this
work introduced: swapping the `minHeight` floor for additive padding means that above
~1.5× the new chip is *taller* than the original. One line, no downside, and 12 × 1.3 ≈
16pt stays legible. Option (b) (hard 30pt + `numberOfLines={1}`) was rejected — it buys
nothing at default scale and has the weakest accessibility story. Option (c) (no cap)
was rejected only because it leaves a self-inflicted regression in place.

### RESOLVED: D2 — Chips or a dropdown?  → **(a) keep chips** (resolved 2026-07-31)

You asked whether a dropdown would be better. Direct answer, with the part that usually
gets missed first:

**A dropdown in its own row saves no vertical space.** A menu trigger still needs a 44pt
touch target, against the strip's current 33pt. It would make the screen *taller*. A
dropdown only pays off if the filter leaves the body entirely — `ScreenShell` already
has an `action` slot (`ScreenShell.tsx:11`, currently `SettingsAction`) that a filter
control could share, which would reclaim the whole row.

Weighing it honestly:

| | Chips (today) | Dropdown in header |
|---|---|---|
| Taps to switch filter | **1** | 2 |
| Options visible at a glance | **yes** | no |
| Vertical cost | 33pt row | **0 — lives in the header** |
| Behaviour at 2× font scale | grows, or needs D1 | **immune — trigger stays one line** |
| Off-screen options | "All" likely scrolled off on a 360dp phone | **none** |
| Platform idiom | Material 3 filter chips ✓ · HIG segmented control ✓ | iOS nav-bar pull-down (Mail, Files) ✓ · Material app-bar filter ✓ |

Both are platform-correct on both OSes; neither is a violation. The real discriminator
is **switching frequency** — a vendor triaging bookings flips Pending ⇄ Confirmed
constantly, and a dropdown taxes that path every time. Its one decisive technical
advantage is that it is structurally immune to the font-scaling problem this whole plan
is about.

**With the font-scale theory demoted, the case against the dropdown gets stronger, not
weaker.** Its one decisive advantage was immunity to font scaling — and at ~1.0–1.15×
that advantage is worth nothing here. What remains is a strictly worse interaction (2
taps instead of 1, options hidden) bought in exchange for 33pt, when **I0 reclaims 16pt
for one line and no interaction cost at all.**

- **(a) Keep chips, take I0 + I1** *(recommended)* — the chips already measure 33pt
  against vendor's own 38pt. They are not the problem and never were; the padding around
  them is. Do not restructure a working control to fix a padding value.
- **(b) Move to a header dropdown** — reclaims the full row and permanently ends the
  font-scale problem, at the cost of a second tap on your most-used control and losing
  at-a-glance discoverability. Implementable with `@expo/ui` (already a dependency at
  `package.json:7`, **no approval gate**) — but note it is still marked experimental in
  SDK 57 and its Android coverage lags iOS, so a plain `Modal` list may be the safer
  build. Roughly a day including the accessibility pass.
- **(c) Dropdown in its own row** — **not recommended**, strictly worse than today: same
  or more height, plus a tap, plus hidden options.

---

## DEFERRED / COSMETIC

- ~~**Trim the space around the strip.**~~ **Promoted to I0** (2026-07-31) once §0.5
  established that the chip was never where the space was. Deferring the largest
  available win behind the smallest one was the wrong call.
- **Filter order differs from vendor.** Mobile leads with Pending
  (`BookingFilterTabs.tsx:10-14`); vendor web leads with All
  (`BookingsPage.tsx:13`). Deliberate — recorded in ui-fixes — but it means "All" is the
  chip most likely scrolled off-screen. Acceptable: All is the least-used filter.
- **No pending-count badge on mobile.** Vendor web shows one (`BookingsPage.tsx:33-35`).
  Out of scope; note it because D2(b) would need somewhere to put it.

---

## Execution order

Revised 2026-07-31 after §0.5. D1 is resolved; **D2 is the only remaining gate**, and it
only gates the choice between (a) and (b) — under (a) the work below is unblocked.

0. ✅ **B0** — `flexGrow: 0` on the ScrollView. **The actual fix.** Everything below is
   secondary and none of it would have mattered without this.
1. ✅ **I0** — the padding reclaim. Still worth having: with B0 in place the strip is
   ~33pt, so the 24pt of list padding underneath is now a meaningful share of the
   remaining gap rather than a rounding error next to a 400pt chip.
2. ✅ **I1** — cap the label at 1.3×.
3. ✅ **I3** — record the D1 reasoning at `tokens.ts:272-280`.
4. ✖ **I2** — ABORTED; existed only to serve D1(b), which was rejected.
5. ✖ **B1.1** — the pill-width check. Moot: the strip renders correctly on device, so the
   build pipeline was never the problem. Recorded because "is the build even shipping my
   change?" stayed a live hypothesis for two rounds and was never the answer.
6. ✅ Committed by the user as `477d347` *Fixed styling problems of filter buttons*.

## Verification

### Machine-verifiable
- `npx tsc --noEmit`, `npx expo lint`, `npm test` — necessary, and worth stating plainly:
  **none of them can catch this class of bug.** Every variant above compiles and passes.
  That is precisely why three passes shipped without detecting the problem.

### Needs a live environment — the only verification that counts
- ✅ **Strip renders as short pills on Android at the user's font size** — confirmed
  2026-07-31 against `477d347`. This single observation is what closed the plan; it also
  produced the root cause, which four rounds of code reading had not.
- ⬜ Strip at **smallest** and **largest** OS font size (I1's `maxFontSizeMultiplier`
  cap). Untested — the cap is deliberately inert at the user's setting, so its own
  behaviour has never been exercised.
- ⬜ Tap just above and below a chip — `CHIP_HIT_SLOP` should still register the hit.
  Carried forward from ui-fixes I1 and **still unverified across all four passes**.
- ⬜ iOS: never run. Blocked on companion plan **B9** (no Apple Developer account).

### The lesson, recorded because it cost four passes
Ask for a screenshot **before** reasoning about layout. Three rounds of geometry
analysis, two corrections, and a font-scale investigation were all beaten by one photo.
The two library defaults involved (`ScrollView`'s `flexGrow: 1`, FlashList's absolute
cells) are now documented in `architecture/conventions.md` → *Layout traps* and in
`ezzy-vendor-mobile/AGENTS.md` → *Traps that have already cost a build cycle*.
