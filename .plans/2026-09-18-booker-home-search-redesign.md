# Booker: widget Home, better booking status, Explore/search, offering page, Payments

**Date:** 2026-09-18 (Payments folded in 2026-09-20)
**App / scope:** `./booker`. One optional backbone migration (D9) sits behind its own approval gate.
**Status:** IN PROGRESS. **S0–S6 ✅ DONE 2026-09-22** (incl. S6-a, Leaflet uninstalled). **S9 ✅ DONE 2026-09-25** — Payments core; 114/114 tests, `tsc` clean, `next build` passes. **Home/Activity redesign added 2026-09-25 (D21–D30, S10–S13) — design 📌 PINNED**, code assessed against it (F31–F36) on a measured baseline of 114/114 tests and a clean `tsc`. **D25 and D26 answered 2026-09-25 — no decision is open.** One approval gate remains (D26-gate, the popularity function), and it blocks one shelf, not the plan. **S9b ✅ and S10 ✅ DONE 2026-09-27** (136/136 tests, `tsc`, build, lint 19). **S11 ✅ and S12 ✅ DONE 2026-09-27** — the redesign is built except the Popular shelf, which waits on D26-gate. **S13 ✅ DONE 2026-09-27.** **S7 ✅ DONE 2026-09-27** — every visual baseline regenerated with the clock frozen (F46); final suite **71/71, exit 0, zero hydration errors** (was 12); `tsc` clean, 146/146 tests, lint at its 19 baseline. Found and fixed F43–F46 and F48–F50 (a hydration bug, a test guarding a deleted map, a fixture feeding `NaN` to parsers, baselines rotting a digit a day, a fixture that could not report a hydration error, two unnamed controls, and a Payments header silently clipped at 360px). Deferred **with measurements**: I42 (BookAgainCard chrome), I43 (sub-44px touch targets — a design decision, not a tweak). **D22-b ✅ DONE 2026-09-27** — the division tile rebuilt as one banded card against your reference, plus F51's shared colour map. **S8 ✅ DONE 2026-09-27** — six docs rewritten from the built code (`portals.md`, `booking-flow.md`, `schema.md`, `overview.md`, `conventions.md`, `booker/AGENTS.md`), which surfaced F52 (two components this plan orphaned), F53 (the resume-draft card still names six wizard steps — user-visible) and F54 (a second dead security permission). **D26-gate ✅ APPROVED 2026-09-27** — `backbone/supabase/migrations/20260927000001_popular_offerings_rpc.sql` written (not applied; you apply it). Three corrections against the draft, incl. that `'rejected'` is not a booking status, which meant `refunded` bookings were being counted as popularity. Then a pre-apply review against the pinned artboard added `p_city` and `p_until` (two more gaps) — see the D26-gate review. **I46** adds `demo/booker-demo-seed.sql` so the new widgets can be seen on staging — written but **never run**. **I37 ✅ DONE 2026-09-27 — the Popular shelf shipped, and with it the plan's last build item.** 154/154 tests, `tsc`, build, lint 19, visual 73/73. Found F56 (a 2.08:1 contrast failure caught by measuring) and F57 (the new shelf would have had no visual baseline). **I46 ✅ and F58 ✅ DONE 2026-09-27.** Running the demo seed and opening Home against real data exposed **F58**: three of Home's five shelves — Popular, Available today, Vendors in your city — had never rendered, because the catalogue loaded only when Explore was opened. Two of them had been dead since S12 and nothing showed it, since every shelf hides when empty. Fixed and confirmed: all five now render. Remaining: the deferred I42–I45 and I47, plus the user-owned S3b-5, S6-b, S7-a, S7-b, S9c.

> Make Home a set of widgets that shows what needs the booker next. Replace the two overlapping booking lists with one list that shows each booking's progress. Add search across services and vendors that opens a page for one vendor's offering, and book from that page. Rebuild Transactions as **Payments**, with honest totals, filters, CSV and paging. Everything works in light and dark.
>
> **Amended 2026-09-25:** Home stops being a dashboard. It becomes a shopping-first discovery screen led by the division icons, and every widget it gives up moves to a new **Activity** tab (D21). The widgets themselves are not rewritten — they are re-homed.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** F# = finding, D# = decision, I# = implementation item, S# = execution stage. Numbers are plan-local. Qualify cross-plan refs, e.g. "booker-mobile-prototype D5".

**Prototype (mock data, reference only):** https://claude.ai/artifact/DZyasjx3GN8d6EQeAsw9Aj
- Home (desktop light, phone dark), Explore, the Offering page, and **Payments (desktop light + phone dark)** — the Payments screens were approved 2026-09-20.
- Per D3, **only the division colours carry over** from the prototype's look. Booker keeps its current `--db-*` surfaces, type and primary blue.
- ⚠️ **Its Home board is superseded by the 2026-09-25 redesign (D21).** Explore, Offering and Payments still stand.

**Home/Activity redesign (2026-09-25) — the chosen direction:**
- 📌 **PINNED 2026-09-25 — this is the design being built:** https://claude.ai/artifact/TZ2nDFNudFffaDDrRXCvP9 — *"Booker Home & Activity — chosen design"* (drawn as "Direction A: Aisle", then merged). Desktop Home, mobile Home, desktop + mobile Activity, the division-icon system, and the loading/empty/failed board. **Updated 2026-09-25** to carry B's banded tiles, its display typeface and its all-divisions mobile grid, so the canvas shows what D21–D24 actually describe. Iterated five times on 2026-09-25 (section chrome → D27, colour per booking → D28, the Activity stat strip → D29, the collapsing sidebar → D30) and then **pinned**. Later changes are amendments to D21–D30, not new directions. D25 and D26 are drawn on it as intent, marked with orange notes.
- **Not chosen:** https://claude.ai/artifact/U8moEwCed6Sd2EAD64sUjG — "Direction B: Storefront" (3 tabs, Payments folded into Activity, desktop sidebar replaced by a top bar). Kept for the record; its navigation was rejected, **its tile and type treatment was adopted** (D22).
- The chosen build is **A's navigation and layout with B's division tiles, display typeface and all-divisions-visible mobile grid** (resolved 2026-09-25).

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

### Verification of this briefing (web session, 2026-09-22)

Another session's report is unverified until checked (plan-authoring §4). What I ran and found:

| Claim | Verdict |
|---|---|
| The ported rules exist and are tested | ✅ **Confirmed.** 40 files in `ezzy-booker-mobile/src/lib/`; `npm --prefix ezzy-booker-mobile test` → **111 tests, 111 pass, 0 fail** |
| `slots.ts` byte-identical to booker's | ✅ **Confirmed** by `diff` — no output |
| Mobile build is complete (M1–M9) | ✅ Its plan reads COMPLETE 2026-09-22 with every stage ✅. ⚠️ **The app is uncommitted**: `ezzy-booker-mobile` still has one commit (`55a5c64`) and **272 changed files**. The copy-back depends on files that exist only in the working tree |
| **N3** Inter named but never loaded | ✅ **Confirmed.** `AppShell.tsx:62` sets `fontFamily: "'Inter',…"`; grep for `next/font`, `@font-face`, `fonts.googleapis` across `app/`, `components/`, `public/` → **no hits** |
| **N10** overnight slots mis-sorted | ✅ **Confirmed.** `schedules.service.ts:214` sorts `a.start.localeCompare(b.start)` — clock text, so a window crossing midnight lists `00:00` before `23:00` |
| **N5** dark muted text under 4.5:1 | ✅ **Confirmed, and worse than reported.** `#64748b` is **4.13:1** on the dark page and **3.93:1** on a dark card (the report only gave the page). Mobile's `#94a3b8`: 7.66 |
| **N6** Pets division pair fails | ✅ **Confirmed.** `#b45309` on `#fdf0dc` = **4.47:1**. Mobile's `#92400e` = 6.3. **The other 7 canvas pairs all pass** (4.83–9.15), so I3 fixes one pair, not all |
| **N9** light badges fail as text | ⚠️ **Confirmed with a correction.** Failing: pending **2.90**, disputed **3.08**, fulfilled **3.29**, returned **3.34**, confirmed **3.37**, refunded **4.14**. **Passing:** completed 4.50, in_progress 4.90 — the report's "2.9–3.8" range understated the spread and implied all of them fail. Light `--db-text` `#64748b` on the page is **4.33:1** (report said 4.26; the gradient varies) — under 4.5 either way |

**Consequence for this plan:** the contrast failures are in tokens **D3 kept deliberately** (`--db-*`, `.db-badge-*`) and in one approved division colour. Fixing them changes colours the user approved, so it is a decision, not a silent edit → **D17**.

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
- **Added 2026-09-25 (D21–D24):** the storefront Home, the Activity tab that receives every widget Home gives up, the data-driven division icon system with its fallback, and the five missing division colour pairs.
- Docs.

**Out:**
- `ezzy-booker-mobile`. It has its own plan, `2026-09-21-booker-mobile-app.md` (which replaced `2026-09-18-booker-mobile-prototype.md` on 2026-09-21; built in another session). That plan follows this one's designs; its **§4 "Web → native differences"** lists every difference between these designs and native mobile, and why. Mobile's S0 and S5 are already built (uncommitted), so web changes to shared rules (progress steps, auto-confirm, payment states, division colours) should be noted there.
- Persisting document uploads (existing known gap).
- Cancellation or reschedule.
- Reviews and ratings (no `reviews` table).
- Vendor lat/lng and "near me". **The redesign says "Vendors in <city>", never a distance** — there are no coordinates (P1).
- **The Command feature that edits a division's icon** (F27). This plan only makes the booker side read an icon it does not hardcode, so that feature becomes a column and a bucket later, not a rewrite.
- Ratings, promotions, vouchers, favourites or "trending" on the new Home — none of them exist in the schema, and the redesign brief forbids implying features the product lacks.
- A spending widget.
- Drag-to-arrange widgets.
- Changes to `vendor` or `command`.

**Why Payments lives in this plan, not its own:** it shares the `getBookings()` shape change (I5), the division colours (I3), the `PageId` union and the tab bar (I16). A separate plan would duplicate every coupling and split one big table in two.

**Cross-app flag — what this plan writes outside `booker/`, and nothing else:**
- `backbone/supabase/migrations/` — **twice**: D9-A's `get_slot_occupancy` (✅ written and applied 2026-09-22) and **D26-gate**'s
  `get_popular_offerings` (drafted, not written). Both are approval gates, and per standing practice **you** apply migrations.
- `architecture/*.md` in the root repo — S8 docs only (I36).
- **Nothing in `ezzy-booker-mobile/`, `vendor/` or `command/`.** Where an item has a phone-app counterpart (I34's typeface, I35's
  resized assets, the whole redesign), this plan states the hand-off and stops; the work itself belongs to
  **`.plans/2026-09-25-booker-mobile-redesign.md`** (DRAFT, created 2026-09-25) and runs in its own session. That plan
  depends on this one: its R2 waits on **S10** for the colours and the resized assets, and its Popular shelf waits on
  **D26-gate**.

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

## Parity contract with ezzy-booker-mobile (2026-09-22)

The two clients must end up with the same look and the same feature set, differing only where a phone genuinely differs. Neither plan owns that alone, so the contract is written into both.

**Who decides what**
- **This plan owns look and behaviour.** Mobile follows it (its §2, §3, D2).
- **Mobile's `§4 Web → native differences` is the allowed-divergence list.** Nothing outside that table may differ. It covers: the drawer becoming an Account screen, bottom tabs, where the theme switch lives, the search entry, one-column layout, detail as a pushed screen, sheet pickers instead of `<select>`, presets-only date range, "Load more" instead of page buttons, CSV via the share sheet, printing via `expo-print`, receipt as a sheet, the sticky booking bar, native maps links, and no hover or keyboard hints.
- **Anything else that differs is a bug in one of the plans.** Five were found on 2026-09-22 and are closed below.

**Look: settled and identical on both**
| Token group | Value | Where |
|---|---|---|
| Surfaces, text, borders | booker `--db-*`, light and dark | web `globals.css`; mobile `theme/tokens.ts`, ported verbatim |
| Status badges | the darkened light set + web's dark set (D17) | web I22 ✅; mobile M8 |
| Muted text | `#5b6576` light, `#94a3b8` dark (D17) | both ✅ |
| Division colours | 13 slugs + `none`, light and dark; Pets `#92400e` | web I3 ✅ — **now the source of truth**; mobile re-copies from `globals.css`, replacing its provisional values |
| Font | the system stack; Inter's name dropped (N3, mobile D9) | web I16; mobile M1 ✅ |
| Primary button, accent | `linear-gradient(135deg,#2563eb,#1d4ed8)`, `#2563eb` / `#60a5fa` | both ✅ |

**Functional gaps found 2026-09-22, and how each closes**
| # | Gap | Resolution |
|---|---|---|
| 1 | **Vendor page.** Mobile opens a vendor's services from a vendor search result; this plan never said what a vendor card does | **D19-A:** web gets the same page → **I25** |
| 2 | **Agreements at booking.** Mobile collects acceptance and a typed signature; nothing records it, and web collects nothing | **D20-A:** parked on **both** until `booking_acknowledgements` has a booker write path → **P9**; mobile hides the step it built (its G6) |
| 3 | **Offering page details.** Mobile shows category + granularity chips, opening hours and "All N services"; I13 never named them | **I26** adds all three to web |
| 4 | **Notifications.** Mobile opens the booking a notification refers to; web's panel has no such action | **I27** |
| 5 | **Unstated numbers that drifted.** Division shortcuts (the prototype drew 8; there are 13) and the Payments default period | **I28**: 13 shortcuts, and "Last 3 months" as the default |

**Both clients are equally missing** — parked, not divergences: payment retry (P2 / mobile G1), honest slot counts until I14 lands (mobile G2), upload persistence (F4 / mobile G3), delete account (D18-N4 / mobile G4), agreement recording (P9 / mobile G6), receipt numbers (P7), payment method (P8), "near me" (P1), date-granular booking (P5).

**Keeping it true:** every stage of this plan ends by checking its screens against mobile's matching P# section. A new difference is either added to mobile's §4 table with a reason, or fixed. Mobile's sync protocol does the same in reverse.

**Amendment 2026-09-25 — the Home/Activity redesign (D21–D24).** This is the largest parity change since the contract was written, and it lands on screens the phone app has **already built** (its P2 Home, P3 Bookings).

| What | Web | Mobile | Same or different |
|---|---|---|---|
| Tabs | Home · Explore · **Activity** · Payments | the same four, same order | **Same.** Mobile's `app/(tabs)/bookings.tsx` becomes `activity.tsx`; its P3 list becomes the Bookings segment |
| Home content | hero + search, all divisions, Book again, vendors in your city, one in-progress strip | the same sections, same order | **Same** |
| Division grid | auto-fill grid, tile = tint + white-on-deep name band | 4 across, wrapping, same tile | **Same tile, different column count** — a phone fits four. Add to mobile §4 |
| Icon source | `divisionIcon()` → bundled `/division-icons/<slug>.png` → monogram | the same function, Expo asset paths | **Same logic, different asset resolution.** Mobile cannot use `/public`; `require()`d assets are the native equivalent. Add to mobile §4 |
| Activity | segmented Updates \| Bookings, right rail on desktop | the same segments, **no rail** — the rail's cards stack under Updates | **Different by screen size**, already covered by §4's one-column rule |
| Display typeface | `next/font`, headings only | an Expo font asset gated on `useFonts` | **Same family.** ⚠️ This **reverses mobile's D9**, which uninstalled `@expo-google-fonts/inter` deliberately — mobile must record the re-add rather than have it appear |
| "Available today" | per **D25**, still open | whatever D25 decides | **Must not diverge.** Mobile waits for D25 too |

Mobile's plan gets the same amendment in its §4b. Nothing above may be implemented on one client only.


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

- **F24: A stray `anon` EXECUTE on the new function** (found 2026-09-22, immediately after applying I14). ✅ **FIXED by condensing (2026-09-22)** — see the resolution note below.
  - `20260922000001` ended `revoke all … from public`, copying `get_booker_contacts`'s style. This project's `pg_default_acl` grants EXECUTE on new functions **directly to `anon`**, and revoking from PUBLIC does not touch a direct grant — so `anon` kept EXECUTE. The plan's approved draft said `from public, anon`; dropping `anon` was my transcription error. `command_payout_bucket_totals` (`20260910000001:72`) does it correctly.
  - **Nothing was exposed:** an `anon` call raises `42501` at the `is_active()` gate, confirmed by calling it as `anon`. This closes it at the privilege layer instead of relying on that single check.
  - **Same gap exists on `get_booker_contacts(uuid)`** — a vendor-portal function outside this plan. Its own `has_vendor_role` check likewise refuses anon. Recorded here for a backbone security pass rather than changed from a booker stage.
  - **Resolution, 2026-09-22 (user's call): condensed rather than corrected forward.** Neither migration had reached staging or prod, so the one-line fix was folded into `20260922000001` and `20260922000002` was deleted. Hosted therefore receives **one** correct migration with no trace of the slip, and the `anon` default-grant trap is documented in that file's header for every future function.
  - **Editing an applied migration is normally forbidden** — the rule protects against applied history drifting from the files. Here it was applied **locally only**, and a `supabase db reset` restores exactly that match; hosted history, which the rule exists for, never saw either version. Had staging been pushed, the two-migration path would have been the only safe one.
- **F23: `onBookingConfirmed` was never called** (found 2026-09-22 during S2). `useBookingWizard(onBookingConfirmed)` takes the callback and never invokes it, so the shell's optimistic insert never ran and a new booking appeared only after a reload. ✅ Fixed in S2: the shell refetches instead (plan G10). The unused parameter stays until S6 rewrites the wizard's entry, where it is removed with the rest of the old flow.
- **F22: Contrast failures in tokens D3 kept, measured 2026-09-22** (see the briefing's verification table).
  - Light `.db-badge-*` text: 6 of 8 below 4.5:1 (worst `pending` `#d97706` at 2.90 on its own tint).
  - `--db-text` `#64748b`: 4.33:1 light on the page, 4.13:1 dark on the page, **3.93:1 dark on a card**.
  - Canvas Pets division pair `#b45309` on `#fdf0dc`: 4.47:1. The other seven pairs pass.
  - These are pre-existing for the badges and muted text; only the division pair is new work. → D17, and the S7 contrast pass.

### Findings from the Home/Activity redesign (F25–F29, verified 2026-09-25 by reading `division_logos/`, the DB and `globals.css`)

- **F25: The logo folder is one short.** `division_logos/` at the repo root holds **12 PNGs for the 13 seeded divisions** — `ezzy-ride` has no logo. A fallback is not a defensive nicety, it is needed on the first render. The folder is in no app; the assets have never been copied into `booker/public/` or the Expo app. → I29, D23.
- **F26: The logos are not a normalised set.** All 12 are RGBA with transparent corners, but: sizes run **256×256 → 2000×2000** and **27 KB → 1.4 MB** (`ezzy_drive` 1.4 MB, `ezzy_learn` and `ezzy_stay` ~800 KB each, `ezzy_work` 821 KB); `ezzy_drive.png` **stores dark RGB underneath fully-transparent pixels** — ⚠️ see the correction below; and the art styles do not match (flat navy `care`/`court`, pure-black line art `food`/`learn`/`home`, neon `drive`, pastel `pets`/`park`, tan `law`). Shipping them as-is puts ~4 MB of images on Home. → I35.
  - ⚠️ **CORRECTION (2026-09-26, S10).** This finding originally said `ezzy_drive.png` had "a dark glow baked in" that would
    "read as a grey smudge on a light chip". **Measured per-pixel, that is wrong.** The file is 87% fully transparent, and 99%
    of those transparent pixels carry dark RGB stored *under* the zero alpha; only 5.6% of pixels have partial alpha, and that
    is the mark's own soft edge. **Any correct compositor — a browser, React Native — ignores RGB at alpha 0 entirely, so it
    renders clean.** The grey square I saw was an image *viewer* dropping the alpha channel, not the asset. The original claim
    came from looking at a rendering instead of measuring the bytes.
    - **Therefore S10-b is moot** and is closed: there is no glow to remove or accept. The re-encode in I35 also zeroed those
      transparent pixels as a side effect, so the shipped file no longer carries them at all.
  - Consequence for the design, not just the pipeline: **the tile tint must stay light in dark mode.** Three of the twelve are near-black line art and would disappear on a dark card, and recolouring a vendor-facing logo is not this plan's call. → D22.
- **F27: There is nowhere to store an admin-set icon.** `divisions` has exactly `id, name, slug, sort_order, is_active, created_at, updated_at` — **no icon column** — and `storage.buckets` holds only `vendor-kyc`, `offering-attachments`, `offering-photos`, `booking-signatures` — **no icon bucket**. The future Command feature therefore needs a column plus a public bucket, which is a schema gate and out of scope here. What is in scope is that booker must resolve icons through one function, so that feature is a source swap. → D23, I29.
- **F28: Five divisions share one grey.** `booker/app/globals.css` gives `law`, `park`, `learn`, `work` and `stay` the neutral pair (`#f1f5f9` / `#475569` light) rather than their own. Today that is eight coloured chips among thirteen; in a thirteen-tile grid it is five identical tiles, which defeats the icon grid. → D24, I33.
- **F29: "Available today" on Home hits the same wall as parked P10.** The existing `OpenSlotsCard` (I12) is affordable only because it is bounded to **the booker's own past `(vendor_id, offering_id)` pairs, capped at 4**. A Home shelf of "slots open today" across the whole catalogue is one `getSchedulesForOffering` per offering — exactly the cost that parked P10 (Explore's "When" filter). A new booker has no past pairs at all, so the bounded version renders nothing on the screen that is supposed to sell the product. → **OPEN decision D25.**
- **F30: nothing in this system can say what is popular** (verified 2026-09-25). There is no `reviews`, `ratings`, `featured` or ranking column anywhere in `public` — the only near-match is `vendors.operating_hours`, which matched the grep on "…ope**rat**ing…" and is not a rating. Booking counts exist, but **RLS shows a booker only their own bookings**, so a client-side count of "how often was this booked" is structurally impossible, not merely unwritten. → **OPEN decision D26.**

### Code assessment for the pinned design (F31–F36, read 2026-09-25 in `booker/`)

Baseline measured the same day: **114/114 `npm test` pass, `npx tsc --noEmit` clean.**

- **F31: the collapsing sidebar is three small edits, and one of them is a trap.** The hamburger already exists and is
  **already visible at every width** — `components/layout/TopBar/TopBar.tsx:54-59` has no `lg:hidden`. What stops it working on
  desktop is `components/layout/Sidebar/Sidebar.tsx:34`, where **both** branches of `open` end in `lg:sticky lg:translate-x-0`,
  so at `lg` the sidebar is pinned open whatever the state says. Three changes: that line honours `open` at `lg`;
  `AppShell.tsx:272` changes `onMenuOpen={() => setSideOpen(true)}` to a **toggle**; the scrim at `AppShell.tsx:257` keeps its
  `lg:hidden` (a desktop collapse needs no scrim).
  - ⚠️ **The trap:** `useAppShell.ts:25` defaults `sideOpen` to **`false`**. That is harmless today because `lg` ignores it —
    but the moment `lg` honours it, **every desktop session starts with the sidebar collapsed**. The default must flip to
    `true`, or become width-aware. Changing only the CSS is a silently wrong implementation that still satisfies "make the
    sidebar hide-able". → I38.
- **F32: renaming the `PageId`s is not a safe find-and-replace.** `lib/types.ts:12` has `"dashboard" | "explore" | "bookings" |
  "payments" | …`, but the string `"bookings"` **also names the Supabase table** — `services/bookings.service.ts:27,149,169` and
  `app/api/payment/webhook/route.ts:101,143,179` all call `.from("bookings")`. 16 occurrences of `"bookings"` and 9 of
  `"dashboard"` exist across `lib/`, `components/`, `app/` and `services/`. A blanket rename breaks data access in a payment
  webhook. → I32 renames **through the union and its call sites only**, never by global replace.
- **F33: the widgets to re-home already exist and must not be rewritten.** `components/dashboard/` holds twelve folders
  (`NeedsYouCard`, `UpNextCard`, `BookingList`, `BookingProgress`, `BookingDetailModal`, `InProgressCard`, `BookAgainCard`,
  `OpenSlotsCard`, `DivisionShortcuts`, `DivisionBadge`, `GuidePanel`, `DashboardPage`) and `components/bookings/BookingsPage`
  is the unlimited list. Re-homing is a **folder move plus import changes**; every hook and test travels unchanged (D21).
- **F34: nothing of the new structure exists yet.** No `components/home/`, no `components/activity/`, no
  `components/ui/DivisionIcon/`, no `public/division-icons/`. All four are new (I29, I30, I31).
- **F35: the shell is a lazy-import switch, so a new page is two edits.** `app/page.tsx:5-12` lazy-loads each page component and
  `AppShell.tsx:184-190` switches on `page === …`. Adding Activity and renaming Home touches both, and `app/ui-gallery/page.tsx`
  (the visual-test fixture) references the page ids too.
- **F36: every committed visual baseline will change.** `visual-tests/` holds committed PNGs and the suite already fails from
  S6's removed panes. Home, Activity, the shell chrome and the division tiles all change, so **S7 regenerates the whole set** —
  that is expected, not a regression, and it is why S7 runs after S12.

### F37 — proximity filtering is not available, and the map never did it (verified 2026-09-25)

Asked during the D25 answer: *can we filter offerings by proximity, say a 2 km radius — we use the map to find offerings,
don't we?* Checked rather than recalled. **No on both counts, and four separate things are missing:**

1. **There are no coordinates.** `vendors` has `address`, `address_line1`, `barangay`, `city`, `province`, `zip_code` and their
   PSGC codes — and **no latitude or longitude**. A `information_schema.columns` sweep for `lat|lng|long|geo|coord|point|geom`
   across the whole `public` schema returns nothing (the three hits are `platform_fee_percent`, `platform_fee_amount` and
   `device_push_tokens.platform` — the substring "lat" inside "platform").
2. **There is no geo engine.** Installed extensions are `pg_cron, pg_net, pg_stat_statements, pgcrypto, plpgsql,
   supabase_vault, uuid-ossp`. **No PostGIS, no `earthdistance`, no `cube`** — so there is nothing to compute a radius with
   even if coordinates existed.
3. **The map is gone, and it never found offerings.** Leaflet was uninstalled in **S6-a on 2026-09-22 on your own go-ahead**;
   `grep leaflet package.json` now returns 0 and `components/booking/MapWidget/` no longer exists. What it did before removal
   was show **the booker's own location** on wizard Step 2 — it never searched, filtered or ranked anything by distance (X4).
4. **The booker's own position is no longer collected.** `grep -rn "geolocation"` across `components/`, `lib/`, `services/` and
   `app/` returns **0 hits** — the geolocation call went with the map in S6.

**What location filtering actually exists:** city, via `lib/search.ts`'s `cityOptions` and the `city` filter in
`useExplorePage.ts:39,56`. City is the finest granularity this system has.

**Can coordinates be derived from the addresses already on file? Yes — checked 2026-09-25, and this is the cheap part.**
Every vendor row carries **PSGC codes down to barangay**, not just free text: all 3 vendors have `address_line1`, `barangay`,
`barangay_code`, `city_code`, `province_code` and `zip_code` populated (e.g. `043422005` = Bulilan Sur (Pob.), Pila, Laguna),
sourced from `vendor/components/address/AddressFields` via `vendor/services/profile.service.ts`. So three options exist, in
increasing cost:
1. **PSGC barangay centroid — no third party at all.** One static `psgc_centroids(code, lat, lng)` table loaded once from a
   published PSA/OSM dataset, joined on `barangay_code`. Free, offline, no address ever leaves the system, no licensing terms,
   and it covers **100% of vendors today** because the code is already there. ⚠️ Accuracy is a barangay centroid: fine for
   "which part of the city", and **every vendor in one barangay sits at the same point**, so it cannot rank two shops on the
   same street. A 2 km radius is credible in an urban barangay and misleading in a large rural one.
2. **One-off forward geocoding** of `address_line1 + barangay + city + province + zip` → street-level where the line is
   specific. ⚠️ Two non-technical costs: it **sends vendor business addresses to a third party**, and the providers differ on
   whether you may *store* the result (Google's terms restrict retention; Mapbox/HERE permit it on paid tiers; OSM/Nominatim's
   public endpoint forbids bulk use — self-host or pay). Philippine street matching is uneven: "Km 2 National Highway, Apokon"
   will resolve to a road, not a door.
3. **A pin the vendor drags** in the Vendor portal, stored as `geocode_precision = 'pinned'`. The only route to real accuracy,
   and a small addition to a form that already has an address picker.
**Recommended shape if this is ever picked up:** seed from (1), refine selectively with (2), let (3) override — with a
`geocode_precision` column so the app knows how much to trust a distance before printing one.
⚠️ **Do not depend on the device's location at registration** — vendors register away from the shop, which is exactly why a
draggable pin beats "use my current location".
⚠️ **Data-quality note for any code join:** `province_code` is not uniformly numeric — the Quezon City row stores `NCR` where
the others store 9-digit codes. `barangay_code` is consistent, so join on that, not on province.
Note the radius query itself does **not** need PostGIS at this size: haversine in SQL over a few thousand vendors is enough.

**What a radius filter would take** — a phase, not a flag: a lat/lng pair on `vendors` (schema gate); a geocoding pass to
populate it for existing vendors, plus a way for new vendors to set it in the Vendor portal (**a second app**); the booker's
position, which means re-adding a geolocation permission prompt that S6 deliberately removed; and a distance query — PostGIS,
or `cube`+`earthdistance`, or a bounding box plus haversine in SQL. → **P11**, and it supersedes the older P1.

### F38 — there is no "paid on" date, so the CSV does not claim one (found 2026-09-26 during S9b)

I18 specified a `paid_date` column. **`bookings` has no such field**: a column sweep returns `price_paid`, `is_paid` and
`payment_reference` and nothing else payment-related. `created_at` is when the booking was **made**, not when money arrived.

Printing `created_at` under a `paid_date` header would be a false statement about money — the same class of error as X10's
permanent "Method: —" and X12's overstated "Total Spent". **The column is therefore named `booked_on`**, and the export carries
`booked_on, service_date, …` instead of `paid_date, service_date, …`. Everything else in I18 is as specified.

Unblocked by: storing a paid-at timestamp (schema gate). Related to P7 (no real receipt number) and P8 (no payment method) —
all three are the same gap, which is that this system records *that* a booking was paid and not *when* or *how*.

### F39 — two colour collisions caught by measuring, not by eye (found 2026-09-27 during S10)

Choosing I33's five pairs surfaced two problems that only a computed check finds:

1. **My first `work` value was the same colour as `pets`.** `#9a3412` sits **15 units** from
   `pets` `#92400e` in RGB — indistinguishable side by side, which is the exact failure D24
   set out to fix. Shipped value is `#c2410c` on a lighter `#fff1e3` tint: 4.67:1, and 48
   units from pets.
2. **My first `learn` value was the same green as `court`**, and in dark mode my first `park`
   was **10 units** from `food`. Learn shipped as forest `#14532d` (vs court's emerald), park
   dark as pink `#f9a8d4` (vs food's red `#fca5a5`, now 47 apart).

Both are now guarded: `palette.test.ts` asserts **no two division foregrounds are within 20
RGB units**. The threshold is deliberately low — with 13 divisions several hues sit close by
necessity, and the tile also carries the logo and the name, so colour is a support cue rather
than the identifier. The test catches an accidental duplicate, not a tight palette.

⚠️ **Pre-existing, not changed:** `court` `#047857` and `care` `#0f766e` are 25.6 apart — also
close. They were approved under D17 and are live, so changing them is a decision, not a fix.
Flagged here; the new guard's threshold of 20 lets them pass deliberately.

### F40 — the wizard draft had to move to the shell (found 2026-09-27 during S11)

The resume-draft card moved from Home to Activity (D21), but the draft itself was read and
cleared inside `useDashboardPage` — the hook of the page it was leaving. Two pages reading
`WIZARD_DRAFT_KEY` would have been two sources of truth for one draft, and the second one to
mount would win.

**Fixed by moving ownership up:** `useAppShell` now holds `draft` / `discardDraft`, reads the
key in an effect (never in a `useState` initialiser — this shell is server-rendered first,
the hazard `useDashboardPage` already documented), and hands both to Activity.
`useDashboardPage` is reduced to one decision, `showGuide`, until S12 deletes it.

Not anticipated by I31, which said only "moves, does not rewrite" — true of the components,
but the state they depended on lived somewhere that was being dismantled.

### F41 — the city lived in Explore, but D25 needs it on Home too (found 2026-09-27, S12)

D25 says "Available today" is narrowed to **the booker's selected city**. That value was
`useState` inside `useExplorePage.ts:39` — private to Explore. Home had no way to read it,
and a second copy would have let the two screens disagree about where the booker is looking.

**Lifted to `useAppShell`**, which now owns `city` and passes it to both: Explore keeps the
picker and reports changes up; Home reads the same value. Touches `useExplorePage`,
`ExplorePage` and `AppShell`, none of which I30 anticipated.

Without this, Home's shelf would have been "the first 12 offerings in catalogue order" —
still capped, still cheap, but not the thing D25 describes.

### F42 — I wrote a cascading render; the lint rule caught it (2026-09-27, S12)

The first `useHomePage` cleared its results with a synchronous `setState` inside the effect
whenever the city changed, and used a ref to discard slow responses. Lint flagged the first
(`Calling setState synchronously within an effect`), and the ref was a symptom of the same
shape.

**Rewritten to keyed state**: results are stored with the candidate key they belong to, and
both the list and the loading flag are **derived** from whether that key is current. No
setState in the effect, no ref, and a stale response is ignored by construction rather than
by a counter. Lint returned to its 19-problem baseline.

### F43 — a pre-existing hydration mismatch in the theme toggle (found 2026-09-27, S7)

`components/layout/TopBar/TopBar.tsx` picked its icon from `resolvedTheme` on the first
render. The server has no theme, so the markup it sent and the markup the client produced
disagreed — a React hydration warning that predates this plan and had nothing to do with the
redesign.

**Fixed**: a `mounted` guard, the pattern next-themes documents. The icon renders only after
mount; before that the button is still there and still labelled, so nothing shifts.
✅ DONE (2026-09-27) — the guard is in place; the mount flag now comes from the shared
`hooks/useMounted.ts` added in F48.

Getting here took one wrong turn worth recording. After the guard, a clean run **still** logged
12 hydration errors, so the fix looked incomplete. Reading the actual React diffs, rather than
the error count, showed none of them came from `TopBar`, and all 12 were the harness:

- **10 text mismatches** — `+ 12w ago` against `- 36w ago` in `NotificationItem`
  (`fmtRelativeTime`), and the same shape wherever a countdown is printed. The **server** uses
  the real clock while the **spec freezes the browser's** (F46), so the two disagree by
  construction. Nothing to do with the product: in production both clocks are real.
- **2 attribute mismatches** — `style={{caret-color:"transparent"}}` present in the server HTML
  and absent on the client, on the login inputs. `caret-color` appears nowhere in this repo:
  it is Playwright's own `caret: "hide"` editing the DOM before hydration — literally the
  "browser extension messes with the HTML" case React's message names.

So the theme icon was the only real one, and it is fixed. ⚠️ The lesson is the method: an error
*count* said "not fixed", the error *contents* said "fixed, plus two artifacts". Read the diff.

### F48 — a fixture that always logs hydration errors cannot report one (found 2026-09-27, S7)

F43 hid in `/ui-gallery` for weeks behind harness noise (see above). The noise is unavoidable
while the fixture is server-rendered — freezing the browser clock is exactly what makes the
server's HTML wrong — so the fixture is now **client-only**: `app/ui-gallery/page.tsx` gates
`<Body />` on a mount flag, leaving no server HTML to reconcile.

⚠️ **This broke the harness's timing assumption, which is the part worth remembering.** Both the
spec and the audit script waited on `networkidle` — and on a client-only page the network can go
idle while the page is still **empty**, which yields blank captures and boxes measured mid-layout
(it is why I43's first numbers looked self-contradictory). The fixture now exposes
`data-gallery-ready` once mounted, and everything that captures or measures it waits for that
attribute and then for `document.fonts.ready`, never for the network. A change that removes SSR
has to bring the harness with it.

⚠️ This is a **fixture-only** change. It is not a licence to skip SSR anywhere in the product —
the hook's own doc comment says so, because "add `useMounted` until the warning stops" is the
obvious wrong reading of this finding.

**Also extracted `hooks/useMounted.ts`.** Both call sites (F43's `TopBar`, this fixture) wrote
`useState(false)` + a `setMounted(true)` effect, and each tripped
`react-hooks/set-state-in-effect` — lint had quietly gone 19 → 20 → 21. The rule is right in
general and cannot be satisfied here (the render that learns "have we mounted" is by definition
the second one), so the disable now lives **once**, in a hook whose only job is this, instead of
at every call site.
**The change cost one test, and the test was right to fail.** `csp.spec.ts` asserts the division
icons were *actually fetched* — its guard against passing trivially — and on a client-only page
`networkidle` was reached before any icon had been requested, so it reported "no
/division-icons/ requests — img-src is untested". It now waits for the ready flag **and** for
every `<img>` to report `complete`, because relying on the network made it pass on a warm server
and fail on a cold compile; a flaky security test is worse than none.

✅ DONE (2026-09-27) — `tsc` clean, 146/146 unit tests, lint at its **19-problem baseline**
(measured against `git show HEAD:app/ui-gallery/page.tsx` to separate my problems from
pre-existing ones), and the full Playwright suite **71/71, exit 0, with zero hydration errors in
the log** — down from 12. The baselines did **not** need re-recording: `document.fonts.ready`
shifted no glyph. The handshake is independently proven by the audit script, which now returns a
full inventory on every pane where it previously returned empty ones.

### F50 — Payments' header was clipped, not scrolled, at 360px (found 2026-09-27, S7)

The audit gained a horizontal-overflow check — the machine half of "does it work at 360?", and
the half a screenshot review misses, because a capture is taken at the full scroll width and so
looks fine.

`components/payments/PaymentsPage/PaymentsPage.module.css:4` — `.header` was a non-wrapping flex
row holding the heading and a `flex-shrink: 0` actions row (Export CSV, Print). At 360px it ran
16px past the viewport. ⚠️ And because `AppShell`'s `<main>` is `overflow-hidden`, the result was
not a sideways scroll but **silent clipping**: the Print button was simply not there.

**Fixed** with `flex-wrap: wrap` on `.header`, so the actions drop to a second line. No effect
above ~380px, which is why no baseline moved.
✅ DONE (2026-09-27) — re-measured: the overflow is gone at 360 in both themes; full suite
71/71, so nothing shifted at capture width.

⚠️ **One overflow remains and is NOT a product bug:** the `divisions` gallery pane scrolls 27px
at 360 because the *fixture* hardcodes `gridTemplateColumns: repeat(5, 1fr)` with 60px icons
(`app/ui-gallery/page.tsx`) — 348px of content in a 296px box. The product's own grid is
`repeat(auto-fill, minmax(…))` and cannot overflow. Left alone deliberately: making the fixture
grid responsive would re-record the `divisions` baselines to fix a number nobody reads.

### F44 — the CSP test was still guarding a deleted map (found 2026-09-27, S7)

`visual-tests/csp.spec.ts` asserted that tile requests went only to the Leaflet basemap host.
S6 deleted the map, so the test was passing by testing nothing.

**Repointed** at what this screen actually loads now: the division PNGs under
`/division-icons/` and the self-hosted font. ⚠️ Recorded trap: `next/image` rewrites those to
`/_next/image?url=%2Fdivision-icons%2F…`, so the assertion decodes each URL
(`decodeURIComponent(r.url())`) before matching — matching the raw URL silently finds nothing,
which is how a green test can mean "no requests were made".
✅ DONE (2026-09-27) — the test now fails if the icons stop loading; confirmed by running it.

**Left for the user (approval gate):** `next.config.ts` still allows `TILE_HOST`
(`https://*.basemaps.cartocdn.com`) in `img-src`. Nothing requests it any more, so it is a
dead allowance in a security header. Removing it is a security-related change, so it is
**not** done here — see the new S7-b.

### F45 — the gallery fixture fed display strings to parsers (found 2026-09-27, S7)

The `/ui-gallery` mock bookings carried already-formatted values (`"April 12, 2026"`,
`"9:00 AM"`) where the real rows carry raw ones (`"2026-04-12"`, `"09:00"`). Every widget that
*parses* instead of printing therefore rendered "IN NAN DAYS" and "9:NaN AM" — in the fixture
only; production data was always raw.

**Fixed**: seven dates and seven times converted to the raw formats the services return. The
fixture now exercises the same code path production does, which is the only reason it is worth
capturing.
✅ DONE (2026-09-27) — verified by reading the regenerated captures: no `NaN` anywhere.

### F46 — the visual baselines were rotting daily, and had been for weeks (found 2026-09-27, S7)

`UpNextCard` derives a countdown from `Date.now()`. Every baseline containing it therefore
encodes *the day it was recorded*: the committed capture read **"3077d left"** while today's
run of the same pane read **"3021d left"** — a 56-day drift, and proof the suite had been
failing for reasons unrelated to any code change.

⚠️ This is the more important half of the finding: a suite that fails every day teaches people
to re-record without looking, which is exactly how a real regression gets committed as a
baseline.

**Fixed**: the spec freezes the clock before navigating —
`await page.clock.setFixedTime(new Date("2026-04-10T02:00:00+08:00"))` — a Manila morning, so
the frozen instant also exercises the +08:00 date arithmetic rather than sidestepping it. Any
future countdown, relative date or "today" badge is now stable by construction.
✅ DONE (2026-09-27) — re-recorded all 67 captures with the clock frozen (exit 0), then re-ran
the suite unchanged against them.

### F47 — `BookAgainCard` does not render through `HomeSection` (found 2026-09-27, S7)

Every shelf on Home is wrapped in `HomeSection`, which owns the pipe, the band and the D27
artwork — except "Book again", which draws its own chrome from before that component existed
(`components/home/BookAgainCard/`). On screen the section reads as a different kind of object
than its neighbours.

**Not fixed here.** It is a visual inconsistency, not a defect, and touching it means moving
markup that S11 verified. Logged as **I42** below rather than changed in a polish stage.
⬜ TODO — see I42.

### F49 — two icon-only controls had no accessible name (found 2026-09-27, S7)

The measured pass (see I43) reports each control's accessible name alongside its box, which is
how these surfaced: two buttons came back with an **empty** name.

- `components/layout/TopBar/TopBar.tsx` — the notification bell. Worse than a missing label:
  the unread count was conveyed **only** by a coloured dot, so a screen-reader user had no way
  to know there was anything unread. Now
  `aria-label` carrying the count when there is one,
  with `aria-expanded`, and the icon and dot marked `aria-hidden`.
- `components/layout/Sidebar/Sidebar.tsx:63` — the phone drawer's close button, an `<X>` and
  nothing else. Now `aria-label="Close the menu"`, icon `aria-hidden`.

⚠️ Neither changes a pixel, so **the baselines just recorded stay valid** — that is why these
two were worth fixing inside a polish stage while I43 was not.
✅ DONE (2026-09-27) — `tsc` clean, 146/146 tests, lint at 19. Re-measured: no unnamed control
remains on the audited panes.

### F51 — one division→colour map, instead of one per consumer (2026-09-27, D22-b)

Rebuilding the tile needed the division's tint and deep shade on a **second** component. Each
consumer had been repeating its own thirteen-line `[data-division="…"]` block; a third copy was
about to appear.

`app/globals.css` now maps the attribute to two inherited custom properties once —
`--division-tile` and `--division-deep` — and any element carrying `data-division` just uses
them. `DivisionIcon.module.css` lost its own thirteen rules to the shared map.

⚠️ Why this is worth more than the lines it saves: **F39 was two colour collisions that survived
review and were found only by measuring.** Thirteen near-identical rules per consumer is exactly
the shape that lets one value drift. Keyed on the attribute alone and placed in the base layer,
so a component can still override either value with an ordinary class.
✅ DONE (2026-09-27) — verified by consequence: the full visual suite moved **only** `home-light`
and `home-dark`. Every other consumer of a division colour (the `divisions` pane, the shelf
cards, the badges) rendered byte-identical, which is the proof the refactor changed no colour.

### D22-b — the division tile is one banded card (amendment to D22, 2026-09-27)

**Asked for**, against a reference image: the rounded square carries the division's tint, and
the name sits in a band of a darker shade of the same hue along the bottom.

What shipped before this was an icon *on a card* — a small tinted square on `--db-card-bg`, with
the name as plain text underneath. The amendment makes the **tile itself** the coloured object:

- `.tile` — `background: var(--division-tile)`, `overflow: hidden`, no border. ⚠️ The
  `overflow: hidden` is load-bearing: the band is a square-cornered block, and the card's radius
  is the only thing rounding its bottom two corners.
- `.tileName` — `background: var(--division-deep)`, white, full width. Every division clears
  7.3:1 against white, which is why `-deep` exists as its own token (D22).
- `DivisionIcon` gained a **`plain`** variant that drops its own tint and radius, so the icon
  does not stamp a second, slightly different rounded square onto a card that is already tinted.
  `ezzy-ride` still renders the "ER" monogram in the deep shade, because there the monogram is
  the mark (F26).
- Grid minimum 128px, giving 7 across at desktop width and matching the reference's wrap; the
  phone override stays at four across so all thirteen remain visible.

**Then measured against the pinned artboard itself, not the eye** (`project/Main.dc.html` and
`project/MobileHomeLight.dc.html` on the canvas), because the first pass looked right and was
not. Every number below is now the artboard's:

| | Desktop | Phone |
|---|---|---|
| Tile radius | 15px | 14px |
| Tint band height | 78px | 58px |
| **Mark** | **46px** | **36px** |
| Monogram | 19px | 15px |
| Name band | 8px 4px, 11.5px | 6px 3px, 10px |
| Grid gap | 12px | 9px |

⚠️ The first pass drew the mark at **~34px** — `size={52}` through `DivisionIcon`'s 66% rule —
against the artboard's 46px. It read as "a bit small" and nothing else; only opening the artboard
gave the number. **Read the artboard for figures; the eye is for whether they are right.**

⚠️ That fix forced a component change. `DivisionIcon` sized itself from a `size` **prop**, and the
design needs two sizes at one breakpoint — which a number in TypeScript cannot express. Under
`plain` the component now sets no inline size at all and fills the box it is given, so
`.tileIcon` (46px, 36px in the media query) owns it. `size` is ignored in that mode, and the
prop's doc comment says so.

⚠️ **Divergence left in place:** the mobile artboard labels the tiles with a SHORT name
(`{{d.short}}` — "Court", not "EzzyCourt"). `lib/divisions.ts` has no such field. The full names
fit at 390px without truncating, so this ships as-is rather than growing the data model inside a
styling change; it belongs to the mobile plan if it is wanted.

✅ DONE (2026-09-27) — compared against the artboard at 1280 light, 1280 dark and 390 light.
Suite 71/71 after re-recording `home-light` and `home-dark` (the only two that moved, twice over
— which is also the proof that F51's shared colour map changed no other consumer); `tsc` clean,
146/146 unit tests, lint at 19.

### F52 — two components this plan built are orphaned (found 2026-09-27, S8)

Writing the docs meant listing what is on each screen, which is how these surfaced: nothing
imports them.

- `components/home/DivisionShortcuts/` — built in S10, then S12's `HomePage` rendered its own
  division grid instead of consuming it.
- `components/home/OpenSlotsCard/` — same stage, same fate.

Both were added by **this plan's own commit** (`69c76f8`), so this is not inherited dead code:
S10 built two components on spec and S11/S12 then took a different route without removing them.
⚠️ They still carry weight — they compile, they are linted, and the next person reading
`components/home/` reasonably assumes the Home screen uses them.

**Not deleted here.** S8 is a docs stage, and deleting components does not belong in a
docs-only diff. → **I44**.

### F53 — the resume-draft card still advertises six wizard steps (found 2026-09-27, S8)

`components/activity/InProgressCard/InProgressCard.tsx` renders `PROG_STEPS` from
`lib/constants.ts` — the **old six** — and prints `Step {step} of {PROG_STEPS.length}` with
`PROG_STEPS[activeIndex].label`. The wizard has been four steps since S6
(`WIZARD_STEPS = ["Schedule","Documents","Review","Pay"]`), and the draft's `step` is a
1-based index into *that*.

⚠️ So a booker who saves a draft on the Documents step is told **"Step 2 of 6 — Pick a Vendor"**,
naming a step that no longer exists, and the progress dots draw six nodes for a four-step flow.
This is user-visible and wrong, not cosmetic drift.

`PROG_STEPS` has exactly two consumers left: this card and the `/ui-gallery` fixture. The fix is
to point both at `WIZARD_STEPS` and delete `PROG_STEPS`, which is small — but it changes a
rendered component and would move a baseline, so it does not belong in a docs stage either.
→ **I45**.

### F54 — a second dead permission in the security headers (found 2026-09-27, S8)

Alongside F44's `TILE_HOST`, `booker/next.config.ts:153` still sends
`geolocation=(self)` in `Permissions-Policy`, and the comment above it still cites
`hooks/useGeolocation.ts:15` — a file deleted with the map in S6. Nothing in booker asks for
location any more.

⚠️ Same shape as F44 and worth stating as one rule: **removing a feature does not remove the
permission it needed.** Two security headers were widened for the map and stayed widened after
it was deleted, and neither leaves any trace at runtime — a permission granted to nobody is
invisible until someone audits the header.

Not changed here: both are security-related, so they are an approval gate. Folded into **S7-b**
alongside F44 so they are decided together.
⬜ TODO — with the user.

### F58 — three of Home's five shelves had never rendered (found 2026-09-27, running I46)

Running `booker-demo-seed.sql` on local and then signing in as a real booker — the first time
the redesigned Home was opened against real data — showed **Popular, Available today and
Vendors in your city all missing**, with no error on screen.

They are the three shelves that join the **catalogue**, and `loadCatalogue()` was called from
exactly one place: `goExplore()`. So the catalogue loaded the first time someone opened Explore
and never otherwise.

⚠️ **This was correct until S12 and became wrong silently.** Deferring the catalogue to Explore
was right when Home was a dashboard. Home is now the landing screen *and* a storefront built on
that data — and because every shelf is designed to hide when empty (I30), a Home with no
catalogue looks deliberate rather than broken. **Two of the three have been dead since S12
shipped**; only writing the third made anyone look.

**Fixed** in `components/layout/AppShell/useAppShell.ts`: an effect loads the catalogue when the
page is `home`, still lazily (someone who goes straight to Payments never pays for it) and still
guarded against double-fetching.

⚠️ **The first fix was wrong, and its failure mode was the same invisibility.** Gating on `page`
alone fires at mount, *before* `getUser()` resolves, so the request went out as `anon` and
PostgREST answered **401 `permission denied for table offerings`** — the table has no `anon`
grant, by design. On screen: identical to before, three shelves quietly absent. Now gated on
`loggedIn` as well.

✅ DONE (2026-09-27) — verified by signing in against local Supabase and listing the rendered
sections: **"Browse by division | Popular this month | Available today | Book again | Vendors"**.
Before the fix the same check returned two. 154/154 tests, `tsc`, build, visual 73/73.

### F59 — the demo seed failed on its first run, exactly as intended (found 2026-09-27, I46)

`booker-demo-seed.sql` had never been executed. Its first run aborted on
`check_booking_placement()`: *"This schedule does not start until 2026-08-29"* — the demo
schedule started `v_today - 30` while the history it creates reaches `v_today - 84`, so every
booking older than a month was placed before its own schedule existed.

The whole script is one transaction, so the failure cost nothing and left no partial data. Fixed
by starting the schedules at `v_today - 120`, with the reason written at that line so the number
is not "tidied" later.

✅ DONE (2026-09-27) — re-run clean: 3 schedules, 14 bookings across 6 statuses, 12 paid.
`get_popular_offerings` over the current month returns those rows, and Home renders them.

---

## DECISIONS

<!-- No stage may execute while any OPEN: line below remains. **D1–D30 all resolved as of 2026-09-25.** No OPEN decision remains. The one thing still gated is D26-gate, an approval on a drafted read-only migration, and it blocks the Popular shelf alone. -->

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

- **D19: What a vendor search result opens → A, a vendor page on web** (resolved 2026-09-22). Mobile already has one, and a vendor-name search otherwise has nowhere to land. → I25.
- **D20: Agreement acceptance at booking → A, parked on both clients** (resolved 2026-09-22). `booking_acknowledgements` is written only by Vendor Kiosk Mode, so a booker's tick and signature would leave no record of consent. Neither client asks until the write path exists → P9; mobile hides the step it already built (its G6).

### Payments decisions (approved with the Payments screens, 2026-09-20)

- **D13: Page name → "Payments"** (resolved 2026-09-20). "Transactions" is accounting language; a customer wants what they paid and what is owed. The `PageId` is renamed to `payments` to match the folder, with `tsc` catching every reference. Grep the string `transactions` before renaming, in case a notification or deep link names it.
- **D14: CSV export → yes** (resolved 2026-09-20). Client-side only, no dependency, exports the **filtered set** (not the current page). Amounts are plain numbers so a spreadsheet can sum them; the `₱` lives in the header, not the cells.
- **D15: Pagination → 10 per page, client-side, over one paged fetch** (resolved 2026-09-20).
  - The shell loads the booker's bookings once and Home's widgets (Needs you, Up next, Book again) need **all** of them, so server-side per-page queries would mean a second, divergent data path.
  - `getBookings()` therefore becomes a `fetchAllPages` call with an exact count (I5, fixing F17); Payments pages that array 10 at a time.
  - Page resets to 1 on any filter change, and a page past the end is clamped — vendor learned both (`vendor/components/transactions/TransactionsPage/useTransactionsPage.ts:159-174`).
- **D16: Receipt + print → keep** (approved with the design 2026-09-20). Needs booker's first `@media print` block, copied from `vendor/app/globals.css:218` (F19).

### Open after the mobile briefing (2026-09-22)

- **D17: Accessibility fixes that change approved colours (F22) → A, adopt the phone app's tested values** (resolved 2026-09-22). App-wide, including screens this plan does not otherwise touch; guarded by a new test (I22) so it cannot silently regress.
  - **A (chosen):** adopt mobile's already-tested values — light badge text one shade darker (Tailwind -700, amber/orange -800), `--db-text` `#5b6576` light and `#94a3b8` dark, Pets `#92400e`. All are guarded by `statusPalette.test.ts` / `divisions.test.ts` in the phone app, so the numbers are known rather than eyeballed. It changes colours across every booker screen, including ones this plan does not touch.
  - **B:** fix only the surfaces this plan rewrites, and leave the rest failing. Cheaper, but leaves two palettes in one app.
  - **C:** keep every approved colour and accept the failures. Not recommended: six badge styles and the muted text are below the minimum the `ux-design` skill sets, and the same text is what carries booking status.
- **D18: N1–N10 → all resolved 2026-09-22.** Per item:
  - **N1 Call vendor on the booking detail → yes** (I10). `vendors.phone` is already in I5's select.
  - **N2 Photos + description on the booking detail → yes** (I10, using I8).
  - **N3 Inter → drop the name, use the system font** (I16): remove the `fontFamily` inline style at `AppShell.tsx:62`, which is also a static inline style the conventions forbid. Nobody loses a font, because none was ever loaded.
  - **N4 Delete account → out of scope here.** Needs a service-role route in booker plus UI; blocks the phone app's store submission only. Tracked as the mobile real-data plan's W5.
  - **N5, N6, N9 → covered by D17.**
  - **N7 Pending wording → the phone app's line**, "Waiting for the vendor to accept your booking." The approved line ("You have not been charged for a booking they decline") is **false**: the booker pays at checkout, before the vendor accepts, and no refund mechanism exists (F18, `portals.md:654`). Copy ports from mobile's `statusExplain.ts` (I10).
  - **N8a Price unit → always name the block** ("₱ 1,200 / 60 min"), both clients (I24).
  - **N8b Division-name search → keep** (resolved 2026-09-22 on the approved board's own behaviour: "court" returning an EzzyCourt vendor's paddle rental is a feature). Say the word to narrow it to names and categories only.
  - **N10 Overnight slot sort → fix in S1** (I23). A real bug, independent of this redesign.

### Home/Activity redesign (D21–D25, design review 2026-09-25)

Two directions were drawn as full canvases (links in the header) and compared. The
navigation of **A** was chosen with the tiles and type of **B**.

- **D21: Home becomes discovery; a new Activity tab takes the dashboard** (resolved 2026-09-25).
  - **Tabs stay four:** Home · Explore · **Activity** · Payments. The **Bookings tab folds into Activity** as a segment, so nothing grows to five and the 360px overflow risk (G4) does not return.
  - **The sidebar and the hamburger drawer are untouched** — G1 stays closed, and X5 stays aborted.
  - **Payments keeps its own tab.** Direction B folded it into Activity; that was rejected, because the S9 page is built and a receipt would have gone from two taps to three.
  - Home keeps **one** piece of personal state: a slim strip for a booking that is today or in progress. Everything else — Needs you, Up next, the draft card, the booking list, the month summary — moves to Activity **unchanged in behaviour**. This is a re-home, not a rewrite: `NeedsYouCard`, `UpNextCard`, `InProgressCard`, `BookingList` and `BookingDetailModal` keep their hooks and their tests.
- **D22: Tiles and type → adopt Direction B's treatment** (resolved 2026-09-25).
  - **Tile:** a light division tint holding the art, with the division name on a **deep shade of the same hue in white** beneath it. The tint stays light in both themes (F26).
  - **Mobile shows every division in a grid**, not a horizontally scrolling rail — 4 across, wrapping, so the count can change without a layout change.
  - **A display typeface for headings.** ⚠️ This **supersedes D3's "keep the current font" and N3's "use the system font"**, and it reverses the phone app's **D9** (which uninstalled `@expo-google-fonts/inter` on purpose).
    - **Scope it to headings only:** one display family for `h1`/`h2`/prices; body, labels and controls stay on the system font. One font file, not two.
    - **Cost, stated rather than discovered later:** a webfont on web (`next/font` to avoid a layout shift) and a font asset plus `useFonts` gating in Expo, which is exactly the load the phone app removed. If that cost is not wanted, say so and the tiles ship without the typeface — the tiles carry most of the effect.
- **D23: Division icons resolve through one function, keyed on slug** (resolved 2026-09-25).
  - Order: **`divisions.icon_path` (future, Command-set) → bundled asset `/division-icons/<slug>.png` → monogram on the tint.** Only the middle one exists today.
  - **Keyed on `divisions.slug`, never `name`** — a Command admin can rename a division, and `lib/divisions.ts` already warns about exactly this.
  - The monogram branch is live from day one because of F25 (`ezzy-ride`), which also makes it the tested path for any division Command adds later.
- **D24: Give the five grey divisions their own colours** (resolved 2026-09-25). Sampled from each logo, dark-on-light for the label and white-on-deep for the tile band, both checked at 4.5:1 and guarded by the existing palette test (I22). Values in I33.
- **D25: "Available today" → offerings with an opening left today, top 3** (resolved 2026-09-25).
  - The shelf shows **up to three offerings that still have an opening later today**, ordered by the soonest opening. It reuses
    `getSchedulesForOffering` + `getSlotsForDate` + the `get_slot_occupancy` RPC that S3b already shipped, so the counts are the
    honest ones (F1).
  - **Bounded, per F29:** the query runs over a **capped candidate set** — the offerings in the booker's selected city, newest
    first, hard-capped — never the whole catalogue. The cap is the thing that keeps this off P10's cost curve, so it is stated
    in the item and asserted in a test, not left to judgement. → I41.
  - ⚠️ **"based on proximity" cannot ship, and not for want of effort — see F37.** The ordering is **soonest opening**, and the
    candidate set is filtered by **city**, which is the finest location this system stores. Proximity is its own project (P11).
  - A new booker sees this shelf — it does not depend on their history, which is what B was rejected for.

- **D26: "Popular this month" → the most-booked offerings, from a counts-only function** (resolved 2026-09-25, option A).
  - Popularity is **booking count over a window**, nothing cleverer. No weighting, no recency curve, no editorial flag — the
    label says "most booked" and the number next to it is that count (I37).
  - Needs the counts-only `SECURITY DEFINER` function in D26-gate below. **Approval gate — the migration is drafted, not written.**
  - ⚠️ Stated so a later reader does not mistake it for a strategy: this is an **interim definition** chosen because no ranking
    strategy exists yet. When one does, it replaces the function's body, not the UI.

- **D27: section chrome** (resolved 2026-09-25, amended twice the same day).
  - **Keep:** the 4px straight marker ("pipe") left of every section title, in that section's own colour. It is what makes the
    groups scannable.
  - **Drop the shadows.** Five shadowed slabs down one page was too much of one gesture. Sections separate with a hairline
    under the header and a recessed body instead.
  - **Radius is a hierarchy, not a constant** (amended 2026-09-25 after the second look): section surfaces **10px**, the search
    hero **18px with its shadow, untouched**. The hero has to stay visibly the odd one out — it is the thing above the shelves,
    not another shelf. If a future surface needs a radius, it picks one of these two, and does not invent a third.
  - On phones the sections stay **inset 16px** with a full border: a radius needs an edge to sit on, so edge-to-edge and
    rounded corners are mutually exclusive. (Edge-to-edge was tried on 2026-09-25 and reverted.)
  - **Sidebar motif** (revised 2026-09-25): the three stepped bars stay; the panel below them now carries the **same arcs +
    strokes composition as a section header**, anchored to the **bottom-left** instead of the bottom-right, so the page reads as
    one motif seen from two corners rather than a stamp repeated. On all four web boards, Home and Activity.
  - Implementation note for I30/I31: this is `.module.css` work, not inline style. One shared `.section` / `.sectionHead` /
    `.sectionBody` rule set, used by every shelf, so "squared" is one edit and not five.
  - **Section header** (added 2026-09-25, revised twice the same day): a **flat wash of the section's own colour** — 6% on
    light, 10% on dark, the same value as the pipe beside the title — plus **straight lines and gentle curves together**,
    confined to the last 200px of the header (110px on phone): three concentric **arcs** sweeping out of the bottom-right
    corner (20% / 26%), crossed by four sparse 2px **diagonal strokes** (11% / 14%).
    - **Curves are allowed here, and only here plus the sidebar** (decided 2026-09-25, reversing the earlier
      "straight lines only"). Tiles, cards, chips and the tile bands stay geometric.
    - Two treatments were tried and rejected first: a dense full-width 1px hatch (too many lines), then strokes alone (flat).
    - **One colour per section, four alphas:** pipe 100%, wash 6/10%, arcs 20/26%, strokes 11/14%. A section never introduces a
      second hue, and every value is derived from the pipe colour rather than typed separately.
    - **Header only, never behind the body**, so no text or card sits on a pattern.
    - In CSS this is `background-color` + one `background-image` with `background-size` / `-position` / `-repeat` on
      `.sectionHead`, parameterised by the section's colour — not five hand-written rules.
- **D30: the sidebar collapses on desktop too** (resolved 2026-09-25).
  - The hamburger in the top bar **toggles** the sidebar at every width. Collapsed, the sidebar is not rendered and the content
    takes the full width — **no icon-only rail**, which would be a third navigation state to design, test and keep in sync for
    no stated need.
  - **Below `lg` nothing changes**: the same button opens the drawer over the page with its scrim, and that drawer stays the
    only route to Settings, About & Legal and Sign out on a phone (G1, X5).
  - ⚠️ **This is a smaller change than it looks, and it has one trap** — see F31.

- **D29: the Activity stat strip is banded top and bottom** (resolved 2026-09-25, narrowed the same day).
  - **Only the four summary cards at the top of Activity** carry a **3px rule across their top and bottom edge** — Needs you,
    Upcoming, In progress, Paid in September (three on the phone: Upcoming, Needs you, Paid in Sep). Each takes its **status
    colour**: amber, blue, green, violet.
  - **Everything below the strip keeps plain card chrome.** Banding every widget was drawn first and pulled back: the rule is a
    summary-strip device, and the strip stops reading as a strip once the cards beneath it wear the same band.
  - The other widgets still carry colour — through their content, not their frame: the division tint on the icon and the status
    pill (D28). Up next does **not** get an EzzyCourt band.
  - This is the Activity look; Home's shelves keep the pipe-and-header treatment (D27), so the two tabs stay distinct.
  - ⚠️ **Sourcing note.** The user referred to this as "the original design, or like vendor". I checked and **neither has it**:
    no booker widget `.module.css` carries a coloured top or bottom border, the original prototype canvas's Home used only
    `1px solid #eef1f6` hairlines, and vendor's dashboard has no accent rule either (its one accent is a `borderLeft` on
    GuideModal rows, `GuideModal.tsx:104`). So this is **new**, not a restoration — recorded that way so nobody later
    "restores" it from a source that never had it.
  - Implementation for I31: one `.statCard` rule with the colour as a CSS custom property set per card, not four hand-written
    border pairs — and the rule must not be reachable by the widgets below the strip.

- **D28: a booking's colour is its division's colour** (resolved 2026-09-25).
  - Every booking row, offering card and tile draws from the **same `--div-<slug>-bg` / `-fg` / `-deep` triple**. There is no
    per-booking palette and no fourteenth colour: thirteen divisions, thirteen colours, plus the neutral fallback.
  - Applied as a **wash behind the row** at ~7% alpha, plus the icon tint. Well under any contrast threshold — the row reads by
    its text, and the colour is a hint, not information carried by colour alone (the `ux-design` rule).
  - **Status stays a separate channel.** Confirmed / Needs you / Pending keep the `--st-*` palette on the pill, so "which
    service" and "how is it going" never compete for the same colour. Two systems, two jobs — a booking row shows both at once.
  - ⚠️ **What this looks like on real data today:** the seeded catalogue has vendors in **EzzyCourt and EzzyWell only**, so a
    live Home would be close to monochrome. The canvas deliberately shows four divisions to make the rule visible. This is a
    catalogue-breadth fact, not a design failure, and it is the reason the rule must key on the division rather than on
    anything per-booking.

---

## Implementation items

Every component item states its render/hook/style split, per `.claude/skills/component-separation/SKILL.md`:
- `.tsx` is render only.
- `useX.ts` owns state, effects and handlers.
- `X.module.css` holds the styling.
- Colours come only from `--db-*` or the new `--div-*` CSS variables. No hex in `className`, and no static `style={{}}`.

### Foundations (pure, testable)

#### I1: `lib/bookingProgress.ts` + test  ✅ DONE (2026-09-22)
<!-- Ported from ezzy-booker-mobile; 7 test cases covering every status × pattern, the terminal tracks and the unknown-status fallback. Verified: `npm test` 70/70, `tsc --noEmit` clean. -->
Maps `(status, fulfilmentPattern)` to ordered steps (`label`, `state: done|current|todo`) plus a tone.
- Session: Requested → Confirmed → Done → Completed.
- Custody: Requested → Confirmed → Picked up → Returned → Completed.
- **Exhaustive over all nine `BookingStatus` values** (`lib/types.ts:7-10`), with a `never` check.
  - `cancelled` and `refunded` render as a terminal "Cancelled" / "Refunded" track.
  - `disputed` renders "On hold — Ezzy is reviewing" at its last reached step.
  - This is a weak spot: a map that only covers the happy path would silently drop these.
- Test: `node --test` (the existing `npm test` glob `lib/**/*.test.ts`), one case per status × pattern.

#### I2: `lib/autoConfirm.ts` + test (F2)  ✅ DONE (2026-09-22) — module only
<!-- Module + 11 cases (no timer for in_progress, null status_changed_at, the 3-day window, the Manila service-date gate) ported and passing. ⚠️ The two flat `AUTO_ACK_DAYS = 3` copies in useBookingStatusWidget.ts:19 and useBookingDetailModal.ts:8 are NOT yet replaced: that is a behaviour change in components S2 rewrites, and S0 was scoped to leave the UI alone. S2 must delete both. -->
- Copy `vendor/lib/autoConfirm.ts` + test, adapted to booker's `Booking` type. This needs `bookedDate`, which the type already has.
- Replace both `AUTO_ACK_DAYS` copies (`useBookingStatusWidget.ts:19`, `useBookingDetailModal.ts:8`).
- Only `fulfilled` gets a countdown. `in_progress` never does. `returned` is the vendor's move, so the booker sees no timer.

#### I3: Division colours  ✅ DONE (2026-09-22)
<!-- `--div-<slug>-fg/-bg` for 13 slugs + `--div-none-*` in both themes (globals.css), and `lib/divisions.ts` (slug normaliser + the 13-entry list) with 4 tests. Deviation: no `lib/divisionStyle.ts` returning `var()` strings — G7 settled on a `data-division` attribute plus module CSS, so TypeScript never names a colour. Contrast for all 14 pairs per theme is asserted by `lib/palette.test.ts`. -->
- `app/globals.css`:
  - `--div-<slug>-fg` / `--div-<slug>-bg` for all **13** seeded slugs (corrected 2026-09-21 from 8), plus `--div-none-*`, in both `:root` and `.dark`.
  - Dark values are lighter foregrounds on translucent backgrounds, like the existing dark `--db-*` style.
  - Check 4.5:1 text contrast against `--db-card-bg` in both themes.
- `lib/divisionStyle.ts`: `slug | null → { fg: "var(--div-…-fg)", bg: … }` with a neutral fallback for null or unknown slugs. This is the only place slugs are named.
- **Keyed on `slug`, not `name`**, because names are display text.
- The division badge replaces the unused `OFFERING_CODE_STYLE` for the code tile. Remove the map and its fallback once nothing reads them (`lib/constants.ts:49-51`).

#### I4: `lib/search.ts` + test  ✅ DONE (2026-09-22)
<!-- Ported with structural `SearchOffering`/`SearchVendor` types declared in the module, so it is testable before S1's catalogue exists; any row carrying those fields satisfies it. 6 cases: tokenising, every-token matching across service+vendor+city+division, vendors only for a typed query and only when they have something to book, filters, the When filter over known openings only, cities/popular/recent/result line. The opening-label and price-suffix cases from mobile's suite belong to S1's I24 and were left out. -->
- A pure matcher: lower-cased, whitespace tokens, every token must appear in `name + category + vendor name + city + division name`.
- Results are grouped into Services and Vendors, then sorted.
- No fuzzy library (no new dependency).
- Test: multi-token, case, and empty-query cases.

### Data layer (`services/`, hand-written types per root AGENTS.md)

#### I5: `getBookings()` shape  ✅ DONE (2026-09-22)
<!-- Paged via fetchAllPages with an exact count (F17); returns {data,error,complete}; added offering/vendor ids, address, city, phone, division, staff name (names only, F6), requirements, end time/date, quantity and payment_reference. Callers updated. Verified: tsc, build, 95 tests. -->
**File:** `services/bookings.service.ts:77-110`
- Add `offering_id`, `vendor_id`, `end_time`, `end_date`, `quantity`.
- Add `offerings(requirements)` and `vendors(name, address, city, phone, divisions(slug, name))`.
- Add `schedules(staff(first_name, last_name))`. **Names only** (F6, D8).
- Extend `Booking` in `lib/types.ts`. The staff name is nullable (F5).

#### I6: `getBookingStatusLog(bookingId)`  ✅ DONE (2026-09-22)
<!-- ⚠️ CORRECTION: the columns are `from_status`/`to_status`, not `new_status` as first written — caught by reading 20260516000006 before shipping. Loaded when the detail opens, and again when the status changes. -->
- Reads `booking_status_log` (F12) for the detail timeline's timestamps.
- It is loaded when the detail opens, not with the list.

#### I7: Catalogue for Explore  ✅ DONE (2026-09-22)
<!-- `getCatalogue()` added beside `getActiveOfferings()` rather than replacing it: Step 1 still calls the old one until S6 deletes that step, and a stage should leave the tree green. Returns per-vendor offerings + deduped vendors, paged, with divisions joined. -->
**File:** `services/offerings.service.ts:47-81`
- Replace the service-first `getActiveOfferings()` with `getCatalogue()`: per-vendor active offerings with `vendor_id, fulfilment_pattern` and `vendors!inner(id, name, city, province, tagline, divisions(slug, name))`.
- Keep the paging, `.order("code").order("id")` and `complete` flag exactly as they are now. The comments at `:35-46` and `:59-63` explain why.
- Active-vendor filtering is done by RLS (`20260515000001`). `!inner` drops offerings whose vendor is hidden.
- `getVendorsForOffering()` (`vendors.service.ts`) becomes unused after S6. Remove it then.
- **Loaded once per session** when Explore first opens, then cached in `useAppShell`. Not refetched on every keystroke.

#### I8: Offering photos  ✅ DONE (2026-09-22)
<!-- `services/offeringPhotos.service.ts`: getCoverPhotos (chunked .in()) and getPhotos. A failed chunk falls back to the division placeholder, never a broken <img>. -->
- New `services/offeringPhotos.service.ts`:
  - `getCoverPhotos(offeringIds)` returns the first active `photo` by `sort_order`.
  - `getPhotos(offeringId)` returns all of them.
  - Public URL via `storage.from("offering-photos").getPublicUrl()` (F10).
- Chunk `.in()` lists so a large catalogue does not build an oversized URL.
- A missing photo means a division-coloured placeholder, never a broken `<img>`.

#### I9: Schedules with staff  ✅ DONE (2026-09-22)
<!-- staff(first_name,last_name) added to both selects; `getSchedulesForOffering(vendorId, offeringId)` keyed on id, not code. -->
**File:** `services/schedules.service.ts:40-58`
- Add `staff_id, staff(first_name, last_name)` to the select.
- Add a nullable `staffName` to `BookerSchedule`.
- Add `getSchedulesForOffering(vendorId, offeringId)`, keyed on **offering id**, not code. `schema.md` → `offerings.code` warns the code is vendor-editable and must never be joined on.

### Home

#### I10: Dashboard layout + Needs you + Up next + My bookings  ✅ DONE (2026-09-22)
<!-- NeedsYouCard, UpNextCard, BookingList + BookingProgress, DivisionBadge, rewritten DashboardPage, rewritten BookingDetailModal (timeline, staff, photos, Call vendor, Certificate removed). BookingStatusWidget/ and BookingCard/ trashed. Rules ported from the phone app as lib/{homeRules,statusExplain,bookingTimeline,directions}.ts with their suites. All four states per widget, error distinct from empty. -->
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

#### I11: Book again + Explore by division + compact Resume  ✅ DONE (2026-09-22)
<!-- BookAgainCard (grouped by offering id), DivisionShortcuts (all 13, I28), InProgressCard gained Discard, GuidePanel lost its Hide button and shows only at zero bookings (D6). Book again and the division chips route to the booking flow until S4/S5 exist — stated in the code, not silently inert. -->
- **`BookAgainCard`** (new: `.tsx` / `useBookAgainCard.ts` / `.module.css`).
  - Derived from completed bookings, grouped by `offering_id` (not code), newest 3.
  - Opens the Offering page (I13).
- **`DivisionShortcuts`** (new, pure display + `.module.css`). Receives `onPick(slug)` and opens Explore pre-filtered.
- **`InProgressCard`** (modify: add `useInProgressCard.ts` for Discard, and a `.module.css`).
  - Compact version with a progress bar.
  - Draft keys change in I15, so a draft in the old format is discarded, not crashed on.

#### I12: Open this weekend  ✅ DONE (2026-09-22)
<!-- OpenSlotsCard + hook + module.css, and lib/weekend.ts (+5 tests) for the Manila weekend. Counts print only when getSlotOccupancy reports them `known`; otherwise the slot shows a time and no number. Fan-out capped at 4 past vendor/offering pairs. -->
- **`OpenSlotsCard`** (new: `.tsx` / `useOpenSlotsCard.ts` / `.module.css`).
  - Takes the booker's distinct past `(vendor_id, offering_id)` pairs, capped at 4.
  - Calls `getSchedulesForOffering` for each, then derives slots for the next Sat/Sun with the existing `getSlotsForDate` and the occupancy from I14 (or no counts, under D9-B).
  - Shows at most 4 slots.
  - **The cap exists to bound the fan-out.** Four pairs × one schedules query plus one occupancy call.
  - Hidden when there are no past vendors or no open slots.

### Explore, Offering, Bookings

#### I13: Explore page + Offering page + Bookings page  ✅ DONE (2026-09-22)
<!-- S4: ExplorePage (+ hook + module.css), OfferingResultCard, VendorResultCard,
     BookingsPage. S5: OfferingPage (+ hook + module.css). -->
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

#### I14: Occupancy RPC (D9-A). Approval gate, `backbone/`  ✅ DONE (2026-09-22)
**Approved 2026-09-21. Written and applied 2026-09-22** (`20260922000001_slot_occupancy_rpc.sql`, applied by the user).

**Verified against the local database, as a real booker** (read-only, in a rolled-back transaction):
- Acting as booker `…003` on a date whose booking belongs to booker `…016`: RLS shows that booker **0** rows, and `get_slot_occupancy` returns **1**. That is the fix — the count is now true while the booking itself stays unreadable.
- As `anon`: raises `get_slot_occupancy: not permitted` (the `is_active()` gate).
- A 12-month window: raises the range error rather than returning rows.

**`anon` EXECUTE (F24):** folded into this same file on 2026-09-22 (`revoke … from public, anon`), so there is one migration, not two. Its header documents why `from public` alone is not enough in this project.

**One deviation from the draft below, deliberate:** the caller and range checks `raise`
instead of sitting in the `WHERE` clause. In `WHERE`, a refused caller or an oversized
request returns **zero rows**, and zero rows is what this feature reads as "every slot is
free" — the exact bug being fixed, now silent. `command_payout_bucket_totals()`
(`20260910000001`) raises for the same reason. An empty `p_schedule_ids` still returns no
rows, because asking about no schedules is a normal case, not an error.

Draft as approved (the shipped file carries the raises plus the comments):

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

#### I15: Nav + wizard entry + removals  ✅ DONE (2026-09-22)
<!-- Nav in S4; the wizard and removals in S6. Four steps (Schedule → Documents → Review →
     Pay) starting from the Offering page's choice; Step1Offering, Step2Vendor, MapWidget,
     useGeolocation, vendors.service.ts, getActiveOfferings, getSchedulesForVendor, the
     Leaflet CSS and the BookerVendor/LatLng/LocStatus types all removed; draft shape now
     carries vendorId + offeringId; login-page map claim replaced. -->
- **Nav:**
  - `lib/types.ts:3` `PageId` becomes `"dashboard" | "explore" | "bookings" | "offering" | "booking" | "payments" | "settings"` (`transactions` → `payments`, D13).
  - `lib/constants.ts:38-42` `MAIN_TABS` becomes Home (id `dashboard`, label "Home"), Explore, Bookings, **Payments** (id `payments`, per D13/I21 — if S4 runs before S9, S4 does the rename).
  - `useAppShell` holds the selected `{vendorId, offeringId}`, the Explore query and filters (D12), and the cached catalogue (I7).
  - `app/page.tsx` adds lazy `ExplorePage` / `OfferingPage` / `BookingsPage` renders the way it already does for the others (`app/page.tsx:5-8`).
  - Sidebar, TopBar and TabBar changes are specified in **I16**, which also drops the unloaded-Inter `fontFamily` inline style at `AppShell.tsx:62` (**N3**).
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

#### I17: `lib/payments.ts` + test — the pure money rules  ✅ DONE (2026-09-25)
<!-- Ported from ezzy-booker-mobile with its suite. paymentState exhaustive over all nine
     statuses; paid-only totals; month grouping in Manila; reference search; the refunded
     copy rule with a test that fails if the wording promises money back (F18). fmtPeso is
     re-exported from lib/utils.ts, where S1 put it. -->
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

#### I18: `lib/paymentsCsv.ts` + test  ✅ DONE (2026-09-26)
<!-- `lib/paymentsCsv.ts` + `paymentsCsv.test.ts` (11 cases). Verified: 125/125 tests pass,
     `tsc` clean, `next build` passes, lint unchanged at 19. ⚠️ Column renamed paid_date →
     booked_on — see F38. The download (Blob + anchor + revokeObjectURL) is in
     usePaymentsPage, not in lib/ and not in the .tsx, as specified. -->
Copy the shape of `command/lib/affiliateCsv.ts` (F20): pure, RFC 4180 quoting (`"` doubled, quote when the cell holds `,` `"` or a newline), CRLF, UTF-8 BOM.
- Columns: `paid_date, service_date, offering_code, offering_name, vendor, amount_php, payment_state, booking_status, reference`.
- `amount_php` is a plain number — a `₱` in the cell makes it text in every spreadsheet.
- The download (Blob + anchor + `revokeObjectURL`) lives in `usePaymentsPage`, not in this module and not in the `.tsx`.
- Filename carries the period, e.g. `ezzy-payments-2026-06-20_2026-09-20.csv`.
- Tests: a vendor name with a comma and a quote, an empty set (headers only), and the BOM's presence.

#### I19: Manila date presets + test  ✅ DONE (2026-09-25)
<!-- Landed as `lib/paymentsFilter.ts` (ported with `lib/manila.ts` from S2) rather than a
     separate phDates.ts: the presets, their labels and the range arithmetic are only used
     by Payments, and splitting them across two modules would have added a file without a
     second caller. "Last 3 months" is the same day three months back, clamped to month end. -->
Copy `phMonthRange`, `phLastNDays`, `phYearRange` from `vendor/lib/utils.ts:223-303` (F19), Asia/Manila, with their tests. Presets: This month · Last 3 months · This year · All time, plus a custom from/to.
- **Manila, not the browser's zone.** A booker in another timezone must see the same month boundaries the database uses, or a payment near midnight lands in the wrong period.

#### I20: Payments components  ✅ DONE (2026-09-26)
<!-- ✅ 2026-09-25 (S9): PaymentsPage + usePaymentsPage, PaymentPeriodBar,
     PaymentSummaryCards, PaymentFilters, PaymentMonthGroup, all four states, 10-per-page.
     ✅ 2026-09-26 (S9b): PaymentReceipt (shadcn dialog; amount, dates, status, shortened
     reference, the state's plain-English note, "View booking"), PaymentsPrintView (the FULL
     filtered set, black on white, thead repeated per page, truncation banner printed), and
     the Export CSV / Print buttons. Rows now open the receipt rather than the booking
     detail; the receipt hands off to it. Verified: 125/125, `tsc`, `next build`, lint 19. -->
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

#### I21: Rename to Payments  ✅ DONE (2026-09-22 S4, completed 2026-09-25 S9)
<!-- S4 renamed the PageId, tab and titles; S9 replaced the page itself and deleted
     components/transactions/. The `@media print` block is S9b's. -->
- `lib/types.ts` `PageId`: `transactions` → `payments`; `lib/constants.ts` `MAIN_TABS` label and icon; `TopBar` `TITLES`; `app/page.tsx` lazy import; `AppShell` render prop.
- Grep `"transactions"` across `booker/` first (notifications, deep links, tests) so the rename does not orphan a string.
- `globals.css`: the `@media print` block (D16) — ✅ **added 2026-09-26 in S9b**: chrome hidden, scroll/height constraints released, `[data-no-print]` for the on-screen list and pager, card shadows dropped.

### Added by the mobile briefing (2026-09-22)

#### I22: Contrast palette + a test that guards it (D17, F22)  ✅ DONE (2026-09-22)
<!-- Light badge foregrounds darkened, `--db-text` → #5b6576 light / #94a3b8 dark, Pets → #92400e. `lib/palette.test.ts` reads globals.css itself (not a copy) and asserts ≥4.5:1 for: 9 badges × tint-and-bare × 2 panel surfaces, `--db-text`/`--db-strong` on every page stop and panel, and 14 division pairs — per theme. -->
**Files:** `app/globals.css` (light `.db-badge-*` at `:199-211`, `--db-text` in both `:root` and `.dark`), new `lib/palette.test.ts`
- Port the phone app's tested values: light badge text one shade darker (Tailwind -700; amber and orange -800), `--db-text` `#5b6576` light and `#94a3b8` dark, Pets `#92400e` (I3).
- Values come from `ezzy-booker-mobile/src/theme/statusPalette.ts` and `theme/divisionPalette.ts`, both already test-covered there.
- **The test is the point.** `lib/palette.test.ts` parses `globals.css`, composites each badge tint over its surface and asserts **every** text/surface pair ≥ 4.5:1 in both themes — the check mobile's `contrast.ts` performs. Without it the numbers drift again the next time a colour is picked by eye.
- Token values only: the badges already read `.db-badge-*` and `text-db-text`, so no component edits.
- Dark badge text (`:212` onward) measured fine and is left alone.

#### I23: Overnight slot ordering (N10)  ✅ DONE (2026-09-22)
<!-- `compareSlotStarts()` in lib/slots.ts sorts by each slot's offset from its own window; 4 new test cases including the 22:00–02:00 case that used to list 00:00 first. -->
**File:** `services/schedules.service.ts:214`
`getSlotsForDate()` ends with `.sort((a, b) => a.start.localeCompare(b.start))`, which orders slot **labels**, so a 22:00–02:00 window lists `00:00`, `01:00`, `23:00`.
**Fix approach:** sort by the slot's offset from its schedule's `startTime` in minutes (via the existing `toMinutes`), not by the label. Put the comparison in `lib/slots.ts` so it gets a `node --test` case with an overnight window; the service calls it.
**Coupling:** the phone app already sorts by instant, so this closes a real difference instead of creating one.

#### I24: Price always names its block (N8a)  ✅ DONE (2026-09-22)
<!-- `priceSuffix()` + `granularityLabel()` in lib/duration.ts (not lib/utils.ts: they are duration renderings and UNIT_MINUTES already lives there), `fmtPeso()` in lib/utils.ts, 8 test cases. Removed `pricePerUnit()`, which had no callers and could only say "per minute" for a 90-minute block. -->
**Files:** `lib/utils.ts` (beside I17's `fmtPeso`), then the Explore result cards and the Offering page (I13)
`offerings.price` is per unit of duration, never per booking (`schema.md` → `offerings`), so a bare "₱ 1,200" is ambiguous. One helper turns `(price, durationMinutes, durationUnit)` into "₱ 1,200 / 60 min", "₱ 350 / hr", "₱ 300 / day", ported from mobile's `format.ts`, with a test per unit.

### S0 execution notes (2026-09-22)

- **The briefing's copy-back instruction was wrong on one detail.** It said to drop the `.ts` import extensions. Booker sets `allowImportingTsExtensions: true` (`tsconfig.json:16`) and its existing `slots.test.ts` already imports `./slots.ts`, so the extensions **stay**. Nothing was changed in the copied files' imports.
- **`slots.ts` needed no work at all** — booker's copy and mobile's are byte-identical (verified by `diff`), which is what let the rest port cleanly.
- **The first version of `palette.test.ts` failed, and the test was wrong, not the colours.** It checked badge contrast against the page gradient's lightest stop, where three badges land at 4.33–4.43:1. Badges only ever render inside `.db-card` or `.db-sub`, where every one passes (4.60–6.47:1). The test now checks badges on those two panel surfaces and text tokens on the page stops as well. Recorded because the tempting alternative — lowering the threshold to 4.3 — would have left the guard asserting nothing.
- **Lint:** 23 pre-existing problems (18 errors) in `app/`, `components/` and `services/`, none in the new files. They are the inline-handler and `any` violations F13 already names; the stages that rewrite those files fix them.
- **Not run:** the Playwright visual suite. The `--db-text` and badge changes will move every committed baseline, and regenerating them is S7's job — running it now would either fail or bake in snapshots that later stages invalidate again.

### Added by the parity review (2026-09-22)

#### I25: Vendor page (D19)  ✅ DONE (2026-09-22)
<!-- components/explore/VendorPage/ (display + module.css). Offerings come from the cached
     catalogue filtered by vendor_id, so no new query. Reached from a vendor search result and
     from "All N services" on the Offering page; covers fetched for that vendor only. -->
**New:** `components/explore/VendorPage/` — `VendorPage.tsx` (render) + `useVendorPage.ts` (state) + `VendorPage.module.css`
- Reached from a `VendorResultCard` in Explore, and from "All N services" on the Offering page (I26).
- Shows name, division badge, city, tagline, `operating_hours`, address with a directions link, and that vendor's active offerings as `OfferingResultCard`s.
- Data: the cached catalogue (I7) filtered by `vendor_id` — no new query, no new service.
- `PageId` gains `vendor`; `useAppShell` holds the selected vendor id beside the offering id (D12, I15).
- Mirrors mobile P4's vendor screen; the two stay in step.

#### I26: Offering page details for parity (gap 3)  ✅ DONE (2026-09-22)
<!-- Category chip, granularity chip, operating_hours in the Where card, and "All N services". -->
**File:** the `OfferingPage` in I13
Adds what mobile P5 shows and I13 never named: a **category** chip and a **granularity** chip ("Booked by the hour" / "Booked in 90-min sessions" / "Booked by the week", from `duration_unit` + `duration_minutes`, ported from mobile's `format.ts` beside I24), the vendor's **`operating_hours`**, and an **"All N services"** link to I25.

#### I27: A notification opens its booking (gap 4)  ✅ DONE (2026-09-22)
<!-- lib/notificationTarget.ts reads data.booking_id; the title becomes a button only when one is present. The open-booking id moved to useAppShell so a notification can open a booking from any page. -->
**Files:** `components/layout/NotificationPanel/NotificationItem.tsx`, `components/layout/AppShell/useAppShell.ts`
`notifications.data` carries the booking id for booking-related types, but the panel only offers read, archive and delete. Make the row's title area a button that closes the panel and opens that booking's detail, as mobile P8 does. A row whose `data` holds no booking id stays plain text rather than a dead button.

#### I28: The numbers that drifted (gap 5)  ⬜ TODO
- `DivisionShortcuts` (I11) shows **all 13** divisions from `lib/divisions.ts`, not the prototype's 8.
- Payments (I20) defaults to **Last 3 months** — the default the approved `MobilePayments` board shows, and what mobile ships.

### S1–S3 execution notes (2026-09-22)

- **A wrong column name, caught before it shipped.** I6 was written against `new_status`; `booking_status_log` has `from_status` / `to_status` (`20260516000006:17-24`). Reading the migration rather than trusting the draft is the only reason this didn't reach a runtime error.
- **`onBookingConfirmed` was dead code.** The wizard takes the callback and never calls it (`useBookingWizard.ts:35`, and the lint warning that named it), so the shell's `setBookings(p => [b, ...p])` never ran — a new booking only appeared after a reload. Replaced with a refetch (plan G10), which is what S6 was going to do anyway. → **F23**.
- **Status colours are now one token set, not two.** The progress track needs the same colour as the status pill, and defining it twice would let them drift. `--st-<status>-bg/-fg` per theme now back both `.db-badge-*` and `.db-progress-*`, the separate `.dark .db-badge-*` rules are gone (one rule, two token sets), and `palette.test.ts` learned to resolve `var()` so it still checks real values. A new case asserts the track reads the shared token.
- **`pricePerUnit()` deleted.** No callers, and it could only ever say "per minute" for a 90-minute block. `priceSuffix()` replaces it in the same change.
- **The `statuswidget` gallery pane keeps its name** so its committed Playwright baseline keeps its filename; it renders `NeedsYouCard` now. A new `upnext` pane was added.
- **Lint went from 24 problems to 23** (17 errors, 6 warnings), none in the new files: the old `useDashboardPage` effect that ESLint flagged is gone, because the open booking is derived during render instead of stored (plan G8).
- **Not run:** the Playwright visual suite (S7 regenerates the baselines, which every colour and layout change here invalidates) and any check in a browser — nothing on these screens has been *looked at* yet.

### S4 execution notes (2026-09-22)

- **`as never` casts were a symptom, and removing them exposed a real inconsistency.** The
  result cards need full catalogue rows, but `searchCatalogue` returned its own narrow types,
  so the first version cast with `as never`. Making the matcher **generic** removed every
  cast — and the compiler then surfaced the actual problem: `SearchVendor` called the
  division's display name `division` while `CatalogueVendor` called it `divisionName`. Two
  names for one field, which the casts had hidden. Renamed to `divisionName` throughout.
- **Explore has no "When" filter (Any / Today / This weekend).** It needs each result's next
  opening, i.e. one schedules query per offering. I13 allowed dropping it rather than fanning
  out (trap c). → **P10**, so it is parked rather than quietly missing.
- **Recent searches are read in the state initialiser, not an effect.** Explore is lazily
  loaded on a click, so it never server-renders with that state. Guarded for a private window
  and for a stored value that is not an array.
- **Explore's entry values are initial state, not synced props.** A division chip from Home
  arrives as `initialDivision`, and the page remounts when it opens, so no effect copies props
  into state.
- **`transactions` → `payments` happened here**, not in S9, because S4 owns the tab list (I15's
  note). The old Transactions screen still renders; its heading now reads "Payments" so the tab
  and the page do not contradict each other for a stage.
- **Offering and vendor results currently continue into the existing booking flow.** The choice
  is remembered in the shell (`selection`); S5 renders the real pages. Sending someone to the
  flow that still works beats a dead button.
- **Not run:** the Playwright visual suite, and nothing has been looked at in a browser.

### S5 execution notes (2026-09-22)

- **Slot counts stay honest here too.** The Offering page lists the next open times across 14
  days and prints "N left" **only** when the occupancy function reports the count as known
  (plan F1). Where it does not, the time is offered with no number rather than an invented one.
- **Date-granular offerings are shown, and say what they are.** A day/week/month offering gets
  its granularity chip and price per block, plus a disabled "Booking by date isn't available
  yet" pointing at the vendor — not an empty slot grid (plan D11/P5).
- **Agreements are listed, never collected.** `getAgreements()` reads active `document`
  attachment titles so the page can say what will be asked for. No tick and no signature: the
  booker write path does not exist, so consent would be recorded nowhere (plan D20/P9). The
  service carries a warning that a document's file lives in the PRIVATE bucket and must never be
  resolved with `getPublicUrl`.
- **"Who you'll see" is the schedules' assigned staff**, deduplicated, names only (D7/D8, F6). A
  schedule with no staff, or staff no longer readable, contributes nothing.
- **A missing offering or vendor falls back to Explore** rather than rendering a page with blanks
  — both are read from the cached catalogue, which a reload or a deactivated vendor can empty.
- **`catalogueRef` added to the shell**, for the same reason `bookingsRef` exists: the vendor
  page's photo fetch runs after an await, where reading state would see the pre-fetch value.
- **Book again now opens the offering directly** (in S4 it seeded an Explore search as a stopgap).
- **Still not wired:** "Book this slot" enters the existing flow rather than the wizard at
  Schedule with the slot preselected — S6's work (I15). The selection is already held in the shell.
- **Not run:** the Playwright visual suite; nothing looked at in a browser.

### S6 execution notes (2026-09-22)

- **The flow is four steps and starts with a real offering at a real vendor.** `branch` is
  gone: it held `vendor.address` under a misleading name (plan F7), and the review screen now
  reads the address directly.
- **Schedules are fetched by offering id.** The code-keyed `getSchedulesForVendor` existed only
  for the dedupe-by-code path and went with it (plan I9).
- **Removed, because nothing references them any more:** `Step1Offering/`, `Step2Vendor/`,
  `MapWidget/`, `hooks/useGeolocation.ts`, `services/vendors.service.ts`,
  `getActiveOfferings()` + its `DbRow`/`OfferingsResult`, `getSchedulesForVendor()`, the
  `.leaflet-*` CSS overrides, and the `BookerVendor` / `LatLng` / `LocStatus` types. Verified by
  grep and a clean `tsc`, not by assumption.
- **`examName` → `offeringName`.** The draft and the resume card carried exam vocabulary from
  this app's origins. The draft's shape changed anyway (it now needs `vendorId`), and
  `useDashboardPage` **discards** a pre-S6 draft rather than resuming it into a dead end.
- **Resume reopens the offering**, rather than dumping the booker at the start of a flow.
- **The login page no longer advertises a map** ("Map view with distance sorting", which never
  existed — plan F8). It now describes the search that does.
- **The wizard's primary button lost its inline gradient and opacity** to a
  `BookingWizard.module.css` (component separation).
- **Lint fell from 23 problems to 19** (14 errors), because the deleted files carried four of
  them. Nothing new was introduced.
- **Date-granular offerings are still a dead end inside this flow** (plan D11/P5) — Step 1
  cannot pass without a time. The Offering page refuses to start the flow for them, so it is not
  a trap a booker can reach.
- **Not run:** the Playwright visual suite. It will fail loudly now: the `step1` and `step2`
  gallery panes are gone, so their committed baselines have no source. S7 regenerates.
- **S6-a done the same day (2026-09-22):** `leaflet`, `react-leaflet` and `@types/leaflet`
  uninstalled on the user's approval. Re-verified after: `tsc` clean, 100/100 tests,
  `next build` succeeds, `npm ls leaflet` empty. `npm prune` leaves an **empty**
  `node_modules/@react-leaflet/` directory behind — no files in it, absent from the lockfile,
  and it disappears on a fresh `npm ci`.

### S9 execution notes (2026-09-25)

- **Ported from the phone app, which had shipped these rules first:** `lib/payments.ts` and
  `lib/paymentsFilter.ts` with both suites (14 new cases; 114 total). Money meaning is decided
  in one place, so a total and a row cannot disagree about what "paid" means.
- **I19 landed differently from the plan's wording.** The plan named a `lib/phDates.ts`; the
  presets, their labels and the range arithmetic live in `lib/paymentsFilter.ts` instead, since
  Payments is their only caller and `lib/manila.ts` (ported in S2) already holds the Manila day
  arithmetic. A second module would have been a file without a second reason to exist.
- **Paging differs from the phone app on purpose** (plan D15): web pages with Previous/Next, so
  `nextPageSize` became `pageOf`/`pageCount`, with a test for the case that bites — tightening a
  filter while on page 3 must clamp, not render an empty list (vendor learned this).
- **The figures describe the filtered set, not the history.** This is the F14 fix: the old page
  summed `pricePaid` over every booking, unpaid and cancelled included, and called it "Total
  Spent". Cancelled and refunded rows are listed with the amount struck through and excluded
  from Paid, with a count saying so.
- **Chip counts are computed against the other filters**, so a chip never promises rows that
  tapping it will not deliver.
- **`components/transactions/` is deleted.** The `transactions` gallery mode keeps its name so
  its committed baseline keeps its filename; it renders `PaymentsPage` now.
- **A row opens the booking's detail** for now — the reference, timeline and status explanation
  already live there. The receipt sheet is S9b.
- **Not run:** the Playwright visual suite (S7 regenerates; it already fails from S6's removed
  panes), and nothing has been looked at in a browser in any stage.

---

### Home/Activity redesign items (2026-09-25, D21–D24)

Every component below states its render/hook/style split, per
`.claude/skills/component-separation/SKILL.md`. The phone app mirrors each one —
see its plan's §4b parity contract.

#### I29: Division icon resolver + `DivisionIcon`  ✅ DONE (2026-09-27)
<!-- `lib/divisionIcon.ts` + 9 tests: all 13 slugs resolve, 12 have a bundled file,
     ezzy-ride falls back to the "ER" monogram, an unknown slug goes neutral, a
     Command-set path wins, case/whitespace tolerated, no two paths collide.
     `components/ui/DivisionIcon/` renders the tint box + contain-fitted art + monogram.
     DivisionShortcuts swapped onto it, so all 13 (incl. the fallback) are on a shipping
     screen. Verified: 136/136 tests, `tsc`, `next build`, lint 19 unchanged. -->
- **`lib/divisionIcon.ts`** (new, pure + `divisionIcon.test.ts`). `divisionIcon(slug, iconPath?)` → `{ src: string | null; mono: string }`, applying D23's order. Unknown slug → `divisionKey()`'s `"none"` and a neutral mono. **No React, no fetch** — it is a string function, so it is testable and the phone app can copy it byte-for-byte like S0's modules.
  - Tests: each of the 13 slugs resolves; `ezzy-ride` yields `src: null` (F25); an unknown slug does not borrow a neighbour's colour; a future `icon_path` wins over the bundled asset.
- **`components/ui/DivisionIcon/`** (new: `DivisionIcon.tsx` pure display + `DivisionIcon.module.css`). Props `slug`, `size`, optional `label`. No state, no effects → **no hook**, which the conventions allow only for a genuinely pure display component; this is one.
  - Renders the tint box, `object-fit: contain` inside it, and the monogram branch when `src` is null.
  - Colours come from `data-division` + the CSS variables, **not** from TypeScript — the rule `lib/divisions.ts` already sets.
- **`booker/public/division-icons/<slug>.png`** — the 12 assets, after I35. The filename *is* the mapping; nothing hardcodes a division's art anywhere else.

#### I30: `HomePage` — the storefront  ✅ DONE (2026-09-27)
<!-- components/home/HomePage/ + useHomePage.ts + .module.css, rendered through
     HomeSection (I39). Sections: hero+search -> all-divisions grid -> Available today
     (I41) -> Book again -> vendors in your city. The in-progress strip is the only
     personal element and hides when nothing is running (new lib/homeRules
     inProgressBooking, tested). DashboardPage and components/dashboard/ deleted.
     Verified: 146/146 tests, `tsc`, `next build`, lint back to 19. ⚠️ Popular shelf NOT
     built — D26-gate is unapproved. -->
- **`components/home/HomePage/`** (new: `.tsx` / `useHomePage.ts` / `.module.css`), replacing `DashboardPage`'s role. `DashboardPage/` is **deleted** once Activity (I31) owns its children.
- Sections, top to bottom: **search hero** → **division grid** (all divisions, `DivisionIcon` + name band, 4-across on phone, auto-fill on desktop) → **Available today** (per D25) → **Book again** → **Vendors in <city>**.
- The **only** personal element is the "in progress / today" strip, rendered from the same booking array Home already receives, and **hidden otherwise** — no empty box.
- **Section chrome per D27:** every shelf renders through **I39's `HomeSection`** — the pipe, the header wash with its
  arc-and-stroke band, the hairline and the recessed body, at 10px radius with no shadow. The search hero is the single
  exception and keeps its 18px radius and its shadow.
- The division grid is the one section that always has content, so **Home is never blank**: the loading state skeletons the tiles at their real size, and a failed bookings fetch degrades Book again alone, not the page.
- The grid renders **whatever `DIVISIONS` holds** — no fixed 12 or 13 anywhere in the markup (F25, and the Command feature that follows).

#### I31: `ActivityPage` + the segmented control  ✅ DONE (2026-09-27)
<!-- components/activity/ActivityPage/ + useActivityPage.ts + .module.css. Segments
     Updates | Bookings, StatStrip above them. The five widgets arrived by `git mv` with
     their hooks and tests untouched (F33): NeedsYouCard, UpNextCard, InProgressCard,
     BookingList, BookingDetailModal. BookingsPage deleted — its unlimited list IS the
     Bookings segment. Stats derive from the booking array + lib/payments paidTotal, so
     Activity issues no query. Verified: 136/136, `tsc`, `next build`, lint 19. -->
- **`components/activity/ActivityPage/`** (new: `.tsx` / `useActivityPage.ts` for the segment state / `.module.css`).
- Segments **Updates | Bookings**. Updates holds `NeedsYouCard`, the status feed, and (desktop) a right rail with `UpNextCard`, `InProgressCard` and the month summary; Bookings holds `BookingList` with **no limit** and its four existing filters.
- **Moves, does not rewrite:** `NeedsYouCard`, `UpNextCard`, `InProgressCard`, `BookingList`, `BookingDetailModal` keep their current hooks, props and tests. Only their parent changes. `HOME_ROW_LIMIT` disappears with Home's copy of the list.
- The summary strip (Needs you / Upcoming / In progress / Paid this month) derives from the booking array and `lib/payments.ts`'s `paidTotal` — **no new query**, and it reuses the totals rule that F14 forced. It renders through **I40's `StatStrip`**, which is the only place D29's banding lives.
- The existing **Bookings page becomes Activity's Bookings segment**. `BookingsPage` is deleted, not kept as a duplicate.

#### I32: Navigation change  ✅ DONE (2026-09-27)
<!-- PageId: dashboard -> home, bookings -> activity. Renamed at the nine real sites only
     (types, constants MAIN_TABS, TopBar TITLES, AppShell routing + render props,
     useAppShell initial/goPage/setPage, ui-gallery x3). F32 held: `.from("bookings")` x8
     and useAppShell's Realtime `table: "bookings"` are untouched, as is the plural noun
     in Payments copy. Grep confirms no PageId string survives. -->
- `lib/types.ts`: `PageId` gains `"activity"`, loses `"bookings"`; `"dashboard"` → `"home"` (the string is already inconsistent with the label).
- `lib/constants.ts`: `MAIN_TABS` becomes Home · Explore · **Activity** · Payments; `TAB_FOR_PAGE` maps `booking` → `activity` (a booking opened from anywhere highlights Activity, not Explore).
- The Activity tab carries a **count badge** of open "needs you" items, from the same derivation `NeedsYouCard` already uses — not a second source of truth.
- `tsc` catches every typed reference, the way D13's `payments` rename did — but **`tsc` cannot catch the string collision in
  F32**: `"bookings"` is also the Supabase table name in `services/bookings.service.ts` and both payment routes. Rename through
  the union and its call sites; **never a project-wide find-and-replace**, and re-run `npm test` plus a booking round trip after.
- `app/ui-gallery/page.tsx` references the page ids too (F35) and must move with them, or the visual suite fails for a second
  reason on top of F36.

#### I33: The five missing division colour pairs  ✅ DONE (2026-09-27)
<!-- Law, Park, Learn, Work, Stay given real pairs in BOTH themes, plus 14 new
     `--div-<slug>-deep` tokens (the white-on-band shade) and 14 `--div-<slug>-tile`
     tokens. Every value computed against the 4.5:1 floor BEFORE writing. palette.test.ts
     gained two guards: white-on-deep >= 4.5:1 for all 14, and no two division
     foregrounds within 20 RGB. 9/9 palette cases pass. See F39 for two corrections made
     while choosing the values. -->
- `app/globals.css`, light and dark, plus the deep band shade D22 needs. Sampled from each logo's own art:
  | Slug | Tint (bg) | Label (fg) | Band (white text) |
  |---|---|---|---|
  | `ezzy-law` | `#f5efe4` | `#78551b` | `#6b4a17` |
  | `ezzy-park` | `#ffe4e6` | `#be123c` | `#9f1239` |
  | `ezzy-learn` | `#e6f4ef` | `#065f46` | `#065f46` |
  | `ezzy-work` | `#ffedd5` | `#c2410c` | `#9a3412` |
  | `ezzy-stay` | `#eef2f8` | `#3f5573` | `#35485f` |
- **I22's `palette.test.ts` is extended to cover the band shade against white**, so the new white-on-colour text is guarded the same way the badges are. Without that the test passes while the tile labels fail.
- Dark-mode values follow the existing `rgba(...,0.14)` tint pattern; the **tile** tint stays light in both themes (F26) and is therefore not a themed token — it is the division's own light value in both.

#### I34: Display typeface for headings  ✅ DONE (2026-09-27, web half only)
<!-- Bricolage Grotesque via next/font/google in app/layout.tsx — self-hosted at build
     time (.woff2 confirmed in .next/static/media), display: swap, weights 600/700/800,
     exposed as --db-font-display and applied to h1/h2 only. Mobile deliberately does NOT
     get it (mobile-redesign D3-A). Verified: `next build` compiles, 136/136, lint 19. -->
- Web: `next/font/google`, one family, headings and prices only, `display: swap`, subset `latin`. No `<link>` in `globals.css` — `next/font` self-hosts and avoids the layout shift.
- **Mobile does NOT get this face** (decided 2026-09-25, `2026-09-25-booker-mobile-redesign.md` D3-A). Adding it would reverse mobile-app D9, which removed font loading deliberately. The two clients differ in **type only**, recorded in that plan's §4 divergence table. ⚠️ **Do not "restore parity" by adding a font to the phone app** — that is a decision to re-open, not a gap to close. This item ships the web half only.
- It touches type only. No surface, spacing or colour token changes with it, so it can be reverted in one commit.

#### I35: Normalise the logo assets  ✅ DONE (2026-09-26)
<!-- 12 files in booker/public/division-icons/, named by slug. 4075 KB -> 771 KB (81%).
     Capped at 512 and never upscaled; the eight already <= 512 copied byte-identical
     (md5-verified). Done with the Chromium Playwright already installs — no new
     dependency, so no gate. See the F26 correction: there was no glow to remove. -->
- Resize all 12 to a single square master (**512×512** is enough for a 2× 66px tile and a 3× phone tile), keeping transparency, and land them in **`booker/public/division-icons/`**.
- The same resized files are what the phone app will copy, but **dropping them into the Expo app is that plan's work, not this one's** — this plan does not write outside `booker/` (see the cross-app flag).
- `ezzy_drive.png`: its baked glow needs removing, or the tile accepts a grey halo on the light tint. **Flagging, not choosing** — it is someone's artwork.
- ⚠️ **No image tooling is installed in this workspace** (no ImageMagick, no Pillow). Either a dependency is approved for a one-off script, or the resized files are produced outside the repo and dropped in. Until then the tiles would ship ~4 MB of PNGs, `ezzy_drive` alone being 1.4 MB.

#### I37: "Popular this month" shelf  ✅ DONE (2026-09-27)
- **`components/home/PopularShelf/`** (new: `.tsx` / `usePopularShelf.ts` / `.module.css`), rendering a ranked row: rank chip in
  the division's deep shade, offering name, vendor, price and the count that justifies the word "popular".
- **Data (D26-A):** `services/offerings.service.ts` gains
  `getPopularOfferings({ since, until, city, limit })` calling the RPC, then joins the returned
  `offering_id`s against the catalogue it already loads — the counts function returns **counts
  only** (F30), never rows a booker may not read.
- ⚠️ **Corrected 2026-09-27:** this item used to say `getPopularOfferings(window, limit)`, with
  no city and one open-ended date. Both were wrong against the pinned artboard, whose caption
  is *"Most booked across Cebu City in September"* — see the D26-gate review. **The city must
  be passed to the RPC, never applied to its result**, or a city with local favourites that are
  not national favourites gets an empty shelf.
- **Window:** the current Manila month, first day to last day — not "the last 30 days", so the
  heading "this month" is literally true.
- **The count is shown, not implied.** "34 bookings" next to the price is what makes the ranking checkable; a bare "Popular"
  badge with no number is the weak implementation of this item.
- Hidden entirely when the window returns nothing — no "no popular offerings yet" box on a discovery screen.
- ⚠️ If D26 resolves to **B**, the heading changes to *Featured* and this item becomes a `divisions`/`offerings` flag read; if
  **C**, the item is aborted and Home ships with four sections.

**Built 2026-09-27.** `lib/popular.ts` (+ 8 tests), `lib/manila.ts` gained `manilaMonthEnd`,
`services/offerings.service.ts` gained `getPopularOfferings`,
`components/home/PopularShelf/{PopularShelf.tsx, PopularCardRow.tsx, usePopularShelf.ts,
PopularShelf.module.css}`, wired into `HomePage` between the division grid and Available today.

⚠️ **F56 — the count's colour was a contrast failure, caught by measuring.** The artboard draws
it in the section's purple, and the obvious token was `--div-ezzy-well-deep`. That token is
**identical in both themes** (it is made for white text on a coloured band) and computes to
**2.08:1** on the dark card — far under 4.5. `--div-ezzy-well-fg` flips per theme and gives
**7.1:1** light and **10.13:1** dark. Same class of mistake as F39, caught the same way: by
computing it rather than looking at it.

⚠️ **F57 — a new shelf would have had no visual coverage at all.** The `/ui-gallery` `home` pane
passes an **empty catalogue**, so every data-driven shelf renders nothing there — "Available
today" has been uncovered since S12 for the same reason. Since `PopularShelf` owns an RPC call,
the fixture cannot render it with fixed data. Split the card into **`PopularCardRow`** (pure
display, no hook — the allowed exception) and added a `popular` gallery pane that renders it
with four divisions and a count of 1, so the per-division colours, the rank chip and the
singular "1 booking" are all in a baseline.
⚠️ "Available today" is still uncovered. Not fixed here — it would need the same treatment and
belongs in its own item. → **I47**.

**Verified:** 154/154 unit tests (8 new), `tsc` clean, `next build` passes, lint at its
19-problem baseline, visual suite **73/73** with two new baselines. Behaviour confirmed against
the real function on local: the RPC returns ranked rows for an active booker, and the city
argument demonstrably changes the set (all → 3 offerings, `Pila` → 2, `Quezon City` → 1).

#### I41: "Available today" shelf  ✅ DONE (2026-09-27)
<!-- lib/openingsToday.ts + 9 tests. THE CAP IS TESTED: a 200-offering catalogue causes
     exactly HOME_TODAY_CANDIDATES (12) schedule fetches. Slots filtered against Manila
     now (passed in, never read from Date inside), soonest-first, one failed fetch does
     not empty the shelf, hidden entirely when nothing is open. Candidates narrowed by
     CITY first — no distance term (F37). -->
- **`services/schedules.service.ts`** gains `getOpeningsToday(offeringIds, date)`: for a **capped candidate list** it reuses
  `getSchedulesForOffering`, `getSlotsForDate` and `getSlotOccupancy` — all three already exist from S1/S3b — and returns the
  soonest remaining opening per offering, Manila-dated.
- **The cap is the design, not an implementation detail** (F29). `HOME_TODAY_CANDIDATES = 12`, chosen in the booker's selected
  city, and the shelf renders the first 3 that still have an opening. A test asserts the service issues **at most
  `HOME_TODAY_CANDIDATES` schedule fetches** for a catalogue of 200 — that is what stops this becoming P10.
- **Ordering is soonest opening. There is no distance term** (F37). The city filter is the location model.
- Openings already past are excluded against **Manila now**, not the browser clock — `lib/` already owns Manila arithmetic.
- **`components/home/AvailableTodayShelf/`** (`.tsx` / `useAvailableTodayShelf.ts` / `.module.css`), rendered inside I39's
  `HomeSection`. Hidden entirely when nothing is open — no empty shelf.
- ⚠️ Counts print only when `getSlotOccupancy` reports them `known`, the rule S3b already established.

#### D26-gate: the popularity function  ✅ APPROVED + WRITTEN (2026-09-27)
**Approved 2026-09-27. Written as `backbone/supabase/migrations/20260927000001_popular_offerings_rpc.sql`
— NOT applied; you apply it (standing practice).** Filed under today's date rather than the
drafted `20260925000001`, so it sorts after `20260922000001`.

⚠️ **Three corrections between the draft below and the file, each found by reading the schema
rather than trusting the draft:**

1. **`'rejected'` is not a booking status.** The draft excluded
   `status not in ('cancelled','rejected')`; `bookings_status_values`
   (`20260801000002:51`) permits only `pending, confirmed, fulfilled, in_progress, returned,
   completed, disputed, cancelled, refunded`. Excluding a value that cannot exist is harmless
   at runtime and misleading forever — worse, it meant **`refunded` bookings were counted as
   popularity**. Now `not in ('cancelled','refunded')`, matching `get_slot_occupancy`.
2. **The draft had no caller gate.** `get_slot_occupancy` refuses a non-active caller with
   `is_active()` and *raises*; the draft was `language sql` with no check at all, so any
   authenticated role could call it. Now `plpgsql` with the same gate and the same
   raise-don't-return-empty rule — ⚠️ here the reason is sharper than for occupancy: an empty
   result is **a genuinely valid answer** ("nothing booked yet"), so a silent refusal would be
   indistinguishable from real data.
3. **The draft could rank an unbookable offering.** It counted `bookings` alone, so a delisted
   offering, or one belonging to a suspended vendor, could top the shelf and 404 on tap. Now
   joined to `offerings.is_active` and the vendor's `active` status, mirroring the
   `booker_vendor_read_policy` predicate. Popularity is historical; bookability is current, and
   the shelf can only act on the second.

Also added: `p_since` null/future/>366-day validation, and an `order by … , b.offering_id`
tie-break so two offerings on the same count do not swap places between refreshes.

**Still true and deliberately not acted on:** there is no index on `bookings.booked_date`. An
index is a write-path cost on the busiest table in the schema; add it when a measurement asks,
not on suspicion. Recorded in the migration's header.

**Verify after applying** (the F24 check):
```sql
select grantee, privilege_type from information_schema.routine_privileges
where routine_name = 'get_popular_offerings';   -- expect NO anon
```

<details><summary>The original draft, kept for the record</summary>

```sql
-- 20260925000001_popular_offerings_rpc.sql  (DRAFT — not applied)
create or replace function public.get_popular_offerings(
  p_since date,
  p_limit int default 8
)
returns table (offering_id uuid, booking_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select b.offering_id, count(*)::bigint
  from bookings b
  where b.booked_date >= p_since
    and b.status not in ('cancelled', 'rejected')
  group by b.offering_id
  having count(*) > 0
  order by count(*) desc, b.offering_id
  limit least(greatest(p_limit, 1), 20);
$$;

revoke all on function public.get_popular_offerings(date, int) from public, anon;
grant execute on function public.get_popular_offerings(date, int) to authenticated, service_role;
```

**Blast radius, assessed before asking:**
- **Data:** read-only. Creates no table, rewrites no row, validates nothing. Nothing can fail on existing data.
- **Lock / performance:** `create function` takes a brief catalogue lock only. At runtime it is one aggregate over `bookings`
  filtered by date. ⚠️ **There is no index on `bookings.booked_date`** — confirm before shipping; on today's row counts a seq
  scan is fine, and the honest fix later is an index, not a materialised view.
- **Exposure:** returns **an offering id and a count** — no booker id, no name, no amount, no PII. It deliberately mirrors
  `get_slot_occupancy` (`20260922000001`), including the `revoke … from public, anon` **before** the grant — the exact line that
  F24 caught being wrong last time, because this project's `pg_default_acl` grants EXECUTE to `anon` directly.
- **Reversibility:** `drop function public.get_popular_offerings(date, int);` — nothing depends on it but one service call.
- **Cross-app:** none. `command` and `vendor` do not call it.

</details>

#### F55 — staging never got the occupancy function (found 2026-09-27)

Checked while answering "my staging is behind 2 migrations". `supabase migration list --linked`
against `fbxbwnfeimzhgxpshdpa` returns an empty remote column for **both**
`20260922000001_slot_occupancy_rpc` and `20260927000001_popular_offerings_rpc`.

⚠️ The first one was **recorded in this plan as applied on 2026-09-22** ("Applied; function
confirmed live, `security definer`, `stable`"). That evidence was real but it was **local** —
S3b-3's wording, "apply the migration (local, then staging)", let a local-only apply satisfy a
row that claimed both. S3b-3 is corrected above; the lesson is that "local, then staging"
should have been two rows with two pieces of evidence.

**What it means on staging today:** `getSlotOccupancy` calls an RPC that does not exist there,
gets an error, and returns `known: false` — which the UI renders as **no "N left" number at
all** (`services/schedules.service.ts:293`). So it degrades exactly as designed rather than
breaking, and the symptom is the absence of a feature, not an error. That is also why nobody
noticed.

⚠️ **Production is not checked.** The `backbone` CLI is linked to staging, so this command says
nothing about prod. Verify separately before assuming prod has either function.
✅ RESOLVED (2026-09-27) — pushed to staging and production. Staging re-checked: 0 pending.
⚠️ Production is **unverified from here**: `backbone` is linked to staging, so no command in this
session reports on prod. The grants query on prod is still outstanding.

⚠️ **`20260922000001` is a live behaviour change on prod, not an inert one.** Shipped booker code
calls `getSlotOccupancy`; bookers who saw *no* "N left" on Step 3 now see real numbers — and it
reached production **before S3b-5** confirmed those numbers on staging. Do that check soon: if
the counts are wrong, prod is where it shows.

#### D26-gate review — checked against the widget before applying (2026-09-27)

You asked whether the function actually supports the shelf before running it. Checked against
the **pinned artboard** (`project/Main.dc.html`, the "Popular this month" section) and I37, not
against the draft. **Two gaps and one decision**, all now closed in the file.

**GAP 1 — no city scope, and the design says there is one.** The artboard's caption reads
*"Most booked across **Cebu City** in September"*. Every other Home shelf narrows by the
booker's city; this one was platform-wide.

⚠️ And it could not have been fixed in the client. Filtering after the call returns the
**country's** top 8 and then discards the ones out of reach — so a city whose offerings are
popular locally but not nationally shows an **empty shelf**, which reads as "nothing is popular
here" rather than "we ranked the wrong population". The filter has to be inside the query,
before the `limit`. Added `p_city text default null`, case-insensitive because `vendors.city` is
free text a vendor typed. Null = platform-wide, which is the booker's real "no city filter"
state.

**GAP 2 — the window had no upper bound, so "this month" meant "from this month onwards,
forever".** `bookings.booked_date` is the **service date** (`20260507000004:42`), not when the
booking was made. `where booked_date >= p_since` therefore counted every future booking that
will ever exist: a shelf headed "Popular this month" would rank a booking for next March.
Added `p_until date default null`, defaulting to `current_date`, plus a `p_until < p_since`
check. Home passes the month's last day, so the caption's "in September" is literally true.

**DECISION — service date, not when-booked.** The function ranks by `booked_date` ("booked
*for* a date in the window"). The alternative is `created_at` ("booked *during* the window"),
which is demand recency and would rank an offering that filled up yesterday for next winter.
Chose the service date because it is the date every other booker surface already means —
Payments' period presets, Activity's stat strip — so one word means one thing across the app.
Recorded in the migration header as a one-line change if it ever proves wrong.

**Checked and found NOT to be gaps:**
- *Can the client resolve the returned ids?* Yes. The catalogue is fetched with
  `fetchAllPages` (`services/offerings.service.ts:62`), so every active offering is in memory
  and no id can come back unresolvable.
- *Does the shelf need anything the function withholds?* No. The artboard's card needs name,
  vendor, price, division colour and the count. The first four are catalogue fields the client
  already holds; the count is what the function adds. Rank is the array position.
- *Grants.* `authenticated` only, with the explicit `anon` revoke (F24).

**Signature changed as a result** — `(p_since, p_until, p_city, p_limit)`. ⚠️ A second
positional argument is now a **date**, not the limit; the sample call in
`booker-demo-seed.sql` was updated to named arguments for exactly that reason.

**I37 is now unblocked** — it waits only on you applying the migration.

#### I38: Collapsible sidebar  ✅ DONE (2026-09-27)
<!-- Sidebar.tsx: the closed branch is now `fixed -translate-x-full lg:hidden` — `lg:hidden`
     rather than a transform, because a translated sidebar still occupies its 224px in the
     flex row and the content would not reclaim the space. AppShell: onMenuOpen ->
     onToggleMenu (it was an open, not a toggle); the scrim keeps `lg:hidden`. useAppShell:
     sideOpen defaults TRUE (the F31 trap), plus SIDEBAR_COLLAPSED_KEY persistence read in
     an effect, never a useState initialiser. TopBar: aria-expanded / aria-controls and a
     label that changes with the state; Sidebar gained id="app-sidebar".
     Verified: 146/146, `tsc`, `next build`, lint 19; and each of F31's four traps grepped
     individually. NOT verified: any of it in a browser — S7. -->
- **`Sidebar.tsx:34`** — the closed branch stops forcing `lg:translate-x-0`. Closed becomes `-translate-x-full` **and**
  `lg:hidden` (or `lg:w-0`), so the flex row reclaims the width instead of leaving a 224px gap.
- **`AppShell.tsx:272`** — `onMenuOpen` becomes `onToggleMenu: () => setSideOpen(o => !o)`. The prop is renamed on `TopBar` too,
  because "open" stops being true of what it does.
- **`useAppShell.ts:25`** — `sideOpen` defaults to **`true`** (F31's trap). Below `lg` the drawer is `fixed` and translated out,
  so a `true` default costs nothing there; at `lg` it is what keeps today's behaviour for anyone who never touches the button.
- **Persistence:** remember the collapsed state in `localStorage`, read in an effect (never in a `useState` initialiser — this
  shell is server-rendered first, and `useDashboardPage.ts:20-34` already documents that exact hazard). Wrapped in `try/catch`,
  defaulting to open.
- **Separation:** `Sidebar.tsx` stays a render layer, the state stays in `useAppShell`, the class strings stay in `cn()` as they
  are today. No new `.module.css` — nothing about this is non-trivial styling.
- **A11y:** the button gets `aria-expanded` and `aria-controls`, and its label changes with the state. It keeps the scrim only
  below `lg` (F31).

#### I39: `HomeSection` — the shared shelf chrome  ✅ DONE (2026-09-27)
<!-- components/home/HomeSection/: one rule set, five tones. Each tone sets
     --section-accent and the pipe / wash / arcs / strokes are all derived from it with
     color-mix(), so D27's four alphas exist once. 10px radius, no shadow, header-only
     artwork, recessed body, responsive at 640px. Not yet consumed — S12 renders it. -->
- **`components/home/HomeSection/`** (new: `.tsx` pure display + `.module.css`; no hook — no state, no effects).
- Props: `title`, `meta`, `colour` (the section's token), `action`. Renders the 4px pipe, the title row, the header wash with
  its arc-and-stroke band, the hairline, and the recessed body.
- **One rule set, parameterised by a CSS custom property** — `--section-accent` set per instance. D27's four alphas (pipe 100%,
  wash 6/10%, arcs 20/26%, strokes 11/14%) are derived in CSS from that one value via `color-mix()`, so a colour change is one
  edit and a fifth section cannot drift.
- Used by every Home shelf (I30) **and nothing on Activity** (D29's boundary).

#### I40: `StatStrip` — the banded Activity summary  ✅ DONE (2026-09-27)
<!-- components/activity/StatStrip/: one .card rule, four tones via --stat-accent, the
     3px band as per-side border-top/bottom so the card keeps its own hairline. The rule
     is scoped to this component only, which is what keeps it off the widgets below
     (D29, trap ac). Not yet consumed — S11 renders it. -->
- **`components/activity/StatStrip/`** (new: `.tsx` pure display + `.module.css`; no hook — the counts are derived by
  `useActivityPage` and passed in).
- One `.statCard` rule with `--stat-accent` per card, drawing the 3px top and bottom rule. **Scoped so widgets below the strip
  cannot pick it up** (D29's narrowing, trap ac).
- The four counts come from the booking array and `lib/payments.ts`'s `paidTotal` — **no new query** (I31).

#### I46: Booker demo data, so the new widgets can be seen on staging  🔄 WRITTEN, UNRUN (2026-09-27)
<!-- Asked for alongside the D26-gate approval: "ensure there is a way for me to replicate
     that on my hosted, staging instance". -->
**Files:** `backbone/supabase/demo/booker-demo-seed.sql` + `booker-demo-teardown.sql`.

**Why it was needed.** The migration adds **no data at all** — it is a function. And the
existing `demo/demo-seed.sql` cannot fill these screens: ⚠️ its demo bookers are created with an
**unusable password hash and can never sign in**, and "Book again", Activity and Payments all
read `booker_id = auth.uid()`. It dresses the vendor portal; nothing dressed the booker's.

**What it does.** Additive, tagged (`de400000-`), reversible, attaches to an existing booker you
can sign in as and an existing active vendor. Creates no user, vendor, offering or staff — one
schedule per offering (up to 3) and ~14 bookings across ~90 days with mixed statuses, ~9 paid.
Follows `demo-seed.sql`'s notification/email suppression exactly.

⚠️ **Two schema traps it had to respect**, both found by reading the migrations:
- `check_booking_consistency()` (`20260507000004:64`) rejects a booking whose `offering_id`
  differs from its schedule's. The first draft cycled bookings across three offerings against
  one shared schedule — every insert would have failed. Hence one schedule per offering.
- `schedules.end_time` was **dropped** in `20260828000002`; the stored value is `window_minutes`
  (capped at 1440). An insert naming `end_time` fails on any current database.

⚠️ **Why a daily schedule.** The local seed's schedules are Mon/Wed/Fri and Tue/Thu, so on a
Saturday or Sunday "Available today" is correctly empty and looks broken. The demo schedule runs
every day, 08:00 + 720 minutes, so slots exist until 20:00 Manila.

**Status: written, NOT RUN.** ⚠️ It has never been executed — not against local, not against
staging — so it is unverified SQL. Run it on **local first**; the teardown exists so a failed
attempt costs nothing. It is not a migration and lives outside `migrations/`, so nothing applies
it automatically.
**Verification when it runs:** the two queries at the foot of each file (row counts by status,
then `get_popular_offerings((current_date - 90)::date, 8)` returning rows).

#### I47: "Available today" has no visual baseline either  ⬜ TODO
<!-- F57's other half, found while giving the Popular shelf one. -->
- **Why:** the `/ui-gallery` `home` pane passes `catalogue: { offerings: [], vendors: [] }`, so
  every data-driven shelf renders nothing there. "Available today" has therefore been uncovered
  since S12 — its card layout is checked by no baseline at all.
- **Fix:** the same treatment `PopularShelf` just got — split the card out of `HomePage.tsx`
  into a pure display component and give it a gallery pane with fixed data.
- ⚠️ Slightly more work than Popular's was, because the card is inline in `HomePage.tsx` rather
  than in its own component, so the extraction touches a file S12 verified.

#### I44: Delete the two orphaned Home components  ⬜ TODO
<!-- F52. Trivial, but it is a code change and S8 was docs-only. -->
- **Files:** `components/home/DivisionShortcuts/` and `components/home/OpenSlotsCard/` (each a
  `.tsx` + hook + `.module.css`). Nothing imports either — verified by grep across `app/` and
  `components/`.
- **Fix:** delete both directories. ⚠️ Check `/ui-gallery` first — a pane that renders one would
  fail to compile, and its baseline would need removing with it.
- **Why it matters beyond tidiness:** they were added by this plan (`69c76f8`), so leaving them
  implies the Home screen uses them.

#### I45: The resume-draft card names six wizard steps  ⬜ TODO
<!-- F53. User-visible, not cosmetic. -->
- **File:** `components/activity/InProgressCard/InProgressCard.tsx:42, 63` — renders
  `PROG_STEPS` (six) and prints `Step N of 6` with a label from the same array, while the draft's
  `step` indexes the **four**-entry `WIZARD_STEPS`.
- **Symptom:** a draft saved on Documents reads **"Step 2 of 6 — Pick a Vendor"**, a step that no
  longer exists; the progress dots draw six nodes for a four-step flow.
- **Fix:** point this card and the `/ui-gallery` `bookingstepper` pane at `WIZARD_STEPS`
  (exported from `useBookingWizard.ts`) and delete `PROG_STEPS` from `lib/constants.ts` — those
  two are its only consumers. ⚠️ `WIZARD_STEPS` holds short labels only (`"Schedule"`), while
  `PROG_STEPS` carried `label` **and** `short`; this card uses both, so one of them needs a
  long-form label, which is a small copy decision rather than a pure refactor.
- **Verification:** re-record the `inprogress` and `bookingstepper` baselines; assert
  `PROG_STEPS` is gone by grep.

#### I43: Touch targets below 44px across the shell  ⬜ TODO
<!-- Found in S7 by measurement, deliberately NOT fixed there: see "Why not now". -->
Measured, not eyeballed: every visible interactive box on ten panes at 360 / 390 / 1280 in both
themes — `booker/visual-tests/a11y-audit.mjs`, run by hand against a dev server that is already
up (`node visual-tests/a11y-audit.mjs`, `AUDIT_BASE=…` to point it elsewhere). It is not part of
the Playwright suite. It also reports **horizontal overflow** per pane, which is what caught F50.
At the two **touch** widths, these come back under 44px in a dimension:

| Where | Control | Box |
|---|---|---|
| `InfoTip` (Needs you, Activity) | "What does … mean?" | **22×22** – 22×44 |
| `TopBar` | search, theme, bell | 34×34 each |
| `TopBar` | hamburger | 38×38 |
| `ActivityPage` | Updates / Bookings segments | ~34 tall |
| `BookingList` | Upcoming / In progress / Past / Cancelled chips | ~32 tall |
| `NeedsYouCard` | "Yes, all done", "I've returned it", "Something's wrong" | ~32 tall |
| `Sidebar` | nav rows / "About & Legal" | 40 / 36 tall |
| `PaymentsPage` | Export CSV, Print | ~38 tall |
| `HomePage` | **"Open Explore" section link** | **98×20** |
| `HomePage` | **hero "Search a service or vendor"** | **288×25** |
| `PaymentsPage` | search input | 215×20 |

⚠️ **The 20–25px readings are real, and they are on the screens this plan just built.** I first
wrote them off as measured mid-layout; they survive a `[data-gallery-ready]` handshake and a
`document.fonts.ready` wait (both added to the script and to `pilot.spec.ts` — see F48), so they
are the actual boxes. The apparent contradiction — "Open Explore" at 93×**39** on a 360 viewport
and 98×**20** on a 390 one — is the label **wrapping to two lines** in the narrower column, which
is the wrong way to reach 44px.

**Also keyboard**, from the same run:
- the `role="tablist"` wrapper labelled "Booking groups" in `BookingList` is a tab stop with no
  focus change — it should not be focusable at all; the tabs inside it are;
- Payments' search input and its Previous / Next buttons showed no focus change either.
- ⚠️ Caveat on that last group only: the script focuses elements **programmatically**, and
  `:focus-visible` does not always apply to a programmatic focus. Confirm these three by
  actually tabbing before changing anything; the missing-name findings (F49) needed no such
  caveat and are already fixed.

**Why not now:** 44px is a **design** change, not a polish tweak. Raising the bell, the segments
and the chips changes the metrics of the pinned design (D21–D30) and re-records most of the
baselines that S7 just settled. It needs a decision on whether to hit 44px with padding (taller
chrome) or with a transparent hit area (same look), and that is a D-item, not something to
absorb silently at the end of a stage.

#### I42: `BookAgainCard` does not render through `HomeSection`  ⬜ TODO
<!-- Found in S7 (F47). Deliberately NOT done in a polish stage. -->
- **File:** `components/home/BookAgainCard/BookAgainCard.tsx` — it draws its own card chrome
  from before `HomeSection` existed, so on Home it reads as a different kind of object than the
  four shelves around it (no pipe, no band, no D27 artwork).
- **Fix direction:** wrap its list in `<HomeSection tone="…" title="Book again" …>` and delete
  the card's own header/frame, keeping the row markup untouched. Needs a fifth `tone` or reuse
  of `today`'s — a D27 choice, not a mechanical edit.
- **Why not now:** it is a visual inconsistency, not a defect, and it moves markup S11 verified.
  Doing it here would mean re-recording the Home baselines a second time in the same stage.

#### I36: Docs for the redesign  ✅ DONE (2026-09-27)
- `architecture/portals.md`: booker's nav becomes Home · Explore · Activity · Payments; the Home feature list is replaced; Activity is added.
- `architecture/schema.md`: record F27 — `divisions` has no icon column and there is no icon bucket — as the named prerequisite of the Command icon feature, so the next plan does not rediscover it.
- Folds into S8 rather than being its own stage.

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

### I16: App shell chrome (Sidebar drawer, TopBar, TabBar)  ✅ DONE (2026-09-22)
<!-- Sidebar keeps the drawer and now reads its colours from a Sidebar.module.css instead of
     inline gradients and hex; TopBar has a title for every page plus the search entry (field
     at md+, icon button below); TabBar rebuilt with 4 tabs and the phone icon-over-label
     layout (G4); a pushed page keeps its parent tab lit via TAB_FOR_PAGE (G3); the unloaded
     Inter font name is gone from AppShell, the gallery and LoginPage.module.css (D18/N3). -->
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
- **P9: Agreement acceptance at booking (D20).** ⏸ PARKED 2026-09-22 — `booking_acknowledgements` is written only by Vendor Kiosk Mode, so a booker's tick would record nothing. Unblocked by a booker write path (RPC or route; backbone + booker), after which **both** clients add the step together.
- **P10: Explore's "When" filter (Any / Today / This weekend).** ⏸ PARKED 2026-09-22 — it needs each result's next opening, one schedules query per offering; I13 allowed dropping it rather than fanning out across the catalogue. Unblocked by a bounded "openings for the visible page" fetch, or a server-side view. The Offering page (S5) shows real openings for the offering someone actually picks.
- **P8: Payment method per booking.** Not stored anywhere (F15). Unblocked by capturing it from the PayMongo webhook payload (schema + route change).
- **P6: Server-side search.** Only if the catalogue outgrows client-side matching. Would need a search function or index, which is a schema gate.

---

## Execution order

One stage at a time (developerboss cadence). Each stage ends with `npx tsc --noEmit`, `npm run lint` and `npm test` in `booker/`, and a report.

- **S0: Foundations** ✅ DONE 2026-09-22. I1, I2 (module only), I3, I4, **I22**. Largely a **copy-back** from `ezzy-booker-mobile/src/lib/` — take the file, drop the `.ts` import extensions, keep the tests (see the briefing). No UI change beyond D17's token values. *Safe now.*
- **S1: Data layer** ✅ DONE 2026-09-22. I5, I6, I8, I9, I7, **I23**, **I24**.
- **S2: Home core** ✅ DONE 2026-09-22. I10 with **N1**, **N2**, **N7** and **I27**. Deletes `BookingStatusWidget/` and `BookingCard/`.
- **S3: Home side** ✅ DONE 2026-09-22. I11 with **I28**. I12 still waits for S3b (D9-A).
  - **S3b (D9-A, coupled):** ✅ DONE 2026-09-22 — migration written, applied by the user, `getSlotOccupancy()` switched to the RPC, I12 built, and the fix proved locally as a real booker. ⬜ Remaining: apply F24's follow-up migration, and the staging check (S3b-5).
- **S4: Nav + Explore** ✅ DONE 2026-09-22. I16, I15's nav part, I13's `ExplorePage` + `BookingsPage`, and the `payments` rename.
- **S5: Offering page** ✅ DONE 2026-09-22. I13's `OfferingPage`, **I26**, **I25** (vendor page). Staff per D7/D8.
- **S6: Wizard entry + removals** ✅ DONE 2026-09-22, with S6-a (Leaflet uninstalled on the user's go).
- **S9: Payments core.** I17, I19, I21, and I20's page, period bar, summary cards, filters, month groups and rows. Depends on S0 (division colours), S1 (paged `getBookings`) and S4 (the tab). Deletes `components/transactions/`.
- **S9b: Payments receipt, CSV and print.** ✅ DONE 2026-09-26. I18, I20's receipt and print view, the `@media print` block. 125/125 tests, `tsc` clean, `next build` passes, lint unchanged at 19. Found F38.
- **S10: Redesign foundations.** ✅ DONE 2026-09-27. I29, I33, I34 (web half), I35, I39, I40. 136/136 tests, `tsc` clean, `next build` passes, lint unchanged at 19. Found F39. `DivisionShortcuts` now renders all 13 through `DivisionIcon`, so the `ezzy-ride` fallback is on a shipping screen; `HomeSection` and `StatStrip` are built but not yet consumed (S11/S12 render them).
- **S13: Collapsible sidebar.** ✅ DONE 2026-09-27. I38. 146/146 tests, `tsc` clean, `next build` passes, lint unchanged at 19. All four F31 traps closed and grepped. `lib/constants.ts` gained `SIDEBAR_COLLAPSED_KEY`.
- **S11: Activity tab + navigation.** ✅ DONE 2026-09-27. I31, I32. 136/136 tests, `tsc` clean, `next build` passes, lint unchanged at 19. Widgets moved with `git mv` (history preserved); `components/bookings/` deleted; `DashboardPage` stripped to its discovery widgets and is deliberately thin until S12. Found F40.
  - ⚠️ **Between S11 and S12 Home is deliberately thin** — the widgets have left and the storefront has not landed. If that gap is unwanted, run S11 and S12 as one pass; they are split only to keep each review small.
- **S12: The storefront Home.** ✅ DONE 2026-09-27 — I30 and I41. 146/146 tests, `tsc` clean, `next build` passes, lint back to 19. **I37 (Popular) NOT built**: D26-gate is still unapproved, so the shelf is absent and the rest of Home shipped, exactly as this line allowed. Found F41, F42.
- **S7: Polish** ✅ DONE 2026-09-27 — runs **after S9b and S12**, so the pass covers Payments, Home and Activity.
  - ✅ Baselines regenerated with the clock frozen (F46): 67 captures re-recorded, then the suite re-run unchanged against them — 71/71, exit 0. Eight stale captures removed (`step1`, `step2`, `statuswidget`, `transactions`); `statuswidget`→`needsyou` and `transactions`→`payments` renamed.
  - ✅ Fixture correctness: F45 (raw dates/times, no more `NaN`), F44 (CSP test repointed at the division PNGs), F43 (`TopBar` hydration), F48 (fixture client-only + `hooks/useMounted.ts`).
  - ✅ Measured pass at 360/390/1280 in both themes (`a11y-audit.mjs`): accessible names, touch boxes, tab order per pane, horizontal overflow. Produced **F49** (fixed), **F50** (fixed) and **I43** (deferred, with the numbers).
  - ✅ Contrast: `palette.test.ts` asserts every badge/muted pair ≥ 4.5:1 and no two division foregrounds within 20 RGB, in both themes — part of the 146 passing tests (I22, F39).
  - ✅ Confirming visual re-run after F48/F50: **71/71, exit 0, zero hydration errors**, no baseline re-record needed.
  - ⬜ What a machine cannot do: judging whether the 62 changed captures LOOK right → S7-a, yours.
  - Regenerate the Playwright baselines (`visual-tests/pilot.spec.ts-snapshots`, which are committed) and review the diffs, not just accept them → S7-a.
- **S8: Docs** ✅ DONE 2026-09-27 — last stage. Written from the built code, with every claim
  grepped before it was stated; that is how F52–F54 turned up.
  - `architecture/portals.md`: booker features, Live-vs-Mock, Known Gaps, Roadmap (D4 supersedes #1), nav.
  - `architecture/booking-flow.md`: the new entry path and removal of Steps 1–2.
  - `architecture/schema.md`: only if I14 lands.
  - Update `booker/AGENTS.md` for what shipped (rewritten ahead of time on 2026-09-21, F11).
  - Cross-reference booker-mobile-prototype W1/W5 as delivered on web.
  - Payments: rename in `portals.md` (Transactions → Payments), the corrected totals rule, filters, CSV and pagination.
  - **I36:** the new nav (Home · Explore · Activity · Payments), the storefront Home, the Activity tab, and F27 recorded in `schema.md` as the prerequisite of the Command icon feature.

---

## Big table

The single checklist for this plan, Home **and** Payments. Updated before every stage report. **Who:** Me = Claude, You = the user. Git commits are always yours; I draft the message and the file list.

| Done | ID | What | Who | Status | Why / reason |
|:-:|---|---|---|---|---|
| [x] | Proto-1 | Prototype: Home, Explore, Offering | Me | ✅ DONE 2026-09-18 | Settle the direction before planning. Reference only: no sidebar (G1), font not adopted (D3) |
| [x] | Proto-2 | Prototype: Payments desktop + phone dark | Me | ✅ DONE 2026-09-20 | Approved 2026-09-20 with three answers: name "Payments", add CSV, 10 per page |
| [x] | D1–D12 | Home / Explore / Offering decisions | You | ✅ DONE 2026-09-18 | No stage runs while a decision is open |
| [x] | D13–D16 | Payments decisions (name, CSV, pagination, print) | You | ✅ DONE 2026-09-20 | Same gate, Payments half |
| [x] | D19, D20 | Parity: vendor page on web; agreements parked on both | You | ✅ DONE 2026-09-22 | From the 2026-09-22 parity review |
| [ ] | Parity | Per-stage check against mobile's matching P# section | Me | ⬜ TODO | A new difference is justified in mobile §4 or fixed |
| [x] | F39 | Two colour collisions caught while choosing I33's values | Me | ✅ DONE 2026-09-27 | `work`/`pets` 15 apart, `learn`/`court` same green, dark `park`/`food` 10 apart. All fixed and guarded. `court`/`care` at 25.6 is pre-existing (D17) — flagged, not changed |
| [x] | G1–G12 | Plan review gaps folded in (sidebar, tabs, realtime, a11y, …) | Me | ✅ DONE 2026-09-18 | Keeps a weak implementation from satisfying the plan as written |
| [x] | F14–F21 | Payments findings (wrong totals, truncation, refund wording, existing CSV/print/date patterns) | Me | ✅ DONE 2026-09-20 | Read the real code before planning; three are money bugs or copy risks |
| [x] | Approve | Approve the plan for execution | You | ✅ DONE 2026-09-21 | Approved; execution starts with S0 |
| [x] | Brief | Read and **verify** the ezzy-booker-mobile briefing | Me | ✅ DONE 2026-09-22 | 111/111 mobile tests pass; `slots.ts` diff identical; N3, N5, N6, N9, N10 confirmed by code read and computed contrast (N9 corrected) |
| [x] | D17 | Contrast fixes → adopt the phone app's tested values | You | ✅ DONE 2026-09-22 | Six badge styles and the grey text were below 4.5:1, and status colour carries meaning |
| [x] | Proto-3 | Two Home/Activity directions drawn as full canvases (desktop + mobile Home, Activity, icon system, states) | Me | ✅ DONE 2026-09-25 | Compare a real storefront against a real alternative before changing the plan. Both links are in the header |
| [x] | D21–D24 | Home → discovery, Activity takes the dashboard; B's tiles and type adopted; icons resolve by slug; five grey divisions get colours | You | ✅ DONE 2026-09-25 | Chose A's navigation with B's tile and type treatment. Payments keeps its tab; the sidebar and drawer are untouched |
| [x] | D25 | **"Available today" → offerings with an opening left today, top 3, soonest first** | You | ✅ DONE 2026-09-25 | Reuses the S3b occupancy RPC over a **capped** candidate set, so it stays off P10's cost curve. Proximity ordering dropped — see F37 |
| [x] | F25–F29 | Redesign findings: 12 logos for 13 divisions, unnormalised assets, no icon column or bucket, five grey divisions, the "available today" data wall | Me | ✅ DONE 2026-09-25 | Read the folder, the DB and `globals.css` rather than assuming the assets were a matched set |
| [x] | D18 | N1–N10 answered | You | ✅ DONE 2026-09-22 | Call vendor + photos added, price unit named, slot sort fixed, Inter name dropped, false "not charged" line replaced; N4 parked |
| [x] | S0 | Foundations: progress steps, countdown, division colours, search matcher, **contrast palette + guard test** (I1–I4, I22) | Me | ✅ DONE 2026-09-22 | Copy-back from the phone app + D17 colours. Verified: `npm test` **70/70** (was 36), `tsc --noEmit` clean, no new lint. Wiring the countdown into the two widgets is S2's |
| [x] | S1 | Data layer: booking fields, status history, catalogue, photos, staff, **paged `getBookings`**, **overnight sort fix**, **price-unit helper** (I5–I9, I23, I24, F17, G9) | Me | ✅ DONE 2026-09-22 | Both Home and Payments read these fields; paging removes the silent 1000-row cut |
| [x] | S2 | Home core: Needs you, Up next, My bookings + progress, booking detail with **Call vendor**, **photos** and corrected status wording (I10, N1, N2, N7, G5, G6, G8, I27) | Me | ✅ DONE 2026-09-22 | Replaces the two overlapping booking lists; N7's old line was false about money |
| [x] | S3 | Home side: Book again, 13 division shortcuts, compact Resume + Discard, guide for new bookers only (I11, I28) | Me | ✅ DONE 2026-09-22 | Low-risk widgets on S1 data |
| [x] | S3b-1 | Approve the counts-only occupancy function (I14) | You | ✅ DONE 2026-09-22 | Approved after the index check (`bookings_schedule_id_idx` exists) |
| [x] | S3b-2 | Write the migration file | Me | ✅ DONE 2026-09-22 | `20260922000001_slot_occupancy_rpc.sql`. Verified by reads only: every referenced object and column type exists; `get_slot_occupancy` not already defined. **Not executed** |
| [x] | S3b-3 | Apply the migration (local, then staging) | You | ⚠️ **LOCAL ONLY** (corrected 2026-09-27) | Recorded as done 2026-09-22 — `security definer`, `stable`, confirmed live — but that was **local**. `supabase migration list --linked` against staging (`fbxbwnfeimzhgxpshdpa`) on 2026-09-27 shows `20260922000001` with an empty remote column, i.e. never applied there. Staging is missing it *and* the new `20260927000001`. See Apply-D26 |
| [x] | S3b-3b | `supabase db reset` so history matches the condensed `20260922000001` (F24) | You | ✅ DONE 2026-09-22 | Verified after: no `anon` EXECUTE, history shows one migration, and the occupancy proof re-ran on the fresh seed |
| [x] | S3b-4 | Switch counts to the function; build "Open this weekend" (I12) | Me | ✅ DONE 2026-09-22 | Proved locally: a booker who sees 0 rows via RLS gets a count of 1 from the function. Fixes F1. Unknown counts now print no number at all |
| [ ] | S3b-5 | Staging check: a second booker's booking lowers "N left" | You | ⬜ TODO | Needs two real booker accounts in a live environment |
| [x] | S4 | Shell (sidebar drawer kept, TopBar search + titles, 4 tabs, Inter name dropped) + Explore + Bookings page + `payments` rename (I16, I13 part, I15 nav) | Me | ✅ DONE 2026-09-22 | 100/100 tests, `tsc` clean, build passes, lint at baseline. Nothing seen in a browser yet |
| [x] | S5 | Offering page **+ vendor page**: photos, staff, next open times, category/granularity chips, hours, agreements listed (D7, D8, D11, I25, I26) | Me | ✅ DONE 2026-09-22 | 100/100 tests, `tsc`, build clean, lint at baseline. Closes parity gaps 1 and 3. "Book this slot" still enters the old flow until S6 |
| [x] | S6 | Wizard starts at Schedule from the Offering page; Steps 1–2, map, geolocation, vendors service and dead types removed (I15, G10) | Me | ✅ DONE 2026-09-22 | 100/100 tests, `tsc`, build clean; lint 23 → 19 problems. Visual suite will fail until S7 (two gallery panes are gone) |
| [x] | S6-a | `npm uninstall leaflet react-leaflet @types/leaflet` | You approved · Me ran | ✅ DONE 2026-09-22 | Three dependencies gone from `package.json` and the lockfile; `npm ls leaflet` empty; `tsc`, 100/100 tests and `next build` all clean afterwards. An empty `node_modules/@react-leaflet/` folder survives `npm prune` — no files, not in the lockfile, harmless |
| [ ] | S6-b | Staging run-through: Explore → Offering → Schedule → Pay (PayMongo test mode) | You | ⬜ TODO | A real payment round trip needs staging keys and a browser |
| [x] | S9 | **Payments core:** money rules, Manila presets, honest totals, filters, month groups, 10-per-page (I17, I19, I20 part, I21) | Me | ✅ DONE 2026-09-25 | 114/114 tests, `tsc` clean, `next build` passes, lint unchanged at 19. Fixes F14. Old Transactions page deleted |
| [x] | S9b | **Payments receipt, CSV, print** (I18, I20 rest, first `@media print` block) | Me | ✅ DONE 2026-09-26 | 125/125 tests (11 new), `tsc` clean, `next build` passes, lint unchanged at 19. **F38**: no paid-at exists, so the CSV column is `booked_on`, not `paid_date` |
| [x] | F38 | No "paid on" timestamp in `bookings` | Me | ✅ DONE 2026-09-26 | Found in S9b. The export names the column for what it holds rather than claiming a date the system never recorded |
| [x] | S9c | Open an exported CSV in your spreadsheet; print a receipt | You | ✅ DONE 2026-09-27 | **Your acceptance**, not a machine check — CSV and print output judged on real software. ⚠️ Open question left from it: there is no per-receipt print action; **Print** produces the payments summary sheet (I20). Say if a one-page receipt print is wanted |
| [x] | S10 | **Redesign foundations:** icon resolver + `DivisionIcon` + fallback, five colour pairs + extended palette guard, normalised assets, display typeface, `HomeSection`, `StatStrip` (I29, I33–I35, I39, I40) | Me | ✅ DONE 2026-09-27 | 136/136 tests (22 new), `tsc` clean, `next build` passes, lint 19 unchanged. **F39**: two colour collisions caught by measuring — `work`/`pets` were 15 RGB apart. Now guarded by a test |
| [x] | S13 | **Collapsible sidebar** (I38, D30): hamburger toggles at every width, `sideOpen` defaults true, collapse remembered, `aria-expanded` | Me | ✅ DONE 2026-09-27 | 146/146, `tsc`, build, lint 19. F31's traps each grepped: no `lg:translate-x-0` when closed, default is `true`, scrim stays phone-only, no `setSideOpen(true)` left. Browser check is S7 |
| [x] | S10-a | Produce the 12 resized logo files | Me | ✅ DONE 2026-09-26 | **No new dependency**: used the Chromium that Playwright already installs. 4075 KB → 771 KB (81%). Capped at 512, never upscaled; the eight 256px files copied byte-identical (md5-verified) |
| [x] | S10-b | Decide on `ezzy_drive.png`'s "baked glow" | — | ✖ ABORTED 2026-09-26 | **Moot — my earlier claim was wrong.** Measured per pixel: the dark RGB sits under fully-transparent pixels, which every correct compositor ignores. See the correction on F26 |
| [x] | S11 | **Activity tab + navigation:** Activity page + segments, five widgets re-homed by `git mv`, `BookingsPage` deleted, `PageId` renamed (I31, I32) | Me | ✅ DONE 2026-09-27 | 136/136 tests, `tsc` clean, build passes, lint 19. **F32 held**: the Realtime `table: "bookings"` and 8 `.from("bookings")` calls untouched. **F40**: draft ownership moved to the shell |
| [x] | D26 | **"Popular" → most-booked offering over a window** (interim definition) | You | ✅ DONE 2026-09-25 | No ranking strategy exists yet, so the label means exactly what it says. Needs the counts-only function below |
| [x] | D27 | Section chrome: keep the pipe marker, drop the shadows, sections at **10px** radius against the hero's **18px + shadow** (untouched), phone sections inset | You | ✅ DONE 2026-09-25 | Amended the same day: squared entirely was a step too far, so the radius came back smaller. Two radii only, no third. Sidebar motif kept as drawn |
| [x] | D26-gate | **Approve the `get_popular_offerings` function** | You | ✅ APPROVED 2026-09-27 | Migration written: `20260927000001_popular_offerings_rpc.sql`. Three corrections vs the draft: `'rejected'` is not a status (and `refunded` was being counted), no caller gate, and it could rank a delisted offering |
| [x] | Apply-D26 | Apply `20260927000001` **and** the overdue `20260922000001` — local, staging, production | You | ✅ DONE 2026-09-27 | **I37 unblocked.** All three environments level; `migration list --linked` shows staging with **0 pending**. Verified on local by execution, not inspection: both functions `security definer` + `stable`, EXECUTE = `authenticated, postgres, service_role` — **no `anon`** (the F24 trap, closed). The caller gate refuses an unauthenticated caller; as a real active booker it returns ranked rows; the `p_until` and 366-day guards both raise. ⚠️ **The grants query has NOT been run on staging or production** — I have no SQL path to either, so that remains yours |
| [x] | I46 | Booker demo data (`demo/booker-demo-seed.sql` + teardown) | Me | ✅ DONE 2026-09-27 | **Run on local**: 3 schedules, 14 bookings, 6 statuses, 12 paid. **F59**: first run aborted on `check_booking_placement` — schedules started 30 days back, history reaches 84 — and the transaction rolled it back cleanly. Fixed and re-run. ⚠️ Still unrun on staging |
| [x] | F58 | **Three of Home's five shelves had never rendered** | Me | ✅ DONE 2026-09-27 | Found only by opening Home against real data. `loadCatalogue()` was called from `goExplore()` alone, so Popular, Available today and Vendors in your city silently showed nothing — two of them dead since S12. Fixed in `useAppShell`, gated on `loggedIn` (the first fix fired as `anon` and got a 401, looking identical on screen) |
| [x] | I37 | Build the Popular shelf | Me | ✅ DONE 2026-09-27 | 154/154 tests, `tsc`, build, lint 19, visual **73/73** with 2 new baselines. Count rendered, not implied. **F56**: the count's colour was 2.08:1 on dark — caught by measuring, fixed with the theme-flipping `-fg` token. **F57**: split out `PopularCardRow` so the fixture could cover it at all |
| [ ] | I47 | Give "Available today" a visual baseline (F57's other half) | Me | ⬜ TODO | The gallery's `home` pane passes an empty catalogue, so that shelf has been uncovered since S12 |
| [x] | I41 | Build the "Available today" shelf (capped candidate set + a test asserting the cap) | Me | ✅ DONE 2026-09-27 | Shipped in S12. `HOME_TODAY_CANDIDATES = 12`, and `openingsToday.test.ts` fails if the cap is removed — that test is what keeps it off P10's cost curve. *(This row read ⬜ TODO until 2026-09-27; the I41 section and the S12 row were already correct.)* |
| [x] | F37 | Proximity check: no coordinates, no PostGIS, no map, no geolocation | Me | ✅ DONE 2026-09-25 | Answered your radius question by reading the schema and the code, not from memory. → P11 |
| [x] | D28 | A booking's colour is its division's colour; status keeps its own palette | You | ✅ DONE 2026-09-25 | Thirteen brand colours, no fourteenth. Note: only two divisions have vendors today, so live Home stays near-monochrome until the catalogue widens |
| [x] | D29 | **Only the top stat strip** banded top + bottom, 3px, in its status colour | You | ✅ DONE 2026-09-25 | First drawn on every widget, then narrowed to the four summary cards. Asked for as "like the original / like vendor" — verified neither has it, so it ships as new, not a restoration |
| [x] | D30 | Sidebar collapses on desktop too; no icon-only rail; the phone drawer is untouched | You | ✅ DONE 2026-09-25 | Last design change before the pin |
| [x] | Pin | **Design pinned** — the canvas is the agreed target for Home and Activity | You | ✅ DONE 2026-09-25 | Five iterations, then frozen. Later changes are amendments to D21–D30, not new directions |
| [x] | F31–F36 | Code assessment against the pinned design | Me | ✅ DONE 2026-09-25 | Read the real files. Baseline measured: 114/114 tests, `tsc` clean. Found the `sideOpen` default trap and the `"bookings"` table-name collision |
| [x] | S12 | **The storefront Home:** hero + search, all-divisions grid, Available today, Book again, vendors in your city, in-progress strip (I30, I41) | Me | ✅ DONE 2026-09-27 | 146/146 tests, `tsc`, build, lint 19. **Popular shelf absent** — D26-gate unapproved. **F41**: the city had to be lifted to the shell. **F42**: a lint rule caught a cascading render I wrote |
| [x] | S7 | Polish: light + dark at 360/390/1280, contrast, keyboard, touch sizes, regenerate visual baselines — **now covers Payments, Home and Activity** | Me | ✅ DONE 2026-09-27 | 67 baselines re-recorded with the clock frozen; final suite **71/71, exit 0, zero hydration errors** (was 12). `tsc` clean, 146/146, lint 19. Fixed F43–F46, F48, F49, F50. Deferred with numbers: **I42**, **I43**. Your visual judgement is still S7-a |
| [x] | S14 | **D22-b: division tile rebuilt as one banded card** — tint across the tile, name in a `-deep` band, `DivisionIcon` `plain` variant, shared `data-division` colour map (F51) | Me | ✅ DONE 2026-09-27 | Matched against your reference at 1280 light/dark and 390. Suite moved only `home-light`/`home-dark`, both re-recorded → 71/71; `tsc`, 146/146, lint 19 |
| [x] | S7-d | Measured accessibility pass: every interactive box at 360/390/1280 in both themes, plus accessible names | Me | ✅ DONE 2026-09-27 | Ran against your :3000 dev server since Playwright could not start its own (S7-c). Found **F49** (two unnamed controls — fixed, zero pixel change) and **I43** (the sub-44px inventory — deferred, it is a design change) |
| [ ] | S7-a | Review the visual baseline diffs | You | ⬜ TODO | Baselines are committed, so each diff needs a real look. 62 changed + 12 new + 8 removed |
| [ ] | S7-b | **Approval gate:** two dead permissions in `next.config.ts` — the `TILE_HOST` in `img-src`, and `geolocation=(self)` in `Permissions-Policy` | You | ⬜ TODO | F44 + F54. Both were for the deleted map; nothing requests either since S6, and the `geolocation` comment still cites `hooks/useGeolocation.ts`, which no longer exists. Security-header changes, so not done unilaterally |
| [x] | S7-c | Stop the `next dev` on :3000 so Playwright can start its own | You | ✅ DONE 2026-09-27 | Your dev server (pid seen 2026-09-27 11:58, started from tmux) holds `booker/`, and Next 16 refuses a second `next dev` in the same directory — so the webServer on :3200 cannot start at all, whatever port is asked for. Not mine to kill. You stopped it; the suite then ran clean (71/71). Next 16 refuses a second `next dev` in the same directory, so this recurs whenever a dev server is up — worth remembering, not a defect |
| [x] | S8 | Docs: portals (incl. the Payments rename), booking flow, `booker/AGENTS.md`, schema F27 | Me | ✅ DONE 2026-09-27 | Six files rewritten from the **built code**, not the plan: `portals.md`, `booking-flow.md`, `schema.md`, `overview.md`, `conventions.md`, `booker/AGENTS.md`. Every claim grepped. Found **F52**, **F53**, **F54** |
| [ ] | I44 | Delete the two orphaned Home components (F52) | Me | ⬜ TODO | `DivisionShortcuts/`, `OpenSlotsCard/` — built by this plan in S10, superseded by S12, never removed |
| [ ] | I45 | Resume-draft card says "Step 2 of 6 — Pick a Vendor" (F53) | Me | ⬜ TODO | User-visible. `InProgressCard` still renders the six-step `PROG_STEPS` against a four-step wizard |
| [x] | Docs-0 | Pre-execution doc sync: booker `AGENTS.md`/`CLAUDE.md` rewritten; portals/booking-flow/schema corrected and given the known gaps F1–F3, F6, F14, F17; root `AGENTS.md` + overview point to the live mobile plan | Me | ✅ DONE 2026-09-21 | Verified by grep that every plan path referenced in the docs exists. You commit it |
| [x] | Git-S0 | Commit S0–S3 (booker repo) | You | ✅ DONE 2026-09-22 | `b726bac` "WIP: booker redesign" |
| [ ] | Git-S3b | Commit S3b + S4: `booker/`, `backbone/` (one migration), both plan files | You | ⬜ TODO | F24 is folded into that single migration |
| [ ] | Git | Commit each later stage | You | ⬜ TODO | You handle git |
| [ ] | P1 | "Near me" / real map | — | ⏸ PARKED | Vendors have no coordinates. Unblocked if proximity becomes a product goal |
| [ ] | P11 | **Proximity / radius filtering** ("offerings within 2 km") | — | ⏸ PARKED 2026-09-25 | F37: no lat/lng on `vendors`, no PostGIS or earthdistance, no geolocation left in the app, and the removed map never did distance anyway. Needs coordinates + geocoding + a Vendor-portal field + a distance query — its own plan. Supersedes P1 |
| [ ] | P2 | Retry payment for an unpaid booking | — | ⏸ PARKED | Could charge twice today (F3). Unblocked by a reviewed fix to the payment route |
| [ ] | P3 | Real URLs (browser Back, shareable links) | — | ⏸ PARKED | Keeping booker's single-page shell (D12) |
| [ ] | P4 | Staff email/phone readable by any active user | — | ⏸ PARKED | A database security fix outside booker (F6); this plan reads names only |
| [ ] | P5 | Booking by day / week / month | — | ⏸ PARKED | Existing Step 3 gap (D11); needs its own plan |
| [ ] | P6 | Server-side search | — | ⏸ PARKED | Client-side is enough for today's catalogue |
| [ ] | P7 | A real receipt number | — | ⏸ PARKED 2026-09-20 | The reference shown is a PayMongo session id, not a receipt number. Unblocked by a decision to store one (schema gate) |
| [ ] | P9 | Agreement acceptance at booking | — | ⏸ PARKED 2026-09-22 | Nothing records consent: `booking_acknowledgements` is written only by Vendor Kiosk Mode. Unblocked by a booker write path; mobile gates off the step it built (D20) |
| [ ] | P10 | Explore's "When" filter (Today / This weekend) | — | ⏸ PARKED 2026-09-22 | Needs one schedules query per result. Unblocked by a bounded per-page openings fetch or a server-side view; the Offering page shows real openings instead |
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
| [ ] | X14 | Direction B's three-tab navigation (Payments inside Activity, desktop top bar, sidebar removed) | — | ✖ ABORTED 2026-09-25 | Rejected with the design choice: it re-homes the finished S9 Payments page, edits the phone app's built tab bar, and retires the drawer that G1 exists to protect |
| [ ] | X15 | Ratings, promos, vouchers, favourites and "trending" on the new Home | — | ✖ ABORTED 2026-09-25 | No `reviews`, promotions or favourites tables exist. The brief forbids sections that imply features the product does not have |
| [ ] | X16 | Distance or "near me" on the storefront Home | — | ✖ ABORTED 2026-09-25 | Vendors have no coordinates (P1), so the shelf says "Vendors in <city>" and never a number of kilometres |
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
| I22 | `npm test`: `palette.test.ts` asserts every badge/muted pair ≥ 4.5:1 in both themes | Both themes eyeballed in S7 |
| I23, I24 | `npm test`: an overnight window orders 23:00 before 00:00; the price unit per duration unit | Slot grid checked against a real overnight schedule |
| I17–I19 | `npm test`: state per status × `is_paid`; totals exclude cancelled/unpaid; CSV quoting/BOM; Manila month boundaries | — |
| I20, I21 | `tsc` (the renamed `PageId` forces every reference), lint, Playwright baselines | Both themes at 390/1280: filters narrow the list, totals change with them, CSV opens in a spreadsheet with `₱` intact and amounts summing, receipt prints without the app chrome, pagination clamps |
| I15 | grep: no imports of the deleted modules; `tsc`; `leaflet` absent from the bundle after uninstall | End-to-end: Explore → Offering → Schedule → Pay on staging (PayMongo test mode) |
| I29 | `npm test`: every slug resolves, `ezzy-ride` falls back to a monogram, an unknown slug goes neutral, a future `icon_path` wins | The 12 tiles rendered in both themes — `food`/`learn`/`home` are near-black art and must stay legible on the tint |
| I30, I31, I32 | `tsc` (the `PageId` change forces every reference), lint, Playwright baselines; grep for the strings `dashboard` and `bookings` before the rename | Both themes at 360/390/1280: the tab bar does not overflow, a booking opened from a notification highlights Activity, Home renders with zero bookings and with a failed fetch |
| I33 | `npm test`: `palette.test.ts` covers the five new pairs **and** the white-on-band shade | Thirteen tiles side by side — five of them were one grey until now |
| I34 | Build output shows one self-hosted family; no `<link>` added | A real phone: no flash of unstyled text, and the Expo build still starts with the font gate |
| I35 | Each file ≤ one square master size; total Home image weight measured | The resized art next to the original at 1× and 3× |
| I38 | `tsc`, lint; grep that no branch of the `open` class expression still forces `lg:translate-x-0` | **A browser at ≥1280 and at 390**: collapse persists across a reload, the phone drawer and its scrim still work, and the first desktop visit starts expanded |
| I39, I40 | `tsc`, lint; grep that the stat-strip rule is not reachable from Home, and that no shelf hand-writes section chrome | Both themes: five shelves read as five, and the strip still reads as a strip |

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
- (o) `getBookings()` left unpaged, so totals understate past 1000 rows (F17);
- (p) a division's icon hardcoded per tile, or keyed on `name` instead of `slug`, so the Command feature becomes a rewrite (D23);
- (q) the grid hardcoding 12 or 13 tiles instead of rendering what the list holds;
- (r) the monogram fallback left untested because `ezzy-ride` happens to be off-screen (F25);
- (s) the tile tint themed dark, which hides the three near-black logos (F26);
- (t) a widget "moved" to Activity by being rewritten, losing the hook and tests it already had (D21);
- (u) an "Available today" shelf shipped with a per-offering schedules query, which is what parked P10 (F29);
- (v) Home rendering an empty box where a booker's history would be, instead of hiding the section;
- (w) a "Popular" heading over anything that is not an actual count — a hand-picked list, or a client-side count that RLS
  silently reduces to the booker's own bookings (F30, D26);
- (x) section chrome pasted inline per shelf instead of one shared rule set, so a D27 radius change has to be edited five times;
- (y) a third radius appearing on Home — D27 allows exactly two, 10px for a section and 18px for the hero.
- (z) a booking tinted by anything other than its division — a per-status row wash, or a rotating palette — which collides with
  the status pill and invents colours the brand does not have (D28);
- (aa) section artwork drifting behind the body text instead of staying on the header, or the arc/stroke band being left
  full-width instead of confined to the end of the header (D27);
- (ab) curves spreading past the two places D27 allows them — the section header and the sidebar panel.
- (ac) the Activity band painted a decorative colour instead of the card's status colour, applied to widgets below the summary
- (ad) the sidebar collapse shipped as CSS alone, leaving `sideOpen` defaulting to `false` so every desktop session starts
  collapsed (F31), or the `lg:hidden` scrim widened so a desktop collapse dims the page;
- (ae) `"bookings"` renamed by find-and-replace, hitting `.from("bookings")` in the service and the payment webhook (F32);
- (af) a re-homed widget "moved" by being rewritten, losing the hook and tests it already has (D21, F33).
  strip, or leaking onto Home's shelves — each of which erases what the band is for (D29).
