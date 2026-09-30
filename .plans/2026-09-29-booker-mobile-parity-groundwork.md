# Ezzy Booker Mobile — parity groundwork and the web carry-over ledger

**Date:** 2026-09-29
**App / scope:** the **web ↔ React Native contract** for `booker/` and `ezzy-booker-mobile/`, plus the ledger of web redesign work still to be carried onto the phone app. **Reference and coordination only — this plan builds nothing itself.**
**Status:** DRAFT — **one decision is OPEN (D1)**. No item here may execute while it remains.

> Split out of `.plans/2026-09-18-booker-home-search-redesign.md` on 2026-09-29 on the user's
> instruction, so the web plan holds only web work. Everything about the React Native app —
> the parity contract, the briefing the phone app gave web, and every unshipped carry-over —
> lives here.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** C# = carry-over item, D# = decision, N# = a finding mobile gave web
> (numbers preserved from the redesign plan so existing references still resolve). Numbers are
> plan-local — qualify cross-plan refs by app.

---

## ⚠️ Read this first: how this plan relates to the other three mobile plans

Four plans touch `ezzy-booker-mobile`. They are **not** interchangeable, and this one deliberately
builds nothing, so that no two plans own the same code:

| Plan | Status | What it owns | Relationship to this plan |
|---|---|---|---|
| `2026-09-21-booker-mobile-app.md` | COMPLETE 2026-09-22 | The original RN build on **mock data** (M1–M9) | Source of the briefing below. Done |
| `2026-09-25-booker-mobile-redesign.md` | **DRAFT, unapproved** | **The RN screen build** for the pinned Home/Activity redesign (its own R-stages and M-items) | ⚠️ **The build stages belong there, not here.** This plan supplies the contract and the delta list it must satisfy |
| `2026-09-22-booker-mobile-real-data.md` | DRAFT, D1–D7 OPEN | Sign-in, Supabase, payment on RN | Depends on web W1/W2/W6 — tracked below |
| **this plan** | DRAFT | The **contract** + the **carry-over ledger** | The shared reference the three above check themselves against |

⚠️ **Judgment call, flagged for the user (2026-09-29).** `2026-09-25-booker-mobile-redesign.md`
already covers "carry the pinned redesign onto the phone app", so a fifth plan repeating its
stages would be a duplicate. The split chosen instead: **contract and deltas here, screen build
there.** If you would rather fold this file into that plan, say so — it is a merge, not a rewrite.

---

## What is NOT in scope here

- **Any `booker/` web change.** The web redesign is `.plans/2026-09-18-booker-home-search-redesign.md`.
- **Any live-environment check.** Those moved to `.plans/2026-09-29-booker-live-verification.md`.
- **Writing RN screens.** That is the 09-25 redesign plan's R-stages.
- **`ezzy-vendor-mobile`.** A different app with its own plans.

---

## CARRY-OVER LEDGER — web work not yet on the phone app

⚠️ Every item below shipped on **web** after the parity contract's last amendment (2026-09-25),
so the contract's tables do not yet describe them. Until each is either carried across or added
to mobile's `§4 Web → native differences` with a reason, **the two clients are out of contract.**

### C1 — D22-c: division tiles are circles with the name beneath  ⬜ TODO
**Web state (shipped 2026-09-28):** `booker/components/home/HomePage/HomePage.module.css:*` —
`.tileDisc` is an 84px disc (`border-radius: 999px`) with a 46px mark, and `.tileName` sits
beneath it in `--division-fg`. At `max-width: 640px` the grid goes to 4 columns with 58px discs,
32px icons and 10px labels.
**Supersedes** the contract's "tile = tint + white-on-deep name band" row (D22-b), which mobile
would otherwise still build.
**Carry approach:** RN has no CSS custom properties, so `var(--division-tile)` cannot cross.
The disc is `StyleSheet` geometry; the palette becomes the TS lookup in C2.
**Verification:** side-by-side screenshot against web at 390px — machine-checkable only as a
render test; the visual match is a human check.

### C2 — D22-d: division colours derived from the logos  ⬜ TODO
**Web state (shipped 2026-09-29):** `booker/app/globals.css` — `--div-*-tile`, `--div-*-deep`
and `--div-*-label` for ten divisions, canvas-sampled from the logo PNGs with an alpha gate, then
darkened until white-on-deep clears **7:1** (lowest 7.03) and every label pair was contrast-measured
in both themes. Food/Stay/Ride/none keep hand-picked values.
⚠️ **This replaces the values mobile currently holds.** `ezzy-booker-mobile/src/theme/divisionPalette.ts`
and `src/lib/divisions.ts` carry the pre-D22-d palette, and the contract's Division-colours row
still names web `globals.css` as the source of truth — which is now correct but *changed*.
**Carry approach:** port as a slug-keyed object, light and dark, and keep mobile's existing
`divisions.test.ts` contrast assertion — it already asserts every pair ≥ 4.5:1, so it will catch a
bad transcription. Raise its bar to the 7:1 that web now holds for white-on-deep.
**Verification:** machine-verifiable — mobile's own contrast test, plus a value-by-value diff
against `globals.css`.

### C3 — I48: the "Available today" card  ⬜ TODO
**Web state (shipped 2026-09-29):** `booker/components/home/OpenTodayCard/` — 110px panel (photo
or the division mark at 0.5 opacity), division pill on `--division-deep`, name, vendor · city,
slot · duration, then price against a **Book affordance**.
⚠️ **The affordance is an `aria-hidden` span, not a button** — a `<button>` inside a `<button>` is
invalid HTML on web. RN has no such constraint, but **copying the artboard's real button would
diverge behaviourally**: web opens the offering page (D1's entry point) rather than jumping into
the wizard. Mobile must open the offering too, or this becomes a §4 divergence needing a reason.
**Verification:** human — the flow question is a design check, not a test.

### C4 — F63: vendor's branding in booker  ⬜ TODO
**Web state (shipped 2026-09-28):** `booker/components/ui/BrandLogo/`, `app/icon.svg`,
`app/favicon.ico`, `app/apple-icon.png`, `public/icons/icon-{192,512,maskable-512}.png` — copied
byte-identical from `vendor/` and md5-verified.
⚠️ `BrandLogo`'s `variant="mark"` is single-ink brand blue `#034bfc`, deliberately **not**
`currentColor`, which is why the blue containers behind it had to be removed on web. Mobile will
hit the same trap.
**Carry approach:** RN app icons are `app.json` config, not files in a route folder — this is not
a copy. See `.plans/2026-07-30-vendor-mobile-brand-assets.md` for how the vendor app did it.
**Verification:** human — icon rendering on a device.

### C5 — the three colourless divisions  ⏸ PARKED (2026-09-29)
Three divisions have no logo to sample, so C2's derivation leaves them on neutral values.
**Why parked:** the user decided on 2026-09-29 not to plan a logo redraw ("No, do not include
that in the plan. We are good for now"). **Unblocks** when those logos exist.
⚠️ Recorded so C2's ten-of-thirteen coverage is not mistaken for a transcription bug.

### C6 — I43 tier 2: all touch targets ≥ 32px  ⬜ TODO — **see D1, this item has no confirmed owner**
Web shipped **tier 1** (everything failing WCAG 2.2 AA's 24×24 minimum) on 2026-09-27 and the
redesign plan recorded tier 2 as "deferred to the mobile plan".
⚠️ **That deferral is ambiguous and may have mislaid a web obligation** — see D1.

---

## DECISIONS

<!-- No item in this plan may execute while an OPEN: line remains — plan-authoring §7. -->

- OPEN: **D1 — who owns I43 tier 2 (all interactive targets ≥ 32px)?** The redesign plan deferred
  it "to the mobile plan", but that plan's scope line reads *"./ezzy-booker-mobile. **Nothing
  else.** No `booker/`"* — so if tier 2 was meant to cover **booker web's phone viewport**, it
  currently has no owner anywhere and would be silently dropped. Web is at AA (24×24) today, not
  the 44×44 of AAA 2.5.5.
  **Options:** (a) tier 2 means the RN app only — keep C6 here, and web stays at AA deliberately;
  (b) tier 2 covers both clients — C6 stays here **and** a web item goes back to the redesign
  plan; (c) drop tier 2 — web and mobile both sit at AA.
  **Recommendation: (b).** A 24px target that passes AA is still small under a thumb, and the
  phone viewport of the *web* app is reached by real phone users today, whereas the RN app is
  still on mock data. Cheap to do while the tiles are being touched.

---

## Verification and its limits

| Item | Machine-verifiable | Needs a human or a device |
|---|---|---|
| C1 | a render test at 390px | whether the disc **looks** like web's |
| C2 | mobile's `divisions.test.ts` contrast bar; value diff vs `globals.css` | — |
| C3 | that the card renders | the open-the-offering flow decision |
| C4 | md5 of copied assets | icon on a device |
| C6 | measured box sizes, as web's `a11y-audit.mjs` does | — |

⚠️ **The RN app is on mock data** (root `AGENTS.md`), so every item above renders against fixtures,
not real `divisions` rows. Nothing here proves behaviour against the database.

---

## Execution order

**Blocked: resolve D1 first.** Then, and only after `2026-09-25-booker-mobile-redesign.md` is
approved and its Home is re-homed — carrying a tile system onto a screen that has not been rebuilt
would mean doing it twice:

1. **C2** (the palette) — everything else references it, and it is the one item that is fully
   machine-verifiable.
2. **C1** (the disc) — depends on C2's tokens.
3. **C3**, **C4** — independent of each other.
4. **C6** — after D1 says who owns it.

---

## Big table

| Done | ID | What | Who | Status | Why / reason |
|:-:|---|---|---|---|---|
| [ ] | D1 | **Who owns I43 tier 2 (≥32px targets)** | You | ⬜ **OPEN — blocks this plan** | The redesign plan's "deferred to the mobile plan" may have mislaid a **web** obligation. Recommendation (b): both clients |
| [ ] | C1 | D22-c circle tiles onto RN | Me | ⬜ TODO | Supersedes the contract's banded-card row. Needs the 09-25 plan approved first |
| [ ] | C2 | D22-d logo-derived palette onto RN | Me | ⬜ TODO | Mobile holds the **pre-D22-d** values. Do first — fully machine-verifiable |
| [ ] | C3 | I48 "Available today" card onto RN | Me | ⬜ TODO | ⚠️ Must open the offering page, not the wizard, or it is a §4 divergence |
| [ ] | C4 | F63 branding onto RN | Me | ⬜ TODO | RN icons are `app.json`, not a file copy |
| [ ] | C5 | Three divisions with no logo to sample | — | ⏸ PARKED 2026-09-29 | Your call: no logo redraw for now. Unblocks when the logos exist |
| [ ] | C6 | I43 tier 2 — targets ≥32px | Me | ⬜ TODO | Owner unconfirmed — gated on D1 |
| [ ] | Parity | Per-stage check against mobile's matching P# section | Me | ⬜ TODO | Moved from the redesign plan 2026-09-29. A new difference is justified in mobile §4 or fixed |
| [x] | Brief | Read and **verify** the ezzy-booker-mobile briefing | Me | ✅ DONE 2026-09-22 | 111/111 mobile tests pass; `slots.ts` diff identical; N3, N5, N6, N9, N10 confirmed by code read and contrast measurement |
| [x] | Contract | The parity contract, written into both plans | 🤝 | ✅ DONE 2026-09-22, amended 2026-09-25 | ⚠️ **Not amended for D22-c, D22-d, I48 or F63** — that gap is exactly C1–C4 |

---

## Moved from the web redesign plan — the two reference sections

Both sections below were written in `.plans/2026-09-18-booker-home-search-redesign.md` and moved
here **verbatim** on 2026-09-29. They are the record of what the phone app taught web (the
briefing, N1–N10) and of what the two clients owe each other (the contract). ⚠️ The contract's
tables are accurate up to its 2026-09-25 amendment and **no further** — C1–C4 above are the delta.

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
| Font | ⚠️ **AMENDED 2026-09-29 — the clients are deliberately OUT OF CONTRACT on this row.** Web: **Poppins**, the single family for body *and* headings, self-hosted via `next/font` (`.plans/2026-09-29-booker-poppins-base-font.md` D1/D2 — 400/500/600/700/800 preloaded, 400 italic on demand). Mobile: **still the system stack**, unchanged. | web ✅ 2026-09-29 (that plan's S2); mobile ⬜ — its own plan, not started. Mobile's **D9 is NOT reversed** and no RN file was touched. Until mobile adopts Poppins the two clients differ **on purpose**, the same way D22-c/D22-d/I48/F63 sit out of contract above |
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
| Display typeface | ⚠️ **AMENDED 2026-09-29 — there is no longer a separate display face on web.** Bricolage Grotesque was removed and Poppins carries the headings too, so this row and the Font row above are now one decision, not two (`.plans/2026-09-29-booker-poppins-base-font.md` D1/I2, superseding redesign D22/I34). | an Expo font asset gated on `useFonts`, **if and when mobile adopts it** | ⚠️ Still **reverses mobile's D9**, which uninstalled `@expo-google-fonts/inter` deliberately — mobile must record the re-add rather than have it appear, and it is now Poppins that would be added, not Inter or Bricolage |
| "Available today" | per **D25**, still open | whatever D25 decides | **Must not diverge.** Mobile waits for D25 too |

Mobile's plan gets the same amendment in its §4b. Nothing above may be implemented on one client only.


---
