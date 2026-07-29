# ezzy-vendor-mobile — preview build crashes silently on launch

**Date:** 2026-07-28
**App / scope:** `ezzy-vendor-mobile` (+ EAS project config). No `backbone` or web-app changes.
**Status:** IN PROGRESS — B1 and I1 executed 2026-07-28; awaiting rebuild to confirm on device

> A release APK from EAS build `b4aa4602` installs, shows the splash, and dies after a
> couple of seconds with no on-screen error. Root cause is identified with high confidence
> and is a configuration gap, not app code. Theme to optimize: **make the failure visible**,
> so this class of bug never again costs a build cycle to find.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local — qualify
> cross-plan refs by app (e.g. "vendor-mobile-companion B2").

---

## Findings

### What the crash is

`src/lib/constants.ts:9-16` throws during **module evaluation** when either Supabase env
var is absent:

```ts
const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. …")
}
```

`constants.ts` is imported by `lib/supabase/client.ts`, which is imported by every provider
in `app/_layout.tsx`. The throw therefore happens before React renders anything.

**In a development build** that surfaces as a red-box error screen with the message. **In a
release build there is no red box** — an uncaught JS exception during startup terminates the
process. The native splash shows while the bundle loads, then the app disappears. That is
precisely the reported symptom: *"crashes after a few seconds without any errors."*

### Why the env var was missing

EAS environment variables, read live from the project:

| Environment | `EXPO_PUBLIC_SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `EXPO_PUBLIC_APP_NAME` |
|---|---|---|---|
| development | ✅ | ✅ | — (falls back) |
| **preview** | ✅ | ❌ **absent** | ✅ |
| production | ❌ | ❌ | ❌ |

The two `preview` variables were created at **20:45:02** and **20:45:13**; the build started
at **20:46:40**. The third `env:create` — the anon key — never landed. So the bundle was
compiled with `EXPO_PUBLIC_SUPABASE_ANON_KEY` inlined as `undefined`.

`.env` is gitignored and is therefore **not** uploaded to EAS, which is why the local value
did not cover for it. That is working as intended, not a second bug.

### A second, latent problem found while investigating

`eas.json` build profiles did **not** declare an `environment`. Expo's documentation does
not state which environment EAS falls back to when the field is omitted, so it is genuinely
ambiguous whether build `b4aa4602` read the `preview` set or the (entirely empty)
`production` set. Either way the app crashes and the fix is the same, but the ambiguity is
worth removing rather than reasoning about. **Already applied** — see B2.

### What does *not* need disabling

You asked what might need switching off to get it started. Nothing. No feature, provider or
native module needs disabling — the app never reaches its own code. Push, Realtime,
SecureStore and the query persister are all uninvolved in this crash.

---

## BLOCKERS

### B1 — `EXPO_PUBLIC_SUPABASE_ANON_KEY` missing from the EAS `preview` environment ✅ DONE (2026-07-28)
**File:** `src/lib/constants.ts:9` (the throw); EAS project config (the cause)

The release bundle has no anon key, so `constants.ts` throws before the first render and the
process dies with no diagnostic.

**Fix approach:** create the variable in every environment a build profile can resolve to,
so the outcome does not depend on the undocumented default:

```bash
cd ezzy-vendor-mobile
npx eas-cli@latest env:create --environment preview \
  --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<publishable key>" --visibility plaintext
npx eas-cli@latest env:create --environment production \
  --name EXPO_PUBLIC_SUPABASE_URL --value "https://fbxbwnfeimzhgxpshdpa.supabase.co"
npx eas-cli@latest env:create --environment production \
  --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<publishable key>"
npx eas-cli@latest env:create --environment production \
  --name EXPO_PUBLIC_APP_NAME --value "Ezzy Vendor"
```

Then confirm all three appear under **both** `preview` and `production` before rebuilding.

**Note on the key:** the value already in use is a `sb_publishable_…` key. That is Supabase's
current publishable-key format and is the correct, client-safe key — it is not a secret and
belongs in a public build. The service-role key must never appear here.

**Executed 2026-07-28.** `env:create` is deprecated; used `eas env:set` instead. Set the anon
key on `preview` + `production`, and the URL and app name on `production`.
**Verified** by `eas env:list` against all three environments — each now reports all three
`EXPO_PUBLIC_*` variables. The key value was copied between EAS environments and never
written into a workspace file.

### B2 — Build profiles did not pin an environment ✅ DONE (2026-07-28)
**File:** `ezzy-vendor-mobile/eas.json`

Added `"environment": "development" | "preview" | "production"` to the three build profiles
so variable resolution is explicit rather than relying on undocumented default behaviour.

**Verified:** file edit only — takes effect on the next build. **Must be included in the
next build** (see B3).

### B3 — Uncommitted working tree ⬜ TODO
**File:** `ezzy-vendor-mobile/` — last commit is `08fa8ab initial commit`; the entire app
source is untracked or modified.

EAS CLI includes uncommitted changes in the upload, so the previous build did contain the
app code. But this is fragile: the `eas.json` fix in B2 only reaches the builder if the
upload picks it up, and a plan that depends on "EAS happens to include untracked files" is
not a plan. There is also no recoverable checkpoint for ~60 new files.

**Fix approach:** commit the working tree in `ezzy-vendor-mobile/` before rebuilding. Per
root `AGENTS.md`, that commit is made **inside** the app folder — this root repo does not
hold its history.

---

## IMPORTANT

### I1 — A missing config value kills the app with no diagnostic ✅ DONE (2026-07-28)
**File:** `src/lib/constants.ts:9-16`

The throw was written to "fail loudly at startup rather than at the first query." In a
development build it does. In a **release** build it fails *silently* — the worst possible
outcome, and the direct reason this cost a full build cycle to identify. The comment's
stated intent and the shipped behaviour disagree.

**Fix approach:** stop throwing. Export the missing-variable list, and have `app/_layout.tsx`
render a plain configuration-error screen when it is non-empty, before any provider mounts.

- `src/lib/constants.ts` — replace the `throw` with
  `export const MISSING_CONFIG: string[]`, and export `SUPABASE_URL` / `SUPABASE_ANON_KEY`
  with inert placeholders when absent so `createClient` itself cannot throw.
- `src/components/common/ConfigErrorScreen.tsx` — pure display component: no state, no
  effects, no handlers. Under `component-separation` that is the documented exception to
  the companion-hook rule, so **no `useConfigErrorScreen.ts`**.
- `src/components/common/ConfigErrorScreen.styles.ts` — `StyleSheet.create({…})`, per the RN
  variant of the style-separation rule. It renders before `AppThemeProvider`, so it uses
  literal colours rather than a `makeStyles(tokens)` factory — a deliberate, stated
  exception, because a theme-aware error screen would depend on the provider stack that this
  screen exists to render *instead of*.
- `src/app/_layout.tsx` — early return on `MISSING_CONFIG.length > 0`, above the provider
  tree.

**Blast radius:** small and contained. No behaviour change when configuration is complete —
`MISSING_CONFIG` is empty and the early return never fires.

**Executed 2026-07-28**, with one improvement on the planned design. The plan said the screen
would render *above* `AppThemeProvider` with literal colours. On reading the provider, it
imports only AsyncStorage, React and `useColorScheme` — nothing configuration-bound — so the
screen is rendered **inside** it instead and uses the normal `makeStyles(tokens)` factory like
every other component. That removes the "deliberate exception" the plan had reserved: there is
now no literal-colour special case, and the error screen honours light/dark like the rest of
the app. It still sits above `PersistQueryClientProvider` and `SessionGateProvider`, so no
request is ever issued with placeholder credentials.

Second deviation: the screen needed `useConfigErrorScreen.ts` after all. The root layout holds
the native splash until the session restores, which never happens on this path, so the splash
must be dismissed explicitly or the error screen renders invisibly behind it. That is an
effect, so under `component-separation` it belongs in a companion hook — the pure-display
exemption the plan assumed does not apply.

**Files:** `src/lib/constants.ts`, `src/app/_layout.tsx`,
`src/components/common/ConfigErrorScreen/{ConfigErrorScreen.tsx,ConfigErrorScreen.styles.ts,useConfigErrorScreen.ts}`.

**Verified (machine):** `tsc --noEmit` clean; `expo lint` clean; `npm test` 40/40 pass;
`expo export --platform android` bundles successfully (7.1 MB Hermes bytecode), proving the
new imports resolve. `constants.ts` executed under Node in three states — both vars unset,
key-only unset, both set — returning the correct `MISSING_CONFIG` and **throwing in none**.
`createClient("https://missing.invalid", "missing")` confirmed constructible, which was the
load-bearing assumption behind the placeholders.

**Not verified:** the screen has never been rendered on a device. Its layout, and the splash
dismissal in particular, are unproven until a build runs with a variable removed.

### I2 — Push code executes in a release build for the first time ⬜ TODO
**File:** `src/services/push.service.ts:74-76`, `src/hooks/usePushRegistration.ts`

`canReceivePush()` is `Device.isDevice && !isExpoGo() && hasNotificationsModule()`. In Expo
Go and in the crashed builds this was always `false`. In a working preview build on a real
phone it becomes **`true`**, so registration, both listeners and `getExpoPushTokenAsync` run
for the first time ever — against a project with **no FCM v1 credentials configured**.

`getExpoPushToken()` wraps the call in try/catch and returns `null`, and `registerPushToken`
failure is surfaced as `state = "unavailable"`, so this is *expected* to degrade gracefully.
It has never been executed, so "expected" is a hypothesis.

**Fix approach:** do not pre-emptively change anything. Watch logcat on the first successful
launch. If it throws outside the guarded paths, gate registration behind a check for
configured FCM credentials. Treat as verification, not as a code change.

### I3 — Hosted Supabase project state is unverified ✅ DONE (2026-07-28) — but see the new risk below
**File:** n/a — `https://fbxbwnfeimzhgxpshdpa.supabase.co`

Fixing B1 gets the app to the sign-in screen. Signing in additionally requires, on the
hosted project: the `backbone/supabase/migrations/` set applied (including
`20260728000001_device_push_tokens.sql`), Realtime enabled for the tables
`useBookingsRealtime` / `useNotificationsRealtime` subscribe to, and at least one vendor
user that exists *there* — `maria@bookdeck.com` is local seed data and will not be present.

**Verified 2026-07-28** by probing the hosted REST and auth endpoints directly:

- **Schema is applied**, including `20260728000001_device_push_tokens`. Every expected table
  returns `401 / 42501` to an anonymous request — table exists, `anon` holds no SELECT grant,
  which is the grant convention behaving correctly.
- **The seed has already been run.** `maria`, `jose` and `root` all authenticate.
- **Data is live:** 41 bookings, 1 `pending`, 40 `booking_transactions`. Vendor visibility per
  account matches the seed header.

### I4 — Development seed data is live on an internet-reachable project ⬜ TODO
**File:** `backbone/supabase/seed.sql:1-22`

The file's own header reads *"THIS FILE MUST NEVER RUN IN PRODUCTION."* It has been run on
`fbxbwnfeimzhgxpshdpa`, which is reachable from the public internet. That publishes 15 accounts
with guessable passwords (`DevSeed@pass1`–`15`), including **`root@bookdeck.com` /
`Bookdeck@root1`**, described in the seed as `root` role with access to *all portals*.

Anyone who obtains the project ref — and it ships inside every copy of the mobile binary, by
design — can try those credentials. This is not a code defect; it is a deployment decision that
was probably implicit rather than chosen.

**Fix approach:** decide what this project *is*. If it is a throwaway dev backend, rotate
`root@bookdeck.com` to a strong password and accept the rest. If it will become the project
that serves store review, the vendor demo account needs a deliberate password and the unused
seed accounts should be removed. Either way, do not point a production build at this project
while the seed accounts stand.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. -->

- **D1 — do I1 (visible config-error screen) now, or only B1?** → **(a) B1 + I1 together**
  (resolved 2026-07-28) — one rebuild carries both; the debugging value lands on this build
  rather than the next.
  - **(a) B1 + I1 together — recommended.** One rebuild. The env var is fixed *and* the next
    missing-config mistake shows a readable screen instead of a silent death. ~40 lines
    across four files, no behaviour change on the happy path.
  - **(b) B1 only.** Smallest possible change, gets the app running one build sooner.
    Leaves the silent-crash failure mode in place for the production build, where an
    unset variable is at least as likely.
  - **(c) B1 now, I1 after confirming the app runs.** Costs an extra build cycle (~20 min
    each) but keeps the variables independent — if the app still crashes after B1, no new
    code is in the frame.

  Recommendation: **(a)**. The diagnosis is well-evidenced, I1 cannot itself cause a startup
  crash (it removes one), and the debugging value is realised on this build rather than the
  next.

---

## DEFERRED / COSMETIC

- **iOS** — untouched. Nothing in this plan is verified on iOS, and per the companion plan's
  D10-A that means no item here can be called fully DONE. Acceptable: no Apple Developer
  membership, so no iOS device build is possible (companion plan B9).
- **Development-build workflow** — still needs Metro reachable over USB. Unchanged by this
  plan; the preview build is the workaround, not a replacement for the dev loop.

---

## Execution order

1. ~~Prove the diagnosis with logcat~~ — **skipped**, not run. The EAS variable listing plus
   the module-scope throw was judged sufficient evidence to act on. Still worth capturing if
   the rebuilt app misbehaves, since it would distinguish a second fault from this one.
2. ✅ **B1** — EAS variables created and verified across all three environments.
3. ✅ **I1** — implemented and machine-verified.
4. ⬜ **B3** — commit the working tree inside `ezzy-vendor-mobile/`. **Not done — needs the
   user's go-ahead**, per the standing rule that commits happen only on request.
5. ⬜ Rebuild `preview`, install, launch.
6. ⬜ **I2** — watch logcat through sign-in for `expo-notifications` errors.
7. ⬜ **I3** — only once the app reaches the sign-in screen.

Steps 2–4 are independent of each other; step 5 depends on 2 and 3, and should follow 4 so the
build has a checkpoint behind it.

---

## Verification

| Item | Check | Kind |
|---|---|---|
| Diagnosis | `adb logcat -c` then launch, `adb logcat *:E ReactNative:V ReactNativeJS:V` — expect the literal string `Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY` | **needs device** |
| B1 | `eas env:list --environment preview` and `--environment production` both show all three variables | machine-verifiable |
| B2 | `eas.json` diff | machine-verifiable |
| B3 | `git -C ezzy-vendor-mobile status --short` is clean | machine-verifiable |
| I1 | `npm run lint`, `tsc --noEmit`, `npm test` (40 tests) all pass | machine-verifiable |
| I1 behaviour | temporarily unset a variable locally → error screen renders instead of a crash | **needs device/emulator** |
| Startup fix | app reaches the sign-in screen and stays there | **needs device** |
| I2 | logcat shows no unhandled `expo-notifications` rejection; push state reports `unsupported`/`unavailable`, not a crash | **needs device** |

**Platform coverage:** Android only. iOS is not verified and cannot be on this hardware —
stated explicitly per the `mobile-dev` skill's "before finishing" rule.
