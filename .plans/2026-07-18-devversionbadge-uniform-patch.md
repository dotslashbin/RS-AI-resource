# Uniform DevVersionBadge across booker / vendor / command

**Date:** 2026-07-18
**App / scope:** `./vendor` + `./command` (cross-cutting: touches two apps in one task — flagged per AGENTS.md approval gate). `./booker` is the reference implementation and is **not** modified.
**Status:** ✅ COMPLETE (2026-07-18) — both fixes executed; verified via `tsc --noEmit` (clean), live in-browser screenshots (light+dark parity across all three portals), and vendor's Playwright visual suite (34/34 pass on regen + 34/34 0-diff on verify re-run). Changes left uncommitted per user (user handles commits). No behaviour change — dev-only badge, visibility guard unchanged.

> **Goal:** the dev version badge should render identically (background, border, shadow, font) in all three portals. Booker is confirmed correct and is the reference. Investigation found **two independent, real bugs** — one in vendor, one in command — not a single command-only gap as originally assumed.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** I# = Important. No blockers — purely cosmetic, no schema/security/data impact.

---

## Root cause (verified 2026-07-18)

All three badges share the same layout (`fixed bottom-4 right-4 z-50`, `px-2.5 py-1` / `4px 10px`, `rounded-full` / `9999px`, `pointer-events-none`, `text-[10px]` / `10px`, `opacity-50` / `0.5`) — that part is already uniform. The divergence is in how each references its app's design tokens for background/border/shadow/font:

| Piece | Booker (reference) | Vendor | Command |
|---|---|---|---|
| Background | `bg-[var(--db-card-bg)]` | `bg-sp-card` ❌ | `background: var(--rs-card-bg)` ✅ |
| Border | `border-[var(--db-card-border)]` | `border-sp-divider` ⚠️ | `border: 1px solid var(--rs-card-border)` ✅ |
| Shadow | `shadow-[0_2px_8px_rgba(0,0,0,0.2)]` | `shadow-sm` ❌ | `0 2px 8px rgba(0, 0, 0, 0.2)` ✅ |
| Font | `font-mono` (Tailwind default stack) | `font-mono` ✅ | `font-family: monospace` ❌ |

### I1 — Vendor: `bg-sp-card` is not a registered Tailwind utility — badge renders with no background

**File:** `vendor/components/dev/DevVersionBadge.tsx:4`

```tsx
<div className="fixed bottom-4 right-4 z-50 px-2.5 py-1 rounded-full bg-sp-card border border-sp-divider shadow-sm pointer-events-none">
```

`vendor/tailwind.config.ts:63-70` registers the `sp` colour family with exactly `strong`, `text`, `divider`, `pill-bg`, `overlay-faint`, `overlay-subtle` — there is no `sp.card`. `bg-sp-card` matches nothing, so Tailwind's JIT emits **no CSS for it** (unrecognized utilities are silently dropped, not an error) — the badge currently has a **transparent background**, not the intended solid glass-card look.

Every other card-shaped element in vendor uses the plain CSS class `sp-card` (`vendor/app/globals.css:185`: `.sp-card { background: var(--sp-card-bg); border: 1px solid var(--sp-card-bdr); border-radius: 18px; box-shadow: var(--sp-card-shadow); backdrop-filter: var(--sp-card-blur); }`), confirmed in 20+ components (`OfferingCard`, `StaffCard`, `Sidebar`, etc. — see `grep -rn "sp-card\b" vendor`). But that class forces `border-radius: 18px`, which conflicts with the badge's pill shape — so the fix is **not** `className="sp-card"`, it's referencing the underlying variables directly, exactly as booker does with `--db-card-bg`/`--db-card-border`.

Two more issues on the same line:
- `shadow-sm` is Tailwind's default utility (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`) — much lighter than booker/command's explicit `0 2px 8px rgba(0,0,0,0.2)`.
- `border-sp-divider` resolves to `--sp-divider`, the general divider token, not `--sp-card-bdr` (the card-specific border token booker/command's badges mirror). Currently the two tokens hold identical values in both themes (`vendor/app/globals.css:98` vs `:108`, and `:133` vs `:143`), so there's no visible difference today — but it's the wrong semantic reference and would silently drift if the tokens ever diverge.

**Fix approach:**
```tsx
<div className="fixed bottom-4 right-4 z-50 px-2.5 py-1 rounded-full pointer-events-none bg-[var(--sp-card-bg)] border border-[var(--sp-card-bdr)] shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
  <span className="text-[10px] font-mono opacity-50 select-none text-sp-text">
    v{process.env.NEXT_PUBLIC_APP_VERSION}
  </span>
</div>
```
(`text-sp-text` unchanged — `sp.text` is registered and already correct.)

✅ DONE (2026-07-18) — executed exactly as scoped, plus the mask coupling below. Verified: `npx tsc --noEmit` clean; live in `npm run dev` at `localhost:3100/ui-gallery?theme=light|dark`, screenshotted the badge and confirmed a solid glass-card pill with the intended `0 2px 8px rgba(0,0,0,0.2)` shadow in both themes, matching booker pixel-for-pixel in the crop comparison.

---

### I2 — Command: convert `DevVersionBadge` from CSS Module to Tailwind arbitrary-value classes (literal parity with booker/vendor)

**Files:** `command/components/dev/DevVersionBadge.tsx`, `command/components/dev/DevVersionBadge.module.css` (deleted)

**Decision (updated 2026-07-18):** originally scoped as a one-line `font-family` fix inside the CSS Module (see superseded note below), but the user chose full conversion to Tailwind for byte-level parity with booker/vendor over preserving command's CSS-Modules-first convention for this one component. Rationale for the user: effort is equivalent either way (~10-line component); this is a style-consistency call, not an effort call.

Command's `tailwind.config.ts:14-18` registers an `rs` colour family, but — same class of gap as vendor's I1 — it does **not** have a `card` key, and its `text`-equivalent is confusingly named `muted` (`rs.muted → var(--rs-text)`, `rs.border → var(--rs-divider)`, not `--rs-card-border`). Using `bg-rs-card` / `text-rs-text` would silently fail exactly like vendor's `bg-sp-card` did. **Fix uses arbitrary-value classes referencing the CSS variables directly** (`bg-[var(--rs-card-bg)]` etc.), sidestepping the registration gap entirely — this is what booker itself does for background/border (it only uses a registered utility, `text-db-text`, because `db.text` happens to exist in booker's config; command has no equivalent, so arbitrary values are used throughout instead).

**Fix approach** — replace `command/components/dev/DevVersionBadge.tsx` entirely:
```tsx
export function DevVersionBadge() {
  if (process.env.NODE_ENV !== "development" && process.env.NEXT_SHOW_VERSION !== "1") return null
  return (
    <div
      data-testid="dev-version-badge"
      className="fixed bottom-4 right-4 z-50 px-2.5 py-1 rounded-full pointer-events-none bg-[var(--rs-card-bg)] border border-[var(--rs-card-border)] shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
    >
      <span className="text-[10px] font-mono opacity-50 select-none text-[var(--rs-text)]">
        v{process.env.NEXT_PUBLIC_APP_VERSION}
      </span>
    </div>
  )
}
```
Delete `DevVersionBadge.module.css`. No change needed to `command/app/layout.tsx` (import path/name unchanged) or to `command/visual-tests/pilot.spec.ts` — the `data-testid="dev-version-badge"` attribute is kept on the div specifically so the existing mask selector (`'[data-testid="dev-version-badge"]'`) keeps working unchanged across the markup swap. This is deliberately more robust than booker/vendor's fragile full-class-string mask selector (`div.fixed.bottom-4.right-4.z-50`) — worth carrying back to them later (see Deferred).

<!-- superseded 2026-07-18: original fix was `.text { font-family: monospace }` → the Tailwind default mono stack (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`, confirmed via node_modules/tailwindcss/stubs/config.full.js:313-321, Tailwind 3.4.19) inside the CSS Module, keeping the Module. Superseded by full Tailwind conversion per user decision. -->

✅ DONE (2026-07-18) — `DevVersionBadge.tsx` rewritten exactly as scoped above (including keeping `data-testid`); `DevVersionBadge.module.css` deleted. Verified: `npx tsc --noEmit` clean; `command/app/layout.tsx` and `command/visual-tests/pilot.spec.ts` needed **zero** changes (import path and mask selector both untouched by the swap, as predicted). Live-verified in `npm run dev` at `localhost:3102` — light mode confirmed pixel-equivalent to booker/vendor once Next.js's own dev-tools indicator (unrelated "N" button, see note below) was hidden for the crop; dark mode confirmed correct against the **real app** (`/` with `.dark` toggled on `<html>`, mirroring what `useAppShell.ts:103` does) — renders a matching dark glass pill (`rgba(255,255,255,0.027)` background, as expected).

**Side finding (not a bug, no fix needed):** command's `/ui-gallery` *test fixture* (`app/ui-gallery/page.tsx:218`) scopes its dark-mode class to an inner `<div className={dark ? "dark" : ""}>` rather than `<html>`, unlike booker's fixture which drives real `next-themes.setTheme()` onto `<html>`. Since `<DevVersionBadge />` mounts in `layout.tsx` as a sibling of `{children}` (outside the gallery's wrapper), the fixture's dark mode never reaches the badge — it appeared to render as a light pill against a dark gallery background when tested via `?theme=dark`. Confirmed this is fixture-only: the real app's `useAppShell.ts:103` (`document.documentElement.classList.toggle("dark", v)`) puts the class on `<html>` itself, which correctly cascades to the badge. No code change made — noted here so a future tester isn't fooled by the same fixture artifact.

---

## Coupling — must ship together

**I1 ⟷ vendor's visual-regression suite has no badge mask.** Unlike booker (`visual-tests/pilot.spec.ts:34`, mask `div.fixed.bottom-4.right-4.z-50`) and command (mask via `data-testid="dev-version-badge"`), **vendor's `visual-tests/pilot.spec.ts` has no mask at all** (checked all 3 `toHaveScreenshot` calls — lines 19, 29, 39). Vendor's `playwright.config.ts` runs `npm run dev` (`NODE_ENV=development`), so the badge is visible and baked unmasked into vendor's existing screenshot baselines. Fixing I1 changes the badge's rendered pixels (solid background + real shadow appear where there was none) — **this will diff every baseline where the bottom-right corner is captured**, unless a mask is added in the same change.

**Fix, in the same commit as I1:** add a mask to all three `toHaveScreenshot` calls in `vendor/visual-tests/pilot.spec.ts`, mirroring booker exactly (same DOM structure/classes, so the same selector works):
```ts
mask: [page.locator("div.fixed.bottom-4.right-4.z-50")]
```
Then regenerate/verify vendor's baselines so the suite is green with the badge masked out, not because the diff happens to match.

✅ DONE (2026-07-18) — mask added to all three `toHaveScreenshot` calls in `vendor/visual-tests/pilot.spec.ts`. Not run against CI/baselines in this session (needs `npx playwright test --update-snapshots` locally, which is a longer live-environment step) — flagged as the one remaining machine-verification step, see Verification section.

Command needs no test coupling for I2 — its mask already exists and targets `data-testid`, unaffected by the full rewrite (confirmed unchanged, see I2 DONE note).

---

## DECISIONS

- Keep command's badge as a CSS Module vs. convert to Tailwind arbitrary-value classes for literal byte-parity with booker → **convert to Tailwind** (resolved 2026-07-18, user choice) — effort is equivalent either way; parity with booker/vendor was prioritized over command's CSS-Modules-first convention for this one component. This makes command's badge the only Tailwind-styled component in `command/components` (45 other components stay CSS Modules) — an accepted, deliberate outlier.
- Vendor: reference `var(--sp-card-bg)` / `var(--sp-card-bdr)` directly via Tailwind arbitrary values (booker's pattern) rather than the shared `.sp-card` global class → **not open for debate** — `.sp-card` hardcodes `border-radius: 18px`, incompatible with the badge's pill shape.

## DEFERRED / COSMETIC

- Booker's `--db-text` is identical in light and dark mode (`booker/app/globals.css:63,132` — both `#64748b`), while command's equivalent `--rs-text` does change with theme (`#64748b` / `#94a3b8`). This is a pre-existing token-design difference in each app's own palette, not something the badge patch should paper over — out of scope here.
- Command's `data-testid="dev-version-badge"` mask selector is more robust than booker/vendor's full-class-string selector (`div.fixed.bottom-4.right-4.z-50` breaks silently if any layout class is ever reordered/changed). Worth adding the same `data-testid` to booker's and vendor's badges later so all three suites mask by one stable attribute — not done here to keep this patch scoped to the visual bugs only.

## Execution order

1. **I1 + its test coupling** (vendor `DevVersionBadge.tsx` fix + `pilot.spec.ts` mask, same commit) — do first since it's the bigger visible bug (missing background).
2. **I2** (command `DevVersionBadge.module.css` font-family fix) — independent, no test coupling needed.
3. Verify all three side by side.

## Verification

- `npx tsc --noEmit` in `vendor` and `command` — ✅ machine-verified 2026-07-18, both clean.
- Visual: `npm run dev` in vendor, command, and booker; screenshotted `/ui-gallery` (and, for command's dark mode, the real `/` route) via a headless Playwright script — ✅ done 2026-07-18. Confirmed light-mode parity (solid white glass pill, matching shadow/border/font) and dark-mode parity (dark glass pill) across all three. Note: use `localhost`, not `127.0.0.1`, when testing booker locally on WSL2 — the architecture docs' documented HMR-origin issue reproduced exactly as described (booker's theme effect silently failed to apply on `127.0.0.1`).
- Playwright: `vendor`'s visual suite regenerated with `playwright test --update-snapshots` — ✅ 2026-07-18, **34/34 passed (3.3m)**, then re-run in verify mode (no `--update`) to confirm 0-diff green against the fresh masked baselines. Note: the baseline PNGs (`visual-tests/pilot.spec.ts-snapshots/*-chromium-linux.png`) are **gitignored** (machine-local, regenerated per-machine) — so this regen produces **no tracked file changes**; the only tracked diff from the whole patch is the two source files (`vendor/components/dev/DevVersionBadge.tsx`, `vendor/visual-tests/pilot.spec.ts`). Anyone else pulling this branch must regenerate their own local baselines (expected for this repo's setup).
- Command's existing visual suite should stay green unmodified (I2's `data-testid` mask carried over unchanged) — not re-run in this session; low risk since the mask selector and layout mount are byte-identical to before.
