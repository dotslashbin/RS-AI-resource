# Command + Vendor — Home nav, Command branding parity, Vendor mobile Bookings fix

**Date:** 2026-08-18
**App / scope:** `command/`, `vendor/` only. No backend, no schema, no `ezzy-*-mobile`, no `booker`.
**Status:** COMPLETE (2026-08-18) — all six stages executed; every decision D1–D10
resolved. Every BLOCKER and IMPORTANT item is ✅.
⚠️ Two things are deliberately NOT closed and are not defects of this plan: **B8's
browser-Back behaviour is machine-checked but never exercised in a signed-in session**
(no harness exists for it), and **C5–C8 are open follow-ups**, of which C8 (12
pre-existing payout baseline failures) predates this work.

> Three independent workstreams: (1) a persistent Home affordance in both portals,
> (2) Command adopts Vendor's already-approved Ezzy brand assets, (3) Vendor's
> Bookings row is fixed for phone widths and the same defect class is swept.
> Optimise for: smallest correct change, existing patterns, zero new dependencies.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, C# = Cosmetic/Deferred.
> Numbers are plan-local — qualify cross-plan refs by app (e.g. "command I1").

---

## Shared architectural finding (applies to A and C)

**Neither app uses URL routes.** Both are single-page shells:

- `command/app/page.tsx` → `AppShell` → `page` string state, `useAppShell.ts:170 goPage(p)`
- `vendor/app/page.tsx` → `AppShell` → `page: PageId` state, `goPage(p, intent?)`

There is no `next/link`, no `usePathname`, no nested route segments. "Navigate home"
means calling `goPage("overview")` / `goPage("dashboard")` — not an `<a href>`. Any
plan item that assumed a router would be wrong; this one does not.

Consequence for the Home button: it is a `<button>`, not a link. It gets an
`aria-label`, and `aria-current="page"` when already home.

---

## A. Home / Dashboard navigation

### A-command — current architecture

| Question | Answer |
|---|---|
| Owns persistent nav | `components/layout/AppShell/AppShell.tsx` renders `Sidebar` + `AppHeader` + `TabBar` |
| Dashboard route | `page === "overview"` — `lib/navigation.ts:11` `MAIN_TABS[0]`, icon already `Home` |
| Desktop vs mobile components | **Same components.** `Sidebar` is `fixed -translate-x-full` below `lg`, `lg:sticky` above. `AppHeader` and `TabBar` are identical at every width |
| TabBar visibility | Rendered **unconditionally** on every page (`AppShell.tsx`, no guard) |

**Gap.** Overview *is* nominally always on screen via `TabBar`. But `TabBar.tsx:13`
is `flex overflow-x-auto` holding six tabs (~660px of content). On a 360–430px
viewport, reaching Flags or Payouts scrolls Overview out of view, with no scroll
affordance and no snap-back. The Sidebar entry requires opening the menu, which the
brief explicitly rules out. So the requirement is met only while the strip happens
to be at scroll-left 0.

### B1 — Command: Home button in `AppHeader`  ✅ DONE (2026-08-18)
**Files:** `command/components/layout/AppHeader/AppHeader.tsx:28-33`,
`AppHeader.module.css`, `AppShell.tsx` (pass the handler),
`app/ui-gallery/page.tsx:139` (fixture must pass the new prop).

Add an icon-only `Home` button inside the existing `.left` cluster
(`AppHeader.module.css:1`), between the hamburger (`:29`) and the `<h1>` title
(`:32`). Sticky header ⇒ fixed position on every page, both form factors.

- **Icon:** `Home` from `lucide-react` (`^0.468.0`, already a dependency; already
  imported in `lib/navigation.ts:1`). No new icon library.
- **Styling:** reuse the existing `.iconBtn` rule (`AppHeader.module.css:26`) —
  34×34, `border-radius:10px`, `var(--rs-text)`. It already carries the app's
  light/dark token behaviour and matches the theme and bell buttons on the right.
  No new colours, no inline `style={{}}`.
- **A11y:** `aria-label="Go to overview"`; `aria-current="page"` when
  `page === "overview"`. Native `<button>` ⇒ keyboard and focus ring come free.
- **Prop:** `onNavigateHome: () => void`, wired in `AppShell` to `goPage("overview")`.
- **Component separation:** `AppHeader` is a pure render layer (props + one context
  hook, styles in its module). Adding a prop-driven button adds no state, no effect,
  no logic — it stays a render layer and needs **no** companion hook. Styling goes in
  the existing `.module.css`. ✔ `component-separation` satisfied.

**Duplicate-navigation note:** this becomes Command's *third* Overview affordance
(sidebar, tab strip, header). Justified only because neither existing one is
fixed-position on a phone. See **D1**.

> ✅ **DONE (2026-08-18).** `AppHeader.tsx` gained `onNavigateHome` + the Home
> button reusing the existing `.iconBtn` rule and the `dark:bg-white/5 bg-black/5
> border border-rs-border` idiom its sibling controls already use; `AppShell.tsx`
> wires it to `goPage("overview")`; `ui-gallery`'s `header` mode now renders both
> the away and at-home states.
> **Verified:** `tsc --noEmit` clean; `npm run build` succeeded; eslint on the four
> touched paths 3 warnings before and after (stash-compared); rendered screenshots
> captured in light and dark and inspected. Command has no visual suite (**C2**), so
> there is no baseline to regenerate and none was claimed.
> **Deviation from the plan:** a native `title="Overview"` instead of a Radix
> Tooltip. `@radix-ui/react-tooltip` is a dependency in Command but is used
> **nowhere** in the app — making one button its first consumer adds a
> provider/portal layer for a hint, and the two icon controls beside it have no
> tooltip at all. Vendor legitimately uses Radix because its TopBar already had one
> mounted. Flagged rather than silently absorbed.

### A-vendor — current architecture

| Question | Answer |
|---|---|
| Owns persistent nav | `components/layout/AppShell/AppShell.tsx` renders `Sidebar` + `TopBar` + conditional `TabBar` |
| Dashboard route | `page === "dashboard"` — `TopBar.tsx:8` `TITLES.dashboard`, `TabBar.tsx:16` id `dashboard`, label "Overview", icon `Home` |
| Desktop vs mobile components | **Same components**, same `lg` sidebar swap as Command |
| TabBar visibility | **Conditional** — `AppShell.tsx:31` `MAIN_TAB_PAGES = {dashboard, bookings, offerings, schedule, staff}` |

**Gap — this one is concrete, not marginal.** On `profile`, `transactions`,
`settings` and `calendar` the tab strip is not rendered at all. The *only* route
back to the dashboard is opening the hamburger menu — precisely what the brief
forbids. `TabBar.tsx:9-13` documents why a sixth tab cannot be added (the strip
already overflows 390px at five), so widening the strip is not the answer.

### B2 — Vendor: Home button in `TopBar`  ✅ DONE (2026-08-18)
**Files:** `vendor/components/layout/TopBar/TopBar.tsx:56-61`,
`vendor/components/layout/AppShell/AppShell.tsx` (pass the handler),
`vendor/app/ui-gallery/page.tsx` (add a `topbar` fixture mode — TopBar currently has
**no** gallery coverage at all).

Same placement as B1: icon-only `Home` in the left cluster, between the hamburger
(`:57`) and the `<h1>` (`:60`). Mirrors Command exactly, which is the point.

- **Icon:** `Home` from `lucide-react` (`^0.468.0`, already imported in
  `Sidebar.tsx:5` and `TabBar.tsx:3`).
- **Styling:** the app's established icon-control recipe, copied from the guide
  button at `TopBar.tsx:141` —
  `size-[34px] rounded-[10px] bg-sp-overlay-faint border border-sp-divider flex items-center justify-center text-sp-text cursor-pointer`.
  Tailwind utilities inline via the file's existing idiom; `sp-*` tokens carry
  light/dark. No new CSS. See **D2** for the alternative.
- **A11y:** `aria-label="Go to dashboard"` plus a Radix `Tooltip` reading "Dashboard".
  `Tooltip.Provider`/`Root`/`Content` are already imported and used in this file
  (`:2`, `:117-135`) — copy that shape, do not add a new tooltip mechanism.
  `aria-current="page"` when `page === "dashboard"`.
- **Prop:** `onNavigateHome: () => void` → `goPage("dashboard")`.
- **Component separation:** `TopBar` is a pure render layer (props + `useThemeContext`).
  Prop-driven button, no state, no hook required. ✔

**Duplicate-navigation note:** on the five `MAIN_TAB_PAGES` this duplicates the
"Overview" tab. On the four sidebar-only pages it is the *only* non-menu route home.
Keeping it rendered on all nine (rather than only where TabBar is absent) avoids a
control that appears and disappears, which would shift the title and defeat muscle
memory. See **D3**.

> ✅ **DONE (2026-08-18).** `TopBar.tsx` gained `onNavigateHome`, the Home button
> (icon-control recipe per D2, Radix Tooltip "Dashboard", `aria-label="Go to
> dashboard"`, `aria-current` per D3); `AppShell.tsx` wires it to
> `goPage("dashboard")`; `ui-gallery` gained a `topbar` mode rendering three states.
> **Verified:** `tsc --noEmit` clean; `npm run lint` 35 problems before and after
> (baseline taken by stashing the change and re-running — zero introduced);
> `topbar-light`/`topbar-dark` baselines recorded **and visually inspected**;
> `sidebar`, `dashboard-light`, `bookings-light` re-run → 4 passed, no existing
> baseline disturbed.
> **Deviation:** added `truncate` + a `min-w-0` chain to the title — two new items
> share that row now, so a long title would otherwise push the right-hand controls
> off a narrow screen. Serves the plan's own 320px criterion.

### B7 — Separator between Home and the section title  ✅ DONE (2026-08-18)
**Files:** `command/components/layout/AppHeader/AppHeader.tsx:28-33` (+ its
`.module.css`), `vendor/components/layout/TopBar/TopBar.tsx:56-61`.

Requested 2026-08-18: the Home icon alone does not say *"you are somewhere else and
this takes you back."* A separator between the icon and the section name turns two
unrelated controls into a readable two-level trail:

```
[🏠] ›  Vendor Payouts          ← away from home
[🏠]    Overview                ← at home, no separator
```

- **Rendered only when `page !== HOME`.** At home the trail would read
  `Home › Overview`, which claims a depth that isn't there. Suppressing it is what
  makes the separator *mean* "you are not at home" — the whole point of the request.
  Combined with D3, home state is signalled twice and consistently: no separator,
  and `aria-current="page"` on the button.
- **Decorative, not content:** `aria-hidden="true"`. The button already has its
  accessible name and the title is an `<h1>`; a screen reader announcing
  "greater-than greater-than" between them is noise, not structure.
- **Not a real breadcrumb.** Two levels, one of them always Home, and the section is
  a heading rather than a link. Building a `<nav aria-label="Breadcrumb">` with an
  ordered list here would be markup ceremony around a single chevron — rejected on
  simplicity grounds. If a genuine third level ever appears, revisit.
- **Glyph:** see **D8**. Recommendation is the lucide `ChevronRight` both apps
  already ship, not a text character.
- **Component separation:** render-layer only, in components that are already pure
  render layers. Command's spacing goes in `AppHeader.module.css` alongside `.left`;
  Vendor's stays inline Tailwind per that file's idiom. No state, no hook. ✔

> ✅ **DONE (2026-08-18).** lucide `ChevronRight` size 14 per D8, `aria-hidden`,
> rendered only when `page !== HOME`, in both apps. Vendor uses inline Tailwind
> (`text-sp-text shrink-0`); Command uses new `.trail`/`.sep` rules in
> `AppHeader.module.css` plus `overflow/text-overflow/white-space` on `.title` and
> `flex-shrink:0` on `.iconBtn`/`.menuBtn`.
> **Verified:** present on Transactions/Settings/Vendor Management and absent on
> Dashboard/Overview, confirmed by inspecting rendered screenshots in **both themes
> in both apps** — not inferred from the code.

### B8 — Browser Back steps back through visited pages  ✅ DONE (2026-08-18)
**Files:** `command/components/layout/AppShell/useAppShell.ts:35,170-173,190`,
`vendor/components/layout/AppShell/useAppShell.ts:432-500`.

Requested 2026-08-18. **This is the follow-up a previous plan named and deferred** —
`.plans/2026-08-12-vendor-dashboard-range-and-drilldown.md:715-717`:

> **The back button.** Today, browser Back from any vendor page exits the app —
> there is no history to traverse. This is the one real loss, and D1(c) does not
> recover it.

So this is not a new idea contradicting a settled one; it is the recorded gap being
closed. **But the mechanism must respect why `pushState` was rejected then.** That
plan's D1 (`:504-505`) reads:

> `replaceState` gives no back-button history. A back button that steps through
> every date keystroke would be worse than none.

The objection was to **filter/date changes** creating history, not to page changes.
The constraint that falls out of it is hard:

> ⚠️ **`dashRange` keeps `replaceState`. Only a `page` change may push.** The two
> effects stay separate. Any implementation that turns the existing `:478-492` range
> effect into `pushState` re-creates the exact defect D1 avoided and must be
> rejected in review. Changing the dashboard period five times must still leave the
> history stack one entry deep.

**Semantics — D9(b), step back (resolved 2026-08-18).** Each page navigation pushes
one entry; Back walks them in reverse. `Overview → Vendors → Users`, then Back, lands
on **Vendors**, not home.

> ⚠️ **This supersedes the original framing.** The request was first phrased as "Back
> should bring the user home, like the home icon". Under D9(b) that is no longer
> true and must not be implemented: **Home and Back are now deliberately different
> controls** — Home jumps to the dashboard in one press (and pushes its own entry, so
> Back after it returns you to where you were), while Back retraces. The requirement
> that survives from the original ask is narrower and is the real acceptance test:
> **Back from a nested page must never dump the user out of the app.**

**The two apps start from different places** — verified, not assumed:

| | Command | Vendor |
|---|---|---|
| URL mirror today | **None.** `useAppShell.ts:35` is a bare `useState("overview")` | `?page=&from=&to=&status=` via `replaceState` (`:478-492`) |
| Parser / serialiser | none | `parseAppParams` / `serialiseAppParams` (`lib/dashboardRange.ts:179,218`) |
| Deep links | not supported | supported, seeded on mount (`:457-476`) |

**D10(a) resolved — Command uses URL-less entries.** Note this is now load-bearing in
a way it was not under the old design: with step-back, an entry must carry *which
page* it represents. Command therefore pushes `history.pushState({ page: p }, "")`
with the URL unchanged, and the popstate handler reads `event.state.page`. Vendor
pushes the serialised query string it already knows how to build, and its handler
re-parses the URL — see the per-app notes below.

**Mechanism**

- In `goPage(p, intent?)`:
  - **No-op guard first.** If `p === page` and the intent is unchanged, push nothing.
    Re-tapping the current tab must not stack duplicate entries that make Back appear
    broken.
  - Otherwise `setPage(p)` as today, and push **exactly one** entry.
    - **Command:** `history.pushState({ page: p }, "")` — URL untouched (D10a).
    - **Vendor:** push with the query string `serialiseAppParams` already produces
      for the target, so the entry is correct the moment it is created. Pushing the
      *stale* URL and letting the `[page, dashRange]` effect correct it afterwards
      also ends in the right place, but leaves one frame where the entry disagrees
      with the view — specify the former.
- `popstate` handler → restore the page the popped entry names, clear the sidebar,
  and (Vendor) re-derive `arrival` from the URL through the **same** `parseAppParams`
  path the mount effect uses at `:457`, so arriving-with-a-filter has one code path
  and not two.
  - **Forward works for free.** `popstate` fires in both directions, so Forward
    re-applies the page the same way. This is a genuine improvement over the
    always-home design, which had no meaningful Forward.

**Edge cases — each must be handled, not discovered later:**

1. **Deep-link arrival on a non-home page (Vendor only).** `?page=bookings` seeds
   `page` in the mount effect at `:457`, bypassing `goPage`, so the stack is empty
   and the first Back leaves the site. **Seed one home entry beneath it** on mount
   when the seeded page is not home, so Back goes to the dashboard once and only then
   exits. This synthesises a single, predictable, home-anchored entry rather than
   inventing a navigation trail the user never made — and it is what keeps the
   surviving requirement ("never dumped out") true for deep links.
2. **Logout.** `command/useAppShell.ts:190` calls `setPage("overview")` directly, not
   through `goPage`. History cannot be cleared, so the stack outlives the session:
   the popstate handler must be inert unless signed in (see 4), and logout must not
   push.
3. **Shell-owned modals.** Page-owned modals unmount with their page, but Vendor's
   `GuideModal` and `AccountCompletionModal` are owned by `AppShell` and would stay
   floating over the restored page. Radix intercepts Escape, **not** `popstate`. The
   handler must close them.
4. **Auth branches.** The listener must be inert while `!loggedIn`, `recoveryMode`,
   `pendingKycVendorId`, or `!selectedVendorId`. Supabase's client already runs
   `replaceState` on the recovery hash (`lib/supabase/client.ts:126,173`); pushing
   into that window risks interleaving with it.
5. **Reload mid-stack (Command).** All Command entries share one URL and `event.state`
   does not survive a reload, so refreshing on a nested page returns to Overview.
   Acceptable — Command has no refresh-survival today either. Recorded as **C4**.
6. **From home, Back still exits the app.** Correct and unchanged.

**Accepted cost of D9(b), recorded plainly:** the stack now grows one entry per
navigation, so a user who has visited ten pages needs ten Back presses to leave. That
is how a conventional router behaves and is the trade the option was chosen for; the
always-home alternative bounded it at one. Not a defect — do not "fix" it later
without reopening D9.

**Component separation:** all of this lives in `useAppShell.ts`. It is tightly
coupled to `page`, `goPage`, logout and the modal state, so extracting a
`useNavHistory.ts` would mean threading five values in and out for a single call
site — the abstraction-for-single-use case AGENTS rules out. Render layers are not
touched at all. ✔

**Duplication across apps:** the same ~30 lines land in both `useAppShell.ts` files.
That is correct here — the apps are separate repos with no shared package, and
`.plans/2026-08-12-…:657` already records that "services are copied and adapted per
app, never imported". Do **not** invent a shared module for this.

> ✅ **DONE (2026-08-18).**
>
> **Vendor** (`useAppShell.ts`): `navReady` gate + `navReadyRef`; a base-establish
> effect that synthesises the home entry on deep-link arrival (edge case 1); a
> `popstate` listener that re-reads the URL through `parseAppParams` — the same
> parser the mount seed uses, so arriving-with-a-filter keeps one code path; a
> no-op guard and a `pushState` in `goPage`; `baseEstablishedRef` reset on logout.
> The `[page, dashRange]` URL-mirror effect was left on `replaceState` and its
> comment strengthened to say why merging the two would re-create D1's defect.
>
> **Command** (`useAppShell.ts`): same shape, URL-less per D10a — `pushState({page})`
> and `e.state?.page ?? "overview"` on the way back. No base-establish effect: the
> loaded entry carries no state, which already means "overview", and Command cannot
> deep-link. Adding one would have been speculative.
>
> **Edge case 3 (modals) — handled, but NOT where this plan said.** The plan put it
> in the shell's popstate handler. On reading the code that was the wrong home: the
> guide and completion dialogs own their own open state, and the shell has no
> business reaching into them. Each hook now listens for `popstate` itself
> (`useGuideModal.ts`, `useAccountCompletion.ts`) — single responsibility, and it
> works regardless of what the shell thinks of the navigation.
>
> **Verified (machine):** `tsc --noEmit` clean in both apps; `npm run build` clean
> in both; vendor `npm test` 220/220; vendor lint 35 problems before and after;
> command eslint 3 warnings before and after (both stash-compared); vendor visual
> subset `guide|completionmodal|topbar` 11/11 passed, including the behavioural
> guide-modal semantics test.
>
> **NOT verified — needs a signed-in session.** Every behavioural claim about Back
> itself: stepping, the no-op guard, deep-link seeding, logout inertness, Forward,
> and the D1 range regression check. This was predicted in the Verification section
> and remains true; the state machine was traced on paper against all six edge
> cases, which is reasoning, not evidence. **Do not record B8 as behaviourally
> verified until someone walks the matrix in a browser.**

---

## B. Command branding parity

### Vendor's assets — the approved identity

| Asset | Path | Notes |
|---|---|---|
| Mark (vector source) | `vendor/brand/ezzy-mark.svg` | 3618 B, square "zz" glyph, single-ink brand blue `#034bfc` |
| Lockup (vector source) | `vendor/brand/ezzy-lockup.svg` | 6540 B; zz+smile brand blue, the `e`/`y` are `fill="currentColor"` |
| In-app logo component | `vendor/components/ui/BrandLogo/BrandLogo.tsx` | Inlined SVG, `variant="mark" \| "lockup"`. Deliberately inline, not `<img>` — the lockup's ink follows `currentColor` so light/dark resolves at paint with no theme-read flash |
| Favicon | `vendor/app/favicon.ico` | 1795 B, PNG-in-ICO at 16/32/48 |
| SVG browser icon | `vendor/app/icon.svg` | byte copy of `brand/ezzy-mark.svg` |
| Apple touch icon | `vendor/app/apple-icon.png` | 180×180, **opaque** brand-blue tile (iOS composites transparency onto black) |
| PWA icons | `vendor/public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | mark at 0.62 of canvas; maskable at 0.47 to survive launcher circle-crop |
| Manifest | `vendor/app/manifest.ts` | `theme_color:"#034bfc"`, `background_color:"#eef2ff"`, the three PNGs |
| Generator | `vendor/scripts/generate-brand-assets.mjs` | Regenerates every raster from `brand/*.svg` via Playwright + sharp |

**Treatment rule** (stated in the generator header, lines 15-19): *white mark knocked
out of solid brand blue* — **not** blue-on-white. Matches the shipped mobile icon.

### Command's current assets

| Asset | State |
|---|---|
| `command/app/favicon.ico` | **The Next.js scaffold default.** 25931 B, md5 `c30c7d42707a47a3f4591831641e50dc` — byte-identical to `booker/app/favicon.ico`, mtime 2026-05-03 (scaffold date). Zero Ezzy branding |
| `app/icon.svg` | absent |
| `app/apple-icon.png` | absent |
| `app/manifest.ts` | absent |
| `public/icons/` | absent |
| `public/` contents | only the Next scaffold decorations: `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` |
| `BrandLogo` component | absent |
| Sidebar "logo" | lucide `LayoutDashboard` glyph in a blue-gradient tile — `Sidebar.tsx:26-28` + `Sidebar.module.css:18` `.logoBox` (`linear-gradient(135deg,#2563eb,#4f46e5)`) |
| Login "logo" | lucide `Shield` in the same gradient tile — `LoginPage.tsx:49-50` (desktop panel) and `:97-98` (mobile info panel) |
| Product name | `lib/constants.ts:122` `APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Josh Demo App"` — **out of scope, do not touch** |

### B3 — Command: browser / OS icons  ✅ DONE (2026-08-18)
**Files:** `command/app/favicon.ico` (replace), `command/app/icon.svg` (add),
`command/app/apple-icon.png` (add), `command/brand/ezzy-mark.svg` +
`ezzy-lockup.svg` (add).

Straight byte copies from `vendor/`. Verify with `md5sum` against the vendor
originals, not by eye. The vector sources come along so Command's rasters are not
orphaned binaries.

Next.js file-convention pickup is automatic — `app/icon.svg` and `app/apple-icon.png`
are emitted as fingerprinted `<link>`s with no code change; `app/favicon.ico` is
served at the fixed `/favicon.ico`.

> ✅ **DONE (2026-08-18).** All six copied and **checksum-verified byte-identical to
> vendor's**: `brand/ezzy-mark.svg`, `brand/ezzy-lockup.svg`, `app/icon.svg`,
> `app/apple-icon.png`, `app/favicon.ico`, `components/ui/BrandLogo/BrandLogo.tsx`.
> The replaced favicon was confirmed to be the Next scaffold default first
> (md5 `c30c7d42…`, identical to booker's) and is tracked in git, so the overwrite is
> recoverable.
> **Verified:** `rm -rf .next && npm run build`, then grepped the emitted HTML —
> all three tags present:
> `<link rel="icon" href="/favicon.ico?…" sizes="48x48">`,
> `<link rel="icon" href="/icon.svg?…" type="image/svg+xml">`,
> `<link rel="apple-touch-icon" href="/apple-icon.png?…" sizes="180x180">`.
> **Correction to this plan's cache note:** Next fingerprints **favicon.ico too** in
> the emitted link, not just the other two as written above. The caching caveat still
> holds for the bare `/favicon.ico` the browser requests for the tab icon; the README
> note was corrected to say this accurately rather than overstate it.

### B4 — Command: in-app logo  ✅ DONE (2026-08-18)
**Files:** `command/components/ui/BrandLogo/BrandLogo.tsx` (add, verbatim copy),
`command/components/layout/Sidebar/Sidebar.tsx:26-28`,
`command/components/layout/Sidebar/Sidebar.module.css:18`,
`command/components/auth/LoginPage/LoginPage.tsx:49-50` and `:97-98`.

`BrandLogo` is a pure display component — no state, no effects, no handlers, no
non-trivial styling (the caller passes `className`). It is exactly the exception
`component-separation` names, so **no companion hook and no `.module.css`**. Copying
it verbatim also keeps both apps regenerable from the one vector source. ✔

⚠️ **Blocker on the swap:** Command's `.logoBox` is a *blue gradient* tile.
`BrandLogo variant="mark"` is deliberately **not** `currentColor` (see its header) —
it is fixed brand blue, so dropping it onto a blue gradient makes it disappear.
Vendor avoids this by using a **pale** tile (`Sidebar.tsx:87`
`bg-[#F1F5FF] border-[#dbe4ff] dark:bg-white/[0.06] dark:border-white/10`).
See **D4** — this cannot be executed until it is answered.

> ✅ **DONE (2026-08-18).** `BrandLogo` copied verbatim. **Sidebar** (`Sidebar.tsx`,
> `Sidebar.module.css`): `LayoutDashboard` → `BrandLogo variant="mark"`, tile
> switched to vendor's pale treatment per D4(a); the now-unused `.logoIcon` rule
> removed. **Login** (`LoginPage.tsx` ×3, `LoginPage.module.css`): all three `Shield`
> glyphs → the mark.
>
> **Two decisions taken during execution, both deviations worth reading:**
>
> 1. **Dark-mode tile colours are Tailwind `dark:` utilities on the element, not a
>    `:global(.dark)` rule in the module.** My first attempt used `:global`, then a
>    grep showed it would have been **the only `:global` in Command's entire module
>    CSS** — the app's established idiom is Tailwind `dark:` beside module classes
>    (`AppHeader.tsx`'s icon buttons). Reverted to match the codebase.
> 2. **The login tiles keep their blue gradient with a white-knockout mark**, done
>    with `filter: brightness(0) invert(1)` in `LoginPage.module.css`. The mark is
>    fixed brand blue and deliberately not `currentColor`, and `BrandLogo` must stay
>    byte-identical to vendor's, so it cannot be recoloured by a prop without forking
>    the component. The filter reproduces exactly the treatment vendor's own
>    generator bakes into the rasters ("white mark knocked out of solid brand blue").
>
> **Explicitly NOT done — vendor's login uses the `lockup` (wordmark); Command's does
> not.** Copying that would put the Ezzy wordmark where Command's `APP_NAME` sits,
> which is a **product-naming change** and out of scope by the brief. Only the glyph
> was swapped; every name string is untouched.
>
> **Verified:** `tsc --noEmit` clean; eslint on the touched paths clean; production
> build clean; **rendered screenshots inspected in light and dark for both the
> sidebar and the login page** — this was D4's entire risk (a brand-blue mark
> disappearing into a blue ground) and it is confirmed legible on every tile.

### B5 — Command: full PWA parity  ✅ DONE (2026-08-18)
**Decision D5 = (c) full PWA parity** (resolved 2026-08-18). This is broader than
branding — it adds installability and offline behaviour to Command. Recorded as the
user's call; the plan builds it in full.

Every piece was read in `vendor/` and is portable, but **none of it is a clean copy**:
Command uses `rs-*` design tokens where Vendor uses `sp-*`, and three values are
Vendor-specific.

**B5a — `public/icons/*`** — byte copies of Vendor's `icon-192.png`, `icon-512.png`,
`icon-maskable-512.png`. No edits.

**B5b — `app/manifest.ts`** — port of `vendor/app/manifest.ts`. Same three icon
entries and `theme_color: "#034bfc"` (brand, shared). But `background_color` must be
**Command's own** first gradient stop, not Vendor's — `globals.css:8` gives
`#eef2ff`, which happens to match; assert it rather than inherit it. `name` /
`short_name` / `description` come from `APP_NAME`, so product naming stays untouched.

**B5c — `public/sw.js`** — byte copy. Reviewed and sound for an ops portal:
network-first on navigations (so it *never* serves stale admin HTML), cache-first
only for same-origin static assets, and cross-origin requests (Supabase API and
Realtime) are explicitly skipped. See **I5** for its one real weakness.

**B5d — `public/offline.html`** — port, **not** a copy. Vendor's is stale and
Vendor-specific: the badge is a literal `V` glyph on `#205cfc`, which is the *old*
brand blue that `vendor/app/manifest.ts:14-16` documents as replaced by `#034bfc`.
Command's version must use `#034bfc` and its own glyph. Page background `#eef2ff`
matches Command's light gradient stop. The file is deliberately self-contained (no
external CSS/fonts) — keep that property.

**B5e — service-worker registration** — `vendor/useAppShell.ts:183-189` registers
`/sw.js` in a standalone effect, deliberately outside the auth gate so it also covers
the login screen. Add the identical effect to `command/components/layout/AppShell/useAppShell.ts`.
It belongs in the hook, not the component. ✔

**B5f — `components/layout/InstallPrompt/`** — port of `InstallPrompt.tsx` +
`useInstallPrompt.ts`, mounted in Command's `AppShell`. Required edits:
- **Token remap** (Command has no `sp-*` utilities — `tailwind.config.ts:13-19`
  defines `rs.strong` / `rs.muted` / `rs.border`):
  `sp-card` → `rs-card`, `text-sp-strong` → `text-rs-strong`,
  `text-sp-text` → `text-rs-muted`.
- **localStorage key** — `useInstallPrompt.ts:4` is `"vendor-install-prompt-dismissed"`;
  Command needs its own key or the two portals collide on a shared browser.
- Structure is already correct: `InstallPrompt.tsx` is a render layer, all logic in
  `useInstallPrompt.ts`. Port the split as-is. ✔

**B5g — `app/layout.tsx` metadata** — add `appleWebApp: { capable, title: APP_NAME,
statusBarStyle: "default" }` and a `viewport.themeColor` pair. Use **Command's** page
colours (`globals.css:8` / `:72` → light `#eef2ff`, dark `#04060e`), not Vendor's.

⚠️ **Scope note, stated once.** B5c–B5g are new *functionality* in Command, not
branding. They are also the only items in this plan that change runtime behaviour for
every Command user (a service worker persists until unregistered). B5a/B5b alone would
have delivered installable icons; the rest is the deliberate parity choice.

> ✅ **DONE (2026-08-18).** All seven sub-items shipped.
> **B5a** three icons copied, md5-verified against vendor's. **B5b** `app/manifest.ts`
> — vendor's shape, but `background_color` asserted as Command's own gradient stop
> rather than inherited. **B5c** `public/sw.js` copied + I5 fix. **B5d**
> `public/offline.html` ported with `#034bfc` and the real mark inlined as white-on-blue
> (vendor's still carries a letter on the stale `#205cfc` — see C7). **B5e**
> registration effect in `useAppShell.ts`, outside the auth gate. **B5f**
> `InstallPrompt.tsx` + `useInstallPrompt.ts` + a new `.module.css`. **B5g**
> `appleWebApp` + `viewport.themeColor` in `app/layout.tsx`, using Command's colours.
>
> **Deviation — B5f is not a verbatim port.** Vendor writes InstallPrompt as inline
> Tailwind; every component in Command carries a co-located `.module.css` with only
> token utilities inline (AppHeader, Sidebar, LoginPage). Converted to match **this**
> app's convention, per AGENTS "match existing code style". The `sp-*`→`rs-*` remap
> and a Command-specific `localStorage` key (`command-install-prompt-dismissed`) were
> required regardless — a shared key would have meant dismissing in one portal
> silently dismissed the other for anyone using both in one browser profile.
>
> **Verified (machine + runtime).** `tsc` clean; eslint 3 warnings before and after;
> `rm -rf .next && npm run build` clean, with `/manifest.webmanifest`, `/icon.svg`
> and `/apple-icon.png` all appearing as routes. Emitted `<head>` grepped and
> confirmed: `<link rel="manifest">`, both `theme-color` media pairs (`#eef2ff` /
> `#04060e`), `mobile-web-app-capable`, `apple-mobile-web-app-title`. Manifest body
> read back — correct name, colours and all three icons.
> **Then run against a real production server** (`npm start`, Playwright):
> service worker **registered and active** at scope `/`; `caches.keys()` → exactly
> `["offline-v1"]`; `/offline.html` confirmed precached; **network set offline and a
> navigation genuinely fell back to the offline page** (`h1` = "You're offline"),
> screenshot inspected — mark renders white on brand blue.
> Every static asset served 200: `/sw.js`, `/offline.html`, `/manifest.webmanifest`,
> `/icons/icon-192.png`.
>
> **Not verified:** installing to an iOS home screen (needs a real device), and the
> InstallPrompt's own rendering — it only mounts when the browser actually offers an
> install, which headless Chromium does not. Its token remap was instead checked by
> grep: no `sp-*` classes remain outside a comment, and every `styles.X` reference
> resolves to a defined rule with no orphans in either direction.

### I5 — The ported service worker never evicts its cache  ✅ DONE (2026-08-18)
`vendor/public/sw.js:1` pins `OFFLINE_CACHE = "offline-v1"` and its `activate`
handler (`:9-11`) only calls `clients.claim()` — it never deletes old entries. Next
fingerprints its chunks, so stale code is not *served*; but every deploy's assets
accumulate in the cache forever. Pre-existing in Vendor, and copying it copies the
defect into Command.
**Fix approach:** add a cache-version sweep in `activate` (delete every cache key
that isn't the current `OFFLINE_CACHE`). **D7 resolved (b) on 2026-08-18: applied to
BOTH apps** — Command's new copy and Vendor's existing `public/sw.js`. Vendor's edit
is authorised explicitly and is the only change this plan makes to Vendor outside the
Bookings / responsive work.

> ✅ **DONE (2026-08-18).** `activate` now deletes every cache key that is not the
> current `OFFLINE_CACHE`, then claims. Both files patched and left **byte-identical
> to each other** (md5 `a24d0dd0…`), so the two portals cannot drift.
> **Verified by experiment, not by reading:** seeded a bogus `offline-v0-stale` cache
> in a live browser, forced the worker through install+activate again, and observed
> `caches.keys()` go from `["offline-v1","offline-v0-stale"]` to `["offline-v1"]`.
> Both files also pass `node --check`, and the worker's two safety invariants were
> re-confirmed present after patching by grep: the cross-origin skip
> (`url.origin !== self.location.origin`) and network-first navigation
> (`request.mode === "navigate"`) — so Supabase traffic is still untouched and stale
> portal HTML is still never served.

### I1 — Command's brand assets have no regeneration path  ✅ DONE (2026-08-18)
Command will hold generated binaries with no generator. The vendor script's own
header warns that ad-hoc-produced PNGs "rot immediately". Copying
`generate-brand-assets.mjs` into Command would require `playwright` + `sharp`
devDependencies — an approval gate, for something that runs approximately never.
**Fix approach:** do *not* copy the script. Record in `command/README.md` that the
source of truth is `vendor/brand/*.svg` + `vendor/scripts/generate-brand-assets.mjs`,
and that Command's icons are copies to be refreshed from there.

> ✅ **DONE (2026-08-18).** `command/README.md` gained a **Brand assets** section: the
> vector + generator source of truth, a table of every copied file and its purpose,
> the refresh procedure, a warning that editing `BrandLogo.tsx` locally silently
> forks the brand, and the (corrected) favicon cache caveat. The generator was **not**
> copied — it would need `playwright` + `sharp` devDependencies, an approval gate, to
> regenerate assets that change approximately never.

### Cache / build considerations
- `app/icon.svg` and `app/apple-icon.png` are fingerprinted by Next (`/icon.svg?<hash>`)
  — they bust automatically.
- `app/favicon.ico` is served at a **fixed, unfingerprinted** path. Browsers cache
  favicons very aggressively and Next caches into `.next/`. Verification requires
  `rm -rf command/.next`, then a hard reload / fresh profile / DevTools
  "Disable cache". This is the classic "the favicon didn't change" trap — budget for it.

---

## C. Vendor Bookings mobile bug

> ✅ **Screenshot supplied and diagnosis CONFIRMED (2026-08-18).** The user's capture
> (dark mode, ~360px, live data) matches an independent reproduction rendered from the
> component at the same width: names broken across two lines, `+63 917 555 0102`
> shattered into four, the date split into fragments, status pills colliding with that
> crushed column, and "Something's w…" sliced off at the card edge. The mechanism below
> is what was measured, not what was assumed.

### Root cause

`vendor/components/bookings/BookingRow/BookingRow.tsx:29` opens a single-axis row —
`flex items-center gap-3` — with **no wrap at any breakpoint**, holding three children:

| Line | Child | Classes |
|---|---|---|
| `:30` | avatar | `size-[38px] ... shrink-0` |
| `:33` | identity block | `flex-1 min-w-0` |
| `:43` | action cluster | `flex items-center gap-2 **shrink-0** flex-wrap justify-end` |

**The defect is on `:43`: `flex-wrap` and `shrink-0` cancel each other.** A wrapping
flex container's base size is its *max-content* width; `flex-shrink: 0` forbids
reducing it. The container is therefore never narrowed to a width at which its own
`flex-wrap` could take effect. **The `flex-wrap` on that line is inert** — it can only
fire if something else constrains the width, and nothing does.

The distinction that matters, and that the fix turns on:
- `flex-wrap` on the **parent** + `shrink-0` on the **child** ⇒ the child wraps to
  its own line. Correct.
- `flex-wrap` on the **child** + `shrink-0` on the **same child** ⇒ inert. This bug.

**The arithmetic.** On a 360px phone the row's usable width is
`360 − 40 (AppShell content p-5) − 40 (BookingRow px-5) = 280px`; the avatar and its
gap take 50 of that, leaving 230. For a pending, unpaid booking the cluster holds:
"Not paid" pill + status pill + "auto-confirms in Nd" + Approve + Reject
(plus an `InfoTip` in fulfil/undo/flag states) — roughly **260–420px at max-content**.
It overruns the row before the identity block gets anything.

**Two consequences, in order:**
1. The identity block (`flex-1`, base 0, `min-w-0`) is squeezed toward zero — booker
   name, the email·phone line (`:39`) and the date·time·offering line (`:41`) collapse
   into a few characters per line or a tall ragged stack. This is the "overlapping /
   unreadable" appearance.
2. The row still overflows its container, and the parent at
   `BookingsPage.tsx:78` is `sp-card **overflow-hidden**` — so the excess is
   **clipped, not scrollable**. The Approve / Reject buttons are physically
   **unreachable on a phone**. This is a functional defect, not a cosmetic one.

**Contrast — the codebase already knows the right pattern.**
`TransactionTable.tsx:23-24` wraps its wide table in `overflow-x-auto` with
`min-w-[720px]`. BookingRow simply does not use it.

**Breakpoints affected.** This is *not* a breakpoint bug — `BookingRow` contains **no
responsive variants at all**. It degrades continuously as width falls and is broken
at every width where `max-content(actions) + 50 > available`: all six target widths
(320/360/375/390/412/430) and, for the busiest rows, into tablet.

### B6 — Fix `BookingRow` for phone widths  ✅ DONE (2026-08-18)
**File:** `vendor/components/bookings/BookingRow/BookingRow.tsx` — six edits, one file.

| Line | From | To | Why |
|---|---|---|---|
| `:29` | `flex items-center gap-3` | `flex flex-wrap items-center gap-3` | lets the cluster take its own line |
| `:43` | `flex items-center gap-2 shrink-0 flex-wrap justify-end` | `flex items-center gap-2 flex-wrap w-full sm:w-auto sm:justify-end pl-[50px] sm:pl-0` | **drops `shrink-0`** (the bug); full width below `sm` so the chips wrap internally; `justify-end` becomes desktop-only so stacked chips align left under the text |
| `:39` | `text-sp-text text-[11px] mt-0.5` | `... break-words` | a long unbroken email cannot force overflow |
| `:92` | `mt-2.5 ml-[50px]` | `mt-2.5 ml-0 sm:ml-[50px]` | the 50px indent costs 18% of a 320px screen |
| `:115` | `mt-2.5 ml-[50px]` | `mt-2.5 ml-0 sm:ml-[50px]` | same |
| `:116` | `flex gap-2 items-end` | `flex flex-col sm:flex-row gap-2 sm:items-end` | textarea + button column both usable at 320px |

Notes on the approach:
- **No fixed widths, no magic numbers.** The only literal is `50px`, and it is
  *derived* (38px avatar + 12px `gap-3`) and **already used twice in this file**
  at `:92`/`:115`. The fix reuses it, it does not invent it.
- **`sp-card overflow-hidden` at `BookingsPage.tsx:78` stays.** It exists to clip
  row borders against the card's 18px radius. Once the row wraps, nothing overflows,
  so the clip is harmless. Switching it to `overflow-x-auto` would make a rounded
  card scroll sideways — worse than wrapping.
- **Where the fix belongs:** `BookingRow.tsx` only, a page-specific component.
  `BookingsPage.tsx` needs no change. Not a shared style.
- **Component separation:** `BookingRow` already has its `useBookingRow.ts`. These
  are render-layer class changes only — no state, no logic, no inline `style={{}}`
  added. The file has no `.module.css` and uses inline Tailwind + `clsx`, which is
  this app's established idiom; responsive utility classes match it. ✔

> ✅ **DONE (2026-08-18).** All six edits applied as written. `shrink-0` now appears
> in this file only on the avatar, where it belongs.
>
> **Measured before → after** (rendered component, not reasoning):
>
> | Width | Card overflow before | After | Action buttons outside the card |
> |---|---|---|---|
> | 320px | **643px of content in a 254px box** | none | 0 (was clipped) |
> | 360px | **643 in 294** | none | 0 |
> | 375 / 390 / 412 / 430px | 643 in 324–364 | none | 0 |
> | 768 / 1024px | — | none | 0 |
>
> The page never scrolled sideways at any width, before or after — which is the whole
> point: the excess was **clipped** by the card's `overflow-hidden`, so Approve and
> Reject were unreachable rather than merely cramped.
>
> **One design note worth keeping.** `w-full` below `sm` is what guarantees the wrap.
> Relying on the identity block to push the cluster down would NOT have worked — it is
> `flex-1`, so its flex-basis is 0 and the line always "fits". That is exactly the trap
> I2 fell into in Stage 6, and it was avoided here because of it.
>
> **Verified:** `tsc` clean · lint 35→35 · build clean · unit tests 220/220 · full
> visual suite **120 passed / 12 failed**, the 12 being the pre-existing payout set
> (**C8**) · `bookings-light` and `bookings-dark` pixel baselines **pass unchanged**,
> so desktop is provably untouched · rendered screenshots inspected at 360px in **both
> light and dark**.
>
> **The new tests were proven to have teeth**: with this fix alone reverted, the
> element-clipping test fails on `bookings` with overflows of 55–399px while the other
> four screens still pass. `bookings` was added to both responsive suites.

---

## D. Vendor cross-app responsive audit

Verified by reading each cited line. Screens with no instance are listed so the sweep
is legible as complete rather than as a search that stopped early.

| Area | Same issue? | Root cause shared? | Proposed action |
|---|---|---|---|
| **Bookings** — `BookingRow.tsx:29`/`:43` | **Yes** | — (origin) | **Fix** (B6) |
| **Dashboard** — `PendingApprovalsCard.tsx:27`/`:35` | Yes, milder | Same shape (avatar + `flex-1 min-w-0` + a non-wrapping action group). The group carries no `shrink-0`, so it *squeezes* rather than clips — crowded at ≤360, not unreachable | **Fix** (I2) |
| **Staff** — `StaffStatBar.tsx:17` | Yes | **No** — fixed grid tracks, not flex shrink. Same *symptom* (crushed/overflowing content), different mechanism | **Fix** (I3) |
| **Offerings** — `OfferingCard.tsx:43` | Yes, mild | Same family: non-wrapping horizontal chip group (code + category + booking count), no `flex-wrap`, no `min-w-0` | **Fix** (I4) |
| Transactions — `TransactionTable.tsx:23-24` | No | — | **None.** Already the correct `overflow-x-auto` + `min-w-[720px]` pattern; cite as the reference |
| Transactions — `TransactionsPage.tsx:136`, `:194` | No | — | **None.** `flex-wrap` on the parent without `shrink-0` on children — correct |
| Offerings — `OfferingsPage.tsx:47` | No | — | **None.** `flex-wrap` parent + `shrink-0` child — the *correct* combination; cite as reference |
| Staff — `StaffPage.tsx:33-38` | No | — | **None.** `flex-wrap` + `min-w-[200px]` on the search field |
| Staff — `StaffCard.tsx:53` (`grid-cols-3`) | No | — | **None.** 3 tiles × ~88px at 9-11px type; fits |
| Schedule — `ScheduleCalendar.tsx:42`,`:46` (`grid-cols-7`) | No | — | **None.** A 7-day week is intentionally fixed |
| Calendar — `CalendarPage.tsx:49`,`:53` (`grid-cols-7`) | No | — | **None.** Same |
| Settings — `SettingsPage.tsx:28` | No | — | **None.** Wrapping text block + `shrink-0` toggle — correct |
| Settings — `PayoutDetailsCard.tsx:75` (`grid-cols-3`) | Borderline | Fixed tracks | **None — monitor.** ~88px per option at 320px; labels wrap to two lines but `min-h-[44px]` preserves the touch target. Fixing it is redesign, not this defect |
| Modals (schedule / staff / offering forms) | No | — | **None.** Already hardened to 360px by the Radix-dialog plan (`pilot.spec.ts:224`, D3) |

### I2 — `PendingApprovalsCard` action group crowds at ≤360px  ✅ DONE (2026-08-18)
**File:** `vendor/components/dashboard/PendingApprovalsCard/PendingApprovalsCard.tsx`
- `:27` `sp-sub px-[14px] py-3 mb-2 flex items-center gap-2.5` → add `flex-wrap`
- `:35` `flex gap-[5px]` → `flex gap-[5px] shrink-0 ml-auto`

Deliberately the **opposite** assignment to B6, and for the reason stated in the root
cause: `flex-wrap` on the *parent* plus `shrink-0` on the *child* makes the child wrap
to its own line at full size. Wide layout is unchanged.

> ✅ **DONE (2026-08-18) — but the fix above was INCOMPLETE and had to be corrected.**
> `flex-wrap` + `shrink-0` alone changed nothing: measured at 320px, the identity
> block was still **11px wide holding 33px of content**, before and after. A `flex-1`
> item has a flex-basis of **0**, so with `min-w-0` the line always "fits" and the
> button group simply squeezes it — wrapping never triggers because nothing pushes
> the line over its width.
> The working fix replaces `min-w-0` with **`min-w-[7rem]`**: a real floor forces the
> line over 320px and sends the group to its own row. Also added `break-words` to the
> meta line and `whitespace-nowrap` to the Approve button.
> **Verified:** the new element-clipping test reports the block at 320px before the
> fix and reports nothing after.

### I3 — `StaffStatBar` forces 4 tiles onto a 320px row  ✅ DONE (2026-08-18) — premise corrected
**File:** `vendor/components/staff/StaffStatBar/StaffStatBar.tsx:17`
`grid-cols-4` / `grid-cols-3` with no breakpoint. At 320px the card is ~280px wide;
four tiles are ~61px each, minus `px-4` (32px) leaves ~29px of content for a 10px dot
and the label "Total Clients". It cannot fit.
**Fix approach:** `grid-cols-2 sm:grid-cols-4` (and `grid-cols-2 sm:grid-cols-3`).
Two tiles per row below `sm`, unchanged above.

> ✅ **DONE (2026-08-18) — with the premise corrected. "It cannot fit" was wrong.**
> Tailwind compiles `grid-cols-N` to `repeat(N, minmax(0, 1fr))`, and that explicit
> `0` minimum lets tracks shrink **below** their min-content. So the tiles never
> clipped or overflowed: they silently squeezed, and the element-clipping test reports
> **nothing** for `StaffStatBar` either before or after the change. The audit
> predicted an overflow that does not occur.
> The change still ships — 4 tiles across ~256px gives ~55px each, of which `px-4`
> takes 32, and a label like "Total Clients" wrapping into ~20px of usable width is
> not readable — but it is a **readability improvement, not a defect fix**, and no
> automated check can demonstrate it. Recorded so the plan does not overstate what
> was wrong.
> ⚠️ The real Staff defect at 320px turned out to be **FilterTabs**, not this — see
> **I6**, found only because the first test I wrote failed to detect anything.

### I4 — `OfferingCard` chip group cannot wrap  ✅ DONE (2026-08-18)
**File:** `vendor/components/offerings/OfferingCard/OfferingCard.tsx:43`
`flex items-center gap-2` holds the code pill, the `capitalize` category pill and the
"N bookings" pill, with no `flex-wrap` and no `min-w-0`. A long category squeezes the
pills instead of wrapping them.
**Fix approach:** `flex items-center gap-2 flex-wrap min-w-0`.

> ✅ **DONE (2026-08-18).** Applied, plus `gap-2` on the parent row so the group and
> the status button cannot touch. **Verified:** the chip row measured **263px inside a
> 214px card** at 320px before, and is not reported at all after.
> ⚠️ **A separate overflow in the same file was found and fixed while measuring** —
> see **I7**. The audit had not spotted it.

---

## E. Files affected

### `command`
**Modify**
- `components/layout/AppHeader/AppHeader.tsx` — Home button (B1) + separator (B7)
- `components/layout/AppHeader/AppHeader.module.css` — `.iconBtn` spacing variant if needed (B1), separator spacing (B7)
- `components/layout/AppShell/AppShell.tsx` — pass `onNavigateHome` (B1)
- `components/layout/AppShell/useAppShell.ts:35,170-173,190` — sentinel + popstate + logout reset (B8)
- `app/ui-gallery/page.tsx:139` — fixture passes the new prop (B1)
- `components/layout/Sidebar/Sidebar.tsx:26-28` + `Sidebar.module.css:18` — logo swap (B4, gated on D4)
- `components/auth/LoginPage/LoginPage.tsx:49-50`, `:97-98` — logo swap (B4, gated on D4)
- `README.md` — record the brand-asset source of truth (I1)

**Add / replace**
- `app/favicon.ico` (replace the scaffold default), `app/icon.svg`, `app/apple-icon.png` (B3)
- `brand/ezzy-mark.svg`, `brand/ezzy-lockup.svg` (B3)
- `components/ui/BrandLogo/BrandLogo.tsx` (B4)
- `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (B5a)
- `app/manifest.ts` (B5b)
- `public/sw.js` (B5c, + the I5 eviction fix)
- `public/offline.html` (B5d — ported, brand blue corrected to `#034bfc`)
- `components/layout/InstallPrompt/InstallPrompt.tsx` + `useInstallPrompt.ts`
  (B5f — `sp-*`→`rs-*` token remap, new localStorage key)

**Also modified for B5**
- `components/layout/AppShell/useAppShell.ts` — service-worker registration effect (B5e)
- `components/layout/AppShell/AppShell.tsx` — mount `<InstallPrompt />` (B5f)
- `app/layout.tsx` — `appleWebApp` metadata + `viewport.themeColor` (B5g)

### `vendor`
**Modify**
- `components/layout/TopBar/TopBar.tsx` — Home button (B2) + separator (B7)
- `components/layout/AppShell/AppShell.tsx` — pass `onNavigateHome` (B2)
- `components/layout/AppShell/useAppShell.ts:432-500` — push-vs-replace split, deep-link
  sentinel, popstate, modal close, logout reset (B8). ⚠️ the `dashRange` effect at
  `:478-492` must keep `replaceState`
- `app/ui-gallery/page.tsx` — new `topbar` mode (B2)
- `components/bookings/BookingRow/BookingRow.tsx` — six class edits (B6)
- `components/dashboard/PendingApprovalsCard/PendingApprovalsCard.tsx` (I2)
- `components/staff/StaffStatBar/StaffStatBar.tsx` (I3)
- `components/offerings/OfferingCard/OfferingCard.tsx` (I4)
- `visual-tests/pilot.spec.ts` — new width tests; `modes` array gains `topbar`
- `visual-tests/pilot.spec.ts-snapshots/*` — regenerated baselines (D6)

**Shared responsive styles/components:** none. Every fix is local to its component;
no `globals.css` token or shared primitive changes. That is deliberate — the audit
found no shared class carrying the defect, so a shared fix would be inventing an
abstraction nothing else needs.

---

## DEFERRED / COSMETIC

### C1 — Global content padding is `p-5` at every width
`vendor/AppShell.tsx` uses `flex-1 p-5 overflow-y-auto`, costing 40px of a 320px
screen on every screen. `p-4 sm:p-5` would buy 8px back everywhere.
**Not doing it:** it touches every Vendor screen and invalidates every visual
baseline, for a benefit the B6 fix already delivers on Bookings. Out of proportion to
the ask. Revisit only if a width test still fails after B6.

### C3 — Back does not close an open mobile sidebar first
A common mobile pattern: with the drawer open, Back closes the drawer rather than
navigating. **Not doing it** — it needs its own history entry pushed on drawer open
and popped on close, layered on top of B8's per-page entries, and `goPage` already
closes the sidebar on every navigation so the drawer never survives a Back anyway.
Adding history depth for a drawer is the over-engineering this plan is otherwise
avoiding. Reopen only if testing shows people actually reach for it.

### C4 — Command still has no URL mirror, so a mid-stack reload drops to Overview
Under D10(a) Command's history entries carry no URL, so it cannot deep-link, and
`event.state` does not survive a refresh — reloading on a nested page returns to
Overview and discards the back-stack. Vendor does not have this problem because its
URL already names the page. **Acceptable:** Command has no refresh-survival today
either, so this is not a regression; it is an internal ops portal where shareable
view links matter far less than in Vendor; and porting Vendor's `?page=` mirror
(D10b) remains the documented upgrade path if it starts to bite.

### I6 — `FilterTabs` overflows a 320px phone  ✅ DONE (2026-08-18)
**File:** `vendor/components/ui/FilterTabs/FilterTabs.tsx:29`
**Found during Stage 6, not by the audit.** The four Staff status pills
("All / Active / On Leave / Inactive") need ~272px of min-content against 256px
available at 320px, and the strip had no `flex-wrap` — so it overflowed its
container. This, not `StaffStatBar` (I3), is the actual Staff instance of the defect
class this stage exists to sweep.
**Fixed:** added `flex-wrap`. Bookings' own inline copy of the same bar
(`BookingsPage.tsx:40`) already wrapped, so this brings the shared component in line
rather than inventing a treatment.
**Verified:** reported at 272 > 256 before, absent after; the `grid` and `staff*`
pixel baselines at 900px are unchanged.

### I7 — `OfferingCard`'s delete-confirm row overflows  ✅ DONE (2026-08-18)
**File:** `vendor/components/offerings/OfferingCard/OfferingCard.tsx:137-141`
**Found during Stage 6, not by the audit.** Icon + "Delete this offering?" + Cancel +
Delete need ~236px against 214px inside the card at 320px. Same mechanism as I2: the
prompt is `flex-1` with no minimum, so the buttons crushed the question rather than
moving below it.
**Fixed:** `flex-wrap` on the row and `min-w-[8rem]` on the prompt. A destructive
confirmation is the last place to let the question become unreadable.
**Verified:** reported at 236 > 214 before, absent after.

### C8 — 12 payout visual baselines fail, pre-existing  ⬜ TODO
`payoutform-*` and `payoutsaved-*` (light and dark) each differ by **12 pixels**
against their baselines. **Not caused by this plan** — confirmed by stashing every
change in this stage and re-running, which reproduces the identical 12-pixel diff.
Cause not investigated; the 12-pixel signature resembles the date-drift class the
spec header already documents twice.
**Impact:** the vendor visual suite cannot be a clean gate until these are triaged or
re-baselined. Out of scope here; recorded so a later "the suite is red" is not
mistaken for this plan's doing.

### C7 — Vendor's `offline.html` still uses the old brand blue  ⬜ TODO
**File:** `vendor/public/offline.html`
Its badge is the letter `V` on `#205cfc` — the **previous** brand blue that
`vendor/app/manifest.ts:14-16` documents as replaced by `#034bfc`. Command's ported
copy was corrected to `#034bfc` with the real mark inlined; vendor's was **not
touched**, because D7 authorised only the `sw.js` fix in vendor and this is a
different file.
**Fix approach:** copy Command's `public/offline.html` back over vendor's, swapping
nothing else. Needs its own go-ahead since it is a vendor visual change outside this
plan's vendor scope.

### C5 — After logout, the address bar keeps the last page (vendor)  ⬜ TODO
Found while implementing B8 (2026-08-18). `popstate` navigates the URL *before* the
handler runs, and the handler is deliberately inert when signed out — so pressing
Back on the login screen changes the address bar without changing what is rendered.
The next sign-in lands on the dashboard with a stale `?page=` still showing, because
the mount seed is mount-only and the URL-mirror effect does not fire when `page` did
not change.
**Cosmetic:** nothing renders wrongly and nothing is exposed — the query string is a
reflection, never a source of truth after mount. Fixing it means writing the URL on
logout, which is more moving parts than the symptom is worth. Recorded so it is a
known limitation rather than a surprise.

### C6 — `useSidebar` returns unstable callbacks (command)  ⬜ TODO
**File:** `command/components/layout/Sidebar/useSidebar.ts:5-11`
Every render rebuilds the returned object *and* its `toggle`/`close` arrows, so any
consumer depending on them re-runs. Caught by `react-hooks/exhaustive-deps` when B8's
listener referenced `sidebar.close` — my first comment claimed the callback was
stable, which was **wrong**. Worked around in `useAppShell` by capturing the raw
`setOpen` (React's setState, genuinely stable) instead.
**Not fixed here:** wrapping them in `useCallback` is a one-line change but touches a
shared hook with other consumers, which is outside this plan's scope. One-line fix
for whoever is next in that file.

### C2 — Command has no visual-regression suite
`command/playwright.config.ts` points at `./visual-tests`, which **does not exist**.
Command's harness is configured but empty. Not created by this plan — flagged so
"run the visual suite" is not offered as Command verification when it cannot run.
Related to the lint/test rot already recorded in `notes.txt` (items #3, #4).

---

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains. -->

- **D1 — Command Home button: add it, or rely on the existing TabBar?** →
  **(a) Add it** (resolved 2026-08-18) — parity with Vendor and a guaranteed
  fixed position, accepting that it becomes Command's third Overview affordance.

- **D2 — Vendor Home button treatment.** → **(a) the icon-control recipe**
  (`bg-sp-overlay-faint` + `border-sp-divider`, as used by the guide/theme/bell
  buttons) (taken 2026-08-18 on the stated recommendation, not separately asked) —
  it reads as an action and inherits the right-hand cluster's hover and dark
  behaviour. Flag if you want the plain hamburger treatment instead.

- **D3 — Behaviour when already home.** → **(a) stay rendered with
  `aria-current="page"`** (taken 2026-08-18 on the stated recommendation, not
  separately asked) — a control that appears and disappears shifts the title and
  defeats muscle memory.

- **D4 — Command's logo tile (blocked B4).** → **(a) Vendor's pale tile**
  (resolved 2026-08-18) — Command's sidebar `.logoBox` adopts
  `bg-[#F1F5FF] border-[#dbe4ff] dark:bg-white/[0.06] dark:border-white/10`; the
  login panel's dark hero keeps a white-knockout mark. True parity, which is the ask.

- **D5 — Does Command get a web manifest / PWA icons?** → **(c) full PWA parity**
  (resolved 2026-08-18) — `manifest.ts`, `public/icons/*`, `sw.js`, `offline.html`,
  `InstallPrompt`, SW registration and the `appleWebApp`/`themeColor` metadata.
  Recorded against the recommendation of (a): B5c–B5g are new functionality rather
  than branding, and a service worker persists on every Command user's browser until
  unregistered. Proceeding as chosen; see B5 for the port's required edits.

- **D6 — Vendor visual baselines.** → **(a) regenerate per stage**
  (resolved 2026-08-18) — every diff stays attributable to one change.

- **D8 — Which separator glyph (B7)?** → **(a) lucide `ChevronRight`**
  (resolved 2026-08-18) — size 14, `text-sp-text` / `var(--rs-text)`. Both apps
  already ship lucide and use its chevrons (`ChevronUp` in both sidebars), so it
  inherits colour and scale like every other icon in the bar and needs no font
  fallback. Rendered only when away from home, `aria-hidden`.

- **D9 — What should Back do from a nested page (B8)?** → **(b) step back through
  visited pages** (resolved 2026-08-18) — the conventional behaviour: one history
  entry per navigation, Back retraces them.

  ⚠️ **This changes the feature, not just its implementation.** The request began as
  "Back should bring the user home, like the home icon"; under (b) Home and Back are
  **deliberately different controls**. The requirement that survives is *Back from a
  nested page must never dump the user out of the app* — that, not "Back goes home",
  is B8's acceptance test.

  Accepted cost: the stack grows one entry per navigation, so leaving the app after
  ten pages takes ten presses. (a) bounded that at one entry; (b) was chosen anyway
  because it matches what a browser Back button is expected to do.

- **D10 — How does Command get history state (B8)?** → **(a) URL-less entries**
  (resolved 2026-08-18) — `pushState({ page }, "")` with the URL unchanged. Smallest
  change, and it does not commit Command to a URL contract it has never had.
  Two consequences now that D9(b) is in force: the pushed `state` object must carry
  the page (it is the only record of which entry is which), and a reload mid-stack
  drops back to Overview because `event.state` does not survive it — recorded as
  **C4**. Vendor keeps its existing mirror; B8 changes only *when* Vendor pushes
  versus replaces, never what it writes.

- **D7 — Does the `sw.js` cache-eviction fix (I5) also land in Vendor?** →
  **(b) fix both** (resolved 2026-08-18) — "yes, fix it in vendor if applicable."
  **It is applicable:** `vendor/public/sw.js:1,9-11` pins `OFFLINE_CACHE = "offline-v1"`
  and its `activate` handler calls only `clients.claim()`, so no cache key is ever
  deleted. Confirmed by reading the file, not assumed from the plan.
  Scope note: this is the one edit to Vendor that is **not** part of the Bookings /
  responsive work — it is authorised here explicitly and is recorded on I5.

- **BLOCKING INPUT — the Bookings screenshot.** Section C is a code-derived diagnosis.
  It must be checked against the image before B6 executes. Stages 1 and 2 are
  unaffected and can proceed without it.

---

## Execution order

Independent, safe to start once decisions land — no coupling between the three streams.

| # | Stage | Items | Apps | State |
|---|---|---|---|---|
| 1 | Home navigation + separator | B2 → B1 → B7 | vendor, command | ✅ done 2026-08-18 |
| 2 | Back steps back through pages | B8 | vendor, command | ✅ done 2026-08-18 — **behaviour not exercised in a live session** |
| 3 | Command branding assets | B3 → B4 → I1 | command | ✅ done 2026-08-18 |
| 4 | Command PWA | B5a–B5g, I5 | command, vendor (`sw.js` only, per D7) | ✅ done 2026-08-18 |
| 5 | Bookings mobile fix | B6 | vendor | ✅ done 2026-08-18 — screenshot supplied and diagnosis confirmed |
| 6 | Responsive sweep | I2 → I3 → I4, **+I6, +I7 found during execution** | vendor | ✅ done 2026-08-18 |

1. **Stage 1 — Home navigation + separator.** B2 first (Vendor's is the real gap),
   then B1, then B7 across both. B7 rides along because it edits the same two files
   the Home button does — splitting it would mean touching `AppHeader.tsx` and
   `TopBar.tsx` twice. Add the Vendor `topbar` gallery mode here.
2. **Stage 2 — Back button.** B8 alone, deliberately isolated: it is the only item in
   this plan that touches shell navigation state and browser history, it carries six
   named edge cases, and its blast radius is every page in both apps. Keeping it out
   of Stage 1 means a regression here is unambiguously attributable. It is also the
   one stage with **no automated coverage available** (see Verification), which is a
   second reason not to bundle it with anything else.
3. **Stage 3 — Command branding assets.** B3 → B4 → I1. Pure file copies plus two
   logo swaps; reversible.
4. **Stage 4 — Command PWA.** Split from Stage 3 on purpose: Stage 3 is reversible
   asset swapping, Stage 4 changes runtime behaviour and registers a service worker
   that persists in users' browsers until unregistered.
5. **Stage 5 — Bookings fix.** B6 alone, verified at all six widths before anything
   else moves.
6. **Stage 6 — Responsive sweep.** I2 → I3 → I4, each with its own baseline regen
   (D6) so every diff is attributable to one change.

**Dependencies:** Stage 2 should follow Stage 1 — both edit the nav surface, and
testing "Back goes home" is clearer once "Home goes home" is in and verified. Stage 4
depends on Stage 3 (the icons its manifest references). Stages 1+2, 3+4, 5 and 6 are
three mutually independent tracks.

Cadence is one stage at a time per `developerboss`, unless a range is requested.

---

## F. Verification / testing plan

**Machine-verifiable**
- `npx tsc --noEmit` in each app after every stage. New props on `AppHeader`/`TopBar`
  make the `ui-gallery` fixtures fail to compile until updated — that is the type
  system catching the fixture, and it is wanted.
- `npm --prefix vendor run lint` (Vendor is the one app with a working lint gate).
- `npm --prefix command run build` / `npm --prefix vendor run build`.
- `md5sum` every copied brand asset against its Vendor original (B3).
- Vendor visual suite: `npx playwright test` from `vendor/`. Expect
  `bookings-*`/`dashboard-*`/`staffpage-*`/`offerings-*` to fail until re-baselined —
  review each diff before accepting.
- New Playwright tests, following the existing convention at `pilot.spec.ts:224`
  ("D3 — it fits a 360px phone"), which already asserts
  `documentElement.scrollWidth > clientWidth` is false:
  - `bookings` at 320/360/375/390/412/430 — no horizontal document overflow; the
    Approve and Reject buttons are `toBeInViewport()` and hit-testable, which is the
    assertion that actually encodes the `overflow-hidden` clipping bug.
  - Home button reachable by accessible name from a sidebar-only Vendor page
    (`/ui-gallery?mode=topbar`), and `aria-current` correct on the dashboard.
- Command has **no** visual suite (C2) — do not claim one was run.

**Home button + separator (B1/B2/B7) — manual matrix**
- Command desktop (≥1024) and mobile (390); Vendor desktop and mobile.
- From every nested/sidebar-only surface: Vendor `profile`, `transactions`,
  `settings`, `calendar` (the four with no tab strip); Command `flags`, `payouts`,
  `settings` with the tab strip scrolled right.
- Click lands on the dashboard/overview and closes the mobile sidebar.
- Keyboard: reachable by Tab in DOM order, visible focus ring, Enter/Space activate,
  screen reader announces the label; `aria-current="page"` when already home.
- Separator present on every non-home page and **absent at home**, in both apps and
  both themes; it does not push the title into the right-hand control cluster at
  320px with the longest title ("Notification Settings" / "Schedule Maker").
- Screen reader does **not** announce the separator (`aria-hidden`).

**Back button (B8) — mostly needs a live session**
- ⚠️ **The `/ui-gallery` fixture cannot cover this.** The gallery mounts components
  directly, never `AppShell`, so there is no `page` state, no `goPage` and no
  history sentinel. Automated coverage would need a signed-in session, which no
  existing suite in either app has. Treat B8 as **live-verified only** unless a
  session harness is built — and do not report it as machine-verified.
- **The acceptance test (D9b):** from any nested page, Back must not exit the app.
  Everything below is detail underneath that one requirement.
- Overview → Vendors → Users, Back → **Vendors**, Back → **Overview**, Back → exits.
  Each press moves exactly one step; none is a no-op.
- Home button from a nested page → dashboard in one press, and Back after it returns
  to the page you left. Home and Back are **not** equivalent under D9(b) — verify
  they differ, rather than verifying they match.
- **Re-tapping the current tab pushes nothing** (no-op guard). Tap Bookings five
  times while on Bookings, then Back once — it must leave Bookings, not absorb four
  dead presses.
- **Vendor, the D1 regression check:** changing the dashboard date range creates
  **no** history entries. Change the range five times, press Back once, and land on
  the previous *page* — not on a previous range.
- **Vendor deep link** `?page=bookings` in a fresh tab → Back goes to the dashboard
  once, then exits (edge case 1).
- Forward after a Back re-applies the page, and the URL matches the rendered page in
  both directions (Vendor) / the rendered page matches `event.state` (Command).
- Vendor with `GuideModal` or `AccountCompletionModal` open → Back closes it rather
  than leaving it floating over the restored page (edge case 3).
- Log out, then Back — the handler is inert and no stale page is replayed (edge
  case 2 + 4).
- Password-recovery link and the KYC-pending / vendor-select screens: Back behaves as
  it does today; nothing is pushed (edge case 4).
- **Command, reload mid-stack:** refresh on a nested page returns to Overview. This
  is expected under D10(a), not a bug — confirm it is the behaviour, and that the app
  does not land in an inconsistent state (edge case 5 / C4).
- From home, Back still exits the app (edge case 6).

**Command branding — manual**
- Favicon in the browser tab after `rm -rf command/.next` + hard reload; a fresh
  profile is the reliable check.
- Header/sidebar logo and the login-screen logo, light and dark. Specifically confirm
  the brand-blue mark is legible on the new pale tile in **both** themes (D4's whole
  risk) and white-on-dark on the login hero.
- `npm --prefix command run build` and confirm the emitted `<link rel="icon">` /
  `apple-touch-icon` tags in the served HTML.
- Apple touch icon — requires an actual iOS add-to-home-screen.

**Command PWA (B5) — manual**
- `/manifest.webmanifest` serves, and Chrome DevTools → Application → Manifest shows
  all three icons resolving, including the maskable one in its preview.
- Application → Service Workers shows `/sw.js` activated, and it registers on the
  **login screen** too (not just once signed in) — the reason B5e sits outside the
  auth gate.
- Offline check: DevTools → Network → Offline, then reload → `offline.html` renders,
  and it uses `#034bfc`, not the stale `#205cfc` (B5d).
- ⚠️ Confirm a navigation while online is **never** served from cache — the SW is
  network-first for `mode === "navigate"`, and stale admin HTML would be the one
  serious failure of putting a service worker on an ops portal.
- Cross-origin untouched: Supabase API/Realtime calls still show as network requests,
  not SW-intercepted.
- I5: after a rebuild, Application → Cache Storage holds only the current cache key.
- InstallPrompt: appears on Android Chrome and iOS Safari, dismiss persists across
  reload, and its own key does **not** collide with Vendor's when both portals are
  open in the same browser profile.
- Light and dark for the InstallPrompt card after the `sp-*`→`rs-*` remap — a missed
  token shows as invisible or unstyled text, not as a crash.
- **Uninstall path:** if the PWA work is ever reverted, an already-registered service
  worker keeps running in users' browsers. Note it now; do not discover it later.

**Vendor responsive — manual**
- Widths 320 / 360 / 375 / 390 / 412 / 430, plus tablet 768 & 1024, plus desktop
  1280+ (must be visually unchanged).
- Light and dark on every changed surface.
- Long-value cases the fixtures may not carry: long booker names, long unbroken
  emails, long offering names, the longest status label, and a pending + unpaid +
  auto-confirming row (the worst case for the action cluster).
- Empty and populated Bookings; filters open and closed; the reject/flag textarea
  expansion and the unpaid confirmation, both at 320px.
- Touch targets on the wrapped action chips remain ≥44px in the tappable dimension.

**Explicitly not verified by this plan**
- Any runtime behaviour behind auth — the `/ui-gallery` fixture is the only surface
  the suites can reach without a session.
