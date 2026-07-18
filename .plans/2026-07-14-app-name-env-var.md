# App name → environment variable (de-hardcode "Bookdeck")

**Date:** 2026-07-14
**App / scope:** `booker`, `command`, `vendor` (Next apps) + `backbone` (seed data). Cross-cutting — touches all four.
**Status:** DRAFT — investigation complete, decisions locked; **awaiting approval to execute. No code changed.**

> **Goal:** "Bookdeck" was a placeholder brand hardcoded across the apps. Replace
> the user-facing **app name** (and, per decisions below, the login **domain
> hints** and the app **`<title>` metadata**) with values read from environment
> variables, with a safe in-code fallback. Separately, rebrand stray
> `@bookdeck.com` **mock/seed** emails to a neutral domain (cosmetic, not
> env-driven). No behaviour change; no look-and-feel change beyond the approved
> text swaps.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** items are grouped by app (BK = booker, CM = command,
> VN = vendor, BB = backbone, EN = env/setup); numbers are plan-local.

---

## Decisions (locked 2026-07-14)

- **D1 — Domain hints → separate env var.** `app.bookdeck.com` /
  `command.bookdeck.com` / `vendor.bookdeck.com` become a second per-app var
  `NEXT_PUBLIC_APP_DOMAIN`, independent of the app name.
- **D2 — Metadata titles → unify via env var.** The inconsistent `<title>`s
  ("RS Booker", "RS Command", "Vendor Portal" — none of which even say
  "Bookdeck") are rewritten to derive from `NEXT_PUBLIC_APP_NAME`.
- **D3 — Mock/example emails → rebrand the domain.** `@bookdeck.com` in
  ui-gallery fixtures, form placeholders, and `backbone/seed.sql` is swapped to
  the reserved example domain **`@example.com`** (RFC 2606). Still hardcoded —
  these are dev fixtures, not the shipped brand, so they are *not* env-driven.

### Mechanism (settled — no re-decision)

- Two **`NEXT_PUBLIC_`** vars per app (client-readable, inlined at build):
  - `NEXT_PUBLIC_APP_NAME` — base brand. **Fallback `"Bookdeck"`.**
  - `NEXT_PUBLIC_APP_DOMAIN` — login domain hint. **Fallback = each app's
    current value** (booker `app.bookdeck.com`, command `command.bookdeck.com`,
    vendor `vendor.bookdeck.com`).
- **Home:** each app's existing `lib/constants.ts` (already the convention;
  already imported widely). Add:
  ```ts
  export const APP_NAME   = process.env.NEXT_PUBLIC_APP_NAME   ?? "Bookdeck"
  export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "<app default>"
  ```
  This mirrors the existing precedent `booker/app/api/payment/create-session/route.ts:46`
  (`process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"`).
- **No shared code** between apps (repo invariant) — each app gets its own copy
  of the two constants. No new dependency.
- **Fallbacks make the vars optional** — unset env → renders exactly today's
  strings, so nothing breaks at deploy time and the pixel baselines below hold.

---

## Findings & changes by app

All `file:line` verified by `grep` on 2026-07-14. Every visible-brand literal
becomes `{APP_NAME}` (same rendered text under the fallback → pixel-identical);
domain hints become `{APP_DOMAIN}`; `@bookdeck.com` mock emails become
`@example.com` (rendered text changes → see Couplings).

### booker (no visual suite — verified by `tsc` + manual)

- **BK1 — brand literals → `{APP_NAME}`** ⬜
  - `components/auth/LoginPage/LoginPage.tsx:43` brand `<p>Bookdeck</p>`
  - `components/auth/LoginPage/LoginPage.tsx:107` mobile brand `<p>Bookdeck</p>`
  - `components/auth/LoginPage/LoginPage.tsx:171` `New to Bookdeck?` → `New to {APP_NAME}?`
  - `app/not-found.tsx:11` `Back to Bookdeck` → `Back to {APP_NAME}`
  - `components/dashboard/GuidePanel/GuidePanel.tsx:26` `Your quick guide to Bookdeck` → `…to {APP_NAME}`
  - `app/api/payment/create-session/route.ts:44` `"Bookdeck booking"` → `` `${APP_NAME} booking` `` (server-side; import from constants)
- **BK2 — domain hint → `{APP_DOMAIN}`** ⬜
  - `components/auth/LoginPage/LoginPage.tsx:148` `app.bookdeck.com` → `{APP_DOMAIN}` (fallback `app.bookdeck.com`)
- **BK3 — metadata title (D2)** ⬜
  - `app/layout.tsx:8` `"RS Booker — Offering Booking Portal"` → `` `${APP_NAME} — Booking Portal` `` (drops stale "RS"); description line 9 left as-is (no brand)
- **BK4 — CSS comment (cosmetic)** ⬜
  - `app/globals.css:46,115` `/* ── Bookdeck design tokens ── */` → `/* ── App design tokens ── */` (comment only; optional)

### command (has visual suite — brand swaps verified pixel-identical; email/placeholder swaps need re-baseline)

- **CM1 — brand literals → `{APP_NAME}`** ⬜
  - `components/layout/Sidebar/Sidebar.tsx:29` `<p className={styles.brandName}>Bookdeck</p>`
  - `components/auth/LoginPage/LoginPage.tsx:52` brand
  - `components/auth/LoginPage/LoginPage.tsx:68` `Bookdeck Command is the internal…` → `{APP_NAME} Command is the internal…`
  - `components/auth/LoginPage/LoginPage.tsx:101` mobile brand
- **CM2 — domain hint → `{APP_DOMAIN}`** ⬜
  - `components/auth/LoginPage/LoginPage.tsx:135` `command.bookdeck.com` → `{APP_DOMAIN}` (fallback `command.bookdeck.com`)
- **CM3 — metadata title (D2)** ⬜
  - `app/layout.tsx:6` `"RS Command"` → `` `${APP_NAME} Command` ``; `:7` description `"RS Command portal"` → `` `${APP_NAME} Command portal` ``
- **CM4 — mock/placeholder emails → `@example.com` (D3)** ⬜ *(rendered text changes → re-baseline, see Couplings)*
  - `components/auth/LoginPage/LoginPage.tsx:140,172` input placeholders `admin@bookdeck.com`
  - `components/users/UserModal/UserModal.tsx:98` placeholder `e.g. juan@bookdeck.com`
  - `app/ui-gallery/page.tsx:59-61` fixture users `juan@ / maria@ / pedro@bookdeck.com` *(dev-only fixture)*

### vendor (has visual suite — brand swaps verified pixel-identical; email/domain swaps need re-baseline)

- **VN1 — brand literals → `{APP_NAME}`** ⬜
  - `components/auth/LoginPage/LoginPage.tsx:67` brand
  - `components/auth/LoginPage/LoginPage.tsx:74,129` `Sell on Bookdeck` → `Sell on {APP_NAME}`
  - `components/auth/LoginPage/LoginPage.tsx:83` `Join Bookdeck — manage…` → `Join {APP_NAME} — manage…`
  - `components/auth/LoginPage/LoginPage.tsx:123` mobile brand
- **VN2 — domain hint → `{APP_DOMAIN}`** ⬜
  - `components/auth/LoginPage/LoginPage.tsx:163` `vendor.bookdeck.com` → `{APP_DOMAIN}` (fallback `vendor.bookdeck.com`)
- **VN3 — metadata title (D2)** ⬜
  - `app/layout.tsx:8` `"Vendor Portal"` → `` `${APP_NAME} Vendor` ``; `:9` description `"Vendor management portal"` → `` `${APP_NAME} vendor management portal` ``
- **VN4 — mock email → `@example.com` (D3)** ⬜ *(rendered in Sidebar → re-baseline, see Couplings)*
  - `app/ui-gallery/page.tsx:92` `userEmail="admin@bookdeck.com"` *(dev-only fixture)*

### backbone (seed data — cosmetic domain rebrand, D3)

- **BB1 — seed email domain `@bookdeck.com` → `@example.com`** ⬜
  - `supabase/seed.sql` — **all 30 email occurrences** (of the 31 total `bookdeck` refs; the 31st is the password in BB2): the credential comment block (`:7-19`, 13), the `auth.users` INSERT emails (`:54, 121-176`, 13), and the notification `jsonb` payloads (`:738-739, 755-756`, 4).
  - **Safe to edit:** `seed.sql` is *not* a migration (migrations are immutable; seed is re-run on `supabase db reset`). No migration file is touched.
  - **Runtime effect:** dev login accounts change (e.g. `root@bookdeck.com` → `root@example.com`); takes effect only after a `supabase db reset`. Update any docs listing seed logins (see Out of scope).
- **BB2 — seed root password `Bookdeck@root1` (`seed.sql:55`)** — contains the brand but is a dev password, not an email. **OPEN sub-decision** — recommend **leave** (changing it changes the documented dev login for no cleanup benefit). If the user wants full de-branding, change to a neutral dev password and note it.

---

## Env var setup

- **EN1 — declare the two vars in each app's `lib/constants.ts`** ⬜ (per Mechanism above; BK/CM/VN each get their own with the right `APP_DOMAIN` fallback).
- **EN2 — document the vars in example env files** ⬜
  - `vendor/.env.local.example` — append `NEXT_PUBLIC_APP_NAME` + `NEXT_PUBLIC_APP_DOMAIN`.
  - `booker/` and `command/` — **no `.env.local.example` exists today** (only gitignored `.env.local`). Create one for each documenting all currently-used public vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_DOMAIN`, and — booker — `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_APP_VERSION`).
- **EN3 — deployment note (not a code change)** ⬜ — set `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_APP_DOMAIN` in each app's Vercel project when the real brand is chosen. Until then the fallbacks keep today's strings.

---

## Couplings (must move together)

- **Pixel baselines (command + vendor):** the **brand-literal** swaps (CM1, VN1)
  keep identical rendered text (fallback = "Bookdeck") → the existing visual
  suites must stay **green with no baseline change** — that is the proof of
  no-regression. But the **email/placeholder/domain** swaps that change rendered
  text — CM2 (if fallback kept, no change), **CM4** (login placeholders + any
  rendered fixture), **VN4** (Sidebar email) — **change pixels** and require
  `--update-snapshots` for the affected modes in the same batch. Domain-hint
  swaps (CM2/VN2/BK2) keep their fallback = current value → pixel-identical.
  - *Sequencing to keep the proof clean:* run each app's suite **before** any
    text-changing edit to confirm baseline, apply CM1/VN1 (name-only) and re-run
    → expect **0 diff**; then apply CM4/VN4 and **re-baseline only those modes**,
    eyeballing the diff to confirm only the email/domain text moved.
- **backbone seed vs docs:** BB1 changes seed logins → any doc/README listing
  them must update in the same batch (see Out of scope for where they live).

---

## Execution order

1. **EN1** (constants) per app — prerequisite for all literal swaps.
2. **Name-only swaps** BK1/BK3, CM1/CM3, VN1/VN3 + domain hints BK2/CM2/VN2
   (all pixel-identical under fallbacks). Run `tsc` per app; run command+vendor
   visual suites → expect **0 diff**.
3. **Email/domain rebrand** CM4, VN4 (D3) — apply, then `--update-snapshots` for
   the affected modes only; inspect diffs.
4. **backbone** BB1 (+ BB2 once decided) — edit `seed.sql`; `supabase db reset`
   in `./backbone`; smoke-test one login with the new `@example.com` address.
5. **EN2** example env files; **EN3** deployment note.
6. **BK4** CSS comment (trivial, any time).

---

## Verification

| Item | Check | Kind |
|------|-------|------|
| BK1–BK3, CM1–CM3, VN1–VN3, EN1 | `tsc --noEmit` passes in each app | machine |
| CM1/VN1 (name-only) | command + vendor visual suites, **0-pixel diff** | machine (Playwright) |
| CM4/VN4 (email rebrand) | suites pass after targeted `--update-snapshots`; diff shows *only* the email/domain text | machine + review |
| BK1–BK4 (booker) | manual render of login, not-found, dashboard guide, payment flow | needs live env |
| BB1 | `supabase db reset` succeeds; login with a new `@example.com` seed account works | needs live env |
| All | `grep -rin bookdeck` in each app returns only intended leftovers (fallback string in constants, CSS token comment if kept) | machine |

---

## Out of scope / deferred

- **`backbone/seed.sql` passwords** other than BB2 (`DevSeed@passN`) — no brand, untouched.
- **Documentation** referencing the brand or seed logins (`architecture/`, root
  `*.md`, `AGENTS.md`, this repo's plans) — not code; update opportunistically,
  not part of this plan unless the user asks. *(Confirm whether any doc lists the
  seed credentials before BB1 ships — grep `architecture/` + `*.md` for `bookdeck.com`.)*
- **`package.json` `name` fields** — checked; none contain "bookdeck".
- **App-directory / repo folder names** (`booker`, `command`, `vendor`) — not the brand; untouched.
- **Real production domain** — `NEXT_PUBLIC_APP_DOMAIN` fallback keeps the
  `*.bookdeck.com` placeholders; setting the true domain is an env/Vercel task (EN3).
