---
name: design-preview
description: >
  Use before building a static design preview of a screen that does not exist yet — an
  HTML/CSS/JS mock under .plans/previews/ opened over file:// for design review ahead of
  implementation, for booker, vendor, command or the Expo mobile apps. Covers the
  JS-rendered-from-shared-helpers architecture, the scaffold and runner
  (.plans/previews/_shared/shoot.mjs), the CSP and no-inline-style rule, the nine machine
  checks, the three effects React Native cannot render, and the README contract. Not for
  /ui-gallery visual regression and not for a feature that already exists.
---

# Design preview

How to build a static preview of a screen that **does not exist yet**, so a design can be
reviewed and approved before any app code is written. Plan: `.plans/2026-10-18-design-preview-harness.md`.

A preview lives at `.plans/previews/<topic>/`, opens from `file://` with no server, imports no
app code, and reaches no network. It is reviewed alongside the plan it serves and committed next
to it, so "what exactly did we approve?" has an answer months later.

**Scaffold a new one — do not hand-write the boilerplate:**

```bash
node .plans/previews/_shared/shoot.mjs --new <topic> --app booker|vendor|command|mobile
node .plans/previews/_shared/shoot.mjs <topic>            # checks, no screenshots
node .plans/previews/_shared/shoot.mjs <topic> --shoot    # + contact sheets
```

---

## What this is not

- **Not `/ui-gallery` visual regression** (`architecture/conventions.md:370`). That drives a real
  route in a running app with committed `toHaveScreenshot` baselines. Different tool, different
  job; never conflate them.
- **Not a proof harness.** `.plans/previews/kiosk-binding/` is a synthetic lifecycle/ownership
  test with a mock server in Node. It predates this contract and is out of scope.
- **Not for a feature that already exists.** If the screen is built, screenshot the real app.
- **`near-me`, `offering-wizard` and `vendor-checkout` predate this contract** and were
  deliberately not converted. Do not copy their harnesses; copy nothing from them but ideas.

---

## 1. Architecture — screens render in JS, from shared helpers

**This is the rule that makes a preview cheap, and it is not a style preference.** Measured
across the three existing previews at equal screen counts:

| Preview | Screens | Style | Total source |
|---|---|---|---|
| `near-me` | 11 | every screen's DOM written out in `index.html` | **55 KB** |
| `offering-wizard` | 12 | JS renders screens from template strings | **30 KB** |
| `vendor-checkout` | 13 | same, with `header()`/`footer()`/`split()` helpers | **26 KB** |

Composing shared chrome in functions instead of repeating markup per screen halves the source.

⚠️ **That figure holds when screens REPEAT each other, and not otherwise.** near-me's eleven
screens are one storefront eleven times; vendor-checkout's thirteen are one wizard chrome
thirteen times — so there is a great deal for the lever to lift. Measured on `booker-ui`, whose
seven screens are structurally distinct comparison layouts sharing almost no chrome, the same
contract produced **4.0 KB per screen** of markup and rules — below the 5.0 KB DOM-in-HTML
baseline, above the 2.0–2.5 KB repeating-chrome ones. Expect the win on a flow; do not promise
it on a one-off comparison set. (On that preview a further **44% of hand-written bytes were
comments and on-screen findings prose** — on an analytical preview that text is the deliverable,
so total source size is a poor proxy for its cost.)

So:

- `index.html` holds **only** the shell: CSP, the `<link>`/`<script>` tags, a `#root`, and the
  preview bar. Nothing screen-specific.
- `screens.js` exports one function per screen returning an HTML string, built from the helpers
  in `./chrome.js`.
- A screen body that repeats across screens becomes a helper, not a copy.

The trade, stated honestly: a JS-rendered preview is not readable as static HTML. A reviewer
inspecting the DOM uses devtools. Accepted, because the reviewer is looking at rendered screens.

---

## 2. Files in a preview

| File | Hand-written? | Purpose |
|---|---|---|
| `screens.js` | **yes — this is the work** | one entry per screen: `{ id, label, render() }` |
| `preview.css` | **yes** | screen-specific rules **only** |
| `README.md` | **yes** | see §7 |
| `index.html` | scaffolded, rarely touched | shell + CSP + preview bar |
| `preview.json` | scaffolded | `{ app, viewports, themes }` — and `palette` for mobile |
| `tokens.css` | **NO — generated** | the app's `:root`/`.dark` block |
| `chrome.css` | **NO — generated** | generic `.pv*` layout |
| `base.js` | **NO — generated** | `window.PV` — generic helpers |
| `chrome.js` | **NO — generated** | `window.PVA` — app chrome (absent for `command`) |
| `controller.js` | **NO — generated** | screen/theme/URL, readiness signal |
| `mobile.css` | **NO — generated** | mobile only: device frame, native chrome |
| `.synced.json` | **NO — generated** | sync manifest; how drift is detected |
| `checks.mjs` | optional | preview-specific assertions |

⚠️ **The generated files must not be hand-edited.** The runner compares each copy against the
hash it last wrote and **fails rather than overwriting** — silently discarding your edit would
be worse. Change `_shared/<name>` instead and re-run; or delete the copy to take the shared
version again.

⚠️ **`preview.json` does not list the screens.** The runner reads `window.PREVIEW_SCREENS` off
the page, so `screens.js` is the single source of truth and the two can never disagree.

⚠️ **Never reference a parent path** (`../_shared/...`). It breaks the preview's own CSP under
`file://` — where a blocked stylesheet fails *silently* — and has no representable published
path if the preview is ever published. Everything is `./`.

---

## 3. The contract the runner depends on

- **Theme: a `.dark` class on `<html>`.** Not `data-theme`. All three web apps use `.dark`
  (`booker/app/globals.css:231`, `vendor/app/globals.css:130`, `command/app/globals.css:70`), so
  a token block pastes in from `globals.css` with no selector translation.
- **URL contract: `?screen=<id>&theme=light|dark&chrome=off`.** `chrome=off` hides the preview
  bar; the runner always passes it. The controller mirrors screen and theme back into the URL so
  any one state can be linked.
- **Screens come from `window.PREVIEW_SCREENS`** in `screens.js`: `[{ id, label, render }]`.
  The controller renders `render()` into `#root` and then sets
  `document.documentElement.dataset.pvReady = "1"` — which is what the runner waits on, so no
  preview declares a selector to wait for.
- **Navigation between screens is `data-goto="<id>"`** on any element. The controller
  delegates after every render; a screen never wires its own listener.
- **Anything else interactive is an optional `mount(root)`** on the screen, called after render
  and after the `data-goto` wiring. ⚠️ It is not retained — the next `setScreen` replaces
  `#root.innerHTML` — so a mount must not leave a listener outside `root` that it cannot
  survive losing. An observer should disconnect itself once its element leaves the document.
- **Screenshot naming: `{screen}-{viewport}-{theme}.png`.**
- **Viewports: `desktop` 1280×800 @1×, `mobile` 390×844 @2×.** Named in the runner, never
  redeclared per preview.
- **CSP, verbatim:**
  `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'`

---

## 4. Hard rules

- **No app imports.** Not `globals.css`, not a component, not a type. A preview that imports app
  code is no longer a static mock and drags Tailwind layers with it.
- **No network. At all.** The runner fails on a single non-`file://` request.
- **Invented fixtures only — never real vendor or customer rows.** A preview is a design
  artifact; wiring it to live data makes it a data-exposure surface for no benefit.
- ⚠️ **No inline `style=""` — AT ALL, and the CSP enforces it.** `style-src 'self'` blocks a
  style attribute outright and reports it as a console error, which is check 2. There is no
  "genuinely dynamic one-off value" escape here: a dynamic value becomes a `data-` attribute
  with its mapping in CSS, which is booker's own convention for division colours anyway
  (`data-accent` on `PVA.shelf`, `data-platform` on `PVA.device`). Markup in `screens.js` /
  `chrome.js`, styling in `preview.css` / `tokens.css` — the render/style half of
  `.claude/skills/component-separation/SKILL.md`, which binds preview assets even though the
  React hook half does not.
- ⚠️ **A CSS `mask-image`, `clip-path: url()` or canvas read of a local image needs a `data:`
  URI — a `./file.png` will NOT work.** Chromium treats one `file://` URL as cross-origin to
  another and those are CORS-checked fetches, so the element renders as a flat coloured box and
  the console fills with *"blocked by CORS policy"*. A plain `<img>` of the **same file** is
  fine, which is why this stays hidden until a preview masks something. Generate the `data:`
  URIs into their own stylesheet with a committed script — see
  `.plans/scripts/build-division-mask-css.mjs` and `booker-ui/masks.css`. Downscale first: a
  mask only needs an alpha channel.
- **Every tappable control ≥44×44** (`.claude/skills/ux-design/SKILL.md` §5). Machine-checked.
- **Both themes, from the same markup.** Checked at every screen.

---

## 5. Mobile previews — three effects React Native cannot render

⚠️ **`ezzy-vendor-mobile/src/theme/tokens.ts:7–11` names three web effects with no RN
equivalent:** gradients (`expo-linear-gradient`), blur (`expo-blur`), and `box-shadow`
(per-platform shadow objects via `shadow()`).

An HTML mock renders all three for free. A preview showing a blurred translucent card with a
soft multi-layer shadow would win approval for something RN cannot produce without extra
packages and per-platform work — the design equivalent of approving a migration that will not
apply. **The runner fails a mobile preview on:**

- `filter: blur(...)` or `backdrop-filter`
- a `box-shadow` with more than one layer
- `linear-gradient` on an element not marked `data-rn="linear-gradient"`

Mark an element `data-rn="linear-gradient"` only when the preview's README says which package
delivers it.

**Mobile needs no token file of its own.** `ezzy-vendor-mobile/src/theme/tokens.ts:1–5` ports the
vendor web `--sp-*` values verbatim *"so the two clients stay visually identical"* — so a mobile
preview uses `_shared/vendor.css` (or `booker.css`) for colour and `_shared/mobile.js` for native
chrome: header, tab bar, safe-area insets, status bar.

**Fonts:** name the device font explicitly (`Roboto` on Android, `-apple-system` on iOS). A
headless page otherwise inherits a desktop default and the mock lies about metrics.

---

## 6. The nine checks

The runner asserts all of these. They are listed here so the set cannot silently shrink:

1. no `pageerror` · 2. no console error · 3. zero non-`file://` requests · 4. no horizontal
overflow · 5. no interactive control under 44×44 · 6. no fixed chrome cropped out of the
viewport · 7. `node --check` on the preview's JS · 8. no drift in a synced file · 9. a known
token actually resolved

4–6 run per screen × viewport × theme. 9 uses `getComputedStyle`, because a CSP-blocked
stylesheet fails silently and a successful request proves nothing.

Mobile adds §5's three checks. Preview-specific assertions go in `checks.mjs`, which exports
`async function check(page, { screen, theme, viewport, fail })`.

---

## 7. The README

Sections, in order: **what it shows** (a table, one row per screen, saying what to look at) ·
**design fit** (which tokens, which existing component each piece copies, and *whether any new
dependency is implied*) · **limits** · **findings** · **regenerating**.

Two things worth preserving from the previews that came before this contract:

- **A warning preamble when the design could be misread.** `near-me/README.md` opens with
  *"⚠️ Read this first: what the map is"* because a reviewer would otherwise read city markers as
  vendor pins and approve a claim the data cannot support. This is per-preview judgment, not
  boilerplate — write one when the misreading is plausible.
- **A findings section.** A preview's job includes surfacing what it found. `near-me`'s F1 —
  *an active control is invisible in dark mode* — was a real defect in the design, recorded
  because the section existed. Note which findings are preview-only and which the real build must
  resolve.

**Isolation claim — word it about the right thing:**

> Static fixtures only: nothing is saved, no Supabase, no app imports, no network. The
> `shoot.mjs` run asserts zero non-`file://` requests and fails if one is attempted.

That sentence is true of the committed `file://` copy and the runner that checked it. It is
**false of anything served over https**, so if a preview is ever published for convenience, the
link must be labelled as a rendering of these same bytes and must not inherit the claim. For a
payment or kiosk design the claim is load-bearing evidence — it is what shows the design touches
no provider — so do not weaken or generalise it.

---

## 8. Verification before handing a preview over

```bash
node .plans/previews/_shared/shoot.mjs <topic>
```

One line on success. On failure, only the failures. Then **open `index.html` yourself** and look
at it in both themes at both widths — the checks catch overflow, contrast-blind sizing and
cropping, but not whether the screen communicates the design. That part is human and always was.

Record in the README's regeneration section what the run asserted and what still needs a real
build: focus movement, live announcements, real fonts, device safe areas.
