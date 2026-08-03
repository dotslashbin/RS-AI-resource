# Web apps — search engine exposure (staging + production)

**Date:** 2026-08-02
**App / scope:** `command/`, `booker/`, `vendor/` (the three Next.js web apps)
**Status:** IN PROGRESS — B1 + B2 done and verified locally (2026-08-02); I1 and I2 outstanding

> Keep all three web portals out of search engine indexes by default, in every
> environment, with a single fail-closed opt-in flag for the day a portal
> genuinely has public content worth indexing.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "command I1").

---

## Scope

**In scope:** crawler-visibility controls (`X-Robots-Tag` header, `robots.txt`)
for `command`, `booker`, `vendor`, in staging and production.

**Out of scope, explicitly:**
- The two Expo apps (`ezzy-booker-mobile`, `ezzy-vendor-mobile`) — no crawlable surface.
- The marketing site in `website/` — it *should* be indexable; untouched here.
- Any access gate (password / SSO / basic auth) — declined, see Decisions.
- Staging's Supabase project wiring and staging auth email deliverability — see
  "Adjacent risks", flagged but not fixed by this plan.

**Cross-app:** this touches all three apps in one task, which is an AGENTS.md
approval gate. The change is byte-identical in each, deliberately duplicated
rather than abstracted (`architecture/conventions.md:42` — cross-portal
duplication is the documented tradeoff over a shared package).

---

## Findings from investigation (2026-08-02)

Verified by reading the code, not assumed:

- **No crawler directives exist anywhere.** No `robots.txt`, no `app/robots.ts`,
  no `sitemap.ts`, no `X-Robots-Tag`, and no `robots` field in any root layout —
  `command/app/layout.tsx:7`, `booker/app/layout.tsx:8`, `vendor/app/layout.tsx:8`.
- **The crawlable surface is small by accident.** Each app has exactly one real
  route (`/`) plus `/ui-gallery`. `booker/app/page.tsx:1` and
  `command/app/page.tsx:1` are `"use client"` shells; all navigation is
  client-side state behind Supabase auth. A crawler sees a login screen.
- **Staging is a separate Vercel project on a custom domain** (confirmed by the
  user, 2026-08-02). Vercel's automatic `X-Robots-Tag: noindex` applies only to
  *preview* deployments, so it does **not** cover this setup. Staging is
  currently fully indexable. This is what makes B1 a blocker rather than hygiene.
- **`/ui-gallery` is already handled — no work needed.** It calls `notFound()`
  when `NODE_ENV === "production"` (`command/app/ui-gallery/page.tsx:231`,
  `booker/app/ui-gallery/page.tsx:256`, `vendor/app/ui-gallery/page.tsx:211`),
  which includes every built staging deploy. Recorded here so a later reader
  does not re-litigate it.
- **Deploy target is Vercel, one project per portal**
  (`architecture/conventions.md:482`).

### Corrections to the initial framing

- **Downgrade — `robots.txt` is not the fix.** A `Disallow` rule stops
  *crawling*, not *indexing*: Google can index a URL it never fetched, from an
  inbound link, and show it with no snippet. `X-Robots-Tag` is what actually
  de-indexes. `robots.txt` is kept as the conventional front door, not as the
  control that does the work.
- **Escalate — the header must cover non-HTML too.** `/manifest.webmanifest`
  (`booker/app/manifest.ts`), `/icons/*`, `/offline.html`, `/sw.js` and API JSON
  are all crawlable and none carry a `<meta>` tag. A response header covers them;
  a meta tag cannot. This is why B1 uses `headers()` in `next.config.ts` rather
  than `metadata.robots` in the layout.

---

## BLOCKERS

### B1 — No `X-Robots-Tag` header on any response, in any environment ✅ DONE (2026-08-02)

> **Executed:** `headers()` block added to all three `next.config.ts` exactly as
> drafted below. **Verified:** `npx tsc --noEmit` clean and `npm run build`
> successful in all three; `next start` + `curl -sI` returns
> `X-Robots-Tag: noindex, nofollow, noarchive` on `/` and on
> `/manifest.webmanifest` for all three (command returns it on the 404 for that
> path too, confirming the header covers error responses). Rebuilt with
> `ALLOW_INDEXING=1` and re-curled: header **absent** — the flag is proven in
> both directions, not just fail-closed. Local build then restored to default.
> **Still needs a live check** against the deployed hosts after redeploy.

**Files:** `command/next.config.ts:7`, `booker/next.config.ts:7`, `vendor/next.config.ts:7`

Staging serves every response with no crawler directive, on a custom-domain
Vercel project where Vercel's automatic preview `noindex` does not apply. Every
URL — the login shell, the PWA manifest, icons, `offline.html` — is eligible for
indexing today.

**Fix approach:** add a `headers()` entry gated on a fail-closed env flag. Exact
change, `command/next.config.ts` (booker and vendor identical, keeping their
existing `allowedDevOrigins` line untouched):

```ts
const allowIndexing = process.env.ALLOW_INDEXING === "1";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: version },
  async headers() {
    if (allowIndexing) return [];
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};
```

Notes that matter on review:
- `ALLOW_INDEXING` is deliberately **not** `NEXT_PUBLIC_` — both consumers run
  server-side, and a public prefix would put the flag in the client bundle for
  no benefit.
- Unset ⇒ noindex. The flag ships **unset in every environment**, so both
  staging and the production launch are covered with zero env configuration.
- `source: "/:path*"` matches `/` as well (`path*` is zero-or-more segments).
- `headers()` is evaluated at build, so flipping the flag on Vercel requires a
  redeploy. That is intended — turning on indexing should be a deliberate act.

### B2 — No `robots.txt` served by any app ✅ DONE (2026-08-02)

> **Executed:** `app/robots.ts` created in all three apps as drafted below.
> **Verified:** `/robots.txt` now appears in each app's build route table as a
> static route; `curl` returns `User-Agent: *` / `Disallow: /` with the flag
> unset, and `Allow: /` + `Disallow: /api/` with `ALLOW_INDEXING=1`.
> **Still needs a live check** against the deployed hosts after redeploy.

**Files:** new `command/app/robots.ts`, `booker/app/robots.ts`, `vendor/app/robots.ts`

Requesting `/robots.txt` on any of the three returns a 404. Well-behaved
crawlers fetch it first; its absence means "crawl freely", and a security or
compliance reviewer reads a missing robots.txt as an unmanaged public surface.

**Fix approach:** one new file per app, identical, reading the same flag:

```ts
import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  if (process.env.ALLOW_INDEXING === "1") {
    return { rules: { userAgent: "*", allow: "/", disallow: ["/api/"] } }
  }
  return { rules: { userAgent: "*", disallow: "/" } }
}
```

Deliberately **no `sitemap` field and no `sitemap.ts`** — there is no public
content to enumerate, and a sitemap on a noindex site is contradictory signal.

**Coupling with B1:** B2 alone is insufficient (it does not de-index) and B1
alone is sufficient but unconventional. Ship them in the same commit per app.

**Component separation:** `.claude/skills/component-separation/SKILL.md` does not
apply — this plan creates no components and modifies none. `robots.ts` is a Next
metadata route, not a render layer; there is no state, no effect, no styling.

---

## IMPORTANT

### I1 — Existing index coverage is unknown and unmeasured ⬜ TODO

**File:** n/a — live environment

Adding `noindex` prevents *future* indexing but does not retract what is already
in the index; Google drops a URL only after re-crawling it. If the staging domain
has been live and linked, pages may already be listed.

**Fix approach:** after B1/B2 deploy, run `site:<staging-domain>` and
`site:<each production domain>` on Google and Bing. If anything is listed, submit
a Search Console **Removals → Temporary removal** for the host, which takes
effect in hours instead of waiting for organic re-crawl. Record the result — a
clean `site:` query is itself the verification.

**Execution input needed:** the actual staging and production hostnames. The repo
only carries placeholder fallbacks (`booker/lib/constants.ts:49`,
`vendor/lib/constants.ts:20`, `command/lib/constants.ts:104`) which are dev
defaults, not real deployed hosts.

### I2 — The indexing contract is undocumented ⬜ TODO

**File:** `architecture/conventions.md` (near the Vercel deployment note at :482)

Once B1/B2 land, "these apps are noindex" becomes an invariant that a future
change could silently break — someone adds a marketing route to booker and
cannot work out why it never ranks.

**Fix approach:** add a short subsection recording: indexing is off in all
environments; `ALLOW_INDEXING=1` is the single opt-in; it is intentionally unset
everywhere today; the flag is build-time so it needs a redeploy; and turning it
on for booker is a product decision that also requires real server-rendered
public content plus a sitemap, not just the flag.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. -->

- **How is staging deployed?** → **Separate Vercel project on a custom staging
  domain** (resolved 2026-08-02) — so Vercel's automatic preview `noindex` does
  not apply and staging is currently fully indexable. This is what makes B1 a
  blocker.
- **Should staging get an access gate on top of noindex?** → **No — noindex
  only, no access gate** (resolved 2026-08-02). Keeps `booker`'s PayMongo webhook
  (`booker/app/api/payment/webhook/route.ts`) reachable without a bypass token
  and keeps mobile clients able to hit staging Route Handlers. Residual risk
  accepted below.
- **Should booker be search-indexable in production at launch?** → **No —
  noindex all three at launch** (resolved 2026-08-02). `booker/app/page.tsx` is a
  client-rendered login shell; indexing it would produce one thin result
  competing with `website/` for brand terms. Revisit only when booker ships
  genuinely public server-rendered content.
- **Abstract the flag into a shared helper?** → **No — duplicate in all three
  apps** (resolved 2026-08-02). Two `process.env` reads per app; a shared package
  would create the deployment coupling `architecture/conventions.md:42`
  explicitly rejects.

No open decisions. Plan is eligible for execution approval.

---

## DEFERRED / COSMETIC

- **`metadata.robots` `<meta>` tag in each root layout** — genuinely redundant
  with the B1 response header for HTML responses, and useless for the non-HTML
  responses that motivated B1. Adding it is three more edited files for zero
  additional coverage. Skipped on simplicity grounds; revisit only if a specific
  crawler is observed ignoring the header.
- **`sitemap.ts`** — nothing public to enumerate; contradictory alongside
  noindex. Belongs to the future "public content" work, not here.
- **Access gate on staging** — declined 2026-08-02 (see Decisions). Accepted
  residual risk: staging stays openly reachable to anyone with the URL. The
  effective protection is then Supabase Auth plus RLS, which is the same boundary
  production relies on. Acceptable *provided* staging is not pointed at
  production data — see Adjacent risks.
- **`/ui-gallery`** — already 404s in production builds; no work.

---

## Adjacent risks (flagged, not fixed by this plan)

Surfaced during investigation, not verified either way — raising rather than
silently fixing, per AGENTS.md:

1. **Does staging point at a separate Supabase project?** If staging shares the
   production project, "no access gate" is a materially worse trade than assessed
   above, and this plan's residual-risk acceptance should be revisited.
2. **Staging auth emails.** Supabase Auth from staging can send real
   confirmation/OTP mail to real addresses. Worth confirming against
   `architecture/email-setup-local-and-remote.md`.

---

## Execution order

1. **B1 + B2 together, per app** — three independent commits, one inside each
   app's own git repository (`command/`, `booker/`, `vendor/`; this root repo
   does not contain their history). No inter-app dependency, so order among the
   three is free. Do `command` first as the lowest-traffic portal.
2. **Redeploy all three** — both changes are build-time, so nothing takes effect
   until a deploy.
3. **I1** — index-coverage audit, only meaningful after step 2 is live.
4. **I2** — documentation, any time after step 1.

---

## Verification

| Check | Kind |
|---|---|
| `npm --prefix <app> run build` succeeds for all three | machine-verifiable |
| With flag unset: `curl -sI localhost:<port>/ \| grep -i x-robots-tag` returns `noindex, nofollow, noarchive` | machine-verifiable (local `next build && next start`) |
| With flag unset: `curl -s localhost:<port>/robots.txt` returns `User-Agent: *` / `Disallow: /` | machine-verifiable |
| With `ALLOW_INDEXING=1`: header **absent** and robots.txt shows `Allow: /` — proves the flag works in both directions, not just fail-closed | machine-verifiable |
| Header present on a non-HTML response: `curl -sI localhost:<port>/manifest.webmanifest` (booker/vendor) | machine-verifiable |
| Same two curls against the deployed staging host, and against each production host | **needs live environment** |
| `site:<host>` returns nothing on Google and Bing for all deployed hosts | **needs live environment**, and lags the deploy by days unless a Search Console removal is filed |

Per-app ports for the local checks are in the repo's dev tooling; `booker`,
`vendor`, and `command` each run their own dev/preview port.
