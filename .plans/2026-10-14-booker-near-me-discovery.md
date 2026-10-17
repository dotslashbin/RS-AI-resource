# Booker — "Near me" offering discovery (city-first, PH)

**Date:** 2026-10-14
**App / scope:** `booker/` web only. No `vendor/` change proposed. **No migration required in any
approved stage** — see §8.
**Status:** IN PROGRESS — **every stage is BUILT and verified: S1 ✅, S2 ✅ (2026-10-15), S3 ✅,
S3b ✅ and S3c ✅ (2026-10-16). The map draws OpenFreeMap tiles in both themes with no account and
no API key, and `csp.spec.ts` proves the policy allows it.** All gates are taken (G1, G5, G6a, G6b,
G7, G8, G9, **G3**). **S3d (I6 — code-keyed popularity) is DONE on local as of 2026-10-16**:
migration `20261016000001_popular_offerings_by_city_code.sql` applied by the user, one overload
with `p_city_code`, **no `anon`**, and **proven** by `.plans/scripts/s3d-popular-city-code-proof.sql`
— two municipalities both named `Pilar` keep their 28 and 7 bookings apart where the name-keyed
version pooled them (5/5 assertions, fixture rolled back). A pre-apply review the same day cleared
the SQL on ten checks; its one blocker — the migration sitting on a `backbone/develop` that was
missing three migrations — was resolved by merging `feature/booker_gaps` into `develop` (**F26**).
⚠️ **What remains for S3d is the HOSTED apply** (staging, then production), with the overload query
run there first. Otherwise what remains is **not construction**: **the live checks, and U4**.
⚠️ **A DIRECTION WAS SET FOR THE PARKED GEO WORK on 2026-10-16 — see D11.** "Near" is capped at
**barangay**; the booker's position may come from the free device API (which **reverses D4** and
**restores gate G2**); a vendor's address is **never** sent to a geocoding provider, so P2 stays
parked and U1/U2 are moot. **Nothing in D11 is built** — it governs P1, P1a and P4, all parked, and
all blocked on one unanswered question: whether a licensed, PSGC-keyed **barangay centroid dataset**
exists. Recorded for later reference in `architecture/portals.md` → "How far 'near' is allowed to go".
**Successor plan drafted 2026-10-16: `.plans/2026-10-16-booker-barangay-near.md`** — it carries P1,
P1a and P4 forward and is DRAFT with **five** open decisions. ⚠️ **That plan supersedes this one for
all barangay and device-location work**; this plan keeps only its own S1–S3d record.
✅ **Its U1 is resolved and the barangay dataset DOES exist** (measured 2026-10-17): a licensed,
PSGC-keyed coordinate set joins **99.8%** of booker's barangay codes, so **both** forms of P1 are
buildable. ⚠️ An earlier line here said it "largely does not exist" at ~28% — an inference, not a
measurement, and wrong; the correction and its lesson are in the successor plan's U1.
Previews sign-off was **given 2026-10-16**; **F5 was closed** the same day (the user declined the
`useSyncExternalStore` fix, so 18 lint problems is the agreed baseline, not a carried regression);
**F13 was deleted** and **F21 fixed** by a permanent city legend under the map.
⚠️ **This plan does NOT flip to COMPLETE on the strength of the build.** The three live checks
(360 px phone, runtime theme flip with the map open, ordering across provinces) and **U4** are
unverified, and U4 can only be answered against the hosted DB. The user began live testing and a
staging deploy on **2026-10-16**; the status flips when those come back, not before.
⚠️ **F14 is RESOLVED and this line used to say otherwise** — the "no basemap" blocker was real on
2026-10-16 and was closed the same day by **D7** (MapLibre GL + OpenFreeMap, no account, no key).
All 10 decisions resolved (D1–D6, D-U3 on 2026-10-14; **D7–D9 on 2026-10-16**); G1 given 2026-10-15
for S1–S3, **G5** 2026-10-16 for S3b, **G7, G8 and G9** 2026-10-16 for S3c. **U3 is CLEARED** (2026-10-16): a licence-clean, PSGC-keyed centroid dataset was sourced at
**100% coverage of all 1,634 municipalities**, so the conditional branch that would have parked S3
and S3b did not fire. **G5, G6a and G6b are all taken.**

> One-line framing: make *where the customer is* a first-class, remembered part of Booker's shopping
> page, and rank offerings by **city first**, using only location data this platform already stores —
> optimising for an honest answer over a precise-looking one.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** V# = Verified finding, B# = Blocker, I# = Important, D# = Decision,
> P# = Parked, X# = Rejected alternative. Numbers are plan-local — qualify cross-plan refs by app
> and plan (e.g. "booker-home-search-redesign P11").

> **Previews:** [`.plans/previews/near-me/`](previews/near-me/README.md) — 11 screens × desktop/phone
> × light/dark, built 2026-10-14 before execution. ⚠️ **Read its first section before describing the
> map to anyone**: a marker is a *city with a vendor count*, never a vendor pin.

> **Predecessor:** this plan **supersedes `P11` ("Proximity / radius filtering", ⏸ PARKED 2026-09-25)**
> in `.plans/2026-09-18-booker-home-search-redesign.md:2486`, and its finding `F37`
> (`:265-279`). It is also the unblock condition for `P2` in
> `.plans/2026-09-25-booker-mobile-redesign.md:238` — **mobile is explicitly out of scope here.**

---

## 1. Scope

**Asked:** surface nearby offerings prominently at the front of Booker's shopping page (Home), and
give the search page (Explore) a "Near me" capability that clearly separates a *location filter*
from a *proximity sort*, ranking the customer's own city/municipality first and approximate
address-derived proximity second.

**In scope:** `booker/` web — `components/home/`, `components/explore/`, `components/layout/AppShell/`,
`lib/`, `services/offerings.service.ts`, `booker/public/`, `booker/next.config.ts` (one header token,
gated).

**In scope by decision (2026-10-14):** the full 1,634-municipality PSGC picker (D2), the four-tier
ranking ladder including the free PSGC region tier (D3), the bundled city-centroid dataset (D1, D6),
and **a city-level map** (D5) — see §6.4 for what "city-level" means and why it is not a vendor-pin
map.

**Explicitly out of scope:**
- `vendor/` and `command/` — no change proposed or implied (see §7).
- `ezzy-booker-mobile` / `ezzy-vendor-mobile` — parity is a separate plan.
- **Browser geolocation / "Use my location"** — D4 resolved: not shipping. `Permissions-Policy:
  geolocation=()` **stays as it is** (B4 ✖ ABORTED).
- Radius filtering ("within 2 km"). Not possible honestly at city granularity; see **X3**.
- **Street-level per-vendor geocoding, and therefore per-vendor map pins.** Stage 4, a separate plan
  (P2). This is the boundary that keeps the approved map honest.

**Cross-app flag:** none. This is single-app work. The only cross-cutting artefact is a ~108 KB
reference dataset already living in `vendor/public/` that would be **copied** (not shared — root
`AGENTS.md`: these are independent repos with no shared build tooling).

---

## 2. Verified findings

Every item below was checked by opening the file, running the dataset through `python3`, or fetching
the provider's own documentation. Where something is a proposal or an unknown it says so.

### V1 — Vendor addresses are fully structured PSGC, not free text ✅ CONFIRMED

`vendors` carries, per `architecture/schema.md:248-256` and migrations
`20260722000001_vendor_address_fields.sql` / `20260722000002_vendor_barangay_strict.sql`:

| Column | Nature |
|---|---|
| `address_line1` | street / building — **free text**, the only free-text part |
| `barangay` + `barangay_code` | strict pick from PSGC, filtered by city |
| `city` + `city_code` | strict pick from PSGC, filtered by province — **city *or* municipality**, one column |
| `province` + `province_code` | strict pick from PSGC, incl. 3 synthetic pseudo-provinces |
| `zip_code` | free text, 4 digits typical |
| `address` | the formatted display string, recomputed by `vendor/lib/address.ts` `formatFullAddress()` on every write. Booker **only reads** it |

So the four-level hierarchy (province → city/municipality → barangay → street) already exists, is
code-keyed above street level, and is **not** free text. This is the single most important finding:
the primary discovery criterion the feature needs is already stored, validated, and strict.

### V2 — One operating address per vendor. No multiple service locations ✅ CONFIRMED

There is exactly one address per `vendors` row and no `vendor_branches` table.
`vendors.branches` (`20260516000001_vendors_region_branches.sql`) is a **smallint count** entered by
Command admins, not a list of locations — `architecture/schema.md:299` states plainly that
per-branch locations would need a dedicated `vendor_branches` table and that neither existing column
should be repurposed. `vendors.region` is a free-text Command field, defaulted to `''` at
self-registration (`schema.md:264, 290`) — **not usable as geography.**

Consequence: the address on the vendor row *is* the delivery location, and the question "can vendors
have multiple service locations?" answers **no, not today**. The model is "customer travels to the
vendor" — see V4.

### V3 — Booker already reads city and province, but **not** the codes ✅ CONFIRMED

`booker/services/offerings.service.ts:69` selects
`vendors!inner(id, name, city, province, address, phone, tagline, operating_hours, divisions(...))`
and maps it to `CatalogueVendor` (`booker/lib/types.ts:124-134`), which has `city: string` and
`province: string` — **display names only, no `city_code` / `province_code`.**

Adding the two code columns is a **select-list change only**: the booker's read policy
(`20260515000001_booker_vendor_read_policy.sql`) is row-scoped on active vendors, so it already
authorises every column of a row the booker can see. **No RLS change, no grant change, no migration.**

### V4 — There is no customer address anywhere in the system ✅ CONFIRMED

`profiles` (`architecture/schema.md`, `### profiles`) has `full_name, email, phone, notes, status_id,
created_at, updated_at` — **no address, city or coordinate column.** `bookings` has no address column
either. The only `address` Booker handles anywhere is the **vendor's**
(`booker/lib/types.ts:53`, `booker/services/bookings.service.ts:109`, used for the detail screen and
the directions link).

So "use the customer's saved address" is not an option that exists — it would require a migration plus
a Settings UI (**X2**, rejected for this scope).

### V5 — Booking history already reveals the customer's city, for free ✅ CONFIRMED

`booker/services/bookings.service.ts:109,123` already selects `vendors(... city ...)` and exposes it as
`booking.vendorCity`. For any returning customer the most recent booking's vendor city is a
zero-permission, zero-PII, zero-network signal for *where this person books*. This is the recommended
default city source (I2) and it was not considered by the predecessor plan.

### V6 — A city filter already exists; it is just invisible on the shopping page ✅ CONFIRMED

| Piece | Where | State |
|---|---|---|
| The city value | `components/layout/AppShell/useAppShell.ts:105` — `useState<string \| null>(null)` | **in-memory only, defaults to null, never persisted** |
| The only control that sets it | `components/explore/ExplorePage/ExplorePage.tsx:108-117` — a native `<select>` labelled "Where", options `"Anywhere"` + `cityOptions()` | Explore only |
| Options source | `lib/search.ts:151-153` — distinct `v.city` display names from the catalogue, sorted | |
| Home consumes it in 3 shelves | `useHomePage.ts:60-61` (Available-today candidates), `:141-143` (`cityVendors`, `.slice(0,3)`), `PopularShelf city={city}` (`HomePage.tsx:170`) | **Home has no control to set it** |

So on a first visit `city` is `null`, Home's three location-aware shelves run unfiltered, and nothing
on the shopping page tells the customer a location concept exists. **The gap this feature fills is
mostly promotion and persistence of a mechanism that is already built** — which is why the
recommended first stage is small.

### V7 — The existing city filter is ambiguous across provinces ⚠️ CONFIRMED DEFECT (pre-existing)

Measured against `vendor/public/ph-address/cities.json` (1,634 cities/municipalities, 84 provinces):

- **114 city/municipality names are duplicated across provinces.** Worst offenders: `Burgos` ×6,
  `Buenavista` ×5, `Alicia` ×3, `Bato` ×3.
- `cityOptions()` de-duplicates on the **display name** (`lib/search.ts:152`), so two different
  municipalities collapse into one `<option>`.
- `searchCatalogue`'s predicate is `v.city === city` (`lib/search.ts:101`), so selecting that one
  option matches vendors in **every** same-named municipality in the country.
- `get_popular_offerings` has the same shape: `lower(v.city) = lower(p_city)`
  (`backbone/supabase/migrations/20260927000001_popular_offerings_rpc.sql:121`).

Severity: real but currently **low-impact** — it needs two vendors in two same-named municipalities to
be observable, and the catalogue is small. It becomes a correctness problem the moment this feature
makes city selection prominent. → **B1**.

### V8 — Explore is **not** server-paginated, so ranking has no pagination problem ✅ CONFIRMED

`getCatalogue()` (`services/offerings.service.ts:59-118`) pulls the **whole** active catalogue through
`fetchAllPages` (ceiling 10,000 rows, `lib/pagedFetch.ts:59`) **once per session**, cached by the
shell. Explore then filters in memory (`useExplorePage.ts:97-100`) and renders a client-side
**reveal** slice — `PAGE = 24` (`useExplorePage.ts:12`), `results.services.slice(0, visibleCount)`
(`:125`), with "show more" adding another 24 (`:181`).

This is the clean answer to the ranking/pagination question: **sorting is inserted between
`searchCatalogue()` and the `.slice()`**, so it ranks the full matched set, never a page of it. No
server-side ordering, no keyset pagination, no RPC is required. `reveal` already resets on a filter
change via `filterKey` (`:122-124`) — the sort key must join that signature (B3).

### V9 — The PSGC reference dataset exists in the workspace, has no coordinates ✅ CONFIRMED

`vendor/public/ph-address/`:

| File | Size | Shape |
|---|---|---|
| `provinces.json` | 4 KB | `{code, name}` × 84 |
| `cities.json` | 108 KB | `{code, name, provinceCode}` × 1,634 |
| `barangays/<cityCode>.json` | 6.6 MB total | `{code, name}` × ~42,000 |

Loaded lazily and module-cached by `vendor/components/address/AddressFields/useAddressFields.ts:28-48`.
**No latitude or longitude in any of it.** `booker/public/` does not have it at all.

### V10 — PSGC **region** is derivable from the stored `city_code` with no new data ✅ CONFIRMED (new)

Measured: all 1,634 `cities.json` codes are **9-digit numeric**, and the first two digits are the PSGC
region — 17 distinct prefixes (`01`–`12`, `13` = NCR, `14`–`17`), counts per region verified.

This matters because it gives a **third, free ranking tier** (same city → same province → same region
→ elsewhere) with no dataset, no API and no migration. Note it must be derived from **`city_code`**,
never `province_code`: the latter is non-numeric for the three synthetic pseudo-provinces (V11).

Caveat, measured: **7 duplicate municipality names occur within one region** (`Looc`, `Loreto`,
`Parang`, `Pontevedra`, `San Enrique`, `Tagoloan`, `Valencia`), so a region prefix does **not**
disambiguate a name either. Only the code does. → B1.

### V11 — Correction to the predecessor plan's "data-quality" warning ⚠️ DOWNGRADE

`.plans/2026-09-18-booker-home-search-redesign.md:272-274` warns:

> `province_code` is not uniformly numeric — the Quezon City row stores `NCR` where the others store
> 9-digit codes.

That is **not a data-quality defect.** It is the documented design: `schema.md:254-255` records three
**synthetic pseudo-provinces** (`NCR` → "Metro Manila", `ISABELA-CITY`, `COTABATO-CITY`) covering the
19 PSGC cities that have no real province. Verified in the dataset: exactly 3 non-numeric province
codes, covering 17 + 1 + 1 cities; **0 cities have an unknown `provinceCode`**. Verified in
`backbone/supabase/seed.sql:310,555,561,579,585` — every NCR vendor stores `province_code = 'NCR'`
with a numeric `city_code`.

The *operational* advice survives in a better form: **key every join and filter on `city_code`**, which
is uniformly numeric and unique, and treat `province_code` as an opaque group label (which is all this
plan needs it for). The pseudo-province is in fact a **feature** here — it groups all 17 Metro Manila
cities into one proximity tier, which is the behaviour a Metro Manila customer wants.

### V12 — No geocoding, no map, and geolocation is switched off at the header ✅ CONFIRMED

- `grep -rn -i "geocod|nominatim|mapbox|googleapis|opencage"` across `booker vendor command backbone`
  returns **no integration anywhere** — only `vendor/lib/address.ts:10`'s comment that
  `formatFullAddress()` orders parts the way "geocoders resolve a free-text query left-to-right", and
  font-CSP notes. There is no provider, key, quota or cache in this workspace today.
- Booker has **no map**: Leaflet was removed and uninstalled 2026-09-22 (`booker/AGENTS.md`, Maps row;
  `next.config.ts` CSP comment block).
- `booker/next.config.ts` keeps `TILE_HOST = "https://*.basemaps.cartocdn.com"` in `img-src`
  **deliberately**, for a future vendor-pin map. ⚠️ It is **CARTO, not OpenStreetMap** — guessing the
  OSM host blocks every tile silently.
- ⚠️ **`Permissions-Policy: geolocation=()`** (`next.config.ts`, `securityHeaders`). A
  Permissions-Policy denial is **silent** — `getCurrentPosition` simply never calls back. Any
  device-location feature must flip this token **in the same change**, and that is a security-header
  change → approval gate (B4).
- The predecessor's note is confirmed and worth repeating: **vendor pins never need `geolocation`**;
  only the *customer's own* position does. The two are separate features.

### V13 — `formatFullAddress()` already emits a geocoder-friendly string ✅ CONFIRMED

`vendor/lib/address.ts:14-16` →
`"<line1>, <barangay>, <city>, <province> <zip>, Philippines"`, specific-to-general, every write path
funnelled through it so `vendors.address` is uniform by construction. If street-level geocoding is
ever done (Stage 4), the input string is already standardised and already readable by Booker — no
Vendor change needed to produce it.

### V14 — PSGC display names are in PSGC form, not colloquial form ✅ CONFIRMED

From `seed.sql:287-310` and the dataset: `City of Tagum`, `City of Makati`, `City of Taguig`,
`City of Pasig`, `City of Mandaluyong`, `Pila`, but `Quezon City`. A customer picker that shows raw
PSGC names will offer "City of Makati" where every Filipino types "Makati". → I5 (display-label
normalisation, strictly presentational — the stored name and code are never rewritten).

---

## 3. Approved scope (D1 = Stages 1+2+3, resolved 2026-10-14)

| Stage | What it is | Needs | Status |
|---|---|---|---|
| **1** | **Location becomes a real, remembered concept.** A `LocationPicker` over **all 1,634 PSGC municipalities** (D2), code-keyed and province-disambiguated, persisted to `localStorage`, defaulted from booking history (V5). Home gains a `LocationChip` in the hero. | Booker only + the copied PSGC dataset (**G6**). No dependency, no migration. | ⬜ approved |
| **2** | **Honest ranking + the filter/sort split on Explore.** A **four-tier** rank — same city → same province → same **PSGC region** (D3) → elsewhere — applied to the **full** matched set before the reveal slice (V8), plus a `Where` **filter** and a separate `Sort: Near me / Relevance` **control**, with labelled group headers. Home gains the **"Near you"** shelf. | Booker only. No new data, no migration. | ⬜ approved |
| **3** | **City-centroid distance ordering.** A 1,634-row centroid table (bundled JSON, D6) so the **expansion tiers order by real city-to-city distance** instead of by province/region membership alone. | A sourced + licence-verified + reviewed centroid dataset (**U3 — investigate first, D-U3**). No provider, no API key, no migration. | ⬜ approved, **conditional on U3** |
| **3b** | **City-level map** (D5). One marker per **city**, labelled with its vendor count, placed at the city centroid. Not a vendor pin — see §6.4. | A map dependency (**G5**) + Stage 3's centroids. **Blocked if U3 fails** — no centroids, no coordinates, no map. | ⬜ approved, **conditional on S3** |
| **4** | *Separate plan (P2).* Per-vendor street-level geocoding → intra-city distance and per-vendor pins. | A provider, a cache column (**migration**), a refresh path, `geocode_precision`. | ⏸ PARKED |

**Why the stages are ordered this way:**

1. **Stages 1–2 use only data that already exists and is already validated.** V1 and V3 mean the
   primary criterion — city/municipality — needs no new field, no backfill, no vendor action and no
   third party. Everything after Stage 2 refines the *expansion ordering*, not the primary answer.
2. **Most of the mechanism is already built** (V6). The honest description of Stage 1 is "promote and
   persist the city, and give Home a shelf", not "build a location system".
3. **The ranking has no pagination problem** (V8), so the correct-by-construction version costs a sort
   function and a test. There is no reason to ship a reorder-the-page version first.
4. **Stages 1–2 must be shippable without Stage 3**, because Stage 3 depends on an unknown (U3) and
   D-U3 chose to investigate before committing. Stage 2 therefore delivers a complete, honest feature
   on its own: the tier ladder works with zero coordinates. Stage 3 only *reorders within* tiers 1–3.
5. **⚠️ A city centroid cannot order vendors *within* a city** — every vendor in Makati shares the
   same coordinate. This is a hard limit of Stages 3 and 3b, not an implementation shortcut, and it is
   why tier 0 is never reordered by distance (§5.2) and why the map is city-level (§6.4). The thing
   people picture when they say "near me" — "this shop is 1.2 km away" — needs Stage 4.

---

## 4. Customer experience

**The job:** "show me things I can actually book without travelling far, without making me think about
geography." Emotional state: browsing, low patience, usually on a phone.

### 4.1 Home (the shopping page)

Shelf order today (`components/home/HomePage.tsx`): hero/search → in-progress strip → **Browse by
division** → Popular this month → Available today → Book again → Vendors in your city → GuidePanel.

Proposed: insert the location control **in the hero block, directly under the search field**, and the
**"Near you"** shelf **immediately after the in-progress strip — above "Browse by division"**.
Rationale: the prompt asks for nearby offerings "at the front of the shopping page", and the division
grid is a taxonomy, not an answer. The in-progress strip stays first because it is the only personal
*live* state on the page (plan D21).

The control is a single line of text, not a form: **`📍 Makati City · Change`**. One tap opens the
picker sheet.

| State | Home behaviour |
|---|---|
| **Unset (first visit, no history)** | The line reads **`📍 Set your location`** as a button. The "Near you" shelf does **not** render (an empty shelf on a discovery screen is worse than one fewer shelf — the established rule, `HomePage.tsx:42`). Every other shelf behaves exactly as today. |
| **Loading** (catalogue in flight) | Three skeleton cards in the shelf, matching the existing `styles.todaySkeleton` pattern (`HomePage.tsx:189-193`). Never a blank void. |
| **Populated, city has offerings** | Title **"Near you"**, meta **"In Makati City"**. Up to 6 cards, all same-city. `See all` → Explore with `Where = Makati City` and `Sort = Near me`. |
| **Populated, city has < 6 offerings** | Same-city cards first, then a **visually separated** group under a sub-label **"Also in Metro Manila"** (province tier) and then **"Elsewhere in NCR"** (region tier). The tier label is always shown; a card from another city is never silently mixed in. |
| **Empty — nothing in city, province or region** | The shelf renders with an honest message: **"No vendors in Makati City yet."** + a secondary line **"We'll show them here as soon as one joins."** + a primary action **"Browse everything"** → Explore with no city filter. Never a fake result. |
| **Error** (catalogue failed) | Home already surfaces a catalogue error through the shell; the shelf renders nothing rather than claiming emptiness — the `null`-vs-empty-set distinction this app already enforces (`useExplorePage.ts:76-81`). The shelf must **not** print "no vendors near you" when the truth is "we could not find out". |

### 4.2 The picker (new `LocationPicker`)

A bottom sheet / dialog containing, in order:

**There is no "Use my location" button** (D4 resolved: no device location). The picker is:

1. A **search-as-you-type field** over **all 1,634 PSGC cities/municipalities** (D2), loaded from the
   copied dataset.
2. Each option rendered as a **two-line entry**: the city name, and beneath it the province —
   `Burgos` / `Ilocos Norte`. This is what resolves V7's 114 duplicates for a human.
3. Options whose city **has vendors** are ordered first and carry a quiet count
   (`Makati City · Metro Manila · 7`); the rest are selectable and carry no count. ⚠️ This is the
   consequence of D2 that must not be lost: a customer in an unserved municipality **can** now say
   where they are, and the tier ladder (D3) is what gives them something to see. The count is the
   honesty mechanism that stops an unserved option looking like a dead end.
4. **"Anywhere"** as an explicit, always-available escape. The customer is never trapped in a city.

| State | Picker behaviour |
|---|---|
| **Loading options** | Spinner in the list area; the field is enabled immediately. ⚠️ `cities.json` is 108 KB and is fetched **on open, not on app load** — module-cached thereafter, the `useAddressFields.ts:28-48` pattern. It must not join the shell's critical path. |
| **Dataset fetch failed** | Fall back to the **catalogue's own** cities (the D2-option-A list), with no error shown — every city that has something to book is still offered, so the customer is never blocked by a missing reference file. ⚠️ Fail *soft and silent* here, unlike a catalogue error: the fallback is a complete answer for every bookable city. |
| **No match for the typed text** | "No city matches *“xyz”*." + "Try a province name, or pick Anywhere." |
| **A city with no vendors is chosen** | Allowed, and the consequence is visible rather than hidden: Home's "Near you" shelf renders its tier-1/2 groups (`Also in <province>`, `Elsewhere in <region>`) with the headers that say so. If the province and region are empty too, the honest empty state in §4.1 applies. |

### 4.3 Explore (the search page) — filter and sort are two controls, deliberately

The prompt asks for the distinction to be *clear*; the design makes it structural.

| Control | Meaning | Default |
|---|---|---|
| **`Where` (existing `<select>`, upgraded)** | A **filter**. "Only show me Makati City." Results outside it are **removed**. | `Anywhere` |
| **`Sort` (new `<select>`)** | A **sort**. "Keep everything, but put the closest first." Nothing is removed. | `Near me` when a location is set, `Relevance` otherwise |

Copy carries the distinction, since colour and position cannot: the sort option is labelled
**"Near me (closest first)"** and the filter's label stays **"Where"** with the help text
**"Only this city"** when a city is chosen. When `Sort = Near me` is active and `Where = Anywhere`,
the result list shows **group headers** — `In Makati City (7)`, `Also in Metro Manila (12)`,
`Elsewhere (240)` — so a customer never mistakes a far result for a near one. Headers are the honesty
mechanism; a flat reordered list is not acceptable (**X4**).

| State | Explore behaviour |
|---|---|
| **No location set, `Sort = Near me` chosen** | The sort option is **disabled** with the hint "Set your location to sort by distance", linking to the picker. A disabled control that explains itself beats a control that silently does nothing. |
| **`Where = <city>` with 0 results** | The existing no-results panel (`ExplorePage.tsx:144`) gains a city-specific primary action: **"Show nearby cities instead"** → clears `Where`, sets `Sort = Near me`, which produces the labelled-group view. The existing copy "Try a broader word, a different city, or clear the filters" stays as the secondary line. **The empty state is never silently filled with other cities** — expansion is always an action the customer takes or a group that is labelled. |
| **Loading / error** | Unchanged — both already handled by `ExploreData` (`data.loading`, `data.error`, `onRetry`). |

### 4.4 The map (Stage 3b, D5) — a city map, not a vendor map

**Where it lives:** a collapsed-by-default panel on **Explore**, opened by a `Map` toggle next to the
`Sort` control. **Not on Home.** Home's job is "show me something to book"; a map there would push the
"Near you" shelf — the thing this feature exists to deliver — below the fold on a phone.

**What a marker is:** one marker per **city that has vendors**, placed at that city's centroid, labelled
with the **vendor count**. Tapping it sets `Where` to that city and closes the panel. The customer's
own city is marked distinctly (and by shape + label, never by colour alone).

**What a marker is not:** a vendor. There is no per-vendor marker, no vendor name on the map, and no
distance figure anywhere on it.

| State | Map behaviour |
|---|---|
| **Collapsed (default)** | A single toggle. Zero tiles fetched, zero map code evaluated — the library is `dynamic`-imported on first open so it never enters the initial bundle. |
| **Loading** | Skeleton panel at the map's final height, so opening it does not shift the result list. |
| **Populated** | Markers for every city in the current **filtered** result set, so the map and the list always agree. Bounds fit those markers. |
| **Tiles fail to load** | The panel shows the markers' city names as a plain list with counts, plus "Map unavailable". ⚠️ A blocked CARTO tile renders as **blank grey squares with no error** (V12) — the panel must detect and say so rather than present an empty grid as a map of nowhere. |
| **No centroid for a city** | That city gets **no marker**, and the panel footer reads "N cities not shown on the map". It is never dropped silently and never placed at a guessed point. |
| **Centroid dataset unavailable (U3 failed)** | **The toggle does not render at all.** No map, no empty panel. S3b is conditional on S3 — see §16. |
| **Empty result set** | No map toggle (there is nothing to plot). |

⚠️ **Three constraints that keep this honest, and they are requirements, not polish:**
1. **Zoom is capped** at a level where a marker plainly covers a whole city (roughly city-wide, not
   street-level). Allowing street zoom invites a customer to read a marker as a shop's door.
2. **Every marker's label carries the city name and the count** — `Makati City · 7` — so the marker
   reads as "7 vendors in this city", which is exactly what it is.
3. **No "distance to you" on the map, in a popup, or anywhere else.** §5.2's prohibition applies
   unchanged.

> **Recorded dissent (2026-10-14):** a map was recommended *against* at this stage (§6.4) on the
> grounds that city-centroid pins misrepresent vendor locations by 5–15 km. The decision to include
> one was taken by the user. The design above is the resolution: it keeps the map by **changing what a
> marker means** — a city with a count, not a place of business. The original objection applies in
> full to per-vendor pins, which remain out of scope until Stage 4.

### 4.5 Accessibility and theming (ux-design §5, §6)

- Both new `<select>`s keep the existing `styles.select` token styling and the `<label htmlFor>`
  pattern already used at `ExplorePage.tsx:108-111`; native selects are keyboard-reachable and
  screen-reader-labelled for free.
- The Home location line is a `<button>` with an accessible name of the form
  `"Location: Makati City. Change"` — the pin glyph is `aria-hidden` and never the sole carrier of
  meaning.
- Picker sheet: focus trapped, `Esc` closes, focus returns to the trigger.
- Minimum 44×44 px for the trigger and every picker row (plan I43's tier-1 rule — and note
  `.plans/2026-09-18-...` records the hero search collapsing to **25 px** on phones when `flex: 1`
  overrode a height in a column; the new control sits in that same hero and must be measured, not
  assumed).
- Tier group headers use the existing `HomeSection` / section-marker tokens; no new colour is
  introduced, and the tier is conveyed by **text**, never by colour alone.
- Contrast measured in **both** themes at ≥4.5:1. ⚠️ `.plans/2026-09-18-...` F64/I51: the visual suite
  silently passed a purple→green swap because `threshold` was left at its default — it is load-bearing
  for colour only since 2026-09-29, so new tokens get a measured check, not a baseline pass.
- **Map accessibility (Stage 3b):** a map is not an accessible primary control, so it is never the only
  route to anything. Every marker's action (filter to that city) is already reachable from the `Where`
  select, and **since F21 the city legend under the map is a permanent text equivalent** — it was the
  tiles-failed state's own list until that finding moved it out and made it unconditional. The
  panel is labelled, keyboard-dismissible, and the toggle states expanded/collapsed via
  `aria-expanded`. ⚠️ Map tiles are raster images with their own light/dark problem — the CARTO basemap
  must be the variant that suits the active theme, or a dark-mode page gets a glaring white rectangle.

---

## 5. Data flow and ranking rules

### 5.1 Data flow (Stage 1 + 2) — all client-side, one extra pair of columns

```
vendors (Supabase)
  └─ getCatalogue()                       services/offerings.service.ts:69
       select … vendors!inner(id, name, city, city_code,          ← + 2 columns (V3)
                              province, province_code, address, …)
       → CatalogueVendor { …, cityCode, provinceCode }            ← lib/types.ts:124
            │
            ├─ useAppShell  location: { cityCode, cityName, provinceCode } | null
            │     • localStorage key BOOKER_LOCATION_KEY, read in an effect AFTER mount
            │       (never in a useState initialiser — the shell is server-rendered and a
            │        render-time read hydrates different markup; the established trap,
            │        useAppShell.ts:30-42)
            │     • default when absent: most recent booking's vendor city (V5)
            │
            ├─ Home  → nearbyShelf(catalogue, location)            ← lib/nearby.ts (new, pure)
            └─ Explore → searchCatalogue(…)  → rankByProximity(…)  → .slice(0, visibleCount)
                         full matched set       full matched set       the reveal page (V8)
```

**No service-layer change beyond the two columns. No RPC. No server round-trip for ranking.**
`lib/nearby.ts` is pure and unit-testable under `node --test`, like `lib/search.ts` and `lib/popular.ts`.

### 5.2 Ranking rules — exact, and exactly as honest as the data

`rankTier(vendor, location) → 0 | 1 | 2 | 3`:

| Tier | Rule | Label shown |
|---|---|---|
| **0** | `vendor.cityCode === location.cityCode` | `In <city>` |
| **1** | `vendor.provinceCode === location.provinceCode` (same province, incl. the `NCR` pseudo-province = all 17 Metro Manila cities, V11) | `Also in <province>` |
| **2** | `vendor.cityCode.slice(0,2) === location.cityCode.slice(0,2)` (same PSGC region, V10) | `Elsewhere in <region>` |
| **3** | anything else | `Elsewhere` |

Then, **within a tier**, order by the list's existing order — relevance/catalogue order on Explore,
and on Home the existing shelf ordering. The sort must be **stable** (`lib/search.ts:146`'s
`sortBySoonest` is the precedent; `Array.prototype.sort` is stable in every supported engine, and ties
break on `offering.name` as that function does).

**Fallbacks and refusals, stated so no implementation can guess:**

- **No location set** → `rankByProximity` is **not called at all**. The list keeps its existing order.
  Never a silent tier-3-for-everyone pass, which would look like a sort and do nothing.
- **A vendor with an empty `city_code`** (possible: `text NOT NULL DEFAULT ''`, so a pre-`20260722000001`
  vendor could still hold `''`) → **tier 3**, and **never tier 0/1/2 by accident**. ⚠️ `'' === ''`
  would otherwise make two unknown-city vendors "same city", and `''.slice(0,2) === ''` would make
  every unknown-city vendor same-region as every other. The guard is `if (!vendor.cityCode) return 3`
  **before** any comparison. This is B2 and it is the single most likely silent bug in the feature.
- **A vendor with a usable city but an incomplete street address** → fully eligible for tier 0 and
  shown normally. Street data is **not consulted at all** in Stages 1–3, so there is nothing to
  degrade. This is the requested behaviour, achieved by construction rather than by a special case.
- **Stage 3 adds one tiebreak only:** within tiers 1–3, order by city-centroid distance when both
  centroids are known; a missing centroid sorts last **within its own tier**, never out of it. Tier 0
  is never reordered by distance — every vendor in the city shares the centroid, so any such ordering
  would be noise presented as information.
- **No distance figure is ever rendered in any approved stage.** No "1.2 km", no "nearby (0.8 km)",
  not in a list, not in a map popup. The vocabulary is `In <city>` / `Also in <province>` /
  `Elsewhere in <region>`. A city-centroid kilometre figure is a false statement about a shop's
  location and is **prohibited** by this plan, not merely discouraged. The centroid distance of
  Stage 3 is an **ordering key only** — it is computed, used to sort, and never shown.

### 5.3 Ranking × pagination × search

- The sort is applied to `results.services` **before** `.slice(0, visibleCount)`
  (`useExplorePage.ts:125`), so "show more" reveals the *next closest*, not a reshuffle of a page
  (V8). This is the acceptance criterion for S2 and it gets a unit test that asserts a tier-3 vendor
  which would appear on page 1 unsorted does **not** appear in the first 24 after sorting.
- The sort key **must join `filterKey`** (`useExplorePage.ts:122`) alongside query/division/city, or
  changing the sort leaves the reveal count from the previous ordering. → B3.
- `Where` (filter) is applied by `searchCatalogue` as today; `Sort` is applied after. They compose: a
  `Where = Makati City` + `Sort = Near me` list is all tier 0 and the groups collapse to one.
- **`get_popular_offerings` is deliberately left alone in Stages 1–3.** It takes `p_city` as a display
  name and filters *inside* the query before its own `LIMIT`, which is correct and load-bearing
  (`20260927000001.sql:115-121`; `lib/popular.ts:10-12`). Passing the picker's **display name** keeps
  today's exact behaviour. Making it code-keyed is a **new migration** and is logged as I6, not
  smuggled in.
  ⚠️ Doc correction while reading it: that migration's comment calls `vendors.city` "free text a vendor
  typed". Since `20260722000001`/`20260722000002` it is a **strict PSGC pick** (V1). The
  case-insensitive comparison is harmless, but the comment misdescribes the data — I7.

---

## 6. Geocoding and maps

Two independent questions, answered separately as the prompt requires.

### 6.1 Can existing vendor addresses be geocoded? — Yes, and three different things get called that

| Route | Input | Output granularity | Provider needed |
|---|---|---|---|
| **(a) City centroid lookup** | `city_code` (V1) | one coordinate **per city/municipality** (±5–15 km) | **None** — a static 1,634-row table |
| **(b) Barangay centroid lookup** | `barangay_code` (V1) | one coordinate **per barangay** (±0.5–2 km) | **None** — a static ~42,000-row table, if one can be sourced |
| **(c) Street geocoding** | `vendors.address` (V13) | one coordinate **per vendor** (±10–100 m) | **Yes** — a geocoding API per vendor |

**Only (c) is "geocoding" in the usual sense, and only (c) is needed for a map pin or a real
distance.** (a) and (b) are table joins against reference data, with no request, no quota, no key and
no privacy surface. That distinction is the whole reason the recommended scope reaches Stage 3 without
a provider.

**Reuse assessment of existing map tooling: there is none to reuse** (V12). Leaflet is uninstalled,
`hooks/useGeolocation.ts` is deleted, there is no geocoder anywhere in the workspace. What *does*
survive and is worth knowing: `TILE_HOST` is still allowed in `img-src`, so a future map's tiles would
load, and `formatFullAddress()` (V13) already produces the exact input string route (c) wants.

### 6.2 Provider assessment for route (c) — verified against primary sources 2026-10-14

**OSM Nominatim (public server)** — fetched `operations.osmfoundation.org/policies/nominatim/`:
- **Absolute maximum 1 request/second**, per application, all users combined.
- Bulk geocoding **generally discouraged**. A small one-time job may be allowed only if: single thread,
  one machine, **all results cached**, and anything running >1 day or on a schedule is capped at
  **4 requests/minute**.
- **Periodic requests from an app count as bulk geocoding and are strongly discouraged.**
- **Autocomplete is prohibited**, including client-side.
- Requires an identifying `User-Agent`/`Referer` (library defaults are rejected), **ODbL attribution**,
  and the ability to switch the service off on request **without a software update**.
- Cost: free. Verdict: **usable for a one-time, server-side, cached backfill of a few hundred vendors
  at ≤1 rps; not usable for anything per-visit or per-signup at scale.** A self-hosted instance lifts
  the limits and adds operational cost.

**Google Geocoding API** — fetched
`developers.google.com/maps/documentation/geocoding/usage-and-billing`:
- ⚠️ That page **no longer states a per-1,000 rate** and still carries the **$200 monthly credit that
  ended 2025-02-28**. Third-party trackers report ~**$5.00 / 1,000** requests with a **10,000-free-events
  per-SKU monthly allowance** replacing the credit, and volume tiers below that — **unverified against
  Google's own pricing page**, which must be read before any commitment (**U1**).
- Caching/storage terms were **not** on that page; they live in the Maps Platform Terms and the
  Geocoding policies page. Google has historically restricted long-term storage of geocoding results —
  **this must be read before designing any cache** (**U2**). This matters more than the price: a
  permanent `lat`/`lng` column *is* long-term storage.
- Verdict: fine for a one-off backfill of a few hundred addresses at trivial cost; the caching terms,
  not the money, are the gate.

**Not assessed in depth** (no need unless Stage 4 is approved): Mapbox (a separate, more expensive
*Permanent* Geocoding product is required to store results), HERE (enterprise licence for caching),
LocationIQ/Geocodio/Photon. If Stage 4 is ever approved, the comparison is **caching rights first,
price second** — because this platform needs to *store* the result.

**Privacy** for route (c): the input is a **business** address already displayed publicly in Booker
(`OfferingPage.tsx:124`), and the geocoding happens **server-side, offline, once per vendor** — no
customer data and no device location is ever sent to a provider. That is a deliberate property of the
design, and it is what makes route (c) tolerable at all.

**Failure handling** for route (c), specified now so Stage 4 cannot improvise: a request that errors,
times out, returns zero results, or returns a low-confidence/ambiguous match writes **no coordinate**
and leaves the vendor at its city tier. `geocode_precision` (`'street' | 'barangay' | 'city' | null`)
is stored alongside, and **the UI consults precision before printing a distance or placing a pin** —
the exact recommendation `F37` made and the reason it survives review.

### 6.3 Where geocoding runs and where results are cached — D6

For **Stages 1–3b there is nothing to cache**: route (a)'s table is static reference data.

**D6 resolved 2026-10-14 → option A: `booker/public/ph-city-centroids.json`**, fetched on demand and
module-cached exactly as `vendor/components/address/AddressFields/useAddressFields.ts:28-48` does.
~50 KB, zero migration, zero backend, an existing pattern in this workspace, and ranking is
client-side anyway (V8). The rejected option B — a `ph_city_centroids` table in `backbone` — would
need a migration, RLS and grants for data that never changes and is not secret, and buys nothing until
ranking moves server-side. ⚠️ **A1 is the condition that would reopen it**: if the catalogue ever
approaches `fetchAllPages`' 10,000-row ceiling, ranking moves server-side and the table becomes
correct.

For **Stage 4** (route (c)), the answer changes and a migration becomes unavoidable:
- Geocoding runs **server-side only** (a one-off script or an admin-triggered route) — never in a
  customer's browser, which would leak an API key and re-geocode on every visit.
- Results cache **on the `vendors` row** (`lat`, `lng`, `geocode_precision`, `geocoded_at`,
  `geocoded_address`), so the cache is invalidated by comparing `geocoded_address` with the current
  `address` — V1's "recomputed on every write" property makes that comparison exact and cheap.
- **Address changes:** a stale row is detected by that mismatch, not by a trigger — a trigger that
  called out to a provider from inside a transaction is the wrong shape. A periodic sweep re-geocodes
  mismatched rows.
- **Missing addresses:** `address_line1` is `NOT NULL DEFAULT ''`, so blank is legal → skip, precision
  `'city'`, city tier only.
- **Ambiguous results:** no write; precision stays null. Never a best guess.
- **Existing vendors:** one backfill pass, ≤1 rps if Nominatim, reviewed before it is trusted.
- ⚠️ **Writing `lat`/`lng` to `vendors` is a schema change and an approval gate**, and it is exactly
  the "future fields to consider" line already in `architecture/schema.md:301`.

### 6.4 The map — D5 resolved: **a map ships, as a city-level map** (Stage 3b)

**The recommendation on this item was "no map yet", and the decision went the other way.** Recorded
plainly because the reasoning still constrains the build:

> A map answers "where exactly is this one place". With only city centroids available, every Makati
> vendor sits on one coordinate, so a per-vendor pin would misrepresent a shop's location by 5–15 km —
> and a pin is read as a door. A city-first list has no equivalent failure mode: `In Makati City` is
> exactly as precise as it claims to be.

**The resolution is not to drop the map but to change what a marker means.** A marker is a **city with
a vendor count**, placed at that city's centroid and labelled as such — which is a true statement
about data this plan actually has. The objection above applies in full to **per-vendor pins**, and
those stay out of scope until Stage 4. Full design, states and the three honesty constraints (zoom cap,
count labels, no distances) are in §4.4.

**What this map genuinely adds:** a spatial read on *where the catalogue is* — which is useful
precisely because the catalogue is thin and geographically clustered, and because D2 now lets a
customer sit in a municipality with no vendors at all. "The nearest cities with anything to book are
these three" is a real answer to a real question, and it is one a tier-group list conveys less
immediately.

**What it costs:**
- A **map dependency** — approval gate **G5**. ~~Recommended: **Leaflet with CARTO tiles**, because
  `TILE_HOST` is already allowed in `img-src` and Leaflet needs no key and no account.~~
  ⚠️ **SUPERSEDED 2026-10-16 — the premise was false by the time it was executed.** CARTO now
  requires an API key on every path and answers an unkeyed request with a 200 and a watermark
  (**F14**). Leaflet shipped under G5 and then came back out: **D7** chose **MapLibre GL JS +
  OpenFreeMap**, which needs **no account and no key** but serves **vector** tiles, so the renderer
  changes with the provider (**S3c**, gates **G8**/**G9**).
  ⚠️ The original warning survives its own example: **the tile host and the CSP move together.**
  It is no longer CARTO but `tiles.openfreemap.org`, and a host outside `img-src`/`connect-src` is
  blocked with no thrown error — demonstrated live during S3b, see F14.
- ⚠️ **`style-src 'unsafe-inline'` is load-bearing for Leaflet**: its `L.divIcon` markers are built
  from inline `style="…"` attributes (the `next.config.ts` CSP comment records this). The directive is
  already present, so no CSP change is required — but it must not be tightened in the same window
  without testing the map.
- **Stage 3's centroids.** Without them there are no coordinates at all. **S3b is strictly blocked on
  S3, which is itself conditional on U3** (§16).
- `dynamic` import so the library never enters the initial bundle.

**Still out of scope:** per-vendor pins, a map on Home, a map on the Offering page, and any distance
figure. The Offering page keeps its directions link (plan D4, 2026-09-21).

---

## 7. Why no Vendor change is proposed

Checked deliberately, because the prompt requires any Vendor work to be named rather than smuggled in.

| Candidate Vendor change | Verdict |
|---|---|
| Add a city/municipality field | **Not needed** — V1, it exists and is strict. |
| Add a draggable location pin (`F37`'s option 3) | **Not needed for Stages 1–3b.** It is the only route to real accuracy and it belongs with Stage 4, where it is a *better* alternative to geocoding, not an addition to it. Flagged for a future plan; **not proposed here.** ⚠️ Now that a map is approved (D5), expect pressure to put real pins on it — that is Stage 4, it needs either this Vendor change or a geocoding provider, and it must not be slipped into S3b. |
| Add multiple service locations / branches | **Not needed** — V2, out of scope, and it is a `vendor_branches` table (a shared-backend change), not a Vendor-app change. |
| Collect the vendor's device location at signup | **Rejected on the merits**, and the user's own constraint agrees: vendors register away from the shop. The saved operating address is the only trustworthy source. |

**Conclusion: Booker needs nothing from Vendor to deliver Stages 1–3.** The only deficiency Booker
cannot fix alone is **intra-city precision**, and that is Stage 4 — where the choice is "geocode the
address Vendor already stores" (no Vendor change) versus "let the vendor drop a pin" (a Vendor change,
and the more accurate one). That decision belongs to Stage 4's plan.

---

## 8. Shared-backend (`backbone/`) changes

Stated separately from the Booker UI work, as required.

| Stage | Migration needed? |
|---|---|
| **1** | **None.** `city_code`/`province_code` are new *select-list entries*, not new columns, and the booker read policy already covers them (V3). |
| **2** | **None.** |
| **3** | **None** — D6 resolved to the bundled JSON (§6.3). Option B would have needed one. |
| **3b** | **None.** The map reads the same bundled centroids and the same in-memory catalogue. |
| **4** (parked) | **Yes — unavoidable.** `lat`, `lng`, `geocode_precision`, `geocoded_at`, `geocoded_address` on `vendors`. Approval gate; blast radius drafted in that plan, not this one. |
| **I6 (optional, any stage)** | **Yes, one new migration** — a code-keyed `get_popular_offerings`. A **new file**, never an edit of `20260927000001` (root `AGENTS.md`: applied migrations are never edited). |

✅ **The entire approved scope (S1, S2, S3, S3b) requires no migration and no change to any RLS
policy, grant, trigger or function.** That is a verified consequence of V1 and V3, not a convenience.
A migration becomes necessary only for I6 (optional, user's call) or Stage 4 (parked).

⚠️ Stated for the avoidance of doubt: **a Booker-only interface would still need an approved migration
the moment Stage 4 or I6 is wanted** — the absence of one here is a property of this scope, not a
general rule.

---

## 9. Affected files, components, and render/hook/style separation

Per root `AGENTS.md` and `.claude/skills/component-separation/SKILL.md`, stated **per component**, not
left implicit.

### New components

| Component | Render (`.tsx`) | Hook (`use*.ts`) | Style |
|---|---|---|---|
| `components/location/LocationPicker/` | Sheet markup, the search field, the option list, the `Anywhere` row, the no-match notice. JSX + `.map()` only. | `useLocationPicker.ts` — the query state, the on-open dataset fetch and its catalogue fallback, the filtered + province-labelled + count-ordered option list (via `lib/phCities.ts`), the commit handler. Owns **all** state and every handler body. **No geolocation** (D4). | `LocationPicker.module.css` — sheet, rows, two-line option layout, 44 px row height. No inline `style`. |
| `components/location/LocationChip/` | **Pure display + one handler prop.** Renders `📍 <city> · Change` / `📍 Set your location`, pin `aria-hidden`, accessible name composed from props. | **None** — no state, no effects; the `onClick` comes in as a prop. Qualifies for the §4 single-file exception. | `LocationChip.module.css`. |
| `components/home/NearYouShelf/` | `HomeSection` wrapper, the card grid (reuses the existing `ShelfCard`), tier sub-labels, skeletons, the empty-state panel. | `useNearYouShelf.ts` — calls the pure `lib/nearby.ts`, derives tier groups and labels, owns the cover-photo fetch for the shelf's own ids (the existing `PopularShelf` pattern: own your fetch, hide on empty, never delay the neighbours). | `NearYouShelf.module.css` — grid, tier sub-label, empty panel. |
| `components/explore/CityMapPanel/` **(S3b)** | The panel shell, the `aria-expanded` toggle (`CityMapToggle`, moved into the sticky bar by F22), the `dynamic`-imported map container, the **city legend** (`CityLegend` — F21; it was the tiles-failed list until that finding made it permanent), the "N cities not shown" footer. No map API calls in the render layer. | `useCityMapPanel.ts` — open/closed state, the lazy library import, derivation of one marker per city (count + centroid) from the **filtered** result set, bounds fitting, the tile-failure detection, the theme→basemap-variant choice, and the marker-click handler that sets `Where`. | `CityMapPanel.module.css` — panel height (fixed, so opening does not shift the list), toggle, fallback list, marker label chrome. ⚠️ Leaflet's own stylesheet is a vendor import, not a replacement for this file. |

### Modified components

| File | Change | Separation note |
|---|---|---|
| `components/layout/AppShell/useAppShell.ts:105` | `city: string \| null` → a `location` object (`{cityCode, cityName, provinceCode}` \| null); add the post-mount `localStorage` read and the booking-history default. | Already a hook; no render layer touched. ⚠️ Read in an **effect**, not a `useState` initialiser — the shell is server-rendered (`useAppShell.ts:30-42`). |
| `components/layout/AppShell/AppShell.tsx:21-22,52-53,175,204` | Prop type widens; passes `location` + `onLocationChange` down. | Prop plumbing only — no logic added to the `.tsx`. |
| `components/home/HomePage/HomePage.tsx` | Mount `LocationChip` in the hero block; mount `NearYouShelf` after the in-progress strip. | Render-only additions; no new state in the `.tsx`. |
| `components/home/HomePage/useHomePage.ts:60-61,141-143` | The two existing `v.city === city` / city-filter sites move to `cityCode` matching. | Hook-local. |
| `components/explore/ExplorePage/useExplorePage.ts:12,97-125,173-196` | Add `sort` state; call `rankByProximity` between `searchCatalogue` and the slice; **add the sort key to `filterKey`** (B3); expose `sortOptions`, `groups`, and the disabled-reason for `Near me`. | All state and derivation stay in the hook. |
| `components/explore/ExplorePage/ExplorePage.tsx:108-117,144` | `Where` options become code-valued with province sub-labels; add the `Sort` select; add the `Map` toggle + `CityMapPanel` (S3b); render group headers; extend the no-results panel with "Show nearby cities instead". | JSX + `.map()` only; handlers come from the hook. |
| `components/explore/ExplorePage/ExplorePage.module.css` | Tokens for the sort control, the group header and the map toggle row. | ⚠️ No inline `style` — and note `.plans/2026-09-18-...` F64: a visual baseline can pass through a colour change, so any new token is **measured**. |

### New pure modules (no component, `node --test` coverage — the `lib/search.ts` / `lib/popular.ts` pattern)

| File | Responsibility |
|---|---|
| `lib/nearby.ts` + `lib/nearby.test.ts` | `rankTier()`, `rankByProximity()`, `tierLabel()`, `groupByTier()`. **Pure.** Must contain B2's empty-`cityCode` guard and the stability guarantee. |
| `lib/phCities.ts` + `.test.ts` | PSGC option building: dedupe on **code**, label as `name` + province, display-name normalisation (V14, I5), region prefix from `cityCode.slice(0,2)` (V10). |
| `lib/geoCentroids.ts` + `.test.ts` *(S3)* | Centroid lookup by `city_code` and haversine distance. Pure; the dataset is fetched by its caller. **No device-fix resolution** (D4 dropped it). ⚠️ Haversine gets a test against two known PH city pairs with an expected kilometre value — an inverted latitude or a degrees/radians slip produces plausible-looking nonsense that no type check catches. |

### Services / config

| File | Change |
|---|---|
| `services/offerings.service.ts:42-48,69,96-99` | Add `city_code, province_code` to the select and to `CatalogueRow` + the `CatalogueVendor` mapping. **Hand-written interfaces — root `AGENTS.md`: no `supabase gen types` in this repo.** |
| `lib/types.ts:124-134` | `CatalogueVendor` gains `cityCode`, `provinceCode`. |
| `lib/constants.ts` | `BOOKER_LOCATION_KEY`, `NEAR_YOU_LIMIT`, `MAP_MAX_ZOOM`. |
| `next.config.ts` | ✅ **No change.** `geolocation=()` stays (D4). `img-src` already allows the CARTO tile host and `style-src 'unsafe-inline'` already covers Leaflet's `divIcon` (V12, §6.4) — **verify, do not edit.** |
| `booker/public/ph-address/{cities,provinces}.json` | **S1.** Copied from `vendor/public/` (~112 KB) per D2. Needs the provenance note in `booker/AGENTS.md` (I8). |
| `booker/public/ph-city-centroids.json` | **S3.** New reference asset (~50 KB) per D6, conditional on U3. |
| `package.json` | **S3b only.** The map library (**G5**). Recommended: `leaflet` + `@types/leaflet`, no `react-leaflet` wrapper unless it earns its place. |
| `visual-tests/` | New baselines for the Home chip + shelf, the Explore sort row, and the collapsed map toggle. ⚠️ Regenerate with the clock frozen (F46) and check `threshold`, not just `maxDiffPixels` (I51). ⚠️ **Do not baseline an open map** — tiles are network-dependent raster images and would make the suite flaky; assert the panel's chrome instead. ⚠️ **Consequence recorded at F21:** the `citymap` mode is the *collapsed* toggle only, so the city legend added by F21 has **no visual coverage** — the same gap the map itself has, for the same reason. |

---

## 10. BLOCKERS

### B1 — The city filter is ambiguous across provinces, and this feature makes it visible  ⬜ TODO
**Files:** `booker/lib/search.ts:101,151-153` · `booker/components/explore/ExplorePage/ExplorePage.tsx:108-117`
Measured: 114 PSGC municipality names are duplicated across provinces, 7 of them even within one
region (V7, V10). `cityOptions()` dedupes on display name and the predicate is `v.city === city`, so
one `<option>` selects several real municipalities. Today this is near-invisible; promoting location to
the front of Home makes it a correctness problem the customer can see.
**Fix approach:** key the filter, the state, the persisted value and the rank on **`city_code`**
(V3 makes the column available with no migration); render every option as name + province (V11, V14);
dedupe on code. Match by code everywhere except the `get_popular_offerings` call, which keeps its
display-name contract until I6.
**Verification:** unit test with two same-named municipalities in different provinces — selecting one
returns only its vendors (machine-verifiable).

### B2 — An empty `city_code` must not become a proximity match  ⬜ TODO
**File:** `booker/lib/nearby.ts` (new)
`city_code`/`province_code` are `text NOT NULL DEFAULT ''` (`schema.md:251-255`), so a vendor created
before `20260722000001` can legally hold `''`. Without an explicit guard, `'' === ''` makes two
unknown-city vendors "same city" (tier 0 — top of the list) and `''.slice(0,2) === ''` makes every
unknown-city vendor same-region. **A vendor with no location data would rank as the nearest thing on
the page**, and nothing on screen would say why.
**Fix approach:** `if (!vendor.cityCode) return 3` as the **first** line of `rankTier`, before any
comparison; same guard on the customer's stored location (an empty stored code means "unset", and
`rankByProximity` is then not called at all).
**Verification:** unit test asserting a `cityCode: ""` vendor lands in tier 3 against both a matching-ish
and an empty customer location (machine-verifiable).

### B3 — The sort key must join `filterKey`, or "show more" pages the wrong ordering  ⬜ TODO
**File:** `booker/components/explore/ExplorePage/useExplorePage.ts:122-125`
`filterKey = ${query}\0${division}\0${city}` is what resets the reveal count, and the comment at
`:114-121` records why it is derived rather than an effect. Adding a sort without adding it to the key
leaves "page 3 of relevance" showing as "page 3 of near me" — the exact class of bug that comment
exists to prevent.
**Fix approach:** `filterKey = ${query}\0${division}\0${cityCode}\0${sort}`.
**Verification:** test that reveals page 2, flips the sort, and asserts the count is back to `PAGE`
(machine-verifiable).

### B4 — `Permissions-Policy: geolocation=()` silently kills any device-location feature  ✖ ABORTED (2026-10-14)
**File:** `booker/next.config.ts` (`securityHeaders`, the `Permissions-Policy` entry)
**Aborted because D4 resolved to ship no device location**, so nothing in this plan calls
`getCurrentPosition` and the header needs no change. The finding itself stays on the record, because
it is the trap any future device-location work will hit: a Permissions-Policy denial does **not**
throw — `getCurrentPosition` simply never calls back, and this app has already been caught by it once
(plan S7-b).
**Standing instruction:** the header stays `geolocation=()`, and the restore note at the line stays
with it. ⚠️ **Do not flip it speculatively** "for later" — an allowance with no consumer is exactly
what S7-b cleaned up.
**Replaced by:** nothing. Approval gate **G2 is withdrawn**.

### B5 — The map must not become a vendor-pin map  ✅ DONE (2026-10-16)
**Files:** `lib/cityMarkers.ts` + `lib/cityMarkers.test.ts` · `components/explore/CityMapPanel/`
The approved map plots **one marker per city with a count** (§4.4, §6.4). The failure mode is drift:
plotting one marker per *vendor* from the same centroid data is a two-line change, it type-checks, it
looks richer, and it is a false statement about every vendor's location by 5–15 km. The predecessor
plan's `F37` recorded the same hazard from the other direction (`geocode_precision` exists so the UI
knows how much to trust a coordinate).
**Fix approach:** the marker type is `{ cityCode, cityName, vendorCount, lat, lng }` — it has **no
vendor id and no vendor name**, so a per-vendor pin cannot be built without changing the type, which is
a visible decision rather than an accident. Cap the zoom (`MAP_MAX_ZOOM`) so a marker always covers a
city. No distance anywhere on the map.
**Verification:** unit test asserting the marker list for a city with 7 vendors has **length 1** and
`vendorCount === 7` (machine-verifiable); plus a grep check that the marker type carries no vendor
identity.
✅ **DONE (2026-10-16)** — `CityMarker` ships as
`{ cityCode, cityName, label, provinceCode, provinceName, vendorCount, lat, lng, isOrigin }`: no
vendor id, no vendor name. `cityMarkers.test.ts` asserts **7 vendors → 1 marker, count 7**, that four
services from one vendor count **once**, and that the key set contains nothing matching
`id`/`vendorId`/`name`/`dist|km`. `MAP_MAX_ZOOM = 11` applied to the map *and* to `fitBounds`.
⚠️ **This item is unaffected by D7.** The marker type, its tests and the derivation are renderer-
agnostic, so the Leaflet → MapLibre swap (**S3c**) carries them over untouched. If S3c ever needs to
change `CityMarker`, that is the signal something has gone wrong.

### B6 — MapLibre + OpenFreeMap cannot load one byte under the current CSP  ✅ DONE (2026-10-16)
**File:** `booker/next.config.ts:130` (`TILE_HOST`), `:196` (`img-src`), `:201` (`connect-src`)
D7's stack contacts exactly one host, **`tiles.openfreemap.org`** — verified by fetching the style
and its TileJSON, which between them reference the style JSON, `fonts/{fontstack}/{range}.pbf`,
`sprites/ofm_f384/ofm`, a **raster** relief layer at `natural_earth/ne2sr/{z}/{x}/{y}.png`, and the
vector tiles at `planet/…/{z}/{x}/{y}.pbf`. Today's CSP allows **none** of it:

- `connect-src 'self' <supabase>` — the style JSON, glyphs, sprites and every vector tile are
  `fetch`es, so **all of them are blocked**. This is the one that stops the map existing at all.
- `img-src 'self' data: ${TILE_HOST} <supabase>` — `TILE_HOST` is **CARTO**, which this stack no
  longer uses. The relief raster needs the OpenFreeMap host, and MapLibre's own docs require
  **`blob:`** in `img-src`.

⚠️ **And `blob:` in `img-src` directly contradicts a documented decision.** `next.config.ts:168-170`
says: *"`blob:` is deliberately absent from `img-src`. Nothing in booker calls `createObjectURL` or
`FileReader` today."* That was true and is now not. Per the plan-authoring rules a conflict with a
documented decision is a **decision point, not a silent override** — so the comment is rewritten in
the same change to say what now needs it and why, rather than the line quietly gaining a token.
**Fix approach:** replace `TILE_HOST`'s value with the OpenFreeMap origin (the constant's *name*
stays accurate), add it to **both** `img-src` and `connect-src`, add `blob:` to `img-src`, and leave
`worker-src` **absent** on the strength of D8 (same-origin worker → falls back to `script-src 'self'`).
⚠️ **Gate G9** — this is a security header. It does not get edited as part of a component change.
**Verification:** `visual-tests/csp.spec.ts` already fails the build on any CSP violation or blocked
request (`:83-84`), so an open map under the real header is the test. ⚠️ Its existing assertions use
`mode=divisions` and never open a map — **S3c must add a case that does**, or the CSP for the map
stays unexercised, which is exactly how K11 shipped with every offering photo blocked.

---

## 11. IMPORTANT

### I1 — "Near you" shelf at the front of Home  ⬜ TODO
**File:** `components/home/HomePage.tsx` (insert after the in-progress strip, before "Browse by division")
The prompt's core ask. Up to `NEAR_YOU_LIMIT` (6) offerings, tier 0 first with labelled tier-1/2
groups to fill, hidden entirely when the location is unset, honest empty state when the city and its
expansions are genuinely empty (§4.1). Owns its own cover-photo fetch (the `PopularShelf` pattern) so
it cannot delay or break its neighbours.

### I2 — Default the location from booking history, not from a prompt  ⬜ TODO
**File:** `components/layout/AppShell/useAppShell.ts` · uses `bookings[].vendorCity` (`bookings.service.ts:123`)
Order of precedence: persisted `localStorage` value → most recent booking's vendor city (V5) →
unset. A returning customer therefore never sees "Set your location", and no permission prompt is
involved. ⚠️ `vendorCity` is a **display name**, so resolving it to a `city_code` needs the catalogue
(the vendor row is there) — do not reverse-resolve from the name against the PSGC list, which is
ambiguous by V7.

### I3 — The filter/sort split on Explore  ⬜ TODO
**File:** `components/explore/ExplorePage/{ExplorePage.tsx,useExplorePage.ts}`
`Where` stays a filter; `Sort: Near me / Relevance` is new and removes nothing. Group headers carry the
distinction in text (§4.3). `Near me` is **disabled with a reason** when no location is set.

### I4 — Persist the location choice  ⬜ TODO
**File:** `useAppShell.ts` + `lib/constants.ts`
`localStorage`, read in a post-mount effect, every read and write wrapped in `try/catch` (private
window, cleared site data) — the pattern already used for `SIDEBAR_COLLAPSED_KEY` (`:30-42`) and the
recent searches (`useExplorePage.ts:88-94`). Failure is silent and leaves the location unset, which is
a working state.

### I5 — Normalise PSGC display labels for customers  ⬜ TODO
**File:** `lib/phCities.ts` (new)
V14: the data says `City of Makati`, customers type `Makati`. Presentation-only transform (`City of X`
→ `X City`), applied to **labels and match text**, never to the stored `city` string or code. Keep the
raw name searchable too, so typing either form finds it.

### I6 — Code-keyed `get_popular_offerings`  ✅ BUILT, AWAITING APPLY (2026-10-16) — stage S3d
**Files:** `backbone/supabase/migrations/20261016000001_popular_offerings_by_city_code.sql` (new) ·
`booker/services/offerings.service.ts` · `components/home/PopularShelf/{PopularShelf.tsx,usePopularShelf.ts}` ·
`components/home/HomePage/HomePage.tsx` · `lib/popular.ts` · `lib/popular.test.ts` · `lib/phCities.ts`

`20260927000001.sql:121` matched `lower(v.city) = lower(p_city)` — the city **display name**, as
text. **G3 given 2026-10-16**; built the same day.

**Measured, not assumed** (against the shipped `cities.json`, 1,634 municipalities):

| | |
|---|---|
| Names shared by >1 municipality | **114** |
| Municipalities sitting on a shared name | **331 — 20% of the country** |
| Worst cases | `San Isidro`, `San Jose` = **9** each; `Pilar`, `Rizal`, `San Miguel` = 7; `Burgos` = 6 |

So a booker in any of those 331 saw popularity **pooled from every same-named municipality
nationwide** — and the count renders as a figure beside the price, so the wrong number looked
exactly like a right one.

⚠️ **It was NOT a regression from this plan** — it is behaviour from 2026-09-27, and S1–S3
deliberately kept passing the display name so nothing moved underneath it.

⚠️ **The real argument for fixing it is that BOTH of this column's failure modes are silent**, and
both were reached: **F2** (wrong *form* of the name → shelf silently empty, caught before shipping)
and I6 (*shared* name → silently wrong data). The second is worse: an empty shelf is at least
visible. `vendors.city_code`'s own column comment says to match on the code "so a future PSGC data
refresh … cannot silently break" things — this is that instruction, applied.

**What shipped — see D10 for the shape and why.** The filter became `v.city_code = p_city_code`,
with everything else in the function byte-for-byte unchanged in behaviour. Two things were added
that the original did not have:
- ⚠️ **A blank code RAISES (`22023`) rather than meaning "everywhere".** `vendors.city_code` is
  `text not null default ''`, so `= ''` would pool every pre-PSGC vendor into one pseudo-city —
  the same trap `rankTier` guards on its first line (**B2**). And answering a one-city request
  with the whole platform is precisely the plausible-looking wrong answer this function raises
  instead of returning. `null` still means platform-wide.
- ⚠️ **No `lower()`.** A 9-digit code is not prose; folding it would imply a human chose the value.

**Blast radius:** no data read or rewritten, no table touched, no lock of consequence, no type
regen (types are hand-written). One caller in one app. Reversible by re-running `20260927000001`'s
body — ⚠️ paired with reverting booker, or the shelf stays hidden.

**Deploy coupling — either order is safe, and that was verified rather than assumed.** See D10.

**Verified (machine):** `tsc` clean · **272/272** unit tests (2 new, pinning F25) · lint **18**,
the agreed baseline · `next build` compiles · grep confirms no `p_city` caller remains in any app.
**NOT verified:** the function itself has not been applied anywhere — see S3d step 3 for the exact
SQL harness that proves two same-named municipalities no longer pool, which needs the migration
applied to a database. ⚠️ **The local seed cannot reproduce the bug**: none of its 14 active
vendors sits on a shared city name (checked city-by-city), so a fixture is required — the
harness builds and rolls back its own.

### I7 — Doc corrections found while reading  ⬜ TODO
1. `20260927000001_popular_offerings_rpc.sql:121` comment calls `vendors.city` "free text a vendor
   typed" — it is a strict PSGC pick since `20260722000001`/`20260722000002` (V1). ⚠️ The file is
   **applied**, so the comment is corrected in the I6 migration or in `architecture/schema.md`, not by
   editing it.
2. `.plans/2026-09-18-booker-home-search-redesign.md:272-274` calls the `NCR` `province_code` a
   data-quality inconsistency; it is the documented synthetic pseudo-province (V11). Note the
   correction in this plan (done above) rather than rewriting the historical plan.
3. `architecture/portals.md:71-72,232,1140` and `booker/AGENTS.md` (Maps row) all state "no proximity
   is possible". After Stage 2 that becomes wrong in an important way: **city-tier proximity is
   possible and shipped; coordinate-distance proximity is not.** Update all four at the end of Stage 2.

### I8 — Copy the PSGC city dataset into Booker  ⬜ TODO — **in scope (D2 = all municipalities)**
**File:** `booker/public/ph-address/cities.json` + `provinces.json` (~112 KB), copied from `vendor/public/`
**Approval gate G6.** Only `cities.json` and `provinces.json` are copied — **not** the 6.6 MB
`barangays/` tree, which Booker has no use for (it never resolves below city level).
⚠️ A copy is a duplicated artefact across two independent repos with no shared build tooling, so it
needs a provenance note in `booker/AGENTS.md`: where it came from, the date, that `vendor/` holds the
other copy, and that the two **can drift** with no error on either side. ⚠️ `cities.json` is fetched
**on picker open**, never on app load — it must not join the shell's critical path (§4.2).

### I9 — City-level map panel on Explore  ⬜ TODO — **S3b, conditional on S3**
**File:** `components/explore/CityMapPanel/` (new), mounted from `ExplorePage.tsx`
D5's deliverable. Design, states and the three honesty constraints in §4.4; dependency and CSP facts
in §6.4; the drift hazard in **B5**. Collapsed by default, `dynamic`-imported, markers derived from
the **filtered** result set so the map and the list always agree.
**Couplings:** needs **S3**'s centroids (no centroids → no map, and the toggle does not render) and
approval gate **G5** for the library.

### I12 — Swap the drawing layer from Leaflet to MapLibre GL  ✅ DONE (2026-10-16)
**Files:** `components/explore/CityMapPanel/useCityMapView.ts` · `CityMapView.tsx` ·
`CityMapView.module.css` · `lib/mapTiles.ts` · `package.json`
D7 chose a vector basemap, and Leaflet cannot draw one. **What does NOT change is the point of this
item:** `lib/cityMarkers.ts`, `CityMarker`, `lib/constants.ts`'s `MAP_MAX_ZOOM`, `CityMapPanel.tsx`
and `useCityMapPanel.ts` are renderer-agnostic and carry over. The rewrite is confined to the two
files that import the library, plus the config module.

**Component separation (required statement, per `component-separation/SKILL.md`):**
| File | Concern |
|---|---|
| `CityMapView.tsx` | Render only — a container `<div>` and the CSS import. It already contains no state and keeps none; the prop interface (`markers`, `dark`, `basemap`, `onPickCity`, `onTilesFailed`) is unchanged by D7, so `CityMapPanel` does not learn that the renderer changed |
| `useCityMapView.ts` | All state and effects: the dynamic `import("maplibre-gl")`, map construction, the marker layer, bounds fitting, style switching and error detection. Handlers stay behind the existing ref so a parent render cannot rebuild the map |
| `CityMapView.module.css` | All marker chrome. ⚠️ The existing classes are reused as-is — MapLibre's `Marker({ element })` takes a DOM node exactly as Leaflet's `divIcon({ html })` did, so the pill, the origin variant and the count keep their current styling and their current contrast |

**Fix approach, and the four places the APIs genuinely differ:**
1. **`lib/mapTiles.ts` changes shape** — from three tile-URL variables to **one style URL**, and it
   **regains a default**. F14 removed the default because the default lied; OpenFreeMap needs no key
   and cannot produce a watermark, so `https://tiles.openfreemap.org/styles/positron` (light) and
   `…/dark` (dark) ship as the default, overridable by env for self-hosting later. The attribution
   variable goes: the TileJSON carries the credit and MapLibre's own control renders it (verified —
   see F18).
2. **Markers** — `new maplibregl.Marker({ element })` replaces `L.marker` + `L.divIcon`. Keep
   building the element with `document.createElement` and `textContent`; it is why the markers need
   no `style-src` relaxation and cannot interpolate a database value into HTML.
3. **⚠️ Theme switching is the trap.** Leaflet swapped a tile URL with `setUrl()`. MapLibre's
   `setStyle()` **tears down and rebuilds the style**, and markers are not part of it — so the dark/
   light flip must re-add markers (or add them on the `styledata` event) or they vanish on a theme
   change with nothing in the console. Must be explicitly tested in both directions.
4. **Failure detection changes mechanism** — Leaflet's `tileerror` becomes MapLibre's
   `map.on("error")`. The "one success proves the basemap works" rule carries over, but the
   watermark case it could not catch (F14) **no longer exists**, because OpenFreeMap has no keyed
   tier to fall back from.

**Verification:** `tsc`, lint, `npm test`, a **collapsed-toggle** visual baseline (unchanged — still
never an open map), a re-measured `next build` bundle comparison (**R9 again**: MapLibre is several
times Leaflet's size, so the *lazy chunk* grows a lot and the claim to protect is that **initial JS
stays flat**), and `csp.spec.ts` extended to open the map (B6). **Needs a live check:** tiles
rendering in both themes, a theme flip with markers surviving, and a 360 px phone pass.

### I11 — An active control is indistinguishable from an inactive one in dark mode  ⬜ TODO
**File:** `booker/components/explore/ExplorePage/ExplorePage.module.css:168` (`.select`) · surfaced by the preview
Found while building the previews (2026-10-14), not by reading the code. Two parts:
1. **`.select` has no active variant at all today** — a chosen city renders identically to
   "Anywhere", so the existing `Where` filter already gives no visual confirmation that it is on.
2. The obvious fix, `--db-menu-btn-*`, **does not work in dark**: it is a blue tint in light but a
   neutral white-alpha in dark (`globals.css:294-297`), so active and inactive look the same — which
   would defeat the filter-vs-sort distinction I3 exists to make.
**Fix approach:** fill the active control with `--db-toggle-on` (#2563eb — the *same* value in both
themes, `globals.css:85,292`), white text, measured at 4.6:1. The preview uses exactly this.
⚠️ Do **not** reach for `--div-*-deep` here as `.chipOn` does (`:158-163`) — that pair is keyed to a
*division*, and a location control has no division.
**Verification:** measured contrast in both themes + a visual baseline for each state
(machine-verifiable).

### I10 — PSGC region code → region name map  ⬜ TODO
**File:** `lib/phCities.ts`
D3's tier 2 needs a human-readable label. 17 hand-written entries (`'01'` → Ilocos Region, …,
`'13'` → NCR, `'14'` → CAR, `'15'` → BARMM, `'16'` → Caraga, `'17'` → MIMAROPA), verified against the
measured prefixes in V10. ⚠️ Derive the prefix from **`city_code`**, never `province_code` (V11: three
pseudo-province codes are non-numeric). An unknown prefix falls back to tier 3's plain `Elsewhere`
label rather than printing a code at the customer.

---

## 12. DECISIONS — D1–D6 + D-U3 resolved 2026-10-14; D7–D11 added later (dates inline)

<!-- plan-authoring §7 hard gate: no OPEN line remains, so the plan may be presented for execution approval. -->

- **D1 — How far does the first release go?** → **Stages 1 + 2 + 3** (resolved 2026-10-14, user) —
  the centroid distance ordering is wanted in the first release, not held back as a follow-up.
  ⚠️ **Consequence:** U3 (sourcing a licence-clean, PSGC-keyed centroid dataset) moves onto the
  critical path. D-U3 below is what keeps the release from being blocked by it.

- **D2 — Which cities does the picker offer?** → **All 1,634 PSGC municipalities** (resolved
  2026-10-14, user) — the dataset is copied into `booker/public/` (**I8**, gate **G6**).
  ⚠️ **Consequence:** a customer can now select a municipality with no vendors at all, which makes the
  D3 tier ladder and the §4.1 empty state load-bearing rather than edge cases, and makes the per-option
  vendor count (§4.2) necessary so an unserved option does not look like a dead end.

- **D3 — Does the tier ladder stop at province or go to region?** → **Four tiers: same city → same
  province → same PSGC region → elsewhere** (resolved 2026-10-14, user; the recommended option).
  Free per V10 — derived from `city_code.slice(0,2)`, no dataset. Needs **I10**'s 17-entry region-name
  map. ⚠️ Some regions are large, so the label is `Elsewhere in <region>` and never implies nearness.

- **D4 — Does "Use my location" ship at all?** → ~~**No device location**~~ **REVERSED by D11 on
  2026-10-16.** Original resolution (2026-10-14, user, the recommended option): no device location;
  manual city + the booking-history default (**I2**) covers returning customers with no prompt at all.
  Its consequences were: `Permissions-Policy: geolocation=()` stays unchanged, **B4 ✖ ABORTED**, gate
  **G2 withdrawn**, and `lib/geoCentroids.ts` carries no nearest-centroid device resolution.
  ⚠️ **The record is kept, not deleted** — D4 was correct for the scope it governed (S1–S3d shipped
  under it, and nothing built so far asks for a permission). **D11 changes the direction for future
  work only.** What D11 revives: **G2 is no longer withdrawn**, and `lib/geoCentroids.ts` gains a
  device-resolution job it was explicitly denied here. ⚠️ **B4 stays ✖ ABORTED** — it was about a
  header that silently killed a device *button*; the header question is now G2's, and B4's framing
  does not return with it.

- **D5 — Any map?** → **Yes, a city-level map on Explore** (resolved 2026-10-14, user).
  ⚠️ **This went against the recommendation**, which was "no map yet" on the grounds that
  city-centroid pins misrepresent a shop's location by 5–15 km. The objection is recorded in §6.4 and
  §4.4 and is resolved by **changing what a marker means**: one marker per *city*, labelled with its
  vendor count, at a capped zoom, with no distances — a true statement about the data this plan has.
  **Per-vendor pins remain out of scope** (Stage 4). New guard: **B5**. New item: **I9**. New gate:
  **G5** (map dependency). **Conditional on S3**, because without centroids there are no coordinates.

- **D6 — Where does the centroid table live?** → **Bundled JSON in `booker/public/`** (resolved
  2026-10-14, user; the recommended option). No migration, mirrors the existing
  `vendor/public/ph-address/` pattern (§6.3). Reopens only under **A1** (catalogue nearing the
  10,000-row ceiling → ranking moves server-side).

- **D-U3 — How is the centroid dataset sourced?** → **Investigate first, then decide** (resolved
  2026-10-14, user; the recommended option). Sourcing + licence verification + a reviewed name→code
  mapping is the **first task of S3**, and if nothing clean can be sourced **S3 parks and reports**
  rather than shipping a guessed mapping.
  ⚠️ **This is the plan's main schedule risk, and it is deliberately contained:** S1 and S2 ship a
  complete, honest feature with zero coordinates, so a failed U3 costs the distance *ordering* and the
  *map* (S3, S3b) and nothing else. See §16's coupling note.

- **D7 — Which basemap, after CARTO stopped being keyless (F14)?** → **MapLibre GL JS +
  OpenFreeMap's public instance** (resolved 2026-10-16, user, after the user's own research).
  **No account, no registration and no API key** — verified against OpenFreeMap's own page
  ("There's no registration, no user database, no API keys, and no cookies") and by fetching the
  style and TileJSON directly. Commercial use is permitted. Closes gate **G7**.
  ⚠️ **Consequences, and they are not small:** OpenFreeMap serves **vector** tiles only, so
  **Leaflet cannot render it**. `leaflet` + `@types/leaflet` — installed yesterday under G5 — come
  back out, `maplibre-gl` goes in (**G8**), `CityMapView` + its hook are rewritten against a
  different API, and the CSP needs a real change (**G9**, **B6**). The marker *meaning* is
  untouched: `lib/cityMarkers.ts`, `CityMarker` and **B5's guarantee carry over verbatim**, which is
  what keeps this a swap of the drawing layer rather than a redesign. New stage **S3c**.
  ⚠️ **The trade accepted:** the alternative with the smallest diff was a keyed raster provider
  (Thunderforest), which would have kept the Leaflet code exactly as built and needed one host added
  to `img-src`. The user chose no-account/no-key over smallest-diff. Recorded so the cost is
  attributable to the choice rather than rediscovered later as a surprise.

- **D8 — Where does MapLibre's web worker come from?** → **Self-hosted, same origin**
  (recommended; **confirm at execution**). MapLibre's default build constructs its worker from a
  `blob:` URL, which would need `worker-src blob:` added to the CSP. `setWorkerUrl()` pointed at a
  same-origin copy of `maplibre-gl/dist/maplibre-gl-worker.mjs` (**confirmed present in
  maplibre-gl 6.14.0**) avoids that entirely — and because `worker-src` falls back to `script-src`,
  which is already `'self'`, **that route needs no `worker-src` directive at all**.
  ⚠️ Open sub-question for execution: how the file reaches `public/` — committed, or copied by a
  script. Committing a `node_modules` artefact drifts from the package version silently, so a copy
  step with the version asserted is preferred. Decide when the file is in front of us.

- **D9 — Which OpenFreeMap styles for light and dark?** → **`positron` (light) and `dark` (dark)**
  (recommended). All five styles were verified live: `liberty`, `bright`, `positron`, `dark` and
  `fiord` all return 200. `positron`/`dark` are the neutral, low-chroma pair — the right backdrop
  for markers that must be the loudest thing on the map, and the closest match to this app's muted
  surfaces. `liberty` and `bright` are saturated and would compete with the markers.

- **D10 — How does the code-keyed `get_popular_offerings` replace the name-keyed one?** →
  **Drop the old signature and recreate it under the same name with `p_city_code`, in one
  migration** (resolved 2026-10-16, with G3).

  **Settled on house precedent, not taste.** `20260803000005` replaced
  `check_booking_capacity()` by creating the new function and `drop function if exists`-ing the
  old one in the same file. This follows it.

  ⚠️ **`create or replace` cannot do this.** Postgres refuses to rename an input parameter, and
  the new signature has the same arity and types — so the drop is *required*, not stylistic.

  **The alternative — a second function under a new name (`…_by_code`), leaving the old one in
  place — was rejected.** It reads safer, and on one axis it is: the old function keeps working
  throughout, so there is no deploy window at all. But it **duplicates the ranking SQL**, and
  `20260927000001`'s own header warns that this is exactly how the definition of "popular"
  drifts: *"Switching is a one-line change here; changing it in only one place is how the two
  drift."* It would also leave a dead signature needing a second migration to clean up. One
  definition in one place beat a bounded, graceful deploy window.

  ⚠️ **AND THE WINDOW WAS MEASURED, NOT ASSUMED — this is what made the choice safe.** The
  question was whether a call naming an argument the function does not have *errors* or is
  *silently ignored*. Silently ignored would be catastrophic: a city-filtered booker would be
  shown **platform-wide** popularity, which is the same silent-wrongness I6 exists to remove,
  arriving through the deploy itself. Probed against local PostgREST on 2026-10-16:

  ```
  p_city      → 42501 permission denied   (function RESOLVED; anon correctly revoked)
  p_city_code → 404 PGRST202 "no matches were found in the schema cache"
  ```

  It **errors**. `getPopularOfferings` returns `[]` on any error and `PopularShelf` renders
  nothing when empty, so **both deploy orders degrade to one hidden Home section** and neither
  can show wrong data:
  - migration first → old app sends `p_city` → 404 → shelf hidden until the app deploys;
  - app first → new app sends `p_city_code` → 404 → shelf hidden until the migration applies.

  ⚠️ Do not generalise that probe to other RPCs without re-running it.

- **D11 — How far does "near" go, and where do the coordinates come from?** → **Barangay is the
  ceiling. The booker's position comes from the device; the vendor's never does.** (resolved
  2026-10-16, user.)

  Four parts, all decided together:

  1. **"Near" resolves no finer than BARANGAY.** No street-level precision, ever, under this
     direction. A barangay is the smallest administrative unit this platform stores, and it is where
     "near" stops.
  2. **Vendor-side geocoding is PARKED** (**P2**). No provider is engaged, no vendor address is sent
     anywhere, no `lat`/`lng` lands on `vendors`. ⚠️ **Consequence: U1 and U2 are moot** while this
     direction holds — they exist only to gate P2 — and **G4 stays parked**. They are kept, not
     aborted, because reviving P2 revives them unchanged.
  3. **The booker's own position comes from the browser Geolocation API** — free, no key, no
     provider, no quota. ⚠️ **This REVERSES D4** and therefore **restores gate G2**: the live header
     is `Permissions-Policy: … geolocation=() …` (`booker/next.config.ts:243`), which blocks the API
     for every origin, so **nothing works until that flips to `(self)`** — a security-header change
     with its own approval.
  4. **Comparison is by `barangay_code`** where a code comparison is what the question needs
     (**P1a**), and by distance to a barangay centroid where an ordering is what it needs (**P1**).

  ⚠️ **THE HIERARCHY, CORRECTED.** This was proposed as "city → region → barangay". That is not the
  PSGC structure: **region is broader than city, not between city and barangay**, and province was
  missing. The containment is

  ```
  region  ⊃  province  ⊃  city/municipality  ⊃  barangay
  ```

  so ranking narrowest-first — which is what "near" means — gives

  ```
  barangay → city → province → region → elsewhere
  ```

  That is **the shipped four-tier ladder with one rung added on top**, not a reordering. `rankTier`
  (`lib/nearby.ts:52`) already walks city → province → region → elsewhere; barangay becomes the new
  tier 0 and every existing tier shifts down one.

  **Why this direction is sound, in one line each:**
  - it costs **nothing monetary** — the device API is free and the barangay table is a static asset;
  - it needs **no migration** — `vendors.barangay_code` is already stored strictly (V1), populated
    14/14 locally;
  - it never sends a vendor's address to a third party, so **U2's licensing question never arises**;
  - the error becomes **one-sided**: the booker's point is exact and only the vendor's is approximate
    (±0.5–2 km), where today both ends are city centroids at ±5–15 km — which is why tier 0 has no
    ordering at all.

  ⚠️ **What this direction still does NOT give, so it cannot be promised:**
  - **No map pins per vendor.** Several vendors in one barangay share one point — **B5 holds**, and
    **F27** adds that a count-of-1 barangay marker is a vendor pin *by arithmetic*.
  - **No kilometre figure rendered**, anywhere. §5.2 is unchanged by better coordinates; a barangay
    centroid is still the middle of an area.
  - ✅ **AND THE DATASET DOES EXIST — measured 2026-10-17, after this decision.** A licensed,
    PSGC-keyed barangay coordinate set joins **99.8%** of booker's barangay codes (96.2% with exact
    or correspondence-matched HDX geometry; 0.2% flagged unverified). **D11's direction stands and is
    now fully buildable** — barangay remains the ceiling, no vendor is geocoded, and both the
    code-equality tier (P1a, which never needed data) and the distance gradient (P1) are available.
    ⚠️ An earlier version of this line said the dataset "largely does not exist" at ~28%; that was an
    inference, not a measurement, and it was wrong — see the successor plan's U1.
  - **Nothing at barangay level works without the dataset.** Device location gives a *point*;
    turning that point into a barangay needs barangay reference data, which **does not exist in this
    repo**. City-level device resolution works today (1,634 centroids, 100% coverage, already
    shipped); barangay-level does not. ⚠️ **One unblocker gates all of it: does a licensed,
    PSGC-keyed barangay centroid dataset exist?** Same question U3 answered for cities.
  - **Nothing is observable at today's density** (**F27**): 14 vendors, 14 cities, 14 barangays.
  - ⚠️ **Privacy changes category.** Everything shipped so far uses the vendor's *public business
    address*. The device position is the **booker's own**, which is personal data — §6.2 leans on
    exactly that distinction to justify the current design. This direction takes that on, with a
    permission prompt and a stated reason.

  ⚠️ **Nothing here is built.** D11 sets direction for **P1, P1a and P4**, all parked. The build
  needs its own plan, its own gates (**G2** at minimum) and a resolved dataset question first.

---

## 13. Rejected alternatives

- **X1 — Capture the vendor's device location at signup.** The user's own constraint, and correct:
  vendors register away from the shop. The saved operating address is the only trustworthy source.
- **X2 — Store a customer address on `profiles` and rank from it.** Needs a migration, a Settings UI,
  and it collects personal data to answer a question a city picker answers for free. V4: the platform
  has never needed a customer address — the model is "the customer travels to the vendor".
- **X3 — Radius filtering ("within 2 km").** At city granularity the number would be fiction. It is
  the predecessor plan's `P11` phrasing and it stays parked until Stage 4.
- **X4 — A flat reordered list with no group headers.** Cheaper, and it is exactly how a customer comes
  to believe a result 300 km away is "near" them. Headers are the honesty mechanism.
- **X8 — Per-vendor map pins from city centroids.** Considered and rejected as part of D5's
  resolution: every same-city vendor would sit on one coordinate, and a pin is read as a door.
  Replaced by the city-marker-with-count design (§4.4) and guarded by **B5**. Revisits only at Stage 4.
- **X9 — Device geolocation reverse-geocoded through a provider.** Rejected under D4 and separately on
  policy: Nominatim's own usage policy treats periodic requests from an app as bulk geocoding and
  strongly discourages them, and prohibits client-side autocomplete (§6.2).
- **X5 — Rank by `zip_code` proximity.** Explicitly excluded by the user's brief, and rightly: PH ZIP
  codes are not spatially ordered, so numeric nearness is not geographic nearness.
- **X6 — Use `vendors.region` for geography.** `schema.md:264,290` — a free-text Command field,
  defaulted to `''` at self-registration. Unusable. ⚠️ The *PSGC* region (V10) is a different thing,
  derived from `city_code`, and is the one D3 option B proposes.
- **X7 — Rank server-side in a new RPC.** Unnecessary: V8 means the whole candidate set is already in
  memory, so an RPC would add a migration and a round-trip to do what a pure function does, and it
  would reintroduce the paginate-then-rank hazard the current architecture does not have.

---

## 14. Parked

- **P1 — Barangay-centroid proximity (±0.5–2 km).** The one route to real intra-city ordering that
  needs **no** provider, since `barangay_code` is already stored strictly (V1). Parked on sourcing: a
  ~42,000-row PSGC-keyed barangay centroid dataset with a clear licence, ~1.5 MB. Unblocked by finding
  one and reviewing its coverage. Strictly better than Stage 4 on privacy and cost; strictly worse on
  precision.
  ✅ **THE DATASET QUESTION IS ANSWERED, AND THE ANSWER IS YES** (measured 2026-10-17 by
  `.plans/scripts/barangay-centroid-probe.py`). A licensed, PSGC-keyed barangay coordinate set
  exists: **41,972 of booker's own 42,046 barangay codes join — 99.8%** — with **96.2%** carrying
  exact or correspondence-matched HDX geometry and only **0.2% flagged `fallback_unverified`**.
  Source: the `psgc` package (MIT *code*) over **COD-AB geometry (CC BY-IGO data — attribution is
  owed and MIT does not cover it)**.
  ⚠️ **AN EARLIER VERSION OF THIS NOTE SAID "LARGELY NO, ~72% DERIVED FROM COARSER POLYGONS". THAT
  WAS WRONG** — an inference from two documents presented as a measurement. Measured, **2 rows out of
  42,010** equal their parent city's coordinate. The lesson and the superseded reasoning are kept in
  the successor plan's U1.
  **So P1 is viable**, with one condition: the generated table must carry a **per-row provenance
  flag** and exclude `fallback_unverified` — that 0.2% is where all three spatially implausible rows
  live, one of them **385 km** from its own parent city. ✅ **That condition is now a decided one**:
  the successor plan's **D5 resolved to (b), the trust filter** (2026-10-17, user) — provenance per
  row, `fallback_unverified` excluded, everything else degraded to the city tier. Full detail, the
  exact filter and the measurement are in `.plans/2026-10-16-booker-barangay-near.md` → U1/I9/D5.
  ⚠️ **Two further findings sit on this item and both change its shape — read before planning it:**
  **F27** (barangay granularity is *less* honest at low density; a count-of-1 marker is a vendor pin
  by arithmetic, so P1 needs a count threshold and waits for density) and the **delivery correction**
  below.
  ⚠️ **Delivery is cheaper than "~1.5 MB" suggests, and that was measured 2026-10-16.** The sharding
  pattern already exists in this workspace: `vendor/public/ph-address/barangays/<cityCode>.json` is
  **1,634 files, 6.6 MB in total but ~700–1,400 bytes each** (Makati 1,352 B / 33 barangays; Pila
  711 B). So a booker fetches only the barangays of the cities in their result set — ~1 KB, not
  1.5 MB. ⚠️ That tree carries **names only, no coordinates**; it proves the shape and gives the join
  key, it does not satisfy P1.
- **P1a — Same-barangay tier (code equality, NO dataset, NO coordinates).** ⬜ RECORDED 2026-10-16,
  proposed by the user to avoid P2's cost entirely — and it does.
  **A different thing from P1, and cheaper:** P1 ranks by barangay *centroid distance* and needs the
  ~42,000-row table; P1a compares `barangay_code` for **equality**, which is the same shape as the
  tiers that already exist (`rankTier` already does exactly this for `cityCode`). One more rung above
  city:
  `same barangay → "In your barangay"` · `same city` · `same province` · `same region` · `elsewhere`.
  ⚠️ **No provider, no money, no licensing question, no migration, no centroid table.** It sidesteps
  U1, U2 and G4 completely.
  **What it costs, and it is a product decision rather than an engineering one:** booker does not know
  the *booker's* barangay. `BookerLocation` (`lib/types.ts:132`) carries city and province only, so
  the booker must supply it — a third level in the location picker, a wider `BookerLocation` plus its
  `localStorage` serialisation, and one more tier and label. The picker's data is free and already in
  the workspace (`barangays/<cityCode>.json`, ~700–1,400 bytes per city).
  ⚠️ **The honest limitation: it is a BINARY, not a gradient, and barangay boundaries are everywhere.**
  A vendor across the street in the next barangay ranks *below* a vendor 5 km away in yours. At city
  scale that trade is fine — a city is a meaningful shopping unit and the boundary case is rare. At
  barangay scale the user can see the shop from their window and find it sorted beneath one across
  town. **And it cannot be softened without coordinates:** barangay codes are **alphabetical, not
  spatial** (verified 2026-10-16 — Makati runs Bangkal 001, Bel-Air 002, Carmona 005, Cembo 003,
  Comembo 004), so "the next barangay over" is not derivable from the code. Ranking neighbours needs
  centroids, which is P1.
  ⚠️ **F27 applies, but costs nothing here:** at 14 vendors in 14 barangays the chance a booker's
  barangay holds any vendor is ~nil, so P1a does nothing at today's density either. Unlike P1 it
  carries **zero B5 risk** — no markers, no coordinates, nothing to misread as a pin. "In your
  barangay" is a true statement about shared administrative geography, exactly like "In Makati City".
  **Relationship to the others:** complements P1 rather than competing (**P1a = the tier, P1 = the
  gradient**), and P1a + P4 together would give intra-city "near" with **no geocoding provider and no
  vendor-side coordinates at all** — which is the direction **D11** then took (2026-10-16).
  **Unblocked by:** (1) **OPEN DECISION — does the location picker ask for a barangay, and is it
  optional or required?** Recommendation: **optional** — pick a city as now, then optionally narrow;
  no barangay behaves exactly as today. (2) vendor density: more than one vendor per city.
  ⚠️ This OPEN decision is **scoped to P1a**, which is parked. It does not trip §12's hard gate, which
  governs the approved scope (S1–S3d) — a parked item's unblock condition is not an unresolved
  decision inside an executing stage.

- **P2 — Street-level geocoding + per-vendor pins (Stage 4).** ⏸ PARKED, and **as of D11
  (2026-10-16) it is explicitly NOT the chosen direction** — "near" stops at barangay and no vendor
  address is sent to a provider. ⚠️ **U1 and U2 are therefore moot while D11 holds**, and they are
  kept rather than aborted because reviving P2 revives them unchanged. The entry below stays as the
  record of what P2 would cost if it is ever revisited — in particular that **U2 (storage/caching
  rights) is a legal gate, not a price**, and that Mapbox sells a separate *Permanent Geocoding*
  product precisely because the standard one forbids storing results.
  Originally: its own plan, gated on §6.2's unknowns
  (U1, U2 — price and, more importantly, **caching/storage rights**) and a `vendors` migration (G4).
  ⚠️ The alternative route is a **vendor-drawn pin** in the Vendor portal — more accurate, no provider,
  no caching terms, but it is a Vendor change (§7). That choice belongs to Stage 4's plan.
  ⚠️ Now that a map exists (D5), this is the item people will ask for; **B5** is what stops it leaking
  into S3b.
- **P4 — Device location ("Use my location").** ⏸ PARKED, but **its blocking decision is now
  resolved in its favour: D11 reversed D4 on 2026-10-16.** The design was already written — offline
  nearest-centroid against the S3 dataset, **always a suggestion, never silent** — and that pattern
  is what makes the imprecision safe: a wrong guess costs the booker a tap, and a *silent* wrong
  guess is forbidden by design.
  **Still parked on, and these are the real remaining blockers:**
  (1) **gate G2** — `Permissions-Policy: geolocation=()` (`next.config.ts:243`) blocks the API for
  every origin, so nothing functions until it flips to `(self)`; a security-header change with its
  own approval.
  (2) **the barangay dataset** — city-level device resolution works *today* against the 1,634
  shipped centroids; **barangay-level needs data this repo does not have.**
  (3) **density** (**F27**) and **a privacy posture** for handling the booker's own position.
  ⚠️ **B4 does not return with G2** — see D4.
- **P3 — Mobile parity** (`ezzy-booker-mobile`). Tracked as P2 in
  `.plans/2026-09-25-booker-mobile-redesign.md:238`. ⚠️ Not closed by this plan — report only.

---

## 15. Assumptions, unknowns, risks

**Assumptions** (each would change the approach if wrong):
1. **A1** — The catalogue stays small enough for the whole-catalogue client fetch to remain the right
   architecture. The ceiling is **10,000 offerings** (`lib/pagedFetch.ts:59`) and `getCatalogue`
   reports `complete: false` past it. If the catalogue ever approaches that, ranking must move
   server-side and X7 is reopened.
2. **A2** — Vendors' `city_code` is populated in practice for active vendors. The column allows `''`
   (B2 guards it), but if a material share of live vendors hold `''`, the primary criterion is weaker
   than this plan assumes. **Unmeasured — needs a staging count** (`select count(*) from vendors where
   city_code = '' and status_id = 1`). ⚠️ Memory: migrations and hosted DB access are the user's — this
   plan asks for the number, it does not take it.
3. **A3** — Customers mostly book in the city they are in. The booking-history default (I2) rests on
   this. It is likely and it is cheap to be wrong about: the chip is one tap from being changed.
4. **A4** — "Near me" is wanted as *discovery*, not as a hard constraint. The design never removes
   results the customer did not ask to remove.

**Unknowns to resolve before the stage that needs them:**
- **U3 — ✅ CLEARED 2026-10-16. Neither of the two routes below was the answer; see F9.**
  **Shipped source:** OCHA HDX *Philippines – Subnational Administrative Boundaries* (COD-AB),
  admin level 3 — `license_id = cc-by-igo` (**CC BY 3.0 IGO**), `dataset_source = NAMRIA + PSA`,
  1,642 admin-3 features, reviewed for accuracy 2024-04-01. **Licence read from the HDX CKAN API
  itself**, not from a third party's claim about it. CC BY 3.0 IGO permits redistribution and
  adaptation with attribution, which was the question gating the stage.
  **Join:** PSA's `correspondence_code` (the 9-digit legacy PSGC code — exactly what
  `vendors.city_code` stores), carried by the `psgc` PyPI package (MIT, 2026.4.13.0) alongside the
  HDX-derived area-weighted centroids. **An exact code join, not a name match.**
  **Coverage: 1,634 / 1,634 = 100%**, 0 duplicate source codes, 0 rows without a coordinate.
  **Verification, all measured:** name agreement **1,630/1,634** with all four disagreements
  identified as real renamings (`Bacungan`→`Leon T. Postigo`, `Baliuag`→`City of Baliwag`,
  `Rizal`→`Dr. Jose P. Rizal`, `Pio v. Corpuz`/`Pio V. Corpus`) — which is itself what proves the
  code join is the right join; **independent cross-check against GeoNames ADM3** (CC BY 4.0, also
  PSGC-keyed, 1,631 overlapping) at **median 1.68 km, p90 5.23, p99 14.36**; **all 17 NCR cities**
  reviewed individually; **all 114 duplicate names** resolve to distinct, province-appropriate
  coordinates with **zero** sharing a coordinate; province-cluster outlier test flagged 3
  (`Mapun`, `Turtle Islands`, `City of Zamboanga`) and all 3 are geographically genuine.
  **One defect found and fixed — see F10.** Regenerate with
  `.plans/scripts/build-ph-city-centroids.py`, which re-runs every check above and refuses to
  write a file that fails one.

  <details><summary>The two routes this plan predicted, and why neither was used</summary>
  - **GeoNames** — its own readme confirms **CC BY 4.0** and WGS84 decimal lat/lng in the `PH.zip` /
    `cities500` dumps. ⚠️ **Not keyed to PSGC**, so the real work is a name→code mapping over 1,634
    rows, and V7's 114 duplicate names plus V14's `City of X` naming make naive matching unsafe in
    exactly the cases that matter.
  - **PSA / NAMRIA municipal boundary polygons** — **already PSGC-keyed**, so no name matching at
    all; centroids are computed from the geometry. Attribution to PSA and NAMRIA required; the
    boundary data is 2016 vintage; needs a one-off GIS step and a review of 1,634 outputs.
  **Acceptance for either route:** a licence that permits redistribution in a web app, PSGC
  `city_code` coverage reported as an explicit count (not assumed complete), and a spot-review of at
  least the NCR cities and a sample of the 114 duplicate names. **If neither route clears, S3 parks
  and reports** — and S3b goes with it.
  </details>
- **U4** — A2's count of active vendors with an empty `city_code`. ⚠️ Memory: hosted DB access is the
  user's; this plan asks for the number.
- **U1** — Google Geocoding's current per-1,000 price and free allowance. Its own usage-and-billing
  page no longer states a rate and still cites a credit that ended 2025-02-28 (§6.2).
  **Stage 4 (parked) only.**
- **U2** — Google's (and any provider's) **caching/storage terms**, which decide whether a permanent
  `lat`/`lng` column is even licensed. Gates Stage 4 more than price does. **Parked with P2.**

**Material risks:**
- **R1 — Presenting city-level nearness as precision.** The dominant risk, and the reason distances and
  pins are prohibited before Stage 4 (§5.2). Mitigation is vocabulary: `In <city>` /
  `Also in <province>`, never a number.
- **R2 — B2 shipping unguarded.** A no-location vendor silently ranking first, with nothing on screen
  to explain it. Mitigated by the guard-first rule and a named unit test.
- **R3 — Promoting a filter that is ambiguous (B1).** Fixed by code-keying before the control becomes
  prominent, not after.
- **R4 — The visual suite giving false assurance.** `.plans/2026-09-18-...` F64/I51: baselines can pass
  through a colour change when `threshold` is left at its default. Any new token is measured, and
  new baselines are recorded with the clock frozen (F46).
- ~~**R5** — A silent geolocation denial.~~ ✖ Not reachable: D4 ships no device location and the header
  is unchanged.
- **R6 — Shrinking the perceived catalogue.** A prominent location chip can make Booker feel emptier
  than it is, and **D2 makes this sharper** — a customer in an unserved municipality now has a way to
  tell Booker so. Mitigated by `Anywhere` always being one tap away, by the per-option vendor counts
  in the picker (§4.2), by tier groups rather than hard filtering on Home, and by an acceptance check:
  the shelf is additive — no existing shelf loses results in S1.
- **R7 — The map becoming a vendor map (D5/B5).** The highest-consequence risk in the approved scope,
  because the wrong version is *easier* to build and looks better. Mitigated structurally: the marker
  type carries no vendor identity, the zoom is capped, and a unit test asserts one marker per city.
- **R8 — U3 failing after S1/S2 have shipped.** Mitigated by design: S1+S2 are a complete feature
  with zero coordinates, so a failed U3 removes the distance ordering and the map and leaves a working
  product. This is the reason the stage order is 1 → 2 → 3 → 3b and not "dataset first".
- **R9 — A map library re-entering the bundle it was removed from.** Leaflet was deliberately
  uninstalled 2026-09-22. Mitigated by the `dynamic` import (nothing in the initial bundle), the
  collapsed-by-default panel (zero tiles fetched until asked), and gate G5 being a real decision at
  install time rather than a formality. ⚠️ `next build` output size should be compared before and
  after, and reported.

---

## 16. Execution order

One stage at a time, reported after each (developerboss cadence). All decisions are resolved;
**execution waits only on G1.**

> **⚠️ The one coupling that decides the shape of this release: U3 → S3 → S3b.**
> S3 needs a licence-clean, PSGC-keyed centroid dataset (U3) and S3b needs S3's coordinates. **S1 and
> S2 are deliberately independent of both** and deliver a complete, honest feature on their own. If
> U3 cannot be cleared, **S3 and S3b park and the release still ships** — it loses the distance
> ordering *within* tiers 1–3 and the map, and keeps everything else. Do not reorder these stages to
> "get the data first": that would put the whole release behind an unknown.

### S1 — Location as a real, remembered concept (B1, I2, I4, I5, I8, I10, §9)
Gates: **G6** (the PSGC asset copy).
1. `services/offerings.service.ts` + `lib/types.ts` — add `city_code`/`province_code` (V3).
2. Copy `cities.json` + `provinces.json` into `booker/public/ph-address/` (**I8**, G6) — **not** the
   barangays tree — and add the provenance note to `booker/AGENTS.md`.
3. `lib/phCities.ts` + tests — code-keyed options, province labels, V14 normalisation, the vendor
   counts, and **I10**'s region-name map.
4. `useAppShell` — `location` object, post-mount `localStorage` read, booking-history default (I2).
5. `LocationPicker`, `LocationChip` (§9 separation table), including the dataset-fetch-failed fallback.
6. `ExplorePage`'s `Where` becomes code-valued; `useHomePage`'s two city sites move to `cityCode`.

**Acceptance criteria:** a chosen city survives a reload; a returning customer with a booking sees
their city pre-set with no prompt; two same-named municipalities are distinguishable in the picker and
filter independently (**B1**); a municipality with no vendors is selectable and shows no count; the
dataset is fetched on picker open, not on app load; nothing on Home or Explore regresses when the
location is unset.
**Verification:** `npx tsc --noEmit`, `npm run lint`, `npm test` (new `phCities` tests), `npm run
test:visual` with fresh baselines for the chip. **Needs a live check:** reload persistence, the
history default against seeded data, and that the 108 KB fetch is not on the shell's critical path
(Network panel).

### S2 — Honest ranking + the filter/sort split (B2, B3, I1, I3, I7, §5)
Depends on: S1. Gates: none.
1. `lib/nearby.ts` + `lib/nearby.test.ts` — four tiers (D3), stability, **B2's guard first**.
2. `useExplorePage` — `sort` state, rank **before** the slice, **sort in `filterKey`** (B3), groups.
3. `ExplorePage` — the `Sort` control, group headers, the extended no-results action.
4. `NearYouShelf` + hook + CSS; mounted after the in-progress strip.
5. **I7**'s doc updates (`portals.md:71-72,232,1140`, `booker/AGENTS.md` Maps row) — "no proximity is
   possible" becomes wrong in an important way once this ships.

**Acceptance criteria:** with a location set and `Sort = Near me`, a tier-3 vendor that would be on
page 1 unsorted is absent from the first 24 (ranking precedes pagination, V8); flipping the sort resets
the reveal to 24; a `cityCode: ""` vendor never ranks above a same-city vendor; all four tiers render
with their own labels; **no distance figure appears anywhere**; a city with nothing in city/province/
region says so rather than showing unlabelled far results.
**Verification:** `tsc`, lint, `npm test` (the four named assertions are unit tests), `test:visual`
with measured contrast on the new tokens (R4). **Needs a live check:** the labelled-group view against
seeded data, and a 360 px phone pass on the Home chip and the Explore sort row (I43's 44 px rule).

### S3 — City-centroid distance ordering (D6, U3)  ✅ DONE 2026-10-16
Depends on: S2. **Conditional on U3 — this stage's first task may end it.** It did not: U3 cleared.
1. ✅ **U3 cleared and reported before any code was written** — see §15. HDX/OCHA COD-AB admin-3
   centroids, CC BY 3.0 IGO, joined on PSA's `correspondence_code`, **1,634/1,634 = 100%**.
2. ✅ `booker/public/ph-city-centroids.json` (**G6b taken**) — 50 KB raw, **~15 KB gzipped**.
   Attribution lives **inside the asset** (`attribution` key), not only in a doc, so it travels
   with any copy of the file; a test asserts it is still there. Generated by
   `.plans/scripts/build-ph-city-centroids.py` (offline, 9 assertions, refuses to write on failure).
3. ✅ `lib/geoCentroids.ts` + `lib/geoCentroids.test.ts` — `parseCentroidAsset`, `centroidOf`,
   `haversineKm`, `cityDistanceKm`. **9 tests, and they read the real shipped asset** (the
   `lib/palette.test.ts` pattern) because the failure mode is wrong *data*, not wrong code.
4. ✅ `lib/nearby.ts` — within-tier tiebreak via an **optional** 4th argument, so every existing
   caller keeps working unchanged; **tier 0 provably untouched**; missing centroid → `Infinity` →
   last within its own tier, never out of it. **8 new tests** in `lib/nearby.test.ts`.
5. ✅ `lib/phAddress.ts` (`loadCityCentroids`, module-cached) + `hooks/useCityCentroids.ts`, wired
   into `useNearYouShelf` and `useExplorePage`. Fetched **only once a location is set**, and on
   Explore only while `Sort = Near me`.

**Acceptance criteria — all ✅, each with a named test:** tiers 1–3 order by real city-to-city
distance *(`S3: tier 1 is ordered by real city-to-city distance`, farthest supplied first so a pass
cannot be an accident of input order)*; tier 0's order is unchanged *(`tier 0 is not reordered` —
asserts the output is **identical with and without** centroids)*; a city with no centroid still
appears, last within its tier *(`sorts last WITHIN its tier, never out of it`)*; the haversine matches
known PH pairs *(Manila–Cebu ≈ 572 km, Manila–Davao ≈ 972 km, 1° of latitude ≈ 111.2 km, all from
published positions rather than from the asset)*; **no distance is shown anywhere** — nothing was
added to any `.tsx`, and the visual suite is unchanged at 103/103; coverage reported as **1,634/1,634**.
**Verification:** `npx tsc --noEmit` clean · `npm test` **253 passed** (was 236; +17) · `npm run lint`
**18 problems — identical to baseline, S3 added none** · `npm run build` compiles ·
`npm run test:visual` **103 passed**, no baseline drift (S3 changes ordering, not pixels).
**Needs a live check:** the ordering against seeded data in at least two provinces, and that the
50 KB asset is fetched only after a location is set (Network panel).

### S3b — City-level map panel on Explore (D5, I9, B5)  ✅ DONE 2026-10-16 — one blocker reported (F14)
Depends on: **S3 completed with usable coverage.** Gates: **G5** (map dependency).
1. ✅ **G5 given 2026-10-16.** Installed `leaflet@1.9.4` (dependency) + `@types/leaflet@1.9.22`
   (**devDependency** — npm put the types in `dependencies`; every other `@types/*` in this app is
   a devDependency, so it was moved).
2. ✅ `components/explore/CityMapPanel/` — `CityMapPanel` + `useCityMapPanel` + CSS, and a separate
   `CityMapView` + `useCityMapView` + CSS holding everything that touches Leaflet. The split is
   what makes the `dynamic(..., { ssr: false })` import work: the panel shell carries no reference
   to the library.
3. ✅ `lib/cityMarkers.ts` — the derivation, **pure and unit-tested**, so B5's guarantee is a test
   rather than a habit. `MAP_MAX_ZOOM` = 11 in `lib/constants.ts`. Tile-failure fallback built and
   **observed firing** under a real CSP block.
4. ⚠️ **F14 — the basemap has no provider.** CARTO now requires an API key on every path, and
   answers an unkeyed request with a 200 and a watermark PNG that fires `tileload`, so it cannot be
   detected in the browser. The basemap was therefore made **configuration** (`lib/mapTiles.ts`,
   three `NEXT_PUBLIC_MAP_TILE_*` variables) with **no default**, and an unconfigured map renders
   the city-list fallback instead of a watermark. **Choosing the provider is the user's call** and
   a non-CARTO host also needs a CSP change — both are gates, so neither was taken.

**Acceptance criteria:** one marker per city with a correct count (**B5**'s test); markers always
match the current filter; the collapsed panel fetches zero tiles and adds nothing to the initial
bundle; a city with no centroid is reported in the footer, never plotted at a guess; **no vendor
marker, no vendor name and no distance anywhere on the map**; the tiles-failed state says so instead
of showing a grey grid.
**Verification:** `tsc`, lint, `npm test` (B5's assertion), `test:visual` for the **collapsed** toggle
only (never an open map — tiles are network-dependent), and a `next build` bundle-size comparison
before/after (R9). **Needs a live check:** tiles actually loading under the production CSP (V12 — a
blocked tile is a silent blank square), both themes, and a 360 px phone pass.

**Acceptance criteria — measured 2026-10-16:**

| Criterion | Outcome |
|---|---|
| One marker per city, correct count | ✅ `cityMarkers.test.ts` — 7 vendors in one city → **1 marker, `vendorCount === 7`**; 4 services from 1 vendor count **once** |
| Markers match the current filter | ✅ Derived from the filtered set (both halves of it), not the 24-card reveal — see F16 |
| Collapsed panel fetches zero tiles, adds nothing to the bundle | ✅ **+108 bytes** initial JS, measured by building with and without the panel. Leaflet's 148,486-byte chunk is **absent from the initial HTML**, and absent from the build entirely when the panel is detached |
| A city with no centroid is reported, never plotted | ✅ unit-tested; the footer names it |
| No vendor marker, no vendor name, no distance | ✅ enforced by `CityMarker`'s shape, asserted at runtime *and* by `tsc`. No `.tsx` renders a kilometre figure |
| Tiles-failed says so instead of a grey grid | ✅ **observed firing**: pointing the map at a host outside `img-src` blocked every tile and the panel swapped to its city list, with the CSP violation in the console |
| `tsc` / lint / `npm test` / `build` / `test:visual` | ✅ clean · **18 problems, identical to baseline — S3b added none** · **269 passed** · compiles · **105 passed, exit 0** |

**Still needs a live check:** a basemap actually rendering (blocked on F14), both themes with real
tiles, and a 360 px phone pass.

### S3c — Swap the drawing layer to MapLibre GL + OpenFreeMap (D7, D8, D9, B6, I12)  ✅ DONE 2026-10-16
Depends on: **S3b** (everything except the drawing layer is already built and verified).
Gates: **G8** (dependency), **G9** (CSP). ⚠️ **Both are open — this stage does not start without them.**

1. **G8** — `npm i maplibre-gl@6.14.0`; `npm rm leaflet @types/leaflet`. ⚠️ `maplibre-gl` ships its
   own types, so there is no `@types/*` to place.
2. **G9 + B6** — the CSP change, **first**, and rewrite the `blob:` comment at
   `next.config.ts:168-170` rather than just adding the token. Nothing else in this stage can be
   seen working until this lands.
3. **D8** — put `maplibre-gl-worker.mjs` on our own origin and call `setWorkerUrl()`, so
   `worker-src` stays absent from the CSP. Settle the copy-vs-commit question with the file in hand.
4. **I12** — rewrite `useCityMapView.ts` and `CityMapView.tsx`; reshape `lib/mapTiles.ts` to a style
   URL with the **D9** pair as its default. Reuse `CityMapView.module.css` unchanged.
5. **Re-verify what S3b already proved**, because a renderer swap invalidates the evidence, not the
   conclusions: the collapsed baseline, the marker/count assertions, R9, and the CSP suite.

**Acceptance criteria — measured 2026-10-16:**

| Criterion | Outcome |
|---|---|
| Draws OpenFreeMap tiles in both themes | ✅ **33 responses in light, 22 in dark, all HTTP 200**, zero blocked. Attribution rendered automatically from the TileJSON |
| A theme flip keeps its markers | ✅ by construction — `setStyle` was **removed**, so a style change rebuilds through the same path that first open already proves (**F20**). Both themes verified from a cold load. ⚠️ A *runtime* flip with the map already open still wants a live check |
| One marker per city, no vendor identity | ✅ unchanged from S3b and untouched by the swap — `lib/cityMarkers.ts` and its tests never moved |
| Initial JS stays flat | ✅ **1,137,912 bytes before and after — byte-identical**, against a 1,066,237-byte MapLibre chunk (7× Leaflet's) that loads only on open |
| `csp.spec.ts` passes with a map open | ✅ new test added; **3 passed**. It asserts zero violations, zero blocked requests, that tiles were *actually* requested, and that the fallback did **not** appear |
| No distance anywhere | ✅ no `.tsx` renders a kilometre figure; marker titles say "vendors" |
| Tiles-failed fallback still fires | ✅ the detection carried over to `map.on("error")`; the CSP-block path was observed firing during S3b and the branch is unchanged |
| All markers actually framed | ✅ **after fixing F19** — all four inside the viewport, zoom 4.41 |
**Verification:** `tsc`, lint, `npm test`, `test:visual` (collapsed toggle only), `next build` with a
before/after initial-JS measurement, and `csp.spec.ts` extended per B6.
**Needs a live check:** both themes against real tiles, a 360 px phone pass, and a production-header
run — dev and prod CSP are the same here, but K11 is the reason that gets confirmed rather than
assumed.

### S3d — Code-keyed popularity (I6, D10, F25, I7 item 1)  ✅ DONE 2026-10-16 (local) — hosted apply outstanding
Depends on: nothing in this plan — the RPC is independent of the location picker, the ranking
ladder and the map. Gate: **G3** (migration) — ✅ **GIVEN 2026-10-16**.
⚠️ **Named S3d, not S4**, because "Stage 4" is this plan's name for the parked geocoding phase
(§14, P2) and reusing the number would read as that work starting.

1. **The migration** — `20261016000001_popular_offerings_by_city_code.sql`. Drops the
   `(date, date, text, int)` signature and recreates it with `p_city_code` per **D10**; adds the
   blank-code raise; corrects the "free text a vendor typed" comment that **I7 item 1** could not
   fix in the applied file. ⚠️ **Re-applies `revoke … from public, anon`** — a DROP + CREATE is a
   new object, so `20260927000001`'s revoke does **not** carry over. This is not redundant.
2. **The booker side** — `p_city_code` in `offerings.service.ts`, and the `city` prop split into
   `cityCode` (filters) + `cityLabel` (prints) through `PopularShelf` → `usePopularShelf` →
   `HomePage`. The RPC cache key moves to the code, since two municipalities sharing a label must
   be two keys. **F25** is fixed in passing and pinned by two new unit tests.
3. **Proof it works — the part that still needs a database.** ⚠️ **The local seed cannot
   reproduce the bug**: all 14 active vendors sit on unshared city names (checked individually
   against the 114-name list), so the pooling never fires. The harness must therefore build its
   own fixture — two vendors in two *different* municipalities that share one name (e.g. two of
   the seven `Pilar`s), each with a booking in the window — then assert the counts come back
   **separated by code**, where the old function would have pooled them. Run it inside
   `begin … rollback` so the fixture never persists. Two obstacles to expect, both known:
   `20260930000001` guards vendor activation on KYC, and the function's `is_active()` gate means
   psql must set `request.jwt.claims` to a real active user or every call raises `42501`.

**Acceptance criteria:**

| Criterion | Outcome |
|---|---|
| Filters on the code, not the name | ✅ `v.city_code = p_city_code`, no `lower()` |
| A blank code cannot mean "everywhere" | ✅ raises `22023`; `null` still means platform-wide |
| One definition of "popular", not two | ✅ old signature dropped in the same migration (**D10**) |
| Either deploy order is safe | ✅ **probed**, not assumed — unknown arg → `PGRST202`/404 → `[]` → hidden shelf (**D10**) |
| `anon` still cannot execute it | ⬜ **needs apply** — the revoke is re-issued in the file; the verify query is in its header |
| Two same-named municipalities no longer pool | ⬜ **needs apply** — step 3's harness, which does not exist yet |
| Nothing else calls the old signature | ✅ grep across three web apps, two Expo apps and every migration: one caller |
| The caption prints a display name | ✅ **272/272** tests, 2 of them new for **F25** |

**Verification:** `tsc` clean · 272/272 unit tests · lint **18** (agreed baseline) · `next build`
compiles · grep for residual `p_city` callers returns only comments.
**Needs a live environment:** everything in step 3, plus the `routine_privileges` check on each
database the migration reaches. ⚠️ **The migration has not been applied anywhere** — not even
locally. Applying is the user's, by standing rule.

---

#### S3d — PRE-APPLY CHECKLIST (review requested by the user, 2026-10-16)

An audit of `20261016000001` *before* it is run, asked for in those words. Everything below was
checked against the real database and the real repo, not reasoned about. ⚠️ **Read item 0 first —
it is a blocker and it is not about the SQL.**

**0. ✅ RESOLVED 2026-10-16 — the branch gap is closed (F26).** The migration was written while
`backbone` sat on `develop`, which was missing the three migrations that precede it. ⚠️ **The user
fixed this the right way and it was not the way this checklist first recommended** — see F26. They
ran `git flow feature finish` on `feature/booker_gaps`, merging it into `develop` (merge commit
`2a28ab5`), so `develop` now *contains* `20261002000001`, `20261003000001` and `20261004000002`
rather than the migration being parked on a feature branch to work around their absence.

Re-measured after the merge, on `develop`:

| Check | Result |
|---|---|
| Migration files on disk | **88** |
| Applied in the local DB | **87** |
| Pending (file, not applied) | **exactly `20261016000001`** — mine, and only mine |
| Applied with no file | **none** — the gap that caused this item is gone |
| Sort position | last (`20261004000002` → `20261016000001`) |
| Overloads of `get_popular_offerings` | still exactly one, `(date,date,text,integer)` — the `drop` target is unchanged |

The file was removed for a clean branch move and **restored byte-identically** from a pre-move copy
(sha256 `4048634e4fe9f953…`, 201 lines) rather than rewritten from memory.

**Already verified — clean, no action:**

| ✔ | Check | Evidence |
|---|---|---|
| ✅ | Nothing depends on the function | `pg_depend` on the regprocedure, excluding auto deps: **none**. No view, trigger, default or policy breaks when it is dropped |
| ✅ | PostgREST will notice the swap | `pgrst_ddl_watch` (`ddl_command_end`) and `pgrst_drop_watch` (`sql_drop`) both exist, so the schema cache reloads itself. The function will **not** linger as missing |
| ✅ | The `drop` signature is exactly right | One overload in `public`: `get_popular_offerings(date,date,text,integer)`. `int` resolves to `integer`, so the drop matches |
| ✅ | No ghost overload to orphan | The `(date, int)` shape in the predecessor plan's draft (`2026-09-18`, line 1888) was **never applied** — not in any migration, not in `pg_proc` |
| ✅ | Syntax and references are valid | The body was created as `pg_temp.pop_syntax_check` and accepted. `check_function_bodies` is on, so the inner SQL resolved too. ⚠️ `public` was re-checked afterwards and is **untouched** — nothing was applied |
| ✅ | The apply is atomic | Supabase runs each migration in a transaction, so there is no window in which the function does not exist |
| ✅ | `NULL` still means platform-wide | `if p_city_code = ''` evaluates to `NULL` for a `NULL` input, and plpgsql takes the else branch — so the new raise cannot swallow the "Anywhere" case |
| ✅ | The app cannot send `''` | `useAppShell`'s parser requires `typeof parsed.cityCode === "string" && parsed.cityCode` — a truthy test, so a blank code is rejected into `{made:false}` before it can reach the RPC. The raise is a backstop, not a live path |
| ✅ | No other caller, anywhere | One: `booker/services/offerings.service.ts`. Grepped three web apps, two Expo apps, every migration and `seed.sql` |
| ✅ | None of the local↔hosted divergences apply | `database-reset-and-deploy.md` lists four. This migration has **no backfill**, uses **no extension**, and schema-qualifies everything (`public.bookings`, `public.is_active()`) |

**Still to do, in order:**

1. ✅ **Item 0** — done; `develop` is merged and the only pending migration is this one.
2. ⬜ **Check for an extra overload on staging and production.** ✅ **answered for LOCAL** by the
   user on 2026-10-16 — one row, `p_city_code text DEFAULT NULL::text` — and the grants query
   returned `service_role` / `authenticated` / `postgres`, **no `anon`**. ⚠️ **Still open for
   staging and production**, which is where an extra hand-applied overload would hide. The `drop`
   targets one signature; a
   second one applied by hand in a hosted environment would survive and leave PostgREST with an
   ambiguous name. The one question local cannot answer:
   ```sql
   select p.oid::regprocedure, p.prosecdef
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_popular_offerings';
   ```
   Expect exactly **one** row, `(date,date,text,integer)`.
3. ✅ **Applied and grants re-checked** — **local only**, by the user, 2026-10-16.
   `supabase_migrations.schema_migrations` carries `20261016000001`; the function reports
   `p_since date, p_until date DEFAULT NULL::date, p_city_code text DEFAULT NULL::text, p_limit
   integer DEFAULT 8`; EXECUTE is `service_role` / `authenticated` / `postgres` with **no `anon`**.
4. ✅ **The proof harness exists, ran, and passed** — `.plans/scripts/s3d-popular-city-code-proof.sql`.
   See "Proof" below.

---

#### S3d — PROOF (ran 2026-10-16, local, `.plans/scripts/s3d-popular-city-code-proof.sql`)

⚠️ **The local seed cannot reproduce the bug** — none of its 14 active vendors sits on a shared
city name — so the harness builds its own fixture. Two design choices made it safe and cheap:

- **It inserts no bookings.** The placement trigger (`20260803000005`) validates a booking against
  schedules, capacity and real occurrences, so synthesising one is a fight for no benefit. Instead
  it **relabels two vendors that already have bookings** — the city filter is the whole subject.
- **Safe to relabel**: both BEFORE UPDATE triggers on `vendors` short-circuit when `status_id` is
  unchanged (`prevent_vendor_status_self_update`, `validate_vendor_status_transition` — read, not
  assumed), and the KYC guard is `OF status_id` only.
- **Everything is inside `BEGIN … ROLLBACK`**, and the harness re-selects the two vendors *after*
  the rollback to prove the fixture is gone. It is.

The fixture: vendor `…0001` → `Pilar / 030811000` (Central Luzon) and vendor `…0003` →
`Pilar / 166716000` (Caraga) — **one name, two codes, thirteen regions apart**.

| | Result |
|---|---|
| The old name predicate on that fixture | `lower(v.city) = lower('Pilar')` → **2 vendors matched. The bug, reproduced.** |
| `p_city_code = '030811000'` | **2 offerings, 28 bookings** — vendor `…0001` only |
| `p_city_code = '166716000'` | **1 offering, 7 bookings** — vendor `…0003` only |
| `p_city_code = null` | **3 offerings, 35 bookings** — exactly 2+1 and 28+7, so nothing is lost or double-counted |

| Assertion | |
|---|---|
| A1 — arm A returns only vendor A's offerings | **PASS** |
| A2 — arm B returns only vendor B's offerings | **PASS** |
| A3 — the two arms are disjoint | **PASS** |
| A4 — both arms are non-empty (the test isn't vacuous) | **PASS** |
| A5 — a blank code raises `22023` | **PASS** — *"p_city_code is blank — pass null for platform-wide"* |

⚠️ **A3 reported FAIL on the first run, and it was a bug in the harness, not the migration.** The
assertion read `select 1 from arm_a intersect select 1 from arm_b`, which intersects the literal
`1` with itself and therefore always fails whenever both arms are non-empty. Corrected to intersect
`offering_id`, re-run, PASS. The wrong version is quoted in a comment at that line so the next
person does not rewrite it. ⚠️ **An assertion that fails is not evidence the subject is fine** —
the arithmetic above (2+1=3, 28+7=35) would have made it tempting to wave it through.

---

⚠️ **A CORRECTION TO THIS PLAN'S OWN VERIFICATION CLAIM.** S3d was reported with "`tsc` clean" in
the verified column. That is true and it is **not** evidence for this change: booker's Supabase
client carries **no `Database` generic**, so `rpc()` arguments are `any` and the compiler cannot
check that `p_city_code` matches the function's parameter. Nothing in CI can. The first real
validation of the parameter name is a live call — which is why item 3 is not optional.

**Two gaps this review found and closed** (both documentation, both committed to the root repo):
- `architecture/schema.md` had no row for this migration. Added, including that it is **not applied
  anywhere yet**. ⚠️ Still missing rows for `20260922000001` and `20260927000001` — the two RPC
  migrations were never recorded in that table. Pre-existing, reported, not fixed here.
- `architecture/portals.md` still read *"Home 'Popular this month' — ❌ Not built, blocked on the
  `get_popular_offerings` approval gate"*. It shipped 2026-09-27. Corrected, with the correction
  dated in place.

### S4 — *Separate plan (P2).* Street-level geocoding + per-vendor pins
Gated on U1, U2, a `vendors` migration (G4) and, if the pin route is chosen instead, a Vendor change
(§7). **Not part of this plan's scope.**

---

## 17. Approval gates

| Gate | What | When | Status |
|---|---|---|---|
| **G1** | **Execution approval for this plan** — all decisions resolved, so this is the only thing blocking S1 | Before S1 | ✅ **GIVEN** 2026-10-15, for the range S1–S3 |
| **G6a** | **New bundled asset** — copy `ph-address/{cities,provinces}.json` (~112 KB) from `vendor/public/` into `booker/public/` (I8) | S1 step 2 | ✅ **TAKEN** 2026-10-15 |
| **G6b** | **New bundled asset** — `ph-city-centroids.json` (~50 KB) | S3 step 2 | ✅ **TAKEN** 2026-10-16 — 50,519 bytes, ~15 KB gzipped. CC BY 3.0 IGO, attribution inside the file |
| **G5** | **New dependency** — a map library (recommended `leaflet` + `@types/leaflet`) | S3b step 1 | ✅ **GIVEN 2026-10-16.** `leaflet@1.9.4` + `@types/leaflet@1.9.22`. Costs **+108 bytes** of initial JS; the 148 KB library is a lazy chunk fetched only when the map is opened |
| **G7** | **Basemap provider** — which tile service the map draws on, and the `img-src` change if it is not CARTO | Before the map can show tiles (F14) | ✅ **RESOLVED 2026-10-16 (D7)** — **MapLibre GL JS + OpenFreeMap**. **No account, no registration, no API key**, commercial use permitted. Verified against OpenFreeMap's own page and by fetching the style and TileJSON |
| **G8** | **Dependency change** — add `maplibre-gl`, **remove `leaflet` + `@types/leaflet`** | S3c step 1 | ✅ **GIVEN 2026-10-16.** `maplibre-gl@6.14.0` in, Leaflet and its types out. Ships its own types, so no `@types/*`. **0 bytes** added to initial JS; the 1.07 MB chunk is fetched only when the map opens |
| **G9** | **Security header** — `next.config.ts` CSP: `tiles.openfreemap.org` into `connect-src` **and** `img-src`, plus `blob:` in `img-src` | S3c, with **B6** | ✅ **GIVEN 2026-10-16.** Applied, and the three stale comments around it rewritten rather than left to mislead (incl. F17). **No `worker-src` was added** — D8's same-origin worker made it unnecessary |
| **G2** | **Security header** — `geolocation=()` → `(self)` in `booker/next.config.ts:243`, so the browser Geolocation API can be used at all | Whenever P4 is built | ⬜ **RESTORED 2026-10-16 by D11** (was ✖ WITHDRAWN under D4). ⚠️ Not given — it is a security-header change and needs its own approval when P4 is planned. ⚠️ The header currently blocks the API for **every** origin, so no amount of device permission works without it. **B4 does not return with it** — see D4 |
| **G3** | **New migration** — code-keyed `get_popular_offerings` (I6) | S3d step 1 | ✅ **GIVEN 2026-10-16** — "I will allow migrations for that particular stage". `20261016000001_popular_offerings_by_city_code.sql` written; **shape resolved as D10**. ⚠️ The gate covers *writing* the migration, **not applying it** — applying stays the user's by standing rule, and it has not been applied anywhere, including locally |
| **G4** | **Schema change** — `lat`/`lng`/`geocode_precision` on `vendors` | Stage 4's own plan | ⏸ parked with P2 |

No package is installed and no asset is committed before its gate, and **G5/G6b are still real
decisions at the time they arrive** — approving this plan is not an advance approval of the install
(root `AGENTS.md`: installing a dependency is its own gate, and the developerboss cadence says an
override to run several stages never waives one).

✅ **No migration, RLS policy, grant, trigger or function change appears in any approved stage** (§8).

---

## 18. Status table

| ✔ | ID | Item | Stage | Status | Note |
|---|---|---|---|---|---|
| [x] | V1–V14 | Investigation — vendor address model, booker city plumbing, PSGC dataset, providers | — | ✅ DONE 2026-10-14 | Verified by reading the files, measuring the dataset in `python3`, and fetching the OSMF, Google and GeoNames pages |
| [x] | D1–D6, D-U3 | **All seven decisions** | — | ✅ RESOLVED 2026-10-14 | §12. D5 went against the recommendation; dissent and resolution recorded |
| [x] | B1 | City filter ambiguous across provinces (114 dup names) | S1 | ✅ DONE 2026-10-15 | Filter, state, storage and picker all keyed on `city_code`. Regression test in `lib/search.test.ts` proves two "Burgos" filter independently |
| [x] | B2 | Empty `city_code` must not rank as a match | S2 | ✅ DONE 2026-10-15 | Guard is the first line of `rankTier`. Named test asserts both traps: `''===''` → tier 0, and `''.slice(0,2)` → tier 2 |
| [x] | B3 | Sort key must join `filterKey` | S2 | ✅ DONE 2026-10-15 | `sort` added to the reveal signature; ranking applied before `.slice()`, with a test proving a distant vendor leaves page 1 |
| — | B4 | `geolocation=()` silently kills a device button | — | ✖ **ABORTED** 2026-10-14 | D4: no device location. Header unchanged, G2 withdrawn |
| [x] | B5 | The map must not become a vendor-pin map | S3b | ✅ DONE (2026-10-16) | `CityMarker` carries no vendor id or name, so a per-vendor pin needs a type change. Unit-tested both ways: 7 vendors → 1 marker counting 7, and the key set asserted free of vendor identity |
| [x] | I2 | Default the location from booking history | S1 | ✅ DONE 2026-10-15 | `historyLocation` memo in `useAppShell.ts`. Derived, not an effect — see F3 |
| [x] | I4 | Persist the location choice | S1 | ✅ DONE 2026-10-15 | `BOOKER_LOCATION_KEY`, post-mount read, try/catch both ways. Explicit "Anywhere" persists too — see F4 |
| [x] | I5 | Normalise PSGC display labels | S1 | ✅ DONE 2026-10-15 | `displayCityName()` + both spellings searchable. ⚠️ Presentation only — see F2, which is the bug this nearly caused |
| [x] | I8 | Copy PSGC city dataset into Booker | S1 | ✅ DONE 2026-10-15 | G6a taken. md5-identical to vendor's; barangays tree excluded. Provenance note added to `booker/AGENTS.md` |
| [x] | I10 | PSGC region code → name map (17 entries) | S1 | ✅ DONE 2026-10-15 | `REGION_NAMES` in `lib/phCities.ts`, derived from `city_code` with an empty-code guard |
| [x] | I1 | "Near you" shelf at the front of Home | S2 | ✅ DONE 2026-10-15 | Above "Browse by division". No fetch — derived from the loaded catalogue. Two new visual baselines |
| [x] | I3 | Filter/sort split on Explore | S2 | ✅ DONE 2026-10-15 | `Where` filters, `Sort` reorders; "Near me" disabled with a clickable reason when no location |
| [x] | I11 | Active control invisible in dark (`.select` has no active state today) | S2 | ✅ DONE 2026-10-15 | `.selectOn` filled with `--db-toggle-on` (same both themes, 4.6:1). Also fixed the sort hint — see F7 |
| [x] | — | **Visual previews** — 11 screens × desktop/phone × light/dark | — | ✅ DONE 2026-10-14 · **✅ APPROVED by the user 2026-10-16** | [`previews/near-me/`](previews/near-me/README.md). 44 shots, 0 network requests. Produced I11 |
| [x] | I7 | Three doc corrections | S2 | ✅ DONE 2026-10-15 | `portals.md:71,242,1150` + `booker/AGENTS.md` Maps row rewritten. ⚠️ The `20260927000001` comment is NOT edited — it is an applied migration; it stays for I6 |
| [x] | I9 | City-level map panel on Explore | S3b | ✅ DONE (2026-10-16) | Built, collapsed by default, +108 bytes initial JS. Panel, derivation and tests are renderer-agnostic and survive S3c |
| [x] | B6 | MapLibre + OpenFreeMap cannot load a byte under the current CSP | S3c | ✅ DONE (2026-10-16) | Host in `connect-src` + `img-src`, `blob:` added, comments rewritten. `csp.spec.ts` now opens the map and asserts tiles were really fetched |
| [x] | I12 | Swap the drawing layer from Leaflet to MapLibre GL | S3c | ✅ DONE (2026-10-16) | Confined to `CityMapView` + its hook + `lib/mapTiles.ts` exactly as planned. `setStyle` was dropped entirely in favour of rebuilding — see F20 |
| [x] | I6 | Code-keyed `get_popular_offerings` | S3d | ✅ **DONE 2026-10-16 (local)** | G3 given; migration `20261016000001` applied to **local** by the user; one overload, `p_city_code`, **no `anon`**. Proven by `.plans/scripts/s3d-popular-city-code-proof.sql`: two `Pilar`s, 13 regions apart → **28 and 7 bookings separated, 35 platform-wide**, 5/5 assertions. ⚠️ **Hosted apply (staging/production) still outstanding** — run the overload query there first |
| [x] | F25 | Home's Popular caption printed the raw PSGC name ("City of Makati") | S3d | ✅ DONE 2026-10-16 | Found while splitting I6's overloaded `city` prop. `popularMeta` now normalises internally, so no call site can get it wrong; 2 new tests |
| [x] | F26 | The backbone migration landed on a branch missing three migrations | S3d | ✅ DONE 2026-10-16 (the user) | Fixed by `git flow feature finish booker_gaps` into `develop` (`2a28ab5`) — **better than this plan's own advice to relocate the file**, which would have left `develop` behind. Now 88 files / 87 applied, **one pending migration**, zero applied-with-no-file. File restored byte-identically (sha256 `4048634e4fe9f953…`) |
| [x] | — | **S3d pre-apply review** — audit the migration before it runs | S3d | ✅ DONE 2026-10-16 | 10 checks clean against the real DB and repo (deps, PostgREST cache reload, drop signature, no ghost overload, `pg_temp` syntax check, atomicity, NULL handling, no other caller). Found F26 + 2 doc gaps (fixed). ⚠️ Corrected this plan's own "tsc clean" claim: the Supabase client is untyped, so **nothing in CI validates `p_city_code`** |
| [x] | U3 | Centroid dataset — source, licence, PSGC mapping, coverage count | S3 step 1 | ✅ **CLEARED** 2026-10-16 | HDX/OCHA COD-AB admin-3, **CC BY 3.0 IGO verified at the HDX API**, joined on PSA `correspondence_code`. **1,634/1,634 = 100%.** Cross-checked against GeoNames at median 1.68 km. See §15 and F9, F10 |
| [x] | — | **S3 — city-centroid distance ordering** | S3 | ✅ DONE 2026-10-16 | `ph-city-centroids.json` + `lib/geoCentroids.ts` + the within-tier tiebreak in `lib/nearby.ts`. 17 new tests; tier 0 asserted byte-identical with and without centroids |
| [ ] | U4 | Count of active vendors with empty `city_code` (A2) | before S2 | ⬜ TODO | Needs the user — hosted DB access is theirs |
| — | U1, U2 | Google price · provider caching/storage rights | — | ⏸ PARKED | With P2 — and **moot while D11 holds** (no vendor address is sent to a provider). Kept, not aborted: reviving P2 revives them unchanged. ⚠️ U2 is a **legal** gate, not a price |
| — | D11 | **How far "near" goes, and where coordinates come from** | — | ✅ RESOLVED 2026-10-16 | **Barangay is the ceiling**; booker's position from the free device API; vendor's never geocoded; compare by `barangay_code`. **Reverses D4, restores G2.** ⚠️ Corrected the proposed hierarchy — it is `barangay → city → province → region`, region being *broader* than city. §12 |
| — | D4 | ~~No device location~~ | — | ✖ **REVERSED 2026-10-16 by D11** | Correct for the scope it governed (S1–S3d shipped under it). Record kept, not deleted |
| — | P1, P2, P3, P4 | Barangay centroids · street geocoding + pins · mobile parity · device location | — | ⏸ PARKED | Reasons and unblock conditions in §14 |
| [x] | — | **Dataset question for P1 — measured** | — | ✅ **ANSWERED 2026-10-17: YES** | **41,972/42,046 = 99.8%** join; 96.2% exact/correspondence HDX geometry; 0.2% flagged unverified. Data **CC BY-IGO**. ⚠️ **Reverses an earlier "largely NO, ~28%" entry** — that was an inference, not a measurement. Successor plan U1/D5, script `.plans/scripts/barangay-centroid-probe.py`. ✅ The follow-on decision is also taken: successor **D5 = (b) trust filter** (2026-10-17) — provenance per row, `fallback_unverified` excluded |
| — | P1a | **Same-barangay tier** — `barangay_code` equality, no dataset, no coordinates | — | ⏸ PARKED | User's proposal 2026-10-16 to avoid P2's cost, and it does — no provider, no U1/U2, no migration. **Unblocked by** a decision on asking for the booker's barangay in the picker (recommend optional) + vendor density. Binary, not a gradient; codes are alphabetical, not spatial. §14 |
| [ ] | F27 | Barangay granularity is **less** honest at low density | P1 | ⬜ RECORDED | A "barangay · 1" marker is a vendor pin by arithmetic — B5 collapses on sparse data, not on code. **P1 needs a count-of-1 fallback to the city marker, and waits for density.** Measured: 14 vendors, 14 cities, 14 barangays, every count 1 |
| — | X1–X9 | Rejected alternatives | — | ✖ ABORTED | Reasons in §13 |
| [x] | G1 | **Execution approval** | before S1 | ✅ **GIVEN 2026-10-15** | For the range S1–S3; S3b and S3c authorised separately on 2026-10-16 |
| [x] | D7–D9 | Basemap stack, worker hosting, style pair | — | ✅ RESOLVED 2026-10-16 | MapLibre GL + OpenFreeMap; same-origin worker; `positron`/`dark`. §12 |
| [x] | — | **S3b — city map panel** | S3b | ✅ DONE 2026-10-16 | Panel, markers, fallback, footer. +108 bytes initial JS |
| [x] | — | **S3c — MapLibre GL + OpenFreeMap** | S3c | ✅ DONE 2026-10-16 | Real tiles both themes, **0 bytes** initial JS, `csp.spec.ts` opens the map. F19–F21 |
| [x] | F21 | Markers collide at country zoom — a covered marker is unclickable | — | ✅ DONE 2026-10-16 | Fixed by `CityLegend`, a permanent city-chip list under the map (user chose it over clustering). Tiles-failed list folded into it. 106/106 visual pass, no baseline re-recorded; **no pixel baseline covers the legend** — `citymap` is collapsed-only |
| — | F5 | `set-state-in-effect` lint exception on `useAppShell.ts` | — | ✖ **CLOSED 2026-10-16** | **The user declined the fix (option a).** 18 problems is now the agreed baseline, not a carried regression; 19 would be. Documented at the line. If reopened, go to option (c) — the shared hook — never the one-site fix |
| [x] | F13 | 0-byte orphan `booker/hooks/useAppShell.ts` | — | ✅ DONE 2026-10-16 | Deleted via `gio trash` (recoverable) on the user's authority. 0 bytes, no importers anywhere — verified before and after: `tsc`, lint 18, 270 tests, build. **Git-tracked, so it is a deletion to commit** |
| [x] | F24 | `booker/hooks/useTheme.ts` — an orphan signpost, not code | — | ✅ DONE 2026-10-16 | Deleted via `gio trash` on the user's explicit approval. Contents were a comment + `export {}`; nothing imported it, and `booker/AGENTS.md:12` already records that theming is next-themes. Verified after: `tsc`, 272 tests, build. **Git-tracked, so it is a deletion to commit** |
| [ ] | — | **Live checks** — 360px phone, runtime theme flip with the map open, ordering across provinces | — | 🔄 **WITH THE USER** | Testable locally (14 vendors / 10 provinces seeded). **The user is exercising the feature themselves** as of 2026-10-16 and asked that these not be pre-run |
| [x] | F22 | The map toggle scrolled out of sight under the sticky filter bar | — | ✅ DONE 2026-10-16 | Toggle moved into `.head` as its own labelled row; panel stays outside it. Found by the user in local use, not by any test |
| [x] | F23 | The F22 fix left an orphan "Map" label on Explore's empty state | — | ✅ DONE 2026-10-16 | Caught by `explorechips-light/dark` at 61,403 / 60,377 pixels. `CityMapToggle` made a pure renderer; the whole row now guarded by `map.available` in `ExplorePage.tsx`. Re-run clean |

---

## 19. Where this landed

**Approved scope: city-first discovery over all 1,634 PH municipalities, a four-tier ranking ladder,
city-centroid distance ordering, and a city-level map — with no migration, no geocoding provider, no
API key and no device-location permission anywhere in it.**

The investigation's headline is that the hard part was already built: vendor locations are strict,
code-keyed PSGC down to the barangay (V1), Booker can read the codes by adding two words to one select
(V3), a city filter and three city-aware Home shelves already exist (V6), and ranking has no
pagination to fight because the whole catalogue is already in memory (V8). The work is to **promote
location to the front of the shopping page, remember it, disambiguate it, and rank with it honestly** —
with two expansion tiers (province, and the PSGC region derived free from a digit pair of the stored
city code, V10) so a thin catalogue still has something to show, which matters more now that D2 lets a
customer sit in a municipality with no vendors at all.

**The four decisions that shaped it:**
- **D1** put the centroid dataset in the first release, which moves **U3** onto the critical path.
  **D-U3** contains that risk: S1+S2 ship a complete feature with zero coordinates, so if no
  licence-clean PSGC-keyed dataset can be sourced, S3 and S3b park and the release still goes out.
- **D2** chose the full PSGC picker over the catalogue-only list, so a customer in an unserved
  municipality can now say where they are. That makes the tier ladder and the empty states
  load-bearing, and it is why the picker carries per-option vendor counts.
- **D4** dropped device location entirely — no permission prompt, no CSP change, no reverse-geocoding,
  no PII. The booking-history default (I2) covers returning customers for free.
- **D5** added a map against the recommendation. The recommendation stands as written (§6.4) and the
  disagreement is resolved by **changing what a marker means**: one marker per *city* with a vendor
  count, at a capped zoom, with no distances — a true statement about the data this plan actually has.
  **B5** is the structural guard that keeps it from drifting into per-vendor pins, which stay in
  Stage 4 where the coordinates to justify them would exist.

What the plan still refuses to do, in every stage, is manufacture precision: **no kilometre figure is
rendered anywhere**, and no marker claims to be a place of business. Centroid distance is an ordering
key, computed and never shown.

**Nothing is blocked on Vendor. Nothing in the approved scope needs a migration.** The gates that
arrive during execution are **G6a** (the PSGC asset copy, S1), **G6b** (the centroid asset, S3) and
**G5** (the map library, S3b) — each still a real decision when it arrives.

**Outstanding before S1:** **G1**, execution approval. One number would also be useful early —
**U4**, the count of active vendors with an empty `city_code` (A2), which only you can run.

---

## 20. Findings during execution

### F1 — `.select` has no active state, and the obvious fix is invisible in dark  ⬜ TODO (S2)
Recorded as **I11** during the preview build; unchanged by S1. Explore's new "Where" button now
carries a `selectOn` class, but the token choice is still open — see I11.

### F2 — the stored city name must stay RAW, or the Popular shelf empties silently  ✅ FIXED (2026-10-15)
**File:** `lib/phCities.ts` (`CityOption.name`) · `components/location/LocationPicker/useLocationPicker.ts`
Caught during S1, before it shipped. The picker first stored `displayCityName()`'s output
("Makati City") as `BookerLocation.cityName`. `get_popular_offerings` matches
`lower(v.city) = lower(p_city)` against the **raw** PSGC name
(`20260927000001_popular_offerings_rpc.sql:121`), which is `"City of Makati"` — so Home's Popular
shelf would have returned **nothing** for every `"City of X"` municipality, with no error anywhere.
**Fix:** `CityOption` carries both `label` (display) and `name` (raw); the location stores the raw
name and every render site calls `displayCityName()`. Covered by a named unit test.
⚠️ This is exactly what I5 means by "presentation only, never written back" — the rule had been
stated and was still nearly broken in the first implementation.

### F3 — the booking-history default is a memo, not an effect  ✅ DONE (2026-10-15)
**File:** `components/layout/AppShell/useAppShell.ts` (`historyLocation`)
First written as a `useEffect` + `setState`, which ESLint rejects (`set-state-in-effect`) and which
renders once without a location and again with one. Rewritten as a `useMemo` over `bookings` and
`catalogue.vendors` — the right answer in the same render, and the "derive, don't effect" rule this
app already documents at `useExplorePage`'s reveal counter.

### F4 — "Anywhere" and "hasn't said" are different states  ✅ DONE (2026-10-15)
**File:** `components/layout/AppShell/useAppShell.ts` · `lib/constants.ts` (`ANYWHERE_STORED`)
A single nullable field cannot carry both: with one, choosing "Anywhere" removed the stored key, the
booker read as undecided on the next load, and **the history default silently put a city back**.
Now the choice is stored as a raw string with an `anywhere` sentinel, and `choice.made` separates
the two.

### F5 — lint is +1 against baseline, deliberately  ✖ CLOSED — the fix was declined (2026-10-16)
**File:** `components/layout/AppShell/useAppShell.ts:158` (was cited as `:153`; the line moved)
Baseline measured by stashing the branch: **17 problems (13 errors, 4 warnings)**. After S1:
**18 (14 errors, 4 warnings)**. The one addition is `set-state-in-effect` on the `localStorage`
restore. Three shapes were tried — conditional set, primitive-only set, and parsing in a memo — and
the rule flags all of them. It is kept because the rule's suggested alternative does not cover
reading `localStorage` under SSR, and initialising from module scope would reintroduce the
hydration mismatch the surrounding comments exist to prevent. Documented at the line.

⚠️ **CORRECTION (2026-10-16) — this entry claimed "six existing call sites carry the identical
pattern", and that was overstated.** Re-measured: seven sites are flagged, but only **three** are
the identical shape (restore a persisted value on mount) — `useInstallPrompt:37`, this file's
wizard-draft restore at `:634`, and this one. The other four are different smells with different
fixes: `useLoginPage:42` resets a view when another piece of state changes, `useBookingWizard:64`
and `useStep3Schedule:103` raise a loading flag before an async fetch, and `useSettingsPage:32` is
the standard `next-themes` mounted guard. A single shared persisted-state hook would retire three
of the seven, not six.

⚠️ **AND THE COUNT UNDERSTATES THE FILE.** `useAppShell.ts:41` restores the sidebar's collapsed
state with the *same* effect-plus-`setState` shape and is **not reported**, because `setSideOpen`
is declared at `:66` — below the effect that calls it — so the rule never resolves it as a state
setter. There are **three** identical restores in this file and the linter sees two. The error
count is therefore not a measure of how many the file has, which is an argument against treating
18→17 as the goal.

**If this should instead be solved properly, the route is `useSyncExternalStore` with a module-level
emitter — roughly 30 lines — and that is a decision, not an oversight.**

**Three options were put to the user 2026-10-16 → the user chose (a): CLOSE IT** (same day).
- **(a) Close it. ✅ CHOSEN.** Accept the pattern as the house style, keep the baseline at **18**,
  and let this entry stand as the record of why. Costs nothing and hides nothing.
- **(b) Fix this one site.** ✖ Declined. `useSyncExternalStore` + a module-level listener set and a
  real `getServerSnapshot()` returning `""`. Would drop lint to 17 and add cross-tab sync for free
  — but leaves the app with two patterns for one job, and two sibling restores in the same file
  still on the old one. Buys a number, not a property.
- **(c) A shared `lib/persistedState.ts` and retire the shape.** ✖ Not taken up now. One hook used
  by all three restores in `useAppShell.ts` plus `useInstallPrompt:37`; one pattern everywhere,
  lint down by two reported errors and one unreported one. Touches the app shell and the install
  prompt, so it is **its own small plan with its own approval**, not a tail-end item on this one.

**What "closed" means here, precisely:**
- **No code changed.** 18 problems (14 errors, 4 warnings) is now the *agreed* booker lint baseline,
  not a regression carried by this plan. A future change that takes it to 19 is a real regression
  and should be treated as one.
- **The exception stays documented at the line** (`useAppShell.ts:158`), and the comment there now
  records that the `useSyncExternalStore` route was considered and declined on this date, so the
  next reader does not re-litigate it or mistake it for an oversight.
- ⚠️ **If it is ever reopened**, go straight to (c) — fixing one of three identical restores is the
  option that was explicitly rejected. And note that `useSyncExternalStore` requires a
  **referentially stable snapshot** or React re-renders forever; the existing "store the raw string,
  parse in a memo" design already satisfies that, and it is the one thing not to undo.

### F6 — the location chip collapsed the hero into a row  ✅ FIXED (2026-10-15)
**File:** `components/home/HomePage/HomePage.tsx` · `LocationChip.module.css`
Caught by the visual suite, not by review. `.heroActions` is a flex **row**, so the chip rendered
*beside* the search field instead of beneath it. ⚠️ The tempting fix — making that container a
column — is the documented 25px trap: `.search` carries `flex: 1`, which overrides its 52px height
in a column (redesign plan I43). The chip is a sibling of `.heroActions` instead, with
`align-self: flex-start` so the hero's `stretch` does not spread it across the card.

### F7 — the "set your location" hint was invisible as a control in dark  ✅ FIXED (2026-10-15)
**File:** `components/explore/ExplorePage/ExplorePage.module.css` (`.sortHint`)
Caught by reading the dark baseline, not by review — the same root cause as I11, one layer down.
The hint that explains why "Near me" is unavailable is a **button** that opens the picker, but it
was coloured `--db-menu-btn-color`, which is near-white in dark, so it read as plain bold text and
nobody would discover it was clickable. Now underlined at rest (theme-independent, no new token).

### F8 — the new shelf would have shipped with no visual coverage  ✅ FIXED (2026-10-15)
**File:** `app/ui-gallery/page.tsx` · `visual-tests/pilot.spec.ts`
`NearYouShelf` and the grouped Explore board had **no baseline**, which is exactly how the
redesign's F57 shipped a shelf nobody had looked at. Two modes added **with** the component:
`nearyou` and `nearyouempty`.
⚠️ The fixture is based in **Pila (region 04)**, not Metro Manila, and that is forced by the data:
from an NCR city the region tier is unreachable, because all 17 NCR cities share the `NCR`
pseudo-province and so fall in tier 1. Pila is the only way to get all four tiers into one
baseline. Confirmed rendering `In Pila → Also in Laguna → Elsewhere in CALABARZON → Elsewhere`.

### F9 — U3's two predicted routes were both wrong, in opposite directions  ✅ RESOLVED (2026-10-16)

This plan named GeoNames and "PSA/NAMRIA polygons + a GIS step" as the two candidate routes. The
investigation found the plan had each of them backwards:

- **GeoNames is far better than assumed.** §15 feared "a name→code mapping over 1,634 rows" with
  V7's 114 duplicate names making naive matching unsafe. That work does not exist: GeoNames'
  `PH.txt` carries **`admin3_code`, which IS the 9-digit PSGC code** (`Zumarraga|086023000`). It is
  a second, fully PSGC-keyed source — which is why it could be used as the independent cross-check
  instead.
- **But it cannot be the primary**, for a reason no amount of coverage arithmetic would surface:
  GeoNames codes **Manila at sub-municipality level only** — its 14 districts, `133901000`–
  `133914000` — and **Cotabato City as ADM2 with no admin3 at all**. So it misses exactly
  `133900000` and `129804000`: the City of Manila, the single most important row in the dataset for
  this product, and one of the three pseudo-province specials. 1,632/1,634 sounds like a rounding
  error and is not.
- **The GIS route was unnecessary.** HDX **is** the NAMRIA/PSA boundary data, already reduced to
  centroids, and no GIS tooling is installed here anyway (`shapely`, `fiona`, `geopandas`, GDAL —
  all absent, checked).

⚠️ **The lesson for the next dataset question:** the plan's coverage criterion ("report an explicit
count") would have passed GeoNames at 99.88%. What disqualified it was looking at *which* rows were
missing, not how many.

### F10 — one centroid was provably wrong, and two independent checks found the same one  ✅ FIXED (2026-10-16)

`South Upi` (`153817000`, Maguindanao del Sur) came out of the HDX-derived table carrying **the
byte-identical coordinate to `Pagagawan`** — the only coordinate shared by two municipalities in all
1,634 rows — placing it ~74 km from Upi, the municipality it was carved out of. It was flagged twice,
independently: by the duplicate-coordinate check, and as the single worst row in the GeoNames
cross-check. **Overridden from GeoNames ADM3** (CC BY 4.0, attributed in the asset), and both checks
are now permanent: the generator asserts them, and `geoCentroids.test.ts` re-asserts uniqueness so a
hand-edit cannot reintroduce it.

**Five further rows remain divergent and are deliberately NOT overridden:** `Paglat` (61.8 km),
`Datu Hoffer Ampatuan` (43.3), `Matanog` (40.9), `Datu Unsay` (25.3), `Rajah Buayan` (20.9) — all in
the heavily-subdivided BARMM/Maguindanao cluster. They disagree with an independent *town-centre*
point, which is not the same as being wrong: the province-cluster test puts all five inside their own
province, and centroid-vs-downtown divergence is expected. **Substituting on a hunch is how a dataset
becomes unauditable**, so they are recorded here instead. Consequence if any is wrong: a few
positions of ordering inside tier 2 or 3, for municipalities with effectively no vendors, with no
number on screen.

### F11 — `Infinity - Infinity` would have silently disabled the stability guarantee  ✅ FIXED (2026-10-16)

The obvious comparator for the new tiebreak is `a.distance - b.distance`. Two vendors with no
centroid both carry `Infinity`, and `Infinity - Infinity` is **`NaN`** — a comparator returning `NaN`
has no defined meaning, so the stable original-index tiebreak underneath it would have stopped
applying to **exactly the rows that most need it**: the ones with no coordinates, where tier order is
all the booker has. Replaced with an explicit three-way `compareDistance`, with a named test
(`two cities with no centroid keep the caller's order between them`).

⚠️ This is the same class as **B2**: a value that is *defined* in JavaScript, arithmetically
reasonable, and produces a quietly wrong ordering with nothing on screen to show it.

### F12 — Davao City is the proof that R1 is a real risk, not a stylistic preference  ✅ RECORDED (2026-10-16)

The first run of the centroid test failed, and the data was right: **Davao City's centroid sits
~31 km from its own downtown**. It covers 2,444 km² — the largest municipality in the country — with
its city proper in the south-east coastal corner and its territory running far inland. The test was
loosened for that one city *and the reason written into it*, because this is the concrete evidence
for **R1**: a booker shown "31 km" for a Davao vendor would be told something false about where that
business is, and the figure would look entirely reasonable. The number orders results; the tier label
is what describes them. Pinned in `geoCentroids.test.ts` with a per-city `slack` so the next person
meets the reasoning rather than a magic tolerance.

### F13 — `booker/hooks/useAppShell.ts` is a 0-byte orphan  ✅ DELETED (2026-10-16)

Found while deciding where `useCityCentroids` belonged. `booker/hooks/` held an **empty**
`useAppShell.ts` (0 bytes, dated 2026-06-18); the real hook is
`components/layout/AppShell/useAppShell.ts`. Nothing imported it, so it was harmless — but it was a
trap for anyone grepping for the shell's hook. It was left in place at first (surgical-changes rule:
unrelated dead code is reported, not removed in passing).

**Deleted 2026-10-16** on the user's authority ("approve it if it does not change any behaviour"),
after confirming it cannot:
- `wc -c` = **0 bytes** — an empty module exports nothing, so nothing could have been consuming it.
- `grep` for `hooks/useAppShell` and `@/hooks/useAppShell` across every `.ts`/`.tsx` — **no
  importers anywhere**. The only `useAppShell` import in the app is `AppShell.tsx:2`'s relative
  `./useAppShell`, which resolves to the real hook and never to this one.
- Removed with `gio trash`, not `rm`, so it is recoverable. ⚠️ `trash` is **not** on this machine's
  PATH; `gio trash` is the working equivalent.

**Verified after deletion:** `tsc` clean · lint **18**, unchanged · 270/270 unit tests · `next build`
compiled. ⚠️ The file was **git-tracked**, so this shows up as a deletion for the user to commit.

### F24 — `booker/hooks/useTheme.ts` was an orphan signpost, not code  ✅ DELETED (2026-10-16)

Noticed while verifying F13, in the same directory. `hooks/useTheme.ts` (111 bytes) had **no
importers** — the app uses `next-themes`' own `useTheme` directly.

⚠️ **Not deleted at first, deliberately**, and the distinction from F13 is worth keeping: F13 was
**0 bytes**, an obvious accident. This file had *content*, so it was a judgment call rather than
obvious dead weight, and the user had authorised F13 — not a sweep of `hooks/`.

Read before it went, which is the point of that rule. The whole file:
```ts
// Theme is driven by next-themes. Components that need `dark` import useTheme from "next-themes".
export {}
```
A signpost telling future readers **not** to write a `useTheme` wrapper — real information, in the
wrong place. `export {}` made it an empty module, and `booker/AGENTS.md:12` already records
*"Theming | next-themes, `class` strategy, `defaultTheme=\"dark\"`"*, so the note was duplicated
where it belongs. Nothing was lost by removing it, and an empty module in `hooks/` is the same grep
trap F13 was.

**Deleted 2026-10-16** on the user's explicit approval, with `gio trash` (recoverable; `trash` is
not on this machine's PATH). **Verified after:** `tsc` clean, 272/272 unit tests, `next build`
compiles. ⚠️ Git-tracked, so it shows as a deletion for the user to commit.

### F14 — the chosen tile provider stopped being free, and it fails without failing  ✅ RESOLVED (2026-10-16, D7)

**This plan picked CARTO specifically because it needed no key and no account** (§6.4), and that is
no longer true. Measured 2026-10-16, every CARTO basemap endpoint — `light_all`, `dark_all`,
`light_nolabels`, `rastertiles/voyager`, and the legacy
`cartodb-basemaps-a.global.ssl.fastly.net` host — returns:

```
HTTP 200 · image/png · 2,049 bytes · a 256×256 watermark reading "API KEY REQUIRED"
```

⚠️ **The failure mode is worse than the one the plan prepared for.** V12 warned that a blocked tile
paints as a blank grey square with no error. This is a *valid image on a 200 response*: Leaflet
fires `tileload`, `tileerror` never fires, the console stays clean, and the tiles-failed detection
built in this very stage cannot see it. The first run of the map rendered "API KEY REQUIRED"
diagonally across the Philippines and **reported complete success** — it was caught by looking at
the screenshot, not by any check.

**What was done, and deliberately not done.** The basemap became configuration with **no default**
(`lib/mapTiles.ts`: `NEXT_PUBLIC_MAP_TILE_URL`, `_DARK`, `_ATTRIBUTION`), and an unconfigured map
draws **zero tiles** and shows the city-list fallback — verified: 0 tile requests, Leaflet never
mounts. Attribution is required alongside the URL, so the basemap cannot be switched on while
drawing uncredited tiles. **No provider was chosen and `img-src` was not touched**: picking a tile
service is a product and cost decision, and a non-CARTO host is a CSP change, which is its own
security gate. Recorded as gate **G7**.

**The options, with what each costs:**

| Option | Cost |
|---|---|
| **A CARTO API key** | An account. `img-src` unchanged, since the host is the same. Smallest change — set the three variables and the map works |
| **OpenStreetMap standard tiles** | Keyless and working today (verified: a real 23,034-byte tile). ⚠️ Needs an `img-src` change, and OSM's tile policy forbids heavy or commercial use — fine for a pilot, not for traffic |
| **A commercial provider** (MapTiler, Stadia, Thunderforest) | A key *and* an `img-src` change |
| **Ship the fallback** | Nothing. The panel already lists the cities with counts and is fully functional as a filter; it just has no geography |

⚠️ **A CSP block was then confirmed end to end**, which is the one good thing to come out of this:
pointing the map at `tile.openstreetmap.org` without changing `img-src` blocked every tile with
`violates the following Content Security Policy directive: "img-src 'self' data:
https://*.basemaps.cartocdn.com …"`, **and the panel's tiles-failed detection fired correctly** and
swapped to the city list. V12's scenario is real, and it is now handled.

### F15 — the map could not be mounted where §4.4 put it  ✅ RESOLVED (2026-10-16)

§4.4 places the `Map` toggle "next to the `Sort` control", which is inside Explore's `.head`.
`.head` is `position: sticky` (its own stylesheet note explains the `-20px` mechanism at length),
so a panel mounted there would have **pinned a 320px map to the top of the scrollport** with the
results sliding underneath it. The panel is mounted immediately **after** `.head` instead: the
toggle still sits directly beneath `Sort` and reads as part of the same control cluster, with none
of the sticky behaviour. A layout fact, not a design change — but it would have been a confusing
bug to meet at runtime.

### F16 — "the map and the list always agree" needed a decision, not just an implementation  ✅ RESOLVED (2026-10-16)

§4.4 says markers come from "the current **filtered** result set" and that map and list must agree.
Two readings had to be settled, and both affect what a count means:

1. **Filtered set or revealed slice?** The board reveals 24 cards at a time. Markers are built from
   the **whole filtered set** — a map that gained cities as the booker tapped "Show more" would say
   the catalogue was spreading out as they read it. The map agrees with the *filter*; the reveal is
   a rendering budget.
2. **Services only, or vendor hits too?** `searchCatalogue` returns both, and a vendor can match by
   name while none of its services do — it renders as a card under "Vendors". Markers are built
   from **both**, so every vendor visible on the page is on the map. The derivation counts distinct
   vendor ids, so the overlap costs nothing.

⚠️ And the count is **distinct vendors, not result rows**. The input is one row per matching
*service*, so counting rows would label a city `12` where three vendors are open. Pinned by a test.

**Resolved 2026-10-16 by D7** — MapLibre GL JS + OpenFreeMap, chosen by the user after their own
research. The options table above stands as the record of what was weighed. ⚠️ The mitigation built
in response to F14 **stays**: the basemap remains configuration rather than a hardcoded constant, and
the fallback that F14 forced into existence is the same one that will cover an unreachable host.
What changes is that a **default is safe again** — OpenFreeMap has no keyed tier, so it has no
watermark to fall back to, which was the entire reason F14 removed the default.

### F17 — a CSP comment points at a file deleted a month ago  ⬜ REPORTED, FIX WITH G9 (2026-10-16)

`booker/next.config.ts:175-176` justifies `style-src 'unsafe-inline'` with: *"the map's own marker is
a `L.divIcon` built from an inline `style="..."` attribute (`useMapWidget.ts:32`)"*. That file was
**deleted on 2026-09-22** (commit `f331560`), so the comment has pointed at nothing for a month.
It is now wrong twice over: S3b's markers are built from `document.createElement` with CSS-module
classes and **no inline style attribute at all**, and S3c keeps that approach on MapLibre.
⚠️ **Do not read this as "`unsafe-inline` can be dropped."** It is still load-bearing for Next's and
next-themes' injected styles — the *map* has simply stopped being a reason. Worth correcting while
G9 is open and that file is being edited anyway, so the next person does not go looking for
`useMapWidget.ts` to find out whether the directive is still needed.

### F18 — OpenFreeMap needs no account, and carries its own attribution  ✅ VERIFIED (2026-10-16)

The research D7 asked for, recorded because "no account" is the kind of claim that quietly stops
being true — as CARTO just demonstrated. **Verified by fetching the real endpoints**, not from
documentation alone:

| Question | Answer, as measured 2026-10-16 |
|---|---|
| Account / registration / API key? | **None.** OpenFreeMap's own page: *"There's no registration, no user database, no API keys, and no cookies."* Every fetch below was made with no credentials of any kind |
| Commercial use? | **Permitted** — answered "Yes" on their FAQ. Relevant because booker is a commercial marketplace |
| Limits? | *"no limits on the number of map views or requests"* for the public instance |
| Styles available | `liberty`, `bright`, `positron`, `dark`, `fiord` — **all five returned 200** |
| Hosts contacted | **Exactly one: `tiles.openfreemap.org`** — style JSON, `fonts/{fontstack}/{range}.pbf`, `sprites/ofm_f384/ofm`, a raster relief layer at `natural_earth/ne2sr/{z}/{x}/{y}.png`, and vector tiles at `planet/…/{z}/{x}/{y}.pbf`. One origin for both `connect-src` and `img-src` (B6) |
| Vector tile zoom range | `minzoom 0`, **`maxzoom 14`** — comfortably above our `MAP_MAX_ZOOM = 11` cap |
| Attribution | **Inside the TileJSON**, so MapLibre's own control renders it automatically: *"OpenFreeMap © OpenMapTiles Data from OpenStreetMap"* with links. ⚠️ This is why `lib/mapTiles.ts` loses its attribution variable — but **the centroid credit in the panel footer stays**, because CC BY 3.0 IGO attaches to the *data*, not the basemap |
| Licence / self-hosting | MIT, full production setup open-source, planet downloads published. So the public instance can be replaced with our own later **without touching anything but a URL** |

⚠️ **The one risk the user is accepting, stated plainly:** the public instance is donation-funded and
offers **no SLA**. If it goes away, the map goes with it — which is precisely why the style URL stays
an env-overridable value (I12 step 1) and why the city-list fallback is not removed. The licence
makes self-hosting a real escape hatch rather than a theoretical one.

### F19 — `MAP_MIN_ZOOM` silently clamped `fitBounds`, and two markers sat off the map  ✅ FIXED (2026-10-16)

**File:** `booker/lib/constants.ts` (`MAP_MIN_ZOOM`, was `5`, now `3`)

The first map that actually rendered tiles showed the Philippines correctly and **put two of its
four markers outside the viewport**, one clipped against the top edge. Nothing errored.

⚠️ **The cause was not the map library, and the first two fixes attempted were both wrong.** The
symptom looked exactly like the well-known MapLibre container-measurement problem, so the first
attempt was `map.resize()` before `fitBounds`, and the second was a `ResizeObserver`. Neither
changed the output by a pixel. Reading the map's actual state is what settled it:

```
zoom: 5          ← MAP_MIN_ZOOM
container: 834 × 318
bounds:  N 14.47  S 7.62     ← 6.85° of latitude
markers: N 14.59  S 7.43     ← 7.16° of latitude, before padding
```

**A `minZoom` does not only stop a booker zooming out — it clamps `fitBounds`.** The fit wanted
about **4.4** and was pinned at 5, and `fitBounds` reports nothing when its result is clamped. At
zoom 3 the same data frames at **4.41** with every marker inside and padding to spare.

⚠️ **This bug was already present in S3b's Leaflet build and could not be seen there**, because
CARTO was serving watermarks by then and no basemap ever drew. A fit that is wrong looks fine when
there is nothing under it to measure against — which is the real lesson: the map was "verified"
in S3b by counting markers in the DOM, and DOM presence says nothing about whether a marker is on
screen. The probe now asserts each marker's rectangle lies inside the map's.

⚠️ **The `ResizeObserver` was kept** even though it did not fix this. It is correct for its own
reason — MapLibre does not watch its container, so the 560px `--map-h` breakpoint and a rotated
phone would otherwise leave a stale frame — and it is now the thing that re-frames on those. It is
*not* load-bearing for F19 and should not be cited as the fix for it.

### F20 — `setStyle` was designed out rather than debugged  ✅ RESOLVED (2026-10-16)

The plan flagged MapLibre's `setStyle()` as S3c's likeliest silent bug (I12, step 3): it tears the
style down and rebuilds it, and the first implementation did lose every marker on a theme change.

**The fix was to delete the branch.** A style change now removes the map and builds a new one,
which means there is exactly **one** code path that produces a working map — the one that runs on
first open, already proven every time anyone opens the panel. The cost is a rebuild on an action a
booker takes approximately never (changing theme with the map already open); the gain is that a
whole category of "what survives a style swap" reasoning stops existing.

⚠️ Worth stating plainly because the tempting move was the other one: keep `setStyle` and re-add
the markers afterwards. That would have worked, and it would have left a second, rarely-exercised
path to a rendered map that nothing routinely tests.

### F21 — markers collide at country zoom  ✅ FIXED by a city legend (2026-10-16)

**Files:** `components/explore/CityMapPanel/CityLegend.tsx` (new) · `CityMapPanel.tsx` ·
`CityMapPanel.module.css` · `lib/cityMarkers.ts` (one comment)

With results in both Luzon and Mindanao the map frames the whole country, and cities within ~50 km
of each other overlap: in the fixture, `Antipolo City · 1` sits under `Pila · 1 · your city` and is
partly hidden.

⚠️ **This was first reported as "legibility, not correctness", and that under-stated it.** A
*fully* covered marker is not merely hard to read — it is **unclickable**, so that city becomes
unreachable from the map. It stayed reachable from the results list and the `Where` picker, so
nothing was ever lost outright, but it was an interaction gap and not a cosmetic one.

**Three options were put to the user on 2026-10-16** — do nothing; a city legend under the map; or
real marker clustering. Clustering was costed as the expensive one: the markers are DOM overlays
styled in CSS, and clustering properly means moving to a GeoJSON source plus a symbol layer, which
discards the HTML pill and re-does the labels in MapLibre's style spec, possibly with a new
dependency (`supercluster`). **The user chose the legend** — it fixes the part that actually costs a
booker something, for a fraction of the work, and it cannot violate B5 because it is not on the map.

**What was built.** `CityLegend` is a pure display component rendering one chip per city —
`label · count`, the origin city flagged by shape *and* the word "your city" — wired to the panel's
own `pickCity`, so a chip does exactly what a marker does because it **is** the same function. It
is mounted under `.stage`, outside every stage state, so no zoom level can take a city away.

Two deliberate consequences, both recorded rather than hidden:

1. **The tiles-failed state no longer carries its own copy of the list.** It was a second rendering
   of the same markup; the stage now shows a plain notice saying the background map didn't load and
   the legend below answers the question. One list in one place cannot drift from the other.
2. **The one-height rule narrowed from the panel to the stage.** Every `.stage` state is still the
   same box, but the legend adds height below it, so the panel settles once more when the centroid
   fetch lands. It cannot settle twice — markers exist only once the table is in hand — and one
   settle on first open is a smaller cost than an unreachable city. Written into the CSS at
   `.legend`, where the next person to touch the heights will read it.

⚠️ The clustering caveat still stands **if clustering is ever taken up**: a cluster of cities is
still cities, and its label has to say so (**B5**). A bubble showing a bare `7` is the per-vendor-pin
misreading in new clothes, arriving through something that looks like pure polish.

**Verified:** `tsc` clean · 270/270 unit tests · lint at the unchanged 18-problem baseline, none in
these files · `next build` compiles · **106/106 visual tests pass, exit 0, no baseline re-recorded**
— which includes `csp.spec.ts`'s "the CSP does not block the city map's tiles, style or worker",
the one test that **opens the map in a real browser against real OpenFreeMap tiles**, so the legend's
live render path is machine-verified even though it has no pixel baseline (see §9).
⚠️ **No visual baseline covers the legend**, because the `citymap` mode is the collapsed toggle only
— deliberately, since an open map's pixels depend on a third party. Unchanged by this work.

### F22 — the map toggle scrolled out of sight, so the map could not be found  ✅ FIXED (2026-10-16)

**Files:** `components/explore/CityMapPanel/CityMapToggle.tsx` (new) · `CityMapPanel.tsx` ·
`useCityMapPanel.ts` · `components/explore/ExplorePage/{ExplorePage.tsx, useExplorePage.ts}` ·
`app/ui-gallery/page.tsx`

**Found by the user running the app, not by any test in this plan.** Their words: *"I can't locate
where I can see the map?"* Everything worked — the toggle rendered, the panel opened, the tiles
drew — and the feature was still effectively undiscoverable.

⚠️ **The cause is F15's fix, seen from the other side.** F15 moved the panel OUT of Explore's
`.head` because `.head` is `position: sticky` and a 320px map inside it would pin to the top of the
scrollport with results sliding underneath. That reasoning was right and still is. What it missed
is that the *toggle* went out with the panel — so the moment a booker scrolls into the results, the
sticky filter bar pins and the toggle scrolls up behind it. It is reachable only from the very top
of the page, and nothing on screen suggests it exists.

**Fix:** split the one component in two along the line the layout actually needs.
`CityMapToggle` renders inside `.head` as a third labelled row under `Where` and `Sort` — which is
where §4.4 asked for it in the first place — and `CityMapPanel` stays outside the sticky bar and
now renders **nothing at all** while closed.

⚠️ **One state, two renderers, and that is the part to not get wrong.** Both read a single
`CityMapState` from one `useCityMapPanel` call owned by `useExplorePage`. Each component calling
the hook itself would give each its own `open`, and the toggle would say "Hide map" above a closed
panel. The `aria-controls` target is a shared exported constant for the same reason.

**Component separation:** `CityMapToggle` and `CityMapPanel` are now both **pure display
components** — no state, no effects, handlers taken from the state object — and the stylesheet is
shared. The hook moved up to the controller, which is the repo's existing hook-as-controller shape.

**Verification:** `tsc` clean, `npm test` **270 passed**, lint **18 — identical to baseline**,
`next build` compiles, `npm run test:visual` **106 passed, exit 0, no baseline re-recorded**.

⚠️ **THE VISUAL SUITE CAUGHT A REGRESSION IN THIS VERY FIX — see F23.** It was run late, after the
user freed the dev server, and the prediction made while it could not be run ("expected
pixel-identical") was wrong in a way that mattered.

### F23 — the fix for F22 shipped an orphan label, and only the baseline noticed  ✅ FIXED (2026-10-16)

**File:** `components/explore/ExplorePage/ExplorePage.tsx`

F22's first implementation put the toggle's **row and label** in `ExplorePage` and the
"should this exist at all" guard **inside `CityMapToggle`**. With an empty result set the toggle
correctly rendered nothing — and the row around it rendered anyway, leaving a **"Map" label with
no control beside it** on Explore's empty state.

⚠️ **Two things are worth recording about how this was found.** First, it was caught by
`explorechips`, a baseline that exists for the division chips and happens to render the whole of
`ExplorePage` with `vendors: []` — a pane that had nothing to do with this change. Second, it was
reported here as *"expected to be pixel-identical … but that is unverified"* before the suite could
run. The prediction was wrong, the 61,403 differing pixels were real, and the honest label on that
claim is the only reason it was re-checked rather than taken as done.

**Fix:** the guard moved out to the row. `CityMapToggle` is now a genuinely pure renderer that
does not decide whether it should exist; `ExplorePage` wraps the whole row in `map.available`,
because the row and the control have to appear and disappear together and only the page knows
about the row.

⚠️ **The general shape, for next time:** a conditional component inside an unconditional wrapper
is an empty-state bug waiting to happen. Guard the outermost thing that would otherwise be left
behind.

### F25 — Home's Popular caption printed the raw PSGC name  ✅ FIXED (2026-10-16)

**Files:** `lib/popular.ts` (`popularMeta`) · `lib/popular.test.ts` ·
`components/home/PopularShelf/{PopularShelf.tsx,usePopularShelf.ts}` ·
`components/home/HomePage/HomePage.tsx` · `lib/phCities.ts` (comment)

Found while splitting I6's `city` prop, not by any test. For one day — 2026-10-15 to 2026-10-16 —
Home's Popular shelf captioned itself **"Most booked in City of Makati this month"** instead of
"Makati City".

**Cause: one prop doing two jobs, and the two jobs wanted different values.** **F2** made
`BookerLocation.cityName` the *raw* PSGC name so the name-keyed `get_popular_offerings` could match
`lower(v.city)`. `HomePage` passed that same value to `PopularShelf`, whose prop was documented
*"Passed straight to the RPC"* — which it was, and it was also the caption's text.
`displayCityName` has **15 call sites**; this was the one render path that had none.

⚠️ **F2's fix created it.** Making the stored name raw was correct and is still correct — the
defect was letting a value shaped for a *query* reach a *render site* unchanged. The two shelves
immediately below it on the same screen (`Slots still open in …`, `Vendors in …`) both use
`cityLabel` and were always right, which is what made the odd one out visible once the prop was
being touched for another reason.

**Fix, in two layers:**
1. **`popularMeta` normalises the name itself.** The caption has exactly one chokepoint, so
   putting it there makes the bug unrepeatable rather than fixed-at-one-call-site. It is
   idempotent — a caller passing an already-display label is unaffected.
2. **The prop split in two:** `cityCode` (what the RPC filters on) and `cityLabel` (what the
   caption prints). Interface Segregation applied literally: two consumers, two values, neither
   forced through the other's shape.

Two new tests pin it: the raw form renders as the display form, and normalising twice is a no-op.

⚠️ **A consequence worth recording, because it would otherwise be "simplified" away later.**
After S3d **no query compares `BookerLocation.cityName` any more**, so F2's original justification
is gone. The field stays raw anyway — it is what `vendors.city` actually holds, and I5's
never-write-back-the-normalisation rule is about storage, not about one consumer. The comment at
`lib/phCities.ts` now says this explicitly, so the next reader does not find an obsolete reason and
conclude the rule is obsolete too.

### F26 — the backbone migration landed on a branch missing three migrations  ✅ RESOLVED (2026-10-16, by the user)

Found during S3d's pre-apply review, by comparing the local database's migration history against
the files on disk. Three versions were applied locally with **no file in
`backbone/supabase/migrations/`**:

```
20261002000001  the private booking-documents bucket
20261003000001  the 2026-10-10 consolidation of four cancellation/refund migrations
20261004000002  get_unbookable_offerings()
```

⚠️ **First read was wrong, and the correction matters.** This looked like repo drift — files lost
or applied by hand. It is not. Those three files exist, on **`feature/booker_gaps`**, and they are
exactly the three that branch adds over `develop`. Nothing is lost and nothing is drifting.

**Measured:**

| | |
|---|---|
| Commits in `feature/booker_gaps` not in `develop` | **4** |
| Commits in `develop` not in `feature/booker_gaps` | **0** — a clean fast-forward, no divergence |
| Local DB vs `booker_gaps` migrations | **87 files / 87 applied**, zero difference in either direction |
| Both branches vs `origin` | in sync (ahead 0, behind 0) |

So the local database was built from `booker_gaps`, `develop` is simply four commits behind it, and
`architecture/schema.md` already documents all three (the consolidation as "committed and deployed
to staging 2026-10-12") — i.e. the docs already describe the world as `booker_gaps` sees it.

**The consequence:** `backbone` was checked out on `develop` when `20261016000001` was written, so
the migration is sitting on a branch whose migration history does **not** match any real database.
Applying from there would be applying on top of a history missing three migrations that local and
staging both have. The file is untracked, so a checkout carries it over; it needs **committing on
`feature/booker_gaps`**.

**The user's plan — finish on `feature/booker_gaps`, then merge to `develop` — was confirmed as the
right call** (2026-10-16), for reasons that are properties of the repo rather than preference:
1. the merge is a **fast-forward today** (`develop` has nothing `booker_gaps` lacks), which is the
   cheapest it will ever be, and an argument against letting `develop` drift in the meantime;
2. it is the **only branch whose migration history matches a live database**;
3. `schema.md` already agrees with it, so the merge makes branch and docs consistent rather than
   requiring a third reconciliation.

⚠️ **Also noticed, and not a problem — but worth knowing when "finishing the feature":** the repos
sit on four different branches, so this feature is **three commits on three branches**:

```
.            master             the plan + architecture docs
booker       feature/near_me    all the near-me app code
backbone     develop            the migration (after the 2026-10-16 merge)
vendor       develop
command      develop
```

---

**✅ RESOLVED 2026-10-16 — and the fix was better than this finding's own recommendation.**

This entry advised moving the migration onto `feature/booker_gaps`. The user instead used git flow
to **`feature finish` booker_gaps into `develop`** (merge commit `2a28ab5`), which is the better
move and the correction is worth keeping:

1. **It fixes the defect instead of avoiding it.** `develop` being four commits behind was the
   actual problem; relocating one file would have left it behind and put the migration on a branch
   it does not belong to.
2. **The migration is not part of that feature.** `20261016000001` belongs to the near-me work
   (`booker/feature/near_me`), not to booker_gaps' cancellation/refund/bucket work. ⚠️ And
   `git flow feature finish` **deletes the feature branch**, so riding along would have buried it
   in that merge.
3. **The merge was still a fast-forward-clean one** — `develop` had 0 commits `booker_gaps` lacked
   — so the cheap window this finding identified was used rather than spent working around.

After the merge: 88 files, 87 applied, **one pending migration (this one)**, zero applied-with-no-file.
⚠️ The migration file was deleted for the branch move and **restored byte-identically** from a
pre-move copy (sha256 `4048634e4fe9f953…`), not rewritten.

**Collateral, judged and reported rather than restored:** the move also required deleting the
tracked `supabase/snippets/Untitled query 177.sql` (commit `ac54874`). It is a 70-byte scratch
query — `select * from bookings where id="…"` — which is **not valid Postgres**: the double quotes
make the UUID an identifier, so it errors with `column "ec3e226f-…" does not exist`. Recoverable
with `git checkout 'ac54874^' -- '…'` if ever wanted; **recommended to stay deleted.** ⚠️ Note that
`supabase/snippets/` is tracked in this repo and is **root-owned** on disk (the CLI's container
writes it), so Studio scratch queries land in version control by default.

⚠️ **Stale config found while confirming git flow:** `gitflow.path.hooks` points at
`/home/joshua/RS/api/.git/hooks`, **which does not exist**. Git flow skips missing hooks silently,
so nothing fails — but no git-flow hook runs in this repo, and the path is left over from a layout
that is gone. Reported, not changed.

### F27 — barangay granularity is LESS honest at low density, and P1 needs a guard for it  ⬜ RECORDED (2026-10-16)

**Applies to:** P1 (§14) · any barangay-level marker or breakdown · **B5**

Found while answering what P1 would actually give. It inverts the intuition that finer geography is
safer, and it is a precondition on P1 rather than an objection to it.

**Measured on the local seed (2026-10-16):** the 14 active vendors sit in **14 different cities and
14 different barangays — every count is 1.**

```
City of Angeles   · Agapito del Rosario · 1      City of Davao     · Acacia   · 1
City of Antipolo  · Bagong Nayon        · 1      City of Dumaguete · Bagacay  · 1
City of Cebu      · Adlaon              · 1      …and so on, all 1
```

⚠️ **At one vendor per barangay, a "barangay · 1" marker IS a vendor pin** — not by type, but by
arithmetic. `CityMarker` still carries no vendor identity (**B5** holds at the type level), yet
anyone reading a single-vendor barangay marker is reading that vendor's approximate location. **The
guarantee collapses because the data is sparse, not because the code changed.**

**Why this is worse at barangay scale than city scale.** A city centroid is 5–15 km from anything
real (~31 km for Davao City), so "one vendor in this city" still points at nothing in particular. A
barangay centroid is **±0.5–2 km** — with one vendor in it, that is close to pointing at the shop,
which is precisely what **P2** is gated behind a migration *and* a licensing review to do properly.
So barangay markers would deliver P2's sensitivity while skipping P2's gates.

**Consequences for P1 — both are preconditions, not suggestions:**

1. ⚠️ **A barangay-level marker must not render when its count is 1.** It falls back to the city
   marker. This belongs in the derivation (`lib/cityMarkers.ts`'s sibling), where **B5** already
   lives as a type constraint — a count threshold is the same kind of structural guard, expressed in
   data rather than in review.
2. ⚠️ **Nothing barangay-level should ship until cities hold multiple vendors.** P1 orders *within* a
   city; at one vendor per city there is nothing to order, so **its observable effect today is
   zero.** Its value and its risk arrive together, with density.

**The same applies to the free, dataset-free version.** Vendors can be *counted* per barangay today
— `vendors.barangay_code` is populated 14/14 and needs only a query and a type field, no coordinates
— so a text breakdown under `CityLegend` is available now. But a breakdown reading "fourteen places,
one each" is a vendor directory with geography as decoration, and it carries the same B5 hazard
without even needing a map.

**Not a reason to abandon P1** — a reason to sequence it behind density and to write the count
threshold into it before any code exists.
