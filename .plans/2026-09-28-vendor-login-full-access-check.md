# Vendor login: run the full access check at sign-in

**Date:** 2026-09-28
**App / scope:** `vendor/` only — `components/auth/LoginPage/useLoginPage.ts`,
`components/auth/LoginPage/LoginPage.tsx` (prop type only),
`components/layout/AppShell/useAppShell.ts`; from I3 also `services/vendor-access.service.ts`,
`components/kiosk/KioskShell/useKioskShell.ts`, `components/kiosk/KioskShell/KioskShell.tsx`.
No schema change, no new dependency.
**Line references:** point at the current vendor working tree (B1 + I3, uncommitted) unless
prefixed `HEAD:`, which pins them to vendor `HEAD` `27f7b1a` — used only where this plan
describes code B1 replaced. Re-pointed 2026-09-28 after I3.
**Status:** COMPLETE (2026-09-28) — B1 and I3 deployed to staging and production by you; staging tested OK by you; production confirmed serving the new build (live chunks fetched and checked). F2 and F4 remain open as noted-only follow-ups for you.

> Make the login form apply the same three access layers as the session-restore gate and the
> kiosk, so an account that will be rejected on its next reload is rejected, with a reason, at
> sign-in instead. Found by [2026-09-28-vendor-kiosk-unavailable-in-production.md](2026-09-28-vendor-kiosk-unavailable-in-production.md) (B6).

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, F# = Finding, D# = Decision; numbers are
> plan-local — qualify cross-plan refs by app (e.g. "vendor-kiosk B6").

---

## The gap, grounded in the code

The vendor app has **three** places that decide whether a user may use the portal. Two apply
all three layers from `auth-and-roles.md` (portal grant, profile status, vendor-admin role at
a vendor); one does not.

| Where | Function | Portal grant | Profile status | Vendor-admin + vendor status |
|---|---|---|---|---|
| Session restore (every mount of `/`) | `useAppShell.ts:227` → `verifyVendorAccess` | ✅ | ✅ | ✅ |
| Kiosk | `useKioskShell.ts:132` → `verifyVendorAdminFor` | ✅ | ✅ | ✅ |
| **Login form** (before B1) | `HEAD:useLoginPage.ts:325` → `getUserVendors` only | ❌ | ❌ | ✅ |
| Login form (after B1) | `useLoginPage.ts:367` → `verifyVendorAccess` | ✅ | ✅ | ✅ |

After a successful login, `handleLoginSuccess` (`useAppShell.ts:723`) sets `loggedIn` directly
and **never runs `verifyVendorAccess`**. So an account that fails layer 1 or 2 gets a working
dashboard for exactly as long as the tab is not reloaded, then:

- a reload signs it out silently to the login page (`useAppShell.ts:267`);
- the kiosk shows "Temporarily unavailable" (vendor-kiosk B6 — the production incident: a
  `booker`-only account with a vendor-admin row).

`vendor-access.service.ts`'s own header says the three layers belong "in one place" (plan
B-I2). The login form is the place that was missed.

### F1 — a second, smaller defect on the same branch  (folded into B1)
`HEAD:useLoginPage.ts:329-333`: a user whose only vendor is **suspended** has no active vendor, so
the login form calls `onPendingVendor(all[0].id)` → `handlePendingVendor`
(`HEAD:useAppShell.ts:725`), which sets `pendingKycVendorId` but **not** `vendorSuspended`.
`KycStatusPage` therefore shows the KYC "awaiting" copy to a suspended vendor — exactly what
B-I2 fixed on the restore path (`useAppShell.ts:246-253`), still broken on login. Until the
next reload, when the restore path shows the correct "Your account is suspended". The verdict
B1 introduces carries `vendor_suspended`, so fixing it costs one argument.

### F2 — the mobile vendor app has the same gap  (OUT OF SCOPE — noted only)
In `ezzy-vendor-mobile/src`, only `services/kioskAccess.service.ts` reads `user_portals`; the
sign-in gate keys on vendor membership. A portal-less account likely signs in on mobile too.
Not verified end to end, and a separate app — needs its own plan if you want it.

---

## BLOCKERS

### B1 — `handleLogin` runs `verifyVendorAccess` and routes on its reason  ✅ DONE (2026-09-28)
*✅ Executed as specified (D1-A, D2-A). Changed: `useLoginPage.ts` (import; `handleLogin` —
verdict first, shared `refuse()` for the closure-notice + `signOut()` block, pending/suspended
arm, defensive fallback kept), `useAppShell.ts` (`handlePendingVendor(vendorId, suspended =
false)` sets `vendorSuspended`; interface type; cross-reference comment at the restore
gate), `LoginPage.tsx` (prop type only).
**Machine-verified:** `tsc --noEmit` clean; `npm test` 484/484; `eslint` on the three files —
4 problems, **identical to HEAD** (linted a HEAD copy: same 3 `set-state-in-effect` + 1
`exhaustive-deps`, shifted 2 lines by the new comment), all pre-existing and tracked by
2026-09-25-vendor-eslint-cleanup.
**Local browser (Playwright → `localhost:3100` → local Supabase), 2 full runs, 5/5 each:**
(1) dante → dashboard, survives reload; (2) maria → "Choose your business"; (3) dante with
the `vendor` portal row removed → stays on login with "Your account has no vendor access.
Contact support.", no dashboard, still on login after reload; (4) dante's only vendor
`suspended` with an **approved** KYC packet → "Your account is suspended" (was "Documents
verified" before — F1 fixed); (5) `pending_activation` + submitted packet → "Application
under review". Fixtures: `user_portals` row removed and restored with its original
`granted_at`; throwaway vendors + `vendor_kyc` rows **inserted** (vendors' triggers are
UPDATE-only, `vendor_kyc`/`vendor_members` have none) and deleted; dante's membership
re-pointed and restored. Post-run check confirmed the local DB exactly as found.
**Not verified:** production (needs deploy). See F3.*
**Files:** `components/auth/LoginPage/useLoginPage.ts:317-409` (`handleLogin`; was
`HEAD:useLoginPage.ts:316-363`), `components/layout/AppShell/useAppShell.ts:743-746`
(`handlePendingVendor`, + its interface line `:106`), `components/auth/LoginPage/LoginPage.tsx:35`
(prop type only), and the `onPendingVendor` parameter type on `useLoginPage.ts:317`.

**Change** (the D1 recommendation):

1. After `signIn` succeeds, call `verifyVendorAccess(signInData.user)` — the **existing**
   function, unchanged. No new access logic.
2. Branch on the verdict, mirroring the restore path (`useAppShell.ts:229-270`) so the two
   cannot disagree:
   - `pending_kyc` → `onPendingVendor(access.vendorId, false)` (today's behaviour).
   - `vendor_suspended` → `onPendingVendor(access.vendorId, true)` (fixes F1).
   - `no_access` / `suspended` / `pending_profile` → the **existing** closure-notice lookup
     and `signOut()` block (was `HEAD:useLoginPage.ts:335-355`; now `refuse()`, `useLoginPage.ts:327-349`), with copy per D2. The closure lookup stays *before*
     `signOut()` — its comment explains why.
   - allowed → fall through to the existing `getUserVendors()` → one vendor /
     `select_vendor` logic, unchanged.
3. `handlePendingVendor` takes `(vendorId: string, suspended = false)` and calls
   `setVendorSuspended(suspended)` alongside `setPendingKycVendorId`. The default keeps any
   other caller unchanged.
4. Keep the `active.length === 0` branch after an allowed verdict as the defensive fallback it
   becomes (a vendor could be deactivated between the two reads). Do not delete it.

**Why not unify login into the restore path instead:** see D1 option B.

**Component separation:** all logic stays in the two hooks. `LoginPage.tsx` changes only the
`onPendingVendor` prop type — no state, effect or styling enters the render layer. No new
component.

**Risk:** accounts that sign in today without a `vendor` portal grant will be refused at
login. They are already refused on their first reload, so this moves the refusal earlier
rather than creating one — but run I1's query first so nobody is surprised.

**Verification:** see the Verification section.

---

## IMPORTANT

### I1 — find every production account in the incident's state, before B1 ships  ✅ DONE (2026-09-28) — closed by you. Verified by you on production: audit query returned **0 rows**, and a sanity query over the same joins showed `vendor_admin_rows > 0` = `with_vendor_portal`, so the empty result is real.
Read-only; **you run it** in the production SQL editor (it returns emails, so the output
stays with you):
```sql
select p.email, v.name as vendor, s.name as profile_status
  from public.vendor_members vm
  join public.roles    r on r.id = vm.role_id and r.name = 'vendor-admin'
  join public.profiles p on p.id = vm.user_id
  join public.statuses s on s.id = p.status_id
  join public.vendors  v on v.id = vm.vendor_id
 where not exists (
   select 1 from public.user_portals up
     join public.portals po on po.id = up.portal_id
    where up.user_id = vm.user_id and po.name = 'vendor');
```
*2026-09-28: you ran it on production after I2 — **no rows**. Nothing is refused by B1 that is not already refused on reload. Status left for you to close.*

Every row is an account that can sign in today and breaks on reload / at the kiosk. Grant
each the `vendor` portal in Command (or decide it should not have access) **before** B1 makes
their login fail outright. Expected: the test account from vendor-kiosk B6, and possibly
nothing else — vendor registration grants the portal atomically
(`app/api/auth/register/route.ts:233`).

### I2 — fix the incident's test account  ✅ DONE (2026-09-28) — closed by you. Verified by you on production: `vendor` portal granted via Command, kiosk opens for the account.  *(yours — data, not code)*
*2026-09-28: you reported this done via Command and the production kiosk now works for the account. Status left for you to close.*
Grant `2022a260-29e6-4272-818e-1705764e5c59` the `vendor` portal in Command. Independent of
B1; unblocks the production kiosk today. Tracked here so vendor-kiosk B6 can close against
it.

---

### I3 — a failed access query must not read as "no access"  ✅ DONE (2026-09-28)
*Added 2026-09-28 at your request. Supersedes vendor-kiosk I1, widened from the kiosk to all
three callers; addresses F3.*

*✅ Executed as specified (D3-A, D4-A). Changed:
`services/vendor-access.service.ts` — `"unavailable"` reason (`:47`),
`ACCESS_UNAVAILABLE_MESSAGE` (`:50`); `verifyVendorAccess` queries (`:62-75`, `profiles` now
`.maybeSingle()`) and error check (`:79-81`); `verifyVendorAdminFor` queries (`:127-141`) and
error check (`:146-148`). `useLoginPage.ts` — `retryLater()` (`:353-357`), `unavailable` arm
(`:370-373`), fallback's no-vendors arm now `retryLater()` (`:398-401`). `useAppShell.ts` —
`unavailable` arm keeps the session and sets the notice (`:236-240`); `signOutNotice` doc
(`:96-100`). `useKioskShell.ts` — `"unavailable"` gate (`:26`, set at `:140`). `KioskShell.tsx`
— gate branch (`:27-30`), copy (`:43`), Try again + Staff exit (`:63-72`), `RotateCw` import.
**Machine-verified:** `tsc --noEmit` clean; `npm test` 484/484; `eslint` on all six files —
9 problems, **identical to HEAD** (HEAD copies linted: `vendor-access.service.ts` 5 × `as any`
= eslint-cleanup L6; `useAppShell.ts` 3 + 1 = L5, L23–L25; the other four files 0 → 0).
**Local browser (Playwright → `localhost:3100` → local Supabase), `rest/v1/user_portals`
intercepted → 500, no DB mutation, 4/4:** (A) sign-in → "We couldn't check your access just
now. Please try again.", **not** "no vendor access", no dashboard, still signed out after the
fault is lifted and the page reloaded; (B) signed in, then reload with the fault → login page
with the same message, fault lifted + reload → dashboard **without re-entering the password**
(session kept, D3); (C) kiosk with the fault → "This kiosk can't reach the booking service right
now…", **Try again** + **Staff exit**, no Staff sign-in; fault lifted + Try again → Welcome;
(D) kiosk healthy → Welcome. Kiosk surface screenshotted in light and dark — legible in both,
buttons reuse `.exitBtn` (44px min height, theme tokens). **B1's 5 cases re-run: 5/5**, with
case (3) — a genuinely missing portal — still refused, proving the two are now told apart.
**Not verified:** production (needs deploy); `.maybeSingle()` on a user with **no** profile
row (unreachable — `profiles.id` is the `auth.users` FK, and `handle_new_user` creates it).*

**The defect** (as it stood before I3): both access checks in `services/vendor-access.service.ts`
destructure only `{ data }` from their three parallel queries — `verifyVendorAccess`
(`HEAD:vendor-access.service.ts:52-59`) and `verifyVendorAdminFor`
(`HEAD:vendor-access.service.ts:105-114`). A query that **fails** (network, expired token, a 4xx/5xx)
leaves `data` null, which the layer checks read as "no portal" / "no membership" → `no_access`.
A transient failure and a genuine refusal are indistinguishable, and each caller acts on the
refusal:

| Caller | Before I3, on a failed query | Call site |
|---|---|---|
| Sign-in | refused with "no vendor access", signed out (F3) | `useLoginPage.ts:367` |
| Page reload | signed out to the login page, no message | `useAppShell.ts:227` |
| Kiosk | "Temporarily unavailable — Please see the front desk." | `useKioskShell.ts:132` |

A second instance on the sign-in path: `getUserVendors` (`services/vendor.service.ts`) also
returns `[]` on error, so after an **allowed** verdict a failed vendor read lands in B1's
defensive fallback and refuses. B1's comment assumed that branch meant "access changed between
two reads"; a failed read is far likelier.

**Fix:**
1. **Service.** Add `"unavailable"` to `VendorAccessReason` — "the check could not be
   completed", distinct from every refusal. In both functions, capture each query's `error`
   and return `{ allowed: false, reason: "unavailable", vendorId }` if **any** errored, before
   the layer checks run. Switch the `profiles` read from `.single()` to `.maybeSingle()`:
   `.single()` reports a missing row as an *error* (PGRST116), which would turn "no profile"
   into "unavailable"; `maybeSingle()` returns `null` data without error, preserving today's
   meaning (`pending_profile`). `verifyVendorAdminFor`'s membership read already uses it.
2. **Sign-in** (`useLoginPage.ts`). `unavailable` → "We couldn't check your access just now.
   Please try again.", then `signOut()` (the login screen is the signed-out state; the user
   retries by pressing Sign In). The B1 fallback's "no vendors at all" arm shows the same
   copy instead of refusing (it now only means a failed read). The `pending` arm of the
   fallback is unchanged.
3. **Page reload** (`useAppShell.ts`). `unavailable` → per D3.
4. **Kiosk** (`useKioskShell.ts` + `KioskShell.tsx`). `unavailable` → a new gate
   `"unavailable"`, rendered per D4. Never `signed_out`: the session is fine.

**Component separation:** logic stays in `useLoginPage.ts`, `useAppShell.ts` and
`useKioskShell.ts`. `KioskShell.tsx` gains only a branch on `k.gate` and, per D4, one button
wired to the hook's existing `retryAuth` (`useKioskShell.ts:278`, previously returned but unused)
reusing `styles.exitBtn` — no state, effect, or new styling in the render layer.

**Out of scope, noted:** `getUser()` itself failing on a network error returns no user, which
the kiosk (`useKioskShell.ts:127`) and reload path (`useAppShell.ts:216`) read as signed out.
Same class, different call; not part of this item (F4).

**Verification:** `tsc`, `npm test`, `eslint` (baseline = HEAD's 4 known problems). Local
browser: Playwright **intercepts** one access query (`rest/v1/user_portals`) and answers 500 —
no DB mutation — on each surface: sign-in shows the retry copy; reload behaves per D3; kiosk
shows the D4 surface and recovers when the interception is lifted. Then B1's five cases re-run
unchanged, proving no regression.

### F4 — `getUser()` network failure reads as "signed out"  ⬜ TODO  (noted only)
`useKioskShell.ts:127`, `useAppShell.ts:216`: `getUser()` returns `{ user: null, error }` on a
network failure, indistinguishable at these call sites from "no session". Same class as I3,
different API. Not fixed: out of I3's scope, and a kiosk showing "Staff sign-in" for a network
failure at least leaves staff a way out.

### F3 — one unexplained refusal of a valid login on the first harness run  ✅ DONE (2026-09-28) — closed by you: accepted as mitigated by I3 (a repeat now shows the retry message instead of refusing). Not reproduced; original cause unknown.
On the **first** run only, case (1) — dante, fully entitled — was refused with "no vendor
access". Not reproduced in 2 further full runs, a warm single-case run, or a **cold
dev-server restart** with network logging (all three access queries 200 with correct data →
dashboard). The first server's log shows nothing but normal compiles. The first run had no
network capture, so the cause is unknown.
*Most plausible, unproven:* one of `verifyVendorAccess`'s queries returned no data (error or
empty result) during the first cold compile — and because the function **discards query
errors** (vendor-kiosk I1), any failure becomes `no_access`. B1 adds three queries to the
sign-in path, so it widens the surface for that pre-existing defect: a transient failure now
refuses the login outright (the pre-B1 path had the same outcome only if `getUserVendors`
failed). **Recommended next step:** vendor-kiosk I1 — make `verifyVendorAccess` /
`verifyVendorAdminFor` return a distinct "could not check" reason, and have sign-in show a
retry message instead of refusing. Not done here: out of B1's scope and not reproduced.
*2026-09-28: that next step is done as I3. A failure of the kind suspected here now shows "We
couldn't check your access just now" instead of refusing (I3 case A). The original cause is
still unknown, so this stays open — status left for you to close.*

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains. -->

- **D1 — where the login-time check lives → A, in `handleLogin`** (resolved 2026-09-28) — smallest change, reuses `verifyVendorAccess` unchanged; the duplicated reason mapping is mirrored and cross-referenced by comment.
  - **A (recommended):** in `handleLogin`, as B1 describes. ~25 lines across two hooks,
    reuses `verifyVendorAccess` as-is, no change to the restore path.
    *Cost:* the reason-to-screen mapping exists twice (login + restore). Mitigated by B1
    step 2 mirroring it exactly and a comment in each pointing at the other.
  - **B:** extract the restore effect's body (`useAppShell.ts:215-294`) into one
    `resolveSession(user)` in `useAppShell`, and have the login form just `signIn` then call
    it. One gate, truly in one place. *Cost:* a structural refactor of the app's auth entry
    point, including the multi-vendor picker, which today lives in the **login** view on
    one path and in `pendingVendors` on the other — they would have to be merged. Larger
    blast radius than this bug justifies.

- **D2 — what a refused user is told at sign-in → A, keep today's copy** (resolved 2026-09-28) — true for all three refusals, matches the restore path, no new strings.
  - **A (recommended):** keep today's copy for all three refusals — the closure notice if
    there is one, otherwise "Your account has no vendor access. Contact support." It is true
    for all three, matches the restore path's (generic) behaviour, and adds no strings.
  - **B:** one sentence per reason — e.g. "Your account is suspended. Contact support." /
    "Your account hasn't been activated yet." More helpful, but the restore path would then
    say something different for the same account unless it changes too, which widens scope.

- **D3 — page reload when the access check could not be completed → A, keep the session** (resolved 2026-09-28) — a transient failure costs a reload, not a password.
  - **A (recommended):** keep the session; show the login page with "We couldn't check your
    access just now. Please try again." A reload re-runs the check with the session intact,
    so a transient failure costs one reload, not a password. Signing in again also works.
  - **B:** sign out, with the same message. Simplest and identical to sign-in, but a flaky
    connection costs the vendor their session.
- **D4 — what the kiosk shows when the check could not be completed → A, Try again + Staff exit** (resolved 2026-09-28) — recoverable without staff reloading the tablet.
  - **A (recommended):** "Temporarily unavailable" / "This kiosk can't reach the booking
    service right now. Please see the front desk." with a **Try again** button (the hook's
    unused `retryAuth`) and **Staff exit**. No sign-in prompt — the session is fine.
  - **B:** the same copy, no Try again button; recovery is a reload by staff.

## DEFERRED / COSMETIC
- **No unit test for the branch.** `npm test` only covers `lib/**/*.test.ts`, and the branch
  lives in a hook that calls Supabase. Extracting a pure `lib/` mapper just to test four
  lines would be an abstraction with one caller; the local-browser checks below cover each
  arm instead. Revisit if D1 becomes B.
- **F2 (mobile)** — separate app, separate plan.

## Execution order
1. ~~**I2**~~ — ✅ 2026-09-28, closed by you.
2. ~~**I1**~~ — ✅ 2026-09-28, closed by you (0 rows, sanity check passed).
3. ~~**D1, D2**~~ — resolved 2026-09-28 (A / A).
4. ~~**B1**~~ — ✅ 2026-09-28, verified locally.
4a. ~~**D3, D4**~~ — resolved 2026-09-28 (A / A).
4b. ~~**I3**~~ — ✅ 2026-09-28, verified locally. Ships with B1.
5. ~~**Deploy**~~ — ✅ 2026-09-28, by you: staging (tested OK by you), then promoted to production. Production verified to be **serving** the build: `vendor.ezzy.ph` chunks fetched 2026-09-28 contain "can't reach the booking service", "couldn't check your access" and `reason:"unavailable"`. A production sign-in/kiosk run was not separately reported.

## Verification

| Item | Check | Kind |
|---|---|---|
| B1 | `npx tsc --noEmit` and `npx eslint` on the changed files, in `vendor/` | Machine |
| B1 — no portal | Local DB: remove the `vendor` `user_portals` row from a seeded vendor-admin, sign in → refused with the D2 copy, no dashboard frame. Restore the row in a `finally`-style cleanup step | Local browser + local DB (triggers checked first, per repo practice) |
| B1 — suspended vendor | Local: set the seeded vendor to `suspended`, sign in → "Your account is suspended" surface, not KYC "awaiting". Restore | Local browser + local DB |
| B1 — pending KYC | Local: a vendor with `pending` status → KYC surface, unchanged | Local browser |
| B1 — happy path | Normal vendor-admin → dashboard; multi-vendor → picker; then **reload** → still signed in | Local browser |
| I1, I2 | Production query result; kiosk opens for the test account after I2 | **Production — you** |
