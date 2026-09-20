# Booker: widget Home, better booking status, Explore/search, offering page

**Date:** 2026-09-18
**App / scope:** `./booker`. One optional backbone migration (D9) sits behind its own approval gate.
**Status:** DRAFT. Investigation is ✅ DONE. All decisions (D1–D12) resolved 2026-09-18. **Awaiting execution approval.** I14 (backbone migration) additionally needs its own go before the file is written.

> Make Home a set of widgets that shows what needs the booker next. Replace the two overlapping booking lists with one list that shows each booking's progress. Add search across services and vendors that opens a page for one vendor's offering, and book from that page. Everything works in light and dark.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** F# = finding, D# = decision, I# = implementation item, S# = execution stage. Numbers are plan-local. Qualify cross-plan refs, e.g. "booker-mobile-prototype D5".

**Prototype (mock data, reference only):** https://claude.ai/artifact/DZyasjx3GN8d6EQeAsw9Aj
- Home (desktop light, phone dark), Explore, and the Offering page.
- Per D3, **only the division colours carry over** from the prototype's look. Booker keeps its current `--db-*` surfaces, type and primary blue.

---

## Scope

**In:**
- Home widgets: Needs you, Up next, My bookings with progress, Book again, Open this weekend, Explore by division, a compact Resume draft, and the Guide shown only to new bookers.
- A Bookings page.
- The Explore/search page.
- A vendor-specific Offering page that shows assigned staff (D7).
- Booking from the Offering page into the wizard at the Schedule step.
- Removing the service-first Steps 1 and 2 and the map.
- Division colours in light and dark.
- A dark-mode pass on every touched surface.
- Docs.

**Out:**
- `ezzy-booker-mobile`. It has its own plan, `2026-09-18-booker-mobile-prototype.md`. This plan converges with its D2-A, D5-A and D6-A.
- Persisting document uploads (existing known gap).
- Cancellation or reschedule.
- Reviews and ratings (no `reviews` table).
- Vendor lat/lng and "near me".
- A spending widget.
- Drag-to-arrange widgets.
- Changes to `vendor` or `command`.

**Cross-app flag:** only D9-A touches another folder, `backbone/`. It is an approval gate (schema + multi-app), and per standing practice the user applies migrations.

---

## Tech stack check (reviewed 2026-09-18 against installed packages, not docs)

The plan stays on booker's current stack. **No new dependencies.** Versions below are from `node_modules/*/package.json`.

| Layer | Installed | How this plan uses it |
|---|---|---|
| Framework | Next **16.2.4**, App Router, React **18.3.1** | Same single `"use client"` shell (`app/page.tsx`) with lazy page components. No new `app/` routes (D12). Client components are consistent with the existing shell, since every page is already client-rendered |
| Language | TypeScript 5.7 | Hand-written interfaces in `lib/types.ts` (root AGENTS.md) |
| Styling | Tailwind **3.4.19** (`@tailwind` directives, `tailwind.config.ts` maps `db.*` → `var(--db-*)`), plus co-located `.module.css` (already used by 6 components, e.g. `LegalMenu.module.css`) | Layout and spacing use Tailwind utilities with `db-*` token classes. Non-trivial styling uses `X.module.css`. Division colour uses a `data-division` attribute plus module CSS (G7) |
| UI primitives | shadcn (`base-nova`) in `components/ui/` (`dialog`, `button`, `badge`, `input`, …); `@radix-ui/react-tabs` 1.1.13 and `@radix-ui/react-dropdown-menu` installed | Tabs use `@radix-ui/react-tabs` (G6). The detail stays on the existing dialog |
| Theme | `next-themes`, `class` attribute, `defaultTheme="dark"` (`app/layout.tsx:78`), with `:root` / `.dark` blocks in `globals.css` | `--div-*` defined in both blocks |
| Icons / toasts | lucide-react 0.468, sonner | Unchanged |
| Data | `@supabase/supabase-js` browser client (`lib/supabase/client`), paged fetches (`lib/pagedFetch.ts`) | Services only. RLS is the boundary |
| Tests | `node --test` (`lib/**/*.test.ts`), Playwright visual (`visual-tests/`) | I1, I2, I4 tests. Baselines regenerated in S7 |

⚠️ `booker/AGENTS.md` still says "Next.js 15.1" and "single-file `app/page.tsx`". Both are stale (F11). S8 corrects them from `package.json`.

---

## Findings (verified 2026-09-18 by reading the cited code)

- **F1: "Spaces left" is wrong for bookers today. ESCALATED: this is an existing bug, not just a constraint on this plan.**
  - `services/schedules.service.ts:227-273` `getSlotOccupancy()` counts rows in `bookings`.
  - The only booker SELECT policy on `bookings` is `booker_id = auth.uid()` (`backbone/supabase/migrations/20260507000004_bookings.sql:105-111`). No occupancy RPC exists (grep of migrations).
  - So Step 3's grid subtracts only **the booker's own** bookings. Every slot reads almost fully free until the insert trigger refuses it as "fully booked".
  - The new "Open this weekend" and Offering-page slot counts would inherit the same lie. → D9.
- **F2: The auto-confirm countdown ignores the service-date gate.**
  - `components/dashboard/BookingStatusWidget/useBookingStatusWidget.ts:19,54-59` and `BookingDetailModal/useBookingDetailModal.ts:8` use a flat `changedAt + 3 days`.
  - The DB never promotes a `fulfilled` booking before its `booked_date`, Asia/Manila (`20260801000009`, `portals.md:814`).
  - `vendor/lib/autoConfirm.ts` (+ `.test.ts`) already computes `max(changedAt + 3d, serviceDayStart)`. Port it (copy, not share, per root AGENTS.md). → I2.
- **F3: "Finish payment" as prototyped could double-charge.**
  - `app/api/payment/create-session/route.ts:44-56` never checks `is_paid` or `status` before it opens a new checkout.
  - The webhook matches by `metadata.booking_id` (`app/api/payment/webhook/route.ts:73-104`). Two open sessions for one booking can both be paid, and the second payment is silently "ignored as replay" after the money has been taken. → D10.
- **F4: The Up-next document progress in the prototype is impossible.**
  - Uploads are in-memory only (`portals.md` Known Gaps), so there is no count of uploaded documents to show.
  - **Corrected:** Up next shows *what the vendor requires* (`offerings.requirements`) as information. There is no "1 of 2" progress and no Upload CTA.
- **F5: Staff data paths.**
  - Assignment is **per schedule**: `schedules.staff_id`, nullable, cross-vendor trigger enforced (`schema.md` → `schedules`).
  - Qualification is separate: `staff_specialties`.
  - Bookers can read active staff (`20260507000001_staff.sql:59-66`) and active schedules (`20260507000002_schedules.sql:114`).
  - Staff that are `on_leave`/`inactive`, or on a deactivated schedule, come back `null`, so the UI must tolerate a missing name.
- **F6: Staff RLS over-exposes contact details. Pre-existing, backbone, out of scope.**
  - The "active users can read active staff" policy returns whole rows, including `email` and `phone`, to any active user.
  - This plan selects **names only**. Recorded as a follow-up for a backbone/security plan. Not fixed here.
- **F7: `branch` in the wizard is actually the vendor's address.** `BookingWizard.tsx:58` does `setBranch(s.address)`, and Step 5 labels it "Branch". With the vendor preselected, the state goes away and the address is read from `vendor.address`.
- **F8: Map and geolocation are used only by Step 2.**
  - `MapWidget/`, `hooks/useGeolocation.ts`, `BookingWizard.tsx`, `Step2Vendor.tsx`, Leaflet CSS in `app/globals.css:163-164`.
  - The login page advertises "Map view with distance sorting" (`components/auth/LoginPage/LoginPage.tsx:71`), which does not exist.
- **F9: No division colours exist anywhere** (grep of vendor/command libs).
  - `offering_code` badges use an empty `OFFERING_CODE_STYLE` map with one indigo fallback (`lib/constants.ts:49-51`).
  - Division is reachable as `vendors.division_id → divisions(slug, name)`. Divisions are readable by `authenticated` (`20260724000004_divisions.sql:53`), and the 8 slugs are seeded at `:29-37`.
- **F10: Offering photos are available but unused by booker.**
  - `offering_attachments` `kind='photo'`, public bucket `offering-photos`, readable by active users (`20260829000001_offering_attachments.sql:129`).
  - Vendor resolves URLs at `vendor/services/offeringAttachments.service.ts:253`.
- **F11: `booker/AGENTS.md` is stale.** It describes a single-file `app/page.tsx` app that no longer exists. Fix it in S8.
- **F12: Status history is readable.** Bookers can read `booking_status_log` for their own bookings (`20260516000006_booking_status_log.sql:38`). The detail timeline can show **real timestamps** instead of inferred steps.
- **F13: Existing separation violations in files this plan touches.**
  - Examples: inline handler bodies at `BookingWizard.tsx:58`, hard-coded hex in `DashboardPage.tsx`, `BookingStatusWidget.tsx`, `TabBar.tsx`.
  - Rule: any component this plan rewrites is brought to the convention. Untouched files are not "cleaned up".

---

## DECISIONS

<!-- No stage may execute while any OPEN: line below remains. None remain as of 2026-09-18. -->

- **D1: Search → vendor-specific Offering page → wizard at Schedule → A** (resolved 2026-09-18). Matches booker-mobile-prototype D5-A.
- **D2: Keep "Open this weekend" → yes** (resolved 2026-09-18). Its counts depend on D9.
- **D3: Visual direction → carry over only the division colours** (resolved 2026-09-18).
  - Keep booker's `--db-*` tokens, current font and primary blue.
  - **Dark mode is required** for every new or touched surface. Division colours get light *and* dark values.
- **D4: Remove the map → yes** (resolved 2026-09-18, accepted with the prototype review).
  - Removes Step 2 and `MapWidget`. Directions become a Maps link built from the address. Location is a city filter in Explore.
  - ⚠️ **Architecture conflict, resolved by this decision:** `portals.md` Roadmap #1 ("lat/lng → vendor markers on Step 2 map") and Known Gap "Vendor map has no vendor markers" are superseded. S8 updates `portals.md` and records "near me" as parked.
- **D5: Navigation → Home · Explore · Bookings · Transactions** (resolved 2026-09-18). "Booking" stops being a tab, because the wizard starts from an offering. Settings stays in the sidebar.
- **D6: Home trims → accepted** (resolved 2026-09-18).
  - No spending widget. No drag-to-arrange.
  - Remove the placeholder **Certificate** button.
  - Show the **Getting Started guide only while the booker has zero bookings**.

- **D7: Which staff to show, and where → A, assigned staff** (resolved 2026-09-18).
  - **A (rec.):** the **assigned** staff from `schedules.staff_id`.
    - Offering page: each open slot shows "with ‹name›", and a "Who you'll see" line lists the distinct assigned staff across active schedules.
    - Up next and booking detail: "with ‹name›" via `bookings.schedule_id → schedules.staff`.
    - Shown for any fulfilment pattern whenever a staff member is assigned. An attendant on a rental counts too.
  - **B:** A, plus a "Team" list of *qualified* staff from `staff_specialties`. Rejected as default: qualified ≠ who you'll get, so it can mislead.
  - **C:** A, but only for `fulfilment_pattern = 'session'` (reading "sessions" literally).
- **D8: How a staff name is displayed → A, full name, names-only select** (resolved 2026-09-18).
  - **A (rec.):** `first_name last_name` exactly as the vendor entered it. Select those two columns only (F6).
  - **B:** first name + last initial.
  - **C:** A plus the free-text `experience` ("4 yrs").
- **D9: Honest slot counts (F1) → A, counts-only RPC** (resolved 2026-09-18). Still an approval gate: the migration file is written only on a separate go at S3b, and the user applies it.
  - **A (rec.):** add a counts-only `SECURITY DEFINER` RPC in backbone, and switch `getSlotOccupancy()` to it. This fixes Step 3 too. Draft and blast radius under I14. The migration file is written on your go, and you apply it.
  - **B:** no counts anywhere new. Open this weekend and the Offering page list open times without "N left". F1 stays a documented bug in Step 3.
  - **C:** park Open this weekend until A lands. Everything else proceeds.
- **D10: The unpaid-booking CTA (F3) → A, information only; retry parked as P2** (resolved 2026-09-18).
  - **A (rec. for this plan):** Needs you shows "Payment not received yet" as **information**, with no retry button. Park the retry flow (P2).
  - **B:** ship "Finish payment" now, after hardening `create-session`.
    - Refuse if `is_paid` or `status ∉ (pending, confirmed)`.
    - Expire the previous PayMongo session named in `payment_reference` before creating a new one.
    - This is a security/payment change and needs its own review.
- **D11: Date-granular offerings → A, show them with Book disabled; fix parked as P5** (resolved 2026-09-18). Search will now surface them prominently.
  - **A (rec.):** the Offering page shows them, but replaces "Book" with "Booking by date isn't available yet". A separate plan fixes Step 3's date mode.
  - **B:** fix Step 3's date-range mode inside this plan. That is a larger change, adding roughly one stage.
  - **C:** hide date-granular offerings from Explore. Rejected as default: it hides real vendor catalogue.
- **D12: Navigation state → A, keep internal `PageId` state; URL routing parked as P3** (resolved 2026-09-18).
  - **A (rec.):** keep booker's internal `PageId` state routing (booker/AGENTS.md: no new `app/` routes unless asked).
    - Hold the Explore query and filters in `useAppShell`, so "Back to results" restores them.
    - The browser Back button and shareable offering links stay unsupported. Parked as P3.
  - **B:** move Explore and Offering to real `app/` routes (`/explore?q=`, `/offering/[id]`). This gives Back support and deep links, but is a structural change to booker's single-page shell.

---

## Implementation items

Every component item states its render/hook/style split, per `.claude/skills/component-separation/SKILL.md`:
- `.tsx` is render only.
- `useX.ts` owns state, effects and handlers.
- `X.module.css` holds the styling.
- Colours come only from `--db-*` or the new `--div-*` CSS variables. No hex in `className`, and no static `style={{}}`.

### Foundations (pure, testable)

#### I1: `lib/bookingProgress.ts` + test  ⬜ TODO
Maps `(status, fulfilmentPattern)` to ordered steps (`label`, `state: done|current|todo`) plus a tone.
- Session: Requested → Confirmed → Done → Completed.
- Custody: Requested → Confirmed → Picked up → Returned → Completed.
- **Exhaustive over all nine `BookingStatus` values** (`lib/types.ts:7-10`), with a `never` check.
  - `cancelled` and `refunded` render as a terminal "Cancelled" / "Refunded" track.
  - `disputed` renders "On hold — Ezzy is reviewing" at its last reached step.
  - This is a weak spot: a map that only covers the happy path would silently drop these.
- Test: `node --test` (the existing `npm test` glob `lib/**/*.test.ts`), one case per status × pattern.

#### I2: `lib/autoConfirm.ts` + test (F2)  ⬜ TODO
- Copy `vendor/lib/autoConfirm.ts` + test, adapted to booker's `Booking` type. This needs `bookedDate`, which the type already has.
- Replace both `AUTO_ACK_DAYS` copies (`useBookingStatusWidget.ts:19`, `useBookingDetailModal.ts:8`).
- Only `fulfilled` gets a countdown. `in_progress` never does. `returned` is the vendor's move, so the booker sees no timer.

#### I3: Division colours  ⬜ TODO
- `app/globals.css`:
  - `--div-<slug>-fg` / `--div-<slug>-bg` for the 8 seeded slugs, plus `--div-none-*`, in both `:root` and `.dark`.
  - Dark values are lighter foregrounds on translucent backgrounds, like the existing dark `--db-*` style.
  - Check 4.5:1 text contrast against `--db-card-bg` in both themes.
- `lib/divisionStyle.ts`: `slug | null → { fg: "var(--div-…-fg)", bg: … }` with a neutral fallback for null or unknown slugs. This is the only place slugs are named.
- **Keyed on `slug`, not `name`**, because names are display text.
- The division badge replaces the unused `OFFERING_CODE_STYLE` for the code tile. Remove the map and its fallback once nothing reads them (`lib/constants.ts:49-51`).

#### I4: `lib/search.ts` + test  ⬜ TODO
- A pure matcher: lower-cased, whitespace tokens, every token must appear in `name + category + vendor name + city + division name`.
- Results are grouped into Services and Vendors, then sorted.
- No fuzzy library (no new dependency).
- Test: multi-token, case, and empty-query cases.

### Data layer (`services/`, hand-written types per root AGENTS.md)

#### I5: `getBookings()` shape  ⬜ TODO
**File:** `services/bookings.service.ts:77-110`
- Add `offering_id`, `vendor_id`, `end_time`, `end_date`, `quantity`.
- Add `offerings(requirements)` and `vendors(name, address, city, phone, divisions(slug, name))`.
- Add `schedules(staff(first_name, last_name))`. **Names only** (F6, D8).
- Extend `Booking` in `lib/types.ts`. The staff name is nullable (F5).

#### I6: `getBookingStatusLog(bookingId)`  ⬜ TODO
- Reads `booking_status_log` (F12) for the detail timeline's timestamps.
- It is loaded when the detail opens, not with the list.

#### I7: Catalogue for Explore  ⬜ TODO
**File:** `services/offerings.service.ts:47-81`
- Replace the service-first `getActiveOfferings()` with `getCatalogue()`: per-vendor active offerings with `vendor_id, fulfilment_pattern` and `vendors!inner(id, name, city, province, tagline, divisions(slug, name))`.
- Keep the paging, `.order("code").order("id")` and `complete` flag exactly as they are now. The comments at `:35-46` and `:59-63` explain why.
- Active-vendor filtering is done by RLS (`20260515000001`). `!inner` drops offerings whose vendor is hidden.
- `getVendorsForOffering()` (`vendors.service.ts`) becomes unused after S6. Remove it then.
- **Loaded once per session** when Explore first opens, then cached in `useAppShell`. Not refetched on every keystroke.

#### I8: Offering photos  ⬜ TODO
- New `services/offeringPhotos.service.ts`:
  - `getCoverPhotos(offeringIds)` returns the first active `photo` by `sort_order`.
  - `getPhotos(offeringId)` returns all of them.
  - Public URL via `storage.from("offering-photos").getPublicUrl()` (F10).
- Chunk `.in()` lists so a large catalogue does not build an oversized URL.
- A missing photo means a division-coloured placeholder, never a broken `<img>`.

#### I9: Schedules with staff  ⬜ TODO
**File:** `services/schedules.service.ts:40-58`
- Add `staff_id, staff(first_name, last_name)` to the select.
- Add a nullable `staffName` to `BookerSchedule`.
- Add `getSchedulesForOffering(vendorId, offeringId)`, keyed on **offering id**, not code. `schema.md` → `offerings.code` warns the code is vendor-editable and must never be joined on.

### Home

#### I10: Dashboard layout + Needs you + Up next + My bookings  ⬜ TODO
- **`DashboardPage`** (modify: `.tsx` + `useDashboardPage.ts` + new `DashboardPage.module.css`).
  - Two-column grid on `xl`, one column below.
  - Show the guide only when `bookings.length === 0` (D6).
  - Remove the sort `<select>`. The tabs replace it (`useDashboardPage.ts:11-24` notes the sort was deliberately minimal).
- **`NeedsYouCard`** (new: `.tsx` / `useNeedsYouCard.ts` / `.module.css`).
  - Takes over the action logic from `useBookingStatusWidget.ts`: `bookerActionFor`, `act`, undo, and flag with inline reason.
  - All copy comes from `lib/bookingActionCopy.ts` (unchanged, single source).
  - Hidden when empty.
  - Unpaid rows per D10.
  - Countdown from I2.
  - **Delete `BookingStatusWidget/`** once replaced.
- **`UpNextCard`** (new: `.tsx` / `useUpNextCard.ts` for the days-until value / `.module.css`).
  - Shows the next `confirmed` or `pending` booking with `booked_date ≥ today`. Hidden if none.
  - Shows staff (D7), address, and a "Get directions" link built from the address to a Google Maps search URL. No key, no permission.
  - Shows requirements as information (F4).
- **`BookingList`** (new: `.tsx` / `useBookingList.ts` for the tab state and the grouping into Upcoming / In progress / Past / Cancelled / `.module.css`).
  - Takes a `limit` prop: 5 on Home, none on the Bookings page.
  - Rows render **`BookingProgress`** (new pure display component + `.module.css`) from I1.
  - The status is also given as text, not colour alone.
  - Replaces `BookingCard/`, which is deleted.
- **`BookingDetailModal`** (modify: hook fetches I6, `.module.css` added).
  - Adds a timeline with real timestamps, staff, directions, and a status explanation.
  - Removes the Certificate button (D6).
  - Keep it a modal. No drawer rewrite, because it adds nothing a modal lacks.
- **All four states** in every widget: loading skeleton, empty (hidden, or a CTA), error, populated. `getBookings()` currently returns `[]` on error (`bookings.service.ts:92`), which makes an error look like "no bookings". Return `{ data, error }` as `offerings.service` does, and show an error state.

#### I11: Book again + Explore by division + compact Resume  ⬜ TODO
- **`BookAgainCard`** (new: `.tsx` / `useBookAgainCard.ts` / `.module.css`).
  - Derived from completed bookings, grouped by `offering_id` (not code), newest 3.
  - Opens the Offering page (I13).
- **`DivisionShortcuts`** (new, pure display + `.module.css`). Receives `onPick(slug)` and opens Explore pre-filtered.
- **`InProgressCard`** (modify: add `useInProgressCard.ts` for Discard, and a `.module.css`).
  - Compact version with a progress bar.
  - Draft keys change in I15, so a draft in the old format is discarded, not crashed on.

#### I12: Open this weekend  ⬜ TODO (depends on D9)
- **`OpenSlotsCard`** (new: `.tsx` / `useOpenSlotsCard.ts` / `.module.css`).
  - Takes the booker's distinct past `(vendor_id, offering_id)` pairs, capped at 4.
  - Calls `getSchedulesForOffering` for each, then derives slots for the next Sat/Sun with the existing `getSlotsForDate` and the occupancy from I14 (or no counts, under D9-B).
  - Shows at most 4 slots.
  - **The cap exists to bound the fan-out.** Four pairs × one schedules query plus one occupancy call.
  - Hidden when there are no past vendors or no open slots.

### Explore, Offering, Bookings

#### I13: Explore page + Offering page + Bookings page  ⬜ TODO
- **`ExplorePage`** (new: `.tsx` / `useExplorePage.ts` / `.module.css`).
  - Search input with a visible `<label>`.
  - Division chips (`aria-pressed`) and a city `<select>` built from the distinct `vendors.city` values in the catalogue.
  - "When" filter: Any / Today / This weekend. This needs schedules, so it is **applied only to the visible results page**, not the whole catalogue, to keep the fan-out bounded. Alternatively, drop it (see verification note).
  - Recent searches kept in `localStorage`, with try/catch.
  - Start, results, no-results, loading and error states.
  - Result cards are pure display components (`OfferingResultCard`, `VendorResultCard`, each with `.module.css`).
- **`OfferingPage`** (new: `.tsx` / `useOfferingPage.ts` / `.module.css`).
  - Photo gallery (I8), description, requirements, and agreements. Agreement titles come from active `document` attachments.
  - Vendor block with directions.
  - "Who you'll see" (D7).
  - Next open slots with staff and counts per D9.
  - "Book this slot", which opens the wizard with the offering, vendor and optionally the slot preselected.
  - The date-granular case follows D11.
- **`BookingsPage`** (new, pure: renders `BookingList` without a limit).

#### I14: Occupancy RPC (D9-A). Approval gate, `backbone/`  ⬜ TODO
Draft only. **Do not write the file until approved.**

```sql
-- backbone/supabase/migrations/2026MMDD000001_slot_occupancy_rpc.sql
create or replace function public.get_slot_occupancy(
  p_schedule_ids uuid[], p_from date, p_to date
) returns table (
  schedule_id uuid, booked_date date, start_time time, end_time time, end_date date, n integer
)
language sql stable security definer
set search_path = public
as $$
  select b.schedule_id, b.booked_date, b.start_time, b.end_time, b.end_date, count(*)::int
  from public.bookings b
  join public.schedules s on s.id = b.schedule_id and s.is_active
  where public.is_active()
    and cardinality(p_schedule_ids) between 1 and 200
    and p_to >= p_from and p_to - p_from <= 31
    and b.schedule_id = any(p_schedule_ids)
    and b.booked_date between p_from and p_to
    and b.status not in ('cancelled', 'refunded')
  group by 1, 2, 3, 4, 5;
$$;
revoke all on function public.get_slot_occupancy(uuid[], date, date) from public, anon;
grant execute on function public.get_slot_occupancy(uuid[], date, date) to authenticated, service_role;
```

Blast radius:
- **Data:** read-only. It returns **aggregated counts only**: no booker id, price, or status per row. This is the same information "N of M left" already implies.
- **Lock / performance:**
  - No DDL on tables.
  - Uses the existing `bookings(schedule_id, …)` indexes. **Check with `\d bookings` before approval.** If there is no index on `schedule_id, booked_date`, that is a separate gated index.
  - The caps bound the input: 200 ids, 31 days.
- **Downstream:**
  - `getSlotOccupancy()` switches from `.from("bookings")` to `.rpc(...)` and keeps its return shape (`Map<key, n>` where it used to count 1 per row). This fixes Step 3 (F1).
  - Vendor and kiosk are unaffected, since they read under vendor RLS.
  - `schema.md` RLS section gets a row.
- **Reversibility:** `drop function public.get_slot_occupancy(uuid[], date, date);` and revert the one service function.
- **Known limitation (unchanged from today):** a multi-day booking that started before `p_from` is not counted. The current code has the same 2-day window (`schedules.service.ts:235-247`).

### Navigation and wizard

#### I15: Nav + wizard entry + removals  ⬜ TODO
- **Nav:**
  - `lib/types.ts:3` `PageId` becomes `"dashboard" | "explore" | "bookings" | "offering" | "booking" | "transactions" | "settings"`.
  - `lib/constants.ts:38-42` `MAIN_TABS` becomes Home (id `dashboard`, label "Home"), Explore, Bookings, Transactions.
  - `useAppShell` holds the selected `{vendorId, offeringId}`, the Explore query and filters (D12), and the cached catalogue (I7).
  - `app/page.tsx` adds lazy `ExplorePage` / `OfferingPage` / `BookingsPage` renders the way it already does for the others (`app/page.tsx:5-8`).
  - Sidebar, TopBar and TabBar changes are specified in **I16**. The hamburger drawer is kept.
- **Wizard** (`useBookingWizard.ts`, `BookingWizard.tsx`, `BookingStepperHeader`, `lib/constants.ts:29-36` `PROG_STEPS`):
  - Requires an initial `{ offering, vendor, slot? }`. `offering` is the per-vendor `DbOffering`.
  - Steps become Schedule → Documents → Review → Pay.
  - Remove `branch` state and use `vendor.address` (F7).
  - The draft stores `{ vendorId, offeringId, step }`. An old draft without `vendorId` is removed on read.
  - Remove `dedupeByCode` (`useBookingWizard.ts:13-33`) and `multiPriceCodes`. There is nothing to dedupe once the offering is vendor-specific.
  - Handler bodies move out of `BookingWizard.tsx:58` into the hook (F13).
- **Delete:**
  - `components/booking/steps/Step1Offering/`, `Step2Vendor/`, `components/booking/MapWidget/`, `hooks/useGeolocation.ts`.
  - The Leaflet rules in `app/globals.css:163-164`, and `getVendorsForOffering`.
  - Fix the login copy (`LoginPage.tsx:71`).
- **`leaflet`, `react-leaflet`, `@types/leaflet` uninstall:** a dependency change, so **ask at S6** before `npm uninstall`. Leaving them installed but unused is harmless until then.

---

## Plan review (2026-09-18): gaps found and folded in

- **G1: The left sidebar / hamburger drawer was never addressed. The prototype silently dropped it. FIXED → I16.**
  - Today's shell has three layers (`components/layout/AppShell/AppShell.tsx:63-94`):
    - **`Sidebar`**: a persistent column at `lg`, and a slide-out drawer below `lg` opened by the `TopBar` hamburger, with a backdrop that closes it (`AppShell.tsx:63-64`).
    - **`TopBar`**: hamburger, page title, theme toggle, bell.
    - **`TabBar`**: horizontal tabs.
  - The Sidebar lists `MAIN_TABS` + `SIDE_ITEMS` (Settings), `LegalMenu` (About & Legal, per `portals.md`), and the account dropdown with Sign out (`Sidebar.tsx:44-111`).
  - The prototype's top-nav-only header would have removed Settings, legal links and sign-out on phones. **The plan keeps all three layers.** The prototype is out of date on this point.
- **G2: `TopBar` titles are a `Record<PageId, string>`** (`TopBar.tsx:7-12`). Adding PageIds makes `tsc` fail until `explore`, `bookings` and `offering` get titles. The Home title changes from "Dashboard" to "Home". → I16.
- **G3: The active nav state for non-tab pages is undefined.** `offering` and `booking` are not tabs, so no tab would light up. Rule: `offering` and `booking` highlight **Explore**, in both Sidebar and TabBar. → I16.
- **G4: Four tabs overflow a phone.**
  - `TabBar` items are `px-[18px]` with icon + label (`TabBar.tsx:20-24`). Four of them are about 440px against a 390px viewport. Today's 3 tabs just fit.
  - Fix: below `sm`, stack the icon over a smaller label so the tabs fit without scrolling. Verified at 360px and 390px in S7. → I16.
- **G5: Realtime drops the payment flag.**
  - The bookings `UPDATE` handler patches only `status` and `statusChangedAt` (`useAppShell.ts:~95-102`).
  - The webhook's `is_paid = true` is also an UPDATE, so Needs you's "Payment not received yet" (D10) would stay stale until a reload.
  - Fix: patch `isPaid` from `payload.new.is_paid` too. → I10.
- **G6: Tabs must be accessible.** `BookingList` tabs use `@radix-ui/react-tabs` (installed), not a hand-rolled `role="tab"` row. That gives arrow-key navigation and `aria-controls` for free. → I10.
- **G7: Per-item division colour without inline styles.**
  - Render `data-division={slug ?? "none"}` on the badge.
  - `X.module.css` maps `[data-division="ezzy-court"] { color: var(--div-ezzy-court-fg); … }`.
  - No `style={{}}` and no hex in `className`. `lib/divisionStyle.ts` shrinks to a slug normaliser (unknown → `"none"`), which `divisionStyle.test` covers. → I3.
- **G8: The open booking detail goes stale.**
  - `useDashboardPage` stores a **copy** of the booking (`selBooking`, `useDashboardPage.ts:36`), so a realtime status change does not reach an open modal.
  - Fix: store `selectedId` and derive the booking from `bookings`. Refetch the status log (I6) when the derived `status` changes. → I10.
- **G9: Changing `getBookings()` to `{ data, error }` has three callers.** `useAppShell` (login + realtime refetch), `TransactionsPage` (via props) and the wizard's `onBookingConfirmed` path. All three change in S1, with the error surfaced once in the shell rather than per widget. → I5.
- **G10: New bookings must appear with their new fields.** After the wizard confirms, the shell must **refetch** `getBookings()` rather than insert the wizard's partial `Booking`, or staff, division and requirements are missing until a reload. Check `onBookingConfirmed` in `useAppShell` at S6. → I15.
- **G11: Search input a11y and debounce.**
  - `type="search"` with a visible label.
  - Matching runs on the cached catalogue (no network), so no debounce is needed for fetching. The "When" filter's schedule lookups are debounced (300 ms) and limited to visible results.
  - Result count announced through an `aria-live="polite"` region. → I13.
- **G12: Branding strings are inconsistent (out of scope, noted).** The Sidebar says "RS Booker / RS Client Portal" (`Sidebar.tsx:33-34`) while `APP_NAME` is used elsewhere. Not changed here. Flagged for a branding pass.

### I16: App shell chrome (Sidebar drawer, TopBar, TabBar)  ⬜ TODO
**Files:** `components/layout/Sidebar/Sidebar.tsx`, `TopBar/TopBar.tsx`, `TabBar/TabBar.tsx`, `AppShell/AppShell.tsx`, `lib/constants.ts:38-46`
- **Sidebar stays.**
  - It stays persistent at `lg`, and is a hamburger drawer below `lg` with the backdrop. `goPage()` still closes it (`useAppShell.ts:188-191`).
  - Main section: the 4 new `MAIN_TABS` (data-driven, so this happens automatically).
  - Account section: Settings. `LegalMenu` and account/Sign out are unchanged.
  - Active rule per G3.
  - Brought to tokens: its hard-coded gradients and hex at `Sidebar.tsx:31,50,64,…` move to a `Sidebar.module.css`.
  - Handler wiring stays as `onNavigate` props. It has no state, so no hook is needed (pure display per component-separation).
- **TopBar:**
  - Hamburger, title, theme toggle and bell are unchanged.
  - `TITLES` gains the new pages (G2).
  - Adds a search entry: a field-shaped button at `md+`, an icon button with `aria-label="Search"` below `md`. Both open Explore and focus the input. The focus request lives in `useAppShell` as a flag, since `TopBar` has no hook today and gets none.
- **TabBar:** 4 tabs with the G4 phone layout and the G3 active rule; hex → tokens.
- **Verification:**
  - Machine: `tsc` (the TITLES record), grep for no hex in these files.
  - Live: at 390px, hamburger → drawer → each item navigates and closes the drawer; Settings, About & Legal and Sign out are reachable; at 1280px the sidebar is persistent; both themes.

---

## Parked

- **P1: Real "near me" / map.** Needs `vendors.lat/lng` and geocoding on vendor address writes (schema + vendor app). Unblocked by a product decision that proximity matters.
- **P2: Retry payment for an unpaid booking (D10-A).** Unblocked by a hardened `create-session` (status/`is_paid` guard + expire the previous session), reviewed as a payment/security change.
- **P3: URL routing for Explore/Offering (D12-A).** Unblocked by a decision to leave booker's single-page shell.
- **P4: Staff contact over-exposure (F6).** Belongs in a backbone security plan: column-level grants or a view.
- **P5: Date-granular booking (D11-A).** A separate plan fixes `Step3Schedule` date mode.
- **P6: Server-side search.** Only if the catalogue outgrows client-side matching. Would need a search function or index, which is a schema gate.

---

## Execution order

One stage at a time (developerboss cadence). Each stage ends with `npx tsc --noEmit`, `npm run lint` and `npm test` in `booker/`, and a report.

- **S0: Foundations.** I1, I2, I3, I4. Pure modules and tests, no UI change. *Safe now.*
- **S1: Data layer.** I5, I6, I8, I9, I7. Types and services only. Existing screens keep working.
- **S2: Home core.** I10. Deletes `BookingStatusWidget/` and `BookingCard/`.
- **S3: Home side.** I11. I12 waits for S3b (D9-A).
  - **S3b (D9-A, coupled):** write the I14 migration on approval → you apply it → switch `getSlotOccupancy()` → verify Step 3 and I12 together against staging.
- **S4: Nav + Explore.** I16 (shell chrome: Sidebar drawer, TopBar, TabBar), I15's nav part, and I13's `ExplorePage` and `BookingsPage`.
- **S5: Offering page.** I13's `OfferingPage`. Staff per D7/D8.
- **S6: Wizard entry + removals.** The rest of I15. The Leaflet uninstall is asked for here.
- **S7: Polish.**
  - Dark/light pass at 390px and 1280px on every new surface.
  - Contrast check for the `--div-*` pairs, keyboard pass, 44px targets.
  - Regenerate the Playwright baselines (`visual-tests/pilot.spec.ts-snapshots`, which are committed) and review the diffs, not just accept them.
- **S8: Docs.**
  - `architecture/portals.md`: booker features, Live-vs-Mock, Known Gaps, Roadmap (D4 supersedes #1), nav.
  - `architecture/booking-flow.md`: the new entry path and removal of Steps 1–2.
  - `architecture/schema.md`: only if I14 lands.
  - Rewrite `booker/AGENTS.md` (F11).
  - Cross-reference booker-mobile-prototype W1/W5 as delivered on web.

---

## Big table

The single checklist for this plan. It is updated before every stage report. **Who:** Me = Claude, You = the user. Git commits are always yours; I draft the message and the file list.

| Done | ID | What | Who | Status | Why / reason |
|:-:|---|---|---|---|---|
| [x] | Proto | Mock-data prototype on a canvas | Me | ✅ DONE 2026-09-18 | Settles the direction before planning. Reference only: it is missing the sidebar (G1) and uses a font we are not adopting (D3) |
| [x] | D1–D12 | All design decisions | You | ✅ DONE 2026-09-18 | Hard gate: no stage runs while a decision is open |
| [x] | G1–G12 | Plan review gaps folded in (sidebar, tabs, realtime, a11y, …) | Me | ✅ DONE 2026-09-18 | Keeps a weak implementation from satisfying the plan as written |
| [ ] | Approve | Approve the plan for execution | You | ⬜ TODO | Execution needs your explicit go |
| [ ] | S0 | Foundations: progress map, auto-confirm countdown, division colours (light + dark), search matcher, with tests (I1–I4) | Me | ⬜ TODO | Pure logic first, so later UI is built on tested rules. No visible change, so no risk |
| [ ] | S1 | Data layer: bookings fields, status history, catalogue, photos, schedules with staff (I5–I9, G9) | Me | ⬜ TODO | The widgets need these fields. Existing screens keep working |
| [ ] | S2 | Home core: Needs you, Up next, My bookings + progress, booking detail (I10, G5, G6, G8) | Me | ⬜ TODO | Replaces the two overlapping lists. This is what you asked for most |
| [ ] | S3 | Home side: Book again, Explore by division, compact Resume, guide for new bookers only (I11) | Me | ⬜ TODO | Low-risk widgets built on S1 data |
| [ ] | S3b-1 | Approve the counts-only occupancy function (I14) | You | ⬜ TODO | Schema change in `backbone/`: an approval gate touching a second folder |
| [ ] | S3b-2 | Write the migration file | Me | ⬜ TODO | Written only after S3b-1 |
| [ ] | S3b-3 | Apply the migration (local, then staging) | You | ⬜ TODO | You apply all migrations yourself |
| [ ] | S3b-4 | Switch the occupancy count to the new function; build "Open this weekend" (I12) | Me | ⬜ TODO | Fixes Step 3's wrong "spaces left" (F1) and gives the widget honest counts |
| [ ] | S3b-5 | Staging check: a second booker's booking lowers "N left" for the first | You | ⬜ TODO | Needs two real booker accounts in a live environment |
| [ ] | S4 | Shell (Sidebar drawer, TopBar search + titles, 4-tab TabBar) + Explore + Bookings page (I16, I13, I15 nav) | Me | ⬜ TODO | Search needs somewhere to live. The sidebar and hamburger drawer are kept (G1) |
| [ ] | S5 | Offering page with photos, assigned staff, next slots; date-based offerings show Book disabled (I13, D7, D8, D11) | Me | ⬜ TODO | The step between search and booking (D1) |
| [ ] | S6 | Wizard starts at Schedule; remove Steps 1–2, map, geolocation (I15, G10) | Me | ⬜ TODO | Booking now starts from an offering, so the old first steps are dead code |
| [ ] | S6-a | Approve uninstalling `leaflet`, `react-leaflet`, `@types/leaflet` | You | ⬜ TODO | Changing dependencies is an approval gate |
| [ ] | S6-b | End-to-end on staging: Explore → Offering → Schedule → Pay (PayMongo test mode) | You | ⬜ TODO | A real payment round trip needs staging keys and a browser |
| [ ] | S7 | Polish: light + dark at 360/390/1280, contrast, keyboard, 44px targets, regenerate visual baselines | Me | ⬜ TODO | You asked for dark mode everywhere. Baselines will change because the screens change |
| [ ] | S7-a | Review the visual baseline diffs | You | ⬜ TODO | Baselines are committed, and a diff should be looked at, not rubber-stamped |
| [ ] | S8 | Docs: `portals.md`, `booking-flow.md`, `booker/AGENTS.md` (stale), `schema.md` if I14 lands | Me | ⬜ TODO | Docs must match the shipped app. `booker/AGENTS.md` is already wrong (F11) |
| [ ] | Git | Commit after each stage | You | ⬜ TODO | You handle git. I give you a message and file list |
| [ ] | P1 | "Near me" / real map | — | ⏸ PARKED 2026-09-18 | Vendors have no coordinates. Unblocked by a product decision that proximity matters |
| [ ] | P2 | Retry payment for an unpaid booking | — | ⏸ PARKED 2026-09-18 | Today's payment route could charge twice (F3). Unblocked by a reviewed hardening of `create-session` |
| [ ] | P3 | Real URLs for Explore / Offering (browser Back, shareable links) | — | ⏸ PARKED 2026-09-18 | Keeping booker's single-page shell (D12). Unblocked by a decision to change it |
| [ ] | P4 | Staff email/phone readable by any active user | — | ⏸ PARKED 2026-09-18 | A backbone security fix, outside booker (F6). This plan reads names only |
| [ ] | P5 | Booking offerings by the day / week / month | — | ⏸ PARKED 2026-09-18 | Existing Step 3 gap (D11). Unblocked by a separate plan |
| [ ] | P6 | Server-side search | — | ⏸ PARKED 2026-09-18 | Client-side is enough for today's catalogue. Unblocked if it outgrows that |
| [ ] | X1 | Spending widget on Home | — | ✖ ABORTED 2026-09-18 | Little value for a customer with a few bookings; Transactions already shows spend (D6) |
| [ ] | X2 | Drag-to-arrange widgets | — | ✖ ABORTED 2026-09-18 | Over-engineered. Widgets show only when relevant instead (D6) |
| [ ] | X3 | Placeholder "Certificate" button | — | ✖ ABORTED 2026-09-18 | It does nothing, and a dead button costs trust (D6). Removed in S2 |
| [ ] | X4 | Map + vendor step in the wizard | — | ✖ ABORTED 2026-09-18 | Only showed the booker's own location; replaced by directions links + city filter (D4) |
| [ ] | X5 | Prototype's top-bar-only navigation | — | ✖ ABORTED 2026-09-18 | Would have removed Settings, legal links and Sign out on phones (G1) |
| [ ] | X6 | Waiver upload / "1 of 2 documents" in Up next | — | ✖ ABORTED 2026-09-18 | Uploads aren't saved anywhere, so there's nothing to count (F4) |
| [ ] | X7 | New font and surfaces from the prototype | — | ✖ ABORTED 2026-09-18 | You chose to carry over only the division colours (D3) |
| [ ] | X8 | "Team" list of qualified staff | — | ✖ ABORTED 2026-09-18 | Being qualified doesn't mean they'll be the one you get (D7) |
| [ ] | X9 | Hiding day/week/month offerings from search | — | ✖ ABORTED 2026-09-18 | Would hide real vendor catalogue (D11) |

---

## Verification

| Item | Machine-verifiable | Needs a live environment |
|---|---|---|
| I1, I2, I4 | `npm test` cases (every status × pattern; service-date gate; matcher) | — |
| I3 | grep: no hex in new `className`; both themes define every `--div-*` | Contrast measured in the browser, both themes |
| I5–I9 | `tsc`; the selects compile against hand-written types | Local/staging: staff name appears; photos resolve; a hidden vendor's offerings are absent |
| I10–I13 | `tsc`, lint, Playwright baselines | Dev server at `localhost` (WSL note), light/dark, 390/1280; all four states forced (empty account, network error) |
| I14 | Migration lints; `tsc` for the service switch | **Staging:** a second booker's booking reduces "N left" for the first; anon cannot execute |
| I15 | grep: no imports of the deleted modules; `tsc`; `leaflet` absent from the bundle after uninstall | End-to-end: Explore → Offering → Schedule → Pay on staging (PayMongo test mode) |

Weak-implementation traps to check at review:
- (a) a progress map that ignores `cancelled`/`refunded`/`disputed`;
- (b) grouping or joining on `offerings.code` instead of `id`;
- (c) the Explore "When" filter fetching schedules for the whole catalogue;
- (d) the countdown reverting to flat +3 days;
- (e) the catalogue refetching on every keystroke;
- (f) staff selects pulling `email`/`phone`;
- (g) error states collapsing into empty states;
- (h) the Sidebar/hamburger drawer removed or losing Settings, legal links or Sign out (G1);
- (i) realtime not patching `is_paid` (G5);
- (j) a fourth tab overflowing a 360px phone (G4).
