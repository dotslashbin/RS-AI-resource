# Booker — square photo on Explore's offering cards, and reset-password button spacing

**Date:** 2026-10-30
**App / scope:** booker/ web only — `components/explore/OfferingResultCard/` (+ its ui-gallery fixtures) and `components/auth/LoginPage/LoginPage.module.css` (I3, added 2026-10-30). Preview at `.plans/previews/offering-photo-square/`. No vendor, command, Expo, schema, RLS or dependency change.
**Status:** COMPLETE (2026-10-30) — release: staging ✅ · production ✅ (Vercel Promote by the user, 2026-10-30; production check skipped by the user's decision)

> Explore's service cards show the offering photo as a square instead of a 118px band. Nothing
> else changes. Optimise for the photo reading as the vendor took it, while keeping the results
> list easy to scan on a phone.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** I# = Important, D# = Decision, F# = Finding (F1–F5 match the preview
> README; F6+ came from the 2026-10-30 gap review), V# = visual check run by the agent in a
> headless browser, S# / P# = staging / production release step. Numbers are plan-local. Qualify
> cross-plan refs by app (e.g. "booker-ui B3").

---

## ▶ RESUME HERE (updated 2026-10-30, plan COMPLETE)
- **Done:** every stage. In production via the user's Vercel Promote (2026-10-30), shipped in the same Promote as
  `2026-10-30-booker-home-square-sidebar-carousel.md`.
- **Live where:** local ✅ · staging ✅ · production ✅.
- **Left open:** F2, F5, F8, F9 remain ⬜ open for the user (not closed by this plan).

---

## Scope

- **In:** the cover of `OfferingResultCard`, its cover pill (D4), and its phone layout (D1-C: a thumbnail row at ≤640px).
- **In (added 2026-10-30, user):** the gap between the two buttons on booker's "Set a new password" screen (I3).
- **Out (2026-10-30, user):** the offering page hero (`OfferingPage`), and the Home cards
  (`OpenTodayCard`, `PopularShelf`, `ShelfCard`), `OfferingCover`, `BookingDetailModal`. These
  keep their current shapes. `ezzy-booker-mobile` has no equivalent card.

## Background (what the code does today)

- `OfferingResultCard.module.css:37–46`: `.cover` is `height: 118px` with a division tint. The
  photo (`.photo`, `:48`) is absolutely positioned with `object-fit: cover`.
- `OfferingResultCard.tsx:43–89`: cover → `.division` pill (bottom-left) → optional
  `.unbookable` chip (top-right) → body → division footer. With no photo, the cover shows a
  centred Ezzy mark | division mark placeholder (`.placeholder`, `:70–76`).
- The grid is `repeat(auto-fill, minmax(230px, 1fr))` (`ExplorePage.module.css:246`,
  `VendorPage.module.css:91`). That is three columns of about 306px on desktop, and one column of 358px at 390px.
- Visual coverage: ui-gallery modes `resultcard` and `resultcardunbookable` (`app/ui-gallery/page.tsx:458–487`),
  baselines in `visual-tests/pilot.spec.ts-snapshots/resultcard*-{light,dark}-chromium-linux.png`.
  Neither fixture passes a `photo`. The comment at `:227` says covers were left out to avoid the
  network. But the same file already has `demoCover()` (`:598`), a `data:` URI cover used for
  exactly this purpose elsewhere.

## Preview

`.plans/previews/offering-photo-square/`. Screens: **1** today · **2** Option A (square, one
column on a phone) · **3** Option B (two columns on a phone) · **4** Option C (thumbnail row on a
phone) · **5** cover vs contain. A, B and C are the same on desktop.

---

## IMPORTANT

### I1 — Square cover on `OfferingResultCard`  ✅ DONE (2026-10-30)
**Files:** `booker/components/explore/OfferingResultCard/OfferingResultCard.module.css` only.
`OfferingResultCard.tsx` changes **only if** the row layout cannot be expressed on the current
DOM. The body and footer are siblings of `.cover` inside the `<button>`, so a row with the text
stacked beside the cover may need one wrapper `<span>` around `.body` + `.foot` (the preview
uses one, `.rc-text`). If it is added, it is markup only, with no logic.
**Gap:** the 118px band crops every upload to a 2.6–3:1 strip.
**Fix approach (D1-C, D2-A, D3-A, D4-A):**
- `.cover`: replace `height: 118px` with `aspect-ratio: 1 / 1`. `.photo` keeps `object-fit: cover` (D2).
- **Placeholder position (F6):** centre `.placeholder` in the square (`position: absolute; inset: 0;
  justify-content: center`), as preview screens 2 and 4 show. The `.division` pill stays bottom-left
  in flow. Mark sizes stay 40/38px on desktop (D3).
- **Placeholder in the 112px phone thumbnail (F7):** at ≤640px the marks shrink to 28/26px with a
  6px gap (the preview's `square-row` rules). At 40/38px they need about 103px, and the thumbnail
  has 92px inside its padding.
- `.division`: `background: var(--division-tile, var(--div-none-tile))` instead of `--db-card-bg` (D4, corrected token).
- `@media (max-width: 640px)` (D1-C): `.card` becomes `flex-direction: row`. `.cover` is a fixed
  112px square (`width: 112px; flex: none; align-self: flex-start`). The text column takes the rest
  of the width with `min-width: 0`, so `.meta`'s ellipsis still works. The `.top` name/price row
  stacks, and padding tightens as in the preview's `square-row` rules. 640px is the breakpoint the
  Explore and Vendor pages already use.
- ⚠️ Check that the "No dates yet" chip (`.unbookable`, `top/right: 8px`) still fits on a 112px
  cover. It does in the preview at 10.5px. V1 asserts it.
- **Reference:** the build matches preview screen 2 on desktop and screen 4 at ≤640px. Where the
  plan and the preview disagree, stop and ask.
- No change to `ExplorePage.module.css` or `VendorPage.module.css`: the grids stay as they are, and
  at 390px they are already one column.
- Delete only the rules the change makes obsolete (`height: 118px`).

✅ **Executed 2026-10-30.** CSS only, in `OfferingResultCard.module.css`. `.cover` uses `aspect-ratio: 1 / 1`.
`.division` sits on `--division-tile`. `.placeholder` is absolutely centred. A new `@media (max-width: 640px)`
block lays the phone row out as a **grid on the existing three children** (cover spanning two rows,
body and footer beside it), so **`OfferingResultCard.tsx` was not changed** and no wrapper was needed. The
marks shrink to 28/26px in the thumbnail. **Verified:** `tsc --noEmit` exit 0; `npm test` 323/323;
lint 18 problems, the pre-existing count, with none in the changed lines; the I2 baselines read by
eye; V1 green.

**Component separation:** `OfferingResultCard` stays a pure display component (no state,
effects or handlers of its own; `onOpen` is a prop). All styling goes in its `.module.css`, and
no new `style={{}}` is added (the existing mask-image inline styles are genuinely dynamic and stay
as they are). No new component or hook.
**Verification:** machine — `npx --prefix booker tsc --noEmit -p booker`,
`npm --prefix booker run lint` (no new warnings), `npm --prefix booker test`, I2 baselines, V1
(local, real photos). V2 on staging.

### I2 — Visual coverage for the photo branch of the card  ✅ DONE (2026-10-30)
**Files:** `booker/app/ui-gallery/page.tsx` (`RESULTS` / the `resultcard` modes),
`visual-tests/pilot.spec.ts` (mode list, only if a new mode is added), and the baselines.
**Gap:** no fixture renders the card **with a photo**, so the main change in I1 has no visual check.
**Fix approach:** pass `photo={demoCover(...)}` to one of the three `resultcard` cards, reusing the
existing `data:` helper, so there is no network. Update the `:227` comment.
For the phone row layout (D1-C), add a mode **`resultcardnarrow`**: the same three cards in a
**single-column** grid, with one of them marked `unbookable`, and add it to the `NARROW` loop in
`visual-tests/pilot.spec.ts:117–118`.
⚠️ Do **not** just add `resultcard` to that loop. Its fixture grid is an inline
`repeat(3, 236px)`, which overflows 390px and would put the row layout inside a 236px column,
giving a baseline of a state that never ships. Regenerate `resultcard*` and the new
`resultcardnarrow-narrow-*` baselines, and **only** those. Review every changed PNG by eye.
**Verification:** machine — `npm --prefix booker run test:visual`, with the full exit code and
failure count read (memory: never pipe through `tail`). `csp.spec.ts` still green, which proves no network.
✅ **Executed 2026-10-30.** `resultcard` gained a fourth card, the first one again with
`demoCover()`. The new `resultcardnarrow` mode is a single column with a photo card carrying "No
dates yet", registered in the `NARROW` loop. Scoped regeneration
(`--grep "ui-gallery (resultcard|loginreset)" --update-snapshots`): 8 passed. Changed:
`resultcard-*`, `resultcardunbookable-*`, `loginreset-*`. New: `resultcardnarrow-narrow-*`. All
read by eye. **Full suite:** 175 passed, 2 failed (`sidebar-light`/`-dark`, 890 px). Those two are
**not this plan's**: see F10. `csp.spec.ts` passed.

### I3 — Space the two buttons on the "Set a new password" screen  ✅ DONE (2026-10-30)
*Added 2026-10-30 at the user's request ("fix the spacing of the buttons in the reset password form").*
**File:** `booker/components/auth/LoginPage/LoginPage.module.css:101–102` (`.primaryBtn`, `.secondaryBtn`).
Markup: `LoginPage.tsx:239–241`, the `loginView === "reset"` branch.
**Gap:** **Update Password** and **Back to Sign In** are stacked with **no gap**: the secondary
button's border touches the primary button's glow. Both are full-width buttons with no margin.
The committed baseline `visual-tests/pilot.spec.ts-snapshots/loginreset-{light,dark}-chromium-linux.png`
shows it.
**Which form:** the request said "reset password". booker has two such screens. The email-request
screen is titled "Reset password" (`LoginPage.tsx:184–201`, `loginView === "forgot"`), but it has
only **one** button, so it has no button spacing to fix (checked against `loginforgot-dark`).
The two-button screen is the recovery-link one titled "Set a new password". That is the one this item fixes.
**Fix approach: copy vendor's existing fix**, one rule after `.secondaryBtn`:
`.primaryBtn + .secondaryBtn { margin-top: 12px; }` with vendor's comment
(`vendor/components/auth/LoginPage/LoginPage.module.css:193–195`, vendor commit `3f6e076`
"Added spacing between buttons"). Because it is an adjacent-sibling rule, the "Check your inbox"
screen's lone **Back to Sign In** (`LoginPage.tsx:212`, after a paragraph) keeps its spacing. No markup change.
**Component separation:** CSS only, in the existing `.module.css`. `LoginPage.tsx` is untouched,
and `useLoginPage.ts` is not involved.
**Verification:** machine — regenerate **only** `loginreset-light` / `loginreset-dark`, and confirm
`loginsent-*` and every other `login*` baseline stays green unchanged, which proves the rule hits
nothing else. I read the two new PNGs myself: about a 12px gap, matching vendor.
⚠️ No live check: the screen is reachable only from a password-recovery email link, which a
headless run cannot follow. The gallery baseline renders the same component (`initialView="reset"`)
and is the check. V1/V2 do not cover it.
✅ **Executed 2026-10-30.** Vendor's rule and comment were added after `.secondaryBtn`, and the
`.tsx` is untouched. **Verified:** `loginreset-*` regenerated, showing a 12px gap, read by eye.
`loginsent-*` and every other `login*` baseline passed unchanged in the full run, so the rule
touches nothing else.

## VISUAL CHECKS (run by the agent, headless)

Both checks use one script kept in the scratchpad, never in the repo: Playwright + Chromium,
headless. It captures **Explore results** and **one Vendor page**, at **1280×800 and 390×844**, in
**light and dark** (8 screenshots per environment). booker has no URLs (internal `PageId` state),
so the script clicks: the Explore tab, then a result, then "All N services".
Theme is set through `localStorage.theme`, as the gallery spec does.

**Machine assertions, per card on screen:**
1. `.cover` is square: |width − height| ≤ 1px. At 390px it is 112px wide, and the card is a row.
2. Every cover `<img>` has loaded (`naturalWidth > 0`).
3. No horizontal page overflow (`scrollWidth ≤ innerWidth`).
4. The placeholder marks, the `.division` pill and the "No dates yet" chip sit inside the cover's box.
5. The `.division` pill's text against its plate is ≥ 4.5:1, computed from `getComputedStyle`, in both themes.

**Then I read every screenshot myself** and compare it with preview screens 2 and 4. A machine
pass is not a design pass: the assertions cannot tell whether a crop looks bad.
Screenshots and a one-line result per assertion go in the stage report. Screenshots stay in the
scratchpad, because they show real vendor names and photos and do not belong in the repo.

### V1 — Local, after I1 + I2  ✅ DONE (2026-10-30)
🤖 Starts `next dev` from `booker/` on **:3200**. That needs no dev server already running on
booker (Next locks per project directory): **if :3000 is running at that point, I ask you to stop
it, rather than stopping it myself.** Local Supabase must be up. Stop the server afterwards by its
listening PID.
Signs in as the **local seed booker** `liza@bookdeck.com`, using the dev-only password committed in
`backbone/supabase/seed.sql:9`. That is a local fixture: it exists in no hosted project.
Local has 4 photo offerings. The script logs each photo's natural size, so the report says which
shapes were actually covered.
**Verification:** the five assertions pass in all 8 captures, and my read of each screenshot is in the report.
✅ **Executed 2026-10-30** against `next dev` on :3200 (the user stopped their :3000 server first).
Explore and the Vendor page (Citywide Sports Center), at 1280 and 390, light and dark: **all five
assertions ok in all 8 captures**. 6 cards each. Minimum pill contrast **5.89:1**: the deep-on-tile
pairing, `ezzy-court`'s measured worst case. Photos covered: **275×183 (3:2), 516×387 ×2 (4:3),
1024×1024 (1:1)**. ⚠️ **No portrait upload exists locally**, so a portrait crop was seen only in the
preview. V2 on staging covers whatever real shapes staging has.
**Screenshot read:** the crops are clean, the placeholder marks are centred, the "Court" pill is
legible over photos in dark, and the phone rows match preview screen 4. The phone captures show
the fixed bottom tab bar mid-page, which is a full-page capture artefact, not layout. The server
was stopped by its listening PID, and the local session file was deleted.

### V2 — Staging, after S2  ✖ ABORTED (2026-10-30), replaced by the user's own visual check
🤖 The same script against `https://staging-booker.ezzy.ph`, signed in per D5, plus a check that
the footer shows the new version string (S2's check). Read-only: it opens pages and makes no
booking, no edit and no payment.
**Verification:** as V1. ⛔ Gates P3.
✖ **Not run (2026-10-30).** The D5-A sign-in window opened on staging, but it closed before a
sign-in, so no session was saved and no staging session token was ever held. Asked whether to
reopen it, the user answered: *"I've checked it myself and saw the changes."* **Staging acceptance
is therefore the user's own visual check**, recorded as their dated decision at the S4 gate (§12: a
staging check that did not run does not quietly open production). The five machine assertions were
**not** run against staging data, so their staging coverage is V1's local run only.

## FINDINGS
- **F1** — a full-width square on a phone makes each card about 3× taller. → D1.
- **F2** — a square crops the edges of non-square uploads, and the vendor editor has no framing
  hint. → D2. The vendor-side hint is a follow-up for a separate vendor plan. ⬜ open for the user.
- **F3** — the no-photo placeholder leaves a lot of empty tint in a square. → D3.
- **F4** — the cover's `.division` pill (`--db-card-bg`, translucent in dark) nearly disappears over a
  photo in dark mode. This is an existing problem, and a bigger photo makes it worse. → D4.
- **F5** — the cover pill and the footer both name the division. Recorded only. ⬜ open for the user.
- **F6 (gap review, 2026-10-30)** — **correction:** the no-photo placeholder is **not** centred
  today. `.placeholder` (`OfferingResultCard.module.css:71–76`) is a flex child of `.cover`
  (`display: flex; align-items: flex-end`), so the marks sit bottom-left next to the pill. The
  committed `resultcardunbookable-dark` baseline shows this. The preview drew it centred, and that
  is what the user approved, so I1 now centres it explicitly. Without this, a square would leave
  the marks in the bottom corner under a large empty tint.
- **F7 (gap review)** — at 40/38px the marks plus gaps need about 103px, more than the 112px phone
  thumbnail has inside its 10px padding. Handled in I1 by shrinking them at ≤640px, as the preview does.
- **F8 (gap review, existing, out of scope)** — in the `resultcard` baseline, the third card's price
  `₱ 500.00 / 30 min` is clipped at the 236px card's right edge, because `.price` is `nowrap`. It
  is unchanged by this plan on desktop. On a phone the row layout stacks name and price, which
  removes it there. ⬜ open for the user.

- **F10 (2026-10-30, not this plan's work)** — the booker working tree holds an uncommitted edit
  to `components/layout/Sidebar/Sidebar.tsx:59` (the tagline "Client Portal" → "Connect. Book. Grow."),
  which this plan did not make. It fails `ui-gallery sidebar-light` / `sidebar-dark` (890 px, 1%).
  The baselines were **not** regenerated, because that would accept someone else's work in progress.
  Whoever owns the edit regenerates them when it is committed.
  ✅ **Closed by the user (2026-10-30):** the user reverted the edit (`git restore`, after saving it
  to `/tmp/sidebar-tagline.patch`). No plan recorded it, and it contradicted the approved "Client
  Portal" (`2026-10-25-booker-visible-branding-cleanup.md` E2/E3). The `sidebar-*` baselines were
  never changed, so they match the restored file. Not re-run since the revert: the next full
  visual run should show 177/177.
- **F9 (2026-10-30, cross-app, out of scope)** — **command** has the same touching buttons:
  `command/components/auth/LoginPage/LoginPage.tsx:219` stacks the same pair, and
  `command/components/auth/LoginPage/LoginPage.module.css:450` has no sibling rule. Vendor was
  fixed in `3f6e076`. Fixing command is a second app, so it needs its own approval (core rules)
  and is not in this plan. ⬜ open for the user.

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains — see §7. -->
- Scope → **Explore cards only (`OfferingResultCard`); everything else unchanged** (resolved 2026-10-30, user).
- **D1 — Phone layout** → **C: a 112px square thumbnail beside the text on a phone** (resolved
  2026-10-30, user took the recommendation). Desktop is the same for all three options. Also considered:
  (A) one full-width square per row, with about 1.3 cards on the first screen;
  (B) two columns of about 171px squares, which touches the Explore and Vendor grids and makes the text tight.
  C keeps the photo square everywhere and five or six results on the first screen, and the change stays CSS-only inside the card.
- **D2 — Crop or letterbox non-square uploads?** → **A: `cover`, crop to fill the square, as today**
  (resolved 2026-10-30, user). The rejected option was B, `contain`: the whole photo on the division
  tint. Cropping matches every other booker photo, and real photos are mostly centred.
  **Context (2026-10-30, after the user asked who does the cropping):** the browser crops at
  display time (`object-fit`). The stored file is never changed, and the vendor has no crop
  tool. ⚠️ The vendor side already went the other way: the attachments editor
  (`vendor/components/offerings/OfferingAttachmentsEditor/OfferingAttachmentsEditor.module.css:66–67`,
  plan 2026-09-14 D6) and the kiosk tile both use `contain`, "so the vendor sees the whole photo a
  customer will see rather than a crop of it". booker's `cover` cards already break that promise
  today, and a square makes the difference bigger for wide photos. The user chose cropping knowing
  this. F2's vendor-side framing hint is still the follow-up that softens it.
- **D3 — No-photo placeholder in a square** → **A: keep the marks at their current size (40/38px)**
  (resolved 2026-10-30, user took the recommendation). The rejected option was B: scale them to about 56px.
- **D4 — Fix the dark-mode cover pill (F4) in this plan?** → **A: yes, give `.division` an opaque
  plate** (resolved 2026-10-30, user took the recommendation). It is a CSS change in the same file,
  and it comes into I1's scope.
  ⚠️ **Token corrected 2026-10-30, during the step-3 review, before approval:** the plate is
  **`--division-tile`**, not the `--db-panel-bg` first proposed. The pill's ink is inherited from
  `.cover` as `--division-deep`, and that token is the same in both themes. On `--db-panel-bg`'s
  dark value (`#1e283d`) it would be dark ink on a dark plate (booker `AGENTS.md` → "Division
  colours": `ezzy-home` measured 1.21:1 on a dark surface). `--division-deep` on `--division-tile`
  is the pairing `lib/palette.test.ts` already asserts: AA for every division, worst `ezzy-court`
  at 5.89:1. The tile stays light in dark mode by design, so the pill reads the same in both themes.

- **Production check** → **skipped** (decided 2026-10-30, user: "since these are all cosmetic, skip
  the production test"). P4 is ✖. Production is still a Vercel Promote of the exact staging
  deployment that V2 checked, so what reaches production is what was looked at.
- **Who does the visual checks** → **the agent, in a headless browser** (decided 2026-10-30, user:
  "I also want you to do the visual checks so I don't have to"). See V1 and V2.
  Feasibility checked 2026-10-30: Playwright's Chromium launches headless in this WSL session, local
  Supabase is up with 4 offerings that have real JPG photos, and nothing is listening on
  :3000 or :3200.
- **D5 — How does the agent sign in to staging for V2?** → **A: the user signs in once in a visible Chromium window; the headless run reuses the saved session** (resolved 2026-10-30, user: "go with A"). The session file lives only in the scratchpad and is deleted after V2. It is never copied into the repo. The rejected options were: booker shows nothing but the login
  screen until someone signs in (`AppShell` login gating), so a headless browser needs a staging
  booker session.
  (A) **You sign in once in a visible Chromium window that I open** (WSLg, `DISPLAY=:0`). Playwright
  saves the session to a file in my scratchpad, and the headless run reuses it. I never see the
  password, but I do hold a live staging session token for the length of the run. I delete the file
  afterwards and never copy it into the repo.
  (B) You give me a staging test account's password. *Not recommended* (core rules: no credentials
  without a safe handling path).
  (C) Skip V2. V1 runs locally against real photos and the same code, and staging gets no visual check.
  *Recommend A.* Staging has the real vendor photos, which local has only four of, and A keeps the
  password with you.

## DEFERRED / COSMETIC
- Next `<Image>` / `srcset`. Needs a `next.config` remote pattern, and it is a performance change, not a shape change.
- Removing the duplicated division name (F5). That is a design change beyond the request.

## Execution order
1. **Stage 1 — I2 photo fixture first (baseline before), then I1, then regenerate `resultcard*`
   + the new `resultcardnarrow` baselines; I3 (independent, one CSS rule, regenerate `loginreset-*`);
   then V1.** Approved 2026-10-30.
2. **Stage 2 — Staging release** (S1–S3, then V2 as S4).
3. **Stage 3 — Production release** (P1, P3). P4 skipped by the user. Always last.

## Release (§12)
No migration, no Edge Function, no secret or env var. Booker app deploy only.

### Staging (production untouched throughout)
| # | Who | Step | Check |
|---|---|---|---|
| S1 | 👤 | Bump booker version, commit (draft via commit-drafting skill) | ✅ commit `8cf000c` (2026-10-30, user). Version bump not confirmed in session |
| S2 | 👤 | Deploy booker to staging (Vercel) | ✅ deployed 2026-10-30 (user), `https://staging-booker.ezzy.ph/` |
| S3 | 👤 | Tell me the staging deployment URL/ID (needed for P3, and so V2 checks that exact deployment) | ✅ URL given 2026-10-30. P1 still needs the Vercel deployment ID |
| S4 | 👤 | ~~V2 headless check~~ → **the user's own visual check** (decided 2026-10-30, user) | ✅ "I've checked it myself and saw the changes" (2026-10-30). V2 ✖, see the V2 item |

⛔ **Staging fully green before anything touches production.**

### Production (last stage)
| # | Who | Step | Check |
|---|---|---|---|
| P1 ✅ | 👤 | Parity: no DB/function changes, so confirm only that the S3 deployment is the one to promote | ✅ user, 2026-10-30 |
| P2 | — | n/a (no migration / Edge Function) | — |
| P3 ✅ | 👤 | Vercel **Promote** of the staging deployment the user checked | ✅ promoted by the user, 2026-10-30 |
| P4 | — | ✖ **ABORTED (2026-10-30, user)**: no production check. These are cosmetic changes, and P3 promotes the exact deployment V2 checked | — |

## Verification
- I1 — machine: `tsc --noEmit`, lint, `npm test`, I2 baselines. Visual: V1 (local, agent), V2 (staging, agent).
- I2 — machine: `npm --prefix booker run test:visual`, `csp.spec.ts` green.
- I3 — machine: `loginreset-*` regenerated and read by me. Every other `login*` baseline unchanged and green.
- Preview — machine: `node .plans/previews/_shared/shoot.mjs offering-photo-square` (20 cells, 9 checks, 0 failures on 2026-10-30).
