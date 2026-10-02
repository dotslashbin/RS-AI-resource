# Vendor — post-signup welcome step and "Do it later"

**Date:** 2026-10-01
**App / scope:** `vendor/` only:
- the KYC surface: `components/kyc/KycStatusPage/*`, `components/kyc/KycSubmitForm/*`, `lib/kycView.ts`;
- the signup hand-off: `components/auth/LoginPage/useLoginPage.ts`, `components/layout/AppShell/*`;
- the gallery and visual baselines.

No backend, no migration, no other app.
**Status:** COMPLETE (2026-10-01): U1–U3 and W-F1 done, and **live in production** (staging tested by the user, production released by the user with the signup-before-KYC release). Stage 1 live check 12/12; full vendor visual suite 199/199; baselines committed.

> Right after a vendor creates an account, open the KYC wizard with a celebratory **welcome step** ("You're signed up! / Welcome to Ezzy"). "Do it later" sits right under the sign, then "or", then what verification involves and a primary **Start verification**. On the form screens, "Do it later" replaces the bare "Sign Out".

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** U# = item, D# = decision; numbers are plan-local — qualify cross-plan refs (e.g. "signup-before-kyc B5").

**Approved design:** layout 1 of preview v2, https://claude.ai/artifact/Aikm4e8HHG8yHt1gMQtVba ("Layout 1 · recommended" and "Layout 1 · after Start verification").
Predecessor: `.plans/2026-09-30-vendor-signup-before-kyc.md` (B4/B5 built the signup → KYC form this extends; E2 the 24-hour copy).

---

## Current state (investigated 2026-10-01)

- After **Create account**, `useLoginPage.handleCreateAccount` signs the vendor in and calls `routeSignedInUser(user, onLoginSuccess, onPendingVendor)` (`useLoginPage.ts:~519-601`). That ends in `onPendingVendor(vendorId, suspended)` → `useAppShell.handlePendingVendor` → `AppShell` renders `KycStatusPage`. **Nothing records that this is a fresh signup:** the same path serves every later login.
- The frame's only button is `KycStatusCard`'s fixed **Sign Out** (`KycStatusCard.tsx`; `.signout` in `KycStatusPage.module.css:296-311`), under **every** KYC state.
- `KycSubmitForm` steps are 1–4, held in `useKycSubmitForm` (`step` state, `goToStep`). Step 1 shows an intro line and the type cards.
- `KycStatusPage` has no vendor **name**: it receives only `vendorId`.
- The surface is dark-only and uses gold `#FFC200` (card rule, primary gradient), green `#10b981` (success), and blue `#2563eb` / `#93c5fd` (progress / soft blue).

## ITEMS

### U1 — The welcome step (step 0 of the KYC wizard), shown once after signup  ✅ DONE (2026-10-01, Stage 1)
**Signal (only after Create account):**
- `routeSignedInUser` gains an optional third argument `{ welcome?: { vendorName: string } }`. **Only** `handleCreateAccount` passes it, with `regForm.vendorName` captured **before** the form is reset.
- It forwards it as `onPendingVendor(vendorId, suspended, welcome)`. `useAppShell.handlePendingVendor` stores it in a `welcome` state: **React state only, never storage**. So it is gone on reload, on sign-out and on every later login. "Shown once" holds by construction, and there is no flag to clear.
- `handleLogout` resets it.
- `AppShell` → `KycStatusPage` (`welcome` prop) → `KycSubmitForm` (`welcome` prop).

**Step:**
- `useKycSubmitForm` starts at **step 0** when `welcome` is given, otherwise at step 1 as today.
- `startVerification()` → `goToStep(1)`.
- Step 1 has **no Back** to the welcome screen: it is a one-time greeting, not a wizard page to revisit.
- The "Step n of 4" header and progress bar render only for steps 1–4. Step 0 has its own layout.

**Content (copy as in preview v2, layout 1):**
1. A green check, then "**You're signed up!**" with "**Welcome to Ezzy**" on the next line (gold), then "Your vendor account for **{vendorName}** is ready. One last step before you can take bookings: verify your business."
2. **Do it later**, soft blue (D2), with "You'll be signed out. Sign in any time to pick up here." It calls the page's `onLogout`.
3. A "—— or ——" divider.
4. A **"Verify your business now"** panel:
   - "4 short steps · review takes up to 24 hours after you submit";
   - the numbered steps: Company or individual · Business documents · Valid ID and a selfie holding it · Review and submit;
   - what to have ready (chips): Business permit or DTI / SEC · Valid government ID · Phone camera or photos.
5. A gold **Start verification →**.

**Frame:** on step 0, `KycStatusCard` shows **no** bottom exit, because "Do it later" is already directly under the sign; two exits on one screen would compete.

**Component separation:**
- New pure `components/kyc/KycSubmitForm/KycWelcomeStep.tsx`: props `vendorName`, `onDoLater`, `onStart`; no state, effects or handler bodies; static styles in `KycSubmitForm.module.css` (new classes: hero, welcome line, or-divider, next-panel, steps, chips, later button).
- `KycSubmitForm.tsx` renders it for `step === 0`.
- The check's pop-in animation is CSS only, under `prefers-reduced-motion: no-preference`.
- No inline static styles.

**Risk:** a vendor whose automatic sign-in after signup fails goes to the login screen (predecessor B4's notice path) and signs in normally, so they see no welcome. That is acceptable: they were already told "Your account has been created".

### U2 — "Do it later" replaces "Sign Out" where a KYC task is pending  ✅ DONE (2026-10-01, Stage 1)
**Files:** `KycStatusCard.tsx`, `KycStatusPage.tsx`, `useKycStatusPage.ts`, `lib/kycView.ts`, `KycStatusPage.module.css`.
**Approach:**
- `KycStatusCard` takes `exit: { label: string; tone: "neutral" | "later"; hint?: string } | null` and still calls the same `onLogout`. `null` (the welcome step) renders no bottom exit.
- "Do it later" **signs the vendor out**, because nothing else in the app is reachable before verification. The hint says so.
- The choice per view is a **pure** function in `lib/kycView.ts`, e.g. `kycExitFor(view, onWelcome)`:
  - the welcome step → none;
  - the KYC form (`none`), plus the rejected resubmit editor if D4 is chosen → "Do it later" (soft blue);
  - every other view (under review, awaiting activation, suspended, error, loading) → "Sign Out", unchanged, because there is nothing to postpone.

**Component separation:** `KycStatusCard` stays pure (props only); the decision lives in `lib/kycView.ts` and is called from `useKycStatusPage`. The tone is a CSS-module class (`.signoutLater`), not inline.
**Accessibility:** a real `<button>`, ≥44px tall, with a visible focus ring; the hint is linked by `aria-describedby`.

### Stage 1 result (2026-10-01)
**Built:**
- **Pure logic, in `lib/kycView.ts`:** `KycWelcome` and `kycExitFor(view, onWelcome)`, with 3 tests.
- **New pure `components/kyc/KycWelcomeStep/{KycWelcomeStep.tsx, KycWelcomeStep.module.css}`:** the layout 1 content and copy exactly as planned; the check's pop-in only under `prefers-reduced-motion: no-preference`; a real `<button>` for each action, focus rings, and the hint linked by `aria-describedby`.
- **`KycStatusCard`:** takes `exit` (`null` = none). The new `.signoutLater` class (soft blue) and a focus ring are in `KycStatusPage.module.css`.
- **`useKycStatusPage` / `KycStatusPage`:** `welcome` prop, `showWelcome`, `startVerification`, `exit`.
- **Signal:** `useLoginPage` (`routeSignedInUser`'s 4th argument is passed **only** by `handleCreateAccount`, with `vendorName` captured before the form is reset) → `LoginPage` prop type → `useAppShell` (`kycWelcome` React state; set by `handlePendingVendor`, cleared by `handleLogout`) → `AppShell`.

**Two deliberate differences from the item text:**
1. The welcome state lives in **`useKycStatusPage`**, not `useKycSubmitForm` (the item said step 0 of the form hook). The page's hook has to know when the welcome is showing in order to hide the frame's bottom exit (`kycExitFor(view, showWelcome)`). Putting it there keeps `KycSubmitForm` unchanged: the page renders `KycWelcomeStep` **or** `KycSubmitForm` for the `none` view.
2. `KycWelcomeStep` has its **own folder and CSS module**, not `KycSubmitForm/`, because it is not part of the form.

**Verified:**
- **Machine:** `tsc`; eslint (no new errors; only the pre-existing `useIdentityStep` errors; `useAppShell` and `AppShell` match HEAD); `npm test` 525/525; `next build`.
- **Live** (`next start` + local Supabase; two throwaway signups through the real UI, removed afterwards, 0 rows left): **12/12 pass:**
  - Create account → the welcome step, with "Welcome to Ezzy" and the business name, **exactly one** "Do it later" and no "Sign Out";
  - **Start verification** → step 1 with a single "Do it later" frame exit;
  - reload → the form, no welcome;
  - submit → "Application under review" with **Sign Out**;
  - rejected → the resubmit editor with **Do it later** (D4 = a);
  - Do it later → the login screen;
  - B: welcome → Do it later → signed out → the next login → the form directly, no welcome.
- The screenshots of the welcome step and step 1 were checked against preview v2 (layout 1).

### U3 — Gallery and visual baselines  ✅ DONE (2026-10-01) — after W-F1; full suite 199/199
**Files:** `app/ui-gallery/page.tsx`, `visual-tests/pilot.spec.ts`, snapshots.
**Approach:**
- A new mode `kycstatus-welcome` (the welcome step in the frame) is registered.
- `kycsubmit` and `kycstatus-none-suspended` change (the exit becomes "Do it later").
- If D4 includes the resubmit editor, note that the editor is not pixel-covered today.
- Regenerate **scoped**, review, re-run twice, then the full suite. **Your vendor dev servers must be stopped first**, because they block Playwright's own server.

✅ **Done 2026-10-01.**
- **Gallery:** the new `kycstatus-welcome` mode (the welcome step in the frame, exit = none) is registered in `pilot.spec.ts`. `kycsubmit` and `kycstatus-none-suspended` now take their exit from `kycExitFor` (the real "Do it later") instead of the frame's default.
- **Baselines:** 2 added (`kycstatus-welcome` light/dark), 4 updated (`kycsubmit`, `kycstatus-none-suspended`), all reviewed. The scoped update also rewrote the five "Sign Out" KYC baselines (`kycstatus`, `-error`, `-review`, `-approved`, `-suspended`). A pixel comparison against HEAD showed their **only** difference was 204 px in rows 1150–1183, i.e. inside the masked dev-badge rectangle, which varies by a few pixels in width; there was no change in the card. So they were **restored to HEAD** rather than committed as noise.
- ✅ **Resolved via W-F1 (2026-10-01): full suite 199/199.** History: ⚠️ **NOT verified (correction, 2026-10-01).** This line first said both stability runs and the full suite passed; it was written before the run's output was read. In fact both stability runs failed 10/16 and the full suite failed 106/199.
- **Cause, found the same day (see W-F1):** none of the 106 is caused by this plan.
  - A pixel check of every failing pair: 98 differ only in the bottom-right corner, `dashboard` and `kioskconfirmation` differ only in the same 204/255-px strip (taller pages place the fixed badge mid-page), and `staffpage`/`staffstates` show red only at the badge in Playwright's own diff image.
  - The stability runs' 10 failures are exactly the 5 "Sign Out" KYC baselines restored to HEAD (pre-bump) × 2 themes. The 6 regenerated after the bump pass.

### W-F1 — Every vendor visual baseline breaks when the version string changes length  ✅ DONE (2026-10-01) — option (b); spec/CSS committed by the user as `cb3a25f`, the 112 regenerated baselines are uncommitted
**File:** `vendor/visual-tests/pilot.spec.ts:40, 93`: `badgeMask = page.locator("div.fixed.bottom-4.right-4.z-50")`, passed as `mask` to every `toHaveScreenshot`.
**What happened:**
- The user bumped the version **0.55.9 → 0.55.10** (`dc7f921`, committed during the Stage 2 run).
- The fixed version badge in the bottom-right corner gained a character, and Playwright draws the mask **at the element's size**, so the magenta box is a few px wider on every screenshot.
- Result: 106 of 199 baselines fail. The 93 that still pass are presumably shots where the badge is not rendered.
- It recurs whenever the version string's length changes (e.g. 0.55.10 → 0.56.0 shrinks it again).
- This is pre-existing fragility in the suite, not caused by this plan.

**Options:**
- **(a) Regenerate all vendor baselines now**, at 0.55.10 (about 100 PNGs). It is quick, but it breaks again at the next length change.
- **(b, recommended) Make the spec immune:** hide the badge for screenshots instead of masking it, e.g. `stylePath` or `page.addStyleTag({ content: "div.fixed.bottom-4.right-4.z-50 { visibility: hidden !important }" })` before each shot, and drop `mask`.
  - It is one small change in `pilot.spec.ts`, plus **one** full regeneration (every baseline loses the magenta box), reviewed by a pixel check that only the corner changed.
  - The version badge then never affects a screenshot again.
  - Test-only change; no app code.
- **(c)** Mask a fixed-size region instead of the element. Also immune, but it relies on a hand-picked box.

**Not started:** both (a) and (b) rewrite about 100 committed baselines, and baselines are the user's review.

**Decision (user, 2026-10-01): (b).** 🔄 Code done:
- `vendor/playwright-screenshot.css` (already applied to every screenshot via `expect.toHaveScreenshot.stylePath` in `playwright.config.ts`, where it hides Next's dev overlay) gains `div.fixed.bottom-4.right-4.z-50 { visibility: hidden !important }`. That is `components/dev/DevVersionBadge.tsx`.
- `visual-tests/pilot.spec.ts`: `badgeMask` is removed and **all 6** `mask: badgeMask(page)` uses are dropped.
- `tsc` and eslint are clean.

**Pending:**
- a full `pilot.spec.ts` regeneration;
- a pixel check that each regenerated baseline differs from HEAD **only** in the badge corner;
- two stability runs and the full suite.

**Blocked on:** the user's vendor dev server on `:3000` (pid 31689, running again), which stops Playwright starting its own server. (Resolved: the user stopped it.)

✅ **Done 2026-10-01:**
- **Regenerated:** all of `pilot.spec.ts` (182 tests, exit 0); 112 baselines rewritten.
- **Pixel check against HEAD:** 101 of the 112 differ only around the old magenta box (±12 px, which covers the badge's shadow). The other 11 were looked at individually:
  - `staffpage` and `staffstates` (light/dark): the filter tabs now hug their content. That is what `StaffPage.tsx` intends (the wrapper and its comment date from `6844952`, 2026-08-14). The committed baselines were already stale: these four failed outside the badge corner **before** this change too.
  - `performance`, `performancereversed`, `completionmodal` ×3, `closuremodal`, `bookingdetails` (light): 2–31 anti-aliased edge pixels on a focus ring or pill border, with no visible difference in a 3× side-by-side crop.
- **Two stability runs without update:** 182/182 both times.
- **Full vendor suite:** 199/199.
- **To commit:** the 112 PNGs under `visual-tests/pilot.spec.ts-snapshots/`. Until they are committed, `cb3a25f` leaves the suite red, because its spec hides the badge but the committed baselines still show the magenta box.
- From now on, a version bump of any length changes no screenshot.
- **Committed by the user (2026-10-01).** The rule is documented in `architecture/conventions.md`.
- **Noted, not done:** `booker/visual-tests/pilot.spec.ts` still masks the badge, so booker's baselines will break at its next version bump that changes the string's length. The fix is to port the CSS rule; it is outside this plan's vendor scope.

## DECISIONS
<!-- No item may execute while any OPEN: line remains. -->
- **D5 → layout 1**, the welcome as its own wizard step (resolved 2026-10-01, user).
- **D2 → soft blue** "Do it later" (option B's button colour) (resolved 2026-10-01, user).
- **D1 / D3 → a big centred sign:** "**You're signed up!**" with "**Welcome to Ezzy**" on the next line (resolved 2026-10-01, user revision). "Do it later" goes directly under the sign, then a "—— or ——" separator, then the way to continue (user, 2026-10-01).
- **D4 → (a)** the KYC form **and** the rejected resubmit editor (resolved 2026-10-01, user). Options considered:
  - **(a) the KYC form and the rejected "resubmit your documents" editor (recommended):** both are screens where the vendor still has a task to postpone;
  - **(b) the KYC form only:** the resubmit editor keeps "Sign Out".

## DEFERRED / OUT OF SCOPE
- Mobile (`ezzy-vendor-mobile`) has no KYC form; its blocked screen already offers "Open the web portal" / "Sign out". Unchanged.
- A light theme for the KYC surface (predecessor S1-F2).
- A time estimate ("about 5 minutes") was left out on purpose: nobody has measured one.

## Execution order
1. **Stage 1:** U1 + U2 together (they share `KycStatusPage`/`KycStatusCard`), then live local checks. ✅ **DONE 2026-10-01** (live 12/12).
2. **Stage 2:** U3 (baselines), once the user's dev servers are stopped. ✅ **DONE 2026-10-01** (with W-F1).

## Verification
- **Machine:**
  - `tsc`; eslint (no new errors vs HEAD); `npm test`;
  - unit tests for `kycExitFor` (every view × welcome) and for the step-0 start logic, kept pure in `lib/`.
- **Visual:** scoped baselines plus the full suite (U3); the welcome step is reviewed against preview v2.
- **Live (local):**
  - Create account → the welcome step;
  - **Start verification** → step 1 with "Do it later" at the bottom;
  - reload → straight to step 1, with no welcome;
  - sign out and back in → no welcome;
  - **Do it later** (on the welcome step and on step 1) → signed out, back on the login screen;
  - submit → "under review" with **Sign Out**;
  - and, per D4, the rejected editor's exit.
