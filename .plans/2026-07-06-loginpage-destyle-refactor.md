# Refactor inline styles out of LoginPage (→ Tailwind + tokens)

**Date:** 2026-07-06
**Scope:** `vendor` first (its `LoginPage` + KYC onboarding steps), then optionally `booker` / `command` as a per-app sweep.
**Status:** DRAFT — parked; recommendation recorded for later. No code changed yet.

> One-line framing: the `LoginPage` components are built with heavy inline `style={{…}}` objects (a pre-existing pattern, not introduced by the KYC work). Move styling to the stack-idiomatic approach — **Tailwind utilities + `cn()` + brand tokens in `tailwind.config.ts`** — so styles live outside the JSX, gain hover/focus/responsive states, and stay consistent with the rest of the codebase.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.

---

## Why this refactor

- The inline styles are **pre-existing** — the entire `LoginPage` in all three apps was authored this way. When the KYC steps were added they matched the file's existing convention (per the project's "match existing style" rule). So this is a refactor of the whole file, not a cleanup of the KYC additions alone.
- **Real gains, not just tidiness:** inline styles can't express `hover:` / `focus:` states or media queries — which is exactly why the file already offloads its responsive behaviour to hand-written classes in `globals.css` (`.login-left`, `.login-mobile-toggle`). Tailwind utilities unlock those states natively and remove that split.

## Current state (verified 2026-07-06, vendor app)

- `lib/utils.ts:5` — **`cn()` helper already present** (clsx + tailwind-merge) for conditional classes (selected type cards, disabled buttons).
- `app/globals.css:194+` — responsive `login-left` / `login-mobile-toggle` classes already exist and drive the **left info panel's mobile hide/toggle** behaviour. ⚠️ **Must be preserved exactly** — the user has explicitly protected this behaviour.
- `tailwind.config.ts` — present; the home for brand tokens.
- Stack: Next.js 15 + Tailwind CSS 3.4 + shadcn/ui.

## Chosen approach (recommended)

**Tailwind utility classes + `cn()` + brand tokens in `tailwind.config.ts`.**
- Convert `style={{…}}` → `className` utilities. Tailwind 3.4 arbitrary values cover everything in the file: `bg-white/5`, `rounded-[11px]`, `max-w-[940px]`, gradients via `bg-[linear-gradient(...)]`, etc.
- Lift repeated brand values (`#FFC200` gold, the navy `#04060e→#0d1b4b` gradient, the blue `#1a3a8f→#2563eb`) into **theme tokens** in `tailwind.config.ts` (e.g. `brand-gold`, `brand-navy`) — this is the "separate file" for design values, and dedupes them across steps/apps.
- Use `cn()` for conditional/state styling (selected card, disabled/loading buttons, error states).
- Prefer Tailwind state variants (`hover:`, `focus-visible:`, `disabled:`) — a capability inline styles never had.

### Alternatives considered (not chosen)
- **CSS Modules (`LoginPage.module.css`)** — true separate file, natively supported by Next.js, but introduces a second styling system alongside Tailwind; less idiomatic here.
- **Extracted style objects (`LoginPage.styles.ts` of typed `CSSProperties`)** — lowest churn (there's precedent: command's `PB` constant), but keeps every inline-style downside (no hover/focus/media queries). Fallback only.

## Scope & sequencing

- This inline-style pattern is **not unique to vendor's LoginPage** — booker's and command's LoginPages (and other components) share it. Per the **no-shared-code-between-apps** rule, each app is refactored **separately** (copy the token definitions per app; no cross-app imports).
- **Do vendor's LoginPage first** (freshest, just extended with KYC). Then decide whether to sweep booker/command.

## Execution outline (when unparked)

1. ⬜ Add brand tokens to `vendor/tailwind.config.ts` (gold, navy gradient, blue gradient, shared radii if useful).
2. ⬜ Convert `LoginPage.tsx` `style={{…}}` → Tailwind `className` (+ `cn()` for conditionals); introduce `hover:`/`focus-visible:`/`disabled:` variants where they improve UX.
3. ⬜ Keep the KYC step components consistent with the same tokens/utilities.
4. ⬜ **Preserve** the `login-left` / `login-mobile-toggle` responsive behaviour — do not alter the mobile info-panel hide/toggle (explicit user requirement). Decide per-item whether each stays in `globals.css` or moves to Tailwind `lg:`/`max-lg:` variants, without changing behaviour.
5. ⬜ `tsc --noEmit` clean; visual before/after parity check (desktop + mobile); verify the mobile toggle still works.
6. ⬜ (Optional) repeat as a separate pass for booker / command LoginPages.

## Verification
| Check | Kind |
|-------|------|
| Pixel/visual parity before vs after (desktop) | manual |
| Mobile info-panel hide + toggle behaviour unchanged | manual |
| `tsc --noEmit` passes in the app | machine |
| No new cross-app imports (tokens duplicated per app) | manual |

## Notes
- Pure visual refactor — no logic/behaviour change intended; highly testable via before/after comparison.
- Not blocking the KYC feature; sequence after the KYC backend or whenever chosen.
