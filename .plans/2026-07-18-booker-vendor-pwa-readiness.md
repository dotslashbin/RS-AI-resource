# Booker + Vendor — PWA readiness audit & plan

**Date:** 2026-07-18
**App / scope:** `./booker` + `./vendor` (cross-app — approval gate per AGENTS.md). Command excluded (desktop admin tool; no PWA case now). The separate Expo/native-mobile track is pinned and unaffected — a PWA here is complementary (and was flagged as the "free interim" in that discussion).
**Status:** IN PROGRESS — all decisions resolved 2026-07-21 (D1–D8; D7 was already out-of-scope by design). **Both apps: P1–P4, P6, P7 done and verified (machine + live where reachable) for booker and vendor.** P5's physical-device half is the only thing left for either app, and none of it can be executed from here — it needs the user's own hardware: real Android/iOS install-and-launch (both apps), vendor's KYC camera-in-installed-iOS-PWA, and booker's PayMongo checkout round-trip (the last one deliberately held pending the user's separate PayMongo redesign research, not just untested). **Nothing further to execute from this plan without physical devices.**

> **Goal:** make booker (primarily) and vendor installable, app-like web apps: home-screen install on Android/iOS, standalone display, sane offline behaviour — without pretending they can work offline (both are auth + live-data apps).

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** P# = plan item, D# = decision; numbers plan-local.

---

## Verdict: **not PWA-ready today — but close, and nothing structural blocks it**

Neither app has *any* PWA scaffolding. What they already have going for them: HTTPS (Vercel), mobile-first UI (booker especially), client-rendered SPA architecture (nothing server-rendered to complicate caching), secure-context APIs already in use (geolocation, camera). The gaps are all additive.

## Audit findings (verified 2026-07-18, per file inspection)

| Prerequisite | booker | vendor | Why it matters |
|---|---|---|---|
| Web App Manifest | ❌ none (`app/manifest.*` / `public/manifest.*` absent) | ❌ none | Without a manifest there is no install prompt, no standalone mode, no app identity. Hard requirement. |
| App icons (192/512, maskable, apple-touch) | ❌ only `app/favicon.ico` + Next starter SVGs in `public/` | ❌ same | Install requires 192px+512px icons; iOS home screen needs `apple-touch-icon`; without maskable variants Android shows a letterboxed icon. |
| `themeColor` / viewport export | ❌ no `viewport` export in `layout.tsx` | ❌ same | Status-bar/browser-chrome colour in standalone mode; without it the installed app looks half-styled. |
| `appleWebApp` metadata | ❌ | ❌ | iOS ignores most of the manifest; needs `apple-mobile-web-app-capable` etc. via Next's `Metadata.appleWebApp` for a decent standalone experience. |
| Service worker | ❌ no SW file, no `next-pwa`/`serwist`/`workbox` dep | ❌ same | **No longer required for installability** (Chrome dropped the offline-check in 2023; iOS never required it) — but without one there is no offline fallback (an installed app that white-screens with no network feels broken) and no future web-push path. |
| Offline behaviour | ❌ white screen offline | ❌ same | See above. |
| HTTPS | ✅ Vercel | ✅ Vercel | Already satisfied. |
| Mobile-first UI | ✅ (tab bar, wizard) | ✅ usable | Already satisfied. |

## App-specific hazards (the reasons this isn't just "add a manifest")

- **booker — PayMongo redirect in standalone mode.** Step 6 does `window.location.href = checkout_url` (out of scope) and PayMongo returns to `NEXT_PUBLIC_APP_URL/?payment=success`. In an installed PWA, out-of-scope navigation opens an in-app browser overlay (Android CCT) or may break out to Safari (iOS); the **return may land in a browser tab instead of the installed app**, losing the success toast/context. Consequence is cosmetic only — the booking row + webhook (`is_paid`) are authoritative and the dashboard reloads on next open — but it must be **live-tested on both platforms** before calling the PWA done. (Same class of issue the Expo track solves with deep links.)
- **booker — password recovery links** open from the email client into the *browser*, never the installed app — the user resets in the browser tab and returns to the PWA to log in. Acceptable; document, don't fix.
- **vendor — KYC camera capture** (`getUserMedia`): works in installed PWAs on Android; on iOS only since 14.3 in standalone, historically quirky. The existing file-upload fallback covers failures, but this needs a live iOS test.
- **vendor/booker — `localStorage` drafts** (wizard draft, KYC form draft) work per-origin in PWAs; note iOS can evict storage for installed web apps under pressure — the drafts are already treated as best-effort, so no change needed.
- **Both — Android back gesture in standalone.** The SPAs use internal-state routing with **no history entries**, so the system back gesture exits the app from anywhere (today the browser back button does the same, but a browser shows chrome; an installed app just vanishes). Not an install blocker — a UX papercut logged as D5.
- **Realtime/Supabase** — websockets and auth are unaffected by a service worker; no risk.

---

## Plan items (per app; vendor first, then booker by copy-by-intent — see D4)

### P1 — Web App Manifest  ✅ DONE for vendor + booker (2026-07-21)
`app/manifest.ts` (Next's native metadata route — no dep). `name`/`short_name` from `NEXT_PUBLIC_APP_NAME` (server-read at build, consistent with the env-driven branding), `start_url: "/"`, `display: "standalone"`, `id`, `background_color`/`theme_color` per D6, icon entries per P2.

> Executed (vendor): `vendor/app/manifest.ts` created. `theme_color: "#205cfc"` — vendor's actual `--primary` token (`oklch(0.546 0.245 264)`), precisely converted via the OKLab→sRGB formula, not eyeballed. `background_color: "#eef2ff"` — the light-mode `--sp-page-bg` gradient's dominant stop (manifest requires a solid colour; gradients aren't valid here), per D6's "light theme colours" call. Verified live: `curl /manifest.webmanifest` returns valid JSON with all fields and the 3 icon entries; `<link rel="manifest">` auto-injected into `<head>` by Next's file-convention (no manual `metadata.manifest` needed — confirmed, not assumed).
>
> Executed (booker): `booker/app/manifest.ts` created. Confirmed booker shares the **identical** `--primary` OKLCH values as vendor (`oklch(0.546 0.245 264)` light / `oklch(0.707 0.165 264)` dark) — reused `#205cfc`/`#6b9cff` without re-deriving. `background_color: "#070b17"` — booker's *dark*-mode `--db-page-bg` gradient's dominant stop, per D6's "booker: dark" call (opposite of vendor's light default, matching each app's own static theme). `name`/`short_name`/`description` use `APP_NAME` bare with no appended suffix — applying the lesson from vendor's P3 naming bug proactively rather than repeating it. Verified live: manifest JSON valid with all 3 icons, `<link rel="manifest">` auto-injected, matching vendor's verification exactly.

### P2 — App icons  ✅ DONE for vendor + booker (2026-07-21) — D2 resolved: neutral placeholder set
192 + 512 PNG, a maskable variant, `apple-touch-icon` (180). Currently no brand artwork exists in either repo (env-driven naming, placeholder brand). See D2.

> Executed (vendor): generated via a one-off script (not committed — output PNGs only) using `sharp` (already present as Next's bundled image-optimization dependency — **no new install**). Simple glyph: white "V" on vendor's exact `--primary` blue (`#205cfc`, same precise conversion as P1). Three files in `vendor/public/icons/`: `icon-192.png`, `icon-512.png` (rounded square, purpose `any`), `icon-maskable-512.png` (full-bleed background, glyph shrunk to sit inside the ~80% safe zone so an OS circle-crop doesn't clip it). Plus `vendor/app/apple-icon.png` (180×180, plain square, no pre-baked rounding — Apple applies its own mask) using Next's `apple-icon.png` file convention. Verified: visually inspected all 4 renders (correct proportions, colour, safe-zone clearance); all 4 return `HTTP 200` from the running dev server; `<link rel="apple-touch-icon">` auto-injected by Next's file convention.
>
> Executed (booker): identical generation script, glyph changed to white "B" on the same `#205cfc` blue (shared token value). Same 4 files in `booker/public/icons/` + `booker/app/apple-icon.png`. Verified: visually inspected all 4 renders (screenshot on record — correct proportions, colour, safe-zone clearance); all 4 return `HTTP 200`; `<link rel="apple-touch-icon">` auto-injected.

### P3 — Layout metadata  ✅ DONE for vendor + booker (2026-07-21)
Per app `layout.tsx`: add `viewport` export with `themeColor` (light/dark pair), extend `metadata` with `manifest`, `appleWebApp: { capable, title, statusBarStyle }`, `icons`.

> Executed (vendor): added `export const viewport: Viewport` with a genuine light/dark `themeColor` pair (`#eef2ff` / `#070b17`, vendor's actual light and dark `--sp-page-bg` tokens — not the same value duplicated, since this tag dynamically follows the OS colour scheme live, independent of D6's static-manifest decision). Extended `metadata` with `appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" }` (light-appropriate; `black-translucent` would need extra design work to avoid contrast issues, not attempted here). Did **not** manually set `metadata.manifest` or `metadata.icons.apple` — confirmed live that Next's file-convention (`manifest.ts`, `apple-icon.png`) auto-injects both `<link>` tags without it; adding them would have been redundant. Verified live: `<meta name="theme-color" ... media="(prefers-color-scheme: light|dark)">` ×2 present with correct values; `<meta name="mobile-web-app-capable" content="yes">` present (Next 16 renders the modern standardized tag, not the legacy `apple-mobile-web-app-capable` — confirmed by checking Next's own compiled output, not assumed); `apple-mobile-web-app-title` and `-status-bar-style` present. `tsc --noEmit` clean.
>
> Executed (booker): same `viewport` shape, using booker's own light/dark `--db-page-bg` tokens (`#eef2ff` / `#070b17` — identical gradient stop *values* to vendor's tokens, confirmed by direct grep, not assumed from similarity). **Self-caught a wrong first pass:** initially set `appleWebApp.statusBarStyle: "black-translucent"`, reasoning booker's `defaultTheme="dark"` meant it was "always dark" — but a quick grep of `SettingsPage.tsx`/`TopBar.tsx` showed booker has a real light/dark toggle (`setTheme`), so `defaultTheme="dark"` is only the *initial* value, not a permanent one. `black-translucent` would risk the same light-mode contrast issue already avoided for vendor. Corrected to `statusBarStyle: "default"` before it shipped. Verified live: same meta-tag battery as vendor, all present and correct. `tsc --noEmit` clean.

**Pre-existing issue found — ✅ FIXED, final direction (2026-07-21):** vendor's local `.env.local` had `NEXT_PUBLIC_APP_NAME=Ezzy Vendor` (already including "Vendor"), while `layout.tsx`'s existing convention appended `" Vendor"` again — so the browser tab title read **"Ezzy Vendor Vendor"**, confirmed via the live `<title>` tag before any fix, unrelated to today's PWA work.
>
> First pass trimmed the env var to `Ezzy` instead. **User reconsidered and asked to go the other way**: keep `NEXT_PUBLIC_APP_NAME=Ezzy Vendor` (reverted `.env.local` back), and instead fix the *code* to stop hardcoding a redundant "Vendor"/"vendor" suffix, using `APP_NAME` as-is wherever the full name is needed. Executed: `vendor/app/layout.tsx` `title` → `APP_NAME` (was `` `${APP_NAME} Vendor}` ``), `description` → `` `${APP_NAME} management portal` `` (was `` `${APP_NAME} vendor management portal}` `` — dropped only the redundant lowercase "vendor", kept the descriptive "management portal"); identical fix applied to `vendor/app/manifest.ts`'s `name`/`description` (written today in P1, same inherited pattern). Grepped the rest of the vendor codebase for any other `APP_NAME` + "Vendor" combination — `LoginPage.tsx` and `InstallPrompt.tsx` already reference `APP_NAME` bare with no appended suffix, nothing else to fix.
>
> **Verification caught a real false-positive, worth recording:** the first live check after this fix appeared to pass (`<title>Ezzy Vendor</title>`), but the responding `next-server` process had started *before* both the `.env.local` revert and the code edit — it was serving the **old** code (`${APP_NAME} Vendor` still hardcoded) against the **old** env value (`Ezzy`, from the earlier revert), and `"Ezzy" + " Vendor"` happened to produce the exact same string as the fix, coincidentally. Caught by checking the serving process's actual start time (`ps -o lstart`) against the file edit timestamps, killed the stale process, and re-verified against a genuinely fresh one (confirmed via its own later start time) — **that** run correctly showed `<title>Ezzy Vendor</title>` and manifest `name`/`short_name` both `"Ezzy Vendor"`, `description: "Ezzy Vendor management portal"` (no duplicated word). Lesson for this session: when verifying an env-var-dependent change, confirm the responding dev-server process actually started *after* the edit, not just that the output looks right.

**Noted, still not touched (out of scope, unchanged from before):** `booker/.env.local` still has `NEXT_PUBLIC_APP_NAME=Ezzy booker ` (trailing space + inconsistent lowercase) and `command/.env.local` still has `NEXT_PUBLIC_APP_NAME=Ezzy Command`. Booker's new P1/P3 code (`manifest.ts`, `layout.tsx`) deliberately uses `APP_NAME` bare with no appended suffix, so it doesn't compound this env value into a new duplication bug — but the underlying `.env.local` naming quirk itself was not part of this session's ask and remains as-is (confirmed still present via live `<title>Ezzy booker — Booking Portal</title>`, not a new duplication, just the existing untrimmed value flowing through cleanly).

### P4 — Service worker + offline fallback  ✅ DONE for vendor + booker (2026-07-21) — D1 resolved: hand-rolled minimal SW
Recommended shape (D1 = hand-rolled): ~30-line SW, network-first for navigations with a cached `offline.html` fallback + cache-first for static assets; registered from a tiny client component. No precache manifest, no build-tool coupling, no dependency. Explicitly **not** caching Supabase data (stale bookings/KYC state is worse than a spinner — see D3).

> Executed (vendor): `vendor/public/sw.js` (~40 lines) + `vendor/public/offline.html` (fully self-contained inline CSS, zero external font/asset requests — it's the only thing precached at install time, so it must render with truly zero network). Registration added as its **own independent `useEffect`** in `useAppShell.ts` (not folded into the existing dense auth-gating effect below it) — so it registers regardless of auth/recovery state, covering the login screen too. Cross-origin requests (Supabase, Realtime, etc.) are explicitly bypassed in the fetch handler — never intercepted, never cached — enforcing D3 in code, not just in intent.
>
> **Verified live, not just read back** (local dev stack + Playwright): SW registers and reaches `state: "activated"`; the page becomes SW-controlled after reload; **going genuinely offline and navigating returns the cached `offline.html` (HTTP 200, "You're offline" content) instead of a browser network-error page**; the app still renders normally online with the SW active, zero console errors; and — the D3 check that actually matters — inspected the real cache contents afterward and confirmed **only same-origin entries exist, zero Supabase/cross-origin URLs ever entered it**. `tsc --noEmit` clean.
>
> Executed (booker): `sw.js` is **entirely app-agnostic** — copied verbatim (`diff` confirmed byte-identical) rather than rewritten, since the fetch-handler logic (same-origin/cross-origin split, network-first navigation, cache-first assets) has no vendor-specific reference in it. `offline.html` re-branded with booker's own dark palette (`#070b17` background, matching its default dark theme) and "B" glyph. Registration added as the same kind of independent `useEffect` in `useAppShell.ts`, placed right after the existing `bookingsRef` sync effect. Verified live — identical battery to vendor: SW activates, page becomes controlled, offline navigation returns the cached fallback (HTTP 200, "You're offline"), app renders normally online with zero console errors, and cache contents inspected afterward confirmed **only `http://localhost:3101` entries — zero Supabase/Realtime/PayMongo URLs ever cached**. `tsc --noEmit` clean.

### P5 — Live platform verification  🔄 IN PROGRESS for vendor + booker (2026-07-21) — split by what's actually checkable
Chrome DevTools installability check; real install on Android + iOS; **booker:** full PayMongo checkout round-trip from the installed app on both platforms (the hazard above); **vendor:** KYC camera capture from an installed iOS PWA. All need live devices — machine checks can't cover these.

> **Done (vendor) — the genuinely machine-verifiable half:** used Chrome's own actual installability engine via CDP (`Page.getInstallabilityErrors` — the same check behind the real browser install prompt, not a re-implementation/guess). First pass under an incognito-style context correctly reported one error, `in-incognito` (Chrome deliberately blocks installs there) — confirmed this was an artifact of the throwaway test context, not the app, by re-running under a persistent Chrome profile: **`installabilityErrors: []` — zero errors.** Also independently confirmed via `Page.getAppManifest` that Chrome parses the manifest with no errors and resolves all 3 icons correctly. Combined with P4's live-verified SW/offline behaviour, everything Chrome itself checks before offering an install prompt is confirmed genuinely satisfied — not inferred from reading the manifest file.
>
> **Done (booker) — same machine-verifiable half:** identical CDP check against a persistent Chrome profile — **`installabilityErrors: []`**, manifest parses with 0 errors, all 3 icons resolved. Combined with P4's live-verified booker SW/offline behaviour, same standard met.
>
> **Deliberately not attempted for booker — the PayMongo round-trip item.** Per this session's discussion: the standalone-mode redirect risk (Step 6 → PayMongo hosted checkout → return, which may not land back inside an installed app) is a real platform behaviour question, but the user is separately researching a better PayMongo implementation. Exercising the *current* flow now would only prove or disprove something that may get redesigned regardless — so this was explicitly held rather than tested. Not a gap in today's execution; a deliberate scope decision, made together with the user.
>
> **Still needs the user's own physical devices — cannot be done from here:** real install-and-launch on an actual Android phone and an actual iPhone (standalone chrome/icon look-and-feel, home-screen behaviour), for both apps; **vendor's specific live-device item:** KYC camera capture (`getUserMedia`) from an *installed* iOS PWA specifically (historically quirky); **booker's specific live-device item (held per above):** the PayMongo checkout round-trip from an installed standalone app on both platforms. No emulator/headless substitute is faithful enough for any of these to count as verified.

### P6 — Docs  ✅ DONE for vendor + booker (2026-07-21)
Update `architecture/overview.md` / `portals.md` current-state notes once shipped.

> Executed (vendor pass): `overview.md` — new PWA row in the Tech Stack Summary table (scoped "vendor portal only" at the time), Current-State table note on the vendor row, and the "Mobile app" scope-limit bullet updated to acknowledge vendor's PWA installability without overstating it as a native app. `portals.md` — new "Progressive Web App" feature subsection under vendor's Current Features (manifest/SW/offline-fallback/install-banner, cross-origin bypass called out explicitly), a row in the "What Is Live vs. Mock" table, a Known Gaps entry naming exactly what's machine-verified vs. what needs physical-device testing, a Roadmap item, and a new row in the Cross-Portal Feature Parity Notes table.
>
> Executed (booker pass, this session): `overview.md`'s PWA row updated from "vendor portal only" to "booker and vendor"; the booker row in the Current-State table and the "Mobile app" scope bullet both updated to include booker. `portals.md` — same treatment as vendor: new "Progressive Web App" feature subsection under booker's Current Features (explicitly naming the PayMongo standalone-redirect risk as booker's specific known gap, distinct from vendor's KYC-camera gap), a Live-vs-Mock row, a Known Gaps entry, and a Roadmap item. Updated vendor's own roadmap item to drop the now-stale "then bring to booker" clause (booker is done in the same session, not a future step anymore). Flipped the Cross-Portal Feature Parity table's Installable-PWA row from "❌ Planned next" to "✅ Live" for booker. All wording matches each doc's existing tone/table conventions.

### P7 — Custom "Install App" affordance  ✅ DONE for vendor + booker (2026-07-21) — D8 resolved: dismissible AppShell banner
Not required for installability — once P1's manifest is live, the browser's own native UI already offers install (Chrome/Edge address-bar icon on desktop, Android's install menu item) with zero extra code. P7 is a discoverability enhancement: an in-app button/banner that surfaces the option more prominently than waiting for a user to notice the browser's own icon.

**Genuinely platform-split, per the investigation above — this cannot be one uniform button:**
- **Android / Chromium (Chrome, Edge, Samsung Internet, desktop Chrome/Edge too):** a real one-tap install is possible. Capture `beforeinstallprompt` on `window`, `event.preventDefault()` + save it; on button click call the saved event's `.prompt()` and await `.userChoice`. This is an actual native OS install dialog, not a custom UI.
- **iOS Safari:** **no equivalent API exists** — Apple/WebKit has never implemented `beforeinstallprompt` and there is no way to trigger "Add to Home Screen" programmatically. The button can only **show instructions** ("Tap Share, then Add to Home Screen") — it cannot perform the install.
- **iOS in a non-Safari browser** (Chrome-for-iOS, Firefox-for-iOS — all WebKit under Apple's rules, but only Safari exposes the Add-to-Home-Screen action): the affordance can only tell the user to reopen the page in Safari.
- **Already installed:** hide the affordance entirely — detect via `window.matchMedia('(display-mode: standalone)').matches` (works on both platforms); re-check on visibility/focus in case installed mid-session.

**Structure (per `skills/component-separation.md`):** new `useInstallPrompt.ts` hook owning the `beforeinstallprompt` listener, platform detection (UA-sniffed iOS/Safari check — no capability-detection API exists for this), dismissed/installed state; a pure-render `InstallPrompt.tsx` consuming it. Two variants of rendered content (Android prompt-button vs. iOS instructions) driven by the hook's platform flag, not two components.

**Scope:** both apps, per the plan's existing per-app rollout order (D4) — vendor is the current focus per the user's 2026-07-21 session, so it can lead here same as any other P-item.

> Executed (vendor): `vendor/components/layout/InstallPrompt/useInstallPrompt.ts` (hook — `beforeinstallprompt` capture, iOS detection incl. the iPadOS-13+-reports-as-"MacIntel" quirk, Safari-vs-other-iOS-browser detection via UA marker, `display-mode: standalone` check re-run on `visibilitychange`, `appinstalled` listener, `localStorage`-persisted dismissal) + `InstallPrompt.tsx` (pure render, three content variants: android / ios-safari / ios-other). Styled with vendor's existing Tailwind + `sp-*` token convention (matching `GuidePanel`'s card/icon-badge pattern), not CSS Modules — vendor is Tailwind-first, unlike command. Mounted in `AppShell.tsx` inside the authenticated view only (not on login/KYC/recovery screens, to avoid clutter on those flows) as a bottom-floating `sp-card` — vendor's `TabBar` is top-sticky, not bottom-fixed, so there's no collision risk.
>
> **Verified live** (Playwright, local dev stack, logged in as a seeded vendor admin) — all five scenarios the plan called for:
> 1. **Android/Chromium:** Chrome's own `beforeinstallprompt` heuristics did **not** fire naturally in one quick automated session (expected and unsurprising — that requires real engagement signals accumulated over time, not something a single scripted run can force). To verify the code itself independent of Chrome's own timing, dispatched a synthetic `beforeinstallprompt` event — banner correctly appeared with a real "Install" button, clicking it correctly awaited `.userChoice`, and the banner correctly hid after acceptance.
> 2. **iOS Safari** (UA-spoofed iPhone/Safari 17.5): banner shows the install copy and the "tap Share, then Add to Home Screen" instruction; confirmed **no install button renders** (nothing to trigger there).
> 3. **iOS non-Safari** (UA-spoofed `CriOS` — Chrome for iOS): banner correctly shows the "open this page in Safari" message instead.
> 4. **Already installed:** with `display-mode: standalone` emulated (proxied `matchMedia`), the banner **never renders at all**.
> 5. **Dismiss persistence:** banner shown → dismissed → immediately hidden → **stays hidden after a full page reload** (confirmed `localStorage` persistence actually works, not just that the code intends to).
>
> `tsc --noEmit` clean. Not verified (needs real hardware, same caveat as P5): the real native Android install dialog's actual visual appearance, and real iOS Safari's Share-sheet interaction — both are OS-native UI Playwright cannot render.

> Executed (booker): the hook (`useInstallPrompt.ts`) is **entirely app-agnostic** — copied verbatim from vendor, with only the `localStorage` key renamed (`booker-install-prompt-dismissed`, was `vendor-install-prompt-dismissed` — a booker copy shouldn't reference "vendor" even though origins already isolate storage). `InstallPrompt.tsx` re-styled with booker's own `db-*` tokens and its established icon-badge gradient (`#1a3a8f,#2563eb`, matching `GuidePanel`'s existing colours) rather than reusing vendor's `#2563eb,#6366f1` — copy-by-intent means adapting to each app's own palette, not literally cloning vendor's. Mounted in booker's `AppShell.tsx` after `</main>`, matching vendor's placement rationale (logged-in view only; booker's `TabBar` is also top-sticky, so no collision).
>
> **Verified live** (Playwright, logged in as a seeded booker) — identical 5-scenario battery as vendor, same results: synthetic `beforeinstallprompt` → banner + working Install button + hides after accept; iOS Safari UA → instructions only, no button; iOS non-Safari UA → "open in Safari" message; `display-mode: standalone` emulated → banner never renders; dismiss → hides immediately and **stays hidden after a full reload**. Additionally took a full-page screenshot to sanity-check the visual result (banner sits cleanly above booker's bottom-left Next.js dev-tools indicator, no overlap, colours consistent with booker's dark theme). `tsc --noEmit` clean.

---

## Effort estimate (added 2026-07-21 — excludes PayMongo)

**Verdict: neither app needs a refactor. Both are small, additive scaffolding tasks** — no existing component logic, state management, or routing changes in either app for P1/P3/P4. The real bottlenecks are **decisions (D1, D2)** and **device access for live verification (P5)**, not code complexity. PayMongo's standalone-redirect hazard (see above) is deliberately excluded from these estimates — the user is separately researching a better implementation for it.

### Booker — small, roughly half a day of engineering time once D1/D2/D6 are settled

| Item | Concrete work | Why it's small |
|---|---|---|
| P1 Manifest | 1 new file, `app/manifest.ts`, ~20 lines | Next's native metadata-route API — no dependency, no existing file touched |
| P3 Layout metadata | Edit `app/layout.tsx` — add a `viewport` export + extend the existing `metadata` object | ~10–15 lines added to a file that already exports `metadata`; nothing removed or restructured |
| P4 Service worker | 2 new files (`public/sw.js`, an `offline.html` fallback) + one registration call | If D1 = hand-rolled (recommended): ~30 lines total, no build-tool changes. Registration slots into `useAppShell.ts`'s existing mount `useEffect` (`:101`) — one more effect, not a restructure |
| P2 Icons | Asset generation, not code | **D2 resolved** (neutral placeholder) — no longer blocked, just needs the actual glyph generated |
| P6 Docs | Edit `architecture/overview.md` | Trivial |
| P7 Install affordance | 1 new hook + 1 new render component (~60–80 lines total): `beforeinstallprompt` capture, UA-based iOS check, `display-mode: standalone` detection, two content variants | The first genuinely new UI in this plan (P1–P4/P6 touch no component logic) — still small, but budget slightly more than the wiring items above. **D8 resolved** (dismissible banner) — ready to build once P1 is in place |

What makes booker specifically easy: already the more mobile-first of the two (bottom tab bar, single-page wizard), static `dark` theme default so D6's manifest-color choice is a one-liner, and — with PayMongo excluded from this pass — the one real *hazard* in the whole audit is off the table here. What's left is genuinely just wiring. (P5's PayMongo round-trip check is excluded per above; the rest of P5 — installability check, install-and-launch on a device — is quick to *verify*, not to build.)

### Vendor — small, marginally larger than booker, same half-day ballpark plus one extra live-test item

Structurally identical to booker for P1/P3/P4 — same file counts, same effort, same registration point (`useAppShell.ts`'s mount effect at `:87`). Two differences:

| Difference | Impact |
|---|---|
| Theme is `defaultTheme="system"`, not static dark | D6's manifest-color choice needs an actual decision (light vs. a neutral default) rather than inheriting one obvious value — a short conversation, not engineering work |
| KYC camera capture (`getUserMedia`) exists | **Zero code changes** — the existing upload fallback already covers camera failure. The only addition is a **live-test item** in P5: confirm the camera still works from an *installed* iOS PWA (a known-quirky combination historically). This is calendar time (device access), not code |

P7 (install affordance) is identical effort to booker's — same hook/component, same platform split, no vendor-specific wrinkle.

### Bottom line
This whole plan is additive scaffolding around two apps that already meet every non-trivial PWA precondition (HTTPS, mobile-first SPA, no server-rendering complications). No component rewrite, no routing change, no state-management change, and no dependency install if D1 goes with the hand-rolled service worker.

---

## DECISIONS

- **D1 — Service-worker approach** → **hand-rolled minimal SW** (resolved 2026-07-21) — ~30 lines, no new dependency, offline-fallback only (network-first for navigations with a cached `offline.html` fallback + cache-first for static assets). No precaching, no build-tool coupling. Revisit `@serwist/next` only if offline quality becomes a real requirement later.
- **D2 — Icon artwork** → **neutral placeholder icon set now** (resolved 2026-07-21) — a simple glyph per app's accent colour (192/512 PNG + maskable + apple-touch-icon), swapped later when real branding lands. Unblocks P2 and P5. *(Still needed at execution time: the actual glyph/accent-colour choice per app — a quick style pick, not a plan-level decision.)*
- **D3 — Offline scope** → **offline-fallback page only** (resolved 2026-07-21) — honest about being an online app; no app-shell caching, no data caching. Stale booking/KYC data shown offline would actively mislead, so that's ruled out entirely, not just deferred.
- **D4 — Rollout order** → **vendor first, booker second** (resolved 2026-07-21) — deviates from the initial recommendation (which favoured booker as the prime install candidate) in favour of matching the user's actual recent session focus on vendor. Booker follows the same P1→P7 sequence via copy-by-intent once proven on vendor.
- **D5 — Android back-gesture exits app** → **accept for now** (resolved 2026-07-21) — same underlying behaviour already exists in a browser tab (just less jarring there since browser chrome is visible); ship the PWA work without fixing this. History-state integration (wiring the SPA's internal step/page state into the browser History API) would be real engineering work touching the routing model in both apps — parked as its own separate plan if ever wanted, not folded into this one.

  **⏸ PARKED sub-note for later revisit (added 2026-07-21) — a scoped alternative worth considering instead of the all-or-nothing framing above.** Investigated vendor's code: confirmed **zero** History API usage anywhere today (no `pushState`/`popstate`), and found the app's navigable state is scattered across **at least four independent, disconnected pieces** — main page nav (`useAppShell.ts` `page`, 8 tabs), per-page modals (e.g. `useOfferingsPage.ts` `oModal`, add/edit/view), the **KYC registration wizard** (`LoginPage/useLoginPage.ts` `regStep`, 1–6 steps), and the notification panel view toggle. Wiring *all* of these into history (full D5-option-b) is genuinely ~1–2 days + live Android testing — bigger than the rest of this whole plan combined — because there's no central router to hook into; each needs its own opt-in via a shared pattern (e.g. a `useBackableState` hook) plus careful "did the user press back, or did our own code just change state" disambiguation.
  But the four aren't equally valuable to protect: **the KYC wizard is the one that actually matters** — it's a long multi-step flow where the camera-captured ID/selfie photos are *not* persisted across sessions (only form fields survive in `localStorage`; see `vendor-kyc.md`), so an accidental back-gesture mid-capture costs a new vendor their progress and their photos, right at the moment you most want them not to bounce. Modals are medium-value (annoying, low-stakes); main tab navigation is arguably not worth fixing at all (peer-level tabs aren't a "back" mental model, and native bottom-tab-bar apps typically don't push tab switches onto the back stack either).
  **If revisited:** scope it to just the KYC wizard (one hook, `useLoginPage.ts`, no app-wide shared utility needed) rather than the full app-wide integration — a fraction of the effort, aimed squarely at the one place where losing state is genuinely costly. Not decided or scheduled — D5 stays "accept for now" until/unless this is picked back up.
- **D6 — Manifest colours** → **booker: dark** (background/theme colour from its `--db-*` page tokens, matching its static `defaultTheme="dark"`) + **vendor: light theme colours** (resolved 2026-07-21) — vendor's manifest gets a static light default even though the live app follows system theme; matches vendor's light-first card/page tokens (`--sp-*`).
- **D7 — Web push:** stays **out of scope** (platform-wide decision in the docs). A SW (D1) is the prerequisite it would ride on later; noted only so the door is visibly open.
- **D8 — Install-affordance placement (P7)** → **dismissible banner in `AppShell`** (resolved 2026-07-21) — shown until dismissed or installed, persisted via `localStorage`. Highest discoverability; a Settings-page fallback link can be added later only if users report not finding it again after dismissing.

## Execution order (per D4, resolved 2026-07-21: vendor first) — ✅ COMPLETE for both apps except P5's held/physical-device items
1. ~~Vendor: P1 → P2 → P3 → P4 → P5~~ **Done** (2026-07-21) — P5's physical-device half pending the user's hardware.
2. ~~Booker: same sequence, copied by intent~~ **Done** (2026-07-21, same session) — P5's physical-device half pending the user's hardware, **and** the PayMongo round-trip item specifically held pending the user's separate PayMongo research.
3. ~~P7 (either app)~~ **Done**, both apps.
4. ~~P6 docs~~ **Done**, both apps.

## Verification
- Machine: `tsc --noEmit` ×2; build passes; manifest served + valid (DevTools Application panel shows installable, no warnings).
- Live device (cannot be machine-verified): install on Android + iOS; standalone launch; booker PayMongo round-trip from installed app; vendor iOS camera capture; offline → fallback page (not white screen); **P7:** Android/Chromium button completes a real install via the captured prompt; iOS Safari shows instructions only (no crash/dead click); iOS non-Safari browser shows the "open in Safari" message; affordance disappears once installed on both platforms.

## Notes
- No commits by the agent — user handles commits.
- Nothing here conflicts with the pinned Expo track; a PWA ships value now and the service/type layer reuse story for Expo is unchanged.
