# EzzyShots division — correct the slug, make it a first-class division in Booker

**Date:** 2026-11-16
**App / scope:** `booker/` (code), `vendor/` (one test line), `.plans/previews/booker-home-divisions-layout/` (3D icon source), hosted `public.divisions` data (user-run SQL). No migration, no `command/`, no `backbone/` file.
**Status:** IN PROGRESS (approved 2026-11-16; Stages 1–3 done 2026-11-17; commits with the user; Stage 4 next) — release: staging ⬜ · production ⬜

> Make **EzzyShots** (`ezzy-shots`) a division that works the same as the other thirteen:
> listed, coloured, filterable and searchable in Booker, and selectable at Vendor sign-up. The
> priority is matching the existing 13-division patterns, not inventing new ones.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** R# = read-only pre-check · I# = Important build item · D# = Decision ·
> F# = Finding · S# / P# = staging / production release step. Numbers are plan-local; qualify
> cross-plan refs by app or plan (e.g. "divisions-layout I11").

---

## ▶ RESUME HERE (updated 2026-11-17, end of Stage 3)
- **Done so far:** plan approved 2026-11-16. **Stage 1** (DSLR 3D icon), **Stage 2** (Booker I1–I6) and **Stage 3** (I7 Vendor test, I8 docs) complete. Commit drafts handed over: three repos (booker, vendor, root). 👤 The user commits; nothing is committed by an agent.
- **Verified (machine):** Booker `npm test` 338/338, `tsc` clean, lint 18 (pre-existing), visual 209/209. Vendor 583/583, lint 0/0, `tsc` clean. **Not yet seen against real data**: that is S3/S4 on staging.
- **Live where:** local — all changes in working trees, awaiting the user's commits · staging — EzzyShots row with a wrong slug (assumed; R1 confirms) · production — unknown (R1 confirms).
- **Next:** **Stage 4 (👤)** — R1 on staging, then the slug-fix SQL (S1), *then* deploy Booker to staging (S2), then S3 (Vendor dropdown and deep link) and S4 (Booker checks). Order matters: see "Safe and unsafe states" under Release.
- **Waiting on the user:** the three commits; R1 and S1–S4.
- **Watch out for:**
  - `DivisionIcon3d.tsx` is **generated**. Never hand-edit it. Edit the preview's `icons3d.js` and re-run the exporter (I3).
  - Adding the slug to `DIVISION_SLUGS` breaks `tsc` until the 3D drawing exists (`Record<DivisionSlug, …>`). I1 and I3 land together.
  - The `-bg` / `-fg` tokens are **retired** (booker `AGENTS.md` → "Division colours and icons"). Do not define them for the new slug (I2).

---

## Investigation findings (2026-11-16)

Baseline before any change: booker `npm test` **336/336 pass**, `npx tsc --noEmit` clean;
vendor `lib/slug.test.ts` **4/4 pass**. Lint baseline is captured at the start of Stage 2.

- **F1 — Probable cause of the wrong slug.** `command/lib/utils.ts:9` `slugify()` only puts hyphens where the name has spaces or symbols, so `"EzzyShots"` → **`ezzyshots`**. Command cannot edit a slug afterwards (`command/services/divisions.service.ts:35` only updates `name`), so SQL is the only way to fix it. Every future camel-case name will hit the same thing → deferred item, below.
- **F2 — No schema dependency on the slug.** `public.divisions` (`backbone/supabase/migrations/20260724000004_divisions.sql:11-19`): `slug text not null unique`, no enum or check. The only foreign key is `vendors.division_id` → `divisions.id`. The only trigger is `set_divisions_updated_at`. No other migration, function or view refers to the table. **No migration needed.**
- **F3 — Booker hardcodes its division list.** `booker/lib/divisions.ts:17-20` (`DIVISION_SLUGS`) and `:43-57` (`DIVISIONS`). The Home strip (`components/home/DivisionStrip/DivisionStrip.tsx:45`), Explore's chips (`components/explore/ExplorePage/useExplorePage.ts:296`), the search overlay and `matchDivision` all read the constant. The database supplies only each vendor's own `divisions(slug, name)` (`services/offerings.service.ts:73`, `services/bookings.service.ts:120`).
- **F4 — Unknown slugs fail safe, and are impossible to filter on.** `divisionKey()` (`lib/divisions.ts:34-38`) maps any slug that isn't listed to `"none"`. So today an EzzyShots vendor appears in search with a neutral badge, the label "Shots" and the monogram "ES". But `lib/search.ts:113` compares `divisionKey(v.divisionSlug)`, so a division filter can never match it.
- **F5 — Hardcoded counts that a fourteenth division breaks.**
  - `lib/divisions.test.ts:27-29` (13).
  - `lib/palette.test.ts:171, 202, 203` (14 = 13 + neutral).
  - `visual-tests/home-layout.spec.ts:55` (`toBe(13)`).
  - `export-icons3d.mjs:23, 160` (13).
  - The loop-based tests (`divisionIcon.test.ts:25`, `divisionIcon3d.test.ts:29`, `divisionMatch.test.ts:69`) adapt by themselves.
- **F6 — Vendor reads divisions from the database.** `vendor/app/api/divisions/route.ts` returns active rows and `app/api/auth/register/route.ts:76` validates the id. The `?division=` link matches slugs ignoring case and hyphens (`vendor/lib/slug.ts`), so `?division=ezzy-shots` already resolves even before the slug fix. Divisions are vendor-level, so offerings never involve them. **No functional change.** The only hardcoded list is `vendor/lib/slug.test.ts:27-31`, which is also missing `ezzy-stay` (12 of 13).
- **F7 — Monogram collision.** With no logo file, EzzyShots falls back to the monogram **"ES"** (`lib/divisionIcon.ts:76-84`), the same as EzzyStay. EzzyStay has a logo, so the collision shows only when EzzyShots has none.
- **F8 — The row exists only as hosted data.** It is not in any migration or in `seed.sql`, so a local `db reset` has no EzzyShots and no EzzyShots vendor. Locally, only unit tests and the `/ui-gallery` fixtures (which render from the constant) can exercise it. Filtering against real rows is a staging check.

### Plan review (2026-11-16, before approval)

Checked against the docs and plans changed since 2026-11-01:
- `conventions.md` gained the set-state-in-effect patterns (vendor lint plan, 2026-11-16).
- `portals.md`, `schema.md`, `auth-and-roles.md` and `vendor-kyc.md` changed with the KYC/password and free-offerings plans.
- None of them touches divisions. The gaps below came out of the review and are now folded into the items.

- **F9 — Vendor's sign-up dropdown lists EzzyShots from the row alone (confirmed in code).** The chain:
  - `vendor/components/auth/LoginPage/useLoginPage.ts:185, 191` builds the Combobox options from every row `getActiveDivisions()` returns, with label = `divisions.name`.
  - `vendor/app/api/divisions/route.ts:12-16` returns every `is_active` row, ordered by `sort_order`, with no hardcoded list or filter.
  - Nothing caches the list. Next 16 GET route handlers are dynamic by default, `next.config` has no `cacheComponents`/`use cache`, and the route is absent from `.next/prerender-manifest.json`. `vendor/public/sw.js:45-48` never caches `/api` GETs.
  - Sign-up validates the chosen **id** against active rows (`app/api/auth/register/route.ts:76`).
  - **So EzzyShots is in the dropdown now, in every environment where the row is active. That doesn't depend on the slug fix or on this plan's code.** It sits wherever its `sort_order` puts it; Command's `createDivision` appends at the end. Command's vendor form is also database-driven, so admins can assign it.
  - Not machine-verifiable locally (F8), so S3 checks it on staging.
- **F10 — No migration (re-confirmed).** F2 plus F9: nothing in the schema, Vendor or Command restricts division values. The slug is a lookup key, and everything that is stored or validated uses `divisions.id`. The one SQL statement in this plan is the slug data fix, which you run yourself.
- **F11 — ✅ RESOLVED 2026-11-17: the user committed that edit on 2026-11-16 (`a091390`), so I8 edits a clean file.** Original finding: `booker/AGENTS.md` already has an uncommitted edit that isn't from this plan (the free-offering wizard line, `git -C booker diff AGENTS.md`). I8 edits the same file, so a scoped `git add booker/AGENTS.md` would take both. The Stage 3 commit draft must call this out: commit that line separately first, or knowingly include it. `vendor/AGENTS.md` also has an uncommitted edit, but this plan doesn't touch that file.
- **F12 — Vendor lint is 0 errors, 0 warnings since 0.60.2** (2026-11-16, `vendor/AGENTS.md`). Any new finding counts as a regression, so I7 must keep it at 0/0.
- **F13 — Booker's service worker caches same-origin images forever** (`booker/public/sw.js:29`), and a division icon's path is built from its slug (`lib/divisionIcon.ts`), so it can't carry a version suffix. **The PNG that ships must be the final artwork.** A later replacement would keep showing returning bookers the old file unless it gets a new filename plus a `divisionIcon.ts` change. That's the same trap the promo banners avoid with `-v1`/`-v2`.
- **F14 — `architecture/schema.md`'s claim that "every environment gets the 13 rows from `db push` alone" stops covering all divisions.** EzzyShots exists only where someone created it in Command (P2 handles a missing production row). I8 rewrites that sentence rather than just bumping a count.
- **F15 — The design preview passes its checks before Stage 1** (2026-11-16): `node .plans/previews/_shared/shoot.mjs booker-home-divisions-layout` → 60 cells, 9 checks, 0 failures. Stage 1 must leave it at 0 failures. That preview belongs to a COMPLETE plan, so its README and screens that say "13" stay as the historical record; only `icons3d.js`, the exporter and `logos/` change.
- **F16 — Small layout effects, checked:**
  - Desktop strip: capped at 7 columns (`DivisionStrip.module.css:26`), so 14 tiles make 7 + 7 rows.
  - Phone: a scrolling row, so nothing changes.
  - Search overlay: the marquee takes 11 s for half of a doubled track (`SearchingOverlay.module.css:104-107`), so with 14 marks it runs about 8% faster. Cosmetic and accepted; look at it during I6's review.
  - `/ui-gallery`'s `DIVISIONS[i]` is indexed by a shorter `CODES` list, so nothing changes there.
  - No other app is affected: `ezzy-vendor-mobile` has no division picker, and `affiliate/` has no division code.

- **F18 — The logo-derived colour collides with EzzyPark (2026-11-17).** The D22-d method, reproduced in a scratch script and calibrated against Park (within 1–2 RGB units of its shipped values), samples EzzyShots' only hue: an orange accent that is **7.5%** of its ink. It derives to tile `#fdeae4` and deep `#a13314`, against Park's `#fde7e2` and `#a62908`, so the two would be indistinguishable on badges and cards. Same class of problem as the redesign's F39 colour collisions. User chose violet instead (D3 revised).

- **F19 — The EzzyShots mark reads faint at chip size (2026-11-17).** In Explore's division chips (about 16px), the Shots icon is visibly thinner and paler than Park and Law, in both themes (zoomed from `explorechips-light`). The cause is the artwork: fine-stroke line art whose strokes fall well under 1px at that size. Not the 512px downscale (the browser resamples to 16px either way) and not the 1.11 factor (that enlarges). Changing the stroke weight would alter the user's logo, so this is reported, not fixed. Options: accept it, or the user supplies a bolder-stroke version, and then the 18 baselines are regenerated once.

---

## Pre-checks (👤, read-only; run in each environment before its SQL)

### R1 — Inspect the row  ⬜ TODO
```sql
select id, name, slug, sort_order, is_active, created_at, updated_at
from public.divisions
where name ilike '%shot%' or slug ilike '%shot%';          -- expect exactly 1 row

select id, name, slug from public.divisions where slug = 'ezzy-shots';   -- expect 0 rows

select count(*) as vendor_count
from public.vendors v join public.divisions d on d.id = v.division_id
where d.name = 'EzzyShots';                                 -- informational
```
⛔ If the `name` isn't exactly `EzzyShots`, or `is_active` is false, stop and tell the agent. Vendor sign-up hides inactive rows (`vendor/app/api/divisions/route.ts:15`).

---

## IMPORTANT (build items)

### I1 — Register the slug in Booker's division list  ✅ DONE (2026-11-17)
✅ `booker/lib/divisions.ts`: `"ezzy-shots"` appended to `DIVISION_SLUGS`, and `{ slug: "ezzy-shots", name: "EzzyShots", label: "Shots", hint: "Photos" }` added last in `DIVISIONS`; header and list comments updated. Verified: `tsc` clean (with I3's export), `npm test` 338/338.
**File:** `booker/lib/divisions.ts:17-20, 43-57`
- Add `"ezzy-shots"` to `DIVISION_SLUGS`.
- Add a `DIVISIONS` entry `{ slug: "ezzy-shots", name: "EzzyShots", label: "Shots", hint: "Photos" }` as the **last** element, after `ezzy-law` (D1, D2). Append to `DIVISION_SLUGS` the same way.
- Update the "13" wording in the file's comments.

`name` must stay exactly `EzzyShots`: `matchDivision` and the canonical-name search use it.
**Coupled with I3** (type check fails without the drawing).
**Verify:** 🖥 `tsc`, `lib/divisions.test.ts`, `lib/divisionMatch.test.ts` (every division reachable by its own name; the hint must not shadow another division's).

### I2 — Colour tokens  ✅ DONE (2026-11-17)
✅ `booker/app/globals.css`: `--div-ezzy-shots-tile #efe7fd`, `-label #7c3aed` (light) / `#925bf0` (dark), `-deep #6c33ce`, and the `[data-division="ezzy-shots"]` map line. **Violet, chosen, not sampled (D3 revised 2026-11-17, F18).** No `-bg`/`-fg` (retired). Contrast, from the derivation script: white on deep 7:1; deep on tile 5.86:1; light label 4.5:1+ on the worst light page stop (base passes as is); dark label 4.5:1 on the worst dark stop. `lib/palette.test.ts` tile/deep counts 14 → 15, pair count stays 14 with a comment saying why. Verified: `npm test` 338/338, including every palette contrast assertion.
**File:** `booker/app/globals.css`.

Add these tokens, with values per D3:
- `--div-ezzy-shots-tile` (in the `:root` tile block, ~line 172)
- `--div-ezzy-shots-label`, both themes (light block ~201, dark block ~345)
- `--div-ezzy-shots-deep` (~217)

Then add one map line, `[data-division="ezzy-shots"] { --division-tile…; --division-deep…; --division-fg… }`, after line 453. Add a `--division-art` line (~486) only if the logo's opaque box needs one, measured the same way as `ezzy-drive`/`ezzy-learn`/`ezzy-ride`.

⚠️ **Do not add `--div-ezzy-shots-bg` / `-fg`**: they are retired and nothing reads them. As a result, `palette.test.ts:151`'s pair count stays at 14, and its comment must say why.

**Pass bars** (the existing ones):
- white on `-deep` ≥ 7:1 (the set's floor is 7.03; the test bar is 4.5)
- `-deep` on `-tile` ≥ 4.5:1
- `-label` ≥ 4.5:1 against the worst page stop of each theme

**Verify:** 🖥 `lib/palette.test.ts` with its tile/deep counts updated 14 → 15 (lines 171, 202, 203).

### I3 — The 3D icon for "Browse by division"  ✅ DONE (2026-11-17; preview-screen question still open, see below)
**Stage 1 (2026-11-16, 🤖):** `icons3d.js` — `"ezzy-shots"` drawn in `DRAW`, in the existing tone classes. First drawn as a simple photo camera; **redrawn the same day at the user's request as a modern DSLR**, then **redrawn again as a Canon EOS-style body** with rounded body corners, a curved grip on the right, a rounded pentaprism hump, shutter button and mode dial, and a lens with a focus-ring band, a dark front ring and a glass centre. **Then tried as a framed landscape print on a stand** (sky, two hills, sun) at the user's request, and rejected. **The DSLR version was restored 2026-11-16 and is the current drawing.** The Canon EOS and framed-print drawings are not kept in the file. Checked: `node --check` passes; `shoot.mjs booker-home-divisions-layout` reports 9 checks, 0 failures; rendered at 180px and 46px in a scratch harness (outside the repo), and it reads as a camera next to the Drive and Law drawings. **✅ Stage 1 checkpoint signed off by the user, 2026-11-16: the DSLR drawing is approved.** The screens list is still open (see below).
**Finding F17 (2026-11-16):** in brand colours the camera renders solid black, because `preview.css` has no brand colour for `ezzy-shots`. The real colour comes from the logo (D3), so this is expected until Stage 2, but the preview's brand row is not yet representative. Review file: `.plans/previews/booker-home-divisions-layout/flagged/camera-check.html` (gitignored; opens from WSL as `file:///home/joshua/RS/...`).
**Stage 2 ✅ DONE (2026-11-17):** exporter guard set to 14, the entry check compares against `SLUGS.length`, header comment updated; exporter re-run → `DivisionIcon3d.tsx` 14 icons, **purely additive** (0 lines removed against the previous file), no new tone, and every `--db-ic3d-*` value it printed already matches `globals.css` (nothing pasted). Verified: `tsc` clean, `lib/divisionIcon3d.test.ts` passes. Original Stage 2 note: `export-icons3d.mjs:23` (13 → 14) and `:160` and the exporter's header comment. These are deliberately *not* changed in Stage 1: the exporter reads `DIVISION_SLUGS` from `booker/lib/divisions.ts`, which still has 13 until I1 lands, so editing the count now would make the exporter fail on the current code.
**Preview screens:** `screens.js:39` has the 13-division list used by every screen, including the "current" historical reconstruction. The camera is therefore not on any preview screen yet. Adding it there would change the historical "current" screens, which the plan says must stay unchanged. Decide at the checkpoint whether to add a dedicated screen or accept the scratch render.
**Files:**
- `.plans/previews/booker-home-divisions-layout/icons3d.js` (done in Stage 1)
- `export-icons3d.mjs` (Stage 2)

Then run `node .plans/previews/booker-home-divisions-layout/export-icons3d.mjs`, which regenerates `booker/components/home/DivisionStrip/DivisionIcon3d.tsx`. Paste its token block **only if** it prints a new `--db-ic3d-*` tone. The drawing should reuse the existing tones.

**Never hand-edit `DivisionIcon3d.tsx`.**

**Design checkpoint:** after drawing, open the preview's icons screen in both themes and show the user the new icon beside the other 13 before Stage 2 builds on it.

**Verify:**
- 🖥 `node .plans/previews/_shared/shoot.mjs booker-home-divisions-layout` still reports 0 failures (F15).
- 🖥 After the export in Stage 2: `tsc` and `lib/divisionIcon3d.test.ts` (one drawing per slug, no literal colours, tokens in both themes).
- 👁 User design sign-off.

### I4 — The PNG mark for cards, Explore and the offering cover  ✅ DONE (2026-11-17; near-black docs note carried by I8)
**On-screen check (2026-11-17):** the `divisions` gallery screenshot shows the EzzyShots mark at the same visible size as its neighbours (about the width of Law and Learn), confirming the 1.11 factor. See F19 for how it reads at chip size.
**2026-11-17 (user supplied `ezzy-shots.png`, 3125 × 3125 px, 1.06 MB, mean luminance 11):**
- ✅ **Sizing.** `node .plans/scripts/measure-division-marks.mjs` → fill 0.864 against the 14-mark median of 0.961, so the factor is 1.11. Added `[data-division="ezzy-shots"] { --division-art: 1.11; }` in `booker/app/globals.css` and the measurement row to the comment there. No other division's factor moves: the median is unchanged with 14 marks.
- ✅ **Bundled.** Added `"ezzy-shots"` to `BUNDLED` in `booker/lib/divisionIcon.ts`, so the file is used at all. Without this it would render as "ES" initials (the `ezzy-ride` trap).
- ✅ **Verified (machine):** `npm test` 336/336 pass; `npx tsc --noEmit` clean. Not screen-verified: the displayed size is arithmetic, `fill × factor` = 0.864 × 1.11 ≈ 0.96 against the median 0.961.
- ✅ **Downscaled (user said ok, 2026-11-17).** `ezzy-shots.png` is now **512 × 512, 66 KB** (was 3125 × 3125, 1.06 MB), resized with a high-quality canvas draw. Re-measured with `measure-division-marks.mjs`: fill 0.863 (was 0.864), factor still 1.11, mean luminance 10 (was 11). Original kept at `/tmp/claude-1000/-home-joshua-RS/ef342b1a-65a0-4df9-a4f8-078d6ff01f4b/scratchpad/ezzy-shots-original-3125.png`, which is session scratch and can be cleared, so keep your own copy too.
- ⚠️ **Near-black ink:** mean luminance 11 puts it with Food (1), so Booker's "four near-black marks" note in `booker/AGENTS.md` becomes five (Home, Care and Learn are also in that group). The I8 doc update must add it.
- ✅ `public/division-icons/ezzy-shots.png:Zone.Identifier` is a Windows download marker, already ignored by `booker/.gitignore:72` (`*:Zone.Identifier`, checked 2026-11-17), so it cannot be committed. Deleting it is optional.
**Files:** `booker/public/division-icons/ezzy-shots.png` (new asset, per D5) and `booker/lib/divisionIcon.ts:35-38` (add the slug to `BUNDLED`; the file alone does nothing, which is the documented `ezzy-ride` trap).

Copy the same PNG into the preview's `logos/` so the preview matches.

Check its luminance the way `AGENTS.md` records it for the others. If it is near-black line art, the tile tint and CSS-mask rules already handle it, and nothing new is needed.

D5 = the user supplies the PNG, so this item is blocked until the file arrives.

⚠️ **It must be the final artwork** (F13). Booker's service worker caches it forever under a slug-based path, so a logo swapped after release won't reach returning bookers without a new filename.

Match the other marks' format: check their pixel size with `file booker/public/division-icons/*.png` and use a transparent background.

**Verify:** 🖥 `lib/divisionIcon.test.ts:25` (every slug resolves to a bundled file; only with a PNG). 👁 visual baselines (I6).

### I5 — Unit tests  ✅ DONE (2026-11-17)
✅ `divisions.test.ts` 13 → 14; `palette.test.ts` per I2; new `search.test.ts` case (an `ezzy-shots` vendor is returned by `division: "ezzy-shots"` and by the query "ezzyshots", the F4 regression); new `divisionMatch.test.ts` case ("photos", "photo", "shots" and "EzzyShots" all resolve to `ezzy-shots`). Verified: `npm test` **338/338** (336 + 2). Lint unchanged at the pre-existing **18** problems, none in a changed file.
**Files:**
- `booker/lib/divisions.test.ts:27-29`: 13 → 14.
- `booker/lib/palette.test.ts:150, 170, 202-203`: counts and comments per I2.
- `booker/lib/search.test.ts`: add one case, a vendor with `divisionSlug: "ezzy-shots"` returned by `division: "ezzy-shots"`. This is the regression for F4, since no local database row exists (F8).
- `booker/lib/divisionMatch.test.ts`: assert that the D1 hint word resolves to `ezzy-shots`.

**Verify:** 🖥 `npm test` all pass. The count must rise from 336 by exactly the cases added.

### I6 — Visual coverage  ✅ DONE (2026-11-17)
**Run 1 (2026-11-17), unpiped, exit code read from file:** `npx playwright test` → **18 failed, 191 passed, EXIT=1**. All 18 are `toHaveScreenshot` differences of about 1%; `home-layout.spec` (count 14) passed. Changed-pixel regions computed from each diff PNG:
- 12 Home variants (`home`, `homenear`, `homenohistory`, `homepromo`, light/dark, incl. the two `-wide` pairs): about 50 × 62 px at the end of row 2, the new Shots tile only.
- `divisions` light/dark: 186 × 64 px, Shots added and "Unknown" moved one slot.
- `explorechips` light/dark: 92 × 34 px, the new Shots chip only.
- `homesearching` light/dark: the overlay (14 marks, "Looking across 14 divisions") and the strip's new tile.
Nothing outside those areas moved. The 4 `Sample error` log lines come from the deliberate `ErrorPage` gallery fixture (`app/ui-gallery/page.tsx:1179`), not a regression.
**Baselines (2026-11-17):** the user reviewed and accepted them as they are, F19 included. Regenerated **only these 18** with `npx playwright test visual-tests/pilot.spec.ts -g 'ui-gallery (explorechips|home|homesearching|homenear|divisions|homepromo|homenohistory|homepromo-wide|homenohistory-wide)-(light|dark)$' --update-snapshots=changed` (`--list` confirmed 18 tests first) → 18 passed; `git status` shows exactly 18 changed PNGs under `visual-tests/pilot.spec.ts-snapshots/`, plus `home-layout.spec.ts`. **Full re-run, unfiltered:** **209 passed, 0 failed, EXIT=0** (read from file).
**Files:**
- `booker/visual-tests/home-layout.spec.ts:55`: 13 → 14. Desktop wraps at ≤ 7 per row, so 14 gives two full rows of 7, and the left-aligned and centred assertions still apply.
- Regenerate the baselines that draw the division set: Home, divisions, Explore chips, search overlay, and anything else that comes up as a diff.

⚠️ Follow the memory rules:
- Never pipe a Playwright run through `tail`.
- Stop the user's `:3000` dev server first.
- Review every changed PNG; never bulk-accept.
- List each regenerated baseline by name in the stage report.

The phone strip is a scrolling row of 5.5 tiles, so a 14th tile only extends the scroll. The spec's "last tile reachable" check covers that.

**Verify:** 🖥 `npm run test:visual` green after regeneration. 👁 the regenerated images reviewed.

### I7 — Vendor: keep the slug guard honest  ✅ DONE (2026-11-17)
✅ `vendor/lib/slug.test.ts`: `"ezzy-stay"` (missing before) and `"ezzy-shots"` added to the seeded list (D6). Verified: Vendor `npm test` **583/583**, `npm run lint` **0 errors, 0 warnings**, `npx tsc --noEmit` clean. Test-only, so no Vendor deploy.
**File:** `vendor/lib/slug.test.ts:27-31`. Add `"ezzy-shots"`, plus `"ezzy-stay"` if D6 says so, to the seeded list. It proves `ezzyshots` doesn't collide with `ezzystay` or anything else. Test-only, so no vendor deploy is needed.
**Verify:** 🖥 in `vendor/`, run `npm test` (all pass) and `npm run lint` (**0 errors, 0 warnings**; F12).

This item gives Vendor no functional change, because the dropdown is already database-driven (F9).

### I8 — Docs  ✅ DONE (2026-11-17)
✅ `architecture/schema.md` (`divisions`: EzzyShots as hosted data with no migration row (F8/F10/F14); the `slugify` camel-case trap (F1); marks can't be versioned (F13); five of fourteen marks near-black; grid of 14). `architecture/portals.md` (division counts 13 → 14, 7 + 7 rows, "Shots" is the fourteenth pill). `booker/AGENTS.md` (five near-black marks, and a new **"Adding a division"** checklist covering F18 and F19). `booker/lib/divisionIcon.ts` comment counts. Every diff line checked to be this plan's own. Booker re-verified after the comment edits: `tsc` clean, 338/338, lint at the pre-existing 18.
- `architecture/schema.md` → `divisions`:
  - Change "13 rows" to: seeded 13, plus EzzyShots added as hosted data on <date>, with no migration (F8).
  - Rewrite the deployment-status sentence "every environment gets the 13 rows from `db push` alone", which no longer covers every division (F14).
  - Record the camel-case `slugify` trap (F1).
  - Record that division icons can't be versioned (F13).
- `booker/AGENTS.md` → "Division colours and icons": the counts ("Four of them, not three" luminance list, if I4 changes it), plus a short **"Adding a division"** checklist naming I1–I6's files. Nothing records that today, and this plan had to rediscover it.
- `booker/lib/divisions.ts` and `divisionIcon.ts` comments that say 13/twelve.

Grep `architecture/portals.md` for "13" and update only what is about the division count.

---

## DECISIONS
<!-- No item may execute while any OPEN: line remains (plan-authoring §7). -->
- **D1 — Hint word** → **`"Photos"`** (resolved 2026-11-16, user). Matches "photo" and "photos" (substring match, `lib/divisionMatch.ts:26-29`). Never shown on screen.
- **D2 — Position** → **last, 14th after Law** (resolved 2026-11-16, user). The 13's editorial order is untouched, and desktop becomes 7 + 7.
- **D3 — Colours** → ~~derive tile/label/deep from the supplied logo~~ **REVISED 2026-11-17 (user): violet, base `#7c3aed`, run through the same D22-d tint / label / deep rules** (F18). Original decision, kept for the record: **derive tile/label/deep from the supplied logo**, the D22-d method (resolved 2026-11-16, follows D5). Sample the logo's chromatic ink (alpha-gated at 200), then darken until white on `-deep` ≥ 7:1, and adjust `-label` until it reaches ≥ 4.5:1 on each theme's worst page stop. Record the measured ratios in I2's DONE note. If the logo turns out to have 0% chromatic ink (as `ezzy-food`/`ezzy-stay` do), fall back to a hand-picked pair and note it.
- **D4 — 3D icon** → **the agent draws a camera** in the existing style and tones; the user reviews it at the Stage 1 checkpoint (resolved 2026-11-16, user).
- **D5 — PNG logo** → **the user supplies `ezzy-shots.png`** (resolved 2026-11-16, user). ⛔ **Stage 2 waits on it**: I2's colours are derived from it. Put the file at `booker/public/division-icons/ezzy-shots.png`, or give its path. F7's monogram collision does not apply.
- **D6 — Vendor test list** → **add both `ezzy-shots` and the missing `ezzy-stay`** (2026-11-16, the recommended option; not asked separately, so the user can overrule it at approval).

## DEFERRED / OUT OF SCOPE
- **Command `slugify` doesn't split camel case** (F1), `command/lib/utils.ts:9`. A different app (cross-app gate), and today's row is fixed by SQL. Needs its own small plan before the next division is added.
- **`ezzy-booker-mobile/src/lib/divisions.ts` also hardcodes 13** (plus `theme/divisionPalette.ts`). A mock-data build still in progress; parity belongs to that plan.
- **No local EzzyShots row (F8).** Adding it to `seed.sql` or a migration would touch `backbone/` (a third repo), and a migration insert would collide with the hosted row's unique `name`. Unit tests (I5) cover the filter logic, and staging covers the real data.
- **`divisions.display_name` / admin-managed icons:** the documented future path (`architecture/schema.md`). Not needed for one division.

## Execution order
1. **Decisions D1–D6 resolved (2026-11-16) → plan approval.** Nothing executes before approval.
2. **Stage 1 (🤖): I3 drawing** in the preview, plus I4's PNG copied into the preview if supplied. ⛔ **Design checkpoint: stop for your sign-off on the icon.**
3. **Stage 2 (🤖): I1 + I2 + I3 export + I4 + I5 + I6** in Booker as one batch (I1 and I3 are type-coupled). Run `tsc`, lint, `npm test`, `test:visual`.
4. **Stage 3 (🤖): I7 + I8.** Vendor test, docs, then a commit draft per repo (booker, vendor, root) following `commit-drafting`.
   - The Booker draft must name F11, the pre-existing uncommitted `booker/AGENTS.md` line.
   - The version bump (Booker is at 0.31.0) and the git-flow release are yours.
5. **Stage 4: Staging release** (S1–S4).
6. **Stage 5: Production release** (P1–P4), always last.

## Release (§12)

**Order within each environment: data fix first, then the Booker deploy.** No migration and no Edge Functions are involved. Vendor has no deployable change, because I7 is test-only.

**Safe and unsafe states**

| State | Booker shows | Safe? |
|---|---|---|
| Old Booker, old slug (today) | EzzyShots vendors searchable, neutral, not filterable | ✅ |
| Old Booker, slug fixed | Same as today: the old build doesn't list either slug | ✅ |
| **New Booker, old slug** | EzzyShots tile and chip shown, but tapping it filters to **nothing** (vendors carry `ezzyshots`, which maps to `none`) | ⚠️ Visible but not harmful. Recover by running the SQL |
| New Booker, slug fixed | Full division | ✅ target |

### Staging (production untouched throughout)
| # | Who | Step | Check |
|---|---|---|---|
| S1 | 👤 | R1 on **staging**, then the slug fix (SQL below) | ⛔ `returning` gives exactly 1 row, same `id` |
| S2 | 👤 | Deploy Booker to staging (Vercel) | Deployment URL noted for P3 |
| S3 | 👤 | Vendor sign-up checks on staging, no account needed: (a) open sign-up and confirm **EzzyShots is in the division dropdown** (F9); (b) open `/?division=ezzy-shots` and confirm EzzyShots is pre-selected. Then, for S4, give an **existing active test vendor that has an active offering** the EzzyShots division in Command's vendor form, and note its original division. That's quicker than registering a new vendor, which needs KYC approval and activation first | ⛔ (a) and (b) pass |
| S4 | 👤 + 🤖 | Booker checks on staging, both themes, desktop and phone (see Verification). Afterwards, give the S3 test vendor back its original division | ⛔ all green |

```sql
-- S1 / P2: the slug fix (run after R1 in the same environment)
update public.divisions
set    slug = 'ezzy-shots'
where  name = 'EzzyShots'
  and  slug <> 'ezzy-shots'
  and  not exists (select 1 from public.divisions where slug = 'ezzy-shots')
returning id, name, slug, updated_at;

-- confirm
select id, name, slug, sort_order, is_active, updated_at from public.divisions where slug = 'ezzy-shots';
```
Blast radius: one row, one column; `updated_at` bumps. No foreign key or trigger reads `slug` (F2). To undo, set `slug` back to the value R1 showed. Vendor `?division=` links work under either value (F6).

⛔ **Staging fully green before anything touches production.**

### Production (last stage)
| # | Who | Step | Check |
|---|---|---|---|
| P1 | 👤 | Parity: this plan's only production changes are the one row and the Booker deployment tested in S2 | ⛔ nothing else pending |
| P2 | 👤 | R1 on **production**, then the same slug fix | ⛔ exactly 1 row. If production has **no** EzzyShots row, stop: it must be created in Command first, and then fixed by this SQL (F1) |
| P3 | 👤 | Vercel **Promote** the exact staging Booker deployment from S2 | — |
| P4 | 👤 + 🤖 | Production checks: a subset of S4 (EzzyShots tile and chip present, filter returns the EzzyShots vendors if any exist) | ⛔ green |

## Verification
- 🖥 **Machine (local):**
  - `npx tsc --noEmit`
  - `npm run lint` (no new problems against the Stage 2 baseline)
  - `npm test` (336 + new cases, all pass)
  - `npm run test:visual` (green after the reviewed regeneration)
  - vendor `slug.test.ts`
  - exporter exits clean
- 👁 **Human, local:** the Stage 1 icon sign-off, and the regenerated baselines reviewed.
- 🌐 **Staging (S4):**
  - Home shows 14 tiles, EzzyShots in position D2 with its 3D icon. Desktop shows 7 + 7; the phone strip scrolls to it.
  - Explore has a "Shots" chip, and selecting it filters to EzzyShots vendors (needs ≥ 1 EzzyShots vendor with an active offering, see S3).
  - Typing the D1 word and "ezzyshots" in search resolves the division.
  - The EzzyShots badge and mark show on a result card, the vendor page and the offering cover, in its own colours and not neutral grey.
  - Both themes.
- 🌐 **Production (P4):** the tile and chip are present, plus one filter check if a production EzzyShots vendor exists.

## Docs
**Docs:** architecture/schema.md, architecture/portals.md, booker/AGENTS.md (2026-11-17, I8)
