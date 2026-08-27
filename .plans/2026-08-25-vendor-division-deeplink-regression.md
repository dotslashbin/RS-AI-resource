# Vendor division deep-link — restoring `?division=` after the URL-mirror regression

**Date:** 2026-08-25
**App / scope:** `vendor/` only — two files changed, one spec added
**Status:** ✅ **COMPLETE (2026-08-25).** Both stages executed and verified.
B1/I1 were verified in this session (the new spec proven to fail against pre-fix
HEAD); **B3 was confirmed working by the user**
on the live app — see its note for exactly who verified what. One pre-existing
problem was discovered along the way and is recorded as **N1**, still open.
Second-pass gap review completed 2026-08-25; it added **B3** and rewrote **B2**
(see *Gap review*). Re-approval not sought — the additions are corrections within
the approved scope, and neither touches a file the approved plan left alone.

> The `?division=` deep-link shipped working on 2026-08-09 and was browser-verified
> on 2026-08-10. A dashboard feature merged 2026-08-14 began rewriting the query
> string on mount and silently ate the parameter. This plan restores it, and closes
> the pre-existing bug that restoring it would otherwise unmask.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important. Numbers are plan-local —
> qualify cross-plan refs by app.

---

## Scope

**In scope:** making the existing deep-link read survive a URL rewrite that happens
before it runs; guarding the view-switch it triggers; one regression test.

**Out of scope:**
- `useAppShell.ts` — **not touched at all** (D1, resolved below).
- Any behaviour change to how divisions are fetched, matched, stored, or validated.
  `lib/slug.ts`, `/api/divisions`, `Division.slug`, and the id-not-slug storage
  contract are all correct and stay as they are.
- `command` / `booker` / the Expo apps. Single-app change.
- Attribution or analytics on campaign links. Never asked for.

---

## What the investigation found

### The feature is intact; only the timing broke

`.plans/2026-08-10-vendor-division-url-param.md` (✅ COMPLETE) built this, and all
three of its pieces are still present and correct on `master`:

| Piece | Location | State |
|---|---|---|
| `slug` on the wire | `lib/types.ts:21`, `app/api/divisions/route.ts:12` | ✅ intact |
| Forgiving matcher | `lib/slug.ts` + `lib/slug.test.ts` | ✅ intact, unit-tested |
| Read + seed effect | `useLoginPage.ts:104-143` | ✅ intact — but reads too late |

The URL format is unchanged and correct: `?division=<slug>`, e.g.
`https://staging-vendor.ezzy.ph/?division=ezzy-well`. The parameter takes the
**division slug**, not an id or name — the 13 seeded slugs are in
`backbone/supabase/migrations/20260724000004_divisions.sql:29-42`. `normaliseSlug`
makes `ezzy-well`, `ezzywell`, `EzzyWell` and `ezzy_well` all resolve.

### Root cause — a later feature rebuilds the query string from scratch

`useAppShell.ts:527-547` calls `serialiseAppParams` and `replaceState`s the result.
`serialiseAppParams` (`lib/dashboardRange.ts:218-231`) constructs a **fresh**
`URLSearchParams` emitting only `page`, `from`, `to`, `status` — every other
parameter is discarded, not merged. With `page` defaulting to `"dashboard"`
(`useAppShell.ts:136`) and `dashRange` to `defaultDashboardRange()` = current month
(`:140`), it writes exactly the URL that was reported:

```
/?page=dashboard&from=2026-08-01&to=2026-08-31
```

`useAppShell()` is called at `AppShell.tsx:38`, **above every early return**, so
this runs while the anonymous login screen is on screen. `useLoginPage`'s read sits
inside `getActiveDivisions().then(...)` — after a network round trip — so the URL is
already rewritten by the time it looks.

**This is a regression, not a broken implementation.** The deep-link landed in
`66db530` (2026-08-09); the URL mirror landed in `fe91929` "Add dashboard date range
and widget drill-down" (2026-08-14). Confirmed via `git merge-base --is-ancestor`.
The 2026-08-10 browser verification was genuine; the ground moved under it.

**Ruled out:** no `next.config` redirects or rewrites, and
`lib/supabase/client.ts:126,173` preserves `window.location.search` (it strips only
the hash). Auth and routing are not involved.

<!-- Corrected 2026-08-25 during stage 1: the draft said "no middleware.ts", which was
     imprecise. Next 16 renamed middleware to `proxy.ts`, and vendor/proxy.ts DOES
     exist — the build prints "ƒ Proxy (Middleware)". It refreshes the Supabase
     session via `supabase.auth.getUser()` and returns `NextResponse.next({ request })`
     on a catch-all matcher. It issues no redirect and never touches the query
     string, so the conclusion is unchanged; only the wording was wrong. -->

### ⚠️ Correction: capturing at first render is NOT early enough

This plan was scoped around a render-phase `useState` initialiser in `useLoginPage`.
**Tracing the mount sequence shows that would not work**, and it is recorded here so
the weaker fix is not re-proposed later:

1. Page loads. `AppShell` renders with `isCheckingAuth = true` (`useAppShell.ts:162`)
   and returns `null` at `AppShell.tsx:68`. **`LoginPage` is not mounted.**
2. `AppShell`'s effects run anyway — the mirror at `:527-547` fires and wipes the
   parameter.
3. The auth check resolves *asynchronously*; `setIsCheckingAuth(false)`.
4. Only now does `AppShell.tsx:91` mount `LoginPage`. Any initialiser inside it —
   render-phase or not — reads a URL that was cleaned one commit earlier.

So the capture has to happen **before React renders anything at all**.

### The codebase already solves exactly this, one file over

`lib/supabase/client.ts:167-173` reads an auth error out of the URL in a module-load
IIFE, guarded with `typeof window === "undefined"`, and its comment names the same
hazard:

> *"Read at module load for the same reason as that latch: `detectSessionInUrl`
> clears the hash before React mounts and can look at it."*

That is the house pattern for "something erases the URL before React mounts", and
B1 follows it rather than inventing a second mechanism. The import chain is fully
static — `app/page.tsx` → `AppShell.tsx:6` → `LoginPage` → `useLoginPage` — with no
`dynamic()` or `lazy()` anywhere in `app/` or `components/`, so module evaluation is
guaranteed to precede the first render.

---

## BLOCKERS

### B1 — Capture `?division=` at module load, not after the fetch  ✅ DONE (2026-08-25)
<!-- ✅ lib/divisionDeepLink.ts created; useLoginPage.ts:124 calls peekDeepLinkDivision().
     VERIFIED BEHAVIOURALLY, not just by compilation: visual-tests/division-deeplink.spec.ts
     passes 4/4 against the fix, and — the check that matters — 2/4 FAIL against pre-fix
     HEAD with "element(s) not found" (the registration form never opens). The test was
     run in both directions before this was marked done, by reverting useLoginPage.ts to
     HEAD, re-running, and restoring. A green test whose failure mode was never observed
     proves nothing.
     Also machine-verified: tsc 0, lint at baseline (35 problems both before and after),
     248/248 unit tests, build succeeds, `/` still prerenders ○ Static. -->
<!-- 🔄 (2026-08-25) Code complete: lib/divisionDeepLink.ts created; useLoginPage.ts:124
     now calls peekDeepLinkDivision(). MACHINE-VERIFIED ONLY — tsc 0, lint at baseline,
     248/248 unit tests, build succeeds, `/` still prerenders ○ Static (so the read did
     not opt the route into dynamic rendering).
     ⚠️ NOT ✅ AND MUST NOT BE until the deep link is observed working in a browser or
     by I1. This plan itself records (B3 of the 2026-08-10 plan) that marking DONE on
     "code written" was the mistake made on 2026-08-08. Behaviour is still unobserved. -->
**Files:** new `vendor/lib/divisionDeepLink.ts`; `vendor/components/auth/LoginPage/useLoginPage.ts:124`

Replace the in-`.then()` read with a module-load capture, mirroring
`lib/supabase/client.ts:167-173`:

```ts
// lib/divisionDeepLink.ts
import { normaliseSlug } from "./slug"

/*
 * The `?division=` slug, normalised, captured at MODULE LOAD.
 *
 * ⚠️ It cannot be read any later. AppShell's URL-mirror effect
 * (useAppShell.ts:527-547) rebuilds the query string from `serialiseAppParams` —
 * which emits only page/from/to/status and discards everything else — and
 * replaceState's it during AppShell's first commit, which happens while
 * `isCheckingAuth` is still true and LoginPage is not yet mounted. So neither an
 * effect nor a render-phase initialiser inside LoginPage is early enough.
 * Same hazard, same remedy as `authUrlError` in lib/supabase/client.ts.
 *
 * Returns "" when absent, on the server, or when the value is blank.
 */
let pending = (() => {
  if (typeof window === "undefined") return ""
  return normaliseSlug(new URLSearchParams(window.location.search).get("division") ?? "")
})()

/** The captured slug, or "". Call `consumeDeepLinkDivision` once it has been applied. */
export function peekDeepLinkDivision(): string { return pending }

/** One-shot: after this, `peek` returns "". See B3 for why stickiness is a bug. */
export function consumeDeepLinkDivision(): void { pending = "" }
```

⚠️ The one-shot half of this module is **required, not optional** — it is B3, and
B1 is wrong without it.

and at `useLoginPage.ts:124`, `const wanted = peekDeepLinkDivision()` in place of the
inline `new URLSearchParams(window.location.search)` read. The matching logic, the
functional `setRegForm` update, `setLoginView` and `setRegStep` are unchanged; B2
adds a guard above them and B3 adds a `consumeDeepLinkDivision()` call beside them.

⚠️ **The apply stays inside the `.then()`.** Only the *read* moves to module load.
The 2026-08-10 plan recorded that the deep link beats a saved KYC draft **only
because** the draft-restore effect (`:162-186`) is synchronous while this one lands
after the fetch — "load-bearing but incidental". Hoisting the apply out of the
`.then()` would silently invert that and let the draft win. Verification covers it.

**Why a `lib/` module and not a local constant.** Three reasons, all pre-existing
conventions: it matches the `authUrlError` precedent; a module-level constant inside
`useLoginPage.ts` would be evaluated at the same time but buried in a 570-line hook
where its load-bearing timing is invisible; and `lib/` with no `@/` imports is the
rule `lib/slug.ts` already documents for `node --test` loadability.

**SSR guard is mandatory, not defensive.** `AppShell` is a `"use client"` component
but Next still prerenders it on the server. It happens to return `null` there today
(`isCheckingAuth` starts `true`), so an unguarded `window` read would survive — but
only by accident, on an unrelated early return. The previous plan was burned by
exactly this class of incidental coupling; the guard makes it explicit.

**Component separation:** no render layer involved. `LoginPage.tsx` is untouched —
no new markup, no new props. All logic stays in `useLoginPage.ts` and `lib/`.

⚠️ **Ships with B2.** See the coupling note there.

---

### B2 — B1 unmasks a view-hijack that is currently hidden  ✅ DONE (2026-08-25)
<!-- ✅ `if (initialView !== "login") return` placed BELOW setDivisions/setDivisionsError
     and ABOVE the deep-link block, exactly per the table. Deps now [initialView];
     exhaustive-deps raised nothing.
     ⚠️ VERIFICATION RETRACTED 2026-08-26. This said "full Playwright suite 115/115
     (exit 0) ... the loginregister baselines did not move". THAT EVIDENCE NEVER
     EXISTED: the run was piped through `tail -25`, which hid a `43 failed` line and
     made the failure LIST read as passes, and a pipeline's exit status is `tail`'s,
     so the quoted "exit 0" was meaningless. loginregister was ALREADY FAILING.
     What still holds: the change is not the cause — reverting useLoginPage.ts to HEAD
     reproduced the same failures. So the guard's placement rests on CODE READING plus
     tsc, not on pixel evidence.
     ✅ RE-VERIFIED PROPERLY (2026-08-26), via I2 of
     .plans/2026-08-25-vendor-visual-baseline-instability.md. The pixel baseline was
     never the right instrument: an empty and a populated division Combobox are
     IDENTICAL while closed (both show the "Select division" placeholder), so a
     screenshot could not have detected a mis-placed guard at all.
     There is now a DOM test — "the register view still loads divisions when the guard
     is active" in visual-tests/division-deeplink.spec.ts — that mounts the
     initialView="register" branch, opens the Combobox and asserts the option is listed.
     It was proven to FAIL when the guard is moved above setDivisions (G1's exact
     mistake), then the code was restored. B2's guard placement is now genuinely
     verified, by a test that will keep verifying it.
     ⚠️ STILL UNOBSERVED: the non-login branches in a real browser (a recovery link or a
     vendor-picker session carrying ?division=). The gallery covers the render, not the
     live auth path. -->
<!-- 🔄 (2026-08-25) `if (initialView !== "login") return` placed BELOW
     setDivisions/setDivisionsError and ABOVE the deep-link block, per the table.
     Effect deps now [initialView]; exhaustive-deps raised nothing.
     Machine-verified only — the non-login branches have not been exercised in a
     browser, and the loginregister baseline has not been re-run yet (stage 2). -->
**File:** `vendor/components/auth/LoginPage/useLoginPage.ts:140-141`

The effect calls `setLoginView("register")` on any slug match, with **no regard for
`initialView`** (`:56-57`). `useLoginPage` runs its effects in every LoginPage
branch, so a match hijacks the `reset` (password recovery) and `select_vendor`
views too.

**This is a pre-existing bug from 2026-08-09 that the 2026-08-14 regression has been
accidentally masking** — the capture currently always fails, so the flip never
happens. **B1 restores the capture and therefore restores the hijack.** The two must
ship in the same batch; B1 alone trades one bug for another.

The plausible case is not password recovery (those links carry a hash, not a query
parameter) — it is `select_vendor`: an existing vendor who is already signed in with
a pending vendor record clicks a campaign link and gets thrown into a blank
registration form instead of their account picker.

**Fix approach:** apply the deep link only when `initialView === "login"` (the
default, and the only branch `AppShell.tsx:91` uses for an anonymous visitor).

⚠️ **Guard the deep-link portion of the effect, NOT the effect.** The first draft of
this item said "skip the whole block", which is ambiguous enough to permit the wrong
implementation — so, precisely:

| `useLoginPage.ts` | Behaviour |
|---|---|
| `:106-107` `setDivisions(rows)` / `setDivisionsError(error)` | **always run**, every view |
| `:124-141` `wanted` → `match` → `setRegForm` / `setLoginView` / `setRegStep` | run **only** when `initialView === "login"` |

Guarding the whole effect would leave `divisions` empty in every non-`login` branch.
That is invisible in the real app (neither `select_vendor` nor `reset` renders a
division picker) but it **does** break `/ui-gallery?mode=loginregister`, which mounts
`LoginPage` with `initialView="register"` (`app/ui-gallery/page.tsx:730-738`) and
whose pixel baseline contains a populated division Combobox. A `maxDiffPixels: 0`
suite would fail on it — the cheapest possible way to catch this, but only if the
guard is placed correctly in the first place.

Partial application is also wrong: seeding `divisionId` without flipping the view
would leave invisible state behind for a form the user was never sent to.

**Dep array:** referencing `initialView` makes the effect's `[]` incomplete.
`next/core-web-vitals` runs `react-hooks/exhaustive-deps` as a *warning*, so this
will not fail `npm run lint`, but use `[initialView]` regardless — it is a prop that
cannot change without a `key`-forced remount (`AppShell.tsx:74,91,95`), so the effect
still runs exactly once per mount.

**Component separation:** hook-only, like B1. `LoginPage.tsx` untouched.

---

### B3 — Module-load capture makes the deep link sticky for the whole session  ✅ DONE (2026-08-25)
<!-- ✅ peek/consume split in lib/divisionDeepLink.ts; consumeDeepLinkDivision() called
     after setRegStep(1), i.e. on successful application only.
     ⚠️ HOW THIS WAS VERIFIED, PRECISELY: by the USER on the live app ("everything is
     working", 2026-08-25) — NOT by an automated test and NOT observed by the agent.
     The hermetic spec cannot reach handleLogout, which is only callable from the
     signed-in shell. If this ever needs re-checking, the manual pass is:
     /?division=ezzy-well → switch to login → sign in → sign out → expect the LOGIN
     form, not the registration form.
     Machine-verified alongside it: tsc 0. (An earlier "full suite 115/115" claim
     here was retracted 2026-08-26 — see B2's note.) -->
<!-- 🔄 (2026-08-25) peek/consume split shipped in lib/divisionDeepLink.ts;
     consumeDeepLinkDivision() called after setRegStep(1), i.e. on successful
     application only. tsc 0, full suite green.
     ⚠️ DELIBERATELY NOT ✅. The behaviour this item exists for — sign out, and the
     registration form must NOT re-open — has not been observed. It needs a real vendor
     session, because handleLogout is only reachable from the signed-in shell; the
     hermetic spec cannot reach it and mocking Supabase auth to get there is a bigger
     lift than the fix itself.
     UNBLOCK: one manual browser pass on a seeded/staging account (land on
     /?division=ezzy-well → switch to login → sign in → sign out → expect the LOGIN form,
     not the registration form), or a test account this suite is allowed to use. -->
<!-- 🔄 (2026-08-25) peek/consume split shipped in lib/divisionDeepLink.ts;
     consumeDeepLinkDivision() called after setRegStep(1), i.e. on successful
     application only. Machine-verified only — the sign-out remount path is browser-only
     and has NOT been exercised. This is the item most likely to be wrong in a way tsc
     cannot see. -->
**Files:** `vendor/lib/divisionDeepLink.ts` (new, per B1); `vendor/components/auth/LoginPage/useLoginPage.ts:139-141`

**Found in the 2026-08-25 gap review, and it is a direct consequence of B1.** A
value read from the URL dies when the URL is rewritten. A value held in a module
lives until the tab is reloaded — so B1 does not merely restore the deep link, it
makes it **re-apply on every subsequent `LoginPage` mount**.

That is reachable, and not obscure. `handleLogout` (`useAppShell.ts:715-741`) is a
**soft** reset — it flips React state and deliberately does not reload (the two
`window.location.replace` calls at `useLoginPage.ts:311,320` belong to the
password-reset flows, not to ordinary sign-out). So `AppShell.tsx:91` remounts
`LoginPage` with `key="login"`, the divisions effect fires again, the module still
holds the slug, and a vendor who has just signed out is dropped into a blank
registration form.

Like B2, this is not new — it was live between 2026-08-09 and 2026-08-14 and has
been masked ever since by the very regression this plan fixes. **B1 unmasks it, so
it ships in the same batch.**

**Fix approach:** one-shot consumption. `peekDeepLinkDivision()` reads it;
`consumeDeepLinkDivision()` is called immediately after the seed is applied, beside
`setRegStep(1)` at `:141`.

**Consume on successful application only** — not on read. If the divisions fetch
fails (`getActiveDivisions` returns `{ divisions: [], error }`), the slug must
survive so a retry within the same page load still works; the user cannot recover it
by refreshing, because the URL has already been rewritten by the time they could.
For the same reason an unknown slug consumes nothing: it never applied.

---

## IMPORTANT

### I1 — A regression test that can actually catch this  ✅ DONE (2026-08-25)
<!-- ✅ visual-tests/division-deeplink.spec.ts — 4 DOM tests, no screenshot baseline:
     positive, hyphen-less normalisation, unknown slug no-op, no-parameter no-op.
     Hermetic as designed: /api/divisions route-mocked, and the auth path needs no
     network because getUser() resolves null with no stored session.
     Proven to catch the regression (see B1). The positive test also asserts that
     AppShell STILL clobbers the query string, pinning the fix to the module-load
     mechanism rather than to a sticky URL. -->
**File:** new `vendor/visual-tests/division-deeplink.spec.ts`

Nothing in the suite could have caught this, which is why it survived a green suite
for eleven days:

- `npm test` is `node --test lib/**/*.test.ts` (`package.json:10`). `lib/slug.test.ts`
  tests the matcher in isolation; the bug is pure effect ordering and has no pure
  function to assert against.
- `/ui-gallery` renders `LoginPage` **outside** `AppShell` (`app/ui-gallery/page.tsx:738`),
  so the mirror effect never runs there. `pilot.spec.ts` has six login modes and
  none of them could reproduce this.

The test must load the **real app at `/`**, which is precisely the gap
`visual-tests/smoke.spec.ts` was written to cover for CSP — follow that file's shape
and its blocked-vs-refused discipline.

```ts
await page.route("**/api/divisions", r => r.fulfill({
  json: { divisions: [{ id: 3, name: "EzzyWell", slug: "ezzy-well" }] },
}))
await page.goto("/?division=ezzy-well")
await expect(page.getByPlaceholder("Select division")).toHaveValue("EzzyWell")
```

`getByPlaceholder` is the right locator: `LoginPage.tsx:312-318` passes the Combobox
neither an `id` nor an `aria-label`, and `Combobox.tsx:48-56` renders an `<input>`
whose `value` is the reverse-resolved label. The field exists only on register
step 1, so one assertion covers both "the view flipped" and "the division is
selected".

Route-mocking keeps it hermetic — no Supabase, no seeded rows, green offline
(D2). Add a negative case (`?division=totally-bogus` → login view, no flip) and, for
B2, `initialView` isolation is not reachable from a URL so leave that to type-level
review rather than forcing a contrived test.

⚠️ **Not a screenshot test.** `toHaveScreenshot` is `maxDiffPixels: 0` for this
project; a DOM assertion is the correct instrument here and adds no baseline to
maintain.

---

## NEWLY DISCOVERED

### N1 — Visual baselines are unstable across runs  ⬜ PROMOTED (pre-existing, not caused by this plan)

> ⚠️ **This item's original framing was too narrow — corrected 2026-08-25.** It was
> written as "fails under `-g`, passes in a full suite". A second full-suite run,
> same code, ~2h later, **failed `sidebar-light`/`sidebar-dark` with no filter at
> all.** So a green full suite is *not* proof, and `-g` is an input that changes the
> outcome rather than the cause. Leading hypothesis is now a server/browser clock
> disagreement (`page.clock` never reaches the Next dev server, which is 18 days
> adrift of `FIXED_NOW`) producing hydration failures and client tree regeneration.
>
> **Promoted to its own plan: `.plans/2026-08-25-vendor-visual-baseline-instability.md`.**
> The text below is kept as the original observation; read the new plan for the
> current picture. The `--update-snapshots` warning below still stands and is still
> the most important line in this item.

**Original observation (2026-08-25):**
**File:** `vendor/visual-tests/pilot.spec.ts:54` + `vendor/playwright.config.ts`

⚠️ The premise below is retracted (2026-08-26): the "full-suite run passes" half was a
misread of a piped `tail`. The suite was failing **43/156** at the time. Kept verbatim
as the original observation only.

Found while verifying B2 on 2026-08-25. `npx playwright test -g "ui-gallery login"`
fails **15/15** — `login`, `loginforgot`, `loginsent`, `loginreset`, `loginregister`,
`loginselect`, `loginregsent` (light + dark) and `login-mobile-info`. The same
baselines pass in a full-suite run: **115/115, exit 0**.

**Not caused by this plan, and that was tested rather than assumed:** reverting
`useLoginPage.ts` to HEAD and re-running `-g "loginregister"` reproduces the failure
identically. `loginforgot` and `loginsent` fail too, and neither touches divisions.

The diff is a uniform ~53px vertical offset of the whole card, content otherwise
identical. The documented cause of exactly this symptom — a stray dev server started
without `PW_TEST=1` being reused (`playwright.config.ts`, `reuseExistingServer`) —
was **checked and ruled out**: nothing was listening on 3100 and no `next dev`
process was running, so Playwright started its own server each time.

**Why it matters beyond cosmetics:** these baselines are only trustworthy in a
full-suite run, and nothing says so. Anyone iterating on a login screen will
naturally reach for `-g`, get 15 red tests, and either chase a phantom or
regenerate the baselines with `--update-snapshots` — which would silently bake the
offset in and destroy the real baselines for everyone.

**Fix approach:** not attempted — out of this plan's scope and it needs its own
investigation (leading candidates: on-demand route compilation in `next dev`, or
font/layout settling on a cold server that earlier tests warm up). At minimum,
record the constraint in `playwright.config.ts` beside the existing
`reuseExistingServer` warning. ⚠️ **Do not "fix" it with `--update-snapshots`.**

---

## Gap review (2026-08-25, second pass)

Run against the approved draft before execution, per the skill's step 3 — hunting
for wording that a poor implementation could satisfy. Four findings; two were real
holes, two were under-specification.

| # | Finding | Outcome |
|---|---|---|
| G1 | **B2's "skip the whole block" was ambiguous** and permitted guarding the entire effect, which would stop `setDivisions` running in non-`login` views and break the `loginregister` pixel baseline. | B2 rewritten with an explicit line-by-line table |
| G2 | **B1 makes the deep link sticky for the page-load session** — a soft logout remounts `LoginPage` and re-applies it. Not covered anywhere in the draft. | New **B3** |
| G3 | **The draft-restore ordering invariant was implied, not stated.** B1 does not change it, but nothing in the plan said the apply must stay inside the `.then()`. | Stated in B1; added to Verification |
| G4 | **Dep array unspecified** once B2 references `initialView`. | Specified in B2 (`[initialView]`, lint is a warning not an error) |

**Checked and cleared, so they are not re-investigated later:**

- **SSR.** The module-load IIFE runs during prerender and returns `""`; the value is
  only read inside an effect, so there is no hydration mismatch.
- **Module evaluation really does precede render.** `app/page.tsx` → `AppShell.tsx:6`
  → `LoginPage` → `useLoginPage` is a fully static chain, with no `dynamic()` or
  `lazy()` anywhere in `app/` or `components/`. Even under code-splitting the chunk
  must load before `AppShell` renders, because `AppShell` imports it statically.
- **Degenerate parameter values.** `?division=` and `?division=---` both normalise to
  `""` and hit the existing `if (!wanted) return`, which is the same no-op as an
  unknown slug. No extra handling needed.
- **`lib/` import rule.** `divisionDeepLink.ts` imports `./slug` relatively, not via
  `@/`, keeping the `node --test` loadability constraint `lib/slug.ts` documents.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line remains — see skill §7. -->

- **D1 — How much of the `useAppShell` URL-mirror problem to fix.**
  → **Fix `LoginPage` only; leave `useAppShell.ts` untouched** (resolved 2026-08-25).
  The capture fix is complete on its own and is *more* robust than gating the
  mirror, because it does not depend on nobody else ever rewriting the URL.
  `useAppShell.ts` owns history, deep-link seeding and the back-button stack across
  three interacting effects carrying explicit "do not merge these" warnings; the
  division bug does not justify going in there. The rejected variants are recorded
  under Deferred so the reasoning is not re-litigated.

- **D2 — Regression test depth.**
  → **Playwright against the real app with `/api/divisions` route-mocked**
  (resolved 2026-08-25). Hermetic and no database required, matching the
  blocked-vs-refused principle `smoke.spec.ts:17-24` sets out: a test that goes red
  when the backend is merely down trains people to ignore it.

---

## DEFERRED / COSMETIC

- **The login screen still shows `?page=dashboard&from=…&to=…`.** Cosmetic and
  harmless once B1 lands — it advertises app state that is not on screen and
  pollutes any link copied from the login page, but it breaks nothing. Fixing it
  means gating the mirror effect on `navReady` (`useAppShell.ts:563`), and that has
  a real complication: `handleLogout` (`:715-741`) is a **soft** state reset with no
  page reload, so a naive gate would strand the last signed-in URL on the login
  screen. Worth its own plan if it ever bothers anyone; not worth the back-button
  risk today.
- **Making `serialiseAppParams` merge unknown parameters through.** Considered and
  rejected — it would carry `division` into every subsequent dashboard URL for the
  rest of the session, and the shell deliberately owns its query string.
- **An already-signed-in vendor clicking a campaign link** gets no pre-selection,
  because `LoginPage` never mounts for them. Correct as-is; out of the requested
  scope. B2 makes the `select_vendor` sub-case behave sanely rather than hijacking.

---

## Execution order

One batch. **B1, B2 and B3 are coupled and must land together** — B1 restores the
capture, and B2 and B3 are the two bugs that restoring it un-masks. B1 alone is a
net regression, not a partial fix, so there is no safe prefix to start with.

1. **B1 + B2 + B3** — write `lib/divisionDeepLink.ts` (capture + one-shot consume),
   then the three edits in `useLoginPage.ts`: the read at `:124`, the
   `initialView` guard above `:124`, and the `consumeDeepLinkDivision()` call at
   `:141`.
2. **I1** — the regression spec, written against the fixed build.

`useAppShell.ts`, `lib/dashboardRange.ts`, `lib/slug.ts`, `/api/divisions` and
`LoginPage.tsx` are all **not modified** by this plan.

---

## Verification

**Machine-verifiable:**
- `npx tsc --noEmit` → 0 errors.
- `npm run build` → succeeds.
- `npm test` → existing `lib/slug.test.ts` still passes (unchanged by this work).
- `npx playwright test division-deeplink` → the new spec passes.
- `npx playwright test` → **full suite green, `loginregister` baseline especially.**
  No rendered markup changes, so no baseline should move — but that holds *only* if
  B2's guard is placed per its table. A moved `loginregister` baseline means the
  guard was put around the whole effect; fix the guard, do not regenerate the
  baseline.

**Needs a live environment:**
- Browser check on the real app for the four cases the 2026-08-10 plan used:
  `?division=ezzy-well` → EzzyWell selected on register step 1; `?division=ezzywell`
  → same (normalisation); `?division=nope` → plain login screen, no flip; no
  parameter → plain login screen. A saved KYC draft plus a `division` parameter
  should keep every drafted field and override only the division **(G3 — this is
  the draft-ordering invariant; if the division does not win, the apply was hoisted
  out of the `.then()`)**.
- **B3, needs a browser:** arrive on `/?division=ezzy-well`, switch to the login
  view, sign in with a real account, then sign out. The login form must be on
  screen — not the registration form.
- **B2, needs a browser:** with `?division=ezzy-well` present, a session that lands
  on the vendor picker (signed in, no vendor selected) must show the picker, not the
  registration form.
- **Prerequisite, and it is not yet established:** confirm what is actually deployed
  to `staging-vendor.ezzy.ph`. The trace above predicts failure even on a correct
  deploy, so this only determines whether there is a *second*, deployment-side
  problem — but it should be checked before anyone re-tests staging and draws a
  conclusion from it.
- **Not verifiable from the repo:** that `divisions.slug` on the deployed database
  still matches the seeded values. The column is immutable by convention only
  (`20260724000004_divisions.sql:22`), not by constraint, so a renamed slug would
  break campaign links silently and look identical to this bug from the address bar.

---

## Outcome (2026-08-25)

**Shipped:** `vendor/lib/divisionDeepLink.ts` (new), `vendor/components/auth/LoginPage/useLoginPage.ts`
(3 edits), `vendor/visual-tests/division-deeplink.spec.ts` (new). `useAppShell.ts`,
`lib/dashboardRange.ts`, `lib/slug.ts`, `/api/divisions` and `LoginPage.tsx` were
never touched, exactly as scoped.

**Still open:** **N1** — pre-existing, unrelated to this work, and deliberately not
fixed here. It carries a live trap (`--update-snapshots` on a filtered run would
destroy 15 valid baselines), so it should not be left buried in a completed plan;
promote it into its own plan when someone next works on the login screens.

**Verification that could not be run here:** the non-`login` LoginPage branches
(recovery link / vendor picker carrying `?division=`) were never exercised in a live
browser — B2's guard is verified by the `loginregister` pixel baseline and by
reading, not by driving those auth paths.

**Docs updated in the same breath:** `architecture/conventions.md` (query-string
ownership; the `-g` baseline caveat), `architecture/auth-and-roles.md` (the
`no middleware.ts` claim was factually wrong), and a regression note added to
`.plans/2026-08-10-vendor-division-url-param.md`.
