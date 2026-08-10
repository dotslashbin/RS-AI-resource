# CSP blocks every Supabase call from the browser

**Date:** 2026-08-08
**App / scope:** `vendor/next.config.ts`, `command/next.config.ts`
**Status:** 🔄 **IN PROGRESS — B1 ✅ and I3 ✅, both verified against a live
browser.** Both portals sign in again, and the visual suite is deterministic across
dates (61/61 on two consecutive runs, with the real date now two days past the
baseline). Two follow-ups remain: **I1** (no smoke test can catch a backend
outage — this is the gap that let B1 reach the user) and **I2** (booker, when it
gets a CSP). No decisions open.

> A regression introduced by **A-B7** in
> `.plans/2026-08-07-vendor-signup-production-preparations.md` (security headers,
> 2026-08-08). Both portals are **completely unusable against a local Supabase**:
> nobody can sign in, no query runs, Realtime never connects, and the new
> registration upload cannot reach Storage.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important. Numbers are plan-local.

---

## Scope

**In scope:** the `connect-src` directive in the two apps that have a CSP.

**Out of scope:** every other CSP directive (they are correct and verified),
`booker` (has no CSP — see I2), and anything else in the sign-up plan.

---

## What the problem actually is

`TypeError: Failed to fetch` from `signInWithPassword` is the browser reporting a
**CSP violation**, not a network or auth failure. The fetch never left the page.

The directive shipped in A-B7, identical in both apps
(`vendor/next.config.ts:41`, `command/next.config.ts:40`):

```
connect-src 'self' https://*.supabase.co wss://*.supabase.co
```

Both apps point at a **local** Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
```

That origin matches none of the three sources:

| Source | Matches `http://127.0.0.1:54321`? |
|---|---|
| `'self'` | ❌ — `'self'` is the *page's* origin (`localhost:3000`). Different host **and** different port, so a different origin |
| `https://*.supabase.co` | ❌ — wrong scheme, wrong host |
| `wss://*.supabase.co` | ❌ — wrong scheme, wrong host |

So the browser blocks the request before it is sent, and `fetch` rejects with the
generic `TypeError: Failed to fetch`. **The error names `signIn` only because that
is the first Supabase call the app happens to make** — every other one is blocked
identically.

### Everything this breaks, not just sign-in

- **All authentication** — `signIn`, `resetPassword`, `updatePassword`, session refresh.
- **Every database query** in both portals, via `@supabase/supabase-js`.
- **Realtime** — `useAppShell.ts` in both apps opens a `ws://127.0.0.1:54321` socket.
- **⚠️ The new registration flow (A-B1).** `uploadToSignedUrl`
  (`vendor/services/kyc.service.ts:159-161`) posts directly to the Supabase origin,
  so the direct-to-Storage upload is blocked by exactly the same rule. The three-hop
  flow cannot complete locally at all.

### Does this affect production?

**Probably not, and that is what makes it dangerous.** A hosted project URL —
`https://<ref>.supabase.co` — *does* match the wildcard, so the bug is invisible in
any environment that uses hosted Supabase. It breaks local development completely
while looking fine in production, which is the worst shape for a defect to have.
It would also break the moment a custom Supabase domain was configured.

### Why nothing caught it

Three checks passed with the app fully broken, and each was blind for a different
reason — recorded so the gap is not mistaken for bad luck:

- `tsc` and `next build` — a CSP is a runtime response header; nothing about it is
  statically checkable.
- **61/61 Playwright.** `/ui-gallery` renders components against **mock props and
  makes no Supabase calls**. The harness has zero coverage of anything that talks
  to the backend, so a total backend outage is invisible to it. See **I1**.
- My own CSP probe during A-B7 loaded `/ui-gallery?mode=grid` and read the console.
  Same blind spot: that page makes no Supabase calls, so there was nothing to block
  and the console was clean. **I verified the headers were present and concluded
  they were correct — those are different claims.**

---

## BLOCKERS

### B1 — `connect-src` excludes the configured Supabase origin  ✅ DONE (2026-08-08)

> **Executed and verified in a browser, not just by header inspection** — the
> distinction that let the original bug through.
>
> | Check | Result |
> |---|---|
> | Emitted header, both apps | `connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321` |
> | Browser fetch reaches Supabase | ✅ HTTP 400 from the auth endpoint — **delivered and rejected**, not blocked. A CSP block gives `TypeError: Failed to fetch` |
> | Real sign-in, `command` (`root@bookdeck.com`) | ✅ lands in the Back Office shell, 0 console errors |
> | Real sign-in, `vendor` (`jose@bookdeck.com`, vendor-admin) | ✅ lands in the Vendor Portal shell, 0 console errors |
> | CSP violations / failed requests during either | ✅ zero |
> | `tsc` both apps · `npm test` vendor | ✅ 0 · 39/39 |
>
> **🐛 A bug in the first version of this fix, caught before it shipped.**
> `origin.replace(/^http/, "wss")` turns `https://x` into **`wsss://x`** — the `s`
> from `https` is left behind. Local was fine (`http` → `ws`), so it would have
> broken Realtime **only in production**: the same "works locally, wrong in prod"
> shape as the defect this plan exists to fix. Now matches `/^https?/`, and all five
> branches were exercised directly (local, hosted, custom https domain, unset,
> unparseable).
>
> ⚠️ **The `NEXT_PUBLIC_SUPABASE_URL`-unset path could not be tested via the shell.**
> `env -u` has no effect because Next loads `.env.local` itself, so the build never
> saw it missing. The branch was verified by running the function standalone
> instead — which is weaker evidence about the *build*, and is why this row is not
> claimed as a build-level check.
**Files:** `vendor/next.config.ts:41`; `command/next.config.ts:40`

The directive hardcodes `https://*.supabase.co` instead of allowing the origin the
app is actually configured to talk to.

**Fix approach — derive the origin from `NEXT_PUBLIC_SUPABASE_URL`.**

Both configs already read `process.env`, so this needs no new plumbing:

```ts
// Derive the exact Supabase origin from the URL the client is built against, so
// the CSP can never disagree with the app's configuration. Covers local
// (http://127.0.0.1:54321 + ws://…) and hosted (https://<ref>.supabase.co + wss://…)
// with the same code, and is TIGHTER than a wildcard in production: it pins this
// one project rather than allowing every project on supabase.co.
function supabaseConnectSrc(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) {
    console.warn("[next.config] NEXT_PUBLIC_SUPABASE_URL is unset — CSP falls back to the supabase.co wildcard.");
    return "https://*.supabase.co wss://*.supabase.co";
  }
  try {
    const { origin, protocol } = new URL(raw);
    // Realtime uses ws: for an http origin and wss: for https.
    const ws = origin.replace(/^http/, protocol === "https:" ? "wss" : "ws");
    return `${origin} ${ws}`;
  } catch {
    console.warn("[next.config] NEXT_PUBLIC_SUPABASE_URL is not a valid URL — CSP falls back to the wildcard.");
    return "https://*.supabase.co wss://*.supabase.co";
  }
}
```

and then:

```ts
`connect-src 'self' ${supabaseConnectSrc()}`,
```

**Duplicated in both apps, deliberately** — `conventions.md` → "No Shared Code
Between Apps", the same rule the rest of the header block already follows.

**Why not the alternatives:**
- *Add `http://127.0.0.1:54321` to the existing list.* Hardcodes a port, keeps the
  loose wildcard in production, and leaves two sources of truth to drift.
- *Only widen in development.* Same drift, plus it hides the fact that the
  production directive is looser than it needs to be.

**Behaviour on a missing env var:** warn and fall back to the wildcard rather than
failing the build. A missing URL already breaks the app at the client-construction
step (`lib/supabase/client.ts:8` asserts it with `!`), so failing the *build* adds
noise without adding information — but a silent CSP change would be invisible, so
it warns.

<!-- verification: needs a live environment — sign in against local Supabase in both apps -->

---

## IMPORTANT

### I1 — The visual harness cannot catch a backend outage  ⬜ TODO
**Files:** `vendor/app/ui-gallery/page.tsx`; `vendor/visual-tests/pilot.spec.ts`

This is *why the bug reached you*. `/ui-gallery` exists to render components in
isolation against mock props, deliberately — that is the right design for pixel
baselines. The consequence is that **61 passing tests say nothing about whether the
app can reach its database.**

Not arguing the fixture should change. The gap is that there is no check at all in
the other direction, so the cheapest useful thing is one smoke test that loads `/`
and asserts the browser recorded **no CSP violation and no failed request** — it
would have caught this in seconds, and would catch any future header change.

**Fix approach:** a single Playwright test, separate from the snapshot suite, that
loads `/`, listens for `console` errors and `requestfailed`, and fails on either.
It needs no database — a *blocked* request and a *refused* one look different, and
only the first is a CSP problem.

**Component separation:** test-only, no components involved.

### I3 — Four snapshots embed "today" and therefore rot every day  ✅ DONE (2026-08-10)

> `page.clock.setFixedTime()` before every `goto` in `visual-tests/pilot.spec.ts`,
> pinned to `2026-08-08T04:00:00Z` (= noon in Manila). Baselines regenerated.
>
> **Proved, not assumed** — the same page rendered twice, one run per clock:
>
> | | Rendered date |
> |---|---|
> | clock frozen | **08 Aug 2026** |
> | real clock | **10 Aug 2026** |
>
> And the decisive part: **the real date has now advanced two days past the
> baseline** (baselines hold 08 Aug; today is 10 Aug in Manila) and the suite is
> **61/61 on two consecutive runs**. Before this fix, a *one*-day advance was enough
> to fail `dashboard` and `bookings` in both themes. The drift is gone at the source.
>
> Neat corroboration: `dashboard-light`'s baseline file was **not rewritten** by the
> regeneration — freezing to 08 Aug reproduces the original 08 Aug image byte for
> byte, so Playwright left it alone.
>
> Verified: `tsc` clean; Playwright 1.61.1 (clock API added in 1.45).
**Files:** `vendor/app/ui-gallery/page.tsx`; `vendor/visual-tests/pilot.spec.ts`

`dashboard-light`, `dashboard-dark`, `bookings-light` and `bookings-dark` render the
**current date** — the dashboard's "Today's Schedule" card shows `08 Aug 2026`, and
bookings shows dated rows. The baselines were regenerated on 2026-08-08; the suite
now fails on 2026-08-09 with 12–40 differing pixels, confined to the date digits.

**Not caused by the CSP change** — verified by opening the diff: the only marked
region is the day-of-month glyphs. Regenerating would make it pass today and fail
again tomorrow, so the baselines were **deliberately not regenerated**.

The trigger is the **Asia/Manila** boundary, not UTC midnight: at the time of the
run it was `2026-08-09 21:49` in Manila and `13:49` UTC. Anyone running the suite
will see it flip at 16:00 UTC.

**Fix approach:** freeze the clock for the snapshot tests rather than re-baselining
on a schedule — `page.clock.setFixedTime()` before `goto`, or a fixed date injected
into the gallery fixture. Either makes the four screens deterministic; the second
is closer to how the fixture already supplies mock props. Then regenerate once.

**Component separation:** test/fixture only.

### I2 — `booker` will reproduce this exactly when it gets a CSP  ✅ DONE (2026-08-10) — note written; the CSP itself is LR-B7's booker arm
**File:** `booker/next.config.ts` (no CSP today)

`booker` was left out of A-B7 because it is not deploying (D4), so it is unaffected
now. When `LR-B7`'s booker arm is picked up, copying the wildcard would reintroduce
this bug verbatim — and booker additionally needs the Leaflet tile host and
`api.paymongo.com` in its own directives.

**Fix approach:** note in `LR-B7` that `connect-src` must be derived, not copied.
No code change now.

> ✅ **The note is written (2026-08-10)** — recorded on `LR-B7` in
> `.plans/2026-08-02-web-apps-production-launch-readiness.md`, and as a durable
> convention in `architecture/conventions.md` → "CSP `connect-src` must be derived,
> never hardcoded", which also captures the `^https?` / `wsss://` trap and the dev-only
> `'unsafe-eval'` requirement.
>
> **The premise changed, though.** This item assumed booker "is not deploying (D4)".
> booker is live at `booker.ezzy.ph` (v0.15.1) with **no CSP at all** — it is unaffected
> by *this* plan's bug only because it has no CSP to get wrong. The work moved to LR-B7's
> booker arm, which is reactivated. This item is closed as "note written"; it was never
> the thing that would give booker a CSP.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains. There are none. -->

- **How to allow the Supabase origin** → **derive it from
  `NEXT_PUBLIC_SUPABASE_URL`** (resolved 2026-08-08) — one source of truth, correct
  in every environment, and tighter than the wildcard in production. Not raised as
  a question because the alternatives are strictly worse, not different trade-offs.
- **Missing/invalid env var** → **warn and fall back to the wildcard** (resolved
  2026-08-08) — the app is already broken without the URL, so failing the build adds
  no information; the warning keeps the CSP change from being silent.

---

## DEFERRED / COSMETIC

- **`img-src` does not include the Supabase origin.** Checked and not needed: both
  apps open signed KYC document URLs with `window.open` in a new tab
  (`vendor/.../useKycStatusPage.ts:60`, `command/.../useKycPanel.ts:50`), which is a
  top-level navigation and not governed by the opener's CSP. Nothing renders a
  Supabase URL in an `<img>` or `<iframe>` (grepped). Revisit only if a document
  preview is ever embedded inline.

---

## Execution order

1. **B1** in both apps — one edit each, no dependencies.
2. Verify by hand (below). **This is the step that actually closes the item** — B1
   is not machine-verifiable.
3. **I1** smoke test, so the next regression of this shape is caught automatically.
4. **I2** is a note on another plan; do it whenever `LR-B7`'s booker arm is scheduled.

---

## Verification

| Item | How | Kind |
|---|---|---|
| B1 | Sign in to `command` and to `vendor` against local Supabase. Assert the console shows **no** CSP violation and the session is established | **needs live environment** |
| B1 | `curl -I` each app and confirm `connect-src` contains `http://127.0.0.1:54321 ws://127.0.0.1:54321` locally | machine-verifiable |
| B1 | Confirm Realtime connects — open the notification panel and assert the channel subscribes rather than erroring | needs live environment |
| B1 | **Run the full A-B1 registration** end to end: `prepare` → direct upload → `register`. This is the path the bug also broke, and the only way to prove the new flow works at all | needs live environment |
| B1 | Build with `NEXT_PUBLIC_SUPABASE_URL` unset and confirm the warning appears and the build still succeeds | machine-verifiable |
| I1 | The new smoke test fails when `connect-src` is deliberately broken, and passes when correct | machine-verifiable |

**Re-run after B1:** `npx playwright test` in `vendor` — expected to stay 61/61,
since the fixture makes no Supabase calls. That it *cannot* change is the point of
I1.
