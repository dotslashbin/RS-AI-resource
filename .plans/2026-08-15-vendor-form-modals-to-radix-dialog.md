# Vendor — retire hand-rolled modals: form modals + KYC camera onto Radix Dialog

**Date:** 2026-08-15
**App / scope:** `vendor/` only. No backbone, booker, command or mobile changes.
**Status:** IN PROGRESS — **every code item is done.** B1–B6, I4, I5, I7, I9, I10 all ✅
(2026-08-15). `ModalOverlay` is deleted and `grep -rn ModalOverlay` over the code returns 0.

**What remains cannot be done from a terminal.** Stage 7 is a browser-and-camera pass:
**I1**'s runtime half, **I2**, **I3**, **I6**, and above all **B5's real-device
confirmation** — the check that decides whether the reported camera bug is actually gone.

Also open, neither blocking: **B6a** (one unreproduced console error — watch during the
live pass, do not chase) and **I8** (pre-existing calendar baseline drift, explicitly not
this plan's bug — it needs an SSR-visible clock or a dated fixture, and belongs in its own
plan).

> Move every hand-rolled dialog onto Radix Dialog and delete `ModalOverlay` — **and fix
> the KYC camera stream leak found while scoping it (B5), which is a live privacy bug and
> ships first.** Optimise for *behaviour-neutral except where we deliberately chose
> otherwise*: these are the app's most-used forms and they already work.

> ⚠️ **This plan has two halves with very different risk.** B5 is a real bug a vendor can
> see right now — their camera light stays on after finishing KYC. Everything else is an
> accessibility refactor of working code. Do not let the refactor's cadence delay B5.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "vendor B10" of the handoff plan).

**Baseline (2026-08-15):** `npx tsc --noEmit` exit 0 · `npm test` 145/145 · `npm run build`
compiles · ESLint 28 findings (all pre-existing). Any change to these is ours.

---

## Scope

**In:** `OfferingFormModal`, `ScheduleFormModal`, `StaffFormModal` and `CameraCapture` →
`@radix-ui/react-dialog` (D7); delete `components/ui/ModalOverlay/`; update the docs and
code comments that describe the old split; add `/ui-gallery` fixtures for the staff form
(D2) and the camera (D6); **fix the KYC camera stream leak (B5)**.

**Out:** any change to what the forms *do* — no field, validation rule, save path, or hook
logic is touched, with the single exception of `useCamera`'s stream lifecycle in B5.
`GuideModal`, `OfferingPerformanceModal` and `SchedulePromptModal` are already on Radix and
are reference material here, not targets. The Expo app's camera is `expo-camera`, a
different implementation entirely, and is not in scope — see DEFERRED.

**Origin:** follow-up raised by `.plans/2026-08-14-vendor-offering-to-schedule-handoff.md`
**B10**, which converted `SchedulePromptModal` after finding it had shipped on the wrong
primitive. That plan's item is closed; this is the remaining half it named.

---

## What was found before planning

### Three `ModalOverlay` consumers — plus one hand-rolled dialog the grep could not see
`grep "^import { ModalOverlay }"` returns exactly three files —
`OfferingFormModal.tsx:4`, `ScheduleFormModal.tsx:5`, `StaffFormModal.tsx:5`. Other files
match a bare `ModalOverlay` grep, but only in comments explaining why they *don't* use it.

⚠️ **That grep was the wrong question, and the original scope was wrong because of it.**
`CameraCapture.tsx:30` is a `<div role="dialog" aria-modal="true">` that never imported
`ModalOverlay` at all, so "find the consumers" missed it while "find the hand-rolled
dialogs" would not have. It is now B6 (D7). Searching for the *symptom* rather than the
*implementation* is the lesson worth keeping.

All three are rendered behind a truthiness guard by their parent —
`OfferingsPage.tsx:109` (`{oModal && …}`), `SchedulePage.tsx:121` (`{showSF && …}`), and
`StaffPage.tsx:115`. **That guard is load-bearing — see I1.**

### The target pattern already exists, twice, and they differ
| Pattern | Reference | `Dialog.Root` | On close |
|---|---|---|---|
| **Conditional parent** ← use this | `OfferingPerformanceModal.tsx:41-46` | `<Dialog.Root open>` (constant) | **Unmounts**, state destroyed |
| Always mounted | `GuideModal.tsx:28` | `<Dialog.Root open={open}>` | Stays mounted, state persists |

`GuideModal` is correct *for itself* — it is rendered unconditionally by `AppShell.tsx:145`
and has no form state to strand. The form modals must take the other route (I1).

The layout shell to copy is `GuideModal.tsx:35` / `OfferingPerformanceModal.tsx:46`:

```
fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
w-[calc(100vw-32px)] max-w-[…] max-h-[…] flex flex-col sp-card overflow-hidden p-0
```
…with a `shrink-0` header, a `flex-1 min-h-0 overflow-y-auto` body, and a `shrink-0` footer.

### There is already a regression net — for two of the three
`/ui-gallery` has fixtures `offeringform` (`page.tsx:280`), `scheduleform` (`:306`) and
`scheduleformdate` (`:292`). `visual-tests/pilot.spec.ts` runs roughly nine **behavioural**
tests against them (`:91`, `:144`, `:225-275`, `:415`) — the schedule form's four
save-blocker rules and the offering form's duration picker.

They use **page-level locators** (`page.locator('input[type="time"]')`,
`page.getByRole("button", { name: … })`), which query the whole document, so moving the
content into a `Dialog.Portal` at the end of `<body>` does not break them. That makes this
suite the primary verification for B1 and B2 — see I5 for the one way it could still break.

`StaffFormModal` has **no fixture and no test**. D2 fixes that.

### Screenshots are local-only
`git ls-files "visual-tests/*.png"` → **0**; `.gitignore:53` ignores the whole snapshot
directory. Before/after image comparison is therefore a real check but produces nothing
committable, and cannot be enforced in review. Capture baselines immediately before each
conversion, in the same session.

### ⚠️ This Radix version does not emit `aria-modal`
Recorded at `pilot.spec.ts:445-447`: it marks everything outside the dialog `aria-hidden`
via `hideOthers()` instead, which is the stronger guarantee. **Any assertion added by this
plan must target `aria-hidden` on the outside content, never `aria-modal`.** Correcting
this in advance because it is exactly the plausible-but-wrong assertion to reach for.

### What each modal's container currently does
| Modal | Container | Scroll | Header / footer |
|---|---|---|---|
| `OfferingFormModal.tsx:47` | `max-w-[520px] max-h-[90vh] overflow-y-auto p-6` | whole card | both scroll with content |
| `ScheduleFormModal.tsx:73` | `max-w-[520px] max-h-[92vh] overflow-y-auto p-0` | whole card | `sticky top-0` (`:74`) / `sticky bottom-0` (`:241`) |
| `StaffFormModal.tsx:22` | `min-w-[660px] p-0` | **none** | static |

Three different shapes, so this is three separate conversions, not one repeated three times.

---

## DECISIONS

<!-- No item may execute while any OPEN: line remains — plan-authoring §7. -->

- **D1 — Outside click** → **Prevented; Cancel / X / Escape only** (resolved 2026-08-15).
  `ModalOverlay.tsx:11` closes on any backdrop click, unconditionally, and cannot express
  anything else — so a stray click on the dimmed area discards a half-filled offering or
  schedule form with no confirm and no undo. `onInteractOutside={e => e.preventDefault()}`
  closes that path. **This is the one deliberate behaviour change in the plan**; everything
  else is meant to be invisible. Escape is kept: it is a standard, intentional gesture,
  unlike a mis-aimed click.
- **D2 — Staff form coverage** → **Add a `/ui-gallery` fixture** (resolved 2026-08-15).
  It is the only one of the three with no coverage and the one changing most (D3). ~10
  lines, mirroring the `offeringform` mode.
- **D3 — `StaffFormModal`'s `min-w-[660px]`** → **Fix while rewriting the container**
  (resolved 2026-08-15). It overflows horizontally on a phone today. The line is being
  rewritten regardless, and deliberately re-creating a known-broken fixed width inside a
  brand-new container would be strange. Accepted cost: the staff form is then the one
  conversion that is *not* pixel-neutral, so a visual diff there must be read as expected.
- **D4 — `components/ui/ModalOverlay/`** → **Delete it** (resolved 2026-08-15). Once
  nothing imports it, it is dead code this change made obsolete — and leaving it is what
  makes the trap: a component sitting in `components/ui/` looking like the house pattern.
  Documentation flips from "do not use it for new modals" to "Radix, full stop".

- **D5 — Where the KYC camera leak lives** → **In this plan** (resolved 2026-08-15). My
  recommendation was a separate plan — different subsystem, different risk. Overruled in
  favour of one tracked document. Consequence, stated so it is managed rather than
  discovered: this plan now mixes a live user-facing bug with an accessibility refactor,
  so **B5 is ordered first and must not wait on the refactor's cadence**, and the header
  carries a warning to that effect.
- **D6 — How B5 is verified** → **Playwright test + a `/ui-gallery` camera fixture**
  (resolved 2026-08-15). The bug passes `tsc`, ESLint and `next build`, and the repo has no
  React test harness, so without this the only evidence is a hardware LED. See I7.
- **D7 — `CameraCapture` as a fourth conversion** → **Yes, in scope** (resolved 2026-08-15).
  It is a hand-rolled `role="dialog"` (`CameraCapture.tsx:30`) with the same three gaps, so
  leaving it out would make "every hand-rolled dialog is gone" false the day it shipped.
  Added as B6, ordered after B5 — see the coupling on both.

No open decisions remain.

---

## BLOCKERS

### B5 — KYC camera stream is orphaned and never stopped  ✅ DONE (2026-08-15)
<!-- Fixed in useCamera.ts with a runRef token (stop() also increments it). Verified
     machine: I7's two Playwright tests — test 2 FAILED against unfixed code with
     `["live"]`, both pass after. tsc 0, npm test 145/145, next build compiles, ESLint
     unchanged at 28 in the components+lib baseline scope.
     ⚠️ See the CORRECTION below — the StrictMode mechanism originally written here was
     wrong, and only one of the two theorised paths actually reproduces. -->

> ### ✖ CORRECTION (2026-08-15) — the StrictMode mechanism below is WRONG
>
> The table further down claims React StrictMode double-invokes the mount effect in dev,
> orphaning a stream on **every** camera open. **Measured, and it does not.** With the
> `getUserMedia` stub counting every stream issued, opening the fixture produces exactly
> **one** stream, and I7's first test (open → close) **passes against the unfixed code**.
> This is Next **16.2.4** with `reactStrictMode` unset; whatever the default is, the
> effect is not being double-invoked here.
>
> **What is real and proven:** the *second* path — unmount during the `await`. I7's second
> test fails against unfixed code with `a late stream was left running: ["live"]` and
> passes after the fix. That is a genuine production leak needing no StrictMode.
>
> **Consequence for the user's report, stated plainly:** the fix closes a real leak, but
> **the exact sequence reported (two captures, then the next step) has not been
> reproduced.** The reported symptom is consistent with closing the camera while it was
> still starting, which is precisely what the fix now handles — but that is inference, not
> evidence. Confirmation needs the reporter to re-run their flow. If the camera still
> lingers afterwards, there is a second cause and this item should be reopened rather than
> assumed fixed. The mechanism table below is kept, struck, because the wrong theory is
> worth remembering: it was derived by reading code and reasoning about framework
> defaults, and it took one measurement to disprove.

**~~Original (partly wrong) diagnosis~~ — kept for the record:**

**File:** `components/kyc/CameraCapture/useCamera.ts:35-55` (the leak), `:26-29` (`stop`),
`:77` (unmount cleanup)

**Reported symptom (user, 2026-08-15):** after taking both KYC photos, the camera stays on
into the next step of registration. Reproduced by reading the code; mechanism below is
exact, not inferred from the symptom.

**What actually happens.** `start()` awaits `getUserMedia` (`:43`) and *then* assigns
`streamRef.current = stream` (`:44`). Nothing guards that assignment against a second
`start()` already in flight, and nothing stops a stream that arrives after the component
has gone. `stop()` (`:26-29`) can only stop whatever `streamRef` currently points at, so
any stream that was overwritten there is unreachable forever — and a `MediaStream` is not
released by garbage collection. Its tracks stay live until the page reloads.

`reactStrictMode` is **not set** in `next.config.ts`, so Next 15 defaults it **on**. In
development every mount therefore runs the effect, cleans up, and runs it again:

| Step | State |
|---|---|
| mount → effect `start()` #1 | `getUserMedia` promise P1 pending |
| StrictMode cleanup → `stop()` | `streamRef.current` is still `null` — **stops nothing** |
| re-mount → effect `start()` #2 | P2 pending |
| P1 resolves | `streamRef.current = stream1` |
| P2 resolves | `streamRef.current = stream2` — **stream1 is now unreachable and live** |
| close / unmount → `stop()` | stops stream2 only. stream1 keeps the camera on |

That fires on **every** camera open, so the reported flow (ID photo, then selfie) orphans
**two** streams. `CameraCapture` is correctly conditionally rendered
(`IdentityStep.tsx:126`) and `IdentityStep` itself unmounts at step 6
(`LoginPage.tsx:424`) — neither helps, because both paths call the same `stop()` that
cannot see the orphans.

**A second, production-real path to the same leak:** unmount *during* the await. Cleanup
runs `stop()` while `streamRef` is null, the promise then resolves and assigns a stream
nobody will ever stop. StrictMode is not required for this one — a slow permission prompt
and an impatient click on Cancel is enough. So this is **not** a dev-only bug, and must not
be dismissed as a StrictMode artefact.

**Fix approach — a run token, not a boolean.** A simple `mounted` flag does not fix the
StrictMode case, because both calls are "mounted" when they resolve; and calling `stop()`
at the top of `start()` does not either, because `streamRef` is still null when the second
call begins. The stream must be stopped by whoever receives it, if it has been superseded:

```ts
const runRef = useRef(0)

const start = useCallback(async () => {
  const run = ++runRef.current
  ...
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false })
  // Superseded by a later start(), or unmounted while we waited. Nobody else holds a
  // reference to this stream, so this is the ONLY chance to stop it.
  if (run !== runRef.current) { stream.getTracks().forEach(t => t.stop()); return }
  streamRef.current = stream
  ...
}, [facingMode])
```
…and the unmount cleanup (`:77`) increments `runRef` too, so a stream resolving after
teardown fails the same check and stops itself.

This keeps the hook's existing contract — it already claims to own the whole camera
lifecycle (`:13-15`), and the comment "always stops tracks on close + unmount so the camera
indicator never lingers" is currently false. It becomes true.

**Component separation:** hook-only change. `CameraCapture.tsx` is untouched by B5.

**Verification:** the Playwright test in I7 is the real check — this bug is invisible to
`tsc`, ESLint and the build, and the only human symptom is a hardware indicator light.
Plus a manual pass through both captures. See I7.

**Coupling:** ⚠️ **B5 must land and be verified before B6** converts this component's shell.
Debugging a stream-lifecycle bug through a freshly re-parented Radix Portal would confuse
two independent causes. Both items carry this note.

---

### B6 — `CameraCapture` → Radix Dialog  ✅ DONE (2026-08-15)
<!-- Root/Portal/Content with styles.overlay moved onto Content unchanged. No
     Dialog.Overlay (opaque full-bleed), no onInteractOutside (nothing outside it).
     title -> Dialog.Title (an <h2>; Tailwind preflight zeroes heading margins and
     inherits font-size, so styles.title renders identically to the old <span>).
     X -> Dialog.Close, keeping its existing aria-label. Hand-written aria-modal removed
     in favour of hideOthers(). aria-describedby={undefined} — see the in-file note on
     why `instructions` was NOT wired up as the Description.
     Verified machine: I7's two leak tests still pass AFTER the conversion (the B5/B6
     coupling check); full suite 88 passed with only the 3 pre-existing I8 calendar
     failures; tsc 0; npm test 145/145; build compiles; ESLint 28.
     ⏳ NOT verified: Escape/focus-trap/permission-prompt/indicator — stage 7 live pass. -->

#### B6a — A one-off Next.js console error, not reproducible  ⬜ TODO (watch, do not chase)
The first run after the conversion printed
`Uncaught Error: Internal Next.js error: Router action dispatched before initialization.`
from the dev server. It did **not** reproduce across two subsequent runs of the same
tests, and does not appear for the staff or offering suites. Most likely fast-refresh /
router-init noise from the recompile that the edit triggered.

Recorded rather than dismissed **or** chased: one unexplained console error is not
evidence of a defect, but if it resurfaces during the stage 7 live pass it now has a
starting point instead of looking like a fresh mystery.

---

### I10 — `CameraCapture.tsx` holds a `useEffect` in the render layer  ✅ DONE (2026-08-15)
<!-- Effect moved into useCamera and MERGED with the teardown effect (see I10a for why
     that pairing matters). `start` dropped from the returned surface — the hook now owns
     when the camera opens, and a second trigger invites the concurrent-start orphaning
     the run token exists to absorb. `stop` left in place: it was already unused before
     this change, so it is not obsolete BECAUSE of it.
     Verified machine: CameraCapture.tsx now has zero stateful hooks (grep); I7's two leak
     tests pass — they are the regression net for exactly this; full suite 89 passed with
     only the 3 pre-existing I8 failures; tsc 0; npm test 145/145; build compiles;
     ESLint back to the 28 baseline (see I10b). -->

#### I10a — Merging start with teardown closed a latent leak  ✅ DONE (2026-08-15)
Start and stop are now **one** effect, not two. As two, a change of `facingMode` would
re-run `start()` without ever running the teardown: the previous stream would be
overwritten in `streamRef` and left live — the same orphaning B5 fixed, reached by a
different route. Paired, the cleanup stops the old stream before the new one is requested.

No caller changes `facingMode` on a mounted instance today (`IdentityStep` unmounts the
component between slots), so this was latent rather than live. Recorded because it means
I10 was not purely cosmetic compliance — it removed a real, if unreachable, defect.

#### I10b — The move made an invisible lint violation visible  ✅ DONE (2026-08-15)
Moving the effect took ESLint from 28 to 29: `react-hooks/set-state-in-effect` can now see
that `start()` sets `status`/`error` synchronously, which it could not while the call sat
in `CameraCapture.tsx` across a file boundary. **Not a new defect — the identical code ran
before; only its visibility changed.**

Resolved with a one-line `eslint-disable-next-line` on the `void start()` call, carrying a
written justification: this effect drives an EXTERNAL system (it asks the browser for a
camera), which is what the rule's own docs describe effects as being for, and
`setStatus("starting")` is what lets the shutter say "Starting…" instead of sitting
enabled over a stream that does not exist yet. Same precedent and scoping discipline as
`useAppShell.ts:441`.

⚠️ First attempt put the directive above `useEffect(`, which ESLint reported as an **unused
disable** while the real error stayed — the violation is on the inner `void start()` line,
not the effect's opening line. Count went 28 → 30 before it went back to 28. Worth knowing:
this rule reports at the setState call site.

**File:** `components/kyc/CameraCapture/CameraCapture.tsx:28`

`useEffect(() => { void start() }, [start])` sits in the `.tsx`. `component-separation` §1
forbids stateful hooks in a render layer, and `useCamera` already claims to own the whole
camera lifecycle — auto-start on mount belongs inside it.

Pre-existing, and **deliberately not fixed in stage 5**: B6's scope was the primitive swap,
and moving the auto-start into the hook changes mount behaviour for every consumer of a
hook whose stream lifecycle was itself only just repaired in B5. Bundling a behavioural
change into the same stage as a shell change would blur which one caused any regression.

**Fix approach:** move the effect into `useCamera`, guarded so it runs once per mount, and
drop `start` from the returned surface if nothing else calls it (`retake` calls it
internally). **Verification:** I7's two leak tests must still pass unchanged — they are
exactly the regression net for this.

**File:** `components/kyc/CameraCapture/CameraCapture.tsx:30`,
`CameraCapture.module.css:1-9`

D7. A fourth hand-rolled dialog — `<div role="dialog" aria-modal="true" aria-label={title}>`
with no focus trap, no Escape handling and no scroll lock, exactly the gaps that justify
this plan. Not a `ModalOverlay` consumer, which is why the original scope missed it.

Unlike the three form modals it is **full-bleed, not a centred card**:
`.overlay` is `position: fixed; inset: 0; z-index: 60` with an opaque `#04060e` background
and its own `flex-direction: column` layout. `z-index: 60` deliberately sits above the
app's `z-50` dialogs.

**Fix approach:** `Dialog.Content` carries `styles.overlay` unchanged, so the layout is
untouched. **No `Dialog.Overlay` is needed** — the content is already opaque and full-bleed,
and adding a scrim behind an opaque full-screen surface would only cost a paint. `title` →
`Dialog.Title` (visually the existing `.title` span), the X → `Dialog.Close`.

Two notes specific to this one:
- **The hand-written `aria-modal="true"` goes away**, replaced by Radix's `hideOthers()`.
  That is not a regression — see the finding above — but it will look like one in the diff.
- **`onInteractOutside` is irrelevant here** (nothing is outside a full-bleed surface), so
  D1's guard does **not** apply. Escape should close, matching Cancel.

⚠️ **Do not use `forceMount` or add an animation that unmounts and remounts `Dialog.Content`.**
The `<video>` element holds a live `srcObject`; remounting it creates a new element and
silently drops the stream, and `useCamera` would have no idea.

**Component separation:** render-only. `useCamera` untouched by B6 (B5 already changed it).

**Verification:** I7's test must still pass after the conversion — that is the point of the
ordering. Plus a live pass: Escape closes, focus is trapped, the permission prompt still
works, and the camera indicator goes out on close.

**Coupling:** ⚠️ after B5, never before. See B5.

---

### B1 — `OfferingFormModal` → Radix Dialog  ✅ DONE (2026-08-15)
<!-- Root/Portal/Overlay/Content shell; card kept as its own scroller (max-h-[90vh]
     overflow-y-auto p-6) exactly as under ModalOverlay — no flex restructure, per plan.
     Title -> Dialog.Title, X -> Dialog.Close, Cancel left as a plain button.
     aria-describedby={undefined} opt-out (I6); onInteractOutside prevented (D1).
     Verified machine: the 4 duration-picker tests pass unchanged; full suite 84 passed
     with only the 3 pre-existing I8 calendar failures; tsc 0; npm test 145/145;
     next build compiles; ESLint components+lib still 28.
     ⏳ NOT verified: D1's outside-click behaviour and I6's console cleanliness — both
     need the live pass (stage 7). See B1a for why the fixture cannot prove D1. -->

#### B1a — The `offeringform` fixture cannot prove D1  ✅ RESOLVED (2026-08-15) — superseded by I4a
<!-- The observation below is still TRUE — the offeringform fixture still cannot prove D1
     — but the CONCERN it raised (D1 unverified anywhere) is closed: stage 4 built the new
     staff fixture stateful and proved the guard there, failing-first. All three form
     modals carry the identical onInteractOutside line. Marker corrected 2026-08-15; it
     was left ⬜ while the summary line above claimed D1 was proven, which is exactly the
     plan-vs-reality drift the status model exists to catch. -->

The gallery renders `<OfferingFormModal … onClose={noop} />` and `Dialog.Root` has a
constant `open`, so the dialog stays on screen whether the outside-click guard fires or
not — a test asserting "still visible after clicking outside" passes identically against
both behaviours and proves nothing.

Making it stateful (as `CameraFixture` is, I7) would fix that, but it is scope the plan did
not call for and it changes a fixture three other tests already rely on. Recorded rather
than done: **D1 is currently unverified for all converted modals**, and stage 7 must cover
it by hand, or by a follow-up that makes the three form fixtures stateful in one pass.

**File:** `components/offerings/OfferingFormModal/OfferingFormModal.tsx:46,219-223`

Simplest of the three: one scroll container, no sticky children.

**Fix approach:** replace `<ModalOverlay onClose={onClose}>` with the
`Root`/`Portal`/`Overlay`/`Content` shell, keeping `max-w-[520px] max-h-[90vh]` and the
existing `overflow-y-auto p-6 rounded-[20px]` on `Dialog.Content` itself — the card *is*
the scroller here, so no flex restructure is needed and the diff stays small.

- `<p>Add Offering</p>` (`:49`) → `Dialog.Title` (same classes). This is the accessible name.
- Radix warns to the console when `Content` has no description: add `Dialog.Description`
  (the form has no subtitle today, so use `aria-describedby={undefined}` on `Content`,
  which is Radix's documented opt-out) — see I6.
- The X button (`:50`) → `Dialog.Close`; **Cancel (`:219`) stays a plain button calling
  `onClose`**, because it is beside a `disabled`-aware save button and wrapping it in
  `Dialog.Close` would change nothing except make the pair inconsistent.
- `onOpenChange={open => { if (!open) onClose() }}` and
  `onInteractOutside={e => e.preventDefault()}` (D1).

**Component separation:** render-only change. `useOfferingForm` is untouched; the `.tsx`
gains no state, no handler bodies, no inline styles.

**Verification:** existing duration-picker tests (`pilot.spec.ts:142-160`) must pass
unchanged — machine. Before/after screenshot of `?mode=offeringform` in both themes — local.

---

### B2 — `ScheduleFormModal` → Radix Dialog  ✅ DONE (2026-08-15)
<!-- Flex shell as specified: Content = max-h-[92vh] flex flex-col overflow-hidden p-0;
     header and footer shrink-0; body flex-1 min-h-0 overflow-y-auto. Both `sticky`
     classes REMOVED, not left inert (grep confirms the only remaining occurrences are in
     the explanatory comment). Title -> Dialog.Title, X -> Dialog.Close, Cancel left plain.
     useScheduleForm untouched, presetOfferingId included.
     Verified machine: all 21 schedule-matching tests pass, incl. the 4 save-blocker rules
     and the date-granular pair; new B2a pinning test passes AND was proven to fail
     against a broken layout; full suite 85 passed with only the 3 pre-existing I8
     calendar failures; tsc 0; npm test 145/145; build compiles; ESLint 28.
     ⏳ NOT verified: D1 (see B1a) and I6 console cleanliness — stage 7. -->

#### B2a — A pinning test, proven to fail before it passed  ✅ DONE (2026-08-15)
**File:** `visual-tests/pilot.spec.ts` — "schedule form pinning survives overflow (B2)"

Added beyond the written plan, which called for pinning to be checked *manually*. The
regression it guards is invisible to every other check: `tsc`, ESLint and all 21 existing
schedule tests pass with the footer and header scrolled off the screen.

Deliberately runs at a **560px-tall viewport** — at the suite's 1200px the form may not
overflow at all, and a scroll assertion that never scrolls proves nothing. It asserts
`scrollTop > 0` first for exactly that reason.

**Sensitivity was verified, not assumed:** the header was temporarily nested inside the
scrolling body and the test failed with `viewport ratio 0` on the heading, then the change
was reverted. Notably the footer and `saveBlocker` assertions still **passed** in that
broken state — scrolling to the bottom brings a non-pinned footer *into* view. **The header
assertion is the discriminating one**; anyone trimming this test should keep that one.

**File:** `components/schedule/ScheduleFormModal/ScheduleFormModal.tsx:72-77,241,252-254`

**The hard one.** Its header is `sticky top-0` and its footer `sticky bottom-0`, which work
*because the card itself is the scroll container*. Copying B1's approach would keep that
working; copying `GuideModal`'s flex shell would silently break it — `position: sticky`
does nothing useful inside a `flex-1 overflow-y-auto` sibling.

**Fix approach:** convert to the **flex shell**, and convert the sticky children with it:
`Dialog.Content` becomes `max-w-[520px] max-h-[92vh] flex flex-col overflow-hidden p-0`;
the header (`:74`) drops `sticky top-0` for `shrink-0`; the body (`:79`) becomes
`flex-1 min-h-0 overflow-y-auto`; the footer (`:241`) drops `sticky bottom-0` for
`shrink-0`. This is the shape `GuideModal.tsx:35` already proves out.

⚠️ Do **not** leave the `sticky` classes in place "just in case" — with the flex shell they
are inert, and an inert class that looks load-bearing is how the next person reintroduces
the bug. Remove them in the same edit.

The footer holds the `saveBlocker` message (`:242-244`), which must remain visible without
scrolling — that is the entire reason the footer is pinned, and the check that proves the
conversion worked.

**Component separation:** render-only. `useScheduleForm` untouched — including the
`presetOfferingId` seeding added by the handoff plan's B8.

**Verification:** the four save-blocker tests (`pilot.spec.ts:97-129`) and the date-granular
tests must pass unchanged — machine. Manual: scroll the body and confirm header and footer
stay pinned, in both `scheduleform` and `scheduleformdate` — local.

---

### B3 — `StaffFormModal` → Radix Dialog, made responsive  ✅ DONE (2026-08-15)
<!-- Flex shell, w-[calc(100vw-32px)] max-w-[660px] max-h-[85vh]; header/footer shrink-0,
     body flex-1 min-h-0 overflow-y-auto. min-w-[660px] removed (D3). Title/Close/
     aria-describedby/onInteractOutside as the siblings. useStaffForm untouched.
     Verified machine: 3 new tests pass and ALL WERE PROVEN TO FAIL FIRST — restoring
     min-w-[660px] gave "Received: 660" against <= 360, and removing onInteractOutside
     closed the dialog on a backdrop click. Full suite 88 passed, only the 3 pre-existing
     I8 calendar failures; tsc 0; npm test 145/145; build compiles; ESLint 28.
     No explicit bg on the bars, unlike ScheduleFormModal — this card never scrolled
     under them, so sp-card's surface is all they needed. -->

**File:** `components/staff/StaffFormModal/StaffFormModal.tsx:21-22,60-63`

Currently `sp-card w-full min-w-[660px] p-0` — a hard 660px floor with **no max-height**, so
it overflows horizontally below ~692px and vertically on a short viewport with many
specialty pills.

**Fix approach:** the flex shell as in B2, sized `w-[calc(100vw-32px)] max-w-[660px]
max-h-[85vh]` (D3), with `shrink-0` header (`:23`), `flex-1 min-h-0 overflow-y-auto` body
(`:28`), `shrink-0` footer (`:60`). `<p>Add Staff</p>` (`:24`) → `Dialog.Title`; X → `Dialog.Close`;
same `onInteractOutside` guard as its siblings.

**This is the one conversion that is deliberately not pixel-neutral** (D3), so its
before/after diff will show real change. Read it against the intent: same content, no
horizontal overflow at 360px.

**Component separation:** render-only; `useStaffForm` untouched.

**Verification:** new gallery fixture (I4) at 360px and desktop, both themes — local. No
existing automated test covers this file.

---

### B4 — Delete `ModalOverlay`, and correct every doc that describes the old split  ✅ DONE (2026-08-15)
<!-- Deleted components/ui/ModalOverlay/ (tracked in git, so recoverable with
     `git checkout -- components/ui/ModalOverlay`; no `trash` binary on this machine).
     Rewrote conventions.md's bullet into a positive Radix spec incl. the constant-open
     rule, the Title/Description choice, onInteractOutside, and the no-aria-modal note;
     rewrote portals.md's Guide-modal note; corrected comment blocks in GuideModal,
     OfferingPerformanceModal, SchedulePromptModal, OfferingFormModal and pilot.spec.ts.
     Verified machine: `grep -rn ModalOverlay` over components/app/lib/visual-tests
     returns 0; the 3 remaining hits in architecture/ all correctly say it WAS deleted.
     tsc 0; full suite 89 passed with only the 3 pre-existing I8 failures; npm test
     145/145; build compiles; ESLint 28. -->

#### B4a — The doc sweep was 8 files, not the 4 the plan listed  ✅ DONE (2026-08-15)
The plan named `conventions.md`, `portals.md`, `SchedulePromptModal` and
`OfferingPerformanceModal`. A grep before starting found **eight** files asserting the old
split — the four above plus `GuideModal.tsx`, `OfferingFormModal.tsx` (comments written
during B1) and `visual-tests/pilot.spec.ts`.

Recorded because the miss is instructive: the plan's list was written from the *consumer*
grep (`^import { ModalOverlay }`), which by definition cannot see files that only
*describe* the component. Stale prose does not import anything. A doc sweep needs a
full-text grep, planned as such.

**Files:** `components/ui/ModalOverlay/ModalOverlay.tsx` (delete);
`architecture/conventions.md` (Component Conventions bullet);
`architecture/portals.md` (the Guide-modal note);
`components/offerings/SchedulePromptModal/SchedulePromptModal.tsx` and
`components/offerings/OfferingPerformanceModal/OfferingPerformanceModal.tsx:26-32`
(comment blocks)

Four places currently assert "the form modals still use `ModalOverlay` and are pending
conversion". All four become false the moment B1–B3 land, and a stale rule is worse than
none — it is what sent the handoff plan's `SchedulePromptModal` to the wrong primitive in
the first place.

**Fix approach:** delete the component and its directory (nothing imports it — re-verify
with grep first, not from this document). Rewrite the `conventions.md` bullet to state
Radix Dialog plainly, with the `hideOthers()`/no-`aria-modal` note carried over. Trim the
two code comments to the reason (focus trap, Escape, scroll lock) and drop the "pending
conversion" clause. Add a dated line to `portals.md`.

⚠️ **Do this last.** Deleting the component first would break the build mid-plan and make
B1–B3 impossible to verify one at a time.

**Verification:** `grep -rn "ModalOverlay" vendor/` returns nothing outside git history —
machine. `npm run build` — machine.

---

## IMPORTANT

### I1 — The `Dialog.Root` pattern is load-bearing; the wrong one fails as a *form* bug  🔄 IN PROGRESS (2026-08-15)
<!-- CONSTRAINT SATISFIED and structurally verified by grep (2026-08-15): all six Radix
     dialogs use `<Dialog.Root open ...>` with a CONSTANT open — none uses the
     `open={variable}` form — and all four parents conditionally render
     (OfferingsPage:109/:122, SchedulePage:121, StaffPage:114, IdentityStep:126).
     STILL 🔄, not ✅: what grep cannot show is the runtime consequence — open a form,
     close it, reopen it in the other mode and confirm no stale fields, and that the
     Offerings -> Schedule preselect still fires. That is the stage 7 check. -->

**Files:** all three conversions

Each modal must keep its parent's conditional render and use `<Dialog.Root open>` with a
constant `open`, exactly as `OfferingPerformanceModal.tsx:42` does. Moving to
`GuideModal`'s always-mounted `<Dialog.Root open={showSF}>` shape would stop the component
unmounting on close, and unmount is doing real work today:

1. **`useScheduleForm` only re-seeds when `editSched` is truthy** (`:34`). Create mode after
   an edit is clean *purely because the old state was destroyed*. With a persistent Root,
   "New schedule" would open pre-filled with the previously edited schedule's date and
   times, and nothing in the code would reset it.
2. **`presetDone` (`useScheduleForm.ts:32`) would latch permanently**, so the Offerings →
   Schedule preselect from the handoff plan would fire once and then silently stop.

Neither failure looks like a modal problem, which is what makes it expensive. Both are
prevented by one line per file, and this item exists so that line is not "simplified" later.

---

### I2 — Native date/time/select pickers vs. the outside-click guard  ⬜ TODO
**Files:** `ScheduleFormModal.tsx:144,176,183,190,221` (date, time, staff `<select>`),
`OfferingFormModal.tsx:66-76` (`<datalist>`), `:102-108` (unit `<select>`)

Radix's `onPointerDownOutside` / `onInteractOutside` can fire for UI that renders outside
the dialog's DOM subtree. In Chromium the native date/time picker is browser chrome and does
not dispatch page pointer events, so the risk is low — but it is platform-dependent, and D1
now attaches a handler to that exact event.

Downgraded from a blocker on that reasoning, not dismissed: **it must be clicked**, because
the failure mode (picking a date closes the whole form) would be immediate and total.

**Check:** open both forms, use every native control — date, both time inputs, the staff
select, the duration-unit select, and the category datalist — and confirm none dismisses
the dialog. Needs a live browser.

---

### I3 — `window.confirm` fires from inside an open dialog  ⬜ TODO
**File:** `components/schedule/SchedulePage/useSchedulePage.ts:132-139`

The I12 stranded-bookings warning calls `window.confirm` while the schedule modal is open.
Browser-level dialogs sit above the page and outside React entirely, so a focus trap cannot
capture them and this is expected to be unaffected.

Listed because it is a genuine interaction between a modal and a nested blocking prompt, it
is on the schedule form's save path, and "expected to be unaffected" is not verification.

**Check:** narrow a schedule's hours so the warning triggers; confirm the prompt appears,
that both answers work, and that focus returns into the dialog afterwards. Live browser.

---

### I4 — `/ui-gallery` fixture for the staff form  ✅ DONE (2026-08-15)
<!-- Added `staffform` mode + STATEFUL StaffFormFixture (vendorId="" so no network).
     Made stateful deliberately — that is what closed B1a, see below. Not in the
     screenshot `modes` array. Verified: 3 tests green, sensitivity proven. -->

#### I4a — D1 is now proven, and B1a is resolved  ✅ DONE (2026-08-15)
B1a recorded that D1 (backdrop click must not discard a form) was unverifiable, because
the three older fixtures pass `onClose={noop}` against a constant `open` and cannot tell
"guard fired" from "guard absent". Rather than let that debt reach stage 7, the **new**
fixture was built stateful — no existing fixture was touched, so nothing else was put at
risk.

`a click on the backdrop does NOT discard the form` types into the name field, clicks the
top-left corner, and asserts the dialog is still open **and the typing survived**. Removing
`onInteractOutside` makes it fail. All three form modals carry the identical line, so the
behaviour is established; what remains unproven for the other two is only that the line is
present, which `tsc` and review already cover.

---

### I9 — Icon-only dialog close buttons have no accessible name  ✅ DONE (2026-08-15)
<!-- aria-label added to all three: "Close the offering form" / "Close the schedule form"
     / "Close the staff form", following OfferingPerformanceModal's precedent of naming
     the SURFACE rather than a bare "Close". SchedulePromptModal's Dialog.Close needed
     nothing — it has visible text ("Not now"). CameraCapture already had one.
     Verified machine: new test selects the X BY NAME ("Close the staff form") and
     clicks it — impossible before the label existed. Full suite 89 passed. -->

**Files:** `OfferingFormModal.tsx` (X), `ScheduleFormModal.tsx` (X),
`StaffFormModal.tsx` (X), `CameraCapture.tsx` (has one — `aria-label="Close camera"`)

Found while writing I4's tests: `dialog.getByRole("button")` could not select the close
button by name, because it has none — it is an `<X />` icon in a bare button. A screen
reader announces "button". `OfferingPerformanceModal.tsx:64` already does this correctly
(`aria-label="Close the performance summary"`), and `CameraCapture` already has one, so
the fix and the precedent both exist.

Pre-existing — the buttons were unnamed under `ModalOverlay` too — but squarely within
this plan's purpose, and the same class of defect as the schedule page's icon-only Delete
button, which was fixed for exactly this reason (`pilot.spec.ts` I2 test).

**Fix approach:** `aria-label` on each `Dialog.Close`. One line each.
**Verification:** extend I4's test to select the X by name rather than positionally.
**Not done in stage 4** — B3's scope was the primitive swap, and this touches three other
files. Slot it into stage 6 with B4's sweep, or take it as its own small pass.

**File:** `app/ui-gallery/page.tsx` (new `staffform` mode, beside `:280` `offeringform`)

D2. Mirror the `offeringform` mode: render `<StaffFormModal>` with the existing `STAFF` /
`OFFERINGS` fixtures, `editInst={null}`, `onClose`/`onSave` = `noop`.

Ships with B3 rather than after it — the fixture is how B3 gets its before/after
comparison, so it is worth nothing if it lands later.

**Verification:** `/ui-gallery?mode=staffform&theme=dark` renders — local.

---

### I5 — The one way the existing Playwright suite could break  ✅ DONE (2026-08-15)
<!-- It did not break. The suite was run in full after EVERY stage and the pass count only
     ever rose as tests were added: 84 (stages 1-2) -> 85 (B2a) -> 88 (B3/I4's three) ->
     89 (I9's) — zero losses at any point, and the same 3 pre-existing I8 calendar
     failures throughout.
     The specific risk this item named — hideOthers() marking content aria-hidden and
     Playwright's getByRole skipping those subtrees — never materialised, because every
     existing assertion targets content INSIDE the dialog. The warning stands for anyone
     later asserting on the gallery shell or DevVersionBadge from a dialog fixture.
     Verified machine: pass counts across six full-suite runs. -->

**File:** `visual-tests/pilot.spec.ts`

The ~9 behavioural tests over `offeringform`/`scheduleform` use page-level locators, so
portalling is fine. The real risk is `hideOthers()`: Radix marks content **outside** the
dialog `aria-hidden`, and Playwright's `getByRole` skips `aria-hidden` subtrees. Every
current assertion targets content *inside* the modal, so all should pass — but the gallery
also renders a `DevVersionBadge` and the page shell around the fixture, and any future
assertion on those would silently find nothing.

**Verification:** run the full suite before and after each of B1/B2 and compare pass counts,
rather than assuming — machine. If a test fails, check whether it is asserting on something
now `aria-hidden` before changing any component code.

---

### I6 — Every `Dialog.Content` needs an accessible name, and a description decision  ⬜ TODO
**Files:** all three conversions

Radix requires `Dialog.Title` (it warns loudly to the console without one) and warns again
if there is no `Dialog.Description` and no explicit opt-out. All three modals currently head
themselves with a plain `<p>` (`OfferingFormModal.tsx:49`, `ScheduleFormModal.tsx:75`,
`StaffFormModal.tsx:24`) and none has a subtitle.

**Fix approach:** promote each `<p>` to `Dialog.Title` keeping its classes — this is the
accessible name and costs nothing visually. For the description, set
`aria-describedby={undefined}` on `Content`, Radix's documented opt-out, rather than
inventing subtitle copy nobody asked for. `OfferingPerformanceModal` had real subtitle text
available (`:57-59`) and used `Dialog.Description` properly; these do not, and a description
invented to silence a warning is worse than the documented opt-out.

**Verification:** no Radix console warnings when each modal opens — live browser console.

---

### I7 — A regression test for the camera leak, and the fixture it needs  ✅ DONE (2026-08-15)
<!-- Added `camera` mode + stateful CameraFixture to app/ui-gallery/page.tsx, and the
     "KYC camera stream lifecycle (B5)" describe block to visual-tests/pilot.spec.ts.
     Deliberately NOT added to the `modes` screenshot array — a live video feed cannot
     have a pixel baseline.
     Verified machine: run against unfixed code first (test 2 failed as designed), both
     pass after B5. Two findings from writing it, below. -->

#### I7a — The stub must keep painting the canvas  ✅ DONE (2026-08-15)
First version returned `canvas.captureStream()` from a canvas nothing was ever drawn to.
That produces **no frames**, so `video.play()` never resolves, `start()` never reaches
`setStatus("live")`, and the fixture sat on "Starting…" forever — the test failed for a
reason unrelated to the bug. Fixed by painting on an interval. A test-harness fault, not a
product one, and noted because the failure looks exactly like a product hang.

#### I7b — A real `MediaStream`, never an object literal  ✅ DONE (2026-08-15)
`video.srcObject = …` throws a `TypeError` for anything that is not a real `MediaStream`.
`start()` would have caught it, rendered the error state, and the test would have passed
while exercising nothing. `canvas.captureStream()` gives genuine tracks with genuine
`stop()`/`readyState` semantics.

**Files:** `app/ui-gallery/page.tsx` (new `camera` mode), `visual-tests/pilot.spec.ts`

D6. B5 is invisible to every machine check this repo runs — `tsc`, ESLint and `next build`
all pass with the leak in place, and `node --test` cannot mount a React hook (there is no
testing-library or jsdom in `package.json`; the suite is `node --test` over `lib/**/*.test.ts`).
Without this item the fix is verified by looking at a hardware LED, and the regression
returns unnoticed.

**Fix approach:** a `camera` gallery mode rendering `<CameraCapture>` with `noop`
handlers, then a spec that stubs the browser API **before** the page's own scripts run:

```ts
await page.addInitScript(() => {
  const issued: MediaStreamTrack[] = []
  ;(window as any).__tracks = issued
  navigator.mediaDevices.getUserMedia = async () => {
    const track = { kind: "video", stop() { (this as any).readyState = "ended" }, readyState: "live" }
    issued.push(track as unknown as MediaStreamTrack)
    return { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream
  }
})
```
…then open the fixture, close it, and assert **every** track in `__tracks` has
`readyState === "ended"`. The assertion must be over *all* issued tracks, not the last one
— counting only the current stream is precisely the mistake the production code makes.

⚠️ `addInitScript`, not an in-page `evaluate`: the component calls `getUserMedia` from a
mount effect, so a stub installed after load arrives too late.

Two cases worth separating: **close after capture** (the reported flow) and **close while
starting** (the production-real path, stubbed with a deliberately slow promise). The second
is the one a naive fix passes while still leaking.

**Note on realism:** this proves the *hook's* bookkeeping, not the browser's. It cannot
prove a real camera indicator went out — that stays a manual check. Chromium's
`--use-fake-device-for-media-capture` would go further but needs launch-arg changes in
`playwright.config.ts`; not worth it for a bug whose mechanism is a lost reference.

**Verification:** the new spec fails against current `main` and passes after B5 — run it
**before** applying the fix to prove it catches the bug. A test that has never failed has
proved nothing.

---

### I8 — Pre-existing: the `calendar` visual baselines are unstable  ✅ DONE (2026-08-16)

> ✅ **Fixed 2026-08-16**, at the user's request, from
> `.plans/2026-08-15-vendor-account-completion-and-payout-details.md` (where it was
> independently rediscovered as G17 — two plans, one defect, neither owning it).
>
> **The diagnosis recorded below was right, and the fix is the production-code change it
> named as the alternative.** `CalendarPage` / `useCalendarPage` now take an optional
> `today` (`YYYY-MM-DD`, PH terms); production passes nothing and still reads the real
> clock, while the `/ui-gallery` fixture passes `"2026-08-08"`. Determinism is now a
> property of the fixture rather than of a clock patch reaching a layer it cannot reach.
>
> The spec header is amended in place to say why `page.clock` was insufficient, and
> `calendar-day` gained a **content** assertion (`toContainText("August 2026")`) that
> fails naming the cause instead of reporting 75 moved pixels.
>
> **Verified:** the three baselines regenerated, then the calendar tests run **twice
> more against them** to prove determinism rather than a fresh baseline; then the **full
> suite: 115/115 passing** — the first time it has been fully green.
**Files:** `visual-tests/pilot.spec.ts:36-46,61-71`, `components/calendar/CalendarPage/useCalendarPage.ts:18-19`

Found while running the full suite during Stage 1. `calendar-light`, `calendar-dark` and
`calendar-day` fail with **75 pixels** different (ratio 0.01). The diff image shows the
**only** change is the "today" highlight moving between the 15th and the 16th — no layout,
no colour, nothing structural.

**Not caused by Stage 1**, and this is checkable rather than asserted: the gallery's new
`camera` branch is placed after the `calendar` branch and cannot execute for
`mode=calendar`, and no calendar component was touched.

**Cause:** the suite freezes the clock with `page.clock.setFixedTime(FIXED_NOW)` (8 Aug
2026), yet the calendar renders a **mid-August** highlight — so the freeze does not govern
it. `useCalendarPage.ts:18-19` establishes the month via `useState(() => phToday())`, a
lazy initialiser that runs on the **first** render, which in Next happens on the **server**.
`page.clock` patches only the browser, so the dev server's real clock decides the date and
the baseline expires as the days pass. The spec header already documents this class of
failure ("12-40 pixels differing on the date digits alone") and the clock freeze was the
fix for it — this is the part that fix does not reach.

**Left alone deliberately:** it is pre-existing test infrastructure, unrelated to modals or
the camera, and fixing it properly means either an SSR-visible clock or dating the calendar
fixture explicitly. Regenerating baselines locally clears the failure for a few days and
commits nothing (they are gitignored), so it is not a fix.

---

## DEFERRED / COSMETIC

- **Inline `style={{}}` in `StaffFormModal.tsx:46-52` and `ScheduleFormModal.tsx:94-100`** —
  the offering/specialty pills compute `border` and `background` from the `TC`/`TB` colour
  maps. These are data-driven values, which `component-separation` §1 explicitly permits,
  and they predate this plan. Not touched.
- **`OfferingFormModal` keeps its header and footer inside the scroller** (B1) rather than
  being restructured to the flex shell for uniformity. Uniformity is not a reason to
  restructure a working layout, and the smaller diff is easier to review.
- **Escape still discards a dirty form.** D1 deliberately fixed only the mis-aimed click.
  A dirty-check on Escape needs state in all three hooks; if it is ever wanted, it should
  cover Cancel and X too, and belongs in its own plan.
- **`ezzy-vendor-mobile`'s camera is not affected by B5.** It uses `expo-camera`, a
  different implementation with its own lifecycle — `getUserMedia` appears in exactly one
  file across all three web apps (`vendor/components/kyc/CameraCapture/useCamera.ts`).
  Whether the Expo camera has an analogous leak is a separate question this plan does not
  answer, and the user reported the web browsers specifically.
- **`booker` has document upload but no camera** — the same grep confirms it never calls
  `getUserMedia`, so B5 is genuinely vendor-only and needs no cross-app coordination.
- **`components/ui/ModalOverlay` has no other use case.** If a future non-dialog overlay
  (a lightbox, a non-modal sheet) is ever needed, write it then — D4 removes it now rather
  than keeping an unused abstraction alive on speculation.

---

## Execution order

Ordered by **user impact first**, then by risk within the refactor — simplest surface
before the hardest, so the pattern is proven cheaply. **One stage at a time by default.**

1. **Stage 1 — B5 + I7** (camera leak + its regression test). **The only stage fixing a bug
   a vendor can see.** Entirely independent of the modal work: it touches `useCamera.ts`,
   which nothing else in this plan modifies. Write the test first, watch it fail, then fix.
   If the rest of the plan is postponed indefinitely, this stage must still ship.
2. **Stage 2 — B1** (`OfferingFormModal`). Simplest shape, already behaviourally covered.
   Proves the `Root`/`Portal`/`Content` + D1 + I6 recipe end to end.
3. **Stage 3 — B2** (`ScheduleFormModal`). The sticky→flex restructure, with I1's constraint
   and the `saveBlocker` visibility check. Highest regression risk; also the best covered.
4. **Stage 4 — B3 + I4** (`StaffFormModal` + its gallery fixture, together). The only
   deliberately non-pixel-neutral conversion (D3), and the only one with no automated net.
5. **Stage 5 — B6** (`CameraCapture`). ⚠️ **After stage 1, never before** — see the coupling
   on B5/B6. Different shape from the other three (full-bleed, no `Dialog.Overlay`, no
   `onInteractOutside` guard), so it does not benefit from being adjacent to them.
6. **Stage 6 — B4** (delete + docs). **Must be last** — deleting `ModalOverlay` any earlier
   breaks the build and makes the conversion stages unverifiable in isolation. Its doc
   rewrite must now also cover the camera dialog, so it cannot precede stage 5 either.
7. **Stage 7 — I2, I3, I5, I6 live pass.** The browser checks no stage can complete alone,
   run once across all four converted dialogs.

I1 is not a stage — it is a constraint stages 2–4 must each satisfy, and stage 7 re-confirms
it by opening a form twice in one page visit.

**Safe prefix:** stage 1 depends on nothing else here and can start immediately. Stages 2–4
are independent of each other and of stage 1. Only stages 5–7 have ordering constraints.

---

## Verification

| Item | Check | Kind |
|---|---|---|
| all | `npx tsc --noEmit` exit 0; `npm test` still 145/145; `npm run build` compiles | machine |
| all | ESLint findings still 28 — no new ones on touched files | machine |
| **B5** | I7's spec **fails before the fix and passes after** — run it against unfixed code first | machine |
| **B5** | every track ever issued reads `ended` after close, for both the capture flow and the close-while-starting flow | machine |
| **B5** | real device: take both KYC photos, continue to step 6, camera indicator is **off** | live |
| **B6** | I7's spec still passes after the shell conversion | machine |
| **B6** | Escape closes; focus trapped; permission prompt still works; `<video>` never remounts | live |
| B1 | duration-picker tests (`pilot.spec.ts:142-160`) pass unchanged | machine |
| B2 | four save-blocker tests (`:97-129`) + date-granular tests pass unchanged | machine |
| B2 | body scrolls while header and footer stay pinned; `saveBlocker` readable without scrolling | live |
| B3 | no horizontal overflow at 360px; body scrolls at 85vh | live |
| B4 | `grep -rn "ModalOverlay" vendor/` finds nothing; build passes | machine |
| D1 | backdrop click does **not** close any of the three; Cancel, X and Escape all do | live |
| I1 | open a form, close it, open it again in the other mode — no stale fields; the Offerings → Schedule preselect still fires | live |
| I2 | every native date/time/select/datalist control usable without dismissing the dialog | live |
| I3 | the stranded-bookings `window.confirm` still works from inside the schedule form | live |
| I5 | full Playwright suite pass count before vs after each of B1/B2 | machine |
| I6 | no Radix console warnings on open | live |
| all | before/after screenshots per modal, both themes (B3 expected to differ — D3) | live, **local only** — baselines are gitignored |

**Regression surface to re-walk by hand:** the Offerings → Schedule handoff shipped in
`.plans/2026-08-14-…-handoff.md` runs *through* two of these modals — `OfferingFormModal`
hands off to `SchedulePromptModal`, and the arrival auto-opens `ScheduleFormModal` with a
preselected offering. After stages 1–2 that becomes a Radix→Radix handover in a single
commit, where Radix refcounts body scroll-lock and `pointer-events`. **Specifically check
that after "Set up schedule" the Schedule page is fully interactive** — that is the exact
check B10 of the other plan already left outstanding, and this plan is where it gets
answered properly.

No approval gates: no schema change, no migration, no new dependency
(`@radix-ui/react-dialog@^1.1.4` is already installed), no auth/RLS surface, one app.
