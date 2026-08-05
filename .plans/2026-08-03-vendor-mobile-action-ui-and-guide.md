# Vendor mobile — action-button sizing, an "i" that explains the actions, and a getting-started guide

**Date:** 2026-08-03
**App / scope:** `ezzy-vendor-mobile` — plus a coupled two-file change in `vendor` (web), forced by D4
**Status:** IN PROGRESS — all four stages coded 2026-08-03; **every visual item is
🔄 pending a device screenshot**, which is the only verification that counts for
B1, B2, B4 and I1

> Make the booking actions look right on a phone and make them explain themselves,
> then give a new vendor the same getting-started guide the web portal has —
> scoped to the features that actually exist on the phone.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "vendor-mobile hidden-action-bar I1").

---

## 0. Scope

**In scope**

- The action bar on the booking detail screen — `BookingActionBar`, all four render branches.
- One "i" affordance per bar, explaining every action currently on screen (D2).
- Approve/Reject wording added to the shared action-copy table, in **both** repos (D4).
- A hideable getting-started guide card on the mobile Dashboard (D3).

**Out of scope**

- `booker` and `ezzy-booker-mobile`. `booker/lib/bookingActionCopy.ts` is a
  **separate table with its own keys and its own audience** (its own file header
  says so) — nothing in this plan touches it. Verified at
  `booker/lib/bookingActionCopy.ts:34` and `booker/components/dashboard/GuidePanel/guideItems.ts:47`.
- `backbone`. **No schema change, no migration, no RLS change.** Every item here
  is presentation and copy; not one of them writes to the database differently
  than it does today.
- Which action a booking offers. That decision lives in `bookingActionRules.ts`
  and is not touched — this plan changes what the actions *look like* and what
  they *say*, never when they appear.

**Cross-app flag.** D4 makes this a two-repo change (`ezzy-vendor-mobile` +
`vendor`). Root `AGENTS.md` lists that as an approval gate; the user chose that
option explicitly on 2026-08-03, which is the approval. The web half is two
files and is spelled out in full at B3.

---

## BLOCKERS

### B1 — The action bar is oversized  🔄 IN PROGRESS (coded 2026-08-03, needs a screenshot)

> **Executed 2026-08-03, stage 2.** `bar` split to `paddingVertical: spacing.md` /
> `paddingHorizontal: spacing.lg`, `gap` → `spacing.sm`; the five button labels
> (`approveLabel`, `rejectLabel`, `primaryLabel`, `ghostLabel`, `dangerLabel`) →
> `type.label.size`; `flagRow.paddingBottom` → `spacing.md`. `button.minHeight`
> untouched at `MIN_TOUCH_TARGET`.
>
> `confirmTitle` deliberately **left** at `type.body.size` — it is a heading, not
> a button label. `timer`, `unpaid`, `confirmTitle`, `confirmBody` and
> `flagRow.paddingHorizontal` all kept `spacing.lg`, which is what keeps them
> aligned with the buttons now that the horizontal inset stays 16; a comment on
> `flagRow` records that they must move together.
>
> **Verified (machine only):** `tsc` · `expo lint` · 91/91 tests · `expo export`.
> **Not verified:** everything that matters. Machine checks cannot see 68pt.

**Files:**
- `src/components/bookings/BookingActionBar/BookingActionBar.styles.ts:7-14` (`bar`)
- `:26-42` (`timer`, `unpaid`), `:45-63` (`confirm`, `confirmTitle`, `confirmBody`)
- `:66-73` (`button`), `:78-82` / `:87-91` / `:106-110` / `:118-122` / `:149-153` (the five label styles)
- `:137-141` (`flagRow`)

Today the bar is `padding: spacing.lg` (16) on every side, a `spacing.md` (12)
gap, 44pt buttons and 15pt (`type.body.size`) bold labels — **76pt of bar** at
the bottom of a screen whose content is already competing with a floating tab bar.

**Fix approach**

- `bar.paddingVertical` → `spacing.md` (12). `bar.paddingHorizontal` **stays**
  `spacing.lg` (16) — see the correction below.
- `bar.gap` → `spacing.sm` (8).
- All five label styles → `type.label.size` (13), weight unchanged at 700/600.
- `button.minHeight` stays `MIN_TOUCH_TARGET` (44). **This is not negotiable** —
  it is the iOS HIG and Material floor, and `ux-design` §5 and `mobile-dev` §2
  both state it. The bar gets shorter by losing chrome, never by shrinking the
  thing a thumb has to hit.

**Correction to the option I put in front of you (2026-08-03).** The preview said
"padding 16→12" on all sides and "~76pt → ~62pt". Two things were wrong with it
and the item above is what should actually ship:

1. **Horizontal padding must stay 16.** The cards on the same screen sit at
   `spacing.xl` (24) inset (`BookingDetail.styles.ts:16`). Dropping the bar to 12
   would put the buttons 12 from the screen edge under cards inset 24 — a visible
   misalignment, and a worse result than the problem being fixed.
2. **The height arithmetic was wrong.** The button is `minHeight`-floored at 44,
   so shrinking the label does not shrink the button. Real change is
   `16+44+16 = 76` → `12+44+12 = **68**`, not 62. The label change buys legibility
   and lightness, not height.

If 68 still reads heavy on device, the next notch is `paddingVertical: spacing.sm`
(8) → 60pt. Do not go below that: at 60 the bar is already 44 of button and 16 of
breathing room.

**The coupling an under-specified version of this item would miss.** `timer`,
`unpaid`, `confirmTitle` and `confirmBody` each carry their own
`paddingHorizontal: spacing.lg`, and `flagRow` carries `paddingHorizontal:
spacing.lg` + `paddingBottom: spacing.lg`. They are separate declarations that
happen to agree with `bar` today. Because B1 keeps horizontal padding at 16,
**none of them change** — but the `flagRow.paddingBottom` should follow the bar's
new vertical rhythm and become `spacing.md`. Any future change to the bar's
horizontal inset must move all six together or the banner text will stop lining
up with the button edges.

**Verification:** device screenshot, `pending` and a `confirmed` booking. No
machine check in this repo can see this — see §Verification.

---

### B2 — One "i" per bar, explaining every action on screen  🔄 IN PROGRESS (coded 2026-08-03, needs a screenshot)

> **Executed 2026-08-03, stage 3.** `useBookingActionBar` gained `visibleActions`
> (memoised, derived from the same four values the render layer branches on) and
> swapped `infoFor`/`showInfo`/`hideInfo` for `infoOpen`/`openInfo`/`closeInfo`.
> `ActionInfoSheet` takes `actions: readonly BookingActionCopy[]`, renders a
> "What these do" heading and one label/meaning pair per action. The trigger now
> renders in **both** branches at the end of the row.
>
> `APPROVE_COPY` / `REJECT_COPY` / `APPROVAL_ACTIONS` are resolved at **module
> scope**, not per render — `APPROVAL_ACTIONS` is returned directly from the
> `visibleActions` memo, and a fresh array each render would defeat it.
>
> **Scroll bound, as the plan required, but on a different element than written.**
> The plan said `maxHeight: "70%"` on the sheet. That would silently do nothing:
> RN resolves a percentage height against the parent's height, and the sheet's
> parent (the tap-blocking inner `Pressable`) is auto-height, so there is nothing
> to resolve against. The bound went on that Pressable instead — `backdrop` is
> `flex: 1` and therefore definite, making it the last element in the chain where
> "70%" means anything — with `flexShrink: 1` on the sheet and on the ScrollView
> so the "Got it" button is never the thing pushed off the bottom. Recorded
> because the wrong version type-checks, lints and bundles identically.
>
> **Verified (machine only):** `tsc` · `expo lint` · 91/91 · `expo export`.
> **Not verified:** that the sheet scrolls rather than clips at large font sizes —
> which is the entire point of the paragraph above.

**Files:**
- `src/components/bookings/BookingActionBar/BookingActionBar.tsx:46-88` (pending branch — **no "i" at all today**)
- `:199-214` (the current trigger — rendered only when `fulfilCopy` exists)
- `src/components/bookings/BookingActionBar/useBookingActionBar.ts:40`, `:117-121` (`infoFor` / `showInfo` / `hideInfo`)
- `src/components/bookings/ActionInfoSheet/ActionInfoSheet.tsx` (props + body)
- `src/components/bookings/ActionInfoSheet/ActionInfoSheet.styles.ts:49-63` (`makeTriggerStyles`)

The "i" exists but reaches only one of the five actions. A vendor on a `pending`
booking — the commonest screen in the app — gets no explanation of Approve or
Reject at all, and Undo and Flag are explained only to screen-reader users via
`accessibilityHint`.

**Fix approach (D2: one trigger per bar, one sheet listing everything on screen)**

- `useBookingActionBar` gains `visibleActions: readonly BookingActionCopy[]` —
  the ordered list of actions the bar is currently rendering, derived from the
  **same** values the render layer branches on (`approvalCopy` for `pending`;
  `fulfilCopy`, `undoCopy`, `flagCopy` otherwise). One derivation, so the bar and
  the sheet cannot disagree about which actions exist. Building the list a second
  time in the render layer is the failure mode this wording exists to forbid.
- `infoFor: BookingActionCopy | null` → `infoOpen: boolean`; `showInfo(copy)` →
  `openInfo()`. The sheet no longer explains *one* action.
- `ActionInfoSheet` prop `copy: BookingActionCopy | null` →
  `actions: readonly BookingActionCopy[]`. It renders a fixed heading
  ("What these do"), one label + meaning pair per action, and the existing
  "Got it" button. Renders nothing when `actions` is empty.
- The trigger moves to a fixed position at the **end of the button row in both
  branches**, so it is in the same place regardless of booking status.
- `accessibilityHint` stays on every button, set to that action's `meaning`
  (already true for fulfil/undo/flag; B3+I2 make it true for approve/reject too).
  **A screen-reader user must never have to open the sheet to learn what a button
  does** — the sheet is the sighted equivalent of a hint, not a replacement for one.

**The under-specification trap.** The sheet can now hold up to three entries
(`Mark as done` + `Undo` + `Something's wrong`), each a label and a two-line
sentence, on a small phone, at the largest OS font setting. A fixed-height bottom
sheet will clip the last one — and the clipped one is `Something's wrong`, the
action with the money consequence. The sheet body **must** be a `ScrollView`
inside a `maxHeight: "70%"` container. A percentage, not a computed pixel value:
it stays static in the stylesheet, which keeps `ActionInfoSheet` a pure display
component with no companion hook (see §Component separation).

**Verification:** device screenshot of the sheet open on a `pending` booking and
on an `in_progress` one (three entries, the longest case). Plus a run at the
largest accessibility font setting to confirm the scroll actually engages.

---

### B3 — Approve and Reject have no copy — extend the shared table in both repos  ✅ DONE (2026-08-03)

> **Executed 2026-08-03, stage 1.** Added `vendor_approve` / `vendor_reject` to the
> key union and the table, and a `stage: "approval" | "fulfilment"` discriminator
> on all seven entries, in **both** `ezzy-vendor-mobile/src/lib/bookingActionCopy.ts`
> and `vendor/lib/bookingActionCopy.ts` (byte-identical wording, each repo's own
> formatting). `vendor/components/dashboard/GuidePanel/guideItems.ts:47` now filters
> to `stage === "fulfilment"` — the coupling below.
>
> Two tests added rather than one: the planned `stage` validity assertion, plus a
> guard on the reversibility claims (`/few seconds to undo/`, `/can't be undone/`).
> Those two sentences are the ones a vendor reads before committing, and the code
> that makes them true is three files away.
>
> Also added to the web table: an explicit note that the two approval entries have
> **no web consumer** and must not be deleted as dead code — this portal's approve
> and reject are inline row buttons with no "i", and the guide panel filters them
> out, so nothing in `vendor` reads them.
>
> **Verified (machine):** mobile `tsc` clean · `expo lint` clean · `npm test`
> **91/91** (was 89 — the two new tests) · `expo export --platform android` builds,
> `dist/` removed. Vendor web `tsc --noEmit` clean.
> **Not verified:** the web guide panel rendering five actions rather than seven —
> that needs the app running and is booked into the stage 3–4 screenshot list.

**Files:**
- `ezzy-vendor-mobile/src/lib/bookingActionCopy.ts:20-26` (key union), `:40-76` (table)
- `ezzy-vendor-mobile/src/lib/bookingActionCopy.test.ts:41-48`
- `vendor/lib/bookingActionCopy.ts:18-23`, `:35-66` — **the mirror**
- `vendor/components/dashboard/GuidePanel/guideItems.ts:47` — **the coupling**

`BOOKING_ACTIONS` holds only the five fulfilment actions. B2 and B4 both need
Approve/Reject wording, and there is nowhere correct to put it today.

**Fix approach (D4: extend the shared table, mirror to web)**

Add to the key union in **both** repos:

```ts
| "vendor_approve"
| "vendor_reject"
```

Add a `stage` discriminator to `BookingActionCopy` in **both** repos, and set it
on all seven entries:

```ts
  /** Which part of a booking's life this action belongs to. Lets a surface show
   *  the fulfilment glossary without the approval actions leaking into it. */
  stage: "approval" | "fulfilment"
```

Add to the table in **both** repos, word for word:

```ts
  {
    key: "vendor_approve",
    label: "Approve",
    meaning:
      "Confirms the booking and tells the customer. You have a few seconds to undo it — after that it can't be sent back to pending.",
    pattern: "both",
    stage: "approval",
  },
  {
    key: "vendor_reject",
    label: "Reject",
    meaning:
      "Asks you for a reason, then cancels the booking and tells the customer why. This can't be undone.",
    pattern: "both",
    stage: "approval",
  },
```

**Both sentences are grounded, not invented.** "A few seconds to undo, then it
can't be sent back" is `useBookingActions.ts:59-72` — the approval is held
locally for `UNDO_WINDOW_MS = 4000` precisely because
`validate_booking_status_transition` permits `pending → confirmed` but **not**
`confirmed → pending`. "Reject can't be undone" is the absence of any un-cancel
path: `fulfilActionFor`, `canUndo` (`UNDOABLE = ["fulfilled", "in_progress"]`)
and `canFlag` all exclude `cancelled` (`bookingActionRules.ts:28-69`).
**Deliberately not stated: anything about refunds.** Whether rejecting refunds a
paid booking was not verified in this investigation, and this is the table that
tells a vendor when money moves — an unverified sentence here is worse than a
missing one.

**The coupling that makes this a two-repo change.**
`vendor/components/dashboard/GuidePanel/guideItems.ts:47` does
`BOOKING_ACTIONS.map(...)` into the **"Completing a Booking"** guide item. Adding
the two entries without touching that line would list "Approve" and "Reject"
under a heading about completing a booking — wrong, on a screen vendors already
use. That line becomes:

```ts
    actions: BOOKING_ACTIONS
      .filter(a => a.stage === "fulfilment")
      .map(({ label, meaning }) => ({ label, meaning })),
```

**Both halves ship in the same batch.** The web edit is not optional cleanup; it
is what stops the mobile change from corrupting a web screen.

**Test update.** `bookingActionCopy.test.ts` gains a `stage` validity assertion
alongside the existing `pattern` one. The four existing assertions all still pass
with two new entries — checked: they iterate the table rather than assert its
length, and `pattern: "both"` is already in the accepted set (`:44`).

**Verification:** `npm test` in mobile; `tsc` in both repos; visual check of the
web dashboard guide panel showing exactly the five fulfilment actions.

---

### B4 — No getting-started guide on mobile  🔄 IN PROGRESS (coded 2026-08-03, needs a screenshot)

> **Executed 2026-08-03, stage 4.** Four new files under
> `src/components/dashboard/GuideCard/`, mounted in `DashboardView.tsx` below the
> stat grid. `useGuideCard` holds `hidden: boolean | null` and the card returns
> `null` while the preference read is outstanding, so it cannot flash on a cold
> start. Persisted at `ezzy.vendor.guideHidden`.
>
> Content is the six mobile-scoped items from the table above, **not** the web's
> list — no Schedule, no Offerings & Staff, and a tip about push notifications
> (actionable from this app) instead of the web's tip about offerings (not).
> The "Completing a booking" glossary derives from
> `BOOKING_ACTIONS.filter(stage === "fulfilment")`, the same expression the web
> guide now uses.
>
> **The Transactions copy was checked, not assumed**, as this item required:
> `TransactionSummaryCards.tsx:46` labels the figure "After platform fee" and
> `transactions.service.ts` selects `platform_fee_amount` and `payout_amount`
> separately, so "after the platform fee" is accurate.
>
> **Verified (machine only):** `tsc` · `expo lint` · 91/91 · `expo export`.
> **Not verified:** light/dark rendering, and the force-quit relaunch that proves
> the preference persists without flashing.

**New files:** `src/components/dashboard/GuideCard/` — `GuideCard.tsx`,
`useGuideCard.ts`, `GuideCard.styles.ts`, `guideItems.ts`
**Modified:** `src/components/dashboard/DashboardView/DashboardView.tsx`
**Ported from:** `vendor/components/dashboard/GuidePanel/GuidePanel.tsx` + `guideItems.ts`

**Fix approach (D3: collapsible card on the Dashboard, mirroring web)**

- Card sits **below the stat grid and above "Waiting for approval"**
  (`DashboardView.tsx:102`). Not above the stats: the numbers are what a
  returning vendor opens the app for, and a guide they have read fifty times
  should not push them below the fold. A first-time vendor reaches it with one
  short scroll.
- Header with a title, a one-line subtitle and a **Hide** control; when hidden, a
  single right-aligned **Show guide** button occupies the same slot. This mirrors
  the web (`DashboardPage.tsx:61-71`) rather than collapsing in place — a vendor
  who uses both clients meets the same affordance twice.
- State persisted in `AsyncStorage` under `ezzy.vendor.guideHidden`, using the
  fire-and-forget write already established by `AppThemeProvider.tsx:32-37`
  (a failed write costs a preference, never blocks the UI).

**The under-specification trap: the flash.** `AsyncStorage.getItem` is async. A
`useState(false)` default renders the guide card for one frame on **every cold
start**, to the vendor who explicitly hid it — the most annoying possible failure
of a "hide" button. `useGuideCard` therefore holds `hidden: boolean | null`,
starts at `null`, and `GuideCard` renders **nothing at all** until the read
resolves. Same shape as `AppThemeProvider`'s cancelled-effect read.

**The port trap: do not copy the web's content.** The web guide lists *Schedule
Management*, *Offerings & Staff*, "the Schedule page" and "the booker booking
wizard". **None of those screens exist in this app** — the mobile tabs are
Dashboard, Bookings, Transactions, Notifications, Settings. Porting the list
verbatim produces a guide to features the vendor cannot find, which is worse than
no guide. The mobile `guideItems.ts` carries its own list, scoped to the app:

| Item | Icon | Colour | Substance |
|---|---|---|---|
| Pending Approvals | `Clock` | `#f59e0b` | Requests land here first; open one, approve or reject, customer is told either way |
| Bookings & filters | `BookOpen` | `#10b981` | Everything lives under Bookings; the chips filter by stage, the badge counts what needs you |
| Completing a booking | `CircleCheckBig` | `#06b6d4` | Both sides must say so; payout releases at that point — **plus the action glossary from `BOOKING_ACTIONS.filter(stage === "fulfilment")`**, exactly as the web derives it |
| Transactions | `Wallet` | `#6366f1` | What each payable booking earned, after the platform fee |
| Notifications | `Bell` | `#3b82f6` | New requests and customer updates arrive here, and as push if enabled in Settings |
| Tip | `Lightbulb` | `#6366f1` | Turn on push notifications in Settings so new requests reach you without opening the app |

Closing line: *"Schedules, offerings and staff are managed on the web portal."* —
consistent with the footnote Settings already shows
(`SettingsList.tsx`, Account section).

**Copy to verify during execution, not to assume.** The Transactions line asserts
"after the platform fee". Check it against `src/services/transactions.service.ts`
before committing the string; if the mobile screen shows gross rather than net,
reword. The same discipline as B3 — this card sits next to numbers about money.

**Accessibility (explicitly requested).**

- Hide and Show are `accessibilityRole="button"` with 44pt targets, labelled
  "Hide the getting-started guide" / "Show the getting-started guide" — not bare
  "Hide"/"Show", which read as orphans out of context.
- `accessibilityState={{ expanded }}` on the control, so the state is announced.
- Every guide item pairs its icon and colour with a text title. **No meaning is
  carried by colour alone** (`ux-design` §5); the coloured left rule and icon
  tint are decoration and get `accessibilityElementsHidden` / `importantForAccessibility="no"`.
- Text scales with the OS font setting — no `maxFontSizeMultiplier` caps here.
  Every element in the card is in normal flow with no `minHeight`-floored
  control, so it grows correctly.

**Four states.** Deliberately not applicable: the card is static local content
with no fetch, no query and no failure mode. Stating that here so a reviewer does
not demand loading/empty/error surfaces that would be theatre. The only
asynchronous thing about it is the preference read, handled above.

**Verification:** device screenshot in light **and** dark, guide shown and
hidden, plus a force-quit and relaunch to prove the preference survives and does
not flash.

---

## IMPORTANT

### I1 — The "i" trigger will read as a third button  🔄 IN PROGRESS (coded 2026-08-03, needs a screenshot)

> **Executed 2026-08-03, stage 2.** Extracted to its own component,
> `src/components/bookings/ActionInfoTrigger/` — 44pt hit area drawing nothing,
> containing a 28pt `t.overlaySubtle` circle holding the glyph. `makeTriggerStyles`
> and `infoGlyph` moved out of `ActionInfoSheet.styles.ts` and
> `BookingActionBar.styles.ts` respectively; the now-unused `Platform` import came
> out of the latter.
>
> **Extraction was a deviation from the plan, which said only "restyle".** B2 gave
> the trigger a second call site, so the choice was duplicating ~12 lines of JSX
> or extracting; extraction also ends `BookingActionBar.tsx` importing another
> component's stylesheet, which it had been doing. Pure display, no state, so no
> companion hook — consistent with `ActionInfoSheet`.
>
> **Also fixed, found while reviewing the diff:** with the trigger now rendered
> unconditionally, a `completed` booking — no fulfil, no undo, flag only — leaves
> the button row holding the "i" **alone**, where it would hang off the left edge.
> `marginLeft: "auto"` on the trigger pins it right in that case and contributes
> nothing when the `flex: 1` buttons are present. Previously that row rendered
> empty, so this is a net improvement, but it is not what the plan described.
>
> The glyph carries `maxFontSizeMultiplier={1.4}` — the mark is a fixed 28pt
> circle rather than a `minHeight`-floored control, which is exactly the case
> `tokens.ts` names for a cap. Nothing is lost: the meaning is in the
> `accessibilityLabel`.

**File:** `src/components/bookings/ActionInfoSheet/ActionInfoSheet.styles.ts:49-63`

`makeTriggerStyles` gives the trigger `width/height: MIN_TOUCH_TARGET` (44) plus
`borderWidth: 1` and `borderColor: t.divider` — a 44×44 bordered box. Sitting
beside two buttons that B1 has just lightened, it becomes the heaviest-looking
element in the row and works directly against B1.

**Fix approach:** keep the **hit area** at 44×44 and draw a smaller visual — a
~28pt circle with a tinted background (`t.overlaySubtle`) and no border, centred
in the 44pt pressable. This is the standard mobile answer: the target a thumb
needs and the mark an eye needs are different sizes, and only one of them is
allowed to shrink.

**Verification:** part of B1/B2's screenshot — the row should read as
"two actions, one hint", not "three buttons".

### I2 — Approve/Reject hints are hardcoded strings that B3 duplicates  ✅ DONE (2026-08-03)

> **Executed 2026-08-03, stage 3.** Both literals replaced with
> `s.approveCopy.meaning` / `s.rejectCopy.meaning`. Verified by grep: no
> `accessibilityHint="` string literals remain in `BookingActionBar.tsx`.
> Fully machine-verifiable, so this one is ✅ rather than 🔄.

**File:** `src/components/bookings/BookingActionBar.tsx:55` and `:69`

```
accessibilityHint="Confirms the booking. You can undo for a few seconds."
accessibilityHint="Asks for a reason, then cancels the booking"
```

These are literals in the render layer. Once B3 lands, the same two sentences
exist in the copy table, and the app has two sources of truth for what Approve
does — the exact drift `bookingActionCopy.ts` was created to prevent, and the
fulfil/undo/flag buttons already avoid (`:186`, `:222`, `:245` all use
`copy.meaning`).

**Fix approach:** replace both with the `meaning` from the table, matching every
other button in the file. Depends on B3.

**Verification:** grep — no `accessibilityHint="` string literals left in
`BookingActionBar.tsx`.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. -->

- **D1 — What "too big" means.** → **Trim chrome, keep 44pt targets**
  (resolved 2026-08-03) — labels 15→13pt, vertical padding 16→12, gap 12→8; the
  touch target stays at the accessibility floor. See the two corrections recorded
  inline at B1: horizontal padding stays 16 (card alignment), and the real height
  change is 76→68, not the 62 quoted in the option.
- **D2 — How the "i" works.** → **One trigger per bar, one sheet listing every
  action on screen** (resolved 2026-08-03) — fewer controls in a bar that is
  already too heavy, scales as actions are added, and covers Approve/Reject/Undo/
  Flag, none of which have any sighted explanation today.
- **D3 — Where the guide lives.** → **Collapsible card on the Dashboard**
  (resolved 2026-08-03) — mirrors the web portal's placement and its hide /
  show-guide affordance; persisted in AsyncStorage like the theme preference.
- **D4 — Where Approve/Reject copy lives.** → **Extend the shared
  `BOOKING_ACTIONS` table and mirror it to `vendor`** (resolved 2026-08-03) —
  one source of truth for the wording that tells a vendor when money moves. This
  is the cross-app approval gate, granted by the choice itself; the web half is
  the two files at B3 and ships in the same batch.

No open decisions.

---

## DEFERRED / COSMETIC

- **A guide entry in Settings.** The Dashboard's own Show-guide button is
  sufficient to get the card back, and a second entry point is a second thing to
  keep consistent. Revisit only if the Dashboard button proves hard to find.
- **Collapse-in-place (chevron) instead of hide/show.** Rejected for D3: it would
  make the two clients behave differently for the same content, for no gain.
- **Porting `InfoTip` as a reusable mobile component.** The "i" has exactly one
  call site. An abstraction for a single use is the thing `AGENTS.md`'s
  Simplicity First rule forbids; extract it when a second surface needs it.

---

## Execution order

Four stages. **One stage at a time by default** (`developerboss`) — say the word
if you want a range in one pass.

1. ✅ **B3** — the copy table, both repos, plus the web `guideItems.ts` filter and
   the mobile test. Everything downstream reads from this table, and it is the
   only stage with a cross-app footprint. Machine-verifiable end to end.
   *(Done 2026-08-03 — see B3.)*
2. ✅ **B1 + I1** — bar sizing and the trigger's visual weight. Independent of B3.
   Grouped because they are the same screenshot: shrinking the buttons without
   also lightening the trigger makes the trigger the loudest thing in the row.
   ~~**Needs a device screenshot before stage 3 starts.**~~ *(Coded 2026-08-03.
   The screenshot gate was overtaken by "execute till completion" — stages 2–4
   were written in one pass, so the screenshots now verify all three at once
   rather than gating between them. Noted because it means a bad screenshot is
   ambiguous across more items than the plan intended.)*
3. ✅ **B2 + I2** — the one-per-bar "i" and the sheet that lists every action.
   Depends on B3 (needs `vendor_approve` / `vendor_reject`) and reads better
   against a bar that is already the right size. *(Coded 2026-08-03.)*
4. ✅ **B4** — the Dashboard guide card. Depends on B3 for its fulfilment glossary.
   Largest surface, entirely new files, no interaction with stages 2–3.
   *(Coded 2026-08-03.)*

**All four stages coded. Nothing is committed, and no visual item is ✅** — see
the verification table below for exactly what closes them.

---

## Verification

**Machine-verifiable** (run after every stage; all four are clean today, so any
output is a regression introduced by this work):

- `ezzy-vendor-mobile/node_modules/.bin/tsc --noEmit --project ezzy-vendor-mobile/tsconfig.json`
- `npm --prefix ezzy-vendor-mobile run lint`
- `npm --prefix ezzy-vendor-mobile test` — covers B3's table and its new `stage` assertion
- `npx expo export --platform android` from inside the app folder; delete `dist/` afterwards
- `vendor`: `tsc --noEmit` for the B3 mirror

**Discovered 2026-08-03, not fixed (unrelated to this plan).** `vendor`'s ESLint
is broken at *config load*: `./node_modules/.bin/eslint <anything>` dies with
`TypeError: Converting circular structure to JSON` inside
`@eslint/eslintrc/lib/shared/config-validator.js`. Confirmed pre-existing by
running it against `lib/utils.ts`, which this plan does not touch — it fails
identically. So the web half of B3 is covered by `tsc` only, and vendor lint is
not a signal for any stage of this plan. Worth its own fix; deliberately not
fixed here (Surgical Changes).

**Needs a live device — and this is where the plan actually gets verified.**
Every visual claim in B1, B2, B4 and I1 is invisible to all five commands above.
`AGENTS.md` records four separate style passes in this app that passed every
machine check and did nothing on screen. Screenshots needed:

| Stage | Screenshot |
|---|---|
| 2 | A `pending` booking — bar at 68pt, 13pt labels, buttons still 44pt tall, trigger visually lighter than the actions |
| 3 | The sheet open on `pending` (2 entries) and on `in_progress` (3 entries), plus one run at the largest OS font setting to confirm the sheet scrolls rather than clips |
| 4 | Dashboard in light and dark, guide shown and hidden; then force-quit and relaunch to prove the preference persists **and does not flash** |
| 3–4 | Web vendor dashboard guide panel — five fulfilment actions listed, no Approve/Reject |

**Platform caveat, unchanged from every prior plan in this app:** verification
will be **Android only**. Nothing in this app has ever been verified on iOS
(no paid Apple Developer account — `IOS-BUILD.md`, plan B9). The 44pt floor, the
`maxHeight: "70%"` sheet and the safe-area behaviour are all written to be
platform-neutral, but "written to be" is not "shown to be", and the completion
note must say Android.

---

## Component separation compliance

Required explicitly by the plan-authoring flow (step 4), per component:

| Component | Render layer | Hook | Styles |
|---|---|---|---|
| `BookingActionBar` | `.tsx` stays pure — the new `visibleActions` list is **derived in the hook**, never rebuilt in the render layer | `useBookingActionBar.ts` gains `visibleActions`, `infoOpen`, `openInfo`; loses `infoFor`/`showInfo` | `.styles.ts` — all B1 changes land here; no new inline style |
| `ActionInfoSheet` | `.tsx` stays a **pure display component** — no state, so it keeps having no companion hook | none, deliberately | `.styles.ts` — the `maxHeight: "70%"` is a static percentage precisely so no hook is needed to compute it |
| `GuideCard` (new) | `.tsx` pure render, no `useState`/`useEffect`/handlers | `useGuideCard.ts` owns the AsyncStorage read/write and the `hidden: boolean \| null` state | `GuideCard.styles.ts` exporting `makeStyles(tokens)`, memoised on `tokens` in the render layer |
| `guideItems.ts` (new) | data module, no React import — same shape as the web's | — | per-item colours are **genuinely dynamic one-off values** and may stay inline, exactly as the web does at `GuidePanel.tsx:44-50` |
| `DashboardView` | gains `<GuideCard />` only | `useDashboardView` **unchanged** — the card owns its own state | unchanged |
