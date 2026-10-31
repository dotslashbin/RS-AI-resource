# Booker — square photos on Home, sidebar tagline, carousel autoplay on phones

**Date:** 2026-10-30
**App / scope:** booker/ web only — `components/home/OpenTodayCard/`, `components/home/PopularShelf/`, `components/home/ShelfCard/`, `components/layout/Sidebar/Sidebar.tsx`, `components/home/PromoCarousel/usePromoCarousel.ts`, plus `app/ui-gallery/page.tsx`, `visual-tests/` and baselines. No vendor, command, Expo, schema, RLS, env or dependency change.
**Status:** COMPLETE (2026-10-30) — release: staging ✅ · production ✅ (Vercel Promote by the user, 2026-10-30; production check skipped by the user's decision)

> Three follow-ups from the user (2026-10-30): (1) the square photo look from Explore
> (`.plans/2026-10-30-booker-offering-photo-square.md`) on every Home card that shows an offering;
> (2) the sidebar tagline becomes "Connect. Book. Grow."; (3) find out why a stakeholder saw the
> promo carousel not sliding on a phone, and fix what is a real bug.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision, F# = Finding, E# = carousel
> experiment (2026-10-30), V# = visual check run by the agent, S# / P# = staging / production
> release step. Numbers are plan-local. "photo plan I1" = the Explore square-photo plan above.

---

## ▶ RESUME HERE (updated 2026-10-30, plan COMPLETE)
- **Done:** every stage. In production via the user's Vercel Promote (2026-10-30), shipped in the same Promote as
  `2026-10-30-booker-offering-photo-square.md`.
- **Live where:** local ✅ · staging ✅ · production ✅.
- **Left open:** No open findings: F3 and F4 were closed by the user as passes.

---

## Investigation

### Home surfaces that show an offering photo (read 2026-10-30)
| Section | Component | Photo box today | File |
|---|---|---|---|
| Available today | `OpenTodayCard` | 110px band (88px at ≤640px), full card width | `OpenTodayCard.module.css:25–33`, `:126–131` |
| Popular this month | `PopularCardRow` | 78px wide, stretched to the card height (≈96px): a tall rectangle | `PopularShelf.module.css` `.art` (`width: 78px`) |
| Near you | `ShelfCard` (offering rows) | 44×44, `border-radius: 20px`, which reads as a circle | `ShelfCard.module.css` `.thumb` |
| Book again, Vendors in <city> | `BookAgainCard`, `ShelfCard` (vendor rows) | **no photo** (booker-ui D1) | out of scope |

Grids: "Available today" is `repeat(auto-fill, minmax(min(290px, 100%), 1fr))` in a 1080px page, so
three columns of about 330px on desktop and one column at 390px (`HomePage.module.css:178–182`).

### Carousel on a phone: experiments (2026-10-30)
Read-only. Run against the gallery's `promoautohidden` (2000ms, no pause/play button: the
**shipped** config, `lib/promoSlides.json` → `showPlayPauseButton: false`). Headless Chromium at
390×844 with `isMobile` + `hasTouch`, in real time, with touch gestures sent through CDP.

| # | What the phone does | Slides seen in 7s | Reading |
|---|---|---|---|
| E1 | Nothing | 0→1→2→0 | ✅ Autoplay works on a phone |
| E2 | Reduced motion on (iOS Reduce Motion, Android "Remove animations", some battery savers) | 0 | Never starts, **and there is no Play button** (F1) |
| E3 | Vertical page scroll that starts on the banner | 0→1→2→0→1 | ✅ Unaffected (`pointerleave` fires after `pointercancel`, E6) |
| E4 | Same, with 25px sideways thumb drift | 0→1→2→0→1 | ✅ Unaffected |
| E5 | One deliberate swipe | 1 | Stops until reload, **by design** (carousel plan D3) (F2) |
| E7 | **Tap a banner → partner site opens in a new tab → come back** | **0** | ❌ **BUG**: the tapped link keeps focus, and focus holds autoplay (B1) |

---

## BLOCKERS

### B1 — Autoplay freezes after a booker taps a banner and comes back  ✅ DONE (2026-10-30)
**File:** `booker/components/home/PromoCarousel/usePromoCarousel.ts:185–188` (`onFocus`), used by the tick at `:176`.
**Gap:** `onFocus` sets `focusRef.current = true` for **any** focus inside the carousel, so the tick
skips forever. On Android Chrome, tapping a banner focuses its `<a>` (`target="_blank"`,
`PromoCarousel.tsx:78`). The partner site opens in a new tab, and when the booker switches back
the link is still focused, so the carousel never moves again until they tap somewhere else.
Reproduced as E7. The hold exists for **keyboard** users (2026-10-28 carousel plan), whom an
advancing slide would disorient. A pointer or touch focus has no such reason.
**Fix approach:** hold only for keyboard-style focus:
`focusRef.current = e.target !== toggleRef.current && (e.target as Element).matches(":focus-visible")`.
Chromium does not match `:focus-visible` for a link focused by tap or click, but does for Tab. One
line, no new state. `onBlur` is unchanged.
**Component separation:** the change stays inside the hook. `PromoCarousel.tsx` is untouched.
**Verification:** machine — a new `promo.spec.ts` test: in a `hasTouch` context, tap a banner link
(with the popup routed to a stub), close the popup, and autoplay advances. The existing "focusing a
link holds autoplay" test must still pass, which keeps the keyboard hold. Re-run E7 → slides advance.
Live — staging on an Android phone (S4).
✅ **Executed 2026-10-30.** The test came first: `promo.spec.ts` "phone: tapping a banner does not freeze
autoplay…" (`hasTouch` context, partner link answered locally) **failed before the fix** (expected
slide 1, got 0), which reproduces the bug. Fix: `onFocus` holds only when the target matches
`:focus-visible` (`usePromoCarousel.ts`). **Verified:** `promo.spec.ts` 26/26, including the existing
keyboard "focusing a link holds autoplay" test. E7 re-run: 0→1→2→0→1 (it was 0). E1–E6 unchanged.
Android on staging is still to do (S4).

## IMPORTANT

### I1 — "Available today": square cover, phone row  ✅ DONE (2026-10-30)
**Files:** `booker/components/home/OpenTodayCard/OpenTodayCard.module.css` only.
**Fix approach (if D1 = A):** the same pattern as photo plan I1.
- `.panel`: `height: 110px` → `aspect-ratio: 1 / 1`. The ≤640px `height: 88px` is replaced.
- ≤640px: `.card` becomes `display: grid; grid-template-columns: 112px minmax(0, 1fr)`, with
  `.panel` as a 112px square beside `.body`. `.body` already holds the name, vendor, slot and the
  price/Book footer, so no markup change is needed.
- The no-photo state (a 56px mark at 0.5 opacity) is already centred. On the phone thumbnail the
  mark keeps its existing 46px.
- The division badge (`.badge`, bottom-right over a photo) stays. Check it fits the 112px thumbnail.
**Component separation:** CSS only. `OpenTodayCard.tsx` stays a pure display component.
**Verification:** `opentoday-*` baselines regenerated and read by eye, plus a new narrow mode
(`opentodaynarrow`, single column, in the `NARROW` loop, the same reasoning as photo plan I2), and V1.
✅ **Executed 2026-10-30.** `.panel` uses `aspect-ratio: 1 / 1`. At ≤640px the card is a grid with a 112px
panel beside the body, and the markup is unchanged. **Found while building:** in the phone row,
"₱1,200.00" broke after the peso sign beside Book. Fixed with `.price { white-space: nowrap }` at
≤640px, checked at 320px (no overflow, price on one line). **Simpler than planned:** there is no
`opentodaynarrow` mode. The `opentoday` fixture already uses Home's `auto-fill` grid, so it was
added (with `popular` and `nearyou`) to the 390px `NARROW` loop as is. Measured: 387×387 at 900px,
112×112 at 390px. Baselines `opentoday-*` plus the new `opentoday-narrow-*` were read by eye.
⚠️ V1 could not show it with real data: there are no openings locally today.

### I2 — "Popular this month": square photo panel  ✅ DONE (2026-10-30)
**File:** `booker/components/home/PopularShelf/PopularShelf.module.css` `.art`.
**Fix approach (if D2 = A):** `.art`: `width: 78px` → `width: 96px; aspect-ratio: 1 / 1;
align-self: flex-start`. The card is already about 98px tall (96 + border), so rows do not grow. A
short card does not get a stretched rectangle.
**Verification:** `popular-*` baselines regenerated and read, plus V1.
✅ **Executed 2026-10-30.** `.art` is 96px with `aspect-ratio: 1 / 1; align-self: flex-start`. **Plus:** the
≤640px `.art { width: 64px }` override was removed. With it, the phone showed a 64px square under a
95px card. Measured: 96×96, card 99px (desktop) / 98px (phone, was 95). `popular-*` plus the new
`popular-narrow-*` were read. V1: a real photo crops cleanly.

### I3 — "Near you": square-cornered thumbnail  ✅ DONE (2026-10-30)
**File:** `booker/components/home/ShelfCard/ShelfCard.module.css` `.thumb` (photo only).
**Fix approach (if D3 = A):** `border-radius: 20px` → `10px`, so the 44px photo reads as a rounded
**square** instead of a circle. The same 44px box, so rows do not shift. The vendor rows' marks are
not `.thumb` and are unaffected.
**Verification:** `nearyou-*` and `homenear-*` baselines regenerated and read, plus V1.
✅ **Executed 2026-10-30.** `.thumb` `border-radius: 10px`. `nearyou-*` plus the new `nearyou-narrow-*` were read.
`homenear-*` passed **unchanged**: its fixture passes no photos, so no `.thumb` renders there. V1:
four real rows, three with photos, radius 10px asserted.

### I4 — Sidebar tagline: "Client Portal" → "Connect. Book. Grow."  ✅ DONE (2026-10-30)
**File:** `booker/components/layout/Sidebar/Sidebar.tsx:59`. This is the only occurrence in booker,
checked by grep.
**Decision:** the user's, 2026-10-30 ("I remembered that I needed that sidebar … Simply change the
'Client Portal' to 'Connect. Book. Grow.'"). It supersedes the descriptor set in
`2026-10-25-booker-visible-branding-cleanup.md` E2. That plan is not edited.
**Fix approach:** text only. The same edit the user reverted earlier today (photo plan F10).
**Verification:** `sidebar-light` / `sidebar-dark` regenerated, about 890 px different as measured
before, and read by eye to confirm the tagline fits on one line.
✅ **Executed 2026-10-30.** `Sidebar.tsx:59`. `sidebar-*` were regenerated and read, and the tagline fits on one line.
V1 (phone): the text is visible in the opened sidebar.

### I5 — Phone row: the square photo fills the left side  ✅ DONE (2026-10-30)
*Added 2026-10-30 at the user's request, with a screenshot of "Available today" on a phone.*
**Files:** `booker/components/home/OpenTodayCard/OpenTodayCard.module.css` (≤640px block) and
`booker/components/explore/OfferingResultCard/OfferingResultCard.module.css` (≤640px block, from photo plan I1).
**Gap:** both phone rows put a **112px square at the top** of a card about 150px tall (the text column
is taller), so an empty strip shows under the photo. Preview screen 1 shows it.
**Fix approach (if D5 = A):** the first column becomes `136px`, and the cover a 136px square stretched
to the row. The text column is held to that height: one line per row with `white-space: nowrap` +
ellipsis (`.name` on Explore; Home's are already nowrap), Explore's name and price stacked, and
padding tightened as in preview screen 2. **Re-measure with Poppins**: if a card's text column is
taller than 136px, the photo leaves a gap again. V1 asserts card height = 136 ± 2 and
`body.scrollHeight ≤ clientHeight` on every card.
**Component separation:** CSS only. No `.tsx` change for I5.
✅ **Executed 2026-10-30, with the D7 trims (F5).** Explore: 136px column, cover spans both rows, name on one
line, category hidden on phones, "No dates yet" takes its line (`.chipLine`), body padding `7px 12px 3px`.
Home: 136px column; the slot line is `display: block` with an ellipsis; price 15px, Book 30px tall.
At ≤360px the photo is **124px**, the text column's measured height there (123px).
**Deviation from D7's wording:** Book is hidden by a **container query** (`.body` is a size container at
≤640px; `@container (max-width: 129.98px)`), not by a ≤360px viewport rule, because a viewport rule
clipped Book at 390px in the gallery (the column depends on section padding and price length). It is the
first container query in booker. On the real page (+26px over the gallery) Book shows from about 360px,
which matches D7's intent.
**Verified (gallery, Poppins):** photo = card − 2px at 390/375/360/320 in both themes; Book never clipped.
**V1 (real Explore, 1280/390/375/360/320 × light/dark, 4 real photos):** square, fills, no overlays, no
spill, no overflow: **10/10 ok**. Home "Available today" is **not** covered (no local openings).

### I6 — Nothing drawn on a photo; pill and logo only without one  ✅ DONE (2026-10-30), PHONES ONLY
*Added 2026-10-30 (user): "if there is a picture for an offering, the picture container should not show
any pill or default division logo. We only use that for when there is no picture in place."*
**Files:** `OpenTodayCard.tsx:65–72` (the logo badge, drawn **only** over a photo today) and
`OfferingResultCard.tsx:89` (`.division` pill, always drawn) and `:101` (`.unbookable` chip, on the cover).
**Fix approach:**
- `OpenTodayCard`: remove the badge (`photo && vendor?.divisionSlug && …`) and its `.badge` CSS. The
  no-photo state already shows only the faded mark. ⚠️ This **reverses** booker-ui plan I1's "logo-only
  badge on the photo", by the user's decision of 2026-10-30. The badge's `title` was the only text
  naming the division on that card, so the division stays reachable through the offering page;
  "Available today" cards carry no division text otherwise (accepted, as in the preview).
- `OfferingResultCard`: render `.division` **only when there is no photo**. The division is still
  named in the card's footer (`.foot`), so nothing is lost. Per D6, the "No dates yet" chip moves
  into the footer row when there is a photo.
- Remove whatever CSS becomes unused.
**Component separation:** both components stay pure display (conditions on props only). Styling stays
in their `.module.css`.
✅ **Executed 2026-10-30.** `OpenTodayCard.tsx`: the badge and its unused `divisionLabel` import are removed,
and `.badge` CSS is deleted. `OfferingResultCard.tsx`: `.division` and `.unbookable` render only
`!photo`. The footer is wrapped in `.footRow` with `.chip.chipFoot` (desktop, D6) and `.chip.chipLine` in
the body (phone, D7). Exactly one is displayed (the other is `display: none`, so it is announced once).
`cn` is imported. **Verified:** gallery and V1 assert no overlay on any photo, and no-photo cards keep the pill.
↩ **Rescoped to phones, 2026-10-30 (D-overlays-scope).** The user found the desktop look changed. As first
built, the overlays were removed at every width. Now: `OpenTodayCard.tsx` is **identical to the committed
version** (badge restored), and `.badge` is hidden in a ≤640px block placed **after** the base rule.
`OfferingResultCard.tsx` is restored to the committed markup plus three phone-only hooks: `hasPhoto` on
the cover, `category` on the category line, and `.chip.chipLine`. The `.footRow` wrapper and the desktop
footer chip are **removed**. At ≤640px, `.hasPhoto .division` and `.hasPhoto .unbookable` are hidden.
**Verified desktop unchanged:** the committed `opentoday-light/dark` and `resultcard-light/dark` baselines
were restored from HEAD and their tests **passed 4/4 without regeneration** (`maxDiffPixels: 0`), so
desktop is pixel-identical to the approved look. Phones: row-measure, all phone captures ok (fill, no
visible overlay, Book not clipped). V1 real Explore: phone 8/8 no overlay; desktop 2/2 pill present on photos.

### I7 — Tests and baselines for I5–I6  ✅ DONE (2026-10-30)
`resultcard*`, `resultcardunbookable*`, `resultcardnarrow-narrow-*`, `opentoday*`, `opentoday-narrow-*`
regenerated in a scoped run and read by eye. Full suite. V1 re-run on Explore and Home with the I5
height assertion.
✅ **Executed 2026-10-30.** `resultcardunbookable` gained a photo + "No dates yet" card (desktop D6, not
covered before). Scoped regeneration `--grep "ui-gallery (resultcard|opentoday)"`: 10 passed. All read by eye.
**Full suite 184/184.** `tsc` 0, `npm test` 323/323, lint 18 (unchanged).
**After the phones-only rescope (2026-10-30):** only `opentoday-narrow-*`, `resultcardnarrow-narrow-*` and
`resultcardunbookable-*` differ from HEAD. The last is the added photo + "No dates yet" card, which now shows
the chip **on the photo** on desktop. Desktop `opentoday-*` and `resultcard-*` equal HEAD. Full suite
**184/184** again. `tsc` 0, `npm test` 323/323, lint 18. Gallery fixtures already have photo and no-photo cards, and `resultcardnarrow` has
a photo card with "No dates yet", which exercises D6.

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains — see §7. -->
- **D-tagline — sidebar text** → **"Connect. Book. Grow."** (resolved 2026-10-30, user).
- **D1 — "Available today" on a phone** → **A, like Explore** (resolved 2026-10-30, user). (A) **The same as Explore**: a 112px square
  thumbnail beside the text, with a square cover on desktop · (B) a full-width square, about 358px
  tall per card. *Recommend A.* It matches the Explore decision the user approved (photo plan D1),
  and Home stays scannable.
- **D2 — "Popular this month" panel size** → **A, 96px square** (resolved 2026-10-30, user). (A) **A 96px square**, the card's current height,
  so rows do not grow · (B) a 78px square, which leaves the card taller than its photo.
  *Recommend A.*
- **D3 — "Near you" 44px thumbnail** → **A, 10px radius** (resolved 2026-10-30, user). It is already a square box, but its 20px radius makes it
  look round. (A) **10px radius**, a rounded square · (B) leave it. *Recommend A* if "square look"
  includes this one. Otherwise B, and I3 is ✖.
- **D4 — Reduced-motion phones (F1)** → **A, leave it**; ask the stakeholder about reduce motion / battery saver (resolved 2026-10-30, user). (A) **Leave it**: autoplay stays off when the phone asks
  for reduced motion, as the carousel plan designed, and you ask the stakeholder whether Reduce
  Motion or a battery saver is on · (B) set `"showPlayPauseButton": true` in `lib/promoSlides.json`,
  so those bookers get a Play button to start it (a config line, no code). *Recommend A.* Respecting
  the setting is the accessible default, and the button was hidden on purpose on 2026-10-29.

- **D-overlays-scope — PHONES ONLY** (resolved 2026-10-30, user, after checking locally: "I think you undid
  what was for web … apply that one to mobile only. The previous web look was already good"). I6 as first
  built removed the overlays at **every** width. Desktop is restored to the committed look: the logo badge on
  "Available today" photos, the division pill and "No dates yet" on Explore photo covers. Only ≤640px hides
  them. D6's desktop chip-beside-the-label placement is therefore ✖ (desktop keeps the chip on the cover).
- **D-overlays — nothing drawn on photos** → **as the user stated** (2026-10-30, user). Scope narrowed to phones, see above. Reverses booker-ui
  I1's photo badge on "Available today" and the always-on Explore cover pill.
- **D5 — How the photo fills the left side on a phone** → **A, fill: 136px square** (resolved 2026-10-30, user). (preview screens 2 and 3).
  (A) **Fill**: a 136px square, the card exactly that tall, one line per text row, long names ellipsised.
  (B) **Stretch**: the 112px-wide photo stretches to the card height. It fills the side but is not
  square when a name wraps (nearly square otherwise). *Recommend A.* It keeps the square everywhere,
  which was the point of both plans, and the rows are a uniform height.
- **D6 — Where "No dates yet" goes when the card has a photo** → **A, beside the division label** (resolved 2026-10-30, user). ✖ **Superseded the same day** by D-overlays-scope (desktop keeps the chip on the cover) and D7 (on a phone it takes the category line). (Explore only).
  (A) **Beside the division label in the text**, as in the preview. (B) Keep it on the photo, as the
  one exception. *Recommend A.* "Nothing on photos" then has no exceptions, and the chip sits next to
  the label it qualifies.

- **D7 — Make the phone row's text fit the 136px square (F5)** → **A, trim on phones** (resolved 2026-10-30, user). (A) **Trim on phones only**:
  the slot line on one line with "…"; on Explore, "No dates yet" **takes the category line's place**
  (category hidden on phones; the offering page still shows it), so no chip beside the pill; and below
  360px wide, Home hides the decorative **Book** span (the whole card is already the button, and `Book`
  is `aria-hidden`) so the price fits. (B) **Let the photo stretch** (D5 option B after all): it fills the side
  at any text height, but is not square when text wraps. (C) **Accept a small strip** when text is taller.
  *Recommend A:* it keeps the square and the fill, and only drops content that is either repeated
  elsewhere (category) or decorative (Book).

## FINDINGS
- **F1** — with reduced motion on, autoplay never starts (E2), and because `showPlayPauseButton`
  is `false` there is no way to start it. This is **designed** (booker `AGENTS.md` → Promotions
  carousel: "a reduced-motion booker never sees it play"), but it is a likely cause of the
  stakeholder's report if their phone has Reduce Motion, "Remove animations" or a battery saver
  on. → D4.
- **F2** — one swipe stops autoplay until reload (E5). This is **designed** (carousel plan D3), and
  with the button hidden it is also the only way a booker can pause the carousel, which WCAG
  2.2.2 requires for content that moves for more than 5 seconds. Kept. Recorded so it is not
  mistaken for a bug.
- **F3** — ✅ **closed by the user (2026-10-30): "F3/F4 is also a pass"** (iOS checked on staging). Original note: **iOS Safari not tested.** Only Chromium is installed for Playwright here. Installing
  WebKit would be a new browser download. Safari does not focus a link on tap, so B1 is expected to
  be Android-only. iOS needs a real iPhone on staging (S4).

- **F4 (2026-10-30, existing, out of scope)** — ✅ **closed by the user (2026-10-30): "pass"**, i.e. accepted as is. Original note: — on a **first** visit at phone width the sidebar starts
  **open** over Home. `useAppShell.ts:31–43` only remembers a *collapsed* choice, so `sideOpen` starts
  `true`. Seen in V1 with a fresh session. Tapping a tab closes it. Not caused by this plan, and not
  fixed. ⬜ open for the user.

## VISUAL CHECKS — results
**V1 ✅ (2026-10-30, local, :3200, seed booker):** real Home at 1280 and 390, light and dark: **all
assertions ok in 4/4 captures** (Popular 1 card, Near you 4 rows, 5 real photos; square, loaded, no
overflow, radius 10px). Sidebar tagline visible (phone). Carousel E1–E7 re-run: E7 now advances.
**Gallery:** 9 baselines regenerated in a scoped run (18 passed) and 6 new narrow ones, all read by eye.
**Full suite: 184/184** (was 177, plus 6 narrow and 1 B1 test). `tsc` 0, `npm test` 323/323, lint 18 (unchanged).

- **F5 (2026-10-30, found building I5): the preview's 136px fit does not hold with real fonts and widths.**
  Measured in the gallery with Poppins: the Explore phone row's text is **140px** (card 142, photo 136, so a 6px
  strip). On Home, "09:00 · 45 minutes" wraps, making the card **151px**. At **320px** the Home card's text
  column is about 88px, so everything wraps (169px) and the Book span is pushed off the card. On Explore,
  "No dates yet" beside the division pill is **clipped** at the right edge (pill + chip ≈ 170px in a ≈152px
  column). → D7. Built so far (uncommitted): I6 complete (overlays gone; desktop baselines would pass
  as measured), and I5's 136px grid in place but **not passing its own check**.

## Execution order
1. **Stage 1 (build, one pass):** B1 (with its test) → I4 → I1, I2, I3 → regenerate
   **only** `opentoday*`, `popular*`, `nearyou*`, `homenear*`, `sidebar*` and the new
   `opentodaynarrow-narrow-*` → full visual suite → V1.
1b. **Stage 1b (added 2026-10-30):** ✅ I6 → I5 → I7 (2026-10-30). Then the staging release ships stage 1 + 1b together.
2. **Stage 2: staging** (S1–S4).
3. **Stage 3: production** (P1, P3). Always last.

## VISUAL CHECKS
**V1 (local, 🤖):** the photo plan's headless script, extended to Home: "Available today",
"Popular", "Near you" and the sidebar, at 1280 and 390, light and dark. The same assertions
(square, loaded, no overflow, contained), plus re-running E1–E7 after B1, where E7 must advance.
Needs no booker dev server running; if one is, I ask you to stop it.

## Release (§12)
No migration, no Edge Function, no secret or env var (D4-B would be a JSON change in the app,
shipped with the deploy). Booker app deploy only. Production check: none, the same as the photo
plan, **unless you say otherwise**. The carousel fix is behavioural, so S4 includes one Android check.

### Staging (production untouched throughout)
| # | Who | Step | Check |
|---|---|---|---|
| S1 | 👤 | Commit (draft provided, scoped `git add`), bump booker version | ✅ stage 1 committed (2026-10-30, user). Stage 1b still to commit |
| S2 | 👤 | Deploy booker to staging | new version visible |
| S3 | 👤 | Send the deployment URL | — |
| S4 ✅ | 👤 | Visual check of Home (both widths) + **on an Android phone: tap a banner, come back, autoplay resumes**; iPhone if available (F3) | ⛔ green |

### Production (last stage)
| # | Who | Step | Check |
|---|---|---|---|
| P1 ✅ | 👤 | Confirm the deployment to promote is the one S4 checked | ✅ user, 2026-10-30 |
| P2 | — | n/a (no migration / Edge Function) | — |
| P3 ✅ | 👤 | Vercel **Promote** of the staging deployment the user checked | ✅ promoted by the user, 2026-10-30 |

## Verification
- B1 — machine: new touch test + existing `promo.spec.ts` green; E7 re-run advances. Live: Android on staging.
- I1–I3 — machine: scoped baselines read by eye, full suite, V1. Live: S4.
- I4 — machine: `sidebar-*` regenerated and read.
- All — `npx tsc --noEmit`, `npm run lint` (no new problems beyond the pre-existing 18), `npm test`.
