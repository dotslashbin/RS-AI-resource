# Kiosk "Done — next customer" does not start a new booking

**Date:** 2026-09-14
**App / scope:** `vendor/` — kiosk (`components/kiosk/KioskShell/`), plus `public/sw.js` (D1: in scope)
**Branch:** `vendor` `feature/kiosk_navigation_fixes` (clean at plan time)
**Status:** IN PROGRESS — Stages 1–3 (B1, I1, I2, I3, F1 recorded) ✅ done 2026-09-14. Only the staging live check (Verification 8) remains, after the user deploys

> A QA report says that after a paid kiosk booking, **Done — next customer** returns to Welcome,
> but **Book something** shows the previous customer's "You're booked" screen again instead of
> a new flow. This plan checks whether the earlier fix (kiosk plan 2026-08-26 **B39**) is still
> in place, finds out why it fails anyway, and fixes it. The goal: every exit from a confirmation
> leaves a kiosk the next customer can use, on the **production** build the tablets actually run.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision. Numbers are plan-local;
> "kiosk B39" means `.plans/2026-08-26-vendor-kiosk-mode-and-offering-attachments.md` B39.

**Out of scope:** `booker` (its `public/sw.js` has the identical fetch handler, see F1),
`ezzy-vendor-mobile` (no URL, so nothing to clear), any schema change, and the PayMongo return
contract (`?payment=success&booking_id=`), which stays as it is.

---

## Findings (investigation 2026-09-14)

### Is the B39 fix still in place? **Yes, unchanged. It never worked on a production build.**

- `git log -L` on `useKioskShell.ts:183-199`: `clearPaymentReturn()` and both call sites
  (`resetNow`, the idle timer) are exactly as commit `376dc3a` (2026-09-07) left them. No later
  commit touched them. K2's visibility reset (`:237`) also goes through `resetNow`.
- `KioskBooking.tsx:44-54` still derives `paid` from `useSearchParams()`. Next is `16.2.4` both
  then and now (`package-lock.json` at `376dc3a` and at `HEAD`).
- **So this is not a code regression.** B39 was probably only verified against `next dev`
  (see I2). The fix it relies on is a no-op in production.

### Reproduction: the real `/kiosk` page, driven by Playwright

A throwaway script (session scratchpad, not committed) ran the real page. It faked the Supabase
session (an `sb-127-auth-token` cookie, and `/auth/v1/user`, `profiles`, `user_portals` and
`vendor_members` intercepted so `verifyVendorAdminFor` passes). It set
`localStorage["ezzy.kioskMode"]` and opened `/kiosk?payment=success&booking_id=REFn`. Then it
clicked **Done — next customer**, waited a set time, clicked **Book something**, and checked
the screen right away and again after ~3 s. No app file was changed, except a temporary
`public/sw.js` swap that was restored afterwards (`git status` clean).

| Build | Service worker | Result |
|---|---|---|
| **`next build` + `next start`** (what staging runs) | none | **Round 1 fails.** No request is sent, the URL keeps `?payment=success&booking_id=REF1` and "You're booked" stays on screen. **This is the QA report.** |
| production | `/sw.js` (as on a tablet launched from the portal) | Same, all 3 rounds |
| `next dev` | none | 3/3 pass. A tap before the round trip ends replays the confirmation until it returns (I1) |
| `next dev` | `/sw.js` as shipped | Round 1 passes, **rounds 2–3 stay stuck**: the `/kiosk?_rsc=…` responses come from the SW cache and the navigation never commits (I3) |
| `next dev` | candidate SW (cache-first for `/_next/static/` only) | 3/3 pass, `fromServiceWorker=false` |

Direct probe on the production build, calling from `/kiosk?payment=success&booking_id=REF1`:

| Call | URL afterwards | Screen |
|---|---|---|
| `router.replace("/kiosk")` (today's `clearPaymentReturn`) | **unchanged**, no network request | "You're booked" |
| `router.replace("/kiosk?x=1")` | `?x=1` (RSC fetched) | flow |
| `window.history.replaceState(null, "", "/kiosk")` | **bare `/kiosk`** | flow |

`/kiosk` builds as a static route (`○ /kiosk` in the build output). Replacing to the same
pathname with the query dropped is silently skipped by the production router. Why Next does
this internally was not traced; the behaviour is proven, and the fix below avoids the router.

---

## BLOCKERS

### B1 — `clearPaymentReturn()` is a no-op on production builds  ✅ DONE (2026-09-14, machine-verified; staging live check pending)
**File:** `vendor/components/kiosk/KioskShell/useKioskShell.ts:183-185` (called from `:188`,
`:197` and, via `resetNow`, `:237`)

`router.replace("/kiosk")` from `/kiosk?payment=success&booking_id=…` does nothing on a
production build (see the probe above). `resetNow` still sets `view: "home"` and bumps
`resetKey`, so Welcome appears. But the spent query survives. The next **Book something** mounts
`KioskBooking`, `useSearchParams()` still says `payment=success`, and the old confirmation
renders. That is kiosk B39's bug #3, back. The idle reset and K2's 10-minute reset fail the same
way.

**Fix approach:** clear the query with the native History API, which Next documents as
integrated with `useSearchParams`
(`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` §
"Native History API"):

```ts
const clearPaymentReturn = useCallback(() => {
  if (window.location.search) window.history.replaceState(null, "", "/kiosk")
}, [])
```

- **Existing pattern, not a new one.** `useAppShell.ts:548` and `:596` already clear vendor URL
  params with `window.history.replaceState`, and `architecture/booking-flow.md:298` documents
  booker's payment return doing the same.
- `router` stays in the hook: `router.replace("/")` at `:120` and `:261` leaves for a different
  route and still works.
- Rewrite the B39 comment at `:174-181` so it records **why** this is not `router.replace`: a
  silent no-op in production on this static route, proven 2026-09-14. That way nobody
  "tidies" it back.
- Still only called from event and timer callbacks, never during render (B27 still holds).
- **Component separation:** hook-only change. `KioskShell.tsx` and `KioskBooking.tsx` stay pure
  render layers, and no styles are touched. **UX:** no visual or copy change. The screens are
  the ones kiosk B39 designed; they now appear when they should.
- **Not changed:** `useKioskCheckout.ts:82` (H1c free path,
  `router.replace("/kiosk?payment=success&booking_id=…")`). A replace to a *different* query did
  work in the production probe, and it needs the soft navigation to keep the customer's email in
  memory. Verified rather than edited (see Verification).

**Coupled with I1** (same change) and **I2** (docs).

<!-- ✅ DONE (2026-09-14, Stage 1) — `useKioskShell.ts`: `clearPaymentReturn` now calls
`window.history.replaceState(null, "", "/kiosk")` (deps `[]`); the B39 comment block rewritten
to record why it must not go back to `router.replace`. No other file changed; `router` kept for
`:120`/`:261`. Verified (machine): `tsc --noEmit` 0; `npm test` 452/452; `npm run lint` 35
problems = baseline, 0 in kiosk files, and the changed file lints clean on its own; `next build`
ok (`○ /kiosk` still static). Harness (scratchpad `verify.cjs` / `probe3.cjs`, mocked auth,
real page), each Done→Book something scenario = 3 consecutive customers, pass = "You're booked"
never visible in a 1.5 s poll after the tap AND URL bare AND flow shown after settle:
  • production build, no SW: 0 ms 3/3, 400 ms 3/3, wait-for-URL 3/3 (URL already bare at a 33–49 ms tap)
  • production build, /sw.js controlling: 0 ms 3/3, 400 ms 3/3
  • production build, reload right after Done → Welcome, bare URL (V4) PASS
  • production build, H1c free path: router.replace to the return URL shows the confirmation;
    Done → Book something → flow; a second free return (FREE2) shows again (V6) PASS
  • next dev, 0 ms: no SW 3/3, with /sw.js 3/3 — the dev+SW stuck case is also gone, because the
    reset no longer makes an RSC request
Before the change the same production scenarios failed on round 1 (see Findings).
Not machine-covered: the 90 s idle timeout and K2 10-minute reset (same function, code reading
only); a real PayMongo return and a real tablet → Verification 8 on staging. Servers on
3100/3101 started and stopped by PID. -->



---

## IMPORTANT

### I1 — A fast tap after Done can replay the confirmation  ✅ DONE (2026-09-14, with B1 — 0 ms gap 3/3 on production, with and without SW; see B1's note)
**File:** same as B1

Even where `router.replace` works (`next dev`), clearing the URL waits for a server round trip.
Every `proxy.ts` request also calls `supabase.auth.getUser()`, which adds hundreds of ms on
staging. If **Book something** is tapped before that commits, `KioskBooking` mounts with the old
params and shows "You're booked" until the response lands. Reproduced: a tap at 61 ms, and at
355 ms with a 1.5 s RSC delay, showed the confirmation. It then corrected itself.

**Fix approach:** none of its own. B1's `history.replaceState` makes no request, so the router
state updates before any later tap. It still must be **verified** with a 0 ms gap on the
production build, because the router's sync for native `replaceState` runs in a transition.

### I2 — B39's record, the architecture rule, and why verification missed it  ✅ DONE (2026-09-14)

<!-- ✅ DONE (2026-09-14, Stage 2) — docs only. `.plans/2026-08-26-vendor-kiosk-mode-and-offering-attachments.md`:
a dated "Half 2 reopened and replaced" note directly under the B39 heading; the original record is
kept unchanged below it. `architecture/booking-flow.md` "The payment return at the kiosk": the
params-clearing rule now covers the away-too-long reset as well and names `history.replaceState`; a
new callout explains the production no-op, and a verification rule says kiosk navigation must be
checked on `next build && next start`, because the Playwright webServer runs dev. Verified (grep):
booker `useAppShell.ts:135,149` and vendor `useAppShell.ts:548,596` do use `replaceState`, as the
callout says; no other `architecture/` doc mentions `router.replace` or `clearPaymentReturn` for the
kiosk, so nothing else went stale. No code changed. -->

**Files:** `.plans/2026-08-26-vendor-kiosk-mode-and-offering-attachments.md` (B39, "Fix approach"
says `router.replace`), `architecture/booking-flow.md:725`

- Add a dated note under kiosk B39 (keep the record, don't rewrite it). The `router.replace`
  half was a no-op on production builds and has been replaced by this plan's B1.
- `booking-flow.md:725`: the rule "params must be cleared on every exit" stays. Add that the
  clearing must be `history.replaceState`, because `router.replace` to the same static pathname
  is skipped in production.
- **The lesson worth recording:** kiosk flows verified on `next dev` can pass where production
  fails. `/kiosk` is static in a build and rendered on demand in dev, and the router behaves
  differently. Navigation fixes need a `next build && next start` check. Add this to the
  verification notes in the same `booking-flow.md` section.

### I3 — The service worker caches RSC payloads and API GETs, contrary to its own comment  ✅ DONE (2026-09-14, machine-verified; tablet upgrade pending the staging check)

<!-- ✅ DONE (2026-09-14, Stage 3) — `vendor/public/sw.js`: `OFFLINE_CACHE` "offline-v1" → "offline-v2";
the cache-first branch now starts with `if (!url.pathname.startsWith("/_next/static/")) return`, and a
comment says why. The navigation and cross-origin branches and the activate handler are unchanged. Docs:
`architecture/portals.md` vendor PWA paragraph (what is and isn't cached, the v1 history) and booker
paragraph (a warning that booker's copy still caches everything); F1 recorded as a TODO in
`.plans/2026-07-18-booker-vendor-pwa-readiness.md` Notes. `architecture/overview.md:246` ("offline-fallback
only — no data caching") is now true for vendor, so it was left alone.
Verified (machine): `node --check public/sw.js` ok; `npm run lint` 35 = baseline, none in sw.js. Production
build (`next start -p 3101`, Stage 1 build — `public/` is read at runtime), harness:
  • new SW controlling, 3 customers at 0 ms: 3/3 PASS; after each round the caches are exactly
    ["offline-v2"] and the only non-`/_next/static/` entry is `/offline.html`
  • offline: SW registered, context set offline, navigation to `/` → "You're offline" page PASS
  • UPGRADE from v1: old sw.js put back temporarily, registered, then filled with bad entries → `offline-v1` held
    `/kiosk?x=1&_rsc=1kwj2` and `/api/divisions` (17 entries). New sw.js swapped in, `registration.update()`,
    reload → `offline-v1` gone; `offline-v2` has 15 entries (14 static chunks + `/offline.html`), no RSC or
    API entries. PASS. The new sw.js was restored afterwards and its md5 matches the pre-test copy (7b4de2b7…).
Not machine-covered: the update reaching a real installed PWA on the tablet (browser SW update timing) →
Verification 8. -->

**File:** `vendor/public/sw.js` (the cache-first branch after `request.mode === "navigate"`)

The comment says "Cache-first for same-origin static assets (JS/CSS/images/fonts) only". The
code caches **every** same-origin non-navigation GET, forever:

- **Next RSC payloads** (`/kiosk?_rsc=…`). Proven in dev: from the second customer on, the cached
  payload is served and the navigation never commits (table above). After B1 the kiosk reset
  makes no request, so this is **no longer on the reported path**. It stays a latent trap for
  any soft navigation whose URL repeats.
- **API GETs**: `GET /api/account-deletion?vendorId=…` (`services/accountDeletion.service.ts:73`
  asks for `cache: "no-store"` because "a cached 'you may close' is the one answer that must
  never be served", and the SW ignores that) and `GET /api/divisions`. The POST re-checks
  eligibility server-side, so this is stale UI, not a wrong write. That is why it is IMPORTANT,
  not BLOCKER.
- It diverges from `architecture/overview.md:246` ("offline-fallback page only — no app-shell or
  data caching") and `architecture/portals.md:396` ("bookings/KYC data is never shown stale").

**Fix approach:** limit cache-first to fingerprinted build assets and let
everything else fall through to the network:

```js
// Cache-first ONLY for fingerprinted build output. RSC payloads (`?_rsc=`) and /api GETs
// must never be served from here — see plan 2026-09-14 I3.
if (!url.pathname.startsWith("/_next/static/")) return
```

…and bump `OFFLINE_CACHE` to `"offline-v2"`, so the existing `activate` handler removes the
RSC/API entries tablets have already built up.

**Blast radius:**
- **Offline:** navigations still fall back to `offline.html` (precached, and it references no
  assets, checked). Chunks under `/_next/static/` stay cached. Public images (`/brand/…`,
  `/_next/image`) are no longer cached. They were never needed offline, because the offline page
  is self-contained.
- **Install:** a `fetch` handler is still registered, so the PWA stays installable.
- **Rollout:** a byte-changed `sw.js` installs on the next navigation, and `skipWaiting` +
  `clients.claim` activate it at once. A tablet that stays on `/kiosk` without a reload picks it
  up on its next full load (the PayMongo return is one).
- **Reversible:** revert the file. Caches rebuild on their own.
- **Not in this plan:** booker's identical handler (F1, cross-app).

---

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains. -->
- **D1: fix the service worker (I3) here, or park it?** → **Include it in this plan as Stage 3,
  vendor only** (resolved 2026-09-14). It is small, already tested in the harness, fixes stale
  data that account deletion explicitly depends on not having, and brings the code back in line
  with the architecture docs. Booker's copy stays F1.
- **D2: how the fix is regression-checked** → **Throwaway harness against a local production
  build, plus a staging live check** (resolved 2026-09-14). A committed spec would need a second
  production-build Playwright config and mocked auth in the repo. The existing dev-server config
  cannot reproduce B1.

_No open decisions._

## DEFERRED / FOLLOW-UP
- **F1 — booker `public/sw.js` has the same cache-everything handler.** ✅ Recorded 2026-09-14 as a
  TODO in `.plans/2026-07-18-booker-vendor-pwa-readiness.md` Notes (booker code not touched, since it's a different app). It only matters if booker makes same-origin GETs or soft
  navigations whose URLs repeat.

## Execution order
1. **Stage 1: B1 + I1** (one change in `useKioskShell.ts`). Type-check, lint, unit tests, then the
   production-build harness (Verification 1–6).
2. **Stage 2: I2** (docs: kiosk B39 note, `booking-flow.md`).
3. **Stage 3: I3** (`public/sw.js`, plus correcting `architecture/portals.md:396` only if its
   wording no longer matches). Then harness rounds with the SW on the production build
   (Verification 7). Record F1 in booker's follow-ups.
4. **Live:** staging check (Verification 8), after the user deploys.

## Verification
Machine (run by the executing session):
1. `npx tsc --noEmit` = 0 errors. `npm run lint` shows no new findings (baseline: 35, same files).
   Unit tests pass.
2. **Production build** (`next build`, `next start -p 3101`), harness: Done, then **Book
   something** after gaps of **0 ms**, 400 ms and "after URL clears", **3 consecutive customers**
   each. Pass = URL bare `/kiosk` and "Choose what to book" visible, and "You're booked" never
   visible after the tap.
3. Same as 2 with `/sw.js` registered and controlling the page.
4. After Done, reload the page. Pass = Welcome, not a replayed confirmation.
5. `next dev` harness: 3 customers, 0 ms gap. Must not regress.
6. H1c free path unaffected: from a bare `/kiosk`, `router.replace("/kiosk?payment=success&booking_id=X")`
   renders the confirmation on the production build, and Done then clears it (probe).
   *Not machine-covered:* the idle-timer and K2 reset paths. They call the same
   `clearPaymentReturn`, confirmed by code reading. Optionally, wait once for the 90 s idle
   timeout in the harness.
7. Production build + new SW, 3 customers: no `/kiosk?_rsc=` or `/api/` entries in
   `offline-v2`, and `offline.html` still served for a navigation with the network off.

Needs a live environment:
8. **Staging, on the kiosk tablet:** two real paid bookings in a row (and one free one if a free
   offering exists). Each time, Done, then **Book something** starts at "Choose what to book".
   Also leave one confirmation to time out, then **Book something**.

<!-- Investigation side effects, for the record: a production `next build` was written to
vendor/.next (gitignored; dev output lives separately under .next/dev). Servers on 3100/3101
were started and stopped by PID. public/sw.js was swapped twice for a test and restored
byte-for-byte (git status clean). -->
