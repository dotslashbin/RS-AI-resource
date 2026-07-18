# Command — add the dev version badge (parity with booker & vendor)

**Date:** 2026-07-16
**App / scope:** `./command` (+ mirror the tweak already present in booker/vendor). No schema, no cross-app behaviour change.
**Status:** DRAFT — investigation complete; **awaiting approval to implement. No code changed.**

> **Goal:** command should display the build version in a small bottom-right badge in dev (and when `NEXT_SHOW_VERSION=1`), exactly like booker and vendor already do. Confirmed oversight — command is missing all three pieces of the mechanism.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.

---

## Root cause (verified 2026-07-16)

The version badge in booker/vendor is a 3-part mechanism; **command has none of the three:**

| Piece | booker / vendor | command |
|-------|-----------------|---------|
| Build-time version → env | `next.config.ts` reads `package.json` `version` and sets `env: { NEXT_PUBLIC_APP_VERSION: version }` | ❌ `command/next.config.ts` is a bare stub (`{ /* config options here */ }`) — no `env` |
| Badge component | `components/dev/DevVersionBadge.tsx` (fixed bottom-right pill, dev-only guard) | ❌ no `components/dev/` dir at all |
| Mounted in layout | `app/layout.tsx` renders `<DevVersionBadge />` | ❌ `command/app/layout.tsx` renders only `<Toaster />` |

Evidence:
- `booker/next.config.ts` / `vendor/next.config.ts` — identical: `const { version } = JSON.parse(readFileSync("./package.json", "utf8")); … env: { NEXT_PUBLIC_APP_VERSION: version }`.
- `booker/components/dev/DevVersionBadge.tsx` — `if (process.env.NODE_ENV !== "development" && process.env.NEXT_SHOW_VERSION !== "1") return null` then a fixed pill showing `v{process.env.NEXT_PUBLIC_APP_VERSION}`.
- `command/app/layout.tsx:16-22` — no badge; `command/next.config.ts` — stub; `command/components/` — no `dev/`.
- `command/package.json` — `"version": "0.8.3"` (so the badge would read **v0.8.3**).

**So the version renders on booker/vendor but not command purely because these three pieces were never added to command.**

---

## Key differences from a blind copy (do NOT just paste booker's files)

1. **Design tokens.** booker's badge uses `--db-card-bg` / `--db-card-border` / `--db-text`. Command's token namespace is **`--rs-*`** (`--rs-card-bg`, `--rs-card-border`, `--rs-text` — `command/app/globals.css:15,16,26`). A blind copy would render with unstyled/wrong colours.
2. **Styling convention.** Command's components are **CSS Modules** (45 `*.module.css` files; utility-class components are essentially absent), unlike booker/vendor which are Tailwind-first. So command's badge should be a **CSS Module** (`DevVersionBadge.module.css`) per `skills/component-separation.md`, not Tailwind arbitrary classes. (Tailwind IS available in command, but CSS Modules match the house convention.)
3. **Visual-regression harness coupling** (see B-coupling below).

---

## Changes

### C1 — `command/next.config.ts`: expose the version  ⬜ TODO
Replace the stub with the booker/vendor pattern:
```ts
import type { NextConfig } from "next";
import { readFileSync } from "fs";

const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: version },
};

export default nextConfig;
```

### C2 — create `command/components/dev/DevVersionBadge.tsx` (+ `.module.css`)  ⬜ TODO
Render layer (mirrors booker's guard + markup, but className via the module):
```tsx
import styles from "./DevVersionBadge.module.css"

export function DevVersionBadge() {
  if (process.env.NODE_ENV !== "development" && process.env.NEXT_SHOW_VERSION !== "1") return null
  return (
    <div className={styles.badge}>
      <span className={styles.text}>v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
    </div>
  )
}
```
`DevVersionBadge.module.css` — 1:1 of booker's badge styling, retargeted to `--rs-*`:
```css
.badge {
  position: fixed; bottom: 16px; right: 16px; z-index: 50;
  padding: 4px 10px; border-radius: 9999px; pointer-events: none;
  background: var(--rs-card-bg); border: 1px solid var(--rs-card-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
.text { font-size: 10px; font-family: monospace; opacity: 0.5; user-select: none; color: var(--rs-text); }
```
*(bottom/right 16px = booker's `bottom-4 right-4`; padding `4px 10px` = `py-1 px-2.5`; radius 9999 = `rounded-full`.)*

### C3 — mount it in `command/app/layout.tsx`  ⬜ TODO
Add the import and render `<DevVersionBadge />` inside `<body>` after `{children}`/`<Toaster />` (matching booker/vendor placement).

---

## Coupling (must ship together)

- **B-coupling — command's Playwright visual suite.** command has `playwright.config.ts` + `visual-tests/pilot.spec.ts` and its baselines were captured **without** a badge. The suite runs `next dev`, where the badge **renders** (NODE_ENV=development) → it would appear bottom-right in every screenshot and **break all command baselines** (this is exactly the flake booker/vendor avoid). **Fix in the same change:** add the mask to command's spec, mirroring booker —
  `await expect(page).toHaveScreenshot(name, { …, mask: [page.locator("div.fixed.bottom-4.right-4.z-50")] })`.
  ⚠ The mask selector `div.fixed.bottom-4.right-4.z-50` is booker's **Tailwind class** selector; command's badge is a **CSS Module** (hashed classnames), so that selector won't match. Use a stable selector instead — add `data-testid="dev-version-badge"` to the badge `div` and mask `page.locator('[data-testid="dev-version-badge"]')`. (Small deviation from booker; call out so the reviewer expects it.)

---

## Execution order
1. C1 (next.config) → C2 (component + module, with `data-testid`) → C3 (layout mount).
2. B-coupling: update `command/visual-tests/pilot.spec.ts` mask **before** re-running the suite.
3. Verify.

## Verification
| Check | Kind |
|-------|------|
| `npm run dev` in command → badge shows **v0.8.3** bottom-right; hidden in a prod build unless `NEXT_SHOW_VERSION=1` | needs live env |
| `tsc --noEmit` in command passes | machine |
| command visual suite passes 0-diff **after** adding the badge mask (proves the badge is masked and nothing else moved) | machine (Playwright) |
| `NEXT_PUBLIC_APP_VERSION` resolves at build (not `undefined`) | machine (grep built output / dev console) |

## Notes / decisions
- **Decision — CSS Module vs Tailwind for the badge:** use a **CSS Module** to match command's convention (recommended). Override only if you'd rather keep the badge implementation byte-identical to booker/vendor.
- **Decision — mask selector:** command's badge needs a `data-testid` (CSS-Module classnames are hashed), unlike booker/vendor which mask by Tailwind class. Minor, but intentional.
- Optional consistency follow-up (out of scope): booker/vendor mask by `div.fixed.bottom-4.right-4.z-50`; if a `data-testid` is added to command's badge, consider adding the same testid to booker/vendor badges later so all three suites mask by one stable selector.
- Not committed by the agent — user handles commits.
