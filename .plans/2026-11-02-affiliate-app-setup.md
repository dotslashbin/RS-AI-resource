# Affiliate app — initial setup (empty, sign-in-only Next.js app)

**Date:** 2026-11-02
**App / scope:** new `affiliate/` app (local only) · root repo: `.gitignore`, `.claude/skills/core-rules/SKILL.md`, `architecture/overview.md`. Reads `vendor/` and `command/`; changes neither.
**Status:** COMPLETE (2026-11-03) — I1–I8 done; F22, F24, F25 fixed and closed 2026-11-04 (`affiliate/` 523cd02, root c1cc86a). F26 closed 2026-11-04. Open: F15 (vendor side). Release: none.

> Stand up `affiliate/` as an empty, buildable "Ezzy Affiliate" app — the same stack and
> conventions as the other portals, a working sign-in screen, and a gate that refuses
> everyone until the `affiliate` portal exists — so the user can `git init` it before any
> feature or preview work. Optimise for **identical versions and conventions, nothing more**.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** F# = finding, I# = plan item, D# = decision, U# = user step.
> Numbers are plan-local; discovery refs are written "discovery Q6" etc.

**Parent:** `.plans/2026-11-02-affiliate-dashboard-discovery.md` (decisions Q6, Q6.1, Q6.2,
Q10, Q13, Q14, Q15). This plan is the standalone setup step agreed there. It is **not** the
feature implementation plan, which waits until the user confirms the design.

---

## ▶ RESUME HERE (updated 2026-11-04, findings closed)

- **Done:** Step 1 (I1, I2) 2026-11-02; Step 2 (I3–I6) and Step 3 (I7, I8 drafts)
  2026-11-03. `affiliate/` builds, lints, type-checks, passes 25 unit tests, 12 Playwright
  smoke tests and the live local sign-in checks (F22). The root repo now ignores it.
- **Live where:** nothing deployed. local ✅ · staging — · production — (no release).
- **U2 done 2026-11-03 (user):** `affiliate/` first commit 01da45b, signed, pushed to
  `github.com:thumbtaper/affiliate`; root commit 5c38c56, signed, five files, with only the
  affiliate row of `core-rules/SKILL.md` (the two other edits there stay uncommitted).
  **Plan COMPLETE.**
- **Closed by the user 2026-11-04:** F25 (forgot-password recovery, option a), F22 (one
  retry), F24 (reset-link view checked). Committed: `affiliate/` 523cd02 (pushed), root c1cc86a.
- **Open:** F15 (vendor's
  `useInstallPrompt` lint failure, vendor side).
- **Next after this plan:** the feature plan (portal row, dashboard, Command changes), which
  waits for the user to confirm the design (discovery notes).
- **Watch out for:** no `affiliate` portal row exists, so **nobody can get past sign-in**.
  That is intended, not a bug (I3). Never copy `.env.local` or any key into the app (I8).

---

## Scope

**In:** a new `affiliate/` folder with vendor's config and plumbing; a sign-in screen
(sign in · forgot password · email sent · set new password); a portal gate that refuses
everyone for now; a signed-in placeholder and sign-out; app chrome (layout, theming, error
and not-found pages, robots, manifest and icons); unit tests and one Playwright smoke spec
on port 3400; the app's own `AGENTS.md`/`CLAUDE.md`/`README.md`/`.gitignore`; the root
`.gitignore` line and two doc rows. Hand-over for the user's `git init`.

**Out:** the `affiliate` portal row and every other migration · any commission, earnings
or vendor data · Command changes (portal chip, `PORTAL_URL_AFFILIATE`, set-password email
routing) · design previews · Vercel projects, DNS and env vars · self-signup · any change
to `vendor/` or `command/` · pnpm (discovery Q6.2).

---

## Findings (read 2026-11-02)

- **F1 — Vendor's sign-in shell is mostly vendor-specific.**
  `vendor/components/layout/AppShell/useAppShell.ts` is 856 lines: KYC routing
  (`pendingKycVendorId`, `:106-110`), a multi-vendor picker (`:286`), and `verifyVendorAccess`
  (`:238`). `vendor/components/auth/LoginPage/useLoginPage.ts` (628 lines) is mostly the
  six-step registration wizard plus the `?division=`/`?ref=` deep links. An invite-only app
  needs none of it.
- **F2 — Command's shell is the closer match for an invite-only app.**
  `command/components/layout/AppShell/useAppShell.ts` is 337 lines;
  `command/components/auth/LoginPage/useLoginPage.ts` is 112 lines, with exactly the views
  needed: `"login" | "forgot" | "sent" | "reset"` (`:8`). Its gate
  (`command/services/command.service.ts:8-25`) is one query set — profile status, portals,
  roles — which becomes "active + has `affiliate` portal" with roles dropped. → **D1**.
- **F3 — The plumbing is shared and identical.** `proxy.ts` matches between vendor and
  command apart from names. Both `lib/supabase/client.ts` files export the same
  recovery-link helpers (`isRecoveryResolving`, `recoverySessionReady`, `clearRecovery`,
  `getAuthUrlError`, `isRecoveryDetected`); vendor `:182-214`, command `:148-179`.
  Recovery links matter: affiliates are invited by Command's set-password email
  (discovery Q10), which lands on this app.
- **F4 — Versions match across the three apps** (installed: Next 16.2.4, React 18.3.1,
  supabase-js 2.105.4). Vendor's `package.json` lists 28 runtime and 12 dev dependencies,
  all generic (Radix primitives, date-fns, sonner, lucide, tailwind). Nothing is
  feature-specific, and there are no maps. → **D2**.
- **F5 — Both apps register a service worker** for an offline page
  (`vendor/components/layout/AppShell/useAppShell.ts:210-214`, `vendor/public/sw.js`,
  `command/.../useAppShell.ts:179-180`). Command's once cached sensitive API responses
  (affiliate-interim K15). → **D3**.
- **F6 — Env vars the copied code reads:** `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_DOMAIN`,
  `NEXT_PUBLIC_APP_URL`, plus build/test flags (`CSP_REPORT_ONLY`, `ALLOW_INDEXING`,
  `PW_TEST`, `CI`, `VERCEL*`). **`SUPABASE_SERVICE_ROLE_KEY` is only read by
  `lib/supabase/admin.ts`**, which this app does not need yet (no server routes). Leaving it
  out keeps the service key out of the app entirely.
- **F7 — Vendor-only bulk not to copy:** `public/ph-address/` (1,636 files), `brand/` and
  `scripts/generate-brand-assets.mjs`, `.idea/`, `app/kiosk/`, `app/api/`, the 1,298-line
  `app/ui-gallery/page.tsx`, and every feature folder under `components/`, `lib/`,
  `services/`.
- **F8 — Vendor's Playwright config** starts `PW_TEST=1 npm run dev -- --port 3100` and waits
  on `http://localhost:3100/ui-gallery` (`vendor/playwright.config.ts:104-110`). The
  affiliate copy uses **3400** (discovery Q15); `npm run dev` stays on the default port.
- **F9 — The root repo ignores app folders by name** (root `.gitignore`: `vendor/`,
  `booker/`, `command/`, `backbone/`). `affiliate/` needs the same line.
- **F10 — Both service workers are on the fixed v2 (read 2026-11-02, after D3).**
  `vendor/public/sw.js` (66 lines) and `command/public/sw.js` (81 lines) differ only in
  comments: both use `offline-v2`, cache-first **only** for fingerprinted build output, never
  intercept cross-origin requests, and evict every other cache on activate. Command's copy
  carries the longer warning about what v1 leaked (decrypted payout details, stale
  `/api/affiliates`). Command registers it at `useAppShell.ts:179-180`, and the install
  prompt lives in `command/components/layout/InstallPrompt/` (`InstallPrompt.tsx`,
  `useInstallPrompt.ts`, `InstallPrompt.module.css`).
- **F12 — Where each file came from, decided by what it is coupled to (Step 1, 2026-11-02).**
  I1 said "config from vendor", but most of these files differ between the two apps, and
  command's shell (D1) only works with command's theme. Command's CSS modules use the
  `--rs-*` tokens; vendor's `globals.css` defines `--sp-*` instead.
  - **From vendor** (tooling that has to match vendor's `package.json`): `tsconfig.json`,
    `postcss.config.mjs`, `eslint.config.mjs` (flat config for eslint-config-next 16; see
    F13), `components.json`, `proxy.ts` (identical in both), `lib/supabase/server.ts`
    (identical in both), and `package-lock.json`.
  - **From command** (coupled to the shell): `app/globals.css`, `tailwind.config.ts`,
    `hooks/useTheme.ts`, `lib/supabase/client.ts` (recovery-link helpers, same exports as
    vendor's), and `playwright-screenshot.css` (header comment rewritten).
  - **`next.config.ts`:** command's version. Its CSP is the stricter one: camera denied,
    no `media-src`, and no Supabase origin in `img-src`. Changes made for this app:
    command-only comments rewritten, the PESONet `outputFileTracingIncludes` removed,
    and vendor's `PW_TEST` → `devIndicators: false` switch added for Playwright.
  - **`lib/utils.ts`:** only `cn`. Both apps' other helpers are portal-specific.
- **F13 — Command is on eslint-config-next 15, not 16.** `command/eslint.config.mjs` needs
  `FlatCompat` and warns against swapping configs between apps. F4 only compared Next,
  React and supabase-js, so "versions match across the three apps" holds for those, not
  for the lint toolchain. Affiliate follows vendor (16, flat config).
- **F11 — What the empty app actually imports (grep of command's shell, login, install
  prompt, `BrandLogo`, `LegalLinks`, `lib/`, `hooks/`, `app/layout.tsx`, 2026-11-02):**
  `next`, `react`, `react-dom`, `@supabase/ssr`, `@supabase/supabase-js`, `lucide-react`,
  `sonner`, `clsx`, `tailwind-merge`, `class-variance-authority` (`BrandLogo`), and
  `tailwindcss-animate` (`tailwind.config.ts:76`). Nothing imports `next-themes`, `date-fns`
  or any `@radix-ui/*` package in this slice (Radix popover is only in `Sidebar` and
  `LegalMenu`, which are not copied).

- **F14 — Step 1 left an unresolved import (found in Step 2, 2026-11-03).**
  `lib/supabase/client.ts` (command's) imports `@/lib/authHashError`, which I1 did not
  copy, so `tsc` would have failed. Fixed: command's `lib/authHashError.ts` copied as-is,
  plus vendor's `authHashError.test.ts` with its `pkce_verifier_missing` case dropped
  (command's copy has no mapping for that code). ✅ Fixed 2026-11-03; covered by `npm test`.
- **F15 — eslint-config-next 16 rejects command-era hook code (`react-hooks/set-state-in-effect`).**
  Follows from F13. Three hits on copied code: `useLoginPage`'s effect that reset
  `mobileView` (removed: it could never do anything useful, as the view only changes
  from a form handler that already runs in form mode), the recovery branch of
  `useAppShell`'s mount effect, and `useInstallPrompt`'s mount reads (both disabled with a
  stated reason, the same way vendor's `useAppShell.ts:536` does). Also
  `@next/next/no-html-link-for-pages` on `not-found.tsx` (now `next/link`).
  ⚠️ **Pre-existing, not fixed:** `vendor/components/layout/InstallPrompt/useInstallPrompt.ts:37`
  fails the same rule today (`npx eslint` on that file, 2026-11-03). Vendor is out of scope
  here; reported for the user / the vendor ESLint clean-up plan. ⬜ Open (vendor side).
- **F16 — How "refused" behaves (design choice in I3, 2026-11-03).** The refused state is
  a fifth `LoginPage` view (`"refused"`), not a separate screen, so it keeps the sign-in
  panel's look. The session is **signed out immediately** when the gate refuses, so no
  session ever lingers for an account the app will not open; the view's button is "Back
  to Sign In". The access check is three-way: `allowed` / `refused` / `unavailable`. A
  failed query (`unavailable`) shows "We couldn't check your access just now. Please try
  again." instead of telling a real affiliate they have no access.
- **F17 — No theme provider in `app/layout.tsx`.** I4 said "theme provider", but
  command's layout has none (its `ThemeContext` lives in its `AppShell`, driven by a
  sidebar toggle), and `next-themes` was dropped under D2. The sign-in screen is always
  dark, as in command; the signed-in placeholder uses the `rs-*` tokens and follows the
  `.dark` class (checked both ways in `/ui-gallery`), but nothing sets that class yet.
  `hooks/useTheme.ts` (copied in Step 1) is unused until the dashboard adds a toggle.
  → feature plan.
- **F18 — The app cannot build or serve without the two Supabase variables.**
  `createBrowserClient` throws at import when the URL or key is missing, so `npm run build`
  fails prerendering `/` (seen 2026-11-03) and `next dev` serves errors. Same as command.
  Until U1: the build was verified with **inline** placeholders
  (`NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321`, a non-key string). No file was written.
  `playwright.config.ts` passes the same placeholders **only when `.env.local` does not
  exist** (it checks existence and never reads it). The current `.next/` build output has
  the placeholders inlined; the user's next build replaces it.
- **F19 — The I2 "`npm install`, not `npm ci`" warning is out of date.** Step 1's
  `npm install` rewrote the lockfile: its root entry now equals the trimmed
  `package.json` (deps and devDeps compared 2026-11-03), and `npm ls --depth=0` exits 0.
  `npm ci` was **not** run to prove it (it deletes `node_modules`). `affiliate/README.md`
  and `AGENTS.md` say `npm ci` or `npm install`.
- **F20 — Accessibility gaps in command's login, fixed in the affiliate copy only.**
  Command's `LoginPage` has a "Forgot?" `<span onClick>` that the keyboard cannot reach,
  `<p>` labels not tied to their inputs, icon-only buttons without `aria-label`, inputs
  with `outline: none` and no focus style, 34px toggles, and no Enter-to-submit on sign in.
  The affiliate copy fixes all of these (real `<form>`s, `<label htmlFor>`, `<button>`,
  44px targets, focus rings, `role="alert"` errors, `:disabled` instead of an inline style).
  Command and vendor are unchanged; reported for the user. Still open in the copy: Tab
  goes Email → "Forgot?" → Password (same DOM order as command). → design previews.
- **F21 — Small notes from Step 2.** `public/offline.html` contains no app name, so I4's
  "app name changed" needed no edit. `DevVersionBadge` (dev-only) was copied with
  command's layout. The login's left-panel copy ("Your referrals. Your earnings.", three
  feature lines) is placeholder text until the design previews decide it.

- **F22 — Live local sign-in checks (2026-11-03, after U1).** `npm run dev` on :3000 against
  local Supabase (CSP `connect-src` read from the running app: `http://127.0.0.1:54321`;
  `.env.local` values never read). Local DB confirmed read-only first: `portals` holds
  only vendor, booker, command. Scripted browser run, 17/17, **repeated twice** with the
  same result: title exactly "Ezzy Affiliate", no console errors; root (active, every
  portal), nina (affiliate, no portals) and liza (affiliate + booker) are each **refused**
  with the expected copy, no `auth-token` cookie is left behind, and a reload shows
  sign-in; "Back to Sign In" works; a wrong password shows "Invalid login credentials" and
  stays on the form; forgot-password reaches "Check your inbox", and Mailpit received
  "Reset your password" for liza with `redirect_to=http://localhost:3000`.
  ⚠️ **One unexplained miss, not reproduced:** in the very first run, root's "No access"
  did not appear within 20s, yet no session was left. That run's script also crashed on a
  selector bug of its own (Next's route announcer is a second `role="alert"`), so it gave
  no screenshot. The two clean runs after it passed. Most likely a cold dev compile on
  the first sign-in, but that is **not proven**. If it recurs, capture the screen
  (the script now does). ⬜ Watch.
  **Reproduced and diagnosed 2026-11-03 (later the same day).** A timed run (6 fresh
  browsers) failed once, on run 1: the app showed the **unavailable** line ("We couldn't
  check your access just now"), not "refused". Kong's log: `GET /rest/v1/profiles` → **401,
  79-byte body** from the headless browser. 79 bytes is exactly the length of PostgREST's
  `PGRST303` "JWT issued at future" error (PostgREST v14.5), so the newly issued token was
  briefly ahead of PostgREST's clock. **Not** a cold compile: a build + cold dev start did
  not reproduce it (3 + 3 runs), and warm runs are refused in 0.9–2.9s. The app handled it
  as designed (no session left, a retry works), but a real affiliate would see "try
  again". Possible fix: retry the access check once after ~1s on `unavailable`. That
  touches the auth gate, so it is an approval gate; not done. ⬜ Open: the user decides.
  **Fix approved and applied 2026-11-03:** `verifyAffiliateAccess` retries once after 1s on
  `unavailable` (`lib/retryOnce.ts`, 4 unit tests: no retry on allowed/refused, one retry,
  never two, waits the delay). The 401 cannot be forced, so the retry path itself was not
  seen live; 6 timed live refusals after the change took 0.3–0.9s (no slowdown).
  ✅ Closed by the user 2026-11-04 (affiliate 523cd02).
- **F23 — `affiliate/.env.local` sets `SUPABASE_SERVICE_ROLE_KEY` (2026-11-03).** Found
  by a name-only check; the value was not read. No code in `affiliate/` reads it, and as a
  non-`NEXT_PUBLIC_` variable it is not bundled for the browser, so nothing is exposed
  today. But the plan (F6, I8) and `affiliate/README.md` say this app must not hold it:
  a future server file could pick it up by accident. The file is the user's (U1), so
  Claude did not edit it. 👤 Remove the line. ✅ Closed by the user 2026-11-03.
  Re-checked 2026-11-03 14:13 after the user's edit (names only): no `SERVICE_ROLE` name
  in the file; the four `NEXT_PUBLIC_*` variables the app needs are still set. Status left
  for the user to close.
- **F24 — The reset link flow itself is now locally testable.** **Run 2026-11-03:** Mailpit
  link (`type=recovery`, `redirect_to=http://localhost:3000`) opens "Set a new password";
  too-short and mismatched passwords are refused client-side; refresh stays on the view and
  never shows the signed-in placeholder; "Back to Sign In" returns to the form, leaves no
  session, and a reload shows sign-in (9/9). The view has **no session behind it**: see F25.
  No new password was submitted (it would change a seeded account). After the F25 fix the
  same run passes with a session on the view, and a real reset was round-tripped (F25).
  ✅ Closed by the user 2026-11-04. Earlier text: The forgot-password email
  lands in Mailpit with a working link back to :3000, so following it to the "Set a new
  password" view could be checked locally. Not run: outside the checks this step named.
  The Command-invite link still waits on the feature plan, as recorded.

- **F25 — Forgot-password recovery is signed out by the gate (found by F24, 2026-11-03).**
  Opening a self-requested reset link (`?code=`, PKCE) in the same browser: the code is
  exchanged (`POST /auth/v1/token` 200), then ~70ms later `useAppShell`'s mount effect runs
  the gate on that session (`/auth/v1/user`, `profiles`, `user_portals`), the gate refuses,
  and it signs out (`POST /auth/v1/logout` 204). The "Set a new password" view still shows,
  because the `rs.recovery` latch is set, but with **no session**: no auth cookie and
  nothing in local storage. Saving a password would then fail ("Auth session missing!").
  **Cause, inherited from command (D1):** the mount effect skips the gate only when
  `isRecoveryDetected()` is already true, and `isRecoveryResolving()` recognises only `#hash`
  tokens (Command's invite links), not `?code=`, whose PASSWORD_RECOVERY event arrives later.
  **Impact today:** every account is refused, so no forgot-password reset can complete in
  this app. After the portal exists, real affiliates pass the gate and keep the session;
  only refused accounts are hit. Command has the same gap for non-Command accounts (not
  changed). **Fix options** (auth flow, so an approval gate; not done): (a) vendor's
  approach, requesting resets with an implicit-flow client (`vendor/lib/supabase/recoveryRequestClient.ts`)
  so links arrive as `#hash` tokens, which this app already handles, plus
  `vendor/lib/authCodeCallback.ts` for `?code=` links already in inboxes; (b) treat a
  `?code=` at load as "recovery resolving" so the gate waits. ⬜ Open: the user decides.
  **Fixed 2026-11-03 with option (a), approved by the user:** vendor's
  `lib/supabase/client.ts` (whole), `lib/supabase/recoveryRequestClient.ts`,
  `lib/authCodeCallback.ts` + test, `lib/authHashError.ts` + test (vendor's, restoring the
  `pkce_verifier_missing` case); `services/auth.service.ts` `resetPassword` uses the
  recovery client. Plus one condition in `useAppShell`'s mount effect: skip the gate while
  `isRecoveryResolving()`, which closes the `?code=` race too (vendor has the same race;
  not changed). **Verified:** opening the link now makes no gate queries and no logout,
  and an `sb-127-auth-token` cookie exists on the reset view (before: gate + logout + no
  cookie); a full round trip on seeded liza: reset to a temporary password → it signs in
  (then refused) and the old one fails → reset back to the seed password → seed password
  signs in (5/5; liza restored). Regression: live suite 17/17, smoke 12/12, unit 35/35,
  build, lint, tsc. ✅ Closed by the user 2026-11-04 (affiliate 523cd02).
- **F26 — `NEXT_PUBLIC_APP_DOMAIN` in `affiliate/.env.local` is vendor's.** The sign-in form's
  domain hint reads `vendor.ezzy.ph` (seen on screen 2026-11-03; the file was not read).
  Not secret, but wrong for this app. 👤 Set it to this app's domain.
  **Set by the user 2026-11-04.** Checked by name only (value not printed): one
  `NEXT_PUBLIC_APP_DOMAIN` line, contains "affiliate", not "vendor". Not seen on screen yet.
  ✅ Closed by the user 2026-11-04.

---

## Items

### I1 — Copy config and plumbing from vendor  ✅ DONE 2026-11-02
> Done with the source split in F12. Verified: the vendor/kiosk/KYC/payout grep over the
> copied files matches comments only (the plan link in `next.config.ts`; Command's
> set-password-link history in `client.ts`, which also applies to affiliates; tooling
> history). No `.env*` file in `affiliate/`; `grep -rn SERVICE_ROLE` (excluding
> `node_modules`) finds nothing; `admin.ts` was not copied.

**Copy into `affiliate/`:** `next.config.ts` (CSP and security headers as-is),
`proxy.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`,
`eslint.config.mjs`, `components.json`, `playwright-screenshot.css`,
`lib/supabase/{client,server}.ts` (per D1, from whichever app supplies the shell),
`lib/utils.ts`, `hooks/useTheme.ts`, `app/globals.css`.
**Not copied:** everything in F7, and `lib/supabase/admin.ts` (F6).
**Check:** `grep -rn -i "vendor\|kiosk\|kyc" affiliate --include=*.ts --include=*.tsx`
returns nothing outside comments that were deliberately kept.

### I2 — `package.json`, lockfile and install  ✅ DONE 2026-11-02 · 🔒 approved 2026-11-02
> Verified: `npm install` exited 0 and added 458 packages. `npm ls` for next, react,
> react-dom, supabase-js, ssr, tailwindcss, typescript, eslint, eslint-config-next,
> playwright, sonner and lucide-react is identical to vendor's (`diff` empty). Lockfile:
> vendor has 569 entries, affiliate 459, with **0 added, 0 version changed, 110 removed**.
> The fallback was not needed: `npx eslint next.config.ts proxy.ts lib hooks` exited 0
> without the two `@typescript-eslint/*` packages.

1. Copy vendor's `package.json`: `name` → `"Ezzy Affiliate"`, `version` → `"0.1.0"`, keep
   the scripts and `overrides`; the dependency list per **D2**.
   **Trimmed list (D2 = b, from F11):**
   - runtime (11): `@supabase/ssr`, `@supabase/supabase-js`, `class-variance-authority`,
     `clsx`, `lucide-react`, `next`, `react`, `react-dom`, `sonner`, `tailwind-merge`,
     `tailwindcss-animate`, each with vendor's exact range.
   - dev (10): `@playwright/test`, `@types/node`, `@types/react`, `@types/react-dom`,
     `autoprefixer`, `eslint`, `eslint-config-next`, `postcss`, `tailwindcss`, `typescript`.
     The two `@typescript-eslint/*` packages are dropped: `eslint.config.mjs` does not import
     them, and `eslint-config-next` brings its own.
   - dropped (17): all 15 `@radix-ui/*`, `date-fns`, `next-themes`, plus the two above.
     Each one comes back only through its own approval in the feature plan, at vendor's range.
2. Copy vendor's `package-lock.json` unchanged.
3. Install with `npm --prefix affiliate install`. It keeps the locked versions for what
   remains and prunes the rest. `npm ci` would refuse here, because the trimmed
   `package.json` no longer matches the lockfile.
   **Fallback, covered by this approval:** if lint or build fails because a dropped
   `@typescript-eslint/*` package was needed after all, add it back at vendor's range and
   record that as a finding. Any other missing package stops the step and asks.
**Check:** `npm --prefix affiliate ls next react @supabase/supabase-js @supabase/ssr tailwindcss`
shows **exactly** the versions `npm --prefix vendor ls …` shows (F4); the lockfile diff
against vendor's has **only removals** (no version changed). No `npm audit fix`, no upgrades.

### I3 — Sign-in shell and the portal gate  ✅ DONE 2026-11-03
> Built per D1 from command's shell; refused is a `LoginPage` view and signs out at once
> (F16). Files: `components/auth/LoginPage/{LoginPage.tsx,useLoginPage.ts,LoginPage.module.css}`,
> `components/layout/AppShell/{AppShell.tsx,useAppShell.ts,AppShell.module.css}`,
> `components/layout/SignedInPlaceholder/{SignedInPlaceholder.tsx,SignedInPlaceholder.module.css}`
> (pure display, sign-out via prop, no hook), `services/affiliate-access.service.ts`,
> `services/auth.service.ts` (command's, unchanged), `lib/affiliateGate.ts`, and
> command's `lib/{password,legal,authHashError}.ts`, `components/ui/{BrandLogo,LegalLinks}/`.
> Verified: `lib/affiliateGate.test.ts` (8 tests: active + portal; portal among others;
> missing / other portal; inactive; exact-match casing; embed shapes) passes; lint and
> tsc exit 0; no `style={{}}` in any `.tsx` (grep); Playwright drives the real `/` sign-in
> and the forgot round trip, and each of the five views in `/ui-gallery`; screenshots
> of login, refused (900px and 390px), keyboard focus, and the placeholder in light
> and dark were reviewed (scratchpad, not baselines). Accessibility changes: F20.
> Live, 2026-11-03 (F22): seeded root, nina and liza each refused with no session left;
> wrong password error; forgot → "sent" with the email in Mailpit.
Per **D1**: `components/auth/LoginPage/` (sign in · forgot · sent · reset) and
`components/layout/AppShell/`, reduced to: checking auth → signed out (LoginPage) →
recovery (reset view) → refused (message + sign out) → signed in (placeholder + sign out).
- `services/affiliate-access.service.ts` exports `verifyAffiliateAccess(user)`:
  `allowed = active profile AND a user_portals row whose portal name is 'affiliate'`. No role
  check: being an affiliate is a capability, not a role (affiliate-interim D11).
- **Until the `affiliate` portal row exists (feature plan), it returns `false` for
  everyone.** That is the safe default and is what the local check proves.
- Refused copy: "This account doesn't have access to Ezzy Affiliate."
- **Component separation** (`.claude/skills/component-separation/SKILL.md`), stated per
  component:
  - `LoginPage.tsx` render only · `useLoginPage.ts` state and handlers · `LoginPage.module.css`
  - `AppShell.tsx` render only · `useAppShell.ts` auth and gate state · `AppShell.module.css`
  - `SignedInPlaceholder.tsx` is a pure display component (no state, effects or handlers),
    so it needs no hook. Its sign-out button takes a handler prop from `useAppShell`.
  - No `style={{}}` blocks in any `.tsx`.
- UX: run the `.claude/skills/ux-design/SKILL.md` checklist on the four login views and the
  refused state (loading, error, light and dark).

### I4 — App chrome  ✅ DONE 2026-11-03
> Files: `app/layout.tsx`, `app/page.tsx`, `app/manifest.ts` (command's, comments
> rewritten), `app/robots.ts` (unchanged), `app/error.tsx` + `app/useLogError.ts` and
> `app/not-found.tsx` sharing `app/StatusPage.module.css` (command's inline styles moved
> into the module), `lib/constants.ts` (vendor's fallback), `lib/siteUrl.ts` (+ its test),
> `components/dev/DevVersionBadge.tsx`, icons, `public/{sw.js,offline.html,icons/}`, and
> `components/layout/InstallPrompt/` with its **own** dismissal key
> `affiliate-install-prompt-dismissed` (command's key would have shared dismissal across
> portals). No theme provider (F17).
> Verified: `cmp` says `public/sw.js` is byte-identical to command's (`offline-v2`;
> cache-first only under `/_next/static/`; `/api/` and `?_rsc=` appear only in comments);
> the smoke test fetches `/sw.js` and `/offline.html`; all six icons `cmp`-identical to
> command's; the smoke test asserts the title never matches `Affiliate\s+Affiliate`.
> Live, 2026-11-03 (F22): the title reads exactly "Ezzy Affiliate". Install prompt: only shown when signed in, so unreachable
> for now.
`app/layout.tsx` (theme provider, `APP_NAME` metadata), `app/page.tsx` → `AppShell`,
`app/error.tsx`, `app/not-found.tsx`, `app/robots.ts` (no indexing), `app/manifest.ts`
and the icons (`favicon.ico`, `icon.svg`, `apple-icon.png`, reused Ezzy marks per **D4**),
`lib/constants.ts` (`APP_NAME`/`APP_DOMAIN` from env, as in vendor).
**Service worker, offline page, install prompt (D3 = b):** copy command's `public/sw.js`
as-is (`offline-v2`, build-output-only caching, F10), `public/offline.html` with the app
name changed, the registration lines from `command/.../useAppShell.ts:179-180`, and
`components/layout/InstallPrompt/`. Component separation: `InstallPrompt.tsx` render only ·
`useInstallPrompt.ts` the `beforeinstallprompt` state and handlers · `InstallPrompt.module.css`.
**Check:** `grep -n "OFFLINE_CACHE\|_next/static" affiliate/public/sw.js` matches command's;
the fetch handler has no path that caches `/api/` or `?_rsc=`.
**Check:** the page title reads exactly "Ezzy Affiliate", never "Ezzy Affiliate Affiliate"
(see `architecture/overview.md` → brand-name note).

### I5 — Tests  ✅ DONE 2026-11-03
> Files: `lib/affiliateGate.test.ts`, `lib/authHashError.test.ts` (F14),
> `lib/siteUrl.test.ts`, `playwright.config.ts` (port 3400, `PW_TEST=1`, placeholder env
> only when `.env.local` is absent, F18), `app/ui-gallery/{page.tsx,useGallery.ts}`
> (`?mode=login|forgot|sent|reset|refused|signedin&theme=`; 404s in production builds),
> `visual-tests/smoke.spec.ts`. No screenshot baselines.
> Verified 2026-11-03: `npm test` 25/25 pass; `npx playwright test` 12/12 pass, run
> logged to a file (scratchpad `final-smoke.log`), not piped; port 3400 free before and
> after. The smoke spec checks: `/` returns 200 with the CSP header
> (`frame-ancestors 'none'`) and `X-Frame-Options: DENY`; the form's labelled fields; the
> forgot round trip; each gallery view; the refused copy; the placeholder in light and dark;
> the service worker. The production build lists `/ui-gallery` as prerendered: it calls
> `notFound()`, as command's does.
- `lib/` unit tests via the existing `npm test` script (`node --test … "lib/**/*.test.ts"`):
  a test for `verifyAffiliateAccess`'s pure decision (active + portal → allowed; inactive,
  missing portal, or another portal → refused), extracted as `lib/affiliateGate.ts` so it
  can be tested without Supabase, following vendor's `lib/vendorGate.ts` pattern. Plus any
  copied helper's own test.
- `playwright.config.ts`: port **3400**, `PW_TEST=1`, the `/ui-gallery` URL. A minimal
  `app/ui-gallery/page.tsx` that renders the four LoginPage views and the refused state.
  It 404s in production builds, as in the other apps.
- `visual-tests/smoke.spec.ts`: the sign-in screen loads; the CSP header is present.
  **No screenshot baselines in this plan.** The design previews will settle the look
  first, and baselines added now would only be regenerated.

### I6 — App documents  ✅ DONE 2026-11-03
> `affiliate/AGENTS.md` (what the app is, invite-only, the gate refusing everyone, where
> each file came from, the eslint 15/16 trap, rules), `affiliate/CLAUDE.md` (`@AGENTS.md`),
> `affiliate/README.md` (run, test, env var table **without values**, the placeholder
> behaviour), `affiliate/.gitignore` (vendor's, unchanged: ignores `.env*`,
> `node_modules`, `.next`, `test-results`). Verified by reading; `find` shows no `.env*`
> file in `affiliate/`; `grep SERVICE_ROLE` matches only the two documents that say not
> to use it.
`affiliate/AGENTS.md` (short: what the app is, invite-only, the gate, the port, links to
the discovery notes and root rules — not a copy of vendor's 198 lines),
`affiliate/CLAUDE.md` (`@AGENTS.md`), `affiliate/README.md` (run, test, the env var list
from F6 **without values**), `affiliate/.gitignore` (vendor's, which already ignores
`.env*`, `node_modules`, `.next`, `test-results`).

### I7 — Root workspace  ✅ DONE 2026-11-03
> Root `.gitignore` line 2 `affiliate/`; core-rules tree row added under `vendor/`;
> `architecture/overview.md` → "The Affiliate portal (`./affiliate`, in setup)", placed
> after Ezzy Command. Verified: `git check-ignore -v affiliate/` → `.gitignore:2`; root
> `git status --short` no longer lists `affiliate/`. ⚠️ `core-rules/SKILL.md` already held
> two uncommitted edits from other work (the "RS → Ezzy Command" rename and the
> `booker-abandoned-checkout-cleanup.md` row), so the root commit draft stages only this
> plan's hunk (I8).
- Root `.gitignore`: add `affiliate/` beside `vendor/` (F9).
- `.claude/skills/core-rules/SKILL.md` → Workspace tree: add
  `affiliate/  # Ezzy Affiliate — affiliate dashboard; setup only, see .plans/2026-11-02-affiliate-app-setup.md`.
- `architecture/overview.md`: one short "The Affiliate portal (in setup)" note. The full
  portal section is written with the feature.
**Check:** `git -C . status --short` no longer lists `affiliate/`.

### I8 — Hand-over  ✅ DONE 2026-11-03
> U1 ✅ 2026-11-03 (F22, F23). Commit drafts handed over 2026-11-03 per the commit-drafting
> skill: one for the new `affiliate/` repository, one for the root repository. Claude ran
> no git write command. U2 is the user's, and only the user ticks it.
> - U2a `affiliate/` ✅ 2026-11-03 (user): `git init -b master`, signed commit `01da45b`
>   (GPG "Good signature"), pushed to `github.com:thumbtaper/affiliate`; `master` tracks
>   `origin/master` and `git ls-remote` shows the same commit. No `develop` branch yet
>   (optional git-flow step). The first commit failed at signing at first; `GPG_TTY` fixed it.
> - U2b root commit ✅ 2026-11-03 (user): 5c38c56, GPG `G`, exactly the five paths;
>   `git diff HEAD` on core-rules shows only the two other workstreams' edits left.
- 👤 **U1** — create `affiliate/.env.local` yourself: copy the two `NEXT_PUBLIC_SUPABASE_*`
  values from vendor's, and set `NEXT_PUBLIC_APP_NAME="Ezzy Affiliate"` (plus `APP_DOMAIN`
  and `APP_URL` as in vendor). Claude never reads, copies or writes key files (core rules).
- 👤 **U2** — `git init` + first commit inside `affiliate/`. Claude drafts it per
  `.claude/skills/commit-drafting/SKILL.md` (message + scoped `git add`). It also drafts the
  root-repo commit for I7 and this plan, scoped so other in-progress root files stay out.

---

## DECISIONS
<!-- No item may execute while any OPEN line remains (plan-authoring §7). -->

- RESOLVED 2026-11-02 — **(a) command's shell** (user). **D1 — Where the sign-in shell comes from.** (a) command's shell: login, forgot,
  sent, reset; one simple gate (F2), with roles removed. (b) vendor's shell, cutting out the
  registration wizard, KYC and vendor picker (F1). Config and plumbing come from vendor
  either way (discovery Q6.1). **Recommendation: (a).** It is about a quarter of the size and
  already does exactly what an invite-only app needs; (b) means deleting about 1,300 lines
  and hoping nothing that mattered went with them. This refines Q6.1 for the shell only.
- RESOLVED 2026-11-02 — **(b) trimmed**, against the recommendation (user). The list is in
  I2, derived from F11. **D2 — Dependency list.** (a) Identical to vendor's: `npm ci`, guaranteed same tree,
  some packages unused for now. (b) Trimmed to what the empty app uses: smaller, but each
  package added back later is a new approval gate, and versions could drift.
  **Recommendation: (a).** Every package is generic UI, and the dashboard will want most of
  them (tabs, select, popover, tooltip, toast, date-fns). Unused ones get pruned at the end
  of the feature build.
- RESOLVED 2026-11-02 — **(b) copy**, against the recommendation (user). Command's copy is
  used, because D1 takes command's shell and both files are on the fixed v2 (F10).
  **D3 — Service worker / offline page / install prompt.** (a) Leave them out for now.
  (b) Copy vendor's. **Recommendation: (a).** An affiliate checking earnings does not need
  offline mode. A service worker is the piece that once cached sensitive responses (F5),
  and it is easy to add later on purpose.
- RESOLVED 2026-11-02 — **(a) reuse** (user). **D4 — Icons and brand marks.** (a) Reuse the current Ezzy icons as they are.
  (b) Make Affiliate-specific marks now. **Recommendation: (a).** Revisit with the design
  previews.

---

## DEFERRED (to the feature plan, by design)

- `affiliate` portal row, own-row RLS policies, commission ledger — schema gates.
- Command: `affiliate` in `ALL_PORTALS`, `PORTAL_URL_AFFILIATE`, set-password email routing.
- Vercel projects (staging and production), `affiliate.ezzy.ph` / `staging-affiliate.ezzy.ph`,
  hosted env vars.
- Screenshot baselines; the dashboard itself.

---

## Execution order

One step at a time, with a report after each (AGENTS.md → Execution Cadence).

1. **Step 1 — I1 + I2:** files copied, dependencies installed, versions match vendor.
   *(Contains the install gate; runs only after plan approval.)*
2. **Step 2 — I3 + I4 + I5 + I6:** the app works locally; build, lint, type check, unit
   and smoke tests pass; the local sign-in check passes (after U1).
3. **Step 3 — I7 + I8:** root docs and `.gitignore`, then commit drafts; the user does
   U2 (`git init` + first commit).

## Release

**Release: none.** Nothing is deployed. Vercel projects and hosted env vars belong to the
feature plan's staging → production path.

---

## Verification

| Check | Kind | Step |
|---|---|---|
| Installed versions equal vendor's (`npm ls`); lockfile diff vs vendor is removals only | machine | 1 |
| `npm --prefix affiliate run build` ✅ 2026-11-03 (inline placeholders, F18) | machine | 2 |
| `npm --prefix affiliate run lint` ✅ 2026-11-03 | machine | 2 |
| `npx --prefix affiliate tsc --noEmit -p affiliate` ✅ 2026-11-03 | machine | 2 |
| `npm --prefix affiliate test` (gate decision tests) ✅ 2026-11-03, 25/25 | machine | 2 |
| `npx playwright test` in `affiliate/` (smoke, port 3400); run logged to a file, not piped through `tail` ✅ 2026-11-03, 12/12 | machine | 2 |
| Service worker matches command's v2 and caches no `/api/` or `?_rsc=` response (grep + read) ✅ 2026-11-03, `cmp` identical | machine | 2 |
| grep: no `vendor`/`kiosk`/`kyc` leftovers; no `SUPABASE_SERVICE_ROLE_KEY` anywhere in `affiliate/` ✅ 2026-11-03 (comments and copy only; SERVICE_ROLE only in the two docs that forbid it) | machine | 2 |
| `npm run dev` starts on the default port; the sign-in screen renders in light and dark ✅ 2026-11-03 (F22; sign-in is always dark by design, F17) | live — local, after U1 | 2 |
| A seeded local user signs in and gets the **refused** message (no `affiliate` portal exists); a wrong password shows the error; forgot-password reaches "sent" ✅ 2026-11-03, 17/17 twice (F22) | live — local Supabase, after U1 | 2 |
| `git status` at root no longer lists `affiliate/` | machine | 3 |

The set-password link from a real Command invite cannot be tested until the feature plan
adds the portal and `PORTAL_URL_AFFILIATE`. Recorded as not verifiable here.
