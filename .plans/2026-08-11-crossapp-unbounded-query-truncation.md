# Cross-App — Unbounded Query Truncation (booker + command)

**Date:** 2026-08-11
**App / scope:** `booker/` and `command/`. **Cross-app — this is an AGENTS.md approval gate.**
**Status:** ✅ COMPLETE (2026-08-11). All four sites fixed and verified live, including the forced-failure path.

> The same PostgREST 1000-row truncation already measured in `vendor` exists in
> four list queries across `booker` and `command`. Fix those four, and the
> silent-failure contract that hides them. Optimise for **naming exactly what
> each truncation loses**, because the sort order decides that and it differs
> per query.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app and plan (e.g. "vendor bookings plan B1").

---

## Scope

**In scope:** `booker/services/offerings.service.ts`,
`booker/services/vendors.service.ts`, `command/services/users.service.ts`,
`command/services/vendors.service.ts`, and their direct call sites.

**Explicitly out of scope:** the **mobile apps** — `ezzy-vendor-mobile` has two real sites of the same bug (including the monthly revenue figure) and is covered by `.plans/2026-08-11-mobile-vendor-unbounded-queries.md`; `ezzy-booker-mobile` has zero query sites. This plan originally said nothing about either, which was an omission rather than a decision, corrected 2026-08-11. Also out of scope: `backbone/` — investigated 2026-08-11 and clean (`get_booker_contacts` is the only set-returning function `authenticated` can call, and both Edge Functions are per-user). And `vendor/` entirely — covered by
`.plans/2026-08-11-vendor-bookings-pagination-and-contacts-cap.md`;
`command/services/payouts.service.ts` (**already paginated — see F2**);
`command/services/oversight.service.ts` (**not a bug — see F3**); the broken lint
setups in both apps (F10, F11) beyond noting they cannot be used as a gate here.

**Sibling plans.** This is the cross-app half of a split agreed on 2026-08-11.
The vendor plan runs independently and neither blocks the other — see D1 for why
they are not one plan, and note the correction there about a shared helper.

---

## Investigation findings (verified by reading each site, 2026-08-11)

**Method note.** A first pass used `grep -c '\.range('` per file. That is **not a
reliable signal** and produced two false positives, both corrected below. Every
item in this plan was confirmed by opening the file.

| # | Finding | Location |
|---|---|---|
| F1 | The mechanism is measured, not theorised. In `vendor`, a live query over 1,253 rows returned `Content-Range: 0-999/1253` and a total understated by **19.7%**, with **no error raised to supabase-js**. `max_rows = 1000` is set in the project's own config. | vendor dashboard plan B1 (verified 2026-08-11); `backbone/supabase/config.toml:18` |
| F2 | **FALSE ALARM — already handled.** `command/services/payouts.service.ts` is **already paginated**: `fetchPaged` at `:117` with `PAGE_SIZE`/`MAX_ROWS`, `count: "exact"` and a stable `created_at, id` sort. An earlier statement of mine that command's services were "almost entirely unbounded" was an over-generalisation. **Do not touch it.** | `command/services/payouts.service.ts:46,50,117-139` |
| F3 | **FALSE ALARM.** `command/services/oversight.service.ts` is not affected. Its bookings list is deliberately `.limit(50)` (`:50`), and the other two queries use `count: "exact", head: true` — head requests return **no rows at all**, so `max_rows` cannot apply. | `command/services/oversight.service.ts:45-62` |
| F4 | **`booker` `getActiveOfferings` is the most severe site in either app.** It fetches every active offering platform-wide, unbounded, `.order("code")`. The wizard then runs `dedupeByCode(all)`. Because the sort is alphabetical, truncation does not drop a random sample — it **cuts the catalogue alphabetically from the end**, so every offering whose code sorts after the cutoff becomes invisible and unbookable. | `booker/services/offerings.service.ts:32-41` (order `:38`); `booker/components/booking/BookingWizard/useBookingWizard.ts:60-66` |
| F5 | **`command` `getUsers` loses the NEWEST users.** Platform-wide `profiles` — every booker, vendor staff member and admin, so it will cross 1000 sooner than any per-vendor list. `.order("created_at", { ascending: true })` is **oldest-first**, so truncation drops the most recently registered users: precisely the ones an ops admin is looking for when someone just signed up and complained. | `command/services/users.service.ts:4-11` (order `:9`); caller `command/components/users/UsersPage/useUsers.ts:28` |
| F6 | **`command` `getVendors` loses the OLDEST vendors, and is shell-level state.** `.order("created_at", { ascending: false })` is newest-first, so the KYC work queue (new applications) is protected and the back catalogue disappears instead. It is fetched into `useAppShell` state **and** independently by the Vendors page — two call sites, two fetches. Same shell-array architecture as vendor's `getBookings`. | `command/services/vendors.service.ts:28-41` (order `:39`); `command/components/layout/AppShell/useAppShell.ts:52,128`; `command/components/vendors/VendorsPage/useVendors.ts:5` |
| F7 | **`booker` `getVendorsForOffering` — DOWNGRADE.** Real but far lower impact than I first implied: it filters `.eq("code", offeringCode)`, so the row count is *the number of vendors offering that one code*. Exceeding 1000 vendors for a single offering code is not a near-term risk. Fix it for consistency, not urgency. | `booker/services/vendors.service.ts:16-23` |
| F8 | **`booker` `getBookings` — DOWNGRADE.** RLS scopes it to the signed-in customer's **own** bookings. One person exceeding 1000 bookings is implausible; `.order("created_at", desc)` also means the oldest would go first, which is the least harmful direction. Named here so it is not "missed"; deliberately not fixed. | `booker/services/bookings.service.ts:68-79` |
| F9 | **`booker` `getSlotOccupancy` — NOT a risk.** Scoped to one `booked_date` and an explicit `.in("schedule_id", …)` list. Realistically far under 1000 rows. Dropped from scope. | `booker/services/schedules.service.ts:164-176` |
| F10 | **Every affected function swallows its errors** — `if (error \|\| !data) return []` at `booker/offerings:39`, `booker/vendors:23`, `command/users:11`, `command/vendors:41`. A failed fetch is indistinguishable from a genuinely empty result, which is exactly what hides a truncation from anyone testing by eye. Systemic across all three apps, not a vendor quirk. | as cited |
| F11 | **Neither app has a unit-test harness.** `booker` and `command` have only a `lint` script — no `test`. Vendor's `node --test` setup does not exist here, so "extract a testable helper" **does not transfer**; there is nothing to run tests with. | `booker/package.json`, `command/package.json` |
| F12 | **`booker`'s lint is broken.** `"lint": "next lint"` and `next lint` was removed in Next 16 — it now reads `lint` as a directory: `Invalid project directory provided, no such directory: booker/lint`. Different root cause from vendor's (which was a FlatCompat/flat-config mismatch), same outcome. | `booker/package.json` |
| F13 | **`command`'s lint runs but is unusable as a gate**: 10,288 problems (558 errors, 9,730 warnings). It has **no `ignores` block**, so it lints `.next/` — 134 of the reported paths are generated build output. Real source files number roughly ten. Same root cause as the ignores fix already applied in vendor. | `command/eslint.config.mjs`; measured 2026-08-11 |

| F16 | **`booker`'s visual suite is 55/57 failing, and this work did not cause it.** Confirmed by stashing every change and re-running: **identical 55 failed / 2 passed** before and after. The baselines are wholesale stale. Consequence: booker has **no working regression signal**, so "no new failures" cannot be claimed from that suite — only that the count is unchanged. | `booker/visual-tests/pilot.spec.ts`; measured both ways 2026-08-11 |
| F14 | ~~Command cannot be logged into on this machine~~ — **RESOLVED 2026-08-11**: the user restored `root@bookdeck.com` to its seed password and reseeded, after which login and both live verifications succeeded. Original finding kept because it remains true that **this work did not cause it**: Login is refused with *"You do not have access to the Command portal."* `verifyCommandAccess` requires profile status `active` + the `command` portal + an `admin`/`root` role; `marco@bookdeck.com` satisfies **all three** when queried directly with his own JWT, yet the app denies him. Confirmed **pre-existing** by stashing every change in this plan and reproducing the denial at HEAD. Separately, `root@bookdeck.com`'s password no longer matches `seed.sql`, so the local DB has drifted from the seed. **Stage 3's live verification for command is blocked until this is resolved** — it blocks any login-based test, not only this plan's. | `command/services/command.service.ts:8-26`; `components/auth/LoginPage/useLoginPage.ts:38-41`; reproduced at HEAD 2026-08-11 |
| F15 | **`command/playwright.config.ts` uses `baseURL: "http://127.0.0.1:3100"`, which does not work in this WSL2 environment** — the page loads but renders nothing and the HMR websocket fails. `http://localhost:3100` works. Left unchanged (it may be correct in CI), but any live run here must override it. | `command/playwright.config.ts:18`; measured 2026-08-11 |

**Architecture cross-check.** `AGENTS.md` is explicit that these are independent
repos — *"not a monorepo — no shared dependencies or build tooling"*, and each app
folder is its own git repository. This plan does not propose sharing code between
apps; see D1.

---

## BLOCKERS

### B1 — `booker` catalogue truncates alphabetically  ✅ DONE (2026-08-11)
**File:** `booker/services/offerings.service.ts:32-41`

The worst site in either app (F4). Past 1000 active offering rows platform-wide,
every offering whose `code` sorts after the cutoff vanishes from the booking
wizard. This is not a wrong number on a dashboard — it is **product that cannot
be bought**, and it fails silently and systematically rather than randomly.

**Fix approach:** paginate with `count: "exact"`, `PAGE_SIZE` 1000, a ceiling, and
a stable sort. `.order("code")` alone is **not stable** — two offerings can share
a code (the wizard's own `dedupeByCode` exists because they do), and ties reorder
between requests, which duplicates or drops rows across page boundaries. Add
`.order("id")` as tiebreaker.

**Coupling:** with B4 — the wizard cannot report a partial catalogue while the
service can only return a bare array.

**Verification:** ✅ **Verified live 2026-08-11, and the loss was measured.**
1,100 offerings seeded with codes sorting last (`Z00001`–`Z01100`), taking the
platform to **1,120 active**. Issuing the **pre-fix query shape** with a real
customer's JWT (so RLS applied exactly as for a live booker) returned:

    Content-Range: 0-999/1120   → 1,000 of 1,120 rows
    last code returned: Z00980

**120 offerings — `Z00981` through `Z01100` — were invisible and unbookable.**
The paged shape partitions cleanly: `offset=0&limit=1000` returns 1,000 ending at
`Z00980`, `offset=1000&limit=1000` returns the remaining 120 starting at
`Z00981`. No overlap, no gap.

**Stable sort added and it was necessary:** `code` is deliberately shared across
vendors — `dedupeByCode` in the wizard exists for that reason — so ties would
reorder between page requests. `id` is now the tiebreaker.

Test data removed; the platform is back to 20 active offerings.

---

### B2 — `command` user list loses the newest users  ✅ DONE (2026-08-11)
**File:** `command/services/users.service.ts:4-11`

Platform-wide `profiles`, so this crosses 1000 before any per-tenant list (F5).
Oldest-first ordering means the users who disappear are the most recently
registered — the exact rows an ops admin needs when handling a new complaint. The
Users page is the only tool for that job.

**Fix approach:** same paginate + stable sort. `created_at` ascending needs
`.order("id")` beside it for the same tie reason as B1.

**Coupling:** with B4.

**Verification:** ✅ **Verified live 2026-08-11**, once the root credential was
restored. Seeded to **1,268 profiles** — 268 past the cap. The Users page showed
**no truncation notice and no error**, and searching found **"VFY User 1052"**, the
row that sorts LAST under `created_at asc, id asc` and therefore the first casualty
of the old query.

---

### B3 — `command` vendor list loses the oldest vendors  ✅ DONE (2026-08-11)
**File:** `command/services/vendors.service.ts:28-41`

Newest-first (F6), so the KYC work queue is protected and the back catalogue is
what disappears — a vendor onboarded early simply stops being findable. It is also
**shell-level state** (`useAppShell.ts:52,128`) *and* fetched again by the Vendors
page, so a truncated array propagates to every surface reading vendors, not just
the list page.

**Fix approach:** paginate + stable sort as above.

**Also note, not necessarily fix:** the double fetch (shell + page). Left alone
here — see C3 — because collapsing it is a state-ownership change, not a
truncation fix, and mixing the two would obscure both.

**Verification:** ✅ **Verified live 2026-08-11.** Seeded to **1,107 vendors**. The
Vendors page showed no notices, and searching found **"Harbor Sports Complex"** —
the OLDEST vendor, and so exactly what a newest-first truncation removes. That it
is real seed data rather than one of my seeded rows is the point: the back
catalogue is what disappears.

---

### B4 — All four functions report failure as "empty"  ✅ DONE (2026-08-11) — both apps
**File:** `booker/offerings:39`, `booker/vendors:23`, `command/users:11`, `command/vendors:41`

`return []` on error (F10) means a dropped connection renders as an empty
catalogue, an empty user list, an empty vendor list — with no indication anything
went wrong. It is also what makes truncation invisible: there is no channel to
report `complete: false` through.

**Fix approach:** return `{ data, error, complete }`. **Precedent already exists in
both apps** — `command/payouts.service.ts:52` returns a `PayoutsResult` with
exactly this shape (F2), so this follows a local pattern rather than importing
vendor's. Update the call sites named in B1–B3 plus `booker/vendors`.

**Coupling:** ships with B1, B2 and B3. Pagination without it cannot report its own
ceiling; the contract change without pagination is churn.

**Verification:** ✅ **Both apps done 2026-08-11.** All four functions return
`{ data, error, complete }` (command's also carry `totalCount`, matching
`PayoutsResult`).

**The booker half mattered most.** `Step1Offering` rendered **"No offerings
available."** on a failed fetch — the platform telling a customer it sells
nothing, and they leave. Failure is now checked *before* the empty case and says
plainly that this is not a list of what is offered. `Step2Vendor` gained the same
split.

---

## IMPORTANT

### I1 — `booker` vendor picker, for consistency  ✅ DONE (2026-08-11)
**File:** `booker/services/vendors.service.ts:16-23`

Downgraded from my initial reading (F7): bounded by vendors-per-offering-code, so
not a near-term risk. Fixed anyway because it sits in the same file family as B1,
shares the contract change in B4, and leaving one of four unbounded is how the
pattern creeps back.

**Verification:** ✅ **Done 2026-08-11.** Paged with the same contract.

**A real defect found while doing it, which the plan had not anticipated:** this
query had **no `ORDER BY` at all**. Paging without one is unsafe — PostgREST gives
no ordering guarantee between requests, so rows can repeat on one page and vanish
from another. Adding `.order("id")` was therefore required, not cosmetic. Had this
been paged without noticing, it would have introduced a subtler bug than the one
being fixed.

---

### I2 — Follow each app's own paging precedent  ✅ DONE both apps (2026-08-11)
**File:** `command/services/payouts.service.ts:117-139`; `booker` has none

**This is deliberately NOT a shared helper.** The apps are separate git repos with
no shared build tooling (AGENTS.md), so nothing can be imported across them, and
neither app has a test harness to prove a helper with (F11). Extracting an
untestable abstraction into two repos independently is worse than following the
proven local pattern.

- **command:** ✅ **Resolved 2026-08-11 — `narrow` does NOT fit.** `fetchPaged` is
  welded to one table: `baseQuery` hardcodes `booking_transactions`, its `SELECT`,
  `DbRow`, `toRow` and a `bookings !== null` filter, and it fixes the sort to
  `created_at` **ascending**. `profiles` and `vendors` need different tables, row
  types and sort directions (vendors is descending). Lifting it would have meant
  rewriting it into a generic helper.
  **Done instead:** `vendor/lib/pagedFetch.ts` was **copied to
  `command/lib/pagedFetch.ts`** — the "copied and adapted, never imported" practice
  AGENTS.md prescribes — and used for B2 and B3. One helper plus one legacy loop in
  command, rather than three near-identical loops.
  **`payouts.service.ts` deliberately NOT migrated:** working money code, out of
  scope, risk without mandate. Logged as C5.
  **The copy carries no tests in command** — no `test` script, and `tsconfig` lacks
  `allowImportingTsExtensions`, so running vendor's test file here needs two
  tooling changes, judged out of scope for a bug fix. The file header says so and
  directs any edit back to vendor's copy, where the rules are mutation-tested.
- **booker:** ✅ **Resolved 2026-08-11 — the plan's instruction was overtaken.** It
  said to write the loop directly because booker had no precedent. By the time
  Stage 2 ran, command's precedent WAS the copied helper (see above), so booker got
  the same copy. Two hand-written loops in booker would have been worse than one
  copied, mutation-tested implementation, and "matching command's shape" now means
  exactly this.

**Judgement, stated rather than assumed:** the vendor plan extracts a helper
because vendor **has** `node --test` and **already had two** copies. Neither
condition holds here. Same problem, different correct answer.

---

### I3 — Decide the ceiling, and surface reaching it  ✅ DONE both apps (2026-08-11)
**File:** all four services

A ceiling is required — an unbounded loop would hang the booking wizard on a very
large catalogue. But reaching it must be **reportable, not silent**, which is what
`complete` in B4 is for.

- `booker` B1: a truncated catalogue is customer-facing. It must not fail closed
  silently; the wizard should say the list is partial rather than imply that is
  everything.
- `command` B2/B3: an ops admin needs to know a list is partial before concluding
  a user or vendor does not exist.

**Open sub-question for execution, not for now:** whether 10,000 (command's
existing `MAX_ROWS`) is right for `profiles`, which is the fastest-growing table
here. Record the decision in this file when made.

---

### I4 — Where "partial" is shown  ✅ DONE both apps (2026-08-11)
**File:** `booker/…/BookingWizard/*`, `command/…/UsersPage/*`, `command/…/VendorsPage/*`

`complete: false` needs a surface in each app.

**Component separation** (`.claude/skills/component-separation/SKILL.md`) — stated
per component, not assumed:
- Any new notice is a **pure display component**: no state, no effects, no
  handlers, no static inline `style={{}}`. It therefore ships as a `.tsx` only,
  which is the documented exception to the companion-hook rule.
- The `complete` flag lives in the existing hooks (`useBookingWizard`, `useUsers`,
  `useVendors`) alongside the data it describes. No `.tsx` gains logic.
- Styling via each app's existing tokens. **Note the difference:** `booker` and
  `vendor` are Tailwind-first, `command` is CSS-Modules-first
  (`architecture/conventions.md:472`), so the command notice should follow the
  CSS-Modules convention rather than copying a Tailwind-styled one from booker.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains. -->

- **D1 — One cross-app plan, or fold into the vendor plan?** → **Separate plan** (resolved 2026-08-11) — the vendor fix needs a targeted-realtime redesign that has no analogue here, cross-app work is its own approval gate, and folding it in would make the vendor work wait on scoping for two other apps. **Correction to the rationale I originally gave:** I argued the vendor plan's helper would be "reused" here. That was wrong — separate repos, no shared tooling, so nothing is importable. The real benefit is only a proven implementation to read, and command already has its own (F2). See I2.
- **D2 — Scope** → **the four real sites only** (resolved 2026-08-11) — `booker` `getBookings` (F8) and `getSlotOccupancy` (F9) are excluded on the evidence above rather than silently omitted.
- **D3 — Error contract** → **`{ data, error, complete }`** (resolved 2026-08-11) — follows `command/payouts.service.ts:52`, a precedent already inside one of the two apps.

**No open decisions.** Clear to proceed to execution approval — which, being
cross-app, is an explicit AGENTS.md gate rather than a formality.

---

## DEFERRED / COSMETIC

- **C1 — `booker`'s lint is broken (F12).** `next lint` was removed in Next 16. A one-line fix in principle (`"lint": "eslint"` plus a flat config), but it is a tooling change unrelated to truncation, and vendor's equivalent turned out to have a non-obvious root cause worth its own attention. **Consequence: lint cannot be a verification gate for the booker half of this plan.**
- **C2 — `command`'s lint has no ignores (F13).** 10,288 problems, dominated by `.next/`. The fix is the same `ignores` block already applied in `vendor/eslint.config.mjs`. Not done here because it would bury this plan's diff in an unrelated 10k-problem cleanup. **Consequence: lint output for command must be filtered to changed files rather than read as a pass/fail gate.**
- **C3 — `command` fetches vendors twice** (shell + Vendors page, F6). A state-ownership question, not a truncation one. Fixing it alongside B3 would conflate two changes.
- **C5 — `command/services/payouts.service.ts` still carries its own paging loop.** Now that `lib/pagedFetch.ts` exists in command, migrating it would leave one implementation. Not done here: working money code, out of scope. Worth doing when payouts is next touched anyway.
- **C4 — the error-swallow pattern is everywhere else too**, including `vendor/staff.service.ts` and most `command` services. B4 fixes only the four functions this plan touches. A systematic sweep is a separate, larger piece of work.

---

## Execution order

Cadence is one stage at a time, per `.claude/skills/developerboss/SKILL.md`.
**Each app is committed separately** — they are separate git repositories, so
there is no single commit spanning this plan.

**Stage 1 — command.** B2 🔄, B3 🔄, B4 🔄, I2 ✅, I3 ✅, I4 ✅. — **CODE COMPLETE 2026-08-11**; the three 🔄 await live verification, blocked by F14.
Starts here because command already has the paging precedent to follow (F2), so it
carries the least design risk.

**Stage 2 — booker.** B1 ✅, I1 ✅, B4 ✅, I2 ✅, I3 ✅, I4 ✅. — ✅ **COMPLETE 2026-08-11**, with B1 verified live against 1,120 offerings.

**Stage 3 — verification.** Both apps, per the table below.

**Coupled within each stage:** B4 ships with the pagination items for that app —
neither half is meaningful alone. **Not coupled across stages:** command and
booker can ship independently and in either order; Stage 1 is first for risk
reasons, not dependency.

---

## Verification

| Item | Check | Kind |
|---|---|---|
| B1 | Seed >1000 active offerings; every code still reachable in the wizard, including late-alphabet ones | ⚠️ live |
| B1 | Stable sort: two offerings sharing a `code` appear exactly once across a page boundary | ⚠️ live |
| B2 | Seed >1000 profiles; the newest user is present in the Users page | ⚠️ live |
| B3 | Seed >1000 vendors; the oldest vendor is still findable | ⚠️ live |
| B4 | Force a failure; each surface shows an error, **not** an empty list | ⚠️ live |
| I3 | Force the ceiling; the UI reports partial data rather than showing short data as complete | ⚠️ live |
| I4 | Notice renders in both themes where the app supports them | ⚠️ live |
| All | `npx tsc --noEmit` in each app | ✅ machine |
| All | `npx playwright test` — **only if** the app has a suite; confirm before promising it | ✅ machine, if present |

**Lint is NOT a gate for this plan.** booker's does not run at all (F12) and
command's reports 10,288 problems dominated by build output (F13). Filtering
command's output to the changed files is the most that can be claimed. This is
stated up front because the vendor plan previously carried "lint clean" as a
verification step that turned out to be unrunnable for its entire duration.

**Live methodology — proven on 2026-08-11** during the vendor dashboard plan's B1,
and reusable here:
- Seed in a **single transaction** with `alter table … disable trigger user`
  *inside* it, so any failure rolls the disable back and cannot leave triggers off.
- Tag rows with a sentinel column value so cleanup is one scoped delete.
- Verify against SQL ground truth **and** through the real UI — the UI is what
  proves the client-side loop, not just the query.
- Clean up, then confirm row counts, orphan counts and trigger counts return to
  baseline.

**Trap already paid for once:** unique **indexes** are enforced even with triggers
disabled. Check each target table's unique constraints before generating rows —
`bookings_no_duplicate` cost a failed seed run on the vendor plan.

**Seeding effort is not equal across items.** B2 needs >1000 `profiles` rows,
which touches `auth.users`, and B3 needs >1000 `vendors`, which may cascade into
`vendor_kyc`. Size both before starting; if either proves disproportionate, **park
that item with the reason stated** rather than downgrading it to a
mechanism-only argument.


---

## Remaining work (2026-08-11)

All four truncation sites are fixed and **verified live**. Outstanding:

- ~~B4 forced-failure check~~ ✅ **Done 2026-08-11.** A 500 was injected into each
  query in turn. Command's Users and Vendors pages both showed "Couldn't load …",
  and booker's wizard showed "Couldn't load services" **with "No offerings
  available." correctly suppressed** — the substitution this plan exists to stop.
  Partial-data notices were suppressed in all three, since a failure outranks a
  subset.
- ~~Stage 3 sweep~~ ✅ `tsc --noEmit` and `next build` clean in both apps; vendor's
  92 unit tests pass. Neither the visual suites (F16) nor lint (F12/F13) can serve
  as gates.

## Findings added during Stage 2

| # | Finding | Location |
|---|---|---|
| F16 | **`booker`'s visual suite is wholesale stale — 55 failed / 2 passed.** Confirmed **pre-existing** by stashing every change in this plan and re-running: identical 55/2. It cannot act as a regression gate for this work, and equally is not evidence against it. Someone must decide whether to re-record those baselines or retire the suite. | `booker/visual-tests/pilot.spec.ts`; measured 2026-08-11 |
| F17 | **`command`'s sidebar sits outside the 900px viewport its own Playwright config sets**, making nav unclickable in tests at the default size; 1440×1400 works. Left unchanged, but any live run must widen the viewport. | `command/playwright.config.ts:21`; measured 2026-08-11 |
| F18 | **`booker`'s `getVendorsForOffering` had no `ORDER BY` at all.** Paging an unordered query is unsafe — PostgREST guarantees no ordering between requests, so rows can repeat on one page and vanish from another. Applying this plan's fix mechanically, without noticing, would have introduced a *new* defect while fixing the old one. `.order("id")` added. | `booker/services/vendors.service.ts:16-23` |

| F19 | ~~A request that never settles leaves the UI showing an empty list indefinitely.~~ **CORRECTED 2026-08-11 — this was a FALSE ALARM, and the original reading was mine.** Nothing hangs. `postgrest-js` retries a failed GET **three times with 1s/2s/4s backoff** (`DEFAULT_MAX_RETRIES = 3`, `getRetryDelay = min(1000 * 2**i, 30000)`), rethrowing only an `AbortError` immediately. So an aborted request surfaces an error after **~9 seconds**, measured. The earlier check waited 4–5s and mistook the retry window for a hang. **The real defect was smaller and different:** command's Users and Vendors pages had no loading state, so for those ~9 seconds an admin was shown an empty list — i.e. "no users" — rather than "still loading". Fixed by adding a loading branch to both, matching `PayoutsPage`. Verified live: "Loading users…" at 3s, error notice at 12s. No timeout was added — a retrying client is correct behaviour, and cutting it short would trade recoverable transient failures for spurious errors. | `node_modules/@supabase/postgrest-js/dist/index.mjs:5,13,254-273`; measured 2026-08-11 |
| F20 | **`fetchAllPages` did not honour its own error contract when the fetcher threw.** It promised to RETURN `{ error }` but let a thrown rejection escape, so a caller trusting that rendered an empty list for a failed fetch. Fixed in all three copies and covered by two new tests in vendor. Found by running B4 rather than by reading the code. | `*/lib/pagedFetch.ts`; `vendor/lib/pagedFetch.test.ts` |
