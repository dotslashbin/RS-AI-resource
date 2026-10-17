/*
 * Proof for S1 / B1 of .plans/2026-10-16-booker-barangay-near.md: naming the tier ladder's
 * rungs changed NO behaviour.
 *
 * WHY A GRID AND NOT JUST THE SUITE. `lib/nearby.test.ts` asserts tier numbers on hand-picked
 * cities, and it stayed green unmodified — which is the stage's acceptance test. But B1 is
 * called "the single most dangerous item in the plan" precisely because its failure mode is a
 * wrong answer that LOOKS right, and a dozen hand-picked cases is a thin net for that. This
 * sweeps every combination of city code x province code on both sides instead.
 *
 * HOW TO RUN  (the baseline file is the whole trick: it is the PRE-refactor nearby.ts, dropped
 * beside the current one so both can be imported at once, then thrown away)
 *
 *     cd booker
 *     git show <pre-refactor-ref>:lib/nearby.ts > lib/nearby.baseline.tmp.ts
 *     node --experimental-strip-types ../.plans/scripts/s1-tier-ladder-differential.ts
 *     gio trash lib/nearby.baseline.tmp.ts
 *
 * Result on 2026-10-17: rankTier 1,600 cases, tierLabel 288, ranking+grouping 24 — all identical.
 *
 * ⚠️ THIS SCRIPT EXPIRES AT S4, AND THAT IS NOT A BUG. S4 adds the barangay rung, which
 * renumbers every tier ON PURPOSE. A differential against a pre-S4 baseline MUST fail then —
 * if it passes, the new rung is not actually in the ladder. Use it for behaviour-preserving
 * refactors only; at S4 the test that matters is the suite's own deliberately-changed assertions.
 *
 * ⚠️ Paths are absolute because a file under .plans/scripts/ cannot resolve booker's relative
 * imports. Edit them if the workspace moves.
 */
import * as NEW from "/home/joshua/RS/booker/lib/nearby.ts"
import * as OLD from "/home/joshua/RS/booker/lib/nearby.baseline.tmp.ts"
import assert from "node:assert/strict"

const CODES = ["", "137602000", "137404000", "045402000", "043404000", "112402000", "153817000", "999999000"]
const PROV = ["", "NCR", "0434", "1124", "1538"]
const NAMES = ["City of Makati", "Davao City", ""]

let tierChecks = 0, labelChecks = 0
for (const vc of CODES) for (const vp of PROV) for (const lc of CODES) for (const lp of PROV) {
  const vendor = { cityCode: vc, provinceCode: vp }
  const loc = { cityCode: lc, provinceCode: lp, cityName: NAMES[0], provinceName: lp || null } as never
  assert.equal(NEW.rankTier(vendor, loc), OLD.rankTier(vendor, loc), `rankTier ${vc}/${vp} vs ${lc}/${lp}`)
  tierChecks++
}
for (const tier of [0, 1, 2, 3] as const) for (const lc of CODES) for (const cn of NAMES) for (const pn of [null, "Metro Manila", "Laguna"]) {
  const loc = { cityCode: lc, provinceCode: "", cityName: cn, provinceName: pn } as never
  assert.equal(NEW.tierLabel(tier, loc), OLD.tierLabel(tier, loc), `tierLabel ${tier} ${lc} ${cn} ${pn}`)
  labelChecks++
}
assert.deepEqual(NEW.TIERS, OLD.TIERS, "TIERS must be the same array, in the same order")
assert.deepEqual(NEW.TIERS, [0, 1, 2, 3], "derived TIERS must still be narrowest-first")

/* ranking + grouping, including the no-vendor fallback that used the bare literal 3 */
const CENTROIDS = { "137602000": [14.5547, 121.0244], "045402000": [14.2785, 121.1733] } as never
const items = [
  { id: "a", v: { cityCode: "137602000", provinceCode: "NCR" } },
  { id: "b", v: { cityCode: "045402000", provinceCode: "0434" } },
  { id: "c", v: { cityCode: "", provinceCode: "" } },
  { id: "d", v: undefined },
  { id: "e", v: { cityCode: "112402000", provinceCode: "1124" } },
]
for (const lc of CODES) for (const centroids of [undefined, null, CENTROIDS]) {
  const loc = { cityCode: lc, provinceCode: "NCR", cityName: "City of Makati", provinceName: "Metro Manila" } as never
  const n = NEW.rankByProximity(items, loc, i => i.v, centroids).map(i => i.id)
  const o = OLD.rankByProximity(items, loc, i => i.v, centroids).map(i => i.id)
  assert.deepEqual(n, o, `rankByProximity ${lc}`)
  assert.deepEqual(
    NEW.groupByTier(items, loc, i => i.v).map(g => [g.tier, g.label, g.items.length]),
    OLD.groupByTier(items, loc, i => i.v).map(g => [g.tier, g.label, g.items.length]),
    `groupByTier ${lc}`)
}
console.log(`PASS — rankTier ${tierChecks} cases, tierLabel ${labelChecks} cases, ranking+grouping ${CODES.length * 3} combos: identical`)
