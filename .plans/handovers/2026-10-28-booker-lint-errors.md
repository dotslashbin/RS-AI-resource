# Handover — booker lint errors (for `2026-10-27-booker-v1-pre-release.md`)

**From:** `.plans/2026-10-28-booker-carousel-compact-autoplay.md`, finding F9 (recorded there, not fixed).
**Measured:** 2026-10-28, `npm run lint` in `booker/` on `release/version-0.29.6` (`4292ac0`) →
**exit 1, 18 problems (14 errors, 4 warnings).** All of them were already there before the carousel work
(same list at `ff7a01b`). The carousel files lint clean.

Paste the item below into the v1 plan as a new numbered item. It's written in the plan-authoring
format, but the number, severity and stage placement are for that plan to decide.

---

### Ix — `npm run lint` fails in booker (14 errors, 4 warnings)  ⬜ TODO

`npm run lint` exits 1, so it can't be used as a release gate until it's clean. Errors by kind:

| Rule | Where (file:line) | Likely fix |
|---|---|---|
| `react-hooks/set-state-in-effect` (7) | `components/auth/LoginPage/useLoginPage.ts:43` · `components/booking/BookingWizard/useBookingWizard.ts:64` · `components/booking/steps/Step3Schedule/useStep3Schedule.ts:103` · `components/layout/AppShell/useAppShell.ts:168`, `:668` · `components/layout/InstallPrompt/useInstallPrompt.ts:37` · `components/settings/SettingsPage/useSettingsPage.ts:32` | Case by case. Use derived state, reset with a `key`, or set state in the event handler instead. ⚠️ These are booking, login and app-shell paths, so this changes behaviour. Each fix needs its own test and a staging check. |
| `@typescript-eslint/no-explicit-any` (3) | `services/booker.service.ts:15`, `:16`, `:19` | Replace with hand-written interfaces (repo convention: no `supabase gen types`). |
| `react/no-unescaped-entities` (2) | `components/layout/InstallPrompt/InstallPrompt.tsx:40` (two `"`) | Use `&ldquo;` / `&rdquo;`. Cosmetic. |
| `@next/next/no-html-link-for-pages` (1) | `app/not-found.tsx:9` | `<a href="/">` → `<Link href="/">`. |
| `react-hooks/static-components` (1) | `app/ui-gallery/page.tsx:1100` (`Body()` declared inside the page at `:409`) | Test-only fixture page. Move `Body` out to module level and pass it `mode`/`dark`. ⚠️ Every visual baseline renders through it, so run `npm run test:visual` afterwards and expect **no** diffs. |

Warnings (non-blocking):
- `app/ui-gallery/page.tsx:283`: `OFFERINGS` unused.
- `components/booking/steps/Step6Confirm/Step6Confirm.tsx:16` and `components/booking/steps/StepPayment/StepPayment.tsx:13`: `quantity` unused.
- `components/layout/AppShell/useAppShell.ts:427`: `useEffect` is missing the `afterLogin` dependency. ⚠️ Adding it could re-run the effect after login, so check it rather than auto-fixing it.

**Done when:** `npm run lint` exits 0 in `booker/`, and `tsc`, `npm test` and `npm run test:visual` are no worse than before. The two known-stale sidebar baselines (carousel plan F10) are excluded from that comparison.

**Re-measure before starting.** Line numbers drift: `cd booker && npm run lint`.
