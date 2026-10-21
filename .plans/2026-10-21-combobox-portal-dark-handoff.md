# Handoff — the registration dropdown panel ignores its forced-dark wrapper

**Date:** 2026-10-21
**App / scope:** `vendor/` only — `components/ui/Combobox/`, plus two callers. **No CSS token change.**
**Status:** DRAFT — investigated and written up; **not implemented**. Owned by whoever executes
`.plans/2026-10-20-dark-mode-lift.md` **I9**, which this document exists to brief.

> One-line framing: a Radix portal lifts the dropdown panel out of the `<div className="dark">`
> that was forcing it dark, so on a light-mode browser the panel renders white on a dark form.
> Optimize for: the smallest change that is correct in **both** root themes and in every other
> place `Combobox` is used.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.

---

## How this was found

A tester on staging reported the vendor registration dropdowns as **white**, while the same screen
on the developer's machine was dark. It is neither a browser quirk nor a stale deploy. Investigated
2026-10-21 in the KYC session (`.plans/2026-10-19-vendor-kyc-document-labels.md`), which had no
business fixing it; it is recorded there only as the investigation that produced this file.

## The mechanism, link by link

Each of these was read, not inferred:

1. **The registration surface is hard-coded dark.** `vendor/components/auth/LoginPage/LoginPage.module.css`
   contains **zero** `--sp-*` tokens — `#04060e`, `rgba(255,255,255,0.025)` and friends. Same for
   `RegisterField.module.css` (`rgba(255,255,255,0.05)` input, `#fff` text). The screen looks
   identical in light and dark root themes.
2. **Its dropdowns are the shared, token-based `Combobox`** — province, city, barangay (via
   `components/address/AddressFields/AddressFields.tsx:22, 34, 47`) and division
   (`LoginPage.tsx:316`). There is **no native `<select>`** anywhere on the screen, so this is not
   an OS-rendered popup and `color-scheme` is irrelevant (the only `color-scheme` in the app is the
   `theme-color` meta in `app/layout.tsx:67-68`).
3. **That is why the callers wrap them in `<div className="dark">`** (`LoginPage.tsx:313` for the
   address block, `:316` for the division block — both since 2026-07-22). The dark tokens are
   declared under a plain `.dark { … }` class in `app/globals.css:130`, so a wrapper element does
   redefine them for its subtree. The **input** is inside that wrapper and is correctly dark.
4. ⚠️ **`components/ui/Combobox/Combobox.tsx:62` renders the panel inside `<Popover.Portal>`.**
   Radix mounts a portal on `document.body`, so the panel is **not** a descendant of the wrapper
   and never sees its variables.
5. **So the panel takes `--sp-panel-bg` from the root theme**, and the provider is
   `attribute="class" defaultTheme="system" enableSystem` (`app/layout.tsx:78`):

   | Root theme | `--sp-panel-bg` | What the tester sees |
   |---|---|---|
   | dark (OS dark) | `#0c1220` (`globals.css:160`) | dark panel — looks correct |
   | light (OS light) | `#ffffff` (`globals.css:125`) | **white panel on a dark form** |

The developer's machine was in dark mode and the tester's in light. Same code, same build.

## Scope checks already done — do not redo these

- **vendor only.** `booker/` and `command/` have **no forced-dark subtree**; every `dark:` hit in
  them is a Tailwind variant keyed off the root class, which behaves correctly. Nothing to change
  there.
- **`InfoTip` shares the portal pattern** (`components/ui/InfoTip/InfoTip.tsx:34`) but is not used
  on registration, so it is unaffected today. It would have the same bug inside any forced-dark
  subtree.
- **No portal anywhere in `vendor/` passes a `container` or a theme class** — all six were checked.
  There is no existing pattern to copy, which is why this needs a decision rather than a lookup.
- **The `Combobox` CSS is not the problem.** `.panel` correctly uses `var(--sp-panel-bg)`; its last
  change (`4f8e9cb`, 2026-10-15) only added the phone `font-size` rule.

## The fix — two options

### Option A — pass the theme scope to the portal  (recommended)
Add an optional prop to `Combobox` (`panelClassName`, or `forceDark` if you prefer it blunt), put it
on `Popover.Content` alongside `styles.panel`, and have the two registration callers set it.
`AddressFields` needs it drilled one level, since it owns three of the four comboboxes.

- **Why this one:** explicit, no layout risk, and it changes behaviour **only** where a caller asks
  for it. `Combobox` is used elsewhere (the offering wizard, settings) under the real theme, where
  today's behaviour is already correct and must not change.
- **Cost:** one prop threaded through one intermediate component.

### Option B — give the portal a container
`<Popover.Portal container={wrapRef.current}>` so the panel renders inside the Combobox's own
subtree and inherits whatever scope applies, with no new prop and no caller changes.

- **Why you might prefer it:** it fixes the class of bug rather than this instance, including any
  future forced-dark subtree, and `InfoTip` could take the same treatment.
- **Cost / risk:** the panel moves into the login card's stacking and overflow context. Check it is
  not clipped — the card has its own `overflow` and transformed/blurred ancestors — and that it
  still escapes any `overflow: hidden` on the step container. Needs `wrapRef` plumbed into the
  existing `wrap` div, which is currently un-reffed.

### Not the fix
- **Do not put `dark` on `Popover.Content` unconditionally.** It would force a dark panel in
  settings and the offering wizard under a light theme, which is a worse bug than the one being
  fixed.
- **Do not change `--sp-panel-bg`'s light value.** It is correct for light mode; the panel is only
  wrong because it is inheriting the wrong scope.

## Coupling to the dark-mode lift

Option C of `.plans/2026-10-20-dark-mode-lift.md` changes `--sp-panel-bg` in the dark block, so the
**dark half** of this bug changes value with that work while the **light half stays white
regardless**. Landing them together avoids shipping a retuned dark panel next to an un-fixed light
one, which would read as deliberate.

## Verification

- ⚠️ **Not machine-verifiable from a baseline.** The `/ui-gallery` suite screenshots the login and
  registration panes with their dropdowns **closed**, so no existing baseline covers the open
  panel, and none should change.
- **The check that matters needs a browser at both root themes:** open vendor registration with the
  browser/OS in **light** mode, open the Division dropdown, and confirm the panel is dark. Repeat in
  dark mode to confirm nothing regressed. Playwright can do both without a human via
  `test.use({ colorScheme: "light" })` / `"dark"` and an assertion on the panel's computed
  `background-color` — that would be a genuine addition, since nothing covers it today.
- `npx tsc --noEmit`, `npm run lint` (baseline is **29** problems — 26 errors, 3 warnings — all
  pre-existing; do not report fewer as an improvement without checking), `npm test`, and
  `npm run test:visual` (expect **no** baseline diff).
- ⚠️ A `next dev` on the `vendor/` folder blocks the visual suite entirely, whatever port is
  passed. Stop it first.

## Files, for orientation

| File | Line | Role |
|---|---|---|
| `vendor/components/ui/Combobox/Combobox.tsx` | 45-69 | `Popover.Root` → `Anchor`(wrap+input) → **`Portal`** → `Content`(panel) |
| `vendor/components/ui/Combobox/Combobox.module.css` | 31-40 | `.panel` → `var(--sp-panel-bg)` |
| `vendor/components/auth/LoginPage/LoginPage.tsx` | 313, 316 | the two `<div className="dark">` wrappers |
| `vendor/components/address/AddressFields/AddressFields.tsx` | 22, 34, 47 | three comboboxes needing the prop under option A |
| `vendor/app/globals.css` | 125, 160 | `--sp-panel-bg` light / dark |
| `vendor/app/layout.tsx` | 78 | `defaultTheme="system"` — why the root theme varies by viewer |

## The root cause, for the record

A dark-only screen assembled from theme-aware components. Either option is a patch over that; the
durable fix is a theme-aware login/registration surface, which would retire both
`<div className="dark">` wrappers and the hard-coded palette in `LoginPage.module.css`. That is a
larger piece of work and is **not** proposed here.
