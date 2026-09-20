# Ezzy Booker Mobile — groundwork & design prototype

**Date:** 2026-09-18
**App / scope:** `./ezzy-booker-mobile` only. Every other folder is read-only reference this session. Web-booker changes are **proposed** here (the W items) and never actioned without separate approval.
**Status:** IN PROGRESS. D1–D14 resolved. S5 code ✅ DONE 2026-09-20; its visual review is blocked by I2 (screenshot tooling). **Synced to `2026-09-18-booker-home-search-redesign.md`** (second pass, 2026-09-18). Next: S0b (awaiting go-ahead).
**Preview artifact:** https://claude.ai/artifact/PbimGic8VSUJhnGAiuBZBX (private; republished per stage).

> Build the booker mobile app with **every feature of the web booker redesign** (`2026-09-18-booker-home-search-redesign.md`, whose layouts come from the design canvas), in booker's current look, kept in sync as that plan evolves. Work from mock data that can be swapped for real Supabase calls.

> *Before 2026-09-18 this plan designed its own screens from booker web's current look. That direction was discarded at the user's request; the record is kept below, marked superseded.*

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** F# = finding/flag, D# = decision, S# = build stage, P# = feature, G# = data gap, N# = sync note for the web session, W# = proposed web-booker change, M# = maps item. Numbers are plan-local; qualify cross-plan refs (e.g. "buildout-plan D1", "vendor-mobile D6-A").

---

## Scope

**In:** Phase 1 findings; the maps review; every feature in the web redesign plan and on the design canvas (P1–P31 below), plus the Account screen that carries the web hamburger drawer's contents, built in `ezzy-booker-mobile` against mock data, in light and dark.

**Out (this plan):** real Supabase wiring, auth/login screens, real payment, push, EAS builds, store submission, and any change to `booker`, `backbone`, `vendor`, or `command`. The old buildout plan's Ph1 (auth) still stands as the route to real data. See D8.

---

## Phase 1 — findings  ✅ DONE (2026-09-18, verified by reading the code at the cited paths)

### Tech stack of `ezzy-booker-mobile` today

It is the **untouched `create-expo-app` template**: one commit (`55a5c64 intitial commit`), no app code.

| Concern | Current state | Where |
|---|---|---|
| Framework | Expo SDK 57, React Native 0.86, React 19.2, React Compiler on | `package.json`, `app.json` `experiments` |
| Language | TypeScript ~6.0, strict, `@/*` → `./src/*` | `tsconfig.json` |
| Navigation | `expo-router` 57, typed routes; template `index` / `explore` tabs | `src/app/` |
| State management | None | — |
| Styling / theming | Template `constants/theme.ts`, `global.css`, `use-theme.ts`. None of it is booker's | `src/constants/theme.ts` |
| API layer | None. No `@supabase/supabase-js` installed | — |
| Auth | None | — |
| Web target | Enabled: `react-native-web` + `react-dom` present, `npm run web` exists | `package.json` |
| Build / deploy | **None.** No `eas.json`, no iOS `bundleIdentifier`, no Android `package`, template name and icons | `app.json` |

### What sits around it, and what the mobile app can reuse

```
          ┌──────────── one Supabase project per environment (RLS is the only boundary) ────────────┐
          │  tables · RLS · RPCs (acknowledge_booking, raise_booking_dispute) · Storage · Realtime    │
          └───▲──────────────▲───────────────▲───────────────▲──────────────────▲────────────────────┘
              │              │               │               │                  │
          booker (web)   vendor (web)   command (web)   ezzy-vendor-mobile   ezzy-booker-mobile
          + /api/register  + kiosk        (ops, payouts)  (reference impl.)   (this app)
          + /api/payment/*  (via booker's webhook)
```

- **Backend:** the mobile app talks to Supabase directly with the anon key, under the same `booker` portal + `member` role RLS as the web app. It needs no new backend for reads.
- **Service-role work** stays behind booker's deployed API routes. `/api/register` is caller-ungated and usable as-is. `/api/payment/create-session` is **not** usable from mobile (F2).
- **Reusable business logic (copy and adapt, never import):**
  - `booker/services/offerings.service.ts`, `vendors.service.ts`, `bookings.service.ts`, `booker.service.ts`
  - `booker/services/schedules.service.ts` for slot derivation, occupancy, and date-granular spans
  - `booker/lib/slots.ts`, `duration.ts`, `types.ts`
- **Reusable mobile patterns, already proven on Android in `ezzy-vendor-mobile`:**
  - `theme/tokens.ts` + `AppThemeProvider` + `.styles.ts` `makeStyles(tokens)`
  - the Supabase client with its SecureStore chunking adapter
  - TanStack Query with an `AppState` focus manager
  - `SessionGateProvider` and `RefreshableList`
  - the kiosk flow components (`KioskCatalogue`, `KioskCustomerForm`, `KioskAgreements`, `KioskCheckout`), which are the closest existing native booking wizard
- **Design tokens:** booker's `--db-*` variables (`booker/app/globals.css:47-76` light, `:120-148` dark) share values with vendor's `--sp-*` family. Examples: page gradient `#eef2ff→#f5f3ff` / `#04060e→#05080f`, card `#fff` / `rgba(255,255,255,0.028)`, strong `#0f172a` / `#f1f5f9`, text `#64748b`. Vendor-mobile's `tokens.ts` therefore needs re-sourcing against booker's file, not a redesign.
- **Offering pictures already exist in the data model.** `offering_attachments` rows with `kind='photo'` live in the **public** `offering-photos` bucket, cover image = lowest `sort_order`. Bookers can already read them under the policy `active users read active offering attachments` (`backbone/supabase/migrations/20260829000001_offering_attachments.sql:129`). **No schema change is needed** for "pictures of the offering".

### Flags: codebase vs. brief, and things that bite later

- **F1: The old buildout plan conflicts with the settled vendor-mobile decisions.**
  - `.plans/2026-07-21-ezzy-booker-mobile-buildout.md` chose NativeWind (its D1) and AsyncStorage for the session (its D3).
  - `ezzy-vendor-mobile` later settled on `.styles.ts` without NativeWind (D1-A) and SecureStore with chunking (D6-A). The latter is also what `mobile-dev/SKILL.md §3.2` requires for session tokens.
  - `architecture/overview.md` ("Ezzy Booker Mobile") already says to treat vendor-mobile as the reference and revisit that plan. → D1, D8.
- **F2: Mobile cannot start a payment yet.** `booker/app/api/payment/create-session/route.ts:31-33` authenticates only through the SSR cookie, and a native client sends none. It needs an `Authorization: Bearer` path. That is a cross-app booker change, as already noted in the buildout plan's Couplings. The prototype mocks payment.
- **F3: Web booker skips the offering-agreements rule.**
  - `schema.md` → `offering_attachments` states that "every document must be accepted before payment — that is the product rule". The vendor kiosk enforces it (`KioskAgreements`).
  - `booker` never reads `offering_attachments` (grep: zero hits in `services/ components/ lib/ app/`).
  - `booking_acknowledgements` has no `authenticated` INSERT policy, so a booker-side write path does not exist yet (needs an RPC or route; backbone change).
  - The prototype shows the Agreements step with mocks. → W3.
- **F4: Web booker cannot book date-granular offerings** (day/week/month units). This is a known gap in `portals.md` and `booking-flow.md`. The mobile wizard prototype renders both the time-slot and date-range modes. → W4.
- **F5: Web booker has no search.**
  - The catalogue is **service-first and deduped by `code`+granularity** across vendors (`useBookingWizard.ts:13-33`). You pick a "service", then a vendor.
  - "Search for vendor names" needs a vendor-first path that does not exist on web. → D5, W1.
- **F6: Document uploads are in-memory only on web** (`portals.md` Known Gaps). Picking a real file on mobile needs `expo-document-picker` / `expo-image-picker`, which means a new dependency and permissions. The prototype uses a mock "Attach" row only.
- **F7: Web booker never shows offering photos**, although the data and RLS allow it. → W2.
- **F8: No iOS verification is possible from this machine.** WSL has no simulator, and vendor-mobile's `IOS-BUILD.md` needs a paid Apple Developer account. Android (Expo Go works on SDK 57 for Android) and the web target are available. Any iOS claim stays unverified. → D3.
- **F9: The booker login is a theme-independent branded surface** (navy + gold, `booker/components/auth/LoginPage/LoginPage.module.css:1-15`), the same as vendor. When auth is built, copy vendor-mobile's `brandTokens.ts` approach. Not in this prototype.
- **F10: Two different primary blues.**
  - The old buildout plan quotes `#205cfc`/`#6b9cff` (an exact OKLCH conversion of `--primary`).
  - Booker's UI actually paints `#2563eb` / `#60a5fa` (hard-coded gradients in `BookingWizard.tsx:118`, `TabBar.tsx`, `DashboardPage.tsx`), and the CSS comments say so.
  - The prototype follows **what the web renders** (`#2563eb` gradient), as vendor-mobile did.

**Serious blockers for prototyping:** none. F2 and F3 block *production* booking from mobile, not the previews.

---

## Phase 4 — maps review  ✅ DONE (2026-09-18; recommendation accepted as D6-A. M1/M2 are built in S2/S3)

**What exists:**
- `booker/components/booking/MapWidget/` renders a Leaflet map on wizard Step 2, fixed at country zoom (`setView(center, 6)`), with one marker: **"You are here"** (`useMapWidget.ts:19-36`).
- Vendors have **no coordinates** (`schema.md` → `vendors`: `lat`/`lng` listed only as "future fields"), so no vendor pins and no distance sorting are possible.
- The step still asks for browser geolocation (`BookingWizard.tsx:34`) for no functional gain.
- The login page advertises "Map view with distance sorting" (`LoginPage.tsx:71`), which does not exist.

**How vendor and command evolved since:**
- Vendors now carry a **structured PSGC address**: `province`/`city`/`barangay` plus codes (`20260722000001`, `…000002`).
- Command holds `region`.
- Every vendor has a `division` (EzzyCourt, EzzyCare, …).

"Where is this vendor" is therefore answerable by **area without coordinates**, and neither vendor nor command has moved toward capturing geo points.

**Recommendation: change.** Drop the interactive map and replace what it was meant to do:

> **Amended 2026-09-18:** the design canvas agrees (no map, "Get directions" everywhere) but filters by **city only** ("Where: Anywhere / Manila / Makati / …"). M2 follows the canvas: city, not province → city.

- **M1 (mobile, in this prototype):** on the offering page and booking detail, show the vendor's formatted address with a **"Get directions"** button. It hands off to the native maps app by address query (Apple Maps on iOS, Google Maps / `geo:` on Android). No map SDK, no API key, **no location permission**, and no store data-safety row.
- **M2 (mobile, in this prototype):** a **Location filter** (province → city) in Search, driven by the existing structured address fields. No schema change.
- **M3 (⏸ PARKED):** a real "near me" / map view. Unblock condition: a product decision that proximity matters. It then needs `vendors.lat/lng` plus geocoding on vendor address writes (a schema + vendor-app change, both approval gates) and `react-native-maps` with a Google Maps key on Android.
- **W5 (web proposal):** remove `MapWidget` and the geolocation request from Step 2, add the same directions link and location filter, and fix the login-page copy.

Why: the map today costs a permission prompt, a Leaflet bundle, and a claim the product cannot keep. It shows the user where *they* are, which they already know.

---

## Sync sources (updated 2026-09-18, second pass)

Mobile must stay in step with the **web booker redesign**. Two sources, in this order of authority:

1. **`.plans/2026-09-18-booker-home-search-redesign.md`** (web plan, owned by the other session): **wins on look and behaviour.** Its D3 keeps booker's current look; only the prototype's division colours carry over. Mobile follows its resolved decisions (D1–D12) unless a mobile decision below says otherwise.
2. **The design canvas** https://claude.ai/artifact/DZyasjx3GN8d6EQeAsw9Aj (version `1789783672-dd91`, read 2026-09-18): a **layout and feature reference only**, exactly as the web plan treats it. Its fonts, surfaces and colours (other than division colours) are **not** used.

This session reads both and edits neither.

| Canvas board | Size | What it shows |
|---|---|---|
| `Main.dc.html` | 1280 desktop, light | Home widgets + booking detail drawer |
| `MobileHome.dc.html` | 390 phone, dark | Phone Home layout order + tab bar |
| `Search.dc.html` | 1280 desktop, light | Explore |
| `Offering.dc.html` | 1280 desktop, light | Vendor-specific offering page |

**Not on the canvas:** the hamburger drawer's contents (Settings, About & Legal, account, Sign out). The web plan caught this as its G1 and kept the drawer (its I16). Mobile carries the same contents on an Account screen (D13).

### Sync protocol
1. **Start of every stage:** re-read the web plan and the canvas. If either changed, update P#/G#/N# here **before** building.
2. **Web plan first, then canvas.** When the web plan says how a feature behaves, mobile does the same. Where the web plan is silent, follow the canvas. Where only a desktop board exists, adapt it to the phone (D10) and label the preview **"adapted"**.
3. **Look = booker's `--db-*` tokens** (already in `theme/tokens.ts` since S0) **+ division colours.** The web plan's I3 defines `--div-<slug>-fg/-bg` in `booker/app/globals.css`. Until that lands, mobile uses the canvas's 8 light pairs and derived dark values, marked **provisional** in `tokens.ts`. Once web's values exist, they are copied over verbatim.
4. **Shared logic is ported from the same source as web**, never re-invented:
   - progress steps per web I1
   - auto-confirm with the service-date gate from `ezzy-vendor-mobile/src/lib/autoConfirm.ts` (the same file web I2 copies)
   - search matching per web I4
5. **Sample data mirrors the canvas's** (Maria, Rizal Park Sports Hub, …), plus the fields the web plan adds: division slugs, staff names, taglines, requirements.
6. Anything mobile finds that web should settle goes in **Sync notes (N#)**, for you to carry across.

### Feature inventory (every one must exist on mobile)

Data: ✅ supported today · ⚠️ gap, see G# · 🧪 mock only in this plan. "web Dn/In/Fn" = the web plan's item.

**Shell / main menu**
- **P29** Bottom tabs: **Home · Explore · Bookings · Transactions** (web D5). Pushed screens (`offering`, booking steps) keep **Explore** highlighted (web G3).
- **P31** **Account screen: the hamburger drawer's contents** (D13). It opens from the header avatar.
  - Account: name and email.
  - **Settings**: appearance (Light / Dark / System; web has this as a TopBar toggle).
  - **About & Legal**: Terms of Use, Privacy Policy, Acceptable Use Policy, Cookie Policy, Refund & Cancellation Policy, then About Ezzy after a divider. Copied from `booker/lib/legal.ts` with its URLs exactly, **trailing slashes included** (`:11-13` warns they are load-bearing). Opened with `expo-web-browser` (already installed).
  - **Sign out** 🧪 (no auth in the prototype, D4).
  - **Delete account**: ⚠️ G8. Required by Apple 5.1.1(v), because booker lets people sign up in-app (`mobile-dev` §3.1).
  - App version (vendor-mobile shows it in Settings).
- **P1** Header: date, greeting, notifications bell with an unread dot, avatar (→ P31). Web's TopBar also has a search entry; on mobile that's the Home search pill (P2) and the Explore tab.
- **P30** Notifications screen from the bell. ✅ `notifications`. No board (N2).

**Home** (layout order from `MobileHome`; widget set from web I10–I12)
- **P2** Search pill → Explore.
- **P3** **Needs you**, only when the next step is the booker's:
  - `fulfilled` → "Yes, all done" + "Something's wrong" (reason) + auto-confirm date with the **service-date gate** (web F2/I2).
  - `in_progress` → "I've returned it".
  - Unpaid → **"Payment not received yet" as information only, no button** (web D10). "Finish payment" is ⏸ parked with web P2.
  - After acting: done state + Undo. All copy from booker's `lib/bookingActionCopy.ts`. Hidden when empty.
- **P4** **Up next**: the next `confirmed`/`pending` booking on or after today.
  - Offering, vendor, date/time, area, **"with ‹staff name›"** when assigned (web D7/D8, names only).
  - **Requirements shown as information** (web F4). No "1 of 2" progress, no Upload button, no payment method, no "Bring" list (the canvas items that web dropped).
  - Get directions (Maps link from the address), View booking.
- **P5** **My bookings**: tabs **Upcoming / In progress / Past / Cancelled** (web I10), 5 rows on Home.
  - Each row: division-coloured code badge, progress tracker, status as text as well as colour.
  - The tracker covers **all nine statuses** (web I1): cancelled/refunded are terminal tracks, and disputed reads "On hold — Ezzy is reviewing".
- **P6** **Resume draft**, compact with a progress bar + Resume / Discard. 🧪
- **P7** **Book again**: completed bookings grouped by **offering id** (not code), newest 3.
- **P8** **Open this weekend**: at most 4 past vendor/offering pairs, with "N left" counts. Honest counts depend on web D9's occupancy RPC (⚠️ G5). 🧪
- **P8b** **Explore by division** → Explore, pre-filtered.
- **P8c** **Getting started guide, only while the booker has zero bookings** (web D6). No Certificate button, no spending widget.

**Bookings tab + booking detail** (detail is a modal on web, a pushed screen on phone)
- **P9–P12** Code badge, offering, vendor, **staff**, status banner with explanation, **timeline with real timestamps** from `booking_status_log` (web F12/I6), When / Paid / Where.
- **P13** Get directions ✅, **Call vendor** ✅ (`vendors.phone`; mobile only, → N9). ~~Receipt~~ ✖ dropped 2026-09-18 to match web, which has none.
- **P14** Offering photos and description (your original brief; web's detail doesn't have them → N4).
- Bookings tab = the P5 list without the limit.

**Explore** (web I13)
- **P15–P16** Labelled search field, division chips (`aria-pressed`).
- **P17** City filter built from the catalogue's distinct cities. The **When** filter applies only to visible results, so fan-out stays bounded (web I13, trap c).
- **P18** Recent searches (AsyncStorage later; in-memory now 🧪), popular categories.
- **P19–P22** Result count, Vendors group (name, division, city, service count, **tagline ✅** — `vendors.tagline` exists, `20260513000001_vendor_profile_fields.sql:4`), Services group (cover photo or division placeholder, price per unit, vendor · city, next open time), no-results state.
- Vendor result → the vendor's offerings.

**Offering page** (web I13)
- **P23–P26** Back to results, gallery, category + granularity chips, description, requirements, agreements (active `document` attachments), vendor block with directions.
- **P24c** **"Who you'll see"**: distinct assigned staff across active schedules. Each slot shows "with ‹name›" (web D7/D8).
- **P27** Next open slots with counts (web D9, 🧪). The phone gets a sticky bottom bar: price, selected slot, **Book this slot**.
  - **Date-granular offerings: shown, but Book is replaced by "Booking by date isn't available yet"** (web D11).
- **P28** Then **Schedule → Documents → Review → Pay** (web I15), opened with the offering, vendor and optional slot preselected. Documents are in-memory (as on web), payment is 🧪.

**Transactions**: summary + history as on web today (unchanged by the web plan). The Total Spent rule is open (N7).

### Data gaps (G#)
- **G1** ⏸ Finish payment: parked with web P2 (`create-session` must refuse paid bookings and expire the previous session first; web F3 found a double-charge risk). Also needs a Bearer-token path for mobile (F2).
- ~~**G2**~~ Payment method, ~~**G4**~~ "Bring" list, ~~**G6**~~ receipt: ✖ **dropped 2026-09-18**, because the web plan removed these from the design.
- **G3** Document uploads are not persisted anywhere (web F4, known gap). Mobile also needs picker packages when that's fixed.
- **G5** Slot counts: booker RLS only shows a booker **their own** bookings, so any client-side "N left" is wrong (web F1, escalated there). Needs web's I14 occupancy RPC (backbone, approval gate on the web plan). Mobile then calls the same RPC.
- ~~**G7**~~ Vendor tagline: ✖ **false alarm**, withdrawn 2026-09-18. `vendors.tagline` exists (`20260513000001_vendor_profile_fields.sql:4`).
- **G8** **Account deletion for bookers** (P31). `account_deletion_requests` supports `scope = 'user_only'` (`20260821000001_account_deletion_requests.sql:87-88`), but requests are created only by a service-role server route (`:36-41`), and booker has none (grep: no hits in `booker/app`, `services`, `components`).
  - Needs a booker API route that mobile calls over HTTPS: a cross-app change to booker.
  - **Blocks App Store submission, not the prototype.**

### Sync notes for the web session (N#) — for you to carry over; not actioned here
- ~~**N1**~~ Payments vs Transactions: ✅ resolved by web D5 (Transactions).
- **N2** No phone boards except Home. Mobile adapts the rest and labels them "adapted".
- ~~**N3**~~ Missing statuses: ✅ resolved by web I1 (all nine).
- **N4** Booking detail has no offering photos or description on web. Mobile shows them (your original brief).
- **N5** The web plan's F9 says "the 8 slugs are seeded". The migration actually seeds **13** (`backbone/supabase/migrations/20260724000004_divisions.sql:29-42`: + Law, Park, Learn, Work, Stay). Web I3's `--div-*` set needs 13 pairs, or an explicit fallback for 5.
- ~~**N6**~~ Date-granular: ✅ resolved by web D11 (shown, booking disabled).
- **N7** Transactions "Total Spent" counts cancelled, unpaid bookings (`TransactionsPage.tsx:25`). Not in the web plan's scope.
- **N9** Mobile keeps **Call vendor** on booking detail; the web plan has none. Should web add it?
- **N11** **Transactions diverges first on mobile** (S5, 2026-09-20): filters (period, status, search), month grouping with subtotals, and a filtered summary. The web plan leaves its Transactions page as it is. Web should adopt the same treatment, including the paid-only Total-spent rule that settles N7.
- **N10** Booker has no **Delete account** (G8). Web needs it too, as a Privacy Policy expectation; mobile needs it to be accepted by the App Store.

## DECISIONS

<!-- No stage may execute while any OPEN: line below remains. -->

- **D1: Styling / theming approach → A, copy vendor-mobile's system** (resolved 2026-09-18). Still stands. Token values are booker's `--db-*` plus division colours, per D12.
- ~~**D2: Navigation structure → A**~~ ✖ **SUPERSEDED 2026-09-18** by web D5 (P29): Home · Explore · Bookings · Transactions. That is the same as the original D2-A.
- **D3: Preview method → Artifact screenshot gallery of the real Expo build** (resolved 2026-09-18). Still stands. **Amended:** each screen is shown next to a note of the canvas board it matches, or "adapted" (sync protocol step 2).
- **D4: Auth in the prototype → A, mock signed-in booker, no login** (resolved 2026-09-18). Still stands; the mock booker becomes the canvas's Maria.
- ~~**D5: Booking-wizard shape → A**~~ ✖ **SUPERSEDED 2026-09-18** by web D1/I15 (P27–P28): offering page → Schedule → Documents → Review → Pay, with the slot optionally preselected.
- **D6: Maps → A** (resolved 2026-09-18). Still stands, with M2 amended to city-only (see Phase 4).
- **D7: Prototype dependencies** (resolved 2026-09-18). `lucide-react-native` + `react-native-svg` still stand. ~~`@expo-google-fonts/inter`~~ and ~~`expo-linear-gradient`~~ are no longer used by the canvas's design → D9.
- **D8: The old buildout plan → note added** (2026-09-18). ✅
- ~~**D9: Font and unused packages → A, install Plus Jakarta Sans; uninstall Inter and expo-linear-gradient**~~ ✖ **REVERSED 2026-09-18 by D12.** Nothing was installed or uninstalled. Inter and `expo-linear-gradient` stay, because booker's look uses both.
  - **A (rec.):** install `@expo-google-fonts/plus-jakarta-sans` (`npx expo install`); uninstall `@expo-google-fonts/inter` and `expo-linear-gradient`.
  - **B:** install Plus Jakarta Sans, keep the other two for now.
  - **C:** stay on Inter (drifts from the canvas).
- **D10: Screens with no phone board → A, adapt and mark "adapted"** (resolved 2026-09-18).
  - **A (rec.):** I adapt the desktop board to the phone, following the phone Home board's patterns (cards, 44pt buttons, sticky bottom action for the offering rail). Each is marked "adapted" in the preview; you take it to the canvas session if it should change there (N2).
  - **B:** wait for the canvas session to draw phone boards before building those screens.
- **D11: Backend data gaps → A, build with mock data; gaps listed for a real-data plan** (resolved 2026-09-18). Features the web plan dropped are dropped here too (G2, G4, G6).
- **D12: Visual direction → follow web D3: booker's current look + division colours only** (resolved 2026-09-18). Keeps mobile and web in sync. It conflicted with D9 (the prototype's full look), which it reverses.
  - Rejected: the prototype's full look (Plus Jakarta Sans, flat canvas tokens), because mobile and web would diverge.
- **D14: Transactions filters → period + status + search, with a filtered summary** (resolved 2026-09-20). The user asked for "filters that are useful" and delegated the choice; this set answers the three questions a booker actually has — *what did I spend recently*, *what is still unpaid*, and *where is that one payment*. Rejected: division/category chips (a booker has few transactions, so the extra row earns nothing), date-range pickers (heavier than the period presets), and sort controls (newest-first is the only order that matters here). Say the word and any of these can change.
- **D13: The hamburger drawer on mobile → avatar opens an Account screen** (resolved 2026-09-18). With bottom tabs, a drawer only duplicates the main pages, so the drawer's other contents (Settings, About & Legal, account, Sign out) move to a native Account screen, plus Delete account for the App Store (P31).
  - Rejected: a left drawer like web. It needs `@react-navigation/drawer` and duplicates the tab bar.
  - **A (rec.):** build them with mock data now so the design is complete, and list each gap for a later real-data plan.
  - **B:** leave them off mobile until the backend exists.

---

## Build stages

**Conventions that apply to every stage:**
- Every stateful component is `Name.tsx` (pure render) + `useName.ts` (state, effects, handlers) + `Name.styles.ts` (`makeStyles(tokens)`).
- Pure display components (no state, no effects, no handlers) get `Name.tsx` + `Name.styles.ts` only.
- No static inline `style={{}}`.
- Every data surface shows loading / empty / error / populated.
- Touch targets are at least 44pt, type scales with the OS font size, and icon-only buttons carry `accessibilityLabel`.
- Each stage is checked in both themes.
- Each stage starts with the sync protocol's step 1.

**Mock boundary (every stage):**
- `src/mocks/*.ts` holds fixture data only.
- `src/services/*.service.ts` are the **only** importers of `src/mocks/`. They are async, return `{ data, error }` shaped like booker's real services, and add a small artificial delay so loading states are visible.
- Swapping in Supabase later means rewriting service bodies only; hooks and screens do not change.
- Photo placeholders follow the canvas: division-coloured blocks, standing in for real `offering-photos` images.

### S0: Foundation  ✅ DONE (2026-09-18) — extended by S0b
**Executed 2026-09-18:**
- Installed `expo-linear-gradient`, `@expo-google-fonts/inter`, `react-native-svg` (via `npx expo install`) and `lucide-react-native` (npm). `expo-blur` deferred per D7.
- Template scaffolding moved to the session scratchpad rather than `trash`, which is not installed on this machine. It is also recoverable from commit `55a5c64`. Kept: the icon, splash and favicon assets `app.json` still references.
- `theme/` (tokens from booker `--db-*` values, `AppThemeProvider` with an in-memory preference, `useAppTheme`), `lib/types.ts`, `lib/bookingStatus.ts`.
- Mock layer: `mocks/{vendors,offerings,bookings,dates}.ts` and `services/{offerings,vendors,bookings,transactions}.service.ts` + `mockLatency.ts`.
- Primitives: `ScreenShell` (render + hook + styles), `Card`, `StatusBadge`, `PrimaryButton`, `StagePlaceholder` (display + styles), `SettingsView` (render + hook + styles), `dev/DesignKit` (display + styles; temporary, leaves Home in S1).
- Navigation: `RootNavigator` (stack + a React Navigation theme built from our tokens) and `AppTabs` (4 tabs), each with a hook. Route files are composition only.

**Deviations from the S0 text:**
- `schedules` mocks are deferred to S4, where the slot logic that consumes them lands.
- `SearchField` is deferred to S1, its first consumer.
- Theme preference is not persisted (that needs AsyncStorage; comes with real wiring).

**Fixed during S0 (found in screenshots, root-caused by measuring the web DOM):**
- Tab labels were clipped. React Navigation's 49pt bar left the Inter 11/14 label box 10px tall under `overflow:hidden`. Fix: `TAB_BAR_HEIGHT = 56` plus `insets.bottom`, and an explicit label `lineHeight`. Setting `height` replaces React Navigation's inset arithmetic, so the inset must always be added.
- The tab bar top border rendered React Navigation's default light `#d8d8d8` in dark mode, overriding `borderTopColor`. Fix: a `ThemeProvider` theme built from our tokens in `useRootNavigator`. This also themes stack headers.
- The stack header title inherited the accent tint. It now uses `tokens.strong`.

**Verification:**
- Machine: `tsc --noEmit` exit 0; the mock-boundary grep is clean (only `services/` imports `mocks/`).
- Web build: the Playwright screenshot run of 5 routes × 2 themes reported **no console errors**.
- Visual (web rendering at 390×844, published to the preview artifact): light and dark reviewed by eye.
- **Not run:**
  - `expo lint`: this app has no ESLint config or dependency. Adding one is an install (approval gate). Tracked as I1.
  - `expo export`: not run, since the dev bundle built and served every route.
  - Android device: not checked.
  - iOS: unverifiable (F8).

### S0b: Sync the foundation to the web plan + Account screen  ⬜ TODO
- **No package changes** (D12 reversed D9). Tokens stay as S0 built them.
- `theme/tokens.ts`: add a `division` map keyed on **slug** (`ezzy-court`, …), light and dark, with a neutral fallback for null or unknown slugs (13 seeded, → N5). Values marked **provisional** until web I3 writes `--div-*`.
- `lib/divisions.ts`: slug normaliser (unknown → `"none"`) + test (mirrors web G7).
- `lib/bookingProgress.ts` + test: `(status, pattern)` → steps + tone, **exhaustive over all nine statuses** with a `never` check (web I1 spec). When web's file lands, diff against it.
- `lib/autoConfirm.ts` + test: copied from `ezzy-vendor-mobile/src/lib/autoConfirm.ts`, the same source as web I2.
- Adds `"test": "node --experimental-strip-types --test \"src/**/*.test.ts\""` to `package.json` (the vendor-mobile script; no dependency).
- Mock fixtures replaced with the canvas's sample data plus division slugs, staff names, taglines, requirements and `booking_status_log`-style timestamps. `services/` keep their `{ data, error }` shapes.
- **Account screen (P31)** replaces `settings`:
  - route `account`, opened from the avatar
  - sections Account / Settings / About & Legal / Sign out / Delete account / version
  - `lib/legal.ts` copied from booker with URLs verbatim
- Header (`ScreenShell`) gains the bell (P1).
- `dev/DesignKit` shows division badges and progress tracks for one review; it is removed in S1.
- Components:
  - `DivisionBadge`, `ProgressTrack` (display + styles)
  - `AccountView` (render + hook + styles; the hook owns the theme choice, link opening and the mock sign-out/delete confirmations)
  - `ScreenShell` (render + hook + styles, gains `openNotifications`)

### S1: Home  ⬜ TODO — order from `MobileHome`, widget set from web I10–I12
- P2–P8c. Layout order: search pill, Needs you, Up next, My bookings (5), Book again, Open this weekend, Explore by division, Resume draft. The Getting-started guide only at zero bookings. Everything below Book again is **adapted** (no phone board).
- Every widget has loading / empty (hidden or CTA) / error / populated states. An error must not look like "no bookings" (web I10).
- Components:
  - `HomeView`, `NeedsYouCard`, `UpNextCard`, `BookingList`, `OpenSlotsCard`, `ResumeDraftCard`, `FlagReasonSheet` (render + hook + styles)
  - `BookAgainRail`, `DivisionGrid`, `GuideCard` (display + styles)

### S2: Bookings tab + booking detail  ⬜ TODO — adapted from the `Main` drawer
- P9–P14: `booking/[id]` pushed screen. The timeline uses status-log timestamps. The screen derives the booking from the list by id, so a realtime change reaches an open detail (web G8).
- Components: `BookingsView`, `BookingDetail`, `PhotoGallery` (render + hook + styles); `StatusBanner`, `Timeline` (display + styles).

### S3: Explore  ⬜ TODO — adapted from `Search`
- P15–P22 + the vendor's offerings list. The catalogue is loaded once and cached, never refetched per keystroke (web trap e). The matcher `lib/search.ts` + test follows web I4.
- Components: `ExploreView`, `FilterSheet`, `VendorView` (render + hook + styles); `VendorResult`, `ServiceResultCard` (display + styles).

### S4: Offering page + booking steps  ⬜ TODO — adapted from `Offering`
- P23–P28. The sticky bottom bar replaces the rail. The date-granular case shows the disabled message (web D11). Booking steps run as a modal stack: Schedule → Documents → Review → Pay (mock) → done.
- Time slots use booker's slot logic, copied from `booker/lib/slots.ts` + `services/schedules.service.ts` and keyed on **offering id** (web I9).
- Components:
  - `OfferingView`, `SlotPicker`, `ScheduleStep`, `DocumentsStep`, `PayStep` (render + hook + styles)
  - `BookingBar`, `ReviewStep`, `BookingDone` (display + styles)

### S5: Transactions  ✅ DONE (2026-09-20, code) · preview ⏸ blocked by I2 — no board; **pulled forward at the user's request**, and deliberately ahead of web
Modernise the screen in the plan's theme (booker `--db-*` tokens, D12) and add filters. Web's Transactions page is unchanged by the web plan, so this screen is the first place the new treatment appears → **N11**.

- **Summary strip** — Total spent, Payments, Pending — recomputed from the *filtered* set, so the numbers always describe what is on screen.
  - **Total spent counts money actually paid**: `paid` only. It excludes pending and refunded, and unpaid cancellations never become transactions at all (`transactions.service.ts`). This is the W7/N7 rule, settled here for mobile.
- **Filters (D14):** period chips (All · This month · Last 3 months · This year), status chips (All · Paid · Pending · Refunded), and a search field over service and vendor name. Filters combine, and a "Clear" affordance appears once any is active.
- **History grouped by month**, newest first, with a per-month subtotal. Rows: offering-code tile, service, vendor, date, amount, state pill.
- All four states: loading, empty (no transactions yet → CTA to Explore), **no-matches** (distinct from empty — it offers Clear), error.
- Accessibility: chips are `accessibilityRole="button"` with `aria-pressed`-equivalent state, 44pt targets, amounts use tabular alignment, state is text + colour.
- Mock fixtures gain ~8 more past bookings so the period filter and month grouping have something to act on. S0b replaces these fixtures with the canvas's sample data.
- Components:
  - `TransactionsView` (render + hook + styles) — owns query/period/status state
  - `TransactionFilters` (render + hook + styles) — hook owns the chip rows' scroll + clear handler
  - `SummaryStrip`, `TransactionRow`, `MonthSection` (display + styles)
  - `SearchField` (display + styles; controlled by the parent hook) — the shared primitive deferred from S0
- Pure logic in `lib/transactionFilters.ts` + `node --test` (filter combination, month grouping, totals, the paid-only rule).

**Executed 2026-09-20:**
- `lib/transactionFilters.ts` + 10 tests; `lib/format.ts` (peso, short day).
- `components/common/{SearchField,FilterChip}` (display + styles) — `SearchField` is the primitive deferred from S0, reusable by Explore in S3.
- `components/transactions/{SummaryStrip,TransactionRow,MonthSection}` (display + styles), `TransactionFilters` and `TransactionsView` (render + hook + styles).
- `app/(tabs)/transactions.tsx` renders the view; the tab title reads "Payments" over the eyebrow "Your spending".
- `Transaction` gained `offeringCode` for the row tile; `transactions.service` passes it through.
- Mocks: 8 older bookings (`MOCK_BOOKING_HISTORY`) so periods and month grouping have data, and the dental booking is now **unpaid**, which is what gives the Pending filter and figure something to show. Both are replaced by the canvas's sample data in S0b.
- `package.json` gained the vendor-mobile `test` script; `tsconfig.json` gained `allowImportingTsExtensions` + `"types": ["node"]`, copied from vendor-mobile so `node:test` imports type-check without a new dependency.

**Found and fixed during S5 — month grouping used the device timezone.**
`groupByMonth`/`periodStart` used local `getMonth()`, so a payment made at 9 PM Manila fell into the previous month for any device outside PHT — and the suite failed on this machine. Bookings and the DB's date gates are Asia/Manila (`schema.md`), so the module now derives a Manila `YYYY-MM-DD` with fixed +08:00 arithmetic (no DST in PH, and no reliance on Hermes's ICU). A regression test covers the 23:30 case.

**Verification:**
- Machine: `tsc --noEmit` exit 0; `npm test` 10/10 pass; mock-boundary grep clean.
- Behavioural (Playwright driving the real web build, text read from the DOM): All time ₱28,550 / 14 payments → This month ₱10,900 / 6 → +Pending 1 payment, ₱1,200 → Clear restores 14 → a query matching nothing shows "No payments match". **No console errors.**
- **Screenshots could not be captured → I2.** The visual check is therefore *not* done: the layout, contrast and both themes have not been looked at.


### S6: Notifications  ⬜ TODO — no board; adapted
- Bell → list with read/unread; tapping a notification opens its booking.
- Components: `NotificationsView` (render + hook + styles), `NotificationRow` (display + styles).

---

## Web-booker proposals (not actioned)
- ~~**W1**~~, ~~**W2**~~, ~~**W5**~~: ✖ **SUPERSEDED 2026-09-18.** The web redesign plan delivers them (its D1, D4, D5, I8, I13).
- **W6** (dark muted text contrast): web D3 keeps `--db-*`, so `#64748b` on dark remains → still open. Mobile keeps `#94a3b8`.
- **W3** (agreements before payment, backbone write path): the canvas includes the agreement step (P26/P28); the backend gap stays (F3).
- **W4** (date-granular booking): parked on web as its P5 (web D11).
- **W7** (Total Spent includes unpaid cancellations): still open → N7.

## IMPORTANT (found during execution)

- **I2 — Playwright screenshots stopped working in this environment (2026-09-20)**  ⬜ TODO
  - Every `page.screenshot()` times out, **including on `about:blank`**, with both the bundled chromium and `chromium-headless-shell`, with and without `--no-sandbox --disable-dev-shm-usage --disable-gpu`. One CDP attempt returned "Target page, context or browser has been closed", i.e. the renderer died. The same scripts captured 10 screenshots successfully earlier in this session.
  - `page.click()` is affected too — Playwright's "wait for stable frames" never settles — but `{ force: true }` clicks and `page.evaluate` still work, which is how S5 was verified behaviourally.
  - Not caused by app code: a blank page fails the same way.
  - Consequence: **the preview artifact is stale** (it still shows S0) and no stage can be visually verified until this is fixed.
  - Next things to try: reinstall the Playwright browsers (`npx playwright install chromium`), a WSL restart, or screenshot from the Windows-side browser (`chrome.exe --headless=new --screenshot` produced no file on the first attempt).
- **I1 — no lint setup in `ezzy-booker-mobile`**  ⬜ TODO. `npm run lint` (`expo lint`) would install ESLint and `eslint-config-expo` on first run, which is a dependency install (approval gate). vendor-mobile has `eslint.config.js` + `eslint ^9` + `eslint-config-expo ~57.0.1`. Proposed: copy that setup when you approve the install.

---

## Execution order
1. ✅ D1–D13 resolved (2026-09-18; D9 reversed by D12).
2. ✅ **S5 Transactions** (pulled forward 2026-09-20) — code done; visual review pending I2.
3. **S0b** web sync + Account screen → stop, report, preview.
4. **S1 Home** → stop. Iterate until it matches `MobileHome`'s order and web's widget behaviour.
5. **S2 → S3 → S4 → S6**, one stage per turn by default. Each starts by re-reading the web plan and the canvas.
5. Afterwards: a real-data plan covering auth (buildout Ph1 revised), G1, G3, G5, **G8 (blocks store submission)**, F2/F3 and the booker couplings.

## Verification
- **Machine, per stage:**
  - `ezzy-booker-mobile/node_modules/.bin/tsc --noEmit --project ezzy-booker-mobile/tsconfig.json`
  - `npm --prefix ezzy-booker-mobile test` once the first pure-logic tests land in S1 (the script is copied from vendor-mobile)
  - `npm --prefix ezzy-booker-mobile run lint` (blocked until I1)
  - grep that nothing outside `src/services/` imports `src/mocks/`
- **Visual, per stage:** light and dark screenshots at 390×844, published to the preview artifact (https://claude.ai/artifact/PbimGic8VSUJhnGAiuBZBX), each labelled with its canvas board or "adapted". Stated plainly as a *web* rendering.
- **Canvas parity:** screens with a phone board are compared against it by eye; differences are either fixed or logged as N#.
- **Needs a device:** touch targets, safe areas, back gesture and sheet dismissal on Android via Expo Go. **iOS: unverified** (F8).

## Superseded record (kept per plan-authoring; do not build)
The original S1–S5 layouts (quick-access tiles, horizontally scrolling upcoming widgets, a 4-step wizard with a Schedule step, the Transactions tab) were written 2026-09-18 and ✖ **SUPERSEDED** the same day by the design canvas.

## Notes
- No commits by the agent. The user handles git.
- Types and services are copied from booker and adapted, never imported across repos.
- The design canvas is read-only to this session.
