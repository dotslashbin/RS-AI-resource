# Vendor — selfie-with-ID guide: replace the face oval with a centre dot

**Date:** 2026-07-29
**App / scope:** `vendor/` only — `components/kyc/CameraCapture/*`, `components/kyc/IdentityStep/IdentityStep.tsx` (copy), `architecture/vendor-kyc.md` (doc). No schema, no API, no other app.
**Status:** COMPLETE (2026-07-29) — all items ✅; one live-device check remains with the user, and two pre-existing issues were found and logged (F1, F2) rather than fixed

> One-line framing: make the selfie-with-ID overlay easier to self-align **and** easier for a Command reviewer to verify afterwards, by removing the face oval and marking the face centre with a single high-contrast dot on the **same vertical axis as the (unchanged) ID card frame**.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, C# = Cosmetic/Deferred; numbers are plan-local — qualify cross-plan refs by app (e.g. "command I1").

---

## Current state (verified by reading the code)

| Thing | Where | Fact |
|---|---|---|
| Overlay markup | `vendor/components/kyc/CameraCapture/CameraCapture.tsx:59-68` | `.guide` wrapper; `guide === "id"` → `.idFrame`, else `.faceOval` + `.heldId` |
| Face oval | `CameraCapture.module.css:55-63` | `top:34% left:50%`, `width:min(48%,210px)`, `aspect-ratio:0.78`, 2px **dashed blue** `rgba(96,165,250,.9)`, `border-radius:50%` |
| Card frame (selfie) | `CameraCapture.module.css:64-72` | `.heldId` — `top:70% left:50%`, `width:min(56%,260px)`, `aspect-ratio:1.586`, 2px **dashed amber** `rgba(255,194,0,.9)`, radius 10px. **Works; do not change.** |
| ID-only frame | `CameraCapture.module.css:43-52` | `.idFrame` — separate class, amber solid + 9999px scrim. **Not touched by this plan.** |
| Consumers | `IdentityStep.tsx:46`, and `KycStatusPage.tsx:108` (resubmit surface) → both reach the same `CameraCapture` | Only **one** selfie overlay exists; no duplicate to keep in sync |
| Capture path | `useCamera.ts:57` → `lib/captureImage.ts` | Draws the raw `<video>` frame to canvas. **The overlay is never burned into the saved JPEG** — guidance only |
| Copy | `IdentityStep.tsx:50` | `"Center your face in the oval and hold your ID beside it…"` — names the oval (about to be removed) and says *beside*, while the geometry stacks the card *below*. Already inconsistent today |
| Tests | `vendor/visual-tests/pilot.spec.ts` + `/ui-gallery` | Gallery has **no** camera mode → **no pixel baseline covers this component** |
| Mirroring | `.video` (`CameraCapture.module.css:36`) | Front-camera preview is **not** mirrored. See D2 |

**Existing conventions this must respect:** `CameraCapture.tsx` is already a pure render layer (all state in `useCamera.ts`, all geometry in the `.module.css`) — per `.claude/skills/component-separation/SKILL.md`. This change keeps that split: **CSS-only geometry + one JSX element swap + copy strings. No new state, no new hook, no inline `style={{}}`, no new component, no new dependency.**

---

## How others do it (grounding, not copied)

- **Incode (face capture design):** keep "a clear, unobstructed silhouette for proper alignment"; never drop overlay opacity below 50% because it hurts face visibility; instructions must be concise and high-contrast. → *Argues for the dot over the oval: less occlusion of the face itself.*
- **Kairos / Smile ID / Veridas:** the **whole document including all four edges** must be visible, shot parallel, no tilt; face and document each want ~60–70% of frame in *separate* shots. → *In a combined shot both cannot be 60–70%, so the card frame stays the anchor and the face guide must not imply a competing size.*
- **OneSpan / Jumio:** ovals are the norm for **selfie-only/liveness** capture, where the oval doubles as a distance gate for the matcher. We have **no** face detection or liveness (documented as out of scope in `.plans/2026-07-06-kyc-id-selfie-capture.md:40`), so our oval buys nothing but occlusion — it is a guide masquerading as a gate.
- Sources: [Incode face capture](https://developer.incode.com/docs/face-capture-design) · [OneSpan capture guidelines](https://docs.onespan.com/docs/document-and-selfie-capture-guidelines) · [Kairos best practices](https://www.kairos.com/post/best-practices-for-id-document-and-selfie-submissions) · [Smile ID document capture](https://docs.usesmileid.com/further-reading/faqs/what-are-good-document-capture-best-practices) · [Veridas selfie-with-ID](https://veridas.com/en/selfie-with-id/)

**Design consequence worth stating up front:** a *hard* head-sized bracket would fight the card frame. The card frame is `56vw` wide; a real head is ~1.7× a card's width, so at the distance where the card fits its frame, the head occupies ~95% of the frame width. Any box drawn narrower than that tells the user to step back — which breaks the card fit. So the face guide should assert **position, not size**. This is why D1's recommended option uses a dot + height ticks and *not* a head outline.

---

## BLOCKERS

### B1 — Replace `.faceOval` with a centred face dot on the card's axis  ✅ DONE (2026-07-29)
<!-- Executed: .faceOval deleted; .faceDot (top 32%, 14px, white + dark ring) and
     .faceLine (edge ticks at the same 32%) added to CameraCapture.module.css;
     CameraCapture.tsx renders .faceLine + .faceDot + .heldId.
     Verified: measured in a scratchpad harness running the REAL module.css at
     390x844 / 768x1024 / 900x1200 — dot centre-x == card centre-x to Δ=0.00px at
     every viewport, dot→card gap 187/242/309px, ticks share the dot's centre-y to
     Δ=0.00px. Screenshots confirm the dot and ticks read against both a dark and a
     white backdrop (the ticks needed a dark outline added to achieve this — see F2
     note in Findings). `git diff` confirms .heldId and .idFrame are byte-identical.
     tsc clean. NOT yet verified on a real camera — that row is the user's. -->
<!-- Deviation from the plan as written: the tick pseudo-elements shipped at 2px
     tall / rgba(255,255,255,.8) with a 1px dark box-shadow, not 1px/.45 plain —
     the plain version was invisible against a white wall in the first screenshot. -->

**Files:** `vendor/components/kyc/CameraCapture/CameraCapture.module.css:55-63` (delete `.faceOval`, add `.faceDot`), `vendor/components/kyc/CameraCapture/CameraCapture.tsx:64` (swap the element)

The oval occludes the face and implies a size gate that nothing enforces. Replace it with one small filled dot marking the **middle of the face**, sitting on the **same vertical centre line as `.heldId`** (both `left:50%` — the axis is shared by construction, and a CSS comment will record that the two must stay coupled).

Exact CSS to be written (final form depends on D1):

```css
/* Selfie guide. The card frame (.heldId) is the anchor and is unchanged; the
   face is marked by a single dot on the SAME vertical axis (left: 50%) so the
   captured photo always has face-over-card centred — easy to shoot, easy to
   verify later. Keep both at left: 50%; they are a pair. */
.faceDot {
  position: absolute;
  top: 32%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  /* Dual-tone: the dark ring keeps a white dot visible on a bright wall or a
     pale forehead, the soft glow keeps it visible against dark hair. */
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.55), 0 0 8px 2px rgba(0, 0, 0, 0.3);
}
```

**Why `top: 32%`** — the removed oval was *centred* at 34%; its visual mass sat lower than its centre point read. 32% keeps the dot comfortably clear of the card frame's top edge at every viewport that matters (see the clearance table in Verification) while staying in the natural head zone.

Per **D1**, the dot is accompanied by two edge ticks at the *same* height — they share `top: 32%` with the dot so the three marks read as one horizontal reference, and a comment records that coupling:

```css
/* Height reference for the face: short ticks in from each edge, at the SAME
   top as .faceDot. Deliberately does NOT enclose the head — a box would imply
   a head size that fights the card frame's implied distance. */
.faceLine {
  position: absolute;
  top: 32%;
  left: 0;
  right: 0;
  height: 0;
}
.faceLine::before,
.faceLine::after {
  content: "";
  position: absolute;
  top: 0;
  width: 28px;
  height: 1px;
  background: rgba(255, 255, 255, 0.45);
}
.faceLine::before { left: 0; }
.faceLine::after  { right: 0; }
```

**Fix approach:** delete `.faceOval`; add `.faceDot` + `.faceLine`; in `CameraCapture.tsx` replace `<div className={styles.faceOval} />` with `<div className={styles.faceLine} />` and `<div className={styles.faceDot} />`, leaving `<div className={styles.heldId} />` in place. `.heldId` and `.idFrame` are untouched, byte for byte. If B1's `top` is ever tuned, both `.faceDot` and `.faceLine` must move together — noted in the CSS comment.

### B2 — Fix the instruction copy that names the removed oval  ✅ DONE (2026-07-29)
<!-- Executed: camInstructions → "Put the dot on the middle of your face and your
     ID inside the frame — keep both sharp." (86 chars); slot desc → "…just below
     your face."
     IMPORTANT deviation: the copy the plan specified (141 chars) was measured and
     REJECTED — it grew the instructions banner to 159px tall on a phone, covering
     the card frame by 130px and spilling onto tablet (11px). Shipped copy is 86
     chars, matching the old copy's line count. This is what turned up F1 below. -->

**File:** `vendor/components/kyc/IdentityStep/IdentityStep.tsx:50` (and `:37`/`:47` slot `desc`)

`camInstructions` currently reads *"Center your face in the oval and hold your ID beside it — both must be clearly visible."* After B1 there is no oval, and "beside" already contradicts the stacked geometry. Leaving it is a user-facing lie, hence BLOCKER rather than polish.

**Fix approach:** replace with geometry-true, action-first copy:
- `camInstructions` → `"Put the dot on the middle of your face, then hold your ID inside the frame below — keep your face and every edge of the ID visible and sharp."`
- slot `desc` (`:47`) → `"A photo of yourself holding the same ID just below your face."` (currently "next to your face")

Keeps the concise/high-contrast guidance principle; no other copy changes.

---

## IMPORTANT

### I1 — Mark the guide overlay as decorative for assistive tech  ✅ DONE (2026-07-29)
<!-- Executed: aria-hidden="true" on the .guide wrapper (CameraCapture.tsx:59).
     Verified by diff + tsc; guidance still reaches AT via the .instructions <p>. -->

**File:** `vendor/components/kyc/CameraCapture/CameraCapture.tsx:59`

`.guide` is `pointer-events: none` but still in the a11y tree as anonymous empty `div`s. All actual guidance is already in the `.instructions` paragraph (`:69`), which is the accessible path.

**Fix approach:** `<div className={styles.guide} aria-hidden="true">`. One attribute; per `.claude/skills/ux-design/SKILL.md` (decorative visuals shouldn't be announced).

### I2 — Post-change code review of the KYC capture path  ✅ DONE (2026-07-29)
<!-- All 7 checklist items ran; results in Findings below. Two real problems were
     found (F1 banner/card overlap — fixed; F2 invisible ticks — fixed) and two
     pre-existing issues were found and logged, NOT fixed (F3 lint, F4 landscape,
     F5 visual baselines). -->

**Scope:** `CameraCapture.tsx`, `useCamera.ts`, `CameraCapture.module.css`, `lib/captureImage.ts`, `IdentityStep.tsx` + `useIdentityStep.ts`, `KycStatusPage.tsx` call site

Explicit gap/bug hunt after B1–B2 land, then fix what is found **inside this plan's scope**; anything larger gets appended here as new items rather than silently fixed (per AGENTS.md "Surgical Changes"). Checklist:
1. `grep -rn "faceOval" vendor/` → must be **0** hits (no orphaned class, no stale reference).
2. No unused CSS or imports left behind; `guide` union type still exhaustive at both call sites (`IdentityStep.tsx:46`, `:36`).
3. Both consumers of `CameraCapture` (stepper + resubmit surface via `KycStatusPage.tsx:108`) render the new guide — same component, so confirm by reading, not assuming.
4. `captureImage` still receives the raw video element (overlay must **not** leak into the saved JPEG) — confirm by reading `useCamera.ts:57-67`.
5. Camera-lifecycle regressions: tracks stopped on close/unmount, object URL revoked (`useCamera.ts:26-33`, `:77`) — untouched by this change; confirm no accidental edit.
6. Dot legibility on both extremes (dark hair / bright wall) and at the smallest supported width.
7. `npx tsc --noEmit` and `npm run lint` clean.

### I3 — Update `architecture/vendor-kyc.md` if the change makes it wrong  ✅ DONE (2026-07-29)
<!-- Executed: vendor-kyc.md "Identity step" bullet rewritten (card frame + centre
     dot + edge ticks, shared vertical axis, and the new sentence that the overlay
     is guidance only and never burned into the stored image). Two more stale spots
     found by the grep and also corrected — vendor-kyc.md "Component conventions"
     ("oval/card frames" → "card frames, face dot") and conventions.md:297, which
     described the same geometry. Verified: `grep -rn -i oval architecture/` now
     returns nothing but the word "approval". Historical .plans/2026-07-06-* left
     untouched by design — they record what was decided then. -->

**File:** `architecture/vendor-kyc.md:70` — *"…behind an alignment overlay (an ID-card frame; **a face oval + card frame** for the selfie)…"*

That sentence becomes factually wrong the moment B1 lands, so this is a **required** doc edit, not an optional one. Also re-read `:196` (which mentions "oval/card frames" in a historical *decision-rationale* block) and the two `.plans/2026-07-06-*` references — **historical plans stay as written** (they record what was decided then); only the living architecture doc is corrected.

**Fix approach:** rewrite `:70` to describe the card frame + face-centre dot, and add one sentence saying the overlay is **guidance only and is not burned into the stored image**, since that is the fact a future reader most needs and it is currently unstated. Then re-scan `architecture/*.md` for any other overlay description (`grep -rn -i "oval" architecture/`) and confirm nothing else drifts. **This is the final stage** — after B1, B2, I1, I2 are done and verified.

---

## DECISIONS
<!-- Hard gate: no item executes while any OPEN: line remains — plan-authoring §7. -->

- **D1 — how much guidance besides the dot?** → **A: dot + side height ticks** (resolved 2026-07-29) — two short 1px lines (~28px, `rgba(255,255,255,.45)`) coming in from the stage's left and right edges at the dot's height. Gives a height/centring reference to snap to, asserts no head size, occludes nothing over the face. One `.faceLine` element with `::before`/`::after`, ~10 lines of CSS.
  - Not chosen: **B — dot only** (a lone dot is easy to overlook; no height cue). **C — dot + open head bracket**, rejected on engineering grounds: any bracket narrow enough to fit on screen implies a head size that conflicts with the card frame's implied distance (see "Design consequence" above) — it would push users to step back and break the card fit. Documented so it isn't re-invented later.
- **D2 — mirror the front-camera preview?** → **No change, leave unmirrored** (resolved 2026-07-29) — the alignment target is the *centre* of the frame, where mirroring is irrelevant to the task, and a mirrored preview shows the ID text reversed, which reads as "the capture is broken" on a selfie-*with-document* screen. `.video` (`CameraCapture.module.css:36`) is not to be touched.
- **D3 — dot colour.** → **White core + dark ring** (resolved 2026-07-29) — must read against skin, hair and walls; amber stays exclusive to the ID frame so the two markers never read as one thing. Per B1's CSS as written.

---

## FINDINGS FROM EXECUTION (2026-07-29)

### F1 — Instructions banner covered the ID card frame  ✅ FIXED
**File:** `vendor/components/kyc/CameraCapture/CameraCapture.module.css` — `.instructions` `bottom: 96px` → `16px`

Found by screenshotting the first version of the change. Measured overlap of the banner over `.heldId` on a 390×844 phone:

| Copy | Banner height | Overlaps card by |
|---|---|---|
| **Old copy at HEAD** (87 chars) | 100px | **71px — pre-existing** |
| Plan's new copy (141 chars) | 159px | 130px (and 11px on tablet) |
| **Shipped copy** (86 chars) + `bottom: 16px` | 100px | **0px** |

So the banner already obscured half the card frame on a phone **before this task** — the plan's longer copy merely made it obvious. Fixed rather than logged, because a banner sitting on top of the frame the vendor must align their ID to defeats this plan's whole purpose. `.instructions` is shared with the ID-only guide, so that variant was re-measured too: `idFrame` bottom 517 vs banner top 633 on phone, 726 vs 1028 on desktop — **0px overlap, no regression.**

### F2 — Edge ticks were invisible against a bright background  ✅ FIXED
**File:** same CSS, `.faceLine::before/::after`

At the planned `1px / rgba(255,255,255,.45)` the right-hand tick vanished against the white end of the test gradient — the exact failure the dot's dual-tone treatment was designed to avoid, not applied to the ticks. Now `2px`, `rgba(255,255,255,.8)`, with `box-shadow: 0 0 0 1px rgba(0,0,0,.5)`. Re-screenshotted: visible on dark and white.

### F3 — `npm run lint` is broken in vendor  ⏸ PARKED (pre-existing, out of scope)
`eslint` crashes in **config loading** — `TypeError: Converting circular structure to JSON` at `@eslint/eslintrc/lib/shared/config-validator.js:308`, from a circular `plugins.react` reference while normalizing an extended shareable config. Confirmed pre-existing: identical crash with my changes stashed, and it also crashes when linting a single untouched file (`npx eslint next.config.ts`). **Unblocks when** someone repairs the ESLint flat-config/eslintrc interop in `vendor/eslint.config.mjs`. Consequence for this task: **lint could not be used as a verification gate** — `tsc --noEmit` carried it instead.

### F4 — `.heldId` overflows the stage in short landscape  ⏸ PARKED (pre-existing, card must not change)
At 844×390 the card frame is 168px tall centred at 70% of a 242px stage, so it runs 11px past the stage bottom, and the banner unavoidably overlaps it. Measured **identical at HEAD** (`cardBottom=319`, `stageBottom=308` both before and after), so this is untouched pre-existing geometry, not a regression — and the card frame is explicitly off-limits in this task. Widens C2 below.

### F5 — 6 visual baselines were already stale  ⏸ PARKED (pre-existing)
`npx playwright test` → **28 passed, 6 failed**: `sidebar-light/dark`, `dashboard-light/dark`, `loginregister-light/dark`. Re-ran the same 6 with my changes stashed: **identical 6 failures at HEAD** → pre-existing baseline drift from earlier unrelated work, not this change. Worth knowing: no baseline covers `CameraCapture` at all, and the `kycstatus` baseline only captures the loading shell (`app/ui-gallery/page.tsx:143`), while `loginregister` snapshots step 1 of the wizard — so the changed selfie copy at step 5 is outside every baseline either way. **Unblocks when** someone regenerates the 6 with `--update-snapshots` after confirming the current pixels are intended.

### Clean checklist results (I2 items 1–7)
- `grep -rn faceOval` → **0 hits**; no orphaned class or stale reference.
- `git diff` on the CSS shows `.heldId` and `.idFrame` untouched — the "don't touch the card" guarantee holds byte for byte.
- `useCamera.ts` and `lib/captureImage.ts` are **not in the diff** — camera lifecycle (track stop, object-URL revoke) and the raw-frame capture path are intact, so the overlay still cannot leak into the saved JPEG.
- Both consumers (stepper `IdentityStep.tsx:46` and resubmit surface `KycStatusPage.tsx:108`) route through the same `CameraCapture`; `guide` union unchanged and still exhaustive.
- `npx tsc --noEmit` clean.
- Component separation intact: `CameraCapture.tsx` gained one attribute and one element, no state, no inline `style={{}}`; all geometry stayed in the `.module.css`.

---

## DEFERRED / COSMETIC

- **C1 — No camera mode in `/ui-gallery`.** Confirmed during execution: no baseline covers `CameraCapture` (see **F5**), so the visual check was a scratchpad harness + the user's device. Adding a gallery mode would need a fake-media-stream Playwright setup to be meaningful — real work, out of this task's scope. Acceptable because the change is a self-contained overlay with no logic. The harness used (real `module.css` + the same DOM, measuring axis alignment and clearances at 4 viewports) is worth rebuilding if this overlay is touched again.
- **C2 — Extreme-landscape viewport.** Measured at 844×390: dot→card gap collapses to 1px and the banner overlaps the card, because the card frame itself overflows the stage there (**F4** — pre-existing and identical at HEAD). Acceptable: this is a phone-portrait / desktop-portrait flow, and nothing about it is a regression from this change.
- **C3 — No face/ID detection or liveness.** Still out of scope, unchanged from `.plans/2026-07-06-kyc-id-selfie-capture.md:40`. The overlay is a guide, not validation.

---

## Execution order

**Stage 0 — resolve D1/D2/D3.** Blocking gate; nothing below starts until each is answered and recorded inline above with its date.

**Stage 1 — the change (B1 → B2 → I1).** One coherent edit across three files: CSS geometry, then the JSX swap, then copy, then the `aria-hidden`. B1 and B2 must ship together — copy referencing an oval that no longer exists is worse than either change alone.

**Stage 2 — verify (see Verification).** `tsc` + `lint` + the `faceOval` grep, then the geometry harness screenshots, then hand it to you for the on-device camera check.

**Stage 3 — review and fix (I2).** Run the checklist; fix in-scope findings; append anything out of scope to this plan as new numbered items instead of fixing silently. Re-run Stage 2's machine checks after any fix.

**Stage 4 — documentation (I3).** Correct `architecture/vendor-kyc.md:70`, add the "overlay is not burned in" sentence, re-scan `architecture/` for other overlay wording. Last stage, deliberately, so the doc describes what actually shipped.

**Stage 5 — close out.** Mark every item ✅ with its date and how it was verified; flip **Status** to COMPLETE; state plainly which checks were machine-verified and which still need your device.

> **All five stages ran on 2026-07-29.** Files changed (3, all in `vendor/`):
> `components/kyc/CameraCapture/CameraCapture.module.css`,
> `components/kyc/CameraCapture/CameraCapture.tsx`,
> `components/kyc/IdentityStep/IdentityStep.tsx` — plus the two architecture docs
> in I3. No schema, no API, no dependency, no other app. Not committed (vendor is
> its own git repo; commit from inside `vendor/` when you're happy with the device check).

---

## Verification

| Check | Kind | Item | Result |
|---|---|---|---|
| `npx tsc --noEmit` in `vendor/` clean | machine | B1, B2, I1, I2 | ✅ clean |
| `npm run lint` in `vendor/` clean | machine | B1, B2, I1 | ⏸ **could not run** — broken at HEAD, see **F3** |
| `grep -rn "faceOval" vendor/` → 0 hits | machine | B1, I2 | ✅ 0 hits |
| `git diff` shows `.heldId` and `.idFrame` **unchanged** | machine | B1 (the "don't touch the card" guarantee) | ✅ byte-identical |
| Dot's horizontal centre == card frame's horizontal centre (verified in rendered output, not just in source) | harness measurement | B1 | ✅ Δ=0.00px at all 4 viewports |
| Dot clears the card frame's top edge at 390×844, 768×1024, 900×1200 | harness measurement | B1, C2 | ✅ 187 / 242 / 309px gap |
| Instructions banner does not overlap the card frame (added mid-execution) | harness measurement | F1 | ✅ 0px on all three portrait viewports; ID-only guide 0px too |
| Dot + ticks legible over a light and a dark backdrop | screenshot | B1, D3, F2 | ✅ after the F2 fix |
| `architecture/*.md` has no stale "oval" description | machine (`grep -rn -i oval architecture/`) | I3 | ✅ nothing but "approval" |
| `npx playwright test` — nothing else moved | machine | I2 | ⚠️ 28 passed / 6 failed, **identical failures at HEAD** → pre-existing, see **F5** |
| Real camera: open the selfie capture, confirm the dot is easy to align to and the captured JPEG has **no overlay** in it | **needs a live device — yours** | B1, I2 | ⬜ **outstanding** |

**On the screenshot checks, stated honestly (as executed):** the geometry was verified in a throwaway scratchpad harness — the **real** `CameraCapture.module.css`, copied verbatim, applied to the **same DOM** `CameraCapture.tsx` renders, over a dark→skin→white gradient standing in for the video, with Playwright reading actual `getBoundingClientRect()` values at 390×844 / 768×1024 / 900×1200 / 844×390. CSS Modules only hash class names, so the cascade is identical. But this remains **geometry verified in isolation, not in the running app** — it does not exercise `getUserMedia`, the real video aspect ratio, or mobile browser chrome. `visual-tests/pilot.spec.ts` did boot on `127.0.0.1:3100` despite the WSL2 concern (28 passed, 6 pre-existing failures — **F5**), but it covers no camera surface, so it proves only that nothing *else* moved.

**What is still unverified:** the live-device check. Open the vendor register wizard → step 5 → "Selfie with your ID" → Open camera, and confirm (a) the dot is easy to line up with your face while the ID sits in the frame, and (b) the saved photo contains no overlay marks. Nothing in this plan should be treated as proven on a real camera until that is done.
