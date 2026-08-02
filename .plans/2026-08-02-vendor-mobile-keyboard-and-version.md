# Ezzy Vendor Mobile — sign-in keyboard overlap, and app version in Settings

**Date:** 2026-08-02
**App / scope:** `ezzy-vendor-mobile` only — `ezzy-vendor-mobile/src/components/common/AuthScreen/`,
`ezzy-vendor-mobile/src/components/settings/SettingsList/`, `ezzy-vendor-mobile/app.json`, `ezzy-vendor-mobile/app.config.js`
**Status:** ✅ **COMPLETE (2026-08-02)** — all 3 items done (B1 ✅ · I2 ✅ · I1 ✅),
all 3 decisions resolved. B1 was device-confirmed on Android by the user; iOS
remains unverified by design (D3), and the Settings About row has not been seen on
a device — neither blocks completion, both are recorded at their items.

> Two unrelated issues, planned together because both are small and both land in
> the same app. One is a front-door defect; the other is a missing piece of
> support information that turns out to sit on a version mismatch.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "vendor-mobile fulfilment-sync I8").

---

## Scope

**In:**
1. The software keyboard covering the password field on sign-in, on **both**
   Android and iOS.
2. Showing the app version in Settings, sourced from `ezzy-vendor-mobile/package.json`.

**Out, deliberately:**
- `ezzy-booker-mobile`, the web apps, `backbone` — nothing here touches them.
- Any other screen's keyboard handling **except** as a consequence of B1's shared
  component (see the blast-radius note on B1) — `SearchField` and
  `RejectReasonSheet` are not in scope.
- A build-number/versionCode scheme. `ezzy-vendor-mobile/eas.json` already sets
  `appVersionSource: "remote"`, so EAS owns the build number; this plan touches
  only the user-facing `version` string.

**Cross-app coupling:** none. Single app, no schema, no RLS, no shared types.

> ### ⛔ Scope guard — `ezzy-vendor-mobile` ONLY
>
> **Nothing in this plan touches the `vendor` web app.** Confirmed 2026-08-02 by
> auditing every path reference in this document; all of them are now written with
> an explicit `ezzy-vendor-mobile/` prefix.
>
> This matters because three of the files here have same-named siblings in the web
> app — `package.json` most dangerously, since `vendor/package.json` exists and a
> version bump aimed at the wrong one would change a published web app's version.
> **`app.json`, `app.config.js` and `eas.json` are Expo-only and have no `vendor`
> equivalent**, but they are still qualified for consistency.
>
> The previous plan (`2026-08-02-vendor-mobile-fulfilment-sync.md`) *did* widen to
> `vendor` for one item, under an explicit approval. **No such approval applies
> here.** If execution ever appears to need a `vendor` change, stop and ask — that
> is a new cross-app gate, not a continuation of the last one.
>
> Commits for this work are made **from inside `ezzy-vendor-mobile/`**, which is
> its own git repository.

---

## BLOCKERS

### B1 — The keyboard covers the password field on sign-in  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — executed as stage 1; **confirmed on a device by the
> user**, which is the only verification that counts for a layout fix. Machine
> checks cannot see this class of change.
> **Verified by:** the user, on Android. Not by me — recorded that way on purpose.
> **Changed:** `ezzy-vendor-mobile/src/components/common/AuthScreen/AuthScreen.tsx`
> · `ezzy-vendor-mobile/app.json` (one line).
> **Verified (machine only):** `tsc` exit 0 · `npm test` 89/89 · `expo lint` exit 0
> · `expo export --platform android` exit 0 · `npx expo config --type public`
> resolves `android.softwareKeyboardLayoutMode` to `resize`.
> **Scope confirmed:** `vendor` web shows only the two unrelated D6 files from
> earlier today — nothing from this plan reached it.

> **⚠️ Correction: my own primary hypothesis was wrong (2026-08-02).**
> This item led with `justifyContent: "center"` on a `flexGrow: 1` container as
> "the most likely cause… platform-independent". **It is not a bug at all here, and
> nothing was changed for it.**
>
> The trap I was describing applies to `justifyContent: "center"` on a ScrollView's
> own `style`. This is on **`contentContainerStyle`**, where the behaviour is the
> opposite: with `flexGrow: 1`, content shorter than the viewport is centred, and
> content TALLER than the viewport grows the container so there is no free space to
> distribute — it starts at the top and scrolls normally. That is the recommended
> React Native pattern, not a defect. Had I "fixed" it, I would have broken the
> centring on every one of the six routes to no benefit.
>
> **The real cause was hypothesis #2**, which the item ranked second: Android was
> passing `behavior={undefined}`, so the component did **nothing** on the one
> platform that is actually tested.

**What was actually changed — one mechanism per platform, deliberately not shared:**

| Platform | Before | After |
|---|---|---|
| Android | `behavior={undefined}` — no compensation at all | `behavior="height"` — resizes to the space above the keyboard, and works whether or not the window itself resizes |
| iOS | `behavior="padding"` on the KeyboardAvoidingView | `automaticallyAdjustKeyboardInsets` on the ScrollView; KAV now `undefined` on iOS |

Stacking both would double-compensate and push the form off-screen the other way,
which is why the KAV is now Android-only.

**Why iOS changed too, when only Android was reported.** `automaticallyAdjustKeyboardInsets`
is React Native's native iOS mechanism and scrolls the **focused input** into view
rather than padding the whole container — the behaviour a login form wants. It
also drops a latent double-count: `behavior="padding"` added the full keyboard
height on top of the home-indicator inset the `SafeAreaView`'s `bottom` edge had
already consumed. The prop is iOS-only and a no-op elsewhere, so it is set
unconditionally.

**`app.json` — `android.softwareKeyboardLayoutMode: "resize"`,** declared rather
than defaulted. Verified against the SDK 57 config reference that `resize` is
already the default, so **this changes no behaviour** — it stops six screens
depending on an undeclared default. Applied as a one-line text edit after a first
attempt via `json.dump` reformatted two unrelated `infoPlist` arrays; the diff is
now exactly one line.

**Device verification (2026-08-02):** sign-in confirmed working by the user on
Android.

**Still open, and deliberately not claimed by this ✅:**
- The other five `AuthScreen` routes (`index`, `forgot-password`, `reset-password`,
  `blocked`, `select-vendor`) were not individually confirmed. `forgot-password`
  and `reset-password` have inputs and inherit this change; they are the two worth
  a glance if anything looks off later.
- **iOS remains unverified** — expected and accepted under D3. The iOS path uses a
  different mechanism (`automaticallyAdjustKeyboardInsets`) from the Android one
  that was just confirmed, so the Android result says nothing about it.

**Files:** `ezzy-vendor-mobile/src/components/common/AuthScreen/AuthScreen.tsx:68-91`,
`ezzy-vendor-mobile/src/components/common/AuthScreen/AuthScreen.styles.ts:17-24`, `ezzy-vendor-mobile/app.json`

**⚠️ First correction: this is not a missing `KeyboardAvoidingView`.** One is
already there, so any plan item reading "add keyboard avoidance" would be wrong
and would probably produce a second, conflicting wrapper:

```tsx
// AuthScreen.tsx:68-77
<SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
  <KeyboardAvoidingView
    style={styles.keyboard}
    behavior={Platform.OS === "ios" ? "padding" : undefined}   // ← Android: nothing
  >
    <ScrollView
      contentContainerStyle={styles.scroll}                     // ← flexGrow:1 + center
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
```

```ts
// AuthScreen.styles.ts:20-24
scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
```

**Three candidate causes, and they are not equally likely.** The plan must not
pick one blindly — B1's first task is to identify which actually bites, on each
platform:

1. **`justifyContent: "center"` on a `flexGrow: 1` content container.** The
   long-standing React Native failure mode: once content is taller than the
   viewport, centring pushes the overflow **out of reach in both directions** and
   the ScrollView cannot scroll to it. When the keyboard shrinks the viewport this
   is exactly the state the sign-in form enters. **This is the most likely cause
   and it is platform-independent** — which would explain a bug the user sees on
   the device they actually test.
2. **Android has no `behavior`.** `undefined` is the correct choice *if*
   `android:windowSoftInputMode=adjustResize` is doing the work. Verified against
   the SDK 57 config reference: `android.softwareKeyboardLayoutMode` **defaults to
   `resize`**, so the mechanism should be active — but it is defaulted, not
   declared, and nothing in the repo states the dependency.
3. **iOS `behavior="padding"` inside a `SafeAreaView` with `edges` including
   `"bottom"`.** The safe-area inset is consumed by the parent and the keyboard
   height is added by the child, which can over-pad by the home-indicator height.
   This misplaces the form; it does not usually hide a field outright.

**Fix approach — see D1 for the choice between two routes.** Whichever is chosen,
the item is only complete when the password field is reachable **and the form is
scrollable to both ends** while the keyboard is open.

**⚠️ Blast radius — `AuthScreen` is shared by six routes**, not just sign-in:
`ezzy-vendor-mobile/src/app/index.tsx`, `ezzy-vendor-mobile/src/app/sign-in.tsx`, `ezzy-vendor-mobile/src/app/forgot-password.tsx`, `ezzy-vendor-mobile/src/app/reset-password.tsx`,
`ezzy-vendor-mobile/src/app/blocked.tsx`, `ezzy-vendor-mobile/src/app/select-vendor.tsx`. Two of those (`forgot-password`,
`reset-password`) also have text inputs and will inherit the fix — a benefit, but
it means **all six need a visual check**, not just the one that was reported.

**⚠️ "Works on both" is not fully verifiable today — see D3.** The app's own
`AGENTS.md` states iOS has never been verified at all: App Store Expo Go cannot
open an SDK 57 project, so iOS requires a paid Apple Developer account (plan
**B9**, procedure in `ezzy-vendor-mobile/IOS-BUILD.md`).

---

## IMPORTANT

### I1 — Show the app version in Settings  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — executed as stage 3.
> **Changed:** `ezzy-vendor-mobile/src/components/settings/SettingsList/SettingsList.tsx`
> only — **28 insertions, no other file**.
> **Verified (machine):** `tsc` exit 0 · `npm test` 89/89 · `expo lint` exit 0 ·
> `expo export` exit 0 · no new styles (the `.styles.ts` is untouched) · no inline
> `style={{}}` in the render layer.
> **NOT verified:** the row rendering on a device, in either theme.

**What shipped:** a fifth **About** section with one non-interactive row —
`Version` / the version string — reusing the existing
`section` / `sectionTitle` / `card` / `row` / `rowLabel` / `rowValue` vocabulary.
**No new styles were added**, which was the intent: this is the same shape of
information as the `Vendor → Current` row, so it should not look like a different
kind of thing.

**Read through `Constants.expoConfig?.version`, not by importing `package.json`.**
Both now return the same string — that is what I2 established — but they are not
equivalent guarantees. Constants returns what the built app actually declares to
the OS, so the number in Settings cannot drift from the number a store shows.
Importing the file would display whatever the source tree says, which an installed
binary need not agree with. The request asked for the `package.json` value; I2 made
`package.json` the source of that value, so this satisfies it without the
misleading failure mode.

**Component separation:** `APP_VERSION` is a module-level constant resolved once at
load — it cannot change while the app runs, so it is not state, and
`useSettingsList.ts` was deliberately left untouched. Adding a hook for a
build-time constant would satisfy the convention's letter and nothing else.
Falls back to an em dash if `expoConfig` is null (bare/edge runtimes) — better than
"undefined" in a support conversation.

**File:** `ezzy-vendor-mobile/src/components/settings/SettingsList/SettingsList.tsx` (append after
the `Account` section, currently ending ~`:151`)

Settings has four sections — Appearance, Notifications, Vendor, Account — built
from an existing `section` / `sectionTitle` / `card` / `row` / `rowLabel` /
`rowValue` vocabulary. A version row fits that vocabulary exactly.

**Fix approach:** a fifth **About** section containing one non-interactive row,
`rowLabel` "Version" and `rowValue` the version string. **No new styles are
needed** — this is deliberate: the `Vendor → Current` row at `:79-82` is already a
label/value pair with no press handler, so this reuses a proven pattern rather
than inventing one.

**Component separation:** `SettingsList.tsx` stays a pure render layer. The
version is a module-level constant read once (see I2), not state — it cannot
change while the app is running — so **no hook change is required** and none
should be invented to satisfy the convention's letter.

**Where the string comes from is I2's problem, and it is not trivial.**

---

### I2 — `ezzy-vendor-mobile/package.json` and `ezzy-vendor-mobile/app.json` disagree about the version  ✅ DONE (2026-08-02)

> **✅ DONE (2026-08-02)** — executed as stage 2. Unlike B1 this **is** fully
> verified: the seam is machine-checkable, and it was checked.
> **Changed:** `ezzy-vendor-mobile/package.json` (0.7.0 → 1.0.0, one line) ·
> `ezzy-vendor-mobile/app.config.js` (imports `package.json`, sets `version`) ·
> `ezzy-vendor-mobile/app.json` (**`expo.version` removed**).
> **Verified (machine):** the plan's own check passes —
> `npx expo config --type public --json | jq -r .version` = `1.0.0` =
> `jq -r .version package.json`. Also proved it *tracks* rather than coincides:
> temporarily set `package.json` to `9.9.9`, the resolved config reported `9.9.9`,
> then restored. Plus `tsc` 0 · `npm test` 89/89 · `expo lint` 0 ·
> `expo export` 0 · **`expo-doctor` 20/20 checks passed** (confirms removing
> `expo.version` does not violate the app.json schema).
> **Net effect on the outside world: none.** Declared version was 1.0.0 before and
> is 1.0.0 after, exactly as D2 intended. What changed is which file decides it.

> **One thing done beyond the plan's literal text, and why.** The plan showed
> `app.config.js` adding `version: pkg.version` — which *overrides* `app.json` but
> leaves its `"version": "1.0.0"` sitting there. I **removed it from app.json**
> instead.
>
> Leaving it would have recreated the exact defect this item exists to fix: a value
> that is always overridden is a value nobody maintains, so the first `npm version`
> bump would put the two back out of sync — silently, since the stale one is
> unused. `expo-doctor` confirms the schema is happy without it.
>
> The practical upshot: **`npm version <x>` in `ezzy-vendor-mobile/` now updates
> the OS-reported version, the store version, and the Settings display at once.**

**Files:** `ezzy-vendor-mobile/package.json:version`, `ezzy-vendor-mobile/app.json:expo.version`, `ezzy-vendor-mobile/app.config.js`

**Found while planning I1.** They are out of sync **right now**:

| Source | Value |
|---|---|
| `ezzy-vendor-mobile/package.json` | **0.7.0** |
| `ezzy-vendor-mobile/app.json` → `expo.version` | **1.0.0** |

So "show the version" has no single correct answer until this is resolved, and
the naive implementations are each wrong in a different way:

- **Import `ezzy-vendor-mobile/package.json` in the component.** Metro will bundle it, so it
  "works" — and it displays **0.7.0** while the installed build identifies itself
  to the OS and the stores as **1.0.0**. A support conversation keyed on that
  number would be actively misleading. This is the option the request's wording
  points at, and it is the one to avoid.
- **Read `Constants.expoConfig.version`.** `expo-constants` is already a
  dependency (`~57.0.7`), so no approval gate. Displays **1.0.0** — the number the
  OS agrees with — but is not "from `ezzy-vendor-mobile/package.json`" as asked.

**Fix approach:** make `ezzy-vendor-mobile/package.json` the **single source of truth** and have
`ezzy-vendor-mobile/app.config.js` derive from it. That file already exists and already overrides
one field, so this is an addition to an established seam rather than a new one:

```js
// app.config.js
import pkg from "./package.json"

export default ({ config }) => ({
  ...config,
  name: process.env.EXPO_PUBLIC_APP_NAME ?? "Ezzy Vendor",
  version: pkg.version,
})
```

The component then reads `Constants.expoConfig?.version`, which now *is* the
`ezzy-vendor-mobile/package.json` value — satisfying the request literally while keeping the
displayed number identical to what the OS reports.

**⚠️ This changes the app's declared version, which is an outward-facing number.**
See **D2** — the direction matters, and one direction is not reversible in a store.

**Coupled to I1** — I1 cannot be marked done on a number this plan has not agreed.

---

## DECISIONS

<!-- All resolved 2026-08-02. No OPEN lines remain. -->

### D1 — How is B1 fixed? → **(a) Fix in place** (resolved 2026-08-02)

No new dependency. The changes are small and reversible:
  - Replace `justifyContent: "center"` with a centring that cannot trap content
    (e.g. keep `flexGrow: 1` and centre via a spacer, or drop centring while the
    keyboard is open).
  - Add **`automaticallyAdjustKeyboardInsets`** to the `ScrollView`. This is
    React Native's native iOS mechanism, it scrolls the *focused input* into view
    rather than padding the whole container, and it is **not used anywhere in this
    app today** — so it is new behaviour, not a duplicate of the existing KAV.
  - Declare `android.softwareKeyboardLayoutMode: "resize"` in `ezzy-vendor-mobile/app.json`
    explicitly. It is already the SDK 57 default (verified against the v57 config
    reference), so this changes nothing functionally — it stops the screen
    depending on an undeclared default.
  - Revisit `behavior` per platform once the above is on a device.

**Rejected: `react-native-keyboard-controller`.** Documented in the SDK 57
third-party list as providing "a Keyboard manager that works in an identical way
on Android and iOS", and it is the more robust answer — but it is a **new
dependency (approval gate)** and a **native module**, so it needs a fresh dev
build rather than a reload. It stays the named fallback: **if device testing shows
(a) is not enough, stop and ask** rather than expanding scope mid-execution.

### D2 — Which version is the source of truth? → **`ezzy-vendor-mobile/package.json`, bumped to 1.0.0 first** (resolved 2026-08-02)

`ezzy-vendor-mobile/package.json` becomes authoritative, as asked — but its value moves **0.7.0 →
1.0.0** in the same change, so the public version never goes backwards. A store
cannot accept a version lower than one already submitted, and 0.7.0 declared
against a build published as 1.0.0 is exactly that trap.

**Execution consequence:** the bump and the `ezzy-vendor-mobile/app.config.js` wiring must land
**together**. Wiring first would briefly declare the app as 0.7.0.

**Net effect on the outside world: none.** The declared version is 1.0.0 before
and after; what changes is which file decides it.

Rejected: keeping 0.7.0 (lowers the public version), and leaving `ezzy-vendor-mobile/app.json`
authoritative (does not satisfy "reading from `ezzy-vendor-mobile/package.json`").

### D3 — "Works on both" when iOS cannot be tested → **Implement both, verify Android only** (resolved 2026-08-02)

Per the app's `ezzy-vendor-mobile/AGENTS.md`, **nothing in this app has ever been verified on iOS** —
SDK 57 cannot run in App Store Expo Go, so it needs a paid Apple Developer account
(plan B9, procedure in `ezzy-vendor-mobile/IOS-BUILD.md`).

The code accounts for both platforms; **B1 will be marked ✅ on Android evidence
only**, with the iOS half stated as unverified rather than implied. That is how
every other item in this app has been recorded, and it is the honest reading of
"ensure it works for both" under a constraint neither of us can lift today.

Rejected: blocking B1 on an Apple account, which would leave a front-door defect
on the platform that *can* be tested.

---

## DEFERRED / COSMETIC

- **`SearchField` and `RejectReasonSheet` keyboard behaviour** — not reported, and
  `RejectReasonSheet` already has its own `KeyboardAvoidingView`. If D1 (b) is ever
  chosen, revisit both so the app has one keyboard strategy rather than two.
- **A build-number / versionCode scheme** — EAS owns it via
  `appVersionSource: "remote"`. Out of scope.
- **Showing the build number alongside the version in Settings** — genuinely
  useful for support (it identifies the exact binary), but it is a second question
  with its own source-of-truth problem under remote versioning. Raise separately if
  wanted.

---

## Execution order

Ordered by risk and dependency.

1. **B1** — the keyboard fix. Independent of the other two, and the only item
   that is a live defect. First.
2. **I2** — bump `ezzy-vendor-mobile/package.json` to 1.0.0 **and** wire `ezzy-vendor-mobile/app.config.js` in one
   change (D2: splitting them would briefly declare 0.7.0). Must precede I1.
3. **I1** — the About section. Trivial once I2 lands.

All three decisions are resolved, so the whole plan is executable. B1 and I2+I1
are independent of each other and can run in either order; B1 leads because it is
the actual bug.

---

## Verification

**Machine-verifiable:**
- `ezzy-vendor-mobile/node_modules/.bin/tsc --noEmit --project ezzy-vendor-mobile/tsconfig.json` — 0. Use the binary directly; `npm exec tsc` hangs (app `AGENTS.md`).
- `npm --prefix ezzy-vendor-mobile run lint` — 0.
- `npm --prefix ezzy-vendor-mobile test` — currently **89 passing**; must not regress.
- `npx expo export --platform android` — proves the route tree builds; delete `dist/`.
- **I2 specifically:** assert the built config actually carries the intended
  version — `npx expo config --type public --json | jq -r .version` must equal
  `jq -r .version package.json`. This is the check that proves the seam works;
  `tsc` cannot see it.

**Needs a device — cannot be machine-checked:**
- **B1 on Android.** The password field reachable with the keyboard open, *and*
  the form scrollable to both ends. Machine checks are blind here: the app's
  `AGENTS.md` records four style passes that `tsc`, lint, tests and export all
  approved and that **did nothing on screen**.
- **B1 across all six `AuthScreen` routes**, not only sign-in.
- **B1 on iOS** — see D3. Expected to remain unverified.
- **I1** — the About row rendering correctly in both light and dark themes.

**Explicitly not verifiable here:** that the displayed version matches what a
store shows. That can only be confirmed after an EAS build, since EAS resolves the
build number remotely.
