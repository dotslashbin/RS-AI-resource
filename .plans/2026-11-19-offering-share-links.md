# Shareable offering links (Booker + Vendor)

**Date:** 2026-11-19
**App / scope:** `booker/`, `vendor/`, `backbone/` (one additive RPC only)
**Status:** COMPLETE (2026-11-21) — built, reviewed, documented and released: staging (user-confirmed 2026-11-20) and production (user-confirmed 2026-11-21, P1–P4). Open items are parked, not blocking: F15, F19, F25.
**Release:** staging ✅ · production ✅ (2026-11-21)

> One-line framing: let a booker or vendor member share an offering as a link that opens Booker's public offering view, which an unregistered person can read without signing in, with a "sign up to book" invitation that returns them to that offering.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend (plan-local):** B# = Blocker, I# = Important, D# = Decision, F# = Finding, S# / P# = staging / production release step. Cross-plan references are qualified by app (e.g. "vendor I1").

> **Out of scope:** public browsing, search, marketplace pages, slots or availability for anonymous visitors, booking or payment without an account, vendor-page sharing, mobile apps (`ezzy-booker-mobile`, `ezzy-vendor-mobile`), shared packages, and any change to RLS policies on `offerings`, `vendors`, `offering_attachments` or `schedules`.

---

## ▶ RESUME HERE (closed 2026-11-21)
- **Done:** stages 1–4, the stage 1–4 review (F22–F26), I4 docs, and the release: staging S1–S4 (user-confirmed 2026-11-20), production P1–P4 (user-confirmed 2026-11-21; the user launched and tested production).
- **Commits:** booker `b3ffd27` (`release/version-0.33.0`), vendor `ab45a0c` (`release/version-0.62.0`), root `61521ec` (`master`), backbone `54ffbf0` (`develop`).
- **Affiliate:** `feature/affiliate_portal_groundwork` is rebased onto `develop` (verified 2026-11-21, F28). The affiliate work resumes in its own plan, `.plans/2026-11-14-affiliate-data-layer.md`, starting at F18.
- **Parked, not blocking:** F15 (re-run the SQL test after the affiliate set is applied locally), F19, F25.
- **Watch out for:** never merge `backbone` into `master`; deploy booker before vendor on any future release; `NEXT_PUBLIC_BOOKER_URL` must name the same environment's booker.
---

## BLOCKERS

### B1 — Public read path: one SECURITY DEFINER RPC  ✅ DONE (local) 2026-11-19  (approval gate: schema — approved 2026-11-19)
<!-- ✅ (2026-11-19) Applied locally by the user; verified by I3 (local) below. Staging and production follow at S1 / P2. -->
<!-- 🔄 (2026-11-19) File written to the spec below; NOT applied. Not ✅ until the user applies it locally and I3 passes. Grants follow 20261004000002, which records that this project's default privileges grant EXECUTE on every new function directly to anon, authenticated and service_role: so the file revokes from public, anon and authenticated, then grants anon, authenticated and service_role. The returned JSON omits the offering id too (the caller already has it). -->

**Files:** new `backbone/supabase/migrations/20261117000001_public_offering_rpc.sql` — version per **D11**, so it sorts before the unapplied affiliate set `20261118000001`–`06`. The header comment states it was written 2026-11-19 and why the version is earlier. Photos: `storage_path is not null`, ordered by `sort_order` (F12).
**Gap:** no `anon` role can read any offering today. `offerings`, `vendors`, `offering_attachments` and `schedules` are `to authenticated` only (`20260506000001_offerings.sql:62-68`, `20261118000006_vendor_read_requires_booker_portal.sql:27`, `20260829000001_offering_attachments.sql:129`, `20260507000002_schedules.sql:114`). `anon` has no table grants (`20260620000001_api_role_grants.sql`).
**Fix:** create `public.get_public_offering(p_offering_id uuid) returns jsonb`:
- `language sql`, `stable`, `security definer`, `set search_path = public`.
- Returns `null` unless the offering has `is_active = true` **and** its vendor's status is `active` (join `statuses`, as the vendor-read policy does).
- Returns only: offering `name`, `category`, `description`, `price`, `duration_minutes`, `duration_unit`, `division` (slug and name), vendor `name`, `city`, `province`, and an ordered array of active `kind = 'photo'` attachments (`storage_path`, `title`, `sort_order`).
- Excluded by construction: `code`, `fulfilment_pattern`, `tagline`, `phone`, `address`, `operating_hours`, `email`, schedules, staff, slot counts, `requirements`, waiver agreements, `vendor_id`, `created_by`.
- `revoke execute on function … from public, anon, authenticated;` then `grant execute … to anon, authenticated;` (the acknowledge-RPC precedent is `20260801000004_booking_acknowledgement_rpc.sql:91-92`).
- Grant pattern: no table grants change.
**Blast radius (for the approval):**
- *Data:* read-only function; no rows written, none rewritten.
- *Lock / performance:* a single-row lookup by primary key plus one attachment query; no lock beyond the catalogue reads it replaces.
- *Downstream:* no existing caller; no type regeneration (hand-written types, `lib/types.ts` / service interface gets one new shape).
- *Reversibility:* `drop function public.get_public_offering(uuid);` — no dependents.
- *Coupling:* independent of `20261118000006` because the function is `security definer` and does not read `vendors` under the caller's RLS. Verified by I3.
**Gate:** written here, **not applied**. Per the workspace rule the user applies migrations; I do not run `db push`. Waiting on approval.

### B2 — Booker: open a public offering before the sign-in gate  ✅ DONE (local) 2026-11-19
<!-- ✅ (2026-11-19) Built: `lib/sharedOffering.ts` (uuid-validated parser, one unavailable wording) + test; `PublicOffering` type; `getPublicOffering` in `services/offerings.service.ts` (null = unavailable, error = failed call); `components/explore/PublicOfferingPage/` (render `.tsx`, `usePublicOfferingPage.ts`, `.module.css`); `useAppShell.ts` reads `?offering=` through `useSyncExternalStore` (server snapshot "", so no hydration mismatch and no setState-in-effect), adds `authView` + `showSignUp`/`showLogIn`/`leaveSharedOffering`, and `afterLogin` → `openSharedOffering` (strips the parameter first, asks the RPC, then `goOffering(id, null)`); `AppShell.tsx` renders the public page before `LoginPage` and takes the vendor from the offering when `selection.vendorId` is null (offering AND booking branches; `selection` is read nowhere else, grep-checked).
  Component split (F10): PublicOfferingPage.tsx renders only (no hooks, handlers come in as props or from the hook); usePublicOfferingPage.ts owns fetch/retry/derived labels (loading derived from a keyed result, P2); PublicOfferingPage.module.css holds public-only layout and reuses OfferingPage.module.css for shared visuals (F20). One inline style: the single-photo backdrop URL, the same dynamic value OfferingPage keeps inline.
  Verified (machine): `npx tsc --noEmit` exit 0; `npm test` 354/354 (5 new parser cases); `npm run lint` 18 problems = baseline, none in touched files; full Playwright suite 212/212 against committed baselines (Playwright's own server, PW_TEST=1).
  Verified (live, local stack, booker dev :3200, throwaway script in the session scratchpad): 21/21 — signed-out direct visit and refresh show the public page; RPC response keys are exactly the whitelist; no booking control, requirements, agreements or staff; phone order head → sign-up → Where; no horizontal overflow; no console errors; unknown id → unavailable page, "Go to …" drops ?offering and shows login; malformed id → login page with no RPC call; "Sign up to book" opens registration keeping ?offering; "Log in" → sign in (seed booker) → that offering's page; ?offering stripped after opening and a refresh lands on Home (F6); signed-in + unknown id → toast (F18); vendor-only account refused by the access gate, then the link shows the public page (F7). Screenshots checked in dark and light.
  Not verified here: staging (S4). -->
**Files:**
- `booker/components/layout/AppShell/AppShell.tsx:171-172` — the `recoveryMode` and `!loggedIn` branches. A new branch goes *above* `!loggedIn` when `?offering=` is present.
- `booker/components/layout/AppShell/useAppShell.ts` — read the parameter once on mount; hold it in state; after `afterLogin`, open that offering (or the unavailable page). Reads `URLSearchParams` the way `useAppShell.ts:386` already does.
- `booker/services/offerings.service.ts` — new `getPublicOffering(id)` calling `supabase.rpc("get_public_offering", …)`, mapping to a typed `PublicOffering` interface in `booker/lib/types.ts`. Returns `null` for "unavailable".
- New component `booker/components/explore/PublicOfferingPage/` — `PublicOfferingPage.tsx` (render only), `usePublicOfferingPage.ts` (fetch, state, handlers), `PublicOfferingPage.module.css`. Per component-separation.
**Gap / approach:** today the open offering is client state and nothing reads a URL. Signed-in bookers keep the existing `OfferingPage` (full booking). Signed-out visitors get the new view. The signed-in path resolves the id against the catalogue (RLS-limited, so a non-bookable offering falls through to unavailable).
**Fix direction:** keep the existing `OfferingPage` untouched; only the entry point changes.
**Verification:** the "Verification" section below (signed-out direct visit and refresh, signed-in path, unavailable cases, F6, F7, F9).

### B3 — Booker: Share button on the offering page  ✅ DONE (local) 2026-11-19
<!-- 🔄 (2026-11-19) Helper done: `booker/lib/shareLink.ts` exports `offeringShareUrl(origin, id)` (the caller passes `window.location.origin`, so the helper stays pure) and `shareLink(url, title, api)` returning "shared" | "copied" | "cancelled" | "failed"; a dismissed share sheet does NOT fall back to copying. Verified: `npm test` 349/349 pass, including 11 new cases; `npx tsc --noEmit` exit 0. The button and hook wiring are stage 3. -->
<!-- ✅ (2026-11-19) `OfferingPage.tsx` gets a toolbar (Back left, Share right, 44px target) and wires `share` from `useOfferingPage.ts`, which builds the link from `window.location.origin` and toasts only on "copied" or "failed". Styles in `OfferingPage.module.css` (`.toolbar`, `.share`). Verified live: Share in headless Chromium (no share sheet on Linux) copied `http://localhost:3200/?offering=<id>` and showed "Link copied". The native share sheet path needs a phone (S4). -->

**Files:**
- `booker/components/explore/OfferingPage/OfferingPage.tsx` — presentational button only.
- `booker/components/explore/OfferingPage/useOfferingPage.ts` — the `share` handler (state-free; calls the helper).
- New `booker/lib/shareLink.ts` — `offeringShareUrl(id)` = `${window.location.origin}/?offering=${id}`, plus `shareOffering(url, title)` using `navigator.share` when available and `navigator.clipboard.writeText` otherwise, returning a result the hook turns into a toast (booker already uses `sonner`).
**Decision reference:** D5 (share UI), D4 (link format). Origin is the current app's origin, which is correct for Booker (D1).
**Test:** `booker/lib/shareLink.test.ts` (node test) for URL building and the fallback choice.

### B4 — Vendor: Booker-origin config and Share on the offering card  ✅ DONE (local) 2026-11-19  (approval gate: env var — approved 2026-11-19; Vercel value set at S2 / P3)
<!-- 🔄 (2026-11-19) Helpers done: `vendor/lib/bookerLink.ts` (`parseBookerOrigin`, `bookerOfferingUrl`, null when unset/invalid, reads `process.env.NEXT_PUBLIC_BOOKER_URL` literally at call time) and `vendor/lib/shareLink.ts` (a copy of booker's; only header comments differ, checked with diff). Verified: `npm test` 600/600 pass, including 11 + 6 new cases; `npx tsc --noEmit` exit 0; `npm run lint` exit 0 (0/0 kept). The card button, handler and Vercel variable are stage 4 and release. -->
<!-- ✅ (2026-11-19) `useOfferingsPage.ts`: `canShare(o)` (active AND a Booker origin configured) and `shareOffering(o)` (Booker link, `shareLink`, toast on copied/failed). `OfferingsPage.tsx` passes `onShare` only when `canShare(o)`, following the page's existing inline-closure wiring. `OfferingCard.tsx` stays render-only: optional `onShare` prop, a Share button beside Performance/Edit, icon-only below `sm` like Performance (aria-label "Share <name>"). Same tailwind button classes as its neighbours (the card has no module CSS); like them it is under 44px tall — a pre-existing card-wide trait, not changed here.
  Verified (machine): `npx tsc --noEmit` exit 0; `npm run lint` exit 0 (0/0 kept); `npm test` 600/600; full Playwright suite 219/219 against committed baselines (Playwright's own server).
  Verified (live, local stack; vendor dev :3100 with NEXT_PUBLIC_BOOKER_URL=http://localhost:3200 on the command line, booker dev :3200; seed vendor `dante`): 8/8 — Share on all 5 active cards; Share copies `http://localhost:3200/?offering=<uuid>` (Booker origin, not vendor's); that link opened signed out shows Booker's public page for the same offering; after switching the offering inactive in the UI, Share is hidden (D8); switched back, Share returns (DB re-checked: 5/5 active); no page errors; phone width: no horizontal overflow, Share icon-only. Restarted vendor WITHOUT the variable: 2/2 — no Share on any card, page intact.
  Not verified here: Vercel value per environment and the production check that vendor links point at production Booker (F11, P4). -->

**Files:**
- New env name `NEXT_PUBLIC_BOOKER_URL` in `vendor/` — read in one helper, `vendor/lib/bookerLink.ts`, which returns `null` when unset or invalid (same `toOrigin` style as `vendor/lib/siteUrl.ts`). Do not reuse `NEXT_PUBLIC_APP_URL`, which is vendor's own origin (`vendor/lib/siteUrl.ts:47`).
- `vendor/components/offerings/OfferingCard/OfferingCard.tsx` — new button next to Performance and Edit (`:213-219`), prop `onShare`, rendered only when the offering is active and the helper returns a URL (D8, and no broken link when unset).
- `vendor/components/offerings/OfferingsPage/useOfferingsPage.ts` — `shareOffering(offering)` handler; the card stays render-only, as its existing props already are.
- `vendor/lib/shareLink.ts` — shared helper for the URL and the same `navigator.share` / clipboard fallback (copied, not shared, per the no-shared-package rule).
**Gate:** a new env variable on Vercel for vendor (staging and production). Approval required. Per environment the value is the booker deployment's origin.
**Test:** `vendor/lib/bookerLink.test.ts` — unset, invalid and valid origins, and a trailing-slash case.

---

## IMPORTANT

### I1 — Public view content and invitation  ✅ DONE (local) 2026-11-19 — verified with B2
Shows the Q3 fields only (B1). No slots, counts, booking control, schedules or staff. Primary action "Sign up to book" opens the registration view with the offering id carried through (D4). A secondary "Already have an account? Log in" keeps the same parameter. Photos use the existing public bucket URL helper (`booker/services/offeringPhotos.service.ts:38` `publicUrl`) — the image host is already allowed in `img-src` (`booker/AGENTS.md`), so no CSP change.
**Files:** the new `PublicOfferingPage` (B2) and the register/login return in `booker/components/auth/LoginPage/useLoginPage.ts`.

### I2 — Unavailable state  ✅ DONE (local) 2026-11-19 — signed out: the page; signed in: a toast with the same wording (F18). Error (call failed) is a separate "try again" card. Verified with B2
One neutral page for every unavailable case (D7): `get_public_offering` returns `null`, invalid uuid, removed, inactive offering, inactive vendor. The message does not reveal whether the offering existed. Link to Booker home.
**Files:** `PublicOfferingPage` (same component, a `status` state: `ready | unavailable`).
**Invalid uuid:** the client rejects a malformed id before the call; the database `uuid` cast must not raise an error that leaks as a 500 — check during B1 that a non-uuid never reaches the function.

### I3 — Regression: anonymous access stays limited to the RPC  ✅ DONE (local) 2026-11-19 — staging re-check at S4
<!-- ✅ (2026-11-19) Run read-only against the local DB via `docker exec … psql` (writes only inside rolled-back transactions):
  history has 20261117000001; function is security definer, stable, search_path=public; EXECUTE held by anon, authenticated, service_role (+ owner postgres).
  As anon: select on offerings, vendors, offering_attachments, schedules → "permission denied" for all four.
  As anon on an available offering: top-level keys exactly category, description, division, duration_minutes, duration_unit, name, photos, price, vendor; vendor keys city, name, province; division keys name, slug; photo keys storage_path, title; price is a number. No code, tagline, fulfilment_pattern, id.
  An offering with 1 document + 1 photo returns 1 photo, matching the kind='photo' row (documents excluded).
  Unavailable → NULL: random uuid; the offering set inactive (rolled back); an active offering of a throwaway pending_activation vendor (inserted and rolled back).
  Malformed id → `invalid input syntax for type uuid` (PostgREST answers 400; the client validates first, I2).
  authenticated can also call it. Nothing left behind (throwaway vendor count 0, offering still active).
  Not yet run: the after-affiliate-set re-run (F15) and the staging run (S4). -->
Verification (not a code change):
- With the anon key, `select` on `offerings`, `vendors`, `offering_attachments`, `schedules` still returns zero rows or a permission error.
- The RPC returns the agreed fields only; `code`, `tagline`, `fulfilment_pattern` are absent from the JSON.
- Passing an inactive offering, an inactive vendor, a random uuid and a malformed string each return `null` or an error without data.
- Confirms the B1 independence from `20261118000006`.

### I4 — Docs  ✅ DONE 2026-11-20
<!-- ✅ (2026-11-20) Written: auth-and-roles.md (anon grant exception, new "Public shared-offering read" section, signed-out row note, Security Notes anon bullet), schema.md (migration history row for 20261117000001), portals.md (Booker "Shared offering links", Vendor "Sharing an offering", parity row), production-env-checklist.md (NEXT_PUBLIC_BOOKER_URL row + per-variable warning), booker/AGENTS.md (Routing: the one `?offering=` parameter, F22 trap, shared stylesheet and specs), vendor/AGENTS.md (Routing comparison corrected, Environment list + NEXT_PUBLIC_BOOKER_URL warning). Verified by re-reading each edit; docs only, nothing to run. -->
Update `architecture/auth-and-roles.md` (new anon RPC, what it exposes), `architecture/portals.md` (Booker public offering view, Vendor share), `booker/AGENTS.md` (`?offering=` route note), `vendor/AGENTS.md` (`NEXT_PUBLIC_BOOKER_URL`, the Routing section's "no shareable links" comparison). Filled in at close.

### I5 — Owned-offering check in Vendor  ✅ DONE 2026-11-19 — [code] `getOfferings(vendorId)` filters `.eq("vendor_id", vendorId)` (`vendor/services/offerings.service.ts:43`), the member's selected vendor, under the vendor-admin read policy (`20260506000001_offerings.sql:71`). Share uses only the card's own offering
Vendor's list is already scoped to the member's vendors by RLS (`20260506000001_offerings.sql:71`, "vendor admins can read all their offerings"). Share uses only the offering already on the card; it does not widen the list. Verified by reading the existing query, not by a new query.

---

## DECISIONS
All resolved 2026-11-19 in the grilling session.
- D1 Vendor-generated links open Booker's public offering view → **Booker**, via `NEXT_PUBLIC_BOOKER_URL` in vendor (2026-11-19) — Vendor's own origin cannot produce a Booker link (`vendor/lib/siteUrl.ts:47`).
- D2 Public reads → **one `SECURITY DEFINER` RPC granted to `anon`**, not anonymous RLS policies (2026-11-19) — keeps the whitelist in one place; no broader table exposure.
- D3 Public fields → **name, category, description, price, duration and unit, division, vendor name, city, province, public photos** (2026-11-19, Q3 amended). Removed at the user's request: fulfilment pattern, vendor tagline, offering code.
- D4 Link format and return → **`/?offering=<uuid>`**; kept through sign-up and login (2026-11-19).
- D5 Share UI → **browser share sheet where available, otherwise copy-to-clipboard with a toast**; no new dependency (2026-11-19).
- D6 Vendor sharing scope → **every offering in the member's own vendor**, not only `created_by` (2026-11-19).
- D7 Unavailable offerings → **one neutral "no longer available" page with a link home** (2026-11-19).
- D8 Share on inactive Vendor offerings → **hidden** (2026-11-19) — a link to an inactive offering only shows D7.
- D9 Signed-out content → **price, duration and the Q3 fields shown; "Sign up to book" primary, "Log in" secondary**; no slots or booking controls (2026-11-19).
- D10 Booker's documented "no shareable links" decision (`vendor/AGENTS.md` → Routing, citing booker's plan P3) → **superseded for offerings only, by the user's request of 2026-11-19**. Booker still has no general URL routing; only `?offering=` is read. I4 updates both AGENTS files.
- D11 Migration version → **`20261117000001`** (resolved 2026-11-19). The user will ship this plan to `develop` and every environment **before** the affiliate work, then rebase `feature/affiliate_portal_groundwork` onto `develop`. This version sorts after local's latest applied `20261111000001` and before the unapplied affiliate set, so the affiliate files stay newer and apply later with no rename and no `--include-all`. Valid only while the affiliate set is unapplied everywhere (true 2026-11-19, F13). Rejected: `20261119000001`, which would make the whole affiliate set out of order on every environment (F14).
- D12 Link previews → **accept the generic Booker preview in this plan** (resolved 2026-11-19). A link pasted into Messenger, Viber or WhatsApp shows the generic app, not the offering; a per-offering preview needs server-rendered metadata and is a follow-up.
- Gates B1 (migration) and B4 (`NEXT_PUBLIC_BOOKER_URL`) → **approved by the user 2026-11-19**. Plan approval as a whole waits on the design preview below.
- Design preview: `.plans/previews/offering-share/` — **accepted by the user 2026-11-19** ("I accept that"), with the recommended choices: F1 sign-up before "Where" on phones (a requirement on B2); F2 "Sign up to book" keeps the Book button's style; F3 the "address shows once signed in" line stays.

## FINDINGS
- F1 Booker has no post-login return path today (`booker/components/auth/LoginPage/useLoginPage.ts`, `useAppShell.ts`). The return in I1 is new work, not an existing hook. Verified by reading both files.
- F2 Photo URLs come from `offering_attachments`, which is `to authenticated`. The `offering-photos` bucket is public, but the path lookup is not. The RPC returns the path, so anonymous visitors see photos without any table policy change. Verified by reading `offeringPhotos.service.ts:44-60` and `20260829000002_attachment_storage.sql:105`.
- F3 `20261118000006` (affiliate work, `.plans/2026-11-14-affiliate-data-layer.md`) removed the anonymous-adjacent `active users can read active vendors` policy. The RPC is `security definer`, so it is unaffected. I3 verifies this rather than assuming it.
- F5 **Signed-in deep link needs the catalogue loaded.** The catalogue loads only the first time Explore opens (`booker/components/layout/AppShell/useAppShell.ts:89`). B2's signed-in path must trigger that load, then open the offering, or show I2 when absent. Verified by reading the comment at that line; the load call itself to be traced at stage start.
- F6 **The parameter must survive the login remount and be consumed once.** Vendor solves the same problem with a peek/consume pair (`vendor/lib/divisionDeepLink.ts:34,50`). Booker gets the same small pattern, and strips `?offering=` with `history.replaceState` after use, so a later refresh does not reopen it.
- F7 **Signed-in non-bookers are signed out by the access gate** (comment at `useAppShell.ts:377`). A vendor member or affiliate opening a shared link must land on the public view after that sign-out, not on the bare login page. Add to Verification.
- F8 ✅ resolved 2026-11-19 [code]: `/api/register` creates the user with `email_confirm: true` and the client signs in in the same tab, so the return works for sign-up too; the email-confirmation plan is still DRAFT. If it ships, revisit this. Original note: **Sign-up return across email confirmation is unverified** [inferred]. Registration goes through `booker/app/api/register/route.ts`; `.plans/2026-10-29-booker-email-confirmation-flag.md` exists. If confirmation is on, the link in the email opens a new tab and in-memory state is gone. Per the original request ("where existing flows support it"), the return is guaranteed within the same tab; across the email link it is best effort. Confirm the flag's state at stage start.
- F9 ✅ (2026-11-19: `publicofferingphotos` gallery mode + 3 tests in `photo-aspect.spec.ts`, 16/16 pass) **New photo surface → visual test.** `booker/AGENTS.md` (Styling) requires every new photo surface to be added to `visual-tests/photo-aspect.spec.ts` (portrait, landscape, 4:1). Added to B2's verification.
- F10 **Missing per-component statements.** Plan-authoring flow step 4 requires each new or changed component to state its render/hook/style split and the ux-design check (both themes; booker defaults to dark, vendor to system). B2: `PublicOfferingPage` = render-only `.tsx`, `usePublicOfferingPage.ts`, `.module.css`. B3: `OfferingPage.tsx` gets a button only; the handler lives in `useOfferingPage.ts`. B4: `OfferingCard.tsx` gets a button and `onShare` prop only (it has no hook today and stays render-only); the handler lives in `useOfferingsPage.ts`. Read `.claude/skills/ux-design/SKILL.md` before stage 3.
- F11 **Vercel Promote and `NEXT_PUBLIC_BOOKER_URL`.** The value is baked in at build time. Vercel's current docs say promoting a preview rebuilds with production variables, which is how booker's `NEXT_PUBLIC_APP_URL` already works; older docs say promotion does not rebuild. P4 must check that production Vendor's Share link points at **production** Booker, not staging.
- F12 `offering_attachments.storage_path` is nullable (`PhotoRow.storage_path: string | null`, `booker/services/offeringPhotos.service.ts:29`). The RPC filters nulls.
- F13 **Migration state, 2026-11-19 [run, read-only]:** local DB latest applied is `20261111000001` (`supabase_migrations.schema_migrations`). The affiliate set `20261118000001`–`06` and its test `supabase/tests/affiliate_data_layer_test.sql` are **untracked** on `backbone` branch `feature/affiliate_portal_groundwork`, which has no commits beyond `develop`. The affiliate plan records them unapplied on local, staging and production (`.plans/2026-11-14-affiliate-data-layer.md:36,40`). Staging's history was not queried here.
- F14 **Out-of-order rule [code: CLI 3.2.0 help].** `db push` and `migration up` refuse a local file older than the newest applied version (the CLI's `ErrMissingRemote`) unless `--include-all` is passed. A version in the history table with no local file is the reverse error and points at `migration repair`.
- F15 **The two migration sets are independent [code].** No affiliate migration alters `offerings`, `vendors`, `statuses`, `offering_attachments` or `divisions`, and no function name clashes. The only overlap is `20261118000006` replacing the vendor read policy, which a `security definer` RPC does not use. So the final schema is the same in either order, and I3 should run once before and once after the affiliate set lands.
  ⏸ **PARKED 2026-11-20 — the after-affiliate re-run.** The user ships this plan first and the affiliate work after it is released, so the re-run cannot happen inside this plan. **Unblock:** when the affiliate set (`20261118000001`–`06`) is applied locally, run `backbone/supabase/tests/public_offering_rpc_test.sql` again; it is listed in the affiliate plan's resume checklist (affiliate F18). Not a blocker for this plan's release.
- F16 **Pre-existing, not this plan:** `stash@{0}` on `backbone` `develop` holds `20261110000001_paid_after_cancel_ledger.sql`, already older than local's `20261111000001`. Whenever it is resumed it needs `--include-all` or a new version. Reported only; status left to the user.
- F17 **Booker lint was already failing before this plan (pre-existing, reported only).** `npm run lint` in `booker/` on 2026-11-19: exit 1, `✖ 18 problems (14 errors, 4 warnings)`, all in files this plan has not touched (`app/not-found.tsx`, `app/ui-gallery/page.tsx`, `useLoginPage.ts`, `useBookingWizard.ts`, `useStep3Schedule.ts`, `Step6Confirm.tsx`, `StepPayment.tsx`, `useAppShell.ts`, `InstallPrompt`, `useSettingsPage.ts`, `booker.service.ts`). Booker's working tree held only this plan's two new files, so these come from `develop`. ⚠️ Stage 3 edits `useAppShell.ts`, which already has two of them: the stage-3 check is "no new problems", compared against this count. Fixing them is out of scope. Vendor lint is 0/0 and stayed 0/0.
- F18 **Signed-in unavailable link → a toast, not a page** (2026-11-19, a build-time choice). The signed-in app has no page to host the message, and a toast on Home keeps the booker inside the app. Same wording (`SHARED_OFFERING_UNAVAILABLE`), so D7's "one message" holds. Redirect if you want a full page instead.
- F19 **No way back to the offering from the sign-up or log-in view** (follow-up, not built). After "Sign up to book", LoginPage offers no "back to the offering" link. A refresh restores the public page (the parameter is kept until login), so nobody is stranded, but there is no on-screen route. Adding one means a new LoginPage prop. Not in this plan's scope.
- F20 **`PublicOfferingPage` imports `OfferingPage.module.css`** — the first cross-component CSS-module import in booker. Deliberate: the public page is the offering page minus the booking parts (D9), and sharing the photo/chip/title/price/button rules keeps them from drifting. The alternative, extracting a shared component out of `OfferingPage`, was a refactor this plan did not need.
- F21 **Pre-existing, reported only [inferred]:** `goVendor` (`useAppShell.ts`) reads `catalogueRef.current` right after `await loadCatalogue()`, but the ref is updated by an effect after React commits, which may land after that continuation on a cold catalogue. Then the vendor page's covers would be missing on first open. Not confirmed at runtime. `openSharedOffering` deliberately avoids this pattern.
- **Review of stages 1–4 (2026-11-19, before docs and release).** Read every diff as a reviewer, traced the surrounding behaviour read-only (reverse-engineering evidence rules), and closed what it found:
- F22 ✅ **Fixed: signed-in recipients saw Explore flash before the shared offering.** [code] A shared link always arrives on a fresh load, so `openSharedOffering` → `goOffering` switched to the offering page before the catalogue existed, and AppShell's fallback rendered Explore (which also starts its own fetches). Now the catalogue loads in parallel with the availability check and the page switches once; state is set directly because `goOffering` from the mount closure would re-fetch the catalogue (stale `catalogue.loaded`). `goOffering` reverted to its original `vendorId: string` signature. [run] A DOM observer during sign-in saw no Explore render; stage-3 smoke 21/21 again. Not proven: that the observer would have caught the old behaviour (not re-run against the old code).
- F23 ✅ **Test gaps closed.** Stage 2's checks were ad hoc and the plan needs them re-run (staging, F15), and the public page's states were covered only by a scratch script. Added `backbone/supabase/tests/public_offering_rpc_test.sql` (6 cases: grants and definer properties, anon refused on the four tables, exact whitelist and values, photo filtering incl. a body-only photo, NULL for inactive / non-active vendor / unknown id, authenticated call; rolled back, local only) — [run] all pass, nothing persisted. Added `booker/visual-tests/public-offering.spec.ts` (4 tests: available, unavailable, failed call → retry recovers, phone order) on the `publicoffering` gallery mode (renamed from `publicofferingphotos`) — [run] 4/4; full booker suite 216/216. The retry test first failed for a test reason: React Strict Mode mounts the effect twice in dev, so "fail the first call" hit the cancelled request; it now fails until "Try again" is clicked. This replaces the plan's earlier "node test for the getPublicOffering mapper": the spec exercises the mapping through the rendered page.
- F24 **Checked, not gaps:** (a) a vendor that is not active cannot share — the vendor dashboard opens only for an active, KYC-approved vendor [code: `vendor/components/layout/AppShell/useAppShell.ts:290-293`, `services/vendor-access.service.ts:114-118`]; (b) booker's service worker cannot serve a stale shared page or RPC — navigations are network-first and non-GET / cross-origin requests are never intercepted [code: `booker/public/sw.js:15-25`]; (c) the share sheet keeps the click's user activation on iOS — `shareLink` calls `navigator.share` synchronously before its first `await` [code: `lib/shareLink.ts`].
- F25 **Deferred (minor):** `get_public_offering` returns every active photo path while both pages show at most three. Harmless at current sizes; capping it needs a new migration (the applied one is not edited). Revisit only if vendors upload many photos.
- F27 **CLI 3.2 flags (found 2026-11-20 while writing the deployment guide) [run: `supabase db push --help`, `migration list --help`].** Both commands are "Local by default. Pass --remote for the linked project, or --remote=<ref|branch|url>"; `--linked` and `--project-ref` are no longer listed. The release table above was written with the old flags and is corrected. Without `--remote`, `db push` targets the LOCAL database.
- F28 ✅ **Affiliate rebase verified 2026-11-21 [run, read-only].** `feature/affiliate_portal_groundwork` is `50bcdd9` on top of `54ffbf0` (`develop`). The affiliate folder lists `20261117000001` before `20261118000001`–`06`. No rename was needed. The step-4 rebase in "Branching and migration order" is done.
- F26 **Docs inventory note:** `vendor/.env.local.example` lists only two keys, so it is not where variables are inventoried; `NEXT_PUBLIC_BOOKER_URL` goes into `vendor/AGENTS.md` → Environment and `architecture/production-env-checklist.md` (I4). No `ISSUES.md` exists in the workspace, so findings stay in this plan.
- F4 The `/grill-me` name does not resolve to its own skill; the `grill-me` file redirects to `grilling`, which ran. `reverse-engineering` references the skills `architecture-docs` and `best-practices`, which are not in `.claude/skills/`. Not blocking; for the user to decide whether to fix the reference.

---

## Execution order
0. **First (👤):** park the affiliate files and branch, per "Branching and migration order" below; resolve D11 and D12.
1. **Then, no approval needed:** write the B1 migration file only (not applied); write `shareLink` helpers and their node tests in both apps. (The booker public branch is stage 3: it changes behaviour for any `?offering=` URL, so it is not "invisible".)
2. **After approval of B1 and B4:** the user applies the migration locally; run I3 against the local database.
3. Booker code (B2, B3, I1, I2) and its tests; `npx tsc --noEmit`, `npm run lint`, `npm test`.
4. Vendor code (B4) and its tests; `npx tsc --noEmit`, `npm run lint` (0/0 baseline), `npm test`.
5. Staging release (below).
6. Production release (last).

Coupling: B4's Share links are dead-ends until the booker public branch ships. **Booker must deploy before Vendor** on every environment.

### Branching and migration order (`backbone/`)
The affiliate work and this plan share one `supabase/migrations/` folder and one local database. Rules, from F13–F15:
1. **Untracked files are not on any branch.** `git checkout -b` keeps the six affiliate files and their test in the folder, so `migration up` on the new branch would apply all seven, and `supabase test db` would run the affiliate test. Park them first: commit them on `feature/affiliate_portal_groundwork` (preferred, as a commit is named and cannot be popped wrongly), or `git stash push -u` with a message. `stash@{0}` already exists (F16), so a new stash shifts its index.
2. **Branch this plan from `develop`**, not from the affiliate branch.
3. **Version per D11: `20261117000001`.** Nothing ever needs `--include-all`, provided this plan reaches each environment before the affiliate set.
4. **Going back to the affiliate branch (the user's chosen sequence, 2026-11-19):** this plan merges to `develop` and deploys first; then **rebase `feature/affiliate_portal_groundwork` onto `develop`**. The affiliate commit only adds new files, so no conflicts are expected. After the rebase its folder holds `20261117000001` followed by `20261118000001`–`06`, which matches every environment's history.
   - **Rebase before running any `migration` command on that branch.** Checked out un-rebased, the folder lacks `20261117000001` while the local DB has it applied, so `migration list` shows it as remote-only and the CLI points at `migration repair`. **Do not repair**: marking it reverted leaves the function in place and the history wrong.
   - ✅ Done 2026-11-21 (F28): the affiliate branch now sits on `54ffbf0`, `develop`'s share commit, as `50bcdd9`.
   - The rebase rewrites the affiliate commit. That branch had no remote on 2026-11-19 (`git branch -a`). If it is pushed later, the rebase needs `git push --force-with-lease`.
5. **The local database does not switch with the branch.** A `db reset` rebuilds in filename order and **wipes local data**; it is destructive and needs your go-ahead.
6. Never merge to `backbone` `master` (the Supabase GitHub integration watches it).
7. The resume checklist for the affiliate side is recorded in `.plans/2026-11-14-affiliate-data-layer.md` F18 (added 2026-11-19).

## Release (§12)
### Staging (production untouched throughout)
| # | Who | Step | Check |
|---|---|---|---|
| ✅ S1 | 👤 | `npx supabase migration list --remote` → `npx supabase db push --remote --dry-run` → `npx supabase db push --remote` (adds `20261117000001` only; `--remote` alone = the linked project = staging) | ⛔ only this plan's migration pending — ✅ user-confirmed 2026-11-20 (not re-run by the agent) |
| ✅ S2 | 👤 | Set `NEXT_PUBLIC_BOOKER_URL` on the vendor staging deployment | ⛔ value is booker staging's origin — ✅ user-confirmed 2026-11-20 |
| ✅ S3 | 👤 | Deploy **booker** to staging, then **vendor** | — ✅ user-confirmed 2026-11-20 |
| ✅ S4 | 👤 + 🤖 | Staging checks (Verification below) | ⛔ all green — ✅ user-confirmed 2026-11-20 ("the feature works fine"); the agent did not run the live checks; the native share sheet was seen on Windows (Nearby Sharing, app list) |

⛔ **Staging fully green before anything touches production.**

**Safe-pause table** (DB first, then booker, then vendor):

| State | Safe? | Recovery |
|---|---|---|
| Migration applied, apps old | ✅ safe — the RPC has no caller | none needed |
| Booker new, vendor old | ✅ safe — booker public view works, vendor has no Share | none needed |
| Vendor new, booker old | ⛔ unsafe — shared links open booker's login page | redeploy booker first; never ship vendor alone |
| Vendor new, env var unset | ✅ safe — Share is hidden, no broken link | set the variable |

### Production (last stage)
| # | Who | Step | Check |
|---|---|---|---|
| ✅ P1 | 👤 | Parity: `npx supabase migration list --remote=<prod-ref>` (and `--remote` for staging) | ⛔ prod = staging minus this plan's migration — ✅ user-confirmed 2026-11-21 |
| ✅ P2 | 👤 | `npx supabase db push --remote=<prod-ref> --dry-run`, then without `--dry-run` | ⛔ same checks as S1 — ✅ user-confirmed 2026-11-21 |
| ✅ P3 | 👤 | Set `NEXT_PUBLIC_BOOKER_URL` on the vendor production deployment, then Vercel **Promote** the tested booker staging deployment, then the tested vendor staging deployment | — ✅ user-confirmed 2026-11-21 |
| ✅ P4 | 👤 + 🤖 | Production checks, including: production Vendor's Share link points at **production** Booker (F11) | ⛔ all green — ✅ user launched and tested on production, 2026-11-21 (the agent did not run the live checks) |

## Verification
Machine-verifiable (agent runs):
- `npx tsc --noEmit`, `npm run lint`, `npm test` in `booker/` and `vendor/`.
- Node tests: `shareLink`, `bookerLink`, `sharedOffering` (the mapper is exercised by `public-offering.spec.ts`, F23).
- `backbone/supabase/tests/public_offering_rpc_test.sql` locally (and again after the affiliate set, F15).
- `booker/visual-tests/public-offering.spec.ts` and the shared-link cases in `photo-aspect.spec.ts`.
- I3 SQL checks against the local database (run by the user, who applies migrations).

Needs a live environment (staging, then production) — user-confirmed: staging 2026-11-20, production 2026-11-21; the agent did not run these checks:
- Opening a shared link **signed out**, direct visit and refresh: the public view appears, not the login page.
- The public view shows only the Q3 fields; no code, tagline or fulfilment pattern in the page or in the network response.
- "Sign up to book" → register → lands back on the same offering; "Log in" does the same.
- Invalid id, removed offering, inactive offering, inactive vendor → the unavailable page, identical wording.
- Signed-in booker opening the same link → existing offering page with booking intact.
- Vendor Share on an active offering → link opens booker staging; on an inactive offering → no Share button.
- Share on a device with `navigator.share` (sheet) and on desktop (clipboard toast).
- Anonymous REST calls to the four tables still return nothing (I3, on staging).
- A signed-in vendor member or affiliate opening a Booker share link lands on the public view after the access gate signs them out (F7).
- Refresh after navigating away from a shared offering does not reopen it (F6).
- `visual-tests/photo-aspect.spec.ts` covers the public view's photos (F9).
- I3 runs before and after the affiliate set is applied (F15).

Not verified by this plan: booking or payment from a shared link beyond the sign-in invitation (out of scope); visual baselines for the new public page (defer to a follow-up unless you want them now).

## Docs
**Docs:** `architecture/auth-and-roles.md`, `architecture/schema.md`, `architecture/portals.md`, `architecture/production-env-checklist.md`, `booker/AGENTS.md`, `vendor/AGENTS.md` (2026-11-20, I4). Re-checked at close 2026-11-21: `schema.md`'s row records staging and production as applied.
