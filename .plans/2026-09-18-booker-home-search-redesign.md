# Booker: widget Home, better booking status, Explore/search, offering page, Payments

**Date:** 2026-09-18 (Payments folded in 2026-09-20)
**App / scope:** `./booker`. One optional backbone migration (D9) sits behind its own approval gate.
**Status:** APPROVED 2026-09-21 — execution not started (next: S0). **Read the ezzy-booker-mobile briefing below first** (added 2026-09-22): S0 and parts of S1 already exist, ported and tested, in the phone app, and it found ten things for web to settle (N1–N10). All decisions resolved: D1–D12 on 2026-09-18, D13–D16 (Payments) on 2026-09-20. I14 (backbone migration) and the Leaflet uninstall still need their own go when their stages arrive.

> Make Home a set of widgets that shows what needs the booker next. Replace the two overlapping booking lists with one list that shows each booking's progress. Add search across services and vendors that opens a page for one vendor's offering, and book from that page. Rebuild Transactions as **Payments**, with honest totals, filters, CSV and paging. Everything works in light and dark.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** F# = finding, D# = decision, I# = implementation item, S# = execution stage. Numbers are plan-local. Qualify cross-plan refs, e.g. "booker-mobile-prototype D5".

**Prototype (mock data, reference only):** https://claude.ai/artifact/DZyasjx3GN8d6EQeAsw9Aj
- Home (desktop light, phone dark), Explore, the Offering page, and **Payments (desktop light + phone dark)** — the Payments screens were approved 2026-09-20.
- Per D3, **only the division colours carry over** from the prototype's look. Booker keeps its current `--db-*` surfaces, type and primary blue.

---

## Briefing from ezzy-booker-mobile (added 2026-09-22 — read this before S0)

The phone app in `.plans/2026-09-21-booker-mobile-app.md` was built **to these
designs and this plan's decisions**, on mock data, and is complete (M1–M9). It
ported the rules this plan's S0/S1 describe, from booker's own code, and **tested
them**. Two consequences for whoever executes this plan:

1. **S0 and parts of S1 are largely a copy back, not a fresh build.** Take the
   mobile file, drop the `.ts` extension imports (they exist because mobile's
   tests run under `node --test` with strip-types), and keep the tests.
2. **The mobile build found ten things wrong or undecided in web** (N1–N10 below).
   They are cheapest to fix while these screens are being written.

### What already exists, tested, in `ezzy-booker-mobile/src/lib/`

| Mobile file | What it is | Web item it serves | Tests |
|---|---|---|---|
| `slots.ts` | **Byte-identical** to `booker/lib/slots.ts` — proven by `diff` on 2026-09-22 | — | `slots.test.ts` (booker's own suite) |
| `occurrence.ts` | Which dates a schedule runs: none/weekly/biweekly/monthly, date bounds, date-granular. Ported from `booker/services/schedules.service.ts` `isOccurrence` | I9, and the fifth copy of the rule `check_booking_placement()` owns | `occurrence.test.ts` — vendor-mobile's fixtures **plus a year-long cross-check against a verbatim copy of booker's function**, all recurrences, both granularities |
| `bookingProgress.ts` | Progress steps for **all nine statuses**, cancelled/refunded/disputed as terminal tracks, with a runtime fallback | **I1** | `bookingProgress.test.ts` |
| `autoConfirm.ts` | Auto-confirm date with the service-date gate: `max(changedAt + 3d, service day start)`, Manila | **I2** | `autoConfirm.test.ts` |
| `search.ts` | The matcher: lower-cased, every token must match, grouped into services and vendors, no fuzzy library; plus cities, popular categories, recent searches, the result line | **I4** | `search.test.ts` |
| `payments.ts`, `paymentsFilter.ts`, `paymentsCsv.ts`, `receiptHtml.ts` | Money states, paid-only totals, Manila month groups and period presets ("Last 3 months" = the same day three months back), CSV of the **filtered** set, receipt HTML with escaping | **I17, I19, I20, I21** | four test files |
| `statusPalette.ts` + `contrast.ts` | Status colours per theme **and a contrast test** for every text/surface pair | I3, and **N9** | `statusPalette.test.ts` |
| `divisions.ts`, `theme/divisionPalette.ts` | 13 division slugs + `none`, light and dark, slug-keyed, unknown → neutral | **I3** | `divisions.test.ts` (every pair ≥ 4.5:1) |
| `homeRules.ts` | Needs you / Up next / the four booking groups / Book again (by offering **id**) / show-the-guide | **I10, I11** | `homeRules.test.ts` |
| `statusExplain.ts`, `bookingTimeline.ts` | Plain explanation per status; timeline steps with the real `booking_status_log` times | I6, I10 | `bookingDetail.test.ts` |
| `manila.ts`, `format.ts` | Manila calendar days with fixed +08:00 arithmetic (never the device zone); day, time, range, price-suffix and relative-day formatting | I19 and every date on screen | `format.test.ts` |
| `bookingActionCopy.ts` | **Copied verbatim from `booker/lib/bookingActionCopy.ts`** — unchanged, listed so nobody re-invents it | I10 | — |

Mobile's component split (`Name.tsx` render / `useName.ts` logic / styles) mirrors
this repo's convention, so the screens are also a useful reference for how the
widgets were assembled — see `.plans/2026-09-21-booker-mobile-app.md` §7 M1–M9 for
what each stage built and how it was verified.

### N1–N10 — what mobile found, for web to settle

- **N1** Mobile has **Call vendor** on the booking detail (`vendors.phone`); web doesn't. Add it?
- **N2** Mobile shows **offering photos and description** on the booking detail; web's modal doesn't.
- **N3** Web **names Inter but never loads it** (`booker/components/layout/AppShell/AppShell.tsx:62`; no `@font-face`, no Google Fonts link, no `next/font` anywhere in `app`, `components` or `public`). Either load it or drop the name — most visitors currently see their system font.
- **N4** Booker has **no Delete account**, which the Privacy Policy expects, and Apple requires for the phone app (mobile G4/W5).
- **N5** Web's **dark** muted text `#64748b` is ~4.1:1 on the dark page — under 4.5:1. The approved phone board uses `#94a3b8`; mobile matches the board.
- **N6** The canvas's **Pets** division colour (`#b45309` on `#fdf0dc`) is **4.47:1**. Mobile uses `#92400e`. I3 must check every pair, not only this one.
- **N7** The design's pending line, "You have not been charged for a booking they decline", may be **false**: bookers pay before the vendor accepts and there is no refund mechanism (F18). Mobile says "Waiting for the vendor to accept your booking." Confirm the true wording before it ships on either client.
- **N8** Two search details: (a) the board prints some prices with no unit ("₱ 1,200", "₱ 950"), but `offerings.price` is per booked block, so mobile always names the block ("/ hr", "/ 60 min"); pick one rule for both clients. (b) Per I4 the division **name** is searchable, so "court" also returns everything at an EzzyCourt vendor (e.g. "Paddle Set Rental") — the board behaves the same; confirm it's wanted.
- **N9** Web's **light** badge colours (`.db-badge-*`, the Tailwind -600 shades `#059669`, `#d97706`, …) are **2.9–3.8:1 as text**, on their own tint and on white alike. Mobile uses one shade darker (-700; amber and orange -800) in light only — see `ezzy-booker-mobile/src/theme/statusPalette.ts`, guarded by `statusPalette.test.ts`. Web's light `--db-text` `#64748b` is 4.26:1 on the page gradient; mobile uses the canvas's own `#5b6576`.
- **N10** `booker/services/schedules.service.ts` `getSlotsForDate` sorts slots by clock text, so a window running past midnight lists "00:00" **before** "23:00". Mobile sorts by instant.

### What mobile is waiting on from this plan

`.plans/2026-09-22-booker-mobile-real-data.md` (the phone app's real-data plan)
blocks on three items here — its W1, W2 and W6:

- **W1 ← P2 / F3.** `booker/app/api/payment/create-session/route.ts:31-33` authenticates the SSR cookie only. Mobile needs a **Bearer-token** path, and the route must refuse a booking that is already paid.
- **W2 ← I14 / S3b.** The counts-only occupancy function. Until it exists, mobile shows no counts rather than wrong ones (D9-B), exactly as this plan chose for web.
- **W6 ← I5 / S1.** Paged `getBookings`. Mobile inherits the same 1000-row cap.

Three more mobile gaps sit outside this plan: uploads with somewhere to store them (W3), a booker write path for `booking_acknowledgements` (W4), and the account-deletion route (W5, also N4).

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
- **The Payments page** (today's Transactions): honest totals, period control, filters, month grouping, receipt, CSV export, 10-per-page (D13–D16).
- Docs.

**Out:**
- `ezzy-booker-mobile`. It has its own plan, `2026-09-21-booker-mobile-app.md` (which replaced `2026-09-18-booker-mobile-prototype.md` on 2026-09-21; built in another session). That plan follows this one's designs; its **§4 "Web → native differences"** lists every difference between these designs and native mobile, and why. Mobile's S0 and S5 are already built (uncommitted), so web changes to shared rules (progress steps, auto-confirm, payment states, division colours) should be noted there.
- Persisting document uploads (existing known gap).
- Cancellation or reschedule.
- Reviews and ratings (no `reviews` table).
- Vendor lat/lng and "near me".
- A spending widget.
- Drag-to-arrange widgets.
- Changes to `vendor` or `command`.

**Why Payments lives in this plan, not its own:** it shares the `getBookings()` shape change (I5), the division colours (I3), the `PageId` union and the tab bar (I16). A separate plan would duplicate every coupling and split one big table in two.

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
| Tests | `node --test` (`lib/**/*.test.ts`), Playwright visual (`visual-tests/`) | I1, I2, I4, I17, I18, I19 tests. Baselines regenerated in S7 |

✅ `booker/AGENTS.md` said "Next.js 15.1" and "single-file `app/page.tsx`" (F11). **Rewritten 2026-09-21** from `package.json` and the real tree, and `booker/CLAUDE.md` now just imports it (`@AGENTS.md`, as the mobile apps do). S8 updates it again for what ships.

---

## Findings (F1–F13 verified 2026-09-18, F14–F21 on 2026-09-20, by reading the cited code)

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
  - Division is reachable as `vendors.division_id → divisions(slug, name)`. Divisions are readable by `authenticated` (`20260724000004_divisions.sql:53`), and **13** slugs are seeded at `:29-42` (corrected 2026-09-21: this line said 8, which stopped at `ezzy-pets`; the mobile plan's N5 caught it).
- **F10: Offering photos are available but unused by booker.**
  - `offering_attachments` `kind='photo'`, public bucket `offering-photos`, readable by active users (`20260829000001_offering_attachments.sql:129`).
  - Vendor resolves URLs at `vendor/services/offeringAttachments.service.ts:253`.
- **F11: `booker/AGENTS.md` is stale.** It describes a single-file `app/page.tsx` app that no longer exists. Fix it in S8.
- **F12: Status history is readable.** Bookers can read `booking_status_log` for their own bookings (`20260516000006_booking_status_log.sql:38`). The detail timeline can show **real timestamps** instead of inferred steps.
- **F13: Existing separation violations in files this plan touches.**
  - Examples: inline handler bodies at `BookingWizard.tsx:58`, hard-coded hex in `DashboardPage.tsx`, `BookingStatusWidget.tsx`, `TabBar.tsx`.
  - Rule: any component this plan rewrites is brought to the convention. Untouched files are not "cleaned up".

- **F14: "Total Spent" is wrong today. ESCALATED — it is a money figure, and it overstates.**
  - `components/transactions/TransactionsPage/TransactionsPage.tsx:26` sums `pricePaid` over **every** booking, including ones never paid (`is_paid = false`) and ones `cancelled` or `refunded`.
  - A booker who abandoned checkout on a ₱2,400 lesson is told they spent it. → I17.
- **F15: "Method: —" is a permanent dash** (`TransactionsPage.tsx:89`). Booker stores no payment method; PayMongo holds it. Removed, not faked. → X10.
- **F16: The page breaks three conventions and is rewritten anyway.** No hook (all derivation inline), static inline `style={{}}` objects (`:40-46`, `:71-86`), hard-coded hex, and an empty `OFFERING_CODE_STYLE` lookup that always falls back to indigo (`lib/constants.ts:49`).
- **F17: `getBookings()` can silently truncate.** `services/bookings.service.ts:77-85` selects with no `.range()` and no `count`. PostgREST caps at `max_rows` 1000 and signals it with a 206 that supabase-js does not raise (`lib/pagedFetch.ts:1-12`, with a measured 19.7% understatement in vendor). A long-standing booker would get a short list and understated totals with no warning. → I5 (paged) + I17 (banner).
- **F18: "Refunded" must not promise money back.** `portals.md:654` states there is **no refund mechanism in this system**, and `payout_status = 'reversed'` says only that the *vendor* is not paid. A `refunded` booking status therefore must not be worded as "we returned your money". Copy rule in I17. → also X11.
- **F19: Booker lacks two things vendor already has, and they are copied, not shared** (root AGENTS.md: independent repos).
  - Manila date-range helpers: `vendor/lib/utils.ts:223,231,303` (`phMonthRange`, `phLastNDays`, `phYearRange`). → I19.
  - Print styles: `vendor/app/globals.css:218` has an `@media print` block; booker's `globals.css` has none, so a receipt would print the whole app. Vendor's print pattern is a **second, print-only render** of the full filtered set (`TransactionPrintView.tsx:28-38`) precisely because `window.print()` serialises the DOM as it stands and would otherwise print only the current page. → I20.
- **F20: A CSV pattern already exists — do not invent one.** `command/lib/affiliateCsv.ts` (+ `.test.ts`): pure string builder, RFC 4180 quoting, CRLF, and a UTF-8 BOM so Excel on Windows does not mangle `₱` and `ñ`. Copy its shape. → I18.
- **F21: `fmtPeso` does not exist in booker** (`lib/utils.ts` has `fmtDate`, `statusLabel`, `showPaymentPending`, no money formatter), so amounts are formatted ad hoc today. One formatter, used by the page, the receipt and the print view. → I17.

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
- **D5: Navigation → Home · Explore · Bookings · Transactions** (resolved 2026-09-18). *The fourth tab is renamed **Payments** by D13 (2026-09-20); I15/I16 use the new name via I21.* "Booking" stops being a tab, because the wizard starts from an offering. Settings stays in the sidebar.
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

### Payments decisions (approved with the Payments screens, 2026-09-20)

- **D13: Page name → "Payments"** (resolved 2026-09-20). "Transactions" is accounting language; a customer wants what they paid and what is owed. The `PageId` is renamed to `payments` to match the folder, with `tsc` catching every reference. Grep the string `transactions` before renaming, in case a notification or deep link names it.
- **D14: CSV export → yes** (resolved 2026-09-20). Client-side only, no dependency, exports the **filtered set** (not the current page). Amounts are plain numbers so a spreadsheet can sum them; the `₱` lives in the header, not the cells.
- **D15: Pagination → 10 per page, client-side, over one paged fetch** (resolved 2026-09-20).
  - The shell loads the booker's bookings once and Home's widgets (Needs you, Up next, Book again) need **all** of them, so server-side per-page queries would mean a second, divergent data path.
  - `getBookings()` therefore becomes a `fetchAllPages` call with an exact count (I5, fixing F17); Payments pages that array 10 at a time.
  - Page resets to 1 on any filter change, and a page past the end is clamped — vendor learned both (`vendor/components/transactions/TransactionsPage/useTransactionsPage.ts:159-174`).
- **D16: Receipt + print → keep** (approved with the design 2026-09-20). Needs booker's first `@media print` block, copied from `vendor/app/globals.css:218` (F19).

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
  - `--div-<slug>-fg` / `--div-<slug>-bg` for all **13** seeded slugs (corrected 2026-09-21 from 8), plus `--div-none-*`, in both `:root` and `.dark`.
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
  - `lib/types.ts:3` `PageId` becomes `"dashboard" | "explore" | "bookings" | "offering" | "booking" | "payments" | "settings"` (`transactions` → `payments`, D13).
  - `lib/constants.ts:38-42` `MAIN_TABS` becomes Home (id `dashboard`, label "Home"), Explore, Bookings, **Payments** (id `payments`, per D13/I21 — if S4 runs before S9, S4 does the rename).
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

### Payments page (D13–D16)

#### I17: `lib/payments.ts` + test — the pure money rules  ⬜ TODO
The one place that decides what a booking means for money. Pure, so `node --test` covers it.
- `paymentState(booking)` → `"paid" | "due" | "cancelled" | "refunded"`, **exhaustive over all nine `BookingStatus` values** with a `never` check:
  - `cancelled` → `cancelled`, `refunded` → `refunded`, regardless of `is_paid`;
  - otherwise `is_paid ? "paid" : "due"`.
- `paidTotal(rows)` counts **only** `paid`. This is the F14 fix: never-paid and cancelled bookings are excluded from money totals, shown with the amount struck through, and counted in a "N cancelled, not counted in Paid" note.
- `dueTotal(rows)` sums `due`.
- `groupByMonth(rows)` → month label + per-month paid subtotal, in the active sort order.
- `matchesPaymentSearch(row, query)` over offering name, code, vendor and reference.
- `fmtPeso(n)` (F21): one formatter, two decimals, thousands separators, used by page, receipt and print view.
- **Copy rule (F18):** wording for `refunded` says *"Marked refunded — Ezzy can confirm the amount"*, never "we refunded you". A unit test asserts the copy table has no "refunded to you" phrasing.
- Tests: one case per status × `is_paid`, plus totals excluding cancelled/unpaid, month grouping across a year boundary, and search.

#### I18: `lib/paymentsCsv.ts` + test  ⬜ TODO
Copy the shape of `command/lib/affiliateCsv.ts` (F20): pure, RFC 4180 quoting (`"` doubled, quote when the cell holds `,` `"` or a newline), CRLF, UTF-8 BOM.
- Columns: `paid_date, service_date, offering_code, offering_name, vendor, amount_php, payment_state, booking_status, reference`.
- `amount_php` is a plain number — a `₱` in the cell makes it text in every spreadsheet.
- The download (Blob + anchor + `revokeObjectURL`) lives in `usePaymentsPage`, not in this module and not in the `.tsx`.
- Filename carries the period, e.g. `ezzy-payments-2026-06-20_2026-09-20.csv`.
- Tests: a vendor name with a comma and a quote, an empty set (headers only), and the BOM's presence.

#### I19: `lib/phDates.ts` + test  ⬜ TODO
Copy `phMonthRange`, `phLastNDays`, `phYearRange` from `vendor/lib/utils.ts:223-303` (F19), Asia/Manila, with their tests. Presets: This month · Last 3 months · This year · All time, plus a custom from/to.
- **Manila, not the browser's zone.** A booker in another timezone must see the same month boundaries the database uses, or a payment near midnight lands in the wrong period.

#### I20: Payments components  ⬜ TODO
New folder `components/payments/`, mirroring vendor's split (all state in one hook, children controlled and hook-free):
- **`PaymentsPage`** — `.tsx` (render only) + `usePaymentsPage.ts` (period, custom range, status filter, search, vendor, sort, page, selected receipt, CSV download, print sequence) + `PaymentsPage.module.css`.
- **`PaymentPeriodBar`** — pure display, above the totals **deliberately**: the range and the figures it produces must be visible together, or the cards read as all-time numbers (vendor's note at `TransactionDateRange.tsx:20-27`).
- **`PaymentSummaryCards`** — pure display: Paid, Awaiting payment, Bookings shown + exclusion note.
- **`PaymentFilters`** — pure display: search (`type="search"` + visible label), status chips with counts (`aria-pressed`), vendor `<select>`, sort `<select>`, and a Clear button shown only when something is set.
- **`PaymentMonthGroup`** / **`PaymentRow`** — pure display; division-coloured code tile via `data-division` (G7); status shown as dot **plus** label, never colour alone; struck-through amount for cancelled/refunded.
- **`PaymentReceipt`** — the existing shadcn `dialog`; amount, paid-on, service date, booking status, reference (shortened session id), and the state's plain-English note.
- **`PaymentsPrintView`** — print-only second render of the **full filtered set**, not the current page (F19), with the truncation banner printed too.
- **States:** loading skeleton, empty account, no-results-for-filters (with Clear), and error. The error state is distinct from empty — a failed fetch must never read as "no payments".
- Pagination footer: `Showing X–Y of Z`, Previous/Next disabled at the ends, 10 per page (D15).
- **Delete `components/transactions/`** once replaced.

#### I21: Rename to Payments  ⬜ TODO
- `lib/types.ts` `PageId`: `transactions` → `payments`; `lib/constants.ts` `MAIN_TABS` label and icon; `TopBar` `TITLES`; `app/page.tsx` lazy import; `AppShell` render prop.
- Grep `"transactions"` across `booker/` first (notifications, deep links, tests) so the rename does not orphan a string.
- `globals.css`: add the `@media print` block (D16).

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
- **P7: A real receipt number.** Today's reference is the PayMongo checkout session id, which is not a receipt number. Unblocked by a decision to store one (schema gate).
- **P8: Payment method per booking.** Not stored anywhere (F15). Unblocked by capturing it from the PayMongo webhook payload (schema + route change).
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
- **S9: Payments core.** I17, I19, I21, and I20's page, period bar, summary cards, filters, month groups and rows. Depends on S0 (division colours), S1 (paged `getBookings`) and S4 (the tab). Deletes `components/transactions/`.
- **S9b: Payments receipt, CSV and print.** I18, plus I20's receipt and print view, and the `@media print` block.
- **S7: Polish** — runs **after S9b**, so the pass covers Payments too.
  - Dark/light pass at 390px and 1280px on every new surface.
  - Contrast check for the `--div-*` pairs, keyboard pass, 44px targets.
  - Regenerate the Playwright baselines (`visual-tests/pilot.spec.ts-snapshots`, which are committed) and review the diffs, not just accept them.
- **S8: Docs** — last stage.
  - `architecture/portals.md`: booker features, Live-vs-Mock, Known Gaps, Roadmap (D4 supersedes #1), nav.
  - `architecture/booking-flow.md`: the new entry path and removal of Steps 1–2.
  - `architecture/schema.md`: only if I14 lands.
  - Update `booker/AGENTS.md` for what shipped (rewritten ahead of time on 2026-09-21, F11).
  - Cross-reference booker-mobile-prototype W1/W5 as delivered on web.
  - Payments: rename in `portals.md` (Transactions → Payments), the corrected totals rule, filters, CSV and pagination.

---

## Big table

The single checklist for this plan, Home **and** Payments. Updated before every stage report. **Who:** Me = Claude, You = the user. Git commits are always yours; I draft the message and the file list.

| Done | ID | What | Who | Status | Why / reason |
|:-:|---|---|---|---|---|
| [x] | Proto-1 | Prototype: Home, Explore, Offering | Me | ✅ DONE 2026-09-18 | Settle the direction before planning. Reference only: no sidebar (G1), font not adopted (D3) |
| [x] | Proto-2 | Prototype: Payments desktop + phone dark | Me | ✅ DONE 2026-09-20 | Approved 2026-09-20 with three answers: name "Payments", add CSV, 10 per page |
| [x] | D1–D12 | Home / Explore / Offering decisions | You | ✅ DONE 2026-09-18 | No stage runs while a decision is open |
| [x] | D13–D16 | Payments decisions (name, CSV, pagination, print) | You | ✅ DONE 2026-09-20 | Same gate, Payments half |
| [x] | G1–G12 | Plan review gaps folded in (sidebar, tabs, realtime, a11y, …) | Me | ✅ DONE 2026-09-18 | Keeps a weak implementation from satisfying the plan as written |
| [x] | F14–F21 | Payments findings (wrong totals, truncation, refund wording, existing CSV/print/date patterns) | Me | ✅ DONE 2026-09-20 | Read the real code before planning; three are money bugs or copy risks |
| [x] | Approve | Approve the plan for execution | You | ✅ DONE 2026-09-21 | Approved; execution starts with S0 |
| [ ] | Brief | Read the ezzy-booker-mobile briefing: what to copy back, N1–N10, and the three items mobile waits on (W1/W2/W6) | Me | ⬜ TODO | Added 2026-09-22 after the phone app shipped on mock data |
| [ ] | S0 | Foundations: progress steps, auto-confirm countdown, division colours (light + dark), search matcher, + tests (I1–I4) | Me | ⬜ TODO | Tested rules first; no visible change, so no risk |
| [ ] | S1 | Data layer: booking fields, status history, catalogue, photos, staff, **paged `getBookings`** (I5–I9, F17, G9) | Me | ⬜ TODO | Both Home and Payments read these fields; paging removes the silent 1000-row cut |
| [ ] | S2 | Home core: Needs you, Up next, My bookings + progress, booking detail (I10, G5, G6, G8) | Me | ⬜ TODO | Replaces the two overlapping booking lists |
| [ ] | S3 | Home side: Book again, Explore by division, compact Resume, guide for new bookers only (I11) | Me | ⬜ TODO | Low-risk widgets on S1 data |
| [ ] | S3b-1 | Approve the counts-only occupancy function (I14) | You | ⬜ TODO | A database change in `backbone/`, a second folder |
| [ ] | S3b-2 | Write the migration file | Me | ⬜ TODO | Only after S3b-1 |
| [ ] | S3b-3 | Apply the migration (local, then staging) | You | ⬜ TODO | You apply all migrations yourself |
| [ ] | S3b-4 | Switch counts to the function; build "Open this weekend" (I12) | Me | ⬜ TODO | Fixes Step 3's wrong "spaces left" (F1) and gives the widget honest counts |
| [ ] | S3b-5 | Staging check: a second booker's booking lowers "N left" | You | ⬜ TODO | Needs two real booker accounts in a live environment |
| [ ] | S4 | Shell (sidebar drawer, TopBar search + titles, 4 tabs) + Explore + Bookings page (I16, I13, I15 nav) | Me | ⬜ TODO | Search needs somewhere to live; the hamburger drawer is kept (G1) |
| [ ] | S5 | Offering page: photos, assigned staff, next slots; Book disabled for day/week/month offerings (D7, D8, D11) | Me | ⬜ TODO | The step between search and booking (D1) |
| [ ] | S6 | Wizard starts at Schedule; remove Steps 1–2, map, geolocation (I15, G10) | Me | ⬜ TODO | Booking now starts from an offering, so the old first steps are dead code |
| [ ] | S6-a | Approve uninstalling `leaflet`, `react-leaflet`, `@types/leaflet` | You | ⬜ TODO | Dependency changes are an approval gate |
| [ ] | S6-b | Staging run-through: Explore → Offering → Schedule → Pay (PayMongo test mode) | You | ⬜ TODO | A real payment round trip needs staging keys and a browser |
| [ ] | S9 | **Payments core:** money rules + Manila date presets + rename, period bar, honest totals, filters, month groups, 10-per-page (I17, I19, I21, I20 part) | Me | ⬜ TODO | Today's "Total Spent" counts unpaid and cancelled bookings (F14). Needs S0, S1 and S4 first |
| [ ] | S9b | **Payments receipt, CSV, print** (I18, I20 rest, first `@media print` block) | Me | ⬜ TODO | You approved CSV; the receipt gives a customer something to quote to support |
| [ ] | S9c | Open an exported CSV in your spreadsheet; print a receipt | You | ⬜ TODO | Encoding and print output can only be judged on real software |
| [ ] | S7 | Polish: light + dark at 360/390/1280, contrast, keyboard, touch sizes, regenerate visual baselines — **now covers Payments too** | Me | ⬜ TODO | Dark mode everywhere, as you asked; baselines change because the screens change |
| [ ] | S7-a | Review the visual baseline diffs | You | ⬜ TODO | Baselines are committed, so each diff needs a real look |
| [ ] | S8 | Docs: portals (incl. the Payments rename), booking flow, `booker/AGENTS.md`, schema if I14 landed | Me | ⬜ TODO | Docs must match what ships. Pre-work done 2026-09-21: see Docs-0 |
| [x] | Docs-0 | Pre-execution doc sync: booker `AGENTS.md`/`CLAUDE.md` rewritten; portals/booking-flow/schema corrected and given the known gaps F1–F3, F6, F14, F17; root `AGENTS.md` + overview point to the live mobile plan | Me | ✅ DONE 2026-09-21 | Verified by grep that every plan path referenced in the docs exists. You commit it |
| [ ] | Git | Commit after each stage | You | ⬜ TODO | You handle git |
| [ ] | P1 | "Near me" / real map | — | ⏸ PARKED | Vendors have no coordinates. Unblocked if proximity becomes a product goal |
| [ ] | P2 | Retry payment for an unpaid booking | — | ⏸ PARKED | Could charge twice today (F3). Unblocked by a reviewed fix to the payment route |
| [ ] | P3 | Real URLs (browser Back, shareable links) | — | ⏸ PARKED | Keeping booker's single-page shell (D12) |
| [ ] | P4 | Staff email/phone readable by any active user | — | ⏸ PARKED | A database security fix outside booker (F6); this plan reads names only |
| [ ] | P5 | Booking by day / week / month | — | ⏸ PARKED | Existing Step 3 gap (D11); needs its own plan |
| [ ] | P6 | Server-side search | — | ⏸ PARKED | Client-side is enough for today's catalogue |
| [ ] | P7 | A real receipt number | — | ⏸ PARKED 2026-09-20 | The reference shown is a PayMongo session id, not a receipt number. Unblocked by a decision to store one (schema gate) |
| [ ] | P8 | Payment method per payment | — | ⏸ PARKED 2026-09-20 | Not stored anywhere (F15). Unblocked by capturing it from the webhook (schema + route change) |
| [ ] | X1 | Spending widget on Home | — | ✖ ABORTED 2026-09-18 | Little value for a few bookings, and Payments now carries the money view (D6) |
| [ ] | X2 | Drag-to-arrange widgets | — | ✖ ABORTED 2026-09-18 | Over-engineered; widgets appear only when relevant |
| [ ] | X3 | Placeholder "Certificate" button | — | ✖ ABORTED 2026-09-18 | It does nothing, and a dead button costs trust |
| [ ] | X4 | Map + vendor step in the wizard | — | ✖ ABORTED 2026-09-18 | Only showed the booker's own location; replaced by directions links + city filter (D4) |
| [ ] | X5 | Prototype's top-bar-only navigation | — | ✖ ABORTED 2026-09-18 | Would remove Settings, legal links and Sign out on phones (G1) |
| [ ] | X6 | Waiver upload / "1 of 2 documents" in Up next | — | ✖ ABORTED 2026-09-18 | Uploads aren't saved, so there is nothing to count (F4) |
| [ ] | X7 | Prototype's new font and surfaces | — | ✖ ABORTED 2026-09-18 | You kept only the division colours (D3) |
| [ ] | X8 | "Team" list of qualified staff | — | ✖ ABORTED 2026-09-18 | Qualified ≠ who you get (D7) |
| [ ] | X9 | Hiding day/week/month offerings from search | — | ✖ ABORTED 2026-09-18 | Would hide real vendor catalogue (D11) |
| [ ] | X10 | "Method: —" row on every payment | — | ✖ ABORTED 2026-09-20 | Booker stores no payment method, so it was a permanent dash (F15). Real methods → P8 |
| [ ] | X11 | Wording a `refunded` booking as money returned | — | ✖ ABORTED 2026-09-20 | There is no refund mechanism in this system (F18); claiming one would be a false promise about money |
| [ ] | X12 | "Total Spent" as the sum of every booking | — | ✖ ABORTED 2026-09-20 | It counts unpaid and cancelled bookings and overstates what you paid (F14). Replaced by Paid / Awaiting payment |
| [ ] | X13 | Fee or payout breakdown on a receipt | — | ✖ ABORTED 2026-09-20 | Booker cannot read `booking_transactions` by design, and a customer pays one amount |

---

## Verification

| Item | Machine-verifiable | Needs a live environment |
|---|---|---|
| I1, I2, I4 | `npm test` cases (every status × pattern; service-date gate; matcher) | — |
| I3 | grep: no hex in new `className`; both themes define every `--div-*` | Contrast measured in the browser, both themes |
| I5–I9 | `tsc`; the selects compile against hand-written types | Local/staging: staff name appears; photos resolve; a hidden vendor's offerings are absent |
| I10–I13 | `tsc`, lint, Playwright baselines | Dev server at `localhost` (WSL note), light/dark, 390/1280; all four states forced (empty account, network error) |
| I14 | Migration lints; `tsc` for the service switch | **Staging:** a second booker's booking reduces "N left" for the first; anon cannot execute |
| I17–I19 | `npm test`: state per status × `is_paid`; totals exclude cancelled/unpaid; CSV quoting/BOM; Manila month boundaries | — |
| I20, I21 | `tsc` (the renamed `PageId` forces every reference), lint, Playwright baselines | Both themes at 390/1280: filters narrow the list, totals change with them, CSV opens in a spreadsheet with `₱` intact and amounts summing, receipt prints without the app chrome, pagination clamps |
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
- (j) a fourth tab overflowing a 360px phone (G4);
- (k) Paid totals quietly including unpaid or cancelled bookings (F14);
- (l) CSV exporting only the current page instead of the filtered set (D14);
- (m) the print view printing one page of rows (F19);
- (n) "refunded" worded as money returned (F18);
- (o) `getBookings()` left unpaged, so totals understate past 1000 rows (F17).
