"""Build `booker/public/ph-city-centroids.json` — plan 2026-10-14, S3 step 2 (U3, G6b).

Offline. Reads two already-downloaded files and writes one JSON asset. It connects to
nothing, imports nothing outside the standard library, and executes no downloaded code
(the wheel is opened with `zipfile`, never imported).

    python3 -I -B .plans/scripts/build-ph-city-centroids.py \
        --wheel  <dir>/psgc-2026.4.13.0-py3-none-any.whl \
        --geonames <dir>/PH.txt \
        --cities booker/public/ph-address/cities.json \
        --out    booker/public/ph-city-centroids.json

Inputs, and why each one:

  * `psgc-2026.4.13.0-py3-none-any.whl` (PyPI, MIT) — carries HDX/OCHA admin-3 boundary
    centroids keyed by PSA's `correspondence_code`, which IS the 9-digit PSGC code this
    workspace stores in `vendors.city_code`. The coordinates themselves are the licensed
    data: OCHA HDX "Philippines - Subnational Administrative Boundaries" (COD-AB),
    sourced from NAMRIA + PSA, CC BY 3.0 IGO (verified at the HDX CKAN API, not from the
    package's own claim).
  * `PH.txt` from GeoNames' `PH.zip` (CC BY 4.0) — used ONLY as an independent check.
    GeoNames' `admin3_code` column is also the 9-digit PSGC code, which makes it a second,
    unrelated PSGC-keyed source. One coordinate is taken from it (see OVERRIDES).

⚠️ EVERY CHECK BELOW IS AN ASSERTION, not a print. This script's job is not to produce a
file; it is to refuse to produce a wrong one. A centroid dataset fails silently — an
inverted latitude or a mismatched code yields plausible coordinates that order vendors
wrongly with nothing on screen to show it.
"""

import argparse
import collections
import json
import math
import zipfile

# Philippine territory, generously bounded. The Kalayaan Island Group (Spratlys,
# `175324000`) is the western outlier at ~114.28E, so the box must reach past it.
PH_BBOX = (4.0, 21.5, 113.9, 127.5)  # lat min/max, lng max/min

# Decimal places kept. 4 dp is ~11 m — three orders of magnitude finer than the thing
# being measured (city-to-city distance), and it halves the file against full precision.
DP = 4

# Rows where the HDX-derived centroid is PROVABLY wrong and an independent PSGC-keyed
# source is available. Each needs a reason that can be checked by someone else.
#
# `153817000` South Upi, Maguindanao del Sur: the HDX-derived value is byte-identical to
# Pagagawan's — the only duplicated coordinate in all 1,634 rows — and sits 74 km from
# Upi, the municipality South Upi was carved out of. Both the duplicate-coordinate check
# and the GeoNames cross-check flag this same row and nothing else. Taken from GeoNames
# ADM3 (CC BY 4.0) instead.
OVERRIDES = {"153817000": "geonames"}

def haversine_km(lat1, lng1, lat2, lng2):
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    h = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2)
    return 2 * r * math.asin(math.sqrt(h))


def read_hdx(wheel_path):
    """`correspondence_code` -> (name, lat, lng), from the wheel's bundled city table."""
    with zipfile.ZipFile(wheel_path) as z:
        rows = json.loads(z.read("psgc/data/core/cities.json"))
    out = {}
    for r in rows:
        code = r.get("correspondence_code")
        coord = r.get("coordinate")
        if not code or not coord:
            continue
        # A duplicated correspondence_code would make the join ambiguous; there are none,
        # and if that ever changes this must fail rather than pick one.
        assert code not in out, f"duplicate correspondence_code {code}"
        out[code] = (r["name"], coord["latitude"], coord["longitude"])
    return out


def read_geonames(path):
    """`admin3_code` -> (name, lat, lng), from GeoNames' ADM3 rows."""
    out = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            f = line.rstrip("\n").split("\t")
            if len(f) < 13 or f[7] != "ADM3" or not f[12]:
                continue
            out.setdefault(f[12], (f[1], float(f[4]), float(f[5])))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wheel", required=True)
    ap.add_argument("--geonames", required=True)
    ap.add_argument("--cities", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    hdx = read_hdx(args.wheel)
    gn = read_geonames(args.geonames)
    with open(args.cities, encoding="utf-8") as fh:
        cities = json.load(fh)

    print(f"our cities: {len(cities)}   hdx rows: {len(hdx)}   geonames ADM3: {len(gn)}")

    # ---- 1. Coverage. Every city we can store must resolve, or the stage does not ship.
    missing = [c["code"] for c in cities if c["code"] not in hdx]
    assert not missing, f"{len(missing)} of our city codes have no centroid: {missing[:10]}"
    print(f"1. coverage: {len(cities)}/{len(cities)} = 100%")

    # ---- 2. Names agree, which is what proves the CODE join is the right join.
    def norm(s):
        s = s.lower().replace("city of ", "").replace(" city", "")
        return "".join(ch if ch.isalnum() else " " for ch in s).split()

    disagree = [(c["code"], c["name"], hdx[c["code"]][0])
                for c in cities if norm(c["name"]) != norm(hdx[c["code"]][0])]
    # Four known renamings between our dataset's vintage and PSA Q1 2026. More than a
    # handful would mean the join is wrong, not that the Philippines renamed things.
    assert len(disagree) <= 6, f"{len(disagree)} name disagreements — join is suspect"
    print(f"2. name agreement: {len(cities) - len(disagree)}/{len(cities)}"
          f"  ({len(disagree)} known renamings: {[d[1] for d in disagree]})")

    # ---- 3. Build, with overrides, rounded.
    centroids = {}
    applied = {}
    for c in cities:
        code = c["code"]
        if OVERRIDES.get(code) == "geonames":
            assert code in gn, f"override for {code} but GeoNames has no ADM3 row"
            _, lat, lng = gn[code]
            applied[code] = c["name"]
        else:
            _, lat, lng = hdx[code]
        centroids[code] = [round(lat, DP), round(lng, DP)]
    print(f"3. overrides applied: {applied}")

    # ---- 4. Everything is inside Philippine territory. Catches an inverted tuple at once:
    # a swapped Manila would be (120.98, 14.59), which is not in the box.
    for code, (lat, lng) in centroids.items():
        assert PH_BBOX[0] <= lat <= PH_BBOX[1] and PH_BBOX[2] <= lng <= PH_BBOX[3], \
            f"{code} outside PH: {lat},{lng}"
    print("4. bbox: all 1,634 inside Philippine territory")

    # ---- 5. No two cities share a coordinate. This is the check that found South Upi,
    # and it also catches rounding collapsing two genuinely distinct neighbours.
    dup = collections.defaultdict(list)
    for code, pair in centroids.items():
        dup[tuple(pair)].append(code)
    shared = {k: v for k, v in dup.items() if len(v) > 1}
    assert not shared, f"coordinate shared by 2+ cities: {list(shared.items())[:5]}"
    print("5. uniqueness: no coordinate is shared by two cities")

    # ---- 6. Same-named municipalities land in different places. V7's 114 duplicate names
    # are the cases where a name-matched dataset would have failed silently.
    by_name = collections.defaultdict(list)
    for c in cities:
        by_name[c["name"]].append(c["code"])
    dups = {k: v for k, v in by_name.items() if len(v) > 1}
    worst = min(
        (haversine_km(*centroids[a], *centroids[b]), name, a, b)
        for name, codes in dups.items()
        for i, a in enumerate(codes) for b in codes[i + 1:]
    )
    assert worst[0] > 5, f"two same-named municipalities are {worst[0]:.1f} km apart: {worst}"
    print(f"6. {len(dups)} duplicate names: closest same-named pair is "
          f"{worst[0]:.1f} km apart ({worst[1]})")

    # ---- 7. Independent cross-check against GeoNames, reported as a distribution.
    deltas = sorted(
        haversine_km(*centroids[c["code"]], gn[c["code"]][1], gn[c["code"]][2])
        for c in cities if c["code"] in gn and c["code"] not in OVERRIDES
    )
    n = len(deltas)
    med, p90, p99 = deltas[n // 2], deltas[int(n * 0.90)], deltas[int(n * 0.99)]
    assert med < 5, f"median disagreement with GeoNames is {med:.1f} km — one source is wrong"
    print(f"7. vs GeoNames over {n} cities: median {med:.2f} km, p90 {p90:.2f}, "
          f"p99 {p99:.2f}, max {deltas[-1]:.1f}, >25km {sum(1 for d in deltas if d > 25)}")

    # ---- 8. Absolute pins against figures from outside both datasets. The tolerance is
    # wide on purpose: these are centroid-to-centroid, while published city-to-city
    # figures are landmark-to-landmark, and for a territorially huge city like Davao the
    # two differ by tens of kilometres. The pin is here to catch a wrong ORDER OF
    # MAGNITUDE or an inverted tuple, not to measure anything.
    for a, b, expect, label in [
        ("133900000", "072217000", 572, "Manila - Cebu City"),
        ("133900000", "112402000", 972, "Manila - Davao City"),
    ]:
        got = haversine_km(*centroids[a], *centroids[b])
        assert abs(got - expect) / expect < 0.08, f"{label}: expected ~{expect} km, got {got:.1f}"
        print(f"8. {label}: {got:.1f} km (published ~{expect})")

    # Two adjacent Metro Manila cities: close, but not the same place. An upper bound
    # catches a mismatched code, a lower bound catches rounding collapsing them together.
    adjacent = haversine_km(*centroids["137602000"], *centroids["137607000"])
    assert 2 < adjacent < 15, f"Makati - Taguig is {adjacent:.1f} km apart"
    print(f"8. Makati - Taguig (adjacent): {adjacent:.1f} km")

    # ---- 9. Geographic orientation. Independent of any distance, and the one check an
    # inverted [lng, lat] tuple cannot survive: Manila is north of Cebu is north of
    # Davao, and west of both.
    man, ceb, dav = centroids["133900000"], centroids["072217000"], centroids["112402000"]
    assert man[0] > ceb[0] > dav[0], f"latitudes out of order: {man[0]}, {ceb[0]}, {dav[0]}"
    assert man[1] < ceb[1] < dav[1], f"longitudes out of order: {man[1]}, {ceb[1]}, {dav[1]}"
    print(f"9. orientation: Manila {man} N/W of Cebu {ceb} N/W of Davao {dav}")

    payload = {
        "source": "OCHA HDX - Philippines Subnational Administrative Boundaries (COD-AB), admin level 3",
        "sourceUrl": "https://data.humdata.org/dataset/cod-ab-phl",
        "licence": "CC BY 3.0 IGO",
        "licenceUrl": "http://creativecommons.org/licenses/by/3.0/igo/legalcode",
        "attribution": (
            "Administrative boundary centroids derived from the OCHA HDX Philippines "
            "Subnational Administrative Boundaries (COD-AB) dataset, sourced from NAMRIA "
            "and the Philippine Statistics Authority, licensed CC BY 3.0 IGO. Area-weighted "
            "centroids computed by the psgc package (MIT). PSGC codes and names: PSA, public "
            "information under RA 10625. One coordinate (South Upi, 153817000) is from "
            "GeoNames (CC BY 4.0)."
        ),
        "generated": "2026-10-16",
        "coordinateOrder": "[latitude, longitude]",
        "count": len(centroids),
        "centroids": dict(sorted(centroids.items())),
    }
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, separators=(",", ":"), ensure_ascii=False)
        fh.write("\n")
    print(f"\nwrote {args.out}: {len(centroids)} centroids")


if __name__ == "__main__":
    main()
