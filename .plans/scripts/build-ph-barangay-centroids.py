"""Build `booker/public/ph-barangay-centroids/<cityCode>.json` — plan 2026-10-16, S5 (G3, D5, I9).

Offline. Reads three already-present inputs and writes one shard per city. It connects to
nothing, imports nothing outside the standard library, and executes no downloaded code —
⚠️ **the wheel is opened with `zipfile`, never imported**, which is why this needs no venv
at all (the U1 probe did, and that was the more dangerous shape).

    python3 -I -B .plans/scripts/build-ph-barangay-centroids.py \
        --wheel          <dir>/psgc-2026.4.13.0-py3-none-any.whl \
        --barangays      booker/public/ph-address/barangays \
        --city-centroids booker/public/ph-city-centroids.json \
        --out            booker/public/ph-barangay-centroids

WHY SHARDS AND NOT ONE FILE (this is the design decision, recorded here because the plan's
G3 said "a table", modelled on the city one):

  * The city table is ONE file because it is 1,634 rows / 50 KB, and ranking needs every
    city at once — vendors span the country.
  * Barangays are 42,046 rows. One file would be ~1.7 MB, and **a booker would download all
    of it to order the vendors in one city**. The gradient only ever applies WITHIN the
    booker's own city (plan S5): other tiers are ordered by city centroid, exactly as
    before. So the only shard anyone ever needs is their own city's — ~1 KB.
  * The per-city delivery shape already exists for barangay NAMES (plan I2), so this is the
    established pattern in this app rather than a new one.

D5 = (b), THE TRUST FILTER (resolved 2026-10-17). `fallback_unverified` rows are EXCLUDED:
0.2% of the package's rows carry that flag and all three spatially implausible rows live
there, one 384.9 km from its own parent city. The other four provenance values are kept and
⚠️ **shipped per row** (I9) — the consumer re-checks them, so the invariant survives a future
rebuild that forgets this filter.

⚠️ EVERY CHECK BELOW IS AN ASSERTION, not a print, for the reason the city script gives: a
centroid dataset fails SILENTLY. A wrong row yields plausible coordinates that order vendors
incorrectly with nothing on screen to show it.
"""

import argparse
import collections
import glob
import json
import math
import os
import zipfile

# Philippine territory, generously bounded — identical to the city script's box.
PH_BBOX = (4.0, 21.5, 113.9, 127.5)

# 4 dp is ~11 m. A barangay is hundreds of metres across, so this is still far finer than
# the thing being measured, and it keeps the shards small.
DP = 4

# ⚠️ THE D5 FILTER, AS ONE TABLE. The letter is what ships per row (I9); a source absent
# from this map is excluded from the asset entirely.
TRUSTED_SOURCES = {
    "hdx_exact_2023": "e",
    "hdx_correspondence_2023": "c",
    "hdx_name_parent_2023": "n",
    "merged_hdx_area_weighted_2026q1": "m",
}
EXCLUDED_SOURCES = {"fallback_unverified"}

# ⚠️ WHOLE CITIES WHOSE HDX GEOMETRY IS MISPLACED, so every barangay derived from it is too.
# D5's provenance filter cannot catch these: the rows are labelled `hdx_exact_2023`, which is
# the package's own label and the residual risk U1 recorded. The distance check (7) is what
# actually finds them.
#
# `153817000` South Upi, Maguindanao del Sur — the SAME row the city script overrides, for
# the same reason, one level down. Measured 2026-10-17: its 11 barangays cluster 3-7 km around
# HDX's city centroid for South Upi, which is **74.1 km** from the GeoNames point this
# workspace ships as South Upi (`ph-city-centroids.json`, CC BY 4.0 override). Published
# references put South Upi at ~6.75N, matching GeoNames; HDX's 7.06N/124.77E sits ~70 km east
# of it, and HDX's South Upi centroid is byte-identical to Pagagawan's — i.e. the HDX unit
# itself is in the wrong place, and everything computed from it inherits that.
# Excluding them means those vendors fall back to the city centroid, which is the corrected
# one. That is the honest degrade; shipping a barangay point 74 km from its own city is not.
EXCLUDED_CITIES = {"153817000": "HDX unit misplaced; city centroid overridden from GeoNames"}

ATTRIBUTION = (
    "Barangay centroids derived from the OCHA HDX Philippines Subnational Administrative "
    "Boundaries (COD-AB) dataset, sourced from NAMRIA and the Philippine Statistics "
    "Authority, licensed CC BY 3.0 IGO. Centroids computed by the psgc package (MIT). "
    "PSGC codes and names: PSA, public information under RA 10625."
)

# Rows whose coordinate equals the parent city's. Measured at 2 of 42,010 across the whole
# package (plan U1); the asset may carry a couple, and a couple is not a pattern. A jump
# here means the join broke and city centroids are being shipped as barangays.
MAX_PARENT_DUPLICATES = 5

# After the D5 filter, nothing should sit absurdly far from its own city. Measured maxima
# per trusted source were 51.9 / 47.3 / 43.5 km; 60 leaves headroom without admitting the
# 384.9 km row the filter removes.
MAX_KM_FROM_PARENT = 60.0


def haversine_km(lat1, lng1, lat2, lng2):
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    h = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2)
    return 2 * r * math.asin(math.sqrt(h))


def read_package_barangays(wheel_path):
    """`correspondence_code` -> (name, lat, lng, source), from the wheel's bundled table.

    ⚠️ KEYED ON `correspondence_code`, THE 9-DIGIT FORM — never on the package's own
    10-digit `psgc_code`. `vendors.barangay_code` and `public/ph-address/barangays/` both
    hold the 9-digit code, and joining on the wrong one silently yields ~0% coverage. This
    is the near-me F9/F10 trap, one level down.
    """
    with zipfile.ZipFile(wheel_path) as z:
        rows = json.loads(z.read("psgc/data/core/barangays.json"))
    out = {}
    for r in rows:
        code = r.get("correspondence_code")
        coord = r.get("coordinate") or {}
        if not code or coord.get("latitude") is None:
            continue
        assert code not in out, f"duplicate correspondence_code {code}"
        out[code] = (r.get("name", ""), coord["latitude"], coord["longitude"],
                     r.get("coordinate_source") or "")
    return out


def read_our_barangays(shard_dir):
    """`cityCode` -> [{code, name}], the codes this app actually ships."""
    out = {}
    for path in sorted(glob.glob(os.path.join(shard_dir, "*.json"))):
        city_code = os.path.splitext(os.path.basename(path))[0]
        with open(path, encoding="utf-8") as fh:
            out[city_code] = json.load(fh)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wheel", required=True)
    ap.add_argument("--barangays", required=True)
    ap.add_argument("--city-centroids", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    pkg = read_package_barangays(args.wheel)
    ours = read_our_barangays(args.barangays)
    with open(args.city_centroids, encoding="utf-8") as fh:
        city_centroids = json.load(fh)["centroids"]

    total_ours = sum(len(v) for v in ours.values())
    print(f"our barangays: {total_ours} across {len(ours)} cities   package rows: {len(pkg)}")

    # ---- 1. Join coverage, counted rather than assumed (plan U1 measured 99.8%).
    joined = [b["code"] for rows in ours.values() for b in rows if b["code"] in pkg]
    coverage = len(joined) / total_ours
    assert coverage > 0.99, f"join coverage is only {coverage:.1%} — wrong key?"
    print(f"1. join coverage: {len(joined)}/{total_ours} = {coverage:.1%}")

    # ---- 2. The D5 filter, applied and counted.
    src_counts = collections.Counter(pkg[c][3] for c in joined)
    unknown = set(src_counts) - set(TRUSTED_SOURCES) - EXCLUDED_SOURCES
    assert not unknown, f"unknown coordinate_source values: {unknown} — D5 never ruled on these"
    dropped = sum(n for s, n in src_counts.items() if s in EXCLUDED_SOURCES)
    print("2. provenance of joined rows:")
    for s, n in src_counts.most_common():
        mark = "EXCLUDED" if s in EXCLUDED_SOURCES else f"kept as '{TRUSTED_SOURCES[s]}'"
        print(f"     {s:<34} {n:>6}  {mark}")

    # ---- 3. Build the shards. A barangay with no trusted centroid is simply ABSENT; the
    # consumer falls back to the city centroid for it (never to a guess, never to Infinity).
    shards, kept = {}, 0
    for city_code, rows in ours.items():
        table = {}
        for b in rows:
            if city_code in EXCLUDED_CITIES:
                continue
            hit = pkg.get(b["code"])
            if not hit or hit[3] not in TRUSTED_SOURCES:
                continue
            _, lat, lng, source = hit
            table[b["code"]] = [round(lat, DP), round(lng, DP), TRUSTED_SOURCES[source]]
        if table:
            shards[city_code] = table
            kept += len(table)
    city_dropped = sum(len(ours.get(c, [])) for c in EXCLUDED_CITIES)
    print(f"3. shards: {len(shards)} cities, {kept} barangays "
          f"({total_ours - kept} absent: {dropped} excluded by D5, "
          f"{city_dropped} in misplaced-geometry cities, "
          f"{total_ours - kept - dropped - city_dropped} not in the package)")

    # ---- 4. Inside Philippine territory. Catches an inverted tuple instantly.
    for city_code, table in shards.items():
        for code, (lat, lng, _) in table.items():
            assert PH_BBOX[0] <= lat <= PH_BBOX[1] and PH_BBOX[2] <= lng <= PH_BBOX[3], \
                f"{code} outside PH: {lat},{lng}"
    print(f"4. bbox: all {kept} inside Philippine territory")

    # ---- 5. THE INVARIANT `rankTier` ACTUALLY RELIES ON: a barangay code identifies exactly
    # one barangay nationally, so comparing two bare codes cannot match across cities.
    #
    # ⚠️ IT IS NOT A PREFIX RULE, AND THIS CHECK IS WHAT PROVED THAT. The first version
    # asserted `code[:6] == city_code[:6]` and failed on `133901001` — the **City of Manila**
    # (`133900000`), whose 897 barangays are numbered under its SIX DISTRICTS (`133901`…
    # `133906`), not under the city's own `133900`. Exactly one city in 1,634 behaves this
    # way, which is precisely the kind of lone exception a prefix assumption survives in
    # testing and dies on in production. Measured 2026-10-17: 42,046 codes, 0 appearing in
    # more than one city, and the first FOUR digits (region + province) always agree.
    all_codes = collections.Counter()
    for city_code, table in shards.items():
        for code in table:
            all_codes[code] += 1
            assert code[:4] == city_code[:4], \
                f"{code} is not even in city {city_code}'s province"
    shared = {c: n for c, n in all_codes.items() if n > 1}
    assert not shared, f"a barangay code appears in two cities: {list(shared)[:5]}"
    manila = sum(1 for c in shards.get("133900000", {}) if c[:6] != "133900")
    print(f"5. uniqueness: {len(all_codes)} codes, none shared across cities "
          f"(⚠️ {manila} Manila barangays are coded under districts, not the city)")

    # ---- 6. THE "CITY CENTROID IN DISGUISE" TEST — the one that killed U1's first answer.
    disguised = [
        (code, city_code)
        for city_code, table in shards.items() if city_code in city_centroids
        for code, (lat, lng, _) in table.items()
        if [lat, lng] == [round(city_centroids[city_code][0], DP),
                          round(city_centroids[city_code][1], DP)]
    ]
    assert len(disguised) <= MAX_PARENT_DUPLICATES, \
        f"{len(disguised)} barangays carry their parent CITY's coordinate: {disguised[:5]}"
    print(f"6. parent-city duplicates: {len(disguised)} (max tolerated {MAX_PARENT_DUPLICATES})")

    # ---- 7. Plausibility: distance from each barangay to its own city centroid. This is
    # the check the D5 filter exists to pass — before it, one row sat 384.9 km out.
    deltas = sorted(
        haversine_km(lat, lng, *city_centroids[city_code])
        for city_code, table in shards.items() if city_code in city_centroids
        for lat, lng, _ in table.values()
    )
    n = len(deltas)
    assert deltas[-1] <= MAX_KM_FROM_PARENT, \
        f"a barangay sits {deltas[-1]:.1f} km from its own city — filter or override is wrong"

    # ⚠️ AND THE CONVERSE: an override that is no longer needed must not quietly outlive its
    # cause. If a future package vintage fixes South Upi, this fails and asks to be removed
    # rather than silently dropping 11 good rows for ever.
    for city_code, reason in EXCLUDED_CITIES.items():
        rows = [b["code"] for b in ours.get(city_code, []) if b["code"] in pkg]
        still_bad = [
            c for c in rows
            if city_code in city_centroids
            and haversine_km(pkg[c][1], pkg[c][2], *city_centroids[city_code]) > MAX_KM_FROM_PARENT
        ]
        assert still_bad, (
            f"EXCLUDED_CITIES[{city_code}] is no longer justified ({reason}) — "
            f"its barangays now sit within {MAX_KM_FROM_PARENT} km. Re-check and remove it."
        )
        print(f"7b. exclusion still justified: {city_code} — {len(still_bad)}/{len(rows)} "
              f"barangays >{MAX_KM_FROM_PARENT:.0f} km from their own city")
    print(f"7. distance to parent city over {n}: median {deltas[n // 2]:.2f} km, "
          f"p95 {deltas[int(n * 0.95)]:.2f}, max {deltas[-1]:.2f}")

    # ---- 8. Within one city, two barangays sharing a coordinate would collapse the
    # ordering this asset exists to provide — report as a rate, fail if it is systemic.
    collisions = 0
    for table in shards.values():
        seen = collections.Counter((lat, lng) for lat, lng, _ in table.values())
        collisions += sum(c - 1 for c in seen.values() if c > 1)
    assert collisions / kept < 0.001, f"{collisions} intra-city coordinate collisions"
    print(f"8. intra-city collisions: {collisions}/{kept} = {collisions / kept:.3%}")

    # ---- 9. An absolute pin from outside both datasets: Bel-Air and Poblacion are both in
    # Makati and are roughly 2-4 km apart. Catches a wrong order of magnitude.
    makati = shards.get("137602000", {})
    if "137602002" in makati and "137602016" in makati:
        d = haversine_km(makati["137602002"][0], makati["137602002"][1],
                         makati["137602016"][0], makati["137602016"][1])
        assert 0.2 < d < 8, f"two Makati barangays are {d:.1f} km apart"
        print(f"9. pin: Makati 137602002 - 137602016 = {d:.2f} km")

    # ---- write only now that everything above passed.
    os.makedirs(args.out, exist_ok=True)
    for city_code, table in shards.items():
        with open(os.path.join(args.out, f"{city_code}.json"), "w", encoding="utf-8") as fh:
            json.dump({"attribution": ATTRIBUTION, "centroids": table}, fh,
                      ensure_ascii=False, separators=(",", ":"))
    size = sum(os.path.getsize(os.path.join(args.out, f)) for f in os.listdir(args.out))
    print(f"\nwrote {len(shards)} shards to {args.out} — {size / 1e6:.2f} MB total, "
          f"{size / len(shards):.0f} B average")


if __name__ == "__main__":
    main()
