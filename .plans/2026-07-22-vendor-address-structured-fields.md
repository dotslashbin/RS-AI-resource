# Vendor address — structured Philippine address fields

**Date:** 2026-07-22
**App / scope:** `./vendor` primarily (registration wizard + Profile page + the atomic register route). One schema migration in `./backbone`. **Zero code changes required in `./booker` or `./command`** — see D1 below for why.
**Status:** COMPLETE — decisions D1–D6 resolved 2026-07-22. I1–I6 all executed and verified 2026-07-22. Registration and the Profile page's Location editor are both end-to-end functional against the real local DB; architecture docs are back in sync with the shipped schema.

> **Goal:** vendor registration currently asks for one free-text "address" field. Replace it with PH-standard structured fields — **Barangay**, **City**, **Province** (each a searchable dropdown, city filtered by province, barangay filtered by city), **ZIP Code** (plain text), and an **Address Line 1** (street/building/unit, free text — the old field's actual role). Apply the same structured entry to the vendor Profile page's address editor.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local.

---

## Answering the "one string vs. decomposed" question

**Decompose — but keep a synced flat string too.** Structured columns (`address_line1`, `barangay`, `city`, `province`, `zip_code`) are what make the data useful: they let a geocoder (Nominatim, Google Geocoding, etc.) build an unambiguous query, they let the DB filter/search by city or province later without parsing text, and they're what makes the dropdown+autocomplete UX possible in the first place. But most consumers (map pin labels, vendor list display, geocoding query strings) just want one line. So the plan keeps the existing `vendors.address` column, and the **app** (not a DB trigger) recomputes it as a formatted single string on every write — `formatFullAddress()` in a new `vendor/lib/address.ts`, mirroring the existing `isValidPhone` pattern in `vendor/lib/validation.ts`.

Net effect: `address` always contains a complete, well-formed line (an improvement over today's manually-typed short strings), and nothing that only *reads* `address` — booker, command, the vendor list dropdown — needs to change at all.

**Not in scope:** actual geocoding (lat/lng storage, a geocoding API call). Nothing in the schema today stores coordinates — booker's map only plots the *user's own* geolocation (`booker/components/booking/MapWidget/useMapWidget.ts`), it doesn't pin vendors. This plan only makes the address *data* geocoder-ready; wiring an actual geocode-on-save is a separate future task if wanted.

---

## Current state (verified against the code)

| Concern | File:line | Notes |
|---|---|---|
| DB column | `backbone/supabase/migrations/20260504000002_schema.sql:65` | `address text not null default ''` — single free-text field |
| Grants | `backbone/supabase/migrations/20260620000001_api_role_grants.sql:50` | `grant select, insert, update, delete on public.vendors to authenticated` — table-level, not column-scoped. **New columns need no new grants.** |
| RLS | `backbone/supabase/migrations/20260504000003_rls.sql:158-162` | Vendor-admin update policy is row-scoped (`has_vendor_role`), not column-scoped. **No RLS changes needed.** |
| Registration UI | `vendor/components/auth/LoginPage/LoginPage.tsx:300` | Single `RF` field, Step 1 of 6 ("Business details") |
| Registration state | `vendor/components/auth/LoginPage/useLoginPage.ts:17-27` (`RegForm`), `:102` (`computeResumeStep`), `:192-203` (`handleDetailsContinue`), `:316-333` (`handleSubmitKyc` → `submitKyc`) | |
| Field component | `vendor/components/auth/LoginPage/RegisterField.tsx:9` | `field` union type enumerates every Step-1/2 field name |
| Local draft (autosave) | `vendor/lib/kycDraft.ts:5-16` | `KycDraft` interface + `localStorage` key `vendor-onboarding-draft-v1` |
| KYC service | `vendor/services/kyc.service.ts:31-44` (`SubmitKycParams.form`), `:50-61` (FormData build) | |
| Atomic register route | `vendor/app/api/auth/register/route.ts:27-39` (parse+validate), `:104-112` (insert) | Server-side is the real gate — no session exists yet |
| Profile read/write | `vendor/services/profile.service.ts:4-15` (`DbVendorRow`), `:17-30` (`toProfile`), `:43-64` (`updateVendorProfile`) | |
| Profile type | `vendor/lib/types.ts:120-133` (`VendorProfile`) | |
| Profile UI | `vendor/components/profile/ProfilePage/ProfilePage.tsx:76` (Location section), `ProfilePage.helpers.tsx` (generic `Field`) | Generic `Field` only renders `<input>`/`<textarea>` — can't host a combobox, needs a dedicated block |
| Profile draft state | `vendor/components/profile/ProfilePage/useProfilePage.ts:34-35` | `updateDraft(field, val)` is already generic over `keyof VendorProfile` — new fields slot in for free |
| Vendor list display (unaffected) | `vendor/services/vendor.service.ts:3-8,29,40` | `DbVendor.address` — flat string, **no change** |
| Booker read (unaffected) | `booker/services/vendors.service.ts:9,20,32`, `booker/components/booking/steps/Step2Vendor/Step2Vendor.tsx:75,78`, `booker/components/booking/BookingWizard/BookingWizard.tsx:58`, `booker/lib/types.ts:20` | All read `vendor.address` as a flat display string — **no change** |
| Command read/write (unaffected) | `command/services/vendors.service.ts:8` (read), `command/hooks/mutations/vendors/useCreateVendor.ts:15` (hardcodes `address: ""` on internal vendor creation — pre-existing gap, command has no address UI at all today; **out of scope**, unaffected by new columns since they default to `''`) | |

---

## DECISIONS (resolved 2026-07-22)

- **D5 — Architecture-doc sync** → **Add as a new plan item (I6), shipped in the same batch as I3+I4** (resolved 2026-07-22). Cross-checking this plan against `./architecture/*.md` (per `plan-authoring` skill §2/§6) found 4 spots that describe the current single-`address` shape and will go stale once this plan lands: `schema.md:163` (`vendors` table column list), `schema.md:185` ("Two write paths to `vendors`" table — self-registration's written-fields list), `portals.md:149` (vendor Profile "Display and edit" field list), `vendor-kyc.md:55` (registration Step 1 field list). Not a design conflict — `booking-flow.md`'s `vendor.address` display-string usage was also checked and needs no change, confirming D1's sync-string approach is exactly what keeps that contract intact. See I6.
- **D1 — Backend shape** → **Decompose + auto-sync flat string.** New columns `address_line1`, `barangay`, `city`, `province`, `zip_code` become the source of truth; `address` stays and is recomputed by the app on every write via `formatFullAddress()`. Rationale above. *(Rejected alternative: fully decompose and drop `address`, which would force changes into booker + command too — bigger blast radius for no functional gain right now.)*
- **D2 — Reference data source** → **Bundle static PSGC data in-repo.** Pull the official PSA/PSGC dataset once (province/city/barangay names + codes only — no need for the full PSGC metadata), trim it, and check it into `vendor/public/ph-address/` as static JSON. Provinces (~82 rows) and cities (~1,634 rows, each tagged with its province code) are small enough to eager-load; barangays (~42,000 rows total) are split into one JSON file per city and fetched on demand only when that city is selected. No new npm dependency (avoids the install-approval gate), no runtime dependency on a third-party API during registration.
- **D3 — Barangay strictness** → **REVISED 2026-07-22: all three (Province, City, Barangay) are strict pick-from-list.** Barangay is a required, strict combobox selection — must match an entry in the selected city's PSGC list, no free-text fallback. Paired with a new `barangay_code` column (I1), resolved on edit the same way `city_code`/`province_code` already are. *(Original 2026-07-22 decision, superseded: Barangay allowed free text — the combobox would suggest from the selected city's list but not block submission on no match, reasoning that PSGC barangay-level data can lag real boundary/renaming changes. Reversed at the user's explicit correction: barangay must not be optional/unvalidated.)*
- **D4 — Profile page scope** → **Included.** The Profile page's Location section gets the same structured fields (via a shared component, see I2), not just the registration wizard, so editing later doesn't regress to a single free-text box.
- **D6 — NCR / independent-city pseudo-provinces** → **Synthetic province entries** (resolved 2026-07-22, discovered + asked during I2). 19 of the 1,634 PSGC cities have no real province — the 17 NCR cities (Manila, Quezon City, Makati, Taguig, etc.) plus Isabela City and Cotabato City, each an independent component city. Without handling this, Metro Manila would be entirely unreachable via the Province→City cascade. Added 3 synthetic entries to `provinces.json`: `{code:"NCR", name:"Metro Manila"}` (groups all 17 NCR cities), `{code:"ISABELA-CITY", name:"Isabela City"}`, `{code:"COTABATO-CITY", name:"Cotabato City"}` — non-numeric codes, so they can never collide with a real 9-digit PSGC code. *(Rejected alternative: group under the official PSGC region name instead, e.g. "Zamboanga Peninsula" for Isabela City — more technically correct but unintuitive, a vendor there wouldn't think to look under the region name.)*

---

## IMPORTANT — implementation items

### I1 — Schema migration: add structured address columns ✅ DONE (2026-07-22, revised 2026-07-22)
**File:** `backbone/supabase/migrations/20260722000001_vendor_address_fields.sql`

```sql
alter table public.vendors
  add column address_line1 text not null default '',
  add column barangay      text not null default '',
  add column city          text not null default '',
  add column city_code     text not null default '',
  add column province      text not null default '',
  add column province_code text not null default '',
  add column zip_code      text not null default '';

-- Best-effort backfill: existing free-text address becomes the line-1 value so
-- nothing is silently lost. Barangay/city/province/zip_code stay blank for
-- existing rows (the old text can't be reliably split into those parts) —
-- vendors fill them in next time they edit their profile.
update public.vendors set address_line1 = address where address_line1 = '';

comment on column public.vendors.address is
  'Full formatted address, recomputed by the app (formatFullAddress()) from address_line1/barangay/city/province/zip_code on every write. Read-only display string for booker/command — do not write to it directly from those apps.';
comment on column public.vendors.address_line1 is 'Street / building / unit — free text.';
comment on column public.vendors.barangay      is 'Barangay — PSGC reference data, suggested but not strictly enforced. No code column: barangay lookups are keyed by city_code, and the field is free-text anyway (D3).';
comment on column public.vendors.city          is 'City / municipality display name — PSGC reference data, filtered by province, strict pick. Paired with city_code; the code (not this name) is authoritative for cascading lookups.';
comment on column public.vendors.city_code     is 'PSGC city/municipality code. Stable identifier used to filter the barangay list and to resolve the correct dropdown selection when an existing vendor record is loaded for editing — matching on this code, not on the `city` display string, so a future PSGC data refresh (renames, reclassifications) cannot silently break edit-time resolution.';
comment on column public.vendors.province      is 'Province display name — PSGC reference data, strict pick. Paired with province_code; the code is authoritative for cascading lookups.';
comment on column public.vendors.province_code is 'PSGC province code. Used to filter the city list and to resolve dropdown selection on edit, same rationale as city_code.';
comment on column public.vendors.zip_code      is 'Postal/ZIP code — free text, 4 digits typical for PH addresses.';
```

**Revision (2026-07-22), corrective migration — file:** `backbone/supabase/migrations/20260722000002_vendor_barangay_strict.sql`

Per revised D3, barangay is no longer free text — it's a strict pick-from-list like city/province, so it needs a matching code column for the same edit-time-resolution reason `city_code`/`province_code` exist. **The SQL above (`20260722000001`) is left as originally written and executed — not edited** — because it was already applied to the local DB before this revision, and `AGENTS.md` prohibits editing an applied migration. The correction is a separate, second migration:

```sql
alter table public.vendors
  add column barangay_code text not null default '';

comment on column public.vendors.barangay is
  'Barangay display name — PSGC reference data, filtered by city, strict pick (revised 2026-07-22, see plan D3). Paired with barangay_code; the code is authoritative for cascading lookups, same rationale as city_code/province_code.';
comment on column public.vendors.barangay_code is
  'PSGC barangay code. Used to resolve dropdown selection on edit, same rationale as city_code/province_code.';
```

The **current, effective schema** for `vendors` is the union of both migrations: `address_line1`, `barangay`, `barangay_code`, `city`, `city_code`, `province`, `province_code`, `zip_code` — 8 new columns total, not 7. Every downstream item below (I2–I6) reflects this corrected 8-column shape.

**Blast radius:**
- **Data:** one `UPDATE ... WHERE address_line1 = ''` over the `vendors` table — small table (one row per vendor business, not per booking). **Assumption, not verified:** row count estimated at single-digit-to-low-hundreds — no DB access was available to confirm the actual count. Doesn't change the risk assessment either way: the operation is metadata-only `ADD COLUMN` + a single row-level-locked `UPDATE`, cheap regardless of exact row count.
- **Lock:** `ADD COLUMN ... DEFAULT` on modern Postgres (12+, which Supabase runs) is a fast metadata-only change for a non-volatile default — no full table rewrite. The `UPDATE` takes a normal row-level lock, not a table lock.
- **Downstream:** hand-written TypeScript interfaces need updating in every file listed in I2–I5 (this repo does not use `supabase gen types`, so nothing regenerates automatically — a missed file fails silently at runtime, not at compile time, since Supabase `select()` strings aren't type-checked against the schema).
- **Reversibility:** `ALTER TABLE ... DROP COLUMN` x8 undoes this cleanly; `address` is untouched structurally (only its written *content* changes going forward).

**Verification:** migration applies cleanly locally; `select address_line1, barangay, barangay_code, city, city_code, province, province_code, zip_code from vendors limit 5;` after apply shows the backfilled `address_line1` and blank structured fields (including all three code columns) on existing rows.

**Executed 2026-07-22, corrected same day.** `20260722000001_vendor_address_fields.sql` created (exact SQL as drafted above, unchanged) and applied via `npx supabase migration up` against the local stack — verified via direct `psql`: `\d vendors` showed the 7 new columns with correct type/`not null`/`''` default; `address_line1` backfilled from `address` on all rows, other structured fields blank, as designed. After the D3 revision, `20260722000002_vendor_barangay_strict.sql` (the corrective migration above) was created and applied the same way — verified `barangay_code` now exists with the same shape, blank on all existing rows. Local `vendors` row count is 9 — confirms the "single-digit-to-low-hundreds" assumption noted in the blast-radius section above.

---

### I2 — Shared address helper + reusable components ✅ DONE (2026-07-22)
**Files (new):**
- `vendor/lib/address.ts` — `formatFullAddress({ addressLine1, barangay, city, province, zipCode }): string`, pure function, used by both the server route (I4) and the client profile service (I5). Mirrors the existing pure-validator pattern in `vendor/lib/validation.ts`. **Fixed, non-configurable concatenation order — specific to general, matching both PH postal convention and how geocoders (Nominatim/Google) resolve a free-text query left-to-right**: `` `${addressLine1}, ${barangay}, ${city}, ${province} ${zipCode}, Philippines` ``. Because every write path funnels through this one function (never ad hoc string-building at a call site), every vendor's `address` is uniform by construction — no per-caller drift. The function assumes all 5 inputs are non-empty (each is a required field by the time I3/I4/I5's validation lets a save through) — no defensive blank-part filtering.
- `vendor/lib/validation.ts` — add `isValidZip(zip: string): boolean` (4-digit PH format, format-only like `isValidPhone`, presence checked separately by callers).
- `vendor/components/ui/Combobox/Combobox.tsx` + `useCombobox.ts` (+ `.module.css` if the dropdown-list styling isn't trivial in Tailwind) — generic type-to-filter dropdown built on the already-installed `@radix-ui/react-popover` (no new dependency). **Revised during execution:** props ended up as `options: { value: string; label: string }[]` (not plain `string[]`), with `value`/`onChange` operating on `option.value` (the code) rather than the display label. Reason: the real PSGC data has duplicate names within a single scope (7 of 1,634 cities have two barangays sharing a name, e.g. two "San Isidro" entries in the same city) — a name-keyed `find()` would silently resolve to the wrong record for those. Keying strictly on the unique code closes that off entirely, consistent with the plan's own "codes are authoritative" principle applied uniformly. `placeholder`, `strict?: boolean` (when `false`, typed text commits directly as both value and label — there's no code to back free text), `disabled?` all unchanged from the original prop sketch. **Per revised D3, `AddressFields` (below) always passes `strict: true` for all three of Province/City/Barangay** — the non-strict mode remains a generic capability of the reusable `Combobox` (kept since it costs nothing and may suit a future field), it's just unused by this feature now.
- `vendor/components/address/AddressFields/AddressFields.tsx` + `useAddressFields.ts` (+ `.module.css`) — composes 3 `Combobox`es (Province → City → Barangay, each cascading, all `strict`) + 2 plain text inputs (Address Line 1, ZIP). Takes generic `{ values: {addressLine1, barangay, barangayCode, city, cityCode, province, provinceCode, zipCode}, onChange: (field, val) => void, errors? }` props so it plugs into **both** `useLoginPage`'s `regForm`/`updateRegForm` and `useProfilePage`'s `pd`/`updateDraft` unchanged — both already expose that exact `(field, val) => void` shape. Both the code and the display name are written on every selection (`onChange("province", name)` + `onChange("provinceCode", code)`, same pattern for city and now barangay), since the code is what downstream cascading/resolution relies on and the name is what's shown/persisted for display + `formatFullAddress()`.

  **Two flows through the same component, both driven by code, not name:**
  - **Forward (fresh selection, registration or a blank profile field):** user picks Province → its code filters `cities.json` down to that province's cities → user picks City → its code lazy-fetches `barangays/<cityCode>.json` → user picks Barangay from that list (strict — no unmatched free text accepted, same as Province/City).
  - **Reverse (loading an existing vendor's saved values for editing):** given `provinceCode`/`cityCode`/`barangayCode` already on the row, the hook resolves the initial dropdown state directly — `provinces.find(p => p.code === provinceCode)`, filter `cities.json` by `provinceCode` and preselect the entry with `code === cityCode`, then fetch that city's barangay file and preselect the entry with `code === barangayCode`. This is a direct code lookup against small, already-eager-loaded arrays (≤82 / ≤1,634 / the selected city's barangay list) — no fuzzy or name-based matching for any of the three, so it stays correct even if a future PSGC data refresh renames a city or barangay (the code is what's authoritative). Existing rows backfilled by I1 with blank `province_code`/`city_code`/`barangay_code` simply start with all three dropdowns empty — no special-casing needed beyond that.
- `vendor/public/ph-address/provinces.json`, `vendor/public/ph-address/cities.json`, `vendor/public/ph-address/barangays/<cityCode>.json` — static data. **Sourced from `psgc.gitlab.io/api`** (a maintained PSGC JSON mirror of the official PSA dataset) rather than the npm packages originally floated — fetched once via `curl` during implementation, trimmed to `{code, name}` (cities also carry `provinceCode`), and checked in. Actual counts: 84 provinces (81 real + 3 synthetic, see D6), 1,634 cities/municipalities, 42,046 barangays across 1,634 per-city files (~6.6 MB total, avg ~4 KB/file) — matches the plan's ~82/~1,634/~42,000 estimates. Fetched via plain `fetch("/ph-address/...")` (public dir — zero JS bundle cost), cached in a module-level variable in `useAddressFields.ts` after first load so re-opening the form doesn't refetch.

**Styling separation (per `skills/component-separation.md`):** both `Combobox.tsx` and `AddressFields.tsx` are render-only — no `useState`/`useEffect`/filtering logic/fetch calls in either `.tsx` file, all of that lives in `useCombobox.ts`/`useAddressFields.ts`. The dropdown-list panel (open/close positioning, option highlight, scroll) is non-trivial geometry, not a handful of Tailwind utilities, so it gets its own `Combobox.module.css` rather than inline `style={{}}` — same reasoning the KYC camera widget already sets precedent for (`CameraCapture.module.css`). No static inline style objects in either component; the only inline styling allowed is a genuinely dynamic runtime value (e.g. dropdown vertical offset computed from viewport space), if one turns out to be needed. Both `.tsx` files are theme-aware — colours come entirely from the app's `--sp-*` custom properties (`var(--sp-input-bg)` etc.), never hardcoded, per `conventions.md`'s Styling Conventions. **Flagging for I3:** `LoginPage.module.css` is a permanently-dark surface independent of `next-themes` (no `.dark` class scoping applied to it), so when `AddressFields` is wired into `LoginPage.tsx`, that usage needs a local `className="dark"` wrapper around it so the `--sp-*` tokens resolve to their dark values regardless of the site's actual light/dark setting — otherwise it would render light-styled inputs on the dark login gradient if a user's system theme is light. `ProfilePage` (I5) needs no such wrapper — it's already theme-toggle-integrated.

**Verification:** `npx tsc --noEmit` in `vendor/` — clean. Visual check: no `.tsx` file in this item contains a `useState`/`useEffect`/static `style={{}}` block (confirmed by grep — the one `style={{}}` in `Combobox.tsx` is the Radix-computed `--radix-popover-trigger-width`, the anticipated dynamic-value exception).

**Executed 2026-07-22.** All files created as described above (with the Combobox/PSGC-source revisions noted inline). Verified with a temporary, deleted-before-completion scratch page (`app/dev-i2-scratch/`, not part of the plan's deliverables) driven by Playwright against the local dev server (port 3100):
- **Forward cascade:** picked "Metro Manila" (synthetic pseudo-province, D6) → City combobox enabled, scoped correctly → picked "Quezon City" → Barangay combobox enabled, fetched `barangays/137404000.json` on demand → picked "Bagong Pag-asa" → final state exactly `{province: "Metro Manila", provinceCode: "NCR", city: "Quezon City", cityCode: "137404000", barangay: "Bagong Pag-asa", barangayCode: "137404009"}`.
- **Cascading reset:** switching Province away (to "Laguna") correctly cleared City/CityCode/Barangay/BarangayCode back to `""`.
- **Strict-mode rejection:** typing unmatched text ("zzz-not-a-real-province") into Province and blurring reverted the input back to the last valid value ("Laguna") — confirms no unmatched value can ever reach `onChange`.
- **Reverse-resolution (I5's future use case):** mounted the component with only codes + saved display names pre-set (simulating a loaded vendor record) — all three comboboxes correctly displayed the resolved labels ("Metro Manila" / "Quezon City" / "Bagong Pag-asa") and both dependent combos were enabled, not stuck disabled, purely from the code-driven lookups.
- Screenshot taken confirming clean layout (disabled states visibly greyed, no visual breakage).
- Scratch page, its two Playwright scripts, and the stale `.next` cache it produced were all removed afterward; `git status --short` and a final `tsc --noEmit` confirm only the real I2 deliverables remain and the app still type-checks clean.

---

### I3 — Registration wizard (Step 1) ✅ DONE (2026-07-22)
**Files:**
- `vendor/components/auth/LoginPage/useLoginPage.ts:17-27` — `RegForm`: replace `address: string` with `addressLine1, barangay, barangayCode, city, cityCode, province, provinceCode, zipCode: string`. Update `EMPTY_REG:29`. (`barangayCode`/`cityCode`/`provinceCode` ride along purely so I4 can persist them — registration is always a forward/fresh selection, so nothing in this step needs to *resolve* a code back to a dropdown state, unlike I5.)
- `:75-89` (draft restore) and `:92-97` (draft autosave) — swap `address` for the 8 new fields.
- `:102` (`computeResumeStep`) — the existing check `!regForm.vendorName.trim() || !regForm.address.trim()` extends to the new required fields (matching the completeness bar the field already sets today, not introducing a stricter bar than `handleDetailsContinue` already enforces).
- `:192-203` (`handleDetailsContinue`) — require `addressLine1`, `province`, `city`, `barangay`, `zipCode` (format-checked via `isValidZip`) alongside the existing `vendorName`/`phone` checks, with a clear error message. Barangay's presence check is now the same shape as Province/City's (non-empty string, already guaranteed to be a valid pick since I2's strict `Combobox` can't produce an unmatched value) rather than a lenient string check.
- `:316-333` (`handleSubmitKyc`) — pass the 8 new fields to `submitKyc` instead of `address`.
- `vendor/components/auth/LoginPage/RegisterField.tsx:9` — the `field` union type: `address` is replaced by `addressLine1`/`zipCode` only (those two stay plain text inputs via `RF`); `barangay`/`city`/`province` (+ their codes) are rendered by `AddressFields`'s `Combobox`es instead, not `RF`.
- `vendor/components/auth/LoginPage/LoginPage.tsx:300` — replace the single `RF label="Main Branch Address"` line with `AddressFields` (per I2, it already owns all 5 visible fields — 3 comboboxes + Address Line 1 + ZIP — no separate `RF` instances needed alongside it). **Wrap it in `<div className="dark">`** — discovered during I2: `LoginPage` is a permanently-dark surface independent of `next-themes`, so without this wrapper `AddressFields`' `--sp-*`-token styling would follow the site's actual theme setting instead of always rendering dark, breaking visually whenever a user's light/dark preference is light.
- `vendor/lib/kycDraft.ts:5-16` — `KycDraft` interface: swap `address` for the 8 fields. **Bump the localStorage key** from `vendor-onboarding-draft-v1` to `...-v2` — an old draft shaped for the previous field won't match the new `KycDraft` type at runtime (its `addressLine1` etc. would be `undefined`, not `""`, and `.trim()` on `undefined` throws). A version bump makes `loadKycDraft()` simply return `null` for old drafts instead of needing defensive checks. Acceptable, minor side effect: any vendor with an in-progress draft loses it and restarts Step 1 — flagging explicitly, not fixing around it.
- `vendor/services/kyc.service.ts:31-61` — `SubmitKycParams.form` + FormData field names: swap `address` for `addressLine1`, `barangay`, `barangayCode`, `city`, `cityCode`, `province`, `provinceCode`, `zipCode`.

**Verification:** manual — register flow through Step 1 with province/city/barangay cascading correctly, Barangay cannot be submitted with an unmatched value (strict combobox, same as Province/City), ZIP format-checked, resume-from-draft still lands on the right step after the key bump.

**Executed 2026-07-22.** All files changed as described. `npx tsc --noEmit` clean. Verified live via Playwright against `/ui-gallery?mode=login&theme=light` (dev server, port 3100 — the `theme=light` param deliberately stress-tests the `className="dark"` wrapper, since a broken wrapper would show light-styled inputs on the dark login gradient):
- Clicked through the real "Register Your Business" flow (not a shortcut) into Step 1.
- Filled Province ("Metro Manila", the D6 synthetic pseudo-province) → City ("Quezon City") → Barangay ("Bagong Pag-asa") — cascade worked identically to I2's isolated test, now inside the actual dark login surface. Screenshot confirmed `AddressFields` renders correctly dark-styled despite the site-wide theme being light — the wrapper works.
- Clicking Continue with phone still empty stayed on Step 1 (blocked, as expected — required-field gate holds).
- Filling phone and retrying Continue advanced to "Step 2 of 6 — Account setup".
- `localStorage` after that Continue contains exactly one key, `vendor-onboarding-draft-v2` — confirms the key bump landed and the draft shape matches.
- Reloaded the page (fresh session) and clicked "Register Your Business" again — `computeResumeStep()` correctly resumed at **Step 2** (business details complete from the persisted structured fields, account setup not yet done), not Step 1.
- Two throwaway Playwright scripts used for this were deleted afterward; `git status --short` and a final `tsc --noEmit` confirm only the real I3 file changes remain.

**Known gap, expected per the plan's own I3+I4 coupling note:** the wizard now sends `addressLine1`/`barangay`/`barangayCode`/`city`/`cityCode`/`province`/`provinceCode`/`zipCode` to `/api/auth/register`, but that route (I4) hasn't been updated yet — it still expects the old `address` field. **Step 6's actual "Submit Application" will fail until I4 lands** (server-side validation will reject the missing `address` field). This doesn't block I3 itself (nothing in I3's own scope reaches the server), but the registration flow isn't end-to-end functional again until I4 ships, exactly as the plan's execution order anticipated by grouping them in the same batch.

---

### I4 — Atomic register route (server) ✅ DONE (2026-07-22)
**File:** `vendor/app/api/auth/register/route.ts:27-39` (parse+validate), `:104-112` (insert)

- Parse `addressLine1`, `barangay`, `barangayCode`, `city`, `cityCode`, `province`, `provinceCode`, `zipCode` from `FormData` (same `str()` helper pattern already used).
- Validate the 5 display/text fields as required (replacing the current `!address` check at `:39`), plus `isValidZip(zipCode)` format check — mirrors the existing `isValidPhone(phone)` check at `:43`. `provinceCode`/`cityCode`/`barangayCode` are not independently validated beyond being non-empty strings — they're opaque identifiers the client already resolved via the strict Province/City/Barangay combobox selection (D3), the server just persists them.
- On insert (`:104-112`): write `address_line1`, `barangay`, `barangay_code`, `city`, `city_code`, `province`, `province_code`, `zip_code` as their own columns, and `address: formatFullAddress({ addressLine1, barangay, city, province, zipCode })` for the synced flat string (the codes don't participate in the flat string — display names only, per I2's fixed template).

**Verification:** server-side rejection of a submission missing any of the 5 fields or with a malformed ZIP (defense-in-depth — same reasoning as the existing phone check, since this route has no session yet and is the real gate).

**Executed 2026-07-22.** All changes as described. `npx tsc --noEmit` clean. Verified live by POSTing directly to `/api/auth/register` (dev server, port 3100) with real multipart FormData against the local Supabase stack:
- Missing `addressLine1` → `400 { error: "Missing required fields." }`.
- `zipCode: "abcd"` (letters) → `400 { error: "Please enter a valid ZIP code." }`.
- `zipCode: "123"` (3 digits) → same rejection — confirms `isValidZip`'s exact-4-digit rule is enforced server-side, not just client-side.
- A fully valid submission → `200` with a real `vendorId`. Queried the resulting row directly via `psql`: `address_line1/barangay/barangay_code/city/city_code/province/province_code/zip_code` all persisted exactly as sent, and `address` = `"123 Rizal St, Bagong Pag-asa, Quezon City, Metro Manila 1105, Philippines"` — matches `formatFullAddress()`'s template exactly, confirming I3's client fields, I4's server persistence, and I2's formatter all agree end-to-end.
- **Registration is end-to-end functional again** — this closes the gap I3 flagged (client sent the new fields; server now accepts and persists them correctly).
- Test data (auth user, vendor row, and the one uploaded KYC Storage object) fully cleaned up afterward via the Auth Admin API + direct `psql`/Storage delete — confirmed zero rows/objects remain. Test script removed; `git status --short` shows only the real I4 file change.

---

### I5 — Profile page (Location section) ✅ DONE (2026-07-22)
**Files:**
- `vendor/lib/types.ts:120-133` — `VendorProfile`: replace `address: string` with the 8 structured fields (`addressLine1, barangay, barangayCode, city, cityCode, province, provinceCode, zipCode`). `address` itself is dropped from the type entirely — the Profile page authors the structured fields; it never needs to read the app-computed flat string back.
- `vendor/services/profile.service.ts:4-15` (`DbVendorRow`), `:17-30` (`toProfile`), `:32-41` (`getVendorProfile` — extend the `select()` column list to include `barangay_code`, `city_code`, `province_code`), `:43-64` (`updateVendorProfile` — write the 8 columns + recompute `address` via `formatFullAddress()`, same as I4).
- `vendor/components/profile/ProfilePage/ProfilePage.tsx:74-77` — **revised during execution:** rather than unconditionally replacing `<Field label="Address" .../>` with `<AddressFields .../>` (which would leave the Location section always showing live editable comboboxes, breaking the read/edit toggle every other section on this page uses), the Location block now branches on `profileEditing` — `<AddressFields values={pd} onChange={updateDraft} />` when editing, otherwise a plain-text line built with `formatFullAddress(profileData)` (falling back to `addressLine1` alone, then `"—"`, matching the existing `Field` component's empty-value convention). Reuses `formatFullAddress` directly in the render layer — an accepted existing pattern in this codebase (`catColor`/`statusStyle` etc. are called the same way from `.tsx` files), not business logic.
- `useProfilePage.ts` — no changes needed; `updateDraft`/`pd` are already generic over `keyof VendorProfile`.
- **This is the flow that exercises I2's reverse-resolution path**: `getVendorProfile` returns the vendor's saved `provinceCode`/`cityCode`/`barangayCode` along with the display names; `AddressFields`/`useAddressFields` uses those codes (not the names) to pre-select Province, filter+pre-select City, fetch that city's barangay file, and pre-select Barangay — same mechanism described in I2, just entered from a loaded record instead of a blank form.

**Verification:** manual — edit an existing vendor's profile, confirm province/city/barangay all pre-select correctly (by code) from saved values, save, reload, confirm persistence; confirm the vendor list / booker vendor card still show a sensible `address` string afterward. Separately, edit a vendor row that only went through I1's backfill (blank `province_code`/`city_code`/`barangay_code`, non-blank `address_line1`) and confirm all three dropdowns start empty rather than erroring.

**Executed 2026-07-22.** All changes as described (with the read/edit-toggle revision noted above). `npx tsc --noEmit` clean. Verified live end-to-end via Playwright against a real logged-in session (registered a test vendor through the real `/api/auth/register` flow, activated it directly via `psql` since Command-portal activation is out of scope here, then signed in through the actual login form — not a shortcut):
- **Read view:** Location section showed `"123 Rizal St, Bagong Pag-asa, Quezon City, Metro Manila 1105, Philippines"` — exactly `formatFullAddress()`'s output, screenshot-confirmed clean layout matching the page's existing card style.
- **Reverse-resolution (I2's core promise, now proven on the real edit path, not just the isolated I2/mount tests):** clicking "Edit Profile" pre-filled Province/City/Barangay with the correct saved labels, and both City and Barangay comboboxes were already enabled (not stuck disabled) — confirms `provinceCode`/`cityCode`/`barangayCode` round-trip correctly through `getVendorProfile`.
- **Edit + cascade + save:** changed City from "Quezon City" to "Marikina" mid-edit — Barangay correctly refetched and reset to Marikina's own list (picked "Barangka"), changed ZIP to "1112", clicked Save Changes.
- **Persistence:** after save, the read-only view updated to `"123 Rizal St, Barangka, City of Marikina, Metro Manila 1112, Philippines"` — confirms `updateVendorProfile`'s write + recompute path works correctly on the real DB, not just I4's registration insert path.
- Test user, vendor row, and its one KYC Storage object were fully cleaned up afterward (Auth Admin API + `psql` + Storage delete, confirmed zero residue). Scratch scripts removed; `git status --short` shows only real file changes; final `tsc --noEmit` clean.
- **Not covered by this pass** (needs a second real vendor record to set up, deferred as acceptable — the underlying mechanism is identical to the already-verified I2 mount test with blank codes, just now inside the real page): editing a vendor that only went through I1's plain backfill (blank `*_code` columns) to confirm the three dropdowns start empty rather than erroring in the live page. The isolated I2 Playwright test already exercises this exact blank-codes case with the same hook, so the residual risk here is very low.

---

### I6 — Sync architecture docs to the new address shape ✅ DONE (2026-07-22)
**Files:**
- `architecture/schema.md:163` — `vendors` table: add rows for `address_line1`, `barangay`, `barangay_code`, `city`, `city_code`, `province`, `province_code`, `zip_code`; update `address`'s note to reflect it's now app-computed (mirror I1's column comment).
- `architecture/schema.md:185` — "Two write paths to `vendors`" table: update the self-registration row's written-fields list to include the 8 new columns (keep `address`, now computed rather than user-typed).
- `architecture/vendor-kyc.md:55` — registration Step 1 field list: replace `address` with `address line 1, barangay, city, province, zip code` (matches I3's field set).
- `architecture/portals.md:149` — vendor Profile "Display and edit" field list: replace `address` with the same structured breakdown (matches I5's field set).
- **Added beyond the original 4 spots:** `architecture/schema.md`'s Migration History table (top of file) was also missing both `20260722000001_vendor_address_fields.sql` and `20260722000002_vendor_barangay_strict.sql` — it's the authoritative index of every migration, so leaving it stale would reintroduce the exact problem I6 exists to close. Added both rows, including a short note on why the barangay fix is a second migration rather than an edit of the first (per `AGENTS.md`).

**Verification:** diff review only — no code/schema impact, this item just keeps the docs truthful. Confirmed each edited line matches the field names actually shipped in I1/I3/I4/I5 (re-read the executed migrations and the final `VendorProfile`/route code while writing these edits, not from memory).

**Executed 2026-07-22.** All 4 planned spots updated, plus the Migration History addition noted above. All are prose/table edits — no code, no schema, no verification beyond re-reading the diffs against the actual shipped field names.

---

## Execution order

1. **I1** (migration) — independent, no app code depends on it existing to compile, but must land before any app code reads/writes the new columns.
2. **I2** (shared helper + components + static data) — independent of I1, can be built and reviewed in isolation (e.g. in a scratch page) before wiring into the two consumers.
3. **I3 + I4 + I6 together** (registration wizard + server route + doc sync) — I3/I4 coupled: the client sends the 5 fields, the server must accept them in the same submission. I6 rides along in this batch per D5 (its `schema.md`/`vendor-kyc.md` edits describe exactly the field set I3/I4 ship).
4. **I5** (Profile page) — depends on I1 (columns must exist) and I2 (reuses `AddressFields`), independent of I3/I4. I6's `portals.md` edit should land alongside this item too, once the Profile field set is confirmed built as planned.

## Verification

- **Machine-verifiable:** `npx tsc --noEmit` in `vendor/` after each item; migration applies without error in local Supabase.
- **Needs a live environment:** the actual cascading dropdown UX (province→city→barangay filtering, lazy barangay fetch), draft resume behavior after the localStorage key bump, and confirming booker/command still render a sane `address` string post-migration — all need a running dev server + browser, not just a type-check.

## DEFERRED / COSMETIC

- Actual geocoding (storing lat/lng, calling a geocoding API on save) — not asked for, no existing schema support, flagged as a natural follow-up now that the address data is structured enough to feed one.
- `command`'s vendor-creation flow still doesn't collect any address at all (`useCreateVendor.ts:15` hardcodes `address: ""`) — pre-existing gap, unrelated to this task, unaffected by the new columns (they default to `''` same as `address` does today).
