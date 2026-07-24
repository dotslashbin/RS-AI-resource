# Ezzy Booker Mobile — Expo/React Native build-out plan

**Date:** 2026-07-21
**App / scope:** `./ezzy-booker-mobile` (new project, own git repo). **Phase 1 touches no other app** — it's additive to the new project only. Later phases have one known, flagged coupling to `booker` (see Couplings). Cross-app approval gate applies only if/when that coupling is actioned, not for Phase 1.
**Status:** DRAFT — Ph1 decisions (D1–D4) resolved 2026-07-21. **Gap review 2026-07-22 (skill files updated since original draft) opened D5–D10 — plan is BLOCKED from execution until these are resolved per plan-authoring's hard gate.** No code changes yet.

> **Goal:** a full-parity mobile counterpart to Bookdeck Booker, phased, starting with login/authentication. Same Supabase backbone as booker/vendor/command — the mobile app is a new *client* of the existing backend, not a new backend. Full feature parity with booker is the target; mobile-native adaptations are expected and welcomed where they genuinely fit the platform better (called out explicitly wherever proposed, not silently substituted).

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** Ph# = phase, D# = decision. Numbers are plan-local to this document.

---

## How this fits the existing architecture

Per `AGENTS.md`'s shared-backend model: one Supabase project, no inter-app API, RLS as the only access boundary. The mobile app follows the exact same rule — it talks to Supabase directly via `@supabase/supabase-js`, scoped by the same `booker` portal / `member` role RLS already enforced for the web app (`auth-and-roles.md`). Nothing new needed on the backend for auth.

**One real architectural question, resolved:** two of booker's existing operations require the service-role key (`vendor/app/api/register`-equivalent for booker: `POST /api/register`, and `POST /api/payment/create-session`) — a mobile client can never hold that key (same rule as web: never in client-side code). The mobile app does **not** get its own copy of this server logic. It calls booker's **already-deployed** Next.js API routes over plain HTTPS, exactly as any REST client would — e.g. `https://booker.ezzy.ph/api/register`. This keeps the service-role key in exactly one place (booker's server) regardless of how many clients (web, iOS, Android) exist. Confirmed this requires **zero changes** to `/api/register` for Phase 1 — it's already a public, caller-ungated endpoint (`conventions.md`: "Public self-registration routes are the exception to caller-verification") that doesn't care what platform calls it. The payment route is a different story — see Couplings, not relevant until Phase 3.

**Local-dev implication worth flagging now:** testing the mobile app's registration flow against a *local* Supabase means booker's `/api/register` also needs to be reachable from the phone/simulator — same problem, same fix, as the PWA ngrok work: either run booker's dev server and tunnel it (`ngrok http 3000` + `allowedDevOrigins`, already proven this session), or point the mobile app at booker's hosted deployment instead. Not a blocker, just worth carrying the lesson forward rather than re-discovering it.

---

## Phase roadmap (full picture, Phase 1 detailed below)

Mirrors booker's actual current feature inventory (`portals.md`) rather than inventing a new one — so "full parity" has a concrete, checkable target.

| Phase | Scope | Depends on |
|---|---|---|
| **Ph1** | Login & Authentication — sign in, register, forgot/reset password, session persistence, portal/role gate, logout | — |
| Ph2 | Dashboard — booking history, live status updates (Realtime), Offering Status widget, in-progress draft resume | Ph1 |
| Ph3 | Booking Wizard — all 6 steps incl. payment. Biggest phase; most mobile-native adaptation (native camera/file picker, native map, in-app browser checkout) | Ph1, Ph2 |
| Ph4 | Transactions page | Ph1, Ph2 |
| Ph5 | Notifications — in-app bell/panel equivalent + Realtime, **plus real push notifications** (a capability the web PWA explicitly cannot have — genuine mobile advantage, not just parity) | Ph1 |
| Ph6 | Settings — profile display, theme toggle (logout already lands in Ph1) | Ph1 |
| Ph7 | Polish — offline handling, error boundaries, EAS Build/Submit, OTA updates (`expo-updates`), test strategy | All prior |

This document fully specs **Ph1** only, per the instruction to tackle this phase by phase. Later phases get their own planning pass when we get there — sketched here just enough to keep Ph1's decisions (folder structure, service-layer shape, styling approach) forward-compatible.

---

## Ph1 — Login & Authentication  ⬜ TODO

### Scope
Sign in, self-registration, forgot/reset password (with mobile deep-link handling), session persistence across app restarts, the same portal+role access gate booker enforces, logout. Explicitly **not** in scope: anything past the login gate (a placeholder authenticated screen is enough to prove the gate works; Dashboard is Ph2).

### Dependencies to install

Following current best practice for Expo: anything Expo-adjacent goes through `npx expo install <pkg>` (resolves the SDK-57-compatible version automatically — no manual version guessing, which matters given how new this SDK is). Plain npm packages (not Expo-published) via regular `npm install`.

| Package | Install via | Why |
|---|---|---|
| `@supabase/supabase-js` | `npm install` | The client — same library the web apps use, no RN-specific fork needed |
| `@react-native-async-storage/async-storage` | `npx expo install` | Session persistence storage adapter. **D3, resolved:** the officially recommended option — no practical size limit, unlike `expo-secure-store`'s ~2048-byte iOS Keychain cap, which a full session object (tokens + user metadata) can realistically exceed |
| `react-native-url-polyfill` | `npx expo install` | Hermes (RN's JS engine) lacks a full `URL` implementation that `@supabase/supabase-js`'s realtime-js depends on; required even though Realtime itself isn't used until Ph2/Ph5 — safest to wire it now alongside the client setup |
| `lucide-react-native` | `npm install` | Direct RN port of `lucide-react` — same icon set booker already uses, zero relearning |
| `@tanstack/react-query` | `npm install` | **D2, resolved:** server-state/data-fetching layer — caching, auto-refetch-on-app-foreground, retry/backoff. Used for the `verifyBookerAccess()` portal/role check (a real cacheable Supabase query); the raw session/JWT itself stays a plain listener-driven state (Supabase's `onAuthStateChange`), not a "query" in the TanStack sense — the two aren't the same concern |
| `nativewind` + `tailwindcss` | `npm install` | **D1, resolved:** styling approach — Tailwind-in-RN, holds booker's actual token values as the theme, see the file plan below |

Already present in the base template, confirmed — **no install needed**: `expo-linking` (deep links), `expo-web-browser` (will matter for Ph3's PayMongo checkout, not Ph1), `expo-font` (for loading Inter).

**Explicitly excluded from Ph1 (D4, resolved — deferred):** `expo-local-authentication` (biometric unlock). Not installed now; revisit as a later-phase/backlog item.

### Architecture — file plan

Builds on the base template's existing `src/` structure (`tsconfig.json`'s `@/*` → `./src/*`) rather than restructuring it. Mirrors booker's own conventions (`conventions.md`) file-for-file where the pattern is framework-agnostic, adapts where RN genuinely differs:

```
src/
  lib/
    supabase/
      client.ts        # RN client factory — see "Concrete technical requirements" below
    constants.ts        # APP_NAME/APP_DOMAIN/API_BASE_URL from EXPO_PUBLIC_* env vars
    types.ts             # Booking/DbOffering/etc. — copied+adapted from booker's, not imported (no cross-app/cross-repo sharing, same rule as the three web apps, doubly true across platforms)
  tailwind.config.js     # NativeWind theme — booker's actual --db-* token values (colors), not re-guessed; see D1's branding-consistency detail
  services/
    auth.service.ts      # signIn/registerBooker/signOut/getUser/resetPassword/updatePassword — same shape as booker's, registerBooker's fetch target becomes an absolute API_BASE_URL, not a relative path
    booker.service.ts    # verifyBookerAccess() — ported near-verbatim (pure Supabase queries, no DOM/React dependency)
  hooks/
    useAuth.ts           # owns session state (listener-driven) + the mount-time restore; wraps verifyBookerAccess() as a TanStack Query (D2) for its caching/refetch-on-foreground behavior — the RN equivalent of the auth-relevant slice of useAppShell.ts
  components/
    auth/
      (per-screen hook+component pairs, see below)
  app/                   # expo-router routes (replaces the template's index.tsx/explore.tsx in this phase)
    _layout.tsx          # root layout — mounts the auth provider/gate
    login.tsx
    register.tsx
    forgot-password.tsx
    reset-password.tsx   # the deep-link target — see below
    (authenticated)/
      index.tsx          # placeholder "logged in" screen proving the gate works; becomes Ph2's Dashboard
```

**One deliberate mobile-native adaptation, called out explicitly (not silent):** booker's web `LoginPage` is a single component with an internal `loginView` state switch (`login | forgot | sent | register | reset`). On mobile, each view becomes its own **expo-router route** instead. This isn't just "different for its own sake" — it's the more idiomatic choice for the platform: expo-router routes get native back-gesture/back-button navigation between login/register/forgot for free, where the web version has to not worry about that at all (no back-gesture problem in a browser tab). Matches the file-based routing the base template is already built on.

**Component-separation convention carries over unchanged** (`skills/component-separation.md` is framework-agnostic): every screen with state/effects/handlers gets its own co-located hook; the `.tsx` is pure render. Same rule, same reasoning, on RN as on web.

### Concrete technical requirements (the parts that are genuinely RN-specific, not just "port the web code")

1. **Session storage adapter.** Supabase's client needs an explicit storage adapter on RN (there's no `localStorage`). Official pattern:
   ```ts
   import { createClient } from "@supabase/supabase-js"
   import AsyncStorage from "@react-native-async-storage/async-storage"
   import "react-native-url-polyfill/auto"

   export const supabase = createClient(
     process.env.EXPO_PUBLIC_SUPABASE_URL!,
     process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
     {
       auth: {
         storage: AsyncStorage,
         autoRefreshToken: true,
         persistSession: true,
         detectSessionInUrl: false, // no URL bar on native
       },
     }
   )
   ```
2. **`AppState` wiring for token auto-refresh — easy to miss, breaks silently if skipped.** This is documented in Supabase's own RN guide and has no web equivalent: a browser tab keeps timers running; a backgrounded RN app does not get the same guarantee. Without this, a session can silently fail to refresh after the app sits backgrounded a while:
   ```ts
   import { AppState } from "react-native"
   AppState.addEventListener("change", (state) => {
     if (state === "active") supabase.auth.startAutoRefresh()
     else supabase.auth.stopAutoRefresh()
   })
   ```
3. **Auth flow type: PKCE, not implicit — a deliberate divergence from the web apps, not an inconsistency.** The three web apps chose `flowType: "implicit"` specifically because these are SPAs where a PKCE `code_verifier` can't reliably survive being written then read back across the redirect (no same-origin guarantee issue, but a specific web quirk documented in `auth-and-roles.md`). That constraint doesn't apply to RN — the code_verifier persists fine in `AsyncStorage` across the brief hop to the mail app and back, and PKCE is Supabase's own recommended default for native apps. Set `flowType: "pkce"` in the mobile client config.
4. **Password recovery via deep link, not a URL hash.** There's no URL bar to carry a `#type=recovery` fragment on native. The mechanism:
   - **One-time Supabase dashboard config, not code:** add `ezzybookermobile://reset-password` to Authentication → URL Configuration → Redirect URLs (the same allow-list the three web apps' origins are already in, per `auth-and-roles.md`) — additive, doesn't touch existing web entries.
   - `resetPassword(email, redirectTo)` (existing `auth.service.ts` shape, ported) passes that deep link as `redirectTo`.
   - The recovery email's link opens the app directly via the `ezzybookermobile://` scheme (already set in `app.json`). Because `app/reset-password.tsx` is an expo-router route, the incoming link resolves straight to that screen with no manual `Linking` listener needed — this is the concrete payoff of choosing file-based routes for each auth view (see above).
   - That screen reads the incoming `code`/token params (`useLocalSearchParams()`), exchanges it for a session (`supabase.auth.exchangeCodeForSession(code)` under PKCE), then reuses the same `updatePassword(newPassword)` call booker's web already has.
5. **Portal/role access gate — ported logic, not reinvented.** `booker.service.ts`'s `verifyBookerAccess()` is pure Supabase queries with zero DOM dependency — it ports essentially verbatim. Same three checks (active status, `booker` portal membership, `member` role), same three denial reasons (`no_access` / `suspended` / `pending`), same principle from `conventions.md`: this is a UX layer on top of RLS, not a replacement for it.

### DECISIONS — all resolved 2026-07-21

- **D1 — Styling approach → NativeWind** (resolved). Tailwind-in-RN via a Metro/Babel transform; `tailwind.config.js` holds booker's **actual token values** as theme colors (`#205cfc`/`#6b9cff` primary, `--db-card-bg`/`--db-card-border`/`--db-text` per theme — already precisely converted from OKLCH during the PWA work, not re-guessed), so a color changed in one place can't silently drift from the web app's real palette. Chosen specifically because consistent branding across booker and mobile was raised as an explicit requirement, not just a nice-to-have.

  **Cross-platform branding scope, concretely (not just colors):**
  - **Font:** booker uses `'Inter', system-ui, sans-serif` (`AppShell.tsx:55`) — load Inter via `expo-font` (already in the base template's dependencies, no new install).
  - **Icons:** `lucide-react-native` — same icon set as booker's `lucide-react`, zero relearning, visually identical glyphs.
  - **Theme default:** dark-default with a light/dark toggle, matching booker's `defaultTheme="dark"` — same choice, no reason to diverge.
  - **Navigation shape:** booker's bottom tab bar maps to expo-router's `Tabs` layout — same information architecture, RN-native equivalent, not a literal port.
  - **Calibrated expectation:** there is no polished logo/wordmark anywhere in this project yet — booker's own PWA icons are placeholder letter-glyphs (`"B"` on the brand blue), generated during the PWA work because "no brand artwork exists in either repo" was already true then. "Brand consistency" right now means matching that *current* placeholder-level system (palette/font/icons/shapes) faithfully — not inventing a mature identity that doesn't exist. If real brand assets arrive later, update booker's PWA icons and the mobile app's icon together, not just one.
- **D2 — Server-state / data-fetching → TanStack Query** (resolved). The modern-mobile-practice answer to "how do you handle async server data on a platform that gets backgrounded/foregrounded constantly": built-in caching, automatic refetch-on-app-foreground, retry/backoff, request de-duping — none of which booker's web hand-rolled `useState`+`useEffect` pattern has, because a browser tab doesn't need it the same way. **This is the single biggest "updated mobile development style" change in this plan.** Keeps the hook-as-controller convention for local/UI state — TanStack Query owns server data (e.g. the `verifyBookerAccess()` check), local hooks own UI state; not a replacement for the convention, a correct split of it.
- **D3 — Session storage backend → AsyncStorage** (resolved). Supabase's own official RN pattern, no practical size limits. `expo-secure-store` was the alternative considered and set aside — its ~2048-byte iOS Keychain cap is a real, documented problem a full session object (tokens + user metadata) can realistically exceed, not a hypothetical edge case.
- **D4 — Biometric unlock (Face ID / Touch ID) → deferred** (resolved). Not included in Ph1 — genuinely mobile-native UX with no web equivalent to match, so there's no parity requirement forcing it in now. Revisit as a later-phase or backlog item; `expo-local-authentication` is the package when it's picked up.

### Gap review — 2026-07-22 (added: `developerboss`, `ux-design`, `plan-authoring` skill files landed after this plan's original draft)

- **OPEN: D5 — `component-separation` skill file doesn't exist; plan and AGENTS.md both lean on it.** `AGENTS.md` (twice) and `developerboss/SKILL.md:45` both point to `.claude/skills/component-separation/SKILL.md` as the authoritative render/hook/style convention, and AGENTS.md's plan-review step 4 says explicitly: *"For any new or modified component, this explicitly includes `.claude/skills/component-separation/SKILL.md` — the plan item must state how render/hook/style separation is satisfied, not assume it."* That file does not exist anywhere in the repo — confirmed by search. This plan's own line 96 ("Component-separation convention carries over unchanged") cites `skills/component-separation.md` for a rule that in practice only exists today as a paragraph in `architecture/conventions.md:285`. Ph1 introduces ~7 new components (login/register/forgot-password/reset-password + the auth provider/gate), so this isn't academic — it's the exact case AGENTS.md's rule is aimed at.
  - **Option A (recommended):** treat `conventions.md:285`'s inline rule as authoritative for this plan (it's unambiguous and already what D1's file-plan follows), proceed with Ph1, and separately flag to the user that `.claude/skills/component-separation/SKILL.md` should be authored as its own small task — not blocking on it here since it's a repo-wide gap, not mobile-specific.
  - **Option B:** block Ph1 execution until the skill file exists, since AGENTS.md names it as mandatory reading before creating any new component and doesn't carve out an exception for "the rule is written down elsewhere."
  - Needs your call — recommend A, but AGENTS.md's wording is strict enough that this is a legitimate reading either way.

- **OPEN: D6 — no UX-design pass specified for Ph1's actual screens.** AGENTS.md: *"Before making any visual or interaction change, read and apply `.claude/skills/ux-design/SKILL.md`."* Ph1 builds four real screens (`login.tsx`, `register.tsx`, `forgot-password.tsx`, `reset-password.tsx`) — squarely "visual or interaction change," not incidental UI. The plan currently specs branding tokens (D1) and route/file shape in detail but has no equivalent detail for `ux-design/SKILL.md`'s checklist items:
  - State handling (§4 of that skill): loading/empty/error/populated aren't called out per screen — e.g. what does `login.tsx` show while `signIn()` is in flight, or on a wrong-password error, distinct from a network error?
  - Accessibility (§5): 44×44 touch targets, ≥4.5:1 text contrast — the plan reuses booker's *token values* (D1) but RN rendering (font metrics, default component sizing) doesn't guarantee the same contrast/hit-area outcomes a browser gives those same hex values for free; this needs to be checked on-device, not assumed from token parity.
  - Both-themes check (§6): D1 sets dark-default + toggle, but nothing says each of the 4 screens gets verified in both themes before being called done.
  - **Option A (recommended):** add explicit per-screen UX requirements (loading/error/empty state, touch targets, both-theme check) to the "Architecture — file plan" section now, before execution starts — same treatment the plan already gives branding and component-separation.
  - **Option B:** leave it implicit, verify at build/review time per screen rather than spec'd in the doc.
  - Needs your call.

- **OPEN: D7 — password-recovery gate-skip logic not ported; mobile's route-based structure may or may not need it.** `architecture/auth-and-roles.md:38-40` documents a specific, easy-to-miss web behavior: *"The portal access gate is skipped during recovery... During recovery the gate early-returns so the recovery session survives until `updatePassword(newPassword)` succeeds."* Without this, `verifyBookerAccess()` running against a freshly-exchanged recovery session can sign the user out before they finish setting a new password. The plan's item 4 (password recovery via deep link) and item 5 (portal/role gate "ported... near-verbatim") don't mention this carve-out at all.
  - It's genuinely unclear whether mobile even has the same failure mode: web is one `LoginPage` component with an internal view switch, so the gate wraps the reset view too and needs an explicit early-return. Mobile's `reset-password.tsx` is a **separate expo-router route**, a sibling of `(authenticated)/`, not inside it — so if the root gate in `app/_layout.tsx` only wraps the `(authenticated)` group (as the file plan's tree structure suggests), `/reset-password` may never be gated in the first place, making the web-side workaround moot on mobile.
  - This can't be silently assumed either way — it's a real behavioral property of a security-relevant gate, and the plan currently doesn't state which structure it is.
  - **Option A:** confirm and document that `_layout.tsx`'s gate is scoped to `(authenticated)/*` only, so `/reset-password` is inherently ungated and no `recoveryMode` port is needed — verify this explicitly when `_layout.tsx` is built (step 6/7 of Execution order), not assumed now.
  - **Option B:** port an equivalent `recoveryMode` flag regardless, as defence-in-depth in case the gate is later hoisted higher (e.g. if a future phase adds a root-level redirect-if-unauthenticated check that isn't scoped to the group).
  - Needs your call — recommend confirming the actual gate scope during step 6/7 and documenting the answer in this plan before `reset-password.tsx` is considered done, rather than resolving it purely on paper now.

### Gap review — 2026-07-22, pass 2 (added: `mobile-dev` skill file)

- **OPEN: D8 — supported platforms never declared; no iOS/Android divergence considered anywhere in Ph1.** `mobile-dev/SKILL.md`'s step 2 is "Identify the mobile framework and supported platforms" — the plan names the framework (Expo/React Native) in detail but never states whether Ph1 targets iOS, Android, or both, and nowhere applies the skill's explicit rule "do not assume identical behavior across supported platforms." Two concrete places this bites:
  - **Deep link scheme.** The plan's password-recovery mechanism (item 4, technical requirements) relies on `ezzybookermobile://` as a bare custom URL scheme. Custom schemes behave differently per platform in ways that matter for a mail-app handoff: iOS shows a one-time "Open in Ezzy Booker?" system prompt the first time; Android may show an app-chooser dialog if more than one installed app registers the same scheme, and some Android mail clients (e.g. Gmail) are inconsistent about honouring custom schemes in email bodies at all (Universal Links/App Links are the more reliable mechanism on both, but need a hosted `.well-known` file and platform-specific setup neither the plan nor the base template currently has). The plan treats this as a single cross-platform mechanism with no platform-specific caveat.
  - **Verification section** currently says "Live (simulator/device)" with no split between an iOS simulator run and an Android emulator run — so it's possible to call Ph1 "done" having only ever exercised one platform, silently failing mobile-dev's "before finishing" rule to state which platform-specific validations were not performed.
  - **Options:**
    - **A (recommended):** explicitly scope Ph1 to build and verify **both** iOS and Android before Ph1 is marked done; update the Verification section to require both a simulator (iOS) and emulator (Android) pass, and decide the deep-link mechanism (custom scheme now, accepting the platform quirks above as a known limitation vs. investing in Universal/App Links now) as part of this same decision.
    - **B:** explicitly scope Ph1 to one platform first (state which), track the other as an explicit follow-up item rather than an implicit gap.
  - Needs your call — this also determines whether the deep-link caveat above is accepted as-is or needs its own follow-up.

- **OPEN: D9 — dynamic text scaling and screen-reader labels not addressed (mobile-specific accessibility axis, distinct from D6).** `mobile-dev/SKILL.md`: "Preserve accessibility labels and dynamic text behavior." D6 already covers contrast ratios and 44×44 touch targets (from `ux-design`'s general checklist), but this is a different, RN-specific pair of concerns neither D6 nor the current plan mentions:
  - **Dynamic text:** whether NativeWind's type scale (carrying over booker's fixed web pixel values, per D1) respects the OS-level font-scaling setting (iOS Dynamic Type / Android font scale) or silently overrides it with fixed sizes that ignore a user's accessibility setting — a common RN pitfall when porting fixed web type scales verbatim.
  - **Accessibility labels:** icon-only controls (e.g. password show/hide toggle, back navigation between the auth routes) need explicit `accessibilityLabel`/`accessibilityRole` props for VoiceOver/TalkBack; nothing in the file plan or the four screens' description mentions this.
  - **Option A (recommended):** fold both into the same per-screen UX-requirements addition proposed under D6, since the fix is the same shape (spec it per screen before building) — no need for a separate remediation mechanism.
  - **Option B:** track separately from D6 since these two are mobile-platform-specific rather than general UX, in case they warrant a different owner/timing.
  - Needs your call, but recommend resolving D6 and D9 together as one combined per-screen spec pass.

- **OPEN: D10 — no unit/integration tests for Ph1 itself; plan defers all test strategy to Ph7.** `mobile-dev/SKILL.md`'s "before finishing" section expects "relevant unit and integration tests" as a normal part of finishing implementation work. The plan's Verification section is 100% machine-check (`tsc`, `expo-doctor`) plus manual/live steps — no unit tests are planned until Ph7 ("test strategy" listed there), seven phases out. The ported services this plan itself calls "pure Supabase queries, no DOM/React dependency" (`auth.service.ts`, `booker.service.ts`'s `verifyBookerAccess()`) are exactly the cheap-to-test, logic-only code this matters most for — `verifyBookerAccess()`'s three-check/three-reason branching (`no_access`/`suspended`/`pending`) is a good unit-test candidate and is depended on by every later phase's access gate.
  - **Option A (recommended):** add a small unit-test pass for the ported services in Ph1 itself (e.g. Jest, covering `verifyBookerAccess()`'s branches and `auth.service.ts`'s functions with a mocked Supabase client) — full E2E/device automation still stays deferred to Ph7 as already planned, this only pulls forward the cheap logic-level tests.
  - **Option B:** keep test strategy entirely in Ph7 as currently written, accepting Ph1 ships with zero automated tests and relying only on the manual live-verification checklist until then.
  - Needs your call.

### Couplings (not actioned now — flagged so Ph3 doesn't surprise anyone)

**`booker/app/api/payment/create-session/route.ts` authenticates the caller via SSR cookies** (`@supabase/ssr`'s server client reading the session cookie). A native client sends no cookies — this route will need to also accept `Authorization: Bearer <access_token>` and verify it via `supabase.auth.getUser(token)` as an alternative to the cookie path, before Ph3 (the booking wizard's payment step) can work from mobile. This is a **cross-app change to booker**, so it needs its own approval gate when we get there — noted now per the plan-authoring rule to surface couplings early, not left as a surprise. Zero relevance to Ph1 — `/api/register` needs no such change (already caller-ungated by design).

### Execution order — blocked on D5–D10; sequence below is the build order once they're resolved
1. Install dependencies (table above).
2. `tailwind.config.js` with booker's actual token values (colors) + Inter font loaded via `expo-font` — done **before** any screen is built, so login/register are correctly branded from the first line of UI, not built generic and re-skinned later.
3. `lib/supabase/client.ts` (the 4 technical requirements above) + `lib/constants.ts` + `lib/types.ts`.
4. TanStack Query setup — `QueryClientProvider` in `app/_layout.tsx`.
5. `services/auth.service.ts` + `services/booker.service.ts`.
6. `hooks/useAuth.ts` (session restore on mount; `verifyBookerAccess()` wrapped as a TanStack Query; exposes sign-in/out/register/reset handlers — thin wrapper over the services, no business logic duplicated).
7. Screens: `login.tsx` → `register.tsx` → `forgot-password.tsx` → `reset-password.tsx` (needs the Supabase dashboard redirect-URL addition done first, or the deep link has nowhere valid to land) → placeholder authenticated screen.

**Not in this sequence — D4 (biometric unlock) is deferred out of Ph1 entirely**, not just ordered last.

## Verification
- Machine: `tsc --noEmit`; `expo-doctor` stays green after each dependency addition (don't let it regress from the 20/20 baseline already confirmed).
- Live (simulator/device, cannot be fully machine-verified): sign in, sign out, register a new booker (against local Supabase + tunneled booker dev server, or hosted), forgot-password → email arrives (Mailpit locally / Resend hosted, per `email-notifications-guide.md`) → tapping the link opens the app directly at the reset screen → new password takes effect → portal/role denial states (`no_access`/`suspended`/`pending`) each render correctly → session survives an app kill+relaunch → session survives backgrounding past a token-refresh interval (tests the `AppState` wiring specifically, not just "it worked once").

## Notes
- No code changes made — plan only, per instruction.
- No commits by the agent — user handles commits.
- Types and services are copied-and-adapted from booker, never imported cross-repo — same "no shared code between apps" rule as the three web apps, doubly justified across platforms (`conventions.md`).
