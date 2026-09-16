# Offering photo limit, kiosk action bar and offering cards

**Date:** 2026-09-14
**App / scope:** `vendor/` only: Offerings attachments editor, kiosk booking flow (`components/kiosk/`), guide copy, `architecture/portals.md`
**Branch at plan time:** `vendor` `feature/kiosk_offering_navigation_fix`
**Status:** IN PROGRESS. Stages 0–4 built and machine-verified 2026-09-15, and committed by the user (vendor `da57bf5`, root `7cc2bc5`). Screenshots approved and saved 2026-09-15; F4 done; full vendor Playwright suite **179 passed, 0 failed** (exit 0). Remaining for the user: Stage 5 live check, and committing today's F4/screenshot edits.

> Four vendor-side refinements before launch. (1) Allow only one offering photo for now, controlled
> by one constant so it can go back to 3 later. (2) Keep the kiosk's total and **Continue** on screen
> however long the offering list is. (3) Fit uploaded photos without cropping or distortion.
> (4) Show the offering code on tiles with no photo. Plus an assessment, not an implementation,
> of uploading photos and attachments before an offering is first saved.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision, F# = Finding (pre-existing,
> not fixed here), A# = Assessment. Numbers are plan-local. "kiosk D10" means
> `.plans/2026-08-26-vendor-kiosk-mode-and-offering-attachments.md` D10.

**Visual previews for approval:** published as an Artifact (link in the chat that produced this plan).

**Out of scope:** `booker`, `command`, and schema or storage changes. Upload-before-save was
assessment-only until D4 was resolved on 2026-09-15. It is now in scope as **I6**, with no backend change. `ezzy-vendor-mobile` is also out of scope. Its kiosk
catalogue is still ⬜ in `.plans/2026-09-03-vendor-mobile-kiosk-mode.md` Stage 3, and it should pick
up whatever D2/D3 settle (see F2).

---

## Findings (investigation 2026-09-14, from reading the code)

- **The photo limit already exists and is set to 3.** `services/offeringAttachments.service.ts:25`
  `MAX_PHOTOS = 3` (kiosk D10: enforced in the app, deliberately not in the DB). The editor shows
  `n of MAX used`, disables the add tile and relabels it "Limit reached"
  (`OfferingAttachmentsEditor.tsx:71-79`). So the one-photo limit is a constant change plus hiding
  the tile. It is not a redesign.
- **Photos are already optional.** `useOfferingForm.ts:54` `canSave` checks name, code, duration and
  requirements only. `lib/kioskEligibility.ts` and `services/kiosk.service.ts` never mention
  photos. No change is needed to keep them optional. The work is to make sure nothing adds a check.
- **The kiosk only ever shows the cover photo.** `StepOffering.tsx:95` `k.photosFor(o.id)[0]`. Extra
  photos have never reached a customer.
- **Why the bar gets pushed off-screen (root cause, from reading the CSS).** The flow is already
  built for an internal scroll: `KioskBooking.module.css:10` `.flow { flex:1; min-height:0 }`,
  `:34` `.content { flex:1; min-height:0; overflow-y:auto }`, and `:315` `.actions { margin-top:auto }`.
  But `KioskShell.module.css:23-24` gives `.root` a **`min-height: 100dvh`, not a `height`**.
  A flex column with only a minimum height grows to fit its content, so `.content` never has less
  room than it needs and never scrolls. Instead the whole document scrolls and `.actions` ends up
  below the last offering. The Staff exit footer (`KioskShell.tsx:146`) sits below that again.
  **✅ Confirmed at runtime in Stage 0 (2026-09-15).** See "Stage 0 results" below.
- **Dark-theme bar background is almost transparent.** `--sp-card-bg` is
  `rgba(255,255,255,0.028)` in dark (`app/globals.css:142`). That is fine for a bar that sits in
  normal flow. A bar that floats over scrolled content needs a solid colour of its own (this
  matters for D1 option B).
- **Current photo fit is `object-fit: cover`** at a fixed 112px height (132px for "today" tiles)
  (`KioskBooking.module.css:74-80, 95`). Nothing is stretched, but a portrait photo loses most of
  its height to cropping in a roughly 2:1 frame.
- **The no-photo tile shows a grey image icon** (`StepOffering.tsx:101`), which looks like a
  broken image.
- **Offering codes are at most 6 characters and always uppercase.** They are enforced by
  `offerings_code_length` and `offerings_code_uppercase` in `20260506000001_offerings.sql:32-33`.
  So one font size fits every code, and no length-based sizing logic is needed.
- **The guide and a test mention the old limit.** `components/dashboard/GuideModal/guideItems.ts:159`
  says "Up to 3 photos … Use the arrows to reorder: the first photo is the cover", and
  `visual-tests/pilot.spec.ts:959` checks for "the first photo is the cover".
  `architecture/portals.md:442` says "up to 3 are allowed".
- **The gallery fixture cannot show real photos.** `app/ui-gallery/page.tsx:243` makes `photosFor`
  return `[]`, because `photoUrl()` would call Supabase in the middle of a screenshot. CSP
  `img-src` allows `data:` (`next.config.ts:69`), so fixtures can use inline SVG data URIs instead.
  They can only do that once the tile gets its URL from state rather than from a service call made
  during render (I5).

## Stage 0 results (2026-09-15)  ✅ DONE

**Baseline on a clean `feature/kiosk_offering_navigation_fix` (no local changes):**
- `npx tsc --noEmit`: **exit 0**.
- `npm test` (node --test, `lib/**/*.test.ts`): **452 tests, 452 pass, 0 fail**.
- `npm run lint`: **exit 1, 35 problems (32 errors, 3 warnings), all already there before any change.**
  Mostly `react-hooks/set-state-in-effect` and `no-explicit-any`. ⚠️ Three of the affected files are
  ones **I6 will edit**: `useOfferingForm.ts:24`, `useOfferingsPage.ts:65` (both
  set-state-in-effect) and `services/offerings.service.ts`. From here on, lint is judged by
  **no new problems compared with this baseline**, not by exit code. Fixing these is out of scope.

**Layout measurement.** A throwaway Playwright script (session scratchpad `s0-measure.cjs`, not
committed) ran the real `/kiosk` page on `next dev` :3100. It used a faked session, N offerings with
all-day weekly schedules, and touch enabled. It tapped **Book something**, measured, selected the
first tile, and took a screenshot. The dev server was stopped by PID afterwards, and `git status`
was clean.

| Viewport | Offerings | Page scroll height | Action bar top–bottom | Bar on screen | `.content` scrolls |
|---|---|---|---|---|---|
| 1024×768 | 3 | 768 | 600–702 | yes | no |
| 768×1024 | 3 | **1026** | 858–960 | yes | no |
| 600×960 | 3 | **991** | 831–925 | yes | no |
| 1280×800 | 3 | 800 | 632–734 | yes | no |
| 1024×768 | 20 | **2625** | **2456–2559** | **no** | **no** |
| 768×1024 | 20 | **3562** | **3394–3496** | **no** | **no** |
| 600×960 | 20 | **3527** | **3367–3461** | **no** | **no** |
| 1280×800 | 20 | **1674** | **1505–1608** | **no** | **no** |

- **Root cause confirmed.** With 20 offerings the list's scroll height always equals its visible
  height (`.content` never scrolls). The **whole document** grows to 1674–3562px, and Continue sits
  up to about 2.5 screens below the fold at every size. Screenshot `s0-1024x768-20.png`: only the
  first two rows are visible, with no bar.
- **New detail:** even with **3 offerings** the page already overflows on portrait screens (by
  2px at 768×1024 and **31px at 600×960**). On a 7″ tablet the Staff exit button is partly
  off-screen before any list is long. B1's fixed frame fixes this too, and the Stage 2 measurement
  must show document scroll height equal to the viewport height at every size.
- Continue became enabled after selecting a tile in every case. The problem is only that it can't
  be reached, not that it doesn't work.

---

## BLOCKERS

### B1 — Total and Continue are pushed below the offering list  ✅ DONE (2026-09-15)
<!-- ✅ DONE 2026-09-15. Executed:
KioskShell.module.css: .root `height: 100vh; height: 100dvh; overflow: hidden` (was min-height);
  .body `min-height:0; overflow-y:auto; overscroll-behavior:contain; justify-content: center` then
  `safe center` (with the plain line kept as the fallback); `@media (max-height:820px) .footer
  padding-bottom 12px`.
KioskBooking.module.css: .content `overscroll-behavior: contain`; .actions `position:relative;
  z-index:1` + permanent upward shadow (stronger in dark); `@media (max-height:820px)` tightens
  .header/.actions block padding only, so the ≤640px side padding still wins.
DEVIATIONS from the written approach:
  (a) `env(safe-area-inset-bottom)` NOT added. The kiosk viewport has no `viewport-fit=cover`, so
      env() resolves to 0 and would be dead code.
  (b) NEW, found by the measurement: the signature pad took its height from the canvas's intrinsic
      2:1 ratio (461px at 1024 wide, because `.content` was a block box and the pad's `flex:1` was
      inert). In the fixed frame that put Clear and the signer line under the action bar, in a
      region that is almost all touch-captured canvas, so it could barely be scrolled. Fixed with
      `.contentFill { display:flex; flex-direction:column }`, applied to `.content` on the
      signature step only (KioskBooking.tsx). The pad now fills the visible height.
Verified (machine), throwaway Playwright script scratchpad s2-measure.cjs, real /kiosk on next dev,
faked session/data, touch enabled, 4 viewports × 3 and 20 offerings:
  document scroll height == viewport at every size on Welcome and on the offering step (was up to
  3562px); bar fully on screen; with 20 offerings `.content` scrolls; after scrolling to the bottom
  the last tile ends above the bar top (not covered); Staff exit on screen (was cut off at 600×960
  even with 3); selecting the LAST tile while scrolled then Continue reaches "Choose a day and
  time" at every size. Finish a booking with 15 mocked matches at 1024×768 and 600×960: document
  fits, body scrolls, heading reachable at scrollTop 0 (top not cut off). Signature step at all 4
  sizes: document fits, canvas 289–522px, Clear above the bar, no content scroll, and a drawn
  stroke enables Continue.
  tsc 0; lint identical to the Stage 0 baseline; 452/452 unit tests; `playwright test -g kiosk`
  14/14 passed (existing kiosk baselines unchanged).
Needs live: real tablet flick-scrolling / overscroll feel, iPad browser chrome with dvh, dark theme
on device (Stage 5). -->
**Files:** `components/kiosk/KioskShell/KioskShell.module.css:22-30, 76-81, 158-165`;
`components/kiosk/KioskBooking/KioskBooking.module.css:34, 314-318, 331-335`
On a kiosk with enough offerings, the customer has to scroll the whole page to find Continue, and
the header (Back, step title) scrolls away with it. This affects every step with long content
(slot grid, agreements), not just offerings.
**Fix approach (D1 = A, "fixed frame", resolved 2026-09-15):**
- `.root`: `height: 100dvh` (with a `100vh` fallback) and `overflow: hidden`, instead of
  `min-height`. The flex chain that already exists then makes `.content` the only scrolling area.
  Brand bar, step header, action bar and Staff exit stay on screen, and the action bar sits in
  normal flow **below** the list, so it never covers the last row.
- `.content`: add `overscroll-behavior: contain` so a flick does not bounce the whole kiosk on
  iPad. Add a little bottom padding so the last row does not sit tight against the bar's border.
- `.actions`: keep it in flow. Add `padding-bottom: max(20px, env(safe-area-inset-bottom))`, and a
  permanent soft upward shadow on top of the border it already has, so the list reads as scrolling
  behind the bar. No scroll listener or state is needed. (The `background-attachment: local`
  scroll-shadow trick was ruled out because the kiosk's background is a gradient, and the trick's
  cover layer would show as a visible band.)
- **Regression guard:** `KioskShell.module.css:.body` (Welcome and Finish views) now has a limited
  height, so it needs `min-height: 0; overflow-y: auto`. Its `justify-content: center` must become
  `justify-content: safe center` (or rely on `.centre { margin: auto }` alone). Otherwise a long
  Finish-a-booking results list gets its **top** cut off, the classic centred-flex overflow bug.
- **Short landscape screens** (`@media (max-height: 820px)`): tighten the step header and footer
  padding. On a 1024×768 iPad the fixed chrome would otherwise take about 40% of the height.
- **Signature step:** `KioskSignaturePad.module.css` `.pad { flex:1; min-height:220px }` will now
  fill a limited-height area instead of a growing one. Check that it is still at least 220px at
  768px tall.
- **D5 (resolved yes, 2026-09-15) ✅ DONE 2026-09-15:** show the chosen offering's name next to the total in the bar
  (`KioskBooking.tsx:118-123`, read from `k.offering`, no new state). In a scrolled list the
  selected tile is often off-screen, and a total with no label does not say what it is for.
  *As built:* "<name> · <duration>" in `.totalName` (single line, ellipsis), then the total. With no
  offering chosen: "Choose a service to continue" and "—" (was "Total ₱0"). On the payment step a
  small "amount due" follows the amount, replacing the old "Amount due" label. Verified in the
  script: bar text "Choose a service to continue —" → "Offering 20 · 1 hour ₱2,000"; a 58-character
  name ellipsised at 600×960 with Continue on the same row (screenshot s2-signature-600x960.png).
**Component separation:** `KioskBooking.tsx` stays a pure render layer (the summary reads an existing
hook value). `KioskShell.tsx` does not change. All styling goes in the two existing `.module.css` files.
**Verify:** Stage 0/2 measurement script at 4 viewports (see Verification). Needs a live tablet check too.

## IMPORTANT

### I1 — One-photo limit, ready to go back to 3  ✅ DONE (2026-09-15)
<!-- ✅ DONE 2026-09-15. Executed: MAX_PHOTOS = 1 with a temporary-limit comment
(offeringAttachments.service.ts:23-30); Add photo tile rendered only when !loading && !photosFull,
with the "Limit reached" label removed; arrows and COVER only when photos.length > 1
(OfferingAttachmentsEditor.tsx); addPhoto returns early while loading or when full
(useOfferingAttachmentsEditor.ts). Also hid the tile WHILE LOADING, a small extension: an empty
mid-fetch list would otherwise offer an upload past the limit.
Verified (machine): tsc 0; lint identical to the Stage 0 baseline (35 problems, same files) and
eslint clean on every touched file; 452/452 unit tests; grep shows no photo check in
useOfferingForm.ts or kioskEligibility.ts (photo stays optional). Throwaway Playwright script
(scratchpad s1-editor.cjs, faked session and storage, real Edit Offering modal on next dev):
  0 photos → "0 of 1 used", Add photo visible, 0 arrows, 0 COVER, Save Changes enabled;
  mocked upload → "1 of 1 used", Add photo hidden, 0 arrows, 0 COVER, 1 remove;
  1 photo → Add photo hidden, 0 arrows, 0 COVER;
  3 photos (existing, uploaded under the old limit) → Add photo hidden, 6 arrows, 1 COVER, 3 remove.
Needs live: a real upload to staging storage (Stage 5). -->
**Files:**
- `services/offeringAttachments.service.ts:23-25`: `MAX_PHOTOS = 1`. Rewrite the comment to say it
  is a **temporary launch limit** (this plan) and that raising it to 3 is the only change needed.
  Keep the D10 note that it is enforced in the app, not the DB.
- `OfferingAttachmentsEditor.tsx:69-79`: render the add tile **only when `!a.photosFull`**, instead
  of disabling it and showing "Limit reached".
- `OfferingAttachmentsEditor.tsx:52-63`: show the ←/→ reorder buttons and the COVER tag **only when
  `a.photos.length > 1`**. With one photo they are dead controls. The condition is written against
  the photo count, never against `MAX_PHOTOS === 1`, so they come back by themselves when the limit
  is raised.
- `useOfferingAttachmentsEditor.ts:139`: `addPhoto` returns early when `photos.length >= MAX_PHOTOS`.
  This is a guard behind the hidden tile, so a stale or double file-input event cannot upload a second photo.
- Leave the `n of max used` counter as it is ("0 of 1 used" / "1 of 1 used"). It is correct at any limit.

**Changing the constant on its own is not enough** (answer to the user, 2026-09-15). With only
`MAX_PHOTOS = 1`: the add tile would still show, disabled, reading "Limit reached"; a single photo
would still show two disabled arrows; and the COVER tag would appear on the only photo. The three
small edits above remove those states. They check the photo count, so **after I1 ships, going back
to 3 really is just the constant.** The guide text (I4) is plain copy and would need editing again
at that point.

**Existing offerings with 2–3 photos** (possible on staging/prod, uploaded under the old limit):
all of them stay visible and can still be removed or reordered, and the add tile stays hidden until
the count is below the limit. **No data migration, and no vendor photo is deleted.** The kiosk
already shows only the cover.
**Photo stays optional:** no change to `canSave`, eligibility or the kiosk. Stage 1 adds a grep
check that `photos`/`MAX_PHOTOS` do not appear in `useOfferingForm.ts` or `lib/kioskEligibility.ts`.
**Component separation:** the `.tsx` file only gains conditionals on hook values. The guard lives in
the hook. No CSS change is needed (`.photoRow` already wraps).

### I2 — Kiosk photo fit: whole image, centred, never cropped or stretched  ✅ DONE (2026-09-15)
<!-- ✅ DONE 2026-09-15. StepOffering.tsx `Thumb`: `.photoFill` (aria-hidden, same URL, cover + blur(18px)
saturate(1.1) scale(1.2) opacity .6) under `.photoImg` (contain, 50% 50%), both loading="lazy"
decoding="async"; `onError` → `k.markPhotoFailed(o.id)` → the code monogram. Frame heights
unchanged (112/132). Verified: script s3-cards.cjs on /ui-gallery?mode=kioskofferingphotos at
900, 534 and 1024 wide: portrait 600×900 shown 87×130 in a 220×132 frame, landscape 1200×600 shown
218–220×109–110, square 800×800 shown 110×110. All load, object-fit contain, position 50% 50%,
whole image visible, aspect kept, blur fill present. Real /kiosk with one photo 404ing: the tile
falls back to its code ("OF2"); the working photo loads; the no-photo tile shows "OF3". Needs live:
blur scroll smoothness on a low-end tablet (Stage 5; fallback = hide .photoFill). -->
**Files:** `KioskBooking.module.css:74-80`; `StepOffering.tsx:93-102`; `useKioskBooking.ts:355`
**Fix approach (D2 = A, "contain on a blurred fill", resolved 2026-09-15):** keep the existing frame
heights (112px, or 132px for today tiles) so the grid does not change. Inside the frame, the main
`<img>` uses `object-fit: contain; object-position: center`. Behind it, a second `aria-hidden` `<img>`
with the **same URL** (served from the browser cache, so no extra request) uses `object-fit: cover`,
`filter: blur(18px) saturate(1.1)`, `transform: scale(1.2)` and reduced opacity. Portrait, landscape
and square photos all fill the frame edge to edge with the full photo visible and no letterbox bars.
Add `loading="lazy" decoding="async"` for long grids.
- **Broken image:** if the image fails to load (deleted object, CSP, offline), the tile falls back to
  the I3 code placeholder, not a broken-image icon. This needs `photoFailed: Set<string>` and
  `markPhotoFailed(id)` in `useKioskBooking`; `StepOffering` passes `onError` from the hook.
- **While loading:** the frame shows its neutral surface. The code placeholder is *not* shown
  during loading, so it does not flash.
- **Performance risk:** a static blur on about 20 tiles on a low-end Android tablet. Check scroll
  smoothness on a real device in Stage 4. The fallback is option B (drop the fill image and keep
  contain on a tinted matte), which is a one-element change.
**Component separation:** the image frame becomes a `Thumb` pure-display function in
`StepOffering.tsx`, next to the existing `Tile` (same file pattern). Its state (failed photos) is in
`useKioskBooking`. All styles are in `KioskBooking.module.css`.

### I3 — Tiles without a photo show the offering code  ✅ DONE (2026-09-15)
<!-- ✅ DONE 2026-09-15. `.photoCode` (blue wash + fading dot grid + blue edge, dark variants) and
`.photoCodeText` (800, 0.06em tracking, tabular, #1d4ed8 / #93c5fd, nowrap).
DEVIATION from "one font size fits every code, no length-based sizing": measured false. At 800
weight a wide glyph is ~1.07em, so "MMMMMM" (6.4em) overflows a 220px frame at 40px, and a single
width cap that fits it (15cqi) shrank ordinary codes to ~30px, well below the approved 40px. Built:
frame is `container-type: inline-size`; 1–4 characters `min(40px, 22cqi)` (46px on today tiles);
5–6 characters add `.photoCodeLong` (chosen in render by `o.code.length > 4`, the same pattern as
`tileFree`) at `min(40px, 15cqi)`; ≤640px caps at 34px; px fallbacks precede each cqi line. An
intermediate 17cqi attempt was measured overflowing (MMMMMM 237px in a 220px frame) and discarded.
Verified at 900/534/1024 wide: every code fits and is centred on both axes; RENT/OPEN/SAUN 46px
on today tiles, BALL 40px, COACH/CLASS 32.7–38.9px, MMMMMM 32.7px (209px in 220), 34px (217 in
386), 38.9px (249 in 261). Guide line added ("…the tile shows the offering's short code…") with a
pilot.spec.ts assertion. -->
**Files:** `StepOffering.tsx:101` (replace `<ImageIcon />`); `KioskBooking.module.css`
**Fix approach (D3 = A, "brand monogram", resolved 2026-09-15):** a subtle blue gradient wash
(`rgba(37,99,235,.10) → .02`) over the frame's surface, a faint dot-grid texture that fades toward
the edges, and a 1px inset border in the same blue. The code is centred in Inter 800, `letter-spacing:
0.06em`, tabular numerals, 40px (46px on today tiles, 34px at ≤640px), coloured `#1d4ed8` in light
and `#93c5fd` in dark (contrast above 4.5:1 on both surfaces). Nothing else goes in the frame. The
blue is the kiosk's existing brand blue at low strength. It does not use emerald, which already
means "available today", or a per-offering hue that could be mistaken for a status.
The code is real text, not `aria-hidden`: it is information the tile does not show anywhere else.
The dot grid is a CSS `radial-gradient` with `mask-image`, so there are no assets.
**Component separation:** same `Thumb` pure-display function as I2, with styles in the module.
**Guide follow-up (from I4), ✅ done in Stage 3:** when this ships, add "Without a photo, the tile shows the offering
code" to `guideItems.ts` "Offering photos", with a matching `pilot.spec.ts` assertion.

### I4 — Copy, docs and test assertion follow the one-photo limit  ✅ DONE (2026-09-15)
<!-- ✅ DONE 2026-09-15. guideItems.ts "Offering photos" now reads "One photo per offering: JPG, PNG
or WebP, up to 5 MB. It is optional, and the kiosk shows it on the service tile. To change it,
remove it and add a new one…" and the source note records MAX_PHOTOS = 1. "(save a new offering
first)" is KEPT until I6 changes that behaviour. It deliberately does NOT yet mention the code
placeholder (not shipped until Stage 3; see I3). pilot.spec.ts: asserts "One photo per offering"
and that "Up to 3 photos" is absent. architecture/portals.md Photos bullet rewritten. The CSS size
comment in OfferingAttachmentsEditor.module.css was updated. booking-flow.md has no photo wording,
so nothing changed there. Verified: `npx playwright test -g "modal semantics, focus, tabs and
content"` passed 1/1, exit 0. -->
- `guideItems.ts:159` "Offering photos": one photo, JPG/PNG/WebP, 5 MB; shown on the kiosk tile;
  without a photo the tile shows the offering code; photos are public. Drop the arrows/cover wording.
  Update the `photos` source note at `:149`.
- `visual-tests/pilot.spec.ts:959`: replace "the first photo is the cover" with an assertion that
  matches the new copy.
- `architecture/portals.md:442`: one photo for now (constant `MAX_PHOTOS`, planned to go back to 3);
  tiles without a photo show the code. Also update `architecture/booking-flow.md` Kiosk Mode if it
  describes the tile.
- The guide's "(save a new offering first)" wording is removed as part of I6.

### I5 — Gallery fixtures for photo ratios and the no-photo tile  ✅ DONE (2026-09-15), baseline acceptance waiting on the user
<!-- ✅ DONE 2026-09-15. useKioskBooking: `photosFor` (only consumer was StepOffering) REPLACED by
`coverUrlFor(id): string | null` (wraps photoUrl, null when there is no photo or it failed) and
`markPhotoFailed(id)` (a `failedPhotos` Set). ui-gallery: kioskState defaults `coverUrlFor: () => null`;
new mode `kioskofferingphotos` with inline SVG data-URI photos (600×900, 1200×600, 800×800), a
4-character and a widest 6-character ("MMMMMM") no-photo tile, and a failed-photo tile.
⚠️ NOT registered in pilot.spec.ts `modes`: registering accepts its baseline, which the user
reviews first. Existing `kioskoffering-light/-dark` baselines are NOT updated. `playwright test -g
"kiosk|modal semantics"` → 13 passed, 2 failed (exactly those two; diff 8192px, 1%, confined to the
tile image areas: icon → code). Candidate screenshots published to the preview Artifact (Version 2).
BASELINES ✅ 2026-09-15: the user approved the candidates; `kioskofferingphotos` added to `modes`
with an approval comment; `npx playwright test --grep "kioskoffering" --update-snapshots` listed
exactly 4 tests and wrote kioskoffering-light/dark (re-generated) and kioskofferingphotos-light/dark
(new); the saved light photo baseline was checked visually against the approved candidate; two
unpiped re-runs without update: 4 passed, 4 passed (exit 0). Full vendor suite afterwards, unpiped,
log in node_modules/.cache/f4/pw-full.log: 179 passed, 0 failed, exit 0. -->
**Files:** `useKioskBooking.ts` (add `coverUrlFor(id): string | null`, which wraps `photoUrl`),
`StepOffering.tsx` (use it, so no service call happens in render), `app/ui-gallery/page.tsx`
(`kioskState` returns inline SVG data URIs sized 600×900, 1200×600 and 800×800), and
`visual-tests/pilot.spec.ts` (register a new mode `kioskofferingphotos` with portrait, landscape,
square, no-photo and failed-photo tiles).
Per the project rule, registering a mode is the same act as accepting its baseline, so a human
reviews the fixture first. The existing `kioskoffering` baseline will change because its tiles now
show codes. Re-baseline it scoped with `--grep kioskoffering`, and never with the unscoped update.

### I6 — Save on first upload, and stay open after Add (D4 = I+R)  ✅ DONE (2026-09-15)
<!-- ✅ DONE 2026-09-15 (Stage 4, run before Stage 3 at the user's request because it has no
dependency on their review). Executed:
useOfferingsPage.ts: `createFromForm` is the one create path, de-duplicated by a `creating`
  promise ref. On success the form switches to edit mode (setOTarget + setOModal("edit")) and
  `createdOffering` holds the schedule prompt. A `formSession` ref stops a create that resolves
  after the form was closed from reopening it (it shows the prompt instead, as before).
  `ensureOffering(item)` resolves an id through it. `closeModal` shows the held prompt once.
  handleSave's add path now calls createFromForm and stays open. The edit path closes, shows the
  prompt once and clears the held create, so a later close cannot prompt a second time.
useOfferingForm.ts: `buildOffering()`; `uploadBlockedReason` (names what is missing: name, short
  code, price with "0 for free", duration, or a blank requirement); `ensureSaved()`.
  REMOVED the effect that re-seeded every field on `oTarget` change. The modal mounts fresh per
  open, so the only in-lifetime change is the new add→edit switch, where re-seeding would wipe
  keystrokes typed during the create. This also removes one lint error that was already there
  (lint 35 → 34).
OfferingFormModal.tsx: editor rendered in add mode with a "Adding a photo or document saves this
  offering." note; green "Offering added…" banner and Cancel→Close after an in-place create. New
  props `onEnsureSaved`, `justCreated`.
OfferingAttachmentsEditor(.tsx + hook): `offeringId: string | null`, `ensureOffering`,
  `blockedReason`. In add mode there is no fetch; every first write resolves the id inside `run()`,
  so `busy` covers the create. Add photo / Upload a file / Write text are disabled with the amber
  reason while blocked. A failed create shows "The offering couldn't be saved, so nothing was
  added…" and KEEPS a written-text draft. `run` was split into `runReporting` (returns the error)
  and `run` (void) so existing callers keep their types.
OfferingsPage.tsx: onClose=closeModal, onEnsureSaved, justCreated. ui-gallery: `onEnsureSaved`
  no-op. Guide copy (Offering photos, Documents) and `architecture/portals.md` ("Attachments while
  adding") updated.
Verified (machine): tsc 0; lint 34 problems, the Stage 0 list minus useOfferingForm.ts, no new
files; 452/452 unit tests; Playwright `offering duration picker` + guide modal tests 5/5.
Throwaway script scratchpad s4-presave.cjs (real Add Offering form on next dev, faked session,
stateful fake backend counting writes):
  A: empty form → buttons disabled, "Add a name, a short code and a price (0 for free)…"; name and
     code but blank price → "Add a price (0 for free)…"; price "0" → enabled. Add photo → exactly
     1 offering POST (price 0), 1 storage upload under {vendor}/{newId}/, attachment offering_id =
     new id; form now "Edit Offering", banner shown, Close label, "1 of 1 used", Add photo hidden,
     typed name/code/price AND a description typed before the upload all kept. Close → schedule
     prompt once; Not now → list shows the offering.
  B: Add Offering → 1 POST, form stays open in edit mode with banner; Save Changes → 1 PATCH, form
     closes, prompt once; no second prompt.
  C: create delayed 1.5s, Add Offering then Add photo during the flight → still exactly 1 POST;
     photo attached to the new id.
  D: create fails 23505 → 0 uploads, 0 attachment rows, editor message + "That code is already in
     use" both shown, form stays in add mode and can retry.
  E: close while the create is in flight → form does not reopen; prompt shows; list has the offering.
  F: fill then Cancel → 0 POSTs.
  G: Write text → Save document in add mode → 1 POST, document row on the new id, draft closed.
Needs live: a real upload to staging storage and RLS on a real session (Stage 5). -->
**Files:** `components/offerings/OfferingsPage/useOfferingsPage.ts:121-175`;
`OfferingFormModal/OfferingFormModal.tsx:203-216`; `OfferingFormModal/useOfferingForm.ts:54`;
`OfferingAttachmentsEditor/OfferingAttachmentsEditor.tsx`; `useOfferingAttachmentsEditor.ts`;
`components/dashboard/GuideModal/guideItems.ts:159` (drop "(save a new offering first)").
**Approach** (full reasoning in A1 → "Save on first upload"):
- **Stay open (R):** on a successful create, `handleSave` switches the modal to edit mode
  (`setOTarget(saved); setOModal("edit")`) instead of closing it. `refreshCompletion()` still runs
  at that point. The schedule prompt (`setSavedOffering`) moves to when the modal is **closed after
  a create in this session**, so it still appears once and never after a failed save.
- **Save on first upload (I):** in add mode the Attachments section renders the real editor controls
  with a note: "Adding a photo or document saves this offering." Its first write calls
  `ensureOffering(): Promise<string | null>`, passed down from the page. That runs the same
  create as Add Offering with the current form values and returns the new id, or null and shows
  the error where save errors already appear. The upload then continues against that id.
- **Gate:** the controls are enabled only when `canSave` is true **and the price field is not blank**
  (`"0"` is allowed, so free offerings still work). Otherwise a line names what's missing.
  Add Offering's own rules are unchanged (F3).
- **No double create:** the create is guarded by one in-flight promise in the page hook, and the
  editor's buttons stay disabled while it runs.
- **Keep typed values:** switching from add to edit must not reset what the vendor typed.
  `useOfferingForm`'s `useEffect` on `oTarget` (`:23-34`) re-seeds every field. With `saved` built
  from those same values this is harmless, but it must be checked, especially for the price string
  and the duration quantity.
**Component separation:** all new state (the in-flight create, the add→edit switch, the deferred
prompt) lives in `useOfferingsPage`/`useOfferingForm`/`useOfferingAttachmentsEditor`. The `.tsx` files
only gain conditionals and one note line. No inline styles.
**Verify:** staging: enter a name, code, duration and price, tap Add photo, and check that one
offering is created, the form is now in edit mode and the photo is attached. Blank price: controls
disabled with the reason shown. Duplicate code: the error shows, nothing is uploaded, and the form
stays in add mode. Cancel before any upload creates no row. Add Offering keeps the form open, and
closing it shows the schedule prompt once. `tsc` and lint.

---

## A1 — Assessment: uploading a photo and attachments before first save  (assessment only)

**Why a saved offering is needed today.**
1. **Rows:** `offering_attachments.offering_id uuid not null references offerings(id)`
   (`20260829000001:34`). A row cannot exist before its offering does.
2. **RLS:** the write policy finds the vendor through
   `(select o.vendor_id from offerings o where o.id = offering_id)`. With no offering it gets NULL,
   and `has_vendor_role(NULL, …)` is false, so the check fails closed.
3. **Storage path:** `uploadAttachment` builds `{vendorId}/{offeringId}/{uuid}-{name}`
   (`offeringAttachments.service.ts:139`). The storage policies only check path segment 1
   (the vendor id), so **the bytes themselves do not need a real offering**. Only the row does.
4. **UI:** the editor writes immediately. That was a deliberate choice
   (`useOfferingAttachmentsEditor.ts:14-22`): buffering until Save would add a second write path
   that can fail after the offering already exists. `OfferingFormModal.tsx:205-213` shows a
   "Save the offering first" note in add mode, and after **Add Offering** the modal closes
   (`useOfferingsPage.ts:160`), so the vendor has to find the offering again and open Edit.

**So yes, uploads depend on an offering ID:** strictly for the row, loosely for the path.

**Options.**

| | Approach | What changes | Backend / storage / DB | Abandoned-form cleanup | Complexity |
|---|---|---|---|---|---|
| **R** | **Stay open after Add.** After Add Offering succeeds, the same modal switches to edit mode with the new id, and the Attachments section appears in place. | `useOfferingsPage.handleSave` add path: `setOTarget(saved); setOModal("edit")` instead of closing. The schedule prompt (`savedOffering`) waits until the modal is closed. Form copy: "Offering added. Add a photo or documents, or close." | None | None (nothing is uploaded before the offering exists) | **Small** |
| **H** | **Hold files in the browser.** The vendor picks a photo, files and text documents in add mode. They stay in form state with `URL.createObjectURL` previews, and are uploaded one after another once `createOffering` returns the id. | The editor needs a second "pending" mode (its hook currently fetches by id). The form's Save becomes a multi-step write. On partial failure the modal switches to edit mode and lists what failed, with Retry. Object URLs are revoked on unmount. | None. Reuses `uploadAttachment` / `createTextDocument`. | None for files never uploaded. A tab closed *during* the post-save uploads leaves the offering with some attachments missing, which is visible and fixable in Edit. | **Medium** |
| T | **Upload to a client-generated id.** Generate the offering UUID when the form opens, upload bytes straight away to `{vendor}/{uuid}/…`, then insert the offering with that explicit id and insert the rows. | `createOffering` accepts an id. The editor uploads without rows. | No schema change, but **orphaned bytes** in the **public** photo bucket whenever the form is abandoned. They need a service-role sweep job (listing objects with no row), and no such job exists. | Required: a scheduled sweep plus a grace period. | Medium–Large |
| D | **Draft offering row.** Insert a draft offering as soon as uploads start. | `offerings` needs a draft state; the list, onboarding completion (`refreshCompletion` counts offerings), kiosk eligibility and schedule pickers all have to exclude drafts; a required, unique `code` has to exist before the vendor has typed one. | **Schema change** plus every read path | Required: a draft expiry job | **Large** |

**Risks and edge cases (H, the only true "before save" option worth considering):**
- A **document** that fails to upload after the offering is saved means kiosk customers are *not*
  asked to accept that waiver. The failure has to block closing the modal (or be a clear
  confirm-to-leave). A small toast is not enough.
- Duplicate code (`23505`) or an RLS failure on create: nothing has been uploaded, and the held files
  stay in the form for the retry.
- Double-tap on Add Offering while uploads are running: disable Save for the whole sequence.
- Held files are lost on reload. This is acceptable and matches how KYC re-selects files
  (`architecture/vendor-kyc.md` "Resume").
- The public-bucket rule (kiosk D10) still applies: the photo picker and document picker stay separate.

### Auto-save once name and code are filled (user proposal, assessed 2026-09-15)
Idea: as soon as name and code are valid, create the offering in the background. Every later change
in the same form updates that row. This does meet the goal (the record exists and the vendor never
leaves the form), but in this codebase it has these consequences:

1. **A half-filled offering goes live straight away.** The form defaults to Active
   (`useOfferingForm.ts:20`), and a blank price is saved as 0 (`parseInt(ofPrice) || 0`, `:76`), so
   the offering would be a **Free** offering. Booker's catalogue lists **every active offering**
   (`booker/services/offerings.service.ts:53`, `.eq("is_active", true)`, no schedule filter). The
   half-typed offering would show in booker the moment the vendor finishes typing the code.
   (It cannot be *booked* without a schedule, but it is visible.)
2. **Cancel stops meaning cancel.** A vendor who types a name and code, then closes the form, leaves a
   real offering behind. Fixing that means "Cancel" has to delete it, which is the same abandoned-row
   cleanup as option D, just triggered from the client.
3. **Onboarding flips early.** `has_offering` (`services/accountCompletion.service.ts:54`) marks
   step 1 complete on a row the vendor never meant to keep.
4. **Codes conflict while typing.** Codes are unique per vendor (`offerings_vendor_code_unique`).
   Typing `COURT` when `CO` exists hits a `23505` part-way through, so we would need a debounce and
   an inline error for a value the vendor hasn't finished entering. A later code edit renames a live
   offering that booker may already be showing.
5. **More writes and more failure states.** Every field edit becomes a debounced update, with
   "saving… / saved / failed" states, races between the create and the first update, and
   `refreshCompletion`/schedule-prompt timing to re-think. The current "Save Changes" button would
   also need to either go away or mean something new.

**Complexity:** Medium, and it changes how the whole form behaves, not just the attachments section.
**Verdict:** not recommended as described.

### I — "Save on first upload" (proposed 2026-09-15, same goal with fewer side effects)
In add mode, show the Attachments section with its real buttons instead of the "Save first" note.
When the vendor taps **Add photo**, **Upload a file** or **Write text**:
- if the form is valid (`canSave`) **and the price field is not blank** (an explicit `0` is fine),
  the offering is created with the current form values through the existing `createOffering`. The
  form switches to edit mode with the new id and the chosen upload continues;
- otherwise the buttons are disabled with a line saying what's missing ("Add a name, code, price and
  duration first").
- A short note sits above the buttons: "Adding a photo or document saves this offering."
Pair it with **R**: pressing **Add Offering** also keeps the form open in edit mode. Both triggers
use the same "switch to edit with the new id" step, so it is one mechanism.

Why this is better than auto-save: a row is only created when the vendor does something that clearly
means "keep this" (uploading, or pressing Add). Nothing is written while they type, Cancel before
that point still discards, codes are only checked when the vendor submits, and it uses the single
create path that exists today.
Edge cases: the create fails (duplicate code, stale session), so the upload does not start and the
error shows where Add Offering errors show today; double tap during the create (disable the buttons
while it runs); once saved, closing the form keeps the offering, and the note says so.
**Files:** `useOfferingsPage.ts` (add → edit transition, schedule prompt on close),
`OfferingFormModal.tsx` (render the editor in add mode behind a "save first" trigger),
`useOfferingForm.ts` (expose `canSaveForUpload`), `OfferingAttachmentsEditor` + hook (accept an
`ensureOffering(): Promise<string | null>` callback before the first write). Guide copy.
**Complexity:** Small–Medium. No backend change.

**Earlier recommendation (2026-09-14):** **do R now** (small, no backend change). It removes the actual friction, which is
the modal closing and the vendor having to reopen it, and keeps the existing "writes are immediate"
design. Consider **H** later only if vendors still find the separate step confusing. **Do not do T or
D:** T creates public orphaned files that need infrastructure this project does not have, and D is a
schema change that affects every offering read path.

---

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains. -->
- **D1 — action bar pattern** → **A: fixed frame, only the list scrolls, bar in normal flow**
  (resolved 2026-09-15, user). It matches the flex layout the CSS already intends, never covers
  content, and keeps Back and the step title on screen.
- **D2 — photo fit** → **A: contain on a blurred fill of the same image** (resolved 2026-09-15,
  user). Option B (tinted matte) stays the fallback if the Stage 5 device check shows scroll jank.
- **D3 — no-photo tile** → **A: brand monogram with dot grid** (resolved 2026-09-15, user).
- **D4 — upload before save** → **I+R: "save on first upload" plus "stay open after Add"**
  (resolved 2026-09-15, user). Auto-save on name and code was considered and not chosen: it creates
  live, free, half-filled offerings, breaks Cancel and trips on code conflicts while typing (A1).
  Implemented as **I6**.
- **D5 — show the chosen offering in the action bar** → **yes** (resolved 2026-09-15, user).
- **D6 — vendor editor thumbnail** → **yes, switch `.photoImg` to `contain`** on the existing
  surface, no blur (resolved 2026-09-15, user). ✅ DONE 2026-09-15: `OfferingAttachmentsEditor.module.css`
  `.photoImg { object-fit: contain }` + `.photo { background: var(--sp-pill-bg) }`; tsc/lint clean.
  Visual check on the Stage 1 screenshot pattern still needs a real photo (Stage 5).

## FINDINGS (pre-existing, not fixed here)
- **F1 — deleting an offering leaves its files in storage.** ✅ **Closed 2026-09-15 by user decision,
  not being done now. NOT fixed:** the orphaned files remain possible. `offerings.service.ts:101` deletes the row.
  `offering_attachments` rows cascade, but the objects in `offering-photos` (public) and
  `offering-attachments` remain as unreferenced bytes. Worth its own item. It is the same missing
  sweep that option T would need.
- **F2 — mobile kiosk parity.** `ezzy-vendor-mobile/src/services/kiosk.service.ts:102` already
  resolves photo URLs for the future catalogue (mobile plan Stage 3). Once D2/D3 are settled, that plan
  should adopt the same fit and code placeholder. This is a cross-plan note only.
  ✅ **DONE 2026-09-15**: note written into `.plans/2026-09-03-vendor-mobile-kiosk-mode.md`
  ("Evidence and Corrections" bullet, the parity rule on photos, and an I2 "Carry forward from
  web" block). A read-only look found mobile commit `f1359cc` already has a `KioskCatalogue`
  (every photo shown, "Photo unavailable" on failure, per-card Choose), so the note names those
  as parity gaps. It also flags, without reassessing, that the mobile Stage table still reads
  Stage 3 as TODO. No mobile code changed.

- **F3 — a blank price saves as a free offering.** `useOfferingForm.ts:76` `parseInt(ofPrice) || 0`,
  and `canSave` does not require a price. ✖ **No action** (2026-09-15, user). Free offerings are a
  real product need, and D4 = I already asks for a non-blank price (an explicit `0` is allowed)
  before the upload-triggered save. **Add Offering is unchanged.**

- **F4 — offerings over the limit show "3 of 1 used".** Seen in the Stage 1 script (existing
  3-photo offering). The count is accurate and the only effect is an odd-looking counter on offerings
  uploaded before 2026-09-15. ✅ **DONE 2026-09-15 (user: "reword it for now")**: the hook
  exposes `photoCountLabel` ("3 photos · limit 1" when over the limit, otherwise "n of max used"),
  replacing the now-unused `maxPhotos`. Verified: tsc and eslint clean; Stage 1 script re-run on
  next dev (real Edit Offering form): 3-photo offering "3 photos · limit 1"; 0-photo "0 of 1 used";
  after upload and with 1 photo, "1 of 1 used". Add photo, arrows and COVER states unchanged from I1.

## Execution order
0. **Baseline, read-only:** vendor `npx tsc --noEmit`, `npm run lint`, unit tests. Run a throwaway
   Playwright measurement (scratchpad, uncommitted, fake session as in plan 2026-09-14
   next-customer-reset) that loads `/kiosk` with 20 offerings and records `.actions` bottom vs
   viewport height and `.content` scrollHeight/clientHeight. This confirms the B1 root cause before
   anything changes.
1. **I1 + I4** (photo limit, copy, docs, test assertion). Independent of every visual decision and
   safe to run once the plan is approved.
2. **B1** (after D1, D5).
3. **I5 → I2 + I3** (after D2, D3): the hook seam first, so fixtures can cover the new tile, then
   rebaseline the kiosk offering modes scoped and with human review. **D6** goes with this stage if
   approved.
4. **I6** (D4 = I+R), with its guide wording.
5. **Live check** on staging on the real kiosk tablet(s).

## Big table
| ✓ | ID | What | Stage | Who | Status |
|---|---|---|---|---|---|
| [x] | A1 | Upload-before-save assessment (incl. auto-save proposal) | — | Me | ✅ DONE 2026-09-15 |
| [x] | D1–D6 | All decisions resolved | — | You | ✅ DONE 2026-09-15 |
| [x] | Previews | Visual previews published and approved | — | Me → You | ✅ DONE 2026-09-15 |
| [x] | S0 | Baseline checks + measurement confirming B1 root cause | 0 | Me | ✅ DONE 2026-09-15 |
| [x] | I1 | `MAX_PHOTOS = 1`, Add photo hidden when full, arrows/COVER only at 2+, upload guard | 1 | Me | ✅ DONE 2026-09-15 |
| [x] | I4 | Guide copy, guide test, `architecture/portals.md` | 1 | Me | ✅ DONE 2026-09-15 |
| [x] | B1 | Fixed kiosk frame; only content scrolls; Welcome/Finish safe; short screens; signature pad fills frame | 2 | Me | ✅ DONE 2026-09-15 |
| [x] | D5 | Chosen offering name beside the total | 2 | Me | ✅ DONE 2026-09-15 |
| [x] | Commit | Commit Stage 1–4 changes | — | You | ✅ DONE 2026-09-15 (vendor `da57bf5`, root `7cc2bc5`); later edits (F4, Baselines, plans) are yours to commit |
| [x] | I5 | `coverUrlFor` hook seam + gallery fixtures (portrait/landscape/square/no photo/failed) | 3 | Me | ✅ DONE 2026-09-15 (fixture not yet registered) |
| [x] | I2 | Whole photo on blurred fill; failed photo → code | 3 | Me | ✅ DONE 2026-09-15 (geometry script + real-kiosk 404 fallback) |
| [x] | I3 | Offering-code monogram for tiles without a photo (+ guide line) | 3 | Me | ✅ DONE 2026-09-15 (length tier added; all codes fit) |
| [x] | D6 | Editor thumbnail `object-fit: contain` | 3 | Me | ✅ DONE 2026-09-15 |
| [x] | Baselines | Screenshots approved by user; `kioskofferingphotos` registered; saved `--grep kioskoffering --update-snapshots` (2 updated, 2 new); 4/4 passed on 2 re-runs | 3 | You → Me | ✅ DONE 2026-09-15 (full suite 179/179) |
| [x] | I6 | Save on first upload + stay open after Add | 4 | Me | ✅ DONE 2026-09-15 (script: 7 scenarios incl. race, failure, close mid-create) |
| [ ] | Live | Staging + real tablet: orientations, themes, flick-scroll, blur smoothness, signature; real uploads incl. save-on-first-upload | 5 | You | ⬜ TODO |
| [x] | F1 | Deleting an offering leaves storage files | — | You | ✅ Closed 2026-09-15 (your decision: not doing now; not fixed) |
| [x] | F2 | Mobile kiosk should adopt D2/D3 (mobile plan Stage 3) | — | Me | ✅ DONE 2026-09-15 (note + parity gaps written into mobile plan) |
| [x] | F3 | Blank price saves as Free | — | You | ✖ No action 2026-09-15 (free offerings are needed) |
| [x] | F4 | Offerings uploaded under the old limit show "3 of 1 used" → "3 photos · limit 1" | — | Me | ✅ DONE 2026-09-15 (script: 3-photo label confirmed) |

## Verification
**Machine-verifiable**
- `tsc`, lint and the vendor unit tests pass after every stage.
- Grep: `MAX_PHOTOS` is used only in the service and hook, and no photo check appears in `canSave` or
  eligibility (**photo stays optional**).
- Playwright gallery (new `kioskofferingphotos`, updated `kioskoffering`, light and dark):
  **portrait, landscape, square** photos fully visible and centred; **no-photo** tile shows the code;
  **failed** photo shows the code. Run unpiped, logs outside `test-results/`.
- Layout measurement script at **1024×768, 768×1024, 600×960 and 1280×800** with **3 offerings** and
  **20 offerings**: `.actions` is fully inside the viewport; with 20, `.content` scrolls
  (`scrollHeight > clientHeight`) and the document does not (`document.scrollingElement.scrollHeight
  === innerHeight`); after scrolling `.content` to the bottom, the last tile's bottom is above the
  bar's top (**not covered**); tapping a tile then **Continue** reaches the time step while scrolled.
  The same checks run on the Welcome view and on Finish-a-booking with a long results list (top not cut off).
- Pilot guide assertion updated and passing.

**Needs a live environment / human**
- Offering editor on staging: **no photo** → "Add photo" tile visible; upload **one photo** → tile
  **disappears**; remove it → tile comes back; an offering can be **created and activated with no photo**
  and appears on the kiosk.
- An existing offering with 2–3 photos: all still visible and removable, no add tile.
- Real tablet in both orientations, light and dark: bar stays usable while flick-scrolling, no page
  bounce, blur tiles scroll smoothly (otherwise fall back to D2-B), signature pad still usable at
  768px tall, Staff exit reachable.
