# Vendor visual suite: 43 failing baselines — diagnose, fix, re-baseline

**Date:** 2026-08-25 (rewritten same day — see *What the first draft got wrong*)
**App / scope:** `vendor/visual-tests/`, `vendor/app/ui-gallery/`
**Status:** ✅ **COMPLETE (2026-08-26).** `npm run test:visual` → **157 passed, 0
failed, EXIT=0** (157 = 156 + I2's new DOM test), read from the summary line of a
redirected log, unpiped. The suite began this plan at **43 failed / 156**.
All items done: B1, B2, B3, B4, I1, I2, I3. D1 and D2 both resolved.
**Nothing parked, nothing aborted.**
⚠️ One item remains OUTSIDE this plan's scope and sits with the user: **booker carries
the identical gitignore defect** (55 PNGs, 11 MB, same false "committed baselines"
claim). Untouched deliberately — a second app needs explicit approval per AGENTS.md.

> The vendor Playwright suite fails **43 of 156** tests and has done all session.
> Nobody noticed because the failures were never read correctly. This plan splits
> them into three clusters by evidence, fixes the one that is fully diagnosed, and
> scopes the two that are not.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important. Numbers are plan-local.

---

## ⚠️ What the first draft of this plan got wrong

The first draft (same file, earlier today) claimed the suite passed **115/115** and
that failures appeared only under `-g` filtering, and blamed a server/browser clock
disagreement. **All three claims were wrong**, and they came from one measurement
error worth recording so it is not repeated:

```
npx playwright test 2>&1 | tail -25     # ← how the "115/115, exit 0" was obtained
```

1. `tail -25` cut off the `43 failed` summary line. What remained was Playwright's
   **failure list** — bare test names — which was misread as a list of passes.
2. A pipeline's exit status is `tail`'s, so it is **always 0**. The "exit code 0"
   cited as confirmation proved nothing. Run without a pipe, the same suite exits **1**.

**Disconfirmed by direct measurement**, and not to be re-proposed without new evidence:
- *Clock/hydration:* sidebar's SSR HTML contains **no date strings at all**, and no
  hydration error reproduces standalone on any mode — including **with**
  `page.clock.setFixedTime` applied, which is precisely when the hypothesis predicts one.
- *Next dev overlay:* `nextjs-portal` **is** still present despite `devIndicators:false`
  and the `stylePath` CSS, but it measures **0×0** and hiding it changes document
  height by nothing (1200→1200, 1264→1264). It cannot produce a layout shift.
- *`-g` filtering:* all 15 login tests fail in a **full, unfiltered** run.
- *Machine load / agent interference:* a clean run with a committed tree, no scratch
  files and nothing else running still fails 43. Load was 2.94 on **32 cores**.

---

## The evidence: three clusters, not one bug

From the 43 `test-results/*/error-context.md` artifacts of the clean run:

| Cluster | Tests | Signature | Status |
|---|---|---|---|
| **A — unmasked version badge** | **24** — all `payout details`, all `account closure card` | Deterministic **9–14 px** diff (ratio 0.01), isolated to the bottom-right corner | ✅ **Fully diagnosed** |
| **B — login family + sidebar** | **17** — every `login*` mode, `login-mobile-info`, `sidebar` ×2 | **Non-deterministic**: 6k–35k px diff *or* a never-settles timeout, varying by run | ❓ Root cause unknown |
| **C — performancereversed** | **2** | Timeout only, both themes | ❓ Root cause unknown |

### Cluster A is solved

The diff image shows the entire card unchanged and **one** differing region, bottom
right. That is `DevVersionBadge` (`components/dev/DevVersionBadge.tsx`), which renders
`v{NEXT_PUBLIC_APP_VERSION}` in a `fixed bottom-4 right-4 z-50` pill.

`pilot.spec.ts` defines `badgeMask` for exactly this and applies it at `:59`, `:91`
and `:461` — but **three `toHaveScreenshot` calls omit it**:

| Line | Group | State |
|---|---|---|
| `1134` | `account completion modal` (describe `:1093`) | latent — passing today |
| `1191` | `payout details` (describe `:1140`) | **failing (12)** |
| `1226` | `account closure card` (describe `:1210`) | **failing (12)** |

Those baselines were recorded 2026-08-22/23; `package.json` is now **0.48.1** after
releases 0.46 → 0.48. The version text changed, so 9–14 pixels changed. **This will
break again on every single release** until the mask is applied — which is why the
fix is the mask, not a re-baseline.

### Cluster B is NOT stale baselines

Worth stating because it is the tempting conclusion. A stale baseline fails the same
way every run. Cluster B does not: the same screen produces a large pixel diff in one
run and a **timeout** in the next (`login-light` diff / `login-dark` timeout;
`loginregister-dark` diff / `loginregister-light` timeout). A timeout means
`toHaveScreenshot` never got two consecutive matching frames — the page never settled.
Something in the login surface is genuinely non-deterministic.

⚠️ **`sidebar` is grouped here on behaviour, not size.** Its diff is only ~260 px, but
it has also timed out in earlier runs, which is the cluster-B signature. It may split
off once B2 has data.

**Unexplained and worth carrying into B2:** these pages measured *stable* in isolation —
2 DOM mutations in 3 s (both the portal) and byte-identical screenshots 1.2 s apart.
Whatever destabilises them is not present when the page is loaded on its own.

---

## ⚠️ Reframe (2026-08-26, resolving D1) — cluster B largely dissolves

Reading the diffs, as D1 required, changed the picture for more than `sidebar`.

**The login diffs are the same stale-baseline story.** `login-light`'s diff shows the
whole right-hand panel doubled ~53 px apart, and at the bottom the **legal footer links**
(*Terms · Privacy · Acceptable Use · Cookies · Refunds · Deletion · Payments · About*)
present in one version and absent in the other. Those links landed with the same
2026-08-19 legalities work as `sidebar`'s "About & Legal" row. The footer makes the card
taller; the card is vertically centred; so every element above it moves up ~53 px. That
is the "uniform vertical offset with identical content" this plan spent so long treating
as a mystery. It was a feature, shipped and un-baselined.

**The timeouts were transient.** The current run produced **zero** timeouts — every
failure is a clean diff. The six timeouts seen earlier (`login-dark`, `loginforgot-dark`,
`loginregister-light`, `loginsent-light`, `performancereversed` ×2) all occurred in runs
that overlapped other activity on this machine. They look environmental (a 5 s
`toHaveScreenshot` cap against a slow render), not a defect in the pages.

**So the corrected taxonomy is:**

| Was | Actually |
|---|---|
| Cluster A — 24 tests | ✅ Real defect: unmasked version badge. Fixed in B1 |
| Cluster B — 17 tests | **Stale baselines** from the 2026-08-19 legalities work — not instability |
| Cluster C — 2 tests | **Transient**: timeouts that did not reproduce in a clean run |

⚠️ **The "non-deterministic, do not re-baseline" warning on cluster B was wrong**, and it
was wrong for an instructive reason: the diff/timeout flip-flop was read as evidence of
instability in the *pages*, when the diffs were constant all along and only the *timeouts*
varied — with the machine, not the code. Two signals were conflated into one phantom.

**Consequence for the plan:** B2 is no longer a debugging task. It becomes a deliberate
re-baseline of screens whose UI legitimately changed — which is exactly the operation
**B4/D2 currently blocks**, because baselines are not in version control and the
re-record cannot be undone. **B4/D2 must be settled first.**

---

## BLOCKERS

### B1 — Apply `badgeMask` to the three unmasked call sites  ✅ DONE (2026-08-26)
<!-- ✅ mask: badgeMask(page) added at pilot.spec.ts:1134, :1191, :1226. Verified:
     grep confirms EVERY toHaveScreenshot in the file now carries the mask; tsc 0.
     Diagnosis re-confirmed on a second sample before editing — the payout diff is
     also bottom-right badge only, whole form unchanged.
     Re-baselined with a filter listed FIRST via --list: 40 tests, all inside the three
     target describes, no leakage. mtimes confirm only those groups were rewritten
     (2026-08-26 08:22-08:23); loginregister-dark is untouched at 2026-08-09.
     New baseline read back visually: magenta mask box exactly where the version badge
     was, card otherwise identical.
     NON-CIRCULAR CHECK: re-ran the 40 WITHOUT --update-snapshots -> 40 passed, EXIT=0.
     ✅ CONFIRMED on a clean full run (2026-08-26): 43 -> 17 failed, 139 passed.
     All 24 cluster-A tests pass; zero payout/closure/completionmodal failures remain.
     (Predicted 19; actual 17 because the two performancereversed TIMEOUTS did not
     recur — see B3, now parked.) The 17 remaining are exactly the 15 login modes plus
     sidebar x2, all stale baselines per the Reframe. -->
**File:** `vendor/visual-tests/pilot.spec.ts:1134`, `:1191`, `:1226`

Add `mask: badgeMask(page)` to each, matching `:59`. Include `:1134` even though it
passes today — it carries the identical defect and will fail on the next release.

Then re-record **only those groups'** baselines
(`-g "payout details|account closure card|account completion modal"`
with `--update-snapshots`), and confirm the diff was the badge and nothing else by
reading one before/after pair rather than trusting the green.

⚠️ This is the **only** re-baselining this plan authorises. See D1.

### B2 — Re-baseline the screens changed by the 2026-08-19 legalities work  ✅ DONE (2026-08-26)
<!-- ✅ D2 resolved as (a): .gitignore's two PNG rules removed, 82 baselines committed by
     the user FIRST, deliberately including the 17 stale ones — which is what turned this
     re-baseline into a reviewable diff instead of a silent overwrite.
     Diffs verified BEFORE overwriting, across all four distinct screen types: sidebar
     (new "About & Legal" nav row), login (standard), loginselect (vendor picker),
     login-mobile-info (480x900 mobile viewport). Every one confined to the legalities
     change — legal footer links added, card grows, centred layout shifts ~53px.
     Scope confirmed via --list first: exactly 17 tests, matching the failure list.
     Result: 17 passed, EXIT=0, and `git status` shows EXACTLY 17 modified PNGs — no
     more, no fewer, all login/sidebar.
     New sidebar-light baseline read back: "About & Legal" present, badge masked.
     ✅ FULL SUITE GREEN (2026-08-26): **156 passed, 0 failed, EXIT=0** via
     `npm run test:visual`, redirected to a file and read from the summary line — NOT
     piped through tail. First fully green run of this investigation (was 43 failed). -->
<!-- Rewritten 2026-08-26 after D1. Was "diagnose non-determinism"; the diffs are
     deterministic and explained — see the Reframe above. -->
**Scope:** the `login*` modes and `sidebar` — screens that gained legal footer links and
an "About & Legal" nav row. Confirm each diff is confined to that change by reading the
image (as D1 did for `sidebar` and `login-light`), then re-record.
⚠️ Blocked by **D2**, not D1: re-baselining is irreversible while the PNGs are gitignored.
⚠️ The old text below is superseded; the `/api/divisions` fetch theory is unsupported —
`Sidebar.tsx` has no state, effects, fetch or timers at all, yet showed the same signature.
**Files:** `vendor/app/ui-gallery/page.tsx:730-738`; `vendor/components/auth/LoginPage/useLoginPage.ts`

Every failing mode in this cluster mounts `LoginPage`, and `useLoginPage` does work on
mount that the other gallery fixtures do not — including a **real network call** to
`/api/divisions` (`services/divisions.service.ts`), a `localStorage` KYC-draft read
and a draft-save effect, and a debounced email-availability check. Any of these
resolving after `networkidle` would re-render and shift layout.

**Diagnose before fixing:**
1. Instrument a failing mode with a `MutationObserver` **during the suite**, not
   standalone — the instability did not reproduce standalone, so the harness is part
   of the repro.
2. Route-mock `/api/divisions` for the gallery and re-run cluster B. If it goes
   deterministic, the fetch is the cause.
3. Establish whether the timeouts are the same defect or a 5 s cap against
   double-digit render times (14.6 s and 11.9 s were observed on an idle machine).

**Do not re-baseline cluster B under any circumstances until this is understood** —
its output is not stable, so a baseline recorded from it would encode one arbitrary
frame.

### B3 — `performancereversed` timeouts  ✅ DONE (2026-08-26)
<!-- ⏸ was PARKED as "did not reproduce". UNPARKED the same day: it reproduced on an
     idle machine, both themes, so the earlier parking was wrong.

     ROOT CAUSE, measured not guessed. The failure is "Failed to take two consecutive
     stable screenshots", NOT a baseline mismatch — and the two numbers only make sense
     once that is understood:
       * Playwright reported 962,679 differing pixels (ratio 0.90). That is the diff
         between TWO CONSECUTIVE LIVE FRAMES 100ms apart, not actual-vs-baseline.
       * Decoding the PNGs directly (hand-rolled zlib decoder, no PIL available), the
         saved frame differs from the baseline by exactly **1 pixel, delta 1**.
     So the page was right and the compositor was not settling.

     WHAT MOVES: every modal overlay is `bg-black/50 backdrop-blur-[6px]` (9 components).
     `backdrop-filter` is GPU-composited and not bit-identical frame to frame in headless
     Chromium, and the backdrop covers ~90% of the viewport — exactly the reported ratio.
     At maxDiffPixels: 0 a hair's difference fails the stability check, so the assertion
     times out having never reached the comparison at all.

     FIX: `expect.timeout` 5s (Playwright default) -> 15s in playwright.config.ts. It had
     to go on `expect`, not inside `toHaveScreenshot`, which rejects a timeout key
     (TS2769) — so it applies suite-wide; the only cost is a genuinely failing assertion
     taking 15s to give up.
     Rejected alternatives, recorded so they are not retried: raising maxDiffPixels
     (abandons pixel-exactness everywhere) and disabling backdrop-filter in
     playwright-screenshot.css (would re-baseline all 9 modal screens and stop the
     baselines showing what users actually see).

     VERIFIED: tsc 0; `-g performancereversed` run TWICE, 2/2 passed both times (was
     2/2 failed). Post-fix durations 4.3-4.7s — i.e. it was sitting just over the old 5s
     budget, which is why it presented as intermittent. -->

---

### B4 — The baselines are gitignored, so the suite protects nobody but this machine  ✅ DONE (2026-08-26)
<!-- ✅ D2 resolved as (a). vendor/.gitignore: both PNG rules removed
     (`visual-tests/*.png` matched nothing anyway — baselines live in the -snapshots/
     subdir) and replaced with a comment stating WHY they must not come back.
     Verified: `git check-ignore` no longer matches a baseline; 82 PNGs committed by the
     user. architecture/conventions.md's coverage table no longer claims "committed
     baselines" for either app (corrected under I1).
     ⚠️ booker is UNCHANGED and still carries the identical defect — 55 PNGs, 11MB, same
     ignore rule. Left alone deliberately: it is a second app and AGENTS.md requires
     explicit approval for a cross-app change. Still open, with the user. -->
**Files:** `vendor/.gitignore:48-53`; `architecture/conventions.md` (visual-regression table)

Discovered during B1's re-baseline, when `git status` reported **0 changes** after 32
baseline files had just been rewritten.

`.gitignore:53` excludes `visual-tests/pilot.spec.ts-snapshots/*.png`, so **no baseline
is in version control** — `git ls-files visual-tests/` returns 4 files, all `.ts`.

Two documents say otherwise and are wrong:
- `.gitignore:48`'s own comment — *"visual-regression run artifacts — **NOT** the
  committed baselines under visual-tests/"* — describes an intent the rule below it
  contradicts.
- `conventions.md`'s coverage table lists vendor as *"✅ specs + **committed
  baselines**"*.

**Why this outranks the 43 failures.** ⚠️ *Corrected 2026-08-26 — the original
wording here was wrong and was verified by experiment.* `toHaveScreenshot` does **not**
pass on a missing baseline: it **fails** ("A snapshot doesn't exist at …, writing
actual"). But it **writes the file while failing**, so the next run in the same
workspace passes, comparing the code against a baseline generated from itself. A single
clean CI checkout fails honestly (neither app sets `retries`); the silent-green case
needs a cached workspace, `retries` > 0, or a developer running twice. The plainer
reason to commit: without baselines a fresh checkout has nothing to compare against, so
the first run's result is meaningless either way. It also makes every baseline unreproducible across
machines, and it is why `git log` on the snapshots directory returned nothing earlier
in this investigation.

⚠️ It also means **B1's re-baseline was irreversible** — this plan and I assumed git
could undo it. Risk was contained only because the diff had been confirmed as
badge-only on two samples beforehand. Do not re-baseline anything else until this is
resolved.

**Fix approach:** decide whether baselines are committed (then remove the ignore rule
and commit the ~150 PNGs) or deliberately local (then correct both documents and accept
that the suite is a local-only tool). ⚠️ **This is a decision, not a cleanup — see D2.**

---

## IMPORTANT

### I1 — Correct four documents that carry the false claim  ✅ DONE (2026-08-26)
<!-- ✅ architecture/conventions.md: the false `-g` bullet replaced with three accurate
     ones (baselines not in git; never pipe through tail; every toHaveScreenshot needs
     badgeMask), and the coverage table no longer claims "committed baselines" for
     vendor OR booker (git ls-files: 0 tracked PNGs in both).
     .plans/...division-deeplink-regression.md: B2's verification explicitly RETRACTED
     with what still holds; the outcome header and B3's note corrected; N1 given a
     retraction banner.
     memory playwright-rerun-discipline: rewritten around the real lesson.
     Verified: grep shows no standing "115/115" claim anywhere — the 3 surviving
     mentions are all inside retraction text. -->
**Files:** `architecture/conventions.md` (visual-regression section);
`.plans/2026-08-25-vendor-division-deeplink-regression.md` (N1 **and** B2's verification
note); memory `playwright-rerun-discipline`

All were written from the "115/115, `-g`-only" misreading and are actively misleading.
Each needs: the suite fails 43/156; there is no `-g`-specific effect; and **a pipeline
through `tail` hides both the failure count and the exit code**.

⚠️ Keep the existing `--update-snapshots` warning in all of them — that advice was
right, and outside B1's scope it is still the most damaging available mistake.

### I2 — B2's verification in the division plan is invalid and must be redone  ✅ DONE (2026-08-26)
<!-- ✅ Redone properly, and the original instrument turned out to be wrong twice over:
     1. CIRCULAR — the loginregister baseline was re-recorded in B2 FROM the guarded
        code, so it passing proves nothing about the guard.
     2. BLIND — a screenshot could never have caught this regression anyway. An empty
        and a populated Combobox are pixel-identical while CLOSED: both show the
        "Select division" placeholder, because nothing is selected either way. The
        options exist in the DOM only once the list is open.
     Replaced with a DOM assertion in visual-tests/division-deeplink.spec.ts: mount
     /ui-gallery?mode=loginregister (which is initialView="register", the branch the
     guard must not starve), open the Combobox, assert the option is listed.
     PROVEN TO CATCH THE REGRESSION: with the guard deliberately moved ABOVE
     setDivisions — G1's exact mistake — the test fails with its own message
     ("element(s) not found"). Restored; git diff clean; tsc 0. -->
**File:** `.plans/2026-08-25-vendor-division-deeplink-regression.md`, item B2

It is marked ✅ citing "full suite 115/115, which includes the `loginregister`
baselines". That evidence does not exist — `loginregister` was already failing. The
**attribution** still holds (reverting to HEAD reproduced the failures, so the division
change is not the cause), but the guard's placement is currently supported by code
reading alone. Re-verify once cluster B is stable, or downgrade the item's status to
reflect what was actually checked.

### I3 — Make the suite impossible to misread  ✅ DONE (2026-08-26)
<!-- ✅ Added "test:visual": "playwright test" and "test:visual:update" to
     vendor/package.json; JSON re-parsed via node to confirm validity.
     VERIFIED the thing that actually matters: `npm run test:visual` on a failing suite
     recorded **EXIT=1** alongside "17 failed / 139 passed". The exit code now
     propagates, which is precisely what the piped-tail invocation destroyed. -->
**File:** `vendor/package.json`

There is no `test:visual` script, so the suite is run ad hoc and was piped through
`tail`. Add one that runs Playwright unpiped and propagates its exit code, so a failing
suite cannot present as a passing one.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains. -->

- **D2: are the visual baselines meant to be committed?** → **(a) YES, commit them**
  (resolved 2026-08-26). vendor's 82 baselines are now tracked. The stale ones were
  committed FIRST, on purpose, so B2's re-baseline landed as a reviewable 17-file diff
  showing exactly what the legalities work changed. Applied to `vendor` only; booker
  needs its own approval. Original framing: `.gitignore:48`'s
  comment and `conventions.md` both say yes; `.gitignore:53` does the opposite, and the
  opposite is what runs. **(a) Commit them** — the suite then means something in CI and
  on a teammate's clone, at the cost of ~150 binary files in the repo and a diff on
  every legitimate UI change. **(b) Keep them local** — then say so plainly in both
  documents and treat the suite as a local pre-commit tool only. **Recommend (a)**: a
  screenshot suite that auto-creates its own baselines on a fresh checkout gives false
  assurance, which is worse than no suite. Blocks B4.
- **D1: is `sidebar` in cluster B or its own problem?** → **NEITHER — it is a stale
  baseline for a real feature** (resolved 2026-08-26 by reading the diff, per option (b)).
  Its diff is deterministic (269 px dark / 260 px light, *identical* across two runs) and
  localised to exactly one new nav row: **"About & Legal"**. That row was added by the
  legalities work around 2026-08-19; the baseline dates from 2026-08-09. Nothing is
  unstable and nothing is broken — the baseline is simply older than the feature.

---

## Execution order

1. **B1** — fully diagnosed, self-contained, and removes 24 of 43 failures. Safe now.
2. **I1 + I3** — independent of everything else, and I1 is urgent because those
   documents are wrong today.
3. **Resolve D1**, then **B2**, then **B3**.
4. **I2** — after cluster B is stable, since it depends on a trustworthy suite.

---

## Verification

- **B1, machine-verifiable:** the 24 cluster-A tests pass, and a re-read of one
  before/after pair confirms the badge was the only change. Total failures should drop
  **43 → 19**.
- **B2, machine-verifiable once diagnosed:** cluster B produces the *same* result
  across three consecutive full runs. One green run is not evidence — non-determinism
  is the defect.
- **I1, machine-verifiable:** grep the four documents; no "115/115" or "`-g`-only"
  claim remains.
- **I3, machine-verifiable:** the new script exits non-zero on a failing suite.
- **Cannot be verified from the repo:** whether cluster B also affects CI or only this
  WSL2 machine. Renders of 14.6 s on an idle 32-core box suggest an environment factor
  that a different machine may not share.
