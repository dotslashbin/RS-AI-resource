# ezzy-vendor-mobile — sign-in lands on the password-reset error screen

**Date:** 2026-07-29
**App / scope:** `ezzy-vendor-mobile` (`src/app/_layout.tsx`, `src/components/auth/ResetPasswordForm/`)
**Status:** IN PROGRESS — B1 and I1 executed and machine-verified 2026-07-29;
device verification outstanding (see Verification)

> A successful sign-in throws the user onto `/reset-password`, which reports
> "This link didn't work — This reset link is missing its code." The reset flow is
> not involved at all: the route is the navigator's *fallback* when a guard change
> empties the stack. Fix the fallback, don't touch the reset flow.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "vendor-mobile B1").

---

## 1. Symptom

Signing in with a seeded vendor account shows:

> **This link didn't work**
> This reset link is missing its code. Request a new link and open it on this device.

Force-quitting and relaunching the app lands on the dashboard normally. That
asymmetry is the tell, and §2 explains it.

The strings come from `src/components/auth/ResetPasswordForm/ResetPasswordForm.tsx:29`
and `src/components/auth/ResetPasswordForm/useResetPasswordForm.ts:41-47`. The
hook is behaving correctly — it was handed the `/reset-password` route with no
`code` param, which is exactly what it is written to reject.

---

## 2. Root cause — the navigator's empty-stack fallback is `reset-password`

Four facts combine. Each was read out of the installed `expo-router@57.0.8`, not
recalled.

**(a) There is a window where no route guard passes.**
`src/hooks/useVendorGate.ts:48-52` resets the gate to `INITIAL` **during render**
the moment a session appears, and `INITIAL.status` is `"checking"`
(`useVendorGate.ts:24-30`). The gate then makes a network call (`getUserVendors()`),
so `"checking"` persists for a full round trip. During that window, in
`src/app/_layout.tsx:55-70`:

| Guard | Value while `signedIn && status === "checking"` |
|---|---|
| `!signedIn` → `sign-in`, `forgot-password` | **false** |
| `signedIn && status === "blocked"` → `blocked` | false |
| `signedIn && status === "choosing"` → `select-vendor` | false |
| `signedIn && status === "ready"` → `(app)` | false |

Every guarded screen is gone at once, including the `sign-in` screen the user is
standing on.

**(b) A failed guard removes the screen from the navigator entirely.**
`expo-router/build/useScreens.js:135` filters protected routes out of the sorted
screen list, so they disappear from `routeNames`
(`expo-router/build/react-navigation/core/useNavigationBuilder.js:242`).

**(c) When that empties the stack, the router falls back to `routeNames[0]`.**
`expo-router/build/react-navigation/routers/StackRouter.js:119-131`:

```js
getStateForRouteNamesChange(state, { routeNames, routeParamList, routeKeyChanges }) {
    const routes = state.routes.filter((route) => routeNames.includes(route.name) && …);
    if (routes.length === 0) {
        const initialRouteName = options.initialRouteName !== undefined && routeNames.includes(options.initialRouteName)
            ? options.initialRouteName
            : routeNames[0];          // ← no initialRouteName prop is set, so this branch runs
        routes.push({ key: …, name: initialRouteName, params: routeParamList[initialRouteName] });
    }
```

The stack held only `sign-in` (the `<Redirect>` in `src/app/index.tsx` uses
`replace`, so `index` is not underneath it), so `routes.length === 0`.

**(d) `routeNames[0]` is `reset-password`.**
`expo-router/build/useScreens.js:105-121` orders children by **declaration
order** of the `<Stack.Screen>` elements first, appending undeclared filesystem
routes afterwards. `src/app/_layout.tsx:53` declares `reset-password` first — it
is deliberately unguarded, so it is the first *surviving* name in the list, with
no params.

> `initialRouteName` from `unstable_settings.anchor` does **not** help here.
> `useScreens.js:118` only uses it to sort the *undeclared* remainder, and
> `options.initialRouteName` in (c) comes from the navigator **prop**
> (`expo-router/build/fork/native-stack/createNativeStackNavigator.js:47-50`),
> which `withLayoutContext` forwards from `<Stack …>`. Worth recording, because
> `anchor` is the obvious first thing to reach for and it would not have fixed it.

**Why a relaunch works.** On a cold start `RootNavigator` returns `null` while
`isRestoring` is true (`_layout.tsx:43`), so the Stack mounts *after* the session
is known, with initial state from the URL `/` → `routes: [index]`. `index` is
never guarded, so the later guard flip never empties the stack, and `index.tsx`
redirects to the dashboard once the gate resolves.

### The user is then stuck

`useResetPasswordForm.ts:104`'s "Back to sign in" runs `router.replace("/sign-in")`,
but `sign-in` is still guarded off while the session exists, and
`StackRouter.js:161-163` returns `null` for a REPLACE onto a name not in
`routeNames`. The button silently does nothing. Only a relaunch escapes.

### Three flows hit this, not one

Every place that changes auth state without navigating relies on the guards:

| Flow | Trigger | Result today |
|---|---|---|
| Sign in | `useSignInForm.ts:47-50` (deliberately does not navigate) | → `reset-password` error |
| Sign out | `useSettingsList.ts:33-35` (same) | → `reset-password` error |
| Switch vendor | `useSettingsList.ts:56` → `useVendorGate.ts:134-143` sets `checking`/`choosing` | → `reset-password` error |

Sign-out is arguably worse than the reported bug: it strands a signed-out user on
a broken screen whose only button is a no-op.

---

## BLOCKERS

### B1 — Give the root Stack an explicit fallback route  ✅ DONE (2026-07-29)
**File:** `src/app/_layout.tsx:48`

The navigator has no `initialRouteName`, so its empty-stack fallback is whichever
screen happens to be declared first. Make it the anchor route, which is the file
whose entire job is deciding where a user belongs.

```diff
-    <Stack screenOptions={{ headerShown: false }}>
+    // `initialRouteName` is load-bearing, not cosmetic: when a guard change
+    // empties the stack, StackRouter falls back to this name, and without it
+    // that is `routeNames[0]` — the first declared screen. Every guard is false
+    // for one render while the vendor gate is "checking", so sign-in, sign-out
+    // and switch-vendor all pass through that state.
+    <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
```

`index` is never protected and is always present in the navigator's children, so
the `Couldn't find a screen named …` throw at
`useNavigationBuilder.js:221-223` cannot fire.

**What changes at runtime.** Sign-in → the stack empties → the router pushes
`index` → `src/app/index.tsx:24-28` renders its spinner while the gate is
`"checking"` → gate resolves → `<Redirect href="/dashboard" />`. Sign-out →
`index` → `/sign-in`. Switch vendor → `index` → `/select-vendor`. This is the
behaviour `index.tsx:7-9`'s own comment already claims ("`Stack.Protected` sends
a user here whenever a guard turns false") — currently that comment is false.

**Blast radius.** The `initialRouteName` prop also feeds
`StackRouter.getInitialState` and `getRehydratedState`
(`StackRouter.js:50-118`). Both already resolve to `index` for the `/` path, so
neither changes. It does **not** prepend `index` to deep links — that only
happens via the linking config (`getReactNavigationConfig.js:59-64`), which this
does not touch. The `/reset-password?code=…` deep link is therefore unaffected:
its linking state names a real route, so the `routes.length === 0` branch never
runs.

✅ **DONE (2026-07-29).** `initialRouteName="index"` added to the root `<Stack>`
in `src/app/_layout.tsx`, with the reasoning above condensed into a comment so a
later reader does not read it as decoration and remove it. Verified: `tsc
--noEmit` clean (confirms `Stack` accepts the prop), `expo lint` clean, 40/40
tests pass, and `expo export --platform android` bundles the route tree
successfully (7.1 MB Hermes). All four are machine checks — none of them
exercises a guard transition, so the three device checks below still stand.

---

## IMPORTANT

### I1 — "Back to sign in" is a no-op whenever a session exists  ✅ DONE (2026-07-29)
**File:** `src/components/auth/ResetPasswordForm/useResetPasswordForm.ts:104`

```ts
const goToSignIn = useCallback(() => router.replace("/sign-in"), [router])
```

`/sign-in` is inside `<Stack.Protected guard={!signedIn}>`, so this REPLACE is
dropped (`StackRouter.js:161-163`) any time a session is present. B1 makes this
much rarer but not unreachable: opening a reset link while already signed in on
the device, where the exchange then fails, reaches the invalid branch with a live
session and a dead button.

**Fix approach:** replace to `/` instead. `src/app/index.tsx` is unguarded and
already owns the "where does this user belong" decision, so it is correct in
every state — no session → `/sign-in`; live session → the gate's verdict.

The two button labels stay as they are. In the `done` branch `submit()` has
already called `signOut()` (`useResetPasswordForm.ts:96-100`), so "Sign in" is
accurate. In the `invalid` branch "Back to sign in" is accurate except in the
rare live-session case, where landing on the dashboard is the right destination
anyway — not worth a conditional label.

✅ **DONE (2026-07-29).** `goToSignIn` now replaces to `/`. Labels unchanged, as
planned. Covered by the same `tsc` / lint / test / export run as B1.

---

## Does the same bug exist in `vendor` (web)?  ✅ CHECKED (2026-07-29) — no

Asked during execution. The answer is **no, and it cannot** — the mechanism has
no analogue on the web side.

`vendor` has no route guards and no router-level redirect: it is a single-page
shell that conditionally renders. `components/layout/AppShell/AppShell.tsx:36-71`
is a plain ladder — `isCheckingAuth` → `recoveryMode` → `pendingKycVendorId` →
`!loggedIn` → the app. The mobile bug needs three things the web app does not
have: screens registered with a navigator, a router that deletes them when a
guard flips, and a fallback that picks `routeNames[0]`.

The two specific hazards, checked individually:

- **The gate's "checking" window.** `useAppShell.ts:95-149` runs the same
  access-gate logic mobile ports, and it has the same async window. But
  `AppShell.tsx:36` renders `null` for it — a deliberate, named destination, not
  a fallback the router chooses. Nothing can be routed to by accident.
- **A normal sign-in latching recovery mode.** `lib/supabase/client.ts:13-26`
  latches `recoveryDetected` at module load, which is the same "catch the event
  before React mounts" trick mobile uses. It sets the flag only on a
  `PASSWORD_RECOVERY` event; a password sign-in emits `SIGNED_IN`, so the
  recovery view is unreachable from the sign-in path.

**The app to watch is `ezzy-booker-mobile`,** which will use the same
`expo-router` guards. It is still the untouched template today (`src/app/` holds
only `_layout.tsx`, `explore.tsx`, `index.tsx`, and there is no `Stack.Protected`
anywhere in `src/`), so there is nothing to fix — but its build-out must set
`initialRouteName` on any guarded Stack from the first commit. Recorded against
`.plans/2026-07-21-ezzy-booker-mobile-buildout.md`.

---

## DECISIONS

*No open decisions — the plan may execute once approved.*

- Which fix? → **B1: `initialRouteName="index"`** (resolved 2026-07-29). Two
  alternatives were considered against the same evidence:
  - *Declare `<Stack.Screen name="index" />` first* so `routeNames[0]` becomes
    `index`. Same one-line cost, but it encodes the fix as incidental JSX order
    that any later reordering silently breaks. Rejected.
  - *Add a `guard={signedIn && gate.status === "checking"}` loading screen* so
    some guard always passes. More code, and it does not fix sign-out or
    switch-vendor, where the stack still empties. Rejected as insufficient.
- Change the reset flow itself (e.g. redirect to `/` when `code` is absent)? →
  **No** (resolved 2026-07-29). The reset screen's rejection of a code-less
  navigation is correct and is the real error path for a malformed deep link.
  Masking it there would hide the routing bug rather than fix it.

---

## DEFERRED / COSMETIC

- **`unstable_settings = { anchor: "index" }`.** Would prepend `index` beneath a
  deep-linked `/reset-password?code=…` so the back gesture returns to the app
  instead of closing it (safe to do — `Redirect` uses `useFocusEffect`
  (`expo-router/build/link/Redirect.js:32`), so an unfocused `index` does not
  fire). Deferred: it is a deep-link UX improvement, not this bug, and it changes
  linking-state shape app-wide. Raise it with the reset-link device testing that
  vendor-mobile I4 still needs.
- **Automated regression test for the guard transition.** The project's test
  runner is plain `node --test` over pure-logic modules (`package.json` scripts).
  Covering navigator behaviour needs `jest-expo` + a React renderer — new
  dependencies, an approval gate, and more machinery than the one-line fix. The
  comment added in B1 is the guard instead.

---

## Execution order

Both items are independent, single-file, and safe to do together:

1. **B1** — `src/app/_layout.tsx`.
2. **I1** — `src/components/auth/ResetPasswordForm/useResetPasswordForm.ts`.

No schema change, no new dependency, no cross-app change.

---

## Verification

**Machine-verifiable — all run 2026-07-29, all clean:**
- ✅ `ezzy-vendor-mobile/node_modules/.bin/tsc --noEmit --project ezzy-vendor-mobile/tsconfig.json` — exit 0; confirms `initialRouteName` is accepted on `Stack`.
- ✅ `npm --prefix ezzy-vendor-mobile run lint` — no findings.
- ✅ `npm --prefix ezzy-vendor-mobile test` — 40/40 pass. A no-regression check only; none of these tests cover this path (see DEFERRED for why one was not added).
- ✅ `npx expo export --platform android` — bundles (7.1 MB Hermes), so the route tree still builds. Output deleted afterwards.

None of the above exercises a guard transition. **The fix is not verified until
the device checks below are run.**

**Needs a live environment (device or emulator, `preview` build or dev client) — ⬜ ALL OUTSTANDING:**
- Sign in with a seeded vendor account → dashboard, no reset-password screen. *(the reported bug)*
- Sign out from Settings → sign-in screen, not the reset error.
- Switch vendor from Settings, on an account with more than one active vendor → vendor picker. Requires a multi-vendor seeded account; if none exists, say so rather than marking this verified.
- Sign in as a `pending_activation` / suspended vendor → `blocked`, not the reset error.
- **Regression check on the real reset flow:** request a reset from Forgot password, open the emailed link on the same device → the reset form, not the "missing its code" error. This one depends on the mobile redirect URL being allow-listed in `backbone/supabase/config.toml` (vendor-mobile B8, still open), so it may not be testable yet — record which, do not assume.
