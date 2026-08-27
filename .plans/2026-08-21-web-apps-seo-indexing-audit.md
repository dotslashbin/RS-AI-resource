# Web apps — search, crawling and indexing readiness (re-audit + gap closure)

**Date:** 2026-08-21
**App / scope:** `command/`, `booker/`, `vendor/` (the three Next.js portals). Marketing
surface (`ezzy.ph` and siblings) audited for *interaction*, not owned by this repo.
**Status:** COMPLETE (closed 2026-08-21) — every code item shipped and verified; three live-infrastructure actions ⏸ PARKED with unblock conditions below

> Re-audit of crawler/index exposure across every deployed portal, verified against the
> **live** hosts rather than the source tree, and closure of the gaps that survive.
> Theme to optimise: *the deployed build is the only thing that counts.*

---

## ⚠️ Picking this up in a NEW session — read this first

**Closed 2026-08-21 with all code complete and verified. Nothing here is half-written.**
What remains is three actions on live infrastructure that an agent cannot perform:
deploying, and reading Google Search Console. They are ⏸ PARKED, not forgotten — each
names its unblock condition at its item.

**All app code is COMMITTED** (by the user, 2026-08-21). Each app is its own git
repository — the workspace root has none of their history. Verified present in `HEAD`:
`lib/siteUrl.ts`, `visual-tests/seo.spec.ts`, `next.config.ts`, `app/layout.tsx` in all
three.

| Repo | Branch | HEAD |
|---|---|---|
| `command/` | `develop` | `ed41af2 Prepped for production visibility` |
| `booker/`  | `develop` | `f882c2c Merge branch 'feature/crawler_prep' into develop` |
| `vendor/`  | `develop` | `0cda236 Prepped for production visibility` |

Working trees are **clean**. The workspace-root repo still has uncommitted doc changes:
`architecture/conventions.md`, `.plans/2026-08-02-web-apps-search-engine-exposure.md`
(both modified), plus `scripts/check-indexing-guard.sh` and this plan (both untracked).

> ⚠️ **These branches are `develop`, not the branch Vercel deploys.** `origin/production`
> is a separate branch in each repo. Nothing in this plan reaches a live host until it is
> promoted to `production` **and** deployed — which is precisely the failure I3 documents,
> where `command`'s manifest sat on `origin/production` for three days without ever being
> built.

**The three parked actions, shortest path:**

1. **I3** — redeploy `command` production in Vercel with **build cache disabled**, and
   check which branch its production environment builds from. Then:
   `./scripts/check-indexing-guard.sh https://command.ezzy.ph` and
   `curl -sI https://command.ezzy.ph/manifest.webmanifest` (expect 200, currently 404).
2. **I2 (deploy half)** — deploy `booker` with `CSP_REPORT_ONLY=1`, exercise the wizard
   end to end including a real PayMongo redirect **and return**, confirm zero violations,
   then remove the flag. `connect-src` is the one directive local tests cannot exercise.
3. **I5 (coverage half)** — `site:<host>` on Google and Bing for the six hosts, or Search
   Console → Coverage. File Removals → Temporary removal for anything listed.

**Re-verify anything here in one command:** `./scripts/check-indexing-guard.sh` (all six
hosts, exit 0 = healthy). Per app: `npx playwright test -g "indexing guard"`, and the same
with `ALLOW_INDEXING=1` to prove the switch works in both directions.

⚠️ **Do not "fix" the absence of `sitemap.ts`, canonical URLs, or `metadata.robots`** —
each was considered and deliberately rejected; see DECISIONS. The portals are `noindex` by
decision (D1), not by oversight.

---

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision; numbers are
> plan-local — qualify cross-plan refs by app (e.g. "command I1").

**Supersedes / continues:** `.plans/2026-08-02-web-apps-search-engine-exposure.md`
(that plan's B1/B2 shipped; its I2 shipped but was never marked; its I1 is still open and
is carried here as I5). Cross-plan partner: `.plans/2026-08-02-web-apps-production-launch-readiness.md` **B7**, booker arm.

---

## Scope

**In scope:** `robots.txt`, robots meta, `X-Robots-Tag`, sitemaps, canonicals, page /
Open Graph / Twitter metadata, JSON-LD, web manifests, crawler-reachable static and API
surfaces, environment-gated indexing behaviour, and staging discoverability — for the
three portals, in every deployed environment.

**Out of scope, explicitly:**
- The WordPress marketing estate (`ezzy.ph`, `care.`, `court.`, `drive.`). Different
  stack, different repo, already correctly configured — audited below as *context*, not
  as work.
- `website/` in this workspace. **Not deployed and not tracked** — see the correction in
  "Findings", item F7.
- The two Expo apps — no crawlable surface.
- Rewriting the portals to have public, server-rendered, indexable content. That is a
  product decision (D1), not a hardening task.

**Cross-app:** every code item here touches all three apps, which is an `AGENTS.md`
approval gate. Changes stay byte-identical per app and deliberately duplicated —
`architecture/conventions.md:42`, "No Shared Code Between Apps".

---

## 1. Current-state audit

### 1a. What already exists, and works

The 2026-08-02 plan's two-layer control is **shipped and live on all six portal hosts.**
Verified this session (2026-08-21) by `curl` against the deployed hosts, not by reading
the repo:

| Layer | File | Off (default) | On (`ALLOW_INDEXING=1`) |
|---|---|---|---|
| `robots.txt` | `command/app/robots.ts:1`, `booker/app/robots.ts:1`, `vendor/app/robots.ts:1` | `User-Agent: *` / `Disallow: /` | `Allow: /` + `Disallow: /api/` |
| Response header | `command/next.config.ts:96`, `booker/next.config.ts:15`, `vendor/next.config.ts:112` | `X-Robots-Tag: noindex, nofollow, noarchive` | header absent |

Live results, 2026-08-21:

| Host | `/robots.txt` | `X-Robots-Tag` on `/` |
|---|---|---|
| `command.ezzy.ph` | `Disallow: /` | `noindex, nofollow, noarchive` |
| `vendor.ezzy.ph` | `Disallow: /` | `noindex, nofollow, noarchive` |
| `booker.ezzy.ph` | `Disallow: /` | `noindex, nofollow, noarchive` |
| `staging-command.ezzy.ph` | `Disallow: /` | `noindex, nofollow, noarchive` |
| `staging-vendor.ezzy.ph` | `Disallow: /` | `noindex, nofollow, noarchive` |
| `staging-booker.ezzy.ph` | `Disallow: /` | `noindex, nofollow, noarchive` |

Header coverage confirmed on the surfaces a `<meta>` tag can never reach:

```
booker.ezzy.ph/manifest.webmanifest   200  x-robots-tag: noindex, nofollow, noarchive
booker.ezzy.ph/icons/icon-192.png     200  x-robots-tag: noindex, nofollow, noarchive
vendor.ezzy.ph/api/divisions          200  x-robots-tag: noindex, nofollow, noarchive
command.ezzy.ph/api/vendor-payout     403  x-robots-tag: noindex, nofollow, noarchive
command.ezzy.ph/ui-gallery            404  x-robots-tag: noindex, nofollow, noarchive
```

Also confirmed working:

- **`/ui-gallery` never deploys.** `notFound()` on `NODE_ENV === "production"`
  (`command/app/ui-gallery/page.tsx:310`, `booker/…:293`, `vendor/…:749`), which covers
  staging too since staging is a production build. Live: 404 on both hosts checked.
- **Staging is visually self-identifying.** `staging-booker.ezzy.ph` titles itself
  `STAGING BOOKER — Booking Portal`, `staging-command` → `Staging Ezzy Command`,
  `staging-vendor` → `Staging Ezzy Vendor`, via `NEXT_PUBLIC_APP_NAME`. If a staging URL
  ever *did* surface in a SERP it would not masquerade as production.
- **The contract is documented.** `architecture/conventions.md:372` ("Search-engine
  exposure is off by default") plus the `ALLOW_INDEXING` row at `:269`, including the
  ⚠️ note about an inert guard on a stale deploy.

### 1b. What is absent — and whether that is correct

| Thing | State | Verdict |
|---|---|---|
| `sitemap.ts` / `sitemap.xml` | absent in all three | **Correct.** A sitemap alongside `noindex` is contradictory signal. Do not add. |
| `metadataBase` | absent in all three | Harmless today (nothing emits absolute URLs). Becomes required the moment OG/Twitter images exist. |
| `alternates.canonical` | absent | **Correct while noindex.** Also *desirable*: no canonical means staging can never emit a production URL, or vice versa. |
| `openGraph` / `twitter` metadata | absent | Deferred, but has a non-SEO justification — see I6. |
| JSON-LD / structured data | absent | Correct. Nothing to describe. |
| `robots` field in `metadata` | absent | Deliberate; re-examined and upheld — see "Corrections", C2. |
| Web manifest | present (`app/manifest.ts` ×3) | Correct; carries no URLs beyond `start_url: "/"`. |
| Service worker | `public/sw.js` ×3, network-first for navigations | No crawler impact — SWs do not run for crawlers, and it never serves stale HTML. |
| `favicon.ico`, `icon.svg`, `apple-icon.png` | present per app | Fine; covered by the header. |

### 1c. Route classification (the answer to §3 of the brief)

| Route | Class | Handling today | Correct? |
|---|---|---|---|
| `/` (all three) | **Public but `noindex`** | reachable, client-rendered auth shell; header + robots.txt | ✅ |
| everything "inside" the apps (dashboard, wizard, settings, …) | **Auth-required/private** | not routes at all — client-side state in one `page.tsx`; unreachable by URL | ✅ |
| `/ui-gallery` | **Internal/dev fixture** | 404 in every built environment | ✅ |
| `/api/*` — POST-only (9 of 11) | **API/system** | unreachable by GET-only crawlers | ✅ |
| `vendor /api/divisions` (GET) | **Public API, non-sensitive** | intentionally anonymous (`vendor/app/api/divisions/route.ts:10`); returns division names only | ✅ |
| `command /api/vendor-payout` (GET) | **Internal/admin** | `verifyCommandCaller()` → 403 to anonymous; live-confirmed | ✅ |
| `/manifest.webmanifest`, `/icons/*`, `/offline.html`, `/sw.js`, icons | **Public static** | header-only coverage (no meta possible) | ✅ |
| Public/searchable marketing content | **Not in this repo** | `ezzy.ph` + `care.` / `court.` / `drive.`, WordPress + Yoast, `Disallow:` (allow-all) with `sitemap_index.xml` and per-page `<link rel="canonical">` | ✅ |

**There is no route in any of the three portals whose content a search engine could
usefully index.** That is the central fact this plan rests on.

---

## 2. Problems and risks discovered

### Corrections to premises — recorded so the reasoning survives

- **C1 — "Staging might be indexable." False alarm.** All three staging hosts serve
  `Disallow: /` and the `noindex` header today. The 2026-08-02 blocker is closed in
  production. Verified live, above.
- **C2 — "Add `metadata.robots` to the layouts." Already handled, and redundant.**
  Re-examined rather than inherited: the response header is a strict superset of the
  meta tag (it covers JSON, images, the manifest, and 404s; the tag covers none of
  them), and no crawler that honours `<meta name="robots">` ignores `X-Robots-Tag`.
  Three edited files for zero additional coverage. Upholding the prior decision.
- **C3 — "Use `VERCEL_ENV`/`NODE_ENV` instead of a bespoke flag." Would be a
  regression — do not do it.** Staging is a *separate Vercel project on a custom
  domain*, so its branch deploys carry `VERCEL_ENV=production` and `NODE_ENV=production`
  exactly like the real thing. Keying indexing off either variable would flip all three
  staging hosts to indexable in one commit, silently. `ALLOW_INDEXING` is not a
  redundant variable; it is the only signal in the environment that distinguishes
  *"this deployment should be found"* from *"this deployment is production-grade."*
  Detail in §6.
- **C4 — "`robots.txt` prevents indexing." It does not**, and the code already reflects
  this: `Disallow` suppresses *crawling*, so Google can still list a URL it never
  fetched, from an inbound link, with no snippet. `X-Robots-Tag` is the control that
  de-indexes. Both are kept, for different jobs.

### Real findings

- **F1 — There is no automated check that the guard is present in a deployed build.**
  This is the one gap with a documented history of actually biting: on 2026-08-10
  `booker.ezzy.ph` was serving v0.7.0 while the repo was at v0.15.0, so `ALLOW_INDEXING`
  was correctly unset and booker was *still fully indexable* — the running code contained
  nothing that read the variable (`architecture/conventions.md:388`). Today's clean
  result is a hand-run `curl`, repeated by me this session; nothing repeats it after the
  next deploy. → **I1**
- **F2 — `booker` ships no security headers in production.** Live on both
  `booker.ezzy.ph` and `staging-booker.ezzy.ph`: no `Content-Security-Policy`, no
  `X-Frame-Options`, and only Vercel's default `Strict-Transport-Security: max-age=63072000`
  (no `includeSubDomains`, no `preload`) — versus vendor/command, which send the full
  set. `booker/next.config.ts:14` returns `[]` when indexing is allowed and a lone
  `X-Robots-Tag` otherwise. Not an SEO defect; it is the *same file* every SEO change
  here touches, and shipping an edit to it while leaving this is negligent. → **I2**
- **F3 — `command.ezzy.ph` is running a stale build.** `/manifest.webmanifest` and
  `/icons/icon-192.png` both 404 in **production**, while `staging-command.ezzy.ph`
  serves both 200. Those files landed in the repo on 2026-08-18/19
  (`command/app/manifest.ts`, `command/public/icons/`). The SEO guard happens to predate
  them so it *is* deployed — but this is precisely the F1 failure mode, live, right now,
  on a different feature. → **I3**
- **F4 — The 2026-08-02 plan's status is wrong.** It reads *"I1 and I2 outstanding"*;
  I2 (documentation) shipped — `architecture/conventions.md:372` is exactly the section
  it specified. A stale plan is how a later reader re-does finished work or trusts a
  closed risk. → **I4**
- **F5 — The index-coverage audit was never run.** Nobody has checked whether any portal
  or staging URL is *already* listed on Google/Bing from before the guard shipped.
  `noindex` prevents future indexing; it retracts nothing until re-crawl. → **I5**
- **F6 — Brand placeholders would render live if an env var went unset.**
  `command/lib/constants.ts:122` → `"Josh Demo App"`, `booker/lib/constants.ts:67` →
  `"Josh demo app"` / `:68` → `"ang.booker.ni.josh"`, `vendor/lib/constants.ts:42-43`.
  These feed `<title>` and `<meta name="description">` in every layout. A missing var on
  one Vercel environment publishes them. Live check says all six hosts are currently
  correct. → **I7** (low likelihood, embarrassing impact)
- **F7 — `website/` is stale and misleading, and the prior plan's note about it is
  wrong.** It is **gitignored** (`.gitignore:3`), tracked by zero files, titled
  *"RS Road Safety I.T. Services – DriveBook Platform"*, and links out to
  `booking.co99.win` / `school.co99.win` — a different brand and different
  infrastructure. The 2026-08-02 plan says *"the marketing site in `website/` — it
  should be indexable"*. It is not the marketing site; `ezzy.ph` (WordPress) is. → **I4**
- **F8 — Stray file in a route directory.** `booker/app/page.tsx:Zone.Identifier`
  (25 bytes, a Windows alternate-data-stream artefact) sits inside `booker/app/`. Next
  does not route it, but it is deployable junk in the router tree. → cosmetic.
- **F9 — Vercel's `*.vercel.app` production aliases are unaudited.** Vercel's automatic
  `noindex` covers *preview* deployments only; a production alias is indexable by
  default. Our header is emitted for every host the build serves, so these are almost
  certainly covered — but "almost certainly" is not a verification, and the alias names
  are not in the repo. → **I5** (needs the project names from you)

**No blockers.** Stated plainly rather than manufactured: as of 2026-08-21 there is no
live crawl-or-index exposure on any of the six portal hosts. Everything below is
hardening, verification, and hygiene.

---

## 3. Recommended staging strategy

Keep exactly what is there, and add the check that proves it stays there.

1. **`noindex` stays the default via absence, not configuration.** No staging Vercel
   project sets `ALLOW_INDEXING`. Nothing to get wrong at setup time; a brand-new QA or
   preview environment is noindex the moment it exists.
2. **Both layers stay.** `Disallow: /` is the conventional front door and stops the
   crawl; `X-Robots-Tag` is what actually de-indexes and is the only one that reaches
   the manifest, icons and API JSON. Neither substitutes for the other (C4).
3. **No canonical tags anywhere.** Not an omission — a guarantee. With no
   `alternates.canonical` and no `metadataBase`, staging is structurally incapable of
   emitting a production URL, and production incapable of pointing at staging. If OG
   metadata is ever added (I6), `metadataBase` must be derived per-deployment, never
   hardcoded — see §6.
4. **Staging keeps identifying itself** in `<title>` via `NEXT_PUBLIC_APP_NAME`.
5. **Access control: recommend keeping staging open** (upholding the 2026-08-02
   decision, re-examined). Reasoning, and the boundary of it, in §8 / D2.
6. **Add the post-deploy assertion (I1)** so a stale or misconfigured staging deploy
   fails loudly instead of silently becoming crawlable.

## 4. Recommended production strategy

Same posture, different justification — and the justification is now evidence-based
rather than assumed.

1. **All three portals stay `noindex` in production.** Explicitly configured, not
   defaulted: `ALLOW_INDEXING` is read and acted on in both layers in every build.
2. **No sitemap.** Nothing to enumerate; a sitemap would contradict the header.
3. **Public discoverability already lives elsewhere and is already correct.** `ezzy.ph`
   serves Yoast's allow-all robots.txt with `sitemap_index.xml`; `care.`, `court.` and
   `drive.ezzy.ph` each serve their own robots.txt and per-page
   `<link rel="canonical">`. The brand is findable. The portals are the *product behind
   the login*, not the storefront.
4. **The `/api/divisions` GET stays public and stays `noindex`** — correct as-is.
5. **If a portal ever gains genuinely public content**, turning it on is a three-part
   act, not a flag flip: real server-rendered content, a `sitemap.ts`, `metadataBase` +
   canonicals, *then* `ALLOW_INDEXING=1` and a redeploy. Recorded in conventions so
   nobody flips the flag alone and wonders why it never ranks.

## 5. Recommendation on whether production should be indexed

**No — keep all three portals out of the index. This is a recommendation with evidence
behind it, not a default.**

- **There is nothing to index.** Each app is one route. `command/app/page.tsx:1` and
  `vendor/app/page.tsx:1` render `<AppShell />` and nothing else; `booker/app/page.tsx`
  lazy-loads four client components behind the same shell. A crawler fetching `/`
  receives a login screen. Every real screen is client-side state behind Supabase Auth,
  with no URL of its own.
- **Indexing it would actively hurt.** One thin, near-duplicate login result per portal
  would compete with `ezzy.ph` for the brand query and win nothing. Three of them would
  compete with each other.
- **`command` is an internal ops portal.** It approves vendors and releases payouts.
  Its existence being discoverable is pure downside.
- **The upside is already captured.** The searchable surface exists, on WordPress, with
  a sitemap and canonicals. Adding portals to the index adds no reach.
- **Revisit only for booker, only on a real change**: if booker ships public,
  server-rendered vendor/offering pages with their own URLs, that is a genuine indexable
  corpus and this decision should be re-opened — under the three-part gate in §4.5.

## 6. Environment / configuration design

**Keep `ALLOW_INDEXING`. Do not migrate to `NODE_ENV` / `VERCEL_ENV` / `APP_ENV`.**

The brief asks to prefer an existing variable and not to introduce a new one. That
constraint is already satisfied — `ALLOW_INDEXING` exists, is documented
(`architecture/conventions.md:269`), is deployed, and is verified working in both
directions. Nothing new is proposed here.

The brief's fail-safe model —

```
production      -> indexing explicitly enabled
everything else -> noindex by default
```

— is **already implemented, and the repo's version is strictly safer.** The difference
matters:

| | Brief's model, keyed on `VERCEL_ENV` | What ships today |
|---|---|---|
| Signal | *"is this a production-grade deployment?"* | *"should this deployment be found?"* |
| Staging (separate Vercel project, custom domain) | `VERCEL_ENV=production` → **indexable** ❌ | flag unset → **noindex** ✅ |
| A new QA/preview environment | depends on Vercel's classification | flag unset → **noindex** ✅ |
| Turning it on | implicit, invisible, no commit | deliberate: set a variable *and* redeploy |

The decisive point: **staging deploys with `VERCEL_ENV=production`.** Staging is not a
Vercel Preview — it is a separate Vercel project whose production branch happens to be
called staging. Any environment-derived rule would mark all three staging hosts
indexable. That is why a bespoke flag is the right call here and a rare case where "use
the existing platform variable" is the wrong instinct.

Design properties worth keeping explicit:

- **Fail-closed by absence.** Unset ⇒ noindex. The safe state requires zero
  configuration, so a new environment is safe before anyone thinks about it.
- **Exact-match `"1"`.** `"true"`, `"yes"`, `"0"`, `""` all mean noindex. There is no
  truthy-string coercion to misread.
- **Server-only, deliberately not `NEXT_PUBLIC_`.** Both consumers run on the server;
  a public prefix would inline the deployment's indexing posture into the client bundle
  for no benefit. Confirmed: `grep -rn ALLOW_INDEXING` finds it only in `next.config.ts`
  and `app/robots.ts`.
- **Build-time in both layers, so they cannot drift.** `headers()` is evaluated at build;
  `app/robots.ts` statically generates `/robots.txt` at build. Flipping the flag needs a
  redeploy — intended, because turning on indexing should be a deliberate act.
- **Duplicated per app, not abstracted.** Two `process.env` reads each. A shared package
  would create the deployment coupling `architecture/conventions.md:42` rejects.

**One hardening is proposed, and it is not a new variable** — it is the assertion that
the deployed artefact actually contains the guard (I1). F1 and F3 show that the design
is sound and the *deployment* is the weak link; the fix belongs there.

---

## IMPORTANT

### I1 — No automated regression check that the shipped build carries the guard ✅ DONE (2026-08-21)

**Required.** **Files:** new `<app>/visual-tests/seo.spec.ts` ×3 (or `scripts/`, see the
decision inside D3); reuses each app's existing `playwright.config.ts`.

The single failure with a track record (F1, and F3 shows the mechanism is live today).
`ALLOW_INDEXING` being correct proves nothing if the running bundle predates the code
that reads it. Two distinct checks are needed and they are not interchangeable:

**(a) Build-artefact test — runs in CI / locally, catches a code regression.**
A Playwright spec against the app's own `webServer`, asserting on the *default* build:

```ts
// <app>/visual-tests/seo.spec.ts
import { test, expect } from "@playwright/test"

test("robots.txt is fail-closed", async ({ request }) => {
  const res = await request.get("/robots.txt")
  expect(res.status()).toBe(200)                      // a 404 means the guard is absent
  expect(await res.text()).toContain("Disallow: /")
})

test("noindex header covers HTML and non-HTML alike", async ({ request }) => {
  for (const path of ["/", "/manifest.webmanifest"]) {
    const res = await request.get(path)
    expect(res.headers()["x-robots-tag"]).toBe("noindex, nofollow, noarchive")
  }
})
```

⚠️ **`expect(res.status()).toBe(200)` on `/robots.txt` is load-bearing.** Asserting only
on the body would pass against a 404 page that happens not to contain `Allow`. A 404
*is* the "guard not deployed" signature (`architecture/conventions.md:395`).

⚠️ Do **not** assert `noindex` by fetching a path that does not exist — Next adds
`noindex` to every 404 automatically, so that test passes on an app with no guard at all.
Test `/`.

**(b) Post-deploy smoke check — runs against the live hosts, catches a stale deploy.**
The thing that would have caught 2026-08-10 and would catch F3 today. Shell, no
dependency:

```bash
for H in https://command.ezzy.ph https://vendor.ezzy.ph https://booker.ezzy.ph \
         https://staging-command.ezzy.ph https://staging-vendor.ezzy.ph https://staging-booker.ezzy.ph; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$H/robots.txt")
  body=$(curl -s "$H/robots.txt")
  hdr=$(curl -sI "$H" | tr -d '\r' | grep -i '^x-robots-tag:' || true)
  [ "$code" = 200 ] && printf '%s' "$body" | grep -q 'Disallow: /' && [ -n "$hdr" ] \
    && echo "OK   $H" || echo "FAIL $H  (code=$code hdr='${hdr:-none}')"
done
```

**Component separation:** `.claude/skills/component-separation/SKILL.md` does not apply —
no component is created or modified. Both artefacts are test/tooling files with no render
layer, no state, no styling.

> **Executed 2026-08-21.** Both halves shipped, plus two prerequisite fixes that the
> investigation turned up (below — neither was in the approved plan, both were required
> for the deliverable to be worth anything).
>
> **(a) Build-artefact spec** — `visual-tests/seo.spec.ts`, byte-identical in all three
> apps (`md5 5e3058af…`). Extended beyond the drafted version to assert **both**
> directions from one file, keyed on the same `ALLOW_INDEXING` the app reads: a guard
> only ever exercised in its default state is proven to be a constant, not a switch.
> Body assertions are line-anchored regexes rather than `toContain` — `"Disallow: /api/"`
> contains the substring `"allow: /api/"`, so a naive check depends on a capital letter.
>
> **(b) Post-deploy smoke check** — `scripts/check-indexing-guard.sh` at the workspace
> root (tracked by the root repo; it spans all three apps, so it belongs to none of
> them). Defaults to the six known hosts, accepts any hosts as arguments, exits 1 on any
> failure so it can gate a pipeline.
>
> **Verified — 18 spec runs, all green** (3 tests × 3 apps × 2 postures):
> `npx playwright test -g "indexing guard"` and the same with `ALLOW_INDEXING=1`, in
> `command`, `booker` and `vendor`. The opt-in run passing is itself the proof the
> variable reaches the server: against a fail-closed build those assertions invert and
> would fail.
> **V1** `tsc --noEmit` clean ×3 · **V2** `npm run build` succeeds ×3 · **V3–V7** green ×3
> ×2 · **V9** `grep -rl ALLOW_INDEXING <app>/.next/static/` → nothing ×3 · **V10**
> `grep -rl "staging-" <app>/.next/static/` → nothing ×3 · `/robots.txt` present in all
> three build route tables.
> **V11** smoke script: **OK on all six hosts**, exit 0.
> **Negative control** — the script was also pointed at `https://ezzy.ph` (deliberately
> indexable) and correctly **FAILED** with both diagnostics and exit 1. A check that has
> never failed is not a check; this one is now proven in both directions too.
>
> **Still needs a live check:** nothing for I1 itself. The script is the live check, and
> it must be re-run after the I3 redeploy (Stage 2).

### I1a — `visual-tests/` was gitignored in booker and command ✅ DONE (2026-08-21)

**Discovered during Stage 1 execution; not in the approved plan.** **Files:**
`command/.gitignore:52`, `booker/.gitignore:53`.

`command` ignored `visual-tests` (the whole directory) and `booker` ignored
`visual-tests/*`. A new `seo.spec.ts` placed there would have been **untracked in two of
the three apps** — an untracked regression test is not a regression test, and the failure
would have been silent: the file works locally forever and simply does not exist for
anyone else. `vendor` already had the correct narrower rule.

⚠️ Both `.gitignore` comments already said *"visual-regression run **artifacts** — NOT
the committed baselines"*, so the rules overshot their own stated intent. This is a
correction, not a policy change.

**Executed:** narrowed both to `vendor`'s exact two lines (`visual-tests/*.png` and
`visual-tests/pilot.spec.ts-snapshots/*.png`), making the Playwright section
byte-identical across all three apps. `booker/.gitignore` is CRLF with no trailing
newline; both were preserved, so the diff is one line changed rather than a whole-file
rewrite.
**Verified:** `git status` now shows `visual-tests/seo.spec.ts` in all three; no baseline
PNG became trackable in either app.

> **Side-effect needing your call:** `booker/visual-tests/pilot.spec.ts` (4.4 KB, its
> existing visual spec) is now visible as untracked. `vendor` tracks its equivalent, so
> committing booker's is the consistent choice — but it is a pre-existing file that this
> plan did not author, so it is left untracked for you to decide. Not blocking.

### I1b — `command`'s Playwright config could silently test the wrong app ✅ DONE (2026-08-21)

**Discovered during Stage 1 execution; listed in the approved plan only as an *optional*
enhancement — promoted because it directly undermines I1.** **File:**
`command/playwright.config.ts:18,24-25`.

`command` and `vendor` both used port 3100 with `reuseExistingServer: !CI`. With a vendor
dev server open, `command`'s suite attaches to **vendor** and tests it. For pixel
baselines that fails loudly (wrong screenshots). For `seo.spec.ts` it is far worse: the
assertions pass against *any* of the three portals, because all three serve identical
robots.txt and headers. The new test would have reported a healthy `command` while never
touching it.

**Executed:** port 3100 → **3300** and `127.0.0.1` → `localhost` (the latter a
long-standing known defect — `architecture/conventions.md`, and it is why `command`'s
harness could never have run an interactive test correctly). **Blast radius: zero** —
`command` has no baseline snapshots on disk and none tracked, so there was nothing to
invalidate. Ports are now vendor 3100 / booker 3200 / command 3300, all distinct.
**Verified:** `command`'s suite green on 3300 in both postures; `grep` confirms no other
file in `command` referenced 3100 except a README line about Playwright-only ports.

### I2 — `booker` ships no security headers in production ✅ DONE (code, 2026-08-21) · deploy half ⏸ PARKED

> ⏸ **Deploy half PARKED. Unblock condition:** a `CSP_REPORT_ONLY=1` deploy of `booker`,
> the wizard exercised end to end (map, upload, a real PayMongo redirect **and return**)
> with zero violations, then the flag removed. ⚠️ `connect-src` is the one directive the
> local tests cannot exercise and the one that broke the other two portals in 2026-08.

**Required (coupled).** **File:** `booker/next.config.ts:14`
**Cross-plan partner:** `.plans/2026-08-02-web-apps-production-launch-readiness.md` **B7**,
booker arm (reactivated 2026-08-10; the CSP table there is the part still owed).

Live-confirmed absent on `booker.ezzy.ph`: `Content-Security-Policy`,
`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`;
HSTS is Vercel's bare default with no `includeSubDomains` / `preload`. `vendor` and
`command` send the full set.

**Coupling, stated on both items:** I1 and I2 edit the same three `next.config.ts` files.
Ship them per app in one commit — two separate passes over `headers()` in the same file
is how the `allowIndexing ? securityHeaders : [...]` shape gets flattened by accident,
which is the mistake `command/next.config.ts:92` carries an explicit warning against.

**Fix approach:** port `vendor`'s `securityHeaders` + `headers()` shape into
`booker/next.config.ts`, preserving `allowedDevOrigins`. Booker-specific CSP deltas that
vendor's copy does **not** cover and must be added:
- `connect-src` — **derive** from `NEXT_PUBLIC_SUPABASE_URL` via `supabaseConnectSrc()`;
  never a `https://*.supabase.co` wildcard (`architecture/conventions.md`, "CSP
  `connect-src` must be derived" — copying the wildcard is what broke sign-in on the
  other two portals).
- `api.paymongo.com` in `connect-src` — booker is the only portal with a browser-side
  payment provider.
- Leaflet tile host in `img-src` / `connect-src` — booker is the only portal with maps
  (`AGENTS.md`, "Maps are booker-only"). **Enumerate the actual host from the code before
  writing the directive; do not guess it.**
- No `media-src blob:` and `camera=()` — booker has no camera capture.

⚠️ **Ship as `Content-Security-Policy-Report-Only` first** (`CSP_REPORT_ONLY=1`) and
exercise the full booking wizard, the map step and a PayMongo checkout redirect before
switching to enforcing. This is the same sequencing vendor and command used.

> **Executed 2026-08-21.** `booker/next.config.ts` rewritten with the full header set.
> Three of the plan's assumptions were **wrong and were corrected against the code** —
> each would have shipped a broken portal:
>
> **1. The tile host is CARTO, not OpenStreetMap.**
> `components/booking/MapWidget/useMapWidget.ts:25-26` uses
> `https://{s}.basemaps.cartocdn.com/...`; `{s}` expands to a/b/c/d, hence
> `https://*.basemaps.cartocdn.com` in `img-src` — and `img-src`, not `connect-src`,
> because Leaflet fetches tiles as `<img>`. **Demonstrated, not argued:** with the host
> temporarily set to the guessed `tile.openstreetmap.org`, the new CSP test fails with
> six `img-src blocked https://[abc].basemaps.cartocdn.com/...` violations. The obvious
> guess would have left a blank grey square and no error naming the map.
>
> **2. `geolocation=()` would have silently broken the map.**
> `hooks/useGeolocation.ts:15` calls `navigator.geolocation.getCurrentPosition`, driven
> from booking step 2 (`BookingWizard.tsx:34`). vendor's Permissions-Policy denies
> geolocation; copying it verbatim — the literal instruction in the plan — disables the
> "You are here" marker with the map still rendering. booker ships
> `geolocation=(self)`. **This is the single most dangerous line in the file.**
>
> **3. `api.paymongo.com` is NOT needed, and `architecture/conventions.md` is wrong
> about this.** That doc calls booker "the only app with … a browser-side payment
> provider". It has none: the PayMongo call is server-side in
> `app/api/payment/create-session/route.ts:47` with the secret key, and the browser only
> does `window.location.href = checkout_url`
> (`components/booking/BookingWizard/useBookingWizard.ts:216`). A top-level navigation is
> governed by neither `connect-src` nor `form-action`. Adding the origin would have been
> harmless but would have misdescribed the payment flow in a security-critical file.
> → follow-up **I8** below.
>
> Also derived from code rather than copied: **no `media-src blob:`** and **no
> `camera=(self)`** (no `getUserMedia` anywhere; document upload is a plain
> `<input type="file">`, `Step4Documents.tsx:55`); **no `blob:` in `img-src`** (nothing
> calls `createObjectURL`/`FileReader` — documented inline so the next person adding a
> preview knows which directive to add); **no font directives beyond `'self' data:`**
> (no `next/font`, no Google Fonts). `connect-src` is **derived** via
> `supabaseConnectSrc()` and covers Realtime (`useAppShell.ts:65`).
>
> **New test:** `booker/visual-tests/csp.spec.ts` — loads `/ui-gallery?mode=step2` in a
> real browser, collects `securitypolicyviolation` events and policy-blocked requests,
> and asserts tiles were **actually fetched** (`img.leaflet-tile` count > 0) so a map
> that rendered nothing cannot pass by requesting nothing.
>
> **Verified:** `tsc --noEmit` clean · `npm run build` clean · CSP test green, and
> **proven able to fail** via the negative control above · indexing-guard spec green in
> **both** postures (3 passed / 3 passed) · V9/V10 clean on the final build, plus no
> `SUPABASE_SERVICE_ROLE_KEY` or `PAYMONGO_SECRET` in `.next/static/`.
>
> **The coupling risk the plan flagged was tested directly and did not occur.** With
> `ALLOW_INDEXING=1`: all five security headers survive and `X-Robots-Tag` correctly
> disappears; with it unset, all six are present. The `allowIndexing ? … : [...]` shape
> was preserved.
> ⚠️ One scare during verification was a **test artifact, not a code fault**: a stale
> `next-server` process held the port, so a second server never bound and curl hit the
> old build — producing a response with `Allow: /` *and* `X-Robots-Tag` together. Re-run
> on a clean port, the result was correct. Kill by PID, not `pkill -f next-server` (that
> pattern also matches the shell running it).
>
> **Still owed — needs live environment:** deploy with `CSP_REPORT_ONLY=1` (verified
> locally to emit `Content-Security-Policy-Report-Only` and no enforcing header), then
> exercise the wizard end to end — map on step 2, a document upload on step 4, and a real
> PayMongo redirect **and return** — before removing the flag. `connect-src` is the one
> directive the local tests do not exercise (it needs a live backend); it is also the
> directive that broke the other two portals in 2026-08, so it is the one to watch.

### I3 — `command.ezzy.ph` production is running a stale build ⏸ PARKED (2026-08-21)

> ⏸ **PARKED — diagnosis complete, action is yours.** Root-caused with branch-level
> evidence (below): not a merge fault, a deploy fault. **Unblock condition:** a Vercel
> redeploy of `command` production with the build cache disabled. Nothing in the repo
> changes. ⚠️ The indexing guard is NOT affected — it predates the missing commit and all
> six hosts pass today.

**Required.** **File:** n/a — deployment.

`/manifest.webmanifest` → **404** and `/icons/icon-192.png` → **404** on production
`command`, while `staging-command.ezzy.ph` serves both **200**. `command/app/manifest.ts`
and `command/public/icons/` are in the repo. Production is therefore behind by at least
the 2026-08-18/19 branding work. The SEO guard predates it and *is* deployed — this time.

**Fix approach:** redeploy `command` production **with the build cache disabled**
(`architecture/overview.md`, "`NEXT_PUBLIC_*` is baked in at build time" — Turbopack will
otherwise reuse chunks with old values compiled in). Then re-run I1(b) against all six
hosts and confirm `command.ezzy.ph/manifest.webmanifest` returns 200.

**Coupling:** I1(b) is the check that makes this class of fault visible; land I1 first so
the redeploy is verified by the script rather than by hand.

> **Diagnosis sharpened 2026-08-21 — the cause is now proven, not inferred.**
> The first pass could not distinguish *"the code was never merged to the deploying
> branch"* from *"the branch was never deployed"*. Those need different fixes, so it was
> worth resolving before asking you to act. Evidence:
>
> - `app/manifest.ts` and all three `public/icons/*.png` are **present on
>   `origin/production`** (`git show production:app/manifest.ts`, `git ls-tree production public/icons/`).
> - They were added in `e31df59` (2026-08-18, "UI Enhancements"); `origin/production`
>   head is `8e78dfd` (2026-08-21) and matches local `production` exactly.
> - `command.ezzy.ph` nevertheless returns **404** for `/manifest.webmanifest`,
>   `/icons/icon-192.png` **and** `/icon.svg`.
> - `staging-command.ezzy.ph` returns **200** for the same paths.
>
> **Therefore: the code is on the production branch and has been for three days; the
> live deployment was never rebuilt from it.** Not a merge problem — a deploy problem.
> `vendor` and `booker` both serve their manifests, so `command` is the only affected app.
>
> ⚠️ **The indexing guard itself is NOT at risk here** — it predates `e31df59`, and all
> six hosts pass the smoke check today (re-run 2026-08-21, 6/6 OK). This is the *same
> mechanism* that made booker indexable on 2026-08-10 caught before it touched anything
> load-bearing, which is exactly what I1 exists to do.
>
> **Blocked on you:** redeploying is an outward-facing action on live infrastructure and
> is not mine to trigger. Required action — in Vercel, redeploy `command` **production**
> with **"Use existing build cache" unchecked** (Turbopack will otherwise reuse chunks
> with old values compiled in — `architecture/overview.md`, "Three traps"). Then:
> `./scripts/check-indexing-guard.sh https://command.ezzy.ph` and
> `curl -sI https://command.ezzy.ph/manifest.webmanifest` → expect 200.
> ⚠️ While you are there, confirm which branch `command`'s Vercel **production**
> environment builds from. If it is not `production`, that misconfiguration is the real
> root cause and will recur on the next release.

### I4 — Stale predecessor plan asserts a closed risk and a wrong fact ✅ DONE (2026-08-21)

**Recommended.** **Files:** `.plans/2026-08-02-web-apps-search-engine-exposure.md:8`
(status line), `:24` (scope note about `website/`), `:159` (I1), `:177` (I2).

Two defects. The status line reads *"I1 and I2 outstanding"*, but **I2 shipped** —
`architecture/conventions.md:372` is verbatim what it specified. And the scope note says
*"the marketing site in `website/` — it should be indexable"*: `website/` is gitignored
(`.gitignore:3`), tracked by zero files, branded *RS Road Safety I.T. Services –
DriveBook Platform*, and links to `booking.co99.win` / `school.co99.win` (F7). The
marketing site is the WordPress estate at `ezzy.ph`.

**Fix approach:** mark that plan's I2 ✅ DONE with the conventions.md reference; correct
the `website/` scope note and point it at `ezzy.ph`; move its I1 here as I5 and mark it
⏸ PARKED → superseded; update its overall status to COMPLETE.

> **Executed 2026-08-21.** `.plans/2026-08-02-web-apps-search-engine-exposure.md` status
> → **COMPLETE** with a closure note; its I2 marked ✅ (it had shipped years-of-context ago
> and was simply never ticked); its I1 marked ⏸ PARKED with "superseded → I5 here" and its
> unblock condition; and the `website/` scope note struck through and corrected with the
> real WordPress estate. Nothing deleted — the record is preserved per the skill's rule.

### I5 — Existing index coverage is unknown, and `*.vercel.app` aliases are unaudited ⏸ PARKED (2026-08-21)

> ⏸ **PARKED — alias half ✅ RESOLVED and closed; coverage half needs an account I cannot
> reach.** **Unblock condition:** Google/Bing `site:` results or Search Console access for
> the six hosts. ⚠️ Deliberately NOT recorded as verified: the available search tool does
> not honour `site:` or exact-phrase operators, and its returning nothing is not evidence
> that Google's index holds nothing.

**Required.** **File:** n/a — live environment. *(Carries `2026-08-02` plan's I1.)*
**Needs live environment + input from you (the Vercel project names).**

`noindex` stops future indexing; it retracts nothing until Google re-crawls. If any host
was linked before the guard shipped — and `booker.ezzy.ph` demonstrably ran an
unguarded build until at least 2026-08-10 — URLs may be listed today. Separately, each
Vercel project has a production `*.vercel.app` alias; Vercel's automatic `noindex`
applies to **preview** deployments only, so a production alias is indexable by default.
Our header should cover them (it is host-independent), but that is untested and the alias
names are not in the repo.

**Fix approach:**
1. Run `site:<host>` on Google and Bing for all six portal hosts.
2. Enumerate the `*.vercel.app` production aliases and run I1(b)'s two curls against each.
3. Anything listed → Search Console **Removals → Temporary removal** for the host (hours,
   versus weeks of organic re-crawl), then let `noindex` make it permanent.
4. Record the outcome here. A clean `site:` query *is* the verification.

> **Alias half — ✅ RESOLVED 2026-08-21, and by a better method than the drafted one.**
> The plan said to enumerate the `*.vercel.app` aliases and curl each. Enumeration failed
> (no `.vercel/project.json` in any app, no Vercel CLI, and twelve plausible project
> names — `ezzy-command`, `bookdeck-vendor`, `rs-command`, … — all returned
> `DEPLOYMENT_NOT_FOUND`). Guessing hostnames was the wrong shape of answer anyway.
>
> Instead the underlying property was **proven directly**: the header rule is
> `source: "/:path*"`, which is host-independent, so *any* alias of a deployment gets the
> same treatment. Demonstrated against a real `next build` + `next start` of `command`,
> probed under three different `Host` headers — `command.ezzy.ph`,
> `ezzy-command-abc123.vercel.app` and `totally-unknown-alias.example`:
>
> ```
> Host: command.ezzy.ph               → X-Robots-Tag: noindex, nofollow, noarchive · robots.txt: Disallow: /
> Host: ezzy-command-abc123.vercel.app → X-Robots-Tag: noindex, nofollow, noarchive · robots.txt: Disallow: /
> Host: totally-unknown-alias.example  → X-Robots-Tag: noindex, nofollow, noarchive · robots.txt: Disallow: /
> ```
>
> **Every alias of these deployments is covered by construction**, whatever it is called.
> The alias names are therefore no longer needed, and F9's residual risk is closed. A
> spot-check remains *optional* if you happen to have the names to hand.
>
> **Coverage half — ⏸ BLOCKED, and deliberately NOT claimed as verified.**
> `site:` queries were attempted through the available web-search tool and it does not
> honour `site:` or exact-phrase operators — it returned EZ Staged, an Ugandan marketing
> agency and `ezzybills.com` for a quoted search on `"staging-vendor.ezzy.ph"`. **No
> portal hostname appeared in any result, but that is not evidence of absence** and must
> not be recorded as a pass. A search tool returning nothing and Google's index holding
> nothing are different statements.
>
> **Unblock condition — needs you:** the authoritative checks are (a) `site:<host>` typed
> into Google and Bing directly, for all six hosts, and (b) Google Search Console →
> Coverage for any verified property. If anything is listed, file
> **Removals → Temporary removal** for that host (effective in hours; `noindex` then makes
> it permanent as each URL is re-crawled).

### I6 — No Open Graph / Twitter metadata; link previews are blank ✅ DONE (2026-08-21)

**Recommended improvement — and deliberately *not* an SEO item.** **Files:**
`command/app/layout.tsx:7`, `booker/app/layout.tsx:8`, `vendor/app/layout.tsx:8`; new
`<app>/app/opengraph-image.png` ×3.

Worth separating from everything above: OG/Twitter tags do **not** affect indexing. They
affect what a link looks like when a vendor pastes the portal URL into Messenger, Viber,
WhatsApp or Slack — which, in a Philippine market where onboarding happens over chat, is
a real product surface. Today those previews render bare.

**Fix approach** (D3 → yes, 2026-08-21): add `openGraph` (+ `twitter: { card: "summary" }`)
to each root layout, and Next's file convention `app/opengraph-image.png` per app.

⚠️ **`metadataBase` becomes mandatory the moment an OG image exists** — without it Next
emits a relative image URL and warns at build. It **must be derived per-deployment, never
hardcoded**, or staging will advertise a production URL (or worse, the reverse):

```ts
metadataBase: new URL(
  process.env.NEXT_PUBLIC_APP_URL           // booker already sets this
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000")
),
```

`VERCEL_PROJECT_PRODUCTION_URL` is per-project, so a staging project resolves to its own
staging host — correct in both environments. **Still add no `alternates.canonical`**: a
canonical is a claim about which URL should rank, and we are claiming none.

**Component separation:** exempt. `layout.tsx` metadata is a static export, not a render
layer; `opengraph-image.png` is a static asset. No state, no effects, no styling.

> **Executed 2026-08-21**, with one deliberate departure from the drafted snippet.
>
> **The drafted fallback chain was kept, but its failure mode was not acceptable.** As
> written it ended at `http://localhost:3000`, so a Vercel build with neither variable set
> would silently publish `localhost` as the app's identity in every link preview. The
> shipped version **throws instead**, gated on `VERCEL` rather than `NODE_ENV` so a local
> `npm run build` still works offline.
>
> **A tempting fourth option was investigated and rejected.** `NEXT_PUBLIC_APP_DOMAIN`
> exists in all three apps and staging really does set it to its own host (verified by
> grepping the deployed staging bundle: `staging-booker.ezzy.ph`). But it is a **branding
> string** rendered under the login form (`LoginPage.tsx`), so setting all three portals
> to a prettier `ezzy.ph` — an ordinary copy change — would silently make every portal
> advertise the wrong origin. It also carries a placeholder fallback. Rejected, and the
> reasoning is written into `lib/siteUrl.ts` so it is not re-litigated.
>
> **Files:** `lib/siteUrl.ts` ×3 (new, byte-identical) · `lib/siteUrl.test.ts` in
> `command` + `vendor` (new; booker has no unit-test runner — pre-existing gap, noted in
> conventions.md) · `app/layout.tsx` ×3.
>
> **No new binary asset.** Rather than `app/opengraph-image.png`, the metadata references
> the existing `/icons/icon-512.png`, so the installed PWA icon and the chat preview
> cannot drift apart — they are the same bytes. 512×512 square is the correct shape for
> `twitter.card: "summary"`.
>
> **Verified:** `tsc` clean ×3 · `npm run build` clean ×3 · 9 new unit tests green in both
> runners (`command` 61 pass, `vendor` 229 pass) · indexing-guard spec still 3/3 in all
> three · booker CSP spec still green.
> **V16 — the assertion this item exists for — passes in BOTH directions**, by building
> and serving `vendor` twice under different Vercel project identities:
> ```
> VERCEL_PROJECT_PRODUCTION_URL=staging-vendor.ezzy.ph → og:image https://staging-vendor.ezzy.ph/icons/icon-512.png
>                                                        no production hostname anywhere
> VERCEL_PROJECT_PRODUCTION_URL=vendor.ezzy.ph         → og:image https://vendor.ezzy.ph/icons/icon-512.png
>                                                        no staging hostname anywhere
> ```
> No `rel="canonical"` and no `og:url` emitted, per D3. `X-Robots-Tag`, robots.txt and the
> CSP all still present alongside the new tags — the OG work changed nothing about
> indexing.
> **Negative control:** a Vercel build with no resolvable site URL fails with
> `resolveSiteUrl: neither NEXT_PUBLIC_APP_URL nor VERCEL_PROJECT_PRODUCTION_URL is set…`.

### I7 — Brand placeholders would publish live if an env var went unset ✅ DONE (2026-08-21)

**Recommended.** *(Approach fixed by D4, 2026-08-21.)* **Files:** `command/lib/constants.ts:122-123`,
`booker/lib/constants.ts:67-68`, `vendor/lib/constants.ts:42-43`.

`APP_NAME` falls back to `"Josh Demo App"` / `"Josh demo app"` and `APP_DOMAIN` to
`"ang.booker.ni.josh"` / `"demo.app.ni.josh"` / `"ang.demo.app.ni.josh"`. Both feed
`<title>` and `<meta name="description">` in every layout. A `NEXT_PUBLIC_*` unset on one
Vercel environment publishes them — and `NEXT_PUBLIC_*` is baked at build, so it survives
until a cache-disabled redeploy. All six hosts are currently correct (live-checked), so
this is prevention, not repair.

**Fix approach** (D4 → option (a), 2026-08-21): keep the fallbacks for local dev, but make a **production build fail loudly** if the
variable is unset, in `next.config.ts` where the build already reads the environment:

```ts
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_APP_NAME) {
  throw new Error("NEXT_PUBLIC_APP_NAME is unset — a production build would ship the dev placeholder brand name.");
}
```

⚠️ Deliberately **not** a neutral-string fallback: a neutral default is *silently* wrong
in production, which is the failure mode being removed. A failed build is visible.
⚠️ Deliberately **not** removing the fallbacks: `npm run dev` with no `.env.local` would
start crashing, and that is a real cost for a hypothetical.

> **Executed 2026-08-21.** Guard added to all three `next.config.ts`.
> ⚠️ **Gated on `VERCEL`, not `NODE_ENV === "production"` as drafted.** A local
> `npm run build` is also `NODE_ENV=production`; the drafted version would have broken
> every developer's local build. Found while writing the negative control.
> ⚠️ **Falsy-after-trim, not an existence check** — same rule as
> `portalOrigins.server.ts`. Both `""` and `"   "` are treated as unset.
>
> **Verified — negative controls, since a guard that has never fired is not a guard:**
> `NEXT_PUBLIC_APP_NAME="" VERCEL=1 npm run build` → fails with the named error;
> `NEXT_PUBLIC_APP_NAME="   "` → same; normal builds clean ×3.
> ⚠️ Worth knowing for the next person: `env -u NEXT_PUBLIC_APP_NAME` does **not** work as
> a negative control — Next loads `.env.local` before evaluating `next.config.ts`, so the
> value comes back. Pass an explicit empty string.

---

### I8 — `architecture/conventions.md` misdescribes booker's payment flow ✅ DONE (2026-08-21)

**Recommended. Discovered during Stage 3.** **File:** `architecture/conventions.md`,
"Security headers are not the same thing, and `booker` still lacks them".

Two claims there are now false: booker no longer lacks security headers (I2), and the
doc instructs a future implementer to add `api.paymongo.com` to `connect-src` because
booker is "the only app with … a browser-side payment provider". It is not — the API
call is server-side and the browser only navigates. Left uncorrected, the next person to
touch that CSP will re-add a directive that describes a data flow which does not exist,
in the file where precision matters most.

**Fix approach:** update that subsection to record what shipped (including the CARTO
tile host and `geolocation=(self)`, with the reasons), and replace the PayMongo sentence
with the server-side reality. Fold into Stage 4 alongside I4, which edits docs anyway.

> **Executed 2026-08-21.** Three edits to `architecture/conventions.md`:
> (1) the "booker still lacks them" passage rewritten to record what shipped, with the
> CARTO tile host and `geolocation=(self)` spelled out and both former errors explicitly
> marked as having been wrong — a doc that quietly corrects itself teaches nobody;
> (2) the `api.paymongo.com` instruction replaced with the server-side reality;
> (3) a new subsection, "Open Graph metadata is per-deployment, and is not an indexing
> change", carrying the `resolveSiteUrl()` precedence and the three load-bearing ⚠️ rules.
> The env-var table gained a `VERCEL_PROJECT_PRODUCTION_URL` row and an expanded
> `NEXT_PUBLIC_APP_URL` row.

## DECISIONS

<!-- ⚠️ Hard gate: no item in this plan may execute while any OPEN: line remains. -->

**No open decisions — plan is eligible for execution approval.**

- **D1: Should the production portals be search-indexable?** → **No — keep all three
  `noindex`** (resolved 2026-08-21). Each app is a single client-rendered login route
  with no public content; the brand is already discoverable via the WordPress estate;
  `command` is an internal payout/approval portal. Re-opening this for `booker` requires
  the three-part gate in §4.5 (real server-rendered public content + `sitemap.ts` +
  `metadataBase`/canonicals), not a flag flip. **Consequence: `ALLOW_INDEXING` stays
  unset in every environment; no item in this plan sets it.**

- **D2: Should staging get an access gate on top of `noindex`?** → **No gate — `noindex`
  only** (resolved 2026-08-21, upholding 2026-08-02). A gate would break
  `booker/app/api/payment/webhook/route.ts` (PayMongo cannot present a bypass token) and
  the mobile clients' access to staging Route Handlers. Staging runs its own Supabase
  project (`fbxbwnfeimzhgxpshdpa`), so the effective boundary is Supabase Auth + RLS over
  non-production data — the same boundary production relies on.
  ⚠️ **Conditional, and the condition is not decorative:** this stops being acceptable
  the moment staging holds real personal data or an unreleased feature that must not be
  seen. `noindex` is not access control (§8). Revisit then, without waiting to be asked.

- **D3: Add Open Graph metadata + `metadataBase` (I6)?** → **Yes — OG only, still no
  `alternates.canonical`** (resolved 2026-08-21). Justified as a chat-link-preview fix
  (Messenger/Viber/WhatsApp onboarding), not as SEO, and independent of D1.
  ⚠️ **`metadataBase` must be derived per-deployment exactly as written in I6.** It is
  the single highest-risk change in this plan: hardcoded, it is precisely how a staging
  host leaks into production metadata. V16 exists to catch that and is not optional.

- **D4: How should the brand placeholder fallbacks be handled (I7)?** → **Keep the
  fallbacks, fail the production build when `NEXT_PUBLIC_APP_NAME` is unset** (resolved
  2026-08-21). A visible build failure over a silent publish; `npm run dev` keeps working
  with no `.env.local`.

- Resolved 2026-08-21 — **Keep `ALLOW_INDEXING`; do not migrate to `VERCEL_ENV` /
  `NODE_ENV`.** Not put to you as a question because the evidence is one-sided: staging
  is a separate Vercel project whose branch deploys carry `VERCEL_ENV=production`, so an
  environment-derived rule would make all three staging hosts indexable. See C3 / §6.
- Resolved 2026-08-21 — **No `sitemap.ts`.** Contradictory alongside `noindex`; belongs
  to future public-content work.
- Resolved 2026-08-21 — **No `metadata.robots` meta tag.** Re-examined, not inherited:
  the response header is a strict superset. See C2.
- Resolved 2026-08-21 — **Duplicate per app; no shared helper.** `architecture/conventions.md:42`.

---

## DEFERRED / COSMETIC

- ~~**`booker/app/page.tsx:Zone.Identifier`** (F8)~~ ✅ DONE (2026-08-21) — contents were
  `[ZoneTransfer] ZoneId=3`, a Windows download marker, confirmed junk before removal.
  `trash` is not installed on this machine, so it was **moved to the session scratchpad
  rather than `rm`'d**, keeping it recoverable per the AGENTS.md preference. Removed in
  the same change as I2, as planned.
- **`sitemap.ts`** — see Decisions. Acceptable to omit: there is nothing public to
  enumerate and its presence would contradict the `noindex` header.
- **Canonical URLs** — acceptable to omit, and actively desirable while `noindex`: their
  absence is what makes staging structurally incapable of emitting a production URL.
- **JSON-LD / structured data** — no entity worth describing behind a login gate.
- **`website/`** — gitignored, unrelated brand, points at `co99.win`. Recommend deleting
  it or moving it out of the workspace so it stops being mistaken for the marketing site
  (that mistake is already recorded in a plan — F7). **Not doing so here**: it is outside
  this plan's scope and deleting an untracked directory is unrecoverable.

---

## Security considerations

**The three controls are different things and none substitutes for another.** Stated
because conflating them is the standard way staging gets exposed:

| Goal | Control | In this repo |
|---|---|---|
| Prevent search-engine **indexing** | `X-Robots-Tag: noindex` (and `<meta robots>`) | ✅ header, all hosts, all responses |
| Prevent crawler **access** | `robots.txt` `Disallow` — *voluntary*, honoured only by well-behaved bots | ✅ present; ignored by anything malicious, and correctly not relied on |
| Prevent unauthorized **human** access | authentication / authorisation | ✅ Supabase Auth + RLS + per-route caller checks |

`robots.txt` and `noindex` are **not** security controls, and this plan proposes nothing
that treats them as such. Staging's protection is Supabase Auth + RLS against a separate
Supabase project — not obscurity. D2 accepts that consciously; it stops being acceptable
the moment staging holds real personal data.

Checked, and clean:
- **No secret reaches the client through any of this.** `ALLOW_INDEXING` is un-prefixed
  and read only in `next.config.ts` and `app/robots.ts`, both server-side —
  `grep -rn ALLOW_INDEXING` across all three apps confirms exactly two call sites each.
- **No internal URL or staging hostname is emitted in any portal's metadata.** No
  canonical, no `metadataBase`, no OG URL today. I6, if approved, must preserve that
  property via per-deployment derivation — it is the single highest-risk change in this
  plan and the reason its snippet is written out in full.
- **`robots.txt` enumerates nothing.** `Disallow: /` names no paths; the "on" branch adds
  only `Disallow: /api/`, which reveals a convention every Next app shares.
- **Crawler-reachable API surface is bounded.** 9 of 11 routes are POST-only.
  `vendor /api/divisions` is intentionally anonymous and returns division names only;
  `command /api/vendor-payout` returns 403 to anonymous callers (both live-verified).
  ⚠️ `/api/vendor-payout` is the only route that decrypts payout details — worth naming
  here precisely because a `Disallow` line must never be what protects it, and it is not:
  `verifyCommandCaller()` is.
- **The `noindex` header must not be flattened into the security-header entry.**
  `command/next.config.ts:92` and `vendor/next.config.ts:108` carry an explicit warning:
  merging them means every security header disappears the day indexing is enabled. I2
  must preserve that shape in `booker`.

---

## Testing / verification plan

| # | Check | Kind |
|---|---|---|
| V1 | `npx tsc --noEmit` clean in all three apps | machine |
| V2 | `npm --prefix <app> run build` succeeds in all three | machine |
| V3 | Default build: `curl -s localhost:<port>/robots.txt` → **HTTP 200** and `Disallow: /` | machine |
| V4 | Default build: `curl -sI localhost:<port>/` → `x-robots-tag: noindex, nofollow, noarchive` | machine |
| V5 | Default build: same header on `/manifest.webmanifest` (non-HTML surface) | machine |
| V6 | `ALLOW_INDEXING=1` rebuild: header **absent**, robots.txt shows `Allow: /` + `Disallow: /api/` — proves both directions, not just fail-closed | machine |
| V7 | I1(a) Playwright spec green in all three apps | machine |
| V8 | `grep -rn ALLOW_INDEXING <app>` returns only `next.config.ts`, `app/robots.ts` and `visual-tests/seo.spec.ts` — never a `NEXT_PUBLIC_` prefix. ⚠️ Amended 2026-08-21: the spec is a legitimate third reader (it must read what the app reads); it is a test file and never bundled — V9 is what proves that | machine |
| V9 | `grep -rl ALLOW_INDEXING <app>/.next/static/` returns **nothing** — the flag never reaches the client bundle | machine |
| V10 | No staging host appears in any production build's output: `grep -rn "staging-" <app>/.next/static/` → nothing | machine |
| V11 | I1(b) smoke script: OK on all six hosts | **needs live** |
| V12 | `command.ezzy.ph/manifest.webmanifest` → 200 after the I3 redeploy | **needs live** |
| V13 | `curl -sI https://booker.ezzy.ph` shows CSP + `X-Frame-Options` + `Referrer-Policy` + `Permissions-Policy` (after I2 enforces) | **needs live** |
| V14 | Booking wizard, map step and a PayMongo checkout complete with CSP report-only and **zero** violations, before enforcing | **needs live**, manual |
| V15 | `site:<host>` clean on Google and Bing, all six hosts + `*.vercel.app` aliases | **needs live**, lags deploy by days unless a Search Console removal is filed |
| V16 | If I6 ships: staging OG `url`/`image` resolve to the **staging** host and production's to the **production** host — `curl -s https://staging-booker.ezzy.ph \| grep -i 'og:'` must contain no production hostname, and vice versa | **needs live** |
| V17 | If I7 ships: `NEXT_PUBLIC_APP_NAME= npm run build` fails with the named error; with it set, builds clean | machine |

Local ports: `vendor` 3100, `booker` 3200, `command` 3100 (⚠️ collides with vendor —
`architecture/conventions.md`). Use `localhost`, never `127.0.0.1`.

---

## Execution order

Cadence is **one stage at a time** unless you say otherwise (`AGENTS.md`).

**Stage 1 — ✅ DONE (2026-08-21).** I1(a)+(b), plus prerequisites I1a and I1b.
→ V1, V2, V3, V4, V5, V6, V7, V8, V9, V10 all green; V11 green ahead of schedule.
**Files:** `<app>/visual-tests/seo.spec.ts` ×3 (new) · `scripts/check-indexing-guard.sh`
(new) · `command/.gitignore` · `booker/.gitignore` · `command/playwright.config.ts`.
**Not committed** — three separate repos; commits are yours to make.

**Stage 2 — ⏸ PARKED (2026-08-21).** Everything not requiring live-infrastructure
access or a Google account is done: I3 root-caused to a deploy fault (not a merge fault)
with branch-level evidence; I5's alias half closed by proving host-independence; V11
re-run green 6/6. **Two actions remain and both are yours:** the `command` production
redeploy with build cache disabled (I3), and the `site:`/Search Console coverage check
(I5). The Vercel project names are **no longer needed** — superseded by the
host-independence proof.
→ V11 ✅ · V12 blocked on I3 · V15 blocked on I5

**Stage 3 — ✅ DONE 2026-08-21 (code); report-only deploy still owed.** I2 + the F8
cleanup, in the same change as planned. Three planned CSP directives were corrected
against the code before shipping (see I2). New follow-up **I8** raised.
**Files:** `booker/next.config.ts` (rewritten) · `booker/visual-tests/csp.spec.ts` (new)
· `booker/app/page.tsx:Zone.Identifier` (removed).
→ V13 blocked on the deploy · V14 partially automated by `csp.spec.ts`; the wizard/
payment legs still need the live report-only pass

**Stage 4 — ✅ DONE 2026-08-21.** I6, I7, I4 and I8 (the latter raised during Stage 3).
**Files:** `lib/siteUrl.ts` ×3 · `lib/siteUrl.test.ts` ×2 · `app/layout.tsx` ×3 ·
`next.config.ts` ×3 · `.plans/2026-08-02-…md` · `architecture/conventions.md`.
→ V16 ✅ (both directions) · V17 ✅ (both negative controls)

**Per-app commits.** `command/`, `booker/` and `vendor/` are separate git repositories;
this root repo has none of their history. Three commits, made inside each app folder.

---

## Change summary by tier

**Required changes**
- ~~I1 — indexing-guard regression test + post-deploy smoke check (×3 apps, new files)~~ ✅ done 2026-08-21, with prerequisites I1a (gitignore) and I1b (port collision)
- ~~I2 — `booker/next.config.ts`: full security-header set, CSP derived, report-only first~~ ✅ code done 2026-08-21; report-only deploy owed
- I3 — `command` production cache-disabled redeploy (deployment, no code)
- I5 — `site:` index-coverage audit (live, no code). ⚠️ Alias verification no longer required — closed 2026-08-21 by proof of host-independence, not by enumeration

**Recommended improvements**
- ~~I4 — correct and close `.plans/2026-08-02-web-apps-search-engine-exposure.md`~~ ✅ 2026-08-21
- ~~I8 — correct `architecture/conventions.md` on booker's headers and payment flow~~ ✅ 2026-08-21
- ~~I6 — Open Graph metadata + per-deployment-derived `metadataBase`~~ ✅ 2026-08-21
- ~~I7 — fail the production build on an unset `NEXT_PUBLIC_APP_NAME`~~ ✅ 2026-08-21

**Optional enhancements**
- Delete or relocate `website/` so it stops being mistaken for the marketing site
- Fix `command`'s Playwright port collision (3100 ↔ vendor) and its `127.0.0.1` baseURL —
  pre-existing, unrelated, noted because Stage 1 adds a spec that runs under that config

**Explicitly not doing:** `sitemap.ts`; `metadata.robots` meta tags; canonical URLs;
JSON-LD; migrating `ALLOW_INDEXING` to `VERCEL_ENV`/`NODE_ENV`; any staging access gate.
Each is argued above rather than silently omitted.
