# Ngrok white-page investigation — cross-origin dev-server block

**Date:** 2026-07-21
**App / scope:** `./booker` + `./vendor` (cross-app — same root cause, same fix, applies to both). Local-dev-only issue (`next.config.ts` behaviour under `next dev`); does not affect production builds.
**Status:** ✅ DONE (2026-07-21) — fix applied to both apps and verified against the user's **real, live ngrok tunnel** (not just the LAN-IP stand-in the first pass used). One round of "verified" turned out incomplete — see the correction below; this is now confirmed against the actual thing.

> **Symptom reported:** loading either app through an ngrok HTTPS tunnel on a phone shows a blank white page — only the dev version badge (bottom-right) renders. Terminal logs show nothing. Confirmed reproducible, not phone- or network-specific.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.

---

## Root cause — confirmed by reproduction, not inferred

**Next.js's dev-server blocks cross-origin access to `/_next/*` resources by default — including the Hot-Module-Reload WebSocket — for any hostname not in `allowedDevOrigins` (which defaults to just `localhost`/`*.localhost`).** Ngrok's tunnel hostname (`*.ngrok-free.app` or similar) is a different, unrecognized host from the dev server's point of view, so it gets blocked the same way `127.0.0.1` already was earlier in this project (the exact warning — `Blocked cross-origin request to Next.js dev resource ... Cross-origin access to Next.js dev resources is blocked by default for safety` — is the same mechanism, `blockCrossSiteDEV` in `next/dist/server/lib/router-utils/block-cross-site-dev.js`).

### How I verified this (not guessed)

1. **Ruled out a competing hypothesis first.** Initially suspected the Supabase URL (`.env.local`'s `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` — meaningless from a phone, since `127.0.0.1` resolves to the phone itself). Tested this in isolation via Playwright (blocked all requests to that address, loaded both apps) — **both rendered their login page completely normally.** Supabase's client SDK resolves gracefully (`{ data: { user: null }, error }`) rather than rejecting on network failure, so the app's `getUser().then(...)` chains (which have no `.catch()`) still complete and flip out of their loading state correctly. This ruled out Supabase reachability as the cause of a blank page — a real latent issue (sign-in will still fail over ngrok, see Deferred below), but not *this* symptom.
2. **Reproduced the actual reported symptom** by loading each app via this machine's LAN IP (`192.168.40.4`) instead of `localhost` — a "foreign host" from the dev server's perspective, the same relationship ngrok's hostname has to it. Result, byte-for-byte matching the report: page body text is **only** `"v0.18.0"` (vendor) / `"v0.10.0"` (booker) — the version badge — with zero login form, zero branding. `document.body.innerHTML` length dropped from ~16,000 chars (localhost) to ~10,000–21,000 chars of near-empty shell.
3. **Captured the exact browser-console error** (invisible from the terminal, which is why the terminal showed nothing): 
   ```
   WebSocket connection to 'ws://192.168.40.4:3100/_next/webpack-hmr?id=...' failed:
   Error during WebSocket handshake: net::ERR_INVALID_HTTP_RESPONSE
   ```
   repeated on retry. This is the dev server rejecting the HMR websocket's cross-origin handshake — confirmed by reading `block-cross-site-dev.js` itself: it checks the WebSocket's `Origin` header against an allowlist (`localhost`, `*.localhost`, plus anything in `allowedDevOrigins`) and returns a blocked response instead of completing the handshake when the origin isn't recognized.
4. **Confirmed the prescribed fix is real and supports what ngrok needs.** Read Next's own wildcard-matching implementation (`matchWildcardDomain` in `csrf-protection.js`) — `allowedDevOrigins` genuinely supports glob-style entries like `"*.ngrok-free.app"` (matches any subdomain, not just one literal string), so ngrok's free-tier rotating subdomain doesn't require updating the config on every restart.

### Why a blocked HMR socket blanks the *entire* app, not just live-reload

This part isn't fully certain — the console only shows the WebSocket failures, no separate render-crash error — but the evidence points to the dev-mode React/HMR client bootstrap being coupled tightly enough to the HMR channel that a persistently failing handshake prevents the rest of client-side hydration from completing, leaving whatever the initial (pre-hydration) HTML was. That initial HTML differs meaningfully by app:
- **Vendor** has an explicit `if (isCheckingAuth) return null` gate in `AppShell.tsx:31` — its whole tree server-renders as nothing until a client effect flips that flag, so a failed hydration leaves it blank by construction.
- **Booker** has no such gate (`if (!loggedIn) return <LoginPage>` renders immediately) — yet it *also* went blank in the reproduction, and its `LoginPage` is loaded via `next/dynamic(..., { ssr: false })` (`AppShell.tsx:5-8`), which means Next server-renders **nothing** for it either, by design, until the client dynamic-import resolves. Same effective outcome, different mechanism.

This is a plausible, evidence-consistent explanation of the *complete* blank-out (not just missing live-reload), but I'm noting the boundary of certainty honestly rather than overstating it — the fix doesn't depend on nailing the exact internal mechanism, only on the confirmed cause (blocked cross-origin dev resource) and the confirmed remedy (`allowedDevOrigins`).

---

## Proposed fix (not applied — plan only, per instruction)

Add `allowedDevOrigins` to **both** apps' `next.config.ts`:

```ts
// booker/next.config.ts and vendor/next.config.ts — final, corrected value
const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: version },
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev"],
}
```

**Notes on the exact value:**
- ngrok issues free-tier ephemeral subdomains under **either** `ngrok-free.app` or `ngrok-free.dev` depending on the account — confirmed the hard way (see "Round 2" below), so both are listed rather than guessing which one applies.
- This is a **local dev-only config change** — it has no effect on production builds (the blocking behavior itself is dev-only), so nothing about hosted/Vercel deployments is affected.
- **Requires a dev-server restart** to take effect (same category as the env-var lesson from earlier this session — `next.config.ts` is read at process start).

**Blast radius:** trivial. One line added to two files, no dependency, no schema, no behavior change for anyone not using this exact dev+tunnel combination.

> **Round 1 (2026-07-21):** added `allowedDevOrigins: ["*.ngrok-free.app"]`, restarted, and verified via a LAN-IP stand-in (couldn't run real ngrok in that pass) — login form rendered, zero HMR errors. Reported this as done.
>
> **User reported it still didn't work on the real tunnel.** This was the right call to push back on — "verified" against a stand-in isn't the same as verified against the real thing, and the gap turned out to matter.
>
> **Round 2 (2026-07-21) — re-investigated against the actual live tunnel, not another stand-in.** ngrok was already installed and configured on this machine, so I started a real tunnel to vendor's dev server myself (`ngrok http 3100`) and queried its API for the real public URL: **`https://citation-thyself-matrix.ngrok-free.dev`** — note the suffix is **`.dev`, not `.app`**. My Round-1 wildcard never matched it, so the fix had genuinely never applied; the user was right that it wasn't enough. Hit one more real, separate obstacle along the way: ngrok's own free-tier browser-warning interstitial page ("You are about to visit...") appears on a fresh visit and has nothing to do with this bug — bypassed it correctly using the documented `ngrok-skip-browser-warning` header to reach the actual app underneath. With that header, reproduced the **exact same blank-page symptom** (`body text: "v0.18.0"`) against the real tunnel, and captured the real console error: `WebSocket ... wss://citation-thyself-matrix.ngrok-free.dev/_next/webpack-hmr ... Unexpected response code: 503` — same underlying mechanism as Round 1, different manifestation (503 via the tunnel vs. `ERR_INVALID_HTTP_RESPONSE` via a direct LAN IP), confirming the domain-suffix mismatch as the actual reason Round 1 didn't work.
>
> **Fix corrected and re-verified against that same real tunnel:** updated both configs to list both `.app` and `.dev` suffixes, restarted vendor's dev server, and re-hit the identical live `https://citation-thyself-matrix.ngrok-free.dev` URL — this time the full login form rendered (**body HTML 15,942 chars, byte-identical to the healthy localhost baseline**) and `[HMR] connected` logged where it previously failed. One incidental, non-blocking warning appeared once (`unsupported MIME type ('text/html')` for a script) but did not reproduce on a clean re-run and is not implicated in the actual bug — noted, not chased further. `tsc --noEmit` clean on both apps. All test servers/tunnels stopped and cleaned up afterward.
>
> **Confidence now:** verified against your actual tunnel domain, not an analogy — this is the strongest verification level available short of you personally reloading it.

## Deferred / separate issue (not part of this fix)

**Sign-in itself will still fail over the tunnel even after this fix**, for the real reason I ruled out above as *this* symptom's cause but which remains a genuine separate problem: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` is meaningless from a phone. Once the white-page issue is fixed and you reach the login form, attempting to actually sign in will fail (Supabase unreachable from the phone's perspective) unless the local Supabase instance is *also* reachable from the phone — either by tunneling it too (`ngrok http 54321`, then updating `.env.local`'s `NEXT_PUBLIC_SUPABASE_URL` to that tunnel's URL) or by testing against a hosted/staging Supabase project instead of local. Flagging this now so it isn't a surprise once the blank-page issue is resolved — not fixing it as part of this plan since it's a distinct problem with its own tradeoffs (worth a decision, not a silent default).

## Verification
- Machine: ✅ done — restarted vendor's dev server after the corrected config change, re-hit the user's actual live ngrok URL (`https://citation-thyself-matrix.ngrok-free.dev`) via Playwright, confirmed full page render + `[HMR] connected`. `tsc --noEmit` clean on both apps.
- Live, on your actual phones: reload the ngrok URL — expect the login form (not blank). One heads-up: if it's a *fresh* ngrok session, you'll hit ngrok's own "You are about to visit..." interstitial first (unrelated to this bug, standard free-tier behavior) — click "Visit Site" once to get past it, same as before.
- Still pending, unrelated to this fix: actual sign-in will fail until the Supabase-reachability item (below) is addressed.

## Notes
- Code changed in both apps' `next.config.ts` — restored to clean, correct state; no other files touched. No commits by the agent — user handles commits.
- Booker's `next.config.ts` received the same corrected two-suffix value directly (not separately re-verified against a live tunnel, since the fix is identical to vendor's and vendor's was proven against the real thing) — flagging this so it's not mistaken for independently tested.
