# WordPress Partner Routing — carry the affiliate referral code into the destination URL

**Date:** 2026-09-17
**App / scope:** `partner_routing/ezzy-partner-routing.php` (WordPress plugin on the `ezzy.ph` marketing site)
**Status:** COMPLETE (2026-09-17) — for this plan's scope. Deployed to ezzy.ph as 1.3.0.
B1, B2, I1 all ✅: machine-verified (35/35) and confirmed working on the live site by the
user. **V5 (an actual `vendor_referrals` row) remains outside this plan** — it is blocked on
affiliate-interim S3/B14, which is unstarted. The WordPress end emits `ref=` correctly;
nothing consumes it yet.

> Capture an affiliate referral code from a link landing on the WordPress marketing
> site, hold it for the visitor, and append it as `&ref=CODE` to the partner-modal
> destination URL so a vendor who signs up through `ezzy.ph` is attributed to the
> affiliate who sent them. Optimise for the smallest change that is actually correct.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision. Numbers are
> plan-local — qualify cross-plan refs by app (e.g. "affiliate-interim B14").

> **Companion plan:** `.plans/2026-09-17-affiliate-referral-codes-interim.md`
> (referred to below as **affiliate-interim**). It owns the `ref` contract, the code
> format, and the consuming code in `vendor/`. This plan owns only the WordPress end.

---

## Scope

**In:** reading `ezzy_referral_code` from the query string on the marketing site ·
normalising and validating it against the affiliate contract · persisting it per
visitor in a cookie for 30 days · appending `ref=<code>` to each active category's
destination URL and to the fallback URL, server-side, at enqueue time.

**Out:** any change to `assets/*.js` or `assets/*.css` (the user has excluded them,
and they are not present in this repo — see *Pre-existing condition* below) · any
change to `vendor/`, `command/` or `backbone/` · generating the inbound referral link ·
validating that a code belongs to a real affiliate (that is the vendor app's job,
affiliate-interim D2) · the eleven unrelated plugin findings recorded under
*Deferred* · any schema change (there is none — cookies are not server state).

---

## Corrections to earlier assumptions

Recorded because the first round of decisions was made before the affiliate contract
was read, and two answers were **wrong** as a result. Per plan-authoring §4.

| # | Initial assumption | Corrected to | Source |
|---|---|---|---|
| C1 | Outgoing parameter is `referrer` | **`ref`** | affiliate-interim `:283-288`, B14 |
| C2 | Codes are `[A-Za-z0-9_-]`, case preserved | **`^[A-Z0-9]{4,32}$`**, upper-cased, non-alphanumerics stripped | affiliate-interim `:218`, `:225-227` |

**Why C1 mattered.** affiliate-interim **D2** (`:922`) makes an unrecognised code fail
*silently* — no row written, no error surfaced, registration proceeds normally. A
`referrer=` parameter would therefore have looked correct in the URL bar and
attributed nothing, with no signal anywhere that it was broken.

---

## Flow, end to end

```
  Affiliate link                https://ezzy.ph/?ezzy_referral=1&ezzy_referral_code=josh
        │
        ▼  B1 — init hook, front end only
  normalise  "josh" → "JOSH"   (upper-case, strip non-alphanumeric)
  validate   ^[A-Z0-9]{4,32}$  → passes
  store      cookie ezzy_pr_referral = JOSH, 30 days, HttpOnly, SameSite=Lax
        │
        ▼  visitor browses the site freely; cookie survives navigation
  Partner button clicked → existing modal opens (assets untouched)
        │
        ▼  B2 — ezzy_pr_front_assets(), at wp_localize_script time
  each active category url += ref=JOSH   (via add_query_arg)
        │
        ▼  existing frontend.js redirects to the URL it was handed — unchanged
  https://vendor.ezzy.ph/?division=EzzyWell&ref=JOSH
        │
        ▼  blocked on affiliate-interim S3 / B14 — not built yet
  vendor app reads ?ref=, resolves the affiliate, writes vendor_referrals
```

The design point that keeps this cheap: **the destination URL is already built in
PHP**. `ezzy_pr_front_assets()` (`:1163-1175`) assembles every active category and
hands it to the front end via `wp_localize_script`. Injecting there means the
JavaScript keeps doing exactly what it does today — redirect to whatever URL it was
given — so no asset file has to change.

---

## BLOCKERS

### B1 — Capture and persist the code  ✅ DONE (2026-09-17)
**File:** `ezzy-partner-routing.php` — new functions, hooked on `init`

No code exists today to read any query parameter. `$_GET` alone is insufficient: it
exists only on the request that carried it, so a visitor who lands on the referral
link and then navigates anywhere before clicking the partner button would lose the
code entirely (D1).

**Fix approach:** two new functions.

1. `ezzy_pr_normalise_referral_code( $raw )` — `strtoupper()` after
   `preg_replace('/[^A-Za-z0-9]/', '', $raw)`, then return it only if it matches
   `^[A-Z0-9]{4,32}$`, else `''`. Mirrors affiliate-interim `:225-227` exactly (D6).
2. `ezzy_pr_capture_referral_code()` on `init`, guarded to the front end
   (`is_admin()`, `wp_doing_ajax()`, `wp_doing_cron()` all return early). Reads
   `$_GET['ezzy_referral_code']`, normalises, and on success writes the cookie
   **and** assigns `$_COOKIE['ezzy_pr_referral']` in-process.

**Cookie parameters:**

| Attribute | Value | Why |
|---|---|---|
| Name | `ezzy_pr_referral` | Matches the plugin's existing `ezzy_pr_` prefix convention |
| Expiry | `time() + 30 * DAY_IN_SECONDS` | D2 |
| Path / domain | `COOKIEPATH` / `COOKIE_DOMAIN` | WordPress constants; correct for the single-host case (D8) |
| `secure` | `is_ssl()` | |
| `httponly` | `true` | The front-end JS never needs to read it — injection is server-side. Removes it as an XSS target |
| `samesite` | `Lax` | Set on a top-level GET navigation, read on later same-site navigations. `Strict` would drop it when arriving from an external referral link |

**Two details that will silently break it if missed:**

- `setcookie()` does **not** populate `$_COOKIE` for the current request. Without the
  in-process assignment, a visitor who lands on the referral link and clicks the
  partner button *on that same page load* gets no code — the most likely path of all.
- `setcookie()` must run before output. `init` is before `wp_head`, so this is safe,
  but the admin/AJAX/cron guards matter because `init` also fires there.

`ezzy_referral=1` is ignored — presence of a valid code is the only trigger (D4).

**Executed 2026-09-17.** `ezzy_pr_normalise_referral_code()`, `ezzy_pr_capture_referral_code()`
and the `init` hook added at `:1167-1192`; constants at `:15-18`. Verified V1–V3 plus the
extended machine checks below (35/35). **V4a confirmed the live `$_GET` branch**, and the
user confirmed the full behaviour on ezzy.ph on 2026-09-17, including the cookie branch
(land, navigate away, then click) that `$_GET` alone could not deliver.

### B2 — Append the code to the destination URLs  ✅ DONE (2026-09-17)
**File:** `ezzy-partner-routing.php:1163-1175` (`ezzy_pr_front_assets`)

Currently the active categories are passed through untouched:
`'categories' => array_values(array_filter(ezzy_pr_get('ezzy_pr_categories'), fn($x)=>!empty($x['active'])))`.

**Fix approach:** a third new function `ezzy_pr_get_referral_code()` returning the
live code — check `$_GET` first (covers the same-request case), fall back to
`$_COOKIE`, normalising and validating **both** rather than trusting the cookie
(a cookie is user-controlled input and must be re-validated on read). Then in
`ezzy_pr_front_assets()`, when the code is non-empty, map over the filtered
categories applying `add_query_arg( 'ref', $code, $cat['url'] )`, and apply the same
to `fallback_url` when it is set (D5).

**Why `add_query_arg()` and not concatenation:** every current destination URL
happens to carry `?division=…`, so `'&ref=' . $code` would work *today* and break
the moment someone saves a category URL with no query string. `add_query_arg()`
picks `?` or `&` correctly, url-encodes the value, and overwrites rather than
duplicates an existing `ref`.

**When no code is present, the localized array must be byte-identical to today.**
This is the property that makes the change safe for the ~100% of visitors who arrive
without a referral link, and it is the first thing to verify.

**Executed 2026-09-17.** `ezzy_pr_get_referral_code()` at `:1194-1204`; injection at
`:1210-1217`; payload now reads `$categories` / `$fallback_url` at `:1221-1222`.
Verified V1–V3 plus extended checks (35/35). **V4a confirmed injection reaches the live
payload correctly**, and the user's click-through on 2026-09-17 settled the open question
from *Pre-existing condition* — the live `frontend.js` does redirect to the category `url`
verbatim rather than rebuilding it.

---

## IMPORTANT

### I1 — Version bump  ✅ DONE (2026-09-17)
**File:** `ezzy-partner-routing.php:4` and `:12`

`Version: 1.2.0` in the header and `EZZY_PR_VERSION` are separate literals that must
be kept in step; `EZZY_PR_VERSION` is the cache-buster on every enqueued asset.
Bump both to `1.3.0`. Missing this means browsers keep the old cached assets — and
although no asset *content* changes here, leaving the version stale on a behavioural
release removes the only signal of which build is live.

**Executed 2026-09-17.** Header `:5` and `EZZY_PR_VERSION` `:12` both `1.3.0`. Verified by
diff — the only two occurrences of `1.2.0` in the file, now consistent.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains — plan-authoring §7. -->

All resolved 2026-09-17.

- **D1 — Persistence model → cookie, per visitor.** `$_GET` is the capture mechanism
  but cannot be the storage; a site-wide option would attribute every visitor to
  whoever landed most recently.
- **D2 — Cookie lifetime → 30 days.** Standard attribution window; covers a vendor
  who researches for a few weeks before registering.
- **D3 — Repeat visits with different codes → last touch wins.** Each valid code
  overwrites. No "already set" check needed, which is also the simpler code path.
- **D4 — `ezzy_referral=1` → ignored.** A valid `ezzy_referral_code` is the sole
  trigger. Tolerant of a generator that ever drops the flag.
- **D5 — Outgoing parameter name → `ref`.** Corrected from `referrer` (C1). Matches
  affiliate-interim `:283-288`.
- **D6 — Code handling → normalise identically to the vendor app.** Upper-case, strip
  non-alphanumerics, require 4–32 chars, discard otherwise (C2). The vendor app
  normalises on arrival regardless, so this is not strictly required for matching —
  it is chosen because it keeps emitted URLs clean and debuggable, and rejects
  malformed or hostile input at the door rather than propagating it.
- **D7 — Incoming parameter name → `ezzy_referral_code`, fixed.** An external
  generator already emits this name; it is a hard contract and cannot be changed here
  without updating that generator. Its `ezzy_` prefix also guards against collision
  with a theme or Elementor parameter on the marketing site.
- **D8 — Host scope → single host.** The referral link lands on `ezzy.ph` and the
  partner-trigger button is on `ezzy.ph`, one WordPress install. Default
  `COOKIE_DOMAIN` is therefore correct; no `.ezzy.ph` cross-subdomain cookie needed.
- **D9 — Sequencing → build and ship now.** An unread `?ref=` is inert, so this can
  go live ahead of the vendor work and begins attributing the moment S3 lands.

---

## Couplings

- **⚠ B2 ↔ affiliate-interim B14 / stage S3.** B14 (`vendor/lib/referralDeepLink.ts`,
  module-load `?ref=` capture) is ⬜ TODO, and stages S2–S4 are all unstarted. **Nothing
  reads `?ref=` today.** These do *not* need to ship together (D9), but **end-to-end
  verification of this plan is blocked until S3 is deployed.** Until then only the
  WordPress half is verifiable — see *Verification*.
- **⚠ Inbound link generator — unowned.** affiliate-interim `:648` has Command
  generating `resolvePortalOrigin(["vendor"]) + "/?ref=" + code`, a link straight to
  `vendor.ezzy.ph`. The marketing site is **not mentioned anywhere** in that plan, so
  the `https://ezzy.ph/?ezzy_referral=1&ezzy_referral_code=…` shape this plan consumes
  is a **second entry point** owned by something outside this repo. Per D7 that
  generator already exists; if it is ever regenerated from Command, the `ezzy_referral_code`
  name must be preserved or this silently stops capturing.
- **No coupling to the plugin's missing assets.** Because injection is server-side,
  this plan is unaffected by `assets/*` being absent from the repo.

---

## Pre-existing condition — not addressed here

`ezzy_pr_admin_assets()` (`:78-84`) and `ezzy_pr_front_assets()` (`:1163-1175`) enqueue
`assets/admin.css`, `assets/admin.js`, `assets/frontend.css` and `assets/frontend.js`.
**None of these exist in this repository** — `git ls-files` returns only the PHP file,
and the sole commit (`2816623 initial partner routing`) added nothing else. The live
site evidently has them, since the dashboard screenshot shows a working icon picker.

This plan does not depend on them and does not fix the gap. It is recorded because
**anyone deploying from this repo alone would ship a broken plugin**, and because B2's
correctness rests on the assumption that the live `frontend.js` redirects to the
category `url` verbatim without rebuilding it. That assumption is unverifiable from
this repo — see *Verification*, V4.

---

## DEFERRED / COSMETIC

Found while reading the plugin, all out of scope for this change. Recorded so they are
not lost, not because they should be fixed now.

| # | Finding | Why deferred |
|---|---|---|
| 1 | Missing `assets/` directory (above) | Live site has them; not this change's problem |
| 2 | 986 Font Awesome icons hardcoded at `:96-1085`, ~84% of the file, all rendered as DOM buttons per admin page load | Admin-only performance; no bearing on routing |
| 3 | SVG upload enabled for admins (`:53-59`) with no apparent consumer — an XSS vector | Real, but a separate security change with its own approval gate |
| 4 | Font Awesome loaded from cdnjs on **every** front-end page | Separate performance/privacy change |
| 5 | Front-end assets enqueued on every page regardless of trigger presence | Same |
| 6 | No i18n — no `Text Domain` header, no `load_plugin_textdomain()`, and `:71` references a domain that is never declared | Whole-plugin change |
| 7 | No `uninstall.php` or deactivation hook — all three options orphaned on delete | Separate housekeeping |
| 8 | Platform `url` / `partner_url` / `active` are never read on the front end; only category `url` drives the redirect | Design question, not a defect |
| 9 | `sanitize_title($_POST['id'] ?: $_POST['name'])` — same-named categories collide; no explicit ordering field | Pre-existing |
| 10 | Plugin header lacks `Requires at least`, `Requires PHP`, `Text Domain`, `Plugin URI` | Cosmetic (note: arrow functions at `:89`, `:1131`, `:1146`, `:1174` already require PHP 7.4+) |
| 11 | No shortcode and no block — trigger is a hand-added CSS class only | Works as designed |
| 12 | **`$_POST` is never unslashed.** 8 `$_POST[` reads, 0 `wp_unslash()`. WordPress slashes superglobals via `wp_magic_quotes()`, so `Can't` is stored as `Can\'t` — visible in the live payload as `"fallbackText":"Can\\'t find your business?"`. Backslashes **accumulate on every re-save** because the slashed value is re-submitted by the edit form | Pre-existing, admin-side, unrelated to referral routing. Real and worth fixing, but a separate change — flagged 2026-09-17, not silently folded in |

---

## Execution order

One stage. The three items are a single coherent change to one file and are not
independently useful — B1 without B2 captures a code nothing consumes; B2 without B1
finds no code to append.

1. **B1** — normalise + capture functions, `init` hook.
2. **B2** — read function, injection in `ezzy_pr_front_assets()`.
3. **I1** — version bump to `1.3.0`.
4. Run V1–V3. Report. Leave V4–V5 open against affiliate-interim S3.

**Files touched: one.** `partner_routing/ezzy-partner-routing.php`. No new files, no
asset changes, no schema change, no new dependency, no approval gate triggered.
Estimated ~40 lines added, ~3 modified.

---

## Verification

| # | Check | Kind |
|---|---|---|
| V1 | `php -l` passes | ✅ **DONE (2026-09-17)** — PHP 8.3 in docker (`php:8.3-cli`); no syntax errors |
| V2 | Normalisation unit-check across the real cases: `josh`→`JOSH`, `CODE1`→`CODE1`, `juan-2026`→`JUAN2026`, ` JUAN 2026 `→`JUAN2026`, `jo`→`''` (too short), 40 chars→`''`, `<script>`→`SCRIPT` then length-checked, `''`→`''` | 🤖 machine — standalone PHP harness, no WordPress needed |
| V3 | No-code path byte-identical | ✅ **DONE (2026-09-17)** — with no `$_GET`/`$_COOKIE`, `categories` matches the raw active filter exactly and no `ref` appears anywhere in the payload |
| V3a | Injection correctness | ✅ **DONE (2026-09-17)** — `?`-vs-`&` selection, pre-existing `ref` overwritten not duplicated, inactive categories still excluded, fallback URL appended |
| V3b | Cookie path + tamper resistance | ✅ **DONE (2026-09-17)** — cookie drives append after navigation; `$_GET` beats cookie (last touch, D3); hostile/short cookie re-validated on read; `setcookie()` in-process `$_COOKIE` assignment confirmed |
| V4 | Live: land on `ezzy.ph/?ezzy_referral=1&ezzy_referral_code=josh`, navigate to another page, open the partner modal, pick a category, confirm the browser lands on `…?division=EzzyWell&ref=JOSH` | 🤝 **needs live site** — also the only way to confirm the live `frontend.js` redirects to the category `url` verbatim (see *Pre-existing condition*) |
| V5 | End-to-end: the above signup writes a `vendor_referrals` row for the matching affiliate | 🤝 **blocked on affiliate-interim S3/B14** — cannot be run until the vendor app reads `?ref=` |

V4 was satisfied by the user on the live site (2026-09-17); B1/B2 moved to ✅ on that basis.
**V5 was not, and cannot be until affiliate-interim S3/B14 ships** — see *Couplings*. Until
then `ref=JOSH` rides along in the URL and is read by nobody, which is the intended interim
state (D9), not a defect.

**Harness:** WordPress stubbed (incl. a faithful `add_query_arg`), the real plugin file
`require`d unmodified, run under `E_ALL` with `display_errors` on — no notices or warnings
emitted. 35/35 assertions passed. Kept in the session scratchpad, not committed: it stubs
WordPress rather than loading it, so it is a correctness check, not a test suite to maintain.

### Risk if the site ever gains a page cache

D8 and the design assume **no page caching** on `ezzy.ph` (confirmed 2026-09-17). The
code is baked into the HTML by `wp_localize_script`, so if WP Rocket, LiteSpeed, W3TC,
WP Super Cache, Cloudflare APO or host-level HTML caching is added later, **one
visitor's referral code can be served to another visitor from cache** — silent
mis-attribution, not an error. If caching is introduced, this plan must be revisited:
either exclude pages carrying the cookie from the cache, or move the injection
client-side (which would require touching `frontend.js`, currently out of scope).


---

## Closed out

**2026-09-17 — plan COMPLETE for its scope.** Shipped: referral capture, 30-day per-visitor
cookie, and `ref=` injection into every active category URL, in one file, with no asset,
schema or dependency change. Verified by 35 machine assertions and by the user on the live
site.

**Carried forward, deliberately not done here:**

1. **V5 / real attribution** — blocked on affiliate-interim **S3/B14**. When that ships,
   verify a signup through the marketing site writes a `vendor_referrals` row. Remember the
   affiliate must exist with the code **exactly as normalised** (`josh` → `JOSH`), or
   affiliate-interim **D2** drops it silently.
2. **Finding 12 — `$_POST` never unslashed** (Deferred table). Real, escalating, admin-side.
   Offered to the user 2026-09-17; not taken up in this change.
3. **Findings 1–11** (Deferred table) — unchanged, including the `assets/` directory being
   absent from this repo, which still means **this repo alone is not deployable as a folder**.
