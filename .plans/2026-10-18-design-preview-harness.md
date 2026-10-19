# A cheaper design-preview workflow for upcoming features

**Date:** 2026-10-18
**App / scope:** Root repo only — new `.plans/previews/_shared/`, new `.claude/skills/design-preview/SKILL.md` (+ `.codex/` mirror), one trigger line in `.claude/skills/core-rules/SKILL.md`. **No app code (`booker/`, `vendor/`, `command/`, mobile), no `backbone/`, no migration, no new dependency** — Playwright is already installed in all three web apps. **No existing preview is converted.**
**Status:** COMPLETE (planned scope) — S1–S5 executed 2026-10-18; **all ten items ✅**. ⚠️ **One open follow-up: F9**, found by the user 2026-10-18 — the preview bar covers a bottom-anchored design, and the checks cannot see it because they always run with the bar hidden. B1 closed the same day
against `booker-ui`, the first contract-built preview, which also exercised the harness end to
end. **Eight findings (F1–F8), all fixed.** ⚠️ B1's measurement did **not** reproduce the
2.0–2.5 KB/screen figure and the skill's §1 claim is now qualified — read B1 before quoting it.

> One-line framing: the user will be building previews for the next several features. Make the
> *next* preview cheap to produce, measured in tokens. Four previews already exist; they are a
> data set to learn from, not a backlog to retrofit.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "booker I1").

---

## Scope

**Asked:** make building a design preview cheaper in tokens, for previews not yet written.

**Explicitly out of scope:**
- **Converting `near-me`, `offering-wizard` or `vendor-checkout`.** They are shipped and
  reviewed; their value is as a record and the record works as it is. (D3, resolved.)
- **`kiosk-binding`** — a synthetic lifecycle/ownership proof harness (`verify.cjs`, 20 KB,
  mock server in Node), not a design preview. Out of scope and the skill will say so.
- **The `/ui-gallery` visual-regression system** (`architecture/conventions.md:370`) — a
  different thing entirely: it drives a real route in a running app with committed
  `toHaveScreenshot` baselines. A design preview mocks a screen that does not exist yet. Not
  touched, not conflated.
- **The 24.3 MB of PNGs already in git history** — permanent without a history rewrite. Not
  worth it for a docs folder. This plan caps future growth only.

**In scope, per D8:** shared layers for **all three web apps** (`booker`, `vendor`, `command`)
**and the Expo mobile apps**. Mobile is not a fourth token set — see B4 and I1.

**Single app?** Yes — root repo only; nothing is written into any app folder. No cross-app
approval gate (D7).

---

## Investigation (2026-10-18) — verified, not recalled

### The dominant cost is the preview's own source, and architecture halves it

Three design previews, near-identical screen counts, measured on disk today:

| Preview | Screens | Architecture | `index.html` | `preview.js` | `preview.css` | **Total** |
|---|---|---|---|---|---|---|
| `near-me` | 11 | every screen's DOM in HTML, CSS class toggles | 26 KB | 4 KB | 24 KB | **55 KB** |
| `offering-wizard` | 12 | JS renders screens from template strings | 1 KB | 14 KB | 14 KB | **30 KB** |
| `vendor-checkout` | 13 | same, plus `header()`/`footer()`/`split()`/`button()` helpers | 2 KB | 12 KB | 11 KB | **26 KB** |

**The JS-rendered previews are roughly half the source for the same number of screens.** The
reason is visible in `vendor-checkout/preview.js:13–17`: shared chrome is composed by four
helper functions and reused across 13 screens, where the DOM-in-HTML style repeats that markup
per screen. `near-me/index.html` is 26 KB largely because eleven screens each carry their own
topbar, cards and shelves.

This dwarfs every other lever. The harness I proposed before writing this plan (a shared
runner, shared tokens, fewer screenshots) addresses 3–20 KB of capture script and a README
table. **Architecture addresses ~25 KB per preview.** It also kills an idea I was about to
propose — a shared `controller.js` — because the controller is *not* the generic part
(`near-me/preview.js` is only 4 KB). The generic part is the **chrome helpers**, and those are
per-app.

### The drift, which is the second cost

Four previews, four contracts — every harness re-invented from scratch:

| Preview | Theme mechanism | URL contract | Capture harness | PNG naming |
|---|---|---|---|---|
| `vendor-checkout` | `.dark` class | `?theme=&screen=` | `verify.cjs` 6 KB — shoots **and** asserts | `choice-dark.png`, `-mobile-`, `-viewport` |
| `offering-wizard` | `.dark` class | `?screen=&theme=&chrome=0` | **none committed** — unreproducible | `{screen}-{vp}-{theme}` |
| `near-me` | `data-theme` attr | `?screen=&theme=&chrome=off` | `capture.mjs` 3 KB | `{screen}-{vp}-{theme}` |
| `kiosk-binding` | n/a | — | `verify.cjs` 20 KB | none |

### Other verified facts

- **Scale:** 130 files, **24.3 MB** tracked under `.plans/previews/` (`near-me` 13 MB,
  `vendor-checkout` 5.9 MB, `offering-wizard` 5.7 MB) — almost entirely PNGs.
- **Token blocks are retyped every time.** `near-me/preview.css` makes 140 `--db-*`
  references, `offering-wizard/preview.css` 79 `--sp-*`, each with its own `:root` + `.dark`
  header copied out of the app's `globals.css`.
- **Theme mechanism: the apps settle it.** `booker/app/globals.css:231` and
  `vendor/app/globals.css:46,130` both define a **`.dark` class**; neither uses `data-theme`.
  `near-me` is the outlier. Since nothing is being converted, pinning `.dark` costs nothing.
- **Playwright is in `booker/`, `vendor/` and `command/`** `node_modules/@playwright/test`, and
  `vendor-checkout/verify.cjs:5` already resolves it by relative path — so **the runner needs
  no `cd` into an app.** `near-me/capture.mjs` requiring `cd booker` was avoidable.
- **Runner location:** not `.plans/scripts/` — its `README.md` is a per-run audit log for the
  checkout proof scripts and a preview runner would pollute that record. `_shared/` it is (D6).
- **Skill mirroring is required**, not optional: `AGENTS.md` says project skills are copied to
  `.codex/skills/`, and 10 of 15 are — including `ux-design`, this skill's closest sibling.
- **`command` fits the same mould:** `command/app/globals.css` uses a `--rs-*` token set (63
  references) and a `.dark` class at line 70 — same shape as booker and vendor, so its token
  file is mechanical. It has no existing preview, so its chrome helpers have nothing to be
  harvested from and must emerge from the first `command` preview rather than be guessed.
- **Mobile needs no token file of its own.** `ezzy-vendor-mobile/src/theme/tokens.ts:1–5`
  states its design tokens are *"ported from the vendor web app's `--sp-*` custom properties
  (`vendor/app/globals.css`, both `:root` and `.dark`) … copied verbatim so the two clients
  stay visually identical."* So a mobile preview's colours are already `_shared/vendor.css`.
  What differs is chrome (native header, tab bar, safe areas, status bar) and fidelity (B4).
- **No preview tooling exists in either mobile app** — no preview or screenshot script under
  `ezzy-booker-mobile/` or `ezzy-vendor-mobile/`, and `.claude/rules/mobile-stack.md` says
  nothing about previews. This is greenfield.

---

## BLOCKERS

### B1 — Pin the JS-rendered architecture, or the shared chrome layer is impossible  ✅ DONE
**Files:** `.plans/previews/vendor-checkout/preview.js:13–17` (the pattern to adopt),
`.plans/previews/near-me/index.html` (the pattern to avoid)

The two architectures are not interchangeable and only one admits a shared chrome layer. A
`_shared/booker.js` exporting `topbar()`, `card()`, `shelf()`, `button()` only pays off if
screens are composed in JS. If the contract leaves this open, the next preview picks whichever
style the moment suggests and the chrome layer never gets reused.

**Fix approach:** the skill pins **screens rendered in JS from composable helpers**;
`index.html` holds only the shell plus the preview bar. The one real cost is honest: a
JS-rendered preview's markup is not readable as static HTML, so a reviewer who wants to inspect
the DOM uses devtools. Given the reviewer is the user looking at rendered screens, that is an
acceptable trade — but it is a trade, not a free win.

**Verification:** machine — the first preview built under the contract is measured against the
55 KB / 30 KB / 26 KB baselines above and the number recorded. If it does not come in near the
JS-rendered figures, the contract is wrong.

✅ **DONE (2026-10-18)** — measured on `booker-ui`, the first contract-built preview.
**The result does not reproduce the JS-rendered figures, and the honest reading is that the
baseline comparison was never like-for-like.** Hand-written source, 7 screens:

| | bytes | per screen |
|---|---|---|
| `screens.js` | 30,680 | |
| `preview.css` | 20,422 | |
| **total hand-written** | **51,102** | **7.1 KB** |
| …comments and findings prose stripped | 28,458 | **4.0 KB** |

Against the baselines per screen: near-me **5.0 KB** (DOM-in-HTML), offering-wizard **2.5 KB**,
vendor-checkout **2.0 KB**.

**Why it lands high, and why the contract still stands.** The lever B1 claims — compose shared
chrome in functions instead of repeating markup per screen — only pays when screens *repeat*
each other. near-me's eleven screens are eleven variations of one storefront; vendor-checkout's
thirteen are one wizard chrome thirteen times. `booker-ui`'s seven are seven structurally
distinct analytical layouts (a 3-column mark matrix, a before/after comparison, a scroller),
which share almost no chrome with each other. There was nothing for the lever to lift.

**Two corrections this forces:**
1. **44% of the hand-written bytes are deliberate documentation** — 15% block comments, 20%
   on-screen findings prose, 8% column descriptions. On an analytical preview that text *is*
   the deliverable, so total source size is a poor proxy for cost. The stripped figure (4.0 KB)
   is the one comparable to the baselines, and it does sit below the DOM-in-HTML baseline.
2. **The skill's §1 claim is now qualified** rather than stated flat — "halves the source" is
   true of a repeating-chrome preview and not of a one-off comparison set.

<!-- ✅ DONE (2026-10-18) — measured on booker-ui; claim qualified in the skill's §1. -->

### B2 — A shared stylesheet referenced by parent path breaks both delivery surfaces  ✅ DONE
**Files:** `.plans/previews/offering-wizard/index.html:6` (the CSP),
`.plans/previews/near-me/preview.css:14`

The naive form of a shared token file — `<link href="../_shared/booker.css">` — fails twice:

1. **The preview's own CSP.** Every preview ships
   `default-src 'none'; script-src 'self'; style-src 'self'`. Under a `file://` document
   Chromium treats the origin as opaque, so whether `'self'` admits a stylesheet from a sibling
   directory is behaviour this repo has never exercised — all four previews reference
   `./preview.css` only. A CSP-blocked stylesheet **fails silently**, so this would surface as
   an inexplicably unstyled preview.
2. **It is unpublishable** if an artifact is ever used (D1): published file maps take relative
   paths with no leading slash, so a parent traversal has no representable path.

**Fix approach:** never reference a parent path. `_shared/<app>.css` and `_shared/<app>.js` are
**sources**; the runner syncs them into `<topic>/tokens.css` and `<topic>/chrome.js` and fails
if a synced copy has drifted (rather than silently overwriting a hand-edit). Everything
references `./`. The synced files are committed, and the skill must mark them generated.

**Verification:** machine — runner asserts a known token resolves via `getComputedStyle`, not
merely that the request succeeded, plus zero non-`file://` requests.

### B3 — Contact sheets must not become the only record of a failure  ✅ DONE
**File:** new `.plans/previews/_shared/shoot.mjs`

Cutting the screenshot matrix to ~4 contact sheets (D2) is where the git and token saving sits,
but a 1/4-scale grid hides exactly the defects full-size shots caught: `near-me` finding **F1**
was *"an active control is invisible in dark mode"* — a contrast defect a thumbnail would
plausibly not reveal.

**Fix approach:** contact sheets are the default record; the runner **additionally** writes a
full-resolution PNG for any screen it flags, and for any screen named in `--full`. Flagged
shots go to `<topic>/flagged/`, gitignored (reproducible, and committing them undoes D2).

**Verification:** machine — plant a sub-44px control in a scratch fixture, confirm the runner
fails **and** leaves a full-size PNG behind.

### B4 — An HTML mock of a mobile screen overstates what React Native can render  ✅ DONE
**File:** `ezzy-vendor-mobile/src/theme/tokens.ts:7–11`

Mobile previews are in scope (D8), and the honest technique for a feature that does not exist
yet is the same static HTML mock — the real Expo app cannot screenshot a screen nobody has
built, so screenshotting the Expo web build is not an option *before* approval. But the mobile
theme module names the trap precisely: **three web effects have no React Native equivalent** —
gradients (`expo-linear-gradient`), blur (`expo-blur`), and `box-shadow` (per-platform shadow
objects via `shadow()`).

An HTML mock renders all three the *web* way for free. A preview showing a blurred translucent
card with a soft multi-layer shadow would get design approval for something RN cannot produce
without extra packages and per-platform work — the design equivalent of approving a schema
change that will not apply.

**Fix approach:** `_shared/mobile.js` provides the native chrome (header, tab bar, safe-area
insets, status bar) **and** the skill forbids the three effects in a mobile preview unless the
preview states which RN package delivers it. The runner adds a mobile-only check: fail on
`filter: blur`/`backdrop-filter`, on any `box-shadow` with more than one layer, and on
`linear-gradient` outside an element marked `data-rn="linear-gradient"`. Fonts are a fourth
trap — the memory of earlier Expo web screenshots is that Roboto must be loaded explicitly in a
headless page, so the skill names the device font per platform rather than letting the mock
inherit a desktop default.

**Verification:** machine for the three CSS checks (a scratch fixture using each effect must
fail). **Human read** for whether the mocked native chrome actually resembles the app — there
is no automated comparison, and this is the limit worth stating plainly in every mobile
preview's README.

---

## IMPORTANT

### I1 — Shared chrome + tokens per app  ✅ DONE
**Files:** new `_shared/booker.{css,js}`, `_shared/vendor.{css,js}`, `_shared/command.css`,
`_shared/mobile.js` under `.plans/previews/`; sources `booker/app/globals.css:231`,
`vendor/app/globals.css:46,130`, `command/app/globals.css:70`,
`ezzy-vendor-mobile/src/theme/tokens.ts`

The largest saving (B1's corollary). Per app:

- **`<app>.css`** — the `:root` + `.dark` token block, extracted once, headed with its source
  file and the date copied. **Copies by design, not imports**: importing the real `globals.css`
  would drag Tailwind layers in and stop the preview being a static mock. The header must say
  they are snapshots that go stale, because they will.
- **`<app>.js`** — the chrome helpers that every screen of that app repeats. Harvested from
  what the existing previews already proved reusable: `vendor-checkout/preview.js:13–17`
  (`button`, `header`, `footer`, `split`) and the topbar/card/shelf markup repeated eleven
  times in `near-me/index.html`. Plus the shared icon-path map — `offering-wizard/preview.js:6–22`
  inlines 13 `lucide-react` glyph paths that any vendor preview will want again.

Per D8, five files rather than two, and deliberately **asymmetric** — writing a chrome layer
with nothing to harvest it from would be the speculative generality developerboss warns about:

| File | Tokens | Chrome helpers | Why |
|---|---|---|---|
| `booker.css` + `booker.js` | `--db-*`, `--div-*-deep` | topbar, card, shelf, button | `near-me/index.html` repeats this markup 11× — proven reusable |
| `vendor.css` + `vendor.js` | `--sp-*` | button, header, footer, split, icon map | already proven in `vendor-checkout/preview.js:13–17` + `offering-wizard/preview.js:6–22` |
| `command.css` | `--rs-*` (63 refs, `.dark` at :70) | **none yet** | no `command` preview exists; helpers emerge from the first one rather than being guessed |
| `mobile.js` | *none — reuses `vendor.css`/`booker.css`* | native header, tab bar, safe-area insets, status bar | `ezzy-vendor-mobile/src/theme/tokens.ts:1–5` ports the web `--sp-*` values verbatim, so colours are already shared; only chrome and B4's fidelity guards are mobile-specific |

**Component-separation (`.claude/skills/component-separation/SKILL.md`):** these are preview
assets, not app components, so the React hook rule does not bind. The *render/style* half does
and the skill carries it: markup composed in `chrome.js`/`screens.js`, styling in
`tokens.css`/`preview.css`, and **no inline `style=""`** — a rule `near-me/preview.css:9`
already states as deliberate and which the skill makes binding instead of per-preview folklore.

### I2 — The runner: `.plans/previews/_shared/shoot.mjs`  ✅ DONE
**File:** new

One entry point, run from anywhere:

```bash
node .plans/previews/_shared/shoot.mjs <topic>           # sync, check, shoot
node .plans/previews/_shared/shoot.mjs <topic> --check    # checks only, no PNGs
node .plans/previews/_shared/shoot.mjs <topic> --full picker,map
```

- Resolves Playwright from `<app>/node_modules` by path (`verify.cjs:5` pattern) — no `cd`.
- Syncs and drift-checks `tokens.css` + `chrome.js` (B2).
- Walks screens × viewports × themes over `file://`.
- Runs the standard check set (I3) at every cell.
- Contact sheets by default, full-size for flagged screens (B3).
- Emits `screenshots.md` (paste-ready) and `report.json`.
- **One line on success; on failure, only the failures.** Terse output is a deliverable — a
  chatty runner just moves the token cost from the write side to the read side.

Config at `<topic>/preview.json`, deliberately small:

```json
{ "app": "booker",
  "screens": [["home-unset", "Home · no location set"],
              ["picker", "Picker · choose a city"]],
  "viewports": ["desktop", "mobile"],
  "themes": ["light", "dark"] }
```

`desktop` = 1280×800 @1×, `mobile` = 390×844 @2× — the sizes all three design previews already
used, named once instead of redeclared per harness.

### I3 — Name the standard check set so it cannot silently shrink  ✅ DONE
**File:** new `.plans/previews/_shared/shoot.mjs`

Harvested from what the existing harnesses actually assert
(`vendor-checkout/verify.cjs:10–40`, `near-me/capture.mjs:60–78`), so consolidation loses
nothing already being checked:

1. no `pageerror`; 2. no console error; 3. zero non-`file://` requests attempted;
4. no horizontal overflow (`scrollWidth > innerWidth`); 5. no interactive control below 44×44
(ux-design §5); 6. no fixed chrome cropped out of the viewport; 7. `node --check` on the
preview's JS; 8. synced-file drift (B2); 9. a known token actually resolved (B2).

4–6 run per screen × viewport × theme. A preview may add its own assertions in an optional
`<topic>/checks.mjs` — which is how `vendor-checkout`'s bespoke phone-summary-height assertion
would survive this model without bloating the shared runner.

### I4 — Scaffold a new preview  ✅ DONE
**File:** new `.plans/previews/_shared/shoot.mjs --new <topic> --app <app>`

Directly serves the stated objective: several previews are coming, and the skeleton is
identical every time. Emits `index.html` (shell + preview bar + CSP), `screens.js` with one
stub screen, `preview.css` with only a screen-specific-rules header, `preview.json`,
`README.md` from the template (I6), and the synced `tokens.css` + `chrome.js`.

Cheap to build because it is a file-copy with two substitutions, and it removes the whole
boilerplate round from every future preview.

### I5 — The skill, its trigger, and its mirror  ✅ DONE
**Files:** new `.claude/skills/design-preview/SKILL.md`; new `.codex/skills/design-preview/SKILL.md`;
edit `.claude/skills/core-rules/SKILL.md` (Component Conventions, beside the existing
`ux-design` line)

Pins exactly what drifted, plus B1's architecture: JS-rendered screens from shared chrome;
`.dark` on `<html>`; `?screen=&theme=&chrome=off`; `{screen}-{viewport}-{theme}.png`;
`tokens.css`/`chrome.js` are generated; the README template; no app imports; no network;
**invented fixtures only, never real vendor or customer rows**; and that `kiosk-binding`-style
proof harnesses are not covered.

It must say plainly what it is **not**: an instruction file *costs* context to load. Its job is
to stop a fifth divergent contract. The saving lives in I1, I2 and I4.

Mirror to `.codex/skills/` or it does not exist for non-Claude agents.

⚠️ **It needs YAML frontmatter (`name:` + `description:`) or it is not a skill — just a
Markdown file nothing loads.** That block is what makes `/design-preview` exist and what lets
the model invoke it on its own; the path existing proves nothing. See F5.

### I6 — README template  ✅ DONE
**File:** inside `.claude/skills/design-preview/SKILL.md`

The existing READMEs are genuinely good and the template should preserve why. `near-me/README.md`'s
*"⚠️ Read this first: what the map is"* preamble stopped a reviewer misreading city markers as
vendor pins; the **Findings** sections are where F1 and F2 got recorded at all. Template keeps
what-it-shows / design-fit / limits / findings / regeneration. It must not flatten the
warning-preamble habit — that is per-preview judgment, not boilerplate.

⚠️ **If D1 ever becomes "publish an artifact",** the template's isolation claim must split in
two: every README today asserts *"no network at all — the capture run asserts zero
non-`file://` requests"*, which is **load-bearing** for `vendor-checkout` (it is the evidence a
kiosk payment design touches no payment provider) and **meaningless** about a page served over
https. Noted here so a later switch to artifacts does not quietly manufacture a false
assurance.

---

## DECISIONS

<!-- No item executes while an OPEN: line stands — plan-authoring §7. -->

- D3 — Retrofit scope → **convert nothing** (resolved 2026-10-18, user) — the objective is the
  next previews, not the shipped ones. Consequence: the runner ships without a side-by-side
  against `capture.mjs`, so its proving case is (a) B3's deliberate-failure scratch fixture and
  (b) the first real preview built under the contract, measured against B1's baselines.
  `near-me` keeps `data-theme` as a pre-contract legacy; the skill notes it.

- D5 — Theme mechanism → **`.dark` class on `<html>`** (resolved 2026-10-18) — both apps use it
  (`booker/app/globals.css:231`, `vendor/app/globals.css:46,130`), so copied token blocks need
  no selector translation, and with D3 there is **zero conversion cost**. `data-theme` has no
  precedent in any app.

- D6 — Runner location → **`.plans/previews/_shared/shoot.mjs`** (resolved 2026-10-18) —
  `.plans/scripts/README.md` is a per-run audit log for the checkout proof scripts; a preview
  runner there would pollute that record.

- D7 — Approval gate? → **No** (resolved 2026-10-18) — no new dependency (Playwright installed
  ×3), no schema change, no destructive SQL, no security surface, zero app code. Not a "large
  rewrite": ~6 new files in a docs folder plus one trigger line.

- D2 — Screenshots, when taken → **contact sheets + full-size for flagged screens**
  (resolved 2026-10-18, user) — so `--shoot` produces ~4 grid PNGs per preview, not 44, and
  `flagged/` is gitignored. Superseded in *default* by D1: nothing is shot unless asked. This
  also settles the old D4.

- D1 — Review surface → **local `file://`, and the runner shoots nothing by default**
  (resolved 2026-10-18, user) — you open `index.html` yourself and resize/toggle it. All nine
  checks still run on every invocation; PNGs are written only on `--shoot`. This is the
  cheapest possible loop: on a normal run nothing is written and nothing is read back.
  **Consequence for D2:** contact sheets stop being the default and become what `--shoot`
  produces when a plan needs a record. B3's flagged-full-size rule still applies, because a
  *failing* run must leave evidence whether or not `--shoot` was passed.

- D8 — Target apps → **all three web apps plus mobile** (resolved 2026-10-18, user: *"booker,
  vendor, command, other upcoming features which may include mobile"*) — see I1's table for
  what each one actually gets, and B4 for why mobile is the one with a correctness risk rather
  than just a new stylesheet.

---

## FINDINGS (execution, 2026-10-18)

Four problems the harness found — three of them in my own shared files, all caught by the
checks rather than by reading. Recorded because they are the evidence the check set earns its
keep.

### F1 — `style-src 'self'` blocks an inline `style=""`, and three shared helpers used one  ✅ FIXED
The CSP every preview carries forbids style attributes outright, reported as a console error
(check 2). `PVA.shelf` set `style="--section-accent: …"`, `PVA.device` set the safe-area
heights inline, and the scaffold's own `command` stub had `style="margin:20px"`. **The skill
already banned inline styles; the CSP turned out to enforce it, and I had broken my own rule in
the first file I wrote.** Fixed by moving each to a data attribute with its mapping in CSS —
`data-accent` on the shelf (mapped in `_shared/booker.css`, which is booker's own convention
for division colours), `data-platform` on the device frame, heights into `mobile.css`. The
skill's §4 now states the ban is CSP-enforced and that **there is no dynamic-value exception**.

### F2 — mobile previews synced no `tokens.css`, so not one token resolved  ✅ FIXED
The `SYNC` map had no `tokens.css` key for `mobile` (the palette is borrowed, so I wrote the
special case without the entry it keys off). `index.html` linked a file that was never written;
the stylesheet 404'd and every colour fell back to a browser default. **This is precisely the
silent failure check 9 exists for** — the request failing proves nothing, so the check asserts
`--pv-strong` actually *resolves* via `getComputedStyle`, and it caught this on the first run.
Without it the first mobile preview would have been reviewed in the wrong palette.

### F3 — the runner's own preview bar failed the runner's checks  ✅ FIXED
`.pv-bar` has a two-layer panel shadow and a `<select>`, so it tripped B4's RN shadow rule and
would have tripped the 44px rule. Worse, `?chrome=off` hides it with `display: none` and
**`getComputedStyle` still resolves `box-shadow` on a hidden element**, so the guard had to be
`getClientRects().length` plus an explicit `.pv-bar` exemption. Preview chrome is not design and
is now excluded from every element scan.

### F4 — contact sheets padded themselves out to the viewport  ✅ FIXED
`fullPage: true` on a fixed 1400×900 page produced mostly empty navy for a small screen set.
Now the grid sits in a `width: max-content` wrapper screenshotted by locator, and cell width
scales with count (460px at ≤2 screens, 360px at ≤6, 300px beyond) — because a sheet too small
to read is the exact failure mode B3 warns about.

### F5 — the skill shipped with no YAML frontmatter, so it was not installed at all  ✅ FIXED
`SKILL.md` opened straight at `# Design preview`. Every other skill in `.claude/skills/` carries
a `name:`/`description:` frontmatter block, and **that block is what registers a skill** —
without it Claude Code never lists `design-preview`, so neither `/design-preview` nor automatic
model invocation would ever have fired. The harness would have been reachable only through the
`core-rules` trigger line, i.e. only for an agent that happened to read the rules and follow a
path. Fixed by adding the frontmatter (`name: design-preview` plus a description naming the
trigger conditions, the runner path and the two "not this" cases) and re-mirroring to
`.codex/skills/`. Found by the user asking whether the skill was actually installed — I5's
verification checked that the *files existed at the right paths*, which they did, and that is
not the same thing as the skill being loadable. I5's check is now written to assert the
frontmatter, not just the path.

### F6 — a CSS `mask-image` cannot load a sibling `file://` PNG, but an `<img>` of the same file can  ✅ FIXED
`booker-ui` needs the mask technique (it is how production keeps near-black marks visible), and
every mask failed with *"Access to image … has been blocked by CORS policy"* — **120 console
errors on the first run**, caught by check 2. Chromium treats one `file://` URL as cross-origin
to another, and a mask is a CORS-checked fetch; a plain `<img>` of the identical file is not,
which is why this is invisible until a preview uses a mask. Isolated with a two-element test
case rather than guessed at. Fixed by generating the marks as `data:` URIs
(`.plans/scripts/build-division-mask-css.mjs` → `masks.css`, 96px, 164 KB).
**Any preview that masks, clips or canvases a local image hits this**, so it is now in the skill.

### F7 — the scaffold's own comment contradicted the skill's inline-style rule  ✅ FIXED
`shoot.mjs:472` seeded every new `preview.css` with *"No inline `style=\"\"` … except a
genuinely dynamic one-off value"* — the wording F1 had already removed from the skill, because
the CSP permits no exception. Every future preview would have been scaffolded with the
retracted rule. Fixed in the template.

### F8 — screens had no way to run code after render  ✅ FIXED
The division scroller's position indicator has to read `scrollLeft`, and the controller only
delegated `data-goto`. Added an optional `mount(root)` to `_shared/controller.js`, called after
render and after `wire()`. Documented as not retained: the next `setScreen` replaces
`#root.innerHTML`, so a mount must not register listeners outside `root` — `booker-ui`'s uses a
`ResizeObserver` that disconnects itself once its element leaves the document.

⚠️ **One thing `mount` does not solve: a live value still cannot be written as a style.**
A continuously-positioned progress thumb needs `el.style.width` or `setProperty`, both of which
put an inline style on the element. `booker-ui` uses dots and a class toggle instead.

### F9 — the preview bar sits on top of any bottom-anchored design  ⬜ OPEN
**File:** `.plans/previews/_shared/preview-chrome.css` (`.pv-bar`)

`.pv-bar` is `position: fixed` at the bottom of the viewport. So is a mobile bottom navigation
bar — which is the single most common piece of narrow-screen chrome a preview will ever show.
Measured on `booker-ui` at 390×844 with the bar visible (i.e. exactly what a human opening the
file sees): `.pv-bar` occupies 770–832, the design's bottom nav 787–844, **45px of its 57px
height covered.**

⚠️ **The nine checks cannot see this, by construction.** The runner always passes
`?chrome=off`, so every screenshot and every check runs with the bar hidden — the collision
exists only in the one mode the checks never exercise, which is the mode a reviewer uses.
F3 exempted `.pv-bar` from the element scans for the same reason, and that exemption is part
of why this stayed invisible.

**Reported by the user**, who had to hide the bar to review the bottom nav at all — after
being asked to review exactly that. Cost: a review round.

**Fix direction:** the bar should not occupy the bottom edge unconditionally. Options, cheapest
first — (a) move it to the top on narrow viewports; (b) make it a collapsed handle that expands
on tap; (c) keep it bottom-fixed but have the preview reserve space for it the way the page
reserves space for its own bottom nav. ⚠️ (c) is wrong: reserving space changes the layout the
reviewer is judging, which is the thing a preview must not do.

**Verification:** a check that opens a preview **with chrome on** and asserts no
`position: fixed` design element intersects `.pv-bar` — the gap this finding exposes.

---

## DEFERRED / COSMETIC

- **`command`'s chrome helpers** — tokens are written now (I1), helpers wait for the first
  `command` preview. Guessing a chrome layer with no markup to harvest it from is the
  speculative generality developerboss forbids.
- **`ezzy-booker-mobile` specifics** — `mobile.js` is built from `ezzy-vendor-mobile`, which is
  the app that is actually built out; the booker mobile app is a mock-data build in progress
  (`.plans/2026-09-21-booker-mobile-app.md`). If its chrome diverges, that is a later addition,
  not a guess made now.
- **Screenshotting the real Expo web build** — higher fidelity than an HTML mock, but it cannot
  show a feature nobody has built yet, which is the entire point of a pre-approval preview. It
  also carries known WSL friction (Metro misses new folders without `--clear`; Playwright
  stalls under load). Out of scope: a different tool for a different job.
- **The 24.3 MB already in git history** — accepted; see Scope.
- **`offering-wizard` has no committed capture script**, so its 48 PNGs are unreproducible.
  Accepted: the plan it served is COMPLETE and D3 converts nothing. Recorded so it is not
  rediscovered later as a surprise.
- **JS-rendered previews are not readable as static HTML** (B1's trade). Accepted: the reviewer
  looks at rendered screens, and devtools covers DOM inspection.

---

## Execution order

Each stage ends with a report per `AGENTS.md` → Execution Cadence.

All decisions are resolved, so the whole sequence is now safe to start. One stage at a time
with a report after each, per `AGENTS.md` → Execution Cadence.

1. **S1 — Contract first:** I5 (skill + `core-rules` trigger + `.codex` mirror), I6 (README
   template), including B1's architecture rule and B4's mobile prohibitions. Writing the
   contract before the runner stops the runner's defaults from silently *becoming* the
   contract.
2. **S2 — Shared layer:** I1's five files. This is the stage that carries the saving; the rest
   is plumbing.
3. **S3 — Runner:** I2 + I3, with B2's sync/drift, B3's flagged-full-size and B4's mobile
   checks built in from the start rather than bolted on. D1 sets the default to check-only.
4. **S4 — Scaffold:** I4, including a `--app mobile` variant.
5. **S5 — Prove it:** B3's and B4's deliberate-failure scratch fixtures, then B1's measurement
   against the 26–55 KB baselines on the first real preview. Re-run
   `python3 scripts/plans-index.py`.

**Executed 2026-10-18.** S1–S5 all ran. S5's fixture half is done and verified (see
Verification); its **measurement half is what keeps B1 at 🔄** — a one-screen scratch preview
cannot be compared against 11–13 screen baselines, so the first real feature preview closes it.
Scratch previews were deleted after the run; `.gitignore` now excludes
`.plans/previews/*/flagged/`.

**Safe-now prefix:** S1 through S4 are independent of any real preview. S5's measurement half
is coupled to whichever feature preview comes first, so it stays 🔄 until then — the plan
should not be marked COMPLETE on the strength of the scratch fixtures alone.

---

## Verification

| Item | How | Kind |
|---|---|---|
| B1 | First contract-built preview measured against 55 / 30 / 26 KB baselines; figure recorded in the skill | machine (byte count) |
| B2 | Runner asserts a known token resolves via `getComputedStyle` (a CSP-blocked stylesheet fails *silently*, so request success is not evidence) + zero non-`file://` requests | machine |
| B3 | Planted sub-44px control in a scratch fixture → runner fails **and** leaves a full-size PNG | machine |
| B4 | Scratch mobile fixture using blur, a multi-layer shadow and an unmarked gradient → runner fails on each | machine for the three checks; **human eye** for whether the mocked native chrome resembles the app |
| I1 | Diff `_shared/<app>.css` against the app's `globals.css` token block; confirm helpers render identically to the source previews' markup | machine diff + human eye |
| I2, I3 | Runner over the first contract-built preview: all nine checks fire, output stays one line on success | machine |
| I4 | `--new` scaffold produces a preview that passes `--check` with no hand-editing | machine |
| I5 | Frontmatter present and `name: design-preview` parses; skill appears in the loaded skill list; files exist at all three paths; `core-rules` line present; `.codex` copy matches | machine |
| I6 | Template exercised by the first real preview's README | human read |

**Cannot be machine-verified, stated plainly:** whether a preview communicates the design to
you, and whether the shared chrome helpers actually feel like the app. Both are human reads and
no runner replaces them.

**Honest cost estimate, recorded so it can be checked against reality later.** Per future
preview, versus what the last three cost:

| Lever | Saving |
|---|---|
| B1 + I1 — JS-rendered screens on shared chrome and tokens | **~25 KB of source**, the dominant term (55 KB → ~26–30 KB at equal screen count) |
| I2 — no per-preview capture harness | 3–20 KB |
| I4 — scaffolded boilerplate | shell, CSP, preview bar, README skeleton |
| I6 + D2 — no hand-written screenshot table, ~4 PNGs instead of 44 | ~12 rows × 4 links; 5–13 MB of git |
| D1 — check-only by default, no screenshots read on a clean run | ~6–10 full-size PNGs at ~1.1k tokens each |

Roughly **half** the per-preview cost, where my earlier estimate of 30–40 % was too low because
it had not yet found the architecture term. What stays at full price is the part that *is* the
design: the screen bodies and their screen-specific CSS. No tooling removes those, and anyone
expecting a preview to become cheap rather than cheaper will be disappointed.
