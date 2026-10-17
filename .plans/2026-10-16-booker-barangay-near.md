# Booker — barangay-level "near", and the booker's own position

**Date:** 2026-10-16
**App / scope:** `booker/` web only. **No `backbone/` migration is proposed or needed.** No `vendor/`
or `command/` change. One security-header change (`booker/next.config.ts`) behind a gate.
**Status:** IN PROGRESS — ✅ **S1, S2, S3 and S4 are all DONE (2026-10-17).** The barangay rung
ships: `barangay_code` reaches booker, the picker narrows optionally, `BookerLocation` carries the
pair, and `rankTier`/`tierLabel`/B2 all work one rung finer. All five decisions are resolved
(D1–D5). **286/286 unit tests, tsc clean, lint at the agreed 18, production build clean.**
⚠️ **The rung is DORMANT on live data by design** (D4's gate; 14 vendors in 14 barangays), and
✅ **All five execution findings are closed** (F1 chip, F2 baselines, F3/F4 recorded, F5 fixed).
**Visual suite: 112 passed**, including 6 new baselines for the picker, its barangay step and the
chip — the picker had never been shot before. **Remaining: S5** (needs **G3**) and **S6** (needs
**G2**), plus the live checks.

**The two things that unblocked it, both on 2026-10-17:**

1. ✅ **U1 is RESOLVED and the answer is YES** — a licensed, PSGC-keyed barangay coordinate set
   exists: **41,972 of booker's 42,046 barangay codes join (99.8%)**, 96.2% with exact or
   correspondence-matched HDX geometry, only **0.2% flagged unverified**, and essentially none are
   the parent city's coordinate (2 of 42,010). Measured by `.plans/scripts/barangay-centroid-probe.py`.
   ⚠️ **This REVERSES this plan's own first answer**, which said "largely NO, ~28% usable" — that was
   an inference from two documents, not a measurement; see U1 for what went wrong. **No stage is
   blocked on data any more.**
2. ✅ **The decisions** — D1 numeric union + named constants · D2 optional barangay in the picker ·
   D3 city-level device suggestion first, barangay in a later step · D4 ship the tier gated at a
   count of **≥ 2** · D5 the trust filter, excluding `fallback_unverified`. Full wording and the
   consequences each one carries are in §7.

⚠️ **What a reader should not mistake:** at today's density the barangay tier ships **dormant** —
14 vendors across 14 barangays, every count 1 (V1, F27), so S4 and S5 change nothing a booker can
see until density grows. That is D4's intended outcome, and it means S4/S5 are testable against
fixtures only.

> One-line framing: take "near" one administrative rung finer than it ships today — to **barangay** —
> using only data this platform already stores plus the free browser Geolocation API, and optimise for
> *not over-claiming precision* over getting the pin closer.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, V# = Verified finding, U# = Unknown, D# = Decision,
> G# = Gate; numbers are **plan-local** — qualify cross-plan refs by plan (e.g. "near-me D11").

**Predecessor:** `.plans/2026-10-14-booker-near-me-discovery.md` — city-first discovery, S1–S3d
shipped. This plan is the successor its **D11** sets the direction for, and it exists as its own file
because hanging a new multi-stage feature off a nearly-complete plan would bury that plan's
completion.

---

## 1. Scope

**In scope:** a barangay rung on the existing "near" ladder; carrying `barangay_code` into booker;
an optional barangay level in the location picker; using the browser Geolocation API to **suggest**
where the booker is; and — conditional on **U1** — barangay-centroid distance ordering *within* a
city.

**Explicitly out of scope:**
- **Street-level precision of any kind.** Barangay is the ceiling (near-me **D11**).
- **Sending any vendor address to a geocoding provider.** No `lat`/`lng` on `vendors`, no provider,
  no per-request cost, and therefore no licensing question about storing third-party results.
- **Per-vendor map pins.** Several vendors share one barangay point — near-me **B5** holds.
- **Any rendered kilometre figure.** Unchanged by better coordinates; a barangay centroid is still
  the middle of an area.
- **Mobile** (`ezzy-booker-mobile`). Parity is tracked in that app's own plan; **report only**.
- **Any schema change.** `vendors.barangay`/`barangay_code` already exist and are already populated.

**Cross-app:** one file outside the app's feature code — `booker/next.config.ts` (the
`Permissions-Policy` header, gate **G2**). No other app is touched.

---

## 2. Already decided — do not re-litigate

From near-me **D11** (resolved 2026-10-16, user) and recorded in
`architecture/portals.md` → "How far 'near' is allowed to go":

1. "Near" resolves **no finer than barangay**.
2. A vendor's address is **never** geocoded. Vendor position, where needed, is derived from
   `barangay_code` via a shared static table.
3. The booker's own position **may** come from the browser Geolocation API — free, no key, no quota.
   This **reversed** near-me D4 and **restored gate G2**.
4. Vendors are matched by **`barangay_code`**, never by barangay name.

⚠️ **The hierarchy, because it was first stated backwards.** PSGC containment is
`region ⊃ province ⊃ city/municipality ⊃ barangay`, so a narrowest-first ladder is

```
barangay → city → province → region → elsewhere
```

Region is **broader** than city, not a step between city and barangay. This **adds a rung above the
shipped ladder**; it does not reorder it.

---

## 3. Verified findings — read in the code 2026-10-16

- **V1 — `vendors.barangay_code` exists, is strict, and is populated.** Added by
  `20260722000001_vendor_address_fields.sql`, made a strict pick by `20260722000002`. Measured on the
  local DB: **14/14 active vendors have a non-empty `barangay_code`, `barangay`, `city_code` and
  `address_line1`.** ⚠️ Hosted is **unmeasured** — see **U2**.
- **V2 — booker never reads barangay today.** `lib/phAddress.ts:17` says so explicitly ("Booker does
  not use the `barangays/` tree at all — it never resolves below city level"), and neither
  `booker/lib/types.ts` nor any file in `booker/services/` mentions `barangay`.
- **V3 — the barangay reference data is already sharded, and cheaply.**
  `vendor/public/ph-address/barangays/<cityCode>.json` — **1,634 files, 6.6 MB in total but
  ~700–1,400 bytes each** (Makati 1,352 B / 33 barangays; Pila 711 B). Shape: `[{code, name}]`.
  ⚠️ **Names only — no coordinates.** It solves the *delivery* shape and gives the join key; it does
  not satisfy U1.
- **V4 — barangay codes are alphabetical, not spatial.** Makati runs Bangkal `…001`, Bel-Air `…002`,
  Carmona `…005`, Cembo `…003`, Comembo `…004`. **"The next barangay over" is not derivable from the
  code**, so a code-only approach can never be a gradient — only a yes/no.
- **V5 — `centroidOf` is already code-agnostic.** `lib/geoCentroids.ts:36` types the table as
  `Record<string, [number, number]>` and `:66` is a plain key lookup. It works for barangay codes
  **unchanged**; only the parameter *name* (`cityCode`) is city-flavoured. Low-friction reuse.
- **V6 — tiers are ordinal and "elsewhere" is a magic number.** `lib/nearby.ts:158` sorts with
  `a.tier - b.tier`; `NearTier = 0 | 1 | 2 | 3` (`:33`), `TIERS` (`:35`), and the literal `3` means
  "elsewhere" at `:53`, `:67`, `:154` and `:184`. See **B1**.
- **V7 — the narrowest tier is hard-coded as unorderable.** `withinTierDistance` returns `0` for
  `tier === 0` (`lib/nearby.ts:110`) with the comment at `:89-94`: *"Every vendor in the booker's own
  city shares one centroid… Ordering inside a city needs finer data than this system holds, and that
  is plan P1/P2."* See **B2**.
- **V8 — the Geolocation API is blocked at the header, for every origin.**
  `booker/next.config.ts:243` ships `Permissions-Policy: camera=(), geolocation=(), microphone=(),
  payment=(), interest-cohort=()`. It was `(self)` until 2026-09-28. **No device permission works
  until this changes** — gate **G2**.
- **V9 — the stored-location parser already rejects blanks.**
  `components/layout/AppShell/useAppShell.ts` requires `typeof parsed.cityCode === "string" &&
  parsed.cityCode` (truthy), so a widened `BookerLocation` must treat barangay as **optional** or
  every previously-stored location is discarded. See **I3**.
- **V10 — all 1,634 city centroids already ship.** `booker/public/ph-city-centroids.json`, 50,519
  bytes, 100% coverage, CC BY 3.0 IGO (near-me U3). **City-level device resolution needs no new
  data.** Barangay-level does.

---

## 4. The unknown that gates half this plan

### U1 — Does a licensed, PSGC-keyed **barangay centroid** dataset exist?  ✅ **RESOLVED 2026-10-17 — YES**, at 99.8% join coverage; see the resolution below
**This was the first stage and it was pure investigation — no code.**

Needed: ~42,000 rows keyed on PSGC `barangay_code`, with a licence that permits redistribution in a
public web app, and measured coverage.

**Where to look first, and why:** near-me **U3** asked the identical question for cities and was
answered by **OCHA HDX COD-AB** (admin-3) at **1,634/1,634 = 100%** under **CC BY 3.0 IGO**, joined
on the PSA `correspondence_code`. The same source publishes **admin-4** for many countries.
⚠️ **Whether PHL COD-AB includes admin-4 barangays is NOT known** — it has not been checked, and this
plan does not assume it. Secondary candidates: PSA's own published barangay geographies, GeoNames
(coverage and keying both doubtful at this level), OSM extracts (ODbL — see the caveat below).

**Assess exactly as U3 was assessed:** licence verified at the source's own API or terms page (not a
blog post), PSGC join coverage **counted**, and a sample cross-checked against a second source for
plausibility.

⚠️ **ODbL candidates are not a free pass.** An OSM-derived barangay table carries attribution *and*
share-alike on derived databases. That is a licence question of a different shape, not an absent one.

**The conditional branch — state it now so the plan cannot drift:**

| U1 outcome | Consequence |
|---|---|
| **A licensed dataset at good coverage** | The full plan is available: S5 (gradient ordering) and barangay-level device suggestion both unlock |
| **A dataset with partial coverage** | Ships, but **every consumer must treat a missing barangay centroid as "order last within its tier"** — exactly how `centroidOf` returning `undefined` is already handled (`lib/geoCentroids.ts:60-64`). No invented positions |
| **No licensed dataset** | ⚠️ **S5 is ✖ ABORTED and barangay-level device suggestion is impossible.** S1–S4 still ship: the **barangay tier by code equality needs no dataset at all** (**D4**). Device suggestion falls back to **city** level, which works today (V10) |

#### U1 — RESOLUTION  ✅ **YES, a usable dataset exists** (measured 2026-10-17)

⚠️ **THIS SECTION CORRECTS ITSELF. The first answer, written 2026-10-16, was WRONG** — it
concluded "largely NO, ~72% derived from coarser polygons". That was an **inference from two
documents, stated as if it were a measurement.** It is kept below, struck, because the way it went
wrong is more useful than the right answer alone.

**The measurement (2026-10-17).** Script: `.plans/scripts/barangay-centroid-probe.py` (committed and re-runnable;
it documents its own venv setup). Source: the `psgc` package's bundled `barangays.json`, **42,010
rows, all with coordinates**.

**1 — provenance, per row:**

| `coordinate_source` | rows | share |
|---|---|---|
| `hdx_exact_2023` | **36,761** | **87.5%** |
| `hdx_correspondence_2023` | 3,719 | 8.9% |
| `hdx_name_parent_2023` | 1,445 | 3.4% |
| `fallback_unverified` | **84** | **0.2%** |
| `merged_hdx_area_weighted_2026q1` | 1 | 0.0% |

**2 — join coverage against the codes these apps actually ship** (42,046 barangays across the 1,634
shards in `vendor/public/ph-address/barangays/`), joined on **`correspondence_code`** — the 9-digit
form, ⚠️ **not** the package's 10-digit `psgc_code`, which is the near-me **F9/F10** trap again:

```
41,972 / 42,046  =  99.8% coverage
of which 96.2% are exact- or correspondence-matched; 0.2% are flagged unverified
```

**3 — the "city centroid in disguise" test, which is what killed the original inference:** does a
barangay's coordinate *equal* its parent city's?

```
hdx_exact_2023            2 / 36,761  = 0.0%
every other source        0 / anything = 0.0%
```

**2 rows out of 42,010.** The feared failure mode does not exist in this data.

**4 — independent plausibility**, the same shape as U3's GeoNames cross-check. A real barangay
centroid should sit a few km from its city centroid — neither 0 km (that would *be* the city
centroid) nor absurdly far:

| source | n | median | p95 | max |
|---|---|---|---|---|
| `hdx_exact_2023` | 36,761 | **4.85 km** | 14.46 | 51.9 |
| `hdx_correspondence_2023` | 3,719 | 5.37 km | 23.94 | 47.3 |
| `hdx_name_parent_2023` | 1,445 | 2.30 km | 13.07 | 43.5 |
| `fallback_unverified` | 84 | 1.89 km | 21.02 | **384.9** |

⚠️ **Note where the 384.9 km outlier sits.** All **three** implausible rows (>60 km from their
parent city) are `fallback_unverified` — so **the package's own provenance flag correctly identifies
its own bad data.** That is what makes the flag worth carrying (**I9**) and made **D5(b)** cheap
insurance rather than a load-bearing workaround — **(b) is the decision taken (2026-10-17)**.

**Licence chain — unchanged and still owed.** Package *code* is MIT; the *data* is **CC BY-IGO** from
COD-AB, and a redistributor cannot relicense third-party CC BY-IGO as MIT. Attribution flows through.
Satisfiable: booker already carries the CC BY 3.0 IGO credit in `CityMapPanel.tsx`'s footer — but it
is a **separate** obligation and must be stated as such.

**Not a runtime dependency, ever.** `psgc` is Python; booker is TypeScript. It would **generate a
static JSON asset**, exactly as `.plans/scripts/build-ph-city-centroids.py` does for the city table.
The probe script was run in a **throwaway venv** (41 MB, outside the repo) and nothing was added to
any `package.json`.

**⬜ One residual risk, stated rather than hidden.** `hdx_exact_2023` is the **package's own label**.
This measurement establishes (a) what it claims per row, (b) that those rows are not parent-city
duplicates, and (c) that they are spatially plausible. It does **not** independently re-derive the
coordinates from HDX geometry. The ~28% admin-4 count in COD-AB's *current* notes versus 87.5%
rows labelled from a **2023** HDX vintage is still unexplained — either that layer was more complete
in 2023 or the note is stale. ⚠️ **Not a blocker:** the per-row flag plus the plausibility check are
enough to build on, and I9's trust filter bounds the damage if a label is ever wrong.

---

<details>
<summary><strong>✖ SUPERSEDED — the original, incorrect resolution (kept for the lesson)</strong></summary>

The first pass concluded **"no licensed, barangay-COMPLETE centroid source was found; the usable
fraction is bounded at ~28% by arithmetic"**, reasoning:

> COD-AB's own notes say `Admin 4: 11920`. The package claims 42,010 barangay coordinates and names
> COD-AB as its source. Therefore at most ~28% can be true barangay geometry and the remaining ~72%
> must be derived from something coarser — the city centroid in a barangay's clothing, near-me
> **F14**'s failure class.

**The arithmetic was sound. The premise was false** — "11,920 is all the admin-4 geometry that
exists" was never checked, and the data is labelled from a **2023** vintage rather than the current
version-03 dataset those notes describe.

⚠️ **Two things in that pass were right and are retained above:** that a search result claiming
"42,048 admin-4 features" is **wrong** (HDX's own notes say 11,920 — primary source wins), and that
COD-AB reports **1,642** admin-3 units where booker ships **1,634**, an 8-row vintage discrepancy of
the near-me **F9/F10** class that must be counted rather than assumed.

**The lesson, in one line:** an upper bound inferred from two documents is not a measurement, and
this one travelled from "plausible" to "stated as fact in two plans" inside an hour. The fix cost
one `pip install` in a throwaway venv.

</details>

### U2 — Hosted `barangay_code` coverage  ⬜ OPEN — the user's
V1 measured **local** at 14/14. Hosted is unknown, and local returns a clean answer by construction.
One query, worth running beside the predecessor plan's still-open U4:

```sql
select count(*)                                               as active_vendors,
       count(*) filter (where coalesce(city_code,'')     = '') as blank_city_code,
       count(*) filter (where coalesce(barangay_code,'') = '') as blank_barangay_code
from vendors v join statuses s on s.id = v.status_id and s.name = 'active';
```

A material share of blank `barangay_code` weakens the barangay tier the way near-me's **A2** warned
for `city_code` — those vendors simply never match the barangay tier and fall to the city tier, which
is correct behaviour but shrinks the feature's reach.

---

## 5. BLOCKERS

### B1 — The tier ladder cannot be extended safely as written  ✅ DONE (2026-10-17)
**File:** `lib/nearby.ts:33` (`NearTier = 0 | 1 | 2 | 3`), `:35` (`TIERS`), `:53`, `:67`, `:154`,
`:184` (the literal `3` meaning "elsewhere"), `:158` (`a.tier - b.tier`)

Tiers are an **ordinal numeric union** and "elsewhere" is a **magic number repeated in four places**,
two of them outside `rankTier` (`:154` and `:184` both use `3` as the no-vendor fallback). Adding a
rung shifts every tier's meaning: the literal `3` silently becomes "region" instead of "elsewhere",
and **nothing fails loudly** — results land in a plausible wrong group.

⚠️ **This is the single most dangerous item in the plan**, because its failure mode is a wrong answer
that looks right — a vendor from another region quietly grouped under "Also in <province>".

**Fix approach:** before any barangay work, remove the magic numbers — a named constant for the
widest tier and a single source for the ladder's order, with `TIERS` derived from it rather than
written out. ⚠️ **Behaviour must not change in this step**, and `lib/nearby.test.ts` is the proof: it
asserts tier numbers, so a pure refactor keeps every assertion green. Shape is **D1**.

✅ **DONE 2026-10-17 (S1).** `lib/nearby.ts` now holds one `TIER` map in ladder order
(`SAME_CITY` 0 · `SAME_PROVINCE` 1 · `SAME_REGION` 2 · `ELSEWHERE` 3), `NearTier` is derived from
it (`typeof TIER[keyof typeof TIER]`), and `TIERS` is `Object.values(TIER)` rather than a
hand-written second list. **All seven numeric tier literals are gone**: both `return 3`s and the
`0`/`1`/`2` returns in `rankTier`, the three comparisons in `tierLabel`, the `tier === 0` guard in
`withinTierDistance`, and the two `: 3` no-vendor fallbacks at the old `:154` and `:184`.
`a.tier - b.tier` was **not** touched (D1's whole point).

**How it was verified** — machine-verified, no live environment needed:
- `lib/nearby.test.ts` **green unmodified** — 15/15, and the file is absent from `git diff`, which
  is the acceptance test D1 set.
- Full booker unit suite **272/272**.
- `npx tsc --noEmit` clean; `npm run lint` reports `nearby.ts` **zero** problems (18 pre-existing
  problems remain in 11 other files, none touched here).
- ⚠️ **A differential against the pre-refactor file**, because the suite's hand-picked cities are a
  thin net for a failure mode that looks right: **1,600** `rankTier` combinations (every city code ×
  province code on both sides, including `''`), **288** `tierLabel` cases and **24** ranking +
  grouping combinations — **all identical**. Harness kept at
  `.plans/scripts/s1-tier-ladder-differential.ts`; it expires at S4 by design.

🤖 **Slightly beyond the item as written:** B1 named only the `3`s, but the `0`/`1`/`2` returns and
the `tier === 0` guard were named too — same hazard, same fix, and leaving them would have meant a
second pass over the same functions. ⚠️ **`withinTierDistance` still keys on `TIER.SAME_CITY`, which
is B2's job to change** (to the ladder's *narrowest* rung) — naming it did not resolve B2 and must
not be mistaken for having done so.

### B2 — The "narrowest tier cannot be ordered" rule becomes wrong  ✅ DONE (2026-10-17, S4)
**File:** `lib/nearby.ts:104-115`, with the reasoning at `:89-94`

`withinTierDistance` returns `0` when `tier === 0`, because every vendor in the booker's own city
shares one city centroid — true today, and the comment names P1/P2 as the fix. Once a barangay rung
exists, that special case must apply to **the barangay tier only**: same-city vendors in *different*
barangays become orderable, which is the entire point of S5.

If the special case is left on tier 0 after renumbering, **city-tier ordering stays dead and the
feature delivers nothing** — the exact gap it was built to close.

**Fix approach:** key the rule on the ladder's *narrowest rung* rather than the literal `0`, and
update the comment to say why the rung — not the number — is what matters. Covered by a test that
asserts two same-city, different-barangay vendors order by distance.

✅ **DONE 2026-10-17 (S4).** `withinTierDistance` now short-circuits on `TIER.SAME_BARANGAY`, and
its comment block records what moved and why.
⚠️ **THE PLANNED TEST COULD NOT BE WRITTEN AS SPECIFIED, AND THIS IS THE HONEST REASON.** "Two
same-city, different-barangay vendors order by distance" is **not yet observable**: the only
centroid table that ships is keyed by **city**, so both vendors resolve to the same city centroid,
both score exactly 0 km, and the stable tiebreak keeps the caller's order. The fix is correct and
inert — the ordering becomes real only when the barangay centroid table lands (**S5**, gate
**G3**), and that is where the specified test belongs. What *is* asserted now: the barangay rung is
never reordered by a table, and the city rung still keeps the caller's order **for a different
reason than before** (measured-and-tied, not skipped) — the old test's comment says so explicitly
rather than leaving a passing test that quietly means something else.

### B3 — A device-derived place must never be applied silently  ⬜ TODO
**File:** new picker/hook work (§6 I2, I3) · the pattern is specified in near-me **P4**

The device gives a *point*. Turning it into a barangay is **nearest-centroid, which is a guess** —
barangays are irregular, so near a boundary the nearest centroid is frequently not the containing
one. Applying that silently makes the app assert a false fact about the booker's location, and the
booker has no way to see it happened.

near-me **P4** already specifies the remedy: *"always a suggestion, never silent."* A wrong guess
must cost one tap, not produce wrong results invisibly.

**Fix approach:** the device result is **offered**, never written straight to `BookerLocation`. That
requires `BookerLocation` to record **how** it was set (chosen vs device-suggested-and-confirmed), or
no UI can distinguish them later. ⚠️ Point-in-polygon would be *correct* rather than a guess, but it
needs ~42,000 boundary polygons (tens of MB) and is **out of scope** — which is why the confirmation
step is load-bearing rather than polish.

### B4 — Nothing device-related works until the header changes  ⬜ TODO — gate **G2**
**File:** `booker/next.config.ts:243`

`Permissions-Policy: … geolocation=() …` denies the API to **every** origin (V8). Until it is
`(self)`, device location fails regardless of the booker's own permission — and it fails in a way
that looks like the booker declining.

**Fix approach:** flip to `geolocation=(self)` **in the same stage that first calls the API**, never
ahead of it, and extend `visual-tests/csp.spec.ts` the way near-me's B6 did for the map — assert the
policy *permits* what the feature needs rather than reasoning about it. ⚠️ Security-header change:
**approval gate G2**, not covered by approving this plan.

---

## 6. IMPORTANT

### I1 — `barangay_code` must reach booker at all  ✅ DONE (2026-10-17, S2)
**File:** `booker/services/offerings.service.ts` (the catalogue select) · `booker/lib/types.ts:139`
(`CatalogueVendor`) · `lib/nearby.ts:28` (`RankableVendor = { cityCode, provinceCode }`)

Booker never selects the column (V2). Add it to the catalogue query and to both types.
⚠️ Add it to `RankableVendor` as **optional**, so every existing caller and test keeps compiling and
a vendor without one degrades to the city tier rather than failing.

✅ **DONE 2026-10-17 (S2).** `barangay_code` added to the catalogue select, to `CatalogueRow.vendors`
and to the mapper; `CatalogueVendor.barangayCode` is **required `string`** (matching `cityCode` —
the column is `text NOT NULL DEFAULT ''`, so `''` means unknown), and `RankableVendor.barangayCode`
is **optional**, as specified. **Verified:** `npx tsc --noEmit` clean, 272/272, lint at the agreed
18. 🤖 Required-on-`CatalogueVendor` cost **5 fixture updates** (4 in `app/ui-gallery/page.tsx`, 1 in
`lib/popular.test.ts`) — optional would have avoided them but would have let a forgotten mapper
field pass unnoticed, and diverged from how `cityCode` is treated two lines above it.
⚠️ **No new data exposure:** the catalogue already selects `address`, so a barangay code adds
nothing a booker could not already read off the vendor card.

### I2 — The picker needs a barangay level, and its data loads differently  ✅ DONE (2026-10-17, S3)
**File:** `components/location/LocationPicker/` · `lib/phCities.ts` (`buildCityOptions:143`,
`cityOptionsFromVendors:171`, `matchCityOptions:213`) · `lib/phAddress.ts:85` (`loadCityCentroids`)

⚠️ **The load shape is genuinely different and must not be copied blindly.** City data is **one file
for the whole country**, fetched once and module-cached. Barangay data is **1,634 files, one per
city** (V3), so the loader is **per-city, keyed by the selected city**, with its own cache keyed the
same way. ~700–1,400 bytes per fetch, so this is cheap — but it is a new pattern in this codebase,
not a parameter change.

Shape of the UI is **D2**.

✅ **DONE 2026-10-17 (S3).** New pure module `booker/lib/phBarangays.ts` (`buildBarangayOptions`,
`matchBarangayOptions`, name-sorted, blank rows dropped, name-only matching, capped at 60) with
**6 tests**; `loadBarangays(cityCode)` in `lib/phAddress.ts` with a **per-city** cache and per-city
in-flight map; the picker gained an opt-in second level.
⚠️ **THE SHARDS ARE NOW IN BOOKER** — see **F3** below, which is the cost this item did not state.
⚠️ **The one-tap city flow is untouched**, as D2 requires: tapping a city row still commits and
closes. Narrowing is a separate chevron button on the row, and the barangay step always carries an
"All of <city>" row, so it can never become a dead end — including when the shard fails to load.
**Verified:** 278/278 (6 new), tsc clean, lint back to **18** after fixing a self-inflicted 19th
(see F4), production build clean. ⚠️ **Not verified in a browser** — see F2.

### I3 — `BookerLocation` widening, and the stored values that predate it  ✅ DONE (2026-10-17, S3)
**File:** `booker/lib/types.ts:132` · `components/layout/AppShell/useAppShell.ts` (the parser)

`BookerLocation` is `{cityCode, cityName, provinceCode, provinceName}`. Barangay fields must be
**optional**, because the parser's truthy `cityCode` test (V9) is the only validation and every
location already in a booker's `localStorage` has no barangay. A required field would silently
discard every returning booker's remembered city.

⚠️ Also carry the **barangay name**, not just the code — `tierLabel` has to print "In your barangay"
with a name, and the code is not a label (near-me **F2** is the precedent: storing the wrong form of
a name broke a query silently).

✅ **DONE 2026-10-17 (S3).** `BookerLocation.barangayCode?` and `.barangayName?` added, both
optional; the `useAppShell` parser still gates on a truthy `cityCode` **alone**, so every location
already in a booker's `localStorage` stays valid. The barangay pair is spread in **conditionally**
rather than written as `undefined`, so "no barangay" is an **absent key** in the object and in
storage, not a key holding `undefined` — otherwise a `"barangayCode" in location` test would read
as present. A stored **code with no name** is kept (the code is the identity; I6 has a wordy label
for it); a **name with no code** is discarded.

### I4 — `centroidOf` is reusable as-is; resist renaming it  ⬜ TODO
**File:** `lib/geoCentroids.ts:36, 66, 97`

`CentroidTable` is `Record<string, [number, number]>` and `centroidOf` is a key lookup (V5), so it
serves barangay codes unchanged. Only `cityDistanceKm:97` is city-named. ⚠️ Prefer **one generic
lookup used twice** over a parallel barangay module — two copies of a haversine is how two answers
appear for one question.

### I5 — F27's count-of-1 rule belongs in the derivation, not in review  ⬜ TODO
**File:** wherever barangay markers or breakdowns are derived (sibling of `lib/cityMarkers.ts`)

near-me **F27**: at one vendor per barangay, a "barangay · 1" marker **is** a vendor pin by
arithmetic, and near-me **B5**'s guarantee collapses on sparse data rather than on changed code. Any
barangay-level marker or chip **must not render when its count is 1** — it falls back to the city
level. ⚠️ Structural, like B5's type constraint: expressed in the data, with a test, not in a comment.

### I6 — Tier labels and their honesty  ✅ DONE (2026-10-17, S4)
**File:** `lib/nearby.ts:77` (`tierLabel`)

Every tier above the narrowest says **where it is, in words** — near-me calls that the honesty
mechanism, not decoration (its X4). A barangay rung needs its own label ("In your barangay" / "In
<Barangay>"), and the existing labels shift one rung down. ⚠️ `displayCityName` normalises "City of
X" → "X City"; **barangay names have no such convention**, so do not reach for it by analogy.

✅ **DONE 2026-10-17 (S4).** `tierLabel` returns `In <Barangay>` when a name is stored and
**"In your barangay"** when only a code is — it never prints a code. `displayCityName` is **not**
applied, and a test pins that with a barangay literally named "City of Dreams", so the analogy
cannot be reintroduced without a failure.

### I7 — The existing tests are the safety net for B1/B2  ✅ DONE (2026-10-17, S1 + S4)
**File:** `lib/nearby.test.ts`

The suite asserts tier numbers, so B1's refactor is provable: **same assertions, still green**. When
the rung is added, those assertions change **deliberately and visibly** — which is what makes the
renumbering safe. ⚠️ Do not "fix" a failing tier assertion without first checking the number is what
changed and not the grouping.

✅ **DONE 2026-10-17 — and it worked exactly as designed, in both directions.** S1's refactor left
the file **untouched and green** (15/15). S4's rung then broke **5 of 15** assertions, and each
failure was read before anything was edited: `actual 1 / expected 0` (same-city moved to rung 1),
`actual 4 / expected 3` (elsewhere moved to 4), `"In your barangay" / "In Makati City"` (rung 0 is
the barangay now), and two grouping expectations whose tier numbers shifted. **Every one was the
number moving; none was the grouping breaking.** The suite is now **23 tests**, and the renumbered
expectations are still written as **literals** — a comment explains that rewriting them as
`TIER.SAME_CITY` would make the next renumbering silent, which would destroy the tripwire that just
earned its keep.

### I9 — A barangay centroid must carry its provenance  ⬜ TODO — **REQUIRED** (D5 = (b), resolved 2026-10-17)
**File:** the generated asset in `booker/public/` · its build script in `.plans/scripts/` ·
`lib/geoCentroids.ts` (the table type at `:36`)

U1 (as measured, 2026-10-17) found the data is **good** — 96.2% exact or correspondence-matched —
but **0.2% is flagged `fallback_unverified`, and that 0.2% is where all three spatially implausible
rows live**, including one **385 km** from its own parent city. A plain `Record<code, [lat, lng]>` —
the shape the city table uses (`lib/geoCentroids.ts:36`) — **cannot express that distinction**, so an
unfiltered import silently ships the bad rows along with the good ones.
⚠️ **The provenance flag is cheap and it demonstrably works**: excluding one source value removes
every bad row the probe could find. That is why this is structural rather than a review note.

**The filter, stated exactly** (so it cannot be re-litigated during S5 — D5 = (b), 2026-10-17):

| `coordinate_source` | n | trusted? |
|---|---|---|
| `hdx_exact_2023` | 36,761 | ✅ yes |
| `hdx_correspondence_2023` | 3,719 | ✅ yes |
| `hdx_name_parent_2023` | 1,445 | ✅ yes — the weakest tier retained. Kept because it measures *plausible*: median 2.30 km from its parent city, max 43.5 km, and **no** >60 km row. Revisit only if a spot-check contradicts that |
| `merged_hdx_area_weighted_2026q1` | 1 | ✅ yes |
| `fallback_unverified` | 84 | ✖ **excluded** — all three >60 km rows live here, one at 384.9 km |

So the filter is **one excluded value**, retaining ~99.6% of booker's barangay codes.

**Fix approach:** the generated table carries a provenance value per row, and the consumer trusts a
barangay coordinate **only** for true-barangay provenance — otherwise it falls back to the city tier,
the same way `centroidOf` returning `undefined` already means "order last within tier"
(`lib/geoCentroids.ts:60-64`). ⚠️ **Structural, not advisory:** if the flag is optional in the type,
a future caller will omit it. Mirrors near-me **P2**'s `geocode_precision` design and near-me
**B5**'s approach of making the honest thing the only representable thing.

## 6b. FINDINGS from executing S2–S4 (2026-10-17)

Discovered during execution, not anticipated by the plan. Numbered F# in this plan.

### F1 — A booker can pick a barangay and see NO evidence of it  ✅ DONE (2026-10-17)
**File:** `components/location/LocationChip/LocationChip.tsx:23,30`

The chip renders `displayCityName(location.cityName)` and nothing else, so after narrowing to a
barangay the booker sees the same "Makati City" they saw before. ⚠️ **And the tier label cannot
cover for it**, because **D4's density gate collapses the barangay heading at today's density** —
so right now the choice is **completely invisible**: no chip change, no heading, no reordering a
booker could notice. A setting that produces no feedback reads as broken, and it also makes S3
untestable by hand on staging.

**Options:** (a) the chip shows `Bel-Air · Makati City` when a barangay is set — ~3 lines plus a
style, and the picker's own step already uses that wording; (b) leave it until S5 makes the rung
observable; (c) show it only in the picker's own header.
**Recommendation: (a).** It is the smallest change that makes an invisible setting visible, and it
is the only one that lets the user verify S3 at all before S5 lands.

✅ **DONE 2026-10-17 — (a), chosen by the user.** `LocationChip` renders a `.place` line:
`Bel-Air · Makati City` with a barangay, the city alone without one. It stays a **pure display
component** (no state, no effects, the one handler still arrives as a prop), so it keeps its
single-`.tsx` exemption under the component-separation skill's §4.
Three details that are deliberate, not incidental:
- **No `displayCityName` on the barangay** (I6), and **a code with no name falls back to the city**
  (I3's tolerated shape) — it never prints a PSGC code.
- **The accessible name uses a comma, not the visual `·`** — a middle dot is read as punctuation or
  skipped, so the label is "Location: Bel-Air, Makati City. Change".
- **It truncates instead of widening.** The chip is `width: fit-content` in a flex column, so
  "Bagong Silangan · Quezon City" would otherwise stretch it past the hero card at 360px — the same
  overflow class the chip's own `inline-flex` comment already records. `max-width: 100%` on the chip
  plus `min-width: 0` + ellipsis on `.place`.

**Verified:** tsc clean, lint still **18**, 286/286.
⚠️ **The existing `home-light` / `home-dark` baselines are unaffected, and here is the actual
reason rather than an assumption:** both `BookerLocation` fixtures in `app/ui-gallery/page.tsx`
(`:164` Pila, `:522` Burgos) carry **no barangay**, so `place` evaluates to the city string that
was already rendered — the change is a class rename plus styles that are inert on text that fits.
⚠️ **The barangay variant itself has NOT been seen in a browser** — folded into **F2**.

### F2 — The location picker has never had a visual baseline  ✅ DONE (2026-10-17)
**File:** `visual-tests/pilot.spec.ts:21` (the `modes` list) · `app/ui-gallery/page.tsx`

97 committed snapshots cover 48 modes, and **none of them is the picker** — it was shipped unseen
in plan 2026-10-14 S1 and the barangay step inherits that gap. The repo's own rule is in the
`nearyou` comment: *"Added WITH the component, not after: a new shelf with no baseline is exactly
how the redesign's F57 shipped unseen."*

**Three** fixtures are wanted, and the third was added by F1's fix: the city list (showing the new
chevron affordance), the barangay step, and **a `BookerLocation` carrying a barangay** so the
chip's `Bel-Air · Makati City` form is covered at all — today both gallery locations are
barangay-less, which is exactly why F1's change could not alter a baseline **or** be seen in one.
⚠️ **Adding them to `modes` without recording baselines makes the suite fail**, so the fixture and
the `npm run test:visual` run belong together — and the run needs a free port, which the user's dev
server on `:3000` currently occupies. **Left undone deliberately**, not forgotten.

✅ **DONE 2026-10-17** (user freed the port — ⚠️ and the suite boots **its own** dev server on
**3200**, `playwright.config.ts:62`, so `:3000` was never the blocker it was recorded as here).

**Verified by the FULL suite, not just the new cases: `112 passed`, exit 0, 3.6 min** — so the six
new baselines hold *and* none of the 97 that existed before moved. That second half is the part
worth stating: S2–S4 and F1 touched `lib/types.ts`, the catalogue mapper, `LocationChip` and the
gallery fixture, all of which feed existing panes.

**Three fixtures added** to `app/ui-gallery/page.tsx` + `visual-tests/pilot.spec.ts`:
`locationpicker` (the city list), `locationchip` (all three chip forms), and `locationbarangay`
(the barangay step). **Six baselines** recorded, light and dark.
⚠️ The barangay step is a **standalone interactive test**, not a `modes` entry: it cannot be reached
by a URL parameter, and it was deliberately not given one — a test-only prop would be production
code shaped by the test, and it would stop proving that the chevron on a city row opens the list.
It follows `login-mobile-info`'s precedent. The click also exercises the real per-city fetch.
⚠️ `NEAR_LOCATION_BARANGAY` is a **second** fixture constant rather than a field added to
`NEAR_LOCATION`, so `home-*`, `nearyou-*` and every other pane keep proving that a **barangay-less**
location still renders exactly as before the field existed.

**⚠️ THE BASELINES PAID FOR THEMSELVES BEFORE THE SUITE EVER RAN — twice:**

1. **A design defect, visible only once rendered (F5).** The "narrow" control was a bordered pill
   reading "Barangay", repeated on every one of up to 60 rendered rows. On screen it drowned out
   the city names the booker is actually scanning. Replaced with a borderless chevron that gains a
   surface on hover; the 44px target and the `aria-label` are unchanged, and the subtitle carries
   the explanation once instead of 60 times. **This is exactly the class of problem no type check,
   lint or unit test can see**, and it had already passed all three.
2. **A hover state nearly baked into a baseline for good.** After the click that opens the step,
   the pointer rests over the list and whichever row sits at that y lights up — the first recording
   captured **"Bukal" highlighted** as if that were the step's resting appearance. Deterministic
   enough to pass for ever. The spec now parks the pointer at `(0, 0)` before the screenshot.

### F5 — The "narrow" affordance was wrong, and only a rendered baseline could say so  ✅ FIXED (2026-10-17)
**File:** `components/location/LocationPicker/LocationPicker.tsx` ·
`components/location/LocationPicker/LocationPicker.module.css`

The first version of the barangay affordance was a **bordered pill reading "Barangay"** on every
city row. It passed `tsc`, `lint` and 286 unit tests, and it was wrong the moment it rendered: at
60 visible rows the pills drowned out the city names, which are the only thing the booker is
scanning. Replaced with a **borderless chevron** that gains a surface on hover — the 44px target
and the `aria-label` are unchanged, and the subtitle now carries the explanation **once** instead
of sixty times.

⚠️ **Recorded because of what it says about the gap F2 closed.** No static check can see this
class of defect; it needed a picture. The component had shipped without one since 2026-10-14, and
the first baseline recorded for it immediately paid for the fixture work.

⚠️ **Second artifact, same session, nearly permanent:** the first `locationbarangay` recording
captured a row (**"Bukal"**) in its `:hover` state, because the pointer rests where it clicked. The
click lands at the same place every run, so that baseline would have **passed for ever** while
documenting a hover as the step's resting appearance. The spec now parks the pointer at `(0, 0)`.
A deterministic wrong baseline is worse than a flaky one — it never asks to be looked at again.

### F3 — booker now carries 1,634 extra files / 6.6 MB, reversing a documented decision  ⬜ RECORDED
**File:** `booker/public/ph-address/barangays/` (new) · `booker/lib/phAddress.ts` header ·
`booker/AGENTS.md` → "PSGC address data"

I2 specified a per-city loader over the sharded barangay data but never said where booker gets it.
It gets it by **copying `vendor/public/ph-address/barangays/`** — 1,634 files, 6.6 MB, verified
identical by `diff -r` **and** by a content-only digest (⚠️ the first check used `md5sum`, whose
output includes the path, so the two trees' digests could never have matched — the comparison was
wrong, not the data).

This **reverses** the note in `lib/phAddress.ts` that booker "does not use the `barangays/` tree at
all". Both that comment and `booker/AGENTS.md` now say so, including the **drift warning**: the
copies are independent, so a PSGC update must be applied to both with no error on either side.
⚠️ **Nothing loads the tree as a whole** — one shard per narrowed city, ~700 B–38 KB.
⚠️ **The user controls the commit**, so the 6.6 MB is reversible by simply not committing it; it is
flagged here because a plan reader six months from now will want to know why booker gained 1,634
files.

### F4 — The barangay loader had to be derived, not reset, to hold the lint baseline  ⬜ RECORDED
**File:** `components/location/LocationPicker/useLocationPicker.ts`

The first version wrote `setBarangays(null)` at the top of the load effect, which is the
synchronous-setState pattern `react-hooks/set-state-in-effect` rejects — **19 lint problems, and
near-me F5 fixed the agreed baseline at 18**. Rewritten so the loaded payload carries the city code
it belongs to and "loading" is **derived** by comparing it to the city being narrowed.
⚠️ **The rewrite is better than the version that lint rejected**, which is worth recording: the
reset version rendered the *previous* city's barangays for one frame on a city switch, because the
effect runs after that render. Same shape as `useExplorePage`'s derived reveal counter.

---

### I8 — Mobile parity  ⬜ REPORT ONLY
`ezzy-booker-mobile` has no "near" feature. Tracked in
`.plans/2026-09-25-booker-mobile-redesign.md`. ⚠️ **Not closed by this plan** — report only.

---

## 7. DECISIONS
<!-- plan-authoring hard gate: no stage may execute while any OPEN line remains.
     ✅ 2026-10-17: there are none left. D1–D5 are all resolved below, each with the
     consequences it imposes on its stage. Options are kept, not deleted. -->

- **D1 — How is the tier ladder represented after B1?** → **(a) numeric union + named constants**
  (resolved 2026-10-17, user, as recommended). `lib/nearby.ts` keeps `NearTier` numeric and derives
  it from one ordered `TIER` map; the magic `3` at `:53`, `:67`, `:154`, `:184` becomes
  `TIER.ELSEWHERE`; `a.tier - b.tier` sorting (`:158`) is **not** touched. ⚠️ B1 is therefore a
  **pure refactor with zero behaviour change** — `lib/nearby.test.ts` must stay green **unmodified**,
  and that is the acceptance test for S1.
  (a) **Keep the numeric union, replace the literals with named constants** and derive `TIERS` from
  one ordered source. Surgical, keeps `a.tier - b.tier` working, smallest diff.
  (b) **Named union** (`'barangay' | 'city' | …`) with an explicit order array. More readable and
  impossible to get backwards, but it touches every tier comparison, the grouping and the tests.
  **Recommendation: (a).** The repo prizes surgical changes, and (a) removes the actual hazard
  (magic numbers) without rewriting working code. Revisit if a sixth rung is ever proposed.

- **D2 — Does the picker ask for a barangay, and is it required?** → **optional narrowing**
  (resolved 2026-10-17, user, as recommended). City first exactly as today, then an optional barangay
  level. ⚠️ **"Any barangay" must behave identically to today's no-barangay state** — not
  "approximately", identically: `BookerLocation` widens with an **optional** field (**I3**) and a
  stored location without one keeps working untouched. That backward compatibility is S3's
  acceptance test.
  **Recommendation: optional.** Pick a city as now, then *optionally* narrow. No barangay behaves
  exactly as today, so the feature cannot regress the one-tap flow that ships. Required would add a
  step for every booker to serve a tier most will not match at current density (**F27**).

- **D3 — Does device location suggest a city, a barangay, or both?** → **city first, barangay in a
  later step** (resolved 2026-10-17, user, as recommended). S6 ships **city-level only**, which needs
  no new data at all (V10) and is independent of S5 and G3. Barangay-level suggestion is a **separate
  follow-on step** after the centroid asset lands. ⚠️ Consequence: **S6 no longer waits on S5** — it
  waits only on S3 and **G2**. Do not let barangay suggestion be slipped into S6 "while we're in
  there"; that is what couples the header change to the asset and stalls both.
  **Recommendation: city first, barangay only when U1 resolves yes.** City-level suggestion needs
  **no new data at all** (V10) and is independently shippable; barangay-level is blocked on U1.
  Sequencing them separately means device location can ship before the dataset question is answered.

- **D4 — Do we ship the barangay tier, and under what density?** → **ship it, gated on density**
  (resolved 2026-10-17, user, as recommended). ⚠️ The question's original framing — "*if* U1 finds no
  dataset" — was overtaken: U1 came back YES, so what was actually decided is the **F27 density
  gate**, not a fallback.
  **The threshold, stated so S4 cannot be implemented vaguely: a barangay-level grouping surfaces
  only at a count of ≥ 2; at 1 it falls back to the city level.** The number is not a preference —
  it is F27's arithmetic: a "barangay · 1" marker **is** a vendor pin, and 2 is the smallest count
  that is a grouping instead. 🤖 **I set this threshold while recording the decision; it was not
  part of the question put to the user** — override it if you want it higher (say ≥ 3) to leave
  headroom. **I5** is what makes it structural rather than remembered.
  ⚠️ **Consequence to expect, and say out loud at S4:** at today's density (14 vendors, 14 cities,
  14 barangays, **every count 1** — V1/F27) the tier ships **dormant** and changes nothing a booker
  can see. That is the intended outcome, not a bug, but it means **S4 cannot be acceptance-tested
  against live data** — only against fixtures. Do not "fix" the silence by lowering the gate.
  The tier by **code equality** needs no dataset (V4 — it can only ever be a yes/no, never a
  gradient). **Recommendation: yes, but only once vendor density justifies it** (**F27**): at one
  vendor per barangay it changes nothing observable and risks reading as a vendor directory.

- **D5 — U1 found the barangay coordinates are usable (99.8% join, 0.2% flagged unverified).
  How does S5 handle that 0.2%?** → **(b) the trust filter** (resolved 2026-10-17, user) — carry the
  per-row provenance into the generated asset, trust only true-barangay geometry, exclude
  `fallback_unverified`, and degrade the rest to the city tier. **I9 is therefore required, not
  conditional**, and **G3**'s asset shape is now settled (the gate itself is still ungiven).
  ⚠️ This question was first written as "~72% are derived from
  coarser polygons, so what happens to S5?" — that premise was wrong (see U1), and the options
  below are kept with their original framing struck so the reasoning survives.
  (a) **✖ Abort S5.** No barangay-distance ordering. S4's code-equality tier is the whole feature,
  and the precision ladder stays city-grade. Honest, cheap, and delivers no intra-city ordering.
  (b) **Use `coordinate_source` as a TRUST FILTER.** Carry the package's per-place provenance
  through into the generated asset; trust a barangay centroid **only** when its source is true
  barangay geometry, and fall back to the city tier for the rest. ⚠️ This is the same shape as
  **near-me P2's `geocode_precision`** field — a design already reviewed and endorsed in that plan —
  applied to a different data source. ~~Gives real ordering for ~28% of barangays and an honest,
  explicit degrade for the rest.~~ ⚠️ **That last sentence was written on the wrong premise.**
  Measured, it gives real ordering for **99.6%** of booker's barangay codes and degrades **0.2%**.
  (c) **Source the geometry independently** (PSA's own barangay geographies, an OSM extract) and
  compute true centroids. Highest fidelity, unknown effort, and an OSM route carries ODbL
  share-alike on the derived table.
  ⚠️ **THE MEASUREMENT ASKED FOR HERE HAS NOW BEEN TAKEN (U1, 2026-10-17), AND IT CHANGES THE
  ANSWER.** (a) and (c) are no longer warranted: **99.8%** of booker's barangay codes join, **96.2%**
  carry exact- or correspondence-matched HDX geometry, and only **0.2% (84 rows)** are flagged
  `fallback_unverified` — which is also where **all three** spatially implausible rows sit. So the
  trust filter is not a workaround for bad data; it is **a one-line exclusion that removes every bad
  row the probe could find.**
  **Recommendation: (b), now on evidence rather than caution.** Exclude `fallback_unverified` and
  the table is clean. ⚠️ The filter is **still not optional**: the provenance flag is the only thing
  standing between a good table and a silently wrong one, and I9 is what keeps it structural rather
  than remembered.
  ✅ **Accepted as recommended, 2026-10-17 (user).** The filter is tabulated value-by-value at **I9**
  so S5 implements an explicit list rather than a judgement call.

---

## 8. Approval gates

| Gate | What | When | Status |
|---|---|---|---|
| **G1** | **Execution approval** for this plan | before S1 | ⬜ **NOT GIVEN — but nothing blocks it now.** D1–D5 all resolved 2026-10-17; the hard gate is cleared |
| **G2** | **Security header** — `geolocation=()` → `(self)` (`next.config.ts:243`) | the stage that first calls the API (S6) | ⬜ **RESTORED by near-me D11, NOT GIVEN.** Its own approval |
| **G3** | **New asset** — a generated barangay centroid table into `booker/public/`, built by a script in `.plans/scripts/` as the city table was | S5 step 1 | ⬜ **NOT GIVEN** — but its **shape is now settled** by D5 = (b) (2026-10-17): per-row provenance, `fallback_unverified` excluded. ✅ U1 confirms the source exists (99.8%, CC BY-IGO). ⚠️ The asset must carry the **provenance flag** (**I9**) and the **CC BY-IGO credit is owed** — MIT covers the package code, not the data |
| — | **No migration gate** | — | ✅ **none needed** — `vendors.barangay_code` already exists and is populated (V1) |

---

## 9. Execution order

**The safe prefix — everything up to S4 needs no dataset and no device permission**, so work can
start without waiting on U1 or G2.

| Stage | What | Depends on |
|---|---|---|
| **S0** | **U1 — the dataset investigation.** No code. Licence verified at source, PSGC coverage counted, sample cross-checked. Record the outcome against §4's conditional table | nothing |
| ✅ **S1** | **B1** — make the ladder extensible. **Pure refactor, zero behaviour change**, proven by `lib/nearby.test.ts` staying green **unmodified** | ✅ **DONE 2026-10-17** — 15/15 unmodified, 272/272 suite, tsc clean, plus a 1,600-case differential |
| ✅ **S2** | **I1** — carry `barangay_code` into the catalogue, `CatalogueVendor` and `RankableVendor` (optional) | ✅ **DONE 2026-10-17** — tsc clean, 272/272, lint at baseline |
| ✅ **S3** | **I2, I3** — the picker's optional barangay level + the widened, backward-compatible `BookerLocation` | ✅ **DONE 2026-10-17** — new `lib/phBarangays.ts` (+6 tests), per-city loader, 1,634 shards copied into booker, one-tap city flow unchanged |
| ✅ **S4** | **The barangay tier** — `rankTier` + `tierLabel` + **B2** + **I6**, **I7**. ⚠️ **Needs no dataset** (this is near-me's P1a) and ⚠️ **ships dormant** at today's density | ✅ **DONE 2026-10-17** — rung added, B2 moved to the narrowest rung, `BARANGAY_GROUP_MIN` = 2, 286/286, production build clean |
| **S5** | **The gradient** — barangay-centroid distance within a city (**I4**, **I5**, **I9** — now required), **G3** | S4, **G3**. ✅ **Fully unblocked on its own terms 2026-10-17**: U1 cleared the data (99.8%) and D5 = (b) settled the filter. Nothing specific to S5 is open any more |
| **S6** | **Device suggestion, CITY LEVEL ONLY** — **B3**, **B4/G2**, `csp.spec.ts` extended. Barangay-level suggestion is a separate follow-on step (D3) | **G2**, S3. ✅ **D3 decoupled it from S5** |

⚠️ **S5 and S6 are independent of each other.** S6 at *city* level can ship without S5 or U1 (V10).

---

## 10. Verification

**Machine-verifiable:** `tsc`; `node --test` (`lib/nearby.test.ts` green and unchanged through S1,
then deliberately updated in S4); a test asserting two same-city/different-barangay vendors order by
distance (S5); a test asserting a count-of-1 barangay never renders (**I5**); `npm run lint` against
the **agreed 18-problem baseline** (near-me **F5** — 19 is a regression); `next build`; the Playwright
visual suite, with any new picker state given a baseline **with** the component (near-me F8 is the
precedent for what happens otherwise); `csp.spec.ts` asserting the policy permits geolocation (S6).

**Needs a live environment or a human:** **U2** (hosted coverage — the user's); the device permission
prompt and its decline path on a real phone; whether a device-suggested barangay is *correct* often
enough to be worth offering (**B3** — only measurable in the field); 360 px layout of the extended
picker.

⚠️ **What no test here can prove:** that the feature is *useful*. At 14 vendors in 14 cities and 14
barangays (V1, near-me **F27**) every barangay count is 1, so S4 and S5 change nothing a booker can
see. **Density is a precondition, not a detail** — see D4.

---

## 11. Parked / out of scope, with reasons

- **Point-in-polygon barangay resolution** — ⏸ the *correct* answer rather than a guess, but ~42,000
  polygons is tens of MB. Unblocked only by a reason strong enough to justify the payload. **B3**'s
  confirmation step exists because this is parked.
- **Street-level geocoding, per-vendor coordinates, map pins** — ✖ out of scope by near-me **D11**.
  Its cost record (U1/U2 — price, and **storage rights as a legal gate**) stays in that plan.
- **Mobile parity** — ⏸ **I8**, report only.

---

## 12. Status table

| ✔ | ID | Item | Stage | Status | Note |
|---|---|---|---|---|---|
| [x] | U1 | Licensed PSGC-keyed barangay centroid dataset? | S0 | ✅ **RESOLVED 2026-10-17 — YES** | **41,972/42,046 join = 99.8%**; 96.2% exact/correspondence HDX geometry; **0.2% flagged unverified**, which is where all 3 implausible rows sit; 2 of 42,010 equal the parent city. Data **CC BY-IGO** (MIT covers only the package code). Measured by `.plans/scripts/barangay-centroid-probe.py`. ⚠️ **Reverses this plan's own first answer** ("~28% usable") — that was an inference, not a measurement |
| [ ] | U2 | Hosted `barangay_code` coverage | — | ⬜ OPEN — the user's | Local is 14/14; hosted unmeasured. Query in §4 |
| [x] | B1 | Tier ladder cannot be extended safely — magic `3` in four places | S1 | ✅ **DONE 2026-10-17** | One `TIER` map, `NearTier` + `TIERS` derived, all 7 literals named. Verified: test file green **unmodified** (15/15), suite 272/272, tsc clean, **1,600-case differential vs the pre-refactor file**. ⚠️ Does **not** resolve B2 |
| [x] | B2 | "Narrowest tier is unorderable" becomes wrong | S4 | ⬜ TODO | If missed, city-tier ordering stays dead and the feature delivers nothing |
| [ ] | B3 | Device-derived place must never apply silently | S6 | ⬜ TODO | Nearest-centroid is a guess; `BookerLocation` must record *how* it was set |
| [ ] | B4 | `geolocation=()` blocks the API for every origin | S6 | ⬜ TODO — **G2** | `next.config.ts:243`. Fails looking like the booker declined |
| [x] | I1 | `barangay_code` must reach booker at all | S2 | ⬜ TODO | Optional on `RankableVendor` so nothing existing breaks |
| [x] | I2 | Picker barangay level — **per-city** loader, a new pattern | S3 | ⬜ TODO | 1,634 shards, ~700–1,400 B each. Do not copy the single-file city loader |
| [x] | I3 | `BookerLocation` widening, backward-compatible | S3 | ⬜ TODO | Optional fields, or every remembered city is discarded (V9) |
| [ ] | I4 | Reuse `centroidOf`; don't fork a barangay module | S5 | ⬜ TODO | Already code-agnostic (V5) |
| [ ] | I5 | Count-of-1 barangay must not render | S5 | ⬜ TODO | near-me **F27**; structural, with a test. **D4 fixed the threshold at ≥ 2** — below it, fall back to the city level |
| [x] | I6 | Tier labels shift; barangay needs its own | S4 | ⬜ TODO | ⚠️ `displayCityName` does not apply to barangay names |
| [x] | I7 | Existing tier tests are the safety net | S1, S4 | ⬜ TODO | Green through S1; deliberately updated in S4 |
| [ ] | I8 | Mobile parity | — | ⬜ **REPORT ONLY** | Not closed by this plan |
| [ ] | I9 | A barangay centroid must carry its provenance | S5 | ⬜ TODO — **REQUIRED** (D5=(b) resolved 2026-10-17) | 0.2% of rows are `fallback_unverified` and that is where all 3 implausible rows live (one **385 km** from its parent city). One exclusion removes them all; the plain table shape cannot express it. Structural, like near-me B5. The exact filter is tabulated at I9 |
| [x] | D1–D4 | Tier representation · picker shape · device scope · density gate | — | ✅ **RESOLVED 2026-10-17** | §7, each as recommended: (a) numeric + named constants · optional barangay · city-first device suggestion · ship gated at **≥ 2**. 🤖 The ≥ 2 threshold was set by me when recording D4, not asked — override if you want headroom |
| [x] | D5 | **The S5 trust filter** | — | ✅ **RESOLVED (b)** 2026-10-17 | Exclude `fallback_unverified`, carry provenance per row, degrade the rest to the city tier. Decided on U1's measurement, which ruled out (a) abort and (c) re-source. Makes **I9** required and settles **G3**'s shape |
| [x] | F1 | Barangay choice was invisible — chip now shows `Bel-Air · Makati City` | — | ✅ **DONE 2026-10-17** | §6b. Option (a), user's call. Truncates rather than widening; comma in the accessible name; still a pure display component. ⚠️ Barangay form unseen in a browser → F2 |
| [x] | F2 | The location picker had **no** visual baseline; three fixtures + 6 baselines added | — | ✅ **DONE 2026-10-17** | §6b. Full suite **112 passed**, exit 0. ⚠️ The baselines caught a design defect (60 shouting pills) and a hover state nearly recorded as truth — see **F5** |
| [x] | F5 | The barangay affordance was visually wrong; a hover state nearly became a baseline | — | ✅ **FIXED 2026-10-17** | §6b. Both found by *looking* at the new baselines — neither is reachable by tsc, lint or a unit test |
| [x] | F3 | booker gained 1,634 files / 6.6 MB of barangay shards | S3 | ✅ RECORDED | §6b. Verified identical to vendor's by `diff -r`; drift warning in `phAddress.ts` + `booker/AGENTS.md` |
| [x] | F4 | Loader derived rather than reset, to hold the 18-problem lint baseline | S3 | ✅ FIXED | §6b. The rewrite also removed a stale-data frame on city switch |
| [ ] | G1 | Execution approval | before S1 | ⬜ **NOT GIVEN** | ✅ Nothing blocks it — all five decisions resolved 2026-10-17. **This is now the next action on the plan** |
| [ ] | G2 | `geolocation=(self)` | S6 | ⬜ NOT GIVEN | Security header, own approval |
| [ ] | G3 | Barangay centroid asset (generated, with provenance) | S5 | ⬜ **NOT GIVEN** — shape settled by D5=(b) | U1 confirms the source: 99.8% coverage, CC BY-IGO. ⚠️ Attribution owed; generated by a script like `build-ph-city-centroids.py`, never a runtime dependency |
| — | — | Point-in-polygon · street geocoding · mobile | — | ⏸ / ✖ | Reasons in §11 |
